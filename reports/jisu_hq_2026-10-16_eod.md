# EOD 2026-10-16 -- 지수(메인, 앱 레포) 작업 요약 + 인계

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문.
**이 파일 작성 시점까지 앱 레포의 커밋·푸시·배포 0건, 코드 수정 0건.** DB 변경 2건은 본부가 요청한 SQL을 **TK님이 직접 Run**했다(내가 실행한 것 없음). 읽기 전용 확인과 문서·SQL 초안 작성만 했다.
**읽는 순서: 0절 -> 3절(다음 일) -> 2절(미커밋) -> 1절(오늘 한 일) -> 4절(교훈·한계).** 10-15 EOD(`jisu_hq_2026-10-15_eod.md`)에 이어지는 문서다.

## 0. 한 줄 요약
라이브 = HEAD = `origin/main` = `c9126a9`(변동 없음, 10-16 시작 때 확인). **오늘 가장 큰 일은 보안 구멍 2건을 찾아 TK님이 닫은 것:** (1) `profiles`에서 로그인 사용자가 자기 `role`을 `admin`으로 바꿀 수 있던 구멍, (2) `genesis_applications`에 누구나(anon 키) 아무 값으로 신청 행을 넣을 수 있던 구멍. 두 건 모두 악용 흔적은 없었다(admin 1명, 실제 시즌 행 0). 코드 쪽 미커밋 3묶음(P1 / Coming Soon / noindex)은 10-14와 같고, 문서·SQL 파일이 늘었다.

## 1. 오늘 한 일

### 1-1. 시작 확인과 배너·칩 정리 (10-15 기록은 10-15 EOD 참조)
- 라이브 SHA `c9126a9`, `dirty:false`, builtAt `2026-10-13T04:07Z`, 현재 프로덕션 배포 `oxxovo-aws2w5l6p-...`(`dpl_Fzv1qgihJuXZK96GYZeNirt4HKrg`). 크론은 `vercel logs <배포 URL> --since 1h --no-follow --json`으로 읽혔고 content-dispatch가 5분 간격 200, `stage:"no_open_dba"`, `warnings:[]`.
- Coming Soon 칩 마크업 직접 확인: 배너 `<section>` 안 `absolute inset-0 flex items-center justify-center`, `bg-black/65`, `#f4f0ff`. `site_launch_checklist.md`에 칩(A3-b)과 배너 규격(B1-b) 추가, `jisu_hq_2026-10-15_eod.md` 새로 작성.
- JWKS: `https://qrnkovokjmimagrwjebs.supabase.co/auth/v1/.well-known/jwks.json` -> 키 1개 `kty:EC`, `alg:ES256`, `crv:P-256`, `kid:5562f6cd-60ce-456e-87de-fd4b969793c4`. 비대칭이라 외부 서비스가 공개키로 검증 가능. **현재 발급 토큰이 이 kid로 서명되는지는 토큰 헤더를 안 봐서 미확인.**

### 1-2. 보안 조치 1: `profiles` 잠금 (적용 완료, 2026-10-16, TK님 Run)
- **구멍(본부 실측으로 확정):** RLS 켜짐 + 정책 `profiles_own_update`(UPDATE, authenticated, `id = auth.uid()`) + authenticated의 테이블 UPDATE 권한 + 보호 트리거 없음(`profiles_set_updated_at`만). `is_admin()` = `exists(select 1 from public.profiles where id = auth.uid() and role = 'admin')`(라이브 본문 = 레포 본문). 그래서 anon 키 + 자기 JWT로 `PATCH /rest/v1/profiles`에 `{"role":"admin"}`을 보내면 관리자 권한 획득이 가능했다. `profiles_own_update`는 **레포에 없던 정책**(레포 밖에서 생성).
- **레포 확인:** 브라우저에서 profiles를 쓰는 코드 0건(브라우저 클라이언트의 유일한 테이블 호출은 `app/admin/promo/PromoView.tsx:529` 스토리지 버킷). 쓰기 22곳은 전부 서버 `createSupabaseAdmin()`(service_role). 사용자 세션 읽기는 `lib/admin-auth.ts`의 SELECT 2곳뿐(`profiles_own_read`로 통과).
- **조치(B안):** `drop policy profiles_own_update` + `revoke update, insert, delete on public.profiles from authenticated` + 스키마 리로드, 한 트랜잭션. 파일 `reports/profiles_lockdown_2026-10-16.sql`(맨 위에 적용 기록).
- **확인(본부 전달):** 정책 = `profiles_admin_all`(ALL, public), `profiles_own_read`(SELECT, authenticated)만. 권한 = anon MAINTAIN, authenticated MAINTAIN·SELECT. TK님이 `/admin` 로그인 정상 확인.
- **악용 흔적 확인(TK님 Run, `reports/profiles_abuse_check_2026-10-16.sql`):** role='admin' 1명(TK), 회원 7명, CHECK 1~4 모두 이상 없음. 한계: `updated_at`이 모든 UPDATE에 갱신돼 변경 시점을 못 가림, `cumulative_*`는 크론이 덮어써서 증거가 지워졌을 수 있음. API 로그의 `PATCH /rest/v1/profiles` 검색은 이번 세션에서 안 함.
- `admin_all` 정책의 roles가 `{public}`인 점: anon은 profiles에 SELECT/UPDATE 권한이 없어(MAINTAIN만) 정책 이전에 막힘, 문제없음으로 판단.

### 1-3. 보안 조치 2: `genesis_applications` / `applications` 잠금 (블록 1 적용 완료, 2026-10-16, TK님 Run)
- **구멍(본부 실측):** `genesis_applications`에 정책 "anyone can apply"(INSERT, anon+authenticated, `check=true`) + anon/authenticated INSERT 권한. 레거시 `applications`에도 "allow public insert"(권한은 없어 무효). 서버 검증(로그인·멤버십·시즌 오픈·동의·길이·정원)을 PostgREST 직접 호출로 우회 가능했다.
- **영향 분석(레포):**
  - `moderation_status`의 DB 기본값이 `'approved'`(`reports/watch_safety_2026-06.sql:36`) -> 컬럼을 빼고 넣어도 승인 상태. `isRowPublic`(`lib/watch-visibility.ts`) 조건(status 'flagged' 아님, `watch_hidden`·`watch_hold` 거짓, `moderation_status='approved'`) + 비-픽스처 시즌(시즌 ID는 `seasons_public`으로 공개) + 영상 URL이면 노출 요건 충족. `/watch`는 프로덕션에서 닫혀 있어 실제 노출은 없었다.
  - `count_active_registrations`가 `defer_season_schedule`의 근거(season_0 `min_participants=100`) -> 가짜 행으로 연기를 막을 수 있음. `free_entry_url` 있는 행은 채점 대상 -> 채점 비용. "your film is live" 메일 구조 -> 임의 주소로 발송 가능성(발송 코드는 직접 확인 못 함).
  - `watch_hidden`/`watch_hold` DB 기본값은 레포로 못 확인(블록 0e로 읽는 용도).
- **중요한 판단:** authenticated UPDATE는 **회수하지 않았다.** `app/admin/applications/actions.ts`가 관리자의 사용자 세션(`createSupabaseServer`)으로 `admin_notes`·`status`·`award_rank`를 UPDATE한다(`:61-82`, `:172`, `:541`, `:601`). 비관리자는 UPDATE 정책이 없어 0행. 이 안전은 `is_admin()`이 읽는 `profiles.role`이 잠겨 있는 것에 기댄다(조치 1과 연결).
- **조치(블록 1):** "anyone can apply" 삭제, anon의 INSERT·UPDATE·DELETE 회수, authenticated의 INSERT·DELETE 회수, `applications`의 "allow public insert" 삭제와 anon/authenticated 권한 전부 회수, 리로드. 파일 `reports/applications_lockdown_2026-10-16.sql`(맨 위에 적용 기록). **블록 R(롤백)과 선택 블록 F1/FR(`check_service_role_grants` 실행권한 회수)은 적용하지 않았다.**
- **확인(본부 전달):** 정책 삭제 확인. 권한: `applications` anon·authenticated = MAINTAIN만 / `genesis_applications` anon = MAINTAIN·SELECT, authenticated = MAINTAIN·SELECT·UPDATE.
- **적용 전 집계(블록 0f, TK님):** 117행 전부 `season_test`(105)·`season_test2`(12) 시드, 실제 시즌 0행 -> 악용 흔적 없음. 이 집계는 남은 행만 보며, 실패한 시도나 이미 삭제된 행은 못 본다.
- **적용 후 재확인(이 세션, 읽기):** `genesis_apps_admin_delete` 정책은 남았지만 authenticated DELETE 권한이 회수돼 무효다. 레포 전수 확인 결과 사용자 세션으로 `genesis_applications`를 DELETE하는 코드는 없다: `.delete()`는 `app/`에서 `watch_*`·`generation_jobs`·`seasons`(전부 `admin`/service_role)뿐이고, `genesis_applications` 삭제는 `scripts/*.mjs`(service_role 키로 만든 `admin` 클라이언트)뿐. 시즌 삭제는 `createSupabaseAdmin()`(`app/admin/seasons/actions.ts:88-99`). FK cascade는 호출자 권한과 무관하게 DB가 처리한다.
- **anon SELECT:** 권한은 남았지만 정책 "no public read"(SELECT, anon, `false`)로 0행. 이대로 둬도 지금은 안전하나, "권한만 있고 정책이 막는" 상태는 정책 하나가 잘못 생기면 열리는 구조라 anon SELECT 권한도 회수하는 것이 방어 심층으로는 더 낫다(앱은 anon으로 이 테이블을 읽지 않음: anon 클라이언트는 `seasons_public`과 RPC만 사용). 결정은 본부·TK님.
- **오늘 한 번에 놓친 것:** 적용 후 수동 확인(관리자 `/admin/applications`에서 메모 수정, 일반 `/apply` 신청)은 **아직 안 했다.** 둘 다 TK님 확인 필요.

### 1-4. 쓰기 면 전수 점검과 함수·스토리지 점검 (읽기 SQL 제공, 결과는 본부 전달)
- `reports/db_write_surface_audit_2026-10-16.sql`(문장 1개, 판독 기준은 파일 맨 위). 본부 결과: `genesis_applications`(위 조치), `email_logs`(정상으로 봄), `applications`(조치), `profiles`·`seasons`는 admin 정책만.
- SECURITY DEFINER 함수 중 anon·authenticated 모두 실행 가능한 9개: `check_service_role_grants`, `count_active_registrations(p_season_id)`, `genesis_application_count`, `get_active_application_count(p_season_id)`, `handle_new_user`, `is_admin`, `is_staff`, `link_user_applications`, `rls_auto_enable`. 전부 `search_path` 고정.
  - `link_user_applications`: anon이 부르면 `auth.uid()` null로 0 반환(레포 본문 기준). authenticated는 자기 이메일과 같은 `user_id` NULL 신청을 자기에게 연결 -> 이메일 소유 증명이 전제(매직링크 로그인이라 증명되는 것으로 보이나 Supabase 이메일 확인 설정은 미확인). 라이브 본문과 레포 본문 대조는 블록 0i가 필요.
  - `check_service_role_grants`: 레포 파일이 service_role에만 GRANT하고 PUBLIC EXECUTE를 안 거둬서 anon 호출 가능, 노출은 테이블 이름 목록뿐(낮음). 선택 블록 F1.
  - `rls_auto_enable`: 레포에 본문 없음. 이벤트 트리거용으로 알고 있으나 **확인 못 한 가정**(블록 0h).
- 스토리지: `promo-videos` 버킷 1개(`public=true`, 500MB, video mime), `storage.objects` 정책 0개(본부 전달). 정책이 0개면 anon/authenticated의 쓰기는 막힌 상태. 업로드는 서버 서명 URL 또는 service_role 경로로 보이나(`PromoView.tsx:529`) 그 경로의 인증은 이번에 안 읽음.

### 1-5. 광고 검토 문서 3건 (코드 수정 없음)
- `reports/ads_plan_v1.1_from_jenny2.md`: **내가 복사한 것이 아니다.** 요청받은 `C:\Users\Tom\Downloads\ads_plan_v1.1_from_jenny2.md`는 이 PC에 없었고, `reports/`에 이미 있었다(untracked, 10-16 11:59). 덮어쓰지 않고 읽었다.
- `reports/ads_tech_review_2026-10-16.md`: 계획서 §10의 8개 검토 항목에 대한 기술 검토. "앞서 보낸 8개 질문 지시"는 이 세션이 받은 적이 없어 §10의 8개 항목을 질문으로 보고 답했다고 문서 끝에 적음.
- `reports/ads_boundary_spec_v1_2026-10-16.md`: 광고 경계 명세서 v1 **초안**. 작성 시작 단계이며 본부 검토·보완 대기(진행 중이던 작업, 안전한 지점에서 멈춤).

## 2. 로컬 미커밋 (HEAD `c9126a9`)

코드(10-14와 동일, 변동 없음):
```
 M app/_site/SectionPage.tsx
 M app/_site/SiteFrame.tsx
 M lib/site-frame.test.ts
 M lib/site-messages-en.ts
 M lib/site-nav.test.ts
 M lib/site-nav.ts
 M lib/watch-gate.ts
 M package.json
?? app/watch/layout.tsx
?? lib/search-index.test.ts
?? lib/search-index.ts
?? lib/watch-gate.test.ts
```
문서·SQL 전부 untracked(갈래 4, 본부 확정 목록): `site_launch_checklist.md`, `jisu_hq_2026-10-13_eod.md`, `jisu_hq_2026-10-14_eod.md`, `jisu_hq_2026-10-15_eod.md`, **`jisu_hq_2026-10-16_eod.md`(이 파일)**, `content_metadata_plan.md`, `promo_allowlist_draft.md`, `tournament_promo_plan.md`, `banner_safe_area_guide_v2.png`, `profiles_lockdown_2026-10-16.sql`, `profiles_abuse_check_2026-10-16.sql`, `db_write_surface_audit_2026-10-16.sql`, `applications_lockdown_2026-10-16.sql`, `ads_plan_v1.1_from_jenny2.md`, `ads_tech_review_2026-10-16.md`, `ads_boundary_spec_v1_2026-10-16.md`, **`db_new_table_checklist_2026-10-16.md`, `games_public_profile_api_v1.md`(오후 추가, 6절)**. (`search_index_switch_2026-10-14.sql`은 갈래 3.) 갈래 4는 점심 기준 16개에서 오후 18개, 저녁 `deploy_plan_2026-10-16.md` 추가로 **19개**(6-5).
커밋 갈래 1~3은 10-14 EOD §1-7 그대로, 갈래 4만 위처럼 늘었다. `reports/coming_soon_shots/`는 `.git/info/exclude`로 제외. 커밋 4개 후 `git status`가 비어야 하고 `deploy:prod`는 미커밋이 있으면 거부한다. **`10-15 EOD` §3의 갈래 4 목록은 이 파일 등록 전 상태이므로 이 절이 최신이다.**

## 3. 다음 일 (순서)
1. **TK님 수동 확인(보안 조치 후):** 관리자로 `/admin/applications`에서 메모 수정, 일반 계정으로 `/apply` 신청(서버 insert 경로), `/profile`에서 이메일 언어·닉네임 저장.
2. **본부·TK님 결정:** anon의 `genesis_applications` SELECT 권한 회수 여부, `check_service_role_grants` 실행권한 회수(F1), `link_user_applications` 라이브 본문 대조(0i), `rls_auto_enable` 본문(0h), `is_staff` 본문(0j), 기본값 `watch_hidden`/`watch_hold`(0e). 가능하면 API 로그에서 `PATCH /profiles`, `POST /genesis_applications`(authenticated/anon) 검색.
3. **이전 일정(10-14 EOD §4) 변동 없음:** TK님 커밋 4개 -> push -> `deploy:prod` -> (다음 날 이후) watch 열기. watch 열기 전 W1(③ 0행)·W3(`search_index_allowed`)·A0-1·C2는 그대로. **새 선행조건 후보:** 대회 공개 전에 위 잠금 두 건이 유지되는지(특히 `moderation_status` 기본값 `'approved'` 구조는 그대로이므로 INSERT 경로가 service_role뿐인지)를 W 항목에 추가할지 본부 판단.
4. 광고 경계 명세서 v1 보완(본부 검토 반영). 개별 패스 모델·슬롯 승인 기록 방식 등은 TK님·제니2 결정 대기.
5. ⑩(뉴스 송출 시험)·마켓 006~008은 10-14 EOD §4 그대로.

## 4. 교훈 · 한계 (성공만 적지 않는다)
1. **"브라우저에서 안 쓴다"만으로 권한을 회수하면 깨진다:** `genesis_applications`는 브라우저 코드가 없어도 **관리자 서버 액션이 사용자 세션으로 UPDATE**한다. INSERT/DELETE만 회수하고 UPDATE는 남긴 것은 이 확인 덕분. profiles도 같은 방식으로 `from('profiles')`의 변수(`admin`/`supabase`)를 하나씩 확인했다. 클라이언트 종류를 확인하지 않은 grep 결과로 결론 내리면 안 된다.
2. **레포에 없는 정책이 구멍이었다:** `profiles_own_update`, "anyone can apply"는 레포 SQL에 없었다. 레포의 정책 기록(`admin-1차`, `genesis_rls`)만 믿으면 놓친다. 이전 교훈(레포 밖 DB 객체 목록)과 같은 부류. `db_write_surface_audit`로 라이브를 읽어야 보인다.
3. **기본값이 보안 판정을 바꾼다:** `moderation_status DEFAULT 'approved'`는 모더레이션 설계 당시에는 "기존 행 보호"였으나, INSERT가 열려 있으면 "검증 우회 행도 승인"이 된다. 컬럼 기본값은 INSERT 경로 전체가 서버라는 전제 위에서만 안전하다.
4. **지시 전달 어긋남 재발:** "앞서 보낸 광고 기술 검토(8개 질문) 지시"를 받은 적이 없었고, `ads_plan` 파일은 내가 복사하기 전에 이미 `reports/`에 있었다. 둘 다 받은 적 없다고 알리고, 계획서 §10으로 대체해 진행했다. 결과가 본부의 의도와 같은지는 본부 확인 필요.
5. **한계(검증 못 한 것):**
   - 모든 DB 사실(정책·권한·함수 목록·스토리지·집계)은 본부가 전해 준 값이다. 에디터 원본 출력은 이 세션이 본 적 없다.
   - 레포 밖 클라이언트(게임 서버 등)의 profiles/genesis 쓰기 여부, API 로그 확인은 안 함.
   - 잠금 후 앱 동작(관리자 UPDATE, `/apply` 신청)은 직접 확인 안 함.
   - 광고 문서 3건의 사실은 레포 기준이며 라이브 DB·Vercel 설정은 미확인. 법률·정책 판단은 지수 영역이 아니다.
   - 15일 오후 작업(칩 조정·캡처·가이드 v2·배너 규격 측정)은 직접 수행한 기억이 없고 10-15 EOD에 그렇게 적었다.
   - 크론 `season-tick`의 정상 응답 형식은 여전히 모른다(표의 MESSAGE가 비어 있음).

## 5. 점심 시점 상태 (2026-10-16, 본부 지시로 추가)

### 5-1. 라이브 SHA · HEAD · 미커밋 (점심 시점에 다시 확인)
- 라이브 `/api/version` = `c9126a9`(`dirty:false`, builtAt `2026-10-13T04:07Z`), 레포 HEAD = `origin/main` = `c9126a9`. 오늘 커밋·push·배포 0건.
- 미커밋 최신 목록(`git status` 기준):
  - **갈래 1(watch 게이트):** `lib/watch-gate.ts`, `lib/watch-gate.test.ts`, `package.json`(watch-gate 등록만)
  - **갈래 2(Coming Soon):** `lib/site-nav.ts`, `lib/site-nav.test.ts`, `lib/site-messages-en.ts`, `lib/site-frame.test.ts`, `app/_site/SiteFrame.tsx`, `app/_site/SectionPage.tsx`(주석만)
  - **갈래 3(noindex):** `app/watch/layout.tsx`, `lib/search-index.ts`, `lib/search-index.test.ts`, `package.json`(최종본), `reports/search_index_switch_2026-10-14.sql`
  - **갈래 4(문서):** `site_launch_checklist.md`, `jisu_hq_2026-10-13_eod.md`, `jisu_hq_2026-10-14_eod.md`, `jisu_hq_2026-10-15_eod.md`, `jisu_hq_2026-10-16_eod.md`, `content_metadata_plan.md`, `promo_allowlist_draft.md`, `tournament_promo_plan.md`, `banner_safe_area_guide_v2.png`, `profiles_lockdown_2026-10-16.sql`, `profiles_abuse_check_2026-10-16.sql`, `db_write_surface_audit_2026-10-16.sql`, `applications_lockdown_2026-10-16.sql`, `ads_plan_v1.1_from_jenny2.md`, `ads_tech_review_2026-10-16.md`, `ads_boundary_spec_v1_2026-10-16.md` -- 점심 시점 16개 (**오후에 2개 추가되어 18개, 6절**)
  - 제외: `reports/coming_soon_shots/`(`.git/info/exclude`). 커밋 4개 후 `git status`가 비어야 하며, `deploy:prod`는 미커밋이 있으면 거부한다.

### 5-2. 오늘 완료
- `profiles` 잠금(TK님 Run, 정책 `profiles_own_update` 삭제 + authenticated UPDATE·INSERT·DELETE 회수), 악용 흔적 확인(admin 1명, 이상 없음), TK님 `/admin` 로그인 정상.
- `genesis_applications`·`applications` 잠금 블록 1(TK님 Run), 사전 집계 117행 전부 `season_test`·`season_test2`(실제 시즌 0행).
- 쓰기 면 전수 점검, SECURITY DEFINER 함수 9개 점검, 스토리지(`promo-videos`) 점검(읽기 SQL과 본부 전달 결과).
- 광고 기술 검토(`ads_tech_review_2026-10-16.md`)와 광고 경계 명세서 v1 초안(`ads_boundary_spec_v1_2026-10-16.md`).
- 배너·칩 정리(체크리스트 A3-b, B1-b), 10-15 EOD, JWKS 확인(ES256, 비대칭), 크론 확인(content-dispatch `no_open_dba`).

### 5-3. 대기 (TK님·본부)
- 커밋 4개·push·`deploy:prod` 명령(TK님).
- `/admin/applications` 확인: 관리자 UPDATE(메모 수정)가 되는지, 일반 `/apply` 신청이 되는지, `/profile` 저장이 되는지.
- `genesis_applications`의 anon SELECT 권한 회수 여부(내 의견: 방어 심층으로 회수 권장, 앱은 anon으로 읽지 않음).
- 광고 $19.99와 기존 creator 구독의 관계(같은 상품인지, 사업부 패스 $6.99를 별도 상품으로 둘지).
- 그 밖에 16일 EOD §3-2의 미결: `check_service_role_grants` 회수(F1), `link_user_applications`·`rls_auto_enable`·`is_staff` 라이브 본문 확인, `watch_hidden`/`watch_hold` 기본값.

### 5-4. 진행 중
- **신규 테이블 체크리스트(`reports/db_new_table_checklist_2026-10-16.md`): 아직 시작하지 않았다. 파일이 없다.** 이 세션은 이 작업 지시를 받은 적이 없고 본부 메모만 있다. 내용 후보는 경계 명세서 §2-2의 7개 규칙(service_role 전용, "내 행만 UPDATE" 금지, `check (true)` INSERT 금지, 공개/승인 기본값 금지, `check_service_role_grants` 0행, 쓰기 면 점검, 마이그레이션 절차). 쓰라는 지시가 오면 거기서 출발한다.
- 광고 경계 명세서 v1은 초안이고 TK님·제니2 결정(개별 패스, 슬롯 승인 기록, 동의 방식 등) 대기.

### 5-5. 다음
- 배포 후: 마켓 006·007·008(10-14 EOD §1-6 검토 완료, 구현은 배포 뒤) **·009는 이 세션이 본 적이 없는 항목이라 내용 미확인**(제안서 원문부터 읽어야 한다).
- 게임용 공개 프로필 API: 본부 의견(서버 라우트 B안)은 전달했고 설계·구현은 미착수. 공개 필드 후보는 `id`, 표시 이름(`display_identity` 규칙), `locale`, (선택) `country`. `display_identity`를 읽어 표시 이름을 정하는 코드는 레포에 아직 없고, 게임이 쓰는 토큰의 서명 키는 미확인(JWKS는 ES256 공개키 게시 확인까지).
- 이후 10-14 EOD §4의 watch 열기 절차(W1·W3·A0-1·C2)와 ⑩ 뉴스 송출 시험은 그대로.

## 6. 오후 작업 (2026-10-16, 본부 지시) -- 5절의 "진행 중"·"다음" 항목을 이 절이 갱신한다

**오후에도 앱 레포의 코드 수정·커밋·push·배포·SQL 실행 0건.** 문서 2개 작성과 기존 문서 갱신만 했다. 시작 시 재확인: 라이브 `/api/version` = `c9126a9`(`dirty:false`, builtAt `2026-10-13T04:07Z`), HEAD = `origin/main`(fetch 후) = `c9126a9`.

### 6-1. 새로 만든 문서 (둘 다 untracked, 갈래 4)
- `reports/db_new_table_checklist_2026-10-16.md`: 5-4에서 "시작 안 함, 파일 없음"이던 것을 오후에 작성. 경계 명세서 §2-2의 7규칙에서 출발해 설계/SQL 작성/적용 후 읽기 검증/앱 코드/배포 순서 24항목. 라이브 DB 사실은 본부 전달값 기준이라는 한계를 문서 끝에 적음.
- `reports/games_public_profile_api_v1.md`: 게임용 공개 프로필 API 설계안(문서만). 응답 3필드 `id`·`display_name`·`locale`, JWT(ES256, JWKS) 검증 규칙, 경우 A(사용자 JWT 중계 `/me`)·경우 B(서버 간 API 키), 속도 제한, 캐시 지침. 5-5의 "설계·구현 미착수"는 **설계 문서 작성 완료, 구현 미착수**로 갱신.

### 6-2. 본부 결정 (2026-10-16 오후, 설계안 §9에 반영 완료)
1. `real_name`: v1은 닉네임(`display_name`)만 반환, 실명은 동의 범위 확인 전까지 제외.
2. `locale`: 라이브 `profiles`에 컬럼 있음(TK님 조회). "게임 UI 언어 힌트"로 표기. (설계안의 [미확인] 해소)
3. API 키 폐기: v1은 환경변수 방식. 즉시 폐기용 테이블은 보류.
4. `country`: v1 제외 유지.
5. 경우 A/B: **미확정.** 게임 제니의 설계 답을 받고 확정(본부는 B 선호). 확정 전 구현 착수 없음.
6. 토큰 alg·kid 확인: 게임 첫 연동 때 게임 쪽이 확인. (우리는 여전히 토큰 헤더를 본 적 없음)

### 6-3. 5절 갱신
- 5-4 "진행 중": 신규 테이블 체크리스트 **작성 완료**(6-1). 광고 경계 명세서 v1은 그대로 대기.
- 5-5 "다음": 게임 프로필 API는 설계안 완료·구현은 경우 A/B 확정과 TK님 승인 후. 속도 제한 수단(Firewall/KV)과 정지 계정 확인 여부는 설계안 §9에서 대기.
- 6-2 결정 중 5번(A/B)만 열려 있고, 나머지는 닫힘.

### 6-4. 한계
- 설계안의 JWT 검증 방식(`getClaims`)은 `node_modules` 타입 주석만 읽었고 실행하지 않았다. 속도 제한 한도 수치는 실측 근거 없는 초깃값이다.
- 체크리스트·설계안 모두 라이브 DB 원본을 이 세션이 본 적 없다.
- 오후 문서 2건의 사실 일부(호스트 308 시 `Authorization` 제거, Supabase JWT 기본 만료 1시간 등)는 [미확인]으로 표시해 두었다.

### 6-5. 배포 계획서와 최종 검증 (2026-10-16 저녁, 본부 지시)
- `reports/deploy_plan_2026-10-16.md` 작성(실행 0건): 커밋 4개 명령, push, 배포 전 점검, `npm run deploy:prod`, 배포 후 검증, 롤백 메모. **갈래 4 = 문서 19개**(점심 16 + 오후 체크리스트·게임 프로필 설계안 + 이 계획서). `??` 총 24 = 코드 4 + SQL 1 + 문서 19.
- `reports/` 변경 확인: 오늘 수정 파일 12개 모두 출처가 설명되고 모르는 변경 0건(본부 확인, 종결). 설명 못 하는 것: `jisu_hq_2026-10-15_eod.md`와 `ads_boundary_spec`의 수정 시각이 0.2초 차이.
- **최종 검증(현재 작업 트리, HEAD `c9126a9`, 코드 `M` 8·신규 4):** `npx tsc --noEmit` exit 0 / `npm test` **940 통과·0 실패** / `npm run build` exit 0. 빌드 뒤 `git status` 변화 없음.
- **10-14 기록 939와 다르다(+1):** `SiteFrame.tsx`·`site-frame.test.ts`가 10-14 EOD 이후(10-15 11:55~12:05) 수정됐기 때문으로 보이며 케이스 대조로 증명하지는 않았다. **10-14 EOD §1-7의 "코드 변경 없음"과 갈래별 단독 검증(930/927/932)은 10-15 칩 수정 전 기준이다.** 갈래 2에 SiteFrame 수정이 들어 있으므로 갈래별 단독 재검증은 하지 않았고, 최종 상태 합산만 검증됐다. 계획서 §9에 정정을 적었다(초판이 "10-14 이후 코드 변경 없음"이라고 쓴 오류).
- `coming_soon_shots` 이동은 배포 명령을 받은 뒤 계획서 §4-2 순서대로(미실행).
- 여전히 커밋·push·배포 0건.

### 6-6. 커밋 순서별 중간 상태 재검증 + 게임 프로필 API 설계안 갱신 (2026-10-16 저녁, 본부 지시)
- **중간 상태 재검증 완료** (레포 밖 임시 폴더, 레포 변경 0, 임시 폴더 정리 확인): HEAD 925/925, HEAD+1 930/930, HEAD+1+2 933/933, HEAD+1+2+3 940/940. 전 단계 `tsc` exit 0. 상세와 한계는 `deploy_plan_2026-10-16.md` §9. 10-14 기록 대비 갈래 2 조합만 +1(10-15 `site-frame.test.ts` 수정분)이고, 계획서 초판의 "10-14 이후 코드 변경 없음"은 정정됨.
- **게임 프로필 API 설계안 갱신:** 경우 B 확정(게임 제니), 구현 대상은 B뿐. 배치 `POST /profiles/batch`(최대 100, id별 응답, 없는 id는 `null`)는 본부 표기 `profiles:batch`가 Windows 폴더명에 `:`를 못 쓰는 문제로 경로 확인 필요. 정지·탈퇴는 `{id, status:"disabled"}` 제안. `profiles` 정지 컬럼 없음, 앱에 탈퇴·정지 기능 없음, `profiles`의 cascade 여부는 라이브 읽기 SQL 필요(미확인). API 키는 환경변수 2개 이중 운영. 닉네임 필터는 있으나 저장 시점에만 걸림. `iss`/`aud` 값은 틀리지 않음(실토큰 미확인). 설계안 §4-A, §9 참조. 열린 결정: 정지 판정 방식, 경로 표기, 이름 비었을 때 규칙.
- 이 세션 보고 중 일본어가 섞인 실수가 한 번 있었다(본부 지적, 메모리 규칙 재발). 이후 한국어만 사용.
- 여전히 커밋·push·배포·SQL 실행 0건.

### 6-7. 게임 프로필 API 결정 반영 + 배포 착수 (2026-10-16 저녁, 본부 지시)
- 설계안 §9 반영: 정지 판정 v1은 (c) `profiles` 행 유무만(응답은 `active`/`null`만, `disabled`는 형식 예약), 배치 경로 `POST /api/games/v1/profiles/batch` 확정, 이름이 비면 `null` 유지(게임이 자체 임시 이름). 라이브 읽기 SQL 3건(`profiles` FK/cascade, 닉네임 금지어 목록, `handle_new_user` 본문)은 구현 착수 때 TK님 실행. 열린 결정: 속도 제한 수단.
- TK님 배포 명령 수신(본부 전달). 계획서 `deploy_plan_2026-10-16.md` 순서로 진행: `coming_soon_shots` 이동 -> 커밋 1~4 -> push -> `deploy:prod` -> 검증. 같은 날 watch 열기·`search_index_allowed` SQL 금지. 결과는 배포 후 보고에 적는다.
