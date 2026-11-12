// src/book.js
// The book as an object: six stiff leaves on one spine, five spreads between them, and a builder
// that spread files use to add card parts and mechanisms. Kinematics come from engine/fold.js,
// triangles from engine/cardmesh.js, print from engine/atlas.js.
//
// One number drives everything: book.turn in 0..5. At a whole number k, spread k lies open.
// Between k and k + 1, leaf k is in the air: spread k is closing while spread k + 1 opens.

import { Rig, hingeOfFold, vec } from '../engine/fold.js';
import { CardMesh, crossingsX } from '../engine/cardmesh.js';
import { buildAtlas } from '../engine/atlas.js';
import { C, hexRgb, rect } from './art.js';

export const BOOK = {
  W: 25,              // cm, width of a page
  H: 30,              // cm, height of a page
  SPREADS: 5,
  FAN: 0.026,         // radians between resting leaves: the room folded card takes up between pages
  PAGE_T: 0.06,       // cm, one printed sheet (a leaf is two, back to back)
  CARD_T: 0.045,      // cm, pop-up card
  COVER_T: 0.24,      // cm, cover board
  COVER_OVER: 0.4,    // cm the covers stand proud of the pages
  GUTTER_BEND: 0.5,   // cm of sheet that bends at the spine
  TAB_W: 0.85,        // cm, width of a glue tab
  OPEN_MIN: 0.045,    // radians: below this a spread counts as shut and its pop-ups are not drawn
};
export const MAT = { CARD: 0, BOARD: 1, TAB: 2, WOOD: 3 };
const { add, sub, mul, dot, cross, norm, neg } = vec;

class Builder {
  constructor(book, k) {
    this.book = book; this.rig = book.rig; this.k = k;
    this.gutter = k > 0 ? book.folds[k] : null;
    this.L = this.gutter && this.gutter.A; this.R = this.gutter && this.gutter.B;
    this.pagesGroup = k > 0 ? `pg${k}` : 'base';
    this.popGroup = k > 0 ? `pop${k}` : 'base';
    this.parts = []; this.creases = []; this.tabs = []; this.labels = []; this.controls = []; this.mechs = [];
    this.W = BOOK.W; this.H = BOOK.H;
  }

  _isPage(frame) { return this.book.pageFrames.has(frame.id); }

  // Sheet levels. On a page, level 1 lies on the paper, 2 on top of that. On a standing card,
  // level 0 is the card itself, +1 is glued to its front, -1 to its back.
  _z(frame, level) {
    const t = BOOK.CARD_T;
    if (this._isPage(frame)) return [BOOK.PAGE_T + (level - 1) * t, BOOK.PAGE_T + level * t];
    if (level === 0) return [-t / 2, t / 2];
    return level > 0 ? [t / 2 + (level - 1) * t, t / 2 + level * t] : [-t / 2 + level * t, -t / 2 + (level + 1) * t];
  }

  // Adds a card part. spec.on is a Frame, or a Fold to draw across its crease.
  //   shape, holes   outlines in cm
  //   level          see _z; or give z: [z0, z1] directly
  //   color, back, edge   card colours (hex). back defaults to white card.
  //   print(ctx)     ink on the front, drawn in the part's own cm units
  //   screen, ink    halftone tone: (x, y) -> 0..1, linear in x and y
  part(spec) {
    const fold = spec.on.A ? spec.on : null;
    const frame = fold ? fold.A : spec.on;
    const page = this._isPage(frame);
    const level = spec.level ?? (page ? 1 : 0);
    const p = {
      group: this.popGroup, mat: MAT.CARD, color: C.white, back: C.white, edge: C.snow,
      hasBack: !page, hasWalls: true, hasRim: true, ...spec,
      frame, frameB: fold ? fold.B : undefined, z: spec.z || this._z(frame, level),
    };
    this.parts.push(p);
    if (fold && fold !== this.gutter && !spec.noCrease) {
      const ys = crossingsX(p.shape, 0);
      if (ys.length >= 2) {
        const c = this.creases.find((q) => q.fold === fold);
        if (c) { c.a[1] = Math.min(c.a[1], ys[0]); c.b[1] = Math.max(c.b[1], ys[ys.length - 1]); } else this.creases.push({ fold, frame: fold.A, a: [0, ys[0], 0], b: [0, ys[ys.length - 1], 0], kind: 'fold' });
      }
    }
    return p;
  }

  // The printed sheet of both pages. print(ctx) draws in spread units: x from -W to W, y from 0 to H.
  page(color, print, holes = []) {
    return this.part({
      on: this.gutter, shape: rect(-BOOK.W, 0, BOOK.W, BOOK.H), holes, z: [0, BOOK.PAGE_T], color, print,
      group: this.pagesGroup, mat: MAT.BOARD, hasBack: false, bend: BOOK.GUTTER_BEND, edge: C.snow,
    });
  }

  label(frame, p, text) { this.labels.push({ frame, p, text }); }

  // A glue tab on a host sheet: a strip from world point p0 to p1, reaching `side` (a world unit vector).
  _tab(host, p0, p1, side, width = BOOK.TAB_W) {
    const a = host.local(p0), b = host.local(p1);
    const s = [dot(side, host.x), dot(side, host.y)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    const c = Math.min(width * 0.6, l * 0.3);
    const shape = [[a[0], a[1]], [b[0], b[1]], [b[0] + s[0] * width - tx * c, b[1] + s[1] * width - ty * c], [a[0] + s[0] * width + tx * c, a[1] + s[1] * width + ty * c]];
    this.part({ on: host, shape, level: 1, color: C.white, mat: MAT.TAB, hasBack: false });
    this.tabs.push({ frame: host, shape, z: this._z(host, 1)[1] });
    this.creases.push({ frame: host, a: [a[0], a[1], this._z(host, 1)[0]], b: [b[0], b[1], this._z(host, 1)[0]], kind: 'glue' });
  }

  // V-fold on the spine (or on opts.hinge). y: where its point sits on the spine, alpha and beta in
  // degrees (see fold.js), span: how far its base reaches to each side, measured across the flat card.
  vfold(o) {
    const hinge = o.hinge || hingeOfFold(this.gutter, o.y);
    const vf = this.rig.vfold(hinge, o);
    vf.beta = (o.beta * Math.PI) / 180;
    this.mechs.push(vf);
    if (o.span) {
      const H = hinge();
      for (const side of ['A', 'B']) {
        const panel = vf[side], g = side === 'A' ? vf.gA : vf.gB;
        const host = side === 'A' ? H.fA : H.fB, nHost = side === 'A' ? H.nA : H.nB;
        const reach = Math.abs(side === 'A' ? o.span[0] : o.span[1]) / Math.sin(vf.beta);
        let f = cross(nHost, g);
        if ((dot(f, panel.n) > 0) === (o.tab !== 'front')) f = neg(f);
        this._tab(host, add(panel.o, mul(g, 0.6)), add(panel.o, mul(g, reach - 0.4)), f);
      }
    }
    if (o.label !== false) this.label(vf.B, [0, o.labelY ?? 4, 0], o.label || 'V-fold');
    return vf;
  }

  // The bottom edge of a V-fold piece under x, in its own flat units: the two glue lines.
  base(vf) { const k = 1 / Math.tan(vf.beta); return (x) => Math.abs(x) * k; }

  // A flat layer held upright in front of one side of a V-fold by a parallelogram.
  //   r: how far along the glue line from the point of the V the layer is centred
  //   a: how far in front it stands, b: how high up the backdrop its strut is glued
  //   w: width of the strut, x0/x1: reach of the layer's foot for its glue tab
  //   strut: colour of the strut (printed to match what is behind it, as real books do)
  // Returns { stand }: draw the layer on stand, x along its foot (left to right), y up.
  layer(vf, side, o) {
    const hinge = vf.glueHinge(side, { front: o.front !== false, r0: o.r });
    const L = this.rig.parallel(hinge, { a: o.a, b: o.b, p: o.b, q: o.a });
    this.mechs.push(L);
    const H = hinge();
    const w = o.w ?? 1.6, x0 = o.x0 ?? -w, x1 = o.x1 ?? w;
    this.part({ on: L.strut, shape: rect(-w / 2, 0, w / 2, o.a), color: o.strut || C.white, back: o.strut || C.white });
    this._tab(H.fA, L.stand.point(x0, 0, 0), L.stand.point(x1, 0, 0), neg(H.uA));
    this._tab(H.fB, L.strut.point(-w / 2, o.a, 0), L.strut.point(w / 2, o.a, 0), neg(H.uB), 0.6);
    this.creases.push({ frame: L.stand, a: [-w / 2, o.b, 0], b: [w / 2, o.b, 0], kind: 'fold', fold: { A: L.stand, B: L.strut, fixed: 'mountain' } });
    if (o.label !== false) this.label(L.stand, [0, o.b + 0.6, 0], o.label || 'Parallel fold');
    return L;
  }

  // A tent over the spine: two panels of width p glued a cm out on each page, from y0 to y1 along it.
  // Returns a Fold: x across the ridge, y along the spine measured from o.y.
  tent(o) {
    const T = this.rig.parallel(hingeOfFold(this.gutter, o.y), { a: o.a, b: o.b ?? o.a, p: o.p, q: o.q ?? o.p });
    this.mechs.push(T);
    const H = hingeOfFold(this.gutter, o.y)();
    const y0 = o.y0 ?? -2, y1 = o.y1 ?? 2;
    this._tab(H.fA, add(T.PA, mul(H.h, y0)), add(T.PA, mul(H.h, y1)), neg(H.uA));
    this._tab(H.fB, add(T.PB, mul(H.h, y0)), add(T.PB, mul(H.h, y1)), neg(H.uB));
    if (o.label !== false) this.label(T.B, [0, 0, 0.4], o.label || 'Parallel fold');
    return T;
  }

  // A floating layer: a platform `height` above both pages from y0 to y1 up the page, on a centre
  // fin and a leg d cm out on each side. Returns a Fold in spread units (x from the spine, y up the page).
  float(o) {
    const F = this.rig.float(this.gutter, { height: o.height });
    const span = (frame, pa, pb) => { const a = frame.local(pa)[0], b = frame.local(pb)[0]; return rect(Math.min(a, b), 0, Math.max(a, b), o.height); };
    const g = this.gutter;
    this.part({ on: F.fin, shape: span(F.fin, g.A.point(0, o.y0, 0), g.A.point(0, o.y1, 0)), color: C.white });
    for (const side of ['A', 'B']) {
      const host = g[side], sx = side === 'A' ? -o.d : o.d;
      const leg = F.leg(side, o.d);
      const p0 = host.point(sx, o.y0, 0), p1 = host.point(sx, o.y1, 0);
      this.part({ on: leg, shape: span(leg, p0, p1), color: o.legColor || C.white, back: o.legColor || C.white, print: o.legPrint });
      this._tab(host, p0, p1, side === 'A' ? host.x : neg(host.x));
      const top = F[side];
      this.creases.push({ frame: top, a: [sx, o.y0, 0], b: [sx, o.y1, 0], kind: 'fold', fold: { fixed: 'mountain' } });
    }
    this.creases.push({ frame: F.A, a: [0, o.y0, 0], b: [0, o.y1, 0], kind: 'fold', fold: { fixed: 'valley' } });
    this.label(F.B, [o.d * 0.5, o.y1, 0.3], 'Floating layer');
    return F;
  }

  planar(parent, fn) { return this.rig.planar(parent, fn); }
  fixed(o, x, y) { return this.rig.fixed(o, x, y); }

  // Something the pointer can move. See main.js for how each type is dragged.
  //   type 'tab':    slides along axis [ax, ay] of `parent` for `travel` cm; handle at `at` when value is 0
  //   type 'wheel':  turns about `at` on `parent`; value is the angle in radians
  //   type 'slider': follows `path` (points on `parent`); value 0..1 along it
  control(spec) {
    const c = { spread: this.k, value: 0, radius: 1.6, ...spec };
    this.controls.push(c);
    return c;
  }
}

export function createBook(content, opts = {}) {
  const N = BOOK.SPREADS;
  const rig = new Rig();
  const book = { rig, turn: 0, folds: [], pageFrames: new Set(), spreads: [], controls: [] };
  const origin = [0, BOOK.COVER_T, BOOK.H / 2];
  const restR = (j) => (N - j) * BOOK.FAN, restL = (j) => Math.PI - j * BOOK.FAN;
  book.leafAngle = (j, turn = book.turn) => {
    const t = Math.max(0, Math.min(1, turn - j));
    return j >= N ? restR(j) : restR(j) + (restL(j) - restR(j)) * t;
  };
  book.restAngles = (j) => [restR(j), restL(j)];
  const front = [], back = [];
  for (let j = 0; j <= N; j++) { front.push(rig.frame()); back.push(rig.frame()); }
  rig.step(() => {
    for (let j = 0; j <= N; j++) {
      const a = book.leafAngle(j), c = Math.cos(a), s = Math.sin(a);
      front[j].set(origin, [c, s, 0], [0, 0, -1]);
      back[j].set(origin, [-c, -s, 0], [0, 0, -1]);
    }
  });
  for (const f of [...front, ...back]) book.pageFrames.add(f.id);
  book.front = front; book.back = back; book.origin = origin;
  for (let k = 1; k <= N; k++) book.folds[k] = { A: back[k - 1], B: front[k] };

  // Opening of spread k in radians.
  book.opening = (k) => book.leafAngle(k - 1) - book.leafAngle(k);
  book.isOpen = (k) => book.opening(k) > BOOK.OPEN_MIN;
  book.setTurn = (t) => { book.turn = Math.max(0, Math.min(N, t)); };
  book.update = () => rig.update((g) => g === 0 || book.isOpen(g));

  // Build: the base (covers, table things), then each spread at its open pose.
  const builders = [];
  rig.group = 0;
  const base = new Builder(book, 0);
  builders.push(base);
  content.base(base, book);
  for (let k = 1; k <= N; k++) {
    book.turn = k; rig.update();
    rig.group = k;
    const b = new Builder(book, k);
    builders.push(b);
    content.spreads[k - 1](b, book);
  }
  rig.group = 0;
  book.turn = 0; rig.update();

  // Print and cut.
  const mesh = new CardMesh();
  book.atlases = [];
  builders.forEach((b, k) => {
    const printed = b.parts.filter((p) => p.print);
    const boxOf = (shape) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of shape) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      return [x0, y0, x1, y1];
    };
    let uv = [];
    if (printed.length) {
      const atlas = buildAtlas(printed.map((p) => ({ box: boxOf(p.shape), base: p.color, draw: p.print })), opts.atlasSize || 2048, opts.density || 38);
      uv = atlas.uv;
      book.atlases.push({ groups: k > 0 ? [`pg${k}`, `pop${k}`] : ['base'], canvas: atlas.canvas, density: atlas.density });
    }
    b.parts.forEach((p) => {
      const i = printed.indexOf(p);
      mesh.addPart(p.group, {
        frame: p.frame.id, frameB: p.frameB ? p.frameB.id : undefined, outline: p.shape, holes: p.holes || [],
        z0: p.z[0], z1: p.z[1], front: hexRgb(p.color), back: hexRgb(p.back), edge: hexRgb(p.edge),
        uv: i >= 0 ? uv[i] : null, screen: p.screen || null, ink: hexRgb(p.ink || C.deep), mat: p.mat,
        hasBack: p.hasBack, hasWalls: p.hasWalls, hasRim: p.hasRim, ...(p.bend ? { bend: p.bend } : {}),
      });
    });
    book.spreads[k] = { parts: b.parts.length, creases: b.creases, tabs: b.tabs, labels: b.labels, controls: b.controls, list: b.parts, mechs: b.mechs };
    book.controls.push(...b.controls);
  });
  const order = ['base'];
  for (let k = 1; k <= N; k++) order.push(`pg${k}`, `pop${k}`);
  book.mesh = mesh.finish(order);

  // Mesh groups to draw now: every page sheet, and the pop-ups of spreads that are open.
  book.groups = () => {
    const out = ['base'];
    for (let k = 1; k <= N; k++) { out.push(`pg${k}`); if (book.isOpen(k)) out.push(`pop${k}`); }
    return out;
  };
  const frameData = new Float32Array(rig.frames.length * 12);
  book.frameData = () => rig.pack(frameData);
  book.frameCount = rig.frames.length;

  // A crease is a valley if its two faces lean towards each other on the printed side.
  book.creaseKind = (c) => {
    if (c.kind === 'glue') return 'glue';
    if (c.fold && c.fold.fixed) return c.fold.fixed;
    return dot(sub(c.fold.B.n, c.fold.A.n), c.fold.A.x) < 0 ? 'valley' : 'mountain';
  };
  // Tests the paper rules over the whole motion of every spread. Returns one line per spread:
  //   rigid     worst departure of any panel from a true rigid frame (should be about 1e-15)
  //   unsolved  poses where a linkage was past its reach (should be 0)
  //   seam      worst gap between a standing panel's foot and the sheet it is glued to, in cm
  //   overhang  how far any card sticks out past the page edges when the spread is shut, in cm,
  //             and which part does (parts marked sticksOut, such as tab handles, are left out)
  book.check = (steps = 60) => {
    const keep = book.turn, report = [];
    const { W, H } = BOOK;
    for (let k = 1; k <= N; k++) {
      const s = book.spreads[k];
      let rigid = 0, unsolved = 0, seam = 0;
      for (let i = 0; i <= steps; i++) {
        book.turn = k - 1 + i / steps; rig.update();
        rigid = Math.max(rigid, rig.maxError());
        for (const m of s.mechs) {
          if (m.ok === false) unsolved++;
          if (m.kind === 'v') {
            const Hh = m.hinge();
            for (const [panel, host, beta, sign] of [[m.A, Hh.fA, m.betaA, -1], [m.B, Hh.fB, m.betaB, 1]]) {
              seam = Math.max(seam, Math.abs(host.local(panel.point(sign * Math.sin(beta) * 10, Math.cos(beta) * 10, 0))[2]));
            }
          } else if (m.kind === 'p') {
            const Hh = m.hinge();
            seam = Math.max(seam, Math.abs(Hh.fA.local(m.PA)[2]), Math.abs(Hh.fB.local(m.PB)[2]));
          }
        }
      }
      book.turn = k - 1; rig.update();
      let overhang = 0, worst = '';
      const page = book.front[k];
      s.list.forEach((p, i) => {
        if (p.group !== `pop${k}` || p.sticksOut) return;
        for (const [x, y] of p.shape) {
          const f = p.frameB && x > 0 ? p.frameB : p.frame;
          const l = page.local(f.point(x, y, 0));
          const o = Math.max(-l[0], l[0] - W, -l[1], l[1] - H);
          if (o > overhang) { overhang = o; worst = p.name || `part ${i} (${p.color})`; }
        }
      });
      report.push({ spread: k, rigid, unsolved, seam, overhang: Math.max(0, overhang), worst });
    }
    book.turn = keep; rig.update();
    return report;
  };
  return book;
}
