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

## Round 2 (14 Nov 2026): Sam played it

Sam's words: "It seems interesting but 2 things are off. The visual fidelity is not what I was thinking at all, it's incredibly basic. Maybe using the paper-cutouts engine would be better. The other aspect is that there is not much player agency, there is only one event per day and nothing really to manage or take care of. For example there is one character Ilse that the game says is looking worse, but there's nothing I can do about that."

And, while the work was under way: "make sure there are enough ways to make being evil fun, that was the original part of the game and it needs to feel that way. That means limiting the sensible options and doubling down on the others. I also think in order to set the stakes differently each time there should be a selection or a mini game to decide how you arrived at the bunker and selecting your starting staff - each should have their own pros and cons."

So the three weakest things were his, not mine:

1. **The picture.** The flat SVG silo is replaced by a card model drawn with the three paper engines from build 15 (`engine/`, copied unchanged; `src/ui/diorama.js`): a back board with every room printed on it, card floors, standing props, standee pawns with printed faces, an oak table, one soft window. It is a real pop-up: the whole silo is a stack of parallelograms and folds up out of flat card when the page loads. At rest it adds frames up into soft shadows and stops drawing. Stores show on the model (crates, gold bars, the water in the tank), so do your comforts (water in the tub, a film on the cinema screen), the cameras, and anything waiting for you (a hazard flag on a broken machine, a speech bubble over someone with a request). Drag to look round it. The flat picture is kept as the fall-back where WebGL2 is missing (`?flat=1`).
2. **Nothing to manage.** A day now has four kinds of thing in it:
   - **standing orders** you can change at any time (staff rations, the rota, heating, cameras, curfew; your own table, hot tub and cinema). The bar shows what tonight will take from each store as things stand, in red if it will not last;
   - **your comfort**, which sets how many actions you get (three, two or one), falls every night and is held up by how you live;
   - **actions**, up to three a day and from the start of the day, not one at the end. Thirteen of them. "A quiet word" answers the Ilse problem directly: every change to a person's loyalty is filed under its cause, and when you sit down with them they tell you the biggest one;
   - **things waiting for you**: requests from individual staff (three days to answer) and machinery that breaks, or is broken, and drains a store until you mend it.
3. **Evil was not the fun path.** Now it is the cheap one. Cruel acts (interrogate, make an example, the cell, exile, scapegoat, divide and rule, search the bunks) each give you comfort, and so more actions; listening costs comfort. Infamy slows the fading of fear. Five new event cards exist only to be awful (a statue of you, your birthday, the loyalty oath, a reward for informers, the lottery). What it costs: frightened people cannot be read, hated-and-terrified people desert, and an empty bunker is a lost one.

And the start: after the card that says how you got the bunker, **the hatch**. Seventeen people, eight places: for each job you choose between two (three for family), each with a stated strength and weakness that the rules honour (skill at the job, starting loyalty, what they bring, what they cost or give you each night, a fixed trait).

Mistakes made and fixed in this round:
- **Comfort killed the kind player.** At first 36 to 64% of the careful player's runs ended with you cracking. Decay went from 6 to 5 a night, a quiet word from 3 to 2, and the careful player learned to stop listening when tired.
- **A tyrant could win by emptying the bunker.** With desertion added, the tyrant player won 100% of runs with 0.6 staff left: nobody to feed and nobody to rebel. Now fewer than three staff is an ending ("Nobody left to rule"), a job with nobody in it is done at a quarter strength, not 45%, and desertion is 5% a night, not 10%.
- **Under interrogation people named the interrogation** as their grievance, because it was the freshest. They now say what was wrong before you woke them.
- **A light from behind is wrong for a model with a back.** Build 15's key light is behind the subject. Here the back board would block it, so the window is in front, to the left and low (22 degrees), so that each ceiling's shadow covers only the top half of its room's back wall.

Balance at the end of the round (`demo/balance.html`, 120 runs each, 40 for the seer; who you let in is random in every run). Share of runs that end with you surviving as king:

| Card | Careless | Careful | Tyrant | Sees the hidden numbers |
|---|---|---|---|---|
| Inherited it | 4% | 53% | 28% | 93% |
| Bought your way in | 8% | 60% | 57% | 95% |
| Took it by force | 2% | 13% | 32% | 93% |
| Promised them a vote | 3% | 70% | 28% | 98% |
| Founder of the bunker | 0% | 11% | 23% | 100% |

The tyrant made of code loses mostly by driving everyone out (42 to 77% of its runs end "Nobody left to rule"): it is a blunt tyrant. It beats the careful player on the two hardest cards.

Checked: a whole 30-day run clicked through the real buttons at 375 px with every new thing used (policies 7 times, 34 cruel acts, requests granted and refused, faults patched, repaired and inspected): no errors. The hatch, the day, the standing orders sheet and an ending read at 375 px; the day read at 1200 px. Frame cost of the card model on this PC (Intel UHD 615), frames drawn back to back and ended with a 1 x 1 `readPixels`: 9.6 ms at 794 x 595 on phone settings, 24.6 ms at 1700 x 1275 on desktop settings (the moving picture is now capped at about a million pixels, so less than that); a finished still of 72 frames in 0.8 s at 1700 x 1275.

## Not done, not checked

- Still not played by a person from start to finish since round 2. The balance numbers come from players made of code, and the tyrant player is crude.
- Sound has not been heard (this PC cannot play it back to me). The levels copy build 15, which Sam approved. No new sounds were added for the new actions beyond the stamp.
- Not opened on a real phone. The card model has only been drawn by this PC's Intel chip.
- The two paper checks from the fold card (paper rules, card through card) were not written for this model. The fold is solved in closed form (every piece is at height x the board's direction plus depth x forward), so pieces cannot change shape, but pieces that would collide in card (the pawns, the props near the folded-flat pose) are simply hidden until the model stands.
- The flat picture (the fall-back) does not show requests or faults on it; they are still on the desk.
- Left out of the outline on purpose: bugged rooms and the planted spy, air as its own resource, factions with names.
- The hooks for the full game: a starting card is plain data (`src/data/cards.js`) and so is who came in at the hatch (`picks` in `newRun`), so Act 1 could deal both.
