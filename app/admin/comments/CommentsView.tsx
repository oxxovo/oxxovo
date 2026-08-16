'use client'

import { useT } from '@/lib/admin-i18n'
import { AdminPageHeader } from '../AdminPageHeader'
import { ModerationRow, type ModComment } from './ModerationRow'

export function CommentsView({ comments }: { comments: ModComment[] }) {
  const t = useT()

  return (
    <main className="min-h-screen bg-[#030305] text-white px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <AdminPageHeader title={t.comments.title} subtitle={t.comments.subtitle} />

        {comments.length === 0 ? (
          <p className="mt-10 text-sm text-white/40">{t.comments.empty}</p>
        ) : (
          <table className="mt-8 w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                <th className="py-2 pr-3 font-semibold">{t.comments.col_reports}</th>
                <th className="py-2 pr-3 font-semibold">{t.comments.col_author}</th>
                <th className="py-2 pr-3 font-semibold">{t.comments.col_comment}</th>
                <th className="py-2 pr-3 font-semibold">{t.comments.col_status}</th>
                <th className="py-2 font-semibold">{t.comments.col_action}</th>
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
