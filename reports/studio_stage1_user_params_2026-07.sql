-- ============================================================================
-- Stage 1 CameraDirector foundation (2026-07-16)
-- Project: qrnkovokjmimagrwjebs
-- ============================================================================
-- 1. studio_presets       -- the 8 TK-approved camera/motion presets (data,
--                            not code, so they can be tuned mid-season)
-- 2. generation_jobs      -- + user_params jsonb (what the participant picked:
--                            preset id + advanced params; NULL = none, legacy)
-- 3. model_catalog        -- metadata additions (pure data, no DDL):
--      prompt_style 'bracket' -> hailuo-02-pro, video-01-director only
--        (measured 2026-07-10/12: bracket [camera] tags work on these two)
--      param_whitelist        -> kling-v3-pro: negative_prompt + cfg_scale
--        (measured 2026-07-16 via _param_probe.mjs: both accepted, no 422)
-- CryptoBind is NOT touched (signature never covered prompt/params).
-- Idempotent. Run in Supabase SQL editor.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.studio_presets (
  id           text PRIMARY KEY,
  group_id     text NOT NULL,
  label_en     text NOT NULL,
  bracket_tags text NOT NULL,
  desc_text    text NOT NULL,
  preview_url  text,
  sort_order   int NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT studio_presets_group_check
    CHECK (group_id IN ('action', 'drama', 'beauty'))
);

ALTER TABLE public.studio_presets ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.studio_presets FROM anon;
REVOKE ALL PRIVILEGES ON public.studio_presets FROM authenticated;
GRANT ALL PRIVILEGES ON public.studio_presets TO service_role;

-- Seed: the 8 approved presets, verbatim from the validated stage1 matrix.
-- ON CONFLICT DO NOTHING so a re-run never overwrites later Dashboard tuning.
INSERT INTO public.studio_presets
  (id, group_id, label_en, bracket_tags, desc_text, preview_url, sort_order)
VALUES
  ('A1', 'action', 'FPV Chase', '[Tracking shot] [Whip pan]',
   'FPV chase, the camera whips and banks close behind, foreground debris streaks violently past the lens in heavy motion blur, intense sense of velocity, speed lines',
   'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/stage1-backup/A1_match_sf_director.mp4', 1),
  ('A2', 'action', 'Whip-Pan Reveal', '[Whip pan] [Static]',
   'a fast whip-pan reveal, motion blur across the pan then a snap to sharp focus',
   'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/stage1-backup/A2_match_sf_kling.mp4', 2),
  ('A3', 'action', 'Arc Orbit', '[Truck left] [Pan right]',
   'the camera arcs around the subject at speed, the background streaking with parallax',
   'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/stage1-backup/A3_match_sf_director.mp4', 3),
  ('D1', 'drama', 'Slow Push-In', '[Push in]',
   'a slow deliberate push-in, shallow depth of field, quiet tension building',
   'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/stage1-backup/D1_match_drama_kling.mp4', 4),
  ('D2', 'drama', 'Handheld Tension', '[Shake]',
   'urgent handheld camera shake, raw energy, unsteady tension',
   'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/stage1-backup/D2_match_drama_director.mp4', 5),
  ('B1', 'beauty', 'Elegant Orbit', '[Truck left] [Pan right]',
   'a slow elegant orbit around the product, soft studio light, glossy highlights gliding across the surface',
   'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/stage1-backup/B1_match_beauty_kling.mp4', 6),
  ('B2', 'beauty', 'Macro Push-In', '[Push in]',
   'a slow macro push-in on the surface texture and glistening droplets, shallow depth of field, luxurious detail',
   'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/stage1-backup/B2_match_beauty_director.mp4', 7),
  ('B3', 'beauty', 'Tilt-Up Reveal', '[Tilt up] [Static]',
   'a graceful tilt-up reveal of the product, refined soft light, minimal and premium',
   'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/stage1-backup/B3_match_beauty_kling.mp4', 8)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS user_params jsonb;

UPDATE public.model_catalog
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"prompt_style":"bracket"}'::jsonb,
    updated_at = now()
WHERE id IN ('hailuo-02-pro', 'video-01-director');

UPDATE public.model_catalog
SET metadata = COALESCE(metadata, '{}'::jsonb) ||
  '{"param_whitelist":{"negative_prompt":{"type":"string","max_len":500},"cfg_scale":{"type":"number","min":0,"max":1}}}'::jsonb,
    updated_at = now()
WHERE id = 'kling-v3-pro';

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
SELECT id, group_id, label_en, sort_order, active FROM public.studio_presets ORDER BY sort_order;
-- expect: 8 rows, A1..B3

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'generation_jobs' AND column_name = 'user_params';
-- expect: 1 row

SELECT id, metadata->>'prompt_style' AS prompt_style,
       (metadata->'param_whitelist') IS NOT NULL AS has_whitelist
FROM public.model_catalog WHERE active = true ORDER BY sort_order;
-- expect: bracket on hailuo-02-pro + video-01-director; has_whitelist=true on kling-v3-pro only
