-- ===========================================================================
-- 2026 Launch Policy -- seasons 1-4 entry fee + Studio credit margin
-- ===========================================================================
-- Source: TK final pricing decision 2026-06-25 (replaces 60/20/20 + $1,000 floor).
--
-- What changes here (DB):
--   1. seasons 1-4 entry_fee = 50 (USD). They were cloned from Season 0 (free)
--      so entry_fee is currently 0; set the real launch entry fee.
--   2. platform_config.studio_margin_rate 0.40 -> 0.25 (Studio credit pricing).
--
-- What does NOT change here (governed by docs / generated columns, no DB knob):
--   * Entry-fee split (pool / WC / OXXOVO). 2026 Launch = 100% pool (WC 0, ops 0);
--     2027+ Standard = 60 / 20 / 20. This split is an accounting policy, not a
--     stored column -- total_prize_pool is set per season, not auto-derived from
--     entry revenue. Documented in reports/regular_season_rules_2026-06.md sec 7.
--   * 1st-place floor $1,500 (was $1,000). Also doc-governed, not a column; the
--     old floor was never stored either. Break-even 50 entries @ $50 -> pool
--     $2,500 x 60% = $1,500.
--   * Within-pool rank split prize_first/second/third_pct = 60/25/15. Unchanged
--     from Season 0; the new policy keeps the same 60/25/15. Verified read-only
--     below (expect no change needed).
--   * commission_rate_override stays NULL for official seasons (it is a
--     partner-host knob, not the official fee split).
--
-- Safety: official upcoming teasers only. /apply is date-gated and getCurrentSeason
-- still targets Season 0, so no applications are affected. ADD/UPDATE only,
-- idempotent (re-runnable), ASCII-only. Run in the Supabase SQL editor.
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Seasons 1-4 entry fee = 50 (official teasers only)
-- ---------------------------------------------------------------------------
UPDATE public.seasons
SET entry_fee  = 50,
    updated_at = now()
WHERE id IN ('season_1', 'season_2', 'season_3', 'season_4')
  AND host_type = 'official';

-- ---------------------------------------------------------------------------
-- 2. Studio credit margin 0.40 -> 0.25 (platform_config)
--    Consumed by lib/credits.ts creditsForCost: charge = cost x (1 + margin).
--    Update only if the key exists (it was seeded by studio_phase1 migration).
-- ---------------------------------------------------------------------------
UPDATE public.platform_config
SET value = '0.25'
WHERE key = 'studio_margin_rate';

COMMIT;

-- ===========================================================================
-- Verification (run AFTER commit)
-- ===========================================================================

-- 1) Entry fees -- expect season_1..4 entry_fee = 50, season_0 = 0.
SELECT id, season_number, name, status, host_type, entry_fee, total_prize_pool
FROM public.seasons
WHERE id IN ('season_0', 'season_1', 'season_2', 'season_3', 'season_4')
ORDER BY season_number;

-- 2) Within-pool rank split -- expect 60 / 25 / 15 across all (no change needed).
SELECT id, season_number, prize_first_pct, prize_second_pct, prize_third_pct
FROM public.seasons
WHERE id IN ('season_0', 'season_1', 'season_2', 'season_3', 'season_4')
ORDER BY season_number;

-- 3) Credit margin -- expect 1 row, value = 0.25.
SELECT key, value, value_type
FROM public.platform_config
WHERE key = 'studio_margin_rate';
