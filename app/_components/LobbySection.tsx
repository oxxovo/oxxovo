'use client'

import { useEffect, useState } from 'react'
import { loadLobbyTournaments } from './lobby-actions'
import { type LobbyCard, type LobbyMode } from '@/lib/lobby'

// TOURNAMENTS section for the home page (below the hero). Cards come from a
// server action (mode is server-authoritative); the client only renders and
// ticks the countdown. If there are no cards the whole section is hidden.
export function LobbySection() {
  const [cards, setCards] = useState<LobbyCard[] | null>(null)

  useEffect(() => {
    let cancelled = false
    loadLobbyTournaments().then((c) => {
      if (!cancelled) setCards(c)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Hidden until loaded and only when there is at least one card (v1: no
  // separate enable switch -- zero cards == no section).
  if (!cards || cards.length === 0) return null

  return (
    <section className="relative px-6 md:px-12 py-20 max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <p className="inline-flex items-center gap-2.5 mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[#b66cff]">
          <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
          Tournaments
        </p>
        <h2 className="text-3xl md:text-4xl font-black">Compete on OXXOVO</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((c) => (
          <LobbyCardView key={c.id} card={c} />
        ))}
      </div>
    </section>
  )
}

const MODE_BADGE: Record<LobbyMode, { label: string; cls: string } | null> = {
  upcoming: { label: 'COMING SOON', cls: 'bg-white/10 text-white/70 border-white/20' },
  accepting: { label: 'OPEN', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  live: { label: 'LIVE', cls: 'bg-[#ff4444]/20 text-[#ff8888] border-[#ff4444]/50' },
  ended: { label: 'ENDED', cls: 'bg-white/5 text-white/40 border-white/10' },
}

export function LobbyCardView({ card }: { card: LobbyCard }) {
  const ended = card.mode === 'ended'
  const badge = MODE_BADGE[card.mode]

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0a14] transition hover:border-[#8b22ff]/50 ${
        ended ? 'opacity-60' : ''
      }`}
    >
      {/* Poster or themed gradient fallback */}
      <div className="relative aspect-video w-full overflow-hidden">
        {card.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.posterUrl} alt={card.displayName} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2a0e52] via-[#3d1580] to-[#1a0633] p-5 text-center">
            <span className="text-lg font-black uppercase tracking-wide text-white/90 drop-shadow-[0_0_18px_rgba(139,34,255,.6)]">
              {card.theme || card.displayName}
            </span>
          </div>
        )}
        {badge && (
          <span
            className={`absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}
          >
            {card.mode === 'live' && (
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff5555] animate-pulse" />
            )}
            {badge.label}
          </span>
        )}
      </div>

      <div className="p-5">
        <h3 className="text-base font-black text-white">{card.displayName}</h3>
        {card.theme && <p className="mt-0.5 text-sm text-white/55 line-clamp-1">{card.theme}</p>}

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-wider text-white/40">Prize pool</span>
          <span className="text-lg font-black text-[#b66cff]">
            ${card.prizePool.toLocaleString()}
          </span>
        </div>

        {card.countdownTargetIso && !ended && (
          <Countdown targetIso={card.countdownTargetIso} mode={card.mode} />
        )}

        <div className="mt-4">
          <Cta card={card} />
        </div>
      </div>
    </div>
  )
}

function Cta({ card }: { card: LobbyCard }) {
  switch (card.mode) {
    case 'upcoming':
      return (
        <a
          href="/pre-register"
          className="block w-full rounded-lg border border-[#8b22ff]/50 py-2.5 text-center text-sm font-bold text-[#b66cff] transition hover:bg-[#8b22ff]/10"
        >
          Pre-register
        </a>
      )
    case 'accepting':
      return (
        <a
          href="/apply"
          className="block w-full rounded-lg bg-gradient-to-br from-[#7d23ff] to-[#6220dc] py-2.5 text-center text-sm font-extrabold text-white shadow-[0_0_18px_rgba(139,34,255,.35)] transition hover:brightness-110"
        >
          Enter now
        </a>
      )
    case 'live':
      return (
        <div className="w-full rounded-lg border border-[#ff4444]/30 bg-[#ff4444]/[.06] py-2.5 text-center text-sm font-bold text-[#ff8888]">
          In progress
        </div>
      )
    case 'ended':
    default:
      return (
        <div className="w-full rounded-lg border border-white/10 py-2.5 text-center text-sm font-bold text-white/40">
          Results soon
        </div>
      )
  }
}

const CD_LABEL: Record<LobbyMode, string> = {
  upcoming: 'Opens in',
  accepting: 'Closes in',
  live: 'Ends in',
  ended: '',
}

function Countdown({ targetIso, mode }: { targetIso: string; mode: LobbyMode }) {
  const [left, setLeft] = useState<string | null>(null)
  useEffect(() => {
    const target = new Date(targetIso).getTime()
    const tick = () => {
      const d = target - Date.now()
      if (d <= 0) {
        setLeft('—')
        return
      }
      const days = Math.floor(d / 86400000)
      const h = Math.floor((d % 86400000) / 3600000)
      const m = Math.floor((d % 3600000) / 60000)
      const s = Math.floor((d % 60000) / 1000)
      setLeft(days > 0 ? `${days}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetIso])

  if (!left) return null
  return (
    <div className="mt-2 flex items-baseline gap-2">
      <span className="text-[10px] uppercase tracking-wider text-white/40">{CD_LABEL[mode]}</span>
      <span className="font-mono text-sm text-white/85 tabular-nums">{left}</span>
    </div>
  )
}
