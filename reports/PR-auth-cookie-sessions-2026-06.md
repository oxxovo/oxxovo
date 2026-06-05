# feat(auth): 단일 Supabase Auth 신원 시스템 — 매직링크 + 쿠키 세션 + user_id FK

> `auth-cookie-sessions` → `main` · 관련: `docs/auth-identity-plan.md`

## 요약

매주 시즌 + 커뮤니티 투표(1인 1표)의 토대가 되는 **단일 신원 시스템**으로 전환합니다.
기존의 `oxxovo_token`(localStorage 저장 Supabase access token) + email 문자열 매칭 방식을,
**매직링크 로그인 + @supabase/ssr 쿠키 세션 + `user_id` FK** 기반으로 통일합니다 (admin과 동일 시스템).

또한 라이브 운영의 **매주 시즌 hard blocker**(전역 email 유일 인덱스)를 제거합니다.

## 왜 (배경)

실측으로 확정된 사실(`docs/auth-identity-plan.md §1`):

- `oxxovo_token`은 커스텀 토큰이 아니라 **Supabase Auth access token**이었음 (password grant).
- 신원 연결에 FK가 없어 **email `ilike` 문자열 매칭**으로 자기 신청을 조회 — 취약/불안정.
- `/apply`가 **비로그인 insert**라 사용자가 입력한 email을 신뢰 — 위조 가능.
- genesis_applications **RLS가 꺼져 있어** 현재 데이터가 정책 없이 노출.
- **`genesis_applications_email_unique`(전역 email 유일 인덱스)가 실제로 존재** = 시즌0 신청자가 시즌1 신청 시 23505로 차단되는 **매주 재신청 블로커**. (pg_indexes로 2026-06-04 확정)

## 변경 내용 (Phase별)

| Phase | 내용 | 상태 |
|---|---|---|
| **1. DB 기반** | `user_id uuid` → `auth.users(id)` FK, `UNIQUE(season_id, user_id)`, 조회 인덱스 | SQL 작성, 적용 대기 |
| **2. 매직링크 + 쿠키 세션** | `/login` 비밀번호 폼 → `signInWithOtp` 매직링크, `app/auth/callback` `exchangeCodeForSession`, `proxy.ts` 세션 refresh, `/signup` 통합 | ✅ 코드 완료 |
| **3. /apply 인증 요구 (A-1)** | 선(先)로그인 진입 + email 자동채움/잠금, `/api/apply`가 세션에서 `user_id`·검증된 email 취득, `23505 → already_applied_this_season` 라벨 | ✅ 코드 완료 |
| **4a. /profile 세션 배관** | token 인자 → 쿠키 세션 기반, `useLocalToken` 제거 | ✅ 코드 완료 |
| **4b. user_id 매칭 전환** | email `ilike` → `user_id = auth.uid()` | ⏳ Phase 6 backfill 후 |
| **5. RLS** | owner(`user_id = auth.uid()`) + admin(`is_admin()`) 정책 + `ENABLE ROW LEVEL SECURITY` | SQL 작성, 적용 대기 |
| **6. 시즌0 backfill** | 첫 매직링크 로그인 시 같은 email row에 `user_id` 채움(콜백 훅) | SQL+콜백 작성, 적용 대기 |

### 삭제된 레거시
- `lib/use-local-user.ts` (localStorage 토큰 경로)
- `app/api/auth/login/route.ts`, `app/api/auth/signup/route.ts` (password grant API)

### 포함된 마이그레이션 (reports/)
- `genesis_user_id_migration_2026-06.sql` — Phase 1 (FK + UNIQUE)
- `genesis_email_unique_fix_2026-06.sql` — 전역 유일 DROP + `(season_id, lower(email))` 교체
- `genesis_rls_2026-06.sql` — Phase 5 RLS 정책
- `genesis_user_id_backfill_2026-06.sql` — Phase 6 backfill

> ⚠️ 마이그레이션은 코드 머지와 **독립**으로 Supabase에 수동 적용. 적용 순서는 아래 체크리스트 참조.

## 검증 (2026-06-04 확정)

Phase 1 verification 결과:
- **#2 FK**: 정상 ✅
- **#3 pg_indexes**: `genesis_applications_email_unique` 실재 확인 → 라이브 블로커 확정 ✅
- **#5 시즌별 중복 email**: **0 rows** → `(season_id, lower(email))` 유일 추가 안전 ✅

`email_unique_fix` **prod 적용 완료** (2026-06-04). 적용 후 인덱스 상태 검증:
- DROP: `genesis_applications_email_unique` ✅ (매주 블로커 제거)
- NEW: `genesis_applications_season_email_uniq` ✅ `(season_id, lower(email))`
- 현재 인덱스 5종 — `pkey` / `created_idx` / `season_email_uniq` / `season_user_uniq`(P1) / `user_id_idx`(P1)
- 동작 확인: 같은 email 매주 재신청 가능 ✅, 시즌별 1email·1user 어뷰징 차단 ✅, 이중 방어 작동 ✅

`tsc` / `eslint` clean.

## 위험 & 완화

- **라이브 /profile·/login·/apply 회귀** → Phase 분리 독립 배포 + **리허설 시즌(7/27~31) 전체 사이클 무인 검증**.
- **RLS ENABLE 시 admin/apply 파손** → Phase 5 reader 전수감사 후 정책 동반 ENABLE, 리허설 환경 선검증.
- **매직링크 미수신** → 안내 문구 + 재발송 UI, (후속) 보조 수단 검토.

## 머지 전 체크리스트

- [x] `genesis_email_unique_fix` prod 적용 + 인덱스 검증 (2026-06-04 완료, 인덱스 5종 확인)
- [ ] Phase 1 마이그레이션(`genesis_user_id_migration`) 적용 + verification #2~#5 공유
- [ ] 리허설 시즌(7/27~31)에서 매직링크 전체 흐름(로그인 → 신청 → 프로필) 무인 검증
- [ ] Phase 6 backfill 적용 → Phase 4b(user_id 매칭) 전환 확인
- [ ] Phase 5 RLS는 STEP 0 pre-flight 결과 확인 후 리허설 환경 선 ENABLE 검증
- [ ] 위 통과 시 머지

🤖 Generated with [Claude Code](https://claude.com/claude-code)
