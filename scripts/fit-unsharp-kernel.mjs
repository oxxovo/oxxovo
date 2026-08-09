// Fit ffmpeg's unsharp blur kernel by PREDICTION, judged by the instrument that will
// judge the shader: signal-relative error, on the real frames.
//
// ★STOPPING RULES, WRITTEN BEFORE THE FIRST RUN (제니2's condition):
//   ① If NO candidate beats the shipped shader's real-frame numbers (0.338 / 0.433),
//      the kernel is not the problem -- stop and look at another axis (scale, clamp,
//      colour space, rounding). Do not keep adding kernels.
//   ② If the best candidate wins ONLY on content the floor rule marks UNMEASURABLE,
//      the win is void. Ranking is decided on judgeable content only.
//   ③ ★MY CAP IS TWO PASSES: this one, and at most one follow-up narrowing. If the
//      field is not narrowed by then, I stop and report rather than keep fitting.
//
// ★AND THE MARGIN IS PART OF THE RESULT. A winner that is barely ahead of the runner-up
// is not a determination, it is another window -- so every candidate's number is printed
// and the gap to second place is stated.
//
// ★WHY THIS RUNS ON THE CPU. The question here is only "which kernel", so modelling the
// shader's math in Node lets many candidates be compared cheaply. That is NOT a licence
// to trust it: whatever wins gets ported to GLSL and re-verified through
// npm run test:parity:engine, which stays the judge. This file predicts; it does not
// certify.
//
//   node scripts/fit-unsharp-kernel.mjs [image ...]
import { spawn } from 'node:child_process'
import { FFMPEG } from './ffmpeg-bin.mjs'

const AMOUNT = 1.0 // sharpen=50 -> sh/50
const KR = 0.299, KG = 0.587, KB = 0.114

const run = (args) =>
  new Promise((res, rej) => {
    const p = spawn(FFMPEG, args)
    const ch = []
    let e = ''
    p.stdout.on('data', (d) => ch.push(d))
    p.stderr.on('data', (d) => (e += d))
    p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error(e.slice(-300)))))
    p.on('error', rej)
  })
const probe = async (png) => {
  const o = await run(['-v', 'error', '-i', png, '-f', 'null', '-'])
  return o
}
const size = async (png) => {
  const p = spawn(FFMPEG, ['-i', png])
  let e = ''
  p.stderr.on('data', (d) => (e += d))
  await new Promise((r) => p.on('close', r))
  const m = e.match(/, (\d+)x(\d+)/)
  return { W: Number(m[1]), H: Number(m[2]) }
}

// separable 1-D kernels, and one non-separable built from the measured table
const sep = (w) => { const s = w.reduce((a, b) => a + b, 0); return w.map((v) => v / s) }
const CANDIDATES = {
  'binomial-5 (1,4,6,4,1)  [shipped]': { sep: sep([1, 4, 6, 4, 1]) },
  'box-5 (1,1,1,1,1)': { sep: sep([1, 1, 1, 1, 1]) },
  'box-3 (1,1,1)': { sep: sep([1, 1, 1]) },
  'binomial-3 (1,2,1)': { sep: sep([1, 2, 1]) },
  'triangle-5 (1,2,3,2,1)': { sep: sep([1, 2, 3, 2, 1]) },
  // ★From scripts/probe-unsharp-kernel.mjs: 5x5, zero corners, peaked. Centre solved so
  // the weights sum to 1. Quantised readout, so this is a hypothesis, not a table.
  'measured 2-D (probe, corners 0)': {
    m2d: [
      [0, 2, 2, 2, 0],
      [2, 6, 9, 6, 2],
      [2, 9, 16, 9, 2],
      [2, 6, 9, 6, 2],
      [0, 2, 2, 2, 0],
    ],
  },
}

const signalErr = (plain, ff, pred) => {
  let num = 0, den = 0
  for (let i = 0; i < plain.length; i++) { num += Math.abs(pred[i] - ff[i]); den += Math.abs(ff[i] - plain[i]) }
  return den === 0 ? 0 : num / den
}

function predict(plain, W, H, cand) {
  // RGB -> Y (BT.601 limited), sharpen Y, back to RGB. Mirrors FRAG_UNSHARP's model.
  const N = W * H
  const Y = new Float64Array(N), U = new Float64Array(N), V = new Float64Array(N)
  for (let i = 0; i < N; i++) {
    const r = plain[i * 3] / 255, g = plain[i * 3 + 1] / 255, b = plain[i * 3 + 2] / 255
    const y = KR * r + KG * g + KB * b
    Y[i] = 16 + 219 * y
    U[i] = 128 + (224 * (b - y)) / 1.772
    V[i] = 128 + (224 * (r - y)) / 1.402
  }
  const cl = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x)
  const blur = new Float64Array(N)
  if (cand.sep) {
    const k = cand.sep, R = (k.length - 1) / 2
    const tmp = new Float64Array(N)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0
      for (let i = -R; i <= R; i++) s += k[i + R] * Y[y * W + cl(x + i, 0, W - 1)]
      tmp[y * W + x] = s
    }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0
      for (let j = -R; j <= R; j++) s += k[j + R] * tmp[cl(y + j, 0, H - 1) * W + x]
      blur[y * W + x] = s
    }
  } else {
    const m = cand.m2d, R = (m.length - 1) / 2
    let tot = 0
    for (const row of m) for (const v of row) tot += v
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let s = 0
      for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
        s += m[j + R][i + R] * Y[cl(y + j, 0, H - 1) * W + cl(x + i, 0, W - 1)]
      }
      blur[y * W + x] = s / tot
    }
  }
  const out = Buffer.alloc(N * 3)
  for (let i = 0; i < N; i++) {
    const ny = cl(Y[i] + (Y[i] - blur[i]) * AMOUNT, 0, 255)
    const y = (ny - 16) / 219, u = (U[i] - 128) / 224, v = (V[i] - 128) / 224
    const r = y + 1.402 * v, b = y + 1.772 * u, g = (y - KR * r - KB * b) / KG
    out[i * 3] = Math.round(cl(r, 0, 1) * 255)
    out[i * 3 + 1] = Math.round(cl(g, 0, 1) * 255)
    out[i * 3 + 2] = Math.round(cl(b, 0, 1) * 255)
  }
  return out
}

const imgs = process.argv.slice(2)
if (!imgs.length) { console.error('usage: node scripts/fit-unsharp-kernel.mjs <image ...>'); process.exit(2) }

console.log(`unsharp kernel fit -- amount ${AMOUNT.toFixed(4)}, judged by signal-relative error`)
console.log('★lower is better; a do-nothing prediction scores 1.000\n')
const table = {}
for (const png of imgs) {
  const { W, H } = await size(png)
  const plain = await run(['-y', '-i', png, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
  const ff = await run(['-y', '-i', png, '-vf', `unsharp=5:5:${AMOUNT.toFixed(4)}:5:5:0,format=rgb24`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
  const name = png.split(/[\\/]/).pop()
  for (const [label, cand] of Object.entries(CANDIDATES)) {
    const r = signalErr(plain, ff, predict(plain, W, H, cand))
    ;(table[label] ??= {})[name] = r
  }
}

const names = Object.keys(Object.values(table)[0])
console.log('candidate'.padEnd(36) + names.map((n) => n.slice(0, 15).padEnd(17)).join('') + 'worst')
const ranked = Object.entries(table)
  .map(([label, row]) => ({ label, row, worst: Math.max(...Object.values(row)) }))
  .sort((a, b) => a.worst - b.worst)
for (const x of ranked) {
  console.log(x.label.padEnd(36) + names.map((n) => x.row[n].toFixed(3).padEnd(17)).join('') + x.worst.toFixed(3))
}
const [first, second] = ranked
console.log(`\nwinner: ${first.label}  worst ${first.worst.toFixed(3)}`)
console.log(`runner-up: ${second.label}  worst ${second.worst.toFixed(3)}`)
const gap = second.worst - first.worst
console.log(`★gap to second place: ${gap.toFixed(3)} (${((gap / first.worst) * 100).toFixed(0)}% of the winner)`)
if (gap < 0.05) console.log('★A gap this small is NOT a determination -- it is another window. Do not port on it.')
