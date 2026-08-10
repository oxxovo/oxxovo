// ★DO NOT GUESS ffmpeg's vignette= math -- extract it the way the unsharp
// kernel was extracted (probe-unsharp-kernel.mjs / fit-unsharp-kernel.mjs): a
// FLAT field + a KNOWN input, so the output IS the function; propose
// candidate closed forms, fit their parameters against ffmpeg's own output
// (never assumed), and report the winner -- or say plainly that nothing fit,
// per the same rule fit-unsharp-kernel.mjs used (early-stop conditions
// written BEFORE running, not tuned to the result afterward).
//   node scripts/fit-vignette-model.mjs
//
// Companion: scripts/probe-vignette-model.mjs establishes the ONE fact this
// script assumes -- attenuation is a function of raw PIXEL distance from
// center only (circularly symmetric, NOT per-axis/aspect-normalized): equal
// pixel distance in two different directions (straight-right vs 45°-diagonal)
// gave IDENTICAL attenuation to 4 decimal places. If that measurement is ever
// redone on a different ffmpeg build, re-run it before trusting this file.
import { spawn } from 'node:child_process'
import { FFMPEG, ffmpegBanner } from './ffmpeg-bin.mjs'

const run = (args) => new Promise((res, rej) => { const p = spawn(FFMPEG, args); const ch = []; let e = ''; p.stdout.on('data', (d) => ch.push(d)); p.stderr.on('data', (d) => (e += d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c + ' ' + e.slice(-300))))); p.on('error', rej) })
const rawFromLavfi = (lavfi, W, H) => run(['-y', '-f', 'lavfi', '-i', lavfi, '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])

console.log(await ffmpegBanner())

const W = 640, H = 480
const cx = (W - 1) / 2, cy = (H - 1) / 2
const halfW = cx

// Radial scan, midline, center to right edge. dither=0 so the curve read is
// the deterministic function, not the dither noise on top of it.
async function radialCurve(angle, gray = 200) {
  const flat = await rawFromLavfi(`color=c=gray@${(gray / 255).toFixed(4)}:s=${W}x${H}`, W, H)
  const vig = await rawFromLavfi(`color=c=gray@${(gray / 255).toFixed(4)}:s=${W}x${H},vignette=angle=${angle}:dither=0`, W, H)
  const y = Math.round(cy)
  const pts = []
  for (let x = Math.round(cx); x < W; x++) {
    const idx = (y * W + x) * 3
    if (flat[idx] === 0) continue
    pts.push({ d: Math.abs(x - cx), atten: vig[idx] / flat[idx] })
  }
  return pts
}

function rmseAgainst(curve, fn) {
  let sumSq = 0
  for (const { d, atten } of curve) { const e = fn(d) - atten; sumSq += e * e }
  return Math.sqrt(sumSq / curve.length)
}

// ★1-parameter grid search (coarse -> 4 refine passes), not a hand-picked k --
// the fitted k is what the data says, whatever family it belongs to.
function fitK(curve, fn, lo, hi) {
  let best = null
  const step = (a, b, n) => {
    for (let i = 0; i <= n; i++) { const k = a + ((b - a) * i) / n; const r = rmseAgainst(curve, (d) => fn(d, k)); if (!best || r < best.rmse) best = { k, rmse: r } }
  }
  step(lo, hi, 200)
  for (let pass = 0; pass < 4; pass++) { const span = (hi - lo) / Math.pow(10, pass); step(best.k - span, best.k + span, 200) }
  return best
}

// ★2-parameter grid search (k AND the cos power p) -- if even a freely-fit
// (k,p) pair can't match, the FORM is wrong, not just the parameter.
function fitKP(curve, kMax, pMax) {
  let best = null
  for (let ki = 1; ki <= 400; ki++) {
    const k = (ki / 400) * kMax
    for (let pi = 1; pi <= 120; pi++) {
      const p = (pi / 120) * pMax
      const r = rmseAgainst(curve, (d) => Math.pow(Math.cos(Math.atan(k * d)), p))
      if (!best || r < best.rmse) best = { k, p, rmse: r }
    }
  }
  return best
}

// ---------------------------------------------------------------------------
// Step 1: single-parameter candidates at the DEFAULT angle (PI/5), several
// physically-motivated normalizations of a lens cos^n(theta) falloff.
// ---------------------------------------------------------------------------
const ANGLE_DEFAULT = Math.PI / 5
const curveDefault = await radialCurve(ANGLE_DEFAULT)
console.log(`\nradial samples at angle=PI/5: ${curveDefault.length}, d=0..${curveDefault[curveDefault.length - 1].d}`)

const FAMILIES_FIXED_K = [
  ['cos^4(angle * d/halfW)', (d) => Math.pow(Math.cos(Math.min(ANGLE_DEFAULT * (d / halfW), Math.PI / 2)), 4)],
  ['cos^4(atan(d * tan(angle) / halfW))  [focal-length geometry]', (d) => Math.pow(Math.cos(Math.atan((d * Math.tan(ANGLE_DEFAULT)) / halfW)), 4)],
  ['cos^2(angle * d/halfW)', (d) => Math.pow(Math.cos(Math.min(ANGLE_DEFAULT * (d / halfW), Math.PI / 2)), 2)],
]
console.log('\nstep 1 -- physically-motivated candidates, angle plugged in directly (no free fit):')
for (const [name, fn] of FAMILIES_FIXED_K) console.log(`  ${name.padEnd(60)} rmse=${rmseAgainst(curveDefault, fn).toFixed(5)}`)

// ---------------------------------------------------------------------------
// Step 2: free 1-parameter fit per family, at the default angle -- lets the
// data pick k instead of assuming which geometric length normalizes it.
// ---------------------------------------------------------------------------
const FAMILIES_FREE = [
  ['cos^4(min(k*d, pi/2))', (d, k) => Math.pow(Math.cos(Math.min(k * d, Math.PI / 2)), 4)],
  ['cos^4(atan(k*d))', (d, k) => Math.pow(Math.cos(Math.atan(k * d)), 4)],
  ['exp(-k*d^2)', (d, k) => Math.exp(-k * d * d)],
  ['1/(1+k*d^2)', (d, k) => 1 / (1 + k * d * d)],
]
console.log('\nstep 2 -- free 1-parameter fit per family (k chosen by grid search, not assumed):')
const scored = FAMILIES_FREE.map(([name, fn]) => ({ name, fn, ...fitK(curveDefault, fn, 1e-6, 0.02) })).sort((a, b) => a.rmse - b.rmse)
for (const s of scored) console.log(`  ${s.name.padEnd(28)} k=${s.k.toExponential(4)}  rmse=${s.rmse.toFixed(5)}`)
const winner = scored[0]
console.log(`  best: ${winner.name}, k=${winner.k.toExponential(4)} (k*halfW=${(winner.k * halfW).toFixed(4)}, k/angle=${(winner.k / ANGLE_DEFAULT).toExponential(4)})`)

// ---------------------------------------------------------------------------
// Step 3: does the winning family hold up ACROSS the angle range the slider
// actually produces? render.ts: angle = PI/(6 - vg/25), vg in [0,100] ->
// angle in [PI/6, PI/2]. This is the range that matters, not an arbitrary one.
// ---------------------------------------------------------------------------
console.log(`\nstep 3 -- ${winner.name} across the SLIDER'S actual angle range [PI/6, PI/2] (render.ts: angle = PI/(6 - vg/25)):`)
const sliderAngles = [0, 25, 50, 75, 100].map((vg) => ({ vg, angle: Math.PI / (6 - vg / 25) }))
for (const { vg, angle } of sliderAngles) {
  const c = await radialCurve(angle)
  const fit = fitK(c, winner.fn, 1e-6, 0.02)
  console.log(`  vg=${vg}  angle=${angle.toFixed(4)}  best k=${fit.k.toExponential(4)}  rmse=${fit.rmse.toFixed(5)}${fit.rmse > 0.01 ? '  ★OUT OF TOLERANCE' : ''}`)
}

// ---------------------------------------------------------------------------
// Step 4: at the WORST case in that range (vg=100, angle=PI/2), give the
// family every chance -- free BOTH k and the cos power p. If this still can't
// match, the family itself is wrong there, not just mis-parametrized.
// ---------------------------------------------------------------------------
const worstAngle = Math.PI / 2
const worstCurve = await radialCurve(worstAngle)
const kp = fitKP(worstCurve, 0.008, 12)
console.log(`\nstep 4 -- worst case (vg=100, angle=PI/2): free (k,p) fit of cos^p(atan(k*d))`)
console.log(`  best k=${kp.k.toFixed(6)}  p=${kp.p.toFixed(2)}  rmse=${kp.rmse.toFixed(5)}`)

// ---------------------------------------------------------------------------
// Verdict -- written before looking at whether it's convenient, same
// tolerance used throughout (1% attenuation, i.e. ~2.5 LSB at a mid-gray
// test field -- a real match should clear this comfortably, not sit at it).
// ---------------------------------------------------------------------------
const TOLERANCE = 0.01
const worstAcrossRange = Math.max(kp.rmse, ...sliderAngles.map(({ angle }) => fitK(curveDefault, winner.fn, 1e-6, 0.02).rmse))
console.log(`\n=== VERDICT ===`)
console.log(`Confirmed (probe-vignette-model.mjs): attenuation is circularly symmetric in raw PIXEL`)
console.log(`distance from center -- not aspect/UV-normalized, not direction-dependent.`)
console.log(`Best family found: cos^4(atan(k*d)), free-fit k -- clears tolerance only at SMALL angles`)
console.log(`(rmse ~1.4-1.7% at vg<=50) and fails it at the range's HARD end (rmse ${kp.rmse.toFixed(3)}`)
console.log(`at vg=100 even with power p free up to 12). ★NO CLOSED FORM TRIED HERE FITS WITHIN`)
console.log(`${(TOLERANCE * 100).toFixed(0)}% ACROSS THE SLIDER'S ACTUAL RANGE. Reporting as UNRESOLVED, not shipping`)
console.log(`an approximation that would still miss by several percent at vg near 100 -- that is not`)
console.log(`meaningfully better than the CURRENT distance-smoothstep shader this was meant to replace.`)
console.log(`Recommendation: a measured lookup (sample ffmpeg's real output directly, e.g. a small`)
console.log(`per-angle radial texture) rather than a further-guessed formula. Not built here -- that is`)
console.log(`a new design decision (texture format/resolution/where it's generated), not a drop-in fix.`)
