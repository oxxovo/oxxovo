// Admin-granted Studio test access -- SERVER ONLY. HQ 2026-08-22: lets an
// admin let a specific account into Studio ahead of real registration
// opening, for testing (watermark/E2E/subtitle/parity work needs a normal
// participant's-eye view, not just the admin bypass). Season-scoped and
// expiry-REQUIRED at the DB level (studio_test_access.expires_at NOT NULL) --
// a grant cannot be created without an end date, so it structurally cannot
// repeat the 2026-08-13 incident (a flip-it-for-testing switch left on).
// Checked by lib/studio.ts checkStudioAccess, between the admin bypass and
// the normal registration+membership AND requirement.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { findUserByEmail, getEmailMap } from '@/lib/credits'

export type StudioTestAccessRow = {
  id: string
  user_id: string
  season_id: string
  granted_by: string | null
  granted_at: string
  expires_at: string
  revoked_at: string | null
  note: string | null
}

export type StudioTestAccessListRow = StudioTestAccessRow & {
  email: string
  grantedByEmail: string | null
  status: 'active' | 'expired' | 'revoked'
}

// Effective = not revoked AND not yet expired. This is the ONLY check
// checkStudioAccess needs -- a stale grant simply stops mattering on its
// own, no cleanup job required.
export async function hasActiveStudioTestAccess(
  userId: string,
  seasonId: string,
): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('studio_test_access')
    .select('id')
    .eq('user_id', userId)
    .eq('season_id', seasonId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()
  return !!data
}

export type GrantResult =
  | { ok: true }
  | {
      ok: false
      reason: 'user_not_found' | 'expiry_required' | 'expiry_in_past' | 'already_active' | 'failed'
      detail?: string
    }

// Looks the account up by email (admin never types a raw user id). Fails
// closed on a missing/past expiry -- the caller (admin form) should also
// validate this client-side, but the DB column being NOT NULL is the real
// backstop; this is the friendly error path.
export async function grantStudioTestAccess(params: {
  email: string
  seasonId: string
  grantedBy: string
  expiresAt: string
  note?: string | null
}): Promise<GrantResult> {
  if (!params.expiresAt) return { ok: false, reason: 'expiry_required' }
  if (new Date(params.expiresAt).getTime() <= Date.now()) {
    return { ok: false, reason: 'expiry_in_past' }
  }
  const user = await findUserByEmail(params.email)
  if (!user) return { ok: false, reason: 'user_not_found' }

  const admin = createSupabaseAdmin()
  const { error } = await admin.from('studio_test_access').insert({
    user_id: user.id,
    season_id: params.seasonId,
    granted_by: params.grantedBy,
    expires_at: params.expiresAt,
    note: params.note?.trim() || null,
  })
  if (error) {
    // Partial unique index (user_id, season_id) WHERE revoked_at IS NULL --
    // a still-active grant for this person+season already exists.
    if (error.code === '23505') return { ok: false, reason: 'already_active' }
    return { ok: false, reason: 'failed', detail: error.message }
  }
  return { ok: true }
}

export async function revokeStudioTestAccess(id: string): Promise<{ ok: boolean }> {
  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('studio_test_access')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null) // re-run safety: already-revoked rows are a no-op, not an error
  return { ok: !error }
}

// Full history for this season (active + expired + revoked), newest first --
// the admin screen shows all of it, not just what's currently active, so a
// past grant is never invisible after it lapses (the whole point of keeping
// rows instead of deleting them on expiry/revoke).
export async function listStudioTestAccess(seasonId: string): Promise<StudioTestAccessListRow[]> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('studio_test_access')
    .select('*')
    .eq('season_id', seasonId)
    .order('granted_at', { ascending: false })
  if (error || !data) return []

  const rows = data as StudioTestAccessRow[]
  const ids = rows.flatMap((r) => [r.user_id, r.granted_by].filter((x): x is string => !!x))
  const emailMap = await getEmailMap(ids)
  const nowMs = Date.now()

  return rows.map((r) => ({
    ...r,
    email: emailMap.get(r.user_id) ?? '(unknown)',
    grantedByEmail: r.granted_by ? (emailMap.get(r.granted_by) ?? null) : null,
    status: r.revoked_at ? 'revoked' : new Date(r.expires_at).getTime() <= nowMs ? 'expired' : 'active',
  }))
}
