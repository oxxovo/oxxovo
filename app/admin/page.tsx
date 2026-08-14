import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { type Season } from '@/lib/seasons'
import { DashboardView, type ScoringStats } from './DashboardView'
import { scoringCoverage } from '@/lib/scoring-coverage'

export default async function AdminDashboard() {
  const admin = await requireAdmin()
  const supabase = await createSupabaseServer()
  const adminDb = createSupabaseAdmin()

  // seasons carries the secret main_round_twist, so it reads via service
  // role rather than the authenticated-role client (2026-08-14, GRANT
  // hardening).
  const { data: seasons } = await adminDb
    .from('seasons')
    .select('*')
    .order('season_number', { ascending: false })

  const seasonList = (seasons ?? []) as Season[]
  const currentSeason = seasonList.find((s) => s.status === 'active') ?? seasonList[0] ?? null

  const { count: applicationCount } = await supabase
    .from('genesis_applications')
    .select('*', { count: 'exact', head: true })

  // Scoring stats for the current season — confidence distribution + flagged count.
  // Returns null if the season is missing or the scoring_results table isn't migrated yet
  // (this keeps the dashboard rendering even before the SQL has been applied).
  let scoringStats: ScoringStats | null = null
  if (currentSeason) {
    const { data: scoringRows, error: scoringErr } = await supabase
      .from('scoring_results')
      .select('application_id, integrity_confidence, judged_status')
      .eq('season_id', currentSeason.id)
      .eq('round', 'application')

    // ★⑥G gap 1: the DENOMINATOR. The three counts below are counts of rows
    // that exist, so an entry nobody enqueued is in none of them -- the panel
    // read the same at full coverage and at half. `free_entry_url IS NOT NULL`
    // is what makes an entry scorable to the scorer, so it is what "scorable"
    // means here.
    const { data: filmRows } = await supabase
      .from('genesis_applications')
      .select('id')
      .eq('season_id', currentSeason.id)
      .not('free_entry_url', 'is', null)

    if (!scoringErr && scoringRows) {
      const counts = { none: 0, low: 0, medium: 0, high: 0 }
      let completed = 0
      let inProgress = 0
      let failed = 0
      for (const row of scoringRows) {
        if (row.judged_status === 'completed') completed++
        else if (row.judged_status === 'in_progress' || row.judged_status === 'pending') inProgress++
        else if (row.judged_status === 'failed') failed++
        const conf = row.integrity_confidence as keyof typeof counts | null
        if (conf && conf in counts) counts[conf]++
      }
      const coverage = scoringCoverage(
        ((filmRows ?? []) as { id: string }[]).map((r) => r.id),
        (scoringRows as { application_id: string }[]).map((r) => r.application_id),
      )
      scoringStats = { ...counts, completed, in_progress: inProgress, failed, ...coverage }
    }
  }

  return (
    <DashboardView
      adminName={admin.email.split('@')[0]}
      seasons={seasonList}
      applicationCount={applicationCount ?? 0}
      scoringStats={scoringStats}
    />
  )
}
