// engine/tree.js
// Grows a broadleaf tree with the space colonisation method and returns plain typed arrays:
// a branch mesh (trunk, boughs and fine twigs) plus attachment data for leaves and blossom.
// No WebGL in here. The same output can feed raw WebGL2, three.js or a 2D canvas.
//
// Usage:
//   import { growTree } from './engine/tree.js';
//   const tree = growTree({ seed: 11, twigs: 8000 });
//   tree.mesh.vertices  Float32Array, MESH_STRIDE floats per vertex: position 3, normal 3, tangent 3, radius 1
//   tree.mesh.indices   Uint32Array (triangles)
//   tree.leaves         Float32Array, LEAF_STRIDE floats per leaf (see LEAF_LAYOUT)
//   tree.blossoms       same layout as leaves
//   tree.bounds         { centreY, radius, height, crownBottom, crownTop }

export const MESH_STRIDE = 10;
export const LEAF_STRIDE = 16;
// Offsets (in floats) inside one leaf or blossom record.
export const LEAF_LAYOUT = {
  position: 0,   // 3: where the stalk joins the twig
  axis: 3,       // 3: unit vector from stalk to tip
  normal: 6,     // 3: unit vector out of the upper face
  random: 9,     // 4: three random numbers in 0..1, then the length in metres
  heightNorm: 13, // 1: 0 at the bottom of the crown, 1 at the top
  outerness: 14,  // 1: 0 at the crown centre, 1 at the outer shell
  ao: 15,         // 1: ambient light reaching this point, 0.25 (deep inside) to 1 (outside)
};

export const TREE_DEFAULTS = {
  seed: 11,              // any integer; changes the whole tree
  trunkHeight: 2.3,      // metres of clear trunk before the crown starts
  trunkLean: 0.035,      // sideways wander of the trunk, metres per metre of height
  crownCentreY: 5.9,     // height of the middle of the crown
  crownRadiusXZ: 5.0,    // half width of the crown
  crownRadiusY: 3.7,     // half height of the crown above its centre
  crownUnderside: 0.62,  // below the centre the crown is this much flatter (1 = a ball)
  crownLumpiness: 0.3,   // 0 = smooth ellipsoid, 0.5 = very irregular outline
  attractors: 3400,      // points the branches grow towards; more = denser branching, slower growth
  influenceRadius: 2.8,  // an attractor pulls the nearest branch node within this distance
  killRadius: 0.45,      // an attractor is used up when a branch gets this close; smaller = finer branching
  step: 0.3,             // length of one branch segment in metres
  upBias: 0.12,          // pull towards the sky on every new segment (0 = none)
  jitter: 0.12,          // random wobble added to each new segment
  maxNodes: 9000,        // safety limit on skeleton size
  maxIterations: 220,    // safety limit on growth rounds
  smoothing: 2,          // passes that relax kinks in the skeleton
  tipRadius: 0.015,      // radius of the thinnest branch
  pipeExponent: 2.0,     // parent area = sum of child radii to this power; 2 = da Vinci, 3 = Murray
  taperPerNode: 0.04,    // extra thickness gained per segment, in tip areas
  rootFlare: 0.85,       // how far the trunk spreads at the ground (0 = none)
  twigs: 8000,           // fine twigs added to thin branches; each carries leaves
  twigHostRadius: 0.04,  // twigs only grow from branches thinner than this
  twigLength: 0.5,       // mean twig length in metres
  twigDroop: 0.1,        // how much each twig bends towards the ground
  leavesPerTwig: 7,      // alternate leaves along each twig, one at the tip
  leafSize: 0.16,        // mean leaf length in metres
  blossomsPerTwig: 3,    // flowers per twig
  blossomSize: 0.085,    // flower width in metres
};

// Small seeded random number generator, so the same seed always grows the same tree.
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------
// 1. Skeleton: space colonisation.
// Returns { X, Y, Z, parent, kids, radius } with one entry per node. Node 0 is the base.
export function growSkeleton(options = {}, rnd = null) {
  const o = { ...TREE_DEFAULTS, ...options };
  rnd = rnd || mulberry32(o.seed);
  const X = [], Y = [], Z = [], parent = [], kids = [];
  const add = (x, y, z, p) => {
    X.push(x); Y.push(y); Z.push(z); parent.push(p); kids.push([]);
    const id = X.length - 1;
    if (p >= 0) kids[p].push(id);
    return id;
  };

  // The trunk: a gently wandering column.
  let tip = add(0, 0, 0, -1);
  const trunkSteps = Math.ceil(o.trunkHeight / o.step);
  for (let i = 1; i <= trunkSteps; i++) {
    const h = i * o.step;
    tip = add(Math.sin(h * 0.7 + o.seed) * o.trunkLean * h, h, Math.cos(h * 0.5 + o.seed * 1.7) * o.trunkLean * h * 0.8, tip);
  }

  // Attractors: random points inside a lumpy, flat-bottomed ellipsoid.
  const N = o.attractors;
  const ax = new Float32Array(N), ay = new Float32Array(N), az = new Float32Array(N);
  const s1 = rnd() * 6.283, s2 = rnd() * 6.283, s3 = rnd() * 6.283;
  for (let i = 0; i < N;) {
    const x = rnd() * 2 - 1, y = rnd() * 2 - 1, z = rnd() * 2 - 1;
    const r2 = x * x + y * y + z * z;
    if (r2 > 1 || r2 < 1e-4) continue;
    const r = Math.sqrt(r2);
    const dx = x / r, dy = y / r, dz = z / r;
    const lump = 1 + o.crownLumpiness * 1.6 * Math.sin(dx * 3.1 + s1) * Math.sin(dy * 2.7 + s2) * Math.sin(dz * 3.3 + s3);
    const rr = Math.pow(r, 0.8) * lump;
    ax[i] = dx * rr * o.crownRadiusXZ;
    ay[i] = o.crownCentreY + dy * rr * o.crownRadiusY * (dy < 0 ? o.crownUnderside : 1);
    az[i] = dz * rr * o.crownRadiusXZ;
    i++;
  }

  // For every attractor remember its nearest node. New nodes only need checking against that.
  const near = new Int32Array(N).fill(-1);
  const nd = new Float32Array(N).fill(1e9);
  const alive = new Uint8Array(N).fill(1);
  const di2 = o.influenceRadius * o.influenceRadius;
  const dk2 = o.killRadius * o.killRadius;
  const scan = (from, to) => {
    for (let a = 0; a < N; a++) {
      if (!alive[a]) continue;
      let best = nd[a], bi = near[a];
      const x = ax[a], y = ay[a], z = az[a];
      for (let n = from; n < to; n++) {
        const dx = x - X[n], dy = y - Y[n], dz = z - Z[n];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < best) { best = d; bi = n; }
      }
      nd[a] = best; near[a] = bi;
    }
  };
  scan(0, X.length);

  // Make sure the trunk reaches the crown.
  for (let guard = 0; guard < 60; guard++) {
    let any = false;
    for (let a = 0; a < N; a++) if (nd[a] < di2) { any = true; break; }
    if (any) break;
    const n = X.length - 1;
    add(X[n], Y[n] + o.step, Z[n], n);
    scan(n + 1, n + 2);
  }

  const sx = new Float32Array(o.maxNodes + 8), sy = new Float32Array(o.maxNodes + 8), sz = new Float32Array(o.maxNodes + 8);
  const cnt = new Uint16Array(o.maxNodes + 8);
  const dupDist2 = (o.step * 0.5) * (o.step * 0.5);
  for (let it = 0; it < o.maxIterations && X.length < o.maxNodes; it++) {
    const touched = [];
    for (let a = 0; a < N; a++) {
      if (!alive[a] || nd[a] >= di2) continue;
      const n = near[a];
      const l = Math.sqrt(nd[a]) || 1;
      if (!cnt[n]) touched.push(n);
      sx[n] += (ax[a] - X[n]) / l; sy[n] += (ay[a] - Y[n]) / l; sz[n] += (az[a] - Z[n]) / l;
      cnt[n]++;
    }
    if (!touched.length) break;
    const start = X.length;
    for (const n of touched) {
      let dx = sx[n], dy = sy[n], dz = sz[n];
      sx[n] = sy[n] = sz[n] = 0; cnt[n] = 0;
      let l = Math.hypot(dx, dy, dz) || 1;
      dx = dx / l + (rnd() - 0.5) * o.jitter;
      dy = dy / l + o.upBias + (rnd() - 0.5) * o.jitter;
      dz = dz / l + (rnd() - 0.5) * o.jitter;
      l = Math.hypot(dx, dy, dz) || 1;
      const nx = X[n] + (dx / l) * o.step, ny = Y[n] + (dy / l) * o.step, nz = Z[n] + (dz / l) * o.step;
      // Two attractor groups can ask for the same child again and again. Skip the repeat.
      let dup = false;
      for (const c of kids[n]) {
        const ex = X[c] - nx, ey = Y[c] - ny, ez = Z[c] - nz;
        if (ex * ex + ey * ey + ez * ez < dupDist2) { dup = true; break; }
      }
      if (!dup && X.length < o.maxNodes) add(nx, ny, nz, n);
    }
    if (X.length === start) break;
    scan(start, X.length);
    for (let a = 0; a < N; a++) if (alive[a] && nd[a] < dk2) alive[a] = 0;
  }

  // Relax kinks: nodes with one parent and one child move towards the line between them.
  const n = X.length;
  for (let pass = 0; pass < o.smoothing; pass++) {
    for (let i = trunkSteps + 1; i < n; i++) {
      if (kids[i].length !== 1) continue;
      const p = parent[i], c = kids[i][0];
      X[i] = X[i] * 0.5 + (X[p] + X[c]) * 0.25;
      Y[i] = Y[i] * 0.5 + (Y[p] + Y[c]) * 0.25;
      Z[i] = Z[i] * 0.5 + (Z[p] + Z[c]) * 0.25;
    }
  }

  // Radii by the pipe model: a parent carries the summed cross-section of its children.
  const e = o.pipeExponent;
  const tipArea = Math.pow(o.tipRadius, e);
  const area = new Float64Array(n);
  const radius = new Float32Array(n);
  for (let i = n - 1; i >= 0; i--) {
    area[i] += kids[i].length === 0 ? tipArea : tipArea * o.taperPerNode;
    if (parent[i] >= 0) area[parent[i]] += area[i];
    radius[i] = Math.pow(area[i], 1 / e);
  }

  return { X, Y, Z, parent, kids, radius, count: n, options: o };
}

// ---------------------------------------------------------------------------------------
// 2. Mesh helpers.
class MeshBuilder {
  constructor() { this.v = []; this.i = []; this.count = 0; }
  finish() {
    return { vertices: new Float32Array(this.v), indices: new Uint32Array(this.i), vertexCount: this.count };
  }
}

// Sweeps a ring of `sides` vertices along a polyline of { x, y, z, r }.
// The frame is carried from ring to ring (parallel transport) so the tube does not twist.
function addTube(mesh, pts, sides, flare) {
  const n = pts.length;
  if (n < 2) return;
  let nx = 0, ny = 0, nz = 0;
  let ptx = 0, pty = 0, ptz = 0;
  const base = mesh.count;
  for (let j = 0; j < n; j++) {
    const a = pts[Math.max(j - 1, 0)], b = pts[Math.min(j + 1, n - 1)];
    let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z;
    let l = Math.hypot(tx, ty, tz) || 1;
    tx /= l; ty /= l; tz /= l;
    if (j === 0) {
      // Any vector that is not parallel to the tangent will do as a starting normal.
      const ux = Math.abs(ty) < 0.9 ? 0 : 1, uy = Math.abs(ty) < 0.9 ? 1 : 0;
      nx = uy * tz - 0 * ty; ny = 0 * tx - ux * tz; nz = ux * ty - uy * tx;
    } else {
      // Remove the part of the old normal that now points along the tangent.
      const d = nx * tx + ny * ty + nz * tz;
      nx -= tx * d; ny -= ty * d; nz -= tz * d;
    }
    l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    const bx = ty * nz - tz * ny, by = tz * nx - tx * nz, bz = tx * ny - ty * nx;
    ptx = tx; pty = ty; ptz = tz;
    const p = pts[j];
    for (let k = 0; k <= sides; k++) {
      const th = (k / sides) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      const dx = nx * c + bx * s, dy = ny * c + by * s, dz = nz * c + bz * s;
      let r = p.r;
      if (flare > 0) {
        // Root flare: the trunk spreads into a few buttresses near the ground.
        const world = Math.atan2(dz, dx);
        const f = Math.exp(-Math.max(p.y, 0) * 2.6) * flare;
        r *= 1 + f * (1 + 0.3 * Math.sin(world * 5 + 1.3) + 0.16 * Math.sin(world * 3 + 0.4));
      }
      mesh.v.push(p.x + dx * r, p.y + dy * r, p.z + dz * r, dx, dy, dz, ptx, pty, ptz, p.r);
      mesh.count++;
    }
  }
  const ring = sides + 1;
  for (let j = 0; j < n - 1; j++) {
    for (let k = 0; k < sides; k++) {
      const a = base + j * ring + k, b = a + 1, c = a + ring, d = c + 1;
      mesh.i.push(a, c, b, b, c, d);
    }
  }
}

function sidesFor(r) {
  return Math.max(3, Math.min(16, Math.round(3 + r * 46)));
}

// One tube per unbroken run of branch. At a fork the thickest child carries on;
// the others start a new tube from inside the parent.
function buildBranchTubes(skel, mesh) {
  const { X, Y, Z, kids, radius, options: o } = skel;
  const mainChild = (i) => {
    let best = -1, br = -1;
    for (const c of kids[i]) if (radius[c] > br) { br = radius[c]; best = c; }
    return best;
  };
  const stack = [[0, -1]];
  while (stack.length) {
    const [s, p] = stack.pop();
    const pts = [];
    if (p >= 0) pts.push({ x: X[p], y: Y[p], z: Z[p], r: radius[s] });
    else pts.push({ x: X[s], y: -0.35, z: Z[s], r: radius[s] });
    let n = s;
    while (n >= 0) {
      pts.push({ x: X[n], y: Y[n], z: Z[n], r: radius[n] });
      const m = mainChild(n);
      for (const c of kids[n]) if (c !== m) stack.push([c, n]);
      n = m;
    }
    pts[pts.length - 1].r *= 0.5;
    addTube(mesh, pts, sidesFor(pts[0].r), p < 0 ? o.rootFlare : 0);
  }
}

// ---------------------------------------------------------------------------------------
// 3. Twigs, leaves and blossom.
function growTwigs(skel, mesh, rnd) {
  const { X, Y, Z, parent, radius, count, options: o } = skel;
  const crownBottom = o.crownCentreY - o.crownRadiusY * o.crownUnderside;
  const crownTop = o.crownCentreY + o.crownRadiusY;
  const outer = (x, y, z) => {
    const dy = (y - o.crownCentreY) / (o.crownRadiusY * (y < o.crownCentreY ? o.crownUnderside : 1));
    return Math.min(1, Math.hypot(x / o.crownRadiusXZ, dy, z / o.crownRadiusXZ));
  };

  // Twigs grow from thin branches, mostly near the outside of the crown where the light is.
  const hosts = [];
  for (let i = 1; i < count; i++) if (radius[i] < o.twigHostRadius && parent[i] >= 0) hosts.push(i);
  if (!hosts.length) for (let i = 1; i < count; i++) hosts.push(i);

  const T = o.twigs, L = o.leavesPerTwig, Bn = o.blossomsPerTwig;
  const leaves = new Float32Array(T * L * LEAF_STRIDE);
  const blossoms = new Float32Array(T * Bn * LEAF_STRIDE);
  let lc = 0, bc = 0;

  const write = (arr, idx, px, py, pz, ax, ay, az, nx, ny, nz, size) => {
    const o2 = idx * LEAF_STRIDE;
    const out = outer(px, py, pz);
    const hN = Math.min(1, Math.max(0, (py - crownBottom) / (crownTop - crownBottom)));
    const sm = Math.min(1, Math.max(0, (out - 0.35) / 0.6));
    arr[o2] = px; arr[o2 + 1] = py; arr[o2 + 2] = pz;
    arr[o2 + 3] = ax; arr[o2 + 4] = ay; arr[o2 + 5] = az;
    arr[o2 + 6] = nx; arr[o2 + 7] = ny; arr[o2 + 8] = nz;
    arr[o2 + 9] = rnd(); arr[o2 + 10] = rnd(); arr[o2 + 11] = rnd(); arr[o2 + 12] = size;
    arr[o2 + 13] = hN; arr[o2 + 14] = out;
    arr[o2 + 15] = (0.25 + 0.75 * sm * sm * (3 - 2 * sm)) * (0.72 + 0.28 * hN);
  };

  for (let t = 0; t < T; t++) {
    let h = hosts[(rnd() * hosts.length) | 0];
    // Prefer hosts near the outside: retry a few times if this one is deep inside.
    for (let tries = 0; tries < 3; tries++) {
      const out = outer(X[h], Y[h], Z[h]);
      if (rnd() < 0.12 + 0.88 * out * out) break;
      h = hosts[(rnd() * hosts.length) | 0];
    }
    const p = parent[h], k = rnd();
    const bx = X[p] + (X[h] - X[p]) * k, by = Y[p] + (Y[h] - Y[p]) * k, bz = Z[p] + (Z[h] - Z[p]) * k;
    let tx = X[h] - X[p], ty = Y[h] - Y[p], tz = Z[h] - Z[p];
    let l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
    let ox = bx / o.crownRadiusXZ, oy = (by - o.crownCentreY) / o.crownRadiusY, oz = bz / o.crownRadiusXZ;
    l = Math.hypot(ox, oy, oz) || 1; ox /= l; oy /= l; oz /= l;
    // Twig direction: partly along the branch, mostly outwards, with a random spread.
    let dx = tx * 0.45 + ox * 0.75 + (rnd() * 2 - 1) * 0.85;
    let dy = ty * 0.45 + oy * 0.75 + (rnd() * 2 - 1) * 0.85 + 0.2;
    let dz = tz * 0.45 + oz * 0.75 + (rnd() * 2 - 1) * 0.85;
    l = Math.hypot(dx, dy, dz) || 1; dx /= l; dy /= l; dz /= l;
    const len = o.twigLength * (0.6 + 0.8 * rnd());
    const seg = len / 3;
    const pts = [{ x: bx, y: by, z: bz, r: 0.0065 }];
    let cx = bx, cy = by, cz = bz;
    for (let j = 1; j <= 3; j++) {
      cx += (dx + (rnd() - 0.5) * 0.3) * seg;
      cy += (dy - o.twigDroop * j + (rnd() - 0.5) * 0.3) * seg;
      cz += (dz + (rnd() - 0.5) * 0.3) * seg;
      pts.push({ x: cx, y: cy, z: cz, r: 0.0058 - j * 0.0011 });
    }
    addTube(mesh, pts, 3, 0);

    // A sideways direction for the alternate leaves.
    let sxv = -dz, szv = dx; // cross(dir, up)
    l = Math.hypot(sxv, szv) || 1; sxv /= l; szv /= l;

    for (let j = 0; j < L; j++) {
      const s = ((j + 0.7) / L) * 3;
      const i0 = Math.min(2, Math.floor(s)), f = s - i0;
      const a = pts[i0], b = pts[i0 + 1];
      const px = a.x + (b.x - a.x) * f, py = a.y + (b.y - a.y) * f, pz = a.z + (b.z - a.z) * f;
      const side = j % 2 ? 1 : -1;
      let axx, axy, axz;
      if (j === L - 1) {
        axx = dx + (rnd() - 0.5) * 0.4; axy = dy - 0.25 + (rnd() - 0.5) * 0.4; axz = dz + (rnd() - 0.5) * 0.4;
      } else {
        axx = dx * 0.5 + sxv * side * 0.85 + (rnd() - 0.5) * 0.5;
        axy = dy * 0.5 - 0.28 + (rnd() - 0.5) * 0.5;
        axz = dz * 0.5 + szv * side * 0.85 + (rnd() - 0.5) * 0.5;
      }
      l = Math.hypot(axx, axy, axz) || 1; axx /= l; axy /= l; axz /= l;
      // Leaves turn their upper face to the sky and a little outwards.
      let nx = ox * 0.45 + (rnd() - 0.5) * 0.6, ny = 0.8 + oy * 0.2, nz = oz * 0.45 + (rnd() - 0.5) * 0.6;
      const d = nx * axx + ny * axy + nz * axz;
      nx -= axx * d; ny -= axy * d; nz -= axz * d;
      l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      write(leaves, lc++, px, py, pz, axx, axy, axz, nx, ny, nz, o.leafSize * (0.7 + 0.6 * rnd()));
    }

    for (let j = 0; j < Bn; j++) {
      const s = rnd() * 3;
      const i0 = Math.min(2, Math.floor(s)), f = s - i0;
      const a = pts[i0], b = pts[i0 + 1];
      const off = 0.03;
      const px = a.x + (b.x - a.x) * f + (rnd() - 0.5) * off * 2;
      const py = a.y + (b.y - a.y) * f + rnd() * off;
      const pz = a.z + (b.z - a.z) * f + (rnd() - 0.5) * off * 2;
      // Flowers face outwards and up, each a little differently.
      let nx = ox * 0.7 + (rnd() - 0.5) * 0.9, ny = 0.55 + (rnd() - 0.5) * 0.7, nz = oz * 0.7 + (rnd() - 0.5) * 0.9;
      l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      // Any axis at right angles to the normal.
      let axx = -nz, axy = 0, axz = nx;
      l = Math.hypot(axx, axy, axz);
      if (l < 1e-3) { axx = 1; axy = 0; axz = 0; l = 1; }
      axx /= l; axz /= l;
      write(blossoms, bc++, px, py, pz, axx, axy, axz, nx, ny, nz, o.blossomSize * (0.75 + 0.5 * rnd()));
    }
  }
  return { leaves, leafCount: lc, blossoms, blossomCount: bc, crownBottom, crownTop };
}

// ---------------------------------------------------------------------------------------
// 4. The whole tree in one call.
export function growTree(options = {}) {
  const o = { ...TREE_DEFAULTS, ...options };
  const rnd = mulberry32(o.seed);
  const t0 = (typeof performance !== 'undefined' ? performance.now() : 0);
  const skeleton = growSkeleton(o, rnd);
  const mesh = new MeshBuilder();
  buildBranchTubes(skeleton, mesh);
  const branchVertexCount = mesh.count;
  const foliage = growTwigs(skeleton, mesh, rnd);
  let top = 0, reach = 0;
  for (let i = 0; i < skeleton.count; i++) {
    top = Math.max(top, skeleton.Y[i]);
    reach = Math.max(reach, Math.hypot(skeleton.X[i], skeleton.Z[i]));
  }
  return {
    options: o,
    skeleton,
    mesh: mesh.finish(),
    leaves: foliage.leaves,
    leafCount: foliage.leafCount,
    blossoms: foliage.blossoms,
    blossomCount: foliage.blossomCount,
    bounds: {
      height: top + o.twigLength,
      centreY: (top + o.twigLength) / 2,
      radius: Math.max(reach + o.twigLength, (top + o.twigLength) / 2),
      crownBottom: foliage.crownBottom,
      crownTop: foliage.crownTop,
    },
    stats: {
      nodes: skeleton.count,
      branchVertices: branchVertexCount,
      vertices: mesh.count,
      triangles: mesh.i.length / 3,
      leaves: foliage.leafCount,
      blossoms: foliage.blossomCount,
      milliseconds: (typeof performance !== 'undefined' ? performance.now() : 0) - t0,
    },
  };
}
