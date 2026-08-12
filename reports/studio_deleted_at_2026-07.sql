-- ============================================================================
-- Studio user soft-delete (clips + renders) 2026-07
-- ============================================================================
-- Participants need to remove clips (generation_jobs) and composed finals
-- (render_jobs) from their Studio workspace / library. This is a SOFT delete:
-- deleted_at is SET, the row + R2 file are NEVER removed, the screen just hides
-- deleted rows (deleted_at IS NULL). Competition record is preserved.
--
-- PROTECTION (enforced in the delete action, not the DB): a SUBMITTED work is
-- never deletable. render_jobs.status = 'submitted' is locked; a clip that was
-- submitted (status = 'submitted') or used inside a submitted render is locked.
--
-- Distinct from archived_at (workspace -> My Library on submit). A row can be
-- archived (in library) AND later soft-deleted (hidden) if it is not a
-- submitted work.
--
-- ASCII-only, idempotent. Run in Supabase SQL editor. Project = qrnkovokjmimagrwjebs.
-- ============================================================================

BEGIN;

ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE public.render_jobs
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Partial indexes: the workspace + library queries all filter deleted_at IS NULL.
CREATE INDEX IF NOT EXISTS generation_jobs_not_deleted_idx
  ON public.generation_jobs (user_id, season_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS render_jobs_not_deleted_idx
  ON public.render_jobs (user_id, season_id)
  WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Verification -- expect 2 rows: generation_jobs.deleted_at, render_jobs.deleted_at
-- ============================================================================
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('generation_jobs', 'render_jobs')
  AND column_name = 'deleted_at'
ORDER BY table_name;
