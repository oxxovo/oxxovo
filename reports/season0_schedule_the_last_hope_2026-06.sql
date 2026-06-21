-- ===========================================================================
-- SEASON 0 schedule + naming -- THE LAST HOPE  (3rd priority, step 1)
-- ===========================================================================
-- Sets the season_0 competition calendar and fixes the name collision:
--   * season_0 was codenamed GENESIS; GENESIS now belongs to season_1.
--   * season_0 identity = THE LAST HOPE (TK + 메인 제니, 2026-06-20).
--   * "THE LAST HOPE" goes in name only (TK choice). Preliminary round is
--     free-form (자유작) so season_theme stays NULL -- no round theme to reveal.
--
-- Schedule is written in Pacific wall-clock and converted with
-- AT TIME ZONE 'America/Los_Angeles' so DST (PDT in Sep = UTC-7) is automatic.
-- No hardcoded UTC. See [[feedback-no-hardcode]].
--
-- status: season_0 is currently 'active' but has no open date. Set it to
-- 'draft' so it is NOT prematurely open. season-tick (hourly) flips it to
-- 'active' at application_open_at (7/1 00:00 PT) via forward-only CAS.
-- Verified against app/api/cron/season-tick/route.ts (desiredStatus +
-- STATUS_RANK forward-only). 1 row in season_0 = "tk test" (TK's own test),
-- no real applicants, so the draft move is safe.
--
-- Style: ASCII only, no box-drawing chars, no DO $$ dollar-quote blocks
-- (Supabase SQL Editor 42601 trap). One transaction. See
-- [[feedback-sql-ascii-only]].
-- ===========================================================================

BEGIN;

-- 1. season_0 = THE LAST HOPE -- schedule + identity + status
UPDATE public.seasons SET
  name         = 'THE LAST HOPE',
  display_name = 'OXXOVO Season 0: The Last Hope',
  season_theme = NULL,                       -- preliminary = free-form, no theme
  status       = 'draft',                    -- cron opens it at 7/1 00:00 PT

  -- Calendar (Pacific wall-clock -> timestamptz, DST-safe)
  application_open_at    = TIMESTAMP '2026-07-01 00:00' AT TIME ZONE 'America/Los_Angeles',
  application_close_at   = TIMESTAMP '2026-08-30 23:59' AT TIME ZONE 'America/Los_Angeles',
  scoring_start_at       = TIMESTAMP '2026-08-31 00:00' AT TIME ZONE 'America/Los_Angeles',
  scoring_complete_at    = TIMESTAMP '2026-09-02 00:00' AT TIME ZONE 'America/Los_Angeles',
  main_round_start_at    = TIMESTAMP '2026-09-03 00:00' AT TIME ZONE 'America/Los_Angeles',
  main_round_end_at      = TIMESTAMP '2026-09-05 00:00' AT TIME ZONE 'America/Los_Angeles',
  awards_announcement_at = TIMESTAMP '2026-09-06 21:00' AT TIME ZONE 'America/Los_Angeles',
  submission_hours       = 48,

  -- Advancement policy (prelim -> main round): top 10%, clamp 10..50
  advance_pct  = 0.1,
  advance_min  = 10,
  advance_max  = 50,

  updated_at = now()
WHERE id = 'season_0';

-- 2. season_1 = GENESIS -- name only (9/28 dates already applied 2026-06-20).
--    Was still "SEASON_1" placeholder; GENESIS moves here from season_0.
UPDATE public.seasons SET
  name         = 'GENESIS',
  display_name = 'OXXOVO Genesis Season 1',
  updated_at   = now()
WHERE id = 'season_1';

COMMIT;

-- ===========================================================================
-- Verification (run AFTER commit) -- expect the values shown in comments
-- ===========================================================================
SELECT id, season_number, name, display_name, season_theme, status,
       application_open_at, application_close_at, scoring_start_at,
       scoring_complete_at, main_round_start_at, main_round_end_at,
       awards_announcement_at, submission_hours,
       advance_pct, advance_min, advance_max
FROM public.seasons
WHERE id IN ('season_0', 'season_1')
ORDER BY season_number;

-- Expected (UTC, since PDT = UTC-7 in Sep / PDT = UTC-7 in Jul-Aug):
--   season_0  name=THE LAST HOPE  status=draft  season_theme=NULL
--     application_open_at    2026-07-01 07:00+00
--     application_close_at   2026-08-31 06:59+00
--     scoring_start_at       2026-08-31 07:00+00
--     scoring_complete_at    2026-09-02 07:00+00
--     main_round_start_at    2026-09-03 07:00+00
--     main_round_end_at      2026-09-05 07:00+00
--     awards_announcement_at 2026-09-07 04:00+00
--     submission_hours=48  advance_pct=0.1 advance_min=10 advance_max=50
--   season_1  name=GENESIS  status=draft  (9/28 dates unchanged)
