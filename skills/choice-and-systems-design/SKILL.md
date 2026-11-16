---
name: choice-and-systems-design
description: Design and tune the choices, resources, moral dilemmas and emergent stories in strategy, management, survival, card and roguelite games, and check balance with code players. Use when building or fixing the rules of such a game.
---

# Choice and systems design

For games where the fun lives in decisions and systems: management sims, survival, strategy, deck builders, roguelites and choice-driven story games. Examples from Sam's own projects: Bunker Billionaire, the Rufus deck builder, Wallhold and the Chivereen map game.

Read **game-design-principles** first; this skill puts sections 2 to 4 of it into practice.

Works with any model that reads skills. Names no product-only tools. UK English, plain words.

---

## 1. Write the spine (before any rules)
Five lines, no more:
1. **Feeling:** what the player should feel (panic, guilt, cleverness, dread).
2. **Question:** what the game asks the player (for example "what will you give up to stay in charge?").
3. **Loop:** one turn in a single sentence.
4. **Run shape:** how long a run lasts, how it builds and how it ends.
5. **Cut line:** what this game will *not* have.

Every later rule must serve lines 1 and 2. If it doesn't, cut it or park it.

## 2. Resources
- List every resource with what fills it, what drains it and what happens at zero.
- **Close the system** where you can: if nothing new comes in, every spend is a choice (Frostpunk: scarcity sharpens decisions).
- **Make zero a story, not just a loss.** An empty store should first cause a crisis with painful ways out, before it ends the run.
- Keep the number of resources small. A new one must create a new kind of decision, not just another bar to watch.

## 3. Decision audit
Make a table of every decision in a typical turn:

| Decision | Trade-off | Depends on situation? | Lasting effect? | Info shown before | Response shown after | Dominant option? |
|---|---|---|---|---|---|---|

- Rework any row with no trade-off, or with a clearly dominant option.
- Rework any row where the player can't see the cost before choosing (unless hiding it is the point, and a rule says so).
- Check the **pace**: mix heavy decisions with light ones.
- Check the **count**: if a turn has more decisions than a phone screen can show, cut or merge some.

## 4. Building dilemmas (for moral or political choices)
From 11 bit studios' approach (Frostpunk, This War of Mine) and Papers, Please:
1. **Start from a moral question**, not a mechanic.
2. **Tie it to resources**, so the right thing costs something real.
3. **Make the bad option tempting**: faster, cheaper or restful. Papers, Please makes kindness cost time and money.
4. **Creeping normality:** order the harsh options so each one is only a little worse than the last, and doing one makes the next feel normal.
5. **Show the consequences**, ideally on named people.
6. **Foreshadow**: give warnings before twists, so players feel responsible, not ambushed.
7. **Don't preach.** Show what happened and let the player judge it.
8. **Reflection at the end:** the end screen shows what the player did and who paid for it.

## 5. Emergent story
From Tynan Sylvester (RimWorld):
- **Name everyone.** Keep the cast small (about 8 to 12) so players can hold each person in their head.
- **Health and relationships** produce the most story: grudges, debts, friendships, injuries.
- **Log causes**, so the game can say *why* something happened ("Ilse is angry because you exiled Bruno").
- **Keep visuals simple enough** that imagination does some of the work.
- **Failure should be a good story too**, not just a reload screen.

## 6. Balance with code players
Write a small bench that plays whole runs with no screen, using several players made of code:
- **Careless:** picks at random. Should mostly lose.
- **Careful:** uses only what a real player can see. Should win roughly half the time on a normal setting.
- **Seer:** reads the hidden numbers. Should nearly always win. A big gap between careful and seer means hidden information decides outcomes more than skill does; check this is what you want.
- **Style players**, one for each way of playing the design wants to support (for example, a tyrant and a saint). Each should have a real chance of winning. If one style loses almost every run, it isn't a real option. If one wins almost every run, it's dominant (principles 3.1 and 3.2).

Run 100+ runs for each setting and record: win rate, how runs end, average length, and how often each action is used. Actions that are almost never used are candidates for cutting. Re-run after every rule change and keep the table in the build log.

**Code players aren't people.** Always follow a bench round with a human playtest, ideally Sam on his phone.

## 7. Cut pass
At the end of each round, list every system with what it adds to the spine. Remove or park the weakest. Subset Games cut about 60% of Into the Breach's plans and the game got better.

## Output
- Keep the spine, the resource table and the decision audit in the game's design doc, and update them as rules change.
- Keep bench results in the build log, dated, with the rule change that caused each shift.
