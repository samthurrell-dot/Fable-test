# Paper-fold kinematics (pop-up mechanisms and a book spine)

Harvested from: builds/15-popup-book (Claude Fable 5.2, default effort, 12–13 Nov 2026)
Engine: knowledge/paper-fold-kinematics/engine/fold.js and engine/spine.js   Demo: knowledge/paper-fold-kinematics/demo.html

Both engine files are byte-for-byte copies of the build's. Pure maths: no WebGL, no DOM, no other files needed.

## What it does
Places every piece of a pop-up exactly, from one number: how far the pages are open. Each piece of card is a rigid flat panel, and each paper mechanism (V-fold, parallel fold, floating layer, sliding or turning part) is solved in closed form from the panels it is glued to. `spine.js` does the same for a book of thick leaves lying on a table as its pages turn.

Nothing is simulated, so any pose can be reached directly, forwards or backwards, and nothing stretches or drifts.

## When to use it / when not to
- Use for: pop-up books and cards, folding boxes and packaging, paper theatres, any model made of flat rigid panels joined by creases and glue lines that has one degree of freedom per hinge.
- Use `spine.js` alone for: any book, folder or stack of thick boards hinged along one edge.
- Do not use for: cloth, curved or bowing paper, origami with many creases meeting at a point (those have more than one degree of freedom), anything that needs springiness, or pieces that should collide and push each other. The engine does not stop card passing through card: the checks under Gotchas find that, and you move the piece.

## How it works
1. **Frame.** A panel is an origin `o` and two unit axes `x`, `y` in its plane; `n = x × y` is the printed side. `frame.point(a, b, c)` takes panel coordinates (cm) to the world; `frame.local(p)` goes back.
2. **Fold.** Two frames `{ A, B }` that share an origin and a `y` axis. The crease is the line x = 0; A covers x ≤ 0, B covers x ≥ 0. A spread of a book, a V-fold piece and a tent are all Folds, so art for any of them is drawn once, flat, with the crease down the middle, and any Fold can carry another mechanism.
3. **Hinge.** A function that returns the line two planes share, read fresh at every pose. `hingeOfFold(fold, y0)` is the crease of a Fold with its point `y0` cm up it. `vfold.glueHinge(side, { r0 })` is the glue line between a page and the panel standing on it.
4. **Rig.** `rig.step(fn)` registers a solver and runs it once. `rig.update()` runs every step in the order it was made. Each mechanism below is one step that reads its hinge and writes its own frames.
5. **V-fold** (`rig.vfold`): two panels glued along lines that meet at a point on the hinge. The centre crease is the unit vector at angle `beta` from both glue lines: the meeting of two cones (a spherical four-bar linkage). With glue directions gA, gB and g = gA·gB: c = s·gA + t·gB + r·m, where s = (cos βA − g cos βB)/(1 − g²), t = (cos βB − g cos βA)/(1 − g²), m is the unit normal to both glue lines on the side the piece stands on, and r = √(1 − s² − t² − 2stg). If r² < 0 no card of that shape can make the fold (`ok` is false).
6. **Parallel fold** (`rig.parallel`): two panels glued along lines parallel to the hinge, at distances `a` and `b`, of widths `p` and `q`. In the section across the hinge this is two circles meeting (a planar four-bar linkage).
   - p + q > a + b: a tent that stands when the host is flat open.
   - p = b and q = a: a parallelogram. The result's `stand` frame stays parallel to the other plane at every angle; this is how a flat layer is held upright in front of a backdrop. `strut` is the bit of card that joins it to the backdrop.
7. **Floating layer** (`rig.float`): a platform in two halves, each a parallelogram with its own page, joined over a centre fin that stands in the bisecting plane of the pages. `leg(side, d)` adds a leg `d` cm out.
8. **Planar part** (`rig.planar(parent, fn)`): `fn()` returns `{ x, y, rot, z }`. Pull tabs, wheels and sliders are all this.
9. **Spine** (`createSpine`): worked in the section across the spine. The leaves are a chain: leaf j has a front and a back face a thickness apart, and spread k is hinged along the spine edges of the back of leaf k−1 and the front of leaf k, so each spread's hinge line lies exactly in both of its printed surfaces. The leaves under the open page on each side form a stack, fanned by `fan` a leaf. Each stack hangs from its hinge and comes to rest on the table; the resting angle is found by halving (44 steps).

### Joining the spine to the rig
This is the part of `src/book.js` that turns the spine's section into page frames (page H cm tall, spine along world z):

```js
const spine = createSpine({ thickness, fan: 0.026, reach: W + 0.4 });
const front = [], back = [];
for (let j = 0; j <= N; j++) { front.push(rig.frame()); back.push(rig.frame()); }
rig.step(() => {
  spine.pose(book.turn);                       // 0..N; whole number k = spread k lies open
  for (let j = 0; j <= N; j++) {
    const a = spine.phi[j], c = Math.cos(a), s = Math.sin(a), t = thickness[j];
    front[j].set([spine.px[j], spine.py[j], H / 2], [c, s, 0], [0, 0, -1]);
    back[j].set([spine.px[j] + s * t, spine.py[j] - c * t, H / 2], [-c, -s, 0], [0, 0, -1]);
  }
});
const folds = [];                               // folds[k] is spread k, a Fold
for (let k = 1; k <= N; k++) folds[k] = { A: back[k - 1], B: front[k] };
const opening = (k) => spine.phi[k - 1] - spine.phi[k];   // radians, as last solved
```

Then a pop-up on spread k is `rig.vfold(hingeOfFold(folds[k], y), { alpha: 110, beta: 93 })`, and a layer in front of it is `rig.parallel(v.glueHinge('B', { r0: 8 }), { a: 3, b: 2.5, p: 2.5, q: 3 })`.

## Main options
| Option | Default | Safe range | What it changes |
|---|---|---|---|
| `vfold` `alpha` (degrees) | none | 60–120; used: 110 and 72 | Angle of a glue line from the hinge, measured on the page. Over 90: the arms run towards the reader and the piece folds down away from the reader. Under 90: the other way. Not exactly 90 on a page that opens dead flat. |
| `vfold` `beta` (degrees) | none | 85–95; used: 93 and 87 | Angle between a glue line and the centre crease, measured on the card. 90 is upright when the pages are flat; a few degrees more leans it back. |
| `alphaA/alphaB`, `betaA/betaB` | = alpha, beta | as above | A lopsided V-fold. Check `ok` over the whole motion. |
| `glueHinge` `r0` (cm) | 0 | 0 to the panel's reach | How far along the glue line from the point of the V a layer is centred. `front: false` puts it behind the panel. |
| `parallel` `a`, `b` (cm) | none | 1–8 | Distance of each glue line from the hinge. |
| `parallel` `p`, `q` (cm) | none | tent: p + q > a + b; layer: p = b, q = a | Panel widths. Folds flat only if a + p = b + q. |
| `parallel` `y0` (cm) | 0 | any | Slides the mechanism along its hinge. |
| `float` `height` (cm) | none | 0.5–5 | Height of the platform above both pages. |
| spine `thickness[j]` (cm) | none | 0.04–0.5; used: 0.12 a leaf, 0.30 a cover | Thickness of each leaf, first to last. |
| spine `fan` (radians) | none | 0.02–0.035; used: 0.026 | Angle between resting leaves: the room folded card takes. Smaller and shut spreads have no room for card; larger and the book looks swollen. |
| spine `reach` (cm) | none | page width plus cover overhang | How far the bottom cover reaches from the spine; sets where a tilted stack touches the table. |
| `SOLVE_EPS` (in fold.js) | 1e-9 | leave | Below this a linkage counts as at its limit. |
| `STEPS` (in spine.js) | 44 | leave | Halvings when a stack is settled. |

The build never opened a spread flatter than about 176° (the fan sees to that), and treated a spread under 0.045 rad as shut: its pop-ups were neither solved nor drawn (`rig.group` and `rig.update(active)`).

## Cost
- The whole book (104 frames): 0.15 ms an update on an Intel UHD Graphics 615 laptop, measured in the build.
- The demo rebuilds its rig, sweeps 49 poses and draws in 2D in 3.2 ms a frame at 390 px wide on the same PC (50 draws timed back to back).
- Spine: a few microseconds a pose. No memory to speak of: 12 floats a frame.
- Accuracy over a whole sweep in the demo: panels rigid to 4e-16, glue seams closed to 3e-14 cm. In the build: 9e-16 and 4e-15 cm.

## Gotchas
- **Hinge on the printed surface, not the middle of the leaf.** The build's first book turned every leaf about one shared axis. With real thickness the printed surface was 0.6 mm off the plane the pop-ups were solved on, so a leaning piece passed through the page near its foot and its glue tab showed in front of it. `spine.js` exists to fix this. Do not go back to one axis.
- **Build each spread at its open pose.** `rig.step` runs the solver once when a mechanism is made, and `glueHinge` picks which side is "front" from the pose at that moment. Set the pose (`book.turn = k; rig.update()`) before making spread k's mechanisms. On a shut spread the panel lies in the page, the test has nothing to go on, and sides can come out flipped.
- **Order is the dependency graph.** Steps run in the order they were made. Make the pages first, then what stands on them, then what stands on that.
- **alpha = 90 on a page that is dead flat has no single answer** (the glue lines are in one line). `ok` goes false and the piece is stood upright. Keep spreads a few degrees short of flat, as real books are.
- **Read `ok`.** A linkage past its reach is clamped, not thrown. A tent with p + q < the gap between its glue lines, or a V-fold with betas too small, still returns frames; they are wrong.
- **A tall piece sticks out of the shut book.** A V-fold needs room along the spine of about 0.95 of its height. The build's sun stood 2 cm proud of the shut book until the overhang check found it.
- **The foot of a V-fold piece is not y = 0.** In the piece's flat coordinates the two glue lines are y = |x| / tan(beta). An outline must run along them, or the piece floats or sinks at its feet.
- **V-folds with the same alpha and beta are copies slid along the spine** and can never meet while folding. Rows of waves, hills or streets should share angles.
- **A skipped group keeps its old frames.** If `update(active)` skips a shut spread, do not draw that spread's pop-ups.
- **`pack()` leaves one spare float after each of o, x, y** (12 floats a frame), ready for a 3-texel-wide RGBA32F texture. See the card-mesh-atlas card.
- **Not modelled:** card has no spring, a half-turned page stays where it is left, and the floating layer's fin is held on the bisector by symmetry (a real one sags a little).

### Recipe: the two paper checks (run both before any time is spent on looks)
The build kept these in `src/book.js` as `book.check()` and `book.collisions()`. Both run in the browser console in two or three seconds. They found four real faults that were not visible in a first look. Write the same two for any new model; `verify()` in fold.js does the first three tests of check 1 for you.

**Check 1: the paper rules.** For each spread, sweep it through its whole motion in 60 steps and keep the worst of:
1. `rigid`: `rig.maxError()`. Pass: about 1e-15. Anything over 1e-9 means a frame was set with axes that are not unit or not square.
2. `unsolved`: the count of poses where any mechanism has `ok === false`. Pass: 0.
3. `seam`: the gap at each glue line, in cm. For a V-fold, take a point 10 cm along each glue line on the panel, `panel.point(±sin(beta) * 10, cos(beta) * 10, 0)`, and read its height off the host page, `host.local(p)[2]`. For a parallel fold use the result's `PA` and `PB` the same way. Pass: under 1e-9. (The demo's shortcut: at build time record where a glued point lies on its host, then test that pair at every pose with `verify`.)
4. `overhang`: with the spread shut, take every outline point of every pop-up part into the page's coordinates and measure how far it lies outside: `max(-x, x - W, -y, y - H)`. Leave out parts that are meant to stick out (tab handles). Pass: under 0.05 cm. Report which part is worst.

**Check 2: card passing through card.**
1. For every part on the spread except glue tabs: shrink its outline by 1.4 mm (`insetLoop`), so pieces that only meet along a fold or glue line do not count, and triangulate it (`triangulate`). Cut a part drawn across a Fold into its two halves first (`clipHalfPlane`), each kept 1.4 mm back from the crease. Those three helpers are in `knowledge/card-mesh-atlas/engine/cardmesh.js`.
2. At 10 poses from open to nearly shut (stop 14% short of shut: flat card lies on flat card there), and at each pose with every tab, slider and wheel at the start, middle and end of its travel, take the triangles to the world with `frame.point(x, y, zMid)`.
3. Test every pair of parts that ride on different frames: reject by bounding box, then test each edge of each triangle against the other triangle. Count only a segment that passes strictly through (not one that touches):

```js
const seg = (p, q, a, b, c) => {            // does p-q pass through triangle a-b-c?
  const e1 = sub(b, a), e2 = sub(c, a), d = sub(q, p), h = cross(d, e2), det = dot(e1, h);
  if (Math.abs(det) < 1e-9) return false;
  const s = sub(p, a), u = dot(s, h) / det;
  if (u < 1e-4 || u > 1 - 1e-4) return false;
  const qv = cross(s, e1), v = dot(d, qv) / det;
  if (v < 1e-4 || u + v > 1 - 1e-4) return false;
  const t = dot(e2, qv) / det;
  return t > 1e-4 && t < 1 - 1e-4;
};
const meet = (A, B) => {
  for (let i = 0; i < 3; i++) {
    if (seg(A[i], A[(i + 1) % 3], B[0], B[1], B[2])) return true;
    if (seg(B[i], B[(i + 1) % 3], A[0], A[1], A[2])) return true;
  }
  return false;
};
```

4. Report each pair once, with the opening in degrees at which they first meet and how many poses. Pass: none.

What it found in the build: a boat starting under the foot of a river bank, a fallen trunk standing across a slider's slot, and reeds passing through a leg of the floating layer. Its limits: a touch thinner than 1.4 mm, or one that happens only between two of the ten poses, is not found.

## Look checklist
- Opening and shutting the pages, no piece changes shape and no foot leaves the page: in the demo the report stays at about 1e-16 and 1e-14 cm.
- Fully shut, everything lies inside the page outline. Half open, standing pieces lean over; nearly flat, they stand upright or lean back a few degrees.
- A layer on a parallelogram stays parallel to its backdrop at every angle (the demo prints the error).
- The spine: the lowest corner of the book is at 0 cm on the table at every turn (the demo prints it). With most leaves on one side, the cover on the other side slopes down from a raised spine; on the middle spread both sides lie flat.
- Both paper checks pass before any art is drawn.

## Prompt snippet
Use the fold engine in `knowledge/paper-fold-kinematics/engine/` (`fold.js`, and `spine.js` if there is a book or anything with thick leaves). Read its CARD.md first and open `demo.html` to see each mechanism. Do not write a physics or constraint solver for paper: every piece is a rigid `Frame`, placed by `rig.vfold`, `rig.parallel`, `rig.float` or `rig.planar` from the angle of the pages. Do not edit the engine files. Start from the angles in the card (V-fold alpha 110, beta 93; fan 0.026 rad) and change them only for a reason. Build each spread at its open pose. Before any work on colour, light or art, write the two paper checks from the card (the paper rules, and card passing through card), run them over the whole motion, and fix what they find; paste their results into your notes. Spend your effort on the design of the scenes and how they move, not on the maths.
