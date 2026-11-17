// engine/auto.js
// Players made of code, for balancing the rules and for jumping to a given day (?day=).
//   random   picks any choice it can afford, sets its standing orders by dice and acts at random: a careless player
//   saint    never takes a harsh measure; tyrant goes down the slope as fast as it opens: the two styles the design must both allow
//   careful  uses only what a person can see (faces, rumours, what people say, the stores): a sensible player
//   seer     reads the hidden numbers and looks one step ahead: the best a player could hope to do
// A policy has four parts: event(st, view, r) -> choice; orders(st, r) sets the standing orders;
// matter(st, m, r) -> choice id or null; action(st, r) -> { id, arg } or null (called until out of actions).
// simulate(n, policy, card) plays n whole runs and counts the endings.

import { CANDIDATES } from '../data/staff.js';
import { newRun, openDay, eventView, choose, act, actionList, mayUse, promiseList, matterView, decide, setPolicy, indulge, endDay } from './sim.js';

const AMBIGUOUS = ['chef_special', 'airlock', 'vitamin', 'master_keys', 'midnight_note'];
const here = (st) => st.staff.filter((p) => p.status === 'ok');
const suspect = (p) => p && (p.exposed || p.face === 'sour' || p.face === 'angry' || (p.rumour && p.rumour.sig >= 3) || (p.notes || []).some((n) => !n.startsWith('Holds') && !n.includes('passed')));
const okIdx = (view) => view.choices.map((c, i) => (c.ok ? i : -1)).filter((i) => i >= 0);
const first = (view, ...order) => order.find((i) => view.choices[i] && view.choices[i].ok) ?? okIdx(view)[0];
const can = (st, id) => actionList(st).find((o) => o.id === id).ok;

function score(st) {
  if (st.ending) return /^(king|word)/.test(st.ending.id) ? 1e4 : -1e4;
  const h = here(st);
  let s = h.reduce((a, p) => a + p.loyalty + p.fear * 0.15, 0) / Math.max(1, h.length) * 2 + h.length * 6;
  for (const k of ['food', 'water', 'power']) s += Math.min(st.res[k], 45) * 1.2;
  s += Math.min(st.res.med, 25) * 0.6 + Math.min(st.res.lux, 40) * 0.5 + Math.min(st.res.comfort, 70) * 0.5 - st.unrest * 0.5 - st.stats.broken * 20;
  return s;
}

// Standing orders by what is running short: your comforts go first, the staff's last.
function thrift(st, kind) {
  // A comfort is kept on while there is more in the store than the rest of the run needs without it.
  const r = st.res, days = 31 - st.day;
  const spare = (k, perDay, margin) => r[k] > days * perDay + margin;
  const low = r.comfort < 45;
  setPolicy(st, 'tub', spare('water', 1.4, low ? 6 : 14) ? 1 : 0);
  setPolicy(st, 'cinema', spare('power', 1.6, low ? 6 : 14) ? 1 : 0);
  setPolicy(st, 'heating', r.power < 10 ? 0 : 1);
  setPolicy(st, 'table', r.food < 12 ? 0 : spare('food', 1.2, 30) ? 2 : spare('food', 0.9, low ? 4 : 12) ? 1 : 0);
  setPolicy(st, 'rations', r.food < 10 ? 0 : kind && spare('food', 1.8, 28) ? 2 : 1);
  setPolicy(st, 'shifts', r.food < 16 || r.water < 12 ? 2 : 1);
  if (r.comfort < 62 && r.lux >= 4 && (r.comfort < 32 || r.lux >= 14)) indulge(st);
}

// May this player use this action (on this person) right now?
const use = (st, id, p) => { const o = actionList(st).find((x) => x.id === id); return !!o && (!o.target || !!p) && mayUse(st, o, p || null); };
const today = (st, k) => st['did_' + k] === st.day;
const mark = (st, k) => { st['did_' + k] = st.day; };
const mend = (st, m, spare) => (m.choices[0].ok && st.res.lux >= spare ? 'repair' : 'staff');
const worstFirst = (st, spare) => here(st).filter((p) => suspect(p) && p.role !== spare).sort((a, b) => (b.rumour ? b.rumour.sig : 0) - (a.rumour ? a.rumour.sig : 0));

export const POLICIES = {
  // Careless: any choice it can afford, standing orders by dice, any open action on anyone.
  random: {
    event: (st, view, r) => { const ok = okIdx(view); return ok[Math.floor(r() * ok.length)]; },
    orders: (st, r) => { if (r() < 0.25) for (const [k, n] of [['rations', 3], ['shifts', 3], ['heating', 2], ['table', 3], ['tub', 2], ['cinema', 2], ['cameras', 2], ['curfew', 2]]) if (r() < 0.3) setPolicy(st, k, Math.floor(r() * n)); },
    matter: (st, m, r) => { const ok = m.choices.filter((c) => c.ok); return ok.length && r() < 0.6 ? ok[Math.floor(r() * ok.length)].id : null; },
    action: (st, r) => {
      if (r() < 0.5) return null;
      const h = here(st);
      const p = h[Math.floor(r() * h.length)];
      const list = actionList(st).filter((o) => o.id !== 'promise' && mayUse(st, o, p || null) && (!o.target || p));
      const o = list[Math.floor(r() * list.length)];
      return o ? { id: o.id, arg: o.target ? { role: p.role } : {} } : null;
    },
  },
  // Careful: a sensible player, using only what a person can see. Reads people before spending on them.
  careful: {
    event: (st, view, r) => {
      const id = st.event.id;
      if (AMBIGUOUS.includes(id)) {
        const p = view.from ? st.staff.find((x) => x.role === view.from) : null;
        return (p ? suspect(p) : here(st).some(suspect)) ? first(view, 1, 2) : 0;
      }
      if (id === 'mutiny') return st.stats.broken < 2 ? 0 : 1;
      if (id === 'promise_due') return first(view, 0, 2);
      if (id === 'promise_reminded') return first(view, 0, 1);
      if (id === 'vote') return here(st).filter((p) => !suspect(p)).length * 2 >= here(st).length ? 0 : 1;
      // anything else: weigh what each choice does to the stores (a short store counts for more), with
      // enough of a coin toss on top that generous choices still get picked while the stores are full
      const w = (k) => (k === 'lux' ? 0.5 : k === 'comfort' ? (st.res.comfort < 45 ? 1.2 : 0.4) : k === 'med' ? (st.res.med < 12 ? 2 : 0.7) : st.res[k] < 20 ? 3 : st.res[k] < 35 ? 1.5 : 0.5);
      let best = 0, bestS = -Infinity;
      for (const i of okIdx(view)) {
        const s = Object.entries(view.choices[i].cost).reduce((a, [k, d]) => a + d * w(k), 0) + r() * 9;
        if (s > bestS) { bestS = s; best = i; }
      }
      return best;
    },
    orders: (st) => thrift(st, here(st).filter(suspect).length >= 3),
    matter: (st, m) => {
      if (m.kind === 'ask') return m.choices[0].ok && st.res.lux >= 8 && st.res.comfort >= 40 ? 'yes' : m.left <= 1 ? 'no' : null;
      return mend(st, m, 8);
    },
    action: (st) => {
      const h = here(st);
      const caught = h.find((p) => p.exposed);
      if (caught && use(st, 'exile', caught)) return { id: 'exile', arg: { role: caught.role } };
      const worst = worstFirst(st);
      // read before spending: test the most worrying person you have no recent reading of
      const unread = worst.find((p) => (p.face === 'sour' || p.face === 'angry') && (!p.tested || st.day - p.tested.day >= 12));
      if (unread && !today(st, 'test') && use(st, 'test', unread)) { mark(st, 'test'); return { id: 'test', arg: { role: unread.role } }; }
      const known = h.filter((p) => p.tested && st.day - p.tested.day < 9 && (p.tested.band === 'hostile' || p.tested.band === 'wavering') && p.perkDay !== st.day).sort((a, b) => (a.tested.band === 'hostile' ? 0 : 1) - (b.tested.band === 'hostile' ? 0 : 1) || a.perks - b.perks);
      if (known[0] && st.res.lux >= 11 && use(st, 'perk', known[0])) { known[0].perkDay = st.day; return { id: 'perk', arg: { role: known[0].role } }; }
      const unheard = worst.find((p) => st.day - (p.talked ?? -9) >= 4);
      if (unheard && st.res.comfort >= 50 && use(st, 'talk', unheard)) return { id: 'talk', arg: { role: unheard.role } };
      if (worst.length >= 2 && st.speeches < 3 && !today(st, 'speech') && use(st, 'speech')) { mark(st, 'speech'); return { id: 'speech', arg: {} }; }
      if (worst.length >= 3 && !today(st, 'promise') && use(st, 'promise')) { const p = promiseList(st).find((o) => o.ok && !o.target && o.type !== 'vote'); if (p) { mark(st, 'promise'); return { id: 'promise', arg: { type: p.type } }; } }
      const quiet = h.find((p) => st.day - (p.talked ?? -9) >= 6);
      if (quiet && st.res.comfort >= 66 && use(st, 'talk', quiet)) return { id: 'talk', arg: { role: quiet.role } };
      return null;
    },
  },
  // Saint: never takes a harsh measure (except to send away someone caught trying to remove you).
  // Listens, gives, promises and keeps its promises. Here to check that being decent is possible, if dear.
  saint: {
    event: (st, view, r) => POLICIES.careful.event(st, view, r),
    orders: (st) => { thrift(st, true); if (st.res.food > 40 && st.res.water > 30) setPolicy(st, 'shifts', 0); },
    matter: (st, m) => (m.kind === 'ask' ? (m.choices[0].ok && st.res.comfort >= 30 ? 'yes' : m.left <= 1 ? 'no' : null) : mend(st, m, 4)),
    action: (st) => {
      const h = here(st);
      const caught = h.find((p) => p.exposed);
      if (caught && use(st, 'exile', caught)) return { id: 'exile', arg: { role: caught.role } };
      const worst = worstFirst(st);
      const unheard = (worst.length ? worst : h).find((p) => st.day - (p.talked ?? -9) >= 3);
      if (unheard && st.res.comfort >= 40 && use(st, 'talk', unheard)) return { id: 'talk', arg: { role: unheard.role } };
      const needy = worst.find((p) => p.perkDay !== st.day);
      if (needy && st.res.lux >= 9 && use(st, 'perk', needy)) { needy.perkDay = st.day; return { id: 'perk', arg: { role: needy.role } }; }
      if (worst.length >= 2 && st.speeches < 3 && !today(st, 'speech') && use(st, 'speech')) { mark(st, 'speech'); return { id: 'speech', arg: {} }; }
      if (worst.length >= 2 && !today(st, 'promise') && use(st, 'promise')) { const p = promiseList(st).find((o) => o.ok && !o.target && o.type !== 'vote'); if (p) { mark(st, 'promise'); return { id: 'promise', arg: { type: p.type } }; } }
      return null;
    },
  },
  // Tyrant: goes down the slope as fast as it opens, rules by fear, lives well, and uses only what a
  // person can see. Here to check that being evil is a way to win, not only a way to lose.
  tyrant: {
    event: (st, view, r) => POLICIES.careful.event(st, view, r),
    orders: (st) => {
      thrift(st, false);
      setPolicy(st, 'curfew', 1);
      if (st.res.food < 34) setPolicy(st, 'rations', 0);
      if (st.res.food < 24 || st.res.water < 18) setPolicy(st, 'shifts', 2);
    },
    matter: (st, m) => (m.kind === 'ask' ? 'no' : mend(st, m, 14)),
    action: (st) => {
      const h = here(st), top = st.regime - 1;
      const caught = h.find((p) => p.exposed);
      if (caught && use(st, 'exile', caught)) return { id: 'exile', arg: { role: caught.role } };
      const worst = worstFirst(st, 'security'), target = worst[0] || h[h.length - 1];
      // with few left, buy the ones that remain: an empty bunker is a lost one
      if (h.length <= 5) { const t = worst.find((p) => p.perkDay !== st.day); if (t && st.res.lux >= 9 && use(st, 'perk', t)) { t.perkDay = st.day; return { id: 'perk', arg: { role: t.role } }; } return null; }
      // a tyrant needs one friend: the person with the keys
      const sec = h.find((p) => p.role === 'security');
      if (sec && (sec.face === 'sour' || sec.face === 'angry' || sec.face === 'flat') && sec.perkDay !== st.day && st.res.lux >= 7 && use(st, 'perk', sec)) { sec.perkDay = st.day; return { id: 'perk', arg: { role: 'security' } }; }
      // the next step down: use the lowest open rung once, and the one below it opens in the morning
      if (st.regime < 5 && !st.rungUsed[top] && target) { const id = ['reprimand', 'interrogate', 'example', 'scapegoat'][top]; if (use(st, id, target)) return { id, arg: { role: target.role } }; }
      const plotter = h.find((p) => p.rumour && p.rumour.informant && p.rumour.sig >= 5 && !((p.cell || 0) > st.day));
      if (plotter && !today(st, 'cell') && use(st, 'cell', plotter)) { mark(st, 'cell'); return { id: 'cell', arg: { role: plotter.role } }; }
      const grins = h.filter((p) => p.face === 'grin').length;
      if (grins * 2 < h.length && !today(st, 'fear') && target) { const id = use(st, 'example', target) ? 'example' : 'reprimand'; if (use(st, id, target)) { mark(st, 'fear'); return { id, arg: { role: target.role } }; } }
      if (st.report && st.report.tense && worst[0] && !today(st, 'scapegoat') && use(st, 'scapegoat', worst[0])) { mark(st, 'scapegoat'); return { id: 'scapegoat', arg: { role: worst[0].role } }; }
      const dark = h.find((p) => p.role !== 'security' && st.day - (p.askedDay ?? -9) >= 8 && (p.face === 'grin' || suspect(p)));
      if (dark && use(st, 'interrogate', dark)) { dark.askedDay = st.day; return { id: 'interrogate', arg: { role: dark.role } }; }
      if ((st.res.food < 26 || st.res.lux < 10) && st.searches < 2 && !today(st, 'search') && use(st, 'confiscate')) { mark(st, 'search'); return { id: 'confiscate', arg: {} }; }
      const close = worst.find((p) => p.friend && p.rumour && p.rumour.sig >= 4);
      if (close && use(st, 'divide', close)) return { id: 'divide', arg: { role: close.role } };
      return null;
    },
  },
  // Seer: reads the hidden numbers and tries each choice on a copy of the game. The best a player could hope to do.
  seer: {
    event: (st, view) => {
      let best = 0, bestS = -Infinity;
      for (const i of okIdx(view)) {
        let s = 0;
        for (let k = 0; k < 4; k++) { const c = structuredClone(st); c.load = null; c.rng = (c.rng + k * 7919) | 0; choose(c, i); s += score(c) / 4; }
        if (s > bestS) { bestS = s; best = i; }
      }
      return best;
    },
    orders: (st) => thrift(st, here(st).filter((p) => p.loyalty < 50).length >= 3),
    matter: (st, m) => {
      if (m.kind === 'ask') { const p = st.staff.find((x) => x.role === m.role); return m.choices[0].ok && (p.loyalty < 62 || m.left <= 1) && st.res.lux >= 6 ? 'yes' : m.left <= 1 ? 'no' : null; }
      return mend(st, m, 6);
    },
    action: (st) => {
      const h = here(st);
      const killer = h.find((p) => p.stage >= 6 && p.exposed);
      if (killer && use(st, 'exile', killer)) return { id: 'exile', arg: { role: killer.role } };
      const low = h.slice().sort((a, b) => a.loyalty - b.loyalty);
      const fresh = low.find((p) => p.loyalty < 58 && st.day - (p.talked ?? -9) >= 3);
      if (fresh && st.res.comfort >= 45 && use(st, 'talk', fresh)) return { id: 'talk', arg: { role: fresh.role } };
      const needy = low.find((p) => p.loyalty < 50 && p.perkDay !== st.day);
      if (needy && st.res.lux >= 13 && use(st, 'perk', needy)) { needy.perkDay = st.day; return { id: 'perk', arg: { role: needy.role } }; }
      if (st.unrest > 35 && st.speeches < 2 && !today(st, 'speech') && use(st, 'speech')) { mark(st, 'speech'); return { id: 'speech', arg: {} }; }
      return null;
    },
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
    L.words += words(rep.mood) + words(rep.cams) + words(rep.informant && rep.informant.text) + rep.inc.reduce((a, x) => a + words(x.text), 0) + rep.rumours.reduce((a, x) => a + words(x.text), 0);
    L.words += words(v.title) + words(v.text) + v.choices.reduce((a, c) => a + words(c.label), 0);
    for (const m of matterView(st)) { L.words += words(m.text) + m.choices.reduce((a, c) => a + words(c.label), 0); L.waiting++; }
  }
  if (!st.eventDone) choose(st, policy.event(st, eventView(st), r));
  if (st.phase !== 'day') return;
  if (L) { L.decisions++; L.words += words(st.result && st.result.text); }
  policy.orders(st, r);
  for (let guard = 0; guard < 6; guard++) {
    const ms = matterView(st);
    let did = false;
    for (const m of ms) { const id = policy.matter(st, m, r); if (id && decide(st, m.i, id) !== null) { did = true; if (L) L.decisions++; break; } }
    if (!did) break;
  }
  for (let guard = 0; guard < 4 && st.acts > 0; guard++) {
    const o = policy.action(st, r);
    if (!o || act(st, o.id, o.arg) === null) break;
    if (L) L.decisions++;
  }
  if (L) for (const t of st.today) L.words += words(t.text);
  endDay(st);
}

export function playOut(st, policy, r = Math.random, untilDay = Infinity) {
  let guard = 0;
  while (st.phase !== 'ended' && st.day < untilDay && guard++ < 200) playDay(st, policy, r);
  return st;
}

// Plays n whole runs and reports how they ended, what was left, how often each action was used (a run)
// and what a day asked of the player (words read, decisions made, things waiting).
export function simulate(n = 200, policyName = 'careful', cardId = 'inherited', seed0 = 1) {
  const out = { runs: n, policy: policyName, card: cardId, endings: {}, kinds: {}, meanDay: 0, left: { food: 0, water: 0, power: 0, med: 0, lux: 0, comfort: 0 }, meanStaff: 0, acts: 0, infamy: 0, uses: {}, load: { days: 0, words: 0, decisions: 0, waiting: 0 } };
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
    out.meanDay += st.day / n;
    out.meanStaff += here(st).length / n;
    out.infamy += st.infamy / n;
    for (const l of st.log) {
      const k = l.order ? l.order : l.matter ? `${l.matter}:${l.id}` : null;
      if (!k) continue;
      out.uses[k] = (out.uses[k] || 0) + 1 / n;
      if (l.order) out.acts += 1 / n;
    }
    for (const k in out.left) out.left[k] += st.res[k] / n;
  }
  return out;
}
