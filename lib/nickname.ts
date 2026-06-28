// Creator nickname (account-level display name). SERVER ONLY.
//
// One nickname per account (profiles.display_name), shown identically on
// submissions, comments, and likes -- never the email (YouTube-style, TK
// 2026-06-28). Auto-generated on first use (there is no handle_new_user
// trigger, so we ensure the profile row via upsert), editable in /profile.

import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'

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

// Returns the account's nickname, creating one (and ensuring the profile row)
// on first use. Use this on write paths or single-record reads.
export async function getDisplayName(userId: string): Promise<string> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()

  const existing = (data?.display_name as string | null)?.trim()
  if (existing) return existing

  const auto = autoNickname(userId)
  await admin.from('profiles').upsert({ id: userId, display_name: auto }, { onConflict: 'id' })
  return auto
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

// Sets the account nickname (profile edit). Ensures the row exists. Caller
// validates first.
export async function setDisplayName(userId: string, value: string): Promise<void> {
  const admin = createSupabaseAdmin()
  await admin.from('profiles').upsert({ id: userId, display_name: value }, { onConflict: 'id' })
}
