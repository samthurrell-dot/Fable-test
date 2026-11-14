// ui/diorama.js
// The silo as a cut-card model on a table: a back board with the rooms printed on it, card floors,
// standing props and standee pawns, lit by one soft window. Built with the three paper engines
// harvested from build 15 (engine/fold.js for frames, engine/cardmesh.js and engine/atlas.js for card
// and print, engine/paperlight.js for light). Everything is in centimetres, y up, table at y = 0.
//
// The model is a pop-up: the back board is hinged to the base along x, every floor stays parallel
// to the base and every standing piece parallel to the back board (a stack of parallelograms), so
// one angle folds the whole silo flat. open(0..1) drives it.
//
//   createDiorama(root) -> { update(view), setOpen(t), hits, capture() }   (throws if WebGL2 is missing)
//   view: as for ui/silo.js, plus faults: [{ sys, i, patched }], asks: { role: i }, policy: { tub, cinema }

import { createPaperRenderer, QUALITY, LIGHT_RIG } from '../../engine/paperlight.js';
import { Rig } from '../../engine/fold.js';
import { CardMesh } from '../../engine/cardmesh.js';
import { buildAtlas } from '../../engine/atlas.js';
import { faceMarkup, HATS } from './faces.js';

// --- the model's measurements (cm) ---
const FLOOR = 4.6;            // floor to floor
const SLAB = 0.25;            // thickness of a card floor
const DEPTH = 4.5;            // how far the rooms come forward from the back board
const HALF = 15;              // half the width of the silo's inside
const EARTH = 20;             // half the width of the whole model
const SHAFT = -11.2;          // the lift shaft is everything left of this
const GROUND = FLOOR * 6;     // height of the surface
const TALL = 34;              // height of the back board
const BASE_T = 0.15;          // thickness of the base card
const PAWN_D = 3.5;           // how far forward the pawns stand
const OUT_D = 6.6;            // how far forward a pawn is lifted to move between floors
const MOVING_PIXELS = 1.0e6;  // the moving picture is drawn at no more than this many pixels (stills are always full size)
const MOODS = ['happy', 'content', 'flat', 'sour', 'angry', 'grin', 'dead'];
const ROLES = ['security', 'chef', 'engineer', 'doctor', 'farmer', 'pa', 'cleaner', 'heir'];
// The figure of a person: head and body in one cut piece, the face drawing from ui/faces.js printed on the head.
const HEAD_Y = 1.95, HEAD_R = 0.78, SV = HEAD_R / 11.2;      // head centre and radius (cm); face drawing units to cm
const sv = ([x, y]) => [(x - 16) * SV, HEAD_Y - (y - 23) * SV];   // a point of the face drawing, in the figure's cm
const BODY = (() => {
  const a0 = Math.atan2(1.258 - HEAD_Y, 0.36), a1 = Math.PI - a0, n = 16, arc = [];
  for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; arc.push([Math.cos(a) * HEAD_R, HEAD_Y + Math.sin(a) * HEAD_R]); }
  return [[-1.1, 0], [1.1, 0], [1.02, 0.88], [0.8, 1.14], ...arc, [-0.8, 1.14], [-1.02, 0.88]];
})();
// Each hat (or hair) is its own small piece glued over the head; its outline follows the drawing (face units).
const HAT_PTS = {
  security: [[5, 15], [29.5, 15], [27, 12.2], [25.5, 12.2], [24.2, 9], [21, 6.3], [16, 5.3], [11, 6.3], [7.8, 9], [6.5, 12.2], [5, 12.2]],
  chef: [[8, 14], [24, 14], [24, 11.5], [26.5, 9.5], [27.2, 7], [25, 4.2], [21.5, 3], [19, 2.9], [16, 0.9], [13, 2.9], [10.5, 3], [7, 4.2], [4.8, 7], [5.5, 9.5], [8, 11.5]],
  engineer: [[4.5, 15.2], [27.5, 15.2], [27.5, 12.8], [25.4, 12.8], [24.6, 8.5], [21.5, 5], [16, 3.6], [10.5, 5], [7.4, 8.5], [6.6, 12.8], [4.5, 12.8]],
  doctor: [[6.2, 15], [11, 12.3], [16, 11.5], [21, 12.3], [25.8, 15], [25.2, 11.6], [23.5, 9.6], [20.5, 8.6], [19.2, 8.4], [18.6, 7.9], [17.3, 7.35], [16, 7.25], [14.7, 7.35], [13.4, 7.9], [12.8, 8.4], [11.5, 8.6], [8.5, 9.6], [6.8, 11.6]],
  farmer: [[1.5, 13], [2.5, 14.6], [6, 15.5], [16, 15.8], [26, 15.5], [29.5, 14.6], [30.5, 13], [29.5, 11.4], [26, 10.5], [23, 10.3], [23, 8], [21.5, 5.5], [16, 4.5], [10.5, 5.5], [9, 8], [9, 10.3], [6, 10.5], [2.5, 11.4]],
  pa: [[5.8, 17], [11, 12.2], [16, 11.5], [21, 12.2], [26.2, 17], [25.5, 12], [23, 9.2], [19.6, 8.1], [19.9, 6], [18.8, 3.4], [16, 2.2], [13.2, 3.4], [12.1, 6], [12.4, 8.1], [9, 9.2], [6.5, 12]],
  cleaner: [[5.6, 17.5], [10.5, 13], [16, 12], [21.5, 13], [26.4, 17.5], [26.3, 13.5], [27.5, 12.2], [28.6, 11.6], [30, 6.5], [24.8, 9.2], [22, 7.9], [16, 7], [10, 7.9], [7, 10.2], [5.7, 13.5]],
  heir: [[8, 13.5], [7, 5], [11.5, 9], [14.5, 3.5], [18, 8.8], [22.5, 4], [23.5, 12.5]].map(([x, y]) => { const t = (-8 * Math.PI) / 180, dx = x - 16, dy = y - 9; return [16 + dx * Math.cos(t) - dy * Math.sin(t), 9 + dx * Math.sin(t) + dy * Math.cos(t)]; }),
  you: [[5, 14.2], [27, 14.2], [27, 11.6], [22.5, 11.6], [22.5, 0.8], [9.5, 0.8], [9.5, 11.6], [5, 11.6]],
};
const HAT_COL = { security: '#3b4654', chef: '#fffdf6', engineer: '#f2c230', doctor: '#5b4a3a', farmer: '#e3c877', pa: '#3a2f45', cleaner: '#c9503c', heir: '#d94f6a', you: '#25261f' };
// What each job wears, drawn on the body (cm, y up, the body runs from y 0 to about 1.26).
const UNIFORM = {
  security: ['#33415a', (c) => { fillRect(c, -1.1, 0.16, 1.1, 0.28, '#1d2533'); disc(c, -0.48, 0.78, 0.13, '#e8c352'); line(c, [[-0.36, 1.25], [0, 0.95], [0.36, 1.25]], '#e8c352', 0.05); }],
  chef: ['#f7f4ea', (c) => { for (const x of [-0.25, 0.25]) for (const y of [0.3, 0.6, 0.9]) disc(c, x, y, 0.05, '#9a9384'); c.fillStyle = '#c23b2c'; c.beginPath(); c.moveTo(-0.34, 1.26); c.lineTo(0.34, 1.26); c.lineTo(0, 0.92); c.fill(); }],
  engineer: ['#e07a2e', (c) => { fillRect(c, -1.1, 0.42, 1.1, 0.52, '#f2e9a0'); fillRect(c, -1.1, 0.74, 1.1, 0.82, '#f2e9a0'); fillRect(c, -0.08, 0, 0.08, 1.2, '#b85f1f'); }],
  doctor: ['#f4f6f2', (c) => { line(c, [[-0.36, 1.25], [-0.1, 0.45]], '#c9cfc8', 0.05); line(c, [[0.36, 1.25], [0.1, 0.45]], '#c9cfc8', 0.05); c.strokeStyle = '#2c3337'; c.lineWidth = 0.05; c.beginPath(); c.moveTo(-0.3, 1.2); c.quadraticCurveTo(-0.45, 0.55, 0.12, 0.6); c.stroke(); disc(c, 0.16, 0.6, 0.08, '#8c98a4'); fillRect(c, 0.42, 0.62, 0.72, 0.8, '#dfe5e0'); }],
  farmer: ['#c9503c', (c) => { fillRect(c, -0.8, 0, 0.8, 0.82, '#4d6e9a'); line(c, [[-0.55, 0.8], [-0.6, 1.16]], '#4d6e9a', 0.14); line(c, [[0.55, 0.8], [0.6, 1.16]], '#4d6e9a', 0.14); disc(c, -0.55, 0.74, 0.05, '#e8c352'); disc(c, 0.55, 0.74, 0.05, '#e8c352'); for (let y = 0.9; y < 1.3; y += 0.14) line(c, [[-1.1, y], [1.1, y]], 'rgba(255,255,255,.25)', 0.03); }],
  pa: ['#5a5f6b', (c) => { c.fillStyle = '#f7f4ea'; c.beginPath(); c.moveTo(-0.3, 1.26); c.lineTo(0.3, 1.26); c.lineTo(0, 0.6); c.fill(); c.fillStyle = '#2b3a63'; c.beginPath(); c.moveTo(-0.06, 1.2); c.lineTo(0.06, 1.2); c.lineTo(0.09, 0.72); c.lineTo(0, 0.62); c.lineTo(-0.09, 0.72); c.fill(); fillRect(c, 0.45, 0.85, 0.7, 0.9, '#f7f4ea'); }],
  cleaner: ['#6aa9c9', (c) => { fillRect(c, -0.6, 0, 0.6, 0.95, '#8cc0d9'); fillRect(c, -0.35, 0.3, 0.35, 0.6, '#6aa9c9'); line(c, [[-0.6, 0.9], [-0.95, 0.75]], '#8cc0d9', 0.06); }],
  heir: ['#e98aa8', (c) => { c.fillStyle = '#f2c9a6'; c.beginPath(); c.moveTo(-0.28, 1.26); c.lineTo(0.28, 1.26); c.lineTo(0, 0.82); c.fill(); c.strokeStyle = '#e8c352'; c.lineWidth = 0.05; c.beginPath(); c.arc(0, 1.25, 0.3, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }],
  you: ['#1e1f24', (c) => { c.fillStyle = '#f7f4ea'; c.beginPath(); c.moveTo(-0.32, 1.26); c.lineTo(0.32, 1.26); c.lineTo(0, 0.5); c.fill(); c.fillStyle = '#c23b2c'; c.beginPath(); c.moveTo(-0.22, 1.16); c.lineTo(0, 1.08); c.lineTo(0.22, 1.16); c.lineTo(0.22, 0.98); c.lineTo(0, 1.06); c.lineTo(-0.22, 0.98); c.fill(); c.strokeStyle = '#e8c352'; c.lineWidth = 0.04; c.beginPath(); c.moveTo(0.35, 0.55); c.quadraticCurveTo(0.6, 0.4, 0.8, 0.6); c.stroke(); disc(c, -0.6, 0.95, 0.09, '#c23b2c'); }],
};
const FAULT_AT = { generator: [0, -7.8], pump: [0, -2.9], fridge: [3, -8.8], lights: [1, 0.8], cabinet: [2, -8.2] };   // floor, x

// Where pawns stand: floor (6 is the surface) and a stretch of x.
const ZONES = {
  surface: [6, 2, 17], you: [5, -6.3, -6.3],
  suite: [5, -2.6, 3.2], vault: [5, 8.4, 13.2],
  security: [4, -3.4, 2.4], cell: [4, 7.2, 10],
  kitchen: [3, -6.2, -2.2], mess: [3, 3, 12.4],
  medical: [2, -5.2, -0.8], bunks: [2, 3.6, 13.2],
  farm: [1, -8.4, 12.4],
  plant: [0, -6.6, -0.4], stores: [0, 5.2, 13.2],
};
const floorH = (fl) => fl * FLOOR;

// --- a very small SVG painter, enough for the face drawings in ui/faces.js ---
function drawSVG(c, markup) {
  const re = /<(circle|rect|path|ellipse)\s([^>]*?)\/>/g;
  let m;
  while ((m = re.exec(markup))) {
    const a = {};
    m[2].replace(/([\w-]+)="([^"]*)"/g, (_, k, v) => { a[k] = v; return ''; });
    c.save();
    const rot = a.transform && /rotate\(([-\d.]+) ([-\d.]+) ([-\d.]+)\)/.exec(a.transform);
    if (rot) { c.translate(+rot[2], +rot[3]); c.rotate((+rot[1] * Math.PI) / 180); c.translate(-rot[2], -rot[3]); }
    if (a.opacity) c.globalAlpha = +a.opacity;
    let p = new Path2D();
    if (m[1] === 'circle') p.arc(+a.cx, +a.cy, +a.r, 0, 6.2832);
    else if (m[1] === 'ellipse') p.ellipse(+a.cx, +a.cy, +a.rx, +a.ry, 0, 0, 6.2832);
    else if (m[1] === 'rect') { if (a.rx) p.roundRect(+a.x, +a.y, +a.width, +a.height, +a.rx); else p.rect(+a.x, +a.y, +a.width, +a.height); } else p = new Path2D(a.d);
    if (a.fill !== 'none' && (a.fill || !a.stroke)) { c.fillStyle = a.fill || '#000'; c.fill(p); }
    if (a.stroke) { c.strokeStyle = a.stroke; c.lineWidth = +(a['stroke-width'] || 1); c.lineCap = a['stroke-linecap'] || 'butt'; c.stroke(p); }
    c.restore();
  }
}
// Text in a print: the context is in cm with y up, so step out to pixels to set the type.
function text(c, str, x, y, size, colour, font = '600 SIZEpx "Barlow Condensed", "Arial Narrow", sans-serif', align = 'left') {
  const m = c.getTransform(), p = new DOMPoint(x, y).matrixTransform(m), d = Math.hypot(m.a, m.b);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
  c.font = font.replace('SIZE', (size * d).toFixed(1)); c.fillStyle = colour; c.textAlign = align; c.fillText(str, p.x, p.y);
  c.restore();
}
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const rectPts = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const circle = (cx, cy, r, n = 20) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * 6.2832) * r, cy + Math.sin((i / n) * 6.2832) * r]);
const fillRect = (c, x0, y0, x1, y1, col) => { c.fillStyle = col; c.fillRect(x0, y0, x1 - x0, y1 - y0); };
const line = (c, pts, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
const disc = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); };

// The far ruins on the horizon, printed on the day sky and the night sky alike.
function ruins(c, col) {
  c.fillStyle = col;
  c.beginPath(); c.moveTo(-20, GROUND);
  for (const [x, y] of [[-20, 1.6], [-18.6, 1.6], [-18.6, 2.5], [-17.4, 2.5], [-17.4, 1.2], [-13, 1.2], [-13, 0.5], [-4, 0.5], [-4, 1.4], [-2.8, 1.4], [-2.8, 2.2], [-1.8, 2.6], [-1.8, 0.9], [6, 0.9], [6, 1.9], [7.4, 1.9], [7.4, 3], [8.6, 3], [8.6, 1.4], [16, 1.4], [16, 2.3], [17.6, 2.3], [17.6, 1], [20, 1]]) c.lineTo(x, GROUND + y);
  c.lineTo(20, GROUND); c.closePath(); c.fill();
}
// The night: a second sky, slotted in front of the first when the lights go out.
function paintNight(c) {
  const g = c.createLinearGradient(0, GROUND, 0, TALL);
  g.addColorStop(0, '#463c5c'); g.addColorStop(0.35, '#232848'); g.addColorStop(1, '#0c1128');
  c.fillStyle = g; c.fillRect(-EARTH, GROUND, EARTH * 2, TALL - GROUND);
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 90; i++) { const x = -EARTH + r() * EARTH * 2, y = GROUND + 1.6 + r() * (TALL - GROUND - 1.8); disc(c, x, y, 0.03 + r() * r() * 0.08, `rgba(255,248,225,${(0.45 + r() * 0.55).toFixed(2)})`); }
  ruins(c, '#141725');
}

// --- the print on the back board: sky, earth, and the wall of every room ---
const WALLS = ['#3b4440', '#3d3154', '#cfe2d5', '#dcc096', '#52616f', '#7b3340'];   // plant, farm, medical, kitchen, security, suite
function paintBack(c) {
  // sky above the ground
  const sky = c.createLinearGradient(0, GROUND, 0, TALL);
  sky.addColorStop(0, '#f0cb92'); sky.addColorStop(1, '#c57b45');
  c.fillStyle = sky; c.fillRect(-EARTH, GROUND, EARTH * 2, TALL - GROUND);
  c.fillStyle = 'rgba(255,236,190,.55)';
  for (const [x, y, w] of [[-14, 31.6, 9], [3, 30.2, 12], [14, 32.8, 7]]) { c.beginPath(); c.ellipse(x, y, w / 2, 0.22, 0, 0, 6.2832); c.fill(); }
  ruins(c, '#b97a4c');
  // earth either side of the shaft
  fillRect(c, -EARTH, 0, EARTH, GROUND, '#6a5340');
  for (const [y0, y1, col] of [[20.5, 24, '#5d4838'], [11, 15.5, '#75604a'], [2, 6.5, '#57422f']]) {
    c.fillStyle = col; c.beginPath(); c.moveTo(-EARTH, y0);
    for (let x = -EARTH; x <= EARTH; x += 2) c.lineTo(x, y1 + Math.sin(x * 0.9 + y0) * 0.5);
    c.lineTo(EARTH, y0); c.closePath(); c.fill();
  }
  // the lift shaft
  fillRect(c, -HALF, 0, SHAFT, GROUND, '#23282a');
  line(c, [[-13.1, 0], [-13.1, GROUND]], '#4c5355', 0.08); line(c, [[-14.4, 0], [-14.4, GROUND]], '#3a4042', 0.14); line(c, [[-11.8, 0], [-11.8, GROUND]], '#3a4042', 0.14);
  // room walls
  for (let fl = 0; fl < 6; fl++) {
    const y = floorH(fl);
    fillRect(c, SHAFT, y, HALF, y + FLOOR, WALLS[fl]);
  }
  let y = floorH(5);   // suite: dado rail, striped paper, a painting, the cinema's empty screen
  c.fillStyle = 'rgba(0,0,0,.14)'; for (let x = SHAFT; x < 6; x += 0.9) c.fillRect(x, y + 1.5, 0.45, FLOOR - 1.5);
  fillRect(c, SHAFT, y, 6.2, y + 1.5, '#5f2531'); fillRect(c, SHAFT, y + 1.44, 6.2, y + 1.56, '#d9b24e');
  fillRect(c, -9.9, y + 2.1, -7.3, y + 3.9, '#d9b24e'); fillRect(c, -9.7, y + 2.3, -7.5, y + 3.7, '#c23b2c'); fillRect(c, -9.7, y + 2.85, -7.5, y + 3.1, '#8e2a20');
  fillRect(c, 1, y + 1.25, 5.4, y + 3.75, '#3c1820'); fillRect(c, 1.15, y + 1.4, 5.25, y + 3.6, '#4d222b');
  fillRect(c, 6.2, y, HALF, y + FLOOR, '#4a1f29');
  for (let x = 6.8; x < HALF; x += 1.1) line(c, [[x, y], [x, y + FLOOR]], 'rgba(0,0,0,.2)', 0.06);
  y = floorH(4);       // security: tiles, a board of keys
  for (let x = SHAFT; x < HALF; x += 1.15) line(c, [[x, y], [x, y + FLOOR]], 'rgba(255,255,255,.06)', 0.05);
  for (let k = 1; k < 4; k++) line(c, [[SHAFT, y + k * 1.15], [HALF, y + k * 1.15]], 'rgba(255,255,255,.06)', 0.05);
  fillRect(c, 0.2, y + 2.2, 3.6, y + 3.9, '#3d4954');
  for (let i = 0; i < 8; i++) disc(c, 0.7 + (i % 4) * 0.8, y + 3.45 - Math.floor(i / 4) * 0.75, 0.16, '#e8c352');
  y = floorH(3);       // kitchen: tiles, a rail of pans; mess: a notice
  fillRect(c, SHAFT, y, -1.5, y + 2.3, '#c9ab7b');
  for (let x = SHAFT; x < -1.5; x += 0.76) line(c, [[x, y], [x, y + 2.3]], 'rgba(90,60,30,.25)', 0.04);
  line(c, [[-7, y + 3.9], [-2, y + 3.9]], '#5c5d55', 0.1);
  for (const [x, r] of [[-6.3, 0.5], [-5, 0.62], [-3.7, 0.44]]) { line(c, [[x, y + 3.9], [x, y + 3.9 - 0.5]], '#5c5d55', 0.07); disc(c, x, y + 3.4 - r, r, '#8c8f86'); disc(c, x, y + 3.4 - r, r * 0.62, '#75786f'); }
  fillRect(c, 5.6, y + 2.2, 9.4, y + 3.9, '#f3ead6'); line(c, [[6, y + 3.4], [9, y + 3.4]], '#b5482e', 0.14);
  for (let k = 0; k < 3; k++) line(c, [[6, y + 3.0 - k * 0.3], [8.6 - k * 0.5, y + 3.0 - k * 0.3]], '#8a8672', 0.06);
  y = floorH(2);       // medical: a cabinet with a cross, a height chart
  fillRect(c, SHAFT, y, 0.8, y + 1.3, '#b9d2c0');
  fillRect(c, -4.6, y + 2, -2.2, y + 4, '#fffdf6'); fillRect(c, -3.65, y + 2.4, -3.15, y + 3.6, '#c23b2c'); fillRect(c, -4, y + 2.75, -2.8, y + 3.25, '#c23b2c');
  fillRect(c, 0.8, y, HALF, y + FLOOR, '#b7c6cf');
  y = floorH(1);       // farm: pipes and a faint grid
  for (let k = 0; k < 6; k++) line(c, [[SHAFT, y + 0.5 + k * 0.7], [HALF, y + 0.5 + k * 0.7]], 'rgba(255,143,208,.07)', 0.05);
  line(c, [[SHAFT, y + 4.1], [HALF, y + 4.1]], '#55476f', 0.22);
  y = floorH(0);       // plant: pipes, a gauge; stores: stencil
  line(c, [[SHAFT, y + 3.9], [2.5, y + 3.9]], '#59635d', 0.3); line(c, [[SHAFT, y + 3.3], [-4.6, y + 3.3], [-4.6, y + 3.9]], '#59635d', 0.18);
  disc(c, 0.9, y + 2.6, 0.62, '#e9e4d2'); disc(c, 0.9, y + 2.6, 0.5, '#fffdf6'); line(c, [[0.9, y + 2.6], [1.2, y + 2.95]], '#b5482e', 0.07);
  fillRect(c, 2.5, y, HALF, y + FLOOR, '#343c38');
  text(c, 'STORES', 8.7, y + 3.2, 0.9, 'rgba(233,223,198,.45)', undefined, 'center');
  // the sun
  disc(c, 12.6, GROUND + 4.1, 2.4, 'rgba(255,240,196,.35)');
}
function paintEarth(c, side) {
  fillRect(c, -3, 0, 3, GROUND, '#6f5843');
  for (const [y0, y1, col] of [[19.5, 23, '#5d4838'], [10, 14.5, '#7b6650'], [1.5, 5.5, '#57422f']]) {
    c.fillStyle = col; c.beginPath(); c.moveTo(-3, y0);
    for (let x = -3; x <= 3; x += 0.5) c.lineTo(x, y1 + Math.sin(x * 1.7 + y0 + side) * 0.35);
    c.lineTo(3, y0); c.closePath(); c.fill();
  }
  for (const [x, y, r] of side > 0 ? [[0.4, 8, 0.7], [-1, 17.4, 0.5], [1.2, 24.6, 0.42], [-0.6, 3, 0.36]] : [[-0.2, 12.2, 0.8], [0.9, 21.4, 0.46], [-1.1, 5.2, 0.5], [0.6, 26, 0.3]]) { c.fillStyle = '#8a745c'; c.beginPath(); c.ellipse(x, y, r * 1.4, r, 0, 0, 6.2832); c.fill(); }
  if (side > 0) { line(c, [[-0.9, 14.3], [0.7, 14.9]], '#e2d8c2', 0.2); disc(c, -1, 14.25, 0.2, '#e2d8c2'); disc(c, 0.8, 14.95, 0.2, '#e2d8c2'); }
  fillRect(c, -3, GROUND - 0.5, 3, GROUND, '#3f3024');
}
function paintBase(c) {
  fillRect(c, -22.5, -1, 22.5, 12, '#2f3b34');
  c.strokeStyle = 'rgba(233,223,198,.5)'; c.lineWidth = 0.06; c.strokeRect(-21.6, 0.5, 43.2, 4.2);
  text(c, 'BUNKER BILLIONAIRE', -20.9, 1.35, 1.9, '#e9dfc6');
  text(c, 'SILO No. 7  ·  CROSS-SECTION  ·  NOT TO SCALE', -20.9, 3.6, 0.72, 'rgba(233,223,198,.7)');
  text(c, 'SURFACE SAFE IN 30 DAYS', 20.9, 3.6, 0.72, '#e2a62b', undefined, 'right');
}

// --- parts ---
// kind: 'wall' (stands parallel to the back board at height h and depth d), 'floor' (lies parallel to
// the base at height h, its front edge at depth d), 'side' (stands across the model at x).
function buildParts() {
  const P = [];
  const add = (o) => { P.push({ kind: 'wall', h: 0, d: 0, x: 0, z0: -0.0225, z1: 0.0225, col: '#f3ead6', back: '#efe9da', ...o }); return P[P.length - 1]; };
  // the boards
  add({ id: 'base', kind: 'floor', d: 10, pts: rectPts(-22.5, 0, 22.5, 10.6), z0: -BASE_T, z1: 0, mat: 1, col: '#2f3b34', print: { box: [-22.5, 0, 22.5, 10.6], draw: paintBase }, flip: true });
  add({ id: 'back', pts: rectPts(-EARTH, 0, EARTH, TALL), z0: -0.15, z1: 0, mat: 1, col: '#6a5340', back: '#8a7a5c', print: { box: [-EARTH, 0, EARTH, TALL], draw: paintBack } });
  for (let fl = 1; fl <= 5; fl++) add({ id: 'floor' + fl, kind: 'floor', h: floorH(fl), d: DEPTH, pts: rectPts(SHAFT, 0, HALF, DEPTH), z0: -SLAB, z1: 0, mat: 1, col: '#b3ae9f', back: '#9d9889', edge: '#d8d4c6' });
  add({ id: 'ground', kind: 'floor', h: GROUND, d: DEPTH, pts: rectPts(-EARTH, 0, EARTH, DEPTH), z0: -SLAB, z1: 0, mat: 1, col: '#7a6048', back: '#6a5340', edge: '#57422f' });
  for (const s of [-1, 1]) {
    add({ id: 'earth' + s, d: DEPTH, x: s * 17.5, pts: rectPts(-2.5, 0, 2.5, GROUND - SLAB), col: '#6f5843', print: { box: [-2.5, 0, 2.5, GROUND], draw: (c) => paintEarth(c, s) } });
    add({ id: 'outer' + s, kind: 'side', x: s * EARTH, pts: rectPts(0, 0, DEPTH, GROUND - SLAB), z0: -0.08, z1: 0.08, mat: 1, col: '#8a7a5c', back: '#8a7a5c' });
    add({ id: 'silo' + s, kind: 'side', x: s * HALF, pts: rectPts(0, 0, DEPTH - 0.05, GROUND - SLAB), z0: -0.1, z1: 0.1, mat: 1, col: '#b9b3a2', back: '#b9b3a2' });
  }
  // the lift shaft wall, with a doorway on every floor
  add({ id: 'shaft', kind: 'side', x: SHAFT, pts: rectPts(0, 0, DEPTH - 0.05, GROUND - SLAB), holes: [0, 1, 2, 3, 4, 5].map((fl) => rectPts(1.2, floorH(fl) + 0.02 + (fl ? 0 : 0.05), 3.5, floorH(fl) + 3.3)), z0: -0.08, z1: 0.08, mat: 1, col: '#a8a393', back: '#8f8b7e' });
  // room dividers
  for (const [fl, x] of [[5, 6.2], [4, 5.4], [2, 0.8], [0, 2.5]]) add({ id: 'div' + fl, kind: 'side', x, h: floorH(fl), pts: rectPts(0, 0, DEPTH - 0.3, FLOOR - SLAB), z0: -0.06, z1: 0.06, col: '#c9c4b4', back: '#c9c4b4' });
  // the lift car
  add({ id: 'lift', move: true, d: 2.6, pts: rectPts(-14.75, 0.05, -11.55, 3.5), col: '#d7b24c', print: { box: [-14.75, 0, -11.55, 3.5], draw: (c) => { fillRect(c, -14.75, 0, -11.55, 3.5, '#d7b24c'); fillRect(c, -14.35, 0.35, -13.3, 3.1, '#8a6f2a'); fillRect(c, -13.0, 0.35, -11.95, 3.1, '#8a6f2a'); } } });

  // floor 0: plant and stores
  let h = floorH(0);
  add({ id: 'generator', h, d: 2.4, pts: [[-10.4, 0], [-5.6, 0], [-5.6, 2.5], [-8.9, 2.5], [-8.9, 4.3], [-9.6, 4.3], [-9.6, 2.5], [-10.4, 2.5]], col: '#59635d', print: { box: [-10.4, 0, -5.6, 4.3], draw: (c) => { fillRect(c, -10.4, 0, -5.6, 4.3, '#59635d'); disc(c, -8.7, 1.3, 0.85, '#2c312e'); line(c, [[-8.7, 0.6], [-8.7, 2]], '#c9c4b4', 0.2); line(c, [[-9.4, 1.3], [-8, 1.3]], '#c9c4b4', 0.2); for (let k = 0; k < 4; k++) line(c, [[-7.3, 0.5 + k * 0.4], [-6, 0.5 + k * 0.4]], '#2c312e', 0.12); disc(c, -6.3, 2.1, 0.17, '#7ee08a'); } } });
  add({ id: 'water', move: true, h, d: 1.9, pts: rectPts(-3.9, 0, -1.9, 3.2), col: '#58b3ae', back: '#58b3ae' });
  add({ id: 'tank', h, d: 2.2, pts: [[-4.5, 0], [-1.3, 0], [-1.3, 3.6], [-1.7, 4], [-4.1, 4], [-4.5, 3.6]], holes: [rectPts(-3.6, 0.55, -2.2, 3.4)], col: '#39423e', back: '#39423e' });
  for (let k = 0; k < 10; k++) {
    const row = k < 6 ? 0 : 1, col = row ? k - 6 : k;
    add({ id: 'crate' + k, move: true, h, d: 2.9 - row * 0.5, pts: rectPts(0, 0, 1.55, 1.2), col: '#c79a5b', at: [4.2 + col * 1.72 + row * 0.86, row * 1.22], print: { box: [0, 0, 1.55, 1.2], share: 'crate', draw: (c) => { fillRect(c, 0, 0, 1.55, 1.2, '#c79a5b'); c.strokeStyle = '#7a5a30'; c.lineWidth = 0.07; c.strokeRect(0.1, 0.1, 1.35, 1); line(c, [[0.1, 0.6], [1.45, 0.6]], '#7a5a30', 0.05); line(c, [[0.1, 0.1], [1.45, 1.1]], 'rgba(122,90,48,.5)', 0.05); } } });
  }
  // floor 1: the farm
  h = floorH(1);
  for (let k = 0; k < 5; k++) {
    const cx = -8 + k * 4.5;
    add({ id: 'plants' + k, h, d: 2.6, pts: [[cx - 1.5, 0.6], [cx + 1.5, 0.6], [cx + 1.7, 1.5], [cx + 1.1, 2.25], [cx + 0.7, 1.7], [cx + 0.2, 2.6], [cx - 0.4, 1.8], [cx - 0.9, 2.4], [cx - 1.7, 1.6]], col: '#6fae4e', back: '#5d9a41', print: { box: [cx - 1.7, 0.6, cx + 1.7, 2.6], draw: (c) => { fillRect(c, cx - 1.7, 0.6, cx + 1.7, 2.6, '#6fae4e'); line(c, [[cx - 0.9, 0.7], [cx - 0.9, 2.2]], '#4f8a36', 0.08); line(c, [[cx + 0.2, 0.7], [cx + 0.2, 2.4]], '#4f8a36', 0.08); line(c, [[cx + 1.1, 0.7], [cx + 1.1, 2.1]], '#4f8a36', 0.08); disc(c, cx - 0.5, 1.5, 0.2, '#d8442f'); disc(c, cx + 0.7, 1.2, 0.18, '#d8442f'); disc(c, cx + 0.1, 1.95, 0.16, '#e0613f'); } } });
    add({ id: 'planter' + k, h, d: 2.9, pts: [[cx - 1.75, 0], [cx + 1.75, 0], [cx + 1.9, 0.85], [cx - 1.9, 0.85]], col: '#8a5a36', back: '#74492b' });
    add({ id: 'lamp' + k, h, d: 2.5, pts: rectPts(cx - 1.5, 3.9, cx + 1.5, 4.2), col: '#ff8fd0', back: '#ff8fd0' });
  }
  // floor 2: medical and bunks
  h = floorH(2);
  add({ id: 'bed', h, d: 2.4, pts: [[-10.4, 0], [-10.1, 0], [-10.1, 0.6], [-6.3, 0.6], [-6.3, 0], [-6, 0], [-6, 1.1], [-9.2, 1.1], [-9.2, 1.5], [-10.4, 1.5]], col: '#fbf8ee', print: { box: [-10.4, 0, -6, 1.5], draw: (c) => { fillRect(c, -10.4, 0, -6, 1.5, '#fbf8ee'); fillRect(c, -8.9, 0.6, -6, 1.1, '#7fb8ad'); fillRect(c, -10.4, 0, -10.1, 1.5, '#9aa39c'); fillRect(c, -6.3, 0, -6, 1.1, '#9aa39c'); } } });
  for (let k = 0; k < 3; k++) { const x = 3 + k * 3.9; add({ id: 'bunk' + k, h, d: 1.5, pts: rectPts(x, 0, x + 3.3, 3.9), holes: [rectPts(x + 0.22, 0.08, x + 3.08, 1.1), rectPts(x + 0.22, 1.75, x + 3.08, 3)], col: '#7d8fa3', back: '#6c7d90' }); }
  // floor 3: kitchen and mess
  h = floorH(3);
  add({ id: 'counter', h, d: 1.5, pts: rectPts(-7.2, 0, -1.8, 1.5), col: '#c7a877', back: '#b0935f' });
  add({ id: 'stove', h, d: 2.2, pts: [[-10.5, 0], [-7.5, 0], [-7.5, 1.9], [-8.1, 1.9], [-8.3, 2.75], [-9.7, 2.75], [-9.9, 1.9], [-10.5, 1.9]], col: '#6c7078', print: { box: [-10.5, 0, -7.5, 2.75], draw: (c) => { fillRect(c, -10.5, 0, -7.5, 1.9, '#6c7078'); fillRect(c, -10.2, 0.25, -7.8, 1.35, '#2d3035'); fillRect(c, -9.95, 1.9, -8.05, 2.75, '#b5482e'); line(c, [[-10, 2.5], [-8, 2.5]], '#8e2a20', 0.08); for (let k = 0; k < 3; k++) disc(c, -10 + k * 0.5, 1.62, 0.1, '#e9e4d2'); } } });
  add({ id: 'table', h, d: 2.5, pts: [[2.2, 0], [2.5, 0], [2.5, 1.3], [12.9, 1.3], [12.9, 0], [13.2, 0], [13.2, 1.6], [2.2, 1.6]], col: '#8a5a36', back: '#74492b' });
  // floor 4: security
  h = floorH(4);
  add({ id: 'desk', h, d: 2.3, pts: [[-10.3, 0], [-4.5, 0], [-4.5, 1.5], [-5, 1.5], [-5, 3.9], [-9.8, 3.9], [-9.8, 1.5], [-10.3, 1.5]], col: '#39434e', print: { box: [-10.3, 0, -4.5, 3.9], draw: (c) => { fillRect(c, -10.3, 0, -4.5, 3.9, '#39434e'); for (let k = 0; k < 4; k++) fillRect(c, -9.6 + (k % 2) * 2.3, 1.75 + Math.floor(k / 2) * 1.1, -7.55 + (k % 2) * 2.3, 2.7 + Math.floor(k / 2) * 1.1, '#1b2127'); fillRect(c, -10.3, 1.38, -4.5, 1.5, '#2a323a'); } } });
  add({ id: 'screens', move: true, h, d: 2.36, pts: rectPts(-9.7, 1.7, -5.1, 3.85), col: '#1b2127', print: { box: [-9.7, 1.7, -5.1, 3.85], draw: (c) => { fillRect(c, -9.7, 1.7, -5.1, 3.85, '#1b2127'); for (let k = 0; k < 4; k++) { const x = -9.6 + (k % 2) * 2.3, y = 1.75 + Math.floor(k / 2) * 1.1; fillRect(c, x, y, x + 2.05, y + 0.95, '#2fbf7a'); fillRect(c, x + 0.15, y + 0.12, x + 0.9, y + 0.5, '#1d7a4c'); line(c, [[x + 1.1, y + 0.25], [x + 1.9, y + 0.25]], '#bff5d8', 0.06); } } } });
  add({ id: 'cell', h, d: 3, pts: rectPts(5.9, 0, 10.9, FLOOR - SLAB - 0.05), holes: [0, 1, 2, 3, 4, 5].map((k) => rectPts(6.25 + k * 0.76, 0.35, 6.75 + k * 0.76, 3.95)), col: '#2a323a', back: '#2a323a' });
  add({ id: 'lockers', h, d: 1, pts: rectPts(11.3, 0, 14.6, 3.7), col: '#6c7f8f', print: { box: [11.3, 0, 14.6, 3.7], draw: (c) => { fillRect(c, 11.3, 0, 14.6, 3.7, '#6c7f8f'); for (let k = 1; k < 3; k++) line(c, [[11.3 + k * 1.1, 0], [11.3 + k * 1.1, 3.7]], '#3d4954', 0.07); for (let k = 0; k < 3; k++) { line(c, [[11.6 + k * 1.1, 3.2], [12.1 + k * 1.1, 3.2]], '#3d4954', 0.06); line(c, [[11.6 + k * 1.1, 3], [12.1 + k * 1.1, 3]], '#3d4954', 0.06); } } } });
  // floor 5: your suite and the vault
  h = floorH(5);
  add({ id: 'tubwater', move: true, h, d: 2.5, pts: rectPts(-10.4, 0.8, -7.6, 1.62), col: '#58b3ae', back: '#58b3ae' });
  add({ id: 'steam', move: true, h, d: 2.3, pts: [[-9.9, 1.7], [-9.5, 1.9], [-9.7, 2.4], [-9.3, 2.9], [-9.6, 3.4], [-9.9, 3.1], [-10.1, 2.5], [-9.8, 2.1]], col: '#f6f1e2', back: '#f6f1e2' });
  add({ id: 'steam2', move: true, h, d: 2.4, pts: [[-8.6, 1.7], [-8.2, 2], [-8.4, 2.5], [-8.1, 2.9], [-8.4, 3.2], [-8.7, 2.8], [-8.8, 2.2]], col: '#f6f1e2', back: '#f6f1e2' });
  add({ id: 'tub', h, d: 2.7, pts: [[-10.6, 0], [-7.4, 0], [-7.2, 1.45], [-10.8, 1.45]], col: '#e9dfc6', back: '#d8cdb0' });
  add({ id: 'chair', h, d: 2.2, pts: [[-3.4, 0], [-0.9, 0], [-0.9, 1.3], [-1.4, 1.3], [-1.4, 2.5], [-3, 2.5], [-3, 1.3], [-3.4, 1.3]], col: '#96323c', back: '#7b2731' });
  add({ id: 'chandelier', h, d: 2.4, pts: [[0.9, 4.33], [1.1, 4.33], [1.1, 3.6], [2.3, 3.6], [2.3, 3.1], [1.9, 3.1], [1.9, 3.35], [1.25, 3.35], [1.25, 2.9], [0.75, 2.9], [0.75, 3.35], [0.1, 3.35], [0.1, 3.1], [-0.3, 3.1], [-0.3, 3.6], [0.9, 3.6]], col: '#d9b24e', back: '#c19a3b' });
  add({ id: 'film', move: true, h, d: 0.3, pts: rectPts(1.15, 1.4, 5.25, 3.6), col: '#fff3c4', print: { box: [1.15, 1.4, 5.25, 3.6], draw: (c) => { fillRect(c, 1.15, 1.4, 5.25, 3.6, '#ffe9a8'); fillRect(c, 1.15, 1.4, 5.25, 2.2, '#e3b45c'); disc(c, 4.3, 3, 0.36, '#fff8dc'); c.fillStyle = '#b97a2e'; c.beginPath(); c.moveTo(1.15, 2.2); c.lineTo(2.3, 3); c.lineTo(3.2, 2.4); c.lineTo(3.9, 2.8); c.lineTo(5.25, 2.2); c.closePath(); c.fill(); } } });
  add({ id: 'rack', h, d: 1, pts: rectPts(11.2, 0, 14.6, 3.8), col: '#3d2a1c', print: { box: [11.2, 0, 14.6, 3.8], draw: (c) => { fillRect(c, 11.2, 0, 14.6, 3.8, '#3d2a1c'); for (let k = 0; k < 16; k++) { const x = 11.75 + (k % 4) * 0.78, y = 0.55 + Math.floor(k / 4) * 0.88; disc(c, x, y, 0.3, '#1d130c'); disc(c, x, y, 0.22, k % 5 === 3 ? '#b5482e' : '#7fae6a'); } } } });
  for (let k = 0; k < 6; k++) { const row = k < 3 ? 0 : k < 5 ? 1 : 2, col = row === 0 ? k : row === 1 ? k - 3 : 0; add({ id: 'gold' + k, move: true, h, d: 2.8, pts: [[0.08, 0], [1.02, 0], [0.9, 0.42], [0.2, 0.42]], col: '#e2bd4c', back: '#c9a13b', at: [7 + col * 1.12 + row * 0.56, row * 0.44] }); }
  // the surface
  h = GROUND;
  add({ id: 'hatch', h, d: 3, pts: [[-15.8, 0], [-10.2, 0], [-10.2, 1], [-10.9, 1.7], [-12, 2], [-14, 2], [-15.1, 1.7], [-15.8, 1]], col: '#b9b3a2', print: { box: [-15.8, 0, -10.2, 2], draw: (c) => { fillRect(c, -15.8, 0, -10.2, 2, '#b9b3a2'); fillRect(c, -14.2, 0, -11.8, 1.5, '#6d6f66'); line(c, [[-13, 0], [-13, 1.5]], '#4a4c45', 0.07); disc(c, -12.4, 0.75, 0.14, '#e2a62b'); } } });
  add({ id: 'sign', h, d: 3.3, pts: [[-8.05, 0], [-7.85, 0], [-7.85, 1.3], [-7, 1.3], [-7.95, 2.9], [-8.9, 1.3], [-8.05, 1.3]], col: '#e8b92e', print: { box: [-8.9, 0, -7, 2.9], draw: (c) => { fillRect(c, -8.9, 0, -7, 2.9, '#e8b92e'); fillRect(c, -8.05, 0, -7.85, 1.3, '#5c5d55'); disc(c, -7.95, 1.85, 0.2, '#25261f'); for (let k = 0; k < 3; k++) { const a = k * 2.094 + 1.57; disc(c, -7.95 + Math.cos(a) * 0.4, 1.85 + Math.sin(a) * 0.4, 0.15, '#25261f'); } } } });
  add({ id: 'tree', h, d: 2.2, pts: [[1.3, 0], [2.3, 0], [2.05, 1.6], [3.4, 2.9], [3.2, 3.15], [2.1, 2.3], [2.15, 3.6], [2.9, 4.5], [2.65, 4.7], [1.95, 3.9], [1.7, 5.2], [1.4, 5.2], [1.5, 2.9], [0.3, 3.9], [0.1, 3.65], [1.45, 2.3]], col: '#4a3626', back: '#3d2c1f' });
  add({ id: 'ruinsR', h, d: 1.1, pts: [[6, 0], [19.6, 0], [19.6, 2.1], [18.3, 2.1], [18.3, 3.2], [17.2, 3.2], [17.2, 1.7], [15.4, 1.7], [15.4, 2.6], [14.6, 2.6], [14.6, 3.6], [13.5, 3.9], [13.5, 1.5], [10.2, 1.5], [10.2, 2.3], [9, 2.3], [9, 1.2], [6, 1.2]], col: '#9a6642', back: '#85563a' });
  add({ id: 'ruinsL', h, d: 1.6, pts: [[-19.6, 0], [-16.4, 0], [-16.4, 1.3], [-17.3, 1.3], [-17.3, 2.7], [-18.3, 2.9], [-18.3, 1.8], [-19.6, 1.8]], col: '#8c5b3b', back: '#7a4e33' });
  add({ id: 'sun', h, d: 0.12, pts: circle(12.6, 4.1, 1.5, 28), col: '#fbe6ad', back: '#fbe6ad', hasBack: false });
  for (let k = 0; k < 8; k++) add({ id: 'grave' + k, move: true, h, d: 3.6, pts: [[0.22, 0], [0.5, 0], [0.5, 1.05], [0.9, 1.05], [0.9, 1.32], [0.5, 1.32], [0.5, 1.75], [0.22, 1.75], [0.22, 1.32], [-0.18, 1.32], [-0.18, 1.05], [0.22, 1.05]], col: '#efe7d3', at: [-6 + k * 1.1, 0] });

  add({ id: 'nightsky', move: true, d: 0.1, pts: rectPts(-EARTH, GROUND, EARTH, TALL), col: '#1c2140', back: '#1c2140', print: { box: [-EARTH, GROUND, EARTH, TALL], draw: paintNight } });
  add({ id: 'moon', move: true, h: GROUND, d: 0.22, pts: circle(-11.5, 4.6, 1.15, 28), col: '#efe9d2', back: '#efe9d2', hasBack: false, print: { box: [-12.65, 3.45, -10.35, 5.75], draw: (c) => { fillRect(c, -12.7, 3.4, -10.3, 5.8, '#efe9d2'); for (const [x, y, r] of [[-11.9, 4.9, 0.28], [-11.1, 4.2, 0.2], [-11.3, 5.2, 0.12], [-12.1, 4.15, 0.1]]) disc(c, x, y, r, '#d9d2b8'); } } });

  // a label strip along the front of every floor, as on a museum model
  const NAMES = [['6 · PLANT ROOM', -4.4, 'STORES', 8.7], ['5 · HYDROPONIC FARM', 1.9, '', 0], ['4 · INFIRMARY', -5.2, 'DORMITORY', 7.9], ['3 · KITCHEN', -6.3, 'MESS HALL', 7.6], ['2 · SECURITY', -3, 'THE CELL', 10.2], ['1 · YOUR SUITE', -2.5, 'THE VAULT', 10.6]];
  NAMES.forEach(([l, lx, r, rx], fl) => {
    const top = 0.03, bot = -SLAB - 0.5;
    add({ id: 'fascia' + fl, h: floorH(fl + 1), d: DEPTH + 0.05, pts: rectPts(SHAFT - 0.05, bot, HALF + 0.05, top), z0: -0.03, z1: 0.03, col: '#26302a', back: '#26302a', print: { box: [SHAFT - 0.05, bot, HALF + 0.05, top], draw: (c) => {
      fillRect(c, SHAFT - 0.1, bot - 0.1, HALF + 0.1, top + 0.1, '#26302a');
      line(c, [[SHAFT + 0.15, top - 0.12], [HALF - 0.15, top - 0.12]], 'rgba(233,223,198,.35)', 0.025);
      line(c, [[SHAFT + 0.15, bot + 0.1], [HALF - 0.15, bot + 0.1]], 'rgba(233,223,198,.35)', 0.025);
      text(c, l, lx, bot + 0.2, 0.5, '#e9dfc6', undefined, 'center');
      if (r) text(c, r, rx, bot + 0.2, 0.5, '#e9dfc6', undefined, 'center');
    } } });
  });
  // a lamp hanging in each room
  const DROP = 0.5;   // the cord is long enough for the shade to hang below the label strip
  const LAMP = [[-0.03, 0], [0.03, 0], [0.03, -0.68], [0.48, -1.05], [0.2, -1.05], [0.17, -1.15], [0.1, -1.22], [0, -1.25], [-0.1, -1.22], [-0.17, -1.15], [-0.2, -1.05], [-0.48, -1.05], [-0.03, -0.68]].map(([a, b]) => [a, b < -0.5 ? b - DROP : b]);
  for (const [fl, x] of [[0, -6.4], [0, 8.7], [2, -3.2], [2, 8], [3, -5], [3, 8], [4, -1.5]]) add({ id: `lamp${fl}:${x}`, h: floorH(fl + 1) - SLAB, d: 2, pts: LAMP.map(([a, b]) => [a + x, b]), col: '#b08a3a', back: '#8a6a2a', print: { box: [-0.5, -1.27 - DROP, 0.5, 0.02], share: 'lamp', draw: (c) => { fillRect(c, -0.55, -1.3 - DROP, 0.55, 0.05, '#b08a3a'); fillRect(c, -0.05, -0.7 - DROP, 0.05, 0.05, '#2c2f2a'); c.fillStyle = '#fff3c4'; c.beginPath(); c.arc(0, -1.05 - DROP, 0.2, Math.PI, 0); c.fill(); line(c, [[-0.4, -1.02 - DROP], [0.4, -1.02 - DROP]], '#7a5a22', 0.04); } }, at: [0, 0] });

  // more in the rooms
  h = floorH(0);
  add({ id: 'pipe', h, d: 1.2, pts: rectPts(1.3, 0, 1.6, FLOOR - SLAB), col: '#59635d', back: '#4c5552' });
  add({ id: 'valve', h, d: 1.3, pts: circle(1.45, 2.1, 0.55, 24), holes: [circle(1.45, 2.1, 0.38, 20)], col: '#b5482e', back: '#8e2a20' });
  add({ id: 'shelf', h, d: 1.2, pts: rectPts(3.6, 0, 14.4, 3.9), holes: [rectPts(3.85, 0.15, 14.15, 1.75), rectPts(3.85, 2.0, 14.15, 3.6)], col: '#7a5a30', back: '#6a4c26' });
  add({ id: 'tins', h, d: 1.1, pts: rectPts(3.85, 2.0, 14.15, 2.8), col: '#343c38', print: { box: [3.85, 2.0, 14.15, 2.8], draw: (c) => { fillRect(c, 3.85, 2, 14.15, 2.8, '#343c38'); const cols = ['#b5482e', '#c9a13b', '#2f8580', '#b5482e', '#5d9f52', '#c9a13b']; for (let k = 0; k < 24; k++) { const x = 4 + k * 0.42; fillRect(c, x, 2.02, x + 0.34, 2.62, cols[k % 6]); fillRect(c, x, 2.25, x + 0.34, 2.4, '#efe7d3'); } } } });
  h = floorH(2);
  add({ id: 'drip', h, d: 2.1, pts: [[-5.65, 0], [-5.0, 0], [-5.0, 0.12], [-5.27, 0.12], [-5.27, 3.3], [-4.95, 3.3], [-4.95, 3.42], [-5.7, 3.42], [-5.7, 3.3], [-5.38, 3.3], [-5.38, 0.12], [-5.65, 0.12]], col: '#9aa39c', back: '#9aa39c' });
  add({ id: 'dripbag', h, d: 2.15, pts: [[-5.5, 2.45], [-5.15, 2.45], [-5.1, 3.25], [-5.55, 3.25]], col: '#cfe8e4', back: '#cfe8e4' });
  for (let k = 0; k < 3; k++) { const x = 3 + k * 3.9; for (const y of [1.1, 3.0]) add({ id: `blanket${k}:${y}`, h, d: 1.56, pts: rectPts(x + 0.22, y - 0.3, x + 3.08, y + 0.02), col: ['#c94f4f', '#5d9f52', '#c9a13b'][k], back: '#9c3a3a' }); }
  h = floorH(3);
  add({ id: 'bench', h, d: 3.05, pts: [[2.6, 0], [2.8, 0], [2.8, 0.45], [12.6, 0.45], [12.6, 0], [12.8, 0], [12.8, 0.62], [2.6, 0.62]], col: '#74492b', back: '#5f3b22' });
  add({ id: 'jug', h, d: 2.42, pts: [[5, 1.3], [5.6, 1.3], [5.6, 2.15], [5.75, 2.32], [4.95, 2.32], [5, 2.15]], col: '#d8e2e6', back: '#c4ced2' });
  add({ id: 'mug1', h, d: 2.42, pts: rectPts(7.2, 1.3, 7.55, 1.9), col: '#c23b2c', back: '#a8331f' });
  add({ id: 'mug2', h, d: 2.42, pts: rectPts(9.6, 1.3, 9.95, 1.9), col: '#2f8580', back: '#2a7671' });
  add({ id: 'pot', h, d: 2.0, pts: [[-6.6, 1.5], [-5.2, 1.5], [-5.2, 2.3], [-5.0, 2.4], [-6.8, 2.4], [-6.6, 2.3]], col: '#8c8f86', back: '#75786f' });
  h = floorH(4);
  add({ id: 'deskchair', h, d: 2.95, pts: [[-8.2, 0], [-8.0, 0], [-8.0, 0.55], [-7.0, 0.55], [-7.0, 0], [-6.8, 0], [-6.8, 0.75], [-6.9, 0.75], [-6.9, 1.8], [-8.1, 1.8], [-8.1, 0.75], [-8.2, 0.75]], col: '#2a323a', back: '#232a31' });
  h = floorH(5);
  add({ id: 'safe', h, d: 1.6, pts: rectPts(8.2, 0, 10.6, 2.4), col: '#4c5355', print: { box: [8.2, 0, 10.6, 2.4], draw: (c) => { fillRect(c, 8.2, 0, 10.6, 2.4, '#4c5355'); c.strokeStyle = '#2f3436'; c.lineWidth = 0.06; c.strokeRect(8.4, 0.2, 2, 2); disc(c, 9.4, 1.25, 0.36, '#8c8f86'); disc(c, 9.4, 1.25, 0.24, '#5c6163'); line(c, [[9.4, 1.25], [9.55, 1.45]], '#e8c352', 0.05); line(c, [[10.1, 0.9], [10.1, 1.6]], '#8c8f86', 0.09); } } });

  // cameras: one in the corner of each room, with a red eye
  for (let fl = 0; fl < 6; fl++) add({ id: 'cam' + fl, move: true, h: floorH(fl), d: 0.6, pts: [[13.3, 3.45], [14.5, 3.75], [14.5, 4.15], [13.3, 3.95]], col: '#25261f', print: { box: [13.3, 3.45, 14.5, 4.15], share: 'cam', draw: (c) => { fillRect(c, 13.3, 3.45, 14.5, 4.15, '#25261f'); disc(c, 13.62, 3.74, 0.17, '#ff4a3a'); } } });
  // markers: a hazard flag for each machine that can break
  for (const sys in FAULT_AT) add({ id: 'flag:' + sys, move: true, h: floorH(FAULT_AT[sys][0]), d: 3.9, pts: [[-0.95, 0], [0.95, 0], [0, 1.7]], col: '#f2c230', at: [FAULT_AT[sys][1], 2.3], print: { box: [-0.95, 0, 0.95, 1.7], share: 'flag', draw: (c) => { fillRect(c, -0.95, 0, 0.95, 1.7, '#f2c230'); c.strokeStyle = '#25261f'; c.lineWidth = 0.14; c.beginPath(); c.moveTo(-0.72, 0.12); c.lineTo(0.72, 0.12); c.lineTo(0, 1.42); c.closePath(); c.stroke(); fillRect(c, -0.08, 0.55, 0.08, 1.05, '#25261f'); disc(c, 0, 0.36, 0.1, '#25261f'); } } });

  // people: one cut figure for every mood of every person (only one stands at a time), a hat each, and a stand
  const figure = (role, mood) => ({ box: [-1.15, -0.05, 1.15, HEAD_Y + HEAD_R + 0.05], draw: (c) => {
    const [col, dress] = UNIFORM[role];
    fillRect(c, -1.2, -0.1, 1.2, 1.4, col); dress(c);
    c.save(); c.translate(-16 * SV, HEAD_Y + 23 * SV); c.scale(SV, -SV); drawSVG(c, faceMarkup(role, mood, false)); c.restore();
  } });
  for (const role of [...ROLES, 'you']) {
    for (const mood of role === 'you' ? ['smug', 'sour', 'dead'] : MOODS) add({ id: `pawn:${role}:${mood}`, move: true, pts: BODY, z0: -0.03, z1: 0.03, col: UNIFORM[role][0], back: '#e9e2cc', print: figure(role, mood) });
    const hp = HAT_PTS[role].map(sv), xs = hp.map((q) => q[0]), ys = hp.map((q) => q[1]);
    add({ id: 'hat:' + role, move: true, pts: hp, z0: 0.03, z1: 0.075, col: HAT_COL[role], back: HAT_COL[role], print: { box: [Math.min(...xs) - 0.05, Math.min(...ys) - 0.05, Math.max(...xs) + 0.05, Math.max(...ys) + 0.05], draw: (c) => { c.save(); c.translate(-16 * SV, HEAD_Y + 23 * SV); c.scale(SV, -SV); drawSVG(c, HATS[role]); c.restore(); } } });
    add({ id: 'base:' + role, move: true, pts: circle(0, 0, 1, 24).map(([x, y]) => [x * 1.15, y * 0.55]), z0: -0.02, z1: 0.02, col: role === 'you' ? '#7b2731' : '#2f3b34', back: '#2f3b34' });
  }
  for (const role of ROLES) {
    add({ id: 'ask:' + role, move: true, pts: [[-0.75, 0.35], [-0.2, 0.35], [0, 0], [0.2, 0.35], [0.75, 0.35], [0.75, 1.5], [-0.75, 1.5]], col: '#fffdf6', print: { box: [-0.75, 0, 0.75, 1.5], share: 'ask', draw: (c) => { fillRect(c, -0.75, 0, 0.75, 1.5, '#fffdf6'); text(c, '?', 0, 0.58, 1.05, '#b5482e', '700 SIZEpx Georgia, serif', 'center'); } } });
    add({ id: 'alert:' + role, move: true, pts: circle(0, 0, 0.42, 16), col: '#b5482e', print: { box: [-0.42, -0.42, 0.42, 0.42], share: 'alert', draw: (c) => { fillRect(c, -0.42, -0.42, 0.42, 0.42, '#b5482e'); fillRect(c, -0.06, -0.08, 0.06, 0.26, '#fff'); disc(c, 0, -0.22, 0.07, '#fff'); } } });
    add({ id: 'eye:' + role, move: true, pts: circle(0, 0, 0.42, 16), col: '#25261f', print: { box: [-0.42, -0.42, 0.42, 0.42], share: 'eye', draw: (c) => { fillRect(c, -0.42, -0.42, 0.42, 0.42, '#25261f'); c.fillStyle = '#fffdf6'; c.beginPath(); c.ellipse(0, 0, 0.3, 0.17, 0, 0, 6.2832); c.fill(); disc(c, 0, 0, 0.11, '#2f8580'); } } });
  }
  return P;
}

export function createDiorama(root) {
  const small = Math.min(innerWidth, innerHeight) < 700 && Math.max(screen.width, screen.height) < 1100;
  root.innerHTML = '<div class="silo-box card3d"><canvas aria-label="A card model of the silo in cross-section, with the staff as standing pawns"></canvas><div class="pawns"></div></div>';
  const box = root.querySelector('.silo-box'), canvas = root.querySelector('canvas'), layer = root.querySelector('.pawns');

  const light = JSON.parse(JSON.stringify(LIGHT_RIG));
  light.centre = [0, 15, 3]; light.radius = 27;
  // the window is in front and to the left, and low, so the back of each room is lit under its ceiling's shadow
  const DAY = { dir: [-0.6, 0.4, 0.72], col: [3.3, 3.05, 2.65], fill: 1 };
  const NIGHT = { dir: [0.5, 0.45, 0.74], col: [0.55, 0.72, 1.2], fill: 0.32 };
  light.key.size = 5;
  light.fill = [
    { dir: [0, 1, 0.1], col: [0.2, 0.22, 0.26], cone: 32 },
    { dir: [0, 0.5, 0.86], col: [0.36, 0.35, 0.34], cone: 34 },
    { dir: [0.8, 0.38, 0.46], col: [0.3, 0.27, 0.23], cone: 34 },
    { dir: [-0.82, 0.4, 0.4], col: [0.2, 0.21, 0.24], cone: 34 },
    { dir: [0.1, 0.12, 0.99], col: [0.3, 0.29, 0.28], cone: 30 },
    { dir: [0.2, 0.6, -0.78], col: [0.08, 0.08, 0.09], cone: 34 },
  ];
  const fillBase = light.fill.map((f) => f.col.slice());
  light.exposure = 0.46;
  light.background = [0.04, 0.05, 0.045];
  const renderer = createPaperRenderer(canvas, small ? QUALITY.low : QUALITY.high, light);

  // --- frames ---
  const rig = new Rig();
  const parts = buildParts();
  for (const p of parts) p.frame = rig.frame();
  const frameOf = Object.fromEntries(parts.map((p) => [p.id, p]));
  let theta = Math.PI / 2;          // the angle between the base and the back board
  const X = [1, 0, 0], F = [0, 0, 1];
  let W = [0, 1, 0];
  const at = (x, h, d) => [x, BASE_T + W[1] * h, W[2] * h + d];
  const HIDE = [[0, -50, 0], [0, 0, 0], [0, 0, 0]];
  function place(p, x = p.x, h = p.h, d = p.d, s = 1, lying = false) {
    if (p.kind === 'floor') p.frame.set(at(x, h, d), X, [0, 0, -1]);
    else if (p.kind === 'side') p.frame.set(at(x, h, 0), F, W);
    else if (lying) p.frame.set(at(x, h + 0.06, d), [s, 0, 0], [0, 0, -s]);
    else p.frame.set(at(x, h, d), [s, 0, 0], [0, W[1] * s, W[2] * s]);
  }
  const hide = (p) => p.frame.set(HIDE[0], HIDE[1], HIDE[2]);
  const show = (id, on, x, h, d, s) => { const p = frameOf[id]; if (on) place(p, x ?? (p.at ? p.at[0] : p.x), h ?? p.h + (p.at ? p.at[1] : 0), d ?? p.d, s ?? 1); else hide(p); };

  // --- print and mesh ---
  const prints = [], shared = {};
  for (const p of parts) {
    if (!p.print) continue;
    if (p.print.share && shared[p.print.share] !== undefined) { p.uvi = shared[p.print.share]; continue; }
    p.uvi = prints.length;
    if (p.print.share) shared[p.print.share] = p.uvi;
    prints.push({ box: p.print.box, base: p.col, draw: p.print.draw });
  }
  const atlas = buildAtlas(prints, 2048, small ? 30 : 38, '#efe7d3');
  const mesh = new CardMesh();
  for (const p of parts) {
    mesh.addPart('all', {
      frame: p.frame.id, outline: p.pts, holes: p.holes || [], z0: p.z0, z1: p.z1, front: hex(p.col), back: hex(p.back || p.col), edge: p.edge ? hex(p.edge) : [246, 243, 236],
      uv: p.uvi !== undefined ? atlas.uv[p.uvi] : null, mat: p.mat || 0, hasBack: p.hasBack !== false,
    });
  }
  const built = mesh.finish(['all']);
  renderer.setMesh(built);
  renderer.setAtlas(['all'], atlas.canvas);
  // The lettering on the model uses the page's own type. If it was not loaded yet, print the sheet again
  // when it arrives (same sizes, so the same places in the atlas).
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('600 40px "Barlow Condensed"'), document.fonts.ready]).then(() => {
      const again = buildAtlas(prints, 2048, small ? 30 : 38, '#efe7d3');
      renderer.setAtlas(['all'], again.canvas); renderer.restart(); dirty = true; kick();
    }).catch(() => {});
  }
  const packed = new Float32Array(rig.frames.length * 12);

  // --- what moves ---
  const pawns = {};                 // role -> { x, h, d, s, path: [...], mood, lying, shown }
  for (const role of [...ROLES, 'you']) pawns[role] = { x: 0, h: 0, d: PAWN_D, s: 0, path: [], mood: role === 'you' ? 'smug' : 'flat', lying: false, zone: null, want: 0 };
  const liftCar = { h: floorH(5), to: floorH(5) };
  const water = { v: 0.7, to: 0.7 };
  const dusk = { v: 0, to: 0 };
  const opening = { v: 1, to: 1 };
  const cam = { yaw: 0.2, pitch: 0.15, yawTo: 0.2, pitchTo: 0.15 };
  let view = null, dirty = true, raf = 0, lastMove = 0, lastT = 0, hits = [], hitKey = '';
  const approach = (o, k, to, rate, dt, eps = 0.01) => { const d = to - o[k]; if (Math.abs(d) < eps) { if (o[k] !== to) { o[k] = to; return true; } return false; } o[k] += d * (1 - Math.exp(-dt * rate)); return true; };

  function layout() {
    W = [0, Math.sin(theta), Math.cos(theta)];
    for (const p of parts) if (!p.move) place(p);
    const v = view || {};
    const open = opening.v > 0.985;
    // the lift, the water in the tank, what your comforts look like
    show('lift', true, 0, liftCar.h, 2.6);
    const night = dusk.v > 0.5;          // the night sky slots in while the light is at its dimmest
    show('nightsky', night); show('moon', night); show('sun', !night);
    show('water', true, 0, floorH(0) + 0.5 - 3.2 * (1 - water.v), 1.9);
    for (const id of ['tubwater', 'steam', 'steam2']) show(id, !!(v.policy && v.policy.tub));
    show('film', !!(v.policy && v.policy.cinema));
    show('screens', !!v.cameras);
    for (let fl = 0; fl < 6; fl++) show('cam' + fl, !!v.cameras);
    const res = v.res || { food: 60, lux: 45 };
    for (let k = 0; k < 10; k++) show('crate' + k, k < Math.ceil(res.food / 8));
    for (let k = 0; k < 6; k++) show('gold' + k, k < Math.ceil(res.lux / 9));
    const dead = (v.staff || []).filter((p) => p.status === 'dead').length;
    for (let k = 0; k < 8; k++) show('grave' + k, k < dead);
    const faults = Object.fromEntries((v.faults || []).map((f) => [f.sys, f]));
    for (const sys in FAULT_AT) show('flag:' + sys, !!faults[sys] && open, undefined, undefined, undefined, faults[sys] && faults[sys].patched ? 0.7 : 1);
    // pawns
    for (const role in pawns) {
      const a = pawns[role];
      const moods = role === 'you' ? ['smug', 'sour', 'dead'] : MOODS;
      for (const m of moods) { const p = frameOf[`pawn:${role}:${m}`]; if (m === a.mood && a.s > 0.02 && open) place(p, a.x, a.h, a.d, a.s, a.lying); else hide(p); }
      const stands = a.s > 0.02 && open;
      if (stands) place(frameOf['hat:' + role], a.x, a.h, a.d, a.s, a.lying); else hide(frameOf['hat:' + role]);
      if (stands && !a.lying) place(frameOf['base:' + role], a.x, a.h, a.d, a.s, true); else hide(frameOf['base:' + role]);
      if (role === 'you') continue;
      const up = a.h + 3.3 * a.s, on = a.s > 0.9 && open && !a.lying && !a.path.length;
      show('ask:' + role, on && a.ask, a.x + 1.15, up - 0.3, a.d + 0.25);
      show('alert:' + role, on && a.badge === 'alert', a.x + 1.05, a.h + 2.45, a.d + 0.2);
      show('eye:' + role, on && a.badge === 'eye', a.x + 1.05, a.h + 2.45, a.d + 0.2);
    }
    renderer.setFrames(rig.pack(packed), rig.frames.length);
  }

  function camera() {
    const w = canvas.width || 4, h = canvas.height || 3, a = w / h;
    const target = [0, 16.6, 2.4];
    const dist = Math.max(86, 106 / a);     // as close as keeps the top of the sky and the front of the base in view
    const cy = Math.cos(cam.pitch);
    return { eye: [target[0] + Math.sin(cam.yaw) * cy * dist, target[1] + Math.sin(cam.pitch) * dist, target[2] + Math.cos(cam.yaw) * cy * dist], target, fovY: 0.42, aperture: 0.22, groups: ['all'], blueprint: 0, near: 10, far: 600 };
  }

  // Invisible buttons over the pawns and flags, so taps and keyboards reach them.
  function placeHits(v) {
    const m = renderer.viewProjOf(v), cw = box.clientWidth, ch = box.clientHeight;
    const proj = (p) => { const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]; return [(x / w * 0.5 + 0.5) * cw, (0.5 - y / w * 0.5) * ch, w]; };
    const list = [];
    for (const role in pawns) { const a = pawns[role]; if (a.s > 0.5 && a.shown) list.push({ key: 'p:' + role, role, label: a.label, c: proj(at(a.x, a.h + (a.lying ? 0.2 : 1.55), a.d)), r: proj(at(a.x + 1.2, a.h + 1.55, a.d)) }); }
    for (const f of (view && view.faults) || []) { const [fl, x] = FAULT_AT[f.sys]; list.push({ key: 'f:' + f.sys, matter: f.i, label: 'Fault: ' + f.sys, c: proj(at(x, floorH(fl) + 3.1, 3.9)), r: proj(at(x + 1, floorH(fl) + 3.1, 3.9)) }); }
    for (const role in pawns) { const a = pawns[role]; if (a.ask && a.s > 0.9) list.push({ key: 'a:' + role, matter: a.askI, label: 'A request', c: proj(at(a.x + 1.15, a.h + 3.75, a.d)), r: proj(at(a.x + 1.9, a.h + 3.75, a.d)) }); }
    const key = list.map((h) => h.key).join();
    if (key !== hitKey) {
      hitKey = key;
      layer.innerHTML = list.map((h) => (h.role ? `<button type="button" class="pawn hit" data-role="${h.role}" aria-label="${h.label || h.role}"></button>` : `<button type="button" class="pawn hit flag" data-act="matter" data-i="${h.matter}" aria-label="${h.label}"></button>`)).join('');
    }
    [...layer.children].forEach((el, i) => {
      const h = list[i], r = Math.max(15, Math.abs(h.r[0] - h.c[0]) * 1.25);
      el.style.cssText = `left:${(h.c[0] - r).toFixed(1)}px;top:${(h.c[1] - r * 1.15).toFixed(1)}px;width:${(r * 2).toFixed(1)}px;height:${(r * 2.3).toFixed(1)}px`;
      if (!h.role) el.dataset.i = h.matter;
    });
    hits = list;
  }

  function setLight() {
    const n = dusk.v, mix = (a, b) => a + (b - a) * n;
    light.key.dir = DAY.dir.map((d, i) => mix(d, NIGHT.dir[i]));
    light.key.col = DAY.col.map((d, i) => mix(d, NIGHT.col[i]));
    const f = mix(DAY.fill, NIGHT.fill);
    light.fill.forEach((l, i) => { l.col = [fillBase[i][0] * f * mix(1, 0.75), fillBase[i][1] * f * mix(1, 0.9), fillBase[i][2] * f * mix(1, 1.5)]; });
    renderer.relight();
  }

  function frame(t) {
    raf = 0;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    let moved = dirty;
    dirty = false;
    if (approach(opening, 'v', opening.to, 3.2, dt, 0.002)) { theta = (0.1 + 0.9 * opening.v) * (Math.PI / 2); moved = true; }
    if (approach(liftCar, 'h', liftCar.to, 2.2, dt)) moved = true;
    if (approach(water, 'v', water.to, 2.5, dt, 0.004)) moved = true;
    if (approach(dusk, 'v', dusk.to, 3, dt, 0.004)) { setLight(); moved = true; }
    for (const role in pawns) {
      const a = pawns[role];
      if (opening.v <= 0.985) a.s = 0;
      else if (approach(a, 's', a.want, 9, dt)) moved = true;
      const step = a.path[0];
      if (step) {
        let going = false;
        for (const k in step) if (approach(a, k, step[k], 11, dt, 0.04)) going = true;
        if (!going) a.path.shift();
        moved = true;
      }
    }
    const camMoved = approach(cam, 'yaw', cam.yawTo, 10, dt, 0.0015) | approach(cam, 'pitch', cam.pitchTo, 10, dt, 0.0015);
    const dpr = Math.min(devicePixelRatio || 1, small ? 1.6 : 2);
    const w = Math.round(box.clientWidth * dpr), h = Math.round(box.clientHeight * dpr);
    const resized = w !== canvas.width || h !== canvas.height;
    if (w > 2 && h > 2) { renderer.resize(w, h); renderer.setScale(Math.min(1, Math.sqrt(MOVING_PIXELS / (w * h)))); }
    if (moved) layout();
    if (moved || camMoved || resized) lastMove = t;
    const v = camera();
    const res = renderer.render({ ...v, changed: moved, still: t - lastMove > 180 });
    if (moved || camMoved || resized || !hits.length) placeHits(v);
    if (!res.done || moved || camMoved) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function update(v) {
    view = v;
    box.dataset.ending = v.ending || '';
    dusk.to = v.night ? 1 : 0;
    if (v.res) water.to = Math.max(0.04, Math.min(1, v.res.water / 70));
    const groups = {};
    const all = [...v.staff.filter((p) => p.status !== 'dead'), { role: 'you', mood: v.you.mood || 'smug', zone: v.you.zone || 'you', status: 'ok', down: v.you.down, label: 'You' }];
    for (const p of all) (groups[p.zone] = groups[p.zone] || []).push(p);
    for (const role in pawns) pawns[role].shown = false;
    for (const zone in groups) {
      const [fl, x0, x1] = ZONES[zone] || ZONES.surface;
      groups[zone].forEach((p, i) => {
        const a = pawns[p.role], n = groups[zone].length;
        const x = n <= 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
        const h = floorH(fl) + (fl === 6 ? 0 : 0), d = PAWN_D + (n > 4 && i % 2 ? 0.55 : 0) + (p.role === 'you' ? 0.2 : 0);
        a.shown = !p.unseen; a.want = p.unseen ? 0 : p.status === 'exiled' ? 0.78 : 1;
        a.mood = p.mood === 'none' ? 'flat' : p.mood; a.lying = !!p.down; a.badge = p.badge || ''; a.label = p.label;
        a.ask = v.asks && v.asks[p.role] !== undefined; a.askI = a.ask ? v.asks[p.role] : -1;
        if (a.zone === null || a.s < 0.05) { a.x = x; a.h = h; a.d = d; a.path = []; } else if (Math.abs(a.h - h) > 0.1 && !a.path.some((s) => s.h === h)) {
          a.path = [{ d: OUT_D }, { x, h }, { d }];                 // lifted out, across, and set down
          liftCar.to = floorH(Math.min(5, fl));
        } else if (Math.abs(a.h - h) <= 0.1) a.path = [{ x, d }];
        a.zone = zone;
      });
    }
    for (const role in pawns) if (!pawns[role].shown) pawns[role].want = 0;
    hitKey = '';
    dirty = true; kick();
  }

  // drag to look round the model; let go and it settles
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY, cam.yawTo, cam.pitchTo]; });
  addEventListener('pointermove', (e) => { if (!drag) return; cam.yawTo = Math.max(-0.55, Math.min(0.75, drag[2] - (e.clientX - drag[0]) * 0.006)); cam.pitchTo = Math.max(0.03, Math.min(0.6, drag[3] + (e.clientY - drag[1]) * 0.005)); kick(); });
  addEventListener('pointerup', () => { drag = null; });
  addEventListener('pointercancel', () => { drag = null; });
  addEventListener('resize', kick);
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(kick).observe(box);

  layout(); setLight(); kick();
  return {
    update, root, box, kind: 'card', renderer,
    // 0 folded nearly flat .. 1 standing. jump: no animation.
    setOpen(t, jump) { opening.to = t; if (jump) { opening.v = t; theta = (0.1 + 0.9 * t) * (Math.PI / 2); } dirty = true; kick(); },
    // a small sign of life: the lift moves, or somebody shifts on their feet
    beat() { if (Math.random() < 0.5) liftCar.to = floorH(Math.floor(Math.random() * 6)); else { const live = Object.values(pawns).filter((a) => a.shown && !a.path.length && !a.lying); const a = live[Math.floor(Math.random() * live.length)]; if (a) a.path = [{ h: a.h + 0.45 }, { h: a.h }]; } kick(); },
    look(yaw, pitch) { cam.yawTo = yaw; cam.pitchTo = pitch; kick(); },
    // Finish a still picture now and return it (a WebGL canvas can only be read in the task that drew it).
    capture() {
      layout();
      const v = camera();
      renderer.restart();
      let r, n = 0;
      do { r = renderer.render({ ...v, changed: false, still: true, instant: true }); } while (!r.done && n++ < 300);
      return canvas.toDataURL('image/jpeg', 0.9);
    },
    info: () => ({ parts: built.stats.parts, triangles: built.stats.triangles, frames: rig.frames.length, density: atlas.density, size: [canvas.width, canvas.height] }),
  };
}
