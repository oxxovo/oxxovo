-- =========================================================================
-- registration_close_at (HQ 2026-08-12, item 2 of the deploy-blocking split).
-- DRAFT ONLY -- TK runs this. Run AFTER
-- reports/season_defer_floor_and_vote_shift_2026-08-12.sql (item 1) has
-- landed; this file's function body includes everything that one already
-- did (community_vote + prelim_results_announcement_at shifts, the
-- below_floor branch) PLUS registration_close_at, so it is safe to run even
-- if item 1 has not landed yet -- it just redefines the function completely
-- either way. Five blocks. Run in order, read each result before the next.
--
-- WHAT THIS DOES
--   1. New column seasons.registration_close_at (nullable timestamptz) + a
--      CHECK that it can't sit after application_close_at.
--   2. season_0 value: 2026-10-31 23:59 PT (application_close_at, 11/4,
--      stays exactly as it is -- not touched by this file).
--   3/4/5. seasons_public gains the column (68 -> 69, CREATE OR REPLACE,
--      append-only -- see the BLOCK 3/4/5 headers below for why this is not
--      DROP + CREATE), and defer_season_schedule shifts it alongside every
--      other downstream date on a defer.
--
-- WHY THE VIEW MATTERS HERE SPECIFICALLY: getSeasonById()/getCurrentSeason()
-- (the functions every registration/submission gate in the app calls) read
-- seasons_public, not the base table -- confirmed 2026-08-12 with the anon
-- key (68 columns, registration_close_at absent). Skipping BLOCK 3/4/5 would
-- leave the new gate silently seeing "no cutoff, never closed" forever: the
-- column would exist and be set, but nothing participant-facing could ever
-- read it.
--
-- ASCII only. LF only.
-- =========================================================================


-- =========================================================================
-- BLOCK 1 -- base column + CHECK + season_0 value. Run alone.
-- =========================================================================
BEGIN;

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS registration_close_at TIMESTAMPTZ;

ALTER TABLE public.seasons
  DROP CONSTRAINT IF EXISTS seasons_registration_before_submission_chk;
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_registration_before_submission_chk
  CHECK (
    registration_close_at IS NULL
    OR application_close_at IS NULL
    OR registration_close_at <= application_close_at
  );

COMMIT;

-- Verify BLOCK 1 (read-only):
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons'
  AND column_name = 'registration_close_at';
-- expect: 1 row, data_type=timestamp with time zone, is_nullable=YES


-- =========================================================================
-- BLOCK 2 -- season_0 value. Wrapped in a CTE + RETURNING so the editor
-- shows the affected row (Supabase SQL Editor does not surface UPDATE
-- row-counts on its own). Run alone, after BLOCK 1.
-- =========================================================================
WITH upd AS (
  UPDATE public.seasons
  SET
    registration_close_at = (TIMESTAMP '2026-10-31 23:59' AT TIME ZONE 'America/Los_Angeles'),
    updated_at = now()
  WHERE id = 'season_0'
  RETURNING id, registration_close_at, application_close_at
)
SELECT * FROM upd;
-- expect: exactly 1 row. registration_close_at = 2026-11-01 06:59:00+00
-- (10/31 23:59 PDT -- Nov 1 DST end has not happened yet), application_close_at
-- UNCHANGED at 2026-11-04 08:00:00+00. If 0 rows, nothing changed -- stop.


-- =========================================================================
-- BLOCK 3 -- CONFIRM the view before touching it. Read-only. Run alone.
--
-- EXPECT (every one is a STOP condition if it disagrees):
--   n_view_cols       = 68
--   has_registration  = false    <- the one being added
--   view_reloptions   = (none)
--   has_where_clause  = false    <- a column list cannot show a row filter;
--        if this comes back true, STOP -- BLOCK 4's plain projection would
--        be wrong and needs to be rewritten against pg_get_viewdef.
-- =========================================================================
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'seasons_public')            AS n_view_cols,
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons_public'
              AND column_name = 'registration_close_at')                        AS has_registration,
  (SELECT coalesce(array_to_string(reloptions, ', '), '(none)') FROM pg_class
     WHERE oid = 'public.seasons_public'::regclass)                              AS view_reloptions,
  (pg_get_viewdef('public.seasons_public'::regclass, true) ~* '\mwhere\M')       AS has_where_clause;


-- =========================================================================
-- BLOCK 4 -- REDEFINE the view. Run ONLY if BLOCK 3 matched every expected
-- value above.
--
-- 69 columns: the existing 68 (verbatim, same order -- taken from the last
-- confirmed live definition, reports/hq_seasons_public_redefine_2026-08-09.sql
-- BLOCK 2), then registration_close_at appended. NO WITH (...) clause --
-- this view does not run as the invoker (confirmed 2026-08-09: anon has zero
-- privilege on public.seasons directly, so a security_invoker view would
-- 42501 immediately, and it does not) -- adding one would take the public
-- site down.
-- =========================================================================
CREATE OR REPLACE VIEW public.seasons_public AS
SELECT
  s.id,
  s.name,
  s.season_number,
  s.status,
  s.max_applicants,
  s.top_n_advance,
  s.application_video_min_seconds,
  s.application_video_max_seconds,
  s.total_prize_pool,
  s.entry_fee,
  s.main_round_video_seconds,
  s.theme_announcement_minutes_before,
  s.submission_hours,
  s.community_vote_weight,
  s.ai_score_weight,
  s.scoring_intent_clarity_weight,
  s.scoring_execution_weight,
  s.scoring_originality_weight,
  s.scoring_integrity_weight,
  s.ai_models,
  s.flag_integrity_threshold,
  s.flag_spread_threshold,
  s.application_open_at,
  s.application_close_at,
  s.scoring_complete_at,
  s.main_round_start_at,
  s.main_round_end_at,
  s.awards_announcement_at,
  s.created_at,
  s.updated_at,
  s.prize_first_pct,
  s.prize_second_pct,
  s.prize_third_pct,
  s.prize_first,
  s.prize_second,
  s.prize_third,
  s.display_name,
  s.main_round_video_min_seconds,
  s.main_round_video_max_seconds,
  s.deadline_reminder_hours,
  s.award_prizes,
  s.flag_integrity_high_threshold,
  s.flag_integrity_medium_threshold,
  s.flag_integrity_low_threshold,
  s.season_theme,
  s.allowed_video_platforms,
  s.scoring_start_at,
  s.host_type,
  s.host_user_id,
  s.prize_pool_escrow_status,
  s.prize_pool_escrow_paid_at,
  s.commission_rate_override,
  s.prize_funding_mode,
  s.poster_url,
  s.lobby_featured,
  s.min_participants,
  s.application_defer_count,
  s.defer_extension_days,
  s.max_defer_count,
  s.advance_pct,
  s.advance_min,
  s.advance_max,
  s.main_round_theme,
  s.community_vote_start_at,
  s.community_vote_end_at,
  s.main_round_theme_label,
  s.is_fixture,
  s.prelim_results_announcement_at,
  s.registration_close_at   -- NEW
FROM public.seasons s;


-- =========================================================================
-- BLOCK 5 -- VERIFY. Run after BLOCK 4.
--
-- EXPECT:
--   n_view_cols              = 69
--   has_registration         = true
--   n_rows_through_view      = 14        <- same as before BLOCK 4, no row
--                                            filter appeared
--   season_0_registration_utc = 2026-11-01 06:59:00+00
--   anon_can_select          = true      <- grants survived REPLACE
--   service_role_can_select  = false     <- unchanged (yes, false -- see
--                                            reports/hq_seasons_public_
--                                            redefine_2026-08-09.sql for why)
--   whitespace_ok            = 0
-- =========================================================================
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'seasons_public')            AS n_view_cols,
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons_public'
              AND column_name = 'registration_close_at')                        AS has_registration,
  (SELECT count(*) FROM public.seasons_public)                                   AS n_rows_through_view,
  (SELECT registration_close_at AT TIME ZONE 'UTC'
     FROM public.seasons_public WHERE id = 'season_0')                           AS season_0_registration_utc,
  has_table_privilege('anon',          'public.seasons_public', 'SELECT')        AS anon_can_select,
  has_table_privilege('service_role',  'public.seasons_public', 'SELECT')        AS service_role_can_select,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'seasons_public'
       AND column_name ~ '\s')                                                  AS whitespace_ok;


-- =========================================================================
-- BLOCK 6 -- defer_season_schedule, full CREATE OR REPLACE (supersedes item
-- 1's version -- includes everything that one had, plus registration_close_at
-- in the shift list). Run after BLOCK 5.
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

  IF v_season.application_close_at IS NULL OR now() < v_season.application_close_at THEN
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

  SELECT COUNT(*) INTO v_active
  FROM public.genesis_applications
  WHERE season_id = p_season_id
    AND status IN ('pending', 'verifying', 'flagged', 'eligible');

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
  -- Audit: reports/season_defer_timestamp_audit_2026-08-12.md. This is the
  -- THIRD time a date column was missed from this list (community_vote_*,
  -- then prelim_results_announcement_at, both caught the same day) --
  -- registration_close_at is added here on purpose, as the same class of
  -- column (a deadline that has to move with the rest of the calendar when
  -- the season slips a week).
  v_days := v_season.defer_extension_days;
  UPDATE public.seasons SET
    registration_close_at            = CASE WHEN registration_close_at IS NOT NULL
                                            THEN registration_close_at + (v_days || ' days')::interval END,
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

-- Verify BLOCK 6 (read-only):
SELECT * FROM public.defer_season_schedule('season_0');
-- expect reason='not_at_close' (application_close_at is 2026-11-04, still in
-- the future) -- confirms the function compiles and the 5-column shape
-- returns without error, same as item 1's verification.
