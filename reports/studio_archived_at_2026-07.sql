-- ============================================================================
-- Studio clip soft-archive (workspace -> My Library) 2026-07
-- ============================================================================
-- generation_jobs.archived_at is SET when a clip's round is SUBMITTED, moving it
-- out of the active Compose workspace + generate screen into My Library. It is a
-- SOFT archive -- the clip is NEVER deleted; the library reads archived rows.
-- NULL = still in the active workspace. (TK 2026-07-12.)
--
-- The 4 My Library display fields need NO other column: season name (join
-- seasons), round (derive from created_at vs main_round_start_at), created date
-- (created_at), submitted (archived_at set = submitted / NULL = not).
--
-- ASCII-only, idempotent. Run in Supabase SQL editor. Project = qrnkovokjmimagrwjebs.
-- ============================================================================

BEGIN;

ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Partial index: the compose + generate workspace queries filter archived_at IS NULL.
CREATE INDEX IF NOT EXISTS generation_jobs_active_idx
  ON public.generation_jobs (user_id, season_id)
  WHERE archived_at IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Verification -- expect 1 row: archived_at
-- ============================================================================
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'generation_jobs'
  AND column_name = 'archived_at';
