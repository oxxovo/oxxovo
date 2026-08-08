'use client'

// DESIGN PREVIEW ONLY -- hardcoded demo cards, no DB. Lets the lobby card design
// be reviewed (all 4 status modes) without touching production data. The real
// lobby (home page) stays driven by seasons_public and hides when 0 cards.
// Safe to leave in; it reads nothing and clearly labels itself as demo.

import { LobbyCardView } from '@/app/_components/LobbySection'
import { type LobbyCard } from '@/lib/lobby'

// Far-future ISO targets so the countdowns always show a value in the preview.
// ★phase is set per card because 'live' covers three of them -- the demo picks
// 'voting' so the C-4 copy work has the ambiguous case on screen to look at.
const DEMO: LobbyCard[] = [
  {
    id: 'demo-upcoming',
    displayName: 'OXXOVO Season 1',
    theme: 'Neon Dreams',
    posterUrl: null, // gradient + theme fallback
    prizePool: 2000,
    prizeFirst: 1200,
    mode: 'upcoming',
    phase: 'upcoming',
    countdownTargetKind: 'application_open',
    countdownTargetIso: '2026-12-01T00:00:00Z',
    lobbyFeatured: true,
  },
  {
    id: 'demo-accepting',
    displayName: 'Cyber Seoul Open',
    theme: 'A rainy neon alley at night',
    posterUrl: '/arena_image.png', // demonstrates poster image path
    prizePool: 5000,
    prizeFirst: 3000,
    mode: 'accepting',
    phase: 'accepting',
    countdownTargetKind: 'application_close',
    countdownTargetIso: '2026-09-15T00:00:00Z',
    lobbyFeatured: false,
  },
  {
    id: 'demo-live',
    displayName: 'Grand Final Arena',
    theme: 'Final Render',
    posterUrl: null,
    prizePool: 10000,
    prizeFirst: 6000,
    mode: 'live',
    phase: 'voting',
    countdownTargetKind: 'vote_end',
    countdownTargetIso: '2026-10-01T00:00:00Z',
    lobbyFeatured: false,
  },
  {
    id: 'demo-ended',
    displayName: 'Genesis Season 0',
    theme: 'The First 100',
    posterUrl: null,
    prizePool: 3000,
    prizeFirst: 1800,
    mode: 'ended',
    phase: 'results',
    countdownTargetKind: null,
    countdownTargetIso: null,
    lobbyFeatured: false,
  },
]

export default function LobbyPreviewPage() {
  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <div className="border-b border-amber-400/30 bg-amber-400/10 px-6 py-3 text-center text-[12px] font-bold uppercase tracking-[0.16em] text-amber-300">
        Design preview — demo data, not real tournaments
      </div>
      <section className="max-w-6xl mx-auto px-6 md:px-12 py-16">
        <div className="text-center mb-12">
          <p className="inline-flex items-center gap-2.5 mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[#b66cff]">
            <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
            Tournaments
          </p>
          <h2 className="text-3xl md:text-4xl font-black">Lobby card states</h2>
          <p className="mt-2 text-sm text-white/50">
            upcoming · accepting · live · ended (one with a poster image, the rest use the gradient fallback)
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {DEMO.map((c) => (
            <LobbyCardView key={c.id} card={c} />
          ))}
        </div>
      </section>
    </main>
  )
}
