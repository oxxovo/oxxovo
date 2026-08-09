// Which axis, now that the kernel is exonerated.
//
// ★The fit (scripts/fit-unsharp-kernel.mjs) hit stopping condition ①: no candidate beat
// the shipped shader on real frames, and the winner TIED it at 0.433 with a gap of
// 0.000. When swapping the kernel changes the answer by nothing, the kernel is not what
// is wrong. Two axes remain cheap to test:
//
//   A. the NEGOTIATED PIXEL FORMAT. rgb24 in, rgb24 out -- if the graph picks yuv420p,
//      ffmpeg subsamples chroma and back, which the shader's full-res chroma cannot
//      reproduce. Forcing yuv444p and re-measuring says whether that is in play.
//   B. ROUNDING. ffmpeg's unsharp is integer: (sum + halfscale) >> scalebits, then
//      >> 16 on the amount, then av_clip_uint8. ★The effect's whole magnitude on this
//      content is only ~0.5-0.7%, i.e. one or two code values per pixel -- so a
//      +/-1 rounding difference is a LARGE fraction of the signal, not a rounding
//      detail. That makes B the prime suspect on magnitude grounds alone.
//
//   node scripts/probe-unsharp-axis.mjs <image ...>
import { spawn } from 'node:child_process'
import { FFMPEG } from './ffmpeg-bin.mjs'

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
const mean = (a, b) => {
  const n = Math.min(a.length, b.length)
  let s = 0
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i])
  return (s / n / 255) * 100
}
const rel = (plain, ref, other) => {
  let num = 0, den = 0
  for (let i = 0; i < plain.length; i++) { num += Math.abs(other[i] - ref[i]); den += Math.abs(ref[i] - plain[i]) }
  return den === 0 ? 0 : num / den
}

const raw = (png, vf) => run(['-y', '-i', png, ...(vf ? ['-vf', vf] : []), '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
const U = 'unsharp=5:5:1.0000:5:5:0'

for (const png of process.argv.slice(2)) {
  const name = png.split(/[\\/]/).pop()
  const plain = await raw(png)
  const asIs = await raw(png, `${U},format=rgb24`)
  const via444 = await raw(png, `format=yuv444p,${U},format=rgb24`)
  const via420 = await raw(png, `format=yuv420p,${U},format=rgb24`)
  console.log(`\n${name}`)
  console.log(`  effect magnitude (as-is)          ${mean(plain, asIs).toFixed(3)}%`)
  console.log(`  as-is vs forced yuv444p           ${mean(asIs, via444).toFixed(3)}%   (relative ${rel(plain, asIs, via444).toFixed(3)})`)
  console.log(`  as-is vs forced yuv420p           ${mean(asIs, via420).toFixed(3)}%   (relative ${rel(plain, asIs, via420).toFixed(3)})`)
  // ★A pure YUV round trip with NO unsharp: the pipeline's own floor on this content,
  // expressed in the same relative units as the parity table. Anything the shader is
  // blamed for below this number is the pipeline, not the shader.
  const rt444 = await raw(png, 'format=yuv444p,format=rgb24')
  console.log(`  ★round-trip floor (yuv444p, no unsharp) ${mean(plain, rt444).toFixed(3)}%   (relative ${rel(plain, asIs, rt444).toFixed(3)})`)
}
