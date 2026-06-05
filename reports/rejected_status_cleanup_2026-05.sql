-- ─────────────────────────────────────────────────────────────────────────
-- 잘못된 자동 매핑 'rejected' status 원복 (2026-05-29)
--
-- 배경:
--   - oxxovo-scoring batch.ts:237-242에서 judged_status='failed' 시
--     application.status='rejected'로 자동 영구화하는 로직 발견됨 (오스 진단).
--   - 사업 본질 위반: [[project-system-error-not-user-rejection]]
--     "시스템 오류(yt-dlp YouTube 차단) ≠ 사용자 탈락"
--   - 영향 application: 8fab4ccc-6a9f-4726-a637-aca6a464208f (TK 대표님 본인 application)
--
-- 정정:
--   status: 'rejected' → 'pending'
--   reason: 채점 전 신청 직후 상태로 원복.
--   scoring_results.judged_status는 진실원천이라 그대로 유지 (재시도 trigger).
--
-- IDEMPOTENT — 이미 'pending'이면 UPDATE no-op.
-- ─────────────────────────────────────────────────────────────────────────

-- ─── 적용 전 현재 상태 확인 ────────────────────────────────────────────
SELECT id, email, status, created_at
FROM public.genesis_applications
WHERE id = '8fab4ccc-6a9f-4726-a637-aca6a464208f';
-- 기대: status='rejected'

-- 같은 application의 scoring_results 상태도 같이 확인 (참고용)
SELECT application_id, judged_status, error_message, processing_attempts
FROM public.scoring_results
WHERE application_id = '8fab4ccc-6a9f-4726-a637-aca6a464208f';
-- 기대: judged_status='failed' (yt-dlp 차단 흔적)

-- ─── 원복 ──────────────────────────────────────────────────────────────
BEGIN;

UPDATE public.genesis_applications
SET status = 'pending'
WHERE id = '8fab4ccc-6a9f-4726-a637-aca6a464208f'
  AND status = 'rejected';

COMMIT;

-- ─── 적용 후 검증 ──────────────────────────────────────────────────────
SELECT id, email, status, created_at
FROM public.genesis_applications
WHERE id = '8fab4ccc-6a9f-4726-a637-aca6a464208f';
-- 기대: status='pending'

-- 다른 application 중에도 동일 catch가 더 있는지 점검 (선택)
-- judged_status='failed' AND application.status='rejected'인 row가 더 있다면
-- 같은 자동 매핑 catch 적용된 경우. 발견 시 별도 batch 정정.
SELECT
  ga.id,
  ga.email,
  ga.status AS app_status,
  sr.judged_status,
  sr.error_message
FROM public.genesis_applications ga
JOIN public.scoring_results sr ON sr.application_id = ga.id
WHERE ga.status = 'rejected'
  AND sr.judged_status = 'failed'
ORDER BY ga.created_at;
-- 기대: 0 rows (8fab4ccc 정정 후). 1+ rows면 추가 정정 대상.
