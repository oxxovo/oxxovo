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
  creatorName: string
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
}

export type WatchSeasonGroup = {
  seasonId: string
  displayName: string
  seasonNumber: number
  hostType: 'official' | 'partner'
  videos: WatchVideo[]
}

// Applications in these states are never shown on Watch: 'rejected' (not in the
// competition) and 'flagged' (integrity suspicion, pending review). Everything
// from 'pending' upward is public the moment a video URL exists -- the
// submit-immediately policy (TK 2026-06-27).
const HIDDEN_STATUSES = new Set(['rejected', 'flagged'])

type AppRow = {
  id: string
  season_id: string
  status: string
  user_id: string | null
  creator_name: string | null
  ai_service: string | null
  video_duration_seconds: number | null
  staff_pick: boolean | null
  free_entry_url: string | null
  main_round_video_url: string | null
  created_at: string | null
  studio_application_submitted_at: string | null
  main_round_submitted_at: string | null
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

function toWatchVideo(
  row: AppRow,
  round: WatchRound,
  videoUrl: string,
  counts: { likes: number; views: number; comments: number },
  displayName?: string,
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
    // Account nickname is the source of truth; fall back to the per-application
    // creator_name for legacy rows whose user_id has no profile nickname yet.
    creatorName: displayName?.trim() || row.creator_name?.trim() || 'Anonymous',
    durationSeconds: row.video_duration_seconds,
    aiService: row.ai_service,
    staffPick: !!row.staff_pick,
    awarded: row.status === 'awarded',
    submittedAt,
    thumbnailUrl: deriveThumbnail(videoUrl),
    likeCount: counts.likes,
    viewCount: counts.views,
    commentCount: counts.comments,
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
      'id, season_id, status, user_id, creator_name, ai_service, video_duration_seconds, staff_pick, free_entry_url, main_round_video_url, created_at, studio_application_submitted_at, main_round_submitted_at',
    )
  if (opt.seasonId) q = q.eq('season_id', opt.seasonId)

  const [{ data: apps, error }, likeAgg, viewAgg, commentAgg] = await Promise.all([
    q,
    admin.from('watch_likes').select('application_id, round'),
    admin.from('watch_views').select('application_id, round'),
    admin.from('watch_comments').select('application_id, round').eq('status', 'visible'),
  ])

  if (error) {
    console.error('[watch] failed to load applications:', error.message)
    return []
  }

  const likes = tallyCounts((likeAgg.data ?? []) as { application_id: string; round: string }[])
  const views = tallyCounts((viewAgg.data ?? []) as { application_id: string; round: string }[])
  const comments = tallyCounts((commentAgg.data ?? []) as { application_id: string; round: string }[])
  const countsFor = (id: string, round: WatchRound) => ({
    likes: likes.get(`${id}:${round}`) ?? 0,
    views: views.get(`${id}:${round}`) ?? 0,
    comments: comments.get(`${id}:${round}`) ?? 0,
  })

  const rows = (apps ?? []) as AppRow[]
  const names = await getDisplayNames(rows.map((r) => r.user_id))

  const videos: WatchVideo[] = []
  for (const row of rows) {
    if (HIDDEN_STATUSES.has(row.status)) continue
    const displayName = row.user_id ? names.get(row.user_id) : undefined
    if (row.free_entry_url?.trim()) {
      videos.push(toWatchVideo(row, 'application', row.free_entry_url.trim(), countsFor(row.id, 'application'), displayName))
    }
    if (row.main_round_video_url?.trim()) {
      videos.push(toWatchVideo(row, 'main', row.main_round_video_url.trim(), countsFor(row.id, 'main'), displayName))
    }
  }

  return sortVideos(videos, sort)
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

// Public Triple-AI score for a MAIN-ROUND video (finalists only). Returns null
// unless judging is completed. Integrity fields are never included here
// ([[project-scoring-integrity-rules]] -- low-score shaming guard: prelim
// scores are owner-only via /profile, not here).
export async function getPublicMainScore(applicationId: string): Promise<PublicScore | null> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('scoring_results')
    .select(
      'verified_score, grade, consensus_intent, consensus_execution, consensus_originality, ai_outputs, judged_status',
    )
    .eq('application_id', applicationId)
    .eq('round', 'main')
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
      'id, season_id, status, user_id, creator_name, ai_service, video_duration_seconds, staff_pick, free_entry_url, main_round_video_url, created_at, studio_application_submitted_at, main_round_submitted_at',
    )
    .eq('id', applicationId)
    .maybeSingle()

  if (error || !data) return null
  const row = data as AppRow
  if (HIDDEN_STATUSES.has(row.status)) return null

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
