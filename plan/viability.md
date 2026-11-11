# Which builds to run, and on which model

Written 11 Nov 2026 by Opus 5.5 after reading all 15 prompts and watching the results video (frames sampled every 6 seconds; the narration was not transcribed).

## The short version

**Fable 5.2 (limited access – spend it on hard maths you want to keep):**
1. **06 Glass lightbulb** – a path tracer with real glass. Hardest rendering in the set; the engine is reusable for any glass (cocktail glasses for the home bar, bottles, Pale-style pages).
2. **15 Pop-up book** – solved paper-fold kinematics. Reusable for story pieces (Echoes, a book for Eva, Wada pages that fold up).
3. **13 Tree through the seasons** – a procedural tree grower with seasons. Reusable for the garden, the plant database, game backgrounds (Undergrowth, Chivereen map).
4. *Reserve:* **03 Kintsugi** – fracture and rigid-body physics. Very good result in the video; reusable "break things" engine.

**Opus 5.5 (cheaper, mostly design and feel):**
- **04 Thermostat** – LCD segment art; lots of drawing, little hard maths. Phone-friendly (a dial).
- **11 Embroidery** – stitch shader and a deterministic timeline; links to the doll and craft work.
- **09 Pale landing page** – mostly layout and copy; reuse the Fable glass engine for the bottle once harvested.
- **10 Fox knight** – a game slice; better adapted to the bug RPG (Undergrowth) than built as-is.
- **14 Virus builds itself** – science explainer. Run on Opus: Fable 5.2 has extra safety measures for biology, so it may refuse or stop. (Not tested – this is a guess.)

**Skip for now:** 01 Wind-up derby, 02 Clay film, 05 Studio, 07 Automaton, 08 Whale. All need Blender running on a computer the agent controls. 08 Whale was also the weakest result in the video (mostly washed-out sun and spray; the whale is hard to make out). 07 Automaton is the one worth coming back to if you set up Blender – the cam mechanism is excellent.

**12 Mammoth** sits in between: a superb result, but 99K fur strands is heavy on a phone, and you have less obvious reuse for fur. Fable if you have spare access after the top three.

## How I scored them

| # | Build | Blender? | Run (rounds / mins) | How much the strongest model matters | Reuse for your projects | Phone | Verdict |
|---|---|---|---|---|---|---|---|
| 01 | Wind-up derby | Yes | 4 / 90 | High (physics + bakes) | Medium (game physics) | Medium | Skip (Blender) |
| 02 | Clay film | Yes + ffmpeg | 4 / 100 | High | Low | Video plays fine | Skip (Blender) |
| 03 | Kintsugi | No | 5 / 90 | High (fracture) | Medium | Medium | Fable reserve |
| 04 | Thermostat | No | 4 / 60 | Low–medium | Medium (LCD look, secrets) | Good | Opus |
| 05 | Studio portfolio | Yes | 5 / 110 | Medium | Low (personal to Nick) | Poor | Skip |
| 06 | Glass lightbulb | Optional | 5 / 80 | Very high (path tracer) | High (any glass) | Poor live, fine as stills | **Fable 1st** |
| 07 | Automaton | Yes | 5 / 100 | High (cam kinematics) | Medium | Medium | Later, if Blender |
| 08 | Whale breach | Yes + ffmpeg | 3 / 70 | Medium | Low | Video fine | Skip (weakest result) |
| 09 | Pale landing page | No | 4 / 45 | Medium (glass shader) | High (Greenthread, sites) | Good if tuned | Opus (+ Fable glass) |
| 10 | Fox knight | No | 3 / 45 | Low–medium | High (bug RPG) | Medium | Opus, adapted |
| 11 | Embroidery | No | 3 / 45 | Medium | Medium (crafts, Wada) | Good | Opus |
| 12 | Mammoth | No | 4 / 55 | High (fur, anatomy) | Low–medium | Poor | Fable if spare |
| 13 | Tree seasons | No | 4 / 55 | High (procedural growth) | Very high (garden, games, maps) | Medium | **Fable 3rd** |
| 14 | Virus | No | 3 / 45 | Medium | Medium (science comms) | Good (one file, no library) | Opus (bio safeguards) |
| 15 | Pop-up book | No | 4 / 70 | High (fold kinematics) | High (stories, Echoes, Eva) | Medium | **Fable 2nd** |

"How much the strongest model matters" = how much of the result depends on maths that must be exactly right, plus how many self-critique rounds it needs.

## The loop: Fable builds the engine, Opus reuses it

| Fable build | Engine to harvest | Opus follow-up idea |
|---|---|---|
| 06 Lightbulb | Glass path tracer + denoiser | A cocktail from your Notion bar rendered in its proper glass |
| 15 Pop-up book | Fold kinematics + paper shader | A pop-up spread for an Echoes chapter, or a story for Eva |
| 13 Tree | Tree grower + seasonal leaves | Your garden through the year, linked to the plant database |
| 03 Kintsugi | Fracture + rigid bodies | A "break and mend" Wada colour piece |

For each: run the Fable build → use `skills/build-harvest` to lift the engine and write its card → give Opus the card plus a short new brief.

## Things I am not sure about
- How far your Fable access stretches. Nick's runs were 45–110 minutes each at high effort and he says they use a large share of a limit. Start with one build, and use a lower time cap if needed.
- The prompts say to check work "in a headless browser on the real GPU". A cloud session has no real GPU, so frame-rate numbers there will be pessimistic and some shaders may not render. Running in Claude Code on your own PC gives truer checks.
- Results vary run to run (Nick says so too).
- The original prompts are Nick Saraev's, shared free via Maker Skool. Fine for your own use; if this repo is public, consider making it private or removing `reference/`.
