-- ─────────────────────────────────────────────────────────────────────────
-- OXXOVO 본선 제출 마이그레이션 패치 (2026-05-28)
-- 1단계 적용 후 발견한 array_length NULL 함정 정정.
--
-- 문제:
--   array_length(ARRAY[]::TEXT[], 1) = NULL → CHECK가 NULL을 통과로 간주
--   → 빈 배열 UPDATE가 거부되지 않음 (TK 대표님 직접 검증, ROLLBACK으로 안전).
--
-- 수정:
--   cardinality(allowed_video_platforms) >= 1
--   - cardinality(ARRAY[]::TEXT[]) = 0 (NULL 아님, 함정 없음)
--   - 컬럼 자체는 1단계에서 NOT NULL이라 cardinality(NULL) 경로 차단
--   - PostgreSQL 8.4+ 표준 함수, 의미 명확
--
-- 다른 array_length 사용처 점검: 없음 (단일 grep 매치).
-- deadline_reminder_hours_shape_chk는 jsonb_array_length 사용으로 함정 없음.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.seasons
  DROP CONSTRAINT IF EXISTS allowed_video_platforms_nonempty_chk;

ALTER TABLE public.seasons
  ADD CONSTRAINT allowed_video_platforms_nonempty_chk
    CHECK (cardinality(allowed_video_platforms) >= 1);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- 재검증 (COMMIT 후 별도 실행)
-- ─────────────────────────────────────────────────────────────────────────

-- 1) 새 CHECK 식 확인
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.seasons'::regclass
  AND conname = 'allowed_video_platforms_nonempty_chk';

-- 2) 빈 배열 거부 테스트 — 이번엔 'TEST PASSED' NOTICE가 떠야 정상
DO $$
BEGIN
  BEGIN
    UPDATE public.seasons
    SET allowed_video_platforms = ARRAY[]::TEXT[]
    WHERE id = 'season_0';
    RAISE EXCEPTION 'TEST FAILED — empty array UPDATE was accepted';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'TEST PASSED — empty array UPDATE correctly rejected by CHECK';
  END;
END $$;

-- 3) 시즌 0 정상 값 그대로 유지됐는지 (패치는 CHECK 식 교체만, 데이터 영향 X)
SELECT id, allowed_video_platforms
FROM public.seasons
WHERE id = 'season_0';
