# Studio Credit Purchase — Stripe LAUNCH BLOCKER (2026-07-13)

Status: **BLOCKING launch.** Filed by 지수2 at TK's direction (2026-07-13).
All three items below must be resolved before Studio credit purchase is exposed
to real participants. Until then, top-ups are done by service-role credit
injection (test only) and the Buy button stays hidden (`studio_purchase_enabled`
= false).

## Why this is a blocker (participant deception risk)

- There is a SINGLE `STRIPE_SECRET_KEY` (`lib/stripe.ts`). Membership went LIVE
  on `sk_live_` (2026-06-20). Studio checkout shares that same key — there is no
  Studio-specific key override.
- The "test mode" label on the Buy Credits card is **hardcoded**
  (`app/studio/page.tsx:439`), NOT derived from the actual key. So the label
  reads "test mode" regardless of whether the live key is active.
- Net effect: a participant could click a button that SAYS "test mode" and be
  charged a REAL card. That is deception — it must not ship.

TK decision (2026-07-13): **"나는 Buy 버튼 안 누른다"** — do not click Buy on
Preview until the key scope is verified.

## The three fixes (all required)

### (a) Remove the hardcoded "test mode" label — show the ACTUAL key mode
- `lib/stripe.ts:18` already has `isTestMode()` = `STRIPE_SECRET_KEY` starts with
  `sk_test_`. Use it.
- `getPurchaseOptions()` (`app/studio/actions.ts:42`) must return a server-derived
  `testMode: isTestMode()` boolean (BuyCredits is a client component and cannot
  read server env itself).
- `app/studio/page.tsx:439` (`BuyCredits`): render the "test mode" tag ONLY when
  `opts.testMode === true`; when the live key is active, show no test tag (or a
  real-charge notice). The label must never claim test mode on a live key.
- Acceptance: with `sk_live_` active the Buy card shows NO "test mode" tag; with
  `sk_test_` it does.

### (b) Separate Stripe key scope: Preview = test key, Production = live key
- Vercel env: set `STRIPE_SECRET_KEY` (Preview scope) = `sk_test_…` and
  (Production scope) = `sk_live_…`. Likewise `STRIPE_WEBHOOK_SECRET` per scope
  (test-mode webhook endpoint for Preview, live endpoint for Production).
- Vercel "Sensitive" env cannot be read locally (`vercel env pull` won't show it,
  [[reference_vercel_sensitive_env]]) — verify in the dashboard, and swap via
  CLI rm+add if needed.
- Acceptance: a Preview checkout uses a test key (4242 card, no real charge);
  a Production checkout uses the live key. Confirmed by the resulting
  `stripe_session_id` prefix (`cs_test_` vs live).

### (c) Enable the buy flow at launch
- `platform_config.studio_purchase_enabled` = **true** (currently false —
  2026-07-09 safety default). This is the gate that renders the Buy button
  (`getStudioPurchaseConfig` → `BuyCredits` returns null when disabled).
- Must flip to true ONLY after (a) and (b) are done, alongside
  `session6_enabled` = true at Studio go-live.

## Verification plan (mirrors the 2026-07-08 Tier-1/Tier-2 plan)
- Tier 1 (pre-launch, $0): fix (a); confirm Preview key = test (b); register a
  TEST-mode webhook on the Preview URL; 4242 checkout → webhook → `+credits`
  (type=purchase, `cs_test_`).
- Tier 2 (launch gate, real $): Production live key, a real refundable charge →
  live webhook → credits → refund. Company card.

## Related
- Root cause discovered 2026-07-08 (single-key / hardcoded-label). See
  [[project_studio_realtest_resume]].
- Launch gates: [[project_launch_gates]].
- Credit model: packs $10/$25/$50, credit value $0.10, margin 0.25.
  Seedance 2.0 (premium) $0.3034/s → 15s = 57 credits.
