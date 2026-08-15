'use server'

// platform_config generic editor. value_type is the single source of truth
// for what shape a key's value can take (lib/settings-validate.ts) -- this
// action rejects a mismatch instead of storing it, then records the change
// via the atomic update_platform_config() RPC so the value write and its
// history row never split (HQ 2026-08-15: the whole point of this screen is
// that a change is never missing its "who/when/what -> what" record).

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { validateConfigValue } from '@/lib/settings-validate'

export type UpdateConfigState = { ok: true; noop?: boolean } | { ok: false; error: string }

export async function updateConfigValueAction(key: string, rawValue: string): Promise<UpdateConfigState> {
  const admin_profile = await requireAdmin()
  const admin = createSupabaseAdmin()

  const { data: existing, error: readErr } = await admin
    .from('platform_config')
    .select('value, value_type')
    .eq('key', key)
    .single()
  if (readErr || !existing) return { ok: false, error: `unknown key "${key}"` }

  const result = validateConfigValue(existing.value_type, rawValue)
  if (!result.ok) return { ok: false, error: result.error }

  if (result.normalized === existing.value) return { ok: true, noop: true }

  const { error } = await admin.rpc('update_platform_config', {
    p_key: key,
    p_new_value: result.normalized,
    p_admin_id: admin_profile.id,
    p_admin_email: admin_profile.email,
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/settings')
  return { ok: true }
}

// Korean description editor. No value_type gate (description_ko is free text
// for any key), but the SAME RPC as the value save, so a description edit
// gets the identical who/when/what -> what history row (HQ 2026-08-15: TK
// edits this himself now instead of asking us to translate on demand, and
// that only works if it is trustworthy the same way value edits are).
export async function updateConfigDescriptionKoAction(key: string, koText: string): Promise<UpdateConfigState> {
  const admin_profile = await requireAdmin()
  const admin = createSupabaseAdmin()

  const { data: existing, error: readErr } = await admin
    .from('platform_config')
    .select('description_ko')
    .eq('key', key)
    .single()
  if (readErr || !existing) return { ok: false, error: `unknown key "${key}"` }

  const normalized = koText.trim()
  if (normalized === (existing.description_ko ?? '')) return { ok: true, noop: true }

  const { error } = await admin.rpc('update_platform_config', {
    p_key: key,
    p_new_value: normalized,
    p_admin_id: admin_profile.id,
    p_admin_email: admin_profile.email,
    p_field: 'description_ko',
  })
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/settings')
  return { ok: true }
}
