# EOD 2026-10-05 (2부) -- 지수(메인, 앱 레포): ④ 엔드포인트 + ③b RPC 재정의

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문 그대로.
**읽는 순서:** 1부(`jisu_hq_2026-10-05_eod.md`)는 Phase 1 DB(①②③) 경과. 이 2부는 그 뒤에 일어난 것(③b와 ④ 코드)만 적는다. 재개하려면 이 파일의 7절(미결)과 8절(다음)만 읽으면 된다.

## 0. 한 줄 요약

**③b(RPC 재정의 2개 + 키 2개)를 라이브에 넣고 시험까지 통과**했고, **④ 엔드포인트 5개를 코드로 완성해 push**했다(배포 안 함, 라이브는 여전히 `09e3580`). ④ 런타임 시험은 R2 버킷·환경변수·시크릿이 Vercel에 들어간 뒤에 한다(TK님 작업).

## 1. 레포 상태

| 커밋 | 내용 |
|---|---|
| `d765917` | 설계서 최종 l (upstream_approval_id = 소문자 UUID, 엔터/뉴스 차이, 뉴스 재시도 규칙) |
| `7b3a46d` | `lib/content-hash.ts`(payload_hash 정규화), `lib/content-kinds.ts`(레지스트리) |
| `8074136` | `/api/contents/{import,presign,rights-down,status,returns}` + 보조 lib 전부 + `@aws-sdk/client-s3`·`s3-request-presigner` |
| `0594962` | `allowed_platforms` 빈 배열 허용(Node), 에러 매핑 `url_required`, ③b SQL 파일 |

- 라이브 = `09e3580`. 배포 없음. `vercel.json`이 `main` 자동 배포를 막아 두어 push만으로는 배포되지 않는다.
- 새 라우트는 닫혀 있다: 시크릿 env가 없으면 401, R2 env가 없으면 503(`r2_not_configured`). 호출하는 출처도 아직 없다.
- 검증된 것: 단위 테스트 70개(`lib/content-*.test.ts`) 통과, `tsc`·`eslint` 깨끗, `next build` 성공(라우트 5개 빌드됨).
- **검증되지 않은 것:** 라우트가 RPC를 부르는 경로 라이브 실행, R2 실제 PUT/HEAD/GET, 라우트 런타임 전부.

## 2. ③b -- 라이브 DB 변경 (TK님이 Run, 지수는 Run하지 않았다)

SQL 원본: `reports/phase1_step3b_rpc_redefine_2026-10-05.sql` (Run된 그대로의 기록, 다시 Run 금지). 되돌리기 블록은 의도적으로 넣지 않았다(Supabase SQL Editor 함정). 원래 정의는 `phase1_step3_rpc_2026-10-05.sql`의 3-3, 3-15.

**`content_import` 재정의 (A1)**
1. 빈 `channels` 허용(출처의 `allowed_platforms: []`는 "사이트 공개만 하는 master"라는 의도로 읽는다).
2. 에셋이 **수입 상한**(`content_max_bytes_<kind>_<form>` → default)을 넘으면 `bytes_over_limit` 422로 **수입 자체를 거절**한다(presign 소비보다 앞).
3. 채널 `skipped_oversize`는 **송출 상한**으로 판정한다: `content_dispatch_max_bytes_<kind>_<form>` → `content_dispatch_max_bytes_<form>` → `content_dispatch_max_bytes_default`.
4. 송출 상한 default가 없으면 `config_missing:content_dispatch_max_bytes_default`(503). 더 구체적인 키가 있어도 default 행은 항상 요구한다.

**`dist_mark_posted` 재정의 (A2)** -- 영구 장치(장애 때 사람이 푸는 수단)다. 임시 분기가 아니다.
- `unknown`/`failed` -> `posted`: URL 선택(이전과 같음).
- `skipped_oversize`/`skipped_no_asset` -> `posted`: **URL 필수**(`url_required`). 근거: 우리가 보내지 않은 것이라 "사람이 올렸다"는 주장의 유일한 증거가 URL이다.
- URL 검증 강화: `https://` + 공백 없음 + 2000자 이하(전 경로 공통, `url_invalid`).
- 로그 reason: `marked posted from=<이전 status> url=<URL 또는 -> by <처리자>`. 처리 시각은 `created_at`.

**키 2개 (TK님 결정)**
- `content_dispatch_max_bytes_default = 104857600` (100MB). **초기 safety 값이며 콘텐츠 규격이 아니다.** 근거: `uploadMedia`가 파일 전체를 메모리로 받고 `Blob`으로 한 번 더 복사한다(`lib/postiz.ts:91-105`). Vercel 함수 메모리 설정은 확인하지 못했다.
- `content_max_bytes_film_full = 10737418240` (10GB). 초기 safety ceiling이며 "영화가 보통 10GB"가 아니다.
- **만들지 않은 키:** `content_dispatch_max_bytes_trailer/long/full` 등. 원칙: "모르는 숫자를 미리 설정하지 않는다". 안 만들면 default 100MB로 폴백한다. 따라서 full은 100MB 초과 시 `skipped_oversize`가 되고, SNS 금지로 하드코딩하지 않는다.

**결정 이력 (제니2·본부·지수 합의 10-05)**
- 수입 상한과 송출 상한 분리(가). 스트리밍 송출(나)은 Phase 1에서 안 함. "본편 SNS 금지"(다)는 코드로 만들지 않음.
- `allowed_platforms`: 키 필수, 배열 필수, `[]` 허용. 키 누락/`null`은 400. 어드민에 "SNS 송출 대상 없음" 배지(정보, 경고 아님), 수입 알림 메일에 명시.
- platform별 상한은 만들지 않는다. 우리 상한은 우리 메모리 때문이라 platform과 무관하다. platform 쪽은 별개 영역(허용 format·aspect·duration·실제 upload limit·resumable 지원·asset-role 매핑)으로 Platform Capability/Policy에 따로 둔다.
- **대용량 자동 송출은 후속 필수 개발이다(검토 항목이 아님).** `skipped_oversize`는 Phase 1의 임시 안전장치이고, streaming/resumable uploader는 별도 Publishing Phase. 영화·드라마 본편의 YouTube 자동 송출이 사업모델이므로 수동 업로드가 정상 운영으로 굳으면 안 된다.

## 3. 라이브 검증 결과

| 단계 | 결과 |
|---|---|
| A0 | 재정의 전: `content_import` old_empty_channels_guard=true / `dist_mark_posted` 모두 false (기대대로) |
| A1 | Success, V1에서 `content_import` 반영 확인(guard=false, has_dispatch_cap=true) |
| **A2** | **Success였으나 반영 안 됨**(4절). 재Run 후 `len 1524`, `pos_url_required 904`, `pos_new_reason 1321`, `pos_old_reason 0` |
| V2 | 15행, 오버로드 없음, `prosecdef` 전부 true, `proconfig {search_path=public}` 전부 |
| V3 | 30행(함수 15 × postgres·service_role). `CREATE OR REPLACE`가 ACL을 유지함 |
| K0~K3 | 대조군 `content_max_bytes_default` 1행만 → 키 2개 INSERT → 3행, `has_ws` 전부 false |
| R-1 | presign 3건, key 형식 정상(`imports/news_desk/<ref>/v1/<role>-<nonce>`) |
| R-2/R-2b | 빈 `channels` 수입 `created/held/restricted`, `channels:null`, 배포 행 0 |
| R-3/R-5 | 200MB 에셋: `youtube skipped_oversize`, `instagram skipped_no_asset`, `tiktok queued` (수입은 통과, 채널만 막힘) |
| R-4/R-4b | 600MB: `bytes_over_limit`(발급 안 된 키인데 `presign_invalid`보다 먼저 -> 상한 검사가 presign 소비보다 앞), `rows_left = 0`(롤백) |
| R-6/R-7 | `url_required`, `url_invalid`(URL 형식 검사가 상태 검사보다 앞) |
| R-8/R-10 | `skipped_oversize`/`skipped_no_asset` + URL -> `posted`, `from=` 확인 |
| R-9/R-11 | `url_required`, `invalid_transition:posted->posted`(허용 상태를 넓힌 것이 `posted`까지 열지 않음) |
| R-12a/b | `unknown` -> `posted` URL 없이 성공(기존 동작 유지) |
| **R-13** | **정확히 3행**, 전부 `manual_resolved`, reason에 `from=skipped_oversize` / `from=skipped_no_asset` / `from=unknown`, URL, `by probe@oxxovo`. 에러로 끝난 호출 4건(R-6/7/9/11)은 로그를 남기지 않음 |

**"oversize였다"가 남는 곳은 R-13의 `from=` 한 곳뿐이다.** `content_import`는 skip이 되는 순간 `content_publish_log`에 행을 남기지 않고(`result`에 `skipped` 값도 없다), 배포 행은 `posted`가 되면 이전 상태를 잃는다. 본부가 "append-only라 자동으로 남는다"고 가정했는데 틀렸고, 그래서 reason에 이전 status를 넣었다.

**영구히 남은 시험 행 (삭제 불가, 의도된 것)**: `probe-redef-a-20261005`(빈 channels, `held`/`restricted`), `probe-redef-b-20261005`(채널 3개, 전부 `posted`로 닫힘, `held`/`restricted`). `probe-redef-c-20261005`는 없음(롤백). 전부 `restricted`라 송출 불가. 1부의 `probe-trg-`, `probe-rpc-`와 합쳐 어드민 목록(⑦)에서 `probe-` 접두사를 기본으로 숨겨야 한다.

## 4. 사고·정정·교훈 (성공만 적지 않는다)

1. **`CREATE OR REPLACE`가 `Success. No rows returned`를 내고도 반영되지 않았다(A2).** 원인은 모른다(편집기에서 블록이 잘렸거나 다른 것을 Run했을 수 있다). V1의 `has_from_audit=false`로 잡았고, D1(`prosrc` 길이·md5·토큰 위치)로 "옛 정의 그대로"를 확인한 뒤 A2를 재Run했다.
   **교훈: 함수를 바꾸면 Success만 보지 말고 `prosrc`로 되읽는다.** 1부 4절의 `proacl NULL`과 같은 종류("검증이 PASS를 내면서 새고 있었다").
2. **내 검사가 약했다.** V1에서 A2 반영 여부를 `position('from=' in prosrc)` 단일 토큰 하나로만 봤다. 그 덕에 못 들어간 것은 잡았지만 원인 구분(옛 정의 vs 문자열만 다름)은 안 되는 지표였다. **다음부터는 그 정의에만 있는 토큰(`url_required` 같은)을 같이 본다.** 본부는 "지표가 있어서 찾았다"며 자책은 받지 않았고, 토큰을 같이 보는 쪽으로 가기로 했다.
3. **0행 결과는 "성공"과 "실행 안 됨"이 구분되지 않는다.** R-4b("롤백됐는지")를 `SELECT id ...`로 받으면 `Success. No rows returned`가 두 경우에 똑같이 뜬다. `count(*)`로 받아 행으로 확인했다(`rows_left = 0`). 롤백 같은 "없음" 증명은 항상 `count(*)` 형태로 쓴다.
4. **본부 오류:** 설계서 가정 "append-only라서 skip 이력이 자동으로 남는다"가 틀렸다(2·3절). 설계서에 정정이 들어간다.
5. **지수 오류 -- 내 테스트가 서로 모순이었다.** `content-schedule.test.ts`에서 "05:00 KST + 리드 120분 -> 오늘 07:00 슬롯, late 아님"과 "경계 케이스(슬롯이 정확히 now+lead면 다음 날로 미룬다)"를 같은 입력으로 썼다. 04:00 KST로 고쳐서 두 테스트의 입력을 분리했다. (이 경계 처리는 Node 시계와 DB 시계의 어긋남으로 `lead_too_short`가 나는 경쟁을 막으려는 30초 여유이고, 코드 의도와 일치한다.)
6. **도구 문제(내 출력이 아님):** Grep 도구가 `uv_spawn` 오류로 한 번 실패해 PowerShell로 대체했다. Bash 도구에서 따옴표가 많은 heredoc 두 건이 `unexpected EOF`로 실행되지 않아 Write 도구로 대체했다(첫 번째 건은 아무것도 쓰이지 않았음을 확인하고 다시 했다).
7. **지수가 먼저 찾은 충돌(기록).** `film_full` 10GB 키가 기존 `content_import`와 같이 쓰이면 10GB 영화가 `queued`가 되어 송출 때 함수가 죽는 충돌은 지수가 코드로 찾았다(10GB 키를 넣기 전에 RPC를 고치게 된 이유).

## 5. 빌드·번들·의존성 (④ 착수 전 본부가 요청한 확인)

- **번들 크기:** `next build`(Turbopack) 후 라우트별 추적 파일 합계. `contents/import` 3.2MB(추적 171파일, 그중 `@aws-sdk`·`@smithy` 1.3MB), `contents/presign` 3.2MB(1.3MB), `contents/rights-down`·`status`·`returns` 1.8MB(SDK 0). 비교로 `cron/promo-schedule` 2.9MB. Vercel 함수 한도(압축 해제 250MB) 대비 영향 없음. 로컬 빌드 기준이며 Vercel에서 실측한 것은 아니다.
- **`npm audit`:** `@aws-sdk` 추가 전(`d765917`)과 후가 **동일**(총 15건: low 1, moderate 1, high 12, critical 1). 그중 `aws`·`smithy` 항목 0건. 설치 때 보인 audit 경고는 기존 것이고 이번 의존성 때문이 아니다.
- **R2 환경변수 현황:** Vercel 프로덕션 환경변수 19개 중 `R2_*` 4개, `R2_PUBLIC_BASE`, 시크릿 2개 **전부 없음**(이름만 확인, 값은 읽지 않았다). R2 자격증명은 `oxxovo-studio/.env`(워커 쪽)에만 있다.

## 6. 설계서에 반영할 사항 (본부가 반영, 지수 목록)

- §3-3: `allowed_platforms`는 키·배열 필수, 빈 배열 허용. `upstream_approval_id`는 Node에서 소문자 UUID 검증, 컬럼 CHECK 없음(최종 l에 반영됨).
- §5-5/§12: 수입 상한과 송출 상한 분리, 3단계 조회, 키 2개, "모르는 숫자는 미리 설정하지 않는다", `skipped_oversize`는 "자동화 실패 -> 사람 해결 -> `posted`로 정상 종료 가능한 상태".
- §6-4: `dist_mark_posted`가 받는 상태 4개와 `skipped_*`는 URL 필수. `dist_mark_posted`는 영구 장치.
- §6-8/§2-3b: 로그 보존은 자동이 아니다(위 3절).
- §11 잔여 위험: "대용량 자동 송출 미구현. dispatch 상한을 넘는 채널은 `skipped_oversize`로 막고 사람이 처리한다. 최종 구조가 아니며 streaming/resumable uploader는 별도 Publishing Phase에서 한다. **후속 필수 개발이며 검토 항목이 아니다.**"
- §8 어드민: kind 필터, "SNS 송출 대상 없음" 배지, `probe-` 기본 숨김.
- §3-2 R2: 버킷 `oxxovo-imports`(워커 버킷과 분리), 키 `imports/<source>/<source_ref>/v<n>/<role>-<nonce>`, kind는 경로와 object metadata에 넣지 않는다(kind는 수정될 수 있고 키는 영구 정체성). 종류별 조회는 어드민 DB 필터가 SSOT.
- §9 프로브 규칙: "송출 채널이 있으면 restricted만". 빈 배열 + cleared 시험 행은 Postiz에 닿을 수 없어 ⑩에서 스텁 없이 `scheduled` 경로를 시험할 수 있다(`content_hold`/`release`/`hide`/`unhide` 성공 경로 중 상당수).
- 구현 중 정한 `payload_hash` 정규화 규칙(설계서에 없던 것): 키 정렬, NFC(트림·대소문자 변환 없음), `null`=미전송(`''`은 별개), 타임스탬프 UTC ISO, `allowed_platforms` 순서 무관·중복 예외, `assets`는 `role` 순·중복 예외, 모르는 필드 예외, `upstream_approval_id`·`rights_reason` 포함, 해시 입력 앞에 `oxxovo.content-import.v1\n`. **규칙을 바꾸면 이미 저장된 행의 해시와 어긋나 재전송이 409가 되므로 바꿀 때 접두사를 올리고 이관 계획을 먼저 세운다.**

## 7. 미결

**TK님/본부 작업 (④ 런타임 시험 전제)**
1. Cloudflare에 버킷 `oxxovo-imports` 생성, 이 버킷 전용 R2 토큰(Object Read & Write, 버킷 하나로 한정), 공개 읽기 주소(`R2_PUBLIC_BASE`)를 정한다. 절차는 본부가 올리기로 함.
2. Vercel 프로덕션에 환경변수 5개: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE`. 값은 `vercel env add <이름> production`으로 하나씩(UI Save 미커밋 결함, `env pull`은 민감 값을 빈 문자열로 줌).
3. 출처별 시크릿 2개: `CONTENT_IMPORT_SECRET_NEWS_DESK`, `CONTENT_IMPORT_SECRET_PRODUCTION_OS`. **각 32자 이상, 서로 다른 값**(짧으면 인증 거절, 두 값이 같으면 둘 다 거절하게 만들었다).

**지수가 이어서 할 일/알아 둘 것**
4. **라이브에서 시험하지 못한 3건:** 송출 기본 키 부재 시 503(키를 지워야 해서 뺌), 송출 상한 2·3단계 조회(해당 키가 없음), `content_max_bytes_film_full`이 film/full 수입에 적용되는지(film 시험 행 없음). 설계서 미결로 남긴다.
5. **`content_presign`의 상한 검사는 정의된 `content_max_bytes_*` 중 최댓값**을 쓴다. `film_full` 10GB 키가 생겨서 **뉴스도 presign은 10GB까지 통과**한다(import에서 `bytes_over_limit`로 거절되므로 업로드 낭비일 뿐 잘못 송출되지는 않고, 시간당 20건 제한이 있다). presign 요청에 kind/form이 없어서 생기는 구조적 한계. 필요해지면 요청에 `kind`·`form`을 받는 방향을 검토.
6. 시험하지 못한 라이브 경로 5개(1부 6절)는 빈 배열 + cleared 프로브로 ⑩에서 상당수 풀린다. `dist_claim` 점유 성공 경로와 `dist_mark('sent')`는 여전히 ⑥ 스텁이 필요하다.
7. 설계서 미결 #10(R2 presigned PUT 체크섬 실제 동작), #11(`r2-orphan-sweep.mjs`가 `imports/`를 치우나. 새 버킷 분리로 급하지 않다), #12(Postiz 게시 삭제), #9(`external_url` 채우기)는 그대로.
8. 코드 쪽 알아 둘 것: (a) import 라우트의 "같은 버전 재전송 단락"은 `(source, ref, version)` 행이 있으면 R2·스케줄을 건드리지 않고 멱등(200)/충돌(409)로 답한다. 이전 버전(`< max`)에도 같은 규칙이 적용된다(RPC는 그런 경우 `version_invalid`). 해시가 같을 때 200은 사실이라 문제없다고 판단했다. (b) 타임아웃 재시도가 새 UUID를 만들면 409가 된다는 뉴스 쪽 규칙(`(source_ref, version)`당 UUID 하나)은 뉴스 제니가 확정했다. (c) `@aws-sdk` 서명은 `ContentLength`와 `ContentType`을 포함하므로 출처가 PUT에서 정확히 그 헤더를 보내야 한다(`required_headers`로 응답에 넣었다).

**그 밖의 이월 미결(1부 9절 그대로)**: `e9957ca` robots 주석 배포 전, eslint 기준선 71건, ElevenLabs·Hedra 약관, `music` kind 내용, AI 표기 의무(제니3), 공개 경로 slug, `restricted -> blocked` 방향, `description_ko` 분기 라이브 미검증, `ALERT STATE%` 제외 미증명, `updated_at` 트리거 없는 C분류 5개 표.

## 8. 다음 (재개 순서)

1. TK님이 위 7절 1~3을 끝내면 **④ 런타임 시험**: presign 라이브 시험(설계서 #10 체크섬 확인 포함), `restricted` 프로브로 import 전 경로(`created`/`idempotent`/`conflict`/`lead_too_short`/`bytes_over_limit`/`not_uploaded`), rights-down, status, returns(커서). 모든 프로브는 `probe-` 접두사 + `restricted` 또는 송출 채널 빈 배열만.
2. 구현 순서는 설계서 §9: **⑤ 공개 판정(`lib/content-public.ts`, fail-closed)을 ⑦ 어드민보다 먼저**, 그다음 ⑥ 크론·송출 가드·promo 가드, ⑦ 어드민(`/admin/contents`, kind 필터·배지·`probe-` 숨김), ⑧ 알림 메일(`sendAdminAlert`에 `to?` 추가, 알림 ①b `alerted_at`/`notified_at`), ⑨ 공개 페이지·`/c/<id>`, ⑩ 라이브 검증.
3. ⑥에서 송출 직전 `content_assets.bytes`를 송출 상한과 한 번 더 대조한다(수입 후 상한이 바뀔 수 있음). 이때 `dist_mark`에 `skipped` 결과가 없으므로 `failed_terminal`(`last_error='oversize'`)로 기록하면 "조치 필요"에 뜬다.

**작업 규칙(재확인)**
- SQL은 채팅 본문으로, 블록 하나에 쿼리 하나, 고유 태그 + `/* */` 주석, 압축 금지, 한 번에 3~4블록. 되돌리기는 별도. TK님이 Run한다. 지수는 Run하지 않는다.
- **함수를 만들거나 바꾸면 `prosrc`(그 정의에만 있는 토큰 둘 이상)와 `aclexplode`로 되읽는다. 0행으로 증명해야 하는 것은 `count(*)`로 받는다.**
- 배포·DB 변경은 지시 전까지 하지 않는다. 배포는 TK님이 `! npm run deploy:prod`.
- 안 맞다고 보이면 근거를 대고 반대할 것(TK 상시 지시). 실패·반례도 기록할 것.
