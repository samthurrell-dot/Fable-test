// src/spreads/base.js
// What is always there: the two cover boards, and the things lying on the table round the book.

import { C, tint, rect, rrect, ellipse, smooth, shift, fir, crests, boatHull, boatSail, fill, stroke, disc, line, text } from '../art.js';
import { BOOK, MAT } from '../book.js';

export const TITLE = 'Where the river goes';
const CLOTH = '#1f4f5c';   // cover cloth

export function buildBase(b, book) {
  const { W, H, COVER_T: T, COVER_OVER: O } = BOOK;

  // Front cover. Its outside is up when the book is shut.
  b.part({
    on: book.front[0], shape: rrect(0, -O, W + O, H + O, 0.25, 3), z: [-T, 0], color: CLOTH, back: CLOTH, edge: CLOTH,
    mat: MAT.BOARD, hasRim: false, hasBack: true,
    print: (c) => {
      // a river of cut-paper bands running down the cover
      const band = (x, w, col) => {
        const pts = [];
        for (let y = -1; y <= H + 1; y += 0.8) pts.push([x + Math.sin(y * 0.42 + x) * 1.5 + (y - 15) * 0.16, y]);
        stroke(c, smooth(pts, 3), col, w);
      };
      band(15.6, 6.2, C.deep); band(15.8, 4.2, C.water); band(15.4, 1.5, tint(C.water, 0.35));
      for (let y = 2; y < H; y += 3.1) stroke(c, smooth([[14.2 + Math.sin(y * 0.42 + 15.6) * 1.5 + (y - 15) * 0.16, y], [15.4 + Math.sin(y * 0.42 + 15.6) * 1.5 + (y - 15) * 0.16, y - 0.4], [16.6 + Math.sin(y * 0.42 + 15.6) * 1.5 + (y - 15) * 0.16, y]], 4), C.foam, 0.09);
      text(c, 'Where', 3.2, 22.6, 2.5, { colour: C.cream, weight: 600 });
      text(c, 'the river', 3.2, 19.7, 2.5, { colour: C.cream, weight: 600 });
      text(c, 'goes', 3.2, 16.8, 2.5, { colour: C.cream, weight: 600, italic: true });
      text(c, 'A pop-up book in five folds', 3.3, 3.2, 0.72, { colour: tint(C.cream, -0.12), italic: true });
      stroke(c, rrect(1.5, 1.2, W - 1.1, H - 1.2, 0.5, 4), tint(CLOTH, 0.22), 0.07, true);
    },
  });
  // The boat on the cover: two pieces of card glued on.
  b.part({ on: book.front[0], z: [0, 0.045], shape: shift(boatHull(0, 0, 5.4), 16.4, 9.3), color: C.red, hasBack: false });
  b.part({ on: book.front[0], z: [0.045, 0.09], shape: shift(boatSail(0, 0, 5.4), 16.4, 9.25), color: C.snow, hasBack: false });
  // Cloth tape down the spine side.
  b.part({ on: book.front[0], z: [0, 0.03], shape: rect(0, -O, 2.3, H + O), color: tint(CLOTH, -0.35), hasBack: false, hasRim: false, mat: MAT.BOARD, edge: tint(CLOTH, -0.35) });

  // Back cover: face down on the table.
  b.part({ on: book.back[5], shape: rrect(-W - O, -O, 0, H + O, 0.25, 3), z: [-T, 0], color: CLOTH, back: CLOTH, edge: CLOTH, mat: MAT.BOARD, hasRim: false });

  // --- On the table: the maker's things ----------------------------------------------------------------
  // Everything here is the same kind of part as the book: an outline with a thickness, on a fixed frame.
  // A frame lying on the table at (x, z), turned by a radians.
  const lying = (x, z, a, y = 0) => b.fixed([x, y, z], [Math.cos(a), 0, -Math.sin(a)], [-Math.sin(a), 0, -Math.cos(a)]);
  const t = BOOK.CARD_T;
  const scrap = (x, z, a, shape, color, extra = {}) => b.part({ on: lying(x, z, a), shape, z: [0, t], color, back: C.white, ...extra });

  // Offcuts: the sheets the pieces were cut from, with the holes they left.
  scrap(-44, 1.5, 0.28, [[0, 0], [11.5, 0], [11.5, 6.4], [9.2, 8.8], [0, 8.8]], C.pine, { holes: [fir(3.0, 1.2, 5.6, 2.9, 4), fir(6.9, 1.6, 4.2, 2.3, 4), fir(9.6, 1.0, 3.2, 1.8, 4)] });
  scrap(-33.6, 13.5, 0.5, [[0, 0], [6.2, 0.4], [5.4, 3.6], [3.1, 2.7], [0.6, 4.4]], C.red);
  scrap(-30.8, 10.4, 1.1, [[0, 0], [3.4, 0], [1.7, 3.6]], C.sun);
  scrap(-37.5, 16.4, -0.5, fir(0, 0, 3.6, 2.0, 4), C.pine);
  scrap(29.5, -9.5, -0.2, [...crests(0, 13, 4.2, 1.6, 4.3, 0.2, 10).reverse(), [0, 0], [13, 0]], C.deep);
  scrap(41.5, -4.6, 0.75, [[0, 0], [2.6, 0.3], [2.1, 2.9], [0.3, 2.2]], C.snow);
  scrap(31.5, 20.5, -0.35, [[0, 0], [7, 0], [7, 2.2], [5.6, 2.2], [4.9, 3.4], [4.2, 2.2], [0, 2.2]], C.meadow);
  scrap(-29.6, -12.8, 0.9, smooth([[0, 0], [2.2, -0.3], [3.4, 0.8], [2.8, 2.2], [1.0, 2.6], [-0.3, 1.5]], 4, true), C.snow);

  // A boxwood rule.
  b.part({
    on: lying(-36.5, -4, 1.32), shape: rect(0, 0, 30.6, 3), z: [0, 0.16], color: '#d6bd86', back: '#d6bd86', edge: '#c4a970', mat: MAT.WOOD, hasRim: false,
    print: (c) => {
      for (let i = 0; i <= 300; i++) { const x = 0.3 + i * 0.1, long = i % 10 === 0, mid = i % 5 === 0; line(c, x, 3, x, 3 - (long ? 0.85 : mid ? 0.6 : 0.36), '#3a2c1c', long ? 0.035 : 0.022); }
      for (let i = 1; i < 30; i++) text(c, String(i), 0.3 + i, 1.55, 0.42, { colour: '#3a2c1c', align: 'center', weight: 500, font: 'Georgia, serif' });
      for (let x = 0.5; x < 30; x += 0.8) line(c, x, 0.1 + (x * 7 % 1) * 0.8, x + 2.6, 0.12 + (x * 7 % 1) * 0.8, 'rgba(120, 90, 50, 0.16)', 0.03);
    },
  });

  // A bone folder, for scoring the folds.
  b.part({ on: lying(30.5, 16.2, 0.42), shape: smooth([[0, 0], [1.5, -0.86], [7, -0.98], [12.4, -0.74], [14.4, 0], [12.4, 0.74], [7, 0.98], [1.5, 0.86]], 6, true), z: [0, 0.34], color: '#efe6cf', back: '#efe6cf', edge: '#e2d6b8', mat: MAT.WOOD, hasRim: false });

  // A pencil: a six-sided stick lying on one of its faces, sharpened in steps.
  {
    const ax = Math.cos(0.72), az = Math.sin(0.72);            // the way it points along the table
    const R = 0.36, apo = R * Math.cos(Math.PI / 6);
    const frame = b.fixed([-42.5, 0, 17], [0, 1, 0], [-az, 0, ax]);   // z of this frame runs along the pencil
    const hex = (r) => ellipse(apo, 0, r, r, 6, Math.PI / 6);
    b.part({ on: frame, shape: hex(R), z: [1.5, 13.6], color: '#e9d9b0', back: '#d8d2c4', edge: '#2f6b8e', mat: MAT.WOOD, hasRim: false });
    b.part({ on: frame, shape: hex(R * 1.04), z: [0.9, 1.5], color: '#d8d2c4', back: '#d8d2c4', edge: '#cfc9bb', mat: MAT.WOOD, hasRim: false });
    b.part({ on: frame, shape: hex(R), z: [0, 0.9], color: '#d98a8a', back: '#d98a8a', edge: '#d98a8a', mat: MAT.WOOD, hasRim: false });
    for (let i = 0; i < 7; i++) b.part({ on: frame, shape: hex(R * (1 - (i + 1) / 8.2)), z: [13.6 + i * 0.26, 13.6 + (i + 1) * 0.26], color: i > 4 ? '#3a3a3c' : '#e3c79a', back: '#e3c79a', edge: i > 4 ? '#3a3a3c' : '#e3c79a', mat: MAT.WOOD, hasRim: false });
  }

  // A stick of glue, standing.
  b.part({ on: lying(37.5, -15.5, 0), shape: ellipse(0, 0, 1.25, 1.25, 28), z: [0, 7.4], color: '#f3efe6', back: '#f3efe6', edge: '#f1ece2', mat: MAT.WOOD, hasRim: false });
  b.part({ on: lying(37.5, -15.5, 0), shape: ellipse(0, 0, 1.32, 1.32, 28), z: [7.4, 9.9], color: '#c73e2f', back: '#c73e2f', edge: '#c73e2f', mat: MAT.WOOD, hasRim: false });
  b.part({ on: lying(37.5, -15.5, 0), shape: ellipse(0, 0, 1.3, 1.3, 28), z: [0, 1.6], color: '#c73e2f', back: '#c73e2f', edge: '#c73e2f', mat: MAT.WOOD, hasRim: false });

  // The boat itself, folded from a page: flat pieces of paper on tilted frames.
  {
    const at = [33.5, 0, 6.5], turnBy = -0.55, s = 1;
    const cs = Math.cos(turnBy), sn = Math.sin(turnBy);
    const P = (x, y, z) => [at[0] + (x * cs + z * sn) * s, at[1] + y * s, at[2] + (-x * sn + z * cs) * s];
    const sub3 = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]];
    const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const cross3 = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]];
    const dot3 = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
    // A flat facet through 3D points (all in one plane): a frame on its first edge.
    const facet = (pts, color) => {
      const x = unit(sub3(pts[1], pts[0])), n = unit(cross3(sub3(pts[1], pts[0]), sub3(pts[2], pts[0]))), y = cross3(n, x);
      const f = b.fixed(pts[0], x, y);
      b.part({ on: f, shape: pts.map((q) => [dot3(sub3(q, pts[0]), x), dot3(sub3(q, pts[0]), y)]), z: [-0.012, 0.012], color, back: color, hasRim: false });
    };
    const a = 2.3, bb = 3.9, c = 5.3, h = 1.9, w = 1.45, lift = 0.02;   // half keel, half gunwale, bow reach, height, half beam
    const paper = '#f4efe2';
    for (const side of [1, -1]) {
      facet([P(-a, lift, 0), P(a, lift, 0), P(bb, h, w * side), P(-bb, h, w * side)], paper);
      facet([P(a, lift, 0), P(c, h, 0), P(bb, h, w * side)], tint(paper, -0.04));
      facet([P(-a, lift, 0), P(-bb, h, w * side), P(-c, h, 0)], tint(paper, -0.04));
    }
    facet([P(-2.6, 0.5, 0), P(2.6, 0.5, 0), P(0, 4.3, 0)], paper);
  }
}
