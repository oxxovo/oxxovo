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

**C1. Deploy `oxxovo-studio` from branch `main`**
(Worker trunk was unified to `main` on 2026-07-31 -- Railway auto-deploys from it, so
main is the deploy of record. `feat/studio-loadtest` was identical at 0350b51 when the
switch was made, which is why unifying cost nothing.)
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

**★C3. App production deploy -- `npm run deploy:prod`** (NOT `vercel deploy` by hand)
- WHAT: the one moment the whole launch actually ships. Production has been a single
  deployment since 2026-07-13 and main is ~216 commits behind, so this is a very large
  single step -- which is exactly why it must be identifiable afterwards.
- The script refuses on a dirty working tree (including UNTRACKED files: `vercel
  deploy` uploads the directory, not the commit -- that is how the reference mockups
  leaked on 2026-07-02), stamps `BUILD_SHA`, and re-reads `/api/version` to confirm the
  stamp reached the build.
- ★VERIFY, and do not skip it because the CLI said "success". Open this in a browser
  (no login, nothing to install):

      https://www.oxxovo.ai/api/version

  Expect `{"sha":"<the commit you meant>","dirty":false,"builtAt":"<a minute ago>"}`.
  - **404** -> the route is not deployed yet, i.e. you are still looking at the
    pre-C3 production. Measured 2026-08-01: production returns 404 here, which is the
    marker that this deploy has not happened.
  - `dirty:true` -> the deploy carried files that are in no commit. The SHA does not
    describe what shipped; redeploy from a clean tree.
  - `sha:"unknown"` -> it was deployed by hand instead of through the script, and this
    deployment is once again unidentifiable. Redeploy through the script.
  - an OLD `builtAt` -> you are looking at a cached/previous deployment, not this one.
  - ★If you prefer a terminal: on Windows PowerShell use `curl.exe`, NOT `curl`. Bare
    `curl` is an alias for Invoke-WebRequest there and prints a different object.
- CAUTION: Vercel git auto-deploy stays OFF (`vercel.json` git.deploymentEnabled.main
  =false). Every production move goes through this command so every one is stamped.

**★C4. Re-confirm REACHABILITY on production, right after C3**
- WHY this exists and is not redundant with Phase D: **D runs on Preview**, and
  production is a different build shipped in one ~216-commit step. "The server
  accepts it" and "a participant can get to the screen that sends it" are different
  claims. On 2026-07-31 every server-side test of asynchronous submission passed
  while the submit form was unreachable, because it was rendered only inside the
  `renderReady` branch. A green Preview E2E would not have caught that on prod.
- Right after C3, before any Phase E flip -- these do not need Studio to be open:
  1. `/api/version` reports the SHA you deployed (above).
  2. `https://www.oxxovo.ai/studio/compose` returns the closed-gate page, NOT a 500
     and not a 404. A 500 here means the build is broken for logged-out users; a 404
     means the route did not ship.
- ★Then, as the FIRST check after `session6_enabled = true` in Phase E, walk the one
  path Preview cannot prove -- **the participant reaching the submit control**:
  - Sign in as the test account, open `/studio/compose`, and confirm the submit form
    is present for a render whose status is `queued` (not only `ready`). The statuses
    that must show it are `ASYNC_SUBMIT_STATUSES` = queued / rendering / uploading /
    ready / failed (`lib/studio.ts`; the editor keeps its own mirrored copy, so a
    change to one and not the other reproduces exactly the 2026-07-31 defect).
  - Reload the page mid-processing and confirm the "accepted, processing" panel comes
    back from the DB rather than an empty editor.
  - Then remove the test entry.
- Ask this of every launch item, not just this one: not "does the feature work" but
  "can a participant get to the screen where it works, on the build that is live".

**★C5. FREEZE: no push to the worker repo during a competition window (the 72h
round). This is a standing rule from launch onward, not a one-time step.**
- THE RULE: **during the 72h window, nothing is pushed to `oxxovo-studio` `main`.**
  If a push is genuinely unavoidable, watch that deploy through to a successful
  boot line before doing anything else -- the push is not finished when git says
  "pushed", it is finished when the new container prints its boot line.
- WHY it is not just caution: Railway auto-deploys `oxxovo-studio` `main` on
  every push. The app does not work this way (Vercel git deploys are off,
  `vercel.json` `git.deploymentEnabled.main=false`), so the two repos do not
  behave alike and the worker's behaviour is the surprising one. A push that
  touches nothing but a comment still rebuilds the image.
- WHY that is dangerous specifically now: the Dockerfile pins ffmpeg
  (`ARG FFMPEG_VERSION=7:5.1.9-0+deb12u1`, 2026-07-31). The pin is deliberate --
  an unpinned renderer changes under us with no record -- but it means the image
  build FAILS the day Debian publishes 5.1.10 and drops 5.1.9 from the archive.
  Nothing announces that day. The break does not surface when Debian releases;
  it surfaces on **the next push, whenever that is**, which is why an unrelated
  one-line push mid-competition is the actual hazard.
- WHAT a push during the window would cost: renders stop for participants who
  are inside a 72h deadline they cannot extend. That is the one time the
  platform cannot absorb a broken worker build.
- IF a push is unavoidable, the boot line is the confirmation, and it reads one
  of four ways (printed by `main()` in the worker's `src/worker.ts`, first log line
  of the new container; the apt epoch `7:` is stripped for the comparison):
  - `ffmpeg=5.1.9-0+deb12u1` -> the deployed binary matches the pin. Proceed.
  - the build fails with the pin string not found -> Debian moved. Bump
    `FFMPEG_VERSION` per the instructions in the Dockerfile, and re-measure the
    parity tables under the new binary
    (`FFMPEG_BIN=... npm run test:parity:transition`) before trusting them --
    `reports/ffmpeg_version_parity_2026-08-01.md` measured that `dissolve` is
    version-dependent, so a version bump is a renderer change, not a build fix.
  - `ffmpeg=<version> ★MISMATCH(pinned ...)` -> the image built but the running
    binary is not the pinned one. Stop.
  - `ffmpeg=MISSING` -> no ffmpeg in the image at all: renders will fail while
    generation keeps working, which is the confusing failure this line exists to
    make obvious.
- ★NOT VERIFIED: whether Railway keeps serving the previous good image when a
  build fails. That is the usual behaviour, and if it holds a failed build is
  loud-but-harmless; nobody here has measured it on this project, so do not plan
  the window around it.
- ★A failed deploy cannot be read from a Claude session -- `railway logs` in
  lane A returns the previous deployment's output. The boot line has to be read
  by whoever has the Railway dashboard.

**★C6. PRICE BEFORE SWITCH: AI music cannot be turned on with one SQL line. This
is a standing rule for the music switch, not a launch-day step.**
- THE ORDER, and it is not interchangeable:
  1. the price key exists in `platform_config` -- today `studio_music_gen_cost_usd`
     (raw provider USD per generation). ★If the vendor bills per second or per
     minute instead, the unit-neutral key that replaces it is what has to be there
     (lane C's open item, `reports/lane_c_handoff_2026-07-30.md`); a per-generation
     key filled in with a per-minute number is a wrong price, not a missing one,
     and nothing below catches that.
  2. THEN `seasons.studio_music_ai_enabled = true` for the season.
- ★If you do 2 without 1, the switch is on and music still does not open. **That
  is the designed behaviour, not a bug to work around.** A missing price key reads
  as 0 (`getMusicGenConfig`, lib/music-gen.ts), and 0 credits does not mean a cheap
  generation -- it means `balance < credits` is `balance < 0`, false for every
  account, so AI music would be free and uncapped-by-balance for anyone including a
  zero-balance account. `creditsForCost` refuses to price at 0, so instead: the
  compose editor withholds the AI music panel (logging
  `AI music is switched ON but unpriced` to the runtime log), and a direct call
  refuses with `music_ai_disabled` + `detail: pricing_unavailable`.
- WHICH SWITCH: the two music switches are both `seasons` columns and they are not
  the same. `studio_music_enabled` (master) only opens the pre-generated library
  picker -- it spends nothing and does not need the price key.
  `studio_music_ai_enabled` is the one that spends. The rule above binds to the AI
  switch; turning the master on alone is a real, safe operating state
  (lib/music-gate.ts documents why).
- VERIFY before flipping (both must be true):
  ```sql
  SELECT key, value FROM platform_config WHERE key LIKE 'studio_music%';
  SELECT id, studio_music_enabled, studio_music_ai_enabled
  FROM seasons WHERE id = '<season>';
  ```
  Measured 2026-08-01: the first query returns **zero rows** -- no music key of any
  kind exists in the live table -- and every season has both switches false. So as
  of today step 1 has not been done, which is correct: the vendor (ElevenLabs) price
  is not settled, and until it is there is nothing to write.

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

- ★**PRICING gate -- no active model may be unpriced.** `cost_per_second_usd` is
  `NOT NULL DEFAULT 0`, so a model onboarded without its probe number is priced
  at zero, and zero is not a cheap generation: every spend path asks
  `balance < credits`, and `balance < 0` is false for every account, so the
  balance check would simply not apply. The code refuses at three layers now (the
  picker withholds it, the enqueue paths refuse with `pricing_unavailable`, and
  `creditsForCost` throws), which means the failure mode at launch is not "free
  generations" but "a participant blocked on a generic error". Confirm it is
  neither, by eye, before opening the doors:
  ```sql
  SELECT id, tier, active, cost_per_second_usd
  FROM model_catalog
  WHERE cost_per_second_usd IS NULL OR cost_per_second_usd <= 0
  ORDER BY active DESC, id;
  ```
  **Expect zero rows.** Measured 2026-08-01: 19/19 rows priced above zero, the
  cheapest at 0.01 -- so a non-empty result means something changed after that
  date, not that this has always been so. An `active=false` row in the result is
  not urgent today and IS the thing that becomes urgent the moment somebody flips
  it in the block above.
  - This is also watched automatically: the season-tick cron runs the same check
    every tick and mails ops when the answer CHANGES (`lib/pricing-health.ts`).
    The manual run here exists because launch day is exactly when nobody wants to
    find out that the mail was going to an unread mailbox.
  - To read the current state without waiting for mail, the tick's JSON response
    carries `pricing.signature` (`ok` when healthy) and the full problem list.

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
