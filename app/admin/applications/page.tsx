import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { type Season } from '@/lib/seasons'
import { isBlockingFailed, SCORING_MAX_RETRIES } from '@/lib/scoring-coverage'
import {
  ApplicationsView,
  type ApplicationRow,
  type RecommendationRow,
} from './ApplicationsView'

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>
}) {
  await requireAdmin()
  const { season: seasonParam } = await searchParams
  const supabase = await createSupabaseServer()

  // Load seasons (for dropdown + top_n_advance for recommendations title).
  // Default selection = active or most recent.
  const { data: seasonsData } = await supabase
    .from('seasons')
    .select('id, name, season_number, status, top_n_advance')
    .order('season_number', { ascending: false })

  const seasons = (seasonsData ?? []) as Pick<
    Season,
    'id' | 'name' | 'season_number' | 'status' | 'top_n_advance'
  >[]
  const activeSeason = seasons.find((s) => s.status === 'active') ?? seasons[0] ?? null
  const selectedSeasonId = seasonParam || activeSeason?.id || null
  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId) ?? null
  const topNAdvance = selectedSeason?.top_n_advance ?? 50

  // Fetch applications + their application-round scoring_results in parallel.
  // season_recommendations는 RLS 모델 A (service_role 전용)이라 createSupabaseAdmin 사용.
  let applications: ApplicationRow[] = []
  let recommendations: RecommendationRow[] = []
  if (selectedSeasonId) {
    const admin = createSupabaseAdmin()
    const [appsRes, scoringRes, recsRes] = await Promise.all([
      supabase
        .from('genesis_applications')
        .select(
          'id, season_id, email, creator_name, country, channel_url, free_entry_url, video_duration_seconds, ai_service, creator_statement, status, award_rank, admin_notes, created_at, winner_info_completed_at',
        )
        .eq('season_id', selectedSeasonId)
        .order('created_at', { ascending: false }),
      supabase
        .from('scoring_results')
        .select(
          'application_id, verified_score, grade, integrity_confidence, integrity_flag, integrity_recommendation, judged_status, processing_attempts',
        )
        .eq('season_id', selectedSeasonId)
        .eq('round', 'application'),
      admin
        .from('season_recommendations')
        .select(
          'id, application_id, rank, verified_score, status, recommended_at, applied_at, applied_by',
        )
        .eq('season_id', selectedSeasonId)
        .order('rank', { ascending: true }),
    ])

    const scoringByApp = new Map<string, NonNullable<typeof scoringRes.data>[number]>()
    for (const s of scoringRes.data ?? []) scoringByApp.set(s.application_id, s)

    applications = ((appsRes.data ?? []) as Omit<ApplicationRow, 'verified_score' | 'grade' | 'integrity_confidence' | 'integrity_flag' | 'integrity_recommendation' | 'judged_status' | 'processing_attempts'>[]).map((a) => {
      const s = scoringByApp.get(a.id)
      return {
        ...a,
        verified_score: s?.verified_score ?? null,
        grade: (s?.grade as ApplicationRow['grade']) ?? null,
        integrity_confidence: (s?.integrity_confidence as ApplicationRow['integrity_confidence']) ?? null,
        integrity_flag: s?.integrity_flag ?? false,
        integrity_recommendation: (s?.integrity_recommendation as ApplicationRow['integrity_recommendation']) ?? null,
        judged_status: (s?.judged_status as ApplicationRow['judged_status']) ?? null,
        processing_attempts: s?.processing_attempts ?? null,
      }
    })

    recommendations = (recsRes.data ?? []) as RecommendationRow[]
  }

  // ⑥G gap 3 -- oxxovo-scoring's countBlockingFailed gates Top N finalization
  // on this same count but only ever says so once, in an admin email. Computed
  // server-side (not in the client panel) because SCORING_MAX_RETRIES reads
  // process.env, which a 'use client' component cannot see at runtime for a
  // non-NEXT_PUBLIC_ var.
  const blockingFailedCount = applications.filter((a) =>
    isBlockingFailed(a, SCORING_MAX_RETRIES),
  ).length

  return (
    <ApplicationsView
      seasons={seasons}
      selectedSeasonId={selectedSeasonId}
      applications={applications}
      recommendations={recommendations}
      topNAdvance={topNAdvance}
      blockingFailedCount={blockingFailedCount}
    />
  )
}
