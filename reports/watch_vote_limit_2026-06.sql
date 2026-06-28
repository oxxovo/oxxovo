-- OXXOVO Watch -- watch_votes "up to 3 votes per person" cap (2026-06-28)
-- ===========================================================================
-- Run in Supabase SQL Editor (whole file as one block).
--
-- Context: the base watch_system_migration is already Run. Its vote unique
--   index watch_votes_app_user_uniq = UNIQUE(application_id, user_id) = ONE
--   vote per VIDEO -- that is CORRECT and stays. This file adds the per-person
--   cap: a viewer may vote for UP TO N DIFFERENT main-round videos (default 3,
--   TK 2026-06-28). Most TOTAL votes wins.
--
-- Why a trigger, not an app COUNT: an app-level check races -- two concurrent
--   inserts both read the old count and both pass. The advisory xact lock
--   serializes a given voter so the COUNT is authoritative. N is read from
--   seasons.community_vote_max_per_user (no hardcoded cap).
--
-- Safe: watch_votes has 0 rows. Idempotent (IF NOT EXISTS / OR REPLACE / DROP).
-- ===========================================================================

BEGIN;

-- Per-season cap (default 3). Season 0 can override per round if desired.
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS community_vote_max_per_user INT NOT NULL DEFAULT 3;

CREATE OR REPLACE FUNCTION public.enforce_watch_vote_limit()
RETURNS TRIGGER AS $$
DECLARE
  cap  INT;
  used INT;
BEGIN
  -- Serialize concurrent votes by the same voter (held to end of txn).
  PERFORM pg_advisory_xact_lock(
    hashtext(NEW.season_id || ':' || NEW.round || ':' || NEW.user_id::text)
  );

  SELECT COALESCE(community_vote_max_per_user, 3) INTO cap
  FROM public.seasons WHERE id = NEW.season_id;
  IF cap IS NULL THEN cap := 3; END IF;

  SELECT COUNT(*) INTO used
  FROM public.watch_votes
  WHERE season_id = NEW.season_id
    AND round = NEW.round
    AND user_id = NEW.user_id;

  IF used >= cap THEN
    RAISE EXCEPTION 'watch_vote_limit: user % already used %/% votes for %/%',
      NEW.user_id, used, cap, NEW.season_id, NEW.round
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS watch_votes_limit_trg ON public.watch_votes;
CREATE TRIGGER watch_votes_limit_trg
  BEFORE INSERT ON public.watch_votes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_watch_vote_limit();

COMMIT;

-- ===========================================================================
-- Verification (run separately after COMMIT)
-- ===========================================================================

-- 1) Column -- expect community_vote_max_per_user, integer, default 3
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name = 'community_vote_max_per_user';

-- 2) Trigger -- expect watch_votes_limit_trg present
SELECT tgname
FROM pg_trigger
WHERE tgrelid = 'public.watch_votes'::regclass
  AND NOT tgisinternal;

-- 3) Vote unique stays per-video -- expect watch_votes_app_user_uniq present
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'watch_votes'
ORDER BY indexname;
