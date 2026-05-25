-- OXXOVO seasons schema: award_prizes (Phase 5b follow-up)
-- Run in Supabase SQL Editor (full file as one block).
--
-- Adds award_prizes JSONB: per-rank extras beyond the cash prize.
--
-- Shape:
--   {
--     "1": { "trophy_ko": "...", "trophy_en": "...",
--            "badge_ko":  "...", "badge_en":  "...",
--            "grand_final_ko": "...", "grand_final_en": "..." },
--     "2": { same shape; any field optional },
--     "3": { same shape; any field optional }
--   }
--
-- Cash prize stays in prize_first/second/third. Those columns are generated
-- from total_prize_pool * prize_*_pct and remain the source of truth for $$.
-- award_prizes only carries the non-cash perks (physical trophy, digital
-- badge, grand-final ticket). Any of trophy_*, badge_*, grand_final_* may be
-- absent for a rank that does not get that perk.
--
-- Korean/English text is stored directly per-rank rather than as a structured
-- enum, so future seasons can rename ("왕중왕전" -> "Grand Finale", etc.)
-- without a code change.

BEGIN;

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS award_prizes JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.seasons
  ADD CONSTRAINT award_prizes_shape_chk
    CHECK (jsonb_typeof(award_prizes) = 'object');

UPDATE public.seasons
SET award_prizes = '{
  "1": {
    "trophy_ko":      "OXXOVO 실물 상패",
    "trophy_en":      "OXXOVO physical trophy",
    "badge_ko":       "골드 디지털 뱃지",
    "badge_en":       "Gold digital badge",
    "grand_final_ko": "왕중왕전 진출권",
    "grand_final_en": "ticket to the Grand Final"
  },
  "2": {
    "badge_ko":       "실버 디지털 뱃지",
    "badge_en":       "Silver digital badge",
    "grand_final_ko": "왕중왕전 진출권",
    "grand_final_en": "ticket to the Grand Final"
  },
  "3": {
    "badge_ko":       "브론즈 디지털 뱃지",
    "badge_en":       "Bronze digital badge",
    "grand_final_ko": "왕중왕전 진출권",
    "grand_final_en": "ticket to the Grand Final"
  }
}'::jsonb
WHERE id = 'season_0';

COMMIT;

-- Verification (run separately after COMMIT):
-- SELECT id, award_prizes FROM public.seasons WHERE id = 'season_0';
