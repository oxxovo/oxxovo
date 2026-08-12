// Studio music gate. SERVER ONLY.
//
// TWO switches, both seasons columns so the whole gate lives in ONE storage
// layer (the old split -- seasons column for the library, platform_config key
// for AI -- is what let the UI and the server disagree):
//
//   seasons.studio_music_enabled     MASTER. Music feature as a whole.
//   seasons.studio_music_ai_enabled  Participant-facing AI generation.
//
//   library picker  = master
//   AI generation   = master AND ai
//
// ★master ON + ai OFF is not a fallback any more -- it is SEASON 0's shipping
// configuration. TK settled it 2026-08-07 (plan B, library only): season 0 does
// not turn participant-facing AI generation on at all. OXXOVO pre-generates the
// beds on its own account and participants pick from them, so no API access is
// passed through to a third party. Do not collapse the two switches: season 1
// may open generation, and the day it does the gate must already be two.
//
// FAIL-CLOSED is the whole point, exactly like lib/watch-scores.ts. Every
// failure mode -- column not migrated yet, query error, unknown season, null --
// resolves to OFF. Turning music on requires an explicit true in the row.
// Flipping it is a DB switch, not a deploy:
//   UPDATE seasons SET studio_music_enabled = true WHERE id = 'season_0';           -- library only
//   UPDATE seasons SET studio_music_enabled = true, studio_music_ai_enabled = true  -- + AI
//     WHERE id = 'season_0';
// ★The second line is NOT for season 0. An earlier version of this comment said
// the AI signal was waiting on a written reply from ElevenLabs; that vendor was
// dropped and the question was closed by decision, not by an answer arriving.
// Leaving it as "pending" would have kept a settled item on a waiting list --
// which is how a closed decision gets re-litigated a month later.

import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'

// Per-user AI music generations allowed per season+round when the season row is
// unreadable. Not "unlimited": an unreadable cap must not become a free-for-all.
export const MUSIC_CAP_FALLBACK = 15

export type MusicGate = {
  /** master -- library picker */
  enabled: boolean
  /** master AND ai -- participant-facing generation */
  aiEnabled: boolean
  /** per-user generations per season+round. 0 = unlimited (season opt-in only). */
  cap: number
}

export const MUSIC_GATE_CLOSED: MusicGate = { enabled: false, aiEnabled: false, cap: 0 }

type SeasonGateRow = {
  id?: unknown
  studio_music_enabled?: unknown
  studio_music_ai_enabled?: unknown
  studio_music_max_generations_per_round?: unknown
}

// Pure evaluator -- the whole fail-closed decision, no IO, so it is unit
// testable. `row` is whatever came back from the DB (or null/undefined on any
// failure path). Only a literal `true` opens a switch: a string 'true', a 1, or
// a null all stay closed.
export function evaluateMusicGate(row: SeasonGateRow | null | undefined): MusicGate {
  if (!row) return MUSIC_GATE_CLOSED
  const enabled = row.studio_music_enabled === true
  if (!enabled) return MUSIC_GATE_CLOSED
  const aiEnabled = row.studio_music_ai_enabled === true
  // cap 0 means "unlimited", so an ABSENT value must never coerce into it.
  // Number(null) and Number('') are both 0 -- checking Number.isFinite alone
  // would silently turn a missing column into a free-for-all.
  const rawValue = row.studio_music_max_generations_per_round
  const raw = typeof rawValue === 'number' || (typeof rawValue === 'string' && rawValue.trim() !== '')
    ? Number(rawValue)
    : NaN
  const cap = Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : MUSIC_CAP_FALLBACK
  return { enabled, aiEnabled, cap }
}

// Read both switches + the cap for one season. Never throws.
export async function getMusicGate(seasonId: string | null | undefined): Promise<MusicGate> {
  if (!seasonId) return MUSIC_GATE_CLOSED
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('seasons')
    .select('id, studio_music_enabled, studio_music_ai_enabled, studio_music_max_generations_per_round')
    .eq('id', seasonId)
    .maybeSingle()

  if (error) {
    // Includes "column does not exist" before the migration runs. Hiding music
    // is the safe direction, so this is a warning, not a throw.
    console.warn('[music] gate unreadable, withholding music:', error.message)
    return MUSIC_GATE_CLOSED
  }
  return evaluateMusicGate(data as SeasonGateRow | null)
}

/** Library picker / bed usage. master only. */
export async function isMusicEnabled(seasonId: string | null | undefined): Promise<boolean> {
  return (await getMusicGate(seasonId)).enabled
}

/** Participant-facing AI generation. master AND ai. */
export async function isMusicAiEnabled(seasonId: string | null | undefined): Promise<boolean> {
  return (await getMusicGate(seasonId)).aiEnabled
}
