// Text/title overlay limits + validation, SHARED by the client editor (slider
// bounds + pre-render check with a reason) and the server (createRender authority).
// Font ids are DERIVED from FONT_SPECS so a new allowlisted font (e.g. Noto Serif
// KR in stage 7) is accepted automatically with no second edit here.

import { FONT_SPECS, type TextLayer } from './text-render'

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
  | 'text_window' | 'text_fade'

// Validate ONE layer against the composition duration (ms). Pure; no i18n.
export function validateTextLayer(x: unknown, totalMs: number): TextReason | null {
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
  return null
}

// Validate a full texts array. Returns the first offending index + reason.
export function validateTexts(
  texts: unknown,
  totalMs: number,
): { ok: true } | { ok: false; index: number; reason: TextReason } {
  if (texts === undefined || texts === null) return { ok: true }
  if (!Array.isArray(texts)) return { ok: false, index: -1, reason: 'text_content' }
  if (texts.length > TEXT_LIMITS.MAX_TEXTS) return { ok: false, index: -1, reason: 'too_many_texts' }
  for (let i = 0; i < texts.length; i++) {
    const r = validateTextLayer(texts[i], totalMs)
    if (r) return { ok: false, index: i, reason: r }
  }
  return { ok: true }
}
