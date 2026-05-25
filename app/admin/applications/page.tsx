import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { type Season } from '@/lib/seasons'
import { ApplicationsView, type ApplicationRow } from './ApplicationsView'

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>
}) {
  await requireAdmin()
  const { season: seasonParam } = await searchParams
  const supabase = await createSupabaseServer()

  // Load seasons (for dropdown). Default selection = active or most recent.
  const { data: seasonsData } = await supabase
    .from('seasons')
    .select('id, name, season_number, status')
    .order('season_number', { ascending: false })

  const seasons = (seasonsData ?? []) as Pick<Season, 'id' | 'name' | 'season_number' | 'status'>[]
  const activeSeason = seasons.find((s) => s.status === 'active') ?? seasons[0] ?? null
  const selectedSeasonId = seasonParam || activeSeason?.id || null

  // Fetch applications for the selected season.
  let applications: ApplicationRow[] = []
  if (selectedSeasonId) {
    const { data } = await supabase
      .from('genesis_applications')
      .select(
        'id, season_id, email, creator_name, country, channel_url, free_entry_url, video_duration_seconds, ai_service, creator_statement, status, award_rank, admin_notes, created_at, winner_info_completed_at',
      )
      .eq('season_id', selectedSeasonId)
      .order('created_at', { ascending: false })
    applications = (data ?? []) as ApplicationRow[]
  }

  return (
    <ApplicationsView
      seasons={seasons}
      selectedSeasonId={selectedSeasonId}
      applications={applications}
    />
  )
}
