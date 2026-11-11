// src/main.js
// The page: time, the season slider, the camera, input and quality settings.
//
// URL controls (for looking at exact moments):
//   ?t=12.5          freeze the animation at 12.5 seconds
//   ?season=autumn   start in a season (spring, summer, autumn, winter) or at a number 0..1
//   ?view=crown      camera: wide (default), crown, ground
//   ?stats=1         show frame rate and counts
//   ?quality=phone   force the phone settings (or desktop)

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
const TUNE_BUDGET_MS = 13;      // start-up check: aim for a frame that costs this much
const TUNE_MSAA_LIMIT_MS = 20;  // slower than this at start-up and multisampling is switched off

// Camera presets. distance and height in metres, fov in degrees.
const VIEWS = {
  wide: { label: 'Whole tree', distance: 46, height: 3.2, target: [0, 4.9, 0], fov: 17, fitWidth: 13.5 },
  crown: { label: 'Crown', distance: 21, height: 6.4, target: [1.4, 6.7, 0], fov: 15, fitWidth: 5 },
  ground: { label: 'Ground', distance: 13, height: 0.9, target: [0.4, 1.5, 0], fov: 25, fitWidth: 5 },
};
const VIEW_ORDER = ['wide', 'crown', 'ground'];

const QUALITY = {
  desktop: { twigs: 8000, leafSizeMul: 1, grassBlades: 50000, snowflakes: 6000, shadowSize: 2048, msaa: 4, maxDpr: 2, blur: 1, maxBlurPx: 11, blurStep: 1.4 },
  phone: { twigs: 3200, leafSizeMul: 1.5, grassBlades: 14000, snowflakes: 2000, shadowSize: 1024, msaa: 4, maxDpr: 1.5, blur: 1, maxBlurPx: 7, blurStep: 2.2 },
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

let scene, sound;
try {
  const tree = growTree({ twigs: quality.twigs });
  scene = createScene(canvas, tree, quality);
  window.__tree = tree.stats;
} catch (err) {
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
let dragYaw = 0, dragLift = 0, parX = 0, parY = 0, parTX = 0, parTY = 0;

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
  } else if (e.key >= '1' && e.key <= '3') {
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
  once(); once();
  const t0 = performance.now();
  for (let i = 0; i < n; i++) once();
  return (performance.now() - t0) / n;
}
const tune = { cost: 0, scale: 1, msaa: quality.msaa };
if (!frozen && params.get('tune') !== '0') {
  let cost = frameCost(3);
  tune.cost = cost;
  if (cost > TUNE_MSAA_LIMIT_MS) {
    scene.setMsaa(0);
    tune.msaa = 0;
    cost = frameCost(2);
  }
  if (cost > TUNE_BUDGET_MS) {
    scale = Math.max(MIN_SCALE, Math.min(1, Math.sqrt(TUNE_BUDGET_MS / cost)));
    applySize();
  }
  tune.scale = scale;
}
window.__tune = tune;

// --- Loop -------------------------------------------------------------------------------------
let last = performance.now(), emaMs = 16.7, slowFrames = 0, frames = 0;
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
  const v = VIEWS[viewName];
  const k = frozen ? 1 : 1 - Math.exp(-dt * 2.2);
  cam.distance += (v.distance - cam.distance) * k;
  cam.height += (v.height - cam.height) * k;
  cam.fov += (v.fov - cam.fov) * k;
  cam.fitWidth += (v.fitWidth - cam.fitWidth) * k;
  for (let i = 0; i < 3; i++) cam.target[i] += (v.target[i] - cam.target[i]) * k;
  parX += (parTX - parX) * (frozen ? 0 : Math.min(1, dt * 3));
  parY += (parTY - parY) * (frozen ? 0 : Math.min(1, dt * 3));

  const yaw = ORBIT_SWING * Math.sin(time * ORBIT_RATE) + dragYaw + parX * 0.03;
  const height = Math.max(0.4, cam.height + dragLift * (cam.height * 0.5 + 1) - parY * 0.25);
  const eye = [Math.sin(yaw) * cam.distance, height, Math.cos(yaw) * cam.distance];
  // On a tall, narrow screen widen the lens so the whole subject still fits.
  const aspect = canvas.width / canvas.height;
  let fovY = (cam.fov * Math.PI) / 180;
  const fitFov = 2 * Math.atan(cam.fitWidth / (2 * cam.distance * aspect));
  fovY = Math.max(fovY, fitFov);
  const focus = Math.hypot(eye[0] - cam.target[0], eye[1] - cam.target[1], eye[2] - cam.target[2]);

  const st = scene.render({ time, year: y, eye, target: cam.target, fovY, focus, yearSeconds: YEAR_SECONDS });
  sound.update(st);

  // Frame rate, and a lower internal resolution when frames take too long.
  const ms = now - (frame.prev || now); frame.prev = now;
  if (ms > 0 && ms < 500) emaMs = emaMs * 0.92 + ms * 0.08;
  stats.ms = emaMs; stats.fps = 1000 / emaMs; stats.scale = scale;
  frames++;
  if (!frozen && frames > 40) {
    slowFrames = emaMs > TARGET_FRAME_MS ? slowFrames + 1 : 0;
    if (slowFrames > 45 && scale > MIN_SCALE) {
      scale = Math.max(MIN_SCALE, scale * 0.85);
      slowFrames = 0; frames = 0;
      applySize();
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
