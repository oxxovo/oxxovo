# 5c — Email cron + admin transparency log

상태: 계획 (2026-05-25 draft, 5b 마무리 직후 작성)
선행: 5b 완료 — 8 템플릿 + 인프라 + 자동 트리거 + `email_logs` 테이블

## 목표

5b가 깐 인프라를 시간 기반 트리거와 admin 조회 UI로 확장한다. 핵심 가치 두 가지:
1. **자동 발송** — 운영진 개입 없이 Vercel Cron이 시즌 일정을 보고 발사 → [[project-automation-philosophy]] 일관
2. **투명 공개** — admin이 email_logs를 조회/필터해 무엇이 누구에게 언제 갔는지 확인 가능 → [[project-message-policy]]의 "투명 공개" 약속 첫 단계 (audit_log는 5d+)

---

## 5c-0 (사전 정리, 1줄 SQL)

`award_prizes`의 `grand_final_en` 값을 `"ticket to the Grand Final"` → `"Ticket to the Grand Final"` 대문자 fix.
시상자 이메일에서 bullet 처음 단어로 표시되므로 대문자가 자연.

```sql
UPDATE public.seasons
SET award_prizes = jsonb_set(
  jsonb_set(
    jsonb_set(award_prizes,
      '{1,grand_final_en}', '"Ticket to the Grand Final"'),
    '{2,grand_final_en}', '"Ticket to the Grand Final"'),
  '{3,grand_final_en}', '"Ticket to the Grand Final"')
WHERE id = 'season_0';
```

---

## 5c-1: Cron 3종

### A. `main_round_start`
- **트리거**: `seasons.main_round_start_at` 도래
- **수신자**: `status='selected'`인 applicants
- **발송 주기**: 하루 1번 cron이 시즌 한 번씩 체크. 시작 시각 도달했고 아직 안 보낸 시즌이 있으면 발사.
- **멱등성**: 시즌당 1회만 발사. `email_logs`에 `(template_key='main_round_start', season_id=..., status='sent')` row 존재하면 skip. (현재 dedup는 `application_id` 기준이므로, **시즌 수준 dedup 별도 로직 필요**.)

### B. `submission_deadline`
- **트리거**: `seasons.main_round_start_at + submission_hours - reminder_hour` 도래
- **수신자**: `status='selected'`이고 아직 본선 영상 미제출한 applicants
- **반복**: `seasons.deadline_reminder_hours` 배열 순회 (예: [24, 6] → 2회 발송)
- **멱등성**: 기존 `(application_id, template_key) WHERE status='sent'` partial unique index가 막아주지만 reminder 2회 발송이 필요하면 **`metadata.reminder_hour` 같은 컬럼으로 다중 발송 허용 패턴 결정 필요**. 옵션: index 변경 vs metadata 매칭.

### C. `results_announced`
- **트리거**: `seasons.awards_announcement_at` 도래
- **수신자**: 본선 참가한 모든 applicants (`status IN ('selected','awarded','rejected')`)
- **발송 주기**: 하루 1번 cron, 시즌당 1회.
- **멱등성**: `main_round_start`와 동일 패턴 (시즌 수준).

### Cron 구조 후보

옵션 ①: 단일 `/api/cron/email-tick` 1개 route, vercel.json에서 `*/15 * * * *` 빈도. 내부에서 3 종류 모두 체크.
옵션 ②: 3개 route 분리 (`/api/cron/main-round-start`, `/submission-deadline`, `/results-announced`). 각 1일 1회.

**추천 ①**: cron 설정 단일화 + 시즌 시간 변경에 즉시 반응. 단점은 매 15분 idle 호출. Vercel Free Plan에서 cron 호출 횟수 제한 확인 필요.

### Vercel Cron 인증
- `CRON_SECRET` 환경변수 (이미 있음, 5b test-email에서 사용)
- `Authorization: Bearer ${process.env.CRON_SECRET}` 헤더 검증
- Vercel Cron이 자동으로 이 헤더 보냄

### 결정 필요 사항
1. Cron 빈도 (옵션 ① 15분 vs 옵션 ② 1일)
2. submission_deadline 다중 발송 dedup 패턴 (index 변경 vs metadata 매칭)
3. main_round_start / results_announced 시즌 수준 dedup 처리 — `email_logs.application_id IS NULL` row를 시즌 마커로 사용할지, 별도 `season_email_state` 테이블 만들지

---

## 5c-2: `/admin/emails` 이력 페이지

### 데이터
`email_logs` 테이블 (5b에서 생성). 컬럼: `id, application_id, season_id, to_email, template_key, language, subject, resend_message_id, status, error_message, metadata, sent_at, created_at`.

### UI 구조 (admin 기존 패턴 따름)
- 경로: `/admin/emails`
- AdminShell 안에 list view (admin/applications 패턴 참조)
- 필터: 시즌 / 템플릿 / 상태 / 언어 / 날짜 범위
- 컬럼: `sent_at`, `template_key`, `to_email`, `language`, `status`, (있으면) `error_message`, `subject` 클릭하면 detail 모달
- 페이지네이션: 50건씩, cursor-based (`sent_at`)
- 정렬: 기본 `sent_at DESC`

### Action
조회 전용. 재발송 버튼 ❌ ([[project-automation-philosophy]] — 자동 트리거 외에 운영진 수동 발송 금지).

### 보안
- `requireAdmin()` 게이트
- RLS 정책 이미 admin-only (5b email_logs 마이그레이션에서 설정)

---

## 의존성 검증 필요

5c 진입 전 확인:
1. `seasons.main_round_start_at` / `awards_announcement_at` 컬럼이 실제로 null 아닌 값으로 채워질지 (시즌 0 출시일 결정 시점 → [[project-oxxovo-6-done]] todo #7)
2. `genesis_applications`에 본선 영상 제출 컬럼이 있는지 (submission_deadline 수신자 결정에 필요)
3. Vercel Cron Free Plan 제한 확인 (월 호출 횟수)

---

## 5d 후보 (5c 끝나면 결정)

- **audit_log 시스템** — [[project-message-policy]]에 박힌 약속 "투명 공개" 완전 이행. 모든 saveStatus / saveAwardRank / 시스템 정정 액션을 로그하고 공개 페이지(`/transparency`)에 게시.
- 옥소보 7 todo 나머지 6개 진행 — admin/seasons, platform_config, statement chars, /about /faq 동적화, application 일정 채우기.
