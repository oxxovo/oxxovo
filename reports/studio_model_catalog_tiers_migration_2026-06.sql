-- =========================================================================
-- model_catalog 6-model refresh (720p+, 5 popular families) -- 2026-06-13
-- =========================================================================
-- Compose makes single-model length limits moot (any model -> 30s by assembly),
-- so 6 models span 3 tiers by cost/quality. All 720p+ (rule boundary R1).
-- Specs measured from fal.ai official model + /api pages (no guessing):
--   budget   ltx2-fast    fal-ai/ltx-2/text-to-video/fast        $0.04/s 1080p 6-20s
--   budget   veo31-lite   fal-ai/veo3.1/lite                     $0.05/s 720p  4,6,8s (audio default true)
--   standard sora2-std    fal-ai/sora-2/text-to-video            $0.10/s 720p  4-20s
--   standard kling-v3-pro fal-ai/kling-video/v3/pro/text-to-video $0.168/s 1080p 3-15s
--   premium  seedance2    bytedance/seedance-2.0/text-to-video   $0.3034/s 720p 4-15s
--   premium  veo3.1       fal-ai/veo3.1                          $0.40/s 1080p 4-8s
-- Runway is NOT hosted on fal -> cannot be added via the fal-only integration.
-- All 6 carry native audio (metadata.has_audio=true) -> audio plan C compatible.
-- metadata.input_params = exact fal param names the worker forwards (B-wired).
-- metadata.duration_format = how the worker renders `duration` (PROBED DIRECTLY
--   against fal 2026-06-13 -- the type is MIXED across models, do not assume):
--     'int'      ltx2-fast (6/8/../20), sora2-std (4/8/12/16/20)  -> bare number
--     'string'   kling-v3-pro ('3'..'15'), seedance2 ('auto'/'4'..'15')
--     'string_s' veo3.1, veo3.1 lite ('4s'/'6s'/'8s')
--   The wrong format 422s every generation for that model.
-- metadata.durations = UI selector enum AND the worker's allowed-length snap set.
-- (LTX-2 fps is ALSO a numeric enum -> input_params.fps = 25, not "25".)
-- Margin 40% applied at charge time.
-- Old ltx-v1 / veo3.1-fast rows are deactivated (FK from generation_jobs -> never
-- delete); veo3.1 row is REUSED (same fal model) and refreshed. Idempotent UPSERT.
-- See studio_model_catalog_tiers_2026-06.md + studio_model_catalog_expansion_2026-06.md.
-- =========================================================================

UPDATE public.model_catalog
SET active = false, updated_at = now()
WHERE id IN ('ltx-video', 'veo3.1-fast');

INSERT INTO public.model_catalog
  (id, tier, provider, fal_model_id, display_name, cost_per_second_usd,
   min_duration_seconds, max_duration_seconds, active, sort_order, metadata)
VALUES
  ('ltx2-fast', 'budget', 'fal', 'fal-ai/ltx-2/text-to-video/fast', 'LTX-2 Fast',
   0.04, 6, 20, true, 1,
   '{"input_params":{"resolution":"1080p","fps":25,"generate_audio":true},"duration_format":"int","durations":[6,8,10,12,14,16,18,20],"resolution_label":"1080p","has_audio":true}'::jsonb),
  ('veo31-lite', 'budget', 'fal', 'fal-ai/veo3.1/lite', 'Veo 3.1 Lite',
   0.05, 4, 8, true, 2,
   '{"input_params":{"resolution":"720p","generate_audio":true},"duration_format":"string_s","durations":[4,6,8],"resolution_label":"720p","has_audio":true}'::jsonb),
  ('sora2-std', 'standard', 'fal', 'fal-ai/sora-2/text-to-video', 'Sora 2',
   0.10, 4, 20, true, 3,
   '{"input_params":{"resolution":"720p","aspect_ratio":"16:9"},"duration_format":"int","durations":[4,8,12,16,20],"resolution_label":"720p","has_audio":true}'::jsonb),
  ('kling-v3-pro', 'standard', 'fal', 'fal-ai/kling-video/v3/pro/text-to-video', 'Kling V3 Pro',
   0.168, 3, 15, true, 4,
   '{"input_params":{"aspect_ratio":"16:9","generate_audio":true},"duration_format":"string","durations":[3,4,5,6,7,8,9,10,11,12,13,14,15],"resolution_label":"1080p","has_audio":true}'::jsonb),
  ('seedance2', 'premium', 'fal', 'bytedance/seedance-2.0/text-to-video', 'Seedance 2.0',
   0.3034, 4, 15, true, 5,
   '{"input_params":{"resolution":"720p","generate_audio":true},"duration_format":"string","durations":[4,5,6,7,8,9,10,11,12,13,14,15],"resolution_label":"720p","has_audio":true}'::jsonb),
  ('veo3.1', 'premium', 'fal', 'fal-ai/veo3.1', 'Veo 3.1',
   0.40, 4, 8, true, 6,
   '{"input_params":{"resolution":"1080p","generate_audio":true},"duration_format":"string_s","durations":[4,6,8],"resolution_label":"1080p","has_audio":true}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  tier = EXCLUDED.tier,
  provider = EXCLUDED.provider,
  fal_model_id = EXCLUDED.fal_model_id,
  display_name = EXCLUDED.display_name,
  cost_per_second_usd = EXCLUDED.cost_per_second_usd,
  min_duration_seconds = EXCLUDED.min_duration_seconds,
  max_duration_seconds = EXCLUDED.max_duration_seconds,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- Verification
SELECT id, tier, fal_model_id, cost_per_second_usd,
       min_duration_seconds, max_duration_seconds, active, sort_order, metadata
FROM public.model_catalog
ORDER BY active DESC, sort_order;
