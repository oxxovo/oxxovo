'use client'

import { useEffect } from 'react'
import { useT } from '@/lib/admin-i18n'
import { type ProfileApplication } from './actions'

type Rank = 1 | 2 | 3

const RANK_THEME: Record<Rank, {
  medal: string
  titleColor: string
  cardBorder: string
  cardBg: string
  prizeColor: string
  logoGlow: string
  confettiColors: string[]
}> = {
  1: {
    medal: '🥇',
    titleColor: 'text-[#FFD700]',
    cardBorder: 'border-[#FFD700]/40',
    cardBg:
      'bg-gradient-to-br from-[#FFD700]/[.12] via-[#FFA500]/[.06] to-transparent',
    prizeColor: 'text-[#FFD700] drop-shadow-[0_0_25px_rgba(255,215,0,0.5)]',
    logoGlow: 'drop-shadow-[0_0_60px_rgba(255,215,0,0.65)]',
    confettiColors: ['#FFD700', '#FFA500', '#FFEE58', '#FFFFFF'],
  },
  2: {
    medal: '🥈',
    titleColor: 'text-[#E8E8E8]',
    cardBorder: 'border-[#C0C0C0]/40',
    cardBg:
      'bg-gradient-to-br from-[#C0C0C0]/[.12] via-[#A0A0A0]/[.06] to-transparent',
    prizeColor: 'text-[#E8E8E8] drop-shadow-[0_0_20px_rgba(220,220,220,0.5)]',
    logoGlow: 'drop-shadow-[0_0_60px_rgba(232,232,232,0.65)]',
    confettiColors: ['#C0C0C0', '#E8E8E8', '#FFFFFF', '#B8B8B8'],
  },
  3: {
    medal: '🥉',
    titleColor: 'text-[#E89858]',
    cardBorder: 'border-[#CD7F32]/40',
    cardBg:
      'bg-gradient-to-br from-[#CD7F32]/[.12] via-[#B87333]/[.06] to-transparent',
    prizeColor: 'text-[#E89858] drop-shadow-[0_0_20px_rgba(205,127,50,0.5)]',
    logoGlow: 'drop-shadow-[0_0_60px_rgba(232,152,88,0.65)]',
    confettiColors: ['#CD7F32', '#B87333', '#E89858', '#FFD700'],
  },
}

export function WinnerCelebrationCard({ app }: { app: ProfileApplication }) {
  const t = useT()
  const rank = app.award_rank as Rank | null

  // Fire confetti once on mount when the celebration is visible. The dynamic
  // import keeps canvas-confetti out of the SSR bundle and only loads it for
  // actual winners.
  useEffect(() => {
    if (!rank || rank < 1 || rank > 3) return
    const colors = RANK_THEME[rank].confettiColors
    let cancelled = false
    const timeouts: ReturnType<typeof setTimeout>[] = []

    const t0 = setTimeout(() => {
      if (cancelled) return
      import('canvas-confetti').then(({ default: confetti }) => {
        if (cancelled) return

        // Burst 1 — left/right sides
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { x: 0.2, y: 0.6 },
          colors,
          ticks: 200,
        })
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { x: 0.8, y: 0.6 },
          colors,
          ticks: 200,
        })

        // Burst 2 — big center after 250ms
        timeouts.push(
          setTimeout(() => {
            if (cancelled) return
            confetti({
              particleCount: 220,
              spread: 120,
              origin: { x: 0.5, y: 0.35 },
              colors,
              startVelocity: 55,
              ticks: 250,
            })
          }, 250),
        )

        // Burst 3 — fall-from-top sparkles after 700ms
        timeouts.push(
          setTimeout(() => {
            if (cancelled) return
            confetti({
              particleCount: 80,
              spread: 180,
              origin: { x: 0.5, y: 0 },
              colors,
              startVelocity: 25,
              gravity: 1.2,
              ticks: 300,
            })
          }, 700),
        )
      })
    }, 600)
    timeouts.push(t0)

    return () => {
      cancelled = true
      timeouts.forEach(clearTimeout)
    }
  }, [rank])

  if (!rank || rank < 1 || rank > 3) return null

  const theme = RANK_THEME[rank]
  const subtitleMap: Record<Rank, string> = {
    1: t.profile.celebration_subtitle_1st,
    2: t.profile.celebration_subtitle_2nd,
    3: t.profile.celebration_subtitle_3rd,
  }
  const prizeMap: Record<Rank, number> = {
    1: app.season_prize_first,
    2: app.season_prize_second,
    3: app.season_prize_third,
  }
  const rankLabelMap: Record<Rank, string> = {
    1: '1ST PLACE',
    2: '2ND PLACE',
    3: '3RD PLACE',
  }

  const subtitle = subtitleMap[rank]
  const prize = prizeMap[rank]
  const rankLabel = rankLabelMap[rank]
  const isFoundingSeason = app.season_number === 0

  return (
    <section
      className={`mt-6 relative overflow-hidden rounded-2xl border ${theme.cardBorder} ${theme.cardBg} px-6 py-10`}
    >
      <div className="relative z-10 text-center space-y-4">
        {/* OXXOVO brand mark — large, rank-tinted glow. Wordmark is embedded
            in the logo itself, so no separate text needed. */}
        <div className="flex justify-center mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/oxxovo_logo.png"
            alt="OXXOVO"
            className={`h-56 sm:h-72 w-auto transition-all ${theme.logoGlow}`}
          />
        </div>

        {/* Medal + rank label on one line — the headline of the card */}
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          <span className="text-7xl sm:text-8xl leading-none animate-[pulse_3s_ease-in-out_infinite]">
            {theme.medal}
          </span>
          <span
            className={`text-4xl sm:text-5xl font-black tracking-wider ${theme.titleColor}`}
          >
            {rankLabel}
          </span>
        </div>

        {/* Subtitle */}
        <p className="text-sm text-white/60 max-w-md mx-auto">{subtitle}</p>

        {/* Prize amount */}
        <div className="pt-3">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">
            {t.profile.celebration_prize_label}
          </div>
          <div
            className={`text-5xl sm:text-6xl font-black tabular-nums ${theme.prizeColor}`}
          >
            ${prize.toLocaleString()}
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          {isFoundingSeason && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-br from-[#8b22ff]/25 to-[#6220dc]/25 border border-[#8b22ff]/50 text-[#d4a7ff] text-[11px] font-bold uppercase tracking-wider">
              <span aria-hidden>✦</span>
              {t.profile.celebration_founding_creator}
            </span>
          )}
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-[11px]">
            {t.profile.celebration_season_label(app.season_number, app.season_name)}
          </span>
        </div>
      </div>

      {/* Soft radial highlight behind the medal */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-40 pointer-events-none opacity-60"
        style={{
          background:
            'radial-gradient(ellipse at center top, rgba(255,255,255,0.08), transparent 70%)',
        }}
      />
    </section>
  )
}
