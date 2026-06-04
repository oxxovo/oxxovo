# 신원/인증 통합 구현 계획 (Auth & Identity Plan)

> 작성: 2026-06-03 · 작성자: 지수 · 승인: TK 대표님
> 관련: [[project-weekly-season-system]] · [[feedback-auth-pattern]]
> 검증: 라이브 흐름 리팩터 → **리허설 시즌(7/27~31)** 전체 사이클로 검증

---

## 0. 목표

매주 시즌 + 커뮤니티 투표(1인 1표) 기반을 위한 **단일 Supabase Auth 신원 시스템**:
1. 매직링크 로그인 (저마찰, 비밀번호 폐기)
2. `genesis_applications.user_id` → `auth.users` (email 문자열 매칭 → FK)
3. @supabase/ssr **쿠키 세션** (admin과 통일, httpOnly, RLS 자연 작동)
4. RLS 정책 (owner = `auth.uid()`, admin = `is_admin()`, service-role bypass)

---

## 1. 실측으로 확정된 현재 상태 (중요)

| 항목 | 실제 (오해 정정) |
|---|---|
| `oxxovo_token` | **커스텀 아님 — Supabase Auth access token**. `/api/auth/login`이 password grant 호출, localStorage 저장 |
| 토큰 검증 | 서버 액션이 `admin.auth.getUser(token)`로 JWT 검증 (`app/profile/actions.ts`) |
| 신원 연결 | `user_id` FK 없음 → **email `ilike` 문자열 매칭**으로 자기 신청 조회 |
| `/apply` | **비로그인** insert, auth 계정 불요, 사용자가 입력한 email 신뢰 |
| email 유일성 | ✅ 확정(2026-06-04): `genesis_applications_email_unique`(전역 유일 **인덱스**) 존재 = 매주 재신청 블로커였음. `genesis_email_unique_fix_2026-06.sql`로 DROP + `(season_id, lower(email))` 교체 |
| genesis RLS | **꺼짐** — admin이 `createSupabaseServer()`(쿠키, 정책 없이) 읽기 성공이 증거. = 현재 데이터 노출, RLS로 닫아야 함 |
| 세션 갱신 | 이 Next 버전은 `middleware.ts` 아님 → **`proxy.ts`** (이미 존재, admin용) |

### 23505 미스터리 — ✅ 최종 확정 (2026-06-04)
pg_indexes 결과: `genesis_applications_email_unique`(email **전역 유일 인덱스**)가 실제로 존재.
- TK의 첫 점검은 `contype IN ('u','p')`로 **제약**만 봤기에 이 **인덱스**(제약 아님)를 못 잡았음 → "제약 없음"은 맞지만 "유일성 없음"은 아니었음.
- 따라서 `/api/apply`의 23505 핸들러는 **dead code가 아니라 LIVE BLOCKER**였음. 시즌0 신청자가 시즌1 신청 시 전역 email 유일 위반(23505)으로 차단 = 매주 시즌 hard blocker. (첫 추측이 옳았음.)
- 조치: `genesis_email_unique_fix_2026-06.sql` — DROP 전역 유일 + `(season_id, lower(email))` 유일 추가. 라벨은 `already_applied_this_season`(Phase 3, 시즌별 user/email 중복 의미).
- 참고: 이 인덱스는 **추적 밖 초기 테이블 생성** 시 만들어진 것. `admin-plan-2026-05.md`·`admin-1차-2026-05.md`의 `email TEXT NOT NULL UNIQUE`는 전부 **profiles 테이블**이라 genesis와 무관 → 그 문서엔 정정할 내용 없음.

---

## 2. 확정 결정 (TK)

- **세션 모델 = 쿠키 세션 통합** (@supabase/ssr). admin과 단일 시스템.
- **신청 인증 = 매직링크 후 신청 요구 (A-1)** ※ 지수 추천, TK "진행" 으로 채택. 선(先)로그인 진입, 이메일 자동 채움. 필요 시 후속으로 "제출 시 인증(A-2, 폼 초안 보존)"로 개선.
- **중복 방지** = `UNIQUE(season_id, user_id)` (Phase 1). `(season_id, email)`은 시즌0 중복 점검 후 별도 결정.

---

## 3. 단계별 구현 (Phase)

> 순서 = 위험 낮은 것부터. 각 Phase는 독립 배포 가능하게 설계.

### Phase 1 — DB 기반 (마이그레이션) ✅ 작성 완료
`reports/genesis_user_id_migration_2026-06.sql`
- `user_id uuid` (nullable) → `auth.users(id)` FK, ON DELETE SET NULL
- `user_id` 조회 인덱스 + `UNIQUE(season_id, user_id) WHERE user_id IS NOT NULL`
- **RLS 미포함**(Phase 5). verification에 pg_indexes(23505 확정) + 시즌별 email 중복 점검 포함.
- → **TK: Supabase 적용 + verification 5개 결과 공유**

### Phase 2 — 매직링크 + 쿠키 세션 (핵심, long pole) ✅ 완료 (브랜치 2266f6d, 6b19b5f)
- `lib/supabase-browser.ts`/`supabase-server.ts`(이미 존재)를 일반 사용자에도 사용.
- `/login`: 비밀번호 폼 → **매직링크 발송 폼**(이메일만). `signInWithOtp({ email, emailRedirectTo })`.
- 콜백 라우트 `app/auth/callback/route.ts`: `exchangeCodeForSession` → 쿠키 세션 수립 → redirect.
- `proxy.ts`: 일반 사용자 세션 refresh 경로 추가(현재 admin만 처리하는지 확인 후 확장).
- `/signup` 페이지: 매직링크는 가입=로그인 통합이라 별도 가입 불요 → `/login`으로 통합 or 리다이렉트.
- 구(舊) `oxxovo_token` localStorage 경로 제거 (`lib/use-local-user.ts`, `/api/auth/login`, `/api/auth/signup` deprecate).

### Phase 3 — /apply 인증 요구 (A-1) ✅ 완료 (브랜치 f5dd5e9)
- `/apply` 페이지: 미인증이면 매직링크 로그인 UI 먼저, 인증 후 폼(이메일 자동 채움/잠금).
- `/api/apply`: 쿠키 세션에서 `user_id` + **검증된 auth 이메일** 취득 → insert에 `user_id` 포함, 사용자 입력 이메일 신뢰 제거.
- `23505` → `already_applied_this_season` 라벨로 교체(중복 방지 인덱스와 연동).

### Phase 4 — /profile 리팩터 (4a 세션 배관 ✅ 완료 6b19b5f / 4b user_id 매칭 ⏳ backfill 후)
- `loadProfileData`: token 인자 + `getUser(token)` + email `ilike` → **쿠키 세션 + `user_id = auth.uid()` 조회**로 전환.
- `saveWinnerInfo`/`saveMainRoundSubmission`: 동일하게 세션 기반 소유권 검증(email 매칭 hack 제거).
- 클라이언트(`app/profile/page.tsx`)의 `useLocalToken` 제거 → 세션 기반.

### Phase 5 — RLS (신중, reader 전수감사 후) ✅ SQL 작성 7006462 / 적용 대기
- genesis_applications reader 전수: admin 페이지(`createSupabaseServer` 쿠키), apply/cron/profile(service-role), 혹시 모를 anon 경로.
- 정책: `SELECT/UPDATE USING (user_id = auth.uid())` (owner) + `USING (is_admin())` (admin). service-role은 자동 bypass. INSERT는 apply가 service-role이므로 정책 무관(또는 authenticated+user_id=auth.uid() 정책).
- `ALTER TABLE genesis_applications ENABLE ROW LEVEL SECURITY` → **현재 데이터 노출도 닫음**.

### Phase 6 — 시즌 0 backfill ✅ SQL+콜백 작성 7006462 / 적용 대기
- 기존 email-only row: 같은 email로 첫 매직링크 로그인 시 `user_id` 매칭 채움 (콜백/로그인 직후 1회 동기화, 또는 admin 일괄 backfill RPC).
- 케이스: 한 email이 여러 시즌 row → 전부 같은 user_id로 연결.

---

## 4. 위험표

| # | 위험 | 완화 |
|---|---|---|
| A1 | 라이브 /profile·/login·/apply 리팩터 회귀 | Phase 분리 독립 배포 + 리허설 시즌 전체 사이클 |
| A2 | RLS 켤 때 admin/apply 깨짐 | Phase 5 reader 전수감사 후 정책 동반 ENABLE |
| A3 | 매직링크 미수신(스팸/지연) | 안내 문구 + 재발송 + (후속) 보조 수단 검토 |
| A4 | ✅ 해소: email 전역 유일 인덱스 존재 = 매주 블로커였음(확정) | `genesis_email_unique_fix`로 DROP + `(season_id,email)` 교체 |
| A5 | ✅ 해소: 시즌0 중복 email 0건(#5) | `(season_id, lower(email))` 유일 안전 추가 |
| A6 | backfill 중 email 대소문자/오타 불일치 | auth.email 소문자 정규화 매칭(기존 ilike 로직 재사용) |

---

## 5. 진행 현황 (2026-06-04)

브랜치 `auth-cookie-sessions` (커밋: 2266f6d → 6b19b5f → f5dd5e9 → 7006462). main 무영향.

| Phase | 상태 | 비고 |
|---|---|---|
| 1 DB user_id | 🟡 SQL 적용 대기 | TK 적용 + verification #2~5 공유 예정 |
| 2 매직링크+쿠키 | ✅ 코드 완료 | tsc/eslint clean |
| 3 /apply 인증 | ✅ 코드 완료 | localStorage 경로·비밀번호 API 삭제 |
| 4a 세션 배관 | ✅ 코드 완료 | profile token→쿠키 세션 |
| 4b user_id 매칭 | ⏳ 대기 | Phase 6 backfill 후 (지금은 email ilike) |
| 5 RLS | ✅ SQL 작성 | 적용은 pre-flight(STEP 0) 확인 + 리허설 후 |
| 6 backfill | ✅ SQL+콜백 작성 | Phase 1 적용 후 |

### 대기 / 다음 순서
1. **TK:** Phase 1 마이그레이션 적용 + verification #2~5(특히 #3 pg_indexes=23505 확정, #5 중복 email) 공유.
2. 결과 후: 23505 확정 + `admin-plan` 정정 → (필요 시) Phase 4b 전환.
3. **머지 전 필수:** Phase 1 적용 + 리허설 시즌(7/27~31)에서 매직링크 전체 흐름(로그인→신청→프로필) 무인 검증.
4. RLS(Phase 5)는 STEP 0 pre-flight 결과 확인 후, 리허설 환경에서 먼저 ENABLE 검증.
5. 검증 통과 → `auth-cookie-sessions` → main 머지.
