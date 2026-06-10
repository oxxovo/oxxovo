-- =========================================================================
-- OXXOVO Studio (Session 6) -- Phase 3 schema (submission integration)
-- Run in Supabase SQL Editor (full file as one block).
--
-- Phase 3 wires the /studio submission into the existing application record and
-- the scoring queue. CryptoBind (Patent 1) is verified at submission and its
-- proof is recorded immutably on the application row, PER ROUND. ADD-only,
-- idempotent.
--
-- Rounds: a season's studio_round is 'application', 'main', or 'both'.
--   * 'both' (Season 0) -- the participant submits via studio in BOTH the
--     application and the main round, so each round needs its own immutable
--     submission + CryptoBind proof. Which round a given submission records to
--     is decided SERVER-SIDE from the schedule (now vs main_round_start_at);
--     the client never chooses.
--   * application submission writes the existing free_entry_url (external-URL
--     entry is retired for studio seasons); main submission writes the existing
--     main_round_video_url / main_round_submitted_at.
--
-- genesis_applications gains per-round studio columns:
--   studio_application_job_id        -> generation_jobs row submitted to 예선
--   studio_application_signature     -> its verified CryptoBind signature
--   studio_application_submitted_at  -> when 예선 studio submission landed
--   studio_main_job_id               -> generation_jobs row submitted to 본선
--   studio_main_signature            -> its verified CryptoBind signature
--   (본선 submitted time + video reuse main_round_submitted_at /
--    main_round_video_url; 예선 video + duration reuse free_entry_url /
--    video_duration_seconds.)
--
-- seasons gains:
--   studio_round                     -> 'application' | 'main' | 'both' (def 'main')
--   studio_max_generations_per_round -> per-participant per-round cap (def 10)
-- Season 0 (season_0) is set to 'both'.
--
-- Nothing is added to scoring_results: the studio submission only writes to
-- genesis_applications; the oxxovo-scoring batches pick it up from there.
--
-- ASCII-only. Idempotent.
-- =========================================================================

BEGIN;

-- 1. genesis_applications -- per-round studio submission + CryptoBind proof.
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS studio_application_job_id uuid;
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS studio_application_signature text;
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS studio_application_submitted_at timestamptz;
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS studio_main_job_id uuid;
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS studio_main_signature text;

-- FKs to generation_jobs (added separately so re-runs do not duplicate them).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'genesis_applications_studio_app_job_fk'
      AND conrelid = 'public.genesis_applications'::regclass
  ) THEN
    ALTER TABLE public.genesis_applications
      ADD CONSTRAINT genesis_applications_studio_app_job_fk
      FOREIGN KEY (studio_application_job_id)
      REFERENCES public.generation_jobs(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'genesis_applications_studio_main_job_fk'
      AND conrelid = 'public.genesis_applications'::regclass
  ) THEN
    ALTER TABLE public.genesis_applications
      ADD CONSTRAINT genesis_applications_studio_main_job_fk
      FOREIGN KEY (studio_main_job_id)
      REFERENCES public.generation_jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. seasons -- studio round target + per-round generation cap.
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_round text NOT NULL DEFAULT 'main';
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS studio_max_generations_per_round int NOT NULL DEFAULT 10;

-- CHECK on studio_round: application | main | both.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'seasons_studio_round_check'
      AND conrelid = 'public.seasons'::regclass
  ) THEN
    ALTER TABLE public.seasons DROP CONSTRAINT seasons_studio_round_check;
  END IF;
  ALTER TABLE public.seasons
    ADD CONSTRAINT seasons_studio_round_check
    CHECK (studio_round IN ('application', 'main', 'both'));
END $$;

-- Season 0 uses studio for BOTH rounds (external-URL entry retired).
UPDATE public.seasons SET studio_round = 'both' WHERE id = 'season_0';

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

-- 2) FKs present.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.genesis_applications'::regclass
  AND conname IN ('genesis_applications_studio_app_job_fk', 'genesis_applications_studio_main_job_fk')
ORDER BY conname;

-- 3) seasons studio settings present with defaults.
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons'
  AND column_name IN ('studio_round', 'studio_max_generations_per_round')
ORDER BY column_name;

-- 4) studio_round CHECK present (3 values).
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.seasons'::regclass
  AND conname = 'seasons_studio_round_check';

-- 5) Season 0 is 'both'.
SELECT id, studio_round, studio_max_generations_per_round
FROM public.seasons WHERE id = 'season_0';
