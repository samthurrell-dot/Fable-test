# 13 – A tree through the seasons: rounds

State: **draft**. v1 plus three rounds are done (two on the look, one on speed). The prompt asks for at least 4 improvement rounds, so at least one is still owed (see "Next" at the bottom).

Checked in the desktop app's browser pane on this PC (Intel UHD Graphics 615, a low-power laptop chip). The pane was hidden during the run, so frame rate was measured with `window.__bench()` (draws frames back to back and waits for the GPU) and not from the live loop.

## v1 (round 0)

Built: space colonisation tree, twigs, instanced leaves and blossom, bark shader, meadow, sky and hills, shadow map, depth of field, four seasons from one number, slider, three views, sound.

First look found three faults, fixed before the v1 commit:
1. **A grey veil over everything.** Fog was added from the lens. The fog colour is as bright as the sky, so even 15% lifted the blacks to mid grey. Fix: `FOG_START` – 42 m of clear air before haze begins.
2. **Trunk like a pole.** Pipe exponent 2.2 with few branch tips gave a 0.2 m trunk. Fix: exponent 2.0, tip radius 0.015, more attractors, smaller kill radius (finer branching).
3. **Shade under the tree was a black slab.** Sun to sky ratio was about 12:1. Fix: more skylight on the ground, less crown occlusion.

## Round 1 (look)

Three weakest things:
1. **Spring did not read as blossom.** Leaves opened at the same time as the flowers and hid them; falling petals were dark grey squares. Changed: leaves now break bud after the blossom is fully out (`LEAF_GROW_START` 0.07 → 0.105); petals get strong translucency and full skylight; the spring still moved to y = 0.135.
2. **Autumn crown was half bare by the time it had turned, and the falling leaves made a solid curtain.** Changed: colour turn squeezed into a shorter window and leaves hang longer (`LEAF_TURN_SPREAD` 0.14 → 0.10, `LEAF_HANG_MIN` 0.04 → 0.06); fall speed 2.3 → 3.6 m/s so fewer are in the air at once; autumn still moved to y = 0.605.
3. **A white band at the horizon, hills floating above it.** The meadow faded to bright fog long before the hills. Changed: the ground hazes at 30% of the air's rate and fades to a hill-tinted haze; hills are lower and pale towards their feet.

Smaller changes: moss hidden under snow, less root flare (it looked like a skirt), darker crown interior, larger snowflakes, less cloud in autumn and mid winter.

## Round 2 (speed)

Measured at 1920×1080 on the UHD 615, phone settings (22,400 leaves):

| Setting | ms per frame |
|---|---|
| Start of round, 4× MSAA | 71–79 |
| No depth of field | 76 (so the lens blur is not the cost) |
| No MSAA | 53 |
| Half resolution, no MSAA | 21 |
| After this round, full resolution, 4× MSAA | 55 |
| After this round, auto-tuned (0.56 scale, no MSAA) | **17** |

Desktop settings (56,000 leaves) cost 175 ms at the start of the round; not measured again.

Three weakest things:
1. **Scene shading, not geometry or blur, was the cost.** Changed: draw order is now tree → grass → ground → sky with the sky on the far plane, so hidden ground and sky pixels are never shaded.
2. **Too many noise look-ups per pixel.** Changed: two-octave noise for broad patches, snow maths skipped outside winter, four shadow taps on leaves and grass instead of nine.
3. **No way to cope with a weak GPU at start-up.** Changed: a start-up check times three real frames, switches MSAA off above 20 ms and picks an internal resolution aimed at 13 ms. `?t=` skips the check so stills are full quality.

## Round 3 (look)

Three weakest things:
1. **The sky was grey smears in every season.** Clouds were noise on a flat plane, which stretches into streaks near the horizon, and the long lens only ever sees the horizon. Autumn mixed an orange horizon with a blue zenith, which makes grey. Changed: clouds now live on a cylinder round the viewer (no smear, no seam) with bright tops and blue-grey bases; a warm band of air sits low on the horizon; autumn zenith is now a pale warm grey so the mix stays golden.
2. **The crown was one flat green with no form.** The sun was behind the tree in every season, so the side facing the lens was all in shade. Changed: the sun's direction is now set per season (`sunAzimuth` in `engine/seasons.js`): side light in spring and summer, more from behind in autumn and winter. Whole sprays of leaves share a darker or yellower tone (`CLUMP_SIZE`) and turn similar autumn colours together. Leaves have side veins that fade out at distance; stronger gloss.
3. **Winter snow was flat and the light was dull.** Changed: the snow surface is tilted by the slope of a broad noise so the low sun rakes across soft drifts (`SNOW_RELIEF`); mid-winter sun is stronger and warmer against a bluer sky fill.

Measured after this round on the UHD 615, phone settings: full 1920×1080 with 4× MSAA 63 ms (was 55: the new clouds and veins cost about 8 ms); auto-tuned size (1075×605, no MSAA) 18 ms (was 17). The start-up check aims for 13 ms, so it now picks a slightly lower resolution.

## Load time and the site home page (not an improvement round)

Sam put the repo on GitHub Pages and found two things: the site address showed the README, not a page, and the tree took a long time to appear.

- **Home page.** The repo had no `index.html` at the top, so Pages rendered the README. Added a home page that links to the build, and `.nojekyll` so Pages serves the files as they are (no Jekyll step on each push).
- **Load time.** Measured on the live site before the change: scripts arrived in three waves (about 750 ms), then about 890 ms of work before the first picture, with a blank screen throughout. Changes:
  - all eight scripts are preloaded together (`modulepreload`), not found one wave at a time;
  - the nine GPU programs are compiled side by side (`createPrograms` in `engine/glkit.js`), not one after another;
  - the start-up speed check now times two frames at half size and works out the rest (115 ms, was about 550 ms), and the answer is remembered on the device for a week (10 ms on later visits);
  - a "Growing the tree…" line on a sky-and-grass backdrop shows at once, and start-up pauses between steps so the browser can paint it.
- **Measured after, locally on the UHD 615:** first visit 580 ms from script start to first picture (tree 300, GPU programs 130, speed check 115); later visits 300 ms. Not measured: a truly cold first visit, where the browser has never compiled these shaders. That is likely to be slower.

## Next (rounds still owed)

- Cloud cover is thin in the wide view: mostly a clean gradient. A few clear cumulus shapes would add life.
- Leaves have no serrated edge; the autumn leaf fall still reads as a sheet on the downwind side.
- Winter: tree shadow on snow is still faint from the wide view; no snow build-up shape on the ground at the trunk.
- Grass blades in shade read as dark spikes at the edge of the shadow.
- Not checked: a real phone, a real desktop GPU, the sound (written, never heard), dragging the slider by touch.
- Bark and ground use only code-made textures. Poly Haven bark would raise realism (needs a download).
