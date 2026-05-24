'use client'

import Link from 'next/link'
import { useT } from '@/lib/admin-i18n'
import { type Season } from '@/lib/seasons'

export function DashboardView({
  adminName,
  seasons,
  applicationCount,
}: {
  adminName: string
  seasons: Season[]
  applicationCount: number
}) {
  const t = useT()
  const currentSeason = seasons.find((s) => s.status === 'active') ?? seasons[0] ?? null

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-10">
        <h1 className="text-3xl font-black mb-1">{t.dashboard.title}</h1>
        <p className="text-sm text-white/40">{t.dashboard.welcome(adminName)}</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <Stat label={t.dashboard.stat_total_seasons} value={seasons.length} />
        <Stat
          label={t.dashboard.stat_current_season}
          value={currentSeason?.name ?? '—'}
          sub={
            currentSeason
              ? t.dashboard.season_label(
                  currentSeason.season_number,
                  localizedStatus(currentSeason.status, t.status),
                )
              : ''
          }
        />
        <Stat label={t.dashboard.stat_total_applicants} value={applicationCount} />
      </section>

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-bold">{t.dashboard.recent_seasons}</h2>
          <Link href="/admin/seasons" className="text-xs text-[#ff8844] hover:underline">
            {t.dashboard.view_all}
          </Link>
        </div>

        <div className="border border-white/10 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-bold">{t.dashboard.col_name}</th>
                <th className="text-left px-4 py-3 font-bold">{t.dashboard.col_number}</th>
                <th className="text-left px-4 py-3 font-bold">{t.dashboard.col_status}</th>
                <th className="text-right px-4 py-3 font-bold">{t.dashboard.col_prize_pool}</th>
                <th className="text-right px-4 py-3 font-bold">{t.dashboard.col_capacity}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {seasons.slice(0, 5).map((s) => (
                <tr key={s.id} className="hover:bg-white/[.03]">
                  <td className="px-4 py-3 font-bold">{s.name}</td>
                  <td className="px-4 py-3 text-white/60">{s.season_number}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} label={localizedStatus(s.status, t.status)} />
                  </td>
                  <td className="px-4 py-3 text-right text-white/80">
                    ${Number(s.total_prize_pool).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-white/80">
                    {s.max_applicants.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/seasons/${s.id}`}
                      className="text-[#ff8844] hover:underline text-xs"
                    >
                      {t.dashboard.edit}
                    </Link>
                  </td>
                </tr>
              ))}
              {seasons.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/40 text-sm">
                    {t.dashboard.empty_prefix}
                    <Link href="/admin/seasons/new" className="text-[#ff8844] hover:underline">
                      {t.dashboard.empty_link}
                    </Link>
                    {t.dashboard.empty_suffix}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-4">{t.dashboard.quick_actions}</h2>
        <div className="flex gap-3 flex-wrap">
          <Link
            href="/admin/seasons/new"
            className="px-5 py-3 rounded bg-gradient-to-br from-[#ff4444] to-[#cc3333] text-white font-bold text-sm hover:brightness-110 transition"
          >
            {t.dashboard.new_season}
          </Link>
          <Link
            href="/admin/seasons"
            className="px-5 py-3 rounded border border-white/15 text-white/80 font-bold text-sm hover:border-[#ff8844] hover:text-white transition"
          >
            {t.dashboard.manage_seasons}
          </Link>
        </div>
      </section>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="border border-white/10 rounded p-5 bg-white/[.02]">
      <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">{label}</div>
      <div className="text-2xl font-black text-white">{value}</div>
      {sub && <div className="text-xs text-white/40 mt-1">{sub}</div>}
    </div>
  )
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const colorMap: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    draft: 'bg-white/10 text-white/60 border-white/20',
    closed: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    completed: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  }
  const cls = colorMap[status] ?? 'bg-white/10 text-white/60 border-white/20'
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${cls}`}
    >
      {label}
    </span>
  )
}

function localizedStatus(
  status: string,
  map: { active: string; draft: string; closed: string; completed: string },
): string {
  if (status === 'active' || status === 'draft' || status === 'closed' || status === 'completed') {
    return map[status]
  }
  return status
}
