// One-off negative control for the ④-G sharpen parity row. Not wired into any npm
// script -- run it by hand when the row's number needs its meaning checked.
//
// ★WHY. "sharpen worst 0.18%" is only good news if the effect changes the image by a
// lot more than 0.18% in the first place. If unsharp were a near no-op on this content,
// a shader that did NOTHING would also score ~0% and the row would be a vacuous pass --
// the same shape as the harness that compared hand-written copies of its own filters.
//
//   node scripts/negctl-sharpen.mjs
import { spawn } from 'node:child_process'
import { FFMPEG } from './ffmpeg-bin.mjs'

const run = (a) =>
  new Promise((res, rej) => {
    const p = spawn(FFMPEG, a)
    const ch = []
    let e = ''
    p.stdout.on('data', (d) => ch.push(d))
    p.stderr.on('data', (d) => (e += d))
    p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error(e.slice(-200)))))
    p.on('error', rej)
  })
const diff = (a, b) => {
  const n = Math.min(a.length, b.length)
  let s = 0
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i])
  return (s / n / 255) * 100
}
const TMPDIR = (process.env.TEMP || '/tmp').split(String.fromCharCode(92)).join('/')

// ★Two amounts, because the threshold has to be DERIVED and the derivation needs to
// know whether the effect can be made large enough to measure at all. The measurement
// floor is ~1 LSB (~0.39% of 255) -- the colour work established that ffmpeg's own
// identity RGB->YUV->RGB round trip is lossy by that much -- so an effect whose whole
// magnitude sits near the floor cannot be judged on that content by ANY threshold.
console.log('effect magnitude = how far unsharp moves the image at all')
console.log('floor = ~0.39% (1 LSB); a magnitude at or under the floor is unmeasurable\n')
console.log('content   sharpen=50 (amt 1.0)   sharpen=100 (amt 2.0)')
for (const c of ['smooth', 'mandel', 'bars', 'testsrc']) {
  const png = `${TMPDIR}/parity_${c}.png`
  try {
    const plain = await run(['-y', '-i', png, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
    const cols = []
    for (const amt of ['1.0000', '2.0000']) {
      const sharp = await run(['-y', '-i', png, '-vf', `unsharp=5:5:${amt}:5:5:0,format=rgb24`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
      cols.push(`${diff(plain, sharp).toFixed(2)}%`)
    }
    console.log(`  ${c.padEnd(8)} ${cols[0].padEnd(21)} ${cols[1]}`)
  } catch (e) {
    console.log(`  ${c.padEnd(8)} SKIP (${png} not present -- run the parity harness first)`)
  }
}
