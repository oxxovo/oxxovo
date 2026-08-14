import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { type Season } from '@/lib/seasons'
import { SeasonsListView } from './SeasonsListView'

export default async function SeasonsListPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>
}) {
  await requireAdmin()
  const { deleted } = await searchParams
  const supabase = createSupabaseAdmin()
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .order('season_number', { ascending: false })

  return (
    <SeasonsListView
      seasons={(data ?? []) as Season[]}
      errorMessage={error?.message ?? null}
      showDeleted={!!deleted}
    />
  )
}
