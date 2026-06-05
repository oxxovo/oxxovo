-- =========================================================================
-- OXXOVO genesis_applications.award_override_reason 컬럼 (2026-06-04)
-- Run in Supabase SQL Editor (전체 파일 한 블록).
--
-- 목적: 본선 수상 결정 = AI final_score 자동 랭킹 + admin 최종 승인 (옵션 3).
--   admin이 자동 순위를 override(부정/표절/시스템 오류)할 때 **사유를 전용
--   컬럼에 기록** = audit 명확성. award_rank 옆에 위치.
--
-- 왜 전용 컬럼인가 (admin_notes 재사용 대비):
--   * 시상 변경 이력만 깔끔히 추적 (일반 메모와 분리).
--   * 시즌 1+ 누적 보고/검색 편리, 부정 사례 기록 일관.
--
-- award_rank 자체는 admin이 쓰는 운영 결정 컬럼 — 채점 점수(verified_score,
-- final_score)와 무관하므로 admin 수정 허용. score는 여전히 불변
-- (project-scoring-integrity-rules). override_reason은 그 결정의 근거 기록.
--
-- 옥소보 원칙: 멱등(ADD COLUMN IF NOT EXISTS), nullable, default 없음.
-- =========================================================================

BEGIN;

ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS award_override_reason TEXT;

COMMIT;

-- =========================================================================
-- Verification (COMMIT 후 별도 실행)
-- =========================================================================

-- 1) 컬럼 메타 — 기대: 1 row, data_type=text, is_nullable=YES, default null
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'genesis_applications'
  AND column_name = 'award_override_reason';
