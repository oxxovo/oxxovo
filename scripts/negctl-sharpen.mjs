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

console.log('effect magnitude = how far unsharp=5:5:1:5:5:0 moves the image at all')
console.log('(compare with the sharpen row of npm run test:parity:engine)\n')
for (const c of ['smooth', 'mandel', 'bars', 'testsrc']) {
  const png = `${TMPDIR}/parity_${c}.png`
  try {
    const plain = await run(['-y', '-i', png, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
    const sharp = await run(['-y', '-i', png, '-vf', 'unsharp=5:5:1.0000:5:5:0,format=rgb24', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
    console.log(`  ${c.padEnd(8)} ${diff(plain, sharp).toFixed(2)}%`)
  } catch (e) {
    console.log(`  ${c.padEnd(8)} SKIP (${png} not present -- run the parity harness first)`)
  }
}
