// Music-bed limits + validation, SHARED by the client editor (slider bounds +
// pre-render check with a reason) and the server (createRender / submitRender
// authority). Pure -- no i18n, no DB. Mirrors the text-limits.ts discipline.

import type { MusicBed } from './cryptobind'

export const MUSIC_LIMITS = {
  MIN_VOLUME: 0,
  MAX_VOLUME: 100,
  // A bed shorter than ~1s can't carry a fade; the UI hides music for such comps.
  MIN_WINDOW_MS: 500,
} as const

// Reason codes surfaced to the user (i18n'd in the editor) so a rejected bed
// explains itself. Includes the server-side asset-resolution reasons so both
// createRender and submitRender share one union.
export type MusicReason =
  | 'music_disabled'
  | 'music_shape'
  | 'music_volume'
  | 'music_window'
  | 'music_fade'
  | 'music_not_found'
  | 'music_not_ready'
  | 'music_not_owned'
  | 'music_cryptobind_failed'

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// Validate a music bed against the composition duration (ms). Pure shape/bounds
// only -- asset existence + signature are resolved server-side (needs the DB).
// `undefined`/absent music is valid (clip audio only).
export function validateMusicBed(
  music: unknown,
  totalMs: number,
): { ok: true } | { ok: false; reason: MusicReason } {
  if (music === undefined || music === null) return { ok: true }
  const m = music as MusicBed
  if (typeof m !== 'object') return { ok: false, reason: 'music_shape' }
  if (typeof m.assetId !== 'string' || !m.assetId) return { ok: false, reason: 'music_shape' }
  if (m.source !== 'library' && m.source !== 'ai') return { ok: false, reason: 'music_shape' }
  if (!isNum(m.volume) || m.volume < MUSIC_LIMITS.MIN_VOLUME || m.volume > MUSIC_LIMITS.MAX_VOLUME) {
    return { ok: false, reason: 'music_volume' }
  }
  if (!isNum(m.clipVolume) || m.clipVolume < MUSIC_LIMITS.MIN_VOLUME || m.clipVolume > MUSIC_LIMITS.MAX_VOLUME) {
    return { ok: false, reason: 'music_volume' }
  }
  const start = m.startMs ?? 0
  // endMs absent (0/undefined) => bed plays to composition end.
  const end = m.endMs ? m.endMs : totalMs
  if (!isNum(start) || start < 0 || start > totalMs) return { ok: false, reason: 'music_window' }
  if (!isNum(end) || end <= start || end > totalMs + 1) return { ok: false, reason: 'music_window' }
  if (end - start < MUSIC_LIMITS.MIN_WINDOW_MS) return { ok: false, reason: 'music_window' }
  const fin = m.fadeInMs ?? 0
  const fout = m.fadeOutMs ?? 0
  if (!isNum(fin) || !isNum(fout) || fin < 0 || fout < 0 || fin + fout > end - start) {
    return { ok: false, reason: 'music_fade' }
  }
  return { ok: true }
}
