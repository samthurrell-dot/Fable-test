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

**What:** no animal has stored state. `birdState(i, t, …)` works out from the clock alone which perch a bird left, which it is heading for and how far along it is. Time is cut into cycles per bird; a hash of (bird, cycle) picks the perch, so cycle k ends where cycle k+1 begins. Flights are cubic Bezier curves; the tangent gives the heading. The squirrel's path is built from the tree's own skeleton (grass, trunk surface, bough); what it does along that path is in 5d.

**Why:** the whole build can be frozen (`?t=`) and scrubbed. A simulation with stored state cannot. It also costs nothing: about twenty small matrix builds per frame.

**Key parameters:** the `LIFE` table (cycle lengths, speeds, share of looping flights, squirrel stride) and `lifeActivity(y)` (who is about at each time of year).

**Details that mattered:**
- Perches are found on the tree: fairly level, finger-thick branches. Perched birds add the same sway as the branch (`swayOffset` mirrors the GLSL), or they float.
- Small birds fly in bursts: a few beats, a short glide, and a glide in to land. Wings fold on landing.
- Animals are drawn larger than life (birds 1.8×, squirrel 1.4×). At true size from 46 m they are three pixels.
- A flat-winged bird seen exactly side-on is a line. The far flock flies angled towards the lens for this reason.
- Butterflies and flowers are instanced and worked out wholly in the vertex shader from a seed.

## 5d. An animal rebuilt in its pose every frame (`engine/squirrel.js`)

**What:** the squirrel has no fixed model and no skinning. A pose is about twenty numbers (where the hips and chest are, how far the back humps, where the nose points, where each pair of feet is, how the tail curls). Each frame the body is built from them: oval rings swept along the spine, head, tail and each leg, about 850 vertices, sent to the GPU with one `bufferSubData`.

**Why:** blending two postures is blending twenty numbers, so every change of activity eases for free. Legs are solved backwards from where the feet are (two bones and a joint), so planted feet stay planted. A spine that is a curve can stretch and hump, which a rigid model cannot.

**Key parameters:** the `SQUIRREL` table (speeds, stride, blend and turn times) and the posture tables `STAND`, `SIT`, `SNIFF`, `ALERT`, `CLING`.

**Details that mattered:**
- The gait is a bound, not a trot: `gaitPose(g)` takes the phase of one bound. Each pair of feet is planted for a share of it and slides back under the body by exactly the ground covered in that time (`footCycle`), so they do not skate.
- The day is a list of stretches (`buildPlan`): stay here doing this, or go there. Each go is a whole number of bounds. The gait fades in and out with speed.
- The head looks about in snaps and holds (`glance`), never in smooth sweeps. The tail flicks in bursts. Small animals move like this; smooth motion reads as a toy.
- It turns about the surface it stands on, so the same code spins it on grass, on the trunk and on a bough, and it comes down the trunk head first.
- Fur: hairs are noise stretched along the body. Pixels at glancing angles are thrown away by a noise test, which gives a ragged outline; the tips that remain are lit more when the sun is behind.
- A "coat coordinate" that stays with the skin is sent with each vertex, so the fur pattern does not swim as the body bends.
- Cost: nothing measurable.

## 5e. Weather you can see: cloud shadows and gusts (`SHADOW`, `GUST` in `src/shaders.js`)

**What:** `cloudShade(p)` is one slow noise over the ground, drifting downwind, multiplied into the sun wherever a shadow is looked up, so every lit thing gets it with no extra code. `gustAt(p)` is a faster noise stretched across the wind; grass blades and flowers lean further as it passes and the far meadow lightens with it.

**Why:** a still meadow under an even sun looks like a backdrop. Light that comes and goes, and wind you can see arriving, are most of what makes a landscape feel outdoors. Each is one noise lookup per pixel.

**Key parameters:** `CLOUD_SHADE_SIZE`, `CLOUD_SHADE_DRIFT`, `GUST_SIZE`, `GUST_SPEED`, `GUST_BOW`, and `CLOUD_SHADE_DEPTH` in `engine/seasons.js` (none under overcast).

## 5f. Sound: singers, not samples (`src/sound.js`)

**What:** every sound is made in code. Each bird is a singer with a place (`pan`, `far`), months (`months(y)`) and a few phrases it makes up once and then repeats with small changes. One `place()` chain per singer sets loudness, dullness and how much goes to the echo. The echo is a made-up impulse: 1.5 s of dulled, fading noise with five distinct returns.

**Why:** real birds repeat their own phrases, sing from fixed perches, and are heard at different distances. Random chirps from the centre sound like a machine. Distance is three things at once: quieter, duller, more echo.

**Details that mattered:**
- Wind must not be a steady low rush (that is a road). It is a bright hiss that swells in slow, uneven gusts and falls almost silent between them. Sam approved this; leave it.
- Keep to small songbirds. Short, high, quick whistles made from sine waves pass for real birds. Big-bird calls made the same way (cuckoo, wood pigeon, crow, geese) do not: a long, low, steady tone gives the ear time to hear that it is a machine. Sam heard them and asked for them out.
- WebAudio's compressor adds its own make-up gain; it is only there to catch pile-ups.
- Measure levels in the page with an `AnalyserNode` when you cannot listen: `__sound.audition('cuckoo')` plays one phrase of any singer.
- Sounds tied to the picture (claws, wings, geese) take a pan and a nearness worked out from the camera in `src/main.js`.

## 6. Lens (`POST_FS`)

One-pass depth of field: a golden-angle spiral gather where each sample counts only if its own blur circle reaches the centre pixel. Then exposure, per-season saturation and tint, a filmic curve, vignette and grain. Measured cost: too small to see (removing it did not lower frame time).

## 6b. Glow (`BRIGHT_FS`, `BLUR_FS`)

**What:** the brightest parts of the picture (above 1.15, where 1 is white paper in full sun) are copied at quarter size, blurred twice, and added back at 11%.

**Why:** snow in sun, blossom and cloud edges spill a little light in a real lens. Without it they look cut out. At a sixteenth of the pixels the cost is too small to measure.

## 7. Speed

- Draw near things first and the sky last on the far plane: saved about 25% at full resolution.
- 4× MSAA on a half-float target costs about 30–45% on this GPU. Worth it on a strong GPU for the twigs; switched off by the start-up check on a weak one.
- Start-up check (`frameCost` in `src/main.js`): times two frames at half size, with `readPixels` to force the GPU to finish, scales the result up by a measured factor (2.5), then sets MSAA and resolution. The answer is kept in `localStorage` for a week. A running check lowers resolution further if frames stay over 21 ms. `?tune=fresh` measures again.
- Live adjustment: resolution steps down after 45 slow frames and up after 150 smooth ones. A failed step up sets a ceiling just below it. If two steps down in a row buy nothing, the frame rate is being held by the browser, not the GPU; the resolution is put back and left alone.
- Noise from a texture: `noise2` and `noise3` read a 256×256 texture of random numbers (red, and green = red shifted by (37, 17)) with the fraction eased first. One lookup replaces four or eight hashes. This took a quarter off the whole frame. Where one noise cell is stretched over a huge area (cloud shadow, snow drifts) the texture's 256 blending steps could show as faint bands, so those two use the worked-out `noise2h`.
- Sharp mode: if 60 frames a second would need the picture below 72% size, run at 30 and spend the time on resolution (`SHARP_MIN_SCALE` in `src/main.js`). Frames are drawn on every other screen refresh so they stay evenly spaced.
- Start-up: `createPrograms` in `engine/glkit.js` starts every shader compile and link before asking for any result, so the browser can build them side by side.
- Phone settings: 3,200 twigs, 22,400 leaves drawn 1.5× larger, 14,000 grass blades, 1024 shadow map.

## Not done yet (honest list)

- No texture assets: bark and ground are all code. Poly Haven bark would help close-ups.
- Leaf blades are plain: no vein detail or serrated edge, visible in the crown view.
- Shadows are a single 9-tap or 4-tap look-up, with no distance-based softening.
- Frame rate measured on one weak GPU only. No real phone test.
