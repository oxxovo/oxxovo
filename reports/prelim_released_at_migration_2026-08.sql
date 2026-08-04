-- ===========================================================================
-- seasons.prelim_released_at -- make the cohort release the authority
-- Lane A, 2026-08-03. Run in the Supabase SQL Editor, one block at a time.
-- ===========================================================================
--
-- WHY
-- The anti-copy hold keeps every prelim entry invisible until the whole cohort
-- is published at once. But an asynchronous submission is finalized LATER (up
-- to the 24h processing buffer), and finalize stamps watch_hold from the
-- season's hold switch -- so an entry that lands after the release is put back
-- under the hold. With the auto release the next hourly tick frees it; with the
-- MANUAL release (season_0's current setting) nobody ever does, and that one
-- participant stays invisible for the rest of the competition with nothing
-- anywhere reporting it.
--
-- This column records WHEN the cohort was released. After that instant the hold
-- is over for the season, so finalize holds only while
--     studio_prelim_hold_enabled = true AND prelim_released_at IS NULL.
--
-- A derived marker (does any row have watch_hold_released_at?) was rejected: a
-- release that matched zero rows leaves no trace, and the straggler is then
-- held all over again -- the exact case this is here to close.
--
-- SAFE: one nullable column, no default, no backfill, nothing rewritten. No
-- existing row changes meaning: NULL = "this cohort has not been released",
-- which is true of every season today (measured 2026-08-03: 0 rows are held and
-- studio_prelim_hold_enabled is false on all 14 seasons).
--
-- NOTE: this migration does NOT arm the hold. Turning it on for season_0 is a
-- separate step and waits on the auto-vs-manual decision.
-- ===========================================================================


-- ===========================================================================
-- STEP 0 -- SAFETY CHECK. Run this ALONE, first, and read the result.
-- Expect 0 rows: the column does not exist yet. If it returns a row, the
-- migration already ran -- stop here, nothing else to do.
-- ===========================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name = 'prelim_released_at';


-- ===========================================================================
-- STEP 1 -- add the column. Idempotent.
-- ===========================================================================
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS prelim_released_at timestamptz;


-- ===========================================================================
-- STEP 2 -- comment, so the column explains itself in the schema.
-- ===========================================================================
COMMENT ON COLUMN public.seasons.prelim_released_at IS
  'When the prelim anti-copy cohort was published (manual admin button or the auto tick). NULL = not released. While NULL and studio_prelim_hold_enabled is true, a finalizing submission is held; after it is set, late finalizers publish immediately.';


-- ===========================================================================
-- STEP 3 -- VERIFY. Expect exactly one row: prelim_released_at, timestamptz,
-- YES (nullable).
-- ===========================================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name = 'prelim_released_at';


-- ===========================================================================
-- STEP 4 -- VERIFY the data is untouched. Expect every row NULL, and the same
-- season count as before (14 on 2026-08-03).
-- ===========================================================================
SELECT count(*) AS seasons, count(prelim_released_at) AS released_marked
FROM public.seasons;


-- ===========================================================================
-- NOT PART OF THE RUN -- ROLLBACK, only if this has to be undone.
-- Dropping the column loses the release timestamps, and the code then falls
-- back to "not released", which means late finalizers are held again. Prefer
-- leaving the column in place.
--
--   ALTER TABLE public.seasons DROP COLUMN IF EXISTS prelim_released_at;
-- ===========================================================================
