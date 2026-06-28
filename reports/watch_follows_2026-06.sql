-- ============================================================================
-- WATCH FOLLOWS -- creator follow/subscribe (YouTube-style Subscriptions)
-- ============================================================================
-- One row = "follower_user_id follows creator_user_id". Drives the follow button
-- on the video detail page and the "Subscriptions" list in the Watch sidebar.
--
-- Only accounts (auth.users) can follow and be followed; applications whose
-- user_id is NULL (test/legacy rows) are not followable -- enforced in app code
-- (the follow button only shows when the creator has a user_id).
--
-- Same security model as the other watch_* social tables (membership_events
-- pattern): RLS ENABLED + REVOKE ALL from anon/authenticated/PUBLIC + GRANT ALL
-- to service_role + ZERO policies. Reachable only via server (service role).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.watch_follows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT watch_follows_no_self CHECK (follower_user_id <> creator_user_id)
);

-- One follow per (follower, creator) -- toggling is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS watch_follows_pair_uniq
  ON public.watch_follows(follower_user_id, creator_user_id);

-- "Who do I follow" (sidebar Subscriptions list).
CREATE INDEX IF NOT EXISTS watch_follows_follower_idx
  ON public.watch_follows(follower_user_id);

-- "Who follows this creator" (follower counts, future).
CREATE INDEX IF NOT EXISTS watch_follows_creator_idx
  ON public.watch_follows(creator_user_id);

ALTER TABLE public.watch_follows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_follows FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.watch_follows  TO service_role;

-- Verify (expect the table with 0 rows)
SELECT count(*) AS watch_follows_rows FROM public.watch_follows;
