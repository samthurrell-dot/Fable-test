// engine/squirrel.js
// The red squirrel: what it is doing at any moment, and the shape of its body in that pose.
// No WebGL and no stored state. The same time always gives the same squirrel.
//
//   const route = findSquirrelRoute(tree.skeleton);          // from engine/life.js
//   const s = squirrelPose(time, route);                     // { pos, fwd, up, pose, mode, moving, onBark }
//   const mesh = createSquirrelMesh();
//   buildSquirrelMesh(s.pose, time, mesh);                   // fills mesh.vertices (model space, metres)
//
// Model space: x forward, y out of the surface it stands on (up, on the ground), z to its left.
// Sizes are life size; the page draws it a little larger.

import { routeAt } from './life.js';

export const SQUIRREL = {
  GROUND_SPEED: 1.7,     // metres per second bounding over grass
  CLIMB_SPEED: 1.15,     // up and down the trunk
  BOUGH_SPEED: 0.95,     // along a branch
  STRIDE: 0.32,          // metres covered by one bound on the ground
  CLIMB_STRIDE: 0.2,     // and on bark
  BLEND: 0.28,           // seconds to ease from one posture into the next
  TURN: 0.34,            // seconds to swing round to a new heading
  GLANCE: 0.85,          // seconds between looks in a new direction
  TAIL_LENGTH: 0.2,      // metres
};

export const SQUIRREL_VERTEX_FLOATS = 11;   // position 3, normal 3, coat coordinate 3, kind 1, belly 1
// kind: 0 body, 2 eye, 3 tail, 4 ear, 5 nut

const SIDES = 12;
const TAIL_POINTS = 12;
const TAU = Math.PI * 2;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const lerp = (a, b, f) => a + (b - a) * f;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (a, b = 0) => { const h = Math.sin(a * 127.1 + b * 311.7 + 4.71) * 43758.5453; return h - Math.floor(h); };

// --- Postures -----------------------------------------------------------------------------------
// Each posture is a handful of numbers. Blending two postures blends the numbers.
//   hip, chest      centres of the pelvis and ribcage in the side view (x forward, y up)
//   arch            how far the back humps up between them
//   headPitch/Yaw   where the nose points (radians; pitch 0 = level)
//   hf, ff          hind feet and front paws (x, y), with z = half the gap between left and right
//   *Split          how far the left foot leads the right
//   tail            angle of the tail at its root, how fast it curls along its length, and at the tip
const STAND = {
  hipX: -0.05, hipY: 0.052, chestX: 0.05, chestY: 0.05, arch: 0.012, headPitch: 0.12, headYaw: 0,
  hfX: -0.045, hfY: 0, hfZ: 0.028, hfSplit: 0, ffX: 0.064, ffY: 0, ffZ: 0.019, ffSplit: 0,
  tailBase: 0.55, tailCurl: 1.5, tailTip: -1.2, tailWave: 0, tailPhase: 0, nut: 0, hop: 0,
};
const SNIFF = { ...STAND, hipY: 0.056, chestX: 0.048, chestY: 0.036, arch: 0.018, headPitch: -0.8, ffX: 0.06, tailBase: 0.3, tailCurl: 0.9, tailTip: -0.5 };
const SIT = { ...STAND, hipX: -0.036, hipY: 0.044, chestX: -0.008, chestY: 0.118, arch: 0.02, headPitch: -0.12,
  hfX: -0.02, ffX: 0.04, ffY: 0.142, ffZ: 0.007, tailBase: 1.75, tailCurl: 0.15, tailTip: -2.5 };
const ALERT = { ...STAND, hipX: -0.03, hipY: 0.05, chestX: -0.014, chestY: 0.138, arch: 0.004, headPitch: 0.12,
  hfX: -0.02, ffX: 0.024, ffY: 0.112, ffZ: 0.013, tailBase: 1.25, tailCurl: 0.3, tailTip: -0.7 };
const CLING = { ...STAND, hipX: -0.052, hipY: 0.03, chestX: 0.05, chestY: 0.03, arch: 0.004, headPitch: 0.5,
  hfX: -0.075, hfZ: 0.042, ffX: 0.088, ffZ: 0.04, tailBase: 0.06, tailCurl: 0.1, tailTip: 0 };

function mixPose(a, b, f) {
  const out = {};
  for (const k in a) out[k] = a[k] + (b[k] - a[k]) * f;
  return out;
}

// Quick looks about: the head snaps to a new angle every so often and holds still between.
function glance(t, seed, range) {
  const W = SQUIRREL.GLANCE, k = Math.floor(t / W), into = t - k * W;
  const a = (hash(k - 1, seed) - 0.5) * 2 * range, b = (hash(k, seed) - 0.5) * 2 * range;
  return lerp(a, b, smooth(0, 0.13, into));
}
// 1 during a burst of tail flicking, 0 between bursts.
const flickBurst = (t, seed) => (hash(Math.floor(t / 1.3), seed) > 0.5 ? smooth(0, 0.1, (t / 1.3) % 1) * smooth(0.75, 0.55, (t / 1.3) % 1) : 0);

// One foot through one bound. g = phase of the bound 0..1. The foot is planted for `share` of the
// bound, sliding back under the body by `travel`, then swings forward in an arc.
function footCycle(g, start, share, xFront, travel, lift) {
  const u = (g - start + 1) % 1;
  if (u < share) return [xFront - travel * (u / share), 0];
  const s = (u - share) / (1 - share), e = s * s * (3 - 2 * s);
  return [xFront - travel * (1 - e), lift * Math.sin(Math.PI * s)];
}

// The bounding gait. Squirrels do not trot: both hind feet push off together, the body stretches
// out in the air, the front paws land together, and the back humps as the hind feet swing in
// past them. On bark it is the same movement, flatter and with the legs spread.
function gaitPose(g, climb) {
  const base = climb ? CLING : STAND;
  const S = climb ? SQUIRREL.CLIMB_STRIDE : SQUIRREL.STRIDE;
  const w = g * TAU;
  const len = (climb ? 0.1 : 0.094) + (climb ? 0.012 : 0.02) * Math.cos(w - 0.3);
  const flight = g < 0.32 ? Math.sin((Math.PI * g) / 0.32) : 0;
  const bodyY = (climb ? 0.031 : 0.052) + (climb ? 0.004 : 0.03) * flight;
  const tilt = (climb ? 0.004 : 0.017) * Math.sin(w + 0.9);       // nose up as it leaves the ground, rump up as it lands
  const hind = footCycle(g, 0.6, 0.4, -len / 2 + (climb ? 0.03 : 0.065), S * 0.4, climb ? 0.012 : 0.034);
  const fore = footCycle(g, 0.3, 0.25, len / 2 + (climb ? 0.05 : 0.06), S * 0.25, climb ? 0.012 : 0.03);
  return {
    ...base,
    hipX: -len / 2, chestX: len / 2, hipY: bodyY - tilt, chestY: bodyY + tilt - 0.002,
    arch: (climb ? 0.004 : 0.01) + (climb ? 0.01 : 0.028) * (0.5 - 0.5 * Math.cos(w - 0.3)),
    headPitch: climb ? 0.45 : 0.1,
    hfX: hind[0], hfY: hind[1], ffX: fore[0], ffY: fore[1],
    tailBase: climb ? 0.06 : 0.28, tailCurl: climb ? 0.15 : 0.55, tailTip: climb ? 0 : 0.1,
    tailWave: climb ? 0.16 : 0.34, tailPhase: w,
  };
}

// Posture for one stretch of the plan. tau = seconds since it began, t = clock time.
function segPose(seg, tau, t) {
  switch (seg.mode) {
    case 'run': case 'climb': {
      const climb = seg.mode === 'climb';
      const x = clamp01(tau / seg.dur);
      const env = smooth(0, 0.14, x) * smooth(1, 0.88, x);        // the gait fades in and out with speed
      return mixPose(climb ? CLING : STAND, gaitPose((ease(x) * seg.bounds) % 1, climb), env);
    }
    case 'sniff':   // nose to the ground, working from side to side
      return { ...SNIFF, headPitch: SNIFF.headPitch + 0.09 * Math.sin(t * 17), headYaw: 0.4 * Math.sin(t * 2.3 + seg.seed * 9),
        chestY: SNIFF.chestY + 0.002 * Math.sin(t * 17), tailWave: 0.05, tailPhase: t * 3 };
    case 'dig': {   // front paws scrabble in turn
      const d = Math.sin(t * 30);
      return { ...SNIFF, headPitch: -0.95 + 0.06 * d, ffSplit: 0.024 * d, ffY: 0.007 * Math.abs(Math.cos(t * 30)),
        chestY: SNIFF.chestY + 0.003 * Math.sin(t * 60), hipY: SNIFF.hipY + 0.004, tailWave: 0.1, tailPhase: t * 30 };
    }
    case 'sit': {   // up on its haunches with something in its paws, nibbling in bursts
      const nib = hash(Math.floor(t / 0.9), seg.seed) > 0.28 ? 1 : 0;
      const n = Math.sin(t * 26) * nib;
      return { ...SIT, headPitch: SIT.headPitch + 0.05 * n, headYaw: glance(t, seg.seed, 0.35) * (1 - nib), ffY: SIT.ffY + 0.003 * n,
        ffX: SIT.ffX + 0.002 * Math.cos(t * 26) * nib, nut: 1, tailWave: 0.22 * flickBurst(t, seg.seed), tailPhase: t * 15 };
    }
    case 'alert':   // bolt upright, looking hard
      return { ...ALERT, headYaw: glance(t, seg.seed + 3, 1.1), chestY: ALERT.chestY + 0.003 * Math.sin(t * 5),
        tailWave: 0.3 * flickBurst(t * 1.6, seg.seed), tailPhase: t * 17 };
    case 'look':    // on all fours, head up
      return { ...STAND, headPitch: 0.34, chestY: STAND.chestY + 0.012, headYaw: glance(t, seg.seed + 5, 1.15),
        tailWave: 0.2 * flickBurst(t, seg.seed + 1), tailPhase: t * 15 };
    case 'groom': { // washing its face: both paws wipe down over the muzzle
      const w = t * 8.5, busy = hash(Math.floor(t / 1.7), seg.seed) > 0.2 ? 1 : 0;
      return { ...SIT, ffY: 0.15 + 0.014 * Math.sin(w) * busy, ffX: 0.036 + 0.009 * Math.cos(w) * busy, ffZ: 0.011,
        headPitch: -0.3 + 0.18 * Math.sin(w + 1.2) * busy, headYaw: 0.25 * Math.sin(t * 1.4) * busy, tailWave: 0.06, tailPhase: t * 4 };
    }
    case 'cling':   // spread flat on the bark, head lifted away to look
      return { ...CLING, headYaw: glance(t, seg.seed + 7, 1.25), headPitch: 0.6, tailWave: 0.3 * flickBurst(t * 1.4, seg.seed + 2), tailPhase: t * 16 };
    default:        // stand
      return { ...STAND, headYaw: glance(t, seg.seed, 0.8), headPitch: 0.25, tailWave: 0.14 * flickBurst(t, seg.seed), tailPhase: t * 15 };
  }
}

// Away from rest quickly, steady in the middle, quickly back to rest.
function ease(x) {
  const r = 0.16, v = 1 / (1 - r);
  if (x < r) return (v * x * x) / (2 * r);
  if (x > 1 - r) return 1 - (v * (1 - x) * (1 - x)) / (2 * r);
  return v * (x - r / 2);
}

// --- The plan: what it does, in order, round and round -----------------------------------------------
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function rotate(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), d = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
}

// A spot on the route, d metres along it and lat metres to one side (the side shift is for grass only).
function pointOn(route, d, lat) {
  const r = routeAt(route, d);
  const side = lat * smooth(route.ground, route.ground - 0.6, d);
  return [r.pos[0] + r.tan[2] * side, r.pos[1], r.pos[2] - r.tan[0] * side];
}
const segPoint = (route, seg, s) => pointOn(route, lerp(seg.a.d, seg.b.d, s), lerp(seg.a.lat, seg.b.lat, s));
function segDir(route, seg, s) {
  const a = segPoint(route, seg, Math.max(0, s - 0.03)), b = segPoint(route, seg, Math.min(1, s + 0.03));
  return norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
}
// The surface it stands on, smoothed so it tips over gently where grass meets trunk and trunk meets bough.
function surfaceUp(route, d) {
  const n = [0, 0, 0], tn = [0, 0, 0];
  for (const o of [-0.09, 0, 0.09]) {
    const r = routeAt(route, d + o);
    for (let k = 0; k < 3; k++) { n[k] += r.nrm[k]; tn[k] += r.tan[k]; }
  }
  const T = norm(tn), dn = dot(n, T);
  return norm([n[0] - T[0] * dn, n[1] - T[1] * dn, n[2] - T[2] * dn]);
}

function buildPlan(route) {
  const g = route.ground, c = route.climb, e = route.total, mid = g + (c - g) * 0.52;
  const G = SQUIRREL.GROUND_SPEED, C = SQUIRREL.CLIMB_SPEED, B = SQUIRREL.BOUGH_SPEED;
  const segs = [];
  let at = { d: 0.35, lat: 0.45 };
  const where = (d) => (d < g - 0.05 ? 'grass' : d <= c + 0.01 ? 'bark' : 'bough');
  const stay = (mode, dur) => segs.push({ mode, dur, a: at, b: at, go: false, seed: segs.length + 1 });
  const go = (d, lat, speed) => {
    const b = { d, lat };
    const len = Math.hypot(b.d - at.d, b.lat - at.lat);
    const bark = where((at.d + d) / 2) === 'bark';
    const stride = bark ? SQUIRREL.CLIMB_STRIDE : SQUIRREL.STRIDE;
    segs.push({ mode: bark ? 'climb' : 'run', dur: len / speed + 0.2, a: at, b, go: true, len, bounds: Math.max(1, Math.round(len / stride)), seed: segs.length + 1 });
    at = b;
  };
  // Foraging in the grass.
  stay('sniff', 1.7); stay('dig', 1.5);
  go(1.5, -0.45, G); stay('sniff', 1.0); stay('sit', 4.4); stay('alert', 1.5);
  // To the tree in two dashes, with a freeze between.
  go(2.5, 0.3, G); stay('stand', 0.8); go(g, 0, G);
  // Up the trunk, stopping half way to look out.
  go(mid, 0, C); stay('cling', 1.7); go(c, 0, C);
  // Out along the bough: look, wash, eat, look again.
  go(e, 0, B); stay('look', 1.6); stay('groom', 3.4); stay('sit', 3.4); stay('alert', 1.1);
  // Back, and down the trunk head first.
  go(c, 0, B); go(mid, 0, C); stay('cling', 1.4); go(g, 0, C);
  // Away over the grass to bury something, then back to where it began.
  go(2.0, -0.6, G); stay('dig', 2.2); stay('stand', 0.7);
  go(0.35, 0.45, G); stay('look', 1.5);

  let t0 = 0;
  for (const s of segs) {
    s.t0 = t0; t0 += s.dur;
    s.place = where(s.a.d === s.b.d ? s.a.d : (s.a.d + s.b.d) / 2);
    if (s.go) s.head = segDir(route, s, 1);
  }
  // A squirrel that has stopped faces the way it came, turned a little; more freely on the grass.
  const n = segs.length, firstGo = segs.findIndex((s) => s.go);
  for (let j = 1; j <= n; j++) {
    const s = segs[(firstGo + j) % n], prev = segs[(firstGo + j - 1 + n) % n];
    if (s.go) continue;
    const range = s.place === 'grass' ? 1.3 : s.place === 'bough' ? 0.5 : 0;
    s.up = surfaceUp(route, s.a.d);
    s.head = norm(rotate(prev.head, s.up, (hash(s.seed, 21) - 0.5) * 2 * range));
  }
  return { segs, total: t0 };
}

// Where the squirrel is and how it is holding itself at time t (seconds).
// Returns { pos, fwd, up, pose, mode, moving, onBark }.
export function squirrelPose(t, route) {
  const plan = route.plan || (route.plan = buildPlan(route));
  const n = plan.segs.length;
  const u = ((t % plan.total) + plan.total) % plan.total;
  let k = 0;
  while (k < n - 1 && plan.segs[k + 1].t0 <= u) k++;
  const seg = plan.segs[k], prev = plan.segs[(k - 1 + n) % n], tau = u - seg.t0;

  let pose = segPose(seg, tau, t);
  if (tau < SQUIRREL.BLEND) pose = mixPose(segPose(prev, prev.dur, t), pose, smooth(0, SQUIRREL.BLEND, tau));

  const s = seg.go ? ease(clamp01(tau / seg.dur)) : 0;
  const d = lerp(seg.a.d, seg.b.d, s);
  const pos = segPoint(route, seg, s);
  const up = surfaceUp(route, d);
  // Swing round from the old heading to the new one about the surface it stands on.
  const want = seg.go ? segDir(route, seg, s) : seg.head;
  const flat = (v) => { const dv = dot(v, up); return norm([v[0] - up[0] * dv, v[1] - up[1] * dv, v[2] - up[2] * dv]); };
  const a = flat(want), b = flat(prev.head);
  const ang = Math.atan2(dot(cross(a, b), up), dot(a, b));
  const turned = smooth(0, SQUIRREL.TURN, tau);
  const fwd = rotate(a, up, ang * (1 - turned));
  pose.hop = Math.abs(ang) > 0.6 ? Math.sin(Math.PI * turned) * 0.014 : 0;   // a little jump as it spins round
  return { pos, fwd, up, pose, mode: seg.mode, moving: seg.go && tau > 0.1 && tau < seg.dur - 0.1, onBark: seg.place === 'bark' };
}

// --- Body ---------------------------------------------------------------------------------------
// Two bones from a to b in the side view; returns the joint between them. bend = +1 or -1 picks
// which way the joint points.
function joint(ax, ay, bx, by, l1, l2, bend) {
  let dx = bx - ax, dy = by - ay;
  const far = Math.hypot(dx, dy) || 1e-5;
  const d = Math.min(Math.max(far, Math.abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4);
  dx /= far; dy /= far;
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(l1 * l1 - along * along, 0));
  return [ax + dx * along - dy * h * bend, ay + dy * along + dx * h * bend];
}

// Smooths a line of { p, ry, rz } points into `count` points (Catmull-Rom).
function resample(ctrl, count) {
  const out = [], n = ctrl.length;
  for (let i = 0; i < count; i++) {
    const x = (i / (count - 1)) * (n - 1), k = Math.min(Math.floor(x), n - 2), f = x - k;
    const p0 = ctrl[Math.max(k - 1, 0)], p1 = ctrl[k], p2 = ctrl[k + 1], p3 = ctrl[Math.min(k + 2, n - 1)];
    const f2 = f * f, f3 = f2 * f;
    const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * f + (2 * a - 5 * b + 4 * c - d) * f2 + (3 * b - a - 3 * c + d) * f3);
    out.push({ p: [cr(p0.p[0], p1.p[0], p2.p[0], p3.p[0]), cr(p0.p[1], p1.p[1], p2.p[1], p3.p[1]), cr(p0.p[2], p1.p[2], p2.p[2], p3.p[2])],
      ry: lerp(p1.ry, p2.ry, f), rz: lerp(p1.rz, p2.rz, f) });
  }
  return out;
}

const Z_AXIS = [0, 0, 1];

export function createSquirrelMesh() {
  return { vertices: new Float32Array(1100 * SQUIRREL_VERTEX_FLOATS), indices: [], count: 0, ready: false };
}

// Sweeps an oval ring along a line of points. side = the animal's left at that point (default z).
// belly = true gives the underside the pale belly colour.
function tube(m, pts, kind, belly, coat, side) {
  const base = m.count, n = pts.length, v = m.vertices;
  for (let j = 0; j < n; j++) {
    const a = pts[Math.max(j - 1, 0)].p, b = pts[Math.min(j + 1, n - 1)].p, P = pts[j];
    const T = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const zh = side || Z_AXIS, dz = dot(zh, T);
    const L = norm([zh[0] - T[0] * dz, zh[1] - T[1] * dz, zh[2] - T[2] * dz]);
    const N = cross(L, T);   // the animal's back at this point
    for (let k = 0; k <= SIDES; k++) {
      const th = (k / SIDES) * TAU, c = Math.cos(th), s = Math.sin(th);
      const o = m.count * SQUIRREL_VERTEX_FLOATS;
      v[o] = P.p[0] + N[0] * c * P.ry + L[0] * s * P.rz;
      v[o + 1] = P.p[1] + N[1] * c * P.ry + L[1] * s * P.rz;
      v[o + 2] = P.p[2] + N[2] * c * P.ry + L[2] * s * P.rz;
      const nn = norm([N[0] * c * P.rz + L[0] * s * P.ry, N[1] * c * P.rz + L[1] * s * P.ry, N[2] * c * P.rz + L[2] * s * P.ry]);
      v[o + 3] = nn[0]; v[o + 4] = nn[1]; v[o + 5] = nn[2];
      v[o + 6] = coat + j * 0.02; v[o + 7] = c * 0.03; v[o + 8] = s * 0.03;
      v[o + 9] = kind; v[o + 10] = belly ? clamp01((-c - 0.05) / 0.45) : 0;
      m.count++;
    }
  }
  if (!m.ready) {
    const ring = SIDES + 1;
    for (let j = 0; j < n - 1; j++) for (let k = 0; k < SIDES; k++) {
      const a = base + j * ring + k, b = a + 1, c = a + ring, d = c + 1;
      m.indices.push(a, c, b, b, c, d);
    }
  }
}

function triangle(m, a, b, c, nrm, kind, coat) {
  const v = m.vertices, base = m.count;
  for (const p of [a, b, c]) {
    const o = m.count * SQUIRREL_VERTEX_FLOATS;
    v[o] = p[0]; v[o + 1] = p[1]; v[o + 2] = p[2]; v[o + 3] = nrm[0]; v[o + 4] = nrm[1]; v[o + 5] = nrm[2];
    v[o + 6] = coat; v[o + 7] = p[1]; v[o + 8] = p[2]; v[o + 9] = kind; v[o + 10] = 0;
    m.count++;
  }
  if (!m.ready) m.indices.push(base, base + 1, base + 2);
}

const pt = (x, y, z, ry, rz = ry) => ({ p: [x, y, z], ry, rz });

// Fills mesh.vertices with the squirrel in the given pose. t only drives the ripple along the tail.
export function buildSquirrelMesh(pose, t, m) {
  m.count = 0;
  const P = pose;
  const hipY = P.hipY + P.hop, chestY = P.chestY + P.hop;
  let dx = P.chestX - P.hipX, dy = chestY - hipY;
  const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
  const bx = -dy, by = dx;                               // the direction of its back

  // Head: a pivot above the chest, and three axes that turn with the look.
  const hx = P.chestX + dx * 0.042 + bx * 0.006, hy = chestY + dy * 0.042 + by * 0.006 + 0.006;
  const cp = Math.cos(P.headPitch), sp = Math.sin(P.headPitch), cyw = Math.cos(P.headYaw), syw = Math.sin(P.headYaw);
  const H = [cp * cyw, sp, cp * syw], HL = [-syw, 0, cyw], HN = cross(HL, H);
  const onHead = (f, up, left) => [hx + H[0] * f + HN[0] * up + HL[0] * left, hy + H[1] * f + HN[1] * up + HL[1] * left, H[2] * f + HN[2] * up + HL[2] * left];

  // Torso, from rump to the base of the skull.
  const midX = (P.hipX + P.chestX) / 2 + bx * P.arch, midY = (hipY + chestY) / 2 + by * P.arch;
  tube(m, resample([
    pt(P.hipX - dx * 0.034, hipY - dy * 0.034, 0, 0.012),
    pt(P.hipX, hipY, 0, 0.033, 0.038),
    pt(midX, midY, 0, 0.035, 0.036),
    pt(P.chestX, chestY, 0, 0.029, 0.027),
    pt(P.chestX + dx * 0.028 + bx * 0.004, chestY + dy * 0.028 + by * 0.004 + 0.003, 0, 0.022),
    pt(hx, hy, 0, 0.016),
  ], 14), 0, true, 0);

  // Head.
  const skull = [[-0.014, 0.012], [0, 0.021], [0.014, 0.022], [0.03, 0.016], [0.042, 0.0095], [0.048, 0.003]];
  tube(m, skull.map(([f, r]) => { const q = onHead(f, 0, 0); return pt(q[0], q[1], q[2], r, r * 1.06); }), 0, true, 0.4, HL);
  for (const s of [1, -1]) {
    // Ears with their tufts.
    const out = [HL[0] * s, HL[1] * s, HL[2] * s];
    triangle(m, onHead(-0.006, 0.017, 0.013 * s), onHead(0.01, 0.018, 0.012 * s), onHead(-0.002, 0.04, 0.016 * s), out, 0, 0.7);
    triangle(m, onHead(-0.004, 0.034, 0.015 * s), onHead(0.002, 0.036, 0.0155 * s), onHead(-0.006, 0.056, 0.017 * s), out, 4, 0.75);
    // Eyes.
    const e = onHead(0.023, 0.007, 0.0168 * s);
    tube(m, [-1, 0, 1].map((q) => pt(e[0] + HL[0] * s * q * 0.004, e[1] + HL[1] * s * q * 0.004, e[2] + HL[2] * s * q * 0.004, q ? 0.0012 : 0.0046)), 2, false, 0.9, H);
  }

  // Legs. Left leads right by the split.
  for (const s of [1, -1]) {
    const hfx = P.hfX + s * P.hfSplit * 0.5, ax = hfx - 0.012, ay = P.hfY + 0.012;         // ankle
    const jx = P.hipX + 0.01, jy = hipY - 0.005;                                             // hip joint
    const knee = joint(jx, jy, ax, ay, 0.05, 0.05, 1);
    tube(m, [pt(jx, jy, s * P.hfZ * 0.75, 0.021), pt(knee[0], knee[1], s * P.hfZ * 1.12, 0.014), pt(ax, ay, s * P.hfZ, 0.007), pt(hfx + 0.04, P.hfY + 0.002, s * P.hfZ * 1.05, 0.004)], 0, false, 1 + s * 0.2);
    const ffx = P.ffX + s * P.ffSplit * 0.5, wx = ffx - 0.004, wy = P.ffY + 0.006;         // wrist
    const sx = P.chestX + 0.004, sy = chestY - 0.008;                                        // shoulder
    const elbow = joint(sx, sy, wx, wy, 0.032, 0.036, -1);
    tube(m, [pt(sx, sy, s * 0.017, 0.012), pt(elbow[0], elbow[1], s * lerp(0.02, P.ffZ, 0.5), 0.008), pt(wx, wy, s * P.ffZ, 0.005), pt(ffx + 0.008, P.ffY + 0.002, s * P.ffZ, 0.0035)], 0, false, 1.5 + s * 0.2);
  }

  // Tail: a chain that curls along its length, with a ripple running out to the tip.
  const tail = [];
  let tx = P.hipX - dx * 0.03 + bx * 0.004, ty = hipY - dy * 0.03 + by * 0.004, tz = 0;
  const step = SQUIRREL.TAIL_LENGTH / (TAIL_POINTS - 1);
  const radii = [0.010, 0.022, 0.030, 0.034, 0.036, 0.036, 0.035, 0.033, 0.030, 0.025, 0.017, 0.005];
  for (let i = 0; i < TAIL_POINTS; i++) {
    const s = i / (TAIL_POINTS - 1);
    tail.push(pt(tx, Math.max(ty, radii[i] * 0.5), tz, radii[i] * 0.8, radii[i] * 1.12));
    const th = P.tailBase + P.tailCurl * s + P.tailTip * s * s * s + P.tailWave * Math.sin(P.tailPhase - s * 4.2) * (0.3 + s);
    tx -= Math.cos(th) * step; ty += Math.sin(th) * step;
    tz += P.tailWave * 0.012 * Math.sin(P.tailPhase * 0.5 - s * 3) + 0.0015 * Math.sin(t * 1.7 + s * 2.5);
  }
  tube(m, resample(tail, 20), 3, false, 2);

  // Whatever it is eating, held in both paws.
  const nr = 0.011 * P.nut;
  tube(m, [-1, 0, 1].map((q) => pt(P.ffX + 0.006 + q * nr * 0.9, P.ffY + 0.008, 0, q ? nr * 0.25 : nr)), 5, false, 3);

  m.ready = true;
  return m;
}
