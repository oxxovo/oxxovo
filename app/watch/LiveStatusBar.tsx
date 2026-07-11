'use client'

// The "LIVE" panel on the left of the Watch hero (박스형). One dark panel that
// reflects the real competition state, every value from the DB (polled ~20s),
// never fake motion (TK). Stacked vertically:
//   🔴 LIVE · {round}  S{n}
//   ── ⚡ Triple-AI 심사 중  {scored}/{total} + real progress bar
//   ── 🕐 {round} 마감까지  {countdown}
//   🌍 {countries} 개국 참가
//
// Each row shows only when its data is genuinely live, and the panel transitions
// between stages on its own:
//   - LIVE dot + countdown  -> while the application window is truly open.
//   - judging bar           -> whenever the Triple-AI pool is non-zero. Judging is
//     rolling (the worker scores entries as they land), so this can run WHILE the
//     window is still open -- prelim can be "LIVE" and "13/21 판정" at once.
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
    <div className="flex h-full flex-col gap-[18px] rounded-xl border border-[#3a2560]/70 bg-[#150c24] p-5">
      {/* LIVE · round + season pill */}
      <div className="flex flex-wrap items-center gap-2">
        {isAccepting && <LiveDot />}
        <span className="text-[15px] text-[#cfc6e6]">
          {isAccepting ? '· ' : ''}
          {roundName}
        </span>
        <span className="ml-0.5 rounded-full bg-[#2a1a47] px-2 py-0.5 text-[11px] font-bold text-[#c3a9f5]">
          S{seasonNumber}
        </span>
      </div>

      {/* Triple-AI judging progress (real scored/total) */}
      {showJudging && (
        <>
          <div className="h-px bg-[#33235a]" />
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[14px] text-[#e7e0f5]">
                <span aria-hidden className="text-[#8b22ff]">⚡</span>
                Triple-AI 심사 중
              </span>
              <span className="text-[15px] font-semibold text-white">
                {judging.scored} / {judging.total}
              </span>
            </div>
            <div className="h-[7px] overflow-hidden rounded-full bg-[#2a1a47]">
              <div
                className="h-full rounded-full bg-[#8b22ff] transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </>
      )}

      {/* Deadline countdown (only while genuinely accepting) */}
      {showCountdown && (
        <>
          <div className="h-px bg-[#33235a]" />
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-[#9b8bc4]">🕐</span>
            <span className="text-[12px] text-[#9b8bc4]">{closeLabel}</span>
            <CountdownTimer targetAt={closeAt!} className="ml-auto text-[15px] font-semibold tabular-nums text-white" />
          </div>
        </>
      )}

      {/* Countries */}
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-[#9b8bc4]">🌍</span>
        <span className="text-[15px] font-semibold text-white">{stats.countries}</span>
        <span className="text-[12px] text-[#9b8bc4]">개국 참가</span>
      </div>
    </div>
  )
}

// Blinking status light -- pure CSS (Tailwind animate-ping), not data motion.
function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e24b4a] opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#e24b4a]" />
      </span>
      <span className="text-[16px] font-medium tracking-wide text-[#e24b4a]">LIVE</span>
    </span>
  )
}
