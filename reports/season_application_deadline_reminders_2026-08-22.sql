-- HQ 2026-08-22 (item 4): registration-deadline reminder -> video-deadline
-- reminder. New column application_deadline_reminder_hours (INT[]), season_0
-- value [168, 72, 24, 6] = D-7/3/1/6h before application_close_at (the VIDEO
-- submission hard-cut, NOT registration_close_at). Recipients = registrants
-- only (code-side filter, see app/api/cron/email-tick/route.ts
-- fireApplicationDeadline). Old registration_reminder_days ([14,7,3,1] off
-- registration_close_at) is RETIRED in code (nothing calls it any more,
-- reports/season0_schedule_finalize... unaffected) -- TK: "the registration
-- deadline itself is not announced by email, the Watch countdown covers it."
-- Left in the DB as-is, not nulled -- harmless, nothing reads it.
--
-- Derived against HEAD a3f6c93. Live application_close_at =
-- 2026-11-05T01:00:00+00 (2026-11-04 17:00 PT).
--
-- Base-table only -- internal cron config, not client-facing.
--
-- ASCII only. LF only.
-- =========================================================================


-- =========================================================================
-- BLOCK 0 -- CONFIRM before touching anything. Read-only. Run alone.
--
-- EXPECT: has_col = false, application_close_at = 2026-11-05T01:00:00+00,
--   registration_reminder_days = [14,7,3,1] (untouched, just for the record).
-- =========================================================================
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons'
              AND column_name = 'application_deadline_reminder_hours')      AS has_col,
  application_close_at,
  registration_reminder_days
FROM public.seasons
WHERE id = 'season_0';


-- =========================================================================
-- BLOCK 1 -- add the column + set season_0's value. Run alone, after
-- BLOCK 0 confirms.
-- =========================================================================
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS application_deadline_reminder_hours INT[];

WITH upd AS (
  UPDATE public.seasons
  SET
    application_deadline_reminder_hours = ARRAY[168, 72, 24, 6],
    updated_at = now()
  WHERE id = 'season_0'
    AND application_deadline_reminder_hours IS NULL
  RETURNING id, application_deadline_reminder_hours, application_close_at
)
SELECT * FROM upd;
-- expect: exactly 1 row. If 0 rows, the column already had a value -- stop,
-- something else set it first.


-- =========================================================================
-- BLOCK 2 -- verify (read-only): fire times in PT, computed independently
-- of the app's Luxon code via Postgres's own DST-aware timestamp<->timestamptz
-- round-trip (AT TIME ZONE twice -- convert to naive LA wall-clock, subtract
-- calendar days there where the offset is a whole multiple of 24h, convert
-- back). This is the SQL-side cross-check that the D-7 entry lands on 17:00
-- PT and not 18:00 -- a plain "timestamptz - interval" would get that one
-- wrong across the Nov 1 DST boundary (see app-side comment on
-- applicationDeadlineReminderFireTimes, lib/seasons.ts).
-- =========================================================================
WITH s AS (
  SELECT application_close_at, application_deadline_reminder_hours AS hrs
  FROM public.seasons WHERE id = 'season_0'
),
expanded AS (
  SELECT
    h,
    CASE
      WHEN h >= 24 AND h % 24 = 0
        THEN ((application_close_at AT TIME ZONE 'America/Los_Angeles') - ((h / 24) || ' days')::interval)
               AT TIME ZONE 'America/Los_Angeles'
      ELSE ((application_close_at AT TIME ZONE 'America/Los_Angeles') - (h || ' hours')::interval)
             AT TIME ZONE 'America/Los_Angeles'
    END AS fire_at
  FROM s CROSS JOIN unnest(hrs) AS h
)
SELECT h AS hours_before, fire_at AT TIME ZONE 'America/Los_Angeles' AS fire_at_pt
FROM expanded
ORDER BY h DESC;
-- expect 4 rows: 168 -> 2026-10-28 17:00, 72 -> 2026-11-01 17:00,
-- 24 -> 2026-11-03 17:00, 6 -> 2026-11-04 11:00 (all PT).


-- =========================================================================
-- REVERT -- do NOT run with the blocks above. Separate action only.
-- =========================================================================
-- ALTER TABLE public.seasons
--   DROP COLUMN IF EXISTS application_deadline_reminder_hours;
