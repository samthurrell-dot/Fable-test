// src/sound.js
// All sound is made in code with WebAudio. Nothing plays until start() is called from a click.
//
// The birds lead; the wind stays behind them. Wind here is not a steady rush (that sounds like
// a road). It is leaves: a bright hiss that swells in gusts and falls away to almost nothing,
// with a softer body of moving air under it. In winter the leaves are gone and only a thin
// breath through bare twigs is left.
//
// Each bird is a singer with its own place (left or right, near or far), its own few phrases
// that it repeats, as real birds do, and its own months. Far singers are quieter, duller and
// carry more echo. Some sounds are tied to what is on screen: the squirrel's claws on bark,
// wings at take-off, geese as the flock goes over.

const MASTER_GAIN = 0.55;        // overall loudness
const LEAF_HISS = 0.085;         // loudness of the leaves at the top of a gust, in full leaf
const LEAF_BAND = [2600, 5200];  // the hiss sweeps between these frequencies (Hz) as a gust rises
const LEAF_WIDTH = 0.6;          // how far left and right the two halves of the crown sit (0 = centre, 1 = hard to each side)
const AIR_BODY = 0.022;          // loudness of the soft moving-air layer
const AIR_BAND = [450, 900];     // its frequency range (Hz)
const BARE_TWIGS = 0.012;        // loudness of the winter breath through bare twigs
const LULL = 0.06;               // how much wind is left between gusts (0 = silence)
const RUSTLE_GAP = [0.2, 1.0];   // seconds between dry-leaf rustles in mid autumn
const ECHO_SECONDS = 1.5;        // length of the open-air echo
const ECHO_LEVEL = 0.5;          // loudness of the echo as a whole
const SNOW_HUSH = 4200;          // snow soaks up high sound: the birds' top end drops by this many Hz under full snow

// The singers. pan: -1 left .. 1 right. far: 0 beside you .. 1 across the meadow.
// gap: seconds of quiet between phrases when the bird is in full voice.
// months(y) says how keen it is to sing at time of year y (0 = start of spring, 0.5 = start of autumn).
const hump = (y, a, b, edge = 0.04) => Math.max(0, Math.min(1, (y - a) / edge, (b - y) / edge));
const SINGERS = [
  { kind: 'sparrow', pan: 0.25, far: 0.1, gap: [1.4, 5.0], months: (y) => Math.max(hump(y, -0.02, 0.5, 0.1), 0.25 * hump(y, 0.5, 0.75)) },
  { kind: 'robin', pan: -0.5, far: 0.3, gap: [4, 9], months: (y) => Math.max(hump(y, 0, 0.3, 0.06), 0.45) },                 // sings all winter
  { kind: 'blackbird', pan: 0.6, far: 0.55, gap: [5, 11], months: (y) => hump(y, 0.02, 0.4, 0.06) },
  { kind: 'greatTit', pan: -0.2, far: 0.4, gap: [5, 12], months: (y) => Math.max(hump(y, -0.1, 0.28, 0.06), hump(y, 0.9, 1.1, 0.06)) },
  { kind: 'chaffinch', pan: 0.8, far: 0.45, gap: [7, 14], months: (y) => hump(y, 0.05, 0.38, 0.05) },
  { kind: 'blueTit', pan: -0.75, far: 0.2, gap: [6, 13], months: (y) => Math.max(hump(y, 0, 0.45, 0.06), 0.3 * hump(y, 0.8, 1.1)) },
  { kind: 'chiffchaff', pan: 0.1, far: 0.6, gap: [8, 16], months: (y) => hump(y, 0.06, 0.3, 0.04) },
  { kind: 'pigeon', pan: -0.6, far: 0.8, gap: [10, 22], months: (y) => hump(y, 0.12, 0.6, 0.06) },
  { kind: 'cuckoo', pan: 0.5, far: 1, gap: [18, 40], months: (y) => hump(y, 0.1, 0.24, 0.03) },
  { kind: 'woodpecker', pan: -0.85, far: 0.9, gap: [14, 30], months: (y) => Math.max(hump(y, -0.1, 0.12, 0.04), hump(y, 0.93, 1.1, 0.04)) },
  { kind: 'crow', pan: 0.7, far: 0.95, gap: [12, 28], months: (y) => hump(y, 0.5, 1.02, 0.06) },
];

export function createSound() {
  let ctx = null, master = null, white = null, on = false;
  let leafL = null, leafR = null, air = null, twigs = null;
  let echo = null, hush = null, near = null, singers = [];
  let nextRustle = 0, nextBee = 0, nextHopper = 0, nextClaw = 0, nextHonk = 0, lastMode = '';

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  function whiteNoise(seconds) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // The echo of open country: no walls, just a soft, short tail coming back off the tree line.
  function echoImpulse() {
    const n = Math.floor(ctx.sampleRate * ECHO_SECONDS);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let low = 0;
      for (let i = 0; i < n; i++) {
        const t = i / ctx.sampleRate;
        low += (Math.random() * 2 - 1 - low) * 0.35;              // take the hard top off
        d[i] = low * Math.exp(-t / 0.32) * (t < 0.03 ? t / 0.03 : 1);
      }
      for (let k = 0; k < 5; k++) {                               // a few distinct returns
        const at = Math.floor((0.09 + 0.11 * k + Math.random() * 0.05) * ctx.sampleRate);
        if (at < n) d[at] += (0.5 - 0.08 * k) * (Math.random() < 0.5 ? 1 : -1);
      }
    }
    return buf;
  }

  function panner(pan) {
    if (!ctx.createStereoPanner) return ctx.createGain();
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    return p;
  }

  // A place to make sound from: returns a node to play into. far 0..1 sets loudness, dullness and echo.
  function place(pan, far) {
    const input = ctx.createGain();
    const dull = ctx.createBiquadFilter();
    dull.type = 'lowpass'; dull.frequency.value = 11000 - 6500 * far;
    const p = panner(pan);
    const dry = ctx.createGain(), wet = ctx.createGain();
    dry.gain.value = 1 - 0.6 * far; wet.gain.value = 0.1 + 0.4 * far;
    input.connect(dull); dull.connect(p); p.connect(dry); p.connect(wet);
    dry.connect(hush); wet.connect(echo);
    return { input, pan: p };
  }

  // One layer of wind: looping white noise through a band filter into its own gain.
  function layer(type, freq, q, pan = 0) {
    const src = ctx.createBufferSource();
    src.buffer = white; src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;   // so the layers never line up
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const p = panner(pan);
    src.connect(filter); filter.connect(gain); gain.connect(p); p.connect(master);
    src.start(0, Math.random() * 2);
    return { filter, gain };
  }

  function start() {
    if (ctx) { ctx.resume(); on = true; master.gain.setTargetAtTime(MASTER_GAIN, ctx.currentTime, 0.3); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    const limit = ctx.createDynamicsCompressor();          // only catches the odd pile-up of voices
    limit.threshold.value = -10; limit.ratio.value = 6; limit.attack.value = 0.004; limit.release.value = 0.2;
    master.connect(limit); limit.connect(ctx.destination);
    white = whiteNoise(3);
    hush = ctx.createBiquadFilter();
    hush.type = 'lowpass'; hush.frequency.value = 12000;
    hush.connect(master);
    echo = ctx.createConvolver();
    echo.buffer = echoImpulse();
    const echoGain = ctx.createGain();
    echoGain.gain.value = ECHO_LEVEL;
    echo.connect(echoGain); echoGain.connect(hush);

    // The crown is wide: its left and right halves gust a moment apart.
    leafL = layer('bandpass', LEAF_BAND[0], 0.7, -LEAF_WIDTH);
    leafR = layer('bandpass', LEAF_BAND[0], 0.7, LEAF_WIDTH);
    air = layer('bandpass', AIR_BAND[0], 0.9);
    twigs = layer('bandpass', 1100, 5);

    singers = SINGERS.map((s) => ({ ...s, out: place(s.pan, s.far).input, next: ctx.currentTime + rand(0.3, s.gap[1]), songs: [] }));
    near = place(0, 0.05);                                 // things that happen close by and move about
    master.gain.setTargetAtTime(MASTER_GAIN, ctx.currentTime, 0.6);
    on = true;
  }

  function stop() {
    if (!ctx) return;
    on = false;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  }

  // One whistled note that slides from f0 to f1. vib = depth of a fast warble (share of pitch), at vibHz.
  function note(out, t0, f0, f1, dur, level, o = {}) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 30), t0 + dur * 0.85);
    const attack = o.attack || Math.min(0.012, dur * 0.2);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(level, t0 + attack);
    if (o.hold) g.gain.setValueAtTime(level, t0 + dur * o.hold);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    osc.connect(g); g.connect(out);
    if (o.vib) {
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = o.vibHz || 28;
      depth.gain.value = f0 * o.vib;
      lfo.connect(depth); depth.connect(osc.frequency);
      lfo.start(t0); lfo.stop(t0 + dur + 0.02);
    }
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  // A short burst of filtered hiss: wings, claws, leaves, a woodpecker's knock.
  function puff(out, t0, dur, level, type, freq, q = 1) {
    const src = ctx.createBufferSource();
    src.buffer = white;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(level, t0 + Math.min(0.004, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t0, Math.random() * 2); src.stop(t0 + dur + 0.02);
  }

  // A rough voice (crow, goose): a buzzy tone squeezed through a narrow band.
  function squawk(out, t0, f0, f1, dur, level, band) {
    const osc = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.linearRampToValueAtTime(f1, t0 + dur);
    f.type = 'bandpass'; f.frequency.value = band; f.Q.value = 2.2;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(level, t0 + 0.03);
    g.gain.setValueAtTime(level, t0 + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    osc.connect(f); f.connect(g); g.connect(out);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  // --- Songs --------------------------------------------------------------------------------------
  // write(kind) makes up one phrase for a bird of that kind: a list of notes [start, f0, f1, length, level, options].
  // Each singer keeps a few phrases and repeats them, so it sounds like one bird and not a machine.
  function write(kind) {
    const n = [];
    let at = 0;
    if (kind === 'robin') {            // silvery and rambling: big leaps, slurs, a short trill or two
      const count = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        const f = rand(2500, 5800), d = rand(0.05, 0.2), trill = Math.random() < 0.3;
        n.push([at, f, f * rand(0.72, 1.35), trill ? d + 0.12 : d, rand(0.024, 0.04), trill ? { vib: 0.1, vibHz: rand(24, 34) } : {}]);
        at += (trill ? d + 0.12 : d) + rand(0.015, 0.11);
      }
    } else if (kind === 'blackbird') { // slow, low and mellow, with a squeaky twiddle to finish
      const count = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const f = rand(1600, 2900), d = rand(0.16, 0.34);
        n.push([at, f, f * rand(0.86, 1.2), d, 0.05, { type: 'triangle', attack: 0.03, hold: 0.5 }]);
        at += d * rand(0.85, 1.2);
      }
      for (let i = 0; i < 3; i++) { n.push([at, rand(4200, 6200), rand(4200, 6200), 0.05, 0.014, {}]); at += 0.065; }
    } else if (kind === 'greatTit') {  // a see-saw of two notes, said two to four times
      const hi = rand(3600, 4500), lo = hi * 0.74, times = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < times; i++) { n.push([at, hi, hi * 0.98, 0.13, 0.04, {}], [at + 0.17, lo, lo * 0.98, 0.15, 0.04, {}]); at += 0.36; }
    } else if (kind === 'chaffinch') { // a rattle that runs downhill, faster and faster, into a flourish
      const count = 8 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const f = 5600 - 2700 * (i / count);
        n.push([at, f * 1.12, f * 0.86, 0.07, 0.034, {}]);
        at += 0.125 - 0.06 * (i / count);
      }
      n.push([at, 2900, 4500, 0.09, 0.04, {}], [at + 0.1, 4400, 2700, 0.12, 0.04, {}]);
    } else if (kind === 'blueTit') {   // two thin high notes, then a quick trill
      n.push([0, 7400, 7200, 0.11, 0.02, {}], [0.17, 7300, 7100, 0.11, 0.02, {}]);
      at = 0.36;
      const count = 5 + Math.floor(Math.random() * 4), f = rand(5200, 5900);
      for (let i = 0; i < count; i++) { n.push([at, f, f * 0.93, 0.045, 0.024, {}]); at += 0.07; }
    } else if (kind === 'chiffchaff') { // says its own name, over and over
      const count = 6 + Math.floor(Math.random() * 5);
      for (let i = 0; i < count; i++) {
        const f = Math.random() < 0.55 ? 4500 : 3650;
        n.push([at, f * 1.1, f * 0.9, 0.085, 0.03, {}]);
        at += rand(0.2, 0.25);
      }
    } else if (kind === 'pigeon') {    // five soft hoots from deep in a far tree
      for (const [gap, f, d, l] of [[0, 445, 0.3, 0.6], [0.42, 470, 0.55, 1], [0.62, 425, 0.4, 0.8], [0.62, 430, 0.26, 0.6], [0.32, 420, 0.3, 0.6]]) {
        at += gap;
        n.push([at, f, f * 0.95, d, 0.11 * l, { attack: 0.07, hold: 0.6 }]);
      }
    } else if (kind === 'cuckoo') {    // two notes, a falling third, from far across the meadow
      const times = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < times; i++) {
        n.push([at, 585, 580, 0.17, 0.1, { type: 'triangle', attack: 0.02, hold: 0.6 }], [at + 0.3, 465, 455, 0.3, 0.1, { type: 'triangle', attack: 0.02, hold: 0.6 }]);
        at += 1.25;
      }
    }
    return n;
  }

  function sing(s, t) {
    const kind = s.kind;
    if (kind === 'sparrow') {          // the quick, bright twitter Sam liked: left exactly as it was
      const base = 2200 + Math.random() * 2400;
      const notes = 2 + Math.floor(Math.random() * 5);
      for (let i = 0; i < notes; i++) {
        const f = base * (0.85 + Math.random() * 0.4);
        note(s.out, t + i * (0.09 + Math.random() * 0.05), f, f * (Math.random() < 0.5 ? 1.35 : 0.75), 0.085, 0.035 + Math.random() * 0.03);
      }
      return 0.7;
    }
    if (kind === 'woodpecker') {       // a roll of knocks on dead wood that tails off
      const knocks = 12 + Math.floor(Math.random() * 6);
      for (let i = 0; i < knocks; i++) puff(s.out, t + i * 0.048 * (1 + i * 0.004), 0.03, 0.9 * Math.sin((Math.PI * (i + 2)) / (knocks + 3)), 'bandpass', 950, 5);
      return 1;
    }
    if (kind === 'crow') {             // two to four hoarse caws
      const caws = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < caws; i++) squawk(s.out, t + i * 0.52, rand(400, 440), rand(330, 360), 0.3, 0.3, 1350);
      return caws * 0.52;
    }
    // Everyone else has a small set of phrases. Robins know more of them.
    const most = kind === 'robin' ? 5 : 2;
    if (s.songs.length < most && (s.songs.length === 0 || Math.random() < 0.5)) s.songs.push(write(kind));
    const song = pick(s.songs);
    const tune = 1 + (Math.random() - 0.5) * 0.03;   // never quite the same twice
    let end = 0;
    for (const [at, f0, f1, dur, level, o] of song) {
      note(s.out, t + at, f0 * tune, f1 * tune, dur, level, o);
      end = Math.max(end, at + dur);
    }
    return end;
  }

  function rustle(t, strength) {
    puff(master, t, 0.1 + Math.random() * 0.25, 0.022 * strength, 'highpass', 3000 + Math.random() * 2500);
  }

  // A bee going by: a low buzz that swells, slides across and drops in pitch as it passes.
  function bee(t) {
    const dur = rand(1.6, 2.8), from = Math.random() < 0.5 ? -1 : 1;
    const osc = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = panner(from);
    osc.type = 'sawtooth';
    const hz = rand(190, 235);
    osc.frequency.setValueAtTime(hz * 1.04, t);
    osc.frequency.linearRampToValueAtTime(hz * 0.95, t + dur);
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.02, t + dur * 0.5);
    g.gain.linearRampToValueAtTime(0, t + dur);
    if (p.pan) { p.pan.setValueAtTime(from * 0.9, t); p.pan.linearRampToValueAtTime(-from * 0.9, t + dur); }
    const wob = ctx.createOscillator(), depth = ctx.createGain();   // the buzz wavers as it weaves about
    wob.frequency.value = rand(5, 9); depth.gain.value = 9;
    wob.connect(depth); depth.connect(osc.frequency);
    osc.connect(f); f.connect(g); g.connect(p); p.connect(master);
    osc.start(t); wob.start(t); osc.stop(t + dur + 0.05); wob.stop(t + dur + 0.05);
  }

  // A grasshopper: a dry, very high buzz in short bursts, somewhere low in the grass.
  function grasshopper(t, out) {
    const bursts = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < bursts; i++) {
      const b = t + i * 0.19;
      for (let k = 0; k < 7; k++) puff(out, b + k * 0.014, 0.012, 0.09, 'bandpass', 7600, 6);
    }
  }

  // A gust is slow, uneven and mostly quiet. Squaring a sum of slow waves gives long lulls and short swells.
  function gustAt(t, offset) {
    const s = 0.5 + 0.3 * Math.sin(t * 0.21 + offset) + 0.2 * Math.sin(t * 0.47 + offset * 2.3) + 0.12 * Math.sin(t * 1.1 + offset * 4.1);
    const g = Math.min(1, Math.max(0, s));
    return LULL + (1 - LULL) * g * g;
  }

  // Call once per frame with the season state from engine/seasons.js.
  // heard (optional) says what is happening on screen:
  //   { squirrel: { mode, moving, onBark, pan, near }, flock: { pan }, takeoffs: [{ pan, near }] }
  // pan is -1 left .. 1 right; near is loudness for distance (1 = about 12 m away).
  function update(st, heard = {}) {
    if (!ctx || !on) return;
    const t = ctx.currentTime;
    const y = st.year;
    const leafy = st.canopy;                        // 0 bare .. 1 full leaf
    const gl = gustAt(t, 0), gr = gustAt(t, 0.55), g2 = gustAt(t, 1.7), g1 = (gl + gr) / 2;
    const dry = Math.max(0, 1 - Math.abs(y - 0.62) / 0.14);   // dry autumn leaves hiss brighter
    const hiss = LEAF_HISS * 0.75 * (0.35 + 0.65 * st.wind) * leafy;
    leafL.gain.gain.setTargetAtTime(hiss * gl, t, 0.35);
    leafR.gain.gain.setTargetAtTime(hiss * gr, t, 0.35);
    leafL.filter.frequency.setTargetAtTime(LEAF_BAND[0] + (LEAF_BAND[1] - LEAF_BAND[0]) * gl + 900 * dry, t, 0.5);
    leafR.filter.frequency.setTargetAtTime(LEAF_BAND[0] + (LEAF_BAND[1] - LEAF_BAND[0]) * gr + 900 * dry, t, 0.5);
    air.gain.gain.setTargetAtTime(AIR_BODY * (0.3 + 0.7 * st.wind) * g2 * (1 - 0.4 * st.snow), t, 0.5);
    air.filter.frequency.setTargetAtTime(AIR_BAND[0] + (AIR_BAND[1] - AIR_BAND[0]) * g2, t, 0.8);
    twigs.gain.gain.setTargetAtTime(BARE_TWIGS * st.wind * g1 * (1 - leafy), t, 0.4);
    twigs.filter.frequency.setTargetAtTime(900 + 500 * g1, t, 0.6);
    hush.frequency.setTargetAtTime(12000 - SNOW_HUSH * st.snow, t, 1);

    // Birds: each sings when it is in season and its own pause is over.
    for (const s of singers) {
      if (t < s.next) continue;
      const keen = s.months(y);
      if (keen < 0.05 || Math.random() > keen + 0.25) { s.next = t + rand(1, 4); continue; }
      const length = sing(s, t + 0.03);
      s.next = t + length + rand(s.gap[0], s.gap[1]) / Math.max(keen, 0.3);
    }

    if (dry > 0.05 && t > nextRustle) {
      rustle(t + 0.02, dry * (0.4 + 0.6 * g1));
      nextRustle = t + (RUSTLE_GAP[0] + Math.random() * RUSTLE_GAP[1]) / dry;
    }
    // Insects in the warm months.
    const warm = hump(y, 0.16, 0.5, 0.06);
    if (warm > 0.1 && t > nextBee) { bee(t + 0.05); nextBee = t + rand(7, 20) / warm; }
    const high = hump(y, 0.3, 0.55, 0.05);
    if (high > 0.1 && t > nextHopper) { grasshopper(t + 0.05, singers[5].out); nextHopper = t + rand(4, 11) / high; }

    // What the animals on screen are doing.
    const sq = heard.squirrel;
    if (sq) {
      if (near.pan.pan) near.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, sq.pan)), t, 0.05);
      if (sq.moving && t > nextClaw) {
        // Claws on bark are sharp ticks; over grass each bound is a soft swish.
        if (sq.onBark) { puff(near.input, t + 0.01, 0.014, 0.05 * sq.near, 'highpass', 2800); nextClaw = t + rand(0.05, 0.11); }
        else { puff(near.input, t + 0.01, 0.07, 0.05 * sq.near, 'bandpass', 3400, 0.8); nextClaw = t + 0.19; }
      }
      if (sq.mode === 'dig' && t > nextClaw) { puff(near.input, t + 0.01, 0.05, 0.06 * sq.near, 'bandpass', 2200, 1); nextClaw = t + 0.1; }
      if (sq.mode === 'alert' && lastMode !== 'alert') {     // a scolding chuk-chuk-chuk
        for (let i = 0; i < 4; i++) note(near.input, t + 0.25 + i * 0.13, 1500, 800, 0.05, 0.05 * sq.near, { type: 'triangle' });
      }
      lastMode = sq.mode;
    }
    for (const w of heard.takeoffs || []) {                  // a flurry of wings
      for (let i = 0; i < 6; i++) puff(master, t + 0.01 + i * 0.062, 0.03, 0.04 * w.near * (1 - i * 0.1), 'bandpass', 1500, 0.9);
    }
    if (heard.flock && t > nextHonk) {                       // geese calling to each other as they go over
      const out = singers[heard.flock.pan < 0 ? 7 : 10].out;
      const hz = rand(360, 430);
      squawk(out, t + 0.02, hz, hz * 1.22, rand(0.16, 0.24), 0.32, 1150);
      nextHonk = t + rand(0.25, 1.1);
    }
  }

  // For checking by ear: plays one phrase of the named singer now (or every singer in turn with no name).
  function audition(kind) {
    if (!ctx) return 'start the sound first';
    let at = ctx.currentTime + 0.05;
    for (const s of singers) if (!kind || s.kind === kind) at += sing(s, at) + 0.4;
    if (!kind || kind === 'bee') bee(at);
    if (!kind || kind === 'grasshopper') grasshopper(at + 3, singers[5].out);
    return singers.map((s) => s.kind).join(', ');
  }

  return { start, stop, update, audition, get on() { return on; } };
}
