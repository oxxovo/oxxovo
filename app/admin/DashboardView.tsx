'use client'

import Link from 'next/link'
import { useT } from '@/lib/admin-i18n'
import { type Season } from '@/lib/seasons'
import { AdminPageHeader } from './AdminPageHeader'

export type ScoringStats = {
  none: number
  low: number
  medium: number
  high: number
  completed: number
  in_progress: number
  failed: number
  // ⑥G gap 1. `scorable` is the denominator the other three never had, and
  // `unjudged` is entries with NO scoring row at all -- absent, not pending.
  // See lib/scoring-coverage.ts for why it is an intersection.
  scorable: number
  judged: number
  unjudged: number
}

export function DashboardView({
  adminName,
  seasons,
  applicationCount,
  scoringStats,
}: {
  adminName: string
  seasons: Season[]
  applicationCount: number
  scoringStats: ScoringStats | null
}) {
  const t = useT()
  const currentSeason = seasons.find((s) => s.status === 'active') ?? seasons[0] ?? null

  return (
    <div className="p-8 max-w-5xl">
      <AdminPageHeader title={t.dashboard.title} subtitle={t.dashboard.welcome(adminName)} />

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

      {/* Scoring stats for current season — confidence distribution + flagged urgency */}
      {scoringStats && currentSeason && (
        <ScoringStatsBlock
          season={currentSeason}
          stats={scoringStats}
          flaggedCount={scoringStats.high}
        />
      )}

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

function ScoringStatsBlock({
  season,
  stats,
  flaggedCount,
}: {
  season: Season
  stats: ScoringStats
  flaggedCount: number
}) {
  const totalJudged = stats.completed
  const hasUrgent = flaggedCount > 0
  // ★An entry the scorer never received is the only kind an operator can still
  // do something about while judging is running, so it gets the loud tone --
  // louder than 'failed', which at least means the pipeline saw it.
  const hasGap = stats.unjudged > 0
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-lg font-bold">
          {season.name} · Scoring progress
        </h2>
        {hasUrgent && (
          <Link
            href="/admin/applications?segment=flagged"
            className="text-xs text-red-300 hover:underline"
          >
            🚩 {flaggedCount} need review →
          </Link>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat label={`Judged / ${stats.scorable} with a film`} value={totalJudged} tone="default" />
        <MiniStat label="In progress" value={stats.in_progress} tone="indigo" />
        <MiniStat label="Failed" value={stats.failed} tone="red-soft" />
        <MiniStat
          label="★Never enqueued"
          value={stats.unjudged}
          tone={hasGap ? 'red' : 'default'}
        />
      </div>
      {hasGap && (
        <p className="mt-2 text-xs text-red-300">
          {stats.unjudged}편이 영상은 있는데 채점 행이 없습니다 — 실패가 아니라 <strong>큐에 들어가지
          않은 것</strong>입니다. 실패 목록에는 나타나지 않습니다.
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <MiniStat label="Flagged" value={flaggedCount} tone={hasUrgent ? 'red' : 'default'} />
      </div>
      <div className="grid grid-cols-4 gap-3 mt-3">
        <MiniStat label="Confidence: none" value={stats.none} tone="default" />
        <MiniStat label="Confidence: low" value={stats.low} tone="default" />
        <MiniStat label="Confidence: medium" value={stats.medium} tone="amber" />
        <MiniStat label="Confidence: high" value={stats.high} tone={stats.high > 0 ? 'red' : 'default'} />
      </div>
    </section>
  )
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'default' | 'indigo' | 'amber' | 'red' | 'red-soft'
}) {
  const toneClass =
    tone === 'red'
      ? 'border-red-500/40 bg-red-500/10 text-red-200'
      : tone === 'red-soft'
        ? 'border-red-500/20 bg-red-500/5 text-red-300/80'
        : tone === 'amber'
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          : tone === 'indigo'
            ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-200'
            : 'border-white/10 bg-white/[.02] text-white/80'
  return (
    <div className={`border rounded p-3 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">{label}</div>
      <div className="text-xl font-black">{value}</div>
    </div>
  )
}
