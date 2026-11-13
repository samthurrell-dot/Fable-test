# Bunker Billionaire: rounds

Build 16. Claude Fable 5.2, default effort, 13 Nov 2026. A game prototype from Sam's design outline ("Bunker Billionaire: Act 2"), not one of the Maker Skool prompts. Sam's steer part way through: the game design is the primary driver; the harvested paper engines are optional.

## Round 0: v1

What is in it:
- The whole daily loop from the outline: morning report, today's event, your choice, one order, lights out, night.
- Hidden loyalty and fear per person, hidden unrest for the bunker, and the seven-step threat ladder (grumbling to mutiny). Staff act only when loyalty is low and fear is low enough to dare.
- 8 named staff, 5 resources (air is folded into power), 8 tools, 5 promises you can make and 3 you can inherit, all 5 starting cards, 37 event cards, a 30-day run, 16 ending cards.
- The silo as a cut-paper cross-section you can tap. This answers the outline's open question "picture or cards?" with both: the picture is the staff list.
- Sound made in code, a save in the browser, URL controls, and a balance bench (`demo/balance.html`).

Decisions made while building:
- **Not the paper engines.** The first plan was a card silo that pops up, using the three engines harvested from build 15. Sam said the game should lead. A turn takes a minute on a phone and most of it is reading, so the picture is flat SVG with CSS movement: it loads at once, costs no battery at rest and leaves the time for the rules and the writing.
- **Fear hides faces.** A frightened person shows a fixed grin whatever they think. So ruling by fear makes your one source of information worse. This came out of asking what "you never see the real numbers" should cost a tyrant.
- **The same card can be harmless or deadly.** "The chef's special", "a quick inspection of the airlock", "a vitamin shot", "master keys" and "a note under your door" are drawn from the deck when the sender is loyal, and are also what an attempt on your life looks like. The player has only the signs to go on.
- **An empty store is a political problem before it is a fatal one.** First rules: two nights at zero and everyone died. In the bench, starving was most of all deaths, which is not the game in the outline. Now an empty larder, tank or generator deals an emergency card with three painful ways out (your luxury, another store, or the staff's loyalty), and everyone dies only after three nights at zero.

Balance, from `demo/balance.html` (120 runs each; "careful" is a player made of code that sees only what a person sees):

| Card | Careless player wins | Careful player wins | Player who can see the hidden numbers wins |
|---|---|---|---|
| Inherited it | 3% | 49% | 100% |
| Bought your way in | 3% | 72% | 100% |
| Took it by force | 1% | 6% | 83% |
| Promised them a vote | 0% | 93% | 100% |
| Founder of the bunker | 1% | 23% | 98% |

Measured before the last small changes to the vote card and the "kept your word" ending; run again in round 1.
