// data/deck.js
// Your hand. Each morning you draw cards from your deck and may play some of them (RULES.PLAYS).
// Cards come in four kinds: generous (cost you, please them), spin (cheap, absurd, double-edged:
// the satire), ruthless (pay you in opulence; each step down unlocks the next) and indulgent (pure
// opulence for luxury). Projects and some events add cards to the deck: that is the upgrade path.
//
// A card: { name, kind, target?, cost (paid when played, shown), gain (shown), text (what it does,
// plainly), flavour (the joke), tier (ruthless only: the step it sits on), once (leaves the deck
// after use), fx (what it does to people, shown as tags: see below), need?(g, p) -> true | reason,
// play(g, p, arg, h) -> what happened }.
// fx tokens: +like1/-like1 one person likes you more/less; +likeAll/-likeAll everyone; +calm/-calm the bunker
// calms/stirs; +fear1/+fearAll more afraid of you; +know you find something out; +debt you will owe; ~like1 a gamble.
// g is the handle from engine/sim.js; h carries helpers from there: { kind (what kindness is still
// worth, 0.4..1), shock (how much a ruthless card still upsets bystanders), talk(p), test(p), friend(p) }.

export const KINDS = {
  kind: { name: 'Generous', note: 'Costs you. Pleases them.' },
  spin: { name: 'Spin', note: 'Cheap, absurd, and it might work.' },
  cruel: { name: 'Ruthless', note: 'Feels wonderful. Opens the next step.' },
  self: { name: 'Indulgent', note: 'For you. Opulence, for luxury.' },
};

const fade = (n, f) => Math.pow(f, n);
const STORES = ['food', 'water', 'power', 'med'];

export const CARDS = {
  // ------------------------------------------------------------------ generous
  perk: {
    name: 'A Little Something', kind: 'kind', fx: '+like1', target: true, cost: { lux: -5 },
    text: 'One person likes you a lot more. Less each time you do it to them.',
    flavour: 'A tin of peaches, and a silver spoon to eat it with.',
    play: (g, p, a, h) => {
      g.loy(p, 10 * fade(p.perks, 0.6) * h.kind, 'gift'); p.perks++; p.noticed = g.st.day; g.st.stats.perks++;
      g.loy('not:' + p.role, p.trait === 'gossip' ? -2 : -1);
      h.friend(p, 2.5);
      return `${p.first} gets a tin of peaches and a silver spoon. ${p.trait === 'greedy' ? 'They count the peaches.' : p.trait === 'proud' ? 'They accept it as no more than their due.' : p.trait === 'gossip' ? 'By supper everyone knows, in detail.' : 'They seem genuinely pleased.'}`;
    },
  },
  talk: {
    name: 'An Open-Door Policy', kind: 'kind', fx: '+know +like1', target: true, cost: { opu: -2 },
    text: 'They tell you what is really bothering them, so you can fix it.',
    flavour: 'Your door is always open. Today, for twenty minutes.',
    play: (g, p, a, h) => h.talk(p),
  },
  trickle: {
    name: 'Trickle-Down Dinner', kind: 'kind', fx: '+likeAll', cost: { food: -3 },
    text: 'Everyone likes you a little more.',
    flavour: 'Your leftovers go down to the mess hall. Half a lobster, and eventually the other half.',
    play: (g, p, a, h) => { g.loy('all', 3 * h.kind); return 'Your leftovers go down in the lift on a silver tray. The staff fall on half a lobster like gulls. Somebody says “he’s not so bad”, and means it.'; },
  },
  promise: {
    name: 'A Solemn Promise', kind: 'kind', fx: '+likeAll +calm +debt', promise: true,
    text: 'They like you more and calm down, now. In a few days it falls due: keeping it costs you, breaking it costs more.',
    flavour: 'Nobody said you have to mean it.',
    play: () => '',
  },
  // ------------------------------------------------------------------ spin: the satire
  eotm: {
    name: 'Employee of the Month', kind: 'spin', fx: '+like1 -likeAll', target: true,
    text: 'One person likes you more, for nothing; the others mind. Proud people adore it. Greedy people wanted cash.',
    flavour: 'A laminated photo of you, handing them a laminated photo.',
    play: (g, p, a, h) => {
      const d = (p.trait === 'proud' ? 10 : p.trait === 'greedy' ? 2 : 6) * h.kind;
      g.loy(p, d); g.loy('not:' + p.role, -2); p.noticed = g.st.day; g.st.eotm = (g.st.eotm || 0) + 1;
      return `${p.first} is Employee of the Month. The plaque goes up in the mess hall: a photo of you, handing ${p.first} a photo of you. ${p.trait === 'proud' ? `${p.first} polishes it every morning.` : p.trait === 'greedy' ? `${p.first} asks what it is worth. It is worth nothing.` : `${p.first} is quietly delighted.`}${g.st.eotm >= 3 ? ' It is the third one this month. Nobody mentions the maths.' : ''}`;
    },
  },
  poster: {
    name: 'Motivational Poster', kind: 'spin', fx: '+likeAll +calm', cost: { lux: -1 },
    text: 'Everyone likes you a little more, and calms down. Half as well each time.',
    flavour: 'HANG IN THERE, says the kitten. Nobody else is allowed to.',
    play: (g, p, a, h) => {
      const f = fade(g.st.posters || 0, 0.5) * h.kind; g.st.posters = (g.st.posters || 0) + 1;
      g.loy('all', 2 * f); g.unrest(-5 * f);
      return ['A kitten clinging to a branch goes up in the mess hall. HANG IN THERE. People do, slightly.', 'A sunrise over mountains. TEAMWORK. Nobody down here has seen a sunrise in a while. Some find it moving; some find it cruel.', 'A rowing eight. SYNERGY. Somebody draws a ninth rower, falling out of the boat, with your face.', 'A poster that just says POSTERS. You are running out of ideas, and so are they.'][Math.min(3, g.st.posters - 1)];
    },
  },
  rebrand: {
    name: 'Rebrand the Rations', kind: 'spin', fx: '+calm',
    text: 'For four nights, lean rations upset nobody. Unless someone sees through it.',
    flavour: 'It isn’t hunger. It’s the Founder’s Fast™.',
    play: (g) => {
      g.st.flags.fast = g.st.day + 4;
      const sharp = g.here().find((p) => p.trait === 'gossip' && p.loyalty < 45);
      if (sharp && g.chance(0.4)) { g.loy('all', -3); g.st.flags.fast = 0; return `The Founder’s Fast™ is launched with a laminated menu and a mindfulness playlist. ${sharp.first} reads the menu aloud in a very flat voice. It is one lentil, and a quote from you. The fast is off; the laughter isn’t.`; }
      return 'The Founder’s Fast™ is launched with a laminated menu and a mindfulness playlist. Lean rations are now a lifestyle. Somebody says they have never felt so clear-headed. Somebody else faints, clear-headedly.';
    },
  },
  funday: {
    name: 'Mandatory Fun', kind: 'spin', fx: '+calm +fearAll -likeAll', cost: { food: -2 }, gain: { opu: 2 },
    text: 'The bunker calms right down. Everyone is a bit more afraid. Nobody enjoys it.',
    flavour: 'Attendance is compulsory. So is the conga.',
    play: (g) => { g.unrest(-12); g.fear('all', 3); g.loy('all', -1); return 'Party hats, warm squash and a conga line that goes round the mess hall four times. You lead it. Nobody can leave until you say so, and you don’t say so for some time.'; },
  },
  ted: {
    name: 'A TED Talk', kind: 'spin', fx: '+likeAll +calm',
    text: 'Everyone likes you a little more, and calms down. Less each time.',
    flavour: '“Failure Is Just Success in Disguise.” Forty minutes. There are slides.',
    play: (g, p, a, h) => {
      const f = fade(g.st.speeches, 0.6) * h.kind; g.st.speeches++;
      g.loy('all', 5 * f); g.unrest(-8 * f);
      return ['You give a TED Talk in the mess hall: “Failure Is Just Success in Disguise.” There is a slide of you on a mountain. Real applause.', 'A second talk: “The Bunker Mindset.” The applause is polite. Somebody checks a watch that stopped in March.', 'A third talk: “What the Apocalypse Taught Me About Leadership.” People clap the way they queue.', 'You give the talk again. They know the slides. Somebody mouths along to the mountain.'][Math.min(3, g.st.speeches - 1)];
    },
  },
  consultant: {
    name: 'Hire a Consultant', kind: 'spin', fx: '+know', target: true, cost: { lux: -3 },
    text: 'Find out exactly where one person stands. Nobody blames you; they blame the consultant.',
    flavour: 'The cleaner borrows a blazer and a clipboard, and bills by the hour.',
    play: (g, p, a, h) => h.test(p, true),
  },
  nda: {
    name: 'Non-Disclosure Agreement', kind: 'spin', fx: '+fear1 -like1', target: true,
    text: 'One person is more afraid of you. A gossip stops spreading bad news, for good.',
    flavour: 'Forty pages. They sign it in crayon; it is all that’s left.',
    play: (g, p) => { g.fear(p, 8); g.loy(p, -2); const was = p.trait; if (was === 'gossip') p.trait = 'gagged'; g.note(p, 'signed an NDA'); return `${p.first} signs forty pages in crayon in front of a witness, who also signs an NDA. ${was === 'gossip' ? `${p.first} is no longer able to say anything about anything. You can see it hurting.` : `${p.first} had nothing to tell anybody anyway, and now legally cannot.`}`; },
  },
  trust: {
    name: 'Team-Building Trust Fall', kind: 'spin', fx: '~like1', target: true,
    text: 'One person falls; another catches. If both like you, they like you more. If not, someone gets dropped.',
    flavour: 'Backwards off the mess-hall table, into the arms of a colleague. Possibly.',
    play: (g, p, a) => {
      const others = g.here().filter((q) => q !== p);
      const q = others.length ? g.pick(others) : null;
      if (!q) return `${p.first} falls backwards off the table. There is nobody left to catch.`;
      if (p.loyalty >= 45 && q.loyalty >= 45) { g.loy(p, 6); g.loy(q, 6); if (!p.friend && !q.friend) { p.friend = q.role; q.friend = p.role; } return `${p.first} falls backwards off the mess-hall table and ${q.first} catches them. Applause. They are, apparently, friends now.`; }
      g.loy(p, -5); g.loy(q, -3); g.res('med', -2);
      return `${p.first} falls backwards off the mess-hall table. ${q.first} steps neatly to one side. There is a noise like a dropped melon. “Synergy,” you say, and leave.`;
    },
  },
  // ------------------------------------------------------------------ indulgent
  treat: {
    name: 'Treat Yourself', kind: 'self', fx: '', cost: { lux: -4 }, gain: { opu: 8 },
    text: 'Opulence. That’s it. That’s the card.',
    flavour: 'A bottle older than the engineer, drunk alone, slowly.',
    play: (g) => g.pick(['You open a bottle older than the engineer and drink it alone, slowly, in a dressing gown with your initials on it.', 'An hour with the good cigars and the door locked. You blow smoke rings at a portrait of yourself.', 'Caviar, on the last of the proper crackers, eaten off a gold plate while the generator hums.']),
  },
  // ------------------------------------------------------------------ ruthless: the slope (tier 0 is in every starting deck)
  review: {
    name: 'A Frank Performance Review', kind: 'cruel', fx: '+fear1 -like1', tier: 0, target: true, gain: { opu: 2 },
    text: 'One person is more afraid of you, and likes you a little less. A slacker goes straight back to work.',
    flavour: '“Meets expectations” was never one of the boxes.',
    play: (g, p, a, h) => {
      g.loy(p, -3, 'punish'); g.fear(p, 9); g.fear('not:' + p.role, 2); h.friend(p, -1.5);
      const back = p.stage === 2; if (back) p.stage = 1;
      return `You review ${p.first}’s performance in the mess hall, with a laser pointer. Every box is “Below expectations”, including “Punctuality”, which ${p.first} has never missed. ${back ? `${p.first} is back at work within the hour.` : `${p.first} says “thank you for the feedback” eleven times.`}`;
    },
  },
  search: {
    name: 'Search the Bunks', kind: 'cruel', fx: '+fearAll -likeAll', tier: 0, gain: { opu: 2 },
    text: 'Seize what they are hiding: food and luxury for you. Less each time. Everyone resents it.',
    flavour: 'Tinned peaches, a ham and, somehow, your own brandy.',
    play: (g, p, a, h) => {
      const f = fade(g.st.searches, 0.5); g.st.searches++;
      g.res('food', Math.round(5 * f)); g.res('lux', Math.round(4 * f)); g.loy('all', -5 * h.shock); g.fear('all', 4);
      return f > 0.7 ? 'Every bunk is turned out at dawn. Tinned peaches, a ham, two bottles of your own brandy and an astonishing amount of chocolate. It all goes up in the lift to your floor.' : 'Every bunk is turned out again. They have learned to hide things better, or there is less to hide. A few tins. A great deal of silence.';
    },
  },
  interrogate: {
    name: 'A Little Chat at 2am', kind: 'cruel', fx: '+know +fear1 -like1', tier: 1, target: true, gain: { opu: 3 },
    text: 'You learn exactly what one person is up to, and why. They will not forget it.',
    flavour: 'A bright lamp, two chairs, and one of them is yours.',
    play: (g, p, a, h) => h.interrogate(p),
  },
  divide: {
    name: 'Divide and Rule', kind: 'cruel', fx: '+calm -like1', tier: 1, target: true, gain: { opu: 2 },
    text: 'End one person’s friendship. For a week neither of them can organise anything.',
    flavour: 'You tell each of them, in confidence, that the other is an informant. It is the only true thing you say all day.',
    need: (g, p) => (p && p.friend ? true : 'They have no friend left to lose'),
    play: (g, p, a, h) => h.divide(p),
  },
  example: {
    name: 'Make an Example', kind: 'cruel', fx: '+fearAll -likeAll', tier: 2, target: true, gain: { opu: 4 },
    text: 'Everyone is much more afraid of you. Everyone likes you less, that one most of all.',
    flavour: 'The reactor floor. A toothbrush. An audience.',
    play: (g, p, a, h) => h.example(p),
  },
  curfew: {
    name: 'Curfew and Anthem', kind: 'cruel', fx: '+fearAll -likeAll', tier: 2, once: true, gain: { opu: 3 },
    text: 'From tonight, fear creeps up every night, and they like you a little less. You sleep beautifully.',
    flavour: 'Lights out at nine. Your anthem at six. You wrote the anthem.',
    play: (g) => { g.st.policy.curfew = 1; return 'Lights out at nine. At six every morning, the anthem: four verses, all about you, sung by you, recorded in your hot tub. Attendance at breakfast is now very prompt.'; },
  },
  scapegoat: {
    name: 'Find a Scapegoat', kind: 'cruel', fx: '+calm +likeAll -like1', tier: 3, target: true, gain: { opu: 4 },
    text: 'The bunker calms right down, and likes you a bit more: it was all their fault. That one person hates you for good.',
    flavour: 'There are slides.',
    play: (g, p, a, h) => h.scapegoat(p),
  },
  cell: {
    name: 'A Few Nights in the Cell', kind: 'cruel', fx: '+fearAll -like1', tier: 3, target: true, gain: { opu: 3 },
    text: 'Three nights in which they can plot nothing. Everyone is more afraid. Their job is done badly meanwhile.',
    flavour: 'The door makes a very satisfying noise.',
    play: (g, p, a, h) => h.cell(p),
  },
  exile: {
    name: 'We’re Letting You Go. Up.', kind: 'cruel', fx: '+fearAll -likeAll', tier: 4, target: true, gain: { opu: 6 },
    text: 'Removes a problem for good. You lose their skills. The others are horrified.',
    flavour: 'A suit, a mask, a short walk to the lift, and an exit interview.',
    play: (g, p, a, h) => h.exile(p),
  },
  // ------------------------------------------------------------------ from projects
  summit: {
    name: 'Hot Tub Summit', kind: 'spin', fx: '+like1', target: true, gain: { opu: 3 },
    text: 'Invite one person into the tub. Greedy people and gossips love it. Proud people find it degrading.',
    flavour: 'Business is done in the tub now. Swimwear is optional, regrettably.',
    play: (g, p) => { const d = p.trait === 'proud' ? -4 : p.trait === 'believer' ? 5 : 10; g.loy(p, d, 'gift'); p.noticed = g.st.day; return d > 0 ? `You and ${p.first} discuss the future of the bunker in the gold hot tub, for two hours, with champagne. ${p.first} emerges pink, loyal and slightly boiled.` : `${p.first} sits on the edge of the gold hot tub in full uniform, with their trousers rolled up, and refuses to get in. You do the whole meeting in the tub regardless.`; },
  },
  unveil: {
    name: 'Unveil a Portrait', kind: 'self', fx: '+fearAll -likeAll', gain: { opu: 7 },
    text: 'Everyone is more afraid of you, and likes you a little less. Very satisfying.',
    flavour: 'You, as a centaur, crossing the Rubicon.',
    play: (g) => { g.fear('all', 5); g.loy('all', -2); return g.pick(['The new portrait is unveiled with a drumroll on a saucepan: you, as a centaur, crossing the Rubicon. The staff are made to applaud for the length of one lap of the mess hall.', 'The new portrait: you, in armour, wrestling a bear, which is also you. Attendance at the unveiling is compulsory, and so is weeping.']); },
  },
  broadcast: {
    name: 'Broadcast Good News', kind: 'spin', fx: '+calm +likeAll',
    text: 'The bunker calms right down and likes you more. Unless any store is nearly empty: they can count.',
    flavour: 'Today’s top story: everything is fine. Sport: you won.',
    play: (g) => {
      const low = STORES.find((k) => g.st.res[k] < 15);
      if (low) { g.loy('all', -4); g.unrest(5); return `Radio Me leads with “Record Harvest, Says Founder”. Everybody can see the ${low === 'med' ? 'medicine cabinet' : low} for themselves. Somebody turns the radio round to face the wall.`; }
      g.loy('all', 3); g.unrest(-15);
      return 'Radio Me, 7am: the weather is “indoors”, the stores are “brimming”, and the founder has been voted Best Founder for the ninth day running. People hum the jingle at work.';
    },
  },
  poetry: {
    name: 'Read Your Poetry on Air', kind: 'self', fx: '+fearAll -likeAll', gain: { opu: 6 },
    text: 'Everyone is more afraid of you, and likes you a little less. Your art matters.',
    flavour: 'An epic in nine cantos. It rhymes “me” with “me”.',
    play: (g) => { g.fear('all', 4); g.loy('all', -2); return 'You read the whole of “Ode to Me”, nine cantos, on Radio Me, during lunch, at full volume, on every floor. In canto six, you weep. So, for different reasons, does the chef.'; },
  },
  billibucks: {
    name: 'Pay in BilliBucks', kind: 'spin', fx: '+likeAll',
    text: 'Everyone likes you more, for nothing. Half as well each time. Greedy people will work it out.',
    flavour: 'Legal tender, bearing your face, redeemable for more of itself.',
    play: (g, p, a, h) => {
      const n = g.st.bucks = (g.st.bucks || 0) + 1;
      g.loy('all', 5 * fade(n - 1, 0.5) * h.kind);
      if (n >= 3) { for (const q of g.here()) if (q.trait === 'greedy') g.loy(q, -6); return 'A bonus in BilliBucks for everyone. A loaf of bread now costs 400 BilliBucks, payable only in BilliBucks. The greedy ones have worked out what you have done, and are papering their bunks with it.'; }
      return 'Everyone is paid a bonus in BilliBucks: crisp new notes with your face on, worth one BilliBuck each, or more, if you say so. People are surprisingly pleased. Money is money.';
    },
  },
  tapes: {
    name: 'Review the Tapes', kind: 'spin', fx: '+know', target: true,
    text: 'See exactly what one person has been doing. Catches a plotter in the act.',
    flavour: 'Seventy hours of corridor. You skip to the bits with you in.',
    play: (g, p, a, h) => h.tapes(p),
  },
  tasting: {
    name: 'Truffle Tasting Menu', kind: 'self', fx: '', cost: { food: -2 }, gain: { opu: 8 },
    text: 'Opulence, with truffles.',
    flavour: 'Each course is a truffle. The last course is a larger truffle.',
    play: () => 'Nine courses, each of them a truffle, the last of them a larger truffle. The farmer watches through the hatch, holding a shovel, saying nothing.',
  },
  yoga: {
    name: 'Mandatory Sunrise Yoga', kind: 'spin', fx: '+calm +fearAll', gain: { opu: 1 },
    text: 'The bunker calms down. Everyone is a little more afraid, and a little more supple.',
    flavour: 'Downward dog, at gunpoint.',
    play: (g) => { g.unrest(-10); g.fear('all', 2); g.loy('all', 1); return 'Sunrise yoga at 5am, by the grow lights, led by you, in white linen. Downward dog. Upward founder. Somebody pulls something and is too frightened to say so.'; },
  },
};

// Every starting deck. The first morning's business adds two more, and you choose which.
export const START_DECK = ['perk', 'talk', 'promise', 'trickle', 'eotm', 'poster', 'rebrand', 'funday', 'ted', 'consultant', 'nda', 'trust', 'treat', 'review', 'search'];
// The ruthless cards on each step. Playing any card on a step opens the next one, the following morning.
export const TIERS = [['review', 'search'], ['interrogate', 'divide'], ['example', 'curfew'], ['scapegoat', 'cell'], ['exile']];
export const TIER_NAMES = ['A firm hand', 'Questions at night', 'Examples', 'Enemies within', 'The surface'];
export const TIER_LINES = [
  'Nobody mentions the performance reviews any more.',
  'Nobody mentions the knock on the door at two in the morning any more.',
  'Nobody mentions the toothbrush any more.',
  'Nobody mentions the cell door any more.',
];

// The upgrade path: things you build. One at a time; while it is being built, the staff work overtime.
// night: what it adds every night once built (opu is your score). cards: added to your deck when done.
export const PROJECTS = {
  // Every project (round 7) is built a part at a time (days = parts) and only moves when you put work in, up to
  // two parts a day: buy the materials (mat), put the staff on overtime (they mind), or supervise it yourself (a play).
  // First projects: one must be chosen on day 1. Already paid for, but its grand opening has a date.
  cinema: { first: true, name: 'A Cinema the Size of a Cathedral', cost: {}, days: 5, mat: { power: -3 }, night: { opu: 3, power: -0.5 }, text: 'Opulence every night. Built with power, and runs on a little.', flavour: 'Four hundred seats. One of them is yours. The rest are for your coats.' },
  beach: { first: true, name: 'An Indoor Beach, with Waves', cost: {}, days: 5, mat: { water: -3 }, night: { opu: 3, water: -0.5 }, text: 'Opulence every night. Built with water, and runs on a little.', flavour: 'Real sand. A fake sun. The waves are the cleaner, with a paddle.' },
  banquet: { first: true, name: 'A Banqueting Hall for One', cost: {}, days: 5, mat: { food: -3 }, night: { opu: 3, food: -0.5 }, text: 'Opulence every night. Built with food, and runs on a little.', flavour: 'A table for sixty. You sit at the end. The echo agrees with you.' },

  hottub: { name: 'A Gold Hot Tub', cost: { lux: -6 }, days: 3, mat: { water: -2 }, night: { opu: 3, water: -1.2 }, cards: ['summit'], text: 'Opulence every night. Drinks water.', flavour: 'Twenty-four carat. The jets play your anthem.' },
  gallery: { name: 'A Gallery of Portraits of You', cost: { lux: -5 }, days: 2, mat: { lux: -2 }, night: { opu: 2 }, cards: ['unveil'], text: 'Opulence every night, and a card to frighten everyone with.', flavour: 'Forty of them. In one, you are a centaur.' },
  radio: { name: 'Radio Me', cost: { lux: -8 }, days: 3, mat: { power: -2 }, night: { opu: 1 }, cards: ['broadcast', 'poetry'], text: 'Two cards: good news, and your poetry.', flavour: 'All you, all day, on every floor.' },
  mint: { name: 'The BilliBuck Mint', cost: { lux: -6 }, days: 3, mat: { lux: -2 }, night: { opu: 1 }, cards: ['billibucks'], text: 'A card that pays everyone, in your own money.', flavour: 'Your face on every note. Your other face on the coins.' },
  cameras: { name: 'The Surveillance Suite', cost: { lux: -6 }, days: 2, mat: { power: -2 }, night: { power: -1.5 }, cameras: true, cards: ['tapes'], text: 'Cameras everywhere, and a card to watch the tapes. Nobody likes being watched.', flavour: 'Forty screens. Thirty-nine of them show corridors.' },
  truffles: { name: 'A Truffle Farm', cost: { lux: -5 }, days: 4, mat: { water: -2 }, night: { lux: 1.4, food: -1, opu: 1 }, cards: ['tasting'], text: 'Luxury every night, out of the food stores.', flavour: 'Grown in the dark, like the staff.' },
  wellness: { name: 'A Staff Wellness Centre', cost: { lux: -9 }, days: 4, mat: { lux: -2 }, night: { loyalty: 0.35 }, cards: ['yoga'], text: 'Everyone likes you a little more, every night.', flavour: 'A bench, a mat and a framed quote from you about rest.' },
  panic: { name: 'A Panic Room Inside the Panic Room', cost: { lux: -10 }, days: 4, mat: { power: -2 }, night: { opu: 1 }, panic: true, text: 'Survive one attempt on your life.', flavour: 'For when the bunker itself is the threat.' },
  butler: { name: 'Jeeves 9000, a Robot Butler', cost: { lux: -12 }, days: 4, mat: { power: -2 }, night: { opu: 2 }, plays: 1, text: 'Play one more card every day.', flavour: 'It irons your newspapers. There are no newspapers.' },
  pod: { name: 'An Escape Pod (One Seat)', cost: { lux: -16 }, days: 6, mat: { power: -3 }, pod: true, text: 'From day 20 you can leave, with your score, whenever you like.', flavour: 'There is one seat. It is heated.' },
};

// Titles by opulence: the score you are playing for.
export const TITLES = [[0, 'Tenant'], [90, 'Landlord'], [180, 'Chairman of the Board'], [300, 'Supreme Leader'], [440, 'God-Emperor of Silo 7']];
export const titleOf = (opu) => TITLES.filter(([t]) => opu >= t).pop()[1];
export const nextTitle = (opu) => TITLES.find(([t]) => opu < t) || null;
