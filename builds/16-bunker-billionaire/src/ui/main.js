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

import { RULES, PROMISES, newRun, openDay, eventView, choose, handView, mayPlay, playCard, kindness, promiseList, promiseText, matterView, decide, setPolicy, policyBlock, forecast, endDay, projectList, commission, canEscape, escape, requestView, answer, workOn, needsFirst, projectView, buildPart } from '../engine/sim.js';
import { POLICIES, playOut } from '../engine/auto.js';
import { ROLES, ROLE_ORDER, TRAITS, STAGES, CANDIDATES } from '../data/staff.js';
import { CARDS as STARTS, cardById } from '../data/cards.js';
import { ENDINGS } from '../data/text.js';
import { POLICY_INFO, DONE } from '../data/matters.js';
import { CARDS as DECK, KINDS, PROJECTS, TIERS, TIER_NAMES, titleOf, nextTitle } from '../data/deck.js';
import { REQUESTS } from '../data/requests.js';
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
  opu: '<svg viewBox="0 0 16 16"><path d="M1.5 5 L4.5 8 L8 2.5 L11.5 8 L14.5 5 L13 13 H3 Z" fill="currentColor"/><rect x="3" y="13.2" width="10" height="1.6" rx=".6" fill="currentColor"/></svg>',
  scroll: '<svg viewBox="0 0 16 16"><path d="M4 2 H12 a1.5 1.5 0 0 1 1.5 1.5 V12 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V3 a1 1 0 0 1 1 -1 Z" fill="currentColor"/><path d="M5.5 5.5 H11 M5.5 8 H11 M5.5 10.5 H9" stroke="var(--paper)" stroke-width="1"/></svg>',
  sound: '<svg viewBox="0 0 16 16"><path d="M2 6 H5 L9 2.5 V13.5 L5 10 H2 Z" fill="currentColor"/><path d="M11 5.5 Q13 8 11 10.5 M12.6 3.6 Q16 8 12.6 12.4" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 16 16"><path d="M2 6 H5 L9 2.5 V13.5 L5 10 H2 Z" fill="currentColor"/><path d="M11.2 5.8 L15 10.2 M15 5.8 L11.2 10.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
};
const RES = [
  ['food', 'Food', 'Feeds everyone each night. The farm grows some of it back. Drained by staff rations, your lifestyle and crop failures.'],
  ['water', 'Water', 'Drinking, crops and your baths. The plant recycles most of it. Drained by leaks, sabotage and decadence.'],
  ['power', 'Power', 'Runs the air, the lights and the cameras. Drained by your lifestyle, cameras and breakdowns.'],
  ['med', 'Medicine', 'Treats injury and illness. Drained by accidents, poisonings and rationing choices.'],
  ['lux', 'Luxury', 'Wine, art, gold taps: your money down here. It pays for projects, perks, repairs and treats. Very little new comes in.'],
];
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
const pips = () => { const max = RULES.PLAYS + (st.built.butler ? 1 : 0); return Array.from({ length: max }, (_, i) => `<i class="${i < st.plays ? 'on' : 'used'}"></i>`).join(''); };

// --- the bar ----------------------------------------------------------------------------------------

function renderBar(delta = {}) {
  if (!st) { bar.innerHTML = `<div class="brand">Bunker Billionaire</div><div class="bar-right">${soundButton()}</div>`; return; }
  const owed = st.promises.filter((p) => p.state === 'owed' || p.state === 'forgotten');
  const next = owed.filter((p) => p.due).sort((a, b) => a.due - b.due)[0];
  const jobs = (st.requests || []).filter((r) => r.state === 'owed');
  const soon = (next && next.due - st.day <= 2) || jobs.some((r) => r.until - st.day <= 1);
  owed.push(...jobs);
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
  if (!over) for (const v of requestView(st)) if (v.state === 'asked') asks[v.role] = v.i;
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
    policy: { tub: st.policy.life >= 1 || st.built.hottub ? 1 : 0, cinema: st.policy.life >= 1 ? 1 : 0 }, faults: matters.filter((m) => m.kind === 'fault').map((m) => ({ sys: m.sys, i: m.i })),
  };
}
function renderSilo(night = false) {
  if (!st) { strip.innerHTML = setup ? '<span class="hint">Eight places. Choose who comes in.</span>' : '<span class="hint">Drag the model to look round it</span>'; return; }
  silo.update(siloView(night));
  const o = Math.round(st.res.opu), nx = nextTitle(o), prev = [0, 90, 180, 300, 440].filter((t) => t <= o).pop(), band = Math.min(4, Math.floor(st.unrest / 20));
  const pct = nx ? Math.round(((o - prev) / (nx[0] - prev)) * 100) : 100;
  strip.innerHTML = `<button type="button" class="score" data-act="you" aria-label="Opulence ${o}: ${titleOf(o)}">${ICON.opu}<b>${o}</b><span class="title">${esc(titleOf(o))}</span><span class="meter"><i style="width:${pct}%"></i></span></button>
    <button type="button" class="moodm m${band}" data-act="you" aria-label="The bunker: ${['Calm', 'Grumbling', 'Muttering', 'Plotting', 'On the brink'][band]}"><span class="segs">${[0, 1, 2, 3, 4].map((k) => `<i class="${k <= band ? 'on' : ''}"></i>`).join('')}</span><span>${['Calm', 'Grumbling', 'Muttering', 'Plotting', 'On the brink'][band]}</span></button>
    <button type="button" data-act="roster">Staff</button>`;
}
function roster() {
  openSheet(`<h2>Staff files</h2><p class="fine">A face each morning and whatever was last heard. Some of it is wrong.</p><ul class="picker">${st.staff.map((p) => `<li><button type="button" data-act="dossier" data-role="${p.role}">${faceSVG(p.role, moodOf(p))}<span><b>${esc(p.name)}</b><small>${esc(p.title)} · ${(TRAITS[p.trait] || { name: 'gagged' }).name.toLowerCase()}${p.status !== 'ok' ? ` · ${p.fled ? 'fled' : p.status}` : locked(p) ? ' · in the cell' : ''}</small>${p.rumour && p.status === 'ok' ? `<small class="r">${esc(p.rumour.text)}</small>` : ''}</span></button></li>`).join('')}</ul>`);
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
  const ok = save && save.v === 6 && save.phase !== 'ended';
  desk.innerHTML = `<article class="card title-card deal">
    <p class="kicker">Act 2 · a management game for one bunker</p>
    <h1>Bunker Billionaire</h1>
    <p class="lede">You run a luxury doomsday bunker in an old missile silo. The surface will be safe in thirty days.</p>
    <ul class="goal"><li><b>Live as lavishly as you can.</b> Your score is your opulence: hot tubs, banquets, portraits of yourself.</li><li><b>Still be in charge on day 30.</b> Eight staff, a closed silo, and none of them can be trusted.</li><li><b>Each day:</b> one piece of business, two cards from your hand, what you promised the staff, and the upgrade you are building.</li></ul>
    <p class="hintline">Being kind is expensive. Spin is cheap. Being a monster pays best, and costs most.</p>
    ${ok ? `<button type="button" class="go" data-act="resume">Carry on from day ${save.day}</button>` : ''}
    <h2>First: how did you get the bunker?</h2>
    <div class="starts">${STARTS.map((c) => `<button type="button" class="start" data-act="card" data-card="${c.id}">
      <span class="level l-${c.level.toLowerCase()}">${c.level}</span><b>${esc(c.name)}</b>
      <em>${esc(c.line)}</em>
      <small>${esc(c.blurb)}</small>
      <small><i>You owe:</i> ${c.promises.length ? c.promises.map((t) => `“${esc(PROMISES[t].text)}”`).join(', ') : 'nothing'} · <i>Grudge:</i> ${esc(c.grudgeLine)}</small>
    </button>`).join('')}</div>
    <p class="fine">${(() => { const b = store.get('bb.best', {}); const top = Math.max(0, ...Object.values(b)); return top ? `Best opulence so far: ${top} (${esc(titleOf(top))}). ` : ''; })()}Endings found: ${found.length} of ${Object.keys(ENDINGS).length}. <button type="button" class="link" data-act="help">How to play</button></p>
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
  if (f.grin.length) parts.push(`${names(f.grin)} ${f.grin.length > 1 ? 'have' : 'has'} started smiling at everything. Frightened people smile like that, whatever they really feel.`);
  return parts.length ? `<p class="faces-line">${rich(parts.join(' '))}</p>` : '';
}

function renderReport() {
  const r = st.report, card = cardById(st.card);
  const first = st.day === 1 ? `<p class="lede">${esc(card.line)}</p><p class="hintline">The aim: be living as lavishly as possible, and still be in charge, when the hatch opens on day ${RULES.DAYS}. Your opulence and the bunker’s mood are under the silo. Tap a face to open that person’s file.</p>` : '';
  const waiting = st.matters.length, asked = requestView(st).filter((v) => v.state === 'asked').length;
  desk.innerHTML = `<article class="card report deal">
    <header><span class="stamp">Day ${st.day} of ${RULES.DAYS}</span><h2>Morning report</h2></header>
    ${first}
    ${r.inc.length ? `<ul class="incidents">${r.inc.map((i) => `<li class="${i.kind}">${rich(i.text)}</li>`).join('')}</ul>` : ''}
    <p class="mood">${esc(r.mood)}</p>
    ${r.tense ? '<p class="hintline">The bunker is close to acting together. A promise, a speech, some mandatory fun or a scapegoat would calm it.</p>' : ''}
    ${facesLine(r.faces)}
    ${r.cams ? `<p class="cams-line">${rich(r.cams)}</p>` : ''}
    ${r.informant ? `<p class="informant-line">${rich(r.informant.text)}</p>` : ''}
    ${r.rumours.length ? `<h3>Heard on the stairs</h3><ul class="rumours">${r.rumours.map((x) => `<li>${rich(x.text)}</li>`).join('')}</ul>` : ''}
    <button type="button" class="go" data-act="open">Start the day${asked ? ` · ${asked} request` : ''}${waiting ? ` · ${waiting} broken` : ''}</button>
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
  const faults = matterView(st).filter((m) => m.kind === 'fault');
  const hand = handView(st);
  const log = st.today.length ? `<ul class="today">${st.today.map((t) => `<li><b>${rich(t.title)}</b> ${rich(t.text)} ${chips(t.delta)}</li>`).join('')}</ul>` : '';
  const firstDays = st.day <= 2 && !st.today.length;
  desk.innerHTML = `${top}
  ${needsFirst(st) ? projectsCard() : ''}
  ${requestsCard()}
  ${faults.map((m) => matterCard(m, false)).join('')}
  <article class="card hand">
    <header><h2>Your hand</h2><span class="pips big">${pips()}</span><span class="left">${st.plays ? `play ${st.plays} more` : 'all played'}</span></header>
    ${firstDays ? '<p class="hintline">Four cards a day; play two. Generous cards cost you and please them. Spin is cheap and absurd. Ruthless cards pay you in opulence, and each one opens worse ones. Indulgent cards are just for you.</p>' : ''}
    <div class="pcards">${hand.map(cardTile).join('')}</div>
    ${log}
  </article>
  ${tonight()}
  ${needsFirst(st) ? '' : projectsCard()}
  ${canEscape(st) ? `<button type="button" class="go ghost pod" data-act="escape">Board the escape pod (with ${Math.round(st.res.opu)} opulence)</button>` : ''}
  <button type="button" class="go" data-act="night"${st.eventDone && !needsFirst(st) ? '' : ' disabled'}>${!st.eventDone ? 'Settle today’s business first' : needsFirst(st) ? 'Choose your first project first' : 'Lights out'}</button>`;
}

// Requests: what the staff have asked for, and what you promised them. Each promise is a job: a part a day,
// paid in stores or in your time (a card play), finished in time or broken.
const pipsOf = (v) => Array.from({ length: v.steps }, (_, k) => `<i class="${k < v.done ? 'on' : ''}"></i>`).join('');
const partChips = (v) => (v.time ? '<span class="chip act">1 play</span>' : chips(v.part));
const stakes = (v) => `<p class="stakes"><span class="good"><b>Keep it:</b> ${esc(v.perkText)}</span> <span class="bad"><b>Break it:</b> ${esc(v.falloutText)}</span></p>`;
function requestsCard() {
  const list = requestView(st);
  if (!list.length) return '';
  const asked = list.filter((v) => v.state === 'asked'), owed = list.filter((v) => v.state === 'owed');
  const ask = (v) => `<div class="req ask">
      <p class="rq-head"><b>${esc(v.title)}</b><span class="stamp">${v.left <= 1 ? 'answer today' : `answer within ${v.left} days`}</span></p>
      <p class="body">${rich(v.text)}</p>
      <p class="terms"><b>Promise:</b> ${v.steps} × ${partChips(v)} one a day, within ${v.days} days</p>
      ${stakes(v)}
      <div class="choices small">${v.choices.map((c) => `<button type="button" class="choice${c.id === 'yes' ? ' yes' : ''}" data-act="answer" data-i="${v.i}" data-id="${c.id}"${c.ok ? '' : ' disabled'}><span class="t">${esc(c.label)}${c.ok ? '' : `<small>${esc(c.why)}</small>`}</span><span class="costs">${chips(c.cost)}</span></button>`).join('')}</div>
    </div>`;
  const job = (v) => `<div class="req job${v.late ? ' late' : ''}">
      <p class="rq-head">${whoChip(person(v.role))}<b>${esc(v.title)}</b><span class="rpips">${pipsOf(v)}</span></p>
      <p class="terms">${v.late ? '<b class="warn">Too late to finish.</b> ' : ''}${v.steps - v.done} to go · ${v.left <= 1 ? 'last day today' : `${v.left} days left`}</p>
      ${stakes(v)}
      <button type="button" class="tool work" data-act="work" data-i="${v.i}"${v.work.ok ? '' : ' disabled'}>${v.work.ok ? `Do today’s part ${partChips(v)}` : esc(v.work.why)}</button>
    </div>`;
  return `<article class="card requests deal">
    <header><h2>Requests</h2><span class="left">${[owed.length ? `${owed.length} promised` : '', asked.length ? `${asked.length} waiting` : ''].filter(Boolean).join(' · ')}</span></header>
    ${st.day <= 8 && !st.stats.reqMade ? '<p class="hintline">Promise, and you pay for it a day at a time. Finish in time for a reward; miss it and it backfires.</p>' : ''}
    ${asked.map(ask).join('')}${owed.map(job).join('')}
  </article>`;
}

// What a card does to people, as small tags (fx in data/deck.js). good: whether it helps you keep power.
const FX_ICON = {
  like: '<svg viewBox="0 0 16 16"><path d="M8 14 L2.2 8.2 A3.3 3.3 0 0 1 8 3.6 A3.3 3.3 0 0 1 13.8 8.2 Z" fill="currentColor"/></svg>',
  calm: '<svg viewBox="0 0 16 16"><path d="M1.5 6 Q4.5 3 8 6 T14.5 6 M1.5 11 Q4.5 8 8 11 T14.5 11" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  fear: '<svg viewBox="0 0 16 16"><path d="M1 8 Q8 1 15 8 Q8 15 1 8 Z" fill="currentColor"/><circle cx="8" cy="8" r="2.4" fill="var(--paper)"/></svg>',
  know: '<svg viewBox="0 0 16 16"><circle cx="6.5" cy="6.5" r="4" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9.5 9.5 L14 14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  debt: ICON.scroll,
};
const FX_TAG = {
  '+like1': ['like', 'up', 'one'], '-like1': ['like', 'down', 'one'], '+likeAll': ['like', 'up', 'all'], '-likeAll': ['like', 'down', 'all'], '~like1': ['like', 'odd', 'gamble'],
  '+calm': ['calm', 'up', 'calmer'], '-calm': ['calm', 'down', 'stirs'], '+fear1': ['fear', 'odd', 'one'], '+fearAll': ['fear', 'odd', 'all'],
  '+know': ['know', 'up', 'learn'], '+debt': ['debt', 'down', 'owe'],
};
const FX_SAY = { like: 'liked', calm: 'mood', fear: 'feared', know: 'find out', debt: 'a debt' };
function fxTags(c) {
  const list = (c.fx || '').split(' ').filter(Boolean);
  if (c.kind === 'cruel' && !list.includes('-calm')) list.push('-calm');   // every ruthless card stirs the bunker
  return list.map((t) => { const [k, dir, word] = FX_TAG[t]; return `<span class="fx ${dir}" title="${FX_SAY[k]}">${FX_ICON[k]}${dir === 'up' && k === 'like' ? '+' : dir === 'down' && k === 'like' ? '−' : ''}${word}</span>`; }).join('');
}

// A card in your hand: what kind it is, what it does, the joke, and what it costs or pays.
function cardTile(c) {
  const cost = { ...(c.cost || {}), ...(c.pay ? { opu: c.pay } : {}) };
  return `<button type="button" class="pcard k-${c.kind}${c.played ? ' played' : ''}" data-act="play" data-i="${c.i}"${c.ok ? '' : ' disabled'} aria-label="${esc(c.name)}: ${esc(c.text)}">
    <span class="pk">${KINDS[c.kind].name}${c.tier ? ` · step ${c.tier + 1}` : ''}</span>
    <b>${esc(c.name)}</b>
    <span class="pt">${esc(c.text)}</span>
    <em>${esc(c.flavour)}</em>
    <span class="pfoot">${fxTags(c)}${chips(cost)}${c.target ? '<span class="tgt">on someone</span>' : ''}${c.played ? '<span class="stampd">Played</span>' : !c.ok ? `<span class="why">${esc(c.why)}</span>` : ''}</span>
  </button>`;
}

// Tonight: how you live, how they eat, and what the night will take.
function tonight() {
  const seg = (k) => {
    const info = POLICY_INFO[k], v = st.policy[k];
    return `<div class="pol"><b>${esc(info.name)}</b><div class="seg">${info.opts.map((o, i) => { const why = policyBlock(st, k, i); return `<button type="button" class="${i === v ? 'on' : ''}" data-act="set" data-k="${k}" data-v="${i}"${why ? ` disabled title="${esc(why)}"` : ''}>${esc(o)}</button>`; }).join('')}</div><p class="fine">${esc(info.notes[v])}</p></div>`;
  };
  return `<article class="card tonight-card">
    <header><h2>Tonight</h2></header>
    ${seg('life')}${seg('rations')}
    ${st.policy.curfew ? `<p class="fine curfew">Curfew and anthem: on, for good. ${chips({ opu: RULES.POLICY.curfew.opu[1] }, true)} a night.</p>` : ''}
    <div class="tonight"><span>Overnight</span>${chips(forecast(st), true)}</div>
  </article>`;
}

// The upgrade path: what is being built, what is built, and the button to build more.
function projectsCard() {
  if (needsFirst(st)) return `<article class="card projects first deal">
    <header><h2>Your first project</h2></header>
    <p class="body">Ordered before the sirens and already paid for. Pick one. The grand opening is set for day ${RULES.FIRST_DUE}, and it will not build itself.</p>
    <button type="button" class="go" data-act="projects">Choose your first project</button>
  </article>`;
  const built = Object.keys(st.built).map((id) => PROJECTS[id]), open = projectList(st).filter((p) => p.ok).length;
  const v = projectView(st);
  const opt = (o) => `<button type="button" class="tool push" data-act="push" data-how="${o.id}"${o.ok ? '' : ' disabled'}><span>${esc(o.label)}${o.ok ? '' : `<small>${esc(o.why)}</small>`}</span><span class="costs">${o.play ? '<span class="chip act">1 play</span>' : o.mood ? '<span class="fx down">' + FX_ICON.like + '−all</span>' : chips(o.cost)}</span></button>`;
  const due = v && v.due && !v.missed ? (v.due - st.day <= 0 ? ' · opens today' : ` · opens day ${v.due}`) : '';
  return `<article class="card projects">
    <header><h2>Projects</h2><span class="left">${built.length} built</span></header>
    ${v ? `<div class="building"><p class="rq-head"><b>${esc(v.name)}</b><span class="rpips">${Array.from({ length: v.parts }, (_, k) => `<i class="${k < v.done ? 'on' : ''}"></i>`).join('')}</span></p>
      <p class="terms">${v.left} ${v.left === 1 ? 'part' : 'parts'} to go${due} · up to 2 a day</p>
      <div class="pushes">${v.options.map(opt).join('')}</div></div>` : ''}
    ${built.length ? `<p class="builtlist">${built.map((p) => `<span>${esc(p.name)}</span>`).join('')}</p>` : ''}
    ${!v ? `<button type="button" class="go ghost" data-act="projects">${open ? `Commission a project (${open} you can afford)` : 'See what you could build'}</button>` : ''}
  </article>`;
}
function projectsSheet() {
  const first = needsFirst(st);
  openSheet(`<h2>${first ? 'Your first project' : 'Commission a project'}</h2><p class="fine">${first ? `Already paid for. Grand opening on day ${RULES.FIRST_DUE}: miss it and you open in front of the scaffolding.` : 'One at a time.'} Each part is done by buying its materials, putting the staff on overtime, or supervising it yourself. Finished: ${RULES.PROJECT_DONE} opulence at once, and what it gives every night.</p>
    <ul class="plist">${projectList(st).map((p) => `<li class="${p.built ? 'built' : ''}"><b>${esc(p.name)}</b><em>${esc(p.flavour)}</em><span>${esc(p.text)}${(p.cards || []).length ? ` New cards: ${p.cards.map((c) => DECK[c].name).join(', ')}.` : ''}</span>
      <span class="pmeta">${Object.keys(p.cost).length ? chips(p.cost) + ' · ' : ''}${p.days} parts · materials ${chips(p.mat || {})} a part${Object.keys(p.night || {}).filter((k) => k !== 'loyalty').length ? ` · then ${chips(Object.fromEntries(Object.entries(p.night).filter(([k]) => k !== 'loyalty')), true)} a night` : ''}</span>
      <button type="button" class="tool" data-act="build" data-id="${p.id}"${p.ok ? '' : ' disabled'}>${p.ok ? 'Build it' : esc(p.why)}</button></li>`).join('')}</ul>`);
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
  const firstOf = (i) => { const e = st.path.find((x) => x.tier === i); return e ? `day ${e.day}` : ''; };
  const slope = Object.keys(st.tierUsed).length ? `<h3>How far you went</h3><ol class="rungs past">${TIER_NAMES.map((r, i) => (st.tierUsed[i] ? `<li class="used"><b>${esc(r)}</b> <small>from ${firstOf(i)}</small></li>` : '')).join('')}</ol>` : '<h3>How far you went</h3><p class="fine">Not one ruthless card. Nobody down here will believe it.</p>';
  const o = Math.round(st.res.opu), won = /^(king|word|escaped)/.test(st.ending.id);
  const best = store.get('bb.best', {})[st.card] || 0;
  const builtNames = Object.keys(st.built).map((id) => PROJECTS[id].name);
  desk.innerHTML = `<article class="card ending k-${kind} deal">
    <header><span class="stamp">${esc(e.kind)}</span><h1>${esc(e.title)}</h1></header>
    <p class="body">${esc(e.text)}</p>
    <div class="final ${won ? 'won' : 'lost'}">${ICON.opu}<b>${o}</b><span>opulence</span><strong>${won ? esc(titleOf(o)) : 'Former ' + esc(titleOf(o))}</strong><small>${won ? (o >= best ? 'Your best yet on this start.' : `Your best on this start: ${best}.`) : 'You were not in charge at the end. The score stands; the title does not.'}</small></div>
    <p class="verdict">History will remember you as <b>${epithet(st.infamy)}</b>.</p>
    ${builtNames.length ? `<p class="fine">You built: ${builtNames.map(esc).join(', ')}.</p>` : ''}
    <p class="fine">${st.day >= RULES.DAYS && (kind === 'king' || kind === 'word' || st.ending.id === 'deposed_hatch') ? `All ${RULES.DAYS} days` : `Day ${st.day} of ${RULES.DAYS}`} · ${esc(card.name)} · ${s.cruel} ruthless cards · ${s.perks} little somethings · ${s.talks} open doors · ${s.exiles} sent up · promises kept ${kept}, broken ${broken} · requests kept ${s.reqKept || 0}, broken ${s.reqBroken || 0}</p>
    ${slope}
    <h3>Who paid for it, and what you never saw</h3>
    <p class="fine key"><span class="k-loy"></span> loyalty <span class="k-fear"></span> fear, day by day</p>
    <ul class="reveal">${st.staff.map((p) => `<li>${faceSVG(p.role, trueFace(p))}<div><b>${esc(p.name)}</b><small>${esc(p.title)} · ${esc((TRAITS[p.trait] || { name: 'gagged' }).name.toLowerCase())}</small><small class="fate s${p.status === 'ok' ? p.stage : 'x'}">${fate(p)}</small>${record(p) ? `<small class="done">${esc(record(p))}</small>` : ''}</div>${spark(p)}</li>`).join('')}</ul>
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
const MOOD_BANDS = ['Calm', 'Grumbling', 'Muttering', 'Plotting', 'On the brink'];
const moodBand = () => Math.min(4, Math.floor(st.unrest / 20));

// What each step of the ruthless slope lets you do, in plain words (TIERS in data/deck.js).
const STEP_SAYS = ['performance reviews and bunk searches', 'questioning people at 2am', 'making examples, and a curfew', 'scapegoats and the cell', 'sending people up to the surface'];
const MOOD_SAYS = ['Nobody is organising anything.', 'Complaints, nothing more.', 'People are talking. Calm it down before it turns into plotting.', 'They are organising. A mutiny is close.', 'A mutiny could come any night.'];
function youSheet() {
  const w = st.word;
  const word = w >= 1.15 ? '<b>Trusted.</b> You have kept your promises, so new ones count for more.' : w >= 0.8 ? '<b>Untested.</b> Your promises count for what they say.' : w >= 0.4 ? '<b>Doubted.</b> You have broken promises, so new ones calm people less.' : '<b>Worthless.</b> Nobody believes a promise from you any more.';
  const o = Math.round(st.res.opu), nx = nextTitle(o), f = forecast(st).opu;
  const open = st.regime, kind = Math.round(kindness(st) * 100);
  openSheet(`<div class="dossier"><div class="who-head">${faceSVG('you', 'smug')}<div><h2>You</h2><p>${esc(titleOf(o))}</p></div></div>
    <dl><dt>The aim</dt><dd>Live as lavishly as you can and still be in charge on day ${RULES.DAYS}. Opulence is your score.</dd>
    <dt>Opulence</dt><dd><b>${o}</b>. Living like this adds about ${Math.round(f)} a night. ${nx ? `${nx[0] - o} more makes you <b>${esc(nx[1])}</b>.` : 'There is no higher title.'}</dd>
    <dt>The bunker</dt><dd><b>${MOOD_BANDS[moodBand()]}.</b> ${MOOD_SAYS[moodBand()]}</dd>
    <dt>Ruthlessness</dt><dd>${open > 1 ? `The worst you can now do: <b>${STEP_SAYS[open - 1]}</b>. Ruthless cards pay more the further you go, and your kindness counts for ${kind}% of what it did, because they know what you are.` : 'You have not been ruthless yet. Play a ruthless card and harsher ones join your deck the next morning.'}</dd>
    <dt>Reputation</dt><dd><b>${esc(epithet(st.infamy).replace(/^a /, '').replace(/^./, (c) => c.toUpperCase()))}.</b> The harsher your reputation, the longer their fear of you lasts.</dd>
    <dt>Your word</dt><dd>${word}</dd>
    <dt>Your deck</dt><dd>${st.deck.length + st.discard.length + st.hand.length} cards.</dd></dl></div>`);
}

const record = (p) => Object.entries(p.done || {}).map(([k, n]) => `${DONE[k] || k}${n > 1 ? ' ×' + n : ''}`).join(', ');
function dossier(role) {
  if (role === 'you') return youSheet();
  const p = person(role), R = ROLES[role];
  const here = p.status === 'ok';
  const met = here && R.wantMet(st, p);
  const usable = st.phase === 'day' && here ? handView(st).filter((c) => c.ok && c.target && mayPlay(st, c.i, p)) : [];
  openSheet(`<div class="dossier"><div class="who-head">${faceSVG(role, moodOf(p))}<div><h2>${esc(p.name)}</h2><p>${esc(p.title)}</p></div></div>
    <p class="moodline">${p.fled ? 'Fled to the surface.' : p.status === 'exiled' ? 'Exiled to the surface.' : p.status === 'dead' ? 'Dead.' : locked(p) ? `In the cell until day ${p.cell}.` : `Looks <b>${MOOD_WORDS[p.face] || 'hard to read'}</b> this morning.${p.face === 'grin' ? ' Frightened people all smile like that.' : ''}`}</p>
    ${usable.length ? `<h3>Play a card on ${esc(p.first)}</h3><div class="pcards mini">${usable.map((c) => `<button type="button" class="pcard k-${c.kind}" data-act="playon" data-i="${c.i}" data-role="${role}"><span class="pk">${KINDS[c.kind].name}</span><b>${esc(c.name)}</b><span class="pfoot">${chips({ ...(c.cost || {}), ...(c.pay ? { opu: c.pay } : {}) })}</span></button>`).join('')}</div>` : ''}
    ${p.said ? `<h3>Told you, day ${p.said.day}</h3><p class="rumour said">“${esc(p.said.text)}”</p>` : ''}
    ${p.rumour ? `<h3>Last heard</h3><p class="rumour${p.rumour.informant ? ' inf' : ''}">${esc(p.rumour.text)} <small>day ${p.rumour.day}</small></p>` : ''}
    ${p.tested ? `<p class="rumour test">Assessed on day ${p.tested.day}: <b>${p.tested.band}</b>.</p>` : ''}
    <dl><dt>Keeps running</dt><dd>${esc(R.keeps)}</dd><dt>If they turn</dt><dd>${esc(R.danger)}</dd>
    <dt>Known for</dt><dd><b>${(TRAITS[p.trait] || { name: 'Gagged' }).name}.</b> ${(TRAITS[p.trait] || { note: 'Signed an NDA. Cannot say anything about anything.' }).note}</dd>
    <dt>Close to</dt><dd>${p.friend ? `${whoChip(person(p.friend))} What you do to one of them, the other feels.` : 'Nobody, any more.'}</dd>
    ${record(p) ? `<dt>You have</dt><dd>${esc(record(p))}</dd>` : ''}
    <dt>Wants</dt><dd>${esc(p.wantText)} ${here ? `<span class="met ${met ? 'yes' : 'no'}">${met ? 'has it' : 'not getting it'}</span>` : ''}</dd></dl>
    ${p.notes && p.notes.length ? `<h3>On file</h3><ul class="notes">${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div>`);
}

// Playing a card that needs someone: choose who.
function pickTarget(i) {
  const c = handView(st)[i];
  const who = st.staff.filter((p) => p.status === 'ok' && mayPlay(st, i, p));
  openSheet(`<h2>${esc(c.name)}: on whom?</h2><p class="fine">${esc(c.text)}</p><ul class="picker">${who.map((p) => `<li><button type="button" data-act="playon" data-i="${i}" data-role="${p.role}">${faceSVG(p.role, moodOf(p))}<span><b>${esc(p.name)}</b><small>${esc(p.title)} · ${(TRAITS[p.trait] || { name: 'gagged' }).name.toLowerCase()}${locked(p) ? ' · in the cell' : ''}${p.friend ? ` · close to ${esc(person(p.friend).first)}` : ''}</small>${p.rumour ? `<small class="r">${esc(p.rumour.text)}</small>` : ''}</span></button></li>`).join('')}</ul>`);
}
function pickPromise(i, role) {
  openSheet(`<h2>A Solemn Promise</h2><p class="stakes"><span class="good"><b>Today:</b> everyone likes you more, and the bunker calms down. Free.</span><span class="bad"><b>Break it later:</b> everyone likes you a lot less, the bunker stirs, and your word is worth half.</span></p><p class="fine">What do you promise? Nobody said you have to mean it.</p><ul class="picker">${promiseList(st).map((o) => `<li><button type="button" data-act="${o.target && !role ? 'promiseWho' : 'promise'}" data-i="${i}" data-type="${o.type}"${role ? ` data-role="${role}"` : ''}${o.ok ? '' : ' disabled'}><span><b>“${esc(o.name)}”</b><small><i>To keep it:</i> ${esc(o.cost)}</small><small>${o.ok ? (o.due ? `Due on day ${st.day + o.due}` : 'Stands until the hatch opens: kept by never breaking it') : esc(o.why)}</small></span></button></li>`).join('')}</ul>`);
}
function pickPromiseWho(i, type) {
  openSheet(`<h2>Who gets the next bunk upgrade?</h2><p class="fine">Cost of keeping it: ${esc(PROMISES.bunk.cost)}</p><ul class="picker">${st.staff.filter((p) => p.status === 'ok').map((p) => `<li><button type="button" data-act="promise" data-i="${i}" data-type="${type}" data-role="${p.role}">${faceSVG(p.role, moodOf(p))}<span><b>${esc(p.name)}</b><small>${esc(p.title)}</small></span></button></li>`).join('')}</ul>`);
}
function ledger() {
  const label = { owed: 'owed', kept: 'kept', broken: 'broken', forgotten: 'quietly forgotten', void: 'no longer matters' };
  const jobs = st.requests.filter((r) => r.state !== 'asked'), views = requestView(st);
  const rl = { owed: 'under way', kept: 'kept', broken: 'broken', alt: 'answered your way', refused: 'refused', ignored: 'never answered', void: 'no longer matters' };
  const cls = { owed: 'owed', kept: 'kept', broken: 'broken' };
  const reqs = jobs.length ? `<h3>Requests from the staff</h3><ul class="ledger-list">${jobs.map((r) => { const v = views.find((x) => x.i === st.requests.indexOf(r)); return `<li class="p-${cls[r.state] || 'void'}"><b>${esc(person(r.role).first)}: ${esc(REQUESTS[r.id].title)}</b><small>${rl[r.state]}${v ? ` · ${v.done} of ${v.steps} parts · ${v.left} ${v.left === 1 ? 'day' : 'days'} left` : ''}</small></li>`; }).join('')}</ul>` : '';
  openSheet(`<h2>Promises</h2>${reqs}${reqs && st.promises.length ? '<h3>What you promised everyone</h3>' : ''}${st.promises.length ? `<ul class="ledger-list">${st.promises.map((p) => `<li class="p-${p.state}"><b>“${esc(promiseText(st, p))}”</b><small>${label[p.state]}${p.state === 'owed' ? (p.due ? ` · due day ${p.due}` : ' · stands until the hatch opens') : ''}</small><small>Cost of keeping it: ${esc(PROMISES[p.type].cost)}</small></li>`).join('')}</ul>` : (reqs ? '' : '<p class="fine">You have promised nothing. Yet.</p>')}<p class="fine">A promise is the quickest way out of trouble, and a debt.</p>`);
}
function help() {
  openSheet(`<h2>How to play</h2><div class="help">
    <p><b>The aim.</b> Live as lavishly as you can, and still be in charge when the hatch opens on day ${RULES.DAYS}. Your score is your <b>opulence</b>; it earns you titles, from Tenant to God-Emperor of Silo 7.</p>
    <p><b>Each day:</b> settle one piece of business; play two of the four cards in your hand; set your lifestyle and the staff’s rations for the night; then lights out.</p>
    <p><b>Cards.</b> Generous ones cost you and please them. Spin is cheap and absurd, and sometimes works. Ruthless ones pay you in opulence, frighten everyone, and open worse ones the morning after. Indulgent ones are just for you.</p>
    <p><b>Requests.</b> Every few days one of the staff asks for something that takes days to deliver. Promise it and you owe a part a day, paid from the stores or with your own time (a card play), until it is done. Keep it and you get something for good; let the days run out and it is broken, with consequences. Or refuse, or give the funny third answer.</p>
    <p><b>Projects</b> are the upgrade path: a gold hot tub, a radio station, your own currency, a robot butler, an escape pod. Each adds opulence or new cards. You choose your first on day 1; its grand opening is on day 9. A project only moves when you work on it, up to two parts a day: buy the materials, put the staff on overtime (they mind), or supervise it yourself (a card play).</p>
    <p><b>The stores are a closed system.</b> Nothing new comes in. The number under each store is what tonight will take. Decadence costs food, water and power; if one runs out and stays out, everyone dies.</p>
    <p><b>You never see what people think.</b> You see a face each morning and hear rumours; both can be wrong, and frightened people smile whatever they feel. The bunker’s mood, under the silo, is the one thing you can always see: let it reach “On the brink” and they act together.</p>
    <p><b>Everyone has one friend down here.</b> What you do to one of them, the other feels.</p>
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
  const won = /^(king|word|escaped)/.test(st.ending.id);
  if (won) { const b = store.get('bb.best', {}); st.bestBefore = b[st.card] || 0; if (Math.round(st.res.opu) > (b[st.card] || 0)) { b[st.card] = Math.round(st.res.opu); store.set('bb.best', b); } }
  sound.play(won ? 'win' : 'lose');
}
function begin(cardId, picks, seed) {
  stopAttract(); setup = null;
  st = newRun(cardId, seed, picks);
  save(); sound.play('morning'); render();
}
function doPlay(i, arg) {
  const c = handView(st)[i];
  const text = playCard(st, i, arg);
  if (text === null) return;
  closeSheet();
  sound.play({ kind: 'coin', spin: 'good', cruel: 'stamp', self: 'coin' }[c.kind] || 'tap');
  const delta = st.today[st.today.length - 1].delta;
  if (st.phase === 'ended') { finish(); render(delta); return; }
  save(); render(delta);
  const last = desk.querySelector('.today li:last-child');
  if (last) last.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
}
async function lightsOut() {
  if (busy || st.phase !== 'day' || !st.eventDone || needsFirst(st)) return;
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
    case 'play': {
      const c = handView(st)[+d.i];
      if (!c || !c.ok) break;
      if (c.promise) pickPromise(+d.i);
      else if (c.target) pickTarget(+d.i);
      else doPlay(+d.i, {});
      break;
    }
    case 'playon': {
      const c = handView(st)[+d.i];
      if (c && c.promise) { pickPromise(+d.i, d.role); break; }
      if (c && c.id === 'exile' && !el.dataset.sure) { const p = person(d.role); openSheet(`<h2>Let ${esc(p.first)} go. Up?</h2><p class="body">${esc(p.first)} goes up in the lift and does not come back. You lose ${esc(ROLES[p.role].keeps.toLowerCase())} done properly, and the others will not forget it.</p><div class="row"><button type="button" class="go danger" data-act="playon" data-i="${d.i}" data-role="${d.role}" data-sure="1">Let them go</button><button type="button" class="go ghost" data-act="close">Not today</button></div>`); break; }
      doPlay(+d.i, { role: d.role });
      break;
    }
    case 'promiseWho': pickPromiseWho(+d.i, d.type); break;
    case 'promise': doPlay(+d.i, { type: d.type, role: d.role }); break;
    case 'matter': { const m = matterView(st)[+d.i]; if (m && st.phase === 'day') openSheet(matterCard(m, true)); else if (m) openSheet(`<h2>${rich(m.title)}</h2><p class="body">${rich(m.text)}</p><p class="fine">Start the day to deal with it.</p>`); break; }
    case 'decide': { const text = decide(st, +d.i, d.id); if (text === null) break; closeSheet(); sound.play('stamp'); const delta = st.today[st.today.length - 1].delta; save(); render(delta); break; }
    case 'set': if (setPolicy(st, d.k, +d.v)) { sound.play('tap'); save(); renderBar(); const y = desk.scrollTop; renderSilo(false); renderDay(); desk.scrollTop = y; } break;
    case 'answer': { const text = answer(st, +d.i, d.id); if (text === null) break; sound.play(d.id === 'yes' ? 'promise' : d.id === 'no' ? 'stamp' : 'good'); const delta = st.today[st.today.length - 1].delta; save(); render(delta); break; }
    case 'work': { const text = workOn(st, +d.i); if (text === null) break; sound.play(st.requests[+d.i].state === 'kept' ? 'win' : 'coin'); const delta = st.today[st.today.length - 1].delta; save(); render(delta); break; }
    case 'push': { const text = buildPart(st, d.how); if (text === null) break; sound.play(st.project ? 'coin' : 'win'); const delta = st.today[st.today.length - 1].delta; save(); render(delta); break; }
    case 'projects': projectsSheet(); break;
    case 'build': { const text = commission(st, d.id); if (text === null) break; closeSheet(); sound.play('promise'); const delta = st.today[st.today.length - 1].delta; save(); render(delta); break; }
    case 'escape': if (escape(st)) { finish(); render(); } break;
    case 'you': youSheet(); break;
    case 'night': lightsOut(); break;
    case 'dossier': if (st) { sound.play('tap'); dossier(d.role); } break;
    case 'ledger': ledger(); break;
    case 'roster': roster(); break;
    case 'res': { const r = RES.find((x) => x[0] === d.k), f = forecast(st)[r[0]]; openSheet(`<h2 class="r-${r[0]}">${ICON[r[0]]} ${r[1]}: ${Math.round(st.res[r[0]])}</h2><p class="body">${r[2]}</p><p class="body">As things stand, tonight takes <b>${num1(f)}</b>. ${st.res[r[0]] + f * (RULES.DAYS - st.day + 1) < 0 ? 'At this rate it runs out before the surface is safe: live a little less lavishly, or cut the rations.' : 'At this rate it lasts.'}</p>`); break; }
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
