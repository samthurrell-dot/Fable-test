---
name: game-design-review
description: Review a game build against its design doc, the game-design-principles skill and three critic lenses (Skill Up, Design Delve, Whitelight), then give a verdict and the three weakest things. Use for "review my game", "how does it match the design", or before an improvement round.
---

# Game design review

Use this when Sam asks how a build is going, whether it matches the design, what to fix next, or before starting an improvement round on any game.

It works for any genre. It reads the **game-design-principles** skill for the principles and critic lenses. For strategy, management, card or survival games, also use **choice-and-systems-design**.

Works with any model that reads skills. Names no product-only tools. UK English, plain words, phone-first output.

---

## Inputs
- The design doc or pitch (whatever Sam wrote down, even a chat message).
- The build: the repo or folder, plus any log of rounds (`ROUNDS.md`, `STATUS.md`, a dev diary).
- Sam's own playtest notes, if there are any. **These outrank everything else.** Quote them.

## Rules
- **Separate what you checked from what you read.** A build log saying "tested" is a claim, not a check. Say which things you ran yourself.
- **Don't say you played it unless you did.** Driving it with a script counts as "clicked through", not "played".
- **Evidence for every finding:** a screenshot, a number, a file and line, or a quote from Sam.
- **Deliberate changes are not failures.** If the build log or Sam explains a change from the doc, file it under "changed on purpose" and judge whether the change worked.

---

## Steps

### 1. Read
- The design doc, section by section. List its promises: each mechanic, number, tone note and open question.
- The build log, for decisions and their reasons.
- The code that runs the rules (often one or two files). Check the log's main claims against the code.

### 2. Run it
- Open it at phone width (390 × 844) and at desktop size. Note any console errors.
- Get through at least one full session or run, using the real buttons where you can.
- If the game has a balance bench or code players, run it yourself and compare the numbers with the log.
- Note what you couldn't check (sound, a real phone, a full human playthrough).

### 3. Check the build against the design doc
Make one table with a row for each promise in the doc:

| Doc says | Build does | Status |
|---|---|---|

Status is one of:
- **Matches**
- **Changed on purpose** (give the reason and who decided)
- **Drifted** (changed with no stated reason)
- **Missing**
- **Added** (in the build but not in the doc)

Then answer the doc's open questions from what the build actually does.

### 4. Principles pass
Go through the test questions in **game-design-principles**, choosing the ones that fit this game's purpose. For each, give a one-line answer with evidence. Pay most attention to:
- the feeling (1.1) and the core concept (1.4): does the build still serve them?
- decisions (2.1 to 2.5)
- optimisation (3.1, 3.2): what's the most efficient play, and is it the fun one?
- complexity (3.3, 3.4): what would you cut?

### 5. Critic passes
Write one short paragraph for each lens in **game-design-principles** (Skill Up, Design Delve, Whitelight), in plain words. Don't copy the critics' voices; use their questions.

### 6. Verdict
- One line: **Recommend as it stands / Recommend after fixes / Not yet**, and why.
- **Three weakest things**, most important first. For each: what's wrong, the evidence, the principle it breaks, and one concrete fix.
- **Three things to protect**: what works and mustn't be lost in the next round.
- **Not checked**: an honest list.

## Output shape
For a quick review, put it all in the chat reply: verdict, a short alignment summary, the three weakest, the three to protect, and what wasn't checked. Keep it to about two phone screens.

For a full review that Sam will keep or share, make it a document with the full alignment table, and send it as a file too.

## After the review
Offer one next step, for example: "Shall I run round N on the top weakness?" If Sam agrees, record the review's three weakest things at the top of the round in the build log, in the same words, so the next round can be checked against them.
