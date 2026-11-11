# 13 – A tree through the seasons: techniques

Raw WebGL2, no libraries. About 1,700 lines. Costs are from an Intel UHD Graphics 615 at 1920×1080 unless stated; a recent laptop GPU will be several times faster.

Files:
- `engine/tree.js` – grows the tree. No WebGL. **Reusable.**
- `engine/seasons.js` – the year as pure functions. No WebGL. **Reusable.**
- `engine/glkit.js`, `engine/mat4.js` – small WebGL2 and matrix helpers. Reusable.
- `src/shaders.js`, `src/scene.js` – this scene's look and draw order.
- `src/main.js`, `src/sound.js` – page, input, quality, audio.
- `demo/tree.html`, `demo/seasons.html` – each engine alone with sliders.

## 1. Space colonisation tree (`engine/tree.js`)

**What:** scatter "attractor" points through the crown volume. Each round, every branch node moves one step towards the average direction of the attractors nearest to it; attractors are used up when a branch arrives. Branching comes out of the geometry, not from rules.

**Why not an L-system:** L-systems need hand-tuned rules per species and tend to look regular. Space colonisation gives uneven, light-seeking boughs from a few numbers, and the crown shape is set directly by the volume you fill.

**Key parameters (safe ranges):**
- `attractors` 1,500–6,000. More = denser branching.
- `killRadius` 0.35–0.8 m. Smaller = finer twigs, more nodes. Below 0.3 the node count climbs fast.
- `influenceRadius` 2–4 m. Too small and outer attractors are never reached.
- `step` 0.2–0.4 m. Sets smoothness and node count.
- `pipeExponent` 2.0–2.5. Lower = thicker trunk for the same crown.
- `crownUnderside` 0.5–0.8 gives the flat-bottomed broadleaf shape; 1 is a ball.

**Cost:** 1,900 nodes and 8,000 twigs grow in about 240 ms; 3,200 twigs in about 170 ms. Done once at load.

**Details that mattered:**
- Each attractor remembers its nearest node, and only new nodes are tested each round. This turns the usual all-pairs search into attractors × nodes in total.
- Two attractor groups pulling on one node ask for the same child for ever. A child closer than half a step to an existing child is skipped.
- Radii use the pipe model from the tips down (parent area = sum of child areas), plus a small gain per segment so long unbranched boughs still taper.
- At a fork the thickest child continues the tube; the others start a new tube from inside the parent. No joint geometry needed.
- Tubes carry their frame from ring to ring (parallel transport), so they never twist.
- Space colonisation alone gives a bare-looking winter tree. 3,000–8,000 short three-sided twigs are added on thin branches, weighted towards the outside of the crown. Leaves and blossom hang on these.

**Mistakes fixed:** trunk too thin at exponent 2.2 (now 2.0); root flare of 0.85 looked like a skirt (now 0.55).

## 2. A leaf's whole life in the vertex shader (`src/shaders.js`, `LEAF_VS_BODY`)

**What:** every leaf is one instance with three times baked in: grow start, turn start, fall start (from `leafSchedule` in `engine/seasons.js`). The vertex shader works out from the year alone whether the leaf is a bud, full size, turning, in the air, lying on the ground or gone. There is no simulation and no per-frame CPU work, so the slider can scrub in either direction and `?t=` can freeze any moment.

**Why:** 56,000 leaves updated on the CPU would not hold 60 fps, and a particle simulation cannot be scrubbed backwards.

**Key parameters:** `FALL_SPEED` 2–5 m/s (lower = more leaves in the air at once), `DRIFT_PER_M` 0.3–0.8, `SCATTER` 2–4 m, `FLUTTER` 0.2–0.6 m, and the `TIMING` table in `engine/seasons.js`.

**Details that mattered:**
- Fall time depends on the leaf's height, so low leaves land first.
- Leaves at the top and outside of the crown turn first (`leafSchedule` mixes a random number with exposure).
- Colour creeps in from the edge and tip of each leaf, so half-turned leaves are two-tone.
- 2% of leaves are "stubborn" and hang on into the first snow.
- Fallen leaves brown with age, are dusted by snow, then shrink away under it so the tree is clean for spring.
- Blossom uses the same program (`uKind` 1) with a five-petal cut-out.

**Mistake fixed:** leaves and blossom opened together, so spring was just green. Bud break now waits for full blossom.

## 3. Leaf and petal lighting (`LEAF_FS`)

Two-sided. Direct sun on the lit face; when the sun is behind the leaf, a share (`TRANSLUCENCY` 0.85) passes through, tinted yellow-green and boosted when the view looks towards the sun. A per-leaf ambient value from the tree engine (deep in the crown = dark) gives the crown depth without any screen-space pass. Four-tap shadow map look-up.

## 4. Bark without UVs (`BARK_FS`)

3D noise sampled at the rest position, with the coordinate along the branch squashed by `BARK_STRETCH` 0.88. Round noise becomes long fissures that follow every branch, with no seam and no texture. The bump comes from screen-space derivatives of the height. Thin twigs fade to smooth red-brown young wood. Lichen patches and moss at the foot are more noise.

Snow on branches: vertices on upward-facing surfaces are pushed out along the normal (1.2 cm on twigs to 5.5 cm on boughs) and coloured by a noisy "facing up" mask. This is what makes the winter tree read.

## 5. One number drives the year (`engine/seasons.js`)

Eight key moments of light, sky, haze, grass and wind, blended with a smooth step, plus closed-form snow cover, snowfall and canopy curves that wrap cleanly at the new year. `seasonState(y)` returns everything the renderer needs. See `demo/seasons.html`.

## 5b. Sky for a long lens (`SKY_FS`)

A long lens only sees the few degrees above the horizon. Clouds projected on a flat plane smear into streaks there. Here the cloud noise is sampled on a cylinder round the viewer (`CLOUD_RING`, `CLOUD_RISE`), so banks keep their shape at the horizon and wrap with no seam. Tops are lit by comparing the density a little higher up (`CLOUD_LIGHT_STEP`): less cloud above = brighter. Far hills and a tree line are two noise ridgelines on the same circle, paling towards their feet.

**Mistake fixed:** an orange horizon mixed with a blue zenith gives grey. Keep the two sky colours on the same side of neutral when you want a coloured sky.

The sun's compass direction is a per-season key (`sunAzimuth`): side light models the summer crown; light from behind makes autumn leaves glow.

## 5c. Animals as pure functions of time (`engine/life.js`)

**What:** no animal has stored state. `birdState(i, t, …)` works out from the clock alone which perch a bird left, which it is heading for and how far along it is. Time is cut into cycles per bird; a hash of (bird, cycle) picks the perch, so cycle k ends where cycle k+1 begins. Flights are cubic Bezier curves; the tangent gives the heading. The squirrel follows a path built from the tree's own skeleton (grass, trunk surface, bough) with a table of [seconds, metres along the path]; equal distances in a row are pauses.

**Why:** the whole build can be frozen (`?t=`) and scrubbed. A simulation with stored state cannot. It also costs nothing: about twenty small matrix builds per frame.

**Key parameters:** the `LIFE` table (cycle lengths, speeds, share of looping flights, squirrel stride) and `lifeActivity(y)` (who is about at each time of year).

**Details that mattered:**
- Perches are found on the tree: fairly level, finger-thick branches. Perched birds add the same sway as the branch (`swayOffset` mirrors the GLSL), or they float.
- Small birds fly in bursts: a few beats, a short glide, and a glide in to land. Wings fold on landing.
- Animals are drawn larger than life (birds 1.8×, squirrel 1.4×). At true size from 46 m they are three pixels.
- A flat-winged bird seen exactly side-on is a line. The far flock flies angled towards the lens for this reason.
- Butterflies and flowers are instanced and worked out wholly in the vertex shader from a seed.

## 6. Lens (`POST_FS`)

One-pass depth of field: a golden-angle spiral gather where each sample counts only if its own blur circle reaches the centre pixel. Then exposure, per-season saturation and tint, a filmic curve, vignette and grain. Measured cost: too small to see (removing it did not lower frame time).

## 7. Speed

- Draw near things first and the sky last on the far plane: saved about 25% at full resolution.
- 4× MSAA on a half-float target costs about 30–45% on this GPU. Worth it on a strong GPU for the twigs; switched off by the start-up check on a weak one.
- Start-up check (`frameCost` in `src/main.js`): times two frames at half size, with `readPixels` to force the GPU to finish, scales the result up by a measured factor (2.5), then sets MSAA and resolution. The answer is kept in `localStorage` for a week. A running check lowers resolution further if frames stay over 21 ms. `?tune=fresh` measures again.
- Live adjustment: resolution steps down after 45 slow frames and up after 150 smooth ones. A failed step up sets a ceiling just below it. If two steps down in a row buy nothing, the frame rate is being held by the browser, not the GPU; the resolution is put back and left alone.
- Start-up: `createPrograms` in `engine/glkit.js` starts every shader compile and link before asking for any result, so the browser can build them side by side.
- Phone settings: 3,200 twigs, 22,400 leaves drawn 1.5× larger, 14,000 grass blades, 1024 shadow map.

## Not done yet (honest list)

- No texture assets: bark and ground are all code. Poly Haven bark would help close-ups.
- Leaf blades are plain: no vein detail or serrated edge, visible in the crown view.
- Shadows are a single 9-tap or 4-tap look-up, with no distance-based softening.
- Frame rate measured on one weak GPU only. No real phone test.
