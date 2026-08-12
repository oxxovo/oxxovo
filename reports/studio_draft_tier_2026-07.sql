-- ============================================================================
-- Studio Draft tier (Sandbox) -- 2026-07-16
-- Project: qrnkovokjmimagrwjebs
-- ============================================================================
-- 1. tier CHECKs on model_catalog + generation_jobs gain 'draft'
-- 2. Four draft models (all inputs MEASURED 2026-07-16, _draft_probe.mjs +
--    _turbo_probe2.mjs + fal OpenAPI schemas + pricing pages):
--      kling-v3-turbo   $0.112/s 720p audio  -> promotes to kling-v3-pro
--      veo31-lite-draft $0.03/s  720p SILENT -> promotes to veo31-lite
--      seedance2-mini   $0.0721/s 480p audio -> promotes to seedance2
--      hailuo-02-std    $0.045/s 768p SILENT -> promotes to hailuo-02-pro
--    NOTE hailuo STANDARD takes duration ("6"/"10"), unlike pro (none).
--    NOTE turbo has NO negative_prompt/cfg_scale -> no param_whitelist.
-- 3. seasons.studio_max_draft_generations_per_round (default 30) -- the draft
--    cap, separate from studio_max_generations_per_round (competition 30)
-- Idempotent. All lines short on purpose (chat-paste CRLF incident 2026-07-16).
-- ============================================================================

BEGIN;

ALTER TABLE public.model_catalog
  DROP CONSTRAINT IF EXISTS model_catalog_tier_check;
ALTER TABLE public.model_catalog
  ADD CONSTRAINT model_catalog_tier_check
  CHECK (tier IN ('draft', 'budget', 'standard', 'premium'));

ALTER TABLE public.generation_jobs
  DROP CONSTRAINT IF EXISTS generation_jobs_tier_check;
ALTER TABLE public.generation_jobs
  ADD CONSTRAINT generation_jobs_tier_check
  CHECK (tier IN ('draft', 'budget', 'standard', 'premium'));

INSERT INTO public.model_catalog
  (id, tier, provider, fal_model_id, display_name, cost_per_second_usd,
   min_duration_seconds, max_duration_seconds, active, sort_order, metadata)
VALUES
  ('kling-v3-turbo', 'draft', 'fal',
   'fal-ai/kling-video/v3/turbo/standard/text-to-video',
   'Kling V3 Turbo (Draft)', 0.112, 3, 15, true, 101,
   '{"durations":[3,4,5,6,7,8,9,10,11,12,13,14,15],
     "duration_format":"string","has_audio":true,
     "resolution_label":"720p","prompt_max":2500,
     "input_params":{"aspect_ratio":"16:9"},
     "promotes_to":"kling-v3-pro"}'::jsonb),
  ('veo31-lite-draft', 'draft', 'fal',
   'fal-ai/veo3.1/lite',
   'Veo 3.1 Lite (Draft)', 0.03, 4, 8, true, 102,
   '{"durations":[4,6,8],
     "duration_format":"string_s","has_audio":false,
     "resolution_label":"720p","prompt_max":20000,
     "input_params":{"resolution":"720p","generate_audio":false},
     "promotes_to":"veo31-lite"}'::jsonb),
  ('seedance2-mini', 'draft', 'fal',
   'bytedance/seedance-2.0/mini/text-to-video',
   'Seedance 2.0 Mini (Draft)', 0.0721, 4, 15, true, 103,
   '{"durations":[4,5,6,7,8,9,10,11,12,13,14,15],
     "duration_format":"string","has_audio":true,
     "resolution_label":"480p",
     "input_params":{"resolution":"480p","generate_audio":true},
     "promotes_to":"seedance2"}'::jsonb),
  ('hailuo-02-std', 'draft', 'fal',
   'fal-ai/minimax/hailuo-02/standard/text-to-video',
   'Hailuo 02 Standard (Draft)', 0.045, 6, 10, true, 104,
   '{"durations":[6,10],
     "duration_format":"string","has_audio":false,
     "resolution_label":"768p","prompt_max":2000,
     "input_params":{"prompt_optimizer":true},
     "promotes_to":"hailuo-02-pro"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  tier = EXCLUDED.tier, provider = EXCLUDED.provider,
  fal_model_id = EXCLUDED.fal_model_id,
  display_name = EXCLUDED.display_name,
  cost_per_second_usd = EXCLUDED.cost_per_second_usd,
  min_duration_seconds = EXCLUDED.min_duration_seconds,
  max_duration_seconds = EXCLUDED.max_duration_seconds,
  active = EXCLUDED.active, sort_order = EXCLUDED.sort_order,
  metadata = EXCLUDED.metadata, updated_at = now();

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_max_draft_generations_per_round int
  NOT NULL DEFAULT 30;

COMMIT;

-- ============================================================================
-- Verification (run all 4; expected results in comments)
-- ============================================================================

SELECT id, tier, cost_per_second_usd, active,
       metadata->>'resolution_label' AS res,
       metadata->>'duration_format' AS fmt,
       metadata->>'has_audio' AS audio,
       metadata->>'promotes_to' AS promotes_to
FROM public.model_catalog WHERE tier = 'draft' ORDER BY sort_order;
-- expect 4 rows: kling-v3-turbo / veo31-lite-draft / seedance2-mini /
--   hailuo-02-std, each with promotes_to filled

SELECT id FROM public.model_catalog
WHERE fal_model_id ~ '\s' OR id ~ '\s' OR display_name ~ E'[\\r\\n]';
-- expect 0 rows (paste-corruption guard)

SELECT count(*) AS seasons_with_draft_cap
FROM public.seasons WHERE studio_max_draft_generations_per_round = 30;
-- expect: every season (currently 14)

SELECT count(*) AS non_draft_models_untouched
FROM public.model_catalog
WHERE tier IN ('budget','standard','premium') AND active = true;
-- expect 7 (existing competition models unchanged)
