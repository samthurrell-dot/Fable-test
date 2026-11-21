// data/requests.js
// Requests (round 6): something one of the staff asks of you, which takes several days to deliver.
// Pure data; the rules are in engine/sim.js (requestView, answer, workOn, and the night in endDay).
//
// A request waits RULES.REQ_WAIT days for an answer. You may:
//   promise it  it becomes a job: `steps` parts, at most one part a day, each costing `part`
//               (stores, or 'time': one of your card plays), all done by the end of `days` days;
//   the third answer (alt)   funny, selfish or absurd; settled at once;
//   refuse      the asker takes it badly.
// Kept (every part done in time): the asker, their friend and everyone else think better of you,
//   and you get `perk` for good. Broken (the time runs out): they think much worse, the asker climbs
//   a step towards removing you, and `fallout` happens.
//
// perk:    { night: {res: a night}, flag, opu, loyAll, fear, unrest, friendBoost, card, titled, noticed (days the
//            asker feels noticed), delay (project nights) }
// fallout: { res: {res: once}, flag + days, strike (the project under way stops for 2 nights),
//            plain: nights you must live plainly, lostPlay (one fewer play tomorrow), unrest, loyAll, opu }
// role: 'any' means whoever is unhappiest asks; when: (g) => may it be asked now.

export const REQUESTS = {
  // --- security ---
  patrols: {
    role: 'security', title: 'Night patrols', steps: 3, days: 5, part: { power: -3 },
    text: (n) => `${n} wants night patrols, with the corridor lights left on. “People sleep better when they hear boots.”`,
    perk: { flag: 'patrols' }, perkText: 'Fewer desertions, and fear fades more slowly',
    keep: 'Boots in the corridor at two and at four. Nobody tries the airlock any more. Nobody sleeps much either.',
    fallout: { flag: 'lax', days: 5 }, falloutText: 'Security stops working for 5 days',
    fail: (n) => `${n} has stopped doing the rounds. “The lights were never left on. So.”`,
    alt: { t: 'Patrol once yourself, in a dressing gown', c: { opu: -3 }, r: (g, p) => { g.fear('all', 3); g.loy(p, -2); return `You walk the corridors at two in the morning with a torch, held the wrong way round. ${p.first} follows you at a distance, not helping.`; } },
    no: (n) => `${n} salutes and writes something down.`,
  },
  drill: {
    role: 'security', title: 'Self-defence classes', steps: 3, days: 5, part: 'time',
    text: (n) => `${n} wants to teach everyone self-defence, using you as the dummy. “Against what?” you ask. “Exactly.”`,
    perk: { loyAll: 2, fear: 5 }, perkText: 'Everyone likes you more, and fears you more',
    keep: 'Three sessions. You are thrown, pinned and choked, very politely. Everyone has enjoyed it enormously.',
    fallout: { loyAll: -2, unrest: 6 }, falloutText: 'They train on a photo of you instead',
    fail: (n) => `${n} runs the classes anyway. The target has your face pinned to it. Attendance is excellent.`,
    alt: { t: 'Make it compulsory; you referee', c: { opu: 4 }, r: (g, p) => { g.fear('all', 6); g.loy('all', -3); return 'You sit on a high chair with a whistle and award points for style. Nobody is allowed to win.'; } },
    no: (n) => `${n} punches the doorframe, carefully, to show what you are missing.`,
  },
  // --- chef ---
  roast: {
    role: 'chef', title: 'A Sunday roast', steps: 3, days: 5, part: { food: -6 },
    text: (n) => `${n} wants to cook everyone a proper Sunday roast. Nobody down here knows what day it is. ${n} has decided it is Sunday.`,
    perk: { loyAll: 1, unrest: -10 }, perkText: 'The bunker calms right down',
    keep: 'The roast comes out on a door laid over two filing cabinets. Somebody cries into the gravy. It is a good day.',
    fallout: { plain: 2 }, falloutText: '2 nights eating staff rations',
    fail: (n) => `There is no roast. ${n} serves you what the staff eat, for two nights, on your best china.`,
    alt: { t: 'Eat it alone, door open', c: { food: -4 }, gain: { opu: 6 }, r: (g, p) => { g.loy('all', -4); g.loy(p, -4); return 'You eat the whole thing slowly, at the long table, with the door open. The smell reaches every floor.'; } },
    no: (n) => `${n} makes the soup instead. It is grey, and served with a look.`,
  },
  herbs: {
    role: 'chef', title: 'A kitchen garden', steps: 2, days: 4, part: { water: -6 },
    text: (n) => `${n} wants to grow herbs in the kitchen. “Basil changes people.”`,
    perk: { night: { food: 0.8 } }, perkText: '+0.8 food every night',
    keep: 'Basil, mint and something nobody can identify. Meals taste of something. People linger at dinner.',
    fallout: { res: { food: -6 } }, falloutText: 'A tantrum in the stores: lose 6 food',
    fail: (n) => `The seedlings died of thirst. ${n} cleared out the whole shelf in a temper, and some of the tins with it.`,
    alt: { t: 'Name it after you; sell the basil', gain: { lux: 3 }, r: (g, p) => { g.loy(p, -5); return 'The Garden of the Founder opens with a ribbon. Basil is two luxury a leaf. Sales are slow.'; } },
    no: (n) => `${n} puts the seed packets back in a drawer and shuts it hard.`,
  },
  // --- engineer ---
  workshop: {
    role: 'engineer', title: 'A proper workshop', steps: 3, days: 6, part: { lux: -4 },
    text: (n) => `${n} wants a proper workshop. “Then I can build your things faster.”`,
    perk: { flag: 'workshop' }, perkText: 'Every project needs one part fewer',
    keep: 'The workshop is finished. It has a pegboard with an outline drawn round every tool. Nkem stands and looks at it for a long time.',
    fallout: { strike: true, res: { power: -6 } }, falloutText: 'Work to rule: the project needs 2 more parts; lose 6 power',
    fail: (n) => `${n} is working to rule. The rule book is long, and the project waits.`,
    alt: { t: 'Give them a certificate instead', r: (g, p) => { g.loy(p, -3); g.unrest(-2); return `The certificate says “Engineer of Excellence” in gold. ${p.first} puts it up in the plant room, upside down.`; } },
    no: (n) => `${n} nods slowly, looking at your cinema projector the whole time.`,
  },
  plantroom: {
    role: 'engineer', title: 'Come and see the plant room', steps: 2, days: 4, part: 'time',
    text: (n) => `${n} wants you to visit the plant room. Twice. “So you know what keeps you alive.”`,
    perk: { flag: 'maintained', night: { power: 0.5 } }, perkText: 'Half as many breakdowns; +0.5 power a night',
    keep: 'Two afternoons among the pipes. You understand none of it, and say so, and that seems to be the right answer.',
    fallout: { res: { power: -6 } }, falloutText: 'They stop telling you things: lose 6 power',
    fail: (n) => `${n} has stopped explaining things. The generator now makes a noise nobody mentions.`,
    alt: { t: 'Send a portrait of yourself', c: { opu: -2 }, r: (g, p) => { g.loy(p, -2); return `The portrait goes up over the boiler. It watches ${p.first} work. It is the most attention the plant room has had.`; } },
    no: (n) => `${n} says it was only an idea, and goes back down alone.`,
  },
  // --- doctor ---
  checkups: {
    role: 'doctor', title: 'Check-ups for everyone', steps: 3, days: 5, part: { med: -4 },
    text: (n) => `${n} wants to give everyone a proper check-up.`,
    perk: { loyAll: 1, night: { med: 0.4 } }, perkText: 'Everyone likes you more; +0.4 medicine a night',
    keep: 'Everyone is weighed, prodded and told to drink more water. They rather enjoy the attention.',
    fallout: { strike: true, loyAll: -1 }, falloutText: 'Everyone signed off sick: the project needs 2 more parts',
    fail: (n) => `${n} has written everyone a sick note, with a diagnosis of “overtime”.`,
    alt: { t: 'Check-ups for you only, daily', c: { med: -3 }, gain: { opu: 3 }, r: (g, p) => { g.loy(p, -4); return 'Your blood pressure is taken eleven times. It is perfect. You ask for it to be announced.'; } },
    no: (n) => `${n} puts the stethoscope away, slowly.`,
  },
  snoring: {
    role: 'doctor', title: 'A study of your snoring', steps: 2, days: 4, part: 'time',
    text: (n) => `${n} says your snoring is now a structural risk to the silo, and wants to study it.`,
    perk: { opu: 8 }, perkText: '+8 opulence: you sleep like a world leader',
    keep: 'The findings are in: you sleep like a world leader. The report is framed. The snoring continues.',
    fallout: { opu: -8, unrest: 4 }, falloutText: '−8 opulence: the tapes are played at dinner',
    fail: (n) => `${n} plays the recordings at dinner. People laugh in a way they never laugh at you.`,
    alt: { t: 'Declare it a protected sound', gain: { opu: 3 }, r: (g, p) => { g.loy(p, -3); return 'A notice goes up: the Founder’s breathing is part of the bunker’s heritage. Earplugs are confiscated.'; } },
    no: (n) => `${n} says nothing, and moves the medical bay’s bed further from the wall.`,
  },
  // --- farmer ---
  seedlings: {
    role: 'farmer', title: 'Water for the seedlings', steps: 4, days: 6, part: { water: -4 },
    text: (n) => `${n} needs extra water for the new seedlings. “Food in a month. Or not.”`,
    perk: { night: { food: 1.0 } }, perkText: '+1 food every night',
    keep: 'The seedlings stand up straight. So, for the first time in a while, does the farmer.',
    fallout: { res: { food: -10 } }, falloutText: 'The crop fails: lose 10 food',
    fail: (n) => `The seedlings have died. ${n} pulled up the whole row and laid it outside your door.`,
    alt: { t: 'Use your old bath water', c: { opu: -2 }, r: (g, p) => { g.loy(p, 2); g.res('food', 2); return 'Your bath water goes down in buckets. It is mostly bubble bath. The seedlings are confused, but alive.'; } },
    no: (n) => `${n} waters them with a pipette, where you can see.`,
  },
  lamp: {
    role: 'farmer', title: 'A lamp from your suite', steps: 2, days: 3, part: { opu: -6 },
    text: (n) => `${n} wants the lamps from your suite as grow lights. You would read by the fridge.`,
    perk: { night: { food: 0.6 } }, perkText: '+0.6 food every night',
    keep: 'Your lamps now shine on a bed of lettuces. They are doing very well. You read by the fridge.',
    fallout: { res: { food: -5 } }, falloutText: 'The lettuces die: lose 5 food',
    fail: (n) => `The lettuces have given up. ${n} has stopped asking for things.`,
    alt: { t: 'Send a painting of a lamp', r: (g, p) => { g.loy(p, -4); return `The painting is very good. The lettuces do not notice it. ${p.first} does.`; } },
    no: (n) => `${n} looks at your chandelier for some time before leaving.`,
  },
  // --- personal assistant ---
  filing: {
    role: 'pa', title: 'A filing system', steps: 3, days: 5, part: 'time',
    text: (n) => `${n} wants an hour of your time to sort your papers. Some of them are on fire.`,
    perk: { flag: 'filing' }, perkText: 'Every project costs 3 less luxury',
    keep: 'Everything is filed. You have a drawer marked “Plans” and a drawer marked “Other plans”. Quotes come in cheaper.',
    fallout: { lostPlay: true }, falloutText: 'Your diary is lost: 1 fewer play tomorrow',
    fail: (n) => `${n} has filed your diary under “fiction”. Tomorrow is a mystery to everyone.`,
    alt: { t: 'Make the cleaner do it, unpaid', r: (g, p) => { const c = g.s('cleaner'); if (c) g.loy(c, -4); g.loy(p, -2); return 'The papers are filed by colour. Your will is now under “beige”.'; } },
    no: (n) => `${n} reads you tomorrow’s diary in a very level voice.`,
  },
  evenings: {
    role: 'pa', title: 'Three evenings off', steps: 3, days: 6, part: { opu: -4 },
    text: (n) => `${n} wants three evenings without you in them.`,
    perk: { loyAll: 1, friendBoost: 4 }, perkText: 'Your assistant and their friend warm to you for good',
    keep: 'Three evenings. You find your own slippers and pour your own drink. It takes forty minutes and you are proud of it.',
    fallout: { unrest: 6, loyAll: -1 }, falloutText: 'Your assistant tells everyone what you are like',
    fail: (n) => `${n} spent the evening telling everyone exactly what you are like before breakfast.`,
    alt: { t: 'One evening off; ring hourly', gain: { opu: 2 }, r: (g, p) => { g.loy(p, -3); return `You ring at eight, nine, ten and eleven. ${p.first} answers every time, in a voice you have not heard before.`; } },
    no: (n) => `${n} says “of course”, and means something else.`,
  },
  // --- cleaner ---
  thanks: {
    role: 'cleaner', title: 'A public thank-you', steps: 3, days: 6, part: 'time',
    text: (n) => `${n} would like to be thanked at dinner. By name. Three times.`,
    perk: { noticed: 12, loyAll: 1 }, perkText: 'The cleaner feels noticed for 12 days',
    keep: 'Three dinners, three speeches. You get the name right every time. People look at you as if you were a new person.',
    fallout: { opu: -8 }, falloutText: 'Your suite goes uncleaned: −8 opulence',
    fail: (n) => `${n} has stopped cleaning your suite. Visitors notice the smell before they notice the art.`,
    alt: { t: 'Thank them once, wrong name', gain: { opu: 1 }, r: (g, p) => { g.loy(p, -6); g.loy('not:cleaner', 1); return `You stand up and thank “Annie” for all her hard work. ${p.first} smiles, a little.`; } },
    no: (n) => `${n} had not really expected it.`,
  },
  mops: {
    role: 'cleaner', title: 'New mop heads', steps: 2, days: 4, part: { lux: -3 },
    text: (n) => `${n} needs new mop heads. There are some in your stores, still wrapped.`,
    perk: { night: { med: 0.3 } }, perkText: '+0.3 medicine a night',
    keep: 'The mop heads arrive. They are unwrapped like presents. The floors shine; fewer people get ill.',
    fallout: { res: { med: -5 } }, falloutText: 'Something spreads: lose 5 medicine',
    fail: (n) => `${n} is mopping with something that was once a mop. Something is going round the bunks.`,
    alt: { t: 'Hand over your silk ties', c: { opu: -1 }, r: (g, p) => { g.loy(p, 3); return 'The floors are now mopped with Italian silk. They streak. It is the most glamorous cleaning in the world.'; } },
    no: (n) => `${n} goes on mopping with something that was once a mop.`,
  },
  // --- family ---
  title: {
    role: 'heir', title: 'A title, with a ceremony', steps: 3, days: 5, part: { lux: -4 },
    text: (n) => `${n} wants a title. A real one, with a sash, a ceremony and a cake.`,
    perk: { titled: true, opu: 6 }, perkText: 'Your family is satisfied for good; +6 opulence',
    keep: 'The ceremony has a sash, a cake, a short film and a long speech. Your family is now the Lord High Steward of Silo 7.',
    fallout: { opu: -8, unrest: 6 }, falloutText: 'They call themselves Co-Founder: −8 opulence',
    fail: (n) => `${n} has made their own badge. It says “Co-Founder”. Everyone has been told.`,
    alt: { t: 'Vice-Admiral of the Pantry', gain: { opu: 2 }, r: (g, p) => { g.loy(p, 2); return `${p.first} accepts at once, and starts inspecting the tins.`; } },
    no: (n) => `${n} slams a door that was built to survive a missile.`,
  },
  podcast: {
    role: 'heir', title: 'Funding for a podcast', steps: 3, days: 6, part: { lux: -6 },
    text: (n) => `${n} wants to start a podcast. There is no internet. ${n} does not care.`,
    perk: { night: { opu: 1 }, card: 'broadcast' }, perkText: '+1 opulence a night, and a new card',
    keep: 'The podcast launches. It has seven listeners, all in this silo, and they are all you. It is very flattering.',
    fallout: { unrest: 10, opu: -6 }, falloutText: 'They make it anyway, about you',
    fail: (n) => `${n} has made the podcast anyway, on a dictaphone. Episode one is about you. It is played in the mess hall.`,
    alt: { t: 'Agree, if you are the only guest', gain: { opu: 3 }, r: (g, p) => { g.loy(p, -3); return 'You record eleven episodes in one afternoon. Each is an interview with yourself. You ask very good questions.'; } },
    no: (n) => `${n} tells everyone you are mean. Everyone already had a view.`,
  },
  // --- anyone, while a project is under way ---
  overtime: {
    role: 'any', title: 'Overtime pay', steps: 2, days: 3, part: { lux: -6 }, when: (g) => !!g.st.project,
    text: (n) => `${n} asks, for everyone building your project, whether overtime might be paid. In anything.`,
    perk: { flag: 'union' }, perkText: 'Overtime upsets people half as much',
    keep: 'Overtime is paid, in tinned peaches. A rota goes up. People complain about the rota instead of you.',
    fallout: { strike: true, loyAll: -2 }, falloutText: 'A strike: the project needs 2 more parts',
    fail: () => 'The staff have downed tools. Somebody has painted a sign. The spelling is perfect.',
    alt: { t: 'Pay in signed photos of you', gain: { opu: 2 }, r: (g, p) => { g.loy('all', -1); return 'Everyone gets a signed photograph. You have signed it “with love”. Several are already in the bin.'; } },
    no: (n) => `${n} carries your answer back down the stairs like something that might go off.`,
  },
  restday: {
    role: 'any', title: 'A day off from your project', steps: 1, days: 2, part: 'time', when: (g) => !!g.st.project && g.st.project.left >= 2,
    text: (n) => `${n} asks for one day off from your project, for everyone. You would cover the morning yourself.`,
    perk: { loyAll: 2, delay: 1 }, perkText: 'Everyone likes you more; the project needs 1 more part',
    keep: 'You put on a hard hat and stand near the project for a morning, pointing at things. Everyone else sleeps. It goes down well.',
    fallout: { loyAll: -2, unrest: 4 }, falloutText: 'They take it anyway, and say whose fault it was',
    fail: () => 'Nobody turned up to work on the project this morning. Somebody has left a note on it. The note is about you.',
    alt: { t: 'Grant it; dock their lunch', c: {}, r: (g) => { g.res('food', 4); g.loy('all', -2); g.fear('all', 2); return 'The day off is granted. Lunch is not.'; } },
    no: (n) => `${n} goes back to work. Everyone works a little more slowly.`,
  },
};
