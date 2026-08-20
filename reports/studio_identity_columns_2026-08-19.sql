-- ============================================================================
-- Studio identity + watermark columns, consolidated (2026-08-19)
-- ============================================================================
-- Supersedes the smaller studio_watermark_lock_columns_2026-08-19.sql sent
-- earlier this session (same columns re-listed here with IF NOT EXISTS, so
-- running this is safe whether or not that one was already run).
--
-- profiles:
--   real_name             Display-purpose only, NOT a tax/KYC field (Stripe
--                         Connect collects that separately at payout time --
--                         TK 2026-08-19: do not duplicate that data here).
--                         Filled only when display_identity = 'real_name'.
--   display_identity      'nickname' (default) | 'real_name'. Account-level
--                         choice of what shows on the participant's own work,
--                         OXXOVO promo copies, and rankings.
--   display_name_locked_at
--                         Set at first submission of a season (lib/studio.ts).
--                         Gates edits to ALL THREE identity fields together
--                         (display_name, real_name, display_identity) as one
--                         unit -- TK 2026-08-19: they lock at the same point,
--                         so one timestamp covers all three, not three locks.
--   display_name_changed_at / display_name_change_count
--                         Storage for the change-rate policy (3 months / 3
--                         changes, per TK). Enforcement logic reads these two
--                         columns once wired -- not built in this migration,
--                         which only adds the storage.
--
-- render_jobs:
--   download_requested_at / promo_requested_at
--     Participant-download and OXXOVO-promo watermark copies are generated on
--     demand by a new worker lane (oxxovo-studio), which polls render_jobs for
--     these timestamps the same way the existing render lane polls
--     status='queued'. download_r2_key/promo_r2_key (added by an earlier
--     2026-08-19 migration, already run) being non-null means "done".
--
-- ASCII-only, idempotent. Run in Supabase SQL editor. Project = qrnkovokjmimagrwjebs.
-- ============================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS real_name text,
  ADD COLUMN IF NOT EXISTS display_identity text NOT NULL DEFAULT 'nickname',
  ADD COLUMN IF NOT EXISTS display_name_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS display_name_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS display_name_change_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_display_identity_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_display_identity_check
      CHECK (display_identity IN ('nickname', 'real_name'));
  END IF;
END $$;

ALTER TABLE public.render_jobs
  ADD COLUMN IF NOT EXISTS download_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS promo_requested_at timestamptz;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Verification -- expect 7 rows
-- ============================================================================
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'profiles' AND column_name IN (
      'real_name', 'display_identity', 'display_name_locked_at',
      'display_name_changed_at', 'display_name_change_count'
    ))
    OR (table_name = 'render_jobs' AND column_name IN ('download_requested_at', 'promo_requested_at'))
  )
ORDER BY table_name, column_name;
