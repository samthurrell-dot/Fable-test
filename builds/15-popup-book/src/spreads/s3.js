// src/spreads/s3.js
// Spread 3, the mill. A street of houses (V-fold), the mill and a row of poplars on parallelogram
// layers, a humpback bridge over the fold of the book (a tent: the parallel fold), and a wheel: the
// mill's waterwheel turns on a rivet under the pointer.

import { C, tint, rect, rrect, ellipse, smooth, shift, standing, boatHull, boatSail, fill, stroke, disc, ring, line, box, text, textBlock, scatter } from '../art.js';
import { STORY } from '../story.js';
import { MAT } from '../book.js';

const GROUND = '#d8d08c';
const WHEEL_R = 3.5;

// A paddle wheel: a rim with square paddles standing out from it.
function wheelOutline(r, paddles) {
  const out = [];
  for (let i = 0; i < paddles; i++) {
    const a0 = (i / paddles) * Math.PI * 2, da = (Math.PI * 2) / paddles;
    for (const [t, rr] of [[0, r * 0.9], [0.3, r * 0.9], [0.3, r], [0.62, r], [0.62, r * 0.9]]) out.push([Math.cos(a0 + da * t) * rr, Math.sin(a0 + da * t) * rr]);
  }
  return out;
}

export function buildSpread3(b) {
  const { W, H } = b;
  const river = (y) => 1.5 + 0.25 * Math.sin(y * 0.5);

  // --- The page ---------------------------------------------------------------------------------
  b.page(GROUND, (c) => {
    fill(c, [[-W, 20.5], [-9, 22], [0, 21], [10, 22.3], [W, 20.6], [W, H], [-W, H]], tint(C.moss, 0.2));
    // fields in strips
    for (const [x0, x1, y0, y1, col, a] of [[-24, -13, 10.5, 17, C.moss, 0.25], [13.5, 24, 5, 10.5, C.moss, -0.2], [-24, -15, 6.4, 9.6, C.ochre, 0.1]]) {
      c.save(); c.translate((x0 + x1) / 2, (y0 + y1) / 2); c.rotate(a);
      box(c, (x0 - x1) / 2, (y0 - y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, tint(col, 0.25));
      for (let y = (y0 - y1) / 2 + 0.4; y < (y1 - y0) / 2; y += 0.7) line(c, (x0 - x1) / 2 + 0.2, y, (x1 - x0) / 2 - 0.2, y, tint(col, -0.12), 0.09);
      c.restore();
    }
    // the lane over the bridge
    stroke(c, smooth([[-W, 4.2], [-17, 5.4], [-10, 6.6], [-5, 7], [5, 7], [10, 7.4], [16, 9.6], [W, 11]], 6), tint(C.sand, 0.25), 2.6);
    stroke(c, smooth([[-W, 4.2], [-17, 5.4], [-10, 6.6], [-5, 7], [5, 7], [10, 7.4], [16, 9.6], [W, 11]], 6), tint(C.sand, -0.12), 0.07);
    // the river, with a mill pool
    const bankR = [], bankL = [];
    for (let y = 21; y >= -0.3; y -= 0.5) { bankR.push([river(y) + (y > 9.5 && y < 13.5 ? 0.9 * Math.sin(((y - 9.5) / 4) * Math.PI) : 0), y]); bankL.push([-river(y + 2), y]); }
    fill(c, [...bankR, ...bankL.reverse()], C.water);
    for (let y = 1.2; y < 20; y += 1.9) stroke(c, smooth([[-0.7, y], [0, y - 0.3], [0.8, y]], 4), C.foam, 0.07);
    for (const r of [0.5, 0.9, 1.3]) stroke(c, ellipse(1.6, 11.5, r, r * 0.6, 20, 0.5, 5.2), C.foam, 0.06);
    scatter(60, -W + 1, 0.8, W - 1, 19, 17, (x, y, i) => { if (Math.abs(x) < 3 || Math.abs(y - 6.6 - x * 0.1) < 2.2) return; disc(c, x, y, 0.12, i % 3 ? C.snow : C.red); disc(c, x, y, 0.04, C.sun); });
    textBlock(c, STORY[3], -22.6, 3.4, 0.86, 15, { colour: C.bark });
    text(c, '3', -23.2, 0.7, 0.5, { colour: tint(C.bark, 0.3) });
  });
  // ducks on the water, and the boat going round in the pool
  for (const [x, y, s] of [[-1.0, 16.2, 1], [0.95, 15.0, 0.8], [-0.9, 3.2, 0.9]]) {
    b.part({ on: x < 0 ? b.L : b.R, shape: shift(smooth([[-0.6, 0], [-0.75, 0.3], [-0.4, 0.4], [-0.1, 0.35], [0.05, 0.75], [0.35, 0.8], [0.5, 0.6], [0.72, 0.55], [0.45, 0.45], [0.5, 0.1], [0.2, -0.05]], 3, true).map(([px, py]) => [px * s, py * s]), x, y), color: C.snow });
  }
  b.part({ on: b.R, shape: shift(boatHull(0, 0, 1.9), 1.7, 11.1), color: C.red });
  b.part({ on: b.R, level: 2, shape: shift(boatSail(0, 0, 1.9), 1.7, 11.05), color: C.snow });

  // --- The street ----------------------------------------------------------------------------------
  const far = b.vfold({ y: 19.5, alpha: 110, beta: 93, span: [-21, 21], labelY: 7 });
  // houses as [left, right, eaves, ridge, wall colour, roof colour]
  const houses = [[-20.6, -16.6, 5.2, 7.4, C.cream, C.brick], [-16.2, -12.6, 6.6, 9.4, C.rose, C.bark], [-12.2, -7.6, 5.4, 7.8, C.ochre, C.brick], [-7.2, -3.6, 7.4, 10.4, C.cream, C.slate],
    [3.4, 7.2, 6.2, 8.8, C.rose, C.brick], [7.6, 12.2, 5.2, 7.6, C.cream, C.slate], [16.4, 20.6, 5.6, 8.0, C.ochre, C.bark]];
  const church = { x0: 12.6, x1: 16, eaves: 8.6, spire: 13.4 };
  const top = [[-21, 2.4], [-20.6, 2.6]];
  for (const [x0, x1, e, r] of houses.filter((h) => h[0] < 0)) top.push([x0, e], [(x0 + x1) / 2, r], [x1, e], [x1, e - 1.2]);
  top.push([-3.2, 3.4], [0, 3.0], [3.0, 3.4]);
  for (const [x0, x1, e, r] of houses.filter((h) => h[0] > 0 && h[0] < 12)) top.push([x0, e - 1.2], [x0, e], [(x0 + x1) / 2, r], [x1, e]);
  top.push([12.2, 4.4], [church.x0, 4.4], [church.x0, church.eaves], [(church.x0 + church.x1) / 2, church.spire], [church.x1, church.eaves], [church.x1, 4.6]);
  { const [x0, x1, e, r] = houses[6]; top.push([x0, 4.6], [x0, e], [(x0 + x1) / 2, r], [x1, e], [x1, 2.6]); }
  top.push([21, 2.4]);
  b.part({
    on: far, shape: standing(top, b.base(far)), color: C.sand,
    print: (c) => {
      box(c, -22, -2, 22, 3.2, tint(C.moss, -0.05));
      const win = (x, y, w = 0.7, h = 1.0) => { box(c, x - w / 2, y, x + w / 2, y + h, C.navy); line(c, x, y, x, y + h, C.cream, 0.06); line(c, x - w / 2, y + h / 2, x + w / 2, y + h / 2, C.cream, 0.06); };
      for (const [x0, x1, e, r, wall, roof] of houses) {
        box(c, x0, 0.4, x1, e, wall);
        fill(c, [[x0 - 0.3, e], [(x0 + x1) / 2, r + 0.1], [x1 + 0.3, e]], roof);
        const cx = (x0 + x1) / 2, n = x1 - x0 > 4 ? 3 : 2;
        for (let i = 0; i < n; i++) win(x0 + ((i + 0.5) * (x1 - x0)) / n, e - 2.0);
        box(c, cx - 0.5, 0.4, cx + 0.5, 2.3, tint(roof, -0.2));
        disc(c, cx + 0.3, 1.35, 0.07, C.sun);
        for (let i = 0; i < n; i++) if (e > 6) win(x0 + ((i + 0.5) * (x1 - x0)) / n, e - 3.9, 0.7, 0.9);
      }
      box(c, church.x0, 0.4, church.x1, church.eaves, C.stone);
      fill(c, [[church.x0 - 0.2, church.eaves], [(church.x0 + church.x1) / 2, church.spire + 0.1], [church.x1 + 0.2, church.eaves]], C.slate);
      disc(c, (church.x0 + church.x1) / 2, 6.6, 0.7, C.cream); line(c, 14.3, 6.6, 14.3, 7.1, C.ink, 0.07); line(c, 14.3, 6.6, 14.65, 6.5, C.ink, 0.07);
      fill(c, [...ellipse(14.3, 2.6, 0.6, 0.7, 12, 0, Math.PI), [13.7, 0.4], [14.9, 0.4]], C.bark);
      scatter(40, -20, 0.2, 20, 0.6, 5, (x, y, i) => disc(c, x, y, 0.1, i % 2 ? C.red : C.sun));
    },
  });

  // --- The mill, on a layer in front of the right-hand houses; its wheel turns ------------------------
  const mill = b.layer(far, 'B', { r: 8.2, a: 4.6, b: 3.4, w: 1.8, x0: -2.5, x1: 4, strut: C.stone });
  const WX = -2.6, WY = 3.5;   // the rivet of the wheel, on the mill wall
  b.part({
    on: mill.stand, color: C.stone, shape: [[-3.4, 0], [-3.4, 6.0], [0.6, 8.6], [4.6, 6.0], [4.6, 0]],
    print: (c) => {
      fill(c, [[-3.8, 5.9], [0.6, 8.9], [5.0, 5.9], [4.6, 5.5], [0.6, 8.1], [-3.4, 5.5]], C.bark);
      scatter(70, -3.2, 0.2, 4.4, 5.6, 12, (x, y, i, r) => fill(c, rrect(x, y, x + 0.5 + r() * 0.4, y + 0.3, 0.08, 2), tint(C.stone, i % 2 ? 0.2 : -0.16)));
      box(c, 1.6, 0, 3.2, 3.0, C.bark); fill(c, ellipse(2.4, 3.0, 0.8, 0.7, 12, 0, Math.PI), C.bark); disc(c, 2.9, 1.5, 0.08, C.sun);
      box(c, 1.9, 4.2, 2.9, 5.4, C.navy); line(c, 2.4, 4.2, 2.4, 5.4, C.cream, 0.06);
      disc(c, 0.6, 6.6, 0.5, C.navy);
      // the race the water runs in
      fill(c, [[-3.4, 0], [-3.4, 1.4], [0.9, 1.4], [0.9, 0]], C.water);
      for (let x = -3.0; x < 0.8; x += 0.9) stroke(c, smooth([[x, 0.9], [x + 0.3, 0.7], [x + 0.6, 0.9]], 3), C.foam, 0.06);
    },
  });
  const wheel = b.control({ type: 'wheel', parent: mill.stand, at: [WX, WY], radius: WHEEL_R + 0.3, z: 0.1, name: 'Wheel', demo: [0, -2.4, -4.8], demoScale: 1 });
  const turning = b.planar(mill.stand, () => ({ x: WX, y: WY, rot: wheel.value, z: 0.07 }));
  b.part({
    on: turning, z: [0, 0.045], shape: wheelOutline(WHEEL_R, 12), holes: [0, 1, 2, 3].map((k) => { const a = k * Math.PI / 2 + 0.25; return [0, 1, 2, 3, 4, 5, 6].map((i) => { const t = a + (i / 6) * 1.07; return [Math.cos(t) * 2.5, Math.sin(t) * 2.5]; }).concat([6, 5, 4, 3, 2, 1, 0].map((i) => { const t = a + (i / 6) * 1.07; return [Math.cos(t) * 0.95, Math.sin(t) * 0.95]; })); }),
    color: C.brown, back: C.brown,
    print: (c) => { ring(c, 0, 0, 2.78, C.bark, 0.14); ring(c, 0, 0, 3.05, tint(C.brown, 0.2), 0.08); for (let i = 0; i < 12; i++) { const a = ((i + 0.46) / 12) * Math.PI * 2; line(c, Math.cos(a) * 3.1, Math.sin(a) * 3.1, Math.cos(a) * 3.45, Math.sin(a) * 3.45, C.bark, 0.07); } },
  });
  b.part({ on: turning, z: [0.045, 0.09], shape: ellipse(0, 0, 0.42, 0.42, 16), color: C.sun });
  b.label(mill.stand, [WX, WY + WHEEL_R, 0.3], 'Wheel');

  // --- Poplars on the left -----------------------------------------------------------------------------
  const trees = b.layer(far, 'A', { r: 12, a: 3.6, b: 3.0, w: 1.6, x0: -3, x1: 3, label: false, strut: C.leaf });
  const poplar = (x, h, w) => smooth([[x - 0.12, 0], [x - 0.12, h * 0.2], [x - w / 2, h * 0.36], [x - w * 0.42, h * 0.72], [x, h], [x + w * 0.42, h * 0.72], [x + w / 2, h * 0.36], [x + 0.12, h * 0.2], [x + 0.12, 0]], 4);
  b.part({ on: trees.stand, color: C.moss, shape: smooth([[-4.6, 0], [-4, 0.9], [-1, 1.3], [2, 1.1], [4, 0.7], [4.6, 0]], 5) });
  for (const [x, h, w, col] of [[-3.2, 7.4, 1.9, C.leaf], [-1.0, 9.0, 2.2, C.pine], [1.3, 7.8, 2.0, C.leaf], [3.3, 6.2, 1.7, C.pine]]) b.part({ on: trees.stand, level: 1, shape: poplar(x, h, w), color: col, print: (c) => line(c, x, 0, x, h * 0.5, C.bark, 0.14) });
  // a fence along the lane
  b.part({ on: trees.stand, level: 2, color: C.snow, shape: [[-4.4, 0.5], [-4.4, 1.9], [-4.1, 2.1], [-3.8, 1.9], [-3.8, 1.5], [-2.9, 1.5], [-2.9, 1.9], [-2.6, 2.1], [-2.3, 1.9], [-2.3, 1.5], [-1.4, 1.5], [-1.4, 1.9], [-1.1, 2.1], [-0.8, 1.9], [-0.8, 0.5], [-1.4, 0.5], [-1.4, 1.0], [-2.3, 1.0], [-2.3, 0.5], [-2.9, 0.5], [-2.9, 1.0], [-3.8, 1.0], [-3.8, 0.5]] });

  // --- The bridge: a tent over the fold --------------------------------------------------------------------
  const bridge = b.tent({ y: 6.6, a: 5.6, p: 7.4, y0: -2.2, y1: 2.2, label: 'Parallel fold' });
  b.part({
    on: bridge, color: C.stone, back: tint(C.stone, 0.25),
    shape: rect(-7.4, -2.6, 7.4, 2.6),
    print: (c) => {
      box(c, -7.4, -1.9, 7.4, 1.9, tint(C.sand, 0.15));
      for (let x = -7.2; x < 7.3; x += 0.72) for (let y = -1.8; y < 1.8; y += 0.5) fill(c, rrect(x + ((y * 2) % 1) * 0.3, y, x + 0.56 + ((y * 2) % 1) * 0.3, y + 0.38, 0.1, 2), tint(C.sand, ((x * 3 + y * 5) % 1 + 1) % 1 > 0.5 ? -0.1 : 0.2));
      for (const y of [-2.6, 1.95]) for (let x = -7.4; x < 7.4; x += 0.925) { box(c, x + 0.05, y + 0.05, x + 0.88, y + 0.6, tint(C.stone, Math.round(x / 0.925) % 2 ? 0.18 : -0.14)); }
    },
  });
}
