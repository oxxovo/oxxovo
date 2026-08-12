-- ============================================================================
-- season_test schedule: pull deadline / voting / awards one day earlier 2026-07
-- ============================================================================
-- main_round_start_at stays (7/13 07:00 UTC, auto-entry). Deadline, voting and
-- awards each move one day earlier so scoring -> voting -> results run with no
-- gap. submission_hours stays 24 (already yields the 7/14 07:00 deadline).
-- season_test ONLY -- WHERE id = 'season_test'. No other season is touched.
--
-- ASCII-only, idempotent. Run in Supabase SQL editor. Project = qrnkovokjmimagrwjebs.
-- ============================================================================

BEGIN;
UPDATE public.seasons SET
  main_round_end_at = '2026-07-14T07:00:00+00:00',
  community_vote_start_at = '2026-07-14T07:00:00+00:00',
  community_vote_end_at = '2026-07-15T07:00:00+00:00',
  awards_announcement_at = '2026-07-15T19:00:00+00:00',
  updated_at = now()
WHERE id = 'season_test';
COMMIT;

-- ============================================================================
-- Verification -- expect one season_test row with the new schedule
-- ============================================================================
SELECT id, main_round_start_at, main_round_end_at, community_vote_start_at,
  community_vote_end_at, awards_announcement_at, submission_hours
FROM public.seasons WHERE id = 'season_test';
