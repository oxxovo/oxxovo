-- season_0.main_round_twist -- value input (2026-08-14)
-- ===========================================================================
-- Run in Supabase SQL Editor, block by block, in order. TK confirmed the
-- language decision 2026-08-14: single column (no KR/EN split), so EN-first +
-- KR in parens, to match this table's existing English-only free-text
-- convention (main_round_theme, main_round_theme_label) while still being
-- readable by KR-only participants who must build against this text.
-- Tracked as backlog #29 (language-column split, deferred).
-- ===========================================================================

-- BLOCK 0 -- confirm current state before writing (read-only)
SELECT id, name, main_round_twist, main_round_start_at, theme_announcement_minutes_before
FROM public.seasons
WHERE id = 'season_0';

-- BLOCK 1 -- write the value (RETURNING so the editor shows the result)
UPDATE public.seasons
SET main_round_twist = 'A scene applying lotion to the face (얼굴에 로션을 바르는 장면)'
WHERE id = 'season_0'
RETURNING id, name, main_round_twist, main_round_start_at, theme_announcement_minutes_before;

-- BLOCK 2 -- verify: value present on base table, still absent from the
-- public view (seasons_public must never carry it -- that is the whole point
-- of the reveal gate, see reports/promo_auto_publish_design_2026-08-14.md is
-- unrelated; the gate itself is lib/seasons.ts isTwistRevealed).
SELECT id, main_round_twist FROM public.seasons WHERE id = 'season_0';

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seasons_public'
  AND column_name = 'main_round_twist';
-- expect 0 rows -- the view must not carry this column.
