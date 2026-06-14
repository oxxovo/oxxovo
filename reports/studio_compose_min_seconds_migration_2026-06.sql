-- =========================================================================
-- OXXOVO Studio -- Compose FINAL minimum length (15s) -- 2026-06-13
-- =========================================================================
-- Run in Supabase SQL Editor (whole file as one block). Idempotent. ASCII-only.
--
-- Decision (2026-06-13, TK): composed final = MIN 15s, MAX 30s (was max-only).
-- Adds studio_compose_min_seconds (default 15) as the SINGLE SOURCE the compose
-- engine reads for the floor, mirroring the existing studio_compose_max_seconds
-- ceiling. createRender / submitRender reject a composition shorter than this.
--
-- *** Single source of truth (do not confuse the two layers) ***
--   FINAL composed video : studio_compose_min_seconds / studio_compose_max_seconds
--                          (the SCORED artifact; this migration). 15 / 30.
--   Per-CLIP generation   : model_catalog.min/max_duration_seconds (model native).
--                          A clip is a building block -- it may be far shorter
--                          than 15s (e.g. an 8s Veo clip), so the per-clip gate
--                          must NOT use the round bounds. lib/studio.ts S-7 now
--                          SKIPS the round-length check when compose is enabled.
--
-- *** SQL consistency with the 3-stage migration (season0_3stage) ***
--   That migration sets application_video_min/max = main_round_video_min/max =
--   15 / 30 (the public "your entry is 15-30s" display + non-studio submit gate).
--   Those now AGREE with studio_compose_min/max = 15 / 30. Because S-7 no longer
--   gates clip generation by application_video_* in compose mode, setting them to
--   15/30 is SAFE (short clips still generate). Any run order is fine.
-- =========================================================================

BEGIN;

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_compose_min_seconds int NOT NULL DEFAULT 15;

-- Floor >= 1 and ceiling >= floor (defense; both columns season-variable).
ALTER TABLE public.seasons DROP CONSTRAINT IF EXISTS seasons_compose_len_chk;
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_compose_len_chk
    CHECK (studio_compose_min_seconds >= 1
       AND studio_compose_max_seconds >= studio_compose_min_seconds);

-- Season 0 = compose final 15..30s.
UPDATE public.seasons
SET studio_compose_min_seconds = 15,
    studio_compose_max_seconds = 30,
    updated_at = now()
WHERE id = 'season_0';

COMMIT;

-- =========================================================================
-- Verification (run AFTER the COMMIT above)
-- =========================================================================
SELECT id, studio_compose_enabled,
       studio_compose_min_seconds, studio_compose_max_seconds, studio_compose_max_clips,
       application_video_min_seconds, application_video_max_seconds,
       main_round_video_min_seconds, main_round_video_max_seconds
FROM public.seasons WHERE id = 'season_0';
