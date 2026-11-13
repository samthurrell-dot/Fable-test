// src/sound.js
// All sound is made here, in code (WebAudio). Nothing plays until start() is called from a click.
//
// Two families:
//   paper     noise shaped by what the book is doing: a swish while a page moves, small crackles as
//             card unfolds, a soft knock when a page lands, a rub for tabs and the slider, a tick
//             for each tooth of a wheel
//   music box a short phrase when each spread opens; the last spread ends the tune

const MASTER = 0.5;            // overall level
const SWISH_GAIN = 0.16;       // page moving
const CRACKLE_GAIN = 0.07;     // card unfolding
const CRACKLE_RATE = 46;       // crackles a second at one page-turn a second
const KNOCK_GAIN = 0.2;        // page landing
const RUB_GAIN = 0.1;          // tab or slider moving
const TICK_GAIN = 0.11;        // wheel teeth
const TICK_ANGLE = 0.26;       // radians of wheel between ticks
const NOTE_GAIN = 0.11;        // music box
const BEAT = 0.34;             // seconds a half-beat of the tune lasts
const REVERB_SECONDS = 1.6, REVERB_MIX = 0.22;

// The tune, as [midi note, time in half-beats] per spread (0 is the cover).
const PHRASES = [
  [[81, 0], [86, 1]],
  [[74, 0], [78, 1], [81, 2], [83, 3], [81, 5], [78, 6]],
  [[76, 0], [79, 1], [83, 2], [81, 3], [79, 4], [76, 6]],
  [[74, 0], [81, 1], [78, 2], [81, 3], [86, 4], [83, 6]],
  [[71, 0], [74, 1], [78, 2], [76, 4], [73, 5], [69, 7]],
  [[74, 0], [78, 1], [81, 2], [86, 3], [85, 4], [83, 5], [81, 6], [78, 7], [74, 9], [62, 9], [69, 9.06], [78, 9.12]],
];

export function createSound() {
  let ctx = null, out = null, noise = null;
  let swish = null, rub = null;
  let lastSpread = -1, lastWhole = true, crackleDue = 0;
  const wheelAt = new Map(), lastValue = new Map();
  const api = { on: false };

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3;
    out = ctx.createGain();
    out.gain.value = 0;
    out.connect(comp); comp.connect(ctx.destination);
    // a room: decaying noise as an impulse response
    const len = Math.floor(ctx.sampleRate * REVERB_SECONDS), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = REVERB_MIX;
    api._send = ctx.createGain();
    api._send.connect(verb); verb.connect(wet); wet.connect(out);
    // two seconds of white noise, shared by every paper sound
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // running noise voices whose level follows the motion
    const voice = (freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(out);
      src.start();
      return { f, g };
    };
    swish = voice(2400, 0.7);
    rub = voice(1300, 1.4);
  }

  // A short burst of filtered noise.
  function burst(freq, q, seconds, gain, type = 'bandpass') {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random() * 1.5, seconds + 0.02);
  }

  // One tine of the music box: a pure tone, an octave above it, and a brief bright strike.
  function note(midi, when, gain = NOTE_GAIN) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.9);
    g.connect(out); g.connect(api._send);
    for (const [mul, level, life] of [[1, 1, 1.9], [2.002, 0.28, 1.1], [5.43, 0.12, 0.09]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
      const og = ctx.createGain();
      og.gain.setValueAtTime(level, when);
      og.gain.exponentialRampToValueAtTime(0.0001, when + life);
      o.connect(og); og.connect(g);
      o.start(when); o.stop(when + life + 0.05);
    }
  }
  function phrase(k) {
    const t0 = ctx.currentTime + 0.12;
    for (const [m, at] of PHRASES[k] || []) note(m, t0 + at * BEAT);
  }

  api.start = () => {
    if (!ctx) build();
    ctx.resume();
    out.gain.setTargetAtTime(MASTER, ctx.currentTime, 0.15);
    api.on = true;
    lastSpread = -1;
  };
  api.stop = () => {
    if (!ctx) return;
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    api.on = false;
  };

  // Called every frame. turn: where the book is; speed: turns a second; controls: the book's tabs and wheels.
  api.update = ({ turn, speed, dt, controls }) => {
    if (!api.on || !ctx) return;
    const now = ctx.currentTime, v = Math.min(3, Math.abs(speed));
    // the page in the air
    swish.g.gain.setTargetAtTime(Math.min(1, Math.pow(v, 1.2)) * SWISH_GAIN, now, 0.05);
    swish.f.frequency.setTargetAtTime(1500 + v * 1500, now, 0.08);
    // card unfolding: crackles, more of them the faster it moves
    crackleDue -= dt * v * CRACKLE_RATE;
    while (crackleDue < 0) {
      crackleDue += 0.4 + Math.random() * 1.2;
      burst(2600 + Math.random() * 4200, 2.5, 0.006 + Math.random() * 0.012, CRACKLE_GAIN * (0.4 + Math.random() * 0.6), 'highpass');
    }
    // landing
    const whole = Math.abs(turn - Math.round(turn)) < 1e-3;
    if (whole && !lastWhole) { burst(140, 0.9, 0.12, KNOCK_GAIN, 'lowpass'); burst(1800, 1, 0.03, KNOCK_GAIN * 0.3); }
    lastWhole = whole;
    // a new spread: its phrase
    const k = Math.round(turn);
    if (k !== lastSpread && Math.abs(turn - k) < 0.3) { if (lastSpread !== -1 || k > 0) phrase(k); lastSpread = k; }
    // tabs, slider and wheels
    let rubbing = 0;
    for (const c of controls) {
      const was = lastValue.has(c) ? lastValue.get(c) : c.value;
      lastValue.set(c, c.value);
      const rate = dt > 0 ? Math.abs(c.value - was) / dt : 0;
      if (c.type === 'wheel') {
        const at = wheelAt.has(c) ? wheelAt.get(c) : c.value;
        if (Math.abs(c.value - at) >= TICK_ANGLE) { wheelAt.set(c, c.value); burst(2100 + Math.random() * 300, 6, 0.018, TICK_GAIN); burst(420, 2, 0.03, TICK_GAIN * 0.5); } else if (!wheelAt.has(c)) wheelAt.set(c, c.value);
      } else rubbing = Math.max(rubbing, Math.min(1, rate * 0.9));
    }
    rub.g.gain.setTargetAtTime(rubbing * RUB_GAIN, now, 0.04);
  };
  api.grab = () => { if (api.on && ctx) burst(900, 1.2, 0.03, 0.05); };
  api.drop = () => { if (api.on && ctx) burst(600, 1.2, 0.04, 0.04); };
  api.context = () => ctx;
  return api;
}
