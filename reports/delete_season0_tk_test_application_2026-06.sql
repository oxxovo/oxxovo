-- ===========================================================================
-- DELETE season_0 "tk test" application (hellovegastour@gmail.com)
-- ===========================================================================
-- season_0 (THE LAST HOPE) was set to production values and 'draft'. The only
-- row in it is TK's own pre-go-live test application. Remove it so the season
-- opens clean on 7/1. Scoped to ONE season + ONE email -- never touches real
-- applicants (there are none yet; season is draft).
--
-- Order: scoring_results first (FK on application_id), then the application.
-- Run the SELECT block first to confirm exactly what will be removed.
-- Style: ASCII only, one transaction. See [[feedback-sql-ascii-only]].
-- ===========================================================================

-- 0. PREVIEW -- run this alone first; confirm it is the tk-test row only.
SELECT id, season_id, email, creator_name, status, created_at
FROM public.genesis_applications
WHERE season_id = 'season_0'
  AND email = 'hellovegastour@gmail.com';
-- expect: 1 row, status pre-decision (pending/eligible/etc.)

-- ---------------------------------------------------------------------------
-- 1. DELETE (run after the preview looks right)
-- ---------------------------------------------------------------------------
BEGIN;

DELETE FROM public.scoring_results sr
USING public.genesis_applications ga
WHERE sr.application_id = ga.id
  AND ga.season_id = 'season_0'
  AND ga.email = 'hellovegastour@gmail.com';

DELETE FROM public.genesis_applications
WHERE season_id = 'season_0'
  AND email = 'hellovegastour@gmail.com';

COMMIT;

-- ---------------------------------------------------------------------------
-- 2. VERIFY (run after commit) -- expect 0 rows
-- ---------------------------------------------------------------------------
SELECT count(*) AS remaining_in_season_0
FROM public.genesis_applications
WHERE season_id = 'season_0';
-- expect: 0
