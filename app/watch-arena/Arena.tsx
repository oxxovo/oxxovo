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

// ── Announcement banner (above the Hero) ────────────────────────────────────
// One slim dark bar restating the platform's fairness stance, with a link back
// to the landing page. Full-bleed (matches the Hero's -mx-6) and slightly darker
// than the Hero so it reads as a header strip.
export function ArenaBanner() {
  return (
    <div className="-mx-6 border-b border-white/10 bg-[#05040c] px-6 py-2.5">
      <div className="flex items-center gap-3">
        <span aria-hidden className="text-sm text-[#b794ff] drop-shadow-[0_0_6px_rgba(139,34,255,.7)]">
          ★
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[12px] font-bold text-[#c9a9ff] sm:text-[13px]">
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
  stats,
}: {
  seasonNumber: number
  roundName: string
  stats: CompetitionStats
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
          <InfoBlock seasonNumber={seasonNumber} roundName={roundName} stats={stats} />
        </div>
      </div>

      {/* Mobile: the ultra-wide image would be a sliver at full width, so it is
          cover-cropped to a set height focused on the arena core (logo +
          silhouette); the info block renders below. */}
      <div className="relative h-[200px] w-full md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero_bg_8final.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: '72% 50%' }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_60%,rgba(5,2,8,.6)_100%)]" />
      </div>
    </section>

    {/* Mobile: info block below the Hero (outside the -mx-6 bleed -> normal width). */}
    <div className="mb-5 md:hidden">
      <InfoBlock seasonNumber={seasonNumber} roundName={roundName} stats={stats} />
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
  stats,
}: {
  seasonNumber: number
  roundName: string
  stats: CompetitionStats
}) {
  return (
    <div className="[&_*]:drop-shadow-[0_1px_8px_rgba(0,0,0,.85)]">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">Current Competition</span>
        <span className="rounded bg-[#8b22ff]/90 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
          Season {seasonNumber}
        </span>
      </div>
      <h3 className="mt-1 text-2xl font-black text-[#c9a9ff]">{roundName}</h3>
      <p className="mt-1.5 max-w-[300px] text-[12px] leading-relaxed text-white/70">
        {roundName} is in progress. Videos are shown in the order they were entered.
      </p>

      <div className="mt-4 flex gap-6">
        <InlineStat icon="🎬" n={stats.entries} label="Entries" />
        <InlineStat icon="👥" n={stats.creators} label="Creators" />
        <InlineStat icon="🌍" n={stats.countries} label="Countries" />
      </div>

      <div className="mt-4 max-w-[330px] rounded-lg border border-[#8b22ff]/30 bg-[#0a0716]/55 p-3 backdrop-blur-sm">
        <p className="text-[12px] leading-relaxed text-white/75">
          Voting opens in the Main Round. Join OXXOVO for free to vote and support your favorite creators.
        </p>
        <Link
          href="/signup"
          className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-bold text-[#c9a9ff] transition hover:text-white"
        >
          Join free to vote →
        </Link>
      </div>
    </div>
  )
}

// Small inline stat: icon + number + label, arranged horizontally (8_final: no
// large boxed tiles).
function InlineStat({ icon, n, label }: { icon: string; n: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden className="text-base opacity-80">
        {icon}
      </span>
      <div className="leading-none">
        <div className="text-lg font-black text-white">{n.toLocaleString()}</div>
        <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white/55">{label}</div>
      </div>
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
