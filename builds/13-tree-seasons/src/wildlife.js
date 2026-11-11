// src/wildlife.js
// Draws the life in and around the tree: small birds, a red squirrel, a far autumn flock,
// butterflies and meadow flowers. Where each animal is comes from engine/life.js;
// this file only builds the little models and draws them.

import { setUniforms, createBuffer, bindAttributes } from '../engine/glkit.js';
import { LIFE, lifeActivity, findPerches, findSquirrelRoute, birdState, squirrelState, flockState } from '../engine/life.js';
import { mulberry32 } from '../engine/tree.js';

const BIRD_SCALE = 1.8;        // small birds are drawn this much larger than life, so they read from 46 m
const SQUIRREL_SCALE = 1.4;
const FLOCK_SCALE = 4.5;       // the far flock is larger birds (geese)
const TOADSTOOLS = 40;         // autumn toadstools near the trunk
const FLOWER_RADIUS = 24;      // flowers are scattered inside this radius, metres
const FLOWER_SIZE = 0.75;      // head sizes below are diameters; the quad is drawn from its centre, hence under 1

// Colours are linear RGB: back, belly, beak, wings.
const BIRD_COATS = [
  { a: [0.20, 0.15, 0.10], b: [0.72, 0.25, 0.07], c: [0.10, 0.08, 0.07], d: [0.15, 0.11, 0.08] },  // robin
  { a: [0.025, 0.025, 0.03], b: [0.035, 0.035, 0.04], c: [0.85, 0.48, 0.04], d: [0.02, 0.02, 0.025] }, // blackbird
  { a: [0.18, 0.34, 0.62], b: [0.80, 0.70, 0.18], c: [0.08, 0.08, 0.08], d: [0.15, 0.27, 0.52] },  // blue tit
  { a: [0.30, 0.21, 0.13], b: [0.55, 0.50, 0.42], c: [0.22, 0.18, 0.13], d: [0.21, 0.15, 0.10] },  // sparrow
  { a: [0.30, 0.29, 0.34], b: [0.62, 0.36, 0.27], c: [0.30, 0.30, 0.34], d: [0.10, 0.10, 0.11] },  // chaffinch
];
const FLOCK_COAT = { a: [0.07, 0.07, 0.08], b: [0.22, 0.22, 0.23], c: [0.05, 0.05, 0.05], d: [0.05, 0.05, 0.06] };
const SQUIRREL_COAT = { a: [0.33, 0.15, 0.065], b: [0.70, 0.63, 0.53], c: [0.04, 0.03, 0.03], d: [0.29, 0.12, 0.05] };

// --- Model building -----------------------------------------------------------------------------
// Vertex: position 3, normal 3, part 1, colour region 1.
class Model {
  constructor() { this.v = []; this.i = []; this.n = 0; }
  vert(x, y, z, nx, ny, nz, part, region) { this.v.push(x, y, z, nx, ny, nz, part, region); return this.n++; }
}

// Sweeps a ring along a line of [x, y, radius] points lying in the plane z = zOff.
// regionOf(normalY, x) picks the colour region of each vertex.
function sweep(m, pts, sides, part, regionOf, zOff = 0) {
  const base = m.n;
  for (let j = 0; j < pts.length; j++) {
    const a = pts[Math.max(j - 1, 0)], b = pts[Math.min(j + 1, pts.length - 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const nx = -ty, ny = tx, r = pts[j][2];
    for (let k = 0; k <= sides; k++) {
      const th = (k / sides) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      m.vert(pts[j][0] + nx * c * r, pts[j][1] + ny * c * r, zOff + s * r, nx * c, ny * c, s, part, regionOf(ny * c, pts[j][0]));
    }
  }
  const ring = sides + 1;
  for (let j = 0; j < pts.length - 1; j++) {
    for (let k = 0; k < sides; k++) {
      const a = base + j * ring + k, b = a + 1, c = a + ring, d = c + 1;
      m.i.push(a, c, b, b, c, d);
    }
  }
}

function flat(m, quad, part, region) {
  const ids = quad.map((p) => m.vert(p[0], p[1], p[2], 0, 1, 0, part, region));
  m.i.push(ids[0], ids[1], ids[2]);
  if (ids.length > 3) m.i.push(ids[0], ids[2], ids[3]);
}

// A small perching bird, about 13 cm long. x is forward, y is up, feet at y = 0.
function birdModel() {
  const m = new Model();
  const breast = (ny, x) => (ny < -0.15 || (x > 0.03 && ny < 0.35) ? 1 : 0);
  sweep(m, [[-0.055, 0.030, 0.003], [-0.035, 0.030, 0.016], [-0.005, 0.032, 0.024], [0.02, 0.036, 0.022],
    [0.04, 0.044, 0.018], [0.055, 0.049, 0.013], [0.065, 0.049, 0.003]], 7, 0, breast);
  sweep(m, [[0.062, 0.049, 0.005], [0.080, 0.046, 0.0004]], 5, 0, () => 2);                       // beak
  flat(m, [[-0.045, 0.034, 0.008], [-0.045, 0.034, -0.008], [-0.108, 0.027, -0.015], [-0.108, 0.027, 0.015]], 0, 3); // tail
  for (const s of [1, -1]) {                                                                       // wings
    flat(m, [[0.022, 0.040, 0.016 * s], [-0.028, 0.040, 0.016 * s], [-0.045, 0.040, 0.095 * s], [-0.008, 0.040, 0.125 * s]], s > 0 ? 1 : 2, 3);
  }
  sweep(m, [[0.005, 0.012, 0.0025], [0.008, 0.0, 0.002]], 4, 0, () => 2, 0.008);                   // legs
  sweep(m, [[0.005, 0.012, 0.0025], [0.008, 0.0, 0.002]], 4, 0, () => 2, -0.008);
  return m;
}

// A red squirrel, about 20 cm in the body with a tail as long again.
function squirrelModel() {
  const m = new Model();
  const belly = (ny) => (ny < -0.25 ? 1 : 0);
  sweep(m, [[-0.10, 0.045, 0.012], [-0.08, 0.050, 0.036], [-0.03, 0.055, 0.045], [0.03, 0.055, 0.038], [0.07, 0.060, 0.028],
    [0.10, 0.070, 0.027], [0.125, 0.072, 0.024], [0.15, 0.066, 0.012], [0.158, 0.064, 0.003]], 8, 0, belly);
  for (const s of [1, -1]) {                                                                       // tufted ears
    flat(m, [[0.098, 0.090, 0.012 * s], [0.116, 0.090, 0.013 * s], [0.103, 0.122, 0.017 * s]], 0, 0);
  }
  sweep(m, [[-0.095, 0.050, 0.014], [-0.15, 0.060, 0.035], [-0.19, 0.110, 0.048], [-0.185, 0.180, 0.050],
    [-0.14, 0.235, 0.042], [-0.09, 0.250, 0.020], [-0.07, 0.245, 0.004]], 8, 3, () => 3);          // tail
  for (const s of [1, -1]) {                                                                       // legs
    sweep(m, [[0.06, 0.045, 0.012], [0.068, 0.0, 0.008]], 5, 0, () => 0, 0.022 * s);
    sweep(m, [[-0.05, 0.05, 0.02], [-0.035, 0.0, 0.011]], 5, 0, () => 0, 0.03 * s);
  }
  return m;
}

// Builds the matrix that places a model: x along fwd, y along up, tipped nose-up by pitch about pivotX.
function placeModel(pos, fwd, up, pitch, s, pivotX = 0) {
  let ux = up[0], uy = up[1], uz = up[2];
  let l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
  const d = fwd[0] * ux + fwd[1] * uy + fwd[2] * uz;
  let xx = fwd[0] - ux * d, xy = fwd[1] - uy * d, xz = fwd[2] - uz * d;
  l = Math.hypot(xx, xy, xz);
  if (l < 1e-4) { xx = uy; xy = -ux; xz = 0; l = Math.hypot(xx, xy, xz) || 1; }
  xx /= l; xy /= l; xz /= l;
  const zx = xy * uz - xz * uy, zy = xz * ux - xx * uz, zz = xx * uy - xy * ux;
  const c = Math.cos(pitch), sn = Math.sin(pitch);
  const ax = xx * c + ux * sn, ay = xy * c + uy * sn, az = xz * c + uz * sn;      // tipped forward axis
  const bx = -xx * sn + ux * c, by = -xy * sn + uy * c, bz = -xz * sn + uz * c;   // tipped up axis
  // Keep the pivot point (the hind feet) where it was.
  const px = (xx - ax) * pivotX * s, py = (xy - ay) * pivotX * s, pz = (xz - az) * pivotX * s;
  return new Float32Array([ax * s, ay * s, az * s, 0, bx * s, by * s, bz * s, 0, zx * s, zy * s, zz * s, 0, pos[0] + px, pos[1] + py, pos[2] + pz, 1]);
}

export function createWildlife(gl, P, tree, quality) {
  const upload = (model) => {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    bindAttributes(gl, createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(model.v)), 8, [
      { loc: 0, size: 3, offset: 0 }, { loc: 1, size: 3, offset: 3 }, { loc: 2, size: 2, offset: 6 },
    ]);
    createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(model.i));
    return { vao, count: model.i.length };
  };
  const bird = upload(birdModel());
  const squirrel = upload(squirrelModel());

  const perches = findPerches(tree.skeleton, 26);
  const route = findSquirrelRoute(tree.skeleton);
  const rnd = mulberry32(4411);

  // --- Butterflies ------------------------------------------------------------------------------
  const flyCount = quality.butterflies;
  const flySeeds = new Float32Array(flyCount * 4);
  for (let i = 0; i < flySeeds.length; i++) flySeeds[i] = rnd();
  const flyVao = gl.createVertexArray();
  gl.bindVertexArray(flyVao);
  bindAttributes(gl, createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([
    -1, 0, 1, 1, 0, 1, 1, 1, 1, -1, 1, 1,
    -1, 0, -1, 1, 0, -1, 1, 1, -1, -1, 1, -1,
  ])), 3, [{ loc: 0, size: 3, offset: 0 }]);
  createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]));
  bindAttributes(gl, createBuffer(gl, gl.ARRAY_BUFFER, flySeeds), 4, [{ loc: 1, size: 4, offset: 0 }], 1);

  // --- Meadow flowers: in drifts, thinner in the shade under the crown -----------------------------
  const flowerCount = quality.flowers;
  const flowers = new Float32Array(flowerCount * 8);
  // kind threshold, head size (m), stem height range (m), opens (year, range), fades (year, range)
  const KINDS = [
    { upTo: 0.45, kind: 0.2, size: 0.034, stem: [0.10, 0.22], opens: [0.07, 0.20], fades: [0.46, 0.60] },   // daisy
    { upTo: 0.75, kind: 0.6, size: 0.030, stem: [0.20, 0.40], opens: [0.13, 0.25], fades: [0.40, 0.50] },   // buttercup
    { upTo: 0.92, kind: 0.85, size: 0.040, stem: [0.15, 0.30], opens: [0.20, 0.30], fades: [0.50, 0.62] },  // red clover
    { upTo: 1.01, kind: 0.97, size: 0.060, stem: [0.35, 0.55], opens: [0.26, 0.34], fades: [0.42, 0.50] },  // poppy
  ];
  for (let i = 0, guard = 0; i < flowerCount && guard < flowerCount * 40; guard++) {
    const r = 1.2 + FLOWER_RADIUS * Math.sqrt(rnd()), a = rnd() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const pick = rnd();
    const k = KINDS.find((q) => pick < q.upTo) || KINDS[0];
    // Each kind grows in its own drifts.
    const drift = Math.sin(x * 0.33 + k.kind * 9) * Math.sin(z * 0.41 + k.kind * 5) + 0.6 * Math.sin(x * 0.9 + z * 0.7 + k.kind * 3);
    if (drift < rnd() * 1.6 - 0.5) continue;
    if (r < 4.5 && rnd() < 0.7) continue;
    const o = i * 8;
    flowers[o] = x; flowers[o + 1] = z;
    flowers[o + 2] = k.stem[0] + (k.stem[1] - k.stem[0]) * rnd();
    flowers[o + 3] = k.size * FLOWER_SIZE * (0.8 + 0.4 * rnd());
    flowers[o + 4] = k.kind;
    flowers[o + 5] = k.opens[0] + (k.opens[1] - k.opens[0]) * rnd();
    flowers[o + 6] = k.fades[0] + (k.fades[1] - k.fades[0]) * rnd();
    flowers[o + 7] = rnd();
    i++;
  }
  // Autumn toadstools in small troops near the foot of the tree. They take the last few flower slots.
  for (let j = 0; j < Math.min(TOADSTOOLS, flowerCount); j++) {
    const o = (flowerCount - 1 - j) * 8;
    const troop = Math.floor(j / 5);
    const a = troop * 2.4 + 0.6 + (rnd() - 0.5) * 0.5, r = 1.3 + (troop % 3) * 0.9 + rnd() * 0.5;
    const size = 0.035 + 0.035 * rnd();
    flowers[o] = Math.cos(a) * r; flowers[o + 1] = Math.sin(a) * r;
    flowers[o + 2] = size * 0.95;            // the stem foot sits on the ground
    flowers[o + 3] = size;
    flowers[o + 4] = 0.995;
    flowers[o + 5] = 0.52 + 0.08 * rnd();
    flowers[o + 6] = 0.72 + 0.05 * rnd();
    flowers[o + 7] = rnd();
  }
  const flowerVao = gl.createVertexArray();
  gl.bindVertexArray(flowerVao);
  bindAttributes(gl, createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1])), 2, [{ loc: 0, size: 2, offset: 0 }]);
  createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]));
  bindAttributes(gl, createBuffer(gl, gl.ARRAY_BUFFER, flowers), 8, [{ loc: 1, size: 4, offset: 0 }, { loc: 2, size: 4, offset: 4 }], 1);
  gl.bindVertexArray(null);

  // --- Per frame --------------------------------------------------------------------------------
  let animals = [];
  let activity = lifeActivity(0);

  function update(time, st) {
    activity = lifeActivity(st.year);
    animals = [];
    for (let i = 0; i < LIFE.BIRDS; i++) {
      const b = birdState(i, time, activity.birds, perches, st.wind);
      if (!b) continue;
      const coat = BIRD_COATS[i < 3 ? i : 3 + (i % 2)];
      animals.push({ mesh: bird, coat, model: placeModel(b.pos, b.fwd, [0, 1, 0], Math.asin(Math.max(-1, Math.min(1, b.fwd[1]))) * 0.8, BIRD_SCALE * b.scale), flap: b.flap, fold: b.fold, tail: 0 });
    }
    if (activity.squirrel > 0.01) {
      const s = squirrelState(time, route);
      animals.push({ mesh: squirrel, coat: SQUIRREL_COAT, model: placeModel(s.pos, s.fwd, s.up, s.pitch, SQUIRREL_SCALE * activity.squirrel, -0.05), flap: 0, fold: 0, tail: s.tail });
    }
    if (activity.flock > 0.01) {
      for (let j = 0; j < LIFE.FLOCK; j++) {
        const f = flockState(j, time);
        animals.push({ mesh: bird, coat: FLOCK_COAT, model: placeModel(f.pos, f.fwd, [0, 1, 0], 0, FLOCK_SCALE * activity.flock), flap: f.flap, fold: 0, tail: 0 });
      }
    }
    return activity;
  }

  function drawAnimals(prog, U, extra) {
    if (!animals.length) return;
    gl.useProgram(prog.program);
    setUniforms(gl, prog, U);
    if (extra) setUniforms(gl, prog, extra);
    let bound = null;
    for (const a of animals) {
      if (bound !== a.mesh) { gl.bindVertexArray(a.mesh.vao); bound = a.mesh; }
      setUniforms(gl, prog, { uModel: a.model, uFlap: a.flap, uFold: a.fold, uTail: a.tail, uColA: a.coat.a, uColB: a.coat.b, uColC: a.coat.c, uColD: a.coat.d });
      gl.drawElements(gl.TRIANGLES, a.mesh.count, gl.UNSIGNED_SHORT, 0);
    }
  }

  function drawShadow(U, shadowVP) { drawAnimals(P.critterShadow, U, { uViewProj: shadowVP }); }

  function draw(U, year) {
    drawAnimals(P.critter, U);
    // Flowers are out from mid spring, toadstools until early winter; skip the draw otherwise.
    if (year > 0.06 && year < 0.84) {
      gl.useProgram(P.flower.program);
      setUniforms(gl, P.flower, U);
      gl.bindVertexArray(flowerVao);
      gl.drawElementsInstanced(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0, flowerCount);
    }
    if (activity.butterflies > 0.01) {
      gl.useProgram(P.fly.program);
      setUniforms(gl, P.fly, U);
      setUniforms(gl, P.fly, { uPresence: activity.butterflies });
      gl.bindVertexArray(flyVao);
      gl.drawElementsInstanced(gl.TRIANGLES, 12, gl.UNSIGNED_SHORT, 0, flyCount);
    }
  }

  return { update, draw, drawShadow, get activity() { return activity; }, get animals() { return animals.length; }, perches, route };
}
