-- ===========================================================================
-- ADVANCEMENT + DEFERRAL automation RPCs  (3rd priority, step 4)
-- ===========================================================================
-- Two SECURITY DEFINER functions called by the hourly season-tick cron. Both
-- are atomic (FOR UPDATE on the season row) and idempotent, so concurrent ticks
-- and re-runs are safe.
--
--   advance_season_finalists(season)  -- at scoring_complete_at, gated on
--       verifying=0 AND flagged=0, picks the top computeAdvanceCount() eligible
--       entrants by verified_score (desc, created_at asc tiebreak) -> 'selected'
--       (Finalist); the rest of the scored, non-flagged pool -> 'rejected'.
--       flagged (integrity) rows are never touched -- admin review flow
--       ([[project-system-error-not-user-rejection]]). Mirrors the manual
--       apply_season_recommendations path, but selects directly (no pre-baked
--       season_recommendations rows needed).
--
--   defer_season_schedule(season)  -- at application_close_at, if fewer than
--       min_participants real applicants AND defer budget remains, shifts the
--       WHOLE downstream calendar (close/scoring/main/awards) by
--       defer_extension_days and bumps application_defer_count. Preserves all
--       durations and gaps (TK choice 2026-06-20: shift everything, not just
--       close). A free Season 0 never rolls applicants into a paid season --
--       deferral extends the window in place. See [[project-season0-3stage]].
--
-- The clamp math in advance_season_finalists mirrors lib/seasons.ts
-- computeAdvanceCount() exactly: clamp(round(eligible * advance_pct),
-- advance_min, advance_max), capped at eligible. Keep them in sync.
--
-- Style: ASCII only, named dollar-quote ($func$) for bodies, NO standalone
-- DO $$ blocks (Supabase SQL Editor 42601 / silent-rollback trap). See
-- [[feedback-sql-ascii-only]]. No hardcoded N or dates ([[feedback-no-hardcode]]).
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. advance_season_finalists
-- ---------------------------------------------------------------------------
-- Returns one row. `blocked` is NULL on a real advancement; otherwise it names
-- why nothing happened (so the cron can log/alert without guessing).
CREATE OR REPLACE FUNCTION public.advance_season_finalists(
  p_season_id TEXT
) RETURNS TABLE(advanced INT, rejected INT, n_target INT, blocked TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_season           public.seasons%ROWTYPE;
  v_existing         INT;
  v_verifying        INT;
  v_pending_scoring  INT;
  v_flagged          INT;
  v_eligible         INT;
  v_n                INT;
  v_top_ids          UUID[];
  v_adv              INT;
  v_rej              INT;
BEGIN
  -- Lock the season row so two ticks cannot both advance it.
  SELECT * INTO v_season FROM public.seasons WHERE id = p_season_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0, 0, 'season_not_found'; RETURN;
  END IF;

  -- Gate: scoring window must be complete.
  IF v_season.scoring_complete_at IS NULL OR now() < v_season.scoring_complete_at THEN
    RETURN QUERY SELECT 0, 0, 0, 'not_yet'; RETURN;
  END IF;

  -- Idempotent: if finalists already exist, do nothing.
  SELECT COUNT(*) INTO v_existing
  FROM public.genesis_applications
  WHERE season_id = p_season_id
    AND status IN ('selected', 'main_round_submitted', 'awarded');
  IF v_existing > 0 THEN
    RETURN QUERY SELECT 0, 0, 0, 'already_done'; RETURN;
  END IF;

  -- Gate: no application-round scoring still running.
  SELECT COUNT(*) INTO v_verifying
  FROM public.genesis_applications
  WHERE season_id = p_season_id AND status = 'verifying';

  SELECT COUNT(*) INTO v_pending_scoring
  FROM public.scoring_results
  WHERE season_id = p_season_id AND round = 'application'
    AND judged_status IN ('pending', 'in_progress');

  IF v_verifying > 0 OR v_pending_scoring > 0 THEN
    RETURN QUERY SELECT 0, 0, 0, 'scoring_in_progress'; RETURN;
  END IF;

  -- Gate: flagged (integrity) rows must be cleared by an admin first. They
  -- could belong in the top N, so we never advance past them automatically.
  SELECT COUNT(*) INTO v_flagged
  FROM public.genesis_applications
  WHERE season_id = p_season_id AND status = 'flagged';
  IF v_flagged > 0 THEN
    RETURN QUERY SELECT 0, 0, 0, 'flagged_pending'; RETURN;
  END IF;

  -- Eligible pool = scored, completed, non-flagged, still 'eligible'.
  SELECT COUNT(*) INTO v_eligible
  FROM public.genesis_applications ga
  JOIN public.scoring_results sr
    ON sr.application_id = ga.id
   AND sr.season_id = p_season_id
   AND sr.round = 'application'
  WHERE ga.season_id = p_season_id
    AND ga.status = 'eligible'
    AND sr.judged_status = 'completed'
    AND sr.integrity_flag = FALSE;

  IF v_eligible = 0 THEN
    RETURN QUERY SELECT 0, 0, 0, 'no_eligible'; RETURN;
  END IF;

  -- N = clamp(round(eligible * advance_pct), advance_min, advance_max),
  -- capped at eligible. Mirrors lib/seasons.ts computeAdvanceCount().
  v_n := LEAST(
           GREATEST(
             v_season.advance_min,
             LEAST(v_season.advance_max, ROUND(v_eligible * v_season.advance_pct))
           ),
           v_eligible
         )::INT;

  -- Top N ids: verified_score desc, earliest applicant wins ties.
  SELECT array_agg(t.id) INTO v_top_ids
  FROM (
    SELECT ga.id
    FROM public.genesis_applications ga
    JOIN public.scoring_results sr
      ON sr.application_id = ga.id
     AND sr.season_id = p_season_id
     AND sr.round = 'application'
    WHERE ga.season_id = p_season_id
      AND ga.status = 'eligible'
      AND sr.judged_status = 'completed'
      AND sr.integrity_flag = FALSE
    ORDER BY sr.verified_score DESC NULLS LAST, ga.created_at ASC
    LIMIT v_n
  ) t;

  -- Selected (Finalist).
  UPDATE public.genesis_applications
  SET status = 'selected'
  WHERE id = ANY(v_top_ids);
  GET DIAGNOSTICS v_adv = ROW_COUNT;

  -- Rejected = the rest of the scored, non-flagged eligible pool.
  UPDATE public.genesis_applications ga
  SET status = 'rejected'
  FROM public.scoring_results sr
  WHERE ga.id = sr.application_id
    AND sr.season_id = p_season_id
    AND sr.round = 'application'
    AND sr.judged_status = 'completed'
    AND sr.integrity_flag = FALSE
    AND ga.season_id = p_season_id
    AND ga.status = 'eligible'
    AND NOT (ga.id = ANY(v_top_ids));
  GET DIAGNOSTICS v_rej = ROW_COUNT;

  -- Record the computed N (single source = this run).
  UPDATE public.seasons
  SET top_n_advance = v_n, updated_at = now()
  WHERE id = p_season_id;

  RETURN QUERY SELECT v_adv, v_rej, v_n, NULL::TEXT;
END;
$func$;

GRANT EXECUTE ON FUNCTION public.advance_season_finalists(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.advance_season_finalists(TEXT) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- 2. defer_season_schedule
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.defer_season_schedule(
  p_season_id TEXT
) RETURNS TABLE(deferred BOOLEAN, new_close TIMESTAMPTZ, new_defer_count INT, reason TEXT)
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
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ, 0, 'season_not_found'; RETURN;
  END IF;

  -- Only at/after the (current) application close.
  IF v_season.application_close_at IS NULL OR now() < v_season.application_close_at THEN
    RETURN QUERY SELECT FALSE, v_season.application_close_at,
                        v_season.application_defer_count, 'not_at_close'; RETURN;
  END IF;

  -- Out of defer budget -> let it close normally.
  IF v_season.application_defer_count >= v_season.max_defer_count THEN
    RETURN QUERY SELECT FALSE, v_season.application_close_at,
                        v_season.application_defer_count, 'max_reached'; RETURN;
  END IF;

  -- Never defer once the season has moved past application (finalists chosen
  -- or anyone scored-out) -- the window is done.
  SELECT COUNT(*) INTO v_advanced
  FROM public.genesis_applications
  WHERE season_id = p_season_id
    AND status IN ('selected', 'main_round_submitted', 'awarded', 'rejected');
  IF v_advanced > 0 THEN
    RETURN QUERY SELECT FALSE, v_season.application_close_at,
                        v_season.application_defer_count, 'already_advanced'; RETURN;
  END IF;

  -- Real applicants occupying a slot (pre-decision statuses).
  SELECT COUNT(*) INTO v_active
  FROM public.genesis_applications
  WHERE season_id = p_season_id
    AND status IN ('pending', 'verifying', 'flagged', 'eligible');

  IF v_active >= v_season.min_participants THEN
    RETURN QUERY SELECT FALSE, v_season.application_close_at,
                        v_season.application_defer_count, 'enough'; RETURN;
  END IF;

  -- Shortfall + budget remains -> shift the whole downstream calendar.
  v_days := v_season.defer_extension_days;
  UPDATE public.seasons SET
    application_close_at   = application_close_at + (v_days || ' days')::interval,
    scoring_start_at       = CASE WHEN scoring_start_at IS NOT NULL
                                  THEN scoring_start_at + (v_days || ' days')::interval END,
    scoring_complete_at    = CASE WHEN scoring_complete_at IS NOT NULL
                                  THEN scoring_complete_at + (v_days || ' days')::interval END,
    main_round_start_at    = CASE WHEN main_round_start_at IS NOT NULL
                                  THEN main_round_start_at + (v_days || ' days')::interval END,
    main_round_end_at      = CASE WHEN main_round_end_at IS NOT NULL
                                  THEN main_round_end_at + (v_days || ' days')::interval END,
    awards_announcement_at = CASE WHEN awards_announcement_at IS NOT NULL
                                  THEN awards_announcement_at + (v_days || ' days')::interval END,
    application_defer_count = application_defer_count + 1,
    updated_at = now()
  WHERE id = p_season_id
  RETURNING application_close_at, application_defer_count
    INTO v_new_close, v_new_count;

  RETURN QUERY SELECT TRUE, v_new_close, v_new_count, 'deferred';
END;
$func$;

GRANT EXECUTE ON FUNCTION public.defer_season_schedule(TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.defer_season_schedule(TEXT) FROM PUBLIC;

COMMIT;

-- ===========================================================================
-- Verification (run AFTER commit)
-- ===========================================================================
-- 1) both functions exist, SECURITY DEFINER, 1 arg
SELECT proname, pronargs, prosecdef AS security_definer
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('advance_season_finalists', 'defer_season_schedule')
ORDER BY proname;
-- expect 2 rows, pronargs=1, security_definer=t

-- 2) EXECUTE granted to service_role only
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('advance_season_finalists', 'defer_season_schedule')
ORDER BY routine_name, grantee;
-- expect grantee=service_role EXECUTE for each (no PUBLIC)

-- 3) season_0 is not yet at any gate (scoring_complete 9/2, close 8/30 future)
SELECT * FROM public.advance_season_finalists('season_0');  -- expect blocked='not_yet'
SELECT * FROM public.defer_season_schedule('season_0');     -- expect reason='not_at_close'
