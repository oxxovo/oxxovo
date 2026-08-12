-- ============================================================
-- Stage 3 -- t2i AI-actor model registration
-- Project: qrnkovokjmimagrwjebs
-- Registers the 2 probe-confirmed generators (2026-07-18, jisu2):
--   Nano Banana Pro (premium, $0.15) + FLUX.2 [pro] (value, $0.045)
-- Path B (TK, 2026-07-18): reference /edit endpoints (the ones actually
--   probed) exposed via metadata.edit_model_id; fal_model_id = base t2i for
--   the seed (first) face. The 2.5 worker picks edit_model_id when a job
--   carries reference images, else the base.
-- ASCII-only. Short ids only (no long URLs). Idempotent. active=FALSE until
-- the 2.5 UI ships + real-browser check. Run STAGE by STAGE.
-- ============================================================


-- ============================================================
-- STAGE 1 -- INSPECT (read-only, run first)
-- ============================================================

-- 1a. rows should not exist yet (expect 0 rows)
SELECT id, tier, active, metadata->>'media_type' AS media_type
FROM model_catalog
WHERE id IN ('nano-banana-pro','flux2-pro-image');

-- 1b. sort_order slots free (expect no rows already using 202/203)
SELECT id, sort_order FROM model_catalog
WHERE sort_order IN (202,203) ORDER BY sort_order;

-- 1c. image picker must currently be EMPTY (all image models active=false)
SELECT id, active FROM model_catalog
WHERE metadata->>'media_type' = 'image' ORDER BY sort_order;


-- ============================================================
-- STAGE 2 -- SEED (idempotent). active=FALSE on purpose.
--   cost_per_second_usd on image rows = per-IMAGE usd (duration convention 1).
--   FLUX.2 pro fixed at 1216x1600 png -> ~1.95 MP -> ~$0.044 (matches 0.045).
--   input_params ride along on every fal image call (worker merges them).
--   edit_model_id / tier_label are forward metadata read by the 2.5 wiring;
--   mapModelRow ignores unknown keys, so seeding them now is inert + safe.
-- ============================================================
INSERT INTO model_catalog
  (id, tier, provider, fal_model_id, display_name, cost_per_second_usd,
   min_duration_seconds, max_duration_seconds, active, sort_order, metadata)
VALUES
  ('nano-banana-pro', 'standard', 'fal', 'fal-ai/nano-banana-pro', 'Nano Banana Pro', 0.15,
   1, 1, false, 202,
   '{"media_type":"image","edit_model_id":"fal-ai/nano-banana-pro/edit","input_params":{"resolution":"2K","aspect_ratio":"3:4"},"ref_images":14,"tier_label":"premium","prompt_max":2000}'::jsonb),
  ('flux2-pro-image', 'standard', 'fal', 'fal-ai/flux-2-pro', 'FLUX.2 [pro]', 0.045,
   1, 1, false, 203,
   '{"media_type":"image","edit_model_id":"fal-ai/flux-2-pro/edit","input_params":{"image_size":{"width":1216,"height":1600},"output_format":"png"},"ref_images":9,"tier_label":"value","prompt_max":2000}'::jsonb)
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


-- ============================================================
-- STAGE 3 -- VERIFY (all rows as expected; ws flags all false)
-- ============================================================

-- 3.1 both rows present, media_type=image, active=false (expect 2 rows)
SELECT id, tier, active, cost_per_second_usd AS usd_per_image,
       fal_model_id AS base_endpoint,
       metadata->>'edit_model_id' AS edit_endpoint,
       metadata->>'tier_label'    AS tier_label,
       metadata->>'ref_images'    AS ref_images
FROM model_catalog
WHERE id IN ('nano-banana-pro','flux2-pro-image')
ORDER BY sort_order;

-- 3.2 WHITESPACE GUARD (chat-copy CRLF trap) -- every flag MUST be false
SELECT id,
       (id ~ '\s')                          AS id_has_ws,
       (fal_model_id ~ '\s')                AS base_has_ws,
       (coalesce(metadata->>'edit_model_id','') ~ '\s') AS edit_has_ws,
       (display_name ~ '[\r\n\t]')          AS name_has_crlf,
       (metadata::text ~ '[\r\n]')          AS meta_has_crlf
FROM model_catalog
WHERE id IN ('nano-banana-pro','flux2-pro-image')
ORDER BY id;

-- 3.3 image picker STILL empty (active image models expect 0 -- nothing live yet)
SELECT count(*) AS active_image_models
FROM model_catalog
WHERE active = true AND metadata->>'media_type' = 'image';
