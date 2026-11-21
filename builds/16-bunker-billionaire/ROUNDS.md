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

## Round 3 (14 Nov 2026): polish the model

Sam picked "Polish the model". Run on Claude Opus 5.5 (the earlier rounds were Fable 5.2).

Judged from two full-size stills of the model (day, and night with the cameras on and faults showing), saved from the canvas at 1500 x 1125. The three weakest things:

1. **The pawns read as gravestones.** Every person was the same round-topped arch, which is the exact shape of the graves on the surface. Now each person is a cut figure: a body in the job's clothes (security's navy and badge, the chef's whites and neckerchief, the engineer's hi-vis, the doctor's coat and stethoscope, the farmer's dungarees, the assistant's suit and tie, the cleaner's tabard, family in pink and gold, you in a dinner jacket with a red bow tie) and a head with the face drawing on it. The hat or hair is a separate piece glued over the head, cut to the shape of the drawing, so it stands proud in the light. Each figure stands in a small card stand (yours is red).
2. **Night was not night.** The sky is printed on the back board, so at lights-out it stayed a sunset with the sun in it. Now a second sky card (deep blue, 90 stars, the ruins in silhouette) and a cut moon slot in front while the light is at its dimmest, and the sun is taken away. The moonlight is a little brighter and cooler.
3. **The front looked like a bookshelf.** Plain grey floor edges, no names, and rooms that were mostly empty wall. Now every floor has a dark label strip along its front, as on a museum model ("1 · YOUR SUITE", "THE VAULT", down to "6 · PLANT ROOM", "STORES"); seven rooms have a hanging brass lamp; and there is more in the rooms: a shelf of tins behind the crates, a red valve wheel on a pipe in the plant room, a safe in the vault, a drip stand in the infirmary, blankets on the bunks, a bench, a jug, mugs and a pot in the mess and kitchen, a chair at the security desk.

Also: the camera is closer (distance `max(86, 106 / aspect)`, was `max(99, 122 / aspect)`), so the model fills the box on a phone; and the atlas is printed again once the page's typeface has loaded, so the lettering on the model is in Barlow Condensed rather than whatever font was ready first.

Fixed during the round: the first label lettering was too small to read (0.36 cm, now 0.5 cm); the first lamps hung behind the new label strips (the cord is now 0.5 cm longer).

The model is now 233 parts and 16,800 triangles (was 181 and 10,400); the print atlas is still one 2048 sheet, at 30 px a cm (was 36). Frame cost on this PC (Intel UHD 615, frames drawn back to back, ended with a 1 x 1 `readPixels`): 10.2 ms at 794 x 595 on phone settings (was 9.6), 20.3 ms at 1500 x 1125 on desktop settings. Checked in the game at 375 px: a day, lights out (the night sky swapped in, staff out of sight in their bunks with the cameras off), and the next morning, with no errors. Rules unchanged.

## Review (16 Nov 2026, Opus 5.5, before round 4)

Done with the new `skills/game-design-review` skill, against the design outline and `skills/game-design-principles`. Not a round: no code changed.

Checked by the reviewer: read `src/engine/sim.js` and the data files; re-ran the balance bench in Node (120 runs each, 40 for the seer); loaded the game at 390 x 844 in headless Chromium with no console errors and the card model drawing. Not checked: a person playing start to finish, sound, a real phone. The staff figures did not show in two headless screenshots (title screen and `?day=5` morning); this may be timing or the software renderer, not confirmed.

Bench, share of runs surviving as king (including "kept your word"):

| Card | Careless | Careful | Tyrant | Seer |
|---|---|---|---|---|
| Inherited it | 2% | 45% | 32% | 93% |
| Bought your way in | 6% | 48% | 44% | 95% |
| Took it by force | 9% | 17% | 32% | 85% |
| Promised them a vote | 3% | 77% | 35% | 93% |
| Founder of the bunker | 2% | 10% | 26% | 100% |

The tyrant loses 54 to 72% of its runs to "Nobody left to rule".

Alignment with the outline: close. Every main system is in, often in the outline's words (loop, 5 starting cards with their promises and grudges, 8 roles, 4 traits, hidden loyalty/fear/unrest and the "low loyalty and low enough fear" rule, 7-step ladder, all 5 example promises with keep/break/forget, the endings). Changed on purpose: air folded into power; bugged rooms, planted spy and named factions left out. Added beyond the outline (from Sam's round 2 steers): the hatch, standing orders, comfort and 1 to 3 actions a day, 13 actions (6 cruel), requests, faults, the card model.

The three weakest things (for round 4 to consider):
1. **Cruelty is flat, not a slope.** Sam's steer stands: being evil must be the fun path. The issue is how. Each cruel act is a free-standing button that pays out comfort, so cruelty is simply efficient rather than a temptation you slide into. Frostpunk's Book of Laws and Papers, Please make each harsh step only a little worse than the last, so the player notices too late what they have become (principles 4.3, 3.1). Suggested fix: make cruelty escalate (one act opens the next, the bunker gets used to it, the rewards grow) and show who paid for it on the end screen. Keep evil fun and cheap; make it a path, not a menu.
2. **A day may now be too full for a phone.** The outline aimed for about a minute a turn. A day now has an event, standing orders, comfort, up to three actions, requests and faults (principle 3.4). Nobody has timed a day on a phone. Suggested: time one; if it runs long, fold some standing orders or requests into the event cards.
3. **Hidden information decides more than skill.** Careful vs seer: 10% vs 100% on Founder, 17% vs 85% on force (principles 2.3, 2.4). Suggested: give the careful player one reliable but costly way to read a person, or ease the two hard cards.

Protect: fear hides faces (the grin); the same card can be harmless or an attempt on your life; an empty store is a political crisis before it is fatal.

## Round 4 (16 to 17 Nov 2026): the review's three weakest things

Sam asked for "another run at the game, using the latest skills" (`skills/game-design-principles`, `skills/choice-and-systems-design`, `skills/game-design-review`, added 16 Nov 2026). Started on Fable 5.2 and finished on Opus 5.5 after a usage limit.

The three weakest things, as the review of 16 Nov 2026 named them:
1. **Cruelty is flat, not a slope.** "Each cruel act is a free-standing button that pays out comfort, so cruelty is simply efficient rather than a temptation you slide into."
2. **A day may now be too full for a phone.**
3. **Hidden information decides more than skill.**

What changed:

1. **The slope** (principles 4.3, 3.1). The eight harsh measures now sit on five steps: a firm hand (a dressing-down, a new action; searching the bunks), questions at night (interrogate, divide and rule), examples (make an example, and the curfew), enemies within (scapegoat, the cell), the surface (exile). Only the first step is open at the start. Use the lowest open step once and, the next morning, the report says "Nobody mentions the knock on the door at two in the morning any more. It is just how things are done now." and the next step opens. Each step down: cruelty pays 15% more comfort (it gets easier); measures from higher up shock the others less (they have seen worse); and perks, quiet words, speeches and promises are worth 12% less (they know what you are), down to 40%. "Took it by force" starts three steps down. The lottery card only comes once you are four steps down. Exile and the cell stay available, whatever the step, for someone caught trying to remove you.
   - **Friends.** Everyone has one friend at the start (four pairs). What you do to one, the other feels, and a quiet word tells you so ("It is what you did to Bruno. Bruno is my friend."). Divide and rule now ends a friendship. Exile, desertion and death cost the friend 7 loyalty (2 if the person had it coming).
   - **Who paid.** The end screen now lists how far you went, step by step with the day, and under each person what you did to them ("turned against a friend, shouted at ×3, made an example of ×2, questioned at 2am"). Each person's file shows the same, and who they are close to.
2. **A lighter day** (principle 3.4). Requests come on a third of mornings, not half. A broken machine has two answers, not three (repair it with your luxury, and see who broke it; or have the staff mend it in their own time, which costs everyone 3 loyalty); patching and inspecting are gone. Measured by the bench (it now counts what a day puts in front of the player): the careful player reads 133 words and makes 2.6 decisions a day, with 0.9 things waiting; before this round it was 161 words, 2.8 decisions and 1.75 things waiting. Not timed on a phone.
3. **One reliable reading** (principles 2.3, 2.4). The loyalty test now tells you exactly where someone stands today (devoted, loyal, wavering, hostile), at the cost of offending them if they are loyal (5 loyalty, 10 if proud).

Mistakes made and fixed during the round:
- **The tyrant could win by leaving nobody.** Its first runs on the slope still ended "Nobody left to rule" in up to 74% of runs: terrified, hated staff deserted. A head of security who is doing the job now guards the airlock (desertion a quarter as likely), and so does a curfew (60%). The code tyrant also learned to keep one friend: the person with the keys.
- **The careful player tested everyone and lost.** With the test exact, the code player tested 18 times a run and offended its loyal staff. The test's offence went from 7 to 5, and the code player only tests people whose faces have soured.
- **Kindness was too cheap.** The saint won 84% on "Promised them a vote" while the tyrant was crude. A quiet word now costs 3 comfort, not 2.

Balance at the end of the round (`demo/balance.html`, 120 runs each, 40 for the seer; who comes in at the hatch is random in every run). Share of runs that end with you still in charge:

| Card | Careless | Careful | Saint (no harsh measures) | Tyrant (down the slope) | Sees the hidden numbers |
|---|---|---|---|---|---|
| Inherited it | 3% | 40% | 66% | 78% | 98% |
| Bought your way in | 5% | 57% | 63% | 62% | 100% |
| Took it by force | 4% | 14% | 16% | 28% | 88% |
| Promised them a vote | 2% | 63% | 83% | 45% | 98% |
| Founder of the bunker | 1% | 15% | 32% | 43% | 100% |

Both styles the design wants now have a real chance on every card (choice-and-systems-design, section 6), and neither wins everywhere: the tyrant wins more on the hard cards and when the start was harsh, the saint more where people start loyal. The tyrant loses 8 to 22% of runs to "Nobody left to rule" (was 54 to 72%). The gap between the careful player and the seer is still wide (40% against 98% on "Inherited it"): hidden information still decides a lot, and the careful player is a crude stand-in for a person.

Checked: a whole run clicked through the real buttons at 375 px, leaning on harsh measures (20 days, down four steps, 43 cruel acts, deposed by the vote): no errors. The day and the slope read at 375 px with no sideways scroll, and at 1200 px. The end screen's record read in that run.

Also added: `DESIGN.md` in the build folder, with the spine, the resource table and the decision audit that `skills/choice-and-systems-design` asks for.

## Round 5 (21 Nov 2026): a goal, a hand of cards, projects, and the funny middle

Sam played round 4 and stopped on day 3. His words: "the feel isn't quite right. One part is that the different mechanics or levels just aren't clear so I'm not sure what the objective is, and there aren't any upgrade paths or anything like that. the other part is that the actions I can take are either placid obvious good decisions or cruel decisions, there isn't that funny factor I was thinking about. I only got to day 3 and was already quite disengaged."

The three weakest things, in his terms, and what the code showed behind each:
1. **No objective.** Surviving 30 days was the only goal: no score, nothing to build, so a run had no shape (principles 1.1, 4.6).
2. **Too many systems, none of them explained by the screen.** Comfort set the number of actions; seven standing orders behind a button; requests; faults; the slope; promises; informants (principles 3.3, 3.4).
3. **No funny middle.** Every action was either kind or cruel. The outline says "dark comedy on the surface ... Most choices are funny" (principle 1.3; choice-and-systems-design, section 4).

What changed (rules in `src/engine/sim.js`, cards and projects in `src/data/deck.js`):
- **A goal and a score.** Live as lavishly as you can and still be in charge on day 30. Opulence (`st.res.opu`) is the score; titles from Tenant (0) through Landlord (90), Chairman of the Board (180), Supreme Leader (300) to God-Emperor of Silo 7 (440). Shown under the silo all the time, on the title screen, on the first morning, and as the headline of the end screen with your best per start.
- **A hand of cards instead of a menu.** Draw four each morning, play two. 15 starting cards in four kinds: generous (cost you, please them), spin (cheap, absurd, double-edged: Employee of the Month, Rebrand the Rations as the Founder's Fast, Mandatory Fun, A TED Talk, Hire a Consultant, a Non-Disclosure Agreement, a Team-Building Trust Fall, Motivational Poster), ruthless (pay opulence, stir unrest, and playing one adds the next step's cards to the deck the morning after), indulgent (opulence for luxury). The first morning's business is a choice of management philosophy that adds two cards.
- **Upgrade paths.** Ten projects (a gold hot tub, a gallery of portraits of you, Radio Me, the BilliBuck Mint, a surveillance suite, a truffle farm, a staff wellness centre, a panic room inside the panic room, Jeeves 9000 the robot butler, a one-seat escape pod). One at a time, built on staff overtime. Each adds opulence or new cards or a power (the butler gives a third play; the panic room survives one attempt; the pod lets you leave from day 20 with your score).
- **Cut.** Comfort and its 1 to 3 actions; five of the seven standing orders (the two left, your lifestyle and the staff's rations, sit on the day screen); staff requests; informants. Patching and inspecting faults went in round 4.
- **Visible threat.** The bunker's mood (unrest) is now a five-step meter under the silo: Calm, Grumbling, Muttering, Plotting, On the brink. Individual loyalty and fear stay hidden.
- **Eleven new satire events**, each with a sensible, a selfish and an absurd answer: the heir's start-up ("Uber, but for rations"), renaming the bunker, the dress code, the org chart, the rat mascot, gratitude journals, the staff survey, awards night, limited-edition ration tins, your book, and the welcome meeting.

Mistakes made and fixed during the round:
- **Too easy at first.** Two free spin cards a day kept everyone sweet: the careful and saint players kept power in 95 to 100% of runs. Fixed with stronger drift (loyalty lost to time underground 0.035 to 0.06 a day per day; unmet wants -1.2 to -1.5), a cost for living well (Comfortable -0.3, Decadent -1.0 loyalty a night), overtime 0.5 to 0.8, and weaker spin cards.
- **Then the tyrant was safest and richest.** In charge 72 to 85% with 2.5 times the opulence. Ruthless cards now stir unrest (+3 each) and pay a little less (relish 0.15 to 0.1).
- **The code tyrant counted a promised vote honestly**, and lost it 98% of the time. The rules were fine; the code player now cancels the vote, as a tyrant would.

Balance at the end of the round (`demo/balance.html`, 100 runs each, 60 for the seer; who comes in at the hatch is random every run). Share of runs still in charge on day 30, and mean opulence when in charge:

| Card | Careless | Careful | Saint | Tyrant | Sees the numbers |
|---|---|---|---|---|---|
| Inherited it | 7% | 71% (180) | 76% (153) | 57% (426) | 100% (121) |
| Bought your way in | 12% | 73% (194) | 81% (156) | 83% (456) | |
| Promised them a vote | 10% | 69% (191) | 88% (154) | 50% (426) | |
| Took it by force | 16% | 69% (195) | 53% (147) | 60% (450) | 95% (111) |
| Founder of the bunker | 8% | 55% (253) | 66% (183) | 60% (463) | 100% (202) |

The tyrant scores two to three times what the kind styles score, and loses power more often: evil is the tempting path and the risky one. A day puts about 210 to 240 words and 3 decisions in front of the player (more words than round 4, because the four cards carry their jokes).

Checked: a whole run clicked through the real buttons at 375 px (founder, 22 days, every kind of card, three projects built, all five ruthless steps opened, deposed with 345 opulence): no errors. The day screen, the hand and tonight's settings read at 375 px.

## Round 6 (21 Nov 2026): requests and promises that take days

Sam liked the milestone deck for round 5 and asked: "alongside the projects there needs to be a push and pull with requests or promises, these need to cost resources or need attention over a series of days and have a meaningful consequence for completing it or not".

What changed (rules in `src/engine/sim.js`, the 18 requests in `src/data/requests.js`):
- **Requests.** From day 2, on about a third of mornings (more while a project is being built), one of the staff asks for something: night patrols, a Sunday roast, a proper workshop, a study of your snoring, a podcast, overtime pay. The unhappy ask more often. A request waits two days for an answer, then lapses (the asker minds).
- **Three answers.** Promise it; give the third answer (selfish or absurd, settled at once, often paying opulence); or refuse (the asker takes it badly).
- **A promise is a job.** It has 1 to 4 parts, at most one a day, all due within 2 to 6 days. Each part costs stores (food, water, power, medicine, luxury, even opulence) or your own time, which uses up one of the day's card plays. Up to three promises can be under way. The request card shows the cost of each part and, before you promise, what keeping it gives and what breaking it costs.
- **Kept:** the asker and their friend think better of you, and you get something for good: more food or power or medicine every night, fewer breakdowns, fewer desertions, a card (Broadcast Good News), opulence, a calmer bunker, a satisfied want.
- **Broken** (the days run out): the asker loses a lot of loyalty and takes a step towards removing you; their friend minds; the bunker stirs; your word is worth less; and the request's own fallout happens. Some fallouts: two nights eating staff rations, security off duty for five days, the crop fails, your diary is lost (one fewer play tomorrow), the snoring tapes are played at dinner.
- **Push and pull with projects.** Overtime pay and a day off are only asked for while a project is under way. Breaking overtime, the workshop or the check-ups brings a strike: the project stops for two nights. Keeping the workshop makes every later project a night quicker; keeping the filing system makes them 3 luxury cheaper; keeping overtime pay halves what overtime costs in loyalty; a day off delays the project a night.
- **On screen:** a Requests card under today's business, a speech bubble over the asker in the silo, a line in the morning report, the promises ledger (top right), the end screen, and How to play.

Mistakes made and fixed during the round:
- **Too generous at first.** Keeping requests gave the asker, their friend and everyone a lot of loyalty, as well as the perk. The careful and saint players kept power in 96 to 100% of runs (the same seeds without requests: 63% and 89%). With every reward switched off they fell back to 61%, so the rewards were the cause. Making requests weak enough to fix that would have made them pointless. Instead requests come less often (30% of mornings, not 50%), parts cost 1.5 times as much, a kept request pleases only the asker and their friend (the perk does the rest), the loyalty perks are smaller, and cabin fever is a little stronger (0.06 to 0.07 a night per day underground), so ignoring the staff costs more.
- **The code tyrant ignored every request**, which is not how a tyrant would play. It now keeps the ones that keep security sweet or feed the score, promises anything else when the bunker is restless and never delivers, and otherwise takes the selfish answer.

Balance at the end of the round (`demo/balance.html`, seed 7, 100 runs each, 40 for the seer). Share of runs still in charge on day 30, and mean opulence when in charge:

| Card | Careless | Careful | Saint | Tyrant | Sees the numbers |
|---|---|---|---|---|---|
| Inherited it | 5% | 75% (171) | 89% (140) | 58% (444) | 100% (112) |
| Bought your way in | 11% | 73% (193) | 82% (135) | 71% (451) | |
| Promised them a vote | 10% | 73% (178) | 88% (144) | 40% (435) | |
| Took it by force | 8% | 71% (187) | 49% (128) | 53% (446) | 100% (97) |
| Founder of the bunker | 9% | 65% (214) | 83% (165) | 53% (469) | 100% (188) |

Against round 5: careful players keep power a little more often (71% on average, was 67%), saints too (78%, was 73%), tyrants less (55%, was 62%), still with two and a half to three times the score. The careful player keeps about 5 requests a run and breaks almost none; the tyrant keeps 2 and breaks 1 to 2. A day now asks about 235 words and 3.5 decisions (was 3).

Checked: a 24-day run clicked through the real buttons at 375 px (inherited, seed 41): requests promised, worked on and kept; one left to lapse and broken; the third answer and refusals; the ledger and the end screen. No errors. A strike and the workshop and filing perks checked directly in the rules.

## Not done, not checked

- Rounds 5 and 6 have not been played by a person. Sam played round 4 to day 3. The saint keeps power in nearly 9 runs in 10 on the inherited and vote cards: a safe, low-scoring way to play that may be too safe. The balance numbers come from players made of code. A day has not been timed on a phone.
- Sound has not been heard (this PC cannot play it back to me). The levels copy build 15, which Sam approved. No new sounds were added for the new actions beyond the stamp.
- Not opened on a real phone. The card model has only been drawn by this PC's Intel chip.
- The two paper checks from the fold card (paper rules, card through card) were not written for this model. The fold is solved in closed form (every piece is at height x the board's direction plus depth x forward), so pieces cannot change shape, but pieces that would collide in card (the pawns, the props near the folded-flat pose) are simply hidden until the model stands.
- The flat picture (the fall-back) does not show requests or faults on it; they are still on the desk. It has not been given round 3's figures or night sky.
- The model's lettering is small on a phone (about 7 px). It is decoration there; the desk names every room in full.
- Left out of the outline on purpose: bugged rooms and the planted spy, air as its own resource, factions with names.
- The hooks for the full game: a starting card is plain data (`src/data/cards.js`) and so is who came in at the hatch (`picks` in `newRun`), so Act 1 could deal both.
