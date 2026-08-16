'use client'

import { useT, useAdminLang } from '@/lib/admin-i18n'
import { AdminPageHeader } from '../AdminPageHeader'

export type ChatLogRow = {
  id: string
  ip: string | null
  question: string
  reply: string | null
  created_at: string
}

export function MessagesView({ rows, tableMissing }: { rows: ChatLogRow[]; tableMissing: boolean }) {
  const t = useT()
  const lang = useAdminLang()

  return (
    <div className="p-8">
      <AdminPageHeader title={t.messages.title} subtitle={t.messages.subtitle} />

      {tableMissing ? (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/[.05] px-5 py-4 text-sm text-amber-200/80">
          {t.messages.table_missing}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-white/40 text-sm">{t.messages.empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border border-white/10 bg-white/[.03] px-5 py-4">
              <div className="flex items-center justify-between gap-4 mb-2">
                <span className="text-xs text-white/40">
                  {/* Timezone stays fixed at PT regardless of language -- a log
                      timestamp is a correlation anchor, not prose (same
                      reasoning as PrelimHoldPanel's stamp()). Only the
                      locale's date/time FORMAT follows the toggle. */}
                  {new Date(r.created_at).toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US', {
                    timeZone: 'America/Los_Angeles',
                  })}{' '}
                  PT
                </span>
                <span className="text-[10px] text-white/25">{r.ip ?? t.messages.ip_fallback}</span>
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
