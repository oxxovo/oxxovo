# OXXOVO Admin 페이지 작업 계획

**작성일**: 2026-05-23
**작성자**: 지수 (Claude Opus 4.7)
**검토자**: TK 대표님 + 제니
**상태**: 검토 대기 (승인 후 실제 작업 진행)

---

## 0. 사전 정리 결정 사항

### A. `formatPanelLabel(models)` 단일화

- `tripleOr` local helper (page.tsx) 제거
- 5곳 호출부 `${tripleOr(modelCount)}-AI` → `${formatPanelLabel(season.ai_models)}` 치환
- `modelCount === 3 ? 'three' : modelCount` 자연어 표현 2곳은 이번 범위 밖

### B. `season.name` 분리

- DB UPDATE: `UPDATE seasons SET name = 'GENESIS' WHERE season_number = 0;`
- 코드 변경 0건 (`season.name`, `season.season_number` 호출부 그대로)
- (옵션) `formatSeasonFull(s)` 헬퍼: `"GENESIS (Season 0)"` 공식 표기용

### 사전 정리 작업 순서

1. DB UPDATE 1건 (TK 대표님 직접 실행 or admin에서 수정 가능)
2. page.tsx 5곳 치환 + tripleOr 제거 (5~10분)
3. tsc + grep 검증

→ 사전 정리는 admin 페이지 작업 **1차** 직전에 진행.

---

## 1. 인증 시스템

### 결정: Supabase Auth + `profiles.role` 컬럼 (단순 + 표준)

**vs 대안 (이메일 허용 리스트)**

| 항목 | profiles.role | 이메일 허용 리스트 |
|---|---|---|
| 확장성 | role 추가 가능 (admin, judge, support) | admin 단일 |
| RLS 연동 | 자연 (`role = 'admin'` 체크) | env 변수 노출 위험 |
| TK 외 권한 부여 | DB 한 row 추가 | 코드 수정 + 재배포 |
| 보안 | RLS + auth.uid() | env 의존 |

### 마이그레이션

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TK 대표님 admin 등록 (Supabase Auth에 회원가입 후)
INSERT INTO profiles (id, email, role)
VALUES ((SELECT id FROM auth.users WHERE email = 'tkckusa@gmail.com'), 'tkckusa@gmail.com', 'admin');

-- 미들웨어에서 사용할 RPC
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

### Next.js 보호 패턴

- `middleware.ts`에서 `/admin/*` 경로 진입 시 cookie token 검증 + `profiles.role = 'admin'` 확인
- 미인증/비admin은 `/login`으로 리다이렉트
- 메모리 `feedback_auth_pattern.md`와 충돌 검토 필요:
  - 기존 패턴: `oxxovo_token` localStorage, `supabase.auth.getSession()` 금지
  - admin은 보안 민감 → **예외 추천**: admin만 `supabase.auth.getSession()` + Supabase RLS 사용 (httpOnly cookie)
  - 또는 기존 패턴 유지 + 별도 admin token 분리 시스템 (복잡도 ↑)
  - **TK 대표님 결정 필요**

---

## 2. 페이지 구조

```
/admin                          # 대시보드 (요약 통계)
/admin/seasons                  # 시즌 목록
/admin/seasons/new              # 새 시즌 생성
/admin/seasons/[id]             # 시즌 수정
/admin/seasons/[id]/preview     # 미리보기 (실제 페이지 어떻게 보이는지)

/admin/applications             # 신청자 목록 + 필터
/admin/applications/[id]        # 신청자 상세 + 영상 임베드 + 채점 결과

/admin/emails                   # 이메일 작성 (수동 일괄)
/admin/emails/templates         # 자동 트리거 템플릿
/admin/emails/templates/[id]    # 템플릿 수정
/admin/emails/logs              # 발송 로그
/admin/emails/logs/[id]         # 발송 상세 (실패자, 재발송)

/admin/dashboard                # (4차+) 통계, 차트
```

### 공통 레이아웃

- `app/admin/layout.tsx`: 사이드바 네비게이션, admin 인증 체크 (server-side)
- 색상: 메인 페이지와 일관성 (`#8b22ff` 보라색 + 검정 배경)
- 톤: signup 페이지 디자인 토큰 (메모리 `feedback_design_tokens` 따름)

---

## 3. 시즌 관리 (CRUD)

### 입력 폼 — 8개 그룹

1. **시즌 정보**: `name`, `season_number`, `status` (draft/active/closed/completed)
2. **일정**: `application_open_at`, `application_close_at`, `main_round_start_at`, `main_round_end_at`, `awards_announcement_at`, `scoring_complete_at`
3. **정원/선발**: `max_applicants`, `top_n_advance`
4. **영상 길이**: `application_video_min_seconds`, `_max_seconds`, `main_round_video_seconds`
5. **시간**: `theme_announcement_minutes_before`, `submission_hours`
6. **상금**: `total_prize_pool`, `prize_first/second/third`, `entry_fee`
7. **점수 비율**: `community_vote_weight`, `ai_score_weight` (합=1.0 검증)
8. **채점 가중치**: `scoring_intent_clarity_weight`, `_execution_weight`, `_originality_weight`, `_integrity_weight` (합=1.0 검증)
9. **AI 모델**: `ai_models[]` (name, provider, is_integrity) — 동적 추가/삭제
10. **부정 임계**: `flag_integrity_threshold`, `flag_spread_threshold`

### 검증 (zod 스키마)

```ts
const SeasonSchema = z.object({
  name: z.string().min(1).max(50),
  season_number: z.number().int().nonnegative(),
  // ... 나머지
  community_vote_weight: z.number().min(0).max(1),
  ai_score_weight: z.number().min(0).max(1),
}).refine(
  (s) => Math.abs(s.community_vote_weight + s.ai_score_weight - 1) < 0.001,
  { message: 'community + ai weights must sum to 1.0' }
).refine(
  (s) => Math.abs(s.scoring_intent_clarity_weight + s.scoring_execution_weight + s.scoring_originality_weight + s.scoring_integrity_weight - 1) < 0.001,
  { message: 'scoring weights must sum to 1.0' }
)
```

### UX 디테일

- **미리보기 탭**: 입력 중인 값으로 /, /apply, /rules 페이지 어떻게 보일지 iframe + 더미 상태 모드
- **카운트다운 자동 활성화**: `application_close_at` 입력 시 메인 페이지 `SHOW_COUNTDOWN = true` (현재 코드는 false 하드코딩 → 동적화 필요)
- **저장 시 confirm**: 활성 시즌 변경은 위험 → "정말 저장?" 다이얼로그
- **draft → active 전환**: 별도 액션 버튼 (실수 방지)

---

## 4. 참가자 영상 확인 기능

### 영상 호스팅 현실 (시즌 0)

- 외부 호스팅 (YouTube/Vimeo/Instagram/TikTok)
- DB에 URL만 저장 (`application_video_url`, `main_round_video_url`)
- 사이트에 영상 파일 저장 X

### 영상 임베드 매핑

| 플랫폼 | 임베드 방식 | 인증 필요 |
|---|---|---|
| YouTube | iframe `youtube.com/embed/{id}` | X |
| Vimeo | iframe `player.vimeo.com/video/{id}` | X |
| Instagram | oEmbed API (Facebook Graph) | X (public post) |
| TikTok | oEmbed API `tiktok.com/oembed` | X |
| 기타 (Dropbox 등) | "외부 열기" 버튼 (새 탭) | n/a |

### `lib/video-embed.ts` 새 헬퍼

```ts
export type EmbedResult = { type: 'iframe', src: string } | { type: 'external', url: string }
export function getVideoEmbed(url: string): EmbedResult
```

### 신청자 상세 페이지 레이아웃

- 좌측: 영상 임베드 플레이어 (16:9, 자동재생 X)
- 우측: 신청 정보 + Triple-AI 채점 결과 + Integrity score
- 하단: 부정 의심 플래그 (Integrity < threshold), Top 50 선발 버튼

### 미래 (옥소보 7 진짜 영상)

- 사이트 내 직접 AI 영상 생성 (Runway/Sora/Pika API)
- Supabase Storage 또는 Cloudflare R2 저장
- Patent #1 (Production-Stage Authentication) 실현
- Patent #2 (Server-Authoritative State Control) 실현

→ 이번 admin 작업은 **외부 URL 임베드 + 검토** 범위. 사이트 내 영상 생성은 옥소보 7 별도 작업.

---

## 5. 이메일 트리거 (자동 발송 템플릿)

### `email_templates` 테이블

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'application_received',
    'waitlist_notice',
    'top50_selected',
    'not_selected',
    'main_round_start',
    'submission_deadline_soon',
    'results_announced',
    'prize_winners'
  )),
  locale TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('ko', 'en')),
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  variables JSONB DEFAULT '[]',  -- ['season_name', 'creator_name', ...]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trigger_type, locale)
);
```

### 동적 변수 치환

- 본문에 `${variable_name}` 사용 → 서버에서 치환
- 표준 변수: `season_name`, `season_number`, `creator_name`, `email`, `application_date`, `top_n_advance`, `prize_first`, `panel_label`, `provider_list`
- admin UI에 사용 가능한 변수 목록 표시 + 클릭 삽입

### 코드 변경 영향

- 기존 `app/api/notify/route.ts`의 인라인 HTML → DB 템플릿 fetch로 변경
- 새 헬퍼 `lib/email.ts`:
  - `getTemplate(trigger_type, locale)` 
  - `renderTemplate(template, vars)`
  - `sendTemplatedEmail(to, trigger_type, locale, vars)`

### admin UX

- 템플릿 8종 × 2언어 = 16개 카드
- 카드 클릭 → 편집 화면 (subject + body_html + body_text + 미리보기)
- WYSIWYG는 over-engineering → **plain Markdown + HTML preview** 추천 (TipTap, Lexical 같은 에디터 도입 안 함)

---

## 6. 수동 일괄 발송

### 작성 화면

1. **제목** (subject)
2. **본문** — Markdown 입력 + HTML 변환 미리보기 (실제 이메일 모양)
3. **동적 변수** — `${season_name}`, `${user_name}`, `${user_email}` 등 (시즌 자동 fetch)
4. **언어** — ko / en / both (양쪽 발송)
5. **테스트 발송** — TK 대표님 본인 이메일로 1건 미리 발송 후 확인

### 받는 사람 세그먼트

```ts
type AudienceSegment =
  | { kind: 'all_applicants', season_id?: string }
  | { kind: 'top_n', season_id: string }  // Founding Creators
  | { kind: 'waitlist', season_id?: string }
  | { kind: 'not_selected', season_id: string }
  | { kind: 'main_round_qualified', season_id: string }
  | { kind: 'prize_winners', season_id: string, ranks: number[] }
  | { kind: 'by_country', country: string }
  | { kind: 'by_locale', locale: 'ko' | 'en' }
  | { kind: 'custom', emails: string[] }
```

세그먼트 선택 시 미리 받는 사람 수 표시 ("Top 50 + 시즌 0 = 50명").

### 발송 흐름

```
[작성] → [세그먼트 선택] → [미리보기]
  → "정말 N명에게 발송?" confirm 다이얼로그
  → 진행 상황 (X/N 발송 중) — Server-Sent Events or polling
  → 결과 보고 (성공 N건 / 실패 M건 / 실패 사유)
  → 실패자 재발송 버튼 + email_logs 자동 기록
```

### 안전 장치

- 100명 이상 발송 시 2단계 confirm (실수 방지)
- 24시간 내 동일 세그먼트 중복 발송 경고
- 발송 중 취소 가능 (cancel button)
- Rate limit 자동 처리 (batch 100명씩, sleep 1s)

---

## 7. 기술 고려

### Resend API

- **FROM**: `info@oxxovo.com` (옥소보 5 Cloudflare Email Routing + Resend 도메인 인증 완료, 작동 확인됨)
- **무료 tier**: 3,000건/월 → 시즌 0 (500명 × 6번 트리거 = 3,000건) 빠듯
- **Pro $20/월**: 50,000건/월 → 시즌 1~ 안정
- **권장**: 시즌 0 발사 전 Pro 업그레이드 ($20 → 안전망)

### Batch send

- 100명씩 묶어 `Promise.allSettled` (5초 내 완료)
- 실패 row는 retry queue 별도 저장
- Background job 필요 시 Supabase Edge Function 또는 Vercel Cron

### Env 변수

- `RESEND_API_KEY` — Vercel env에 이미 있음 (옥소보 5 발사 시 확인됨)
- `SUPABASE_SERVICE_ROLE_KEY` — admin 작업용 (RLS 우회). 추가 등록 필요.

---

## 8. RLS / 권한 정책

```sql
-- seasons 테이블
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY seasons_read_all ON seasons FOR SELECT USING (true);
CREATE POLICY seasons_admin_write ON seasons FOR ALL USING (is_admin());

-- email_templates
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_templates_admin_only ON email_templates FOR ALL USING (is_admin());

-- email_logs
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_logs_admin_only ON email_logs FOR ALL USING (is_admin());

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_own_read ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY profiles_admin_all ON profiles FOR ALL USING (is_admin());
```

---

## 9. 새 DB 테이블 (마이그레이션 SQL)

### 신규 추가

```sql
-- 1. profiles (admin role)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. email_templates
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'en',
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  variables JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trigger_type, locale)
);

-- 3. email_logs
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_by UUID REFERENCES profiles(id),
  trigger_type TEXT,                       -- 자동 발송 시 채움
  manual_subject TEXT,                     -- 수동 발송 시 채움
  audience_kind TEXT NOT NULL,             -- 'all_applicants', 'top_n', etc.
  audience_params JSONB,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'bounced')),
  error_message TEXT,
  resend_id TEXT                           -- Resend API ID for tracking
);

CREATE INDEX email_logs_sent_at_idx ON email_logs (sent_at DESC);
CREATE INDEX email_logs_audience_idx ON email_logs (audience_kind, sent_at DESC);
CREATE INDEX email_logs_recipient_idx ON email_logs (recipient_email);
```

### 기존 활용 (변경 0)

- `seasons` — 모든 운영 파라미터 (컬럼 추가 0)
- `genesis_applications` — 신청자 + 영상 URL

### Optional (보류)

- `platform_config` — 회사 차원 설정 (IP 정보 등) — 현재는 `lib/ip-info.ts` 정적 모듈로 충분, 필요 시 별도 작업

---

## 10. 단계별 작업 분할

### 1차 — 인증 + 시즌 CRUD (예상 6~8시간)

- `profiles` 테이블 + admin RPC + RLS
- `middleware.ts` admin route 보호
- `/admin` 대시보드 shell
- `/admin/seasons` 목록 + `/admin/seasons/[id]` 수정 + `/new` 생성
- zod validation + 미리보기 탭

→ TK 대표님이 admin에서 시즌 0 파라미터 직접 수정 가능

### 2차 — 신청자 + 영상 확인 (예상 4~6시간)

- `/admin/applications` 목록 + 필터 (시즌, 상태, 채점 점수 범위)
- `/admin/applications/[id]` 상세 + 영상 임베드 + 채점 결과
- `lib/video-embed.ts` (YouTube/Vimeo/Instagram/TikTok)
- Top 50 선발 액션 (status 변경)

→ TK 대표님이 영상 보면서 Top 50 선발 가능

### 3차 — 이메일 트리거 + 템플릿 (예상 6~8시간)

- `email_templates` 테이블 + 16개 카드 (8 trigger × 2 locale)
- `lib/email.ts` (renderTemplate, sendTemplatedEmail)
- `app/api/notify/route.ts` → DB 템플릿 fetch로 전환
- `/admin/emails/templates` 편집 화면 + Markdown 미리보기

→ TK 대표님이 자동 발송 메일 코드 수정 없이 수정 가능

### 4차 — 수동 일괄 발송 (예상 8~10시간)

- `/admin/emails` 작성 화면 (제목 + Markdown + 변수)
- 세그먼트 선택 UI + 받는 사람 수 미리보기
- 테스트 발송 (본인에게 1건)
- 안전 confirm + 진행 상황 + 결과 보고
- Batch send + retry queue

→ TK 대표님이 admin에서 직접 공지 메일 작성 + 발송 가능

### 5차 — 발송 로그 + 통계 (예상 4~6시간)

- `email_logs` 테이블 + RLS
- `/admin/emails/logs` 목록 + 검색 + 필터
- `/admin/emails/logs/[id]` 상세 + 실패자 재발송
- `/admin/dashboard` 차트 (신청 증가, 발송 통계)

→ 운영 데이터 가시화 + 회고

### 총 예상

- **합계: 28~38시간** (1주~1.5주)
- 시즌 0 발사 전 **최소 1차 + 2차 + 3차** 필수 (~16~22시간)
- 4차 + 5차는 시즌 0 발사 직후 ~ 시즌 1 준비기에 추가

---

## 11. 의문/결정 사항 (TK 대표님 확인 필요)

1. **인증 패턴 예외** — admin은 Supabase Auth (`supabase.auth.getSession()`) 사용 가능한가?
   - 메모리 `feedback_auth_pattern`는 일반 사용자 대상
   - 추천: admin만 예외 허용 (보안 + 표준)
2. **Resend Pro 업그레이드** — 시즌 0 발사 전 $20/월 결제?
3. **DB 마이그레이션 실행 주체** — TK 대표님이 Supabase Dashboard에서 직접? 또는 마이그레이션 파일로 자동?
4. **admin 사이드바 네비** — 메인 사이트와 시각 분리 (다른 색?) 또는 동일 톤?
5. **다국어 우선순위** — 시즌 0은 영어 우선 + 한국어 점진 추가?
6. **세션 0 응급 메일** — admin 작업 완료 전 발송할 메일이 있다면 임시 처리 (notify/route.ts 직접 수정)?

---

## 12. 통합 운영 센터 비전

Admin 페이지 = OXXOVO 통합 운영 센터:

- 🏗️ **시즌 운영** (모든 파라미터 admin 수정)
- 📹 **영상 검토** (Top 50 선발, 부정 확인)
- 📧 **이메일 관리** (자동 + 수동 일괄 + 로그)
- 📊 **(5차) 대시보드** (신청 현황, 채점 결과, 통계)

**TK 대표님이 코드 수정 없이 OXXOVO 모든 운영 가능.**
옥소보 6 원칙의 실제 실현 + 시즌 무한 확장 인프라.
