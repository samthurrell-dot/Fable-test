// src/spreads/s1.js
// Spread 1, the hills. Two V-folds (far peaks with the sun behind, near hills with firs), a layer on
// each side held by a parallelogram, and a pull tab that sends the boat and the water down a channel.

import { C, tint, rect, rrect, ellipse, smooth, shift, fir, standing, boatHull, boatSail, fill, stroke, disc, line, text, textBlock, scatter } from '../art.js';
import { MAT } from '../book.js';

export const STORY_1 = 'High in the hills the snow let go, and a stream was born. On it sat a boat, folded from a single page.';

const TAB_TRAVEL = 6;   // cm the pull tab slides

// A snow cap: the top of a peak down to a zigzag hem.
function cap(peak, l, r, teeth = 3) {
  const out = [l, peak, r];
  for (let i = 1; i < teeth * 2; i++) {
    const t = i / (teeth * 2);
    out.push([r[0] + (l[0] - r[0]) * t, r[1] + (l[1] - r[1]) * t + (i % 2 ? 0.55 : -0.25)]);
  }
  return out;
}

function cloud(cx, cy, w, h) {
  return smooth([[cx - w * 0.5, cy], [cx - w * 0.36, cy + h * 0.55], [cx - w * 0.12, cy + h * 0.62], [cx + 0.02 * w, cy + h], [cx + w * 0.24, cy + h * 0.7],
    [cx + w * 0.42, cy + h * 0.5], [cx + w * 0.5, cy + h * 0.05], [cx + w * 0.2, cy - h * 0.12], [cx - w * 0.25, cy - h * 0.1]], 5, true);
}

const IBEX = [[-1.3, 0], [-1.08, 0], [-0.98, 0.9], [-0.2, 0.98], [0.42, 0.95], [0.5, 0], [0.72, 0], [0.78, 1.0], [1.02, 1.4], [1.14, 1.92], [1.58, 1.96], [1.62, 2.12],
  [1.26, 2.34], [1.1, 2.33], [1.0, 2.9], [0.62, 3.2], [0.34, 3.12], [0.52, 3.02], [0.8, 2.78], [0.84, 2.34], [0.6, 2.06], [0.3, 1.68], [-0.9, 1.72], [-1.36, 1.5], [-1.52, 1.08], [-1.4, 1.04], [-1.22, 1.3]];

export function buildSpread1(b) {
  const { W, H } = b;
  const river = (y) => 0.5 + (18.3 - y) * 0.11;   // half width of the stream at page height y

  // --- The page ---------------------------------------------------------------------------------
  const channel = rrect(5.0, 3.6, 7.5, 11.2, 1.1, 5);
  b.page(C.meadow, (c) => {
    // paler ground far off, behind the peaks
    fill(c, [[-W, 19], [-8, 21.5], [0, 20], [9, 21.8], [W, 19.4], [W, H], [-W, H]], tint(C.meadow, 0.35));
    scatter(260, -W + 0.6, 0.6, W - 0.6, H - 0.6, 3, (x, y, i, r) => {
      if (Math.abs(x) < river(y) + 0.8) return;
      const s = 0.1 + r() * 0.1;
      line(c, x, y, x + (r() - 0.5) * 0.14, y + 0.3 + s, tint(C.moss, -0.1), 0.045);
      line(c, x + 0.12, y, x + 0.2, y + 0.24 + s, tint(C.moss, -0.1), 0.045);
    });
    scatter(70, -W + 1, 0.8, W - 1, 14, 11, (x, y, i) => {
      if (Math.abs(x) < river(y) + 1) return;
      disc(c, x, y, 0.13, i % 3 ? C.snow : C.rose);
      disc(c, x, y, 0.045, C.sun);
    });
    // the stream down the fold of the book
    const bank = [];
    for (let y = 18.3; y >= -0.2; y -= 0.5) bank.push([river(y) + 0.12 * Math.sin(y * 1.9), y]);
    const riverShape = [...bank, ...bank.map(([x, y]) => [-x + 0.2 * Math.sin(y * 1.3), y]).reverse()];
    fill(c, riverShape, C.water);
    for (let y = 1; y < 18; y += 1.7) stroke(c, smooth([[-river(y) * 0.5, y], [0, y - 0.35], [river(y) * 0.5, y + 0.05]], 5), C.foam, 0.07);
    // the side stream that the channel sits in, and where it joins
    const side = smooth([[6.3, 13.4], [6.2, 11], [6.25, 3.6], [5.4, 1.8], [2.6, 0.6], [1.2, -0.2]], 8);
    stroke(c, side, C.water, 2.2);
    stroke(c, rrect(5.0, 3.6, 7.5, 11.2, 1.1, 5), tint(C.moss, -0.25), 0.1, true);
    scatter(26, 3.6, 1.2, 9.4, 12.4, 5, (x, y, i, r) => { if (Math.abs(x - 6.25) > 1.7 && Math.abs(x - 6.25) < 2.6) disc(c, x, y, 0.16 + r() * 0.14, i % 2 ? C.stone : tint(C.stone, 0.3)); });
    // the words
    textBlock(c, STORY_1, -22.6, 4.15, 0.86, 16.5, { colour: C.pine, weight: 500 });
    text(c, '1', -23.2, 0.7, 0.5, { colour: tint(C.pine, 0.25), align: 'left' });
    // pull mark by the tab
    text(c, 'pull', 6.25, 0.55, 0.42, { colour: C.pine, italic: true, align: 'center' });
  }, [channel]);

  // --- Pull tab: a strip under the page; the boat rides on it through the channel ----------------
  const tab = b.control({ type: 'tab', parent: b.R, axis: [0, -1], travel: TAB_TRAVEL, at: [6.25, -0.9], radius: 1.7, name: 'Pull tab', demo: [0, 1, 1, 0] });
  const strip = b.planar(b.R, () => ({ y: -tab.value * TAB_TRAVEL }));
  const boatY = 9.6;
  b.part({
    on: strip, z: [-0.045, -0.02], color: C.water, hasRim: false, mat: MAT.BOARD, sticksOut: true,
    shape: [[5.15, -1.4], [5.65, -1.9], [6.85, -1.9], [7.35, -1.4], [7.35, 17.6], [5.15, 17.6]],
    print: (c) => {
      fill(c, rect(4.9, -2.2, 7.6, boatY - 0.9), tint(C.sand, 0.1));
      scatter(60, 5.2, 0.6, 7.3, boatY - 1.2, 9, (x, y, i, r) => disc(c, x, y, 0.1 + r() * 0.1, i % 2 ? C.stone : tint(C.stone, 0.35)));
      fill(c, smooth([[4.9, boatY - 0.9], [5.6, boatY - 1.3], [6.4, boatY - 0.8], [7.6, boatY - 1.2], [7.6, 18], [4.9, 18]], 4), C.water);
      for (let y = boatY; y < 17.5; y += 1.25) stroke(c, smooth([[5.5, y], [6.25, y - 0.3], [7.0, y]], 4), C.foam, 0.07);
      // the handle
      fill(c, rect(4.9, -2.2, 7.6, 0.02), C.cream);
      stroke(c, [[6.25, -0.35], [6.25, -1.35]], C.red, 0.14);
      fill(c, [[5.85, -1.1], [6.65, -1.1], [6.25, -1.65]], C.red);
    },
  });
  b.part({ on: strip, z: [-0.02, 0.045], shape: shift(boatHull(0, 0, 1.9), 6.25, boatY - 0.5), color: C.red, hasRim: true });
  b.part({ on: strip, z: [0.045, 0.09], shape: shift(boatSail(0, 0, 1.9), 6.25, boatY - 0.52), color: C.snow });
  b.label(b.R, [8.4, 2.2, 0.2], 'Pull tab');

  // --- Far peaks, with the sun rising behind them ---------------------------------------------------
  const far = b.vfold({ y: 18.3, alpha: 110, beta: 93, span: [-21, 21], labelY: 9 });
  const peaks = [[-21, 2.4], [-18.2, 6.6], [-15.6, 5.1], [-12, 10.6], [-9.6, 8.5], [-7, 12.3], [-4.2, 7.4], [-2, 5.9], [0, 5.0], [2.4, 6.3], [5, 9.9], [7.4, 8.1], [10.5, 12.9], [13.4, 8.4], [16, 9.7], [19, 5], [21, 2.4]];
  b.part({
    on: far, shape: standing(peaks, b.base(far)), color: C.slate,
    screen: (x, y) => 0.5 - y * 0.05, ink: C.navy,
    print: (c) => {
      // bands of rock on the sunlit sides
      for (const [px, py, w] of [[-12, 10.6, 3.2], [-7, 12.3, 3.6], [5, 9.9, 3], [10.5, 12.9, 3.8], [16, 9.7, 2.6], [-18.2, 6.6, 2.2]]) {
        fill(c, [[px, py], [px + w * 0.9, py - w * 1.5], [px + w * 0.25, py - w * 1.75], [px - w * 0.1, py - w * 0.9]], tint(C.slate, 0.16));
      }
      scatter(90, -20, 0.4, 20, 7, 21, (x, y, i, r) => line(c, x, y, x + 0.5 + r() * 0.6, y + 0.12, tint(C.slate, -0.22), 0.05));
    },
  });
  b.part({ on: far, level: -1, noCrease: true, shape: ellipse(0, 7.6, 4.2, 4.2, 40), color: C.sun, back: C.sun, print: (c) => { disc(c, 0, 7.6, 3.2, tint(C.sun, 0.22)); } });
  for (const [side, peak, l, r] of [['A', [-12, 10.6], [-13.4, 8.6], [-10.9, 9.3]], ['A', [-7, 12.3], [-8.6, 9.6], [-5.6, 10.0]], ['A', [-18.2, 6.6], [-19.1, 5.3], [-17.2, 5.9]],
    ['B', [5, 9.9], [3.8, 8.2], [6.3, 8.9]], ['B', [10.5, 12.9], [8.9, 10.2], [12.1, 10.4]], ['B', [16, 9.7], [14.9, 8.9], [17.3, 7.9]]]) {
    b.part({ on: far[side], level: 1, shape: cap(peak, l, r), color: C.snow });
  }
  b.part({ on: far.A, level: 2, shape: cloud(-14.6, 9.2, 5.6, 1.9), color: C.snow });
  b.part({ on: far.B, level: 2, shape: cloud(14.2, 10.6, 4.8, 1.6), color: C.snow });

  // --- Near hills -------------------------------------------------------------------------------------
  const near = b.vfold({ y: 13.5, alpha: 110, beta: 93, span: [-19.5, 19.5], label: false });
  const hills = smooth([[-19.5, 1.7], [-16, 4.3], [-11, 5.7], [-6, 4.0], [-2.5, 2.5], [0, 2.1], [3, 2.9], [7, 5.1], [12, 6.2], [16, 4.3], [19.5, 1.8]], 6);
  b.part({
    on: near, shape: standing(hills, b.base(near)), color: C.leaf,
    print: (c) => {
      fill(c, smooth([[-20, -1.5], [-16, 1.6], [-11, 2.6], [-5, 1.2], [0, 0.3], [6, 1.9], [12, 3.0], [17, 1.4], [20, -1.5]], 6), C.moss);
      scatter(120, -19, -0.6, 19, 5.4, 4, (x, y, i, r) => { line(c, x, y, x + 0.05, y + 0.32, C.pine, 0.05); line(c, x + 0.13, y, x + 0.2, y + 0.26, C.pine, 0.05); });
    },
  });
  for (const [side, x, y, h, w] of [['A', -13.2, 3.6, 5.6, 2.9], ['A', -10.6, 4.2, 4.2, 2.3], ['A', -15.6, 3.0, 3.6, 2.0], ['B', 9.6, 4.4, 5.9, 3.0], ['B', 12.6, 4.6, 4.4, 2.4], ['B', 15.2, 3.4, 3.6, 2.0], ['B', 5.4, 2.6, 3.2, 1.8]]) {
    b.part({ on: near[side], level: 1, shape: fir(x, y, h, w, 4), color: C.pine, print: (c) => { for (let i = 0; i < 3; i++) line(c, x - w * 0.2 + i * w * 0.12, y + h * (0.3 + i * 0.18), x + w * 0.05 + i * w * 0.1, y + h * (0.26 + i * 0.18), tint(C.pine, 0.2), 0.07); } });
  }

  // --- A layer each side, standing clear of the hills ---------------------------------------------------
  const rocks = b.layer(near, 'A', { r: 12.5, a: 2.8, b: 2.4, w: 1.6, x0: -3.2, x1: 3.2, strut: C.stone });
  b.part({
    on: rocks.stand, color: C.stone,
    shape: [[-4.2, 0], [-3.8, 1.5], [-2.6, 2.9], [-1.3, 3.2], [-0.2, 2.5], [0.9, 3.0], [2.4, 2.4], [3.6, 1.3], [4.2, 0]],
    print: (c) => { fill(c, [[-3.8, 1.5], [-2.6, 2.9], [-1.3, 3.2], [-1.9, 1.6], [-3.0, 0.5]], tint(C.stone, 0.22)); fill(c, [[0.9, 3.0], [2.4, 2.4], [1.6, 1.1], [0.6, 1.7]], tint(C.stone, 0.22)); scatter(18, -3.6, 0.2, 3.6, 1.6, 2, (x, y) => line(c, x, y, x + 0.5, y + 0.1, tint(C.stone, -0.25), 0.05)); },
  });
  b.part({ on: rocks.stand, level: 1, shape: shift(IBEX, -1.5, 3.0), color: C.brown });

  const hut = b.layer(near, 'B', { r: 14.2, a: 2.8, b: 2.4, w: 1.6, x0: -3, x1: 3, strut: C.leaf });
  b.part({ on: hut.stand, color: C.moss, shape: smooth([[-4, 0], [-3.4, 1.3], [-1.2, 1.9], [1.4, 1.6], [3.4, 1.0], [4, 0]], 5), print: (c) => scatter(30, -3.6, 0.1, 3.6, 1.5, 7, (x, y) => line(c, x, y, x + 0.06, y + 0.3, C.pine, 0.05)) });
  b.part({
    on: hut.stand, level: 1, color: C.ochre, shape: [[-2.4, 1.3], [0.4, 1.3], [0.4, 3.0], [-1.0, 4.2], [-2.4, 3.0]],
    print: (c) => { fill(c, rect(-1.5, 1.3, -0.7, 2.6), C.bark); fill(c, rect(-0.35, 2.0, 0.15, 2.6), C.navy); for (let y = 1.7; y < 3; y += 0.42) line(c, -2.4, y, 0.4, y, tint(C.ochre, -0.2), 0.04); },
  });
  b.part({ on: hut.stand, level: 2, color: C.brick, shape: [[-2.9, 2.9], [-1.0, 4.6], [0.9, 2.9], [0.5, 2.6], [-1.0, 3.95], [-2.5, 2.6]] });
  b.part({ on: hut.stand, level: 1, shape: fir(2.2, 1.2, 4.2, 2.2, 4), color: C.pine });
}
