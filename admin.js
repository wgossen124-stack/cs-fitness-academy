// CS FITNESS Academy v2 – admin
(function () {
  const $app = document.getElementById('app');
  const CFG = window.CONFIG || {};
  const CAT = window.CATALOG;
  const TOKEN_KEY = 'csacademy_admin';
  let token = store.get(TOKEN_KEY);
  let data = null;
  let view = { tab: 'team', person: null, filter: 'all', q: '', open: {} };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const date = iso => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '–';
  const pos = id => CAT.positions.find(p => p.id === id) || { title: id };
  const courseById = id => CAT.courses.find(c => c.id === id);
  const coursesOf = p => CAT.courses.filter(c => c.position === p).sort((a, b) => a.level - b.level);
  const ICON = {
    plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 5l-7 7 7 7"/>', check: '<path d="M5 12l5 5 9-10"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    chev: '<path d="M6 9l6 6 6-6"/>', play: '<path d="M8 5v14l11-7z"/>', bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', chat: '<path d="M4 5h16v11H9l-5 4z"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3z"/>', book: '<path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"/>', quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01"/>',
  };
  const icon = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n] || ''}</svg>`;

  async function api(fn, args) {
    try { return await rpc(fn, { p_token: token, ...(args || {}) }); }
    catch (e) {
      if (e.code === 'ADMIN_SESSION_ENDED') { token = null; store.del(TOKEN_KEY); renderLogin('Please sign in again.'); throw new Error('401'); }
      throw e;
    }
  }
  function toast(msg) { document.querySelectorAll('.toast').forEach(x => x.remove()); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2800); }
  function modal(html) { const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="card pad-lg">${html}</div>`; m.onclick = e => { if (e.target === m) m.remove(); }; document.body.appendChild(m); return m; }
  function confirmBox(title, text, ok, danger) {
    return new Promise(res => {
      const m = modal(`<h2 style="font-size:22px">${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn ghost" data-n>Cancel</button><button class="btn ${danger ? 'danger' : ''}" data-y>${esc(ok)}</button></div>`);
      m.querySelector('[data-n]').onclick = () => { m.remove(); res(false); };
      m.querySelector('[data-y]').onclick = () => { m.remove(); res(true); };
    });
  }
  const brand = sub => `<div class="brand">${CFG.LOGO ? `<img class="brand-logo" src="${esc(CFG.LOGO)}" alt="${esc(CFG.STUDIO_NAME)}" onerror="this.replaceWith(Object.assign(document.createElement('b'),{className:'brand-text',textContent:'${esc(CFG.STUDIO_NAME)}'}))">` : `<b class="brand-text">${esc(CFG.STUDIO_NAME)}</b>`}<div class="brand-sub">${sub}<small>${esc(CFG.STUDIO_LOCATION || '')}</small></div></div>`;

  // ---------- derived ----------
  const allEnrollments = () => data.people.flatMap(p => p.enrollments.map(e => ({ ...e, person: p })));
  const needsReview = a => !a.review && (!a.auto || !a.auto.passed);
  const reviewCount = p => p.enrollments.reduce((n, e) => n + e.answers.filter(needsReview).length, 0);
  const activeEnr = p => p.enrollments.find(e => e.status === 'active');
  const lastActivity = p => p.enrollments.map(e => e.completedAt || e.lastLoginAt || e.createdAt).concat([p.createdAt]).filter(Boolean).sort().pop();
  function levelState(p, c) {
    const done = p.enrollments.find(e => e.courseId === c.id && e.status === 'completed');
    const act = p.enrollments.find(e => e.courseId === c.id && e.status === 'active');
    const prevOk = c.level === 1 || p.enrollments.some(e => e.status === 'completed' && (courseById(e.courseId) || {}).position === c.position && courseById(e.courseId).level === c.level - 1);
    return { done, act, prevOk };
  }

  // ---------- login ----------
  function renderLogin(msg) {
    $app.innerHTML = `<div class="auth"><div class="auth-art">
      <div class="orb" style="width:340px;height:340px;right:-80px;top:-60px;background:radial-gradient(circle,#2f6bff,transparent 70%)"></div>
      <div style="position:relative">${brand('Academy Admin')}</div>
      <div style="position:relative"><div class="eyebrow" style="color:#7cc4f8;margin-bottom:14px">Manager area</div><h1>Build a<br>great team.</h1><p style="margin-top:18px">Create access codes, follow progress across positions and levels, and review answers.</p></div><div></div></div>
      <div class="auth-form"><form class="auth-card" id="lf"><div class="eyebrow">Admin</div><h2>Sign in</h2>
        <label class="field"><span>Password</span><input type="password" id="pw" autocomplete="current-password"></label>
        <button class="btn lg block" id="go">Sign in</button><p class="err" id="err">${esc(msg || '')}</p></form></div></div>`;
    document.getElementById('pw').focus();
    document.getElementById('lf').onsubmit = async e => {
      e.preventDefault(); const b = document.getElementById('go'); b.disabled = true;
      try { const r = await rpc('admin_login', { p_password: document.getElementById('pw').value }); if (r.error) throw new Error(r.error); token = r.token; store.set(TOKEN_KEY, token); await load(); }
      catch (err) { if (err.message !== '401') document.getElementById('err').textContent = err.message; b.disabled = false; }
    };
  }

  async function load() { data = await api('admin_overview'); render(); }
  function render() {
    if (view.person && !data.people.some(p => p.id === view.person)) view.person = null;
    if (view.tab === 'courses') renderCourses(); else if (view.person) renderPerson(); else renderTeam();
  }

  function header() {
    return `<header class="header">${brand('Academy Admin')}
      <nav class="tabs"><button class="tab ${view.tab === 'team' ? 'on' : ''}" data-tab="team">Team</button><button class="tab ${view.tab === 'courses' ? 'on' : ''}" data-tab="courses">Courses</button></nav>
      <div class="spacer"></div>
      <button class="btn ghost sm hide-sm" id="pwchange">Password</button><button class="btn ghost sm" id="refresh">Refresh</button><button class="btn ghost sm" id="out">Sign out</button></header>`;
  }
  function bindHeader() {
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { view.tab = b.dataset.tab; view.person = null; render(); });
    document.getElementById('refresh').onclick = () => load().then(() => toast('Updated'));
    document.getElementById('out').onclick = async () => { await rpc('admin_logout', { p_token: token }).catch(() => {}); token = null; store.del(TOKEN_KEY); renderLogin(); };
    document.getElementById('pwchange').onclick = () => {
      const m = modal(`<h2 style="font-size:22px">Change admin password</h2><label class="field"><span>New password (min. 8 characters)</span><input type="password" id="np"></label><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-n>Cancel</button><button class="btn" data-y>Save</button></div>`);
      m.querySelector('[data-n]').onclick = () => m.remove();
      m.querySelector('[data-y]').onclick = async () => { try { await api('admin_change_password', { p_new: m.querySelector('#np').value }); m.remove(); toast('Password changed'); } catch (e) { if (e.message !== '401') toast(e.message); } };
    };
  }

  // ---------- team ----------
  function renderTeam() {
    const P = data.people;
    const enr = allEnrollments();
    const reviews = P.reduce((n, p) => n + reviewCount(p), 0);
    let list = P.filter(p => (view.filter === 'all' || (view.filter === 'review' ? reviewCount(p) > 0 : p.position === view.filter)) && (!view.q || p.name.toLowerCase().includes(view.q.toLowerCase())));
    $app.innerHTML = header() + `<main class="page">
      <div class="row wrap"><div><div class="eyebrow">Team</div><h1 style="margin:6px 0 0">Your team</h1></div><div class="spacer"></div><button class="btn" id="add">${icon('plus')} Add team member</button></div>
      <div class="stats">
        <div class="card stat"><b>${P.length}</b><span>Team members</span></div>
        <div class="card stat"><b>${enr.filter(e => e.status === 'active').length}</b><span>Courses in progress</span></div>
        <div class="card stat"><b>${enr.filter(e => e.status === 'completed').length}</b><span>Levels completed</span></div>
        <div class="card stat"><b style="color:${reviews ? 'var(--warn)' : 'inherit'}">${reviews}</b><span>Answers to review</span></div>
      </div>
      <div class="toolbar"><div class="seg">${[['all', 'All'], ['review', 'Needs review'], ...CAT.positions.map(p => [p.id, p.title])].map(([k, l]) => `<button class="${view.filter === k ? 'on' : ''}" data-f="${k}">${esc(l)}</button>`).join('')}</div><div class="spacer"></div><input type="search" id="q" placeholder="Search name…" value="${esc(view.q)}"></div>
      <div class="card" style="padding:0;overflow-x:auto">${list.length ? `<table><thead><tr><th>Member</th><th>Position</th><th>Levels</th><th style="min-width:200px">Current course</th><th>Code</th><th>Review</th><th class="hide-sm">Last activity</th></tr></thead><tbody>
        ${list.map(p => { const a = activeEnr(p); const c = a && courseById(a.courseId); const rc = reviewCount(p);
          return `<tr class="click" data-id="${p.id}">
            <td><div class="row" style="gap:10px"><div class="avatar">${esc(initials(p.name))}</div><strong>${esc(p.name)}</strong></div></td>
            <td>${esc(pos(p.position).title)}</td>
            <td><span class="lvl-dots">${coursesOf(p.position).map(cc => { const s = levelState(p, cc); return `<i class="${s.done ? 'done' : s.act ? 'cur' : ''}" title="Level ${cc.level}"></i>`; }).join('')}</span></td>
            <td>${a ? `<div class="small"><strong>L${c.level}</strong> ${esc(c.title)}</div><div class="row" style="gap:8px;margin-top:6px"><div class="bar" style="flex:1"><i style="width:${a.overall.percent}%"></i></div><span class="tiny muted">${a.overall.percent}%</span></div>` : '<span class="muted small">–</span>'}</td>
            <td>${a ? `<span class="code">${esc(a.code)}</span>` : '<span class="muted small">–</span>'}</td>
            <td>${rc ? `<span class="pill warn">${rc} to review</span>` : '<span class="muted small">–</span>'}</td>
            <td class="hide-sm muted small">${date(lastActivity(p))}</td></tr>`; }).join('')}</tbody></table>`
        : `<div class="empty">${P.length ? 'Nobody matches this filter.' : `<h3>No team members yet</h3><p>Add your first team member to create their Level 1 access code.</p><button class="btn" id="add2">${icon('plus')} Add team member</button>`}</div>`}</div>
    </main>`;
    bindHeader();
    document.getElementById('add').onclick = () => personModal();
    const a2 = document.getElementById('add2'); if (a2) a2.onclick = () => personModal();
    document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { view.filter = b.dataset.f; renderTeam(); });
    const q = document.getElementById('q'); q.oninput = () => { view.q = q.value; const pos_ = q.selectionStart; renderTeam(); const n = document.getElementById('q'); n.focus(); n.setSelectionRange(pos_, pos_); };
    document.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => { view.person = tr.dataset.id; render(); window.scrollTo(0, 0); });
  }

  function personModal(p) {
    const m = modal(`<h2 style="font-size:22px">${p ? 'Edit team member' : 'Add team member'}</h2>
      <label class="field"><span>Name</span><input type="text" id="pn" value="${esc(p ? p.name : '')}" placeholder="First and last name"></label>
      <label class="field"><span>Position</span><select id="pp">${CAT.positions.map(x => `<option value="${x.id}" ${p && p.position === x.id ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></label>
      ${p ? '' : '<label class="row small" style="margin:6px 0 4px;gap:8px"><input type="checkbox" id="pc" checked> Create the Level 1 access code right away</label>'}
      <div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn ghost" data-n>Cancel</button><button class="btn" data-y>${p ? 'Save' : 'Add'}</button></div>`);
    m.querySelector('#pn').focus();
    m.querySelector('[data-n]').onclick = () => m.remove();
    m.querySelector('[data-y]').onclick = async e => {
      e.target.disabled = true;
      try {
        const r = await api('admin_person_save', { p_id: p ? p.id : null, p_name: m.querySelector('#pn').value, p_position: m.querySelector('#pp').value });
        let enr = null;
        if (!p && m.querySelector('#pc').checked) { const c1 = coursesOf(m.querySelector('#pp').value)[0]; enr = await api('admin_enroll', { p_person: r.id, p_course: c1.id, p_force: false }); }
        m.remove(); await load();
        if (!p) { view.person = r.id; render(); }
        if (enr) showCode(enr.name, enr.code, enr.courseId);
      } catch (err) { if (err.message !== '401') { toast(err.message); e.target.disabled = false; } }
    };
  }

  function showCode(name, code, courseId) {
    const c = courseById(courseId) || {};
    const link = location.href.replace(/admin\.html.*$/, '').replace(/#.*$/, '');
    const msg = `Hi ${name}! Here is your access to the ${CFG.STUDIO_NAME} Academy – Level ${c.level}: ${c.title}.\n\n${link}\nAccess code: ${code}\n\nThe code works until you complete the course. Have fun!`;
    const m = modal(`<div class="eyebrow">Level ${c.level} · ${esc(c.title)}</div><h2 style="font-size:22px;margin-top:6px">Access code for ${esc(name)}</h2>
      <div style="text-align:center;margin:22px 0"><span class="code" style="font-size:28px;padding:10px 18px">${esc(code)}</span></div>
      <p class="muted small">${esc(name)} signs in at <strong>${esc(link)}</strong>. The code expires automatically when the course is completed.</p>
      <div class="row" style="justify-content:flex-end;margin-top:18px"><button class="btn ghost" data-copy>${icon('copy', 16)} Copy message</button><button class="btn" data-close>Done</button></div>`);
    m.querySelector('[data-close]').onclick = () => m.remove();
    m.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(msg); toast('Message copied – paste it into WhatsApp, SMS or email'); } catch (_) { toast('Copy not available – please write the code down.'); } };
  }

  // ---------- person ----------
  function renderPerson() {
    const p = data.people.find(x => x.id === view.person);
    const levels = coursesOf(p.position);
    $app.innerHTML = header() + `<main class="page">
      <button class="back" id="bk">${icon('back', 16)} Team</button>
      <div class="card row wrap" style="gap:18px">
        <div class="avatar lg">${esc(initials(p.name))}</div>
        <div style="flex:1;min-width:200px"><h1 style="margin:0 0 4px;font-size:28px">${esc(p.name)}</h1><div class="row" style="gap:8px"><span class="pill blue">${esc(pos(p.position).title)}</span><span class="tiny muted">Added ${date(p.createdAt)}</span></div></div>
        <button class="btn ghost sm" id="edit">${icon('edit', 15)} Edit</button><button class="btn danger sm" id="del">${icon('trash', 15)} Delete</button>
      </div>
      <h2 style="margin:30px 0 14px">Learning path</h2>
      <div class="grid c3">${levels.map(c => { const s = levelState(p, c);
        const status = s.done ? `<span class="pill ok">${icon('check', 13)} Completed ${date(s.done.completedAt)}</span>` : s.act ? `<span class="pill blue">In progress · ${s.act.overall.percent}%</span>` : s.prevOk ? '<span class="pill gold">Ready</span>' : `<span class="pill">${icon('lock', 12)} Locked</span>`;
        const actions = s.act ? `<div class="row wrap" style="gap:8px;margin-top:14px"><span class="code">${esc(s.act.code)}</span><div class="spacer"></div><button class="btn soft sm" data-show="${s.act.id}">Share</button><button class="btn ghost sm" data-act="newcode" data-e="${s.act.id}">New code</button><button class="btn ghost sm" data-act="revoke" data-e="${s.act.id}">Deactivate</button></div>`
          : s.done ? `<div class="row" style="margin-top:14px"><button class="btn ghost sm" data-enroll="${c.id}" data-force="1">Repeat level</button></div>`
          : s.prevOk ? `<div class="row" style="margin-top:14px"><button class="btn sm" data-enroll="${c.id}">${icon('plus', 15)} Create access code</button></div>`
          : `<div class="row" style="margin-top:14px"><span class="tiny muted">Unlocks after Level ${c.level - 1}</span><div class="spacer"></div><button class="btn ghost sm" data-enroll="${c.id}" data-force="1">Unlock anyway</button></div>`;
        return `<div class="card" style="padding:20px"><div class="row"><span class="eyebrow">Level ${c.level} · ${esc(CAT.levels[c.level])}</span></div><h3 style="margin:8px 0 6px">${esc(c.title)}</h3>${status}${s.act ? `<div class="bar" style="margin-top:12px"><i style="width:${s.act.overall.percent}%"></i></div>` : ''}${actions}</div>`; }).join('')}</div>
      <h2 style="margin:34px 0 6px">Course history & answers</h2>
      ${p.enrollments.length ? p.enrollments.map(e => enrollHtml(p, e)).join('') : '<div class="card empty">No courses yet. Create a Level 1 access code above.</div>'}
    </main>`;
    bindHeader();
    document.getElementById('bk').onclick = () => { view.person = null; render(); };
    document.getElementById('edit').onclick = () => personModal(p);
    document.getElementById('del').onclick = async () => { if (await confirmBox('Delete team member?', `${p.name}, all their courses and answers will be deleted permanently.`, 'Delete', true)) { await api('admin_person_delete', { p_id: p.id }); view.person = null; await load(); toast('Deleted'); } };
    document.querySelectorAll('[data-enroll]').forEach(b => b.onclick = async () => {
      const c = courseById(b.dataset.enroll); const force = !!b.dataset.force;
      if (force && !(await confirmBox(`Create a Level ${c.level} code?`, `${p.name} gets a new access code for “${c.title}”.`, 'Create code'))) return;
      try { const r = await api('admin_enroll', { p_person: p.id, p_course: c.id, p_force: force }); await load(); showCode(r.name, r.code, r.courseId); } catch (e) { if (e.message !== '401') toast(e.message); }
    });
    document.querySelectorAll('[data-show]').forEach(b => b.onclick = () => { const e = p.enrollments.find(x => x.id === b.dataset.show); showCode(p.name, e.code, e.courseId); });
    document.querySelectorAll('[data-act]').forEach(b => b.onclick = () => enrollAction(p, b.dataset.e, b.dataset.act));
    document.querySelectorAll('.enroll-head').forEach(h => h.onclick = () => { view.open[h.dataset.id] = !view.open[h.dataset.id]; renderPerson(); });
    document.querySelectorAll('[data-audio] [data-play]').forEach(b => b.onclick = () => playAudio(b));
    document.querySelectorAll('form.rv').forEach(f => f.onsubmit = async ev => {
      ev.preventDefault();
      try { await api('admin_review', { p_answer: f.dataset.a, p_status: ev.submitter ? ev.submitter.value : 'passed', p_score: f.score.value === '' ? null : +f.score.value, p_comment: f.comment.value }); await load(); toast('Review saved'); }
      catch (e) { if (e.message !== '401') toast(e.message); }
    });
  }

  function enrollHtml(p, e) {
    const c = courseById(e.courseId) || { title: e.courseId, modules: [] };
    const open = view.open[e.id] ?? (e.status === 'active' || e.answers.some(needsReview));
    const st = { active: '<span class="pill blue">In progress</span>', completed: '<span class="pill ok">Completed</span>', revoked: '<span class="pill">Deactivated</span>' }[e.status];
    const rc = e.answers.filter(needsReview).length;
    return `<div class="enroll"><div class="enroll-head" data-id="${e.id}">
        <div class="ring light ${e.status === 'completed' ? 'ok' : ''}" style="--p:${e.overall.percent};--s:52px"><b style="font-size:13px">${e.overall.percent}%</b></div>
        <div style="flex:1;min-width:0"><div class="eyebrow">Level ${c.level} · Code ${esc(e.code)}</div><strong>${esc(c.title)}</strong><div class="tiny muted">Started ${date(e.startedAt)} · Last login ${date(e.lastLoginAt)}${e.completedAt ? ' · Finished ' + date(e.completedAt) : ''}</div></div>
        ${rc ? `<span class="pill warn">${rc} to review</span>` : ''}${st}<span style="transform:rotate(${open ? 180 : 0}deg);transition:.2s;color:var(--muted)">${icon('chev')}</span></div>
      ${open ? `<div class="enroll-body">
        <div class="row wrap" style="gap:8px;margin:14px 0">${e.status === 'active' ? `<button class="btn ghost sm" data-act="revoke" data-e="${e.id}">Deactivate</button>` : `<button class="btn ghost sm" data-act="reactivate" data-e="${e.id}">Reactivate code</button>`}<button class="btn ghost sm" data-act="delete" data-e="${e.id}">${icon('trash', 14)} Delete course record</button></div>
        <div class="grid c3">${c.modules.map(m => { const s = e.overall.per.find(x => x.id === m.id) || { done: 0, total: 1 }; const q = e.progress.modules[m.id] && e.progress.modules[m.id].quiz;
          return `<div class="lvl-card" style="margin:0"><div class="row"><strong class="small">${esc(m.title)}</strong><div class="spacer"></div>${s.complete ? '<span class="pill ok">Done</span>' : `<span class="tiny muted">${s.done}/${s.total}</span>`}</div>${m.quiz ? `<div class="tiny muted" style="margin-top:6px">Quiz: ${q && q.attempts ? `best ${q.best}% · ${q.attempts} attempt${q.attempts > 1 ? 's' : ''}` : 'not taken'}</div>` : ''}${m.type === 'video' ? `<div class="tiny muted" style="margin-top:6px">${m.videos.map(v => (e.progress.watched[v.id] ? '✓ ' : '○ ') + esc(v.title)).join('<br>')}</div>` : ''}</div>`; }).join('')}</div>
        ${c.modules.filter(m => m.type === 'video').flatMap(m => m.videos.flatMap(v => v.prompts.map(pr => answerHtml(e, v, pr)))).join('')}
      </div>` : ''}</div>`;
  }

  function answerHtml(e, v, pr) {
    const a = e.answers.find(x => x.videoId === v.id && x.promptId === pr.id);
    const kp = ((data.keyPoints || {})[e.courseId] || {})[v.id] || {};
    const points = (kp[pr.id] || []);
    const hits = a && a.auto ? a.auto.points : null;
    const state = !a ? '<span class="pill">Not answered</span>' : a.review ? `<span class="pill ${a.review.status === 'passed' ? 'ok' : 'bad'}">${a.review.status === 'passed' ? 'Approved' : 'Rework'}${a.review.score != null ? ' · ' + a.review.score + '%' : ''}</span>` : a.auto ? `<span class="pill ${a.auto.passed ? 'ok' : 'warn'}">Auto ${a.auto.score}% ${a.auto.passed ? '· accepted' : '· below pass'}</span>` : '<span class="pill warn">Voice memo · review</span>';
    return `<div class="ans"><div class="row wrap"><span class="pill blue">${icon('video', 13)} ${esc(v.title)}</span><div class="spacer"></div>${state}</div>
      <h3 style="margin:12px 0 6px">${esc(pr.question)}</h3>
      <ul class="kp">${points.map((k, i) => { const h = hits ? hits[i] && hits[i].hit : null; return `<li class="${h ? 'hit' : ''}"><b>${h === null ? '•' : h ? '✓' : '✗'}</b>${esc(k.point)}</li>`; }).join('')}</ul>
      ${a ? `${a.text ? `<blockquote>${esc(a.text)}</blockquote>` : '<p class="muted small">(No text – voice memo only)</p>'}
        ${a.hasAudio ? `<div data-audio="${a.id}" style="margin:8px 0"><button class="btn ghost sm" data-play>${icon('play', 14)} Play voice memo</button></div>` : ''}
        <div class="tiny muted">Submitted ${date(a.submittedAt)}</div>
        <form class="rv" data-a="${a.id}" style="display:grid;grid-template-columns:110px 1fr;gap:12px;align-items:end;border-top:1px solid var(--line);padding-top:14px;margin-top:14px">
          <label class="field" style="margin:0"><span>Score %</span><input type="number" min="0" max="100" name="score" value="${a.review && a.review.score != null ? a.review.score : a.auto ? a.auto.score : ''}"></label>
          <label class="field" style="margin:0"><span>Feedback for the team member (optional)</span><input type="text" name="comment" value="${esc(a.review ? a.review.comment : '')}"></label>
          <div class="row" style="grid-column:1/-1;justify-content:flex-end"><button class="btn danger sm" name="s" value="rework">Needs rework</button><button class="btn ok sm" name="s" value="passed">Approve</button></div>
        </form>` : ''}</div>`;
  }

  async function playAudio(b) {
    const box = b.parentElement; b.disabled = true; b.textContent = 'Loading…';
    try {
      const a = await api('admin_audio', { p_answer: box.dataset.audio });
      const bin = atob(a.audio); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const el = document.createElement('audio'); el.controls = true; el.src = URL.createObjectURL(new Blob([bytes], { type: a.mime || 'audio/webm' }));
      b.replaceWith(el); el.play().catch(() => {});
    } catch (e) { if (e.message !== '401') { toast(e.message); b.disabled = false; b.textContent = 'Play voice memo'; } }
  }

  async function enrollAction(p, id, a) {
    const e = p.enrollments.find(x => x.id === id); const c = courseById(e.courseId) || {};
    const t = {
      revoke: ['Deactivate this code?', `${p.name} can no longer sign in to “${c.title}”. Progress is kept.`, 'Deactivate', true],
      reactivate: ['Reactivate this code?', `${p.name} can sign in to “${c.title}” again with code ${e.code}.`, 'Reactivate', false],
      newcode: ['Create a new code?', `The old code ${e.code} stops working. Progress is kept.`, 'New code', false],
      delete: ['Delete this course record?', `All progress and answers of “${c.title}” for ${p.name} will be deleted.`, 'Delete', true],
    }[a];
    if (!(await confirmBox(...t))) return;
    try {
      await api('admin_enrollment_action', { p_id: id, p_action: a }); await load();
      if (a === 'newcode' || a === 'reactivate') { const pe = data.people.find(x => x.id === p.id).enrollments.find(x => x.id === id); showCode(p.name, pe.code, pe.courseId); } else toast('Done');
    } catch (err) { if (err.message !== '401') toast(err.message); }
  }

  // ---------- courses ----------
  function renderCourses() {
    $app.innerHTML = header() + `<main class="page">
      <div class="eyebrow">Catalog</div><h1 style="margin:6px 0 4px">Courses</h1><p class="muted">Three levels per position. Quizzes need ${data.passMark}%, free answers need ${data.answerPass}% of the key points (automatic check, you can override).</p>
      <div class="grid c3" style="margin-top:22px;align-items:start">${CAT.positions.map(p => `<div class="course-col">
        <div class="card" style="padding:20px;margin-bottom:12px;background:linear-gradient(135deg,#0d1d36,#0a1626);color:#fff;border:0"><h3 style="color:#fff;margin:0 0 4px">${esc(p.title)}</h3><div style="color:rgba(255,255,255,.65);font-size:14px">${esc(p.description)}</div></div>
        ${coursesOf(p.id).map(c => `<div class="lvl-card"><div class="row"><span class="eyebrow">Level ${c.level} · ${esc(CAT.levels[c.level])}</span><div class="spacer"></div><span class="tiny muted">~${c.minutes} min</span></div>
          <h3 style="margin:8px 0 4px">${esc(c.title)}</h3><div class="small muted">${esc(c.summary)}</div>
          <ul>${c.modules.map(m => `<li>${esc(m.title)} <span class="tiny">(${m.type === 'video' ? m.videos.length + ' video · ' + m.videos.reduce((n, v) => n + v.prompts.length, 0) + ' free answers' : [m.lessons.length ? m.lessons.length + ' lessons' : '', m.quiz ? m.quiz.length + ' questions' : ''].filter(Boolean).join(' · ')})</span></li>`).join('')}</ul></div>`).join('')}
      </div>`).join('')}</div></main>`;
    bindHeader();
  }

  if (token) load().catch(e => { if (e.message !== '401') renderLogin(e.message); }); else renderLogin();
})();
