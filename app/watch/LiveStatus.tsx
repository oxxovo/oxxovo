'use client'

// The "living" part of the Current Competition Hero block. Renders the round
// line (with a blinking LIVE status dot while applications are open), a live
// application-deadline countdown, and the three headline stats that tick up as
// real submissions arrive.
//
// Honesty (TK): NOTHING here is fake motion. The LIVE dot is a status light --
// lit ONLY while the application window is genuinely open (isAccepting). The
// stats change only when a real entry lands (polled from /api/watch/stats). The
// countdown counts to the real application_close_at. When not accepting, we stop
// polling and drop the dot/countdown -- the numbers simply sit still (correct).

import { useEffect, useState } from 'react'
import { CountdownTimer } from '@/app/_components/CountdownTimer'

type Stats = { entries: number; creators: number; countries: number }

const POLL_MS = 20_000

export function LiveStatus({
  seasonId,
  roundName,
  initialStats,
  closeAtISO,
  isAccepting,
}: {
  seasonId: string
  roundName: string
  initialStats: Stats
  closeAtISO: string | null
  isAccepting: boolean
}) {
  const [stats, setStats] = useState<Stats>(initialStats)

  // Poll only while the competition is live-accepting. Server render already
  // supplied initialStats, so there is no empty flash before the first tick.
  useEffect(() => {
    if (!isAccepting) return
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`/api/watch/stats?season=${encodeURIComponent(seasonId)}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = await res.json()
        if (alive && data && typeof data.entries === 'number') {
          setStats({ entries: data.entries, creators: data.creators, countries: data.countries })
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
  }, [seasonId, isAccepting])

  const closeAt = closeAtISO ? new Date(closeAtISO) : null
  const showCountdown = isAccepting && closeAt != null && closeAt.getTime() > Date.now()

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

// Small inline stat: icon + big number + small label (matches 8_final: prominent
// numbers, no boxed tiles). Moved here from Arena so the numbers can live-update.
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
