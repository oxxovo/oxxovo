-- ============================================================================
-- main_round_theme -> PUBLIC (Watch teaser) 2026-07
-- ============================================================================
-- Decision (TK 2026-07-12, "A"): the main-round theme is a PUBLIC brief shown
-- to the audience from the "Judging Complete" stage onward, as a come-back
-- teaser ("Next Round: OXXOVO Beauty CF"). It is NOT a surprise. Any future
-- surprise element uses main_round_twist (a separate SECRET column that stays
-- off this view and keeps the 60-min reveal gate).
--
-- This REVERSES the earlier theme-hybrid posture for main_round_theme only:
-- previously main_round_theme was kept OFF seasons_public (treated as a secret).
-- We now expose main_round_theme on the public view so the fixed-anon client
-- (Watch, via getCurrentSeason -> seasons_public) can read it. We ALSO expose
-- community_vote_start_at / community_vote_end_at (a schedule, not a secret) for
-- the Watch voting banner stage.
--
-- main_round_twist stays OUT of the view (still secret). season_theme stays as
-- is (vestigial #6 column, unused).
--
-- IMPORTANT (fixes the 42P16 "cannot drop columns from view" error): the three
-- new columns are APPENDED AT THE END of the existing 62-column list, in the
-- same order, so CREATE OR REPLACE VIEW only ADDS columns (never reorders or
-- drops). The 62 columns below were read from the LIVE view, so nothing that
-- the app currently reads is lost.
--
-- Safe on production: every existing season has main_round_theme = NULL, so
-- nothing leaks the moment this runs. Idempotent. Run in Supabase SQL editor.
-- ============================================================================

BEGIN;

-- Existing 62 columns (verbatim, in order) + 3 appended at the end.
-- MAINTENANCE: when a new seasons column is added, append it here too. New
-- SECRET columns (like main_round_twist) must stay OUT.
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
    poster_url, lobby_featured,
    min_participants, application_defer_count,
    defer_extension_days, max_defer_count,
    advance_pct, advance_min, advance_max,
    -- NEW (appended at end):
    main_round_theme,
    community_vote_start_at, community_vote_end_at
  FROM public.seasons;

GRANT SELECT ON public.seasons_public TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================================
-- Verification
-- ============================================================================
-- Expect the 3 new columns present on the view (main_round_twist must NOT be).
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons_public'
  AND column_name IN (
    'main_round_theme', 'main_round_twist',
    'community_vote_start_at', 'community_vote_end_at', 'season_theme'
  )
ORDER BY column_name;
-- expect 4 rows: community_vote_end_at, community_vote_start_at,
--                main_round_theme, season_theme   (NOT main_round_twist)
