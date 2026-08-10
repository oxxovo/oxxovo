// ★DO NOT GUESS ffmpeg's vignette= math -- extract it the way the unsharp
// kernel was extracted (probe-unsharp-kernel.mjs): a FLAT field + a KNOWN
// input, so the output IS the function, read directly off ffmpeg's own
// binary rather than recalled from a spec.
//   node scripts/probe-vignette-model.mjs
//
// vignette=angle=<rad> (default PI/5), mode=forward (default), x0/y0=center
// (default w/2,h/2), aspect=1/1, dither=true. Flat gray in -> attenuation
// factor read straight off the output at every pixel (dither adds small
// per-pixel noise, binned out by averaging same-radius pixels over a big
// image).
import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { FFMPEG, ffmpegBanner } from './ffmpeg-bin.mjs'

const run = (args) => new Promise((res, rej) => { const p = spawn(FFMPEG, args); const ch = []; let e = ''; p.stdout.on('data', (d) => ch.push(d)); p.stderr.on('data', (d) => (e += d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c + ' ' + e.slice(-300))))); p.on('error', rej) })
const rawFromLavfi = (lavfi, W, H) => run(['-y', '-f', 'lavfi', '-i', lavfi, '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1']).then((b) => ({ buf: b, W, H }))

console.log(await ffmpegBanner())

// dither=true adds noise -- disable it so the attenuation curve reads clean.
// (dither is also a variable worth knowing about: on by default, off here on
// purpose so THIS probe isolates the falloff shape, not the dither noise.)
async function vignetteAttenuation(angle, W, H, gray = 200) {
  const flat = await rawFromLavfi(`color=c=gray@${(gray / 255).toFixed(4)}:s=${W}x${H}`, W, H)
  const vig = await rawFromLavfi(
    `color=c=gray@${(gray / 255).toFixed(4)}:s=${W}x${H},vignette=angle=${angle}:dither=0`,
    W,
    H,
  )
  return { flat: flat.buf, vig: vig.buf, W, H }
}

// Sample along the horizontal midline (y=H/2) and the diagonal, so we can
// tell whether attenuation depends on distance alone (circular) or on
// distance scaled per-axis by aspect/angle differently.
function sampleLine(data, W, H, points) {
  const out = []
  for (const [x, y] of points) {
    const xi = Math.round(x), yi = Math.round(y)
    if (xi < 0 || xi >= W || yi < 0 || yi >= H) continue
    const idx = (yi * W + xi) * 3
    out.push({ x: xi, y: yi, r: data[idx], g: data[idx + 1], b: data[idx + 2] })
  }
  return out
}

function midlinePoints(W, H, n) {
  const pts = []
  for (let i = 0; i < n; i++) pts.push([((i + 0.5) / n) * W, H / 2])
  return pts
}
function diagonalPoints(W, H, n) {
  const pts = []
  for (let i = 0; i < n; i++) pts.push([((i + 0.5) / n) * W, ((i + 0.5) / n) * H])
  return pts
}

const W = 640, H = 480
const ANGLES = { 'PI/5 (default)': Math.PI / 5, 'PI/3': Math.PI / 3, 'PI/8': Math.PI / 8 }

for (const [label, angle] of Object.entries(ANGLES)) {
  const { flat, vig } = await vignetteAttenuation(angle, W, H)
  console.log(`\n=== angle=${label} (${angle.toFixed(4)} rad) ===`)
  console.log('midline (y=H/2), x from left edge to center:')
  const mid = sampleLine(flat, W, H, midlinePoints(W, H, 12))
  const midV = sampleLine(vig, W, H, midlinePoints(W, H, 12))
  console.log('  x/W    dist_from_center(norm, x-only)   attenuation(R)   attenuation(G)   attenuation(B)')
  for (let i = 0; i < mid.length; i++) {
    const distNormX = Math.abs(mid[i].x - W / 2) / (W / 2) // normalized 0..1 along x half-width
    const attR = midV[i].r / mid[i].r
    const attG = midV[i].g / mid[i].g
    const attB = midV[i].b / mid[i].b
    console.log(`  ${(mid[i].x / W).toFixed(3)}  ${distNormX.toFixed(3)}                              ${attR.toFixed(4)}          ${attG.toFixed(4)}          ${attB.toFixed(4)}`)
  }
  console.log('diagonal (top-left to center):')
  const diag = sampleLine(flat, W, H, diagonalPoints(W, H, 8))
  const diagV = sampleLine(vig, W, H, diagonalPoints(W, H, 8))
  for (let i = 0; i < diag.length; i++) {
    const attR = diagV[i].r / diag[i].r
    console.log(`  (${diag[i].x},${diag[i].y})  attenuation(R)=${attR.toFixed(4)}`)
  }
}

// ---------------------------------------------------------------------------
// Corner vs edge-midpoint at EQUAL pixel distance from center, same angle --
// this is the test that tells circular-symmetric (distance only) apart from
// anything angle-of-approach-dependent, and also whether the metric is
// PIXEL distance or UV-normalized distance (W != H here on purpose: 640x480).
const angle = Math.PI / 5
const { flat: flatWH, vig: vigWH } = await vignetteAttenuation(angle, W, H)
const cx = W / 2, cy = H / 2
// A point straight right of center, and a point up-left of center, both at
// the SAME pixel distance R from center.
const R = 150
const pRight = [cx + R, cy]
const pDiag = [cx - R / Math.SQRT2, cy - R / Math.SQRT2]
console.log(`\n=== equal PIXEL distance R=${R}, different direction ===`)
for (const [label, [x, y]] of [['right', pRight], ['up-left(diag)', pDiag]]) {
  const xi = Math.round(x), yi = Math.round(y)
  const idxFlat = (yi * W + xi) * 3, idxVig = (yi * W + xi) * 3
  const inV = flatWH[idxFlat], outV = vigWH[idxVig]
  console.log(`  ${label}: (${xi},${yi})  attenuation=${(outV / inV).toFixed(4)}`)
}

await writeFile('C:/Users/Tom/AppData/Local/Temp/vignette_probe_done.txt', 'done')
