// Arena preview surface (server components). Dark-purple "arena spectator"
// redesign of Watch. Lives ONLY at /watch-arena -- the live /watch is untouched.
//
// Score policy (strict): preliminary cards never show a score or rank (prelim
// scores are owner-only); main-round cards may show the public Triple-AI score +
// rank. Featured/Leaderboard auto-hide when there are no scored main-round videos.

import Link from 'next/link'
import {
  type Season,
  advanceCountLabel,
} from '@/lib/seasons'
import { resolveSeasonCta } from '@/lib/seasons'
import type { WatchVideo, PublicScore } from '@/lib/watch'

// ── colors (TK arena palette) ──────────────────────────────────────────────
const ACCENT = '#8b22ff'

export type ScoredMain = { video: WatchVideo; score: PublicScore }

function fmtCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(n)
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Los_Angeles',
    })
  } catch {
    return null
  }
}

function entryTag(i: number): string {
  return '#' + String(i + 1).padStart(2, '0')
}

// ── Hero ───────────────────────────────────────────────────────────────────
// Fully season-stage driven (no hardcode): reads the season's window dates,
// prize, and display name. finalistCount is the number of submitted main-round
// videos (used in the main-round phase).
export function ArenaHero({ season, finalistCount }: { season: Season | null; finalistCount: number }) {
  const now = Date.now()
  const ts = (v: string | null) => (v ? new Date(v).getTime() : null)
  const open = ts(season?.application_open_at ?? null)
  const close = ts(season?.application_close_at ?? null)
  const mrStart = ts(season?.main_round_start_at ?? null)
  const mrEnd = ts(season?.main_round_end_at ?? null)
  const prize = Number(season?.total_prize_pool ?? 0)
  const prizeLine = prize > 0 ? `Prize $${prize.toLocaleString()}` : null
  const title = season?.display_name || season?.name || 'OXXOVO'

  let lines: string[]
  if (mrStart && now >= mrStart && (mrEnd == null || now <= mrEnd)) {
    const daysLeft = mrEnd != null ? Math.max(0, Math.ceil((mrEnd - now) / 86_400_000)) : null
    lines = [
      'Main Round',
      finalistCount > 0 ? `${finalistCount} Finalists` : (season ? `${advanceCountLabel(season)} advance` : ''),
      prizeLine ?? '',
      daysLeft != null ? `Voting ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : '',
      'Triple-AI Verified',
    ]
  } else if (open && now >= open && (close == null || now < close)) {
    lines = ['Applications Open', close ? `Closes ${fmtDate(season!.application_close_at)}` : '', prizeLine ?? '', 'Triple-AI Verified']
  } else if (open && now < open) {
    lines = ['Applications open soon', open ? `Opens ${fmtDate(season!.application_open_at)}` : '', prizeLine ?? '', 'Triple-AI Verified']
  } else {
    lines = ['Season in progress', prizeLine ?? '', 'Triple-AI Verified']
  }
  const chips = lines.filter(Boolean)
  const cta = season ? resolveSeasonCta(season) : null

  // Split "OXXOVO Season 0: The Last Hope" -> line 1 (prefix) + line 2 (title).
  const colon = title.indexOf(':')
  const line1 = colon > -1 ? title.slice(0, colon + 1) : 'OXXOVO'
  const line2 = colon > -1 ? title.slice(colon + 1).trim() : title

  return (
    <section className="relative -mx-6 -mt-6 mb-10 overflow-hidden">
      <div className="relative h-[clamp(340px,48vh,520px)] w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/arena_image.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: '50% 30%' }}
        />
        {/* Dark overlay masks the logo/"REAL RECOGNITION" baked into the image so
            the new centered text reads cleanly. */}
        <div className="absolute inset-0 bg-[rgba(6,4,16,0.55)]" />
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_120%,rgba(139,34,255,.16),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_58%,#070512_100%)]" />

        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-[15px] font-bold tracking-wide text-[#c9a9ff]">{line1}</p>
          <h1 className="mt-1 text-[30px] md:text-[34px] font-black uppercase leading-[1.02] tracking-tight text-white">
            {line2}
          </h1>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {chips.map((c, i) => (
              <span
                key={i}
                className="rounded-md border border-white/10 bg-black/30 px-2.5 py-1 text-[12px] font-semibold text-[#e3dcff] backdrop-blur"
              >
                {c}
              </span>
            ))}
          </div>
          {cta && (
            <div className="mt-6">
              <Link
                href="#entries"
                className="inline-flex items-center gap-2 rounded-lg bg-[#8b22ff] px-6 py-3 text-[15px] font-extrabold text-white shadow-[0_0_28px_rgba(139,34,255,.55)] transition hover:brightness-110"
              >
                Watch the Competition
              </Link>
            </div>
          )}
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
      <div className="mb-4">
        <h2 className="text-xl font-black leading-tight text-[#f4f0ff]">
          These aren&apos;t just videos. They&apos;re competitors.
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-[#7a7299]">
          Every video is part of an official OXXOVO tournament and verified through Triple-AI evaluation.
        </p>
      </div>
      {videos.length === 0 ? (
        <p className="py-16 text-center text-sm text-[#7a7299]">No entries yet. They appear here as creators submit.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
