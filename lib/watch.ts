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
import { createSupabaseAdmin } from './supabase-admin'
import { parseVideoUrl } from './video-url'
import { getDisplayName, getDisplayNames } from './nickname'

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
const HIDDEN_STATUSES = new Set(['flagged'])

// A video is PUBLIC only when: competition status isn't hidden, an admin hasn't
// hidden it (watch_hidden), AND AI pre-moderation approved it. New submissions
// start moderation_status='pending' (not public) until the scan passes -- the
// content-safety gate (TK 2026-06-28, Patent 3). Existing rows default
// 'approved' so nothing already present disappears.
function isPublicRow(row: Pick<AppRow, 'status' | 'watch_hidden' | 'moderation_status'>): boolean {
  if (HIDDEN_STATUSES.has(row.status)) return false
  if (row.watch_hidden) return false
  if (row.moderation_status !== 'approved') return false
  return true
}

type AppRow = {
  id: string
  season_id: string
  status: string
  watch_hidden: boolean | null
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

// Resolve THIS round's render poster: undefined when no render applies (external
// entry or the render row is gone) so toWatchVideo uses its fallback chain; the
// render's thumbnail_url (possibly null) when the render is known, so the round
// is authoritative and never shows the other round's poster.
function roundThumb(
  renderThumbs: Map<string, string | null>,
  renderId: string | null,
): string | null | undefined {
  if (!renderId || !renderThumbs.has(renderId)) return undefined
  return renderThumbs.get(renderId) ?? null
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
export async function getWatchVideos(
  opt: { seasonId?: string; sort?: WatchSort } = {},
): Promise<WatchVideo[]> {
  const sort = opt.sort ?? 'latest'
  const admin = createSupabaseAdmin()

  let q = admin
    .from('genesis_applications')
    .select(
      'id, season_id, status, watch_hidden, moderation_status, user_id, creator_name, ai_service, video_duration_seconds, staff_pick, free_entry_url, main_round_video_url, thumbnail_url, studio_application_render_id, studio_main_render_id, created_at, studio_application_submitted_at, main_round_submitted_at, video_title, video_description, award_rank',
    )
  if (opt.seasonId) q = q.eq('season_id', opt.seasonId)

  const [{ data: apps, error }, likeAgg, viewAgg, commentAgg, scoreAgg, voteAgg] = await Promise.all([
    q,
    admin.from('watch_likes').select('application_id, round'),
    admin.from('watch_views').select('application_id, round'),
    admin.from('watch_comments').select('application_id, round').eq('status', 'visible'),
    admin.from('scoring_results').select('application_id, round, judged_status, verified_score'),
    admin.from('watch_votes').select('application_id, round'),
  ])

  if (error) {
    console.error('[watch] failed to load applications:', error.message)
    return []
  }

  const likes = tallyCounts((likeAgg.data ?? []) as { application_id: string; round: string }[])
  const views = tallyCounts((viewAgg.data ?? []) as { application_id: string; round: string }[])
  const comments = tallyCounts((commentAgg.data ?? []) as { application_id: string; round: string }[])
  const votes = tallyCounts((voteAgg.data ?? []) as { application_id: string; round: string }[])
  const countsFor = (id: string, round: WatchRound) => ({
    likes: likes.get(`${id}:${round}`) ?? 0,
    views: views.get(`${id}:${round}`) ?? 0,
    comments: comments.get(`${id}:${round}`) ?? 0,
  })

  // Per-(app,round) Triple-AI state for the card badges. scored = judging done;
  // verified score is exposed for BOTH rounds (scores are public -- TK 2026-07-10).
  const scoredKeys = new Set<string>()
  const scoreByKey = new Map<string, number>()
  for (const s of (scoreAgg.data ?? []) as {
    application_id: string; round: string; judged_status: string; verified_score: number | null
  }[]) {
    if (s.judged_status !== 'completed') continue
    scoredKeys.add(`${s.application_id}:${s.round}`)
    if (s.verified_score != null) scoreByKey.set(`${s.application_id}:${s.round}`, s.verified_score)
  }

  const rows = (apps ?? []) as AppRow[]
  const names = await getDisplayNames(rows.map((r) => r.user_id))
  const renderThumbs = await loadRenderThumbnails(
    admin,
    rows.flatMap((r) => [r.studio_application_render_id, r.studio_main_render_id]),
  )

  const videos: WatchVideo[] = []
  for (const row of rows) {
    if (!isPublicRow(row)) continue
    const displayName = row.user_id ? names.get(row.user_id) : undefined
    if (row.free_entry_url?.trim()) {
      // Prelim: scored flips the 심사중 badge to the public verified score.
      videos.push(toWatchVideo(row, 'application', row.free_entry_url.trim(), countsFor(row.id, 'application'), displayName, {
        scored: scoredKeys.has(`${row.id}:application`),
        publicScore: scoreByKey.get(`${row.id}:application`) ?? null,
        thumbnailUrl: roundThumb(renderThumbs, row.studio_application_render_id),
      }))
    }
    if (row.main_round_video_url?.trim()) {
      videos.push(toWatchVideo(row, 'main', row.main_round_video_url.trim(), countsFor(row.id, 'main'), displayName, {
        scored: scoredKeys.has(`${row.id}:main`),
        publicScore: scoreByKey.get(`${row.id}:main`) ?? null,
        voteCount: votes.get(`${row.id}:main`) ?? 0,
        thumbnailUrl: roundThumb(renderThumbs, row.studio_main_render_id),
      }))
    }
  }

  return sortVideos(videos, sort)
}

// Live stats for the "Current Competition" Hero panel. All derived from the DB
// (never hardcoded): ENTRIES = public applications in the season that have a
// video, CREATORS = distinct owners of those, COUNTRIES = distinct declared
// countries. Pre-launch these are simply small/zero -- that's correct, not a
// placeholder.
export type CompetitionStats = { entries: number; creators: number; countries: number }

export async function getCurrentCompetitionStats(seasonId: string): Promise<CompetitionStats> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('genesis_applications')
    .select('status, watch_hidden, moderation_status, user_id, creator_name, country, free_entry_url, main_round_video_url')
    .eq('season_id', seasonId)

  if (error || !data) {
    if (error) console.error('[watch] competition stats failed:', error.message)
    return { entries: 0, creators: 0, countries: 0 }
  }

  const creators = new Set<string>()
  const countries = new Set<string>()
  let entries = 0
  for (const row of data as (Pick<AppRow, 'status' | 'watch_hidden' | 'moderation_status'> & {
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

// Triple-AI preliminary-judging progress for the Hero "⚡ 심사 중 {scored}/{total}"
// bar. total = public prelim entries (the pool being judged); scored = those whose
// preliminary scoring_results is completed. Real DB values -- the bar fills as the
// scoring worker actually finishes each video. No score numbers are exposed here.
export type JudgingProgress = { scored: number; total: number }

export async function getJudgingProgress(seasonId: string): Promise<JudgingProgress> {
  const admin = createSupabaseAdmin()
  const [{ data: apps }, { data: scores }] = await Promise.all([
    admin
      .from('genesis_applications')
      .select('id, status, watch_hidden, moderation_status, free_entry_url')
      .eq('season_id', seasonId),
    admin
      .from('scoring_results')
      .select('application_id, judged_status')
      .eq('season_id', seasonId)
      .eq('round', 'application')
      .eq('judged_status', 'completed'),
  ])

  const pool = new Set<string>()
  for (const row of (apps ?? []) as (Pick<AppRow, 'status' | 'watch_hidden' | 'moderation_status'> & {
    id: string; free_entry_url: string | null
  })[]) {
    if (!isPublicRow(row)) continue
    if (!row.free_entry_url?.trim()) continue
    pool.add(row.id)
  }
  let scored = 0
  for (const s of (scores ?? []) as { application_id: string }[]) {
    if (pool.has(s.application_id)) scored++
  }
  return { scored, total: pool.size }
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

// Public Triple-AI score for a video, for EITHER round (scores are public --
// TK 2026-07-10). Returns null unless judging is completed. Integrity fields are
// never included here ([[project-scoring-integrity-rules]] -- integrity stays
// internal; the verified score/critique are public).
export async function getPublicScore(
  applicationId: string,
  round: WatchRound = 'main',
): Promise<PublicScore | null> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('scoring_results')
    .select(
      'verified_score, grade, consensus_intent, consensus_execution, consensus_originality, ai_outputs, judged_status',
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
      'id, season_id, status, watch_hidden, moderation_status, user_id, creator_name, ai_service, video_duration_seconds, staff_pick, free_entry_url, main_round_video_url, thumbnail_url, studio_application_render_id, studio_main_render_id, created_at, studio_application_submitted_at, main_round_submitted_at, video_title, video_description, award_rank',
    )
    .eq('id', applicationId)
    .maybeSingle()

  if (error || !data) return null
  const row = data as AppRow
  if (!isPublicRow(row)) return null

  const url = (round === 'application' ? row.free_entry_url : row.main_round_video_url)?.trim()
  if (!url) return null

  const displayName = row.user_id ? await getDisplayName(row.user_id) : undefined

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
  cap: number // max videos a person may vote for this season/round
  usedVotes: number // how many this user has used this season/round
  voted: boolean // has this user voted for THIS video
  totalVotes: number // this video's public vote count
}

// Vote state for a main-round video. Public count is always returned; the
// per-user fields require a userId. Window/cap come from seasons (admin-set).
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
  const cap = (season?.community_vote_max_per_user as number | null) ?? 3

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

  return { open, cap, usedVotes, voted, totalVotes: totalVotes ?? 0 }
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
