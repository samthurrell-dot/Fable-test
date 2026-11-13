// ui/sound.js
// All sound is made here in code (WebAudio). Nothing plays until start() is called from a click.
// Silent at rest: every sound is tied to something that happens (a card dealt, a stamp, a chime for
// morning). The recipe is the one from the pop-up book build: short shaped bursts of noise for
// paper, and a small bell of three sine partials for anything with a pitch.

const MASTER = 0.6;
const NOTE_GAIN = 0.12;          // the bell
const REVERB_SECONDS = 1.4, REVERB_MIX = 0.2;

// Phrases as [midi note, seconds after the start].
const PHRASES = {
  morning: [[74, 0], [78, 0.16], [81, 0.32]],
  night: [[76, 0], [69, 0.26]],
  alarm: [[75, 0], [76, 0.02], [75, 0.3], [76, 0.32]],
  good: [[81, 0], [86, 0.12]],
  bad: [[70, 0], [64, 0.18]],
  promise: [[78, 0], [83, 0.14], [90, 0.28]],
  win: [[74, 0], [78, 0.17], [81, 0.34], [86, 0.51], [85, 0.68], [86, 0.95], [74, 0.95], [81, 0.98]],
  lose: [[74, 0], [72, 0.3], [69, 0.6], [65, 0.95], [62, 1.4]],
};

export function createSound() {
  let ctx = null, out = null, noise = null, send = null;
  const api = { on: false };

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3;
    out = ctx.createGain(); out.gain.value = 0;
    out.connect(comp); comp.connect(ctx.destination);
    const len = Math.floor(ctx.sampleRate * REVERB_SECONDS), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.8); }
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = REVERB_MIX;
    send = ctx.createGain(); send.connect(verb); verb.connect(wet); wet.connect(out);
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  // A short burst of filtered noise, optionally sweeping its filter.
  function burst(freq, q, seconds, gain, type = 'bandpass', to = 0, delay = 0) {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(), t = ctx.currentTime + delay;
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + seconds);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.012, seconds / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random() * 1.5, seconds + 0.03);
  }
  function note(midi, when, gain = NOTE_GAIN) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.6);
    g.connect(out); g.connect(send);
    for (const [mul, level, life] of [[1, 1, 1.6], [2.002, 0.28, 0.9], [5.43, 0.12, 0.08]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mul;
      const og = ctx.createGain();
      og.gain.setValueAtTime(level, when);
      og.gain.exponentialRampToValueAtTime(0.0001, when + life);
      o.connect(og); og.connect(g);
      o.start(when); o.stop(when + life + 0.05);
    }
  }

  const SFX = {
    card: () => { burst(1800, 0.8, 0.16, 0.12, 'bandpass', 3600); burst(240, 1, 0.05, 0.06, 'lowpass', 0, 0.13); },
    tap: () => burst(1500, 2.5, 0.025, 0.07),
    sheet: () => burst(2600, 0.7, 0.12, 0.06, 'bandpass', 1400),
    stamp: () => { burst(130, 0.9, 0.13, 0.26, 'lowpass'); burst(2200, 1.2, 0.03, 0.09); },
    step: () => burst(520, 2, 0.035, 0.05),
    coin: () => { const t = ctx.currentTime; note(93, t, 0.06); note(98, t + 0.07, 0.06); },
    lights: () => { burst(90, 1, 0.2, 0.2, 'lowpass'); burst(3000, 3, 0.02, 0.05); },
  };

  api.start = () => {
    if (!ctx) build();
    ctx.resume();
    out.gain.setTargetAtTime(MASTER, ctx.currentTime, 0.1);
    api.on = true;
  };
  api.stop = () => { if (ctx) out.gain.setTargetAtTime(0, ctx.currentTime, 0.08); api.on = false; };
  api.play = (name) => {
    if (!api.on || !ctx) return;
    if (SFX[name]) SFX[name]();
    else if (PHRASES[name]) { const t0 = ctx.currentTime + 0.03; for (const [m, at] of PHRASES[name]) note(m, t0 + at); }
  };
  api.context = () => ctx;
  return api;
}
