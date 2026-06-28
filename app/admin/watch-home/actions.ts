'use server'

// Admin toggle for the watch_as_home flag (root = Watch vs landing). Admin only.

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export async function setWatchAsHome(on: boolean): Promise<{ ok: boolean }> {
  await requireAdmin()
  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('platform_config')
    .upsert({ key: 'watch_as_home', value: on ? 'true' : 'false' }, { onConflict: 'key' })
  if (error) {
    console.error('[admin] setWatchAsHome failed:', error.message)
    return { ok: false }
  }
  revalidatePath('/')
  revalidatePath('/admin/watch-home')
  return { ok: true }
}
