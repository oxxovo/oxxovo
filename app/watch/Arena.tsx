// Arena preview surface (server components). Dark-purple "arena spectator"
// redesign of Watch. Lives ONLY at /watch-arena -- the live /watch is untouched.
//
// Score policy: verified Triple-AI scores are PUBLIC on both prelim and main
// cards (TK 2026-07-10 -- transparency; reversed the old prelim-owner-only rule).
// Featured/Leaderboard remain main-round standings and auto-hide when there are
// no scored main-round videos.

import Link from 'next/link'
import type { WatchVideo, PublicScore, CompetitionStats, JudgingProgress, Finalist, BannerContent } from '@/lib/watch'
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
// Announcement banner = a lifecycle stage machine (getBannerStage). 'accepting'
// renders this brand strip; every other stage (judging / finalists_pending /
// main_live / voting / results) reuses the finalist-banner layout below --
// same size and color, only the icon/title/subtitle change per stage. Each
// stage tells the audience what to do right now. (TK 2026-07-12)
export function ArenaBanner({ content }: { content: BannerContent }) {
  if (content.stage !== 'accepting') {
    return (
      <div className="pt-4 pb-5">
        <div className="flex items-center gap-4">
          <span aria-hidden className="text-[44px] leading-none">{content.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[20px] font-bold leading-snug text-white">{content.title}</p>
            <p className="mt-1 text-[15px] text-[#c3b8dd]">{content.subtitle}</p>
          </div>
        </div>
      </div>
    )
  }
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
            Built under the same conditions. Judged on skill alone.
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
// The arena image runs FULL-WIDTH and uncropped (its baked-in scoreboards --
// REAL COMPETITION / TRIPLE-AI VERIFIED -- logo, and silhouette all stay
// visible), with the live LIVE panel (LiveStatusBar) overlaid on its darker
// left third. A single context line sits beneath -- "Current Competition —
// Season N", the round note, and the free "Join to vote" CTA (TK hero layout,
// 2026-07-11). All live state lives in the panel; the image is pure art.
export function ArenaHero({
  seasonNumber,
  roundName,
  stage,
  seasonId,
  stats,
  closeAtISO,
  isAccepting,
  judging,
  revealAtISO,
  theme,
  voteOpen,
  voteEndISO,
}: {
  seasonNumber: number
  roundName: string
  // Banner lifecycle stage (getBannerStage). Lets the card suppress the "심사 중"
  // row + reflect voting/results so it never contradicts the top banner.
  stage?: string
  seasonId: string
  stats: CompetitionStats
  closeAtISO: string | null
  isAccepting: boolean
  judging: JudgingProgress
  revealAtISO?: string | null
  theme?: string | null
  voteOpen?: boolean
  voteEndISO?: string | null
}) {
  const panel = (
    <LiveStatusBar
      seasonNumber={seasonNumber}
      roundName={roundName}
      stage={stage}
      seasonId={seasonId}
      initialStats={stats}
      closeAtISO={closeAtISO}
      isAccepting={isAccepting}
      initialJudging={judging}
      revealAtISO={revealAtISO ?? null}
      theme={theme ?? null}
      voteOpen={voteOpen ?? false}
      voteEndISO={voteEndISO ?? null}
    />
  )
  return (
    <section className="mb-6">
      {/* Desktop: full-width arena image (natural aspect, never cropped) with the
          LIVE panel overlaid on its darker left third. */}
      <div className="relative hidden overflow-hidden rounded-2xl md:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero_bg_8final.png" alt="OXXOVO arena" className="block w-full" />
        <div className="absolute left-[3.5%] top-1/2 w-[34%] max-w-[380px] -translate-y-1/2">
          {panel}
        </div>
      </div>

      {/* Mobile: the portrait-friendly image on top (uncropped), LIVE panel below
          (overlaying a small phone image would be too cramped). */}
      <div className="md:hidden">
        <div className="overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero_bg_8final_mobile.png" alt="OXXOVO arena" className="block w-full" />
        </div>
        <div className="mt-4">{panel}</div>
      </div>

      {/* One context line + the free voting CTA, beneath the image. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#e7e0f5]">Current Competition — Season {seasonNumber}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[#9b8bc4]">
            {/* Stage-gated so the context line + CTA don't stay stuck on the
                "vote in the Main Round" pitch after the lifecycle moves on. Same
                A안 stopgap as the card/heading -- reuses the banner stage. */}
            {stage === 'results' ? (
              <>The winners have been announced. See who took the top spots this season.</>
            ) : stage === 'voting' ? (
              <>Community voting is open. Watch the main-round films and vote for your favorite creator.</>
            ) : roundName === 'Judging Complete' ? (
              <>
                Judging is complete. Finalists will be revealed
                {revealAtISO
                  ? ` on ${new Date(revealAtISO).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`
                  : ' soon'}
                .
              </>
            ) : (
              <>
                {roundName} is in progress. Videos are shown in the order they were entered. Join OXXOVO
                for free to vote in the Main Round and support your favorite creators.
              </>
            )}
          </p>
        </div>
        <Link
          href="/signup"
          className="shrink-0 rounded-lg bg-[#8b22ff] px-4 py-2 text-[13px] font-bold text-white transition hover:bg-[#7a1ee0]"
        >
          {stage === 'results' ? 'See who won →' : 'Join free to vote →'}
        </Link>
      </div>
    </section>
  )
}

// ── Finalists section (post-reveal, top of Watch) ───────────────────────────
// 10 advanced entries with a 🏆 Finalist badge. Reuses the same card shape as
// the entry grid. When a finalist hasn't submitted the main-round film yet, the
// card overlays "본선 영상 준비 중" over the prelim thumbnail. (TK 2026-07-12)
export function FinalistSection({ finalists }: { finalists: Finalist[] }) {
  if (finalists.length === 0) return null
  return (
    <section className="mb-10">
      <Heading kicker="Main Round" title="🏆 Finalists" />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {finalists.map((f) => (
          <Link
            key={f.applicationId}
            href={
              f.mainVideoUrl
                ? `/watch/${f.applicationId}?round=main`
                : `/watch/${f.applicationId}?round=application`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="group block overflow-hidden rounded-xl border border-[#8b22ff]/30 bg-[#110d1c] transition hover:border-[#8b22ff]/60 hover:shadow-[0_0_22px_rgba(139,34,255,.25)]"
          >
            <div className="relative aspect-video w-full overflow-hidden">
              {f.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.thumbnailUrl} alt={f.videoTitle || f.creatorName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2a0e52] via-[#3d1580] to-[#1a0633] p-4 text-center">
                  <span className="text-sm font-black uppercase tracking-wide text-white/85">{f.creatorName}</span>
                </div>
              )}
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[#8b22ff]/90 px-2 py-1 text-[11px] font-black text-white backdrop-blur">
                🏆 {f.awardRank ? `#${f.awardRank}` : 'Finalist'}
              </span>
              {!f.mainVideoUrl && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                  <span className="text-xs font-bold text-white/90">본선 영상 준비 중</span>
                </div>
              )}
            </div>
            <div className="p-3.5">
              <h3 className="truncate text-sm font-bold text-[#f4f0ff]">{f.videoTitle || f.creatorName}</h3>
              <p className="mt-1 truncate text-xs text-[#7a7299]">
                by {f.creatorName}
                {f.verifiedScore != null ? ` · Triple-AI ${Number(f.verifiedScore).toFixed(2)}점` : ''}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

// ── Watch card (shared by the Main Round + Finalist-prelim sections) ─────────
// Same card shape/colors as the LatestEntries grid (LatestEntries itself is left
// untouched). `tag` overlays a small top-right label (e.g. "본선 진출작").
function WatchCard({
  v,
  seasonNames,
  showJudging,
  voteOpen,
  tag,
}: {
  v: WatchVideo
  seasonNames: Record<string, string>
  showJudging: boolean
  voteOpen: boolean
  tag?: string
}) {
  return (
    <Link
      href={`/watch/${v.applicationId}?round=${v.round}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block overflow-hidden rounded-xl border border-white/8 bg-[#110d1c] transition hover:border-[#8b22ff]/50 hover:shadow-[0_0_22px_rgba(139,34,255,.2)]"
    >
      <div className="relative aspect-video w-full overflow-hidden">
        <Thumb v={v} />
        <CardBadge v={v} showJudging={showJudging} voteOpen={voteOpen} />
        <CardCenter v={v} showJudging={showJudging} voteOpen={voteOpen} />
        {tag && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-[#8b22ff]/90 px-2 py-1 text-[11px] font-black text-white backdrop-blur">
            🏆 {tag}
          </span>
        )}
      </div>
      <div className="p-3.5">
        <h3 className="truncate text-sm font-bold text-[#f4f0ff]">{v.videoTitle || v.creatorName}</h3>
        <p className="mt-1 truncate text-xs text-[#7a7299]">
          by {v.creatorName} · {cardStatusText(v, voteOpen, showJudging, seasonNames)}
        </p>
      </div>
    </Link>
  )
}

// ── Main Round section (TOP, main round only) ────────────────────────────────
// The films being judged RIGHT NOW: finalists' main-round videos, with the live
// main-round badges (⚡ 심사 중 / ✓ Verified / 🔥 투표중) and ?round=main links.
// This is what the audience is here to watch during the main round. (TK 2026-07-13)
export function MainRoundSection({
  videos,
  seasonNames,
  voteOpen,
  stage,
}: {
  videos: WatchVideo[]
  seasonNames: Record<string, string>
  voteOpen: boolean
  // Banner lifecycle stage. Once winners are announced ('results') the heading
  // must not keep saying "지금 시합 중" (competing now) -- that contradicts the
  // "winners announced" banner. (A안 stopgap, same gate as the hero card.)
  stage?: string
}) {
  if (videos.length === 0) return null
  const isResults = stage === 'results'
  return (
    <section className="mb-10">
      <Heading
        kicker={isResults ? 'Results' : 'Main Round'}
        title={isResults ? '🏆 본선 결과' : '🏆 본선 · 지금 시합 중'}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {videos.map((v) => (
          <WatchCard key={`${v.applicationId}:${v.round}`} v={v} seasonNames={seasonNames} showJudging voteOpen={voteOpen} />
        ))}
      </div>
    </section>
  )
}

// ── Finalist prelim section (MIDDLE, main round only) ────────────────────────
// The finalists' PRELIMINARY entries, tagged "본선 진출작" -- reference for the
// audience, below the live main-round films. Prelim is already judged, so no
// live badges; ?round=application links. (TK 2026-07-13)
export function FinalistPrelimSection({
  videos,
  seasonNames,
}: {
  videos: WatchVideo[]
  seasonNames: Record<string, string>
}) {
  if (videos.length === 0) return null
  return (
    <section className="mb-10">
      <Heading kicker="Finalists" title="본선 진출작 · 예선 라운드 작품" />
      <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {videos.map((v) => (
          <WatchCard
            key={`${v.applicationId}:${v.round}`}
            v={v}
            seasonNames={seasonNames}
            showJudging={false}
            voteOpen={false}
            tag="본선 진출작"
          />
        ))}
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
      {Number(score.verifiedScore).toFixed(2)}
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
                  {Number(score.verifiedScore).toFixed(2)}
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
                {/* Status badge (top-left) + centerpiece: the MAIN ROUND label
                    while voting, or a pending ring while awaiting Triple-AI.
                    Verified cards keep the poster clean (score in badge + footer).
                    No Staff Pick / Featured badges (never promotes entries). */}
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

// The thumbnail centerpiece that matches the badge: the MAIN ROUND label while
// voting, or a static pending ring while awaiting judgment (a ring, not a
// spinner -- no fake motion). Verified cards show NO centerpiece -- the poster
// stays clean; the score lives in the top-left ✓ badge + the footer line
// ("Triple-AI {score}점"). (TK 2026-07-11: big center score covered the art.)
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
  // Votes are public DURING the window (voteOpen) and stay public AFTER it
  // closes -- a final scoreboard, not hidden (TK 2026-07-12). Any main-round
  // video that has votes shows them, regardless of the window state.
  if (v.round === 'main' && (voteOpen || v.voteCount > 0)) return `${fmtCount(v.voteCount)} votes`
  if (v.publicScore != null) return `Triple-AI ${Number(v.publicScore).toFixed(2)}점`
  if (showJudging && !v.scored) return '심사 대기'
  return seasonNames[v.seasonId] ?? ''
}
