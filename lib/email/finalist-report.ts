// Shared Season Report data for finalist-result emails (SelectedTop50 +
// NotSelected). Both the automated path (api/cron/email-tick) and the manual
// admin path (admin/applications/actions) use these so the percentile, feedback,
// and next-season CTA are computed identically.
import type { SupabaseClient } from '@supabase/supabase-js'

export type SeasonReport = {
  score: number
  rank: number
  total: number
  percentile: number // "top X%", clamped to >=1
  strength: string
  improvement: string
}

// Rank every scored preliminary entry (verified_score DESC) and pull each one's
// strongest/weakest trait from ai_outputs. Keyed by application_id. `total` is
// the size of the scored pool (same on every entry).
export async function loadScoredRanks(
  supabase: SupabaseClient,
  seasonId: string,
): Promise<Map<string, SeasonReport>> {
  const { data } = await supabase
    .from('scoring_results')
    .select('application_id, verified_score, ai_outputs')
    .eq('season_id', seasonId)
    .eq('round', 'application')
    .eq('judged_status', 'completed')
    .not('verified_score', 'is', null)
    .order('verified_score', { ascending: false })

  const rows = data ?? []
  const total = rows.length
  const map = new Map<string, SeasonReport>()
  rows.forEach((r, i) => {
    const claude = ((r.ai_outputs as Record<string, unknown> | null)?.claude ?? {}) as {
      strengths?: string[]
      weaknesses?: string[]
    }
    const rank = i + 1
    map.set(r.application_id as string, {
      score: (r.verified_score as number) ?? 0,
      rank,
      total,
      percentile: total > 0 ? Math.max(1, Math.round((rank / total) * 100)) : 0,
      strength: Array.isArray(claude.strengths) ? claude.strengths[0] ?? '' : '',
      improvement: Array.isArray(claude.weaknesses) ? claude.weaknesses[0] ?? '' : '',
    })
  })
  return map
}

// The retention CTA's target season -- dynamic, never hardcoded: the soonest
// upcoming season by application_open_at. Falls back gracefully if none.
export async function loadNextSeason(
  supabase: SupabaseClient,
): Promise<{ name: string; openAt: string | null }> {
  const { data } = await supabase
    .from('seasons')
    .select('display_name, application_open_at')
    .eq('status', 'upcoming')
    .order('application_open_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return {
    name: (data?.display_name as string) ?? 'the next season',
    openAt: (data?.application_open_at as string | null) ?? null,
  }
}
