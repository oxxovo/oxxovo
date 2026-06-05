-- =========================================================================
-- OXXOVO seasons 가중치 불변식 — DB CHECK 제약 (2026-06-04)
-- Run in Supabase SQL Editor (전체 파일 한 블록).
--
-- 배경: ai_score_weight + community_vote_weight = 1 불변식이 지금까지 폼
--   레이어(lib/season-schema.ts Zod refine)에만 있었음. SQL 직접 수정이나
--   마이그레이션으로 가중치를 바꾸면 검증을 우회 -> Soak 모드/본선 가중이
--   조용히 깨질 수 있었음 (예: community=0.7인데 투표 시스템 없음 -> final_score가
--   AI의 0.3배로 silent 축소). lib/scoring.ts computeFinalScore()는 이 불변식을
--   신뢰하므로, DB 레벨에서 defense-in-depth로 못박음.
--
-- 옥소보 원칙: 멱등(DROP IF EXISTS -> ADD). 부동소수 허용오차 0.001 (Zod와 동일).
-- =========================================================================

BEGIN;

-- 위반 행이 있으면 ADD CONSTRAINT가 실패하므로 안전(잘못된 데이터를 조용히
-- 통과시키지 않음). 적용 전 데이터 점검은 COMMIT 후 verification #2 참조.

ALTER TABLE public.seasons
  DROP CONSTRAINT IF EXISTS seasons_score_weights_sum_chk;

ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_score_weights_sum_chk
    CHECK (abs(ai_score_weight + community_vote_weight - 1) < 0.001);

COMMIT;

-- =========================================================================
-- Verification (COMMIT 후 별도 실행)
-- =========================================================================

-- 1) 제약 정의 확인 — 기대: 1 row, CHECK (abs(...) < 0.001)
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.seasons'::regclass
  AND conname = 'seasons_score_weights_sum_chk';

-- 2) 전 시즌 가중치 합 = 1 인지 전수 — 기대: 0 rows (위반 없음)
SELECT id, ai_score_weight, community_vote_weight,
       ai_score_weight + community_vote_weight AS sum
FROM public.seasons
WHERE abs(ai_score_weight + community_vote_weight - 1) >= 0.001;

-- 3) 시즌 0 Soak 모드 값 재확인 — 기대: ai=1, community=0
SELECT id, ai_score_weight, community_vote_weight
FROM public.seasons
WHERE id = 'season_0';
