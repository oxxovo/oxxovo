-- seasons_weight_policy_2026-06.sql
-- ============================================================================
-- Community-vote weight policy change (TK approved, 메인 제니 전달).
--
-- OLD policy (Soak schedule, now RETIRED): seasons 0-3 community_vote_weight=0,
--   season 4+ = 0.7.
-- NEW policy: ONLY season 0 = 0 (AI 100%); season 1 onward = 0.7 for ALL seasons.
--
-- This file does TWO additive, idempotent things and changes NO existing data:
--   1. Adds platform_config.default_community_vote_weight = 0.70 (the single
--      source the season-tick cron reads when auto-creating a season).
--   2. Sets the seasons column DEFAULTs to the NEW common case (0.7 / 0.3) so a
--      future insert that omits the weights lands on policy, not on a stale one.
--
-- season_0's row already holds community_vote_weight=0 (measured 2026-06-06);
-- that 0 is a pure DATA value on the seed row and is intentionally NOT touched.
-- No per-season branching exists in code -- the cron reads the config key above.
--
-- Run order: this migration is standalone and may run before or after the
-- feat/weekly-season-cron deploy. The cron only reads the config key when it
-- auto-creates a season (first creation happens a week after season_0 opens).
-- ============================================================================


-- ============================================================================
-- STEP 0 (READ-ONLY) -- confirm the CURRENT column DEFAULT before changing it.
-- Expected under OLD policy: a stale default (often 0 or NULL). Record what you
-- see; STEP 2 overwrites it with the NEW policy value regardless.
-- ============================================================================
SELECT column_name, column_default, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name IN ('community_vote_weight', 'ai_score_weight');


-- ============================================================================
-- STEP 1 -- platform_config: the cron's single source for the default weight.
-- ON CONFLICT DO NOTHING so re-running is a no-op and never clobbers an admin
-- edit. value is stored as TEXT (existing convention), value_type = 'decimal'.
-- ============================================================================
INSERT INTO public.platform_config (key, value, value_type, description)
VALUES (
  'default_community_vote_weight',
  '0.70',
  'decimal',
  'Default community_vote_weight applied to every auto-created season (season 1+). season_0 keeps 0 as a per-row data value. ai_score_weight is derived as 1 - this.'
)
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- STEP 2 -- column DEFAULTs reflect the NEW policy common case (0.7 / 0.3).
-- ALTER COLUMN SET DEFAULT is naturally idempotent (re-running sets the same
-- value). This does NOT rewrite any existing row -- only future omitting inserts.
-- ============================================================================
ALTER TABLE public.seasons
  ALTER COLUMN community_vote_weight SET DEFAULT 0.7;

ALTER TABLE public.seasons
  ALTER COLUMN ai_score_weight SET DEFAULT 0.3;


-- ============================================================================
-- STEP 3 (VERIFY) -- run after STEP 1+2. Success criteria:
--   (a) one platform_config row: default_community_vote_weight = "0.70"
--   (b) seasons defaults now community=0.7, ai=0.3
--   (c) season_0 DATA value unchanged: community=0, ai=1
-- ============================================================================
SELECT key, value, value_type
FROM public.platform_config
WHERE key = 'default_community_vote_weight';

SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name IN ('community_vote_weight', 'ai_score_weight');

SELECT id, season_number, status, community_vote_weight, ai_score_weight
FROM public.seasons
ORDER BY season_number;
