# Railway Deploy Guide -- oxxovo-studio worker

Step-by-step for deploying the Studio generation worker (oxxovo/oxxovo-studio)
to Railway. The worker is a long-running poller: it watches the generation_jobs
queue, calls fal.ai, uploads to Cloudflare R2, and advances job state. It is NOT
a website and has no public URL.

ASCII-only. Do not paste secret VALUES into this file or into chat -- copy them
straight from the local `oxxovo-studio/.env` into Railway's Variables UI.

=====================================================================
0. Prerequisites
=====================================================================
- A Railway account (the same one running oxxovo-scoring is fine).
- Railway has access to the GitHub `oxxovo` account / `oxxovo-studio` repo
  (authorize Railway's GitHub app for the repo if prompted).
- The local file `C:\Users\Tom\oxxovo-studio\.env` is filled in and working
  (we ran the worker locally against it). You will copy each value from there.

=====================================================================
1. Create the service from the repo
=====================================================================
1. Go to https://railway.app  ->  log in.
2. Click  New Project  (or open an existing project and click  + New).
3. Choose  Deploy from GitHub repo.
4. Select  oxxovo/oxxovo-studio.
   - If it is not listed: click "Configure GitHub App" and grant access to the
     oxxovo-studio repo, then come back.
5. Railway detects the `Dockerfile` and `railway.json` automatically.
   - Builder: Dockerfile (already configured in railway.json)
   - Start command: `node dist/worker.js` (already configured)
   - Restart policy: ON_FAILURE (already configured)
   Do NOT change these; they ship in the repo.
6. The first build will start. It will FAIL or crash-loop until you add the
   Variables in step 2 -- that is expected. Add them, then redeploy.

=====================================================================
2. Add Variables  (Service -> Variables -> + New Variable)
=====================================================================
Add each KEY below. For the VALUE, copy the matching line from
`oxxovo-studio/.env` (do not retype secrets; copy/paste to avoid typos --
we already hit one truncated-key bug this way).

  KEY                          VALUE (source)
  ---------------------------  --------------------------------------------
  SUPABASE_URL                 oxxovo-studio/.env  (already a full URL)
  SUPABASE_SERVICE_ROLE_KEY    oxxovo-studio/.env  (long JWT, ~219 chars --
                                 paste the WHOLE thing)
  FAL_KEY                      oxxovo-studio/.env
  R2_ACCOUNT_ID                oxxovo-studio/.env
  R2_ACCESS_KEY_ID             oxxovo-studio/.env
  R2_SECRET_ACCESS_KEY         oxxovo-studio/.env
  R2_BUCKET                    oxxovo-studio/.env  (oxxovo-studio)
  R2_PUBLIC_BASE               oxxovo-studio/.env  (the pub-*.r2.dev URL,
                                 no trailing slash)
  STUDIO_CRYPTOBIND_SECRET     oxxovo-studio/.env  (MUST be byte-identical to
                                 the value in the main app's Vercel env -- a
                                 mismatch makes every submission verification
                                 fail)
  POLL_INTERVAL_MS             5000   (optional; omit to use the default)
  STUDIO_DEV_MODE              false  (IMPORTANT -- see note)

  *** STUDIO_DEV_MODE ***
  Local dev uses true (forces the cheapest model + shortest length so testing
  never burns budget). In production set it to **false** so the worker honors
  the model/duration the participant actually chose. If you are doing a paid
  smoke test first and want to stay cheap, leave it true, then flip to false.

After adding all variables, click  Deploy  (or it redeploys automatically).

=====================================================================
3. Confirm it is healthy
=====================================================================
Open the service -> Deployments -> View Logs. A healthy start looks like:

  OXXOVO Studio worker starting. poll=5000ms devMode=false

Good signs:
- That startup line appears and the service stays "Active" (no crash loop).
- No "must be set in .env" errors (means a Variable is missing/misspelled).
- No "Invalid API key" (means SUPABASE_SERVICE_ROLE_KEY is wrong/truncated).
- If the generation_jobs queue is empty it simply idles quietly (it logs only
  when it claims a job or hits the daily cap) -- that is normal.

To prove end to end after deploy: enqueue one job (via /studio once session6 is
ON, or the seed path), and watch the logs show:
  [job <id>] claimed ... -> fal ok ... -> uploaded to R2 ... -> READY

Daily-cost guard: if you see
  [guard] daily cap reached: N/N generations today
the worker has paused new generations for the day. Raise
`platform_config.studio_daily_generation_cap` to continue (it is intentionally
conservative).

=====================================================================
4. Notes
=====================================================================
- No domain / health-check port needed -- it is a worker, not a web service.
- It shares the same Supabase project as the main app and oxxovo-scoring.
- Redeploys on every push to the repo's default branch (main).
- To stop it: pause or delete the Railway service.
