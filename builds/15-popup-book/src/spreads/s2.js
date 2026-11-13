// src/spreads/s2.js
// Spread 2, the forest. A wall of firs and a line of broadleaf trees (two V-folds), a deer and a
// fallen trunk on parallelogram layers, and a slider: the boat rides a slot cut along the rapids.

import { C, tint, rect, ellipse, smooth, shift, fir, tree, standing, boatHull, boatSail, fill, stroke, disc, line, text, textBlock, scatter } from '../art.js';
import { STORY } from '../story.js';
import { MAT } from '../book.js';

const FLOOR = '#a3c267';

// The upper outline of one fir, left to right, without its trunk.
const firTop = (cx, y, h, w, tiers = 4) => fir(cx, y, h, w, tiers, 0).reverse().slice(2, -2);

const DEER = [[-2.0, 0], [-1.72, 0], [-1.6, 1.35], [-0.4, 1.5], [0.5, 1.42], [0.56, 0], [0.84, 0], [0.95, 1.5], [1.35, 1.55], [2.0, 0.95], [2.5, 0.42], [2.72, 0.5], [2.74, 0.72],
  [2.45, 1.15], [2.66, 1.55], [2.3, 1.42], [1.9, 2.0], [1.3, 2.6], [0.4, 2.62], [-1.0, 2.6], [-1.75, 2.5], [-2.05, 2.78], [-2.22, 2.5], [-2.05, 1.9], [-2.12, 1.0]];

// The rapids: the line the slot follows on the right-hand page.
const RAPIDS = smooth([[4.6, 11.6], [7.4, 10.2], [9.2, 8.0], [8.6, 5.8], [6.2, 4.4], [4.6, 2.9]], 8);

// A band of the given half width round a line.
function band(pts, half) {
  const l = [], r = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
    l.push([pts[i][0] - (dy / d) * half, pts[i][1] + (dx / d) * half]);
    r.push([pts[i][0] + (dy / d) * half, pts[i][1] - (dx / d) * half]);
  }
  return [...l, ...r.reverse()];
}

export function buildSpread2(b) {
  const { W, H } = b;
  const slot = band(RAPIDS, 0.24);

  // --- The page ---------------------------------------------------------------------------------
  // The river leaves the fold of the book, swings out over the right-hand page and comes back.
  const course = smooth([[0, 19.5], [0.2, 15], [1.6, 12.6], [4.6, 11.6], [7.4, 10.2], [9.2, 8.0], [8.6, 5.8], [6.2, 4.4], [4.6, 2.9], [2.2, 1.2], [0.4, -0.4]], 8);
  b.page(FLOOR, (c) => {
    fill(c, [[-W, 20], [-10, 22], [0, 20.5], [11, 22.4], [W, 20], [W, H], [-W, H]], tint(C.pine, 0.12));
    scatter(110, -W + 0.5, 0.5, W - 0.5, 19, 8, (x, y, i, r) => fill(c, ellipse(x, y, 0.5 + r() * 0.9, 0.22 + r() * 0.3, 10), tint(FLOOR, i % 2 ? -0.09 : 0.12)));
    stroke(c, course, tint(C.deep, -0.05), 3.3);
    stroke(c, course, C.water, 2.7);
    // white water along the rapids
    for (let i = 4; i < RAPIDS.length - 3; i += 4) {
      const p = RAPIDS[i], q = RAPIDS[i + 2];
      stroke(c, smooth([[p[0] - 0.8, p[1] + 0.25], [(p[0] + q[0]) / 2 - 0.5, (p[1] + q[1]) / 2 + 0.5], [q[0] - 0.9, q[1] + 0.1]], 4), C.foam, 0.11);
      stroke(c, smooth([[p[0] + 0.5, p[1] - 0.1], [(p[0] + q[0]) / 2 + 0.8, (p[1] + q[1]) / 2 + 0.1], [q[0] + 0.6, q[1] - 0.3]], 4), C.foam, 0.11);
    }
    for (const [x, y, r] of [[5.6, 12.6, 0.55], [10.6, 8.6, 0.7], [7.2, 6.4, 0.5], [9.6, 4.6, 0.6], [3.4, 3.4, 0.5], [6.4, 2.4, 0.6], [2.4, 13.8, 0.5]]) {
      fill(c, ellipse(x, y, r, r * 0.72, 12), C.stone); fill(c, ellipse(x - r * 0.2, y + r * 0.2, r * 0.5, r * 0.3, 10), tint(C.stone, 0.3));
    }
    for (let y = 13.5; y < 19; y += 1.6) stroke(c, smooth([[-0.5, y], [0.1, y - 0.3], [0.7, y]], 4), C.foam, 0.07);
    // ferns and toadstools on the forest floor
    scatter(34, -W + 1, 0.8, W - 1, 12, 14, (x, y, i, r) => {
      if (Math.hypot(x - 6.5, y - 7) < 5.2 || Math.abs(x) < 2.2) return;
      for (let k = -3; k <= 3; k++) line(c, x, y, x + k * 0.22, y + 0.75 - Math.abs(k) * 0.14, C.pine, 0.06);
    });
    for (const [x, y] of [[-6.5, 2.2], [-5.6, 1.7], [14.5, 3.2], [15.3, 2.6], [-17, 9.4], [19.2, 9]]) {
      line(c, x, y, x, y + 0.45, C.cream, 0.16);
      fill(c, ellipse(x, y + 0.5, 0.38, 0.3, 12, 0, Math.PI), C.red);
      disc(c, x - 0.12, y + 0.62, 0.05, C.snow); disc(c, x + 0.14, y + 0.6, 0.05, C.snow);
    }
    textBlock(c, STORY[2], -22.6, 4.15, 0.86, 15.5, { colour: C.dusk });
    text(c, '2', -23.2, 0.7, 0.5, { colour: tint(C.dusk, 0.25) });
    text(c, 'slide the boat', 12.3, 6.3, 0.42, { colour: C.dusk, italic: true, rot: -0.2 });
  }, [slot]);

  // --- Slider: the boat on a button through the slot ----------------------------------------------
  b.part({ on: b.R, z: [-0.055, -0.04], shape: band(RAPIDS, 0.7), color: C.navy, hasRim: false, hasBack: false, hasWalls: false, mat: MAT.BOARD });
  const slider = b.control({ type: 'slider', parent: b.R, path: RAPIDS, radius: 1.5, value: 0.06, name: 'Slider', demo: [0.06, 0.95, 0.95, 0.06] });
  const boat = b.planar(b.R, () => {
    const f = Math.max(0, Math.min(1, slider.value)) * (RAPIDS.length - 1), i = Math.min(RAPIDS.length - 2, Math.floor(f)), u = f - i;
    const p = RAPIDS[i], q = RAPIDS[i + 1];
    return { x: p[0] + (q[0] - p[0]) * u, y: p[1] + (q[1] - p[1]) * u, rot: Math.atan2(q[1] - p[1], q[0] - p[0]) * 0.5 + 0.75 };
  });
  b.part({ on: boat, z: [-0.04, 0.03], shape: ellipse(0, 0, 0.2, 0.2, 10), color: C.white, hasRim: false });
  b.part({ on: boat, z: [0.03, 0.075], shape: boatHull(0, -0.45, 2.3), color: C.red });
  b.part({ on: boat, z: [0.075, 0.12], shape: boatSail(0, -0.47, 2.3), color: C.snow });
  b.label(b.R, [9.6, 6.6, 0.2], 'Slider');

  // --- The fir wall -----------------------------------------------------------------------------------
  const far = b.vfold({ y: 19.5, alpha: 110, beta: 93, span: [-21, 21], labelY: 8 });
  const firs = [[-19.6, 6.2, 3.2], [-17, 9.4, 3.8], [-14.2, 7.6, 3.4], [-11.4, 11.6, 4.2], [-8.4, 9.0, 3.6], [-5.6, 12.6, 4.2], [-2.8, 8.2, 3.2],
    [2.6, 8.6, 3.2], [5.4, 12.2, 4.2], [8.4, 9.6, 3.6], [11.2, 13.0, 4.4], [14.2, 8.8, 3.6], [17, 10.2, 3.8], [19.6, 6.4, 3.2]];
  const top = [[-21, 2.6]];
  for (const [x, h] of firs) top.push(...firTop(x, h * 0.36, h * 0.64, 2.6, 4));   // 2.6 wide: firs must not overlap, or the outline crosses itself
  top.push([21, 2.6]);
  // dip the wall low over the stream
  const gap = top.findIndex((p) => p[0] > -1.4);
  top.splice(gap, 0, [-1.1, 3.2], [0, 2.8], [1.1, 3.2]);
  b.part({
    on: far, shape: standing(top, b.base(far)), color: C.dusk, screen: (x, y) => 0.55 - y * 0.045, ink: C.navy,
    print: (c) => {
      for (const [x, h, w] of firs) for (let k = 0; k < 4; k++) line(c, x - w * 0.16, h * (0.42 + k * 0.13), x + w * 0.1, h * (0.38 + k * 0.13), tint(C.dusk, 0.2), 0.08);
      for (const [x, h] of firs) line(c, x, -1.5, x, h * 0.34, tint(C.bark, -0.2), 0.3);
    },
  });
  // an owl looking out between the trees
  b.part({ on: far.B, level: 1, shape: smooth([[6.3, 3.0], [6.2, 4.2], [6.5, 4.9], [6.9, 4.6], [7.3, 4.9], [7.6, 4.2], [7.5, 3.0], [6.9, 2.7]], 4, true), color: C.cream,
    print: (c) => { disc(c, 6.62, 4.2, 0.26, C.sun); disc(c, 7.18, 4.2, 0.26, C.sun); disc(c, 6.62, 4.2, 0.11, C.ink); disc(c, 7.18, 4.2, 0.11, C.ink); fill(c, [[6.8, 3.95], [7.0, 3.95], [6.9, 3.7]], C.orange); for (let k = 0; k < 3; k++) stroke(c, smooth([[6.5, 3.4 - k * 0.2], [6.7, 3.3 - k * 0.2], [6.9, 3.4 - k * 0.2], [7.1, 3.3 - k * 0.2], [7.3, 3.4 - k * 0.2]], 3), C.brown, 0.05); } });

  // --- Broadleaf trees, nearer -----------------------------------------------------------------------------
  const near = b.vfold({ y: 13.5, alpha: 110, beta: 93, span: [-19.5, 19.5], label: false });
  const bank = smooth([[-19.5, 1.2], [-15, 2.3], [-9, 2.8], [-4, 2.0], [-1.5, 1.2], [0, 1.0], [1.5, 1.2], [5, 2.2], [10, 3.0], [15, 2.4], [19.5, 1.2]], 6);
  b.part({ on: near, shape: standing(bank, b.base(near)), color: C.leaf, print: (c) => scatter(90, -19, -0.6, 19, 2.6, 6, (x, y) => { line(c, x, y, x + 0.05, y + 0.34, C.pine, 0.05); line(c, x + 0.14, y, x + 0.2, y + 0.26, C.pine, 0.05); }) });
  const broad = [['A', -15.4, 1.6, 7.6, 5.2, C.leaf, 1], ['A', -10.2, 2.2, 8.8, 5.8, C.moss, 2], ['A', -5.2, 1.7, 6.4, 4.2, C.leaf, 3], ['B', 5.6, 1.8, 6.8, 4.4, C.moss, 4], ['B', 10.8, 2.4, 9.0, 6.0, C.leaf, 5], ['B', 16, 1.8, 7.2, 4.8, C.moss, 6]];
  for (const [side, x, y, h, w, col, seed] of broad) {
    b.part({ on: near[side], level: seed % 2 ? 1 : 2, shape: tree(x, y, h, w, 7, seed), color: tint(col, -0.08),
      print: (c) => {
        fill(c, [[x - w * 0.07, y - 0.1], [x + w * 0.07, y - 0.1], [x + w * 0.05, y + h * 0.5], [x + w * 0.2, y + h * 0.66], [x + w * 0.02, y + h * 0.6], [x - w * 0.16, y + h * 0.7], [x - w * 0.05, y + h * 0.48]], C.bark);
        scatter(26, x - w * 0.42, y + h * 0.42, x + w * 0.42, y + h * 0.92, seed, (px, py, i) => fill(c, ellipse(px, py, 0.3, 0.17, 8), tint(col, i % 2 ? 0.2 : -0.28)));
      } });
  }

  // --- Layers: a deer come to drink, and a fallen trunk --------------------------------------------------------
  const drink = b.layer(near, 'A', { r: 10.5, a: 3.4, b: 2.2, w: 1.6, x0: -3, x1: 3, strut: C.leaf });
  b.part({ on: drink.stand, color: C.moss, shape: smooth([[-4.2, 0], [-3.6, 1.0], [-1.5, 1.5], [1.2, 1.2], [3.6, 0.8], [4.4, 0]], 5), print: (c) => scatter(30, -3.8, 0.1, 3.8, 1.2, 3, (x, y) => line(c, x, y, x + 0.06, y + 0.3, C.pine, 0.05)) });
  b.part({ on: drink.stand, level: 1, shape: shift(DEER, 0.2, 0.9), color: C.ochre,
    print: (c) => { for (const [x, y] of [[-1.2, 2.2], [-0.6, 2.4], [0, 2.15], [0.6, 2.4], [-0.9, 1.85], [-0.2, 1.8], [1.0, 2.1]]) disc(c, x + 0.2, y + 0.9, 0.09, C.cream); disc(c, 2.62, 1.72, 0.06, C.ink); fill(c, [[-1.85, 3.4], [-1.7, 3.62], [-2.02, 3.62]], C.snow); } });

  const log = b.layer(near, 'B', { r: 13, a: 3.2, b: 1.6, w: 1.6, x0: -3, x1: 3, strut: C.brown });
  b.part({ on: log.stand, color: C.brown, shape: [[-4.4, 0], [-4.4, 1.5], [-4.0, 1.9], [3.2, 1.9], [3.6, 2.3], [4.1, 2.9], [4.4, 2.7], [4.0, 2.0], [4.4, 1.5], [4.4, 0]],
    print: (c) => { fill(c, ellipse(-3.6, 0.95, 0.75, 0.85, 16), C.sand); stroke(c, ellipse(-3.6, 0.95, 0.45, 0.52, 14), C.brown, 0.05, true); stroke(c, ellipse(-3.6, 0.95, 0.2, 0.24, 10), C.brown, 0.05, true); for (let x = -2.4; x < 4; x += 0.9) line(c, x, 0.3 + (x * 7 % 1) * 0.5, x + 0.5, 0.35 + (x * 7 % 1) * 0.5, C.bark, 0.06); fill(c, smooth([[-1.6, 1.9], [-0.8, 1.6], [0.6, 1.7], [1.4, 1.9]], 4), C.moss); } });
  b.part({ on: log.stand, level: 1, shape: fir(2.6, 1.9, 4.6, 2.4, 4), color: C.pine });
  // a red squirrel on the trunk
  b.part({ on: log.stand, level: 1, color: C.orange,
    shape: smooth([[-1.2, 1.9], [-1.25, 2.5], [-0.9, 2.95], [-0.95, 3.3], [-0.7, 3.15], [-0.45, 3.3], [-0.45, 2.9], [-0.3, 2.6], [-0.35, 2.2], [0.1, 2.4], [0.55, 3.0], [0.4, 3.7], [0.8, 3.4], [0.95, 2.7], [0.6, 2.05], [0.1, 1.9]], 3, true),
    print: (c) => { disc(c, -0.62, 3.0, 0.05, C.ink); } });
}
