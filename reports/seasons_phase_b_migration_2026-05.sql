-- ─────────────────────────────────────────────────────────────────────────
-- OXXOVO seasons schema — Phase 5b (Phase B follow-up)
-- Run in Supabase SQL Editor (full file as one block).
--
-- Adds three columns surfaced by email-template work:
--   1. display_name             — human-facing season label (codename in `name`)
--   2. main_round_video_min/max — replaces single main_round_video_seconds
--   3. deadline_reminder_hours  — JSONB array, e.g. [24, 6] — cron fires each
--
-- Notes:
--   * Keeps `name` as the codename ("GENESIS"). Code that previously read
--     season.name for user-facing display switches to season.display_name.
--   * main_round_video_seconds remains for backwards compatibility but
--     application code stops referencing it. Dropping it is a follow-up.
--   * deadline_reminder_hours defaults to [24, 6] — 24h heads-up + 6h final
--     warning. Per-season override is allowed.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. display_name (human-facing label)
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS display_name TEXT;

UPDATE public.seasons
SET display_name = 'OXXOVO Genesis Season 0'
WHERE id = 'season_0' AND display_name IS NULL;

ALTER TABLE public.seasons
  ALTER COLUMN display_name SET NOT NULL;

-- 2. Main-round video duration range
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS main_round_video_min_seconds INTEGER;

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS main_round_video_max_seconds INTEGER;

-- Backfill from the existing single column for any row that has it.
UPDATE public.seasons
SET main_round_video_min_seconds = COALESCE(main_round_video_min_seconds, 15),
    main_round_video_max_seconds = COALESCE(main_round_video_max_seconds, 30)
WHERE main_round_video_min_seconds IS NULL
   OR main_round_video_max_seconds IS NULL;

ALTER TABLE public.seasons
  ALTER COLUMN main_round_video_min_seconds SET NOT NULL,
  ALTER COLUMN main_round_video_max_seconds SET NOT NULL;

ALTER TABLE public.seasons
  ADD CONSTRAINT main_round_video_seconds_range_chk
    CHECK (main_round_video_min_seconds > 0
       AND main_round_video_max_seconds >= main_round_video_min_seconds);

-- 3. deadline_reminder_hours — JSONB array of positive integers, descending
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS deadline_reminder_hours JSONB
    NOT NULL DEFAULT '[24, 6]'::jsonb;

ALTER TABLE public.seasons
  ADD CONSTRAINT deadline_reminder_hours_shape_chk
    CHECK (
      jsonb_typeof(deadline_reminder_hours) = 'array'
      AND jsonb_array_length(deadline_reminder_hours) >= 1
    );

-- Explicit set on season_0 for documentation, even though it matches the default.
UPDATE public.seasons
SET deadline_reminder_hours = '[24, 6]'::jsonb
WHERE id = 'season_0';

COMMIT;

-- ─── verification (run separately after COMMIT) ─────────────────────────
-- SELECT id, name, display_name,
--        main_round_video_min_seconds, main_round_video_max_seconds,
--        deadline_reminder_hours
-- FROM public.seasons
-- WHERE id = 'season_0';
