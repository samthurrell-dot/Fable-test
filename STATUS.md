# Status

Last updated: 11 Nov 2026 (Fable 5.2, first build session)

## Done
- [x] Reviewed the 15 Maker Skool prompts and the video of results.
- [x] Skill: `skills/showpiece-prompt-builder` (how the prompts are built, templates, model choice).
- [x] Skill: `skills/build-harvest` (turn finished build code into knowledge for other models).
- [x] Plan: `plan/viability.md` (which builds on Fable 5.2, which on Opus 5.5).
- [x] Ready prompts in `prompts/ready/`.

## In progress
- **13-tree-seasons** – DRAFT. v1 + round 1 (look) + round 2 (speed) done and working on `main`. 3 improvement rounds still owed. What to fix next is listed at the bottom of `builds/13-tree-seasons/ROUNDS.md`.
  - Why 13 was run first and not 06: it is the shortest Fable-ranked run (55 min cap), needs no Blender and no downloads, and has the highest reuse score in `plan/viability.md`. 06 and 15 are still to run.

## Next
- Carry on with 13: say "Read STATUS.md and carry on with 13-tree-seasons".
- Check 13 on a real phone and a stronger GPU; listen to the sound.
- Then 06 lightbulb and 15 pop-up book from `prompts/ready/`.
- Harvest 13 with `skills/build-harvest` once its rounds are done (`engine/tree.js` and `engine/seasons.js` are already separate modules).

## Build log
| Build | Model + effort | State | Rounds done | Link |
|---|---|---|---|---|
| 13-tree-seasons | Fable 5.2, default effort | Draft, works | v1 + 2 of 4 | `builds/13-tree-seasons/index.html` |
