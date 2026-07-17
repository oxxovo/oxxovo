-- ============================================================
-- Stage 3 (AI actor / i2v) -- migration 2.1
-- Project: qrnkovokjmimagrwjebs
-- Character library + image-job media_type + draft image tier
-- ASCII-only. No long URLs. Idempotent. Run STAGE by STAGE.
-- ============================================================


-- ============================================================
-- STAGE 1 -- INSPECT (read-only, run first)
-- ============================================================

-- 1a. current generation_jobs columns (expect: no media_type yet)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'generation_jobs'
  AND column_name IN ('media_type','image_url','parent_image_job_ids','cryptobind_parent_bundle','duration_seconds')
ORDER BY column_name;

-- 1b. any image / i2v catalog rows yet (expect: 0 rows)
SELECT id, tier, active, metadata->>'media_type' AS media_type
FROM model_catalog
WHERE id IN ('ideogram-character','ideogram-character-draft','kling-v3-pro-i2v');

-- 1c. seasons image-cap columns (expect: none yet)
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'seasons'
  AND column_name IN ('studio_max_image_generations_per_round','studio_max_draft_image_generations_per_round');

-- 1d. studio_characters table (expect: 0)
SELECT to_regclass('public.studio_characters') AS studio_characters_exists;


-- ============================================================
-- STAGE 2 -- DDL + SEED (idempotent)
-- ============================================================

-- 2A. generation_jobs: image-job + i2v parent-binding columns
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'video';
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS parent_image_job_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS cryptobind_parent_bundle text;
-- image jobs carry no duration
ALTER TABLE generation_jobs ALTER COLUMN duration_seconds DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'generation_jobs_media_type_chk') THEN
    ALTER TABLE generation_jobs
      ADD CONSTRAINT generation_jobs_media_type_chk CHECK (media_type IN ('video','image'));
  END IF;
END $$;

-- 2B. studio_characters -- the AI-actor library (naming layer over image jobs)
CREATE TABLE IF NOT EXISTS studio_characters (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL,
  season_id                text NOT NULL REFERENCES seasons(id),
  name                     text NOT NULL DEFAULT '',
  status                   text NOT NULL DEFAULT 'draft',
  frontal_image_job_id     uuid REFERENCES generation_jobs(id),
  reference_image_job_ids  uuid[] NOT NULL DEFAULT '{}',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  deleted_at               timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'studio_characters_status_chk') THEN
    ALTER TABLE studio_characters
      ADD CONSTRAINT studio_characters_status_chk CHECK (status IN ('draft','ready'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS studio_characters_user_season_idx
  ON studio_characters (user_id, season_id);

-- RLS: server uses service_role (bypasses RLS); anon/authenticated denied.
ALTER TABLE studio_characters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON studio_characters FROM anon, authenticated;
GRANT ALL ON studio_characters TO service_role;

-- 2C. seasons: per-round image caps (season-varying, no hardcode)
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS studio_max_image_generations_per_round int NOT NULL DEFAULT 20;
ALTER TABLE seasons ADD COLUMN IF NOT EXISTS studio_max_draft_image_generations_per_round int NOT NULL DEFAULT 40;

-- 2D. model_catalog seed (data-only; media_type lives in metadata).
--     active=FALSE on purpose -- flipped ON when the Stage 3 UI (2.5) ships,
--     so these do not appear in the live selector prematurely.
--     cost_per_second_usd for image rows = per-IMAGE usd (duration convention = 1);
--     final cost/credit calc is implemented in phase 2.4.
INSERT INTO model_catalog
  (id, tier, provider, fal_model_id, display_name, cost_per_second_usd,
   min_duration_seconds, max_duration_seconds, active, sort_order, metadata)
VALUES
  ('ideogram-character', 'standard', 'fal', 'fal-ai/ideogram/character', 'Ideogram Character', 0.15,
   1, 1, false, 200,
   '{"media_type":"image","input_params":{"rendering_speed":"QUALITY"},"ref_images":1,"prompt_max":800}'::jsonb),
  ('ideogram-character-draft', 'draft', 'fal', 'fal-ai/ideogram/character', 'Ideogram Character (Sandbox)', 0.08,
   1, 1, false, 201,
   '{"media_type":"image","promotes_to":"ideogram-character","input_params":{"rendering_speed":"TURBO"},"ref_images":1,"prompt_max":800}'::jsonb),
  ('kling-v3-pro-i2v', 'standard', 'fal', 'fal-ai/kling-video/v3/pro/image-to-video', 'Kling V3 Pro (i2v)', 0.168,
   1, 15, false, 210,
   '{"media_type":"video","accepts_start_image":true,"accepts_elements":true,"accepts_multi_prompt":true,"has_audio":true,"duration_format":"string","input_params":{"cfg_scale":0.5},"prompt_max":2500}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  tier = EXCLUDED.tier,
  fal_model_id = EXCLUDED.fal_model_id,
  display_name = EXCLUDED.display_name,
  cost_per_second_usd = EXCLUDED.cost_per_second_usd,
  min_duration_seconds = EXCLUDED.min_duration_seconds,
  max_duration_seconds = EXCLUDED.max_duration_seconds,
  metadata = EXCLUDED.metadata,
  updated_at = now();


-- ============================================================
-- STAGE 3 -- VERIFY (all rows should read as expected; ws flags all false)
-- ============================================================

-- 3.1 generation_jobs new columns present (expect 4 rows)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'generation_jobs'
  AND column_name IN ('media_type','image_url','parent_image_job_ids','cryptobind_parent_bundle')
ORDER BY column_name;

-- 3.2 studio_characters present + RLS enabled (expect exists + rowsecurity = true)
SELECT to_regclass('public.studio_characters') AS tbl,
       relrowsecurity AS rls_enabled
FROM pg_class WHERE relname = 'studio_characters';

-- 3.3 seasons image-cap columns present (expect 2 rows)
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'seasons'
  AND column_name IN ('studio_max_image_generations_per_round','studio_max_draft_image_generations_per_round')
ORDER BY column_name;

-- 3.4 catalog rows present with correct media_type (expect 3 rows)
SELECT id, tier, active, metadata->>'media_type' AS media_type,
       metadata->>'promotes_to' AS promotes_to, cost_per_second_usd
FROM model_catalog
WHERE id IN ('ideogram-character','ideogram-character-draft','kling-v3-pro-i2v')
ORDER BY sort_order;

-- 3.5 WHITESPACE GUARD (CRLF-copy trap) -- every flag MUST be false
SELECT id,
       (id ~ '\s')                    AS id_has_ws,
       (fal_model_id ~ '\s')          AS fal_has_ws,
       (display_name ~ '[\r\n\t]')    AS name_has_crlf,
       (metadata::text ~ '[\r\n]')    AS meta_has_crlf
FROM model_catalog
WHERE id IN ('ideogram-character','ideogram-character-draft','kling-v3-pro-i2v')
ORDER BY id;
