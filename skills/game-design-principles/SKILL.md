---
name: game-design-principles
description: Core game design principles from respected directors, studios and critics, written as plain test questions. Use when designing, scoping or changing any game, or when another game skill needs the principles.
---

# Game design principles

A short reference for any game Sam is working on, whatever the genre or size. Each principle has three parts: the idea, where it comes from, and a **test question** to ask of the game.

Works with any model that reads skills. Names no product-only tools. UK English, plain words.

How to use it:
- When designing: go through the test questions before writing any code.
- When reviewing: answer each test question about the build, with evidence (a screen, a number, a line of code). "Probably" is not evidence.
- Don't apply every principle to every game. Choose the ones that fit the game's purpose (section 1) and say which you've skipped.

---

## 1. Purpose: know what the game is for

**1.1 Name the feeling first.** Julian Gollop "absolutely wanted players to feel panic" in X-COM and chose mechanics to cause it: a clock that never stops, aliens that move while you're out of sight. Johan Pilestedt (Helldivers 2) says good design is mainly about making people feel something.
*Test: in one sentence, what should the player feel? Which mechanic causes that feeling?*

**1.2 A game for everyone is a game for no one.** This is Arrowhead's motto. Choose an audience and accept that some players will bounce off.
*Test: who is this game not for? Has anything been watered down to please them?*

**1.3 Have something to say.** 11 bit studios only start a project if it has something to say. Frostpunk's designers kept asking "what makes a choice interesting?" and answered: a choice that tests what you'll give up.
*Test: what question does the game ask the player? Does play itself ask it, not just the story text?*

**1.4 Protect the core concept.** Sakurai: be flexible about details, but never tamper with the core concept you started with. Pilestedt: Helldivers 2 ran four years over because the team skipped pre-production.
*Test: write the core concept in one or two sentences. Does every system in the build serve it?*

## 2. Decisions: the heart of play

**2.1 A game is a series of interesting decisions** (Sid Meier). An interesting decision:
- involves a **trade-off** (a cost for a benefit);
- is **situational** (the best option depends on the current state);
- is **persistent** (its effects last);
- lets the player **express a play style** (cautious or reckless, kind or cruel);
- often weighs **risk against reward**, or **short term against long term**;
- is **not trivial**: if picking the first option or picking at random works, it isn't interesting.
*Test: list the decisions in one turn or level. Mark each against the six points. Cut or rework the ones that hit none.*

**2.2 Risk and reward is the essence** (Sakurai). To jump on the Koopa you have to get close to it. Every reward should require some exposure to risk.
*Test: what does the player risk to get each reward? Which rewards come free?*

**2.3 Give enough information to choose well.** Meier: when in doubt, give too much information rather than too little. Always respond to a decision; "the worst thing you can do is just move on". Decisions that can ruin the rest of a run need extra care.
*Test: before each decision, can the player see what each option costs? After it, do they see a response?*

**2.4 Hide information by rules, not by accident.** Gollop calls it "hiding stuff from the player and revealing stuff to the player" by set rules: line of sight, hidden movement. Into the Breach goes the other way and shows enemy moves in advance, which turns each turn into a puzzle. Both work because the rules about what you can see are consistent.
*Test: what is hidden, and what rule decides it? Can the player learn ways to see more?*

**2.5 Pace the decisions.** Meier: complex decisions back to back leave players feeling out of control. Simple decisions in quiet moments bore them.
*Test: draw how heavy the decisions are across a session. Are there rests and peaks?*

## 3. Systems: what players will actually do

**3.1 Players will optimise the fun out of a game** (Soren Johnson). Mark Rosewater: players do whatever the game rewards, fun or not, so the designer's job is to put the fun where they can't help finding it.
*Test: what is the most efficient way to win? Is it fun? If not, change the rewards, not the player.*

**3.2 Watch for one dominant strategy.** Johnson warns that one strategy can drown out all the others. Don't remove every exploit, though: ask whether it crowds out other ways of playing or is a fun alternative.
*Test: across many runs, does one approach win far more often? (Use the code players in the systems skill.)*

**3.3 Cut hard.** Into the Breach's breakthrough came when Subset Games cut about 60% of what they'd planned: city-building, research trees, damage that carried over. Meier: "be ruthless in terms of cutting things out." Gollop names cutting features as a design skill.
*Test: what would be left if you removed the weakest third? Would the game get better?*

**3.4 Don't drown in your own complexity.** Tynan Sylvester calls this the typical danger for simulation games.
*Test: how many separate things does the player track in one turn? What does each one add?*

**3.5 Limits are a design tool.** Gollop treats constraint as a key design pillar. 11 bit's Frostpunk team: "limits can be a new opportunity" and "scarcity can sometimes become affluence". A capped population made every death matter.
*Test: what does the game limit hard? Would a tighter limit make choices sharper?*

## 4. Story and emotion from systems

**4.1 Let the player write the story (apophenia).** Sylvester designed RimWorld as a story generator: players read more meaning into events than the rules actually contain. Ways to get that effect: name every character, keep the cast small (RimWorld keeps it to about 12), focus on health and relationships, keep the visuals simple so imagination fills the gaps, and leave room for interpretation.
*Test: after a run, could the player retell it as a story about named people?*

**4.2 People can care about numbers.** Frostpunk's designers found players will care about plain numbers when each loss feels individual.
*Test: when a number drops, can the player tell who it happened to?*

**4.3 Complicity: small steps to something terrible.** Frostpunk's Book of Laws was ordered so "every law should be a little bit more than the previous one". The designers call this creeping normality. Players rarely set out to become tyrants, but many end up there. Papers, Please makes kindness cost time and money, so cruelty becomes the efficient choice.
*Test: if the game is about moral choices, does each bad act make the next one easier? Is cruelty tempting, not just possible?*

**4.4 Don't preach.** Frostpunk leaves players to think for themselves and never answers "was it worth it?" for them.
*Test: does the game judge the player, or does it show them what happened and let them judge?*

**4.5 Make the player reflect afterwards.** Marta Fijak (11 bit) said Frostpunk's real weight came from reflection after the run. Their scenario process: define the concept in one or two sentences, decide the ending early, and show the consequences of the player's choices.
*Test: what does the end screen show the player about what they did?*

**4.6 End like a story when it matters.** Frostpunk was written to end "the way a novel ends", not as an open sandbox.
*Test: does a run have a shape, with a build-up, a climax and an ending?*

## 5. Respect the player

**5.1 No bloat.** A common criticism from critics is padding: side activities and grind that keep players from the best parts. Long is fine. Padded is not.
*Test: which parts would a player skip if they could? Why are they there?*

**5.2 Ship it working.** Sakurai: launch with as few bugs as possible, because patches won't help once players have given up.
*Test: has a person played it start to finish on the target device?*

**5.3 Teach through play.** Players bring knowledge from real life and other games. Build on it, and don't break familiar conventions without a reason (Meier). Gollop talks about when to follow genre conventions and when to break them.
*Test: what would a player expect from the genre? Where does the game surprise them, and is that on purpose?*

**5.4 The designer isn't the player.** Meier: "the player should be having fun, not the designer". Don't assume players think like you.
*Test: who has played it apart from the designer? What did they do that you didn't expect?*

## 6. Process

- **Paper or simple prototype first.** 11 bit put every core Frostpunk mechanic through a paper prototype at some point.
- **Playtest, then trust what you feel.** Subset cut on instinct when "this doesn't feel right", then tested again.
- **Steal well.** The Into the Breach postmortem covers how to borrow design from other games successfully. Balatro's creator avoided other roguelikes at first, then learned from Slay the Spire.
- **Know your scope.** Into the Breach took four years and nearly broke its two-person team. Cutting deep has to be balanced against burnout.

---

## Critic lenses

Three critics Sam trusts, used as lenses for reviewing a build. **Sourcing note:** these are based on what the critics have said in interviews and episode descriptions, plus their known review formats. They are not from watching every video, so treat them as approaches, not quotes. If Sam pastes transcripts, sharpen these.

**Skill Up lens (Ralph Panebianco).** He describes his reviews as "mini-essays on game design" that explain why mechanics do or don't work, not buying guides with pros and cons. He ends with a plain verdict ("I recommend" / "I do not recommend"). He's sceptical of big, safe games that disappoint, and keen to champion small games that are really good.
*Ask: would I recommend this to a friend who values their time? Why do its best and worst mechanics work or fail? Is it safe where it should be bold?*

**Design Delve lens (JM8 and Ludo, Second Wind).** Each episode takes one specific system and asks what it is doing and why it works. Examples: what developers misunderstand about Dark Souls level design, ranking FromSoftware's healing systems, Tetris-style inventories in Dredge, why League of Legends' design feeds toxicity, and "can a badly designed game still be good?".
*Ask: pick the single most important system. What is it really doing for the player? What would someone copying it get wrong? Does its design encourage behaviour you don't want?*

**Whitelight lens.** He makes long-form retrospectives, often looking back years later ("Control: 5 years later"), weighing a whole game: world, story, systems and how they fit together.
*Ask: in five years, what would this game be remembered for? Do its world, story and systems tell the same story, or pull apart?*

---

## Sources

- Sid Meier, "Interesting Decisions", GDC 2012: [Game Developer write-up](https://gamedeveloper.com/design/gdc-2012-sid-meier-on-how-to-see-games-as-sets-of-interesting-decisions)
- Soren Johnson, "Water Finds a Crack": [designer-notes.com](https://www.designer-notes.com/game-developer-column-17-water-finds-a-crack/)
- Masahiro Sakurai on Creating Games (YouTube), risk and reward: [Nintendo Life](https://nintendolife.com/news/2022/08/video-masahiro-sakurai-breaks-down-risk-and-reward-in-games)
- Julian Gollop on X-COM: [TechRaptor](https://techraptor.net/gaming/guides/how-julian-gollop-created-influential-strategy-classic-x-com-ufo-defense); AIAS Game Maker's Notebook episode: [libsyn](https://gamemakersnotebook.libsyn.com/xcom-creator-julian-gollop-shares-game-design-tips-dev-stories-and-more)
- Subset Games on cutting Into the Breach: [PC Gamer](https://pcgamer.com/into-the-breach-originally-had-city-building-and-tech-trees-creators-reveal)
- 11 bit studios on Frostpunk: [PC Gamer](https://www.pcgamer.com/frostpunk-developers-on-hope-misery-and-the-ultimately-terrifying-book-of-laws), [IGC 2018 talk](https://www.invenglobal.com/articles/6528/igc-2018-empathize-with-numbers-the-process-of-frostpunk-scenario-writing), [TechRaptor on paper prototyping](https://techraptor.net/content/how-11-bit-studios-created-society-survival-simulator-frostpunk)
- Tynan Sylvester on RimWorld and apophenia: [Rock Paper Shotgun](https://www.rockpapershotgun.com/2016/08/12/how-rimworld-generates-great-stories); AIAS episode "Generating Human Stories"
- Johan Pilestedt / Arrowhead: [GamesRadar](https://gamesradar.com/games/action-rpg/helldivers-2-director-stands-by-fromsoftware-in-the-difficulty-discourse-as-hidetaka-miyazaki-doubles-down-on-making-hard-games-always-cater-to-a-select-audience)
- Mark Rosewater, "Twenty Years, Twenty Lessons" (Drive to Work podcast)
- Skill Up on reviews as design essays: [NVIDIA Studio interview](https://blogs.nvidia.com/blog/skillup-adobe-premiere-pro-photoshop/)
- Design Delve: [TV Tropes summary](https://tvtropes.org/pmwiki/pmwiki.php/WebVideo/DesignDelve), [Escapist episode pages](https://www.escapistmagazine.com/the-scarily-good-design-of-alien-isolation/)
- AIAS Game Maker's Notebook episode list: [interactive.org](https://www.interactive.org/Interviews/the_game_makers_notebook.asp)
