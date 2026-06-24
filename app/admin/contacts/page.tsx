import { requireStaff } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { ContactsView, type ContactRow } from './ContactsView'
import { type Season } from '@/lib/seasons'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>
}) {
  await requireStaff()
  const { season: seasonParam } = await searchParams
  const supabase = await createSupabaseServer()

  // All seasons for the dropdown.
  const { data: seasonsData } = await supabase
    .from('seasons')
    .select('id, name, season_number, status')
    .order('season_number', { ascending: false })

  const seasons = (seasonsData ?? []) as Pick<Season, 'id' | 'name' | 'season_number' | 'status'>[]

  // 'all' = cross-season view (winners from every season).
  // 'specific id' = scope to that season.
  const seasonScope = seasonParam || 'all'

  let query = supabase
    .from('genesis_applications')
    .select(
      'id, season_id, creator_name, email, award_rank, winner_phone, winner_address, winner_messenger, winner_info_completed_at',
    )
    .or('status.eq.awarded,award_rank.not.is.null')
    .order('winner_info_completed_at', { ascending: false, nullsFirst: false })

  if (seasonScope !== 'all') {
    query = query.eq('season_id', seasonScope)
  }

  const { data } = await query

  // Map season_id → label for display.
  const seasonLabelMap = new Map<string, string>()
  for (const s of seasons) {
    seasonLabelMap.set(s.id, `${s.name} (#${s.season_number})`)
  }

  const contacts: ContactRow[] = (data ?? []).map((r) => ({
    id: r.id,
    season_id: r.season_id,
    season_label: seasonLabelMap.get(r.season_id) ?? r.season_id,
    creator_name: r.creator_name,
    email: r.email,
    award_rank: r.award_rank,
    winner_phone: r.winner_phone,
    winner_address: r.winner_address,
    winner_messenger: r.winner_messenger,
    winner_info_completed_at: r.winner_info_completed_at,
  }))

  return (
    <ContactsView seasons={seasons} selectedSeasonScope={seasonScope} contacts={contacts} />
  )
}
