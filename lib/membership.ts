// Membership classification (participation axis) -- SERVER ONLY.
//
// Two ORTHOGONAL axes (never conflate them):
//   participation = membership_tier  (anonymous | general | creator) -- this file
//   hosting       = partner_tier     (member_tier_config FK)         -- lib/partners.ts
// One person can hold BOTH (an active creator who is also a partner host). The
// classifier therefore returns the participation tier AND a separate isPartner
// flag, not a single merged enum.
//
// Conceptual 4 tiers (TK, 2026-06-14):
//   비회원       = no auth/profile row                 -> participationTier 'anonymous'
//   일반멤버     = logged-in, free, has the vote        -> participationTier 'general'
//   크리에이터   = paid/founding, participation right    -> participationTier 'creator'
//   파트너       = hosting right (orthogonal)            -> isPartner = true (any of the above)
//
// Single source of truth: membership_expires_at gates access. A stored
// membership_tier='creator' whose window has lapsed is downgraded to 'general'
// AT READ TIME, so a not-yet-run renewal/expiry cron can never grant access past
// expiry. is_founding_creator is NOT stored -- derived from founding_creator_number.
//
// Hardcode policy: no magic numbers here. Status/tier names are the contract
// (like config key names). Prices/quotas/free-months live in platform_config and
// are P2+/P4 concerns, not classification.

import 'server-only'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import { getUserOrNull } from '@/lib/user-auth'

// ─── participation axis ─────────────────────────────────────────────────────

export const PARTICIPATION_TIERS = ['anonymous', 'general', 'creator'] as const
export type ParticipationTier = (typeof PARTICIPATION_TIERS)[number]

// membership_status values, mirrored from the profiles CHECK constraint.
export const MEMBERSHIP_STATUSES = ['none', 'active', 'past_due', 'canceled'] as const
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number]

// Statuses that grant creator participation access WHILE within the expiry
// window. Per the v2.1 spec (TK, 2026-06-14) this is 'active' ONLY. Kept as a
// named constant so P4 (Stripe subscription) has ONE seam to extend once the
// real lifecycle states exist -- e.g. whether 'canceled' = cancel-at-period-end
// keeps access until membership_expires_at, and whether 'past_due' gets a
// dunning grace. Those are P4 policy decisions; do NOT pre-add them here.
// (In P0/P1 no row can be 'canceled'/'past_due' yet -- there is no Stripe flow.)
export const CREATOR_ACCESS_STATUSES: readonly MembershipStatus[] = ['active']

// ─── profile shape + result ─────────────────────────────────────────────────

// Exactly the columns classifyMembership reads. Both axes appear because callers
// often need the orthogonal partner flag in the same pass.
export type MembershipProfile = {
  membership_tier: string | null
  membership_status: string | null
  membership_source: string | null
  membership_started_at: string | null
  membership_expires_at: string | null
  founding_creator_number: number | null
  partner_tier: string | null
}

export type MembershipState = {
  // Participation axis, expiry-aware (expired creator collapses to 'general').
  participationTier: ParticipationTier
  // Raw stored membership fields (for display / P5 dashboard).
  membershipStatus: MembershipStatus
  membershipSource: string | null
  startedAt: string | null
  expiresAt: string | null
  // Founding Creator -- derived, single source of truth.
  isFoundingCreator: boolean
  foundingNumber: number | null
  // Orthogonal hosting axis.
  isPartner: boolean
  partnerTier: string | null
  // Convenience derivations.
  isActiveCreator: boolean // participationTier === 'creator'
  canVote: boolean // any logged-in member (general+). Casting itself = season 4.
}

const MEMBERSHIP_PROFILE_COLUMNS =
  'membership_tier, membership_status, membership_source, membership_started_at, membership_expires_at, founding_creator_number, partner_tier'

// ─── pure classifier ────────────────────────────────────────────────────────

// null expires_at = no expiry set (defensive; founding/paid rows always set one).
function withinWindow(expiresAt: string | null, nowMs: number): boolean {
  if (!expiresAt) return true
  const t = Date.parse(expiresAt)
  if (Number.isNaN(t)) return false // unparseable timestamp = treat as expired (fail closed)
  return nowMs < t
}

function normalizeStatus(raw: string | null): MembershipStatus {
  return (MEMBERSHIP_STATUSES as readonly string[]).includes(raw ?? '')
    ? (raw as MembershipStatus)
    : 'none'
}

// Pure, testable. `nowMs` injected so callers/tests control the clock.
export function classifyMembership(
  profile: MembershipProfile | null,
  nowMs: number,
): MembershipState {
  // 비회원 -- no row at all.
  if (!profile) {
    return {
      participationTier: 'anonymous',
      membershipStatus: 'none',
      membershipSource: null,
      startedAt: null,
      expiresAt: null,
      isFoundingCreator: false,
      foundingNumber: null,
      isPartner: false,
      partnerTier: null,
      isActiveCreator: false,
      canVote: false,
    }
  }

  const status = normalizeStatus(profile.membership_status)
  const foundingNumber = profile.founding_creator_number ?? null
  const isFoundingCreator = foundingNumber != null

  // Orthogonal hosting axis -- independent of participation.
  const partnerTier = profile.partner_tier ?? null
  const isPartner = partnerTier != null

  // Creator access = stored tier 'creator' AND an access-granting status AND
  // still inside the expiry window. Any miss collapses to 'general'.
  const storedCreator = profile.membership_tier === 'creator'
  const accessGranting = CREATOR_ACCESS_STATUSES.includes(status)
  const isActiveCreator =
    storedCreator && accessGranting && withinWindow(profile.membership_expires_at, nowMs)

  const participationTier: ParticipationTier = isActiveCreator ? 'creator' : 'general'

  return {
    participationTier,
    membershipStatus: status,
    membershipSource: profile.membership_source ?? null,
    startedAt: profile.membership_started_at ?? null,
    expiresAt: profile.membership_expires_at ?? null,
    isFoundingCreator,
    foundingNumber,
    isPartner,
    partnerTier,
    isActiveCreator,
    canVote: true, // a profile row exists -> at least a general member
  }
}

// ─── DB-reading wrappers ────────────────────────────────────────────────────
// service_role read (mirrors lib/partners.ts): server-only, may look up an
// arbitrary user (founding claim / admin), and bypasses profiles RLS.

export async function getMembershipState(userId: string): Promise<MembershipState> {
  const admin = createSupabaseAdmin()
  const { data, error } = await admin
    .from('profiles')
    .select(MEMBERSHIP_PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    console.error('[membership] profile read failed:', userId, error.message)
    // Fail closed: treat an unreadable profile as anonymous (no access granted).
    return classifyMembership(null, Date.now())
  }
  return classifyMembership((data as MembershipProfile | null) ?? null, Date.now())
}

// Current cookie-session user. Returns the anonymous state when signed out.
export async function getCurrentMembership(): Promise<MembershipState> {
  const user = await getUserOrNull()
  if (!user) return classifyMembership(null, Date.now())
  return getMembershipState(user.id)
}

// ─── master switch (P3 gate dependency) ─────────────────────────────────────
// membership_enabled gates membership SURFACES (/membership, apply gate, claims).
// Separate from classification: classifyMembership reports the truth of a row
// regardless of the switch. Defaults FALSE (dark launch) if missing/unreadable.

export async function isMembershipEnabled(): Promise<boolean> {
  try {
    const admin = createSupabaseAdmin()
    const { data, error } = await admin
      .from('platform_config')
      .select('value')
      .eq('key', 'membership_enabled')
      .maybeSingle()
    if (error || !data) return false
    return String(data.value).trim().toLowerCase() === 'true'
  } catch {
    return false
  }
}
