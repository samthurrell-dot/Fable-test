// engine/glkit.js
// A very small WebGL2 helper layer: programs with named uniforms, buffers and render targets.
// No scene knowledge in here, so it can be reused by any raw-WebGL2 build.

function compile(gl, type, src, label) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    const numbered = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    console.error(`Shader compile failed (${label})\n${log}\n${numbered}`);
    throw new Error(`Shader compile failed (${label}): ${log}`);
  }
  return sh;
}

// Returns { program, uniforms: { name: { loc, type } } }.
export function createProgram(gl, vsSrc, fsSrc, label = 'program') {
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vsSrc, label + ' vertex'));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fsSrc, label + ' fragment'));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link failed (${label}): ${gl.getProgramInfoLog(program)}`);
  }
  const uniforms = {};
  const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(program, i);
    const name = info.name.replace(/\[0\]$/, '');
    uniforms[name] = { loc: gl.getUniformLocation(program, info.name), type: info.type };
  }
  return { program, uniforms, label };
}

// Builds several programs at once: { name: [vertexSource, fragmentSource] } -> { name: program }.
// Every compile and link is started before any result is asked for, so the browser can
// compile them side by side instead of one after another. Much faster on a cold start.
export function createPrograms(gl, specs) {
  gl.getExtension('KHR_parallel_shader_compile');
  const pending = [];
  for (const name in specs) {
    const [vsSrc, fsSrc] = specs[name];
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vsSrc); gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fsSrc); gl.compileShader(fs);
    const program = gl.createProgram();
    gl.attachShader(program, vs); gl.attachShader(program, fs);
    gl.linkProgram(program);
    pending.push({ name, program, vs, fs });
  }
  const out = {};
  for (const p of pending) {
    if (!gl.getProgramParameter(p.program, gl.LINK_STATUS)) {
      const log = [gl.getShaderInfoLog(p.vs), gl.getShaderInfoLog(p.fs), gl.getProgramInfoLog(p.program)].filter(Boolean).join('\n');
      console.error(`Program failed (${p.name})\n${log}`);
      throw new Error(`Program failed (${p.name}): ${log}`);
    }
    const uniforms = {};
    const n = gl.getProgramParameter(p.program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p.program, i);
      uniforms[info.name.replace(/\[0\]$/, '')] = { loc: gl.getUniformLocation(p.program, info.name), type: info.type };
    }
    out[p.name] = { program: p.program, uniforms, label: p.name };
  }
  return out;
}

// Sets every uniform the program actually uses from a plain { name: value } object.
// Names the program does not use are skipped, so one shared object can feed all programs.
export function setUniforms(gl, prog, values) {
  for (const name in prog.uniforms) {
    const v = values[name];
    if (v === undefined) continue;
    const u = prog.uniforms[name];
    switch (u.type) {
      case gl.FLOAT: gl.uniform1f(u.loc, v); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(u.loc, v); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(u.loc, v); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(u.loc, v); break;
      case gl.FLOAT_MAT4: gl.uniformMatrix4fv(u.loc, false, v); break;
      default: gl.uniform1i(u.loc, v); // samplers, ints, bools
    }
  }
}

export function createBuffer(gl, target, data, usage = gl.STATIC_DRAW) {
  const b = gl.createBuffer();
  gl.bindBuffer(target, b);
  gl.bufferData(target, data, usage);
  return b;
}

// Describes float attributes of one interleaved buffer.
// attrs: [{ loc, size, offset }] with offset in floats; stride in floats; divisor 1 = per instance.
export function bindAttributes(gl, buffer, stride, attrs, divisor = 0) {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (const a of attrs) {
    gl.enableVertexAttribArray(a.loc);
    gl.vertexAttribPointer(a.loc, a.size, gl.FLOAT, false, stride * 4, a.offset * 4);
    gl.vertexAttribDivisor(a.loc, divisor);
  }
}

export function createTexture(gl, w, h, internalFormat, format, type, filter) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

// A depth-only target for shadow maps, with hardware comparison (use sampler2DShadow).
export function createShadowTarget(gl, size) {
  const depth = createTexture(gl, size, size, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, depth, size };
}

// A colour + depth target that can be sampled afterwards, with optional MSAA.
// Returns { drawFbo, resolve(), color, depth, w, h, samples, dispose() }.
// Draw into drawFbo, call resolve(), then sample color and depth.
export function createSceneTarget(gl, w, h, { hdr = true, samples = 4 } = {}) {
  const internal = hdr ? gl.RGBA16F : gl.RGBA8;
  const type = hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  const color = createTexture(gl, w, h, internal, gl.RGBA, type, gl.LINEAR);
  const depth = createTexture(gl, w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
  const resolveFbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, resolveFbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  const resolveOk = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;

  let msFbo = null, rbC = null, rbD = null;
  samples = Math.min(samples, gl.getParameter(gl.MAX_SAMPLES));
  if (samples > 1) {
    rbC = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rbC);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, internal, w, h);
    rbD = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rbD);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
    msFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, msFbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rbC);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbD);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(msFbo); gl.deleteRenderbuffer(rbC); gl.deleteRenderbuffer(rbD);
      msFbo = rbC = rbD = null;
      samples = 0;
    }
  } else {
    samples = 0;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    ok: resolveOk,
    drawFbo: msFbo || resolveFbo,
    color, depth, w, h, samples,
    resolve() {
      if (!msFbo) return;
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msFbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, resolveFbo);
      gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    },
    dispose() {
      gl.deleteTexture(color); gl.deleteTexture(depth); gl.deleteFramebuffer(resolveFbo);
      if (msFbo) { gl.deleteFramebuffer(msFbo); gl.deleteRenderbuffer(rbC); gl.deleteRenderbuffer(rbD); }
    },
  };
}
