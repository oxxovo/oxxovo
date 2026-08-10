// ④-G combination parity harness -- does sharpen (still unwired) interact with
// grain/vignette in a way that matters, and how much does adding it as an
// independent pass (option (1)) cost by itself?
//   node scripts/gl-combo-parity.mjs
//
// ★WHY THIS EXISTS. gl-engine-parity.mjs measures sharpen ALONE, against the
// unmodified source texture. Once wired, sharpen sits in the middle of the
// worker's real filter chain (render.ts effectVideoFilters, confirmed by
// reading it, not recalled):
//   eq -> colortemperature -> colorbalance -> lut3d -> UNSHARP -> rgbashift ->
//   tmix -> NOISE(grain) -> VIGNETTE
// so the worker always applies sharpen BEFORE grain and BEFORE vignette. The
// preview's existing FRAG_COLOR_LUT, independently of sharpen, already applies
// vignette BEFORE grain (lib/gl-effects.ts:84,87) -- the OPPOSITE of the
// worker's grain-then-vignette. That mismatch was found and recorded, not
// fixed, in the 2026-08-09 fused-unsharp probe (e47f040).
//
// Three questions, one harness:
//   Q1 sharpen+vignette / sharpen+grain -- does applying them in the WRONG
//      order (vs the worker's fixed order above) measurably diverge from
//      applying them correctly? This is the negative control 제니2 asked for:
//      if wrong-order error >> correct-order error, order is the cause; if
//      correct-order error is already close to wrong-order error, something
//      ELSE (floor, shader math) dominates and getting the order right would
//      not have fixed much.
//   Q2 option (1) (sharpen wired as an independent extra FBO pass) has a
//      round-trip cost -- MEASURED here, not estimated from the earlier
//      yuv444p floor number (that number is ffmpeg's OWN round trip; this is
//      the GL pipeline writing an 8-bit RGBA texture and reading it back for
//      one more pass, a different mechanism).
//   Q3 (side, per 제니2) if the grain/vignette reorder is bundled into
//      whichever option ships, does that reorder alone move the image enough
//      to be worth doing -- i.e. is 08-09's side finding real or noise.
//
// ★GRAIN IS NOT A PARITY TARGET HERE. FRAG_COLOR_LUT's grain is a DIFFERENT
// random field from ffmpeg's noise= filter by design (declared
// parity:'approximate', lib/gl-effects.ts:85-86) -- so GL-vs-ffmpeg on grain
// measures "two different noises," not order. Every grain-adjacent question
// below is answered by comparing two GL RUNS WITH THE SAME SEED against each
// other (order is then the only variable), never GL-vs-ffmpeg. Vignette is
// deterministic, so its legs DO compare against ffmpeg.
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'
import { chromium } from 'playwright-core'
import { FFMPEG, ffmpegBanner } from './ffmpeg-bin.mjs'
import { VERT, FRAG_UNSHARP, colorUniforms, unsharpAmount } from '../lib/gl-effects.ts'
import { resolveWorkerRepo } from './worker-repo.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_REPO = resolveWorkerRepo(ROOT)
const RENDER_TS = join(WORKER_REPO, 'src', 'render.ts')
if (!existsSync(RENDER_TS)) {
  console.error(`\n★Cannot load the worker's filter builder -- exiting 1 rather than guessing its order.`)
  console.error(`  looked for : ${RENDER_TS}\n`)
  process.exit(1)
}
process.env.LUT_DIR = join(WORKER_REPO, 'assets', 'luts')
register('./test-hooks.mjs', import.meta.url)
let effectVideoFilters
try {
  ;({ effectVideoFilters } = await import(pathToFileURL(RENDER_TS).href))
} catch (e) {
  console.error(`\n★Found ${RENDER_TS} but could not import it. ${e?.message ?? e}\n`)
  process.exit(1)
}
const ff = (e) => effectVideoFilters(e).join(',')
// ★ORDER IS READ OFF THE BUILT STRING, not assumed. If render.ts ever reorders
// its pushes this assertion fails loudly instead of the harness silently
// testing the wrong hypothesis.
const orderCheck = ff({ sharpen: 50, grain: 40, vignette: 60 })
if (!/unsharp.*noise.*vignette/.test(orderCheck)) {
  console.error(`\n★Expected worker order unsharp -> noise -> vignette, got: ${orderCheck}\n`)
  process.exit(1)
}
console.log(`worker order confirmed from effectVideoFilters(): ${orderCheck}`)

const CONTENT = {
  smooth: ['-f', 'lavfi', '-i', 'color=c=gray:s=320x240', '-vf', "geq=r='128+60*sin(X/40)':g='120+50*sin(Y/35)':b='110+40*sin((X+Y)/50)',format=rgb24"],
  mandel: ['-f', 'lavfi', '-i', 'mandelbrot=s=320x240'],
  bars: ['-f', 'lavfi', '-i', 'smptebars=s=320x240'],
  testsrc: ['-f', 'lavfi', '-i', 'testsrc2=s=320x240'],
}
const TMPDIR = (process.env.TEMP || '/tmp').split(String.fromCharCode(92)).join('/')
const run = (args) => new Promise((res, rej) => { const p = spawn(FFMPEG, args); const ch = []; let e = ''; p.stdout.on('data', (d) => ch.push(d)); p.stderr.on('data', (d) => (e += d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c + ' ' + e.slice(-200))))); p.on('error', rej) })
const raw = (png, vf) => run(['-y', '-i', png, ...(vf ? ['-vf', vf] : []), '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
// Same instrument as gl-engine-parity.mjs -- signal-relative error, floor-safe.
const signalErr = (plain, ff_, gl) => {
  const n = Math.min(plain.length, ff_.length, gl.length)
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += Math.abs(gl[i] - ff_[i]); den += Math.abs(ff_[i] - plain[i]) }
  return den === 0 ? 0 : num / den
}
const diff = (a, b) => { const n = Math.min(a.length, b.length); let s = 0; for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]); return s / n / 255 * 100 }
const FLOOR_PCT = 100 / 255

// ---------------------------------------------------------------------------
// Standalone single-effect shaders, order-composable. NOT lib/gl-effects.ts:
// these are investigation-only (matches the negctl-sharpen.mjs / probe-*.mjs
// convention of local, uncommitted-to-lib shaders for a question, not a port).
// Math copied verbatim from FRAG_COLOR_LUT (grain: line 87, vignette: line 84)
// and FRAG_UNSHARP is imported unchanged -- the shader under test must be the
// real one, not a stand-in.
const FRAG_GRAIN = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_tex; uniform float u_grain, u_seed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() { vec3 c = texture(u_tex, v_uv).rgb;
  float n = hash(v_uv * 1024.0 + u_seed) - 0.5; c += n * u_grain * 0.006;
  o = vec4(clamp(c, 0.0, 1.0), 1.0); }`
const FRAG_VIGNETTE = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_tex; uniform float u_vignette;
void main() { vec3 c = texture(u_tex, v_uv).rgb;
  float d = distance(v_uv, vec2(0.5)); c *= 1.0 - u_vignette * smoothstep(0.35, 0.75, d);
  o = vec4(clamp(c, 0.0, 1.0), 1.0); }`
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

// ★MEASURED, NOT THEORISED (2026-08-10): on this headless Chromium/ANGLE/
// SwiftShader stack, a texture written by rendering INTO an FBO reads back
// Y-FLIPPED relative to a texture uploaded from an <img> -- confirmed by diffing
// a 2-pass copy(source)->copy chain against `vflip` of the source: 0.0000%
// match. A 1-pass direct-to-canvas draw has NO such flip (0.0000% vs source).
// So every pass PAST THE FIRST needs its read corrected, or a 2+ pass chain
// silently measures against a vertically flipped image -- which is exactly
// what produced the ~2-4 signal-error "round-trip cost" on the first run of
// this harness before this fix (see the write-up for the before/after).
// ★THIS IS A HARNESS ARTEFACT, NOT A preview-gl.ts BUG: preview-gl.ts's own
// glow multipass chain was independently parity-verified (0.1-0.2%, PASS,
// D3) using the exact same FBO-chain shape, so the shipped code does not
// carry this -- it is specific to this script's fresh WebGL context/shader
// set. Fixed here by rewriting the read coordinate, not by touching
// FRAG_UNSHARP/FRAG_GRAIN/FRAG_VIGNETTE's actual math.
function flipRead(src) {
  const marker = 'void main() {'
  const i = src.indexOf(marker)
  if (i < 0) throw new Error('flipRead: no `void main() {` found')
  const head = src.slice(0, i + marker.length)
  const body = src.slice(i + marker.length).replace(/\bv_uv\b/g, 'v_uv_f')
  return head + '\n  vec2 v_uv_f = vec2(v_uv.x, 1.0 - v_uv.y);\n' + body
}

// Generic chain runner: `passes` is [{frag, uniforms}], applied in array order,
// each sampling the previous pass's output (first pass samples the uploaded
// source). Every shader here takes u_tex (+ u_texel for unsharp) so one runner
// covers unsharp/grain/vignette/copy in any order. Passes after the first are
// flip-corrected (see flipRead above) -- the pass array itself stays written
// in natural reading order; callers never see the correction.
async function glChain(rawPasses, testB64) {
  const passes = rawPasses.map((p, i) => (i === 0 ? p : { ...p, frag: flipRead(p.frag) }))
  const url = await page.evaluate(async ({ testB64, passes, VERT }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + testB64; await img.decode()
    const W = img.width, H = img.height
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const gl = cv.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true })
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o }
    const mkProg = (fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p }
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const mkTex = (fromImg) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t)
      for (const [k, v] of [['WRAP_S', 'CLAMP_TO_EDGE'], ['WRAP_T', 'CLAMP_TO_EDGE'], ['MIN_FILTER', 'NEAREST'], ['MAG_FILTER', 'NEAREST']]) gl.texParameteri(gl.TEXTURE_2D, gl['TEXTURE_' + k], gl[v])
      if (fromImg) { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img) }
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      return t
    }
    const srcTex = mkTex(true)
    // Two ping-pong FBOs are enough for any chain length: read one, write the other.
    const mkFbo = () => { const t = mkTex(false); const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { fb, tex: t } }
    const pp = [mkFbo(), mkFbo()]
    let readTex = srcTex
    for (let i = 0; i < passes.length; i++) {
      const { frag, uniforms } = passes[i]
      const p = mkProg(frag); gl.useProgram(p)
      const a = gl.getAttribLocation(p, 'a_pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, readTex)
      gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0)
      gl.uniform2f(gl.getUniformLocation(p, 'u_texel'), 1 / W, 1 / H)
      for (const [k, v] of Object.entries(uniforms || {})) gl.uniform1f(gl.getUniformLocation(p, 'u_' + k), v)
      const last = i === passes.length - 1
      if (last) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H) }
      else { const target = pp[i % 2]; gl.bindFramebuffer(gl.FRAMEBUFFER, target.fb); gl.viewport(0, 0, W, H) }
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      if (!last) readTex = pp[i % 2].tex
    }
    return cv.toDataURL('image/png')
  }, { testB64, passes, VERT })
  return Buffer.from(url.split(',')[1], 'base64')
}

const items = []
for (const [name, args] of Object.entries(CONTENT)) {
  const png = `${TMPDIR}/combo_${name}.png`
  await run(['-y', ...args, '-frames:v', '1', png])
  items.push({ name, png })
}

const SHARPEN = 50 // matches gl-engine-parity.mjs SHARPEN_SLIDERS, so this row is comparable to that one
const VIGNETTE_SLIDER = 60
const GRAIN_SLIDER = 40
const U_VIGNETTE = VIGNETTE_SLIDER / 100 // colorUniforms()'s own mapping
const AMOUNT = unsharpAmount({ sharpen: SHARPEN })
const SEED = 42

const unsharpPass = (amount = AMOUNT) => ({ frag: FRAG_UNSHARP, uniforms: { amount } })
const vignettePass = { frag: FRAG_VIGNETTE, uniforms: { vignette: U_VIGNETTE } }
const grainPass = { frag: FRAG_GRAIN, uniforms: { grain: GRAIN_SLIDER, seed: SEED } }

console.log('')
console.log(await ffmpegBanner())
console.log(`worker repo: ${WORKER_REPO}`)
console.log(`sharpen=${SHARPEN} (amount=${AMOUNT.toFixed(4)})  vignette=${VIGNETTE_SLIDER} (u=${U_VIGNETTE})  grain=${GRAIN_SLIDER}  seed=${SEED}`)
console.log('bands (same as gl-engine-parity.mjs): PASS r<0.5 | REVIEW 0.5<=r<1.0 | FAIL r>=1.0 | UNMEASURABLE if effect<=1 LSB')
console.log('')

// =====================================================================
// Q1a. sharpen + vignette -- deterministic, compares against ffmpeg both ways.
// =====================================================================
console.log('== Q1a sharpen+vignette: correct order (unsharp->vignette) vs wrong (vignette->unsharp) ==')
console.log('content   mag%    correct-r  wrong-r   verdict')
const q1aRows = []
for (const it of items) {
  const b64 = (await readFile(it.png)).toString('base64')
  const plain = await raw(it.png)
  const ffOut = await raw(it.png, `${ff({ sharpen: SHARPEN, vignette: VIGNETTE_SLIDER })},format=rgb24`)
  const mag = diff(plain, ffOut)
  const glCorrect = await raw(await (async () => { const p = `${it.png}.q1a.correct.png`; await writeFile(p, await glChain([unsharpPass(), vignettePass], b64)); return p })())
  const glWrong = await raw(await (async () => { const p = `${it.png}.q1a.wrong.png`; await writeFile(p, await glChain([vignettePass, unsharpPass()], b64)); return p })())
  const rCorrect = signalErr(plain, ffOut, glCorrect)
  const rWrong = signalErr(plain, ffOut, glWrong)
  const orderMatters = rWrong > rCorrect * 1.5 && rWrong - rCorrect > 0.05
  const verdict = mag <= FLOOR_PCT ? 'UNMEASURABLE' : orderMatters ? 'ORDER-CAUSED' : 'ORDER-INDEPENDENT (baseline dominates)'
  q1aRows.push({ content: it.name, mag, rCorrect, rWrong, verdict })
  console.log(`${it.name.padEnd(9)} ${mag.toFixed(2)}%  ${rCorrect.toFixed(3).padEnd(10)} ${rWrong.toFixed(3).padEnd(9)} ${verdict}`)
}

// =====================================================================
// Q1b. sharpen + grain -- grain is non-deterministic vs ffmpeg BY DESIGN, so
// this leg is GL-vs-GL (same seed), never GL-vs-ffmpeg. It answers "does
// order move the image", not "does GL match ffmpeg".
// =====================================================================
console.log('')
console.log('== Q1b sharpen+grain: GL-vs-GL order sensitivity (same seed, grain has no ffmpeg ground truth) ==')
console.log('content   grain-alone-mag%   correct-vs-wrong-diff%   reads-as')
for (const it of items) {
  const b64 = (await readFile(it.png)).toString('base64')
  const plain = await raw(it.png)
  const grainAlonePng = await (async () => { const p = `${it.png}.q1b.grainalone.png`; await writeFile(p, await glChain([grainPass], b64)); return p })()
  const grainAloneMag = diff(plain, await raw(grainAlonePng))
  const glCorrectPng = await (async () => { const p = `${it.png}.q1b.correct.png`; await writeFile(p, await glChain([unsharpPass(), grainPass], b64)); return p })()
  const glWrongPng = await (async () => { const p = `${it.png}.q1b.wrong.png`; await writeFile(p, await glChain([grainPass, unsharpPass()], b64)); return p })()
  const orderDiff = diff(await raw(glCorrectPng), await raw(glWrongPng))
  // ★Scale the raw pixel diff against grain's OWN magnitude, the only reference
  // this leg has (there is no ffmpeg number to divide by).
  const relative = grainAloneMag > 0 ? orderDiff / grainAloneMag : 0
  const reads = relative < 0.15 ? 'order barely matters here' : relative < 0.5 ? 'order visible, not dominant' : 'order-dominant (sharpen reshapes the noise field)'
  console.log(`${it.name.padEnd(9)} ${grainAloneMag.toFixed(2).padEnd(18)}% ${orderDiff.toFixed(3).padEnd(23)}% ${reads}  (ratio ${relative.toFixed(2)})`)
}

// =====================================================================
// Q2. Round-trip cost of option (1) -- an ADDITIONAL FBO pass, measured by
// actually running one, not inferred from the ffmpeg-side yuv444p floor
// (that number is a different mechanism: ffmpeg's own pixel-format round
// trip, not the GL pipeline writing+rereading an 8-bit RGBA texture).
// amount=0 means the unsharp shader is mathematically a no-op (yuv.x stays
// yuv.x), so any measured delta is PURELY the extra texture round trip, not
// the sharpen math.
// =====================================================================
console.log('')
console.log('== Q2 option (1) round-trip cost: 1 pass (color grade only) vs 2 passes (+ a no-op unsharp pass, amount=0) ==')
console.log('content   1-pass-r   2-pass-r   delta (= the round-trip cost)')
const COLOR_SLIDERS = { exposure: 10, contrast: 30, saturation: -20 }
for (const it of items) {
  const b64 = (await readFile(it.png)).toString('base64')
  const plain = await raw(it.png)
  const ffOut = await raw(it.png, `${ff(COLOR_SLIDERS)},format=rgb24`)
  // 1-pass baseline needs a colour-grade shader; reuse FRAG_UNSHARP at amount=0
  // is wrong here (it does not grade) -- so this leg composes color via a tiny
  // local grade-only shader matching colorUniforms(), then compares 1 vs 2 passes.
  const u = colorUniforms(COLOR_SLIDERS)
  const FRAG_GRADE = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u_tex; uniform float u_exposure, u_contrast, u_saturation;
const float KR=0.299, KG=0.587, KB=0.114;
vec3 toYuv(vec3 c){ float y=dot(c,vec3(KR,KG,KB)); return vec3(16.0+219.0*y, 128.0+224.0*(c.b-y)/1.772, 128.0+224.0*(c.r-y)/1.402); }
vec3 toRgb(vec3 t){ float y=(t.x-16.0)/219.0, u=(t.y-128.0)/224.0, v=(t.z-128.0)/224.0; float r=y+1.402*v, b=y+1.772*u, g=(y-KR*r-KB*b)/KG; return clamp(vec3(r,g,b),0.0,1.0); }
void main(){ vec3 c=texture(u_tex,v_uv).rgb; vec3 t=toYuv(c);
  t.x=clamp(((t.x/255.0-0.5)*u_contrast+0.5+u_exposure)*255.0,0.0,255.0);
  t.y=clamp((t.y-128.0)*u_saturation+128.0,0.0,255.0); t.z=clamp((t.z-128.0)*u_saturation+128.0,0.0,255.0);
  o=vec4(toRgb(t),1.0); }`
  const gradePass = { frag: FRAG_GRADE, uniforms: { exposure: u.exposure, contrast: u.contrast, saturation: u.saturation } }
  const onePassPng = await (async () => { const p = `${it.png}.q2.1pass.png`; await writeFile(p, await glChain([gradePass], b64)); return p })()
  const twoPassPng = await (async () => { const p = `${it.png}.q2.2pass.png`; await writeFile(p, await glChain([gradePass, unsharpPass(0)], b64)); return p })()
  const r1 = signalErr(plain, ffOut, await raw(onePassPng))
  const r2 = signalErr(plain, ffOut, await raw(twoPassPng))
  console.log(`${it.name.padEnd(9)} ${r1.toFixed(3).padEnd(10)} ${r2.toFixed(3).padEnd(10)} ${(r2 - r1).toFixed(3)}`)
}

// =====================================================================
// Q3 (side). vignette/grain reorder -- does fixing it move the image enough
// to matter. GL-current (vignette-then-grain, the shipped order) vs
// GL-fixed (grain-then-vignette, the worker's order), same seed.
// =====================================================================
console.log('')
console.log('== Q3 (side) vignette/grain reorder: shipped order vs worker order, same seed ==')
console.log('content   reorder-diff%   vs vignette-alone-mag%   reads-as')
for (const it of items) {
  const b64 = (await readFile(it.png)).toString('base64')
  const plain = await raw(it.png)
  const vignetteAloneMag = diff(plain, await raw(await (async () => { const p = `${it.png}.q3.vonly.png`; await writeFile(p, await glChain([vignettePass], b64)); return p })()))
  const shippedPng = await (async () => { const p = `${it.png}.q3.shipped.png`; await writeFile(p, await glChain([vignettePass, grainPass], b64)); return p })() // current FRAG_COLOR_LUT order
  const fixedPng = await (async () => { const p = `${it.png}.q3.fixed.png`; await writeFile(p, await glChain([grainPass, vignettePass], b64)); return p })() // worker order
  const reorderDiff = diff(await raw(shippedPng), await raw(fixedPng))
  const relative = vignetteAloneMag > 0 ? reorderDiff / vignetteAloneMag : 0
  const reads = relative < 0.1 ? 'reorder is noise, not worth a dedicated fix' : 'reorder is a real, visible difference'
  console.log(`${it.name.padEnd(9)} ${reorderDiff.toFixed(3).padEnd(15)}% ${vignetteAloneMag.toFixed(2).padEnd(24)}% ${reads}  (ratio ${relative.toFixed(2)})`)
}

console.log('')
console.log('Every image pair is written beside its source PNG (*.q1a.*, *.q1b.*, *.q2.*, *.q3.*) for visual review.')
await browser.close()
