// src/spreads/base.js
// What is always there: the two cover boards, and the things lying on the table round the book.

import { C, tint, rect, rrect, ellipse, smooth, shift, turn, boatHull, boatSail, fill, stroke, disc, line, text, scatter } from '../art.js';
import { BOOK, MAT } from '../book.js';

export const TITLE = 'Where the river goes';
const CLOTH = '#1f4f5c';   // cover cloth

export function buildBase(b, book) {
  const { W, H, COVER_T: T, COVER_OVER: O } = BOOK;

  // Front cover. Its outside is up when the book is shut.
  b.part({
    on: book.front[0], shape: rrect(0, -O, W + O, H + O, 0.25, 3), z: [0, T], color: CLOTH, back: CLOTH, edge: CLOTH,
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
  b.part({ on: book.front[0], z: [T, T + 0.045], shape: shift(boatHull(0, 0, 5.4), 16.4, 9.3), color: C.red, hasBack: false });
  b.part({ on: book.front[0], z: [T + 0.045, T + 0.09], shape: shift(boatSail(0, 0, 5.4), 16.4, 9.25), color: C.snow, hasBack: false });
  // Cloth tape down the spine side.
  b.part({ on: book.front[0], z: [T, T + 0.03], shape: rect(0, -O, 2.3, H + O), color: tint(CLOTH, -0.35), hasBack: false, hasRim: false, mat: MAT.BOARD, edge: tint(CLOTH, -0.35) });

  // Back cover: face down on the table.
  b.part({ on: book.back[5], shape: rrect(-W - O, -O, 0, H + O, 0.25, 3), z: [0, T], color: CLOTH, back: CLOTH, edge: CLOTH, mat: MAT.BOARD, hasRim: false });

  // --- On the table ---------------------------------------------------------------------------------
  // A frame lying on the table at (x, z), turned by a radians.
  const lying = (x, z, a, y = 0) => b.fixed([x, y, z], [Math.cos(a), 0, -Math.sin(a)], [-Math.sin(a), 0, -Math.cos(a)]);
  const t = BOOK.CARD_T;
  const scrap = (x, z, a, shape, color, extra = {}) => b.part({ on: lying(x, z, a), shape, z: [0, t], color, back: C.white, ...extra });
  scrap(-33.5, 12, 0.5, [[0, 0], [6.2, 0.4], [5.4, 3.6], [3.1, 2.7], [0.6, 4.4]], C.red);
  scrap(-35, 3, -0.3, smooth([[0, 0], [5, -0.6], [7.4, 1.2], [6.2, 3.8], [2.6, 4.6], [-0.5, 2.6]], 5, true), C.water);
  scrap(-30.6, 9.2, 1.1, [[0, 0], [3.4, 0], [1.7, 3.6]], C.sun);
  scrap(31, 17.5, -0.45, [[0, 0], [7, 0], [7, 2.2], [5.6, 2.2], [4.9, 3.4], [4.2, 2.2], [0, 2.2]], C.pine);
  scrap(34.5, 10.5, 0.2, rect(0, 0, 4.4, 5.6), C.meadow);
  scrap(36, 12.5, 0.9, [[0, 0], [2.6, 0.3], [2.1, 2.9], [0.3, 2.2]], C.snow);
}
