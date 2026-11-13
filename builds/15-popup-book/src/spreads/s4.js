// src/spreads/s4.js
// Spread 4, the marsh at dusk. A floating layer: the water's surface stands clear of the page, with
// windows cut in it so the fish below can be seen. Reeds on parallelogram layers before a low far
// bank (V-fold). A pull tab at the page edge works two levers: the heron strikes and a fish leaps.

import { C, tint, rect, rrect, ellipse, smooth, shift, turn, standing, boatHull, boatSail, fill, stroke, disc, line, box, text, textBlock, scatter } from '../art.js';
import { STORY } from '../story.js';
import { MAT } from '../book.js';

const WATER = '#3b878d', SURFACE = '#67b5b1', REED = '#6a8a3c';
const TAB_TRAVEL = 3;        // cm the tab pulls out
const NECK_SWING = 1.32;     // radians the heron's neck turns
const FISH_SWING = 2.0;      // radians the fish's arm turns

const blob = (cx, cy, rx, ry, seed) => smooth(ellipse(cx, cy, rx, ry, 9).map(([x, y], i) => [x + Math.sin(i * 2.3 + seed) * rx * 0.14, y + Math.cos(i * 1.7 + seed) * ry * 0.14]), 4, true);
const pad = (cx, cy, r, a) => turn([...ellipse(cx, cy, r, r * 0.82, 18, 0.35, Math.PI * 2 - 0.35), [cx + r * 0.1, cy]], a, cx, cy);
const flower = (cx, cy, r) => { const out = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; out.push([cx + Math.cos(a) * r * (i % 2 ? 0.45 : 1), cy + Math.sin(a) * r * (i % 2 ? 0.45 : 1)]); } return out; };
const FISH = smooth([[-1.0, 0], [-0.4, 0.42], [0.45, 0.3], [0.85, 0.05], [1.35, 0.4], [1.25, 0], [1.35, -0.4], [0.85, -0.05], [0.45, -0.3], [-0.4, -0.42]], 4, true);

// A clump of reeds: blades as one spiky outline. spikes: [x, height, lean]
function clump(x0, x1, spikes) {
  const out = [[x0, 0]];
  const w = (x1 - x0) / spikes.length;
  spikes.forEach(([h, lean], i) => { const x = x0 + w * i; out.push([x + w * 0.12, h * 0.25], [x + w * 0.5 + lean, h], [x + w * 0.88, h * 0.3]); });
  out.push([x1, 0]);
  return out;
}

export function buildSpread4(b) {
  const { W, H } = b;

  // --- The page: the bed of the marsh ---------------------------------------------------------------
  b.page(WATER, (c) => {
    fill(c, [[-W, 20.5], [-9, 22], [0, 21], [10, 22.2], [W, 20.4], [W, H], [-W, H]], tint(C.violet, 0.1));
    // bands of slow water
    for (let y = 0.8; y < 20; y += 1.5) for (let x = -W + (y * 7 % 5); x < W; x += 9 + (y * 3 % 4)) stroke(c, smooth([[x, y], [x + 1.6, y + 0.22], [x + 3.4, y], [x + 5, y + 0.2]], 4), tint(WATER, 0.2), 0.09);
    // the low sun lying on the water
    for (let y = 14.5; y < 20; y += 0.7) line(c, -7.5 - (20 - y) * 0.25 + Math.sin(y * 3) * 0.5, y, -4.5 + (20 - y) * 0.25 + Math.sin(y * 5) * 0.5, y, tint(C.orange, 0.2), 0.16);
    // the deep under the floating layer, and the fish in it
    fill(c, rrect(-9.3, 4.7, 9.3, 13.3, 1, 4), tint(WATER, -0.3));
    for (const [x, y, a, s, col] of [[-5.2, 9.2, 0.3, 1.25, C.orange], [-4.0, 6.3, -0.2, 0.8, C.sun], [4.4, 7.8, 2.9, 1.3, C.orange], [5.6, 11.3, 3.4, 0.85, C.rose], [-6.6, 11.6, 0.9, 0.7, C.sun], [2.6, 10.4, 2.6, 0.7, C.sun]]) {
      fill(c, turn(FISH.map(([px, py]) => [x + px * s, y + py * s]), a, x, y), col);
      disc(c, x - Math.cos(a) * 0.62 * s, y - Math.sin(a) * 0.62 * s + 0.08, 0.06 * s, C.ink);
    }
    // muddy banks down the outer edges
    fill(c, smooth([[-W, -0.5], [-18.5, 0.5], [-20, 6], [-18.6, 12], [-20.5, 17], [-19, 21], [-W, 21.5]], 5), tint(REED, -0.25));
    fill(c, smooth([[W, -0.5], [23.6, 1], [22.2, 4], [23.4, 11], [21.4, 15], [22.6, 21], [W, 21.5]], 5), tint(REED, -0.25));
    scatter(80, -W + 0.3, 0.5, -19.5, 20, 6, (x, y) => line(c, x, y, x + 0.1, y + 0.7, REED, 0.07));
    scatter(40, 22.6, 12, W - 0.3, 20, 9, (x, y) => line(c, x, y, x + 0.1, y + 0.7, REED, 0.07));
    // the heron's legs, standing in the shallows
    line(c, 18.9, 5.8, 18.2, 1.3, C.ink, 0.12); line(c, 20.0, 5.7, 20.1, 1.2, C.ink, 0.12);
    for (const [x, y] of [[18.2, 1.3], [20.1, 1.2]]) { stroke(c, ellipse(x, y, 0.7, 0.24, 14), tint(WATER, 0.3), 0.06, true); stroke(c, ellipse(x, y, 1.15, 0.4, 14), tint(WATER, 0.22), 0.05, true); }
    textBlock(c, STORY[4], -22.2, 3.6, 0.86, 16, { colour: C.cream });
    text(c, '4', -23.2, 0.7, 0.5, { colour: tint(WATER, 0.45) });
    text(c, 'pull', 23.2, 4.3, 0.42, { colour: C.cream, italic: true, align: 'center' });
  });

  // --- Pull tab and its two levers ----------------------------------------------------------------------
  const tab = b.control({ type: 'tab', parent: b.R, axis: [1, 0], travel: TAB_TRAVEL, at: [W + 0.9, 6.0], radius: 1.7, name: 'Pull tab', demo: [0, 1, 0, 1, 0] });
  const strip = b.planar(b.R, () => ({ x: tab.value * TAB_TRAVEL }));
  b.part({ on: strip, z: [-0.045, -0.02], shape: [[16, 5.2], [W + 1.3, 5.2], [W + 1.8, 5.6], [W + 1.8, 6.4], [W + 1.3, 6.8], [16, 6.8]], color: C.cream, hasRim: false, mat: MAT.BOARD, sticksOut: true,
    print: (c) => { line(c, W + 0.2, 6, W + 1.2, 6, C.red, 0.14); fill(c, [[W + 1.0, 5.6], [W + 1.0, 6.4], [W + 1.55, 6]], C.red); } });
  b.label(b.R, [23.4, 6.1, 0.2], 'Pull tab');

  // The fish: an arm on a rivet, hidden under a clump of pads until the tab is pulled.
  const FX = 12.3, FY = 4.9;
  const fish = b.planar(b.R, () => ({ x: FX, y: FY, rot: -1.25 + tab.value * FISH_SWING }));
  // the arm is the splash the fish leaves; the fish is at its end
  b.part({ on: fish, level: 1, color: C.orange,
    shape: smooth([[0, 0.14], [1.1, 0.3], [1.9, 0.52], [3.15, 0.38], [3.75, 0.06], [4.4, 0.5], [4.28, 0], [4.4, -0.5], [3.75, -0.06], [3.15, -0.38], [1.9, -0.52], [1.1, -0.3], [0, -0.14]], 4, true),
    print: (c) => { fill(c, smooth([[0, 0.14], [1.1, 0.3], [1.9, 0.52], [1.75, 0], [1.9, -0.52], [1.1, -0.3], [0, -0.14]], 4, true), C.foam); disc(c, 2.3, 0.14, 0.09, C.ink); for (const x of [2.7, 3.0, 3.3]) stroke(c, smooth([[x, 0.3], [x + 0.14, 0], [x, -0.3]], 3), tint(C.orange, -0.25), 0.05); } });
  b.part({ on: b.R, level: 2, shape: pad(13.3, 2.9, 1.9, 0.6), color: C.leaf, print: (c) => { for (let i = 0; i < 7; i++) { const a = 0.9 + i * 0.75; line(c, 13.3, 2.9, 13.3 + Math.cos(a) * 1.7, 2.9 + Math.sin(a) * 1.4, tint(C.leaf, -0.22), 0.05); } } });
  b.part({ on: b.R, level: 3, shape: pad(14.6, 4.1, 1.25, 2.4), color: C.moss });
  b.part({ on: b.R, level: 4, shape: flower(13.9, 3.2, 0.62), color: C.rose, print: (c) => disc(c, 13.9, 3.2, 0.18, C.sun) });

  // The heron: body glued down, neck and head on a rivet at the shoulder.
  const NX = 17.4, NY = 7.6;
  b.part({ on: b.R, level: 1, color: C.stone, shape: shift(smooth([[15.8, 9.4], [16.4, 7.6], [18.6, 6.9], [21.2, 7.4], [23.3, 6.6], [22.6, 8.0], [21.0, 9.4], [19.0, 10.2], [17.0, 10.3]], 5, true), 0.5, -1.6) });
  const neck = b.planar(b.R, () => ({ x: NX, y: NY, rot: tab.value * NECK_SWING }));
  b.part({ on: neck, level: 2, color: C.snow,
    shape: smooth([[0.5, -0.6], [0.75, 0.5], [0.1, 1.9], [-0.75, 3.0], [-0.55, 4.0], [-0.1, 4.55], [-0.75, 5.0], [-1.5, 4.75], [-3.9, 4.25], [-1.55, 4.2], [-1.3, 3.6], [-1.6, 2.7], [-0.95, 1.4], [-0.5, 0.2], [-0.5, -0.6]], 4, true),
    print: (c) => { fill(c, [[-1.5, 4.72], [-3.9, 4.25], [-1.55, 4.3]], C.sun); disc(c, -1.0, 4.55, 0.09, C.ink); stroke(c, smooth([[-0.4, 4.8], [0.3, 4.9], [1.0, 4.5]], 3), C.navy, 0.12); for (const y of [1.2, 1.8, 2.4]) line(c, -0.6, y, -0.3, y - 0.25, C.slate, 0.05); } });
  b.part({ on: b.R, level: 3, color: C.slate, shape: shift(smooth([[16.4, 9.0], [17.4, 7.9], [19.6, 7.5], [22.4, 7.6], [20.6, 8.9], [18.4, 9.7], [16.9, 9.9]], 5, true), 0.5, -1.6),
    print: (c) => { for (let i = 0; i < 5; i++) stroke(c, smooth([[18.1 + i * 0.8, 7.7 - i * 0.12], [19.1 + i * 0.8, 6.9 - i * 0.1], [20.3 + i * 0.7, 6.4 - i * 0.04]], 3), tint(C.slate, -0.25), 0.06); } });

  // --- The far bank, with the sun going down behind it -----------------------------------------------------
  const far = b.vfold({ y: 19.5, alpha: 110, beta: 93, span: [-21, 21], labelY: 5 });
  const skyline = [[-21, 1.8], ...smooth([[-20.4, 3.0], [-18, 4.4], [-16.2, 4.0]], 4), [-15.6, 4.2], [-15.2, 8.2], [-14.6, 8.8], [-14.0, 8.2], [-13.6, 4.2],
    ...smooth([[-13, 4.4], [-10, 5.6], [-6, 4.6], [-3, 3.4], [0, 3.0], [3, 3.6], [6, 5.0], [8, 4.6]], 4), [8.4, 4.8], [8.8, 9.2], [9.5, 10.0], [10.2, 9.2], [10.6, 4.8],
    ...smooth([[11, 4.6], [14, 5.6], [17.6, 4.2], [20.4, 3.0]], 4), [21, 1.8]];
  b.part({ on: far, shape: standing(skyline, b.base(far)), color: C.violet, screen: (x, y) => 0.6 - y * 0.1, ink: C.navy,
    print: (c) => { for (const [x, w, h] of [[-17.5, 3, 2.4], [-9.5, 5, 3.4], [5.5, 4, 3.0], [15, 5, 3.2]]) fill(c, smooth([[x - w, -1.5], [x - w * 0.6, h * 0.6], [x - w * 0.1, h], [x + w * 0.5, h * 0.7], [x + w, -1.5]], 5), tint(C.violet, -0.3)); for (let x = -20; x < 20; x += 1.3) line(c, x, -1.2, x + 0.15, 0.4 + ((x * 3) % 1), REED, 0.07); } });
  b.part({ on: far.A, level: -1, shape: ellipse(-6.4, 5.6, 4.3, 4.3, 40), color: C.orange, back: C.orange, print: (c) => { disc(c, -6.4, 5.6, 3.3, tint(C.orange, 0.2)); } });
  b.part({ on: far.B, level: -2, color: tint(C.mauve, 0.35), back: tint(C.mauve, 0.35), shape: blob(10.6, 9.6, 5.4, 0.95, 2) });
  for (const [x, y, s] of [[12.6, 10.9, 1], [14.3, 11.6, 0.8], [11.2, 11.8, 0.7]]) {
    b.part({ on: far.B, level: -1, color: C.ink, back: C.ink, shape: [[x - 1.0 * s, y + 0.25 * s], [x - 0.5 * s, y + 0.55 * s], [x, y + 0.1 * s], [x + 0.5 * s, y + 0.55 * s], [x + 1.0 * s, y + 0.25 * s], [x + 0.5 * s, y + 0.3 * s], [x, y - 0.25 * s], [x - 0.5 * s, y + 0.3 * s]] });
  }

  // --- Reeds on layers each side -----------------------------------------------------------------------------
  const left = b.layer(far, 'A', { r: 14.5, a: 4.2, b: 3.0, w: 1.6, x0: -3, x1: 3, strut: REED });
  b.part({ on: left.stand, color: REED, shape: clump(-4.6, 4.6, [[4.6, -0.3], [7.4, 0.2], [5.6, -0.4], [8.6, 0.1], [6.2, 0.5], [9.2, -0.2], [5.2, 0.4], [7.6, 0.3], [4.2, 0.6]]),
    print: (c) => scatter(30, -4.4, 0.2, 4.4, 4, 3, (x, y) => line(c, x, y, x + 0.12, y + 1.4, tint(REED, -0.25), 0.06)) });
  for (const [x, y] of [[-2.9, 6.3], [-0.6, 7.4], [1.6, 8.0], [3.1, 6.4]]) b.part({ on: left.stand, level: 1, shape: rrect(x - 0.24, y, x + 0.24, y + 1.7, 0.22, 4), color: C.bark });
  b.part({ on: left.stand, level: 1, color: C.sun, shape: [[-1.9, 4.3], [-1.3, 4.5], [-0.5, 5.2], [-0.9, 4.5], [-0.2, 4.3], [-0.9, 4.2], [-0.6, 3.5], [-1.3, 4.1], [-1.9, 3.9], [-1.6, 4.15]] });

  const right = b.layer(far, 'B', { r: 11, a: 2.2, b: 2.6, w: 1.6, x0: -2.6, x1: 2.6, label: false, strut: tint(REED, -0.12) });
  b.part({ on: right.stand, color: tint(REED, -0.12), shape: clump(-3.8, 3.8, [[5.2, 0.3], [7.0, -0.2], [4.6, 0.4], [7.8, 0.1], [5.8, -0.4], [6.6, 0.3], [4.2, -0.5]]) });
  for (const [x, y] of [[-1.9, 6.0], [0.5, 6.8], [2.3, 5.6]]) b.part({ on: right.stand, level: 1, shape: rrect(x - 0.24, y, x + 0.24, y + 1.6, 0.22, 4), color: C.bark });

  // --- The floating layer: the water's surface, with windows down to the fish -------------------------------------
  const F = b.float({ height: 2.3, y0: 5.0, y1: 13.0, d: 9.3, legColor: tint(WATER, -0.2) });
  const windows = [blob(-5.2, 9.3, 2.5, 1.7, 1), blob(-4.0, 6.3, 1.6, 0.85, 4), blob(4.5, 7.8, 2.7, 1.8, 2), blob(5.6, 11.3, 1.8, 0.95, 5)];
  b.part({
    on: F, shape: [[-9.3, 5.0], [-8.6, 4.5], [8.6, 4.5], [9.3, 5.0], [9.3, 13.0], [8.6, 13.5], [-8.6, 13.5], [-9.3, 13.0]], holes: windows, color: SURFACE, back: tint(SURFACE, -0.2), noCrease: true,
    print: (c) => {
      for (let y = 5; y < 13.4; y += 0.9) for (let x = -9 + ((y * 5) % 3); x < 9; x += 4.2) stroke(c, smooth([[x, y], [x + 0.9, y + 0.16], [x + 1.9, y]], 3), tint(SURFACE, 0.35), 0.08);
      for (const w of windows) stroke(c, w, tint(SURFACE, 0.4), 0.14, true);
      for (let y = 5; y < 13.5; y += 0.6) line(c, -1.6 + Math.sin(y * 4) * 0.6, y, 1.6 + Math.sin(y * 6) * 0.6, y, tint(C.orange, 0.35), 0.1);
    },
  });
  for (const [side, x, y, r, a, col] of [['A', -7.2, 12.0, 1.25, 0.4, C.leaf], ['A', -1.9, 7.4, 1.0, 2.0, C.moss], ['A', -7.6, 6.0, 0.8, 4.0, C.leaf], ['B', 1.9, 11.6, 1.15, 1.2, C.leaf], ['B', 7.7, 5.6, 0.95, 5.0, C.moss], ['B', 8.0, 9.9, 0.8, 3.0, C.leaf]]) {
    b.part({ on: F[side], level: 1, shape: pad(x, y, r, a), color: col, hasBack: false, print: (c) => { for (let i = 0; i < 6; i++) { const t = a + 0.7 + i * 0.85; line(c, x, y, x + Math.cos(t) * r * 0.85, y + Math.sin(t) * r * 0.7, tint(col, -0.2), 0.045); } } });
  }
  b.part({ on: F.A, level: 2, shape: flower(-7.0, 12.1, 0.6), color: C.snow, hasBack: false, print: (c) => disc(c, -7.0, 12.1, 0.17, C.sun) });
  b.part({ on: F.B, level: 2, shape: flower(2.1, 11.5, 0.55), color: C.rose, hasBack: false, print: (c) => disc(c, 2.1, 11.5, 0.16, C.sun) });
  // a frog on a pad
  b.part({ on: F.A, level: 2, color: tint(C.leaf, -0.25), hasBack: false, shape: smooth([[-2.5, 7.2], [-2.3, 7.75], [-1.9, 7.95], [-1.6, 7.75], [-1.3, 7.8], [-1.25, 7.4], [-1.5, 7.0], [-2.0, 6.9]], 3, true), print: (c) => { disc(c, -2.2, 7.7, 0.07, C.sun); disc(c, -1.65, 7.72, 0.07, C.sun); } });
  // the boat, drifting on the surface
  b.part({ on: F.B, level: 1, shape: shift(boatHull(0, 0, 2.2), 1.9, 6.4), color: C.red, hasBack: false });
  b.part({ on: F.B, level: 2, shape: shift(boatSail(0, 0, 2.2), 1.9, 6.36), color: C.snow, hasBack: false });
}
