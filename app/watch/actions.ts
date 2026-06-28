'use server'

// Watch social mutations. All writes go through the service-role client (the
// watch_* tables grant nothing to anon/authenticated -- [[feedback-server-side-anon-rls-trap]]).
// Identity for likes comes from the cookie session (members only); views fall
// back to a salted IP+UA hash for anonymous viewers.

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createHash } from 'crypto'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getUserOrNull } from '@/lib/user-auth'
import { getAdminOrNull } from '@/lib/admin-auth'
import { getDisplayName } from '@/lib/nickname'
import { COMMENT_MAX } from './constants'
import type { WatchRound } from '@/lib/watch'

function normRound(r: string): WatchRound {
  return r === 'main' ? 'main' : 'application'
}

// Anonymous viewer key salt. Hashing IP+UA keeps raw IPs out of the table while
// still de-duplicating same-day refreshes. Override per-env if desired.
const VIEW_SALT = process.env.WATCH_VIEW_SALT ?? 'oxxovo-watch-v1'

// Records one view, de-duplicated per (application, round, viewer, day) by the
// unique index. Logged-in viewers key on user id; anonymous on a salted IP+UA
// hash. Idempotent within a day -- a refresh does not re-count.
export async function recordWatchView(applicationId: string, round: string): Promise<void> {
  const r = normRound(round)
  const user = await getUserOrNull()

  let viewerKey: string
  if (user) {
    viewerKey = `u:${user.id}`
  } else {
    const h = await headers()
    const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown'
    const ua = h.get('user-agent') ?? ''
    viewerKey = 'a:' + createHash('sha256').update(`${ip}|${ua}|${VIEW_SALT}`).digest('hex').slice(0, 32)
  }

  const today = new Date().toISOString().slice(0, 10)
  const admin = createSupabaseAdmin()
  const { error } = await admin.from('watch_views').upsert(
    { application_id: applicationId, round: r, viewer_key: viewerKey, view_date: today },
    { onConflict: 'application_id,round,viewer_key,view_date', ignoreDuplicates: true },
  )
  if (error) console.error('[watch] recordWatchView failed:', error.message)
}

export type LikeResult =
  | { ok: true; liked: boolean; count: number }
  | { ok: false; error: 'auth' }

// Toggles the current member's like on a (application, round) video. Members
// only -- returns {error:'auth'} for signed-out callers so the UI can redirect
// to login. The DB unique index guarantees at most one like per member.
export async function toggleWatchLike(applicationId: string, round: string): Promise<LikeResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'auth' }

  const r = normRound(round)
  const admin = createSupabaseAdmin()

  const { data: existing } = await admin
    .from('watch_likes')
    .select('id')
    .eq('application_id', applicationId)
    .eq('round', r)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await admin.from('watch_likes').delete().eq('id', existing.id)
  } else {
    await admin
      .from('watch_likes')
      .insert({ application_id: applicationId, round: r, user_id: user.id })
  }

  const { count } = await admin
    .from('watch_likes')
    .select('id', { count: 'exact', head: true })
    .eq('application_id', applicationId)
    .eq('round', r)

  return { ok: true, liked: !existing, count: count ?? 0 }
}

// ─── Comments ───────────────────────────────────────────────────────────────
// Members only; author edits/deletes own; anyone (member) can report; admin
// hides (status='hidden', never deleted) via the admin queue. Display name is
// resolved at READ time from the account nickname (no author_name snapshot) so
// a nickname change reflects everywhere -- YouTube-style.

export type CommentResult =
  | { ok: true }
  | { ok: false; error: 'auth' | 'empty' | 'too_long' | 'not_owner' | 'not_found' | 'failed' }

export async function addWatchComment(
  applicationId: string,
  round: string,
  body: string,
): Promise<CommentResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'auth' }

  const text = (body ?? '').trim()
  if (!text) return { ok: false, error: 'empty' }
  if (text.length > COMMENT_MAX) return { ok: false, error: 'too_long' }

  const r = normRound(round)
  // Ensure the account has a nickname so the comment renders with a name.
  await getDisplayName(user.id)

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('watch_comments')
    .insert({ application_id: applicationId, round: r, user_id: user.id, body: text })
  if (error) {
    console.error('[watch] addWatchComment failed:', error.message)
    return { ok: false, error: 'failed' }
  }
  revalidatePath(`/watch/${applicationId}`)
  return { ok: true }
}

export async function editWatchComment(commentId: string, body: string): Promise<CommentResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'auth' }

  const text = (body ?? '').trim()
  if (!text) return { ok: false, error: 'empty' }
  if (text.length > COMMENT_MAX) return { ok: false, error: 'too_long' }

  const admin = createSupabaseAdmin()
  const { data: row } = await admin
    .from('watch_comments')
    .select('id, user_id, application_id')
    .eq('id', commentId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'not_found' }
  if (row.user_id !== user.id) return { ok: false, error: 'not_owner' }

  const { error } = await admin
    .from('watch_comments')
    .update({ body: text, edited_at: new Date().toISOString() })
    .eq('id', commentId)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: 'failed' }
  revalidatePath(`/watch/${row.application_id}`)
  return { ok: true }
}

export async function deleteWatchComment(commentId: string): Promise<CommentResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'auth' }

  const admin = createSupabaseAdmin()
  const { data: row } = await admin
    .from('watch_comments')
    .select('id, user_id, application_id')
    .eq('id', commentId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'not_found' }
  if (row.user_id !== user.id) return { ok: false, error: 'not_owner' }

  // Author delete is a hard delete (admin Hide is the soft path). Reports
  // cascade via FK.
  const { error } = await admin
    .from('watch_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', user.id)
  if (error) return { ok: false, error: 'failed' }
  revalidatePath(`/watch/${row.application_id}`)
  return { ok: true }
}

export type ReportResult =
  | { ok: true; alreadyReported: boolean }
  | { ok: false; error: 'auth' | 'not_found' | 'failed' }

export async function reportWatchComment(
  commentId: string,
  reason?: string,
): Promise<ReportResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'auth' }

  const admin = createSupabaseAdmin()
  const { data: row } = await admin
    .from('watch_comments')
    .select('id, application_id')
    .eq('id', commentId)
    .maybeSingle()
  if (!row) return { ok: false, error: 'not_found' }

  const { error: insErr } = await admin
    .from('watch_comment_reports')
    .insert({ comment_id: commentId, reporter_user_id: user.id, reason: reason?.trim() || null })

  // 23505 = unique violation = this member already reported -> idempotent OK.
  if (insErr && insErr.code !== '23505') {
    console.error('[watch] reportWatchComment failed:', insErr.message)
    return { ok: false, error: 'failed' }
  }
  const alreadyReported = insErr?.code === '23505'

  // Refresh the denormalized report_count for the admin triage queue.
  const { count } = await admin
    .from('watch_comment_reports')
    .select('id', { count: 'exact', head: true })
    .eq('comment_id', commentId)
  await admin.from('watch_comments').update({ report_count: count ?? 0 }).eq('id', commentId)

  return { ok: true, alreadyReported }
}

// ─── Community vote (main round, up to 3 per person) ─────────────────────────
// Members vote for up to N (=seasons.community_vote_max_per_user, default 3)
// DIFFERENT main-round videos during the vote window; one vote per video; toggle
// to un-vote. The DB trigger is the hard cap (race-safe); this pre-checks for a
// friendly message. ip/ua/timing logged for abuse detection.

export type VoteResult =
  | { ok: true; voted: boolean; usedVotes: number; cap: number }
  | { ok: false; error: 'auth' | 'closed' | 'limit' | 'not_main' | 'failed' }

export async function toggleWatchVote(applicationId: string): Promise<VoteResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'auth' }

  const admin = createSupabaseAdmin()
  const { data: app } = await admin
    .from('genesis_applications')
    .select('id, season_id, main_round_video_url')
    .eq('id', applicationId)
    .maybeSingle()
  if (!app || !app.main_round_video_url) return { ok: false, error: 'not_main' }

  const { data: season } = await admin
    .from('seasons')
    .select('community_vote_start_at, community_vote_end_at, community_vote_max_per_user')
    .eq('id', app.season_id)
    .maybeSingle()

  const cap = (season?.community_vote_max_per_user as number | null) ?? 3
  const now = Date.now()
  const start = season?.community_vote_start_at ? Date.parse(season.community_vote_start_at as string) : null
  const end = season?.community_vote_end_at ? Date.parse(season.community_vote_end_at as string) : null
  const open = start != null && end != null && now >= start && now <= end

  const { data: existing } = await admin
    .from('watch_votes')
    .select('id')
    .eq('application_id', applicationId)
    .eq('round', 'main')
    .eq('user_id', user.id)
    .maybeSingle()

  // Voting (and un-voting) only inside the window.
  if (!open) return { ok: false, error: 'closed' }

  if (existing) {
    await admin.from('watch_votes').delete().eq('id', existing.id)
  } else {
    const h = await headers()
    const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || null
    const ua = h.get('user-agent') || null
    const { error } = await admin.from('watch_votes').insert({
      application_id: applicationId,
      season_id: app.season_id,
      round: 'main',
      user_id: user.id,
      voter_ip: ip,
      voter_ua: ua,
    })
    if (error) {
      // 23514 = check_violation raised by enforce_watch_vote_limit (cap reached).
      if (error.code === '23514' || /watch_vote_limit/.test(error.message)) {
        return { ok: false, error: 'limit' }
      }
      // 23505 = unique (already voted this video) -> treat as success/no-op.
      if (error.code !== '23505') {
        console.error('[watch] toggleWatchVote insert failed:', error.message)
        return { ok: false, error: 'failed' }
      }
    }
  }

  const { count } = await admin
    .from('watch_votes')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', app.season_id)
    .eq('round', 'main')
    .eq('user_id', user.id)

  revalidatePath(`/watch/${applicationId}`)
  return { ok: true, voted: !existing, usedVotes: count ?? 0, cap }
}

// ─── Video reports + admin hide (content safety A/B) ─────────────────────────

export type VideoReportResult =
  | { ok: true; alreadyReported: boolean }
  | { ok: false; error: 'auth' | 'not_found' | 'failed' }

// Audience reports a video. One report per (application, round, member);
// idempotent. Feeds the admin moderation queue.
export async function reportWatchVideo(
  applicationId: string,
  round: string,
  reason?: string,
): Promise<VideoReportResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, error: 'auth' }

  const r = normRound(round)
  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('watch_video_reports')
    .insert({ application_id: applicationId, round: r, reporter_user_id: user.id, reason: reason?.trim() || null })

  if (error && error.code !== '23505') {
    // 23503 = FK violation (no such application)
    if (error.code === '23503') return { ok: false, error: 'not_found' }
    console.error('[watch] reportWatchVideo failed:', error.message)
    return { ok: false, error: 'failed' }
  }
  return { ok: true, alreadyReported: error?.code === '23505' }
}

export type HideResult =
  | { ok: true; hidden: boolean }
  | { ok: false; error: 'forbidden' | 'failed' }

// Admin hides/unhides a video from Watch WITHOUT touching competition status
// (status drives scoring/awards; this is visibility only).
export async function setWatchHidden(
  applicationId: string,
  hidden: boolean,
  reason?: string,
): Promise<HideResult> {
  const adminUser = await getAdminOrNull()
  if (!adminUser) return { ok: false, error: 'forbidden' }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('genesis_applications')
    .update({
      watch_hidden: hidden,
      watch_hidden_at: hidden ? new Date().toISOString() : null,
      watch_hidden_reason: hidden ? reason?.trim() || 'admin hide' : null,
    })
    .eq('id', applicationId)
  if (error) return { ok: false, error: 'failed' }

  revalidatePath(`/watch/${applicationId}`)
  revalidatePath('/watch')
  revalidatePath('/admin/watch-videos')
  return { ok: true, hidden }
}

// ─── Staff Pick ──────────────────────────────────────────────────────────────
// Editorial curation, independent of AI score ([[project-scoring-integrity-rules]]
// -- never touches score columns). Admin only. Per application (round-agnostic).

export type StaffPickResult =
  | { ok: true; staffPick: boolean }
  | { ok: false; error: 'forbidden' | 'failed' }

export async function setStaffPick(applicationId: string, on: boolean): Promise<StaffPickResult> {
  const adminUser = await getAdminOrNull()
  if (!adminUser) return { ok: false, error: 'forbidden' }

  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('genesis_applications')
    .update({ staff_pick: on, staff_pick_at: on ? new Date().toISOString() : null })
    .eq('id', applicationId)
  if (error) return { ok: false, error: 'failed' }

  revalidatePath(`/watch/${applicationId}`)
  revalidatePath('/watch')
  return { ok: true, staffPick: on }
}
