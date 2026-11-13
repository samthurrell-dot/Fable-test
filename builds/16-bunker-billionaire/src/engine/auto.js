// engine/auto.js
// Players made of code, for balancing the rules and for jumping to a given day (?day=).
//   random   picks any choice it can afford and uses tools at random: a careless player
//   careful  uses only what a person can see (faces, rumours, notes, the stores): a sensible player
//   seer     reads the hidden numbers and looks one step ahead: the best a player could hope to do
// simulate(n, policy, card) plays n whole runs and counts the endings.

import { newRun, openEvent, eventView, choose, order, orderList, promiseList, endDay } from './sim.js';

const AMBIGUOUS = ['chef_special', 'airlock', 'vitamin', 'master_keys', 'midnight_note'];
const here = (st) => st.staff.filter((p) => p.status === 'ok');
const suspect = (p) => p && (p.exposed || p.face === 'sour' || p.face === 'angry' || (p.rumour && p.rumour.sig >= 3) || (p.notes || []).some((n) => !n.startsWith('Holds') && !n.includes('passed')));
const okIdx = (view) => view.choices.map((c, i) => (c.ok ? i : -1)).filter((i) => i >= 0);
const first = (view, ...order) => order.find((i) => view.choices[i] && view.choices[i].ok) ?? okIdx(view)[0];

function score(st) {
  if (st.ending) return /^(king|word)/.test(st.ending.id) ? 1e4 : -1e4;
  const h = here(st);
  let s = h.reduce((a, p) => a + p.loyalty + p.fear * 0.15, 0) / Math.max(1, h.length) * 2 + h.length * 6;
  for (const k of ['food', 'water', 'power']) s += Math.min(st.res[k], 45) * 1.2;
  s += Math.min(st.res.med, 25) * 0.6 + Math.min(st.res.lux, 40) * 0.5 - st.unrest * 0.5 - st.stats.broken * 20;
  return s;
}

export const POLICIES = {
  random: {
    event: (st, view, r) => { const ok = okIdx(view); return ok[Math.floor(r() * ok.length)]; },
    order: (st, r) => {
      if (r() < 0.5) return null;
      const list = orderList(st).filter((o) => o.ok && o.id !== 'promise');
      const o = list[Math.floor(r() * list.length)], h = here(st);
      return o ? { id: o.id, arg: o.target ? { role: h[Math.floor(r() * h.length)].role } : {} } : null;
    },
  },
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
      const w = (k) => (k === 'lux' ? 0.5 : k === 'med' ? (st.res.med < 12 ? 2 : 0.7) : st.res[k] < 20 ? 3 : st.res[k] < 35 ? 1.5 : 0.5);
      let best = 0, bestS = -Infinity;
      for (const i of okIdx(view)) {
        const s = Object.entries(view.choices[i].cost).reduce((a, [k, d]) => a + d * w(k), 0) + r() * 9;
        if (s > bestS) { bestS = s; best = i; }
      }
      return best;
    },
    order: (st, r) => {
      const h = here(st), can = (id) => orderList(st).find((o) => o.id === id).ok;
      const caught = h.find((p) => p.exposed);
      if (caught) return { id: 'exile', arg: { role: caught.role } };
      const worst = h.filter(suspect).sort((a, b) => (b.rumour ? b.rumour.sig : 0) - (a.rumour ? a.rumour.sig : 0))[0];
      if (worst && st.res.lux >= 12 && can('perk')) return { id: 'perk', arg: { role: worst.role } };
      if (worst && st.speeches < 3) return { id: 'speech', arg: {} };
      if (h.filter(suspect).length >= 3 && can('promise')) { const p = promiseList(st).find((o) => o.ok && !o.target && o.type !== 'vote'); if (p) return { id: 'promise', arg: { type: p.type } }; }
      return null;
    },
  },
  seer: {
    event: (st, view) => {
      let best = 0, bestS = -Infinity;
      for (const i of okIdx(view)) {
        let s = 0;
        for (let k = 0; k < 4; k++) { const c = structuredClone(st); c.rng = (c.rng + k * 7919) | 0; choose(c, i); s += score(c) / 4; }
        if (s > bestS) { bestS = s; best = i; }
      }
      return best;
    },
    order: (st) => {
      const h = here(st), can = (id) => orderList(st).find((o) => o.id === id).ok;
      const killer = h.find((p) => p.stage >= 6);
      const noExile = st.promises.some((pr) => pr.state === 'owed' && ['noexile', 'purges', 'seat'].includes(pr.type));
      const low = h.slice().sort((a, b) => a.loyalty - b.loyalty)[0];
      if (killer && (st.res.lux < 5 || killer.perks >= 3) && !noExile) return { id: 'exile', arg: { role: killer.role } };
      if (low && low.loyalty < 52 && can('perk') && st.res.lux >= 8) return { id: 'perk', arg: { role: low.role } };
      if (st.unrest > 35 && st.speeches < 2) return { id: 'speech', arg: {} };
      return null;
    },
  },
};

// Plays one whole day (or what is left of it) with a policy. r: a random function for the policy's own dice.
export function playDay(st, policy, r = Math.random) {
  if (st.phase === 'report') openEvent(st);
  if (st.phase === 'event') choose(st, policy.event(st, eventView(st), r));
  if (st.phase === 'order') {
    const o = !st.orderUsed && policy.order(st, r);
    if (o) order(st, o.id, o.arg);
    endDay(st);
  }
}

export function playOut(st, policy, r = Math.random, untilDay = Infinity) {
  let guard = 0;
  while (st.phase !== 'ended' && st.day < untilDay && guard++ < 200) playDay(st, policy, r);
  return st;
}

export function simulate(n = 200, policyName = 'careful', cardId = 'inherited', seed0 = 1) {
  const out = { runs: n, policy: policyName, card: cardId, endings: {}, kinds: {}, meanDay: 0, left: { food: 0, water: 0, power: 0, med: 0, lux: 0 }, meanStaff: 0 };
  let s = seed0 * 2654435761;
  const r = () => { s = (s + 0x6D2B79F5) | 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < n; i++) {
    const st = playOut(newRun(cardId, seed0 * 1000 + i), POLICIES[policyName], r);
    const id = st.ending ? st.ending.id : 'stuck';
    out.endings[id] = (out.endings[id] || 0) + 1;
    const kind = id.split('_')[0];
    out.kinds[kind] = (out.kinds[kind] || 0) + 1;
    out.meanDay += st.day / n;
    out.meanStaff += here(st).length / n;
    for (const k in out.left) out.left[k] += st.res[k] / n;
  }
  return out;
}
