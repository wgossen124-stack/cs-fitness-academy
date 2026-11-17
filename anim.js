// Animated explainer scenes (SVG + CSS). Each returns an SVG string, viewBox 640x360.
(function () {
  const W = 640, H = 360;
  const css = `
  <style>
    .fade{opacity:0;animation:fade .8s ease forwards}
    .up{opacity:0;transform:translateY(14px);animation:up .8s ease forwards}
    .pop{transform-box:fill-box;transform-origin:center;transform:scale(0);animation:pop .5s cubic-bezier(.2,1.6,.4,1) forwards}
    .pulse{transform-box:fill-box;transform-origin:center;animation:pulse 1.2s ease-in-out infinite}
    .flex{transform-box:fill-box;transform-origin:center;animation:flex 1.6s ease-in-out infinite}
    .glow{animation:glow 1.6s ease-in-out infinite}
    .dash{stroke-dasharray:6 8;animation:dash 1s linear infinite}
    .draw{stroke-dasharray:900;stroke-dashoffset:900;animation:draw 2s ease forwards}
    .spark{transform-box:fill-box;transform-origin:center;animation:spark .8s ease-in-out infinite}
    .drop{animation:drop 1.1s ease-in infinite}
    .fill{transform-box:fill-box;transform-origin:bottom;transform:scaleY(0);animation:fill 4s ease forwards}
    .turn{transform-origin:320px 190px;animation:turn 6s ease forwards}
    .cyc{transform-box:fill-box;transform-origin:center;animation:cyc 8s steps(1) infinite}
    .head{animation:head 8s linear infinite}
    @keyframes fade{to{opacity:1}}
    @keyframes up{to{opacity:1;transform:none}}
    @keyframes pop{to{transform:scale(1)}}
    @keyframes pulse{50%{transform:scale(1.08)}}
    @keyframes flex{0%,100%{transform:scale(1)}45%,60%{transform:scale(1.14,1.22)}}
    @keyframes glow{0%,100%{opacity:.35}50%{opacity:1}}
    @keyframes dash{to{stroke-dashoffset:-28}}
    @keyframes draw{to{stroke-dashoffset:0}}
    @keyframes spark{0%,100%{opacity:0;transform:scale(.6)}50%{opacity:1;transform:scale(1.1)}}
    @keyframes drop{0%{transform:translate(0,0);opacity:0}15%{opacity:1}100%{transform:translate(70px,40px);opacity:0}}
    @keyframes fill{to{transform:scaleY(1)}}
    @keyframes turn{from{transform:rotate(-135deg)}to{transform:rotate(-15deg)}}
    @keyframes cyc{0%{transform:scale(1.18,1.25)}50%{transform:scale(1)}}
    @keyframes head{from{transform:translateX(0)}to{transform:translateX(400px)}}
  </style>`;
  const d = s => `style="animation-delay:${s}s"`;
  const svg = inner => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system,Segoe UI,Roboto,sans-serif">${css}${inner}</svg>`;
  const bolt = (x, y, s = 1, cls = 'spark', delay = 0) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path class="${cls}" ${d(delay)} d="M6 -14 L-6 2 L1 2 L-4 14 L8 -3 L1 -3 Z" fill="#ffd34d"/></g>`;

  // simple standing figure with suit (front view), centered at cx
  function figure(cx, top, suit = true, extra = '') {
    const s = suit ? '#2b2f3a' : '#3a4a8f';
    return `<g>
      <circle cx="${cx}" cy="${top + 24}" r="22" fill="#f1c9a8"/>
      <rect x="${cx - 40}" y="${top + 52}" width="80" height="100" rx="22" fill="${s}"/>
      <rect x="${cx - 62}" y="${top + 58}" width="20" height="86" rx="10" fill="#f1c9a8"/>
      <rect x="${cx + 42}" y="${top + 58}" width="20" height="86" rx="10" fill="#f1c9a8"/>
      <rect x="${cx - 34}" y="${top + 148}" width="30" height="104" rx="13" fill="#3b4256"/>
      <rect x="${cx + 4}" y="${top + 148}" width="30" height="104" rx="13" fill="#3b4256"/>
      ${extra}
    </g>`;
  }

  const scenes = {
    title(s) {
      return svg(`
        <circle cx="320" cy="140" r="60" fill="#3557d6" opacity=".35" class="pulse"/>
        <circle cx="320" cy="140" r="42" fill="#3d63f0" class="pop"/>
        ${bolt(320, 140, 2.2, 'pop')}
        <text x="320" y="250" text-anchor="middle" font-size="34" font-weight="800" fill="#fff" class="up" ${d(.4)}>${esc(s.title)}</text>
        <text x="320" y="284" text-anchor="middle" font-size="16" fill="#aebdf5" class="up" ${d(.8)}>${esc(s.caption || '')}</text>`);
    },

    brain() {
      return svg(`
        <g class="fade">
          <ellipse cx="150" cy="150" rx="78" ry="62" fill="#f39bb3"/>
          <path d="M100 135 q20 -25 45 -5 q20 -25 45 0 M95 165 q25 15 50 0 q25 15 55 -5 M150 95 v110" stroke="#d76a8a" stroke-width="5" fill="none" stroke-linecap="round"/>
          <text x="150" y="245" text-anchor="middle" fill="#c9d4ff" font-size="15" font-weight="600">Brain</text>
        </g>
        <path id="nerve" d="M220 160 C 300 160, 330 230, 430 220" stroke="#ffd34d" stroke-width="4" fill="none" class="dash"/>
        <circle r="9" fill="#ffd34d">
          <animateMotion dur="1.8s" repeatCount="indefinite" path="M220 160 C 300 160, 330 230, 430 220"/>
        </circle>
        <text x="320" y="150" fill="#ffd34d" font-size="14" font-weight="600" class="fade" ${d(.6)}>nerve signal</text>
        <g class="fade" ${d(.3)}>
          <rect x="430" y="180" width="160" height="70" rx="35" fill="#c84a4a" class="flex"/>
          <path d="M450 215 h120 M450 200 h110 M455 230 h105" stroke="#e98a8a" stroke-width="3" stroke-linecap="round"/>
          <text x="510" y="285" text-anchor="middle" fill="#c9d4ff" font-size="15" font-weight="600">Muscle contracts</text>
        </g>`);
    },

    electrode() {
      return svg(`
        <g class="fade">
          <rect x="140" y="150" width="360" height="110" rx="55" fill="#c84a4a" class="flex"/>
          <path d="M175 205 h290 M180 185 h270 M185 225 h265" stroke="#e98a8a" stroke-width="3" stroke-linecap="round"/>
        </g>
        <g class="up" ${d(.5)}>
          <rect x="250" y="88" width="140" height="54" rx="12" fill="#2b2f3a"/>
          <rect x="266" y="100" width="108" height="30" rx="8" fill="#5a6070"/>
          <text x="320" y="78" text-anchor="middle" fill="#c9d4ff" font-size="14" font-weight="600">electrode in the suit</text>
        </g>
        ${bolt(280, 150, 1.6, 'spark', .2)}${bolt(320, 152, 1.9, 'spark', .5)}${bolt(360, 150, 1.6, 'spark', .8)}
        <text x="320" y="300" text-anchor="middle" fill="#ffd34d" font-size="17" font-weight="700" class="fade" ${d(1)}>external impulse → stronger contraction</text>`);
    },

    groups() {
      const zones = [
        ['chest', 'M282 120 h76 v34 h-76z', 0.3],
        ['abs', 'M292 160 h56 v54 h-56z', 0.9],
        ['arms', 'M258 118 h20 v70 h-20z M362 118 h20 v70 h-20z', 1.5],
        ['thighs', 'M286 226 h30 v66 h-30z M324 226 h30 v66 h-30z', 2.1],
      ];
      return svg(`
        ${figure(320, 46, true)}
        ${zones.map(([n, p, t]) => `<path d="${p}" fill="#ffd34d" opacity="0" class="fade" ${d(t)}/><path d="${p}" fill="#ffd34d" class="glow" style="animation-delay:${t + .8}s;opacity:0"/>`).join('')}
        <g font-size="14" font-weight="600" fill="#c9d4ff">
          <text x="248" y="140" text-anchor="end" class="fade" ${d(.3)}>Chest · Upper back</text>
          <text x="248" y="190" text-anchor="end" class="fade" ${d(.9)}>Abs · Lower back</text>
          <text x="410" y="150" class="fade" ${d(1.5)}>Arms</text>
          <text x="410" y="265" class="fade" ${d(2.1)}>Glutes · Thighs</text>
        </g>
        <text x="320" y="335" text-anchor="middle" fill="#fff" font-size="16" font-weight="700" class="fade" ${d(2.8)}>all at the same time, deep fibres included</text>`);
    },

    cycle() {
      return svg(`
        <g transform="translate(120 70)">
          <rect x="0" y="0" width="200" height="44" rx="8" fill="#ffd34d"/><text x="100" y="28" text-anchor="middle" font-weight="800" fill="#4a3a00">IMPULSE 4 s</text>
          <rect x="200" y="0" width="200" height="44" rx="8" fill="#334a9e"/><text x="300" y="28" text-anchor="middle" font-weight="800" fill="#c9d4ff">REST 4 s</text>
          <rect x="-2" y="-8" width="4" height="60" fill="#fff" class="head"/>
        </g>
        <g transform="translate(320 220)">
          <rect x="-150" y="-40" width="300" height="80" rx="40" fill="#c84a4a" class="cyc"/>
          <path d="M-120 0 h240 M-115 -16 h225 M-110 16 h220" stroke="#e98a8a" stroke-width="3" stroke-linecap="round"/>
        </g>
        <text x="320" y="320" text-anchor="middle" fill="#c9d4ff" font-size="15" font-weight="600">muscle works, then recovers, then works again</text>`);
    },

    week() {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return svg(`
        ${days.map((dname, i) => `<g class="up" ${d(i * .12)}>
          <rect x="${68 + i * 74}" y="70" width="62" height="74" rx="10" fill="${i === 0 ? '#ffd34d' : '#22357f'}"/>
          <text x="${99 + i * 74}" y="102" text-anchor="middle" font-size="14" font-weight="700" fill="${i === 0 ? '#4a3a00' : '#c9d4ff'}">${dname}</text>
          ${i === 0 ? bolt(99, 124, 1, 'pop', 1) : `<text x="${99 + i * 74}" y="130" text-anchor="middle" font-size="12" fill="#7f8fc9">rest</text>`}
        </g>`).join('')}
        <path d="M150 162 h430" stroke="#7f9cff" stroke-width="3" class="draw" style="animation-delay:1.2s"/>
        <text x="365" y="186" text-anchor="middle" fill="#9fb3ff" font-size="15" font-weight="600" class="fade" ${d(1.8)}>at least 4 days of recovery</text>
        <g class="pop" ${d(2.6)}>
          <circle cx="320" cy="262" r="52" fill="#3d63f0"/>
          <text x="320" y="270" text-anchor="middle" font-size="30" font-weight="800" fill="#fff">20</text>
          <text x="320" y="292" text-anchor="middle" font-size="12" fill="#c9d4ff">minutes</text>
        </g>`);
    },

    check() {
      const items = ['Health questionnaire', 'Any illness or fever today?', 'Contraindications ruled out'];
      return svg(`
        <g class="up">
          <rect x="190" y="40" width="260" height="290" rx="16" fill="#f6f7fb"/>
          <rect x="270" y="28" width="100" height="28" rx="8" fill="#9aa3b8"/>
          ${items.map((t, i) => `
            <rect x="215" y="${92 + i * 72}" width="30" height="30" rx="7" fill="none" stroke="#9aa3b8" stroke-width="3"/>
            <path d="M221 ${107 + i * 72} l7 8 l14 -16" stroke="#14935b" stroke-width="5" fill="none" stroke-linecap="round" class="draw" style="animation-delay:${1 + i * 1.4}s"/>
            <text x="258" y="${113 + i * 72}" font-size="15" font-weight="600" fill="#141a2e">${t}</text>`).join('')}
        </g>`);
    },

    water() {
      return svg(`
        <g class="fade">
          <path d="M260 70 h120 l-14 230 h-92 z" fill="none" stroke="#dfe6ff" stroke-width="5" stroke-linejoin="round"/>
          <clipPath id="g"><path d="M263 73 h114 l-14 224 h-86 z"/></clipPath>
          <g clip-path="url(#g)"><rect x="255" y="120" width="130" height="190" fill="#5ab4ff" class="fill" ${d(.6)}/></g>
        </g>
        <text x="470" y="190" font-size="40" font-weight="800" fill="#fff" class="pop" ${d(3.5)}>16 oz</text>
        <text x="470" y="220" font-size="14" fill="#c9d4ff" class="fade" ${d(4)}>before training</text>`);
    },

    spray() {
      const pads = [0, 1, 2, 3].map(i => `<g>
        <rect x="${330 + (i % 2) * 120}" y="${150 + Math.floor(i / 2) * 90}" width="100" height="62" rx="12" fill="#6b7180"/>
        <rect x="${330 + (i % 2) * 120}" y="${150 + Math.floor(i / 2) * 90}" width="100" height="62" rx="12" fill="#2f5fbf" opacity="0" class="fade" style="animation-delay:${1.5 + i * 1.1}s"/>
      </g>`).join('');
      return svg(`
        <g class="up">
          <rect x="120" y="120" width="70" height="140" rx="16" fill="#e8eefc"/>
          <rect x="140" y="88" width="34" height="36" rx="6" fill="#9fb3ff"/>
          <path d="M174 96 h40 v12 h-40z" fill="#9fb3ff"/>
          <rect x="128" y="180" width="54" height="72" rx="10" fill="#5ab4ff" opacity=".7"/>
        </g>
        ${[0, .3, .6, .9].map(t => `<circle cx="222" cy="${102 + t * 10}" r="5" fill="#9fd4ff" class="drop" style="animation-delay:${t}s"/>`).join('')}
        ${pads}
        <text x="450" y="340" text-anchor="middle" fill="#c9d4ff" font-size="15" font-weight="600" class="fade" ${d(5.5)}>evenly moist, no dry spots</text>`);
    },

    station() {
      // EMS station: round base, column, handlebar, control panel – connected to a client in the suit
      return svg(`
        <g class="up">
          <ellipse cx="200" cy="322" rx="78" ry="14" fill="#3a3f4c"/>
          <rect x="186" y="128" width="28" height="196" rx="6" fill="#c9ced8"/>
          <path d="M140 150 q60 -12 120 0" stroke="#24272f" stroke-width="12" fill="none" stroke-linecap="round"/>
          <path d="M200 150 q-6 40 -2 80" stroke="#24272f" stroke-width="10" fill="none"/>
          <g transform="rotate(-8 200 108)">
            <rect x="130" y="88" width="140" height="44" rx="6" fill="#e9ecf2"/>
            <rect x="166" y="94" width="56" height="26" rx="3" fill="#10131c"/>
            <path d="M178 112 l8 -10 l6 6 l10 -12" stroke="#3d9bff" stroke-width="2" fill="none"/>
            ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<circle cx="${140 + i * 16}" cy="126" r="4" fill="#9aa1b0"/>`).join('')}
            <circle cx="250" cy="102" r="8" fill="#b8bfcc"/>
          </g>
        </g>
        <g class="fade" ${d(.6)}>${figure(470, 54, true)}</g>
        <path d="M214 230 C 300 330, 380 210, 438 170" stroke="#10131c" stroke-width="5" fill="none" class="draw" style="animation-delay:1.6s"/>
        <circle cx="438" cy="170" r="8" fill="#ffd34d" class="pop" ${d(3.4)}/>
        <g class="up" ${d(4.6)}>
          <rect x="40" y="20" width="230" height="44" rx="10" fill="#14935b"/>
          <text x="155" y="48" text-anchor="middle" font-weight="800" fill="#fff" font-size="16">All channels at 0</text>
        </g>`);
    },

    dial() {
      const ticks = Array.from({ length: 10 }, (_, i) => {
        const a = (-135 + i * 30) * Math.PI / 180;
        const x = 320 + Math.sin(a) * 118, y = 190 - Math.cos(a) * 118;
        return `<text x="${x}" y="${y + 5}" text-anchor="middle" font-size="15" font-weight="700" fill="${i + 1 === 5 ? '#ffd34d' : '#8fa0d9'}">${i + 1}</text>`;
      }).join('');
      return svg(`
        <circle cx="320" cy="190" r="92" fill="#e9ecf2" class="fade"/>
        <circle cx="320" cy="190" r="70" fill="#c9ced8"/>
        <g class="turn"><rect x="315" y="112" width="10" height="44" rx="5" fill="#1e3fae"/></g>
        ${ticks}
        <text x="320" y="40" text-anchor="middle" font-size="16" font-weight="700" fill="#fff" class="fade">perceived exertion</text>
        <g class="up" ${d(6)}>
          <rect x="470" y="160" width="140" height="60" rx="12" fill="#ffd34d"/>
          <text x="540" y="186" text-anchor="middle" font-weight="800" fill="#4a3a00" font-size="15">Beginners</text>
          <text x="540" y="206" text-anchor="middle" font-weight="600" fill="#4a3a00" font-size="13">around 5 / 10</text>
        </g>`);
    },

    talk() {
      return svg(`
        ${figure(180, 70, false)}
        ${figure(460, 70, true)}
        <g class="pop" ${d(.6)}>
          <rect x="210" y="30" width="230" height="56" rx="16" fill="#fff"/><path d="M230 86 l-6 18 l22 -18z" fill="#fff"/>
          <text x="325" y="64" text-anchor="middle" font-size="15" font-weight="700" fill="#141a2e">How does that feel?</text>
        </g>
        <g class="pop" ${d(2.4)}>
          <rect x="350" y="104" width="250" height="56" rx="16" fill="#ffd34d"/><path d="M560 160 l10 18 l-28 -18z" fill="#ffd34d"/>
          <text x="475" y="138" text-anchor="middle" font-size="15" font-weight="700" fill="#4a3a00">Strong, but even. Good!</text>
        </g>
        <text x="320" y="345" text-anchor="middle" font-size="15" font-weight="600" fill="#c9d4ff" class="fade" ${d(4)}>check in every few minutes, never leave</text>`);
    },
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  window.EMSAnim = {
    render(scene) { return (scenes[scene.anim] || scenes.title)(scene); },
  };
})();
