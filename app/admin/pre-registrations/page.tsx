import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { PreRegistrationsView, type PreRegRow } from './PreRegistrationsView'
import { type Season } from '@/lib/seasons'

export default async function PreRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>
}) {
  await requireAdmin()
  const { season: seasonParam } = await searchParams
  const supabase = await createSupabaseServer()

  // All seasons for the dropdown.
  const { data: seasonsData } = await supabase
    .from('seasons')
    .select('id, name, season_number, status')
    .order('season_number', { ascending: false })

  const seasons = (seasonsData ?? []) as Pick<
    Season,
    'id' | 'name' | 'season_number' | 'status'
  >[]

  const seasonScope = seasonParam || 'all'

  let query = supabase
    .from('pre_registrations')
    .select('id, email, utm_source, utm_medium, utm_campaign, referrer, season_id, status, created_at')
    .order('created_at', { ascending: false })

  if (seasonScope !== 'all') {
    query = query.eq('season_id', seasonScope)
  }

  const { data } = await query

  const seasonLabelMap = new Map<string, string>()
  for (const s of seasons) {
    seasonLabelMap.set(s.id, `${s.name} (#${s.season_number})`)
  }

  const rows: PreRegRow[] = (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    utm_source: r.utm_source,
    utm_medium: r.utm_medium,
    utm_campaign: r.utm_campaign,
    referrer: r.referrer,
    season_id: r.season_id,
    season_label: r.season_id
      ? seasonLabelMap.get(r.season_id) ?? r.season_id
      : '—',
    status: r.status,
    created_at: r.created_at,
  }))

  return (
    <PreRegistrationsView
      seasons={seasons}
      selectedSeasonScope={seasonScope}
      rows={rows}
    />
  )
}
