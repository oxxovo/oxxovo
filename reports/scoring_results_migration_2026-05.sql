-- ─────────────────────────────────────────────────────────────────────────
-- OXXOVO scoring_results 마이그레이션 (2026-05-27)
-- 시즌 0 자동 채점 통합 — oxxovo + oxxovo-scoring 두 레포 사이의 데이터 다리.
--
-- 4가지 변경:
--   1. genesis_applications.status — 'flagged' 추가 (8 values, IDEMPOTENT)
--   2. seasons — integrity confidence 3단계 임계값 컬럼 신설 (15/30/50)
--   3. scoring_results 테이블 신규 — 채점 결과 + integrity 검토 정보
--   4. RLS + GRANT — admin SELECT, service_role 전체 (oxxovo-scoring INSERT/UPDATE)
--
-- TK 대표님 결정 (2026-05-27):
--   - integrity_flag 자동 탈락 X → status='flagged' 검토 대기로
--   - 임계값 15/30/50 표준 (high만 flagged, medium/low는 자동 통과)
--   - integrity 설명: 한 번에 한/영 동시 생성
--   - Top N 자동 (verified_score DESC). flagged 검토 후 나머지에서 자동
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── 1. genesis_applications.status CHECK 제약 확장 ─────────────────────
-- 기존 5개 또는 7개 (실측 결과 따라) → 8개로 통합.
-- 'flagged' 신규: integrity_confidence='high'일 때만 진입, admin 검토 대기.
-- IDEMPOTENT — 기존 제약 없어도, 5/7개 어느 것이어도 안전.

ALTER TABLE public.genesis_applications
  DROP CONSTRAINT IF EXISTS genesis_applications_status_check;

ALTER TABLE public.genesis_applications
  ADD CONSTRAINT genesis_applications_status_check
    CHECK (status IN (
      'pending',      -- 신청 직후
      'waitlist',     -- 정원 초과
      'verifying',    -- oxxovo-scoring가 채점 중
      'flagged',      -- integrity high confidence — admin 검토 대기 (신규)
      'eligible',     -- 채점 통과, Top N 후보
      'selected',     -- Top N 선정 (본선 진출)
      'awarded',      -- 수상자
      'rejected'      -- 탈락 (admin 수동 또는 자동)
    ));

-- ─── 2. seasons에 integrity confidence 임계값 3컬럼 ───────────────────
-- Claude integrity 점수 (0~100, 높을수록 AI생성 가능성 ↑) 구간:
--   integrity < high_threshold  → 'high'   → status='flagged' (admin 검토)
--   < medium_threshold          → 'medium' → 'eligible' (admin 필터로 보임)
--   < low_threshold             → 'low'    → 'eligible' (조용히 기록)
--   >= low_threshold            → 'none'   → 'eligible' (정상)
--
-- 시즌 0 기본값: 15 / 30 / 50 — "명백한 것만" flag 보장 (TK 표준 선택).
-- 시즌 1에서 시즌 0 실측 분포 보고 조정 가능.

ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS flag_integrity_high_threshold   INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS flag_integrity_medium_threshold INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS flag_integrity_low_threshold    INTEGER NOT NULL DEFAULT 50;

ALTER TABLE public.seasons
  DROP CONSTRAINT IF EXISTS flag_integrity_thresholds_order_chk;

ALTER TABLE public.seasons
  ADD CONSTRAINT flag_integrity_thresholds_order_chk
    CHECK (
          flag_integrity_high_threshold >= 0
      AND flag_integrity_high_threshold < flag_integrity_medium_threshold
      AND flag_integrity_medium_threshold < flag_integrity_low_threshold
      AND flag_integrity_low_threshold <= 100
    );

-- 시즌 0 명시 적용 (default와 동일하지만 문서화 차원)
UPDATE public.seasons
SET flag_integrity_high_threshold   = 15,
    flag_integrity_medium_threshold = 30,
    flag_integrity_low_threshold    = 50
WHERE id = 'season_0';

-- ─── 3. scoring_results 테이블 신규 ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.scoring_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL
    REFERENCES public.genesis_applications(id) ON DELETE CASCADE,
  season_id TEXT NOT NULL
    REFERENCES public.seasons(id) ON DELETE CASCADE,
  round TEXT NOT NULL CHECK (round IN ('application', 'main')),

  -- ─ 채점 진행 상태 (oxxovo-scoring가 단계별로 UPDATE) ─
  judged_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (judged_status IN ('pending', 'in_progress', 'completed', 'failed')),
  processing_attempts INT NOT NULL DEFAULT 0,
  error_message TEXT,

  -- ─ AI 모델별 raw 점수 (scoreWithAllAIs 결과) ─
  claude_intent      NUMERIC,
  claude_execution   NUMERIC,
  claude_originality NUMERIC,
  claude_integrity   NUMERIC,
  gpt_intent         NUMERIC,
  gpt_execution      NUMERIC,
  gpt_originality    NUMERIC,
  gemini_intent      NUMERIC,
  gemini_execution   NUMERIC,
  gemini_originality NUMERIC,

  -- ─ Consensus (Integrity는 Claude 단독, 나머지 3-AI 평균) ─
  consensus_intent      NUMERIC,
  consensus_execution   NUMERIC,
  consensus_originality NUMERIC,
  consensus_integrity   NUMERIC,

  -- ─ 가중치 적용 최종 점수 + 등급 ─
  verified_score NUMERIC,
  grade TEXT,  -- LEGENDARY/MASTERPIECE/EXCELLENT/SKILLED/AVERAGE/ADEQUATE/NEEDS_WORK
               -- 헬퍼 lib/grades.ts에서 derive (oxxovo 본체)

  -- ─ Integrity 확장 (TK 두 가지 결정 반영) ─
  integrity_flag BOOLEAN NOT NULL DEFAULT FALSE,
    -- TRUE는 confidence='high' 일 때만 (TK: "명백한 것만 flag")

  integrity_confidence TEXT NOT NULL DEFAULT 'none'
    CHECK (integrity_confidence IN ('none', 'low', 'medium', 'high')),
    -- seasons.flag_integrity_*_threshold 와 비교해서 derive

  integrity_explanation_ko TEXT,
    -- 평이한 한국어 사유 (예: "이 영상은 AI 생성 워터마크가 없고 실제 그림자가 보여,
    --  AI로 만들어진 영상이 아닐 가능성이 큼")

  integrity_explanation_en TEXT,
    -- 평이한 영어 사유 (Claude가 두 언어 동시 생성)

  integrity_recommendation TEXT
    CHECK (integrity_recommendation IN ('reject', 'review', 'accept')),
    -- AI 한 줄 추천 — admin이 색깔로 즉시 인지 (red/yellow/green)

  -- ─ AI 3개의 원본 출력 (strengths/weaknesses/aiSummary 통째로) ─
  -- 구조 예:
  -- { "claude": {"strengths": [...], "weaknesses": [...], "aiSummary": "..."},
  --   "gpt":    {...}, "gemini": {...} }
  ai_outputs JSONB,

  -- ─ 운영 메타데이터 ─
  total_cost_usd NUMERIC,
  total_duration_ms INT,

  started_at TIMESTAMPTZ,
  judged_at  TIMESTAMPTZ,

  UNIQUE(application_id, round)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS scoring_results_season_idx
  ON public.scoring_results (season_id, verified_score DESC);

CREATE INDEX IF NOT EXISTS scoring_results_status_idx
  ON public.scoring_results (judged_status)
  WHERE judged_status IN ('pending', 'in_progress');

CREATE INDEX IF NOT EXISTS scoring_results_flag_idx
  ON public.scoring_results (season_id, integrity_flag)
  WHERE integrity_flag = TRUE;

-- 시즌 0 monitoring — confidence 분포 빠른 집계용
CREATE INDEX IF NOT EXISTS scoring_results_confidence_idx
  ON public.scoring_results (season_id, integrity_confidence);

-- ─── 4. GRANT + RLS ────────────────────────────────────────────────────
-- 일반 사용자: 자기 application의 결과만 (옥소보 7+ profile 연동 시), 현재 X.
-- admin: SELECT만. **UPDATE/INSERT/DELETE 정책 의도적으로 미부여**.
-- service_role: oxxovo-scoring이 INSERT/UPDATE 전담.
--
-- ⚠️ admin UPDATE 정책 의도적 미부여 — 사업 본질 차원 ([[project-scoring-integrity-rules]]):
--   "Score 100% 자동 결정, admin은 점수 변경 절대 불가."
--   admin이 scoring_results 점수 컬럼(verified_score, consensus_*, claude/gpt/gemini_*,
--   grade, integrity_*, ai_outputs)을 임의 수정하면 부정 방지 + 시청자 신뢰 위반.
--   따라서 admin role에는 SELECT만 GRANT + UPDATE/INSERT/DELETE 정책 미부여 →
--   RLS 차원에서 자동 차단됨.
--
-- ⚠️ service_role의 RLS bypass 위험:
--   service_role은 RLS 우회 권한 보유. 본체에서 createSupabaseAdmin()으로
--   scoring_results.update() 호출하면 차단되지 않음. 사업 본질 차원에서
--   admin score 변경 server action 추가 금지 ([[project-scoring-integrity-rules]]
--   점검 패턴 참조: scoring_results\.update / \.insert / \.delete grep 정기 점검).

GRANT SELECT ON public.scoring_results TO authenticated;
GRANT ALL    ON public.scoring_results TO service_role;

ALTER TABLE public.scoring_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scoring_results_admin_read ON public.scoring_results;

CREATE POLICY scoring_results_admin_read ON public.scoring_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
-- 의도: scoring_results_admin_update / _insert / _delete 정책 추가 금지.
-- 추가 필요 시 [[project-scoring-integrity-rules]] 재검토 + TK 대표님 결정.

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verification (COMMIT 후 별도 실행)
-- ─────────────────────────────────────────────────────────────────────────

-- 1) status CHECK 제약 — 8개 확인
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.genesis_applications'::regclass
  AND conname = 'genesis_applications_status_check';

-- 2) seasons 새 컬럼 — 3개, 15/30/50
SELECT id,
       flag_integrity_high_threshold   AS high,
       flag_integrity_medium_threshold AS med,
       flag_integrity_low_threshold    AS low
FROM public.seasons
WHERE id = 'season_0';

-- 3) scoring_results 컬럼 — 27개 예상
SELECT COUNT(*) AS col_count
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'scoring_results';

-- 4) 인덱스 — 5개 예상 (PK + 4 partial/composite)
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'scoring_results'
ORDER BY indexname;

-- 5) RLS 정책 — 1개 (admin SELECT)
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'scoring_results';
