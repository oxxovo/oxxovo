-- ============================================================================
-- Advance RPC v2: 2-decimal official score + Official Cut Line
-- ============================================================================
-- Supersedes the ranking/cut logic in advance_defer_automation_2026-06.sql.
-- Two changes, per TK/advisor 2026-07-11:
--   1. Judge on the OFFICIAL score = ROUND(verified_score, 2). Storage stays
--      numeric(7,4) for audit; ranking/display use 2 decimals so "0.001 never
--      decides a result" and display == ranking.
--   2. OFFICIAL CUT LINE: everyone whose 2-decimal score is >= the score at
--      rank N advances. Ties at the line are ALL included (may exceed N). The
--      operator never breaks a tie -- the Triple-AI result is respected as-is.
--      (Real data: at 2 decimals ties are rare -- max 2 in a 41-entry sample --
--      so the headcount barely moves.)
--
-- Everything else (gates, idempotency, flagged block, rejected sweep) is
-- unchanged from v1. Idempotent CREATE OR REPLACE. TK runs in Supabase AFTER
-- score_precision_2026-07.sql.
-- ============================================================================

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
  v_cut_score        NUMERIC;
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

  -- Official cut score = the 2-decimal score at rank N (order by 2-decimal
  -- score desc; earliest applicant only breaks the OFFSET position, not the
  -- cut). This is the line entries must reach to advance.
  SELECT ROUND(sr.verified_score, 2) INTO v_cut_score
  FROM public.genesis_applications ga
  JOIN public.scoring_results sr
    ON sr.application_id = ga.id
   AND sr.season_id = p_season_id
   AND sr.round = 'application'
  WHERE ga.season_id = p_season_id
    AND ga.status = 'eligible'
    AND sr.judged_status = 'completed'
    AND sr.integrity_flag = FALSE
  ORDER BY ROUND(sr.verified_score, 2) DESC NULLS LAST, ga.created_at ASC
  OFFSET (v_n - 1) LIMIT 1;

  -- OFFICIAL CUT LINE: every eligible entry at or above the cut advances.
  -- Ties at the line are all included (headcount may exceed N). No tiebreak,
  -- no operator judgment -- the AI result stands.
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
      AND ROUND(sr.verified_score, 2) >= v_cut_score
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

  -- Record the ACTUAL number advanced (>= N when the cut line ties). This is
  -- what SelectedTop50 emails read as "top {N}", so it must be the real count.
  UPDATE public.seasons
  SET top_n_advance = v_adv, updated_at = now()
  WHERE id = p_season_id;

  -- n_target returns the computed target N (v_n); advanced returns the actual
  -- count (v_adv), which is >= v_n when the cut line includes ties.
  RETURN QUERY SELECT v_adv, v_rej, v_n, NULL::TEXT;
END;
$func$;
