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

**D1. Full-flow on Vercel Preview, Stripe TEST mode**
- WHAT: register -> buy credits (test card) -> generate (real fal, small) ->
  compose render -> submit. Uses STUDIO_DEV_UNLOCK on Preview (never Production).
- VERIFY: credits granted by webhook, job -> ready, render -> ready, submission
  writes studio_application_render_id. No prod exposure.

**D2. Controlled Stripe LIVE money-path (one real purchase)**
- WHAT: mirror the membership go-live check -- ONE real $10 live purchase ->
  webhook -> credits granted -> then refund the unused credits (Phase policy).
- VERIFY: credit_transactions has the purchase row (idempotent), balance +100,
  Stripe webhook 200, refund returns the $10.
- CAUTION: real money. Do exactly one, refund after. Confirms whsec + live keys
  end to end without opening Studio to the public.

---

## Phase E -- LAUNCH flips (7/25, the ONLY prod-exposure step)

Do these at launch, not before:
- `studio_purchase_enabled = true` (platform_config)
- `session6_enabled = true` (master switch -- opens Studio on prod)
- season_0 auto-activates draft->active at application_open_at (7/25 00:00 PT);
  confirm studio_round + schedule.

Until Phase E, checkout is double-gated (session6 AND purchase both off), so
nothing is buyable/visible on prod even after Phases A-D.
