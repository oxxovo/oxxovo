# EOD 2026-10-10 -- 지수(메인, 앱 레포) 작업 요약 + 인계

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문 그대로.
**읽는 순서: 0절 -> 1절(라이브 상태) -> 3-2절(⑩ 진행: 어디서 재개하나) -> 7절(남은 것·하지 말 것) -> 9절(커밋 안 된 파일).**
이 파일은 로컬 작성이고 **커밋·푸시하지 않았다**(본부 지시). 코드 변경은 없다. 바뀐 파일 4건은 9절에 나열했다.

## 0. 한 줄 요약

**라이브 = 레포 HEAD = `175855f`. 스위치는 마스터만 열림, SNS 게시 0건, 공개 전부 404, 크론 `no_open_dba`.** 오늘은 코드 없이 ① A(`postiz_channel_youtube` 조회 흔들림)를 "데이터 쪽 배제, 쿼리 쪽 한정"으로 종결했고 ② ⑩을 9:16 대체 경로 없이 **16:9 필러박스 영상**으로 돌리기로 결정·안전 순서를 정리했고 ③ 수입 상한 분석을 끝냈고 ④ 설계-구현 격차 2건을 정리했다. **⑩은 시작했고 사전 확인 A1~A4까지 통과, A5부터 재개한다. 뉴스 수입은 아직 실행하지 않았다**(3-2절). 규격 파일이 오피스 PC(세종)로 넘어가지 않아서 내일 TK님이 전달한다.

## 1. 라이브 상태 (오늘 확인한 값 — 근거와 한계)

| 항목 | 값 | 근거 / 한계 |
|---|---|---|
| 라이브 SHA | `175855f`, `dirty:false`, `builtAt 2026-10-07T22:51:53Z` | `www.oxxovo.ai/api/version` 직접. 레포 HEAD와 일치, `origin/main`과 동일. 10-08 EOD 때의 미배포분 `99b2670`(메일 영어)은 이 배포에 들어 있다. **그 배포의 `deploy:verify` 출력과 첫 틱은 이 세션에서 보지 못했다.** |
| 크론 틱 | 10-10 15:05Z~19:10Z, 틱 50개, 배포 `dpl_9BZw...` 하나 | 전부 `no_open_dba`, `processed:0`, `notified:0`, `returnedNotified:0`, `warnings:[]`. **`vercel logs` 조회 창이 약 4시간이라 `4fb8824` 직후~10-10 15:05Z는 직접 못 봤다**(10-07·10-08 EOD 기록을 따름). 이상이 있었다고 볼 근거는 없지만 없었다는 확인도 아니다. |
| 스위치 | S1-3 결과(TK님 Run, 8행): `social_dispatch_enabled=true`(2026-10-06 06:45), `news_dispatch_enabled`·`entertainment_dispatch_enabled`·`news_publication_enabled`·`entertainment_publication_enabled`·`competition_publication_enabled`·`watch_as_home` 전부 `false`, `content_dispatch_per_tick=10`. `content_youtube_visibility` 행 없음 | DB 직접 조회는 TK님이 했다(지수는 서비스 키를 쓰지 않음). 마지막 기록과 일치. |

## 2. A 종결: `postiz_channel_youtube` 조회 0/1 흔들림 -- 데이터 쪽 배제, 쿼리 쪽 한정 (원인 미특정)

- **S1 결과(TK님 Run 2026-10-10):** 4개 채널 행 모두 키 길이가 키 이름과 일치(24/21/16/22)·값 25자·공백 없음·비어 있지 않음, `updated_at` 전부 `2026-06-10 19:22:38`. `platform_config_history`에 `postiz_channel_%` 변경 **0건**.
- **왜 "10-07의 `n=0` -> `n=1`은 데이터 변경이 아니다"가 성립하나:** 10-03 23:15에 `trg_platform_config_touch`(BEFORE UPDATE, `updated_at` 갱신)와 `trg_platform_config_audit`(AFTER INSERT/UPDATE/DELETE, history 기록)가 붙었다(10-03 EOD 3절). 그 이후의 값 변경은 `updated_at`과 history에 남는다. 둘 다 변화가 없으므로 10-07의 흔들림은 데이터 변경이 아니고, 석 달 넘게 안 바뀐 행이므로 복제 지연도 아니다. **트리거가 지금도 활성인지는 `pg_trigger` 조회로 확인하는 항목이 남아 있다**(`tgenabled='O'` 두 행; 확인한 날짜: ____).
- **"6/10 이후 한 번도 안 바뀜"은 증명되지 않았다(정정).** 10-03 23:15 이전에는 `updated_at`에 트리거가 없었고 `update_platform_config`는 오버로드(PGRST203)로 한 번도 성공하지 못해 history가 0행이었다. 마이그레이션이 네 채널을 `value=''`로 심었으므로(`promo_videos_migration_2026-06.sql:79`) 지금 25자 값은 **INSERT 이후에 채워진 것**이다. 언제 채워졌는지는 기록이 없다.
- **남은 가설:** 쿼리 쪽 -- 채팅 SQL의 줄바꿈·공백 오염, 또는 SQL Editor가 여러 문장 중 마지막 결과만 보여주는 함정. **10-07 쿼리 원문이 레포에도 EOD에도 없어서 둘 중 어느 쪽인지는 구분하지 못했다.** "원인 확정"이라고 쓰지 않는다.
- **대책:** ⑩ 직전에는 S1-1 형식(`key`·`length(key)`·`length(value)`·`has_ws`)으로 같은 쿼리를 **두 번 이상** 돌려 `n=1, val_len=25`를 확인하고, **쿼리 원문을 결과와 함께 EOD에 붙인다.** 같은 쿼리가 다시 `n=0`을 내면 그때는 쿼리 문자열 자체를 의심한다.
- 코드 쪽 안전: 키가 없거나 값이 비면 `PostizConfigError`로 실패하고(`lib/postiz.ts:157`) 잘못된 곳으로 나가지 않는다. 최악은 시험이 막히는 것이다.

## 3. ⑩ 준비 현황 (코드 변경 없음)

- **결정(TK님 2026-10-10):** 뉴스 9:16을 YouTube에 보내는 설정 키안(한정 키)은 **폐기**. 대신 뉴스 제니가 **9:16 완성본을 16:9 캔버스 가운데에 넣은 `main_16x9`(좌우 여백, 100MB 이하, `cleared`)** 로 수입한다. `PREFERRED_ROLES.youtube=['main_16x9']`는 그대로. 코드·배포 변경이 없으므로 "alias 직후 틱이 옛 배포를 탈 수 있다" 주의(10-08 EOD 4절)는 이번에는 걸리지 않는다.
- **확인된 사실(읽기):** 필러박스는 가로 영상이라 일반 영상으로 올라간다(Shorts 아님). Shorts 분류·길이 확인 항목은 이번 시험에서 빠진다. 설명(본문) 매핑, `type:private` 실제 비공개 여부, `postId`와 삭제 id 일치, 반송 알림 메일은 그대로 확인한다.
- **TK님 승인:** 약관(ElevenLabs·Hedra) 미확인 상태의 비공개 1건 감수 -- 승인됨. 뉴스 제니는 이 1건에 한해 `cleared`로 수입한다.
- **뉴스 제니에게 요청해 둔 것(본부):** `allowed_platforms:["youtube"]`만, 시험 중 다른 news `cleared` 수입 금지, 시험 후 `rights-down`(blocked).
- **새어 나갈 경로 점검 결과(코드·SQL 읽기):**
  1. `dist_claim`은 플랫폼을 고르지 않는다(`phase1_step3_rpc_2026-10-05.sql:638-649`; 정렬 `publish_at, created_at, id`). **수입에 다른 플랫폼 행이 섞이면 그 행이 먼저 나갈 수 있다.** 그래서 **송출 행이 정확히 1개(youtube)** 인 것을 스위치 열기 전에 확인한다. 같은 DBA의 다른 `scheduled`+`cleared` 콘텐츠도 후보가 되므로 다른 후보 0건도 확인한다.
  2. 송출 뒤 [반송] 전까지 콘텐츠는 `scheduled`+`cleared`+발행 시각 경과라서 **`news_publication_enabled=false` 하나만이 공개 화면 노출을 막는다.** 시험 중 열지 않는다.
  3. `content_return`(`:467-497`)은 `scheduled`/`held`/`hidden`에서 `returned`로 바꾸고 **`queued`만 `cancelled`** 한다. 이미 나간 YouTube 게시(Studio에서 직접 삭제), `sending` 중인 행은 못 막는다. `returned -> held` 복구 경로가 열려 있다.
  4. **`rights-down`을 `blocked`로 직행 내려도 된다**(코드 확인): RPC가 `restricted`/`blocked` 둘만 받고(`:359`) 순위 비교로 `v_new < v_old`만 거절(`:368-370`), 트리거는 같은 순위로 내려가는 방향만 허용(`phase1_step2_triggers_2026-10-05.sql:145-149`), CHECK 제약 둘(`rights_reason` 필수, `scheduled`는 `cleared` 필수)은 RPC가 같은 UPDATE에서 충족한다. 10-06 EOD에 `rights-down lowered`(+배포 행 `cancelled`)가 라이브 통과로 적혀 있으나 **어느 값으로 시험했는지는 기록에서 못 찾았다** -> `cleared -> blocked` 직행은 라이브에서 본 적 없음. 시험 행으로 돌려 보지 않았고, `lowered`와 `rights_status=blocked`를 S3-1로 읽어 확인한다. 라우트 본문 필드는 `source_ref`, `source_version`(정수), `rights_status`, `rights_reason`(비어 있지 않은 문자열) 넷만.
  5. 약관 미확인 영상의 R2 파일은 상태·반송과 무관하게 키를 알면 열린다(설계서 §8-2, 의도된 한계).
- **확정된 순서:** 송출 확인 -> Studio 삭제 -> [반송] -> `rights-down`(blocked). **송출 전에 `rights-down`을 내리면 시험이 막히므로 송출 후에만.**
- **스위치를 열기 전 통과 조건:** (a) S3-2 다른 후보 0건 (b) S2-2 행 1개·`platform=youtube` (c) S1-1(채널 행) 두 번 이상 같은 결과 (d) A(`queued/sending/failed/unknown` 0건) 재확인.
- **(갱신: `source_ref`는 정해졌다 -- 3-2절)** `width/height`가 비어 있으면 DB로는 16:9를 증명 못 하므로(수입 검증은 값이 있을 때만 2% 오차로 비율 확인) 파일을 받아 `ffprobe`로 재야 하고, 이는 다운로드라 먼저 승인을 받는다.

## 3-2. ⑩ 진행 (2026-10-10 저녁, UTC 22:25~23:xx) -- **A5부터 재개**

**진행한 것: 사전 확인 A1~A4 통과. 뉴스 수입은 미실행. 스위치·설정 변경 없음, 송출 0건.** (실행표 `reports/step10_runbook_2026-10-10.md`, 단계는 한 번에 하나씩 TK님이 Run하고 지수가 판독했다.)

| 단계 | 결과 | 근거 |
|---|---|---|
| A1 라이브 버전 | **통과** `sha:"175855f"`, `dirty:false`, `builtAt 2026-10-07T22:51:53Z` | `www.oxxovo.ai/api/version` 직접. 크론 틱 22:35~22:50Z 네 개 전부 `stage:"no_open_dba"`, `processed:0`, `notified:0`, `returnedNotified:0`, `warnings:[]`, 배포 `dpl_9BZw...` 하나(지수가 `vercel logs`로 직접 읽음) |
| A2 어드민 스위치 줄 | **통과** `Master Open · Entertainment Closed · Daily Closed` | TK님 화면. 목록 `No matching content.`(probe- 숨김). 경고 한 줄 `Retry settings are missing ...`는 **정상**(재시도 키를 일부러 두지 않음, ⑩은 재시도 0회) |
| A3 설정 조회 | **통과** 9행 | `social_dispatch_enabled=true`만, `news/entertainment_dispatch_enabled`·`news/entertainment/competition_publication_enabled`·`watch_as_home` 전부 `false`, `content_dispatch_per_tick=10`, `content_dispatch_max_bytes_default=104857600`, `content_youtube_visibility` 행 없음(A7 결정) |
| A4 채널 키 | **통과** 4행 | `postiz_channel_*` 키 길이 24/21/16/22, 값 25자, 공백 없음, `updated_at 2026-06-10 19:22:38`. **오늘 앞서의 S1-1과 값이 완전히 같다** -- 연달아 두 번이 아니라 앞선 S1-1을 두 번째 관측으로 쳤다(C3에서 스위치 열기 직전에 한 번 더 돌린다) |
| A5 대기 행 0건 | **결과 대기 (여기서 재개)** | 블록은 실행표 A5. 통과 기준: `queued/sending/failed/unknown` 모두 0 |
| A6 이후 | 미진행 | 실행표 A6 -> B(수입은 뉴스 제니가, 즉시 [Hold]) -> C -> D ... |

**시험 건 고정값 (뉴스 쪽 수신, 2026-10-10):**
- `source_ref` = `step10-news-20261010`, `source_version` = 1, `kind` news, `form` short, `language` ko, `rights_status` cleared, `ai_generated` true.
- **`allowed_platforms` = `["youtube"]`** (하나만).
- 영상 `main_16x9` 9,008,217바이트, 1920x1080, `duration_sec` 31.02, mp4 `sha256` `b6266d6c1abb38394fb863ca58a4aaf75ce290e8b658cf75b562f90ea0d550e6`.
- **썸네일은 이번 시험에서 제외한다**(TK님 결정). 뉴스가 보낸 썸네일 값(`sha256 8e07e146...`, 172,346바이트)은 쓰지 않는다. **규격 파일(6절 예시·2절 표)과 실행표 B3(에셋 2행 기대)에는 아직 썸네일이 선택 항목으로 남아 있다 -- 썸네일 없는 수입이면 B3은 `main_16x9` 1행이 정상이다.** 두 파일을 썸네일 제외 기준으로 정리하는 것은 남은 일.
- `upstream_approval_id` `6b3f4543-1adf-49ff-8504-6d23f2c81868`, `upstream_approved_by` TK, `upstream_approved_at` `2026-10-10T22:25:33.053Z`, `title` `10월 2일 옥소보 에이아이 데일리`(19자; 어드민에서 `[시험] 2026-10-10 `을 붙이면 35자, YouTube 2~100자 안).
- **뉴스 키 확인 HTTP 200** (키 값은 어디에도 기록하지 않았다).
- 값 검증 결과: 형식·길이·허용값 전부 규격에 맞음(`ai_generated`는 JSON boolean이어야 하고 재시도 시 `upstream_approved_at`·`upstream_approval_id`는 처음 값 그대로 재사용). 뉴스 수입 가능 판정.

**규격 파일이 아직 세종(오피스 PC)에 안 넘어갔다.**
- 파일: `C:\Users\Tom\oxxovo\reports\import_spec_news_2026-10-10.md` (Tom PC, 존재 확인됨, 26,306바이트). TK님이 메모장으로 연 곳에서 "The system cannot find the path specified"가 났고, 지수가 같은 경로를 열었을 때는 정상이었다. **원인은 확인하지 못했다**(다른 PC/원격에서 열었거나 경로 한 글자 오타 추정).
- **내일 첫 일: TK님이 Tom PC에서 이 파일을 열어 세종에게 전달한다.** 전달 뒤 세종 쪽 순서: 규격 대조 -> dry run -> 수입. 파일에는 키 값이 없다(40자 이상 영숫자는 sha256 두 줄뿐).
- 오늘 도중에 세종용 지시(HANDOFF.md 작성 요청)가 이 세션에 잘못 들어왔다. 이 레포에는 해당 파일·커밋이 없어서 **쓰지 않았고**, 본부가 무시하라고 확인했다.

## 3-3. 결정 기록 (본부·TK님, 2026-10-10)

1. **A7: `content_youtube_visibility` 행을 넣지 않는다.** 코드 기본값(없으면 `private`, 송출 직전 재확인마다 새로 읽음)에 의존하고, Studio에서 `Visibility = Private`를 눈으로 확인한다(실행표 E2가 검증). 근거: 시험 중 설정 쓰기를 하나라도 줄인다.
2. **엔터는 100MB를 넘어도 `allowed_platforms`를 유지하고 `skipped_oversize`로 남긴다**(송출 의도를 기록). 엔터 kind·form 수입 상한은 낮추지 않는다.
3. **`content_max_bytes_news_short` = 104857600 (뉴스 숏폼 100MB 상한)은 ⑩ 이후** 적용한다(준비된 SQL은 6절).
4. **⑩ 이후 필수 묶음(선택 아님):** ① 어드민 문구 `will fail at dispatch`를 skipped로 정정 ② 입고 메일에서 `skipped_*`가 있는 콘텐츠와 **송출 행이 0개인 콘텐츠**를 구분 표시 ③ 송출이 수입과 같은 상한 조회(kind_form -> form -> 기본값)를 쓰게 통일. 지수 의견: ①+②는 한 묶음(표시), ③은 송출 경로라 따로 커밋·배포. `needsAction`이 의도적 `skipped_oversize`를 영구 조치 대상으로 세는 부수 효과는 **본부 확인 대기**(4-2절).
5. **Phase 2:** 대용량 스트리밍·재개 업로드. 현재 코드는 R2에서 전체를 메모리로 받아 sha256을 업로드 전에 검증한 뒤 Postiz `/upload`에 multipart로 직접 올린다. Postiz의 `upload-from-url`은 업로드 전 해시 검증을 못 하게 되는 트레이드오프가 있다(4-2절).
6. **뉴스 키(`CONTENT_IMPORT_SECRET_NEWS_DESK`)는 ⑩ 후 교체한다.** 교체는 `vercel env rm`/`add` + 재배포(TK님)이고, 교체 전에는 뉴스가 쓰는 키가 이 한 값이라 시험 중에는 건드리지 않는다.

## 4. 수입·송출 상한 분석 (미결 5순위)

- **정정(내 10-07 EOD 5순위 기록이 틀렸다):** "100~500MB 영상이 수입은 되고 송출에서 `failed_terminal`이 된다"가 아니라, **수입 때 이미 해당 채널 행이 `skipped_oversize`로 저장된다**(`content_import`, `phase1_step3b_rpc_redefine_2026-10-05.sql:204-210`). 송출 틱은 그 행을 가져가지도 않는다. `content-dispatch.ts:357`의 `oversize_for_dispatch`는 이중 방어선이다. **라이브 함수가 이 버전인 것을 R1로 확인**(`content_import` 1행, 송출 상한 문자열·`skipped_oversize` 둘 다 포함).
- **R2(키 3행):** `content_dispatch_max_bytes_default=104857600`(10-06 04:34), `content_max_bytes_default=524288000`(10-05 18:05), `content_max_bytes_film_full=10737418240`(10-06 04:35). **kind·form별 송출 키가 없으므로** 송출이 `_default`만 읽고 수입이 `<kind>_<form>` -> `_<form>` -> `_default`로 찾는 불일치는 **지금은 터지지 않는다**(잠복).
- **실제 동작:** 수입 통과(콘텐츠 상태는 정상), 선택된 역할 에셋이 100MB 초과면 그 채널 행 `skipped_oversize`, 어드민에 `Skipped — too large`와 "needs action" 필터 포함. **전용 알림 메일이 없다** -- 입고 메일은 콘텐츠 상태로만 분류해(`content-notify.ts:75-76`) `scheduled`이면 "N new content item(s) scheduled"에 그대로 들어가고 실제로는 SNS에 안 나간다. `held`인 콘텐츠의 어드민 문구 `it will fail at dispatch`는 실제 동작(skipped)과 어긋난다. 공개 화면은 영향 없다. 복구는 사람이 올리고 `Mark dispatched`(URL 필수) 하거나 만든 쪽이 작은 파일로 새 버전을 보낸다.
- **조합:** kind 6, form 4, 허용 21(뉴스는 `short`만). **"SNS 대상인가"는 설계에 kind·form 규칙이 없고 수입 요청의 `allowed_platforms`로 정해진다.** 설계서가 조합을 언급한 곳은 news/short(수십 MB, `:731`), film/full(수 GB, `:716`·`:723`), drama/short(상한 키 예시, `:724`)뿐이고 나머지는 근거가 없다 -> 제니2 확인 필요. music/music_video는 보내는 것이 영상인지 음원인지 미정(`:1559` 미결 #4).
- **추천(본부 승인: A):** SNS 숏폼 조합만 수입 상한을 송출 상한(100MB)에 맞춘다. **지금 적용할 것은 `content_max_bytes_news_short=104857600` 하나, ⑩ 끝난 뒤.** 엔터의 `short`/`trailer` 키는 제니2 답을 받은 뒤. `long`/`full`은 사이트 전용이면 그대로 두되, 100MB 넘는 영상은 `allowed_platforms: []`로 보내는 합의가 필요하다(설정으로는 못 막는다). 수입 쪽에는 `_<form>` 단계가 없어 `trailer`는 kind마다 따로 키가 필요하다.
- **presign 위험:** 요청에 kind·form이 없어 RPC가 `content_max_bytes_*` 전체의 최댓값(10GB)보다 클 때만 거절한다(`step3:108-110`, 머리말 `:23-24`에 결정으로 기록). **설정만으로는 못 줄인다** -- 효과를 보려면 기본값과 모든 키를 100MB 이하로 해야 하고 그러면 `film_full`을 못 받는다. 지금은 만든 쪽이 100MB 초과를 올리기 전에 거절하는 합의로 막고, presign에 `kind`/`form` 선택 필드를 더하는 것은 ⑩ 이후 별도 작업.
- **후속 코드 작업 후보(승인 후, 지금 아님):** 송출이 수입과 같은 상한 조회를 쓰게 맞춤, 어드민 문구를 skipped로 정정, 입고 메일에서 `skipped_*`·송출 행 0개 콘텐츠를 구분 표시. -> 아래 4-2에서 필수로 바뀜.

### 4-2. 본부 결정 변경 (2026-10-10, 제니2 의견 수용)

- **엔터는 100MB를 넘어도 `allowed_platforms`를 유지하고 `skipped_oversize`로 남긴다**(송출 의도를 기록하기 위해). **엔터 kind·form 수입 상한은 낮추지 않는다.** 낮추는 것은 `news_short` 하나(100MB, ⑩ 이후, 6절 SQL).
- 그래서 위 후속 코드 작업 셋이 **선택이 아니라 필수**가 됐다(⑩ 이후): ① 어드민 문구 `will fail at dispatch` -> skipped로 정정 ② 입고 메일에서 `skipped_*`가 있는 콘텐츠를 따로 표시 ③ 송출이 수입과 같은 상한 조회를 쓰게 맞춤. **Phase 2에 대용량 스트리밍·재개 업로드를 추가한다.**
- **이 결정의 부수 효과(코드 읽기, 미해결):** `needsAction`이 `skipped_*`를 전부 센다(`lib/content-admin.ts:105`). 엔터의 큰 영상이 의도적으로 `skipped_oversize`로 남으면 **누가 `Mark dispatched`·반송·숨김을 할 때까지 "needs action" 필터에 영구히 남는다.** 의도 기록이 곧 할 일 목록이 되는 구조인지, 아니면 "기록만 하고 조치 대상은 아님"인지 정해야 한다(본부 확인 필요).
- **송출 행 `skipped_*`는 수입 시점에만 생긴다**(`content_import` RPC가 만들고, 이후 상태 전이는 `Mark dispatched`뿐 -- `step3b:260-263`). 그래서 알림 시점도 수입 시점과 같다.
- **대용량 업로드의 현재 코드(읽기):** `prepareMedia`(`lib/postiz.ts:177-207`)는 R2 URL에서 영상 **전체를 메모리로 내려받고**(`arrayBuffer`, 타임아웃 100초) sha256을 **업로드 전에** 검증한 뒤, `Blob`으로 한 번 더 복사해 Postiz `POST /upload`에 **multipart로 직접 올린다**(타임아웃 100초). 코드 주석은 "Postiz `/upload`는 multipart(file 필드)만 받는다(2026-06 실측)". 메모리에 파일이 최대 두 벌 올라간다. **Postiz 공개 문서(2026-10-10 조회)에는 `POST /upload-from-url`이 있다**: 본문 `{url}`, 공개 HTTPS·무인증·만료 서명 URL 금지, MIME 허용 목록, 사설 IP 차단(SSRF), 시간당 30회, **파일 크기 한도 문서 없음**, 영상 지원 여부는 MIME 목록에 달림, 느린 출처면 로컬로 받아 multipart를 쓰라고 안내. 진행 중 취소는 미지원. -> 영향: URL 방식은 **우리가 바이트를 쥐지 않으므로 업로드 전 sha256 검증(§5-3 4b)이 불가능**해진다. 이 방식이 우리 R2 영상에서 실제로 되는지는 외부 서비스에 쓰기가 필요한 실측이라 하지 않았다. Phase 2 스트리밍 설계의 입력으로 기록.

## 5. 설계-구현 격차 2건 (본부 판단 2026-10-10)

1. **presign 사전 거절(설계서 §3-2 `:313`):** 설계 의도는 맞고 구현이 전역 최댓값만 본다. 설계서 `:313` 옆에 "현재 구현은 전역 최댓값만 봄, 후속 작업 예정"을 표시했다. 기록할 한 줄: **그 줄은 같은 절의 요청 규격(`:300-309`)에 kind·form 필드가 없어서 쓰인 그대로는 구현할 수 없었다** -- 구현이 못 따라갔다기보다 규격 안의 불일치이고, step3 SQL 머리말에 의도된 결정으로 적혀 있다. 정확한 상한은 import가 판정하므로 오송출 경로는 아니고 업로드 낭비다.
2. **`allowed_platforms` 빈 배열(설계서 §3-3 `:358`):** 코드 동작(빈 배열 허용)이 정본. 사이트 전용 표현에 필요하다. 설계서를 코드에 맞췄다. **옛 설계가 막으려던 위험은 남는다:** 출처 버그로 `[]`이 나가면 400이 안 나고 "송출 대상 없음"으로 조용히 들어온다(필드 누락은 여전히 400). 어드민·입고 메일은 송출 행 0개를 구분해 보여 주지 않는다 -> 후속 후보.

## 6. 준비만 해 둔 SQL (미실행, ⑩ 끝난 뒤 TK님이 한 블록씩)

의도: 뉴스 숏폼 수입 상한을 송출 상한과 같게. 이 키가 생기면 `^content_max_bytes_` 최댓값(10GB)은 안 바뀌므로 presign에는 영향이 없다. 신규 키라 어드민 설정 화면으로는 만들 수 없다(기존 키만 수정). `description_ko`는 비워 둔다(nullable, 영문 설명만; 한글은 설정 화면에서 나중에).

INSERT:
```sql
insert into public.platform_config (key, value, value_type, description) values ('content_max_bytes_news_short', '104857600', 'int', 'Import ceiling in bytes for kind=news form=short. Set equal to the dispatch ceiling so an asset the dispatcher would skip is refused at import instead.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```
되읽기:
```sql
select key, value, value_type, length(key) as key_len, (value ~ '\s' or key ~ '\s') as has_ws, updated_at from public.platform_config where key = 'content_max_bytes_news_short';
```
기대값: INSERT는 1행을 돌려준다(`on conflict do nothing`이라 키가 이미 있으면 0행 -> 그건 이미 있다는 뜻이니 값을 되읽어 확인). 되읽기는 1행, `value=104857600`, `value_type=int`, `key_len=28`, `has_ws=false`. `audit` 트리거가 `platform_config_history`에 INSERT 행 1개를 남긴다. 되돌리기 블록은 요청하시면 별도 블록으로 만든다(같은 Run에 묶지 않는다).

## 7. 남은 것 · 하지 말 것

- **내일 첫 일:** TK님이 Tom PC에서 `reports/import_spec_news_2026-10-10.md`를 열어 세종에게 전달(3-2절). 그다음 **실행표 A5부터 재개**(A5 -> A6 -> 뉴스 수입 -> 즉시 [Hold] ...). `source_ref`는 정해졌다(`step10-news-20261010`). 썸네일 제외 기준으로 규격 파일·실행표 B3 정리.
- **TK님 확인:** `pg_trigger` 조회(2절)·S3-2/S2-2 통과 후 스위치 열기.
- **제니2 질문:** 엔터가 SNS로 보내려는 kind·form 조합, 그 크기, 사이트 전용을 `allowed_platforms: []`로 보낼 계획인지.
- **⑩ 이후:** `content_max_bytes_news_short` 적용(6절), presign `kind`/`form` 선택 필드, 송출·수입 상한 조회 일치, 어드민 문구·입고 메일 구분 표시.
- **여전히 대기:** 제니3(distribution 용어·어드민 문장·AI 표기), 약관(ElevenLabs·Hedra, 공개 전 필수), 반송 폴링 구현(뉴스·제니2), 공개 스위치 체크리스트 6개(10-07 EOD 8절).
- **하지 말 것:** 배포·스위치 변경·`CRON_SECRET` 교체·`railway variables` 목록 호출·서비스 키/`vercel env pull` 값 읽기. 시험 행으로 `rights-down`을 먼저 돌려 보지 않는다.

## 8. 오늘의 교훈 (성공만 적지 않는다)

1. **내 EOD 기록이 틀렸다:** "100~500MB는 송출에서 `failed_terminal`"(10-07 EOD 5순위)은 코드를 안 읽고 쓴 문장이었다. 실제는 수입 때 `skipped_oversize`. -> 기록에 쓰는 동작 서술은 **코드 한 곳을 읽고** 쓴다.
2. **본부의 읽기를 한 번 정정했다:** "값은 6/10 이후 안 바뀌었다"는 10-03 이전에 `updated_at`·history가 SQL 직접 수정을 못 잡았다는 사실과 충돌했다. 이력 0건은 **트리거가 붙은 시점 이후**에만 증거가 된다. -> 감사 기록의 0건은 "그 기록이 언제부터 있었나"와 함께 읽는다.
3. **"설계 의도는 맞고 구현이 못 따라갔다"는 부정확했다:** 설계가 같은 절에서 자기 요청 규격과 모순이었다. -> 격차를 기록할 때는 어느 쪽 문서가 틀렸는지 먼저 본다.
4. **로그 조회 창을 가정하지 않는다:** `vercel logs`가 약 4시간만 돌아와서 "배포 이후 전 구간 이상 없음"을 직접 확인하지 못했다. EOD 기록에 기대 것과 직접 본 것을 나눠 적었다.
5. **다른 작업공간의 지시가 이 세션에 들어올 수 있다:** HANDOFF.md 작성 요청이 세종(뉴스) 쪽 지시였다. 파일·커밋·경로가 이 레포에 없다는 것을 확인하고 **지어 쓰지 않고** 물었다. -> 지시가 가리키는 파일·커밋이 이 레포에 실제로 있는지 먼저 본다.
6. **한 단계씩 진행하면 "연달아 두 번" 같은 조건이 느슨해진다:** A4는 연속 두 번 대신 오늘 앞선 S1-1을 두 번째 관측으로 쳤다. 기록에 그렇게 적고, 스위치 열기 직전(C3)에 한 번 더 돌리기로 했다.

## 9. 커밋 안 된 파일 (4건, 커밋·푸시하지 않음)

```
 M reports/phase1_design_2026-10-04.md        (§3-2 :313 옆 표시, §3-3 :358 정정, 변경 이력 "최종 m")
?? reports/import_spec_news_2026-10-10.md     (뉴스 수입 규격, 키 값 없음)
?? reports/jisu_hq_2026-10-10_eod.md          (이 파일)
?? reports/step10_runbook_2026-10-10.md       (⑩ 당일 실행표)
```
HEAD `175855f` (= 라이브), 코드 변경 없음, 배포 없음.
