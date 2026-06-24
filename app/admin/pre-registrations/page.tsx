import { requireStaff } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { PreRegistrationsView, type PreRegRow } from './PreRegistrationsView'
import { type Season } from '@/lib/seasons'

export default async function PreRegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>
}) {
  // Managers may view the list; only super (admin) gets the bulk CSV export.
  const staff = await requireStaff()
  const { season: seasonParam } = await searchParams
  const supabase = await createSupabaseServer()

  // All seasons for the dropdown (not PII — read through the user-context
  // client like the rest of the admin console).
  const { data: seasonsData } = await supabase
    .from('seasons')
    .select('id, name, season_number, status')
    .order('season_number', { ascending: false })

  const seasons = (seasonsData ?? []) as Pick<
    Season,
    'id' | 'name' | 'season_number' | 'status'
  >[]

  const seasonScope = seasonParam || 'all'

  // pre_registrations holds personal data (email + attribution). Read it
  // through the service-role client so we can REVOKE every anon/authenticated
  // privilege on the table at the DB layer (defense-in-depth): the table
  // becomes reachable only by the service role, with RLS still enabled as a
  // backstop. requireAdmin() above is what gates access to this page.
  const admin = createSupabaseAdmin()
  let query = admin
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
      isSuper={staff.role === 'admin'}
    />
  )
}
