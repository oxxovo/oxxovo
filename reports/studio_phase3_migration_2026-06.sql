-- =========================================================================
-- OXXOVO Studio (Session 6) -- Phase 3 schema (submission integration)
-- Run in Supabase SQL Editor (full file as one block).
--
-- Phase 3 wires the /studio submission into the existing application record and
-- the scoring queue. CryptoBind (Patent 1) is verified at submission and its
-- proof is recorded immutably on the application row ("registered together with
-- the CryptoBind metadata"). This migration is ADD-only and idempotent.
--
-- 1. genesis_applications gains three studio columns:
--      studio_generation_job_id      -> which generation_jobs row was submitted
--      studio_cryptobind_signature   -> the verified signature (immutable proof
--                                       that the submission was session-bound)
--      studio_cryptobind_verified_at -> when verification passed at submission
--    The participant (PID) and tournament (TID) are already on the row
--    (user_id, season_id), so they are not duplicated. The actual video URL
--    continues to use the existing main_round_video_url / main_round_submitted_at
--    columns -- no new video column.
--
-- 2. seasons gains two studio settings (read dynamically per season; never
--    hardcoded):
--      studio_round                     -> which round /studio targets for this
--                                          season: 'application' (writes
--                                          free_entry_url) or 'main' (writes
--                                          main_round_video_url). Default 'main'.
--      studio_max_generations_per_round -> per-participant generation cap
--                                          (default 10).
--
-- Nothing is added to scoring_results: the studio submission only writes to
-- genesis_applications, and the oxxovo-scoring main-round batch picks it up from
-- there (its own rows are written by that system).
--
-- ASCII-only. Idempotent.
-- =========================================================================

BEGIN;

-- 1. genesis_applications -- studio submission + CryptoBind proof.
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS studio_generation_job_id uuid;

ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS studio_cryptobind_signature text;

ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS studio_cryptobind_verified_at timestamptz;

-- FK to generation_jobs (added separately so re-runs do not duplicate it).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'genesis_applications_studio_job_fk'
      AND conrelid = 'public.genesis_applications'::regclass
  ) THEN
    ALTER TABLE public.genesis_applications
      ADD CONSTRAINT genesis_applications_studio_job_fk
      FOREIGN KEY (studio_generation_job_id)
      REFERENCES public.generation_jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. seasons -- studio round target + per-round generation cap.
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_round text NOT NULL DEFAULT 'main';

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_max_generations_per_round int NOT NULL DEFAULT 10;

-- CHECK on studio_round (added separately so re-runs do not duplicate it).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'seasons_studio_round_check'
      AND conrelid = 'public.seasons'::regclass
  ) THEN
    ALTER TABLE public.seasons
      ADD CONSTRAINT seasons_studio_round_check
      CHECK (studio_round IN ('application', 'main'));
  END IF;
END $$;

COMMIT;

-- =========================================================================
-- Verification (run AFTER the COMMIT above)
-- =========================================================================

-- 1) genesis_applications studio columns present.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'genesis_applications'
  AND column_name LIKE 'studio_%'
ORDER BY column_name;

-- 2) FK present.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.genesis_applications'::regclass
  AND conname = 'genesis_applications_studio_job_fk';

-- 3) seasons studio settings present with defaults.
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons'
  AND column_name IN ('studio_round', 'studio_max_generations_per_round')
ORDER BY column_name;

-- 4) studio_round CHECK present.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.seasons'::regclass
  AND conname = 'seasons_studio_round_check';
