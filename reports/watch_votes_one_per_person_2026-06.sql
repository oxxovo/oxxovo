-- OXXOVO Watch -- correct watch_votes to 1-person-1-vote (2026-06-28)
-- ===========================================================================
-- Run in Supabase SQL Editor (whole file as one block).
--
-- Why: the first watch_system_migration was Run with the vote unique index as
--   watch_votes_app_user_uniq = UNIQUE(application_id, user_id) = ONE vote PER
--   VIDEO. TK confirmed the policy is ONE vote per PERSON across the whole main
--   round (most votes wins). That requires UNIQUE(season_id, round, user_id).
--
-- Safe to run: watch_votes has 0 rows (the vote feature is not built yet), so
--   dropping/creating the unique index cannot fail on existing duplicates.
--
-- Idempotent: DROP IF EXISTS + CREATE IF NOT EXISTS.
-- ===========================================================================

BEGIN;

-- Remove the per-video unique (1 vote per video).
DROP INDEX IF EXISTS public.watch_votes_app_user_uniq;

-- Add the per-person unique (1 vote per person, per season+round).
CREATE UNIQUE INDEX IF NOT EXISTS watch_votes_season_round_user_uniq
  ON public.watch_votes(season_id, round, user_id);

COMMIT;

-- ===========================================================================
-- Verification (run separately after COMMIT)
-- ===========================================================================

-- Expect: watch_votes_season_round_user_uniq present, watch_votes_app_user_uniq
-- ABSENT. (watch_votes_application_idx / watch_votes_season_round_idx remain.)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'watch_votes'
ORDER BY indexname;
