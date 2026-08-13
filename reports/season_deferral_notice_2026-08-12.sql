-- =========================================================================
-- Deferral notice (HQ 2026-08-12) -- participant-facing email fired when
-- defer_season_schedule actually shifts a season's calendar. Today only
-- sendAdminAlert fires (info@oxxovo.ai, ops-only) -- confirmed by reading
-- every notify path in app/api/cron/season-tick/route.ts, all ~10 of them
-- go through sendAdminAlert, none reach a participant. This closes that gap
-- at the email-tick layer (participant sends live there, not in season-tick)
-- -- no season-tick change, no new signal from it: email-tick re-checks
-- every season's CURRENT application_defer_count every tick, and the
-- per-defer_count dedup below makes every tick after the first send for
-- that count a no-op.
--
-- DRAFT ONLY -- TK runs this. Two blocks, read each result before the next.
-- Mirrors reports/season_registration_reminder_2026-08-12.sql's BLOCK 4
-- exactly (same reason: the DB-level unique index would otherwise reject
-- the 2nd/3rd deferral notice for the same applicant outright, regardless
-- of the application-level dedup).
--
-- ASCII only. LF only.
-- =========================================================================


-- =========================================================================
-- BLOCK 0 -- CONFIRM before touching anything. Read-only. Run alone.
--
-- EXPECT:
--   n_general_dedup_idx = 1, general_dedup_def excludes 'submission_deadline'
--     AND 'registration_count' (both already run) -- NOT yet 'deferral_notice'
--   n_deferral_notice_idx = 0 (does not exist yet)
-- =========================================================================
SELECT
  (SELECT count(*) FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'email_logs_dedup')            AS n_general_dedup_idx,
  (SELECT indexdef FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'email_logs_dedup')            AS general_dedup_def,
  (SELECT count(*) FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'email_logs_dedup_deferral_notice')                      AS n_deferral_notice_idx;


-- =========================================================================
-- BLOCK 1 -- widen the general exclusion, add the deferral_notice index.
-- Run alone, after BLOCK 0 confirms.
-- =========================================================================
BEGIN;

DROP INDEX IF EXISTS public.email_logs_dedup;

CREATE UNIQUE INDEX email_logs_dedup
  ON public.email_logs(application_id, template_key)
  WHERE status = 'sent'
    AND template_key NOT IN ('submission_deadline', 'registration_count', 'deferral_notice');

CREATE UNIQUE INDEX IF NOT EXISTS email_logs_dedup_deferral_notice
  ON public.email_logs(application_id, template_key, (metadata->>'defer_count'))
  WHERE status = 'sent'
    AND template_key = 'deferral_notice';

COMMIT;

-- Verify BLOCK 1 (read-only):
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'email_logs'
  AND indexname LIKE 'email_logs_dedup%'
ORDER BY indexname;
-- expect 4 rows: email_logs_dedup (excludes submission_deadline,
-- registration_count, AND deferral_notice), email_logs_dedup_
-- submission_deadline (unchanged), email_logs_dedup_registration_count
-- (unchanged), email_logs_dedup_deferral_notice (new, keyed on defer_count)
