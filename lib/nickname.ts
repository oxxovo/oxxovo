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
import { nicknameContainsBannedWord } from './nickname-banned-words'

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

// Returns the SIGNED-IN account's nickname. `email` is required and must be
// the caller's own session email -- see lib/profile-row.ts.
//
// ★No longer auto-WRITES a name (TK 2026-08-19): nickname entry is now
// mandatory at onboarding (see hasDisplayName + the callback redirect / mint
// backstop that enforce it), so a real gap should surface as "not set", not
// get silently papered over with a persisted "CreatorXXXX" that then looks
// like a real choice forever. This still ensures the profiles ROW exists
// (unrelated to the name itself) and still returns a display-time-only
// fallback so a caller that predates the gate (or hits this before onboarding
// redirects) never renders a blank name -- that fallback is computed, not
// stored, same contract getDisplayNameReadOnly already had.
export async function getDisplayName(userId: string, email: string): Promise<string> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle()

  const existing = (data?.display_name as string | null)?.trim()
  if (existing) return existing

  if (!data) {
    // No row at all: the signup trigger did not fire for this account. Loud,
    // because it means the trigger is missing or the account predates it.
    console.error('[nickname] profiles row missing -- creating it app-side', { userId })
    await ensureProfileRow(userId, email)
  }

  return autoNickname(userId)
}

// Raw check against the column -- unlike getDisplayName, this never computes
// a fallback, so it is what the onboarding gate (callback redirect + mint
// backstop) actually asks. A user with no row at all counts as "not set".
export async function hasDisplayName(userId: string): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  return !!(data?.display_name as string | null)?.trim()
}

// Collision key: lowercase, then strip every character validateNickname
// allows besides letters/digits (space, ., _, -). "Kira" / "kira" / "K i r a"
// / "K.i.r.a" all normalize to the same key -- TK 2026-08-19, same lookalike
// concern as the OXXOVO-impersonation banned-word entry, just spelled with
// spacing instead of leetspeak. The DB unique index (below) uses the
// equivalent SQL expression -- keep the two in sync if this changes.
export function nicknameCollisionKey(value: string): string {
  return value.toLowerCase().replace(/[ ._-]/g, '')
}

// Pre-check for onboarding UX -- the AUTHORITATIVE guarantee is the DB unique
// index on the same normalized key (profiles_display_name_normalized_unique,
// reports/studio_nickname_unique_2026-08-19.sql), which is what actually
// closes the simultaneous-signup race this alone cannot. Full-table scan of
// one column; fine at hundreds-to-low-thousands of profiles, revisit if that
// changes.
export async function isDisplayNameTaken(value: string, excludeUserId: string): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('profiles').select('id, display_name').neq('id', excludeUserId)
  const key = nicknameCollisionKey(value)
  return (data ?? []).some((r) => r.display_name && nicknameCollisionKey(r.display_name as string) === key)
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

// Season lock (TK 2026-08-19): the nickname is set at application time and
// locks the moment the participant submits. It is NOT permanent -- it reopens
// when the applicant edits it in a later season's application flow (that UI
// is not built yet, so nothing clears this today; only lockDisplayNameForSubmission
// below ever sets it).
export async function isDisplayNameLocked(userId: string): Promise<boolean> {
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('profiles').select('display_name_locked_at').eq('id', userId).maybeSingle()
  return !!(data?.display_name_locked_at as string | null)
}

// Called EARLY in the prelim submission path (lib/studio.ts), before any row
// is written -- the last gate before the name locks for the season, on the
// CURRENT display_name (the banned-word list may have changed since the
// nickname was last saved). Read-only; refusing here means the submission
// attempt writes nothing, so there is no partial state to unwind.
export async function checkNicknameBeforeSubmission(
  userId: string,
): Promise<{ ok: true } | { ok: false; reason: 'banned_word' }> {
  const admin = createSupabaseAdmin()
  const { data } = await admin.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  const name = (data?.display_name as string | null)?.trim()
  if (name && (await nicknameContainsBannedWord(name))) return { ok: false, reason: 'banned_word' }
  return { ok: true }
}

// Called AFTER the submission row is successfully written. Best-effort: a
// write failure here must not undo an already-accepted submission -- the lock
// only matters for the NEXT edit attempt, not this one. The banned-word gate
// already ran in checkNicknameBeforeSubmission, above.
export async function lockDisplayNameForSubmission(userId: string): Promise<void> {
  const admin = createSupabaseAdmin()
  const { error } = await admin
    .from('profiles')
    .update({ display_name_locked_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) {
    console.error('[nickname] lock write failed (non-fatal, submission already accepted)', { userId, error: error.message })
  }
}
