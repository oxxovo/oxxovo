// Text block geometry -- how wide and how tall a TextLayer actually renders.
//
// ★ ONE FUNCTION, THREE CONSUMERS. The editor (live width/height readout and the
// dynamic size cap), the server (createRender's hard gate) and the audit script
// all call THIS. If the editor measured with canvas.measureText and the server
// measured some other way, a participant could see 98% and be rejected at submit.
//
// ★ NO CANVAS. @napi-rs/canvas is a devDependency and cannot run in the Vercel
// runtime, so the server cannot measure text with a real font. Instead the glyph
// advances are baked into lib/text-advances.json by scripts/gen-text-advances.mjs,
// which measures the WORKER'S OWN .ttf with the WORKER'S OWN engine.
//
// ★ WIDTH IS AN UPPER BOUND. Summing per-character advances ignores kerning, and
// kerning in these three fonts only ever pulls glyphs closer -- measured
// 2026-07-31, sum(advances) - measureText(line) is never negative, is <=1.8% on
// realistic caption strings and <=6.1% on deliberately kern-heavy Latin. So this
// can report a line as slightly wider than it renders, never narrower, and the
// guard therefore never admits something that then clips off the frame.
//
// Client-safe: no 'server-only', no node APIs.

import { fontPx, fontSpec, LINE_HEIGHT, type TextLayer } from './text-render'
import { TEXT_ADVANCES } from './text-advances'

type UniformHangul = { uniform: number }
type PaletteHangul = { palette: number[]; data: string }
type FontTable = {
  ascii: number[]
  asciiLo: number
  hangulLo: number
  hangulHi: number
  hangul: UniformHangul | PaletteHangul
  otherMax: number
  coveredHangul: number
  totalHangul: number
}
const FONTS = (TEXT_ADVANCES as unknown as { fonts: Record<string, FontTable> }).fonts

// base64 -> bytes, decoded once per font and cached. Only Black Han Sans has a
// palette block; the other two are a single number and never reach this.
const paletteCache = new Map<string, Uint8Array>()
function paletteBytes(id: string, h: PaletteHangul): Uint8Array {
  const hit = paletteCache.get(id)
  if (hit) return hit
  const bin = typeof atob === 'function'
    ? atob(h.data)
    : Buffer.from(h.data, 'base64').toString('binary')
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  paletteCache.set(id, out)
  return out
}

function table(fontId: string): FontTable {
  return FONTS[fontId] ?? FONTS[fontSpec(fontId).id]
}

/** Advance of one code point in em, and whether the font actually draws it. */
function glyph(fontId: string, cp: number): { em: number; drawn: boolean } {
  const t = table(fontId)
  if (cp >= t.asciiLo && cp < t.asciiLo + t.ascii.length) {
    return { em: t.ascii[cp - t.asciiLo], drawn: true }
  }
  if (cp >= t.hangulLo && cp <= t.hangulHi) {
    const h = t.hangul
    if ('uniform' in h) return { em: h.uniform, drawn: true }
    const k = paletteBytes(fontId, h)[cp - t.hangulLo]
    // index 0 = the font has no glyph: it renders as an empty gap, not a box.
    return k === 0 ? { em: t.otherMax, drawn: false } : { em: h.palette[k], drawn: true }
  }
  // Outside the two tabulated blocks we cannot know the advance, so use the
  // font's widest -- over-estimating keeps the guard on the safe side.
  return { em: t.otherMax, drawn: true }
}

/** Width of one line in em (upper bound -- see the header). */
export function lineWidthEm(fontId: string, line: string): number {
  let em = 0
  for (const ch of line) em += glyph(fontId, ch.codePointAt(0) as number).em
  return em
}

/**
 * Every Hangul syllable in `content` that the font renders as NOTHING. Black Han
 * Sans covers 2,581 of 11,172 syllables; the rest draw no ink at all, so a
 * caption containing one ships with a silent blank gap.
 */
export function undrawableChars(fontId: string, content: string): string[] {
  const bad: string[] = []
  for (const ch of content) {
    if (!glyph(fontId, ch.codePointAt(0) as number).drawn && !bad.includes(ch)) bad.push(ch)
  }
  return bad
}

export type TextBlockMetrics = {
  /** widest line, as a fraction of canvas width (1 = exactly the full width) */
  widthFrac: number
  /** block height, as a fraction of canvas height */
  heightFrac: number
  /** bottom edge of the block, as a fraction of canvas height (1 = the frame edge) */
  bottomFrac: number
  lines: number
  /** index of the widest line, for pointing the participant at it */
  widestLine: number
}

/**
 * Geometry of a layer on a W x H canvas. Aspect ratio is the only thing that
 * matters -- both fractions are scale invariant, so 720x1280 and 1080x1920 give
 * identical answers.
 *
 * Vertical model mirrors drawTextLayer exactly: yNorm*H is the TOP of the block,
 * each subsequent line sits LINE_HEIGHT font-px lower, and the last line still
 * occupies its own em box. Hence blockH = fontPx * (LINE_HEIGHT*(n-1) + 1).
 */
export function textBlockMetrics(layer: TextLayer, W: number, H: number): TextBlockMetrics {
  const px = fontPx(layer, H)
  const lines = String(layer.content ?? '').split('\n')
  let widest = 0
  let widestLine = 0
  for (let i = 0; i < lines.length; i++) {
    const w = lineWidthEm(layer.font, lines[i]) * px
    if (w > widest) { widest = w; widestLine = i }
  }
  const blockH = px * (LINE_HEIGHT * (lines.length - 1) + 1)
  return {
    widthFrac: widest / W,
    heightFrac: blockH / H,
    bottomFrac: layer.yNorm + blockH / H,
    lines: lines.length,
    widestLine,
  }
}

/**
 * Largest sizePct at which `layer` still fits BOTH dimensions on a W x H canvas,
 * or null when nothing fits (the widest line cannot fit even at `floorPct`).
 *
 * Both constraints are linear in font px, so this is solved, not searched:
 *   width  : widestEm * (pct/100 * H) <= W
 *   height : yNorm*H + (pct/100*H) * (LINE_HEIGHT*(n-1)+1) <= H
 */
export function maxFittingSizePct(layer: TextLayer, W: number, H: number, floorPct: number, ceilPct: number): number | null {
  const lines = String(layer.content ?? '').split('\n')
  let widestEm = 0
  for (const l of lines) widestEm = Math.max(widestEm, lineWidthEm(layer.font, l))
  const blockEm = LINE_HEIGHT * (lines.length - 1) + 1

  const byWidth = widestEm > 0 ? (W / (widestEm * H)) * 100 : ceilPct
  const byHeight = blockEm > 0 ? (((1 - layer.yNorm) * H) / (blockEm * H)) * 100 : ceilPct
  const cap = Math.min(ceilPct, byWidth, byHeight)
  // Floor the result so a participant can never land one rounding step over.
  const capFloored = Math.floor(cap * 10) / 10
  return capFloored < floorPct ? null : capFloored
}

/** Fonts (other than the current one) whose widest line WOULD fit at `sizePct`. */
export function fontsThatWouldFit(layer: TextLayer, W: number, H: number, fontIds: readonly string[]): string[] {
  const px = fontPx(layer, H)
  const lines = String(layer.content ?? '').split('\n')
  return fontIds.filter((id) => {
    if (id === layer.font) return false
    if (undrawableChars(id, layer.content).length) return false
    let widest = 0
    for (const l of lines) widest = Math.max(widest, lineWidthEm(id, l) * px)
    return widest <= W
  })
}

/** Coverage summary, for the editor's font picker. */
export function fontCoverage(fontId: string): { covered: number; total: number } {
  const t = table(fontId)
  return { covered: t.coveredHangul, total: t.totalHangul }
}
