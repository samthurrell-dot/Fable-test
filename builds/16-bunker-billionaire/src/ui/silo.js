// ui/silo.js
// The silo as a cut-paper cross-section: six floors under a ruined surface, drawn once as SVG, with
// the staff as paper pawns (HTML buttons) that walk between rooms. The picture also carries a few
// readings: water in the tank, crates in the stores, bottles in your rack, crops on the farm.
//   createSilo(root) -> { update(view), root }
//   view: { staff: [{ role, mood, zone, status, badge }], you: { zone, mood, down }, cameras, night, res, ending }

import { faceSVG } from './faces.js';

const W = 400, H = 300, GROUND = 48, FLOOR_H = 41, ROOM_H = 37, FIRST = 52;
const top = (i) => FIRST + i * FLOOR_H;
const PAWN_W = 25, PAWN_H = PAWN_W * 36 / 32;

// Where pawns can stand: floor (-1 is the surface) and the stretch of it, in picture units.
export const ZONES = {
  surface: { floor: -1, x: [236, 372] },
  you: { floor: 0, x: [146, 146] },
  suite: { floor: 0, x: [176, 228] }, vault: { floor: 0, x: [262, 318] },
  security: { floor: 1, x: [158, 214] }, cell: { floor: 1, x: [262, 300] },
  kitchen: { floor: 2, x: [132, 176] }, mess: { floor: 2, x: [212, 318] },
  medical: { floor: 3, x: [140, 196] }, bunks: { floor: 3, x: [236, 318] },
  farm: { floor: 4, x: [126, 306] },
  plant: { floor: 5, x: [186, 222] }, stores: { floor: 5, x: [250, 320] },
};

const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;

function art() {
  const t = [0, 1, 2, 3, 4, 5].map(top);
  let s = '';
  // --- sky and surface
  s += `<defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9814a"/><stop offset="1" stop-color="#ecc48c"/></linearGradient>
    <linearGradient id="skyn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a2c"/><stop offset="1" stop-color="#3a3350"/></linearGradient>
    <filter id="cut" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="1.2" stdDeviation="0.9" flood-color="#000" flood-opacity="0.35"/></filter>
    <pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.5" fill="#000" opacity="0.06"/><circle cx="4" cy="3.5" r="0.4" fill="#fff" opacity="0.05"/></pattern>
  </defs>`;
  s += rect(0, 0, W, GROUND, 'url(#sky)') + `<rect class="nightsky" x="0" y="0" width="${W}" height="${GROUND}" fill="url(#skyn)"/>`;
  s += `<circle class="sun" cx="318" cy="20" r="9" fill="#fbe6ad"/><circle class="sun" cx="318" cy="20" r="14" fill="#fbe6ad" opacity="0.25"/>`;
  s += `<g class="moon"><circle cx="92" cy="17" r="7" fill="#e9e6d6"/><circle cx="95" cy="15" r="6" fill="#1b2136"/></g>`;
  s += `<g class="dust" fill="#f6dcae" opacity="0.5"><ellipse cx="40" cy="14" rx="26" ry="2.2"/><ellipse cx="210" cy="26" rx="34" ry="2"/><ellipse cx="350" cy="9" rx="22" ry="1.8"/></g>`;
  // ruins on the horizon, a dead tree, the hatch
  s += `<path d="M0 48 V38 h10 v-7 h7 v4 h6 v-10 h9 v6 h5 v15 Z M150 48 v-9 h8 v-6 l6 3 v-8 h8 v20 Z M360 48 v-14 h7 v5 h8 v-11 h6 v8 h9 v-4 h10 v16 Z" fill="#9a6642" opacity="0.75"/>`;
  s += `<path d="M196 48 V30 M196 37 l-7 -6 M196 34 l8 -8 M204 26 l1 -5 M189 31 l-4 -1" stroke="#4a3626" stroke-width="2" fill="none" stroke-linecap="round" filter="url(#cut)"/>`;
  s += `<g filter="url(#cut)"><path d="M52 48 V40 Q52 34 60 34 H96 Q104 34 104 40 V48 Z" fill="#b9b3a2"/><rect class="hatch" x="64" y="30.5" width="28" height="5" rx="1.5" fill="#6d6f66"/><path d="M110 48 v-12 h13 v12" fill="none" stroke="#5c5d55" stroke-width="1.6"/><path d="M116.5 33 l6 9 h-12 Z" fill="#e8b92e" stroke="#25261f" stroke-width="0.8"/><circle cx="116.5" cy="39.4" r="1.2" fill="#25261f"/></g>`;
  s += `<g id="graves"></g>`;
  // --- earth
  s += rect(0, GROUND, W, H - GROUND, '#5f4a38');
  s += `<path d="M0 86 Q30 78 58 90 V132 Q24 122 0 136 Z M342 100 Q372 90 400 104 V160 Q370 148 342 158 Z" fill="#544031"/><path d="M0 190 Q28 180 58 196 V300 H0 Z M342 214 Q374 204 400 220 V300 H342 Z" fill="#4a382b"/>`;
  s += `<g fill="#7b6650"><ellipse cx="24" cy="112" rx="9" ry="5"/><ellipse cx="374" cy="130" rx="11" ry="6"/><ellipse cx="18" cy="236" rx="7" ry="4"/><ellipse cx="380" cy="262" rx="9" ry="5"/><ellipse cx="38" cy="170" rx="4" ry="2.6"/></g>`;
  s += `<g stroke="#d9cfb8" stroke-width="1.6" stroke-linecap="round" opacity="0.7"><path d="M364 186 l14 5"/><path d="M362 184 l3 4 M377 189 l3 4"/></g>`;
  s += rect(0, GROUND - 1.5, W, 3, '#3f3024');
  // air pipe up the right side
  s += `<path d="M342 ${t[5] + 14} H356 V40" fill="none" stroke="#8c8f86" stroke-width="4"/><rect x="351" y="36" width="10" height="5" rx="1" fill="#6d6f66"/><g class="steam" stroke="#f3ead6" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.6"><path d="M354 33 q-3 -3 0 -6 q3 -3 0 -6"/><path d="M358 34 q3 -3 0 -6"/></g>`;
  // --- the shaft
  s += `<g filter="url(#cut)">${rect(57, GROUND, 286, H - GROUND + 2, '#b9b3a2')}</g>`;
  s += rect(63, GROUND, 28, H - GROUND, '#2c312e');
  s += `<path d="M77 ${GROUND} V${H}" stroke="#565b55" stroke-width="1"/>`;
  s += `<g class="lift"><rect x="66" y="${t[0] + 6}" width="22" height="30" rx="1.5" fill="#d7b24c"/><rect x="69" y="${t[0] + 10}" width="7.5" height="22" fill="#8a6f2a"/><rect x="77.5" y="${t[0] + 10}" width="7.5" height="22" fill="#8a6f2a"/></g>`;
  const X = 93, RW = 244;
  const walls = ['#7b3340', '#52616f', '#dcc096', '#d3e6d8', '#3d3154', '#3b4440'];
  t.forEach((y, i) => { s += rect(X, y, RW, ROOM_H, walls[i]) + rect(X, y + ROOM_H, RW, 4, '#77736a') + rect(X, y, RW, 2.2, '#000', 'opacity="0.18"'); });

  // 0 your suite, and the vault
  let y = t[0];
  s += rect(X, y + 25, 160, 12, '#5f2531') + rect(X, y + 24, 160, 1.4, '#d9b24e');
  s += `<g filter="url(#cut)"><path d="M186 ${y} v5 M178 ${y + 8} h16 M178 ${y + 8} v3 M186 ${y + 8} v4 M194 ${y + 8} v3" stroke="#d9b24e" stroke-width="1.5" fill="none"/><circle cx="178" cy="${y + 12}" r="1.6" fill="#fff3c4"/><circle cx="186" cy="${y + 13}" r="1.6" fill="#fff3c4"/><circle cx="194" cy="${y + 12}" r="1.6" fill="#fff3c4"/></g>`;
  s += `<g filter="url(#cut)">${rect(206, y + 6, 24, 16, '#d9b24e')}${rect(208, y + 8, 20, 12, '#c23b2c')}${rect(208, y + 14, 20, 2, '#8e2a20')}</g>`;
  s += `<g filter="url(#cut)"><path d="M98 ${y + 37} v-9 q0 -3 3 -3 h32 q3 0 3 3 v9 Z" fill="#e9dfc6"/><path d="M101 ${y + 28.5} h32 v3 h-32 Z" fill="#58b3ae"/></g><g class="steam" stroke="#f6efe0" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.7"><path d="M108 ${y + 24} q-3 -3 0 -6 q3 -3 0 -6"/><path d="M118 ${y + 23} q3 -3 0 -6 q-3 -3 0 -6"/><path d="M127 ${y + 24} q-3 -3 0 -6"/></g>`;
  s += rect(253, y, 84, ROOM_H, '#5a2530') + rect(251, y, 4, ROOM_H, '#8f8b7e');
  s += `<g filter="url(#cut)">${rect(300, y + 6, 32, 28, '#3d2a1c')}`;
  for (let k = 0; k < 12; k++) s += `<circle class="bottle" data-k="${k}" cx="${305 + (k % 4) * 7.4}" cy="${y + 11 + Math.floor(k / 4) * 9}" r="2.6" fill="#7fae6a" stroke="#25261f" stroke-width="0.5"/>`;
  s += `</g><g filter="url(#cut)" fill="#e2bd4c" stroke="#8a6f2a" stroke-width="0.5"><rect x="258" y="${y + 31}" width="10" height="5"/><rect x="269" y="${y + 31}" width="10" height="5"/><rect x="263.5" y="${y + 26}" width="10" height="5"/></g>`;

  // 1 security
  y = t[1];
  s += `<g filter="url(#cut)">${rect(98, y + 24, 46, 13, '#39434e')}`;
  for (let k = 0; k < 4; k++) s += `<rect class="monitor" x="${100 + (k % 2) * 22}" y="${y + 5 + Math.floor(k / 2) * 10}" width="19" height="8.5" rx="1" fill="#1f262d" stroke="#8c98a4" stroke-width="0.8"/>`;
  s += `</g>` + rect(251, y, 4, ROOM_H, '#8f8b7e');
  s += `<g stroke="#2a323a" stroke-width="1.6">${[260, 267, 274, 281, 288, 295, 302].map((x) => `<path d="M${x} ${y} V${y + ROOM_H}"/>`).join('')}</g>`;
  s += `<g filter="url(#cut)">${rect(310, y + 8, 11, 29, '#6c7f8f')}${rect(322, y + 8, 11, 29, '#6c7f8f')}<path d="M313 ${y + 13} h5 M325 ${y + 13} h5" stroke="#2a323a" stroke-width="1"/></g>`;

  // 2 kitchen and mess
  y = t[2];
  s += rect(X, y + 22, 100, 15, '#c7a877');
  s += `<g filter="url(#cut)">${rect(98, y + 21, 26, 16, '#6c7078')}${rect(100, y + 26, 22, 9, '#2d3035')}<rect x="102" y="${y + 14}" width="12" height="7" rx="1.5" fill="#b5482e"/><path d="M100 ${y + 15} h16" stroke="#25261f" stroke-width="1"/></g><g class="steam" stroke="#fff" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.65"><path d="M106 ${y + 11} q-2.5 -2.5 0 -5"/><path d="M111 ${y + 11} q2.5 -2.5 0 -5"/></g>`;
  s += `<path d="M132 ${y + 3} h44" stroke="#5c5d55" stroke-width="1.2"/><g fill="#8c8f86" filter="url(#cut)"><circle cx="140" cy="${y + 8}" r="3.6"/><circle cx="152" cy="${y + 9}" r="4.4"/><rect x="163" y="${y + 4}" width="3" height="9" rx="1"/><rect x="170" y="${y + 4}" width="3" height="7" rx="1"/></g>`;
  s += `<g filter="url(#cut)">${rect(208, y + 27, 118, 3.5, '#8a5a36')}${rect(214, y + 30, 3, 7, '#6e4729')}${rect(317, y + 30, 3, 7, '#6e4729')}${rect(264, y + 30, 3, 7, '#6e4729')}</g>`;
  s += `<g fill="#f3ead6" stroke="#25261f" stroke-width="0.4">${[222, 242, 262, 282, 302].map((x) => `<ellipse cx="${x}" cy="${y + 26.2}" rx="4" ry="1.2"/>`).join('')}</g>`;

  // 3 medical and bunks
  y = t[3];
  s += rect(X, y + 26, 110, 11, '#b9d2c0');
  s += `<g filter="url(#cut)">${rect(98, y + 26, 34, 5, '#fffdf6')}${rect(98, y + 31, 2.5, 6, '#8c8f86')}${rect(129.5, y + 31, 2.5, 6, '#8c8f86')}${rect(98, y + 22, 9, 4, '#e7efe9')}</g>`;
  s += `<g filter="url(#cut)" class="medbox">${rect(112, y + 5, 16, 14, '#fffdf6')}<path d="M120 ${y + 8} v8 M116 ${y + 12} h8" stroke="#c23b2c" stroke-width="2.6"/></g>`;
  s += rect(203, y, 4, ROOM_H, '#8f8b7e');
  s += `<g filter="url(#cut)">${[226, 262, 298].map((x) => `${rect(x, y + 5, 2, 32, '#6c7078')}${rect(x + 30, y + 5, 2, 32, '#6c7078')}${rect(x, y + 14, 32, 4, '#7d8fa3')}${rect(x, y + 30, 32, 4, '#7d8fa3')}${rect(x + 2, y + 11.5, 8, 3, '#f3ead6')}${rect(x + 2, y + 27.5, 8, 3, '#f3ead6')}`).join('')}</g>`;

  // 4 farm
  y = t[4];
  s += `<g class="grow">${[104, 152, 200, 248, 296].map((x) => `<rect x="${x}" y="${y + 3}" width="32" height="2.6" rx="1.3" fill="#ff8fd0"/><path d="M${x + 2} ${y + 5.6} l-5 22 h42 l-5 -22 Z" fill="#ff8fd0" opacity="0.13"/>`).join('')}</g>`;
  s += `<g filter="url(#cut)">${[100, 148, 196, 244, 292].map((x) => rect(x, y + 30, 40, 7, '#8a5a36')).join('')}</g>`;
  s += `<g class="crops">${[100, 148, 196, 244, 292].map((x, k) => `<g class="crop" data-k="${k}" style="transform-origin:${x + 20}px ${y + 30}px"><path d="M${x + 6} ${y + 30} q-3 -8 2 -11 q1 6 -2 11 M${x + 14} ${y + 30} q4 -9 -1 -14 q-3 7 1 14 M${x + 23} ${y + 30} q-4 -8 1 -12 q2 6 -1 12 M${x + 32} ${y + 30} q4 -7 0 -11 q-3 5 0 11" fill="#6fae4e"/><circle cx="${x + 14}" cy="${y + 20}" r="1.8" fill="#d8442f"/><circle cx="${x + 30}" cy="${y + 23}" r="1.6" fill="#d8442f"/></g>`).join('')}</g>`;

  // 5 plant and stores
  y = t[5];
  s += `<g filter="url(#cut)">${rect(98, y + 14, 44, 23, '#59635d')}${rect(102, y + 30, 36, 3, '#2c312e')}<circle cx="112" cy="${y + 23}" r="7" fill="#2c312e"/><g class="fan" style="transform-origin:112px ${y + 23}px"><path d="M112 ${y + 17} v12 M106 ${y + 23} h12" stroke="#c9c4b4" stroke-width="2.4" stroke-linecap="round"/></g><circle id="gen-lamp" cx="132" cy="${y + 19}" r="2.6" fill="#7ee08a"/></g>`;
  s += `<g filter="url(#cut)"><rect x="150" y="${y + 5}" width="24" height="32" rx="3" fill="#2c312e" stroke="#8c8f86" stroke-width="1.4"/><rect id="water-level" x="152" y="${y + 7}" width="20" height="28" rx="1.5" fill="#58b3ae"/><path d="M162 ${y + 5} V${y}" stroke="#8c8f86" stroke-width="3"/></g>`;
  s += rect(231, y, 4, ROOM_H, '#8f8b7e');
  s += `<g filter="url(#cut)">`;
  for (let k = 0; k < 12; k++) { const row = k < 6 ? 0 : k < 10 ? 1 : 2, col = k < 6 ? k : k < 10 ? k - 6 : k - 10; s += `<g class="crate" data-k="${k}"><rect x="${240 + col * 15.6 + row * 7.8}" y="${y + 27 - row * 10}" width="14.6" height="9.6" fill="#c79a5b" stroke="#7a5a30" stroke-width="0.7"/><path d="M${240 + col * 15.6 + row * 7.8} ${y + 31.8 - row * 10} h14.6" stroke="#7a5a30" stroke-width="0.6"/></g>`; }
  s += `</g>`;
  // cameras: one small red eye in each room, lit only while they are on
  s += `<g class="cams">${t.map((yy) => `<path d="M330 ${yy + 3} l-6 2 v3 l6 2 Z" fill="#25261f"/><circle class="camdot" cx="325.5" cy="${yy + 6.5}" r="1.3" fill="#ff4a3a"/>`).join('')}</g>`;
  // paper grain over everything, then the dark of night (the suite keeps a lamp on)
  s += rect(0, 0, W, H, 'url(#grain)');
  s += `<rect class="dark" x="0" y="${GROUND}" width="${W}" height="${H - GROUND}" fill="#0b1020"/><rect class="dark deep" x="57" y="${t[1]}" width="286" height="${H - t[1]}" fill="#0b1020"/>`;
  s += `<rect class="hatchlight" x="64" y="${GROUND}" width="28" height="${H - GROUND}" fill="#fff3c4"/>`;
  return s;
}

export function createSilo(root) {
  root.innerHTML = `<div class="silo-box"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Cross-section of the silo, with the staff in their rooms">${art()}</svg><div class="pawns"></div></div>`;
  const box = root.querySelector('.silo-box'), layer = root.querySelector('.pawns'), svg = root.querySelector('svg');
  const pawns = new Map();
  const pawn = (role, label) => {
    if (!pawns.has(role)) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pawn'; b.dataset.role = role;
      b.style.animationDelay = `${-Math.random() * 6}s`;
      layer.appendChild(b);
      pawns.set(role, { el: b, key: '' });
    }
    const p = pawns.get(role);
    if (label) p.el.setAttribute('aria-label', label);
    return p;
  };
  const place = (p, zone, i, n) => {
    const z = ZONES[zone] || ZONES.surface;
    const span = z.x[1] - z.x[0];
    const x = n <= 1 ? (z.x[0] + z.x[1]) / 2 : z.x[0] + (span * i) / (n - 1);
    const base = z.floor < 0 ? GROUND : top(z.floor) + ROOM_H;
    p.el.style.left = `${((x - PAWN_W / 2) / W) * 100}%`;
    p.el.style.top = `${((base - PAWN_H) / H) * 100}%`;
    p.el.style.zIndex = String(10 + (z.floor < 0 ? 0 : z.floor) * 10 + i);
  };

  function update(v) {
    box.classList.toggle('night', !!v.night);
    box.classList.toggle('cams', !!v.cameras);
    box.classList.toggle('lowpower', v.res && v.res.power < 14);
    box.dataset.ending = v.ending || '';
    // readings
    if (v.res) {
      const t5 = top(5), lv = Math.max(0, Math.min(1, v.res.water / 70));
      const wl = svg.querySelector('#water-level');
      wl.setAttribute('y', t5 + 7 + 28 * (1 - lv)); wl.setAttribute('height', 28 * lv);
      svg.querySelectorAll('.crate').forEach((c) => { c.style.opacity = +c.dataset.k < Math.ceil(v.res.food / 7) ? 1 : 0; });
      svg.querySelectorAll('.bottle').forEach((c) => { c.style.opacity = +c.dataset.k < Math.ceil(v.res.lux / 5) ? 1 : 0.08; });
      const grow = 0.45 + 0.55 * Math.min(1, v.res.water / 40);
      svg.querySelectorAll('.crop').forEach((c) => { c.style.transform = `scale(1, ${grow.toFixed(2)})`; });
      svg.querySelector('#gen-lamp').setAttribute('fill', v.res.power < 14 ? '#ff4a3a' : v.res.power < 28 ? '#f2c230' : '#7ee08a');
      svg.querySelector('.medbox').style.opacity = v.res.med < 6 ? 0.35 : 1;
    }
    // graves for the dead, on the surface
    const dead = v.staff.filter((p) => p.status === 'dead');
    svg.querySelector('#graves').innerHTML = dead.map((_, i) => `<g filter="url(#cut)"><path d="M${134 + i * 11} 48 v-9 M${130.5 + i * 11} 42.5 h7" stroke="#e9dfc6" stroke-width="2" stroke-linecap="round"/></g>`).join('');
    // pawns
    const groups = {};
    const all = [...v.staff.filter((p) => p.status !== 'dead'), { role: 'you', mood: v.you.mood || 'smug', zone: v.you.zone || 'you', status: 'ok', you: true, down: v.you.down }];
    for (const p of all) (groups[p.zone] = groups[p.zone] || []).push(p);
    const seen = new Set();
    for (const zone in groups) {
      groups[zone].forEach((p, i) => {
        const el = pawn(p.role, p.label);
        seen.add(p.role);
        const key = `${p.mood}|${p.badge || ''}`;
        if (el.key !== key) { el.key = key; el.el.innerHTML = faceSVG(p.role, p.mood) + (p.badge ? `<i class="badge ${p.badge}"></i>` : ''); }
        el.el.classList.toggle('gone', p.status === 'exiled');
        el.el.classList.toggle('unseen', !!p.unseen);
        el.el.classList.toggle('down', !!p.down);
        el.el.classList.toggle('is-you', !!p.you);
        el.el.hidden = false;
        place(el, zone, i, groups[zone].length);
      });
    }
    for (const [role, p] of pawns) if (!seen.has(role)) p.el.hidden = true;
  }
  return { update, root, box };
}
