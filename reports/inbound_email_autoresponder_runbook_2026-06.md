# Inbound 이메일 자동응답 — 구축·배포 런북 (2026-06)

info@oxxovo.com 으로 들어오는 문의를 챗봇 KB v4로 자동 답변하고, 범위밖·민감 문의는
운영진에게 에스컬레이션하는 파이프라인. 7/1 홍보 시작 전 가동 목표.

## 아키텍처

```
info@oxxovo.com 수신
   │
   ▼
Cloudflare Email Worker (oxxovo-inbound-email)   ← reports/cloudflare-email-worker/
   ├─ 원본을 ops 받은편지함으로 forward (항상, 안전망)
   └─ MIME 파싱 → JSON POST (x-inbound-secret)
        │
        ▼
POST /api/email/inbound  (Vercel, Next.js)        ← app/api/email/inbound/route.ts
   ├─ 시크릿 검증 / 루프·스팸 가드 / Message-ID 중복제거 / 발신자 일일 cap
   ├─ classifyAndDraft(KB v4)                      ← lib/email/inbound-reply.ts
   │     ├─ in-scope  → Resend 자동 회신 (스레딩 In-Reply-To)
   │     └─ out-of-scope / 민감 → sendAdminAlert 로 ops 에스컬레이션 (자동회신 X)
   └─ email_inbound_log 기록 (admin 투명 로그)      ← reports/email_inbound_log_migration_2026-06.sql
```

설계 원칙: 분류·발송·가드는 **전부 Next.js 라우트**에 있음(단일 진실원). Worker는
파싱·중계·forward만 하는 얇은 계층. webhook이 죽어도 forward는 항상 도착.

## 안전장치 (자동응답 핵심)

- **루프 방지**: `@oxxovo.com`/`@oxxovo.ai` 자기 자신, no-reply/mailer-daemon/postmaster,
  `Auto-Submitted` 헤더(no 아님), `Precedence: bulk/list/junk`, `List-Id`/`List-Unsubscribe`,
  "Auto reply / Out of office / 부재중 / 자동 회신" 제목 → **자동회신 절대 안 함**(skipped 로깅).
- **민감 키워드 게이트**(모델 호출 전): 환불/결제/청구, 법률/변호사/소송/저작권침해, 언론/기자/취재,
  제휴/협찬/스폰서/투자/인수, 개인정보·계정 삭제(GDPR) → **무조건 사람에게 전달**.
- **모델 불확실**: KB로 답 못 하면 모델이 "info@ 문의" 가드 문구 출력 → 그 경우도 에스컬레이션.
- **중복제거**: Message-ID UNIQUE (Cloudflare 재시도 방어).
- **발신자 일일 cap**: UTC 하루 actioned(회신+에스컬레이션) 6건 초과 → skipped.
- **회신 실패 시**: Resend 발송 실패하면 고객을 방치하지 않도록 ops 에스컬레이션으로 전환.

## TK 액션 체크리스트 (이 순서대로)

### 1) Supabase — 마이그레이션 실행
`reports/email_inbound_log_migration_2026-06.sql` 를 Supabase SQL Editor에서 Run.
검증 쿼리로 9개 컬럼 확인.

### 2) 시크릿 생성 (한 값을 양쪽에 동일하게)
임의의 긴 랜덤 문자열 1개 생성. 예) `openssl rand -hex 32`
이 값을 **Vercel**과 **Cloudflare Worker** 양쪽에 넣음(반드시 동일).

### 3) Vercel — 환경변수 추가 (production)
- `EMAIL_INBOUND_SECRET` = 위 시크릿
- (기존 `ANTHROPIC_API_KEY`, `RESEND_API_KEY` 이미 존재 — 재활용)
추가 후 재배포해야 런타임에 반영됨. (auto-deploy OFF → CLI 통제배포)

### 4) Cloudflare — Email Routing에 Email Workers 활성화 확인
- Cloudflare 대시보드 → 도메인(oxxovo.com) → **Email → Email Routing**.
- 현재 info@ 가 "forward only"로 잡혀 있으면, 해당 주소의 라우트 action을
  **"Send to a Worker"** 로 변경(아래 6단계에서 만든 Worker 지정).
- ops 받은편지함 주소(`FORWARD_TO`)는 Email Routing의 **Destination addresses**에
  미리 verified 상태여야 forward가 동작함.

### 5) Cloudflare Worker — 배포
```
cd reports/cloudflare-email-worker
npm install
# wrangler.toml 의 FORWARD_TO 를 실제 ops 주소로 수정
npx wrangler secret put EMAIL_INBOUND_SECRET   # 2)의 값 입력
npx wrangler deploy
```

### 6) Email Routing 라우트 → Worker 바인딩
- Email Routing → Routes → info@oxxovo.com → action **"Send to a Worker"** →
  `oxxovo-inbound-email` 선택 후 저장.
- (catch-all 을 쓰는 경우 catch-all 라우트를 Worker로 지정.)

### 7) E2E 검증
- 외부 메일주소에서 info@oxxovo.com 으로 **KB 안 질문**(예: "How do I apply?") 발송
  → 자동 회신 도착 + `email_inbound_log` 에 action='replied'.
- **민감 질문**(예: "I want a refund") 발송 → 자동회신 없음 + ops에 에스컬레이션 메일 도착
  + action='escalated'.
- 같은 메일 재발송(동일 Message-ID) → 중복 무시(duplicate).

## 신규 환경변수 요약
| 변수 | 위치 | 비고 |
|---|---|---|
| `EMAIL_INBOUND_SECRET` | Vercel + Cloudflare Worker | 동일 값. webhook 인증 |
| `INBOUND_WEBHOOK_URL` | Cloudflare Worker (vars) | https://www.oxxovo.ai/api/email/inbound |
| `FORWARD_TO` | Cloudflare Worker (vars) | verified ops 받은편지함 |

## 의존/후속
- 에스컬레이션 수신처: 현재 `lib/email/admin-alert.ts` 의 info@oxxovo.com 단일.
  **멀티 admin(매니저)** 기능 들어오면 매니저 이메일로 확장 가능(별도 작업).
- `/admin/messages` 에 `email_inbound_log` 노출(읽기) — 후속 UI 작업으로 추가 가능.

## 대안 (inbound 막힐 시)
Cloudflare forward 유지 + 받은편지함(Gmail/Workspace) 자동회신 템플릿("접수됐습니다,
24시간 내 회신") + 사람 triage. 코드 없이 즉시 가능하나 진짜 자동응답은 아님.
