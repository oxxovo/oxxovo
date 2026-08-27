// /tournament -- the public tournament gallery (marketing QR + bio-link target).
// Shows every publicly visible season as a poster card; each links to its
// dynamic detail at /tournament/[id]. Cards come from the seasons table only --
// no hardcode ([[feedback-no-hardcode]]). getLobbyTournaments excludes drafts,
// so the current season (pre-launch season_0 is still draft) is merged in via
// getCurrentSeason so the landing is never empty.

import Link from 'next/link'
import {
  fetchWinnerCounts,
  getLobbyTournaments,
  isRehearsalFixture,
  seasonToLobbyCard,
  MODE_BADGE as BADGE,
  PHASE_BADGE,
  type LobbyCard,
} from '@/lib/lobby'
import { getCurrentSeason } from '@/lib/seasons'
import { formatFooterStatusLine } from '@/lib/ip-info'
import { ChatWidget } from '@/app/_components/ChatWidget'

export const dynamic = 'force-dynamic'

export default async function TournamentGalleryPage() {
  const now = new Date()
  const [cards, current] = await Promise.all([getLobbyTournaments(now), getCurrentSeason()])

  // Ensure the current season appears even if it is a draft (getLobbyTournaments
  // filters drafts out; getCurrentSeason surfaces pre-launch season_0).
  // ★The merge below bypasses getLobbyTournaments' filtering entirely -- it
  // exists to surface a DRAFT current season, and a draft is exactly what that
  // filter drops. So the fixture rule has to be applied here too, or a rehearsal
  // season that getCurrentSeason happens to pick lands on the public gallery
  // through the one door that has no lock.
  let all: LobbyCard[] = cards
  if (current && !isRehearsalFixture(current) && !all.some((c) => c.id === current.id)) {
    // Its own winner count: getLobbyTournaments fetched counts only for the
    // seasons it returned, and this one is by definition not among them. Passing
    // 0 here would work today and become a card that can never say "ended" the
    // moment C-2 lands -- the kind of default that is right by accident.
    const winners = await fetchWinnerCounts([current.id])
    all = [seasonToLobbyCard(current, now, winners[current.id] ?? 0), ...all]
  }

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <section className="px-6 pt-24 pb-10 md:pt-32 border-b border-white/5">
        <div className="max-w-5xl mx-auto text-center">
          <p className="inline-flex items-center gap-2.5 mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[#b66cff]">
            <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
            Tournaments
          </p>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight">Compete on OXXOVO</h1>
          <p className="mt-5 max-w-2xl mx-auto text-lg text-white/70 leading-relaxed">
            The AI video tournament where creators compete — and skill decides. Pick a season to see
            its schedule, prizes, and how to enter.
          </p>
        </div>
      </section>

      <section className="px-6 py-16 max-w-6xl mx-auto">
        {all.length === 0 ? (
          <p className="text-center text-white/40 text-sm">No tournaments to show yet. Check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {all.map((c) => (
              <GalleryCard key={c.id} card={c} />
            ))}
          </div>
        )}
      </section>

      <footer className="px-6 py-12 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs tracking-[0.2em] text-white/40">
          <Link href="/" className="hover:text-white transition">← OXXOVO</Link>
          <div>OXXOVO&trade; &middot; Las Vegas, Nevada, USA</div>
        </div>
        <div className="max-w-5xl mx-auto mt-4 text-center text-[10px] tracking-[0.15em] text-white/30">
          OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. &middot; {formatFooterStatusLine()}
        </div>
      </footer>

      <ChatWidget />
    </main>
  )
}

// A poster card linking to the season's detail page. The poster already carries
// the prize/timeline, so the body is just the title + a "View details" affordance.
function GalleryCard({ card }: { card: LobbyCard }) {
  const badge = PHASE_BADGE[card.phase] ?? BADGE[card.mode]
  const ended = card.mode === 'ended'
  return (
    <Link
      href={`/tournament/${card.id}`}
      className={`group relative block overflow-hidden rounded-2xl border border-white/10 bg-[#0c0a14] transition hover:border-[#8b22ff]/50 ${
        ended ? 'opacity-60' : ''
      }`}
    >
      {/* Card image is a uniform vertical thumbnail (3:4, top-aligned so the
          poster's title/key art shows). It is intentionally cropped -- the full
          poster lives on the detail page + lightbox (/tournament/[id]). */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#0c0a14]">
        {card.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.posterUrl} alt={card.displayName} className="h-full w-full object-cover object-top" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2a0e52] via-[#3d1580] to-[#1a0633] p-5 text-center">
            <span className="text-lg font-black uppercase tracking-wide text-white/90 drop-shadow-[0_0_18px_rgba(139,34,255,.6)]">
              {card.theme || card.displayName}
            </span>
          </div>
        )}
        <span
          className={`absolute top-3 left-3 inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 p-5">
        <h3 className="text-base font-black text-white">{card.displayName}</h3>
        <span className="text-sm font-bold text-[#b66cff] transition group-hover:translate-x-0.5">
          View details →
        </span>
      </div>
    </Link>
  )
}
