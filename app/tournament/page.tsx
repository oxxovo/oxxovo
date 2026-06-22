// /tournament -- public season landing. The destination for marketing QR codes
// and bio links (TK + 메인 제니, 2026-06-21). Server-rendered so the poster +
// season info are in the initial HTML (SEO + share previews). Every operating
// number is read live from the seasons row + membership config -- no hardcode
// ([[feedback-no-hardcode]]). Structured info (dates/prize/access) is final;
// the narrative marketing copy is placeholder until 제니3 delivers it (marked
// COPY-PENDING below).

import Link from 'next/link'
import {
  getCurrentSeason,
  advanceCountLabel,
  formatAccessCopy,
  formatDeadlinePT,
  type Season,
} from '@/lib/seasons'
import { getMembershipLandingData } from '@/app/membership/actions'
import type { MembershipLandingData } from '@/app/membership/types'
import { formatFooterStatusLine } from '@/lib/ip-info'
import { ChatWidget } from '@/app/_components/ChatWidget'

export const dynamic = 'force-dynamic'

// CTA target by where we are in the application window: before open -> notify,
// during -> apply, after close -> waitlist for the next season.
function resolveCta(season: Season): { href: string; label: string } {
  const now = Date.now()
  const openAt = season.application_open_at ? new Date(season.application_open_at).getTime() : null
  const closeAt = season.application_close_at ? new Date(season.application_close_at).getTime() : null
  const isOpen = openAt != null && now >= openAt && (closeAt == null || now < closeAt)
  if (isOpen) return { href: '/apply', label: `Apply to ${season.name}` }
  if (openAt != null && now < openAt) return { href: '/pre-register', label: 'Get notified when applications open' }
  return { href: '/pre-register', label: 'Join the waitlist' }
}

function ScheduleRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#b66cff]/80">{label}</span>
      <span className="text-sm text-white/80 text-right">{value}</span>
    </div>
  )
}

export default async function TournamentPage() {
  const [season, mem] = await Promise.all([
    getCurrentSeason(),
    getMembershipLandingData(),
  ])

  if (!season) {
    return (
      <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center">
        <p className="text-white/40 text-sm">No active tournament right now. Check back soon.</p>
      </main>
    )
  }

  const cta = resolveCta(season)
  const m: MembershipLandingData = mem
  const accessCopy = formatAccessCopy({
    seasonName: season.name,
    entryFee: Number(season.entry_fee),
    membershipEnabled: m.enabled,
    price: m.price,
    interval: m.interval,
    foundingMonths: m.foundingMonths,
    foundingCap: m.founding.cap,
  })
  const themeText = season.season_theme && season.season_theme.trim().length > 0
    ? season.season_theme
    : 'Open theme — create anything'

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      {/* ---- Hero: poster + title ------------------------------------------ */}
      <section className="px-6 pt-24 pb-12 md:pt-32 border-b border-white/5">
        <div className="max-w-5xl mx-auto grid gap-10 md:grid-cols-[minmax(0,360px)_1fr] md:items-center">
          {/* Poster (poster_url from admin; placeholder until 제니3 uploads). */}
          <div className="mx-auto w-full max-w-[360px]">
            {season.poster_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={season.poster_url}
                alt={`${season.display_name ?? season.name} poster`}
                className="w-full rounded-xl border border-white/10 shadow-[0_0_40px_rgba(139,34,255,.25)]"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[.03] text-center text-xs uppercase tracking-[0.2em] text-white/30">
                Poster coming soon
              </div>
            )}
          </div>

          <div>
            <p className="mb-4 inline-flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
              <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
              OXXOVO Tournament
            </p>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">
              {season.display_name ?? season.name}
            </h1>

            {/* COPY-PENDING (제니3): hero tagline / one-line pitch. */}
            <p className="mt-5 max-w-xl text-lg text-white/70 leading-relaxed">
              An AI-native video tournament. Create, compete, and earn your place.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                href={cta.href}
                className="inline-block bg-gradient-to-br from-[#7d23ff] to-[#6220dc] px-8 py-4 rounded-lg font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] hover:brightness-110 transition"
              >
                {cta.label}
              </Link>
              <Link href="/rules" className="text-sm text-white/50 hover:text-white/80 transition">
                Read the rules →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Info: all live from the seasons row + membership config -------- */}
      <section className="px-6 py-16 md:py-20">
        <div className="max-w-5xl mx-auto grid gap-10 md:grid-cols-2">
          {/* Schedule */}
          <div>
            <h2 className="mb-5 text-[12px] font-bold uppercase tracking-[0.2em] text-[#8B22FF]">Schedule</h2>
            <ScheduleRow label="Applications open" value={formatDeadlinePT(season.application_open_at)} />
            <ScheduleRow label="Applications close" value={formatDeadlinePT(season.application_close_at)} />
            <ScheduleRow label="Main round" value={formatDeadlinePT(season.main_round_start_at)} />
            <ScheduleRow label="Winners announced" value={formatDeadlinePT(season.awards_announcement_at)} />
            <p className="mt-4 text-xs text-white/40">
              Video length: {season.application_video_min_seconds}–{season.application_video_max_seconds} seconds. Up to {season.max_applicants.toLocaleString()} applicants.
            </p>
          </div>

          {/* Prize + advancement */}
          <div>
            <h2 className="mb-5 text-[12px] font-bold uppercase tracking-[0.2em] text-[#8B22FF]">Prizes</h2>
            <div className="rounded-lg border border-[#8b22ff]/20 bg-[#8b22ff]/[.04] px-5 py-4">
              <p className="text-3xl font-black text-white">${Number(season.total_prize_pool).toLocaleString()}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-[#b66cff]">Total prize pool</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-white/40 text-xs uppercase">1st</p><p className="font-bold">${Number(season.prize_first).toLocaleString()}</p></div>
                <div><p className="text-white/40 text-xs uppercase">2nd</p><p className="font-bold">${Number(season.prize_second).toLocaleString()}</p></div>
                <div><p className="text-white/40 text-xs uppercase">3rd</p><p className="font-bold">${Number(season.prize_third).toLocaleString()}</p></div>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/60 leading-relaxed">
              The {advanceCountLabel(season)} advance to the Main Round as Finalists.
            </p>
          </div>

          {/* Theme */}
          <div>
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[#8B22FF]">Theme</h2>
            <p className="text-sm text-white/70 leading-relaxed">{themeText}</p>
          </div>

          {/* Cost / access */}
          <div>
            <h2 className="mb-3 text-[12px] font-bold uppercase tracking-[0.2em] text-[#8B22FF]">What it costs</h2>
            <p className="text-sm text-white/70 leading-relaxed">{accessCopy}</p>
          </div>
        </div>

        {/* COPY-PENDING (제니3): longer narrative / why-compete body goes here. */}
        <div className="max-w-5xl mx-auto mt-12 rounded-lg border border-dashed border-white/10 bg-white/[.02] px-6 py-5 text-sm text-white/50 leading-relaxed">
          Why compete on OXXOVO, the experience, and the story — copy pending.
        </div>
      </section>

      {/* ---- CTA ----------------------------------------------------------- */}
      <section className="px-6 py-16 md:py-24 text-center border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <div className="text-xs tracking-[0.3em] text-[#8B22FF] mb-6">READY?</div>
          <h2 className="text-3xl md:text-5xl font-black mb-8 tracking-tight">Enter the arena.</h2>
          <Link
            href={cta.href}
            className="inline-block bg-[#8B22FF] hover:bg-[#9B32FF] text-white font-bold tracking-[0.2em] px-10 py-5 transition"
          >
            {cta.label.toUpperCase()}
          </Link>
        </div>
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
