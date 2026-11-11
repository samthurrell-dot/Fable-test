# Rules for any model working in this repo

This repo is Sam's test bed for long "showpiece" builds (mostly on Claude Fable 5.2, some on Opus 5.5) and for turning their code into reusable skills and knowledge. Usage and output limits will be hit mid-task. Work so that a cut-off never loses work.

## Read first
1. `STATUS.md` – what is in progress, what is done, what to do next.
2. The build's own `builds/<nn-name>/ROUNDS.md` if you are continuing a build.

## Checkpoint rules (the important bit)
- Commit **and push** after: the first working v1, every improvement round, and every harvest step. Small commits are fine.
- Commit message format: `<build>: <what changed> (round N)` e.g. `13-tree: leaf translucency, autumn fall (round 2)`.
- Before you stop for any reason, update `STATUS.md` (one line under the build) and push.
- Never leave the build broken on `main`. If a round is half-done when you must stop, commit it to a branch called `wip/<build>` and say so in `STATUS.md`.
- Keep the final reply to five lines or fewer.

## Layout
- `builds/<nn-name>/` – one folder per build. Entry file `index.html`. Each build must work as a static page (GitHub Pages).
  - `ROUNDS.md` – per round: the three weakest things and what changed.
  - `TECHNIQUES.md` – what each engine does, why, key parameters, cost, mistakes fixed.
  - `prompt.txt` – the exact prompt used, and which model and effort level ran it.
- `knowledge/` – technique cards harvested from builds (see `skills/build-harvest`).
- `skills/` – skills usable by Claude and Gemini. Plain markdown, no product-only tool names.
- `prompts/ready/` – prompts ready to paste.
- `reference/maker-skool-prompts/` – the original 15 prompts by Nick Saraev (Maker Skool). Do not edit.
- `plan/` – which builds to run on which model, and why.

## House rules
- UK English, plain words.
- Phone first as well as desktop: check at 390 px portrait, touch for every input, lower resolution and effect counts on phones.
- No CDN; keep a local copy of three.js inside the build folder.
- Large binary files (videos, big bakes over ~20 MB) do not go in git. Note where they are instead.
- Do not touch Sam's other repos from here.
