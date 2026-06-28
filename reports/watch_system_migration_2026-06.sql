-- OXXOVO Watch System Phase 1 -- likes / views / comments / staff_pick (2026-06-27)
-- ===========================================================================
-- Run in Supabase SQL Editor (run the whole file as one block).
--
-- Background (project: Watch video system, TK 2026-06-27):
--   Watch is the single surface for browsing submitted competition videos.
--   Videos themselves already live in genesis_applications (free_entry_url,
--   main_round_video_url) -- no new video storage needed here. This migration
--   only adds the SOCIAL layer: likes, view counts, comments + moderation,
--   plus a staff_pick curation flag on the application itself.
--
-- Access model (project: server-side anon/RLS trap):
--   * All reads AND writes go through server actions using the service-role
--     client (createSupabaseAdmin). The Watch page is a server component that
--     reads via service_role too (anon has no SELECT on genesis_applications),
--     applying the visibility rule (exclude flagged/rejected, require a video)
--     in code -- so NO public view and NO public table grants are required.
--   * These tables therefore mirror the membership_events / partner pattern:
--     RLS ENABLE + REVOKE ALL from anon/authenticated/PUBLIC + GRANT ALL to
--     service_role + zero policies. Nothing is reachable except via server.
--
-- Idempotent: IF NOT EXISTS / IF EXISTS throughout (ADD-only column policy).
-- ===========================================================================

BEGIN;

-- A note on "video" identity: one genesis_application can hold TWO videos --
-- the preliminary entry (free_entry_url) and the main-round entry
-- (main_round_video_url) -- shown side by side from the main round on. So the
-- social unit is (application_id, round) where round in ('application','main'),
-- NOT the application alone. likes / views / comments all carry round so the
-- two videos never share counts. (watch_votes is main-round only and carries
-- its own round in ('main','final').)

-- ---------------------------------------------------------------------------
-- 1. watch_likes -- one like per (application, round, user). Members only
--    (user_id NOT NULL + server action). The UNIQUE index makes double-likes
--    impossible at the DB level.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watch_likes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.genesis_applications(id) ON DELETE CASCADE,
  round          TEXT NOT NULL DEFAULT 'application',
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT watch_likes_round_check
    CHECK (round IN ('application', 'main'))
);

CREATE UNIQUE INDEX IF NOT EXISTS watch_likes_app_round_user_uniq
  ON public.watch_likes(application_id, round, user_id);

CREATE INDEX IF NOT EXISTS watch_likes_app_round_idx
  ON public.watch_likes(application_id, round);

CREATE INDEX IF NOT EXISTS watch_likes_user_idx
  ON public.watch_likes(user_id);

-- ---------------------------------------------------------------------------
-- 2. watch_views -- de-duplicated view events. viewer_key is computed server
--    side (logged-in user_id, else a salted hash of IP+UA). One row per
--    (application, viewer, day): a refresh on the same day does not re-count.
--    View count = COUNT(*) WHERE application_id = ...
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watch_views (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.genesis_applications(id) ON DELETE CASCADE,
  round          TEXT NOT NULL DEFAULT 'application',
  viewer_key     TEXT NOT NULL,
  view_date      DATE NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT watch_views_round_check
    CHECK (round IN ('application', 'main'))
);

CREATE UNIQUE INDEX IF NOT EXISTS watch_views_app_round_viewer_day_uniq
  ON public.watch_views(application_id, round, viewer_key, view_date);

CREATE INDEX IF NOT EXISTS watch_views_app_round_idx
  ON public.watch_views(application_id, round);

-- ---------------------------------------------------------------------------
-- 3. watch_comments -- members only (user_id NOT NULL). Author can edit/delete
--    (server action checks ownership). Admin can HIDE (status='hidden') --
--    never a hard delete. report_count is denormalized for fast triage.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watch_comments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.genesis_applications(id) ON DELETE CASCADE,
  round          TEXT NOT NULL DEFAULT 'application',
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'visible',
  report_count   INT  NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at      TIMESTAMPTZ,
  CONSTRAINT watch_comments_status_check
    CHECK (status IN ('visible', 'hidden')),
  CONSTRAINT watch_comments_round_check
    CHECK (round IN ('application', 'main'))
);

CREATE INDEX IF NOT EXISTS watch_comments_app_round_idx
  ON public.watch_comments(application_id, round, created_at DESC);

CREATE INDEX IF NOT EXISTS watch_comments_user_idx
  ON public.watch_comments(user_id);

-- ---------------------------------------------------------------------------
-- 4. watch_comment_reports -- one report per (comment, reporter). Drives
--    report_count and the admin moderation queue.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watch_comment_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id       UUID NOT NULL REFERENCES public.watch_comments(id) ON DELETE CASCADE,
  reporter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS watch_comment_reports_comment_reporter_uniq
  ON public.watch_comment_reports(comment_id, reporter_user_id);

CREATE INDEX IF NOT EXISTS watch_comment_reports_comment_idx
  ON public.watch_comment_reports(comment_id);

-- ---------------------------------------------------------------------------
-- 5. genesis_applications.staff_pick -- editorial curation, independent of AI
--    score (project: scoring integrity -- this never touches score columns).
-- ---------------------------------------------------------------------------
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS staff_pick BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS staff_pick_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS genesis_applications_staff_pick_idx
  ON public.genesis_applications(staff_pick)
  WHERE staff_pick = true;

-- ---------------------------------------------------------------------------
-- 6. watch_votes -- community vote on MAIN-ROUND videos. UP TO N votes per
--    person (default 3, TK 2026-06-28): ONE vote per video (application+user
--    unique) AND at most community_vote_max_per_user rows per (season, round,
--    user), enforced by the trigger in section 9. Most TOTAL votes wins.
--    Logged-in only (user_id NOT NULL). voter_ip / voter_ua / created_at are
--    kept for abuse-pattern detection (timing, ballot stuffing). round defaults
--    to 'main' so the table can extend to other rounds without a schema change.
--
--    Aggregation -> community score -> computeFinalScore(): the per-video
--    COUNT is normalized at read time and fed in as communityScore. Season 0
--    runs with community_vote_weight = 0 (button works, rank unaffected --
--    a live soak test); Season 1+ uses 0.5 (real).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watch_votes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.genesis_applications(id) ON DELETE CASCADE,
  season_id      TEXT NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  round          TEXT NOT NULL DEFAULT 'main',
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voter_ip       TEXT,
  voter_ua       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT watch_votes_round_check
    CHECK (round IN ('main', 'final'))
);

-- One vote per video: a user cannot vote twice for the same video. The
-- per-person cap (up to 3 videos) is enforced by the trigger in section 9.
CREATE UNIQUE INDEX IF NOT EXISTS watch_votes_app_user_uniq
  ON public.watch_votes(application_id, user_id);

CREATE INDEX IF NOT EXISTS watch_votes_application_idx
  ON public.watch_votes(application_id);

CREATE INDEX IF NOT EXISTS watch_votes_season_round_idx
  ON public.watch_votes(season_id, round);

-- ---------------------------------------------------------------------------
-- 7. seasons -- community vote window (admin-set, no hardcoded 72h). Outside
--    [start, end] the vote button is inert. NULL = voting not configured.
-- ---------------------------------------------------------------------------
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS community_vote_start_at TIMESTAMPTZ;

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS community_vote_end_at TIMESTAMPTZ;

-- Max videos one person can vote for in a season's round (1-person-N-votes;
-- default 3). Read by the watch_votes limit trigger -- no hardcoded cap.
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS community_vote_max_per_user INT NOT NULL DEFAULT 3;

-- ---------------------------------------------------------------------------
-- 8. RLS + GRANTS -- service_role only, zero policies (membership_events
--    pattern). REVOKE first (idempotent no-op if absent), then GRANT.
-- ---------------------------------------------------------------------------
ALTER TABLE public.watch_likes           ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_likes           FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.watch_likes            TO service_role;

ALTER TABLE public.watch_views           ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_views           FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.watch_views            TO service_role;

ALTER TABLE public.watch_comments        ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_comments        FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.watch_comments         TO service_role;

ALTER TABLE public.watch_comment_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_comment_reports FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.watch_comment_reports  TO service_role;

ALTER TABLE public.watch_votes           ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_votes           FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.watch_votes            TO service_role;

-- ---------------------------------------------------------------------------
-- 9. watch_votes per-person limit -- "up to N votes per person" enforced at the
--    DB level. An app-level COUNT check races: two concurrent inserts both read
--    the old count and both pass. The advisory xact lock serializes a given
--    voter so the COUNT is authoritative. N = seasons.community_vote_max_per_user.
--    (The app still pre-checks for a friendly message; this is the hard backstop.)
-- ---------------------------------------------------------------------------
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

-- 1) Tables exist -- expect 5 rows
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('watch_likes','watch_views','watch_comments','watch_comment_reports','watch_votes')
ORDER BY table_name;

-- 2) New columns -- expect staff_pick(+_at) on genesis_applications and
--    community_vote_start/end_at on seasons
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ( (table_name = 'genesis_applications' AND column_name IN ('staff_pick','staff_pick_at'))
     OR (table_name = 'seasons' AND column_name IN ('community_vote_start_at','community_vote_end_at')) )
ORDER BY table_name, column_name;

-- 3) RLS enabled -- expect rowsecurity = true for all 5
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('watch_likes','watch_views','watch_comments','watch_comment_reports','watch_votes')
ORDER BY tablename;

-- 4) Grants -- expect ONLY service_role per table (anon/authenticated absent)
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('watch_likes','watch_views','watch_comments','watch_comment_reports','watch_votes')
ORDER BY table_name, grantee, privilege_type;

-- 5) Unique indexes -- expect the dedup indexes present
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('watch_likes','watch_views','watch_comments','watch_comment_reports','watch_votes')
  AND indexname LIKE '%uniq%'
ORDER BY indexname;
