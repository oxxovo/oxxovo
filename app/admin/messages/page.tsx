// /admin/messages -- out-of-scope chatbot questions collected by /api/chat, for
// team follow-up. Service-role read (admin pages are behind requireAdmin). The
// table may not exist yet (migration: reports/chat_logs_migration_2026-06.sql),
// so a missing table degrades to an empty state rather than a 500.

import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

type ChatLogRow = {
  id: string
  ip: string | null
  question: string
  reply: string | null
  created_at: string
}

export default async function MessagesPage() {
  await requireAdmin()

  let rows: ChatLogRow[] = []
  let tableMissing = false
  try {
    const admin = createSupabaseAdmin()
    const { data, error } = await admin
      .from('chat_logs')
      .select('id, ip, question, reply, created_at')
      .eq('out_of_scope', true)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) tableMissing = true
    else rows = (data ?? []) as ChatLogRow[]
  } catch {
    tableMissing = true
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-black text-white mb-1">Help Assistant — Out-of-scope</h1>
      <p className="text-sm text-white/40 mb-6">
        Questions the chatbot could not answer from the knowledge base (pointed to info@oxxovo.com).
      </p>

      {tableMissing ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/[.05] px-5 py-4 text-sm text-amber-200/80">
          Collection not enabled yet — run <code>reports/chat_logs_migration_2026-06.sql</code> in Supabase.
        </div>
      ) : rows.length === 0 ? (
        <p className="text-white/40 text-sm">No out-of-scope questions yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-white/10 bg-white/[.03] px-5 py-4">
              <div className="flex items-center justify-between gap-4 mb-2">
                <span className="text-xs text-white/40">
                  {new Date(r.created_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT
                </span>
                <span className="text-[10px] text-white/25">{r.ip ?? '—'}</span>
              </div>
              <p className="text-sm text-white/90 mb-2">{r.question}</p>
              {r.reply && <p className="text-xs text-white/40 whitespace-pre-wrap">{r.reply}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
