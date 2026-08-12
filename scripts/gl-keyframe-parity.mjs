// D keyframes -- ①(GL preview)/②(worker render.ts) parity, post-wiring.
// Compares the GL preview's per-frame valueAt(...)-driven uniforms against the
// WORKER's REAL buildSegmentVf() filter string (toFfmpegExpr baked into
// eq/vignette), rendered through actual ffmpeg, at several segment-relative
// timestamps. Signal-relative error, same instrument and bands as
// scripts/gl-engine-parity.mjs.
//   node scripts/gl-keyframe-parity.mjs
//
// ★Imports the WORKER's OWN buildSegmentVf (not a copy) -- same discipline as
// gl-engine-parity.mjs's color/LUT rows: a drift in render.ts's keyframe
// wiring moves this number, it does not go undetected.
//
// ★TWO SEPARATE CASES, not one segment with both tracks keyframed. Found by
// running it the other way first: vignette's own mapping (vg=0 -> angle=PI/6)
// is NOT "no vignette" -- render.ts's static branch only OMITS the vignette
// filter when `vg` is falsy (see effectVideoFilters), but the keyframed
// branch ALWAYS emits it once ANY point exists on the track, including a
// t=0 point valued 0. A combined segment therefore always carries a real,
// nonzero vignette component neither this harness's GL side (deliberately
// vignette-free FRAG_COLOR_LUT, see lib/gl-effects.ts's 2026-08-10 note) nor
// a "plain" reference can isolate -- every frame read mag~13-22% from
// vignette alone and r>=1.0 FAIL, which was the harness comparing apples to
// a vignette-less orange, not a real exposure mismatch. Split per the same
// separation gl-engine-parity.mjs already uses (color vs vignette are
// different CASES there too).
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'
import { chromium } from 'playwright-core'
import { FFMPEG, ffmpegBanner } from './ffmpeg-bin.mjs'
import { VERT, FRAG_COLOR_LUT, FRAG_VIGNETTE, colorUniforms } from '../lib/gl-effects.ts'
import { valueAt } from '../lib/edl-keyframes.ts'
import { resolveWorkerRepo } from './worker-repo.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_REPO = resolveWorkerRepo(ROOT)
const RENDER_TS = join(WORKER_REPO, 'src', 'render.ts')
if (!existsSync(RENDER_TS)) {
  console.error(`\n★Cannot load the worker's filter builder -- exiting 1.\n  looked for: ${RENDER_TS}\n`)
  process.exit(1)
}
process.env.LUT_DIR = join(WORKER_REPO, 'assets', 'luts')
register('./test-hooks.mjs', import.meta.url)
let buildSegmentVf
try {
  ;({ buildSegmentVf } = await import(pathToFileURL(RENDER_TS).href))
} catch (e) {
  console.error(`\n★Found ${RENDER_TS} but could not import it. ${e?.message ?? e}\n`)
  process.exit(1)
}

const run = (args) => new Promise((res, rej) => { const p = spawn(FFMPEG, args); const ch = []; let e = ''; p.stdout.on('data', (d) => ch.push(d)); p.stderr.on('data', (d) => (e += d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c + ' ' + e.slice(-500))))); p.on('error', rej) })
const raw = (png, vf) => run(['-y', '-i', png, ...(vf ? ['-vf', vf] : []), '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
const frameAt = (file, n) => run(['-y', '-i', file, '-vf', `select=eq(n\\,${n})`, '-vsync', '0', '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
const signalErr = (plain, ff, gl) => {
  const n = Math.min(plain.length, ff.length, gl.length)
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += Math.abs(gl[i] - ff[i]); den += Math.abs(ff[i] - plain[i]) }
  return den === 0 ? 0 : num / den
}
// The pipeline's own floor, same units as signalErr -- how much of the denominator
// is ffmpeg's own lossy identity round trip rather than the effect (gl-engine-parity.mjs).
const sumRatio = (plain, ff, roundTrip) => {
  let num = 0, den = 0
  for (let i = 0; i < plain.length; i++) { num += Math.abs(roundTrip[i] - plain[i]); den += Math.abs(ff[i] - plain[i]) }
  return den === 0 ? 0 : num / den
}
const diff = (a, b) => { const n = Math.min(a.length, b.length); let s = 0; for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]); return s / n / 255 * 100 }
const FLOOR_PCT = 100 / 255

console.log(await ffmpegBanner())
console.log(`worker repo: ${WORKER_REPO}`)

const CANVAS = { w: 320, h: 240, fps: 10 }
const TMPDIR = (process.env.TEMP || '/tmp').split(String.fromCharCode(92)).join('/')
const srcPng = `${TMPDIR}/kfparity_src.png`
await run(['-y', '-f', 'lavfi', '-i', `mandelbrot=s=${CANVAS.w}x${CANVAS.h}`, '-frames:v', '1', srcPng])
const b64 = (await readFile(srcPng)).toString('base64')

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()

async function glColorGrade(u) {
  const url = await page.evaluate(async ({ testB64, u, frag, VERT }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + testB64; await img.decode()
    const W = img.width, H = img.height
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const gl = cv.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true })
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o }
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag)); gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p))
    gl.useProgram(p)
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const a = gl.getAttribLocation(p, 'a_pos'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0)
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex)
    for (const [k, v] of [['WRAP_S', 'CLAMP_TO_EDGE'], ['WRAP_T', 'CLAMP_TO_EDGE'], ['MIN_FILTER', 'NEAREST'], ['MAG_FILTER', 'NEAREST']]) gl.texParameteri(gl.TEXTURE_2D, gl['TEXTURE_' + k], gl[v])
    gl.activeTexture(gl.TEXTURE0); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0); gl.uniform1i(gl.getUniformLocation(p, 'u_lut'), 1)
    for (const [k, v] of Object.entries(u)) gl.uniform1f(gl.getUniformLocation(p, 'u_' + k), v)
    gl.uniform1f(gl.getUniformLocation(p, 'u_hasLut'), 0); gl.uniform1f(gl.getUniformLocation(p, 'u_N'), 2)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return cv.toDataURL('image/png')
  }, { testB64: b64, u, frag: FRAG_COLOR_LUT, VERT })
  return Buffer.from(url.split(',')[1], 'base64')
}

// Same runner shape as gl-engine-parity.mjs's glRunVignette (2-texture, u_res).
const vignetteLutB64 = (await readFile(join(ROOT, 'public', 'vignette', 'vignette-lut.png'))).toString('base64')
async function glVignette(vignette) {
  const url = await page.evaluate(async ({ testB64, vignetteLutB64, vignette, frag, VERT }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + testB64; await img.decode()
    const lutImg = new Image(); lutImg.src = 'data:image/png;base64,' + vignetteLutB64; await lutImg.decode()
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
    for (const [k, v] of [['WRAP_S', 'CLAMP_TO_EDGE'], ['WRAP_T', 'CLAMP_TO_EDGE'], ['MIN_FILTER', 'NEAREST'], ['MAG_FILTER', 'NEAREST']]) gl.texParameteri(gl.TEXTURE_2D, gl['TEXTURE_' + k], gl[v])
    gl.activeTexture(gl.TEXTURE0); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    const lutTex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, lutTex)
    for (const [k, v] of [['WRAP_S', 'CLAMP_TO_EDGE'], ['WRAP_T', 'CLAMP_TO_EDGE'], ['MIN_FILTER', 'LINEAR'], ['MAG_FILTER', 'LINEAR']]) gl.texParameteri(gl.TEXTURE_2D, gl['TEXTURE_' + k], gl[v])
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lutImg)
    gl.uniform1i(gl.getUniformLocation(p, 'u_tex'), 0); gl.uniform1i(gl.getUniformLocation(p, 'u_vignetteLut'), 1)
    gl.uniform1f(gl.getUniformLocation(p, 'u_vignette'), vignette)
    gl.uniform2f(gl.getUniformLocation(p, 'u_res'), W, H)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    return cv.toDataURL('image/png')
  }, { testB64: b64, vignetteLutB64, vignette, frag: FRAG_VIGNETTE, VERT })
  return Buffer.from(url.split(',')[1], 'base64')
}

async function renderWorkerAvi(seg, tag) {
  const vf = buildSegmentVf(seg, CANVAS)
  const durSec = (seg.endMs - seg.startMs) / 1000
  const out = `${TMPDIR}/kfparity_${tag}.avi`
  await run(['-y', '-loop', '1', '-i', srcPng, '-t', String(durSec), '-r', String(CANVAS.fps), '-vf', vf, '-c:v', 'rawvideo', '-pix_fmt', 'yuv420p', out])
  return { out, vf }
}
const plainOut = `${TMPDIR}/kfparity_plain.avi`
await run(['-y', '-loop', '1', '-i', srcPng, '-t', '3', '-r', String(CANVAS.fps), '-vf', `scale=${CANVAS.w}:${CANVAS.h},format=yuv420p`, '-c:v', 'rawvideo', '-pix_fmt', 'yuv420p', plainOut])
const roundTripOut = `${TMPDIR}/kfparity_roundtrip.avi`
await run(['-y', '-loop', '1', '-i', srcPng, '-t', '3', '-r', String(CANVAS.fps), '-vf', `scale=${CANVAS.w}:${CANVAS.h},format=yuv444p,format=yuv420p`, '-c:v', 'rawvideo', '-pix_fmt', 'yuv420p', roundTripOut])

const frames = [0, 5, 15, 20, 29]
let allOk = true

async function runCase(label, seg, tag, glFn, extract) {
  const { out, vf } = await renderWorkerAvi(seg, tag)
  console.log(`\n== ${label} ==`)
  console.log(`worker vf: ${vf}`)
  console.log('frame  t(s)  value(JS)  mag%    r       floor   share  verdict')
  for (const n of frames) {
    const t = n / CANVAS.fps
    const segRelMs = t * 1000
    const val = valueAt(seg._track, segRelMs)
    const glPng = `${TMPDIR}/kfparity_gl_${tag}_${n}.png`
    await writeFile(glPng, await glFn(val))
    const glOut = await raw(glPng)
    const plainFrame = await frameAt(plainOut, n)
    const ffFrame = extract(await frameAt(out, n))
    const roundTripFrame = await frameAt(roundTripOut, n)
    const mag = diff(plainFrame, ffFrame)
    const r = mag <= FLOOR_PCT ? null : signalErr(plainFrame, ffFrame, glOut)
    const floor = r === null ? null : sumRatio(plainFrame, ffFrame, roundTripFrame)
    const share = r === null || r === 0 ? null : floor / r
    const verdict = r === null ? 'UNMEASURABLE' : r < 0.5 ? 'PASS' : r < 1.0 ? 'REVIEW' : 'FAIL'
    if (verdict === 'FAIL' || verdict === 'REVIEW') allOk = false
    console.log(`${String(n).padEnd(6)} ${t.toFixed(2).padEnd(6)} ${val.toFixed(4).padEnd(10)} ${mag.toFixed(2).padEnd(7)} ${r === null ? 'n/a' : r.toFixed(3).padEnd(7)} ${floor === null ? 'n/a' : floor.toFixed(3).padEnd(7)} ${share === null ? 'n/a' : (share * 100).toFixed(0) + '%'.padEnd(4)} ${verdict}`)
  }
}

// Case 1: exposure only (decision ①(a)). No vignette anywhere in the segment.
const segEx = {
  jobId: 'kf-parity-ex', startMs: 0, endMs: 3000,
  keyframes: { exposure: { points: [{ atMs: 0, value: 0 }, { atMs: 3000, value: 50 }] } },
  _track: { points: [{ atMs: 0, value: 0 }, { atMs: 3000, value: 50 }] },
}
await runCase('exposure keyframe (GL: colorUniforms+FRAG_COLOR_LUT vs worker eq eval=frame)', segEx, 'ex',
  (val) => glColorGrade(colorUniforms({ exposure: val })), (x) => x)

// Case 2: vignette only. No exposure/contrast/saturation anywhere.
const segVg = {
  jobId: 'kf-parity-vg', startMs: 0, endMs: 3000,
  keyframes: { vignette: { points: [{ atMs: 0, value: 0 }, { atMs: 3000, value: 60 }] } },
  _track: { points: [{ atMs: 0, value: 0 }, { atMs: 3000, value: 60 }] },
}
await runCase('vignette keyframe (GL: FRAG_VIGNETTE+LUT vs worker vignette eval=frame)', segVg, 'vg',
  (val) => glVignette(colorUniforms({ vignette: val }).vignette), (x) => x)

console.log('\nbands: PASS r<0.5 | REVIEW 0.5<=r<1.0 | FAIL r>=1.0 | UNMEASURABLE if effect<=1 LSB (same as gl-engine-parity.mjs)')
console.log(allOk ? 'ALL PASS' : 'REVIEW/FAIL PRESENT')
await browser.close()
if (!allOk) process.exitCode = 1
