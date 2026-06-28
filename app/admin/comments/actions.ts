'use server'

// Admin comment moderation. Hide is a soft action (status='hidden', never a
// delete) so the record and its reports stay for audit. Admin-only.

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export type ModerationResult = { ok: true } | { ok: false; error: string }

export async function setCommentHidden(
  commentId: string,
  hidden: boolean,
): Promise<ModerationResult> {
  await requireAdmin()
  const admin = createSupabaseAdmin()
  const { data: row } = await admin
    .from('watch_comments')
    .select('application_id')
    .eq('id', commentId)
    .maybeSingle()

  const { error } = await admin
    .from('watch_comments')
    .update({ status: hidden ? 'hidden' : 'visible' })
    .eq('id', commentId)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/comments')
  if (row?.application_id) revalidatePath(`/watch/${row.application_id}`)
  return { ok: true }
}
