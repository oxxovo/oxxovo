// Watch -- public video browsing data layer. SERVER ONLY.
//
// Videos are NOT stored here: they already live in genesis_applications
// (free_entry_url = preliminary, main_round_video_url = main round). This module
// projects the visible ones into WatchVideo cards and folds in the social counts
// (likes / views / comments) from the watch_* tables.
//
// Access model ([[feedback-server-side-anon-rls-trap]]): everything reads via the
// service-role client. anon has NO grant on genesis_applications / watch_*, so
// the public surface MUST go through this server-only path. Visibility (exclude
// flagged/rejected, require a video URL) is enforced here in code -- there is no
// public view to leak through.

import 'server-only'
import { unstable_cache } from 'next/cache'
import { createSupabaseAdmin } from './supabase-admin'
import { parseVideoUrl } from './video-url'
// getDisplayNameReadOnly (not getDisplayName): Watch renders OTHER people's
// entries, and a public read must never write a profiles row. See lib/nickname.ts.
import { getDisplayNameReadOnly, getDisplayNames } from './nickname'
import { formatDeadlinePT } from './seasons'
import { WATCH_LIST_TAG, WATCH_LIST_TTL } from './watch-cache'
import { publicScoreSeasons, areScoresPublic } from './watch-scores'
import { isRowPublic } from './watch-visibility'
import { isFixtureSeason } from './season-fixture'

export type WatchRound = 'application' | 'main'
export type WatchSort = 'trending' | 'latest' | 'award'

export type WatchVideo = {
  applicationId: string
  round: WatchRound
  seasonId: string
  videoUrl: string
  // Account that owns this entry, or null for test/legacy rows. Needed for the
  // follow button (only accounts can be followed).
  creatorUserId: string | null
  creatorName: string
  // Creator-authored public title/description (null on legacy rows -> card
  // falls back to creatorName for the title).
  videoTitle: string | null
  videoDescription: string | null
  // Award placement (1/2/3) for winners, else null. Drives the Winners filter.
  awardRank: number | null
  durationSeconds: number | null
  aiService: string | null
  staffPick: boolean
  awarded: boolean
  submittedAt: string | null
  // YouTube/Vimeo thumbnail when derivable, else null (UI falls back to a
  // gradient tile). R2/self-hosted mp4 has no thumbnail frame yet.
  thumbnailUrl: string | null
  likeCount: number
  viewCount: number
  commentCount: number
  // Public Triple-AI verified score for the card badge. Shown for BOTH rounds --
  // scores are public everywhere (transparency; TK 2026-07-10 reversed the old
  // prelim-owner-only policy). null until THIS round is judged.
  publicScore: number | null
  // Whether THIS round's Triple-AI scoring completed. Flips the card badge from
  // "⚡ AI 심사 중" to the Verified score.
  scored: boolean
  // Community votes for this main-round video (0 for prelim).
  voteCount: number
}

export type WatchSeasonGroup = {
  seasonId: string
  displayName: string
  seasonNumber: number
  hostType: 'official' | 'partner'
  videos: WatchVideo[]
}

// Applications in these states are never shown on Watch: 'rejected' (not in the
// competition) and 'flagged' (integrity suspicion, pending review).
// 'flagged' (integrity-suspect) stays hidden -- never promote questionable work.
// 'rejected' (scored but didn't advance) is NOT hidden: eliminated entries stay
// public on Watch, which the NotSelected email explicitly promises ("your work
// stays public"). Hiding them would break that link. (TK/advisor 2026-07-11)
// ★The rule itself lives in lib/watch-visibility.ts, not here. The growth-engine
// email fires on the moment this flips to true, and it must read the same rule
// rather than a copy of it. This alias keeps the call sites below unchanged.
const isPublicRow = isRowPublic

type AppRow = {
  id: string
  season_id: string
  status: string
  watch_hidden: boolean | null
  watch_hold: boolean | null
  moderation_status: string
  user_id: string | null
  creator_name: string | null
  ai_service: string | null
  video_duration_seconds: number | null
  staff_pick: boolean | null
  free_entry_url: string | null
  main_round_video_url: string | null
  thumbnail_url: string | null
  studio_application_render_id: string | null
  studio_main_render_id: string | null
  created_at: string | null
  studio_application_submitted_at: string | null
  main_round_submitted_at: string | null
  video_title: string | null
  video_description: string | null
  award_rank: number | null
}

type SeasonMeta = {
  id: string
  displayName: string
  seasonNumber: number
  hostType: 'official' | 'partner'
}

// img.youtube.com gives a stable thumbnail for any video id without an API key.
// Vimeo/TikTok need an authed oEmbed call, so we skip them for now (UI falls
// back to the gradient tile, same as a poster-less lobby card).
function deriveThumbnail(url: string): string | null {
  const parsed = parseVideoUrl(url)
  if (parsed.kind === 'youtube') {
    return `https://img.youtube.com/vi/${parsed.videoId}/hqdefault.jpg`
  }
  return null
}

// Batch-load each round's render poster so the application card and the main
// card show their OWN frame -- the single genesis_applications.thumbnail_url
// column is last-write-wins across the two rounds. Returns renderId ->
// thumbnail_url (value may be null when the render has no poster yet). A render
// id absent from the map (deleted row) lets the caller fall back to genesis.
async function loadRenderThumbnails(
  admin: ReturnType<typeof createSupabaseAdmin>,
  renderIds: (string | null)[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(renderIds.filter((x): x is string => !!x))]
  if (!ids.length) return new Map()
  const { data, error } = await admin.from('render_jobs').select('id, thumbnail_url').in('id', ids)
  if (error) {
    console.error('[watch] render thumbnail load failed:', error.message)
    return new Map()
  }
  return new Map((data ?? []).map((r) => [r.id as string, (r.thumbnail_url as string | null) ?? null]))
}

// Resolve THIS round's render poster: the render's own thumbnail when it has
// one, so a round never shows the other round's frame. Otherwise undefined, so
// toWatchVideo falls back (genesis_applications.thumbnail_url, the scoring
// worker's backfill).
//
// The null case used to return null = "authoritative, show nothing". That made
// the backfill useless in exactly the case it exists for: the Studio worker
// keeps thumbnail_url=null on ANY poster failure (worker.ts, isolated try/catch),
// so a participant whose poster step failed got a permanently blank tile even
// though scoring had already backfilled a real frame for them. At 500 entrants
// that is a handful of blank cards.
//
// Trade-off (accepted, TK 2026-07-15): genesis_applications.thumbnail_url is one
// column for both rounds, last-write-wins, so the fallback can show the other
// round's frame. A slightly-wrong frame beats a blank tile, and it only applies
// when this round's render has no poster of its own.
function roundThumb(
  renderThumbs: Map<string, string | null>,
  renderId: string | null,
): string | null | undefined {
  if (!renderId) return undefined
  return renderThumbs.get(renderId) ?? undefined
}

function toWatchVideo(
  row: AppRow,
  round: WatchRound,
  videoUrl: string,
  counts: { likes: number; views: number; comments: number },
  displayName?: string,
  extra: { publicScore?: number | null; scored?: boolean; voteCount?: number; thumbnailUrl?: string | null } = {},
): WatchVideo {
  const submittedAt =
    round === 'application'
      ? row.studio_application_submitted_at ?? row.created_at
      : row.main_round_submitted_at
  return {
    applicationId: row.id,
    round,
    seasonId: row.season_id,
    videoUrl,
    creatorUserId: row.user_id ?? null,
    // Account nickname is the source of truth; fall back to the per-application
    // creator_name for legacy rows whose user_id has no profile nickname yet.
    creatorName: displayName?.trim() || row.creator_name?.trim() || 'Anonymous',
    videoTitle: row.video_title?.trim() || null,
    videoDescription: row.video_description?.trim() || null,
    awardRank: row.award_rank ?? null,
    durationSeconds: row.video_duration_seconds,
    aiService: row.ai_service,
    staffPick: !!row.staff_pick,
    awarded: row.status === 'awarded',
    submittedAt,
    // Per-round render poster: when THIS round's render is known (extra.
    // thumbnailUrl is defined, even if null) it is authoritative so the
    // application and main cards each show their own frame and never bleed the
    // other round's poster. When it is not applicable (undefined -- external
    // YouTube entry, or the render row is gone) fall back to the single genesis
    // column, then a derived thumbnail, else null -> gradient tile.
    thumbnailUrl:
      extra.thumbnailUrl !== undefined
        ? extra.thumbnailUrl
        : row.thumbnail_url ?? deriveThumbnail(videoUrl),
    likeCount: counts.likes,
    viewCount: counts.views,
    commentCount: counts.comments,
    publicScore: extra.publicScore ?? null,
    scored: extra.scored ?? false,
    voteCount: extra.voteCount ?? 0,
  }
}

// Count map keyed by `${application_id}:${round}`. supabase-js has no GROUP BY,
// so we pull the (small, early-stage) rows and tally in JS. If Watch volume
// grows this becomes a SQL view / RPC -- noted, not premature here.
function tallyCounts(rows: { application_id: string; round: string }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = `${r.application_id}:${r.round}`
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

function sortVideos(videos: WatchVideo[], sort: WatchSort): WatchVideo[] {
  const byTime = (a: WatchVideo, b: WatchVideo) =>
    (b.submittedAt ? Date.parse(b.submittedAt) : 0) - (a.submittedAt ? Date.parse(a.submittedAt) : 0)
  if (sort === 'latest') return [...videos].sort(byTime)
  if (sort === 'award') {
    return videos.filter((v) => v.awarded).sort(byTime)
  }
  // trending: simple engagement score (likes weighted over views), recency as
  // the tie-breaker. A decay model can come later; this is enough at launch.
  return [...videos].sort((a, b) => {
    const sa = a.likeCount * 3 + a.viewCount
    const sb = b.likeCount * 3 + b.viewCount
    return sb - sa || byTime(a, b)
  })
}

// Loads every publicly visible video as a flat, sorted list. opt.seasonId
// filters to one season; opt.sort picks the ordering (default 'latest').
//
// Six full-table selects per call, and /watch calls it twice per render
// (getWatchSeasonGroups reuses it). Exported through unstable_cache below so a
// release-moment herd collapses onto one execution per TTL window -- callers
// keep using getWatchVideos and get the cached path for free.
async function loadWatchVideos(
  opt: { seasonId?: string; sort?: WatchSort } = {},
): Promise<WatchVideo[]> {
  const sort = opt.sort ?? 'latest'
  const admin = createSupabaseAdmin()

  let q = admin
    .from('genesis_applications')
    .select(
      'id, season_id, status, watch_hidden, watch_hold, moderation_status, user_id, creator_name, ai_service, video_duration_seconds, staff_pick, free_entry_url, main_round_video_url, thumbnail_url, studio_application_render_id, studio_main_render_id, created_at, studio_application_submitted_at, main_round_submitted_at, video_title, video_description, award_rank',
    )
  if (opt.seasonId) q = q.eq('season_id', opt.seasonId)

  const [{ data: apps, error }, likeAgg, viewAgg, commentAgg, scoreAgg, voteAgg, seasonsRes] = await Promise.all([
    q,
    admin.from('watch_likes').select('application_id, round'),
    admin.from('watch_views').select('application_id, round'),
    admin.from('watch_comments').select('application_id, round').eq('status', 'visible'),
    admin.from('scoring_results').select('application_id, round, judged_status, verified_score'),
    admin.from('watch_votes').select('application_id, round'),
    admin.from('seasons').select('id, season_number, is_fixture, watch_fixture_visible'),
  ])

  if (error) {
    console.error('[watch] failed to load applications:', error.message)
    return []
  }
  // Fail CLOSED, not open: if this read errors (missing column, RLS, network),
  // returning [] means nobody sees the wrong thing -- silently proceeding with
  // an empty fixture set would mean EVERY fixture season's rows pass through
  // unfiltered, which is a worse failure than an empty page.
  if (seasonsRes.error) {
    console.error('[watch] failed to load seasons for fixture filter:', seasonsRes.error.message)
    return []
  }

  // Rehearsal/fixture seasons (season_test, season_1000+, zz_*, ...) never
  // belong in the public feed, whether or not opt.seasonId was passed -- this
  // is the ONLY seasonId-agnostic gate in the function, exactly because #39
  // showed a fresh rehearsal season's rows reach here with no seasonId filter
  // at all. `seasons` is tiny (dozens of rows), so one extra select is cheap.
  //
  // watch_fixture_visible is a per-season, default-false escape hatch (HQ
  // 2026-08-27): a rehearsal needs its OWN fixture season's videos to reach
  // /watch (community-vote + Twist-banner rehearsal steps can't be observed
  // otherwise), but every other fixture (season_1000+, zz_*, old rehearsal
  // leftovers) must stay excluded. Flipping this column is the ONLY way in --
  // there is no code branch for "the currently-running rehearsal", so nothing
  // reopens the leak by itself when a rehearsal starts.
  const seasonRows = (seasonsRes.data ?? []) as {
    id: string; season_number: number; is_fixture: boolean | null; watch_fixture_visible: boolean | null
  }[]
  const exemptFixtureIds = new Set(seasonRows.filter((s) => s.watch_fixture_visible === true).map((s) => s.id))
  const fixtureSeasonIds = new Set(
    seasonRows.filter((s) => isFixtureSeason(s) && !exemptFixtureIds.has(s.id)).map((s) => s.id),
  )

  const likes = tallyCounts((likeAgg.data ?? []) as { application_id: string; round: string }[])
  const views = tallyCounts((viewAgg.data ?? []) as { application_id: string; round: string }[])
  const comments = tallyCounts((commentAgg.data ?? []) as { application_id: string; round: string }[])
  const votes = tallyCounts((voteAgg.data ?? []) as { application_id: string; round: string }[])
  const countsFor = (id: string, round: WatchRound) => ({
    likes: likes.get(`${id}:${round}`) ?? 0,
    views: views.get(`${id}:${round}`) ?? 0,
    comments: comments.get(`${id}:${round}`) ?? 0,
  })

  // Per-(app,round) Triple-AI state for the card badges. scored = judging done
  // (a progress signal, always shown). The verified SCORE is disclosed only for
  // seasons whose watch_scores_public switch is on -- off until the Defect 1
  // rubric fix ships (lib/watch-scores). Cards fall back to "심사 대기" / season
  // name and drop the ✓ Verified badge on their own when publicScore is null.
  const scoreOpenSeasons = await publicScoreSeasons()
  const scoredKeys = new Set<string>()
  const scoreByKey = new Map<string, number>()
  for (const s of (scoreAgg.data ?? []) as {
    application_id: string; round: string; judged_status: string; verified_score: number | null
  }[]) {
    if (s.judged_status !== 'completed') continue
    scoredKeys.add(`${s.application_id}:${s.round}`)
    if (s.verified_score != null) scoreByKey.set(`${s.application_id}:${s.round}`, s.verified_score)
  }

  const rows = ((apps ?? []) as AppRow[]).filter((r) => !fixtureSeasonIds.has(r.season_id))
  const names = await getDisplayNames(rows.map((r) => r.user_id))
  const renderThumbs = await loadRenderThumbnails(
    admin,
    rows.flatMap((r) => [r.studio_application_render_id, r.studio_main_render_id]),
  )

  const videos: WatchVideo[] = []
  for (const row of rows) {
    if (!isPublicRow(row)) continue
    const scoresOpen = scoreOpenSeasons.has(row.season_id)
    const scoreFor = (key: string) => (scoresOpen ? scoreByKey.get(key) ?? null : null)
    const displayName = row.user_id ? names.get(row.user_id) : undefined
    if (row.free_entry_url?.trim()) {
      // Prelim: scored flips the 심사중 badge to the public verified score.
      videos.push(toWatchVideo(row, 'application', row.free_entry_url.trim(), countsFor(row.id, 'application'), displayName, {
        scored: scoredKeys.has(`${row.id}:application`),
        publicScore: scoreFor(`${row.id}:application`),
        thumbnailUrl: roundThumb(renderThumbs, row.studio_application_render_id),
      }))
    }
    if (row.main_round_video_url?.trim()) {
      videos.push(toWatchVideo(row, 'main', row.main_round_video_url.trim(), countsFor(row.id, 'main'), displayName, {
        scored: scoredKeys.has(`${row.id}:main`),
        publicScore: scoreFor(`${row.id}:main`),
        voteCount: votes.get(`${row.id}:main`) ?? 0,
        thumbnailUrl: roundThumb(renderThumbs, row.studio_main_render_id),
      }))
    }
  }

  return sortVideos(videos, sort)
}

// Cached public entry point. Invalidated on release / hide / moderation / staff
// pick via revalidateWatchList(); otherwise refreshed every WATCH_LIST_TTL
// seconds, so like/view counts may lag by that much (deliberate -- see
// lib/watch-cache).
export const getWatchVideos = unstable_cache(loadWatchVideos, ['watch-videos'], {
  tags: [WATCH_LIST_TAG],
  revalidate: WATCH_LIST_TTL,
})

// Live stats for the "Current Competition" Hero panel. All derived from the DB
// (never hardcoded): ENTRIES = public applications in the season that have a
// video, CREATORS = distinct owners of those, COUNTRIES = distinct declared
// countries. Pre-launch these are simply small/zero -- that's correct, not a
// placeholder.
export type CompetitionStats = { entries: number; creators: number; countries: number }

async function loadCurrentCompetitionStats(seasonId: string): Promise<CompetitionStats> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('genesis_applications')
    .select('status, watch_hidden, watch_hold, moderation_status, user_id, creator_name, country, free_entry_url, main_round_video_url')
    .eq('season_id', seasonId)

  if (error || !data) {
    if (error) console.error('[watch] competition stats failed:', error.message)
    return { entries: 0, creators: 0, countries: 0 }
  }

  const creators = new Set<string>()
  const countries = new Set<string>()
  let entries = 0
  for (const row of data as (Pick<AppRow, 'status' | 'watch_hidden' | 'watch_hold' | 'moderation_status'> & {
    user_id: string | null
    creator_name: string | null
    country: string | null
    free_entry_url: string | null
    main_round_video_url: string | null
  })[]) {
    if (!isPublicRow(row)) continue
    if (!row.free_entry_url?.trim() && !row.main_round_video_url?.trim()) continue
    entries++
    creators.add(row.user_id ?? row.creator_name?.trim().toLowerCase() ?? 'anonymous')
    const c = row.country?.trim()
    if (c) countries.add(c.toUpperCase())
  }
  return { entries, creators: creators.size, countries: countries.size }
}

// Cached for the same reason as the list: the Hero panel and /api/watch/stats
// both hit this on every /watch view. Same tag, so a hold release refreshes the
// ENTRIES counter at the same instant the videos appear.
export const getCurrentCompetitionStats = unstable_cache(
  loadCurrentCompetitionStats,
  ['watch-competition-stats'],
  { tags: [WATCH_LIST_TAG], revalidate: WATCH_LIST_TTL },
)

// Triple-AI preliminary-judging progress for the Hero "⚡ 심사 중 {scored}/{total}"
// bar. total = public prelim entries (the pool being judged); scored = those whose
// preliminary scoring_results is completed. Real DB values -- the bar fills as the
// scoring worker actually finishes each video. No score numbers are exposed here.
export type JudgingProgress = { scored: number; total: number }

// Round-aware (TK 2026-07-13): before the main round the bar tracks the PRELIM
// pool (free_entry_url); once the season is in the main round the caller passes
// round='main' so the bar tracks the MAIN submissions (main_round_video_url) and
// their scoring_results(round='main') -- otherwise a finished prelim shows a
// stale "41/41" while the main round is actually the live event.
export async function getJudgingProgress(
  seasonId: string,
  round: WatchRound = 'application',
): Promise<JudgingProgress> {
  const admin = createSupabaseAdmin()
  const [{ data: apps }, { data: scores }] = await Promise.all([
    admin
      .from('genesis_applications')
      .select('id, status, watch_hidden, watch_hold, moderation_status, free_entry_url, main_round_video_url')
      .eq('season_id', seasonId),
    admin
      .from('scoring_results')
      .select('application_id, judged_status')
      .eq('season_id', seasonId)
      .eq('round', round)
      .eq('judged_status', 'completed'),
  ])

  const pool = new Set<string>()
  for (const row of (apps ?? []) as (Pick<AppRow, 'status' | 'watch_hidden' | 'watch_hold' | 'moderation_status'> & {
    id: string; free_entry_url: string | null; main_round_video_url: string | null
  })[]) {
    if (!isPublicRow(row)) continue
    const url = round === 'main' ? row.main_round_video_url : row.free_entry_url
    if (!url?.trim()) continue
    pool.add(row.id)
  }
  let scored = 0
  for (const s of (scores ?? []) as { application_id: string }[]) {
    if (pool.has(s.application_id)) scored++
  }
  return { scored, total: pool.size }
}

// ── Announcement banner stage machine (top of Watch) ────────────────────────
// Pure, date-driven (no I/O, no hardcoding -- every transition is a seasons
// column). The banner is a come-back hook, so each stage tells the audience
// exactly what to DO right now. Precedence is latest-stage-first:
//   results          now >= awards_announcement_at        -> see who won
//   voting           vote window open                     -> go vote
//   main_live        main_round_start passed, pre-vote     -> come watch
//   finalists_pending finalists selected, pre-reveal       -> come back on {date}
//   judging          applications closed, no finalists yet -> results soon
//   accepting        applications open (default)           -> brand identity
// 'accepting' carries no copy: the caller renders the existing brand strip
// (unchanged size/color). Every other stage reuses the finalist-banner layout.
export type BannerStageName =
  | 'accepting'
  | 'judging'
  | 'finalists_pending'
  | 'main_live'
  | 'voting'
  | 'results'

export type BannerContent =
  | { stage: 'accepting' }
  | {
      stage: Exclude<BannerStageName, 'accepting'>
      icon: string
      title: string
      subtitle: string
    }

export type BannerStageInput = {
  applicationCloseAt: string | null
  mainRoundStartAt: string | null
  voteStartAt: string | null
  voteEndAt: string | null
  awardsAt: string | null
  // Finalist headcount (dynamic: top 10% clamp 10..50 -- never hardcoded) and
  // how many of them have actually submitted their main-round film. The
  // main_live copy uses filmCount to avoid claiming films are up before any land.
  finalistCount: number
  finalistFilmCount: number
  // How many entries actually carry an award_rank. The results stage is gated on
  // this, not on the calendar: writing the ranks is a MANUAL admin approval
  // (approveTop3Awards), so awards_announcement_at can pass with none written.
  winnerCount: number
  theme: string | null
}

export function getBannerStage(input: BannerStageInput, now: Date = new Date()): BannerContent {
  const t = now.getTime()
  const ms = (s: string | null) => (s ? Date.parse(s) : null)
  const close = ms(input.applicationCloseAt)
  const mainStart = ms(input.mainRoundStartAt)
  const voteStart = ms(input.voteStartAt)
  const voteEnd = ms(input.voteEndAt)
  const awards = ms(input.awardsAt)
  const fmt = (m: number) => new Date(m).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

  // 5. Results announced. The date alone is NOT enough: award_rank is written by
  // approveTop3Awards, a manual admin approval, so this instant can pass with
  // zero winners recorded -- and then the banner sends the audience to a grid of
  // "Finalist" badges and no winner. Gate on real winners, same honesty rule the
  // main_live stage already applies with finalistFilmCount. When the ranking is
  // late we fall through to the main-round copy, which is still true.
  // Time is formatted with formatDeadlinePT (canonical PT + explicit label) --
  // the local fmt() below is date-only and renders in the SERVER's timezone.
  if (awards != null && t >= awards && input.winnerCount > 0) {
    const announcedAt = formatDeadlinePT(input.awardsAt)
    return {
      stage: 'results',
      icon: '🏆',
      title: 'The winners have been announced.',
      subtitle: announcedAt
        ? `Announced ${announcedAt}. See who took the top spots this season.`
        : 'See who took the top spots this season.',
    }
  }
  // 4. Community voting open.
  if (voteStart != null && voteEnd != null && t >= voteStart && t < voteEnd) {
    return {
      stage: 'voting',
      icon: '🔥',
      title: 'Community voting is open.',
      subtitle: `Watch the main-round films and vote for your favorite. Voting closes ${fmt(voteEnd)}.`,
    }
  }
  // 3b. Main round live (finalists revealed), before voting opens.
  if (mainStart != null && t >= mainStart) {
    const themePart = input.theme ? ` — ${input.theme}` : ''
    const voteWhen = voteStart != null ? ` Community voting opens ${fmt(voteStart)}.` : ''
    // Before any main-round film has been submitted, don't claim films are up --
    // the prelim entries + finalists' qualifying films are already watchable, so
    // invite the audience to meet the finalists. Once >=1 main film lands, switch
    // to the watch/vote call. finalistCount is dynamic (TK: never hardcoded).
    if (input.finalistFilmCount <= 0) {
      return {
        stage: 'main_live',
        icon: '🎬',
        title: `The Main Round has begun${themePart}.`,
        subtitle: `Meet the ${input.finalistCount} finalists.${voteWhen}`,
      }
    }
    return {
      stage: 'main_live',
      icon: '🎬',
      title: "The finalists' films are up — come watch and vote.",
      subtitle: `${input.theme ? `${input.theme}.` : 'The Main Round is live.'}${voteWhen}`,
    }
  }
  // 3a. Finalists selected, before the reveal date.
  if (input.finalistCount > 0 && mainStart != null && t < mainStart) {
    return {
      stage: 'finalists_pending',
      icon: '🏆',
      title: `${input.finalistCount} finalists have advanced to the Main Round.`,
      subtitle: `Main-round films are revealed on ${fmt(mainStart)}. Check back to watch and vote.`,
    }
  }
  // 2. Applications closed, judging under way (no finalists yet).
  if (close != null && t >= close) {
    return {
      stage: 'judging',
      icon: '⚡',
      title: 'Triple-AI judging is under way.',
      subtitle: 'Finalists will be announced soon. Check back to see who advanced.',
    }
  }
  // 1. Applications open (default) — caller renders the brand strip.
  return { stage: 'accepting' }
}

// Finalist-reveal banner state. Between advancement (finalists selected) and the
// reveal date (main_round_start_at), the audience should see "N finalists
// advanced -- revealed on {date}" so nobody is left wondering what happened.
// Returns null when there are no finalists yet, no reveal date, or the reveal
// has already passed (at which point the finalist section shows instead).
export async function getFinalistRevealState(
  seasonId: string,
): Promise<{ count: number; revealAt: string } | null> {
  const admin = createSupabaseAdmin()
  const [selRes, seasonRes] = await Promise.all([
    admin.from('genesis_applications').select('id').eq('season_id', seasonId).eq('status', 'selected'),
    admin.from('seasons').select('main_round_start_at').eq('id', seasonId).maybeSingle(),
  ])
  const count = selRes.data?.length ?? 0
  const revealAt = (seasonRes.data?.main_round_start_at as string | null) ?? null
  if (count === 0 || !revealAt) return null
  if (Date.now() >= Date.parse(revealAt)) return null
  return { count, revealAt }
}

// Finalists for the post-reveal Watch header (status selected/submitted/awarded).
// mainVideoUrl null = advanced but hasn't submitted the main-round film yet
// (the card shows a "준비 중" state). Sorted by prelim verified_score desc.
export type Finalist = {
  applicationId: string
  creatorName: string
  videoTitle: string | null
  thumbnailUrl: string | null
  mainVideoUrl: string | null
  verifiedScore: number | null
  awardRank: number | null
}

export async function getFinalists(seasonId: string): Promise<Finalist[]> {
  const admin = createSupabaseAdmin()
  const { data: apps } = await admin
    .from('genesis_applications')
    .select('id, creator_name, video_title, thumbnail_url, main_round_video_url, award_rank, created_at')
    .eq('season_id', seasonId)
    .in('status', ['selected', 'main_round_submitted', 'awarded'])
  const rows = (apps ?? []) as {
    id: string; creator_name: string; video_title: string | null
    thumbnail_url: string | null; main_round_video_url: string | null; award_rank: number | null
    created_at: string | null
  }[]
  if (rows.length === 0) return []

  // With disclosure off we withhold BOTH the number and the score ordering --
  // ranking finalists by score is itself a disclosure. Fall back to entry order.
  const scoresOpen = await areScoresPublic(seasonId)
  const { data: scores } = await admin
    .from('scoring_results')
    .select('application_id, verified_score')
    .eq('season_id', seasonId)
    .eq('round', 'application')
    .eq('judged_status', 'completed')
    .in('application_id', rows.map((r) => r.id))
  const scoreMap = new Map(
    (scores ?? []).map((s: { application_id: string; verified_score: number | null }) => [
      s.application_id,
      s.verified_score,
    ]),
  )
  return rows
    .map((r) => ({
      applicationId: r.id,
      creatorName: r.creator_name,
      videoTitle: r.video_title,
      thumbnailUrl: r.thumbnail_url,
      mainVideoUrl: r.main_round_video_url,
      verifiedScore: scoresOpen ? scoreMap.get(r.id) ?? null : null,
      awardRank: r.award_rank,
      sortKey: scoresOpen ? -(scoreMap.get(r.id) ?? 0) : Date.parse(r.created_at ?? '') || 0,
    }))
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ sortKey: _sortKey, ...f }) => f)
}

// True when this application advanced to the Main Round but hasn't submitted the
// main-round film yet. A Finalist card links to the prelim (?round=application)
// until the main film lands, so the prelim detail page shows a "본선 영상 준비 중"
// note explaining why the main round isn't here yet. Same advanced-status set as
// getFinalists. (TK 2026-07-13)
export async function isMainRoundPending(applicationId: string): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('genesis_applications')
    .select('status, main_round_video_url')
    .eq('id', applicationId)
    .single()
  if (!data) return false
  const advanced = ['selected', 'main_round_submitted', 'awarded'].includes(data.status as string)
  return advanced && !data.main_round_video_url
}

// Whether the community vote window is currently open for a season. Read from the
// BASE seasons table via service role (the community_vote_* columns are not on the
// public seasons_public view). Drives the "🔥 투표중" card badge.
export async function isVoteWindowOpen(seasonId: string): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('seasons')
    .select('community_vote_start_at, community_vote_end_at')
    .eq('id', seasonId)
    .maybeSingle()
  const now = Date.now()
  const start = data?.community_vote_start_at ? Date.parse(data.community_vote_start_at as string) : null
  const end = data?.community_vote_end_at ? Date.parse(data.community_vote_end_at as string) : null
  return start != null && end != null && now >= start && now < end
}

export type AiCritique = { name: string; strengths: string[]; weaknesses: string[]; summary: string }
export type PublicScore = {
  verifiedScore: number | null
  grade: string | null
  intent: number | null
  execution: number | null
  originality: number | null
  ai: AiCritique[]
  // ★2026-08-11 (제니2, TK integrity-copy ruling): boolean ONLY -- pass/fail,
  // never the underlying score or threshold ([[project-scoring-integrity-rules]]).
  // false/unflagged reads as "verified"; a genuine flag stays internal (no
  // "not verified" state is ever surfaced -- that would itself hint the
  // threshold, which is the leak TK's ruling closed).
  integrityVerified: boolean
}

// Parse the ai_outputs JSONB ({claude,gpt,gemini}: {strengths,weaknesses,aiSummary})
// into a safe, ordered list. Integrity is intentionally NOT surfaced.
function parseAiOutputs(raw: unknown): AiCritique[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>
  const labels: [string, string][] = [['claude', 'Claude'], ['gpt', 'GPT'], ['gemini', 'Gemini']]
  const out: AiCritique[] = []
  for (const [key, name] of labels) {
    const o = obj[key] as Record<string, unknown> | undefined
    if (!o || typeof o !== 'object') continue
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
    out.push({
      name,
      strengths: arr(o.strengths),
      weaknesses: arr(o.weaknesses),
      summary: typeof o.aiSummary === 'string' ? o.aiSummary : '',
    })
  }
  return out
}

// Public Triple-AI score for a video, for EITHER round. Returns null unless
// judging is completed AND the entry's season has score disclosure switched on
// (off until the Defect 1 rubric fix -- lib/watch-scores). The detail page
// renders the panel only when this is non-null, so the gate needs no UI change.
// Integrity fields are never included here ([[project-scoring-integrity-rules]]
// -- integrity stays internal; the verified score/critique are what go public).
export async function getPublicScore(
  applicationId: string,
  round: WatchRound = 'main',
): Promise<PublicScore | null> {
  const admin = createSupabaseAdmin()

  const { data: app } = await admin
    .from('genesis_applications')
    .select('season_id')
    .eq('id', applicationId)
    .maybeSingle()
  if (!(await areScoresPublic((app as { season_id: string | null } | null)?.season_id))) return null

  const { data } = await admin
    .from('scoring_results')
    .select(
      'verified_score, grade, consensus_intent, consensus_execution, consensus_originality, ai_outputs, judged_status, integrity_flag',
    )
    .eq('application_id', applicationId)
    .eq('round', round)
    .maybeSingle()

  if (!data || data.judged_status !== 'completed') return null
  return {
    verifiedScore: data.verified_score as number | null,
    grade: (data.grade as string | null) ?? null,
    intent: data.consensus_intent as number | null,
    execution: data.consensus_execution as number | null,
    originality: data.consensus_originality as number | null,
    ai: parseAiOutputs(data.ai_outputs),
    integrityVerified: data.integrity_flag === false,
  }
}

// Related videos for the detail sidebar: same season, trending, excluding the
// video being watched. Cheap reuse of getWatchVideos (early-stage volume).
export async function getRelatedVideos(
  seasonId: string,
  excludeApplicationId: string,
  excludeRound: WatchRound,
  limit = 8,
): Promise<WatchVideo[]> {
  const all = await getWatchVideos({ seasonId, sort: 'trending' })
  return all
    .filter((v) => !(v.applicationId === excludeApplicationId && v.round === excludeRound))
    .slice(0, limit)
}

// Single video for the detail/player page. Returns null if the application is
// hidden (flagged/rejected) or has no video for that round. Counts use exact
// head queries (no row transfer).
export async function getWatchVideo(
  applicationId: string,
  round: WatchRound,
): Promise<WatchVideo | null> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('genesis_applications')
    .select(
      'id, season_id, status, watch_hidden, watch_hold, moderation_status, user_id, creator_name, ai_service, video_duration_seconds, staff_pick, free_entry_url, main_round_video_url, thumbnail_url, studio_application_render_id, studio_main_render_id, created_at, studio_application_submitted_at, main_round_submitted_at, video_title, video_description, award_rank',
    )
    .eq('id', applicationId)
    .maybeSingle()

  if (error || !data) return null
  const row = data as AppRow
  if (!isPublicRow(row)) return null

  const url = (round === 'application' ? row.free_entry_url : row.main_round_video_url)?.trim()
  if (!url) return null

  // Read-only: this renders SOMEONE ELSE's entry on a public page, so it must
  // never create a profiles row. See lib/nickname.ts getDisplayNameReadOnly.
  const displayName = row.user_id ? await getDisplayNameReadOnly(row.user_id) : undefined

  const [likeAgg, viewAgg, commentAgg] = await Promise.all([
    admin
      .from('watch_likes')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', applicationId)
      .eq('round', round),
    admin
      .from('watch_views')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', applicationId)
      .eq('round', round),
    admin
      .from('watch_comments')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', applicationId)
      .eq('round', round)
      .eq('status', 'visible'),
  ])

  const renderId = round === 'application' ? row.studio_application_render_id : row.studio_main_render_id
  const renderThumbs = await loadRenderThumbnails(admin, [renderId])

  return toWatchVideo(
    row,
    round,
    url,
    {
      likes: likeAgg.count ?? 0,
      views: viewAgg.count ?? 0,
      comments: commentAgg.count ?? 0,
    },
    displayName,
    { thumbnailUrl: roundThumb(renderThumbs, renderId) },
  )
}

export type VoteContext = {
  open: boolean // vote window currently active
  closed: boolean // vote window has ENDED (now > end) -- show the final tally
  cap: number // max videos a person may vote for this season/round
  usedVotes: number // how many this user has used this season/round
  voted: boolean // has this user voted for THIS video
  totalVotes: number // this video's public vote count (shown during AND after)
}

// Vote state for a main-round video. Public count is always returned; the
// per-user fields require a userId. Window/cap come from seasons (admin-set).
// Raw community vote tally for a season's MAIN round: application_id -> vote
// count (one watch_votes row per user per video). Feeds computeCommunityScore
// for the final_score blend on the admin main-results page. Cheap -- bounded by
// (voters x per-user cap). Returns an empty map when no votes exist yet.
export async function getMainRoundVoteTally(seasonId: string): Promise<Map<string, number>> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('watch_votes')
    .select('application_id')
    .eq('season_id', seasonId)
    .eq('round', 'main')
  const tally = new Map<string, number>()
  for (const r of (data ?? []) as { application_id: string }[]) {
    tally.set(r.application_id, (tally.get(r.application_id) ?? 0) + 1)
  }
  return tally
}

export async function getVoteContext(
  applicationId: string,
  seasonId: string,
  userId: string | null,
): Promise<VoteContext> {
  const admin = createSupabaseAdmin()
  const { data: season } = await admin
    .from('seasons')
    .select('community_vote_start_at, community_vote_end_at, community_vote_max_per_user')
    .eq('id', seasonId)
    .maybeSingle()

  const now = Date.now()
  const start = season?.community_vote_start_at ? Date.parse(season.community_vote_start_at as string) : null
  const end = season?.community_vote_end_at ? Date.parse(season.community_vote_end_at as string) : null
  const open = start != null && end != null && now >= start && now <= end
  const closed = end != null && now > end
  const cap = (season?.community_vote_max_per_user as number | null) ?? 1

  const { count: totalVotes } = await admin
    .from('watch_votes')
    .select('id', { count: 'exact', head: true })
    .eq('application_id', applicationId)
    .eq('round', 'main')

  let usedVotes = 0
  let voted = false
  if (userId) {
    const [usedRes, mineRes] = await Promise.all([
      admin
        .from('watch_votes')
        .select('id', { count: 'exact', head: true })
        .eq('season_id', seasonId)
        .eq('round', 'main')
        .eq('user_id', userId),
      admin
        .from('watch_votes')
        .select('id')
        .eq('application_id', applicationId)
        .eq('round', 'main')
        .eq('user_id', userId)
        .maybeSingle(),
    ])
    usedVotes = usedRes.count ?? 0
    voted = !!mineRes.data
  }

  return { open, closed, cap, usedVotes, voted, totalVotes: totalVotes ?? 0 }
}

export type WatchComment = {
  id: string
  body: string
  authorId: string
  authorName: string
  createdAt: string
  editedAt: string | null
}

// Visible comments for a video, newest first. Author name is resolved from the
// current account nickname (no snapshot) so a rename reflects everywhere.
export async function getWatchComments(
  applicationId: string,
  round: WatchRound,
): Promise<WatchComment[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('watch_comments')
    .select('id, user_id, body, created_at, edited_at')
    .eq('application_id', applicationId)
    .eq('round', round)
    .eq('status', 'visible')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[watch] failed to load comments:', error.message)
    return []
  }
  const rows = (data ?? []) as {
    id: string
    user_id: string
    body: string
    created_at: string
    edited_at: string | null
  }[]
  const names = await getDisplayNames(rows.map((r) => r.user_id))
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    authorId: r.user_id,
    authorName: names.get(r.user_id) ?? 'Creator',
    createdAt: r.created_at,
    editedAt: r.edited_at,
  }))
}

// Season metadata for the left-rail grouping. Reads base seasons via service
// role (we already bypass anon here), not seasons_public -- we only need
// id/name/number/host_type, none of them secret.
async function getSeasonMeta(): Promise<Map<string, SeasonMeta>> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('seasons')
    .select('id, name, display_name, season_number, host_type')
  const m = new Map<string, SeasonMeta>()
  if (error) {
    console.error('[watch] failed to load season meta:', error.message)
    return m
  }
  for (const s of (data ?? []) as {
    id: string
    name: string
    display_name: string | null
    season_number: number | null
    host_type: string | null
  }[]) {
    m.set(s.id, {
      id: s.id,
      displayName: s.display_name || s.name,
      seasonNumber: Number(s.season_number ?? 0),
      hostType: s.host_type === 'partner' ? 'partner' : 'official',
    })
  }
  return m
}

// Groups all visible videos by season for the left-rail nav. Official seasons
// first (by descending number), partner-hosted after. Empty seasons are
// omitted -- a season with no public video shows no group.
export async function getWatchSeasonGroups(sort: WatchSort = 'latest'): Promise<WatchSeasonGroup[]> {
  const [videos, meta] = await Promise.all([getWatchVideos({ sort }), getSeasonMeta()])

  const bySeason = new Map<string, WatchVideo[]>()
  for (const v of videos) {
    const arr = bySeason.get(v.seasonId)
    if (arr) arr.push(v)
    else bySeason.set(v.seasonId, [v])
  }

  const groups: WatchSeasonGroup[] = []
  for (const [seasonId, vids] of bySeason) {
    const sm = meta.get(seasonId)
    groups.push({
      seasonId,
      displayName: sm?.displayName ?? seasonId,
      seasonNumber: sm?.seasonNumber ?? 0,
      hostType: sm?.hostType ?? 'official',
      videos: vids,
    })
  }

  groups.sort((a, b) => {
    if (a.hostType !== b.hostType) return a.hostType === 'official' ? -1 : 1
    return b.seasonNumber - a.seasonNumber
  })
  return groups
}

// ── Follows (creator subscriptions) ───────────────────────────────────────
// All best-effort: a missing watch_follows table (migration not yet run) must
// never break /watch -- these return empty/false instead of throwing.

export type FollowedCreator = { userId: string; name: string }

// Creators the given user follows, with display names resolved, newest first.
// Used for the sidebar "Subscriptions" list.
export async function getFollowedCreators(followerUserId: string): Promise<FollowedCreator[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('watch_follows')
    .select('creator_user_id, created_at')
    .eq('follower_user_id', followerUserId)
    .order('created_at', { ascending: false })

  if (error || !data) return []
  const ids = data.map((r) => r.creator_user_id as string)
  if (ids.length === 0) return []
  const names = await getDisplayNames(ids)
  return ids.map((id) => ({ userId: id, name: names.get(id) ?? 'Creator' }))
}

// Whether `followerUserId` currently follows `creatorUserId`.
export async function isFollowing(followerUserId: string, creatorUserId: string): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('watch_follows')
    .select('id')
    .eq('follower_user_id', followerUserId)
    .eq('creator_user_id', creatorUserId)
    .maybeSingle()
  return !!data
}
