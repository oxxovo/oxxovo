-- ─────────────────────────────────────────────────────────────────────────
-- OXXOVO 매주 시즌 시스템 — 스케줄 앵커 마이그레이션 (2026-06-03)
-- Run in Supabase SQL Editor (전체 파일을 한 블록으로 실행).
--
-- ⚠️ 명세 vs 실제 (중요):
--   원 계획(task #5)은 weight + finals 타임스탬프를 대거 ADD하라고 지시했으나,
--   실측 결과 요청 컬럼 8개 중 7개가 이미 다른 이름으로 존재하고 코드 전체
--   (lib/seasons.ts, lib/season-schema.ts, app/admin/seasons/*, email cron)에
--   wired돼 있었음. 명세대로 ADD하면 중복 컬럼 = 단일 진실원(옥소보 원칙) 위반
--   + 죽은 컬럼 silent bug. TK 대표님 결정(2026-06-03): 기존 이름 유지, rename 금지,
--   순(net) 신규인 scoring_start_at 1개만 ADD.
--
--   명세 용어 → 실제 컬럼 매핑 (docs/season-system-assessment.md 매핑표와 동일):
--     community_weight        → community_vote_weight   (기존, default 정책은 코드)
--     ai_weight               → ai_score_weight         (기존)
--     finals_start_at         → main_round_start_at      (기존)
--     finals_end_at           → main_round_end_at        (기존)
--     finals_theme_reveal_at  → theme_announcement_minutes_before (offset, 파생)
--     awards_at               → awards_announcement_at   (기존)
--     application_open_at      → application_open_at      (기존, 동명)
--     scoring_start_at        → ★ 신규 ADD (본 마이그레이션)
--
-- 옥소보 원칙 준수:
--   * ADD COLUMN IF NOT EXISTS만 사용 — DROP/RENAME 없음, 멱등.
--   * 기존 schedule 타임스탬프(application_open_at 등)와 동일하게 nullable,
--     default 없음. 시각 계산은 cron/코드가 담당(컬럼은 값 저장만).
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- scoring_start_at — 신청 마감 후 채점이 "시작"되는 시각 앵커.
--   * application_close_at ≈ 채점 시작이지만, "응모 마감(UI)"과 "채점 워커 착수"를
--     분리하기 위한 명시 앵커. 투명 로그/UI("채점 진행 중 since X")에도 사용.
--   * 멀티시즌 oxxovo-scoring 워커의 1차 트리거는 season status이며(task #4),
--     본 컬럼은 보조 앵커 + 표시용. 미설정(NULL) 허용.
--   * 기존 nullable 타임스탬프 패턴과 동일: NOT NULL/ default 미적용.
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS scoring_start_at TIMESTAMPTZ;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verification (COMMIT 후 별도 실행)
-- ─────────────────────────────────────────────────────────────────────────

-- 1) 신규 컬럼 메타 확인 — 기대: 1 row, data_type=timestamp with time zone, nullable=YES
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name = 'scoring_start_at';

-- 2) 명세가 "신규"라 착각했으나 이미 존재하는 컬럼들 재확인 — 기대: 6 rows 전부 존재
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'seasons'
  AND column_name IN (
    'community_vote_weight',
    'ai_score_weight',
    'application_open_at',
    'main_round_start_at',
    'main_round_end_at',
    'awards_announcement_at'
  )
ORDER BY column_name;

-- 3) 시즌 0 스케줄 앵커 현황 (NULL = 아직 미설정, cron/admin이 채울 예정)
SELECT id,
       application_open_at,
       application_close_at,
       scoring_start_at,      -- 신규
       scoring_complete_at,
       main_round_start_at,
       main_round_end_at,
       awards_announcement_at
FROM public.seasons
WHERE id = 'season_0';
