# Bunker Billionaire: techniques

Build 16 (Claude Fable 5.2, 13 Nov 2026). A game, so the techniques here are game rules and how they were tuned, not rendering. Three parts kept apart: rules (`src/engine/`), content (`src/data/`), screen (`src/ui/`). The rules never touch the page; the screen never changes the rules' numbers.

## 1. A seeded, serialisable rules engine (`src/engine/sim.js`)

**What it does.** Holds the whole game in one plain object (`st`) and moves it through the day: report → event → order → night. Every function takes `st` and changes it. All randomness comes from a small generator (mulberry32) whose state is a number inside `st`.

**Why.** Three things fall out for free: a save is `JSON.stringify(st)`; a run can be replayed from `?seed=`; and players made of code can play thousands of runs with no page (see 4). The alternative, rules mixed into click handlers, cannot be tested or balanced.

**Key parameters.** Every tuning number is in `RULES` at the top of the file with a comment. The ones that matter most:

| Constant | Value | What it changes |
|---|---|---|
| `LOYALTY_STEPS` | 58, 48, 40, 33, 27, 21 | Loyalty below each puts a person one step higher on the threat ladder. 58 is the line between a calm bunker and one that slowly sours. |
| `FEAR_CAPS` | 80, 66, 52, 40, 26 | Fear at or above each caps how far up the ladder they dare go. |
| `WANT_MET` / `WANT_UNMET` | +0.3 / −1.2 a night | Loyalty drift from whether the person's want is met. Wants are tied to the stores, so empty stores are disloyal staff. |
| `CABIN` | 0.035 × day, a night | Slow wear on everyone. Without it a high-loyalty start never came under pressure. |
| `FEAR_DECAY` | 6% of the gap a night | Halved while the head of security does the job, tripled-and-a-half without. |
| `P_SABOTAGE`, `P_THEFT`, `P_ATTEMPT` | 0.16, 0.2, 0.3 a night | How often a person at that step acts. |
| `CRIT_NIGHTS` | 3 | Nights at zero food, water or power before everyone dies. |

**Mistakes fixed.**
- Sabotage at 0.3 a night with eight unhappy staff drained 12 units a night; nearly every loss was starvation. Halved.
- Two nights at zero killed everyone. Death by an empty larder then crowded out every political ending. Now an empty store deals an emergency card (see 3) and death takes three nights.
- With no slow wear on loyalty, "Bought your way in" and "Promised them a vote" ended at 65–70 loyalty with nobody above step 1: no game. `CABIN` and the harsher `WANT_UNMET` fixed it.

## 2. Hidden state shown through unreliable signs

**What it does.** The player never sees loyalty, fear, the ladder step or unrest. They see:
- **a face** per person each morning: loyalty with ±7 of noise, in five moods. At fear 66 or more the face is a fixed grin whatever the loyalty, so ruling by fear blinds you;
- **two rumours** a morning (`RUMOURS` in `data/text.js`, one list per ladder step). A rumour is true 66% of the time, more with a loyal assistant, less with a disloyal one. A wrong rumour about a dangerous person says they are fine; a wrong one about a harmless person may be a false alarm;
- **an informant** on one person (84% true, a plain sentence), **cameras** (true positions day and night, and who was near anything that broke), **a loyalty test** (exact, once, and it offends the loyal);
- **the mood of the corridors** (unrest in five bands) and, on the picture, where people stand.

After the run ends, "What you never saw" draws each person's real loyalty and fear day by day.

**Why.** The design outline says the reaction is "mostly hidden", and that informants "can also lie". Each sign has a different error so that no single one can be trusted, and each tool that sharpens the view has a cost.

**Gotcha.** Text built from state must not use the random generator when it is drawn, or a reload changes it. Anything random a card needs is picked once in the card's `setup` and stored with the event.

## 3. The event deck (`src/data/events.js`)

**What it does.** 38 cards. A card has open costs (`c`, shown on the button as chips) and a hidden part (`r`, which changes loyalty and fear and returns the words the player reads). Cards are drawn by weight from those whose conditions hold and that have not been seen (a few may repeat after 9 days). Some are never drawn: they are queued by the rules (a promise falling due, a reminder, ballot day, mutiny, an empty store).

**The ambiguous card** (`ambiguous()` in the file) is the pattern worth reusing. One card, three answers: trust, test by proxy, decline. If the sender is loyal, trusting pleases them and the other two insult them. If the sender has reached the top of the ladder it is an attempt on your life: trusting is fatal 72% of the time, the proxy exposes them (and may cost the proxy), declining leaves them free to try again. The same five cards are in the ordinary deck, so seeing one tells you nothing.

**Tags on loyalty changes** carry the traits: `'gift'` (greedy ×1.7, proud ×0.6), `'punish'` (proud ×1.7), `'promise'` and `'ideal'` (true believer ×1.6). A gossip who is wronged alone passes 30% of it to everyone.

(Sections 1 to 6 describe round 1. The rules changed a good deal in round 2: one order a day became up to three actions, and the numbers quoted in section 4 are superseded by the table in ROUNDS.md, round 2.)

## 4. Balancing with players made of code (`src/engine/auto.js`, `demo/balance.html`)

**What it does.** Three policies play whole runs: `random` (careless), `careful` (uses only what a person can see: faces, rumours, notes, the stores) and `seer` (reads the hidden numbers and tries each choice on a copy of the state). `simulate(n, policy, card)` counts endings. 120 runs of all five cards for one policy take about a second.

**Why.** It gives three numbers to steer by: the careless player should nearly always lose, the careful one should win about half the time on a fair card, and the seer should nearly always win (otherwise the game is not winnable even with perfect play).

**Result at the end of round 1** (150 runs each; 50 for the seer). Careful player survives as king: Inherited 44%, Bought 69%, Force 10%, Vote 78%, Founder 23%. Careless player: 1–3% on every card. Seer: 90% on Force, 100% on the other four. How the careful player loses on a fair card (Inherited): deposed 53%, everyone dies 3%, killed 0% (it never trusts a suspect).

**Limits.** The careful player is a guess at a person. It keeps every promise and spends luxury freely, so it over-reports "kept your word" and under-reports deaths by trusting the wrong card. Real play-testing is still needed.

## 5. The flat silo picture, now the fall-back (`src/ui/silo.js`, `src/ui/faces.js`)

**What it does.** One SVG drawn once (about 9 KB of markup), with the staff as HTML buttons laid over it and moved by CSS transitions. Readings on the picture follow the stores: water in the tank, crates in the stores, bottles in your rack, crop height, the generator lamp. Night is two dark rectangles and a sky swap. Faces are 32 × 36 SVGs: one head, a hat per job, a mouth and brows per mood.

**Why not the WebGL paper renderer from build 15.** A turn is a minute of reading on a phone. Flat SVG loads at once, costs nothing at rest and scales to any screen. The paper look is kept with drop shadows, grain and flat colour.

**Cost.** No frame loop. Ambient motion is CSS animation on a handful of elements. Not measured on a real phone.

## 6. Sound (`src/ui/sound.js`)

The recipe Sam approved on build 15: silent at rest, short shaped bursts of noise for paper and stamps, a three-partial bell for anything pitched (morning, night, a promise, an alarm, the ending). Off until "Enable sound" is clicked. Not heard on this PC; levels copy the approved build.

## 7. Standing orders, comfort and the nightly forecast (round 2)

**What it does.** Seven dials (`RULES.POLICY`, worded in `data/matters.js`) change what each night takes from the stores, what the staff think, and what happens to your comfort. `nightly(st)` is the one place that works out a night's consumption; `endDay` applies it and `forecast(st)` shows it, so the number under each store in the bar is exactly what tonight will take.

**Why.** It gives the player something to run every day, and it makes the outline's central sentence literal: "every resource you spend on luxury is taken from survival". Comfort ties the two halves of the game together: your luxuries buy actions (`RULES.ACTIONS`: 3 at 60 or more, 2 at 30, else 1).

**Key numbers.** `COMFORT_DECAY` 5 a night; table 0 / +2.5 / +5; tub +3; cinema +3; curfew +1.5. With everything on, the stores do not last 30 days: water goes first, after two to two and a half weeks depending on who runs the plant.

**Gotcha.** The forecast uses how well each job is really being done, so a slacker shows in the bar before they show in a rumour. Left in on purpose: it is a sign for a player who watches the numbers.

## 8. A ledger of reasons, so people can tell you what is wrong (round 2)

**What it does.** Every change to a person's loyalty goes through `move(p, d, key)`, which adds it to `p.why[key]`. Keys are causes: `want`, `cameras`, `rations`, `ev:<event title>`, `or:<action>`, `ask:no` and so on. Each night every entry fades by 20%. "A quiet word" reads out the most negative entry (and the most positive) in a sentence from `WHY_BAD` / `WHY_GOOD`. Frightened people say nothing true; people at the top two steps of the ladder say something small and false. An interrogation reads the same ledger and the ladder step, truthfully, from anyone.

**Why.** Sam: "Ilse is looking worse, but there's nothing I can do about that." A hidden number is only fun if there is a way to find out why it moved and a lever that answers it.

## 9. Cruelty that pays (round 2)

`RULES.CRUEL` (comfort gained) and `RULES.INFAMY` per cruel action; `INFAMY_FEAR` slows the fading of fear by 6% a point; a quiet word costs comfort. The counterweights are all in `endDay`: faces go blank at fear 66, people with loyalty under 14 and fear over 60 desert (5% a night), and fewer than three staff ends the run.

## 10. The card silo (`src/ui/diorama.js`, `engine/`) (round 2)

**What it does.** Draws the silo as a card model with build 15's engines, copied unchanged: `fold.js` (frames and packing), `cardmesh.js` and `atlas.js` (181 parts, 10,400 triangles, 85 prints in one 2048 atlas), `paperlight.js` (light, moving mode and still mode).

**How the fold is solved.** The model is one hinge and a stack of parallelograms, so no linkage solver is needed: with the back board's direction `w = (0, sin t, cos t)` and forward `f = (0, 0, 1)`, a standing piece is at `x + h*w + d*f` with axes `(X, w)`, a floor at the same point with axes `(X, -f)`, a cross wall with axes `(f, w)`. `place()` is the whole of it.

**Things worth reusing.**
- **One card per state, and collapse the rest.** A pawn has seven moods; each is its own printed card on its own frame, and all but one have their frame's axes set to zero (and moved far away), so they draw as nothing. No texture is ever uploaded twice. The same trick shows and hides crates, gold bars, flags, cameras and graves.
- **Reusing 2D art in a print.** `drawSVG()` (40 lines) paints the face drawings from `ui/faces.js` into the atlas, so the desk and the model show the same faces.
- **Tap targets over a 3D canvas.** `placeHits()` projects each pawn and flag with `renderer.viewProjOf()` and lays an invisible button over it, so taps, keyboard focus and screen readers reach them.
- **Life without losing the still.** A frame loop that never rests never gets the soft still. So motion comes in beats (a lift moves, a pawn shifts, every nine seconds), and the loop stops when the still is finished.

**Cost** (Intel UHD 615, frames drawn back to back, ended with a 1 x 1 `readPixels`): 9.6 ms at 794 x 595 (low settings); 24.6 ms at 1700 x 1275 (high), which is why the moving picture is capped at a million pixels (`MOVING_PIXELS`); 72-frame still in 0.8 s.

**Mistakes fixed.** The first camera cut the top of the board and the front of the base (distance is now `max(99, 122 / aspect)`). The first hot-tub water had its steam in the same blue card (steam is now two cream pieces). A key light from behind, as in build 15, would have been blocked by the back board (see ROUNDS.md, round 2).

**Round 3 additions.**
- **A figure from a face drawing.** The body and head are one outline (`BODY`: a trapezoid with an arc of the head circle); the face drawing from `ui/faces.js` is printed on the head with the transform `translate(-16 * SV, HEAD_Y + 23 * SV); scale(SV, -SV)`, where `SV` is the head radius in cm over 11.2 (the head radius in the drawing). The hat is a separate part on the same frame, 0.03 to 0.075 cm in front, cut to a polygon traced from the hat drawing (`HAT_PTS`, in drawing units, mapped by `sv()`), and printed with the hat drawing alone (`faceMarkup(role, mood, false)` leaves the hat off the face). Any of the outline that the drawing misses is filled with the hat's main colour, so the trace need not be exact.
- **A scene change on a card model with no emission.** Card cannot glow and the renderer has one key light, so "night" is a second sky card and a moon that are shown while the light is at its dimmest (`dusk.v > 0.5`), with the key light moved and cooled. The swap is not seen because it happens in the dark.
- **Lettering that waits for its typeface.** The atlas is drawn as soon as the model is made; once `document.fonts.load()` for the page's face resolves, it is drawn again with the same sizes (so the same places) and handed to the renderer, which then starts its still again.
- Cost at the end of round 3: 233 parts, 16,800 triangles, 30 px a cm in one 2048 atlas; 10.2 ms a moving frame at 794 x 595 (low), 20.3 ms at 1500 x 1125 (high).

## 11. The slope: creeping normality as a rule (round 4)

**What it does.** Harsh measures sit on rungs (`RUNGS` in `data/matters.js`; `rung` on each action in `ACTION_DEFS`). `st.regime` is how many rungs are open. Using the lowest open rung sets `st.rungUsed[r]`; at the end of the night, if the lowest open rung was used, `regime` goes up by one and the morning report says so in words from the rung (`used`, `opens`). Three numbers change with `regime`: `relish(st, id)` (comfort a measure gives you, +15% a rung), `shock(st, id)` (how much a measure upsets bystanders: 18% less for each rung it sits above the deepest one open, down to 45%), and `kindness(st)` (what perks, quiet words, speeches and promises are worth, 12% less a rung, down to 40%).

**Why.** The review found cruelty was a menu of efficient buttons, not a temptation (principles 4.3 and 3.1; Frostpunk's Book of Laws: "every law should be a little bit more than the previous one"). The slope makes each step only a little worse than the last, makes it feel normal the next morning, makes the next step pay better, and makes the way back dearer.

**What to watch.** The slope must never stop a player dealing with someone caught trying to kill them: `mayUse()` lets a locked exile or cell through for an exposed person. A curfew is a standing order but belongs on rung 3, so `policyBlock()` refuses it before then. The screen shows the slope as a staircase, with the next step's condition written under it.

**Friends.** Four pairs at the start (`p.friend`). Harm to one is filed in the other's ledger as `friend:<role>`, so a quiet word can name it. Divide and rule ends a pair.

**Measuring a day.** `playDay()` counts what a day puts in front of the player when `st.load` is set: words in the report, the event, waiting things and results, and decisions made. The bench reports words, decisions and things waiting a day. It is a stand-in for timing a day on a phone, not a replacement.

## URL controls

`?card=` start at once · `?crew=` eight digits, who came in at the hatch · `?seed=` the same run · `?day=N` play to day N with the careful player (`?as=tyrant` for the other one) · `?view=day|done|night` step into the day · `?end=<ending id>` show an ending · `?still=1` no ambient motion · `?flat=1` the flat picture instead of the card model.
