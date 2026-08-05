// profiles.partner_status -- the allowed values, mirrored from the column's CHECK.
//
// Extracted out of lib/partners.ts for one reason: lib/partners.ts reaches
// next/headers (via lib/supabase-server) and the email templates, so a unit test
// cannot import it. The list is the thing a test needs -- "every status has an
// answer" only means something if the test is reading the real list rather than
// its own copy of it. Same move as lib/studio-claim-columns.ts and
// lib/text-track-lanes.ts: the logic was right, it was just somewhere tests could
// not reach.
//
// No imports here, deliberately, so it stays reachable from anywhere.

export const PARTNER_STATUSES = [
  'none',
  'auto_eligible',
  'invited',
  'active',
  'suspended',
] as const

export type PartnerStatus = (typeof PARTNER_STATUSES)[number]

// partner_source provenance. 'invitation' = admin-invited; 'auto' = threshold.
export type PartnerSource = 'invitation' | 'auto' | null
