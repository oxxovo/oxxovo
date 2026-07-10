-- =========================================================================
-- model_catalog: retire Sora 2 (deprecated on fal, EOL 2026-09-24) -- 2026-07-10
-- =========================================================================
-- fal marks BOTH sora-2/text-to-video (std) and the Pro variant as
-- "deprecated / no longer supported" (measured against fal.ai model pages
-- 2026-07-10). HQ confirms full end-of-life 2026-09-24. Leaving sora2-std
-- active means getActiveModels() keeps offering a model whose generations will
-- start 4xx-ing on fal -> silent generation failures + refunds once EOL hits.
--
-- FIX: deactivate, do NOT delete. generation_jobs.model_id FKs into
-- model_catalog(id), so past Sora jobs must keep their row for referential
-- integrity + audit. This mirrors the ltx-video / veo3.1-fast retirement in
-- studio_model_catalog_tiers_migration_2026-06.sql.
--
-- STANDARD-TIER COVER: kling-v3-pro is already active in the standard tier
-- (studio_model_catalog_tiers_migration_2026-06.sql), so deactivating Sora
-- leaves NO tier without a model. getActiveModels() filters .eq('active',true)
-- and no code path hardcodes 'sora2-std' (grep-verified 2026-07-10), so this is
-- a data-only change -- the worker + UI adapt automatically.
--
-- NOT IN SCOPE (separate decision, pending TK's model direction from the MWQ
-- demos): promoting Kling V3 Pro to the premium tier / swapping the standard
-- and premium line-ups / retiring Veo 3.1 (8s cap). This migration ONLY removes
-- the deprecated Sora model so it is not a launch blocker; the tier re-shuffle
-- is a follow-up once the model strategy is fixed.
-- =========================================================================

UPDATE public.model_catalog
SET active = false, updated_at = now()
WHERE id = 'sora2-std';

-- Verification: sora2-std should now be inactive; every remaining tier still has
-- at least one active model (budget: ltx2-fast/veo31-lite, standard: kling-v3-pro,
-- premium: seedance2/veo3.1).
SELECT id, tier, fal_model_id, active, sort_order
FROM public.model_catalog
ORDER BY active DESC, sort_order;

-- Sanity: count of active models per tier (each row must be >= 1).
SELECT tier, count(*) AS active_models
FROM public.model_catalog
WHERE active = true
GROUP BY tier
ORDER BY tier;
