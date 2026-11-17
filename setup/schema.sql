-- =====================================================================
--  CS FITNESS Coach Academy - database setup for Supabase
--  Paste this whole file into Supabase > SQL Editor > Run.
--  Safe to run again: it updates functions and course data, keeps trainees.
-- =====================================================================

-- ---------- tables ----------
create table if not exists app_config (
  key   text primary key,
  value jsonb not null
);

create table if not exists trainees (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  code          text not null unique,
  status        text not null default 'active',   -- active | completed | revoked
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  completed_at  timestamptz,
  last_login_at timestamptz,
  progress      jsonb not null default '{"modules":{},"watched":{}}'
);

create table if not exists trainee_sessions (
  token      uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references trainees(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists admin_sessions (
  token      uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists responses (
  id           uuid primary key default gen_random_uuid(),
  trainee_id   uuid not null references trainees(id) on delete cascade,
  video_id     text not null,
  prompt_id    text not null,
  text         text not null default '',
  audio        text,            -- base64 voice memo
  audio_mime   text,
  submitted_at timestamptz not null default now(),
  review       jsonb,
  unique (trainee_id, video_id, prompt_id)
);

create table if not exists failed_logins (
  at timestamptz not null default now()
);

-- Row level security ON, no policies: nobody can read or write tables directly.
-- All access goes through the functions below.
alter table app_config       enable row level security;
alter table trainees         enable row level security;
alter table trainee_sessions enable row level security;
alter table admin_sessions   enable row level security;
alter table responses        enable row level security;
alter table failed_logins    enable row level security;

-- ---------- helpers ----------
create or replace function _cfg(k text) returns jsonb
language sql stable security definer set search_path = public as $$
  select value from app_config where key = k
$$;

create or replace function _new_code() returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := 'CS-';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from trainees where code = c);
  end loop;
  return c;
end $$;

create or replace function _trainee(p_token uuid) returns trainees
language plpgsql security definer set search_path = public as $$
declare t trainees; s trainee_sessions;
begin
  select * into s from trainee_sessions where token = p_token;
  if not found or s.created_at < now() - interval '12 hours' then
    raise exception 'SESSION_ENDED';
  end if;
  select * into t from trainees where id = s.trainee_id;
  if not found or t.status <> 'active' then
    delete from trainee_sessions where token = p_token;
    raise exception 'SESSION_ENDED';
  end if;
  return t;
end $$;

create or replace function _admin(p_token uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from admin_sessions where token = p_token and created_at > now() - interval '12 hours') then
    raise exception 'ADMIN_SESSION_ENDED';
  end if;
end $$;

-- progress summary for one trainee
create or replace function _overall(t trainees) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  req jsonb := _cfg('requirements');
  m jsonb; v jsonb; p jsonb; mp jsonb;
  per jsonb := '[]'::jsonb;
  done int; total int; all_done int := 0; all_total int := 0;
begin
  for m in select * from jsonb_array_elements(req) loop
    done := 0; total := 0;
    if m->>'type' = 'video' then
      for v in select * from jsonb_array_elements(m->'videos') loop
        total := total + 1;
        if (t.progress->'watched') ? (v->>'id') then done := done + 1; end if;
        for p in select * from jsonb_array_elements(v->'prompts') loop
          total := total + 1;
          if exists (select 1 from responses r where r.trainee_id = t.id and r.video_id = v->>'id' and r.prompt_id = p #>> '{}') then
            done := done + 1;
          end if;
        end loop;
      end loop;
    else
      mp := coalesce(t.progress->'modules'->(m->>'id'), '{}'::jsonb);
      total := jsonb_array_length(m->'lessons') + 1;
      select count(*) into done from jsonb_array_elements_text(m->'lessons') l
        where coalesce(mp->'lessonsRead', '[]'::jsonb) ? l;
      if mp->'quiz'->>'passedAt' is not null then done := done + 1; end if;
    end if;
    per := per || jsonb_build_object('id', m->>'id', 'done', done, 'total', total, 'complete', done = total);
    all_done := all_done + done; all_total := all_total + total;
  end loop;
  return jsonb_build_object(
    'per', per, 'done', all_done, 'total', all_total,
    'percent', case when all_total > 0 then round(all_done * 100.0 / all_total) else 0 end,
    'complete', all_done = all_total);
end $$;

create or replace function _view(t trainees) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', t.name, 'status', t.status, 'progress', t.progress,
    'answered', coalesce((select jsonb_agg(jsonb_build_object('videoId', video_id, 'promptId', prompt_id))
                          from responses where trainee_id = t.id), '[]'::jsonb),
    'overall', _overall(t))
$$;

-- marks the training complete when everything is done; ends all sessions
create or replace function _finish_if_done(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare t trainees;
begin
  select * into t from trainees where id = p_id;
  if t.status <> 'active' or not (_overall(t)->>'complete')::boolean then return false; end if;
  update trainees set status = 'completed', completed_at = now() where id = p_id;
  delete from trainee_sessions where trainee_id = p_id;
  return true;
end $$;

create or replace function _result(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t trainees; fin boolean;
begin
  fin := _finish_if_done(p_id);
  if fin then return jsonb_build_object('completed', true); end if;
  select * into t from trainees where id = p_id;
  return jsonb_build_object('completed', false, 'me', _view(t));
end $$;

-- ---------- trainee API ----------
create or replace function trainee_login(p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t trainees; tok uuid;
begin
  delete from failed_logins where at < now() - interval '10 minutes';
  if (select count(*) from failed_logins) > 300 then
    raise exception 'Too many attempts. Please wait 10 minutes.';
  end if;
  select * into t from trainees where code = upper(trim(p_code));
  -- errors are returned (not raised) so the failed attempt is recorded
  if not found then
    insert into failed_logins default values;
    return jsonb_build_object('error', 'This access code is not valid.');
  end if;
  if t.status = 'completed' then return jsonb_build_object('error', 'This access code has already been used to complete the training.'); end if;
  if t.status = 'revoked' then return jsonb_build_object('error', 'This access code has been deactivated.'); end if;
  insert into trainee_sessions (trainee_id) values (t.id) returning token into tok;
  update trainees set last_login_at = now(), started_at = coalesce(started_at, now()) where id = t.id;
  return jsonb_build_object('token', tok);
end $$;

create or replace function trainee_me(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  return _view(_trainee(p_token));
end $$;

create or replace function trainee_logout(p_token uuid) returns void
language sql security definer set search_path = public as $$
  delete from trainee_sessions where token = p_token
$$;

create or replace function trainee_lesson(p_token uuid, p_module text, p_lesson text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t trainees; m jsonb; mp jsonb;
begin
  t := _trainee(p_token);
  select x into m from jsonb_array_elements(_cfg('requirements')) x where x->>'id' = p_module;
  if m is null or not coalesce(m->'lessons', '[]'::jsonb) ? p_lesson then raise exception 'Unknown lesson'; end if;
  mp := coalesce(t.progress->'modules'->p_module, '{"lessonsRead":[],"quiz":{"best":0,"attempts":0,"passedAt":null}}'::jsonb);
  if not (mp->'lessonsRead') ? p_lesson then
    mp := jsonb_set(mp, '{lessonsRead}', (mp->'lessonsRead') || to_jsonb(p_lesson));
  end if;
  update trainees set progress = jsonb_set(progress, array['modules', p_module], mp) where id = t.id;
  return _result(t.id);
end $$;

create or replace function trainee_quiz(p_token uuid, p_module text, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t trainees; keys jsonb; q record; mp jsonb;
  correct int := 0; n int := 0; score int; passed boolean; pass_mark int;
  results jsonb := '[]'::jsonb; ok boolean; res jsonb;
begin
  t := _trainee(p_token);
  keys := _cfg('quiz_keys')->p_module;
  if keys is null then raise exception 'Unknown quiz'; end if;
  pass_mark := coalesce((_cfg('pass_mark') #>> '{}')::int, 90);
  for q in select key, value from jsonb_each(keys) loop
    n := n + 1;
    ok := (p_answers->>q.key) is not null and (p_answers->>q.key)::int = (q.value->>'answer')::int;
    if ok then correct := correct + 1; end if;
    results := results || jsonb_build_object('id', q.key, 'ok', ok, 'answer', (q.value->>'answer')::int, 'explain', q.value->>'explain');
  end loop;
  score := round(correct * 100.0 / n);
  passed := score >= pass_mark;
  mp := coalesce(t.progress->'modules'->p_module, '{"lessonsRead":[],"quiz":{"best":0,"attempts":0,"passedAt":null}}'::jsonb);
  mp := jsonb_set(mp, '{quiz}', jsonb_build_object(
    'attempts', coalesce((mp->'quiz'->>'attempts')::int, 0) + 1,
    'best', greatest(coalesce((mp->'quiz'->>'best')::int, 0), score),
    'last', score,
    'passedAt', case when mp->'quiz'->>'passedAt' is not null then mp->'quiz'->'passedAt'
                     when passed then to_jsonb(now()) else 'null'::jsonb end));
  update trainees set progress = jsonb_set(progress, array['modules', p_module], mp) where id = t.id;
  res := _result(t.id);
  return res || jsonb_build_object('score', score, 'passed', passed, 'passMark', pass_mark, 'results', results);
end $$;

create or replace function trainee_watched(p_token uuid, p_video text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t trainees;
begin
  t := _trainee(p_token);
  if not exists (select 1 from jsonb_array_elements(_cfg('requirements')) m, jsonb_array_elements(coalesce(m->'videos','[]'::jsonb)) v where v->>'id' = p_video) then
    raise exception 'Unknown video';
  end if;
  if not (t.progress->'watched') ? p_video then
    update trainees set progress = jsonb_set(progress, array['watched', p_video], to_jsonb(now())) where id = t.id;
  end if;
  return _result(t.id);
end $$;

create or replace function trainee_response(p_token uuid, p_video text, p_prompt text, p_text text, p_audio text, p_mime text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t trainees;
begin
  t := _trainee(p_token);
  if not exists (select 1 from jsonb_array_elements(_cfg('requirements')) m, jsonb_array_elements(coalesce(m->'videos','[]'::jsonb)) v, jsonb_array_elements_text(v->'prompts') p
                 where v->>'id' = p_video and p = p_prompt) then
    raise exception 'Unknown question';
  end if;
  if coalesce(trim(p_text), '') = '' and p_audio is null then raise exception 'Please type an answer or record a voice memo.'; end if;
  if length(coalesce(p_audio, '')) > 8000000 then raise exception 'The voice memo is too long. Please keep it under 5 minutes.'; end if;
  insert into responses (trainee_id, video_id, prompt_id, text, audio, audio_mime)
  values (t.id, p_video, p_prompt, left(coalesce(trim(p_text), ''), 8000), p_audio, case when p_audio is null then null else coalesce(p_mime, 'audio/webm') end)
  on conflict (trainee_id, video_id, prompt_id) do update
    set text = excluded.text, audio = excluded.audio, audio_mime = excluded.audio_mime, submitted_at = now(), review = null;
  return _result(t.id);
end $$;

-- ---------- admin API ----------
create or replace function admin_login(p_password text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare tok uuid;
begin
  delete from failed_logins where at < now() - interval '10 minutes';
  if (select count(*) from failed_logins) > 300 then raise exception 'Too many attempts. Please wait 10 minutes.'; end if;
  if encode(sha256(convert_to((_cfg('admin_salt') #>> '{}') || p_password, 'UTF8')), 'hex') <> (_cfg('admin_hash') #>> '{}') then
    insert into failed_logins default values;
    return jsonb_build_object('error', 'Wrong password.');
  end if;
  delete from admin_sessions where created_at < now() - interval '12 hours';
  insert into admin_sessions default values returning token into tok;
  return jsonb_build_object('token', tok);
end $$;

create or replace function admin_logout(p_token uuid) returns void
language sql security definer set search_path = public as $$
  delete from admin_sessions where token = p_token
$$;

create or replace function admin_overview(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform _admin(p_token);
  return jsonb_build_object(
    'passMark', coalesce((_cfg('pass_mark') #>> '{}')::int, 90),
    'keyPoints', _cfg('key_points'),
    'employees', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'name', t.name, 'code', t.code, 'status', t.status,
        'createdAt', t.created_at, 'startedAt', t.started_at, 'completedAt', t.completed_at, 'lastLoginAt', t.last_login_at,
        'progress', t.progress, 'overall', _overall(t),
        'responses', coalesce((select jsonb_agg(jsonb_build_object(
            'id', r.id, 'videoId', r.video_id, 'promptId', r.prompt_id, 'text', r.text,
            'hasAudio', r.audio is not null, 'submittedAt', r.submitted_at, 'review', r.review))
          from responses r where r.trainee_id = t.id), '[]'::jsonb)
      ) order by t.created_at desc) from trainees t), '[]'::jsonb));
end $$;

create or replace function admin_audio(p_token uuid, p_response uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r responses;
begin
  perform _admin(p_token);
  select * into r from responses where id = p_response;
  return jsonb_build_object('audio', r.audio, 'mime', r.audio_mime);
end $$;

create or replace function admin_create(p_token uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t trainees;
begin
  perform _admin(p_token);
  if coalesce(trim(p_name), '') = '' then raise exception 'Please enter a name.'; end if;
  insert into trainees (name, code) values (left(trim(p_name), 80), _new_code()) returning * into t;
  return jsonb_build_object('id', t.id, 'name', t.name, 'code', t.code);
end $$;

create or replace function admin_action(p_token uuid, p_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform _admin(p_token);
  if p_action = 'delete' then
    delete from trainees where id = p_id;
  elsif p_action = 'revoke' then
    update trainees set status = 'revoked' where id = p_id;
    delete from trainee_sessions where trainee_id = p_id;
  elsif p_action = 'reactivate' then
    update trainees set status = 'active', completed_at = null where id = p_id;
  elsif p_action = 'newcode' then
    update trainees set code = _new_code() where id = p_id;
    delete from trainee_sessions where trainee_id = p_id;
  else
    raise exception 'Unknown action';
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function admin_review(p_token uuid, p_response uuid, p_status text, p_score int, p_comment text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform _admin(p_token);
  if p_status not in ('passed', 'rework') then raise exception 'Invalid status'; end if;
  update responses set review = jsonb_build_object(
    'status', p_status, 'score', case when p_score is null then null else greatest(0, least(100, p_score)) end,
    'comment', left(coalesce(p_comment, ''), 2000), 'at', now())
  where id = p_response;
  return jsonb_build_object('ok', true);
end $$;

create or replace function admin_change_password(p_token uuid, p_new text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare salt text := md5(random()::text);
begin
  perform _admin(p_token);
  if length(coalesce(p_new, '')) < 8 then raise exception 'The password needs at least 8 characters.'; end if;
  insert into app_config values ('admin_salt', to_jsonb(salt)) on conflict (key) do update set value = excluded.value;
  insert into app_config values ('admin_hash', to_jsonb(encode(sha256(convert_to(salt || p_new, 'UTF8')), 'hex')))
    on conflict (key) do update set value = excluded.value;
  delete from admin_sessions where token <> p_token;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- permissions: only the public API functions are callable ----------
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function
  trainee_login(text), trainee_me(uuid), trainee_logout(uuid), trainee_lesson(uuid, text, text),
  trainee_quiz(uuid, text, jsonb), trainee_watched(uuid, text), trainee_response(uuid, text, text, text, text, text),
  admin_login(text), admin_logout(uuid), admin_overview(uuid), admin_audio(uuid, uuid), admin_create(uuid, text),
  admin_action(uuid, uuid, text), admin_review(uuid, uuid, text, int, text), admin_change_password(uuid, text)
to anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
