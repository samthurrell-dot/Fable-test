// engine/auto.js
// Players made of code, for balancing the rules and for jumping to a given day (?day=).
//   random   any choice it can afford, any card on anyone, any project: a careless player
//   careful  uses only what a person can see (faces, rumours, what people say, the stores): a sensible player
//   saint    never plays a ruthless card; tyrant plays them whenever it can and lives decadently:
//            the two styles the design must both allow
//   seer     reads the hidden numbers: the best a player could hope to do
// A policy: event(st, view, r) -> choice; orders(st) sets rations and lifestyle; project(st) -> id or null;
// matter(st, m) -> choice id or null; card(st, hand, r) -> { i, arg } or null (asked until out of plays);
// request(st, v, r) -> 'yes' | 'alt' | 'no' for a new request; work(st, v, r) -> true to do today's part of a promise;
// build(st, v, r) -> the ways to work on the project today, in order ('mat', 'overtime', 'time'), or [].
// simulate(n, policy, card) plays n whole runs and reports how they ended, the score, and what a day asked.

import { CANDIDATES } from '../data/staff.js';
import { REQUESTS } from '../data/requests.js';
import { newRun, openDay, eventView, choose, handView, mayPlay, playCard, promiseList, projectList, commission, matterView, decide, setPolicy, endDay, forecast, canEscape, escape, requestView, answer, workOn, needsFirst, projectView, buildPart, storeLevers, useLever } from './sim.js';

const AMBIGUOUS = ['chef_special', 'airlock', 'vitamin', 'master_keys', 'midnight_note'];
const here = (st) => st.staff.filter((p) => p.status === 'ok');
const suspect = (p) => p && (p.exposed || p.face === 'sour' || p.face === 'angry' || p.face === 'grin' || (p.rumour && p.rumour.sig >= 3) || (p.tested && (p.tested.band === 'hostile' || p.tested.band === 'wavering') && p.tested.day > 0));
const okIdx = (view) => view.choices.map((c, i) => (c.ok ? i : -1)).filter((i) => i >= 0);
const first = (view, ...order) => order.find((i) => view.choices[i] && view.choices[i].ok) ?? okIdx(view)[0];
const worstFirst = (st, spare) => here(st).filter((p) => suspect(p) && p.role !== spare).sort((a, b) => (b.rumour ? b.rumour.sig : 0) - (a.rumour ? a.rumour.sig : 0));
const STORES = ['food', 'water', 'power'];

function score(st) {
  if (st.ending) return /^(king|word|escaped)/.test(st.ending.id) ? 1e4 + st.res.opu : -1e4;
  const h = here(st);
  let s = h.reduce((a, p) => a + p.loyalty + p.fear * 0.15, 0) / Math.max(1, h.length) * 2 + h.length * 6;
  for (const k of STORES) s += Math.min(st.res[k], 45) * 1.2;
  s += Math.min(st.res.med, 25) * 0.6 + Math.min(st.res.lux, 40) * 0.5 + st.res.opu * 0.4 - st.unrest * 0.5 - st.stats.broken * 20;
  return s;
}

// Event choices: weigh what each does to the stores (a short store counts for more) and to your score.
function weighEvent(st, view, r, opuWeight) {
  const id = st.event.id;
  if (AMBIGUOUS.includes(id)) {
    const p = view.from ? st.staff.find((x) => x.role === view.from) : null;
    return (p ? suspect(p) : here(st).some(suspect)) ? first(view, 1, 2) : 0;
  }
  if (id === 'mutiny') {
    if (st.stats.broken < 2) return 0;
    if (view.choices[2] && view.choices[2].ok) return 2;   // buy off the ringleader
    const e = here(st).find((p) => p.role === 'engineer'), sec = here(st).find((p) => p.role === 'security');
    return e && !suspect(e) ? 3 : sec && !suspect(sec) ? 1 : 0;
  }
  if (id === 'promise_due') return first(view, 0, 2);
  if (id === 'promise_reminded') return first(view, 0, 1);
  if (id === 'vote') return here(st).filter((p) => !suspect(p)).length * 2 >= here(st).length ? 0 : 1;
  const w = (k) => (k === 'opu' ? opuWeight : k === 'lux' ? 0.5 : k === 'med' ? (st.res.med < 12 ? 2 : 0.7) : st.res[k] < 20 ? 3 : st.res[k] < 35 ? 1.5 : 0.5);
  let best = okIdx(view)[0], bestS = -Infinity;
  for (const i of okIdx(view)) {
    const s = Object.entries(view.choices[i].cost).reduce((a, [k, d]) => a + d * w(k), 0) + r() * 9;
    if (s > bestS) { bestS = s; best = i; }
  }
  return best;
}

// Lifestyle as high as the stores will bear; rations as kind as they will bear.
function setLife(st, greed, kind) {
  const f = forecast(st), days = 31 - st.day;
  const lasts = (k, extra) => st.res[k] + (f[k] - extra) * days > 8;
  const P = { 2: [2.2 - 0.8, 1.6 - 0.6, 1.4 - 0.6], 1: [0, 0, 0] };
  const cur = st.policy.life;
  let want = Math.min(2, greed);
  // step up only if the stores will last with the bigger appetite; step down if they will not last as they are
  while (want > 0) {
    const d = want - cur, add = want === 2 && cur < 2 ? P[2] : [0, 0, 0];
    if (d <= 0 ? STORES.every((k) => lasts(k, 0)) : STORES.every((k, j) => lasts(k, add[j]))) break;
    want--;
  }
  setPolicy(st, 'life', want);
  setPolicy(st, 'rations', st.res.food < 12 ? 0 : kind && st.res.food > days * 1.8 + 25 ? 2 : 1);
}

// Stores that will not last to the hatch as things stand.
const short = (st) => { const f = forecast(st), left = 31 - st.day; return ['food', 'water', 'power', 'med'].filter((k) => f[k] < 0 && st.res[k] + f[k] * left < 0); };
// A sensible player facing a store that will run out: use less of it, and top it up when it is nearly empty.
function rescue(st) {
  let n = 0;
  for (const k of short(st)) {
    const v = storeLevers(st, k);
    if (!v) continue;
    for (const o of v.options) {
      if (!o.ok) continue;
      if (o.id === 'less' && useLever(st, k, 'less') !== null) n++;
      if (o.id === 'more' && st.res[k] < 12 && useLever(st, k, 'more') !== null) n++;
    }
  }
  return n;
}
function pickProject(st, prefs, reserve) {
  const s0 = short(st);
  prefs = [...(s0.includes('water') ? ['recycler'] : []), ...(s0.includes('power') ? ['generator'] : []), ...prefs];
  const list = projectList(st);
  for (const id of prefs) { const v = list.find((x) => x.id === id); if (v && v.ok && st.res.lux + v.cost.lux >= reserve) return id; }
  return null;
}

// Choose a card from the hand. value(card, st) -> number or -Infinity; who(card, st) -> person or null.
function pickCard(st, value, who) {
  const hand = handView(st);
  let best = null, bestV = 0;
  for (const c of hand) {
    if (!c.ok) continue;
    let arg = {};
    if (c.target) { const p = who(c, st); if (!p || !mayPlay(st, c.i, p)) continue; arg.role = p.role; }
    if (c.promise) { const o = promiseList(st).find((x) => x.ok && !x.target && x.type !== 'vote'); if (!o) continue; arg.type = o.type; }
    const v = value(c, st, arg);
    if (v > bestV) { bestV = v; best = { i: c.i, arg }; }
  }
  return best;
}
const exposedFirst = (st) => here(st).find((p) => p.exposed);
const targetFor = (c, st) => {
  const ex = exposedFirst(st), worst = worstFirst(st, c.kind === 'cruel' ? 'security' : null);
  if (c.id === 'exile' || c.id === 'cell') return ex || (c.id === 'cell' ? worst.find((p) => p.rumour && p.rumour.sig >= 5) : null);
  if (c.id === 'divide') return worst.find((p) => p.friend) || null;
  if (c.id === 'consultant' || c.id === 'tapes') return worst.find((p) => !p.tested || st.day - p.tested.day > 8) || here(st).find((p) => !p.tested) || null;
  if (c.id === 'eotm') return here(st).find((p) => p.trait === 'proud' && suspect(p)) || worst[0] || here(st).find((p) => p.trait === 'proud') || null;
  if (c.id === 'summit') return worst.find((p) => p.trait !== 'proud') || here(st).find((p) => p.trait === 'greedy') || null;
  if (c.id === 'talk') return worst.find((p) => st.day - (p.talked ?? -9) >= 4) || null;
  if (c.id === 'review') return here(st).find((p) => p.face === 'flat' || p.stage === 2) || worst[0] || here(st)[0];
  if (c.id === 'nda') return here(st).find((p) => p.trait === 'gossip') || null;
  if (c.id === 'trust') return here(st).find((p) => p.face === 'happy' || p.face === 'content') || null;
  return worst[0] || (c.kind === 'cruel' ? here(st)[here(st).length - 1] : null);
};
// Can the stores carry the rest of this request, keeping `spare` of each? (A request paid in time needs a free play a day.)
const carry = (st, v, spare) => {
  if (v.time) return requestView(st).filter((x) => x.state === 'owed' && x.time).length < 1;
  return Object.entries(v.part).every(([k, d]) => k === 'opu' ? st.res.opu + d * (v.steps - v.done) >= 0 : st.res[k] + d * (v.steps - v.done) >= spare);
};
const running = (st) => requestView(st).filter((x) => x.state === 'owed').length;
const useful = (id) => { const d = REQUESTS[id], k = d.perk; return d.role === 'security' || !!k.opu || !!(k.night && k.night.opu) || ['filing', 'workshop', 'union'].includes(k.flag); };
const altPays = (v) => (v.choices[1].cost.opu || 0) > 0 || (v.choices[1].cost.lux || 0) > 0;
// How to push the project today. Materials if the stores can spare them; else overtime if the staff look all
// right; else your own time. Rush (a second part) when the first project's opening is close.
const matOk = (st, v, spare) => Object.entries(v.options[0].cost).every(([k, d]) => st.res[k] + d >= spare);
const pushes = (st, v, spare, moodOk) => {
  const out = [];
  if (v.options[0].ok && matOk(st, v, spare)) out.push('mat');
  else if (moodOk) out.push('overtime');
  else if (st.plays >= 2) out.push('time');
  const tight = v.due && !v.missed && v.left - out.length > v.due - st.day;
  if (tight) out.push(moodOk && !out.includes('overtime') ? 'overtime' : 'time');
  return out;
};
const mend = (st, m, spare) => (m.choices[0].ok && st.res.lux >= spare ? 'repair' : 'staff');
const tense = (st) => !!(st.report && st.report.tense);

export const POLICIES = {
  random: {
    event: (st, view, r) => { const ok = okIdx(view); return ok[Math.floor(r() * ok.length)]; },
    orders: (st, r) => { if (r() < 0.3) { setPolicy(st, 'life', Math.floor(r() * 3)); setPolicy(st, 'rations', Math.floor(r() * 3)); } },
    project: (st, r) => { const ok = projectList(st).filter((v) => v.ok); return ok.length && r() < 0.3 ? ok[Math.floor(r() * ok.length)].id : null; },
    matter: (st, m, r) => (r() < 0.6 ? (r() < 0.5 && m.choices[0].ok ? 'repair' : 'staff') : null),
    request: (st, v, r) => (r() < 0.3 ? null : ['yes', 'alt', 'no'][Math.floor(r() * 3)]),
    build: (st, v, r) => (r() < 0.4 ? [] : [['mat', 'overtime', 'time'][Math.floor(r() * 3)]]),
    work: (st, v, r) => r() < 0.6,
    card: (st, r) => {
      if (r() < 0.2) return null;
      const h = here(st), ok = handView(st).filter((c) => c.ok);
      const c = ok[Math.floor(r() * ok.length)];
      if (!c) return null;
      const arg = {};
      if (c.target) { const p = h[Math.floor(r() * h.length)]; if (!p || !mayPlay(st, c.i, p)) return null; arg.role = p.role; }
      if (c.promise) { const o = promiseList(st).find((x) => x.ok && !x.target); if (!o) return null; arg.type = o.type; }
      return { i: c.i, arg };
    },
  },
  careful: {
    rescue,
    event: (st, view, r) => weighEvent(st, view, r, 0.6),
    orders: (st) => setLife(st, 1, here(st).filter(suspect).length >= 3),
    project: (st) => pickProject(st, ['wellness', 'hottub', 'truffles', 'butler', 'mint', 'panic'], 12),
    matter: (st, m) => mend(st, m, 10),
    request: (st, v) => (running(st) < 2 && carry(st, v, 18) ? 'yes' : v.choices[1].ok && !suspect(st.staff.find((p) => p.role === v.role)) ? 'alt' : 'no'),
    work: (st, v) => v.time || carry(st, v, 10),
    build: (st, v) => pushes(st, v, 15, here(st).filter(suspect).length < 3),
    card: (st) => pickCard(st, (c) => {
      const worst = worstFirst(st).length;
      if (c.id === 'exile') return exposedFirst(st) ? 100 : -1;
      if (c.kind === 'cruel') return c.id === 'search' && st.res.food < 20 ? 3 : c.id === 'review' ? 1 : -1;
      if (c.kind === 'self') return st.res.lux > 25 ? 4 : st.res.lux > 15 ? 2 : -1;
      if (c.id === 'perk') return worst && st.res.lux >= 10 ? 6 : -1;
      if (c.id === 'consultant') return worst ? 5 : 1;
      if (c.id === 'talk') return worst ? 5 : -1;
      if (['ted', 'poster', 'broadcast', 'yoga', 'funday', 'billibucks'].includes(c.id)) return tense(st) || worst >= 2 ? 7 : 2;
      if (c.id === 'promise') return worst >= 3 ? 6 : -1;
      if (c.id === 'rebrand') return st.res.food < 25 ? 4 : -1;
      if (c.id === 'trickle') return worst >= 2 && st.res.food > 30 ? 4 : -1;
      return 2;
    }, targetFor),
  },
  saint: {
    rescue,
    event: (st, view, r) => weighEvent(st, view, r, 0.2),
    orders: (st) => setLife(st, 1, true),
    project: (st) => pickProject(st, ['wellness', 'truffles', 'hottub', 'mint', 'butler'], 8),
    matter: (st, m) => mend(st, m, 4),
    request: (st, v) => (carry(st, v, 10) ? 'yes' : 'no'),
    work: (st, v) => v.time || carry(st, v, 4),
    build: (st, v) => pushes(st, v, 8, false),
    card: (st) => pickCard(st, (c) => {
      const worst = worstFirst(st).length;
      if (c.id === 'exile') return exposedFirst(st) ? 100 : -1;
      if (c.kind === 'cruel') return -1;
      if (c.kind === 'self') return st.res.lux > 30 ? 2 : -1;
      if (c.id === 'perk') return st.res.lux >= 8 ? (worst ? 8 : 3) : -1;
      if (c.id === 'talk') return 5;
      if (c.id === 'trickle') return st.res.food > 25 ? 5 : -1;
      if (c.id === 'promise') return worst >= 2 ? 6 : -1;
      return tense(st) || worst ? 5 : 2;
    }, (c, st) => targetFor(c, st) || (c.target && ['perk', 'talk', 'eotm', 'summit'].includes(c.id) ? here(st).sort((a, b) => (a.talked ?? -9) - (b.talked ?? -9))[0] : null)),
  },
  tyrant: {
    rescue,
    event: (st, view, r) => (st.event.id === 'vote' ? first(view, 2, 1) : weighEvent(st, view, r, 1.5)),   // a tyrant cancels the vote
    orders: (st) => setLife(st, 2, false),
    project: (st) => pickProject(st, ['gallery', 'cameras', 'radio', 'panic', 'butler', 'hottub', 'pod'], 6),
    matter: (st, m) => mend(st, m, 14),
    // a tyrant keeps what keeps security sweet or feeds the score; promises anything else when the bunker
    // is restless, and does none of it; otherwise takes the selfish answer
    request: (st, v) => (useful(v.id) && carry(st, v, 14) ? 'yes' : tense(st) ? 'yes' : v.choices[1].ok && (altPays(v) || v.time) ? 'alt' : 'no'),
    work: (st, v) => useful(v.id),
    build: (st, v) => (v.options[0].ok && matOk(st, v, 12) ? ['overtime', 'mat'] : ['overtime']),   // a tyrant works them hard
    card: (st) => pickCard(st, (c) => {
      const h = here(st), sec = h.find((p) => p.role === 'security');
      if (c.id === 'exile') return exposedFirst(st) ? 100 : -1;
      if (c.id === 'perk') return sec && (sec.face === 'sour' || sec.face === 'angry') && st.res.lux >= 7 ? 9 : h.length <= 5 && st.res.lux >= 9 ? 6 : -1;
      // a plot is growing (the report warned of it): break it up, find out who, lock them up
      if ((st.plotSeen || 1) >= 2) {
        if (c.id === 'divide') return 12;
        if (c.id === 'interrogate' || c.id === 'tapes') return 11;
        if (c.id === 'cell') return worstFirst(st).some((p) => p.rumour && p.rumour.sig >= 5) ? 11 : 6;
        if (c.id === 'scapegoat') return 9;
      }
      // cruel on purpose: at people who look like trouble (and at whoever, to go a step further down), not at random
      if (c.kind === 'cruel') return h.length <= 5 ? -1 : !c.target ? (st.res.food < 25 || c.id === 'curfew' ? 5 : 2) : worstFirst(st, 'security').length ? 6 + (c.tier || 0) : c.tier === st.regime - 1 ? 4 : -1;
      if (c.kind === 'self') return st.res.lux >= 8 || !c.cost ? 6 : -1;
      // and keeps the bunker sweet with circuses when it gets restless
      if (['funday', 'yoga', 'broadcast', 'ted', 'poster', 'billibucks', 'eotm'].includes(c.id)) return st.unrest >= 35 || (st.plotSeen || 1) >= 2 ? 8 : 3;
      if (['nda', 'tapes'].includes(c.id)) return 4;
      if (c.id === 'promise') return tense(st) ? 5 : -1;
      return 1;
    }, targetFor),
  },
  // does the least it can: answers today's business sensibly, and nothing else (no cards, no requests,
  // no repairs, no projects beyond the one it must start). If this player keeps power, the game has no tension.
  passive: {
    event: (st, view, r) => weighEvent(st, view, r, 0.6),
    orders: () => {},
    project: () => null,
    matter: () => null,
    request: () => null,
    work: () => false,
    build: () => [],
    card: () => null,
  },
  seer: {
    rescue,
    event: (st, view) => {
      let best = okIdx(view)[0], bestS = -Infinity;
      for (const i of okIdx(view)) {
        let s = 0;
        for (let k = 0; k < 4; k++) { const c = structuredClone(st); c.load = null; c.rng = (c.rng + k * 7919) | 0; choose(c, i); s += score(c) / 4; }
        if (s > bestS) { bestS = s; best = i; }
      }
      return best;
    },
    orders: (st) => setLife(st, here(st).filter((p) => p.loyalty < 45).length >= 3 ? 1 : 2, here(st).filter((p) => p.loyalty < 50).length >= 3),
    project: (st) => pickProject(st, ['wellness', 'hottub', 'butler', 'truffles', 'panic', 'gallery'], 10),
    matter: (st, m) => mend(st, m, 6),
    build: (st, v) => pushes(st, v, 12, here(st).filter((p) => p.loyalty < 45).length < 2),
    request: (st, v) => { const p = st.staff.find((x) => x.role === v.role); return carry(st, v, 14) && (running(st) < 2 || p.loyalty < 45) ? 'yes' : p.loyalty >= 55 && v.choices[1].ok ? 'alt' : 'no'; },
    work: (st, v) => v.time || carry(st, v, 6),
    card: (st) => pickCard(st, (c, s, arg) => {
      const low = here(st).filter((p) => p.loyalty < 48).length;
      if (c.id === 'exile') return exposedFirst(st) ? 100 : -1;
      if (c.kind === 'cruel') return -1;
      if (c.kind === 'self') return low <= 1 && st.res.lux > 15 ? 7 : -1;
      if (c.id === 'perk') return low && st.res.lux >= 9 ? 8 : -1;
      if (c.id === 'talk') return low ? 6 : -1;
      return low || st.unrest > 35 ? 5 : 2;
    }, (c, st) => {
      const h = here(st).slice().sort((a, b) => a.loyalty - b.loyalty);
      if (c.id === 'exile') return exposedFirst(st) || null;
      if (c.id === 'eotm') return h.find((p) => p.trait === 'proud') || h[0];
      if (c.id === 'summit') return h.find((p) => p.trait !== 'proud') || null;
      if (c.id === 'nda') return h.find((p) => p.trait === 'gossip') || null;
      if (c.id === 'divide') return null;
      return h[0] || null;
    }),
  },
};

// Plays one whole day (or what is left of it) with a policy. r: a random function for the policy's own dice.
// If st.load is set, it also counts what the day asked of the player: words put in front of them and decisions made.
const words = (t) => (t ? String(t).trim().split(/\s+/).length : 0);
export function playDay(st, policy, r = Math.random) {
  if (st.phase === 'report') openDay(st);
  if (st.phase !== 'day') return;
  const L = st.load;
  if (L) {
    const rep = st.report, v = eventView(st);
    L.days++;
    L.words += words(rep.mood) + words(rep.cams) + rep.inc.reduce((a, x) => a + words(x.text), 0) + rep.rumours.reduce((a, x) => a + words(x.text), 0);
    L.words += words(v.title) + words(v.text) + v.choices.reduce((a, c) => a + words(c.label), 0);
    L.words += handView(st).reduce((a, c) => a + words(c.name) + words(c.text), 0);
    for (const m of matterView(st)) { L.words += words(m.text); L.waiting++; }
    for (const v of requestView(st)) { L.words += v.state === 'asked' ? words(v.text) + v.choices.reduce((a, c) => a + words(c.label), 0) : words(v.title) + 6; L.waiting++; }
  }
  if (!st.eventDone) choose(st, policy.event(st, eventView(st), r));
  if (st.phase !== 'day') return;
  if (L) { L.decisions++; L.words += words(st.result && st.result.text); }
  policy.orders(st, r);
  // day 1: the first project must be chosen. Players made of code pick the one that eats the store they have most of
  // (the careless player picks at random).
  if (needsFirst(st)) {
    const firsts = projectList(st).filter((v) => v.ok);
    const store = (v) => Object.keys(v.mat)[0];
    const pick = policy === POLICIES.random ? firsts[Math.floor(r() * firsts.length)] : firsts.sort((x, y) => st.res[store(y)] - st.res[store(x)])[0];
    if (pick && commission(st, pick.id) !== null && L) L.decisions++;
  }
  const pj = policy.project(st, r);
  if (pj && commission(st, pj) !== null && L) L.decisions++;
  // stores that will not last: the levers on each store's sheet
  if (policy.rescue) { const k = policy.rescue(st); if (L) L.decisions += k; }
  // the project under way only moves when it is worked on
  const pv = projectView(st);
  if (pv && policy.build) for (const how of policy.build(st, pv, r)) if (buildPart(st, how) !== null && L) L.decisions++;
  for (let guard = 0; guard < 4; guard++) {
    const ms = matterView(st);
    let did = false;
    for (const m of ms) { const id = policy.matter(st, m, r); if (id && decide(st, m.i, id) !== null) { did = true; if (L) L.decisions++; break; } }
    if (!did) break;
  }
  // requests: answer new ones, then do today's part of each promise the policy means to keep
  for (let guard = 0; guard < 6; guard++) {
    let did = false;
    for (const v of requestView(st)) {
      if (v.state === 'asked') { const a = policy.request ? policy.request(st, v, r) : 'no'; if (a && answer(st, v.i, a) !== null) { did = true; if (L) L.decisions++; break; } }
      else if (v.work.ok && policy.work && policy.work(st, v, r) && workOn(st, v.i) !== null) { did = true; if (L) L.decisions++; break; }
    }
    if (!did) break;
  }
  for (let guard = 0; guard < 4 && st.plays > 0; guard++) {
    const o = policy.card(st, r);
    if (!o || playCard(st, o.i, o.arg) === null) break;
    if (L) L.decisions++;
  }
  if (L) for (const t of st.today) L.words += words(t.text);
  // with an escape pod and a grim outlook, leave
  if (canEscape(st) && (st.unrest > 70 || here(st).filter((p) => p.stage >= 5).length >= 3)) { escape(st); return; }
  endDay(st);
}

export function playOut(st, policy, r = Math.random, untilDay = Infinity) {
  let guard = 0;
  while (st.phase !== 'ended' && st.day < untilDay && guard++ < 200) playDay(st, policy, r);
  return st;
}

// Plays n whole runs and reports how they ended, the score (opulence), how often each card and project
// was used (a run), and what a day asked of the player (words read, decisions made, things waiting).
export function simulate(n = 200, policyName = 'careful', cardId = 'inherited', seed0 = 1) {
  const out = { runs: n, policy: policyName, card: cardId, endings: {}, kinds: {}, meanDay: 0, left: { food: 0, water: 0, power: 0, med: 0, lux: 0 }, meanStaff: 0, acts: 0, infamy: 0, opu: 0, opuWin: 0, wins: 0, built: 0, titles: {}, uses: {}, req: { made: 0, kept: 0, broken: 0, asked: 0 }, fled: 0, attempts: 0, load: { days: 0, words: 0, decisions: 0, waiting: 0 } };
  let s = seed0 * 2654435761;
  const r = () => { s = (s + 0x6D2B79F5) | 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < n; i++) {
    const picks = {};
    for (const role in CANDIDATES) picks[role] = Math.floor(r() * CANDIDATES[role].length);   // a different crowd at the hatch each run
    const st = newRun(cardId, seed0 * 1000 + i, picks);
    st.load = out.load;
    playOut(st, POLICIES[policyName], r);
    const id = st.ending ? st.ending.id : 'stuck';
    out.endings[id] = (out.endings[id] || 0) + 1;
    const kind = id.split('_')[0];
    out.kinds[kind] = (out.kinds[kind] || 0) + 1;
    const won = /^(king|word|escaped)/.test(id);
    if (won) { out.wins++; out.opuWin += st.res.opu; }
    out.meanDay += st.day / n;
    out.meanStaff += here(st).length / n;
    out.infamy += st.infamy / n;
    out.opu += st.res.opu / n;
    out.built += Object.keys(st.built).length / n;
    out.fled += st.staff.filter((p) => p.fled).length / n; out.attempts += st.stats.survivedAttempts / n;
    out.req.asked += st.requests.length / n; out.req.made += st.stats.reqMade / n; out.req.kept += st.stats.reqKept / n; out.req.broken += st.stats.reqBroken / n;
    for (const l of st.log) {
      const k = l.card ? l.card : l.project ? 'build:' + l.project : l.matter ? `${l.matter}:${l.id}` : l.answer ? `req:${l.request}:${l.answer}` : null;
      if (!k) continue;
      out.uses[k] = (out.uses[k] || 0) + 1 / n;
      if (l.card) out.acts += 1 / n;
    }
    for (const k in out.left) out.left[k] += st.res[k] / n;
  }
  if (out.wins) out.opuWin /= out.wins;
  return out;
}
