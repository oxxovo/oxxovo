-- =========================================================================
-- OXXOVO Studio -- fal spend guards (platform_config keys).  2026-07-05
-- =========================================================================
-- Participants pre-pay for their own generations (welcome credits are retired),
-- so these are NOT a subsidy cap. They are:
--   1. studio_daily_budget_usd    -- circuit breaker: pause new generations once
--                                    today's fal spend (SUM actual_cost_usd) hits
--                                    this. Catches runaway bugs / abuse spikes.
--   2. studio_fal_deposit_usd      -- cumulative USD deposited into fal. TK bumps
--                                    this on every fal top-up. Initial = 1500.
--   3. studio_fal_min_balance_usd  -- low-water: pause when the estimated remaining
--                                    prepaid (deposit - all-time spend) drops to
--                                    this, so a mid-crush balance-zero never stalls
--                                    ALL generation silently. Top up + bump #2.
--
-- The worker reads these live (config.ts). Absent keys = guard OFF (numOpt), so
-- this migration only ACTIVATES the guards; the worker runs safely without it.
--
-- ASCII-only. Idempotent UPSERT. No dollar-quote blocks.
-- See [[project-studio-season0-full-load]] / [[feedback-sql-ascii-only]].
-- =========================================================================

INSERT INTO public.platform_config (key, value, value_type, description) VALUES
  ('studio_daily_budget_usd', '500', 'decimal',
   'Circuit breaker: pause new Studio generations once today fal spend (SUM actual_cost_usd) reaches this USD. Anomaly guard, not a subsidy cap.'),
  ('studio_fal_deposit_usd', '1500', 'decimal',
   'Cumulative USD deposited into the fal account. Bump this on every fal top-up. Used with all-time spend to estimate remaining prepaid balance.'),
  ('studio_fal_min_balance_usd', '100', 'decimal',
   'Low-water: pause new generations when estimated remaining fal prepaid (deposit - all-time spend) drops to this USD. Prevents a silent mid-crush stall.')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  value_type = EXCLUDED.value_type,
  description = EXCLUDED.description,
  updated_at = now();

-- Verification -- expect 3 rows.
SELECT key, value, value_type
FROM public.platform_config
WHERE key IN ('studio_daily_budget_usd', 'studio_fal_deposit_usd', 'studio_fal_min_balance_usd')
ORDER BY key;
