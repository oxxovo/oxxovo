-- =========================================================================
-- model_catalog 3-tier refresh (720p+) -- 2026-06-13
-- =========================================================================
-- Compose makes single-model length limits moot (any model -> 30s by assembly),
-- so models are chosen by quality/tier. All three are 720p+ (rule boundary R1).
-- Specs measured from fal.ai official model + /api schema pages (no guessing):
--   budget   LTX-2 Fast    fal-ai/ltx-2/text-to-video/fast   $0.04/s 1080p 6-20s
--   standard Sora 2        fal-ai/sora-2/text-to-video       $0.10/s 720p  4-20s
--   premium  Kling V3 Pro  fal-ai/kling-video/v3/pro/text-to-video $0.168/s(audio) 1080p 3-15s
-- metadata.input_params = exact fal param names the worker forwards (resolution/
-- fps/aspect_ratio/generate_audio). metadata.durations = UI selector enum.
-- Old veo/ltx-v1 rows are deactivated (FK from generation_jobs -> never delete).
-- Margin 40% (platform_config) is applied at charge time, not here.
-- Idempotent: re-runnable (UPSERT). See studio_model_catalog_tiers_2026-06.md.
-- =========================================================================

UPDATE public.model_catalog
SET active = false, updated_at = now()
WHERE id IN ('ltx-video', 'veo3.1-fast', 'veo3.1');

INSERT INTO public.model_catalog
  (id, tier, provider, fal_model_id, display_name, cost_per_second_usd,
   min_duration_seconds, max_duration_seconds, active, sort_order, metadata)
VALUES
  ('ltx2-fast', 'budget', 'fal', 'fal-ai/ltx-2/text-to-video/fast', 'LTX-2 Fast',
   0.04, 6, 20, true, 1,
   '{"input_params":{"resolution":"1080p","fps":25,"generate_audio":true},"durations":[6,8,10,12,14,16,18,20],"resolution_label":"1080p"}'::jsonb),
  ('sora2-std', 'standard', 'fal', 'fal-ai/sora-2/text-to-video', 'Sora 2',
   0.10, 4, 20, true, 2,
   '{"input_params":{"resolution":"720p","aspect_ratio":"16:9"},"durations":[4,8,12,16,20],"resolution_label":"720p"}'::jsonb),
  ('kling-v3-pro', 'premium', 'fal', 'fal-ai/kling-video/v3/pro/text-to-video', 'Kling V3 Pro',
   0.168, 3, 15, true, 3,
   '{"input_params":{"aspect_ratio":"16:9","generate_audio":true},"durations":[3,4,5,6,7,8,9,10,11,12,13,14,15],"resolution_label":"1080p"}'::jsonb)
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
