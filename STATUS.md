# Status

Last updated: 13 Nov 2026 (Fable 5.2, build 16 Bunker Billionaire)

## Done
- [x] Reviewed the 15 Maker Skool prompts and the video of results.
- [x] Skill: `skills/showpiece-prompt-builder` (how the prompts are built, templates, model choice).
- [x] Skill: `skills/build-harvest` (turn finished build code into knowledge for other models).
- [x] Plan: `plan/viability.md` (which builds on Fable 5.2, which on Opus 5.5).
- [x] Ready prompts in `prompts/ready/`.
- [x] Harvest of 15-popup-book (13 Nov 2026, Fable 5.2): three technique cards, each with its engine copied unchanged, a demo, and a prompt snippet. `knowledge/paper-fold-kinematics` (fold.js, spine.js, and the recipe for the two paper checks), `knowledge/card-mesh-atlas` (cardmesh.js, atlas.js), `knowledge/paper-renderer` (paperlight.js, papershaders.js, glkit.js, mat4.js). Listed in `knowledge/INDEX.md`. All three demos load with no console errors at desktop size and 390 px wide on this PC. Not done: step 6 of the skill (see Next).

## In progress
- **13-tree-seasons** – v1 + five rounds done and working on `main` (1 look, 2 speed, 3 look, 4 life, 5 polish: jointed squirrel, songbird soundscape, cloud shadows, gusts, wood on the ridge, glow, sharp 30 fps mode, link-preview picture). Sam is steering it by eye and ear: read his briefs at the top of rounds 4 and 5 in ROUNDS.md before changing anything. He has approved the tree, the birds and the wind sound; leave those alone unless he asks. What is still open is at the bottom of `builds/13-tree-seasons/ROUNDS.md`.
  - Why 13 was run first and not 06: it is the shortest Fable-ranked run (55 min cap), needs no Blender and no downloads, and has the highest reuse score in `plan/viability.md`. 06 and 15 are still to run.

- **15-popup-book** – v1 plus five improvement rounds are done and working on `main`. "Where the river goes": five spreads, every mechanism in the brief, solved from the page angle; a spine with real leaf thickness; `book.check()` and `book.collisions()` test the paper rules and both pass. What is not checked (sound by ear, a real phone, dragging by hand) is near the bottom of `builds/15-popup-book/ROUNDS.md`.
  - Why 15 and not 06: Sam asked for the most complex build that needs no extra tools. 15 has the widest set of hard parts (six solved mechanisms, a book that turns, a renderer, five spreads of content) and can be checked properly on this PC; 06 is one deep shader that this PC's graphics chip can barely run.

- **16-bunker-billionaire** – a game prototype from Sam's design outline ("Bunker Billionaire: Act 2", a Word file kept outside the repo), not a Maker Skool prompt. v1 and one improvement round are working on `main`: the whole daily loop, hidden loyalty and fear, 8 staff, 37 event cards, 5 starting cards, 16 endings, the silo as a cut-paper picture, a balance bench. Sam's steer: the game design leads; the paper engines in `knowledge/` were not used. Rounds and what is open are in `builds/16-bunker-billionaire/ROUNDS.md`.

## Site
- GitHub Pages serves `main` from the root: https://samthurrell-dot.github.io/Fable-test/ . The home page is `index.html` at the top of the repo; add a card there for each new build. `.nojekyll` is on purpose.

## Next
- Carry on with 13: say "Read STATUS.md and carry on with 13-tree-seasons".
- Check 13 on a real phone and a stronger GPU. Sam watched the round 5 squirrel on 12 Nov 2026 and said it looks right: leave its movement alone unless he asks. He likes the small bird chirps; the big-bird calls (cuckoo, pigeon, crow, geese, woodpecker) sounded fake to him and were removed on 12 Nov 2026: do not add large-bird sounds back. He has not yet said anything about the sharp 30 fps mode.
- Then 06 lightbulb from `prompts/ready/` (15 is built).
- Test the harvest of 15 with a cheaper model (step 6 of `skills/build-harvest`, not yet done): give Opus 5.5, Sonnet or Gemini only one card from `knowledge/`, its engine and a short new brief (same technique, different subject, about 30 minutes), and add what it gets wrong to that card's Gotchas. A good first test: a single pop-up greeting card using all three cards.
- Harvest 13 with `skills/build-harvest` once its rounds are done (`engine/tree.js` and `engine/seasons.js` are already separate modules).

## Build log
| Build | Model + effort | State | Rounds done | Link |
|---|---|---|---|---|
| 13-tree-seasons | Fable 5.2, default effort | Works; showcase piece | v1 + 5 (4 asked) | https://samthurrell-dot.github.io/Fable-test/builds/13-tree-seasons/ |
| 15-popup-book | Fable 5.2, default effort | Works; showcase piece | v1 + 5 (4 asked) | https://samthurrell-dot.github.io/Fable-test/builds/15-popup-book/ |
| 16-bunker-billionaire | Fable 5.2, default effort | Works; game prototype | v1 + 1 | https://samthurrell-dot.github.io/Fable-test/builds/16-bunker-billionaire/ |
