'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { promoteToManager, demoteManager } from '@/lib/managers'

export type PromoteActionState = {
  ok: boolean
  errorKey?: 'email_required' | 'user_not_found' | 'already_admin' | 'already_manager' | 'failed'
  errorMessage?: string
  email?: string
}

// Super-only: promote an existing user to manager. requireAdmin gates this so a
// manager can never add another manager.
export async function promoteAction(email: string): Promise<PromoteActionState> {
  await requireAdmin()
  const trimmed = (email ?? '').trim()
  if (!trimmed) return { ok: false, errorKey: 'email_required' }

  const r = await promoteToManager(trimmed)
  if (!r.ok) return { ok: false, errorKey: r.error, errorMessage: r.detail }

  revalidatePath('/admin/managers')
  return { ok: true, email: r.email }
}

export type DemoteActionState = {
  ok: boolean
  errorKey?: 'not_a_manager' | 'failed'
  errorMessage?: string
}

// Super-only: demote a manager back to a normal user.
export async function demoteAction(userId: string): Promise<DemoteActionState> {
  await requireAdmin()
  const r = await demoteManager(userId)
  if (!r.ok) return { ok: false, errorKey: r.error, errorMessage: r.detail }

  revalidatePath('/admin/managers')
  return { ok: true }
}
