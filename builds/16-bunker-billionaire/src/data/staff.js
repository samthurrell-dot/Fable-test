// data/staff.js
// The eight named staff, the traits that change how they react, and what each of them wants.
// Pure data plus small test functions on the game state. No DOM.

export const ROLE_ORDER = ['security', 'chef', 'engineer', 'doctor', 'farmer', 'pa', 'cleaner', 'heir'];

const avg = (list, f) => (list.length ? list.reduce((a, p) => a + f(p), 0) / list.length : 0);

export const ROLES = {
  security: {
    title: 'Head of security', the: 'the head of security', name: 'Ilse Voss', first: 'Ilse', post: 'security',
    keeps: 'Guards, cameras, punishments', danger: 'Can lock you out of your own bunker',
    want: 'Order. People should be a little afraid.',
    wantMet: (st) => avg(st.staff.filter((p) => p.status === 'ok' && p.role !== 'security'), (p) => p.fear) >= 34,
  },
  chef: {
    title: 'Chef', the: 'the chef', name: 'Bruno Sarto', first: 'Bruno', post: 'kitchen',
    keeps: 'Food and your meals', danger: 'Poisoning',
    want: 'A full larder.',
    wantMet: (st) => st.res.food >= 30,
  },
  engineer: {
    title: 'Engineer', the: 'the engineer', name: 'Nkem Okafor', first: 'Nkem', post: 'plant',
    keeps: 'Power, air, water', danger: 'Sabotage that looks like an accident',
    want: 'Enough power to do the job properly.',
    wantMet: (st) => st.res.power >= 28,
  },
  doctor: {
    title: 'Doctor', the: 'the doctor', name: 'Hana Lindqvist', first: 'Hana', post: 'medical',
    keeps: 'Medicine', danger: 'Withholds treatment, or worse',
    want: 'A medicine cabinet that is not empty.',
    wantMet: (st) => st.res.med >= 16,
  },
  farmer: {
    title: 'Farmer', the: 'the farmer', name: 'Tomás Reyes', first: 'Tomás', post: 'farm',
    keeps: 'Crops', danger: 'Slow starvation',
    want: 'Water for the crops before water for anything else.',
    wantMet: (st) => st.res.water >= 28,
  },
  pa: {
    title: 'Personal assistant', the: 'your assistant', name: 'Priya Nair', first: 'Priya', post: 'suite',
    keeps: 'Your schedule and secrets', danger: 'Leaks everything',
    want: 'To work for someone who still looks rich.',
    wantMet: (st) => st.res.lux >= 22,
  },
  cleaner: {
    title: 'Cleaner', the: 'the cleaner', name: 'Agnes Pell', first: 'Agnes', post: 'medical',
    keeps: 'Goes everywhere unnoticed', danger: 'Perfect spy, for either side',
    want: 'To be noticed, once in a while.',
    wantMet: (st, p) => st.day - (p.noticed ?? -99) <= 8,
  },
  heir: {
    title: 'Family', the: 'your family', name: 'Caspian', first: 'Caspian', post: 'suite',
    keeps: 'Nothing useful', danger: 'Thinks they should be in charge',
    want: 'Comfort, and a title.',
    wantMet: (st, p) => st.res.lux >= 30 || !!p.titled,
  },
};

// Who is at the hatch. For each job you let one of these in. skill multiplies how well the job is
// done (and, for the assistant and the cleaner, how good your information is; for security, how
// slowly fear fades). loyalty and fear are added to the starting card's. bring: stores they arrive
// with. nightly: what they add to or take from your opulence, luxury or food each night.
export const CANDIDATES = {
  security: [
    { name: 'Ilse Voss', first: 'Ilse', trait: 'proud', skill: 1.25, loyalty: -8, was: 'Military police, twenty years.', pro: 'Guards who obey. Fear fades slowly.', con: 'Proud. Thinks the bunker needs a real commander.' },
    { name: 'Dima Orlov', first: 'Dima', trait: 'greedy', skill: 0.8, loyalty: 9, was: 'The doorman at your club.', pro: 'Loyal, and cheap to keep loyal.', con: 'Asleep by ten. Fear fades fast.' },
  ],
  chef: [
    { name: 'Bruno Sarto', first: 'Bruno', trait: 'proud', skill: 1.2, nightly: { opu: 1 }, was: 'Two stars and one lawsuit.', pro: 'Wastes nothing. Your dinners are a comfort.', con: 'Proud, and has knives.' },
    { name: 'Maud Tibbs', first: 'Maud', trait: 'gossip', skill: 0.85, loyalty: 9, nightly: { opu: -0.5 }, was: 'School kitchens, thirty years.', pro: 'Cheerful, and fond of you.', con: 'Everything is grey. Tells everyone everything.' },
  ],
  engineer: [
    { name: 'Nkem Okafor', first: 'Nkem', trait: 'believer', skill: 1.25, loyalty: -6, was: 'Built this silo, bolt by bolt.', pro: 'Power and water run sweetly.', con: 'Knows every weakness in the place. Remembers promises.' },
    { name: 'Kit Fenwick', first: 'Kit', trait: 'gossip', skill: 0.72, loyalty: 10, was: 'Your nephew. Has watched videos.', pro: 'Family. Adores you.', con: 'Things leak. So does Kit.' },
  ],
  doctor: [
    { name: 'Hana Lindqvist', first: 'Hana', trait: 'believer', skill: 1.25, loyalty: -3, was: 'Trauma surgeon.', pro: 'Medicine lasts. People live.', con: 'Has principles, and expects you to have some.' },
    { name: 'Rex Paloma', first: 'Rex', trait: 'greedy', skill: 0.7, loyalty: 6, bring: { med: 10 }, nightly: { opu: 0.5 }, was: 'Your cosmetic surgeon.', pro: 'Brought his own pills. Keeps you looking rested.', con: 'Has not set a bone since college.' },
  ],
  farmer: [
    { name: 'Tomás Reyes', first: 'Tomás', trait: 'proud', skill: 1.2, loyalty: -2, was: 'Third-generation grower.', pro: 'The farm thrives.', con: 'Proud. Wants the water for the crops, not for you.' },
    { name: 'Juniper Ash', first: 'Juniper', trait: 'gossip', skill: 0.8, loyalty: 9, was: 'Has a channel about houseplants.', pro: 'Relentlessly positive.', con: 'The tomatoes are mostly leaves.' },
  ],
  pa: [
    { name: 'Priya Nair', first: 'Priya', trait: 'greedy', skill: 1.3, loyalty: -5, was: 'Ran your office for nine years.', pro: 'What you hear about the staff is mostly true.', con: 'Knows where everything is, including your secrets.' },
    { name: 'Tobias Crane', first: 'Tobias', trait: 'believer', skill: 0.6, loyalty: 12, nightly: { opu: 1 }, was: 'Your biographer.', pro: 'Agrees with everything. Very soothing.', con: 'Rumours reach you late, and wrong.' },
  ],
  cleaner: [
    { name: 'Agnes Pell', first: 'Agnes', trait: 'gossip', skill: 1.3, was: 'Thirty years of other people’s bins.', pro: 'Your informants are sharper.', con: 'She hears everything. So does everybody else.' },
    { name: 'Wilf Gruber', first: 'Wilf', trait: 'proud', skill: 0.8, loyalty: 7, nightly: { opu: 1, lux: -0.3 }, was: 'Your butler.', pro: 'Slippers warmed, drinks poured.', con: 'Pours some for himself. Thinks mopping is beneath him.' },
  ],
  heir: [
    { name: 'Caspian', first: 'Caspian', title: 'Your adult child', the: 'your child', trait: 'greedy', loyalty: 4, was: 'Has never had a job.', pro: 'Easily bought.', con: 'Expensive. Thinks they should be in charge.' },
    { name: 'Lucian', first: 'Lucian', title: 'Your brother', the: 'your brother', trait: 'proud', loyalty: -8, bring: { lux: 8 }, want: 'My half of this place.', was: 'Wanted the bunker. Arrived with his own silver.', pro: 'Brought luxuries of his own.', con: 'Proud, and believes half of it is his.' },
    { name: 'Mitzi', first: 'Mitzi', title: 'Your third spouse', the: 'your spouse', trait: 'gossip', loyalty: 6, nightly: { opu: 2, lux: -0.5 }, was: 'Married you in March.', pro: 'Good company: a comfort every night.', con: 'Costs luxury every night. Tells the staff everything.' },
  ],
};

export const TRAITS = {
  greedy: { name: 'Greedy', note: 'Perks work very well on them.' },
  proud: { name: 'Proud', note: 'Punishment backfires. Perks impress them less.' },
  gossip: { name: 'Gossip', note: 'What they know, everyone knows by breakfast.' },
  believer: { name: 'True believer', note: 'Takes your promises to heart, kept or broken.' },
};

// What a person at each step of the threat ladder is doing, in plain words (used by informants and the end-of-run reveal).
export const STAGES = ['content', 'grumbling', 'slacking', 'breaking things on purpose', 'stealing from you', 'organising against you', 'planning to remove you'];
