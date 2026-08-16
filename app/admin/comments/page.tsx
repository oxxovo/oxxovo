// /admin/comments -- comment moderation queue. Reported comments first (highest
// report_count), so staff triage what the community flagged. Hide is soft
// (status='hidden'), never a delete. Admin-only.

import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getDisplayNames } from '@/lib/nickname'
import { CommentsView } from './CommentsView'
import { type ModComment } from './ModerationRow'

export const dynamic = 'force-dynamic'

export default async function AdminCommentsPage() {
  await requireAdmin()
  const admin = createSupabaseAdmin()

  // Reported comments (report_count > 0), most-reported first. Hidden ones stay
  // listed so they can be unhidden.
  const { data } = await admin
    .from('watch_comments')
    .select('id, user_id, application_id, round, body, status, report_count, created_at')
    .gt('report_count', 0)
    .order('report_count', { ascending: false })
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as {
    id: string
    user_id: string
    application_id: string
    round: string
    body: string
    status: 'visible' | 'hidden'
    report_count: number
    created_at: string
  }[]
  const names = await getDisplayNames(rows.map((r) => r.user_id))

  const comments: ModComment[] = rows.map((r) => ({
    id: r.id,
    authorName: names.get(r.user_id) ?? null,
    body: r.body,
    status: r.status,
    reportCount: r.report_count,
    applicationId: r.application_id,
    round: r.round,
    createdAt: r.created_at,
  }))

  return <CommentsView comments={comments} />
}
