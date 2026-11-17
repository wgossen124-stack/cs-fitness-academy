-- =====================================================================
--  CS FITNESS Academy v2 - database setup for Supabase
--  Positions, 3 levels per position, one-time code per course,
--  automatic keyword grading of free answers.
--  Course data (answers, keywords) is loaded separately (data.sql).
-- =====================================================================

-- ---------- clean up v1 ----------
drop table if exists responses cascade;
drop table if exists trainee_sessions cascade;
drop table if exists trainees cascade;
do $$ declare r record; begin
  for r in select p.oid::regprocedure as f from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' loop
    execute 'drop function if exists ' || r.f || ' cascade';
  end loop;
end $$;

-- ---------- tables ----------
create table if not exists app_config (key text primary key, value jsonb not null);

create table if not exists people (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  position   text not null,
  created_at timestamptz not null default now()
);

create table if not exists enrollments (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references people(id) on delete cascade,
  course_id     text not null,
  code          text not null unique,
  status        text not null default 'active',   -- active | completed | revoked
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  completed_at  timestamptz,
  last_login_at timestamptz,
  progress      jsonb not null default '{"modules":{},"watched":{}}'
);

create table if not exists sessions (
  token         uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  created_at    timestamptz not null default now()
);

create table if not exists admin_sessions (
  token      uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists answers (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references enrollments(id) on delete cascade,
  video_id      text not null,
  prompt_id     text not null,
  text          text not null default '',
  audio         text,
  audio_mime    text,
  auto          jsonb,
  review        jsonb,
  submitted_at  timestamptz not null default now(),
  unique (enrollment_id, video_id, prompt_id)
);

create table if not exists failed_logins (at timestamptz not null default now());

alter table app_config     enable row level security;
alter table people         enable row level security;
alter table enrollments    enable row level security;
alter table sessions       enable row level security;
alter table admin_sessions enable row level security;
alter table answers        enable row level security;
alter table failed_logins  enable row level security;

-- ---------- helpers ----------
create or replace function _cfg(k text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from app_config where key = k
$$;

create or replace function _course(p_course text) returns jsonb
language sql stable security definer set search_path = public as $$
  select _cfg('courses') -> p_course
$$;

create or replace function _new_code() returns text
language plpgsql security definer set search_path = public as $$
declare alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text;
begin
  loop
    c := 'CS-';
    for i in 1..6 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from enrollments where code = c);
  end loop;
  return c;
end $$;

-- keyword grading: a key point counts when any of its keywords appears at the start of a word
create or replace function _grade(p_text text, p_points jsonb) returns jsonb
language plpgsql immutable security definer set search_path = public as $$
declare
  t text := ' ' || lower(replace(replace(coalesce(p_text, ''), chr(8217), ''''), chr(8216), '''')) || ' ';
  pt jsonb; kw text; hit boolean; hits int := 0; n int := 0; res jsonb := '[]'::jsonb;
begin
  for pt in select * from jsonb_array_elements(coalesce(p_points, '[]'::jsonb)) loop
    n := n + 1; hit := false;
    for kw in select * from jsonb_array_elements_text(pt->'any') loop
      kw := lower(trim(replace(kw, chr(8217), '''')));
      if kw <> '' and t ~ ('\m' || regexp_replace(kw, '([.\\+*?\[^\]$(){}=!<>|:\-#/''])', '\\\1', 'g')) then hit := true; exit; end if;
    end loop;
    if hit then hits := hits + 1; end if;
    res := res || jsonb_build_object('point', pt->>'point', 'hit', hit);
  end loop;
  return jsonb_build_object('score', case when n > 0 then round(hits * 100.0 / n) else 0 end, 'points', res);
end $$;

create or replace function _enrollment(p_token uuid) returns enrollments
language plpgsql security definer set search_path = public as $$
declare e enrollments; s sessions;
begin
  select * into s from sessions where token = p_token;
  if not found or s.created_at < now() - interval '12 hours' then raise exception 'SESSION_ENDED'; end if;
  select * into e from enrollments where id = s.enrollment_id;
  if not found or e.status <> 'active' then
    delete from sessions where token = p_token;
    raise exception 'SESSION_ENDED';
  end if;
  return e;
end $$;

create or replace function _admin(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admin_sessions where token = p_token and created_at > now() - interval '12 hours') then
    raise exception 'ADMIN_SESSION_ENDED';
  end if;
end $$;

-- is a free answer accepted? (admin decision, voice-only waiting for review, or auto score passed)
create or replace function _answer_ok(a answers) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when a.review is not null then a.review->>'status' = 'passed'
    when coalesce(trim(a.text), '') = '' and a.audio is not null then true
    else coalesce((a.auto->>'score')::int, 0) >= coalesce((_cfg('answer_pass') #>> '{}')::int, 60)
  end
$$;

create or replace function _overall(e enrollments) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c jsonb := _course(e.course_id); m jsonb; v jsonb; p text; mp jsonb; a answers;
  per jsonb := '[]'::jsonb; done int; total int; all_done int := 0; all_total int := 0;
begin
  for m in select * from jsonb_array_elements(coalesce(c->'modules', '[]'::jsonb)) loop
    done := 0; total := 0;
    if m->>'type' = 'video' then
      for v in select * from jsonb_array_elements(m->'videos') loop
        total := total + 1;
        if (e.progress->'watched') ? (v->>'id') then done := done + 1; end if;
        for p in select * from jsonb_array_elements_text(v->'prompts') loop
          total := total + 1;
          select * into a from answers where enrollment_id = e.id and video_id = v->>'id' and prompt_id = p;
          if found and _answer_ok(a) then done := done + 1; end if;
        end loop;
      end loop;
    else
      mp := coalesce(e.progress->'modules'->(m->>'id'), '{}'::jsonb);
      total := jsonb_array_length(m->'lessons') + case when (m->>'quiz')::boolean then 1 else 0 end;
      select count(*) into done from jsonb_array_elements_text(m->'lessons') l where coalesce(mp->'lessonsRead', '[]'::jsonb) ? l;
      if (m->>'quiz')::boolean and mp->'quiz'->>'passedAt' is not null then done := done + 1; end if;
    end if;
    per := per || jsonb_build_object('id', m->>'id', 'done', done, 'total', total, 'complete', done = total);
    all_done := all_done + done; all_total := all_total + total;
  end loop;
  return jsonb_build_object('per', per, 'done', all_done, 'total', all_total,
    'percent', case when all_total > 0 then round(all_done * 100.0 / all_total) else 0 end,
    'complete', all_total > 0 and all_done = all_total);
end $$;

-- the person's path: which levels of their position are completed
create or replace function _path(p_person uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('courseId', c.k, 'level', (c.v->>'level')::int,
           'completed', exists (select 1 from enrollments e where e.person_id = p_person and e.course_id = c.k and e.status = 'completed'))
         order by (c.v->>'level')::int), '[]'::jsonb)
  from jsonb_each(_cfg('courses')) as c(k, v), people pe
  where pe.id = p_person and c.v->>'position' = pe.position
$$;

create or replace function _answers_view(p_enrollment uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'videoId', a.video_id, 'promptId', a.prompt_id, 'text', a.text,
    'hasAudio', a.audio is not null, 'auto', a.auto, 'review', a.review,
    'ok', _answer_ok(a), 'submittedAt', a.submitted_at) order by a.submitted_at), '[]'::jsonb)
  from answers a where a.enrollment_id = p_enrollment
$$;

create or replace function _view(e enrollments) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', p.name, 'position', p.position, 'courseId', e.course_id, 'status', e.status,
    'progress', e.progress, 'answers', _answers_view(e.id),
    'answerPass', coalesce((_cfg('answer_pass') #>> '{}')::int, 60),
    'overall', _overall(e), 'path', _path(p.id))
  from people p where p.id = e.person_id
$$;

create or replace function _finish_if_done(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare e enrollments;
begin
  select * into e from enrollments where id = p_id;
  if e.status <> 'active' or not (_overall(e)->>'complete')::boolean then return false; end if;
  update enrollments set status = 'completed', completed_at = now() where id = p_id;
  delete from sessions where enrollment_id = p_id;
  return true;
end $$;

create or replace function _result(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e enrollments;
begin
  if _finish_if_done(p_id) then
    select * into e from enrollments where id = p_id;
    return jsonb_build_object('completed', true, 'courseId', e.course_id, 'path', _path(e.person_id));
  end if;
  select * into e from enrollments where id = p_id;
  return jsonb_build_object('completed', false, 'me', _view(e));
end $$;

create or replace function _empty_mod() returns jsonb language sql immutable as $$
  select '{"lessonsRead":[],"quiz":{"best":0,"attempts":0,"passedAt":null}}'::jsonb
$$;

-- ---------- trainee API ----------
create or replace function trainee_login(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e enrollments; tok uuid;
begin
  delete from failed_logins where at < now() - interval '10 minutes';
  if (select count(*) from failed_logins) > 300 then return jsonb_build_object('error', 'Too many attempts. Please wait 10 minutes.'); end if;
  select * into e from enrollments where code = upper(trim(p_code));
  if not found then
    insert into failed_logins default values;
    return jsonb_build_object('error', 'This access code is not valid.');
  end if;
  if e.status = 'completed' then return jsonb_build_object('error', 'This course is already completed. Ask your manager for the code to your next level.'); end if;
  if e.status = 'revoked' then return jsonb_build_object('error', 'This access code has been deactivated.'); end if;
  insert into sessions (enrollment_id) values (e.id) returning token into tok;
  update enrollments set last_login_at = now(), started_at = coalesce(started_at, now()) where id = e.id;
  return jsonb_build_object('token', tok);
end $$;

create or replace function trainee_me(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin return _view(_enrollment(p_token)); end $$;

create or replace function trainee_logout(p_token uuid) returns void
language sql security definer set search_path = public as $$ delete from sessions where token = p_token $$;

create or replace function trainee_lesson(p_token uuid, p_module text, p_lesson text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e enrollments; m jsonb; mp jsonb;
begin
  e := _enrollment(p_token);
  select x into m from jsonb_array_elements(_course(e.course_id)->'modules') x where x->>'id' = p_module;
  if m is null or not coalesce(m->'lessons', '[]'::jsonb) ? p_lesson then raise exception 'Unknown lesson'; end if;
  mp := coalesce(e.progress->'modules'->p_module, _empty_mod());
  if not (mp->'lessonsRead') ? p_lesson then mp := jsonb_set(mp, '{lessonsRead}', (mp->'lessonsRead') || to_jsonb(p_lesson)); end if;
  update enrollments set progress = jsonb_set(progress, array['modules', p_module], mp) where id = e.id;
  return _result(e.id);
end $$;

create or replace function trainee_quiz(p_token uuid, p_module text, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e enrollments; keys jsonb; q record; mp jsonb; correct int := 0; n int := 0; score int; passed boolean; pass_mark int;
  results jsonb := '[]'::jsonb; ok boolean;
begin
  e := _enrollment(p_token);
  keys := _cfg('quiz_keys')->e.course_id->p_module;
  if keys is null then raise exception 'Unknown quiz'; end if;
  pass_mark := coalesce((_cfg('pass_mark') #>> '{}')::int, 90);
  for q in select key, value from jsonb_each(keys) loop
    n := n + 1;
    ok := (p_answers->>q.key) is not null and (p_answers->>q.key)::int = (q.value->>'answer')::int;
    if ok then correct := correct + 1; end if;
    results := results || jsonb_build_object('id', q.key, 'ok', ok, 'answer', (q.value->>'answer')::int, 'explain', q.value->>'explain');
  end loop;
  score := round(correct * 100.0 / n); passed := score >= pass_mark;
  mp := coalesce(e.progress->'modules'->p_module, _empty_mod());
  mp := jsonb_set(mp, '{quiz}', jsonb_build_object(
    'attempts', coalesce((mp->'quiz'->>'attempts')::int, 0) + 1,
    'best', greatest(coalesce((mp->'quiz'->>'best')::int, 0), score), 'last', score,
    'passedAt', case when mp->'quiz'->>'passedAt' is not null then mp->'quiz'->'passedAt' when passed then to_jsonb(now()) else 'null'::jsonb end));
  update enrollments set progress = jsonb_set(progress, array['modules', p_module], mp) where id = e.id;
  return _result(e.id) || jsonb_build_object('score', score, 'passed', passed, 'passMark', pass_mark, 'results', results);
end $$;

create or replace function trainee_watched(p_token uuid, p_video text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e enrollments;
begin
  e := _enrollment(p_token);
  if not exists (select 1 from jsonb_array_elements(_course(e.course_id)->'modules') m, jsonb_array_elements(coalesce(m->'videos', '[]'::jsonb)) v where v->>'id' = p_video) then
    raise exception 'Unknown video';
  end if;
  if not (e.progress->'watched') ? p_video then
    update enrollments set progress = jsonb_set(progress, array['watched', p_video], to_jsonb(now())) where id = e.id;
  end if;
  return _result(e.id);
end $$;

create or replace function trainee_answer(p_token uuid, p_video text, p_prompt text, p_text text, p_audio text, p_mime text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare e enrollments; pts jsonb; auto jsonb; pass int := coalesce((_cfg('answer_pass') #>> '{}')::int, 60);
begin
  e := _enrollment(p_token);
  if not exists (select 1 from jsonb_array_elements(_course(e.course_id)->'modules') m, jsonb_array_elements(coalesce(m->'videos', '[]'::jsonb)) v, jsonb_array_elements_text(v->'prompts') p
                 where v->>'id' = p_video and p = p_prompt) then raise exception 'Unknown question'; end if;
  if coalesce(trim(p_text), '') = '' and p_audio is null then raise exception 'Please type an answer or record a voice memo.'; end if;
  if length(coalesce(p_audio, '')) > 8000000 then raise exception 'The voice memo is too long. Please keep it under 5 minutes.'; end if;
  pts := _cfg('key_points')->e.course_id->p_video->p_prompt;
  if coalesce(trim(p_text), '') <> '' then
    auto := _grade(p_text, pts);
    auto := auto || jsonb_build_object('passed', (auto->>'score')::int >= pass);
  end if;
  insert into answers (enrollment_id, video_id, prompt_id, text, audio, audio_mime, auto)
  values (e.id, p_video, p_prompt, left(coalesce(trim(p_text), ''), 8000), p_audio, case when p_audio is null then null else coalesce(p_mime, 'audio/webm') end, auto)
  on conflict (enrollment_id, video_id, prompt_id) do update
    set text = excluded.text, audio = excluded.audio, audio_mime = excluded.audio_mime, auto = excluded.auto, review = null, submitted_at = now();
  return _result(e.id) || jsonb_build_object('auto', auto, 'answerPass', pass);
end $$;

-- ---------- admin API ----------
create or replace function admin_login(p_password text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tok uuid;
begin
  delete from failed_logins where at < now() - interval '10 minutes';
  if (select count(*) from failed_logins) > 300 then return jsonb_build_object('error', 'Too many attempts. Please wait 10 minutes.'); end if;
  if encode(sha256(convert_to((_cfg('admin_salt') #>> '{}') || p_password, 'UTF8')), 'hex') <> (_cfg('admin_hash') #>> '{}') then
    insert into failed_logins default values;
    return jsonb_build_object('error', 'Wrong password.');
  end if;
  delete from admin_sessions where created_at < now() - interval '12 hours';
  insert into admin_sessions default values returning token into tok;
  return jsonb_build_object('token', tok);
end $$;

create or replace function admin_logout(p_token uuid) returns void
language sql security definer set search_path = public as $$ delete from admin_sessions where token = p_token $$;

create or replace function admin_change_password(p_token uuid, p_new text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare salt text := md5(random()::text);
begin
  perform _admin(p_token);
  if length(coalesce(p_new, '')) < 8 then raise exception 'The password needs at least 8 characters.'; end if;
  insert into app_config values ('admin_salt', to_jsonb(salt)) on conflict (key) do update set value = excluded.value;
  insert into app_config values ('admin_hash', to_jsonb(encode(sha256(convert_to(salt || p_new, 'UTF8')), 'hex'))) on conflict (key) do update set value = excluded.value;
  delete from admin_sessions where token <> p_token;
  return jsonb_build_object('ok', true);
end $$;

create or replace function admin_overview(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform _admin(p_token);
  return jsonb_build_object(
    'passMark', coalesce((_cfg('pass_mark') #>> '{}')::int, 90),
    'answerPass', coalesce((_cfg('answer_pass') #>> '{}')::int, 60),
    'keyPoints', _cfg('key_points'),
    'people', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'position', p.position, 'createdAt', p.created_at, 'path', _path(p.id),
      'enrollments', coalesce((select jsonb_agg(jsonb_build_object(
          'id', e.id, 'courseId', e.course_id, 'code', e.code, 'status', e.status,
          'createdAt', e.created_at, 'startedAt', e.started_at, 'completedAt', e.completed_at, 'lastLoginAt', e.last_login_at,
          'progress', e.progress, 'overall', _overall(e), 'answers', _answers_view(e.id)) order by e.created_at desc)
        from enrollments e where e.person_id = p.id), '[]'::jsonb)
    ) order by p.created_at desc) from people p), '[]'::jsonb));
end $$;

create or replace function admin_person_save(p_token uuid, p_id uuid, p_name text, p_position text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  perform _admin(p_token);
  if coalesce(trim(p_name), '') = '' then raise exception 'Please enter a name.'; end if;
  if not exists (select 1 from jsonb_each(_cfg('courses')) c(k, v) where v->>'position' = p_position) then raise exception 'Unknown position'; end if;
  if p_id is null then
    insert into people (name, position) values (left(trim(p_name), 80), p_position) returning id into pid;
  else
    update people set name = left(trim(p_name), 80), position = p_position where id = p_id returning id into pid;
  end if;
  return jsonb_build_object('id', pid);
end $$;

create or replace function admin_person_delete(p_token uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin perform _admin(p_token); delete from people where id = p_id; return jsonb_build_object('ok', true); end $$;

create or replace function admin_enroll(p_token uuid, p_person uuid, p_course text, p_force boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p people; c jsonb; lvl int; prev text; e enrollments;
begin
  perform _admin(p_token);
  select * into p from people where id = p_person;
  c := _course(p_course);
  if p.id is null or c is null then raise exception 'Unknown person or course'; end if;
  lvl := (c->>'level')::int;
  if not coalesce(p_force, false) and lvl > 1 then
    select x.k into prev from jsonb_each(_cfg('courses')) x(k, v) where x.v->>'position' = c->>'position' and (x.v->>'level')::int = lvl - 1;
    if not exists (select 1 from enrollments where person_id = p.id and course_id = prev and status = 'completed') then
      raise exception 'Level % must be completed first.', lvl - 1;
    end if;
  end if;
  update enrollments set status = 'revoked' where person_id = p.id and course_id = p_course and status = 'active';
  insert into enrollments (person_id, course_id, code) values (p.id, p_course, _new_code()) returning * into e;
  return jsonb_build_object('id', e.id, 'code', e.code, 'courseId', e.course_id, 'name', p.name);
end $$;

create or replace function admin_enrollment_action(p_token uuid, p_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform _admin(p_token);
  if p_action = 'delete' then delete from enrollments where id = p_id;
  elsif p_action = 'revoke' then update enrollments set status = 'revoked' where id = p_id; delete from sessions where enrollment_id = p_id;
  elsif p_action = 'reactivate' then update enrollments set status = 'active', completed_at = null where id = p_id;
  elsif p_action = 'newcode' then update enrollments set code = _new_code() where id = p_id; delete from sessions where enrollment_id = p_id;
  else raise exception 'Unknown action'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function admin_review(p_token uuid, p_answer uuid, p_status text, p_score int, p_comment text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform _admin(p_token);
  if p_status not in ('passed', 'rework') then raise exception 'Invalid status'; end if;
  update answers set review = jsonb_build_object('status', p_status,
    'score', case when p_score is null then null else greatest(0, least(100, p_score)) end,
    'comment', left(coalesce(p_comment, ''), 2000), 'at', now()) where id = p_answer;
  return jsonb_build_object('ok', true);
end $$;

create or replace function admin_audio(p_token uuid, p_answer uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a answers;
begin perform _admin(p_token); select * into a from answers where id = p_answer; return jsonb_build_object('audio', a.audio, 'mime', a.audio_mime); end $$;

-- ---------- permissions ----------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  trainee_login(text), trainee_me(uuid), trainee_logout(uuid), trainee_lesson(uuid, text, text),
  trainee_quiz(uuid, text, jsonb), trainee_watched(uuid, text), trainee_answer(uuid, text, text, text, text, text),
  admin_login(text), admin_logout(uuid), admin_change_password(uuid, text), admin_overview(uuid),
  admin_person_save(uuid, uuid, text, text), admin_person_delete(uuid, uuid), admin_enroll(uuid, uuid, text, boolean),
  admin_enrollment_action(uuid, uuid, text), admin_review(uuid, uuid, text, int, text), admin_audio(uuid, uuid)
to anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
