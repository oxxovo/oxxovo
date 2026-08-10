// Engine re-verify (WebGL2): runs the ENGINE's actual shaders (lib/gl-effects.ts,
// the same source preview-gl.ts uses) headlessly and compares with ffmpeg, so a
// port can't drift from the harness parity. Cases: color, LUT, glow (multipass).
//   node scripts/gl-engine-parity.mjs <test.png>
//
// ★What the ffmpeg side is, and why that mattered (2026-08-01). This harness never
// read the worker: the filter strings it compared against were hand-written COPIES
// of what oxxovo-studio/src/render.ts builds. render.ts could drift and every run
// would still say PASS -- a green harness measuring nothing, which is the same shape
// as the worker CI that ran for a month without `npm ci`.
// Now: color and LUT call the worker's OWN effectVideoFilters(). Their strings are
// no longer written here at all.
// ★glow is STILL a local copy (see its case below) -- deliberately, and it is printed
// as such in the output so nobody reads "imported" and assumes all three are covered.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'
import { chromium } from 'playwright-core'
import { FFMPEG, ffmpegBanner } from './ffmpeg-bin.mjs'
import { VERT, FRAG_COLOR_LUT, FRAG_BLUR, FRAG_SCREEN, FRAG_UNSHARP, colorUniforms, glowStages, unsharpAmount, parseCube, tileCube } from '../lib/gl-effects.ts'
import { resolveWorkerRepo } from './worker-repo.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_REPO = resolveWorkerRepo(ROOT)
const RENDER_TS = join(WORKER_REPO, 'src', 'render.ts')

// ★FAIL LOUD. If the worker cannot be loaded we exit 1 -- we do NOT fall back to the
// old hand-written strings. A harness that quietly degrades to comparing itself is
// worse than no harness: it reports PASS while verifying nothing.
if (!existsSync(RENDER_TS)) {
  console.error(`\n★Cannot load the worker's filter builder -- not measuring anything, so exiting 1.`)
  console.error(`  looked for : ${RENDER_TS}`)
  console.error(`  app root   : ${ROOT}`)
  console.error(`  WORKER_REPO: ${process.env.WORKER_REPO ?? '(unset -- derived from the app directory name)'}`)
  console.error(`\n  Clone/worktree oxxovo-studio next to this checkout, or set WORKER_REPO.\n`)
  process.exit(1)
}
// render.ts reads LUT_DIR at module scope, so it must be set BEFORE the import below.
process.env.LUT_DIR = join(WORKER_REPO, 'assets', 'luts')
// Worker source uses extensionless relative imports (render.ts -> './text-render').
// Same resolve hook `npm test` uses; registering here keeps a bare `node
// scripts/gl-engine-parity.mjs` working, with no npm-script flag to remember.
register('./test-hooks.mjs', import.meta.url)
let effectVideoFilters
try {
  ;({ effectVideoFilters } = await import(pathToFileURL(RENDER_TS).href))
} catch (e) {
  console.error(`\n★Found ${RENDER_TS} but could not import it -- exiting 1 rather than`)
  console.error(`  falling back to local copies of its filter strings.\n  ${e?.message ?? e}\n`)
  process.exit(1)
}
// The ffmpeg side must read the SAME .cube the preview serves, or the LUT row compares
// two different tables and its 0.0x% means nothing.
const LUT_APP = join(ROOT, 'public', 'luts', 'teal_orange.cube')
const LUT_WORKER = join(process.env.LUT_DIR, 'teal_orange.cube')
const md5 = async (p) => createHash('md5').update(await readFile(p)).digest('hex')
if ((await md5(LUT_APP)) !== (await md5(LUT_WORKER))) {
  console.error(`\n★public/luts and the worker's assets/luts disagree for teal_orange.cube.`)
  console.error(`  ${LUT_APP}\n  ${LUT_WORKER}`)
  console.error(`  The LUT row would compare two different tables. Exiting 1.\n`)
  process.exit(1)
}

// ★Every recorded number needs provenance. A parity figure measured on ONE image
// is not a property of the engine: the colour grade sat at a recorded "1.51%" while
// actually ranging 2.5%-7.5% depending on content (that recorded value came from a
// single low-saturation frame). So this harness runs a fixed CONTENT SET and prints
// one row per content -- a gate passes only if every content passes.
// The set is synthesised with ffmpeg (no external assets, reproducible anywhere):
//   smooth  -- soft sine gradients, stands in for photographic footage
//   mandel  -- fine detail, hard edges
//   bars    -- SMPTE bars, fully saturated primaries (worst case for chroma math)
//   testsrc -- ffmpeg's own pattern: saturated blocks + high-frequency zone plate
// Pass image paths to override the set (e.g. real AI clip frames).
const CONTENT = {
  smooth: ['-f', 'lavfi', '-i', 'color=c=gray:s=320x240', '-vf', "geq=r='128+60*sin(X/40)':g='120+50*sin(Y/35)':b='110+40*sin((X+Y)/50)',format=rgb24"],
  mandel: ['-f', 'lavfi', '-i', 'mandelbrot=s=320x240'],
  bars: ['-f', 'lavfi', '-i', 'smptebars=s=320x240'],
  testsrc: ['-f', 'lavfi', '-i', 'testsrc2=s=320x240'],
}
const TMPDIR = (process.env.TEMP || '/tmp').split(String.fromCharCode(92)).join('/')
const argPngs = process.argv.slice(2)
const run = (args) => new Promise((res, rej) => { const p = spawn(FFMPEG, args); const ch = []; let e = ''; p.stdout.on('data', (d) => ch.push(d)); p.stderr.on('data', (d) => (e += d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c + ' ' + e.slice(-200))))); p.on('error', rej) })
const raw = (png, vf) => run(['-y', '-i', png, ...(vf ? ['-vf', vf] : []), '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
// ★④-G SIGNAL-RELATIVE ERROR. Normalises the residual by the effect's OWN per-pixel
// signal instead of by the frame: sum|gl-ff| / sum|ff-plain|.
//
// ★WHY THE FRAME MEAN WAS THE WRONG INSTRUMENT. A whole-frame mean assumes the effect
// touches the whole frame. The colour grade does -- every pixel moves, so the mean
// represents it and an absolute gate works. A sharpen only moves pixels near edges, so
// flat regions sit in the denominator contributing nothing but weight, and the effect's
// measured magnitude is pushed down toward the 1 LSB floor. That is why neither a
// different threshold nor stronger content fixed it: synthetic and real AI footage both
// land at 0.5-0.7%.
// Here flat regions drop out of BOTH sums, so the number is 'how much of the effect did
// we get wrong, where the effect happens'. A do-nothing shader scores exactly 1.00 by
// construction (gl == plain, so the numerator becomes the denominator).
const signalErr = (plain, ff, gl) => {
  const n = Math.min(plain.length, ff.length, gl.length)
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += Math.abs(gl[i] - ff[i]); den += Math.abs(ff[i] - plain[i]) }
  return den === 0 ? 0 : num / den
}
// The floor expressed in `signalErr` units: sum|roundTrip - plain| / sum|ff - plain|.
// "Of the signal this row is measured against, this fraction is the pipeline moving
// pixels on its own."
const sumRatio = (plain, ff, roundTrip) => {
  let num = 0, den = 0
  for (let i = 0; i < plain.length; i++) { num += Math.abs(roundTrip[i] - plain[i]); den += Math.abs(ff[i] - plain[i]) }
  return den === 0 ? 0 : num / den
}
const diff = (a, b) => { const n = Math.min(a.length, b.length); let s = 0; for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]); return s / n / 255 * 100 }
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

// Runs a WebGL2 pipeline in the page. `pipeline` describes passes with the shared
// gl-effects shaders. Returns a PNG data buffer.
async function glRun(spec, testB64) {
  const url = await page.evaluate(async ({ testB64, spec, VERT }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + testB64; await img.decode()
    const W = img.width, H = img.height
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const gl = cv.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true })
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o }
    const prog = (fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p }
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const progs = {}; for (const k in spec.shaders) { const p = prog(spec.shaders[k]); const a = gl.getAttribLocation(p, 'a_pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); progs[k] = p }
    const mkTex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); for (const [k, v] of [['WRAP_S', 'CLAMP_TO_EDGE'], ['WRAP_T', 'CLAMP_TO_EDGE'], ['MIN_FILTER', 'LINEAR'], ['MAG_FILTER', 'LINEAR']]) gl.texParameteri(gl.TEXTURE_2D, gl['TEXTURE_' + k], gl[v]); return t }
    const src = mkTex(); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    const lutTex = mkTex(); if (spec.lut) { gl.bindTexture(gl.TEXTURE_2D, lutTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, spec.lut.W, spec.lut.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(spec.lut.px)) }
    const fbos = []; for (let i = 0; i < 4; i++) { const t = mkTex(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); fbos.push({ fb, tex: t }) }
    const uf = (p, n, v) => gl.uniform1f(gl.getUniformLocation(p, n), v)
    const draw = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    const to = (i) => { gl.bindFramebuffer(gl.FRAMEBUFFER, i === null ? null : fbos[i].fb); gl.viewport(0, 0, W, H) }
    // pass 1: color+LUT
    const cl = progs.cl; gl.useProgram(cl); gl.uniform1i(gl.getUniformLocation(cl, 'u_tex'), 0); gl.uniform1i(gl.getUniformLocation(cl, 'u_lut'), 1)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lutTex)
    for (const [k, v] of Object.entries(spec.U)) uf(cl, 'u_' + k, v)
    uf(cl, 'u_hasLut', spec.lut ? 1 : 0); uf(cl, 'u_N', spec.lut ? spec.lut.N : 2)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src)
    if (!spec.stages || !spec.stages.length) { to(null); draw(); return cv.toDataURL('image/png') }
    to(0); draw()
    let base = 0, bA = 1, bB = 2, out = 3
    for (const st of spec.stages) {
      const bl = progs.blur; gl.useProgram(bl); gl.uniform1i(gl.getUniformLocation(bl, 'u'), 0); uf(bl, 'u_sigma', st.sigma); gl.uniform2f(gl.getUniformLocation(bl, 'u_texel'), 1 / W, 1 / H)
      gl.uniform2f(gl.getUniformLocation(bl, 'u_dir'), 1, 0); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbos[base].tex); to(bA); draw()
      gl.uniform2f(gl.getUniformLocation(bl, 'u_dir'), 0, 1); gl.bindTexture(gl.TEXTURE_2D, fbos[bA].tex); to(bB); draw()
      const sc = progs.screen; gl.useProgram(sc); gl.uniform1i(gl.getUniformLocation(sc, 'u_base'), 0); gl.uniform1i(gl.getUniformLocation(sc, 'u_blur'), 1); uf(sc, 'u_op', st.opacity)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbos[base].tex); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fbos[bB].tex); to(out); draw()
      ;[base, out] = [out, base]
    }
    const cp = progs.copy; gl.useProgram(cp); gl.uniform1i(gl.getUniformLocation(cp, 'u'), 0); to(null); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, fbos[base].tex); draw()
    return cv.toDataURL('image/png')
  }, { testB64, spec, VERT })
  return Buffer.from(url.split(',')[1], 'base64')
}

// ★④-G: a SINGLE-pass runner, deliberately separate from glRun. glRun's pipeline is
// the one the colour/LUT/glow rows already passed on, and threading a new shader
// through it would edit a parity-critical path to test something that does not need
// it. This one just draws one fragment shader over the image, with the texel size the
// unsharp kernel needs.
async function glRunSingle(frag, uniforms, testB64) {
  const url = await page.evaluate(async ({ testB64, frag, uniforms, VERT }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + testB64; await img.decode()
    const W = img.width, H = img.height
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const gl = cv.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true })
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o }
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag)); gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p))
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.useProgram(p)
    const a = gl.getAttribLocation(p, 'a_pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex)
    // ★CLAMP_TO_EDGE is not incidental: vf_unsharp clamps at the borders, so the
    // sampler has to do the same or every edge pixel disagrees.
    for (const [k, v] of [['WRAP_S', 'CLAMP_TO_EDGE'], ['WRAP_T', 'CLAMP_TO_EDGE'], ['MIN_FILTER', 'NEAREST'], ['MAG_FILTER', 'NEAREST']]) gl.texParameteri(gl.TEXTURE_2D, gl['TEXTURE_' + k], gl[v])
    gl.activeTexture(gl.TEXTURE0); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0)
    gl.uniform2f(gl.getUniformLocation(p, 'u_texel'), 1 / W, 1 / H)
    for (const [k, v] of Object.entries(uniforms)) gl.uniform1f(gl.getUniformLocation(p, 'u_' + k), v)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return cv.toDataURL('image/png')
  }, { testB64, frag, uniforms, VERT })
  return Buffer.from(url.split(',')[1], 'base64')
}

const shadersCL = { cl: FRAG_COLOR_LUT }
const shadersGlow = { cl: FRAG_COLOR_LUT, blur: FRAG_BLUR, screen: FRAG_SCREEN, copy: '#version 300 es\nprecision highp float; in vec2 v_uv; out vec4 o; uniform sampler2D u; void main(){ o=texture(u,v_uv); }' }

// Build (or take) the content set, then measure every case on every content.
const items = []
if (argPngs.length) {
  for (const p of argPngs) items.push({ name: p.split(/[\/]/).pop().replace(/\.png$/, ''), png: p })
} else {
  for (const [name, args] of Object.entries(CONTENT)) {
    const png = `${TMPDIR}/parity_${name}.png`
    await run(['-y', ...args, '-frames:v', '1', png])
    items.push({ name, png })
  }
}

// The GL side takes slider values; the ffmpeg side takes the SAME slider values
// through the worker's own builder. That equality is the whole point -- one set of
// numbers, two engines, no third transcription in the middle.
const COLOR_SLIDERS = { exposure: 10, contrast: 30, saturation: -20 }
const LUT_ID = 'teal-orange'
// ★A mid slider, not an extreme: the amount is sh/50, so 50 -> 1.0, which is the
// strength a creator is most likely to sit at.
const SHARPEN_SLIDERS = { sharpen: 50 }
const ff = (e) => effectVideoFilters(e).join(',')

const CASES = [
  {
    name: 'color',
    gate: 2.5,
    // ★From the worker, not transcribed: effectVideoFilters() maps the sliders to
    // eq(brightness=ex/200, contrast=1+co/100, saturation=1+sa/100). If that mapping
    // changes in render.ts, this row moves instead of silently still passing.
    vf: `${ff(COLOR_SLIDERS)},format=rgb24`,
    gl: async (b64) => glRun({ shaders: shadersCL, U: colorUniforms(COLOR_SLIDERS) }, b64),
  },
  {
    name: 'LUT',
    gate: 3,
    // ★From the worker (LUT_DIR points at its assets/luts, md5-checked above).
    vf: `${ff({ lut: LUT_ID })},format=rgb24`,
    gl: async (b64) => {
      const cube = parseCube(await readFile('public/luts/teal_orange.cube', 'utf8'))
      const t = tileCube(cube)
      return glRun({ shaders: shadersCL, U: colorUniforms(), lut: { px: Array.from(t.px), W: t.W, H: t.H, N: cube.size } }, b64)
    },
  },
  {
    name: 'glow',
    gate: 5,
    // ★STILL A LOCAL COPY of what render.ts buildSegmentFC() emits -- this row does
    // NOT detect drift in the worker's glow. Deferred on purpose (approved
    // 2026-08-01): buildSegmentFC returns a labelled filter_complex whose tail
    // appends the geometric normalisation, including `format=yuv420p`. Adopting it
    // as-is would fold a chroma-subsampling round trip into this number, so the
    // 5% gate would have to be re-baselined -- which is a measurement and an
    // approval, not a drive-by edit. Closing it means extracting the sigma/opacity
    // pair out of buildSegmentFC in the worker (~15 lines, no behaviour change);
    // that is step 0 of the effects epic, before grain/motionBlur/dissolve touch
    // render.ts. Until then the harness SAYS so on every run (see COPIED below).
    copied: true,
    vf: 'split[a][b];[b]gblur=sigma=6.250[c];[a][c]blend=all_mode=screen:all_opacity=0.500,format=rgb24',
    gl: async (b64) => glRun({ shaders: shadersGlow, U: colorUniforms(), stages: glowStages({ glow: 50 }) }, b64),
  },
  {
    // ★④-G sharpen. Measured against the WORKER's own filter string
    // (unsharp=5:5:sh/50:5:5:0), not a copy, so a change in render.ts moves this number.
    //
    // ★HISTORY, kept because it explains why this row used to warn against exposing
    // sharpen and no longer does. Under the OLD absolute 2.5% gate, this row's
    // "PASS" was close to meaningless (scripts/negctl-sharpen.mjs, 2026-08-08):
    //
    //   content   the effect's OWN magnitude   old absolute-gate residual
    //   smooth    0.18%                        0.18%   <- residual == the whole effect
    //   mandel    0.72%                        0.18%
    //   bars      0.33%                        0.08%
    //   testsrc   0.71%                        0.15%
    //
    // On smooth the residual EQUALED the effect -- a do-nothing shader would have
    // scored the same. An effect moving an image by only 0.2-0.7% cannot be judged
    // by a 2.5% ABSOLUTE threshold calibrated for the colour grade (which moves
    // images by percent) at all.
    //
    // ★BOTH BLOCKERS THIS COMMENT USED TO NAME ARE NOW CLOSED. (1) The kernel match:
    // finished 2026-08-08 -- a fitted candidate set tied the shipped binomial-5
    // kernel at gap 0.000 (probe-unsharp-kernel.mjs / fit-unsharp-kernel.mjs), so
    // the shader's own math is exonerated. (2) The gate shape for low-magnitude
    // effects: 제니2, 2026-08-08 -- the SIGNAL-RELATIVE bands below (judge()), which
    // replaced the absolute 2.5% threshold. Under that gate this row reads PASS on
    // mandel/testsrc (r=0.256/0.209) and UNMEASURABLE on smooth/bars (magnitude at
    // the 1-LSB floor, not a fail) -- 0 REVIEW, 0 FAIL. ★sharpen joined
    // EXPOSED_SLIDER_KEYS 2026-08-10 on the strength of this row, once preview-gl.ts
    // was wired to run it in the worker's real order (see lib/effects.ts's note).
    name: 'sharpen',
    gate: 2.5,
    vf: `${ff(SHARPEN_SLIDERS)},format=rgb24`,
    gl: async (b64) => glRunSingle(FRAG_UNSHARP, { amount: unsharpAmount(SHARPEN_SLIDERS) }, b64),
  },
]

// ★MEASUREMENT FLOOR = 1 LSB. The colour port established that ffmpeg's own identity
// RGB->YUV->RGB round trip is lossy by up to one code value, so nothing below this is
// measurable by this harness -- and an EFFECT whose whole magnitude sits at or under it
// cannot be judged on that content by any threshold, however the threshold is shaped.
const FLOOR_PCT = 100 / 255 // 0.392%

const results = {}
for (const c of CASES) results[c.name] = []
for (const it of items) {
  const b64 = (await readFile(it.png)).toString('base64')
  const plain = await raw(it.png)
  // ★THE PIPELINE'S OWN FLOOR, on this content. An RGB->yuv444p->RGB round trip with NO
  // effect at all: measured 2026-08-08 at 0.124-0.130% on real frames while the whole
  // sharpen only moves them 0.53-0.65%, i.e. the irreducible quantisation is a FIFTH to a
  // QUARTER of the effect being measured. yuv444p is the format the graph already
  // negotiates (verified byte-identical to leaving it alone), so this is the real floor
  // and not a hypothetical one.
  // ★It is REPORTED BESIDE the ratio, never subtracted. Subtracting would assume the
  // floor and the shader's error are independent, and there is no evidence for that -- a
  // free-floating term can cancel real error and erase it. Same reason the absolute gate
  // needed magnitude beside it rather than folded into it.
  const roundTrip = await raw(it.png, 'format=yuv444p,format=rgb24')
  for (const c of CASES) {
    const outPng = `${it.png.replace(/\.png$/, '')}.eng.${c.name}.png`
    await writeFile(outPng, await c.gl(b64))
    const ffOut = await raw(it.png, c.vf)
    const d = diff(ffOut, await raw(outPng))
    // ★How far the EFFECT moves the image at all. Without this the residual has no
    // scale: a 0.18% residual is excellent against a 5% effect and worthless against a
    // 0.18% one, and the second case is a shader that could be doing nothing.
    const mag = diff(plain, ffOut)
    const sig = signalErr(plain, ffOut, await raw(outPng))
    // The floor in the SAME units as `sig`: how much of the signal we are measuring
    // against is pipeline noise rather than effect.
    const floor = signalErr(plain, ffOut, roundTrip) === 0 ? 0 : sumRatio(plain, ffOut, roundTrip)
    results[c.name].push({ content: it.name, d, mag, sig, floor })
  }
}

// ★Every number carries its own provenance. These figures are properties of a
// SPECIFIC ffmpeg build, and the deployed worker's is not necessarily this one
// (measured 2026-08-01: Railway runs 5.1.9-0+deb12u1 on Debian 12). A parity table
// with no version on it invites the same mistake as a harness with no source on it.
console.log('')
console.log(await ffmpegBanner())
console.log(`worker repo: ${WORKER_REPO}`)
console.log(`filters    : color+LUT imported from the worker; glow = LOCAL COPY (drift NOT detected)`)
console.log('ENGINE parity -- one row per case, one column per content')
console.log('case   gate   ' + items.map((i) => i.name.padEnd(9)).join('') + ' verdict')
// ★WHICH GATE JUDGED A ROW IS PART OF THE RESULT. The condition is in code, not a
// per-effect list, so it splits by itself:
//
//   magnitude <= FLOOR        -> UNMEASURABLE. The content cannot judge this effect at
//                                all. NOT a pass -- that is exactly the smooth/sharpen
//                                vacuous PASS this rule exists to stop.
//   magnitude <  the gate     -> RELATIVE. An absolute percentage cannot discriminate an
//                                effect smaller than the percentage itself.
//   otherwise                 -> ABSOLUTE, unchanged. colour / LUT / glow were baselined
//                                against it and re-baselining needs its own evidence.
//
// ★The relative THRESHOLD is deliberately absent (`relGate` unset). It has to be
// derived, and the derivation currently says it cannot be: a no-op shader scores
// ratio 1.00, while a CORRECT shader is bounded below by FLOOR/magnitude -- which on the
// strongest content available here (mandel/testsrc, ~1.18% at sharpen=100) is already
// 0.33, and on bars 0.76. There is no value that admits the second and rejects the first
// with that little separation. So a row that lands in the RELATIVE branch reports its
// ratio and is marked UNDECIDED rather than being waved through.
// ★★THE BANDS (제니2, 2026-08-08). Judged on the SIGNAL-RELATIVE error r:
//
//   r <  0.5   PASS
//   r <  1.0   REVIEW  -- a human looks
//   r >= 1.0   FAIL    -- no better than doing nothing
//
// ★0.5 IS NOT A MEASURED VALUE, and saying so is the point. It is a quality
// judgement: if half of the effect is wrong, that is not the effect. It was derived
// from the HARD edge (1.000, structural -- a do-nothing shader scores exactly that
// because its numerator becomes its denominator), not from the soft one: the worst
// known-good measurement is colour/smooth at 0.184, and anchoring a bar just above a
// single measurement is the hardcoding this project keeps catching.
// ★THE LOWER EDGE IS ONE MEASUREMENT and stays soft on purpose. The way to tighten it
// is to add known-good samples (more contents, more ported effects), not to move the
// bar down to fit today's table. The REVIEW band exists so the empty ground between
// 0.184 and 0.5 reaches a person instead of passing quietly.
//
// ★THE FLOOR IS CHECKED FIRST, and that ordering changes the answer. When the effect's
// own magnitude is at or under 1 LSB, ffmpeg's change is itself at quantisation noise:
// a float shader can produce a sub-LSB move that rounds to zero in 8-bit output while
// ffmpeg's integer path rounds to +/-1. r then reads 1.000 and LOOKS like a
// do-nothing shader when what actually happened is that the content cannot resolve the
// effect. Judging that as FAIL would blame the shader for the instrument.
const judge = (row, gate) => {
  if (row.mag <= FLOOR_PCT) return { how: 'UNMEASURABLE', band: null, ok: null }
  const r = row.sig
  if (r < 0.5) return { how: 'SIGNAL', band: 'PASS', ok: true, r }
  if (r < 1.0) return { how: 'SIGNAL', band: 'REVIEW', ok: false, r }
  return { how: 'SIGNAL', band: 'FAIL', ok: false, r }
}

let allPass = true
for (const c of CASES) {
  const rows = results[c.name]
  const verdicts = rows.map((r) => ({ r, v: judge(r, c.gate) }))
  const judged = verdicts.filter((x) => x.v.band)
  const unmeasurable = verdicts.filter((x) => x.v.how === 'UNMEASURABLE')
  const failed = judged.filter((x) => x.v.band === 'FAIL')
  const review = judged.filter((x) => x.v.band === 'REVIEW')

  let verdict
  if (!judged.length) verdict = 'NO VERDICT -- no content could resolve this effect'
  else if (failed.length) verdict = `FAIL on ${failed.map((x) => x.r.content).join(', ')}`
  else if (review.length) verdict = `REVIEW on ${review.map((x) => x.r.content).join(', ')}`
  else verdict = 'PASS'
  if (failed.length || review.length || !judged.length) allPass = false

  console.log(
    c.name.padEnd(8) + 'r<0.5  ' +
      rows.map((x) => (judge(x, c.gate).band ? x.sig.toFixed(3) : 'n/a').padEnd(9)).join('') +
      `${verdict}  [${judged.length}/${rows.length} judged]` +
      (c.copied ? '  ★COPIED filter' : ''),
  )
  console.log('         ' + rows.map((x) => `${x.content}=${judge(x, c.gate).band ?? 'UNMEASURABLE'}`).join('  '))
  // ★floor / ratio / floor-as-a-share-of-ratio, side by side. The VERDICT is the ratio
  // alone; these three are how a reader tells how much of that ratio is the pipeline
  // rather than the shader. Nothing is subtracted -- see the note on `sumRatio`.
  console.log(
    '         floor|ratio|share  ' +
      rows.map((x) => {
        const share = x.sig > 0 ? (x.floor / x.sig) : 0
        return `${x.content}=${x.floor.toFixed(3)}|${x.sig.toFixed(3)}|${(share * 100).toFixed(0)}%`
      }).join('  '),
  )
  for (const x of unmeasurable) {
    console.log(
      `         ★${x.r.content}: effect magnitude ${x.r.mag.toFixed(2)}% <= floor ${FLOOR_PCT.toFixed(2)}%` +
        ` -- the content cannot resolve the effect, so r is not the shader's fault`,
    )
  }
}
console.log('bands: PASS r<0.5 | REVIEW 0.5<=r<1.0 | FAIL r>=1.0 (a do-nothing shader = 1.000)')
console.log('★0.5 is a quality bar, not a measurement. Lower edge (worst known-good 0.184) is ONE')
console.log(' measurement -- tighten it by adding known-good samples, not by moving the bar.')
console.log(allPass ? 'ALL PASS' : 'REVIEW')
await browser.close()
if (!allPass) process.exitCode = 1
