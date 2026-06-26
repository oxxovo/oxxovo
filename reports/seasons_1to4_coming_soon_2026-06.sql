-- ===========================================================================
-- Seasons 1-4 "COMING SOON" teaser cards (home lobby)
-- ===========================================================================
-- Goal: show Seasons 1-4 as "COMING SOON" teaser cards in the home TOURNAMENTS
-- lobby WITHOUT accepting any applications, with zero impact on Season 0.
--
-- How the lobby decides what to show (server-authoritative, lib/lobby.ts):
--   * a row appears as a card when host_type = 'official' AND status <> 'draft'
--   * card MODE is derived from the schedule, not the status string:
--       - no application_open_at OR now < open  -> 'upcoming'  => "COMING SOON"
--         + "Pre-register" CTA (links to /pre-register, NEVER /apply)
--       - open <= now < close                   -> 'accepting' => "OPEN" + Apply
--   * status 'upcoming' is a teaser tier between draft and active. The weekly
--     season cron (app/api/cron/season-tick) now ranks it draft<upcoming<active,
--     so it is never regressed to draft, and is auto-promoted to 'active' only
--     when its application_open_at actually arrives.
--
-- Application safety (no apps accepted from teasers):
--   * getCurrentSeason() picks the season by DATE (application_open_at <= now);
--     all teasers are future/NULL, so Season 0 stays the current target.
--   * /apply is date-gated server-side (isBeforeApplicationOpen).
--   * the lobby CTA for an 'upcoming' card is Pre-register, not Apply.
--
-- Scope: 2026 lobby = Season 0 (live) + Seasons 1-4 teasers. Seasons 5/6
-- (EUPHORIA, ODYSSEY) are 2027 and intentionally NOT inserted here.
-- Dates (PT cadence, stored UTC): S1 opens 9/28, S2 10/12, S3 10/26, S4 11/9
-- (each a 7-day window). Prize pools are TBA -> 0 (card shows "Prize pool - TBA").
--
-- Idempotent: the INSERT skips ids that already exist; the UPDATE self-gates on
-- status='draft'. Safe to re-run. Run in the Supabase SQL editor.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Season 1 (GENESIS) already exists as 'draft' -> publish as a teaser.
--    Keeps its real 9/28 schedule (so its card shows a live countdown and it
--    auto-opens on 9/28 via the season cron). Prize pool TBA for now.
-- ---------------------------------------------------------------------------
UPDATE public.seasons
SET status           = 'upcoming',
    name             = 'GENESIS',
    display_name     = 'OXXOVO Season 1: Genesis',
    season_theme     = NULL,
    poster_url       = NULL,
    lobby_featured   = FALSE,
    total_prize_pool = 0,
    updated_at       = now()
WHERE id = 'season_1'
  AND status = 'draft';

-- ---------------------------------------------------------------------------
-- 2. Seasons 2-4 -> clone Season 0's full (valid) config, override the
--    teaser-specific fields. Cloning guarantees every NOT NULL / config column
--    (scoring weights, ai_models, studio, advancement policy, etc.) is sane, so
--    each season is ready to be finalized in /admin/seasons before it opens.
--    Generated columns (prize_first/second/third) are intentionally omitted.
-- ---------------------------------------------------------------------------
INSERT INTO public.seasons (
  id, name, season_number, status, display_name,
  total_prize_pool, season_theme, poster_url, lobby_featured,
  application_open_at, application_close_at,
  scoring_start_at, scoring_complete_at, main_round_start_at,
  main_round_end_at, awards_announcement_at,
  application_defer_count, updated_at,
  max_applicants, top_n_advance,
  application_video_min_seconds, application_video_max_seconds,
  entry_fee, main_round_video_seconds, theme_announcement_minutes_before,
  submission_hours, community_vote_weight, ai_score_weight,
  scoring_intent_clarity_weight, scoring_execution_weight,
  scoring_originality_weight, scoring_integrity_weight,
  ai_models, flag_integrity_threshold, flag_spread_threshold,
  prize_first_pct, prize_second_pct, prize_third_pct,
  main_round_video_min_seconds, main_round_video_max_seconds,
  deadline_reminder_hours, award_prizes,
  flag_integrity_high_threshold, flag_integrity_medium_threshold,
  flag_integrity_low_threshold,
  main_round_theme, allowed_video_platforms,
  host_type, host_user_id, prize_pool_escrow_status,
  prize_pool_escrow_paid_at, commission_rate_override, prize_funding_mode,
  main_round_twist, studio_round, studio_max_generations_per_round,
  studio_compose_enabled, studio_compose_max_seconds,
  studio_compose_max_clips, studio_compose_min_seconds,
  min_participants, defer_extension_days, max_defer_count,
  advance_pct, advance_min, advance_max
)
SELECT
  v.id, v.name, v.season_number, 'upcoming', v.display_name,
  0, NULL, NULL, FALSE,
  v.open_at, v.close_at,
  NULL, NULL, NULL,
  NULL, NULL,
  0, now(),
  s.max_applicants, s.top_n_advance,
  s.application_video_min_seconds, s.application_video_max_seconds,
  s.entry_fee, s.main_round_video_seconds, s.theme_announcement_minutes_before,
  s.submission_hours, s.community_vote_weight, s.ai_score_weight,
  s.scoring_intent_clarity_weight, s.scoring_execution_weight,
  s.scoring_originality_weight, s.scoring_integrity_weight,
  s.ai_models, s.flag_integrity_threshold, s.flag_spread_threshold,
  s.prize_first_pct, s.prize_second_pct, s.prize_third_pct,
  s.main_round_video_min_seconds, s.main_round_video_max_seconds,
  s.deadline_reminder_hours, s.award_prizes,
  s.flag_integrity_high_threshold, s.flag_integrity_medium_threshold,
  s.flag_integrity_low_threshold,
  s.main_round_theme, s.allowed_video_platforms,
  s.host_type, NULL, s.prize_pool_escrow_status,
  NULL, s.commission_rate_override, s.prize_funding_mode,
  NULL, s.studio_round, s.studio_max_generations_per_round,
  s.studio_compose_enabled, s.studio_compose_max_seconds,
  s.studio_compose_max_clips, s.studio_compose_min_seconds,
  s.min_participants, s.defer_extension_days, s.max_defer_count,
  s.advance_pct, s.advance_min, s.advance_max
FROM public.seasons s
CROSS JOIN (VALUES
  ('season_2', 'EVOLUTION', 2, 'OXXOVO Season 2: Evolution',
     TIMESTAMPTZ '2026-10-12 07:00:00+00', TIMESTAMPTZ '2026-10-19 06:59:00+00'),
  ('season_3', 'SAVOR',     3, 'OXXOVO Season 3: Savor',
     TIMESTAMPTZ '2026-10-26 07:00:00+00', TIMESTAMPTZ '2026-11-02 06:59:00+00'),
  ('season_4', 'VELOCITY',  4, 'OXXOVO Season 4: Velocity',
     TIMESTAMPTZ '2026-11-09 07:00:00+00', TIMESTAMPTZ '2026-11-16 06:59:00+00')
) AS v(id, name, season_number, display_name, open_at, close_at)
WHERE s.id = 'season_0'
  AND NOT EXISTS (SELECT 1 FROM public.seasons x WHERE x.id = v.id);

COMMIT;

-- ===========================================================================
-- Verification (run AFTER commit)
-- ===========================================================================
-- Expect: season_1..4 status='upcoming', host_type='official', all with dates,
-- total_prize_pool 0. season_0 untouched (still 'draft'). No season_5/6 rows.
SELECT id, season_number, name, display_name, status, host_type,
       total_prize_pool, application_open_at, application_close_at
FROM public.seasons
ORDER BY season_number;
