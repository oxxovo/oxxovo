-- ============================================================================
-- season_test: main-round theme + compressed schedule for banner testing 2026-07
-- ============================================================================
-- TEST DATA ONLY (season_test / season_number 999). Sets the public main-round
-- theme and a short main-round -> vote -> awards schedule so the Watch stage
-- banner can be walked through the full lifecycle within ~3 days.
--
-- Timeline (revised TK 2026-07-12 -- CF production needs more time):
--   now (2026-07-12)         Judging Complete  -> theme teaser banner
--   2026-07-13 07:00  main_round_start   finalists revealed / main round LIVE
--   2026-07-15 07:00  main_round_end     submission closes (48h); voting opens
--   2026-07-16 07:00  vote_end           voting closes; results pending
--   2026-07-16 19:00  awards             winners announced
--
-- Run AFTER main_round_theme_public_2026-07.sql. Idempotent (single UPDATE).
-- ============================================================================

BEGIN;

UPDATE public.seasons SET
  main_round_theme        = 'OXXOVO Beauty CF',
  main_round_start_at     = '2026-07-13T07:00:00+00:00',
  main_round_end_at       = '2026-07-15T07:00:00+00:00',
  community_vote_start_at = '2026-07-15T07:00:00+00:00',
  community_vote_end_at   = '2026-07-16T07:00:00+00:00',
  awards_announcement_at  = '2026-07-16T19:00:00+00:00',
  submission_hours        = 48,
  updated_at              = now()
WHERE id = 'season_test';

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
SELECT id, main_round_theme,
       main_round_start_at, main_round_end_at,
       community_vote_start_at, community_vote_end_at,
       awards_announcement_at
FROM public.seasons
WHERE id = 'season_test';
