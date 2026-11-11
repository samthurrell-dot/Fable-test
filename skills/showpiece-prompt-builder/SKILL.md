---
name: showpiece-prompt-builder
description: Write or improve a long-run "showpiece" build prompt (interactive 3D scene, game, code-made film, landing page or science explainer in the browser) in the Maker Skool / Fable 5.2 style, and pick which model should run it.
---

# Showpiece prompt builder

Use this when Sam wants to:
- write a new build prompt for a high-finish browser piece (three.js / WebGL2 / Canvas, sometimes Blender),
- improve the prompt behind one of his existing projects so a model can push its quality up,
- adapt one of the 15 Maker Skool "Fable 5.2 build prompts" to a new subject,
- decide whether a build is worth Fable 5.2 time or should run on Opus 5.5 (or another model).

This skill is written to work for any model that reads skills (Claude, Gemini). It names no tools that only one product has.

---

## 1. How the prompts are built

Every Maker Skool prompt has the same five blocks, in this order. Only block 2 changes much between builds.

| # | Block | What it does | Changes per build? |
|---|---|---|---|
| 1 | **Stakes line** | "I will open your build on screen and show it to an audience for 20 to 60 seconds. Quality is the goal. Take the time that quality needs." Tells the model what "done" means and gives it permission to spend time. | No |
| 2 | **Your build** | The creative brief. See section 2. | Yes – this is the work |
| 3 | **Tools and files** | Entry file `index.html`, assets in a subfolder, local copy of three.js (no CDN), Poly Haven CC0 allowed, subject geometry made in code, check in a headless browser on a real GPU and *read every screenshot*. | Rarely |
| 4 | **Hard rules** | Alive on load, reacts in the first second, fills the window, 60 fps target with DPR cap 2 and dynamic resolution, minimal HUD, sound muted until clicked and made in code, `?t=` and `?view=` URL controls, original work only, real copy and only sure facts. | Rarely |
| 5 | **Process** | Build a full v1 → at least N improvement rounds (screenshots of 3+ moments, judge "as a harsh art director", name the 3 weakest things, fix, re-check) → frame-rate gate (under 50 fps means speed up before adding) → stop rule (no visible gain, or time cap) → final reply of five lines or fewer. | Only N and the time cap |

Why it works:
- **Block 1 + block 5 together** stop the model from handing back a first draft. The improvement rounds are where the quality comes from.
- **The `?t=` and `?view=` controls** let the model freeze exact moments and screenshot them. Without them it cannot inspect its own work.
- **"Read every screenshot"** forces the model to actually look, not just take pictures.
- **The frame-rate gate** stops the model piling on effects that kill performance.
- **The five-line final reply** stops a long self-congratulating summary and gives the user exactly what they need to demo it.

The reusable text for blocks 1, 3, 4 and 5 is in `templates/fixed-blocks.md`. Copy it, don't retype it.

---

## 2. Writing the "Your build" block

Write it in this order. Each part is one short paragraph. Use plain, concrete words.

1. **Style guard (only for "physical medium" builds).** Use the standard paragraph from `templates/build-block-parts.md`: one physical medium, obey its rules in every pixel, no low-poly / voxels / pixel art / neon / glass UI / cel shading / default three.js materials, and *decide the rules of the medium before writing code* (edges, how colour is laid down, the surface, the flaws, how it moves). This is the single strongest line in the set. The builds without a medium (fox knight, whale) came out the most generic.
2. **Mode contract.** One paragraph that says what kind of thing it is. Pick one from `templates/build-block-parts.md`: *game*, *made object that comes alive*, *film in the browser*, *website*, *scene*, *science explainer*.
3. **Medium line.** "Your medium: X, in a Y photograph." The photograph framing (macro photo on a kitchen table, museum catalogue photo, craft-magazine photo) gives the model a real-world target for light and lens.
4. **Subject and mechanics.** Name real parts and real mechanisms, not adjectives. Good: "cams of different shapes (eccentric, snail, heart), followers, levers, a pin wheel, a ratchet". Weak: "an intricate mechanism". Say what must be *solved* (fracture, fold kinematics, cam followers, rigid bodies) rather than faked.
5. **Inputs and idle.** List every input (drag, click, key, scroll) and what each does. Say what happens with no input (attract mode, "an unseen hand turns the crank with an uneven, human rhythm"). Add one or two hidden rewards (secrets at exact values, an engineer's view key, an exploded view).
6. **Look.** 5–8 specific surface details and flaws ("printed art a little off register", "bare metal at scratched edges", "pencil lines left on parts"). Flaws are what make it look real.
7. **Light.** Say how light is made: baked in Blender, HDRI, progressive path tracer, analytic caustics. Say what must be live.
8. **Job rules (if Blender or long renders).** "Test at small size and few samples first. Check every baked file after a job. Keep each job under 10 minutes."
9. **Bar.** One sentence that compares the result to a real artefact a viewer would recognise: "a frozen frame passes for a photograph in a toy collector's book, at 60 fps". The bar is what the art-director rounds judge against.

For a short request-style build (lightbulb, Pale, studio), you can open with **"The request: '…'"** quoting the casual ask, then expand it. This keeps the spirit of the ask while adding the detail.

---

## 3. Sizing the run

Use the Maker Skool runs as a guide (all on Fable 5.2, high effort):

| Build type | Rounds | Time cap |
|---|---|---|
| Single focused piece, no extras (embroidery, virus, Pale, fox knight) | 3–4 | 45 min |
| Detailed procedural scene (tree, mammoth, thermostat) | 4 | 55–60 min |
| Hard physics or rendering (kintsugi, lightbulb, pop-up book) | 4–5 | 70–90 min |
| Blender pipeline + web (derby, clay, automaton, studio) | 4–5 | 90–110 min |

These runs use a large share of a usage allowance. If allowance is tight: lower the time cap first, keep at least 3 rounds.

---

## 4. Which model runs it

Decide per build, not per project.

**Use the strongest model (e.g. Fable 5.2) when the build needs:**
- maths that has to be right for it to look right: path tracing, refraction, fracture, fold or cam kinematics, physics solvers;
- a procedural engine you want to reuse later (tree growth, paper folds, glass shading);
- many rounds of self-critique on a demanding look.

**Use Opus 5.5 (or another capable model) when the build is mostly:**
- layout, copy, interaction design, game feel or a 2D/LCD/Canvas look;
- a re-skin of an engine that already exists (see the `build-harvest` skill: harvest the engine from a Fable run first, then give it to Opus);
- a quick variant or a port to a new subject.

**Watch-outs:**
- Fable 5.2 has extra safety measures for biology and cybersecurity. A biology build (for example the virus) may be refused or cut short. Uncertain – test cheaply or run it on Opus.
- Blender builds need an agent that can run programs on a computer with Blender installed (and ideally a GPU). They will not work from a phone chat.
- The prompts were written for a 1920×1080 desktop screen. Heavy shaders (path tracer, 99K fur strands) may run badly on a phone.

---

## 5. House overrides for Sam

Add this block after "Hard rules" when the build is for Sam (edit as needed):

```
## House rules (Sam)
- UK English, plain words.
- Phone first as well as desktop: also check at 390 px wide in portrait. On phones, lower the internal resolution and effect counts so it stays smooth. Touch must work for every input (drag, tap, pinch); no hover-only controls.
- If the page takes photos: show "open in Chrome if the buttons do nothing".
- Host target: GitHub Pages (static). No server unless asked; if one is needed, Netlify Functions v2 + Netlify Blobs.
- Do not push to a Netlify-connected main branch during improvement rounds. Push once at the end.
- If the build is part of the Wada colour work: use the Wada Colour System (warm paper, near-black ink, Dark Tyrian Blue actions, Carmine Red sparingly; Shippori Mincho / Zen Kaku Gothic New / IBM Plex Mono; flat colour, near-square corners; light and dark mode). Say on the page that Wada hex values are approximate.
```

And add the **harvest clause** from `templates/fixed-blocks.md` whenever the code should become reusable knowledge.

For long runs that may hit a usage limit, add a **checkpoints block**: commit and push after v1 and every round, keep `ROUNDS.md`, update `STATUS.md`, never leave `main` broken (use a `wip/<build>` branch). The ready prompts in `samthurrell-dot/Fable-test/prompts/ready/` show the exact wording.

Templates live in `samthurrell-dot/Fable-test` under `skills/showpiece-prompt-builder/templates/`. If they are not to hand, copy blocks 1, 3, 4 and 5 from any prompt in `reference/maker-skool-prompts/prompts/` in that repo.

---

## 6. Steps

1. Ask (or decide from context): subject, mode, medium, what must be solved, inputs, the bar, where it will be hosted, which model.
2. Copy `templates/fixed-blocks.md`. Write the "Your build" block with section 2.
3. Set rounds and time cap from section 3.
4. Add house overrides and, if wanted, the harvest clause.
5. Check against the list below. Hand back the prompt as a `.txt` file the user can paste.

### Checklist before handing over
- [ ] A medium is named, with the style guard (or a clear reason why not).
- [ ] Mechanics are named nouns, and the hard part is marked as "solve", not "fake".
- [ ] Every input and the idle behaviour are listed.
- [ ] At least 5 concrete surface details, including flaws.
- [ ] Light method stated.
- [ ] A one-sentence bar compared to a real artefact.
- [ ] `?t=` / `?view=` controls kept.
- [ ] Rounds and time cap set.
- [ ] Phone check and host target set (for Sam).
- [ ] Nothing copies a named existing game, film, brand or character.

## 7. Improving an existing project with this skill

For an existing repo, write a shorter prompt: keep blocks 1, 3 (adjusted to "work in this repo"), 4 and 5, and replace block 2 with:
- "What exists" (two lines),
- "What must get better" (the 3 weakest things, named after looking at screenshots),
- the medium rules and the bar.
Tell the model not to break saved data or live URLs, and to test before pushing.
