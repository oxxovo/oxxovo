'use client'

import Link from 'next/link'
import { useT } from '@/lib/admin-i18n'
import { type Season } from '@/lib/seasons'

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  draft: 'bg-white/10 text-white/60 border-white/20',
  closed: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  completed: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
}

export function SeasonsListView({
  seasons,
  errorMessage,
  showDeleted,
}: {
  seasons: Season[]
  errorMessage: string | null
  showDeleted: boolean
}) {
  const t = useT()

  const localizedStatus = (status: string) => {
    if (status === 'active' || status === 'draft' || status === 'closed' || status === 'completed') {
      return t.status[status]
    }
    return status
  }

  return (
    <div className="p-8 max-w-6xl">
      <header className="flex items-baseline justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black mb-1">{t.seasons_list.title}</h1>
          <p className="text-sm text-white/40">{t.seasons_list.subtitle}</p>
        </div>
        <Link
          href="/admin/seasons/new"
          className="px-5 py-2.5 rounded bg-gradient-to-br from-[#ff4444] to-[#cc3333] text-white font-bold text-sm hover:brightness-110 transition"
        >
          {t.seasons_list.new_season}
        </Link>
      </header>

      {showDeleted && (
        <div className="mb-6 px-4 py-3 rounded border border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-300">
          {t.seasons_list.deleted_banner}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 px-4 py-3 rounded border border-[#ff4444]/30 bg-[#ff4444]/10 text-sm text-[#ff8888]">
          {t.seasons_list.load_failed(errorMessage)}
        </div>
      )}

      <div className="border border-white/10 rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3 font-bold">{t.seasons_list.col_name}</th>
              <th className="text-left px-4 py-3 font-bold">{t.seasons_list.col_number}</th>
              <th className="text-left px-4 py-3 font-bold">{t.seasons_list.col_status}</th>
              <th className="text-right px-4 py-3 font-bold">{t.seasons_list.col_prize_pool}</th>
              <th className="text-right px-4 py-3 font-bold">{t.seasons_list.col_capacity}</th>
              <th className="text-right px-4 py-3 font-bold">{t.seasons_list.col_top_n}</th>
              <th className="text-left px-4 py-3 font-bold">{t.seasons_list.col_apps_open}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {seasons.map((s) => (
              <tr key={s.id} className="hover:bg-white/[.03]">
                <td className="px-4 py-3 font-bold">{s.name}</td>
                <td className="px-4 py-3 text-white/60">{s.season_number}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${
                      STATUS_STYLES[s.status] ?? STATUS_STYLES.draft
                    }`}
                  >
                    {localizedStatus(s.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-white/80">
                  ${Number(s.total_prize_pool).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-white/80">
                  {s.max_applicants.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-white/80">{s.top_n_advance}</td>
                <td className="px-4 py-3 text-white/60 text-xs">
                  {s.application_open_at
                    ? new Date(s.application_open_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/seasons/${s.id}`}
                    className="text-[#ff8844] hover:underline text-xs"
                  >
                    {t.seasons_list.edit}
                  </Link>
                </td>
              </tr>
            ))}
            {seasons.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-white/40 text-sm">
                  {t.seasons_list.empty_prefix}
                  <Link href="/admin/seasons/new" className="text-[#ff8844] hover:underline">
                    {t.seasons_list.empty_link}
                  </Link>
                  {t.seasons_list.empty_suffix}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
