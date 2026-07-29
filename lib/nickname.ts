// Creator nickname (account-level display name). SERVER ONLY.
//
// One nickname per account (profiles.display_name), shown identically on
// submissions, comments, and likes -- never the email (YouTube-style, TK
// 2026-06-28). Auto-generated on first use, editable in /profile.
//
// CORRECTION (2026-07-28): this header used to state "there is no
// handle_new_user trigger". That was wrong. The trigger existed and had been
// creating profiles rows in production since at least 2026-06-20 -- it was
// created in the Supabase dashboard, so nothing in the repo mentioned it. The
// stale comment was then read as evidence that the trigger never existed, and a
// live signup trigger was dropped on the strength of it. Definition now lives in
// reports/auth_handle_new_user_2026-07-28.sql. Do not treat a comment as proof of
// DB state.
//
// Self vs read paths: getDisplayName/setDisplayName are SELF ONLY and take the
// caller's session email so they can create the profiles row when it is missing
// (profiles.email is NOT NULL). getDisplayNameReadOnly/getDisplayNames are for
// OTHER accounts and never write.

import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'
import { ensureProfileRow } from './profile-row'

export const NICKNAME_MIN = 2
export const NICKNAME_MAX = 30

// Deterministic auto nickname (no Date/random -- stable per account). Uses the
// tail of the user id so two fresh accounts don't collide.
export function autoNickname(userId: string): string {
  const suffix = userId.replace(/-/g, '').slice(-4).toUpperCase()
  return `Creator${suffix}`
}

// Validates a user-chosen nickname. Letters/numbers/space and . _ - only; the
// trimmed length must be within [MIN, MAX]. Returns the normalized value or an
// error code.
export function validateNickname(
  raw: string,
): { ok: true; value: string } | { ok: false; error: 'too_short' | 'too_long' | 'invalid_chars' } {
  const v = (raw ?? '').trim().replace(/\s+/g, ' ')
  if (v.length < NICKNAME_MIN) return { ok: false, error: 'too_short' }
  if (v.length > NICKNAME_MAX) return { ok: false, error: 'too_long' }
  if (!/^[\p{L}\p{N} ._-]+$/u.test(v)) return { ok: false, error: 'invalid_chars' }
  return { ok: true, value: v }
}

// Returns the SIGNED-IN account's nickname, creating one (and the profiles row
// itself, if the signup trigger did not) on first use. `email` is required and
// must be the caller's own session email -- see lib/profile-row.ts.
export async function getDisplayName(userId: string, email: string): Promise<string> {
  const admin = createSupabaseAdmin()
  // `id` is selected as well so a MISSING ROW is distinguishable from a present
  // row with a null display_name -- that difference decides whether we insert.
  const { data } = await admin
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle()

  const existing = (data?.display_name as string | null)?.trim()
  if (existing) return existing

  const auto = autoNickname(userId)

  if (!data) {
    // No row at all: the signup trigger did not fire for this account. Loud,
    // because it means the trigger is missing or the account predates it.
    console.error('[nickname] profiles row missing -- creating it app-side', { userId })
    if (!(await ensureProfileRow(userId, email))) return auto
  }

  const { error } = await admin.from('profiles').update({ display_name: auto }).eq('id', userId)
  // Non-fatal: the caller still gets a usable name, so rendering never breaks on
  // this. But it must leave a trace -- a swallowed write is what made the
  // 2026-07-28 profile outage invisible.
  if (error) {
    console.error('[nickname] auto display_name write failed', { userId, message: error.message })
  }
  return auto
}

// Read-only nickname for ANOTHER account (public Watch pages, single record).
// NEVER writes: a missing row is logged and falls back to the deterministic auto
// nickname. Deliberate -- if the signup trigger dies, "row missing" becomes true
// for every account at once, and this is audience-facing traffic. Turning that
// into a write per render would take Watch down with it (TK, 2026-07-28).
// Historical gaps are closed by a one-off backfill, not at runtime.
export async function getDisplayNameReadOnly(userId: string): Promise<string> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle()

  const existing = (data?.display_name as string | null)?.trim()
  if (existing) return existing
  if (!data) {
    console.error('[nickname] profiles row missing on a read path (not creating)', { userId })
  }
  return autoNickname(userId)
}

// Batch lookup for list/grid rendering. Does NOT auto-create (read path, no
// side effects) -- callers fall back to another label (e.g. creator_name) for
// ids absent from the map.
export async function getDisplayNames(userIds: (string | null | undefined)[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((x): x is string => !!x))]
  const m = new Map<string, string>()
  if (ids.length === 0) return m

  const admin = createSupabaseAdmin()
  const { data } = await admin.from('profiles').select('id, display_name').in('id', ids)
  for (const r of (data ?? []) as { id: string; display_name: string | null }[]) {
    const n = r.display_name?.trim()
    if (n) m.set(r.id, n)
  }
  return m
}

// Sets the SIGNED-IN account's nickname (profile edit). Ensures the row exists
// first. Caller validates the value.
//
// THROWS on failure, deliberately: /profile shows a save result, and telling a
// user their nickname was saved when it was not is worse than showing an error.
// This used to swallow the error and return void.
export async function setDisplayName(userId: string, email: string, value: string): Promise<void> {
  if (!(await ensureProfileRow(userId, email))) {
    throw new Error('setDisplayName: profiles row unavailable')
  }
  const admin = createSupabaseAdmin()
  const { error } = await admin.from('profiles').update({ display_name: value }).eq('id', userId)
  if (error) throw new Error('setDisplayName: ' + error.message)
}
