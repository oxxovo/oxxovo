# EOD 2026-10-05 -- 지수(메인, 앱 레포) 작업 요약 + 인계

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문 그대로.
**읽는 순서: 이 파일의 "인계 메모"(10절)와 "④ 착수 전 미결"(8절)만 읽으면 재개할 수 있다.** 어제 파일(`jisu_hq_2026-10-04_eod.md`)은 설계 대조 경과가 필요할 때만.

## 0. 한 줄 요약

오늘은 **Phase 1 DB 쪽(① 표 6개, ② 트리거 12개, ③ RPC 15개)을 전부 라이브에 만들고 라이브 시험까지 통과**했다.
**앱 코드·배포 변경은 0건.** 라이브는 여전히 `09e3580`. 다음은 ④(엔드포인트)인데, 시작 전에 TK님 결정 2건과 제니2 답 1건이 필요하다(8절).

## 1. 어제(10-04)와의 연결

- 어제 마지막 상태: 설계서 최종 j는 지수가 못 받았고 SQL은 0건이었다. 오늘 본부가 **최종 k 본문을 채팅으로 줬고**, 이를 `reports/phase1_design_2026-10-04.md`로 저장·커밋했다(`45cdbe3`).
- 어제 인계 9절의 "8차 지적 6건 미반영"은 k에서 **전부 반영된 것을 확인**했다(알림 발송 ①b, `alerted_at` 초기화 트리거, `attempts=max` 문구 삭제, `sendAdminAlert`의 `to?`, 시간 예산을 `maxDuration`에서 계산, `dist_mark(result='skipped')` 삭제).
- 어제 미결 #1(값 5개)은 TK님이 확정: `content_min_lead_minutes=120`, `content_max_bytes_default=524288000`, `content_dispatch_per_tick=10`, `content_presign_ttl_seconds=3600`, `content_presign_rate_per_hour=20`.
- 어제 이월 미결(`e9957ca` 배포 전 / eslint 71건 / `description_ko` 분기 라이브 미검증 / `ALERT STATE%` 제외 미증명 / `updated_at` 트리거 없는 C분류 5개)은 **오늘도 손대지 않았다**. 그대로 유효.

## 2. 오늘 만든 것 (전부 TK님이 Run, 지수는 Run하지 않았다)

SQL 원본은 레포에 있다(Run된 그대로의 기록, 다시 Run 금지):
`reports/phase1_step1_tables_2026-10-05.sql` · `reports/phase1_step2_triggers_2026-10-05.sql` · `reports/phase1_step3_rpc_2026-10-05.sql`

### ① 표·권한·설정 키
- 표 6개: `contents`, `content_assets`, `content_distributions`, `content_presigns`, `content_publish_log`, `contents_history`.
- 전부 `REVOKE ALL ... FROM PUBLIC, anon, authenticated` + `GRANT ALL ... TO service_role` + RLS ON(정책 없음). `check_service_role_grants()` missing = 0.
- `platform_config` 신규 키 **12개**: `social_dispatch_enabled`(`true`), `news_dispatch_enabled`/`entertainment_dispatch_enabled`/`entertainment_publication_enabled`(`false`), `news_publish_weekdays`(`mon,tue,wed,thu,fri`)/`news_publish_time`(`07:00`)/`news_publish_timezone`(`Asia/Seoul`), 위 5개 값 키.
- **`news_publication_enabled`는 10-03에 이미 있었다**(설계서 §9는 신규로 적었음). INSERT하지 않았다.
- **넣지 않은 키**(값 미정, 없으면 fail-closed 동작): `content_dispatch_max_attempts`·`content_dispatch_backoff_base_minutes`(없으면 재시도 0회), `content_dispatch_item_budget_seconds`, `content_max_bytes_<kind>_<form>`(없으면 default), `content_presign_source_rate_per_hour`(없으면 같은 값), `content_path_<kind>`(없어야 공개 면이 404로 닫힘).

### ② 트리거 12개 + 함수 5개
- 함수 5개(전부 `trg_*`, SECURITY INVOKER, `search_path=public`): `trg_reject_mutation`, `trg_contents_audit`, `trg_contents_touch`, `trg_contents_guard`, `trg_dist_alert_reset`.
- 트리거: `contents` 5(audit/touch/guard/no_delete/no_truncate), `content_assets` 2, `content_distributions` 1(`alerted_at` 초기화), `contents_history` 2, `content_publish_log` 2.
- 설계서에 없어서 지수가 넣은 것(본부가 설계서에 반영하기로 함): **INSERT 감사**(수입이 처음부터 `held`라 UPDATE 감사만으로는 `contents_history`가 0행 -- 10-03과 같은 구조), **TRUNCATE 거부**(행 단위 DELETE 트리거는 TRUNCATE에 안 걸리고 service_role이 TRUNCATE를 가짐), 불변 컬럼에 `id`·`created_at` 추가, 트리거 함수 `trg_*` 접두사(③ 되읽기 15행과 안 겹치게), 트리거 함수는 INVOKER(DEFINER면 `current_user`가 항상 `postgres`).

### ③ RPC 15개 + 컬럼 1개
- `content_*` 10개: `content_import`, `content_presign`, `content_rights_down`, `content_hold`, `content_release`, `content_return`, `content_hide`, `content_unhide`, `content_update_meta`, `content_set_publish_at`.
- `dist_*` 5개: `dist_claim`, `dist_mark`, `dist_sweep_unknown`, `dist_mark_posted`, `dist_requeue`.
- 전부 SECURITY DEFINER + `search_path=public` + `REVOKE ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role`. 인자 이름은 `p_` 접두사(supabase-js `.rpc()`는 이름 있는 인자).
- **`content_distributions.claimed_at timestamptz` 추가**: `dist_sweep_unknown`이 점유 시각을 알아야 하는데 설계서 표에 컬럼이 없었다.
- 모든 쓰기 RPC는 `set_config('app.actor_email'/'app.actor_id', ..., true)`를 먼저 부른다. 안 하면 감사 행이 전부 `db:postgres`로 남는다. 라이브에서 `db:postgres` 0행 확인.

## 3. 검증 결과

- ③ V3-1: 정확히 15행, 오버로드 없음, `prosecdef` 전부 true, `search_path` 전부 설정.
- ③ V3-2: 30행(함수 15 × postgres·service_role), anon/authenticated/PUBLIC 없음. ③ V3-3: missing = 0.
- ② V1: 트리거 12행 전부 `tgenabled='O'`. ② V2: 함수 5행, INVOKER, anon 없음.
- ② 라이브 P1~P11: INSERT 감사 5행, 불변 컬럼·권리 상승·DELETE·TRUNCATE·UPDATE 거부 에러 확인, `alerted_at`이 상태 변경에만 NULL(대조군: 상태 그대로면 유지).
- ③ 라이브 S-1~S-10 + S-2x/S-2y: presign 키 형식, import `created`/`idempotent`/`conflict`, **실패한 수입이 아무것도 남기지 않음**(S-2y 0행), 권리 내리기·상승 거절, 감사 행위자 귀속(`import:news_desk` / `probe@oxxovo`, `db:postgres` 0행), `dist_mark` 실패·백오프(+5분)·`not_sending`, sweep(`count=1`), 로그 4행 순서, `lead_too_short`, `content_hold`의 `returned → held`.

## 4. 사고·정정 기록 (성공만 적지 않는다)

1. **proacl NULL 11개 (본부 실수).** ③ V3-1에서 11개 함수의 `proacl`이 NULL이었다. 본부가 REVOKE/GRANT를 한 줄에 붙여 올렸는데 일부가 실행되지 않았다. 4개(`content_import`, `content_presign`, `dist_claim`, `dist_requeue`)에만 적용돼 있었다. 빠진 11개에 다시 걸고 V3-2로 30행 확인.
   **교훈: `proacl` NULL은 "REVOKE 완료"가 아니라 "기본 권한"이다.** 이 프로젝트 기본값이 `{postgres=X/postgres}`라 실제로 anon이 뚫리지는 않았지만, 명시 REVOKE 결정이 11개에서 빠져 있었다. **함수를 만들면 반드시 V3-2(aclexplode) 쿼리를 돌린다.**
2. **SQL 전달 사고 (전달 방식 문제).** 3-3이 `ERROR 42601 unterminated dollar-quoted string`. 본부가 줄바꿈 오염을 피하려고 블록을 한 줄로 압축했는데, 그러면 `--` 줄 주석이 뒤 코드를 전부 삼킨다. 3-2는 본문에 주석이 없어서 통과했다. **해결: 고유 태그(`$fn_<name>$`) + `/* */` 주석, 줄바꿈 유지, 압축 금지.** 3-3 이후 모두 이 방식. (3-2만 `$$`로 Run됨 -- 파일에 그대로 기록.)
3. **지수 오류 1: T1 첫 안.** `contents`의 UNIQUE 두 개 자리에 `CONSTRAINT ... CHECK (true) NOT VALID` 자리표시자를 남긴 블록을 먼저 보냈다. 같은 응답에서 "쓰지 마라"고 정정했고 본부는 정정본을 Run했다(V4로 제약 확인). 정정본만 파일에 기록.
4. **지수 오류 2: 메시지 잘림 대응.** 응답이 길어 앞부분이 두 번 잘렸다(6개 판단·3-0·3-1~3-3 앞). 나눠 재전송. 긴 SQL은 3~4블록씩 끊어 보낸다.
5. **지수 추정 1건은 코드 읽기만으로 말했다가 라이브로 확인.** "실패한 수입에는 부분 삽입이 남지 않는다"를 코드 읽기로만 결론 냈고, S-2x/S-2y를 추가해 라이브로 확인했다(통과).
6. **미확인으로 남은 것:** 트리거 함수에 `GRANT EXECUTE ... TO service_role`을 붙였는데 PG가 발화 시점에 EXECUTE를 검사하는지는 확인하지 않았다(해로운 설정은 아님).
7. **본부 숫자 오류 1건:** 본부가 "함수 8개"라 했는데 7개였다(15행 기대값과 연결되는 숫자라 짚음).

## 5. 영구히 남은 시험 행 (삭제 불가 -- 의도된 것)

`contents`·`content_assets`·`content_publish_log`는 트리거가 DELETE를 막는다(`contents_history`도 append-only). 아래 행은 지우지 말 것(지우려면 트리거를 끄는 것인데 감사 기록이 없는 삭제가 된다).

| 시험 행 | source_ref | 마지막 상태 | 딸린 것 |
|---|---|---|---|
| ② 트리거 시험 | `probe-trg-20261005` | `hidden`, rights `blocked` | `content_assets` 1행(script), `content_publish_log` 1행, `content_distributions` 1행(x, cancelled), `contents_history` 다수 |
| ③ RPC 시험 | `probe-rpc-20261005` | `returned`, rights `blocked` | `content_assets` 1행(main_16x9, `probe.invalid` URL), `content_distributions` 2행(youtube posted, instagram skipped_no_asset), `content_publish_log` 4행(S-9i 기준), presign 1행(consumed) |
| ③ 실패 수입 시험 | `probe-rpc-fail-20261005` | **없음**(롤백됨) | -- |

- 전부 **restricted로만** 수입했고 최종 상태가 `blocked`/`returned`/`hidden`이라 송출 대상이 될 수 없다. `dist_claim`은 `scheduled`+`cleared`만 잡는다.
- **어드민 목록(⑦)에서 `probe-` 접두사를 기본으로 숨기는 필터**를 만들어야 한다(설계서 §9 시험 행 규약).
- `__audit_probe__`(10-03 `platform_config_history` 3행)와 같은 취급: "그날 실제로 돌았다"는 증거.

## 6. 라이브에서 시험하지 못한 경로 5개 (⑥ 스텁 시험으로 미룸)

`content_hide` / `content_unhide` / `content_release` **성공 경로** / `dist_claim` **점유 성공 경로** / `dist_mark('sent')`.
전부 `scheduled` + `cleared`가 필요하다. 시험 행이 그 상태가 되면 ⑥ 배포 후 실제로 송출될 위험이 있어 라이브에서 만들지 않았다. **코드로 읽은 것이고 실행한 것이 아니다.** ⑥에서 Postiz 호출을 스텁으로 바꾼 상태로 시험한다(설계서 §5-7).
(오늘 라이브로 확인된 `dist_*` 경로는 `dist_mark` failed/not_sending, `dist_requeue`, `dist_sweep_unknown`, `dist_mark_posted`, `dist_claim`의 "빈 결과" 경로뿐이다. 시험 중 `sending` 상태는 `UPDATE`로 직접 만들었다.)

## 7. 계약으로 굳은 것 (④ 엔드포인트 구현의 기준)

### 에러 코드 → HTTP (RPC가 `RAISE EXCEPTION '<code>'`, Node가 메시지로 매핑)
| HTTP | 메시지 |
|---|---|
| 400 | `source_invalid`, `payload_invalid[:..]`, `request_invalid`, `role_invalid`, `bytes_invalid`, `content_type_invalid`, `version_invalid`, `rights_up_denied`, `rights_reason_required`, `rights_reason_forbidden`, `asset_invalid:..`, `main_asset_required`, `channels_invalid:..`, `actor_required`, `result_invalid`, `reason_required`, `title_empty`, `nothing_to_update`, `threshold_invalid`, `url_invalid` |
| 503 | `config_missing:<key>`, `config_invalid:<key>` |
| 422 | `lead_too_short`, `bytes_over_limit`, `approval_not_newer` |
| 409 | `already_imported`, `approval_id_reused`, `concurrent_import`, `invalid_transition:..`, `precondition_failed:..`, `presign_invalid:..`, `rate_limited`, `not_sending` |
| 404 | `not_found` |
- **반환값이지 에러가 아닌 것:** `outcome:'conflict'` -> 409, `outcome:'idempotent'` -> 200(현재 상태 반환), `outcome:'created'` -> 201, `outcome:'lowered'` -> 200.
- 409는 출처에게 "재시도하지 말고 종결"로 취급하게 규격에 명시한다(설계서 §4-3).

### `content_import`의 payload는 출처 규격과 다르다 (Node가 정제해서 넘긴다)
- 출처 규격 필드는 같은 이름으로 그대로 받는다.
- **Node가 추가하는 필드:** `publish_at`, `late_for_slot`, `payload_hash`, `channels[{platform, role}]`, 에셋마다 `media_type`·`url`·`key`.
- **x 채널:** 본부 안 = `main_16x9` 우선, 없으면 `main_9x16` 대체 허용(유튜브·인스타·틱톡은 대체 없음). 이 규칙은 `lib/content-kinds.ts`의 **함수 하나**로 두고 **수입과 송출이 같은 함수를 쓴다**(배포 행에 선택 role 컬럼이 없어 송출 때 다시 고르기 때문 -- TS 두 곳이면 `open_kinds`에서 막으려던 불일치가 재현됨). SQL 변경 없음.

### `content_presign` 동작 (설계서와 다른 처리)
- 요청에 `kind`/`form`이 없어서, **정의된 모든 `content_max_bytes_*` 중 최댓값보다 큰 것만** 거절한다. 정확한 상한은 import에서 `kind`/`form`별로 재검사 -> 뉴스가 600MB를 올리면 presign은 통과하고 import에서 `skipped_oversize`(업로드 낭비는 생기나 잘못 송출되지는 않는다).
- 한도: `content_presign_rate_per_hour`를 `source_ref` 단위에 적용. source 전체 단위는 선택 키 `content_presign_source_rate_per_hour`가 있으면 그 값, 없으면 같은 값. **값 20이면 source 하나가 시간당 presign 20개**(영상 1건에 main+thumbnail이면 약 10건/시간). 뉴스는 충분, 엔터가 몰아 올리면 부족할 수 있음. TK님께 운영 규모를 보고 다시 여쭐 것.

### 기타 RPC 의미
- `content_hold`가 `scheduled -> held`와 `returned -> held`(오반송 복구)를 겸한다. 본부 확정. 별도 RPC 없음, 15개 유지.
- `content_update_meta`: `NULL` = 그대로, `''` = 비움(`description`/`caption`), `title`은 빈 값 불가.
- `dist_claim(open_kinds, limit_n, max_attempts)`: `open_kinds`가 비었거나 `limit_n <= 0`이면 아무것도 점유하지 않는다. `max_attempts` NULL = 재시도 없음.
- `dist_mark`는 `sending` 상태 행만 받는다. sweep이 먼저 `unknown`으로 바꾼 뒤 늦게 끝난 호출은 `not_sending` -> 사람이 `[나갔음]`으로 푼다.
- 로그에는 `requeued`(`[송출]`이 `cancelled`를 되살릴 때)와 `manual_resolved`(`[나갔음]`/`[다시 보냄]`)가 남는다.

## 8. ④ 착수 전 미결 (지수가 코드로 확인해 찾은 7개)

**1~3은 TK님/제니2 결정이 필요하다. 내일 본부가 올린다.**

1. **`upstream_approval_id` 제공 가능 여부 (제니2) -- 유일한 차단.** DB가 이미 `NOT NULL` + `UNIQUE (source, upstream_approval_id)`로 강제한다. 못 준다고 하면 수입이 전부 실패한다. 고치려면 ALTER인데 이제 시험 행이 있어 빈 표가 아니다.
2. **`@aws-sdk` 의존성 추가 (TK 승인).** 앱 `package.json`에 `@aws-sdk/*`가 없고 R2 서명 코드도 없다(R2 자격증명은 `scripts/r2-orphan-sweep.mjs`에만 있다). presign을 하려면 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` 추가를 권한다. SigV4 직접 구현은 서명 버그가 곧 보안 사고라 비권장.
3. **출처별 시크릿 환경변수 (TK가 값 생성).** 뉴스용·엔터용 각 하나. 변수 이름은 지수가 제안, 값은 TK님이 CLI(`vercel env add`)로 넣는다(UI Save 미커밋 결함, 메모리 `reference_vercel_sensitive_env`).
4. **뉴스 스케줄 파서를 새로 써야 한다.** `lib/promo-schedule.ts`의 `parseCadence`는 `promo_*` 키에 고정. 정규식은 SQL(`content_import`)과 같은 모양이어야 하나, **Node 검증은 RPC보다 느슨하게 두고 최종 판정은 RPC에 맡기는 쪽을 권한다**(두 곳이 어긋나면 Node는 통과시키고 RPC가 `config_invalid`로 거절). `nextPublishSlot()`은 순수 함수라 재사용.
5. **`payload_hash` 정규화 규칙이 설계서에 없다.** 키 정렬·공백·숫자 표기·배열 순서가 안 정해졌다. ④에서 정규화 함수 하나 + 단위 테스트를 먼저 만든다(`assets`는 `role`로 정렬, `key`·`sha256` 포함, 서버 결정 필드 `source`·`status`·`publish_at` 제외, `rights_reason` 포함).
6. **sha256 검증과 R2 객체 존재 확인은 Node 몫이다.** RPC는 `key`가 발급 기록과 맞는지만 본다. import 전에 Node가 R2 HEAD로 존재를, 스트리밍으로 sha256 일치를 확인해야 한다. 순서가 어긋나면 없는 객체가 수입된다.
7. **AGENTS.md: 코드 전에 Next.js 문서를 읽는다.** 이 레포는 `next` 16.2.6. 라우트 핸들러 규칙: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`. 이번 세션에서는 아직 읽지 않았다(파일 존재만 확인).

## 9. 그 밖의 미결

- `e9957ca` robots 주석 배포 전(라이브 `09e3580`). 배포는 TK님이 `! npm run deploy:prod`.
- eslint 기준선 71건(`reports/eslint_baseline_2026-10-03.md`).
- ElevenLabs·Hedra 약관 상업 이용 조건 (뉴스·엔터가 확인, 그때까지 뉴스는 전부 `held`).
- `music` kind가 넘기는 것(음원인가 영상인가, `surface` CHECK 확장 여부) (제니2).
- AI 생성물 표기 의무(플랫폼별) (제니3), 송출 전 필수.
- `content_presign_source_rate_per_hour` 선택 키 -- 운영 규모가 보이면(INSERT 한 줄, 코드 수정 없음).
- **R2 환경변수(`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`)가 Vercel 프로덕션에 있는지 미확인.** `vercel env pull`이 민감 값을 빈 문자열로 줘서 값을 못 본다. 이름 존재 여부만이라도 확인 필요.
- 공개 경로 이름(slug), `restricted -> blocked` 허용 방향 확인(TK) -- 설계서 미결.
- 설계서 후속(본부가 반영하기로 함): §6-8 감사에 INSERT 포함 / TRUNCATE 거부 트리거 / 불변 컬럼에 `id`·`created_at` / 트리거 함수 `trg_*` 접두사 / §6-5b에 "RPC는 `set_config('app.actor_email', ..., true)`를 먼저 부른다". 지수가 추가로 짚은 설계서 내부 불일치: §6-1의 `return_content()`는 표의 `content_return`과 이름이 다르고, 변경이력(최종 c)의 `update_content_meta`는 표의 `content_update_meta`와 다르며, §2-3의 "§5-5" 참조는 "§5-4"가 맞다. 에러 코드 -> HTTP 매핑 계약도 설계서에 넣겠다고 함.
- 어제 미결 이월: `description_ko` 분기 라이브 미검증 / `ALERT STATE%` 제외 미증명 / `updated_at` 트리거 없는 C분류 5개 테이블.

## 10. 인계 메모 (이어받는 사람용)

**현재 상태**
- 레포 `main`. 이 EOD 커밋 전 마지막 커밋: `f6dd97e`(SQL 3개), `45cdbe3`(설계서). 코드 변경 없음.
- 라이브 = `09e3580`, 오늘 배포 없음. `vercel.json`이 `git.deploymentEnabled.main=false`라 push만으로는 배포되지 않는다.
- 플래그: `competition_publication_enabled=false`, `news_publication_enabled=false`, `news_dispatch_enabled=false`, `entertainment_dispatch_enabled=false`, `entertainment_publication_enabled=false`. **`social_dispatch_enabled=true`**(promo 가드가 배포되기 전까지 이 값을 읽는 코드가 없다). `watch_as_home=false`. 건드리지 말 것.
- DB: Phase 1 표 6개·트리거 12개·RPC 15개·설정 키 12개 라이브. **호출하는 앱 코드는 아직 없다.**

**재개 순서**
1. 이 파일 8절(④ 미결) 확인. 본부가 TK님 결정(2, 3)과 제니2 답(1)을 가져온다. **1이 없으면 ④를 시작하지 않는다.**
2. 라우트 핸들러 문서(`route.md`)를 읽는다.
3. ④: `POST /api/contents/import`, `POST /api/contents/presign`, `POST /api/contents/rights-down`, `GET /api/contents/status`, `GET /api/contents/returns`. 출처별 시크릿 -> `source` 결정. RPC는 `createSupabaseAdmin()`(`lib/supabase-admin.ts`)로 호출. `status`/`returns`는 RPC 없이 `contents`를 service key로 읽는다(자기 `source` 행만, 커서 `(returned_at, id)`).
4. 구현 순서는 설계서 §9의 ④ -> ⑤ -> ⑥ -> ⑦ -> ⑧ -> ⑨ -> ⑩. **⑤(공개 판정)를 ⑦(어드민)보다 먼저.**

**작업 규칙(오늘 재확인)**
- SQL은 채팅 본문으로, 블록 하나에 쿼리 하나, **고유 태그($fn_name$) + `/* */` 주석, 압축 금지**. 되돌리기는 별도 블록. 사전 조회는 대조군 포함. TK님이 Run한다 -- 지수는 Run하지 않는다.
- 함수를 만들면 **V3-2(aclexplode)로 권한을 반드시 확인**한다. `proacl` NULL을 통과로 읽지 않는다.
- 배포·DB 변경은 지시 전까지 하지 않는다. 배포는 TK님이 `! npm run deploy:prod`.
- 안 맞다고 보이면 근거를 대고 반대할 것(TK 상시 지시). 실패·반례도 기록할 것.
- `vercel env pull`은 민감 값을 빈 문자열로 준다. 값을 읽는 일은 하지 말 것.

**하지 않은 것 (오늘 지시)**
배포 / DB 직접 변경(전부 TK님 Run) / ④ 코드 착수.
