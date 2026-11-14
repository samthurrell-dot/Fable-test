// engine/sim.js
// The rules of Bunker Billionaire. Pure: no DOM, no timers, and the only randomness is a seeded
// generator kept inside the state, so a run can be saved, reloaded and replayed from its seed.
//
// One day is: report -> day -> (lights out) -> night -> next report. During the day you may, in any order:
//   answer today's event           eventView(st), choose(st, i)            (must be done before lights out)
//   change your standing orders    setPolicy(st, key, value), indulge(st)  (free; they bite at night)
//   deal with what is waiting      matterView(st), decide(st, i, id)       (requests and faults)
//   spend your actions             actionList(st), promiseList(st), act(st, id, arg)
// then endDay(st): staff react, threat check, the night's supplies.
// newRun(cardId, seed) gives a fresh state at the first morning report; openDay(st) moves report -> day.
//
// Hidden values (never shown by the screen until the run is over): each person's loyalty, fear and
// step on the threat ladder (0 content .. 6 planning to remove you), and the bunker's unrest.

import { ROLES, ROLE_ORDER, STAGES, CANDIDATES } from '../data/staff.js';
import { cardById } from '../data/cards.js';
import { RUMOURS, RUMOURS_AFRAID, MOODS, SABOTAGE, THEFT } from '../data/text.js';
import { EVENTS } from '../data/events.js';
import { ASKS, FAULTS, SABOTEUR, WHY_BAD, WHY_GOOD, SAYS } from '../data/matters.js';

export const RULES = {
  DAYS: 30,                      // nights until the surface is safe
  START: { food: 60, water: 52, power: 55, med: 30, lux: 45, comfort: 70 },
  CAP: 120,                      // most of anything the stores can hold (comfort stops at 100)
  VARY: 8,                       // spread of starting loyalty and fear between people
  GRUDGE_START: 16,              // loyalty the person with a grudge starts short by
  // Each night, loyalty drifts by:
  WANT_MET: 0.3, WANT_UNMET: -1.2,   // whether the person's want is met
  CABIN: 0.035,                  // lost a night per day spent underground so far: it wears on everyone
  CAMERA_LOYALTY: 0.6,           // lost a night while the cameras are on
  GRUDGE: 1.2,                   // lost a night by the person with a grudge
  TRUST_KEPT: 0.12, TRUST_BROKEN: 0.6,   // per promise kept or broken so far
  HUNGER: 1.5,                   // lost a night on cut rations or a nearly empty larder
  // Fear fades towards FEAR_REST by this share a night (halved while security does its job, more without).
  FEAR_REST: 15, FEAR_DECAY: 0.06,
  // The threat ladder. A person climbs to the lower of what their loyalty wants and what their fear allows.
  LOYALTY_STEPS: [58, 48, 40, 33, 27, 21],   // at or above each: step 0, 1, 2, 3, 4, 5; below the last: 6
  FEAR_CAPS: [80, 66, 52, 40, 26],           // at or above each: no higher than step 1, 2, 3, 4, 5
  CLIMB: 0.55,                   // chance a night of climbing one step when they want to
  P_SABOTAGE: 0.16, P_THEFT: 0.2, P_ATTEMPT: 0.3,
  UNREST_BY_STAGE: [-0.6, 0.4, 0.9, 1.3, 1.7, 3.2, 3.6],   // added to unrest a night per person at each step
  EFF_BY_STAGE: [1, 1, 0.8, 0.7, 0.7, 0.6, 0.6], EFF_ABSENT: 0.25,   // how well a job is done
  // The night's supplies, before your standing orders.
  EAT: 0.45, EAT_YOU: 0.5, FARM: 4.1, CHEF_WASTE: 0.3, EQUAL_RATIONS: 1.1, RATION_CUT: 0.6,
  DRINK: 0.25, DRINK_YOU: 0.5, CROPS: 0.8, RECYCLE: 2.2,
  POWER_BASE: 1.9, POWER_ENG: 1.5, CAMERA_POWER: 1.5,
  MED_BASE: 0.25, MED_DOC: 0.6,
  LUX_YOU: 0.2, LUX_HEIR: 0.3, INFORMANT_DAILY: 1,
  // Standing orders. Each list is indexed by the setting (see POLICY_INFO in data/matters.js).
  POLICY: {
    rations: { eat: [0.7, 1, 1.3], loyalty: [-1.0, 0, 0.5] },             // staff portions; what they think of them
    shifts: { eff: [0.85, 1, 1.2], loyalty: [0.4, 0, -0.9], accident: 0.08 },   // farm and plant output; chance a night of an accident on double shifts
    heating: { power: [0, 1.0], loyalty: [-0.7, 0], med: [0.3, 0] },
    table: { food: [0, 0.8, 2.2], comfort: [0, 2.5, 5], loyalty: [0.3, 0, -0.5] },
    tub: { water: [0, 2.0], comfort: [0, 3], loyalty: [0, -0.25] },
    cinema: { power: [0, 1.3], comfort: [0, 3] },
    curfew: { fear: [0, 1.0], cap: 70, loyalty: [0, -0.5], comfort: [0, 1.5] },   // fear added a night, up to cap; what they think of it; how well you sleep
  },
  // Cruelty. Being a tyrant is restful: each cruel act gives you comfort, and adds to your infamy,
  // which slows the fading of everyone's fear. Listening to people costs comfort.
  CRUEL: { interrogate: 3, example: 6, cell: 3, exile: 4, scapegoat: 5, divide: 2, confiscate: 3 },
  INFAMY: { interrogate: 1, example: 2, cell: 1, exile: 3, scapegoat: 2, divide: 1, confiscate: 1 },
  INFAMY_FEAR: 0.06,             // each point of infamy slows the fading of fear by this share
  TALK_COMFORT: 2,               // what a quiet word costs you
  DESERT_LOYALTY: 14, DESERT_FEAR: 60, DESERT: 0.05,
  ALONE: 3,                      // with fewer staff than this the silo cannot be run at all, and you have nobody to rule   // hated and terrified: chance a night that they take a suit and go
  CELL_NIGHTS: 3, ISOLATE_DAYS: 6, SCAPEGOAT_UNREST: 14, SCAPEGOAT_FADE: 0.6, SEARCH_FADE: 0.5,
  // You. Comfort falls every night and is held up by how you live. It sets how much you get done.
  COMFORT_DECAY: 5,
  ACTIONS: [[60, 3], [30, 2], [0, 1]],   // comfort at or above -> actions a day
  INDULGE_COST: 4, INDULGE: 12,          // once a day: luxury spent on yourself, comfort gained
  CRACK_NIGHTS: 3,                       // nights at no comfort at all before you give the bunker up
  // Requests and faults.
  ASK_CHANCE: 0.5, ASK_DAYS: 3, ASK_REFUSED: 5, ASK_LATE: 4,
  FAULT_CHANCE: 0.09, PATCH: 0.4, PATCH_FAILS: 0.35, REPAIR: 3, REPAIR_NO_ENGINEER: 5,
  // Actions.
  TALK: 2, TALK_AGAIN: 3,        // loyalty for being asked; days before asking again counts
  PERK_COST: 5, PERK: 10, PERK_FADE: 0.6, INFORMANT_COST: 3, INFORMANT_TRUE: 0.84, INFORMANT_FOUND: 0.05,
  SPEECH: 6, SPEECH_FADE: 0.6, SPEECH_UNREST: 8,
  EXAMPLE_FEAR: 16, EXAMPLE_LOYALTY: 7, EXAMPLE_FEAR_TARGET: 30, EXAMPLE_LOYALTY_TARGET: 22,
  EXILE_FEAR: 12, EXILE_LOYALTY: 9, EXILE_UNREST: 8,
  PROMISE_ALL: 9, PROMISE_ONE: 14, PROMISE_UNREST: 12,
  BREAK_LOYALTY: 14, BREAK_UNREST: 12, KEEP_LOYALTY: 4,
  REMIND: 0.12,                  // chance a night that someone brings up a promise you quietly forgot
  RUMOUR_TRUE: 0.66,             // chance a rumour reflects what the person is really doing
  MUTINY_UNREST: 100,
  CRIT_NIGHTS: 3,                // nights in a row with an empty larder, tank or generator before everyone dies
};
const R = RULES;

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
export const stageOfLoyalty = (l) => { const i = R.LOYALTY_STEPS.findIndex((t) => l >= t); return i < 0 ? 6 : i; };
export const capOfFear = (f) => { const i = R.FEAR_CAPS.findIndex((t) => f >= t); return i < 0 ? 6 : i + 1; };
export const actionsFor = (comfort) => R.ACTIONS.find(([c]) => comfort >= c)[1];

// How well a job is being done: the person's step on the ladder times their skill; badly if they are gone or locked up.
function effOf(st, role) {
  const p = st.staff.find((x) => x.role === role);
  return p && p.status === 'ok' && !((p.cell || 0) > st.day) ? R.EFF_BY_STAGE[p.stage] * (p.skill || 1) : R.EFF_ABSENT;
}

// mulberry32, with its state kept in st.rng
function rnd(st) {
  st.rng = (st.rng + 0x6D2B79F5) | 0;
  let t = st.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Promises. due: days from making it until it falls due (none: a standing promise, kept by never breaking it).
export const PROMISES = {
  rations: { text: 'Equal rations for everyone', due: 4, cost: 'Your table becomes staff food for good; everyone eats a little more', keepLine: 'From tonight you eat what they eat. It is beige.' },
  cameras: { text: 'I’ll take the cameras out', due: 3, cost: 'You lose your best way of watching', keepLine: 'The cameras come down. The corridors look bigger without them.' },
  vote: { text: 'We’ll hold a vote', due: 8, cost: 'You might lose the vote', keepLine: '' },
  noexile: { text: 'Nobody gets exiled', due: 0, cost: 'You can’t remove troublemakers' },
  bunk: { text: '{n} gets the next bunk upgrade', due: 5, cost: 'Luxury, and the others feel passed over', one: true, keepLine: '{n} moves into the good bunk. The others help carry the boxes, slowly.' },
  wages: { text: 'Wages paid weekly', due: 7, cost: 'Luxury, every week', keepLine: 'Wages are paid, in wine and tinned fruit. Nobody says thank you. Nobody leaves.' },
  purges: { text: 'No more purges', due: 0, cost: 'No exiles and no examples' },
  seat: { text: 'Everyone gets a seat', due: 0, cost: 'You can’t exile anyone' },
};
export function promiseText(st, pr) {
  const who = pr.role ? st.staff.find((p) => p.role === pr.role) : null;
  return PROMISES[pr.type].text.replace('{n}', who ? who.first : '');
}

function resolve(st, who) {
  const here = st.staff.filter((p) => p.status === 'ok');
  if (who === 'all') return here;
  if (Array.isArray(who)) return here.filter((p) => who.includes(p.role));
  if (typeof who === 'object') return who && who.status === 'ok' ? [who] : [];
  if (who.startsWith('not:')) return here.filter((p) => p.role !== who.slice(4));
  return here.filter((p) => p.role === who);
}

// The handle that events, requests and actions use to change the game.
//   tag on loy(): 'gift' (greedy people love it, proud people shrug), 'punish' (proud people take it
//   badly), 'promise' and 'ideal' (true believers feel it more, both ways).
//   Every change to loyalty is also filed under st.cause in the person's own account of why (p.why),
//   which is what they tell you if you sit down and ask.
function ctx(st) {
  const move = (p, d, key) => { p.loyalty = clamp(p.loyalty + d); const k = key || st.cause; if (k) p.why[k] = (p.why[k] || 0) + d; };
  const g = {
    st, move,
    rand: () => rnd(st),
    chance: (p) => rnd(st) < p,
    pick: (arr) => arr[Math.floor(rnd(st) * arr.length)],
    here: () => st.staff.filter((p) => p.status === 'ok'),
    s: (role) => { const p = st.staff.find((x) => x.role === role); return p && p.status === 'ok' ? p : null; },
    who: (role) => st.staff.find((x) => x.role === role),
    n: (role) => st.staff.find((x) => x.role === role).first,
    res(k, d) {
      const was = st.res[k];
      st.res[k] = clamp(was + d, 0, k === 'comfort' ? 100 : R.CAP);
      st.delta[k] = (st.delta[k] || 0) + (st.res[k] - was);
    },
    loy(who, d, tag) {
      const list = resolve(st, who);
      for (const p of list) {
        let m = 1;
        if (tag === 'gift' && d > 0) m = p.trait === 'greedy' ? 1.7 : p.trait === 'proud' ? 0.6 : 1;
        if (tag === 'punish' && d < 0 && p.trait === 'proud') m = 1.7;
        if ((tag === 'promise' || tag === 'ideal') && p.trait === 'believer') m = 1.6;
        move(p, d * m);
      }
      // a gossip who has been wronged tells everyone
      if (list.length === 1 && d <= -5 && list[0].trait === 'gossip' && who !== 'all') {
        for (const p of g.here()) if (p !== list[0]) move(p, d * 0.3);
      }
    },
    fear(who, d) { for (const p of resolve(st, who)) p.fear = clamp(p.fear + d); },
    unrest(d) { st.unrest = clamp(st.unrest + d); },
    note(p, text) { if (p) p.notes.push(`Day ${st.day}: ${text}`); },
    expose(p, text) { if (p) { p.exposed = true; g.note(p, text); } },
    remove(p, status) {
      if (!p) return;
      p.status = status; p.faction = false;
      if (st.informant === p.role) st.informant = null;
      for (const pr of st.promises) if (pr.role === p.role && pr.state === 'owed') pr.state = 'void';
      st.matters = st.matters.filter((m) => m.role !== p.role);
    },
    queue(id, c = {}, pri = 1, extra = {}) { st.queue.push({ id, ctx: c, pri, ...extra }); },
    end(id) { st.ending = { id, day: st.day }; st.phase = 'ended'; },
    avgLoyalty() { const h = g.here(); return h.length ? h.reduce((a, p) => a + p.loyalty, 0) / h.length : 0; },
    faction() { return g.here().filter((p) => p.stage >= 5); },
    // What a deposed ruler gets, by how much they were liked: a bunk on level four, or the surface.
    deposed() { return g.avgLoyalty() >= 30 ? 'deposed_mutiny' : 'deposed_surface'; },
    // --- promises ---
    promise(i) { return st.promises[i]; },
    promiseText: (i) => promiseText(st, st.promises[i]),
    makePromise(type, role) {
      const def = PROMISES[type];
      st.promises.push({ type, role: role || null, made: st.day, due: def.due ? st.day + def.due : null, state: 'owed' });
      if (role) { g.loy(role, R.PROMISE_ONE * st.word, 'promise'); g.loy('not:' + role, -1.5); } else g.loy('all', R.PROMISE_ALL * st.word, 'promise');
      g.unrest(-R.PROMISE_UNREST * st.word * (role ? 0.4 : 1));
      st.stats.made++;
    },
    keep(i, late) {
      const pr = st.promises[i], def = PROMISES[pr.type];
      pr.state = 'kept'; st.stats.kept++;
      st.word = Math.min(1.6, st.word + (late ? 0.05 : 0.15));
      g.loy('all', late ? R.KEEP_LOYALTY / 2 : R.KEEP_LOYALTY, 'promise');
      if (pr.type === 'rations') { st.flags.equalRations = true; st.policy.table = 0; if (st.policy.rations < 1) st.policy.rations = 1; }
      if (pr.type === 'cameras') { st.cameras = false; st.flags.noCameras = true; }
      if (pr.type === 'vote') g.queue('vote', {}, 3);
      // (what a bunk or a week's wages costs in luxury is charged by the choice that keeps it)
      if (pr.type === 'bunk') { g.loy(pr.role, 10, 'gift'); g.loy('not:' + pr.role, -2); }
      if (pr.type === 'wages' && st.day + 7 <= R.DAYS) st.promises.push({ type: 'wages', role: null, made: st.day, due: st.day + 7, state: 'owed' });
      const who = pr.role ? g.who(pr.role) : null;
      return (def.keepLine || '').replace('{n}', who ? who.first : '');
    },
    breakP(i, mult = 1) {
      const pr = st.promises[i];
      if (pr.state === 'broken') return;
      pr.state = 'broken'; st.stats.broken++;
      st.word *= 0.5;
      const was = st.cause; st.cause = 'trust';
      g.loy('all', -R.BREAK_LOYALTY * mult, 'promise');
      st.cause = was;
      for (const p of g.here()) if (p.trait === 'believer') p.stage = Math.min(6, Math.max(p.stage + 1, 1));
      g.unrest(R.BREAK_UNREST * mult);
    },
    forget(i) { st.promises[i].state = 'forgotten'; },
    // Standing promises of these types are broken by what you just did. Returns words to add to the result.
    violate(types) {
      let hit = false;
      st.promises.forEach((pr, i) => { if (pr.state === 'owed' && types.includes(pr.type)) { g.breakP(i); hit = true; } });
      return hit ? ' You promised you would never do this. Everybody remembers that you promised.' : '';
    },
    // The ballot. Everyone still here votes for you if they are loyal, give or take.
    ballot() {
      let yes = 1, no = 0;   // you vote for yourself
      for (const p of g.here()) (p.loyalty + (rnd(st) - 0.5) * 12 >= 50 ? yes++ : no++);
      return { yes, no, win: yes >= no };
    },
  };
  return g;
}

function shuffle(st, arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd(st) * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

// picks: { role: index into CANDIDATES[role] } for who you let in at the hatch (the first of each if not given).
export function newRun(cardId, seed = (Math.random() * 2 ** 31) | 0, picks = {}) {
  const card = cardById(cardId);
  const st = {
    v: 2, seed, rng: seed | 0, card: card.id, day: 1, phase: 'report',
    res: { ...R.START }, crit: { food: 0, water: 0, power: 0 }, crack: 0, delta: {},
    policy: { rations: 1, shifts: 1, heating: 1, table: 1, tub: 1, cinema: 1, curfew: 0 }, cameras: false, infamy: 0, scapegoats: 0, searches: 0, picks,
    acts: 3, actsMax: 3, indulged: 0, eventDone: false, today: [], matters: [],
    staff: [], unrest: 0, word: 1, speeches: 0, informant: null,
    promises: [], flags: {}, queue: [], seen: {}, log: [],
    report: null, event: null, result: null, ending: null, cause: null,
    stats: { made: 0, kept: 0, broken: 0, perks: 0, talks: 0, examples: 0, exiles: 0, deaths: 0, survivedAttempts: 0, asks: 0, repairs: 0, cruel: 0 },
  };
  if (card.stores) for (const k of ['food', 'water', 'power', 'med', 'lux']) st.res[k] += card.stores;
  const vary = () => (rnd(st) * 2 - 1) * R.VARY;
  st.staff = ROLE_ORDER.map((role) => {
    const c = CANDIDATES[role][picks[role] || 0] || CANDIDATES[role][0];
    const base = { ...ROLES[role], ...c };
    const p = {
      role, name: base.name, first: base.first, title: base.title, the: base.the, wantText: base.want, trait: c.trait,
      skill: c.skill || 1, nightly: c.nightly || null,
      loyalty: clamp(card.loyalty + (c.loyalty || 0) + vary()), fear: clamp(card.fear + (c.fear || 0) + vary()), stage: 0, status: 'ok',
      grudge: role === card.grudge, perks: 0, hist: [], notes: [], why: {},
    };
    for (const k in c.bring || {}) st.res[k] += c.bring[k];
    if (p.grudge) { p.loyalty = clamp(p.loyalty - R.GRUDGE_START); p.notes.push(`Holds a grudge: ${card.grudgeLine}`); p.why.grudge = -R.GRUDGE_START; }
    p.stage = Math.min(2, stageOfLoyalty(p.loyalty), capOfFear(p.fear));
    return p;
  });
  st.unrest = clamp(18 + (55 - card.loyalty) * 0.5);
  for (const type of card.promises) {
    st.promises.push({ type, role: null, made: 0, due: type === 'vote' ? 20 : PROMISES[type].due || null, state: 'owed' });
  }
  beginDay(st, []);
  return st;
}

// --- Morning ---------------------------------------------------------------------------------------

function faceOf(st, p) {
  if (p.fear >= 66) return 'grin';                       // a fixed smile: fear hides what they think
  const x = p.loyalty + (rnd(st) * 2 - 1) * 7;
  return x >= 66 ? 'happy' : x >= 52 ? 'content' : x >= 40 ? 'flat' : x >= 27 ? 'sour' : 'angry';
}

function rumourOf(st, g, p, sure, used = []) {
  const pa = g.s('pa');
  const acc = sure ? 0.95 : R.RUMOUR_TRUE + (pa ? (pa.loyalty >= 50 ? 0.1 : -0.12) + (pa.skill - 1) * 0.35 : 0);
  let sig = p.stage;
  if (rnd(st) > acc) sig = p.stage >= 2 ? Math.floor(rnd(st) * 2) : rnd(st) < 0.5 ? p.stage + 1 + Math.floor(rnd(st) * 2) : p.stage;
  const afraid = p.fear >= 66 && rnd(st) < 0.5;
  const pool = (afraid ? RUMOURS_AFRAID : RUMOURS[sig]).filter((l) => !used.includes(l) && l !== (p.rumour && p.rumour.raw));
  const raw = g.pick(pool.length ? pool : RUMOURS[sig]);
  used.push(raw);
  return { text: raw.replace(/\{n\}/g, p.first), raw, day: st.day, sig: afraid ? -1 : sig };
}

function beginDay(st, inc) {
  const g = ctx(st);
  const here = g.here();
  const RANK = { happy: 4, content: 3, flat: 2, sour: 1, angry: 0 };
  const faces = { worse: [], better: [], grin: [] };
  for (const p of here) {
    const was = p.face;
    p.face = faceOf(st, p);
    if (was && was !== p.face) {
      if (p.face === 'grin') faces.grin.push(p.role);
      else if (was !== 'grin') (RANK[p.face] < RANK[was] ? faces.worse : faces.better).push(p.role);
    }
    // where they really are; the screen only shows it while the cameras are on
    const locked = (p.cell || 0) > st.day;
    if (p.cell === st.day) inc.push({ kind: 'you', text: `${p.first} is let out of the cell this morning, and goes back to work without a word.` });
    p.room = locked ? 'cell' : p.stage === 2 ? 'mess' : ROLES[p.role].post;
    p.night = locked ? 'cell' : p.stage >= 5 ? 'stores' : p.stage === 4 ? 'vault' : 'bunks';
  }
  // two rumours a morning, about the people you have heard least about lately
  const order = here.filter((p) => p.role !== st.informant).map((p) => ({ p, k: (p.rumour ? p.rumour.day : -9) + rnd(st) * 2 })).sort((a, b) => a.k - b.k);
  const rumours = [], used = [];
  for (const { p } of order.slice(0, 2)) { p.rumour = rumourOf(st, g, p, false, used); rumours.push({ role: p.role, text: p.rumour.text }); }
  // the informant
  let informant = null;
  const target = st.informant && g.s(st.informant);
  if (target) {
    const cleaner = g.s('cleaner');
    const honest = rnd(st) < R.INFORMANT_TRUE - (cleaner && cleaner.loyalty < 40 ? 0.25 : 0) + (cleaner ? (cleaner.skill - 1) * 0.3 : -0.1);
    const stage = honest ? target.stage : 0;
    informant = { role: target.role, text: `Your informant says ${target.first} is ${STAGES[stage]}.` };
    target.rumour = { text: informant.text, day: st.day, sig: stage, informant: true };
  }
  // what the cameras saw
  let cams = null;
  if (st.cameras) {
    const met = here.filter((p) => p.stage >= 5), idle = here.filter((p) => p.stage === 2);
    const names = (l) => l.map((p) => p.first).join(l.length === 2 ? ' and ' : ', ').replace(/, ([^,]*)$/, ' and $1');
    if (met.length >= 2) cams = `Cameras: ${names(met)} met in the stores after midnight.`;
    else if (met.length === 1) cams = `Cameras: ${met[0].first} sat alone in the stores for an hour, writing a list.`;
    else if (idle.length) cams = `Cameras: ${names(idle)} spent yesterday in the mess, not working.`;
    else cams = 'Cameras: everyone was where they should be.';
  }
  // somebody may have a request
  const asks = st.matters.filter((m) => m.kind === 'ask');
  if (st.day > 1 && asks.length < 2 && rnd(st) < R.ASK_CHANCE) {
    const free = here.filter((p) => !asks.some((m) => m.role === p.role) && !p.exposed && p.stage < 5);
    const pool = free.flatMap((p) => (p.stage >= 1 && p.stage <= 3 ? [p, p, p] : [p]));   // the unhappy ask more often
    const p = pool.length ? g.pick(pool) : null;
    if (p) {
      const defs = ASKS[p.role].filter((a) => a.key !== p.lastAsk);
      const def = g.pick(defs.length ? defs : ASKS[p.role]);
      p.lastAsk = def.key;
      st.matters.push({ kind: 'ask', role: p.role, key: def.key, born: st.day, due: st.day + R.ASK_DAYS });
    }
  }
  st.actsMax = actionsFor(st.res.comfort);
  st.acts = st.actsMax;
  const band = Math.min(4, Math.floor(st.unrest / 20));
  st.report = { day: st.day, inc, mood: g.pick(MOODS[band]), tense: band >= 3, rumours, informant, cams, faces, delta: { ...st.delta } };
  st.result = null; st.eventDone = false; st.today = [];
  st.event = pickEvent(st, g);
  st.phase = 'report';
}

function pickEvent(st, g) {
  // things that must happen today come first
  st.queue.sort((a, b) => b.pri - a.pri);
  while (st.queue.length) {
    const q = st.queue.shift(), def = EVENTS[q.id];
    const c = def.setup ? def.setup(g, q.ctx) : q.ctx;
    if (c && (!def.from || g.s(def.from))) { st.seen[q.id] = st.day; return { id: q.id, ctx: c }; }
  }
  const due = st.promises.findIndex((pr) => pr.state === 'owed' && pr.due && pr.due <= st.day);
  if (due >= 0) return { id: 'promise_due', ctx: { i: due } };
  const pool = Object.values(EVENTS).filter((e) => !e.system && (!e.from || g.s(e.from)) && (!e.when || e.when(g))
    && (st.seen[e.id] === undefined || (e.repeat && st.day - st.seen[e.id] >= 9)));
  let total = 0;
  const w = pool.map((e) => { const x = typeof e.weight === 'function' ? e.weight(g) : e.weight || 1; total += x; return x; });
  let r = rnd(st) * total, id = 'quiet';
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { id = pool[i].id; break; } }
  let c = EVENTS[id].setup ? EVENTS[id].setup(g, {}) : {};
  st.seen[id] = st.day;
  if (!c) { id = 'quiet'; c = EVENTS.quiet.setup(g, {}); }   // the card could not be set up (nobody left for it)
  return { id, ctx: c };
}

export function openDay(st) { if (st.phase === 'report') st.phase = 'day'; }

// Today's event, ready to show. Each choice: { label, cost: {res: delta}, ok, why }.
export function eventView(st) {
  const def = EVENTS[st.event.id], g = ctx(st), c = st.event.ctx;
  const from = def.anon ? null : c.role || def.from;   // an unsigned note does not show who sent it
  const choices = def.choices(g, c).map((ch) => {
    const cost = ch.c || {};
    let ok = true, why = '';
    for (const k in cost) if (cost[k] < 0 && st.res[k] + cost[k] < 0) { ok = false; why = k === 'comfort' ? 'You could not bear it' : 'Not enough in the stores'; }
    if (ok && ch.need) { const n = ch.need(g, c); if (n !== true) { ok = false; why = n || 'Not possible'; } }
    return { label: ch.t, cost, ok, why };
  });
  if (!choices.some((ch) => ch.ok)) choices.push({ label: 'Do nothing', cost: {}, ok: true, why: '', fallback: true });
  return { id: def.id, title: typeof def.title === 'function' ? def.title(g, c) : def.title, from: from && g.who(from) ? from : null, text: def.text(g, c), choices, grim: !!def.grim };
}

export function choose(st, i) {
  if (st.phase !== 'day' || st.eventDone) return;
  const def = EVENTS[st.event.id], g = ctx(st), c = st.event.ctx;
  const view = eventView(st);
  if (!view.choices[i] || !view.choices[i].ok) return;
  st.delta = {}; st.cause = 'ev:' + view.title;
  let text = 'You do nothing. It is noticed.';
  if (!view.choices[i].fallback) {
    const ch = def.choices(g, c)[i];
    for (const k in ch.c || {}) g.res(k, ch.c[k]);
    text = ch.r ? ch.r(g, c) : '';
  }
  st.cause = null;
  st.result = { title: view.title, choice: view.choices[i].label, text, delta: { ...st.delta } };
  st.eventDone = true;
  st.log.push({ day: st.day, event: def.id, choice: i });
}

// --- Standing orders ----------------------------------------------------------------------------------

export function setPolicy(st, key, v) {
  if (st.phase !== 'day') return false;
  if (key === 'cameras') { if (st.flags.noCameras && v) return false; st.cameras = !!v; return true; }
  const def = R.POLICY[key];
  if (!def || v < 0 || v >= Object.values(def).find(Array.isArray).length) return false;
  if (st.flags.equalRations && ((key === 'table' && v > 0) || (key === 'rations' && v < 1))) return false;
  st.policy[key] = v;
  return true;
}
export const policyValue = (st, key) => (key === 'cameras' ? +st.cameras : st.policy[key]);
// Why a setting cannot be chosen, or ''.
export function policyBlock(st, key, v) {
  if (key === 'cameras' && v && st.flags.noCameras) return 'You took them out, as promised';
  if (st.flags.equalRations && ((key === 'table' && v > 0) || (key === 'rations' && v < 1))) return 'You promised equal rations';
  return '';
}
// What a setting costs or saves each night, set against the plainest setting (for the screen).
export function policyCost(st, key, v) {
  const P = R.POLICY, n = st.staff.filter((p) => p.status === 'ok').length;
  const eff = (role) => effOf(st, role);
  switch (key) {
    case 'rations': return { food: -R.EAT * n * (P.rations.eat[v] - 1) };
    case 'shifts': return { food: R.FARM * eff('farmer') * (P.shifts.eff[v] - 1), water: R.RECYCLE * eff('engineer') * (P.shifts.eff[v] - 1) };
    case 'heating': return { power: -P.heating.power[v] };
    case 'cameras': return { power: v ? -R.CAMERA_POWER : 0 };
    case 'table': return { food: -P.table.food[v], comfort: P.table.comfort[v] };
    case 'tub': return { water: -P.tub.water[v], comfort: P.tub.comfort[v] };
    case 'cinema': return { power: -P.cinema.power[v], comfort: P.cinema.comfort[v] };
    case 'curfew': return { comfort: P.curfew.comfort[v] };
    default: return {};
  }
}
// Once a day: something old and expensive, opened for yourself.
export function indulge(st) {
  if (st.phase !== 'day' || st.indulged === st.day || st.res.lux < R.INDULGE_COST) return null;
  const g = ctx(st);
  st.delta = {};
  g.res('lux', -R.INDULGE_COST); g.res('comfort', R.INDULGE);
  st.indulged = st.day;
  const text = g.pick(['You open a bottle older than the engineer and drink it alone, slowly.', 'An hour with the good cigars and the door locked.', 'You have the silver polished, and then you look at it.', 'Caviar, on the last of the proper crackers.']);
  st.today.push({ title: 'For yourself', text, delta: { ...st.delta } });
  return text;
}

// --- Matters: requests and faults ---------------------------------------------------------------------

export function matterView(st) {
  const g = ctx(st);
  const afford = (cost) => { for (const k in cost) if (cost[k] < 0 && st.res[k] + cost[k] < 0) return false; return true; };
  return st.matters.map((m, i) => {
    if (m.kind === 'ask') {
      const p = g.who(m.role), def = ASKS[m.role].find((a) => a.key === m.key);
      const ok = afford(def.c) && (!def.act || st.acts > 0);
      return {
        i, kind: 'ask', role: m.role, zone: ROLES[m.role].post, title: `${p.first} asks`, text: def.text(p.first), left: m.due - st.day,
        choices: [{ id: 'yes', label: def.t, cost: def.c, act: !!def.act, ok, why: ok ? '' : def.act && st.acts <= 0 ? 'No actions left today' : 'You can’t spare it' }, { id: 'no', label: 'Say no', cost: {}, ok: true, why: '' }],
      };
    }
    const def = FAULTS[m.sys], eng = g.s('engineer');
    const price = { lux: -(eng && eng.stage < 3 ? R.REPAIR : R.REPAIR_NO_ENGINEER) };
    const choices = [{ id: 'repair', label: 'Repair it properly, with parts from your stores', cost: price, ok: afford(price), why: afford(price) ? '' : 'Nothing left to strip for parts' }];
    if (!m.patched) choices.push({ id: 'patch', label: 'Patch it', cost: {}, ok: true, why: '' });
    if (!m.inspected) choices.push({ id: 'inspect', label: 'Go and look at it yourself', cost: {}, act: true, ok: st.acts > 0, why: st.acts > 0 ? '' : 'No actions left today' });
    const drain = def.drain * (m.patched ? R.PATCH : 1);
    return {
      i, kind: 'fault', zone: def.zone, sys: m.sys, title: def.name, patched: !!m.patched, drain: { [def.res]: -drain },
      text: def.text + (m.patched ? ' It is patched, for now.' : '') + (m.finding ? ' ' + m.finding : ''), choices,
    };
  });
}

export function decide(st, i, id) {
  if (st.phase !== 'day') return null;
  const view = matterView(st)[i], m = st.matters[i];
  const ch = view && view.choices.find((c) => c.id === id);
  if (!ch || !ch.ok) return null;
  const g = ctx(st);
  st.delta = {};
  for (const k in ch.cost) g.res(k, ch.cost[k]);
  if (ch.act) st.acts--;
  let text = '', gone = true;
  if (m.kind === 'ask') {
    const p = g.s(m.role), def = ASKS[m.role].find((a) => a.key === m.key);
    if (id === 'yes') { st.cause = 'ask:yes'; text = def.r(g, p); st.stats.asks++; } else { st.cause = 'ask:no'; g.loy(p, -R.ASK_REFUSED, 'punish'); text = def.no(p.first); }
  } else if (id === 'repair') {
    text = `${view.title} is mended, with wire from your chandelier and a bearing from your exercise bike.`;
    st.stats.repairs++;
  } else if (id === 'patch') {
    m.patched = true; gone = false;
    text = 'Tape, a jubilee clip and a prayer. It still loses a little of what it should hold.';
  } else {
    m.inspected = true; gone = false;
    g.fear('all', 1);
    const by = m.by ? g.s(m.by) : null;
    if (m.by) {
      m.finding = 'This was done on purpose.';
      text = 'You get down on your knees with a torch. The bolts were undone from the inside, and the scratches are fresh. This was done on purpose' + (m.seen && by ? `, and the cameras have ${by.first} at it at three in the morning.` : ', by somebody who knows the machine.');
      if (m.seen && by) g.note(by, `caught on camera breaking ${view.title.toLowerCase()}`);
    } else {
      m.finding = 'It was only wear.';
      text = 'You get down on your knees with a torch. Metal fatigue, a perished seal. Nobody did this but time.';
    }
  }
  st.cause = null;
  if (gone) st.matters.splice(i, 1);
  st.today.push({ title: view.title, text, delta: { ...st.delta } });
  st.log.push({ day: st.day, matter: m.kind, id });
  return text;
}

// --- Actions: as many a day as your comfort allows ------------------------------------------------------

const ACTION_DEFS = [
  { id: 'talk', group: 'Listen', name: 'A quiet word', short: 'Quiet word', hint: 'Ask one person what is wrong. They may tell you. It is tiresome.', cost: { comfort: -R.TALK_COMFORT }, target: true },
  { id: 'interrogate', group: 'Listen', evil: true, name: 'Interrogate', short: 'Interrogate', hint: 'Two in the morning, a bright light. You learn exactly what they are up to. They do not forget it.', target: true },
  { id: 'perk', group: 'Spend', name: 'Give a perk', short: 'Give a perk', hint: 'Loyalty up quickly, for one person. Works less each time.', cost: { lux: -R.PERK_COST }, target: true },
  { id: 'informant', group: 'Watch', name: 'Pay an informant', short: 'Informant', hint: 'A report on one person every morning. Paid in luxury. Might lie, might be found out.', cost: { lux: -R.INFORMANT_COST }, target: true },
  { id: 'test', group: 'Watch', name: 'Loyalty test', short: 'Loyalty test', hint: 'Find out if one person is loyal. Offends the loyal ones.', target: true },
  { id: 'example', group: 'Punish', evil: true, name: 'Make an example', short: 'Make an example', hint: 'Fear up for everyone. Loyalty down for everyone. They may want revenge.', target: true },
  { id: 'cell', group: 'Punish', evil: true, name: 'Lock in the cell', short: 'The cell', hint: 'Three nights behind bars. They can plot nothing in there. Their job is done badly meanwhile.', target: true },
  { id: 'exile', group: 'Punish', evil: true, name: 'Exile to the surface', short: 'Exile', hint: 'Removes a problem for good. You lose their skills and the others are horrified.', target: true },
  { id: 'scapegoat', group: 'Rule', evil: true, name: 'Find a scapegoat', short: 'Scapegoat', hint: 'Blame one person, in public, for everything that is wrong. The bunker calms down. That person never forgives you.', target: true },
  { id: 'divide', group: 'Rule', evil: true, name: 'Divide and rule', short: 'Divide and rule', hint: 'Tell one person the others are informing on them. For a week they trust nobody and can organise nothing.', target: true },
  { id: 'confiscate', group: 'Rule', evil: true, name: 'Search the bunks', short: 'Search the bunks', hint: 'Seize what they have been hiding: food and valuables for you. Everyone resents it.' },
  { id: 'speech', group: 'Promise', name: 'Give a speech', short: 'Speech', hint: 'A small loyalty boost. Each speech works less than the last.' },
  { id: 'promise', group: 'Promise', name: 'Make a promise', short: 'Promise', hint: 'Loyalty now, for nothing. A debt later. Nobody says you have to mean it.', sub: true },
];

export function actionList(st) {
  return ACTION_DEFS.map((o) => {
    const d = { ...o, ok: true, why: '' };
    if (o.id === 'informant' && st.informant) d.hint = `Move your informant from ${st.staff.find((p) => p.role === st.informant).first} to someone else.`;
    for (const k in o.cost || {}) if (st.res[k] + o.cost[k] < 0) { d.ok = false; d.why = k === 'comfort' ? 'You have not the patience today' : 'Not enough luxury'; }
    if (o.id === 'promise' && !promiseList(st).some((p) => p.ok)) { d.ok = false; d.why = 'Nothing left to promise'; }
    if (st.acts <= 0) { d.ok = false; d.why = 'No actions left today'; }
    return d;
  });
}

export function promiseList(st) {
  const owed = (t) => st.promises.some((pr) => pr.type === t && (pr.state === 'owed' || pr.state === 'forgotten'));
  const done = (t) => st.promises.some((pr) => pr.type === t);
  const mk = (type, ok, why) => ({ type, name: PROMISES[type].text.replace('{n}', 'One person'), cost: PROMISES[type].cost, due: PROMISES[type].due, target: !!PROMISES[type].one, ok, why: ok ? '' : why });
  return [
    mk('rations', !done('rations'), 'Already promised'),
    mk('cameras', st.cameras && !done('cameras'), st.cameras ? 'Already promised' : 'There are no cameras to take out'),
    mk('vote', !done('vote') && st.day + PROMISES.vote.due <= R.DAYS, done('vote') ? 'Already promised' : 'Too late to hold one'),
    mk('noexile', !owed('noexile') && !owed('purges') && !owed('seat') && !done('noexile'), 'Already promised'),
    mk('bunk', !owed('bunk') && st.day + PROMISES.bunk.due <= R.DAYS, 'One bunk upgrade at a time'),
  ];
}

const PERKS = ['a case of your second-best wine', 'a real coffee, with real coffee in it', 'an hour in the hot tub, alone', 'the good blanket', 'a tin of peaches and a silver spoon to eat it with', 'your spare dressing gown'];

// What someone says when asked what is wrong. Frightened people say nothing true; plotters say something small.
function whyLine(key, good, p) {
  if (key === 'want') return good ? 'I have what I asked for. That counts.' : `What do I want? ${p.wantText} I am not getting it.`;
  if (key.startsWith('ev:')) return good ? `That business with “${key.slice(3).toLowerCase()}”: you did right by us.` : `It was that business with “${key.slice(3).toLowerCase()}”. You know what you did.`;
  return (good ? WHY_GOOD : WHY_BAD)[key] || (good ? 'Things have been a little better.' : 'A lot of small things.');
}
function talk(st, g, p) {
  if (st.day - (p.talked ?? -9) >= R.TALK_AGAIN) g.loy(p, R.TALK + (p.trait === 'proud' ? 2 : 0));
  p.talked = st.day; p.noticed = st.day; st.stats.talks++;
  let said;
  if (p.fear >= 66) said = g.pick(SAYS.afraid);
  else if (p.stage >= 5) said = g.pick(SAYS.cover);
  else {
    const all = Object.entries(p.why).filter(([k]) => k !== 'or:talk');
    const bad = all.filter(([, v]) => v <= -1.5).sort((a, b) => a[1] - b[1])[0];
    const good = all.filter(([, v]) => v >= 1.5).sort((a, b) => b[1] - a[1])[0];
    said = (bad ? whyLine(bad[0], false, p) : g.pick(SAYS.none)) + (good ? ' ' + whyLine(good[0], true, p) : '');
  }
  p.said = { day: st.day, text: said };
  return `You sit down with ${p.first}. “${said}”${p.fear >= 66 ? ` ${p.first} keeps smiling until you leave.` : ''}`;
}

export function act(st, id, arg = {}) {
  if (st.phase !== 'day') return null;
  const g = ctx(st), def = actionList(st).find((o) => o.id === id);
  if (!def || !def.ok) return null;
  const p = arg.role ? g.s(arg.role) : null;
  if (def.target && !p) return null;
  if (id === 'promise') { const opt = promiseList(st).find((o) => o.type === arg.type); if (!opt || !opt.ok || (opt.target && !p)) return null; }
  st.delta = {}; st.cause = 'or:' + id;
  for (const k in def.cost || {}) g.res(k, def.cost[k]);
  let text = '', title = def.name;
  switch (id) {
    case 'talk': text = talk(st, g, p); title = `A talk with ${p.first}`; break;
    case 'perk': {
      g.loy(p, R.PERK * Math.pow(R.PERK_FADE, p.perks), 'gift');
      p.perks++; p.noticed = st.day; st.stats.perks++;
      g.loy('not:' + p.role, p.trait === 'gossip' ? -2 : -1);
      const react = p.trait === 'greedy' ? 'They check it twice and smile with all their teeth.' : p.trait === 'proud' ? 'They accept it as no more than their due.' : p.trait === 'gossip' ? 'By supper everyone has heard about it, in detail.' : 'They seem pleased.';
      text = `${p.first} gets ${g.pick(PERKS)}. ${react}`;
      break;
    }
    case 'interrogate': {
      const worst = Object.entries(p.why).filter(([k, v]) => v <= -1.5 && k !== 'or:interrogate').sort((x, y) => x[1] - y[1])[0];
      g.loy(p, -6, 'punish'); g.fear(p, 12); g.fear('not:' + p.role, 3);
      const said = worst ? whyLine(worst[0], false, p) : 'There is nothing. I swear there is nothing.';
      p.rumour = { text: `Under questioning: ${p.first} is ${STAGES[p.stage]}.`, day: st.day, sig: p.stage, informant: true };
      p.said = { day: st.day, text: said };
      g.note(p, `interrogated; was ${STAGES[p.stage]}`);
      if (p.stage >= 6) g.expose(p, 'admitted under questioning to planning to remove you');
      text = `You have ${p.first} woken at two in the morning and ask the same questions until dawn. ${p.first} is ${STAGES[p.stage]}. “${said}”`;
      title = `${p.first}, at 2am`;
      break;
    }
    case 'cell': {
      p.cell = st.day + R.CELL_NIGHTS;
      g.loy(p, -10, 'punish'); g.fear(p, 14); g.fear('not:' + p.role, 8); g.loy('not:' + p.role, -3);
      g.note(p, 'locked in the cell for three nights');
      text = `${p.first} is marched down to the cell on the security level. The door makes a very satisfying noise. Somebody else will have to do the job for three nights.` + g.violate(['purges']);
      break;
    }
    case 'scapegoat': {
      const f = Math.pow(R.SCAPEGOAT_FADE, st.scapegoats);
      st.scapegoats++;
      g.loy(p, -22, 'punish'); g.fear(p, 10);
      g.loy('not:' + p.role, 3 * f); g.unrest(-R.SCAPEGOAT_UNREST * f);
      if (p.trait === 'proud') p.grudge = true;
      g.note(p, 'blamed in public for everything');
      text = `You call everyone to the mess hall and explain, with slides, that every shortage, breakdown and bad smell in this bunker is the fault of ${p.first}. ${f > 0.7 ? 'It is astonishing how much better everyone feels.' : 'It works less well than last time. People are starting to notice the pattern.'} ${p.first} says nothing.`;
      break;
    }
    case 'divide': {
      const others = g.here().filter((q) => q !== p);
      const q = others.length ? g.pick(others) : null;
      p.isolated = st.day + R.ISOLATE_DAYS;
      g.loy(p, -4); if (q) { g.loy(q, -4); q.isolated = Math.max(q.isolated || 0, st.day + 3); }
      g.unrest(-8);
      text = q ? `You tell ${p.first}, in confidence, that ${q.first} has been reporting on them. Then you tell ${q.first} the same about ${p.first}. They stop sitting together. They stop sitting with anyone.` : `You tell ${p.first} that everyone is reporting on them. There is no one else left for it to be true of.`;
      break;
    }
    case 'confiscate': {
      const f = Math.pow(R.SEARCH_FADE, st.searches);
      st.searches++;
      g.res('food', Math.round(5 * f)); g.res('lux', Math.round(4 * f));
      g.loy('all', -5); g.fear('all', 4);
      text = f > 0.7 ? 'Every bunk is turned out at dawn. Tinned peaches, a ham, two bottles of your own brandy and a surprising amount of chocolate. It all goes up in the lift to your floor.' : 'Every bunk is turned out again. They have learned to hide things better, or there is less to hide. A few tins. A great deal of silence.';
      break;
    }
    case 'informant':
      st.informant = p.role;
      text = `Somebody will keep an eye on ${p.first} and report to you each morning. They want paying every day.`;
      break;
    case 'test': {
      const loyal = p.loyalty >= 50;
      p.tested = { day: st.day, loyal };
      if (loyal) { g.loy(p, p.trait === 'proud' ? -13 : -7); text = `You leave a “lost” master key where ${p.first} will find it. It is back on your desk within the hour, with a note. ${p.first} is loyal, and now knows you had to check.`; } else { g.fear(p, 8); text = `You leave a “lost” master key where ${p.first} will find it. It is not handed in. ${p.first} is not loyal, and now knows that you know.`; }
      g.note(p, loyal ? 'passed a loyalty test' : 'failed a loyalty test');
      break;
    }
    case 'example': {
      const proud = p.trait === 'proud';
      g.fear('not:' + p.role, R.EXAMPLE_FEAR); g.loy('not:' + p.role, -R.EXAMPLE_LOYALTY);
      g.fear(p, proud ? 10 : R.EXAMPLE_FEAR_TARGET); g.loy(p, -R.EXAMPLE_LOYALTY_TARGET, 'punish');
      if (proud) p.grudge = true;
      const avgFear = g.here().reduce((a, x) => a + x.fear, 0) / g.here().length;
      g.unrest(avgFear >= 50 ? -6 : 6);
      st.stats.examples++; p.noticed = st.day;
      g.note(p, 'made an example of');
      text = `${p.first} scrubs the reactor floor with a toothbrush while the others are made to watch. Nobody says anything.${proud ? ` ${p.first} looks at you the whole time.` : ''}` + g.violate(['purges']);
      break;
    }
    case 'exile': {
      const just = !!p.exposed;
      g.remove(p, 'exiled');
      g.fear('all', R.EXILE_FEAR + (just ? 5 : 0)); g.loy('all', just ? -2 : -R.EXILE_LOYALTY, 'ideal');
      g.unrest(just ? 0 : R.EXILE_UNREST);
      st.stats.exiles++;
      text = `${p.first} is given a suit, a mask and a short walk to the hatch. ${just ? 'Nobody argues. They know what ' + p.first + ' tried to do.' : 'The others watch the lift go up and come back empty.'} Somebody untrained will have to do the job now.` + g.violate(['noexile', 'purges', 'seat']);
      break;
    }
    case 'speech': {
      const f = Math.pow(R.SPEECH_FADE, st.speeches);
      g.loy('all', R.SPEECH * f); g.unrest(-R.SPEECH_UNREST * f);
      text = ['You speak in the mess hall about sacrifice, family and the future. There is real applause.', 'You speak again about sacrifice. The applause is polite. Somebody checks the clock.', 'You speak about sacrifice a third time, from behind a glass of wine. People clap the way they queue.', 'You give a speech. They have heard it. Someone mouths along.'][Math.min(3, st.speeches)];
      st.speeches++;
      break;
    }
    case 'promise': {
      const opt = promiseList(st).find((o) => o.type === arg.type);
      g.makePromise(arg.type, opt.target ? p.role : null);
      const pr = st.promises[st.promises.length - 1];
      text = `You promise: “${promiseText(st, pr)}.” ${st.word < 0.8 ? 'A few people remember your last promise and say nothing.' : 'The mood lifts at once. It cost you nothing, today.'}${pr.due ? ` It falls due on day ${pr.due}.` : ''}`;
      break;
    }
    default: st.cause = null; return null;
  }
  st.cause = null;
  st.acts--;
  if (R.CRUEL[id]) {            // it felt good
    g.res('comfort', R.CRUEL[id]);
    st.infamy += R.INFAMY[id]; st.stats.cruel++;
  }
  st.today.push({ title, text, delta: { ...st.delta } });
  st.log.push({ day: st.day, order: id, role: arg.role, type: arg.type });
  return text;
}

// --- Night ------------------------------------------------------------------------------------------

// What one night takes from each store and from your comfort, as things stand (no dice).
function nightly(st) {
  const P = R.POLICY, pol = st.policy;
  const eff = (role) => effOf(st, role);
  const live = st.staff.filter((p) => p.status === 'ok');
  const n = live.length, work = P.shifts.eff[pol.shifts];
  const heir = st.staff.find((x) => x.role === 'heir');
  const extra = (k) => live.reduce((a, p) => a + ((p.nightly && p.nightly[k]) || 0), 0);   // what the people you chose bring or cost each night
  const out = {
    food: -(R.EAT * n * P.rations.eat[pol.rations] * (st.flags.equalRations ? R.EQUAL_RATIONS : 1) * ((st.flags.rationCut || 0) > st.day ? R.RATION_CUT : 1) + R.EAT_YOU + P.table.food[pol.table]) * (1 + R.CHEF_WASTE * (1 - eff('chef')))
      + R.FARM * eff('farmer') * work * (st.res.water > 0 ? 1 : 0.3),
    water: -(R.DRINK * n + R.DRINK_YOU + R.CROPS + P.tub.water[pol.tub]) + R.RECYCLE * eff('engineer') * work,
    power: -(R.POWER_BASE - R.POWER_ENG * eff('engineer')) - P.heating.power[pol.heating] - P.cinema.power[pol.cinema] - (st.cameras ? R.CAMERA_POWER : 0),
    med: -(R.MED_BASE + R.MED_DOC * (1 - eff('doctor')) + P.heating.med[pol.heating]),
    lux: -(R.LUX_YOU + (heir && heir.status === 'ok' ? R.LUX_HEIR : 0) + (st.informant ? R.INFORMANT_DAILY : 0)),
    comfort: -R.COMFORT_DECAY + P.table.comfort[pol.table] + (st.res.water > 0 ? P.tub.comfort[pol.tub] : 0) + (st.res.power > 0 ? P.cinema.comfort[pol.cinema] : 0) + P.curfew.comfort[pol.curfew],
  };
  for (const k of ['food', 'lux', 'comfort']) out[k] += extra(k);
  return out;
}
// The same, with what the broken machines are losing: what the bar shows as tonight's change.
// (It knows how well each job is really being done, so a slacker shows up here before anywhere else.)
export function forecast(st) {
  const f = nightly(st);
  for (const m of st.matters) if (m.kind === 'fault') f[FAULTS[m.sys].res] -= FAULTS[m.sys].drain * (m.patched ? R.PATCH : 1);
  return f;
}

function attemptEvent(role) {
  return { chef: 'chef_special', engineer: 'airlock', doctor: 'vitamin', security: 'master_keys' }[role] || 'midnight_note';
}

export function endDay(st) {
  if (st.phase !== 'day' || !st.eventDone) return;
  const g = ctx(st), inc = [], P = R.POLICY, pol = st.policy;
  st.delta = {};
  const here = g.here();
  const sec = g.s('security'), secOK = sec && sec.stage < 3 && !((sec.cell || 0) > st.day);

  // Requests nobody answered.
  st.matters = st.matters.filter((m) => {
    if (m.kind !== 'ask' || st.day < m.due) return true;
    const p = g.s(m.role);
    if (p) { g.move(p, -R.ASK_LATE, 'ask:late'); inc.push({ kind: 'bad', text: `${p.first} asked you for something three days ago and has stopped expecting an answer.` }); }
    return false;
  });

  // 1. Staff react: hidden loyalty and fear shift.
  const contagion = Math.max(0, (st.unrest - 40) / 40);
  const hungry = st.res.food < 12 || (st.flags.rationCut || 0) > st.day;
  for (const p of here) {
    for (const k in p.why) { p.why[k] *= 0.8; if (Math.abs(p.why[k]) < 0.3) delete p.why[k]; }   // old reasons fade
    g.move(p, ROLES[p.role].wantMet(st, p) ? R.WANT_MET : R.WANT_UNMET, 'want');
    if (st.cameras) g.move(p, -R.CAMERA_LOYALTY, 'cameras');
    if (p.grudge) g.move(p, -R.GRUDGE, 'grudge');
    g.move(p, -R.CABIN * st.day, 'cabin');
    const trust = st.stats.kept * R.TRUST_KEPT - st.stats.broken * R.TRUST_BROKEN;
    if (trust) g.move(p, trust, 'trust');
    if (contagion) g.move(p, -contagion, 'unrest');
    if (hungry) g.move(p, -R.HUNGER, 'hunger');
    if (P.rations.loyalty[pol.rations]) g.move(p, P.rations.loyalty[pol.rations], 'rations');
    if (P.shifts.loyalty[pol.shifts]) g.move(p, P.shifts.loyalty[pol.shifts], 'shifts');
    if (P.heating.loyalty[pol.heating]) g.move(p, P.heating.loyalty[pol.heating], 'heating');
    if (P.table.loyalty[pol.table]) g.move(p, P.table.loyalty[pol.table], 'table');
    if (pol.tub) g.move(p, P.tub.loyalty[1] * (p.role === 'farmer' ? 3 : 1), 'tub');
    if (pol.curfew) g.move(p, P.curfew.loyalty[1], 'curfew');
    p.fear = clamp(p.fear + (R.FEAR_REST - p.fear) * R.FEAR_DECAY * (secOK ? 0.5 / sec.skill : 1.5) * (st.res.lux <= 0 ? 1.5 : 1) / (1 + st.infamy * R.INFAMY_FEAR));
    if (pol.curfew && p.fear < P.curfew.cap) p.fear = Math.min(P.curfew.cap, p.fear + P.curfew.fear[1] * (secOK ? 1 : 0.4));
  }

  // 2. Threat check: does anyone dare to act?
  const seen = (p) => (st.cameras ? ` Cameras: ${p.first} was there at 3am.` : '');
  const faulty = (sys) => st.matters.some((m) => m.sys === sys);
  for (const p of here) {
    const want = Math.min(stageOfLoyalty(p.loyalty), capOfFear(p.fear), (p.isolated || 0) > st.day ? 4 : 6);   // set against the others, they cannot organise
    if (want > p.stage) { if (g.chance(R.CLIMB)) p.stage++; } else if (want < p.stage) p.stage = Math.max(want, p.stage - 2);
    p.faction = p.stage >= 5;
    if ((p.cell || 0) > st.day) { p.faction = false; continue; }      // locked up: they can do nothing tonight
    // Terror has a price. Someone who hates you and dares do nothing else may simply leave.
    if (p.loyalty < R.DESERT_LOYALTY && p.fear >= R.DESERT_FEAR && g.chance(R.DESERT)) {
      g.remove(p, 'exiled'); p.fled = st.day;
      for (const q of here) if (q !== p) g.move(q, -3, 'or:exile');
      inc.push({ kind: 'bad', text: `${p.first} took a suit from the airlock in the night and went up to the surface, rather than spend another day down here with you. Nobody else can do that job properly.` });
      continue;
    }
    const sabotage = () => {
      // the people who run a machine break the machine; it then sits there until somebody mends it
      const sys = (SABOTEUR[p.role] || []).filter((s) => !faulty(s));
      if (sys.length) {
        const s = g.pick(sys);
        st.matters.push({ kind: 'fault', sys: s, born: st.day, by: p.role, seen: st.cameras });
        inc.push({ kind: 'bad', text: FAULTS[s].text });
        return;
      }
      const [k, d, line] = SABOTAGE[p.role];
      g.res(k, d);
      if (p.role === 'security') g.fear('all', -4);
      if (p.role === 'pa') for (const q of here) g.move(q, -2, 'table');
      inc.push({ kind: 'bad', text: line + seen(p) });
      if (st.cameras) g.note(p, 'caught on camera where something went wrong');
    };
    const theft = () => {
      const [k, d, line] = g.pick(THEFT);
      g.res(k, d);
      inc.push({ kind: 'bad', text: line + seen(p) });
      if (st.cameras) g.note(p, 'caught on camera near your stores');
    };
    if (p.stage === 3) { if (g.chance(R.P_SABOTAGE)) sabotage(); } else if (p.stage === 4) { if (g.chance(R.P_THEFT)) theft(); else if (g.chance(0.12)) sabotage(); } else if (p.stage === 5) { if (g.chance(0.15)) theft(); } else if (p.stage >= 6 && !st.queue.some((q) => q.attempt) && g.chance(R.P_ATTEMPT)) {
      g.queue(attemptEvent(p.role), { role: p.role }, 4, { attempt: true });
    }
  }
  let du = 0;
  for (const p of here) du += R.UNREST_BY_STAGE[p.stage] * ((p.cell || 0) > st.day || (p.isolated || 0) > st.day ? 0.4 : 1);
  g.unrest(du);
  const faction = g.faction();
  if ((st.flags.mutinyCool || 0) <= st.day && !st.queue.some((q) => q.id === 'mutiny')
    && (faction.length >= Math.max(3, Math.ceil(here.length / 2)) || st.unrest >= R.MUTINY_UNREST)) {
    g.queue('mutiny', {}, 5);
  }

  // The informant may be found out.
  const target = st.informant && g.s(st.informant);
  if (target) {
    const pa = g.s('pa'), cleaner = g.s('cleaner');
    const leaky = (pa && pa.loyalty < 40) || (cleaner && cleaner.loyalty < 40);
    if (g.chance(R.INFORMANT_FOUND * (leaky ? 2.5 : 1))) {
      st.informant = null;
      g.move(target, -15, 'informant');
      for (const q of here) if (q !== target) g.move(q, -4, 'informant');
      g.unrest(6);
      inc.push({ kind: 'bad', text: `${target.first} caught your informant going through their bunk. Everybody knows whose informant it was.` });
    }
  }
  // A promise you quietly forgot may be remembered for you.
  st.promises.forEach((pr, i) => {
    if (pr.state !== 'forgotten' || st.queue.some((q) => q.id === 'promise_reminded')) return;
    const gossip = here.some((p) => p.trait === 'gossip' && p.loyalty < 55);
    if (g.chance(R.REMIND * (gossip ? 2.2 : 1))) g.queue('promise_reminded', { i }, 2);
  });

  // Machinery: old faults drain, patches fail, and now and then something new wears out.
  for (const m of st.matters) {
    if (m.kind !== 'fault') continue;
    if (m.patched && g.chance(R.PATCH_FAILS)) { m.patched = false; inc.push({ kind: 'bad', text: `The patch on ${FAULTS[m.sys].name.toLowerCase()} has given way.` }); }
    g.res(FAULTS[m.sys].res, -FAULTS[m.sys].drain * (m.patched ? R.PATCH : 1));
  }
  if (st.matters.filter((m) => m.kind === 'fault').length < 2 && g.chance(R.FAULT_CHANCE * (pol.shifts === 2 ? 1.6 : 1) * (g.s('engineer') ? 1 : 2.5))) {
    const free = Object.keys(FAULTS).filter((s) => !faulty(s));
    if (free.length) { const s = g.pick(free); st.matters.push({ kind: 'fault', sys: s, born: st.day, by: null }); inc.push({ kind: 'bad', text: FAULTS[s].text }); }
  }
  if (pol.shifts === 2 && g.chance(P.shifts.accident)) {
    g.res('med', -3);
    for (const q of here) g.move(q, -1.5, 'shifts');
    inc.push({ kind: 'bad', text: 'Somebody fell asleep at a machine on the double shift. Stitches, and a lot of muttering.' });
  }

  // 3. Night: the silo uses up supplies, and so do you.
  const before = st.res.comfort;
  const night = nightly(st);
  for (const k in night) g.res(k, night[k]);

  for (const p of st.staff) p.hist.push(p.status === 'ok' ? [Math.round(p.loyalty), Math.round(p.fear), p.stage] : null);
  st.unrestHist = st.unrestHist || []; st.unrestHist.push(Math.round(st.unrest));

  // 4. Has the silo been squeezed too hard? Have you?
  const names = { food: 'The larder is empty', water: 'The water tanks are dry', power: 'The generator has stopped and the air is going stale' };
  for (const k of ['food', 'water', 'power']) {
    st.crit[k] = st.res[k] <= 0 ? st.crit[k] + 1 : 0;
    if (st.crit[k] >= R.CRIT_NIGHTS) { g.end('everyone_' + k); return; }
    if (st.crit[k] >= 1) {
      for (const q of here) g.move(q, -4, 'crit');
      g.unrest(6);
      inc.push({ kind: 'crit', text: `${names[k]}. ${st.crit[k] === 1 ? 'The silo cannot run like this for long.' : 'One more night like this and nobody wakes up.'}` });
      if (!st.queue.some((q) => q.id === 'crisis')) g.queue('crisis', { k }, 6);
    }
  }
  if (g.here().length < R.ALONE) { g.end('deposed_alone'); return; }
  st.crack = st.res.comfort <= 0 ? st.crack + 1 : 0;
  if (st.crack >= R.CRACK_NIGHTS) { g.end('deposed_cracked'); return; }
  if (st.day >= R.DAYS) { g.end(finalEnding(st, g)); return; }
  const now = actionsFor(st.res.comfort);
  if (st.crack >= 1) inc.push({ kind: 'crit', text: 'You have not slept, eaten properly or been warm for days. You cannot go on like this much longer.' });
  else if (now < actionsFor(before)) inc.push({ kind: 'you', text: now === 2 ? 'You slept badly and woke up cross. You will get less done today.' : 'You are cold, tired and living like the staff. You can manage one thing today.' });
  st.day++;
  beginDay(st, inc);
}

function finalEnding(st, g) {
  const here = g.here();
  if (st.unrest >= 75 || g.faction().length >= Math.max(2, Math.ceil(here.length / 2))) return 'deposed_hatch';
  for (const pr of st.promises) if (pr.state === 'owed' && !pr.due) { pr.state = 'kept'; st.stats.kept++; }
  const bad = st.promises.some((pr) => pr.state === 'broken' || pr.state === 'forgotten' || pr.state === 'owed');
  const kinds = new Set(st.promises.filter((pr) => pr.state === 'kept').map((pr) => pr.type));
  if (!bad && kinds.size >= 3 && st.stats.kept >= 4) return 'word';
  return st.res.lux >= 10 && st.res.comfort >= 40 ? 'king' : 'king_poor';
}

export { ctx as _ctx };
