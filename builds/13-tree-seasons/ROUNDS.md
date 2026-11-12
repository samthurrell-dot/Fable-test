# 13 – A tree through the seasons: rounds

State: v1 plus five rounds are done (the prompt asks for at least four). Rounds 4 and 5 follow Sam's own briefs. What is still open is under "Next" at the bottom.

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

## Round 4 (life) – Sam's brief

Sam, after looking at round 3: the tree itself is good; the wind sounds like road noise; the bird sounds are liked; spend this pass on ground detail and ambient life. "The beauty of a tree is the life that it holds."

Three weakest things:
1. **Nothing lived in the picture.** Added, all as pure functions of time so they scrub and freeze like the rest (`engine/life.js`, `src/wildlife.js`):
   - up to nine small birds (robin, blackbird, blue tit, sparrows, chaffinches) that sit on real branches, look about, hop, fly to other perches in bursts-and-glides, and loop out round the tree; two or three stay through winter;
   - a red squirrel that forages in the grass, bounds to the trunk, climbs it, runs out along a bough, sits up and flicks its tail, then comes back down (absent in deep winter);
   - 20–30 butterflies over the meadow and at the crown's edge from late spring to early autumn;
   - a flock of eleven geese that crosses above the crown in autumn;
   - pollen and seed fluff hanging in the summer air.
2. **The ground was bare grass.** Added: drifts of daisies, buttercups, red clover and poppies that open and fade on their own dates; a few tall seed-head stems; surface roots snaking out from the trunk; troops of toadstools near the roots in autumn.
3. **The wind sounded like a road.** It was low, steady, filtered noise. Rebuilt as leaves: a bright hiss that swells and dies in slow, uneven gusts and falls nearly silent between them, a quiet body of moving air under it, and a thin breath through bare twigs in winter. Kept the chirps Sam liked and added two more singers (a two-note see-saw and a slow, low fluting phrase) plus a lone winter singer.

Fixed on the way:
- Flower heads were drawn at twice the intended size (the quad is centred, so "size" was a radius). Halved.
- The squirrel's foraging spot was out of frame in the ground view and far out of focus. Moved to the right of the trunk, level with it.
- Close views blurred everything but a thin slice. Each view now has its own depth-of-field strength.
- Snow-covered roots looked like white claws. Roots are lower and thinner.
- The autumn flock was hidden behind the crown, edge-on and blurred away. It now flies just above the crown, 30 m behind it, angled a little towards the lens.
- The start-up speed check had become too cautious and pinned resolution at the minimum. Resolution now also steps back up after a long smooth spell, and stops adjusting if a step down buys nothing (a browser power saver holding 30 fps).

Measured after this round on the UHD 615, phone settings, early summer with ten animals out: full 1920×1080 with 4× MSAA 56 ms; 1075×605 without MSAA 16.7 ms. No measurable cost from the wildlife.

Sound: Sam listened after this round and said the new wind sounds right. (I cannot hear it; I only ran it for errors.) Leave the wind recipe in `src/sound.js` alone unless he asks.

Not checked: The live frame rate in this app's browser pane sits at a flat 30 fps whatever the resolution, so the new step-up logic is tested only for not misbehaving there.

## Round 5 (polish) – Sam's brief

Sam, after round 4: the squirrel's movement is "a bit basic"; the sounds are "okay" but could be better; the birds are good; turn up the polish and visual fidelity, because this is a showcase piece he will share.

Three weakest things:
1. **The squirrel was one stiff shape that slid along a line.** Rebuilt from nothing (`engine/squirrel.js`). Its body is now built afresh in its pose every frame: a spine that stretches and humps, a head that turns on its own, four jointed legs, a tail that curls and ripples, ears with tufts, eyes, pale belly. It bounds as squirrels do (hind feet together, stretch, front paws down, back humps), sniffs and digs, sits up to eat with a nut in its paws, washes its face on the bough, clings flat to the trunk with its head lifted out, comes down head first, bolts upright when alert, and swings round with a small hop when it changes direction. Fur shader with a ragged outline and lit tips. A fourth camera view follows it.
2. **The sound was wind plus three generic bird noises.** Now eleven singers, each a named bird with its own few phrases that it repeats, its own place (left or right, near or far) and its own months: house sparrow (Sam's liked chirps, unchanged), robin (all winter too), blackbird, great tit, chaffinch, blue tit, chiffchaff, wood pigeon, cuckoo in late spring, a woodpecker drumming at winter's end, crows in autumn and winter. Far birds are quieter, duller and carry more echo (a short open-air echo made in code). Bees and grasshoppers in summer. Tied to the picture: claws on bark and swishes in grass as the squirrel moves, its scolding call when it bolts upright, wings at take-off, geese calling as the flock passes. Snow dulls everything. The wind recipe Sam approved is unchanged, but its two halves now sit left and right and gust a moment apart.
3. **The wider picture was static and plain past the tree.** Added: patches of cloud shadow that drift over meadow and tree; gusts that roll through the grass and flowers as visible waves; far drifts of flower colour; a wood on the near ridge that turns with the seasons (green, gold, bare, snowed); two ranges of blue far hills; fuller clouds with ragged, lit edges; a soft glow round the brightest things (snow in sun, blossom, cloud edges); shorter grass in the crown's shade; grass and flowers out to 32 m.

Also:
- All shader noise now comes from one small texture of random numbers (one lookup, not four or eight hashes). This more than paid for everything above: see the table.
- "Sharp" mode. A slow graphics chip cannot give both a sharp picture and 60 frames a second. If 60 would need the picture below 72% size, the page now runs at 30 frames a second and spends the time on resolution. `?pace=60` or `?pace=30` forces either.
- For sharing: a link-preview picture (the four seasons side by side), preview tags, an icon, real pictures of the four seasons on the site home page. The scene fades in; the words and controls step back after six still seconds.

Measured on the UHD 615 at 1536×1152, phone settings, ms per frame:

| | round 4 | round 5 effects, old noise | round 5 |
|---|---|---|---|
| Summer, 4× MSAA | 60.0 | 73.4 | 54.4 |
| Summer, no MSAA | 35.9 | 46.1 | 34.7 |
| Winter, no MSAA | 40.4 | 45.9 | 29.3 |

Sound levels were measured in the page (peak after the master gain): each singer peaks at 0.03 to 0.05, so none drowns the rest. Wing flutter was three times that and was turned down.

Not checked: I still cannot hear anything; the levels are measured, the character is not. The squirrel was checked as stills of each pose, not as watched motion. The preview pane here stops drawing when it is hidden, so the 30 frames a second pacing was seen working only in short bursts. No real phone, no faster GPU.

Sam's verdict (12 Nov 2026): the squirrel "looks right" in motion. The small chirps are "really good", but the larger bird calls (he named the cuckoo and "maybe a goose") "sound very fake": better to leave them out and keep only the little chirps.

Done the same day: wood pigeon, cuckoo, crow, geese and the woodpecker's drumming are removed. Seven small songbirds are left (sparrow, robin, blackbird, great tit, chaffinch, blue tit, chiffchaff). The blackbird is the lowest and slowest of these; if it also sounds false, drop it from `SINGERS` in `src/sound.js`. Bees, grasshoppers and the squirrel and wing sounds are still in; Sam has not commented on them. No word yet on sharp mode.

## Next

- The squirrel's hind feet do not turn backwards when it comes down the trunk head first, as a real one's do. Sam is happy with its movement as it is.
- A singing bird is still not the bird you see; only take-offs, the flock and the squirrel are tied to the picture.
- Birds are hard to pick out while perched inside the leaves; they read best in flight and in winter.
- Leaves have no serrated edge; the autumn leaf fall still reads as a sheet on the downwind side.
- Winter: tree shadow on snow is still faint from the wide view; no snow build-up shape on the ground at the trunk.
- The far hills are smooth bands; the ground is flat. A gentle roll in the land would add depth but touches everything that sits on the ground.
- Not checked: a real phone, a real desktop GPU, the sound by ear (Sam has the only ears), dragging the slider by touch.
- Bark and ground use only code-made textures. Poly Haven bark would raise realism (needs a download).
