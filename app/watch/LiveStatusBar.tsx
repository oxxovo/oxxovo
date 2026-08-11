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
// The bar width is the real scored/total ratio. A shimmer sweeps L->R OVER the
// fill for "판정 중" life, but it lives INSIDE the fill (overflow-hidden), so it
// is clipped to the real progress -- never implying more than is judged -- and
// it stops once judging completes.

import { useEffect, useState } from 'react'
import { CountdownTimer } from '@/app/_components/CountdownTimer'
import { useT } from '@/lib/admin-i18n'

type Stats = { entries: number; creators: number; countries: number }
type Judging = { scored: number; total: number }

const POLL_MS = 20_000

export function LiveStatusBar({
  seasonNumber,
  roundName,
  stage,
  seasonId,
  initialStats,
  closeAtISO,
  isAccepting,
  initialJudging,
  revealAtISO,
  theme,
  voteOpen,
  voteEndISO,
}: {
  seasonNumber: number
  roundName: string
  // Banner lifecycle stage (getBannerStage). At 'voting'/'results' the judging
  // row is suppressed so the card never shows "심사 중" while the banner says the
  // winners are announced. Absent (older callers) -> old behavior.
  stage?: string
  seasonId: string
  initialStats: Stats
  closeAtISO: string | null
  isAccepting: boolean
  initialJudging: Judging
  // Set in the finalist-pending window: switches the deadline row to
  // "본선 진출작 공개까지" counting to the reveal date.
  revealAtISO?: string | null
  // Public main-round theme LABEL (season.main_round_theme_label, e.g. "Cosmetic
  // Commercial Film"). Non-null only from the "Judging Complete" stage onward
  // (the caller gates it) so it reads as a come-back teaser before the main
  // round. NOT main_round_theme -- that is the full brief (901 chars for season
  // 0) and this is a one-line slot; the full text lives on /rules.
  theme?: string | null
  // Community vote window: while open, the panel shows a "투표 마감까지" countdown
  // to voteEndISO so the audience feels the deadline (not just a static date).
  voteOpen?: boolean
  voteEndISO?: string | null
}) {
  const t = useT()
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
  // Finalist-reveal countdown takes over the deadline row once finalists are set.
  const revealAt = revealAtISO ? new Date(revealAtISO) : null
  const showReveal = revealAt != null && revealAt.getTime() > Date.now()
  // Vote-deadline countdown: only while the community vote window is genuinely open.
  const voteEnd = voteEndISO ? new Date(voteEndISO) : null
  const showVoteCountdown = !!voteOpen && voteEnd != null && voteEnd.getTime() > Date.now()
  // Once the lifecycle has moved past judging (community voting / results
  // announced), the card must NOT keep showing "심사 중 N/N" -- that contradicts
  // the top banner. Suppress the judging row at those stages. (A안 stopgap.)
  const pastJudging = stage === 'voting' || stage === 'results'
  const showJudging = judging.total > 0 && !pastJudging
  const pct = judging.total > 0 ? Math.round((judging.scored / judging.total) * 100) : 0
  // Shimmer runs only while judging is genuinely in progress; it stops at 완료.
  const judgingComplete = judging.total > 0 && judging.scored >= judging.total
  const isMain = roundName.toLowerCase().includes('main')
  const closeLabel = t.watch.live_close_label(isMain)

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
                {t.watch.live_judging(judgingComplete)}
              </span>
              <span className="text-[15px] font-semibold text-white">
                {judging.scored} / {judging.total}
              </span>
            </div>
            <div className="h-[7px] overflow-hidden rounded-full bg-[#2a1a47]">
              <div
                className="relative h-full overflow-hidden rounded-full bg-[#8b22ff] transition-[width] duration-700 ease-out"
                style={{ width: `${pct}%` }}
              >
                {!judgingComplete && (
                  <span aria-hidden className="watch-shimmer absolute inset-y-0 left-0 w-1/2" />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Deadline countdown (only while genuinely accepting) */}
      {(showCountdown || showReveal) && (
        <>
          <div className="h-px bg-[#33235a]" />
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-[#9b8bc4]">{showReveal ? '🏆' : '🕐'}</span>
            <span className="text-[12px] text-[#9b8bc4]">
              {showReveal ? t.watch.live_reveal_label : closeLabel}
            </span>
            <CountdownTimer
              targetAt={showReveal ? revealAt! : closeAt!}
              className="ml-auto text-[15px] font-semibold tabular-nums text-white"
            />
          </div>
        </>
      )}

      {/* Community vote deadline -- only while voting is genuinely open. Gives
          the audience the urgency the static "voting closes" banner text can't. */}
      {showVoteCountdown && (
        <>
          <div className="h-px bg-[#33235a]" />
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-[#e24b4a]">🔥</span>
            <span className="text-[12px] text-[#9b8bc4]">{t.watch.live_vote_label}</span>
            <CountdownTimer
              targetAt={voteEnd!}
              className="ml-auto text-[15px] font-semibold tabular-nums text-white"
            />
          </div>
        </>
      )}

      {/* Main-round theme (public brief). Purple gradient panel so it reads as
          its own beat between the countdown and the country count. Label reads
          as a teaser ("다음 라운드") while finalist-pending, then the live brief
          once the main round is on. (TK 2026-07-12) */}
      {theme && (
        <div className="-mx-1 rounded-lg bg-gradient-to-r from-[#8b22ff]/25 via-[#8b22ff]/10 to-transparent px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <span aria-hidden>🎬</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#c9b4f5]">
              {isMain ? t.watch.live_theme_main : t.watch.live_theme_next}
            </span>
          </div>
          <p className="mt-1 text-[15px] font-bold leading-snug text-white">{theme}</p>
        </div>
      )}

      {/* Countries */}
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-[#9b8bc4]">🌍</span>
        <span className="text-[15px] font-semibold text-white">{stats.countries}</span>
        <span className="text-[12px] text-[#9b8bc4]">{t.watch.live_countries_suffix}</span>
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
