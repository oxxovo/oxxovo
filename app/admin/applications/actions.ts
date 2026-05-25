'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseServer } from '@/lib/supabase-server'

export type AdminActionState = {
  ok: boolean
  messageKey?: 'notes_saved' | 'status_saved' | 'award_saved'
  errorMessage?: string
}

// Mirrors the genesis_applications.status CHECK constraint (7 values).
// 'verifying' / 'eligible' are set automatically by the oxxovo-scoring system;
// 'selected' / 'awarded' are set manually by admins.
const ALLOWED_STATUS = [
  'pending',
  'waitlist',
  'verifying',
  'eligible',
  'selected',
  'awarded',
  'rejected',
] as const
type AppStatus = (typeof ALLOWED_STATUS)[number]

export async function saveAdminNotes(id: string, notes: string): Promise<AdminActionState> {
  await requireAdmin()
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('genesis_applications')
    .update({ admin_notes: notes })
    .eq('id', id)
  if (error) return { ok: false, errorMessage: error.message }

  revalidatePath(`/admin/applications/${id}`)
  return { ok: true, messageKey: 'notes_saved' }
}

export async function saveStatus(id: string, status: string): Promise<AdminActionState> {
  await requireAdmin()
  if (!ALLOWED_STATUS.includes(status as AppStatus)) {
    return { ok: false, errorMessage: `Invalid status: ${status}` }
  }
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('genesis_applications')
    .update({ status })
    .eq('id', id)
  if (error) return { ok: false, errorMessage: error.message }

  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${id}`)
  return { ok: true, messageKey: 'status_saved' }
}

export async function saveAwardRank(
  id: string,
  rank: number | null,
): Promise<AdminActionState> {
  await requireAdmin()
  if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 99)) {
    return { ok: false, errorMessage: 'Award rank must be 1-99 or null' }
  }
  const supabase = await createSupabaseServer()
  const { error } = await supabase
    .from('genesis_applications')
    .update({ award_rank: rank })
    .eq('id', id)
  if (error) return { ok: false, errorMessage: error.message }

  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${id}`)
  revalidatePath('/admin/contacts')
  return { ok: true, messageKey: 'award_saved' }
}
