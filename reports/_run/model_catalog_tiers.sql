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

SELECT id, tier, fal_model_id, cost_per_second_usd,
       min_duration_seconds, max_duration_seconds, active, sort_order, metadata
FROM public.model_catalog
ORDER BY active DESC, sort_order;
