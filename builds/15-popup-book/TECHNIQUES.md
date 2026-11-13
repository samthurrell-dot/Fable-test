# 15 – The pop-up book: techniques

Raw WebGL2, no libraries. About 4,200 lines, of which about 1,650 are the reusable engines. 229 card parts, 27,000 triangles, 104 rigid frames. Costs are from an Intel UHD Graphics 615 (a low-power laptop chip) unless stated; a recent laptop GPU is several times faster.

Files:
- `engine/fold.js` – paper mechanisms solved from the page angle. No WebGL, no DOM. **Reusable.**
- `engine/spine.js` – how a book of thick leaves lies on a table as its pages turn. Pure maths. **Reusable.**
- `engine/cardmesh.js` – flat card parts to triangles: faces, cut edges, pressed rims, bent folds. No WebGL. **Reusable.**
- `engine/atlas.js` – packs one small Canvas 2D drawing per printed part into a texture. **Reusable.**
- `engine/paperlight.js`, `engine/papershaders.js` – the renderer: matte card, a soft window, bounced colour, a moving mode and a still mode. **Reusable.**
- `engine/glkit.js`, `engine/mat4.js` – small WebGL2 and matrix helpers (shared with build 13).
- `src/book.js` – this book: leaves, spreads, the builder that spread files use, and the paper checks.
- `src/spreads/*.js`, `src/art.js`, `src/story.js` – the content: outlines, print and words.
- `src/main.js`, `src/engineer.js`, `src/sound.js` – page, input, camera, the automatic run, the engineer's view, audio.
- `demo/fold.html`, `demo/spine.html`, `demo/paper.html` – the fold engine, the spine and the renderer alone, with sliders.

## 1. Fold kinematics (`engine/fold.js`)

**What:** every piece of card is a rigid flat panel with a `Frame` (an origin and two unit axes in its plane). A mechanism reads the frames it is glued to and writes the frames of its own panels. The whole book is solved in one ordered pass from one number per page. Nothing is simulated, so any pose can be reached directly, backwards or forwards, and `?turn=2.5` is exact.

**Why not a physics engine or a cloth solver:** paper mechanisms are closed linkages with one degree of freedom. A solver that iterates will stretch the card a little every frame and drift; the closed forms below are exact to floating point (measured: frames stay rigid to 9e-16, glue seams close to 4e-15 cm) and cost 0.15 ms for the whole book.

**The three solvers:**
- **V-fold** (`rig.vfold`). Two panels glued to the two pages along lines that meet at a point on the spine. `alpha` is the angle of a glue line from the spine, measured on the page; `beta` the angle between that glue line and the centre crease, measured on the card. The crease is the unit vector at angle `beta` from both glue lines: the meeting of two cones. With glue directions gA, gB and g = gA·gB: c = s gA + t gB + r m, where s = (cos βA − g cos βB)/(1 − g²), t = (cos βB − g cos βA)/(1 − g²), m is the unit normal to both glue lines on the side the piece stands on, and r = sqrt(1 − s² − t² − 2stg). If r² < 0 no card of that shape can make the fold.
- **Parallel fold** (`rig.parallel`). Two panels glued along lines parallel to the hinge, at distances a and b, of widths p and q. In the section across the hinge this is two circles meeting. p + q > a + b gives a tent that stands when the pages are flat (the bridge on spread 3). p = b, q = a gives a parallelogram: one panel stays parallel to the other plane at every angle, which is how a flat layer is held upright in front of a backdrop (the deer, the mill, the reeds).
- **Floating layer** (`rig.float`). A platform in two halves, each a parallelogram with its own page, joined over a centre fin that stands in the bisecting plane of the pages. The fin keeps to the bisector by symmetry; that is true in card as well.
- **Planar parts** (`rig.planar`): anything that slides or turns in the plane of its parent. Pull tabs, levers, wheels and the slider are all this.

**One convention does most of the work:** a `Fold` is two frames that share an origin and a y axis, with the crease at x = 0. A spread of the book, a V-fold piece and a tent are all Folds, so art for any of them is drawn once, flat, with the crease down the middle, and any Fold can carry another mechanism.

**Rules found while designing the spreads (safe ranges):**
- alpha > 90° (arms towards the reader): the piece folds down away from the reader. alpha < 90°: it folds towards the reader. Either way it needs room along the spine equal to about 0.95 of its height, or it sticks out of the shut book. `book.check()` measures this.
- beta sets the lean: beta = 90° is upright when the pages are flat, a few degrees more leans it back. Used here: alpha 110, beta 93 (backdrops) and alpha 72, beta 87 (the sea).
- V-folds that share alpha and beta are copies of each other slid along the spine. They can never meet while folding. Spread 5 is five of these.
- A page that opens dead flat with alpha = 90° has no single answer (the glue lines are in one line). The book never opens flatter than about 176°, which also matches real books.

**Mistakes fixed:** hinging pop-ups on the middle plane of a leaf (see section 2); a layer's foot placed across the slot of a slider; a tall piece (the sun) reaching past the page edge when shut.

## 2. A spine with real thickness (`engine/spine.js`)

**What:** the leaves are a chain. Leaf j has a front and a back face a thickness apart, and spread k is hinged along the spine edges of the back of leaf k−1 and the front of leaf k. So each spread has a hinge line that lies exactly in both of its printed surfaces. The leaves under the open page on each side form a stack, fanned by 1.5° a leaf (the room folded card takes). Each stack hangs from its hinge and comes to rest on the table: flat if the hinge is as low as the stack is thick, otherwise tilted until its outer edge touches. The hinge height is the larger of what the two stacks need. Resting angles are found by halving (44 steps, a few microseconds).

**Why:** the first version turned every leaf about one shared axis. That needs leaves of no thickness. With real thickness the printed surface was 0.6 mm off the plane the pop-ups were solved on, so a piece leaning at a shallow angle passed through the page near its foot and its glue tab showed in front of it.

**Key parameters:** `fan` 0.02–0.035 rad (smaller and shut spreads have no room for card; larger and the book looks swollen); leaf thickness 0.12 cm; cover 0.3 cm.

**Seen in the picture:** on spread 1 the left cover slopes down from a raised spine (four leaves are stacked on the right); on spread 3 both sides lie flat; on spread 5 it is the back cover that tilts.

## 3. Card mesher (`engine/cardmesh.js`)

**What:** a part is an outline with optional holes and a thickness. It becomes a front face, a back face, a wall round the cut edge (the white core), and a 0.35 mm rim on the front, lifted 0.02 mm and tilted outward, where the knife pressed the ink away. A part drawn across a Fold is cut at the crease into two rigid halves joined by a 1.2 mm strip in four segments; the vertex shader bends that strip as a curve from one panel to the other, so folds are slightly round at every angle with no work on the CPU.

**Why:** the cut edge and the pressed rim are what make flat colour read as card rather than as a coloured polygon. They are geometry, so they stay sharp at any zoom, and the print texture only has to carry ink.

**Details that mattered:**
- `foldEdge`: an edge that lies on a glue line is a fold into the tab, not a cut. It gets no wall and no rim. Without this every standing piece had a white line along its foot.
- Vertices carry the index of their frame; frames go to the GPU as a 3-texel-wide float texture (104 rows here). Moving the whole book uploads 5 KB a frame.
- Ear clipping with holes (holes are joined to the outline by a two-way cut). Outlines must not cross themselves: overlapping firs on spread 2 did, and were narrowed.
- Halftone density is a per-vertex value. It must be a linear function of position, because a linear function is the only kind that comes through triangle interpolation unchanged.

**Cost:** building the mesh and the six print atlases takes about 170 ms.

## 4. Print atlas (`engine/atlas.js`)

**What:** each printed part gets a rectangle in a 2048² canvas (1024² on phones), drawn with the Canvas 2D API in the part's own centimetres with y up. The same outline points cut the card and print on it. Density starts at 38 pixels a centimetre and comes down until everything fits (31.6 to 38 here).

**Why a texture for ink but geometry for shape:** text, fine lines and patterns need a real 2D drawing API; silhouettes need to be sharp at any zoom.

## 5. Paper renderer (`engine/paperlight.js`, `engine/papershaders.js`)

**The light:** one soft window (the key) from the left and behind, and six patches of sky and room (the fill), each with its own shadow map: one 2048² map for the key, six 512² tiles for the fill.

**Two ways of drawing with the same shader:**
- **Moving:** one frame at a time. The key's shadow edge widens with distance from what casts it (5 samples to find the blocker, 8 comparisons), so shadows are sharp where card touches card and soft further off. Fill maps are redrawn two a frame in turn. 4× multisampling. Depth is drawn first so the costly shader runs once a pixel.
- **Still:** when nothing has moved for 0.18 s, frames are added up. Each one moves every light to a new point of the window or sky patch it stands for, shifts the picture by part of a pixel and moves the lens across its opening. The mean of 72 frames (40 on phones) is true area-light shadow, clean edges and depth of field at full resolution. Then drawing stops until something moves. The first frames of a still are rough (one hard shadow each), so the moving frame stays on screen until six have been added up and the still then eases in over twelve more.

**Why this and not screen-space ambient occlusion or blurred shadow maps:** the layers of a pop-up are millimetres apart. Blurred depth cannot resolve that and screen-space occlusion draws halos. Shadow comparisons hold contact at any distance, and adding frames up turns the same cheap comparison into the real integral when there is time.

**What makes it read as card:**
- Matte: diffuse only, no highlight on the card. (The table has a broad dull one.)
- Colour bounced between layers: each fill shadow map also stores the colour of the card it sees. Where a patch of sky is hidden, 42% of it comes back in the hiding card's colour. Shade under red card is warm; white card fills its own shade.
- Light through the sheet: a thin part lit from behind passes 16% of the key, and shadows that fall on its back show through.
- Tooth, mottle, specks where ink missed the paper, and a slow wave across each sheet (`LOOK` in `papershaders.js`). Each is faded out before it gets smaller than a pixel, so nothing shimmers.
- Halftone screen for tone: pages are printed darker towards their far edge with dots, not a gradient. At reading distance it is a smooth tone; in close-up the dots are there.

**Key parameters (safe ranges):** `key.size` 2–8° (half angle of the window; larger is softer); fill colours about a third of the key in total; `bounce` 0.3–0.5; `exposure` 0.35–0.5 with these lights; `radius` must cover everything that should cast a shadow (52 cm here).

**Cost at 1920×1080, "high":** 27.5 ms a moving frame at full resolution, 13.7 ms at 0.65 scale; redrawing the shadow maps is about 1 ms of that at 1080p because the meshes are small. The page times three frames at start-up and picks a scale for a 13 ms frame, then steps down or up while running.

**Mistakes fixed:** exposure too high (everything pastel, table beige); `gl.finish()` does not wait in every browser, so the start-up timing read 0.1 ms until a `readPixels` was added; the first light was nearly side-on, which hid the shadows behind the pieces; moved round to the back so they fall towards the camera, then the front fill raised again so printed fronts were not dull.

## 6. Checking the paper rules (`src/book.js`)

- `book.check()` sweeps every spread through its whole motion: frames stay rigid, every linkage has an answer, glue seams stay closed, and with the spread shut no card lies outside the page.
- `book.collisions()` looks for card passing through card: every part is shrunk 1.4 mm, turned into triangles and tested against every part on a different panel, at ten poses from open to nearly shut and with each tab, slider and wheel at three positions. It found three real faults (see ROUNDS.md, round 3); there are none now.

Both run in the browser console in two or three seconds. A new spread should pass both before any time is spent on how it looks.

## 7. Turning pages and working the mechanisms (`src/main.js`)

- **Page drag:** the pointer's ray is cut by the plane across the spine at the point where the page was grabbed; the angle of that point round the hinge is the page's angle. So the page follows the pointer round, at any speed, and can be left anywhere. A release faster than 0.55 turns a second carries it over; a page left within 6% of either side settles; otherwise it stays.
- **Controls** are hit on the plane of their parent sheet. A tab reads the drag along its axis, a wheel the change in angle round its rivet, the slider the nearest point of its path near where the piece is.
- **Automatic run:** a fixed timeline (`runAt(t)`), so `?t=` shows any moment exactly. After ten idle seconds it takes over from wherever the book was left.

## 8. Sound (`src/sound.js`)

Paper noises made from one buffer of white noise, shaped by what the book is doing (swish with page speed, crackles as card unfolds, a knock on landing, a rub for tabs, a tick per 15° of wheel), and a music-box phrase for each spread (three sine partials per note, a generated room). Measured in the page: silent at rest; page turn peaks at 0.13; music box at 0.10 before the last small rise in level. Not checked by ear.
