// ④-G option ③ feasibility: can the unsharp taps carry colour+LUT inline?
//
// ★THE QUESTION THIS ANSWERS, and only this one. The render's filter order is
//     eq -> colortemperature -> colorbalance -> lut3d -> unsharp -> ... -> noise -> vignette
// but the preview fuses colour+LUT+grain+vignette into ONE pass (FRAG_COLOR_LUT), so
// bolting unsharp on after it puts the sharpen AFTER grain and vignette instead of
// before. Three ways out, and they are NOT the same axis:
//
//   ① SPLIT   colour+LUT -> [FBO] -> unsharp -> [FBO] -> grain+vignette
//             order exact; costs TWO extra 8-bit FBO round trips. ★The floor measured
//             on 2026-08-08 (RGB->yuv444p->RGB alone moves 0.124-0.130% while the whole
//             sharpen effect is 0.531-0.645%) is why "one more round trip" is not free.
//   ② APPEND  colour+LUT+grain+vignette -> [FBO] -> unsharp
//             one round trip; sharpen lands after grain, which is the WRONG order and
//             matters most exactly when both are on (unsharp amplifies high frequency,
//             grain IS high frequency).
//   ③ FUSE    one pass; each of the 25 unsharp taps applies colour+LUT itself
//             order exact AND no extra round trip -- but 25x the grade maths and, since
//             lutSample is two texture fetches, 25 + 50 = 75 fetches per pixel.
//
// 제니2's read was that ③ is impossible ("a tap cannot know its neighbour's post-LUT
// value in the same pass"). It can: FRAG_UNSHARP already samples the neighbour 25
// times, so the grade just moves inside that sampler. What was NOT known is whether the
// fused shader hits a real GL ceiling. This probe answers that by COMPILING it in the
// same headless browser the parity harness uses, and by reading the ACTUAL limits off
// that context rather than quoting the spec minimums.
//
// Writes nothing, uploads nothing, touches no database.
//   node scripts/probe-fused-unsharp-limits.mjs

import { chromium } from 'playwright-core'
import { register } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

register('./test-hooks.mjs', import.meta.url)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const { VERT, FRAG_COLOR_LUT, FRAG_UNSHARP } = await import(pathToFileURL(join(ROOT, 'lib/gl-effects.ts')).href)

// ★THE FUSED SHADER (option ③). Built from the SAME two sources, not retyped: the
// grade/LUT half is lifted from FRAG_COLOR_LUT and the kernel half from FRAG_UNSHARP,
// so this probe measures the thing that would actually ship.
//
// ★AND THE ORDER IS THE RENDER'S, which is the entire point:
//     graded(centre) -> unsharp on Y -> grain -> vignette
// Note that vignette and grain are NOT applied at the taps. They are pointwise, they
// come after unsharp in the render, and applying them per-tap would be a third order
// again -- sharpening a vignette gradient that the render sharpens nothing of.
const FRAG_FUSED = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_tex, u_lut;
uniform float u_exposure, u_contrast, u_saturation, u_tempK, u_tint, u_vignette, u_hasLut, u_N, u_grain, u_seed;
uniform vec2 u_texel;
uniform float u_amount;
const vec3 LUMA = vec3(0.299, 0.587, 0.114);
const float KR = 0.299, KG = 0.587, KB = 0.114;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 rgbToYuv601Limited(vec3 c) {
  float y = dot(c, vec3(KR, KG, KB));
  return vec3(16.0 + 219.0 * y, 128.0 + 224.0 * (c.b - y) / 1.772, 128.0 + 224.0 * (c.r - y) / 1.402);
}
vec3 yuv601LimitedToRgb(vec3 t) {
  float y = (t.x - 16.0) / 219.0, u = (t.y - 128.0) / 224.0, v = (t.z - 128.0) / 224.0;
  float r = y + 1.402 * v, b = y + 1.772 * u;
  float g = (y - KR * r - KB * b) / KG;
  return clamp(vec3(r, g, b), 0.0, 1.0);
}
vec3 eqGrade(vec3 c, float brightness, float contrast, float saturation) {
  vec3 t = rgbToYuv601Limited(c);
  t.x = clamp(((t.x / 255.0 - 0.5) * contrast + 0.5 + brightness) * 255.0, 0.0, 255.0);
  t.y = clamp((t.y - 128.0) * saturation + 128.0, 0.0, 255.0);
  t.z = clamp((t.z - 128.0) * saturation + 128.0, 0.0, 255.0);
  return yuv601LimitedToRgb(t);
}
vec3 lutSample(vec3 c) {
  float N = u_N; c = clamp(c, 0.0, 1.0);
  float bF = c.b * (N - 1.0); float b0 = floor(bF); float b1 = min(b0 + 1.0, N - 1.0); float f = bF - b0;
  float rx = c.r * (N - 1.0) + 0.5; float gy = c.g * (N - 1.0) + 0.5;
  vec2 t0 = vec2((b0 * N + rx) / (N * N), gy / N);
  vec2 t1 = vec2((b1 * N + rx) / (N * N), gy / N);
  return mix(texture(u_lut, t0).rgb, texture(u_lut, t1).rgb, f);
}
// ★Everything the render does BEFORE unsharp, at an arbitrary uv. This is the function
// that makes ③ possible -- the neighbour's post-LUT value is not unknowable, it is just
// this call.
vec3 graded(vec2 uv) {
  vec3 c = texture(u_tex, uv).rgb;
  c = eqGrade(c, u_exposure, u_contrast, u_saturation);
  float k = u_tempK / 3000.0; c.r -= k * 0.05; c.b += k * 0.05;
  c.g += u_tint * (1.0 - abs(2.0 * dot(c, LUMA) - 1.0));
  if (u_hasLut > 0.5) c = lutSample(clamp(c, 0.0, 1.0));
  return c;
}
void main() {
  vec3 c = graded(v_uv);
  if (u_amount > 0.0) {
    vec3 yuv = rgbToYuv601Limited(c);
    float w[5] = float[5](1.0, 4.0, 6.0, 4.0, 1.0);
    float sum = 0.0;
    for (int j = 0; j < 5; j++) {
      for (int i = 0; i < 5; i++) {
        vec2 off = vec2(float(i - 2) * u_texel.x, float(j - 2) * u_texel.y);
        sum += w[i] * w[j] * rgbToYuv601Limited(graded(v_uv + off)).x;
      }
    }
    yuv.x = clamp(yuv.x + (yuv.x - sum / 256.0) * u_amount, 0.0, 255.0);
    c = yuv601LimitedToRgb(yuv);
  }
  // ★RENDER ORDER: noise then vignette. FRAG_COLOR_LUT currently does the reverse --
  // see the report; that is a separate finding, not something this probe changes.
  if (u_grain > 0.0) { float n = hash(v_uv * 1024.0 + u_seed) - 0.5; c += n * u_grain * 0.006; }
  if (u_vignette > 0.0) { float d = distance(v_uv, vec2(0.5)); c *= 1.0 - u_vignette * smoothstep(0.35, 0.75, d); }
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

const out = await page.evaluate(
  ({ VERT, FRAG_COLOR_LUT, FRAG_UNSHARP, FRAG_FUSED }) => {
    const cv = document.createElement('canvas')
    cv.width = 1280
    cv.height = 720
    const gl = cv.getContext('webgl2', { premultipliedAlpha: false })
    if (!gl) return { fatal: 'webgl2 unavailable in this browser' }

    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const limits = {
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      MAX_TEXTURE_IMAGE_UNITS: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      MAX_FRAGMENT_UNIFORM_VECTORS: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      MAX_FRAGMENT_INPUT_COMPONENTS: gl.getParameter(gl.MAX_FRAGMENT_INPUT_COMPONENTS),
      MAX_VARYING_VECTORS: gl.getParameter(gl.MAX_VARYING_VECTORS),
      MAX_TEXTURE_SIZE: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    }

    const compile = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return { err: gl.getShaderInfoLog(s) }
      return { s }
    }
    const build = (frag) => {
      const v = compile(gl.VERTEX_SHADER, VERT)
      if (v.err) return { ok: false, stage: 'vertex', log: v.err }
      const f = compile(gl.FRAGMENT_SHADER, frag)
      if (f.err) return { ok: false, stage: 'fragment compile', log: f.err }
      const p = gl.createProgram()
      gl.attachShader(p, v.s)
      gl.attachShader(p, f.s)
      gl.linkProgram(p)
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return { ok: false, stage: 'link', log: gl.getProgramInfoLog(p) }
      // ★Uniform/sampler USAGE, read off the linked program rather than counted by
      // eye -- the compiler is the authority on what survived.
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
      let samplers = 0
      const names = []
      for (let i = 0; i < n; i++) {
        const u = gl.getActiveUniform(p, i)
        names.push(u.name)
        if (u.type === gl.SAMPLER_2D) samplers++
      }
      return { ok: true, p, activeUniforms: n, samplers, names }
    }

    const results = {}
    for (const [name, frag] of [['FRAG_COLOR_LUT', FRAG_COLOR_LUT], ['FRAG_UNSHARP', FRAG_UNSHARP], ['FRAG_FUSED (option 3)', FRAG_FUSED]]) {
      const r = build(frag)
      results[name] = r.ok
        ? { ok: true, activeUniforms: r.activeUniforms, samplers: r.samplers }
        : { ok: false, stage: r.stage, log: (r.log || '').trim().slice(0, 400) }
    }

    // --- timing ------------------------------------------------------------
    // ★A ratio, not an absolute. A headless software rasteriser is not a GPU, so the
    // wall-clock here means nothing on its own; what transfers is fused-vs-split on the
    // same context, same content, same draw count.
    const fused = build(FRAG_FUSED)
    const cl = build(FRAG_COLOR_LUT)
    const un = build(FRAG_UNSHARP)
    if (!fused.ok || !cl.ok || !un.ok) return { limits, results, timing: null }

    const W = cv.width, H = cv.height
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    for (const pr of [fused.p, cl.p, un.p]) {
      gl.useProgram(pr)
      const a = gl.getAttribLocation(pr, 'a_pos')
      gl.enableVertexAttribArray(a)
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    }
    const mkTex = (w, h, px) => {
      const t = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, t)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, px)
      for (const [k, v] of [['WRAP_S', 'CLAMP_TO_EDGE'], ['WRAP_T', 'CLAMP_TO_EDGE'], ['MIN_FILTER', 'LINEAR'], ['MAG_FILTER', 'LINEAR']]) {
        gl.texParameteri(gl.TEXTURE_2D, gl['TEXTURE_' + k], gl[v])
      }
      return t
    }
    // Noisy source: a flat frame lets a driver skip work a real frame would not.
    const src = new Uint8Array(W * H * 4)
    for (let i = 0; i < src.length; i += 4) {
      const r = (i * 2654435761) >>> 0
      src[i] = r & 255; src[i + 1] = (r >> 8) & 255; src[i + 2] = (r >> 16) & 255; src[i + 3] = 255
    }
    const texSrc = mkTex(W, H, src)
    const lutPx = new Uint8Array(32 * 32 * 32 * 4).fill(128)
    const texLut = mkTex(32 * 32, 32, lutPx)

    const mkFbo = () => {
      const t = mkTex(W, H, null)
      const fb = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0)
      return { fb, t }
    }
    const f1 = mkFbo(), f2 = mkFbo()

    const setCommon = (p, withSharpen) => {
      gl.useProgram(p)
      gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0)
      gl.uniform1i(gl.getUniformLocation(p, 'u_lut'), 1)
      for (const [k, v] of Object.entries({
        u_exposure: 0.05, u_contrast: 1.3, u_saturation: 0.8, u_tempK: 300, u_tint: 0.02,
        u_vignette: 0.3, u_hasLut: 1, u_N: 32, u_grain: 0.4, u_seed: 7,
        u_amount: withSharpen ? 1.0 : 0.0,
      })) gl.uniform1f(gl.getUniformLocation(p, k), v)
      gl.uniform2f(gl.getUniformLocation(p, 'u_texel'), 1 / W, 1 / H)
    }
    const bindSrcAndLut = () => {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texSrc)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texLut)
    }
    // ★The viewport is MUTABLE so the scaling control can genuinely shrink it. The
    // first version hard-coded W,H here, so the "quarter viewport" run drew full size
    // and the control read 1.00x -- it caught this probe's own bug, not the driver's.
    let VW = W, VH = H
    const drawTo = (fb) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.viewport(0, 0, VW, VH)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }

    const oneFused = () => { setCommon(fused.p, true); bindSrcAndLut(); drawTo(null) }
    // ② APPEND: colour+LUT (incl. grain+vignette) -> FBO -> unsharp -> canvas
    const oneAppend = () => {
      setCommon(cl.p, false); bindSrcAndLut(); drawTo(f1.fb)
      gl.useProgram(un.p)
      gl.uniform1i(gl.getUniformLocation(un.p, 'u_tex'), 0)
      gl.uniform2f(gl.getUniformLocation(un.p, 'u_texel'), 1 / W, 1 / H)
      gl.uniform1f(gl.getUniformLocation(un.p, 'u_amount'), 1.0)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f1.t)
      drawTo(null)
    }
    // ① SPLIT: colour+LUT (no grain/vignette) -> FBO -> unsharp -> FBO -> grain+vignette
    const oneSplit = () => {
      setCommon(cl.p, false)
      gl.uniform1f(gl.getUniformLocation(cl.p, 'u_grain'), 0)
      gl.uniform1f(gl.getUniformLocation(cl.p, 'u_vignette'), 0)
      bindSrcAndLut(); drawTo(f1.fb)
      gl.useProgram(un.p)
      gl.uniform1i(gl.getUniformLocation(un.p, 'u_tex'), 0)
      gl.uniform2f(gl.getUniformLocation(un.p, 'u_texel'), 1 / W, 1 / H)
      gl.uniform1f(gl.getUniformLocation(un.p, 'u_amount'), 1.0)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f1.t)
      drawTo(f2.fb)
      setCommon(cl.p, false)
      gl.uniform1f(gl.getUniformLocation(cl.p, 'u_exposure'), 0)
      gl.uniform1f(gl.getUniformLocation(cl.p, 'u_contrast'), 1)
      gl.uniform1f(gl.getUniformLocation(cl.p, 'u_saturation'), 1)
      gl.uniform1f(gl.getUniformLocation(cl.p, 'u_tempK'), 0)
      gl.uniform1f(gl.getUniformLocation(cl.p, 'u_tint'), 0)
      gl.uniform1f(gl.getUniformLocation(cl.p, 'u_hasLut'), 0)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, f2.t)
      drawTo(null)
    }

    // ★gl.finish() ALONE DID NOT FORCE THE WORK. The first version of this probe
    // reported 0.08 ms/frame for 1280x720 at 26 fetches per pixel -- 24M fetches in
    // 80 microseconds, i.e. ~300 Gfetch/s on a SOFTWARE rasteriser. Impossible, so the
    // draws were being elided: nothing ever read the result. A readPixels of one pixel
    // is a hard sync that cannot be optimised away. Its cost is identical across the
    // three variants, so the RATIO survives even though the absolutes inflate.
    const px = new Uint8Array(4)
    const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const time = (fn, n) => {
      for (let i = 0; i < 3; i++) { fn(); sync() }
      const t0 = performance.now()
      for (let i = 0; i < n; i++) { fn(); sync() }
      return (performance.now() - t0) / n
    }
    const N = 20
    // ★SCALING CONTROL. Real fragment work scales with pixel count; an elided draw does
    // not. Half the viewport in each axis is a QUARTER of the pixels, so a genuine
    // measurement lands near 4x. If it does not, the timing below means nothing and the
    // probe says so rather than printing numbers that look like an answer.
    const timeAt = (fn, w, h) => {
      VW = w; VH = h
      const t = time(fn, N)
      VW = W; VH = H
      return t
    }
    const fullFused = time(oneFused, N)
    const quarterFused = timeAt(oneFused, W >> 1, H >> 1)
    const timing = {
      frames: N,
      size: `${W}x${H}`,
      fusedMs: fullFused,
      appendMs: time(oneAppend, N),
      splitMs: time(oneSplit, N),
      scaleFullOverQuarter: fullFused / quarterFused,
      quarterMs: quarterFused,
    }
    return { limits, results, timing }
  },
  { VERT, FRAG_COLOR_LUT, FRAG_UNSHARP, FRAG_FUSED },
)

await browser.close()

if (out.fatal) {
  console.error('FATAL:', out.fatal)
  process.exit(1)
}

const L = out.limits
console.log('\n═══ ④-G option ③ (fused unsharp) -- feasibility probe ═══\n')
console.log(`renderer: ${L.renderer}`)
console.log('★These are the ACTUAL limits of this context, not the spec minimums.\n')

// What the fused shader needs, next to what the context gives.
const NEED = { samplers: 2, uniformVectors: 13 }
const rows = [
  ['MAX_TEXTURE_IMAGE_UNITS', L.MAX_TEXTURE_IMAGE_UNITS, NEED.samplers, 'samplers (u_tex + u_lut)'],
  ['MAX_FRAGMENT_UNIFORM_VECTORS', L.MAX_FRAGMENT_UNIFORM_VECTORS, NEED.uniformVectors, '~11 floats + 1 vec2 (samplers do not count)'],
  ['MAX_VARYING_VECTORS', L.MAX_VARYING_VECTORS, 1, 'v_uv'],
]
for (const [name, have, need, why] of rows) {
  const verdict = have >= need ? 'OK' : '★OVER'
  console.log(`  ${verdict.padEnd(6)} ${name.padEnd(30)} have ${String(have).padStart(4)}  need ${String(need).padStart(3)}   ${why}`)
}

console.log('\ncompile + link (the compiler is the authority, not my arithmetic):')
let blocked = false
for (const [name, r] of Object.entries(out.results)) {
  if (r.ok) {
    console.log(`  OK     ${name.padEnd(22)} activeUniforms ${r.activeUniforms}, samplers ${r.samplers}`)
  } else {
    blocked = true
    console.log(`  ★FAIL  ${name.padEnd(22)} at ${r.stage}\n         ${r.log}`)
  }
}

if (out.timing) {
  const t = out.timing
  // ★THE CONTROL IS READ FIRST. Quarter the pixels should cost about a quarter the
  // time; if it does not, the draws are not actually happening and every number below
  // is noise dressed as a measurement.
  const scaleOk = t.scaleFullOverQuarter >= 2.5 && t.scaleFullOverQuarter <= 6
  console.log(
    `\nscaling control: full / quarter-viewport = ${t.scaleFullOverQuarter.toFixed(2)}x ` +
      `(${t.fusedMs.toFixed(2)} vs ${t.quarterMs.toFixed(2)} ms) -- expect ~4x  ->  ${scaleOk ? 'OK' : '★VOID'}`,
  )
  if (!scaleOk) {
    console.log('★The timings below are NOT trustworthy: fragment work that does not scale with')
    console.log(' pixel count is work that is not being done. Do not quote them.')
  }
  console.log(`\ncost, ${t.frames} frames at ${t.size} (ratios only -- a headless rasteriser is not a GPU):`)
  const base = t.appendMs
  const line = (label, ms, passes, fetches) =>
    console.log(`  ${label.padEnd(22)} ${ms.toFixed(2).padStart(8)} ms/frame   ${(ms / base).toFixed(2)}x   ${passes} draw(s), ${fetches} fetch/px`)
  line('② append (wrong order)', t.appendMs, 2, '1 + 25')
  line('① split (exact order)', t.splitMs, 3, '1 + 25 + 1')
  line('③ fused (exact order)', t.fusedMs, 1, '25x(1+2) = 75')
  console.log('\n★Fetches are per pixel WITH a LUT active. lutSample is two texture reads, so')
  console.log(' ③ pays 75 where ② pays 26 -- and ① pays 27 plus TWO extra 8-bit FBO round')
  console.log(' trips, which the 2026-08-08 floor measurement priced at 0.124-0.130% each')
  console.log(' against a whole sharpen effect of 0.531-0.645%.')
}

console.log(
  blocked
    ? '\n★VERDICT: option ③ is BLOCKED on this context -- see the failure above.\n'
    : '\n★VERDICT: option ③ COMPILES AND LINKS. No sampler or uniform ceiling is reached,\n' +
        ' so it stays a candidate and the choice is a cost comparison, not a feasibility one.\n',
)
