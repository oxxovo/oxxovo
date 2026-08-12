#!/usr/bin/env node
// Generate lib/text-advances.ts -- per-font glyph advance widths (in em) and
// glyph coverage, for the allowlisted text fonts.
//
// ★ WHY A TABLE. The width guard has to be authoritative on the SERVER, and the
// server has no canvas: @napi-rs/canvas is a devDependency and cannot run in the
// Vercel runtime. So the width has to be computable by arithmetic. The table is
// produced HERE, at dev time, by measuring the WORKER'S OWN .ttf files with the
// WORKER'S OWN engine -- so the numbers come from the thing that actually renders.
//
// ★ IT IS AN UPPER BOUND, ON PURPOSE. Summing per-character advances ignores
// kerning, and kerning in these fonts only ever pulls glyphs CLOSER. Measured
// 2026-07-31 across the three fonts: sum(advances) - measureText(string) is never
// negative; it is <=1.8% on realistic caption strings and <=6.1% on deliberately
// kern-heavy Latin ("AV Wa To LY"). So the table can over-estimate a line's width
// by a few percent but can never under-estimate it -- the guard therefore never
// lets through something that would clip. The editor uses this same function, so
// the percentage a participant sees is the percentage the server enforces.
//
// ★ COVERAGE. Black Han Sans covers 2,581 of the 11,172 Hangul syllables (23.1%);
// the other 8,591 draw NOTHING -- not a fallback box, no ink at all (verified by
// rasterising every syllable). A caption using one would render as a blank gap in
// the final video, silently. So coverage ships alongside the advances.
//
// Run: npm run gen:text-advances     (commit the output)

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { resolveWorkerRepo } from './worker-repo.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORKER_REPO = resolveWorkerRepo(ROOT)
const OUT = join(ROOT, 'lib', 'text-advances.ts')

const OT = await import(pathToFileURL(join(WORKER_REPO, 'src', 'text-render.ts')).href)
for (const f of OT.FONT_SPECS) GlobalFonts.registerFromPath(join(WORKER_REPO, 'assets', 'fonts', f.file), f.family)

// Measured at 1000px and stored in em, so the table is resolution independent and
// the runtime multiplies by the layer's font px.
const EM = 1000
const ASCII_LO = 0x20, ASCII_HI = 0x7e
const HANGUL_LO = 0xac00, HANGUL_HI = 0xd7a3
// Rasterisation box for the ink test: 100px glyph in a 160x160 canvas leaves room
// for any overshoot, and alpha>16 ignores stray anti-aliasing.
const INK_PX = 100, INK_BOX = 160, INK_ALPHA = 16

// ★ Round UP, never to-nearest. Storing 5 decimals of an em loses up to 1e-5 em
// per glyph, and rounding to nearest lets that loss go DOWNWARD -- a 26-glyph
// Latin line then measured 0.06px narrower than it renders. Tiny, but it breaks
// the one property the guard depends on (the table never under-estimates), and a
// property that holds "except by 0.06px" is not a property. Ceiling costs at most
// 1e-5 em per glyph in the other, safe direction.
const round = (n) => Math.ceil(n * 1e5) / 1e5

// The Hangul block, encoded once for both advance AND coverage: one byte per
// syllable indexing a palette, where index 0 means "this font draws nothing for
// it". Base64 of 11,172 bytes is ~15 KB, and it is EXACT.
//
// Why not something smaller: a single max-advance per font collapses to nothing
// for Pretendard and Noto Serif KR (they have ONE advance for all 11,172), but
// Black Han Sans's covered advances span 1.28x, so a single bound would
// over-estimate ordinary Korean by up to 28% and reject captions that fit. RLE
// runs cost 40 KB because its covered set is scattered. The palette is the
// smallest encoding that stays exact.
function packHangul(advances, covered) {
  const palette = [0]
  const index = new Map()
  const bytes = new Uint8Array(advances.length)
  for (let i = 0; i < advances.length; i++) {
    if (!covered[i]) continue
    const a = advances[i]
    let k = index.get(a)
    if (k === undefined) { k = palette.length; palette.push(a); index.set(a, k) }
    if (k > 255) throw new Error('palette overflow: more than 255 distinct advances')
    bytes[i] = k
  }
  return { palette, data: Buffer.from(bytes).toString('base64') }
}

const measure = createCanvas(10, 10).getContext('2d')
const inkCv = createCanvas(INK_BOX, INK_BOX)
const inkCtx = inkCv.getContext('2d')

function hasInk(family, ch) {
  inkCtx.clearRect(0, 0, INK_BOX, INK_BOX)
  inkCtx.font = `${INK_PX}px "${family}"`
  inkCtx.textBaseline = 'alphabetic'
  inkCtx.fillStyle = '#ffffff'
  inkCtx.fillText(ch, 15, 120)
  const d = inkCtx.getImageData(0, 0, INK_BOX, INK_BOX).data
  for (let i = 3; i < d.length; i += 4) if (d[i] > INK_ALPHA) return true
  return false
}

const out = { _generated: 'scripts/gen-text-advances.mjs', _unit: 'em (advance / font px)', fonts: {} }

for (const f of OT.FONT_SPECS) {
  measure.font = `${EM}px "${f.family}"`
  const adv = (ch) => round(measure.measureText(ch).width / EM)

  const ascii = []
  for (let cp = ASCII_LO; cp <= ASCII_HI; cp++) ascii.push(adv(String.fromCodePoint(cp)))

  const hangul = []
  const cov = []
  for (let cp = HANGUL_LO; cp <= HANGUL_HI; cp++) {
    const ch = String.fromCodePoint(cp)
    hangul.push(adv(ch))
    cov.push(hasInk(f.family, ch) ? 1 : 0)
  }

  // Anything outside those two blocks (Jamo, CJK punctuation, emoji, Latin
  // accents...) falls back to this. It is the widest advance the font produces
  // over the sampled space, so the fallback also over-estimates rather than under.
  const otherMax = Math.max(...ascii, ...hangul)

  const covered = cov.reduce((a, b) => a + b, 0)
  const coveredAdv = hangul.filter((_, i) => cov[i])
  const distinct = new Set(coveredAdv).size

  // Fast path: full coverage AND one advance for the entire block (Pretendard,
  // Noto Serif KR). Storing 11,172 identical bytes would be absurd.
  const hangulEntry = covered === cov.length && distinct === 1
    ? { uniform: coveredAdv[0] }
    : packHangul(hangul, cov)

  out.fonts[f.id] = {
    file: f.file,
    ascii,                                  // U+0020..U+007E, in order
    asciiLo: ASCII_LO,
    hangulLo: HANGUL_LO,
    hangulHi: HANGUL_HI,
    hangul: hangulEntry,
    otherMax,
    coveredHangul: covered,
    totalHangul: cov.length,
  }
}

// Emitted as a .ts module rather than .json: a bare JSON import needs an
// `with { type: 'json' }` attribute under Node's ESM loader but must not carry one
// through the Next bundler, and this table is imported by both. A .ts module is
// unambiguous in every consumer.
writeFileSync(OUT, [
  '// GENERATED by scripts/gen-text-advances.mjs -- do not edit by hand.',
  '// Regenerate with `npm run gen:text-advances` after any font change, then run',
  '// `npm run test:text-advances` to re-verify it against the real font engine.',
  '',
  'export const TEXT_ADVANCES = ' + JSON.stringify(out),
  '',
].join('\n'))

console.log(`WORKER : ${WORKER_REPO}`)
console.log(`wrote  : ${OUT}`)
for (const [id, t] of Object.entries(out.fonts)) {
  console.log(`  ${id.padEnd(16)} hangul=${t.hangul.uniform ? "uniform " + t.hangul.uniform : "palette " + t.hangul.palette.length} covered=${t.coveredHangul}/${t.totalHangul} otherMax=${t.otherMax}`)
}
console.log(`size   : ${(JSON.stringify(out).length / 1024).toFixed(1)} KB`)
