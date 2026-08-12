# Studio Credits -- Refund & Chargeback Policy (2026-07-05, TK approved)

Welcome credits are retired: every credit is participant-purchased, so refund
and chargeback exposure are the residual money risks (see
[[project-studio-season0-full-load]]).

## 1. Refund policy -- UNUSED credits only (confirmed)

- A refund returns the USD value of the participant's **current unspent
  balance** only. **Consumed credits are never refunded** (the fal generation
  cost was already incurred).
- Mechanism (uses existing pieces, no new ledger type):
  1. `getBalance(userId)` -> current credits.
  2. Stripe refund for `balance * studio_credit_usd_value` USD (partial refund of
     the original payment intent, or a manual refund).
  3. Post a negative `admin_adjust` row for the refunded credits (reason =
     `refund_unused`, actor = admin) so the ledger nets to zero and the credits
     cannot be spent after the cash is returned.
- Ordering matters: **zero the balance (step 3) BEFORE/atomically with the Stripe
  refund** so a user cannot spend during the refund window. Implement as one
  admin action (`refundUnusedCreditsAction`) -- small build, on the admin
  credits page. Until built, do it manually in the same order.
- Breakage (credits bought, never used, never refunded) stays on the books as a
  float liability; it is not recognized as revenue until spent or expired. A
  credit-expiry policy is a later decision (not needed for season 0).

## 2. Chargeback defense

A chargeback after generation = we lose the fal cost + the consumed credits + the
chargeback fee. Layered defense:

- **Stripe Radar** (dashboard config, no code): enable default fraud rules;
  add rules for new-email + high-velocity purchases. Review flagged before
  capture where possible.
- **Auth gate** (already in place): purchase requires a verified logged-in
  account (`/api/studio/checkout` verifies the token). No anonymous buys.
- **First-purchase ceiling** (optional small build): cap a brand-new account's
  first purchase to the smallest pack ($10) until it has a settled payment, so a
  stolen card cannot buy $50 and burn it before the chargeback lands.
- **Velocity + value caps already present**: per-round generation cap
  (`studio_max_generations_per_round`) + the daily fal budget circuit breaker
  bound how much value a single abuser can extract per round/day.
- **Chargeback handling**: on a `charge.dispute.created` webhook, flag the user,
  freeze remaining balance, and block further purchases pending review. (Webhook
  handler = follow-up build; not a launch blocker.)
- **Moderation gate** (shipped): a flagged prompt never spends fal, cutting one
  abuse vector before it costs anything.

## 3. What is NOT a loss

- Failed generations: worker refunds credits; fal does not bill failures ->
  net neutral.
- Rounding (`ceil` on credits charged): always favors the platform.
- fal 40-concurrency tier: absorbed by generation spend (rolling 4-week window),
  not additive (see [[project-studio-season0-full-load]]).
