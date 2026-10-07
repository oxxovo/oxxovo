# EOD 2026-10-07 -- 지수(메인, 앱 레포) 작업 요약 + 인계

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문 그대로.
**읽는 순서: 0절 한 줄 요약 -> 8절 미결 -> 9절 인계 메모.** 어제 파일(`jisu_hq_2026-10-06_eod.md`)은 경과가 필요할 때만.
(시각은 UTC. 이 EOD 커밋 전 라이브는 `a41d4c5`.)

## 0. 한 줄 요약

**Phase 1의 ⑦ 어드민, ⑧ 알림, ⑨ 공개 페이지를 끝내고 전부 라이브에 올렸다.** 라이브는 `a41d4c5`.
남는 것: **⑩ 라이브 검증(정상 송출 포함)** 과 **공개 스위치 체크리스트(§7-3)**. 스위치는 어제와 같고(마스터만 열림), **실제 SNS 게시 0건, 공개 화면은 전부 404**다.
**"정상 송출", "알림 메일 실제 발송", "어드민 버튼", "공개 페이지 본문·308"은 라이브에서 한 번도 돌지 않았다**(5절).

## 1. 배포 3회

| # | SHA | 시각(UTC) | 내용 |
|---|---|---|---|
| 1 | `1f9488e` | 03:29 | ⑦ `/admin/contents` |
| 2 | `2ad63df` | 03:52 | ⑧ 수입 알림(held / scheduled) |
| 3 | `a41d4c5` | 04:14 | ⑨ `app/[section]`·`app/[section]/[id]`·`app/c/[id]` + 공개 판정 `probe-` 3중 + 쿼리 오류 로그 |

- 세 번 모두 `deploy:prod`(TK님). 자동 검증은 매번 "Could not verify automatically"(deployment URL이 HTML). `www.oxxovo.ai/api/version`으로 SHA를 직접 확인했다.
- 커밋: `3d37ff2`·`1f9488e`(⑦, 뒤쪽은 설계서 문단 복구), `40dced3`(i18n 미결), `2ad63df`, `a41d4c5`. 전체 테스트 734 -> 748 -> **757**, 전부 통과.

## 2. ⑦ 어드민 `/admin/contents` (라이브 확인됨: 목록·필터·배너)

- 목록 + DBA 토글 + 상태 필터 7종 + kind 보조 필터(`CONTENT_KINDS`에서), `probe-` 행은 **쿼리에서** 숨김(`?probe=1`로 보기).
- 버튼: `[정지]` `[반송]`(사유 필수) `[숨김]` `[되살리기]` `[정지로 복구]` `[송출]` `[나갔음]` `[다시 보냄]` + 메타 수정 + 송출 시각 수정.
- **`[송출]`은 게시 버튼이 아니다**: `held->scheduled` + `publish_at=now()`까지. 게시는 5분 크론이 같은 가드로 한다(본부가 처음 "바로 올리는 버튼"으로 읽어 정정함). 확인창 문구는 "송출 대기열에 넣습니다. 스위치가 열려 있으면 약 5분 안에 올라갑니다", 스위치가 닫혀 있으면 어느 스위치인지 같이 보인다(누르는 시점에 다시 읽음).
- **`probe-` 차단은 서버 액션**이 `source_ref`를 조회해 한다(`[송출]`·`[다시 보냄]`, 조회 실패도 거절). UI 비활성화는 이유 표시용("시험 행입니다. 송출할 수 없습니다").
- 감사 행위자: 모든 RPC에 `requireAdmin()`의 실제 어드민 id·이메일. 빈 이메일·uuid 아닌 id는 RPC 전에 거절.
- 코어는 `lib/content-admin-actions.ts`(클라이언트 주입, 테스트 17개), 순수 규칙은 `lib/content-admin.ts`.
- **알려진 한계(설계서 §8에 기록):** 수동 `[송출]`은 `content_publish_log`에 행을 남기지 않는다(`content_release`는 취소 행 되살릴 때만 로그). 행위자는 `contents_history`에서 본다 — **두 표를 대조해야 "사람이 눌렀는지 크론이 집어갔는지"를 가린다.** 본부 결정(옵션 B, SQL 변경 없음).
- 목록은 최근 200건, "조치 필요" 판정은 읽은 행에 대해 JS. `AdminShell` 그룹 필드는 안 넣음(항목만 추가).

## 3. ⑧ 알림 (라이브 확인됨: 첫 틱 `notified:0`, `warnings:[]`, info@ 메일 0통)

- 송출 틱 안(①b 다음, 스위치 판단 전)에서 돈다: 스위치가 닫혀 있어도 나간다. `lib/content-notify.ts`.
- 메일 두 통을 섞지 않는다: **held**(제목 `[OXXOVO] N content item(s) held -- action needed`, 첫 줄에 사유 집계, `?status=action` 링크) / **scheduled**(제목에 건수, 송출 시각 UTC, `?status=scheduled` 링크).
- **권리 대기**(`held` + rights≠cleared)는 held 메일의 별도 구획에 건수·목록만, 제목 건수엔 안 들어간다. 조치 필요 0건이면 메일 없이 `notified_at`만 써서 쌓이지 않게.
- `notified_at`은 메일이 **수락된 뒤에만** 서버가 직접 UPDATE(RPC 없음). 실패하면 안 써서 다음 틱에 재시도(⑥ `alerted_at`과 같은 규칙). 감사 트리거는 `notified_at`을 안 봐서 `contents_history`에 행이 안 생긴다.
- 제목·`source_ref`·`rights_reason`은 제어문자 제거 + 길이 제한 + HTML 이스케이프. 한 번에 100건 읽기, 넘으면 본문 안내. 문구는 `NOTICE_TEXT` 한곳(영문, 운영자 전용).
- **`probe-` 행 제외**(쿼리 + 빌더 이중). 시험 행 4개는 `notified_at`이 영구히 NULL — "알림 안 보냄"의 증거. 안 짚었으면 배포 직후 시험 행 알림이 info@로 갔다(본부가 짚음, 지수가 착수 전 질문으로 먼저 올림).
- **반송 알림은 미구현**(5절·8절). `contents`에 추적 칸이 없다.

## 4. ⑨ 공개 페이지 (라이브 확인됨: 404 전수. 본문·308은 미확인)

- `app/[section]`(목록, 최근 50건, 페이지네이션 없음), `app/[section]/[id]`(상세: 제목·설명·영상(`main_*`)·썸네일만), `app/c/[id]`(공개 통과 시만 308, 나머지는 이유 구분 없이 404). 전부 `force-dynamic`, `await params`, 허용 목록 밖은 `notFound()`.
- 목록은 slug가 있어도 그 DBA 공개 스위치가 닫혀 있으면 **404**(빈 목록 아님). 다른 섹션의 항목도 404.
- slug 모양이 아닌 경로(점·대문자·예약어·너무 긴 것)는 **DB 읽기 없이** 404, slug 모양이면 `platform_config` 1회 읽고 404. **캐시 없음**(의도: 긴급 정지가 느려지면 안 됨).
- **공개 판정 `probe-` 제외 3중**: `getPublicContent`·`listPublicContents` SQL `source_ref not ilike 'probe-%'` 둘 + `isPublicRow` 재검사(`source_ref` 없음/비문자열이면 닫힘). 재검사용으로만 `source_ref`를 읽고 projection엔 안 싣는다.
- **쿼리 오류 로그**: `[content-public] query error where=… code=… id=…`(코드와 id만). 모든 실패가 404라 "닫힘"과 "쿼리 깨짐"이 구분 안 되던 문제를 로그로만 구분.
- 공개 문구는 `lib/content-public-text.ts` 한곳, **중립 영문 임시값**. 확정은 §7-3 체크리스트.
- 컬럼 목록은 순수 모듈 `lib/content-public-columns.ts`로 분리(서버 코드와 점검 스크립트가 같은 문자열을 본다).
- **⑤ 테스트를 바꿨다**: `app/c` 폴더를 금지하던 단언이 설계서의 영구 주소와 충돌 -> "`app/c`에는 `[id]`만, 'c'는 계속 예약어".

## 5. 라이브 검증 결과와 한계

**읽기 전용 컬럼 점검 `scripts/probe-public-columns.mjs` — PASS 10/10**(TK님이 별도 터미널에서 실행, 서비스 롤 키는 환경변수로만, 결과는 본부 중계로 확인):
- 대조군(틀린 컬럼) 먼저: 거부됨 `code=42703` -> 이후 PASS를 믿을 수 있다.
- `PUBLIC_CONTENT_COLUMNS`·`PUBLIC_ASSET_COLUMNS` 거부 없음(`code=none`), 요청 컬럼 전부 키로 돌아옴. **PostgREST 컬럼 무음 거부 전례 재현 안 됨.**
- raw 키에만 `source_ref`·`status`·`rights_status`(재검사 전용), **projected 키에는 없음**. `script`·`sha256`·`caption`·`rights_reason`·`payload_hash` 없음. 에셋은 `main_16x9` 하나, 비공개 role 0건.
- 라이브에서 `probe-` SQL 제외 필터가 `probe-rt-cl-20261006060004`를 실제로 제거(SQL 층 증명).
- 스크립트는 레포에 커밋됨(`select`만, 쓰기 호출 0). **실행 로그를 레포에 저장하지 않았다**(출력 값은 본부 중계).

**⑨ 배포 후 404 전수(04:14 배포, www 직접):**
- 임의 경로 5개(`/zzz-nothing`, `/wp-admin`, `/wp-login.php`, `/.env`, `/Admin`), `/c/<uuid>` 전부(형식 맞는 것·`not-a-uuid`·영 uuid·`/c`), `/news`·`/daily`·`/movies` + uuid: **전부 404, 308 0건.**
- 기존 라우트 `/rules`·`/about`·`/robots.txt`·`/api/version` 200, `/admin/contents` 307. `[section]`에 가려진 것 없음. (`/watch`는 404 — 경쟁 공개 스위치가 닫혀 있어서이고 ⑨ 영향이 아님. ⑨ 전 응답은 따로 안 재 봤다.)
- **404 본문 동일성**: 처음 해시가 달라서 URL이 본문에 들어간 것을 찾았고, 경로·id를 치환해 다시 비교 -> `/c/<id>` 두 개 / `/news`·`/daily`·`/movies` 셋 / 임의 경로 셋이 각각 동일.
- 로그 `content-public` 오류 0건(스위치 읽기 쿼리 라이브 정상), 송출 크론 `no_open_dba` 변화 없음.

**아직 라이브에서 한 번도 안 돈 것(= 증명 안 된 것):**
- 정상 송출(Postiz 게시) — 어제부터 계속.
- ⑧ 알림 메일 실제 발송, `contents.notified_at` UPDATE 경로(실제 콘텐츠가 수입돼야 돈다).
- ⑦ 어드민 버튼(`[송출]` 등) 눌러 본 적 없음. 라이브에는 누를 일반 콘텐츠 행이 없고 시험 행은 건드리지 않는다.
- ⑨ 공개 페이지의 **응답 본문**과 `/c/<id>`의 **308 헤더**(스트리밍이면 meta 태그로 바뀔 수 있다 — Next.js 문서).
- **한계: 보류 항목 vs 미존재 항목의 404 본문을 직접 비교하지 못했다.** 시험 행 id를 몰라서였다(본부가 전달: `9946fb81-3ecb-40ee-b065-7c0fb1456818`). 두 경우는 같은 코드 경로로 `null`이 돼 같은 `notFound()`로 가지만 **측정한 것은 아니다.** ⑩에서 스위치를 켤 때 같이 본다(지금은 하지 않는다).

## 6. 사고·정정·교훈 (성공만 적지 않는다)

1. **지수의 오류 ① — `node -e` 안의 백틱.** ⑦ 설계서 문단을 `node -e`로 넣다가 셸이 백틱 안 식별자(`` `content_publish_log` `` 등)를 지웠고, 식별자가 빠진 문단이 `3d37ff2`로 **이미 푸시됐다.** 곧바로 편집 도구로 고쳐 `1f9488e`로 다시 올렸다. 앱 코드 영향 없음.
2. **지수의 오류 ② — `String.replace`의 `$'`.** ⑨ 테스트 패치를 `s.replace(a, b)`로 넣다가 교체 문자열 안의 `$'`가 특수 패턴(매치 뒤 문자열)으로 해석돼 파일이 깨졌다. 테스트가 바로 잡았고 `git checkout`으로 복원 후 함수 치환자(`() => b`)로 다시 적용. 커밋된 파일은 정상.
   - **교훈(어제 10-06 EOD의 같은 항목을 또 어겼다): 여러 줄 수정은 편집 도구로. 부득이하게 스크립트를 쓰면 함수 치환자(`replace(a, () => b)`)와 파일로 쓴 스크립트(`node -e` 금지).**
3. **본부 오독 정정(차이 1):** `[송출]`을 "눌러서 바로 SNS로 올리는 버튼"으로 읽은 것 — `content_release`는 `held->scheduled`까지고 게시는 크론이다. 설계서가 그렇게 돼 있었다. 확인창 문구가 이 때문에 "대기열에 넣습니다"가 됐다.
4. **설계서와 코드의 차이를 착수 전에 올렸다:** 조건 ②(수동 송출을 `content_publish_log`에 남김)는 RPC가 일부만 충족 -> 본부가 SQL을 안 고치는 쪽(옵션 B)으로 결정, 한계로 기록.
5. **"모든 실패가 404"의 함정:** ⑨ 공개 쿼리는 스위치가 닫히면 실행조차 안 되고, 쿼리가 깨져도 404라 둘이 구분되지 않는다. 그래서 오류 로그(코드·id만) + 읽기 전용 점검 스크립트로 컬럼을 라이브에서 먼저 확인했다.

### 가드 훼손 시험 누적 (일부러 망가뜨려 테스트가 빨개지는지 확인)
| 단계 | 건수 | 대상 |
|---|---|---|
| ⑦ | 5 | `[송출]` probe 차단 · 다시 보냄 probe 차단 · 미리확인 probe 차단 · 행위자 검증 · probe 판정 대소문자 |
| ⑧ | 8 | 쿼리 probe 제외 · 빌더 probe 이중 검사 · 메일 실패해도 `notified_at` 기록 · 권리 대기를 건수에 합산 · HTML 이스케이프 · 틱에서 알림 단계 · `notified_at IS NULL` 조건 · 링크 |
| ⑨ | 7 | 상세 SQL probe 제외 · 목록 SQL probe 제외 · 재검사 probe · projection `source_ref` 유출 · 오류 로그에 message · content 쿼리 로그 제거 · asset 쿼리 로그 제거 |
- 전부 빨개졌고 원복 후 통과. (⑨ 상세 SQL 제외를 빼도 "id로 조회" 테스트는 재검사가 막아 통과한다 -> "층별로 따로 검증하는" 테스트가 잡는다. 층마다 독립 검증이 필요한 이유.)

### 대조군을 먼저 세운다 (원칙 재확인)
- 점검 스크립트의 **control 항목**: 일부러 틀린 컬럼이 거부되지 않으면 스크립트가 "거부를 알아볼 수 없다"며 멈춘다. 라이브 결과 `code=42703`으로 대조군이 먼저 섰다. 대조군 없는 PASS는 "항상 PASS하는 스크립트"와 구분이 안 된다.
- 단위 테스트도 같은 쌍으로 짠다(예: probe 행이 안 나오는 테스트 옆에 같은 행에서 `probe-` 접두만 뗀 행은 나오는 대조군).

## 7. 영구 잔존 시험 행 (변화 없음)

`probe-trg-20261005`(hidden) · `probe-rpc-20261005`(returned) · `probe-rt-20261006054214`(held, blocked) · `probe-rt-cl-20261006060004`(**hidden**, cleared, 배포 posted `probe-stub`, **hidden 유지 필수**; 본부 전달 id `9946fb81-3ecb-40ee-b065-7c0fb1456818`).
이제 **어드민 목록(쿼리)·알림(쿼리+빌더)·공개 판정(SQL 둘+재검사)·`[송출]`/`[다시 보냄]`(서버 액션)** 에서 모두 `probe-` 접두로 막혀 있다.

## 8. 미결 (다음 세션)

**구현·검증**
- **⑩ 라이브 검증 + 정상 송출** — Postiz 테스트 채널이 있으면 거기에, 없으면 실제 OXXOVO 채널에 1건을 올려야 한다. **어느 쪽인지는 TK님 결정**(본부가 묻는 중). 그때 같이: 알림 메일 실제 발송·`notified_at` UPDATE, 어드민 `[송출]` 흐름(`contents_history`와 `publish_log` 대조), 항목 예산 120초·메모리 100MB 실측.
- **반송 알림 — 할 일 맨 위.** 반송은 만든 쪽이 모르면 아무 일도 안 일어난다. `contents`에 추적 칸(`returned_notified_at` 등)을 추가하는 **SQL이 필요하다**(TK님 Run, 함수/컬럼 되읽기 필수). 그 전까지 담당자는 어드민 `[반송]` 목록에서 본다.
- `/admin/contents` **영어 전환**(admin-i18n 미적용, 한국어 고정 — TK님 지적).
- 배포 검증 canonical 전환(`scripts/deploy-prod.mjs`): 매번 "Could not verify automatically". 어제부터 이월.

**공개 스위치를 켜기 전 체크리스트(설계서 §7-3, 6개) — 안 끝나면 켜지 않는다**
- [ ] AI 생성물 표기(제니3, 플랫폼별)
- [ ] ElevenLabs·Hedra 약관 확인(뉴스·엔터가 확인, 그때까지 뉴스는 전부 `held`)
- [ ] 공개 화면 문구 확정(`lib/content-public-text.ts` 임시값 교체)
- [ ] `content_path_<kind>` slug 결정(TK님) + 예약어 충돌 없음
- [ ] 라이브 컬럼 확인 — **`probe-public-columns.mjs` PASS 10/10(오늘 완료)**
- [ ] 스위치를 켠 직후 응답 본문 직접 확인(`script`·`sha256`·`source_ref`·`caption`·`rights_reason` 없음) + `/c/<id>` **308 헤더** + **보류 항목 vs 미존재 항목 404 본문 직접 비교**

**TK님 결정·확인**
- `content_max_bytes_<kind>_<form>` 미설정: 영상 kind별 수입 상한을 송출 상한(100MB) 이하로 둘지. 수동 `[송출]`로 100MB 초과를 누르면 송출에서 `failed_terminal`이 된다(확인창에 경고는 뜬다).
- `content_dispatch_max_attempts`·`content_dispatch_backoff_base_minutes`·`content_dispatch_item_budget_seconds` 값 미정(없으면 재시도 0회 -> 어드민에 노란 안내, 항목 예산 120초).
- 공개 경로 이름(slug), `restricted -> blocked` 허용 방향 확인.

**위험·이월(어제와 같음)**
- R2 공개 주소 노출(권리 `blocked` 파일도 key를 알면 열림, 의도), `CRON_SECRET` 교체 금지, 제니2(`upstream_approval_id`, `music` kind), eslint 기준선, `ALERT STATE%` 제외 미증명, `updated_at` 트리거 없는 C분류 5개 테이블, 설계서 후속(본부 반영).

## 9. 인계 메모

**현재 상태**
- 레포 `main` = 라이브 = **`a41d4c5`**(이 EOD 커밋 전). 작업 트리 clean.
- 플래그(변화 없음): `social_dispatch_enabled=true`, `news_dispatch_enabled=false`, `entertainment_dispatch_enabled=false`, `news_publication_enabled=false`, `entertainment_publication_enabled=false`, `competition_publication_enabled=false`. **실제 SNS 게시 0건, 공개 화면 전부 404. 건드리지 말 것.**
- 크론 6개 그대로. 틱 로그에 `notified` 필드가 추가됐다: `[content-dispatch] {"stage":...,"notified":N,...}`. 정상은 `no_open_dba`·`notified:0`·`warnings:[]`.
- 도구: `scripts/probe-contents.mjs`(수입 경로), `scripts/probe-public-columns.mjs`(읽기 전용 공개 컬럼, 서비스 롤 키는 환경변수로만 — TK님이 `Read-Host -AsSecureString`으로 입력, 키는 Supabase 대시보드 Project Settings -> API Keys -> `service_role` Reveal).

**재개 순서**
1. 이 파일 8절 확인. 본부가 TK님의 ⑩ 결정(테스트 채널 vs 실제 채널 1건)을 가져온다.
2. **반송 알림 SQL**(칸 추가)을 ⑩과 별개로 먼저 올린다 — 할 일 맨 위.
3. ⑩ 라이브 검증. 스위치를 켜는 순서는 §7-3 체크리스트가 끝난 뒤.

**작업 규칙(재확인)**
- SQL은 채팅 본문으로, 블록 하나에 쿼리 하나, 고유 태그 + `/* */`, 되돌리기는 별도. TK님이 Run, 지수는 Run 안 함. 함수·컬럼을 만들면 되읽는다(`prosrc` 고유 토큰 둘 이상 / `aclexplode`), 0행 증명은 `count(*)`.
- 배포는 TK님 `! npm run deploy:prod`. 배포 후 `www.oxxovo.ai/api/version`으로 SHA 직접 확인.
- **여러 줄 수정은 편집 도구로. 셸 치환·`node -e`·`String.replace($')` 금지(오늘 2회 어김).** 부득이하면 파일로 쓴 스크립트 + 함수 치환자.
- 가드를 만들면 일부러 망가뜨려 테스트가 빨개지는지 확인. 시험은 대조군과 한 쌍. 결과 보고에는 대상 서버·`source_ref`·id를 같이.
- 사용자向 문안은 내 소관이 아니다(제니3). 운영자 내부 알림만 내가 쓴다.
- 안 맞으면 근거를 대고 반대할 것(TK 상시 지시). 실패·반례도 기록할 것.
- 시크릿·`vercel env pull` 값은 읽지 않는다. `railway variables` 목록 호출 금지.
