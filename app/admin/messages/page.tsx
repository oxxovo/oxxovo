// /admin/messages -- out-of-scope chatbot questions collected by /api/chat, for
// team follow-up. Service-role read (admin pages are behind requireAdmin). The
// table may not exist yet (migration: reports/chat_logs_migration_2026-06.sql),
// so a missing table degrades to an empty state rather than a 500.

import { requireAdmin } from '@/lib/admin-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { MessagesView, type ChatLogRow } from './MessagesView'

export const dynamic = 'force-dynamic'

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

  return <MessagesView rows={rows} tableMissing={tableMissing} />
}
