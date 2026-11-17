// ui/main.js
// The screen. Reads the game state from engine/sim.js and draws three things: the bar (day and
// stores), the silo (who is where) and the desk (today's cards). All input comes through one click
// handler on elements marked data-act. The rules never touch the DOM and the screen never changes
// the rules' numbers directly.
//
// URL controls (for looking at exact moments):
//   ?card=<inherited|bought|force|vote|founder>   start a run at once     ?seed=<n>  the same run again
//   ?crew=<8 digits>  who you let in, one digit a job (0 or 1; family 0 to 2)
//   ?day=<n>      play to the morning of day n with the sensible auto-player (?as=tyrant for the other one)
//   ?view=<day|done|night>   step that far into the day                   ?end=<ending id>  show an ending
//   ?still=1      no ambient motion                                        ?flat=1  the flat picture, not the card model

import { RULES, PROMISES, newRun, openDay, eventView, choose, act, actionList, mayUse, kindness, promiseList, promiseText, matterView, decide, setPolicy, policyValue, policyBlock, policyCost, indulge, forecast, endDay } from '../engine/sim.js';
import { POLICIES, playOut } from '../engine/auto.js';
import { ROLES, ROLE_ORDER, TRAITS, STAGES, CANDIDATES } from '../data/staff.js';
import { CARDS, cardById } from '../data/cards.js';
import { ENDINGS } from '../data/text.js';
import { POLICY_INFO, RUNGS, DONE } from '../data/matters.js';
import { faceSVG, MOOD_WORDS } from './faces.js';
import { createSilo, ZONES } from './silo.js';
import { createDiorama } from './diorama.js';
import { createSound } from './sound.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app'), bar = $('#bar'), desk = $('#desk'), sheet = $('#sheet'), sheetBody = $('#sheet-body'), strip = $('#strip');
const params = new URLSearchParams(location.search);
const calm = params.has('still') || matchMedia('(prefers-reduced-motion: reduce)').matches;
if (calm) app.classList.add('calm');
const NIGHT_MS = calm ? 250 : 1900;      // how long lights-out lasts on screen

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window: play on without saving */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* nothing to do */ } },
};

const sound = createSound();
// The silo: the card model if this browser can draw it, the flat picture if not.
let silo;
try { if (params.has('flat')) throw new Error('flat picture asked for'); silo = createDiorama($('#silo')); } catch (e) { silo = createSilo($('#silo')); }
let st = null;            // the run in play
let setup = null;         // { card, picks } while you choose who comes in at the hatch
let busy = false;         // true during lights-out
let attract = null;       // timer for the title screen's wandering pawns

// --- small drawing helpers --------------------------------------------------------------------------

const ICON = {
  food: '<svg viewBox="0 0 16 16"><rect x="3" y="3.5" width="10" height="10" rx="1.6" fill="currentColor"/><ellipse cx="8" cy="3.8" rx="5" ry="1.7" fill="currentColor" stroke="var(--paper)" stroke-width="0.9"/><rect x="3" y="7" width="10" height="3" fill="var(--paper)" opacity="0.45"/></svg>',
  water: '<svg viewBox="0 0 16 16"><path d="M8 1.5 Q13 8 13 10.5 a5 5 0 0 1 -10 0 Q3 8 8 1.5 Z" fill="currentColor"/></svg>',
  power: '<svg viewBox="0 0 16 16"><path d="M9.5 1 L3.5 9 H7.5 L6.5 15 L12.5 7 H8.5 Z" fill="currentColor"/></svg>',
  med: '<svg viewBox="0 0 16 16"><path d="M6 2 H10 V6 H14 V10 H10 V14 H6 V10 H2 V6 H6 Z" fill="currentColor"/></svg>',
  lux: '<svg viewBox="0 0 16 16"><path d="M4 2.5 H12 L15 6.5 L8 14.5 L1 6.5 Z" fill="currentColor"/><path d="M1 6.5 H15 M5.5 6.5 L8 14.5 L10.5 6.5 M5.5 6.5 L4 2.5 M10.5 6.5 L12 2.5" stroke="var(--paper)" stroke-width="0.7" fill="none" opacity="0.6"/></svg>',
  comfort: '<svg viewBox="0 0 16 16"><path d="M3 7 V4.5 a2 2 0 0 1 2 -2 h6 a2 2 0 0 1 2 2 V7 a2 2 0 0 1 2 2 v3 h-1.5 v1.5 h-1.5 V12 h-8 v1.500 H2.500 V12 H1 V9 a2 2 0 0 1 2 -2 Z" fill="currentColor"/></svg>',
  scroll: '<svg viewBox="0 0 16 16"><path d="M4 2 H12 a1.5 1.5 0 0 1 1.5 1.5 V12 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V3 a1 1 0 0 1 1 -1 Z" fill="currentColor"/><path d="M5.5 5.5 H11 M5.5 8 H11 M5.5 10.5 H9" stroke="var(--paper)" stroke-width="1"/></svg>',
  sound: '<svg viewBox="0 0 16 16"><path d="M2 6 H5 L9 2.5 V13.5 L5 10 H2 Z" fill="currentColor"/><path d="M11 5.5 Q13 8 11 10.5 M12.6 3.6 Q16 8 12.6 12.4" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 16 16"><path d="M2 6 H5 L9 2.5 V13.5 L5 10 H2 Z" fill="currentColor"/><path d="M11.2 5.8 L15 10.2 M15 5.8 L11.2 10.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
};
const RES = [
  ['food', 'Food', 'Feeds everyone each night. The farm grows some of it back. Drained by staff rations, your table and crop failures.'],
  ['water', 'Water', 'Drinking, crops and your hot tub. The plant recycles most of it. Drained by leaks, sabotage and the hot tub.'],
  ['power', 'Power', 'Runs the air, the lights and the cameras. Drained by heating, your cinema, cameras and breakdowns.'],
  ['med', 'Medicine', 'Treats injury and illness. Drained by accidents, poisonings and rationing choices.'],
  ['lux', 'Luxury', 'Wine, art, gold taps. It pays for perks, informants, repairs and treats for yourself. Nothing new comes in.'],
];
// What each action gets you and what it costs.
const TOOL_INFO = {
  talk: ['They may tell you what is actually wrong, so that you can fix it. A little loyalty for being asked.', 'Your patience. Frightened people say nothing true, and plotters say something small.'],
  interrogate: ['The truth: exactly what they are up to and what their real grievance is. It is also rather satisfying.', 'They like you less and fear you more. So does everyone who hears about it.'],
  perk: ['Loyalty up quickly, for one person.', 'Luxury. The others notice who got it, and each perk to the same person works less.'],
  informant: ['A plain report on one person every morning.', 'Luxury now and every night. The informant might lie, or be found out, which is a scandal.'],
  test: ['The one reading you can trust: exactly where one person stands today, from devoted to hostile.', 'A loyal person is offended to be tested. A disloyal one learns that you know.'],
  reprimand: ['A slacker goes back to work, and you feel a good deal better. The first step down.', 'A little of their loyalty, and a little of their friend’s.'],
  example: ['Fear goes up for everyone. You feel much better.', 'Loyalty goes down for everyone. The person may want revenge, and proud people always do.'],
  cell: ['Three nights in which they can plot nothing at all. Fear for everyone.', 'Their job is done badly meanwhile. They, and the others, like you less.'],
  exile: ['Removes a problem for good.', 'You lose their skills: the job is done badly from then on. The others are horrified.'],
  scapegoat: ['The bunker calms down at once, and the others like you a little more: it was not your fault after all.', 'That one person hates you for good. It works less well every time.'],
  divide: ['Their friendship is over, and for a week neither of them can organise with anyone.', 'A little loyalty from both. And from now on, what you do to one of them no longer hurts the other.'],
  confiscate: ['Food and valuables, straight up to your floor.', 'Everyone’s loyalty. There is less to find each time.'],
  speech: ['A small loyalty boost for everyone, and a calmer bunker.', 'Nothing but your dignity. Each speech works less than the last.'],
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v) => (v > 0 ? '+' : '−') + Math.round(Math.abs(v));
const num1 = (v) => (v > 0 ? '+' : '−') + (Math.abs(v) >= 9.95 ? Math.round(Math.abs(v)) : Math.abs(v).toFixed(1));
const chips = (delta, perNight) => Object.entries(delta || {}).filter(([, v]) => Math.abs(v) >= (perNight ? 0.05 : 0.5)).map(([k, v]) => `<span class="chip r-${k} ${v > 0 ? 'up' : 'down'}">${ICON[k]}${perNight ? num1(v) : num(v)}</span>`).join('');
const person = (role) => st.staff.find((p) => p.role === role);
const locked = (p) => (p.cell || 0) > st.day;
const moodOf = (p) => (p.status === 'dead' ? 'dead' : p.status === 'exiled' ? 'flat' : p.face || 'flat');
const whoChip = (p) => `<button type="button" class="who" data-act="dossier" data-role="${p.role}">${faceSVG(p.role, moodOf(p))}<span>${esc(p.first)}</span></button>`;
// Text from the rules, with every staff name turned into a face you can tap.
function rich(text) {
  const s = esc(text);
  if (!st) return s;
  const names = st.staff.map((p) => p.first).join('|');
  return s.replace(new RegExp(`(^|[^\\w>])(${names})(?![\\w<])`, 'g'), (m, pre, n) => pre + whoChip(st.staff.find((p) => p.first === n)));
}
const trueFace = (p) => (p.status === 'dead' ? 'dead' : p.loyalty >= 66 ? 'happy' : p.loyalty >= 52 ? 'content' : p.loyalty >= 40 ? 'flat' : p.loyalty >= 27 ? 'sour' : 'angry');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const epithet = (n) => (n >= 40 ? 'a monster' : n >= 24 ? 'a tyrant' : n >= 12 ? 'feared' : n >= 5 ? 'firm' : 'a reasonable employer');
const pips = () => Array.from({ length: 3 }, (_, i) => `<i class="${i < st.acts ? 'on' : i < st.actsMax ? 'used' : 'off'}"></i>`).join('');

// --- the bar ----------------------------------------------------------------------------------------

function renderBar(delta = {}) {
  if (!st) { bar.innerHTML = `<div class="brand">Bunker Billionaire</div><div class="bar-right">${soundButton()}</div>`; return; }
  const owed = st.promises.filter((p) => p.state === 'owed' || p.state === 'forgotten');
  const next = owed.filter((p) => p.due).sort((a, b) => a.due - b.due)[0];
  const soon = next && next.due - st.day <= 2;
  const f = st.phase === 'ended' ? {} : forecast(st), left = RULES.DAYS - st.day + 1;
  bar.innerHTML = `<button type="button" class="day" data-act="menu" aria-label="Day ${st.day} of ${RULES.DAYS}. Open the menu"><b>${Math.min(st.day, RULES.DAYS)}</b><span>of ${RULES.DAYS}</span></button>
    <div class="stores">${RES.map(([k, name]) => {
    const v = st.res[k], d = delta[k], t = f[k] || 0;
    return `<button type="button" class="store r-${k}${v < 12 ? ' low' : ''}" data-act="res" data-k="${k}" aria-label="${name}: ${Math.round(v)}, ${num1(t)} a night">${ICON[k]}<b>${Math.round(v)}</b><i class="${v + t * left < 0 ? 'short' : ''}">${Math.abs(t) < 0.05 ? '±0' : num1(t)}</i>${d && Math.abs(d) >= 0.5 ? `<em class="${d > 0 ? 'up' : 'down'}">${num(d)}</em>` : ''}</button>`;
  }).join('')}</div>
    <div class="bar-right"><button type="button" class="ledger${soon ? ' soon' : ''}" data-act="ledger" aria-label="${owed.length} promises owed">${ICON.scroll}<b>${owed.length}</b></button>${soundButton()}</div>`;
}
const soundButton = () => `<button type="button" class="snd${sound.on ? ' on' : ''}" data-act="sound" aria-label="${sound.on ? 'Turn sound off' : 'Enable sound'}">${sound.on ? ICON.sound : ICON.mute}<span>${sound.on ? 'Sound on' : 'Enable sound'}</span></button>`;

// --- the silo ---------------------------------------------------------------------------------------

function siloView(night) {
  const over = st.phase === 'ended' ? st.ending.id : '';
  const kind = over.split('_')[0];
  const matters = over ? [] : matterView(st);
  const asks = {};
  for (const m of matters) if (m.kind === 'ask') asks[m.role] = m.i;
  const staff = st.staff.map((p) => {
    let zone = ROLES[p.role].post, unseen = false;
    if (p.status === 'exiled') zone = 'surface';
    else if (kind === 'king' || kind === 'word' || over === 'deposed_hatch') zone = 'surface';
    else if (locked(p)) zone = 'cell';
    else if (night) { if (st.cameras) zone = p.night || 'bunks'; else { zone = 'bunks'; unseen = true; } } else if (st.cameras && p.room) zone = p.room;
    return {
      role: p.role, status: p.status, zone, unseen, mood: kind === 'everyone' ? 'dead' : over ? trueFace(p) : moodOf(p), label: `${p.name}, ${p.title}`,
      badge: over ? '' : p.exposed ? 'alert' : st.informant === p.role ? 'eye' : '', down: kind === 'everyone',
    };
  });
  const you = { zone: 'you', mood: 'smug', down: kind === 'killed' || kind === 'everyone', label: 'You' };
  if (over === 'deposed_vote') you.zone = 'kitchen';
  if (over === 'deposed_mutiny' || over === 'deposed_cracked') you.zone = 'bunks';
  if (over === 'deposed_lockout') you.zone = 'cell';
  if (over === 'deposed_surface' || kind === 'king' || kind === 'word') you.zone = 'surface';
  if (kind === 'deposed' || kind === 'killed' || kind === 'everyone') you.mood = kind === 'deposed' ? 'sour' : 'dead';
  return {
    staff, you, cameras: st.cameras, night: night || kind === 'everyone', res: st.res, ending: kind, asks,
    policy: st.policy, faults: matters.filter((m) => m.kind === 'fault').map((m) => ({ sys: m.sys, i: m.i, patched: m.patched })),
  };
}
function renderSilo(night = false) {
  if (!st) { strip.innerHTML = setup ? '<span class="hint">Eight places. Choose who comes in.</span>' : '<span class="hint">Drag the model to look round it</span>'; return; }
  silo.update(siloView(night));
  const c = Math.round(st.res.comfort);
  strip.innerHTML = `<button type="button" class="you" data-act="you" aria-label="You: comfort ${c}, ${st.acts} actions left">${faceSVG('you', c < 30 ? 'sour' : 'smug')}<span class="meter${c < 30 ? ' low' : ''}"><i style="width:${c}%"></i></span><span class="pips">${pips()}</span></button>
    <button type="button" data-act="policies">Standing orders</button><button type="button" data-act="roster">Staff</button>`;
}
function roster() {
  openSheet(`<h2>Staff files</h2><p class="fine">A face each morning and whatever was last heard. Some of it is wrong.</p><ul class="picker">${st.staff.map((p) => `<li><button type="button" data-act="dossier" data-role="${p.role}">${faceSVG(p.role, moodOf(p))}<span><b>${esc(p.name)}</b><small>${esc(p.title)} · ${TRAITS[p.trait].name.toLowerCase()}${p.status !== 'ok' ? ` · ${p.fled ? 'fled' : p.status}` : locked(p) ? ' · in the cell' : ''}</small>${p.rumour && p.status === 'ok' ? `<small class="r">${esc(p.rumour.text)}</small>` : ''}</span></button></li>`).join('')}</ul>`);
}
// A ring round the pawn that today's card is about (flat picture only; the card model has no rings).
function ping(role) {
  const el = $(`.pawn[data-role="${role}"]`);
  if (!el || calm || silo.kind === 'card') return;
  el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping');
}

// Before a run: the staff wander (title), or stand where you have placed them (the hatch).
function previewView(list) {
  return { staff: list, you: { zone: 'you', mood: 'smug' }, cameras: false, night: false, res: { ...RULES.START }, policy: { tub: 1, cinema: 1 }, faults: [], asks: {} };
}
function startAttract() {
  stopAttract();
  const zones = Object.keys(ZONES).filter((z) => z !== 'surface' && z !== 'you' && z !== 'cell');
  const moods = ['happy', 'content', 'flat', 'sour', 'content', 'flat', 'grin', 'angry'];
  const state = ROLE_ORDER.map((role, i) => ({ role, status: 'ok', zone: ROLES[role].post, mood: moods[i], label: ROLES[role].title }));
  silo.update(previewView(state));
  if (calm) return;
  attract = setInterval(() => {
    if (document.hidden) return;
    const p = state[Math.floor(Math.random() * state.length)];
    p.zone = Math.random() < 0.45 ? ROLES[p.role].post : zones[Math.floor(Math.random() * zones.length)];
    if (Math.random() < 0.3) p.mood = moods[Math.floor(Math.random() * moods.length)];
    silo.update(previewView(state));
  }, 2600);
}
function stopAttract() { clearInterval(attract); attract = null; }

// --- the desk: before a run ---------------------------------------------------------------------------

function renderTitle() {
  const save = store.get('bb.save', null), found = store.get('bb.endings', []);
  const ok = save && save.v === 3 && save.phase !== 'ended';
  desk.innerHTML = `<article class="card title-card deal">
    <p class="kicker">Act 2 · a management game for one bunker</p>
    <h1>Bunker Billionaire</h1>
    <p class="lede">You run a luxury doomsday bunker in an old missile silo. Keep the place running, keep yourself comfortable, and stop your staff from overthrowing you. Thirty days until the surface is safe.</p>
    <p class="hintline">You will see faces and hear rumours. You will never see what anyone really thinks. Being kind is expensive. Being a monster is restful.</p>
    ${ok ? `<button type="button" class="go" data-act="resume">Carry on from day ${save.day}</button>` : ''}
    <h2>First: how did you get the bunker?</h2>
    <div class="starts">${CARDS.map((c) => `<button type="button" class="start" data-act="card" data-card="${c.id}">
      <span class="level l-${c.level.toLowerCase()}">${c.level}</span><b>${esc(c.name)}</b>
      <em>${esc(c.line)}</em>
      <small>${esc(c.blurb)}</small>
      <small><i>You owe:</i> ${c.promises.length ? c.promises.map((t) => `“${esc(PROMISES[t].text)}”`).join(', ') : 'nothing'} · <i>Grudge:</i> ${esc(c.grudgeLine)}</small>
    </button>`).join('')}</div>
    <p class="fine">Endings found: ${found.length} of ${Object.keys(ENDINGS).length}. <button type="button" class="link" data-act="help">How to play</button></p>
  </article>`;
}

// The hatch: for each job, who do you let in?
function renderHatch() {
  const card = cardById(setup.card);
  const done = ROLE_ORDER.every((r) => setup.picks[r] !== undefined);
  const perNight = (c) => chips(c.nightly, true) + chips(c.bring);
  desk.innerHTML = `<article class="card hatch deal">
    <header><span class="stamp">${esc(card.name)}</span><h2>At the hatch</h2></header>
    <p class="body">The sirens are going. There are eight places and a crowd on the stairs. For each job, one of them comes in, and the other does not.</p>
    ${ROLE_ORDER.map((role) => `<div class="slot${role === card.grudge ? ' grudge' : ''}"><h3>${esc(ROLES[role].title)}${role === card.grudge ? ' <span>starts with a grudge</span>' : ''}</h3><div class="cands n${CANDIDATES[role].length}">${CANDIDATES[role].map((c, i) => `<button type="button" class="cand${setup.picks[role] === i ? ' on' : ''}" data-act="pick" data-role="${role}" data-i="${i}" aria-pressed="${setup.picks[role] === i}">
        <b>${esc(c.name)}</b><em>${esc(c.was)}</em>
        <small class="pro">${esc(c.pro)}</small><small class="con">${esc(c.con)}</small>
        <small class="meta">${TRAITS[c.trait].name}${perNight(c) ? ' ' + perNight(c) : ''}</small>
      </button>`).join('')}</div></div>`).join('')}
    <div class="row sticky"><button type="button" class="go" data-act="seal"${done ? '' : ' disabled'}>${done ? 'Seal the hatch' : `Choose ${ROLE_ORDER.filter((r) => setup.picks[r] === undefined).length} more`}</button><button type="button" class="go ghost" data-act="grab">Whoever is nearest</button></div>
    <p class="fine"><button type="button" class="link" data-act="title">Back</button></p>
  </article>`;
  const list = ROLE_ORDER.filter((r) => setup.picks[r] !== undefined).map((role) => ({ role, status: 'ok', zone: ROLES[role].post, mood: 'flat', label: CANDIDATES[role][setup.picks[role]].name }));
  silo.update(previewView(list));
}

// --- the desk: during a run ---------------------------------------------------------------------------

// The faces that changed overnight, in one line. Only what the player could see for themselves.
function facesLine(f) {
  if (!f) return '';
  const names = (roles) => roles.map((r) => person(r).first).join(', ').replace(/, ([^,]*)$/, ' and $1');
  const parts = [];
  if (f.worse.length) parts.push(`${names(f.worse)} ${f.worse.length > 1 ? 'look' : 'looks'} worse this morning.`);
  if (f.better.length) parts.push(`${names(f.better)} ${f.better.length > 1 ? 'look' : 'looks'} happier.`);
  if (f.grin.length) parts.push(`${names(f.grin)} ${f.grin.length > 1 ? 'have' : 'has'} started smiling at everything.`);
  return parts.length ? `<p class="faces-line">${rich(parts.join(' '))}</p>` : '';
}

function renderReport() {
  const r = st.report, card = cardById(st.card);
  const first = st.day === 1 ? `<p class="lede">${esc(card.line)}</p><p class="hintline">Each day: one piece of business to settle, a few actions of your own, and standing orders you can change whenever you like. Tap a face to open that person’s file.</p>` : '';
  const waiting = st.matters.length;
  desk.innerHTML = `<article class="card report deal">
    <header><span class="stamp">Day ${st.day} of ${RULES.DAYS}</span><h2>Morning report</h2></header>
    ${first}
    ${r.inc.length ? `<ul class="incidents">${r.inc.map((i) => `<li class="${i.kind}">${rich(i.text)}</li>`).join('')}</ul>` : ''}
    <p class="mood">${esc(r.mood)}</p>
    ${r.tense ? '<p class="hintline">A promise would calm this, and cost nothing until it falls due. So would a scapegoat.</p>' : ''}
    ${facesLine(r.faces)}
    ${r.cams ? `<p class="cams-line">${rich(r.cams)}</p>` : ''}
    ${r.informant ? `<p class="informant-line">${rich(r.informant.text)}</p>` : ''}
    ${r.rumours.length ? `<h3>Heard on the stairs</h3><ul class="rumours">${r.rumours.map((x) => `<li>${rich(x.text)}</li>`).join('')}</ul>` : ''}
    <button type="button" class="go" data-act="open">Start the day${waiting ? ` · ${waiting} waiting for you` : ''}</button>
  </article>`;
}

function matterCard(m, inSheet) {
  return `<article class="${inSheet ? '' : 'card deal '}matter k-${m.kind}">
    <header><span class="stamp">${m.kind === 'ask' ? `A request · ${m.left <= 1 ? 'last day to answer' : m.left + ' days to answer'}` : 'Broken'}</span><h2>${rich(m.title)}</h2></header>
    <p class="body">${rich(m.text)}${m.kind === 'fault' ? ` <span class="drain">Losing ${chips(m.drain, true)} a night.</span>` : ''}</p>
    <div class="choices small">${m.choices.map((c) => `<button type="button" class="choice" data-act="decide" data-i="${m.i}" data-id="${c.id}"${c.ok ? '' : ' disabled'}><span class="t">${esc(c.label)}${c.ok ? '' : `<small>${esc(c.why)}</small>`}</span><span class="costs">${c.act ? '<span class="chip act">1 action</span>' : ''}${chips(c.cost)}</span></button>`).join('')}</div>
  </article>`;
}

function renderDay() {
  let top;
  if (!st.eventDone) {
    const v = eventView(st);
    const from = v.from ? person(v.from) : null;
    if (from) ping(from.role);
    top = `<article class="card memo deal${v.grim ? ' grim' : ''}">
      <header><span class="stamp">Day ${st.day} · today’s business</span>${from ? `<button type="button" class="from" data-act="dossier" data-role="${from.role}" aria-label="${esc(from.name)}">${faceSVG(from.role, moodOf(from))}</button>` : ''}<h2>${esc(v.title)}</h2></header>
      <p class="body">${rich(v.text)}</p>
      <div class="choices">${v.choices.map((c, i) => `<button type="button" class="choice" data-act="choose" data-i="${i}"${c.ok ? '' : ' disabled'}><span class="n">${i + 1}</span><span class="t">${esc(c.label)}${c.ok ? '' : `<small>${esc(c.why)}</small>`}</span><span class="costs">${chips(c.cost)}</span></button>`).join('')}</div>
    </article>`;
  } else {
    const r = st.result;
    top = `<article class="card result">
      <header><span class="stamp done">Today’s business: ${esc(r.title)}</span><h2>${esc(r.choice)}</h2></header>
      <p class="body">${rich(r.text)}</p><div class="costs">${chips(r.delta)}</div>
    </article>`;
  }
  const matters = matterView(st);
  const list = actionList(st);
  const caught = st.staff.some((p) => p.status === 'ok' && p.exposed);
  const open = (o) => o.ok && (!o.locked || (caught && (o.id === 'exile' || o.id === 'cell')));
  const btn = (o) => `<button type="button" class="tool${o.evil ? ' evil' : ''}${o.locked ? ' shut' : ''}" data-act="tool" data-id="${o.id}"${open(o) ? '' : ' disabled'} title="${esc(o.locked && !open(o) ? 'Not yet. The bunker would not stand for it.' : o.ok ? o.hint : o.why)}">${esc(o.short)}${chips({ ...(o.cost || {}), ...(o.gain || {}) })}</button>`;
  const group = (name) => `<div class="tgroup g-${name.toLowerCase()}"><span>${name}</span><div>${list.filter((o) => o.group === name).map(btn).join('')}</div></div>`;
  const slope = `<div class="tgroup g-slope"><span>The slope <em>${st.regime} of ${RUNGS.length}</em></span><ol class="rungs">${RUNGS.map((r, i) => `<li class="${i < st.regime ? 'open' : 'shut'}${st.rungUsed[i] ? ' used' : ''}"><b>${esc(r.name)}</b>${i < st.regime ? `<div>${list.filter((o) => o.rung === i).map(btn).join('')}</div>${i === st.regime - 1 && i < RUNGS.length - 1 ? '<small>Use it once, and the next step opens tomorrow.</small>' : ''}` : i === st.regime ? `<small>Opens the morning after you first use “${esc(RUNGS[i - 1].name)}”.</small>${list.filter((o) => o.rung === i && open(o)).map(btn).join('')}` : list.filter((o) => o.rung === i && open(o)).map(btn).join('')}</li>`).join('')}</ol></div>`;
  const log = st.today.length ? `<ul class="today">${st.today.map((t) => `<li><b>${rich(t.title)}</b> ${rich(t.text)} ${chips(t.delta)}</li>`).join('')}</ul>` : '';
  desk.innerHTML = `${top}
  ${matters.map((m) => matterCard(m, false)).join('')}
  <article class="card orders">
    <header><h2>Your day</h2><span class="pips big">${pips()}</span><span class="left">${st.acts ? `${st.acts} ${st.acts === 1 ? 'action' : 'actions'} left` : 'No actions left'}</span></header>
    ${st.day <= 2 && !st.today.length ? '<p class="hintline">How much you get done depends on your comfort. Tap an action to read what it does first. The red ones are on the slope: each step you take makes the next one easier.</p>' : ''}
    ${log}
    <div class="tools"><div class="tcol">${group('People')}${group('Watch')}${group('Say')}</div><div class="tcol">${slope}</div></div>
    <button type="button" class="go" data-act="night"${st.eventDone ? '' : ' disabled'}>${st.eventDone ? 'Lights out' : 'Settle today’s business first'}</button>
  </article>`;
}

function spark(p) {
  const h = p.hist, n = Math.max(6, h.length), W = 120, H = 30;
  const line = (i) => h.map((d, k) => (d ? `${((k + 1) / n * W).toFixed(1)},${(H - 2 - (d[i] / 100) * (H - 4)).toFixed(1)}` : null)).filter(Boolean).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="M0 ${H / 2} H${W}" stroke="currentColor" stroke-width="0.5" opacity="0.25" stroke-dasharray="2 2"/><polyline points="${line(1)}" fill="none" stroke="var(--red)" stroke-width="1.2" stroke-dasharray="3 2" opacity="0.8"/><polyline points="${line(0)}" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
}

function renderEnding() {
  const e = ENDINGS[st.ending.id], kind = st.ending.id.split('_')[0];
  const card = cardById(st.card), s = st.stats;
  const fate = (p) => (p.fled ? 'Fled to the surface rather than stay.' : p.status === 'exiled' ? 'Exiled to the surface.' : p.status === 'dead' ? 'Died in the bunker.' : `Was ${STAGES[p.stage]}.`);
  const kept = st.promises.filter((p) => p.state === 'kept').length, broken = st.promises.filter((p) => p.state === 'broken').length;
  const record = (p) => Object.entries(p.done || {}).map(([k, n]) => `${DONE[k] || k}${n > 1 ? ' ×' + n : ''}`).join(', ');
  const steps = RUNGS.filter((r, i) => st.rungUsed[i]).map((r) => r.name);
  const firstOf = (i) => { const e = st.path.find((x) => x.rung === i); return e ? `day ${e.day}` : ''; };
  const slope = steps.length ? `<h3>How far you went</h3><ol class="rungs past">${RUNGS.map((r, i) => (st.rungUsed[i] ? `<li class="used"><b>${esc(r.name)}</b> <small>from ${firstOf(i)}</small></li>` : '')).join('')}</ol>` : '<h3>How far you went</h3><p class="fine">Not one step. Nobody down here will believe it.</p>';
  desk.innerHTML = `<article class="card ending k-${kind} deal">
    <header><span class="stamp">${esc(e.kind)}</span><h1>${esc(e.title)}</h1></header>
    <p class="body">${esc(e.text)}</p>
    <p class="verdict">History will remember you as <b>${epithet(st.infamy)}</b>.</p>
    <p class="fine">${st.day >= RULES.DAYS && (kind === 'king' || kind === 'word' || st.ending.id === 'deposed_hatch') ? `All ${RULES.DAYS} days` : `Day ${st.day} of ${RULES.DAYS}`} · ${esc(card.name)} · ${s.cruel} cruelties · ${s.perks} perks · ${s.talks} quiet words · ${s.exiles} exiled · promises kept ${kept}, broken ${broken}</p>
    ${slope}
    <h3>Who paid for it, and what you never saw</h3>
    <p class="fine key"><span class="k-loy"></span> loyalty <span class="k-fear"></span> fear, day by day</p>
    <ul class="reveal">${st.staff.map((p) => `<li>${faceSVG(p.role, trueFace(p))}<div><b>${esc(p.name)}</b><small>${esc(p.title)} · ${esc(TRAITS[p.trait].name.toLowerCase())}</small><small class="fate s${p.status === 'ok' ? p.stage : 'x'}">${fate(p)}</small>${record(p) ? `<small class="done">${esc(record(p))}</small>` : ''}</div>${spark(p)}</li>`).join('')}</ul>
    <div class="row"><button type="button" class="go" data-act="again">Same start again</button><button type="button" class="go ghost" data-act="title">A different start</button></div>
  </article>`;
}

function render(delta) {
  app.dataset.phase = st ? st.phase : setup ? 'hatch' : 'title';
  renderBar(delta);
  renderSilo(false);
  const keep = desk.scrollTop, same = desk.dataset.view === (st ? st.phase + st.day : 'x');
  if (!st) { if (setup) renderHatch(); else renderTitle(); desk.dataset.view = 'x'; return; }
  if (st.phase === 'report') renderReport();
  else if (st.phase === 'day') renderDay();
  else if (st.phase === 'ended') renderEnding();
  desk.dataset.view = st.phase + st.day;
  desk.scrollTop = same ? keep : 0;     // stay where you were while the day goes on
}

// --- sheets (the drawer that slides up over the desk) --------------------------------------------------

function openSheet(html) { sheetBody.innerHTML = html; sheet.hidden = false; sound.play('sheet'); $('#sheet-box').scrollTop = 0; }
function closeSheet() { sheet.hidden = true; }
const toolInfo = (id) => { const i = TOOL_INFO[id]; return i ? `<dl class="trade"><dt>What you get</dt><dd>${i[0]}</dd><dt>What it costs</dt><dd>${i[1]}</dd></dl>` : ''; };

function youSheet() {
  const word = st.word >= 1.15 ? 'good. They have seen you keep it.' : st.word >= 0.8 ? 'untested.' : st.word >= 0.4 ? 'worth less than it was.' : 'worth nothing.';
  const c = Math.round(st.res.comfort), f = forecast(st).comfort;
  openSheet(`<div class="dossier"><div class="who-head">${faceSVG('you', c < 30 ? 'sour' : 'smug')}<div><h2>You</h2><p>Owner, and for now ruler, of the bunker</p></div></div>
    <dl><dt>Comfort</dt><dd><b>${c}</b> of 100, ${num1(f)} a night. ${c >= 60 ? 'You feel yourself: three actions a day.' : c >= 30 ? 'You are out of sorts: two actions a day.' : 'You are miserable: one action a day. At nothing at all, for three nights, you give the bunker up.'} Your table, your hot tub and your cinema hold it up. So does being cruel. Listening to people wears it down.</dd>
    <dt>Known as</dt><dd><b>${epithet(st.infamy)}</b>. The worse your name, the more slowly their fear of you fades.</dd>
    <dt>The slope</dt><dd>Step ${st.regime} of ${RUNGS.length}: <b>${esc(RUNGS[st.regime - 1].name.toLowerCase())}</b>. ${st.regime > 1 ? `Cruelty comes easier now. Your kindness is worth ${Math.round(kindness(st) * 100)}% of what it was: they know what you are.` : 'You have not started down it yet.'}</dd>
    <dt>Your word is</dt><dd>${word}</dd>
    <dt>How you got here</dt><dd>${esc(cardById(st.card).name)}. ${esc(cardById(st.card).line)}</dd></dl>
    ${st.phase === 'day' ? `<div class="acts col"><button type="button" class="tool" data-act="indulge"${st.indulged === st.day || st.res.lux < RULES.INDULGE_COST ? ' disabled' : ''}>${st.indulged === st.day ? 'You have treated yourself today' : 'Treat yourself to something old and expensive'}${chips({ lux: -RULES.INDULGE_COST, comfort: RULES.INDULGE })}</button></div>` : ''}</div>`);
}

function policySheet() {
  const row = (k) => {
    const info = POLICY_INFO[k], v = policyValue(st, k);
    return `<div class="pol${info.evil ? ' evil' : ''}"><b>${esc(info.name)}</b><div class="seg">${info.opts.map((o, i) => { const why = policyBlock(st, k, i); return `<button type="button" class="${i === v ? 'on' : ''}" data-act="policy" data-k="${k}" data-v="${i}"${why || st.phase !== 'day' ? ' disabled' : ''} title="${esc(why)}">${esc(o)}</button>`; }).join('')}</div><p class="fine">${esc(info.notes[v])} ${chips(policyCost(st, k, v), true)}</p></div>`;
  };
  const keys = Object.keys(POLICY_INFO);
  openSheet(`<h2>Standing orders</h2><p class="fine">Free to change, as often as you like. They bite every night.</p>
    <div class="tonight"><span>Tonight, as things stand</span>${chips(forecast(st), true)}</div>
    <h3>The bunker</h3>${keys.filter((k) => !POLICY_INFO[k].mine).map(row).join('')}
    <h3>Yourself</h3>${keys.filter((k) => POLICY_INFO[k].mine).map(row).join('')}
    <div class="acts col"><button type="button" class="tool" data-act="indulge"${st.phase !== 'day' || st.indulged === st.day || st.res.lux < RULES.INDULGE_COST ? ' disabled' : ''}>${st.indulged === st.day ? 'You have treated yourself today' : 'Treat yourself to something old and expensive'}${chips({ lux: -RULES.INDULGE_COST, comfort: RULES.INDULGE })}</button></div>`);
}

const record = (p) => Object.entries(p.done || {}).map(([k, n]) => `${DONE[k] || k}${n > 1 ? ' ×' + n : ''}`).join(', ');
function dossier(role) {
  if (role === 'you') return youSheet();
  const p = person(role), R = ROLES[role];
  const here = p.status === 'ok';
  const met = here && R.wantMet(st, p);
  const ask = here && st.phase === 'day' ? matterView(st).find((m) => m.kind === 'ask' && m.role === role) : null;
  const can = st.phase === 'day' && here;
  const acts = can ? actionList(st).filter((o) => o.target && (!o.locked || mayUse(st, o, p)) && (o.id !== 'divide' || p.friend)).map((o) => `<button type="button" class="tool${o.evil ? ' evil' : ''}" data-act="${o.id === 'exile' ? 'confirm' : 'do'}" data-id="${o.id}" data-role="${role}"${mayUse(st, o, p) ? '' : ' disabled'} title="${esc(o.ok ? o.hint : o.why)}">${esc(o.short)}${chips({ ...(o.cost || {}), ...(o.gain || {}) })}</button>`).join('')
    + (promiseList(st).find((o) => o.type === 'bunk').ok && st.acts > 0 ? `<button type="button" class="tool" data-act="do" data-id="promise" data-type="bunk" data-role="${role}">Promise a bunk upgrade</button>` : '') : '';
  openSheet(`<div class="dossier"><div class="who-head">${faceSVG(role, moodOf(p))}<div><h2>${esc(p.name)}</h2><p>${esc(p.title)}</p></div></div>
    <p class="moodline">${p.fled ? 'Fled to the surface.' : p.status === 'exiled' ? 'Exiled to the surface.' : p.status === 'dead' ? 'Dead.' : locked(p) ? `In the cell until day ${p.cell}.` : `Looks <b>${MOOD_WORDS[p.face] || 'hard to read'}</b> this morning.${p.face === 'grin' ? ' Frightened people all smile like that.' : ''}`}</p>
    ${ask ? matterCard(ask, true) : ''}
    ${p.said ? `<h3>Told you, day ${p.said.day}</h3><p class="rumour said">“${esc(p.said.text)}”</p>` : ''}
    ${p.rumour ? `<h3>Last heard</h3><p class="rumour${p.rumour.informant ? ' inf' : ''}">${esc(p.rumour.text)} <small>day ${p.rumour.day}</small></p>` : ''}
    ${p.tested ? `<p class="rumour test">Loyalty test, day ${p.tested.day}: <b>${p.tested.band}</b>.</p>` : ''}
    ${st.informant === role ? '<p class="rumour inf">Your informant is watching them.</p>' : ''}
    ${acts ? `<h3>Do something about it <span class="pips">${pips()}</span></h3><div class="acts">${acts}</div>` : ''}
    <dl><dt>Keeps running</dt><dd>${esc(R.keeps)}</dd><dt>If they turn</dt><dd>${esc(R.danger)}</dd>
    <dt>Known for</dt><dd><b>${TRAITS[p.trait].name}.</b> ${TRAITS[p.trait].note}</dd>
    <dt>Close to</dt><dd>${p.friend ? `${whoChip(person(p.friend))} What you do to one of them, the other feels.` : 'Nobody, any more.'}</dd>
    ${record(p) ? `<dt>You have</dt><dd>${esc(record(p))}</dd>` : ''}
    <dt>Wants</dt><dd>${esc(p.wantText)} ${here ? `<span class="met ${met ? 'yes' : 'no'}">${met ? 'has it' : 'not getting it'}</span>` : ''}</dd></dl>
    ${p.notes && p.notes.length ? `<h3>On file</h3><ul class="notes">${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div>`);
}

function pickWho(id, type) {
  const o = actionList(st).find((x) => x.id === id);
  const title = type === 'bunk' ? 'Who is promised the next bunk upgrade?' : `${o.name}: who?`;
  const who = st.staff.filter((p) => p.status === 'ok' && (type === 'bunk' || mayUse(st, o, p)));
  openSheet(`<h2>${esc(title)}</h2>${type === 'bunk' ? `<p class="fine">Cost of keeping it: ${esc(PROMISES.bunk.cost)}</p>` : toolInfo(id)}${o.locked && type !== 'bunk' ? '<p class="fine">Only for someone caught trying to remove you. For anyone else, the bunker would not stand for it yet.</p>' : ''}<ul class="picker">${who.map((p) => `<li><button type="button" data-act="${id === 'exile' ? 'confirm' : 'do'}" data-id="${id}" data-role="${p.role}"${type ? ` data-type="${type}"` : ''}>${faceSVG(p.role, moodOf(p))}<span><b>${esc(p.name)}</b><small>${esc(p.title)} · ${TRAITS[p.trait].name.toLowerCase()}${locked(p) ? ' · in the cell' : ''}${p.friend ? ` · close to ${esc(person(p.friend).first)}` : ''}</small>${p.rumour ? `<small class="r">${esc(p.rumour.text)}</small>` : ''}</span></button></li>`).join('')}</ul>`);
}
function pickPromise() {
  openSheet(`<h2>Make a promise</h2><p class="fine">Loyalty goes up at once and costs nothing today. Keep it later and trust builds. Break it and everyone who heard it remembers. Nobody says you have to mean it.</p><ul class="picker">${promiseList(st).map((o) => `<li><button type="button" data-act="${o.target ? 'who' : 'do'}" data-id="promise" data-type="${o.type}"${o.ok ? '' : ' disabled'}><span><b>“${esc(o.name)}”</b><small>Cost of keeping it: ${esc(o.cost)}</small><small>${o.ok ? (o.due ? `Falls due in ${o.due} days` : 'Stands until the hatch opens') : esc(o.why)}</small></span></button></li>`).join('')}</ul>`);
}
function ledger() {
  const label = { owed: 'owed', kept: 'kept', broken: 'broken', forgotten: 'quietly forgotten', void: 'no longer matters' };
  openSheet(`<h2>Promises</h2>${st.promises.length ? `<ul class="ledger-list">${st.promises.map((p) => `<li class="p-${p.state}"><b>“${esc(promiseText(st, p))}”</b><small>${label[p.state]}${p.state === 'owed' ? (p.due ? ` · due day ${p.due}` : ' · stands until the hatch opens') : ''}</small><small>Cost of keeping it: ${esc(PROMISES[p.type].cost)}</small></li>`).join('')}</ul>` : '<p class="fine">You have promised nothing. Yet.</p>'}<p class="fine">A promise is the quickest way out of trouble, and a debt.</p>`);
}
function help() {
  openSheet(`<h2>How to play</h2><div class="help">
    <p><b>One turn is one day.</b> Read the morning report, settle today’s business, do what else you like, then lights out. Last ${RULES.DAYS} days.</p>
    <p><b>The stores are a closed system.</b> Nothing new comes in. The number under each store is what tonight will take. Your <b>standing orders</b> decide most of it: rations, the rota, heating, and your own table, hot tub and cinema.</p>
    <p><b>Your comfort is your energy.</b> Comfortable, you get three actions a day; miserable, one. Luxuries hold it up. So does cruelty. Kindness wears it down.</p>
    <p><b>The slope.</b> The harsh measures come in steps. Use the lowest one once and, by morning, the bunker is used to it and the next opens. Each step down, cruelty pays you more comfort and shocks people less, and kindness from you is worth less. Nobody becomes a tyrant all at once.</p>
    <p><b>Everyone has one friend down here.</b> What you do to one of them, the other feels.</p>
    <p><b>You never see what people think.</b> Each person has hidden loyalty and fear. You see a face each morning and hear rumours; both can be wrong, and frightened people smile whatever they feel. A quiet word may get you the truth. An interrogation always does.</p>
    <p><b>People act against you only when loyalty is low and fear is low enough to dare.</b> Grumbling, slacking, breaking things, theft, organising, then an attempt on you or a mutiny. You can buy loyalty, which is dear, or keep them frightened, which is cheap and has to be kept up. People who hate you and dare do nothing else may simply leave.</p>
    <p><b>Things wait for you.</b> Requests from staff and broken machinery sit on the silo until you deal with them.</p>
    <p>Tap any face to open that person’s file. Keys: 1 to 3 choose, Enter carries on.</p></div>`);
}
function menu() {
  openSheet(`<h2>Day ${st.day} of ${RULES.DAYS}</h2><p class="fine">${esc(cardById(st.card).name)} · seed ${st.seed}</p><div class="acts col"><button type="button" class="tool" data-act="help">How to play</button><button type="button" class="tool" data-act="title">Leave this run (it is saved)</button><button type="button" class="tool" data-act="abandon">Abandon this run</button></div>`);
}

// --- doing things -----------------------------------------------------------------------------------

function save() { if (st && st.phase !== 'ended') store.set('bb.save', st); else store.del('bb.save'); }
function finish() {
  store.del('bb.save');
  const found = store.get('bb.endings', []);
  if (!found.includes(st.ending.id)) { found.push(st.ending.id); store.set('bb.endings', found); }
  const kind = st.ending.id.split('_')[0];
  sound.play(kind === 'king' || kind === 'word' ? 'win' : 'lose');
}
function begin(cardId, picks, seed) {
  stopAttract(); setup = null;
  st = newRun(cardId, seed, picks);
  save(); sound.play('morning'); render();
}
function doAct(id, arg) {
  const text = act(st, id, arg);
  if (text === null) return;
  closeSheet();
  sound.play({ perk: 'coin', informant: 'coin', speech: 'good', promise: 'promise', talk: 'tap', test: 'tap' }[id] || 'stamp');
  const delta = st.today[st.today.length - 1].delta;
  save(); render(delta);
  const last = desk.querySelector('.today li:last-child');
  if (last) last.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
}
async function lightsOut() {
  if (busy || st.phase !== 'day' || !st.eventDone) return;
  busy = true; closeSheet();
  sound.play('lights'); sound.play('night');
  app.dataset.phase = 'night';
  renderSilo(true);
  desk.innerHTML = `<article class="card nightcard deal"><header><span class="stamp">Night ${st.day}</span><h2>Lights out</h2></header><p class="body">${st.cameras ? 'The cameras watch the corridors.' : 'You cannot see where anybody goes.'} The silo uses up its supplies.</p></article>`;
  desk.dataset.view = 'night';
  await wait(NIGHT_MS);
  endDay(st);
  busy = false;
  if (st.phase === 'ended') { finish(); render(st.delta); return; }
  save();
  const bad = st.report.inc.some((i) => i.kind === 'crit') || st.event.id === 'mutiny';
  sound.play(bad ? 'alarm' : 'morning');
  render(st.report.delta);
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled || busy) return;
  const d = el.dataset;
  switch (d.act) {
    case 'sound': sound.on ? sound.stop() : sound.start(); if (sound.on) sound.play('good'); renderBar(); break;
    case 'card': stopAttract(); setup = { card: d.card, picks: {} }; sound.play('card'); render(); desk.scrollTop = 0; break;
    case 'pick': setup.picks[d.role] = +d.i; sound.play('tap'); { const y = desk.scrollTop; renderHatch(); desk.scrollTop = y; } break;
    case 'grab': for (const r of ROLE_ORDER) if (setup.picks[r] === undefined) setup.picks[r] = Math.floor(Math.random() * CANDIDATES[r].length); begin(setup.card, setup.picks, params.has('seed') ? +params.get('seed') : undefined); break;
    case 'seal': begin(setup.card, setup.picks, params.has('seed') ? +params.get('seed') : undefined); break;
    case 'resume': stopAttract(); st = store.get('bb.save', null); sound.play('card'); render(); break;
    case 'open': openDay(st); save(); sound.play(eventView(st).grim ? 'alarm' : 'card'); render(); break;
    case 'choose': choose(st, +d.i); sound.play('stamp'); if (st.phase === 'ended') finish(); else save(); desk.dataset.view = ''; render(st.result ? st.result.delta : {}); break;
    case 'tool': {
      const o = actionList(st).find((x) => x.id === d.id);
      if (o.id === 'promise') pickPromise(); else if (o.target) pickWho(o.id);
      else openSheet(`<h2>${esc(o.name)}</h2>${toolInfo(o.id)}<div class="row"><button type="button" class="go${o.evil ? ' danger' : ''}" data-act="do" data-id="${o.id}">${esc(o.name)}</button><button type="button" class="go ghost" data-act="close">Not today</button></div>`);
      break;
    }
    case 'who': pickWho(d.id, d.type); break;
    case 'confirm': {
      const p = person(d.role);
      openSheet(`<h2>Exile ${esc(p.first)}?</h2><p class="body">${esc(p.first)} goes up in the lift and does not come back. You lose ${esc(ROLES[p.role].keeps.toLowerCase())} done properly, and the others will not forget it.</p><div class="row"><button type="button" class="go danger" data-act="do" data-id="exile" data-role="${d.role}">Exile</button><button type="button" class="go ghost" data-act="close">Not today</button></div>`);
      break;
    }
    case 'do': doAct(d.id, { role: d.role, type: d.type }); break;
    case 'matter': { const m = matterView(st)[+d.i]; if (m && st.phase === 'day') openSheet(matterCard(m, true)); else if (m) openSheet(`<h2>${rich(m.title)}</h2><p class="body">${rich(m.text)}</p><p class="fine">Start the day to deal with it.</p>`); break; }
    case 'decide': { const text = decide(st, +d.i, d.id); if (text === null) break; closeSheet(); sound.play('stamp'); const delta = st.today[st.today.length - 1].delta; save(); render(delta); break; }
    case 'policies': policySheet(); break;
    case 'policy': if (setPolicy(st, d.k, +d.v)) { sound.play('tap'); save(); renderBar(); renderSilo(false); const y = $('#sheet-box').scrollTop; policySheet(); $('#sheet-box').scrollTop = y; } break;
    case 'indulge': { const text = indulge(st); if (text === null) break; closeSheet(); sound.play('coin'); const delta = st.today[st.today.length - 1].delta; save(); render(delta); break; }
    case 'you': youSheet(); break;
    case 'night': lightsOut(); break;
    case 'dossier': if (st) { sound.play('tap'); dossier(d.role); } break;
    case 'ledger': ledger(); break;
    case 'roster': roster(); break;
    case 'res': { const r = RES.find((x) => x[0] === d.k), f = forecast(st)[r[0]]; openSheet(`<h2 class="r-${r[0]}">${ICON[r[0]]} ${r[1]}: ${Math.round(st.res[r[0]])}</h2><p class="body">${r[2]}</p><p class="body">As things stand, tonight takes <b>${num1(f)}</b>. ${st.res[r[0]] + f * (RULES.DAYS - st.day + 1) < 0 ? 'At this rate it runs out before the surface is safe.' : 'At this rate it lasts.'}</p><div class="acts col"><button type="button" class="tool" data-act="policies">Standing orders</button></div>`); break; }
    case 'menu': menu(); break;
    case 'help': help(); break;
    case 'close': closeSheet(); break;
    case 'again': begin(st.card, st.picks || {}); break;
    case 'abandon': store.del('bb.save'); // falls through to the title
    case 'title': closeSheet(); st = null; setup = null; render(); startAttract(); break;
    default: break;
  }
});
// a pawn in the silo opens that person's file
$('#silo').addEventListener('click', (ev) => { const b = ev.target.closest('.pawn[data-role]'); if (b && st && !busy) { sound.play('tap'); dossier(b.dataset.role); } });
sheet.addEventListener('click', (ev) => { if (ev.target === sheet) closeSheet(); });
addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') return closeSheet();
  if (!st || busy || !sheet.hidden) return;
  if (st.phase === 'day' && !st.eventDone && ['1', '2', '3', '4'].includes(ev.key)) { const b = desk.querySelectorAll('.memo .choice')[+ev.key - 1]; if (b) b.click(); }
  if (ev.key === 'Enter' && !ev.target.closest('button')) { const b = desk.querySelector('.go:not(:disabled)'); if (b) b.click(); }
});
// a small sign of life in the model now and then
if (!calm) setInterval(() => { if (st && !busy && !document.hidden && sheet.hidden && silo.beat && st.phase !== 'ended') silo.beat(); }, 9000);

// --- start ------------------------------------------------------------------------------------------

function boot() {
  const card = params.get('card'), end = params.get('end');
  if (silo.setOpen && !calm) { silo.setOpen(0, true); setTimeout(() => silo.setOpen(1), 350); }   // the model folds up out of flat card
  if (card || params.has('day') || end) {
    const crew = params.get('crew') || '', picks = {};
    ROLE_ORDER.forEach((r, i) => { picks[r] = Math.min(CANDIDATES[r].length - 1, +crew[i] || 0); });
    st = newRun(card || 'inherited', params.has('seed') ? +params.get('seed') : 20261113, picks);
    const day = Math.min(RULES.DAYS, +params.get('day') || 1);
    let s = 99;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const policy = POLICIES[params.get('as')] || POLICIES.careful;
    if (day > 1) playOut(st, policy, r, day);
    const view = params.get('view');
    if (st.phase === 'report' && (view === 'day' || view === 'done' || view === 'night')) openDay(st);
    if (st.phase === 'day' && (view === 'done' || view === 'night')) choose(st, policy.event(st, eventView(st), r));
    if (end && ENDINGS[end]) { st.ending = { id: end, day: st.day }; st.phase = 'ended'; }
    render();
    if (view === 'night' && st.phase === 'day') { app.dataset.phase = 'night'; renderSilo(true); }
    return;
  }
  render();
  startAttract();
}
boot();
window.__bb = { get st() { return st; }, set st(v) { st = v; render(); }, render, sound, silo };
