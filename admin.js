// EMS Trainer Academy – admin dashboard
(function () {
  const $app = document.getElementById('app');
  let data = null, view = { page: 'list', id: null, filter: 'all' };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const date = iso => iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–';

  const CFG = window.CONFIG || {};
  const TOKEN_KEY = 'csacademy_admin';
  let token = store.get(TOKEN_KEY);
  async function api(fn, args) {
    try { return await rpc(fn, { p_token: token, ...(args || {}) }); }
    catch (e) {
      if (e.code === 'ADMIN_SESSION_ENDED') { token = null; store.del(TOKEN_KEY); renderLogin('Please sign in again.'); throw new Error('401'); }
      throw e;
    }
  }
  const brand = sub => `<div class="brand">${CFG.LOGO ? `<img class="brand-logo" src="${esc(CFG.LOGO)}" alt="${esc(CFG.STUDIO_NAME)}" onerror="this.replaceWith(Object.assign(document.createElement('b'),{className:'brand-text',textContent:'${esc(CFG.STUDIO_NAME)}'}))">` : `<b class="brand-text">${esc(CFG.STUDIO_NAME)}</b>`}<div class="brand-sub">${sub}<small>${esc(CFG.STUDIO_LOCATION || '')}</small></div></div>`;
  function toast(msg) { document.querySelectorAll('.toast').forEach(x => x.remove()); const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
  function modal(html) {
    const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="card">${html}</div>`;
    m.onclick = e => { if (e.target === m) m.remove(); };
    document.body.appendChild(m); return m;
  }
  function confirmBox(title, text, okLabel, danger) {
    return new Promise(res => {
      const m = modal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="actions"><button class="btn ghost" data-n>Cancel</button><button class="btn ${danger ? 'danger' : ''}" data-y>${esc(okLabel)}</button></div>`);
      m.querySelector('[data-n]').onclick = () => { m.remove(); res(false); };
      m.querySelector('[data-y]').onclick = () => { m.remove(); res(true); };
    });
  }

  const pending = e => e.responses.filter(r => !r.review).length;
  const allPrompts = () => data.course.modules.flatMap(m => (m.videos || []).flatMap(v => v.prompts.map(p => ({ v, p }))));
  function statusPill(e) {
    if (e.status === 'completed') return '<span class="pill ok">Completed</span>';
    if (e.status === 'revoked') return '<span class="pill bad">Deactivated</span>';
    if (!e.startedAt) return '<span class="pill">Not started</span>';
    return '<span class="pill blue">In progress</span>';
  }
  function reviewPill(e) {
    const n = pending(e), total = e.responses.length;
    if (!total) return '<span class="fine">–</span>';
    if (n) return `<span class="pill warn">${n} to review</span>`;
    const rework = e.responses.filter(r => r.review && r.review.status === 'rework').length;
    return rework ? `<span class="pill bad">${rework} rework</span>` : '<span class="pill ok">All passed</span>';
  }

  // ---------- login ----------
  function renderLogin(msg) {
    $app.innerHTML = `<div class="login"><form class="card" id="lf">
      <div class="login-brand">${brand('Academy Admin')}</div>
      <h2>Admin sign in</h2>
      <label class="field"><span>Password</span><input type="password" id="pw" autocomplete="current-password"></label>
      <button class="btn" style="width:100%">Sign in</button>
      <p class="err" id="err">${esc(msg || '')}</p>
    </form></div>`;
    document.getElementById('pw').focus();
    document.getElementById('lf').onsubmit = async e => {
      e.preventDefault();
      try { const r = await rpc('admin_login', { p_password: document.getElementById('pw').value }); if (r.error) throw new Error(r.error); token = r.token; store.set(TOKEN_KEY, token); await load(); }
      catch (err) { if (err.message !== '401') document.getElementById('err').textContent = err.message; }
    };
  }

  async function load() {
    const d = await api('admin_overview');
    data = { ...d, studioName: CFG.STUDIO_NAME, course: window.COURSE };
    // attach grading key points to the course prompts
    data.course = { modules: window.COURSE.modules.map(m => m.videos ? { ...m, videos: m.videos.map(v => ({ ...v, prompts: v.prompts.map(p => ({ ...p, keyPoints: ((d.keyPoints || {})[v.id] || {})[p.id] || [] })) })) } : m) };
    render();
  }

  function topbar() {
    return `<div class="topbar">
      ${brand('Academy Admin')}
      <div class="spacer"></div>
      <button class="btn ghost sm hide-sm" id="pwchange">Password</button>
      <button class="btn ghost sm" id="refresh">Refresh</button>
      <button class="btn ghost sm" id="out">Sign out</button>
    </div>`;
  }
  function bindTop() {
    document.getElementById('refresh').onclick = () => load().then(() => toast('Updated'));
    document.getElementById('out').onclick = async () => { await rpc('admin_logout', { p_token: token }).catch(() => {}); token = null; store.del(TOKEN_KEY); renderLogin(); };
    document.getElementById('pwchange').onclick = () => {
      const m = modal(`<h3>Change admin password</h3><label class="field"><span>New password (min. 8 characters)</span><input type="password" id="np"></label><div class="actions"><button class="btn ghost" data-n>Cancel</button><button class="btn" data-y>Save</button></div>`);
      m.querySelector('[data-n]').onclick = () => m.remove();
      m.querySelector('[data-y]').onclick = async () => { try { await api('admin_change_password', { p_new: m.querySelector('#np').value }); m.remove(); toast('Password changed'); } catch (e) { if (e.message !== '401') toast(e.message); } };
    };
  }
  function render() { view.page === 'detail' && data.employees.some(e => e.id === view.id) ? renderDetail() : renderList(); }

  // ---------- list ----------
  function renderList() {
    view.page = 'list';
    const E = data.employees;
    const list = E.filter(e => view.filter === 'all' || (view.filter === 'review' && pending(e)) || (view.filter === 'active' && e.status === 'active') || (view.filter === 'completed' && e.status === 'completed'))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    $app.innerHTML = topbar() + `<div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:18px">
        <h1 style="margin:0">Trainees</h1>
        <form id="add" style="display:flex;gap:8px"><input type="text" id="name" placeholder="Name of new trainee" style="width:240px"><button class="btn">Create access code</button></form>
      </div>
      <div class="stats">
        <div class="card stat"><b>${E.length}</b><span>Trainees</span></div>
        <div class="card stat"><b>${E.filter(e => e.status === 'active' && e.startedAt).length}</b><span>In progress</span></div>
        <div class="card stat"><b>${E.filter(e => e.status === 'completed').length}</b><span>Completed</span></div>
        <div class="card stat"><b style="color:${E.reduce((a, e) => a + pending(e), 0) ? 'var(--warn)' : 'inherit'}">${E.reduce((a, e) => a + pending(e), 0)}</b><span>Answers to review</span></div>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        ${[['all', 'All'], ['review', 'Needs review'], ['active', 'Active'], ['completed', 'Completed']].map(([k, l]) => `<button class="btn sm ${view.filter === k ? '' : 'ghost'}" data-f="${k}">${l}</button>`).join('')}
      </div>
      <div class="card" style="padding:0;overflow-x:auto">
        ${list.length ? `<table><thead><tr><th>Name</th><th>Access code</th><th>Status</th><th style="width:160px">Progress</th><th>Quizzes</th><th>Answers</th><th>Last activity</th></tr></thead><tbody>
        ${list.map(e => `<tr class="click" data-id="${e.id}">
          <td><strong>${esc(e.name)}</strong></td>
          <td><span class="code">${esc(e.code)}</span></td>
          <td>${statusPill(e)}</td>
          <td><div style="display:flex;align-items:center;gap:8px"><div class="bar" style="flex:1"><i style="width:${e.overall.percent}%"></i></div><span class="fine">${e.overall.percent}%</span></div></td>
          <td>${data.course.modules.filter(m => m.quiz).map(m => { const q = e.progress.modules[m.id] && e.progress.modules[m.id].quiz; return `<span class="pill ${q && q.passedAt ? 'ok' : q && q.attempts ? 'warn' : ''}" title="${esc(m.title)}">${q && q.attempts ? q.best + '%' : '–'}</span>`; }).join(' ')}</td>
          <td>${reviewPill(e)}</td>
          <td class="fine">${date(e.completedAt || e.lastLoginAt || e.createdAt)}</td>
        </tr>`).join('')}</tbody></table>` : `<p style="padding:24px;margin:0" class="fine">${E.length ? 'No trainees match this filter.' : 'No trainees yet. Enter a name above to create the first access code.'}</p>`}
      </div>
    </div>`;
    bindTop();
    document.getElementById('add').onsubmit = async ev => {
      ev.preventDefault();
      const name = document.getElementById('name').value.trim(); if (!name) return toast('Please enter a name.');
      try { const r = await api('admin_create', { p_name: name }); await load(); showCode(r); } catch (e) { if (e.message !== '401') toast(e.message); }
    };
    document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { view.filter = b.dataset.f; renderList(); });
    document.querySelectorAll('tr.click').forEach(tr => tr.onclick = () => { view = { ...view, page: 'detail', id: tr.dataset.id }; renderDetail(); window.scrollTo(0, 0); });
  }

  function showCode(e) {
    const link = location.href.replace(/admin\.html.*$/, '').replace(/#.*$/, '');
    const msg = `Hi ${e.name}, here is your access to the ${CFG.STUDIO_NAME} Coach Academy:\n${link}\nAccess code: ${e.code}\nThe code works until you finish the training.`;
    const m = modal(`<h3>Access code for ${esc(e.name)}</h3>
      <p style="text-align:center;margin:18px 0"><span class="code" style="font-size:26px;padding:8px 16px">${esc(e.code)}</span></p>
      <p class="fine">Give this code to ${esc(e.name)}. They sign in at <strong>${esc(link)}</strong>. The code stops working automatically once the training is complete.</p>
      <div class="actions"><button class="btn ghost" data-copy>Copy message</button><button class="btn" data-close>Done</button></div>`);
    m.querySelector('[data-close]').onclick = () => m.remove();
    m.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(msg); toast('Message copied'); } catch (_) { toast('Copy not available – please write the code down.'); } };
  }

  // ---------- detail ----------
  function renderDetail() {
    const e = data.employees.find(x => x.id === view.id);
    const mods = data.course.modules;
    $app.innerHTML = topbar() + `<div class="wrap">
      <button class="back" id="bk"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg> All trainees</button>
      <div class="card" style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
        <div><h1 style="margin:0 0 6px">${esc(e.name)}</h1>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">${statusPill(e)} <span class="code">${esc(e.code)}</span>
          <span class="fine">Created ${date(e.createdAt)} · Started ${date(e.startedAt)} · Finished ${date(e.completedAt)}</span></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${e.status === 'active' ? `<button class="btn ghost sm" data-a="showcode">Show code</button><button class="btn ghost sm" data-a="revoke">Deactivate</button>` : `<button class="btn ghost sm" data-a="reactivate">Reactivate access</button>`}
          <button class="btn ghost sm" data-a="newcode">New code</button>
          <button class="btn danger sm" data-a="delete">Delete</button>
        </div>
      </div>
      <div class="grid cols" style="margin-bottom:16px">
        ${mods.map((m, i) => { const st = e.overall.per.find(p => p.id === m.id); const mp = e.progress.modules[m.id];
          let detail;
          if (m.type === 'video') detail = m.videos.map(v => `${e.progress.watched[v.id] ? '✓' : '○'} ${esc(v.title)}`).join('<br>');
          else detail = `Lessons read: ${mp ? mp.lessonsRead.length : 0} / ${m.lessons.length}<br>Quiz: ${mp && mp.quiz.attempts ? `best ${mp.quiz.best}% · ${mp.quiz.attempts} attempt${mp.quiz.attempts > 1 ? 's' : ''}${mp.quiz.passedAt ? ' · passed' : ''}` : 'not taken'}`;
          return `<div class="card"><div class="fine" style="font-weight:700;text-transform:uppercase;font-size:12px;letter-spacing:.06em">Module ${i + 1}</div><h3 style="margin:2px 0 8px">${esc(m.title)} ${st.complete ? '<span class="pill ok">Done</span>' : ''}</h3>
            <div class="bar" style="margin-bottom:10px"><i style="width:${Math.round(st.done / st.total * 100)}%"></i></div><div class="fine">${detail}</div></div>`; }).join('')}
      </div>
      <h2>Written & spoken answers</h2>
      ${allPrompts().map(({ v, p }) => {
        const r = e.responses.find(x => x.videoId === v.id && x.promptId === p.id);
        return `<div class="resp">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span class="pill blue">${esc(v.title)}</span>${r ? (r.review ? `<span class="pill ${r.review.status === 'passed' ? 'ok' : 'bad'}">${r.review.status === 'passed' ? 'Passed' : 'Needs rework'}${r.review.score != null ? ' · ' + r.review.score + '%' : ''}</span>` : '<span class="pill warn">Waiting for review</span>') : '<span class="pill">Not answered yet</span>'}</div>
          <h3 style="margin:10px 0 4px">${esc(p.question)}</h3>
          <details><summary class="fine" style="cursor:pointer">Key points to look for</summary><ul class="kp">${p.keyPoints.map(k => `<li>${esc(k)}</li>`).join('')}</ul></details>
          ${r ? `
            ${r.text ? `<blockquote>${esc(r.text)}</blockquote>` : '<p class="fine">(No text, voice memo only)</p>'}
            ${r.hasAudio ? `<div style="margin:8px 0" data-audio="${r.id}"><span class="fine">Voice memo:</span><br><button class="btn ghost sm" data-play>▶ Load voice memo</button></div>` : ''}
            <p class="fine">Submitted ${date(r.submittedAt)}</p>
            <form class="rv" data-r="${r.id}" style="display:grid;grid-template-columns:120px 1fr;gap:10px;align-items:start;border-top:1px solid var(--line);padding-top:12px">
              <label class="field" style="margin:0"><span>Score (%)</span><input type="number" min="0" max="100" name="score" value="${r.review && r.review.score != null ? r.review.score : ''}"></label>
              <label class="field" style="margin:0"><span>Feedback (optional)</span><textarea name="comment" rows="2">${esc(r.review ? r.review.comment : '')}</textarea></label>
              <div class="actions" style="grid-column:1/-1;margin:0"><button class="btn danger sm" name="s" value="rework">Needs rework</button><button class="btn ok sm" name="s" value="passed">Passed</button></div>
            </form>` : ''}
        </div>`;
      }).join('')}
    </div>`;
    bindTop();
    document.getElementById('bk').onclick = () => { view.page = 'list'; renderList(); };
    document.querySelectorAll('[data-a]').forEach(b => b.onclick = () => action(e, b.dataset.a));
    document.querySelectorAll('[data-audio] [data-play]').forEach(b => b.onclick = async () => {
      const box = b.parentElement; b.disabled = true; b.textContent = 'Loading…';
      try {
        const a = await api('admin_audio', { p_response: box.dataset.audio });
        const bin = atob(a.audio); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const el = document.createElement('audio'); el.controls = true; el.src = URL.createObjectURL(new Blob([bytes], { type: a.mime || 'audio/webm' }));
        b.replaceWith(el); el.play().catch(() => {});
      } catch (err) { if (err.message !== '401') { toast(err.message); b.disabled = false; b.textContent = '▶ Load voice memo'; } }
    });
    document.querySelectorAll('form.rv').forEach(f => f.onsubmit = async ev => {
      ev.preventDefault();
      const status = ev.submitter ? ev.submitter.value : 'passed';
      try {
        await api('admin_review', { p_response: f.dataset.r, p_status: status, p_score: f.score.value === '' ? null : Number(f.score.value), p_comment: f.comment.value });
        await load(); toast('Review saved');
      } catch (err) { if (err.message !== '401') toast(err.message); }
    });
  }

  async function action(e, a) {
    if (a === 'showcode') return showCode(e);
    const texts = {
      revoke: ['Deactivate access?', `${e.name} will be signed out and can no longer use the code. You can reactivate it later.`, 'Deactivate', true],
      reactivate: ['Reactivate access?', `${e.name} can sign in again with code ${e.code}. Progress is kept.`, 'Reactivate', false],
      newcode: ['Create a new code?', `The old code ${e.code} stops working. Progress is kept.`, 'Create new code', false],
      delete: ['Delete trainee?', `${e.name} and all progress and answers will be deleted permanently.`, 'Delete', true],
    }[a];
    if (!(await confirmBox(...texts))) return;
    try {
      await api('admin_action', { p_id: e.id, p_action: a });
      if (a === 'delete') view.page = 'list';
      await load();
      if (a === 'newcode' || a === 'reactivate') showCode(data.employees.find(x => x.id === e.id));
      else toast('Done');
    } catch (err) { if (err.message !== '401') toast(err.message); }
  }

  if (token) load().catch(e => { if (e.message !== '401') renderLogin(e.message); }); else renderLogin();
})();
