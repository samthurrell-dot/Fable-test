// ui/main.js
// The screen. Reads the game state from engine/sim.js and draws three things: the bar (day and
// stores), the silo (who is where) and the desk (today's cards). All input comes through one click
// handler on elements marked data-act. The rules never touch the DOM and the screen never changes
// the rules' numbers directly.
//
// URL controls (for looking at exact moments):
//   ?card=<inherited|bought|force|vote|founder>   start a run at once     ?seed=<n>  the same run again
//   ?day=<n>      play to the morning of day n with the sensible auto-player
//   ?view=<event|order|night>   step that far into the day               ?end=<ending id>  show an ending
//   ?still=1      no ambient motion

import { RULES, PROMISES, newRun, openEvent, eventView, choose, order, orderList, promiseList, promiseText, endDay } from '../engine/sim.js';
import { POLICIES, playOut } from '../engine/auto.js';
import { ROLES, TRAITS, STAGES } from '../data/staff.js';
import { CARDS, cardById } from '../data/cards.js';
import { ENDINGS } from '../data/text.js';
import { faceSVG, MOOD_WORDS } from './faces.js';
import { createSilo, ZONES } from './silo.js';
import { createSound } from './sound.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app'), bar = $('#bar'), desk = $('#desk'), sheet = $('#sheet'), sheetBody = $('#sheet-body'), strip = $('#strip');
const params = new URLSearchParams(location.search);
const calm = params.has('still') || matchMedia('(prefers-reduced-motion: reduce)').matches;
if (calm) app.classList.add('calm');
const NIGHT_MS = calm ? 250 : 1700;      // how long lights-out lasts on screen

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window: play on without saving */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* nothing to do */ } },
};

const sound = createSound();
const silo = createSilo($('#silo'));
let st = null;            // the run in play
let busy = false;         // true during lights-out
let attract = null;       // timer for the title screen's wandering pawns

// --- small drawing helpers --------------------------------------------------------------------------

const ICON = {
  food: '<svg viewBox="0 0 16 16"><rect x="3" y="3.5" width="10" height="10" rx="1.6" fill="currentColor"/><ellipse cx="8" cy="3.8" rx="5" ry="1.7" fill="currentColor" stroke="var(--paper)" stroke-width="0.9"/><rect x="3" y="7" width="10" height="3" fill="var(--paper)" opacity="0.45"/></svg>',
  water: '<svg viewBox="0 0 16 16"><path d="M8 1.5 Q13 8 13 10.5 a5 5 0 0 1 -10 0 Q3 8 8 1.5 Z" fill="currentColor"/></svg>',
  power: '<svg viewBox="0 0 16 16"><path d="M9.5 1 L3.5 9 H7.5 L6.5 15 L12.5 7 H8.5 Z" fill="currentColor"/></svg>',
  med: '<svg viewBox="0 0 16 16"><path d="M6 2 H10 V6 H14 V10 H10 V14 H6 V10 H2 V6 H6 Z" fill="currentColor"/></svg>',
  lux: '<svg viewBox="0 0 16 16"><path d="M4 2.5 H12 L15 6.5 L8 14.5 L1 6.5 Z" fill="currentColor"/><path d="M1 6.5 H15 M5.5 6.5 L8 14.5 L10.5 6.5 M5.5 6.5 L4 2.5 M10.5 6.5 L12 2.5" stroke="var(--paper)" stroke-width="0.7" fill="none" opacity="0.6"/></svg>',
  scroll: '<svg viewBox="0 0 16 16"><path d="M4 2 H12 a1.5 1.5 0 0 1 1.5 1.5 V12 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V3 a1 1 0 0 1 1 -1 Z" fill="currentColor"/><path d="M5.5 5.5 H11 M5.5 8 H11 M5.5 10.5 H9" stroke="var(--paper)" stroke-width="1"/></svg>',
  sound: '<svg viewBox="0 0 16 16"><path d="M2 6 H5 L9 2.5 V13.5 L5 10 H2 Z" fill="currentColor"/><path d="M11 5.5 Q13 8 11 10.5 M12.6 3.6 Q16 8 12.6 12.4" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>',
  mute: '<svg viewBox="0 0 16 16"><path d="M2 6 H5 L9 2.5 V13.5 L5 10 H2 Z" fill="currentColor"/><path d="M11.2 5.8 L15 10.2 M15 5.8 L11.2 10.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  menu: '<svg viewBox="0 0 16 16"><path d="M2.5 4 H13.5 M2.5 8 H13.5 M2.5 12 H13.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};
const RES = [
  ['food', 'Food', 'Feeds everyone each night. The farm grows some of it back. Drained by staff, banquets and crop failures.'],
  ['water', 'Water', 'Drinking, crops and your hot tub. The plant recycles most of it. Drained by leaks, sabotage and the hot tub.'],
  ['power', 'Power', 'Runs the air, the lights and the cameras. Drained by cameras, luxury rooms and breakdowns.'],
  ['med', 'Medicine', 'Treats injury and illness. Drained by accidents, poisonings and rationing choices.'],
  ['lux', 'Luxury', 'Your comfort and status: wine, art, gold taps. It also pays for perks and informants. Nothing new comes in.'],
];
// What each tool gets you and what it costs, in the words of the design outline.
const TOOL_INFO = {
  perk: ['Loyalty up quickly, for one person.', 'Luxury. The others notice who got it, and each perk to the same person works less.'],
  cameras: ['You see where people really are, by day and at night, and who was near anything that breaks.', 'Power every night, and everyone’s loyalty drops a little for as long as they are on.'],
  camerasOff: ['Saves power, and the slow loss of loyalty stops.', 'You stop seeing where anybody goes.'],
  informant: ['A plain report on one person every morning.', 'Luxury now and every night. The informant might lie, or be found out, which is a scandal.'],
  test: ['You find out today whether one person is loyal.', 'A loyal person is offended to be tested. A disloyal one learns that you know.'],
  example: ['Fear goes up for everyone.', 'Loyalty goes down for everyone. The person may want revenge, and proud people always do.'],
  exile: ['Removes a problem for good.', 'You lose their skills: the job is done badly from then on. The others are horrified.'],
  speech: ['A small loyalty boost for everyone, and a calmer bunker.', 'Nothing but your dignity. Each speech works less than the last.'],
};
const toolInfo = (id) => { const i = TOOL_INFO[id === 'cameras' && st.cameras ? 'camerasOff' : id]; return i ? `<dl class="trade"><dt>What you get</dt><dd>${i[0]}</dd><dt>What it costs</dt><dd>${i[1]}</dd></dl>` : ''; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v) => (v > 0 ? '+' : '−') + Math.abs(Math.round(v));
const chips = (delta) => Object.entries(delta || {}).filter(([, v]) => Math.abs(v) >= 0.5).map(([k, v]) => `<span class="chip r-${k} ${v > 0 ? 'up' : 'down'}">${ICON[k]}${num(v)}</span>`).join('');
const person = (role) => st.staff.find((p) => p.role === role);
const moodOf = (p) => (p.status === 'dead' ? 'dead' : p.status === 'exiled' ? 'flat' : p.face || 'flat');
const whoChip = (p) => `<button type="button" class="who" data-act="dossier" data-role="${p.role}">${faceSVG(p.role, moodOf(p))}<span>${esc(p.first)}</span></button>`;
// Text from the rules, with every staff name turned into a face you can tap.
function rich(text) {
  let s = esc(text);
  if (!st) return s;
  const names = st.staff.map((p) => p.first).join('|');
  return s.replace(new RegExp(`(^|[^\\w>])(${names})(?![\\w<])`, 'g'), (m, pre, n) => pre + whoChip(st.staff.find((p) => p.first === n)));
}
const trueFace = (p) => (p.status === 'dead' ? 'dead' : p.loyalty >= 66 ? 'happy' : p.loyalty >= 52 ? 'content' : p.loyalty >= 40 ? 'flat' : p.loyalty >= 27 ? 'sour' : 'angry');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// --- the bar ----------------------------------------------------------------------------------------

function renderBar(delta = {}) {
  if (!st) { bar.innerHTML = `<div class="brand">Bunker Billionaire</div><div class="bar-right">${soundButton()}</div>`; return; }
  const owed = st.promises.filter((p) => p.state === 'owed' || p.state === 'forgotten');
  const next = owed.filter((p) => p.due).sort((a, b) => a.due - b.due)[0];
  const soon = next && next.due - st.day <= 2;
  bar.innerHTML = `<button type="button" class="day" data-act="menu" aria-label="Day ${st.day} of ${RULES.DAYS}. Open the menu"><b>${Math.min(st.day, RULES.DAYS)}</b><span>of ${RULES.DAYS}</span></button>
    <div class="stores">${RES.map(([k, name]) => {
    const v = st.res[k], d = delta[k];
    return `<button type="button" class="store r-${k}${v < 12 ? ' low' : ''}" data-act="res" data-k="${k}" aria-label="${name}: ${Math.round(v)}">${ICON[k]}<b>${Math.round(v)}</b><i style="--v:${Math.min(1, v / 70)}"></i>${d && Math.abs(d) >= 0.5 ? `<em class="${d > 0 ? 'up' : 'down'}">${num(d)}</em>` : ''}</button>`;
  }).join('')}</div>
    <div class="bar-right"><button type="button" class="ledger${soon ? ' soon' : ''}" data-act="ledger" aria-label="${owed.length} promises owed">${ICON.scroll}<b>${owed.length}</b></button>${soundButton()}</div>`;
}
const soundButton = () => `<button type="button" class="snd${sound.on ? ' on' : ''}" data-act="sound" aria-label="${sound.on ? 'Turn sound off' : 'Enable sound'}">${sound.on ? ICON.sound : ICON.mute}<span>${sound.on ? 'Sound on' : 'Enable sound'}</span></button>`;

// --- the silo ---------------------------------------------------------------------------------------

function siloView(night) {
  const over = st.phase === 'ended' ? st.ending.id : '';
  const kind = over.split('_')[0];
  const staff = st.staff.map((p) => {
    let zone = ROLES[p.role].post, unseen = false;
    if (p.status === 'exiled') zone = 'surface';
    else if (kind === 'king' || kind === 'word' || over === 'deposed_hatch') zone = 'surface';
    else if (night) { if (st.cameras) zone = p.night || 'bunks'; else { zone = 'bunks'; unseen = true; } } else if (st.cameras && p.room) zone = p.room;
    return {
      role: p.role, status: p.status, zone, unseen, mood: kind === 'everyone' ? 'dead' : over ? trueFace(p) : moodOf(p), label: `${p.name}, ${p.title}`,
      badge: over ? '' : p.exposed ? 'alert' : st.informant === p.role ? 'eye' : '', down: kind === 'everyone',
    };
  });
  const you = { zone: 'you', mood: 'smug', down: kind === 'killed' || kind === 'everyone', label: 'You' };
  if (over === 'deposed_vote') you.zone = 'kitchen';
  if (over === 'deposed_mutiny') you.zone = 'bunks';
  if (over === 'deposed_lockout') you.zone = 'cell';
  if (over === 'deposed_surface' || kind === 'king' || kind === 'word') you.zone = 'surface';
  if (kind === 'deposed' || kind === 'killed' || kind === 'everyone') you.mood = kind === 'deposed' ? 'sour' : 'dead';
  return { staff, you, cameras: st.cameras, night: night || kind === 'everyone', res: st.res, ending: kind };
}
function renderSilo(night = false) {
  if (!st) { strip.innerHTML = '<span>Tap a face to open that person’s file, once you are in charge</span>'; return; }
  silo.update(siloView(night));
  const inf = st.informant ? person(st.informant) : null;
  strip.innerHTML = `<button type="button" data-act="roster">Staff files</button><span class="${st.cameras ? 'on' : ''}">${st.cameras ? 'Cameras on' : 'Cameras off'}</span><span class="${inf ? 'on' : ''}">${inf ? `Informant on ${esc(inf.first)}` : 'No informant'}</span>`;
}
function roster() {
  openSheet(`<h2>Staff files</h2><p class="fine">A face each morning and whatever was last heard. Some of it is wrong.</p><ul class="picker">${st.staff.map((p) => `<li><button type="button" data-act="dossier" data-role="${p.role}">${faceSVG(p.role, moodOf(p))}<span><b>${esc(p.name)}</b><small>${esc(p.title)} · ${TRAITS[p.trait].name.toLowerCase()}${p.status !== 'ok' ? ` · ${p.status}` : ''}</small>${p.rumour && p.status === 'ok' ? `<small class="r">${esc(p.rumour.text)}</small>` : ''}</span></button></li>`).join('')}</ul>`);
}
// A ring round the pawn that today's card is about, so the card and the picture are tied together.
function ping(role) {
  const el = $(`.pawn[data-role="${role}"]`);
  if (!el || calm) return;
  el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping');
}

// Title screen: nobody is in charge yet, and the staff wander.
function startAttract() {
  const roles = Object.keys(ROLES), zones = Object.keys(ZONES).filter((z) => z !== 'surface' && z !== 'you' && z !== 'cell');
  const moods = ['happy', 'content', 'flat', 'sour', 'content', 'flat', 'grin', 'angry'];
  const state = roles.map((role, i) => ({ role, status: 'ok', zone: ROLES[role].post, mood: moods[i], label: ROLES[role].title }));
  const draw = () => silo.update({ staff: state, you: { zone: 'you', mood: 'smug' }, cameras: false, night: false, res: { food: 60, water: 52, power: 50, med: 30, lux: 45 } });
  draw();
  if (calm) return;
  attract = setInterval(() => {
    const p = state[Math.floor(Math.random() * state.length)];
    p.zone = Math.random() < 0.45 ? ROLES[p.role].post : zones[Math.floor(Math.random() * zones.length)];
    if (Math.random() < 0.3) p.mood = moods[Math.floor(Math.random() * moods.length)];
    draw();
  }, 1500);
}
function stopAttract() { clearInterval(attract); attract = null; }

// --- the desk ---------------------------------------------------------------------------------------

function renderTitle() {
  const save = store.get('bb.save', null), found = store.get('bb.endings', []);
  desk.innerHTML = `<article class="card title-card deal">
    <p class="kicker">Act 2 · a management game for one bunker</p>
    <h1>Bunker Billionaire</h1>
    <p class="lede">You run a luxury doomsday bunker in an old missile silo. Keep the place running, keep yourself comfortable, and stop your staff from overthrowing you. Thirty days until the surface is safe.</p>
    <p class="hintline">You will see faces and hear rumours. You will never see what anyone really thinks.</p>
    ${save && save.phase !== 'ended' ? `<button type="button" class="go" data-act="resume">Carry on from day ${save.day}</button>` : ''}
    <h2>How did you come to power?</h2>
    <div class="starts">${CARDS.map((c) => `<button type="button" class="start" data-act="start" data-card="${c.id}">
      <span class="level l-${c.level.toLowerCase()}">${c.level}</span><b>${esc(c.name)}</b>
      <em>${esc(c.line)}</em>
      <small>${esc(c.blurb)}</small>
      <small><i>You owe:</i> ${c.promises.length ? c.promises.map((t) => `“${esc(PROMISES[t].text)}”`).join(', ') : 'nothing'} · <i>Grudge:</i> ${esc(c.grudgeLine)}</small>
    </button>`).join('')}</div>
    <p class="fine">Endings found: ${found.length} of ${Object.keys(ENDINGS).length}. <button type="button" class="link" data-act="help">How to play</button></p>
  </article>`;
}

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
  const first = st.day === 1 ? `<p class="lede">${esc(card.line)}</p><p class="hintline">Tap a face in the silo to open that person’s file. The faces and the rumours are all you get: some are wrong.</p>` : '';
  desk.innerHTML = `<article class="card report deal">
    <header><span class="stamp">Day ${st.day} of ${RULES.DAYS}</span><h2>Morning report</h2></header>
    ${first}
    ${r.inc.length ? `<ul class="incidents">${r.inc.map((i) => `<li class="${i.kind}">${rich(i.text)}</li>`).join('')}</ul>` : ''}
    <p class="mood">${esc(r.mood)}</p>
    ${facesLine(r.faces)}
    ${r.cams ? `<p class="cams-line">${rich(r.cams)}</p>` : ''}
    ${r.informant ? `<p class="informant-line">${rich(r.informant.text)}</p>` : ''}
    ${r.rumours.length ? `<h3>Heard on the stairs</h3><ul class="rumours">${r.rumours.map((x) => `<li>${rich(x.text)}</li>`).join('')}</ul>` : ''}
    <button type="button" class="go" data-act="open">Today’s business</button>
  </article>`;
}

function renderEvent() {
  const v = eventView(st);
  const from = v.from ? person(v.from) : null;
  desk.innerHTML = `<article class="card memo deal${v.grim ? ' grim' : ''}">
    <header><span class="stamp">Day ${st.day} · today’s business</span>${from ? `<button type="button" class="from" data-act="dossier" data-role="${from.role}" aria-label="${esc(from.name)}">${faceSVG(from.role, moodOf(from))}</button>` : ''}<h2>${esc(v.title)}</h2></header>
    <p class="body">${rich(v.text)}</p>
    <div class="choices">${(from && ping(from.role), v.choices).map((c, i) => `<button type="button" class="choice" data-act="choose" data-i="${i}"${c.ok ? '' : ' disabled'}><span class="n">${i + 1}</span><span class="t">${esc(c.label)}${c.ok ? '' : `<small>${esc(c.why)}</small>`}</span><span class="costs">${chips(c.cost)}</span></button>`).join('')}</div>
  </article>`;
}

function renderOrder() {
  const r = st.result, list = orderList(st);
  const short = { perk: 'Give a perk', cameras: st.cameras ? 'Cameras off' : 'Cameras on', informant: 'Informant', test: 'Loyalty test', example: 'Make an example', exile: 'Exile', speech: 'Speech', promise: 'Promise' };
  const group = (gname) => `<div class="tgroup g-${gname.toLowerCase()}"><span>${gname}</span><div>${list.filter((o) => o.group === gname).map((o) => `<button type="button" class="tool" data-act="tool" data-id="${o.id}"${o.ok ? '' : ' disabled'} title="${esc(o.ok ? o.hint : o.why)}">${short[o.id]}${chips(o.cost)}</button>`).join('')}</div></div>`;
  const tools = st.orderUsed
    ? `<p class="body order-text">${rich(st.orderText)}</p><div class="costs">${chips(st.orderDelta)}</div>`
    : `<div class="tools"><div class="tcol">${group('Watch')}</div><div class="tcol">${group('Spend')}${group('Promise')}</div>${group('Punish')}</div>`;
  desk.innerHTML = `<article class="card result deal">
    <header><span class="stamp done">You chose</span><h2>${esc(r.choice)}</h2></header>
    <p class="body">${rich(r.text)}</p><div class="costs">${chips(r.delta)}</div>
  </article>
  <article class="card orders deal d2">
    <header><h2>${st.orderUsed ? 'Your order' : 'One order before lights out'}</h2></header>
    ${!st.orderUsed && st.day <= 2 ? '<p class="hintline">One order a day, or none. Every tool helps in one way and costs you in another: tap one to read it first.</p>' : ''}
    ${tools}
    <button type="button" class="go" data-act="night">${st.orderUsed ? 'Lights out' : 'No orders. Lights out'}</button>
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
  const fate = (p) => (p.status === 'exiled' ? 'Exiled to the surface.' : p.status === 'dead' ? 'Died in the bunker.' : `Was ${STAGES[p.stage]}.`);
  const kept = st.promises.filter((p) => p.state === 'kept').length, broken = st.promises.filter((p) => p.state === 'broken').length, dodged = st.promises.filter((p) => p.state === 'forgotten' || (p.state === 'owed' && p.due)).length;
  desk.innerHTML = `<article class="card ending k-${kind} deal">
    <header><span class="stamp">${esc(e.kind)}</span><h1>${esc(e.title)}</h1></header>
    <p class="body">${esc(e.text)}</p>
    <p class="fine">${st.day >= RULES.DAYS && (kind === 'king' || kind === 'word' || st.ending.id === 'deposed_hatch') ? `All ${RULES.DAYS} days` : `Day ${st.day} of ${RULES.DAYS}`} · ${esc(card.name)} · promises kept ${kept}, broken ${broken}, dodged ${dodged} · perks ${s.perks} · examples ${s.examples} · exiles ${s.exiles}</p>
    <h3>What you never saw</h3>
    <p class="fine key"><span class="k-loy"></span> loyalty <span class="k-fear"></span> fear, day by day</p>
    <ul class="reveal">${st.staff.map((p) => `<li>${faceSVG(p.role, trueFace(p))}<div><b>${esc(p.name)}</b><small>${esc(p.title)} · ${esc(TRAITS[p.trait].name.toLowerCase())}</small><small class="fate s${p.status === 'ok' ? p.stage : 'x'}">${fate(p)}</small></div>${spark(p)}</li>`).join('')}</ul>
    <div class="row"><button type="button" class="go" data-act="again">Run it again</button><button type="button" class="go ghost" data-act="title">Another start</button></div>
  </article>`;
}

function render(delta) {
  app.dataset.phase = st ? st.phase : 'title';
  renderBar(delta);
  renderSilo(false);
  if (!st) { renderTitle(); return; }
  if (st.phase === 'report') renderReport();
  else if (st.phase === 'event') renderEvent();
  else if (st.phase === 'order') renderOrder();
  else if (st.phase === 'ended') renderEnding();
  desk.scrollTop = 0;
}

// --- sheets (the drawer that slides up over the desk) --------------------------------------------------

function openSheet(html) { sheetBody.innerHTML = html; sheet.hidden = false; sound.play('sheet'); requestAnimationFrame(() => sheet.classList.add('open')); }
function closeSheet() { sheet.classList.remove('open'); sheet.hidden = true; }

function dossier(role) {
  if (role === 'you') {
    const word = st.word >= 1.15 ? 'good. They have seen you keep it.' : st.word >= 0.8 ? 'untested.' : st.word >= 0.4 ? 'worth less than it was.' : 'worth nothing.';
    return openSheet(`<div class="dossier"><div class="who-head">${faceSVG('you', 'smug')}<div><h2>You</h2><p>Owner, and for now ruler, of the bunker</p></div></div>
      <dl><dt>How you got here</dt><dd>${esc(cardById(st.card).name)}. ${esc(cardById(st.card).line)}</dd><dt>Your word is</dt><dd>${word}</dd><dt>Cameras</dt><dd>${st.cameras ? 'On. You see where people really are, by day and by night.' : 'Off. You see people at their posts and nothing at night.'}</dd></dl></div>`);
  }
  const p = person(role), R = { ...ROLES[role] };
  const here = p.status === 'ok';
  const met = here && ROLES[role].wantMet(st, p);
  const canOrder = st.phase === 'order' && !st.orderUsed && here;
  const acts = canOrder ? orderList(st).filter((o) => o.target).map((o) => `<button type="button" class="tool" data-act="${o.id === 'exile' || o.id === 'example' ? 'confirm' : 'do'}" data-id="${o.id}" data-role="${role}"${o.ok ? '' : ' disabled'}>${esc(o.name)}${chips(o.cost)}</button>`).join('')
    + (promiseList(st).find((o) => o.type === 'bunk').ok ? `<button type="button" class="tool" data-act="do" data-id="promise" data-type="bunk" data-role="${role}">Promise the next bunk upgrade</button>` : '') : '';
  openSheet(`<div class="dossier"><div class="who-head">${faceSVG(role, moodOf(p))}<div><h2>${esc(p.name)}</h2><p>${esc(p.title)}</p></div></div>
    <p class="moodline">${p.status === 'exiled' ? 'Exiled to the surface.' : p.status === 'dead' ? 'Dead.' : `Looks <b>${MOOD_WORDS[p.face] || 'hard to read'}</b> this morning.${p.face === 'grin' ? ' Frightened people all smile like that.' : ''}`}</p>
    <dl><dt>Keeps running</dt><dd>${esc(R.keeps)}</dd><dt>If they turn</dt><dd>${esc(R.danger)}</dd>
    <dt>Known for</dt><dd><b>${TRAITS[p.trait].name}.</b> ${TRAITS[p.trait].note}</dd>
    <dt>Wants</dt><dd>${esc(p.wantText)} ${here ? `<span class="met ${met ? 'yes' : 'no'}">${met ? 'has it' : 'not getting it'}</span>` : ''}</dd></dl>
    ${p.rumour ? `<h3>Last heard</h3><p class="rumour${p.rumour.informant ? ' inf' : ''}">${esc(p.rumour.text)} <small>day ${p.rumour.day}</small></p>` : ''}
    ${p.tested ? `<p class="rumour">Loyalty test, day ${p.tested.day}: <b>${p.tested.loyal ? 'loyal' : 'not loyal'}</b>.</p>` : ''}
    ${st.informant === role ? '<p class="rumour inf">Your informant is watching them.</p>' : ''}
    ${p.notes && p.notes.length ? `<h3>On file</h3><ul class="notes">${p.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${acts ? `<h3>Today’s order</h3><div class="acts">${acts}</div>` : ''}</div>`);
}

function pickWho(id, type) {
  const o = orderList(st).find((x) => x.id === id);
  const title = type === 'bunk' ? 'Who is promised the next bunk upgrade?' : `${o.name}: who?`;
  openSheet(`<h2>${esc(title)}</h2>${type === 'bunk' ? `<p class="fine">Cost of keeping it: ${esc(PROMISES.bunk.cost)}</p>` : toolInfo(id)}<ul class="picker">${st.staff.filter((p) => p.status === 'ok').map((p) => `<li><button type="button" data-act="${id === 'exile' || id === 'example' ? 'confirm' : 'do'}" data-id="${id}" data-role="${p.role}"${type ? ` data-type="${type}"` : ''}>${faceSVG(p.role, moodOf(p))}<span><b>${esc(p.name)}</b><small>${esc(p.title)} · ${TRAITS[p.trait].name.toLowerCase()}</small>${p.rumour ? `<small class="r">${esc(p.rumour.text)}</small>` : ''}</span></button></li>`).join('')}</ul>`);
}
function pickPromise() {
  openSheet(`<h2>Make a promise</h2><p class="fine">Loyalty goes up at once and costs nothing today. Keep it later and trust builds. Break it and everyone who heard it remembers.</p><ul class="picker">${promiseList(st).map((o) => `<li><button type="button" data-act="${o.target ? 'who' : 'do'}" data-id="promise" data-type="${o.type}"${o.ok ? '' : ' disabled'}><span><b>“${esc(o.name)}”</b><small>Cost of keeping it: ${esc(o.cost)}</small><small>${o.ok ? (o.due ? `Falls due in ${o.due} days` : 'Stands until the hatch opens') : esc(o.why)}</small></span></button></li>`).join('')}</ul>`);
}
function ledger() {
  const label = { owed: 'owed', kept: 'kept', broken: 'broken', forgotten: 'quietly forgotten', void: 'no longer matters' };
  openSheet(`<h2>Promises</h2>${st.promises.length ? `<ul class="ledger-list">${st.promises.map((p) => `<li class="p-${p.state}"><b>“${esc(promiseText(st, p))}”</b><small>${label[p.state]}${p.state === 'owed' ? (p.due ? ` · due day ${p.due}` : ' · stands until the hatch opens') : ''}</small><small>Cost of keeping it: ${esc(PROMISES[p.type].cost)}</small></li>`).join('')}</ul>` : '<p class="fine">You have promised nothing. Yet.</p>'}<p class="fine">A promise is the quickest way out of trouble, and a debt.</p>`);
}
function help() {
  openSheet(`<h2>How to play</h2><div class="help">
    <p><b>One turn is one day.</b> Read the morning report, deal with today’s business, give one order if you want to, then lights out. Last ${RULES.DAYS} days.</p>
    <p><b>The stores are a closed system.</b> Nothing new comes in. Everything you spend on luxury is taken from survival. If the food, water or power runs out and stays out, everyone dies.</p>
    <p><b>You never see what people think.</b> Each person has hidden loyalty and fear. You see a face each morning and hear rumours; both can be wrong, and frightened people smile whatever they feel.</p>
    <p><b>People act against you only when loyalty is low and fear is low enough to dare.</b> It goes in steps: grumbling, slacking, breaking things, theft, organising, and then an attempt on you or a mutiny. Each step leaves signs.</p>
    <p><b>Every tool costs something.</b> Perks cost luxury. Cameras cost power and goodwill. Punishment buys fear with loyalty. Promises cost nothing today.</p>
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
function begin(cardId, seed) {
  stopAttract();
  st = newRun(cardId, seed);
  save(); sound.play('morning'); render();
}
function doOrder(id, arg) {
  const text = order(st, id, arg);
  if (text === null) return;
  closeSheet();
  sound.play({ perk: 'coin', example: 'stamp', exile: 'stamp', speech: 'good', promise: 'promise', cameras: 'lights', informant: 'coin', test: 'tap' }[id] || 'tap');
  save(); render(st.orderDelta);
}
async function lightsOut() {
  if (busy || st.phase !== 'order') return;
  busy = true; closeSheet();
  sound.play('lights'); sound.play('night');
  app.dataset.phase = 'night';
  renderSilo(true);
  desk.innerHTML = `<article class="card nightcard deal"><header><span class="stamp">Night ${st.day}</span><h2>Lights out</h2></header><p class="body">${st.cameras ? 'The cameras watch the corridors.' : 'You cannot see where anybody goes.'} The silo uses up its supplies.</p></article>`;
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
    case 'sound': sound.on ? sound.stop() : sound.start(); if (sound.on) sound.play('good'); renderBar(); if (!st) renderTitle(); break;
    case 'start': begin(d.card, params.has('seed') ? +params.get('seed') : undefined); break;
    case 'resume': stopAttract(); st = store.get('bb.save', null); sound.play('card'); render(); break;
    case 'open': openEvent(st); save(); sound.play(eventView(st).grim ? 'alarm' : 'card'); render(); break;
    case 'choose': choose(st, +d.i); sound.play('stamp'); if (st.phase === 'ended') finish(); else save(); render(st.result ? st.result.delta : {}); break;
    case 'tool': {
      const o = orderList(st).find((x) => x.id === d.id);
      if (o.id === 'promise') pickPromise(); else if (o.target) pickWho(o.id);
      else openSheet(`<h2>${esc(o.name)}</h2>${toolInfo(o.id)}<div class="row"><button type="button" class="go" data-act="do" data-id="${o.id}">${esc(o.name)}</button><button type="button" class="go ghost" data-act="close">Not today</button></div>`);
      break;
    }
    case 'who': pickWho(d.id, d.type); break;
    case 'confirm': {
      const p = person(d.role), exile = d.id === 'exile';
      openSheet(`<h2>${exile ? 'Exile' : 'Make an example of'} ${esc(p.first)}?</h2><p class="body">${exile ? `${esc(p.first)} goes up the lift and does not come back. You lose ${esc(ROLES[p.role].keeps.toLowerCase())} done properly, and the others will not forget it.` : `Everyone will be more afraid of you, and everyone will like you less. ${esc(p.first)} most of all.`}</p><div class="row"><button type="button" class="go danger" data-act="do" data-id="${d.id}" data-role="${d.role}">${exile ? 'Exile' : 'Do it'}</button><button type="button" class="go ghost" data-act="close">Not today</button></div>`);
      break;
    }
    case 'do': doOrder(d.id, { role: d.role, type: d.type }); break;
    case 'night': lightsOut(); break;
    case 'dossier': if (st) { sound.play('tap'); dossier(d.role); } break;
    case 'ledger': ledger(); break;
    case 'roster': roster(); break;
    case 'res': { const r = RES.find((x) => x[0] === d.k); openSheet(`<h2 class="r-${r[0]}">${ICON[r[0]]} ${r[1]}: ${Math.round(st.res[r[0]])}</h2><p class="body">${r[2]}</p>`); break; }
    case 'menu': menu(); break;
    case 'help': help(); break;
    case 'close': closeSheet(); break;
    case 'again': { const c = st.card; begin(c); break; }
    case 'abandon': store.del('bb.save'); // falls through to the title
    case 'title': closeSheet(); st = null; render(); startAttract(); break;
    default: break;
  }
});
// a pawn in the silo opens that person's file
$('#silo').addEventListener('click', (ev) => { const b = ev.target.closest('.pawn'); if (b && st && !busy) { sound.play('tap'); dossier(b.dataset.role); } });
sheet.addEventListener('click', (ev) => { if (ev.target === sheet) closeSheet(); });
addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') return closeSheet();
  if (!st || busy || !sheet.hidden) return;
  if (st.phase === 'event' && ['1', '2', '3', '4'].includes(ev.key)) { const b = desk.querySelectorAll('.choice')[+ev.key - 1]; if (b) b.click(); }
  if (ev.key === 'Enter' && !ev.target.closest('button')) { const b = desk.querySelector('.go'); if (b) b.click(); }
});

// --- start ------------------------------------------------------------------------------------------

function boot() {
  const card = params.get('card'), end = params.get('end');
  if (card || params.has('day') || end) {
    st = newRun(card || 'inherited', params.has('seed') ? +params.get('seed') : 20261113);
    const day = Math.min(RULES.DAYS, +params.get('day') || 1);
    let s = 99;
    const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    if (day > 1) playOut(st, POLICIES.careful, r, day);
    const view = params.get('view');
    if (st.phase === 'report' && (view === 'event' || view === 'order' || view === 'night')) openEvent(st);
    if (st.phase === 'event' && (view === 'order' || view === 'night')) choose(st, POLICIES.careful.event(st, eventView(st), r));
    if (end && ENDINGS[end]) { st.ending = { id: end, day: st.day }; st.phase = 'ended'; }
    render();
    if (view === 'night' && st.phase === 'order') { app.dataset.phase = 'night'; renderSilo(true); }
    return;
  }
  render();
  startAttract();
}
boot();
window.__bb = { get st() { return st; }, set st(v) { st = v; render(); }, render, sound, silo };
