// data/events.js
// The event deck. One card a day: a crisis or a request, with two or three choices.
//
// A card: { id, title, from?, when?(g), weight?, repeat?, grim?, system?, setup?(g, c), text(g, c), choices(g, c) }
//   from     role that must still be in the bunker (also shown as the sender)
//   setup    picks anything random the card needs and returns it as c, so the text never changes on reload
//   choices  [{ t: label, c: { resource: change } (shown to the player), need?(g, c) -> true | reason, r(g, c) -> what happened }]
// The changes in c are open; everything r() does to loyalty and fear is hidden, and the words it
// returns are the only sign of it. g is the handle from engine/sim.js.

const top = (g, min = 3, skip) => g.here().filter((p) => p.stage >= min && p.role !== skip).sort((a, b) => b.stage - a.stage || a.loyalty - b.loyalty)[0];
const anyGossip = (g) => g.here().some((p) => p.trait === 'gossip');
const dead = (g, p) => { g.remove(p, 'dead'); g.st.stats.deaths++; };

// A card that is harmless from a loyal person and deadly from one who has reached the top of the
// ladder. You cannot tell which from the card. o.real(g, p): is it a trap?
function ambiguous(o) {
  return {
    id: o.id, title: o.title, from: o.from, weight: 0.8,
    setup: (g) => { const p = g.s(o.from); return p ? { role: o.from, real: p.stage >= (o.realAt || 6) } : null; },
    text: o.text,
    choices: () => [
      { t: o.trust, r: (g, c) => (c.real ? o.trap(g, g.s(c.role)) : o.fine(g, g.s(c.role))) },
      { t: o.proxy, need: o.proxyNeed, r: (g, c) => (c.real ? o.caught(g, g.s(c.role)) : o.insult(g, g.s(c.role))) },
      { t: o.decline, r: (g, c) => (c.real ? o.dodge(g, g.s(c.role)) : o.snub(g, g.s(c.role))) },
    ],
  };
}
// You walked into it. Mostly fatal.
function trap(g, ending, lived) {
  if (g.chance(0.72)) { g.end(ending); return ''; }
  g.res('med', -6); g.fear('all', -4); g.st.stats.survivedAttempts++;
  return lived;
}

const list = [
  // ------------------------------------------------------------------ luxury against survival
  {
    id: 'hot_tub', title: 'The hot tub', from: 'engineer', when: (g) => g.st.res.water >= 12,
    text: (g) => `${g.n('engineer')} needs a decision. The hot tub takes 400 litres to fill. So do the crops.`,
    choices: () => [
      { t: 'Fill the tub', c: { water: -8, lux: 4 }, r: (g) => { g.loy('all', -3); g.loy('farmer', -5); return 'You soak for an hour. On the farm level somebody waters the tomatoes with a teacup, loudly.'; } },
      { t: 'Water the crops', c: { lux: -2, food: 3 }, r: (g) => { g.loy('farmer', 5); return 'The tub stays dry and the tomatoes do well. You sulk, which costs nothing.'; } },
      { t: 'Fill it, and open it to the staff for one evening', c: { water: -8 }, r: (g) => { g.loy('all', 5); g.fear('all', -4); return 'Nine people in a hot tub built for two. It is horrible and everyone is delighted. They have now seen you in swimming trunks.'; } },
    ],
  },
  {
    id: 'banquet', title: 'A tasting menu', from: 'chef', when: (g) => g.st.res.food >= 16,
    text: (g) => `${g.n('chef')} proposes a seven-course tasting menu "to mark the occasion". The occasion is that ${g.n('chef')} is bored.`,
    choices: () => [
      { t: 'Hold the banquet, for one', c: { food: -9, lux: 6 }, need: (g) => !g.st.flags.equalRations || 'You promised equal rations', r: (g) => { g.loy('chef', 8, 'gift'); g.loy('not:chef', -4); return 'Seven courses. The smell reaches every floor. The staff eat lentils and listen to your cutlery.'; } },
      { t: 'Hold it for everyone', c: { food: -14 }, r: (g) => { g.loy('all', 6); g.loy('chef', 3); return 'One long table, seven courses, no speeches. For an evening nobody is counting tins.'; } },
      { t: 'Say no', r: (g) => { g.loy('chef', -6); return `${g.n('chef')} says "of course" and serves lentils for four days.`; } },
    ],
  },
  {
    id: 'wine', title: 'The cellar',
    text: () => 'Your sommelier did not make it to the bunker. Three hundred bottles did. The staff have noticed the ratio.',
    choices: () => [
      { t: 'Open the cellar on Fridays', c: { lux: -6 }, r: (g) => { g.loy('all', 5); return 'Friday becomes the only day anyone is sure of. They drink your wine and, briefly, your health.'; } },
      { t: 'Keep it locked', r: (g) => { g.loy('all', -1.5); return 'You add a second padlock. People walk past the cellar door slowly.'; } },
      { t: 'Swap a case for the doctor’s private medicine', c: { lux: -4, med: 7 }, need: (g) => !!g.s('doctor') || 'There is no doctor', r: (g) => { g.loy('doctor', 4, 'gift'); return `${g.n('doctor')} produces a box from under a floor tile, and takes the case without looking at the label.`; } },
    ],
  },
  {
    id: 'gold_taps', title: 'The gold taps', from: 'engineer',
    text: (g) => `The gold taps in your bathroom drip. Fixing them takes ${g.n('engineer')} off the water plant for a day.`,
    choices: () => [
      { t: 'Fix the taps first', c: { water: -5, lux: 3 }, r: (g) => { g.loy('engineer', -5); return `The taps stop dripping. ${g.n('engineer')} uses the word "priorities" where you can hear it.`; } },
      { t: 'Leave them dripping', c: { lux: -2 }, r: (g) => { g.loy('engineer', 2); return 'Drip. Drip. You put a towel in the basin and think about what you have become.'; } },
      { t: 'Melt them down for wiring', c: { lux: -6, power: 8 }, r: (g) => { g.loy('engineer', 6); g.loy('all', 2); return `${g.n('engineer')} has them off the wall before you finish the sentence. The lights on level five stop flickering.`; } },
    ],
  },
  {
    id: 'film_night', title: 'Film night',
    text: () => 'You own four thousand films and the only cinema for a very long way. The staff ask to borrow it on Tuesdays.',
    choices: () => [
      { t: 'Yes', c: { power: -3 }, r: (g) => { g.loy('all', 5); return 'They pick a musical. You can hear them singing from two floors up. It is not good singing.'; } },
      { t: 'No', r: (g) => { g.loy('all', -2); return 'The cinema stays yours. You watch a comedy alone and do not laugh.'; } },
      { t: 'Yes, and you choose the film', c: { power: -3 }, r: (g) => { g.loy('all', 1); g.fear('all', 2); return 'Four hours of the documentary about you. Attendance is total. So is the silence.'; } },
    ],
  },
  {
    id: 'flowers', title: 'One bed of flowers', from: 'farmer',
    text: (g) => `${g.n('farmer')} wants to plant flowers in one grow bed. "For morale." It would mean a little less food.`,
    choices: () => [
      { t: 'One bed of flowers', c: { food: -3 }, r: (g) => { g.loy('all', 4); g.loy('farmer', 4); return 'Marigolds, under the grow lights. People start taking the long way round to walk past them.'; } },
      { t: 'Food only', r: (g) => { g.loy('farmer', -4); return `${g.n('farmer')} plants cabbages, and gives each one a name, to make a point.`; } },
      { t: 'Flowers, but in your suite', c: { food: -3, lux: 3 }, r: (g) => { g.loy('farmer', -3); g.loy('all', -2); return 'The marigolds look lovely on your dining table. Nobody else sees them.'; } },
    ],
  },
  // ------------------------------------------------------------------ the silo breaking down
  {
    id: 'air_filter', title: 'A tired filter', from: 'engineer',
    text: (g) => `An air filter on level four has failed. ${g.n('engineer')} says it was "tired".`,
    choices: () => [
      { t: 'Run your cinema’s air into level four', c: { lux: -4 }, r: (g) => { g.loy('all', 3); return 'Level four breathes. Your cinema now smells of level four.'; } },
      { t: 'Close level four and double people up', c: { power: 3 }, r: (g) => { g.loy('all', -4); return 'Two to a bunk. It saves power. Nobody thanks you for the saving.'; } },
      { t: 'Ask who was near it last night', c: { power: -3 }, r: (g) => {
        const p = top(g, 3);
        g.loy('all', -1);
        if (!p) return 'The log shows nobody near it. It really was tired. You have spent a day finding that out.';
        const named = g.chance(0.75) ? p : g.pick(g.here());
        g.note(named, 'signed in near the broken filter');
        return `The log shows ${named.first} signed in on level four at 2am. ${named.first} says they like the quiet.`;
      } },
    ],
  },
  {
    id: 'generator', title: 'The generator is running hot',
    text: () => 'The generator is running hot. Something has to be switched off tonight.',
    choices: (g) => [
      { t: 'Your cinema and heated floors', c: { lux: -5, power: 6 }, r: () => 'You wear socks to bed, like an animal.' },
      { t: 'Heating on the staff levels', c: { power: 6, med: -2 }, r: (g) => { g.loy('all', -5); return 'The staff levels drop to nine degrees. Everybody has a cold by Thursday and knows whose floor is warm.'; } },
      g.st.cameras
        ? { t: 'The cameras', c: { power: 5 }, r: (g) => { g.st.cameras = false; g.loy('all', 1.5); return 'The little red lights go out. You tell yourself it is only for now.'; } }
        : { t: 'Nothing. Run it hot and hope', r: (g) => { if (g.chance(0.5)) return 'It holds. It makes a noise like a kettle full of spanners, but it holds.'; g.res('power', -10); return 'It does not hold. Something expensive melts at four in the morning.'; } },
    ],
  },
  {
    id: 'blight', title: 'Grey fuzz', from: 'farmer',
    text: (g) => `There is grey fuzz on the tomatoes. ${g.n('farmer')} wants to burn a third of the crop to save the rest.`,
    choices: () => [
      { t: 'Burn it', c: { food: -8 }, r: (g) => { g.loy('farmer', 3); return 'The farm level smells of bonfire for a week. The rest of the crop is clean.'; } },
      { t: 'Wait and see', r: (g) => { if (g.chance(0.5)) return 'It was dust. Somebody wipes the tomatoes with a cloth. You feel very wise.'; g.res('food', -15); g.loy('farmer', -5); return `It was not dust. Half the crop is slime by the weekend. ${g.n('farmer')} does not say "I told you so", very loudly.`; } },
      { t: 'Spray it with medical alcohol', c: { med: -5 }, r: (g) => { g.loy('doctor', -4); return 'The tomatoes recover. They taste faintly of hospital.'; } },
    ],
  },
  {
    id: 'scald', title: 'A burst pipe', when: (g) => g.st.res.med >= 2,
    setup: (g) => { const p = g.pick(g.here().filter((x) => x.role !== 'heir')); return p ? { role: p.role } : null; },
    text: (g, c) => `A steam pipe has burst on the plant level. ${g.n(c.role)} is badly scalded.`,
    choices: () => [
      { t: 'Treat it properly', c: { med: -6 }, r: (g, c) => { g.loy(c.role, 8); g.loy('all', 2); const p = g.s(c.role); if (p) p.noticed = g.st.day; return `Dressings, painkillers and three days in bed. ${g.n(c.role)} will keep the arm.`; } },
      { t: 'A bandage, and back to work', c: { med: -1 }, r: (g, c) => { g.loy(c.role, -10); g.loy('all', -3, 'ideal'); return `${g.n(c.role)} is back at work by the afternoon, one-handed. People look at the bandage, and then at you.`; } },
      { t: 'Blame the engineer, in front of everyone', need: (g, c) => (c.role !== 'engineer' && !!g.s('engineer')) || 'Not this time', r: (g, c) => { g.loy('engineer', -10, 'punish'); g.fear('all', 3); g.loy(c.role, -4); return `${g.n('engineer')} takes it without a word. Nobody treats the burn.`; } },
    ],
  },
  {
    id: 'food_count', title: 'The store-room count', repeat: true, weight: 2.5, when: (g) => g.st.res.food < 26,
    text: (g) => `The store-room count is in. At this rate the food runs out before the surface is safe.`,
    choices: () => [
      { t: 'Cut the staff rations', r: (g) => { g.st.flags.rationCut = g.st.day + 6; g.loy('all', -6); return 'Smaller portions for six days. The mess hall goes very quiet at mealtimes.'; } },
      { t: 'Cut your own table', c: { lux: -6, food: 5 }, r: (g) => { g.loy('all', 4, 'ideal'); return 'Your private larder goes down to the kitchen in two trips. You eat lentils where people can see you do it.'; } },
      { t: 'Cut both, a little', c: { lux: -3, food: 2 }, r: (g) => { g.st.flags.rationCut = g.st.day + 4; g.loy('all', -2); return 'Everyone is a little hungry, including, in theory, you.'; } },
    ],
  },
  {
    id: 'showers', title: 'The water gauge', repeat: true, weight: 2.5, when: (g) => g.st.res.water < 26,
    text: () => 'The water gauge is in the red. The plant cannot recycle fast enough for nine people and a hot tub.',
    choices: () => [
      { t: 'Staff showers once a week', c: { water: 6 }, r: (g) => { g.loy('all', -5); return 'The bunker begins to smell like a bunker.'; } },
      { t: 'Drain the hot tub into the tanks', c: { water: 8, lux: -5 }, r: (g) => { g.loy('all', 2); return 'It gurgles away. You stand and watch it go, like a man at a graveside.'; } },
      { t: 'Do nothing', r: () => 'You tap the gauge. It stays red.' },
    ],
  },
  // ------------------------------------------------------------------ the grim edge
  {
    id: 'antibiotics', title: 'The last course', grim: true, weight: 1.6,
    when: (g) => g.st.day >= 7 && g.s('farmer') && g.s('heir') && g.st.res.med >= 6,
    text: (g) => `${g.n('farmer')}’s hand has gone septic. ${g.n('heir')} has pneumonia. There is one full course of antibiotics left in the bunker.`,
    choices: (g) => {
      const f = g.n('farmer'), h = g.n('heir');
      return [
        { t: `Give them to ${f}`, c: { med: -6 }, r: (g) => {
          g.loy('farmer', 10);
          if (g.chance(0.5)) { dead(g, g.s('heir')); g.loy('all', -2); return `${f} keeps the hand. ${h} dies on the fourth night. You were there. It did not help.`; }
          g.loy('heir', -15); return `${f} keeps the hand. ${h} pulls through alone, slowly, and knows exactly what you chose.`;
        } },
        { t: `Give them to ${h}`, c: { med: -6 }, r: (g) => {
          g.loy('heir', 8);
          if (g.chance(0.5)) { dead(g, g.s('farmer')); g.loy('all', -8, 'ideal'); return `${h} recovers. ${f} dies on the fourth night. The staff bury a colleague and notice whose family lived.`; }
          g.loy('farmer', -15); g.loy('not:farmer', -4, 'ideal'); return `${h} recovers. ${f} loses two fingers and keeps the hand. Nobody thanks you.`;
        } },
        { t: 'Split the course between them', c: { med: -6 }, r: (g) => {
          g.loy('doctor', -5);
          const a = g.chance(0.4), b = g.chance(0.4);
          if (a) dead(g, g.s('farmer'));
          if (b) dead(g, g.s('heir'));
          if (a || b) g.loy('all', -5, 'ideal');
          return 'The doctor tells you that is not how antibiotics work. ' + (a && b ? 'The doctor is right, twice.' : a ? `${h} lives. ${f} does not.` : b ? `${f} lives. ${h} does not.` : 'This once, by luck, the doctor is wrong.');
        } },
      ];
    },
  },
  {
    id: 'knock', title: 'Knocking', grim: true, when: (g) => g.st.day >= 3,
    text: () => 'Somebody is knocking on the outer hatch. They have been knocking for an hour.',
    choices: () => [
      { t: 'Open the hatch', c: { food: -5, med: 4 }, r: (g) => { g.loy('all', 5, 'ideal'); g.fear('all', -3); return 'A nurse, half dead, with a rucksack of supplies. One more mouth. The staff look at you differently for a day or two.'; } },
      { t: 'Do not open it', r: (g) => { g.loy('all', -4, 'ideal'); g.fear('all', 2); return 'The knocking goes on until about four in the morning. Then it stops.'; } },
      { t: 'Let the staff decide', c: { food: -5, med: 4 }, r: (g) => { g.loy('all', 3); g.fear('all', -6); return 'They open it. You notice that they did not wait for you to agree.'; } },
    ],
  },
  {
    id: 'memorial', title: 'A minute’s silence',
    text: () => 'The staff ask for a minute’s silence in the mess hall, for everyone who was left on the surface.',
    choices: () => [
      { t: 'Stand with them', r: (g) => { g.loy('all', 4, 'ideal'); g.fear('all', -3); return 'You stand at the back. It is a long minute. Some of the people they are thinking of were on your guest list.'; } },
      { t: 'Refuse. We do not look back', r: (g) => { g.loy('all', -4, 'ideal'); g.fear('all', 3); return 'They hold it anyway, in the laundry room, without you.'; } },
      { t: 'Lead it, with a few words', r: (g) => { g.loy('all', 3 * Math.pow(0.6, g.st.speeches)); g.st.speeches++; return 'The minute lasts eleven minutes, most of them yours.'; } },
    ],
  },
  // ------------------------------------------------------------------ the staff, grumbling upward
  {
    id: 'suggestions', title: 'The suggestion box',
    text: () => 'Suggestion box results: nine slips. Eight say "more food". One says "ABDICATE", in handwriting you nearly recognise.',
    choices: () => [
      { t: 'Have the handwriting checked', r: (g) => {
        g.loy('all', -3);
        const low = g.here().sort((a, b) => a.loyalty - b.loyalty)[0];
        if (!low || low.loyalty >= 50) return 'Every member of staff is made to write "ABDICATE" ten times. No match. Morale is poor.';
        const named = g.chance(0.75) ? low : g.pick(g.here());
        g.note(named, 'handwriting matched the "ABDICATE" slip');
        return `Every member of staff is made to write "ABDICATE" ten times. The closest match is ${named.first}, who says it is a common way to do a capital A.`;
      } },
      { t: 'Bigger portions for a week', c: { food: -7 }, r: (g) => { g.loy('all', 4); return 'The next week’s slips say "more pudding". This counts as progress.'; } },
      { t: 'Remove the box', r: (g) => { g.loy('all', -2); g.fear('all', 3); return 'The box goes. The suggestions carry on, in pencil, on the back of the lift door.'; } },
    ],
  },
  {
    id: 'portrait', title: 'The portrait',
    text: () => 'Your portrait in the mess hall has acquired a moustache. And, on closer inspection, horns.',
    choices: () => [
      { t: 'Find the artist', r: (g) => {
        g.loy('all', -3); g.fear('all', 5);
        const cands = g.here().filter((p) => p.stage >= 1);
        if (!cands.length) return 'Nobody confesses. Everybody’s hands are clean. Perhaps it was always there.';
        const named = g.chance(0.7) ? cands.sort((a, b) => b.stage - a.stage)[0] : g.pick(g.here());
        g.note(named, 'ink on their thumb the day the portrait was defaced');
        return `Nobody confesses. ${named.first} has ink on one thumb and a very calm face.`;
      } },
      { t: 'Laugh, and leave it', r: (g) => { g.loy('all', 4); g.fear('all', -4); return 'You say it is an improvement. The laugh that goes round the mess hall is real, and a little too long.'; } },
      { t: 'Commission a bigger portrait', c: { lux: 3 }, r: (g) => { g.loy('all', -3); return 'The new one is two metres tall and behind glass. The eyes follow people to the pudding counter.'; } },
    ],
  },
  {
    id: 'birthday', title: 'A birthday', from: 'cleaner',
    text: (g) => `It is ${g.n('cleaner')}’s birthday. Until this morning nobody on your floor knew the cleaner had a name.`,
    choices: () => [
      { t: 'Throw a small party', c: { food: -4 }, r: (g) => { g.loy('cleaner', 12); g.loy('all', 2); g.s('cleaner').noticed = g.st.day; return `There is cake. ${g.n('cleaner')} cries a little and then cleans up after the party.`; } },
      { t: 'Send a card, signed by your assistant', r: (g) => { g.loy('cleaner', -4); return `The card says "Happy Birthday, Agnus". ${g.n('cleaner')} keeps it anyway.`; } },
      { t: 'Let it pass', r: (g) => { g.loy('cleaner', -2); return 'The day passes. Your suite is spotless, as it always is, by itself.'; } },
    ],
  },
  {
    id: 'late_lunch', title: 'Lunch at four', from: 'chef', weight: (g) => (g.s('chef').stage >= 2 ? 2.5 : 0.7),
    text: (g) => `Lunch arrives at four in the afternoon. ${g.n('chef')} says the ovens are "in a mood".`,
    choices: () => [
      { t: 'Dock the kitchen’s rations', r: (g) => { g.loy('chef', -8, 'punish'); g.fear('all', 4); return 'Tomorrow lunch is on time, and so angry you can taste it.'; } },
      { t: 'Ask what is really wrong', r: (g) => { const p = g.s('chef'); const bad = p.stage >= 3; g.loy('chef', 5); p.noticed = g.st.day; return bad ? `${p.first} says everything is fine, and keeps hold of the knife while saying it.` : `${p.first} says the ovens are old and so is the cook. You believe it.`; } },
      { t: 'Eat it cold and say nothing', r: (g) => { g.fear('all', -3); return 'You eat cold soup at your desk. Word gets round that the boss can be kept waiting.'; } },
    ],
  },
  {
    id: 'heir_title', title: 'A title', from: 'heir',
    text: (g) => `${g.n('heir')} would like a title. "Vice-President of the Bunker" has been suggested, by ${g.n('heir')}.`,
    choices: () => [
      { t: 'Grant it', r: (g) => { g.s('heir').titled = true; g.loy('heir', 12); g.loy('not:heir', -3); return `${g.n('heir')} has cards printed. There is nobody to hand them to, so the staff each get three.`; } },
      { t: 'Refuse', r: (g) => { g.loy('heir', -8); return `${g.n('heir')} takes it badly, in the corridor, at volume.`; } },
      { t: 'Offer a real job: cleaner’s assistant', r: (g) => { g.loy('heir', -14); g.loy('not:heir', 5); const c = g.s('cleaner'); if (c) c.noticed = g.st.day; return `${g.n('heir')} mops one corridor, badly, in a silk shirt. The staff have not enjoyed anything so much in weeks.`; } },
    ],
  },
  {
    id: 'heir_party', title: 'A party', from: 'heir', when: (g) => g.st.day >= 5,
    text: (g) => `${g.n('heir')} has invited the staff to a party in your suite. You were not invited.`,
    choices: () => [
      { t: 'Shut it down', r: (g) => { g.loy('heir', -8); g.loy('not:heir', -3); g.fear('all', 3); return 'You turn the lights on at ten. Nine people file out past you holding your glasses.'; } },
      { t: 'Let it run', c: { lux: -5, food: -3 }, r: (g) => { g.loy('all', 4); g.unrest(3); return `It runs until three. They toast ${g.n('heir')}. Somebody calls ${g.n('heir')} "the fun one".`; } },
      { t: 'Turn up with the good wine', c: { lux: -7 }, r: (g) => { g.loy('all', 6); g.fear('all', -4); return 'You arrive with two cases and stay too long. By the end somebody has an arm round your shoulders.'; } },
    ],
  },
  {
    id: 'leak', title: 'A list on the table', from: 'pa',
    text: (g) => `Your full wine inventory has been found on a mess-hall table. ${g.n('pa')} says it must have "fallen out of a folder".`,
    choices: () => [
      { t: 'Say it is a forgery', r: (g) => { g.loy('all', anyGossip(g) ? -5 : -2); return 'You say it is a forgery. It is on your headed paper, in your handwriting, with your tasting notes.'; } },
      { t: 'Share a case, as if that was the plan', c: { lux: -4 }, r: (g) => { g.loy('all', 4); return '"I was going to surprise you all." Nobody believes it. Everybody drinks it.'; } },
      { t: `Move your assistant to filing`, r: (g) => { g.loy('pa', -10, 'punish'); g.fear('all', 3); return `${g.n('pa')} is moved to a desk with no door and no folders. They still know where everything is.`; } },
    ],
  },
  {
    id: 'memoirs', title: 'Chapter one', from: 'pa',
    text: (g) => `${g.n('pa')} has typed up the first chapter of your memoirs. It is called "The Benevolent Years".`,
    choices: () => [
      { t: 'Have it read aloud at dinner', r: (g) => { g.loy('all', -3); g.fear('all', 2); g.loy('pa', 3); return 'Forty minutes. Nobody leaves. Nobody is allowed to.'; } },
      { t: 'Ask what the staff really think of you', r: (g) => {
        const p = g.s('pa'), bad = g.here().filter((x) => x.stage >= 3).length;
        if (p.loyalty < 48) return `${p.first} smiles. "They adore you." ${p.first} has already picked up the next folder.`;
        return bad ? `${p.first} shuts the door first. "${bad === 1 ? 'One of them' : bad + ' of them'} would not be sorry to see you go. I can’t tell you who."` : `${p.first} thinks about it. "They complain. That’s all it is, for now."`;
      } },
      { t: 'Put it in a drawer', r: (g) => { g.loy('pa', -2); return 'Chapter one goes in a drawer, on top of your father’s.'; } },
    ],
  },
  {
    id: 'cleaner_intel', title: 'Better shoes', from: 'cleaner', when: (g) => g.st.day >= 4,
    text: (g) => `${g.n('cleaner')} goes everywhere and has noticed things. ${g.n('cleaner')} would also like better shoes.`,
    choices: () => [
      { t: 'Buy the shoes', c: { lux: -3 }, r: (g) => {
        const c = g.s('cleaner'); c.noticed = g.st.day; g.loy('cleaner', 4, 'gift');
        const p = top(g, 2, 'cleaner');
        if (c.loyalty < 40) { const q = g.pick(g.here().filter((x) => x.role !== 'cleaner' && x.stage < 2)) || p; if (!q) return `${c.first} says nobody is up to anything, and keeps the shoes.`; g.note(q, `${c.first} told you to watch them`); return `${c.first} says: "Watch ${q.first}." The shoes are a perfect fit.`; }
        if (!p) return `${c.first} says nobody is up to anything, and keeps the shoes.`;
        g.note(p, `${c.first} told you to watch them`);
        return `${c.first} says: "Watch ${p.first}." The shoes are a perfect fit.`;
      } },
      { t: 'You do not gossip with staff', r: (g) => { g.loy('cleaner', -5); return `${g.n('cleaner')} nods and goes on mopping, in a circle, round your feet.`; } },
    ],
  },
  {
    id: 'med_key', title: 'The medicine key', from: 'doctor',
    text: (g) => `${g.n('doctor')} wants to lock the medicine cabinet and keep the only key. "To stop the waste."`,
    choices: () => [
      { t: 'Hand over the only key', r: (g) => { const p = g.s('doctor'); if (p.loyalty >= 45) { g.res('med', 3); g.loy('doctor', 6); return 'The waste stops. The count is right, to the tablet, every week.'; } g.res('med', -5); g.loy('doctor', 2); return 'The cabinet is locked. A week later the count is wrong, and only one person can say why.'; } },
      { t: 'Keep a second key yourself', r: (g) => { g.loy('doctor', -4, 'punish'); return `${g.n('doctor')} hands you the copy without a word, holding it by the very end.`; } },
      { t: 'Give the key to security', need: (g) => !!g.s('security') || 'There is no head of security', r: (g) => { g.loy('doctor', -8, 'punish'); g.loy('security', 4); g.fear('all', 2); return 'Every aspirin now needs a signature and a salute.'; } },
    ],
  },
  // ------------------------------------------------------------------ organising
  {
    id: 'wellness', title: 'The Wellness Committee', weight: 1.6, when: (g) => g.st.unrest >= 26,
    text: () => 'A notice has gone up: the first meeting of the Staff Wellness Committee. The agenda has two items: "wellness" and "any other business".',
    choices: () => [
      { t: 'Ban it', r: (g) => { g.loy('all', -5); g.fear('all', 5); g.unrest(4); return 'The notice comes down. The meeting moves to the laundry room and gains two members.'; } },
      { t: 'Attend, and smile', r: (g) => { g.loy('all', 2); g.unrest(-6); const n = g.here().filter((p) => p.stage >= 3).length; return n ? `You sit through forty minutes about posture. ${n === 1 ? 'One person does' : n + ' people do'} not meet your eye the whole time.` : 'You sit through forty minutes about posture. It really is about posture.'; } },
      { t: 'Give it a budget', c: { lux: -4 }, r: (g) => { g.loy('all', 4); g.fear('all', -3); g.unrest(-14); return 'They buy a kettle and a noticeboard. "Any other business" is carried over to next time.'; } },
    ],
  },
  {
    id: 'spokesperson', title: 'A conversation', weight: 3, when: (g) => g.st.unrest >= 50 && !!top(g, 4),
    setup: (g) => { const p = top(g, 4); return p ? { role: p.role } : null; },
    text: (g, c) => `The staff have chosen someone to speak for them. It is ${g.n(c.role)}, who would like "a conversation".`,
    choices: () => [
      { t: 'Meet as equals', r: (g, c) => { g.loy('all', 4); g.fear('all', -6); g.unrest(-15); return `You pour two glasses. ${g.n(c.role)} brings a list. You agree to the small things and promise to think about the large ones.`; } },
      { t: 'Make an example of them', r: (g, c) => { const p = g.s(c.role); g.fear('all', 14); g.loy('all', -8); g.loy(p, -14, 'punish'); if (p.trait === 'proud') p.grudge = true; g.unrest(8); g.st.stats.examples++; return `${p.first} spends the night in the cold store. The conversation is over. The list is still pinned up.` + g.violate(['purges']); } },
      { t: 'Buy them, privately', c: { lux: -8 }, r: (g, c) => { g.loy(c.role, 14, 'gift'); if (g.chance(anyGossip(g) ? 0.55 : 0.3)) { g.loy('not:' + c.role, -6); g.unrest(8); return `${g.n(c.role)} takes the watch. By morning everyone knows the price, to the gram.`; } g.unrest(-8); return `${g.n(c.role)} takes the watch and loses the list. Nobody asks where either went.`; } },
    ],
  },
  // ------------------------------------------------------------------ the world outside
  {
    id: 'radio', title: 'A voice on the radio', when: (g) => g.st.day >= 4,
    text: () => 'The radio picks up a voice: another bunker, forty miles east. They have medicine and food to trade, by drone, and they drive a hard bargain.',
    choices: () => [
      { t: 'Send food, for medicine', c: { food: -8, med: 8 }, r: () => 'The drone comes back with a box of ampoules and a note: "Pleasure doing business. Is your hot tub really gold?"' },
      { t: 'Send wine and silver, for food', c: { lux: -6, food: 9 }, r: () => 'Nine tins of something labelled only "PROTEIN". The staff are grateful, in a guarded way.' },
      { t: 'Tell the staff there are other survivors', r: (g) => { g.loy('all', 4, 'ideal'); g.fear('all', -6); return 'There is cheering. Then, quite quickly, there is thinking: now there is somewhere else to go.'; } },
    ],
  },
  {
    id: 'geiger', title: 'The Geiger counter', when: (g) => g.st.day >= 18,
    text: () => 'The reading at the hatch is down again. The surface will be safe soon. You are the only one who has seen today’s number.',
    choices: () => [
      { t: 'Tell them the truth', r: (g) => { g.loy('all', 5, 'ideal'); g.fear('all', -6); return 'You pin the number up. People stand in front of it for a long time. They need you a little less than they did yesterday.'; } },
      { t: 'Keep it to yourself', r: (g) => { const p = g.s('pa'); if (p && p.loyalty < 50 && g.chance(0.5)) { g.loy('all', -6); return `You keep it to yourself. ${p.first} does not. By supper everyone knows the number, and that you hid it.`; } return 'You fold the slip into your pocket. Nobody asks.'; } },
      { t: 'Tell them it is getting worse', r: (g) => { g.fear('all', 7); if (g.chance(anyGossip(g) ? 0.4 : 0.2)) { g.loy('all', -8); return 'They are frightened for one day. Then somebody reads the counter for themselves.'; } return 'They are frightened, and frightened people are punctual.'; } },
    ],
  },
  // ------------------------------------------------------------------ harmless, or the last thing you do
  ambiguous({
    id: 'chef_special', title: 'The chef’s special', from: 'chef',
    text: (g) => `Dinner tonight is a new dish: ${g.n('chef')}’s own special, made only for you. ${g.n('chef')} will serve it in person.`,
    trust: 'Eat it', proxy: 'Have someone taste it first', decline: 'Send it back',
    trap: (g) => trap(g, 'killed_poison', 'You are sick for two days and nearly die on the bathroom floor. The doctor says "something you ate" and looks at the wall.'),
    fine: (g, p) => { g.loy(p, 8); p.noticed = g.st.day; g.res('lux', 2); return `It is the best thing you have eaten underground. ${p.first} stands by the table and watches every forkful, glowing.`; },
    caught: (g, p) => {
      const t = g.s('pa') || g.s('cleaner');
      g.expose(p, 'tried to poison you'); g.fear(p, 20);
      if (!t) return `You tip a spoonful into the fish tank. The fish stop. ${p.first} looks at the tank, and then at the door.`;
      dead(g, t); g.loy('all', -6); g.fear('all', 8);
      return `${t.first} takes one spoonful, says "almonds?" and sits down on the floor. ${t.first} does not get up. ${p.first} is still holding the ladle.`;
    },
    insult: (g, p) => { g.loy(p, p.trait === 'proud' ? -15 : -9); return `Your taster chews, swallows and says it is delicious. ${p.first} stands there while you wait ten minutes to be sure.`; },
    dodge: (g, p) => { g.loy(p, -2); return `The plate goes back untouched. ${p.first} scrapes it into the bin personally, and washes the bin.`; },
    snub: (g, p) => { g.loy(p, -6); return `The plate goes back untouched. ${p.first} eats it alone in the kitchen, with the door open, so you can see.`; },
  }),
  ambiguous({
    id: 'airlock', title: 'A quick inspection', from: 'engineer',
    text: (g) => `${g.n('engineer')} asks you to inspect the new airlock seal yourself. "It would mean a lot to the team. Two minutes. Just step inside."`,
    trust: 'Step inside', proxy: 'Send the head of security in instead', decline: 'Not today',
    proxyNeed: (g) => !!g.s('security') || 'There is no head of security',
    trap: (g) => trap(g, 'killed_accident', 'The inner door shuts and the outer one starts to open. You get your arm to the manual override with a second to spare. "Faulty relay," says the report.'),
    fine: (g, p) => { g.loy(p, 8); p.noticed = g.st.day; g.loy('all', 1); return `You step in, tap the seal and say "very good". ${p.first} has waited four years for somebody to look at the work.`; },
    caught: (g, p) => { const s = g.s('security'); g.expose(p, 'tried to stage an airlock accident'); g.fear(p, 20); g.loy(s, -8); g.fear('all', 6); return `${s.first} steps in. The inner door slams and the outer one starts to open. ${s.first} gets out, just, and has ${p.first} against the wall before the alarm stops.`; },
    insult: (g, p) => { g.loy(p, p.trait === 'proud' ? -14 : -8); return `${g.n('security')} inspects the seal and reports that it is a seal. ${p.first} had wanted you to see it.`; },
    dodge: (g, p) => { g.loy(p, -2); return `You are busy. ${p.first} says "another time, then", and logs the seal as "untested".`; },
    snub: (g, p) => { g.loy(p, -5); return `You are busy. ${p.first} had polished the door.`; },
  }),
  ambiguous({
    id: 'vitamin', title: 'A vitamin shot', from: 'doctor',
    text: (g) => `${g.n('doctor')} recommends a vitamin injection. For you, tonight. "You look tired. Everyone has remarked on it."`,
    trust: 'Roll up your sleeve', proxy: 'Ask the doctor to take the same shot first', decline: 'Decline',
    trap: (g) => trap(g, 'killed_dose', 'You wake up on the floor a day later. The doctor says you "reacted badly" and has already thrown the vial away.'),
    fine: (g, p) => { g.loy(p, 7); p.noticed = g.st.day; return `It is vitamins. You feel slightly better, and ${p.first} is pleased to have a patient who listens.`; },
    caught: (g, p) => { g.expose(p, 'tried to give you a lethal injection'); g.fear(p, 20); g.fear('all', 4); return `${p.first} looks at the syringe for a long time, puts it down and says nothing at all. That is your answer.`; },
    insult: (g, p) => { g.loy(p, p.trait === 'proud' ? -15 : -9); return `${p.first} injects their own arm without breaking eye contact, then gives you yours. It is vitamins.`; },
    dodge: (g, p) => { g.loy(p, -2); return `You say you feel fine. ${p.first} caps the syringe and puts it back in a pocket, not in the cabinet.`; },
    snub: (g, p) => { g.loy(p, -5); return `You say you feel fine. ${p.first} writes "refused treatment" in your file and underlines it.`; },
  }),
  ambiguous({
    id: 'master_keys', title: 'Master keys', from: 'security', realAt: 5,
    text: (g) => `${g.n('security')} wants master keys to every door in the bunker, yours included. "For efficiency. In an emergency I can’t be asking permission."`,
    trust: 'Hand over every key', proxy: 'Every key but the ones to your floor', decline: 'Refuse',
    trap: (g) => { g.end('deposed_lockout'); return ''; },
    fine: (g, p) => { g.loy(p, 8); g.fear('not:security', 8); return `${p.first} wears the keys on a ring at the hip. They can be heard coming from two corridors away. People straighten up.`; },
    caught: (g, p) => { g.note(p, 'asked for the keys to your own floor'); g.fear(p, 6); return `${p.first} takes the ring, counts the keys and finds yours missing. "As you like." The smile does not reach the eyes.`; },
    insult: (g, p) => { g.loy(p, p.trait === 'proud' ? -9 : -4); g.fear('not:security', 5); return `${p.first} takes the ring, counts the keys and notices which are missing. "Understood."`; },
    dodge: (g, p) => { g.loy(p, -3); return `You refuse. ${p.first} salutes, a fraction late.`; },
    snub: (g, p) => { g.loy(p, -7); g.fear('not:security', -3); return `You refuse. ${p.first} salutes. The staff hear that security asked and was told no.`; },
  }),
  {
    id: 'midnight_note', title: 'A note under your door', weight: 0.8, anon: true,
    setup: (g, c) => {
      const role = c && c.role ? c.role : (g.pick(g.here().filter((p) => ['pa', 'cleaner', 'farmer', 'heir'].includes(p.role))) || {}).role;
      const p = role && g.s(role);
      return p ? { role, real: p.stage >= 6 } : null;
    },
    text: () => 'A note under your door, unsigned: "The stores, midnight. Come alone. I know who is plotting against you."',
    choices: () => [
      { t: 'Go alone', r: (g, c) => {
        const p = g.s(c.role);
        if (c.real) return trap(g, 'killed_stairs', `Nobody is in the stores. On the way back somebody shoves you hard at the top of the stairwell. You catch the rail. You never see a face.`);
        const t = top(g, 3, c.role);
        g.loy(p, 5); p.noticed = g.st.day;
        if (!t) return `${p.first} is waiting among the crates. It turns out to be about the thermostat on level three. You promise to look into it.`;
        g.note(t, `${p.first} named them in the stores at midnight`);
        return `${p.first} is waiting among the crates, shaking. "It’s ${t.first}. I don’t know how far it has gone."`;
      } },
      { t: 'Go, with a guard two steps behind', need: (g) => !!g.s('security') || 'There is no head of security', r: (g, c) => {
        const p = g.s(c.role);
        if (c.real) { g.expose(p, 'waited for you at the top of the stairwell'); g.fear(p, 20); g.fear('all', 4); return `${p.first} is waiting at the top of the stairwell with a length of pipe. ${g.n('security')} gets there first.`; }
        g.loy(p, -6); g.fear(p, 6);
        return `${p.first} is waiting among the crates, sees the guard, and suddenly only wants to talk about the thermostat.`;
      } },
      { t: 'Burn the note', r: (g, c) => { if (!c.real) g.loy(c.role, -4); return 'You burn it in the ashtray and lock your door twice. Nobody mentions it at breakfast.'; } },
    ],
  },
  // ------------------------------------------------------------------ a quiet day
  {
    id: 'quiet', title: 'A quiet day', repeat: true, weight: 0.5,
    setup: (g) => ({ v: Math.floor(g.rand() * 3) }),
    text: (g, c) => ['Nothing happens today. You find this suspicious.', 'No memos. No complaints. The lift arrives when you call it.', 'A day with nothing in the diary. Down here that is either peace or planning.'][c.v],
    choices: () => [
      { t: 'Spend it in the cinema', c: { power: -1, lux: 1 }, r: () => 'Two films and a nap. You have earned it, you decide.' },
      { t: 'Walk the floors', r: (g) => {
        g.fear('all', 2);
        const p = g.pick(g.here());
        if (!p) return 'You walk the floors. They are very quiet.';
        const sure = ['seems glad to see you.', 'has a complaint ready, and delivers it.', 'is not at their post. You find them eventually.', 'stops what they are doing a little too quickly.', 'has pockets that clink.', 'is deep in a whispered conversation that ends when you appear.', 'watches you all the way to the lift.'][p.stage];
        p.rumour = { text: `Seen for yourself: ${p.first} ${sure}`, day: g.st.day, sig: p.stage };
        return `You walk every floor, unannounced. ${p.first} ${sure}`;
      } },
      { t: 'Help in the kitchen for an hour', r: (g) => { g.loy('all', 2); g.fear('all', -2); return 'You peel eleven potatoes, badly. It is talked about for days.'; } },
    ],
  },
  // ------------------------------------------------------------------ promises falling due (not drawn from the deck)
  {
    id: 'promise_due', title: 'A promise falls due', system: true,
    text: (g, c) => {
      const pr = g.promise(c.i);
      const why = { rations: 'From today your table and theirs are meant to be the same.', cameras: 'The staff are waiting for the cameras to come down.', vote: 'The ballot box has been made, out of a wine crate. It is on the mess-hall table.', bunk: 'The good bunk is empty and somebody is waiting to be told to move in.', wages: 'It is pay day. Wages down here are wine and tinned fruit, out of your stores.' }[pr.type] || '';
      return `You promised: "${g.promiseText(c.i)}." ${why}`;
    },
    choices: (g, c) => {
      const pr = g.promise(c.i);
      const cost = pr.type === 'bunk' ? { lux: -8 } : pr.type === 'wages' ? { lux: -6 } : {};
      return [
        { t: pr.type === 'vote' ? 'Keep it: call the vote for tomorrow' : 'Keep it', c: cost, r: (g, c) => g.keep(c.i) || 'You keep your word. People notice. It will count for something.' },
        { t: 'Break it', r: (g, c) => { g.breakP(c.i); return 'You explain that circumstances have changed. They listen to the whole explanation. Your word is worth less now.'; } },
        { t: 'Quietly forget it', r: (g, c) => { g.forget(c.i); return 'You say nothing. The day passes. Nobody mentions it. Yet.'; } },
      ];
    },
  },
  {
    id: 'promise_reminded', title: 'Somebody remembers', system: true,
    setup: (g, c) => {
      if (!g.promise(c.i) || g.promise(c.i).state !== 'forgotten') return null;
      const who = g.here().find((p) => p.trait === 'gossip') || g.pick(g.here());
      return who ? { i: c.i, role: who.role } : null;
    },
    text: (g, c) => `At dinner ${g.n(c.role)} asks, loudly and politely, whatever happened to "${g.promiseText(c.i)}". Every head turns towards you.`,
    choices: (g, c) => {
      const pr = g.promise(c.i);
      const cost = pr.type === 'bunk' ? { lux: -8 } : pr.type === 'wages' ? { lux: -6 } : {};
      return [
        { t: 'Keep it now, late', c: cost, r: (g, c) => { g.loy('all', -3); return (g.keep(c.i, true) || 'Done.') + ' It would have meant more on the day.'; } },
        { t: 'Admit it is not going to happen', r: (g, c) => { g.breakP(c.i, 1.3); return 'You say it out loud at last. The room had already guessed. That does not make it better.'; } },
      ];
    },
  },
  {
    id: 'crisis', system: true, grim: true,
    title: (g, c) => ({ food: 'The larder is empty', water: 'The tanks are dry', power: 'The generator has stopped' }[c.k]),
    setup: (g, c) => (g.st.res[c.k] <= 0.5 ? c : null),
    text: (g, c) => ({
      food: 'There is nothing on the shelves but your own private larder and the smell of the last tin. Nine people are looking at you.',
      water: 'The taps cough and stop. The only water left in the silo is in your hot tub, your ice bucket and the crop beds.',
      power: 'The fans have stopped and the lights are on the emergency circuit. The air on the lower levels is already thick.',
    }[c.k]),
    choices: (g, c) => ({
      food: [
        { t: 'Empty your private larder into the kitchen', c: { lux: -8, food: 9 }, r: (g) => { g.loy('all', 3, 'ideal'); return 'Caviar, crackers and four hundred sugared almonds. It is a strange week of dinners, but it is dinners.'; } },
        { t: 'Buy food from the bunker to the east, at their price', c: { med: -8, food: 9 }, r: () => 'The drone takes your medicine and brings back tins. They know how hungry you are, and charged for it.' },
        { t: 'Halve the staff rations', c: { food: 4 }, r: (g) => { g.st.flags.rationCut = g.st.day + 8; g.loy('all', -8); return 'Half portions. People count each other’s spoonfuls. Nobody counts yours, because nobody is allowed to see it.'; } },
      ],
      water: [
        { t: 'Drain the hot tub and the ice room into the tanks', c: { lux: -8, water: 10 }, r: (g) => { g.loy('all', 2, 'ideal'); return 'It all goes down the pipe: the tub, the ice, the water from the vases. The taps run again.'; } },
        { t: 'Shut the farm taps and let a crop die', c: { food: -8, water: 10 }, r: (g) => { g.loy('farmer', -6); return 'The beds go dry and a month of vegetables goes with them. The taps run again.'; } },
        { t: 'One cup each a day', c: { water: 5, med: -2 }, r: (g) => { g.loy('all', -8); return 'One cup. People lick the condensation off the pipes. Your own cup is noticeably larger.'; } },
      ],
      power: [
        { t: 'Strip your suite for cable and fuel', c: { lux: -8, power: 10 }, r: (g) => { g.loy('all', 2, 'ideal'); return 'The chandelier, the wine fridge and the cinema projector go into the generator room. The fans start to turn.'; } },
        { t: 'Burn the medical spirit', c: { med: -8, power: 9 }, r: (g) => { g.loy('doctor', -5); return 'It burns clean and blue. The fans turn. The medicine cabinet echoes.'; } },
        { t: 'Shut down the staff levels at night', c: { power: 5 }, r: (g) => { g.loy('all', -8); return 'No light, no heat and stale air on the staff levels from ten until six. Your floor hums gently all night.'; } },
      ],
    }[c.k]),
  },
  {
    id: 'vote', title: 'Ballot day', system: true,
    text: () => 'Ballot day. One question on the slip: "Should the current management continue?" The box is a wine crate with a slot sawn in it.',
    choices: () => [
      { t: 'Count it honestly, in front of everyone', r: (g) => {
        const b = g.ballot();
        if (!b.win) { g.end('deposed_vote'); return ''; }
        g.loy('all', 5); g.fear('all', -5); g.unrest(-30);
        return `${b.yes} for, ${b.no} against, counting your own. You win, in the open. For the first time they are your staff because they said so.`;
      } },
      { t: 'Count it yourself, in your suite', r: (g) => {
        const pa = g.s('pa');
        if (g.chance(0.3 + (anyGossip(g) ? 0.2 : 0) + (pa && pa.loyalty < 45 ? 0.2 : 0))) { g.loy('all', -16, 'ideal'); g.unrest(25); return 'You announce a landslide. Then somebody finds the real slips in your waste-paper basket, and counts those.'; }
        g.loy('all', 3); g.unrest(-12);
        return 'You announce a landslide. Nobody asks to see the slips. A few people look as if they would like to.';
      } },
      { t: 'Cancel it', r: (g) => { const i = g.st.promises.findIndex((p) => p.type === 'vote'); if (i >= 0) { if (g.st.promises[i].state === 'kept') g.st.stats.kept--; g.st.promises[i].state = 'owed'; g.breakP(i, 1.4); } return 'You cancel the vote "for security reasons". The wine crate stays on the table for days. Nobody moves it.'; } },
    ],
  },
  {
    id: 'mutiny', title: 'Mutiny', system: true, grim: true,
    setup: (g) => { const p = top(g, 0); return p ? { role: p.role, floor: { security: 'the security level', chef: 'the kitchens', engineer: 'the plant level', doctor: 'the medical level', farmer: 'the farm', pa: 'the lift to your floor', cleaner: 'the stores', heir: 'your own suite' }[p.role] } : null; },
    text: (g, c) => `They have taken ${c.floor}. The doors are barricaded from the inside and ${g.n(c.role)} is speaking for them on the intercom. They want equal rations, the cameras out, and a vote.`,
    choices: () => [
      { t: 'Negotiate', r: (g, c) => {
        if (g.st.stats.broken >= 2) { g.end(g.deposed()); return ''; }
        const has = (t) => g.st.promises.some((p) => p.type === t && p.state !== 'broken');
        if (!has('rations')) g.makePromise('rations');
        if (!has('vote') && g.st.day + 8 <= 30) g.makePromise('vote');
        for (const p of g.faction()) { p.stage = 3; p.loyalty = Math.min(100, p.loyalty + 8); }
        g.fear('all', -15); g.st.unrest = 45; g.st.flags.mutinyCool = g.st.day + 6;
        return `You talk for six hours through a steel door. You come away having promised nearly everything. The barricade comes down. ${g.n(c.role)} shakes your hand like somebody taking a receipt.`;
      } },
      { t: 'Send in the guards', r: (g, c) => {
        const s = g.s('security'), lead = g.s(c.role);
        if (s && s.stage < 4 && s.loyalty >= 40 && s !== lead) {
          dead(g, lead); g.res('med', -6);
          for (const p of g.faction()) { p.stage = 2; p.fear = Math.min(100, p.fear + 30); p.loyalty = Math.max(0, p.loyalty - 10); }
          g.fear('all', 15); g.st.unrest = 40; g.st.flags.mutinyCool = g.st.day + 6;
          return `${s.first} takes the floor back in four minutes. ${lead.first} does not survive the stairwell. Everyone goes back to work. Nobody talks at dinner, or for some days after.` + g.violate(['purges']);
        }
        g.end(g.avgLoyalty() < 24 ? 'killed_mutiny' : g.deposed());
        return '';
      } },
      { t: 'Step down', r: (g) => { g.end(g.deposed()); return ''; } },
    ],
  },
];

export const EVENTS = Object.fromEntries(list.map((e) => [e.id, e]));
