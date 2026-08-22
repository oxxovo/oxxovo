-- HQ 2026-08-22: season_0 schedule -- FULL confirmed rewrite (all times 17:00
-- PT unless noted). Derived against HEAD e9da1c2 (registration_close_at
-- formula unchanged since reports/season_defer_gate_registration_close_2026-
-- 08-20.sql -- confirmed by BLOCK 0 below: registration_lock_hours=72 and
-- registration_close_at = application_close_at - 72h, still exact).
--
-- TWO items were flagged as WRONG (fix, not just move):
--   (a) application_open_at is still 9/9 -- that is only the PROMO start
--       (35 days out), applications do not open then. Must move to 10/14
--       17:00 PT.
--   (b) registration_close_at is 11/1 00:00 PT -- DST ends 11/1, so that
--       instant occurs twice; ambiguous wall-clock. Moving application_
--       close_at to 11/4 17:00 PT and leaving registration_lock_hours=72
--       fixes it FOR FREE by the existing formula (11/4 17:00 - 72h =
--       11/1 17:00, unambiguous).
--
-- Structure preserved: 72h windows (registration-lock 11/1->11/4, main-round
-- submission 11/9->11/12, vote window 11/13->11/16) and 24h buffers
-- (submit-close->scoring-start 11/4->11/5, results->main-start 11/8->11/9,
-- main-end->vote-start 11/12->11/13) all hold exactly after this UPDATE --
-- verify with BLOCK 2.
--
-- ASCII only. LF only.
-- =========================================================================


-- =========================================================================
-- BLOCK 0 -- CONFIRM before touching anything. Read-only. Run alone.
--
-- EXPECT (live values, read via service-role REST 2026-08-22, PT shown for
-- reference only -- the query returns raw UTC):
--   application_open_at             2026-09-09T07:00:00+00  (9/9  00:00 PT)
--   application_close_at            2026-11-04T08:00:00+00  (11/4 00:00 PT)
--   registration_close_at           2026-11-01T08:00:00+00  (11/1 00:00 PT)
--   registration_lock_hours         72
--   submission_hours                72
--   scoring_start_at                2026-11-05T08:00:00+00  (11/5 00:00 PT)
--   scoring_complete_at             2026-11-08T08:00:00+00  (11/8 00:00 PT)
--   prelim_results_announcement_at  2026-11-08T20:00:00+00  (11/8 12:00 PT)
--   main_round_start_at             2026-11-09T08:00:00+00  (11/9 00:00 PT)
--   main_round_end_at               2026-11-12T08:00:00+00  (11/12 00:00 PT)
--   community_vote_start_at         2026-11-13T08:00:00+00  (11/13 00:00 PT)
--   community_vote_end_at           2026-11-16T08:00:00+00  (11/16 00:00 PT)
--   awards_announcement_at          2026-11-17T04:00:00+00  (11/16 20:00 PT)
-- If any of these differ from what is printed, STOP -- something else moved
-- this row since 2026-08-22 and BLOCK 1's re-run guard will (correctly)
-- affect 0 rows.
-- =========================================================================
SELECT
  application_open_at, application_close_at, registration_close_at,
  registration_lock_hours, submission_hours,
  scoring_start_at, scoring_complete_at, prelim_results_announcement_at,
  main_round_start_at, main_round_end_at,
  community_vote_start_at, community_vote_end_at,
  awards_announcement_at, updated_at
FROM public.seasons
WHERE id = 'season_0';


-- =========================================================================
-- BLOCK 1 -- rewrite all ten date columns to the confirmed schedule. One
-- UPDATE, one row. registration_close_at is NOT hand-typed -- it is computed
-- from the SAME literal being written to application_close_at, minus the
-- existing registration_lock_hours (72), matching defer_season_schedule's
-- own formula exactly. Guarded to only fire if application_open_at is still
-- the old 9/9 value (re-run safety -- 0 rows the second time). Run alone,
-- after BLOCK 0 confirms.
-- =========================================================================
BEGIN;

WITH upd AS (
  UPDATE public.seasons
  SET
    application_open_at            = TIMESTAMP '2026-10-14 17:00' AT TIME ZONE 'America/Los_Angeles',
    application_close_at           = TIMESTAMP '2026-11-04 17:00' AT TIME ZONE 'America/Los_Angeles',
    registration_close_at          = (TIMESTAMP '2026-11-04 17:00' AT TIME ZONE 'America/Los_Angeles')
                                        - (registration_lock_hours || ' hours')::interval,
    scoring_start_at               = TIMESTAMP '2026-11-05 17:00' AT TIME ZONE 'America/Los_Angeles',
    scoring_complete_at            = TIMESTAMP '2026-11-08 17:00' AT TIME ZONE 'America/Los_Angeles',
    prelim_results_announcement_at = TIMESTAMP '2026-11-08 17:00' AT TIME ZONE 'America/Los_Angeles',
    main_round_start_at            = TIMESTAMP '2026-11-09 17:00' AT TIME ZONE 'America/Los_Angeles',
    main_round_end_at              = TIMESTAMP '2026-11-12 17:00' AT TIME ZONE 'America/Los_Angeles',
    community_vote_start_at        = TIMESTAMP '2026-11-13 17:00' AT TIME ZONE 'America/Los_Angeles',
    community_vote_end_at          = TIMESTAMP '2026-11-16 17:00' AT TIME ZONE 'America/Los_Angeles',
    awards_announcement_at         = TIMESTAMP '2026-11-18 17:00' AT TIME ZONE 'America/Los_Angeles',
    updated_at                     = now()
  WHERE id = 'season_0'
    AND application_open_at = '2026-09-09T07:00:00+00:00'::timestamptz
  RETURNING *
)
SELECT
  id,
  application_open_at, application_close_at, registration_close_at,
  registration_lock_hours,
  scoring_start_at, scoring_complete_at, prelim_results_announcement_at,
  main_round_start_at, main_round_end_at,
  community_vote_start_at, community_vote_end_at,
  awards_announcement_at, updated_at
FROM upd;

COMMIT;
-- expect: exactly 1 row. If 0 rows, nothing changed -- see BLOCK 0 note above,
-- stop and report back before retrying.


-- =========================================================================
-- BLOCK 2 -- verify (read-only). Shows every date in PT (wall clock, what
-- the announcement above promises) plus the two structural checks TK asked
-- to hold: 72h/24h relationships and app_close - lock_hours = reg_close.
-- Run alone, after BLOCK 1.
-- =========================================================================
SELECT
  application_open_at            AT TIME ZONE 'America/Los_Angeles' AS application_open_pt,
  application_close_at           AT TIME ZONE 'America/Los_Angeles' AS application_close_pt,
  registration_close_at          AT TIME ZONE 'America/Los_Angeles' AS registration_close_pt,
  scoring_start_at                AT TIME ZONE 'America/Los_Angeles' AS scoring_start_pt,
  scoring_complete_at             AT TIME ZONE 'America/Los_Angeles' AS scoring_complete_pt,
  prelim_results_announcement_at  AT TIME ZONE 'America/Los_Angeles' AS prelim_announce_pt,
  main_round_start_at             AT TIME ZONE 'America/Los_Angeles' AS main_start_pt,
  main_round_end_at               AT TIME ZONE 'America/Los_Angeles' AS main_end_pt,
  community_vote_start_at         AT TIME ZONE 'America/Los_Angeles' AS vote_start_pt,
  community_vote_end_at           AT TIME ZONE 'America/Los_Angeles' AS vote_end_pt,
  awards_announcement_at          AT TIME ZONE 'America/Los_Angeles' AS awards_pt,
  (registration_close_at = application_close_at - (registration_lock_hours || ' hours')::interval) AS reg_close_formula_holds,
  (main_round_end_at = main_round_start_at + (submission_hours || ' hours')::interval) AS main_round_72h_holds
FROM public.seasons
WHERE id = 'season_0';
-- expect every *_pt column to read exactly the 17:00 dates in the announcement
-- (application_open_pt = 2026-10-14 17:00, ... awards_pt = 2026-11-18 17:00)
-- and both boolean columns = true.


-- =========================================================================
-- REVERT -- do NOT run with the blocks above. Separate action only, if
-- something needs to go back to the pre-2026-08-22 values (the exact values
-- BLOCK 0 showed). Guarded to only fire if updated_at still matches this
-- migration's write, so it cannot clobber a later, unrelated edit.
-- =========================================================================
-- WITH rev AS (
--   UPDATE public.seasons
--   SET
--     application_open_at            = '2026-09-09T07:00:00+00:00'::timestamptz,
--     application_close_at           = '2026-11-04T08:00:00+00:00'::timestamptz,
--     registration_close_at          = '2026-11-01T08:00:00+00:00'::timestamptz,
--     scoring_start_at               = '2026-11-05T08:00:00+00:00'::timestamptz,
--     scoring_complete_at            = '2026-11-08T08:00:00+00:00'::timestamptz,
--     prelim_results_announcement_at = '2026-11-08T20:00:00+00:00'::timestamptz,
--     main_round_start_at            = '2026-11-09T08:00:00+00:00'::timestamptz,
--     main_round_end_at              = '2026-11-12T08:00:00+00:00'::timestamptz,
--     community_vote_start_at        = '2026-11-13T08:00:00+00:00'::timestamptz,
--     community_vote_end_at          = '2026-11-16T08:00:00+00:00'::timestamptz,
--     awards_announcement_at         = '2026-11-17T04:00:00+00:00'::timestamptz,
--     updated_at                     = now()
--   WHERE id = 'season_0'
--     AND application_open_at = (TIMESTAMP '2026-10-14 17:00' AT TIME ZONE 'America/Los_Angeles')
--   RETURNING *
-- )
-- SELECT * FROM rev;
