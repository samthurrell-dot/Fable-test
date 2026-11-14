// engine/cardmesh.js
// Turns flat card parts (an outline, optional holes, a thickness) into triangles. No WebGL, no DOM.
//
// A part is cut from sheet: a front face, a back face, a white wall round the cut edge, and a thin
// pale rim on the front where the knife pressed the ink away. A part drawn across a Fold is cut at
// the crease into two rigid halves joined by a narrow bent strip, so folds come out slightly round.
//
// Vertices carry the index of the Frame they ride on (see fold.js); the vertex shader places them,
// so a whole book moves with no per-frame work here.
//
// Vertex layout (finish() returns both arrays):
//   f32, 12 floats: pos.xyz in the frame, bend (-1 rigid, else 0..1 across the crease),
//                   normal.xyz in the frame, uv.xy into the print atlas (x < 0: no print),
//                   frame A, frame B, material id
//   u8, 8 bytes:    colour rgb (sRGB), kind (0 face, 1 rim, 2 wall, 3 bend), ink rgb, screen 0..255

export const RIM_WIDTH = 0.035;     // cm of pale pressed edge round every front face
export const RIM_LIFT = 0.002;      // cm the rim sits above the face, so it never fights it for depth
export const RIM_TILT = 0.55;       // how far the rim's normal leans outward (0 flat, 1 on edge)
export const BEND_WIDTH = 0.12;     // cm of card that bends at a crease
export const BEND_STEPS = 4;        // strips across a bend
const SMOOTH_COS = Math.cos((38 * Math.PI) / 180);   // wall corners blunter than this are shaded round
const EPS = 1e-6;

export const KIND = { FACE: 0, RIM: 1, WALL: 2, BEND: 3 };

// --- 2D polygon helpers ---------------------------------------------------------------------------

export function signedArea(p) {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const q = p[(i + 1) % n];
    a += p[i][0] * q[1] - q[0] * p[i][1];
  }
  return a / 2;
}

// Drops repeated points (and a closing point equal to the first).
export function cleanPoly(p, eps = 1e-5) {
  const out = [];
  for (const q of p) {
    const l = out[out.length - 1];
    if (!l || Math.abs(l[0] - q[0]) > eps || Math.abs(l[1] - q[1]) > eps) out.push([q[0], q[1]]);
  }
  while (out.length > 1 && Math.abs(out[0][0] - out[out.length - 1][0]) < eps && Math.abs(out[0][1] - out[out.length - 1][1]) < eps) out.pop();
  return out;
}

export function ccw(p) { return signedArea(p) >= 0 ? p : p.slice().reverse(); }
export function cw(p) { return signedArea(p) <= 0 ? p : p.slice().reverse(); }

// Keeps the part of a polygon where nx*x + ny*y + c >= 0 (Sutherland-Hodgman).
export function clipHalfPlane(poly, nx, ny, c) {
  const out = [];
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const dp = nx * p[0] + ny * p[1] + c, dq = nx * q[0] + ny * q[1] + c;
    if (dp >= 0) out.push(p);
    if ((dp >= 0) !== (dq >= 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return cleanPoly(out);
}

// The y values where a polygon's edge crosses the line x = x0, sorted. Pairs are inside spans.
export function crossingsX(poly, x0) {
  const ys = [];
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    if ((p[0] <= x0) !== (q[0] <= x0)) ys.push(p[1] + ((x0 - p[0]) / (q[0] - p[0])) * (q[1] - p[1]));
  }
  return ys.sort((a, b) => a - b);
}

export function pointInPoly(poly, x, y) {
  let inside = false;
  for (let i = 0, n = poly.length, j = n - 1; i < n; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

const crs = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

function segmentsCross(a, b, c, d) {
  if (same(a, c) || same(a, d) || same(b, c) || same(b, d)) return false;
  const d1 = crs(a, b, c), d2 = crs(a, b, d), d3 = crs(c, d, a), d4 = crs(c, d, b);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

// Joins each hole to the outline with a two-way cut, giving one simple polygon.
function bridgeHoles(outer, holes) {
  let poly = outer.slice();
  const order = holes.map((h) => ({ h, mx: Math.max(...h.map((p) => p[0])) })).sort((a, b) => b.mx - a.mx);
  for (let k = 0; k < order.length; k++) {
    const hole = order[k].h;
    let mi = 0;
    for (let i = 1; i < hole.length; i++) if (hole[i][0] > hole[mi][0]) mi = i;
    const M = hole[mi];
    const cand = poly.map((p, i) => i).sort((i, j) => (poly[i][0] - M[0]) ** 2 + (poly[i][1] - M[1]) ** 2 - (poly[j][0] - M[0]) ** 2 - (poly[j][1] - M[1]) ** 2);
    const blocked = (P) => {
      for (let i = 0, n = poly.length; i < n; i++) if (segmentsCross(P, M, poly[i], poly[(i + 1) % n])) return true;
      for (let j = k; j < order.length; j++) {
        const h = order[j].h;
        for (let i = 0, n = h.length; i < n; i++) if (segmentsCross(P, M, h[i], h[(i + 1) % n])) return true;
      }
      return false;
    };
    let pick = cand[0];
    for (const i of cand) if (!blocked(poly[i])) { pick = i; break; }
    const ring = [];
    for (let i = 0; i <= hole.length; i++) ring.push(hole[(mi + i) % hole.length]);
    poly = [...poly.slice(0, pick + 1), ...ring, ...poly.slice(pick)];
  }
  return poly;
}

function inTri(p, a, b, c) {
  return crs(a, b, p) >= -1e-12 && crs(b, c, p) >= -1e-12 && crs(c, a, p) >= -1e-12;
}

// Ear clipping. outline anticlockwise, holes clockwise. Returns { pts, tris } with tris as indices
// into pts (pts is the outline with any holes spliced in).
export function triangulate(outline, holes = []) {
  const pts = holes.length ? bridgeHoles(outline, holes) : outline;
  const V = pts.map((p, i) => i);
  const tris = [];
  let i = 0, fails = 0;
  while (V.length > 3) {
    const m = V.length;
    const ia = V[(i + m - 1) % m], ib = V[i % m], ic = V[(i + 1) % m];
    const a = pts[ia], b = pts[ib], c = pts[ic];
    let ear = crs(a, b, c) > 1e-10;
    if (ear) {
      for (let k = 0; k < m; k++) {
        const j = V[k];
        if (j === ia || j === ib || j === ic) continue;
        const p = pts[j];
        if (same(p, a) || same(p, b) || same(p, c)) continue;
        if (inTri(p, a, b, c)) { ear = false; break; }
      }
    }
    if (ear) {
      tris.push(ia, ib, ic);
      V.splice(i % m, 1);
      fails = 0;
      if (i > 0) i--;
    } else {
      i++; fails++;
      if (fails > m) {
        // Stuck on a flat or crossed corner: drop the flattest one and carry on.
        let best = 0, bv = Infinity;
        for (let k = 0; k < m; k++) {
          const v = Math.abs(crs(pts[V[(k + m - 1) % m]], pts[V[k]], pts[V[(k + 1) % m]]));
          if (v < bv) { bv = v; best = k; }
        }
        if (crs(pts[V[(best + m - 1) % m]], pts[V[best]], pts[V[(best + 1) % m]]) > 0) tris.push(V[(best + m - 1) % m], V[best], V[(best + 1) % m]);
        V.splice(best, 1);
        fails = 0;
      }
    }
    if (i >= V.length) i = 0;
  }
  if (V.length === 3) tris.push(V[0], V[1], V[2]);
  return { pts, tris };
}

// Moves every corner of a loop a distance d into the card (the card lies to the left of the loop).
export function insetLoop(loop, d) {
  const n = loop.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = loop[(i + n - 1) % n], c = loop[i], q = loop[(i + 1) % n];
    let ax = c[0] - p[0], ay = c[1] - p[1], bx = q[0] - c[0], by = q[1] - c[1];
    const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
    ax /= la; ay /= la; bx /= lb; by /= lb;
    let mx = -ay - by, my = ax + bx;
    const ml = Math.hypot(mx, my);
    if (ml < 1e-6) { mx = -ay; my = ax; } else { mx /= ml; my /= ml; }
    const k = d / Math.max(mx * -ay + my * ax, 0.4);
    out.push([c[0] + mx * k, c[1] + my * k]);
  }
  return out;
}

// --- The mesh -------------------------------------------------------------------------------------

export class CardMesh {
  constructor() {
    this.f = [];
    this.c = [];
    this.count = 0;
    this.groups = new Map();
    this.stats = { parts: 0, triangles: 0 };
  }

  _group(id) {
    if (!this.groups.has(id)) this.groups.set(id, { solid: [], rim: [] });
    return this.groups.get(id);
  }

  _v(x, y, z, w, nx, ny, nz, uv, fa, fb, mat, col, kind, ink, dens) {
    this.f.push(x, y, z, w, nx, ny, nz, uv ? uv[0] : -1, uv ? uv[1] : -1, fa, fb, mat);
    this.c.push(col[0], col[1], col[2], kind, ink[0], ink[1], ink[2], dens);
    return this.count++;
  }

  // Adds one part. spec:
  //   frame          Frame index the part rides on; with frameB set the part crosses a Fold
  //   outline, holes points in the frame's plane (cm)
  //   z0, z1         bottom and top of the sheet along the frame normal
  //   front, back, edge   colours as [r, g, b] 0..255 sRGB
  //   uv, uvBack     (x, y) -> [u, v] into the print atlas, or null
  //   screen         (x, y) -> 0..1 halftone density, must be linear in x and y; ink its colour
  //   mat            material id for the shader
  //   hasBack, hasWalls, hasRim   switch faces off for parts glued flat or cut from thick stock
  //   bend           width of the bent strip at the crease (fold parts)
  //   foldEdge       (p, q) -> true for an edge that is a fold into another sheet, not a cut:
  //                  it gets no white wall and no pressed rim
  addPart(groupId, spec) {
    const g = this._group(groupId);
    const s = {
      z0: 0, z1: 0.045, front: [240, 236, 226], back: [240, 236, 226], edge: [246, 243, 236], ink: [40, 50, 70],
      uv: null, uvBack: null, screen: null, mat: 0, hasBack: true, hasWalls: true, hasRim: true, bend: BEND_WIDTH, holes: [], ...spec,
    };
    const outline = ccw(cleanPoly(s.outline));
    if (outline.length < 3) return;
    const holes = s.holes.map((h) => cw(cleanPoly(h)));
    this.stats.parts++;
    if (s.frameB === undefined) {
      this._sheet(g, s, s.frame, outline, holes, () => false);
      return;
    }
    const wh = s.bend / 2;
    const left = clipHalfPlane(outline, -1, 0, -wh), right = clipHalfPlane(outline, 1, 0, -wh);
    const cx = (h) => h.reduce((a, p) => a + p[0], 0) / h.length;
    if (left.length >= 3) this._sheet(g, s, s.frame, ccw(left), holes.filter((h) => cx(h) < 0), (p, q) => Math.abs(p[0] + wh) < EPS && Math.abs(q[0] + wh) < EPS);
    if (right.length >= 3) this._sheet(g, s, s.frameB, ccw(right), holes.filter((h) => cx(h) >= 0), (p, q) => Math.abs(p[0] - wh) < EPS && Math.abs(q[0] - wh) < EPS);
    this._bend(g, s, outline, wh);
  }

  _sheet(g, s, frame, outline, holes, atCrease) {
    const skipEdge = s.foldEdge ? (p, q) => atCrease(p, q) || s.foldEdge(p, q) : atCrease;
    const { pts, tris } = triangulate(outline, holes);
    const dens = (p) => (s.screen ? Math.max(0, Math.min(255, Math.round(s.screen(p[0], p[1]) * 255))) : 0);
    let base = this.count;
    for (const p of pts) this._v(p[0], p[1], s.z1, -1, 0, 0, 1, s.uv && s.uv(p[0], p[1]), frame, frame, s.mat, s.front, KIND.FACE, s.ink, dens(p));
    for (let i = 0; i < tris.length; i += 3) g.solid.push(base + tris[i], base + tris[i + 1], base + tris[i + 2]);
    this.stats.triangles += tris.length / 3;
    if (s.hasBack) {
      base = this.count;
      for (const p of pts) this._v(p[0], p[1], s.z0, -1, 0, 0, -1, s.uvBack && s.uvBack(p[0], p[1]), frame, frame, s.mat, s.back, KIND.FACE, s.ink, 0);
      for (let i = 0; i < tris.length; i += 3) g.solid.push(base + tris[i], base + tris[i + 2], base + tris[i + 1]);
      this.stats.triangles += tris.length / 3;
    }
    for (const loop of [outline, ...holes]) {
      const n = loop.length;
      const en = [];
      for (let i = 0; i < n; i++) {
        const p = loop[i], q = loop[(i + 1) % n];
        const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
        en.push([dy / l, -dx / l]);
      }
      const vn = (i, e) => {
        // Normal at corner i as seen from edge e: rounded if the corner is blunt.
        const a = en[(i + n - 1) % n], b = en[i % n];
        if (a[0] * b[0] + a[1] * b[1] > SMOOTH_COS) {
          const mx = a[0] + b[0], my = a[1] + b[1], l = Math.hypot(mx, my) || 1;
          return [mx / l, my / l];
        }
        return en[e];
      };
      const inner = s.hasRim ? insetLoop(loop, RIM_WIDTH) : null;
      for (let i = 0; i < n; i++) {
        const p = loop[i], q = loop[(i + 1) % n];
        if (skipEdge(p, q)) continue;
        if (s.hasWalls) {
          const n0 = vn(i, i), n1 = vn(i + 1, i);
          const b = this.count;
          this._v(p[0], p[1], s.z0, -1, n0[0], n0[1], 0, null, frame, frame, s.mat, s.edge, KIND.WALL, s.ink, 0);
          this._v(q[0], q[1], s.z0, -1, n1[0], n1[1], 0, null, frame, frame, s.mat, s.edge, KIND.WALL, s.ink, 0);
          this._v(q[0], q[1], s.z1, -1, n1[0], n1[1], 0, null, frame, frame, s.mat, s.edge, KIND.WALL, s.ink, 0);
          this._v(p[0], p[1], s.z1, -1, n0[0], n0[1], 0, null, frame, frame, s.mat, s.edge, KIND.WALL, s.ink, 0);
          g.solid.push(b, b + 1, b + 2, b, b + 2, b + 3);
          this.stats.triangles += 2;
        }
        if (inner) {
          const ip = inner[i], iq = inner[(i + 1) % n];
          const e = en[i], tz = Math.sqrt(1 - RIM_TILT * RIM_TILT), z = s.z1 + RIM_LIFT;
          const b = this.count;
          this._v(p[0], p[1], z, -1, e[0] * RIM_TILT, e[1] * RIM_TILT, tz, s.uv && s.uv(p[0], p[1]), frame, frame, s.mat, s.front, KIND.RIM, s.ink, 0);
          this._v(q[0], q[1], z, -1, e[0] * RIM_TILT, e[1] * RIM_TILT, tz, s.uv && s.uv(q[0], q[1]), frame, frame, s.mat, s.front, KIND.RIM, s.ink, 0);
          this._v(iq[0], iq[1], z, -1, 0, 0, 1, s.uv && s.uv(iq[0], iq[1]), frame, frame, s.mat, s.front, KIND.FACE, s.ink, dens(iq));
          this._v(ip[0], ip[1], z, -1, 0, 0, 1, s.uv && s.uv(ip[0], ip[1]), frame, frame, s.mat, s.front, KIND.FACE, s.ink, dens(ip));
          g.rim.push(b, b + 1, b + 2, b, b + 2, b + 3);
          this.stats.triangles += 2;
        }
      }
    }
  }

  // The bent strip of a fold part between x = -wh and x = +wh.
  _bend(g, s, outline, wh) {
    const cols = [];
    for (let i = 0; i <= BEND_STEPS; i++) {
      const u = i / BEND_STEPS;
      cols.push({ u, x: (u - 0.5) * 2 * wh, ys: crossingsX(outline, (u - 0.5) * 2 * wh * 0.999) });
    }
    const spans = cols[0].ys.length;
    if (spans < 2 || cols.some((c) => c.ys.length !== spans)) return;
    const fa = s.frame, fb = s.frameB;
    for (let k = 0; k + 1 < spans; k += 2) {
      const row = (z, nz, uvf, col) => {
        const b = this.count;
        for (const c of cols) {
          for (const y of [c.ys[k], c.ys[k + 1]]) {
            this._v(wh, y, z, c.u, 0, 0, nz, uvf && uvf(c.x, y), fa, fb, s.mat, col, KIND.BEND, s.ink, s.screen ? Math.round(Math.max(0, Math.min(1, s.screen(c.x, y))) * 255) : 0);
          }
        }
        return b;
      };
      const f = row(s.z1, 1, s.uv, s.front);
      for (let i = 0; i < BEND_STEPS; i++) g.solid.push(f + i * 2, f + i * 2 + 2, f + i * 2 + 3, f + i * 2, f + i * 2 + 3, f + i * 2 + 1);
      this.stats.triangles += BEND_STEPS * 2;
      if (s.hasBack) {
        const b = row(s.z0, -1, s.uvBack, s.back);
        for (let i = 0; i < BEND_STEPS; i++) g.solid.push(b + i * 2, b + i * 2 + 3, b + i * 2 + 2, b + i * 2, b + i * 2 + 1, b + i * 2 + 3);
        this.stats.triangles += BEND_STEPS * 2;
      }
      if (s.hasWalls) {
        for (const [yi, ny] of [[k, -1], [k + 1, 1]]) {
          const b = this.count;
          for (const c of cols) {
            this._v(wh, c.ys[yi], s.z0, c.u, 0, ny, 0, null, fa, fb, s.mat, s.edge, KIND.WALL, s.ink, 0);
            this._v(wh, c.ys[yi], s.z1, c.u, 0, ny, 0, null, fa, fb, s.mat, s.edge, KIND.WALL, s.ink, 0);
          }
          for (let i = 0; i < BEND_STEPS; i++) {
            const a = b + i * 2;
            if (ny < 0) g.solid.push(a, a + 2, a + 3, a, a + 3, a + 1);
            else g.solid.push(a, a + 3, a + 2, a, a + 1, a + 3);
          }
          this.stats.triangles += BEND_STEPS * 2;
        }
      }
    }
  }

  // Packs everything. ranges[id] = { solid: [first, count], rim: [first, count] } in the index buffer.
  // order lists group ids in the order they should be laid out.
  finish(order) {
    const ids = order || [...this.groups.keys()];
    let total = 0;
    for (const id of ids) { const g = this._group(id); total += g.solid.length + g.rim.length; }
    const idx = new Uint32Array(total);
    const ranges = {};
    let at = 0;
    for (const id of ids) {
      const g = this._group(id);
      idx.set(g.solid, at);
      idx.set(g.rim, at + g.solid.length);
      ranges[id] = { solid: [at, g.solid.length], rim: [at + g.solid.length, g.rim.length] };
      at += g.solid.length + g.rim.length;
    }
    return { f32: new Float32Array(this.f), u8: new Uint8Array(this.c), idx, ranges, vertices: this.count, stats: this.stats };
  }
}
