-- =========================================================================
-- Defer RPC fix + 100/80 threshold update (HQ 2026-08-12).
-- DRAFT ONLY. Do not run without a fresh review -- this file is written by
-- the assistant for TK to run, per this session's standing rule.
--
-- Three independent changes bundled because they all touch the same
-- function/row:
--   1. defer_season_schedule was missing community_vote_start_at/end_at from
--      the columns it shifts on defer (those two columns were added to the
--      schema after this RPC was written). A real gap, found while designing
--      item 2 below -- independent of the application/registration split.
--   2. New "absolute floor" behavior: once max_defer_count is exhausted, the
--      RPC used to let the season close no matter how few applicants it had.
--      Now: >= absolute_min_participants -> proceeds (reason='max_reached',
--      unchanged label); below it -> holds for manual review
--      (reason='below_floor', new) instead of silently closing. NULL floor
--      means "never told a number" and holds for review the same way (see
--      lib/seasons.ts comment) -- it is not "no floor enforced".
--   3. season_0 values: min_participants 50 -> 100 (the number that actually
--      matters was stale -- confirmed against the live "확정값 시트" 2026-08-12,
--      NOT the unrelated Founding Creator free-membership cap, which is also
--      100 but a different, platform-lifetime number). New
--      absolute_min_participants = 80. max_defer_count 2 -> 3.
--
-- ASCII-only. Run as one block in Supabase SQL Editor.
-- =========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. New column. Nullable -- existing seasons (season_1..4) get NULL until an
--    admin sets a real value via /admin/seasons; the RPC's NULL handling
--    (fail toward manual review, not toward auto-close) makes that safe.
-- ---------------------------------------------------------------------------
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS absolute_min_participants INT;

-- ---------------------------------------------------------------------------
-- 2. season_0 values.
-- ---------------------------------------------------------------------------
UPDATE public.seasons
SET
  min_participants = 100,
  absolute_min_participants = 80,
  max_defer_count = 3,
  updated_at = now()
WHERE id = 'season_0';

-- ---------------------------------------------------------------------------
-- 3. defer_season_schedule -- CREATE OR REPLACE (same signature, so any
--    caller/grant is unaffected). v_active is now computed BEFORE the defer-
--    budget check (previously after), because the budget-exhausted branch
--    needs it to decide max_reached vs below_floor. New 5th return column
--    active_count -- callers that destructure by name (season-tick does) are
--    unaffected; nothing here reads by positional index.
-- ---------------------------------------------------------------------------
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

  -- Only at/after the (current) application close.
  IF v_season.application_close_at IS NULL OR now() < v_season.application_close_at THEN
    RETURN QUERY SELECT FALSE, v_season.application_close_at,
                        v_season.application_defer_count, 'not_at_close', NULL::INT; RETURN;
  END IF;

  -- Never defer once the season has moved past application (finalists chosen
  -- or anyone scored-out) -- the window is done.
  SELECT COUNT(*) INTO v_advanced
  FROM public.genesis_applications
  WHERE season_id = p_season_id
    AND status IN ('selected', 'main_round_submitted', 'awarded', 'rejected');
  IF v_advanced > 0 THEN
    RETURN QUERY SELECT FALSE, v_season.application_close_at,
                        v_season.application_defer_count, 'already_advanced', NULL::INT; RETURN;
  END IF;

  -- Real applicants occupying a slot (pre-decision statuses). Computed here,
  -- before the budget check, because the budget-exhausted branch below needs
  -- it too.
  SELECT COUNT(*) INTO v_active
  FROM public.genesis_applications
  WHERE season_id = p_season_id
    AND status IN ('pending', 'verifying', 'flagged', 'eligible');

  -- Out of defer budget. NULL absolute_min_participants is NOT "no floor" --
  -- it means this season was never told a floor, so it holds for review the
  -- same as the pre-existing "cap reached -> admin decides" policy did before
  -- this floor had a number attached to it.
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

  -- Shortfall + budget remains -> shift the whole downstream calendar,
  -- including community_vote (previously missing).
  v_days := v_season.defer_extension_days;
  UPDATE public.seasons SET
    application_close_at    = application_close_at + (v_days || ' days')::interval,
    scoring_start_at        = CASE WHEN scoring_start_at IS NOT NULL
                                   THEN scoring_start_at + (v_days || ' days')::interval END,
    scoring_complete_at     = CASE WHEN scoring_complete_at IS NOT NULL
                                   THEN scoring_complete_at + (v_days || ' days')::interval END,
    main_round_start_at     = CASE WHEN main_round_start_at IS NOT NULL
                                   THEN main_round_start_at + (v_days || ' days')::interval END,
    main_round_end_at       = CASE WHEN main_round_end_at IS NOT NULL
                                   THEN main_round_end_at + (v_days || ' days')::interval END,
    community_vote_start_at = CASE WHEN community_vote_start_at IS NOT NULL
                                   THEN community_vote_start_at + (v_days || ' days')::interval END,
    community_vote_end_at   = CASE WHEN community_vote_end_at IS NOT NULL
                                   THEN community_vote_end_at + (v_days || ' days')::interval END,
    awards_announcement_at  = CASE WHEN awards_announcement_at IS NOT NULL
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

-- ---------------------------------------------------------------------------
-- Verification (read-only, safe to run standalone after the above commits).
-- ---------------------------------------------------------------------------
SELECT id, min_participants, absolute_min_participants, max_defer_count,
       application_defer_count
FROM public.seasons
WHERE id = 'season_0';
-- expect: 100 | 80 | 3 | 0

SELECT * FROM public.defer_season_schedule('season_0');
-- expect reason='not_at_close' (application_close_at is 2026-11-04, in the
-- future as of this writing) -- confirms the function still compiles/runs
-- and the new 5-column shape returns without error.
