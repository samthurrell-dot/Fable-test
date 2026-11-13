# Prompt snippet: paper-fold kinematics

Paste this into a prompt for any build with pop-ups, folding card or a book that opens.

> Use the fold engine in `knowledge/paper-fold-kinematics/engine/` (`fold.js`, and `spine.js` if there is a book or anything with thick leaves). Read its CARD.md first and open `demo.html` to see each mechanism. Do not write a physics or constraint solver for paper: every piece is a rigid `Frame`, placed by `rig.vfold`, `rig.parallel`, `rig.float` or `rig.planar` from the angle of the pages. Do not edit the engine files. Start from the angles in the card (V-fold alpha 110, beta 93; fan 0.026 rad) and change them only for a reason. Build each spread at its open pose. Before any work on colour, light or art, write the two paper checks from the card (the paper rules, and card passing through card), run them over the whole motion, and fix what they find; paste their results into your notes. Spend your effort on the design of the scenes and how they move, not on the maths.

If the build copies the engine into its own folder, copy the files unchanged and say where they came from in the build's `TECHNIQUES.md`.
