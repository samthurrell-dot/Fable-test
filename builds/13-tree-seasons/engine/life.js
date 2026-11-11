// engine/life.js
// The animals of the tree as pure functions of time. No WebGL, no stored state:
// give a time in seconds and get back where each animal is and what it is doing.
// The same time always gives the same answer, so any moment can be frozen or replayed.
//
//   const perches = findPerches(tree.skeleton, 26);
//   const route = findSquirrelRoute(tree.skeleton);
//   const bird = birdState(3, time, activity.birds, perches, wind);   // or null when away
//   const squirrel = squirrelState(time, route);
//   const goose = flockState(5, time);

export const LIFE = {
  BIRDS: 9,               // most small birds in the tree at once (late spring)
  BIRD_SPEED: 6,          // metres per second between perches
  BIRD_FLAP_HZ: 9,        // wingbeats per second
  BIRD_CYCLE: [6, 13],    // seconds a bird stays on one perch, shortest and longest
  SORTIE_SHARE: 0.45,     // share of flights that loop out round the tree, not straight to the next perch
  SORTIE_SECONDS: 4.5,    // length of such a loop
  SORTIE_REACH: 8,        // metres a loop swings out from the tree
  TURN_SECONDS: 1.3,      // a perched bird looks a new way this often
  SQUIRREL_CYCLE: 36,     // seconds for the squirrel's whole round trip
  SQUIRREL_STRIDE: 0.28,  // metres covered by one bound
  SQUIRREL_START: 3.4,    // metres from the trunk where it forages
  FLOCK: 11,              // birds in the far autumn flock
  FLOCK_CYCLE: 30,        // seconds between passes
  FLOCK_SPEED: 7,         // metres per second
  FLOCK_HEIGHT: 15.6,     // metres above the ground
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (a, b = 0, c = 0) => { const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + 1.37) * 43758.5453; return h - Math.floor(h); };

// How much of each kind of life is about, 0..1, for a time of year y (0 = start of spring).
export function lifeActivity(y) {
  y = ((y % 1) + 1) % 1;
  return {
    // Birds: busiest from late spring to summer; two or three stay all winter.
    birds: 0.3 + 0.7 * smooth(0.04, 0.18, y) * (1 - smooth(0.52, 0.76, y)),
    butterflies: smooth(0.12, 0.22, y) * (1 - smooth(0.48, 0.58, y)),
    squirrel: smooth(0.06, 0.12, y) * (1 - smooth(0.74, 0.79, y)),
    flock: smooth(0.52, 0.56, y) * (1 - smooth(0.70, 0.74, y)),
    motes: smooth(0.2, 0.3, y) * (1 - smooth(0.64, 0.73, y)),
  };
}

// The same sway as the GLSL function in src/shaders.js, so perched animals ride the branch.
export function swayOffset(p, t, wind) {
  const h = clamp01(p[1] / 10);
  const a = h * h * 0.10 + Math.hypot(p[0], p[2]) * 0.006 * h;
  const k = a * wind * (0.6 + 0.4 * Math.sin(t * 0.37 + p[0] * 0.11));
  return [
    (Math.sin(t * 0.9 + p[2] * 0.35 + p[1] * 0.2) + 0.5 * Math.sin(t * 2.3 + p[0] * 1.3)) * k,
    0.3 * Math.sin(t * 1.7 + p[0] * 0.9 + p[2] * 0.7) * k,
    (Math.cos(t * 0.7 + p[0] * 0.31) + 0.5 * Math.sin(t * 2.9 + p[2] * 1.1 + 1.7)) * k,
  ];
}

// Places a small bird can sit: the upper side of fairly level, finger-thick branches,
// plus a few spots on the grass in front of the tree.
export function findPerches(skel, count = 26) {
  const { X, Y, Z, parent, radius } = skel;
  const out = [];
  let tries = 0;
  while (out.length < count - 4 && tries++ < 4000) {
    const i = 1 + Math.floor(hash(tries, 7) * (skel.count - 1));
    const p = parent[i];
    if (p < 0 || radius[i] < 0.018 || radius[i] > 0.075 || Y[i] < 3) continue;
    const len = Math.hypot(X[i] - X[p], Y[i] - Y[p], Z[i] - Z[p]) || 1;
    if (Math.abs(Y[i] - Y[p]) / len > 0.55) continue;
    const q = [X[i], Y[i] + radius[i] * 0.95, Z[i]];
    if (out.some((o) => Math.hypot(o[0] - q[0], o[1] - q[1], o[2] - q[2]) < 0.9)) continue;
    out.push(q);
  }
  for (let g = 0; g < 4; g++) {
    const a = 0.5 + g * 0.55 + hash(g, 9) * 0.3, r = 2.6 + hash(g, 11) * 3.5;
    out.push([Math.sin(a) * r, 0, Math.cos(a) * r]);
  }
  return out;
}

function bezier(a, c1, c2, b, s) {
  const m = 1 - s;
  const w0 = m * m * m, w1 = 3 * m * m * s, w2 = 3 * m * s * s, w3 = s * s * s;
  const d0 = 3 * m * m, d1 = 6 * m * s, d2 = 3 * s * s;
  const pos = [0, 0, 0], dir = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    pos[k] = a[k] * w0 + c1[k] * w1 + c2[k] * w2 + b[k] * w3;
    dir[k] = (c1[k] - a[k]) * d0 + (c2[k] - c1[k]) * d1 + (b[k] - c2[k]) * d2;
  }
  const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  return { pos, dir: [dir[0] / l, dir[1] / l, dir[2] / l] };
}

// One small bird. i = which bird, activity = lifeActivity(y).birds.
// Returns null when this bird is away, else { pos, fwd, flap (radians), fold (1 = wings shut), scale }.
export function birdState(i, t, activity, perches, wind = 0.5) {
  const scale = smooth(0, 0.07, activity - i / LIFE.BIRDS);
  if (scale <= 0) return null;
  const T = LIFE.BIRD_CYCLE[0] + (LIFE.BIRD_CYCLE[1] - LIFE.BIRD_CYCLE[0]) * hash(i, 1);
  const tt = t + 200 + hash(i, 2) * T;
  const k = Math.floor(tt / T), u = tt - k * T;
  const A = perches[Math.floor(hash(i, k, 3) * perches.length)];
  const B = perches[Math.floor(hash(i, k + 1, 3) * perches.length)];
  const sortie = hash(i, k, 4) < LIFE.SORTIE_SHARE;
  const dist = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
  const F = sortie ? LIFE.SORTIE_SECONDS : Math.min(2.4, Math.max(0.7, dist / LIFE.BIRD_SPEED));
  const riding = (p) => { const o = swayOffset(p, t, wind); return [p[0] + o[0], p[1] + o[1], p[2] + o[2]]; };

  if (u < T - F) {
    // Perched: look a new way every so often, with a quick hop as it turns.
    const a = riding(A);
    const turn = Math.floor(u / LIFE.TURN_SECONDS), into = u - turn * LIFE.TURN_SECONDS;
    const yaw = hash(i, k, 10 + turn) * 6.283;
    const hop = into < 0.16 ? Math.sin((into / 0.16) * Math.PI) * 0.014 : 0;
    return { pos: [a[0], a[1] + hop, a[2]], fwd: [Math.cos(yaw), 0, Math.sin(yaw)], flap: 0, fold: 1, scale };
  }

  const s0 = (u - (T - F)) / F;
  const s = s0 * s0 * (3 - 2 * s0);
  const a = riding(A), b = riding(B);
  const out = (p) => { const l = Math.hypot(p[0], p[2]) || 1; return [p[0] / l, p[2] / l]; };
  const oa = out(a), ob = out(b);
  let c1, c2;
  if (sortie) {
    const side = hash(i, k, 5) < 0.5 ? 1 : -1, R = LIFE.SORTIE_REACH;
    c1 = [a[0] + oa[0] * R - oa[1] * side * R * 0.8, a[1] + 2 + 2 * hash(i, k, 6), a[2] + oa[1] * R + oa[0] * side * R * 0.8];
    c2 = [b[0] + ob[0] * R + ob[1] * side * R * 0.8, b[1] + 3, b[2] + ob[1] * R - ob[0] * side * R * 0.8];
  } else {
    const lift = 0.5 + 0.14 * dist;
    c1 = [a[0] + (b[0] - a[0]) * 0.25 + oa[0] * 0.6, a[1] + lift, a[2] + (b[2] - a[2]) * 0.25 + oa[1] * 0.6];
    c2 = [b[0] + (a[0] - b[0]) * 0.25 + ob[0] * 0.6, b[1] + lift * 0.8, b[2] + (a[2] - b[2]) * 0.25 + ob[1] * 0.6];
  }
  const f = bezier(a, c1, c2, b, s);
  // Small birds fly in bursts: a few beats, then a short glide. They glide in to land.
  let power = Math.sin(t * 3.1 + i * 2) > -0.35 ? 1 : 0.15;
  if (s0 > 0.86) power = 0.3;
  const flap = 0.15 + power * Math.sin(t * 6.283 * LIFE.BIRD_FLAP_HZ + i * 1.7) * 0.95;
  const fold = Math.max(1 - smooth(0, 0.06, s0), smooth(0.95, 1, s0));
  return { pos: f.pos, fwd: f.dir, flap, fold, scale };
}

// ---------------------------------------------------------------------------------------------
// The squirrel's path: across the grass, up the trunk, out along the first big bough.
// Returns { pts: [{ p, n }], dist: [], ground, climb, total } where dist is metres along the path
// and ground / climb mark the ends of the grass and trunk parts.
// toward = [x, z]: the side of the tree it works on. The default is to the right of the start view,
// level with the trunk, so it stays in focus and in frame in both the wide and the ground view.
export function findSquirrelRoute(skel, toward = [0.92, 0.4]) {
  const { X, Y, Z, kids, radius, options: o } = skel;
  const tl = Math.hypot(toward[0], toward[1]) || 1;
  const tx = toward[0] / tl, tz = toward[1] / tl;
  const mainChild = (i) => { let b = -1, br = -1; for (const c of kids[i]) if (radius[c] > br) { br = radius[c]; b = c; } return b; };
  const flare = (y) => 1 + (o.rootFlare || 0) * Math.exp(-Math.max(y, 0) * 2.6);

  // Up the trunk to the first real fork.
  const trunk = [0];
  let n = 0, fork = 0;
  for (let guard = 0; guard < 200; guard++) {
    const m = mainChild(n);
    if (m < 0) break;
    if (Y[n] > 1.2 && kids[n].some((c) => c !== m && radius[c] > 0.3 * radius[n])) { fork = n; break; }
    n = m; trunk.push(n); fork = n;
  }
  // The bough that leans most towards the viewer.
  let bough = mainChild(fork), best = -1e9;
  for (const c of kids[fork]) {
    const dx = X[c] - X[fork], dz = Z[c] - Z[fork], l = Math.hypot(dx, dz) || 1;
    const score = radius[c] * (1.2 + (dx * tx + dz * tz) / l);
    if (score > best) { best = score; bough = c; }
  }

  const pts = [];
  const start = LIFE.SQUIRREL_START, baseR = radius[0] * flare(0.12) + 0.02;
  for (let k = 0; k <= 14; k++) {            // across the grass, with a slight curve
    const f = k / 14, r = start + (baseR - start) * f, bow = Math.sin(f * Math.PI) * 0.7;
    pts.push({ p: [tx * r - tz * bow, 0, tz * r + tx * bow], n: [0, 1, 0] });
  }
  const phi0 = Math.atan2(tz, tx);
  const topY = Y[fork] || 1;
  for (let k = 0; k < trunk.length; k++) {   // up the trunk, winding a little round it
    const a = trunk[k], b = trunk[Math.min(k + 1, trunk.length - 1)];
    for (let h = 0; h < 2; h++) {
      const f = h / 2;
      const y = Y[a] + (Y[b] - Y[a]) * f;
      if (y < 0.12 || y > topY) continue;
      const phi = phi0 + 0.9 * (y / topY);
      const r = (radius[a] + (radius[b] - radius[a]) * f) * flare(y) + 0.01;
      const cx = X[a] + (X[b] - X[a]) * f, cz = Z[a] + (Z[b] - Z[a]) * f;
      pts.push({ p: [cx + Math.cos(phi) * r, y, cz + Math.sin(phi) * r], n: [Math.cos(phi), 0, Math.sin(phi)] });
    }
  }
  const climbEnd = pts.length - 1;
  let run = 0, c = bough;
  while (c >= 0 && run < 2.8 && radius[c] > 0.04) {   // out along the bough
    const last = pts[pts.length - 1].p;
    const q = [X[c], Y[c] + radius[c] * 0.92, Z[c]];
    run += Math.hypot(q[0] - last[0], q[1] - last[1], q[2] - last[2]);
    pts.push({ p: q, n: [0, 1, 0] });
    c = mainChild(c);
  }
  const dist = [0];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1].p, b = pts[k].p;
    dist.push(dist[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return { pts, dist, ground: dist[14], climb: dist[climbEnd], total: dist[dist.length - 1] };
}

function routeAt(route, d) {
  const { pts, dist } = route;
  d = Math.min(Math.max(d, 0), route.total);
  let k = 1;
  while (k < dist.length - 1 && dist[k] < d) k++;
  const a = pts[k - 1], b = pts[k];
  const f = (d - dist[k - 1]) / Math.max(dist[k] - dist[k - 1], 1e-5);
  const mix = (u, v) => [u[0] + (v[0] - u[0]) * f, u[1] + (v[1] - u[1]) * f, u[2] + (v[2] - u[2]) * f];
  const tan = [b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]];
  const l = Math.hypot(tan[0], tan[1], tan[2]) || 1;
  return { pos: mix(a.p, b.p), nrm: mix(a.n, b.n), tan: [tan[0] / l, tan[1] / l, tan[2] / l] };
}

// The squirrel. Returns { pos, fwd, up, pitch (radians, nose up), tail (radians), sitting }.
export function squirrelState(t, route) {
  const P = LIFE.SQUIRREL_CYCLE;
  const u = ((t % P) + P) % P;
  const g = route.ground, c = route.climb, e = route.total;
  // Key moments: [seconds, metres along the route]. Equal distances in a row mean a pause.
  const keys = [
    [0, 0], [1.2, 0.9], [2.6, 0.9], [3.6, 0.3], [5.0, 0.3],   // foraging: short dashes and stops
    [8.4, g], [8.9, g],                                        // run to the foot of the tree
    [11.6, c], [12.1, c],                                      // climb
    [14.6, e], [21.0, e],                                      // out along the bough, then sit
    [23.2, c], [25.6, g], [26.2, g],                           // back down
    [30.0, 0.9], [31.2, 0.9], [32.6, 0], [P, 0],
  ];
  let k = 1;
  while (k < keys.length - 1 && keys[k][0] < u) k++;
  const [t0, d0] = keys[k - 1], [t1, d1] = keys[k];
  const f0 = clamp01((u - t0) / (t1 - t0)), f = f0 * f0 * (3 - 2 * f0);
  const d = d0 + (d1 - d0) * f;
  const moving = Math.abs(d1 - d0) > 1e-4;
  // Which way it faces: the way it is going, or the way it last went.
  let dirSign = Math.sign(d1 - d0);
  for (let j = k - 1; dirSign === 0 && j > 0; j--) dirSign = Math.sign(keys[j][1] - keys[j - 1][1]);
  if (dirSign === 0) dirSign = 1;

  const r = routeAt(route, d);
  const onTrunk = Math.abs(r.nrm[1]) < 0.5;
  const speed = moving ? Math.sin(f0 * Math.PI) : 0;          // 0 at each end of a dash
  const phase = d / LIFE.SQUIRREL_STRIDE;
  const bound = Math.abs(Math.sin(phase * Math.PI)) * (onTrunk ? 0.008 : 0.04) * speed;
  const pos = [r.pos[0] + r.nrm[0] * bound, r.pos[1] + r.nrm[1] * bound, r.pos[2] + r.nrm[2] * bound];
  const sitting = !moving && !onTrunk;
  // Sitting up on its haunches takes a moment at each end of the pause.
  const settle = sitting ? Math.min(smooth(0, 0.35, u - t0), smooth(0, 0.35, t1 - u)) : 0;
  const pitch = settle * 0.85 + Math.cos(phase * 2 * Math.PI) * 0.22 * speed;
  // The tail flicks in bursts while it sits.
  const burst = hash(Math.floor(t / 1.7), 3) > 0.45 ? 1 : 0;
  const tail = sitting ? Math.sin(t * 9) * 0.35 * burst * settle : Math.sin(phase * 2 * Math.PI) * 0.18 * speed;
  return { pos, fwd: [r.tan[0] * dirSign, r.tan[1] * dirSign, r.tan[2] * dirSign], up: r.nrm, pitch, tail, sitting };
}

// One bird of the far flock that crosses behind the tree in autumn. j = 0 is the leader.
// Returns { pos, fwd, flap }.
export function flockState(j, t) {
  const P = LIFE.FLOCK_CYCLE;
  const u = ((t % P) + P) % P;
  const row = Math.ceil(j / 2), side = j % 2 ? 1 : -1;
  // The line is set just above the crown and 30 m behind it: close enough to stay fairly sharp,
  // high enough to clear the tree, low enough to stay in a long-lens frame.
  const x = -70 + u * LIFE.FLOCK_SPEED - row * 1.9;
  const y = LIFE.FLOCK_HEIGHT + Math.sin(u * 0.4) * 0.3 + side * row * 0.25 + Math.sin(t * 1.3 + j) * 0.1;
  const z = -30 + side * row * 1.5;
  // They fly a little towards the viewer, so the wings are seen from below and not edge on.
  return { pos: [x, y, z + u * 0.5], fwd: [0.94, 0.03 * Math.cos(u * 0.4), 0.34], flap: 0.15 + Math.sin(t * 6.283 * 2.6 + j * 0.9) * 0.85 };
}
