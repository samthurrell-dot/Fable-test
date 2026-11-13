// engine/sim.js
// The rules of Bunker Billionaire. Pure: no DOM, no timers, and the only randomness is a seeded
// generator kept inside the state, so a run can be saved, reloaded and replayed from its seed.
//
// One day is: report -> event -> (you choose) -> order -> (lights out) -> night -> next report.
//   newRun(cardId, seed)          a fresh state, already at the first morning report
//   openEvent(st)                 report -> event
//   eventView(st)                 title, text and choices of today's event (choices carry costs and whether they can be afforded)
//   choose(st, i)                 take choice i; fills st.result; -> order (or ended)
//   orderList(st), promiseList(st) the tools you may use; one order a day
//   order(st, id, arg)            use a tool
//   endDay(st)                    staff react, threat check, night; -> next report (or ended)
//
// Hidden values (never shown by the screen until the run is over): each person's loyalty, fear and
// step on the threat ladder (0 content .. 6 planning to remove you), and the bunker's unrest.

import { ROLES, ROLE_ORDER, STAGES } from '../data/staff.js';
import { cardById } from '../data/cards.js';
import { RUMOURS, RUMOURS_AFRAID, MOODS, SABOTAGE, THEFT } from '../data/text.js';
import { EVENTS } from '../data/events.js';

export const RULES = {
  DAYS: 30,                      // nights until the surface is safe
  START: { food: 60, water: 52, power: 50, med: 30, lux: 45 },
  CAP: 120,                      // most of anything the stores can hold
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
  EFF_BY_STAGE: [1, 1, 0.8, 0.7, 0.7, 0.6, 0.6], EFF_ABSENT: 0.45,   // how well a job is done
  // The night's supplies.
  EAT: 0.45, EAT_YOU: 1.0, FARM: 4.1, CHEF_WASTE: 0.3, EQUAL_RATIONS: 1.25, RATION_CUT: 0.6,
  DRINK: 0.25, DRINK_YOU: 0.5, CROPS: 0.8, RECYCLE: 2.2,
  POWER_BASE: 2.7, POWER_ENG: 1.5, CAMERA_POWER: 1.5,
  MED_BASE: 0.25, MED_DOC: 0.6,
  LUX_YOU: 0.2, LUX_HEIR: 0.3, INFORMANT_DAILY: 1,
  // Tools.
  PERK_COST: 5, PERK: 10, PERK_FADE: 0.7, INFORMANT_COST: 3, INFORMANT_TRUE: 0.84, INFORMANT_FOUND: 0.05,
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
  rations: { text: 'Equal rations for everyone', due: 4, cost: 'No more banquets; food runs down faster', keepLine: 'From tonight you eat what they eat. It is beige.' },
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

// The handle that events and tools use to change the game.
//   tag on loy(): 'gift' (greedy people love it, proud people shrug), 'punish' (proud people take it
//   badly), 'promise' and 'ideal' (true believers feel it more, both ways).
function ctx(st) {
  const g = {
    st,
    rand: () => rnd(st),
    chance: (p) => rnd(st) < p,
    pick: (arr) => arr[Math.floor(rnd(st) * arr.length)],
    here: () => st.staff.filter((p) => p.status === 'ok'),
    s: (role) => { const p = st.staff.find((x) => x.role === role); return p && p.status === 'ok' ? p : null; },
    who: (role) => st.staff.find((x) => x.role === role),
    n: (role) => st.staff.find((x) => x.role === role).first,
    res(k, d) {
      const was = st.res[k];
      st.res[k] = clamp(was + d, 0, R.CAP);
      st.delta[k] = (st.delta[k] || 0) + (st.res[k] - was);
    },
    loy(who, d, tag) {
      const list = resolve(st, who);
      for (const p of list) {
        let m = 1;
        if (tag === 'gift' && d > 0) m = p.trait === 'greedy' ? 1.7 : p.trait === 'proud' ? 0.6 : 1;
        if (tag === 'punish' && d < 0 && p.trait === 'proud') m = 1.7;
        if ((tag === 'promise' || tag === 'ideal') && p.trait === 'believer') m = 1.6;
        p.loyalty = clamp(p.loyalty + d * m);
      }
      // a gossip who has been wronged tells everyone
      if (list.length === 1 && d <= -5 && list[0].trait === 'gossip' && who !== 'all') {
        for (const p of g.here()) if (p !== list[0]) p.loyalty = clamp(p.loyalty + d * 0.3);
      }
    },
    fear(who, d) { for (const p of resolve(st, who)) p.fear = clamp(p.fear + d); },
    unrest(d) { st.unrest = clamp(st.unrest + d); },
    note(p, text) { if (p) { p.notes = p.notes || []; p.notes.push(`Day ${st.day}: ${text}`); } },
    expose(p, text) { if (p) { p.exposed = true; g.note(p, text); } },
    remove(p, status) {
      if (!p) return;
      p.status = status; p.faction = false;
      if (st.informant === p.role) st.informant = null;
      for (const pr of st.promises) if (pr.role === p.role && pr.state === 'owed') pr.state = 'void';
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
      if (pr.type === 'rations') st.flags.equalRations = true;
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
      g.loy('all', -R.BREAK_LOYALTY * mult, 'promise');
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

export function newRun(cardId, seed = (Math.random() * 2 ** 31) | 0) {
  const card = cardById(cardId);
  const st = {
    v: 1, seed, rng: seed | 0, card: card.id, day: 1, phase: 'report',
    res: { ...R.START }, crit: { food: 0, water: 0, power: 0 }, delta: {},
    staff: [], unrest: 0, word: 1, speeches: 0, cameras: false, informant: null,
    promises: [], flags: {}, queue: [], seen: {}, log: [],
    report: null, event: null, result: null, orderUsed: false, orderText: '', ending: null,
    stats: { made: 0, kept: 0, broken: 0, perks: 0, examples: 0, exiles: 0, deaths: 0, survivedAttempts: 0 },
  };
  if (card.stores) for (const k in st.res) st.res[k] += card.stores;
  const traits = shuffle(st, ['greedy', 'greedy', 'proud', 'proud', 'gossip', 'gossip', 'believer', 'believer']);
  const vary = () => (rnd(st) * 2 - 1) * R.VARY;
  st.staff = ROLE_ORDER.map((role, i) => {
    const base = { ...ROLES[role], ...(role === 'heir' && card.heir ? card.heir : {}) };
    const p = {
      role, name: base.name, first: base.first, title: base.title, the: base.the, wantText: base.want, trait: traits[i],
      loyalty: clamp(card.loyalty + vary()), fear: clamp(card.fear + vary()), stage: 0, status: 'ok',
      grudge: role === card.grudge, perks: 0, hist: [], notes: [],
    };
    if (p.grudge) { p.loyalty = clamp(p.loyalty - R.GRUDGE_START); p.notes.push(`Holds a grudge: ${card.grudgeLine}`); }
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
  const acc = sure ? 0.95 : R.RUMOUR_TRUE + (pa ? (pa.loyalty >= 50 ? 0.1 : -0.12) : 0);
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
    p.room = p.stage === 2 ? 'mess' : ROLES[p.role].post;
    p.night = p.stage >= 5 ? 'stores' : p.stage === 4 ? 'vault' : 'bunks';
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
    const honest = rnd(st) < R.INFORMANT_TRUE - (cleaner && cleaner.loyalty < 40 ? 0.25 : 0);
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
  const band = Math.min(4, Math.floor(st.unrest / 20));
  st.report = { day: st.day, inc, mood: g.pick(MOODS[band]), tense: band >= 3, rumours, informant, cams, faces, delta: { ...st.delta } };
  st.orderUsed = false; st.orderText = ''; st.result = null;
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

export function openEvent(st) { if (st.phase === 'report') st.phase = 'event'; }

// Today's event, ready to show. Each choice: { label, cost: {res: delta}, ok, why }.
export function eventView(st) {
  const def = EVENTS[st.event.id], g = ctx(st), c = st.event.ctx;
  const from = def.anon ? null : c.role || def.from;   // an unsigned note does not show who sent it
  const choices = def.choices(g, c).map((ch) => {
    const cost = ch.c || {};
    let ok = true, why = '';
    for (const k in cost) if (cost[k] < 0 && st.res[k] + cost[k] < 0) { ok = false; why = 'Not enough in the stores'; }
    if (ok && ch.need) { const n = ch.need(g, c); if (n !== true) { ok = false; why = n || 'Not possible'; } }
    return { label: ch.t, cost, ok, why };
  });
  if (!choices.some((ch) => ch.ok)) choices.push({ label: 'Do nothing', cost: {}, ok: true, why: '', fallback: true });
  return { id: def.id, title: typeof def.title === 'function' ? def.title(g, c) : def.title, from: from && g.who(from) ? from : null, text: def.text(g, c), choices, grim: !!def.grim };
}

export function choose(st, i) {
  if (st.phase !== 'event') return;
  const def = EVENTS[st.event.id], g = ctx(st), c = st.event.ctx;
  const view = eventView(st);
  if (!view.choices[i] || !view.choices[i].ok) return;
  st.delta = {};
  let text = 'You do nothing. It is noticed.';
  if (!view.choices[i].fallback) {
    const ch = def.choices(g, c)[i];
    for (const k in ch.c || {}) g.res(k, ch.c[k]);
    text = ch.r ? ch.r(g, c) : '';
  }
  st.result = { title: view.title, choice: view.choices[i].label, text, delta: { ...st.delta } };
  st.log.push({ day: st.day, event: def.id, choice: i });
  if (!st.ending) st.phase = 'order';
}

// --- Orders: one a day ------------------------------------------------------------------------------

const ORDER_DEFS = [
  { id: 'perk', group: 'Spend', name: 'Give a perk', hint: 'Loyalty up quickly, for one person.', cost: { lux: -R.PERK_COST }, target: true },
  { id: 'cameras', group: 'Watch', name: 'Switch the cameras on', hint: 'See where people go. Costs power, and everyone likes you a little less.' },
  { id: 'informant', group: 'Watch', name: 'Pay an informant', hint: 'A report on one person every morning. Paid in luxury. Might lie, might be found out.', cost: { lux: -R.INFORMANT_COST }, target: true },
  { id: 'test', group: 'Watch', name: 'Loyalty test', hint: 'Find out if one person is loyal. Offends the loyal ones.', target: true },
  { id: 'example', group: 'Punish', name: 'Make an example', hint: 'Fear up for everyone. Loyalty down for everyone. They may want revenge.', target: true },
  { id: 'exile', group: 'Punish', name: 'Exile to the surface', hint: 'Removes a problem for good. You lose their skills and the others are horrified.', target: true },
  { id: 'speech', group: 'Promise', name: 'Give a speech', hint: 'A small loyalty boost. Each speech works less than the last.' },
  { id: 'promise', group: 'Promise', name: 'Make a promise', hint: 'Loyalty now, for nothing. A debt later.', sub: true },
];

export function orderList(st) {
  return ORDER_DEFS.map((o) => {
    const d = { ...o, ok: true, why: '' };
    if (o.id === 'cameras') {
      if (st.cameras) { d.name = 'Switch the cameras off'; d.hint = 'Saves power. You stop seeing where people go.'; }
      if (st.flags.noCameras) { d.ok = false; d.why = 'You took them out, as promised'; }
    }
    if (o.id === 'informant' && st.informant) d.hint = `Move your informant from ${st.staff.find((p) => p.role === st.informant).first} to someone else.`;
    for (const k in o.cost || {}) if (st.res[k] + o.cost[k] < 0) { d.ok = false; d.why = 'Not enough luxury'; }
    if (o.id === 'promise' && !promiseList(st).some((p) => p.ok)) { d.ok = false; d.why = 'Nothing left to promise'; }
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

export function order(st, id, arg = {}) {
  if (st.phase !== 'order' || st.orderUsed) return null;
  const g = ctx(st), def = orderList(st).find((o) => o.id === id);
  if (!def || !def.ok) return null;
  const p = arg.role ? g.s(arg.role) : null;
  if (def.target && !p) return null;
  st.delta = {};
  for (const k in def.cost || {}) g.res(k, def.cost[k]);
  let text = '';
  switch (id) {
    case 'perk': {
      g.loy(p, R.PERK * Math.pow(R.PERK_FADE, p.perks), 'gift');
      p.perks++; p.noticed = st.day; st.stats.perks++;
      g.loy('not:' + p.role, p.trait === 'gossip' ? -2 : -1);
      const react = p.trait === 'greedy' ? 'They check it twice and smile with all their teeth.' : p.trait === 'proud' ? 'They accept it as no more than their due.' : p.trait === 'gossip' ? 'By supper everyone has heard about it, in detail.' : 'They seem pleased.';
      text = `${p.first} gets ${g.pick(PERKS)}. ${react}`;
      break;
    }
    case 'cameras':
      st.cameras = !st.cameras;
      if (st.cameras) { g.loy('all', -3); g.fear('all', 3); text = 'The cameras go on. Little red lights in every corridor. People start walking differently.'; } else { g.loy('all', 1.5); text = 'The cameras go dark. You can no longer see where anybody goes. Neither can anybody prove where you were.'; }
      break;
    case 'informant':
      st.informant = p.role;
      text = `Somebody will keep an eye on ${p.first} and report to you each morning. They want paying every day.`;
      break;
    case 'test': {
      const loyal = p.loyalty >= 50;
      p.tested = { day: st.day, loyal };
      if (loyal) { g.loy(p, p.trait === 'proud' ? -13 : -7); text = `You leave a "lost" master key where ${p.first} will find it. It is back on your desk within the hour, with a note. ${p.first} is loyal, and now knows you had to check.`; } else { g.fear(p, 8); text = `You leave a "lost" master key where ${p.first} will find it. It is not handed in. ${p.first} is not loyal, and now knows that you know.`; }
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
      if (!opt || !opt.ok || (opt.target && !p)) { st.delta = {}; return null; }
      g.makePromise(arg.type, opt.target ? p.role : null);
      const pr = st.promises[st.promises.length - 1];
      text = `You promise: "${promiseText(st, pr)}." ${st.word < 0.8 ? 'A few people remember your last promise and say nothing.' : 'The mood lifts at once. It cost you nothing, today.'}${pr.due ? ` It falls due on day ${pr.due}.` : ''}`;
      break;
    }
    default: return null;
  }
  st.orderUsed = true; st.orderText = text; st.orderDelta = { ...st.delta };
  st.log.push({ day: st.day, order: id, role: arg.role, type: arg.type });
  return text;
}

// --- Night ------------------------------------------------------------------------------------------

function attemptEvent(role) {
  return { chef: 'chef_special', engineer: 'airlock', doctor: 'vitamin', security: 'master_keys' }[role] || 'midnight_note';
}

export function endDay(st) {
  if (st.phase !== 'order') return;
  const g = ctx(st), inc = [];
  st.delta = {};
  const here = g.here();
  const sec = g.s('security'), secOK = sec && sec.stage < 3;

  // 1. Staff react: hidden loyalty and fear shift.
  const contagion = Math.max(0, (st.unrest - 40) / 40);
  const hungry = st.res.food < 12 || (st.flags.rationCut || 0) > st.day;
  for (const p of here) {
    let d = ROLES[p.role].wantMet(st, p) ? R.WANT_MET : R.WANT_UNMET;
    if (st.cameras) d -= R.CAMERA_LOYALTY;
    if (p.grudge) d -= R.GRUDGE;
    d -= R.CABIN * st.day;
    d += st.stats.kept * R.TRUST_KEPT - st.stats.broken * R.TRUST_BROKEN;
    d -= contagion;
    if (hungry) d -= R.HUNGER;
    p.loyalty = clamp(p.loyalty + d);
    p.fear = clamp(p.fear + (R.FEAR_REST - p.fear) * R.FEAR_DECAY * (secOK ? 0.5 : 1.5) * (st.res.lux <= 0 ? 1.5 : 1));
  }

  // 2. Threat check: does anyone dare to act?
  const seen = (p) => (st.cameras ? ` Cameras: ${p.first} was there at 3am.` : '');
  for (const p of here) {
    const want = Math.min(stageOfLoyalty(p.loyalty), capOfFear(p.fear));
    if (want > p.stage) { if (g.chance(R.CLIMB)) p.stage++; } else if (want < p.stage) p.stage = Math.max(want, p.stage - 2);
    p.faction = p.stage >= 5;
    const sabotage = () => {
      const [k, d, line] = SABOTAGE[p.role];
      g.res(k, d);
      if (p.role === 'security') g.fear('all', -4);
      if (p.role === 'pa') g.loy('all', -2);
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
  for (const p of here) du += R.UNREST_BY_STAGE[p.stage];
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
      g.loy(target, -15); g.loy('not:' + target.role, -4); g.unrest(6);
      inc.push({ kind: 'bad', text: `${target.first} caught your informant going through their bunk. Everybody knows whose informant it was.` });
    }
  }
  // A promise you quietly forgot may be remembered for you.
  st.promises.forEach((pr, i) => {
    if (pr.state !== 'forgotten' || st.queue.some((q) => q.id === 'promise_reminded')) return;
    const gossip = here.some((p) => p.trait === 'gossip' && p.loyalty < 55);
    if (g.chance(R.REMIND * (gossip ? 2.2 : 1))) g.queue('promise_reminded', { i }, 2);
  });

  // 3. Night: the silo uses up supplies.
  const eff = (role) => { const p = g.s(role); return p ? R.EFF_BY_STAGE[p.stage] : R.EFF_ABSENT; };
  const n = here.length;
  g.res('food', -(R.EAT * n + R.EAT_YOU) * (st.flags.equalRations ? R.EQUAL_RATIONS : 1) * ((st.flags.rationCut || 0) > st.day ? R.RATION_CUT : 1) * (1 + R.CHEF_WASTE * (1 - eff('chef')))
    + R.FARM * eff('farmer') * (st.res.water > 0 ? 1 : 0.3));
  g.res('water', -(R.DRINK * n + R.DRINK_YOU + R.CROPS) + R.RECYCLE * eff('engineer'));
  g.res('power', -(R.POWER_BASE - R.POWER_ENG * eff('engineer')) - (st.cameras ? R.CAMERA_POWER : 0));
  g.res('med', -(R.MED_BASE + R.MED_DOC * (1 - eff('doctor'))));
  g.res('lux', -(R.LUX_YOU + (g.s('heir') ? R.LUX_HEIR : 0) + (st.informant ? R.INFORMANT_DAILY : 0)));

  for (const p of st.staff) p.hist.push(p.status === 'ok' ? [Math.round(p.loyalty), Math.round(p.fear), p.stage] : null);
  st.unrestHist = st.unrestHist || []; st.unrestHist.push(Math.round(st.unrest));

  // 4. Has the silo been squeezed too hard?
  const names = { food: 'The larder is empty', water: 'The water tanks are dry', power: 'The generator has stopped and the air is going stale' };
  for (const k of ['food', 'water', 'power']) {
    st.crit[k] = st.res[k] <= 0 ? st.crit[k] + 1 : 0;
    if (st.crit[k] >= R.CRIT_NIGHTS) { g.end('everyone_' + k); return; }
    if (st.crit[k] >= 1) {
      g.loy('all', -4); g.unrest(6);
      inc.push({ kind: 'crit', text: `${names[k]}. ${st.crit[k] === 1 ? 'The silo cannot run like this for long.' : 'One more night like this and nobody wakes up.'}` });
      if (!st.queue.some((q) => q.id === 'crisis')) g.queue('crisis', { k }, 6);
    }
  }
  if (st.day >= R.DAYS) { g.end(finalEnding(st, g)); return; }
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
  return st.res.lux >= 12 ? 'king' : 'king_poor';
}

export { ctx as _ctx };
