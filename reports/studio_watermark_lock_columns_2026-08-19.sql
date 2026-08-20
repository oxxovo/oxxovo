-- ============================================================================
-- Studio watermark request triggers + display-name season lock (2026-08-19)
-- ============================================================================
-- Three columns for two independent features:
--
--   profiles.display_name_locked_at
--     Set at first submission of a season (lib/studio.ts, alongside
--     studio_application_submitted_at); read by saveDisplayName to refuse
--     edits while locked. Unlocked NOT by a cron but by the applicant editing
--     their nickname in a future season's application flow (TK 2026-08-19) --
--     that UI does not exist yet, so nothing writes NULL back here today.
--
--   render_jobs.download_requested_at / promo_requested_at
--     Participant-download and OXXOVO-promo watermark copies are generated
--     on demand by a new worker lane (oxxovo-studio), which polls render_jobs
--     for these timestamps the same way the existing render lane polls
--     status='queued'. Setting one of these is the "please generate" request;
--     download_r2_key/promo_r2_key (added 2026-08-19 earlier migration) being
--     non-null is "done".
--
-- ASCII-only, idempotent. Run in Supabase SQL editor. Project = qrnkovokjmimagrwjebs.
-- ============================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name_locked_at timestamptz;

ALTER TABLE public.render_jobs
  ADD COLUMN IF NOT EXISTS download_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_requested_at timestamptz;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Verification -- expect 3 rows
-- ============================================================================
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'profiles' AND column_name = 'display_name_locked_at')
    OR (table_name = 'render_jobs' AND column_name IN ('download_requested_at', 'promo_requested_at'))
  )
ORDER BY table_name, column_name;
