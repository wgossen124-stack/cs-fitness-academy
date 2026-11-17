// Animated explainer scenes v2 – SVG + CSS, viewBox 800x450.
// Every scene is built from data in the catalog (title, caption and scene-specific fields).
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const d = s => `style="--d:${s}s"`;

  const defs = `
  <defs>
    <linearGradient id="gBlue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f8bff"/><stop offset="1" stop-color="#2563eb"/></linearGradient>
    <linearGradient id="gSky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a5dcff"/><stop offset="1" stop-color="#5fb3f6"/></linearGradient>
    <linearGradient id="gGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd76a"/><stop offset="1" stop-color="#f5a300"/></linearGradient>
    <linearGradient id="gMuscle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f07a7a"/><stop offset="1" stop-color="#c94545"/></linearGradient>
    <linearGradient id="gCard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2d52"/><stop offset="1" stop-color="#14223f"/></linearGradient>
    <linearGradient id="gWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset="1" stop-color="#2f8fe6"/></linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000" flood-opacity=".35"/></filter>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#ffffff" stroke-opacity=".04"/></pattern>
  </defs>`;

  const css = `
  <style>
    .a{animation-delay:var(--d,0s)!important}
    .in{opacity:0;animation:in .7s cubic-bezier(.2,.8,.2,1) forwards}
    .up{opacity:0;transform:translateY(18px);animation:up .8s cubic-bezier(.2,.8,.2,1) forwards}
    .left{opacity:0;transform:translateX(-24px);animation:left .8s cubic-bezier(.2,.8,.2,1) forwards}
    .right{opacity:0;transform:translateX(24px);animation:right .8s cubic-bezier(.2,.8,.2,1) forwards}
    .pop{transform-box:fill-box;transform-origin:center;transform:scale(0);animation:pop .6s cubic-bezier(.2,1.5,.4,1) forwards}
    .float{animation:float 4s ease-in-out infinite}
    .pulse{transform-box:fill-box;transform-origin:center;animation:pulse 1.6s ease-in-out infinite}
    .ring{transform-box:fill-box;transform-origin:center;animation:ring 2.2s ease-out infinite}
    .flex{transform-box:fill-box;transform-origin:center;animation:flex 1.8s ease-in-out infinite}
    .glowp{animation:glowp 1.8s ease-in-out infinite}
    .dash{stroke-dasharray:8 10;animation:dash 1.2s linear infinite}
    .draw{stroke-dasharray:1200;stroke-dashoffset:1200;animation:draw 2.2s cubic-bezier(.6,0,.2,1) forwards}
    .spark{transform-box:fill-box;transform-origin:center;animation:spark .9s ease-in-out infinite}
    .drop{animation:drop 1.2s ease-in infinite}
    .fill{transform-box:fill-box;transform-origin:bottom;transform:scaleY(0);animation:fill 3.5s cubic-bezier(.4,0,.2,1) forwards}
    .grow{transform-box:fill-box;transform-origin:bottom;transform:scaleY(0);animation:fill 1.4s cubic-bezier(.2,.8,.2,1) forwards}
    .growx{transform-box:fill-box;transform-origin:left;transform:scaleX(0);animation:growx 1.2s cubic-bezier(.2,.8,.2,1) forwards}
    .turn{transform-origin:400px 245px;transform:rotate(-135deg);animation:turn 5s cubic-bezier(.4,0,.2,1) forwards}
    .cyc{transform-box:fill-box;transform-origin:center;animation:cyc 8s steps(1) infinite}
    .head{animation:head 8s linear infinite}
    .type span{opacity:.3;animation:blink 1.2s infinite}
    @keyframes in{to{opacity:1}}
    @keyframes up{to{opacity:1;transform:none}}
    @keyframes left{to{opacity:1;transform:none}}
    @keyframes right{to{opacity:1;transform:none}}
    @keyframes pop{to{transform:scale(1)}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
    @keyframes pulse{50%{transform:scale(1.06)}}
    @keyframes ring{0%{transform:scale(.8);opacity:.7}100%{transform:scale(1.6);opacity:0}}
    @keyframes flex{0%,100%{transform:scale(1)}45%,60%{transform:scale(1.12,1.2)}}
    @keyframes glowp{0%,100%{opacity:.25}50%{opacity:.95}}
    @keyframes dash{to{stroke-dashoffset:-36}}
    @keyframes draw{to{stroke-dashoffset:0}}
    @keyframes spark{0%,100%{opacity:0;transform:scale(.5)}50%{opacity:1;transform:scale(1.1)}}
    @keyframes drop{0%{transform:translate(0,0);opacity:0}15%{opacity:1}100%{transform:translate(90px,60px);opacity:0}}
    @keyframes fill{to{transform:scale(1)}}
    @keyframes growx{to{transform:scale(1)}}
    @keyframes turn{to{transform:rotate(-15deg)}}
    @keyframes cyc{0%{transform:scale(1.16,1.24)}50%{transform:scale(1)}}
    @keyframes head{from{transform:translateX(0)}to{transform:translateX(480px)}}
    @keyframes blink{50%{opacity:1}}
  </style>`;

  const W = 800, H = 450;
  const svg = (inner) => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Inter,system-ui,-apple-system,Segoe UI,sans-serif">${defs}${css}<rect width="${W}" height="${H}" fill="url(#grid)"/>${inner}</svg>`;
  const bolt = (x, y, s = 1, cls = 'spark', delay = 0) => `<g transform="translate(${x} ${y}) scale(${s})"><path class="${cls} a" ${d(delay)} d="M6 -14 L-6 2 L1 2 L-4 14 L8 -3 L1 -3 Z" fill="url(#gGold)" filter="url(#glow)"/></g>`;
  const card = (x, y, w, h, r = 18, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#gCard)" stroke="#ffffff" stroke-opacity=".08" filter="url(#shadow)" ${extra}/>`;
  const label = (x, y, t, size = 16, fill = '#cfe0ff', w = 600, anchor = 'middle', cls = '', delay = 0) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${w}" fill="${fill}" class="${cls} a" ${d(delay)}>${esc(t)}</text>`;
  // wrap long text into lines of max n characters
  function wrap(t, n) { const words = String(t).split(' '); const lines = []; let l = ''; for (const w of words) { if ((l + ' ' + w).trim().length > n) { lines.push(l.trim()); l = w; } else l += ' ' + w; } if (l.trim()) lines.push(l.trim()); return lines; }

  function person(cx, top, opt = {}) {
    const skin = opt.skin || '#f2c7a5', suit = opt.suit || '#232b3d', pants = opt.pants || '#2f3850';
    const pads = opt.pads ? `<g fill="url(#gGold)" opacity=".9"><rect x="${cx - 28}" y="${top + 70}" width="22" height="16" rx="5"/><rect x="${cx + 6}" y="${top + 70}" width="22" height="16" rx="5"/><rect x="${cx - 22}" y="${top + 100}" width="44" height="12" rx="5"/></g>` : '';
    return `<g filter="url(#shadow)">
      <circle cx="${cx}" cy="${top + 26}" r="24" fill="${skin}"/>
      <path d="M${cx - 24} ${top + 18} q24 -26 48 0 q-4 -16 -24 -18 q-20 2 -24 18z" fill="#3b2a22" opacity=".85"/>
      <rect x="${cx - 44}" y="${top + 56}" width="88" height="112" rx="28" fill="${suit}"/>
      ${pads}
      <rect x="${cx - 66}" y="${top + 62}" width="22" height="92" rx="11" fill="${skin}"/>
      <rect x="${cx + 44}" y="${top + 62}" width="22" height="92" rx="11" fill="${skin}"/>
      <rect x="${cx - 38}" y="${top + 162}" width="34" height="112" rx="15" fill="${pants}"/>
      <rect x="${cx + 4}" y="${top + 162}" width="34" height="112" rx="15" fill="${pants}"/>
    </g>`;
  }
  const muscle = (x, y, w, h, cls = 'flex') => `<g class="${cls}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="url(#gMuscle)"/><path d="M${x + h * .45} ${y + h * .5} h${w - h * .9} M${x + h * .55} ${y + h * .32} h${w - h * 1.1} M${x + h * .6} ${y + h * .68} h${w - h * 1.2}" stroke="#ffb3b3" stroke-opacity=".55" stroke-width="3" stroke-linecap="round"/></g>`;

  const S = {
    title(s) {
      const lines = wrap(s.title, 26);
      return svg(`
        <circle cx="400" cy="170" r="70" fill="#2563eb" opacity=".25" class="ring"/>
        <circle cx="400" cy="170" r="70" fill="#2563eb" opacity=".25" class="ring a" ${d(1.1)}/>
        <circle cx="400" cy="170" r="54" fill="url(#gBlue)" class="pop" filter="url(#glow)"/>
        ${bolt(400, 170, 2.6, 'pop', .25)}
        ${lines.map((l, i) => label(400, 300 + i * 44, l, 38, '#ffffff', 800, 'middle', 'up', .4 + i * .1)).join('')}
        ${label(400, 300 + lines.length * 44 + 10, s.caption || '', 17, '#9fb7e6', 500, 'middle', 'up', .8)}`);
    },

    brain() {
      return svg(`
        <g class="left">
          <ellipse cx="170" cy="200" rx="92" ry="74" fill="#f49ab4" filter="url(#shadow)"/>
          <path d="M112 182q24 -30 54 -6q24 -30 54 0M106 218q30 18 60 0q30 18 64 -6M170 132v136" stroke="#d66b8c" stroke-width="6" fill="none" stroke-linecap="round"/>
          ${label(170, 312, 'Brain', 16, '#cfe0ff')}
        </g>
        <path d="M262 210C370 210 400 300 540 288" stroke="url(#gGold)" stroke-width="5" fill="none" class="dash" filter="url(#glow)"/>
        <circle r="10" fill="#ffd76a" filter="url(#glow)"><animateMotion dur="1.6s" repeatCount="indefinite" path="M262 210C370 210 400 300 540 288"/></circle>
        ${label(400, 196, 'nerve signal', 15, '#ffd76a', 700, 'middle', 'in', .6)}
        <g class="right" ${d(.3)}>${muscle(540, 248, 200, 84)}${label(640, 372, 'Muscle contracts', 16, '#cfe0ff')}</g>`);
    },

    electrode() {
      return svg(`
        <g class="up">${muscle(170, 220, 460, 120)}</g>
        <g class="up a" ${d(.5)}>
          <rect x="310" y="112" width="180" height="64" rx="16" fill="#232b3d" filter="url(#shadow)"/>
          <rect x="330" y="126" width="140" height="36" rx="10" fill="url(#gGold)" opacity=".85"/>
          ${label(400, 96, 'electrode in the suit', 15, '#cfe0ff')}
        </g>
        ${bolt(350, 196, 1.7, 'spark', .2)}${bolt(400, 200, 2, 'spark', .5)}${bolt(450, 196, 1.7, 'spark', .8)}
        ${label(400, 392, 'external impulse  →  stronger contraction', 19, '#ffd76a', 700, 'middle', 'in', 1)}`);
    },

    groups() {
      const zones = [['M362 158h76v40h-76z', .3, 'Chest · Upper back', 250, 176, 'end'], ['M372 204h56v62h-56z', .9, 'Abs · Lower back', 250, 236, 'end'], ['M336 150h20v80h-20zM444 150h20v80h-20z', 1.5, 'Arms', 490, 196, 'start'], ['M366 282h32v80h-32zM402 282h32v80h-32z', 2.1, 'Glutes · Thighs', 490, 326, 'start']];
      return svg(`
        ${person(400, 92, { pads: false })}
        ${zones.map(([p, t]) => `<path d="${p}" fill="#ffd76a" fill-opacity=".55" opacity="0" class="in a" ${d(t)} filter="url(#glow)"/><path d="${p}" fill="#ffd76a" fill-opacity=".6" class="glowp a" style="--d:${t + .8}s;opacity:0"/>`).join('')}
        ${zones.map(([, t, txt, x, y, a]) => label(x, y, txt, 16, '#cfe0ff', 600, a, 'in', t)).join('')}
        ${label(400, 420, 'all at the same time, deep fibres included', 18, '#fff', 700, 'middle', 'up', 2.8)}`);
    },

    cycle() {
      return svg(`
        <g transform="translate(160 80)">
          <rect width="240" height="54" rx="12" fill="url(#gGold)"/>${label(120, 34, 'IMPULSE  4 s', 18, '#4a3500', 800)}
          <rect x="240" width="240" height="54" rx="12" fill="#22386b"/>${label(360, 34, 'REST  4 s', 18, '#bcd2ff', 800)}
          <rect x="-3" y="-10" width="6" height="74" rx="3" fill="#fff" class="head" filter="url(#glow)"/>
        </g>
        <g transform="translate(400 280)"><g class="cyc">${muscle(-190, -55, 380, 110, '')}</g></g>
        ${label(400, 412, 'the muscle works, recovers, and works again', 17, '#cfe0ff', 600)}`);
    },

    week() {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return svg(`
        ${days.map((n, i) => `<g class="up a" ${d(i * .1)}>
          <rect x="${76 + i * 94}" y="70" width="78" height="92" rx="16" fill="${i === 0 ? 'url(#gGold)' : 'url(#gCard)'}" filter="url(#shadow)" stroke="#fff" stroke-opacity=".06"/>
          ${label(115 + i * 94, 106, n, 16, i === 0 ? '#4a3500' : '#bcd2ff', 800)}
          ${i === 0 ? bolt(115, 134, 1.1, 'pop', 1) : label(115 + i * 94, 140, 'rest', 13, '#6f86bf', 600)}
        </g>`).join('')}
        <path d="M168 190H716" stroke="url(#gSky)" stroke-width="4" stroke-linecap="round" class="draw a" ${d(1.1)}/>
        ${label(442, 218, 'at least 4 days of recovery', 17, '#a5dcff', 600, 'middle', 'in', 1.7)}
        <g class="pop a" ${d(2.4)}>
          <circle cx="400" cy="330" r="66" fill="url(#gBlue)" filter="url(#glow)"/>
          ${label(400, 340, '20', 40, '#fff', 800)}${label(400, 366, 'minutes', 14, '#d8e6ff', 600)}
        </g>`);
    },

    checklist(s) {
      const items = (s.items || []).slice(0, 5);
      const h = 64 + items.length * 66;
      const y0 = (H - h) / 2;
      return svg(`
        <g class="up">${card(200, y0, 400, h, 22)}</g>
        ${items.map((t, i) => `
          <g class="left a" ${d(.4 + i * .5)}>
            <rect x="236" y="${y0 + 36 + i * 66}" width="36" height="36" rx="10" fill="none" stroke="#5f78b8" stroke-width="3"/>
            <path d="M244 ${y0 + 55 + i * 66}l8 8 l16 -18" stroke="#3ddc97" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="draw a" style="--d:${.9 + i * .5}s"/>
            ${label(290, y0 + 61 + i * 66, t, 19, '#fff', 600, 'start')}
          </g>`).join('')}`);
    },

    water() {
      return svg(`
        <g class="up">
          <path d="M320 80h160l-20 300h-120z" fill="#ffffff" fill-opacity=".05" stroke="#dbe8ff" stroke-width="5" stroke-linejoin="round"/>
          <clipPath id="glass"><path d="M323 83h154l-20 294h-114z"/></clipPath>
          <g clip-path="url(#glass)"><rect x="310" y="150" width="180" height="240" fill="url(#gWater)" class="fill a" ${d(.4)}/></g>
          <circle cx="370" cy="330" r="6" fill="#fff" opacity=".5" class="float"/><circle cx="420" cy="290" r="4" fill="#fff" opacity=".5" class="float a" ${d(1)}/>
        </g>
        <g class="pop a" ${d(3.2)}>${label(600, 230, '16 oz', 46, '#fff', 800)}${label(600, 262, 'before training', 16, '#a5dcff', 600)}</g>`);
    },

    spray() {
      const pads = [0, 1, 2, 3].map(i => {
        const x = 400 + (i % 2) * 150, y = 160 + Math.floor(i / 2) * 110;
        return `<rect x="${x}" y="${y}" width="128" height="80" rx="16" fill="#4b5470" filter="url(#shadow)"/>
                <rect x="${x}" y="${y}" width="128" height="80" rx="16" fill="url(#gBlue)" opacity="0" class="in a" style="--d:${1.4 + i * 1}s"/>`;
      }).join('');
      return svg(`
        <g class="left">
          <rect x="140" y="160" width="90" height="180" rx="22" fill="#e8f0ff"/>
          <rect x="166" y="118" width="42" height="46" rx="8" fill="#9fb7e6"/><path d="M208 128h52v16h-52z" fill="#9fb7e6"/>
          <rect x="150" y="240" width="70" height="92" rx="14" fill="url(#gWater)" opacity=".8"/>
        </g>
        ${[0, .3, .6, .9].map(t => `<circle cx="266" cy="${136 + t * 12}" r="6" fill="#a5dcff" class="drop a" style="--d:${t}s"/>`).join('')}
        ${pads}
        ${label(539, 410, 'evenly moist, no dry spots', 17, '#cfe0ff', 600, 'middle', 'in', 5)}`);
    },

    station() {
      return svg(`
        <g class="up">
          <ellipse cx="250" cy="400" rx="100" ry="16" fill="#0b1324"/>
          <rect x="234" y="170" width="32" height="232" rx="8" fill="#c9cfdb"/>
          <path d="M180 196q70 -14 140 0" stroke="#151924" stroke-width="14" fill="none" stroke-linecap="round"/>
          <g transform="rotate(-8 250 140)">
            <rect x="160" y="112" width="180" height="56" rx="10" fill="#eef2f8" filter="url(#shadow)"/>
            <rect x="204" y="120" width="76" height="34" rx="5" fill="#0e1220"/>
            <path d="M216 144l10 -12l8 7l12 -14l10 8" stroke="#4f8bff" stroke-width="2.5" fill="none"/>
            ${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<circle cx="${174 + i * 19}" cy="162" r="4.5" fill="#9aa3b4"/>`).join('')}
            <circle cx="314" cy="132" r="10" fill="#b8c0cf"/>
          </g>
        </g>
        <g class="right a" ${d(.5)}>${person(580, 92, { pads: true })}</g>
        <path d="M266 300C380 420 470 260 538 210" stroke="#0e1220" stroke-width="6" fill="none" stroke-linecap="round" class="draw a" ${d(1.4)}/>
        <circle cx="538" cy="210" r="9" fill="#ffd76a" class="pop a" ${d(3.2)} filter="url(#glow)"/>
        <g class="up a" ${d(4.2)}><rect x="60" y="40" width="250" height="50" rx="14" fill="#16a36a"/>${label(185, 72, 'All channels at 0', 18, '#fff', 800)}</g>`);
    },

    dial() {
      const ticks = Array.from({ length: 10 }, (_, i) => {
        const a = (-135 + i * 30) * Math.PI / 180, x = 400 + Math.sin(a) * 146, y = 245 - Math.cos(a) * 146;
        return `<text x="${x}" y="${y + 6}" text-anchor="middle" font-size="18" font-weight="800" fill="${i + 1 === 5 ? '#ffd76a' : '#6f86bf'}">${i + 1}</text>`;
      }).join('');
      return svg(`
        <circle cx="400" cy="245" r="118" fill="#eef2f8" class="pop" filter="url(#shadow)"/>
        <circle cx="400" cy="245" r="92" fill="#cfd5e2"/>
        <circle cx="400" cy="245" r="92" fill="none" stroke="#4f8bff" stroke-width="6" stroke-dasharray="578" stroke-dashoffset="578" style="animation:draw 5s cubic-bezier(.4,0,.2,1) forwards;transform:rotate(-225deg);transform-origin:400px 245px;stroke-dasharray:578;--x:0" opacity=".9"/>
        <g class="turn"><rect x="393" y="150" width="14" height="56" rx="7" fill="#2563eb"/></g>
        ${ticks}
        ${label(400, 54, 'perceived exertion', 18, '#fff', 700, 'middle', 'in')}
        <g class="right a" ${d(5.2)}><rect x="600" y="210" width="160" height="70" rx="16" fill="url(#gGold)" filter="url(#shadow)"/>${label(680, 240, 'Beginners', 17, '#4a3500', 800)}${label(680, 264, 'around 5 / 10', 14, '#4a3500', 600)}</g>`);
    },

    chat(s) {
      const lines = (s.lines || []).slice(0, 4);
      let y = 70;
      const bubbles = lines.map(([who, text], i) => {
        const me = who === 'coach';
        const tl = wrap(text, 34); const h = 26 + tl.length * 24; const w = Math.min(420, 40 + Math.max(...tl.map(l => l.length)) * 10.5);
        const x = me ? 140 : 660 - w;
        const out = `<g class="${me ? 'left' : 'right'} a" ${d(.4 + i * 1.3)}>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="${me ? 'url(#gBlue)' : '#eef2f8'}" filter="url(#shadow)"/>
          ${tl.map((l, j) => `<text x="${x + 20}" y="${y + 32 + j * 24}" font-size="17" font-weight="600" fill="${me ? '#fff' : '#0a1626'}">${esc(l)}</text>`).join('')}
        </g>`;
        y += h + 22; return out;
      }).join('');
      return svg(`
        <g class="in"><circle cx="90" cy="96" r="30" fill="url(#gBlue)"/>${label(90, 102, 'CS', 16, '#fff', 800)}</g>
        <g class="in a" ${d(.6)}><circle cx="710" cy="96" r="30" fill="#eef2f8"/><circle cx="710" cy="88" r="10" fill="#9aa3b4"/><path d="M692 114q18 -18 36 0" fill="#9aa3b4"/></g>
        ${bubbles}`);
    },

    steps(s) {
      const items = (s.items || []).slice(0, 5); const n = items.length; const gap = 640 / n;
      return svg(`
        <path d="M${80 + gap / 2} 225H${80 + gap * (n - .5)}" stroke="#2a3f73" stroke-width="6" stroke-linecap="round"/>
        <path d="M${80 + gap / 2} 225H${80 + gap * (n - .5)}" stroke="url(#gSky)" stroke-width="6" stroke-linecap="round" class="draw a" style="--d:.4s;animation-duration:${n * .7}s"/>
        ${items.map((t, i) => `<g class="pop a" ${d(.3 + i * .7)}>
          <circle cx="${80 + gap * (i + .5)}" cy="225" r="34" fill="${i === n - 1 ? 'url(#gGold)' : 'url(#gBlue)'}" filter="url(#shadow)"/>
          ${label(80 + gap * (i + .5), 233, String(i + 1), 22, i === n - 1 ? '#4a3500' : '#fff', 800)}
        </g>${label(80 + gap * (i + .5), 300, t, 17, '#fff', 700, 'middle', 'up', .5 + i * .7)}`).join('')}`);
    },

    alert(s) {
      return svg(`
        <circle cx="400" cy="190" r="80" fill="#ff5c5c" opacity=".25" class="ring"/>
        <circle cx="400" cy="190" r="80" fill="#ff5c5c" opacity=".25" class="ring a" ${d(1.1)}/>
        <g class="pop"><circle cx="400" cy="190" r="64" fill="#ff5c5c" filter="url(#glow)"/><rect x="393" y="148" width="14" height="52" rx="7" fill="#fff"/><circle cx="400" cy="220" r="8" fill="#fff"/></g>
        <g class="up a" ${d(.8)}><rect x="${400 - Math.max(150, String(s.label || '').length * 7)}" y="300" width="${Math.max(300, String(s.label || '').length * 14)}" height="56" rx="16" fill="#fff" filter="url(#shadow)"/>${label(400, 335, s.label || 'Act now', 20, '#c62f3a', 800)}</g>`);
    },

    phone(s) {
      return svg(`
        <g class="up"><g class="float">
          <rect x="320" y="60" width="160" height="300" rx="28" fill="#0e1220" stroke="#3a4a72" stroke-width="3" filter="url(#shadow)"/>
          <rect x="334" y="86" width="132" height="248" rx="14" fill="#14223f"/>
          <circle cx="400" cy="170" r="32" fill="url(#gBlue)"/>${label(400, 177, 'CS', 18, '#fff', 800)}
          ${label(400, 230, 'Incoming call', 14, '#9fb7e6', 600)}
          <circle cx="370" cy="296" r="18" fill="#3ddc97" class="pulse"/><circle cx="430" cy="296" r="18" fill="#ff5c5c"/>
        </g></g>
        <circle cx="400" cy="210" r="140" fill="none" stroke="#4f8bff" stroke-opacity=".4" stroke-width="3" class="ring"/>
        <g class="up a" ${d(1.4)}>${card(160, 372, 480, 56, 16)}${label(400, 407, s.label || '', 18, '#fff', 700)}</g>`);
    },

    stat(s) {
      return svg(`
        <circle cx="400" cy="200" r="120" fill="none" stroke="#22386b" stroke-width="16"/>
        <circle cx="400" cy="200" r="120" fill="none" stroke="url(#gSky)" stroke-width="16" stroke-linecap="round" stroke-dasharray="754" stroke-dashoffset="754" transform="rotate(-90 400 200)" style="animation:draw 2.4s cubic-bezier(.4,0,.2,1) forwards;stroke-dasharray:754"/>
        <g class="pop a" ${d(.4)}>${label(400, 214, s.value || '', 74, '#fff', 800)}</g>
        ${label(400, 256, s.unit || '', 18, '#a5dcff', 700, 'middle', 'in', .9)}
        ${label(400, 386, s.title || '', 24, '#fff', 800, 'middle', 'up', 1.3)}`);
    },

    calendar(s) {
      const cells = Array.from({ length: 21 }, (_, i) => `<rect x="${262 + (i % 7) * 40}" y="${160 + Math.floor(i / 7) * 40}" width="32" height="32" rx="8" fill="${i === 9 ? 'url(#gGold)' : '#22386b'}" class="${i === 9 ? 'pop a' : 'in a'}" style="--d:${i === 9 ? 1.6 : .2 + i * .03}s"/>`).join('');
      return svg(`
        <g class="up">${card(232, 90, 336, 220, 22)}<rect x="232" y="90" width="336" height="52" rx="22" fill="url(#gBlue)"/><rect x="232" y="120" width="336" height="22" fill="url(#gBlue)"/>${label(400, 124, 'Schedule', 18, '#fff', 800)}</g>
        ${cells}
        <g class="up a" ${d(2.2)}><rect x="260" y="338" width="280" height="56" rx="16" fill="#16a36a" filter="url(#shadow)"/><path d="M286 366l8 8 16 -18" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>${label(420, 373, s.label || 'Booked', 18, '#fff', 800)}</g>`);
    },

    quote(s) {
      const tl = wrap(s.text || '', 34);
      return svg(`
        <g class="up">${card(130, 100, 540, 110 + tl.length * 34, 24)}</g>
        ${label(176, 178, '“', 90, '#4f8bff', 800, 'start', 'pop', .3)}
        ${tl.map((l, i) => label(400, 170 + i * 34, l, 24, '#fff', 700, 'middle', 'in', .5 + i * .2)).join('')}`);
    },

    funnel(s) {
      const st = (s.steps || []).slice(0, 5); const max = Math.max(...st.map(x => x[1]));
      return svg(st.map(([name, v], i) => {
        const w = 120 + 480 * (v / max), y = 70 + i * 82;
        return `<g class="up a" ${d(.3 + i * .5)}><rect x="${400 - w / 2}" y="${y}" width="${w}" height="64" rx="16" fill="${i === st.length - 1 ? 'url(#gGold)' : 'url(#gBlue)'}" filter="url(#shadow)" opacity="${1 - i * .08}"/>
          ${label(400, y + 30, name, 17, i === st.length - 1 ? '#4a3500' : '#fff', 700)}${label(400, y + 52, String(v), 14, i === st.length - 1 ? '#4a3500' : '#d8e6ff', 600)}</g>`;
      }).join(''));
    },

    bars(s) {
      const b = (s.bars || []).slice(0, 5); const max = Math.max(...b.map(x => x[1])); const gap = 480 / b.length;
      return svg(`<path d="M150 370H650" stroke="#2a3f73" stroke-width="3"/>` + b.map(([n, v], i) => {
        const h = 240 * v / max, x = 170 + gap * i + gap * .15, w = gap * .7, last = i === b.length - 1;
        return `<rect x="${x}" y="${370 - h}" width="${w}" height="${h}" rx="12" fill="${last ? '#ff6b6b' : 'url(#gBlue)'}" class="grow a" ${d(.3 + i * .4)} filter="url(#shadow)"/>
          ${label(x + w / 2, 370 - h - 14, v + (s.unit || ''), 20, last ? '#ff9b9b' : '#fff', 800, 'middle', 'in', .8 + i * .4)}${label(x + w / 2, 400, n, 16, '#9fb7e6', 700)}`;
      }).join(''));
    },
  };
  S.check = S.checklist; S.talk = S.chat;

  window.EMSAnim = { render: scene => (S[scene.type || scene.anim] || S.title)(scene) };
})();
