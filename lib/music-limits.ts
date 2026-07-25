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
// createRender and submitRender share one union. The music_* AI-generation
// reasons (Stage 6) live here too so createMusicGeneration shares the union.
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
  // --- AI generation (Stage 6) ---
  | 'music_ai_disabled' // season allows music but the AI-gen switch (config) is off
  | 'music_duration' // requested track length out of bounds
  | 'music_prompt_empty'
  | 'music_prompt_too_long'
  | 'music_moderation' // OpenAI moderation flagged (or could not clear -> fail-safe)
  | 'music_imitation' // copyright-mimicry request (artist/track blocklist or phrase)
  | 'music_insufficient_credits'
  | 'music_cap_reached'

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

// ---------------------------------------------------------------------------
// AI music-generation prompt guards (Stage 6) -- PURE + SHARED (client editor
// pre-checks, server enforces). The DB-backed artist/track blocklist is read in
// lib/music-gen.ts (platform_config); the phrase patterns below are static.
// ---------------------------------------------------------------------------

// A mood description, not a screenplay -- keep prompts short. Cheap fixed cap so
// an over-length prompt is rejected before a credit is spent (mirrors clip
// prompt_too_long). The provider's own limit is enforced separately at build.
export const MAX_MUSIC_PROMPT = 500

// Imitation-intent phrases (Genesis Rule / copyright): a request to MIMIC a
// reference work or artist is refused BEFORE spending a credit. Kept NARROW on
// purpose -- clear "make it like <reference>" phrasing only; named artists/tracks
// are caught by the curated blocklist (platform_config), and anything ambiguous
// is left to AI moderation + the admin queue (same stance as the text trademark
// list). EN + KO. APPEND-ONLY (order is not signature-visible; safe to extend).
const IMITATION_PATTERNS: readonly RegExp[] = [
  /\bin the style of\b/i,
  /\bin the manner of\b/i,
  /\bsounds?\s+like\b/i,
  /\bcover of\b/i,
  /\bremix of\b/i,
  /\brip[-\s]?off\b/i,
  /같은\s*스타일/,
  /스타일로/,
  /풍으로/,
  /처럼\s*만들/,
]

// Parse the curated artist/track blocklist from platform_config
// (`studio_music_artist_blocklist`). JSON array of strings, or comma/newline
// list. Mirrors parseTrademarkBlocklist so the two no-deploy lists behave alike.
export function parseArtistBlocklist(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const j = JSON.parse(raw)
    if (Array.isArray(j)) return j.map((x) => String(x))
  } catch {
    /* not JSON -- fall through to delimiter split */
  }
  return raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)
}

// Return the FIRST imitation signal in `prompt` (a matched phrase or a blocked
// artist/track name), or null. Phrases first, then the curated blocklist
// (case-insensitive substring, so it works for CJK names; the list stays narrow
// to avoid false positives). The caller rejects with reason 'music_imitation'
// and this string as the detail so the UI can point at what tripped.
export function findImitation(prompt: string, artistBlocklist: string[] = []): string | null {
  const text = prompt ?? ''
  for (const re of IMITATION_PATTERNS) {
    const m = text.match(re)
    if (m) return m[0]
  }
  const hay = text.toLowerCase()
  for (const term of artistBlocklist) {
    const t = term.trim().toLowerCase()
    if (t && hay.includes(t)) return term
  }
  return null
}

// Pure prompt bounds (empty / length). Imitation + moderation are checked in
// music-gen.ts (they need the DB blocklist / the moderation API). Absent/empty
// -> music_prompt_empty; over MAX_MUSIC_PROMPT -> music_prompt_too_long.
export function validateMusicPrompt(prompt: unknown): { ok: true; prompt: string } | { ok: false; reason: MusicReason } {
  const p = typeof prompt === 'string' ? prompt.trim() : ''
  if (!p) return { ok: false, reason: 'music_prompt_empty' }
  if (p.length > MAX_MUSIC_PROMPT) return { ok: false, reason: 'music_prompt_too_long' }
  return { ok: true, prompt: p }
}
