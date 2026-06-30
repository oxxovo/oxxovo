// Arena preview surface (server components). Dark-purple "arena spectator"
// redesign of Watch. Lives ONLY at /watch-arena -- the live /watch is untouched.
//
// Score policy (strict): preliminary cards never show a score or rank (prelim
// scores are owner-only); main-round cards may show the public Triple-AI score +
// rank. Featured/Leaderboard auto-hide when there are no scored main-round videos.

import Link from 'next/link'
import { type Season, resolveSeasonCta } from '@/lib/seasons'
import type { WatchVideo, PublicScore } from '@/lib/watch'

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
// Background image (with its baked-in OXXOVO logo) + the "Watch the Competition"
// CTA. The season prefix/title text and the status chips were removed per TK's
// 시안 review request; everything else (image, logo, button, layout) is kept.
export function ArenaHero({ season }: { season: Season | null }) {
  const cta = season ? resolveSeasonCta(season) : null

  return (
    <section className="relative -mx-6 -mt-6 mb-5 overflow-hidden">
      {/* Mobile keeps the base height/padding (balanced as-is); desktop (md+) is
          taller so the bottom-anchored CTA drops well below the image's logo. */}
      <div className="relative h-[clamp(420px,58vh,600px)] md:h-[560px] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/arena_image.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: '50% 22%' }}
        />
        {/* Light at top so the image's OXXOVO logo stays visible; darken toward
            the bottom where the season text sits (readability). */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,4,16,.2)_0%,rgba(6,4,16,.28)_38%,rgba(6,4,16,.78)_78%,#070512_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_120%,rgba(139,34,255,.16),transparent_60%)]" />

        {/* Mobile: CTA anchored at the bottom (balanced for the mobile crop).
            Desktop: vertically centered, kept at its previous offset so the
            button sits where the season text block used to. */}
        <div className="absolute inset-0 flex flex-col items-center justify-end md:justify-center px-6 pb-9 md:pb-0 text-center md:translate-y-36">
          {cta && (
            <div className="mt-6">
              <Link
                href="#entries"
                className="inline-flex items-center gap-2 rounded-lg bg-[#8b22ff] px-7 md:px-8 py-3.5 text-[16px] md:text-[17px] font-extrabold text-white shadow-[0_0_28px_rgba(139,34,255,.55)] transition hover:brightness-110"
              >
                Watch the Competition
              </Link>
            </div>
          )}
          {/* Tagline glued just under the CTA, inside the Hero (sits over the
              image's dark lower band -- white text stays legible). */}
          <div className="mt-6 max-w-2xl">
            <h2 className="text-lg md:text-xl font-black leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,.7)]">
              These aren&apos;t just videos. They&apos;re competitors.
            </h2>
            <p className="mt-1 text-[13px] md:text-sm text-[#dcd4f5] drop-shadow-[0_1px_10px_rgba(0,0,0,.7)]">
              Every video is part of an official OXXOVO tournament and verified through Triple-AI evaluation.
            </p>
          </div>
        </div>
      </div>
    </section>
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
