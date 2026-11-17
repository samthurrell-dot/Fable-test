// data/matters.js
// Things to manage and take care of, apart from the day's event card:
//   POLICY_INFO  the standing orders (dials you may change at any time; they take effect each night)
//   ASKS         small requests from individual staff, which wait a few days for an answer
//   FAULTS       machinery that breaks down (or is broken on purpose) and drains a store until mended
// Pure data. The numbers behind the standing orders are in RULES.POLICY in engine/sim.js.

export const POLICY_INFO = {
  rations: { name: 'Staff rations', mine: false, opts: ['Lean', 'Fair', 'Generous'], notes: ['Saves food. They are hungry, and they know why.', 'Enough, and no more.', 'Costs food every night. They notice.'] },
  shifts: { name: 'Work rota', mine: false, opts: ['Easy', 'Normal', 'Double'], notes: ['Less gets grown, pumped and mended. People like it.', 'The usual hours.', 'More from the farm and the plant. Tired people, and accidents.'] },
  heating: { name: 'Heating on the staff levels', mine: false, opts: ['Off', 'On'], notes: ['Saves power. Nine degrees in the bunks, and colds.', 'Costs power every night.'] },
  cameras: { name: 'Cameras', mine: false, opts: ['Off', 'On'], notes: ['You see people at their posts, and nothing at night.', 'You see where people really are. Costs power, and nobody likes it.'] },
  table: { name: 'Your table', mine: true, opts: ['Staff food', 'Fine dining', 'Banquets'], notes: ['You eat what they eat. It costs your comfort; they respect it.', 'A little extra food, a little comfort.', 'A lot of food, a lot of comfort. They can smell it from their floor.'] },
  tub: { name: 'Your hot tub', mine: true, opts: ['Drained', 'Full'], notes: ['Saves water.', 'Water every night, for your comfort. The farmer watches it go.'] },
  curfew: { name: 'Curfew and the morning anthem', mine: false, evil: true, opts: ['Off', 'On'], notes: ['People wander about as they like.', 'Lights out at nine, your anthem at six. Fear stops fading and creeps back up. You sleep beautifully.'] },
  cinema: { name: 'Your cinema and heated floors', mine: true, opts: ['Off', 'On'], notes: ['Saves power. Socks in bed.', 'Power every night, for your comfort.'] },
};

// The slope: harsh measures, in the order the bunker gets used to them. A rung opens the morning
// after you first use the one above it. used: what people stop mentioning; opens: the thought that follows.
export const RUNGS = [
  { name: 'A firm hand', acts: ['reprimand', 'confiscate'], used: 'the shouting and the bunk searches' },
  { name: 'Questions at night', acts: ['interrogate', 'divide'], used: 'the knock on the door at two in the morning', opens: 'Questions at night would not seem like much of a step from here.' },
  { name: 'Examples', acts: ['example'], policy: 'curfew', used: 'the toothbrush', opens: 'Making an example of somebody would hardly raise an eyebrow now. Nor would a curfew.' },
  { name: 'Enemies within', acts: ['scapegoat', 'cell'], used: 'the cell door', opens: 'A scapegoat, or a few nights in the cell for somebody, is only a little further.' },
  { name: 'The surface', acts: ['exile'], used: 'the lift', opens: 'There is one step left. The lift goes all the way up.' },
];
// What was done to a person, for their file and for the end of the run.
export const DONE = { reprimand: 'shouted at', interrogate: 'questioned at 2am', divide: 'turned against a friend', example: 'made an example of', scapegoat: 'blamed for everything', cell: 'locked in the cell', exile: 'sent to the surface' };

// Each ask: { key, text(n), t: what saying yes is called, c: open cost, act: true if it costs one of
// your actions, r(g, p): what happens (returns the words), no(n): what a refusal looks like }.
export const ASKS = {
  security: [
    { key: 'patrols', text: (n) => `${n} wants two extra night patrols. “People sleep better when they hear boots.”`, t: 'Approve the patrols', c: { power: -3 }, r: (g, p) => { g.loy(p, 8); g.fear('not:security', 4); return 'Boots in the corridor at two and at four. People do sleep. Not better, exactly.'; }, no: (n) => `${n} salutes and writes something down.` },
    { key: 'lock', text: (n) => `${n} asks for a proper lock for the armoury, out of your own stores.`, t: 'Hand over the lock', c: { lux: -3 }, r: (g, p) => { g.loy(p, 8); return 'The armoury gets the lock from your wine cellar. The wine cellar gets a chair against the door.'; }, no: (n) => `${n} says “as you wish” and tests the old lock, loudly, twice.` },
  ],
  chef: [
    { key: 'saffron', text: (n) => `${n} asks for the saffron from your private larder: “for everybody’s soup, for once”.`, t: 'Send down the saffron', c: { lux: -3 }, r: (g, p) => { g.loy(p, 8); g.loy('not:chef', 1); return 'The soup is yellow and astonishing. Somebody asks what the occasion is. Nobody knows.'; }, no: (n) => `${n} makes the soup anyway. It is grey, and served with a look.` },
    { key: 'dayoff', text: (n) => `${n} would like one day off. Everyone would eat cold tins.`, t: 'Give the day off', c: { food: -2 }, r: (g, p) => { g.loy(p, 8); p.noticed = g.st.day; return `${p.first} sleeps until noon and comes back humming. The tins were not a success.`; }, no: (n) => `${n} cooks. Every dish tastes faintly of resentment.` },
  ],
  engineer: [
    { key: 'motor', text: (n) => `${n} wants the motor out of your cinema projector to rebuild a pump.`, t: 'Give up the motor', c: { comfort: -6, water: 4 }, r: (g, p) => { g.loy(p, 8); return 'The pump runs sweetly. Your films are now a series of very good still pictures.'; }, no: (n) => `${n} nods slowly, looking at the projector the whole time.` },
    { key: 'visit', text: (n) => `${n} asks you to come down and see the plant room for yourself. “Just once. So you know what it is.”`, t: 'Go down and look', c: {}, act: true, r: (g, p) => { g.loy(p, 9); p.noticed = g.st.day; return `An hour among the pipes. ${p.first} explains every valve. You understand none of it, and say so, and that seems to be the right answer.`; }, no: (n) => `${n} says it was only an idea.` },
  ],
  doctor: [
    { key: 'chest', text: (n) => `${n} asks you to hand over your private first-aid chest to the medical bay.`, t: 'Hand it over', c: { lux: -3, med: 5 }, r: (g, p) => { g.loy(p, 7); return 'Your chest goes down in the lift: plasters, morphine, and a great deal of indigestion powder.'; }, no: (n) => `${n} makes a note. ${n} makes a lot of notes.` },
    { key: 'checkups', text: (n) => `${n} wants to give everybody a check-up. It will use supplies.`, t: 'Allow the check-ups', c: { med: -4 }, r: (g, p) => { g.loy(p, 6); g.loy('not:doctor', 2); return 'Everyone is weighed, prodded and told to drink more water. They rather enjoy the attention.'; }, no: (n) => `${n} puts the stethoscope away, slowly.` },
  ],
  farmer: [
    { key: 'seedlings', text: (n) => `${n} asks for extra water for the seedlings this week.`, t: 'Water the seedlings', c: { water: -5, food: 3 }, r: (g, p) => { g.loy(p, 8); return 'The seedlings stand up straight. So, for a day or two, does the farmer.'; }, no: (n) => `${n} waters them with a pipette, where you can see.` },
    { key: 'lamp', text: (n) => `${n} wants one of the lamps from your suite as a grow light.`, t: 'Send down a lamp', c: { comfort: -5, food: 3 }, r: (g, p) => { g.loy(p, 8); return 'Your reading lamp now shines on a bed of lettuces. They are doing very well. You read by the fridge.'; }, no: (n) => `${n} looks at your chandelier for some time before leaving.` },
  ],
  pa: [
    { key: 'door', text: (n) => `${n} would like a door on the office.`, t: 'Fit a door', c: { lux: -2 }, r: (g, p) => { g.loy(p, 7); return 'A door from your wardrobe is hung on the office. It has a mirror on the inside. Morale in the office is high.'; }, no: (n) => `${n} carries on working in full view of the corridor.` },
    { key: 'evening', text: (n) => `${n} asks for one evening without your diary in it.`, t: 'Give the evening', c: { comfort: -5 }, r: (g, p) => { g.loy(p, 8); return 'You find your own slippers and pour your own drink. It takes forty minutes and you are proud of it.'; }, no: (n) => `${n} reads you tomorrow’s diary in a very level voice.` },
  ],
  cleaner: [
    { key: 'mops', text: (n) => `${n} needs new mop heads. There are some in your stores, still wrapped.`, t: 'Hand them over', c: { lux: -2 }, r: (g, p) => { g.loy(p, 8); p.noticed = g.st.day; return `${p.first} unwraps them like presents.`; }, no: (n) => `${n} goes on mopping with something that was once a mop.` },
    { key: 'thanks', text: (n) => `${n} would like to be thanked. Once. Where the others can hear.`, t: 'Thank them at dinner', c: {}, act: true, r: (g, p) => { g.loy(p, 9); g.fear('all', -2); p.noticed = g.st.day; return `You stand up at dinner and thank ${p.first} by name. You get the name right. People look at you as if you were a new person.`; }, no: (n) => `${n} had not really expected it.` },
  ],
  heir: [
    { key: 'allowance', text: (n) => `${n} wants an allowance. “It’s the principle.”`, t: 'Pay the allowance', c: { lux: -5 }, r: (g, p) => { g.loy(p, 9); return `${p.first} counts it, complains about it, and takes it.`; }, no: (n) => `${n} tells everyone that you are mean. Everyone already had a view.` },
    { key: 'bedroom', text: (n) => `${n} wants the good bedroom. Yours.`, t: 'Give up the bedroom', c: { comfort: -10 }, r: (g, p) => { g.loy(p, 11); return `You move into the second-best bedroom. It has a pipe in it. ${p.first} is, for now, content.`; }, no: (n) => `${n} slams a door that was built to survive a missile.` },
  ],
};

// Machinery. zone: where it shows on the silo. res, drain: what it costs each night until mended.
export const FAULTS = {
  generator: { zone: 'plant', res: 'power', drain: 2.5, name: 'The generator', text: 'The generator has thrown a bearing. It runs, loudly, at half strength.' },
  pump: { zone: 'plant', res: 'water', drain: 2.5, name: 'The recycling pump', text: 'The recycling pump is leaking across the plant-room floor.' },
  fridge: { zone: 'kitchen', res: 'food', drain: 2, name: 'The walk-in fridge', text: 'The walk-in fridge is warm. Things in it are starting to have opinions.' },
  lights: { zone: 'farm', res: 'food', drain: 1.8, name: 'The grow lights', text: 'A bank of grow lights has gone dark. The seedlings lean towards the corridor.' },
  cabinet: { zone: 'medical', res: 'med', drain: 1.2, name: 'The medicine fridge', text: 'The medicine fridge has failed. Ampoules are spoiling by the day.' },
};
// Whose machine each one is, when it is broken on purpose.
export const SABOTEUR = { chef: ['fridge'], engineer: ['generator', 'pump'], doctor: ['cabinet'], farmer: ['lights'] };

// What people say when you sit down and ask (see talk() in engine/sim.js). Keyed by what moved their loyalty.
export const WHY_BAD = {
  cameras: 'The cameras. I can’t scratch my nose without a little red light watching.',
  grudge: 'You know what it is. It is the same thing it was on the first day.',
  trust: 'You said things. You promised things. I was there.',
  unrest: 'It isn’t me. It’s the mood. Everybody is angry, and it’s catching.',
  hunger: 'I’m hungry. We are all hungry. You do not look hungry.',
  cabin: 'I have counted the rivets over my bunk. There are 212. It’s being down here.',
  rations: 'The portions. Have you seen the portions?',
  shifts: 'Double shifts. I am asleep on my feet.',
  heating: 'It is nine degrees on our level. I can see my breath in bed.',
  table: 'We can smell your dinner from our floor.',
  tub: 'You have a hot tub. We have a rota for the kettle.',
  crit: 'The stores are empty. What else is there to say?',
  informant: 'You had me watched. By one of us.',
  'or:example': 'What you did, to make an example. It could be any of us next.',
  'or:exile': 'You sent one of us up to the surface.',
  'or:perk': 'Somebody else got a present. I got the smell of it.',
  'or:test': 'You tested me. Like a lock.',
  'or:reprimand': 'You shouted at me in front of everybody.',
  'or:interrogate': 'Two in the morning. A light in my face. You know what you did.',
  'or:cell': 'Three nights in a cell. Everyone saw.',
  'or:scapegoat': 'You stood up in front of everyone and said it was all my fault.',
  'or:divide': 'I don’t know who to trust down here any more.',
  'or:confiscate': 'You went through our bunks. You took the chocolate.',
  curfew: 'Lights out at nine and that anthem at six. Every. Single. Day.',
  'ask:no': 'I asked you for one small thing.',
  'ask:late': 'I asked you for one small thing, and you never even answered.',
};
export const WHY_GOOD = {
  rations: 'The food has been good lately. Thank you for that.',
  shifts: 'The lighter rota helps. More than you’d think.',
  table: 'You eat what we eat. People notice that.',
  trust: 'You kept your word. That is rarer than wine down here.',
  'or:perk': 'The present. I haven’t forgotten it.',
  'or:promise': 'You made a promise. I am holding you to it.',
  'or:speech': 'The speech was… fine. It was nice to be spoken to.',
  'or:talk': 'You asked. Nobody asks.',
  'or:scapegoat': 'At least now we know whose fault it all was.',
  'ask:yes': 'You said yes when I asked. I remember that.',
};
export const SAYS = {
  afraid: ['Everything is fine. Really. Is there anything I can do for you?', 'No complaints. None. I am very happy here.', 'I was only just saying how well things are run.'],
  cover: ['It’s the cold, mostly. And the lentils.', 'Nothing worth your time. A bit tired, that’s all.', 'I miss the sky. Don’t we all?'],
  none: ['Can’t complain. Well, I can, but not today.', 'I’m all right. Ask me again when the coffee runs out.', 'Nothing to report. I’d tell you.'],
};
