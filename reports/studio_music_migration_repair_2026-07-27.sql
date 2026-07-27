-- =========================================================================
-- Studio music v1 -- migration repair (TK Run)
-- Discovered 2026-07-27 by live DB probe (read-only) against qrnkovokjmimagrwjebs.
--
-- PROBLEM
--   1. public.studio_music_assets EXISTS but with the WRONG shape.
--      Present:  id, title, mood, r2_key, status, created_at, signature, kind
--      Missing:  source, user_id, prompt, duration_seconds, url,
--                cryptobind_content_hash, cryptobind_signature,
--                cryptobind_generated_at, cryptobind_algo, error_message,
--                active, updated_at
--      Row count: 0 (verified -- nothing to preserve).
--      Because it already existed, the CREATE TABLE IF NOT EXISTS in
--      reports/studio_music_assets_migration_2026-07.sql was a silent no-op.
--   2. seasons.studio_music_enabled DOES NOT EXIST.
--      -> reports/studio_music_assets_migration_2026-07.sql never took effect.
--
-- LIVE IMPACT (verified, not theoretical)
--   lib/studio.ts loadComposeState / submitRender select studio_music_enabled
--   as part of a column list. Against this DB that select returns:
--     42703  column seasons.studio_music_enabled does not exist
--   PostgREST fails the WHOLE select, so the compose editor config load breaks.
--   Not in production today (main is at the 2026-07-13 site gate; the music code
--   lives on feat/studio-budget-guard), but it blocks the 8/5 promotion and it
--   breaks the compose editor on Preview right now (Preview shares the prod DB).
--
-- FIX
--   Drop the empty stray table, then re-run the real migration file.
--   ASCII only. Paste order matters -- step 1 first, then the full contents of
--   reports/studio_music_assets_migration_2026-07.sql.
-- =========================================================================

-- -------------------------------------------------------------------------
-- STEP 0 -- SAFETY CHECK. Run this ALONE first. Expect n_rows = 0.
--           If n_rows > 0, STOP and report -- do not drop.
-- -------------------------------------------------------------------------
SELECT count(*) AS n_rows FROM public.studio_music_assets;

-- -------------------------------------------------------------------------
-- STEP 1 -- Drop the empty stray table (only after STEP 0 shows 0).
-- -------------------------------------------------------------------------
BEGIN;

DROP TABLE IF EXISTS public.studio_music_assets;

COMMIT;

-- -------------------------------------------------------------------------
-- STEP 2 -- Now run the ENTIRE contents of
--           reports/studio_music_assets_migration_2026-07.sql
--           (creates the correct table + RLS/GRANT + the seasons column).
-- -------------------------------------------------------------------------

-- -------------------------------------------------------------------------
-- STEP 3 -- Verification. Run after STEP 2.
-- -------------------------------------------------------------------------

-- 3a) Table shape: expect 18 rows, including source / url / duration_seconds /
--     cryptobind_signature / cryptobind_content_hash / active / updated_at.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'studio_music_assets'
ORDER BY ordinal_position;

-- 3b) Season gate column present. Expect one row per season, all false.
SELECT id, studio_music_enabled FROM public.seasons ORDER BY id;

-- 3c) GRANT set: expect service_role only (no anon, no authenticated).
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'studio_music_assets'
ORDER BY grantee, privilege_type;

-- 3d) The exact select the app makes. Expect one row, no error.
SELECT studio_compose_enabled,
       studio_compose_min_seconds,
       studio_compose_max_seconds,
       studio_compose_max_clips,
       studio_music_enabled
FROM public.seasons
WHERE id = 'season_0';
