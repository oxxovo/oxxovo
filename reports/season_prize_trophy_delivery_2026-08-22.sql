-- HQ 2026-08-22: prize/trophy delivery target-date columns -- REVISED. The
-- first attempt (GENERATED ALWAYS AS (awards_announcement_at + INTERVAL
-- '10 days') STORED) FAILED when run:
--   ERROR: generation expression is not immutable
-- Root cause: `timestamptz + interval` routes through Postgres's
-- timestamptz_pl_interval, which is declared STABLE (calendar/DST-aware --
-- adding "N days" has to know the session timezone to cross DST correctly),
-- not IMMUTABLE. Generated columns require an immutable expression.
-- prize_first/second/third (the precedent this borrowed from) work because
-- their expression is pure numeric multiplication (total_prize_pool *
-- prize_*_pct / 100) -- genuinely immutable, no timezone involved. Date
-- arithmetic against a timestamptz is a different category; there is no
-- immutable equivalent to reach for here.
--
-- FIX: plain (non-generated) columns, kept in sync by a BEFORE INSERT OR
-- UPDATE OF awards_announcement_at trigger. Same guarantee (a future
-- defer_season_schedule shift, or any other UPDATE of awards_announcement_at,
-- carries these two forward automatically, no separate edit needed anywhere)
-- -- just a trigger instead of a generated-column expression, because
-- Postgres's immutability rule leaves no generated-column path for
-- timezone-aware date math.
--
-- season_0 target unchanged: prize money 11/28 (awards + 10 days), champion
-- trophy 12/18 (awards + 30 days). Derived against HEAD b9d1e35; live
-- awards_announcement_at = 2026-11-19T01:00:00+00 (2026-11-18 17:00 PT).
--
-- Base-table only (not on seasons_public) -- internal ops tracking, not
-- client-facing yet.
--
-- ASCII only. LF only.
-- =========================================================================


-- =========================================================================
-- BLOCK 0 -- CONFIRM before touching anything. Read-only. Run alone.
--
-- EXPECT: has_prize_delivery_col = false, has_trophy_delivery_col = false,
--   has_trigger = false (the failed attempt should have left nothing behind
--   -- a rejected CREATE/ALTER does not partially apply), awards_announcement_at
--   = 2026-11-19T01:00:00+00 (2026-11-18 17:00 PT). If either column already
--   exists, STOP and report back before running BLOCK 1 -- do not assume the
--   failed attempt left a clean slate.
-- =========================================================================
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons'
              AND column_name = 'prize_delivery_at')                       AS has_prize_delivery_col,
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons'
              AND column_name = 'trophy_delivery_at')                      AS has_trophy_delivery_col,
  EXISTS (SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_season_delivery_dates'
              AND tgrelid = 'public.seasons'::regclass)                    AS has_trigger,
  (SELECT awards_announcement_at FROM public.seasons WHERE id = 'season_0') AS season_0_awards_announcement_at;


-- =========================================================================
-- BLOCK 1 -- add the two plain columns. Run alone, after BLOCK 0 confirms.
-- =========================================================================
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS prize_delivery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trophy_delivery_at TIMESTAMPTZ;

-- Verify BLOCK 1 (read-only):
SELECT column_name, data_type, is_generated
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons'
  AND column_name IN ('prize_delivery_at', 'trophy_delivery_at');
-- expect: 2 rows, both is_generated='NEVER' (plain columns this time).


-- =========================================================================
-- BLOCK 2 -- trigger function + trigger. Fires on INSERT and on any UPDATE
-- that touches awards_announcement_at (including a future defer), so the two
-- columns can never drift from it. Run alone, after BLOCK 1.
-- =========================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.set_season_delivery_dates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.prize_delivery_at := NEW.awards_announcement_at + INTERVAL '10 days';
  NEW.trophy_delivery_at := NEW.awards_announcement_at + INTERVAL '30 days';
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trg_season_delivery_dates ON public.seasons;
CREATE TRIGGER trg_season_delivery_dates
  BEFORE INSERT OR UPDATE OF awards_announcement_at ON public.seasons
  FOR EACH ROW
  EXECUTE FUNCTION public.set_season_delivery_dates();

COMMIT;

-- Verify BLOCK 2 (read-only):
SELECT tgname, tgenabled FROM pg_trigger
WHERE tgname = 'trg_season_delivery_dates' AND tgrelid = 'public.seasons'::regclass;
-- expect: 1 row, tgenabled='O' (origin -- enabled).


-- =========================================================================
-- BLOCK 3 -- backfill existing rows. The trigger only fires on INSERT/UPDATE
-- from here forward; it does not retroactively populate rows already in the
-- table. A self-assign UPDATE (same value, no semantic change) fires
-- "UPDATE OF awards_announcement_at" for every row and lets the trigger fill
-- both columns from whatever that row's awards_announcement_at already is
-- (including NULL, for seasons that don't have one yet -- both delivery
-- columns land NULL too, which is correct). Run alone, after BLOCK 2.
-- =========================================================================
WITH upd AS (
  UPDATE public.seasons
  SET awards_announcement_at = awards_announcement_at
  RETURNING id, awards_announcement_at, prize_delivery_at, trophy_delivery_at
)
SELECT * FROM upd ORDER BY id;
-- expect: every season_* row present; season_0's prize_delivery_at /
-- trophy_delivery_at now populated (see BLOCK 4 for the PT check).


-- =========================================================================
-- BLOCK 4 -- verify season_0's computed values (read-only, PT + structural
-- check that the two are exactly 10/30 days after awards_announcement_at).
-- =========================================================================
SELECT
  awards_announcement_at AT TIME ZONE 'America/Los_Angeles' AS awards_pt,
  prize_delivery_at      AT TIME ZONE 'America/Los_Angeles' AS prize_delivery_pt,
  trophy_delivery_at     AT TIME ZONE 'America/Los_Angeles' AS trophy_delivery_pt,
  (prize_delivery_at  = awards_announcement_at + INTERVAL '10 days') AS prize_10d_holds,
  (trophy_delivery_at = awards_announcement_at + INTERVAL '30 days') AS trophy_30d_holds
FROM public.seasons
WHERE id = 'season_0';
-- expect: awards_pt = 2026-11-18 17:00, prize_delivery_pt = 2026-11-28 17:00,
-- trophy_delivery_pt = 2026-12-18 17:00, both booleans = true.


-- =========================================================================
-- REVERT -- do NOT run with the blocks above. Separate action only.
-- =========================================================================
-- DROP TRIGGER IF EXISTS trg_season_delivery_dates ON public.seasons;
-- DROP FUNCTION IF EXISTS public.set_season_delivery_dates();
-- ALTER TABLE public.seasons
--   DROP COLUMN IF EXISTS prize_delivery_at,
--   DROP COLUMN IF EXISTS trophy_delivery_at;
