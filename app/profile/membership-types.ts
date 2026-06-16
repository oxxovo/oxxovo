// Shared /profile membership-dashboard types. Plain module (no 'use server' /
// 'server-only') so both the server-action layer (actions.ts) and the client
// page can import it -- a 'use server' file may only export async functions, so
// these display types cannot live there. Mirrors app/apply/types.ts.

import type { MembershipStatus } from '@/lib/membership'

// Serializable snapshot the /profile MembershipCard renders. `show` is false in
// dark launch / for non-members (no membership signal) -> the card renders
// nothing.
export type MembershipDashboard = {
  show: boolean
  tier: 'general' | 'creator'
  status: MembershipStatus
  source: string | null // 'founding_free' | 'paid' | null
  expiresAt: string | null
  cancelAtPeriodEnd: boolean
  isFounding: boolean
  foundingNumber: number | null
  // source === 'paid' && a Stripe subscription exists -> show cancel/resume.
  canManageStripe: boolean
}

export type MembershipActionResult =
  | { ok: true; cancelAtPeriodEnd: boolean }
  | {
      ok: false
      reason:
        | 'unauthenticated'
        | 'disabled' // master switch off (dark launch) -- no mutation
        | 'no_subscription' // no stripe_subscription_id on file
        | 'not_cancelable' // founding_free / non-paid -- nothing to cancel in Stripe
        | 'stripe_error'
    }
