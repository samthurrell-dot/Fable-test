# Paper renderer (matte card, a soft window, bounced colour; moving mode and still mode)

Harvested from: builds/15-popup-book (Claude Fable 5.2, default effort, 12–13 Nov 2026)
Engine: knowledge/paper-renderer/engine/paperlight.js with papershaders.js, glkit.js, mat4.js   Demo: knowledge/paper-renderer/demo.html

All four engine files are byte-for-byte copies of the build's. Raw WebGL2, no libraries. It draws meshes made by `knowledge/card-mesh-atlas` and placed by frames from `knowledge/paper-fold-kinematics`; the demo imports both from their own folders.

## What it does
Draws scenes made of cut card so they read as real card on a table: matte, lit by one soft window and the room, with shadows that are sharp where card touches card and soft further off, and with the colour of one layer showing in the shade of the next.

It has two ways of drawing with the same shader. While anything moves it draws one cheap frame at a time. When the scene rests it adds frames up, each with the lights, the pixel grid and the lens moved a little, until the mean is true area-light shadow, clean edges and depth of field. Then it stops drawing.

## When to use it / when not to
- Use for: anything built from flat matte sheet (pop-ups, paper theatres, collage, cut-paper animation, architectural card models, board games), seen on a table top, where the picture spends much of its time at rest.
- Use the moving/still idea alone for: any raw-WebGL scene that is often still. It is the cheapest way to get soft shadows, antialiasing and depth of field that are correct.
- Do not use for: shiny, glassy or metallic things (there is no highlight on card by design), large outdoor scenes (one shadow volume of a few tens of cm), scenes that never rest (you only ever get the moving mode), or meshes that are not from the card mesher (the vertex layout is fixed).

## How it works
1. **Geometry.** `setMesh` takes the mesher's buffers. `setFrames` uploads the frames as a float texture, 3 texels a panel; the vertex shader places every vertex and bends the strip at each fold. Moving a whole book is a 5 KB upload.
2. **Lights.** One key (a window: a direction, a colour, and `size`, its half angle in degrees) and six fill patches of sky and room (a direction, a colour, a `cone`), plus a little light coming up off the table. Each has an orthographic shadow map over one shared volume (`centre`, `radius`): 2048² for the key, six 512² tiles for the fill.
3. **Shadow maps keep colour.** The fill maps store the colour of the card they see as well as its depth. Where a patch of sky is hidden, 42% of it (`bounce`) comes back in the hiding card's colour. This is what makes shade under red card warm.
4. **Shadow maps are drawn with front faces culled**, so the far side of each sheet goes in the map and the lit side never shades itself. Points are moved 0.3 mm off their surface before the key test.
5. **Moving frame.** Depth first, so the costly shader runs once a pixel. The key uses percentage-closer soft shadows: 5 samples find the mean depth of what blocks the light, the edge is widened in proportion to the gap, and 8 hardware comparisons average it, turned by a different angle at every pixel. Fill patches use 4 comparisons each. Dirty fill maps are redrawn two a frame in turn. 4× multisampling.
6. **Still frame.** Each frame moves the key to a new point of its window and each fill to a new point of its cone, shifts the picture by part of a pixel and moves the eye across the lens opening (focus is at `view.target`). Points come from a low-discrepancy sequence (R2). One hard comparison per light is enough because the mean does the softening. Frames are blended into a 16-bit float target with weight 1/(n+1). After `samples` frames (72, or 40 on phones) `render` returns `done` and draws nothing more.
7. **The hand-over.** The first frames of a still are rough, so the moving frame stays on screen until 6 have been added up, and the still then eases in over 12 more.
8. **Card surface.** Diffuse only. A thin sheet lit from behind passes 16% of the key, tinted by its own colour. Tooth, mottle, specks and a slow wave across each sheet come from noise in the sheet's own coordinates and are faded out before they get smaller than a pixel. Tone from a halftone screen. The pressed rim and the crease go towards bare card.
9. **To the screen.** A filmic tone curve (Narkowicz's fit to ACES), a vignette and a little grain.

### Typical use
```js
const rigLight = JSON.parse(JSON.stringify(LIGHT_RIG));        // copy, then edit
rigLight.centre = [0, 4, 0]; rigLight.radius = 30;             // set before the renderer is made
const renderer = createPaperRenderer(canvas, phone ? QUALITY.low : QUALITY.high, rigLight);
renderer.setMesh(built);                                       // from CardMesh.finish()
renderer.setAtlas(['all'], atlas.canvas);                      // one atlas for one or more mesh groups
function frame() {
  renderer.resize(canvas.clientWidth * dpr, canvas.clientHeight * dpr);
  if (moved) { rig.update(); renderer.setFrames(rig.pack(frames), rig.frames.length); }
  const res = renderer.render({ eye, target, fovY: 0.42, aperture: 0.3, groups: ['all'],
    changed: moved, still: secondsSinceMoved > 0.18 });
  requestAnimationFrame(frame);                                // res.done: nothing more to draw until something moves
}
```
Other calls: `setScale(s)` draws the moving picture smaller than the canvas (stills are always full size); `relight()` after editing the rig; `restart()` to begin a still again; `viewProjOf(view)` for laying 2D marks over the picture.

## Main options
| Option | Default | Safe range | What it changes |
|---|---|---|---|
| `key.dir` | `[-0.6, 0.6, -0.53]` | behind and to one side of the subject, 30–50° up | Where the window is. Points from the scene to the light. |
| `key.col` | `[3.5, 3.25, 2.85]` | keep the ratio; scale with exposure | Colour and strength of the window (linear). |
| `key.size` (degrees) | 4.5 | 2–8 | Half angle of the window. Larger is softer. |
| `fill[i].col` | six patches, 1.4 in total | about a third of the key in total | The room and sky. The two on the camera's side light the printed fronts. |
| `fill[i].cone` (degrees) | 30–34 | 20–40 | How wide a patch of sky each fill stands for in a still. |
| `bounce` | 0.42 | 0.3–0.5 | Share of a hidden patch that comes back in the hiding card's colour. |
| `low` | `[0.15, 0.12, 0.09]` | up to twice this | Light coming up off the table onto faces that look down. |
| `centre`, `radius` (cm) | `[0, 6, 0]`, 52 | as small as covers everything that casts a shadow | The shadow volume. Smaller gives finer shadow maps. Read when the renderer is made. |
| `exposure` | 0.42 | 0.35–0.5 with these lights | Overall brightness before the tone curve. |
| `background`, `vignette`, `grain` | dark brown, 0.3, 0.018 | vignette 0–0.4, grain 0–0.03 | The far room and the finish. |
| `QUALITY.high` / `.low` | see file | pick one | Map sizes (2048/512 or 1024/256), sample counts, still frames (72 or 40). Compiled into the shaders. |
| `view.aperture` (cm) | 0 | 0–0.6 | Lens radius for stills. 0.3 is a gentle depth of field at 60 cm. |
| `view.fillPerFrame` | 2 | 1–6 | Fill maps redrawn in a moving frame. |
| `view.near`, `view.far` (cm) | 4, 900 | | Camera planes. |
| `LOOK.TRANSMIT` | 0.16 | 0.1–0.25 | Light through a sheet. |
| `LOOK.COCKLE`, `TOOTH`, `MOTTLE`, `SALT` | 0.085, 0.16, 0.065, 0.5 | up to twice each | Waviness, grain, uneven ink, white specks. |
| `LOOK.RIM_WHITE`, `BEND_WHITE` | 0.6, 0.12 | 0.3–0.8, 0.05–0.2 | How pale the pressed rim and the crease go. |
| `LOOK.KEY_BIAS`, `FILL_BIAS` (cm) | 0.03, 0.22 | scale with the scene | How far a point is moved off its surface before a shadow test. |
| `LOOK.SCREEN_FREQ` | 13 | 8–20 | Halftone dots a cm. |
| `STILL_SHOW_FROM`, `STILL_EASE` (constants in paperlight.js) | 6, 12 | leave | The hand-over from moving to still. |

`LOOK` is exported from `papershaders.js` and read when the shaders are built: change it before `createPaperRenderer`.

## Cost
All on an Intel UHD Graphics 615 (a low-power laptop chip); a recent laptop GPU is several times faster. Frames were drawn back to back and the timing ended with a 1×1 `readPixels`.

| Scene | Size, settings | A moving frame | A finished still |
|---|---|---|---|
| Build 15 (229 parts, 27,000 triangles) | 1920×1080, high, full size | 27.5 ms | not timed |
| the same | 1920×1080, high, moving picture at 0.65 | 13.7 ms | |
| the same | 563×1218, low | 14 ms | |
| This demo (8 parts, 1,148 triangles) | 970×800, high | 11.9 ms | 72 frames in 0.97 s |
| the same | 585×710, low | 5.5 to 7.4 ms | 40 frames in 1.2 s |

- Cost is nearly all fill rate (the card shader), not geometry: redrawing every shadow map was about 1 ms of the build's frame.
- GPU memory: about 16 MB for the key map, 12 MB for the fill maps, plus a 4× multisampled target and two float targets at canvas size.
- The build timed three frames at start-up, set the moving-picture scale for a 13 ms frame, then stepped down (×0.86 after 40 slow frames) or up (×1.1 after 240 steady ones) while running.

## Gotchas
- **Exposure too high makes everything pastel.** The build's first exposure (0.78) put white card at the top of the tone curve and turned the oak table beige. 0.42 is right for these lights. White card should read as off-white with room above it.
- **A light from the side hides the shadows.** With the window nearly side-on, shadows fell behind the pieces and the picture was flat. Put the key behind and to one side so shadows fall towards the camera and draw the shape of every piece on the page. Then raise the fill patches on the camera's side (the build raised them 40%) or the printed fronts go dull.
- **A flash each time the scene comes to rest.** The first frame of a still has one hard shadow per light. Keep the moving frame on screen until a few frames are added up and ease the still in; the engine does this. Do not "fix" it by showing the still at once (`instant` is for saved pictures only).
- **`still` and `changed` are yours to get right.** Pass `changed: true` on every frame in which card moved (and call `setFrames`). Pass `still: true` only when nothing has moved for a moment (the build waits 0.18 s). A camera move restarts the still by itself. An edit to the light rig does not: call `relight()`.
- **`gl.finish()` does not wait for the GPU in every browser.** A timed frame read 0.1 ms until a 1×1 `readPixels` ended the timing. The demo's `bench` shows the pattern.
- **A hidden tab draws nothing.** Animation frames stop, so a frame rate read from the live loop is not real. Measure by drawing frames back to back.
- **Reading the canvas back.** A WebGL canvas can only be read in the same task as the draw. A finished still does not draw again, so call `restart()`, render with `instant: true` until `done`, then `toDataURL` at once. The demo's `__demo.shot()` does this.
- **Blurred shadow maps and screen-space occlusion do not work here.** The layers of a pop-up are millimetres apart: blurred depth cannot resolve that and screen-space occlusion draws halos. Do not swap them in.
- **Keep the shadow volume tight.** The key map covers 2 × `radius`: at 52 cm a texel is 0.5 mm, at 30 cm it is 0.3 mm. Double the radius and contact shadows go soft.
- **Everything is in centimetres with y up and the table at y = 0.** Biases, the halftone, the table's boards and the camera planes all assume it. Model in cm rather than rescaling the engine.
- **Exactly six fill patches.** The count is fixed in the shader (`NUM_FILL`), tiled 3 × 2.
- **Settings are compiled in.** Changing `QUALITY` or `LOOK` means making the renderer again; the demo reloads the page.
- **Do not pick phone settings from "coarse pointer" alone.** A laptop with a touch screen matched it. Check the screen size as well.
- **No float render targets** (`info.hdr` false): frames are added up in 8 bits and soft shadows can band. Rare on anything recent.
- **No highlight on card, ever.** A specular term makes card look like plastic at once. The table has a broad dull one; that is enough to say "light from over there".

### What in the engine is this book's own, and where to change it
The files are copied unchanged, so three things from the build are still in them:
- **The table** (`groundFS` in `papershaders.js`): oak boards 11.5 cm wide, a pool of light centred near (−8, −6) that falls away from 30 to 190 cm, and a fade to the background from 120 to 330 cm. For another surface, replace the albedo lines and keep the lighting lines.
- **The "engineer's view"** (`view.blueprint`, 0..1): turns card plain white and glue tabs blue. Pass 0 to leave it off.
- **Material ids** (the mesher's `mat`): 0 card and 2 glue tab are thin (light passes through, folds crack pale); 1 board is not.

## Look checklist
- Shadows are sharp where card meets card and widen smoothly with distance; in a still there are no steps, dots or noise in them.
- Shade under coloured card takes a little of that colour; shade between white layers stays light.
- No highlights on card. White card is off-white, never blown out. The table is dark oak, not beige.
- A standing sheet seen from its unlit side glows faintly, and a shadow falling on its back shows through.
- Cut edges are white and rims pale in close-up; tooth and specks show in close-up and nothing shimmers from further off.
- Feet of standing pieces sit in their own contact shadow with no light leaking under them.
- The moving frame and the finished still agree in tone and colour; the still is only cleaner, with soft focus in front of and behind the target.
- No jump or flash when the picture settles.

## Prompt snippet
Use the paper renderer in `knowledge/paper-renderer/engine/` (`paperlight.js`, `papershaders.js`, `glkit.js`, `mat4.js`) with meshes from `knowledge/card-mesh-atlas` and frames from `knowledge/paper-fold-kinematics`. Read all three CARD.md files first and open `knowledge/paper-renderer/demo.html`. Model in centimetres, y up, table at y = 0. Do not write your own shadows, ambient occlusion, antialiasing or depth of field: the renderer's moving mode and still mode do all four. Keep the light rig's defaults (key behind and to one side, exposure 0.42, bounce 0.42) and set only `centre` and `radius` to fit your scene tightly. Pass `changed: true` whenever card moved and `still: true` only after about 0.18 s of rest. Do not add highlights to card. Do not edit the engine files except the table's colours in `groundFS` if the brief needs another surface. Measure frame cost by drawing frames back to back and ending with a 1×1 `readPixels`, and scale the moving picture with `setScale` to hold about 13 ms. Save pictures from the canvas (restart, render with `instant: true` until done, `toDataURL`) and judge them against the card's look checklist.
