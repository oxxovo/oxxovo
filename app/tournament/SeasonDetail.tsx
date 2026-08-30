// Dynamic season detail -- ONE template for every season row (official S0..N,
// future teasers, and partner/Host tournaments). Every operating number and the
// season-specific narrative is read from the seasons row + membership config --
// no hardcode ([[feedback-no-hardcode]]). The only branches are data-driven:
//   - host_type 'partner' vs official  (Founding + membership copy)
//   - season_number === 0              (the first-season Founding campaign +
//                                        external-URL preliminary wording)
//   - community_vote_weight > 0        (audience vote in the main round)
// Adding a seasons row (official or Host) yields a detail page automatically.

import Link from 'next/link'
import { advanceCountLabel, formatDeadlinePT, resolveSeasonCta, type Season } from '@/lib/seasons'
import type { MembershipLandingData } from '@/app/membership/types'
import { formatFooterStatusLine } from '@/lib/ip-info'
import { PosterLightbox } from './PosterLightbox'

function ScheduleRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 py-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#b66cff]/80">{label}</span>
      <span className="text-sm text-white/80 text-right">{value}</span>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-[12px] font-bold uppercase tracking-[0.2em] text-[#8B22FF]">{children}</h2>
}

export function SeasonDetail({ season, mem }: { season: Season; mem: MembershipLandingData }) {
  const cta = resolveSeasonCta(season)
  const m: MembershipLandingData = mem

  // Data-driven branches (no per-season code paths -- [[feedback-no-hardcode]]).
  const isPartner = season.host_type === 'partner'
  const isFoundingSeason = !isPartner && season.season_number === 0
  const usesExternalUrlPrelim = season.season_number === 0 // S1+ create in Studio from the preliminary
  const hasAudienceVote = Number(season.community_vote_weight) > 0

  // Dynamic numbers with "TBA" fallback for unset values (future teasers).
  const hasPool = Number(season.total_prize_pool) > 0
  const poolText = hasPool ? `$${Number(season.total_prize_pool).toLocaleString()}` : 'TBA'
  const prizeText = (v: number | null | undefined) =>
    v != null && Number(v) > 0 ? `$${Number(v).toLocaleString()}` : 'TBA'
  const p1 = prizeText(season.prize_first)
  const p2 = prizeText(season.prize_second)
  const p3 = prizeText(season.prize_third)
  const cap = m.founding.cap
  const foundingTerm = m.foundingMonths === 12 ? '1-year' : `${m.foundingMonths}-month`
  const priceText = m.price != null ? `$${m.price.toFixed(2)}/${m.interval}` : '$19.99/month'
  const entryFee = Number(season.entry_fee)
  const feeLine = entryFee === 0
    ? `There is no entry fee for ${season.name}.`
    : `${season.name} has a $${entryFee.toLocaleString()} entry fee.`
  const advanceLabel = advanceCountLabel(season)
  const themeText = season.season_theme && season.season_theme.trim().length > 0
    ? season.season_theme
    : 'Open theme — create anything'
  const title = season.display_name && season.display_name.trim().length > 0
    ? season.display_name
    : season.name

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      {/* ---- [1] Hero: poster + title + tagline ---------------------------- */}
      <section className="px-6 pt-24 pb-12 md:pt-32 border-b border-white/5">
        <div className="max-w-5xl mx-auto grid gap-10 md:grid-cols-[minmax(0,460px)_1fr] md:items-center">
          {/* The poster is the hero -- shown large at its natural vertical ratio,
              click to open full-screen (PosterLightbox). */}
          <div className="mx-auto w-full max-w-[460px]">
            {season.poster_url ? (
              <PosterLightbox src={season.poster_url} alt={`${title} poster`} />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[.03] text-center text-xs uppercase tracking-[0.2em] text-white/30">
                Poster coming soon
              </div>
            )}
          </div>

          <div>
            <p className="mb-4 inline-flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
              <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
              {isPartner ? 'Host Tournament' : `Season ${season.season_number}`}
            </p>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.95]">
              {season.name}
            </h1>

            <p className="mt-5 max-w-xl text-lg text-white/70 leading-relaxed">
              The AI video tournament where creators compete — and skill decides.
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

      {/* ---- [2] What OXXOVO is -------------------------------------------- */}
      <section className="px-6 pt-14 md:pt-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-lg md:text-xl text-white/80 leading-relaxed">
            OXXOVO is an AI video creation tournament. Make a short AI video, go up against
            creators worldwide, and let the work win — 100% AI judging in the preliminary
            {hasAudienceVote ? ', AI plus an audience vote in the main round' : ' and the main round'}.
            No connections, no gatekeepers.
          </p>
        </div>
      </section>

      {/* ---- Info: all live from the seasons row + membership config -------- */}
      <section className="px-6 py-16 md:py-20">
        <div className="max-w-5xl mx-auto grid gap-10 md:grid-cols-2">
          {/* Schedule */}
          <div>
            <SectionHeading>Schedule</SectionHeading>
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
            <SectionHeading>Prizes</SectionHeading>
            <div className="rounded-lg border border-[#8b22ff]/20 bg-[#8b22ff]/[.04] px-5 py-4">
              <p className="text-3xl font-black text-white">{poolText}</p>
              <p className="mt-1 text-xs uppercase tracking-widest text-[#b66cff]">Total prize pool</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div><p className="text-white/40 text-xs uppercase">1st</p><p className="font-bold">{p1}</p></div>
                <div><p className="text-white/40 text-xs uppercase">2nd</p><p className="font-bold">{p2}</p></div>
                <div><p className="text-white/40 text-xs uppercase">3rd</p><p className="font-bold">{p3}</p></div>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/60 leading-relaxed">
              The {advanceLabel} advance to the Main Round as Finalists.
            </p>
          </div>

          {/* Theme */}
          <div>
            <SectionHeading>Theme</SectionHeading>
            <p className="text-sm text-white/70 leading-relaxed">{themeText}</p>
          </div>

          {/* Cost / access. Membership requirement applies to official seasons;
              Host tournaments set their own access, so only the fee line shows. */}
          <div>
            <SectionHeading>What it costs</SectionHeading>
            <p className="text-sm text-white/70 leading-relaxed">
              {feeLine}
              {!isPartner && ` Competing on OXXOVO requires a Creator Membership (${priceText}).`}
            </p>
          </div>
        </div>
      </section>

      {/* ---- [3] Why compete ----------------------------------------------- */}
      <section className="px-6 py-14 md:py-16 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <SectionHeading>Why compete</SectionHeading>
          <p className="text-base md:text-lg text-white/75 leading-relaxed">
            {hasPool
              ? `A ${poolText} prize pool for ${season.name} — 1st ${p1}, 2nd ${p2}, 3rd ${p3}.`
              : `${season.name} is coming — prize pool to be announced.`}
            {isFoundingSeason && ` The first ${cap} creators join as Founding Creators.`}
            {' '}And this is only the beginning: the road leads to a World Championship with prizes up
            to $250,000, plus sponsorship prizes (TBD).
          </p>
        </div>
      </section>

      {/* ---- [4] How it works: two stages ---------------------------------- */}
      <section className="px-6 py-14 md:py-16 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <SectionHeading>How it works</SectionHeading>
          <p className="mb-6 text-base md:text-lg text-white/75 leading-relaxed">Two stages, then the podium.</p>
          <ul className="space-y-4">
            <li className="rounded-lg border border-white/10 bg-white/[.02] px-5 py-4">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#b66cff]">Preliminary</p>
              <p className="mt-1.5 text-sm text-white/70 leading-relaxed">
                Submit a {season.application_video_min_seconds}–{season.application_video_max_seconds}s AI video {usesExternalUrlPrelim ? 'made with any tool' : 'made in OXXOVO Studio'}. Open theme. Everyone competes.
              </p>
            </li>
            <li className="rounded-lg border border-white/10 bg-white/[.02] px-5 py-4">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#b66cff]">Main round</p>
              <p className="mt-1.5 text-sm text-white/70 leading-relaxed">
                The {advanceLabel} become Finalists and create in OXXOVO Studio.
              </p>
            </li>
            <li className="rounded-lg border border-white/10 bg-white/[.02] px-5 py-4">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#b66cff]">The podium</p>
              <p className="mt-1.5 text-sm text-white/70 leading-relaxed">1st · 2nd · 3rd.</p>
            </li>
          </ul>
        </div>
      </section>

      {/* ---- [5] The main round: Studio + Genesis Rule --------------------- */}
      <section className="px-6 py-14 md:py-16 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <SectionHeading>The main round</SectionHeading>
          <p className="text-base md:text-lg text-white/75 leading-relaxed">
            Reach the main round and you&apos;ll build your entry inside OXXOVO Studio, under the
            Genesis Rule — composed only from clips made in Studio, no external assets or separate
            VFX, audio from the AI clips only.
          </p>
          {usesExternalUrlPrelim && (
            <p className="mt-3 text-sm text-white/45 leading-relaxed">
              (From Season 1, Studio applies from the preliminary too.)
            </p>
          )}
        </div>
      </section>

      {/* ---- [6] Join as a Founding Creator -- first-season campaign only --- */}
      {isFoundingSeason && (
        <section className="px-6 py-14 md:py-16 border-t border-white/5">
          <div className="max-w-3xl mx-auto">
            <SectionHeading>Join as a Founding Creator</SectionHeading>
            <p className="text-base md:text-lg text-white/75 leading-relaxed">
              The first {cap} creators join as Founding Creators:
            </p>
            <ul className="mt-5 space-y-3">
              <li className="flex items-start gap-3 rounded-lg border border-[#8b22ff]/25 bg-[#8b22ff]/[.05] px-5 py-4">
                <span className="mt-0.5 text-[#b66cff]">✦</span>
                <span className="text-sm text-white/85"><strong>{foundingTerm} free Creator Membership</strong></span>
              </li>
              <li className="flex items-start gap-3 rounded-lg border border-[#8b22ff]/25 bg-[#8b22ff]/[.05] px-5 py-4">
                <span className="mt-0.5 text-[#b66cff]">✦</span>
                <span className="text-sm text-white/85"><strong>Founding badge</strong></span>
              </li>
            </ul>
            <p className="mt-5 text-sm text-white/55 leading-relaxed">
              After the first {cap}, Creator Membership is {priceText}. Membership is required to compete.
            </p>
          </div>
        </section>
      )}

      {/* ---- [7] CTA ------------------------------------------------------- */}
      <section className="px-6 py-16 md:py-24 text-center border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <div className="text-xs tracking-[0.3em] text-[#8B22FF] mb-6">READY?</div>
          <h2 className="text-3xl md:text-5xl font-black mb-5 tracking-tight">This is {season.name}.</h2>
          <p className="mb-8 text-base md:text-lg text-white/70 leading-relaxed">
            Make your video, submit the link, and let the work speak.
            {formatDeadlinePT(season.application_close_at)
              ? ` Applications close ${formatDeadlinePT(season.application_close_at)}.`
              : ''}
          </p>
          <Link
            href={cta.href}
            className="inline-block bg-[#8B22FF] hover:bg-[#9B32FF] text-white font-bold tracking-[0.2em] px-10 py-5 transition"
          >
            {cta.label.toUpperCase()}
          </Link>
        </div>
      </section>

      {/* ---- [8] Questions ------------------------------------------------- */}
      <section className="px-6 pb-4 text-center">
        <p className="text-sm text-white/45">
          Questions? Ask the OXXOVO assistant below, or email{' '}
          <a href="mailto:info@oxxovo.ai" className="text-white/70 underline hover:text-white">info@oxxovo.ai</a>.
        </p>
      </section>

      <footer className="px-6 py-12 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs tracking-[0.2em] text-white/40">
          <Link href="/tournament" className="hover:text-white transition">← All tournaments</Link>
          <div>OXXOVO&trade; &middot; Las Vegas, Nevada, USA</div>
        </div>
        <div className="max-w-5xl mx-auto mt-4 text-center text-[10px] tracking-[0.15em] text-white/30">
          OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. &middot; {formatFooterStatusLine()}
        </div>
      </footer>

    </main>
  )
}
