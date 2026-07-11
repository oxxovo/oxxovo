// Arena preview surface (server components). Dark-purple "arena spectator"
// redesign of Watch. Lives ONLY at /watch-arena -- the live /watch is untouched.
//
// Score policy: verified Triple-AI scores are PUBLIC on both prelim and main
// cards (TK 2026-07-10 -- transparency; reversed the old prelim-owner-only rule).
// Featured/Leaderboard remain main-round standings and auto-hide when there are
// no scored main-round videos.

import Link from 'next/link'
import type { WatchVideo, PublicScore } from '@/lib/watch'

// ── colors (TK arena palette) ──────────────────────────────────────────────
const ACCENT = '#8b22ff'

export type ScoredMain = { video: WatchVideo; score: PublicScore }

function fmtCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

// ── Announcement banner (above the Hero) ────────────────────────────────────
// One slim dark bar restating the platform's fairness stance, with a link back
// to the landing page. Full-bleed (matches the Hero's -mx-6) and slightly darker
// than the Hero so it reads as a header strip.
export function ArenaBanner() {
  return (
    <div className="-mx-6 border-b border-white/10 bg-[#05040c] px-6 py-2.5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-sm text-[#a855ff] drop-shadow-[0_0_6px_rgba(139,34,255,.7)]">
          ★
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12px] font-bold text-[#a855ff] sm:text-[13px]">
            OXXOVO is the global arena for AI creators.
          </p>
          <p className="truncate text-[11px] text-white/55 sm:text-[12px]">
            No editors. No favoritism. Just you, the AI, and the audience.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 text-[11px] font-bold text-white/70 transition hover:text-white sm:text-[12px]"
        >
          Learn More on Landing Page ↗
        </Link>
      </div>
    </div>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────────
// Full-bleed arena background (arena_hero_bg_frameless.png) with, on top: two
// CSS scoreboard panels flanking the center logo, and a left "Current
// Competition" info block laid directly over the image (no card box -- only the
// vote note is faintly tinted). A left->transparent gradient (NOT a solid black
// fill) keeps the left copy legible over the crowd. The center OXXOVO logo +
// silhouette come from the image. The framed variant (arena_hero_bg.png) is kept
// for rollback; arena_image.png is a separate live asset (landing/OG card).
//
// seasonNumber / roundName / stats drive the info block. stats are live DB values
// (getCurrentCompetitionStats), never hardcoded.
export function ArenaHero({
  seasonNumber,
  roundName,
}: {
  seasonNumber: number
  roundName: string
}) {
  return (
    <>
    <section className="relative -mx-6 mb-5 overflow-hidden bg-[#050208]">
      {/* Desktop: the 8_final image shown at its NATURAL aspect (w-full, height
          auto) so it is never cropped -- the baked-in scoreboards / logo /
          silhouette stay intact (the image is ~4.39:1; object-cover would slice
          the sides off). Its left ~37% is empty black, which the info block sits
          on -- no gradient needed. */}
      <div className="relative hidden w-full md:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero_bg_8final.png" alt="" className="block w-full" />
        <div className="absolute left-[3%] top-1/2 w-[33%] max-w-[430px] -translate-y-1/2">
          <InfoBlock seasonNumber={seasonNumber} roundName={roundName} />
        </div>
      </div>

      {/* Mobile: a portrait-friendly variant (~2.57:1) that keeps the silhouette
          and BOTH scoreboards intact, shown at its natural aspect (no crop). The
          info block renders below. */}
      <div className="w-full md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero_bg_8final_mobile.png" alt="" className="block w-full" />
      </div>
    </section>

    {/* Mobile: info block below the Hero (outside the -mx-6 bleed -> normal width). */}
    <div className="mb-5 md:hidden">
      <InfoBlock seasonNumber={seasonNumber} roundName={roundName} />
    </div>
    </>
  )
}

// "Current Competition" info block: season badge, current round, the fairness
// note, small inline stats, and the (free) voting invite. Text sits directly on
// the Hero image (drop-shadows for legibility); only the vote note is tinted.
// Used as a desktop overlay and, on mobile, as a block below the Hero.
function InfoBlock({
  seasonNumber,
  roundName,
}: {
  seasonNumber: number
  roundName: string
}) {
  return (
    <div className="[&_*]:drop-shadow-[0_1px_8px_rgba(0,0,0,.85)]">
      {/* Hierarchy (8_final): Current Competition (big white) is the title, with
          the SEASON pill beside it. The live state (LIVE dot, judging bar,
          countdown, countries) lives in the boxed LiveStatusBar below the Hero,
          so it is not duplicated here -- this overlay is title + context only. */}
      <div className="flex items-center gap-2.5">
        <h2 className="text-2xl font-black leading-none text-white">Current Competition</h2>
        <span className="rounded-md border border-[#8b22ff]/80 bg-[#8b22ff]/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#a855ff]">
          Season {seasonNumber}
        </span>
      </div>
      <p className="mt-2 max-w-[300px] text-[12px] leading-relaxed text-white/60">
        {roundName} is in progress. Videos are shown in the order they were entered.
      </p>

      <div className="mt-4 max-w-[330px] rounded-lg border border-white/10 bg-black/45 p-3 backdrop-blur-sm">
        <p className="text-[12px] leading-relaxed text-white/70">
          Voting opens in the Main Round. Join OXXOVO for free to vote and support your favorite creators.
        </p>
        <Link
          href="/signup"
          className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold text-[#a855ff] transition hover:text-white"
        >
          Join free to vote →
        </Link>
      </div>
    </div>
  )
}

// ── Section heading ─────────────────────────────────────────────────────────
function Heading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a855ff]">{kicker}</p>
      <h2 className="mt-0.5 text-xl font-black text-[#f4f0ff]">{title}</h2>
    </div>
  )
}

function Thumb({ v }: { v: WatchVideo }) {
  return v.thumbnailUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={v.thumbnailUrl} alt={v.videoTitle || v.creatorName} className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2a0e52] via-[#3d1580] to-[#1a0633] p-4 text-center">
      <span className="text-sm font-black uppercase tracking-wide text-white/85">{v.creatorName}</span>
    </div>
  )
}

function RoundBadge({ round }: { round: WatchVideo['round'] }) {
  return (
    <span className="absolute left-2 top-2 inline-flex items-center rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/85 backdrop-blur">
      {round === 'main' ? 'Main Round' : 'Preliminary'}
    </span>
  )
}

function ScoreBadge({ score }: { score: PublicScore }) {
  if (score.verifiedScore == null) return null
  return (
    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-[#8b22ff]/85 px-1.5 py-0.5 text-[11px] font-black text-white backdrop-blur">
      {Math.round(score.verifiedScore)}
      {score.grade ? <span className="font-bold opacity-80">· {score.grade}</span> : null}
    </span>
  )
}

// ── Featured Competitors (main-round, large cards, score shown) ─────────────
export function FeaturedCompetitors({ items, seasonNames }: { items: ScoredMain[]; seasonNames: Record<string, string> }) {
  if (items.length === 0) return null
  return (
    <section className="mb-12">
      <Heading kicker="Spotlight" title="Featured Competitors" />
      <div className="flex gap-5 overflow-x-auto pb-2">
        {items.map(({ video: v, score }) => (
          <Link
            key={`${v.applicationId}:${v.round}`}
            href={`/watch/${v.applicationId}?round=${v.round}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group w-[300px] shrink-0 overflow-hidden rounded-xl border border-[#8b22ff]/25 bg-[#110d1c] transition hover:border-[#8b22ff]/60 hover:shadow-[0_0_24px_rgba(139,34,255,.25)]"
          >
            <div className="relative aspect-video w-full overflow-hidden">
              <Thumb v={v} />
              <RoundBadge round={v.round} />
              <ScoreBadge score={score} />
            </div>
            <div className="p-3.5">
              <h3 className="truncate text-sm font-bold text-[#f4f0ff]">{v.videoTitle || v.creatorName}</h3>
              <p className="mt-1 truncate text-xs text-[#7a7299]">
                {v.creatorName} · {seasonNames[v.seasonId] ?? ''}
              </p>
              <p className="mt-1 text-[11px] text-[#7a7299]">
                {fmtCount(v.viewCount)} views · {fmtCount(v.likeCount)} votes
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ── Leaderboard (#1/#2/#3 by Triple-AI score; main-round only) ──────────────
export function Leaderboard({ items, seasonNames }: { items: ScoredMain[]; seasonNames: Record<string, string> }) {
  if (items.length === 0) return null
  const medals = ['🥇', '🥈', '🥉']
  return (
    <section className="mb-12">
      <Heading kicker="Standings" title="Leaderboard" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.slice(0, 3).map(({ video: v, score }, i) => (
          <Link
            key={`${v.applicationId}:${v.round}`}
            href={`/watch/${v.applicationId}?round=${v.round}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl border border-[#8b22ff]/25 bg-[#110d1c] p-3 transition hover:border-[#8b22ff]/60 hover:shadow-[0_0_24px_rgba(139,34,255,.22)]"
          >
            <div className="text-2xl">{medals[i] ?? `#${i + 1}`}</div>
            <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded">
              <Thumb v={v} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[#f4f0ff]">{v.videoTitle || v.creatorName}</p>
              <p className="truncate text-[11px] text-[#7a7299]">{v.creatorName}</p>
              {score.verifiedScore != null && (
                <p className="mt-0.5 text-[12px] font-black text-[#a855ff]">
                  {Math.round(score.verifiedScore)}
                  {score.grade ? <span className="text-[#7a7299]"> · {score.grade}</span> : null}
                  <span className="text-[#7a7299]"> · Triple-AI</span>
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ── Latest Entries grid ─────────────────────────────────────────────────────
// Cards carry a live STATUS badge driven by the season stage (showJudging /
// voteOpen) + real per-entry data: "⚡ AI 심사 중" while awaiting Triple-AI,
// "✓ {score}" once a video is verified -- scores are PUBLIC for BOTH rounds
// (TK 2026-07-10: a competition shows scores, like golf/bowling; prelim included),
// "🔥 {votes}" while the community vote window is open. All real DB values.
export function LatestEntries({
  videos,
  seasonNames,
  showJudging = false,
  voteOpen = false,
}: {
  videos: WatchVideo[]
  seasonNames: Record<string, string>
  showJudging?: boolean
  voteOpen?: boolean
}) {
  return (
    <section id="entries" className="scroll-mt-24">
      {videos.length === 0 ? (
        <p className="py-16 text-center text-sm text-[#7a7299]">No entries yet. They appear here as creators submit.</p>
      ) : (
        // Mobile 2 columns; tablet 3 (sm implicit from base + md:3); desktop 4
        // per row (8_final).
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          {videos.map((v) => (
            <Link
              key={`${v.applicationId}:${v.round}`}
              href={`/watch/${v.applicationId}?round=${v.round}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-xl border border-white/8 bg-[#110d1c] transition hover:border-[#8b22ff]/50 hover:shadow-[0_0_22px_rgba(139,34,255,.2)]"
            >
              <div className="relative aspect-video w-full overflow-hidden">
                <Thumb v={v} />
                {/* Status badge (top-left) + the matching centerpiece: a big
                    verified score, the MAIN ROUND label while voting, or a pending
                    ring while awaiting Triple-AI. All real, stage-driven. No Staff
                    Pick / Featured badges (the platform never promotes entries). */}
                <CardBadge v={v} showJudging={showJudging} voteOpen={voteOpen} />
                <CardCenter v={v} showJudging={showJudging} voteOpen={voteOpen} />
              </div>
              <div className="p-3.5">
                <h3 className="truncate text-sm font-bold text-[#f4f0ff]">{v.videoTitle || v.creatorName}</h3>
                <p className="mt-1 truncate text-xs text-[#7a7299]">
                  by {v.creatorName} · {cardStatusText(v, voteOpen, showJudging, seasonNames)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

// Per-card status badge (top-left of the thumbnail). Stage-driven, real data.
// Precedence:
//   1. main-round + vote window open -> 🔥 투표중 (red)
//   2. verified score (either round) -> ✓ Verified (green; scores are public)
//   3. awaiting Triple-AI judgment   -> ⚡ AI 심사 중 (purple)
//   4. otherwise                     -> nothing (still accepting / not yet judged)
function CardBadge({
  v,
  showJudging,
  voteOpen,
}: {
  v: WatchVideo
  showJudging: boolean
  voteOpen: boolean
}) {
  const base =
    'absolute left-2 top-2 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-black backdrop-blur'

  if (v.round === 'main' && voteOpen) {
    return <span className={`${base} bg-red-500/90 text-white`}>🔥 투표중</span>
  }
  if (v.publicScore != null) {
    return <span className={`${base} bg-emerald-500/90 text-black`}>✓ Verified</span>
  }
  if (showJudging && !v.scored) {
    return <span className={`${base} bg-[#8b22ff]/90 text-white`}>⚡ AI 심사 중</span>
  }
  return null
}

// The thumbnail centerpiece that matches the badge: the big verified score, the
// MAIN ROUND label while voting, or a static pending ring while awaiting
// judgment (a ring, not a spinner -- no fake motion).
function CardCenter({
  v,
  showJudging,
  voteOpen,
}: {
  v: WatchVideo
  showJudging: boolean
  voteOpen: boolean
}) {
  const wrap = 'pointer-events-none absolute inset-0 flex items-center justify-center'
  if (v.round === 'main' && voteOpen) {
    return (
      <div className={wrap}>
        <span className="text-lg font-black tracking-wide text-[#f3b6b6] drop-shadow-[0_2px_10px_rgba(0,0,0,.7)]">
          MAIN ROUND
        </span>
      </div>
    )
  }
  if (v.publicScore != null) {
    return (
      <div className={wrap}>
        <span className="text-4xl font-black text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.65)]">
          {Math.round(v.publicScore)}
        </span>
      </div>
    )
  }
  if (showJudging && !v.scored) {
    return (
      <div className={wrap}>
        <span className="h-9 w-9 rounded-full border-2 border-white/20 border-t-[#a855ff]" />
      </div>
    )
  }
  return null
}

// Footer status line, matching the badge: votes / verified score / awaiting /
// season name (when there is no live state yet).
function cardStatusText(
  v: WatchVideo,
  voteOpen: boolean,
  showJudging: boolean,
  seasonNames: Record<string, string>,
): string {
  if (v.round === 'main' && voteOpen) return `${fmtCount(v.voteCount)} votes`
  if (v.publicScore != null) return `Triple-AI ${Math.round(v.publicScore)}점`
  if (showJudging && !v.scored) return '심사 대기'
  return seasonNames[v.seasonId] ?? ''
}
