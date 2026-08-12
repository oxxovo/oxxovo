-- ======================================================================
-- season_0 schedule -- 5-week (35-day) postponement.  TK Run.
-- ASCII only, LF only, every line under 78 columns (chat-copy safe).
--
-- Head office decision 2026-08-03. Run ONE block at a time, top to
-- bottom, and read the output before moving on.
--   BLOCK 1  read-only  (before + stop condition)
--   BLOCK 2  THE WRITE  (the only block that changes anything)
--   BLOCK 3  read-only  (verification)
--   BLOCK 4  read-only  (a separate finding, reported below)
--
-- The ROLLBACK statement is at the very BOTTOM of this file, OUTSIDE the
-- run order, under "DO NOT RUN UNLESS BLOCK 3 FAILED". It is not part of
-- the sequence -- do not paste it while working down the page.
--
-- ----------------------------------------------------------------------
-- WHAT MOVES (8 columns, season_0 only)
--
--   column                   from (PT)            to (PT)
--   application_close_at     2026-09-30 00:00 ->  2026-11-04 00:00
--   scoring_start_at         2026-10-01 00:00 ->  2026-11-05 00:00
--   scoring_complete_at      2026-10-04 00:00 ->  2026-11-08 00:00
--   main_round_start_at      2026-10-05 00:00 ->  2026-11-09 00:00
--   main_round_end_at        2026-10-08 00:00 ->  2026-11-12 00:00
--   community_vote_start_at  2026-10-08 00:00 ->  2026-11-12 00:00
--   community_vote_end_at    2026-10-11 00:00 ->  2026-11-15 00:00
--   awards_announcement_at   2026-10-12 20:00 ->  2026-11-16 20:00
--
--   UNCHANGED: application_open_at (2026-07-25 00:00 PT).
--   UNCHANGED: submission_hours (72).
--   UNTOUCHED: every other season row. WHERE clause is id = 'season_0'.
--
--   The "from" column is not the plan on paper -- it is what the live DB
--   held when measured on 2026-08-03 22:15 PT. Every target is exactly
--   +35 days of PT WALL CLOCK on that, so weekdays are preserved:
--   9/30 Wed -> 11/4 Wed, 10/5 Mon -> 11/9 Mon, 10/12 Mon -> 11/16 Mon.
--
-- ----------------------------------------------------------------------
-- DST -- WHY EVERY VALUE IS WRITTEN AS WALL CLOCK, NOT AS UTC
--
--   Daylight saving ends 2026-11-01 02:00 PDT. The OLD schedule sat
--   entirely in PDT (UTC-7); the NEW schedule sits entirely in PST
--   (UTC-8). So this is +35 days on the clock, but +35 days AND +1 hour
--   in absolute time.
--
--   Hand-written UTC would therefore be one hour wrong on all 8 columns
--   (11/4 00:00 PT is 08:00Z, not the 07:00Z the old values used). Every
--   value below is written as
--     TIMESTAMP 'YYYY-MM-DD HH:MM' AT TIME ZONE 'America/Los_Angeles'
--   so Postgres takes the offset from the tz database instead.
--
--   No value lands in the ambiguous hour (2026-11-01 01:00-02:00).
--   Checked one by one.
--
--   Resulting UTC, for the record:
--     close            2026-11-04 08:00Z
--     scoring_start    2026-11-05 08:00Z
--     scoring_complete 2026-11-08 08:00Z
--     main_start       2026-11-09 08:00Z
--     main_end         2026-11-12 08:00Z
--     vote_start       2026-11-12 08:00Z
--     vote_end         2026-11-15 08:00Z
--     awards           2026-11-17 04:00Z
--
-- ----------------------------------------------------------------------
-- THE 73-HOUR PRELIM WINDOW -- REPORTED, NOT A CODE PROBLEM
--
--   The prelim make-and-submit window moves from 9/27-9/30 to 11/1-11/4,
--   which steps over the DST boundary: 11/1 00:00 PDT -> 11/4 00:00 PST
--   is 73 hours of real time, not 72. BLOCK 3 prints that number so it
--   is on the record.
--
--   No code is affected. Measured 2026-08-03 across all three repos --
--   NOTHING derives the prelim deadline from a start plus a duration.
--   (Scope note: the app / Studio side below is jisoo2-A's to verify,
--   per head office 2026-08-03. What follows is the grep result as of
--   that date, recorded here as context, not as a sign-off.)
--     - the prelim cut is application_close_at ALONE (app: /api/apply
--       and both studio submit paths; scoring: batch.ts gateCloseField;
--       studio worker: no reference at all)
--     - mainRoundDeadlineMs (start + submission_hours) was DELETED on
--       2026-08-03 (commit 1c01d3d) and had zero call sites
--     - the one surviving derivation is the email tick's reminder time,
--       and it reads main_round_end_at, using the derivation only as a
--       fallback when that column is NULL (season_0 has it set)
--     - submission_hours is MAIN-ROUND only. The main round 11/9 00:00
--       -> 11/12 00:00 is entirely inside PST, so it is exactly 72h: the
--       MainRoundStart email's "72 hours" stays true, and BLOCK 3's
--       deadlines_agree stays true.
--
--   So the 73h is a fact about the participants' calendar, not a defect
--   -- the prelim cohort gets one extra hour. If head office wants
--   exactly 72h, that is a value change (close 2026-11-03 23:00 PT),
--   not a code change.
-- ======================================================================


-- ----------------------------------------------------------------------
-- BLOCK 1 -- BEFORE. Read-only. Run alone.
--
-- STOP CONDITION: the last column, safe_to_proceed, must be TRUE.
--   TRUE  = the row still holds exactly the values measured on
--           2026-08-03, so the ROLLBACK at the bottom is accurate.
--           Continue to BLOCK 2.
--   FALSE = someone changed the row since the measurement.
--           DO NOT RUN BLOCK 2. Send this output back first -- the
--           rollback values would be wrong.
--   Expect exactly ONE row. Zero rows means the wrong database.
-- ----------------------------------------------------------------------
SELECT
  id,
  status,
  submission_hours,
  application_open_at
    AT TIME ZONE 'America/Los_Angeles' AS open_pt,
  application_close_at
    AT TIME ZONE 'America/Los_Angeles' AS close_pt,
  scoring_start_at
    AT TIME ZONE 'America/Los_Angeles' AS scoring_start_pt,
  scoring_complete_at
    AT TIME ZONE 'America/Los_Angeles' AS scoring_done_pt,
  main_round_start_at
    AT TIME ZONE 'America/Los_Angeles' AS main_start_pt,
  main_round_end_at
    AT TIME ZONE 'America/Los_Angeles' AS main_end_pt,
  community_vote_start_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_start_pt,
  community_vote_end_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_end_pt,
  awards_announcement_at
    AT TIME ZONE 'America/Los_Angeles' AS awards_pt,
  (
        application_open_at =
          TIMESTAMP '2026-07-25 00:00' AT TIME ZONE 'America/Los_Angeles'
    AND application_close_at =
          TIMESTAMP '2026-09-30 00:00' AT TIME ZONE 'America/Los_Angeles'
    AND scoring_start_at =
          TIMESTAMP '2026-10-01 00:00' AT TIME ZONE 'America/Los_Angeles'
    AND scoring_complete_at =
          TIMESTAMP '2026-10-04 00:00' AT TIME ZONE 'America/Los_Angeles'
    AND main_round_start_at =
          TIMESTAMP '2026-10-05 00:00' AT TIME ZONE 'America/Los_Angeles'
    AND main_round_end_at =
          TIMESTAMP '2026-10-08 00:00' AT TIME ZONE 'America/Los_Angeles'
    AND community_vote_start_at =
          TIMESTAMP '2026-10-08 00:00' AT TIME ZONE 'America/Los_Angeles'
    AND community_vote_end_at =
          TIMESTAMP '2026-10-11 00:00' AT TIME ZONE 'America/Los_Angeles'
    AND awards_announcement_at =
          TIMESTAMP '2026-10-12 20:00' AT TIME ZONE 'America/Los_Angeles'
    AND submission_hours = 72
  ) AS safe_to_proceed
FROM public.seasons
WHERE id = 'season_0';


-- ----------------------------------------------------------------------
-- BLOCK 2 -- THE WRITE. One statement, all 8 columns at once. Run alone.
--
-- Expect: "UPDATE 1".
--   UPDATE 0 means the guard on the last line refused: the row is no
--   longer at the measured 2026-09-30 close, so NOTHING was written and
--   nothing is broken. Stop and report. Do not remove the guard.
--
-- The 8 columns move together on purpose. Any partial write leaves the
-- row self-contradictory for the gap -- an end before its start reads as
-- "already closed", an awards date before the main round reads as "time
-- to announce" -- and those states are silent. They look like normal
-- operation.
-- ----------------------------------------------------------------------
UPDATE public.seasons
   SET application_close_at =
         TIMESTAMP '2026-11-04 00:00' AT TIME ZONE 'America/Los_Angeles',
       scoring_start_at =
         TIMESTAMP '2026-11-05 00:00' AT TIME ZONE 'America/Los_Angeles',
       scoring_complete_at =
         TIMESTAMP '2026-11-08 00:00' AT TIME ZONE 'America/Los_Angeles',
       main_round_start_at =
         TIMESTAMP '2026-11-09 00:00' AT TIME ZONE 'America/Los_Angeles',
       main_round_end_at =
         TIMESTAMP '2026-11-12 00:00' AT TIME ZONE 'America/Los_Angeles',
       community_vote_start_at =
         TIMESTAMP '2026-11-12 00:00' AT TIME ZONE 'America/Los_Angeles',
       community_vote_end_at =
         TIMESTAMP '2026-11-15 00:00' AT TIME ZONE 'America/Los_Angeles',
       awards_announcement_at =
         TIMESTAMP '2026-11-16 20:00' AT TIME ZONE 'America/Los_Angeles'
 WHERE id = 'season_0'
   AND application_close_at =
         TIMESTAMP '2026-09-30 00:00' AT TIME ZONE 'America/Los_Angeles';


-- ----------------------------------------------------------------------
-- BLOCK 3 -- AFTER. Read-only. Run alone.
--
-- Expect:
--   open_pt           2026-07-25 00:00   (UNCHANGED)
--   close_pt          2026-11-04 00:00
--   scoring_start_pt  2026-11-05 00:00
--   scoring_done_pt   2026-11-08 00:00
--   main_start_pt     2026-11-09 00:00
--   main_end_pt       2026-11-12 00:00
--   vote_start_pt     2026-11-12 00:00
--   vote_end_pt       2026-11-15 00:00
--   awards_pt         2026-11-16 20:00
--   submission_hours  72                 (UNCHANGED)
--
--   chronology_ok     true
--   end_after_start   true
--   deadlines_agree   true
--   phase_now         application
--   main_elapsed      72:00:00
--   prelim_elapsed    73:00:00   <- EXPECTED, this is the DST step. 73
--                                  is the CORRECT output here; a 72
--                                  would mean the window does not cross
--                                  11/1 and something else is wrong.
--
-- If any of the first ten is off, or any of the three booleans is false,
-- run the ROLLBACK at the bottom of this file.
-- ----------------------------------------------------------------------
SELECT
  submission_hours,
  application_open_at
    AT TIME ZONE 'America/Los_Angeles' AS open_pt,
  application_close_at
    AT TIME ZONE 'America/Los_Angeles' AS close_pt,
  scoring_start_at
    AT TIME ZONE 'America/Los_Angeles' AS scoring_start_pt,
  scoring_complete_at
    AT TIME ZONE 'America/Los_Angeles' AS scoring_done_pt,
  main_round_start_at
    AT TIME ZONE 'America/Los_Angeles' AS main_start_pt,
  main_round_end_at
    AT TIME ZONE 'America/Los_Angeles' AS main_end_pt,
  community_vote_start_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_start_pt,
  community_vote_end_at
    AT TIME ZONE 'America/Los_Angeles' AS vote_end_pt,
  awards_announcement_at
    AT TIME ZONE 'America/Los_Angeles' AS awards_pt,
  (
        application_open_at     <  application_close_at
    AND application_close_at    <  scoring_start_at
    AND scoring_start_at        <  scoring_complete_at
    AND scoring_complete_at     <= main_round_start_at
    AND main_round_start_at     <  main_round_end_at
    AND main_round_end_at       <= community_vote_start_at
    AND community_vote_start_at <  community_vote_end_at
    AND community_vote_end_at   <  awards_announcement_at
  ) AS chronology_ok,
  (main_round_end_at > main_round_start_at) AS end_after_start,
  (
    main_round_end_at =
      main_round_start_at + make_interval(hours => submission_hours)
  ) AS deadlines_agree,
  CASE
    WHEN now() >= awards_announcement_at  THEN 'awards'
    WHEN now() >= community_vote_start_at THEN 'vote'
    WHEN now() >= main_round_start_at     THEN 'main'
    WHEN now() >= application_close_at    THEN 'scoring'
    WHEN now() >= application_open_at     THEN 'application'
    ELSE 'pre-open'
  END AS phase_now,
  (main_round_end_at - main_round_start_at) AS main_elapsed,
  -- Real elapsed time inside the 3-day PT prelim window.
  (
    application_close_at
    - ((application_close_at AT TIME ZONE 'America/Los_Angeles'
         - INTERVAL '3 days') AT TIME ZONE 'America/Los_Angeles')
  ) AS prelim_elapsed
FROM public.seasons
WHERE id = 'season_0';


-- ----------------------------------------------------------------------
-- BLOCK 4 -- READ-ONLY. Which season the platform calls "current".
-- Run it and send the output back. It writes nothing.
--
-- WHY: getCurrentSeason() (lib/seasons.ts:284) returns the most recently
-- OPENED season -- application_open_at <= now(), ordered descending --
-- and it does NOT filter on status. Moving season_0 five weeks later
-- pushes its run past the application_open_at of seasons seeded after
-- it. season_1 is already NULL and therefore safe, but season_2 (opens
-- 2026-10-12 PT), season_3 (10-26) and season_4 (11-09) are not: those
-- dates now fall INSIDE season_0's extended run.
--
-- Expect 4a: opened_already = true for season_0 only, today.
-- Expect 4b: three rows -- season_2, season_3, season_4. Each row is a
--            date on which the public "current season" pointer would
--            leave season_0 while season_0 is still running.
-- This is reported, not fixed here. It needs a head-office decision.
-- ----------------------------------------------------------------------
SELECT
  id,
  status,
  season_number,
  application_open_at
    AT TIME ZONE 'America/Los_Angeles' AS open_pt,
  application_close_at
    AT TIME ZONE 'America/Los_Angeles' AS close_pt,
  (application_open_at IS NOT NULL AND application_open_at <= now())
    AS opened_already
FROM public.seasons
WHERE id IN ('season_0','season_1','season_2','season_3','season_4')
ORDER BY season_number;

-- 4b) Every non-season_0 open date that lands inside season_0's run.
--     Any row returned here hijacks getCurrentSeason() on that date.
SELECT
  id,
  status,
  application_open_at
    AT TIME ZONE 'America/Los_Angeles' AS hijacks_on_pt
FROM public.seasons
WHERE application_open_at IS NOT NULL
  AND id <> 'season_0'
  AND application_open_at >
      (SELECT application_open_at
         FROM public.seasons WHERE id = 'season_0')
  AND application_open_at <
      (SELECT awards_announcement_at
         FROM public.seasons WHERE id = 'season_0')
ORDER BY application_open_at;


-- ======================================================================
-- ROLLBACK -- DO NOT RUN UNLESS BLOCK 3 FAILED.
--
-- This is NOT part of the sequence above. It is here only so the exact
-- pre-change values stay on the record. They are the values measured
-- live on 2026-08-03 22:15 PT and re-confirmed by BLOCK 1's
-- safe_to_proceed = true.
--
--   UPDATE public.seasons
--      SET application_close_at =
--            TIMESTAMP '2026-09-30 00:00'
--              AT TIME ZONE 'America/Los_Angeles',
--          scoring_start_at =
--            TIMESTAMP '2026-10-01 00:00'
--              AT TIME ZONE 'America/Los_Angeles',
--          scoring_complete_at =
--            TIMESTAMP '2026-10-04 00:00'
--              AT TIME ZONE 'America/Los_Angeles',
--          main_round_start_at =
--            TIMESTAMP '2026-10-05 00:00'
--              AT TIME ZONE 'America/Los_Angeles',
--          main_round_end_at =
--            TIMESTAMP '2026-10-08 00:00'
--              AT TIME ZONE 'America/Los_Angeles',
--          community_vote_start_at =
--            TIMESTAMP '2026-10-08 00:00'
--              AT TIME ZONE 'America/Los_Angeles',
--          community_vote_end_at =
--            TIMESTAMP '2026-10-11 00:00'
--              AT TIME ZONE 'America/Los_Angeles',
--          awards_announcement_at =
--            TIMESTAMP '2026-10-12 20:00'
--              AT TIME ZONE 'America/Los_Angeles'
--    WHERE id = 'season_0';
-- ======================================================================
