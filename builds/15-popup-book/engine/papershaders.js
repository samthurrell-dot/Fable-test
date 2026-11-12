// engine/papershaders.js
// GLSL for the paper renderer (see paperlight.js). Card, table, shadow and display shaders.
//
// The look, in one place:
//   - card is matte: plain diffuse light, no highlight. What makes it read as card is the tooth
//     (small noise in colour and normal), a slow waviness across each sheet, the pale pressed rim,
//     the white cut edge, and the light that comes through a sheet lit from behind.
//   - light is one soft window (the key) plus six patches of sky and room (the fill), each with its
//     own shadow map. Where a fill patch is hidden by a piece of card, some of that card's colour
//     comes back instead: that is the colour that bounces between layers.

export const NUM_FILL = 6;

// Numbers a build may want to change. Each is used as a GLSL constant.
export const LOOK = {
  KEY_BIAS: 0.03,        // cm a point is moved off its surface before the key shadow test
  FILL_BIAS: 0.22,       // the same for the coarser fill maps
  TRANSMIT: 0.16,        // share of the key light that passes through a sheet of card
  CARD_THICK: 0.05,      // cm, used to step through a sheet for the light behind it
  RIM_WHITE: 0.6,        // how far the pressed rim goes towards bare card
  BEND_WHITE: 0.22,      // how far a fold goes towards bare card (ink cracks along a crease)
  COCKLE: 0.085,         // waviness of a sheet (0 = dead flat)
  TOOTH: 0.16,           // strength of the fine surface grain in the shading
  MOTTLE: 0.05,          // unevenness of ink and fibre in the colour
  SCREEN_FREQ: 13.0,     // halftone dots per cm
};

const constants = (o) => Object.entries(o).map(([k, v]) => `#define ${k} ${Number.isInteger(v) ? v + '.0' : v}`).join('\n');

const NOISE = `
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
`;

const TONE = `
uniform float u_exposure;
vec3 tone(vec3 c) {
  vec3 x = max(c * u_exposure, 0.0);
  x = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  return pow(clamp(x, 0.0, 1.0), vec3(1.0 / 2.2));
}
`;

// Shared lighting: key with a soft edge that widens with distance from the thing casting it,
// fill patches with one comparison each, and colour bounced back from whatever hides a patch.
const LIGHTS = `
uniform highp sampler2DShadow u_shKey;
uniform highp sampler2D u_shKeyRaw;
uniform highp sampler2DShadow u_shFill;
uniform sampler2D u_shFillCol;
uniform mat4 u_keyMat;
uniform mat4 u_fillMat[NUM_FILL];
uniform vec4 u_fillTile[NUM_FILL];
uniform vec3 u_keyDir;
uniform vec3 u_keyCol;
uniform vec3 u_fillDir[NUM_FILL];
uniform vec3 u_fillCol[NUM_FILL];
uniform vec4 u_soft;      // x: key edge width per unit depth, y: smallest key radius, z: fill radius, w: 1 = one tap each
uniform float u_bounce;
uniform vec3 u_lowCol;
uniform float u_frameNoise;

const vec2 DISC[8] = vec2[8](vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621),
  vec2(0.962, -0.195), vec2(0.473, -0.480), vec2(0.519, 0.767), vec2(0.185, -0.893));

float keyVis(vec3 wp) {
  vec3 s = (u_keyMat * vec4(wp, 1.0)).xyz;
  if (s.x < 0.002 || s.y < 0.002 || s.x > 0.998 || s.y > 0.998 || s.z > 1.0) return 1.0;
  s.z -= 0.0004;
  if (u_soft.w > 0.5) return texture(u_shKey, s);
  float a = ign(gl_FragCoord.xy + u_frameNoise) * 6.2831853;
  mat2 rot = mat2(cos(a), sin(a), -sin(a), cos(a));
  float r = u_soft.y;
#if KEY_BLOCKER > 0
  float sum = 0.0, cnt = 0.0;
  float search = u_soft.x * 0.11;
  for (int i = 0; i < KEY_BLOCKER; i++) {
    float d = texture(u_shKeyRaw, s.xy + rot * DISC[i] * search).r;
    if (d < s.z) { sum += d; cnt += 1.0; }
  }
  if (cnt < 0.5) return 1.0;
  r = clamp((s.z - sum / cnt) * u_soft.x, u_soft.y, u_soft.x * 0.14);
#endif
  float v = 0.0;
  for (int i = 0; i < KEY_TAPS; i++) v += texture(u_shKey, vec3(s.xy + rot * DISC[i] * r, s.z));
  return v / float(KEY_TAPS);
}

// Light from the sky and the room on a surface with normal n. avg returns the mean openness.
vec3 fillLight(vec3 wp, vec3 n, out float avg) {
  vec3 sum = vec3(0.0);
  float open = 0.0, wsum = 0.0;
  vec3 p = wp + n * FILL_BIAS;
  for (int i = 0; i < NUM_FILL; i++) {
    float ndl = dot(n, u_fillDir[i]);
    if (ndl <= 0.0) continue;
    vec3 s = (u_fillMat[i] * vec4(p, 1.0)).xyz;
    float v = 1.0;
    vec3 occ = vec3(0.0);
    if (s.x > 0.01 && s.y > 0.01 && s.x < 0.99 && s.y < 0.99 && s.z < 1.0) {
      vec4 t = u_fillTile[i];
      vec2 uv = t.xy + s.xy * t.zw;
      float z = s.z - 0.0012;
#if FILL_TAPS > 1
      if (u_soft.w > 0.5) {
        v = texture(u_shFill, vec3(uv, z));
      } else {
        vec2 r = u_soft.z * t.zw;
        v = 0.25 * (texture(u_shFill, vec3(uv + vec2(-0.4, -0.9) * r, z)) + texture(u_shFill, vec3(uv + vec2(0.9, -0.4) * r, z))
          + texture(u_shFill, vec3(uv + vec2(0.4, 0.9) * r, z)) + texture(u_shFill, vec3(uv + vec2(-0.9, 0.4) * r, z)));
      }
#else
      v = texture(u_shFill, vec3(uv, z));
#endif
#if BOUNCE > 0
      if (v < 0.995) occ = texture(u_shFillCol, uv).rgb;
#endif
    }
    sum += u_fillCol[i] * ndl * (v + (1.0 - v) * occ * occ * u_bounce);
    open += v * ndl; wsum += ndl;
  }
  avg = wsum > 0.0 ? open / wsum : 0.6;
  return sum;
}
`;

export const CARD_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 a_pos;
layout(location = 1) in vec3 a_nrm;
layout(location = 2) in vec2 a_uv;
layout(location = 3) in vec2 a_frames;
layout(location = 4) in float a_mat;
layout(location = 5) in vec4 a_col;
layout(location = 6) in vec4 a_ink;
uniform highp sampler2D u_frames;
uniform mat4 u_viewProj;
out vec3 v_wpos;
out vec3 v_nrm;
out vec3 v_tx;
out vec3 v_ty;
out vec2 v_local;
out vec2 v_uv;
out vec3 v_col;
out vec4 v_ink;
out float v_kind;
out float v_mat;

void readFrame(float id, out vec3 o, out vec3 x, out vec3 y) {
  int i = int(id + 0.5);
  o = texelFetch(u_frames, ivec2(0, i), 0).xyz;
  x = texelFetch(u_frames, ivec2(1, i), 0).xyz;
  y = texelFetch(u_frames, ivec2(2, i), 0).xyz;
}

void main() {
  vec3 o, x, y;
  readFrame(a_frames.x, o, x, y);
  vec3 n = cross(x, y);
  vec3 wp, wn;
  if (a_pos.w < 0.0) {
    wp = o + x * a_pos.x + y * a_pos.y + n * a_pos.z;
    wn = x * a_nrm.x + y * a_nrm.y + n * a_nrm.z;
    v_local = a_pos.xy;
  } else {
    // A vertex of a bent strip: a curve from the edge of panel A, over the crease, to panel B.
    vec3 o2, x2, y2;
    readFrame(a_frames.y, o2, x2, y2);
    vec3 n2 = cross(x2, y2);
    float u = a_pos.w, h = a_pos.x;
    vec3 pa = o - x * h + y * a_pos.y;
    vec3 pc = o + y * a_pos.y;
    vec3 pb = o2 + x2 * h + y2 * a_pos.y;
    vec3 c = pa * (1.0 - u) * (1.0 - u) + pc * 2.0 * u * (1.0 - u) + pb * u * u;
    vec3 nn = normalize(mix(n, n2, u));
    wp = c + nn * a_pos.z;
    wn = nn * a_nrm.z + y * a_nrm.y;
    x = normalize(mix(x, x2, u));
    v_local = vec2((u - 0.5) * 2.0 * h, a_pos.y);
  }
  v_wpos = wp;
  v_nrm = wn;
  v_tx = x;
  v_ty = y;
  v_local += vec2(a_frames.x * 7.31, a_frames.x * 3.17);
  v_uv = a_uv;
  v_col = pow(a_col.rgb, vec3(2.2));
  v_ink = vec4(pow(a_ink.rgb, vec3(2.2)), a_ink.a);
  v_kind = a_col.a * 255.0;
  v_mat = a_mat;
  gl_Position = u_viewProj * vec4(wp, 1.0);
}
`;

// Depth only (the first pass of the picture) and shadow maps. Shadow maps for the fill also keep
// the colour of the card, which is what bounces.
export const DEPTH_FS = `#version 300 es
precision mediump float;
in vec3 v_col;
out vec4 o_col;
void main() { o_col = vec4(sqrt(v_col), 1.0); }
`;

export const cardFS = (q) => `#version 300 es
precision highp float;
precision highp sampler2DShadow;
#define NUM_FILL ${NUM_FILL}
#define KEY_TAPS ${q.keyTaps}
#define KEY_BLOCKER ${q.keyBlocker}
#define FILL_TAPS ${q.fillTaps}
#define BOUNCE ${q.bounce ? 1 : 0}
${constants(LOOK)}
in vec3 v_wpos;
in vec3 v_nrm;
in vec3 v_tx;
in vec3 v_ty;
in vec2 v_local;
in vec2 v_uv;
in vec3 v_col;
in vec4 v_ink;
in float v_kind;
in float v_mat;
out vec4 o_col;
uniform sampler2D u_atlas;
uniform vec3 u_eye;
uniform float u_blueprint;
uniform float u_linearOut;
${NOISE}
${TONE}
${LIGHTS}
const vec3 CORE = vec3(0.90, 0.875, 0.82);   // bare card, where ink is cut or cracked away

void main() {
  vec3 ng = normalize(v_nrm);
  vec3 base = v_col;
  if (v_uv.x >= 0.0) base = texture(u_atlas, v_uv).rgb;
  float isRim = clamp(v_kind, 0.0, 1.0) * step(v_kind, 1.5);
  float isWall = step(1.5, v_kind) * step(v_kind, 2.5);
  float isBend = step(2.5, v_kind);

  // Halftone screen: a second ink laid down as dots, for tone without a new colour.
  float dens = v_ink.a;
  if (dens > 0.004) {
    vec2 q = mat2(0.866, -0.5, 0.5, 0.866) * v_local * SCREEN_FREQ;
    float fw = max(fwidth(q.x), fwidth(q.y));
    float r = sqrt(dens * 0.62);
    float spot = 1.0 - smoothstep(r - fw, r + fw, length(fract(q) - 0.5));
    float cover = min(1.0, 3.14159 * r * r);
    base = mix(base, base * v_ink.rgb, mix(spot, cover, smoothstep(0.22, 0.55, fw)));
  }
  float thin = step(v_mat, 0.5) + step(1.5, v_mat) * step(v_mat, 2.5);   // card and glue tabs; not boards
  base = mix(base, CORE, isRim * RIM_WHITE + isBend * BEND_WHITE * thin);

  // Tooth and mottle, faded out before they get smaller than a pixel.
  vec2 lp = v_local;
  float px = max(fwidth(lp.x), fwidth(lp.y));
  float a1 = 1.0 - smoothstep(0.25, 0.6, 5.0 * px);
  float a2 = 1.0 - smoothstep(0.25, 0.6, 23.0 * px);
  float a3 = 1.0 - smoothstep(0.25, 0.6, 61.0 * px);
  float m1 = vnoise(lp * 5.0), m2 = vnoise(lp * 23.0), m3 = vnoise(lp * 61.0);
  base *= 1.0 + ((m1 - 0.5) * a1 + (m2 - 0.5) * a2 * 0.9 + (m3 - 0.5) * a3 * 0.8) * MOTTLE * 2.0;
  vec2 wave = vec2(vnoise(lp * 0.17 + 3.1), vnoise(lp * 0.17 + 9.7)) - 0.5;
  vec2 grain = vec2(vnoise(lp * 23.0 + 17.3), vnoise(lp * 23.0 + 41.7)) - 0.5;
  vec2 tilt = (wave * COCKLE + grain * a2 * TOOTH) * (1.0 - isWall);
  vec3 n = normalize(ng + v_tx * tilt.x + v_ty * tilt.y);

  if (u_blueprint > 0.0) {
    vec3 dummy = abs(v_mat - 2.0) < 0.5 ? vec3(0.22, 0.55, 0.78) : vec3(0.80, 0.80, 0.76);
    base = mix(base, dummy, u_blueprint * (abs(v_mat - 2.0) < 0.5 ? 0.95 : 0.86));
  }

  // The key. A thin sheet lit from behind lets some of it through.
  float ndl = dot(n, u_keyDir);
  float gdl = dot(ng, u_keyDir);
  vec3 look = v_wpos + ng * (gdl >= 0.0 ? KEY_BIAS : -(KEY_BIAS + CARD_THICK));
  float vis = keyVis(look);
  float lit = gdl >= 0.0 ? max(ndl, 0.0) : -gdl * TRANSMIT * thin;
  vec3 light = u_keyCol * vis * lit;
  if (gdl < 0.0) light *= mix(vec3(1.0), sqrt(base), 0.6);

  float open;
  light += fillLight(v_wpos, n, open);
  light += u_lowCol * (0.5 - 0.5 * n.y) * (0.35 + 0.65 * open);

  vec3 col = base * light;
  o_col = vec4(u_linearOut > 0.5 ? col : tone(col), 1.0);
}
`;

export const GROUND_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 a_p;
uniform mat4 u_viewProj;
uniform float u_groundSize;
out vec3 v_wpos;
void main() {
  v_wpos = vec3(a_p.x * u_groundSize, 0.0, a_p.y * u_groundSize);
  gl_Position = u_viewProj * vec4(v_wpos, 1.0);
}
`;

// The table: oak boards drawn from noise, a soft sheen towards the window, fading to the backdrop.
export const groundFS = (q) => `#version 300 es
precision highp float;
precision highp sampler2DShadow;
#define NUM_FILL ${NUM_FILL}
#define KEY_TAPS ${q.keyTaps}
#define KEY_BLOCKER ${q.keyBlocker}
#define FILL_TAPS ${q.fillTaps}
#define BOUNCE ${q.bounce ? 1 : 0}
${constants(LOOK)}
in vec3 v_wpos;
out vec4 o_col;
uniform vec3 u_eye;
uniform vec3 u_bg;
uniform float u_linearOut;
uniform float u_blueprint;
${NOISE}
${TONE}
${LIGHTS}
const float PLANK = 11.5;      // cm, width of a board
const float BOARD_LEN = 120.0; // cm, length of a board

void main() {
  vec2 p = v_wpos.xz;
  float px = max(fwidth(p.x), fwidth(p.y));
  float row = floor(p.y / PLANK), fy = fract(p.y / PLANK);
  float along = p.x + hash21(vec2(row, 3.0)) * BOARD_LEN;
  float board = floor(along / BOARD_LEN);
  float seed = hash21(vec2(row, board));
  vec2 q = vec2(along * 0.045, (fy + seed * 9.0) * 1.0);
  float warp = vnoise(q * vec2(1.3, 2.6));
  float streak = vnoise(vec2(q.x * 1.2 + warp, q.y * 15.0 + warp * 2.2));
  float rings = 0.5 + 0.5 * sin((q.y * 5.5 + vnoise(q * vec2(0.7, 1.9)) * 2.6) * 6.2831853);
  float fa = 1.0 - smoothstep(0.25, 0.6, 30.0 * px);
  float pore = vnoise(vec2(along * 1.6, p.y * 30.0)) * fa + 0.5 * (1.0 - fa);
  float t = streak * 0.5 + rings * 0.3 + pore * 0.2;
  vec3 alb = mix(vec3(0.105, 0.062, 0.034), vec3(0.215, 0.138, 0.078), t) * (0.84 + 0.32 * seed);
  float seam = min(fy, 1.0 - fy) * PLANK;
  float butt = min(fract(along / BOARD_LEN), 1.0 - fract(along / BOARD_LEN)) * BOARD_LEN;
  float gap = smoothstep(0.02, 0.07 + px, min(seam, butt));
  alb *= mix(0.32, 1.0, gap);
  if (u_blueprint > 0.0) alb = mix(alb, vec3(0.16, 0.2, 0.25), u_blueprint * 0.85);

  vec3 n = vec3(0.0, 1.0, 0.0);
  float vis = keyVis(v_wpos + n * KEY_BIAS);
  // The window lights a pool round the book; the far table falls away.
  float pool = mix(1.0, 0.42, smoothstep(30.0, 190.0, length(p - vec2(-8.0, -6.0))));
  vec3 light = u_keyCol * vis * max(u_keyDir.y, 0.0) * pool;
  float open;
  light += fillLight(v_wpos, n, open) * mix(1.0, 0.6, 1.0 - pool);
  vec3 col = alb * light;
  // Waxed wood: a broad, dull reflection of the window.
  vec3 v = normalize(u_eye - v_wpos);
  vec3 hlf = normalize(v + u_keyDir);
  float fres = 0.04 + 0.5 * pow(1.0 - max(v.y, 0.0), 4.0);
  col += u_keyCol * vis * pool * fres * pow(max(hlf.y, 0.0), 26.0) * (0.35 + 0.5 * streak) * 0.5;
  float far = smoothstep(120.0, 330.0, length(p));
  col = mix(col, u_bg, far);
  o_col = vec4(u_linearOut > 0.5 ? col : tone(col), 1.0);
}
`;

export const QUAD_VS = `#version 300 es
layout(location = 0) in vec2 a_p;
out vec2 v_uv;
void main() { v_uv = a_p * 0.5 + 0.5; gl_Position = vec4(a_p, 0.0, 1.0); }
`;

// Plain copy, used to add one finished frame into the running average.
export const COPY_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_col;
uniform sampler2D u_src;
uniform float u_alpha;
void main() { o_col = vec4(texture(u_src, v_uv).rgb, u_alpha); }
`;

// To the screen: tone curve (if the source is linear light), vignette and a little film grain.
export const PRESENT_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o_col;
uniform sampler2D u_src;
uniform float u_hdr;
uniform float u_vignette;
uniform float u_grain;
uniform float u_frameNoise;
${NOISE}
${TONE}
void main() {
  vec3 c = texture(u_src, v_uv).rgb;
  if (u_hdr > 0.5) c = tone(c);
  vec2 q = (v_uv - 0.5) * vec2(1.0, 0.86);
  c *= 1.0 - u_vignette * smoothstep(0.28, 0.82, length(q));
  c += (hash21(gl_FragCoord.xy + u_frameNoise) - 0.5) * u_grain;
  o_col = vec4(c, 1.0);
}
`;
