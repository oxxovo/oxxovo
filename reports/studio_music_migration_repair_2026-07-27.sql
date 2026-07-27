-- =========================================================================
-- Studio music v1 -- migration REPAIR (TK Run). Self-contained: this file
-- replaces reports/studio_music_assets_migration_2026-07.sql. Do NOT run both.
--
-- ASCII only. LF only (.gitattributes pins *.sql to eol=lf).
-- Paste the whole file into the Supabase SQL editor in ONE go, in order.
--
-- -------------------------------------------------------------------------
-- WHY THIS EXISTS (measured 2026-07-27, read-only probe, project qrnkovokjmimagrwjebs)
--
--   1. public.studio_music_assets EXISTS with the WRONG shape.
--        present: id, title, mood, r2_key, status, created_at, signature, kind
--        missing: source, user_id, prompt, duration_seconds, url,
--                 cryptobind_content_hash, cryptobind_signature,
--                 cryptobind_generated_at, cryptobind_algo, error_message,
--                 active, updated_at
--        rows: 0 (verified -- nothing to preserve)
--      Because the table already existed, CREATE TABLE IF NOT EXISTS in the
--      original migration was a SILENT no-op.
--
--   2. seasons.studio_music_enabled DOES NOT EXIST.
--      -> the original migration never took effect at all.
--
--   LIVE IMPACT (reproduced, not theoretical): lib/studio.ts selects
--   studio_music_enabled inside a column list, so PostgREST fails the WHOLE
--   select with 42703 and the compose editor config load breaks. Production is
--   unaffected today (main is at the 2026-07-13 site gate), but Preview shares
--   the production database, so Preview is broken now.
--
--   ORDER RULE: run this SQL and pass STEP 4 verification BEFORE the switch
--   refactor code is pushed. Migration -> verify -> code. That order is exactly
--   what was broken here; do not repeat it.
-- =========================================================================

-- -------------------------------------------------------------------------
-- STEP 0 -- SAFETY CHECK. Run this statement ALONE first.
--           Expect n_rows = 0. If n_rows > 0, STOP and report. Do not drop.
-- -------------------------------------------------------------------------
SELECT count(*) AS n_rows FROM public.studio_music_assets;

-- -------------------------------------------------------------------------
-- STEP 1 -- Repair. Only after STEP 0 returned 0.
-- -------------------------------------------------------------------------
BEGIN;

-- 1a. Remove the empty stray table so the correct definition can be created.
DROP TABLE IF EXISTS public.studio_music_assets;

-- 1b. The real table. Library rows: source='library', user_id NULL, status
--     'ready'. AI rows: source='ai', owner set, lifecycle status. Every asset
--     is content-hash signed (v1m) so the worker can prove the audio it
--     downloaded is the exact signed bytes (anti-repoint / anti-swap).
CREATE TABLE public.studio_music_assets (
  id                      text PRIMARY KEY,
  source                  text NOT NULL,                 -- 'library' | 'ai'
  user_id                 uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL for library
  title                   text NOT NULL DEFAULT '',
  mood                    text NOT NULL DEFAULT '',      -- library grouping label
  prompt                  text,                          -- AI generation prompt
  duration_seconds        numeric NOT NULL DEFAULT 0,
  r2_key                  text,                          -- R2 object key (music/ namespace)
  url                     text,                          -- public R2 URL (worker downloads)

  cryptobind_content_hash text,
  cryptobind_signature    text,
  cryptobind_generated_at timestamptz,
  cryptobind_algo         text NOT NULL DEFAULT 'HMAC-SHA256',

  status                  text NOT NULL DEFAULT 'ready',
  error_message           text,
  active                  boolean NOT NULL DEFAULT true, -- library curation on/off
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT studio_music_assets_source_check
    CHECK (source IN ('library', 'ai')),
  CONSTRAINT studio_music_assets_status_check
    CHECK (status IN ('queued', 'generating', 'ready', 'failed'))
);

CREATE INDEX studio_music_assets_library_idx
  ON public.studio_music_assets (source, active);
CREATE INDEX studio_music_assets_status_idx
  ON public.studio_music_assets (status, created_at);
CREATE INDEX studio_music_assets_user_idx
  ON public.studio_music_assets (user_id);

-- 1c. Lock the table to the service role (mirror generation_jobs / render_jobs).
--     The client never reads it directly; a server action returns the picker
--     list. GRANT set is mandatory -- do NOT ship without it (official_actors
--     lesson). Note DROP TABLE also dropped the old grants, so this re-establishes
--     the full set rather than assuming anything survived.
ALTER TABLE public.studio_music_assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.studio_music_assets FROM PUBLIC;
REVOKE ALL PRIVILEGES ON public.studio_music_assets FROM anon;
REVOKE ALL PRIVILEGES ON public.studio_music_assets FROM authenticated;
GRANT ALL PRIVILEGES ON public.studio_music_assets TO service_role;

-- 1d. THE master switch. One name, season-scoped, default OFF.
--     Nothing else turns music on -- no config key, no env var, no deploy.
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_music_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.seasons.studio_music_enabled IS
  'Master gate for Studio music (library picker + AI generation + credit charge). Fail-closed. Keep false until the ElevenLabs written reply and TK approval; the ON signal comes from TK only.';

COMMIT;

-- =========================================================================
-- STEP 4 -- VERIFICATION. Run after STEP 1. All five must pass.
-- =========================================================================

-- 4a) Table shape. Expect 18 rows including source / url / duration_seconds /
--     cryptobind_signature / cryptobind_content_hash / active / updated_at.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'studio_music_assets'
ORDER BY ordinal_position;

-- 4b) GRANT set. Expect service_role rows ONLY -- no anon, no authenticated.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'studio_music_assets'
ORDER BY grantee, privilege_type;

-- 4c) Master switch present and OFF on every season. Expect all false.
SELECT id, status, studio_music_enabled
FROM public.seasons
ORDER BY id;

-- 4d) Nothing switched on by accident. Expect 0.
SELECT count(*) AS seasons_with_music_on
FROM public.seasons
WHERE studio_music_enabled IS TRUE;

-- 4e) Paste-corruption guard: the column name must be exactly this, with no
--     stray whitespace or newline picked up on the way through chat. Expect 1.
SELECT count(*) AS exact_name_ok
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name = 'studio_music_enabled'
  AND column_name !~ '\s';

-- 4f) The exact select the app makes today. Expect one row, no 42703.
SELECT studio_compose_enabled,
       studio_compose_min_seconds,
       studio_compose_max_seconds,
       studio_compose_max_clips,
       studio_music_enabled
FROM public.seasons
WHERE id = 'season_0';

-- =========================================================================
-- TURNING MUSIC ON (do NOT run now -- TK signal only, after the ElevenLabs
-- written reply on Music API Terms 3.A and TK's own judgement):
--   UPDATE public.seasons SET studio_music_enabled = true WHERE id = 'season_0';
-- =========================================================================
