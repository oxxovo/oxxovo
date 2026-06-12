-- =========================================================================
-- OXXOVO Studio -- Compose (in-platform stitching) Phase 1 schema.
-- Run in Supabase SQL Editor (whole file as one block).
--
-- Decision (2026-06-11, TK): final submission = a 30s composition of multiple
-- AI clips, assembled in-platform (sequence + trim + cut only). This migration
-- lays the foundation: the render_jobs table (one row per composed final),
-- the genesis_applications render link columns, and per-season compose params.
-- Model catalog (which models / tiers) is tuned during the build (separate
-- migration) -- this file does NOT touch model_catalog.
--
-- Design contract: reports/studio_compose_architecture_2026-06.md
-- SUPERSEDES the 15s single-clip plan (studio_video_15s_kling, deleted).
--
-- ASCII-only. Idempotent (IF NOT EXISTS; FK adds guarded by DO blocks).
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- 1. render_jobs -- one row per composed final video. The worker advances it
--    through the same 6-stage machine as generation_jobs. CryptoBind for the
--    composition (request-stage = EDL + source bundle; content-stage = final
--    hash) lives in the cryptobind_* columns. See architecture doc, section 2.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.render_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id           text NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
  status              text NOT NULL DEFAULT 'queued',

  -- Edit Decision List: ordered segments. Each = { jobId, startMs, endMs }.
  -- trim = sub-range; cut = same jobId split across segments; sequence = order.
  edl                 jsonb NOT NULL,
  -- Distinct source generation_jobs ids referenced by the EDL (integrity check).
  source_job_ids      uuid[] NOT NULL DEFAULT '{}',
  total_duration_seconds numeric NOT NULL DEFAULT 0,

  -- output (set by worker on success)
  video_url           text,
  r2_key              text,

  -- CryptoBind (composition). Request stage filled at creation (EDL + sources
  -- are known up front); content stage filled by the worker once the final
  -- artifact exists. See lib/cryptobind.ts compose helpers.
  cryptobind_pid              uuid NOT NULL,           -- snapshot of user_id
  cryptobind_tid              text NOT NULL,           -- snapshot of season_id
  cryptobind_generated_at     timestamptz NOT NULL,
  cryptobind_algo             text NOT NULL DEFAULT 'HMAC-SHA256',
  cryptobind_edl_hash         text NOT NULL,           -- sha256 of canonical EDL
  cryptobind_source_bundle    text NOT NULL,           -- sha256 of sorted source sigs
  cryptobind_render_signature text NOT NULL,           -- v1sr request-stage sig
  cryptobind_final_hash       text,                    -- sha256 of final bytes (worker)
  cryptobind_final_signature  text,                    -- v1sc content-stage sig (worker)

  -- lifecycle bookkeeping
  attempts            int NOT NULL DEFAULT 0,
  error_message       text,
  worker_started_at   timestamptz,
  worker_finished_at  timestamptz,
  submitted_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT render_jobs_status_check
    CHECK (status IN ('queued', 'rendering', 'uploading', 'ready', 'submitted', 'failed')),
  CONSTRAINT render_jobs_duration_check
    CHECK (total_duration_seconds >= 0)
);

-- Worker polls queued renders oldest-first; per-user/season for caps + listing.
CREATE INDEX IF NOT EXISTS render_jobs_status_created_idx
  ON public.render_jobs (status, created_at);
CREATE INDEX IF NOT EXISTS render_jobs_user_season_idx
  ON public.render_jobs (user_id, season_id);

-- -------------------------------------------------------------------------
-- 2. Lock render_jobs to the service role (mirror generation_jobs).
-- -------------------------------------------------------------------------
ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.render_jobs FROM anon;
REVOKE ALL PRIVILEGES ON public.render_jobs FROM authenticated;
GRANT ALL PRIVILEGES ON public.render_jobs TO service_role;

-- -------------------------------------------------------------------------
-- 3. genesis_applications -- link the submitted composition (per round).
--    Video URL still goes to free_entry_url / main_round_video_url (scoring
--    ingest unchanged); these columns record WHICH render was submitted.
-- -------------------------------------------------------------------------
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS studio_application_render_id uuid;
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS studio_main_render_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'genesis_applications_studio_app_render_fk'
  ) THEN
    ALTER TABLE public.genesis_applications
      ADD CONSTRAINT genesis_applications_studio_app_render_fk
      FOREIGN KEY (studio_application_render_id)
      REFERENCES public.render_jobs(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'genesis_applications_studio_main_render_fk'
  ) THEN
    ALTER TABLE public.genesis_applications
      ADD CONSTRAINT genesis_applications_studio_main_render_fk
      FOREIGN KEY (studio_main_render_id)
      REFERENCES public.render_jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- -------------------------------------------------------------------------
-- 4. seasons -- per-season compose parameters (season-variable, never hardcoded).
--    Per-CLIP length stays governed by model_catalog native min/max; the season
--    only caps the FINAL composition (seconds + segment count).
-- -------------------------------------------------------------------------
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_compose_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_compose_max_seconds int NOT NULL DEFAULT 30;
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_compose_max_clips int NOT NULL DEFAULT 10;

-- Season 0 = compose on, 30s / 10 segments. Per-clip season bounds set PERMISSIVE
-- [1, 30] (not 0): the legacy constraint main_round_video_seconds_range_chk
-- requires main_round_video_min_seconds > 0 AND max >= min, so 0/unset is
-- rejected. [1, 30] lets any clip pass the season-level S-7 check while each
-- clip's real limit stays its model's native duration enum; the FINAL length is
-- governed by studio_compose_max_seconds (30).
UPDATE public.seasons
SET studio_compose_enabled = true,
    studio_compose_max_seconds = 30,
    studio_compose_max_clips = 10,
    application_video_min_seconds = 1,
    application_video_max_seconds = 30,
    main_round_video_min_seconds = 1,
    main_round_video_max_seconds = 30,
    main_round_video_seconds = 30,   -- legacy single-value column = final length
    updated_at = now()
WHERE id = 'season_0';

COMMIT;

-- =========================================================================
-- Verification (run AFTER the COMMIT above)
-- =========================================================================

-- 1) render_jobs exists.
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'render_jobs';

-- 2) render_jobs grants -- expect ONLY service_role.
SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'render_jobs'
  AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY grantee ORDER BY grantee;

-- 3) RLS enabled on render_jobs -- expect true.
SELECT relname, relrowsecurity AS rls_enabled
FROM pg_class WHERE oid = 'public.render_jobs'::regclass;

-- 4) genesis_applications render columns + FKs present.
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'genesis_applications'
  AND column_name IN ('studio_application_render_id', 'studio_main_render_id')
ORDER BY column_name;

-- 5) Season 0 compose params.
SELECT id, studio_compose_enabled, studio_compose_max_seconds, studio_compose_max_clips,
       application_video_min_seconds, application_video_max_seconds,
       main_round_video_min_seconds, main_round_video_max_seconds, main_round_video_seconds
FROM public.seasons WHERE id = 'season_0';
