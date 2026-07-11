'use client'

// The boxed "LIVE" status bar at the top of Watch (박스형). One dark panel that
// reflects the real competition state, every value from the DB (polled ~20s),
// never fake motion (TK):
//   row 1:  🔴 LIVE · {round}   |   ⚡ Triple-AI 심사 중 {scored}/{total} + bar
//           |   🕐 {round} 마감까지 {countdown}
//   row 2:  🌍 {countries} 개국
//
// Each cell shows only when its data is genuinely live, and the box transitions
// between stages on its own:
//   - LIVE dot + countdown  -> while the application window is truly open.
//   - judging bar           -> whenever the Triple-AI pool is non-zero. Judging is
//     rolling (the worker scores entries as they land), so this can run WHILE the
//     window is still open -- prelim can be "LIVE" and "20/21 판정" at once.
//   - country count         -> always (aggregate, no per-entry data).
// The bar width is the real scored/total ratio, not an animation.

import { useEffect, useState } from 'react'
import { CountdownTimer } from '@/app/_components/CountdownTimer'

type Stats = { entries: number; creators: number; countries: number }
type Judging = { scored: number; total: number }

const POLL_MS = 20_000

export function LiveStatusBar({
  seasonNumber,
  roundName,
  seasonId,
  initialStats,
  closeAtISO,
  isAccepting,
  initialJudging,
}: {
  seasonNumber: number
  roundName: string
  seasonId: string
  initialStats: Stats
  closeAtISO: string | null
  isAccepting: boolean
  initialJudging: Judging
}) {
  const [stats, setStats] = useState<Stats>(initialStats)
  const [judging, setJudging] = useState<Judging>(initialJudging)

  // Poll the public aggregate endpoint so countries + judging tick in place. The
  // server render supplied the initial values, so there is no empty flash.
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`/api/watch/stats?season=${encodeURIComponent(seasonId)}`, { cache: 'no-store' })
        if (!res.ok) return
        const d = await res.json()
        if (!alive) return
        if (typeof d.countries === 'number') {
          setStats({ entries: d.entries, creators: d.creators, countries: d.countries })
        }
        if (typeof d.judgingTotal === 'number') {
          setJudging({ scored: d.judgingScored, total: d.judgingTotal })
        }
      } catch {
        /* transient network error -- keep the last good numbers */
      }
    }
    const id = setInterval(load, POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [seasonId])

  const closeAt = closeAtISO ? new Date(closeAtISO) : null
  const showCountdown = isAccepting && closeAt != null && closeAt.getTime() > Date.now()
  const showJudging = judging.total > 0
  const pct = judging.total > 0 ? Math.round((judging.scored / judging.total) * 100) : 0
  const isMain = roundName.toLowerCase().includes('main')
  const closeLabel = isMain ? '본선 마감까지' : '예선 마감까지'

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0714] px-5 py-4 shadow-[0_0_30px_rgba(139,34,255,.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-0">
        {/* LIVE · round + season pill */}
        <div className="flex items-center gap-2.5 md:shrink-0 md:pr-6">
          {isAccepting && <LiveDot />}
          <span className="text-[15px] font-bold text-[#f4f0ff]">
            {isAccepting ? '· ' : ''}
            {roundName}
          </span>
          <span className="ml-0.5 rounded border border-[#8b22ff]/70 bg-[#8b22ff]/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#a855ff]">
            S{seasonNumber}
          </span>
        </div>

        {/* Triple-AI judging progress (real scored/total) */}
        {showJudging && (
          <div className="min-w-0 flex-1 md:border-l md:border-white/10 md:px-6">
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-[#f5c542]">⚡</span>
              <span className="text-[12px] font-semibold text-white/70">Triple-AI 심사 중</span>
              <span className="ml-auto text-[13px] font-black text-white">
                {judging.scored} / {judging.total}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/12">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#8b22ff] to-[#c084fc] transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Deadline countdown (only while genuinely accepting) */}
        {showCountdown && (
          <div className="flex items-center gap-2 md:shrink-0 md:border-l md:border-white/10 md:pl-6">
            <span aria-hidden className="text-white/55">🕐</span>
            <div className="leading-tight">
              <div className="text-[11px] font-semibold text-white/55">{closeLabel}</div>
              <CountdownTimer targetAt={closeAt!} className="text-[15px] font-black tabular-nums text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Countries */}
      <div className="mt-3 flex items-center gap-1.5 border-t border-white/8 pt-3">
        <span aria-hidden className="text-base">🌍</span>
        <span className="text-[15px] font-black text-white">{stats.countries}</span>
        <span className="text-[12px] font-semibold text-white/55">개국</span>
      </div>
    </div>
  )
}

// Blinking status light -- pure CSS (Tailwind animate-ping), not data motion.
function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
      </span>
      <span className="text-[12px] font-black uppercase tracking-wider text-red-500">Live</span>
    </span>
  )
}
