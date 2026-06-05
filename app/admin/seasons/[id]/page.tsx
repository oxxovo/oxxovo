import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { type Season } from '@/lib/seasons'
import { type SeasonInput } from '@/lib/season-schema'
import { SeasonForm } from '../SeasonForm'
import { DeleteSeasonButton } from '../DeleteSeasonButton'
import { EditSeasonHeader, DangerZoneHeading } from '../SeasonPageHeader'

export default async function SeasonEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ saved?: string }>
}) {
  await requireAdmin()
  const { id } = await params
  const { saved } = await searchParams

  const supabase = await createSupabaseServer()
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    notFound()
  }

  const season = data as Season
  const initial: SeasonInput = {
    name: season.name,
    season_number: season.season_number,
    status: season.status as SeasonInput['status'],
    max_applicants: season.max_applicants,
    top_n_advance: season.top_n_advance,
    application_video_min_seconds: season.application_video_min_seconds,
    application_video_max_seconds: season.application_video_max_seconds,
    total_prize_pool: season.total_prize_pool,
    entry_fee: season.entry_fee,
    prize_first_pct: season.prize_first_pct,
    prize_second_pct: season.prize_second_pct,
    prize_third_pct: season.prize_third_pct,
    main_round_video_seconds: season.main_round_video_seconds,
    theme_announcement_minutes_before: season.theme_announcement_minutes_before,
    submission_hours: season.submission_hours,
    community_vote_weight: season.community_vote_weight,
    ai_score_weight: season.ai_score_weight,
    scoring_intent_clarity_weight: season.scoring_intent_clarity_weight,
    scoring_execution_weight: season.scoring_execution_weight,
    scoring_originality_weight: season.scoring_originality_weight,
    scoring_integrity_weight: season.scoring_integrity_weight,
    ai_models: season.ai_models,
    flag_integrity_threshold: season.flag_integrity_threshold,
    flag_spread_threshold: season.flag_spread_threshold,
    application_open_at: season.application_open_at,
    application_close_at: season.application_close_at,
    scoring_complete_at: season.scoring_complete_at,
    main_round_start_at: season.main_round_start_at,
    main_round_end_at: season.main_round_end_at,
    awards_announcement_at: season.awards_announcement_at,
  }

  return (
    <div className="p-8 max-w-4xl">
      <EditSeasonHeader
        id={id}
        name={season.name}
        seasonNumber={season.season_number}
        updatedAt={season.updated_at}
        showSaved={!!saved}
      />

      <SeasonForm id={id} initial={initial} />

      <section className="mt-16 pt-8 border-t border-white/10">
        <DangerZoneHeading />
        <DeleteSeasonButton id={id} seasonName={season.name} />
      </section>
    </div>
  )
}
