# Studio Go-Live Checklist -- (가) season 0 full Studio (2026-07-05)

Careful, money-touching. Each step: WHAT it does / HOW to verify / CAUTION.
**Never print secrets to screen. Never expose Studio on prod before 7/25 launch.**
season_0 real data is never touched.

Canonical domain = **www.oxxovo.ai** (oxxovo.com 308-redirects and would make a
Stripe webhook silently fail -- see [[reference-canonical-domain]]).

---

## Phase 0 -- already LIVE (verified 2026-07-05, do NOT re-run)

DB introspection confirmed these migrations are already applied:
- `render_jobs` table EXISTS (compose phase 1)
- season_0 compose params: compose_enabled=true, min 15s / max 30s / 10 clips,
  round='both', max_generations_per_round=10
- `model_catalog`: 6 active models (ltx2-fast, veo31-lite, sora2-std,
  kling-v3-pro, seedance2, veo3.1) + 2 retired (inactive)
- `genesis_applications` render link columns EXIST
- platform_config: margin 0.25, credit value 0.10, packs 10/25/50, daily cap 20,
  studio_purchase_enabled=false, session6_enabled=false

So the ONLY pending schema change is the budget guard (Phase A).

---

## Phase A -- migration (Supabase SQL Editor, TK runs)

**A1. `reports/studio_budget_guard_2026-07.sql`** -- the only pending migration.
- WHAT: adds 3 platform_config keys (studio_daily_budget_usd=500,
  studio_fal_deposit_usd=1500, studio_fal_min_balance_usd=100) that activate the
  worker's fal spend guards. Idempotent UPSERT.
- VERIFY: the file's trailing SELECT returns 3 rows with those values.
- CAUTION: none -- config-only, no data touched. Worker already runs without it
  (guards default off); this just turns them on.

(Not needed for purchase go-live, separate track: `two_stage_final_removal`
runs only AFTER the studio code is deployed to prod. Skip for now.)

---

## Phase B -- secrets / env (careful; do NOT echo values)

**B1. Stripe live secret key** -- `STRIPE_SECRET_KEY` (Vercel, prod)
- WHAT: the live key. Already live (shared with membership).
- VERIFY: Vercel env has `STRIPE_SECRET_KEY` starting `sk_live_` (do not print it;
  just confirm it exists + prefix in the Vercel UI).

**B2. Studio Stripe webhook + signing secret** -- `STRIPE_WEBHOOK_SECRET` (Vercel)
- WHAT: credits are granted ONLY by the webhook. It verifies the signature with
  this secret.
- STEPS (Stripe Dashboard, **Live mode**):
  1. Developers -> Webhooks -> Add endpoint.
  2. URL = `https://www.oxxovo.ai/api/studio/stripe-webhook`  (★ www + .ai)
  3. Event = `checkout.session.completed` (that one is enough).
  4. Copy the `whsec_...` signing secret -> set Vercel env `STRIPE_WEBHOOK_SECRET`.
- VERIFY: after B2 + a test event (Phase D), the endpoint shows 200s in the
  Stripe webhook log.
- CAUTION: this is SEPARATE from membership's `STRIPE_MEMBERSHIP_WEBHOOK_SECRET`
  -- do not overwrite that. If the URL uses .com or bare oxxovo.ai it 308s and
  the webhook fails silently (no credits granted).

**B3. CryptoBind secret parity** -- `STUDIO_CRYPTOBIND_SECRET`
- WHAT: worker (Railway) and app (Vercel) must sign with the byte-identical
  secret, or submission verification fails.
- VERIFY: confirm the value is set in BOTH Vercel and Railway and is identical
  (compare a hash of each, not the value on screen).

**B4. Moderation key** -- `OPENAI_API_KEY` (Vercel)
- WHAT: the pre-generation prompt moderation gate calls OpenAI (free endpoint).
- VERIFY: Vercel env has `OPENAI_API_KEY`. If absent, the gate fails OPEN
  (generation still works, but no prompt moderation).

---

## Phase C -- worker deploy (Railway)

**C1. Deploy `oxxovo-studio` from branch `feat/studio-loadtest`**
- WHAT: this branch has the concurrency lanes, fal retry, and spend guards.
  ffmpeg is in the Dockerfile (compose render).
- ENV to set on Railway:
  - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FAL_KEY, R2_* (from oxxovo-studio/.env)
  - STUDIO_CRYPTOBIND_SECRET (byte-match Vercel -- B3)
  - `STUDIO_DEV_MODE=false`  (honor the participant's chosen model/duration)
  - `WORKER_CONCURRENCY=10`  RENDER_CONCURRENCY=2  (start; scale instances later)
  - **`FAL_FAKE` MUST BE UNSET** (set only in load tests; it produces fake videos)
- VERIFY: Railway logs show `worker starting ... gen=10 render=2 fake=false`
  and no "must be set" errors. `ffmpeg -version` works in the Service shell.
- CAUTION: with session6 OFF + season_0 draft there are no real jobs yet, so a
  worker deployed now sits idle safely. Confirm FAL_FAKE is not present.

**C2. fal prepaid deposit** -- $1,500 (approved)
- WHAT: fund the fal account so the 4-week rolling window puts us at the 40
  concurrency tier and generations have balance. Bump `studio_fal_deposit_usd`
  to match every top-up so the low-water guard is accurate.
- VERIFY: fal dashboard Concurrency page shows the raised limit within minutes.

---

## Phase D -- E2E (order matters; no prod exposure)

Decision (TK, 2026-07-05): D1 = PRODUCT flow only (no payment), D2 = the single
live money test. Rationale: STRIPE_SECRET_KEY is shared + already live (membership
proved the identical live payment code), so running Stripe test-mode on Preview
would need divergent test keys = extra mistake surface. So we do not test-charge;
we fund D1 with promo credits and validate the money path once, live, in D2.

**D1. Product flow on Vercel Preview, funded by promo credits (NO Stripe)**
- WHAT: on Preview (STUDIO_DEV_UNLOCK set on Preview, never Production), a test
  user is granted credits via admin adjust, then: generate (real fal, small
  budget model) -> compose render -> submit.
- FUND: `node --env-file=.env scripts/credits-admin.mjs <test-email> grant 200 e2e_d1`
- VERIFY: `verify-credits.mjs` shows the grant; job -> ready; render -> ready;
  submission writes studio_application_render_id (application round). No Stripe,
  no prod exposure.
- CLEANUP: `scripts/credits-admin.mjs <test-email> zero e2e_d1_cleanup` + remove
  the test job/render/application rows.

**D2. Controlled Stripe LIVE money-path (one real purchase, then refund)**
- WHAT: mirror the membership go-live check -- ONE real $10 live purchase ->
  webhook -> credits granted -> refund + zero the unused balance.
- STEPS:
  1. Real $10 purchase through the live checkout (smallest pack).
  2. `verify-credits.mjs <email>` -> balance +100, a `purchase` row with a
     stripe_session_id; Stripe webhook log shows 200.
  3. Refund the $10 in the Stripe dashboard.
  4. `credits-admin.mjs <email> zero refund_unused` -> balance back to 0.
  5. `verify-credits.mjs <email>` -> balance 0.
- CAUTION: real money. Exactly one. Refund AND zero (step 3 + 4) -- refunding
  cash without zeroing leaves the user spendable credits. Confirms whsec + live
  keys end to end without opening Studio to the public.

---

## Phase E -- LAUNCH flips (7/25, the ONLY prod-exposure step)

Do these at launch, not before:
- `studio_purchase_enabled = true` (platform_config)
- `session6_enabled = true` (master switch -- opens Studio on prod)
- season_0 auto-activates draft->active at application_open_at (7/25 00:00 PT);
  confirm studio_round + schedule.
- ★**Stage 3 model_catalog active GATE** -- BEFORE flipping session6, confirm the
  AI-actor models' `active` flags are INTENTIONAL, not test residue. The Stage 3
  routine E2E (`e2e/stage3.mjs`) flips nano-banana-pro / flux2-pro-image /
  kling-v3-pro-i2v to active=true in test scope and reverts on teardown, but a
  SIGKILL mid-run could leave one active. Run this and confirm the result matches
  the launch intent (all false until the 2.5 AI-actor UI is intentionally
  launched):
  ```sql
  SELECT id, active FROM model_catalog
  WHERE id IN ('nano-banana-pro','flux2-pro-image','kling-v3-pro-i2v','ideogram-character','ideogram-character-draft')
  ORDER BY id;
  ```
  (The E2E also self-guards: it ABORTS if any target model is already active on
  startup, so a leftover is caught at the next run too.)

- ★**Submission-moderation PROD live check (right before/at launch)** -- the
  submission gate (`moderateSubmission`, lib/moderation.ts) scans the creator
  statement and FAILS SAFE to `moderation_status='pending'` (NOT public) when the
  prod `OPENAI_API_KEY` is missing/invalid. So a mis-wired prod key = EVERY entry
  silently stuck pending = **no videos ever appear on /watch** on launch day.
  A2 proved the gate logic (unit `npm test` 23/23 + CI) but the PROD wiring needs
  one live eyeball: after session6 is on, submit ONE clean test entry on prod and
  confirm `moderation_status='approved'` + it shows on /watch (clean content passes,
  not silently all-pending). If it lands 'pending', the prod OPENAI key is the
  culprit -- fix before real participants submit. (Distinct from B4, which is the
  pre-generation PROMPT gate that fails open; this is the submission gate that
  fails safe.) Cleanup the test entry after. Live proof harness for a keyed env:
  `e2e/moderation-gate.mjs`.

Until Phase E, checkout is double-gated (session6 AND purchase both off), so
nothing is buyable/visible on prod even after Phases A-D.
