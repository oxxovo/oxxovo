// Arena preview surface (server components). Dark-purple "arena spectator"
// redesign of Watch. Lives ONLY at /watch-arena -- the live /watch is untouched.
//
// Score policy (strict): preliminary cards never show a score or rank (prelim
// scores are owner-only); main-round cards may show the public Triple-AI score +
// rank. Featured/Leaderboard auto-hide when there are no scored main-round videos.

import Link from 'next/link'
import type { WatchVideo, PublicScore, CompetitionStats } from '@/lib/watch'

// ── colors (TK arena palette) ──────────────────────────────────────────────
const ACCENT = '#8b22ff'

export type ScoredMain = { video: WatchVideo; score: PublicScore }

function fmtCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function entryTag(i: number): string {
  return '#' + String(i + 1).padStart(2, '0')
}

// ── Hero ───────────────────────────────────────────────────────────────────
// Frameless arena background (arena_hero_bg_frameless.png -- panels removed) +
// two CSS-built scoreboard panels tilted onto the side walls + the tagline. The
// panels are fully code-owned: each panel and its copy share one coordinate
// system, so they never drift apart regardless of viewport (there is no baked-in
// frame to align to). The center OXXOVO logo + silhouette come from the image.
// The framed hero variant (arena_hero_bg.png) is kept in /public for rollback.
// (arena_image.png is a separate, live asset -- the landing/OG card image.)
//
// seasonNumber / roundName / stats drive the left "Current Competition" info
// panel. stats are live DB values (getCurrentCompetitionStats), never hardcoded.
export function ArenaHero({
  seasonNumber,
  roundName,
  stats,
}: {
  seasonNumber: number
  roundName: string
  stats: CompetitionStats
}) {
  return (
    <>
    <section className="relative -mx-6 -mt-6 mb-5 overflow-hidden">
      <div className="relative h-[clamp(420px,58vh,600px)] md:h-[560px] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* A hair of scale so object-cover crops the image's thin outer frame. */}
        <img
          src="/arena_hero_bg_frameless.png"
          alt=""
          className="absolute inset-0 h-full w-full scale-[1.04] object-cover"
          style={{ objectPosition: '50% 40%' }}
        />

        {/* Extra darkening on the LEFT so the Current Competition panel stays
            readable over the arena crowd (desktop only). */}
        <div className="absolute inset-y-0 left-0 hidden w-[46%] bg-[linear-gradient(90deg,rgba(4,3,10,.82)_0%,rgba(4,3,10,.5)_55%,transparent_100%)] md:block" />

        {/* Desktop: CSS scoreboard panels tilted onto the arena side walls. Kept
            modest so the center logo/silhouette stay the focus. Hidden below md
            (object-cover crops the sides on narrow viewports) -> mobile chips. */}
        <ScoreboardPanel side="left" lines={['REAL', 'COMPETITION']} className="left-[3.5%] top-[8%]" />
        <ScoreboardPanel side="right" lines={['TRIPLE-AI', 'VERIFIED']} className="right-[3.5%] top-[8%]" />

        {/* Desktop: Current Competition info panel, below-left of the scoreboard
            (8_final layout: scoreboard on top, info block beneath it). */}
        <div className="absolute left-[3.5%] top-[30%] hidden w-[310px] md:block">
          <CurrentCompetitionPanel seasonNumber={seasonNumber} roundName={roundName} stats={stats} />
        </div>

        {/* Keep the top clear (center logo/silhouette + panels read fully);
            darken only toward the bottom where the tagline sits. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,4,16,0)_0%,rgba(6,4,16,0)_46%,rgba(6,4,16,.5)_76%,#070512_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_120%,rgba(139,34,255,.14),transparent_60%)]" />

        {/* Mobile: flat compact chips (no perspective -> no broken glyphs when
            object-cover crops the sides). Stacked, centered, near the top. */}
        <div className="pointer-events-none absolute inset-x-0 top-3 flex flex-col items-center gap-1.5 md:hidden">
          <MobileChip text="REAL COMPETITION" />
          <MobileChip text="TRIPLE-AI VERIFIED" />
        </div>

        {/* Tagline anchored at the bottom over the dark band (both viewports). */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 pb-8 text-center">
          <div className="max-w-2xl">
            <h2 className="text-lg md:text-xl font-black leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.8)]">
              These aren&apos;t just videos. They&apos;re competitors.
            </h2>
            <p className="mt-1 text-[13px] md:text-sm text-[#dcd4f5] drop-shadow-[0_1px_10px_rgba(0,0,0,.8)]">
              Every video is part of an official OXXOVO tournament and verified through Triple-AI evaluation.
            </p>
          </div>
        </div>
      </div>
    </section>

    {/* Mobile: the info panel can't overlay (the crowd crop leaves no room), so
        it renders as a full-width card below the Hero. Kept OUTSIDE the -mx-6
        bleed section so it sits at the normal content width (no right-edge
        clipping). */}
    <div className="mb-5 -mt-1 md:hidden">
      <CurrentCompetitionPanel seasonNumber={seasonNumber} roundName={roundName} stats={stats} />
    </div>
    </>
  )
}

// Left "Current Competition" info block: season badge, current round, the
// fairness note, live DB stats, and the (free) voting invite. Used as a desktop
// overlay and, on mobile, as a card below the Hero.
function CurrentCompetitionPanel({
  seasonNumber,
  roundName,
  stats,
}: {
  seasonNumber: number
  roundName: string
  stats: CompetitionStats
}) {
  return (
    <div className="rounded-xl border border-[#8b22ff]/30 bg-[#0a0716]/75 p-4 shadow-[0_0_30px_rgba(139,34,255,.18)] backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">Current Competition</span>
        <span className="rounded bg-[#8b22ff]/90 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
          Season {seasonNumber}
        </span>
      </div>
      <h3 className="mt-1.5 text-lg font-black text-[#c9a9ff]">{roundName}</h3>
      <p className="mt-1.5 text-[12px] leading-relaxed text-white/55">
        {roundName} is in progress. Videos are shown in the order they were entered.
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat n={stats.entries} label="Entries" />
        <Stat n={stats.creators} label="Creators" />
        <Stat n={stats.countries} label="Countries" />
      </div>

      <div className="mt-4 rounded-lg border border-[#8b22ff]/25 bg-[#8b22ff]/[.08] p-3">
        <p className="text-[12px] leading-relaxed text-white/70">
          Voting opens in the Main Round. Join OXXOVO for free to vote and support your favorite creators.
        </p>
        <Link
          href="/signup"
          className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-[#c9a9ff] transition hover:text-white"
        >
          Join free to vote →
        </Link>
      </div>
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[.03] px-2 py-2 text-center">
      <div className="text-xl font-black text-white">{n.toLocaleString()}</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-white/45">{label}</div>
    </div>
  )
}

// One CSS scoreboard panel tilted onto a side wall. The whole panel (dark glass
// box + purple glow border + copy) is rotated as a unit, so the text sits "in"
// the panel plane. Left panel hinges on its outer (left) edge and angles inward
// (rotateY+); right panel mirrors (rotateY-).
function ScoreboardPanel({
  side,
  lines,
  className,
}: {
  side: 'left' | 'right'
  lines: string[]
  className?: string
}) {
  const rot = side === 'left' ? 26 : -26
  const origin = side === 'left' ? 'left center' : 'right center'
  return (
    <div className={`pointer-events-none absolute hidden md:block ${className ?? ''}`}>
      <div
        className="rounded-lg border border-[#a855ff]/55 bg-[#0a0716]/45 px-[clamp(16px,1.8vw,30px)] py-[clamp(10px,1.4vw,20px)] shadow-[0_0_28px_rgba(139,34,255,.32),inset_0_0_18px_rgba(139,34,255,.16)] backdrop-blur-[2px]"
        style={{ transform: `perspective(1100px) rotateY(${rot}deg)`, transformOrigin: origin }}
      >
        <div className="text-center font-black uppercase leading-[1.06] tracking-[0.14em] text-white [text-shadow:0_0_10px_rgba(168,85,255,.85),0_0_22px_rgba(139,34,255,.5)]">
          {lines.map((l) => (
            <div key={l} className="text-[clamp(14px,1.5vw,26px)]">
              {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Mobile scoreboard fallback: a flat (no-perspective) chip so the copy never
// breaks when object-cover crops the arena walls off a narrow screen.
function MobileChip({ text }: { text: string }) {
  return (
    <div className="rounded border border-[#a855ff]/50 bg-[#0a0716]/55 px-3 py-1 backdrop-blur-[2px]">
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white [text-shadow:0_0_8px_rgba(168,85,255,.7)]">
        {text}
      </span>
    </div>
  )
}

// ── Section heading ─────────────────────────────────────────────────────────
function Heading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="mb-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b794ff]">{kicker}</p>
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
                <p className="mt-0.5 text-[12px] font-black text-[#c9a9ff]">
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

// ── Latest Entries (preliminary grid; NO score/rank per policy) ─────────────
export function LatestEntries({ videos, seasonNames }: { videos: WatchVideo[]; seasonNames: Record<string, string> }) {
  return (
    <section id="entries" className="scroll-mt-24">
      {videos.length === 0 ? (
        <p className="py-16 text-center text-sm text-[#7a7299]">No entries yet. They appear here as creators submit.</p>
      ) : (
        // Mobile shows 2 columns (was 1) so more entries fit per screen; tablet
        // and desktop unchanged (sm:2 implicit from base, lg:3).
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {videos.map((v, i) => (
            <Link
              key={`${v.applicationId}:${v.round}`}
              href={`/watch/${v.applicationId}?round=${v.round}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-xl border border-white/8 bg-[#110d1c] transition hover:border-[#8b22ff]/50 hover:shadow-[0_0_22px_rgba(139,34,255,.2)]"
            >
              <div className="relative aspect-video w-full overflow-hidden">
                <Thumb v={v} />
                <RoundBadge round={v.round} />
                {v.staffPick && (
                  <span className="absolute right-2 top-2 inline-flex items-center rounded bg-[#8b22ff]/85 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Staff Pick
                  </span>
                )}
                <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-black text-[#c9a9ff]">
                  {entryTag(i)}
                </span>
              </div>
              <div className="p-3.5">
                {/* Prelim: NO score / NO rank (owner-only policy). */}
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
      )}
    </section>
  )
}
