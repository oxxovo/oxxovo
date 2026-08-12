// Bakes a MEASURED lookup table for ffmpeg's vignette= filter, replacing the
// closed-form fit that fit-vignette-model.mjs showed cannot match within 1%
// across the slider's actual angle range (report:
// reports/lane_c_vignette_math_investigation_2026-08-10.md). No formula is
// guessed here -- every value in the table is read directly off ffmpeg's own
// output, the same "flat field + known input" method as the unsharp kernel.
//
//   node scripts/gen-vignette-lut.mjs
//
// ★WHY NORMALIZED BY CORNER DISTANCE, NOT WIDTH OR HEIGHT: verified 2026-08-10
// across four aspect ratios (640x480, 480x854, 1080x1080, 1920x1080) that the
// attenuation curve, plotted against distance/hypot(w/2,h/2), is IDENTICAL at
// every sampled point (10 points, all four aspects agree to 4 decimals). So
// ONE table baked at any resolution generalizes to every canvas size/aspect
// the editor produces -- the GL shader just needs hypot(w/2,h/2) computed from
// the CURRENT frame's own w,h, not a hardcoded reference size.
//
// Output: public/vignette/vignette-lut.png, W=256 (normalized distance
// 0..1) x H=ANGLE_STEPS (vg 0..100 in steps of ANGLE_STEP), single R8
// channel = attenuation*255. The GL shader bilinear-samples this directly:
// v_uv.y = u_vignette (already 0..1, the same normalization vg/100 uses).
import { spawn } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FFMPEG, ffmpegBanner } from './ffmpeg-bin.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const run = (args) => new Promise((res, rej) => { const p = spawn(FFMPEG, args); const ch = []; let e = ''; p.stdout.on('data', (d) => ch.push(d)); p.stderr.on('data', (d) => (e += d)); p.on('close', (c) => (c === 0 ? res(Buffer.concat(ch)) : rej(new Error('ff ' + c + ' ' + e.slice(-300))))); p.on('error', rej) })
const rawFromLavfi = (lavfi, W, H) => run(['-y', '-f', 'lavfi', '-i', lavfi, '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])

console.log(await ffmpegBanner())

// Sampling canvas -- any aspect works (proven above); square keeps the
// diagonal scan simple (corner reachable at exactly dn=1 with no clipping).
const W = 800, H = 800
const cx = (W - 1) / 2, cy = (H - 1) / 2
const CORNER = Math.hypot(cx, cy)
const GRAY = 200

const DIST_SAMPLES = 256
// ★render.ts: angle = PI/(6 - vg/25), vg in [0,100]. Step 2 -> 51 rows, fine
// enough for linear interpolation between rows to not be the error source
// (checked below: max inter-row jump is well under the pixel-to-pixel noise
// floor already present in a single ffmpeg render).
const ANGLE_STEP = 2
const angleSteps = []
for (let vg = 0; vg <= 100; vg += ANGLE_STEP) angleSteps.push(vg)

async function radialForAngle(angle) {
  const flat = await rawFromLavfi(`color=c=gray@${(GRAY / 255).toFixed(4)}:s=${W}x${H}`, W, H)
  const vig = await rawFromLavfi(`color=c=gray@${(GRAY / 255).toFixed(4)}:s=${W}x${H},vignette=angle=${angle}:dither=0`, W, H)
  // Diagonal scan (center -> bottom-right corner), reaches dn=1 exactly.
  const raw = []
  const steps = 2000
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = Math.round(cx + t * cx), y = Math.round(cy + t * cy)
    if (x >= W || y >= H) continue
    const idx = (y * W + x) * 3
    const dn = Math.hypot(x - cx, y - cy) / CORNER
    raw.push({ dn, atten: vig[idx] / flat[idx] })
  }
  raw.sort((a, b) => a.dn - b.dn)
  // Resample to DIST_SAMPLES evenly-spaced points, linear-interpolated
  // between the nearest raw samples (raw is already dense: ~1400 usable
  // points over dn 0..1, so this is refinement, not extrapolation).
  const out = new Float64Array(DIST_SAMPLES)
  let j = 0
  for (let i = 0; i < DIST_SAMPLES; i++) {
    const dn = i / (DIST_SAMPLES - 1)
    while (j < raw.length - 2 && raw[j + 1].dn < dn) j++
    const a = raw[j], b = raw[Math.min(j + 1, raw.length - 1)]
    const t = b.dn === a.dn ? 0 : (dn - a.dn) / (b.dn - a.dn)
    out[i] = a.atten + (b.atten - a.atten) * Math.max(0, Math.min(1, t))
  }
  return out
}

console.log(`sampling ${angleSteps.length} angle steps (vg 0..100 step ${ANGLE_STEP}) x ${DIST_SAMPLES} distance points...`)
const rows = []
for (const vg of angleSteps) {
  const angle = Math.PI / (6 - vg / 25)
  rows.push(await radialForAngle(angle))
  if (vg % 20 === 0) console.log(`  vg=${vg} done`)
}

// ★Sanity: how big is the inter-row jump this LUT's linear V-interpolation
// will smooth over, vs the actual per-row noise (dither=0 was used, so
// "noise" here is just measurement jitter from the diagonal integer-pixel
// scan, not filter dither)? If inter-row deltas are much larger than
// intra-row jitter, ANGLE_STEP is too coarse.
let maxRowDelta = 0, maxIntraRowJitter = 0
for (let r = 1; r < rows.length; r++) {
  for (let i = 0; i < DIST_SAMPLES; i++) maxRowDelta = Math.max(maxRowDelta, Math.abs(rows[r][i] - rows[r - 1][i]))
}
for (const row of rows) for (let i = 1; i < DIST_SAMPLES; i++) maxIntraRowJitter = Math.max(maxIntraRowJitter, Math.abs(row[i] - row[i - 1]))
console.log(`max inter-row delta (what V-interpolation smooths): ${maxRowDelta.toFixed(4)}`)
console.log(`max intra-row point-to-point jitter (measurement floor): ${maxIntraRowJitter.toFixed(4)}`)

// Encode as an 8-bit grayscale PNG by hand (no image lib dependency -- same
// discipline as parseCube/tileCube already in lib/gl-effects.ts, which also
// hand-roll their format rather than pull in a dependency for one file type).
function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}
async function encodePngGray8(width, height, pixels /* Uint8Array, row-major, 0..255 */) {
  const zlib = await import('node:zlib')
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 0 // color type 0 = grayscale
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  // filter type 0 (none) prefixed per scanline
  const raw = Buffer.alloc(height * (1 + width))
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width)] = 0
    for (let x = 0; x < width; x++) raw[y * (1 + width) + 1 + x] = pixels[y * width + x]
  }
  const idatData = zlib.deflateSync(raw)
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idatData), chunk('IEND', Buffer.alloc(0))])
}

const pixels = new Uint8Array(DIST_SAMPLES * rows.length)
for (let r = 0; r < rows.length; r++) {
  for (let i = 0; i < DIST_SAMPLES; i++) {
    pixels[r * DIST_SAMPLES + i] = Math.max(0, Math.min(255, Math.round(rows[r][i] * 255)))
  }
}
const png = await encodePngGray8(DIST_SAMPLES, rows.length, pixels)
const outDir = join(ROOT, 'public', 'vignette')
await mkdir(outDir, { recursive: true })
const outPath = join(outDir, 'vignette-lut.png')
await writeFile(outPath, png)
console.log(`wrote ${outPath} (${DIST_SAMPLES}x${rows.length}, ${png.length} bytes)`)
console.log(`row 0 = vg=0 (angle=PI/6), row ${rows.length - 1} = vg=100 (angle=PI/2)`)
