import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { type Season } from '@/lib/seasons'
import { type SeasonInput } from '@/lib/season-schema'
import { SeasonForm } from '../SeasonForm'
import { DeleteSeasonButton } from '../DeleteSeasonButton'

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
    prize_first: season.prize_first,
    prize_second: season.prize_second,
    prize_third: season.prize_third,
    total_prize_pool: season.total_prize_pool,
    entry_fee: season.entry_fee,
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
      <header className="mb-8">
        <Link href="/admin/seasons" className="text-xs text-[#ff8844] hover:underline">
          ← Seasons
        </Link>
        <div className="mt-3 flex items-baseline justify-between">
          <h1 className="text-3xl font-black">
            Edit {season.name}{' '}
            <span className="text-white/30 font-normal">· Season {season.season_number}</span>
          </h1>
          <span className="text-xs text-white/40">
            Last updated{' '}
            {new Date(season.updated_at).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </span>
        </div>
      </header>

      {saved && (
        <div className="mb-6 px-4 py-3 rounded border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300">
          Season saved. Public site cache refreshed.
        </div>
      )}

      <SeasonForm id={id} initial={initial} />

      <section className="mt-16 pt-8 border-t border-white/10">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8888] font-bold mb-4">
          Danger zone
        </h2>
        <DeleteSeasonButton id={id} seasonName={season.name} />
      </section>
    </div>
  )
}
