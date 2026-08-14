import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { ContactsView, type ContactRow } from './ContactsView'
import { type Season } from '@/lib/seasons'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>
}) {
  await requireAdmin()
  const { season: seasonParam } = await searchParams
  const supabase = await createSupabaseServer()
  const admin = createSupabaseAdmin()

  // All seasons for the dropdown. seasons carries the secret
  // main_round_twist, so it reads via service role rather than the
  // authenticated-role client (2026-08-14, GRANT hardening).
  const { data: seasonsData } = await admin
    .from('seasons')
    .select('id, name, season_number, status, is_fixture')
    .order('season_number', { ascending: false })

  const seasons = (seasonsData ?? []) as (Pick<
    Season,
    'id' | 'name' | 'season_number' | 'status'
  > & { is_fixture: boolean | null })[]

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
  } else {
    // ★Rehearsal/fixture seasons (season_test, season_1001-1006, ...) must
    // never surface as real winner contacts in the cross-season view. A
    // specific season the operator picked is an explicit choice and stays
    // unguarded (e.g. to inspect rehearsal data on purpose); only the
    // default aggregate is at risk of a silent leak once a fixture season
    // ever gets an award_rank (verified 2026-08-12: with the guard removed,
    // a rehearsal season_test row with award_rank set here DOES appear).
    const nonFixtureIds = seasons.filter((s) => !s.is_fixture).map((s) => s.id)
    query = query.in('season_id', nonFixtureIds)
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
