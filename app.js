// EMS Trainer Academy – trainee app
(function () {
  const $app = document.getElementById('app');
  let course = null, me = null;
  let player = null; // active animated player (to stop on navigation)
  let recorder = null;

  const ICONS = {
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    replay: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  };
  const icon = (n, size = 20, fill = false) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n]}</svg>`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CFG = window.CONFIG || {};
  const TOKEN_KEY = 'csacademy_token';
  let token = store.get(TOKEN_KEY);
  // calls a database function; ends the session view when the server says so
  async function api(fn, args) {
    try { return await rpc(fn, args); }
    catch (e) {
      if (e.code === 'SESSION_ENDED') { me = null; token = null; store.del(TOKEN_KEY); renderLogin('Your session has ended. Please sign in again.'); throw new Error('401'); }
      throw e;
    }
  }
  function toast(msg) { document.querySelectorAll('.toast').forEach(x => x.remove()); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
  function cleanup() { if (player) { player.stop(); player = null; } if (recorder) { recorder.cancel(); recorder = null; } }

  // after any progress call: update state, and show the finish screen if the training is complete
  function handleProgress(res) {
    if (res.completed) { renderDone(); return true; }
    if (res.me) me = res.me; else if (res.progress) me = res;
    return false;
  }

  // ---------- helpers on progress ----------
  const status = id => me.overall.per.find(p => p.id === id) || { done: 0, total: 1, complete: false };
  const unlocked = idx => course.modules.slice(0, idx).every(m => status(m.id).complete);
  const lessonRead = (mid, lid) => !!(me.progress.modules[mid] && me.progress.modules[mid].lessonsRead.includes(lid));
  const quizInfo = mid => (me.progress.modules[mid] && me.progress.modules[mid].quiz) || { best: 0, attempts: 0, passedAt: null };
  const answered = (vid, pid) => me.answered.some(a => a.videoId === vid && a.promptId === pid);

  const brand = () => `<div class="brand">${CFG.LOGO ? `<img class="brand-logo" src="${esc(CFG.LOGO)}" alt="${esc(CFG.STUDIO_NAME)}" onerror="this.replaceWith(Object.assign(document.createElement('b'),{className:'brand-text',textContent:'${esc(CFG.STUDIO_NAME)}'}))">` : `<b class="brand-text">${esc(CFG.STUDIO_NAME)}</b>`}<div class="brand-sub">Coach Academy<small>${esc(CFG.STUDIO_LOCATION || '')}</small></div></div>`;
  function topbar() {
    return `<div class="topbar">
      ${brand()}
      <div class="spacer"></div>
      <span class="who hide-sm">${esc(me.name)}</span>
      <button class="btn ghost sm" id="logout">Sign out</button>
    </div>`;
  }
  function bindTop() {
    document.getElementById('logout').onclick = async () => { await rpc('trainee_logout', { p_token: token }).catch(() => {}); me = null; token = null; store.del(TOKEN_KEY); location.hash = ''; renderLogin(); };
  }

  // ---------- login ----------
  function renderLogin(msg) {
    cleanup();
    $app.innerHTML = `<div class="login"><form class="card" id="lf">
      <div class="login-brand">${brand()}</div>
      <h2>Welcome, coach</h2>
      <p class="fine">Enter the personal access code you received from your manager.</p>
      <label class="field"><span>Access code</span><input class="code-input" type="text" id="code" placeholder="CS-XXXXXX" autocomplete="off" autocapitalize="characters" spellcheck="false"></label>
      <button class="btn" style="width:100%">Start training</button>
      <p class="err" id="err">${esc(msg || '')}</p>
      <p class="fine" style="margin:8px 0 0">Your progress is saved automatically. You can sign out and continue later with the same code. When you finish the training, the code stops working.</p>
    </form></div>`;
    document.getElementById('code').focus();
    document.getElementById('lf').onsubmit = async e => {
      e.preventDefault();
      const code = document.getElementById('code').value;
      const btn = e.target.querySelector('button'); btn.disabled = true;
      try { const r = await rpc('trainee_login', { p_code: code }); if (r.error) throw new Error(r.error); token = r.token; store.set(TOKEN_KEY, token); me = await api('trainee_me', { p_token: token }); route(); }
      catch (err) { if (err.message !== '401') document.getElementById('err').textContent = err.message; btn.disabled = false; }
    };
  }

  // ---------- dashboard ----------
  function renderDashboard() {
    const o = me.overall;
    $app.innerHTML = topbar() + `<div class="wrap">
      <div class="hero">
        <div class="ring" style="--p:${o.percent}"><b>${o.percent}%</b></div>
        <div><h1>Hi ${esc(me.name.split(' ')[0])}, welcome to the ${esc(CFG.STUDIO_NAME)} Coach Academy</h1>
        <p class="fine" style="margin:0">Work through the modules in order. Each quiz needs at least <strong>${course.passMark}%</strong>. When everything is done, you are signed out automatically and your manager reviews your answers.</p></div>
      </div>
      <div class="grid cols">${course.modules.map((m, i) => {
        const st = status(m.id), open = unlocked(i), pct = Math.round(st.done / st.total * 100);
        const pill = st.complete ? `<span class="pill ok">${icon('check', 12)} Complete</span>` : !open ? `<span class="pill">${icon('lock', 12)} Locked</span>` : st.done ? `<span class="pill blue">In progress</span>` : `<span class="pill blue">Ready</span>`;
        return `<div class="card mod ${open ? '' : 'locked'}" data-id="${m.id}" data-open="${open}">
          <div style="display:flex;justify-content:space-between;align-items:center"><div class="ic">${icon(m.icon || 'bolt', 22)}</div>${pill}</div>
          <div><div class="num">Module ${i + 1}</div><h3 style="margin:2px 0 6px">${esc(m.title)}</h3><p>${esc(m.summary)}</p></div>
          <div class="bar"><i style="width:${pct}%"></i></div>
        </div>`;
      }).join('')}</div>
    </div>`;
    bindTop();
    document.querySelectorAll('.mod').forEach(el => el.onclick = () => {
      if (el.dataset.open !== 'true') return toast('Finish the previous module first.');
      openModule(el.dataset.id);
    });
  }

  function openModule(id) {
    const m = course.modules.find(x => x.id === id);
    if (m.type === 'video') return go(`${id}/${(m.videos.find(v => !(me.progress.watched[v.id] && v.prompts.every(p => answered(v.id, p.id)))) || m.videos[0]).id}`);
    const next = m.lessons.find(l => !lessonRead(id, l.id));
    go(`${id}/${next ? next.id : 'quiz'}`);
  }
  const go = h => { if (location.hash === '#' + h) route(); else location.hash = h; };

  // ---------- module shell ----------
  function shell(m, activeKey, inner) {
    let side;
    if (m.type === 'video') {
      side = m.videos.map(v => {
        const done = me.progress.watched[v.id] && v.prompts.every(p => answered(v.id, p.id));
        return `<button data-k="${v.id}" class="${activeKey === v.id ? 'on' : ''}"><span class="dot ${done ? 'done' : ''}">${done ? icon('check', 12) : ''}</span>${esc(v.title)}</button>`;
      }).join('');
    } else {
      const qi = quizInfo(m.id);
      side = m.lessons.map(l => `<button data-k="${l.id}" class="${activeKey === l.id ? 'on' : ''}"><span class="dot ${lessonRead(m.id, l.id) ? 'done' : ''}">${lessonRead(m.id, l.id) ? icon('check', 12) : ''}</span>${esc(l.title)}</button>`).join('')
        + `<button data-k="quiz" class="${activeKey === 'quiz' ? 'on' : ''}"><span class="dot ${qi.passedAt ? 'done' : ''}">${qi.passedAt ? icon('check', 12) : ''}</span>Quiz${qi.attempts ? ` <span class="pill ${qi.passedAt ? 'ok' : 'warn'}" style="margin-left:auto">${qi.best}%</span>` : ''}</button>`;
    }
    $app.innerHTML = topbar() + `<div class="wrap">
      <button class="back" id="home">${icon('back', 16)} All modules</button>
      <div class="layout">
        <div class="card side"><div style="padding:6px 12px 10px"><div class="num" style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Module ${course.modules.indexOf(m) + 1}</div><h3 style="margin:2px 0 0">${esc(m.title)}</h3></div>${side}</div>
        <div id="main">${inner}</div>
      </div></div>`;
    bindTop();
    document.getElementById('home').onclick = () => go('');
    document.querySelectorAll('.side button').forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (m.type !== 'video' && k === 'quiz' && !m.lessons.every(l => lessonRead(m.id, l.id))) return toast('Read all lessons first, then take the quiz.');
      go(`${m.id}/${k}`);
    });
  }

  // ---------- lesson ----------
  function renderLesson(m, l) {
    const idx = m.lessons.indexOf(l);
    shell(m, l.id, `<div class="card lesson">
      <div class="pill blue" style="margin-bottom:10px">Lesson ${idx + 1} of ${m.lessons.length}</div>
      <h2>${esc(l.title)}</h2>${l.html}
      <div class="actions">
        ${idx > 0 ? `<button class="btn ghost" id="prev">Back</button>` : ''}
        <button class="btn" id="next">${lessonRead(m.id, l.id) ? 'Continue' : 'Got it, continue'}</button>
      </div></div>`);
    document.querySelectorAll('ul.checklist li').forEach(li => li.onclick = () => li.classList.toggle('ticked'));
    if (idx > 0) document.getElementById('prev').onclick = () => go(`${m.id}/${m.lessons[idx - 1].id}`);
    document.getElementById('next').onclick = async () => {
      try {
        const res = await api('trainee_lesson', { p_token: token, p_module: m.id, p_lesson: l.id });
        if (handleProgress(res)) return;
        go(`${m.id}/${idx + 1 < m.lessons.length ? m.lessons[idx + 1].id : 'quiz'}`);
        window.scrollTo(0, 0);
      } catch (e) { if (e.message !== '401') toast(e.message); }
    };
  }

  // ---------- quiz ----------
  function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function renderQuizIntro(m) {
    const qi = quizInfo(m.id);
    shell(m, 'quiz', `<div class="card">
      <h2>Quiz: ${esc(m.title)}</h2>
      <p>${m.quiz.length} questions. You need at least <strong>${course.passMark}%</strong> to pass. You can retry as often as you need.</p>
      ${qi.attempts ? `<p>Your best score so far: <span class="pill ${qi.passedAt ? 'ok' : 'warn'}">${qi.best}%</span> after ${qi.attempts} attempt${qi.attempts > 1 ? 's' : ''}.</p>` : ''}
      ${qi.passedAt ? `<div class="note">You have passed this quiz. You can take it again for practice.</div>` : ''}
      <div class="actions">${qi.passedAt ? `<button class="btn ghost" id="home2">Back to modules</button>` : ''}<button class="btn" id="start">${qi.attempts ? 'Start again' : 'Start quiz'}</button></div>
    </div>`);
    document.getElementById('start').onclick = () => runQuiz(m);
    const h = document.getElementById('home2'); if (h) h.onclick = () => go('');
  }

  function runQuiz(m) {
    const qs = shuffle(m.quiz).map(q => ({ ...q, order: shuffle(q.options.map((t, i) => ({ t, i }))) }));
    const answers = {}; let pos = 0;
    const main = () => document.getElementById('main');
    function show() {
      const q = qs[pos];
      main().innerHTML = `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span class="pill blue">Question ${pos + 1} of ${qs.length}</span><span class="fine">${Object.keys(answers).length} answered</span></div>
        <div class="bar" style="margin-bottom:18px"><i style="width:${(pos / qs.length) * 100}%"></i></div>
        <h3 style="font-size:19px">${esc(q.q)}</h3>
        ${q.order.map(o => `<button class="q-opt ${answers[q.id] === o.i ? 'sel' : ''}" data-i="${o.i}">${esc(o.t)}</button>`).join('')}
        <div class="actions">
          ${pos > 0 ? `<button class="btn ghost" id="qb">Back</button>` : ''}
          ${pos < qs.length - 1 ? `<button class="btn" id="qn" ${answers[q.id] === undefined ? 'disabled' : ''}>Next</button>` : `<button class="btn ok" id="qs" ${Object.keys(answers).length < qs.length ? 'disabled' : ''}>Submit answers</button>`}
        </div></div>`;
      main().querySelectorAll('.q-opt').forEach(b => b.onclick = () => {
        answers[q.id] = Number(b.dataset.i);
        if (pos < qs.length - 1) { pos++; setTimeout(show, 180); show_sel(b); } else show();
      });
      function show_sel(b) { main().querySelectorAll('.q-opt').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); }
      const qb = document.getElementById('qb'); if (qb) qb.onclick = () => { pos--; show(); };
      const qn = document.getElementById('qn'); if (qn) qn.onclick = () => { pos++; show(); };
      const qsb = document.getElementById('qs'); if (qsb) qsb.onclick = submit;
    }
    async function submit() {
      try {
        const res = await api('trainee_quiz', { p_token: token, p_module: m.id, p_answers: answers });
        if (handleProgress(res)) return;
        shell(m, 'quiz', '');
        const byId = Object.fromEntries(res.results.map(r => [r.id, r]));
        main().innerHTML = `<div class="card">
          <div style="display:flex;align-items:center;gap:18px;margin-bottom:8px">
            <div class="score" style="color:${res.passed ? 'var(--ok)' : 'var(--bad)'}">${res.score}%</div>
            <div><h2 style="margin:0">${res.passed ? 'Passed, well done!' : 'Not passed yet'}</h2><p class="fine" style="margin:0">${res.passed ? 'This module is complete.' : `You need at least ${res.passMark}%. Read the explanations below and try again.`}</p></div>
          </div>
          ${qs.map((q, i) => { const r = byId[q.id]; return `<div class="q-res ${r.ok ? 'ok' : 'bad'}"><strong>${i + 1}. ${esc(q.q)}</strong><br>
            ${r.ok ? '' : `<span class="fine">Your answer: ${esc(q.options[answers[q.id]])}</span><br>`}
            <span>Correct: <strong>${esc(q.options[r.answer])}</strong></span><br><span class="fine">${esc(r.explain)}</span></div>`; }).join('')}
          <div class="actions">${res.passed ? `<button class="btn" id="cont">Continue</button>` : `<button class="btn ghost" id="rev">Review lessons</button><button class="btn" id="retry">Try again</button>`}</div>
        </div>`;
        window.scrollTo(0, 0);
        if (res.passed) document.getElementById('cont').onclick = () => {
          const i = course.modules.indexOf(m);
          if (course.modules[i + 1]) openModule(course.modules[i + 1].id); else go('');
        };
        else { document.getElementById('retry').onclick = () => runQuiz(m); document.getElementById('rev').onclick = () => go(`${m.id}/${m.lessons[0].id}`); }
      } catch (e) { if (e.message !== '401') toast(e.message); }
    }
    show();
  }

  // ---------- video ----------
  function fmt(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

  function AnimPlayer(root, v, onEnd) {
    const stage = root.querySelector('.stage'), cap = root.querySelector('.caption'), bar = root.querySelector('.track i'), time = root.querySelector('.time'), pp = root.querySelector('[data-pp]');
    const total = v.scenes.reduce((a, s) => a + s.duration, 0);
    let t = 0, idx = -1, playing = false, last = 0, raf = 0, ended = false;
    function sceneAt(tt) { let acc = 0; for (let i = 0; i < v.scenes.length; i++) { if (tt < acc + v.scenes[i].duration) return i; acc += v.scenes[i].duration; } return v.scenes.length - 1; }
    function draw() {
      const i = sceneAt(t);
      if (i !== idx) {
        idx = i; const s = v.scenes[i];
        stage.innerHTML = window.EMSAnim.render(s);
        cap.innerHTML = `<b>${esc(s.title)}</b>${s.anim === 'title' ? '' : esc(s.caption)}`;
        if (!playing) pause(true);
      }
      bar.style.width = (t / total * 100) + '%';
      time.textContent = `${fmt(t)} / ${fmt(total)}`;
    }
    function tick(now) {
      if (!playing) return;
      t += (now - last) / 1000; last = now;
      if (t >= total) { t = total; draw(); playing = false; setIcon(); if (!ended) { ended = true; onEnd(); } return; }
      draw(); raf = requestAnimationFrame(tick);
    }
    function setIcon() { pp.innerHTML = playing ? icon('pause', 18, true) : t >= total ? icon('replay', 18) : icon('play', 18, true); }
    function pause(silent) {
      stage.classList.add('paused');
      const svg = stage.querySelector('svg'); if (svg && svg.pauseAnimations) svg.pauseAnimations();
      if (!silent) { playing = false; cancelAnimationFrame(raf); setIcon(); }
    }
    function play() {
      if (t >= total) { t = 0; idx = -1; }
      playing = true; stage.classList.remove('paused');
      const svg = stage.querySelector('svg'); if (svg && svg.unpauseAnimations) svg.unpauseAnimations();
      last = performance.now(); setIcon(); draw(); raf = requestAnimationFrame(tick);
    }
    pp.onclick = () => playing ? pause() : play();
    root.querySelector('[data-rs]').onclick = () => { t = 0; idx = -1; play(); };
    draw(); setIcon();
    return { stop() { playing = false; cancelAnimationFrame(raf); }, play };
  }

  function renderVideo(m, v) {
    const watched = !!me.progress.watched[v.id];
    shell(m, v.id, `<div class="card">
      <h2>${esc(v.title)}</h2>
      <p class="fine">Watch the whole video. The questions unlock when it has finished.</p>
      <div class="player" id="pl">
        ${v.src ? `<div class="stage"><video src="${esc(v.src)}" controls playsinline></video></div>` :
        `<div class="stage paused"></div><div class="caption"></div>
         <div class="controls"><button data-pp aria-label="Play or pause"></button><button data-rs aria-label="Restart">${icon('replay', 18)}</button><div class="track"><i></i></div><span class="time"></span></div>`}
      </div>
    </div>
    <div id="qs"></div>`);
    const onEnd = async () => {
      if (me.progress.watched[v.id]) return;
      try { const res = await api('trainee_watched', { p_token: token, p_video: v.id }); if (handleProgress(res)) return; renderQuestions(m, v); toast('Video complete. You can answer the questions now.'); }
      catch (e) { if (e.message !== '401') toast(e.message); }
    };
    if (v.src) document.querySelector('#pl video').onended = onEnd;
    else player = AnimPlayer(document.getElementById('pl'), v, onEnd);
    renderQuestions(m, v);
    if (!watched && player) setTimeout(() => player && player.play(), 400);
  }

  function renderQuestions(m, v) {
    const box = document.getElementById('qs'); if (!box) return;
    const watched = !!me.progress.watched[v.id];
    if (!watched) { box.innerHTML = `<div class="card" style="margin-top:16px;opacity:.6"><h3 style="margin:0">${icon('lock', 16)} ${v.prompts.length} question${v.prompts.length > 1 ? 's' : ''} unlock after the video</h3></div>`; return; }
    box.innerHTML = v.prompts.map((p, i) => `<div class="card answer" data-p="${p.id}">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><span class="pill blue">Question ${i + 1}</span>${answered(v.id, p.id) ? `<span class="pill ok">${icon('check', 12)} Submitted</span>` : ''}</div>
      <h3 style="margin:12px 0">${esc(p.question)}</h3>
      <textarea rows="6" placeholder="Type your answer here, or record a voice memo below…"></textarea>
      <div class="memo">
        <button class="btn ghost sm" data-rec>${icon('mic', 16)} Record voice memo</button>
        <span class="fine" data-recinfo></span>
      </div>
      ${answered(v.id, p.id) ? `<p class="fine">You already submitted an answer. Submitting again replaces it.</p>` : ''}
      <div class="actions" style="margin-top:8px"><button class="btn" data-send>Submit answer</button></div>
    </div>`).join('');
    box.querySelectorAll('.answer').forEach(card => setupAnswer(card, v, m));
  }

  function setupAnswer(card, v, m) {
    const pid = card.dataset.p, ta = card.querySelector('textarea'), recBtn = card.querySelector('[data-rec]'), info = card.querySelector('[data-recinfo]'), memo = card.querySelector('.memo');
    let audio = null; // {b64, mime}
    const canRecord = !!(navigator.mediaDevices && window.MediaRecorder) && window.isSecureContext;
    if (!canRecord) { recBtn.disabled = true; info.textContent = window.isSecureContext ? 'Voice memos are not supported in this browser. Please type your answer.' : 'Voice memos only work on a secure (https) connection. Please type your answer.'; }

    recBtn.onclick = async () => {
      if (recorder && recorder.card === card) { recorder.stop(); return; }
      if (recorder) recorder.cancel();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
        const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        const chunks = []; let started = Date.now(), timer, rec = null, cancelled = false;
        const base = ta.value ? ta.value.replace(/\s*$/, ' ') : '';
        // live transcription (Chrome, Edge, Safari)
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
          rec = new SR(); rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true;
          let finalText = '';
          rec.onresult = e => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += r[0].transcript + ' '; else interim += r[0].transcript; } ta.value = base + finalText + interim; };
          rec.onerror = () => {}; try { rec.start(); } catch (_) {}
        }
        mr.ondataavailable = e => e.data.size && chunks.push(e.data);
        mr.onstop = () => {
          clearInterval(timer); stream.getTracks().forEach(t => t.stop()); if (rec) try { rec.stop(); } catch (_) {}
          recorder = null; recBtn.className = 'btn ghost sm'; recBtn.innerHTML = `${icon('mic', 16)} Record again`;
          if (cancelled) { info.textContent = ''; return; }
          const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          info.innerHTML = '';
          let a = memo.querySelector('audio'); if (!a) { a = document.createElement('audio'); a.controls = true; memo.appendChild(a); }
          a.src = url;
          const fr = new FileReader(); fr.onload = () => { audio = { b64: String(fr.result).split(',')[1], mime: blob.type }; }; fr.readAsDataURL(blob);
          if (!SR) info.textContent = 'Memo recorded. (Automatic transcription is not available in this browser, your manager will listen to the memo.)';
        };
        mr.start(); recBtn.className = 'btn rec sm'; recBtn.innerHTML = `<span class="recdot" style="background:#fff"></span> Stop recording`;
        timer = setInterval(() => { info.textContent = `Recording… ${fmt((Date.now() - started) / 1000)}${SR ? ' · your words appear in the text box' : ''}`; if (Date.now() - started > 5 * 60 * 1000) mr.stop(); }, 300);
        recorder = { card, stop: () => mr.state !== 'inactive' && mr.stop(), cancel: () => { cancelled = true; if (mr.state !== 'inactive') mr.stop(); } };
      } catch (e) { info.textContent = 'Microphone access was blocked. Please allow it in your browser, or type your answer.'; }
    };

    card.querySelector('[data-send]').onclick = async e => {
      if (recorder && recorder.card === card) { recorder.stop(); await new Promise(r => setTimeout(r, 500)); }
      const text = ta.value.trim();
      if (!text && !audio) return toast('Please type an answer or record a voice memo.');
      if (text && text.split(/\s+/).length < 8 && !audio) return toast('Please answer in a few full sentences.');
      e.target.disabled = true; e.target.textContent = 'Sending…';
      try {
        const res = await api('trainee_response', { p_token: token, p_video: v.id, p_prompt: pid, p_text: text, p_audio: audio ? audio.b64 : null, p_mime: audio ? audio.mime : null });
        if (handleProgress(res)) return;
        toast('Answer submitted.');
        // go to next open item
        const nextVideo = m.videos.find(x => !(me.progress.watched[x.id] && x.prompts.every(p => answered(x.id, p.id))));
        if (v.prompts.every(p => answered(v.id, p.id)) && nextVideo && nextVideo.id !== v.id) go(`${m.id}/${nextVideo.id}`);
        else { cleanup(); renderVideo(m, v); }
      } catch (err) { if (err.message !== '401') { toast(err.message); e.target.disabled = false; e.target.textContent = 'Submit answer'; } }
    };
  }

  // ---------- done ----------
  function renderDone() {
    cleanup(); me = null; token = null; store.del(TOKEN_KEY); history.replaceState(null, '', location.pathname);
    $app.innerHTML = `<div class="donescreen login"><div class="card">
      <div class="badge">${icon('check', 44)}</div>
      <h1>Training complete!</h1>
      <p>Congratulations, you have finished all modules of the ${esc(CFG.STUDIO_NAME)} Coach Academy. Your manager will now review your written and spoken answers and get back to you.</p>
      <p class="fine">For security, you have been signed out automatically and your access code is no longer valid.</p>
    </div></div>`;
  }

  // ---------- router ----------
  function route() {
    cleanup();
    if (!me) return renderLogin();
    const [mid, key] = location.hash.slice(1).split('/');
    const i = course.modules.findIndex(m => m.id === mid);
    if (i < 0) return renderDashboard();
    if (!unlocked(i)) { location.hash = ''; return; }
    const m = course.modules[i];
    if (m.type === 'video') { const v = m.videos.find(x => x.id === key) || m.videos[0]; return renderVideo(m, v); }
    if (key === 'quiz') {
      if (!m.lessons.every(l => lessonRead(m.id, l.id))) return go(`${m.id}/${m.lessons.find(l => !lessonRead(m.id, l.id)).id}`);
      return renderQuizIntro(m);
    }
    const l = m.lessons.find(x => x.id === key) || m.lessons[0];
    renderLesson(m, l);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  (async function init() {
    course = { ...window.COURSE, studioName: CFG.STUDIO_NAME, passMark: CFG.PASS_MARK || 90 };
    if (!token) return renderLogin();
    $app.innerHTML = '<p style="padding:40px;color:var(--muted)">Loading…</p>';
    try { me = await api('trainee_me', { p_token: token }); route(); }
    catch (e) { if (e.message !== '401') renderLogin(e.message); }
  })();
})();
