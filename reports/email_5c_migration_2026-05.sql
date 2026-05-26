-- ─────────────────────────────────────────────────────────────────────────
-- OXXOVO email Phase 5c migration
-- Run in Supabase SQL Editor (full file as one block).
--
-- Three changes that unblock the cron + transparency log work:
--
--   1. award_prizes.grand_final_en label — sentence-case fix
--      ("ticket to the Grand Final" → "Ticket to the Grand Final").
--      Surfaces as the leading word of a bullet in the awarded email.
--
--   2. genesis_applications gets two columns the submission_deadline cron
--      needs to identify "selected creators who have NOT submitted yet":
--        - main_round_video_url  TEXT
--        - main_round_submitted_at TIMESTAMPTZ
--      No submission UI in 5c — that lands with the main round in 5d/6.
--      The columns exist now so the cron query is correct from day one.
--
--   3. email_logs dedup index restructure.
--      Old shape blocked submission_deadline 24h + 6h reminders (one 'sent'
--      row per (application_id, template_key) was a hard ceiling). Split
--      into two partial unique indexes: every template except submission
--      deadline keeps the one-per-application rule; submission_deadline
--      adds metadata->>'reminder_hour' to the key.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. award_prizes grand_final_en sentence-case fix
UPDATE public.seasons
SET award_prizes = jsonb_set(
  jsonb_set(
    jsonb_set(award_prizes,
      '{1,grand_final_en}', '"Ticket to the Grand Final"'),
    '{2,grand_final_en}', '"Ticket to the Grand Final"'),
  '{3,grand_final_en}', '"Ticket to the Grand Final"')
WHERE id = 'season_0';

-- 2. genesis_applications — main-round submission tracking
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS main_round_video_url TEXT,
  ADD COLUMN IF NOT EXISTS main_round_submitted_at TIMESTAMPTZ;

-- Constraint: submitted_at requires video_url. The reverse is allowed
-- (an admin-supplied URL with no submission timestamp would be a bug, but
-- enforcing it would block legitimate backfills).
ALTER TABLE public.genesis_applications
  ADD CONSTRAINT main_round_submission_consistency_chk
    CHECK (
      main_round_submitted_at IS NULL
      OR main_round_video_url IS NOT NULL
    );

-- 3. email_logs dedup index restructure
DROP INDEX IF EXISTS public.email_logs_dedup;

-- One 'sent' row per (application, template) for every template EXCEPT
-- submission_deadline (which intentionally fires multiple times).
CREATE UNIQUE INDEX email_logs_dedup
  ON public.email_logs(application_id, template_key)
  WHERE status = 'sent'
    AND template_key <> 'submission_deadline';

-- One 'sent' row per (application, template, reminder_hour) for
-- submission_deadline. metadata->>'reminder_hour' is set by the cron
-- helper when it fires the 24h / 6h reminder.
CREATE UNIQUE INDEX email_logs_dedup_submission_deadline
  ON public.email_logs(application_id, template_key, (metadata->>'reminder_hour'))
  WHERE status = 'sent'
    AND template_key = 'submission_deadline';

-- Index that supports the cron's "failed rows ready for retry" query:
-- ORDER BY sent_at ASC filtered to status='failed'.
CREATE INDEX IF NOT EXISTS email_logs_failed_sent_at
  ON public.email_logs(sent_at)
  WHERE status = 'failed';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verification (run AFTER the COMMIT above)
-- ─────────────────────────────────────────────────────────────────────────

-- 1) award_prizes labels
SELECT id, award_prizes->'1'->>'grand_final_en' AS rank1,
              award_prizes->'2'->>'grand_final_en' AS rank2,
              award_prizes->'3'->>'grand_final_en' AS rank3
FROM public.seasons
WHERE id = 'season_0';

-- 2) main-round columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'genesis_applications'
  AND column_name IN ('main_round_video_url', 'main_round_submitted_at')
ORDER BY column_name;

-- 3) email_logs indexes — expect old 'email_logs_dedup' gone, two new
--    dedup indexes + the failed-retry partial index.
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'email_logs'
ORDER BY indexname;
