-- ===========================================================================
-- SEASON 0 (THE LAST HOPE) -- schedule revision to the CONFIRMED calendar
-- ===========================================================================
-- Why: the DB still holds the OLD calendar (close 8/30, awards 9/8 21:00 PT).
-- The confirmed calendar (HQ + TK, 2026-07-21) shifts the whole competition to
-- align with the 7/25 public launch + promo window:
--
--   Promotion / entry     7/25 ~ 9/16
--   Preliminary round     9/17 ~ 9/18
--   Preliminary scoring   9/19 ~ 9/21
--   Main round            9/23 ~ 9/25   (48h)
--   Main scoring + vote   9/26 ~ 9/28
--   Winners announced     9/29 08:00 PT   <-- the one value HQ stated explicitly
--
-- Measured current DB (PT), for the record:
--   application_open_at    7/25 00:00   (already correct -- NOT changed here)
--   application_close_at   8/30 23:59   -> 9/18 23:59   [assumption, see NOTE 1]
--   scoring_start_at       8/31 00:00   -> 9/19 00:00
--   scoring_complete_at    9/02 00:00   -> 9/22 00:00   [assumption, see NOTE 2]
--   main_round_start_at    9/03 00:00   -> 9/23 00:00
--   main_round_end_at      9/05 00:00   -> 9/25 00:00
--   awards_announcement_at 9/08 21:00   -> 9/29 08:00   (HQ-confirmed)
--
-- The 6 confirmed milestones do not map 1:1 to the 7 schedule columns, so TWO
-- values are my best mapping and need a TK yes/no before running:
--
--   NOTE 1 (application_close_at = 9/18 23:59 PT): the platform is single-
--     submission (apply == submit the preliminary video), so the submission gate
--     must close at the END of the preliminary round (9/18), not at the end of
--     the promo/entry label (9/16). That also leaves scoring to start clean on
--     9/19. If instead entry must hard-close 9/16 with 9/17-18 being a separate
--     no-submission window, set this to 2026-09-16 23:59.
--
--   NOTE 2 (scoring_complete_at = 9/22 00:00 PT): this column is when prelim
--     scoring finishes and Finalists are locked. Scoring runs 9/19-21, main round
--     opens 9/23, so 9/22 is the only day that fits. HQ did not state a Finalist
--     date; confirm 9/22 (or give the exact Finalist-announcement datetime).
--
-- "Main scoring + voting 9/26~28" has NO column -- it is the implied gap between
-- main_round_end (9/25) and awards (9/29). No column change needed for it.
--
-- Pacific wall-clock -> timestamptz via AT TIME ZONE 'America/Los_Angeles' so DST
-- (PDT in Sep = UTC-7) is automatic. No hardcoded UTC. ASCII only, no box chars,
-- no DO $$ blocks. One transaction + a verification SELECT.
-- See [[feedback-sql-ascii-only]] [[feedback-no-hardcode]].
--
-- *** season_1 CONFLICT -- read before running ***
-- season_1 (GENESIS) currently opens 2026-09-28 00:00 PT, which is BEFORE
-- season_0 winners (9/29). season_1 is NOT touched here (no confirmed dates).
-- It needs its own revision once TK provides the season_1 calendar.
-- ===========================================================================

BEGIN;

UPDATE public.seasons SET
  application_close_at   = TIMESTAMP '2026-09-18 23:59' AT TIME ZONE 'America/Los_Angeles',  -- NOTE 1
  scoring_start_at       = TIMESTAMP '2026-09-19 00:00' AT TIME ZONE 'America/Los_Angeles',
  scoring_complete_at    = TIMESTAMP '2026-09-22 00:00' AT TIME ZONE 'America/Los_Angeles',  -- NOTE 2
  main_round_start_at    = TIMESTAMP '2026-09-23 00:00' AT TIME ZONE 'America/Los_Angeles',
  main_round_end_at      = TIMESTAMP '2026-09-25 00:00' AT TIME ZONE 'America/Los_Angeles',
  awards_announcement_at = TIMESTAMP '2026-09-29 08:00' AT TIME ZONE 'America/Los_Angeles',  -- HQ-confirmed
  submission_hours       = 48,
  updated_at             = now()
WHERE id = 'season_0';

COMMIT;

-- ===========================================================================
-- Verification (run AFTER commit). Expected UTC (PDT = UTC-7 in Sep):
--   application_open_at    2026-07-25 07:00+00   (unchanged)
--   application_close_at   2026-09-19 06:59+00
--   scoring_start_at       2026-09-19 07:00+00
--   scoring_complete_at    2026-09-22 07:00+00
--   main_round_start_at    2026-09-23 07:00+00
--   main_round_end_at      2026-09-25 07:00+00
--   awards_announcement_at 2026-09-29 15:00+00
--   submission_hours = 48
-- ===========================================================================
SELECT id, status,
       application_open_at, application_close_at,
       scoring_start_at, scoring_complete_at,
       main_round_start_at, main_round_end_at,
       awards_announcement_at, submission_hours
FROM public.seasons
WHERE id = 'season_0';
