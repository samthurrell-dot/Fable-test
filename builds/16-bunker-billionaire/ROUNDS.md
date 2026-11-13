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

## Round 1

Judged from screenshots at 375 × 812 and 1280 × 800 (morning report, an event, the orders, a staff file, night with the cameras on, two endings) and from one whole run driven through the real buttons.

The three weakest things:
1. **The tools explained nothing on a touch screen.** What each one costs was in a hover tip, and cameras and speeches fired on the first tap. Every tool now opens a small sheet first: "what you get" and "what it costs", in the words of the outline's table, then the choice of person or a "not today".
2. **The eight people were hard to hold in your head.** Names in the text had no faces and the picture had no names. Now every name in every card carries that person's face and opens their file, a "Staff files" button under the silo lists all eight with their last rumour, and the morning report says in one line whose face changed overnight (only what the player could see anyway). A ring pulses round the pawn that today's card is about.
3. **The balance had not been checked since the last rule changes, and the vote card was a walkover.** Bench run again (see TECHNIQUES.md, section 4). The vote card now starts at loyalty 60, not 67, and winning the vote is worth less.

Also fixed: the orders panel fell to one long column at 375 px and pushed "Lights out" off the screen (now two columns and a row); two rumours on one morning could use the same sentence; in the "everyone dies" ending the faces were still alive; the reveal chart was squashed into the first third of its width on short runs; keyboard focus had no outline.

Checked: two whole runs clicked through the real buttons with no errors (founder, seed 11: died in a mutiny on day 12; bought, seed 31: died in a mutiny on day 28, having used speeches, perks, tests and cameras on the way). Layout at 375 px and 1280 px. Two ending pictures (king, everyone dies). The "kept your word" ending never came up in the bench, so it was tested on purpose: a scripted player that makes four different promises, keeps each one and otherwise reads the hidden numbers reaches it 20 times in 20 on "Inherited it" and "Promised them a vote", and never on "Bought your way in", where the weekly wages leave no luxury for anything else.

## Not done, not checked

- Not played by a person from start to finish. The balance numbers come from players made of code.
- Sound has not been heard (this PC cannot play it back to me). The levels copy build 15, which Sam approved.
- Not opened on a real phone.
- Left out of the outline on purpose for a first prototype: bugged rooms and the planted spy (two of the nine tools), air as its own resource, and factions with names. The outline's open questions were answered this way: one day a turn; the silo is a picture and the staff list at once; loyalty is never shown exactly (a test tells you loyal or not, once); the outside world appears as two cards (a voice on the radio, knocking at the hatch).
- The hooks for the full game are in place but unused: a starting card is plain data (`src/data/cards.js`) with its promises and its grudge, so Act 1 could deal one.
