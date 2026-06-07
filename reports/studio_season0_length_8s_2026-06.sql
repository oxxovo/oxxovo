-- =========================================================================
-- OXXOVO Studio -- Season 0 video length policy = 8s (Option B)
-- Run in Supabase SQL Editor (full file as one block).
--
-- Decision (2026-06-07): Season 0 uses in-platform studio generation for both
-- rounds, and the Veo 3.1 models cap a single generation at 8 seconds. So
-- Season 0's required video length is set to the studio's single-generation
-- range: 4-8 seconds (min 4 = model floor, max 8 = model cap), for BOTH the
-- application and main rounds. (Option A, an extend-video chain to reach the
-- old 21-30s, is deferred to Season 1+.)
--
-- This is a data update to one season row -- no schema change. Idempotent.
-- ASCII-only.
-- =========================================================================

BEGIN;

UPDATE public.seasons
SET application_video_min_seconds = 4,
    application_video_max_seconds = 8,
    main_round_video_min_seconds  = 4,
    main_round_video_max_seconds  = 8,
    main_round_video_seconds      = 8,   -- legacy single-value column
    updated_at = now()
WHERE id = 'season_0';

COMMIT;

-- =========================================================================
-- Verification (run AFTER the COMMIT above) -- expect all 4/8 (legacy 8).
-- =========================================================================
SELECT id,
       application_video_min_seconds, application_video_max_seconds,
       main_round_video_min_seconds, main_round_video_max_seconds,
       main_round_video_seconds
FROM public.seasons
WHERE id = 'season_0';
