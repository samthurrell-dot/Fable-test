// engine/sim.js
// The rules of Bunker Billionaire. Pure: no DOM, no timers, and the only randomness is a seeded
// generator kept inside the state, so a run can be saved, reloaded and replayed from its seed.
//
// The goal: live as lavishly as you can (opulence, st.res.opu, is the score) and still be in charge
// when the hatch opens on day 30.
// One day is: report -> day -> (lights out) -> night -> next report. During the day you may, in any order:
//   answer today's event           eventView(st), choose(st, i)            (must be done before lights out)
//   play cards from your hand      handView(st), playCard(st, i, arg)      (RULES.PLAYS a day)
//   set rations and lifestyle      setPolicy(st, key, value)               (free; they bite at night)
//   commission a project           projectList(st), commission(st, id)     (the upgrade path)
//   mend what is broken            matterView(st), decide(st, i, id)
//   answer a request, and work on what you promised   requestView(st), answer(st, i, id), workOn(st, i)
// then endDay(st): staff react, threat check, the night's supplies.
// newRun(cardId, seed) gives a fresh state at the first morning report; openDay(st) moves report -> day.
//
// Hidden values (never shown by the screen until the run is over): each person's loyalty, fear and
// step on the threat ladder (0 content .. 6 planning to remove you), and the bunker's unrest.

import { ROLES, ROLE_ORDER, STAGES, CANDIDATES } from '../data/staff.js';
import { cardById } from '../data/cards.js';
import { RUMOURS, RUMOURS_AFRAID, MOODS, SABOTAGE, THEFT } from '../data/text.js';
import { EVENTS } from '../data/events.js';
import { ASKS, FAULTS, SABOTEUR, WHY_BAD, WHY_GOOD, SAYS, STORE_LEVERS } from '../data/matters.js';
import { CARDS, START_DECK, TIERS, TIER_LINES, PROJECTS, TITLES, TITLE_POWERS, rankOf } from '../data/deck.js';
import { REQUESTS } from '../data/requests.js';

export const RULES = {
  DAYS: 30,                      // nights until the surface is safe
  START: { food: 60, water: 52, power: 55, med: 30, lux: 45, opu: 0 },
  CAP: 120,                      // most of anything the stores can hold (opulence has no cap: it is the score)
  VARY: 8,                       // spread of starting loyalty and fear between people
  GRUDGE_START: 16,              // loyalty the person with a grudge starts short by
  // Each night, loyalty drifts by:
  WANT_MET: 0.3, WANT_UNMET: -1.0,   // whether the person's want is met
  CABIN: 0.05,                   // lost a night per day spent underground so far: it wears on everyone
  CAMERA_LOYALTY: 0.6,           // lost a night while the cameras are on
  GRUDGE: 1.2,                   // lost a night by the person with a grudge
  TRUST_KEPT: 0.12, TRUST_BROKEN: 0.6,   // per promise kept or broken so far
  HUNGER: 1.5,                   // lost a night on cut rations or a nearly empty larder
  // Fear fades towards FEAR_REST by this share a night (halved while security does its job, more without).
  FEAR_REST: 15, FEAR_DECAY: 0.06,
  // The threat ladder. A person climbs to the lower of what their loyalty wants and what their fear allows.
  LOYALTY_STEPS: [55, 45, 37, 30, 24, 18],   // at or above each: step 0, 1, 2, 3, 4, 5; below the last: 6
  FEAR_CAPS: [80, 66, 52, 40, 26],           // at or above each: no higher than step 1, 2, 3, 4, 5
  CLIMB: 0.45,                   // chance a night of climbing one step when they want to
  P_SABOTAGE: 0.16, P_THEFT: 0.2, P_ATTEMPT: 0.2,
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
    life: { opu: [1, 3, 6], food: [0, 0.8, 2.2], water: [0, 0.6, 1.6], power: [0, 0.6, 1.4], loyalty: [0.3, -0.3, -1.0] },   // how you live: Spartan, Comfortable, Decadent
    curfew: { fear: [0, 0.5], cap: 70, loyalty: [0, -0.5], opu: [0, 1.5] },   // set by a card: fear added a night, up to cap; what they think of it; how well you sleep
  },
  // Your hand. Each morning you draw HAND cards and may play PLAYS of them.
  HAND: 4, PLAYS: 2,
  // Projects: while one is being built the staff work overtime; when done, a one-off reward.
  OVERTIME: 1.5, PROJECT_DONE: 10, POD_DAY: 20,  // loyalty everyone loses each time you put them on overtime
  // Round 10. Titles: powers (TITLE_POWERS) and envy, loyalty everyone loses a night per title above Tenant,
  // times ENVY_LIFE[lifestyle]. Plots: fear no longer stops people plotting; it stops them acting alone.
  PLOT_MAJORITY: 1,             // a plot moves once it has more than half the bunker in it (half, plus this)
  ENVY: 0.06, ENVY_LIFE: [0.5, 1, 1.5], GUARDS: 0.5, WORSHIP: 3,
  LEVER_RISE: 1.5, LEVER_NIGHTS: 5,   // store levers: each top-up costs this much more than the last; how long a cut lasts
  RUSH: 2, FIRST_DUE: 9, FIRST_MISS: { opu: -10, unrest: 8, loyalty: -2 },   // most parts a day; the first project's grand opening, and missing it
  // The ruthless steps (TIERS in data/deck.js); st.regime is how many are open. Playing a card from the
  // deepest open step opens the next the following morning, and adds its cards to your deck. Each step down:
  RELISH: 0.1,                   // ruthless cards pay this much more opulence (it gets easier)
  CRUEL_UNREST: 3,               // every ruthless card stirs the bunker up this much: they talk about it
  NUMB: 0.18, NUMB_FLOOR: 0.45,  // measures from higher up shock bystanders this much less (they have seen worse)
  SOUR: 0.12, SOUR_FLOOR: 0.4,   // perks, quiet words, speeches and promises are worth this much less (they know what you are)
  FRIEND_LOSS: 7, FRIEND_LOSS_JUST: 2,   // loyalty a friend loses when someone is exiled, deserts or dies; and when they had it coming
  INFAMY_FEAR: 0.06,             // each point of infamy slows the fading of fear by this share
  DESERT_LOYALTY: 14, DESERT_FEAR: 60, DESERT: 0.06, DESERT_GUARDED: 0.25, DESERT_CURFEW: 0.6,
  ALONE: 3,                      // with fewer staff than this the silo cannot be run at all, and you have nobody to rule   // hated and terrified: chance a night that they take a suit and go
  CELL_NIGHTS: 3, ISOLATE_DAYS: 6, SCAPEGOAT_UNREST: 14, SCAPEGOAT_FADE: 0.6, SEARCH_FADE: 0.5,
  // Requests (round 6, data/requests.js): asked, promised, worked on a part a day, then kept or broken.
  REQ_FIRST: 2, REQ_CHANCE: 0.3, REQ_PROJECT: 0.15,   // first day one may come; chance a morning (more while a project is under way)
  REQ_WAIT: 2, REQ_RUNNING: 3,   // days to answer one; most promised jobs on the go at once
  REQ_HOPE: 1, REQ_REFUSED: 5, REQ_IGNORED: 4,                 // the asker, when you promise, refuse, or never answer
  REQ_KEEP: 5, REQ_KEEP_FRIEND: 1, REQ_KEEP_ALL: 0,             // kept: the asker, their friend, everyone (the perk does the rest)
  REQ_BREAK: 12, REQ_BREAK_FRIEND: 5, REQ_BREAK_ALL: 2, REQ_BREAK_UNREST: 8,   // broken
  REQ_TRUST_KEPT: 0, REQ_TRUST_BROKEN: 0.15,                 // a night, for everyone, per request kept or broken so far
  STRIKE: 2, LAX_SECURITY: 5, UNION: 0.5, MAINTAINED: 0.5, PATROLS_DESERT: 0.5, PATROLS_FEAR: 0.7, FILING: 3,
  // Old requests (switched off in round 5) and faults.
  ASK_CHANCE: 0, ASK_DAYS: 3, ASK_REFUSED: 5, ASK_LATE: 4,
  FAULT_CHANCE: 0.09, PATCH: 0.4, PATCH_FAILS: 0.35, REPAIR: 3, REPAIR_NO_ENGINEER: 5, REPAIR_GRUDGE: 3,
  // Actions.
  TEST_OFFENCE: 5,               // loyalty a loyal person loses for being tested (twice that if proud)
  TALK: 2, TALK_AGAIN: 3,        // loyalty for being asked; days before asking again counts
  PERK_COST: 5, PERK: 10, PERK_FADE: 0.6, INFORMANT_COST: 3, INFORMANT_TRUE: 0.84, INFORMANT_FOUND: 0.05,
  SPEECH: 6, SPEECH_FADE: 0.6, SPEECH_UNREST: 8,
  EXAMPLE_FEAR: 8, EXAMPLE_LOYALTY: 7, EXAMPLE_FEAR_TARGET: 20, EXAMPLE_LOYALTY_TARGET: 22,
  EXILE_FEAR: 6, EXILE_LOYALTY: 9, EXILE_UNREST: 8,
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
      st.res[k] = clamp(was + d, 0, k === 'opu' ? 1e6 : R.CAP);
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
      const fr = p.friend ? st.staff.find((x) => x.role === p.friend) : null;      // somebody down here will miss them
      if (fr && fr.status === 'ok') { move(fr, -(p.exposed ? R.FRIEND_LOSS_JUST : R.FRIEND_LOSS), 'friend:' + p.role); fr.friend = null; }
      if (st.informant === p.role) st.informant = null;
      for (const pr of st.promises) if (pr.role === p.role && pr.state === 'owed') pr.state = 'void';
      for (const r of st.requests || []) if (r.role === p.role && (r.state === 'asked' || r.state === 'owed')) r.state = 'void';
      st.matters = st.matters.filter((m) => m.role !== p.role);
    },
    queue(id, c = {}, pri = 1, extra = {}) { st.queue.push({ id, ctx: c, pri, ...extra }); },
    addCard(id) { addCard(st, id); },
    plainer() { st.policy.life = Math.max(0, st.policy.life - 1); },   // your lifestyle drops a notch
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
      if (pr.type === 'rations') { st.flags.equalRations = true; st.policy.life = 0; if (st.policy.rations < 1) st.policy.rations = 1; }
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
    v: 7, seed, rng: seed | 0, rank: 0, plotSeen: 1, card: card.id, day: 1, phase: 'report', requests: [], perks: [],
    res: { ...R.START }, crit: { food: 0, water: 0, power: 0 }, delta: {},
    policy: { rations: 1, life: 1, curfew: 0 }, cameras: false, infamy: 0, scapegoats: 0, searches: 0, picks, regime: card.regime || 1, tierUsed: {}, path: [],
    deck: [], discard: [], hand: [], played: [], gone: [], plays: R.PLAYS, built: {}, project: null,
    eventDone: false, today: [], matters: [],
    staff: [], unrest: 0, word: 1, speeches: 0, informant: null,
    promises: [], flags: {}, queue: [], seen: {}, log: [],
    report: null, event: null, result: null, ending: null, cause: null,
    stats: { made: 0, kept: 0, broken: 0, perks: 0, talks: 0, examples: 0, exiles: 0, deaths: 0, survivedAttempts: 0, asks: 0, repairs: 0, cruel: 0, reqMade: 0, reqKept: 0, reqBroken: 0 },
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
  // friendships: four pairs, so that what you do to one person lands on another
  const pairs = shuffle(st, st.staff.map((p) => p.role));
  for (let i = 0; i + 1 < pairs.length; i += 2) { st.staff.find((p) => p.role === pairs[i]).friend = pairs[i + 1]; st.staff.find((p) => p.role === pairs[i + 1]).friend = pairs[i]; }
  st.unrest = clamp(18 + (55 - card.loyalty) * 0.5);
  for (const type of card.promises) {
    st.promises.push({ type, role: null, made: 0, due: type === 'vote' ? 20 : PROMISES[type].due || null, state: 'owed' });
  }
  // the deck: the starting cards, plus every ruthless step this start has already gone down
  st.deck = shuffle(st, [...START_DECK, ...TIERS.slice(1, st.regime).flat()]);
  st.queue.push({ id: 'welcome', ctx: {}, pri: 9 });
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
  // somebody may ask you for something that takes days to deliver
  const req = maybeRequest(st, g);
  if (req) inc.push({ kind: 'ask', text: `${g.n(req.role)} has a request: ${REQUESTS[req.id].title.toLowerCase()}. It is on your desk.` });
  st.hand = draw(st, R.HAND + (st.rank >= 1 ? 1 : 0)); st.played = []; st.plays = playsFor(st);
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
    for (const k in cost) if (cost[k] < 0 && st.res[k] + cost[k] < 0) { ok = false; why = k === 'opu' ? 'You have no face left to lose' : 'Not enough in the stores'; }
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

// --- Rations and lifestyle -----------------------------------------------------------------------------

export function setPolicy(st, key, v) {
  if (st.phase !== 'day' || key === 'curfew') return false;
  if (policyBlock(st, key, v)) return false;
  const def = R.POLICY[key];
  if (!def || v < 0 || v >= Object.values(def).find(Array.isArray).length) return false;
  st.policy[key] = v;
  return true;
}
export const policyValue = (st, key) => st.policy[key];
// Why a setting cannot be chosen, or ''.
export function policyBlock(st, key, v) {
  if (key === 'life' && v > 0 && (st.flags.plainUntil || 0) >= st.day) return 'The chef is serving you staff rations';
  if (st.flags.equalRations && ((key === 'life' && v > 0) || (key === 'rations' && v < 1))) return 'You promised equal rations';
  return '';
}
// What a setting costs or gives each night, set against the plainest setting (for the screen).
export function policyCost(st, key, v) {
  const P = R.POLICY, n = st.staff.filter((p) => p.status === 'ok').length;
  switch (key) {
    case 'rations': return { food: -R.EAT * n * (P.rations.eat[v] - 1) };
    case 'life': return { opu: P.life.opu[v], food: -P.life.food[v], water: -P.life.water[v], power: -P.life.power[v] };
    case 'curfew': return { opu: P.curfew.opu[v] };
    default: return {};
  }
}

// --- Matters: requests and faults ---------------------------------------------------------------------

export function matterView(st) {
  const g = ctx(st);
  const afford = (cost) => { for (const k in cost) if (cost[k] < 0 && st.res[k] + cost[k] < 0) return false; return true; };
  return st.matters.map((m, i) => {
    if (m.kind === 'ask') {
      const p = g.who(m.role), def = ASKS[m.role].find((a) => a.key === m.key);
      const ok = afford(def.c) && (!def.act || st.plays > 0);
      return {
        i, kind: 'ask', role: m.role, zone: ROLES[m.role].post, title: `${p.first} asks`, text: def.text(p.first), left: m.due - st.day,
        choices: [{ id: 'yes', label: def.t, cost: def.c, act: !!def.act, ok, why: ok ? '' : def.act && st.plays <= 0 ? 'No actions left today' : 'You can’t spare it' }, { id: 'no', label: 'Say no', cost: {}, ok: true, why: '' }],
      };
    }
    // A broken machine: your luxury, or their goodwill. (Leaving it is the third choice, and costs a store every night.)
    const def = FAULTS[m.sys], eng = g.s('engineer');
    const price = { lux: -(eng && eng.stage < 3 ? R.REPAIR : R.REPAIR_NO_ENGINEER) };
    return {
      i, kind: 'fault', zone: def.zone, sys: m.sys, title: def.name, drain: { [def.res]: -def.drain }, text: def.text,
      choices: [
        { id: 'repair', label: 'Repair it with parts from your own stores', cost: price, ok: afford(price), why: afford(price) ? '' : 'Nothing left to strip for parts' },
        { id: 'staff', label: 'Have the staff mend it in their own time', cost: {}, ok: true, why: '' },
      ],
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
  if (ch.act) st.plays--;
  let text = '';
  if (m.kind === 'ask') {
    const p = g.s(m.role), def = ASKS[m.role].find((a) => a.key === m.key);
    if (id === 'yes') { st.cause = 'ask:yes'; text = def.r(g, p); st.stats.asks++; } else { st.cause = 'ask:no'; g.loy(p, -R.ASK_REFUSED, 'punish'); text = def.no(p.first); }
  } else if (id === 'repair') {
    // whoever mends it properly sees how it broke
    const by = m.by ? g.s(m.by) : null;
    text = `${view.title} is mended, with wire from your chandelier and a bearing from your exercise bike. `
      + (m.by ? 'The bolts had been undone from the inside, and the scratches are fresh: this was done on purpose' + (m.seen && by ? `, and the cameras have ${by.first} at it at three in the morning.` : ', by somebody who knows the machine.') : 'It was metal fatigue and a perished seal. Nobody did this but time.');
    if (m.seen && by) g.note(by, `caught on camera breaking ${view.title.toLowerCase()}`);
    st.stats.repairs++;
  } else {
    st.cause = 'shifts';
    g.loy('all', -R.REPAIR_GRUDGE);
    text = `${view.title} is mended by the night shift, by torchlight, after a full day’s work. It runs. Nobody is thanked.`;
  }
  st.cause = null;
  st.matters.splice(i, 1);
  st.today.push({ title: view.title, text, delta: { ...st.delta } });
  st.log.push({ day: st.day, matter: m.kind, id });
  return text;
}

// --- Your hand: cards drawn each morning, some of them played ---------------------------------------
// Cards are in data/deck.js. The deck is st.deck (face down), st.discard, and st.hand (today's draw).

// What kindness from you is still worth: less, the further down the ruthless steps you are.
export const kindness = (st) => Math.max(R.SOUR_FLOOR, 1 - R.SOUR * (st.regime - 1));
// How much a ruthless card from step `tier` still upsets the others: less, once they have seen worse.
const shockOf = (st, tier) => Math.max(R.NUMB_FLOOR, 1 - R.NUMB * (st.regime - 1 - (tier || 0)));
// The opulence a card pays you. Ruthless cards pay more the further down you are: it gets easier.
export const payOf = (st, c) => Math.round(((c.gain && c.gain.opu) || 0) * (c.kind === 'cruel' ? 1 + R.RELISH * (st.regime - 1) : 1));
export const playsFor = (st) => Math.max(1, R.PLAYS + (st.built.butler ? 1 : 0) + (st.rank >= 2 ? 1 : 0) - (st.flags.lostPlay === st.day ? 1 : 0));

function draw(st, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (!st.deck.length) { st.deck = shuffle(st, st.discard); st.discard = []; }
    if (!st.deck.length) break;
    out.push(st.deck.pop());
  }
  return out;
}
// A new card goes somewhere random in the face-down deck, so it turns up soon but not at once.
export function addCard(st, id) { st.deck.splice(Math.floor(rnd(st) * (st.deck.length + 1)), 0, id); st.owned = (st.owned || 0) + 1; }

// Today's hand, ready to show. Each card: its data, plus i, played, ok and why, and pay (opulence it will give).
export function handView(st) {
  return st.hand.map((id, i) => {
    const c = CARDS[id];
    const v = { ...c, id, i, played: st.played.includes(i), ok: true, why: '', pay: payOf(st, c) };
    for (const k in c.cost || {}) if (c.cost[k] < 0 && st.res[k] + c.cost[k] < 0) { v.ok = false; v.why = k === 'opu' ? 'You have no face left to lose' : `Not enough ${k === 'lux' ? 'luxury' : k === 'med' ? 'medicine' : k}`; }
    if (c.promise && !promiseList(st).some((o) => o.ok)) { v.ok = false; v.why = 'Nothing left to promise'; }
    if (c.target && !st.staff.some((p) => mayPlay(st, i, p))) { v.ok = false; v.why = 'There is nobody to do it to'; }
    if (v.played) { v.ok = false; v.why = 'Played'; } else if (st.plays <= 0) { v.ok = false; v.why = 'No plays left today'; }
    return v;
  });
}
// May card i be played on this person?
export function mayPlay(st, i, p) {
  const c = CARDS[st.hand[i]];
  if (!c || !p || p.status !== 'ok') return false;
  if ((p.cell || 0) > st.day && c.id !== 'tapes' && c.kind !== 'cruel') return false;
  if (c.need) { const g = ctx(st); if (c.need(g, p) !== true) return false; }
  return true;
}

const INFAMY = { review: 1, search: 1, interrogate: 1, divide: 1, example: 2, curfew: 2, scapegoat: 2, cell: 1, exile: 3 };

// The ruthless and watchful effects, shared by several cards.
function helpers(st, g, card) {
  const friend = (p, d) => { const f = p && p.friend ? g.s(p.friend) : null; if (f) g.move(f, d, 'friend:' + p.role); };
  // Round 10: a plot that is found out falls apart for a while. The others in it lie low (back to step 4).
  const blow = (p) => { const rest = g.here().filter((q) => q !== p && q.stage >= 5); for (const q of rest) q.stage = 4; return rest.length ? ` The others in it go very quiet. ${rest.length === 1 ? 'One person' : rest.length + ' people'} suddenly have a great deal of work to do.` : ''; };
  return {
    kind: kindness(st), shock: shockOf(st, card.tier), friend,
    talk: (p) => talk(st, g, p),
    test: (p, hired) => {
      const band = p.loyalty >= 66 ? 'devoted' : p.loyalty >= 50 ? 'loyal' : p.loyalty >= 33 ? 'wavering' : 'hostile';
      p.tested = { day: st.day, band };
      g.note(p, `assessed: ${band}`);
      return `${hired ? 'The cleaner, in a borrowed blazer, follows' : 'You follow'} ${p.first} about for a day with a clipboard, nodding. The report is one word long: <${band}>.`.replace(/<(\w+)>/, '“$1”');
    },
    interrogate: (p) => {
      const worst = Object.entries(p.why).filter(([k, v]) => v <= -1.5 && k !== 'or:interrogate').sort((x, y) => x[1] - y[1])[0];
      g.loy(p, -6, 'punish'); g.fear(p, 8); g.fear('not:' + p.role, 1); friend(p, -3);
      const said = worst ? whyLine(st, worst[0], false, p) : 'There is nothing. I swear there is nothing.';
      p.rumour = { text: `Under questioning: ${p.first} is ${STAGES[p.stage]}.`, day: st.day, sig: p.stage, informant: true };
      p.said = { day: st.day, text: said };
      g.note(p, `questioned at 2am; was ${STAGES[p.stage]}`);
      let blown = '';
      if (p.stage >= 5) { g.expose(p, p.stage >= 6 ? 'admitted under questioning to planning to kill you' : 'admitted under questioning to being part of a plot against you'); blown = blow(p); }
      return `${p.first} is woken at two in the morning and sat under a lamp. You ask the same questions until dawn. ${p.first} is ${STAGES[p.stage]}. “${said}”${blown}`;
    },
    divide: (p) => {
      const f = p.friend ? g.s(p.friend) : null;
      p.isolated = st.day + R.ISOLATE_DAYS; g.loy(p, -4); g.unrest(-8);
      if (f) { g.move(f, -4, 'or:divide'); f.isolated = Math.max(f.isolated || 0, st.day + 3); f.friend = null; }
      p.friend = null;
      return f ? `You tell ${p.first}, in confidence, that ${f.first} has been informing on them. Then you tell ${f.first} the same about ${p.first}. They stop sitting together. They stop sitting with anyone.` : `You tell ${p.first} that everyone is informing on them. They stop sitting with anyone.`;
    },
    example: (p) => {
      const proud = p.trait === 'proud';
      g.fear('not:' + p.role, R.EXAMPLE_FEAR); g.loy('not:' + p.role, -R.EXAMPLE_LOYALTY * shockOf(st, card.tier));
      g.fear(p, proud ? 10 : R.EXAMPLE_FEAR_TARGET); g.loy(p, -R.EXAMPLE_LOYALTY_TARGET, 'punish'); friend(p, -5);
      if (proud) p.grudge = true;
      const avgFear = g.here().reduce((a, x) => a + x.fear, 0) / g.here().length;
      g.unrest(avgFear >= 50 ? -6 : 6);
      st.stats.examples++; p.noticed = st.day;
      return `${p.first} scrubs the reactor floor with a toothbrush while the others are made to watch. You provide a commentary.${proud ? ` ${p.first} looks at you the whole time.` : ''}` + g.violate(['purges']);
    },
    scapegoat: (p) => {
      const f = Math.pow(R.SCAPEGOAT_FADE, st.scapegoats); st.scapegoats++;
      g.loy(p, -22, 'punish'); g.fear(p, 10); g.loy('not:' + p.role, 3 * f); g.unrest(-R.SCAPEGOAT_UNREST * f); friend(p, -6);
      if (p.trait === 'proud') p.grudge = true;
      return `You call everyone to the mess hall and explain, with slides, that every shortage, breakdown and bad smell in this bunker is the fault of ${p.first}. Slide nine is just ${p.first}’s face with a red circle round it. ${f > 0.7 ? 'It is astonishing how much better everyone feels.' : 'It works less well than last time. People are starting to notice the pattern.'}`;
    },
    cell: (p) => {
      p.cell = st.day + R.CELL_NIGHTS;
      g.loy(p, -10, 'punish'); g.fear(p, 10); g.fear('not:' + p.role, 3); g.loy('not:' + p.role, -3 * shockOf(st, card.tier)); friend(p, -5);
      return `${p.first} is marched down to the cell on the security level. The door makes a very satisfying noise. Somebody else will have to do the job for three nights.` + g.violate(['purges']);
    },
    exile: (p) => {
      const just = !!p.exposed;
      g.remove(p, 'exiled');
      g.fear('all', R.EXILE_FEAR + (just ? 5 : 0)); g.loy('all', just ? -2 : -R.EXILE_LOYALTY * shockOf(st, card.tier), 'ideal');
      g.unrest(just ? 0 : R.EXILE_UNREST); st.stats.exiles++;
      return `${p.first} is given a suit, a mask, a leaving card signed by nobody and an exit interview conducted through the lift doors. ${just ? `Nobody argues. They know what ${p.first} tried to do.` : 'The others watch the lift go up and come back empty.'} Somebody untrained will have to do the job now.` + g.violate(['noexile', 'purges', 'seat']);
    },
    tapes: (p) => {
      p.rumour = { text: `On the tapes: ${p.first} is ${STAGES[p.stage]}.`, day: st.day, sig: p.stage, informant: true };
      g.note(p, `on the tapes: ${STAGES[p.stage]}`);
      if (p.stage >= 5) { g.expose(p, 'caught on the tapes meeting the plotters'); return `You watch seventy hours of ${p.first}. At 3.12 one morning ${p.first} is in the stores with the others, practising your signature and timing the lift. That is enough.${blow(p)}`; }
      return `You watch seventy hours of ${p.first}. ${p.first} is ${STAGES[p.stage]}. Also, ${p.first} talks to the grow lights, which you did not need to know.`;
    },
  };
}

export function playCard(st, i, arg = {}) {
  if (st.phase !== 'day') return null;
  const v = handView(st)[i];
  if (!v || !v.ok) return null;
  const card = CARDS[v.id], g = ctx(st);
  const p = arg.role ? g.s(arg.role) : null;
  if (card.target && !mayPlay(st, i, p)) return null;
  let opt = null;
  if (card.promise) { opt = promiseList(st).find((o) => o.type === arg.type && o.ok); if (!opt || (opt.target && !p)) return null; }
  st.delta = {}; st.cause = 'or:' + v.id;
  for (const k in card.cost || {}) g.res(k, card.cost[k]);
  let text;
  if (card.promise) {
    const word = st.word, soft = kindness(st);
    st.word = word * soft;                        // a promise from you is worth what your name is worth
    g.makePromise(arg.type, opt.target ? p.role : null);
    st.word = word;
    const pr = st.promises[st.promises.length - 1];
    text = `You promise, with your hand on your heart and then on a copy of your own book: “${promiseText(st, pr)}.” ${word * soft < 0.8 ? 'A few people remember what else you have said and done, and say nothing.' : 'The mood lifts at once. It cost you nothing, today.'}${pr.due ? ` It falls due on day ${pr.due}.` : ''}`;
  } else text = card.play(g, p, arg, helpers(st, g, card));
  st.cause = null;
  if (v.pay) g.res('opu', v.pay);
  if (card.kind === 'cruel') {
    st.infamy += INFAMY[v.id] || 1; st.stats.cruel++; g.unrest(R.CRUEL_UNREST);
    st.tierUsed[card.tier] = true;
    st.path.push({ day: st.day, id: v.id, role: p ? p.role : null, tier: card.tier });
    if (p) { p.done = p.done || {}; p.done[v.id] = (p.done[v.id] || 0) + 1; }
  }
  st.plays--; st.played.push(i);
  if (card.once) st.gone.push(v.id);
  st.today.push({ title: card.name, text, delta: { ...st.delta } });
  st.log.push({ day: st.day, card: v.id, role: arg.role, type: arg.type });
  return text;
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

// What someone says when asked what is wrong. Frightened people say nothing true; plotters say something small.
function whyLine(st, key, good, p) {
  if (key === 'want') return good ? 'I have what I asked for. That counts.' : `What do I want? ${p.wantText} I am not getting it.`;
  if (key.startsWith('ev:')) return good ? `That business with “${key.slice(3).toLowerCase()}”: you did right by us.` : `It was that business with “${key.slice(3).toLowerCase()}”. You know what you did.`;
  if (key.startsWith('or:') && CARDS[key.slice(3)]) return good ? `The ${CARDS[key.slice(3)].name.toLowerCase()}. I haven’t forgotten.` : (WHY_BAD[key] || `The ${CARDS[key.slice(3)].name.toLowerCase()}. You know what I mean.`);
  if (key.startsWith('req:') && REQUESTS[key.slice(4)]) { const t = REQUESTS[key.slice(4)].title.toLowerCase(); return good ? `You kept your word about the ${t.replace(/^an? /, '')}. I did not expect that.` : `The ${t.replace(/^an? /, '')}. I asked you for one thing.`; }
  if (key.startsWith('friend:')) { const f = st.staff.find((x) => x.role === key.slice(7)); return good ? `You were good to ${f.first}. I noticed that.` : `It is what you did to ${f.first}. ${f.first} is my friend.`; }
  return (good ? WHY_GOOD : WHY_BAD)[key] || (good ? 'Things have been a little better.' : 'A lot of small things.');
}
function talk(st, g, p) {
  if (st.day - (p.talked ?? -9) >= R.TALK_AGAIN) g.loy(p, (R.TALK + (p.trait === 'proud' ? 2 : 0)) * kindness(st));
  p.talked = st.day; p.noticed = st.day; st.stats.talks++;
  let said;
  if (p.fear >= 66) said = g.pick(SAYS.afraid);
  else if (p.stage >= 5) said = g.pick(SAYS.cover);
  else {
    const all = Object.entries(p.why).filter(([k]) => k !== 'or:talk');
    const bad = all.filter(([, v]) => v <= -1.5).sort((a, b) => a[1] - b[1])[0];
    const good = all.filter(([, v]) => v >= 1.5).sort((a, b) => b[1] - a[1])[0];
    said = (bad ? whyLine(st, bad[0], false, p) : g.pick(SAYS.none)) + (good ? ' ' + whyLine(st, good[0], true, p) : '');
  }
  p.said = { day: st.day, text: said };
  return `Your door is open for twenty minutes, and ${p.first} comes through it. “${said}”${p.fear >= 66 ? ` ${p.first} keeps smiling until the door shuts.` : ''}`;
}

// --- Projects: the upgrade path -------------------------------------------------------------------------

// The first project (round 7): one of the PROJECTS marked first must be chosen on day 1 before lights out.
export const needsFirst = (st) => !st.flags.firstChosen;
export function projectList(st) {
  const first = needsFirst(st);
  return Object.entries(PROJECTS).filter(([, d]) => !!d.first === first).map(([id, d]) => {
    // kept requests make projects cheaper (filing) and quicker (the workshop)
    const cost = st.flags.filing && d.cost.lux ? { ...d.cost, lux: Math.min(0, d.cost.lux + R.FILING) } : d.cost;
    const days = st.flags.workshop ? Math.max(1, d.days - 1) : d.days;
    const v = { id, ...d, cost, days, built: !!st.built[id], building: st.project && st.project.id === id, ok: true, why: '' };
    if (v.built) { v.ok = false; v.why = 'Built'; } else if (v.building) { v.ok = false; v.why = `${st.project.left} ${st.project.left === 1 ? 'part' : 'parts'} to go`; } else if (st.project) { v.ok = false; v.why = 'One project at a time'; } else if (st.day + days > R.DAYS) { v.ok = false; v.why = 'Not enough days left to finish it'; }
    else for (const k in cost) if (st.res[k] + cost[k] < 0) { v.ok = false; v.why = 'Not enough luxury'; }
    return v;
  });
}
export function commission(st, id) {
  if (st.phase !== 'day') return null;
  const v = projectList(st).find((x) => x.id === id);
  if (!v || !v.ok) return null;
  const g = ctx(st);
  st.delta = {};
  for (const k in v.cost) g.res(k, v.cost[k]);
  st.project = { id, left: v.days, parts: v.days, due: v.first ? R.FIRST_DUE : null };
  if (v.first) st.flags.firstChosen = true;
  const name = v.name.replace(/^A /, 'a ').replace(/^An /, 'an ').replace(/^The /, 'the ');
  const text = v.first ? `The plans for ${name} are unrolled on the mess-hall table. It was ordered before the sirens and it is already paid for. The grand opening is announced for day ${R.FIRST_DUE}. It is ${v.days} parts of work, and none of it will do itself.` : `Work begins on ${name}: ${v.days} parts of work. It moves only when you put work in.`;
  st.today.push({ title: 'A new project', text, delta: { ...st.delta } });
  st.log.push({ day: st.day, project: id });
  return text;
}
// The project under way, ready to show: how far along, and the three ways to do a part of it today.
export function projectView(st) {
  if (!st.project) return null;
  const d = PROJECTS[st.project.id], pj = st.project;
  const used = pj.today && pj.today.day === st.day ? pj.today.used : [];
  const full = used.length >= R.RUSH;
  const opt = (id, label, cost, extra) => {
    let ok = !full && !used.includes(id), why = full ? `${R.RUSH} parts today already` : used.includes(id) ? 'Done today' : '';
    if (ok && id === 'mat' && !afford(st, cost)) { ok = false; why = 'Not enough in the stores'; }
    if (ok && id === 'time' && st.plays <= 0) { ok = false; why = 'No plays left today'; }
    return { id, label, cost, ok, why, ...extra };
  };
  return {
    id: pj.id, name: d.name, flavour: d.flavour, text: d.text, parts: pj.parts || d.days, left: pj.left, done: (pj.parts || d.days) - pj.left,
    due: pj.due, missed: !!pj.missed, today: used.length,
    options: [
      opt('mat', 'Buy the materials', d.mat || {}),
      opt('overtime', 'Put the staff on overtime', {}, { mood: true }),
      opt('time', 'Supervise it yourself', {}, { play: true }),
    ],
  };
}
// Do one part of the project today: how = 'mat' | 'overtime' | 'time'.
export function buildPart(st, how) {
  if (st.phase !== 'day') return null;
  const v = projectView(st);
  const o = v && v.options.find((x) => x.id === how);
  if (!o || !o.ok) return null;
  const g = ctx(st), pj = st.project, d = PROJECTS[pj.id];
  st.delta = {};
  if (!pj.today || pj.today.day !== st.day) pj.today = { day: st.day, used: [] };
  pj.today.used.push(how);
  let text;
  if (how === 'mat') { for (const k in d.mat || {}) g.res(k, d.mat[k]); text = 'The materials go down in the lift. Somebody signs for them with a sigh.'; }
  else if (how === 'overtime') {
    st.cause = 'overtime'; g.loy('all', -R.OVERTIME * (st.flags.union ? R.UNION : 1)); st.cause = null;
    text = g.pick(['Everyone works until two in the morning. Nobody is thanked. Somebody hums the anthem, bitterly.', 'Another late night on your project. The staff eat their dinner standing up, holding spanners.', 'Overtime again. A rota goes up. Someone has drawn a small skull on it.']);
  } else { st.plays--; text = g.pick(['You stand near it all afternoon in a hard hat, pointing. It helps, somehow.', 'You supervise personally: a clipboard, a whistle, and strong opinions about grout.', 'You carry one plank, very visibly. Work speeds up, mostly so that you will leave.']); }
  pj.left--;
  if (pj.left <= 0) text += ' ' + finishProject(st, g);
  else text += ` ${pj.left} ${pj.left === 1 ? 'part' : 'parts'} to go.`;
  st.today.push({ title: d.name, text, delta: { ...st.delta } });
  st.log.push({ day: st.day, build: pj.id, how });
  return text;
}
function finishProject(st, g) {
  const id = st.project.id, d = PROJECTS[id], late = st.project.missed;
  st.built[id] = true; st.project = null;
  if (d.cameras) st.cameras = true;
  for (const c of d.cards || []) addCard(st, c);
  g.res('opu', R.PROJECT_DONE);
  return `It is finished. ${d.flavour}${late ? ' The grand opening is held at last, to an audience that has seen the scaffolding.' : ''}${(d.cards || []).length ? ` New in your deck: ${d.cards.map((c) => CARDS[c].name).join(' and ')}.` : ''}`;
}

// --- What you can do about a store (round 9): top it up, or use less of it for a while ---------------
export function storeLevers(st, k) {
  const L = STORE_LEVERS[k];
  if (!L) return null;
  const uses = (st.levers && st.levers[k]) || 0, today = st.leverDay && st.leverDay[k] === st.day;
  const out = { note: L.lessNote || '', options: [] };
  if (L.more) {
    const cost = Object.fromEntries(Object.entries(L.more.cost).map(([r, d]) => [r, Math.round(d * Math.pow(R.LEVER_RISE, uses))]));
    let ok = st.phase === 'day' && !today, why = st.phase !== 'day' ? 'Start the day first' : today ? 'Once a day' : '';
    if (ok && !afford(st, cost)) { ok = false; why = cost.opu ? 'Not enough opulence' : 'Not enough luxury'; }
    out.options.push({ id: 'more', label: L.more.label, cost: { ...cost, ...L.more.gain }, ok, why });
  }
  if (L.less) {
    const on = st.cuts && st.cuts[k] >= st.day;
    out.options.push({ id: 'less', label: L.less.label, cost: { [k]: L.less.save }, perNight: true, mood: true, ok: st.phase === 'day' && !on, why: on ? `Until day ${st.cuts[k]}` : st.phase !== 'day' ? 'Start the day first' : '' });
  }
  return out;
}
export function useLever(st, k, id) {
  const v = storeLevers(st, k), o = v && v.options.find((x) => x.id === id);
  if (!o || !o.ok) return null;
  const g = ctx(st), L = STORE_LEVERS[k];
  st.delta = {};
  let text;
  if (id === 'more') {
    for (const r in o.cost) g.res(r, o.cost[r]);
    st.levers = st.levers || {}; st.levers[k] = (st.levers[k] || 0) + 1;
    st.leverDay = st.leverDay || {}; st.leverDay[k] = st.day;
    text = L.more.said;
  } else {
    st.cuts = st.cuts || {}; st.cuts[k] = st.day + R.LEVER_NIGHTS - 1;
    st.cause = 'cut:' + k; g.loy('all', L.less.loyalty); st.cause = null;
    text = L.less.said;
  }
  st.today.push({ title: o.label, text, delta: { ...st.delta } });
  st.log.push({ day: st.day, lever: k, id });
  return text;
}

// The escape pod: from day 20, leave whenever you like, with your score.
export const canEscape = (st) => !!st.built.pod && st.day >= R.POD_DAY && st.phase === 'day';
export function escape(st) { if (!canEscape(st)) return false; ctx(st).end('escaped'); return true; }

// --- Requests: what the staff ask of you, and what you promised them (data/requests.js) ---------------
// st.requests: { id, role, state: asked|owed|kept|broken|alt|refused|ignored|void, born, by (last day to
// answer), until (last day to do a part), done (parts done), worked (day of the last part) }

const afford = (st, cost) => { for (const k in cost || {}) if (cost[k] < 0 && st.res[k] + cost[k] < 0) return false; return true; };

function maybeRequest(st, g) {
  if (st.day < R.REQ_FIRST || st.requests.some((r) => r.state === 'asked')) return null;
  if (st.requests.filter((r) => r.state === 'owed').length >= R.REQ_RUNNING) return null;
  if (rnd(st) >= R.REQ_CHANCE + (st.project ? R.REQ_PROJECT : 0)) return null;
  const used = new Set(st.requests.map((r) => r.id));
  const free = g.here().filter((p) => !((p.cell || 0) > st.day) && !p.exposed && p.stage < 5 && !st.requests.some((r) => r.role === p.role && (r.state === 'owed' || r.state === 'asked')));
  if (!free.length) return null;
  const opts = [];
  for (const [id, d] of Object.entries(REQUESTS)) {
    if (used.has(id) || (d.when && !d.when(g)) || st.day + d.days - 1 > R.DAYS) continue;
    // the unhappy ask more often; 'any' is whoever is least happy with you
    const p = d.role === 'any' ? free.slice().sort((a, b) => a.loyalty - b.loyalty)[0] : free.find((x) => x.role === d.role);
    if (p) opts.push({ id, p, w: d.role === 'any' ? 2.5 : p.stage >= 1 && p.stage <= 3 ? 3 : 1 });
  }
  if (!opts.length) return null;
  let x = rnd(st) * opts.reduce((a, o) => a + o.w, 0), pick = opts[0];
  for (const o of opts) { x -= o.w; if (x <= 0) { pick = o; break; } }
  const r = { id: pick.id, role: pick.p.role, state: 'asked', born: st.day, by: st.day + R.REQ_WAIT - 1, done: 0 };
  st.requests.push(r);
  return r;
}

// The requests on your desk, ready to show: waiting for an answer, or promised and under way.
export function requestView(st) {
  const g = ctx(st);
  const out = [];
  st.requests.forEach((r, i) => {
    if (r.state !== 'asked' && r.state !== 'owed') return;
    const d = REQUESTS[r.id], p = g.who(r.role), time = d.part === 'time';
    const v = { i, id: r.id, state: r.state, role: r.role, who: p.first, title: d.title, text: d.text(p.first), steps: d.steps, done: r.done, days: d.days, time, part: time ? {} : d.part, perkText: d.perkText, falloutText: d.falloutText };
    if (r.state === 'asked') {
      v.left = r.by - st.day + 1;
      const altOk = afford(st, d.alt.c);
      v.choices = [
        { id: 'yes', label: 'Promise it', cost: {}, ok: true, why: '' },
        { id: 'alt', label: d.alt.t, cost: { ...(d.alt.c || {}), ...(d.alt.gain || {}) }, ok: altOk, why: altOk ? '' : 'You can’t spare it' },
        { id: 'no', label: 'Refuse', cost: {}, ok: true, why: '' },
      ];
    } else {
      v.left = r.until - st.day + 1;                     // days left to do a part, counting today
      v.today = r.worked === st.day;
      let ok = !v.today, why = v.today ? 'Done for today' : '';
      if (ok && time && st.plays <= 0) { ok = false; why = 'No plays left today'; }
      if (ok && !time && !afford(st, d.part)) { ok = false; why = 'Not enough in the stores'; }
      v.work = { ok, why };
      v.late = d.steps - r.done > v.left;               // it can no longer be finished in time
    }
    out.push(v);
  });
  return out;
}

export function answer(st, i, id) {
  if (st.phase !== 'day') return null;
  const r = st.requests[i];
  if (!r || r.state !== 'asked') return null;
  const d = REQUESTS[r.id], g = ctx(st), p = g.s(r.role);
  if (!p || (id === 'alt' && !afford(st, d.alt.c))) return null;
  st.delta = {}; st.cause = 'req:' + r.id;
  let text;
  if (id === 'yes') {
    r.state = 'owed'; r.until = st.day + d.days - 1; st.stats.reqMade++;
    g.loy(p, R.REQ_HOPE * kindness(st), 'promise');
    text = `You promise ${p.first}: ${d.title.toLowerCase()}. ${d.steps} ${d.part === 'time' ? 'sessions of your time' : 'parts'}, one a day, all done by the end of day ${r.until}. ${p.first} looks at you as if it might actually happen.`;
  } else if (id === 'alt') {
    for (const k in d.alt.c || {}) g.res(k, d.alt.c[k]);
    for (const k in d.alt.gain || {}) g.res(k, d.alt.gain[k]);
    r.state = 'alt';
    text = d.alt.r(g, p);
  } else {
    r.state = 'refused';
    g.loy(p, -R.REQ_REFUSED, 'punish');
    text = d.no(p.first);
  }
  st.cause = null;
  st.today.push({ title: `${d.title}`, text, delta: { ...st.delta } });
  st.log.push({ day: st.day, request: r.id, answer: id });
  return text;
}

// Do today's part of a promised request: pay it in stores, or in your time (one play).
export function workOn(st, i) {
  if (st.phase !== 'day') return null;
  const v = requestView(st).find((x) => x.i === i);
  if (!v || v.state !== 'owed' || !v.work.ok) return null;
  const r = st.requests[i], d = REQUESTS[r.id], g = ctx(st), p = g.s(r.role);
  st.delta = {}; st.cause = 'req:' + r.id;
  if (d.part === 'time') st.plays--; else for (const k in d.part) g.res(k, d.part[k]);
  r.done++; r.worked = st.day;
  if (p) g.loy(p, 1);
  const text = r.done < d.steps ? `Part ${r.done} of ${d.steps} done. ${p ? p.first : 'Everyone'} has noticed.` : keepRequest(st, g, r);
  st.cause = null;
  st.today.push({ title: d.title, text, delta: { ...st.delta } });
  st.log.push({ day: st.day, request: r.id, part: r.done });
  return text;
}

function keepRequest(st, g, r) {
  const d = REQUESTS[r.id], p = g.s(r.role), k = d.perk;
  r.state = 'kept'; st.stats.reqKept++;
  st.word = Math.min(1.6, st.word + 0.1);
  st.cause = 'req:' + r.id;
  if (p) { g.loy(p, R.REQ_KEEP, 'promise'); g.loy('not:' + p.role, R.REQ_KEEP_ALL); const f = p.friend && g.s(p.friend); if (f) g.move(f, R.REQ_KEEP_FRIEND + (k.friendBoost || 0), 'friend:' + p.role); }
  if (k.night) st.perks.push({ ...k.night });
  if (k.flag) st.flags[k.flag] = true;
  if (k.opu) g.res('opu', k.opu);
  if (k.loyAll) g.loy('all', k.loyAll);
  if (k.fear) g.fear('all', k.fear);
  if (k.unrest) g.unrest(k.unrest);
  if (k.card) addCard(st, k.card);
  if (k.titled && p) p.titled = true;
  if (k.noticed && p) p.noticed = st.day + k.noticed - 8;   // wantMet counts 8 days from being noticed
  if (k.delay && st.project) st.project.left += k.delay;
  return `${d.keep} Promise kept: ${d.perkText.charAt(0).toLowerCase() + d.perkText.slice(1)}.`;
}

function breakRequest(st, g, r, inc) {
  const d = REQUESTS[r.id], p = g.s(r.role), f = d.fallout;
  r.state = 'broken'; st.stats.reqBroken++;
  st.word *= 0.75;
  const was = st.cause; st.cause = 'req:' + r.id;
  if (p) {
    g.loy(p, -R.REQ_BREAK, 'punish');
    p.stage = Math.min(6, Math.max(p.stage + 1, 1));         // the person you let down takes a step towards removing you
    const fr = p.friend && g.s(p.friend); if (fr) g.move(fr, -R.REQ_BREAK_FRIEND, 'friend:' + p.role);
  }
  g.loy(p ? 'not:' + p.role : 'all', -R.REQ_BREAK_ALL);
  g.unrest(R.REQ_BREAK_UNREST + (f.unrest || 0));
  for (const k in f.res || {}) g.res(k, f.res[k]);
  if (f.flag) st.flags[f.flag] = st.day + (f.days || 3);
  if (f.strike && st.project) st.project.left += R.STRIKE;
  if (f.plain) { st.flags.plainUntil = st.day + f.plain; st.policy.life = 0; }
  if (f.lostPlay) st.flags.lostPlay = st.day + 1;
  if (f.loyAll) g.loy('all', f.loyAll);
  if (f.opu) g.res('opu', f.opu);
  st.cause = was;
  inc.push({ kind: 'bad', text: `${d.fail(p ? p.first : 'Somebody')} Promise broken. ${d.falloutText}.` });
}

// --- Night ------------------------------------------------------------------------------------------

// What one night takes from each store, and adds to your opulence, as things stand (no dice).
function nightly(st) {
  const P = R.POLICY, pol = st.policy;
  const eff = (role) => effOf(st, role);
  const live = st.staff.filter((p) => p.status === 'ok');
  const n = live.length, work = 1;
  const heir = st.staff.find((x) => x.role === 'heir');
  const extra = (k) => live.reduce((a, p) => a + ((p.nightly && p.nightly[k]) || 0), 0);   // what the people you chose bring or cost each night
  const out = {
    food: -(R.EAT * n * P.rations.eat[pol.rations] * (st.flags.equalRations ? R.EQUAL_RATIONS : 1) * ((st.flags.rationCut || 0) > st.day ? R.RATION_CUT : 1) + R.EAT_YOU + P.life.food[pol.life]) * (1 + R.CHEF_WASTE * (1 - eff('chef')))
      + R.FARM * eff('farmer') * work * (st.res.water > 0 ? 1 : 0.3),
    water: -(R.DRINK * n + R.DRINK_YOU + R.CROPS + P.life.water[pol.life]) + R.RECYCLE * eff('engineer') * work,
    power: -(R.POWER_BASE - R.POWER_ENG * eff('engineer')) - P.life.power[pol.life] - (st.cameras && !st.built.cameras ? R.CAMERA_POWER : 0),
    med: -(R.MED_BASE + R.MED_DOC * (1 - eff('doctor'))),
    lux: -(R.LUX_YOU + (heir && heir.status === 'ok' ? R.LUX_HEIR : 0) + (st.informant ? R.INFORMANT_DAILY : 0)),
    opu: (st.res.power > 0 && st.res.water > 0 ? P.life.opu[pol.life] : 0) + P.curfew.opu[pol.curfew],
  };
  out.food += extra('food'); out.lux += extra('lux'); out.opu += extra('opu');   // who you let in at the hatch
  for (const n of st.perks || []) for (const k in n) if (k in out) out[k] += n[k];   // requests you kept
  for (const k in st.cuts || {}) if (st.cuts[k] >= st.day && STORE_LEVERS[k].less) out[k] += STORE_LEVERS[k].less.save;   // cold showers, early lights out
  for (const id in st.built) for (const k in PROJECTS[id].night || {}) if (k in out) out[k] += PROJECTS[id].night[k];
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
  if (st.phase !== 'day' || !st.eventDone || needsFirst(st)) return;
  const g = ctx(st), inc = [], P = R.POLICY, pol = st.policy;
  st.delta = {};
  const here = g.here();
  const sec = g.s('security'), secOK = sec && sec.stage < 3 && !((sec.cell || 0) > st.day) && !((st.flags.lax || 0) >= st.day);

  // Requests: unanswered ones lapse; promised ones whose time has run out are broken.
  for (const r of st.requests) {
    const d = REQUESTS[r.id], p = g.s(r.role);
    if (r.state === 'asked' && st.day >= r.by) {
      r.state = 'ignored';
      if (p) { g.move(p, -R.REQ_IGNORED, 'req:' + r.id); inc.push({ kind: 'bad', text: `${p.first} asked you about ${d.title.toLowerCase()} and has stopped waiting for an answer.` }); }
    } else if (r.state === 'owed' && st.day >= r.until && r.done < d.steps) breakRequest(st, g, r, inc);
  }

  // Old-style requests nobody answered.
  st.matters = st.matters.filter((m) => {
    if (m.kind !== 'ask' || st.day < m.due) return true;
    const p = g.s(m.role);
    if (p) { g.move(p, -R.ASK_LATE, 'ask:late'); inc.push({ kind: 'bad', text: `${p.first} asked you for something three days ago and has stopped expecting an answer.` }); }
    return false;
  });

  // 1. Staff react: hidden loyalty and fear shift.
  const contagion = Math.max(0, (st.unrest - 40) / 40);
  const hungry = st.res.food < 12 || (st.flags.rationCut || 0) > st.day;
  const wellness = st.built.wellness ? PROJECTS.wellness.night.loyalty : 0;
  for (const p of here) {
    for (const k in p.why) { p.why[k] *= 0.8; if (Math.abs(p.why[k]) < 0.3) delete p.why[k]; }   // old reasons fade
    if (wellness) g.move(p, wellness, 'wellness');
    g.move(p, ROLES[p.role].wantMet(st, p) ? R.WANT_MET : R.WANT_UNMET, 'want');
    if (st.rank) g.move(p, -R.ENVY * st.rank * R.ENVY_LIFE[pol.life], 'envy');   // the higher your title, the more they resent it
    if (st.cameras) g.move(p, -R.CAMERA_LOYALTY, 'cameras');
    if (p.grudge) g.move(p, -R.GRUDGE, 'grudge');
    g.move(p, -R.CABIN * st.day, 'cabin');
    const trust = st.stats.kept * R.TRUST_KEPT - st.stats.broken * R.TRUST_BROKEN + st.stats.reqKept * R.REQ_TRUST_KEPT - st.stats.reqBroken * R.REQ_TRUST_BROKEN;
    if (trust) g.move(p, trust, 'trust');
    if (contagion) g.move(p, -contagion, 'unrest');
    if (hungry) g.move(p, -R.HUNGER, 'hunger');
    if (P.rations.loyalty[pol.rations] && !(pol.rations === 0 && (st.flags.fast || 0) > st.day)) g.move(p, P.rations.loyalty[pol.rations], 'rations');
    if (P.life.loyalty[pol.life]) g.move(p, P.life.loyalty[pol.life], 'life');
    if (pol.curfew) g.move(p, P.curfew.loyalty[1], 'curfew');
    p.fear = clamp(p.fear + (R.FEAR_REST - p.fear) * R.FEAR_DECAY * (secOK ? 0.5 / sec.skill : 1.5) * (st.flags.patrols && secOK ? R.PATROLS_FEAR : 1) * (st.res.lux <= 0 ? 1.5 : 1) / (1 + st.infamy * R.INFAMY_FEAR));
    if (pol.curfew && p.fear < P.curfew.cap) p.fear = Math.min(P.curfew.cap, p.fear + P.curfew.fear[1] * (secOK ? 1 : 0.4));
  }

  // 2. Threat check: does anyone dare to act?
  const airlock = [];   // seen at the airlock tonight: the warning before anyone deserts
  const plotters0 = here.filter((q) => q.stage >= 5).length;   // the plot as it stood this evening
  const seen = (p) => (st.cameras ? ` Cameras: ${p.first} was there at 3am.` : '');
  const faulty = (sys) => st.matters.some((m) => m.sys === sys);
  for (const p of here) {
    // Round 10: how far they will go is set by loyalty alone. Fear hides it (the fixed smile) and keeps them at their
    // work, but does not stop them plotting. Set against the others (divide and rule), they cannot organise.
    const want = Math.min(stageOfLoyalty(p.loyalty), (p.isolated || 0) > st.day ? 4 : 6);
    if (want > p.stage) { if (g.chance(R.CLIMB)) p.stage++; } else if (want < p.stage) p.stage = Math.max(want, p.stage - 2);
    p.faction = p.stage >= 5;
    if ((p.cell || 0) > st.day) { p.faction = false; continue; }      // locked up: they can do nothing tonight
    // Terror has a price. Someone who hates you and dares do nothing else may simply leave.
    // (A head of security who is doing the job keeps the airlock; a curfew keeps people in their bunks.)
    // Round 8: never without warning. The first night they could go, they are seen at the airlock instead;
    // only after that morning can they leave. The warning is given once, and again only if they had clearly
    // settled down in between (well clear of both thresholds).
    const pal = p.friend && g.s(p.friend);
    const flight = p.loyalty < R.DESERT_LOYALTY && p.fear >= R.DESERT_FEAR && plotters0 - (p.stage >= 5 ? 1 : 0) < 1 && !pal;   // with a plot to join, or a friend to plot with, they stay and plot
    if (p.flight && (p.loyalty >= R.DESERT_LOYALTY + 8 || p.fear < R.DESERT_FEAR - 12)) p.flight = null;
    if (flight && !p.flight) {
      p.flight = st.day;
      g.note(p, 'seen trying on an airlock suit at night');
      airlock.push(p.first);
    } else if (flight && st.day > p.flight && g.chance(R.DESERT * (secOK && p !== sec ? R.DESERT_GUARDED : 1) * (pol.curfew ? R.DESERT_CURFEW : 1) * (st.flags.patrols && secOK ? R.PATROLS_DESERT : 1))) {
      g.remove(p, 'exiled'); p.fled = st.day;
      for (const q of here) if (q !== p) g.move(q, -3, 'or:exile');
      inc.push({ kind: 'bad', text: `${p.first} took a suit from the airlock in the night and went up to the surface. They hated working for you, and were too frightened to say so. Nobody else can do that job properly.` });
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
    const cowed = Math.max(0.3, 1 - p.fear / 100);   // fear keeps them at their work: less petty sabotage and theft
    if (p.stage === 3) { if (g.chance(R.P_SABOTAGE * cowed)) sabotage(); } else if (p.stage === 4) { if (g.chance(R.P_THEFT * cowed)) theft(); else if (g.chance(0.12 * cowed)) sabotage(); } else if (p.stage === 5) { if (g.chance(0.15)) theft(); } else if (p.stage >= 6 && !st.queue.some((q) => q.attempt) && g.chance(R.P_ATTEMPT)) {
      g.queue(attemptEvent(p.role), { role: p.role }, 4, { attempt: true });
    }
  }
  if (airlock.length) {
    const who = airlock.length === 1 ? airlock[0] : airlock.slice(0, -1).join(', ') + ' and ' + airlock[airlock.length - 1];
    inc.push({ kind: 'warn', text: `${who} ${airlock.length === 1 ? 'was' : 'were'} seen at the airlock last night, trying on suits. They hate you and fear you enough to leave. A kind word or a locked door might stop them.` });
  }
  let du = 0;
  for (const p of here) du += R.UNREST_BY_STAGE[p.stage] * ((p.cell || 0) > st.day || (p.isolated || 0) > st.day ? 0.4 : 1);
  g.unrest(du);
  const faction = g.faction();
  // The plot grows: warnings, without names. (Questioning at 2am, the tapes or the cameras will tell you who.)
  if (faction.length <= 1) st.plotSeen = 1;
  else if (faction.length > (st.plotSeen || 1)) {
    st.plotSeen = faction.length;
    const n = faction.length;
    inc.push({ kind: 'warn', text: n === 2 ? 'Two people stop talking when you walk into the mess hall. Something is being planned, and you are what it is about.' : n === 3 ? 'There was a meeting in the stores last night, with the door locked from the inside. Three people, at least. They are not planning to leave. They are planning to stay, without you.' : `The plot has ${n} people in it now. They nod to each other in corridors. When enough of them are ready, they will move.` });
  }
  if (st.rank >= 4) g.unrest(-R.WORSHIP);   // your face on every wall
  if ((st.flags.mutinyCool || 0) <= st.day && !st.queue.some((q) => q.id === 'mutiny')
    && (faction.length >= Math.max(3, Math.floor(here.length / 2) + R.PLOT_MAJORITY) || st.unrest >= R.MUTINY_UNREST)) {
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
  if (st.matters.filter((m) => m.kind === 'fault').length < 2 && g.chance(R.FAULT_CHANCE * (g.s('engineer') ? 1 : 2.5) * (st.flags.maintained ? R.MAINTAINED : 1))) {
    const free = Object.keys(FAULTS).filter((s) => !faulty(s));
    if (free.length) { const s = g.pick(free); st.matters.push({ kind: 'fault', sys: s, born: st.day, by: null }); inc.push({ kind: 'bad', text: FAULTS[s].text }); }
  }
  // The first project's grand opening: if it is not finished by then, it opens anyway, in front of the scaffolding.
  if (st.project && st.project.due && !st.project.missed && st.day >= st.project.due) {
    const d = PROJECTS[st.project.id], M = R.FIRST_MISS;
    st.project.missed = true;
    g.res('opu', M.opu); g.unrest(M.unrest);
    for (const q of here) g.move(q, M.loyalty, 'opening');
    inc.push({ kind: 'bad', text: `The grand opening of ${d.name.replace(/^A /, 'a ').replace(/^An /, 'an ')} went ahead, on the date you announced, in a half-built room. You cut a ribbon in front of the scaffolding. Nobody claps until you look at them.` });
  }

  // 3. Night: the silo uses up supplies, and you live as you have chosen to.
  const night = nightly(st);
  for (const k in night) g.res(k, night[k]);

  const rank = rankOf(st.res.opu);
  if (rank > st.rank) {
    for (let r = st.rank + 1; r <= rank; r++) inc.push({ kind: 'built', text: `You are now ${TITLES[r][1]}. ${TITLE_POWERS[r]} And everyone below you resents it a little more, every night.` });
    st.rank = rank;
  }
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
  if (st.day >= R.DAYS) { g.end(finalEnding(st, g)); return; }
  // The slope: what was done yesterday is, by morning, just how things are. The next step's cards join the deck.
  if (st.regime < TIERS.length && st.tierUsed[st.regime - 1]) {
    const add = TIERS[st.regime];
    for (const c of add) addCard(st, c);
    inc.push({ kind: 'slope', text: `${TIER_LINES[st.regime - 1]} It is just how things are done now. New in your deck: ${add.map((c) => CARDS[c].name).join(' and ').replace(/\.$/, '')}.` });
    st.regime++;
  }
  // Yesterday's hand goes on the discard pile (except cards that are used up).
  st.hand.forEach((id, i) => { if (!(st.played.includes(i) && st.gone.includes(id))) st.discard.push(id); });
  st.gone = [];
  st.day++;
  beginDay(st, inc);
}

function finalEnding(st, g) {
  const here = g.here();
  // round 10: at the hatch, it takes an organised plot (or a bunker on the very brink) to take it from you
  if (st.unrest >= 95 || g.faction().length >= Math.max(2, Math.floor(here.length / 2) + R.PLOT_MAJORITY)) return 'deposed_hatch';
  for (const pr of st.promises) if (pr.state === 'owed' && !pr.due) { pr.state = 'kept'; st.stats.kept++; }
  const bad = st.promises.some((pr) => pr.state === 'broken' || pr.state === 'forgotten' || pr.state === 'owed');
  const kinds = new Set(st.promises.filter((pr) => pr.state === 'kept').map((pr) => pr.type));
  if (!bad && kinds.size >= 3 && st.stats.kept >= 4) return 'word';
  return st.res.lux >= 10 ? 'king' : 'king_poor';
}

export { ctx as _ctx };
