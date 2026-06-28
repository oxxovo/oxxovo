// /admin/comments -- comment moderation queue. Reported comments first (highest
// report_count), so staff triage what the community flagged. Hide is soft
// (status='hidden'), never a delete. Admin-only.

import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getDisplayNames } from '@/lib/nickname'
import { ModerationRow, type ModComment } from './ModerationRow'

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
    authorName: names.get(r.user_id) ?? 'Creator',
    body: r.body,
    status: r.status,
    reportCount: r.report_count,
    applicationId: r.application_id,
    round: r.round,
    createdAt: r.created_at,
  }))

  return (
    <main className="min-h-screen bg-[#030305] text-white px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-black">Comment moderation</h1>
        <p className="mt-2 text-sm text-white/50">
          Reported comments, most-reported first. Hide removes a comment from public view
          (it is kept, never deleted).
        </p>

        {comments.length === 0 ? (
          <p className="mt-10 text-sm text-white/40">No reported comments. 🎉</p>
        ) : (
          <table className="mt-8 w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                <th className="py-2 pr-3 font-semibold">Reports</th>
                <th className="py-2 pr-3 font-semibold">Author</th>
                <th className="py-2 pr-3 font-semibold">Comment</th>
                <th className="py-2 pr-3 font-semibold">Status</th>
                <th className="py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {comments.map((c) => (
                <ModerationRow key={c.id} c={c} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
