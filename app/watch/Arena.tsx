// Arena preview surface (server components). Dark-purple "arena spectator"
// redesign of Watch. Lives ONLY at /watch-arena -- the live /watch is untouched.
//
// Score policy: verified Triple-AI scores are PUBLIC on both prelim and main
// cards (TK 2026-07-10 -- transparency; reversed the old prelim-owner-only rule).
// Featured/Leaderboard remain main-round standings and auto-hide when there are
// no scored main-round videos.

import Link from 'next/link'
import type { WatchVideo, PublicScore, CompetitionStats, JudgingProgress } from '@/lib/watch'
import { LiveStatusBar } from './LiveStatusBar'

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
// One contained box: on the left the live LIVE panel (LiveStatusBar, real DB
// values), on the right the arena image kept at its own size (not shrunk into a
// thumbnail), and a single context line beneath -- "Current Competition — Season
// N", the round note, and the free "Join to vote" CTA (TK hero layout,
// 2026-07-10). All live state lives in the panel, so nothing is duplicated.
export function ArenaHero({
  seasonNumber,
  roundName,
  seasonId,
  stats,
  closeAtISO,
  isAccepting,
  judging,
}: {
  seasonNumber: number
  roundName: string
  seasonId: string
  stats: CompetitionStats
  closeAtISO: string | null
  isAccepting: boolean
  judging: JudgingProgress
}) {
  return (
    <section className="mb-6 rounded-2xl border border-white/10 bg-[#0d0716] p-5">
      <div className="flex flex-col gap-[18px] md:flex-row md:items-stretch">
        {/* Left: live LIVE panel */}
        <div className="md:flex-1">
          <LiveStatusBar
            seasonNumber={seasonNumber}
            roundName={roundName}
            seasonId={seasonId}
            initialStats={stats}
            closeAtISO={closeAtISO}
            isAccepting={isAccepting}
            initialJudging={judging}
          />
        </div>

        {/* Right: arena image at its own size (never shrunk to a thumbnail). The
            8_final art is ~4.39:1 and designed to show uncropped, so it keeps its
            natural aspect and simply fills the wider right column. */}
        <div className="flex items-center justify-center overflow-hidden rounded-xl border border-[#33235a] bg-[#1c1030] md:flex-[1.55]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero_bg_8final.png" alt="OXXOVO arena" className="h-auto w-full" />
        </div>
      </div>

      {/* Bottom: one context line + the free voting CTA */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#e7e0f5]">Current Competition — Season {seasonNumber}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[#9b8bc4]">
            {roundName} is in progress. Videos are shown in the order they were entered. Join OXXOVO for
            free to vote in the Main Round and support your favorite creators.
          </p>
        </div>
        <Link
          href="/signup"
          className="shrink-0 rounded-lg bg-[#8b22ff] px-4 py-2 text-[13px] font-bold text-white transition hover:bg-[#7a1ee0]"
        >
          Join free to vote →
        </Link>
      </div>
    </section>
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
