// engine/seasons.js
// The year as pure functions of one number: y in 0..1.
//   0.00 start of spring   0.25 start of summer   0.50 start of autumn   0.75 start of winter
// Nothing here touches WebGL. Give it y, get back light, sky, ground and weather values,
// and per-leaf timings. The same y always gives the same answer, so any moment can be frozen.

// --- Timings, all in years (1 = the whole cycle) -------------------------------------------
export const TIMING = {
  BLOSSOM_OPEN_START: 0.04,   // first flowers open
  BLOSSOM_OPEN_SPREAD: 0.05,  // the last flower opens this long after the first
  BLOSSOM_OPEN_DUR: 0.03,     // time for one flower to open
  BLOSSOM_FALL_START: 0.165,  // first petals drop
  BLOSSOM_FALL_SPREAD: 0.075, // petal drop is spread over this long
  BLOSSOM_FADE: [0.29, 0.36], // fallen petals shrink away between these times
  LEAF_GROW_START: 0.105,     // first leaf buds break
  LEAF_GROW_SPREAD: 0.09,     // bud break is spread over this long
  LEAF_GROW_DUR: 0.12,        // time for a leaf to reach full size
  LEAF_TURN_START: 0.50,      // first leaf starts to change colour
  LEAF_TURN_SPREAD: 0.10,     // the last leaf starts this long after the first
  LEAF_TURN_DUR: 0.07,        // time for one leaf to change colour
  LEAF_HANG_MIN: 0.06,        // shortest time a turned leaf stays on the tree
  LEAF_HANG_SPREAD: 0.09,     // extra hanging time, random per leaf
  LEAF_STUBBORN: 0.02,        // share of leaves that hang on into early winter
  LEAF_FADE: [0.80, 0.90],    // fallen leaves vanish under the snow between these times
  SNOW_BUILD: [0.77, 0.86],   // snow cover rises from 0 to 1
  SNOW_MELT_START: 0.94,      // thaw begins
  SNOW_LEFT_AT_NEW_YEAR: 0.25, // cover still lying when the year wraps round
  SNOW_GONE: 0.035,           // last patches melt this far into spring
  SNOWFALL: [0.755, 0.80, 0.92, 0.95], // flakes fade in between the first two, out between the last two
};

export const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
// A good still moment in each season.
export const SEASON_STILLS = { spring: 0.135, summer: 0.38, autumn: 0.605, winter: 0.885 };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const wrap = (y) => ((y % 1) + 1) % 1;

export function seasonName(y) { return SEASON_NAMES[Math.floor(wrap(y) * 4) % 4]; }

// Snow lying on the ground and branches, 0..1.
export function snowCover(y) {
  y = wrap(y);
  const T = TIMING;
  if (y < T.SNOW_GONE) return T.SNOW_LEFT_AT_NEW_YEAR * (1 - smooth(0, T.SNOW_GONE, y));
  if (y < T.SNOW_BUILD[0]) return 0;
  if (y < T.SNOW_MELT_START) return smooth(T.SNOW_BUILD[0], T.SNOW_BUILD[1], y);
  return 1 - (1 - T.SNOW_LEFT_AT_NEW_YEAR) * smooth(T.SNOW_MELT_START, 1, y);
}

// Snow in the air, 0..1.
export function snowFall(y) {
  y = wrap(y);
  const s = TIMING.SNOWFALL;
  return smooth(s[0], s[1], y) * (1 - smooth(s[2], s[3], y));
}

// How much leaf is on the tree, 0..1. Used to shade the ground under the crown.
export function canopy(y) {
  y = wrap(y);
  return smooth(0.11, 0.30, y) * (1 - smooth(0.58, 0.75, y));
}

// Per-leaf timings: [growStart, turnStart, fallStart].
// rand1 and rand2 are 0..1; heightNorm and outerness come from the tree engine.
// Leaves at the top and outside of the crown turn first, as they do on a real tree.
export function leafSchedule(rand1, rand2, heightNorm, outerness) {
  const T = TIMING;
  const exposure = clamp01(0.5 * heightNorm + 0.5 * outerness);
  const order = clamp01(0.6 * rand1 + 0.4 * (1 - exposure));
  const grow = T.LEAF_GROW_START + T.LEAF_GROW_SPREAD * (0.7 * rand2 + 0.3 * (1 - heightNorm));
  const turn = T.LEAF_TURN_START + T.LEAF_TURN_SPREAD * order;
  let fall = turn + T.LEAF_HANG_MIN + T.LEAF_HANG_SPREAD * rand2;
  if (rand1 * 7.31 % 1 < T.LEAF_STUBBORN) fall = 0.76 + 0.04 * rand2;
  return [grow, turn, fall];
}

// Per-flower timings in the same shape: [openStart, unused, fallStart].
export function blossomSchedule(rand1, rand2, heightNorm) {
  const T = TIMING;
  const open = T.BLOSSOM_OPEN_START + T.BLOSSOM_OPEN_SPREAD * (0.75 * rand1 + 0.25 * (1 - heightNorm));
  const fall = T.BLOSSOM_FALL_START + T.BLOSSOM_FALL_SPREAD * rand2;
  return [open, 0, fall];
}

// --- Light, sky and ground through the year ------------------------------------------------
// Eight key moments, evenly spaced: key i sits at y = i / 8. Colours are linear RGB.
//   sunElevation  degrees above the horizon
//   sunAzimuth    radians from +z towards +x (1.57 = light from the right, 3.14 = from behind the tree)
//   sun, sunPower colour and strength of direct light
//   zenith, horizon   sky colours
//   skyAmbient, groundAmbient   fill light from above and below
//   fog, fogDensity   haze colour and thickness (per metre)
//   grassDark, grassLight, grassHeight   meadow colours and blade height (0..1)
//   hill          colour of the far hills and tree line
//   cloud         0 clear .. 1 overcast
//   shadow        0 no visible shadow (overcast) .. 1 crisp
//   wind          0 still .. 1 strong
//   wood, woodBare   colour of the far wood on the ridge, and 1 when it is leafless
//   saturation, tint   final colour grade
const KEYS = [
  { // 0.000 early spring: cool morning, bare tree, last snow
    sunElevation: 28, sunAzimuth: 1.6, sun: [1.0, 0.90, 0.78], sunPower: 2.7,
    zenith: [0.20, 0.38, 0.70], horizon: [0.62, 0.72, 0.82],
    skyAmbient: [0.30, 0.40, 0.55], groundAmbient: [0.10, 0.10, 0.07],
    fog: [0.60, 0.68, 0.76], fogDensity: 0.0045,
    grassDark: [0.085, 0.11, 0.035], grassLight: [0.19, 0.19, 0.07], grassHeight: 0.45,
    hill: [0.10, 0.12, 0.10], cloud: 0.5, shadow: 0.85, wind: 0.7,
    wood: [0.16, 0.15, 0.11], woodBare: 1, saturation: 0.95, tint: [1.0, 1.0, 1.03],
  },
  { // 0.125 mid spring: blossom
    sunElevation: 38, sunAzimuth: 1.5, sun: [1.0, 0.94, 0.84], sunPower: 3.2,
    zenith: [0.16, 0.36, 0.74], horizon: [0.60, 0.74, 0.88],
    skyAmbient: [0.30, 0.42, 0.60], groundAmbient: [0.09, 0.14, 0.05],
    fog: [0.62, 0.74, 0.86], fogDensity: 0.004,
    grassDark: [0.06, 0.17, 0.028], grassLight: [0.17, 0.34, 0.05], grassHeight: 0.8,
    hill: [0.07, 0.15, 0.07], cloud: 0.35, shadow: 1.0, wind: 0.6,
    wood: [0.13, 0.26, 0.06], woodBare: 0.2, saturation: 1.05, tint: [1.0, 1.0, 1.0],
  },
  { // 0.250 early summer
    sunElevation: 48, sunAzimuth: 1.45, sun: [1.0, 0.96, 0.88], sunPower: 3.6,
    zenith: [0.12, 0.32, 0.75], horizon: [0.55, 0.72, 0.90],
    skyAmbient: [0.28, 0.40, 0.60], groundAmbient: [0.08, 0.13, 0.04],
    fog: [0.60, 0.74, 0.88], fogDensity: 0.0036,
    grassDark: [0.045, 0.15, 0.022], grassLight: [0.13, 0.30, 0.045], grassHeight: 1.0,
    hill: [0.05, 0.13, 0.05], cloud: 0.32, shadow: 1.0, wind: 0.45,
    wood: [0.06, 0.17, 0.04], woodBare: 0, saturation: 1.05, tint: [1.0, 1.0, 1.0],
  },
  { // 0.375 mid summer: high sun, warm haze
    sunElevation: 52, sunAzimuth: 1.45, sun: [1.0, 0.95, 0.86], sunPower: 3.8,
    zenith: [0.07, 0.24, 0.72], horizon: [0.50, 0.68, 0.90],
    skyAmbient: [0.28, 0.38, 0.56], groundAmbient: [0.09, 0.12, 0.04],
    fog: [0.66, 0.74, 0.82], fogDensity: 0.0035,
    grassDark: [0.055, 0.14, 0.022], grassLight: [0.19, 0.28, 0.05], grassHeight: 1.0,
    hill: [0.05, 0.12, 0.05], cloud: 0.3, shadow: 1.0, wind: 0.4,
    wood: [0.05, 0.14, 0.035], woodBare: 0, saturation: 1.03, tint: [1.02, 1.0, 0.98],
  },
  { // 0.500 early autumn
    sunElevation: 36, sunAzimuth: 1.8, sun: [1.0, 0.86, 0.66], sunPower: 3.4,
    zenith: [0.16, 0.30, 0.62], horizon: [0.80, 0.72, 0.60],
    skyAmbient: [0.30, 0.36, 0.48], groundAmbient: [0.10, 0.11, 0.045],
    fog: [0.74, 0.72, 0.66], fogDensity: 0.005,
    grassDark: [0.075, 0.13, 0.03], grassLight: [0.23, 0.25, 0.06], grassHeight: 0.9,
    hill: [0.08, 0.11, 0.05], cloud: 0.35, shadow: 1.0, wind: 0.7,
    wood: [0.10, 0.15, 0.04], woodBare: 0, saturation: 1.05, tint: [1.03, 1.0, 0.96],
  },
  { // 0.625 mid autumn: low golden light, mist
    sunElevation: 22, sunAzimuth: 2.05, sun: [1.0, 0.72, 0.42], sunPower: 3.6,
    zenith: [0.36, 0.38, 0.46], horizon: [1.05, 0.66, 0.30],
    skyAmbient: [0.36, 0.36, 0.42], groundAmbient: [0.13, 0.10, 0.05],
    fog: [0.86, 0.70, 0.50], fogDensity: 0.007,
    grassDark: [0.095, 0.115, 0.03], grassLight: [0.27, 0.22, 0.07], grassHeight: 0.75,
    hill: [0.12, 0.10, 0.05], cloud: 0.2, shadow: 1.0, wind: 1.0,
    wood: [0.32, 0.17, 0.04], woodBare: 0.25, saturation: 1.08, tint: [1.05, 1.0, 0.93],
  },
  { // 0.750 early winter: overcast, first snow
    sunElevation: 16, sunAzimuth: 2.0, sun: [0.95, 0.85, 0.78], sunPower: 1.8,
    zenith: [0.42, 0.48, 0.56], horizon: [0.74, 0.76, 0.80],
    skyAmbient: [0.55, 0.60, 0.70], groundAmbient: [0.12, 0.12, 0.10],
    fog: [0.72, 0.75, 0.80], fogDensity: 0.011,
    grassDark: [0.095, 0.095, 0.045], grassLight: [0.20, 0.17, 0.08], grassHeight: 0.5,
    hill: [0.10, 0.10, 0.09], cloud: 0.95, shadow: 0.45, wind: 0.8,
    wood: [0.15, 0.13, 0.10], woodBare: 1, saturation: 0.88, tint: [0.98, 1.0, 1.04],
  },
  { // 0.875 mid winter: pale sun on snow
    sunElevation: 15, sunAzimuth: 1.9, sun: [1.0, 0.84, 0.68], sunPower: 3.6,
    zenith: [0.30, 0.42, 0.62], horizon: [0.82, 0.80, 0.82],
    skyAmbient: [0.38, 0.48, 0.72], groundAmbient: [0.12, 0.13, 0.12],
    fog: [0.78, 0.81, 0.88], fogDensity: 0.009,
    grassDark: [0.09, 0.09, 0.045], grassLight: [0.19, 0.17, 0.08], grassHeight: 0.45,
    hill: [0.10, 0.11, 0.11], cloud: 0.42, shadow: 0.92, wind: 0.5,
    wood: [0.15, 0.13, 0.11], woodBare: 1, saturation: 0.9, tint: [0.98, 1.0, 1.05],
  },
];

const SNOW_BOUNCE = [0.50, 0.56, 0.68]; // light thrown back up by lying snow
const CLOUD_SHADE_DEPTH = 0.55;         // share of direct sun lost under a passing cloud
const SNOW_ON_HILLS = [0.72, 0.76, 0.84];

const mixN = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mixN(a[0], b[0], t), mixN(a[1], b[1], t), mixN(a[2], b[2], t)];

// Everything the renderer needs to know about the moment y.
export function seasonState(y) {
  y = wrap(y);
  const f = y * KEYS.length;
  const i = Math.floor(f) % KEYS.length;
  const t0 = f - Math.floor(f);
  const t = t0 * t0 * (3 - 2 * t0);
  const a = KEYS[i], b = KEYS[(i + 1) % KEYS.length];
  const out = {};
  for (const k in a) out[k] = Array.isArray(a[k]) ? mix3(a[k], b[k], t) : mixN(a[k], b[k], t);

  const snow = snowCover(y);
  const el = (out.sunElevation * Math.PI) / 180;
  out.year = y;
  out.snow = snow;
  out.snowFall = snowFall(y);
  out.canopy = canopy(y);
  out.sunDir = [Math.sin(out.sunAzimuth) * Math.cos(el), Math.sin(el), Math.cos(out.sunAzimuth) * Math.cos(el)];
  out.sunColour = out.sun.map((c) => c * out.sunPower);
  out.groundAmbient = mix3(out.groundAmbient, SNOW_BOUNCE, snow * 0.85);
  out.hill = mix3(out.hill, SNOW_ON_HILLS, snow * 0.8);
  out.wood = mix3(out.wood, SNOW_ON_HILLS, snow * 0.4);
  // Passing clouds take the sun off patches of the meadow. Under full overcast there is no sun to take.
  out.shadeDepth = CLOUD_SHADE_DEPTH * (1 - smooth(0.6, 0.95, out.cloud));
  // The far meadow is washed with flower colour from late spring to the end of summer.
  out.flowers = smooth(0.1, 0.2, y) * (1 - smooth(0.44, 0.56, y));
  out.windDir = [0.86, 0.5]; // x, z: the way leaves drift as they fall
  out.name = seasonName(y);
  return out;
}
