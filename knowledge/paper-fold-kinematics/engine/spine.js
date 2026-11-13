// engine/spine.js
// How a book of stiff, thick leaves lies on a table as its pages turn. Pure maths, in the section
// across the spine (x across the table, y up).
//
// The leaves form a chain. Leaf j has a front face and a back face a thickness apart. Spread k is the
// gap between the back of leaf k-1 and the front of leaf k, and those two faces are joined by a hinge
// along their spine edges. So every spread has a hinge line that lies exactly in both of its printed
// faces: pop-ups glued to the pages can be solved on the real surfaces, with nothing sunk into the
// card. (A single axis for the whole book would need leaves of no thickness.)
//
// At any moment one leaf may be in the air. The leaves under it on each side form a stack, fanned by
// a small angle (the room the folded pop-ups take). Each stack hangs from its hinge and comes to rest
// on the table: flat if the hinge is as low as the stack is thick, otherwise with its outer edge down.
//
// createSpine({ thickness: [leaf 0 .. leaf N], fan, reach }) -> { pose(turn), phi, px, py, restR, restL }
//   turn    0 = shut with every leaf on the right, k = spread k open, between = leaf floor(turn) in the air
//   phi[j]  direction of leaf j from its spine edge (0 = lying to the right, pi = to the left)
//   px, py  the spine edge of leaf j's front face. Its back edge is that minus normal * thickness,
//           with normal = (-sin phi, cos phi).
//   restR/restL[j]  the angle leaf j rests at on the right-hand and left-hand stack

const STEPS = 44;   // halvings when finding where a stack comes to rest (well past float precision)

export function createSpine({ thickness, fan, reach }) {
  const t = thickness, N = t.length - 1;
  const phi = new Float64Array(N + 1), px = new Float64Array(N + 1), py = new Float64Array(N + 1);

  // Height a hinge must have for the stack below it to lie flat: leaves a..N on the right, 0..b on the left.
  const flatR = (a) => { let s = 0; for (let i = a; i <= N; i++) s += t[i] * Math.cos((N - i) * fan); return s; };
  const flatL = (b) => { let s = 0; for (let i = 0; i <= b; i++) s += t[i] * Math.cos(i * fan); return b < 0 ? -Infinity : s; };

  // Lays out leaves a..N below a hinge at (x, y), top leaf at angle A. Returns the height of the
  // outer edge of the bottom cover.
  function right(a, x, y, A) {
    for (let j = a; j <= N; j++) {
      const ang = A - (j - a) * fan;
      phi[j] = ang; px[j] = x; py[j] = y;
      x += Math.sin(ang) * t[j]; y -= Math.cos(ang) * t[j];
    }
    return y + Math.sin(phi[N]) * reach;
  }
  // Lays out leaves b..0 below a hinge at (x, y) on the back of leaf b, top leaf at angle B.
  function left(b, x, y, B) {
    for (let j = b; j >= 0; j--) {
      const ang = B + (b - j) * fan;
      phi[j] = ang;
      x -= Math.sin(ang) * t[j]; y += Math.cos(ang) * t[j];
      px[j] = x; py[j] = y;
    }
    return y + Math.sin(phi[0]) * reach;
  }
  function settleRight(a, x, y) {
    let lo = -0.8, hi = 0.9;
    for (let i = 0; i < STEPS; i++) { const m = (lo + hi) / 2; if (right(a, x, y, m) < 0) lo = m; else hi = m; }
    right(a, x, y, (lo + hi) / 2);
  }
  function settleLeft(b, x, y) {
    let lo = Math.PI - 0.9, hi = Math.PI + 0.8;
    for (let i = 0; i < STEPS; i++) { const m = (lo + hi) / 2; if (left(b, x, y, m) > 0) lo = m; else hi = m; }
    left(b, x, y, (lo + hi) / 2);
  }
  // Spread k lying open (k = 0: the shut book).
  function whole(k) {
    const y = Math.max(flatL(k - 1), flatR(k));
    settleRight(k, 0, y);
    if (k >= 1) settleLeft(k - 1, 0, y);
  }

  const restR = new Float64Array(N + 1), restL = new Float64Array(N + 1);
  for (let k = 0; k <= N; k++) {
    whole(k);
    restR[k] = phi[k];
    if (k >= 1) restL[k - 1] = phi[k - 1];
  }

  function pose(turn) {
    turn = Math.max(0, Math.min(N, turn));
    const j = Math.min(N - 1, Math.floor(turn)), tau = turn - j;
    if (tau < 1e-9) { whole(j); return; }
    if (tau > 1 - 1e-9) { whole(j + 1); return; }
    // Leaf j in the air. Its back edge carries the right-hand stack, its front edge the left-hand one.
    const a = restR[j] + (restL[j] - restR[j]) * tau, c = Math.cos(a), s = Math.sin(a);
    const qy = Math.max(flatR(j + 1), flatL(j - 1) - t[j] * c);
    const qx = (1 - tau) * s * t[j];   // slides the hinge a hair so both ends of the turn meet the resting poses
    settleRight(j + 1, qx, qy);
    phi[j] = a; px[j] = qx - s * t[j]; py[j] = qy + c * t[j];
    if (j >= 1) settleLeft(j - 1, px[j], py[j]);
  }

  return { pose, phi, px, py, restR, restL, leaves: N + 1, thickness: t };
}
