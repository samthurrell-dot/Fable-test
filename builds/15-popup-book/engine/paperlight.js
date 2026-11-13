// engine/paperlight.js
// A small WebGL2 renderer for scenes made of card (meshes from cardmesh.js, frames from fold.js).
//
// Two ways of drawing the same scene with the same shader:
//   moving  one frame at a time: each light has one shadow map, edges are softened with a few
//           extra samples, multisampling smooths the picture.
//   still   when nothing has changed, frames are added up. Every frame moves each light to a new
//           point of the window or sky it stands for, shifts the picture by part of a pixel and
//           moves the lens across its aperture. The mean of these is true soft shadow, clean edges
//           and depth of field. After `samples` frames the picture is finished and drawing stops.
//
// createPaperRenderer(canvas, quality) returns the renderer. See render() for what a frame needs.

import * as m4 from './mat4.js';
import { createPrograms, setUniforms, createBuffer, createTexture, createShadowTarget, createSceneTarget } from './glkit.js';
import { NUM_FILL, CARD_VS, DEPTH_FS, cardFS, GROUND_VS, groundFS, QUAD_VS, COPY_FS, PRESENT_FS } from './papershaders.js';

export const QUALITY = {
  high: { keySize: 2048, fillSize: 512, keyTaps: 8, keyBlocker: 5, fillTaps: 4, bounce: true, msaa: 4, samples: 72, aniso: 4 },
  low: { keySize: 1024, fillSize: 256, keyTaps: 5, keyBlocker: 3, fillTaps: 1, bounce: true, msaa: 4, samples: 40, aniso: 2 },
};

// The light. Directions point from the scene to the light. Colours are linear.
export const LIGHT_RIG = {
  key: { dir: [-0.6, 0.6, -0.53], col: [3.5, 3.25, 2.85], size: 4.5 },   // size: half angle of the window in degrees
  fill: [
    { dir: [0.0, 1.0, 0.05], col: [0.216, 0.238, 0.274], cone: 34 },      // ceiling
    { dir: [-0.5, 0.62, -0.6], col: [0.245, 0.274, 0.331], cone: 30 },    // sky through the window
    { dir: [0.82, 0.42, 0.38], col: [0.288, 0.259, 0.216], cone: 34 },    // white card held to the right
    { dir: [0.08, 0.5, 0.86], col: [0.187, 0.18, 0.18], cone: 34 },     // the room behind the camera
    { dir: [-0.76, 0.42, 0.5], col: [0.13, 0.137, 0.151], cone: 34 },
    { dir: [0.55, 0.52, -0.66], col: [0.108, 0.108, 0.115], cone: 34 },
  ],
  low: [0.15, 0.12, 0.09],     // light coming up off the table and pages
  bounce: 0.42,               // share of a hidden patch of sky that the hiding card gives back, in its own colour
  centre: [0, 6, 0],          // middle of the volume that casts shadows
  radius: 52,                 // its radius in cm
  exposure: 0.42,
  background: [0.050, 0.043, 0.038],
  vignette: 0.3,
  grain: 0.018,
};

const R2A = 0.7548776662466927, R2B = 0.5698402909980532;   // steps of a low-discrepancy sequence
const seq = (n, k) => {
  const a = (0.5 + n * R2A + k * 0.371) % 1, b = (0.5 + n * R2B + k * 0.613) % 1;
  return [a, b];
};
const disc = ([a, b]) => { const r = Math.sqrt(a), t = b * Math.PI * 2; return [r * Math.cos(t), r * Math.sin(t)]; };
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function createPaperRenderer(canvas, quality = QUALITY.high, rig = LIGHT_RIG) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is not available.');
  const hdrOk = !!gl.getExtension('EXT_color_buffer_float');
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  const q = { ...quality };

  const progs = createPrograms(gl, {
    card: [CARD_VS, cardFS(q)],
    depth: [CARD_VS, DEPTH_FS],
    ground: [GROUND_VS, groundFS(q)],
    copy: [QUAD_VS, COPY_FS],
    present: [QUAD_VS, PRESENT_FS],
  });

  // --- Geometry -----------------------------------------------------------------------------------
  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  createBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  let meshVao = null, ranges = {};
  const atlasOf = {};
  function setMesh(mesh) {
    meshVao = gl.createVertexArray();
    gl.bindVertexArray(meshVao);
    createBuffer(gl, gl.ARRAY_BUFFER, mesh.f32);
    const S = 48;
    [[0, 4, 0], [1, 3, 16], [2, 2, 28], [3, 2, 36], [4, 1, 44]].forEach(([loc, size, off]) => {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, S, off);
    });
    createBuffer(gl, gl.ARRAY_BUFFER, mesh.u8);
    gl.enableVertexAttribArray(5);
    gl.vertexAttribPointer(5, 4, gl.UNSIGNED_BYTE, true, 8, 0);
    gl.enableVertexAttribArray(6);
    gl.vertexAttribPointer(6, 4, gl.UNSIGNED_BYTE, true, 8, 4);
    createBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, mesh.idx);
    gl.bindVertexArray(null);
    ranges = mesh.ranges;
  }

  // One print atlas for one or more groups of the mesh.
  function setAtlas(groupIds, source) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(q.aniso, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    for (const id of groupIds) atlasOf[id] = t;
  }

  // Frames as a float texture, three texels a row: origin, x axis, y axis.
  const frameTex = gl.createTexture();
  let frameRows = 0;
  function setFrames(data, count) {
    gl.bindTexture(gl.TEXTURE_2D, frameTex);
    if (count !== frameRows) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 3, count, 0, gl.RGBA, gl.FLOAT, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      frameRows = count;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 3, count, gl.RGBA, gl.FLOAT, data);
    }
  }

  // --- Shadow maps --------------------------------------------------------------------------------
  const key = createShadowTarget(gl, q.keySize);
  const rawSampler = gl.createSampler();   // reads the key map as plain depth, for the blocker search
  gl.samplerParameteri(rawSampler, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.samplerParameteri(rawSampler, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.samplerParameteri(rawSampler, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.samplerParameteri(rawSampler, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.samplerParameteri(rawSampler, gl.TEXTURE_COMPARE_MODE, gl.NONE);

  const TILES_X = 3, TILES_Y = Math.ceil(NUM_FILL / 3);
  const fill = { w: q.fillSize * TILES_X, h: q.fillSize * TILES_Y };
  fill.depth = createTexture(gl, fill.w, fill.h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  fill.color = createTexture(gl, fill.w, fill.h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);
  fill.fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fill.fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fill.color, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, fill.depth, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const DEPTH_RANGE = rig.radius * 2.4;
  // World to shadow map for a light in direction dir. Returns { viewProj, toUnit }.
  function lightMatrices(dir) {
    const d = norm(dir), c = rig.centre, R = rig.radius;
    const eye = [c[0] + d[0] * R * 1.2, c[1] + d[1] * R * 1.2, c[2] + d[2] * R * 1.2];
    const up = Math.abs(d[1]) > 0.95 ? [0, 0, -1] : [0, 1, 0];
    const viewProj = m4.multiply(m4.ortho(-R, R, -R, R, 0.01, DEPTH_RANGE), m4.lookAt(eye, c, up));
    const bias = m4.identity();
    bias[0] = bias[5] = bias[10] = 0.5; bias[12] = bias[13] = bias[14] = 0.5;
    return { viewProj, toUnit: m4.multiply(bias, viewProj) };
  }
  // A direction moved off its axis by (jx, jy) times the tangent of an angle in degrees.
  function tilted(dir, [jx, jy], degrees) {
    const d = norm(dir), k = Math.tan((degrees * Math.PI) / 180);
    const t1 = norm(cross(Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], d)), t2 = cross(d, t1);
    return norm([d[0] + (t1[0] * jx + t2[0] * jy) * k, d[1] + (t1[1] * jx + t2[1] * jy) * k, d[2] + (t1[2] * jx + t2[2] * jy) * k]);
  }

  const lights = {
    keyDir: norm(rig.key.dir), keyMat: null, keyVP: null,
    fillDir: new Float32Array(NUM_FILL * 3), fillCol: new Float32Array(NUM_FILL * 3),
    fillMat: new Float32Array(NUM_FILL * 16), fillTile: new Float32Array(NUM_FILL * 4), fillVP: [],
  };
  rig.fill.forEach((f, i) => {
    lights.fillCol.set(f.col, i * 3);
    lights.fillTile.set([(i % TILES_X) / TILES_X, Math.floor(i / TILES_X) / TILES_Y, 1 / TILES_X, 1 / TILES_Y], i * 4);
  });
  function aimKey(dir) {
    lights.keyDir = dir;
    const m = lightMatrices(dir);
    lights.keyMat = m.toUnit; lights.keyVP = m.viewProj;
  }
  function aimFill(i, dir) {
    lights.fillDir.set(dir, i * 3);
    const m = lightMatrices(dir);
    lights.fillMat.set(m.toUnit, i * 16);
    lights.fillVP[i] = m.viewProj;
  }
  aimKey(norm(rig.key.dir));
  rig.fill.forEach((f, i) => aimFill(i, norm(f.dir)));

  function drawSolid(groups) {
    for (const id of groups) {
      const r = ranges[id];
      if (r && r.solid[1]) gl.drawElements(gl.TRIANGLES, r.solid[1], gl.UNSIGNED_INT, r.solid[0] * 4);
    }
  }

  function bindFrames(prog) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, frameTex);
    gl.uniform1i(prog.uniforms.u_frames.loc, 0);
  }

  function drawKeyMap(groups) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, key.fbo);
    gl.viewport(0, 0, key.size, key.size);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(progs.depth.uniforms.u_viewProj.loc, false, lights.keyVP);
    drawSolid(groups);
  }
  function drawFillMap(i, groups) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fill.fbo);
    const x = (i % TILES_X) * q.fillSize, y = Math.floor(i / TILES_X) * q.fillSize;
    gl.viewport(x, y, q.fillSize, q.fillSize);
    gl.scissor(x, y, q.fillSize, q.fillSize);
    gl.enable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
    gl.uniformMatrix4fv(progs.depth.uniforms.u_viewProj.loc, false, lights.fillVP[i]);
    drawSolid(groups);
    gl.disable(gl.SCISSOR_TEST);
  }
  // which: array of fill indices to redraw; withKey: redraw the key map too.
  function drawShadowMaps(groups, withKey, which) {
    gl.useProgram(progs.depth.program);
    bindFrames(progs.depth);
    gl.bindVertexArray(meshVao);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.FRONT);    // the far side of each sheet goes in the map, so the lit side never shades itself
    if (withKey) drawKeyMap(groups);
    for (const i of which) drawFillMap(i, groups);
    gl.cullFace(gl.BACK);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // --- Targets ------------------------------------------------------------------------------------
  let live = null;        // multisampled, tone-mapped: the moving picture
  let hdrFrame = null;    // one frame of linear light
  let accum = null;       // the running mean
  let scale = 1;
  function makeTargets() {
    if (live) live.dispose();
    if (hdrFrame) hdrFrame.dispose();
    if (accum) { gl.deleteTexture(accum.tex); gl.deleteFramebuffer(accum.fbo); }
    const w = Math.max(2, Math.round(canvas.width * scale)), h = Math.max(2, Math.round(canvas.height * scale));
    live = createSceneTarget(gl, w, h, { hdr: false, samples: q.msaa });
    hdrFrame = createSceneTarget(gl, canvas.width, canvas.height, { hdr: hdrOk, samples: 0 });
    accum = { tex: createTexture(gl, canvas.width, canvas.height, hdrOk ? gl.RGBA16F : gl.RGBA8, gl.RGBA, hdrOk ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, gl.LINEAR), fbo: gl.createFramebuffer() };
    gl.bindFramebuffer(gl.FRAMEBUFFER, accum.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, accum.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    state.samples = 0;
  }
  const state = { samples: 0, dirtyKey: true, dirtyFill: new Array(NUM_FILL).fill(true), jittered: false, frame: 0, lastCam: '' };
  function resize(w, h) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h));
    if (canvas.width === w && canvas.height === h && live) return;
    canvas.width = w; canvas.height = h;
    makeTargets();
  }
  function setScale(s) {
    if (Math.abs(s - scale) < 0.004) return;
    scale = s;
    if (canvas.width > 2) makeTargets();
  }

  // --- One picture of the scene into the bound target -------------------------------------------------
  const U = {};
  function drawScene(view, cam, target, linear, soft) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.drawFbo);
    gl.viewport(0, 0, target.w, target.h);
    const bg = rig.background;
    if (linear) gl.clearColor(bg[0], bg[1], bg[2], 1);
    else {
      const t = (c) => { const x = c * rig.exposure, y = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14); return Math.pow(Math.min(1, Math.max(0, y)), 1 / 2.2); };
      gl.clearColor(t(bg[0]), t(bg[1]), t(bg[2]), 1);
    }
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // Depth first, so the costly shader runs once a pixel.
    gl.bindVertexArray(meshVao);
    gl.useProgram(progs.depth.program);
    bindFrames(progs.depth);
    gl.uniformMatrix4fv(progs.depth.uniforms.u_viewProj.loc, false, cam.viewProj);
    gl.colorMask(false, false, false, false);
    gl.depthFunc(gl.LESS);
    for (const id of view.groups) {
      const r = ranges[id];
      if (r) gl.drawElements(gl.TRIANGLES, r.solid[1] + r.rim[1], gl.UNSIGNED_INT, r.solid[0] * 4);
    }
    gl.colorMask(true, true, true, true);

    const keySlope = (DEPTH_RANGE * Math.tan((rig.key.size * Math.PI) / 180)) / (2 * rig.radius);
    Object.assign(U, {
      u_viewProj: cam.viewProj, u_eye: cam.eye, u_frames: 0, u_atlas: 1, u_shKey: 2, u_shKeyRaw: 3, u_shFill: 4, u_shFillCol: 5,
      u_keyMat: lights.keyMat, u_keyDir: lights.keyDir, u_keyCol: rig.key.col,
      u_fillMat: lights.fillMat, u_fillTile: lights.fillTile, u_fillDir: lights.fillDir, u_fillCol: lights.fillCol,
      u_soft: [keySlope, 1.2 / q.keySize, 2.6 / q.fillSize, soft ? 0 : 1],
      u_bounce: rig.bounce, u_lowCol: rig.low, u_frameNoise: soft ? (state.frame % 64) * 7.13 : state.samples * 3.71,
      u_blueprint: view.blueprint || 0, u_linearOut: linear ? 1 : 0, u_exposure: rig.exposure, u_bg: rig.background, u_groundSize: 600,
    });
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, key.depth); gl.bindSampler(2, null);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, key.depth); gl.bindSampler(3, rawSampler);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, fill.depth);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, fill.color);

    gl.useProgram(progs.card.program);
    setUniforms(gl, progs.card, U);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(false);
    gl.activeTexture(gl.TEXTURE1);
    for (const id of view.groups) {
      const r = ranges[id];
      if (!r) continue;
      gl.bindTexture(gl.TEXTURE_2D, atlasOf[id] || null);
      gl.drawElements(gl.TRIANGLES, r.solid[1] + r.rim[1], gl.UNSIGNED_INT, r.solid[0] * 4);
    }
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);

    gl.useProgram(progs.ground.program);
    setUniforms(gl, progs.ground, U);
    gl.bindVertexArray(quadVao);
    gl.disable(gl.CULL_FACE);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindSampler(3, null);
    target.resolve();
  }

  function camera(view, jitter, lens) {
    const aspect = canvas.width / canvas.height;
    let eye = view.eye;
    if (lens) {
      const f = norm([view.target[0] - eye[0], view.target[1] - eye[1], view.target[2] - eye[2]]);
      const r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
      eye = [eye[0] + r[0] * lens[0] + u[0] * lens[1], eye[1] + r[1] * lens[0] + u[1] * lens[1], eye[2] + r[2] * lens[0] + u[2] * lens[1]];
    }
    const proj = m4.perspective(view.fovY, aspect, view.near || 4, view.far || 900);
    if (jitter) { proj[8] += (jitter[0] * 2) / canvas.width; proj[9] += (jitter[1] * 2) / canvas.height; }
    const viewProj = m4.multiply(proj, m4.lookAt(eye, view.target, [0, 1, 0]));
    return { eye, viewProj };
  }

  function present(tex, hdr) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(progs.present.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    setUniforms(gl, progs.present, { u_src: 0, u_hdr: hdr ? 1 : 0, u_vignette: rig.vignette, u_grain: rig.grain, u_frameNoise: (state.frame % 97) * 1.37, u_exposure: rig.exposure });
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.DEPTH_TEST);
  }

  // Draws one frame.
  //   view.eye, view.target, view.fovY   the camera; target is also the point of sharp focus
  //   view.aperture                      lens radius in cm for still pictures (0 = everything sharp)
  //   view.groups                        ids of the mesh groups to draw
  //   view.changed                       true if any card moved since the last call
  //   view.still                         true to add frames up; false to draw a moving frame
  //   view.blueprint                     0..1, the plain white "dummy" look of the engineer's view
  // Returns { samples, done }. When done is true the picture is finished and need not be drawn again.
  function render(view) {
    state.frame++;
    const camKey = view.eye.join() + view.target.join() + view.fovY + (view.blueprint || 0) + view.groups.join();
    const camMoved = camKey !== state.lastCam;
    state.lastCam = camKey;
    if (view.changed) { state.dirtyKey = true; state.dirtyFill.fill(true); }

    if (!view.still || view.changed || camMoved) {
      // Moving. Put the lights back on their axes if the last still left them off.
      state.samples = 0;
      if (state.jittered) {
        aimKey(norm(rig.key.dir));
        rig.fill.forEach((f, i) => aimFill(i, norm(f.dir)));
        state.jittered = false; state.dirtyKey = true; state.dirtyFill.fill(true);
      }
      const which = [];
      for (let i = 0; i < NUM_FILL && which.length < (view.fillPerFrame || 2); i++) {
        const k = (i + state.frame) % NUM_FILL;
        if (state.dirtyFill[k]) { which.push(k); state.dirtyFill[k] = false; }
      }
      if (state.dirtyKey || which.length) drawShadowMaps(view.groups, state.dirtyKey, which);
      state.dirtyKey = false;
      drawScene(view, camera(view), live, false, true);
      present(live.color, false);
      return { samples: 0, done: false, settling: state.dirtyFill.some(Boolean) };
    }

    if (state.samples >= q.samples) return { samples: state.samples, done: true };
    // Still: one more frame with every light, the pixel grid and the lens moved to a new place.
    const n = state.samples;
    aimKey(tilted(rig.key.dir, disc(seq(n, 0)), rig.key.size));
    rig.fill.forEach((f, i) => aimFill(i, tilted(f.dir, disc(seq(n, i + 1)), f.cone)));
    state.jittered = true;
    drawShadowMaps(view.groups, true, [...Array(NUM_FILL).keys()]);
    const j = seq(n, 9), l = disc(seq(n, 11)), ap = view.aperture || 0;
    drawScene(view, camera(view, [j[0] - 0.5, j[1] - 0.5], [l[0] * ap, l[1] * ap]), hdrFrame, hdrOk, false);
    gl.bindFramebuffer(gl.FRAMEBUFFER, accum.fbo);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(progs.copy.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, hdrFrame.color);
    setUniforms(gl, progs.copy, { u_src: 0, u_alpha: 1 / (n + 1) });
    gl.bindVertexArray(quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    state.samples++;
    present(accum.tex, hdrOk);
    return { samples: state.samples, done: state.samples >= q.samples };
  }

  return {
    gl, quality: q, rig, setMesh, setAtlas, setFrames, resize, setScale, render,
    get scale() { return scale; },
    get samples() { return state.samples; },
    info: { hdr: hdrOk, get live() { return live ? [live.w, live.h, live.samples] : null; } },
    // Forces the next still to start again (for example after the light rig is edited).
    restart() { state.samples = 0; state.dirtyKey = true; state.dirtyFill.fill(true); state.lastCam = ''; },
    // Call after editing the light rig (directions, colours, sizes) to take the changes up.
    relight() {
      rig.fill.forEach((f, i) => { lights.fillCol.set(f.col, i * 3); aimFill(i, norm(f.dir)); });
      aimKey(norm(rig.key.dir));
      state.samples = 0; state.dirtyKey = true; state.dirtyFill.fill(true); state.lastCam = '';
    },
    // The camera matrix of the last moving frame, for laying 2D marks over the picture.
    viewProjOf(view) { return camera(view).viewProj; },
  };
}
