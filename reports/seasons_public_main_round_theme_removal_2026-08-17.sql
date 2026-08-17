-- Removes main_round_theme (the deprecated 901-char full brief, which has the
-- required-element/twist sentence embedded in prose) from seasons_public.
-- main_round_theme_label (the short display label) stays -- TK ruled it
-- intentionally public, not a leak. Valid under either theme/twist gate
-- design discussed this week; not tied to today's ThemeBanner change.

-- STEP 1: redefine the view without main_round_theme
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
  main_round_theme_label,
  community_vote_start_at, community_vote_end_at,
  is_fixture,
  prelim_results_announcement_at,
  registration_close_at
FROM public.seasons;

-- STEP 2: grant safety net (REPLACE preserves it normally; explicit anyway)
GRANT SELECT ON public.seasons_public TO anon, authenticated;

-- STEP 3: verify -- main_round_theme gone
SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seasons_public' AND column_name = 'main_round_theme';

-- STEP 4: verify -- main_round_theme_label still there
SELECT id, main_round_theme_label FROM public.seasons_public WHERE id = 'season_0';
