# Knowledge index

Technique cards harvested from finished builds (see `skills/build-harvest`). Each folder has a `CARD.md` (read this first), an `engine/` of standalone ES modules, a `demo.html` that runs as a static page, and a `prompt-snippet.md` to paste into a new prompt.

| Technique | What it gives you | From build | Card | Demo |
|---|---|---|---|---|
| paper-fold-kinematics | Pop-up mechanisms (V-fold, parallel fold, parallelogram layer, floating layer, tabs and wheels) and a book spine with real leaf thickness, all solved exactly from the page angle. Pure maths. Includes the recipe for the two paper checks. | 15-popup-book | [CARD](paper-fold-kinematics/CARD.md) | [demo](paper-fold-kinematics/demo.html) |
| card-mesh-atlas | Flat outlines to card: faces, white cut edges, pressed rims, bent folds, `foldEdge` for glue lines; frames as a float texture; one packed canvas of print per group. Its demo has the smallest shader that draws the mesh. | 15-popup-book | [CARD](card-mesh-atlas/CARD.md) | [demo](card-mesh-atlas/demo.html) |
| paper-renderer | Raw WebGL2 renderer for card scenes: matte card, one soft window with a blocker search, six fill patches whose shadow maps carry bounced colour, light through a sheet; a cheap moving mode and a still mode that adds frames up into true soft shadow and depth of field. Draws card-mesh-atlas meshes. | 15-popup-book | [CARD](paper-renderer/CARD.md) | [demo](paper-renderer/demo.html) |

## Reading order for a paper or pop-up build
1. `paper-fold-kinematics` (where every panel is, and the two paper checks to pass first).
2. `card-mesh-atlas` (panels and outlines to card with print).
3. `paper-renderer` (light). Its demo imports the other two and is the shortest example of all three working together.

Not yet done for these three cards: step 6 of `skills/build-harvest` (give a cheaper model only a card, its engine and a short new brief, and add what it gets wrong to the card's Gotchas).
