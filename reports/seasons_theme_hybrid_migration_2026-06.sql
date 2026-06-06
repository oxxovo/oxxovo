-- =========================================================================
-- OXXOVO seasons -- Theme Hybrid (season_theme + main_round_twist) 2026-06
-- Run in Supabase SQL Editor.
--
-- Adds the hybrid theme model:
--   season_theme     TEXT  -- PUBLIC theme, shown openly from day one.
--   main_round_twist TEXT  -- SECRET twist, revealed only at the announcement
--                             time (main_round_start_at minus
--                             theme_announcement_minutes_before). The existing
--                             main_round_theme column is the deprecated
--                             fallback and is NOT dropped (ADD-only).
--
-- SECURITY (the point of this migration): main_round_twist (and the legacy
-- main_round_theme it falls back to) must never reach a client before reveal.
-- Today BOTH anon and authenticated can read every seasons column directly with
-- the public key. We close the public/anon vector at the DB layer with a
-- column-filtered view + a REVOKE, so the browser literally cannot fetch the
-- secret -- code-level stripping alone is useless because the publishable key
-- is in the bundle and anyone could query the column directly.
--
-- Rollout is split so nothing breaks mid-deploy:
--   PART 1  additive + safe -- run ANY time (before or after deploy).
--   PART 2  the breaking REVOKE -- run ONLY AFTER the app deploy that repoints
--           getSeasonById() to the seasons_public view.
--
-- ASCII-only. Idempotent where possible.
-- =========================================================================


-- =========================================================================
-- PART 1  (safe / additive -- run any time)
-- =========================================================================
BEGIN;

-- 1. Columns
ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS season_theme     TEXT;
ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS main_round_twist TEXT;

-- 2. Public read view -- every seasons column EXCEPT the two secret ones
--    (main_round_theme, main_round_twist). season_theme IS included (public).
--
--    *** MAINTENANCE ***  This list is explicit on purpose (column security).
--    When a new seasons column is added, add it here too, or the public site
--    will not see it. New SECRET columns must be left OUT.
--
--    security_invoker is left at the default (off): the view runs as its owner
--    so anon can read it WITHOUT any privilege on the base table.
CREATE OR REPLACE VIEW public.seasons_public AS
  SELECT
    id, name, season_number, status,
    max_applicants, top_n_advance,
    application_video_min_seconds, application_video_max_seconds,
    total_prize_pool, entry_fee,
    main_round_video_seconds, theme_announcement_minutes_before, submission_hours,
    community_vote_weight, ai_score_weight,
    scoring_intent_clarity_weight, scoring_execution_weight,
    scoring_originality_weight, scoring_integrity_weight,
    ai_models,
    flag_integrity_threshold, flag_spread_threshold,
    application_open_at, application_close_at, scoring_complete_at,
    main_round_start_at, main_round_end_at, awards_announcement_at,
    created_at, updated_at,
    prize_first_pct, prize_second_pct, prize_third_pct,
    prize_first, prize_second, prize_third,
    display_name,
    main_round_video_min_seconds, main_round_video_max_seconds,
    deadline_reminder_hours, award_prizes,
    flag_integrity_high_threshold, flag_integrity_medium_threshold,
    flag_integrity_low_threshold,
    season_theme,
    allowed_video_platforms, scoring_start_at,
    host_type, host_user_id,
    prize_pool_escrow_status, prize_pool_escrow_paid_at,
    commission_rate_override, prize_funding_mode,
    poster_url, lobby_featured
  FROM public.seasons;

-- 3. Public roles read the VIEW (never the base table).
GRANT SELECT ON public.seasons_public TO anon, authenticated;

-- Ask PostgREST to pick up the new view immediately.
NOTIFY pgrst, 'reload schema';

COMMIT;


-- =========================================================================
-- PART 2  (BREAKING -- run ONLY AFTER the app deploy that points
--          getSeasonById() at seasons_public)
--
-- Removes anon's direct read of the base seasons table. After this, the public
-- key can no longer fetch main_round_twist / main_round_theme at all; the only
-- public read path is the secret-free seasons_public view.
--
-- authenticated KEEPS base access here so the admin console (which reads
-- seasons through the authenticated session) is untouched. Closing the
-- authenticated-token vector as well requires moving the admin seasons reads to
-- the service-role client first -- see the OPTIONAL block below.
-- =========================================================================
BEGIN;

REVOKE SELECT ON public.seasons FROM anon;

COMMIT;


-- =========================================================================
-- OPTIONAL  full lockdown (authenticated contestants too) -- DO NOT RUN YET
--
-- A logged-in user can still read seasons.main_round_twist directly with their
-- own token, because the admin console reads seasons through the authenticated
-- role. To close that, FIRST switch every admin seasons read to the
-- service-role client (app/admin/seasons/{page,[id]/page,new/page,actions}.ts),
-- deploy, and ONLY THEN run:
--
--   REVOKE SELECT ON public.seasons FROM authenticated;
--
-- Those files overlap the 지수2 platform-internal season-creation sprint, so
-- this is intentionally deferred to coordinate and avoid a merge collision.
-- =========================================================================


-- =========================================================================
-- Verification
-- =========================================================================

-- 1) Columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons'
  AND column_name IN ('season_theme', 'main_round_twist', 'main_round_theme')
ORDER BY column_name;

-- 2) View excludes the secrets -- main_round_theme / main_round_twist absent
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons_public'
  AND column_name IN ('season_theme', 'main_round_theme', 'main_round_twist');
-- expect a single row: season_theme

-- 3) After PART 2 -- anon grant on base seasons should be GONE
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'seasons'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;
