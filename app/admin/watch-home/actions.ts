'use server'

// Admin toggle for the watch_as_home flag (root = Watch vs landing). Admin only.
//
// Writes through the update_platform_config() RPC, same as /admin/settings: the
// RPC reads value_type itself (platform_config.value_type is NOT NULL with no
// default, so a hand-built upsert() of {key, value} fails even when the row
// exists -- that is what broke this toggle) and records who/when/what -> what in
// platform_config_history. Do not go back to a direct upsert.

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type SetWatchAsHomeState = { ok: true } | { ok: false; error: string }

export async function setWatchAsHome(on: boolean): Promise<SetWatchAsHomeState> {
  const profile = await requireAdmin()
  const admin = createSupabaseAdmin()
  const { error } = await admin.rpc('update_platform_config', {
    p_key: 'watch_as_home',
    p_new_value: on ? 'true' : 'false',
    p_admin_id: profile.id,
    p_admin_email: profile.email,
    // Explicit: without p_field the call is ambiguous between the two live overloads (PGRST203).
    p_field: 'value',
  })
  if (error) {
    console.error('[admin] setWatchAsHome failed:', error.message)
    return { ok: false, error: error.message }
  }
  revalidatePath('/')
  revalidatePath('/admin/watch-home')
  return { ok: true }
}
