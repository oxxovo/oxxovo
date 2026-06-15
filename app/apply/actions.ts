'use server'

// Whether the current season's APPLICATION round is studio-based (studio_round
// 'application' or 'both'). When true, /apply is an entry funnel into /studio
// (external-URL entry retired); when false it keeps the external-URL form.
// studio_round lives on the base seasons table, read server-side.

import { getSeasonStudioConfig } from '@/lib/studio'
import { isSession6Enabled } from '@/lib/session6'
import { getUserOrNull } from '@/lib/user-auth'
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
import type { ApplyMembershipState } from './types'

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
