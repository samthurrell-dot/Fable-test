// src/art.js
// Drawing kit for the book: the card colours, outline builders (for cutting) and print helpers
// (for the ink on the card). Outlines are arrays of [x, y] in cm. Print helpers draw on a
// Canvas 2D context that is already set to the part's own cm units with y up.

// Card stock. One sheet colour per name; a spread uses five or six of them.
export const C = {
  white: '#f6f2e8', cream: '#efe4c8', snow: '#fbfaf5', ink: '#27323c',
  sky: '#cfe4ea', mist: '#e4ecec', water: '#4a97bd', deep: '#27679a', navy: '#1b3a5c', teal: '#2e8c88', foam: '#eef6f4',
  meadow: '#b7cf72', moss: '#8db458', leaf: '#5d9f52', pine: '#22614a', dusk: '#184a44',
  sun: '#f6c64a', ochre: '#e2b055', orange: '#ee8b3d', red: '#d6452f', brick: '#c2543c', rose: '#e89a8d',
  brown: '#7b4b30', bark: '#4f3122', stone: '#929ca6', slate: '#58718f', violet: '#6c5b8f', mauve: '#b89cc2', sand: '#e0cf9a',
};

export const hexRgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
// A colour moved towards white (t > 0) or black (t < 0).
export function tint(hex, t) {
  const c = hexRgb(hex).map((v) => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export const FONT = '"Fraunces", "Iowan Old Style", Georgia, serif';

// --- Outlines -----------------------------------------------------------------------------------------

export const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

export function rrect(x0, y0, x1, y1, r, n = 5) {
  const out = [];
  const corner = (cx, cy, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  corner(x1 - r, y0 + r, -Math.PI / 2); corner(x1 - r, y1 - r, 0); corner(x0 + r, y1 - r, Math.PI / 2); corner(x0 + r, y0 + r, Math.PI);
  return out;
}

export function ellipse(cx, cy, rx, ry = rx, n = 32, a0 = 0, a1 = Math.PI * 2) {
  const out = [], full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
  const m = full ? n : n + 1;
  for (let i = 0; i < m; i++) { const a = a0 + ((a1 - a0) * i) / n; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return out;
}

// A smooth curve through points (Catmull-Rom), per steps to each span.
export function smooth(pts, per = 6, closed = false) {
  const n = pts.length, out = [];
  const at = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const spans = closed ? n : n - 1;
  for (let i = 0; i < spans; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  if (!closed) out.push(pts[n - 1].slice());
  return out;
}

export const shift = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
export const grow = (pts, sx, sy = sx, cx = 0, cy = 0) => pts.map(([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);
export const flipX = (pts) => pts.map(([x, y]) => [-x, y]).reverse();
export function turn(pts, a, cx = 0, cy = 0) {
  const c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]);
}

// A fir: stacked skirts on a short trunk. (cx, y) is the foot, h the height, w the widest skirt.
export function fir(cx, y, h, w, tiers = 4, trunk = 0.12) {
  const th = h * trunk, tw = w * 0.07, hh = h - th;
  const right = [[cx + tw, y], [cx + tw, y + th]];
  for (let i = 0; i < tiers; i++) {
    const wi = (w / 2) * (1 - (0.7 * i) / tiers);
    right.push([cx + wi, y + th + (hh * i) / tiers]);
    if (i < tiers - 1) right.push([cx + (w / 2) * (1 - (0.7 * (i + 1)) / tiers) * 0.48, y + th + (hh * (i + 1)) / tiers]);
  }
  const left = right.map(([x, yy]) => [2 * cx - x, yy]).reverse();
  return [...right, [cx, y + h], ...left];
}

// A round-headed broadleaf tree as one outline.
export function tree(cx, y, h, w, lumps = 7, seed = 1) {
  const tw = w * 0.07, th = h * 0.34, out = [[cx + tw, y], [cx + tw * 0.8, y + th]];
  const cy = y + th + (h - th) * 0.5, rx = w / 2, ry = (h - th) * 0.56;
  const pts = [];
  for (let i = 0; i <= lumps * 4; i++) {
    const a = -Math.PI * 0.42 + (i / (lumps * 4)) * Math.PI * 1.84;
    const bump = 1 + 0.085 * Math.cos(i * Math.PI / 2 + seed) + 0.03 * Math.sin(i * 1.7 + seed * 3);
    pts.push([cx + Math.cos(a) * rx * bump, cy + Math.sin(a) * ry * bump]);
  }
  return [...out, ...pts, [cx - tw * 0.8, y + th], [cx - tw, y]];
}

// The skyline of a standing piece closed down to a base. top runs left to right; base(x) gives the
// bottom edge (the glue line) under any x.
export function standing(top, base = () => 0) {
  const a = top[0], b = top[top.length - 1];
  const bottom = [];
  const n = 12;
  for (let i = 0; i <= n; i++) { const x = b[0] + ((a[0] - b[0]) * i) / n; bottom.push([x, base(x)]); }
  // make sure the base passes through x = 0 where a V-fold's glue lines meet
  if (a[0] < 0 && b[0] > 0 && !bottom.some((p) => Math.abs(p[0]) < 1e-6)) { bottom.push([0, base(0)]); bottom.sort((p, q) => q[0] - p[0]); }
  return [...top, ...bottom];
}

// A row of wave crests from x0 to x1: y = base + crest shapes of the given height and length.
export function crests(x0, x1, base, height, length, phase = 0, per = 10, lean = 0.28) {
  const out = [];
  const n = Math.ceil(((x1 - x0) / length) * per);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const t = (((x / length + phase) % 1) + 1) % 1;
    // a rounded back and a steeper face, leaning the way the sea runs
    const s = t < 0.62 ? Math.sin((t / 0.62) * Math.PI / 2) : Math.cos(((t - 0.62) / 0.38) * Math.PI / 2);
    out.push([x + lean * height * s * (t < 0.62 ? 1 : 0.4), base + height * s * s]);
  }
  return out;
}

// A small folded-paper boat seen from the side, about `s` cm long, foot at (cx, y).
export function boatHull(cx, y, s) {
  return [[cx - s * 0.5, y + s * 0.3], [cx - s * 0.3, y], [cx + s * 0.3, y], [cx + s * 0.5, y + s * 0.3]];
}
export function boatSail(cx, y, s) {
  return [[cx - s * 0.26, y + s * 0.3], [cx + s * 0.26, y + s * 0.3], [cx, y + s * 0.74]];
}

// --- Printing -----------------------------------------------------------------------------------------

function trace(ctx, pts, closed) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (closed) ctx.closePath();
}
export function fill(ctx, pts, colour) { trace(ctx, pts, true); ctx.fillStyle = colour; ctx.fill(); }
export function stroke(ctx, pts, colour, width, closed = false) { trace(ctx, pts, closed); ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke(); }
export function disc(ctx, x, y, r, colour) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = colour; ctx.fill(); }
export function ring(ctx, x, y, r, colour, width) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.stroke(); }
export function line(ctx, x0, y0, x1, y1, colour, width) { stroke(ctx, [[x0, y0], [x1, y1]], colour, width); }
export function box(ctx, x0, y0, x1, y1, colour) { ctx.fillStyle = colour; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }

// Text. size is the font size in cm; (x, y) the baseline start; rot in radians, anticlockwise.
export function text(ctx, str, x, y, size, o = {}) {
  const m = ctx.getTransform();
  const p = new DOMPoint(x, y).matrixTransform(m);
  const d = Math.hypot(m.a, m.b);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(p.x, p.y);
  if (o.rot) ctx.rotate(-o.rot);
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 500} ${size * d}px ${o.font || FONT}`;
  ctx.textAlign = o.align || 'left';
  ctx.textBaseline = 'alphabetic';
  if (o.spacing && 'letterSpacing' in ctx) ctx.letterSpacing = `${o.spacing * size * d}px`;
  ctx.fillStyle = o.colour || C.ink;
  ctx.fillText(str, 0, 0);
  ctx.restore();
}

// Wrapped text in a column `width` cm wide. Returns the y of the line after the last.
export function textBlock(ctx, str, x, y, size, width, o = {}) {
  const m = ctx.getTransform();
  const d = Math.hypot(m.a, m.b);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 500} ${size * d}px ${o.font || FONT}`;
  const lines = [];
  let cur = '';
  for (const w of str.split(' ')) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(t).width > width * d) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  ctx.restore();
  const lh = size * (o.leading || 1.32);
  lines.forEach((l, i) => text(ctx, l, o.align === 'right' ? x + width : o.align === 'center' ? x + width / 2 : x, y - i * lh, size, o));
  return y - lines.length * lh;
}

// Scattered marks: calls draw(x, y, i) at n repeatable pseudo-random spots inside a box.
export function scatter(n, x0, y0, x1, y1, seed, draw) {
  let s = seed * 9301 + 49297;
  const rnd = () => { s = (s * 233280 + 12345.678) % 1; s = Math.abs(Math.sin(s * 91.7 + seed) * 43758.5453) % 1; return s; };
  for (let i = 0; i < n; i++) draw(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), i, rnd);
}
