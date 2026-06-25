-- ============================================================
-- Season 0 (THE LAST HOPE): move application OPEN date 7/1 -> 7/25
-- ============================================================
-- Reason: public launch deferred to 2026-07-25 (after patent filing ~7/20),
-- per counsel. ONLY the application open date moves. Every downstream date is
-- UNCHANGED: close 8/30 23:59 PT, prelim scoring 8/31-9/1, finalists 9/2,
-- main round 9/3-9/5 (48h), awards 9/6.
--
-- Scoped to the single hand-seeded row id='season_0'. The status cron flips it
-- draft -> active at application_open_at, so this also delays the auto-open to
-- 7/25 00:00 PT. The site reads application_open_at live (no hardcode), so the
-- /tournament "Applications open" row and the apply gate follow this value.
--
-- Run in the Supabase SQL editor. Single statement + a verification SELECT.
-- ============================================================

UPDATE public.seasons
SET application_open_at = TIMESTAMP '2026-07-25 00:00' AT TIME ZONE 'America/Los_Angeles',
    updated_at = now()
WHERE id = 'season_0';

-- ------------------------------------------------------------
-- Verify: open should be 2026-07-25 07:00+00 (00:00 PDT = UTC-7).
-- close/main/awards columns must be unchanged.
-- ------------------------------------------------------------
SELECT id,
       status,
       application_open_at,
       application_close_at,
       scoring_start_at,
       scoring_complete_at,
       main_round_start_at,
       main_round_end_at,
       awards_announcement_at
FROM public.seasons
WHERE id = 'season_0';
