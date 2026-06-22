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

## TK recording path (which is easiest)

KEY CONSTRAINT: both generation AND compose-render are processed by the **worker**
(queue -> fal / ffmpeg -> R2). So whichever surface TK records, **a worker must be
running** during the session, or Generate/Render hang at "queued". This decides
the path:

| Path | TK setup | Needs |
|------|----------|-------|
| **B. Vercel Preview URL** (browser only) | **minimal -- just open URL + log in** | `STUDIO_DEV_UNLOCK=true` in Vercel **Preview** env + a worker running (Railway `STUDIO_DEV_MODE=true`, or 지수2 runs it locally during the session) |
| **A. Local `next dev`** | runs 2 commands locally | `next dev` (oxxovo) + `npm run worker` (oxxovo-studio, `STUDIO_DEV_MODE=true`) |

**Recommendation:** Path **B (Preview URL)** is easiest for TK -- browser-only, no
CLI -- **once a worker is running**. Since the worker is not on Railway yet, the
reliable way today is: 지수2 keeps a local worker running (shared DB, DEV_MODE=true)
during the recording window while TK records the SSO-protected preview URL. When
the worker lands on Railway, Path B becomes fully hands-off for TK.

Procedure (Path B):
1. Vercel -> Settings -> Env Vars: add `STUDIO_DEV_UNLOCK=true` to **Preview** only.
2. Deploy a preview (push the branch) -> open its `*.vercel.app` URL (SSO -> TK).
3. Ensure a worker is running against the shared DB (`STUDIO_DEV_MODE=true`).
4. Log in as `studio-demo@oxxovo.ai`. The 4 pre-cached clips are already ready in
   the compose picker -> drag/trim/sequence -> Preview -> Make final -> records live.
5. Cleanup (below).

**Pre-cached demo material (live dry-run 2026-06-21):** the demo account already has
**4 ready clips** (real fal gen via DEV_MODE = ltx2-fast 6s, ~$0.24 each, R2-hosted)
so the compose timeline is populated instantly -- no waiting on generation during
recording. A full compose render (4 clips -> 16s, ffmpeg stitch -> R2 -> v1sc) was
verified end to end. Re-seed/refresh with `studio-demo-seed.mjs` if cleaned.

## Polish in a recording (rough edges + how to cover)

From the UI: interactions are smooth; the rough edges are the **wait windows**:
- Generation status is text-only (`queued -> generating -> uploading -> ready`), no
  spinner; a 10-60s "generating" with no animation = dead air. **Cover:** use the
  pre-cached clips (skip live generation), or speed-ramp/jump-cut the wait.
- "Make final" render polls ~2.5min with text status, no progress bar. **Cover:**
  jump-cut from click to the finished video.
- Submit uses a native `window.confirm` dialog (unstyled). **Cover:** don't show the
  submit step, or accept the quick blip.
- The compose editor itself (drag, trim, sequence, Preview playback) is smooth and
  is the visually compelling part -- record that at full length.

Net: roughness is concentrated in the async waits and is **fully editable** with
cuts/speed-ramps. The interactive compose flow needs no editing.

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
