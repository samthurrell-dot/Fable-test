// src/sound.js
// All sound is made in code with WebAudio. Nothing plays until start() is called from a click.
//
// The birds lead; the wind stays behind them. Wind here is not a steady rush (that sounds like
// a road). It is leaves: a bright hiss that swells in gusts and falls away to almost nothing,
// with a softer body of moving air under it. In winter the leaves are gone and only a thin
// breath through bare twigs is left.

const MASTER_GAIN = 0.55;        // overall loudness
const LEAF_HISS = 0.085;         // loudness of the leaves at the top of a gust, in full leaf
const LEAF_BAND = [2600, 5200];  // the hiss sweeps between these frequencies (Hz) as a gust rises
const AIR_BODY = 0.022;          // loudness of the soft moving-air layer
const AIR_BAND = [450, 900];     // its frequency range (Hz)
const BARE_TWIGS = 0.012;        // loudness of the winter breath through bare twigs
const LULL = 0.06;               // how much wind is left between gusts (0 = silence)
const BIRD_GAP = [0.6, 3.2];     // seconds between bird phrases at the height of spring
const RUSTLE_GAP = [0.2, 1.0];   // seconds between dry-leaf rustles in mid autumn

export function createSound() {
  let ctx = null, master = null, white = null, on = false;
  let leaf = null, air = null, twigs = null;
  let nextBird = 0, nextRustle = 0;

  function whiteNoise(seconds) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // One layer of wind: looping white noise through a band filter into its own gain.
  function layer(type, freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = white; src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;   // so the layers never line up
    const filter = ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter); filter.connect(gain); gain.connect(master);
    src.start(0, Math.random() * 2);
    return { filter, gain };
  }

  function start() {
    if (ctx) { ctx.resume(); on = true; master.gain.setTargetAtTime(MASTER_GAIN, ctx.currentTime, 0.3); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    white = whiteNoise(3);
    leaf = layer('bandpass', LEAF_BAND[0], 0.7);
    air = layer('bandpass', AIR_BAND[0], 0.9);
    twigs = layer('bandpass', 1100, 5);
    master.gain.setTargetAtTime(MASTER_GAIN, ctx.currentTime, 0.6);
    on = true;
  }

  function stop() {
    if (!ctx) return;
    on = false;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  }

  function note(t0, f0, f1, dur, level, type = 'sine') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * 0.85);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(level, t0 + Math.min(0.012, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  // Three kinds of singer, so the tree does not sound like one bird on repeat.
  function chirps(t) {            // quick, bright twitter
    const base = 2200 + Math.random() * 2400;
    const notes = 2 + Math.floor(Math.random() * 5);
    for (let i = 0; i < notes; i++) {
      const f = base * (0.85 + Math.random() * 0.4);
      note(t + i * (0.09 + Math.random() * 0.05), f, f * (Math.random() < 0.5 ? 1.35 : 0.75), 0.085, 0.035 + Math.random() * 0.03);
    }
  }
  function twoTone(t) {           // a see-saw of two notes, said two to four times
    const hi = 3600 + Math.random() * 900, lo = hi * 0.74;
    const times = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < times; i++) {
      note(t + i * 0.36, hi, hi * 0.98, 0.13, 0.04);
      note(t + i * 0.36 + 0.17, lo, lo * 0.98, 0.15, 0.04);
    }
  }
  function flute(t) {             // slow, low, mellow phrases
    let at = t;
    const notes = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < notes; i++) {
      const f = 1500 + Math.random() * 1300;
      const dur = 0.16 + Math.random() * 0.2;
      note(at, f, f * (0.9 + Math.random() * 0.25), dur, 0.05, 'triangle');
      at += dur * (0.8 + Math.random() * 0.5);
    }
  }

  function rustle(t, strength) {
    const src = ctx.createBufferSource();
    src.buffer = white;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 3000 + Math.random() * 2500;
    const g = ctx.createGain();
    const dur = 0.1 + Math.random() * 0.25;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.022 * strength, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 2); src.stop(t + dur + 0.02);
  }

  // A gust is slow, uneven and mostly quiet. Squaring a sum of slow waves gives long lulls and short swells.
  function gustAt(t, offset) {
    const s = 0.5 + 0.3 * Math.sin(t * 0.21 + offset) + 0.2 * Math.sin(t * 0.47 + offset * 2.3) + 0.12 * Math.sin(t * 1.1 + offset * 4.1);
    const g = Math.min(1, Math.max(0, s));
    return LULL + (1 - LULL) * g * g;
  }

  // Call once per frame with the season state from engine/seasons.js.
  function update(st) {
    if (!ctx || !on) return;
    const t = ctx.currentTime;
    const leafy = st.canopy;                        // 0 bare .. 1 full leaf
    const g1 = gustAt(t, 0), g2 = gustAt(t, 1.7);
    const dry = Math.max(0, 1 - Math.abs(st.year - 0.62) / 0.14);   // dry autumn leaves hiss brighter
    leaf.gain.gain.setTargetAtTime(LEAF_HISS * (0.35 + 0.65 * st.wind) * g1 * leafy, t, 0.35);
    leaf.filter.frequency.setTargetAtTime(LEAF_BAND[0] + (LEAF_BAND[1] - LEAF_BAND[0]) * g1 + 900 * dry, t, 0.5);
    air.gain.gain.setTargetAtTime(AIR_BODY * (0.3 + 0.7 * st.wind) * g2 * (1 - 0.4 * st.snow), t, 0.5);
    air.filter.frequency.setTargetAtTime(AIR_BAND[0] + (AIR_BAND[1] - AIR_BAND[0]) * g2, t, 0.8);
    twigs.gain.gain.setTargetAtTime(BARE_TWIGS * st.wind * g1 * (1 - leafy), t, 0.4);
    twigs.filter.frequency.setTargetAtTime(900 + 500 * g1, t, 0.6);

    const y = st.year;
    const spring = Math.max(0, 1 - Math.abs(y - 0.2) / 0.32);       // song peaks in late spring
    const winter = y > 0.76 || y < 0.03 ? 0.18 : 0;                 // a lone winter singer now and then
    const birds = Math.max(spring, winter);
    if (birds > 0.05 && t > nextBird) {
      const pick = Math.random();
      if (winter && !spring) flute(t + 0.02);
      else if (pick < 0.5) chirps(t + 0.02);
      else if (pick < 0.75) twoTone(t + 0.02);
      else flute(t + 0.02);
      nextBird = t + (BIRD_GAP[0] + Math.random() * BIRD_GAP[1]) / birds;
    }
    if (dry > 0.05 && t > nextRustle) {
      rustle(t + 0.02, dry * (0.4 + 0.6 * g1));
      nextRustle = t + (RUSTLE_GAP[0] + Math.random() * RUSTLE_GAP[1]) / dry;
    }
  }

  return { start, stop, update, get on() { return on; } };
}
