// src/main.js
// The page: time, the season slider, the camera, input and quality settings.
//
// URL controls (for looking at exact moments):
//   ?t=12.5          freeze the animation at 12.5 seconds
//   ?season=autumn   start in a season (spring, summer, autumn, winter) or at a number 0..1
//   ?view=crown      camera: wide (default), crown, ground, squirrel
//   ?yaw=1.2         start with the camera swung round by this many radians
//   ?fov=4           force the lens angle in degrees (for close stills)
//   ?stats=1         show frame rate and counts
//   ?quality=phone   force the phone settings (or desktop)
//   ?tune=fresh      measure this device's speed again (tune=0 skips the check)

import { growTree } from '../engine/tree.js';
import { SEASON_STILLS, seasonName } from '../engine/seasons.js';
import { createScene } from './scene.js';
import { createSound } from './sound.js';

const YEAR_SECONDS = 64;        // length of the automatic year
const START_YEAR = 0.07;        // the page opens as the blossom opens
const HOLD_CREEP = 0.15;        // speed of the year just after the slider is let go (1 = normal)
const HOLD_SECONDS = 4;         // how long the slow creep lasts before the cycle picks up again
const ORBIT_SWING = 0.38;       // radians the camera drifts either side of its start
const ORBIT_RATE = 0.045;       // speed of that drift
const DRAG_YAW = 0.005;         // radians of orbit per pixel dragged
const TARGET_FRAME_MS = 21;     // above this the picture is rendered at a lower resolution
const MIN_SCALE = 0.45;         // lowest internal resolution as a share of full
const SMOOTH_FRAME_MS = 17.6;   // at or under this the page is holding 60 frames a second
const STEP_UP_AFTER = 150;      // smooth frames in a row before the resolution is tried one step higher
const STEP_UP = 1.12;           // size of that step
const TUNE_BUDGET_MS = 13;      // start-up check: aim for a frame that costs this much
const TUNE_MSAA_LIMIT_MS = 20;  // slower than this at start-up and multisampling is switched off
const TUNE_PROBE_SCALE = 0.5;   // the check draws at this share of full size, so it is quick
const TUNE_FILL_FACTOR = 2.5;   // measured: a full-size frame costs this many half-size frames
const TUNE_MSAA_SAVING = 0.72;  // measured: frame cost with multisampling off, as a share of on
const TUNE_KEEP_DAYS = 7;       // the result is remembered on this device for this long

// Camera presets. distance and height in metres, fov in degrees.
// blur scales the depth of field: a close view would otherwise blur everything but one thin slice.
const VIEWS = {
  wide: { label: 'Whole tree', distance: 46, height: 3.2, target: [0, 4.9, 0], fov: 17, fitWidth: 13.5, blur: 1 },
  crown: { label: 'Crown', distance: 21, height: 6.4, target: [1.4, 6.7, 0], fov: 15, fitWidth: 5, blur: 0.6 },
  ground: { label: 'Ground', distance: 13, height: 0.9, target: [0.9, 1.5, 0], fov: 25, fitWidth: 5, blur: 0.4 },
  // A long lens that follows the squirrel. When it is away (deep winter) this falls back to the ground view.
  squirrel: { label: 'Squirrel', distance: 9, height: 0.75, target: [0, 0.14, 0], fov: 8, fitWidth: 1.3, blur: 0.3, follow: true },
};
const VIEW_ORDER = ['wide', 'crown', 'ground', 'squirrel'];

const QUALITY = {
  desktop: { twigs: 8000, leafSizeMul: 1, grassBlades: 50000, flowers: 9000, butterflies: 30, snowflakes: 6000, shadowSize: 2048, msaa: 4, maxDpr: 2, blur: 1, maxBlurPx: 11, blurStep: 1.4 },
  phone: { twigs: 3200, leafSizeMul: 1.5, grassBlades: 14000, flowers: 3500, butterflies: 20, snowflakes: 2000, shadowSize: 1024, msaa: 4, maxDpr: 1.5, blur: 1, maxBlurPx: 7, blurStep: 2.2 },
};

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('scene');
const slider = document.getElementById('year');
const seasonLabel = document.getElementById('season-name');
const soundButton = document.getElementById('sound');
const viewButton = document.getElementById('view');
const statsBox = document.getElementById('stats');

const isPhone = params.get('quality') === 'phone' ||
  (params.get('quality') !== 'desktop' && (Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer: coarse)').matches));
const quality = isPhone ? QUALITY.phone : QUALITY.desktop;

// Start-up is done in steps with a pause between, so the page can paint its loading line first.
const loading = document.getElementById('loading');
const pause = () => new Promise((done) => {
  const t = setTimeout(done, 60);   // a hidden tab never gets an animation frame; do not wait for one
  requestAnimationFrame(() => { clearTimeout(t); setTimeout(done, 0); });
});
const boot = { start: performance.now() };
window.__boot = boot;

let scene, sound;
try {
  await pause();
  let mark = performance.now();
  const tree = growTree({ twigs: quality.twigs });
  boot.treeMs = performance.now() - mark;
  await pause();
  mark = performance.now();
  scene = createScene(canvas, tree, quality);
  boot.sceneMs = performance.now() - mark;
  window.__tree = tree.stats;
} catch (err) {
  loading.hidden = true;
  document.getElementById('error').textContent = 'This page needs WebGL2. ' + err.message;
  document.getElementById('error').hidden = false;
  throw err;
}
sound = createSound();

// --- Time -------------------------------------------------------------------------------------
const frozen = params.has('t');
let time = frozen ? parseFloat(params.get('t')) || 0 : 0;
let startYear = START_YEAR;
if (params.has('season')) {
  const s = params.get('season');
  startYear = s in SEASON_STILLS ? SEASON_STILLS[s] : (parseFloat(s) || 0);
}
let year = startYear + (frozen ? time / YEAR_SECONDS : 0);
let holding = false;       // a thumb is on the slider
let releasedAt = -1e9;     // when it was let go

// --- Camera -----------------------------------------------------------------------------------
let viewName = VIEWS[params.get('view')] ? params.get('view') : 'wide';
const cam = { ...VIEWS[viewName], target: [...VIEWS[viewName].target] };
const centre = [0, 0, 0];   // the point the camera circles: the tree, or the squirrel in its view
let dragYaw = parseFloat(params.get('yaw')) || 0, dragLift = 0, parX = 0, parY = 0, parTX = 0, parTY = 0;

function setView(name) {
  viewName = name;
  viewButton.textContent = 'View: ' + VIEWS[name].label.toLowerCase();
}
setView(viewName);

// --- Input ------------------------------------------------------------------------------------
slider.addEventListener('pointerdown', () => { holding = true; });
slider.addEventListener('input', () => { holding = true; year = slider.value / 1000; });
const release = () => { if (holding) { holding = false; releasedAt = performance.now() / 1000; } };
slider.addEventListener('pointerup', release);
slider.addEventListener('pointercancel', release);
slider.addEventListener('change', release);
slider.addEventListener('blur', release);

let dragging = false, lastX = 0, lastY = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (dragging) {
    dragYaw -= (e.clientX - lastX) * DRAG_YAW;
    dragLift = Math.max(-0.6, Math.min(1.6, dragLift + (e.clientY - lastY) * 0.012));
    lastX = e.clientX; lastY = e.clientY;
  }
  parTX = (e.clientX / innerWidth - 0.5) * 2;
  parTY = (e.clientY / innerHeight - 0.5) * 2;
});
const endDrag = () => { dragging = false; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
    year = (((year + (e.key === 'ArrowRight' ? 0.01 : -0.01)) % 1) + 1) % 1;
    releasedAt = performance.now() / 1000;
    e.preventDefault();
  } else if (e.key >= '1' && e.key <= '4') {
    setView(VIEW_ORDER[+e.key - 1]);
  }
});
viewButton.addEventListener('click', () => setView(VIEW_ORDER[(VIEW_ORDER.indexOf(viewName) + 1) % VIEW_ORDER.length]));
soundButton.addEventListener('click', () => {
  if (sound.on) { sound.stop(); soundButton.textContent = 'Enable sound'; soundButton.setAttribute('aria-pressed', 'false'); }
  else { sound.start(); soundButton.textContent = 'Sound on'; soundButton.setAttribute('aria-pressed', 'true'); }
});

// --- Size and adaptive resolution ---------------------------------------------------------------
let scale = 1;
function applySize() {
  const dpr = Math.min(window.devicePixelRatio || 1, quality.maxDpr) * scale;
  scene.resize(innerWidth * dpr, innerHeight * dpr);
}
addEventListener('resize', applySize);
applySize();

// Start-up check: time a few real frames and pick a resolution this GPU can hold.
// Skipped when time is frozen (?t=), so stills are always drawn at full quality.
function frameCost(n) {
  const gl = scene.gl;
  const v = VIEWS.wide;
  const shot = { time: 0, year: 0.38, eye: [0, v.height, v.distance], target: v.target, fovY: (v.fov * Math.PI) / 180, focus: v.distance, yearSeconds: YEAR_SECONDS };
  const px = new Uint8Array(4);
  const once = () => { scene.render(shot); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  once(); once();   // the first frames also pay for setting up the GPU programs, so they are not timed
  // Take the quickest of n frames: a slow one is a hiccup somewhere else, not the cost of the scene.
  let best = 1e9;
  for (let i = 0; i < n; i++) { const t0 = performance.now(); once(); best = Math.min(best, performance.now() - t0); }
  return best;
}
const tune = { cost: 0, scale: 1, msaa: quality.msaa, from: 'off' };
const tuneKey = `tree13-tune-${isPhone ? 'phone' : 'desktop'}-${innerWidth}x${innerHeight}@${window.devicePixelRatio || 1}`;
const saveTune = () => {
  try { localStorage.setItem(tuneKey, JSON.stringify({ scale, msaa: tune.msaa, when: Date.now() })); } catch (e) { /* private mode: just measure again next time */ }
};
if (!frozen && params.get('tune') !== '0') {
  await pause();
  const mark = performance.now();
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(tuneKey)); } catch (e) { saved = null; }
  if (params.get('tune') !== 'fresh' && saved && saved.scale >= MIN_SCALE && saved.scale <= 1 && Date.now() - saved.when < TUNE_KEEP_DAYS * 864e5) {
    // Seen this device and window size before: reuse the answer and skip the check.
    if (saved.msaa === 0) { scene.setMsaa(0); tune.msaa = 0; }
    scale = saved.scale;
    tune.from = 'saved';
  } else {
    // Time a few frames at half size and work out what a full-size frame would cost.
    scale = TUNE_PROBE_SCALE;
    applySize();
    let cost = frameCost(3) * TUNE_FILL_FACTOR;
    tune.cost = cost;
    if (cost > TUNE_MSAA_LIMIT_MS) { scene.setMsaa(0); tune.msaa = 0; cost *= TUNE_MSAA_SAVING; }
    scale = Math.max(MIN_SCALE, Math.min(1, Math.sqrt(TUNE_BUDGET_MS / cost)));
    tune.from = 'measured';
    saveTune();
  }
  applySize();
  tune.scale = scale;
  boot.tuneMs = performance.now() - mark;
}
window.__tune = tune;

// --- Loop -------------------------------------------------------------------------------------
let last = performance.now(), emaMs = 16.7, slowFrames = 0, steadyFrames = 0, frames = 0;
let ceiling = 1;   // the highest resolution worth trying; lowered each time a step up proves too slow
let trial = null;  // the last step down, kept until we know whether it made frames any quicker
let capped = false; // true when frames are slow for a reason resolution cannot fix (for example a 30 fps power saver)
const stats = { fps: 60, ms: 16.7, scale: 1 };
window.__stats = stats;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!frozen) {
    time += dt;
    const since = now / 1000 - releasedAt;
    const speed = holding ? 0 : since < HOLD_SECONDS ? HOLD_CREEP : Math.min(1, HOLD_CREEP + (since - HOLD_SECONDS) * 0.5);
    year = (year + (dt * speed) / YEAR_SECONDS) % 1;
  }
  const y = ((year % 1) + 1) % 1;
  if (!holding) slider.value = Math.round(y * 1000);
  const name = seasonName(y);
  if (seasonLabel.textContent !== name) seasonLabel.textContent = name;

  // Ease the camera towards the chosen view.
  let v = VIEWS[viewName];
  const quarry = v.follow ? scene.life.squirrel : null;
  if (v.follow && !quarry) v = VIEWS.ground;
  const k = frozen ? 1 : 1 - Math.exp(-dt * 2.2);
  const want = quarry ? quarry.pos : [0, 0, 0];
  const kc = frozen ? 1 : 1 - Math.exp(-dt * (quarry ? 5 : 2.2));
  for (let i = 0; i < 3; i++) centre[i] += (want[i] - centre[i]) * kc;
  cam.distance += (v.distance - cam.distance) * k;
  cam.height += (v.height - cam.height) * k;
  cam.fov += (v.fov - cam.fov) * k;
  cam.fitWidth += (v.fitWidth - cam.fitWidth) * k;
  cam.blur += (v.blur - cam.blur) * k;
  for (let i = 0; i < 3; i++) cam.target[i] += (v.target[i] - cam.target[i]) * k;
  const aim = [cam.target[0] + centre[0], cam.target[1] + centre[1], cam.target[2] + centre[2]];
  parX += (parTX - parX) * (frozen ? 0 : Math.min(1, dt * 3));
  parY += (parTY - parY) * (frozen ? 0 : Math.min(1, dt * 3));

  const yaw = ORBIT_SWING * Math.sin(time * ORBIT_RATE) + dragYaw + parX * 0.03;
  const height = Math.max(0.4, cam.height + centre[1] + dragLift * (cam.height * 0.5 + 1) - parY * 0.25);
  const eye = [centre[0] + Math.sin(yaw) * cam.distance, height, centre[2] + Math.cos(yaw) * cam.distance];
  // On a tall, narrow screen widen the lens so the whole subject still fits.
  const aspect = canvas.width / canvas.height;
  let fovY = ((parseFloat(params.get('fov')) || cam.fov) * Math.PI) / 180;
  const fitFov = 2 * Math.atan(cam.fitWidth / (2 * cam.distance * aspect));
  if (!params.has('fov')) fovY = Math.max(fovY, fitFov);
  const focus = Math.hypot(eye[0] - aim[0], eye[1] - aim[1], eye[2] - aim[2]);

  const st = scene.render({ time, year: y, eye, target: aim, fovY, focus, blur: cam.blur, yearSeconds: YEAR_SECONDS });
  if (!loading.hidden) { loading.hidden = true; boot.totalMs = performance.now() - boot.start; }
  // Tell the sound where the animals are: left or right of the lens, and how near.
  const took = scene.life.drain();
  if (sound.on) {
    const vx = aim[0] - eye[0], vz = aim[2] - eye[2], vl = Math.hypot(vx, vz) || 1;
    const edge = Math.tan(fovY / 2) * aspect;        // sideways reach of the frame per metre of depth
    const hear = (p) => {
      const dx = p[0] - eye[0], dz = p[2] - eye[2];
      const depth = (dx * vx + dz * vz) / vl, across = (dz * vx - dx * vz) / vl;
      const d = Math.hypot(dx, p[1] - eye[1], dz);
      return { pan: Math.max(-1, Math.min(1, (across / Math.max(depth, 1) / edge) * 0.8)), near: Math.max(0.2, Math.min(1.5, 12 / d)) };
    };
    const sq = scene.life.squirrel, fl = scene.life.flock;
    sound.update(st, {
      squirrel: sq ? { mode: sq.mode, moving: sq.moving, onBark: sq.onBark, ...hear(sq.pos) } : null,
      flock: fl ? hear(fl.pos) : null,
      takeoffs: took.map((e) => hear(e.pos)),
    });
  }

  // Frame rate, and a lower internal resolution when frames take too long.
  const ms = now - (frame.prev || now); frame.prev = now;
  if (ms > 0 && ms < 500) emaMs = emaMs * 0.92 + ms * 0.08;
  stats.ms = emaMs; stats.fps = 1000 / emaMs; stats.scale = scale; stats.capped = capped;
  frames++;
  if (!frozen && frames > 40) {
    // Resolution finds its own level: down a step when frames run slow, up a step after a long
    // smooth spell. A step up that fails sets a ceiling just below it, so it does not see-saw.
    slowFrames = emaMs > TARGET_FRAME_MS ? slowFrames + 1 : 0;
    steadyFrames = emaMs <= SMOOTH_FRAME_MS ? steadyFrames + 1 : 0;
    if (trial && frames > 70) {
      // Did the last step down buy anything? If not, the browser is holding the frame rate down
      // itself (a power saver, a 30 Hz screen). Put the resolution back and stop adjusting.
      if (emaMs <= trial.ms * 0.93) {
        trial = null;                       // it helped: carry on as normal
      } else if (trial.tries < 2 && scale > MIN_SCALE) {
        // A screen shows whole frames only, so one step can fail to cross the line. Try one more.
        trial.tries++;
        scale = Math.max(MIN_SCALE, scale * 0.85);
        frames = 0;
        applySize();
      } else {
        scale = trial.scale; capped = true; trial = null;
        applySize();
        saveTune();
      }
    } else if (capped || trial) {
      // nothing to do
    } else if (slowFrames > 45 && scale > MIN_SCALE) {
      trial = { ms: emaMs, scale, tries: 1 };
      ceiling = Math.max(MIN_SCALE, scale * 0.95);
      scale = Math.max(MIN_SCALE, scale * 0.85);
      slowFrames = 0; steadyFrames = 0; frames = 0;
      applySize();
      saveTune();
    } else if (steadyFrames > STEP_UP_AFTER && scale < ceiling - 0.02) {
      scale = Math.min(ceiling, scale * STEP_UP);
      steadyFrames = 0; frames = 0;
      applySize();
      saveTune();
    }
  }
  if (statsBox && !statsBox.hidden && frames % 20 === 0) {
    statsBox.textContent = `${stats.fps.toFixed(0)} fps · ${canvas.width}×${canvas.height} · scale ${scale.toFixed(2)} · ${scene.info.leaves} leaves · ${Math.round(scene.info.triangles / 1000)}k triangles · msaa ${scene.info.msaa} · ${scene.info.hdr ? 'hdr' : 'ldr'}`;
  }
  requestAnimationFrame(frame);
}
if (params.get('stats') === '1') statsBox.hidden = false;

// For checks in a headless or hidden browser, where requestAnimationFrame is throttled:
// draws n frames back to back and returns the mean cost of one frame in milliseconds.
window.__quality = quality;
window.__sound = sound;   // __sound.audition('cuckoo') plays one phrase of that bird now
window.__scene = scene;
window.__bench = (n = 30, y = 0.38) => {
  const gl = scene.gl;
  const eye = [0, VIEWS.wide.height, VIEWS.wide.distance];
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    scene.render({ time: i / 60, year: y, eye, target: VIEWS.wide.target, fovY: (VIEWS.wide.fov * Math.PI) / 180, focus: VIEWS.wide.distance, yearSeconds: YEAR_SECONDS });
    gl.finish();
  }
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  return { msPerFrame: (performance.now() - t0) / n, width: canvas.width, height: canvas.height, quality: isPhone ? 'phone' : 'desktop', leaves: scene.info.leaves, msaa: scene.info.msaa, hdr: scene.info.hdr };
};
requestAnimationFrame(frame);
