-- ============================================================================
-- Studio per-round generation cap: 10 -> 30 (all seasons) 2026-07
-- ============================================================================
-- studio_max_generations_per_round was an unexamined Phase 3 migration DEFAULT
-- 10. TK (2026-07-13): a 30s CF needs 5-7 clips + retries; 10 does not let a
-- paying participant finish. Raise to 30 (applied per round: application 30 +
-- main 30 independently). NOT removed -- a cap keeps it a director's league,
-- not a best-of-N capital league. Applies to real seasons (test, 0-4) and the
-- disposable test seasons (1000-1006, test2) for uniformity.
--
-- ASCII-only, idempotent. Run in Supabase SQL editor. Project = qrnkovokjmimagrwjebs.
-- ============================================================================

BEGIN;
UPDATE public.seasons SET studio_max_generations_per_round = 30, updated_at = now();
COMMIT;

-- ============================================================================
-- Verification -- expect every row = 30
-- ============================================================================
SELECT id, studio_max_generations_per_round FROM public.seasons ORDER BY id;
