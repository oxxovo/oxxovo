-- =========================================================================
-- Registration-count reminder (HQ 2026-08-12, item 3 of the deadline split).
-- RUN IN PRODUCTION 2026-08-12 (TK). BLOCK 0-4 all passed: registration_
-- reminder_days={14,7,3,1} on season_0, count_active_registrations callable
-- via anon/authenticated (verified directly, not just granted) and via
-- service_role, defer_season_schedule('season_0') still returns
-- reason='not_at_close', and pg_indexes shows all 3 email_logs_dedup*
-- indexes with the expected WHERE clauses. Kept as the historical record of
-- what was run.
--
-- WHAT THIS DOES
--   1. New column seasons.registration_reminder_days (INT[]) -- the D-14/7/
--      3/1 pattern, same shape as the existing deadline_reminder_hours.
--      season_0 seeded to {14,7,3,1}.
--   2. New function count_active_registrations(season_id) -- the ONE place
--      "how many active registrants does this season have" is defined.
--   3. defer_season_schedule CREATE OR REPLACE, changed to CALL that
--      function instead of keeping its own inline COUNT -- so the automated
--      defer decision and the email participants read are provably the same
--      number, not two copies of one status list that could drift (HQ:
--      "the single most important thing"). Everything else in the function is unchanged from
--      reports/season_registration_close_2026-08-12.sql (already run).
--   4. email_logs_dedup index pair: widen the general one-row-per-template
--      index to also exclude 'registration_count', add a dedicated
--      multi-fire index for it (mirrors submission_deadline's own pair,
--      keyed on metadata->>'reminder_day' instead of 'reminder_hour').
--      Skipping this step would let Postgres's OWN unique constraint reject
--      the 2nd/3rd/4th reminder for the same applicant -- the application-
--      level dedup in lib/email/log.ts is necessary but not sufficient here.
--
-- ASCII only. LF only.
-- =========================================================================


-- =========================================================================
-- BLOCK 0 -- CONFIRM before touching anything. Read-only. Run alone.
--
-- EXPECT:
--   n_general_dedup_idx = 1, general_dedup_def excludes 'submission_deadline'
--     only (not yet 'registration_count' -- that's what BLOCK 4 adds)
--   n_submission_deadline_idx = 1, keyed on (application_id, template_key,
--     (metadata ->> 'reminder_hour'::text))
--   n_registration_count_idx  = 0 (does not exist yet)
--   get_active_application_count_exists = true (the function BLOCK 3's
--     caller-side change retires -- left in place, not dropped, see backlog)
--   season_0_min_participants = 100, season_0_registration_close =
--     2026-11-01 06:59:00+00 (both already run, reports/season_defer_floor_
--     and_vote_shift + season_registration_close)
-- =========================================================================
SELECT
  (SELECT count(*) FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'email_logs_dedup')            AS n_general_dedup_idx,
  (SELECT indexdef FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'email_logs_dedup')            AS general_dedup_def,
  (SELECT count(*) FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'email_logs_dedup_submission_deadline')                  AS n_submission_deadline_idx,
  (SELECT indexdef FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'email_logs_dedup_submission_deadline')                  AS submission_deadline_idx_def,
  (SELECT count(*) FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'email_logs_dedup_registration_count')                   AS n_registration_count_idx,
  EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
              AND p.proname = 'get_active_application_count')                   AS get_active_application_count_exists,
  (SELECT min_participants FROM public.seasons WHERE id = 'season_0')           AS season_0_min_participants,
  (SELECT registration_close_at FROM public.seasons WHERE id = 'season_0')      AS season_0_registration_close;


-- =========================================================================
-- BLOCK 1 -- new column + season_0 seed. Run alone, after BLOCK 0 confirms.
-- =========================================================================
BEGIN;

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS registration_reminder_days INT[];

COMMIT;

WITH upd AS (
  UPDATE public.seasons
  SET registration_reminder_days = ARRAY[14, 7, 3, 1],
      updated_at = now()
  WHERE id = 'season_0'
  RETURNING id, registration_reminder_days
)
SELECT * FROM upd;
-- expect: exactly 1 row, season_0 | {14,7,3,1}. 0 rows -> stop.


-- =========================================================================
-- BLOCK 2 -- count_active_registrations. Run alone, after BLOCK 1.
--
-- Single definition of "active registrant" for this season: the status list
-- is copied verbatim from the CURRENT defer_season_schedule (the one BLOCK 3
-- is about to change to CALL this function instead of keeping its own copy).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.count_active_registrations(
  p_season_id TEXT
) RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $func$
  SELECT COUNT(*)
  FROM public.genesis_applications
  WHERE season_id = p_season_id
    AND status IN ('pending', 'verifying', 'flagged', 'eligible');
$func$;

GRANT EXECUTE ON FUNCTION public.count_active_registrations(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_active_registrations(TEXT) TO anon, authenticated;
-- NOTE: anon+authenticated grant is deliberate, not an oversight: lib/seasons.ts
-- getActiveApplicationCount() is called from /api/apply and app/apply/
-- actions.ts's registerForSeasonAction, both of which can run in a
-- cookie-session (anon-key) context, not just service-role. The function
-- itself only reveals a count, never a row -- same exposure level the
-- pre-existing get_active_application_count already had (its callers are
-- the same call sites).

-- Verify BLOCK 2 (read-only):
SELECT public.count_active_registrations('season_0') AS active_count;
-- expect: 0 (season_0 has no real applicants yet, application_open_at is
-- 2026-09-09, still in the future as of this writing)


-- =========================================================================
-- BLOCK 3 -- defer_season_schedule, CREATE OR REPLACE once more. Calls
-- count_active_registrations for v_active instead of its own inline COUNT.
-- Everything else is byte-identical to reports/season_registration_close_
-- 2026-08-12.sql's version (already run) -- only the v_active assignment
-- changed. Run alone, after BLOCK 2.
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

  -- NOTE: single source (HQ 2026-08-12): was an inline SELECT COUNT here, now
  -- calls the same function lib/seasons.ts getActiveApplicationCount() calls
  -- for the registration-count email's number.
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

-- Verify BLOCK 3 (read-only):
SELECT * FROM public.defer_season_schedule('season_0');
-- expect reason='not_at_close', same as every prior verification of this
-- function today -- confirms it still compiles and the call-out to
-- count_active_registrations did not change behavior for season_0.


-- =========================================================================
-- BLOCK 4 -- email_logs_dedup index pair. Run alone, after BLOCK 3.
--
-- DROP + CREATE, not ALTER (Postgres has no ALTER INDEX ... for a WHERE
-- clause change) -- safe here because these are indexes, not the base table
-- or a view with grants to lose; a unique index carries no data of its own.
-- =========================================================================
BEGIN;

DROP INDEX IF EXISTS public.email_logs_dedup;

CREATE UNIQUE INDEX email_logs_dedup
  ON public.email_logs(application_id, template_key)
  WHERE status = 'sent'
    AND template_key NOT IN ('submission_deadline', 'registration_count');

CREATE UNIQUE INDEX IF NOT EXISTS email_logs_dedup_registration_count
  ON public.email_logs(application_id, template_key, (metadata->>'reminder_day'))
  WHERE status = 'sent'
    AND template_key = 'registration_count';

COMMIT;

-- Verify BLOCK 4 (read-only):
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'email_logs'
  AND indexname LIKE 'email_logs_dedup%'
ORDER BY indexname;
-- expect 3 rows: email_logs_dedup (excludes BOTH submission_deadline and
-- registration_count), email_logs_dedup_submission_deadline (unchanged),
-- email_logs_dedup_registration_count (new, keyed on reminder_day)
