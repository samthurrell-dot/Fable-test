# Status

Last updated: 11 Nov 2026 (Fable 5.2, first build session)

## Done
- [x] Reviewed the 15 Maker Skool prompts and the video of results.
- [x] Skill: `skills/showpiece-prompt-builder` (how the prompts are built, templates, model choice).
- [x] Skill: `skills/build-harvest` (turn finished build code into knowledge for other models).
- [x] Plan: `plan/viability.md` (which builds on Fable 5.2, which on Opus 5.5).
- [x] Ready prompts in `prompts/ready/`.

## In progress
- **13-tree-seasons** – v1 + round 1 (look) + round 2 (speed) + round 3 (look) + round 4 (life: birds, squirrel, butterflies, flowers, roots, new wind sound) done and working on `main`. The prompt's four rounds are met. Sam is steering it by eye now: read his brief at the top of round 4 in ROUNDS.md before changing the look. What to fix next is listed at the bottom of `builds/13-tree-seasons/ROUNDS.md`.
  - Why 13 was run first and not 06: it is the shortest Fable-ranked run (55 min cap), needs no Blender and no downloads, and has the highest reuse score in `plan/viability.md`. 06 and 15 are still to run.

## Site
- GitHub Pages serves `main` from the root: https://samthurrell-dot.github.io/Fable-test/ . The home page is `index.html` at the top of the repo; add a card there for each new build. `.nojekyll` is on purpose.

## Next
- Carry on with 13: say "Read STATUS.md and carry on with 13-tree-seasons".
- Check 13 on a real phone and a stronger GPU. Sam has heard the sound: the old wind was "like road noise" (rebuilt in round 4; Sam heard the new one on 11 Nov 2026 and said it sounds right); the bird chirps were liked.
- Then 06 lightbulb and 15 pop-up book from `prompts/ready/`.
- Harvest 13 with `skills/build-harvest` once its rounds are done (`engine/tree.js` and `engine/seasons.js` are already separate modules).

## Build log
| Build | Model + effort | State | Rounds done | Link |
|---|---|---|---|---|
| 13-tree-seasons | Fable 5.2, default effort | Works; still being polished | v1 + 4 of 4 | https://samthurrell-dot.github.io/Fable-test/builds/13-tree-seasons/ |
