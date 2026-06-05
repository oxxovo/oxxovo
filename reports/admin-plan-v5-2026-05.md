# OXXOVO Admin 계획 v5 — 이메일 시스템 (5차)

**작성일**: 2026-05-24
**작성자**: 지수 (Claude Opus 4.7)
**선행**: Phase 1 (`bd0a9d3`) + 1.5 (`6e39da6`) + 2 (`632452e`) + 2.5 (`9de7f40`) on origin/main
**상태**: TK 대표님 사전 결정 반영 → 결정 잔여 항목 확정 후 5a 시작
**병렬**: `scoring_results` schema 합의 (oxxovo-scoring 레포) — 3차 진입 전 완료 목표

---

## TK 대표님 사전 결정 (메모리)

- **인프라**: Resend Pro $20/월 → API 키 발급 예정 (또는 발급됨)
- **도메인**: `info@oxxovo.com` — Cloudflare + Resend DKIM/SPF/DMARC **인증 완료**
- **시즌 0 트리거 정책**: 시상자만 admin 수동 버튼 (3명, 5분 부담), 그 외 7종 모두 자동
- **시즌 1+ 트리거 정책**: 8종 모두 자동
- **디자인**: OXXOVO 로고 + brand-consistent + 한/영 16개 템플릿

→ 옵션 비교 / 도메인 인증 / from 주소 / Resend 가입은 **모두 확정**. 아래는 시스템 구현 설계.

---

## 8종 이메일 카탈로그 (TK 명시 그대로)

| # | template_key | 흐름 | 대상 수 | 시즌 0 트리거 | 시즌 1+ 트리거 |
|---|---|---|---|---|---|
| 1 | `application_received` | 신청 직후 | ~500명 | **자동** (/apply hook) | **자동** |
| 2 | `waitlisted` | 정원 초과 신청 | 501번째~ | **자동** (/apply hook) | **자동** |
| 3 | `selected_top50` | Top 50 선발 | 50명 | **자동** (status='selected' 트리거) | **자동** |
| 4 | `not_selected` | Top 50 못 듦 | ~450명 | **자동** (status='rejected' 트리거 또는 시즌 마감 시 일괄) | **자동** |
| 5 | `main_round_start` | 본선 시작 | 50명 | **자동 cron** (main_round_start_at 시점) | **자동** |
| 6 | `submission_deadline` | 본선 영상 제출 마감 임박 | 50명 | **자동 cron** (main_round_end_at − 24h) | **자동** |
| 7 | `results_announced` | 결과 발표 | 50명 또는 500명 | **자동 cron** (awards_announcement_at 시점) | **자동** |
| 8 | `awarded_contact_request` | 시상자 축하 + 연락처 입력 | 3명 | **admin 수동 버튼** | **자동** (status='awarded' 트리거) |

**핵심 차이**: #8만 시즌 0에서 수동. 나머지 7종은 시즌 0/1+ 모두 자동.

각 템플릿 × 2 언어 (ko/en) = **총 16개 파일**.

---

## 작업 분할 — 3단계 추천 (5a → 5b → 5c)

| 단계 | 범위 | 시간 | 검증 단위 |
|---|---|---|---|
| **5a** | Resend client + react-email + email_logs 테이블 + Layout 컴포넌트 + 1개 템플릿 (application_received ko/en) 끝까지 작동 | 3~4h | 실제 1통 수신 확인 |
| **5b** | 자동 트리거 5종 (1, 2, 3, 4, 8) + 시즌 0 admin 버튼 (#8 only) + 나머지 10 템플릿 작성 | 4~5h | 신청 → 자동 발송 / admin → 시상자 발송 |
| **5c** | Cron 트리거 3종 (5, 6, 7) + /admin/emails 이력 페이지 (필터/검색/재시도) | 2~3h | cron 발사 확인 + 이력 표시 |

총 코딩: **9~12시간**. 분할 진행 시 각 단계 단독 검증 + push 가능 (1.5/2/2.5차 패턴).

분할 이유:
- 5a 끝에 인프라 정상 작동 확정 (도메인, API, 템플릿 빌드)
- 5b가 가장 큼 — 사용자 마주하는 이메일 대부분 (~90%)
- 5c는 cron 인프라 + admin 이력 페이지 (운영 정밀화)

---

## 1) 기술 스택

### Resend + react-email
- **Resend Pro $20/월** (TK 확정) — 50,000 emails/month
- **react-email** (Resend 자사 라이브러리) — React 컴포넌트로 이메일 작성, HTML 자동 변환
- Vercel/Next.js 네이티브 호환

### 디렉토리 구조
```
lib/email/
├── client.ts                       # Resend instance + sendEmail helper
├── send.ts                         # 템플릿별 send 함수 (sendApplicationReceived 등)
├── log.ts                          # email_logs 기록 헬퍼
├── lang.ts                         # country → ko|en 선택 로직
├── components/
│   ├── Layout.tsx                  # 헤더(로고) + 푸터 공통
│   ├── Button.tsx                  # 보라 그라데이션 CTA
│   ├── Heading.tsx
│   └── Footer.tsx
└── templates/
    ├── ApplicationReceived.tsx     # 단일 컴포넌트, lang prop으로 ko/en 분기
    ├── Waitlisted.tsx
    ├── SelectedTop50.tsx
    ├── NotSelected.tsx
    ├── MainRoundStart.tsx
    ├── SubmissionDeadline.tsx
    ├── ResultsAnnounced.tsx
    └── AwardedContactRequest.tsx
```

**8 템플릿 × 2 언어** — 파일은 8개. 각 파일 안에서 `if (lang === 'ko') ... else ...` 분기. 두 파일로 분리하면 16개. 단일 파일 통합이 유지보수 쉬움.

---

## 2) 트리거 매트릭스 — 코드 위치

```
┌──────────────────────────────────────────────────────────┐
│ app/api/apply/route.ts (자동)                           │
│  ├─ status='pending'  → sendApplicationReceived         │
│  └─ status='waitlist' → sendWaitlisted                  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ app/admin/applications/actions.ts saveStatus (자동)      │
│  ├─ → 'selected' → sendSelectedTop50                    │
│  ├─ → 'rejected' → sendNotSelected                      │
│  └─ → 'awarded'  → (시즌 1+) sendAwardedContactRequest  │
│                    (시즌 0) skip — admin이 버튼으로     │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ app/admin/applications/[id] Detail page (시즌 0 수동)    │
│  └─ [Send awarded email] 버튼 — sendAwardedContactRequest│
│     (status='awarded'일 때만 표시)                       │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ app/api/cron/email-schedule/route.ts (Vercel Cron)       │
│  매일 실행 (또는 시간별):                                 │
│  ├─ 시즌별 main_round_start_at 도달 → sendMainRoundStart│
│  ├─ main_round_end_at − 24h → sendSubmissionDeadline    │
│  └─ awards_announcement_at 도달 → sendResultsAnnounced  │
│  email_logs로 중복 발송 방지                             │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ /admin/emails (이력 페이지)                              │
│  ├─ 시즌별 / 템플릿별 필터                               │
│  ├─ 검색 (이메일, 이름)                                  │
│  ├─ 상태 (sent / failed)                                 │
│  ├─ 실패 재시도 버튼                                     │
│  └─ CSV export                                          │
└──────────────────────────────────────────────────────────┘
```

### Vercel Cron 설정 (`vercel.json`)
```json
{
  "crons": [
    {
      "path": "/api/cron/email-schedule",
      "schedule": "0 * * * *"
    }
  ]
}
```
매시간 정각 실행 → 시즌별 시간 조건 체크 → 도달한 트리거만 발송 + email_logs 기록.

⚠️ Vercel **Pro 플랜에서 cron 무제한** (Hobby는 일일 1개). TK가 Pro라면 OK.

---

## 3) DB 스키마 — `email_logs` 테이블

```sql
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.genesis_applications(id) ON DELETE SET NULL,
  season_id UUID REFERENCES public.seasons(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  template_key TEXT NOT NULL,           -- application_received / waitlisted / ...
  language TEXT NOT NULL CHECK (language IN ('ko', 'en')),
  subject TEXT NOT NULL,
  resend_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'failed', 'queued', 'skipped')),
  error_message TEXT,
  metadata JSONB,                       -- {seasonId, awardRank, sentBy: admin_email}
  sent_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX email_logs_application ON public.email_logs(application_id);
CREATE INDEX email_logs_template ON public.email_logs(template_key);
CREATE INDEX email_logs_season ON public.email_logs(season_id);
CREATE INDEX email_logs_sent_at ON public.email_logs(sent_at DESC);

-- 중복 발송 방지용 partial unique index — 한 (application, template) 조합당 1번만
-- (재시도/reminder는 별도 처리 — status='failed'는 unique 안 걸림)
CREATE UNIQUE INDEX email_logs_dedup ON public.email_logs(application_id, template_key)
  WHERE status = 'sent';

-- GRANT (이전 패턴)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_logs TO authenticated;
GRANT ALL ON public.email_logs TO service_role;

-- RLS — admin만 모든 작업
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_logs_admin_all ON public.email_logs
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
```

**용도:**
- 중복 발송 방지 (cron이 매시간 실행되어도 한 신청자에 한 번만)
- /admin/emails 이력 데이터 소스
- 실패 발송 retry 데이터
- 운영 디버깅 (TK가 "X님이 이메일 받았나?" 확인 가능)

---

## 4) Brand-consistent 디자인 패턴

### Layout (모든 템플릿 공통)
```
┌─────────────────────────────────────────────────┐
│  [OXXOVO 로고 보라]                             │ ← 헤더
├─────────────────────────────────────────────────┤
│                                                 │
│  Heading (28px bold #0a0608)                   │
│                                                 │
│  Body text (16px line-height 1.6)              │
│                                                 │
│  [CTA Button — 보라 그라데이션]                │
│                                                 │
│  Secondary content (14px #666)                  │
│                                                 │
├─────────────────────────────────────────────────┤
│  OXXOVO Labs Inc. · Las Vegas                  │
│  Privacy · Terms                               │ ← 푸터
└─────────────────────────────────────────────────┘
```

### 색상 (이메일 light mode — 클라이언트 호환성)
- Background: `#ffffff`
- Primary purple: `#8b22ff`
- Accent purple: `#b66cff`
- Text: `#0a0608`
- Muted: `#666666`
- Winner accents: `#FFD700` (gold), `#C0C0C0` (silver), `#CD7F32` (bronze)

### 톤 가이드
- 한국어: 정중한 존댓말 ("회원님" / "축하드립니다")
- 영어: 친근한 professional ("Hi {name}" / "Congratulations")
- 8번 (시상자) 한국어: "🏆 축하드립니다! ...님께서 시즌 0 시상자로 선정되셨습니다." — 살짝 격식 + 따뜻
- 8번 영어: "Congratulations, {name}! You're a winner of Season 0."

### 폰트
시스템 fallback (이메일 표준):
`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

### 이미지
절대 URL: `https://oxxovo.com/oxxovo_logo.png`. CDN 캐시는 Vercel.

### Width
600px (이메일 표준).

---

## 5) 한/영 결정

### 현재 데이터 가용
- `genesis_applications.country` — 신청 시 입력 (예: "Korea", "United States", "Japan")
- Supabase Auth user.email — 언어 정보 없음

### 옵션
| | A. country=='Korea' → ko | B. 모든 이메일에 한/영 양쪽 | C. 신청 폼에 language preference |
|---|---|---|---|
| 자동화 | ✅ | ✅ | △ (폼 수정 필요) |
| 정확성 | 한국 거주 외국인 영어 못 받음 | 모두 받음 (길어짐) | 가장 정확 |
| 시즌 0 | OK | 길이 부담 | 폼 수정 → 신청 흐름 변경 |
| 추천 | ★ | | (시즌 1+ 마이그레이션) |

**추천: A (country 기반)** — 단순, 시즌 0 충분. 시즌 1+ C로 마이그레이션 (`/apply` 폼에 language radio 추가).

```ts
// lib/email/lang.ts
export function detectLanguage(country: string | null | undefined): 'ko' | 'en' {
  if (!country) return 'en'
  const c = country.toLowerCase().trim()
  if (c === 'korea' || c === '한국' || c === 'south korea' || c === 'kr') return 'ko'
  return 'en'
}
```

---

## 6) Vercel 환경 변수 추가 (TK 작업)

```
RESEND_API_KEY = re_...           (Resend Dashboard → API Keys)
EMAIL_FROM     = info@oxxovo.com  (already verified)
APP_URL        = https://oxxovo.com  (cron 트리거 인증용)
CRON_SECRET    = <랜덤 32바이트>     (cron route bearer token 검증)
```

`Production + Preview + Development` 모두 체크. `.env.local`에도 동일 추가.

⚠️ `CRON_SECRET`은 Vercel Cron이 자동으로 `Authorization: Bearer <secret>` 헤더로 보냄 — route handler에서 검증해야 외부 공격 방지.

---

## 7) 결정 필요 항목 (TK 대표님 잔여 승인)

대부분 결정됨. 아래만 확정 부탁드립니다:

| # | 항목 | 추천 | 비고 |
|---|---|---|---|
| 1 | 한/영 결정 | **A: country=='Korea' → ko** | 시즌 1+에 C 마이그레이션 |
| 2 | 이메일 톤 — 한국어 | **정중 존댓말** | 시상 이메일은 따뜻 + 격식 |
| 3 | 이메일 톤 — 영어 | **친근 professional** | "Hi {name}" |
| 4 | #4 not_selected 트리거 | (a) status='rejected'로 변경 시 (b) 시즌 마감 + 일정 후 일괄 | **(b) 일괄** — 50명 선발 끝나면 admin 버튼 1번으로 450명 한꺼번에 |
| 5 | #7 results_announced 대상 | (a) 50명만 (Top 50만) (b) 500명 전체 | **(a) 50명** — 본선 결과는 본선 참가자에게만. 전체 신청자에겐 #4로 종료 |
| 6 | unsubscribe 처리 | 시즌 0 면제 (transactional only) | 시즌 1+에서 unsubscribe 시스템 추가 |
| 7 | failed 발송 자동 재시도 | (a) 없음 — admin 수동 (b) 1회 자동 | **(a)** 시즌 0 단순. v6에서 자동 retry |
| 8 | from 이름 표시 | `OXXOVO <info@oxxovo.com>` | 메일박스에서 "OXXOVO"로 표시 |

---

## 8) 작업 시간 예상

| 단계 | 작업 | 시간 |
|---|---|---|
| **사전 (TK)** | RESEND_API_KEY 발급 + Vercel env 4개 추가 | 10분 |
| **5a** | DB email_logs + Resend client + Layout 컴포넌트 + 1 템플릿 (ApplicationReceived) + 실제 1통 발송 검증 | 3~4h |
| **5b** | 나머지 7 템플릿 작성 + 자동 트리거 5종 (/apply hook + saveStatus hook) + 시즌 0 admin 버튼 + 시각 검증 | 4~5h |
| **5c** | Cron route + vercel.json + 이력 페이지 + 재시도 + 시각 검증 | 2~3h |

총 코딩: **9~12h**. TK 직접 작업 (env, 검증): 30~40분.

---

## 9) 다음 단계 — 5차 진행 흐름

1. **이 계획서 검토** (TK + 제니)
2. **결정 7-1~7-8 확정** (대부분 추천대로)
3. **TK 사전 작업**:
   - Resend Dashboard → API Key 생성
   - Vercel env 4개 추가
   - `.env.local`에도 동일 추가 (dev 테스트)
4. **5a 시작** (지수) — DB 마이그레이션 SQL 화면 표시 → 코드 작업 → 1통 실제 수신 검증
5. **시각 검증 → push**
6. **5b → push**
7. **5c → push**
8. **시즌 0 발사 직전 통합 검증** — 테스트 신청 → 모든 자동 이메일 수신 확인

---

## 10) 메모리 업데이트 예정 (5차 시작 후)

- `project_email_system.md` — Resend + react-email + 트리거 매트릭스 아키텍처
- `project_admin_phase_5.md` — 진행 기록
- `reference_resend.md` — 대시보드 위치 + API 키 발급 경로
- `feedback_email_tone.md` — TK 톤 가이드라인 (정중/친근)

---

## 부록 — application_received 템플릿 예시 (단일 파일 두 언어)

```tsx
// lib/email/templates/ApplicationReceived.tsx
import { Body, Container, Head, Heading, Html, Img, Section, Text } from '@react-email/components'
import { Layout } from '../components/Layout'

type Props = {
  lang: 'ko' | 'en'
  creatorName: string
  seasonName: string
  applicationCount: number
  maxApplicants: number
}

export function ApplicationReceived(p: Props) {
  if (p.lang === 'ko') return <Korean {...p} />
  return <English {...p} />
}

function Korean(p: Props) {
  return (
    <Layout lang="ko">
      <Heading style={{ color: '#0a0608', fontSize: 28 }}>
        {p.creatorName}님, 신청이 접수되었습니다.
      </Heading>
      <Text style={{ fontSize: 16, lineHeight: 1.6 }}>
        <strong>{p.seasonName}</strong>에 신청해주셔서 감사합니다.
      </Text>
      <Text style={{ fontSize: 14, color: '#666' }}>
        현재 {p.maxApplicants}명 정원 중 {p.applicationCount}번째 신청자이십니다.
        Triple-AI 채점은 시즌 마감 후 진행되며, 결과는 별도 이메일로 안내드립니다.
      </Text>
    </Layout>
  )
}

function English(p: Props) {
  return (
    <Layout lang="en">
      <Heading style={{ color: '#0a0608', fontSize: 28 }}>
        Application received, {p.creatorName}.
      </Heading>
      <Text style={{ fontSize: 16, lineHeight: 1.6 }}>
        We&rsquo;ve received your entry for <strong>{p.seasonName}</strong>.
      </Text>
      <Text style={{ fontSize: 14, color: '#666' }}>
        You&rsquo;re applicant #{p.applicationCount} of {p.maxApplicants}.
        Triple-AI scoring runs after the season closes — we&rsquo;ll email
        your results when ready.
      </Text>
    </Layout>
  )
}
```

---

검토 후 결정 7-1~7-8 답변 주시면 5a 시작합니다.
