# OXXOVO Admin 계획 v4 — 2차 + 2.5차 통합

**작성일**: 2026-05-24
**작성자**: 지수 (Claude Opus 4.7)
**선행**: Phase 1 (`bd0a9d3`) + Phase 1.5 (`6e39da6`) on origin/main — prod 검증 완료
**상태**: TK 대표님 검토 대기 → 승인 후 2차 시작

---

## 사업 결정 요약 — 신청자 연락처 흐름 (Option A 채택)

```
[신청] ──── email만 (글로벌 평등) ────────────────────►
[채점] ──── Triple-AI → Top 50 자동 선발 ──────────────►
[본선] ──── 시상자 결정 (admin에서 TK 클릭) ──────────►
[알림] ──── status='awarded'로 변경 ──────────────────►
[입력] ──── 시상자 본인이 /profile에서 직접 입력 ────►
[집계] ──── /admin/contacts에 자동 표시 ─────────────►
```

**TK 대표님 수동 follow-up = 0**. 시상자 셀프 정보 입력으로 보안↑ + 운영 코스트↓.

---

## 작업 분할 — **분할 추천 (2차 → 검증 → 2.5차)**

| 옵션 | 시간 | 장점 | 단점 |
|---|---|---|---|
| **분할 (추천)** | 5~7h + 3~4h | 2차만 단독 검증 가능 (시상자 데이터 없어도 admin 명단 확인 OK), 1.5처럼 단계별 push, 롤백 용이 | push 2번 |
| 통합 | 8~11h | push 1번 | 한 번에 검증할 양 큼, 문제 발생 시 격리 어려움 |

분할 진행 시:
- **2차 끝**: `/admin/applications` + `/admin/applications/[id]` + `/admin/contacts` 페이지 작동. 시상자 데이터는 비어있어도 페이지/필터/CSV 모두 검증 가능.
- **2.5차 끝**: `/profile` 확장 + 시상자 폼. 전 흐름 (신청 → 시상 선정 → 폼 입력 → admin 표시) 통합 검증.

---

# 2차 — Admin 신청자 관리 (5~7h)

## 페이지 구조

### `/admin/applications`

목록 페이지 — server 컴포넌트에서 시즌별 데이터 페치, client view에서 필터/검색/정렬/CSV.

**상단 컨트롤:**
- 시즌 선택 드롭다운 (기본 = active 시즌)
- 세그먼트 필터: 전체 / Top 50 / Waitlist / 시상자 (status별)
- 검색 박스 (이름, 이메일, 채널 URL — client-side fuzzy)
- 정렬 select (신청 시간 ↓, 점수 ↓, 이름 가나다)
- CSV Export 버튼 (현재 필터 + 검색 결과만)

**테이블 컬럼:**
| Name | Country | Status | AI Service | Submitted | Score | (action) |
|---|---|---|---|---|---|---|

- Score는 시즌 0 채점 전엔 `—` 표시, 3차에서 실제 값 연결
- 클릭 시 `/admin/applications/{id}` 이동

**페이지네이션:** 시즌 0은 ≤500명이라 단순 무한스크롤 또는 페이지당 50 정도. 시즌 1+에서 누적되면 server-side filter로 전환 (v5에서).

### `/admin/applications/[id]`

개별 상세 — 4섹션 레이아웃.

1. **Applicant**: name / email / country / channel_url / ai_service / created_at / status (StatusBadge)
2. **Statement**: creator_statement (150~250자 본문)
3. **Video**: 영상 임베드 (아래 매트릭스 참조)
4. **Admin actions**:
   - 메모 (textarea, admin_notes 저장)
   - 상태 변경 (Top 50로 승격 / 거부 / 부정 의심 플래그)
   - 시상 지정 (시즌 후반에 — 1등/2등/3등)
5. **Scoring** (3차에서 통합 — 2차는 placeholder)

### `/admin/contacts`

시상자 연락처 집계 — 시즌 횡단 명단.

**컬럼:**
| Season | Name | Email | Award | Phone | Address | Messenger | Filled at |

- `winner_info_completed_at` 기준 정렬
- 비어있는 시상자는 회색 표시 + "대기 중" 배지
- CSV Export

## 영상 임베드 매트릭스

| 플랫폼 | URL 패턴 감지 | 처리 |
|---|---|---|
| **YouTube** | `youtube.com/watch?v=` `youtu.be/` `youtube.com/shorts/` | `<iframe>` `https://www.youtube.com/embed/{id}` |
| **Vimeo** | `vimeo.com/{digits}` | `<iframe>` `https://player.vimeo.com/video/{id}` |
| **TikTok** | `tiktok.com/@{user}/video/{id}` | `<iframe>` `https://www.tiktok.com/embed/v2/{id}` (블록 가능, fallback 필요) |
| **Instagram Reels** | `instagram.com/reel/{id}` | **외부 링크만** (Meta oEmbed는 앱 토큰 필수 — 비용 대비 가치 낮음) |
| **기타** | — | "외부 링크 열기" 버튼 + raw URL 표시 |

**컴포넌트**: `app/admin/applications/VideoEmbed.tsx` (client) — URL 받아 자동 감지, 적절한 iframe 또는 link 렌더.

## CSV Export 패턴

클라이언트 사이드 (Blob → download). 서버 액션 불필요:

```ts
const csv = [
  ['Name', 'Email', 'Country', 'Status', 'AI', 'Submitted', 'Channel'].join(','),
  ...rows.map(r => [r.creator_name, r.email, r.country, r.status, r.ai_service,
    new Date(r.created_at).toISOString(), r.channel_url].map(csvEscape).join(',')),
].join('\n')
const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
const url = URL.createObjectURL(blob)
// trigger download
```

UTF-8 BOM 추가 (Excel 한글 깨짐 방지): `﻿` prepend.

## 2차 시각 검증 시나리오

1. `/admin/applications` 진입 → 시즌 0 신청자 명단 보임
2. 세그먼트 필터 "Top 50" → status='pending'인 50명만 (시즌 0은 채점 전이라 전체일 수도)
3. 검색 "test" → 이름/이메일에 test 들어간 항목만
4. 정렬 "신청 시간 ↑" → 최근 신청자 위
5. CSV Export → 다운로드, Excel에서 한글 정상 표시
6. 항목 클릭 → `/admin/applications/[id]` 상세
7. YouTube 영상이면 iframe 재생, Instagram이면 외부 링크 버튼
8. Admin 메모 작성 → 저장 → 새로고침 후 유지
9. 상태 변경 (pending → top50) → 목록 새로고침 시 반영
10. `/admin/contacts` → (시상자 없으므로 빈 상태) "아직 시상자가 없습니다" 메시지

---

# 2.5차 — Creator Dashboard (`/profile`) 확장 (3~4h)

## 현재 상태 (`app/profile/page.tsx`)
- v1 완성: oxxovo_token 인증 + 점수/순위/wins placeholder
- 데이터 연동 없음 (모두 `—` 표시)

**메모리 업데이트 필요**: `project_profile_status.md`의 "건드리지 말 것"은 v3 기준 — 2.5차에서는 명시적으로 확장 작업.

## 확장 구조

### 1. 본인 신청 정보 섹션
- 현재 시즌 신청 데이터 페치 (email 기준 `genesis_applications` lookup)
- 표시: creator_name, country, channel_url, ai_service, creator_statement, status (배지)
- 신청 안 한 사용자: "신청하러 가기" 버튼 → `/apply`

### 2. 본인 영상 임베드 재생
- 2차에서 만든 `<VideoEmbed>` 컴포넌트 재사용 (admin/applications에서 export)

### 3. 신청 상태 + 채점 결과
- status별 안내:
  - `pending`: "채점 대기 중. 시즌 마감 후 결과 표시"
  - `selected`: "Top 50 선발! 본선 진출"
  - `waitlist`: "대기자 명단. Top 50 결원 시 자동 승격"
  - `rejected`: "이번 시즌은 아쉽게 탈락"
  - `awarded`: "🏆 시상자 선정! 아래 연락처 입력 부탁드립니다" (시상자 모드 활성화)
- Triple-AI 점수: 3차에서 실제 연결, 2.5차는 placeholder (`—`)

### 4. 시상자 모드 (status='awarded'일 때만)

상금/상패 발송용 연락처 입력 폼:

```
연락처 입력 (시상자만 표시)
─────────────────────────
전화번호           [_______________]  *
우편 주소         [_______________]  *
                  [_______________]
                  [_______________]
메신저 ID         [_______________]
                  플랫폼: [KakaoTalk ▾ /자유입력]
─────────────────────────
[ 저장 ]
```

- `winner_phone`, `winner_address`, `winner_messenger` 컬럼에 저장
- 저장 성공 시 `winner_info_completed_at = now()` 자동 기록 (DB default)
- 저장 후 success 배너 "감사합니다. 상금/상패 곧 발송됩니다."

### 5. 시즌별 참가 기록 (시즌 1+에서)
- 시즌 0에서는 1개 시즌 표시
- 시즌 1+에서 누적 카드로 확장 (Hall of Fame 비전 [[project_hall_of_fame]])
- 2.5차에서는 단일 시즌 표시만, 누적 UI는 추후

## 2.5차 시각 검증 시나리오

1. `/login` → email로 로그인 → `/profile`
2. 본인 신청 데이터 보임 (이름/국가/채널/AI 서비스/Statement)
3. 본인 영상 iframe 재생
4. 상태 배지 표시 (시즌 0은 모두 pending)
5. **시상자 모드 테스트**: DB에서 본인 row status를 'awarded'로 수동 변경 → /profile 새로고침 → 시상자 폼 표시
6. 폼 입력 → 저장 → 새로고침 후 값 유지 + winner_info_completed_at 채워짐
7. `/admin/contacts`에서 본인 데이터 보임

---

# DB 마이그레이션 SQL

## A. genesis_applications 컬럼 추가

```sql
BEGIN;

-- 시상자 본인 입력 정보
ALTER TABLE public.genesis_applications
  ADD COLUMN winner_phone               TEXT,
  ADD COLUMN winner_address             TEXT,
  ADD COLUMN winner_messenger           TEXT,
  ADD COLUMN winner_info_completed_at   TIMESTAMPTZ;

-- Admin 운영 메모
ALTER TABLE public.genesis_applications
  ADD COLUMN admin_notes TEXT;

-- 시상 정보 (3차에서 본격, 2차 columns 추가만)
ALTER TABLE public.genesis_applications
  ADD COLUMN award_rank INTEGER  -- 1, 2, 3
    CHECK (award_rank IS NULL OR award_rank BETWEEN 1 AND 99);

-- status enum 확장 (awarded 추가)
-- 현재 status는 text 컬럼인지 enum인지 확인 필요 — 진단 SQL 아래 참조
COMMIT;
```

**진단 먼저** (현재 status 타입 확인):
```sql
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'genesis_applications'
  AND column_name = 'status';

-- 현재 사용 중인 status 값들
SELECT status, COUNT(*) FROM public.genesis_applications GROUP BY status;
```

text라면 자유 입력 가능 (코드에서 'awarded' 추가하면 끝). enum이라면 ALTER TYPE 필요:
```sql
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'selected';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'awarded';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'rejected';
```

## B. RLS 정책 — 시상자 본인만 자기 row UPDATE 가능

```sql
-- 신청자가 본인 email에 해당하는 row만 일부 컬럼 UPDATE 가능
-- (admin은 service_role 우회로 모든 작업 가능)

CREATE POLICY genesis_apps_winner_self_update ON public.genesis_applications
  FOR UPDATE
  TO authenticated
  USING (email = (auth.jwt() ->> 'email'))
  WITH CHECK (
    email = (auth.jwt() ->> 'email')
    -- 시상자가 수정 가능한 컬럼만 (status / award_rank 등은 admin 전용)
    -- Postgres RLS는 컬럼 단위 차단을 못 하므로 trigger로 보강 필요 (v5에서)
  );
```

⚠️ **현재 일반 사용자 인증은 `oxxovo_token` localStorage 패턴** ([[feedback_auth_pattern]]) — Supabase Auth 미사용. 따라서 `auth.jwt()` 기반 RLS는 작동 안 함.

**선택지:**
1. **Anon key + email 일치 검증을 server action에서**: `/profile`에서 server action으로 update, server가 oxxovo_token 검증 후 email 일치하는 row만 update. RLS 정책은 service_role만 허용.
2. **시상자만 Supabase Auth로 승격**: 시상 선정 시 magic link로 Supabase Auth 가입 → RLS 정상 작동. 흐름이 복잡해짐.

**추천: 옵션 1.** `/profile`에서 시상자 폼 제출 시 server action을 통해 (service_role X — 그냥 admin이 RLS off하거나, 별도 RPC 함수로 처리). 단순함.

세부 RLS 설계는 2.5차 시작 시 다시 한번 합의 (v4 작성 시점에는 안 막힘).

---

## 결정 필요 항목

| # | 결정 | 옵션 | 추천 |
|---|---|---|---|
| 1 | 시상자에게 알림 (이메일) | (a) 5차 인프라까지 대기 (수동 알림) / (b) 2.5차에 미니멀 이메일 (Supabase Edge Function) | **(a) 5차 대기** — 시즌 0 시상자는 ≤3명, TK 수동 알림 부담 적음. 5차에서 자동화. |
| 2 | CSV export 컬럼 | (a) 전체 / (b) 핵심만 (이름/이메일/상태/점수/제출시간) | **(b) 핵심만** + admin이 필요 시 컬럼 토글 (추가는 v5) |
| 3 | Instagram/TikTok 처리 | (a) iframe 시도 / (b) 외부 링크만 | **Instagram = 외부 링크, TikTok = iframe 시도 + 외부 fallback** |
| 4 | `/admin/contacts` 위치 | (a) 사이드바 nav 항목 (Applications과 같은 레벨) / (b) `/admin/applications` 내 탭 | **(a) 별도 nav** — 시상자 정보는 시즌 횡단 집계라 별도 항목이 자연스러움 |
| 5 | 시상자 폼 필수/선택 | 전화 + 주소 = 필수, 메신저 = 선택 | (확정) |

---

## 작업 시간 예상

| 단계 | 시간 | 비고 |
|---|---|---|
| **2차 — Admin Applications** | 5~7h | 페이지 3개 + VideoEmbed + CSV + admin actions |
| **2.5차 — Creator Dashboard** | 3~4h | /profile 확장 + 시상자 폼 + server action |
| **DB 마이그레이션 실행** (TK) | 15분 | A 블록 + B 정책 |
| **시각 검증 (TK)** | 30분 + 30분 | 각 단계 끝 |

총: **9~12시간** (분할 진행 시).

---

## 다음 단계 (2차 완료 후)

1. **prod 배포 + 시각 검증**
2. **2.5차 시작**
3. **2.5차 prod 배포 + 시각 검증**
4. **3차 (Scoring Results)** 진입 전 — `oxxovo-scoring` 레포와 `scoring_results` 스키마 합의 (병렬 진행 가능)
5. **5차 (이메일 트리거)** — 시상자 자동 알림 포함

---

## 메모리 업데이트 예정

승인 시 다음 메모리들 갱신:
- `project_profile_status.md` — "건드리지 말 것" → "2.5차에서 확장 작업 중"
- `project_apply_spec.md` — 신청자 흐름에 시상자 정보 후속 입력 단계 추가
- `project_oxxovo_6_priorities.md` → `project_admin_phase_2.md` 신규 (2차/2.5차 진행 기록)
