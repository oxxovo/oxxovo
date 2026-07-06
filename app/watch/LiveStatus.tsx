'use client'

// The "living" part of the Current Competition Hero block. It reflects the real
// season stage (from DB dates), never fake motion (TK):
//   - Accepting (application window open): 🔴 blinking LIVE status dot + a live
//     countdown to application_close_at.
//   - Judging (window closed, Triple-AI scoring in progress): ⚡ a real progress
//     bar {scored}/{total} that fills as the scoring worker finishes each video.
//   - Always: the three headline stats (Entries / Creators / Countries), polled
//     so they tick up as real submissions land.
//
// The LIVE dot is a status light (lit only while genuinely accepting). The stats,
// the judging count, and the countdown target are all real DB values. When
// neither accepting nor judging, polling stops and the numbers simply sit still.

import { useEffect, useState } from 'react'
import { CountdownTimer } from '@/app/_components/CountdownTimer'

type Stats = { entries: number; creators: number; countries: number }
type Judging = { scored: number; total: number }

const POLL_MS = 20_000

export function LiveStatus({
  seasonId,
  roundName,
  initialStats,
  closeAtISO,
  isAccepting,
  showJudging,
  initialJudging,
}: {
  seasonId: string
  roundName: string
  initialStats: Stats
  closeAtISO: string | null
  isAccepting: boolean
  showJudging: boolean
  initialJudging: Judging
}) {
  const [stats, setStats] = useState<Stats>(initialStats)
  const [judging, setJudging] = useState<Judging>(initialJudging)

  // Poll while the competition is live-accepting OR mid-judging, so both the
  // stats and the judging bar update in place. Server render supplied the
  // initial values, so there is no empty flash before the first tick.
  useEffect(() => {
    if (!isAccepting && !showJudging) return
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`/api/watch/stats?season=${encodeURIComponent(seasonId)}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const d = await res.json()
        if (!alive) return
        if (typeof d.entries === 'number') {
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
  }, [seasonId, isAccepting, showJudging])

  const closeAt = closeAtISO ? new Date(closeAtISO) : null
  const showCountdown = isAccepting && closeAt != null && closeAt.getTime() > Date.now()
  const pct = judging.total > 0 ? Math.round((judging.scored / judging.total) * 100) : 0

  return (
    <>
      <h3 className="mt-1.5 flex items-center gap-2 text-lg font-bold text-[#a855ff]">
        {isAccepting && <LiveDot />}
        {roundName}
      </h3>

      {showCountdown && (
        <p className="mt-1 text-[12px] font-semibold text-white/70">
          ⏱ Applications close in{' '}
          <CountdownTimer targetAt={closeAt!} className="font-bold text-white" />
        </p>
      )}

      {showJudging && (
        <div className="mt-2 max-w-[300px]">
          <p className="text-[12px] font-semibold text-white/80">
            ⚡ Triple-AI judging{' '}
            <span className="font-black text-white">
              {judging.scored}/{judging.total}
            </span>
          </p>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8b22ff] to-[#a855ff] transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-6">
        <InlineStat icon="🎬" n={stats.entries} label="Entries" />
        <InlineStat icon="👥" n={stats.creators} label="Creators" />
        <InlineStat icon="🌍" n={stats.countries} label="Countries" />
      </div>
    </>
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
      <span className="text-[11px] font-black uppercase tracking-wider text-red-500">Live</span>
    </span>
  )
}

// Small inline stat: icon + big number + small label (8_final: prominent numbers,
// no boxed tiles).
function InlineStat({ icon, n, label }: { icon: string; n: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="text-lg opacity-80">
        {icon}
      </span>
      <div className="leading-none">
        <div className="text-2xl font-black text-white">{n.toLocaleString()}</div>
        <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/55">{label}</div>
      </div>
    </div>
  )
}
