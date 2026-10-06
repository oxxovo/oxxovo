# EOD 2026-10-06 -- 지수(메인, 앱 레포) 작업 요약 + 인계

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문 그대로.
**읽는 순서: 0절 한 줄 요약 -> 9절 미결 -> 10절 인계 메모.** 어제 파일(`jisu_hq_2026-10-05_eod.md`, `..._part2.md`)은 경과가 필요할 때만.
(참고: 날짜 경계. 아래 시각은 UTC. 10-05 part2 파일 9~10절에 같은 날 중간 기록이 있다.)

## 0. 한 줄 요약

**Phase 1의 ③b -> ⑥을 끝냈다.** DB 쪽(RPC 재정의·미완 5경로), ④ 엔드포인트(R2 PUT 포함 전 경로), ⑤ 공개 판정, ⑥ 송출 코드와 가드가 라이브에 있고, 완료 조건 ④(스위치 끄면 송출 안 됨)·⑤(promo 503)의 **라이브 음성 시험을 통과**했다. **라이브는 `7a919b6`.**
남는 것: **"정상 송출은 라이브에서 한 번도 안 돌았다"**(§5-7대로, Postiz 테스트 채널 없음). 스위치는 전부 닫혀 있고 실제 게시는 0건이다.

## 1. 배포 3회

| # | SHA | 시각(UTC) | 내용 |
|---|---|---|---|
| 1 | `9962684` | 05:34 | ④ 엔드포인트 5개 + ⑤ 공개 판정(호출처 없음). 401·405 확인 |
| 2 | `58d2b2f` | 06:23 | ⑥ 송출 틱·`postiz.ts` 분리·promo 가드 두 겹·`sendAdminAlert(to?)`·크론 `/api/cron/content-dispatch`(`*/5`) |
| 3 | `7a919b6` | 06:36 | 틱마다 요약 한 줄 로그 |

- 세 번 모두 `deploy:prod`(TK님). 자동 검증은 매번 "Could not verify automatically"(deployment URL이 HTML을 줌). `www.oxxovo.ai/api/version`으로 SHA를 직접 확인했다.
- 이 배포들로 `e9957ca`(robots 주석)도 라이브에 들어갔다(`7a919b6`의 조상, `git merge-base`로 확인). 어제 이월 미결에서 해소.

## 2. 환경·R2

- R2 버킷 `oxxovo-imports`(공개 주소 `https://pub-e3c934bf3d8b47e1862eed1c83ae7530.r2.dev`) 생성, Vercel production 환경변수 7개(`R2_ACCOUNT_ID`·`R2_BUCKET`·`R2_PUBLIC_BASE`·`R2_ACCESS_KEY_ID`·`R2_SECRET_ACCESS_KEY`·`CONTENT_IMPORT_SECRET_NEWS_DESK`·`CONTENT_IMPORT_SECRET_PRODUCTION_OS`) 입력. `vercel env ls production`으로 이름 7개·총 26개 확인. **값은 읽지 않았다.** Preview에는 없음.
- `CRON_SECRET`은 sensitive라 TK님도 값을 모른다. **교체하지 않기로 결정**(크론 6개가 같은 값, 교체 시 재배포 전까지 401 가능, 다른 레포·Railway 사용 여부 미확인).

## 3. ③b -- RPC 재정의와 미완 5경로

- RPC 재정의(`content_import` 빈 채널 허용·업로드 상한, `dist_mark_posted`) + 키 2개: 10-05에 라이브, R-1~13 통과(part2 파일).
- **미완 5경로 종결(10-06, 라이브 DB, TK님 Run):** `content_hide`·`content_unhide`·`content_release` 성공·`dist_claim` 점유 성공·`dist_mark('sent')`. 시험 행 `probe-rt-cl-20261006060004`(cleared, kind `cf`, `allowed_platforms:['youtube']`). **"빈 배열이거나 아직 송출 전이면 Postiz에 닿을 수 없다"는 점을 이용**해 스텁 없이 풀었다(크론 배포 전, DBA 스위치 닫힘, 점유 가능 행이 이 행뿐임을 먼저 확인). 끝에 `content_hide`로 **hidden**까지 닫았다(안 닫으면 공개 스위치가 켜질 때 사이트에 뜬다). 최종 hidden/posted/`probe-stub`, 감사 `db:%` 행위자 0행.
- **`external_id=probe-stub`은 실제 게시가 아니다.** 이 `posted`를 송출 증거로 읽지 말 것.

## 4. ④ 런타임 (미결 #10 종결)

시험 스크립트 `scripts/probe-contents.mjs`(시크릿은 환경변수로만, 출력·저장 안 함)로 전 경로 통과:
인증 없음 401 · 잘못된 시크릿 401 · presign 200 · **서명된 PUT이 R2에서 200(설계 미결 #10 종결)** · import `created`(서버가 R2에서 존재·크기·sha256을 직접 확인) · 같은 내용 재전송 `idempotent` · 같은 버전 다른 내용 `409 payload_conflict` · rights-down `lowered`(+배포 행 `cancelled`) / 올리기 400 `rights_up_denied` · status 200·없는 ref 404 · returns 200.
시험 행 `probe-rt-20261006054214`(restricted -> blocked, held), `probe-rt-cl-20261006060004`. presign 재사용도 확인(미소비 presign은 `import`만 다시 부르면 소비됨, `presign` 재실행 금지).

## 5. ⑤ 공개 판정 (확인된 것)

판정 4조건(`scheduled`+`cleared`+`publish_at` 도달+해당 DBA의 `*_publication_enabled`), 스위치 fail-closed(행 없음·오류·`true` 아닌 값=닫힘), 대회 스위치와 무관, SQL 필터+이중 검사, 공개 에셋 `main_*`·`thumbnail`만, `script`·hash·source·`rights_reason`·caption 제외, slug 예약어(`c` 포함)·`app/` 최상위 폴더 전수 테스트, 같은 slug 두 kind면 둘 다 닫힘, `/c/<id>`는 공개 통과+slug 설정 시만. 테스트 26개.
**한계:** 단위 테스트가 가짜 DB를 쓴다. 호출처가 없어 라이브 DB에서 돌려 본 적 없다(⑨에서 PostgREST 컬럼 라이브 첫 확인).

## 6. ⑥ 송출 코드와 가드

- `lib/content-dispatch.ts`: sweep -> 알림 -> 스위치 조기 종료 -> **한 행씩 점유** -> 준비(sha256·크기 검증) -> **신선한 재확인** -> 게시(항상 `type:'now'`). 재확인에서 스위치·콘텐츠 상태가 바뀌었으면 `stopped_by_switch`로 `queued` 복귀. 송출 전 실패는 `failed`(재시도 가능), 게시 후 불확실(5xx·타임아웃·ID 없는 2xx)은 `unknown`, 4xx는 `failed`.
- `lib/postiz.ts`: `prepareMedia`/`publishPrepared` 분리. `scheduledAt`은 타입과 런타임 양쪽에서 거부. 해시 불일치는 업로드 요청 전에 중단.
- **promo 가드 두 겹:** `publishPromoVideo` 맨 앞에서 마스터 스위치를 읽고(닫힘 -> 라우트 503 `dispatch_disabled`, 읽기 실패 -> `dispatch_unreadable`), 준비~게시 사이에 한 번 더 읽는다. **설계서 순서는 위험했다**(승인 게이트가 먼저라 503을 못 보고, 승인된 영상으로 시험하면 가드 결함 시 실제 계정에 올라감). 본부 승인으로 맨 앞 검사 추가.
- `sendAdminAlert(subject, html, to?)`: 설계서 k에 "반영됨"이라 적혀 있었으나 **코드에는 없었다**(설계서에 적힌 것과 코드에 들어간 것이 다를 수 있다). 이번에 추가.
- 알림: 송출 틱이 `unknown`/`failed` 배포 행을 메일로 알리고 **메일이 나간 뒤에만** `alerted_at`을 쓴다.
- 크론 `/api/cron/content-dispatch` `*/5`, `maxDuration=300`(라우트 리터럴 == 라이브러리 상수, 테스트로 고정). 틱마다 `[content-dispatch] {"stage":...}` 한 줄 로그(id·문구·시크릿 없음).
- 키: `content_dispatch_per_tick`(10)·`content_dispatch_max_bytes_default`(104857600)는 **없으면 송출 0건+일일 알림**. 재시도 키(`..._max_attempts`·`..._backoff_base_minutes`)는 없으면 **재시도 0회**. 코드 기본값은 항목당 예산 120초뿐.
- 테스트 35개 추가(전체 716+ 통과).

### 라이브 음성 시험 (완료 조건 ④⑤)
- **① 크론 닫힘:** 라이브 첫 틱 로그 `"stage":"no_open_dba","processed":0,"swept":0,"alerted":0,"stopped":null,"warnings":[]`. 인증·라우트·스위치 읽기 배선 정상. 블록 A(알림 대상 0행)·B(`sending` 0행)와 일치, 알림 메일 0통.
- **② promo 503:** `social_dispatch_enabled`를 `false`(길이 5)로 닫고 어드민 세션에서 존재하지 않는 id로 호출 -> **503 `dispatch_disabled`**, 복원(`true`, 길이 4) 후 같은 호출 -> **404 `not_found`**. **대조군이 서로 다르다**는 것이 503이 스위치 때문임을 증명한다. 복원 값 `true`/4 되읽기 확인.
- **정상 송출은 라이브 미검증**(§5-7). 설계서에 "송출 가드 라이브 미검증"으로 남긴다.

## 7. 사고·정정·교훈 (성공만 적지 않는다)

1. **본부 중계 오독(오보 "import 201인데 DB에 없다").** 05:42 시험 화면(id `00e4acbb`...)을 06:00 cleared 시험 것으로 잘못 읽어 블록에 넣어 `hide`/`unhide` 실패가 났다. 지수가 서버 로그(06:00:04 presign만 있고 import 요청 없음)와 `content_presigns`(`consumed_at` NULL)로 반증했다. **코드·DB 결함 아님.**
   - **교훈: 시험 스크립트는 대상 서버·`source_ref`·content id를 매 단계 출력해야 한다.** 안 찍으면 사람이 어느 시험 결과인지 구분 못 한다. 고침(`e54b9f4`, `7edfe51`): 모든 단계 머리글, import 성공 시 `★★★ content id`, 모드는 `source_ref` 접두사에서 결정.
2. **`CREATE OR REPLACE ... Success`는 반영이 아니다**(10-05 A2): 되읽기는 `prosrc`의 고유 토큰으로.
3. **"0행" 증명은 `count(*)`로.** 0행 응답은 "없다"와 "조회가 안 됐다"를 구분 못 한다.
4. **대조군 없는 시험은 못 믿는다.** 오늘 503/404가 그 증거. 거절만 보면 "항상 거절하는 코드"와 구분이 안 된다.
5. **가드마다 일부러 망가뜨려 테스트가 빨개지는지 본다**(본부 지시). 재확인 게이트 제거 -> 2개 실패, `scheduledAt` 거부 제거 -> 1개 실패, 메모리 상한 키 검사 제거 -> 1개 실패. (예전 "검증이 PASS를 내면서 새고 있었다"를 막는 방법.)
6. **지수의 오류:** 블록 11 컬럼명을 `changed_by`(uuid)로 틀렸다(`changed_by_email`). 에러로 드러남. 감시 조건을 허술하게 걸어 내 401 점검 호출을 "첫 틱"으로 착각할 뻔했다(로그 응답코드로 걸러 정정). `node -e` 안 템플릿 리터럴이 셸에 먹혀 코드가 깨진 일 3번(빌드·테스트가 즉시 잡음) -> **여러 줄 코드 수정은 셸 치환 말고 편집 도구로.**
7. **설계서 누락(본부가 고침):** §5-3 순서에 "점유 후 `content_assets.bytes`를 메모리 상한과 비교"가 빠져 있었다(§5-4에만). 코드에는 들어 있음.
8. **설계서에 적은 것과 코드에 들어간 것은 다를 수 있다**(`sendAdminAlert(to?)`). 10-05 `proacl` NULL, A2 재정의와 같은 종류.

## 8. 영구 잔존 시험 행 (삭제 불가, 의도됨)

| `source_ref` | 상태 | 비고 |
|---|---|---|
| `probe-trg-20261005` | hidden, blocked | 10-05 |
| `probe-rpc-20261005` | returned, blocked | 10-05 |
| `probe-rt-20261006054214` | held, blocked | 10-06 ④ 시험 |
| `probe-rt-cl-20261006060004` | **hidden**, cleared, 배포 posted(`probe-stub`) | 10-06 ③b 미완 경로. **hidden 유지 필수** |

R2 객체(`imports/production_os/probe-rt-*`)도 남아 있다. **어드민 목록(⑦)에서 `probe-` 접두사를 기본 숨김**으로 만들 것.

## 9. 미결 (다음 세션)

**구현**
- **⑦ 어드민 `/admin/contents`** (`probe-` 숨김 필터 포함, 송출 설정 없음 배너, 수동 `[송출]`/`[나갔음]`/`[다시 보냄]`).
- **⑧ 알림:** 콘텐츠 `held`(`notified_at IS NULL`) 알림은 ⑧로 이월(⑥은 배포 행 `unknown`/`failed`만).
- **⑨ 공개 페이지 `app/[section]` + `/c/<id>` 308.** 착수 전 `node_modules/next/dist/docs/`에서 동적 세그먼트 규칙 읽기. **처음 라이브로 돌릴 때 PostgREST 모르는 컬럼 무음 거부([[feedback_postgrest_unknown_column_silent]])부터 확인.** 가짜 DB 테스트의 한계를 설계서 미결에 적는다.
- ⑩ 라이브 실행 + 되읽기, **정상 송출 라이브 시험**(Postiz 테스트 채널 필요, 없으면 사람이 책임지는 1건).

**TK님 결정·확인**
- **`content_max_bytes_<kind>_<form>` 미설정:** 송출 상한(100MB)보다 큰 영상(100~500MB)이 수입은 통과하고 송출에서 `failed_terminal`이 된다. 영상 kind별 수입 상한을 송출 상한 이하로 둘지.
- `content_dispatch_max_attempts`·`content_dispatch_backoff_base_minutes`·`content_dispatch_item_budget_seconds`: 값 미정(없으면 재시도 0회, 항목 예산 120초). **항목 예산 120초와 메모리 상한 100MB는 측정한 적 없는 추정**이고 함수 메모리 한도도 미확인 -> 첫 실제 송출에서 재서 조정.
- 공개 경로 이름(slug), `restricted -> blocked` 허용 방향 확인(설계서 미결).

**위험·이월**
- **R2 공개 주소 노출:** 권리 `blocked` 콘텐츠의 파일도 key를 아는 사람은 직접 열 수 있다(설계서 §11에 이미 기록, 의도된 동작). 커스텀 도메인 전환 때 같이 본다.
- 배포 검증 canonical 전환(`scripts/deploy-prod.mjs`): deployment URL이 HTML을 줘서 매번 자동 검증 실패. canonical(`www.oxxovo.ai/api/version`)을 보게 고치되 alias 전파 재시도·"보호/HTML 응답" 구분 출력. 본부 승인, 시점은 지수 판단.
- ElevenLabs·Hedra 약관 상업 이용 조건(뉴스·엔터가 확인, 그때까지 뉴스는 전부 `held`).
- AI 생성물 표기 의무(플랫폼별) (제니3), 송출 전 필수.
- 제니2: `upstream_approval_id` 제공 여부, `music` kind가 넘기는 것.
- eslint 기준선 71건, `description_ko` 분기 라이브 미검증, `ALERT STATE%` 제외 미증명, `updated_at` 트리거 없는 C분류 5개 테이블.
- 설계서 후속(본부 반영): §6-8 감사에 INSERT 포함 / TRUNCATE 거부 / 불변 컬럼 `id`·`created_at` / `trg_*` 접두사 / §6-5b `set_config` 선행 / 에러 코드->HTTP 매핑 / §5-3 bytes 재확인 / promo 가드 순서 / 이름 불일치(`return_content`·`update_content_meta`·§5-5 참조).

## 10. 인계 메모

**현재 상태**
- 레포 `main` = 라이브 = **`7a919b6`**(이 EOD 커밋 전). 작업 트리 clean.
- 플래그: `social_dispatch_enabled=true`, `news_dispatch_enabled=false`, `entertainment_dispatch_enabled=false`, `news_publication_enabled=false`, `entertainment_publication_enabled=false`, `competition_publication_enabled=false`. **실제 SNS 게시 0건.** 건드리지 말 것.
- 크론 6개(email 15분·season 매시·partner-stats 주간·broadcast 15분·promo-schedule 15분·**content-dispatch 5분**). `vercel logs --environment production --no-branch -x`에서 `[content-dispatch]` 줄로 매 틱의 `stage`를 읽는다(`master_closed`/`no_open_dba`/`config`/`unreadable`/`ran`).
- 시험 도구: `scripts/probe-contents.mjs`(환경변수 `CONTENT_IMPORT_SECRET_PRODUCTION_OS`, 선택 `PROBE_RIGHTS=cleared`·`PROBE_BASE`).

**재개 순서**
1. 이 파일 9절 확인. 본부가 TK님 결정(`content_max_bytes_<kind>_<form>`)을 가져온다.
2. ⑦ 어드민 -> ⑧ 알림 -> ⑨ 공개 페이지 -> ⑩ 검증. **⑨ 전에 Next.js 동적 라우트 문서를 읽는다.**
3. 정상 송출 라이브 시험은 Postiz 테스트 채널이 생기거나 TK님이 1건을 책임질 때.

**작업 규칙(재확인)**
- SQL은 채팅 본문으로, 블록 하나에 쿼리 하나, 고유 태그 + `/* */` 주석, 압축 금지, 한 번에 3~4블록. 되돌리기는 별도. TK님이 Run한다. 지수는 Run하지 않는다.
- 함수를 만들거나 바꾸면 `prosrc` 고유 토큰 둘 이상 + `aclexplode`로 되읽는다. 0행 증명은 `count(*)`.
- 배포·DB 변경은 지시 전까지 하지 않는다. 배포는 TK님이 `! npm run deploy:prod`.
- 가드를 만들면 일부러 망가뜨려 테스트가 빨개지는지 확인한다. 시험은 대조군과 한 쌍.
- 시험 스크립트·결과 보고에는 대상 서버, `source_ref`, id를 반드시 같이 적는다.
- 안 맞다고 보이면 근거를 대고 반대할 것(TK 상시 지시). 실패·반례도 기록할 것.
- 시크릿·`vercel env pull` 값은 읽지 않는다. `railway variables` 목록 호출 금지.
