-- OXXOVO Watch -- content safety: video hide + reports + pre-moderation (2026-06-28)
-- ===========================================================================
-- Run in Supabase SQL Editor (whole file as one block).
--
-- Three layers (TK 2026-06-28, "100% complete before launch"):
--   A. watch_video_reports -- audience reports a video; admin triage queue.
--   B. genesis_applications.watch_hidden -- admin hides a video from Watch
--      WITHOUT touching competition status (status drives scoring/awards; this
--      only affects public visibility).
--   C. moderation_status -- AI pre-moderation gate (Patent 3). A video is
--      PUBLIC only when moderation_status='approved'. New submissions start
--      'pending' (set in app code) -> scanned -> 'approved'/'flagged'. Existing
--      rows default 'approved' so nothing already present disappears.
--
-- Visibility (enforced in lib/watch.ts): show only when
--   moderation_status='approved' AND NOT watch_hidden
--   AND status NOT IN ('flagged','rejected') AND a video URL exists.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.
-- ===========================================================================

BEGIN;

-- ── B. Admin video-only hide (independent of competition status) ──
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS watch_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS watch_hidden_at TIMESTAMPTZ;
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS watch_hidden_reason TEXT;

-- ── C. AI pre-moderation gate (Patent 3) ──
-- Default 'approved' keeps existing rows visible; new submissions are set to
-- 'pending' in code and only flip to 'approved' after the scan passes.
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE public.genesis_applications
  DROP CONSTRAINT IF EXISTS genesis_applications_moderation_status_chk;
ALTER TABLE public.genesis_applications
  ADD CONSTRAINT genesis_applications_moderation_status_chk
    CHECK (moderation_status IN ('pending', 'approved', 'flagged'));
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS moderation_flags JSONB;
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS moderation_checked_at TIMESTAMPTZ;

-- Partial index for the admin moderation queue (flagged needing review).
CREATE INDEX IF NOT EXISTS genesis_applications_moderation_flagged_idx
  ON public.genesis_applications(moderation_status)
  WHERE moderation_status = 'flagged';
CREATE INDEX IF NOT EXISTS genesis_applications_watch_hidden_idx
  ON public.genesis_applications(watch_hidden)
  WHERE watch_hidden = true;

-- ── A. Video reports (audience -> admin queue) ──
-- One report per (application, round, reporter). round mirrors the social unit
-- (application | main). service_role only + RLS (membership_events pattern).
CREATE TABLE IF NOT EXISTS public.watch_video_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   UUID NOT NULL REFERENCES public.genesis_applications(id) ON DELETE CASCADE,
  round            TEXT NOT NULL DEFAULT 'application',
  reporter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT watch_video_reports_round_check CHECK (round IN ('application', 'main'))
);

CREATE UNIQUE INDEX IF NOT EXISTS watch_video_reports_app_round_reporter_uniq
  ON public.watch_video_reports(application_id, round, reporter_user_id);
CREATE INDEX IF NOT EXISTS watch_video_reports_app_round_idx
  ON public.watch_video_reports(application_id, round);

ALTER TABLE public.watch_video_reports        ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_video_reports        FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.watch_video_reports         TO service_role;

COMMIT;

-- ===========================================================================
-- Verification (run separately after COMMIT)
-- ===========================================================================

-- 1) New columns on genesis_applications -- expect 6 rows
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'genesis_applications'
  AND column_name IN ('watch_hidden','watch_hidden_at','watch_hidden_reason',
                      'moderation_status','moderation_flags','moderation_checked_at')
ORDER BY column_name;

-- 2) moderation_status CHECK present
SELECT conname FROM pg_constraint
WHERE conrelid = 'public.genesis_applications'::regclass
  AND conname = 'genesis_applications_moderation_status_chk';

-- 3) watch_video_reports table + RLS + grants (service_role only)
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname='public' AND tablename='watch_video_reports';
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND table_name='watch_video_reports'
ORDER BY grantee, privilege_type;
