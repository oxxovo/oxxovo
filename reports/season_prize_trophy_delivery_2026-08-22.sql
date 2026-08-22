-- HQ 2026-08-22: prize/trophy delivery target-date columns -- NEW, did not
-- exist before. Both GENERATED ALWAYS AS STORED from awards_announcement_at
-- (same pattern already live on this table for prize_first/second/third,
-- computed from total_prize_pool * prize_*_pct / 100) -- not a fixed literal,
-- so a future schedule defer (which already shifts awards_announcement_at)
-- carries these forward automatically, no defer_season_schedule edit needed.
--
-- season_0 target: prize money 11/28 (awards + 10 days), champion trophy
-- 12/18 (awards + 30 days). Derived against HEAD 3e95a24; live
-- awards_announcement_at = 2026-11-19T01:00:00+00 (2026-11-18 17:00 PT,
-- set by BLOCK 0-2 of reports/season0_schedule_finalize_2026-08-22.sql,
-- already run) -- confirmed by BLOCK 0 below.
--
-- Base-table only (not on seasons_public) -- internal ops tracking, not
-- client-facing yet.
--
-- ASCII only. LF only.
-- =========================================================================


-- =========================================================================
-- BLOCK 0 -- CONFIRM before touching anything. Read-only. Run alone.
--
-- EXPECT: has_prize_delivery_col = false, has_trophy_delivery_col = false
--   (the columns BLOCK 1 adds), awards_announcement_at =
--   2026-11-19T01:00:00+00 (2026-11-18 17:00 PT).
-- =========================================================================
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons'
              AND column_name = 'prize_delivery_at')                       AS has_prize_delivery_col,
  EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'seasons'
              AND column_name = 'trophy_delivery_at')                      AS has_trophy_delivery_col,
  (SELECT awards_announcement_at FROM public.seasons WHERE id = 'season_0') AS season_0_awards_announcement_at;


-- =========================================================================
-- BLOCK 1 -- add the two generated columns. Run alone, after BLOCK 0
-- confirms. Table-rewrite ALTER (generated columns need every existing row
-- computed) -- harmless, `seasons` has a handful of rows.
-- =========================================================================
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS prize_delivery_at TIMESTAMPTZ
    GENERATED ALWAYS AS (awards_announcement_at + INTERVAL '10 days') STORED,
  ADD COLUMN IF NOT EXISTS trophy_delivery_at TIMESTAMPTZ
    GENERATED ALWAYS AS (awards_announcement_at + INTERVAL '30 days') STORED;

-- Verify BLOCK 1 (read-only):
SELECT column_name, data_type, is_generated, generation_expression
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons'
  AND column_name IN ('prize_delivery_at', 'trophy_delivery_at');
-- expect: 2 rows, both is_generated='ALWAYS', generation_expression showing
-- the +10 / +30 day interval.


-- =========================================================================
-- BLOCK 2 -- verify season_0's computed values (read-only, PT + structural
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
-- Generated columns, so this is a straight DROP (nothing else can depend on
-- a column this new).
-- =========================================================================
-- ALTER TABLE public.seasons
--   DROP COLUMN IF EXISTS prize_delivery_at,
--   DROP COLUMN IF EXISTS trophy_delivery_at;
