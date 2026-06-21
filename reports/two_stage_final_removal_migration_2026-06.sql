-- ===========================================================================
-- 2-STAGE TRANSITION -- remove the FINAL (3rd) stage from the DB  (PR C)
-- ===========================================================================
-- Tournament is now two judged stages: preliminary (application) -> main round
-- -> 1/2/3 awards. The final (결승) stage is removed everywhere.
--
-- *** RUN ORDER -- READ FIRST ***
--   Run this ONLY AFTER the code PRs (A: core, B: studio/compose) are MERGED and
--   DEPLOYED to production. Until then the running build still reads these
--   columns; dropping them first would cause runtime errors. Final-stage data is
--   0 rows (verified 2026-06-20), so this is non-destructive in practice.
--
-- Constraints/style: ASCII only, no box-drawing chars, no DO $$ dollar-quote
-- blocks (Supabase SQL Editor 42601 trap). One transaction so the view is never
-- missing mid-run. See [[feedback-sql-ascii-only]] / [[feedback-seasons-public-view]].
-- ===========================================================================

BEGIN;

-- 1. Drop the public view first so the final_* columns lose their dependency.
--    (CREATE OR REPLACE VIEW cannot DROP columns -- a full DROP + CREATE is
--    required to shrink the column list.)
DROP VIEW IF EXISTS public.seasons_public;

-- 2. genesis_applications status CHECK: 11 -> 9 values
--    (remove final_selected, final_submitted). soak is intentionally NOT a
--    status value here -- it never was in this constraint.
ALTER TABLE public.genesis_applications
  DROP CONSTRAINT IF EXISTS genesis_applications_status_check;
ALTER TABLE public.genesis_applications
  ADD CONSTRAINT genesis_applications_status_check
    CHECK (status IN (
      'pending',
      'waitlist',
      'verifying',
      'flagged',
      'eligible',
      'selected',               -- main round (본선) advance = Finalist
      'main_round_submitted',   -- main round video submitted
      'awarded',
      'rejected'
    ));

-- 3. scoring_results round CHECK: drop 'final'.
--    Single round CHECK named scoring_results_round_check (verified 2026-06-13).
ALTER TABLE public.scoring_results
  DROP CONSTRAINT IF EXISTS scoring_results_round_check;
ALTER TABLE public.scoring_results
  ADD CONSTRAINT scoring_results_round_check
    CHECK (round IN ('application', 'main'));

-- 4. Drop the final-stage columns.
ALTER TABLE public.seasons
  DROP COLUMN IF EXISTS final_n,
  DROP COLUMN IF EXISTS final_start_at,
  DROP COLUMN IF EXISTS final_end_at;
ALTER TABLE public.genesis_applications
  DROP COLUMN IF EXISTS final_video_url,
  DROP COLUMN IF EXISTS final_submitted_at,
  DROP COLUMN IF EXISTS studio_final_render_id,
  DROP COLUMN IF EXISTS studio_final_job_id,
  DROP COLUMN IF EXISTS studio_final_signature;

-- 5. Recreate seasons_public WITHOUT final_n/final_start_at/final_end_at.
--    Same column order as before, minus the three final columns at the tail.
--    Secret columns (main_round_twist/main_round_theme) stay excluded.
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
    -- advancement + deferral policy (2-stage); no final_* columns
    min_participants, application_defer_count, defer_extension_days, max_defer_count,
    advance_pct, advance_min, advance_max
  FROM public.seasons;

GRANT SELECT ON public.seasons_public TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ===========================================================================
-- Verification (run AFTER commit)
-- ===========================================================================
-- 1) final columns gone from seasons
SELECT column_name FROM information_schema.columns
WHERE table_name = 'seasons'
  AND column_name IN ('final_n','final_start_at','final_end_at');   -- expect 0 rows

-- 2) final columns gone from genesis_applications
SELECT column_name FROM information_schema.columns
WHERE table_name = 'genesis_applications'
  AND column_name IN ('final_video_url','final_submitted_at',
                      'studio_final_render_id','studio_final_job_id','studio_final_signature');  -- expect 0 rows

-- 3) status CHECK = 9 values, no final_*
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.genesis_applications'::regclass
  AND conname = 'genesis_applications_status_check';

-- 4) round CHECK = application/main only
SELECT pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.scoring_results'::regclass
  AND conname = 'scoring_results_round_check';

-- 5) view no longer exposes final_*
SELECT column_name FROM information_schema.columns
WHERE table_name = 'seasons_public'
  AND column_name LIKE 'final%';   -- expect 0 rows
