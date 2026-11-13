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
    title: 'Your adult child', the: 'your child', name: 'Caspian', first: 'Caspian', post: 'suite',
    keeps: 'Nothing useful', danger: 'Thinks they should be in charge',
    want: 'Comfort, and a title.',
    wantMet: (st, p) => st.res.lux >= 30 || !!p.titled,
  },
};

export const TRAITS = {
  greedy: { name: 'Greedy', note: 'Perks work very well on them.' },
  proud: { name: 'Proud', note: 'Punishment backfires. Perks impress them less.' },
  gossip: { name: 'Gossip', note: 'What they know, everyone knows by breakfast.' },
  believer: { name: 'True believer', note: 'Takes your promises to heart, kept or broken.' },
};

// What a person at each step of the threat ladder is doing, in plain words (used by informants and the end-of-run reveal).
export const STAGES = ['content', 'grumbling', 'slacking', 'breaking things on purpose', 'stealing from you', 'organising against you', 'planning to remove you'];
