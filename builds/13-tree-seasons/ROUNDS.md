# 13 – A tree through the seasons: rounds

State: **draft**. v1 plus one improvement round and one speed round are done. The prompt asks for at least 4 improvement rounds, so 3 are still owed (see "Next" at the bottom).

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

## Next (rounds still owed)

- Autumn sky is grey, not golden; summer crown is one flat green; leaves in the "crown" view are plain (no veins, no serration).
- Winter: tree shadow on snow is faint; no snow build-up shape on the ground at the trunk.
- Grass blades in shade read as dark spikes at the edge of the shadow.
- Not checked: a real phone, a real desktop GPU, the sound (written, never heard), dragging the slider by touch.
- Bark and ground use only code-made textures. Poly Haven bark would raise realism (needs a download).
