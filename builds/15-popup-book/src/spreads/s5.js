// src/spreads/s5.js
// Spread 5, the sea. Five V-folds with the same angles, set one behind the other down the spine, so
// they fold as one: four rows of waves and, tallest of all, the lighthouse. Because they share their
// angles each is the next one slid along the spine, and they can never meet as the book shuts.
// Behind the far waves a wheel turns day into night.

import { C, tint, rect, rrect, ellipse, smooth, shift, standing, crests, boatHull, boatSail, fill, stroke, disc, ring, line, box, text, textBlock, scatter } from '../art.js';
import { STORY } from '../story.js';

const SEA = '#215d8e';
const ALPHA = 72, BETA = 87;     // every piece on this spread uses these, see the note above
const DISC_R = 4.5;                // cm, the day-and-night wheel

const GULL = [[-1.25, 0.2], [-0.7, 0.62], [-0.22, 0.3], [0, 0.42], [0.22, 0.3], [0.7, 0.62], [1.25, 0.2], [0.66, 0.36], [0.2, 0.02], [0, -0.16], [-0.2, 0.02], [-0.66, 0.36]];

export function buildSpread5(b) {
  const { W, H } = b;

  // --- The page: open water ---------------------------------------------------------------------------
  b.page(SEA, (c) => {
    for (let y = 0.7; y < H; y += 1.25) {
      for (let x = -W + ((y * 7.3) % 4); x < W; x += 6.5 + ((y * 3.1) % 3)) stroke(c, smooth([[x, y], [x + 0.9, y + 0.3], [x + 1.9, y + 0.05], [x + 2.9, y + 0.32], [x + 3.8, y]], 4), tint(SEA, y % 2.5 < 1.25 ? 0.16 : -0.2), 0.1);
    }
    // a compass rose
    const cx = 18.6, cy = 4.2;
    ring(c, cx, cy, 2.3, tint(SEA, 0.35), 0.06); ring(c, cx, cy, 1.9, tint(SEA, 0.35), 0.04);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, r = i % 2 ? 1.2 : 2.2; fill(c, [[cx + Math.cos(a) * r, cy + Math.sin(a) * r], [cx + Math.cos(a + 0.5) * 0.36, cy + Math.sin(a + 0.5) * 0.36], [cx, cy], [cx + Math.cos(a - 0.5) * 0.36, cy + Math.sin(a - 0.5) * 0.36]], i % 2 ? tint(SEA, 0.3) : C.cream); }
    text(c, 'N', cx, cy + 2.6, 0.62, { colour: C.cream, align: 'center', weight: 600 });
    textBlock(c, STORY[5], -22.4, 3.6, 0.9, 15, { colour: C.cream });
    text(c, '5', -23.2, 0.7, 0.5, { colour: tint(SEA, 0.45) });
  });

  const wave = (y, span) => b.vfold({ y, alpha: ALPHA, beta: BETA, span: [-span, span], label: false });
  // One row of waves: the card, its printed lines, and white caps glued on the crests.
  function row(vf, span, base, amp, len, phase, col, capCol = C.foam) {
    const top = crests(-span, span, base, amp, len, phase, 12).filter((p, i, a) => i === 0 || p[0] > a[i - 1][0] - 0.2);
    top[0][0] = -span; top[top.length - 1][0] = span;
    b.part({ on: vf, shape: standing(top, b.base(vf)), color: col, screen: (x, y) => 0.55 - y * 0.12, ink: C.navy,
      print: (c) => { for (let k = 0; k < 3; k++) stroke(c, crests(-span, span, base - 1.0 - k * 0.85, amp * (0.6 - k * 0.14), len, phase + 0.12 * (k + 1), 10), tint(col, 0.28), 0.1); } });
    // caps: a curl sitting on each crest
    for (let k = Math.ceil(-span / len - 1); k * len < span; k++) {
      const x = (k + 0.62 - phase) * len;
      if (Math.abs(x) < 1.3 || Math.abs(x) > span - 1.6) continue;
      const y = base + amp;
      b.part({ on: x < 0 ? vf.A : vf.B, level: 1, color: capCol, shape: smooth([[x - 1.5, y - 0.75], [x - 0.6, y - 0.1], [x + 0.25, y + 0.32], [x + 0.85, y + 0.12], [x + 1.0, y - 0.42], [x + 0.55, y - 0.3], [x + 0.2, y - 0.62], [x - 0.5, y - 0.72]], 4, true) });
    }
  }

  // --- The far waves, and the wheel of day and night behind them ------------------------------------------
  const far = b.vfold({ y: 22, alpha: ALPHA, beta: BETA, span: [-21, 21], labelY: 2.4 });
  row(far, 21, 3.3, 1.5, 4.3, 0.2, C.navy, tint(C.foam, -0.08));
  const sky = b.control({ type: 'wheel', parent: far.A, at: [-10.4, 5.2], radius: DISC_R, z: -0.07, name: 'Wheel', demo: [0, 3.14159, 3.14159, 6.28318] });
  const turning = b.planar(far.A, () => ({ x: -10.4, y: 5.2, rot: sky.value, z: -0.12 }));
  b.part({
    on: turning, z: [0, 0.045], shape: ellipse(0, 0, DISC_R, DISC_R, 56), color: C.sun, back: C.cream,
    print: (c) => {
      // day above, night below; turning the wheel brings the other half up over the waves
      c.save(); c.beginPath(); c.rect(-DISC_R - 0.5, -DISC_R - 0.5, DISC_R * 2 + 1, DISC_R + 0.5); c.clip();
      box(c, -DISC_R - 0.5, -DISC_R - 0.5, DISC_R + 0.5, 0.5, C.navy);
      disc(c, 0.9, -2.4, 1.15, C.cream); disc(c, 1.35, -2.15, 1.0, C.navy);
      scatter(30, -4, -4.2, 4, -0.4, 5, (x, y, i, r) => { if (Math.hypot(x, y) < DISC_R - 0.4 && Math.hypot(x - 0.9, y + 2.4) > 1.5) disc(c, x, y, 0.04 + r() * 0.06, C.cream); });
      c.restore();
      disc(c, 0, 0, 0.01, C.sun);
      for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; fill(c, [[Math.cos(a - 0.07) * 2.7, Math.sin(a - 0.07) * 2.7], [Math.cos(a) * 4.2, Math.sin(a) * 4.2], [Math.cos(a + 0.07) * 2.7, Math.sin(a + 0.07) * 2.7]], C.orange); }
      fill(c, ellipse(0, 0, 2.4, 2.4, 30, 0, Math.PI), tint(C.sun, 0.25));
    },
  });
  b.label(far.A, [-10.4, 9.2, 0], 'Wheel');

  // --- The lighthouse ----------------------------------------------------------------------------------------
  const tower = b.vfold({ y: 27.5, alpha: ALPHA, beta: BETA, span: [-6.4, 6.4], labelY: 13 });
  const half = [[6.5, 0.5], [5.4, 1.8], [3.7, 2.3], [2.7, 3.0], [2.25, 3.0], [1.5, 18.6], [2.15, 18.6], [2.15, 19.3], [1.3, 19.3], [1.3, 22.2], [1.8, 22.2], [0.25, 24.5]];
  const outline = [...half.map(([x, y]) => [-x, y]), ...half.slice().reverse()];
  b.part({
    on: tower, shape: standing(outline, b.base(tower)), color: C.snow,
    print: (c) => {
      // the rock
      fill(c, [[-7, -0.5], [-6.5, 0.5], [-5.4, 1.8], [-3.7, 2.3], [-2.7, 3.0], [2.7, 3.0], [3.7, 2.3], [5.4, 1.8], [6.5, 0.5], [7, -0.5]], C.stone);
      for (const [x0, y0, x1, y1, x2, y2] of [[-5.4, 1.8, -3.7, 2.3, -4.2, 0.4], [-2.7, 3.0, -0.6, 3.0, -1.4, 1.2], [1.0, 3.0, 2.7, 3.0, 2.6, 1.5], [3.7, 2.3, 5.4, 1.8, 4.9, 0.5]]) fill(c, [[x0, y0], [x1, y1], [x2, y2]], tint(C.stone, 0.22));
      // red bands; the tower narrows as it rises
      const wAt = (y) => 2.25 - ((y - 3) / 15.6) * 0.75;
      for (const [y0, y1] of [[5.4, 8.2], [11.0, 13.8], [16.4, 18.6]]) fill(c, [[-wAt(y0), y0], [wAt(y0), y0], [wAt(y1), y1], [-wAt(y1), y1]], C.red);
      box(c, -0.6, 3.0, 0.6, 4.9, C.navy); fill(c, ellipse(0, 4.9, 0.6, 0.5, 12, 0, Math.PI), C.navy);
      for (const y of [9.2, 14.6]) { box(c, 0.45, y, 1.0, y + 1.0, C.navy); box(c, -1.0, y, -0.45, y + 1.0, C.navy); }
      box(c, -2.2, 18.55, 2.2, 19.35, C.ink);
      box(c, -1.3, 19.3, 1.3, 22.2, C.sun);
      for (const x of [-0.65, 0, 0.65]) line(c, x, 19.3, x, 22.2, C.ink, 0.07);
      line(c, -1.3, 20.75, 1.3, 20.75, C.ink, 0.07);
      fill(c, [[-1.85, 22.15], [1.85, 22.15], [0.25, 24.6], [-0.25, 24.6]], C.red);
    },
  });
  // the light: a paper star behind the lamp
  b.part({ on: tower, level: -1, noCrease: true, color: tint(C.sun, 0.5), back: tint(C.sun, 0.5), shape: (() => { const o = []; for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, r = i % 2 ? 2.5 : 3.6; o.push([Math.cos(a) * r, 20.75 + Math.sin(a) * r]); } return o; })() });

  // --- Three more rows of waves, nearer and paler ------------------------------------------------------------------
  const mid = wave(17, 21.5), near = wave(12, 21), front = wave(7, 19.5);
  row(mid, 21.5, 3.1, 1.9, 5.1, 0.55, C.deep);
  row(near, 21, 2.9, 2.1, 5.7, 0.1, C.water);
  row(front, 19.5, 2.5, 2.2, 6.3, 0.72, '#79c0c2');
  b.label(mid.B, [12, 2, 0], 'V-fold');

  // gulls on stalks of card, glued behind the waves
  for (const [vf, side, x, y, s] of [[mid, 'B', 9.4, 9.6, 1], [mid, 'B', 14.6, 8.2, 0.8], [far, 'B', 6.0, 10.4, 0.85], [mid, 'A', -15.2, 9.0, 0.9]]) {
    b.part({ on: vf[side], level: -1, color: C.snow, back: C.snow,
      shape: (() => { const g = GULL.map(([gx, gy]) => [x + gx * s, y + gy * s]); return [...g.slice(0, 9), [x + 0.05, y - 0.1 * s], [x + 0.05, 2.2], [x - 0.05, 2.2], [x - 0.05, y - 0.1 * s], ...g.slice(10)]; })(),
      print: (c) => { fill(c, [[x - 1.25 * s, y + 0.2 * s], [x - 0.9 * s, y + 0.48 * s], [x - 0.75 * s, y + 0.3 * s]], C.ink); fill(c, [[x + 1.25 * s, y + 0.2 * s], [x + 0.9 * s, y + 0.48 * s], [x + 0.75 * s, y + 0.3 * s]], C.ink); } });
  }

  // the boat, home on the sea: glued behind the front row so the waves stand before its hull
  b.part({ on: front.B, level: -1, shape: shift(boatHull(0, 0, 4.6), 7.2, 3.1), color: C.red, back: C.red });
  b.part({ on: front.B, level: -2, shape: shift(boatSail(0, 0, 4.6), 7.2, 3.0), color: C.snow, back: C.snow });
}
