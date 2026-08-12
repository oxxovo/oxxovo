// How the eq model in lib/gl-effects.ts was DERIVED -- kept so it can be re-derived
// (e.g. after an ffmpeg upgrade) instead of trusted. Scores candidate colour
// matrices / ranges against a measured 24-patch chart; nothing is assumed.
//   node scripts/eq-model-probe.mjs
// Result 2026-07-30 (ffmpeg N-124279): graph negotiates yuv444p, conversion is
// BT.601 LIMITED (identity round trip reproduced byte-exact, 0/0), brightness and
// contrast act on Y only, saturation on U/V only.
import { spawn } from 'node:child_process'
import { FFMPEG } from './ffmpeg-bin.mjs'
import { writeFileSync } from 'node:fs'
const TMP = process.env.TEMP
const run = (args) => new Promise((res, rej) => { const p = spawn(FFMPEG, args); const ch = []; let e = ''; p.stdout.on('data', (d) => ch.push(d)); p.stderr.on('data', (d) => (e += d)); p.on('close', (c) => (c === 0 ? res({ out: Buffer.concat(ch), err: e }) : rej(new Error('ff ' + c + ' ' + e.slice(-500))))); p.on('error', rej) })

// 1 px per patch, 64 patches wide x 1 -> exact addressing, no interpolation.
const PATCHES = [
  [255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255],
  [255, 128, 0], [128, 255, 0], [0, 128, 255], [200, 60, 90], [60, 200, 90], [90, 60, 200],
  [180, 170, 160], [40, 60, 80], [230, 220, 200], [128, 128, 128], [64, 32, 16], [16, 32, 64],
  [255, 255, 255], [0, 0, 0], [200, 200, 100], [100, 200, 200], [200, 100, 200], [150, 90, 30],
]
const W = PATCHES.length
// Build a raw RGB image and let ffmpeg wrap it, so the source bytes are exact.
const rawIn = Buffer.alloc(W * 3)
PATCHES.forEach((c, i) => { rawIn[i * 3] = c[0]; rawIn[i * 3 + 1] = c[1]; rawIn[i * 3 + 2] = c[2] })
writeFileSync(`${TMP}/eq_in.raw`, rawIn)

const readOut = async (vf) => {
  const { out } = await run(['-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x1`, '-i', `${TMP}/eq_in.raw`,
    '-vf', vf, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'])
  return Array.from({ length: W }, (_, i) => [out[i * 3], out[i * 3 + 1], out[i * 3 + 2]])
}

// ---- candidate models ---------------------------------------------------------
// Matrices: Kr/Kb pairs. 601: .299/.114  709: .2126/.0722
const MATS = { bt601: [0.299, 0.114], bt709: [0.2126, 0.0722] }
const clip8 = (v) => Math.max(0, Math.min(255, Math.round(v)))

function rgb2yuv(rgb, [kr, kb], limited) {
  const kg = 1 - kr - kb
  const [r, g, b] = rgb.map((v) => v / 255)
  const y = kr * r + kg * g + kb * b
  const u = (b - y) / (2 * (1 - kb))
  const v = (r - y) / (2 * (1 - kr))
  return limited
    ? [16 + y * 219, 128 + u * 224, 128 + v * 224]
    : [y * 255, 128 + u * 255, 128 + v * 255]
}
function yuv2rgb([Y, U, V], [kr, kb], limited) {
  const kg = 1 - kr - kb
  const y = limited ? (Y - 16) / 219 : Y / 255
  const u = limited ? (U - 128) / 224 : (U - 128) / 255
  const v = limited ? (V - 128) / 224 : (V - 128) / 255
  const r = y + 2 * (1 - kr) * v
  const b = y + 2 * (1 - kb) * u
  const g = (y - kr * r - kb * b) / kg
  return [r, g, b].map((x) => clip8(x * 255))
}
// vf_eq: luma LUT v = contrast*(v-0.5)+0.5+brightness on the STORED byte /255,
// chroma scaled about 128 by saturation. `round` = quantise YUV to bytes first.
function model(rgb, { mat, limited, contrast = 1, brightness = 0, saturation = 1, round = true }) {
  const m = MATS[mat]
  let [Y, U, V] = rgb2yuv(rgb, m, limited)
  if (round) { Y = clip8(Y); U = clip8(U); V = clip8(V) }
  let y = contrast * (Y / 255 - 0.5) + 0.5 + brightness
  Y = clip8(y * 255)
  U = clip8((U - 128) * saturation + 128)
  V = clip8((V - 128) * saturation + 128)
  return yuv2rgb([Y, U, V], m, limited)
}
const score = (meas, pred) => {
  let s = 0, mx = 0
  for (let i = 0; i < meas.length; i++) for (let c = 0; c < 3; c++) {
    const d = Math.abs(meas[i][c] - pred[i][c]); s += d; if (d > mx) mx = d
  }
  return { mean: +(s / (meas.length * 3)).toFixed(2), max: mx }
}

// ---- run ---------------------------------------------------------------------
const CASES = [
  ['identity   ', 'eq=brightness=0', {}],
  ['sat 0.8    ', 'eq=saturation=0.8000', { saturation: 0.8 }],
  ['contrast1.3', 'eq=contrast=1.3000', { contrast: 1.3 }],
  ['bright .05 ', 'eq=brightness=0.0500', { brightness: 0.05 }],
  ['all three  ', 'eq=brightness=0.0500:contrast=1.3000:saturation=0.8000', { brightness: 0.05, contrast: 1.3, saturation: 0.8 }],
]
// Which pixel format does the graph actually negotiate for eq?
const { err } = await run(['-v', 'verbose', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x1`, '-i', `${TMP}/eq_in.raw`,
  '-vf', 'eq=contrast=1.3,format=rgb24', '-f', 'null', '-'])
const fmt = [...err.matchAll(/eq.*?fmt:(\w+)/g)].map((m) => m[1])
const graph = err.split('\n').filter((l) => /Parsed_eq|auto_scale|format=/.test(l) && /fmt:/.test(l)).slice(0, 6)
console.log('--- negotiated formats around eq ---')
graph.forEach((l) => console.log('  ' + l.trim().slice(0, 150)))
console.log('  eq fmt tokens:', fmt.join(', ') || '(none captured)')

console.log('\n--- candidate scoring (mean/max abs RGB error over 24 patches) ---')
console.log('case         ' + ['bt601 limited', 'bt601 full', 'bt709 limited', 'bt709 full'].map((s) => s.padEnd(16)).join(''))
for (const [name, vf, params] of CASES) {
  const meas = await readOut(vf + ',format=rgb24')
  const row = []
  for (const mat of ['bt601', 'bt709']) for (const limited of [true, false]) {
    const pred = PATCHES.map((p) => model(p, { mat, limited, ...params }))
    const s = score(meas, pred)
    row.push(`${s.mean}/${s.max}`.padEnd(16))
  }
  // column order above is 601L, 601F, 709L, 709F -> reorder to match header
  console.log(name + ' ' + [row[0], row[1], row[2], row[3]].join(''))
}

// The winning model's residual vs the identity floor tells us how much is
// irreducible 8-bit round-trip noise.
const measId = await readOut('eq=brightness=0,format=rgb24')
console.log('\nidentity: input vs output (the floor):', JSON.stringify(score(PATCHES.map((p) => p), measId)))
console.log('sample  in(255,0,0) -> measured', (await readOut('eq=saturation=0.8000,format=rgb24'))[0].join(','))
for (const mat of ['bt601', 'bt709']) for (const limited of [true, false]) {
  console.log(`  model ${mat} ${limited ? 'limited' : 'full   '} ->`, model([255, 0, 0], { mat, limited, saturation: 0.8 }).join(','))
}
