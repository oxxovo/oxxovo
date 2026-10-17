# 신규 테이블 체크리스트 (2026-10-16, 지수 작성)

작성 근거: 10-16에 이 레포가 실제로 겪은 구멍 2건(`profiles_own_update`, "anyone can apply")과 `ads_boundary_spec_v1_2026-10-16.md` §2-2의 7개 규칙. 코드·SQL 실행 없음, 문서만. 본부 검토 대기.
표기: [레포] = 레포 파일로 확인, [제안] = 내 제안, [미확인] = 라이브 DB 미확인.

적용 대상: 새 테이블, 새 뷰, 새 SECURITY DEFINER 함수, 새 스토리지 버킷. **광고부·게임 등 다른 팀이 만든 마이그레이션도 같다**(통과시키는 쪽은 본부, Run은 TK님).

## A. 설계 단계 (SQL 쓰기 전)
1. **누가 쓰는가를 먼저 적는다:** 쓰기 주체가 서버(service_role)뿐인지. 사용자 세션으로 쓰는 경로가 정말 필요하면 이유를 적고 본부 승인. 기본값은 "service_role 전용".
2. **누가 읽는가:** 공개 읽기가 필요하면 테이블이 아니라 **뷰 또는 RPC**로 노출한다(`seasons_public` 패턴 [레포]). base 테이블은 anon/authenticated에 직접 열지 않는다.
3. **컬럼별 노출 목록:** 외부(게임·광고·공개 페이지)에 나가는 컬럼을 미리 적는다. `select *` 전제 설계 금지.
4. **기본값 점검:** 공개/승인/활성 상태를 기본값으로 두지 않는다(`pending`/`draft`/`false`). 사례: `moderation_status DEFAULT 'approved'`(`watch_safety_2026-06.sql:36`) [레포]. 기본값은 "INSERT 경로 전체가 서버"라는 전제 위에서만 안전하다.
5. **빈 값의 의미:** 미입력을 0/기본값으로 채우지 않는다. `NULL` = 모른다(`feedback_absent_is_not_zero`).

## B. SQL 작성 규칙 (파일은 `reports/`, ASCII 전용, LF)
6. 생성 직후 한 묶음으로: `ENABLE ROW LEVEL SECURITY` -> `REVOKE ALL ON ... FROM PUBLIC, anon, authenticated` -> `GRANT ... TO service_role` -> 정책 0개. 패턴 선례: `partner_schema_grants_migration_2026-06.sql`, `membership_p4a_migration_2026-06.sql` [레포].
7. **금지:** (a) "내 행만 UPDATE" 정책(`profiles_own_update` 사례), (b) `INSERT ... WITH CHECK (true)` 정책("anyone can apply" 사례), (c) `TO public` 정책(롤을 명시), (d) 컬럼 단위 REVOKE 없이 테이블 UPDATE를 authenticated에 부여.
8. **새 함수:** `SECURITY DEFINER`면 `SET search_path` 고정 + `REVOKE EXECUTE ... FROM PUBLIC` 후 필요한 롤에만 GRANT(PG는 함수 EXECUTE가 PUBLIC 기본 부여). 파라미터를 추가하는 `CREATE OR REPLACE`는 오버로드를 만든다(PGRST203) -> 먼저 `DROP FUNCTION`을 STEP 0 별도 블록으로.
9. **DROP/롤백은 별도 블록 또는 별도 파일.** 블록 하나 = 쿼리 하나. 되돌리기 블록을 같은 실행 묶음에 동봉 금지(통째 Run 위험).
10. 끝에 `NOTIFY pgrst, 'reload schema';`. 한글 저장 VALUE는 한글 그대로, 나머지 SQL은 ASCII.
11. `reports/` 파일 맨 위에 **적용 기록 칸**(날짜, Run한 사람, 결과) 둔다. 적용 전 `git`에 올리지 말고 untracked로 둘 수도 있으나, 적용 후엔 기록을 채워 커밋한다.

## C. 적용 직후 읽기 검증 (TK님 Run, 결과는 본부 전달)
12. `check_service_role_grants()`가 **0행**([레포] `deploy:prod` 게이트도 같은 검사).
13. `reports/db_write_surface_audit_2026-10-16.sql` 재실행: 새 테이블에서 anon/authenticated 쓰기 면 0.
14. 권한은 **`relacl`/`aclexplode`로 직접** 센다. `information_schema`는 MAINTAIN(`m`)을 가린다(`reference_pg_acl_maintain_and_info_schema`). 새 테이블에 anon/authenticated는 **빈 행**이어야 한다.
15. 정책 개수: `select count(*) from pg_policies where tablename = '<t>'` = 0(서버 전용인 경우).
16. 함수를 만들었으면 `prosrc`를 되읽고 그 정의에만 있는 토큰 둘 이상으로 반영 확인(`CREATE OR REPLACE` Success != 반영). 함수 N개 -> ACL 2N행 확인.
17. 데이터 0행 증명은 `count(*)`로.

## D. 앱 코드 쪽
18. 해당 테이블 접근은 **서버 코드에서 `createSupabaseAdmin()`만**. 서버에서 anon 키 클라이언트로 mutation하면 RLS에 막혀 조용히 0행(`feedback_server_side_anon_rls_trap`).
19. 브라우저 코드에서 `.from('<새 테이블>')` 0건을 grep으로 확인하고, **클라이언트 변수 종류(admin/supabase)까지** 확인한다(grep 결과만으로 결론 금지).
20. service_role은 RLS를 우회하므로 **WHERE 없는 조회·갱신 금지, 응답은 필드 화이트리스트로 직접 조립**(`select *` 결과를 그대로 반환 금지).
21. 새 컬럼을 PostgREST에 보낼 땐 PostgREST가 모르는 컬럼을 조용히 거부할 수 있으니 `error`를 반드시 읽는다.
22. 테스트: 음성 시험은 **대조군 한 쌍**(허용 경로는 성공, 차단 경로는 거부)으로. 가드는 일부러 망가뜨려 빨개지는지 본다.

## E. 배포 순서
23. **마이그레이션 먼저 Run -> 코드 push -> `deploy:prod`.** 순서가 바뀌면 그 사이에 런타임 에러.
24. 공개면에 닿는 테이블이면 노출 전 `isRowPublic` 같은 가시성 조건을 코드로 확인하고, 열기 전 W 항목(site_launch_checklist)에 추가 여부를 본부가 판단.

## 이 문서가 확인하지 못한 것
- 라이브 DB의 현재 정책·권한은 본부가 전해 준 값이며 이 세션이 원본을 본 적 없다.
- 12번의 `check_service_role_grants()` 판정 기준은 레포 파일 기준이다. 라이브 본문 대조(0i 계열)는 미실시.
- 항목 8의 "PG가 함수 EXECUTE를 PUBLIC에 기본 부여"는 PostgreSQL 일반 동작이며 이 프로젝트에서 실측한 값은 아니다(10-16 점검에서 anon 실행 가능 함수 9개가 나온 것과는 일치).
- Supabase 대시보드(Table Editor)로 만든 객체는 레포에 흔적이 없다. 이 체크리스트는 SQL 파일 경로만 다룬다.
