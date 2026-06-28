'use server'

// Watch social mutations. All writes go through the service-role client (the
// watch_* tables grant nothing to anon/authenticated -- [[feedback-server-side-anon-rls-trap]]).
// Identity for likes comes from the cookie session (members only); views fall
// back to a salted IP+UA hash for anonymous viewers.

import { headers } from 'next/headers'
import { createHash } from 'crypto'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getUserOrNull } from '@/lib/user-auth'
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
