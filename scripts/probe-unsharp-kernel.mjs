// Read ffmpeg's unsharp blur kernel OUT of ffmpeg, instead of recalling vf_unsharp.c.
//
// ★WHY MEASURE IT. The shader was written from a reading of the source: cascaded 2-tap
// sums, 2*steps per axis, therefore the width-5 binomial (1,4,6,4,1)/16 with /256 total.
// The signal-relative error then came out at 0.21-0.26 on synthetic content and
// 0.34-0.43 on real frames -- wrong in a way that GROWS WITH DETAIL, which is what a
// wrong kernel width/scale looks like. So the reading is the suspect, and recalling
// harder is not a method.
//
// ★HOW. unsharp computes out = in + (in - blur) * amount on the luma plane. Feed a flat
// gray field with ONE brighter pixel and the blur becomes the kernel itself:
//     background pixel at offset (i,j): out = 128 - 100 * w[i][j]
//     so w[i][j] = (128 - out) / 100
// A flat field keeps every value in range (no clipping to confuse the readout), and gray
// (single-plane Y) removes chroma from the question entirely.
//
//   node scripts/probe-unsharp-kernel.mjs
import { spawn } from 'node:child_process'
import { FFMPEG } from './ffmpeg-bin.mjs'

const N = 15
const C = (N - 1) / 2
const BG = 128
const IMP = 228

const run = (args) =>
  new Promise((res, rej) => {
    const p = spawn(FFMPEG, args)
    const ch = []
    let e = ''
    p.stdout.on('data', (d) => ch.push(d))
    p.stderr.on('data', (d) => (e += d))
    p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error(e.slice(-400)))))
    p.on('error', rej)
  })

// A gray field with a single brighter pixel at the centre, amount = 1.0 so the readout
// is the kernel with no scaling to undo.
const src = `color=c=gray:s=${N}x${N},format=gray,geq=lum='if(lt(abs(X-${C})+abs(Y-${C}),0.5),${IMP},${BG})'`
const plain = await run(['-y', '-f', 'lavfi', '-i', src, '-frames:v', '1', '-pix_fmt', 'gray', '-f', 'rawvideo', 'pipe:1'])
const out = await run(['-y', '-f', 'lavfi', '-i', src, '-vf', 'unsharp=5:5:1.0000:5:5:0', '-frames:v', '1', '-pix_fmt', 'gray', '-f', 'rawvideo', 'pipe:1'])

const at = (buf, x, y) => buf[y * N + x]
console.log(`impulse ${IMP} on ${BG}, ${N}x${N} gray, unsharp=5:5:1.0000:5:5:0`)
console.log(`centre plain=${at(plain, C, C)}  out=${at(out, C, C)}`)

// w = (BG - out) / (IMP - BG) for background pixels around the impulse.
console.log('\nmeasured kernel w[i][j] * 100 (rows j = -3..3, cols i = -3..3):')
const rows = []
for (let j = -3; j <= 3; j++) {
  const cells = []
  for (let i = -3; i <= 3; i++) {
    if (i === 0 && j === 0) { cells.push('  CTR'); continue }
    const o = at(out, C + i, C + j)
    cells.push((((BG - o) / (IMP - BG)) * 100).toFixed(1).padStart(5))
  }
  rows.push(cells.join(' '))
}
for (const r of rows) console.log('  ' + r)

// The two candidate readings, for comparison.
const norm = (k) => { const s = k.reduce((a, b) => a + b, 0); return k.map((v) => v / s) }
const BINOM5 = norm([1, 4, 6, 4, 1])
const BINOM3 = norm([1, 2, 1])
const BOX5 = norm([1, 1, 1, 1, 1])
console.log('\ncandidate 1-D weights x100 (separable, so w[i][j] = wx[i]*wy[j]):')
console.log('  binomial-5 (1,4,6,4,1)/16 :', BINOM5.map((v) => (v * 100).toFixed(1)).join(' '))
console.log('  binomial-3 (1,2,1)/4      :', BINOM3.map((v) => (v * 100).toFixed(1)).join(' '))
console.log('  box-5      (1,1,1,1,1)/5  :', BOX5.map((v) => (v * 100).toFixed(1)).join(' '))
console.log('\n★Compare the measured centre row against these. The 2-D value at (i,0) is')
console.log(' wx[i]*wy[0], so the ROW through the centre is wx[i] scaled by wy[0].')
