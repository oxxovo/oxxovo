# Studio Go-Live Checklist -- (가) season 0 full Studio (2026-07-05)

Careful, money-touching. Each step: WHAT it does / HOW to verify / CAUTION.
**Never print secrets to screen. Never expose Studio on prod before 7/25 launch.**
season_0 real data is never touched.

Canonical domain = **www.oxxovo.ai** (oxxovo.com 308-redirects and would make a
Stripe webhook silently fail -- see [[reference-canonical-domain]]).

## ★How to read a number on this list (added 2026-08-08, HQ)

Two rules, both learned from defects that had already shipped and were reading
as green.

**1. A number that reads the same for full coverage and for half coverage is not
answering the question.** Before trusting any count on this list -- or building
one -- write down WHICH TWO INPUTS have to produce different outputs. The
scoring panel counted completed / in_progress / failed, all three being counts
of rows that EXIST, so an entry nobody enqueued was in none of them: full
coverage and half coverage printed the same thing. Applied here: "0 failed" is
not "everything scored", "no warning" is not "the step ran", and an empty result
set is not a pass (C8 says the same thing about `claim_token IS NULL`).

**2. Prefer the check that cannot cancel itself out.** Where a total can be
reached two ways, take the intersection, not the subtraction. Subtracting rows
from entries assumes every row still has an entry behind it; one stray row then
CANCELS a genuinely missing one, and the count comes out clean. ★The failure is
silent and in the reassuring direction -- and that is the direction that gets
shipped, because nobody investigates a number that looks fine.

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

**★B5. Operational alerts must actually ARRIVE (not just be addressed)**
- WHAT: `sendAdminAlert` is how the platform tells us anything went wrong while
  nobody was watching -- pricing problems, deferrals, blocked finalist
  advancement, cron failures. Measured 2026-08-01: the recipient fallback was
  `info@oxxovo.com` and **`OPS_ALERT_EMAIL` is not set in ANY Vercel environment**
  (`vercel env ls`: 17 variables, not among them), so the fallback was live. It
  now falls back to `info@oxxovo.ai`, the company mailbox.
- ★THE SENDER IS A SEPARATE QUESTION with a separate answer, and the ORDER is the
  whole point. Resend rejects a from-address whose domain is not verified in the
  account. On 2026-08-01 the account held exactly one domain (`oxxovo.com`,
  verified 2026-05-19), so setting `EMAIL_FROM` to .ai first would not have moved
  our mail -- it would have stopped it, with a 403 whose only trace is a log line.
  1. verify `oxxovo.ai` in Resend -- **done 2026-08-02** (Cloudflare
     auto-configure; MX/SPF land on the `send` subdomain so the root Google MX is
     untouched). ★Resend **"Enable Receiving" stays OFF**: switching it on
     repoints the root MX at Resend and breaks the receiving that works today. We
     need sending only.
  2. `EMAIL_FROM=info@oxxovo.ai` -- **set 2026-08-02, Production + Preview**, via
     `vercel env rm` + `vercel env add` (the documented path; the value cannot be
     read back afterwards, encrypted).
  3. `OPS_ALERT_EMAIL=info@oxxovo.ai` -- **set 2026-08-02, Production + Preview**,
     explicitly rather than left to the code fallback. A fallback is what saves
     you when configuration is missing, not the configuration.
- ★Env changes take effect on the NEXT deploy, not immediately. Production is
  still pre-C3, so today these are staged for the launch deploy, not live.
- ★Still TK's to confirm (not provable from a CLI session): the two values in the
  Vercel dashboard (encrypted, unreadable after write -- the runtime proof is the
  `[admin-alert] sent to <address>` log line), and which domain Cloudflare Email
  Routing actually RECEIVES `info@` on. The inbound loop guard matches both
  domains and their subdomains, so receiving on either is safe.
- ★VERIFY BY DELIVERY, not by reading the code:
  ```
  node --env-file=.env.local --import ./scripts/test-register.mjs scripts/send-test-alert.mjs          # dry run, sends nothing
  node --env-file=.env.local --import ./scripts/test-register.mjs scripts/send-test-alert.mjs --send   # sends ONE email
  ```
  It calls the real `sendAdminAlert`, prints the exact from/to it will use, and
  prints the Resend message id. **Resend accepting the send is not delivery** --
  ask Resend what became of it:
  ```
  curl -s -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/emails/<id>
  ```
  `last_event` reads `delivered` / `bounced` / `complained`. Even `delivered` is
  Resend's word for "the receiving server accepted it" -- the last check is a
  human finding the subject in the inbox.
- Run 2026-08-02, both directions measured end to end:
  | from | to | Resend `last_event` |
  |---|---|---|
  | info@oxxovo.com | info@oxxovo.ai | delivered |
  | info@oxxovo.ai | info@oxxovo.ai | delivered |
  The second is the configuration that ships. Inbox confirmation is TK's.

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
- ★**And time the first season-tick, because one thing cannot be known before
  this deploy.** `/api/cron/season-tick` declares `maxDuration = 300` and the
  build output carries it (`functions-config-manifest.json`), but whether the
  platform actually grants 300s is not measurable beforehand: Preview sits behind
  Vercel SSO, which answers an automated call with a login page instead of the
  route (measured 2026-08-02). We deliberately did NOT add a protection-bypass
  token to find out -- a bypass on a hosted URL is the thing we refused for
  STUDIO_DEV_UNLOCK, and the same objection applies.
  ```
  curl.exe -s -o NUL -w "%{http_code} %{time_total}s\n" -X POST ^
    -H "Authorization: Bearer <CRON_SECRET>" https://www.oxxovo.ai/api/cron/season-tick
  ```
  Read the JSON's `budget` field: `finalizedThisTick` / `remaining` /
  `selfFinalized`.
  - ★IF IT TIMES OUT, THE ANSWER IS NOT A ROLLBACK. Lower `MAX_FINALIZE_PER_TICK`
    (default 40, e.g. to 10) in the Vercel environment and re-run
    `npm run deploy:prod` on the SAME commit. No code change, no revert -- only
    the tick's workload shrinks, and the buffer just takes more ticks to drain.
    That is why finding out late is survivable: a 24h buffer absorbs a slower
    drain, and nothing else in the tick depends on the cap.
  - ★The re-deploy is NOT optional. Vercel applies env values when a deployment is
    created, so the running production keeps the old cap until a new deployment
    exists -- the same rule already stated under B5. `lib/studio.ts` additionally
    reads the cap once at module load, so even a new deployment's warm instances
    turn over at the next cold start, not mid-tick. Budget ~2 minutes for the
    correction, not zero.
- ★**And check `/api/cron/broadcast-tick` actually FIRED, not just that it is
  registered.** `vercel.json` crons only trigger on Production, so this cannot be
  observed before C3 either -- registering the schedule and Vercel actually
  calling it are different claims (2026-08-12, HQ). After this deploy, open the
  Vercel dashboard's **Cron Jobs tab** and confirm `broadcast-tick` shows a real
  execution at `:07/:22/:37/:52` (its offset from email-tick's `:00/:15/:30/:45`,
  so the two never fire in the same minute). Do this by eye -- a session cannot
  see the Cron Jobs tab.
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
    ready / failed.
  - ★CORRECTION 2026-08-08: "the editor keeps its own mirrored copy" is no longer
    true, and leaving it here would send an operator hunting for a divergence that
    cannot exist. The list lives once in `lib/studio-shared.ts:63`; both
    `lib/studio.ts` and `app/studio/compose/ProComposeEditor.tsx` import
    `isSubmittableRenderStatus` from it, and `lib/studio-shared.test.ts:56`
    **fails the build if either file declares the literal list again** or stops
    referencing the shared one. That test is in the `npm test` list. So the
    2026-07-31 defect can no longer be reproduced by divergence -- ★but the walk
    below still has to happen, because "the gate is correct" and "a participant
    reaches the control the gate protects" remain different claims, and that
    distinction is what this whole step exists for.
  - Reload the page mid-processing and confirm the "accepted, processing" panel comes
    back from the DB rather than an empty editor.
  - Then remove the test entry.
- ★AND, on the first submission that finalizes ASYNCHRONOUSLY (accepted while the
  render was still running, published by a later tick), look at the ENTRY, not the
  tick's report: `genesis_applications.free_entry_url` must be non-null and
  `studio_submission_state` must read `finalized`. The tick reporting a render as
  finalized is a different claim from the entry having the file, and on
  2026-08-03 they came apart for weeks -- the publish write named a column the
  table does not have, PostgREST refused the statement, nobody read the error, and
  the render closed anyway. `free_entry_url IS NOT NULL` is what the scorer reads,
  so an entry without it scores nothing while every log says success. Fixed, but
  it is exactly the kind of thing to confirm on the live build rather than trust.
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

**★C7. Live-database probes are for quiet days. Not during a competition window.**
- THE RULE: **no write probe against the live database during the 72h round.**
  Reading is fine. Writing -- even a throwaway row -- puts a test row in the same
  tables that hold participants' entries, jobs and credits, at the one time
  nobody can afford a mistaken `DELETE` predicate or a probe that outlives its
  cleanup.
- WHY it comes up at all: probing IS the right way to check a failure path.
  On 2026-08-01 the pricing-health check was verified by inserting one unpriced
  model row and watching detect -> alert -> dedupe -> recover -> clean up, which
  no unit test could have shown. That was the correct call **on a quiet day**.
- IF a probe is unavoidable outside a window, all four, every time:
  1. **inactive / invisible**: `active=false`, or a row no participant-facing
     query can return. Never a real row's values, even "temporarily".
  2. **`zz_` prefix on the id**, so a leftover is obvious in any listing and
     sorts to the bottom rather than hiding among real rows.
  3. **cleanup in a `finally`**, so a mid-probe crash still removes it.
  4. **the report states what was created, that it was deleted, and the count
     the table returned to** (2026-08-01: `model_catalog` back to 19 rows). A
     cleanup nobody verified is a cleanup nobody did.
- ★And say whether anything left the building. The same probe would have mailed
  ops if it had run through the cron; it did not, because it called the checker
  directly and only the cron sends. That distinction belongs in the report, not
  in the prober's head.

**★C8. WATCH THE ZOMBIE DEFENCE ACTUALLY FIRE. It has never run in production.**
- WHY this is not paranoia. `render_jobs` was censused on 2026-08-07:
  **20 rows in the whole project, newest created 2026-07-15, zero activity since.**
  The claim-token CAS landed in the worker on 2026-08-02 (`2069b8d`). So the
  defence that stops a revived worker from overwriting the lane that finished
  -- and overwriting its CryptoBind signature -- **has not processed a single
  production render.** It is written, reviewed, unit-tested and UNOBSERVED.
- ★The sentence to stop saying until this step passes: "the zombie defence is
  in." It is in the build. Whether it fires is a different claim, and after
  2026-08-03 (a publish write that named a column the table does not have, ran
  for weeks, and logged success the whole time) that distinction is the whole
  discipline. Reviewed code is not measured code.
- ★PRECONDITION, check it before you run anything: **a worker must be up, and it
  must be the Railway one.** This step is only valid if something claims the row.
  With no worker running you get the third verdict below, which is not a result --
  and it is the state the render lane has actually been in since 2026-07-15.
  Confirm the Railway service is running FIRST, then run the harness; otherwise
  you spend the step and learn nothing.
- HOW, and it costs nothing extra: `npm run test:reachability` already prints
  the verdict (`e2e/reachability-queued-submit.mjs:199`). Read the line:
  - `DEPLOY: the running worker stamps claim_token -> it carries the CAS build`
    -> the defence is live. This is the pass.
  - `★DEPLOY WARNING: the running worker claimed this row and left claim_token
    NULL` -> whatever is deployed is NOT the CAS build. Stop and fix the deploy
    before opening Studio; a second worker on an older image is exactly the
    2026-08-07 duplicate-service situation, and without the token the older one
    can trample a finished render.
  - ★`DEPLOY: row not claimed during the run -- no statement about the deployed
    build` -> **NEITHER of the above.** Added 2026-08-08 after reading
    `e2e/reachability-queued-submit.mjs:205`: the verdict has THREE branches and
    this runbook listed two. It is the branch you will actually hit first,
    because the render lane has had no activity since 2026-07-15 -- most likely
    no worker was running at all. It is not a pass and not a failure; it means
    the step did not execute. Start the worker and run it again. ★Recording it
    as "ran, no warning" is how an unobserved defence gets signed off.
- ★RUNNING THIS COSTS PRODUCTION WORK. The harness enqueues a real render row,
  and whichever worker is up will claim it and spend vendor money on it. It is
  not a read-only check: schedule it with the rehearsal and against the Railway
  worker, never against a local dev worker
  ([[feedback-local-dev-worker-hijacks-prod-jobs]]).
- ★A zero is not a pass here. `claim_token IS NULL` on a terminal row only means
  something if some row in the same window carries one --
  `scripts/inspect-claim-token-null.mjs` prints that control group and refuses to
  imply coverage it does not have. Run it after the render above to see a
  populated token with your own eyes, not an empty result set.
- ★NOT COVERED, say so rather than let the pass read wider than it is:
  `generation_jobs.claim_token` is **NULL on all 53 rows** -- neither deployed
  build writes it (generation-lane tokens arrive in `40fca7f`, not deployed), and
  `r2_key` cannot tell the builds apart either (`attemptToken` is plumbed into
  `uploadVideo` only from the render path). **The generation lane has no
  row-level defence and no row-level forensics.** This step proves the render
  lane only.

**★C8 PLAN (design, not a schedule -- no date below is an instruction to run
this on that date).** HQ asked for a plan because this step had never fired;
the four things a plan needs, named explicitly rather than left implicit in
the prose above:

  1. **PRECONDITION.** A worker must already be running, and it must be the
     Railway one -- never a local dev worker
     ([[feedback-local-dev-worker-hijacks-prod-jobs]]: a local worker can
     silently substitute a cheaper model and still bill the row as if the real
     one ran). Confirm the Railway service is up FIRST. Skipping this check and
     running anyway is how you spend the step and land on verdict 3 having
     learned nothing.
  2. **COST.** One render. The harness reuses the demo account's EXISTING ready
     clips (`generation_jobs` already `status='ready'`) to build the EDL --
     **no fal.ai / AI-generation call, no new vendor spend.** What actually runs
     is one ffmpeg COMPOSE job on the claiming worker (stitch existing clips,
     upload the result to R2) plus one `render_jobs` row, both deleted by the
     harness's own `finally` block. Net cost is Railway compute-seconds for one
     short compose and a transient R2 object -- not zero, but not the
     per-generation vendor cost the earlier bullets warn about. (The one
     residue: the composed output object in R2 outlives the deleted row --
     already tracked as an orphan-object cleanup item, not new here.)
  3. **READING THE THREE VERDICTS** -- already specified above (the DEPLOY /
     ★DEPLOY WARNING / "row not claimed" lines); repeated here only as the
     plan's own checklist item so this section is self-contained: read the
     printed line, not the exit code -- the harness's assertions do not depend
     on which of the three prints.
  4. **WHAT SHIPS UNVERIFIED IF THIS NEVER RUNS.** Not "a defence might be
     missing" in the abstract -- concretely: launch would open on a worker
     image whose claim-token CAS has been reviewed and unit-tested but has
     **never touched a real row**, so the first time it either fires or fails
     to is during the live competition window, against a real participant's
     finalized, CryptoBind-signed render. A silent failure there is a
     participant's winning entry getting silently overwritten by a stale
     worker, discovered only if someone happens to compare hashes -- the exact
     failure this defence exists to prevent, now unverified at the one moment
     it matters most.

  ★**Already partially observed, 2026-08-10** (not a launch-readiness sign-off
  -- see the scope note below): running the approved E2E 8+1 pass included item
  9 (`e2e/reachability-queued-submit.mjs`), which is the same harness this
  section names as "HOW". That run printed
  `DEPLOY: the running worker stamps claim_token -> it carries the CAS build
  (2069b8d)` -- verdict 1, the pass -- against a real Railway-claimed row
  (`worker_started_at` set, `status: rendering`), and `render_jobs` returned to
  the same 20-row baseline afterward with zero leftover, matching this
  section's 2026-08-07 census. This was not run as a deliberate C8
  observation; it was a side effect of running the already-approved E2E gate,
  surfaced here after the fact. **What it proves**: the deployed image carries
  the claim-token-writing code and a real worker exercised it on a real row.
  **What it does NOT prove**: the actual zombie scenario -- a STALE worker
  attempting to reclaim/overwrite a row a second, live worker already
  finished. No two workers raced during this run; only one claimed. That
  contention case stays unobserved and is not something a single run of this
  harness can produce -- it needs a deliberately staged second claim attempt,
  which is future work this plan does not schedule.

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
