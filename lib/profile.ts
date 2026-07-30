// Account-level creator identity (profiles). SERVER ONLY.
//
// creator_name + country are account-level, not per-entry: collected once and
// prefilled into every later submission form so participants don't re-type them
// (profile/work split, pre-launch item 3). Consents stay per-submission and are
// recorded on genesis_applications, so nothing consent-related lives here.
//
// The profile row is shared with the nickname (profiles.display_name); we upsert
// on the id like lib/nickname does, writing only the columns we own.

import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'
import { ensureProfileRow } from './profile-row'

export type CreatorProfile = {
  creatorName: string | null
  country: string | null
}

// Read the account's saved creator identity. Empty strings normalize to null so
// callers can treat "unset" uniformly.
export async function getCreatorProfile(userId: string): Promise<CreatorProfile> {
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('profiles')
    .select('creator_name, country')
    .eq('id', userId)
    .maybeSingle()
  return {
    creatorName: (data?.creator_name as string | null)?.trim() || null,
    country: (data?.country as string | null)?.trim() || null,
  }
}

// Persist account-level identity on submit. SELF PATH ONLY -- `email` must be the
// caller's own session address (see lib/profile-row.ts for why it is required and
// why there is no admin-API fallback).
//
// 2026-07-28 incident fix: this used to `upsert({id, creator_name, country})`
// WITHOUT email. When the signup trigger was gone and the row did not exist, the
// insert hit profiles.email NOT NULL, failed, and the error was discarded by the
// caller's `.catch(() => {})` -- a silent total loss. Now the row is ensured first
// (which owns the email column) and this writes an UPDATE, so identity persistence
// never depends on being able to insert.
//
// Only non-empty values are written, so a blank field never wipes a previously
// saved name/country, and columns we do not own (display_name, membership, email)
// are never touched. Returns a result instead of throwing: callers treat this as
// non-fatal (genesis_applications already holds the per-entry snapshot) but they
// must be able to LOG it -- silence is what made the incident invisible.
export async function upsertCreatorProfile(
  userId: string,
  email: string,
  fields: { creatorName?: string | null; country?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const patch: Record<string, unknown> = {}
  const name = fields.creatorName?.trim()
  const country = fields.country?.trim()
  if (name) patch.creator_name = name
  if (country) patch.country = country
  if (Object.keys(patch).length === 0) return { ok: true } // nothing to write

  if (!(await ensureProfileRow(userId, email))) {
    return { ok: false, error: 'profiles row unavailable' }
  }

  const admin = createSupabaseAdmin()
  const { error } = await admin.from('profiles').update(patch).eq('id', userId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
