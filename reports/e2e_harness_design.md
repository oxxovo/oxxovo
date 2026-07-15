# OXXOVO Season E2E Repeatable Test Harness — Design (2026-07-14)

Approved full build (TK 2026-07-14). Goal: run the entire season lifecycle
(prelim → score → advance → main → score → vote → winners) end-to-end in minutes,
repeatedly (10–20×), with automatic per-stage PASS/FAIL verification, so
"it always works" is proven before launch instead of hand-run once.

## Non-negotiables
- **★Isolation.** Everything is scoped to a dedicated `season_e2e` season. Every
  write and delete carries `WHERE season_id = 'season_e2e'`. The harness NEVER
  touches production or `season_test`. (Today's cross-season pollution is the
  reason this exists.)
- **★Worker poster reproduction (path b).** A stage drives a real compose render
  through the worker and asserts `render_jobs.thumbnail_url != null`. This is how
  the harness catches the Creator547F-class failure — without it the harness is
  pointless.
- **★Mock-first.** Default scoring is mock (synthetic scores, $0). Real Triple-AI
  scoring is opt-in (`--real`) and used only when validating the scorer itself.

## Layout (`e2e/`)
- `lib.mjs` — supabase (service role), `SEASON='season_e2e'`, asset manifest,
  assert framework (`check(name, cond, detail)`), season clone helper.
- `run.mjs` — orchestrator: runs stages in order, prints a checklist report,
  exits non-zero on any FAIL. Flags below.
- Stages are functions in `run.mjs` (teardown, createSeason, seedPrelim,
  score, advance, seedMain, posters, vote, winners, verify).

## Flags
- `--real` : real Triple-AI scoring (invokes oxxovo-scoring batch). Default = mock.
- `--prelim=N` : prelim entry count (default 41).
- `--posters=mock|reuse|worker` : mock=placeholder wire, reuse=existing R2 posters,
  worker=drive real worker + assert auto-generation (path b). Default = mock.
- `--rank-of="<video_title>"` : after main scoring, print that entry's rank +
  sub-scores (for the Integrity-fix before/after comparison — 지수/본체 track).
- `--keep` : skip teardown-at-end (leave season_e2e for inspection).

## Stages
1. **teardown** — delete all `season_e2e` rows in FK-safe order: scoring_results,
   watch_votes/likes/comments/views, render_jobs (of season_e2e apps),
   genesis_applications, then the season row. All `WHERE season_id='season_e2e'`
   (render_jobs by the season_e2e app ids).
2. **createSeason** — clone the `season_test` row → `season_e2e` (override id,
   season_number, display_name); schedule columns set by the time-compression
   driver, not real dates.
3. **seedPrelim(N)** — reuse existing R2 video URLs (source pool = season_test
   prelim `free_entry_url`s) to create N `season_e2e` apps, status=`pending`,
   varied creator_name/country. No generation.
4. **score(round, mode)** — mock: insert `scoring_results` with synthetic
   `verified_score` + sub-scores; real: set the round's gate column to the past
   then invoke `SEASON_ID=season_e2e ROUND=<round> node dist/batch.js`.
5. **advance** — rank prelim by verified_score, take top `advance_pct` clamped
   `[advance_min, advance_max]` → status=`selected` (finalists).
6. **seedMain(mode)** — set `main_round_video_url` on finalists (reuse the 10 CF
   URLs), status=`main_round_submitted`. Posters per `--posters`:
   - mock: create marker render_jobs + wire studio_main_render_id (no upload).
   - reuse: point to the posters already in R2.
   - worker: submit a real compose → poll worker → assert thumbnail_url != null.
7. **vote** — set community_vote window to open (past start / future end),
   simulate votes across main entries (respecting community_vote_max_per_user).
8. **winners** — rank by `computeFinalScore` (Soak: final==AI; season1+: weighted)
   → set award_rank 1/2/3, status=`awarded`.
9. **verify** — the checklist (below). Prints ✓/✗ per item; any ✗ → exit 1.

## Time compression
No real waiting. Before each gated stage the orchestrator sets that stage's gate
column (`application_close_at` / `main_round_end_at` / `community_vote_*` /
`awards_announcement_at`) to the past. Total run time ≈ the actual work (scoring
is the only real cost; mock makes it seconds).

## Verification checklist (each ✓/✗ with detail)
- prelim scoring: N scored, scores 0–100, **cross-season leak = 0** (every result
  app ∈ season_e2e)
- advancement: exactly K finalists, statuses correct
- main videos: 10 with main_round_video_url, all Watch-public
- **posters**: main card thumbnail resolves to a poster for 10/10; prelim cards
  uncontaminated (10/10); **no null thumbnail_url on any main render**
- main scoring: 10 scored round=main, leak = 0
- ranking: top-3 by final_score; computeFinalScore matches a recomputation
- vote tally: votes counted; final_score = AI×w + community×w
- Watch display (data layer): main section = 10, prelim finalist section = 10,
  gallery excludes finalists (no duplication), judging bar = main pool
- email: lifecycle triggers fired / logged (where applicable)

## Integrity-fix regression hook (TK 2026-07-14)
`--real --rank-of="Her Gaze"` re-scores and prints that entry's rank + sub-scores
(intent/exec/orig/integrity). Run before and after 지수/본체 fixes the Integrity
axis to confirm the hand+cream breakthrough moves up. The harness records each
run's ranking so before/after is a diff.

## Cost (measured 2026-07-14)
- per scoring: Kling 27s ≈ $0.42, Seedance 15s ≈ $0.21.
- full real run (41 prelim + 10 main) ≈ **$12–18**.
- mock run = **$0**. Default. CFs reused → generation cost = 0.

## Scale
~3–4 days: orchestrator + stages (2), verify module (1), mock/real + worker-poster
reproduction (1). Built in `e2e/`, invokes the scoring batch from oxxovo-scoring.
