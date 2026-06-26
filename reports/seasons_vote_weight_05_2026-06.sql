-- ===========================================================================
-- Community vote weight 0.7 -> 0.5  (main-round scoring = AI 50% + audience 50%)
-- ===========================================================================
-- Source: TK scoring policy 2026-06-24 (season 1+ main round = 50:50).
-- Supersedes the 2026-06-07 "season 1+ = 0.7" policy (seasons_weight_policy).
--
-- WHY both columns change together:
--   DB CHECK seasons_score_weights_sum_chk enforces
--     abs(ai_score_weight + community_vote_weight - 1) < 0.001.
--   So community 0.7 -> 0.5 REQUIRES ai 0.3 -> 0.5 in the SAME UPDATE, or the
--   constraint rejects the row. Set as a pair (a single-statement UPDATE checks
--   the constraint once, after the row is fully updated).
--
-- Scope of this migration:
--   1. seasons 1-4         : community 0.5 / ai 0.5  (50:50).
--   2. season_0            : community 0   / ai 1     (Soak; AI 100%, enforce).
--   3. platform_config.default_community_vote_weight 0.70 -> 0.50
--      (the cron reads this to auto-create FUTURE seasons; if left at 0.70 the
--       next auto-created season silently reverts to 0.7 -- season-tick route).
--   4. seasons column DEFAULTs 0.7/0.3 -> 0.5/0.5 (manual-insert consistency).
--
-- Idempotent (re-runnable), ASCII-only. Run in the Supabase SQL editor.
-- ===========================================================================

BEGIN;

-- 1. Seasons 1-4 -> 50:50 (both columns in one statement to satisfy the CHECK).
UPDATE public.seasons
SET community_vote_weight = 0.5,
    ai_score_weight       = 0.5,
    updated_at            = now()
WHERE id IN ('season_1', 'season_2', 'season_3', 'season_4')
  AND host_type = 'official';

-- 2. Season 0 -> Soak (AI 100%). No-op if already 0/1.
UPDATE public.seasons
SET community_vote_weight = 0,
    ai_score_weight       = 1,
    updated_at            = now()
WHERE id = 'season_0'
  AND (community_vote_weight <> 0 OR ai_score_weight <> 1);

-- 3. Cron default for future auto-created seasons.
UPDATE public.platform_config
SET value = '0.50'
WHERE key = 'default_community_vote_weight';

-- 4. Column DEFAULTs reflect the new common case.
ALTER TABLE public.seasons ALTER COLUMN community_vote_weight SET DEFAULT 0.5;
ALTER TABLE public.seasons ALTER COLUMN ai_score_weight       SET DEFAULT 0.5;

COMMIT;

-- ===========================================================================
-- Verification (run AFTER commit)
-- ===========================================================================

-- 1) Per-season weights -- expect season_0 = 0/1, season_1..4 = 0.5/0.5, sum=1.
SELECT id, season_number, ai_score_weight, community_vote_weight,
       ai_score_weight + community_vote_weight AS sum
FROM public.seasons
WHERE id IN ('season_0', 'season_1', 'season_2', 'season_3', 'season_4')
ORDER BY season_number;

-- 2) No CHECK violations anywhere -- expect 0 rows.
SELECT id, ai_score_weight, community_vote_weight
FROM public.seasons
WHERE abs(ai_score_weight + community_vote_weight - 1) >= 0.001;

-- 3) Cron default -- expect value = 0.50.
SELECT key, value FROM public.platform_config
WHERE key = 'default_community_vote_weight';

-- 4) Column defaults -- expect both 0.5.
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons'
  AND column_name IN ('community_vote_weight', 'ai_score_weight')
ORDER BY column_name;
