-- ======================================================================
-- Two writes, both on public.seasons. TK Run, one block at a time.
-- ASCII only, LF only. Head office 2026-08-10.
--
-- WRITE A -- season_0.community_vote_start_at/end_at: 11/12,11/15 PT
--            (pre-buffer values) -> canonical v2 11/13,11/16 PT.
--            WHY: the 24h main-round processing buffer was added after
--            the vote window was last set, and the DB was never moved
--            to match. November is PST (UTC-8, past the 2026-11-01 DST
--            end), so both values are written as
--            TIMESTAMP ... AT TIME ZONE 'America/Los_Angeles' (same
--            pattern as a82f1ca), not hand-computed UTC.
--
-- WRITE B -- season_test / season_test2 . application_open_at -> NULL.
--            WHY: getCurrentSeason() (lib/seasons.ts) picks the most
--            recently OPENED season (application_open_at <= now,
--            ordered desc) with NO is_fixture filter. season_0's own
--            application_open_at already sits at 2026-09-09 (measured
--            2026-08-10, set outside this repo on 2026-08-08) and
--            season_1..4 are NULL, so right now the only non-null past
--            open date left in the table is season_test's
--            (2026-07-06) -- and it wins the pick. Landing, /apply and
--            the Watch hero panel are currently showing that closed
--            rehearsal season instead of season_0. This is the exact
--            same prescription already run for season_1/2/3/4
--            (reports/season1_clear_stale_schedule_2026-08-04.sql,
--            reports/seasons_2to4_open_null_2026-08-03.sql): NULL is
--            the value the code already designs for -- a null
--            application_open_at can never win the "opened" branch and
--            is excluded from the "soonest upcoming" fallback too.
--            application_open_at ONLY. application_close_at is left as
--            is -- getCurrentSeason() never reads it, and season_test /
--            season_test2 are terminal (completed / closed), not
--            'upcoming', so the status-cycling risk the season_1..4
--            file guarded against does not apply here.
--
-- application_open_at is NOT being moved for season_0. Head office
-- decision 2026-08-10: canonical v2 says 9/9, but moving it (or leaving
-- it there) is what created the WRITE B problem in the first place --
-- season_1..4 all have open=NULL, so there is nothing for
-- getCurrentSeason() to fall back to except a rehearsal fixture. This
-- file does not touch season_0.application_open_at at all.
--
-- Verified separately (no write): app/api/apply/route.ts:117-118 still
-- 403s ('season_closed') on any submit attempt while the "current"
-- season resolves to season_test, because season_test's own
-- application_close_at (2026-07-11) is long past. Studio's submit path
-- is gated earlier by isSession6Enabled(), measured false in production.
-- So no live path exists today for a real applicant to actually reach a
-- submission -- the bug is display-only (dead countdown, wrong CTA
-- copy, wrong hero stats), not a data-integrity risk. No action needed
-- there.
--
-- To revert if a verify block fails: ask in this same chat and the
-- rollback will be sent as its own message. It is not in this file.
-- ======================================================================


-- ----------------------------------------------------------------------
-- BLOCK 0 -- BEFORE. Read-only. Run alone.
--
-- STOP CONDITION: both safe_to_proceed columns must be TRUE.
--   TRUE  = the rows still hold the instants measured 2026-08-10, so
--           WRITE A / WRITE B below are accurate. Continue.
--   FALSE = someone changed it since. DO NOT run the matching write
--           block. Send this output back first.
-- Expect exactly THREE rows: season_0, season_test, season_test2.
-- ----------------------------------------------------------------------
SELECT
  id,
  status,
  community_vote_start_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_start_pt,
  community_vote_end_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_end_pt,
  application_open_at
    AT TIME ZONE 'America/Los_Angeles' AS open_pt,
  (
    id = 'season_0'
    AND community_vote_start_at =
          TIMESTAMP '2026-11-12 00:00' AT TIME ZONE 'America/Los_Angeles'
    AND community_vote_end_at =
          TIMESTAMP '2026-11-15 00:00' AT TIME ZONE 'America/Los_Angeles'
  ) AS safe_for_write_a,
  (
    id IN ('season_test','season_test2')
    AND application_open_at IS NOT NULL
    AND (
      (id = 'season_test'  AND application_open_at =
        TIMESTAMPTZ '2026-07-06 00:59:18.917+00')
      OR
      (id = 'season_test2' AND application_open_at =
        TIMESTAMPTZ '2026-07-01 00:00:00+00')
    )
  ) AS safe_for_write_b
FROM public.seasons
WHERE id IN ('season_0','season_test','season_test2')
ORDER BY id;


-- ----------------------------------------------------------------------
-- WRITE A -- community_vote dates. RETURNING via CTE (Supabase SQL
-- Editor hides plain UPDATE row counts). Run alone.
--
-- Expect: exactly 1 row, vote_start_pt=2026-11-13 00:00,
-- vote_end_pt=2026-11-16 00:00.
--   ZERO rows means the guard refused -- nothing was written. Stop and
--   report back, do not retry.
-- ----------------------------------------------------------------------
WITH upd AS (
  UPDATE public.seasons
     SET community_vote_start_at =
           TIMESTAMP '2026-11-13 00:00' AT TIME ZONE 'America/Los_Angeles',
         community_vote_end_at =
           TIMESTAMP '2026-11-16 00:00' AT TIME ZONE 'America/Los_Angeles'
   WHERE id = 'season_0'
     AND community_vote_start_at =
           TIMESTAMP '2026-11-12 00:00' AT TIME ZONE 'America/Los_Angeles'
     AND community_vote_end_at =
           TIMESTAMP '2026-11-15 00:00' AT TIME ZONE 'America/Los_Angeles'
  RETURNING id, community_vote_start_at, community_vote_end_at
)
SELECT
  id,
  community_vote_start_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_start_pt,
  community_vote_end_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_end_pt
FROM upd;


-- ----------------------------------------------------------------------
-- WRITE B -- season_test / season_test2 . application_open_at -> NULL.
-- RETURNING via CTE. Run alone.
--
-- Expect: exactly 2 rows, both open_pt = NULL.
--   Fewer than 2 rows means the guard refused for one or both -- stop
--   and report which id(s) were skipped, do not retry blindly.
-- ----------------------------------------------------------------------
WITH upd AS (
  UPDATE public.seasons
     SET application_open_at = NULL
   WHERE (id, application_open_at) IN (
     ('season_test',  TIMESTAMPTZ '2026-07-06 00:59:18.917+00'),
     ('season_test2', TIMESTAMPTZ '2026-07-01 00:00:00+00')
   )
  RETURNING id, application_open_at
)
SELECT
  id,
  application_open_at
    AT TIME ZONE 'America/Los_Angeles' AS open_pt
FROM upd
ORDER BY id;


-- ----------------------------------------------------------------------
-- VERIFY A -- community_vote chronology. Read-only. Run alone.
--
-- Expect:
--   vote_start_pt              2026-11-13 00:00
--   vote_end_pt                2026-11-16 00:00
--   vote_start_after_main_end  true
--   vote_end_before_awards     true
-- ----------------------------------------------------------------------
SELECT
  community_vote_start_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_start_pt,
  community_vote_end_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_end_pt,
  main_round_end_at
    AT TIME ZONE 'America/Los_Angeles' AS main_end_pt,
  awards_announcement_at
    AT TIME ZONE 'America/Los_Angeles' AS awards_pt,
  (community_vote_start_at > main_round_end_at)
    AS vote_start_after_main_end,
  (community_vote_end_at <= awards_announcement_at)
    AS vote_end_before_awards
FROM public.seasons
WHERE id = 'season_0';


-- ----------------------------------------------------------------------
-- VERIFY B -- getCurrentSeason() reproduced in SQL, now = today.
-- Read-only. Run alone.
--
-- Mirrors lib/seasons.ts getCurrentSeason() exactly: "opened" branch
-- (most recently opened, application_open_at <= now) wins if it has a
-- row; otherwise "upcoming" fallback (soonest future open, NULLs
-- excluded either way).
--
-- Expect: current_season_id = 'season_0'  (opened_path_id null,
-- fallback_path_id = 'season_0' -- season_0's own open is 2026-09-09,
-- still in the future, so it wins the fallback now that season_test /
-- season_test2 no longer compete).
-- ----------------------------------------------------------------------
WITH opened AS (
  SELECT id FROM public.seasons
  WHERE application_open_at IS NOT NULL AND application_open_at <= now()
  ORDER BY application_open_at DESC
  LIMIT 1
),
upcoming AS (
  SELECT id FROM public.seasons
  WHERE application_open_at IS NOT NULL
  ORDER BY application_open_at ASC
  LIMIT 1
)
SELECT
  COALESCE((SELECT id FROM opened), (SELECT id FROM upcoming))
    AS current_season_id,
  (SELECT id FROM opened)   AS opened_path_id,
  (SELECT id FROM upcoming) AS fallback_path_id;
