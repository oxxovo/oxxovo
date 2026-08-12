// Derive whether the UNMEASURABLE gate (`mag <= FLOOR`) should widen to
// `mag < FLOOR*k`, per 제니2's 3 conditions (2026-08-10, in response to the
// exposure-keyframe near-zero FAIL/REVIEW rows in gl-keyframe-parity.mjs):
//   ①a no-op/broken control must FAIL (r>=1.0) throughout the widened band
//   ②the CORRECT shader must PASS (r<0.5) at every magnitude the band does
//     NOT swallow, i.e. k is the LARGEST magnitude where r is still unstable
//   ③re-check the 5 existing gl-engine-parity.mjs rows (20 content x case
//     cells) for verdict flips under the new gate
// If separability doesn't hold cleanly, this reports "못 정한다", not a guess.
//   node scripts/gl-floor-derive.mjs
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'
import { chromium } from 'playwright-core'
import { FFMPEG, ffmpegBanner } from './ffmpeg-bin.mjs'
import { VERT, FRAG_COLOR_LUT, colorUniforms } from '../lib/gl-effects.ts'
import { resolveWorkerRepo } from './worker-repo.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_REPO = resolveWorkerRepo(ROOT)
const RENDER_TS = join(WORKER_REPO, 'src', 'render.ts')
register('./test-hooks.mjs', import.meta.url)
const { effectVideoFilters } = await import(pathToFileURL(RENDER_TS).href)

const run = (args) => new Promise((res, rej) => { const p = spawn(FFMPEG, args); const ch = []; let e = ''; p.stdout.on('data', (d) => ch.push(d)); p.stderr.on('data', (d) => (e += d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c + ' ' + e.slice(-500))))); p.on('error', rej) })
const raw = (png, vf) => run(['-y', '-i', png, ...(vf ? ['-vf', vf] : []), '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
const diff = (a, b) => { const n = Math.min(a.length, b.length); let s = 0; for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]); return s / n / 255 * 100 }
const signalErr = (plain, ff, gl) => {
  const n = Math.min(plain.length, ff.length, gl.length)
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += Math.abs(gl[i] - ff[i]); den += Math.abs(ff[i] - plain[i]) }
  return den === 0 ? 0 : num / den
}
const FLOOR_PCT = 100 / 255

console.log(await ffmpegBanner())
const TMPDIR = (process.env.TEMP || '/tmp').split(String.fromCharCode(92)).join('/')
const srcPng = `${TMPDIR}/kderive_src.png`
await run(['-y', '-f', 'lavfi', '-i', 'mandelbrot=s=320x240', '-frames:v', '1', srcPng])
const b64 = (await readFile(srcPng)).toString('base64')
const plain = await raw(srcPng)

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

// Static (not keyframed) exposure sweep -- isolates the METRIC's near-floor
// behaviour for this effect+content from keyframe-interpolation timing,
// which is a separate variable already verified exact elsewhere (D KAT +
// static-vs-dynamic ffmpeg comparisons).
const SWEEP = [1, 2, 3, 4, 5, 6, 8, 10, 14, 20, 30, 50]
console.log('\n== exposure static sweep, content=mandel ==')
console.log('ex   mag%    r_correct  r_broken  verdict(old FLOOR<=1LSB)')
const rows = []
for (const ex of SWEEP) {
  const vf = `${effectVideoFilters({ exposure: ex }).join(',')},format=rgb24`
  const ff = await raw(srcPng, vf)
  const mag = diff(plain, ff)
  const glCorrect = await raw(await (async () => { const p = `${TMPDIR}/kderive_${ex}.png`; await writeFile(p, await glColorGrade(colorUniforms({ exposure: ex }))); return p })())
  const glBroken = await raw(await (async () => { const p = `${TMPDIR}/kderive_broken_${ex}.png`; await writeFile(p, await glColorGrade(colorUniforms({ exposure: 0 }))); return p })())
  const rCorrect = signalErr(plain, ff, glCorrect)
  const rBroken = signalErr(plain, ff, glBroken)
  const oldVerdict = mag <= FLOOR_PCT ? 'UNMEASURABLE' : rCorrect < 0.5 ? 'PASS' : rCorrect < 1.0 ? 'REVIEW' : 'FAIL'
  rows.push({ ex, mag, rCorrect, rBroken, oldVerdict })
  console.log(`${String(ex).padEnd(4)} ${mag.toFixed(2).padEnd(7)} ${rCorrect.toFixed(3).padEnd(10)} ${rBroken.toFixed(3).padEnd(9)} ${oldVerdict}`)
}

// ①broken must FAIL (r>=1.0) at every magnitude in the sweep.
const brokenAlwaysFails = rows.every((r) => r.rBroken >= 1.0)
console.log(`\n①broken control r>=1.0 throughout: ${brokenAlwaysFails ? 'HOLDS (algebraic: gl=plain -> r=1.000 exactly whenever mag>0)' : 'VIOLATED -- ' + JSON.stringify(rows.filter((r) => r.rBroken < 1.0))}`)

// Find the largest-magnitude row that is UNSTABLE (rCorrect >= 0.5, i.e. not
// a clean PASS) -- that row's mag is the candidate mag* for the new floor.
// Then require EVERY row above it to PASS (condition ②), and NONE of them to
// dip back below 0.5 later (no re-crossing -- if it did, separability isn't
// clean and k cannot be derived from a single cutoff).
let magStar = null
let clean = true
let sawPassAfterUnstable = false
for (let i = 0; i < rows.length; i++) {
  const r = rows[i]
  const unstable = r.rCorrect >= 0.5
  if (unstable) {
    magStar = r.mag
    if (sawPassAfterUnstable) clean = false // re-crossed after already passing once -- not a clean cutoff
  } else {
    sawPassAfterUnstable = true
  }
}
console.log(`\n candidate mag* (largest unstable row's mag) = ${magStar === null ? 'none -- everything already passes' : magStar.toFixed(3) + '%'}`)
console.log(` monotonic single-crossing (no re-entry into unstable after a pass): ${clean ? 'YES' : 'NO -- k cannot be derived as a single cutoff'}`)

let k = null
if (magStar !== null && clean) {
  k = magStar / FLOOR_PCT
  console.log(`\n②rows above mag* all PASS: ${rows.filter((r) => r.mag > magStar).every((r) => r.rCorrect < 0.5) ? 'HOLDS' : 'VIOLATED'}`)
  console.log(`\n★DERIVED k = mag* / FLOOR_PCT = ${magStar.toFixed(3)} / ${FLOOR_PCT.toFixed(3)} = ${k.toFixed(2)}`)
} else {
  console.log('\n★k NOT DERIVED from this sweep -- see reasoning above.')
}

await browser.close()
console.log(JSON.stringify({ rows, magStar, k }))
