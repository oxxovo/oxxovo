import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'
import { type Season } from '@/lib/seasons'
import { DashboardView } from './DashboardView'

export default async function AdminDashboard() {
  const admin = await requireAdmin()
  const supabase = await createSupabaseServer()

  const { data: seasons } = await supabase
    .from('seasons')
    .select('*')
    .order('season_number', { ascending: false })

  const { count: applicationCount } = await supabase
    .from('genesis_applications')
    .select('*', { count: 'exact', head: true })

  return (
    <DashboardView
      adminName={admin.email.split('@')[0]}
      seasons={(seasons ?? []) as Season[]}
      applicationCount={applicationCount ?? 0}
    />
  )
}
