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
--   TWO DIFFERENT DEADLINE CALCULATORS EXIST and must agree:
--     lib/studio.ts:182  mainRoundDeadlineMs = main_round_start_at + submission_hours
--                        -> the STUDIO SUBMISSION gate
--     lib/seasons.ts canSubmitMainRound + the scoring worker -> main_round_end_at
--   If they disagree the participant loses the difference. submission_hours is
--   therefore updated in the same statement, not just the end timestamp.
--
--   submission_hours = 48 was never a season_0 decision: it is the weekly-season
--   template default (lib/season-schema.ts:163; the schedule comment reads
--   "week2 Wed 21:00 + submission_hours (48h default -> Fri 21:00)"). season_0 is
--   a hand-seeded row, so it inherited a value meant for a different format.
--   Head office writes the prelim as 9/27-9/29 = 72h (ending 9/30 00:00) and the
--   main round as 10/5-10/7 in the SAME notation, so the parallel reading is 72h
--   ending 2026-10-08 00:00 PT. submission_hours moves to 72 with it.
--   Side effect, intended: the MainRoundStart email renders "72 hours" by itself.
--
--   submission_hours is MAIN-ROUND ONLY -- the prelim deadline is
--   application_close_at alone, so the prelim window was never computed from it.
--
-- WARNING -- scoring_start_at IS NOT A GATE (measured 2026-07-27):
--   App repo: written by lib/season-schedule.ts only. NOTHING reads it to decide
--             anything. Scoring repo: ZERO references.
--   The prelim scoring gate is application_close_at ALONE
--   (oxxovo-scoring/src/batch.ts scoringGateReason + gateCloseField).
--   So scoring actually opens at 2026-09-30 00:00 PT -- the 24h processing
--   buffer is NOT enforced by this column, whatever value it holds. It is set
--   to 10/1 here so the row matches the official plan (and so a future gate
--   reads the right instant), not because it changes behaviour today.
--
--   Mitigation already in place: pickPending requires free_entry_url IS NOT
--   NULL, so an entry whose render has not finished is skipped and picked up on
--   a later 5-minute pass. Unfinished videos are never scored.
--
--   Residual risk to close separately (NOT a schedule value):
--     maybeFinalizeSeason writes the Top-N recommendation + scoring_complete_at
--     once the queue looks empty. During the buffer the queue can LOOK empty
--     while renders are still landing, so Top N could be finalised on a partial
--     cohort. Fix = teach scoringGateReason to also respect scoring_start_at
--     (one condition; the column already exists, no migration). Scoring-repo
--     work, separate from Defect 1 (that is scorer.ts/rubric).
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
--
-- ROLLBACK (paste this if BLOCK 3 fails -- these are the exact pre-change values
-- measured 2026-07-27):
--   UPDATE public.seasons
--      SET main_round_start_at  = TIMESTAMP '2026-09-03 00:00' AT TIME ZONE 'America/Los_Angeles',
--          main_round_end_at    = TIMESTAMP '2026-09-05 00:00' AT TIME ZONE 'America/Los_Angeles',
--          submission_hours     = 48,
--          application_close_at = TIMESTAMP '2026-08-30 23:59' AT TIME ZONE 'America/Los_Angeles',
--          scoring_start_at     = TIMESTAMP '2026-08-31 00:00' AT TIME ZONE 'America/Los_Angeles'
--    WHERE id = 'season_0';
-- -------------------------------------------------------------------------
BEGIN;

UPDATE public.seasons
   SET main_round_start_at = TIMESTAMP '2026-10-05 00:00' AT TIME ZONE 'America/Los_Angeles',
       main_round_end_at   = TIMESTAMP '2026-10-08 00:00' AT TIME ZONE 'America/Los_Angeles',
       submission_hours    = 72,
       -- Prelim: 9/27-9/29 is the 72h make-and-submit window, so the cut is the
       -- 72h mark itself. This column is the SUBMISSION hard cut
       -- (lib/studio.ts:1126 / :1773), not just the apply-form window, so an
       -- earlier value would refuse every entry made during the window.
       application_close_at = TIMESTAMP '2026-09-30 00:00' AT TIME ZONE 'America/Los_Angeles',
       -- 9/30 is the 24h processing buffer; judging runs 10/1-10/3. See the
       -- WARNING below: this column is documentation today, not a gate.
       scoring_start_at     = TIMESTAMP '2026-10-01 00:00' AT TIME ZONE 'America/Los_Angeles'
 WHERE id = 'season_0';

COMMIT;


-- -------------------------------------------------------------------------
-- BLOCK 3 -- AFTER. Run alone.
-- Expect: main_start_pt = 2026-10-05 00:00, main_end_pt = 2026-10-08 00:00,
--         end_after_start = true, boundary_now = 'application',
--         deadlines_agree = true, close_pt = 2026-09-30 00:00,
--         scoring_start_pt = 2026-10-01 00:00 (documentation only -- see WARNING).
-- -------------------------------------------------------------------------
SELECT main_round_start_at AT TIME ZONE 'America/Los_Angeles' AS main_start_pt,
       main_round_end_at   AT TIME ZONE 'America/Los_Angeles' AS main_end_pt,
       (main_round_end_at > main_round_start_at)              AS end_after_start,
       CASE WHEN now() >= main_round_start_at THEN 'main' ELSE 'application' END
                                                              AS boundary_now,
       application_close_at AT TIME ZONE 'America/Los_Angeles' AS close_pt,
       scoring_start_at     AT TIME ZONE 'America/Los_Angeles' AS scoring_start_pt,
       submission_hours,
       -- The two calculators must land on the same instant.
       (main_round_end_at = main_round_start_at + make_interval(hours => submission_hours))
                                                              AS deadlines_agree
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
-- BLOCK 4 -- RESOLVED. application_close_at is folded into BLOCK 2 above.
-- Head office confirmed 9/27-9/29 is the make-and-submit window, so the cut is
-- 2026-09-30 00:00 PT (the 72h mark, not 9/29 23:59 -- someone always submits
-- in the last minute). Nothing to run here.
--
-- STRUCTURAL NOTE, no code change proposed: there is no separate
-- "registration closes" column, and for season_0 that is correct. A studio
-- submission MINTS the application row itself (lib/studio.ts:1122-1131 inserts
-- pending/waitlist with the capacity check), so registering and submitting are
-- the same event. /api/apply (:113,:116), /apply and both studio submit paths
-- all read this one column. A separate submission_close_at would only be needed
-- if head office wants "registration shuts 9/26, then only existing entrants
-- may submit 9/27-29" -- that is a policy change plus a code change, not a value.
-- =========================================================================

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

-- =========================================================================
-- BLOCK 6 -- season_1 overlap. Run alone, AFTER block 3 passes.
--
-- season_1.application_open_at = 2026-09-28 00:00 PT and getCurrentSeason()
-- returns the most recently OPENED season, so on 9/28 -- day two of season_0's
-- prelim window -- the whole platform would switch to season_1.
--
-- NULL is the safe value, and it is the path the code already designs for:
--   getCurrentSeason: .lte('application_open_at', now) excludes NULL, so
--     season_1 can never become current. The "soonest upcoming" fallback only
--     runs when NOTHING has opened, which is not the case while season_0 is open.
--   deriveLobbyMode (lib/lobby.ts): `open == null -> 'upcoming'`, commented as
--     the teaser state ("announced, open date not set yet").
--   season-tick (route.ts:120): explicitly skips next-season creation with a
--     logged reason when the latest season has no open date. No throw.
-- A far-future placeholder would instead publish a countdown to a date we would
-- then have to move. NULL promises nothing.
--
-- Expect: "UPDATE 1", then the verify returns open_pt = NULL, status 'upcoming'.
--
-- ROLLBACK (exact pre-change values for season_1):
--   UPDATE public.seasons
--      SET application_open_at  = TIMESTAMP '2026-09-28 00:00' AT TIME ZONE 'America/Los_Angeles',
--          application_close_at = TIMESTAMP '2026-10-04 23:59' AT TIME ZONE 'America/Los_Angeles'
--    WHERE id = 'season_1';
-- -------------------------------------------------------------------------
BEGIN;

UPDATE public.seasons
   SET application_open_at  = NULL,
       application_close_at = NULL
 WHERE id = 'season_1';

COMMIT;

-- verify
SELECT id, status,
       application_open_at  AT TIME ZONE 'America/Los_Angeles' AS open_pt,
       application_close_at AT TIME ZONE 'America/Los_Angeles' AS close_pt
FROM public.seasons
WHERE id IN ('season_0', 'season_1')
ORDER BY id;
