# Railway Worker Deploy -- Click-by-Click (first-timer)  2026-07-05

For deploying the oxxovo-studio worker (Phase C). Screen-level steps.
Secrets are copied from `oxxovo-studio/.env` -- never retype them, copy/paste to
avoid typos. Do NOT paste secret values into chat.

---

## PART 1 -- fal deposit ($1,500)

1. Go to https://fal.ai and sign in.
2. Open the **Dashboard** -> **Billing** (or Settings -> Billing).
3. **Add credits / Add funds** -> enter **$1,500** -> pay.
4. Open the **Concurrency** page in the dashboard. Within a few minutes the
   limit should read **40** (the paid invoice raised the 4-week rolling tier).
5. NOTE: the 40 tier holds only while the trailing 28-day paid total stays
   >= $1,000. Season-0 generation spend keeps it there; just make sure a fresh
   top-up lands within ~28 days before the 8/30 deadline crush.

CHECKPOINT 1: fal Concurrency page shows limit = 40.

---

## PART 2 -- Railway account + create the service

6. Go to https://railway.app -> **Login** with **GitHub** (use the same GitHub
   account that can see the `oxxovo/oxxovo-studio` repo).
7. **IMPORTANT -- plan**: a worker polls 24/7, so it needs a paid plan
   (Hobby ~$5/mo). The free trial has limited hours and will stop the worker.
   Upgrade under Account -> Plans if prompted.
8. **New Project** -> **Deploy from GitHub repo**.
9. If Railway asks to install its GitHub app, **Configure** it and grant access
   to the `oxxovo` org (or just the `oxxovo-studio` repo).
10. Pick **oxxovo/oxxovo-studio**. Railway creates a service and starts a first
    build. It may build the WRONG branch (main) first -- fix that next.

## PART 3 -- point it at the right branch + Dockerfile

11. Open the service -> **Settings** tab.
12. **Source** -> **Branch** -> set to **`feat/studio-loadtest`** (NOT main --
    this branch has the concurrency lanes + spend guards + ffmpeg).
13. **Root Directory** = leave blank / `/` (the Dockerfile is at the repo root).
14. **Build** -> Builder should auto-detect **Dockerfile**. If it shows Nixpacks,
    switch it to Dockerfile.

## PART 4 -- environment variables

15. Open the **Variables** tab -> add each of these (copy values from
    `oxxovo-studio/.env`; the last three are typed literally):

    | Variable | Value / source |
    |---|---|
    | SUPABASE_URL | .env |
    | SUPABASE_SERVICE_ROLE_KEY | .env (long JWT) |
    | FAL_KEY | .env |
    | R2_ACCOUNT_ID | .env |
    | R2_ACCESS_KEY_ID | .env |
    | R2_SECRET_ACCESS_KEY | .env |
    | R2_BUCKET | .env |
    | R2_PUBLIC_BASE | .env (the pub-*.r2.dev URL) |
    | STUDIO_CRYPTOBIND_SECRET | .env -- **MUST byte-match Vercel** |
    | STUDIO_DEV_MODE | `false` |
    | WORKER_CONCURRENCY | `10` |
    | RENDER_CONCURRENCY | `2` |

16. **DO NOT add `FAL_FAKE`** (it produces fake videos -- load-test only).
    Also skip SEED_*, MAX_SPEND_USD, FAL_FAKE_DELAY_MS.

## PART 5 -- deploy + verify

17. Railway redeploys automatically after variables are saved (or click
    **Deploy**). Wait for the build (ffmpeg install makes it a little slower).
18. Open **Deployments** -> **View Logs**. A healthy start shows:
    `OXXOVO Studio worker starting. poll=5000ms devMode=false gen=10 render=2 fake=false`
19. There must be NO `... must be set in .env` errors (means a Variable is
    missing/misspelled).
20. Optional: Service -> **Shell** -> run `ffmpeg -version` (should print a
    version, not "not found").

CHECKPOINT 2 (paste this log line back to 지수2 to confirm):
  `devMode=false gen=10 render=2 fake=false`

---

## Mistake guards (re-check before leaving Railway)

- Branch = **feat/studio-loadtest** (not main).
- **FAL_FAKE is NOT in the Variables list.**
- STUDIO_DEV_MODE is exactly **`false`** (unset would default to dev = cheapest
  model forced).
- STUDIO_CRYPTOBIND_SECRET is byte-identical to Vercel's (submission verify
  depends on it).
- The service is on a paid plan so it stays up 24/7.
