-- ============================================================================
-- model_catalog: + Hailuo 02 Pro, + Video-01 Director, - Sora 2  (2026-07)
-- ============================================================================
-- DATA-ONLY (TK 2026-07-12). Broadens the models participants can pick:
--   + Hailuo 02 Pro   -- cleanest SF-action motion; camera control via [brackets]
--   + Video-01 Director -- camera control ([Tracking shot], [Push in] ...)
--   - Sora 2          -- fal deprecates 2026-09-24; deactivate (do NOT delete, so
--                        historical generation_jobs that reference it still resolve)
--
-- MEASURED from TK's SF-action test (oxxovo-studio/_sf_action_test.mjs +
-- ffprobe of the outputs, 2026-07-10/12) -- the PROVEN working inputs, not docs:
--   hailuo-02/pro/text-to-video : input {prompt, prompt_optimizer:true} ONLY.
--                                 output ~6s, 1920x1080, 24fps, NO audio. $0.08/s.
--   video-01-director           : input {prompt, prompt_optimizer:true} ONLY.
--                                 output ~6s, 1280x720, 25fps, NO audio. $0.5/video.
--   -> NEITHER takes a duration or resolution param (fixed ~6s). [camera] x3 works.
--
-- *** WORKER CHANGE REQUIRED (NOT pure data-only) ***
--   generateVideo() in oxxovo-studio/src/fal.ts ALWAYS appends a `duration` field.
--   These two endpoints were proven to work WITHOUT it, so an extra `duration`
--   risks a fal 422 = every generation fails. duration_format:'none' below tells
--   the worker to OMIT the duration field -- fal.ts must learn to handle 'none'
--   (skip the [durationKey]). ~5 lines. RUN THIS SQL ONLY AFTER that worker deploy.
--
--   Audio: both are SILENT. Studio Compose (render.ts, Plan C) auto-fills a
--   silence track for any clip ffprobe finds no audio in, so a silent clip never
--   breaks the render -- it just plays silent for its span. Safe.
--
-- Idempotent (ON CONFLICT upsert). Run in Supabase SQL editor (qrnkovokjmimagrwjebs).
-- ============================================================================

BEGIN;

INSERT INTO public.model_catalog
  (id, tier, provider, fal_model_id, display_name, cost_per_second_usd,
   min_duration_seconds, max_duration_seconds, active, sort_order, metadata)
VALUES
  ('hailuo-02-pro', 'standard', 'fal', 'fal-ai/minimax/hailuo-02/pro/text-to-video',
   'Hailuo 02 Pro', 0.08, 6, 6, true, 7,
   '{"durations":[6],"has_audio":false,"camera_control":true,
     "input_params":{"prompt_optimizer":true},
     "duration_format":"none","resolution_label":"1080p"}'::jsonb),
  ('video-01-director', 'standard', 'fal', 'fal-ai/minimax/video-01-director',
   'Video-01 Director', 0.0833, 6, 6, true, 8,
   '{"durations":[6],"has_audio":false,"camera_control":true,
     "input_params":{"prompt_optimizer":true},
     "duration_format":"none","resolution_label":"720p"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  tier = EXCLUDED.tier, provider = EXCLUDED.provider, fal_model_id = EXCLUDED.fal_model_id,
  display_name = EXCLUDED.display_name, cost_per_second_usd = EXCLUDED.cost_per_second_usd,
  min_duration_seconds = EXCLUDED.min_duration_seconds, max_duration_seconds = EXCLUDED.max_duration_seconds,
  active = EXCLUDED.active, sort_order = EXCLUDED.sort_order, metadata = EXCLUDED.metadata,
  updated_at = now();

-- Sora 2 out (deactivate, keep row for historical refs).
UPDATE public.model_catalog SET active = false, updated_at = now() WHERE id = 'sora2-std';

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
SELECT id, tier, fal_model_id, cost_per_second_usd,
       min_duration_seconds, max_duration_seconds, active, sort_order
FROM public.model_catalog
ORDER BY active DESC, cost_per_second_usd;
-- expect: sora2-std active=false; hailuo-02-pro + video-01-director active=true.
