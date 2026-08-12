-- =========================================================================
-- render_jobs.claim_token -- close the zombie-write window on renders
-- Lane A, 2026-08-02. Run in the Supabase SQL Editor, ONE BLOCK AT A TIME.
-- =========================================================================
--
-- WHY
--   The render lease (2026-07-30) fixed rows that stuck at 'rendering' forever
--   when a worker died: the season-tick sweep requeues a lease that has gone
--   quiet. That was right, and it opened a second window. Worker A stalls, the
--   sweep requeues, worker B renders and signs the bytes (v1sc), and then A
--   wakes up and writes its own result over B's row -- and over B's R2 object,
--   because the key was a pure function of the render id. The row then carries
--   one hash and the object carries different bytes, so the participant's entry
--   fails verification at submit. Silently, and days later.
--
--   claim_token is the row's answer to "which attempt owns this?". The worker
--   stamps a fresh uuid at claim time and every later write is CAS'd on it, so a
--   zombie's write matches zero rows and is dropped. The R2 key gets the same
--   token folded in, so the two attempts cannot write the same object either.
--   Both halves are needed: the token alone protects the row and not the bytes.
--
-- SAFETY
--   Additive and nullable. Existing rows get NULL, which the worker treats as
--   "claimed before this shipped" -- nothing is rewritten and nothing breaks.
--   Measured 2026-08-02: render_jobs holds 20 rows, all 'submitted' or 'ready',
--   so nothing is mid-flight while this runs.
--
--   generation_jobs.claim_token and studio_music_assets.claim_token already
--   exist (lane C, run 2026-08-02). This is the third and last table.
--
-- ORDER
--   *** Run this BEFORE the worker code that uses it is deployed. The worker will
--   write claim_token on every claim; against a table without the column, every
--   claim errors and the render queue stops.
-- =========================================================================


-- =========================================================================
-- STEP 0 -- safety check. Run this ALONE and read the result first.
-- Expect: 0 rows. A row here means the column already exists and STEP 1 is
-- unnecessary (it is harmless either way -- IF NOT EXISTS).
-- =========================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'render_jobs'
  AND column_name = 'claim_token';


-- =========================================================================
-- STEP 0b -- safety check. Run this ALONE.
-- Expect: 0 rows in flight. If any row is 'rendering' or 'uploading', a worker
-- may be mid-render; adding a nullable column will not disturb it, but you want
-- to know it is there before, not after.
-- =========================================================================
SELECT status, count(*) AS rows
FROM public.render_jobs
GROUP BY status
ORDER BY status;


-- =========================================================================
-- STEP 1 -- the migration. One statement.
-- =========================================================================
ALTER TABLE public.render_jobs
  ADD COLUMN IF NOT EXISTS claim_token uuid;


-- =========================================================================
-- STEP 2 -- verification. Run AFTER step 1.
-- Expect: exactly 1 row -> claim_token | uuid | YES
-- =========================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'render_jobs'
  AND column_name = 'claim_token';


-- =========================================================================
-- STEP 3 -- verification across all three lanes. Run AFTER step 1.
-- Expect: exactly 3 rows (generation_jobs, render_jobs, studio_music_assets).
-- Two of them were lane C's; this confirms the set is complete.
-- =========================================================================
SELECT table_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'claim_token'
ORDER BY table_name;


-- =========================================================================
-- ROLLBACK -- NOT part of the run order. Only if the column must be removed.
-- Safe while the worker that writes claim_token is NOT deployed; if it is,
-- roll the worker back first or its every claim will error.
-- =========================================================================
-- ALTER TABLE public.render_jobs DROP COLUMN IF EXISTS claim_token;
