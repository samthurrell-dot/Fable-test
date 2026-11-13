# Card mesher and print atlas

Harvested from: builds/15-popup-book (Claude Fable 5.2, default effort, 12–13 Nov 2026)
Engine: knowledge/card-mesh-atlas/engine/cardmesh.js and engine/atlas.js   Demo: knowledge/card-mesh-atlas/demo.html

Both engine files are byte-for-byte copies of the build's. `cardmesh.js` needs nothing (no WebGL, no DOM). `atlas.js` needs a browser canvas. The demo brings its own 60-line shader, so this folder runs alone.

## What it does
Turns flat outlines (points in centimetres, with optional holes and a thickness) into triangles that read as cut card: a front face, a back face, a white wall round every cut edge, a thin pale rim where the knife pressed the ink away, and a narrow bent strip wherever a part crosses a fold. Each vertex carries the number of the rigid panel it rides on, so the GPU moves the whole model from a small table of frames and the mesh is built once.

The atlas packs one small Canvas 2D drawing per printed part into one texture, drawn in the same centimetres as the outline, so the same points cut the card and print on it.

## When to use it / when not to
- Use for: pop-up books, paper theatres, cut-paper and collage scenes, board-game pieces, packaging, signs, any flat sheet material with visible thickness (card, felt, plywood, acrylic) that moves as rigid panels.
- Use the atlas alone for: any scene with many small printed flat parts.
- Do not use for: curved or sculpted surfaces, sheets that bend along their length (only the strip at a crease bends), outlines with thousands of points (the triangulator is simple ear clipping), or parts that must be re-cut every frame.

## How it works
1. **Clean and wind.** Repeated points are dropped; the outline is made anticlockwise and holes clockwise.
2. **Triangulate.** Ear clipping. Each hole is first joined to the outline by a two-way cut ("bridge"), giving one simple polygon.
3. **Faces.** Front at `z1`, back at `z0` (skipped with `hasBack: false`).
4. **Walls.** One quad per edge between `z0` and `z1`, in the `edge` colour. Corners blunter than 38° share a normal, so circles shade round.
5. **Rims.** Each loop is inset by 0.35 mm (`insetLoop`). A quad from the edge to the inset line sits 0.02 mm above the face, with its outer normal tilted outward. Outer vertices are kind RIM and inner ones kind FACE, so the shader's whitening fades from the cut inwards with no texture.
6. **Fold edges.** `foldEdge(p, q)` names edges that are a fold into another sheet (a glue tab), not a cut. They get no wall and no rim.
7. **Fold parts.** With `frameB` set, the outline is in Fold coordinates (crease at x = 0). It is clipped into two rigid halves at x = ∓bend/2, and the gap is filled by a strip of 4 steps whose vertices carry `u` in 0..1. The vertex shader places them on a curve from panel A, over the crease, to panel B (a quadratic Bézier), so folds are slightly round at every angle with no CPU work.
8. **Frames.** Vertices hold a frame index. Frames go to the GPU as an RGBA32F texture 3 texels wide: origin, x axis, y axis, one row per frame (12 floats; `rig.pack()` in the fold engine writes exactly this). The vertex shader reads them with `texelFetch`.
9. **Atlas.** Shelf packing, tallest first. Density starts at `maxDensity` pixels a cm and comes down 6% a try until everything fits. Each rectangle is filled with the part's base colour and has 3 pixels of bleed. `uv[i](x, y)` maps part centimetres to texture coordinates.

### Vertex layout
`finish()` returns `{ f32, u8, idx, ranges, vertices, stats }`.

| Buffer | Per vertex | Fields |
|---|---|---|
| `f32` | 12 floats (48 bytes) | pos.xyz in the frame; bend (−1 rigid, else 0..1 across the crease); normal.xyz in the frame; uv.xy into the atlas (x < 0: no print); frame A; frame B; material id |
| `u8` | 8 bytes, normalised | colour rgb (sRGB); kind (0 face, 1 rim, 2 wall, 3 bend); ink rgb; halftone density 0..255 |
| `idx` | Uint32 | `ranges[group] = { solid: [first, count], rim: [first, count] }`, rims straight after solids |

The smallest vertex shader that honours all of this is in `demo.html` (it is the first half of `CARD_VS` in the paper renderer). Copy it; do not work it out again.

### Typical use
```js
const atlas = buildAtlas(printed.map((p) => ({ box: boxOf(p.shape), base: p.color, draw: p.print })), 2048, 38);
const mesh = new CardMesh();
mesh.addPart('spread1', { frame: page.A.id, frameB: page.B.id, outline: sheet, z0: -0.06, z1: 0, uv: atlas.uv[0], bend: 0.5, mat: 1 });
mesh.addPart('spread1', { frame: stand.id, outline: tree, z0: -0.0225, z1: 0.0225, front: [46, 140, 136], foldEdge: (p, q) => p[1] === 0 && q[1] === 0 });
const built = mesh.finish(['base', 'spread1']);     // then upload f32, u8, idx once
```

## Main options
| Option | Default | Safe range | What it changes |
|---|---|---|---|
| `frame`, `frameB` | none | frame indices | The panel the part rides on. With `frameB` the part crosses a Fold and is cut at the crease. |
| `outline`, `holes` | none, `[]` | 3 to a few hundred points each; must not cross themselves | The cut shape, in cm in the frame's plane. |
| `z0`, `z1` (cm) | 0, 0.045 | card 0.02–0.3 thick | Bottom and top of the sheet along the frame normal. Used in the build: page sheet −0.06..0, a part on a page 0..0.045, the next layer 0.045..0.09, a standing card −0.0225..0.0225, a glue tab 0.02 thick. |
| `front`, `back`, `edge` | off-white | `[r, g, b]` 0..255 sRGB | Card colours. `back` and `edge` are normally white card. |
| `uv`, `uvBack` | null | a function from the atlas | Print on the front or back. Null means flat colour. |
| `screen`, `ink` | null | `(x, y) → 0..1`, linear in x and y | Halftone tone: a second ink laid as dots. Density is per vertex. |
| `mat` | 0 | 0 card, 1 board, 2 glue tab, 3 wood (the build's ids) | Material id for the shader. |
| `hasBack`, `hasWalls`, `hasRim` | true | on or off | Switch faces off for parts glued flat (no back) or cut from thick stock. |
| `bend` (cm) | 0.12 | 0.08–0.5; the build used 0.5 for the page gutter | Width of the bent strip at a crease. |
| `foldEdge` | none | `(p, q) → boolean` | Edges that are folds, not cuts. |
| `RIM_WIDTH`, `RIM_LIFT`, `RIM_TILT` (constants) | 0.035 cm, 0.002 cm, 0.55 | rim 0.02–0.06 cm | The pressed rim. Named constants at the top of `cardmesh.js`. |
| `BEND_STEPS` (constant) | 4 | 3–8 | Strips across a bend. |
| atlas `size` (px) | none | 1024 on phones, 2048 on desktop | Canvas size. |
| atlas `maxDensity` (px a cm) | none | 20 on phones, 38 on desktop | Sharpness asked for. Read `atlas.density` for what was given. |
| atlas `background` | `#f1ece0` | any CSS colour | What shows between rectangles. |

## Cost
- Build 15: 229 parts, 27,000 triangles and six 2048² atlases built in about 170 ms on an Intel UHD Graphics 615 laptop. Moving the whole book uploads 104 frames, 5 KB, a frame.
- Demo on the same PC: 6 parts, 916 triangles, 1,628 vertices, 100 KB of mesh. Mesh plus a 1024² atlas rebuilt in 4.5 ms. One frame 6.1 ms at 1455×1200 with the browser's own antialiasing (40 frames drawn back to back, ended with a 1×1 `readPixels`).
- Memory: 56 bytes a vertex, 4 bytes an index, 16 MB of GPU memory for a 2048² atlas before mip levels.

## Gotchas
- **A white line along the foot of every standing piece.** The build's first mesher gave the bottom edge a wall and a rim. In card that edge is a fold into the glue tab. Pass `foldEdge` for every edge that lies on a glue line, on the piece and on its tab. The demo's "foot is a fold" switch shows both.
- **Outlines must not cross themselves.** The ear clipper does not fail loudly: when stuck it drops the flattest corner and carries on, so a crossed outline gives a wrong shape. The build's overlapping fir trees did this and were narrowed. Build one outline per piece, or union the shapes first.
- **`screen` must be a linear function of x and y.** Density is stored per vertex and a linear function is the only kind that comes through triangle interpolation unchanged. For a curved tone, split the part.
- **Keep holes and notches clear of a crease.** In a fold part each hole goes wholly to the half its centre is in, so a hole across the crease breaks the mesh. And if the outline crosses the strip's five columns a different number of times, the strip is skipped without a word and the fold shows a gap. Keep everything but the two crossing edges more than `bend / 2` from x = 0.
- **Draw rims in the same call as solids, in the depth pass too.** They lie 0.02 mm above their faces and rely on the depth test. `drawElements(TRIANGLES, r.solid[1] + r.rim[1], UNSIGNED_INT, r.solid[0] * 4)`: counts are in indices, the offset is in bytes.
- **The page sheet's top is z = 0.** Pop-ups are hinged on the printed surface (see the fold card), so the sheet goes below it (`z0: -thickness, z1: 0`) and things on the page stack upwards from 0. Two parts at the same level on the same frame will fight for depth: give each layer its own level.
- **No back for parts glued flat** (`hasBack: false`): it saves triangles and the back would lie exactly on the face below.
- **Print is drawn in cm with y up.** Shapes and lines work as they are. Text comes out upside down unless you step out to pixel space first; the `text()` helper in `demo.html` (from the build's `src/art.js`) does it.
- **No flip on upload.** `uv` measures v from the top of the canvas, which matches `texImage2D` with its default settings. Use `SRGB8_ALPHA8` with mipmaps, clamp to edge.
- **The atlas lowers its density silently.** Read `atlas.density`. The build got 31.6 to 38 px a cm; below about 20 small text goes soft. Use one atlas per group of parts that are shown together (the build used six: one per spread and one for the table).
- **Colours are sRGB bytes.** The shader must take them to linear (`pow(c, 2.2)`) before lighting.
- **White struts show behind layers.** Not a mesher fault, but every user of it hits it: give a strut the colour of what is behind it (`front` and `back`), as printed struts are in real books.
- **Geometry for shape, texture for ink.** Do not put silhouettes in the texture with alpha: edges go soft in close-up and there is nowhere to hang a wall or a rim.

## Look checklist
- In close-up every cut edge shows a white wall and a thin pale rim, on outlines and round holes alike.
- No white line where a standing piece meets its glue tab.
- A fold is slightly round, with a faint pale line along it, and has no gap or crack at any angle from nearly shut to nearly flat.
- Print lines up with the cut: a printed window frame sits on the edge of its hole.
- Halftone dots are round and even in close-up and read as smooth tone from reading distance.
- No colour from a neighbouring drawing along the edge of any printed part.
- In the demo's "what each triangle is" view: orange rims everywhere except fold edges, blue walls, a green strip at each crease.

## Prompt snippet
Use the card mesher and print atlas in `knowledge/card-mesh-atlas/engine/` (`cardmesh.js`, `atlas.js`). Read its CARD.md first and open `demo.html`, including its "what each triangle is" view. Every flat piece is an outline in centimetres passed to `mesh.addPart`; do not hand-build triangles for card and do not put silhouettes in a texture with alpha. Mark every edge that is a fold into a glue tab with `foldEdge`. Draw print with the Canvas 2D API through `buildAtlas`, in the same centimetres as the outline. Take the vertex shader from the demo (or use the paper renderer card, which already has it); keep the vertex layout as it is. Do not edit the engine files. Frames can come from the fold engine (`rig.pack()`) or from any code that writes 12 floats a panel. After the first build, look at one close-up of an edge, one of a fold and one of a foot before going further.
