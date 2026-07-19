-- ============================================================
-- Stage 3 -- i2v params PERMANENT fix (kling-v3-pro-i2v)
-- Project: qrnkovokjmimagrwjebs
-- Makes the runtime input_params fix permanent. The Kling i2v multi_prompt +
-- elements call returns fal 422 unless shot_type='customize' + aspect_ratio +
-- generate_audio ride alongside cfg_scale (found in the 2.5 actor demo). The
-- worker merges metadata.input_params into the fal call, so this is data-only.
-- ASCII-only. No long URLs. Idempotent (jsonb_set replaces input_params). Run
-- STAGE by STAGE. Prereq for the 2.6 i2v E2E.
--
-- !!CURRENT STATE: the fix was already applied to the LIVE DB at runtime (admin
-- UPDATE during the 2.5 demo). So STAGE 1 INSPECT will ALREADY show the 4 keys,
-- and STAGE 2 is an idempotent no-op that just makes it official/reproducible.
-- The ROLLBACK section below undoes it (back to the 2.1 original) if ever needed.
--
-- RUN ORDER (stage by stage, NOT all at once):
--   1) Run STAGE 1 -> read the current input_params (keep the output).
--   2) Run STAGE 2 -> apply (no-op if STAGE 1 already showed the 4 keys).
--   3) Run STAGE 3 -> confirm 4 keys present + other metadata survived +
--      the whitespace guard flags are ALL false.
-- Keep the ROLLBACK block in hand; do NOT run it unless reverting.
-- ============================================================


-- ============================================================
-- STAGE 1 -- INSPECT (read-only, run first)
-- ============================================================
SELECT id, active, metadata->'input_params' AS input_params
FROM model_catalog
WHERE id = 'kling-v3-pro-i2v';


-- ============================================================
-- STAGE 2 -- UPDATE (idempotent; sets input_params to the full object,
--            preserving every other metadata key: media_type, accepts_*, ...)
-- ============================================================
UPDATE model_catalog
SET metadata = jsonb_set(
      metadata,
      '{input_params}',
      '{"cfg_scale":0.5,"shot_type":"customize","aspect_ratio":"16:9","generate_audio":true}'::jsonb,
      true
    ),
    updated_at = now()
WHERE id = 'kling-v3-pro-i2v';


-- ============================================================
-- STAGE 3 -- VERIFY
-- ============================================================

-- 3.1 all 4 input_params present (expect: 0.5 / customize / 16:9 / true)
SELECT id,
       metadata->'input_params'->>'cfg_scale'      AS cfg_scale,
       metadata->'input_params'->>'shot_type'      AS shot_type,
       metadata->'input_params'->>'aspect_ratio'   AS aspect_ratio,
       metadata->'input_params'->>'generate_audio' AS generate_audio
FROM model_catalog
WHERE id = 'kling-v3-pro-i2v';

-- 3.2 other metadata keys survived (expect media_type=video, accepts flags true)
SELECT id,
       metadata->>'media_type'            AS media_type,
       metadata->>'accepts_start_image'   AS accepts_start_image,
       metadata->>'accepts_multi_prompt'  AS accepts_multi_prompt
FROM model_catalog
WHERE id = 'kling-v3-pro-i2v';

-- 3.3 WHITESPACE GUARD (chat-copy CRLF trap) -- every flag MUST be false
SELECT id,
       (metadata::text ~ '[\r\n]')                          AS meta_has_crlf,
       ((metadata->'input_params'->>'shot_type') ~ '\s')    AS shot_type_ws,
       ((metadata->'input_params'->>'aspect_ratio') ~ '\s') AS aspect_ratio_ws,
       ((metadata->'input_params'->>'cfg_scale') ~ '\s')    AS cfg_scale_ws
FROM model_catalog
WHERE id = 'kling-v3-pro-i2v';


-- ============================================================
-- ROLLBACK -- run ONLY to revert. Restores input_params to what STAGE 1 showed.
-- ============================================================
-- Option A (recommended default): back to the 2.1 original -- cfg_scale only.
--   Use this if STAGE 1 showed {"cfg_scale": 0.5} (pre-fix), or to fully undo
--   the i2v params fix (i2v generation would 422 again until re-applied).
UPDATE model_catalog
SET metadata = jsonb_set(metadata, '{input_params}', '{"cfg_scale":0.5}'::jsonb, true),
    updated_at = now()
WHERE id = 'kling-v3-pro-i2v';

-- Option B (exact restore): if STAGE 1 showed a DIFFERENT input_params object,
-- paste that exact one-line JSON between the single quotes below instead:
-- UPDATE model_catalog
-- SET metadata = jsonb_set(metadata, '{input_params}', '<PASTE STAGE 1 input_params HERE>'::jsonb, true),
--     updated_at = now()
-- WHERE id = 'kling-v3-pro-i2v';

-- rollback verify (expect input_params back to the restored value)
SELECT id, metadata->'input_params' AS input_params FROM model_catalog WHERE id = 'kling-v3-pro-i2v';
