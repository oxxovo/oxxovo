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

// Persist account-level identity on submit (ensures the profile row via upsert).
// Only non-empty values are written, so a blank field never wipes a previously
// saved name/country, and other profile columns (display_name, membership) are
// left untouched (ON CONFLICT updates only the keys we send).
export async function upsertCreatorProfile(
  userId: string,
  fields: { creatorName?: string | null; country?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = { id: userId }
  const name = fields.creatorName?.trim()
  const country = fields.country?.trim()
  if (name) patch.creator_name = name
  if (country) patch.country = country
  if (Object.keys(patch).length === 1) return // only the id -> nothing to write
  const admin = createSupabaseAdmin()
  await admin.from('profiles').upsert(patch, { onConflict: 'id' })
}
