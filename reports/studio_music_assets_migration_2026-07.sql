-- =========================================================================
-- OXXOVO Studio -- Music v1 schema (studio_music_assets + season gate).
-- Project: qrnkovokjmimagrwjebs. Run in Supabase SQL Editor (whole file).
--
-- Music bed for compositions: (1) platform LIBRARY (royalty-free tracks we
-- author, like self-made LUTs) and (2) in-platform AI generation (Beatoven).
-- NEVER a participant upload. Each asset is signed like a source clip so the
-- EDL music.assetId can be verified + bound at render (anti-swap).
-- Design: reports/studio_music_v1_design.md
--
-- ASCII-only. Idempotent (IF NOT EXISTS). No dollar-quote blocks, no long string
-- literals (paste-safe -- see [[feedback-sql-ascii-only]] / whitespace trap).
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. studio_music_assets -- one row per bed track (library or AI-generated).
--    id is TEXT: library ids are readable ('lib_elegant_01'); AI ids are uuids.
--    Signed (cryptobind_signature) like a source clip. AI rows carry a lifecycle
--    status + owner + prompt; library rows are 'ready' + user_id NULL.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.studio_music_assets (
  id                      text PRIMARY KEY,
  source                  text NOT NULL,                 -- 'library' | 'ai'
  user_id                 uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL for library
  title                   text NOT NULL DEFAULT '',
  mood                    text NOT NULL DEFAULT '',       -- library grouping label
  prompt                  text,                           -- AI generation prompt
  duration_seconds        numeric NOT NULL DEFAULT 0,
  r2_key                  text,                           -- R2 object key (music/ namespace)
  url                     text,                           -- public R2 URL (worker downloads)

  -- CryptoBind (asset, v1m). Content-hash based signature so createRender can bind
  -- the chosen bed into the compose-request source bundle and the worker can prove
  -- the downloaded audio is the exact signed bytes (anti-repoint / anti-swap).
  cryptobind_content_hash text,
  cryptobind_signature    text,
  cryptobind_generated_at timestamptz,
  cryptobind_algo         text NOT NULL DEFAULT 'HMAC-SHA256',

  -- lifecycle (AI gen); library rows are inserted 'ready'.
  status                  text NOT NULL DEFAULT 'ready',
  error_message           text,
  active                  boolean NOT NULL DEFAULT true,  -- library curation on/off
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT studio_music_assets_source_check
    CHECK (source IN ('library', 'ai')),
  CONSTRAINT studio_music_assets_status_check
    CHECK (status IN ('queued', 'generating', 'ready', 'failed'))
);

-- Library picker lists active library tracks; AI worker polls queued; per-user list.
CREATE INDEX IF NOT EXISTS studio_music_assets_library_idx
  ON public.studio_music_assets (source, active);
CREATE INDEX IF NOT EXISTS studio_music_assets_status_idx
  ON public.studio_music_assets (status, created_at);
CREATE INDEX IF NOT EXISTS studio_music_assets_user_idx
  ON public.studio_music_assets (user_id);

-- -------------------------------------------------------------------------
-- 2. Lock the table to the service role (mirror generation_jobs / render_jobs).
--    The client never reads it directly; a server action returns the picker list.
--    ** GRANT set is mandatory -- do NOT ship without it (official_actors lesson). **
-- -------------------------------------------------------------------------
ALTER TABLE public.studio_music_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.studio_music_assets FROM anon;
REVOKE ALL PRIVILEGES ON public.studio_music_assets FROM authenticated;
GRANT ALL PRIVILEGES ON public.studio_music_assets TO service_role;

-- -------------------------------------------------------------------------
-- 3. Per-season allowlist gate (season-variable; music stays OFF until ready).
-- -------------------------------------------------------------------------
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_music_enabled boolean NOT NULL DEFAULT false;

COMMIT;

-- =========================================================================
-- Verification (run AFTER the COMMIT above)
-- =========================================================================

-- 1) table exists.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'studio_music_assets';

-- 2) grants -- expect ONLY service_role (anon/authenticated must be absent).
SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'studio_music_assets'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee ORDER BY grantee;

-- 3) RLS enabled -- expect true.
SELECT relname, relrowsecurity AS rls_enabled
FROM pg_class WHERE oid = 'public.studio_music_assets'::regclass;

-- 4) season music gate column present (expect studio_music_enabled = false).
SELECT id, studio_music_enabled FROM public.seasons ORDER BY id;

-- 5) whitespace guard -- expect 0 rows (no CR/LF/tab smuggled into any value).
SELECT id FROM public.studio_music_assets
WHERE title ~ '[\r\n\t]' OR COALESCE(url, '') ~ '[\r\n\t]' OR COALESCE(r2_key, '') ~ '[\r\n\t]';
