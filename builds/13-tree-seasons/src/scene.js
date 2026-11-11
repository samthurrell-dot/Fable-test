// src/scene.js
// Draws the tree and its meadow. Scene content only: the growing lives in engine/tree.js,
// the calendar in engine/seasons.js and the WebGL plumbing in engine/glkit.js.
//
//   const scene = createScene(canvas, tree, quality);
//   scene.resize(widthPx, heightPx);
//   scene.render({ time, year, eye, target, fovY, focus });

import { createProgram, setUniforms, createBuffer, bindAttributes, createShadowTarget, createSceneTarget } from '../engine/glkit.js';
import * as M from '../engine/mat4.js';
import { LEAF_STRIDE, LEAF_LAYOUT, MESH_STRIDE, mulberry32 } from '../engine/tree.js';
import { seasonState, leafSchedule, blossomSchedule, TIMING } from '../engine/seasons.js';
import { SHADERS } from './shaders.js';

const NEAR = 2;                 // metres
const FAR = 4000;               // metres
const GROUND_HALF = 1500;       // half size of the ground square, metres
const SHADOW_DEPTH_RANGE = 170; // metres the shadow camera covers along the sun's direction
const GRASS_RADIUS = 26;        // blades are scattered inside this radius, metres
const EXPOSURE = 0.92;          // overall brightness before the film curve
const COC_SCALE_1080 = 460;     // blur strength at 1080 px height (see shaders.js, uCocScale)

function leafMesh() {
  // Midrib points and edge points of one ovate leaf, zipped into triangles.
  const midY = [0, 0.2, 0.45, 0.72, 1];
  const edgeY = [0.12, 0.36, 0.62, 0.85];
  const edgeW = [0.62, 1.0, 0.8, 0.42];
  const v = [], idx = [];
  for (const y of midY) v.push(0, y, 0);
  const addSide = (sign) => {
    const base = v.length / 3;
    for (let k = 0; k < edgeY.length; k++) v.push(sign * edgeW[k], edgeY[k], 1);
    for (let k = 0; k < 4; k++) {
      idx.push(k, base + k, k + 1);
      if (k < 3) idx.push(base + k, base + k + 1, k + 1);
    }
  };
  addSide(-1); addSide(1);
  return { vertices: new Float32Array(v), indices: new Uint16Array(idx) };
}

function quadMesh() {
  return {
    vertices: new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  };
}

export function createScene(canvas, tree, quality) {
  const gl = canvas.getContext('webgl2', {
    antialias: false, alpha: false, depth: false, stencil: false,
    powerPreference: 'high-performance', preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error('WebGL2 is not available in this browser.');
  const hdr = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));

  const P = {
    bark: createProgram(gl, SHADERS.barkVS, SHADERS.barkFS, 'bark'),
    barkShadow: createProgram(gl, SHADERS.barkShadowVS, SHADERS.depthOnlyFS, 'bark shadow'),
    leaf: createProgram(gl, SHADERS.leafVS, SHADERS.leafFS, 'leaf'),
    leafShadow: createProgram(gl, SHADERS.leafShadowVS, SHADERS.depthOnlyFS, 'leaf shadow'),
    ground: createProgram(gl, SHADERS.groundVS, SHADERS.groundFS, 'ground'),
    grass: createProgram(gl, SHADERS.grassVS, SHADERS.grassFS, 'grass'),
    sky: createProgram(gl, SHADERS.screenVS, SHADERS.skyFS, 'sky'),
    flake: createProgram(gl, SHADERS.flakeVS, SHADERS.flakeFS, 'snowflakes'),
    post: createProgram(gl, SHADERS.screenVS, SHADERS.postFS, 'lens'),
  };

  // --- Bark ---------------------------------------------------------------------------------
  const barkVao = gl.createVertexArray();
  gl.bindVertexArray(barkVao);
  bindAttributes(gl, createBuffer(gl, gl.ARRAY_BUFFER, tree.mesh.vertices), MESH_STRIDE, [
    { loc: 0, size: 3, offset: 0 }, { loc: 1, size: 3, offset: 3 }, { loc: 2, size: 3, offset: 6 }, { loc: 3, size: 1, offset: 9 },
  ]);
  createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, tree.mesh.indices);
  const barkIndexCount = tree.mesh.indices.length;

  // --- Leaves and blossom -------------------------------------------------------------------
  function foliageVao(mesh, records, count, scheduleFn) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    bindAttributes(gl, createBuffer(gl, gl.ARRAY_BUFFER, mesh.vertices), 3, [{ loc: 0, size: 3, offset: 0 }]);
    createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, mesh.indices);
    bindAttributes(gl, createBuffer(gl, gl.ARRAY_BUFFER, records), LEAF_STRIDE, [
      { loc: 1, size: 3, offset: LEAF_LAYOUT.position },
      { loc: 2, size: 3, offset: LEAF_LAYOUT.axis },
      { loc: 3, size: 3, offset: LEAF_LAYOUT.normal },
      { loc: 4, size: 4, offset: LEAF_LAYOUT.random },
      { loc: 6, size: 3, offset: LEAF_LAYOUT.heightNorm },
    ], 1);
    const sched = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const o = i * LEAF_STRIDE;
      const s = scheduleFn(records[o + 9], records[o + 11], records[o + 13], records[o + 14]);
      sched[i * 3] = s[0]; sched[i * 3 + 1] = s[1]; sched[i * 3 + 2] = s[2];
    }
    bindAttributes(gl, createBuffer(gl, gl.ARRAY_BUFFER, sched), 3, [{ loc: 5, size: 3, offset: 0 }], 1);
    return { vao, count, indexCount: mesh.indices.length };
  }
  const leaves = foliageVao(leafMesh(), tree.leaves, tree.leafCount, leafSchedule);
  const blossoms = foliageVao(quadMesh(), tree.blossoms, tree.blossomCount, (a, b, h) => blossomSchedule(a, b, h));

  // --- Ground and grass ---------------------------------------------------------------------
  const groundVao = gl.createVertexArray();
  gl.bindVertexArray(groundVao);
  const G = GROUND_HALF;
  bindAttributes(gl, createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([-G, -G, G, -G, G, G, -G, -G, G, G, -G, G])), 2, [{ loc: 0, size: 2, offset: 0 }]);

  const rnd = mulberry32(977);
  const bladeCount = quality.grassBlades;
  const blades = new Float32Array(bladeCount * 6);
  for (let i = 0; i < bladeCount; i++) {
    const r = 0.5 + GRASS_RADIUS * Math.pow(rnd(), 0.7), a = rnd() * Math.PI * 2;
    blades[i * 6] = Math.cos(a) * r;
    blades[i * 6 + 1] = Math.sin(a) * r;
    blades[i * 6 + 2] = 0.16 + 0.3 * rnd() * rnd() + (r < 2 ? -0.06 : 0);
    blades[i * 6 + 3] = rnd() * Math.PI * 2;
    blades[i * 6 + 4] = rnd();
    blades[i * 6 + 5] = rnd();
  }
  const grassVao = gl.createVertexArray();
  gl.bindVertexArray(grassVao);
  bindAttributes(gl, createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([-1, 0, 1, 0, -1, 0.5, 1, 0.5, 0, 1])), 2, [{ loc: 0, size: 2, offset: 0 }]);
  createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 1, 3, 2, 2, 3, 4]));
  bindAttributes(gl, createBuffer(gl, gl.ARRAY_BUFFER, blades), 6, [{ loc: 1, size: 4, offset: 0 }, { loc: 2, size: 2, offset: 4 }], 1);

  // --- Snowflakes ---------------------------------------------------------------------------
  const flakeCount = quality.snowflakes;
  const flakeSeeds = new Float32Array(flakeCount * 4);
  for (let i = 0; i < flakeSeeds.length; i++) flakeSeeds[i] = rnd();
  const flakeVao = gl.createVertexArray();
  gl.bindVertexArray(flakeVao);
  bindAttributes(gl, createBuffer(gl, gl.ARRAY_BUFFER, flakeSeeds), 4, [{ loc: 0, size: 4, offset: 0 }]);

  const emptyVao = gl.createVertexArray();
  gl.bindVertexArray(null);

  // --- Targets ------------------------------------------------------------------------------
  const shadow = createShadowTarget(gl, quality.shadowSize);
  let target = null;
  let samples = quality.msaa;
  function resize(w, h) {
    w = Math.max(2, Math.floor(w)); h = Math.max(2, Math.floor(h));
    if (target && target.w === w && target.h === h) return;
    if (target) target.dispose();
    canvas.width = w; canvas.height = h;
    target = createSceneTarget(gl, w, h, { hdr, samples });
    samples = target.samples;
  }

  const shadowBias = new Float32Array([0.5, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0.5, 0, 0.5, 0.5, 0.5, 1]);
  const info = { hdr, msaa: 0, leaves: tree.leafCount, blossoms: tree.blossomCount, triangles: 0 };

  function render(frame) {
    const st = seasonState(frame.year);
    const y = st.year;
    const w = target.w, h = target.h;
    const aspect = w / h;

    const view = M.lookAt(frame.eye, frame.target, [0, 1, 0]);
    const proj = M.perspective(frame.fovY, aspect, NEAR, FAR);
    const viewProj = M.multiply(proj, view);

    // The shadow camera looks down the sun's rays at the whole tree.
    const b = tree.bounds;
    const R = b.radius + 1.5;
    const c = [0, b.centreY, 0];
    const sunEye = [c[0] + st.sunDir[0] * 80, c[1] + st.sunDir[1] * 80, c[2] + st.sunDir[2] * 80];
    const shadowVP = M.multiply(M.ortho(-R, R, -R, R, 1, SHADOW_DEPTH_RANGE), M.lookAt(sunEye, c, [0, 1, 0]));

    const U = {
      uViewProj: viewProj,
      uShadowMat: M.multiply(shadowBias, shadowVP),
      uInvViewProj: M.invert(viewProj),
      uCam: frame.eye,
      uSunDir: st.sunDir, uSunCol: st.sunColour,
      uSkyAmb: st.skyAmbient, uGroundAmb: st.groundAmbient,
      uFogCol: st.fog, uFogDensity: st.fogDensity,
      uTime: frame.time, uYear: y,
      uWind: st.wind, uWindDir: st.windDir,
      uSnow: st.snow,
      uShadowStrength: st.shadow, uShadowTexel: 1 / shadow.size,
      uLdr: hdr ? 0 : 1,
      uShadowMap: 0, uColor: 1, uDepth: 2,
      uYearSeconds: frame.yearSeconds,
      uGrowDur: TIMING.LEAF_GROW_DUR, uTurnDur: TIMING.LEAF_TURN_DUR,
      uSizeMul: quality.leafSizeMul,
      uGrassA: st.grassDark, uGrassB: st.grassLight, uGrassH: st.grassHeight,
      uCanopy: st.canopy,
      uZenith: st.zenith, uHorizon: st.horizon, uHill: st.hill, uCloud: st.cloud,
      uFlakes: st.snowFall, uFlakeCentre: [frame.eye[0] * 0.5, 0, frame.eye[2] * 0.5],
      uPixels: h, uFovScale: 1 / Math.tan(frame.fovY / 2),
    };

    const leavesOut = y > TIMING.LEAF_GROW_START && y < TIMING.LEAF_FADE[1];
    const blossomOut = y > TIMING.BLOSSOM_OPEN_START && y < TIMING.BLOSSOM_FADE[1];
    const drawFoliage = (prog, extra) => {
      gl.useProgram(prog.program);
      setUniforms(gl, prog, U);
      setUniforms(gl, prog, extra || {});
      if (leavesOut) {
        setUniforms(gl, prog, { uKind: 0, uFade: TIMING.LEAF_FADE, uGrowDur: TIMING.LEAF_GROW_DUR });
        gl.bindVertexArray(leaves.vao);
        gl.drawElementsInstanced(gl.TRIANGLES, leaves.indexCount, gl.UNSIGNED_SHORT, 0, leaves.count);
      }
      if (blossomOut) {
        setUniforms(gl, prog, { uKind: 1, uFade: TIMING.BLOSSOM_FADE, uGrowDur: TIMING.BLOSSOM_OPEN_DUR });
        gl.bindVertexArray(blossoms.vao);
        gl.drawElementsInstanced(gl.TRIANGLES, blossoms.indexCount, gl.UNSIGNED_SHORT, 0, blossoms.count);
      }
    };

    // 1. Shadow map.
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadow.fbo);
    gl.viewport(0, 0, shadow.size, shadow.size);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
    gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2, 4);
    gl.useProgram(P.barkShadow.program);
    setUniforms(gl, P.barkShadow, U);
    setUniforms(gl, P.barkShadow, { uViewProj: shadowVP });
    gl.bindVertexArray(barkVao);
    gl.drawElements(gl.TRIANGLES, barkIndexCount, gl.UNSIGNED_INT, 0);
    drawFoliage(P.leafShadow, { uViewProj: shadowVP });
    gl.disable(gl.POLYGON_OFFSET_FILL);

    // 2. The scene.
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.drawFbo);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, shadow.depth);

    // Nearest things first, so the depth test saves shading the ground and sky behind them.
    gl.useProgram(P.bark.program);
    setUniforms(gl, P.bark, U);
    gl.bindVertexArray(barkVao);
    gl.drawElements(gl.TRIANGLES, barkIndexCount, gl.UNSIGNED_INT, 0);

    gl.useProgram(P.grass.program);
    setUniforms(gl, P.grass, U);
    gl.bindVertexArray(grassVao);
    gl.drawElementsInstanced(gl.TRIANGLES, 9, gl.UNSIGNED_SHORT, 0, bladeCount);

    drawFoliage(P.leaf);

    gl.useProgram(P.ground.program);
    setUniforms(gl, P.ground, U);
    gl.bindVertexArray(groundVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.depthMask(false);
    gl.useProgram(P.sky.program);
    setUniforms(gl, P.sky, U);
    setUniforms(gl, P.sky, { uZ: 1 });
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.depthMask(true);

    if (st.snowFall > 0.001) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      gl.useProgram(P.flake.program);
      setUniforms(gl, P.flake, U);
      gl.bindVertexArray(flakeVao);
      gl.drawArrays(gl.POINTS, 0, flakeCount);
      gl.disable(gl.BLEND); gl.depthMask(true);
    }
    target.resolve();

    // 3. The lens.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, target.color);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, target.depth);
    gl.useProgram(P.post.program);
    const res = h / 1080;
    setUniforms(gl, P.post, {
      uZ: 0, uColor: 1, uDepth: 2, uPx: [1 / w, 1 / h], uNear: NEAR, uFar: FAR,
      uFocus: frame.focus, uCocScale: COC_SCALE_1080 * res * quality.blur,
      uMaxCoc: Math.max(2, quality.maxBlurPx * res), uRadStep: Math.max(0.8, quality.blurStep * Math.max(res, 0.6)),
      uExposure: EXPOSURE, uSat: st.saturation, uTint: st.tint, uTime: frame.time, uLdr: hdr ? 0 : 1,
    });
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);

    info.msaa = samples;
    info.triangles = barkIndexCount / 3 + (leavesOut ? leaves.count * leaves.indexCount / 3 : 0) + (blossomOut ? blossoms.count * 2 : 0) + bladeCount * 3;
    return st;
  }

  // Turn multisampling on or off after start-up (0 = off). The target is rebuilt on the next resize.
  function setMsaa(n) {
    samples = n;
    if (target) { const w = target.w, h = target.h; target.dispose(); target = null; resize(w, h); }
  }

  return { gl, resize, render, info, setMsaa };
}
