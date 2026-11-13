// src/main.js
// The page: start-up, the camera, page turning, tabs and wheels under the pointer, the automatic
// run when nobody is touching it, and the quality settings.
//
// URL controls (for looking at exact moments):
//   ?t=12.5        freeze the automatic run at 12.5 seconds
//   ?turn=2.5      hold the book at this turn (0 shut, 1..5 a spread open, halves in between)
//   ?tab=0.6       set every tab, wheel and slider of the open spread to this value (with ?turn)
//   ?view=top      camera: front (default), top, low, side, macro
//   ?yaw= ?pitch= ?zoom=   camera offsets (radians, radians, 1 = normal)
//   ?engineer=1    start in the engineer's view
//   ?quality=phone force the phone settings (or desktop)
//   ?scale=0.6     fix the drawing resolution as a share of full
//   ?stats=1       show frame time and sizes

import * as m4 from '../engine/mat4.js';
import { createPaperRenderer, QUALITY } from '../engine/paperlight.js';
import { createBook, BOOK } from './book.js';
import { STORY } from './story.js';
import { buildBase } from './spreads/base.js';
import { buildSpread1 } from './spreads/s1.js';
import { buildSpread2 } from './spreads/s2.js';
import { buildSpread3 } from './spreads/s3.js';
import { buildSpread4 } from './spreads/s4.js';
import { buildSpread5 } from './spreads/s5.js';
import { createEngineer } from './engineer.js';
import { createSound } from './sound.js';

const FOV = 24;                  // lens angle in degrees: a long lens, as a photographer would use
const APERTURE = 0.4;           // cm, lens radius for the finished still (depth of field)
const TURN_SECONDS = 3.6;        // automatic run: time to turn one page
const HOLD_SECONDS = 8.5;        // and to rest on a spread
const COVER_SECONDS = 0.7;       // rest on the shut book at the start of each run
const CLOSE_SECONDS = 5.5;       // time to leaf back to the start at the end
const DEMO_FROM = 1.6, DEMO_TO = 5.6;   // within a rest: when the book works its own tab or wheel
const IDLE_RESUME = 10;          // seconds without input before the automatic run takes over again
const STILL_AFTER = 0.18;        // seconds without movement before the picture starts to refine
const FLICK = 0.55;              // turns per second: a release faster than this carries the page over
const KEY_TURN_RATE = 3.2;       // how briskly a page follows an arrow key or button
const ORBIT_YAW = 0.006, ORBIT_PITCH = 0.005;   // radians per pixel dragged
const PORTRAIT_FIT = 0.84;        // on a tall screen the page edges may touch the sides, so the pop-up is larger
const PITCH_MIN = 0.16, PITCH_MAX = 1.45, YAW_MAX = 1.5, ZOOM_MIN = 0.45, ZOOM_MAX = 1.9;
const TARGET_MS = 21, SMOOTH_MS = 17.6, MIN_SCALE = 0.5;   // resolution steps down above TARGET_MS, up below SMOOTH_MS

// Where the camera stands for each whole turn: 0 is the shut book, 1..5 the spreads.
const SHOTS = [
  { target: [12.6, 0.6, 0.6], fit: 76, pitch: 0.98 },
  { target: [0, 3.4, 3.0], fit: 61, pitch: 0.60 },
  { target: [0, 3.6, 3.0], fit: 61, pitch: 0.60 },
  { target: [0, 3.4, 3.0], fit: 61, pitch: 0.60 },
  { target: [0, 3.0, 3.0], fit: 61, pitch: 0.62 },
  { target: [0, 10, 4.0], fit: 80, pitch: 0.5 },
];
const VIEWS = {
  front: { yaw: 0, pitch: 0, zoom: 1 }, top: { yaw: 0, pitch: 0.8, zoom: 1 }, low: { yaw: 0.25, pitch: -0.36, zoom: 0.8 },
  side: { yaw: 0.95, pitch: -0.1, zoom: 0.9 }, macro: { yaw: -0.3, pitch: -0.22, zoom: 0.5 },
};

const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };

const isPhone = params.get('quality') === 'phone' ||
  (params.get('quality') !== 'desktop' && (Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches));
const quality = isPhone ? QUALITY.low : QUALITY.high;
const maxDpr = isPhone ? 1.5 : 2;

const pause = () => new Promise((done) => {
  const t = setTimeout(done, 60);
  requestAnimationFrame(() => { clearTimeout(t); setTimeout(done, 0); });
});
const boot = { start: performance.now() };
window.__boot = boot;

let book, renderer, engineer;
try {
  await pause();
  // The print needs its typeface before anything is drawn on the card.
  await Promise.race([
    Promise.all(['500 24px Fraunces', '600 24px Fraunces', 'italic 500 24px Fraunces', 'italic 600 24px Fraunces'].map((f) => document.fonts.load(f))),
    new Promise((done) => setTimeout(done, 2500)),
  ]);
  let mark = performance.now();
  book = createBook({ base: buildBase, spreads: [buildSpread1, buildSpread2, buildSpread3, buildSpread4, buildSpread5] },
    { atlasSize: isPhone ? 1024 : 2048, density: isPhone ? 20 : 38 });
  boot.bookMs = performance.now() - mark;
  await pause();
  mark = performance.now();
  renderer = createPaperRenderer(canvas, quality);
  renderer.setMesh(book.mesh);
  for (const a of book.atlases) renderer.setAtlas(a.groups, a.canvas);
  boot.glMs = performance.now() - mark;
  engineer = createEngineer($('overlay'));
} catch (err) {
  $('loading').hidden = true;
  $('error').textContent = 'This page needs WebGL2. ' + err.message;
  $('error').hidden = false;
  throw err;
}
window.__book = book; window.__renderer = renderer;

// --- State ----------------------------------------------------------------------------------------
const frozen = params.has('t');   // ?t= stops the clock; ?turn= only sets where the book starts
let clock = params.has('t') ? parseFloat(params.get('t')) || 0 : 0;   // seconds into the automatic run
let auto = !params.has('turn');     // the book is turning its own pages
let turn = 0;                       // where the book is, 0..5
let turnTarget = null;              // a turn in progress from a key, a button or a flick
let lastInput = params.has('turn') ? 1e12 : -1e9;   // with ?turn= the automatic run stays off
let engineerOn = params.get('engineer') === '1', engineerAmount = engineerOn ? 1 : 0;
const cam = { yaw: 0, pitch: 0, zoom: 1, ...(VIEWS[params.get('view')] || {}) };
for (const k of ['yaw', 'pitch', 'zoom']) if (params.has(k)) cam[k] = parseFloat(params.get(k));
const camHome = { yaw: 0, pitch: 0, zoom: 1 };
if (params.has('turn')) {
  turn = clamp(parseFloat(params.get('turn')) || 0, 0, BOOK.SPREADS);
  if (params.has('tab')) for (const c of book.controls) c.value = parseFloat(params.get('tab')) * (c.type === 'wheel' ? 6.283 : 1);
}

// --- The automatic run ------------------------------------------------------------------------------
// A list of spans: rest on the cover, then turn and rest for each spread, then leaf back.
const spans = [];
{
  let t = 0;
  const push = (type, len, from, to) => { spans.push({ type, t0: t, t1: t + len, from, to }); t += len; };
  push('hold', COVER_SECONDS, 0, 0);
  for (let k = 1; k <= BOOK.SPREADS; k++) { push('turn', TURN_SECONDS, k - 1, k); push('hold', HOLD_SECONDS + (k === BOOK.SPREADS ? 2 : 0), k, k); }
  push('turn', CLOSE_SECONDS, BOOK.SPREADS, 0);
}
const RUN_SECONDS = spans[spans.length - 1].t1;
function runAt(t) {
  t = ((t % RUN_SECONDS) + RUN_SECONDS) % RUN_SECONDS;
  const s = spans.find((q) => t < q.t1) || spans[spans.length - 1];
  const u = (t - s.t0) / (s.t1 - s.t0);
  return { span: s, u, turn: s.type === 'hold' ? s.from : s.from + (s.to - s.from) * ease(u), into: t - s.t0 };
}
// The value a control shows while the book demonstrates it, `into` seconds into a rest.
function demoValue(c, into) {
  const u = clamp((into - DEMO_FROM) / (DEMO_TO - DEMO_FROM), 0, 1);
  const keys = c.demo || [0, 1, 0];
  const f = u * (keys.length - 1), i = Math.min(keys.length - 2, Math.floor(f));
  return keys[i] + (keys[i + 1] - keys[i]) * ease(f - i);
}
let blendFrom = null;   // control values at the moment the run took over, so they ease into the demo

// --- Camera -----------------------------------------------------------------------------------------
const view = { eye: [0, 40, 80], target: [0, 5, 0], fovY: (FOV * Math.PI) / 180, aperture: APERTURE, near: 4, far: 900 };
const COVER_APERTURE = 0.3;      // share of the lens opening used on the shut book, so the whole cover is sharp
function placeCamera() {
  const i = Math.min(SHOTS.length - 2, Math.floor(turn)), f = ease(turn - i);
  const a = SHOTS[i], b = SHOTS[i + 1];
  const mix = (x, y) => x + (y - x) * f;
  const aspect = canvas.width / canvas.height;
  const fit = mix(a.fit, b.fit) * (aspect < 0.8 ? PORTRAIT_FIT : 1);
  // Far enough back for the width to fit, and on a wide screen for the height to fit too.
  const half = Math.tan(view.fovY / 2);
  const dist = Math.max(fit / (2 * half * aspect), (fit * 0.5) / (2 * half)) * cam.zoom;
  const pitch = clamp(mix(a.pitch, b.pitch) + cam.pitch + (aspect < 0.8 ? 0.12 : 0), PITCH_MIN, PITCH_MAX);
  view.target = [mix(a.target[0], b.target[0]), mix(a.target[1], b.target[1]), mix(a.target[2], b.target[2])];
  view.aperture = APERTURE * (COVER_APERTURE + (1 - COVER_APERTURE) * ease(Math.min(turn, 1)));
  view.eye = [view.target[0] + Math.sin(cam.yaw) * Math.cos(pitch) * dist, view.target[1] + Math.sin(pitch) * dist, view.target[2] + Math.cos(cam.yaw) * Math.cos(pitch) * dist];
}
function viewProj() { return renderer.viewProjOf(view); }

// A ray through a point of the window.
function rayAt(cx, cy) {
  const inv = m4.invert(viewProj());
  const x = (cx / innerWidth) * 2 - 1, y = 1 - (cy / innerHeight) * 2;
  const un = (z) => {
    const w = inv[3] * x + inv[7] * y + inv[11] * z + inv[15];
    return [(inv[0] * x + inv[4] * y + inv[8] * z + inv[12]) / w, (inv[1] * x + inv[5] * y + inv[9] * z + inv[13]) / w, (inv[2] * x + inv[6] * y + inv[10] * z + inv[14]) / w];
  };
  const o = un(-1), f = un(1);
  const d = [f[0] - o[0], f[1] - o[1], f[2] - o[2]], l = Math.hypot(d[0], d[1], d[2]);
  return { o, d: [d[0] / l, d[1] / l, d[2] / l] };
}
// Where a ray meets the plane of a frame (lifted z along its normal), in the frame's own units.
function onFrame(ray, frame, z = 0) {
  const n = frame.n, p = frame.point(0, 0, z);
  const den = ray.d[0] * n[0] + ray.d[1] * n[1] + ray.d[2] * n[2];
  if (Math.abs(den) < 1e-6) return null;
  const t = ((p[0] - ray.o[0]) * n[0] + (p[1] - ray.o[1]) * n[1] + (p[2] - ray.o[2]) * n[2]) / den;
  if (t <= 0) return null;
  const l = frame.local([ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, ray.o[2] + ray.d[2] * t]);
  l.t = t;
  return l;
}

// --- Controls (tabs, wheels, sliders) -----------------------------------------------------------------
function handleOf(c) {
  if (c.type === 'tab') return [c.at[0] + c.axis[0] * c.travel * c.value, c.at[1] + c.axis[1] * c.travel * c.value];
  if (c.type === 'slider') return pathPoint(c.path, c.value);
  return c.at;
}
function pathPoint(path, v) {
  const f = clamp(v, 0, 1) * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), u = f - i;
  return [path[i][0] + (path[i + 1][0] - path[i][0]) * u, path[i][1] + (path[i + 1][1] - path[i][1]) * u];
}
function pickControl(ray, slopPx) {
  let best = null;
  for (const c of book.controls) {
    if (book.opening(c.spread) < 2.4) continue;
    const l = onFrame(ray, c.parent, c.z || 0.03);
    if (!l) continue;
    const h = handleOf(c);
    const slop = (slopPx * 2 * l.t * Math.tan(view.fovY / 2)) / innerHeight;
    const d = Math.hypot(l[0] - h[0], l[1] - h[1]);
    if (d <= Math.max(c.radius, slop) && (!best || d < best.d)) best = { c, d, l };
  }
  return best;
}
function dragControl(g, ray) {
  const c = g.c, l = onFrame(ray, c.parent, c.z || 0.03);
  if (!l) return;
  if (c.type === 'tab') {
    c.value = clamp(g.v0 + ((l[0] - g.l0[0]) * c.axis[0] + (l[1] - g.l0[1]) * c.axis[1]) / c.travel, 0, 1);
  } else if (c.type === 'wheel') {
    const a = Math.atan2(l[1] - c.at[1], l[0] - c.at[0]);
    let da = a - g.a;
    if (da > Math.PI) da -= Math.PI * 2; else if (da < -Math.PI) da += Math.PI * 2;
    c.value += da; g.a = a;
  } else {
    // slider: the nearest point of the path, looked for near where the piece is now
    let bv = c.value, bd = Infinity;
    for (let i = -24; i <= 24; i++) {
      const v = clamp(c.value + i * 0.01, 0, 1), p = pathPoint(c.path, v);
      const d = Math.hypot(p[0] - l[0], p[1] - l[1]);
      if (d < bd) { bd = d; bv = v; }
    }
    c.value = bv;
  }
}

// --- Page turning under the pointer ---------------------------------------------------------------------
function pickLeaf(ray) {
  const { W, H } = BOOK;
  const inY = (l) => l[1] > -1 && l[1] < H + 1;
  const whole = Math.abs(turn - Math.round(turn)) < 1e-3;
  if (!whole) {
    const j = Math.floor(turn), l = onFrame(ray, book.front[j], 0);
    return l && inY(l) && l[0] > W * 0.2 && l[0] < W + 1.5 ? { leaf: j, l } : null;
  }
  const k = Math.round(turn);
  if (k < BOOK.SPREADS) {
    const l = onFrame(ray, book.front[k], 0);
    if (l && inY(l) && l[0] > W * (k === 0 ? 0.12 : 0.58) && l[0] < W + 1.5) return { leaf: k, l };
  }
  if (k >= 1) {
    const l = onFrame(ray, book.back[k - 1], 0);
    if (l && inY(l) && l[0] < -W * 0.58 && l[0] > -W - 1.5) return { leaf: k - 1, l };
  }
  return null;
}
// The turn a pointer asks for: the angle of the pointer round the spine, in the plane across it.
function turnFromRay(g, ray) {
  if (Math.abs(ray.d[2]) < 1e-4) return null;
  const t = (g.z - ray.o[2]) / ray.d[2];
  const hinge = book.front[g.leaf].o;
  const x = ray.o[0] + ray.d[0] * t - hinge[0], y = ray.o[1] + ray.d[1] * t - hinge[1];
  const a = y <= 0 ? (x >= 0 ? 0 : Math.PI) : Math.atan2(y, x);
  const [r, l] = book.restAngles(g.leaf);
  return (a - r) / (l - r);
}

// --- Input ----------------------------------------------------------------------------------------------
const pointers = new Map();
let grab = null;      // what the main pointer holds: { kind: 'turn' | 'control' | 'orbit', ... }
let pinch = null;
const touched = () => { if (lastInput < 1e11) lastInput = performance.now() / 1000; auto = false; blendFrom = null; wake(); };

canvas.addEventListener('pointerdown', (e) => {
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* a made-up pointer in a test has nothing to capture */ }
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  touched();
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), zoom: cam.zoom };
    grab = null;
    return;
  }
  book.setTurn(turn); book.update(); placeCamera();   // the pose may be a frame old
  const ray = rayAt(e.clientX, e.clientY);
  const slop = e.pointerType === 'touch' ? 26 : 10;
  const hit = pickControl(ray, slop);
  if (hit) {
    const c = hit.c;
    grab = { kind: 'control', c, v0: c.value, l0: hit.l, a: c.type === 'wheel' ? Math.atan2(hit.l[1] - c.at[1], hit.l[0] - c.at[0]) : 0 };
    sound.grab(c);
  } else {
    const leaf = pickLeaf(ray);
    if (leaf) {
      const hitWorld = [ray.o[0] + ray.d[0] * leaf.l.t, ray.o[1] + ray.d[1] * leaf.l.t, ray.o[2] + ray.d[2] * leaf.l.t];
      grab = { kind: 'turn', leaf: leaf.leaf, z: hitWorld[2], hist: [] };
      const at = turnFromRay(grab, ray);
      grab.offset = (at ?? 0) - (turn - leaf.leaf);
      turnTarget = null;
    } else {
      grab = { kind: 'orbit', x: e.clientX, y: e.clientY };
    }
  }
  canvas.style.cursor = grab.kind === 'orbit' ? 'grabbing' : 'grabbing';
});
canvas.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    cam.zoom = clamp((pinch.zoom * pinch.d) / Math.max(20, Math.hypot(a[0] - b[0], a[1] - b[1])), ZOOM_MIN, ZOOM_MAX);
    touched();
    return;
  }
  if (!grab) {
    // hover: show what a press would do
    if (e.pointerType === 'mouse') {
      const ray = rayAt(e.clientX, e.clientY);
      canvas.style.cursor = pickControl(ray, 10) ? 'pointer' : pickLeaf(ray) ? 'grab' : 'move';
    }
    return;
  }
  touched();
  const ray = rayAt(e.clientX, e.clientY);
  if (grab.kind === 'control') dragControl(grab, ray);
  else if (grab.kind === 'turn') {
    const at = turnFromRay(grab, ray);
    if (at !== null) {
      turn = grab.leaf + clamp(at - grab.offset, 0, 1);
      grab.hist.push([performance.now() / 1000, turn]);
      if (grab.hist.length > 6) grab.hist.shift();
    }
  } else {
    cam.yaw = clamp(cam.yaw - (e.clientX - grab.x) * ORBIT_YAW, -YAW_MAX, YAW_MAX);
    cam.pitch = clamp(cam.pitch + (e.clientY - grab.y) * ORBIT_PITCH, -0.5, 0.9);
    grab.x = e.clientX; grab.y = e.clientY;
  }
});
function release(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (grab && grab.kind === 'turn') {
    const h = grab.hist;
    const v = h.length > 1 && h[h.length - 1][0] > h[0][0] ? (h[h.length - 1][1] - h[0][1]) / (h[h.length - 1][0] - h[0][0]) : 0;
    const part = turn - grab.leaf;
    // A flick carries the page over; a page set down near either side settles there; otherwise it stays where it was left.
    if (Math.abs(v) > FLICK) turnTarget = v > 0 ? grab.leaf + 1 : grab.leaf;
    else if (part < 0.06) turnTarget = grab.leaf;
    else if (part > 0.94) turnTarget = grab.leaf + 1;
  }
  if (grab && grab.kind === 'control') sound.drop(grab.c);
  grab = null;
  canvas.style.cursor = '';
  touched();
}
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.zoom = clamp(cam.zoom * Math.exp(e.deltaY * 0.0012), ZOOM_MIN, ZOOM_MAX);
  touched();
}, { passive: false });
canvas.addEventListener('dblclick', () => { Object.assign(cam, camHome); touched(); });

function step(dir) {
  touched();
  const whole = Math.abs(turn - Math.round(turn)) < 1e-3;
  const base = turnTarget ?? (whole ? Math.round(turn) : dir > 0 ? Math.floor(turn) : Math.ceil(turn));
  turnTarget = clamp(base + dir, 0, BOOK.SPREADS);
}
function setEngineer(on) {
  engineerOn = on;
  $('engineer').setAttribute('aria-pressed', on ? 'true' : 'false');
  $('engineer').textContent = on ? 'Finished view' : "Engineer's view";
  $('legend').hidden = !on;
}
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'PageDown') { step(1); e.preventDefault(); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { step(-1); e.preventDefault(); }
  else if (e.key === 'e' || e.key === 'E') { setEngineer(!engineerOn); touched(); }
  else if (e.key >= '0' && e.key <= '5') { touched(); turnTarget = +e.key; }
  else if (e.key === ' ') { auto = !auto; lastInput = auto ? -1e9 : performance.now() / 1000; e.preventDefault(); }
  else if (e.key === 'Home') { Object.assign(cam, camHome); touched(); }
});
$('prev').addEventListener('click', () => step(-1));
$('next').addEventListener('click', () => step(1));
$('engineer').addEventListener('click', () => { setEngineer(!engineerOn); touched(); });
setEngineer(engineerOn);

const sound = createSound();
window.__sound = sound;
$('sound').addEventListener('click', () => {
  if (sound.on) { sound.stop(); $('sound').textContent = 'Enable sound'; $('sound').setAttribute('aria-pressed', 'false'); }
  else { sound.start(); $('sound').textContent = 'Sound on'; $('sound').setAttribute('aria-pressed', 'true'); }
});

// The words and buttons step back after a few quiet seconds.
let idleTimer = 0;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!grab) document.body.classList.add('idle'); }, 7000);
}
for (const type of ['pointermove', 'keydown', 'focusin']) addEventListener(type, wake, { passive: true });
wake();

// --- Size ---------------------------------------------------------------------------------------------
let scale = params.has('scale') ? parseFloat(params.get('scale')) : 1;
const fixedScale = params.has('scale');
function applySize() {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.resize(innerWidth * dpr, innerHeight * dpr);
  renderer.setScale(scale);
  engineer.resize(innerWidth, innerHeight, Math.min(window.devicePixelRatio || 1, 2));
}
addEventListener('resize', applySize);
applySize();

// --- The loop -------------------------------------------------------------------------------------------
let last = performance.now(), lastTurn = -1, lastValues = '', lastMoved = 0, lastSpread = -1;
let ema = 16.7, slow = 0, steady = 0, frames = 0, ceiling = 1;
const stats = { ms: 16.7, scale: 1, samples: 0, mode: 'moving' };
window.__stats = stats;

function advance(dt, now) {
  if (frozen) {
    if (params.has('t')) { const r = runAt(clock); turn = r.turn; if (r.span.type === 'hold') for (const c of book.controls) if (c.spread === r.span.from) c.value = demoValue(c, r.into) * (c.demoScale || 1); }
    return;
  }
  if (!auto && !grab && now - lastInput > IDLE_RESUME) {
    // Take over again: finish any half-turned page, then carry on from that spread's rest.
    const whole = Math.abs(turn - Math.round(turn)) < 1e-3;
    if (!whole && turnTarget === null) turnTarget = Math.ceil(turn);
    if (whole) {
      const k = Math.round(turn);
      const s = spans.find((q) => q.type === 'hold' && q.from === k);
      clock = s.t0 + 0.4;
      auto = true; turnTarget = null;
      blendFrom = { at: now, values: book.controls.map((c) => c.value) };
    }
  }
  if (auto) {
    clock += dt;
    const r = runAt(clock);
    turn = r.turn;
    if (r.span.type === 'hold') {
      book.controls.forEach((c, i) => {
        if (c.spread !== r.span.from) return;
        let v = demoValue(c, r.into) * (c.demoScale || 1);
        if (blendFrom) v = blendFrom.values[i] + (v - blendFrom.values[i]) * ease((now - blendFrom.at) / 1.2);
        c.value = v;
      });
    }
    // ease the camera home
    for (const k of ['yaw', 'pitch', 'zoom']) cam[k] += (camHome[k] - cam[k]) * Math.min(1, dt * 0.9);
    if (Math.abs(cam.yaw) < 1e-4 && Math.abs(cam.pitch) < 1e-4 && Math.abs(cam.zoom - 1) < 1e-4) Object.assign(cam, camHome);
  } else if (turnTarget !== null && !grab) {
    const d = turnTarget - turn;
    const stepSize = Math.sign(d) * Math.min(Math.abs(d), Math.max(Math.abs(d) * KEY_TURN_RATE, 0.45) * dt);
    turn += stepSize;
    if (Math.abs(turnTarget - turn) < 1e-4) { turn = turnTarget; turnTarget = null; }
  }
}

function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const secs = now / 1000;
  advance(dt, secs);

  book.setTurn(turn);
  const values = book.controls.map((c) => c.value.toFixed(4)).join();
  const moved = turn !== lastTurn || values !== lastValues;
  if (moved) { book.update(); renderer.setFrames(book.frameData(), book.frameCount); lastMoved = secs; }
  const speed = dt > 0 ? (turn - lastTurn) / dt : 0;
  lastTurn = turn; lastValues = values;

  const want = engineerOn ? 1 : 0;
  if (engineerAmount !== want) { engineerAmount = clamp(engineerAmount + Math.sign(want - engineerAmount) * dt * 3, 0, 1); lastMoved = secs; }
  placeCamera();
  const still = frozen ? true : secs - lastMoved > STILL_AFTER && !grab;
  const res = renderer.render({ ...view, groups: book.groups(), changed: moved, still, blueprint: engineerAmount });
  if (engineerAmount > 0 || engineer.shown) { engineer.draw(book, viewProj(), engineerAmount); engineer.shown = engineerAmount > 0; }

  if (!$('loading').hidden) { $('loading').hidden = true; document.body.classList.add('ready'); boot.totalMs = performance.now() - boot.start; }

  // Words that follow the book.
  const k = Math.round(turn);
  if (k !== lastSpread) {
    lastSpread = k;
    $('count').textContent = k === 0 ? 'Cover' : `${k} of ${BOOK.SPREADS}`;
    $('caption').textContent = STORY[k];
    $('prev').disabled = k === 0; $('next').disabled = k === BOOK.SPREADS;
    if (k > 0) { const s = book.spreads[k]; $('legend-count').textContent = `Spread ${k}: ${s.parts} parts, ${s.creases.filter((c) => c.kind === 'fold').length + 1} folds, ${s.tabs.length} glue tabs`; } else $('legend-count').textContent = 'Open the book to see its folds';
  }
  sound.update({ turn, speed, dt, controls: book.controls, book });

  // Frame time, and a lower drawing resolution when moving frames take too long.
  const ms = now - (tick.prev || now); tick.prev = now;
  stats.samples = res.samples; stats.mode = res.samples ? 'still' : 'moving'; stats.scale = scale;
  if (!res.samples && !res.done && ms > 0 && ms < 400) {
    ema = ema * 0.9 + ms * 0.1; stats.ms = ema; frames++;
    if (!fixedScale && !frozen && frames > 30) {
      slow = ema > TARGET_MS ? slow + 1 : 0;
      steady = ema < SMOOTH_MS ? steady + 1 : 0;
      if (slow > 40 && scale > MIN_SCALE) { ceiling = Math.max(MIN_SCALE, scale * 0.96); scale = Math.max(MIN_SCALE, scale * 0.86); slow = steady = frames = 0; renderer.setScale(scale); }
      else if (steady > 240 && scale < ceiling - 0.02) { scale = Math.min(ceiling, scale * 1.1); slow = steady = frames = 0; renderer.setScale(scale); }
    }
  }
  if (!$('stats').hidden && (frames % 15 === 0 || res.samples)) {
    $('stats').textContent = `${stats.mode} · ${ema.toFixed(1)} ms · scale ${scale.toFixed(2)} · ${canvas.width}×${canvas.height} · samples ${res.samples} · ${book.mesh.stats.parts} parts · ${Math.round(book.mesh.stats.triangles / 1000)}k triangles`;
  }
}
function frame(now) { tick(now); requestAnimationFrame(frame); }
// One step of the loop by hand, for checks in a tab whose animation frames are held back.
window.__tick = (n = 1) => { for (let i = 0; i < n; i++) tick(performance.now()); };
if (params.get('stats') === '1') $('stats').hidden = false;

// For checks where animation frames are throttled: draws n moving frames back to back and returns
// the mean cost of one in milliseconds.
window.__bench = (n = 20, moving = true) => {
  const gl = renderer.gl;
  placeCamera();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    renderer.render({ ...view, eye: [view.eye[0] + i * 1e-4, view.eye[1], view.eye[2]], groups: book.groups(), changed: moving, still: false, blueprint: 0 });
    gl.finish();
  }
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  return { msPerFrame: (performance.now() - t0) / n, width: canvas.width, height: canvas.height, scale: renderer.scale, live: renderer.info.live };
};
// Finishes the still picture now (all its samples), for screenshots.
window.__finish = () => {
  book.setTurn(turn); book.update(); renderer.setFrames(book.frameData(), book.frameCount); placeCamera();
  let r = { done: false }, n = 0;
  while (!r.done && n++ < 400) r = renderer.render({ ...view, groups: book.groups(), changed: false, still: true, blueprint: engineerAmount });
  return r;
};
window.__project = (p) => engineer.project(viewProj(), p);
window.__state = () => ({ turn, auto, turnTarget, clock, cam: { ...cam }, grab: grab && grab.kind, values: book.controls.map((c) => +c.value.toFixed(3)) });
window.__set = (o) => { if (o.turn !== undefined) { turn = o.turn; auto = false; lastInput = 1e12; } if (o.cam) Object.assign(cam, o.cam); if (o.value !== undefined) for (const c of book.controls) c.value = o.value; };
requestAnimationFrame(frame);

// For work on the build: fetches every source file afresh (modules are cached hard), then reloads.
window.__reload = async (query = location.search) => {
  const files = ['index.html', 'src/main.js', 'src/book.js', 'src/art.js', 'src/story.js', 'src/engineer.js', 'src/sound.js', 'src/spreads/base.js', 'src/spreads/s1.js', 'src/spreads/s2.js',
    'src/spreads/s3.js', 'src/spreads/s4.js', 'src/spreads/s5.js', 'engine/fold.js', 'engine/spine.js', 'engine/cardmesh.js', 'engine/atlas.js', 'engine/paperlight.js', 'engine/papershaders.js', 'engine/glkit.js', 'engine/mat4.js'];
  await Promise.all(files.map((f) => fetch(new URL('../' + f, import.meta.url), { cache: 'reload' }).catch(() => 0)));
  location.href = location.pathname + query;
};

// For work on the build: draws one finished picture at a given size and posts it to a local
// receiver (a few lines of Python on port 8614), so pictures can be saved without the browser's help.
//   __shot('name', { w, h, turn, cam: { yaw, pitch, zoom }, value, engineer, moving })
window.__shot = async (name, o = {}) => {
  const w = o.w || 1600, h = o.h || 900;
  if (!o.keep) { auto = false; lastInput = 1e12; Object.assign(cam, camHome, o.cam || {}); }
  if (o.turn !== undefined) turn = o.turn;
  if (o.value !== undefined) for (const c of book.controls) c.value = o.value;
  engineerAmount = o.engineer ? 1 : 0; engineerOn = !!o.engineer;
  renderer.resize(w, h);
  book.setTurn(turn); book.update(); renderer.setFrames(book.frameData(), book.frameCount); placeCamera();
  if (o.moving) for (let i = 0; i < 4; i++) renderer.render({ ...view, groups: book.groups(), changed: true, still: false, blueprint: engineerAmount });
  else window.__finish();
  const copy = document.createElement('canvas');
  copy.width = w; copy.height = h;
  const g = copy.getContext('2d');
  g.drawImage(canvas, 0, 0);
  if (o.engineer) { engineer.resize(w, h, 1); engineer.draw(book, viewProj(), 1); g.drawImage($('overlay'), 0, 0); }
  await fetch('http://127.0.0.1:8614/?name=' + name, { method: 'POST', mode: 'no-cors', body: copy.toDataURL('image/jpeg', 0.9) });
  applySize();
  return name;
};
