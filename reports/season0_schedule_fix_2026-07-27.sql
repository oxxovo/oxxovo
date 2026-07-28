-- =========================================================================
-- season_0 schedule correction (TK Run). ASCII only, LF only.
--
-- Blocks are numbered. Run ONE block at a time and read its output before the
-- next -- block 2 is the only one that writes.
--
-- -------------------------------------------------------------------------
-- WHY (measured 2026-07-27, read-only probe against qrnkovokjmimagrwjebs)
--
-- Every season_0 schedule column still holds the ORIGINAL Aug/Sep plan. The
-- block is internally consistent, so nothing looks corrupt -- it is simply
-- stale as a whole. Last write was 2026-07-25 00:01 PT, the same instant as
-- application_open_at, i.e. the migration that moved the OPEN date to 7/25 and
-- left every downstream date untouched.
--
--   application_open_at      2026-07-25 00:00 PT
--   application_close_at     2026-08-30 23:59 PT   <- stale
--   scoring_start_at         2026-08-31 00:00 PT   <- stale
--   scoring_complete_at      2026-09-02 00:00 PT   <- stale
--   main_round_start_at      2026-09-03 00:00 PT   <- stale, THE ROUND BOUNDARY
--   main_round_end_at        2026-09-05 00:00 PT   <- stale
--   community_vote_start_at  2026-09-05 00:00 PT   <- stale
--   community_vote_end_at    2026-09-07 00:00 PT   <- stale
--   awards_announcement_at   2026-09-08 21:00 PT   <- stale
--
-- WHAT main_round_start_at DRIVES (studio_round = 'both' activates it):
--   resolveEffectiveRound() returns 'main' once now >= main_round_start_at.
--   Eight call sites depend on it -- clip cap (30), music cap (15), compose
--   clip picker, submission routing, per-round video length bounds. With the
--   boundary at 9/3, prelim work done on 9/27-29 is counted as MAIN round.
--
-- ORDERING HAZARD -- why main_round_end_at is in the same UPDATE:
--   moving start to 10/5 while end stays 2026-09-05 makes end < start. The
--   main-round scoring gate keys on main_round_end_at, so a past value reads as
--   "main round already closed". The two must move together.
--   end = start + submission_hours (48) = 2026-10-07 00:00 PT, which is the
--   same rule computeSeasonSchedule() uses (lib/season-schedule.ts).
-- =========================================================================


-- -------------------------------------------------------------------------
-- BLOCK 1 -- BEFORE. Run alone. Record the output before changing anything.
-- Expect: one row, the stale values listed above.
-- -------------------------------------------------------------------------
SELECT id,
       application_open_at    AT TIME ZONE 'America/Los_Angeles' AS open_pt,
       application_close_at   AT TIME ZONE 'America/Los_Angeles' AS close_pt,
       scoring_start_at       AT TIME ZONE 'America/Los_Angeles' AS scoring_start_pt,
       scoring_complete_at    AT TIME ZONE 'America/Los_Angeles' AS scoring_done_pt,
       main_round_start_at    AT TIME ZONE 'America/Los_Angeles' AS main_start_pt,
       main_round_end_at      AT TIME ZONE 'America/Los_Angeles' AS main_end_pt,
       community_vote_start_at AT TIME ZONE 'America/Los_Angeles' AS vote_start_pt,
       community_vote_end_at  AT TIME ZONE 'America/Los_Angeles' AS vote_end_pt,
       awards_announcement_at AT TIME ZONE 'America/Los_Angeles' AS awards_pt,
       studio_round, submission_hours
FROM public.seasons
WHERE id = 'season_0';


-- -------------------------------------------------------------------------
-- BLOCK 2 -- THE WRITE. Main round 10/5, and its end moved with it.
--            Timestamps are written as PT wall-clock and converted by Postgres,
--            so this stays correct across the 11/1 DST switch.
-- Expect: "UPDATE 1".
-- -------------------------------------------------------------------------
BEGIN;

UPDATE public.seasons
   SET main_round_start_at = TIMESTAMP '2026-10-05 00:00' AT TIME ZONE 'America/Los_Angeles',
       main_round_end_at   = TIMESTAMP '2026-10-07 00:00' AT TIME ZONE 'America/Los_Angeles'
 WHERE id = 'season_0';

COMMIT;


-- -------------------------------------------------------------------------
-- BLOCK 3 -- AFTER. Run alone.
-- Expect: main_start_pt = 2026-10-05 00:00, main_end_pt = 2026-10-07 00:00,
--         end_after_start = true, boundary_now = 'application'.
-- -------------------------------------------------------------------------
SELECT main_round_start_at AT TIME ZONE 'America/Los_Angeles' AS main_start_pt,
       main_round_end_at   AT TIME ZONE 'America/Los_Angeles' AS main_end_pt,
       (main_round_end_at > main_round_start_at)              AS end_after_start,
       CASE WHEN now() >= main_round_start_at THEN 'main' ELSE 'application' END
                                                              AS boundary_now
FROM public.seasons
WHERE id = 'season_0';

-- 3b) Round the boundary WOULD assign to the prelim dates. Expect all
--     'application'. If any says 'main', the boundary is still wrong.
SELECT d::date AS at_pt,
       CASE WHEN d >= (SELECT main_round_start_at FROM public.seasons WHERE id = 'season_0')
            THEN 'main' ELSE 'application' END AS effective_round
FROM (VALUES
        (TIMESTAMP '2026-08-05 12:00' AT TIME ZONE 'America/Los_Angeles'),
        (TIMESTAMP '2026-09-27 12:00' AT TIME ZONE 'America/Los_Angeles'),
        (TIMESTAMP '2026-09-29 12:00' AT TIME ZONE 'America/Los_Angeles'),
        (TIMESTAMP '2026-10-05 12:00' AT TIME ZONE 'America/Los_Angeles')
     ) AS t(d);


-- =========================================================================
-- BLOCK 4 -- application_close_at. NOT INCLUDED ABOVE ON PURPOSE.
--
-- This column is not just the apply-form window. isApplicationClosed() is the
-- SUBMISSION hard cut: lib/studio.ts:1126 (submitGeneration) and :1773
-- (submitRender) both refuse with 'application_closed' once now > this value.
-- It is also the prelim scoring gate in the scoring worker.
--
-- So the two statements below are NOT interchangeable:
--
--   (a) 2026-09-26 23:59 PT  -- as instructed. Correct ONLY if 9/27-29 is a
--       post-deadline processing window with no participant submissions.
--       If participants submit on 9/27-29, every submission is REFUSED.
--
--   (b) 2026-09-29 23:59 PT  -- correct if 9/27-29 is the 72h make-and-submit
--       window. Submissions stay open through it; prelim scoring opens after.
--
-- Pick one and run only that statement, then re-run BLOCK 1 to confirm.
-- =========================================================================

-- (a) close BEFORE the 9/27-29 window
-- UPDATE public.seasons
--    SET application_close_at = TIMESTAMP '2026-09-26 23:59' AT TIME ZONE 'America/Los_Angeles',
--        scoring_start_at     = TIMESTAMP '2026-09-27 00:00' AT TIME ZONE 'America/Los_Angeles'
--  WHERE id = 'season_0';

-- (b) close AT THE END of the 9/27-29 window
-- UPDATE public.seasons
--    SET application_close_at = TIMESTAMP '2026-09-29 23:59' AT TIME ZONE 'America/Los_Angeles',
--        scoring_start_at     = TIMESTAMP '2026-09-30 00:00' AT TIME ZONE 'America/Los_Angeles'
--  WHERE id = 'season_0';


-- =========================================================================
-- BLOCK 5 -- STILL STALE AFTER THE ABOVE. Reported, not changed: no confirmed
-- target date exists for these yet.
--   scoring_complete_at      2026-09-02 00:00 PT
--   community_vote_start_at  2026-09-05 00:00 PT
--   community_vote_end_at    2026-09-07 00:00 PT
--   awards_announcement_at   2026-09-08 21:00 PT   (before the new main round)
--
-- SEPARATE FINDING -- season_1 overlaps season_0:
--   season_1.application_open_at = 2026-09-28 00:00 PT.
--   getCurrentSeason() picks the most recently OPENED season, so from 9/28 the
--   platform switches to season_1 in the middle of season_0's prelim window.
--   Needs a decision (push season_1 out, or keep it 'upcoming' and gate on it).
--   Inspect with:
--     SELECT id, status, application_open_at AT TIME ZONE 'America/Los_Angeles'
--     FROM public.seasons WHERE id IN ('season_0','season_1');
-- =========================================================================
