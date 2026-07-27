// Public score-disclosure gate. SERVER ONLY.
//
// Triple-AI scores stay hidden on /watch until the scoring track ships the
// Defect 1 rubric fix (the Integrity axis currently penalises photorealism, so
// a better film can score lower -- publishing that inverts the prize ladder in
// public). Head office gives the signal; the flip is a DB switch, not a deploy:
//   UPDATE seasons SET watch_scores_public = true WHERE id = 'season_0';
//
// FAIL-CLOSED is the whole point. Every failure mode -- column not migrated
// yet, query error, unknown season, null -- resolves to "hidden". Turning
// scores on requires an explicit true in the row; nothing else can do it.
//
// Not gated: the "AI judging N/M" progress bar (a count, not a score) and the
// admin console (staff always see scores, [[project-scoring-integrity-rules]]).

import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'

// Season ids whose scores may be shown publicly. Empty set = nothing public,
// which is also what every error path returns.
export async function publicScoreSeasons(): Promise<Set<string>> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('seasons')
    .select('id, watch_scores_public')
    .eq('watch_scores_public', true)

  if (error) {
    // Includes "column does not exist" before the migration runs. Hiding
    // scores is the safe direction, so this is a warning, not a throw.
    console.warn('[watch] score gate unreadable, withholding scores:', error.message)
    return new Set()
  }
  return new Set((data ?? []).map((r: { id: string }) => r.id))
}

export async function areScoresPublic(seasonId: string | null | undefined): Promise<boolean> {
  if (!seasonId) return false
  return (await publicScoreSeasons()).has(seasonId)
}
