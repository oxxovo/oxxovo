import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { deriveGrade, type Grade } from '@/lib/grades'
import { WinnersView, type WinnerCard } from './WinnersView'
import { type Season } from '@/lib/seasons'

// Read-only. award_rank is edited exactly one place --
// app/admin/applications/actions.ts (approveTop3Awards / saveAwardOverride) --
// and this screen must never grow a second door to it (HQ 2026-08-12: two
// places that can write the same fact is a dual source of truth).
export default async function WinnersPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>
}) {
  await requireAdmin()
  const { season: seasonParam } = await searchParams
  const supabase = await createSupabaseServer()

  const { data: seasonsData } = await supabase
    .from('seasons')
    .select('id, name, display_name, season_number, status, is_fixture')
    .order('season_number', { ascending: false })

  const seasons = (seasonsData ?? []) as (Pick<
    Season,
    'id' | 'name' | 'display_name' | 'season_number' | 'status'
  > & { is_fixture: boolean | null })[]

  const seasonScope = seasonParam || 'all'

  let query = supabase
    .from('genesis_applications')
    .select(
      'id, season_id, creator_name, video_title, thumbnail_url, main_round_video_url, award_rank',
    )
    .not('award_rank', 'is', null)
    .order('season_id', { ascending: false })
    .order('award_rank', { ascending: true })

  if (seasonScope !== 'all') {
    query = query.eq('season_id', seasonScope)
  } else {
    // ★Same guard as /admin/contacts, same reason: a rehearsal season
    // (season_test, season_1001-1006, ...) getting an award_rank must never
    // surface as a real winner in the cross-season default view. Verified
    // 2026-08-11/12 by temporarily setting award_rank on a season_test row --
    // without this filter it appears; with it, it does not. An explicitly
    // picked season stays unguarded (an operator inspecting rehearsal data on
    // purpose is a different case from the silent default leaking one).
    const nonFixtureIds = seasons.filter((s) => !s.is_fixture).map((s) => s.id)
    query = query.in('season_id', nonFixtureIds)
  }

  const { data } = await query
  const winners = (data ?? []) as {
    id: string
    season_id: string
    creator_name: string | null
    video_title: string | null
    thumbnail_url: string | null
    main_round_video_url: string | null
    award_rank: number
  }[]

  // Grade is LEFT JOIN semantics: award_rank is the record of fact (who won),
  // scoring may not exist yet (season_0 has 0 scoring_results rows today) --
  // a missing/incomplete score omits the badge, it never hides the card.
  const scoreByApp = new Map<string, number>()
  if (winners.length > 0) {
    const { data: scoring } = await supabase
      .from('scoring_results')
      .select('application_id, verified_score')
      .eq('round', 'main')
      .in(
        'application_id',
        winners.map((w) => w.id),
      )
    for (const s of (scoring ?? []) as { application_id: string; verified_score: number | null }[]) {
      if (s.verified_score != null) scoreByApp.set(s.application_id, s.verified_score)
    }
  }

  const seasonLabelMap = new Map<string, string>()
  const seasonNumberMap = new Map<string, number>()
  for (const s of seasons) {
    seasonLabelMap.set(s.id, `${s.display_name?.trim() || s.name?.trim() || s.id} (#${s.season_number})`)
    seasonNumberMap.set(s.id, s.season_number)
  }

  const cards: WinnerCard[] = winners
    .map((w) => {
      const verifiedScore = scoreByApp.get(w.id) ?? null
      return {
        id: w.id,
        seasonId: w.season_id,
        seasonLabel: seasonLabelMap.get(w.season_id) ?? w.season_id,
        seasonNumber: seasonNumberMap.get(w.season_id) ?? 0,
        creatorName: w.creator_name,
        videoTitle: w.video_title,
        thumbnailUrl: w.thumbnail_url,
        videoUrl: w.main_round_video_url,
        awardRank: w.award_rank,
        verifiedScore,
        grade: deriveGrade(verifiedScore) as Grade | null,
      }
    })
    .sort((a, b) => b.seasonNumber - a.seasonNumber || a.awardRank - b.awardRank)

  return <WinnersView seasons={seasons} selectedSeasonScope={seasonScope} winners={cards} />
}
