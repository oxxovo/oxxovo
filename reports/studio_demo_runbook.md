# Studio Demo Recording Runbook (8/3 promo)

Record the full Studio funnel (generate -> compose -> render -> submit) for a
promo video **without ever exposing Studio on production** (www.oxxovo.ai).

## Why this is prod-safe

There is ONE shared Supabase project (no separate staging DB). So we do NOT flip
the live `session6_enabled` switch (that would expose Studio on prod). Instead an
env-gated unlock is read **before** the DB switch in `lib/session6.ts`:

```ts
if (process.env.STUDIO_DEV_UNLOCK === 'true') return true   // local/preview only
// ... else falls through to platform_config.session6_enabled (stays false)
```

`STUDIO_DEV_UNLOCK` is set ONLY in:
- local `.env.local` (gitignored), and/or
- the Vercel **Preview** environment.

Production env never gets it -> `www.oxxovo.ai` always falls through to the DB
switch (`false`) -> Studio stays 404-gated for the public. `platform_config.
session6_enabled` is NOT touched and stays `false`.

## Demo lands on the right round automatically

- `getCurrentSeason()` fallback returns the soonest upcoming season -> **season_0**
  (even though it is `draft`; open date 2026-07-01 is still future).
- `season_0.studio_round = 'both'`, `main_round_start_at = 2026-09-03`. Today
  (< 9/3) `resolveEffectiveRound` -> **application** round.
- Compose: enabled, 15-30s, max 10 clips. Generation cap: 10/round.

So the demo runs the APPLICATION-round studio + compose flow with no DB edits.

## Setup

### Option A -- local (simplest, zero prod surface)
1. `.env.local` already has `STUDIO_DEV_UNLOCK=true` (added by setup). Remove the
   line to re-lock locally.
2. Seed the demo account (creates `studio-demo@oxxovo.ai` + 500 credits):
   ```
   node --env-file=.env.local scripts/studio-demo-seed.mjs
   ```
3. Run the worker against the shared DB with cheap models:
   ```
   # in oxxovo-studio:  STUDIO_DEV_MODE=true npm run dev   (forces cheapest model + min duration)
   ```
4. `npm run dev` in oxxovo, log in as the demo account, generate a few clips
   (cheap), then compose -> render -> (optionally) submit. Record. Crop the
   localhost address bar in the edit.

### Option B -- Vercel Preview (looks like a real deployment, SSO-protected)
1. Vercel project -> Settings -> Environment Variables: add `STUDIO_DEV_UNLOCK=true`
   to the **Preview** environment ONLY. Do NOT add it to Production.
2. Push a branch -> open its preview URL (SSO-protected, TK only).
3. Same seed + worker + record steps as Option A. Address bar shows a
   `*.vercel.app` host, not www.oxxovo.ai.

> Recording tip: pre-generate 2-3 ready clips before recording (run the worker
> once) so the compose timeline is populated and there is no dead air waiting on
> generation. The render step polls ~2.5 min max -- pre-cache or cut that wait.

## Cleanup (shared DB -- run after every recording)

All demo data hangs off the single demo user, so cleanup is scoped + safe:
```
node --env-file=.env.local scripts/studio-demo-cleanup.mjs            # dry-run (counts)
node --env-file=.env.local scripts/studio-demo-cleanup.mjs --apply    # delete
```
Wipes the demo user's `render_jobs`, `generation_jobs`, `credit_transactions`,
and `genesis_applications`. Add `STUDIO_DEMO_DROP_USER=true` to also delete the
auth user. Dry-run is the default; nothing deletes without `--apply`.

## Production-safety checklist (before/after)

- [ ] `platform_config.session6_enabled` is still `false` (never flipped for the demo)
- [ ] `STUDIO_DEV_UNLOCK` is NOT in the Vercel **Production** environment
- [ ] After recording: cleanup `--apply` run, demo rows = 0
- [ ] Worker ran with `STUDIO_DEV_MODE=true` (cheap models, no real cost spike)
