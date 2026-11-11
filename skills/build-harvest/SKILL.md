---
name: build-harvest
description: Turn the code from a finished showpiece build (often made by a stronger model like Fable 5.2) into reusable technique cards, engine modules and prompt snippets that other models (Opus, Sonnet, Gemini) can use in new projects.
---

# Build harvest

Use this after a build is finished (or cut off) when Sam wants to keep what it learned: "turn this into a skill", "harvest the tree engine", "make this reusable for Opus", "what can other models learn from this code".

The idea: spend the strong model's time on the hard maths once, then let cheaper models reuse it. A cheaper model given a working engine plus a clear card does far better than one starting from a prompt alone.

Works for any model that reads skills. Names no product-only tools.

---

## Inputs
- The build folder (code, `ROUNDS.md`, `TECHNIQUES.md`, `prompt.txt` if they exist).
- Screenshots of the best moments, if any.

## Outputs (all in the repo)
1. `knowledge/<technique>/CARD.md` – one card per technique (template below).
2. `knowledge/<technique>/engine/` – the engine as a standalone ES module, lifted out of the build with its scene content removed.
3. `knowledge/<technique>/demo.html` – the engine alone, with sliders for its main parameters. Must run as a static page.
4. `knowledge/<technique>/prompt-snippet.md` – text to paste into a future prompt so another model uses the engine well.
5. A line in `knowledge/INDEX.md`.
6. Optional: a new or updated skill in `skills/` when a technique is broad enough (for example "glass and refraction in WebGL").

---

## Steps

### 1. Inventory
Read the build. List every technique in it in a table: name, file(s), lines of code, how hard it was (look at `ROUNDS.md` – things fixed in several rounds were hard), and whether it is general or specific to this scene.
Keep only the ones that are **general and hard**. Easy or scene-specific code is not worth a card.

### 2. Lift the engine
- Copy the engine code into `knowledge/<technique>/engine/`. Do not rewrite it from memory; copy, then trim.
- Remove scene content (the story, the specific model, copy text). Keep the maths.
- Give it a small API: one setup function, one update function, named options with defaults.
- Turn magic numbers into named options with a comment on what each changes.
- Keep the licence of anything third-party (three.js is MIT; Poly Haven assets are CC0).

### 3. Prove it still works
- Build `demo.html` with sliders for the main options.
- Load it in a headless browser, take screenshots at 2–3 settings, read them, and compare with screenshots of the original build. If it looks worse, you lost something in the lift: find it.
- Measure frame rate on desktop and in a phone-sized window.

### 4. Write the card
Use the template. Be concrete. Numbers beat adjectives.

### 5. Write the prompt snippet
Short text for a future prompt, for example:
> Use the engine in `knowledge/tree-growth/engine/`. Read its CARD.md first. Keep its defaults unless the brief says otherwise. Spend your effort on the scene, look and interaction, not on rewriting the engine.

### 6. Test with a different model (the real check)
Give a cheaper model (Opus 5.5, Sonnet, Gemini) only the card, the engine and a short new brief (a variant: different subject, same technique). Time-box it to about 30 minutes.
- If it succeeds, the harvest worked.
- If it fails, note *where* it went wrong and add that to the card's "Gotchas". Repeat once.

### 7. Commit
Commit and push after each technique. Update `knowledge/INDEX.md` and `STATUS.md`.

---

## Card template (`CARD.md`)

```
# <Technique name>

Harvested from: builds/<nn-name> (model, effort, date)
Engine: knowledge/<technique>/engine/<file>.js   Demo: knowledge/<technique>/demo.html

## What it does
Two or three plain sentences.

## When to use it / when not to
- Use for: ...
- Do not use for: ...

## How it works
Short numbered steps of the method. Name the algorithm (for example "space colonisation", "à-trous denoiser", "Voronoi fracture") and link a source if you are sure of one.

## Main options
| Option | Default | Safe range | What it changes |

## Cost
Frame time on desktop and on a phone-sized window, memory, load time. Say how it was measured.

## Gotchas
Mistakes the build made and fixed (from ROUNDS.md), and anything the second-model test got wrong.

## Look checklist
What a good result looks like, so a model can judge its own screenshots.

## Prompt snippet
(copy of prompt-snippet.md)
```

---

## Making a skill from several cards
When two or more cards share a theme (glass, paper, plants, physics), write a skill in `skills/<theme>/SKILL.md` that:
- says when to use it,
- lists the cards and engines,
- gives the order to read them in,
- includes the look checklists,
- includes one short worked example prompt.
Keep it plain markdown so Claude and Gemini can both use it.
