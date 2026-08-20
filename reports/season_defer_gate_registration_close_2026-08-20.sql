-- =========================================================================
-- Move the defer decision to registration_close_at + make registration_close_at
-- a formula (HQ 2026-08-20, items 1+2, bundled -- same function/column).
--
-- PROBLEM: defer_season_schedule fires at application_close_at (the SUBMISSION
-- deadline). By the time it fires, every registrant has already spent up to
-- registration_lock_hours creating their video, then gets told the season
-- deferred. registration_close_at (the earlier "stop taking new registrants"
-- cutoff, 2026-08-12) already freezes headcount at that point -- nobody new
-- can register after it, so the defer decision doesn't need to wait for
-- application_close_at at all.
--
-- SEPARATELY: registration_close_at's CURRENT value (2026-11-01 06:59:00+00)
-- was hand-typed (reports/season_registration_close_2026-08-12.sql BLOCK 2,
-- "TIMESTAMP '2026-10-31 23:59' AT TIME ZONE 'America/Los_Angeles'") -- not
-- computed from application_close_at, so it drifted 1h01m off the intended
-- 72h-before figure and will drift again on every future manual edit or defer
-- that doesn't also touch it by hand.
--
-- FIX: new column registration_lock_hours (season-level, matches the existing
-- submission_hours pattern -- [[feedback-no-hardcode]], not a code constant).
-- registration_close_at becomes application_close_at - registration_lock_hours,
-- recomputed (a) now, for season_0's current values, and (b) inside
-- defer_season_schedule every time it defers, from the interval math -- not
-- shifted by the same day-count as the other columns. That is what keeps the
-- relationship exact through every future defer, not just this one fix.
--
-- WHAT THIS DOES NOT TOUCH: prelim-hold release and championship-participation
-- credit (season-tick route.ts, both explicitly gated on application_close_at,
-- the SUBMISSION deadline -- correct as-is, HQ 2026-08-18 confirmed) and the
-- season status-closed transition. Only the defer gate moves.
--
-- Function base: reports/season_registration_reminder_2026-08-12.sql BLOCK 3,
-- the latest of 5 files found (by commit time) that redefine
-- defer_season_schedule -- no CREATE OR REPLACE against it found after that.
-- BLOCK 0 below re-confirms nothing drifted since.
--
-- ASCII only. LF only.
-- =========================================================================


-- =========================================================================
-- BLOCK 0 -- CONFIRM before touching anything. Read-only. Run alone.
--
-- EXPECT:
--   has_lock_hours_col = false (the column BLOCK 1 adds)
--   season_0_application_close = 2026-11-04 08:00:00+00 (unchanged since
--     2026-08-12, not touched by this migration)
--   season_0_registration_close = 2026-11-01 06:59:00+00 (the drifted value
--     BLOCK 2 corrects)
--   defer_probe_reason = not_at_close (confirms the function still compiles
--     and behaves as documented before BLOCK 3 replaces it)
-- =========================================================================
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons'
              AND column_name = 'registration_lock_hours')                    AS has_lock_hours_col,
  (SELECT application_close_at FROM public.seasons WHERE id = 'season_0')     AS season_0_application_close,
  (SELECT registration_close_at FROM public.seasons WHERE id = 'season_0')    AS season_0_registration_close;

SELECT reason AS defer_probe_reason FROM public.defer_season_schedule('season_0');


-- =========================================================================
-- BLOCK 1 -- new column. Run alone, after BLOCK 0 confirms.
-- =========================================================================
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS registration_lock_hours INT NOT NULL DEFAULT 72;

-- Verify BLOCK 1 (read-only):
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons'
  AND column_name = 'registration_lock_hours';
-- expect: 1 row, integer, is_nullable=NO, column_default='72'


-- =========================================================================
-- BLOCK 2 -- season_0: set the parameter, recompute the value from the
-- formula (fixes the 1h01m drift at the same time). CTE + RETURNING so the
-- editor shows the affected row. Run alone, after BLOCK 1.
-- =========================================================================
WITH upd AS (
  UPDATE public.seasons
  SET
    registration_lock_hours = 72,
    registration_close_at = application_close_at - INTERVAL '72 hours',
    updated_at = now()
  WHERE id = 'season_0'
  RETURNING id, application_close_at, registration_lock_hours, registration_close_at
)
SELECT * FROM upd;
-- expect: exactly 1 row. registration_close_at = 2026-11-01 08:00:00+00
-- (exactly 72h before application_close_at 2026-11-04 08:00:00+00 -- moved
-- 1h01m later than the old hand-typed value). If 0 rows, nothing changed --
-- stop.


-- =========================================================================
-- BLOCK 3 -- defer_season_schedule, CREATE OR REPLACE. Two changes from the
-- 2026-08-12 19:34 version (reports/season_registration_reminder_2026-08-12.sql
-- BLOCK 3), everything else byte-identical:
--   (a) the self-gate now checks registration_close_at instead of
--       application_close_at (the actual item-1 ask).
--   (b) the registration_close_at shift on defer is now a recompute from the
--       formula (new application_close_at minus registration_lock_hours)
--       instead of shifting by the same day-count as the other columns --
--       this is what keeps the relationship exact through every future
--       defer, not just this one fix.
-- Run alone, after BLOCK 2.
-- =========================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.defer_season_schedule(
  p_season_id TEXT
) RETURNS TABLE(
  deferred BOOLEAN,
  new_close TIMESTAMPTZ,
  new_defer_count INT,
  reason TEXT,
  active_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_season    public.seasons%ROWTYPE;
  v_active    INT;
  v_advanced  INT;
  v_days      INT;
  v_new_close TIMESTAMPTZ;
  v_new_count INT;
BEGIN
  SELECT * INTO v_season FROM public.seasons WHERE id = p_season_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0, 'season_not_found', NULL::INT; RETURN;
  END IF;

  -- (a) CHANGED: registration_close_at, not application_close_at -- headcount
  -- is already final by this point (isRegistrationClosed blocks new signups),
  -- so the defer decision no longer waits for registrants to finish creating
  -- and submitting their video first.
  IF v_season.registration_close_at IS NULL OR now() < v_season.registration_close_at THEN
    RETURN QUERY SELECT FALSE, v_season.application_close_at,
                        v_season.application_defer_count, 'not_at_close', NULL::INT; RETURN;
  END IF;

  SELECT COUNT(*) INTO v_advanced
  FROM public.genesis_applications
  WHERE season_id = p_season_id
    AND status IN ('selected', 'main_round_submitted', 'awarded', 'rejected');
  IF v_advanced > 0 THEN
    RETURN QUERY SELECT FALSE, v_season.application_close_at,
                        v_season.application_defer_count, 'already_advanced', NULL::INT; RETURN;
  END IF;

  v_active := public.count_active_registrations(p_season_id);

  IF v_season.application_defer_count >= v_season.max_defer_count THEN
    IF v_season.absolute_min_participants IS NULL
       OR v_active < v_season.absolute_min_participants THEN
      RETURN QUERY SELECT FALSE, v_season.application_close_at,
                          v_season.application_defer_count, 'below_floor', v_active; RETURN;
    END IF;
    RETURN QUERY SELECT FALSE, v_season.application_close_at,
                        v_season.application_defer_count, 'max_reached', v_active; RETURN;
  END IF;

  IF v_active >= v_season.min_participants THEN
    RETURN QUERY SELECT FALSE, v_season.application_close_at,
                        v_season.application_defer_count, 'enough', v_active; RETURN;
  END IF;

  -- ***IF YOU ADD A NEW seasons TIMESTAMP COLUMN, DECIDE HERE TOO.***
  -- Audit: reports/season_defer_timestamp_audit_2026-08-12.md.
  v_days := v_season.defer_extension_days;
  UPDATE public.seasons SET
    -- (b) CHANGED: formula recompute (new application_close_at minus the
    -- lock-hours parameter), not a same-day-count shift of the old value.
    registration_close_at            = CASE WHEN registration_close_at IS NOT NULL
                                            THEN (application_close_at + (v_days || ' days')::interval)
                                                 - (registration_lock_hours || ' hours')::interval END,
    application_close_at             = application_close_at + (v_days || ' days')::interval,
    scoring_start_at                 = CASE WHEN scoring_start_at IS NOT NULL
                                            THEN scoring_start_at + (v_days || ' days')::interval END,
    scoring_complete_at              = CASE WHEN scoring_complete_at IS NOT NULL
                                            THEN scoring_complete_at + (v_days || ' days')::interval END,
    prelim_results_announcement_at   = CASE WHEN prelim_results_announcement_at IS NOT NULL
                                            THEN prelim_results_announcement_at + (v_days || ' days')::interval END,
    main_round_start_at              = CASE WHEN main_round_start_at IS NOT NULL
                                            THEN main_round_start_at + (v_days || ' days')::interval END,
    main_round_end_at                = CASE WHEN main_round_end_at IS NOT NULL
                                            THEN main_round_end_at + (v_days || ' days')::interval END,
    community_vote_start_at          = CASE WHEN community_vote_start_at IS NOT NULL
                                            THEN community_vote_start_at + (v_days || ' days')::interval END,
    community_vote_end_at            = CASE WHEN community_vote_end_at IS NOT NULL
                                            THEN community_vote_end_at + (v_days || ' days')::interval END,
    awards_announcement_at           = CASE WHEN awards_announcement_at IS NOT NULL
                                            THEN awards_announcement_at + (v_days || ' days')::interval END,
    application_defer_count = application_defer_count + 1,
    updated_at = now()
  WHERE id = p_season_id
  RETURNING application_close_at, application_defer_count
    INTO v_new_close, v_new_count;

  RETURN QUERY SELECT TRUE, v_new_close, v_new_count, 'deferred', v_active;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.defer_season_schedule(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.defer_season_schedule(TEXT) FROM PUBLIC;

COMMIT;

-- Verify BLOCK 3 (read-only):
SELECT * FROM public.defer_season_schedule('season_0');
-- expect reason=not_at_close still (registration_close_at, now 2026-11-01
-- 08:00:00+00, is still in the future) -- confirms the function compiles and
-- the gate-column swap did not change the outcome for season_0 today.
