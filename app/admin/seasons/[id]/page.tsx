import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { type Season } from '@/lib/seasons'
import { type SeasonFormInitial, type SeasonInput } from '@/lib/season-schema'
import { filterKnownVideoPlatforms } from '@/lib/video-url'
import { SeasonForm } from '../SeasonForm'
import { DeleteSeasonButton } from '../DeleteSeasonButton'
import { EditSeasonHeader, DangerZoneHeading } from '../SeasonPageHeader'
import { StudioTestAccess } from '../StudioTestAccess'

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

  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) {
    notFound()
  }

  const season = data as Season
  const initial: SeasonFormInitial = {
    name: season.name,
    season_number: season.season_number,
    status: season.status as SeasonInput['status'],
    // ★The row's own answer, so editing shows what this season IS rather than
    // asking again from scratch. NOT `?? false`: the column is NOT NULL so a
    // non-boolean here means this read did not carry it, and in that case the
    // admin must choose rather than have a value invented for them -- the same
    // rule lib/lobby.ts isFixtureSeason applies to the same absence.
    is_fixture: typeof season.is_fixture === 'boolean' ? season.is_fixture : undefined,
    max_applicants: season.max_applicants,
    top_n_advance: season.top_n_advance,
    // 3-stage advancement policy. Fallbacks cover rows read before the
    // season0_3stage migration adds the columns (?? null/undefined -> default).
    min_participants: season.min_participants ?? 50,
    // ★Nullable in the DB (existing rows predate this column) but the form
    // wants a number to edit -- 80 is the fallback default, not a claim that
    // this row was actually set to 80 (see lib/seasons.ts comment: NULL means
    // the RPC holds for manual review, it does not mean "no floor").
    absolute_min_participants: season.absolute_min_participants ?? 80,
    defer_extension_days: season.defer_extension_days ?? 7,
    max_defer_count: season.max_defer_count ?? 2,
    advance_pct: season.advance_pct ?? 0.1,
    advance_min: season.advance_min ?? 10,
    advance_max: season.advance_max ?? 50,
    application_video_min_seconds: season.application_video_min_seconds,
    application_video_max_seconds: season.application_video_max_seconds,
    total_prize_pool: season.total_prize_pool,
    entry_fee: season.entry_fee,
    prize_first_pct: season.prize_first_pct,
    prize_second_pct: season.prize_second_pct,
    prize_third_pct: season.prize_third_pct,
    main_round_video_seconds: season.main_round_video_seconds,
    main_round_video_min_seconds: season.main_round_video_min_seconds,
    main_round_video_max_seconds: season.main_round_video_max_seconds,
    allowed_video_platforms: filterKnownVideoPlatforms(season.allowed_video_platforms),
    theme_announcement_minutes_before: season.theme_announcement_minutes_before,
    submission_hours: season.submission_hours,
    deadline_reminder_hours: season.deadline_reminder_hours ?? [],
    registration_reminder_days: season.registration_reminder_days ?? null,
    community_vote_weight: season.community_vote_weight,
    ai_score_weight: season.ai_score_weight,
    scoring_intent_clarity_weight: season.scoring_intent_clarity_weight,
    scoring_execution_weight: season.scoring_execution_weight,
    scoring_originality_weight: season.scoring_originality_weight,
    scoring_integrity_weight: season.scoring_integrity_weight,
    ai_models: season.ai_models,
    flag_integrity_threshold: season.flag_integrity_threshold,
    flag_spread_threshold: season.flag_spread_threshold,
    studio_round: season.studio_round ?? 'main',
    studio_max_generations_per_round: season.studio_max_generations_per_round ?? 10,
    poster_url: season.poster_url ?? null,
    main_round_theme_label: season.main_round_theme_label ?? null,
    // ★PUBLIC (seasons_public exposes it) -- vs. main_round_twist below,
    // which is SECRET. Same table read either way.
    main_round_theme: season.main_round_theme ?? null,
    season_theme: season.season_theme ?? null,
    // ★SECRET -- this page already reads `seasons` via service role (the
    // 2026-08-14 GRANT hardening moved every admin seasons read here), so
    // exposing this on the admin edit form is not a new leak.
    main_round_twist: season.main_round_twist ?? null,
    lobby_featured: season.lobby_featured ?? false,
    application_open_at: season.application_open_at,
    registration_close_at: season.registration_close_at,
    application_close_at: season.application_close_at,
    scoring_complete_at: season.scoring_complete_at,
    scoring_start_at: season.scoring_start_at,
    prelim_results_announcement_at: season.prelim_results_announcement_at,
    community_vote_start_at: season.community_vote_start_at,
    community_vote_end_at: season.community_vote_end_at,
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

      <StudioTestAccess seasonId={id} />

      <section className="mt-16 pt-8 border-t border-white/10">
        <DangerZoneHeading />
        <DeleteSeasonButton id={id} seasonName={season.name} />
      </section>
    </div>
  )
}
