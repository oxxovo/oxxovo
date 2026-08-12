// Text/title overlay limits + validation, SHARED by the client editor (slider
// bounds + pre-render check with a reason) and the server (createRender authority).
// Font ids are DERIVED from FONT_SPECS so a new allowlisted font (e.g. Noto Serif
// KR in stage 7) is accepted automatically with no second edit here.

import { FONT_SPECS, type TextLayer } from './text-render'
import { textBlockMetrics, undrawableChars } from './text-metrics'

// ★ The output canvas per aspect -- mirrors the worker's canvasForAspect()
// (oxxovo-studio/src/render.ts). Only the RATIO matters here: textBlockMetrics
// returns fractions, so 720x1280 and 1080x1920 give identical answers. The real
// numbers are used anyway so this cannot drift from what ships.
export const TEXT_CANVAS: Record<string, readonly [number, number]> = {
  '16:9': [1280, 720],
  '9:16': [720, 1280],
}
// A v2 EDL carrying texts always carries an aspect (the editor sets one before a
// layer can exist). If one ever arrives without, assume the TIGHTER canvas: 9:16
// has a third of 16:9's horizontal room, so guessing it can only be stricter,
// never permissive.
export const TIGHTEST_ASPECT = '9:16'

export const TEXT_LIMITS = {
  // ★ MIN_SIZE_PCT floor: below ~5% of canvas height anti-aliasing dominates and
  // text is unreadable + parity is not guaranteed (see scripts/text-parity.mjs).
  // Enforced on BOTH the UI slider and the server.
  MIN_SIZE_PCT: 5,
  MAX_SIZE_PCT: 40,
  MAX_TEXTS: 8,
  MAX_CONTENT_LEN: 100,
  MAX_LINES: 4,
  MAX_STROKE_PCT: 20,
} as const

export const TEXT_FONT_IDS: readonly string[] = FONT_SPECS.map((f) => f.id)
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

// Reason codes are surfaced to the user (i18n'd in the editor) so a rejected
// layer explains itself. `null` = valid.
export type TextReason =
  | 'too_many_texts' | 'text_content' | 'text_font' | 'text_size'
  | 'text_color' | 'text_stroke' | 'text_align' | 'text_pos'
  | 'text_window' | 'text_fade' | 'text_trademark'
  // ★ Geometry. The render spec neither wraps nor shrinks to fit, so without
  // these a layer silently runs off the frame -- measured 2026-07-31: a 7-syllable
  // Korean title at 12% on 9:16 is 131% of the frame width, and four lines at 12%
  // from yNorm=0.55 puts the last line entirely below the bottom edge.
  | 'text_too_wide' | 'text_too_tall'
  // ★ The chosen font has no glyph for a character. Black Han Sans covers 2,581
  // of 11,172 Hangul syllables; the rest draw NO ink (not even a fallback box),
  // so the caption would ship with a blank gap.
  | 'text_font_glyph'

// Validate ONE layer against the composition duration (ms) and the output canvas.
// Pure; no i18n.
export function validateTextLayer(x: unknown, totalMs: number, canvas: readonly [number, number]): TextReason | null {
  const l = x as TextLayer
  if (!l || typeof l !== 'object') return 'text_content'
  const content = typeof l.content === 'string' ? l.content : ''
  const trimmed = content.trim()
  if (!trimmed || content.length > TEXT_LIMITS.MAX_CONTENT_LEN) return 'text_content'
  if (content.split('\n').length > TEXT_LIMITS.MAX_LINES) return 'text_content'
  if (!TEXT_FONT_IDS.includes(l.font)) return 'text_font'
  if (!Number.isFinite(l.sizePct) || l.sizePct < TEXT_LIMITS.MIN_SIZE_PCT || l.sizePct > TEXT_LIMITS.MAX_SIZE_PCT) return 'text_size'
  if (typeof l.color !== 'string' || !HEX.test(l.color)) return 'text_color'
  if (l.strokeColor !== undefined || (l.strokePct ?? 0) > 0) {
    if (typeof l.strokeColor !== 'string' || !HEX.test(l.strokeColor)) return 'text_stroke'
    if (!Number.isFinite(l.strokePct) || (l.strokePct as number) < 0 || (l.strokePct as number) > TEXT_LIMITS.MAX_STROKE_PCT) return 'text_stroke'
  }
  if (l.align !== 'left' && l.align !== 'center' && l.align !== 'right') return 'text_align'
  if (!Number.isFinite(l.xNorm) || l.xNorm < 0 || l.xNorm > 1 || !Number.isFinite(l.yNorm) || l.yNorm < 0 || l.yNorm > 1) return 'text_pos'
  if (!Number.isFinite(l.startMs) || !Number.isFinite(l.endMs) || l.startMs < 0 || l.endMs <= l.startMs || l.endMs > totalMs + 1) return 'text_window'
  const fin = l.fadeInMs ?? 0
  const fout = l.fadeOutMs ?? 0
  if (fin < 0 || fout < 0 || fin + fout > l.endMs - l.startMs) return 'text_fade'

  // Geometry last: it is the only part that needs the canvas, and the checks
  // above have already guaranteed the fields it reads are well formed.
  if (undrawableChars(l.font, content).length) return 'text_font_glyph'
  const m = textBlockMetrics(l, canvas[0], canvas[1])
  if (m.widthFrac > 1) return 'text_too_wide'
  if (m.bottomFrac > 1) return 'text_too_tall'
  return null
}

// ---------------------------------------------------------------------------
// Trademark blocklist (server-side, NO-DEPLOY tunable via platform_config key
// `text_trademark_blocklist`). Kept NARROW on purpose (clear big-brand names);
// anything ambiguous is caught by the AI moderation + admin queue, not here.
// Value is a JSON array of strings, or a comma/newline-separated list.
export function parseTrademarkBlocklist(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const j = JSON.parse(raw)
    if (Array.isArray(j)) return j.map((x) => String(x))
  } catch {
    /* not JSON -- fall through to delimiter split */
  }
  return raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
}

// Return the FIRST blocked term found in `content` (case-insensitive substring),
// or null. Substring (not word-boundary) so it works for CJK brand names too;
// the list stays narrow to avoid false positives.
export function findBlockedTrademark(content: string, blocklist: string[]): string | null {
  const hay = content.toLowerCase()
  for (const term of blocklist) {
    const t = term.trim().toLowerCase()
    if (t && hay.includes(t)) return term
  }
  return null
}

// Validate a full texts array. Returns the first offending index + reason.
export function validateTexts(
  texts: unknown,
  totalMs: number,
  aspect?: string,
): { ok: true } | { ok: false; index: number; reason: TextReason } {
  if (texts === undefined || texts === null) return { ok: true }
  if (!Array.isArray(texts)) return { ok: false, index: -1, reason: 'text_content' }
  if (texts.length > TEXT_LIMITS.MAX_TEXTS) return { ok: false, index: -1, reason: 'too_many_texts' }
  const canvas = TEXT_CANVAS[aspect ?? TIGHTEST_ASPECT] ?? TEXT_CANVAS[TIGHTEST_ASPECT]
  for (let i = 0; i < texts.length; i++) {
    const r = validateTextLayer(texts[i], totalMs, canvas)
    if (r) return { ok: false, index: i, reason: r }
  }
  return { ok: true }
}
