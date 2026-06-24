import { requireStaff } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { type Season } from '@/lib/seasons'
import { EmailsView, type EmailLogRow } from './EmailsView'

// email_logs has RLS allowing admins, but it's read via the service-role
// client here so the page consistently shows EVERY row regardless of how
// the RLS policy evolves.

const PAGE_SIZE = 50

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string; page?: string }>
}) {
  await requireStaff()
  const { season: seasonParam, page: pageParam } = await searchParams
  const supabase = createSupabaseAdmin()

  const { data: seasonsData } = await supabase
    .from('seasons')
    .select('id, name, season_number, status')
    .order('season_number', { ascending: false })

  const seasons = (seasonsData ?? []) as Pick<
    Season,
    'id' | 'name' | 'season_number' | 'status'
  >[]
  const seasonScope = seasonParam || 'all'

  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('email_logs')
    .select(
      'id, application_id, season_id, to_email, template_key, language, subject, status, error_message, metadata, sent_at',
      { count: 'exact' },
    )
    .order('sent_at', { ascending: false })
    .range(from, to)

  if (seasonScope !== 'all') {
    query = query.eq('season_id', seasonScope)
  }

  const { data, count } = await query

  let totalQuery = supabase.from('email_logs').select('status', { count: 'exact', head: false })
  if (seasonScope !== 'all') {
    totalQuery = totalQuery.eq('season_id', seasonScope)
  }
  const { data: allStatuses } = await totalQuery

  const stats = {
    total: count ?? 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  }
  for (const r of allStatuses ?? []) {
    const s = (r as { status: string }).status
    if (s === 'sent') stats.sent++
    else if (s === 'failed') stats.failed++
    else if (s === 'skipped') stats.skipped++
  }

  const rows: EmailLogRow[] = (data ?? []) as EmailLogRow[]

  return (
    <EmailsView
      seasons={seasons}
      selectedSeasonScope={seasonScope}
      rows={rows}
      stats={stats}
      page={page}
      pageSize={PAGE_SIZE}
      totalCount={count ?? 0}
    />
  )
}
