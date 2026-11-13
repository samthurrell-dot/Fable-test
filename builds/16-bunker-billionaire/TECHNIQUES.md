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

## 4. Balancing with players made of code (`src/engine/auto.js`, `demo/balance.html`)

**What it does.** Three policies play whole runs: `random` (careless), `careful` (uses only what a person can see: faces, rumours, notes, the stores) and `seer` (reads the hidden numbers and tries each choice on a copy of the state). `simulate(n, policy, card)` counts endings. 120 runs of all five cards for one policy take about a second.

**Why.** It gives three numbers to steer by: the careless player should nearly always lose, the careful one should win about half the time on a fair card, and the seer should nearly always win (otherwise the game is not winnable even with perfect play).

**Result at the end of round 1** (150 runs each; 50 for the seer). Careful player survives as king: Inherited 44%, Bought 69%, Force 10%, Vote 78%, Founder 23%. Careless player: 1–3% on every card. Seer: 90% on Force, 100% on the other four. How the careful player loses on a fair card (Inherited): deposed 53%, everyone dies 3%, killed 0% (it never trusts a suspect).

**Limits.** The careful player is a guess at a person. It keeps every promise and spends luxury freely, so it over-reports "kept your word" and under-reports deaths by trusting the wrong card. Real play-testing is still needed.

## 5. The silo picture (`src/ui/silo.js`, `src/ui/faces.js`)

**What it does.** One SVG drawn once (about 9 KB of markup), with the staff as HTML buttons laid over it and moved by CSS transitions. Readings on the picture follow the stores: water in the tank, crates in the stores, bottles in your rack, crop height, the generator lamp. Night is two dark rectangles and a sky swap. Faces are 32 × 36 SVGs: one head, a hat per job, a mouth and brows per mood.

**Why not the WebGL paper renderer from build 15.** A turn is a minute of reading on a phone. Flat SVG loads at once, costs nothing at rest and scales to any screen. The paper look is kept with drop shadows, grain and flat colour.

**Cost.** No frame loop. Ambient motion is CSS animation on a handful of elements. Not measured on a real phone.

## 6. Sound (`src/ui/sound.js`)

The recipe Sam approved on build 15: silent at rest, short shaped bursts of noise for paper and stamps, a three-partial bell for anything pitched (morning, night, a promise, an alarm, the ending). Off until "Enable sound" is clicked. Not heard on this PC; levels copy the approved build.

## URL controls

`?card=` start at once · `?seed=` the same run · `?day=N` play to day N with the careful player · `?view=event|order|night` step into the day · `?end=<ending id>` show an ending · `?still=1` no ambient motion.
