-- =========================================================================
-- OXXOVO Studio (Session 6) -- Phase 4 schema
-- Run in Supabase SQL Editor (full file as one block).
--
-- 1. genesis_applications.free_entry_url -> NULLABLE.
--    For studio seasons the external-URL entry is retired; a studio application
--    row is created at submission time (no external URL up front). Dropping the
--    NOT NULL lets the application row exist with the studio video filled in by
--    submitGeneration (which writes free_entry_url = the R2 URL).
--
-- 2. model_catalog -- activate the 3 tiers (budget already seeded as ltx-video).
--    standard = Veo 3.1 Fast, premium = Veo 3.1.
--
--    fal-verified 2026-06-07 (audio ON -- tournament videos default to audio):
--      veo3.1-fast : fal-ai/veo3.1/fast  $0.15/s (audio off $0.10)  max 8s
--      veo3.1      : fal-ai/veo3.1       $0.40/s (audio off $0.20)  max 8s
--    Single-generation cap is 8s for both. NOTE: main-round videos require
--    21-30s -- exceeds 8s; resolved separately (extend-chain or per-round length
--    policy -- see studio session-6 memory). The dev cost guard
--    (STUDIO_DEV_MODE=true) forces the cheapest model regardless.
--
-- ASCII-only. Idempotent.
-- =========================================================================

BEGIN;

-- 1. free_entry_url nullable (idempotent: DROP NOT NULL is a no-op if already).
ALTER TABLE public.genesis_applications
  ALTER COLUMN free_entry_url DROP NOT NULL;

-- 2. Tier models. ON CONFLICT DO NOTHING so re-running never clobbers prices
--    TK has since tuned.
INSERT INTO public.model_catalog
  (id, tier, provider, fal_model_id, display_name, cost_per_second_usd,
   min_duration_seconds, max_duration_seconds, active, sort_order)
VALUES
  ('veo3.1-fast', 'standard', 'fal', 'fal-ai/veo3.1/fast', 'Veo 3.1 Fast',
   0.15, 4, 8, true, 1),
  ('veo3.1', 'premium', 'fal', 'fal-ai/veo3.1', 'Veo 3.1',
   0.40, 4, 8, true, 2)
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =========================================================================
-- Verification (run AFTER the COMMIT above)
-- =========================================================================

-- 1) free_entry_url now nullable -> expect is_nullable = YES.
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'genesis_applications'
  AND column_name = 'free_entry_url';

-- 2) Three active tiers present.
SELECT id, tier, fal_model_id, display_name, cost_per_second_usd,
       min_duration_seconds, max_duration_seconds, active, sort_order
FROM public.model_catalog
ORDER BY sort_order;
