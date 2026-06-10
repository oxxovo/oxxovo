-- ─────────────────────────────────────────────────────────────────────────
-- OXXOVO system_messages 마이그레이션 (2026-05-29 정정본)
-- 시스템 메시지(사용자 행동 차단/안내) DB 단일 진실원천.
--
-- 배경 (TK 대표님 결정):
--   - 본선 UI i18n 키 중 reason 4 + 자동 알림 4 = 8개만 DB로
--   - 마케팅 카피, 라벨, 버튼은 코드 유지 (자주 변경 X)
--   - 미래 admin UI(옥소보 7 TODO #9) 마이그레이션 회피
--
-- 사업 본질 반영 (2026-05-29 정정):
--   - 본선 = 단일 제출 모델 [[project-main-round-single-submission]]
--   - wrong_status / editable_disabled / already_submitted reason 모두 없음
--   - 대신 사전 경고 + 확인 모달 자동 알림 추가
--
-- 분류:
--   submission_block (4) — reason 키와 1:1, 제출 차단 사유
--     not_selected / before_start / after_close / season_dates_not_set
--   submission_notice (4) — 자동 안내문
--     theme_reveal_waiting / submission_warning / submitted_confirmation / submit_confirm_modal
--
-- 안전장치:
--   - ON CONFLICT (key) DO NOTHING — 재실행 안전 + admin 편집본 보호
--   - BEFORE UPDATE 트리거 — updated_at 자동 갱신
--   - RLS: anon/authenticated SELECT, service_role 전체
--   - category index — 옥소보 7+ /admin/messages 필터 준비
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- ─── 1. 테이블 + 트리거 + 인덱스 ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.system_messages (
  key TEXT PRIMARY KEY,
  ko TEXT NOT NULL,
  en TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- updated_at 자동 갱신 트리거 (admin UI에서 UPDATE 시 동작)
CREATE OR REPLACE FUNCTION public.system_messages_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS system_messages_updated_at_trigger ON public.system_messages;
CREATE TRIGGER system_messages_updated_at_trigger
BEFORE UPDATE ON public.system_messages
FOR EACH ROW EXECUTE FUNCTION public.system_messages_set_updated_at();

-- /admin/messages 필터용 (옥소보 7+ 준비)
CREATE INDEX IF NOT EXISTS system_messages_category_idx
  ON public.system_messages (category);

-- ─── 2. RLS + GRANT ────────────────────────────────────────────────────
-- 메시지는 민감 정보 없음 (운영 안내문). 비로그인 페이지에서도 표시 가능해야 함.

ALTER TABLE public.system_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.system_messages TO anon, authenticated;
GRANT ALL    ON public.system_messages TO service_role;

DROP POLICY IF EXISTS system_messages_public_read ON public.system_messages;
CREATE POLICY system_messages_public_read ON public.system_messages
  FOR SELECT TO anon, authenticated
  USING (true);

-- ─── 3. 시드 — 본선 UI 8개 메시지 ─────────────────────────────────────
-- 카테고리 'submission_block' (4): canSubmitMainRound reason 키와 1:1 매핑.
--   lib/seasons.ts SubmitBlockReason union 참조 (4개로 축소).
-- 카테고리 'submission_notice' (4): 자동 안내문.
--
-- ON CONFLICT (key) DO NOTHING — 마이그레이션 재실행 시 admin 편집본 보호.
-- 키 값 강제 동기화가 필요하면 DO UPDATE로 별도 운영.

INSERT INTO public.system_messages (key, ko, en, category) VALUES
  ('main_round_block_not_selected',
   '본선(Main Round) 참가 신청은 선정된 상위 50명의 크리에이터만 가능합니다.',
   'Main-round submission is open to selected (Top 50) creators only.',
   'submission_block'),

  ('main_round_block_before_start',
   '본선은 아직 시작되지 않았습니다.',
   'The main round hasn''t started yet.',
   'submission_block'),

  ('main_round_block_after_close',
   '본선 접수가 마감되었습니다.',
   'The main round has closed.',
   'submission_block'),

  ('main_round_block_season_dates_not_set',
   '시즌 일정이 아직 확정되지 않았습니다. 확정되는 대로 알려드리겠습니다.',
   'The season schedule isn''t set yet. We''ll notify you once it''s confirmed.',
   'submission_block'),

  ('main_round_theme_reveal_waiting',
   '본선 테마는 본선 시작 직전에 공개됩니다.',
   'The main-round theme will be revealed shortly before the round begins.',
   'submission_notice'),

  ('main_round_submission_warning',
   '한 번 제출하면 영상은 수정할 수 없습니다. 제출 전에 신중하게 검토해 주세요.',
   'Once submitted, your video cannot be edited. Please review carefully before submitting.',
   'submission_notice'),

  ('main_round_submitted_confirmation',
   '본선 영상 제출이 완료되었습니다.',
   'Your main-round submission has been received.',
   'submission_notice'),

  ('main_round_submit_confirm_modal',
   '정말 제출하시겠어요? 제출 후에는 변경할 수 없습니다.',
   'Are you sure you want to submit? Once submitted, you cannot make changes.',
   'submission_notice')

ON CONFLICT (key) DO NOTHING;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- Verification (COMMIT 후 별도 실행)
-- ─────────────────────────────────────────────────────────────────────────

-- 1) 테이블 + RLS 활성화 확인
SELECT relname, relrowsecurity AS rls_on
FROM pg_class
WHERE relname = 'system_messages' AND relnamespace = 'public'::regnamespace;

-- 2) 인덱스 — PK + category 2개
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'system_messages'
ORDER BY indexname;

-- 3) 트리거 — updated_at 자동 갱신
SELECT tgname FROM pg_trigger
WHERE tgrelid = 'public.system_messages'::regclass
  AND NOT tgisinternal;

-- 4) RLS 정책 — public_read 1개
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'system_messages';

-- 5) 시드 8개 확인 — 카테고리별 분포 (4 + 4)
SELECT category, COUNT(*) AS n
FROM public.system_messages
GROUP BY category
ORDER BY category;
-- 기대: submission_block = 4, submission_notice = 4

-- 6) 전체 키 + 한/영 길이 검증 — 8개 전부 표시
SELECT key, category,
       length(ko) AS ko_len,
       length(en) AS en_len,
       updated_at
FROM public.system_messages
ORDER BY category, key;

-- 7) ON CONFLICT 안전성 테스트 — 같은 키로 'TEST' INSERT 시도
--    DO NOTHING 동작 확인 (값이 바뀌지 않아야 정상)
INSERT INTO public.system_messages (key, ko, en, category)
VALUES ('main_round_block_not_selected', 'TEST_KO', 'TEST_EN', 'test_cat')
ON CONFLICT (key) DO NOTHING;

SELECT key, ko, category
FROM public.system_messages
WHERE key = 'main_round_block_not_selected';
-- 기대: ko='본선(Main Round) 참가 신청...', category='submission_block' (덮어쓰기 안 됨)

-- 8) updated_at 트리거 동작 테스트 (subtransaction + ROLLBACK 패턴)
DO $$
DECLARE
  old_ts TIMESTAMPTZ;
  new_ts TIMESTAMPTZ;
BEGIN
  BEGIN
    SELECT updated_at INTO old_ts FROM public.system_messages
    WHERE key = 'main_round_block_not_selected';

    PERFORM pg_sleep(0.01);
    UPDATE public.system_messages
    SET en = en  -- no-op update
    WHERE key = 'main_round_block_not_selected';

    SELECT updated_at INTO new_ts FROM public.system_messages
    WHERE key = 'main_round_block_not_selected';

    IF new_ts > old_ts THEN
      RAISE NOTICE 'TEST PASSED — updated_at trigger fired (old=%, new=%)', old_ts, new_ts;
    ELSE
      RAISE EXCEPTION 'TEST FAILED — updated_at unchanged (old=%, new=%)', old_ts, new_ts;
    END IF;

    -- 검증만, 데이터 변경 의도 없음 → 의도적 EXCEPTION으로 sub-block ROLLBACK
    RAISE EXCEPTION 'INTENTIONAL_ROLLBACK_AFTER_VERIFY';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM = 'INTENTIONAL_ROLLBACK_AFTER_VERIFY' THEN
        RAISE NOTICE 'Trigger test complete, data rolled back via exception';
      ELSE
        RAISE;
      END IF;
  END;
END $$;
