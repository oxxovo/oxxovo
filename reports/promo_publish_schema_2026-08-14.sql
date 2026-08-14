-- OXXOVO promo auto-publish approval layer -- DRAFT, NOT RUN (2026-08-14)
-- ===========================================================================
-- This is a design draft for TK review. Do NOT run until approved.
-- ADD-only, idempotent (IF NOT EXISTS everywhere). ASCII-only.
--
-- Scope: the approval -> caption/channel persistence -> scheduled publish ->
-- history layer on top of the existing promo_videos table
-- (reports/promo_videos_migration_2026-06.sql). Does not touch the fal
-- generation worker side (promo_jobs, still per
-- reports/promo_full_auto_design_2026-06.md).
-- ===========================================================================

BEGIN;

-- ── promo_videos: approval + persisted caption/channels ─────────────────────
-- approved defaults to false -- the opposite of the 2026-06 draft's
-- "ready = auto-approved". Nothing publishes without an explicit admin action
-- that flips this to true.
ALTER TABLE public.promo_videos ADD COLUMN IF NOT EXISTS approved     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.promo_videos ADD COLUMN IF NOT EXISTS approved_by  UUID REFERENCES public.profiles(id);
ALTER TABLE public.promo_videos ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMPTZ;
ALTER TABLE public.promo_videos ADD COLUMN IF NOT EXISTS caption      TEXT;
ALTER TABLE public.promo_videos ADD COLUMN IF NOT EXISTS channels     TEXT[];

-- ── promo_publish_log: append-only publish history ──────────────────────────
-- Every attempt (cron or manual, success or failure) gets its own row.
-- promo_videos.posted_at/postiz_post_id/posted_channels stay as the
-- "current state" snapshot; this table is the full history.
CREATE TABLE IF NOT EXISTS public.promo_publish_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_video_id   UUID NOT NULL REFERENCES public.promo_videos(id),
  attempted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by     TEXT NOT NULL CHECK (triggered_by IN ('cron', 'manual')),
  channels         TEXT[],
  caption          TEXT,
  status           TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  postiz_post_id   TEXT,
  error_message    TEXT
);

CREATE INDEX IF NOT EXISTS promo_publish_log_video_idx
  ON public.promo_publish_log (promo_video_id, attempted_at DESC);

ALTER TABLE public.promo_publish_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.promo_publish_log TO authenticated;
GRANT ALL    ON public.promo_publish_log TO service_role;

DROP POLICY IF EXISTS promo_publish_log_admin_read ON public.promo_publish_log;
CREATE POLICY promo_publish_log_admin_read ON public.promo_publish_log
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- ── platform_config: cadence, no separate on/off switch ──────────────────────
-- promo_publish_weekdays = '' (empty string) IS the off switch -- 0 days means
-- 0 publishes. No promo_auto_publish_enabled bool (superseded, see
-- reports/promo_auto_publish_design_2026-08-14.md SS0).
INSERT INTO public.platform_config (key, value, value_type, description) VALUES
  ('promo_publish_weekdays', '', 'text', 'CSV weekday abbrevs, e.g. mon,wed,fri. Empty = publishing paused (this IS the off switch, no separate bool).'),
  ('promo_publish_time',     '', 'text', 'HH:MM 24h, the local time (in promo_publish_timezone) the weekly slot fires.'),
  ('promo_publish_timezone', '', 'text', 'IANA timezone name, e.g. Asia/Seoul. Required explicitly -- no implicit server TZ.')
ON CONFLICT (key) DO NOTHING;

COMMIT;

-- ===========================================================================
-- Verification (run after COMMIT, separately)
-- ===========================================================================
-- 1) promo_videos new columns
SELECT column_name, data_type, column_default FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'promo_videos'
  AND column_name IN ('approved', 'approved_by', 'approved_at', 'caption', 'channels')
ORDER BY column_name;
-- 2) promo_publish_log table + RLS
SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'promo_publish_log';
-- 3) platform_config keys
SELECT key, value, value_type FROM public.platform_config
WHERE key LIKE 'promo_publish_%' ORDER BY key;
