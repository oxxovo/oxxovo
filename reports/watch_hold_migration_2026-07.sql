-- =========================================================================
-- OXXOVO -- Watch prelim HOLD (fairness / anti-copy). Project: qrnkovokjmimagrwjebs.
-- Run in Supabase SQL Editor (whole file).
--
-- Held prelim submissions are NOT public on /watch until an admin (manual) or the
-- schedule (auto, OFF by default) releases the whole cohort at once, so an early
-- submitter's video can never be copied by a later entrant. Orthogonal to
-- watch_hidden (admin bad-content hide) and moderation_status (safety scan):
--   public = status not 'flagged' AND NOT watch_hidden AND moderation='approved'
--            AND NOT watch_hold   <-- new gate.
--
-- Prelim only (main round uses main_round_start_at reveal -- separate).
-- ASCII-only. Idempotent (IF NOT EXISTS). No dollar-quote / long-literal.
-- =========================================================================

BEGIN;

-- 1. Per-entry hold flag + release audit (genesis_applications).
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS watch_hold boolean NOT NULL DEFAULT false;
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS watch_hold_released_at timestamptz;

-- Partial index: the release + the /watch filter both scan "still held in season X".
CREATE INDEX IF NOT EXISTS genesis_applications_watch_hold_idx
  ON public.genesis_applications (season_id)
  WHERE watch_hold;

-- 2. Per-season switches (dynamic -- no hardcode; schedule stays in seasons).
--    studio_prelim_hold_enabled  : submit stamps watch_hold=true for prelim entries.
--    studio_prelim_auto_publish  : the season cron auto-releases at application_close_at.
--    ** auto stays OFF until the schedule is final + the release is verified. **
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_prelim_hold_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_prelim_auto_publish boolean NOT NULL DEFAULT false;

COMMIT;

-- =========================================================================
-- Verification (run AFTER the COMMIT)
-- =========================================================================

-- 1) new columns present on genesis_applications (expect watch_hold=boolean/false).
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'genesis_applications'
  AND column_name IN ('watch_hold', 'watch_hold_released_at')
ORDER BY column_name;

-- 2) new season switches present (expect both boolean, default false).
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons'
  AND column_name IN ('studio_prelim_hold_enabled', 'studio_prelim_auto_publish')
ORDER BY column_name;

-- 3) nothing is held yet (fresh column) -- expect 0.
SELECT count(*) AS held_rows FROM public.genesis_applications WHERE watch_hold;

-- 4) season switches all OFF (expect studio_prelim_hold_enabled/auto = false everywhere).
SELECT id, studio_prelim_hold_enabled, studio_prelim_auto_publish
FROM public.seasons ORDER BY id;
