// src/sound.js
// All sound is made in code with WebAudio: wind in the crown, birdsong in the warm months,
// dry leaves in autumn. Nothing plays until start() is called from a click.

const MASTER_GAIN = 0.5;       // overall loudness
const WIND_BASE = 0.05;        // wind loudness in still air
const WIND_RANGE = 0.16;       // extra wind loudness at full wind
const BIRD_GAP = [0.5, 3.5];   // seconds between bird phrases at the height of spring
const RUSTLE_GAP = [0.15, 0.9]; // seconds between leaf rustles in mid autumn

export function createSound() {
  let ctx = null, master = null, windGain = null, windFilter = null, noise = null;
  let nextBird = 0, nextRustle = 0, on = false;

  function noiseBuffer(seconds) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      // Slightly "pink" noise sounds more like air than plain white noise.
      last = last * 0.97 + (Math.random() * 2 - 1) * 0.25;
      d[i] = last * 3;
    }
    return buf;
  }

  function start() {
    if (ctx) { ctx.resume(); on = true; master.gain.setTargetAtTime(MASTER_GAIN, ctx.currentTime, 0.3); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    noise = noiseBuffer(4);
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass'; windFilter.frequency.value = 500; windFilter.Q.value = 0.5;
    windGain = ctx.createGain(); windGain.gain.value = WIND_BASE;
    src.connect(windFilter); windFilter.connect(windGain); windGain.connect(master);
    src.start();
    master.gain.setTargetAtTime(MASTER_GAIN, ctx.currentTime, 0.6);
    on = true;
  }

  function stop() {
    if (!ctx) return;
    on = false;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
  }

  function bird(t) {
    const base = 2200 + Math.random() * 2400;
    const notes = 2 + Math.floor(Math.random() * 5);
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const t0 = t + i * (0.09 + Math.random() * 0.05);
      const f = base * (0.85 + Math.random() * 0.4);
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t0);
      o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.35 : 0.75), t0 + 0.07);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.035 + Math.random() * 0.03, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.085);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + 0.1);
    }
  }

  function rustle(t, strength) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 2500 + Math.random() * 2500;
    const g = ctx.createGain();
    const dur = 0.12 + Math.random() * 0.3;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 * strength, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t, Math.random() * 3); src.stop(t + dur + 0.02);
  }

  // Call once per frame with the season state from engine/seasons.js.
  function update(st) {
    if (!ctx || !on) return;
    const t = ctx.currentTime;
    const gust = 0.75 + 0.25 * Math.sin(t * 0.6) * Math.sin(t * 0.23 + 1);
    const leafy = st.canopy;
    windGain.gain.setTargetAtTime((WIND_BASE + WIND_RANGE * st.wind) * gust * (1 - 0.35 * st.snow), t, 0.4);
    windFilter.frequency.setTargetAtTime(280 + 500 * leafy + 250 * st.wind, t, 0.6);
    const y = st.year;
    const birds = Math.max(0, 1 - Math.abs(y - 0.2) / 0.3); // peaks in late spring, gone by autumn
    if (birds > 0.05 && t > nextBird) {
      bird(t + 0.02);
      nextBird = t + (BIRD_GAP[0] + Math.random() * BIRD_GAP[1]) / birds;
    }
    const dry = Math.max(0, 1 - Math.abs(y - 0.64) / 0.13);
    if (dry > 0.05 && t > nextRustle) {
      rustle(t + 0.02, dry);
      nextRustle = t + (RUSTLE_GAP[0] + Math.random() * RUSTLE_GAP[1]) / dry;
    }
  }

  return { start, stop, update, get on() { return on; } };
}
