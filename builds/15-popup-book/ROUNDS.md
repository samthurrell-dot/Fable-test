# 15 – The pop-up book: rounds

Checked on this PC (Intel UHD Graphics 615, a low-power laptop chip) in the desktop app's browser pane. The pane was hidden for most of the run, so pictures were saved straight from the canvas (`window.__shot`, see `src/main.js`) and frame cost was measured by drawing frames back to back (`window.__bench`), not from the live loop.

## The rules of the medium (decided before any code)

- **The sheet.** Everything is flat card about 0.45 mm thick, printed on one side, white on the back and white through the middle. Pages are two sheets back to back.
- **An edge.** A cut shows the white core, and the knife presses the ink away along the front of every cut, so each piece has a thin pale rim. Where a piece meets its glue tab there is no cut: it is a fold.
- **A fold.** Card does not fold sharp. A crease is a narrow bent strip, and the ink cracks along it a little.
- **Colour.** Flat inks from a small set of card colours, five or six to a spread. Tone comes from a halftone screen or from a second flat shape, never from a smooth digital gradient.
- **Flaws.** Card is not dead flat (a slow wave across each sheet), ink is not dead even (mottle), and the tooth of the paper shows in close-up.
- **Motion.** Nothing stretches and nothing passes through anything else. Every piece is rigid and is placed by solving the paper mechanism it belongs to from the angle of the pages. A person could cut and glue what is on screen.
- **Light.** One soft window from the left and behind, the room and a white card for fill. Matte card: no highlights. Shadows sharp where card touches card and soft further off.

## v1 (round 0)

Built: fold engine (V-fold, parallel fold, floating layer, sliding and turning parts), card mesher (faces, cut edges, pressed rims, bent folds), print atlas, renderer (moving and still modes), the book (six leaves, five spreads), page turning under the pointer, pull tabs, slider, wheels, the automatic run, the engineer's view, sound.

The story, "Where the river goes": a paper boat goes from the hills to the sea, and the river runs down the fold of the book on every spread.

| Spread | Mechanisms |
|---|---|
| 1 Hills | two V-folds, two parallelogram layers, pull tab (the boat and the water run down a channel) |
| 2 Forest | two V-folds, two parallelogram layers, slider (the boat rides a slot cut along the rapids) |
| 3 Mill | V-fold, two parallelogram layers, parallel-fold bridge over the spine, wheel (the waterwheel) |
| 4 Marsh | floating layer with windows, V-fold, two parallelogram layers, pull tab working two levers |
| 5 Sea | five V-folds with the same angles (four rows of waves and the lighthouse), wheel (day and night) |

Faults found on the first looks and fixed before the v1 commit:
1. **Feet sunk into the page; glue tabs showing in front of pieces when a spread was half shut.** The pop-ups were hinged on the middle plane of each leaf, so a leaning piece passed through the thickness of the page near its foot. Fix: a new spine model (`engine/spine.js`). The leaves are a chain, hinged face to face, so each spread's hinge lies exactly in both printed surfaces; the two stacks of leaves hang from the open hinge and come to rest on the table.
2. **A white line along the foot of every standing piece.** The mesher gave the bottom edge a cut face. In card that edge is a fold into the glue tab. Fix: edges on a glue line get no cut face and no rim (`foldEdge`).
3. **White struts showing behind layers.** Fix: struts take the colour of what is behind them, as printed struts do in real books.
4. **The sun on spread 1 stuck out of the shut book by 2 cm.** Found by `book.check()`, which folds every spread shut and measures what lies outside the page. Fix: the far peaks moved 1.2 cm down the spine and the sun made smaller. A duck on spread 3 lay across the spine; moved.
5. **Washed out.** Exposure 0.78 put white card at the top of the tone curve and made the oak table beige. Fix: exposure 0.42, darker wood.
6. **Sea spread cropped, cover cropped and blurred.** Fix: a camera position for each spread; smaller lens opening on the shut book.

`book.check()` after the fixes, over the full motion of every spread: worst departure from rigid 9e-16, worst gap at a glue seam 4e-15 cm, no linkage past its reach, nothing outside the shut book (0.01 cm on spread 5).

Speed at v1, 1536×1152 on the UHD 615, "high" settings: 36 ms a moving frame at full resolution with 4× multisampling, 11.5 ms at 0.6 scale.

## Round 1 (look)

Three weakest things:
1. **Flat light.** The window was nearly side-on and the room light was almost as strong, so shadows were faint and fell behind the pieces. Changed: key moved round to the back left (`[-0.6, 0.6, -0.53]`), made stronger and smaller (4.5°); room light cut by 28%. Shadows now fall towards the camera and show the shape of every piece on the page.
2. **Card too clean.** Flat colour with only faint mottle. Changed: white specks where ink missed the paper (seen in close-up), more mottle, and the pale line along a fold made thinner (it read as a white stripe).
3. **Pages were flat fields of one colour.** Changed: each page is printed darker towards its far edge with a halftone screen, which gives depth at reading distance and dots in close-up.

Also: struts printed to match what is behind them; the heron moved clear of the reeds; cover framed whole.

## Round 2 (the wider scene, and life)

Three weakest things:
1. **A book on a bare table.** Changed: the maker's things lie round it, all made from the same kind of part as the book: a boat folded from a page, a boxwood rule, a pencil, a bone folder, a stick of glue, and offcuts with the shapes of the book's firs and waves cut out of them.
2. **Pages landed dead.** Changed: a landed page bounces a little on the card folded under it (about 2° and gone in half a second).
3. **Nothing said "you can move this".** Changed: the camera leans a little towards the mouse, and in the automatic run a ring shows on each tab or wheel just before the book works it.

## Round 3 (paper rules, speed, phone)

Three weakest things:
1. **Card passing through card.** `book.collisions()` was written for this round. It found three real faults: on spread 2 the boat started under the foot of the near bank, and the fallen trunk stood across the slider's slot; on spread 4 the left-hand reeds passed through a leg of the floating layer. All three moved. Result now: none, over every spread, ten poses each, with every tab, slider and wheel at three positions.
2. **Slow first seconds on a slow chip.** The page waited for the running check to step the resolution down. Changed: three frames are timed at start-up and the scale is set for a 13 ms frame. (`gl.finish()` did not wait; a `readPixels` does.)
3. **On a phone the book was a small strip in a tall picture.** Changed: on a tall screen the pop-up fills the width (the page edges run off the sides), the camera looks down more steeply, the words of the spread are shown under the picture, and the buttons no longer wrap.

Speed at 1920×1080 on the UHD 615, "high" settings, a page in the air with two spreads half open:

| Scale | ms a moving frame |
|---|---|
| 1.0, 4× multisampling | 27.5 |
| 0.65 | 13.7 |
| 0.5 | about 10 |

The start-up check picks about 0.69 here. A recent laptop GPU should hold 60 at full size; not measured.

Phone settings at 375×812 (563×1218 drawn): 14 ms a frame at full scale on this chip.

## Round 4 (art, sound, demos)

Three weakest things:
1. **Printed fronts were dull.** With the window behind, the faces towards the camera were lit only by the room. Changed: the two fill patches on the camera's side raised by about 40%; the far peaks on spread 1 printed with a lighter screen so the rock bands show.
2. **Small things in the art.** The deer had two legs; trees on the marsh bank looked like spires; the lighthouse "beams" looked like windmill sails; the stream's ripples were a zip. Changed: four legs; round trees; a paper star behind the lamp; ripples set unevenly. A cat was added to a roof on spread 3.
3. **Sound unmeasured.** Changed: levels read from the page's output (silent at rest, page turn peaks 0.13, music box 0.10), then tab rub and music box raised a little.

Demos added: `demo/fold.html` (the mechanisms alone, with their angles on sliders and the rigidity numbers live) and `demo/paper.html` (the renderer alone, with the light on sliders).
