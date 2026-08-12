// Pure tests for the text geometry guard. No canvas, no worker repo -- these run
// in CI, where only this repo is checked out.
//
// The LIVE cross-check (table vs the worker's actual font engine) is
// scripts/text-advances-verify.mjs; it needs the worker worktree and the .ttf
// files, so it cannot run here. Run it after regenerating the table.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FONT_SPECS, LINE_HEIGHT, type TextLayer } from './text-render'
import {
  lineWidthEm, undrawableChars, textBlockMetrics, maxFittingSizePct,
  fontsThatWouldFit, fontCoverage,
} from './text-metrics'
import { TEXT_CANVAS, TEXT_LIMITS, validateTexts, validateTextLayer } from './text-limits'

const [W9, H9] = TEXT_CANVAS['9:16']
const [W16, H16] = TEXT_CANVAS['16:9']

const layer = (over: Partial<TextLayer> = {}): TextLayer => ({
  content: '지금 만나보세요', font: 'pretendard', sizePct: 8, color: '#ffffff',
  align: 'center', xNorm: 0.5, yNorm: 0.4, startMs: 0, endMs: 1000, ...over,
})

// ---- the table itself ------------------------------------------------------

test('every allowlisted font has an advance table', () => {
  for (const f of FONT_SPECS) {
    assert.ok(lineWidthEm(f.id, 'A') > 0, `${f.id} has no ASCII advance`)
    assert.ok(lineWidthEm(f.id, '가') > 0, `${f.id} has no Hangul advance`)
  }
})

// GOLDEN. Measured 2026-07-31 from the worker's own .ttf via @napi-rs/canvas
// (scripts/gen-text-advances.mjs). A drift here means the table was regenerated
// against different font binaries -- which is exactly when someone must look.
test('GOLDEN: per-font advances match the fonts the worker ships', () => {
  assert.equal(lineWidthEm('pretendard', '가'), 0.86427)
  assert.equal(lineWidthEm('noto-serif-kr', '가'), 0.966)
  // Black Han Sans is the only font whose Hangul advances are not uniform.
  assert.ok(Math.abs(lineWidthEm('black-han-sans', '가') - 0.835) < 0.002)
})

test('GOLDEN: Black Han Sans covers 2581 of 11172 Hangul syllables', () => {
  assert.deepEqual(fontCoverage('black-han-sans'), { covered: 2581, total: 11172 })
  assert.deepEqual(fontCoverage('pretendard'), { covered: 11172, total: 11172 })
  assert.deepEqual(fontCoverage('noto-serif-kr'), { covered: 11172, total: 11172 })
})

test('undrawable syllables are reported for Black Han Sans and only for it', () => {
  // 쀓 / 핧 draw NO ink in Black Han Sans (rasterised 2026-07-31); the other two
  // fonts render them normally.
  assert.deepEqual(undrawableChars('black-han-sans', '쀓'), ['쀓'])
  assert.deepEqual(undrawableChars('black-han-sans', '가나다'), [])
  assert.deepEqual(undrawableChars('pretendard', '쀓핧'), [])
  assert.deepEqual(undrawableChars('noto-serif-kr', '쀓핧'), [])
})

test('a line is measured as the sum of its glyphs, so it grows with length', () => {
  const a = lineWidthEm('pretendard', '가')
  assert.ok(Math.abs(lineWidthEm('pretendard', '가나다') - a * 3) < 1e-9)
})

// ---- geometry --------------------------------------------------------------

test('width/height fractions are scale invariant (only the ratio matters)', () => {
  const l = layer()
  const small = textBlockMetrics(l, 720, 1280)
  const big = textBlockMetrics(l, 1080, 1920)
  assert.ok(Math.abs(small.widthFrac - big.widthFrac) < 1e-9)
  assert.ok(Math.abs(small.heightFrac - big.heightFrac) < 1e-9)
})

test('block height follows the renderer: fontPx * (LINE_HEIGHT*(n-1) + 1)', () => {
  const l = layer({ content: 'a\nb\nc\nd', sizePct: 10, yNorm: 0 })
  const m = textBlockMetrics(l, W9, H9)
  assert.equal(m.lines, 4)
  assert.ok(Math.abs(m.heightFrac - 0.10 * (LINE_HEIGHT * 3 + 1)) < 1e-9)
})

test('the widest line drives the width, not the last one', () => {
  const m = textBlockMetrics(layer({ content: '가\n가나다라마' }), W9, H9)
  assert.equal(m.widestLine, 1)
})

// ---- the measured failures that motivated the guard ------------------------

test('REGRESSION: 7-syllable Korean title at 12% overflows 9:16 width', () => {
  const m = textBlockMetrics(layer({ content: '순간의 아름다움', font: 'black-han-sans', sizePct: 12 }), W9, H9)
  assert.ok(m.widthFrac > 1, `expected overflow, got ${(m.widthFrac * 100).toFixed(0)}%`)
  assert.equal(validateTextLayer(layer({ content: '순간의 아름다움', font: 'black-han-sans', sizePct: 12 }), 5000, TEXT_CANVAS['9:16']), 'text_too_wide')
})

test('REGRESSION: the same title fits once it is split across two lines', () => {
  const l = layer({ content: '순간의\n아름다움', font: 'black-han-sans', sizePct: 12, yNorm: 0.1 })
  assert.ok(textBlockMetrics(l, W9, H9).widthFrac <= 1)
  assert.equal(validateTextLayer(l, 5000, TEXT_CANVAS['9:16']), null)
})

test('REGRESSION: 4 lines at 12% from yNorm=0.55 falls off the bottom', () => {
  const l = layer({ content: '첫째 줄\n둘째 줄\n셋째 줄\n넷째 줄', sizePct: 12, yNorm: 0.55 })
  assert.ok(textBlockMetrics(l, W9, H9).bottomFrac > 1)
  assert.equal(validateTextLayer(l, 5000, TEXT_CANVAS['9:16']), 'text_too_tall')
})

test('the same 4 lines fit from the top of the frame', () => {
  const l = layer({ content: '첫째 줄\n둘째 줄\n셋째 줄\n넷째 줄', sizePct: 12, yNorm: 0.02 })
  assert.equal(validateTextLayer(l, 5000, TEXT_CANVAS['9:16']), null)
})

test('16:9 has room where 9:16 does not', () => {
  const l = layer({ content: '순간의 아름다움', font: 'black-han-sans', sizePct: 12 })
  assert.equal(validateTextLayer(l, 5000, TEXT_CANVAS['9:16']), 'text_too_wide')
  assert.equal(validateTextLayer(l, 5000, TEXT_CANVAS['16:9']), null)
})

// ---- the size cap ----------------------------------------------------------

test('maxFittingSizePct: at the cap it fits, one step above it does not', () => {
  const base = layer({ content: '순간의 아름다움', font: 'black-han-sans', yNorm: 0.1 })
  const cap = maxFittingSizePct(base, W9, H9, TEXT_LIMITS.MIN_SIZE_PCT, TEXT_LIMITS.MAX_SIZE_PCT)
  assert.ok(cap !== null)
  assert.equal(validateTextLayer({ ...base, sizePct: cap as number }, 5000, TEXT_CANVAS['9:16']), null)
  const over = Math.round(((cap as number) + 0.5) * 10) / 10
  assert.notEqual(validateTextLayer({ ...base, sizePct: over }, 5000, TEXT_CANVAS['9:16']), null)
})

test('maxFittingSizePct returns null when nothing fits, even at the floor', () => {
  // 25 Korean syllables on one line: the 9:16 budget at the 5% floor is 11.25 em,
  // so no allowed size can hold it. This is reachable today -- MAX_CONTENT_LEN is
  // 100 chars over MAX_LINES=4, i.e. 25 per line.
  const l = layer({ content: '가'.repeat(25), yNorm: 0 })
  assert.equal(maxFittingSizePct(l, W9, H9, TEXT_LIMITS.MIN_SIZE_PCT, TEXT_LIMITS.MAX_SIZE_PCT), null)
})

test('maxFittingSizePct is capped by HEIGHT when the block is tall', () => {
  const l = layer({ content: 'a\na\na\na', yNorm: 0.8 })
  const cap = maxFittingSizePct(l, W9, H9, TEXT_LIMITS.MIN_SIZE_PCT, TEXT_LIMITS.MAX_SIZE_PCT)
  // Four short lines are nowhere near the width limit; only the bottom edge binds.
  assert.ok(cap === null || cap < TEXT_LIMITS.MAX_SIZE_PCT)
})

// ---- font suggestion -------------------------------------------------------

test('font suggestions are measured, never hard-coded', () => {
  // Latin: Pretendard is the narrowest of the three, so it is offered for a Latin
  // line that Black Han Sans cannot fit.
  const latin = layer({ content: 'Radiance all day long', font: 'black-han-sans', sizePct: 6 })
  const ids = FONT_SPECS.map((f) => f.id)
  const fits = fontsThatWouldFit(latin, W9, H9, ids)
  assert.ok(!fits.includes('black-han-sans'), 'never suggests the current font')
  for (const id of fits) {
    assert.ok(textBlockMetrics({ ...latin, font: id }, W9, H9).widthFrac <= 1)
  }
})

test('a font with no glyph for the text is never suggested', () => {
  const l = layer({ content: '쀓', font: 'pretendard', sizePct: 6 })
  assert.ok(!fontsThatWouldFit(l, W9, H9, FONT_SPECS.map((f) => f.id)).includes('black-han-sans'))
})

// ---- wiring ----------------------------------------------------------------

test('validateTexts uses the aspect it is given', () => {
  const bad = [layer({ content: '순간의 아름다움', font: 'black-han-sans', sizePct: 12 })]
  assert.deepEqual(validateTexts(bad, 5000, '16:9'), { ok: true })
  assert.deepEqual(validateTexts(bad, 5000, '9:16'), { ok: false, index: 0, reason: 'text_too_wide' })
})

test('a missing aspect is treated as the TIGHTER canvas, never the looser one', () => {
  const bad = [layer({ content: '순간의 아름다움', font: 'black-han-sans', sizePct: 12 })]
  assert.deepEqual(validateTexts(bad, 5000, undefined), { ok: false, index: 0, reason: 'text_too_wide' })
})

test('16:9 canvas constant matches the ratio the worker renders', () => {
  assert.equal(W16 / H16, 16 / 9)
  assert.equal(W9 / H9, 9 / 16)
})
