# Membership P4d -- Cancel + /profile Dashboard (Design)

2026-06-15. Measure-first per TK. Builds on P0~P4c (live, dark launch). No new
migration needed (all columns exist from P0/P4a). dark launch preserved.

## 1. Measurement (what exists)

### Stripe cancel API (SDK 22.2.0)
- `stripe.subscriptions.update(subId, { cancel_at_period_end: true })` -- period-end
  cancel. Sub stays `status:'active'` with `cancel_at_period_end:true` until the
  period boundary; access is KEPT (paid time honored). At the boundary Stripe
  fires `customer.subscription.deleted` -> P4c webhook already sets
  `membership_status='canceled' + expires_at=periodEnd`. After expiry P1
  collapses creator -> general AT READ TIME. No new webhook code.
- Undo (re-enable before boundary): same call with `cancel_at_period_end:false`.
  Fires `customer.subscription.updated` -> P4c `applyFromSubscription` already
  writes `membership_cancel_at_period_end` back to false.
- (Immediate cancel = `stripe.subscriptions.cancel(subId)` -- NOT used: that would
  forfeit paid time.)

### /profile page (app/profile/page.tsx)
- `'use client'`, `ProfilePageInner` loads `loadProfileData()` on mount, renders
  a stack of `<Card title>` blocks inside `max-w-3xl`. i18n via `useT()` ->
  `t.profile.*` (admin-i18n.ts, en+ko blocks). Logout via supabase-browser.
- Insertion point: a new membership card directly under `<ProfileHero>` (top of
  the stack), before the application cards. Visible regardless of whether the
  user has an application row.

### Reusable helpers (no new infra)
- `getCurrentMembership()` / `getMembershipState(userId)` (lib/membership.ts) ->
  participationTier, membershipStatus, membershipSource, expiresAt,
  isFoundingCreator, foundingNumber, isActiveCreator, isPartner.
  GAP: MembershipState does NOT carry `membership_cancel_at_period_end` (not in
  MEMBERSHIP_PROFILE_COLUMNS). P4d needs it to render "will cancel at <date>" vs
  "renews at <date>". -> add `cancelAtPeriodEnd` to MembershipState + the column
  to MEMBERSHIP_PROFILE_COLUMNS (read-only addition, classifier passthrough).
- `getStripe()` (lib/stripe.ts) for the cancel/resume call.
- P4c webhook is the source of truth; the server action only nudges Stripe +
  optimistically mirrors the flag, webhook confirms.

## 2. Design

### Server actions (app/profile/actions.ts, 'use server')
- `loadMembershipDashboard(): Promise<MembershipDashboard>` -- current cookie user
  -> getMembershipState + the cancel flag. Returns a plain serializable object
  (type lives in app/profile/membership-types.ts, since a 'use server' file may
  only export async fns -- same pattern as app/apply/types.ts).
- `cancelMembership(): Promise<MembershipActionResult>`:
  1. user from cookie session; must have stripe_subscription_id + source 'paid'.
  2. `stripe.subscriptions.update(subId, { cancel_at_period_end: true })`.
  3. optimistic `profiles.membership_cancel_at_period_end = true` (webhook
     reconciles). Return ok + new flag.
  - Fail-closed: dark launch (membership_enabled=false) -> refuse; no sub id ->
    'no_subscription'; founding_free (no Stripe sub) -> 'not_cancelable'.
- `resumeMembership(): Promise<MembershipActionResult>` -- same with
  `cancel_at_period_end:false` (undo before the boundary).

### MembershipDashboard shape (membership-types.ts)
```
{ show: boolean            // false => render nothing (dark-launch / non-member)
  tier: 'general' | 'creator'
  status: 'none'|'active'|'past_due'|'canceled'
  source: string | null    // 'founding_free' | 'paid' | null
  expiresAt: string | null
  cancelAtPeriodEnd: boolean
  isFounding: boolean
  foundingNumber: number | null
  canManageStripe: boolean // source==='paid' && has sub id => show cancel/resume
}
```
- `show` = has any membership signal (status !== 'none' || isFounding ||
  tier === 'creator'). In dark launch nobody has these -> card invisible. No
  reliance on membership_enabled for *display of one's own state* (a real
  member should always see their status), but ACTIONS (cancel/resume) still
  fail-closed on the switch so nothing mutates while dark.

### /profile dashboard card (page.tsx)
New `MembershipCard` under ProfileHero, shown only when `dashboard.show`:
- Founding badge: "Founding Creator #N" when isFounding.
- Status line: tier + status (active/past_due/canceled) with tone colors
  (reuse the signup palette: active=emerald, past_due=amber, canceled=white/40).
- Expiry line, source-aware:
  - paid + !cancelAtPeriodEnd -> "Renews on <date>"
  - paid + cancelAtPeriodEnd  -> "Cancels on <date> -- access until then"
  - founding_free             -> "Free until <date>" (no cancel button; nothing
    to cancel in Stripe -- founding members have no subscription)
- Manage button (only canManageStripe):
  - !cancelAtPeriodEnd -> "Cancel membership" -> confirm -> cancelMembership()
  - cancelAtPeriodEnd  -> "Resume membership" -> resumeMembership()
  - past_due -> note "Payment failed -- update your card" (Stripe retries; P4e
    will email). No portal link yet (Stripe Billing Portal = future).

### Flow summary (matches TK)
cancel_at_period_end=true -> sub stays active until expires_at -> creator kept
-> at boundary subscription.deleted -> status canceled -> P1 collapses to general
at read time. Resume before boundary clears the flag.

## 3. No-hardcode / dark-launch / reuse compliance
- No amounts/dates/quotas hardcoded (all from existing config/Stripe).
- Actions fail-closed on membership_enabled (no mutation in dark launch).
- Reuses P1 classifier (single source of truth for expiry), P4c webhook (state
  authority), getStripe. Only additive: cancelAtPeriodEnd on MembershipState +
  3 server actions + 1 card + i18n strings.

## 4. Out of scope (later phases)
- Renewal/expiry email notices -> P4e (email-tick absorption).
- /membership landing (tier comparison, signup CTA) -> after P4e.
- Stripe Billing Portal (self-serve card update) -> future, optional.
