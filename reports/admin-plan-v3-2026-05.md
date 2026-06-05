# OXXOVO Admin 계획 v3 — 1.5차 추가 작업

**작성일**: 2026-05-24
**작성자**: 지수 (Claude Opus 4.7)
**선행**: `reports/admin-plan-v2-2026-05.md`
**상태**: 1차 완료 (admin 인증 + 시즌 CRUD 시각 검증 통과). 본 문서는 1차와 2차 사이에 들어갈 **1.5차** 작업 두 가지를 정의.

---

## v2 → v3 변경 요약

1차가 끝나고 시각 검증 중 TK 대표님이 짚으신 두 가지 누락:

| 작업 | 우선순위 | 예상 시간 | 시즌 0 발사 전 필수? |
|---|---|---|---|
| **A. Prize 분배 % 시스템** | 시급 (시즌 0 운영 정확도) | 1~2h | ✅ |
| **B. Admin 한국어 지원** | 운영 편의 | 1.5~3h (옵션에 따라) | ✅ (TK 본인이 사용) |

두 작업 모두 **2차 (`/admin/applications`) 진입 전에** 끝내는 것이 합리적.
이유: A는 시즌 0 상금 정확도, B는 모든 admin 페이지에 영향 → 2차 페이지가 늘기 전에 i18n 토대를 잡아야 작업량 폭증 방지.

---

# A. Prize 분배 % 시스템

## 현재 문제

`seasons` 테이블의 상금 컬럼은 **절대 금액**:

```
total_prize_pool: 2000
prize_first:      1200   (60%)
prize_second:      500   (25%)
prize_third:       300   (15%)
```

운영자가 admin에서 total을 2500으로 바꿔도 1/2/3등은 손으로 다시 입력해야 함. 일관성 깨질 위험.
또한 시즌별 분배 % 변동 (예: 50/30/20)은 운영 결정인데, 폼에서는 "비율" 개념이 없고 절대값만 보여서 직관 떨어짐.

## 해결책 — Generated Column 패턴 (강력 추천)

`prize_first/second/third`를 **DB가 자동 계산**하는 STORED generated column으로 전환.
운영자는 `total_prize_pool` + 3개 `_pct` 컬럼만 입력. PG가 곱셈/반올림 자동 처리.

**장점:**
- 클라이언트/서버/PG 어디에서 읽어도 항상 일관 (single source of truth)
- 기존 메인 페이지 코드는 `season.prize_first` 그대로 사용 — **읽기 경로 0 변경**
- 시즌별 % 변동 자유 (시즌 0=60/25/15, 시즌 5=50/30/20 등)
- DB constraint로 합계 100% 강제 → 잘못된 입력 원천 차단

**단점:**
- DROP COLUMN 후 GENERATED로 재생성 필요 (현재 데이터 보존 불필요 — 어차피 계산 가능)
- generated 컬럼은 INSERT/UPDATE 시 명시적으로 값을 줄 수 없음 → `season-schema.ts`에서 prize_first/second/third 입력 필드 제거 필수

## DB 마이그레이션 SQL (미리보기)

```sql
-- 1. 비율 컬럼 추가 (시즌 0 기본값 60/25/15)
ALTER TABLE public.seasons ADD COLUMN prize_first_pct  NUMERIC(5,2) NOT NULL DEFAULT 60.00;
ALTER TABLE public.seasons ADD COLUMN prize_second_pct NUMERIC(5,2) NOT NULL DEFAULT 25.00;
ALTER TABLE public.seasons ADD COLUMN prize_third_pct  NUMERIC(5,2) NOT NULL DEFAULT 15.00;

-- 2. 합계 100% 강제 (부동소수 오차 허용 0.01)
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_prize_pct_sum
  CHECK (ABS(prize_first_pct + prize_second_pct + prize_third_pct - 100) < 0.01);

-- 3. 각 비율 0~100 범위
ALTER TABLE public.seasons
  ADD CONSTRAINT seasons_prize_pct_range
  CHECK (
    prize_first_pct  BETWEEN 0 AND 100 AND
    prize_second_pct BETWEEN 0 AND 100 AND
    prize_third_pct  BETWEEN 0 AND 100
  );

-- 4. 기존 절대 금액 컬럼을 generated로 교체
--    (STORED — 인덱스 가능, 일반 컬럼처럼 SELECT됨)
ALTER TABLE public.seasons DROP COLUMN prize_first;
ALTER TABLE public.seasons DROP COLUMN prize_second;
ALTER TABLE public.seasons DROP COLUMN prize_third;

ALTER TABLE public.seasons ADD COLUMN prize_first  NUMERIC
  GENERATED ALWAYS AS (ROUND(total_prize_pool * prize_first_pct  / 100, 2)) STORED;
ALTER TABLE public.seasons ADD COLUMN prize_second NUMERIC
  GENERATED ALWAYS AS (ROUND(total_prize_pool * prize_second_pct / 100, 2)) STORED;
ALTER TABLE public.seasons ADD COLUMN prize_third  NUMERIC
  GENERATED ALWAYS AS (ROUND(total_prize_pool * prize_third_pct  / 100, 2)) STORED;
```

**선행 점검 SQL** (실행 전 현재 row 확인):
```sql
SELECT id, name, season_number, total_prize_pool, prize_first, prize_second, prize_third
FROM public.seasons ORDER BY season_number;
```
값을 메모해두고 실행 → 마이그레이션 후 prize_first 등이 동일하게 계산되는지 검증.

## 앱 코드 변경

### `lib/season-schema.ts`

- 신규 필드 3개 추가 (`coerce.number().min(0).max(100)`)
- 합계 = 100 refine
- **`prize_first/second/third` 입력 필드 제거** (generated라 INSERT 시 보내면 PG 에러)
- `DEFAULT_SEASON`에서 pct 기본값 60/25/15, prize_first 등 제거

### `lib/seasons.ts`

- `Season` 타입에 `prize_first_pct/second_pct/third_pct` 추가
- `prize_first/second/third`는 그대로 유지 (DB가 계산해서 돌려주는 값)
- 변경 거의 없음

### `app/admin/seasons/SeasonForm.tsx`

기존 "Prizes (USD)" 섹션을 두 섹션으로 분리:

**Pool**:
- Total prize pool (USD) — 단일 입력
- Entry fee (USD)

**Prize split (%)** — 신규 섹션, 실시간 미리보기:
- 1st place %    → "= $1,500 at $2,500 pool"
- 2nd place %    → "= $625"
- 3rd place %    → "= $375"
- 합계 표시: "Total: 100.00 % ✓" (아니면 빨간 경고)

미리보기 계산은 useState 기반 controlled component로. saveSeason은 % 값만 전송, prize_first는 안 보냄.

### `app/admin/seasons/actions.ts`

`persistSeason`의 `payload`에서 prize_first/second/third가 자동 제외됨 (Zod 스키마에서 빠지므로). 명시적 코드 변경 불필요.

### 메인 사이트 (`app/page.tsx`)

**0 변경**. `season.prize_first` 그대로 출력 — DB가 계산한 값을 받음.

## 검증 절차

1. 마이그레이션 SQL 실행 → 진단 SELECT로 prize_first 값 일치 확인
2. `npm run dev` → /admin/seasons/[id] → Total을 2500으로 변경, 분배는 60/25/15 그대로 → Save
3. 메인 페이지 새로고침 → 1st = $1,500, 2nd = $625, 3rd = $375 (자동 반영)
4. /admin 돌아가서 분배를 50/30/20으로 변경 → Save → 메인 1st = $1,250 확인

---

# B. Admin 한국어 지원

## 현재 상태

모든 admin 페이지 라벨/안내가 영어. TK 대표님이 한국어로 운영하시므로 직관성 떨어짐.
대상 페이지: `/admin`, `/admin/seasons`, `/admin/seasons/new`, `/admin/seasons/[id]`, `/admin/login`, `/admin/reset-password`, layout 사이드바.

총 라벨 개수 추정: 100~150개 (button, label, helper text, error message 포함).

## 옵션 비교

### 옵션 1: `next-intl` (TK 대표님 제안)

**스펙:**
- Next.js App Router 공식 패턴
- 번들 ~25-30KB
- `messages/ko.json` + `messages/en.json` 분리
- 토글 UI 가능 (`<Link href="/en/admin">`)
- 미래 공개 사이트 다국어로 확장 가능

**장점:**
- 정석. 향후 공개 사이트(landing/rules/faq)도 다국어 가능 → 일관 구조
- 타입 안전 (`useTranslations`)
- Server Components 친화

**단점:**
- 초기 셋업 비용 (`next.config.ts` plugin, locale routing 설계)
- admin만 다국어이고 공개 페이지는 영어인 현재 구조와 충돌 가능 — admin만 격리 필요
- 시간: **3~4h** (셋업 1h + 번역 2~3h)

### 옵션 2: Admin 전용 단순 lookup (가벼운 대안)

**스펙:**
- `lib/admin-i18n.ts`에 한국어 라벨 객체 1개
- 컴포넌트에서 `t('seasons.new.title')` 식으로 호출
- 토글 없이 한국어 고정 (TK 단독 사용 가정)

**장점:**
- 짧음. 라이브러리 0 의존성
- admin만 영향 — 공개 사이트는 그대로 영어 유지
- 시간: **1.5~2h** (번역이 대부분)

**단점:**
- 영어 옵션 필요해지면 토글 추가 작업 필요 (옵션 1로 마이그레이션 부담)
- 공개 사이트 다국어화 결정 시 두 시스템 공존하는 어색함

### 옵션 3: 직접 하드코딩 (가장 빠름)

영어 라벨을 한국어로 그냥 교체. 토글 없음, lookup 없음.

- 장점: 가장 빠름 (1h)
- 단점: 영어 백업 영구히 잃음. 외부 staff 합류 시 다시 작업.

## 추천

**옵션 2로 시작 → 필요해지면 옵션 1로 마이그레이션.**

근거:
- 현재 admin은 TK 단독 사용 → 한국어 고정으로 충분
- 옵션 1은 공개 사이트 다국어화 결정이 선행되어야 깔끔 (현재 미정)
- `t('...')` 호출 패턴은 옵션 2/1 둘 다 동일 → 나중 마이그레이션 코스트 낮음
- 시간 차이 1.5~2h vs 3~4h — 2차 작업으로 빨리 넘어가는 게 시즌 0 일정에 유리

**옵션 1을 원하시면** 알려주세요 — 그땐 공개 사이트(landing/rules/faq) 한국어 버전 작업 범위도 함께 결정해야 함.

## 옵션 2 구조 (선택 시)

```ts
// lib/admin-i18n.ts
export const t = {
  common: {
    save: '저장',
    cancel: '취소',
    delete: '삭제',
    saving: '저장 중...',
    saved: '저장됨',
    back: '뒤로',
    danger_zone: '위험 영역',
  },
  nav: {
    dashboard: '대시보드',
    seasons: '시즌 관리',
    applications: '지원자',
    winners: '우승자',
    emails: '이메일',
    soon: '준비 중',
    view_public: '← 공개 사이트 보기',
    sign_out: '로그아웃',
  },
  dashboard: {
    title: '대시보드',
    welcome: (name: string) => `${name}님 환영합니다.`,
    stat_total_seasons: '전체 시즌',
    stat_current_season: '현재 시즌',
    stat_total_applicants: '전체 지원자',
    recent_seasons: '최근 시즌',
    view_all: '전체 보기 →',
    quick_actions: '빠른 작업',
    new_season: '+ 새 시즌',
    manage_seasons: '시즌 관리',
  },
  seasons: {
    title: '시즌',
    subtitle: '모든 시즌의 운영 파라미터.',
    new: '+ 새 시즌',
    col_name: '이름',
    col_number: '번호',
    col_status: '상태',
    col_prize_pool: '상금 풀',
    col_capacity: '정원',
    col_top_n: 'Top N',
    col_open: '신청 시작',
    edit: '수정 →',
    empty: '아직 시즌이 없습니다.',
    deleted: '시즌이 삭제되었습니다.',
    load_failed: (msg: string) => `시즌을 불러오지 못했습니다: ${msg}`,
  },
  season_form: {
    group_info: '시즌 정보',
    group_capacity: '정원 및 선발',
    group_video: '영상 길이 (초)',
    group_timing: '타이밍',
    group_prize_pool: '상금 풀',
    group_prize_split: '상금 분배 (%)',
    group_scoring_split: '채점 비율 (합계 1.0)',
    group_ai_weights: 'AI 채점 가중치 (합계 1.0)',
    group_ai_panel: 'AI 패널',
    group_integrity: '진정성 임계값',
    group_schedule: '일정',
    field_name: '이름',
    field_season_number: '시즌 번호',
    field_status: '상태',
    field_max_applicants: '최대 지원자',
    field_top_n: '본선 진출 N',
    // ... (총 ~50개)
    saved_banner: '시즌 저장됨. 공개 사이트 캐시 갱신 완료.',
    create_btn: '시즌 생성',
    save_btn: '변경사항 저장',
  },
  delete: {
    button: '시즌 삭제',
    confirm_title: '이 시즌을 삭제하시겠습니까?',
    confirm_body: (name: string) =>
      `공개 사이트의 모든 참조에서 ${name}이(가) 영구 제거됩니다. 이 시즌의 지원서는 삭제되지 않지만 고아 상태가 됩니다. 확인하려면 'delete ${name}'을 입력하세요.`,
    confirm_input_placeholder: (name: string) => `delete ${name}`,
    delete_forever: '영구 삭제',
    cancel: '취소',
    deleting: '삭제 중...',
  },
  login: {
    title: 'Admin 콘솔',
    subtitle: '관리자 전용.',
    email: '이메일',
    password: '비밀번호',
    sign_in: '로그인',
    signing_in: '로그인 중...',
    err_not_admin: '관리자 권한이 없는 계정입니다.',
    err_recovery_expired: '비밀번호 복구 링크가 만료되었습니다. 다시 요청하세요.',
    err_callback_failed: (reason?: string) =>
      `로그인 콜백 실패${reason ? `: ${reason}` : '.'}`,
    err_missing_code: '로그인 링크에 필수 파라미터가 누락되었습니다.',
  },
  reset_password: {
    title: '새 비밀번호 설정',
    signed_in_as: (email: string) => `${email}로 로그인됨`,
    new_password: '새 비밀번호',
    confirm_password: '비밀번호 확인',
    min_length: (n: number) => `비밀번호는 최소 ${n}자 이상이어야 합니다.`,
    mismatch: '비밀번호가 일치하지 않습니다.',
    submit: '새 비밀번호 설정',
    submitting: '업데이트 중...',
    success: '비밀번호가 업데이트되었습니다. 이동 중...',
  },
  layout: {
    admin_console: 'Admin 콘솔',
    admin_mode_warning: '⚠ Admin 모드 — 변경사항은 공개 사이트에 즉시 반영됩니다',
  },
}
```

상수성 라벨은 직접 문자열, 변수 들어가는 건 함수. 타입스크립트가 자동 추론.

## 작업 단계 (옵션 2)

1. `lib/admin-i18n.ts` 작성 — 위 구조대로 모든 라벨 한국어로
2. 각 admin 파일에서 `import { t } from '@/lib/admin-i18n'` 후 하드코딩 영어를 `t.섹션.키`로 교체
   - `app/admin/layout.tsx`
   - `app/admin/page.tsx` (Dashboard)
   - `app/admin/seasons/page.tsx`
   - `app/admin/seasons/SeasonForm.tsx` (가장 큰 작업)
   - `app/admin/seasons/[id]/page.tsx`
   - `app/admin/seasons/new/page.tsx`
   - `app/admin/seasons/DeleteSeasonButton.tsx`
   - `app/admin/login/page.tsx` + `LoginForm.tsx`
   - `app/admin/reset-password/page.tsx` + `ResetPasswordForm.tsx`
3. 시각 검증 — 모든 페이지 새로고침해서 한국어 표시 확인 + 오타 검수

---

## 작업 순서 (확정)

```
[지금]
1차 push  → 인증 + 시즌 CRUD + auth callback + reset password

[1.5차 — 본 계획서]
A. Prize 분배 % 시스템 (1~2h)
   - DB 마이그레이션 SQL 실행 (TK 대표님)
   - season-schema/SeasonForm 수정 (지수)
   - 시각 검증
B. Admin 한국어 (옵션 2 추천, 1.5~2h)
   - lib/admin-i18n.ts 작성
   - 9개 admin 파일에서 라벨 치환
   - 시각 검증

[2차 — v2 plan 그대로]
/admin/applications — 지원자 명단 + 필터 + 영상 + 연락처
```

A를 먼저 하는 이유: SeasonForm을 두 번 건드리지 않기 위함 (A에서 Prize 섹션 구조 변경 → 그 후 B에서 라벨 한국어화. 반대로 하면 라벨 작업이 무효화됨).

---

## 결정 필요 — TK 대표님 검토 후 알려주세요

1. **A 마이그레이션** — Generated column 접근 OK? 아니면 다른 패턴 (trigger 등) 선호?
2. **B 옵션** — 옵션 2 (단순 lookup, 한국어 고정) vs 옵션 1 (next-intl, 토글 가능)
3. **순서** — A → B 추천 (위 사유). 다른 순서 원하시면 알려주세요.
