// engine/fold.js
// Paper-fold kinematics for pop-up books. Pure maths: no WebGL, no DOM.
//
// Everything is a rigid flat panel. A panel is a Frame: an origin and two unit axes in its plane.
// A mechanism reads the frames it is glued to and writes the frames of its own panels, so the whole
// book is solved from one number per page (its angle) in a single ordered pass. Nothing is simulated.
//
// Conventions
//   Frame  : world = o + x*a + y*b + n*c, with n = x cross y. The printed "front" is the +n side.
//   Fold   : two frames {A, B} that share an origin and a y axis. The crease is the line x = 0.
//            A covers x <= 0, B covers x >= 0, and both x axes run from the A side to the B side.
//            A spread of the book, a V-fold piece and a tent are all Folds, so art for any of them
//            is drawn once, flat, with the crease down the middle.
//   Hinge  : a line shared by two planes, as { P, h, uA, uB, nA, nB, fA, fB }.
//            P a point on it, h its unit direction, uA/uB unit vectors in each plane pointing away
//            from the line, nA/nB the normals of the faces the mechanism is glued to.
//
// Mechanisms (methods of Rig)
//   vfold     two panels glued along lines that meet at a point on the hinge (a spherical linkage)
//   parallel  two panels glued along lines parallel to the hinge (a planar four-bar): tents, boxes,
//             and the parallelogram that holds a layer upright in front of another panel
//   float     a platform held parallel to both pages above them (a floating layer)
//   planar    a part that slides or turns in the plane of its parent: pull tabs, wheels, sliders

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const neg = (a) => [-a[0], -a[1], -a[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const comb = (a, s, b, t) => [a[0] * s + b[0] * t, a[1] * s + b[1] * t, a[2] * s + b[2] * t];
export const vec = { add, sub, mul, neg, dot, cross, len, norm, comb };

const RAD = Math.PI / 180;
const SOLVE_EPS = 1e-9;   // below this a linkage is treated as at its limit (flat or fully stretched)

export class Frame {
  constructor(id) {
    this.id = id;
    this.o = [0, 0, 0]; this.x = [1, 0, 0]; this.y = [0, 1, 0]; this.n = [0, 0, 1];
  }
  set(o, x, y) {
    this.o = o; this.x = x; this.y = y; this.n = cross(x, y);
    return this;
  }
  // Local (a, b, c) to world.
  point(a, b, c = 0) {
    const { o, x, y, n } = this;
    return [o[0] + x[0] * a + y[0] * b + n[0] * c, o[1] + x[1] * a + y[1] * b + n[1] * c, o[2] + x[2] * a + y[2] * b + n[2] * c];
  }
  dir(a, b, c = 0) {
    const { x, y, n } = this;
    return [x[0] * a + y[0] * b + n[0] * c, x[1] * a + y[1] * b + n[1] * c, x[2] * a + y[2] * b + n[2] * c];
  }
  // World point to local (a, b, c).
  local(p) {
    const d = sub(p, this.o);
    return [dot(d, this.x), dot(d, this.y), dot(d, this.n)];
  }
  // How far the axes are from unit length and from square to each other. 0 for a true rigid frame.
  error() {
    return Math.max(Math.abs(len(this.x) - 1), Math.abs(len(this.y) - 1), Math.abs(dot(this.x, this.y)));
  }
}

// The hinge down the crease of a Fold, at distance y0 along it.
export function hingeOfFold(F, y0 = 0) {
  return () => ({ P: F.A.point(0, y0, 0), h: F.A.y, uA: neg(F.A.x), uB: F.B.x, nA: F.A.n, nB: F.B.n, fA: F.A, fB: F.B });
}

// Interior angle of a fold in radians: pi when flat open, 0 when shut.
export function foldAngle(F) {
  return Math.acos(Math.max(-1, Math.min(1, dot(neg(F.A.x), F.B.x))));
}

export class Rig {
  constructor() {
    this.frames = [];
    this.steps = [];
    this.group = 0;          // steps and frames made from now on belong to this group
    this.world = this.frame();
  }

  frame() {
    const f = new Frame(this.frames.length);
    f.group = this.group;
    this.frames.push(f);
    return f;
  }

  // Registers a solver step and runs it once, so later mechanisms can read its frames while building.
  step(fn) {
    this.steps.push({ group: this.group, fn });
    fn();
  }

  // Solves every mechanism in the order it was made. active(group) can skip closed spreads.
  update(active) {
    for (const s of this.steps) if (!active || active(s.group)) s.fn();
  }

  // Writes all frames as 12 floats each (o, x, y with one spare float after each) for a float texture.
  pack(out) {
    const fr = this.frames;
    for (let i = 0; i < fr.length; i++) {
      const f = fr[i], k = i * 12;
      out[k] = f.o[0]; out[k + 1] = f.o[1]; out[k + 2] = f.o[2];
      out[k + 4] = f.x[0]; out[k + 5] = f.x[1]; out[k + 6] = f.x[2];
      out[k + 8] = f.y[0]; out[k + 9] = f.y[1]; out[k + 10] = f.y[2];
    }
    return out;
  }

  // Largest departure from rigid over all frames. Should stay near 1e-15.
  maxError() {
    let e = 0;
    for (const f of this.frames) e = Math.max(e, f.error());
    return e;
  }

  fixed(o, x, y) {
    return this.frame().set(o, norm(x), norm(y));
  }

  // A part that moves in the plane of its parent. fn() returns { x, y, rot, z }: a shift along the
  // parent's axes, a turn in radians about its normal, and a lift along the normal.
  planar(parent, fn) {
    const f = this.frame();
    this.step(() => {
      const m = fn();
      const r = m.rot || 0, c = Math.cos(r), s = Math.sin(r);
      f.set(parent.point(m.x || 0, m.y || 0, m.z || 0), comb(parent.x, c, parent.y, s), comb(parent.x, -s, parent.y, c));
    });
    return f;
  }

  // V-fold. Two panels, each glued to one side of the hinge along a line through the apex (the
  // hinge point). alpha is the angle between a glue line and the hinge direction h, measured in the
  // page. beta is the angle between that glue line and the centre crease, measured in the card.
  // The crease direction c is the unit vector at angle betaA from one glue line and betaB from the
  // other: the meeting of two cones, picked on the side the pop-up stands on.
  //   alpha < 90: the arms run along +h from the apex and the piece folds down towards -h.
  //   alpha > 90: the arms run back along -h and the piece folds down towards +h.
  // Returns a Fold { A, B } whose crease runs from the apex, plus glueHinge() for layers in front.
  vfold(hinge, o) {
    const aA = (o.alphaA ?? o.alpha) * RAD, aB = (o.alphaB ?? o.alpha) * RAD;
    const bA = (o.betaA ?? o.beta) * RAD, bB = (o.betaB ?? o.beta) * RAD;
    const A = this.frame(), B = this.frame();
    const out = { kind: 'v', A, B, alphaA: aA, alphaB: aB, betaA: bA, betaB: bB, ok: true, hinge };
    const ca = Math.cos(bA), cb = Math.cos(bB);
    this.step(() => {
      const H = hinge();
      const gA = comb(H.h, Math.cos(aA), H.uA, Math.sin(aA));
      const gB = comb(H.h, Math.cos(aB), H.uB, Math.sin(aB));
      const g = dot(gA, gB);
      const den = 1 - g * g;
      const up = norm(add(H.nA, H.nB));
      let c;
      if (den < SOLVE_EPS) {
        // Glue lines in one line (a page dead flat with alpha = 90): any upright crease fits.
        c = up; out.ok = false;
      } else {
        const s = (ca - g * cb) / den, t = (cb - g * ca) / den;
        const r2 = 1 - (s * s + t * t + 2 * s * t * g);
        let m = norm(cross(gA, gB));
        if (dot(m, up) < 0) m = neg(m);
        out.ok = r2 > -1e-7;
        c = norm(add(comb(gA, s, gB, t), mul(m, Math.sqrt(Math.max(r2, 0)))));
      }
      const wA = norm(sub(gA, mul(c, dot(gA, c))));
      const wB = norm(sub(gB, mul(c, dot(gB, c))));
      A.set(H.P, neg(wA), c);
      B.set(H.P, wB, c);
      out.gA = gA; out.gB = gB;
    });
    // The hinge between a page and the panel standing on it, along the glue line. r0 moves the
    // hinge point out from the apex. front picks the side of the panel that carries its print.
    out.glueHinge = (side, { front = true, r0 = 0 } = {}) => {
      const panel = side === 'A' ? A : B;
      const pick = (H) => (side === 'A' ? [H.uA, H.nA, H.fA, out.gA] : [H.uB, H.nB, H.fB, out.gB]);
      const first = pick(hinge());
      const sign = Math.sign(dot(cross(first[1], first[3]), panel.n)) || 1;
      return () => {
        const [, nHost, fHost, g] = pick(hinge());
        const f = mul(cross(nHost, g), front ? sign : -sign);
        const q = norm(sub(panel.y, mul(g, dot(panel.y, g))));
        return { P: add(panel.o, mul(g, r0)), h: g, uA: f, uB: q, nA: nHost, nB: front ? panel.n : neg(panel.n), fA: fHost, fB: panel };
      };
    };
    return out;
  }

  // Parallel fold. Two panels glued along lines parallel to the hinge: one at distance a from it on
  // plane A, one at distance b on plane B. Panel widths are p and q and they meet at a ridge.
  // In the section across the hinge this is two circles meeting; the ridge is taken on the side the
  // pop-up stands on.
  //   p + q > a + b : a tent that stands when the host is flat open.
  //   p = b, q = a  : a parallelogram. Panel A stays parallel to plane B at every angle, which is
  //                   how a flat layer is held upright in front of a backdrop.
  // Folds flat only if a + p = b + q. Returns a Fold { A, B } (crease = ridge) and, for layers,
  // stand (base on plane A, x along the hinge, y up the panel) and strut (ridge back to plane B).
  parallel(hinge, o) {
    const { a, b, p, q } = o;
    const y0 = o.y0 || 0;
    const A = this.frame(), B = this.frame(), stand = this.frame(), strut = this.frame();
    const out = { kind: 'p', A, B, stand, strut, a, b, p, q, ok: true, hinge, y0 };
    this.step(() => {
      const H = hinge();
      const O = add(H.P, mul(H.h, y0));
      const PA = add(O, mul(H.uA, a)), PB = add(O, mul(H.uB, b));
      const d = sub(PB, PA), D = len(d);
      const e = mul(d, 1 / (D || 1));
      let f = cross(H.h, e);
      if (dot(f, add(H.nA, H.nB)) < 0) f = neg(f);
      const along = (p * p - q * q + D * D) / (2 * (D || 1));
      const h2 = p * p - along * along;
      out.ok = h2 > -1e-7 && D > SOLVE_EPS;
      const R = add(PA, comb(e, along, f, Math.sqrt(Math.max(h2, 0))));
      const xA = norm(sub(R, PA)), xB = norm(sub(PB, R));
      A.set(R, xA, H.h);
      B.set(R, xB, H.h);
      const sx = cross(H.nA, H.uA);
      stand.set(PA, sx, xA);
      strut.set(R, sx, xB);
      out.PA = PA; out.PB = PB; out.R = R;
    });
    return out;
  }

  // Floating layer. A platform in two halves, each held parallel to its page at the given height by
  // a centre fin that stands in the bisecting plane of the two pages and by a leg on each page.
  // Each half is a parallelogram with its page, so it folds flat with the book. The fin keeps to the
  // bisector by symmetry (in card, the two halves pull on it equally).
  // Returns a Fold { A, B } for the platform, the fin frame, and leg(side, d) for a leg at distance d.
  float(F, o) {
    const height = o.height, y0 = o.y0 || 0;
    const A = this.frame(), B = this.frame(), fin = this.frame();
    const out = { kind: 'f', A, B, fin, height, y0, legs: [] };
    const upOf = () => norm(add(F.A.n, F.B.n));
    this.step(() => {
      const up = upOf();
      const lift = mul(up, height);
      A.set(add(F.A.o, lift), F.A.x, F.A.y);
      B.set(add(F.B.o, lift), F.B.x, F.B.y);
      fin.set(F.A.point(0, y0, 0), norm(cross(up, F.B.x)), up);
      out.up = up;
    });
    out.leg = (side, d) => {
      const host = side === 'A' ? F.A : F.B;
      const leg = this.frame();
      this.step(() => {
        const up = upOf();
        const u = side === 'A' ? neg(host.x) : host.x;
        leg.set(add(host.point(0, y0, 0), mul(u, d)), norm(cross(up, u)), up);
      });
      out.legs.push({ side, d, frame: leg });
      return leg;
    };
    return out;
  }
}

// Sweeps a rig through its motion and reports how well the paper rules hold.
//   setPose(t) puts the rig at pose t in 0..1 (and calls rig.update).
//   seams: [{ a: Frame, pa: [x, y, z], b: Frame, pb: [x, y, z] }] pairs of points that are the same
//          spot of card or glue seen from two panels; they must stay together.
// Returns { rigid, seam, unsolved }: the worst frame error, the worst gap at a seam (same units as
// the model), and how many poses had a linkage past its reach.
export function verify(rig, setPose, seams = [], folds = [], steps = 48) {
  let rigid = 0, seam = 0, unsolved = 0;
  for (let i = 0; i <= steps; i++) {
    setPose(i / steps);
    rigid = Math.max(rigid, rig.maxError());
    for (const s of seams) seam = Math.max(seam, len(sub(s.a.point(...s.pa), s.b.point(...s.pb))));
    for (const f of folds) if (f.ok === false) unsolved++;
  }
  return { rigid, seam, unsolved };
}
