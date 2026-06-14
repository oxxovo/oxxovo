-- ===========================================================================
-- OXXOVO 시즌 0 -- 3단계 토너먼트 구조 마이그레이션 (2026-06-11)
-- ===========================================================================
-- Run in Supabase SQL Editor (전체 한 블록). 멱등(IF NOT EXISTS / DROP+ADD), ASCII-only.
--
-- 구조: 예선(preliminary) -> 준결승(semifinal) -> 결승(final) -> 시상.
--
-- *** 명명 규칙 (중요, 나중에 헷갈리지 말 것) ***
--   application_*  = 예선 (preliminary, 자유작, 최대 500/최소 50)
--   main_round_*   = 준결승 (semifinal). "main_round"는 역사적 이름일 뿐 의미는 *준결승*.
--                    진출자 = top_n_advance (예선 상위 10% clamp 10~50) = Founding Creator(가변).
--   final_*        = 결승 (final, 신규). 진출자 = final_n (3명). Top3 = 시상 + 왕중왕전.
--   전 라운드 영상 길이 = application_video_min/max_seconds 공통(15~30). main_round_video_* 폐기.
--
-- 미달(예선<50) 정책 = "연기"(신청 마감 연장), 이월 아님. 시즌0 무료라 유료 시즌으로
--   신청자 롤오버 불가. 컬럼: application_defer_count/defer_extension_days/max_defer_count.
-- ===========================================================================

BEGIN;

-- ===========================================================================
-- 1. seasons -- 3단계 파라미터 (ADD-only)
-- ===========================================================================
ALTER TABLE public.seasons
  -- 예선 미달 임계 + 연기(deferral) 메커니즘
  ADD COLUMN IF NOT EXISTS min_participants       INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS application_defer_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS defer_extension_days    INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS max_defer_count         INTEGER NOT NULL DEFAULT 2,
  -- 예선 -> 준결승 진출 정책 (top_n_advance = 산출 결과 저장처, 기존 컬럼 유지)
  ADD COLUMN IF NOT EXISTS advance_pct NUMERIC NOT NULL DEFAULT 0.10,
  ADD COLUMN IF NOT EXISTS advance_min INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS advance_max INTEGER NOT NULL DEFAULT 50,
  -- 준결승 -> 결승 진출 수 + 결승 일정
  ADD COLUMN IF NOT EXISTS final_n        INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS final_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS final_end_at   TIMESTAMPTZ;

-- 진출 정책 정합성 (clamp 하한<=상한, 비율 0~1)
ALTER TABLE public.seasons DROP CONSTRAINT IF EXISTS seasons_advance_policy_chk;
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_advance_policy_chk
    CHECK (advance_pct > 0 AND advance_pct <= 1
       AND advance_min >= 1 AND advance_min <= advance_max);

-- ===========================================================================
-- 2. genesis_applications -- 결승 제출 컬럼 + status 흐름 확장 (9 -> 11)
-- ===========================================================================
ALTER TABLE public.genesis_applications
  ADD COLUMN IF NOT EXISTS final_video_url   TEXT,
  ADD COLUMN IF NOT EXISTS final_submitted_at TIMESTAMPTZ;

-- 흐름: pending -> verifying -> eligible -> selected(준결승 진출)
--        -> main_round_submitted(준결승 제출) -> final_selected(결승 진출, 신규)
--        -> final_submitted(결승 제출, 신규) -> awarded
--       분기: waitlist / flagged / rejected
ALTER TABLE public.genesis_applications
  DROP CONSTRAINT IF EXISTS genesis_applications_status_check;
ALTER TABLE public.genesis_applications
  ADD CONSTRAINT genesis_applications_status_check
    CHECK (status IN (
      'pending',
      'waitlist',
      'verifying',
      'flagged',
      'eligible',
      'selected',               -- 준결승(main_round) 진출
      'main_round_submitted',   -- 준결승 영상 제출
      'final_selected',         -- 결승 진출 (신규)
      'final_submitted',        -- 결승 영상 제출 (신규)
      'awarded',
      'rejected'
    ));

-- ===========================================================================
-- 3. scoring_results -- round 에 'final' 추가 (라운드별 채점 이미 지원)
-- ===========================================================================
-- NOTE: DO $$ ... END $$ 블록 제거됨. Supabase SQL Editor가 $$ 내부 세미콜론을
-- statement 경계로 오인해 "unterminated dollar-quoted string"(42601)을 내고 1번
-- 전체가 롤백됐음(2026-06-13 실측). 그 블록은 "이름이 다른 round 제약도 지운다"는
-- 방어용이었으나, 2026-05 scoring_results 마이그가 인라인 CHECK(round IN(...))로
-- 생성 -> Postgres 자동 명명 = scoring_results_round_check (이 round 제약은 단 1개).
-- 따라서 아래 DROP CONSTRAINT IF EXISTS 한 줄로 충분. DO/plpgsql 불필요.
-- (사전 확인 쿼리는 파일 하단 Verification 0) 참조.)
ALTER TABLE public.scoring_results
  DROP CONSTRAINT IF EXISTS scoring_results_round_check;
ALTER TABLE public.scoring_results
  ADD CONSTRAINT scoring_results_round_check
    CHECK (round IN ('application', 'main', 'final'));

-- ===========================================================================
-- 4. 시즌 0 데이터 확정값
--   상금: 풀 3000 -> GENERATED prize_first/second/third = 1950/600/450 (pct 65/20/15)
--   길이: 전 라운드 15~30 (application_video_* 단일 출처; main_round_video_* 동기화+폐기)
-- ===========================================================================
UPDATE public.seasons SET
  max_applicants               = 500,
  min_participants             = 50,
  total_prize_pool             = 3000,
  prize_first_pct              = 65,
  prize_second_pct             = 20,
  prize_third_pct              = 15,
  application_video_min_seconds = 15,
  application_video_max_seconds = 30,
  main_round_video_min_seconds  = 15,   -- 폐기 예정, 값만 동기화
  main_round_video_max_seconds  = 30,
  advance_pct = 0.10, advance_min = 10, advance_max = 50,
  final_n = 3
WHERE season_number = 0;

-- ===========================================================================
-- 5. seasons_public VIEW -- 새 3단계 컬럼 노출 (전부 공개 구조값, 비밀 아님)
--   getSeasonById()는 base table이 아니라 이 VIEW를 읽음. VIEW는 명시적 컬럼
--   리스트라 새 컬럼을 여기 추가하지 않으면 공개 페이지(rules/faq/apply/profile)가
--   값을 못 봄. 진출 정책 + 결승 일정 = 토너먼트 구조라 공개 대상.
--   *** 비밀 컬럼(main_round_twist/main_round_theme)은 계속 제외 ***
--   기존 컬럼 순서 보존 + 끝에 신규 컬럼만 append (CREATE OR REPLACE VIEW 제약).
-- ===========================================================================
CREATE OR REPLACE VIEW public.seasons_public AS
  SELECT
    id, name, season_number, status,
    max_applicants, top_n_advance,
    application_video_min_seconds, application_video_max_seconds,
    total_prize_pool, entry_fee,
    main_round_video_seconds, theme_announcement_minutes_before, submission_hours,
    community_vote_weight, ai_score_weight,
    scoring_intent_clarity_weight, scoring_execution_weight,
    scoring_originality_weight, scoring_integrity_weight,
    ai_models,
    flag_integrity_threshold, flag_spread_threshold,
    application_open_at, application_close_at, scoring_complete_at,
    main_round_start_at, main_round_end_at, awards_announcement_at,
    created_at, updated_at,
    prize_first_pct, prize_second_pct, prize_third_pct,
    prize_first, prize_second, prize_third,
    display_name,
    main_round_video_min_seconds, main_round_video_max_seconds,
    deadline_reminder_hours, award_prizes,
    flag_integrity_high_threshold, flag_integrity_medium_threshold,
    flag_integrity_low_threshold,
    season_theme,
    allowed_video_platforms, scoring_start_at,
    host_type, host_user_id,
    prize_pool_escrow_status, prize_pool_escrow_paid_at,
    commission_rate_override, prize_funding_mode,
    poster_url, lobby_featured,
    -- ── 신규: 3단계 진출 정책 + 연기 + 결승 일정 ──
    min_participants, application_defer_count, defer_extension_days, max_defer_count,
    advance_pct, advance_min, advance_max,
    final_n, final_start_at, final_end_at
  FROM public.seasons;

GRANT SELECT ON public.seasons_public TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ===========================================================================
-- Verification (COMMIT 후 별도 실행)
-- ===========================================================================
-- 0) [선택, 본체 Run 전 사전확인] scoring_results의 round 관련 CHECK 제약이
--    'scoring_results_round_check' 하나뿐인지 확인. 이 한 줄만 나오면 본체의
--    명명 DROP으로 충분. 다른 이름이 같이 나오면 멈추고 알려줄 것.
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.scoring_results'::regclass
  AND contype = 'c'
  AND pg_get_constraintdef(oid) ILIKE '%round%';

-- 1) seasons 새 컬럼 + 시즌0 값
SELECT season_number, max_applicants, min_participants,
       total_prize_pool, prize_first, prize_second, prize_third,
       application_video_min_seconds, application_video_max_seconds,
       advance_pct, advance_min, advance_max, final_n,
       application_defer_count, defer_extension_days, max_defer_count,
       final_start_at, final_end_at
FROM public.seasons WHERE season_number = 0;

-- 2) status CHECK -- 11개
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.genesis_applications'::regclass
  AND conname = 'genesis_applications_status_check';

-- 3) scoring_results round CHECK -- application/main/final
SELECT pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.scoring_results'::regclass
  AND conname = 'scoring_results_round_check';

-- 4) genesis_applications 결승 컬럼
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='genesis_applications'
  AND column_name IN ('final_video_url','final_submitted_at')
ORDER BY column_name;

-- 5) seasons_public VIEW -- 새 3단계 컬럼 10개 노출 확인
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='seasons_public'
  AND column_name IN (
    'min_participants','application_defer_count','defer_extension_days','max_defer_count',
    'advance_pct','advance_min','advance_max','final_n','final_start_at','final_end_at'
  )
ORDER BY column_name;
