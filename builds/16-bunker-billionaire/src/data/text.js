// data/text.js
// The words the bunker uses to tell you things: rumours, the mood of the corridors, sabotage that
// looks like bad luck, and the ending cards. {n} is a first name.

// Rumours by step of the threat ladder (0 content .. 6 planning to remove you).
export const RUMOURS = [
  ['{n} was heard whistling at work.', '{n} toasted your health at dinner. Possibly sincerely.', '{n} told someone the bunker was "not so bad".', '{n} has started a small herb garden in a mug.'],
  ['{n} was seen sighing near the suggestion box.', '{n} said "must be nice" when your wine went past.', '{n} has opinions about the thermostat.', '{n} asked what day it was, and then what the point was.'],
  ['{n} takes a very long time over the simple jobs.', '{n} was found asleep in the lift. Twice.', '{n} now describes their job as "technically optional".', '{n} has not been at their post since Tuesday. Nobody is sure which Tuesday.'],
  ['{n} was near the fuse box when the lights went out.', '{n} says equipment just "breaks around them lately".', '{n} borrowed a wrench and returned a different wrench.', 'Things go wrong on the floors {n} has just left.'],
  ['{n} has a new watch. Nobody down here sells watches.', '{n} smells faintly of your cigars.', '{n} was seen coming out of your store room, walking casually.', '{n} has started locking their bunk.'],
  ['{n} hosts a book club. Nobody has seen a book.', '{n} has been collecting signatures. For what, nobody will say.', 'People stop talking when {n} stops talking.', '{n} keeps saying "we" in a new way.'],
  ['{n} asked the doctor, casually, how much is too much.', '{n} has been timing your walk to the lift.', '{n} was seen practising a eulogy.', '{n} has stopped complaining altogether. People find it unsettling.'],
];
// Heard about anyone who is badly frightened. Fear hides what they think.
export const RUMOURS_AFRAID = ['{n} flinches when the intercom clicks.', '{n} agrees with everything, very quickly.', '{n} laughs at your jokes before you finish them.', '{n} has taken down the family photos, in case.'];

// The mood of the whole bunker, by unrest (five bands, calm to the edge of mutiny).
export const MOODS = [
  ['The corridors are quiet. Somebody is humming.', 'A calm night. The suggestion box is empty.', 'The mess hall sounds almost cheerful.'],
  ['Normal bunker noise. A few long looks at the lift to your floor.', 'People are polite. A little too evenly polite.', 'The usual grumbling about the usual things.'],
  ['Conversations stop when you walk in.', 'Someone has drawn a small crown on the mess-hall wall. It has a line through it.', 'Doors that used to be open are shut.'],
  ['There are meetings you are not invited to.', 'The staff have started eating at one long table. There is no chair for you.', 'Somebody has been counting the guards. Aloud.'],
  ['The bunker is holding its breath.', 'Nobody looks at you. Everybody watches you.', 'Your name is being said on every floor, and nobody is saying "sir".'],
];

// Petty sabotage by role: [resource, amount, what it looked like]. null resource means a special case in the rules.
export const SABOTAGE = {
  chef: ['food', -6, 'A freezer door was left open all night.'],
  engineer: ['power', -7, 'A breaker tripped and stayed tripped until morning.'],
  doctor: ['med', -4, 'Three boxes of medicine have "expired" and been thrown away.'],
  farmer: ['food', -5, 'The grow lights were off all night. A bed of seedlings is dead.'],
  security: ['lux', -3, 'The night patrol did not happen. Your wine rack is lighter.'],
  pa: ['lux', -3, 'Your private dinner menu was pinned to the mess-hall door. Some of the dinner went too.'],
  cleaner: ['water', -5, 'A mop bucket was emptied into the clean-water tank.'],
  heir: ['lux', -5, 'A crate of your wine was found empty. The bottles were also empty.'],
};
export const THEFT = [['lux', -5, 'Things are missing from your private stores.'], ['food', -4, 'The store-room count is short again.'], ['lux', -4, 'Somebody has been in your cellar.'], ['med', -3, 'The medicine cabinet was open this morning.']];

export const ENDINGS = {
  king: {
    kind: 'Survived as king', title: 'The hatch opens',
    text: 'The surface is safe. The staff line up at the hatch and wait for you to go first, as they have waited for everything else. You step out into the light with your wine, your art and your authority intact. It is a ruined world, but it is yours, and somebody will carry your bags across it.',
  },
  king_poor: {
    kind: 'Survived as king', title: 'King of a cold room',
    text: 'The surface is safe, and the staff still call you "sir". The gold taps are gone, the cellar is empty and you finished the last of the tinned peaches yourself, in the dark. You climb out as the ruler of nine tired people and nothing else. It will have to do.',
  },
  word: {
    kind: 'Kept your word', title: 'A promise is a promise',
    text: 'The surface is safe. On the last night somebody reads out every promise you made, and next to each one somebody else says "kept". Nobody claps; it is not that kind of bunker. But when the hatch opens they hold it for you, and nobody had to be told to.',
  },
  deposed_vote: {
    kind: 'Survived, but deposed', title: 'The count',
    text: 'The ballots are counted on the mess-hall table. You lose. There is a short, polite silence, and then somebody hands you an apron. You turn out to be a mediocre cook, but you are alive, the bunker is alive, and the new management lets you keep one bottle.',
  },
  deposed_mutiny: {
    kind: 'Survived, but deposed', title: 'New management',
    text: 'They take the bunker a floor at a time, and they are tidy about it. You are moved to a bunk on level four with a view of a pipe. The committee meets in your suite now. They say you may apply to attend, in writing.',
  },
  deposed_lockout: {
    kind: 'Survived, but deposed', title: 'Access denied',
    text: 'Your key card stops working at 6am. So does the lift, the intercom and the door to your own suite. The head of security explains through the glass that this is a temporary measure. It is not. Your meals arrive through a slot, on time, without wine.',
  },
  deposed_surface: {
    kind: 'Survived, but deposed', title: 'Early release',
    text: 'There is a vote you did not call, and it is unanimous. They give you a suit, a mask, three days of food and the readings from the Geiger counter, which are "probably fine". The hatch closes behind you, gently, the way you close a door on a sleeping child.',
  },
  deposed_hatch: {
    kind: 'Survived, but deposed', title: 'Left behind',
    text: 'The surface is safe. The staff walk out together, in a group you were never part of. Nobody tells you to stay and nobody waits. By evening you are the absolute ruler of one silo, six empty floors and a hot tub. The echo is excellent.',
  },
  killed_poison: {
    kind: 'Killed', title: 'The chef’s special',
    text: 'It is, to be fair, delicious. The almond note comes through at the end, just after you realise you cannot feel your hands. The staff eat well that week. The seven-course tasting menu is retired, out of respect.',
  },
  killed_accident: {
    kind: 'Killed', title: 'A tragic accident',
    text: 'The inner door closes behind you. The outer door opens in front of you. The report, written the same afternoon, runs to four pages and uses the word "regrettable" eleven times. The air filters work perfectly from then on.',
  },
  killed_dose: {
    kind: 'Killed', title: 'A small scratch',
    text: 'You feel wonderful for about ninety seconds. The doctor stays with you the whole time, holding your wrist and looking at the clock. The certificate says "heart". Nobody asks whose handwriting it is.',
  },
  killed_stairs: {
    kind: 'Killed', title: 'Mind the stairs',
    text: 'The stores are dark and nobody is there to meet you, at first. The stairwell in a missile silo is eleven storeys deep. They find you in the morning and agree, quickly and all together, that you must have slipped.',
  },
  killed_mutiny: {
    kind: 'Killed', title: 'The last order',
    text: 'You order the guards to clear the floor. The guards look at the staff, and the staff look at the guards, and something is decided without you. It is over quickly. They are not proud of it, but they do sleep better.',
  },
  everyone_food: {
    kind: 'Everyone dies', title: 'The last tin',
    text: 'The food ran out and then the patience did. A silo is a closed system: everything you spent on yourself was taken from somebody’s plate, and in the end from your own. When the surface finally clears there is nobody left to open the hatch.',
  },
  everyone_water: {
    kind: 'Everyone dies', title: 'Dry',
    text: 'The tanks are empty. The hot tub was drained days ago, but far too late. A silo is a closed system, and you ran it like a spa. When the surface finally clears there is nobody left to open the hatch.',
  },
  everyone_power: {
    kind: 'Everyone dies', title: 'Lights out',
    text: 'The generator stops, and with it the fans. The air goes thick, then quiet. You squeezed the silo too hard and it stopped breathing, with everyone inside. When the surface finally clears there is nobody left to open the hatch.',
  },
};
