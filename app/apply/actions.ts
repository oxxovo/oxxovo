'use server'

// Whether the current season's APPLICATION round is studio-based (studio_round
// 'application' or 'both'). When true, /apply is an entry funnel into /studio
// (external-URL entry retired); when false it keeps the external-URL form.
// studio_round lives on the base seasons table, read server-side.

import {
  getSeasonStudioConfig,
  registerForSeason,
  type ApplicantInfo,
  type RegisterForSeasonResult,
} from '@/lib/studio'
import { isSession6Enabled } from '@/lib/session6'
import { getUserOrNull } from '@/lib/user-auth'
import { createSupabaseAdmin } from '@/lib/supabase-admin'
import {
  getApplyGateState,
  getFoundingStatus,
  claimFoundingCreator,
  type FoundingClaimResult,
} from '@/lib/membership'
import {
  createMembershipCheckoutSession,
  type MembershipCheckoutResult,
} from '@/lib/membership-billing'
import type { ApplyMembershipState, MyRegistrationStatus } from './types'

export async function getStudioApplicationFlag(seasonId: string): Promise<boolean> {
  try {
    // Gated by the master switch: when session6 is off, /apply keeps the
    // existing flow with no studio funnel.
    if (!(await isSession6Enabled())) return false
    const cfg = await getSeasonStudioConfig(seasonId)
    return cfg.round === 'application' || cfg.round === 'both'
  } catch {
    // Fail safe to the external form if the season/config can't be read.
    return false
  }
}

// ─── P3 membership gate (client-facing) ─────────────────────────────────────
// ApplyMembershipState lives in ./types (a 'use server' file may only export
// async functions).

const GATE_OFF: ApplyMembershipState = {
  gateActive: false,
  isActiveCreator: false,
  founding: { claimed: 0, cap: 0, remaining: 0, open: false },
}

// Read the membership gate state for the current cookie-session user. Drives the
// /apply funnel: when gateActive && !isActiveCreator the page shows the
// membership screen instead of the form.
export async function getApplyMembershipState(): Promise<ApplyMembershipState> {
  const user = await getUserOrNull()
  if (!user) return GATE_OFF
  const [gate, founding] = await Promise.all([
    getApplyGateState(user.id),
    getFoundingStatus(),
  ])
  return {
    gateActive: gate.active,
    isActiveCreator: gate.isActiveCreator,
    founding,
  }
}

// Explicit Founding Creator claim for the current user (button-triggered, per
// TK decision: explicit consent since a 12-month membership begins). Returns the
// P2 outcome; the page re-reads state on success.
export async function claimFoundingForCurrentUser(): Promise<FoundingClaimResult> {
  const user = await getUserOrNull()
  if (!user) return { outcome: 'no_profile' }
  return claimFoundingCreator(user.id)
}

// Open a paid creator-membership subscription checkout for the current user
// (the Founding-full path). Returns the Stripe Checkout URL for the client to
// redirect to. Fails closed when not signed in or not configured.
export async function startMembershipCheckout(): Promise<MembershipCheckoutResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, reason: 'disabled' }
  return createMembershipCheckoutSession(user.id, user.email)
}

// ─── registration ("신청" -- HQ 2026-08-12) ─────────────────────────────────
// Distinct from submission: registerForSeason mints the genesis_applications
// row with no video, so it can happen weeks before the participant has
// anything to submit. lib/studio.ts's submitGeneration/submitRender fill the
// SAME row in later (by email+season, unchanged pre-existing lookup).

// What the /apply funnel shows before offering the registration form: has
// THIS user already registered (or already submitted) for this season? A
// fresh registerForSeason() call would otherwise either 23505-reject a
// duplicate or, worse, read as "nothing happened" to someone who cannot tell
// why the button did nothing.
export async function getMyRegistrationStatus(seasonId: string): Promise<MyRegistrationStatus> {
  const user = await getUserOrNull()
  if (!user) return { status: 'none' }
  const admin = createSupabaseAdmin()
  const { data } = await admin
    .from('genesis_applications')
    .select('status, free_entry_url')
    .eq('season_id', seasonId)
    .ilike('email', user.email.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return { status: 'none' }
  // free_entry_url IS NOT NULL is the platform-wide "this entry is scorable"
  // contract (lib/scoring-coverage.ts) -- reused here as "already submitted".
  if (data.free_entry_url) return { status: 'submitted' }
  return { status: 'registered', entryStatus: data.status === 'waitlist' ? 'waitlist' : 'pending' }
}

export async function registerForSeasonAction(
  seasonId: string,
  applicant: ApplicantInfo,
): Promise<RegisterForSeasonResult> {
  const user = await getUserOrNull()
  if (!user) return { ok: false, reason: 'failed', detail: 'not signed in' }
  return registerForSeason({ seasonId, userId: user.id, email: user.email, applicant })
}
