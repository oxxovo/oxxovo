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
import { getPlatformConfigMap } from '@/lib/partners'

// ─── participation axis ─────────────────────────────────────────────────────

export const PARTICIPATION_TIERS = ['anonymous', 'general', 'creator'] as const
export type ParticipationTier = (typeof PARTICIPATION_TIERS)[number]

// membership_status values, mirrored from the profiles CHECK constraint.
export const MEMBERSHIP_STATUSES = ['none', 'active', 'past_due', 'canceled'] as const
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number]

// Statuses that grant creator participation access WHILE within the expiry
// window.
//   active   = subscription live (or founding_free within its term).
//   past_due = renewal payment failed but in Stripe dunning -- access is KEPT so
//              a transient card decline never drops a creator mid-season (TK
//              decision, 2026-06-14). Dunning's final failure flips the sub to
//              'canceled', which removes access.
// 'canceled' is intentionally excluded: cancel-at-period-end keeps the sub
// 'active' (with cancel_at_period_end=true) until membership_expires_at, so the
// window guard handles that grace; only a fully-ended sub becomes 'canceled'.
export const CREATOR_ACCESS_STATUSES: readonly MembershipStatus[] = ['active', 'past_due']

// ─── profile shape + result ─────────────────────────────────────────────────

// Exactly the columns classifyMembership reads. Both axes appear because callers
// often need the orthogonal partner flag in the same pass.
export type MembershipProfile = {
  membership_tier: string | null
  membership_status: string | null
  membership_source: string | null
  membership_started_at: string | null
  membership_expires_at: string | null
  membership_cancel_at_period_end: boolean | null
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
  // Stripe period-end cancel flag (P4d dashboard). Passthrough only -- does NOT
  // affect access (access is gated by status + window above). A 'paid' sub with
  // this true stays creator until expiresAt, then becomes 'canceled'.
  cancelAtPeriodEnd: boolean
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
  'membership_tier, membership_status, membership_source, membership_started_at, membership_expires_at, membership_cancel_at_period_end, founding_creator_number, partner_tier'

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
      cancelAtPeriodEnd: false,
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
  // past_due (Stripe dunning) bypasses the window: the renewal failed so
  // expires_at may already be in the past, but access is kept while Stripe
  // retries -- Stripe bounds the grace and flips the sub to 'canceled' on final
  // failure, which then removes access.
  const storedCreator = profile.membership_tier === 'creator'
  const accessGranting = CREATOR_ACCESS_STATUSES.includes(status)
  const withinGrace =
    status === 'past_due' || withinWindow(profile.membership_expires_at, nowMs)
  const isActiveCreator = storedCreator && accessGranting && withinGrace

  const participationTier: ParticipationTier = isActiveCreator ? 'creator' : 'general'

  return {
    participationTier,
    membershipStatus: status,
    membershipSource: profile.membership_source ?? null,
    startedAt: profile.membership_started_at ?? null,
    expiresAt: profile.membership_expires_at ?? null,
    cancelAtPeriodEnd: profile.membership_cancel_at_period_end ?? false,
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

// ─── P2: Founding Creator claim ─────────────────────────────────────────────
// First N creator signups (N = platform_config membership_founding_free_count)
// get a free creator membership for membership_founding_free_months. The slot is
// claimed from membership_founding_counter; the badge is DERIVED from
// founding_creator_number (no separate flag). All values from config -- no
// hardcoded cap/term.

export type FoundingClaimResult =
  | { outcome: 'claimed'; foundingNumber: number; expiresAt: string }
  | { outcome: 'already_founding'; foundingNumber: number }
  | { outcome: 'already_creator' } // already an active (paid) creator -- no slot taken
  | { outcome: 'quota_full' } // cap reached -> caller routes to the paid path (P4)
  | { outcome: 'disabled' } // membership master switch off (dark launch)
  | { outcome: 'no_profile' } // no profiles row for this user
  | { outcome: 'config_missing' } // cap/months key absent/invalid -> fail closed
  | { outcome: 'error'; reason: string }

// CAS retry backstop. With only ~100 slots real contention is negligible; this
// just bounds a pathological hot loop.
const FOUNDING_CAS_MAX_RETRIES = 8

// Calendar month add (12 months = same date next year). JS rolls month overflow.
function addMonths(fromMs: number, months: number): string {
  const d = new Date(fromMs)
  d.setMonth(d.getMonth() + months)
  return d.toISOString()
}

type AdminClient = ReturnType<typeof createSupabaseAdmin>

// Best-effort slot release after a lost same-user race. Decrements ONLY if the
// counter is still at the value we took (we were the top); otherwise the counter
// has moved on and we leave it -- a leaked slot fails safe (fewer than cap
// granted), never over-grants.
async function releaseFoundingSlot(admin: AdminClient, takenNumber: number): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const { data: cur } = await admin
      .from('membership_founding_counter')
      .select('claimed')
      .eq('id', 1)
      .maybeSingle()
    if (!cur) return
    const claimed = cur.claimed as number
    if (claimed !== takenNumber) return // moved on -> leave it (fail safe)
    const { data: won } = await admin
      .from('membership_founding_counter')
      .update({ claimed: claimed - 1 })
      .eq('id', 1)
      .eq('claimed', claimed)
      .select('claimed')
      .maybeSingle()
    if (won) return
  }
}

// Claim a Founding Creator slot for `userId`. Idempotent per user (never burns
// two slots for one person). SERVER ONLY; call with a service-role context after
// the caller's own gating (P3). Returns a discriminated outcome.
export async function claimFoundingCreator(userId: string): Promise<FoundingClaimResult> {
  // Dark-launch guard: never mutate membership while the master switch is off.
  if (!(await isMembershipEnabled())) return { outcome: 'disabled' }

  const admin = createSupabaseAdmin()

  // 1. Pre-check: skip the slot entirely if the user already holds membership.
  const { data: pre, error: preErr } = await admin
    .from('profiles')
    .select(MEMBERSHIP_PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()
  if (preErr) return { outcome: 'error', reason: preErr.message }
  if (!pre) return { outcome: 'no_profile' }
  const preState = classifyMembership(pre as MembershipProfile, Date.now())
  if (preState.isFoundingCreator) {
    return { outcome: 'already_founding', foundingNumber: preState.foundingNumber as number }
  }
  if (preState.isActiveCreator) {
    return { outcome: 'already_creator' }
  }

  // 2. Config (fail closed on missing/invalid keys -- never invent a cap/term).
  const cfg = await getPlatformConfigMap()
  const cap = Number(cfg.get('membership_founding_free_count') ?? 0)
  const months = Number(cfg.get('membership_founding_free_months') ?? 0)
  if (!Number.isInteger(cap) || cap <= 0 || !Number.isInteger(months) || months <= 0) {
    console.error('[membership] founding config missing/invalid:', { cap, months })
    return { outcome: 'config_missing' }
  }

  // 3. Atomic slot claim via optimistic CAS loop (see file header rationale).
  //    Same guarantees as a single UPDATE...RETURNING: race-safe, gap-free,
  //    cap-atomic -- without a plpgsql RPC ($$ body trips Supabase 42601).
  let foundingNumber: number | null = null
  for (let i = 0; i < FOUNDING_CAS_MAX_RETRIES; i++) {
    const { data: cur, error: rErr } = await admin
      .from('membership_founding_counter')
      .select('claimed')
      .eq('id', 1)
      .maybeSingle()
    if (rErr) return { outcome: 'error', reason: rErr.message }
    if (!cur) return { outcome: 'error', reason: 'founding counter row missing' }
    const claimed = cur.claimed as number
    if (claimed >= cap) return { outcome: 'quota_full' }
    const { data: won, error: uErr } = await admin
      .from('membership_founding_counter')
      .update({ claimed: claimed + 1 })
      .eq('id', 1)
      .eq('claimed', claimed) // CAS guard -- only one concurrent writer wins
      .select('claimed')
      .maybeSingle()
    if (uErr) return { outcome: 'error', reason: uErr.message }
    if (won) {
      foundingNumber = won.claimed as number // == claimed + 1, the ordinal
      break
    }
    // lost the race -> re-read and retry
  }
  if (foundingNumber == null) {
    return { outcome: 'error', reason: 'founding counter contention (retries exhausted)' }
  }

  // 4. Assign to the profile, guarded so a concurrent self-claim cannot
  //    double-assign. Grant: creator/active/founding_free + 12-month window.
  const nowMs = Date.now()
  const startedAt = new Date(nowMs).toISOString()
  const expiresAt = addMonths(nowMs, months)
  const { data: assigned, error: aErr } = await admin
    .from('profiles')
    .update({
      founding_creator_number: foundingNumber,
      membership_tier: 'creator',
      membership_status: 'active',
      membership_source: 'founding_free',
      membership_started_at: startedAt,
      membership_expires_at: expiresAt,
      updated_at: startedAt,
    })
    .eq('id', userId)
    .is('founding_creator_number', null) // guard: only if not already claimed
    .select('id')
    .maybeSingle()

  if (aErr || !assigned) {
    // Lost a same-user race (or row vanished): release our slot so cap headroom
    // is not leaked, then report the already-claimed number if one now exists.
    await releaseFoundingSlot(admin, foundingNumber)
    if (aErr) return { outcome: 'error', reason: aErr.message }
    const { data: now2 } = await admin
      .from('profiles')
      .select('founding_creator_number')
      .eq('id', userId)
      .maybeSingle()
    const n = (now2?.founding_creator_number as number | null) ?? null
    return n != null
      ? { outcome: 'already_founding', foundingNumber: n }
      : { outcome: 'no_profile' }
  }

  return { outcome: 'claimed', foundingNumber, expiresAt }
}

// ─── P3: /apply gate + founding status ──────────────────────────────────────

export type ApplyGateResult =
  | { ok: true }
  | { ok: false; reason: 'membership_required' }
// NOTE: entry_fee enforcement (paid seasons) is a P4 seam -- season 0 entry_fee
// is 0, so the apply gate is membership-only for now. When P4 adds the payment
// record, extend this with an 'entry_fee_unpaid' branch keyed off season.entry_fee.

// Server-authoritative apply gate. Fail-OPEN at every early return so that a
// disabled switch / non-gating config / unreadable state all preserve the
// existing login-only flow (dark launch safety). Only a confirmed
// non-active-creator with the gate ON is blocked.
export async function checkApplyGate(userId: string): Promise<ApplyGateResult> {
  // 1. Master switch off -> gate disabled entirely.
  if (!(await isMembershipEnabled())) return { ok: true }

  // 2. Membership not configured as an apply prerequisite -> no gate.
  const cfg = await getPlatformConfigMap()
  const required = cfg.get('membership_required_for_apply')
  if (required !== true) return { ok: true }

  // 3. Require an active creator membership (expiry-aware, P1 single source).
  const state = await getMembershipState(userId)
  if (!state.isActiveCreator) return { ok: false, reason: 'membership_required' }

  return { ok: true }
}

// UI-facing variant of the gate: exposes whether the gate is active AND the
// current user's creator status separately (checkApplyGate conflates "gate off"
// with "user passes"). Used by the /apply funnel to decide whether to show the
// membership screen. Fail-open (active:false) when the switch is off.
export async function getApplyGateState(
  userId: string,
): Promise<{ active: boolean; isActiveCreator: boolean }> {
  if (!(await isMembershipEnabled())) return { active: false, isActiveCreator: false }
  const cfg = await getPlatformConfigMap()
  const active = cfg.get('membership_required_for_apply') === true
  const state = await getMembershipState(userId)
  return { active, isActiveCreator: state.isActiveCreator }
}

export type FoundingStatus = {
  claimed: number
  cap: number
  remaining: number
  open: boolean
}

// Founding Creator availability for the apply funnel. cap from config; claimed
// from the counter. Fails closed (open:false) if anything is unreadable so the
// UI never invites a claim it can't honor.
export async function getFoundingStatus(): Promise<FoundingStatus> {
  const closed: FoundingStatus = { claimed: 0, cap: 0, remaining: 0, open: false }
  try {
    const admin = createSupabaseAdmin()
    const [cntRes, cfg] = await Promise.all([
      admin.from('membership_founding_counter').select('claimed').eq('id', 1).maybeSingle(),
      getPlatformConfigMap(),
    ])
    if (cntRes.error || !cntRes.data) return closed
    const claimed = Number(cntRes.data.claimed ?? 0)
    const cap = Number(cfg.get('membership_founding_free_count') ?? 0)
    if (!Number.isInteger(cap) || cap <= 0) return { claimed, cap: 0, remaining: 0, open: false }
    const remaining = Math.max(0, cap - claimed)
    return { claimed, cap, remaining, open: remaining > 0 }
  } catch {
    return closed
  }
}
