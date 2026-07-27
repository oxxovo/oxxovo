-- ===========================================================================
-- Watch score-disclosure gate  (2026-07-26)
-- ===========================================================================
-- WHY
--   Public Triple-AI scores are blocked on Defect 1 (the Integrity axis
--   penalises photorealism, so the better film can rank lower). Until the
--   scoring track ships the rubric fix, no score may appear on /watch.
--   Head office signals when to flip this on.
--
--   The switch is per season, not a code constant, so turning it on needs no
--   deploy ([[feedback_no_hardcode]]).
--
-- SAFETY
--   Default FALSE. The app reads this column fail-closed: if the column is
--   missing, unreadable, or false, scores are withheld. Running this migration
--   therefore changes NOTHING visible -- it only creates the switch.
--
-- WHAT IS GATED (app side)
--   1. /watch grid card         -- "Triple-AI NN.NN점" footer + green Verified badge
--   2. /watch/[id] ScorePanel   -- verified score, grade, per-axis, AI critiques
--   3. Finalist list            -- verifiedScore field AND score-descending order
--   NOT gated: the "AI judging N/M" progress bar (a count, not a score) and the
--   admin console (staff always see scores).
-- ===========================================================================

-- 1) the switch
ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS watch_scores_public boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN seasons.watch_scores_public IS
  'Public Triple-AI score disclosure on /watch. Keep false until the Defect 1 rubric fix ships (head office signal).';

-- ===========================================================================
-- VERIFICATION -- run after the ALTER, expect every row false
-- ===========================================================================

-- 2) column exists with the right default
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'seasons'
  AND column_name = 'watch_scores_public';
-- expect: boolean | NO | false

-- 3) every season is OFF
SELECT id, status, watch_scores_public
FROM seasons
ORDER BY season_number DESC;
-- expect: watch_scores_public = false on every row

-- 4) nothing switched on by accident
SELECT count(*) AS seasons_with_scores_public
FROM seasons
WHERE watch_scores_public IS TRUE;
-- expect: 0

-- 5) paste-corruption guard: the column name must be exactly this, no stray
--    whitespace/newline picked up on the way through chat.
SELECT count(*) AS exact_name_ok
FROM information_schema.columns
WHERE table_name = 'seasons'
  AND column_name = 'watch_scores_public'
  AND column_name !~ '\s';
-- expect: 1

-- 6) GRANT check. Adding a column to an existing table inherits that table's
--    TABLE-level privileges, so no new GRANT is needed. This only matters if
--    someone had granted COLUMN-level privileges on seasons -- then the new
--    column would be excluded. Expect zero rows.
SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_name = 'seasons'
  AND grantee IN ('anon', 'authenticated', 'service_role');
-- expect: 0 rows (privileges are table-level, not column-level)
-- The app reads this column with the service role on the BASE table only; it is
-- deliberately NOT added to the public seasons_public view
-- ([[feedback_seasons_public_view]]), so anon gains nothing.

-- ===========================================================================
-- LATER -- how to turn it ON (do NOT run now; only on the head-office signal)
-- ===========================================================================
-- UPDATE seasons SET watch_scores_public = true WHERE id = 'season_0';
-- Takes effect within the /watch cache TTL (60s). To revert instantly:
-- UPDATE seasons SET watch_scores_public = false WHERE id = 'season_0';
