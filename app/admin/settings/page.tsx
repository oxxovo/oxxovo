// /admin/settings -- generic platform_config editor (HQ 2026-08-15, item [C]1).
// service-role only (platform_config is REVOKE'd from authenticated/anon, same
// as every other admin platform_config reader -- see lib/partners.ts header).

import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { AdminPageHeader } from '../AdminPageHeader'
import { SettingsView, type ConfigRow, type HistoryRow } from './SettingsView'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  await requireAdmin()
  const admin = createSupabaseAdmin()

  const { data: configData, error: configErr } = await admin
    .from('platform_config')
    .select('key, value, value_type, description, updated_at')
    .order('key')
  if (configErr) throw new Error(`platform_config read failed: ${configErr.message}`)

  const rows: ConfigRow[] = (configData ?? []).map((r) => ({
    key: r.key as string,
    value: r.value as string,
    valueType: r.value_type as string,
    description: (r.description as string | null) ?? null,
    updatedAt: r.updated_at as string,
  }))

  const { data: historyData } = await admin
    .from('platform_config_history')
    .select('key, value_type, old_value, new_value, changed_by_email, changed_at')
    .order('changed_at', { ascending: false })
    .limit(100)

  const history: HistoryRow[] = (historyData ?? []).map((r) => ({
    key: r.key as string,
    valueType: r.value_type as string,
    oldValue: r.old_value as string | null,
    newValue: r.new_value as string,
    changedByEmail: r.changed_by_email as string,
    changedAt: r.changed_at as string,
  }))

  return (
    <div className="p-8 max-w-5xl">
      <AdminPageHeader
        title="Settings"
        subtitle="platform_config -- every operator-set value in one place. Type is enforced by value_type (bool/int/decimal/text); switches ending in _enabled ask for a second confirm before saving."
      />
      <SettingsView rows={rows} history={history} />
    </div>
  )
}
