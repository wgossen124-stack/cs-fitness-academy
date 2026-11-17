// CS FITNESS Academy v2 – trainee app
(function () {
  const $app = document.getElementById('app');
  const CFG = window.CONFIG || {};
  const CAT = window.CATALOG;
  const TOKEN_KEY = 'csacademy_token';
  let token = store.get(TOKEN_KEY);
  let me = null, course = null, player = null, recorder = null;

  // ---------- utils ----------
  const ICONS = {
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    play: '<path d="M8 5v14l11-7z"/>', video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
    check: '<path d="M5 12l5 5 9-10"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    back: '<path d="M15 5l-7 7 7 7"/>', next: '<path d="M9 5l7 7-7 7"/>', pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    replay: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    star: '<path d="M12 3l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.9 6.4 20l1.3-6.2L3 9.5l6.3-.7z"/>', calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', route: '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h6"/>',
    heart: '<path d="M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6 6 0 0 0-4-5.6"/>',
    book: '<path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/><path d="M4 16a4 4 0 0 1 4-4h10"/>', quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01"/>',
    sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>', mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4a3 3 0 0 0 4 4M16 6h4a3 3 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  };
  const icon = (n, s = 20, fill = false) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ICONS.bolt}</svg>`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const pos = id => CAT.positions.find(p => p.id === id) || { title: id };
  const courseById = id => CAT.courses.find(c => c.id === id);
  const levelName = l => CAT.levels[l] || '';
  function toast(msg) { document.querySelectorAll('.toast').forEach(x => x.remove()); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2800); }
  function cleanup() { if (player) { player.stop(); player = null; } if (recorder) { recorder.cancel(); recorder = null; } try { speechSynthesis.cancel(); } catch (_) {} }

  async function api(fn, args) {
    try { return await rpc(fn, args); }
    catch (e) {
      if (e.code === 'SESSION_ENDED') { me = null; token = null; store.del(TOKEN_KEY); renderLogin('Your session has ended. Please sign in again.'); throw new Error('401'); }
      throw e;
    }
  }
  function handle(res) {
    if (res.completed) { renderDone(res); return true; }
    if (res.me) me = res.me;
    return false;
  }

  // ---------- progress helpers ----------
  const st = id => (me.overall.per.find(p => p.id === id) || { done: 0, total: 1, complete: false });
  const unlocked = i => course.modules.slice(0, i).every(m => st(m.id).complete);
  const read = (mid, lid) => !!(me.progress.modules[mid] && me.progress.modules[mid].lessonsRead.includes(lid));
  const quizInfo = mid => (me.progress.modules[mid] && me.progress.modules[mid].quiz) || { best: 0, attempts: 0, passedAt: null };
  const answer = (vid, pid) => me.answers.find(a => a.videoId === vid && a.promptId === pid);
  const videoDone = v => !!me.progress.watched[v.id] && v.prompts.every(p => { const a = answer(v.id, p.id); return a && a.ok; });

  // ---------- chrome ----------
  const brand = (sub = 'Coach Academy') => `<div class="brand">${CFG.LOGO ? `<img class="brand-logo" src="${esc(CFG.LOGO)}" alt="${esc(CFG.STUDIO_NAME)}" onerror="this.replaceWith(Object.assign(document.createElement('b'),{className:'brand-text',textContent:'${esc(CFG.STUDIO_NAME)}'}))">` : `<b class="brand-text">${esc(CFG.STUDIO_NAME)}</b>`}<div class="brand-sub">${sub}<small>${esc(CFG.STUDIO_LOCATION || '')}</small></div></div>`;
  function header() {
    return `<header class="header">${brand()}<div class="spacer"></div>
      <div class="who"><span>${esc(me.name)}</span><div class="avatar">${esc(initials(me.name))}</div></div>
      <button class="btn ghost sm" id="logout">Sign out</button></header>`;
  }
  function bindHeader() {
    document.getElementById('logout').onclick = async () => {
      await rpc('trainee_logout', { p_token: token }).catch(() => {});
      cleanup(); me = null; token = null; store.del(TOKEN_KEY); history.replaceState(null, '', location.pathname); renderLogin();
    };
  }

  // ---------- login ----------
  function renderLogin(msg) {
    cleanup();
    $app.innerHTML = `<div class="auth">
      <div class="auth-art">
        <div class="orb" style="width:340px;height:340px;right:-80px;top:-60px;background:radial-gradient(circle,#2f6bff,transparent 70%)"></div>
        <div class="orb" style="width:260px;height:260px;left:30%;bottom:-90px;background:radial-gradient(circle,#7cc4f8,transparent 70%);animation-delay:-5s"></div>
        <div style="position:relative">${brand()}</div>
        <div style="position:relative">
          <div class="eyebrow" style="color:#7cc4f8;margin-bottom:14px">Team Academy</div>
          <h1>Low impact.<br>Full body.<br><span style="color:#7cc4f8">Full knowledge.</span></h1>
          <p style="margin-top:18px">Training for every role at ${esc(CFG.STUDIO_NAME)}: three levels per position, interactive lessons, explainer videos and quizzes.</p>
        </div>
        <div class="row" style="position:relative;gap:18px;color:rgba(255,255,255,.6);font-size:13px">${CAT.positions.map(p => `<span class="row" style="gap:6px">${icon(p.icon, 16)} ${esc(p.title)}</span>`).join('')}</div>
      </div>
      <div class="auth-form"><form class="auth-card" id="lf">
        <div class="eyebrow">Sign in</div>
        <h2>Welcome to your course</h2>
        <p class="muted small">Enter the access code your manager gave you. Each code opens one course and expires when you complete it.</p>
        <label class="field"><span>Access code</span><input class="code-input" type="text" id="code" placeholder="CS-XXXXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
        <button class="btn lg block" id="go">Start learning ${icon('next', 18)}</button>
        <p class="err" id="err">${esc(msg || '')}</p>
        <p class="tiny muted">Your progress is saved automatically, so you can sign out and continue later with the same code.</p>
      </form></div></div>`;
    const inp = document.getElementById('code'); inp.focus();
    document.getElementById('lf').onsubmit = async e => {
      e.preventDefault();
      const btn = document.getElementById('go'); btn.disabled = true;
      try {
        const r = await rpc('trainee_login', { p_code: inp.value });
        if (r.error) throw new Error(r.error);
        token = r.token; store.set(TOKEN_KEY, token);
        me = await api('trainee_me', { p_token: token }); course = courseById(me.courseId);
        location.hash = ''; route();
      } catch (err) { if (err.message !== '401') document.getElementById('err').textContent = err.message; btn.disabled = false; }
    };
  }

  // ---------- path ----------
  function pathHtml(light) {
    const steps = (me.path || []).map(p => {
      const c = courseById(p.courseId); const cur = p.courseId === me.courseId && !p.completed;
      return { lvl: p.level, title: c ? c.title : '', cls: p.completed ? 'done' : cur ? 'cur' : '' };
    });
    return `<div class="path ${light ? 'light' : ''}">${steps.map((s, i) => `${i ? `<div class="path-line ${steps[i - 1].cls === 'done' ? 'done' : ''}"></div>` : ''}<div class="path-step ${s.cls}" title="${esc(s.title)}"><div class="num">${s.cls === 'done' ? icon('check', 14) : s.lvl}</div><span>Level ${s.lvl} · ${esc(levelName(s.lvl))}</span></div>`).join('')}</div>`;
  }

  // ---------- home ----------
  function nextTarget() {
    for (let i = 0; i < course.modules.length; i++) {
      const m = course.modules[i]; if (st(m.id).complete) continue;
      if (m.type === 'video') { const v = m.videos.find(x => !videoDone(x)) || m.videos[0]; return `${m.id}/${v.id}`; }
      const l = m.lessons.find(x => !read(m.id, x.id)); return `${m.id}/${l ? l.id : 'quiz'}`;
    }
    return '';
  }
  function renderHome() {
    const o = me.overall; const started = o.done > 0;
    $app.innerHTML = header() + `<main class="page">
      <section class="hero">
        <div class="hero-grid">
          <div>
            <div class="meta"><span class="pill dark">${esc(pos(course.position).title)}</span><span class="pill dark">Level ${course.level} · ${esc(levelName(course.level))}</span><span class="pill dark">~${course.minutes || 40} min</span></div>
            <h1>${esc(course.title)}</h1>
            <p>${esc(course.summary)}</p>
            <button class="btn lg" id="cont" style="margin-top:8px">${started ? 'Continue' : 'Start course'} ${icon('next', 18)}</button>
          </div>
          <div class="ring" style="--p:${o.percent}"><b>${o.percent}%</b></div>
        </div>
        ${pathHtml(false)}
      </section>
      <div class="row" style="margin:34px 0 14px"><h2 style="margin:0">Your modules</h2><div class="spacer"></div><span class="muted small">Quizzes need ${CAT.passMark}% · finish everything to complete Level ${course.level}</span></div>
      <div class="grid">${course.modules.map((m, i) => {
        const s = st(m.id), open = unlocked(i), pct = Math.round(s.done / s.total * 100);
        const kind = m.type === 'video' ? `${m.videos.length} video${m.videos.length > 1 ? 's' : ''} · free answers` : `${m.lessons.length ? m.lessons.length + ' lesson' + (m.lessons.length > 1 ? 's' : '') : ''}${m.lessons.length && m.quiz ? ' · ' : ''}${m.quiz ? m.quiz.length + ' questions' : ''}`;
        return `<div class="card mod-card ${open ? '' : 'locked'} ${s.complete ? 'done' : ''}" data-i="${i}">
          <div class="mod-ic">${icon(s.complete ? 'check' : open ? (m.icon || 'book') : 'lock', 24)}</div>
          <div style="flex:1;min-width:0">
            <div class="eyebrow">Module ${i + 1} · ${esc(kind)}</div>
            <h3>${esc(m.title)}</h3><p>${esc(m.summary || '')}</p>
            <div class="bar ${s.complete ? 'ok' : ''}" style="margin-top:12px"><i style="width:${pct}%"></i></div>
          </div>
          ${s.complete ? '<span class="pill ok hide-sm">Done</span>' : open ? `<span class="pill blue hide-sm">${pct ? pct + '%' : 'Start'}</span>` : '<span class="pill hide-sm">Locked</span>'}
        </div>`; }).join('')}</div>
    </main>`;
    bindHeader();
    document.getElementById('cont').onclick = () => go(nextTarget());
    document.querySelectorAll('.mod-card').forEach(el => el.onclick = () => {
      const i = +el.dataset.i; if (!unlocked(i)) return toast('Finish the previous module first.');
      const m = course.modules[i];
      if (m.type === 'video') return go(`${m.id}/${(m.videos.find(v => !videoDone(v)) || m.videos[0]).id}`);
      const l = m.lessons.find(x => !read(m.id, x.id)); go(`${m.id}/${l ? l.id : (m.quiz ? 'quiz' : m.lessons[0].id)}`);
    });
  }
  const go = h => { if (location.hash === '#' + h || (!h && !location.hash)) route(); else location.hash = h; };

  // ---------- module shell ----------
  function shell(m, key, inner) {
    const items = course.modules.map((mm, i) => {
      const open = unlocked(i);
      const rows = mm.type === 'video'
        ? mm.videos.map(v => ({ k: v.id, t: v.title, done: videoDone(v), ic: 'video' }))
        : [...mm.lessons.map(l => ({ k: l.id, t: l.title, done: read(mm.id, l.id) })), ...(mm.quiz ? [{ k: 'quiz', t: mm.lessons.length ? 'Quiz' : 'Final quiz', done: !!quizInfo(mm.id).passedAt, ic: 'quiz' }] : [])];
      return `<div class="side-mod"><span class="eyebrow">${i + 1}. ${esc(mm.title)}</span></div>
        ${rows.map(r => `<button class="side-item ${mm.id === m.id && r.k === key ? 'on' : ''} ${open ? '' : 'locked'}" data-m="${mm.id}" data-k="${r.k}" data-open="${open}">
          <span class="dot ${r.done ? 'done' : mm.id === m.id && r.k === key ? 'cur' : ''}">${r.done ? icon('check', 12) : ''}</span>${esc(r.t)}</button>`).join('')}`;
    }).join('');
    $app.innerHTML = header() + `<div class="shell">
      <aside class="card side" id="side">
        <div class="side-head"><button class="back" id="home" style="margin-bottom:10px">${icon('back', 16)} Course overview</button>
          <div class="eyebrow">Level ${course.level} · ${esc(pos(course.position).title)}</div><h3 style="margin:4px 0 10px">${esc(course.title)}</h3>
          <div class="bar"><i style="width:${me.overall.percent}%"></i></div><div class="tiny muted" style="margin-top:6px">${me.overall.percent}% complete</div>
          <button class="btn ghost sm mobile-nav" id="toggleSide" style="margin-top:12px">${icon('menu', 16)} Show all lessons</button></div>
        <div class="side-body">${items}</div>
      </aside>
      <main id="main" class="reading">${inner}</main></div>`;
    bindHeader();
    const side = document.getElementById('side');
    if (window.innerWidth <= 980) side.classList.add('collapsed');
    document.getElementById('toggleSide').onclick = () => side.classList.toggle('collapsed');
    document.getElementById('home').onclick = () => go('');
    side.querySelectorAll('.side-item').forEach(b => b.onclick = () => {
      if (b.dataset.open !== 'true') return toast('Finish the previous module first.');
      const mm = course.modules.find(x => x.id === b.dataset.m);
      if (b.dataset.k === 'quiz' && !mm.lessons.every(l => read(mm.id, l.id))) return toast('Read all lessons of this module first.');
      go(`${b.dataset.m}/${b.dataset.k}`);
    });
  }
  function afterModule(m) {
    const i = course.modules.indexOf(m);
    const n = course.modules[i + 1];
    if (!n) return go('');
    if (n.type === 'video') return go(`${n.id}/${n.videos[0].id}`);
    go(`${n.id}/${n.lessons.length ? n.lessons[0].id : 'quiz'}`);
  }

  // ---------- lesson ----------
  function renderLesson(m, l) {
    const idx = m.lessons.indexOf(l), mi = course.modules.indexOf(m);
    shell(m, l.id, `<article class="card pad-lg">
      <div class="lesson-head"><div class="eyebrow">Module ${mi + 1} · Lesson ${idx + 1} of ${m.lessons.length}</div><h1 style="font-size:clamp(24px,3vw,32px);margin-top:8px">${esc(l.title)}</h1></div>
      <div class="lesson">${l.html}</div>
      <div class="pager">
        ${idx > 0 ? `<button class="btn ghost" id="prev">${icon('back', 16)} Back</button>` : '<span></span>'}
        <button class="btn" id="next">${idx + 1 < m.lessons.length ? 'Next lesson' : m.quiz ? 'Go to quiz' : 'Continue'} ${icon('next', 16)}</button>
      </div></article>`);
    document.querySelectorAll('ul.checklist li').forEach(li => li.onclick = () => li.classList.toggle('ticked'));
    if (idx > 0) document.getElementById('prev').onclick = () => go(`${m.id}/${m.lessons[idx - 1].id}`);
    document.getElementById('next').onclick = async e => {
      e.target.disabled = true;
      try {
        const res = await api('trainee_lesson', { p_token: token, p_module: m.id, p_lesson: l.id });
        if (handle(res)) return;
        if (idx + 1 < m.lessons.length) go(`${m.id}/${m.lessons[idx + 1].id}`);
        else if (m.quiz) go(`${m.id}/quiz`); else afterModule(m);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) { if (err.message !== '401') { toast(err.message); e.target.disabled = false; } }
    };
  }

  // ---------- quiz ----------
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function renderQuizIntro(m) {
    const q = quizInfo(m.id);
    shell(m, 'quiz', `<div class="card pad-lg">
      <div class="eyebrow">${esc(m.title)}</div><h1 style="font-size:clamp(24px,3vw,32px);margin-top:8px">${m.lessons.length ? 'Quiz' : 'Final quiz'}</h1>
      <p class="muted">${m.quiz.length} questions · pass mark <strong>${CAT.passMark}%</strong> · unlimited attempts</p>
      ${q.attempts ? `<div class="row" style="margin:18px 0"><div class="ring ${q.passedAt ? 'ok' : 'warn'}" style="--p:${q.best};--s:84px"><b style="font-size:18px">${q.best}%</b></div><div><strong>${q.passedAt ? 'Passed' : 'Not passed yet'}</strong><div class="muted small">Best score after ${q.attempts} attempt${q.attempts > 1 ? 's' : ''}</div></div></div>` : ''}
      <div class="pager">${q.passedAt ? `<button class="btn ghost" id="skip">Continue ${icon('next', 16)}</button>` : '<span></span>'}<button class="btn" id="start">${q.attempts ? 'Try again' : 'Start quiz'} ${icon('play', 14, true)}</button></div></div>`);
    document.getElementById('start').onclick = () => runQuiz(m);
    const s = document.getElementById('skip'); if (s) s.onclick = () => afterModule(m);
  }
  function runQuiz(m) {
    const qs = shuffle(m.quiz).map(q => ({ ...q, order: shuffle(q.options.map((t, i) => ({ t, i }))) }));
    const answers = {}; let pos_ = 0;
    const main = () => document.getElementById('main');
    function show() {
      const q = qs[pos_];
      main().innerHTML = `<div class="card pad-lg"><div class="q-wrap">
        <div class="row"><span class="eyebrow">Question ${pos_ + 1} of ${qs.length}</span><div class="spacer"></div><span class="tiny muted">${Object.keys(answers).length} answered</span></div>
        <div class="bar" style="margin:12px 0 18px"><i style="width:${(pos_ / qs.length) * 100}%"></i></div>
        <div class="q-text">${esc(q.q)}</div>
        ${q.order.map((o, k) => `<button class="q-opt ${answers[q.id] === o.i ? 'sel' : ''}" data-i="${o.i}"><span class="key">${'ABCD'[k]}</span>${esc(o.t)}</button>`).join('')}
        <div class="pager">${pos_ > 0 ? `<button class="btn ghost" id="qb">${icon('back', 16)} Back</button>` : '<span></span>'}
          ${pos_ < qs.length - 1 ? `<button class="btn" id="qn" ${answers[q.id] === undefined ? 'disabled' : ''}>Next ${icon('next', 16)}</button>` : `<button class="btn ok" id="qs" ${Object.keys(answers).length < qs.length ? 'disabled' : ''}>Submit answers</button>`}</div>
      </div></div>`;
      main().querySelectorAll('.q-opt').forEach(b => b.onclick = () => {
        answers[q.id] = +b.dataset.i;
        main().querySelectorAll('.q-opt').forEach(x => x.classList.toggle('sel', x === b));
        if (pos_ < qs.length - 1) setTimeout(() => { pos_++; show(); }, 260); else show();
      });
      const qb = document.getElementById('qb'); if (qb) qb.onclick = () => { pos_--; show(); };
      const qn = document.getElementById('qn'); if (qn) qn.onclick = () => { pos_++; show(); };
      const qsb = document.getElementById('qs'); if (qsb) qsb.onclick = submit;
    }
    async function submit() {
      document.getElementById('qs').disabled = true;
      try {
        const res = await api('trainee_quiz', { p_token: token, p_module: m.id, p_answers: answers });
        if (handle(res)) return;
        shell(m, 'quiz', '');
        const by = Object.fromEntries(res.results.map(r => [r.id, r]));
        const wrong = qs.filter(q => !by[q.id].ok);
        main().innerHTML = `<div class="card pad-lg q-wrap">
          <div class="row" style="gap:22px;flex-wrap:wrap">
            <div class="ring ${res.passed ? 'ok' : 'warn'}" style="--p:${res.score};--s:110px"><b>${res.score}%</b></div>
            <div style="flex:1;min-width:220px"><h2 style="margin:0 0 4px">${res.passed ? 'Passed – well done!' : 'Almost there'}</h2>
            <p class="muted" style="margin:0">${res.passed ? (wrong.length ? `You got ${qs.length - wrong.length} of ${qs.length} right. Review the explanation below.` : 'A perfect score.') : `You need ${res.passMark}%. Review the explanations and try again.`}</p></div>
          </div>
          <div class="divider"></div>
          ${(wrong.length ? wrong : []).map(q => { const r = by[q.id]; return `<div class="q-res bad"><strong>${esc(q.q)}</strong><div class="small" style="margin-top:6px">Your answer: ${esc(q.options[answers[q.id]])}</div><div class="small">Correct: <strong>${esc(q.options[r.answer])}</strong></div><div class="small muted" style="margin-top:4px">${esc(r.explain)}</div></div>`; }).join('')}
          ${!wrong.length ? '<p class="muted">Every answer was correct.</p>' : ''}
          <div class="pager">${res.passed ? `<span></span><button class="btn" id="cont">Continue ${icon('next', 16)}</button>` : `<button class="btn ghost" id="rev">Review lessons</button><button class="btn" id="retry">${icon('replay', 16)} Try again</button>`}</div></div>`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (res.passed) document.getElementById('cont').onclick = () => afterModule(m);
        else { document.getElementById('retry').onclick = () => runQuiz(m); document.getElementById('rev').onclick = () => go(`${m.id}/${(m.lessons[0] || {}).id || 'quiz'}`); }
      } catch (e) { if (e.message !== '401') toast(e.message); }
    }
    show();
  }

  // ---------- video player ----------
  const fmt = s => { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function Player(root, v, watchedBefore, onEnd) {
    const stage = root.querySelector('.stage'), sub = root.querySelector('.subtitle'), chapEl = root.querySelector('.chapters'), time = root.querySelector('.time'), pp = root.querySelector('[data-pp]'), nar = root.querySelector('[data-nar]'), stitle = root.querySelector('.scene-title');
    const starts = []; let acc = 0; v.scenes.forEach(s => { starts.push(acc); acc += s.duration; }); const total = acc;
    let t = 0, idx = -1, playing = false, last = 0, raf = 0, ended = false, maxT = watchedBefore ? total : 0, layer = null;
    let narrate = store.get('csacademy_narrate') === '1';
    chapEl.innerHTML = v.scenes.map((s, i) => `<div class="chap" data-i="${i}" title="${esc(s.title)}"><i></i></div>`).join('');
    const chaps = [...chapEl.children];
    const sceneAt = tt => { for (let i = starts.length - 1; i >= 0; i--) if (tt >= starts[i]) return i; return 0; };
    function speak(s) {
      try { speechSynthesis.cancel(); if (!narrate || !playing) return; const u = new SpeechSynthesisUtterance(`${s.title}. ${s.caption || ''}`); u.lang = 'en-US'; u.rate = 1; const vs = speechSynthesis.getVoices().filter(x => /en-US|en_US/.test(x.lang)); if (vs.length) u.voice = vs.find(x => /Samantha|Google US|Jenny|Aria|Natural/i.test(x.name)) || vs[0]; speechSynthesis.speak(u); } catch (_) {}
    }
    function showScene(i) {
      idx = i; const s = v.scenes[i];
      const nl = document.createElement('div'); nl.className = 'layer pre'; nl.innerHTML = window.EMSAnim.render(s);
      stage.insertBefore(nl, stage.firstChild);
      const old = layer; layer = nl;
      requestAnimationFrame(() => { nl.classList.remove('pre'); if (old) { old.classList.add('out'); setTimeout(() => old.remove(), 700); } });
      if (!playing) freeze(true);
      sub.classList.remove('show');
      setTimeout(() => { sub.textContent = s.type === 'title' ? '' : (s.caption || ''); if (sub.textContent) sub.classList.add('show'); }, 250);
      stitle.textContent = `${i + 1} / ${v.scenes.length} · ${s.title}`;
      speak(s);
    }
    function draw() {
      const i = sceneAt(Math.min(t, total - .001)); if (i !== idx) showScene(i);
      chaps.forEach((c, k) => { const a = starts[k], b = a + v.scenes[k].duration; c.firstChild.style.width = (t >= b ? 100 : t <= a ? 0 : (t - a) / (b - a) * 100) + '%'; c.classList.toggle('locked', a > maxT); });
      time.textContent = `${fmt(t)} / ${fmt(total)}`;
    }
    function tick(now) {
      if (!playing) return;
      t += (now - last) / 1000; last = now; maxT = Math.max(maxT, t);
      if (t >= total) { t = total; playing = false; draw(); setIcon(); if (!ended) { ended = true; onEnd(); } return; }
      draw(); raf = requestAnimationFrame(tick);
    }
    function setIcon() { pp.innerHTML = playing ? icon('pause', 16, true) : t >= total ? icon('replay', 16) : icon('play', 16, true); }
    function freeze(on) { stage.querySelectorAll('.layer').forEach(l => { l.style.cssText = ''; l.querySelectorAll('svg').forEach(s => { s.style.setProperty('--ps', on ? 'paused' : 'running'); s.querySelectorAll('*').forEach(e => e.style.animationPlayState = on ? 'paused' : ''); try { on ? s.pauseAnimations() : s.unpauseAnimations(); } catch (_) {} }); }); }
    function pause() { playing = false; cancelAnimationFrame(raf); freeze(true); setIcon(); try { speechSynthesis.pause(); } catch (_) {} }
    function play() {
      root.querySelector('.big-play') && root.querySelector('.big-play').remove();
      if (t >= total) { t = 0; idx = -1; ended = ended; }
      playing = true; freeze(false); last = performance.now(); setIcon();
      try { speechSynthesis.resume(); } catch (_) {}
      if (idx === -1) draw(); else if (narrate && !speechSynthesis.speaking) speak(v.scenes[idx]);
      raf = requestAnimationFrame(tick);
    }
    function seek(i) { if (starts[i] > maxT) return toast('Watch the video first – you can jump around afterwards.'); t = starts[i]; idx = -1; draw(); if (!playing) play(); }
    pp.onclick = () => playing ? pause() : play();
    root.querySelector('[data-rs]').onclick = () => { t = 0; idx = -1; draw(); if (!playing) play(); };
    chaps.forEach((c, i) => c.onclick = () => seek(i));
    const setNar = () => { nar.classList.toggle('on', narrate); nar.innerHTML = `${icon(narrate ? 'sound' : 'mute', 16)}<span class="hide-sm">Voice</span>`; };
    nar.onclick = () => { narrate = !narrate; store.set('csacademy_narrate', narrate ? '1' : '0'); setNar(); if (narrate && playing) speak(v.scenes[idx]); else try { speechSynthesis.cancel(); } catch (_) {} };
    if (!('speechSynthesis' in window)) nar.remove(); else setNar();
    root.querySelector('.big-play').onclick = play;
    draw(); freeze(true); setIcon();
    return { stop() { playing = false; cancelAnimationFrame(raf); try { speechSynthesis.cancel(); } catch (_) {} } };
  }

  function renderVideo(m, v) {
    shell(m, v.id, `<div class="card pad-lg">
      <div class="eyebrow">${esc(m.title)} · Video</div><h1 style="font-size:clamp(24px,3vw,32px);margin-top:8px">${esc(v.title)}</h1>
      <p class="muted">Watch the whole video. The questions below unlock when it has finished. Turn on <strong>Voice</strong> to hear it narrated.</p>
      <div class="player" id="pl">
        ${v.src ? `<div class="stage"><video src="${esc(v.src)}" controls playsinline></video></div>` : `
        <div class="stage"><button class="big-play" aria-label="Play"><span>${icon('play', 30, true)}</span></button></div>
        <div class="scene-title"></div><div class="subtitle"></div>
        <div class="controls"><button data-pp aria-label="Play or pause"></button><button data-rs aria-label="Restart">${icon('replay', 16)}</button><div class="chapters"></div><span class="time"></span><button data-nar aria-label="Narration"></button></div>`}
      </div></div><div id="qs"></div>`);
    const onEnd = async () => {
      if (me.progress.watched[v.id]) return;
      try { const res = await api('trainee_watched', { p_token: token, p_video: v.id }); if (handle(res)) return; renderQuestions(m, v); toast('Video complete – the questions are unlocked.'); document.getElementById('qs').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      catch (e) { if (e.message !== '401') toast(e.message); }
    };
    if (v.src) document.querySelector('#pl video').onended = onEnd;
    else player = Player(document.getElementById('pl'), v, !!me.progress.watched[v.id], onEnd);
    renderQuestions(m, v);
  }

  function feedbackHtml(a) {
    if (!a) return '';
    if (a.review) {
      const ok = a.review.status === 'passed';
      return `<div class="feedback ${ok ? 'ok' : 'low'}"><div class="fb-head"><span class="pill ${ok ? 'ok' : 'warn'}">${ok ? 'Approved by your manager' : 'Your manager asks for a revision'}</span>${a.review.score != null ? `<strong>${a.review.score}%</strong>` : ''}</div>${a.review.comment ? `<p style="margin:0">${esc(a.review.comment)}</p>` : ''}</div>`;
    }
    if (!a.auto) return `<div class="feedback ok"><div class="fb-head"><div class="ring ok" style="--p:100;--s:56px"><b style="font-size:14px">${icon('mic', 18)}</b></div><div><strong>Voice memo received</strong><div class="small muted">Your manager will listen to it and review your answer.</div></div></div></div>`;
    const pass = me.answerPass || CAT.answerPass;
    const ok = a.auto.score >= pass;
    return `<div class="feedback ${ok ? 'ok' : 'low'}">
      <div class="fb-head"><div class="ring ${ok ? 'ok' : 'warn'}" style="--p:${a.auto.score};--s:64px"><b style="font-size:16px">${a.auto.score}%</b></div>
        <div><strong>${ok ? 'Great answer – accepted' : 'Not quite there yet'}</strong><div class="small muted">${ok ? 'You covered the key points. Your manager may still review it.' : `Cover at least ${pass}% of the key points. Add the missing ones and submit again.`}</div></div></div>
      <ul class="fb-points">${a.auto.points.map(p => `<li class="${p.hit ? 'hit' : 'miss'}"><span class="ck">${p.hit ? '✓' : '·'}</span>${esc(p.point)}</li>`).join('')}</ul>
    </div>`;
  }

  function renderQuestions(m, v) {
    const box = document.getElementById('qs'); if (!box) return;
    if (!me.progress.watched[v.id]) { box.innerHTML = `<div class="card flat" style="margin-top:16px;opacity:.7"><div class="row">${icon('lock', 18)}<strong>${v.prompts.length} question${v.prompts.length > 1 ? 's' : ''} unlock after the video</strong></div></div>`; return; }
    box.innerHTML = v.prompts.map((p, i) => { const a = answer(v.id, p.id); return `<div class="card pad-lg answer-card" data-p="${p.id}" style="margin-top:16px">
      <div class="row"><span class="eyebrow">Question ${i + 1} of ${v.prompts.length}</span><div class="spacer"></div>${a ? (a.ok ? '<span class="pill ok">Done</span>' : '<span class="pill warn">Needs work</span>') : ''}</div>
      <div class="q-text" style="margin-bottom:14px">${esc(p.question)}</div>
      <textarea placeholder="Type your answer in full sentences, or record a voice memo…">${esc(a ? a.text : '')}</textarea>
      <div class="memo"><button class="btn ghost sm" data-rec>${icon('mic', 16)} Record voice memo</button><span class="tiny muted" data-recinfo></span></div>
      <div class="row"><span class="tiny muted">Your answer is checked automatically against the key points from the course material.</span><div class="spacer"></div><button class="btn" data-send>${a ? 'Submit again' : 'Submit answer'}</button></div>
      <div data-fb>${feedbackHtml(a)}</div></div>`; }).join('');
    box.querySelectorAll('.answer-card').forEach(c => setupAnswer(c, v, m));
  }

  function setupAnswer(card, v, m) {
    const pid = card.dataset.p, ta = card.querySelector('textarea'), recBtn = card.querySelector('[data-rec]'), info = card.querySelector('[data-recinfo]'), memo = card.querySelector('.memo');
    let audio = null;
    const canRecord = !!(navigator.mediaDevices && window.MediaRecorder) && window.isSecureContext;
    if (!canRecord) { recBtn.disabled = true; info.textContent = 'Voice memos are not available in this browser – please type your answer.'; }
    recBtn.onclick = async () => {
      if (recorder && recorder.card === card) { recorder.stop(); return; }
      if (recorder) recorder.cancel();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
        const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        const chunks = []; const started = Date.now(); let timer, rec = null, cancelled = false;
        const base = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
          rec = new SR(); rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true; let fin = '';
          rec.onresult = e => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript + ' '; else interim += r[0].transcript; } ta.value = base + fin + interim; };
          rec.onerror = () => {}; try { rec.start(); } catch (_) {}
        }
        mr.ondataavailable = e => e.data.size && chunks.push(e.data);
        mr.onstop = () => {
          clearInterval(timer); stream.getTracks().forEach(t => t.stop()); if (rec) try { rec.stop(); } catch (_) {}
          recorder = null; recBtn.className = 'btn ghost sm'; recBtn.innerHTML = `${icon('mic', 16)} Record again`;
          if (cancelled) { info.textContent = ''; return; }
          const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
          info.textContent = SR ? 'Memo recorded – your words are in the text box. Check them, then submit.' : 'Memo recorded. Your manager will listen to it.';
          let a = memo.querySelector('audio'); if (!a) { a = document.createElement('audio'); a.controls = true; memo.appendChild(a); }
          a.src = URL.createObjectURL(blob);
          const fr = new FileReader(); fr.onload = () => { audio = { b64: String(fr.result).split(',')[1], mime: blob.type }; }; fr.readAsDataURL(blob);
        };
        mr.start(); recBtn.className = 'btn rec sm'; recBtn.innerHTML = `<span class="recdot"></span> Stop recording`;
        timer = setInterval(() => { info.textContent = `Recording… ${fmt((Date.now() - started) / 1000)}`; if (Date.now() - started > 5 * 60 * 1000) mr.stop(); }, 300);
        recorder = { card, stop: () => mr.state !== 'inactive' && mr.stop(), cancel: () => { cancelled = true; if (mr.state !== 'inactive') mr.stop(); } };
      } catch (_) { info.textContent = 'Microphone access was blocked. Allow it in your browser, or type your answer.'; }
    };
    card.querySelector('[data-send]').onclick = async e => {
      if (recorder && recorder.card === card) { recorder.stop(); await new Promise(r => setTimeout(r, 600)); }
      const text = ta.value.trim();
      if (!text && !audio) return toast('Please type an answer or record a voice memo.');
      if (text && text.split(/\s+/).length < 8 && !audio) return toast('Please answer in a few full sentences.');
      const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Checking…';
      try {
        const res = await api('trainee_answer', { p_token: token, p_video: v.id, p_prompt: pid, p_text: text, p_audio: audio ? audio.b64 : null, p_mime: audio ? audio.mime : null });
        if (handle(res)) return;
        const a = answer(v.id, pid);
        card.querySelector('[data-fb]').innerHTML = feedbackHtml(a);
        btn.disabled = false; btn.textContent = 'Submit again';
        const pill = card.querySelector('.pill'); const row = card.querySelector('.row');
        if (pill) pill.remove(); row.insertAdjacentHTML('beforeend', a.ok ? '<span class="pill ok">Done</span>' : '<span class="pill warn">Needs work</span>');
        if (videoDone(v)) {
          const nv = m.videos.find(x => !videoDone(x));
          card.querySelector('[data-fb]').insertAdjacentHTML('beforeend', `<div class="pager" style="border:0;padding:0;margin-top:14px"><span></span><button class="btn" id="nextAfter">${nv ? 'Next video' : 'Continue'} ${icon('next', 16)}</button></div>`);
          document.getElementById('nextAfter').onclick = () => nv ? go(`${m.id}/${nv.id}`) : afterModule(m);
        }
      } catch (err) { if (err.message !== '401') { toast(err.message); btn.disabled = false; btn.textContent = 'Submit answer'; } }
    };
  }

  // ---------- done ----------
  function renderDone(res) {
    cleanup();
    const c = courseById(res.courseId) || course || {};
    const path = res.path || [];
    const next = path.find(p => !p.completed);
    me = null; token = null; store.del(TOKEN_KEY); history.replaceState(null, '', location.pathname);
    $app.innerHTML = `<div class="done-wrap"><canvas id="confetti"></canvas><div class="done-card">
      <div class="badge">${icon('trophy', 56)}</div>
      <div class="eyebrow" style="color:#7cc4f8">Level ${c.level} complete</div>
      <h1 style="color:#fff;margin:10px 0 12px">${esc(c.title || 'Course complete')}</h1>
      <p style="color:rgba(255,255,255,.75);font-size:17px">Congratulations! You finished every lesson, quiz and video of this course. Your manager will review your answers.</p>
      <div class="card" style="text-align:left;margin:26px 0 18px;background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1);box-shadow:none;color:#fff">
        ${next ? `<strong>Next up: Level ${next.level} · ${esc((courseById(next.courseId) || {}).title || '')}</strong><div style="color:rgba(255,255,255,.65);font-size:14px;margin-top:4px">Ask your manager for your Level ${next.level} access code when you are ready.</div>`
               : `<strong>You completed every level for ${esc(pos(c.position).title)}.</strong><div style="color:rgba(255,255,255,.65);font-size:14px;margin-top:4px">Outstanding work.</div>`}
      </div>
      <p style="color:rgba(255,255,255,.5);font-size:13px">For security you have been signed out. This access code no longer works.</p>
    </div></div>`;
    confetti(document.getElementById('confetti'));
  }
  function confetti(cv) {
    const ctx = cv.getContext('2d'); const W = cv.width = innerWidth, H = cv.height = innerHeight;
    const cols = ['#ffd76a', '#7cc4f8', '#2563eb', '#ffffff', '#3ddc97'];
    const ps = Array.from({ length: 160 }, () => ({ x: Math.random() * W, y: -20 - Math.random() * H * .6, r: 4 + Math.random() * 6, vx: -1.5 + Math.random() * 3, vy: 2 + Math.random() * 3.5, a: Math.random() * 6, va: -.1 + Math.random() * .2, c: cols[Math.floor(Math.random() * cols.length)] }));
    let n = 0; (function f() { ctx.clearRect(0, 0, W, H); ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); }); if (++n < 420) requestAnimationFrame(f); else ctx.clearRect(0, 0, W, H); })();
  }

  // ---------- router ----------
  function route() {
    cleanup();
    if (!me) return renderLogin();
    course = courseById(me.courseId);
    if (!course) return renderLogin('This course is not available. Please contact your manager.');
    const [mid, key] = location.hash.slice(1).split('/');
    const i = course.modules.findIndex(m => m.id === mid);
    if (i < 0) { window.scrollTo(0, 0); return renderHome(); }
    if (!unlocked(i)) { location.hash = ''; return; }
    const m = course.modules[i];
    window.scrollTo(0, 0);
    if (m.type === 'video') return renderVideo(m, m.videos.find(x => x.id === key) || m.videos[0]);
    if ((key === 'quiz' && m.quiz) || (!m.lessons.length && m.quiz)) {
      const unread = m.lessons.find(l => !read(m.id, l.id));
      if (unread) return go(`${m.id}/${unread.id}`);
      return renderQuizIntro(m);
    }
    renderLesson(m, m.lessons.find(x => x.id === key) || m.lessons[0]);
  }
  window.addEventListener('hashchange', route);

  (async function init() {
    if (!token) return renderLogin();
    $app.innerHTML = '<p style="padding:40px;color:var(--muted)">Loading…</p>';
    try { me = await api('trainee_me', { p_token: token }); route(); }
    catch (e) { if (e.message !== '401') renderLogin(e.message); }
  })();
})();
