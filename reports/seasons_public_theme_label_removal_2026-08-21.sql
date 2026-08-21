-- HQ 2026-08-21, BLOCK 1: main_round_theme_label ("Cosmetic Commercial Film")
-- was confirmed live-leaking via the anon-readable seasons_public view (curl
-- with anon key, no login, returns it plainly). The 2026-08-17 ruling that
-- this label was "never a leak" is superseded for this specific value -- it
-- is dropped from the view here.
--
-- Verified safe to drop: no app code selects main_round_theme_label from
-- seasons_public by name (grep across lib/lobby.ts, lib/seasons.ts, e2e/) --
-- every read is either select('*') or an explicit list that never names it.
-- The one legitimate app path that reads this column
-- (lib/seasons-theme.ts getRevealedTheme) already reads the BASE seasons
-- table via the service-role client, not this view, so it is unaffected.
--
-- CREATE OR REPLACE VIEW cannot remove a column that isn't last in the list,
-- so DROP + CREATE + GRANT in one block, per HQ instruction.

DROP VIEW IF EXISTS public.seasons_public;

CREATE VIEW public.seasons_public AS
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
  community_vote_start_at, community_vote_end_at,
  is_fixture,
  prelim_results_announcement_at,
  registration_close_at
FROM public.seasons;

GRANT SELECT ON public.seasons_public TO anon, authenticated;

-- verify: main_round_theme_label is gone from the view's column list
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons_public'
  AND column_name = 'main_round_theme_label';
-- expect 0 rows
