# EOD 2026-10-07 -- 지수(메인, 앱 레포) 작업 요약 + 인계

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문 그대로.
**읽는 순서: 0절 한 줄 요약 -> 8절 미결 -> 9절 인계 메모.** 어제 파일(`jisu_hq_2026-10-06_eod.md`)은 경과가 필요할 때만.
(시각은 UTC. 이 EOD 커밋 전 라이브는 `9ab016e`. **오전분(⑦⑧⑨)은 1~5절, 오후분(⑩ 준비·문구 정리·Phase 2 기록)은 6절 이하와 6-2절.**)

## 0. 한 줄 요약

**Phase 1의 ⑦ 어드민, ⑧ 알림, ⑨ 공개 페이지를 끝내고 전부 라이브에 올렸다.** 오후에 ⑩ 준비(YouTube `title`·`type` 코드)와 구 명칭 문구 정리를 끝내 역시 라이브다. 라이브는 `9ab016e`.
**⑩ 정상 송출은 영상이 올 때까지 대기다**(뉴스·엔터에 제작 지시가 나갔다, TK님 결정). 코드와 절차(설계서 §5-8)는 준비가 끝났다. 스위치는 어제와 같고(마스터만 열림), **실제 SNS 게시 0건, 공개 화면은 전부 404**다.
**"정상 송출", "알림 메일 실제 발송", "어드민 버튼", "공개 페이지 본문·308"은 라이브에서 한 번도 돌지 않았다**(5절).

## 1. 배포 (오전 3회 + 오후 3회)

| # | SHA | 시각(UTC) | 내용 |
|---|---|---|---|
| 1 | `1f9488e` | 03:29 | ⑦ `/admin/contents` |
| 2 | `2ad63df` | 03:52 | ⑧ 수입 알림(held / scheduled) |
| 3 | `a41d4c5` | 04:14 | ⑨ `app/[section]`·`app/[section]/[id]`·`app/c/[id]` + 공개 판정 `probe-` 3중 + 쿼리 오류 로그 |
| 4 | `6d37e93` | 04:59 | **⑩ 준비**: YouTube `title`·`type`(코드 `6d4d731` 포함, 이 SHA는 그 뒤 EOD 문서 커밋). 같은 SHA를 05:00:25에 한 번 더 배포(코드 변화 없음) |
| 5 | `9ab016e` | 05:49 | **구 명칭 문구 정리** + 검사 테스트 |

- 모두 `deploy:prod`(TK님). 자동 검증은 매번 "Could not verify automatically"(deployment URL이 HTML). `www.oxxovo.ai/api/version`으로 SHA를 직접 확인했다.
- 커밋: `3d37ff2`·`1f9488e`(⑦, 뒤쪽은 설계서 문단 복구), `40dced3`(i18n 미결), `2ad63df`, `a41d4c5`, `6d4d731`·`6d37e93`(⑩ 준비·EOD), `bf64c82`(용어 대응표), `dad9bc5`(Phase 2 기록), `fa4ca9f`(승인 단위·CF 세 축), `9ab016e`(문구 정리). 전체 테스트 734 -> 748 -> 757 -> 767 -> **770**, 전부 통과.

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

6. **지수의 오류 ③ (오후) — 감시 판정 오판.** 배포 후 첫 틱을 기다리는 감시를 "`vercel logs`의 크론 로그 **줄 수**가 늘면 새 틱"으로 짰다. 그런데 `vercel logs`는 기본 조회 한도가 100건이라 요청이 쌓이면 창이 밀려 줄 수가 안 늘어 보였고, 15분 동안 "틱이 안 돈다"로 오탐했다. `--since`와 `--json` 타임스탬프로 다시 보니 크론은 5분마다 정확히 돌고 있었다. **사고는 없었고 시간만 썼다.** 교훈: 감시는 줄 수가 아니라 **시각**으로 판정한다.
7. **지수의 오류 ④ (오후) — CRLF 때문에 검사기가 오탐.** 문구 검사 테스트(`lib/user-facing-names.test.ts`)가 처음에 `NicknameCard.tsx`의 **주석 한 줄**을 문구로 잡았다. 파일이 CRLF라서 줄 끝 `\r`이 주석 제거 정규식(`.*$`)을 막은 것이다. 줄 구분을 `\r?\n`으로 고치고 CRLF 대조군을 추가했다. 검사 도구가 거짓 양성을 내면 신뢰를 잃는다.
8. **지수의 오류 ⑤ (오후) — 바꿀 목록이 불완전했다.** 본부에 올린 목록에 `lib/chatbot-kb.ts:178`을 한 번만 적었는데 그 줄에는 구 명칭이 **두 번** 있었다. 줄 단위 수작업 목록만으로는 놓친다 — **검사 테스트가 남은 한 곳을 잡았다.** 앞서 "뷰"라고 적었던 `watch_scores_public`이 실제로는 `seasons`의 컬럼이었던 것(W1이 바로잡음)도 같은 종류의 정정이다.
9. **지수의 오류 ⑥ (오후) — 양성 대조군 없는 확인.** 문구 정리 배포 후 `curl /rules`로 새 문구를 찾아 0건이 나왔다. **이 0건을 "반영 안 됨"으로도 "반영됨"으로도 읽지 않았다**: `/rules`는 클라이언트 렌더라 서버 HTML에 본문이 아예 없었다(`Twist`·`Format` 같은 원래 문구도 0건 — 이것이 대조군이다). 그래서 배포된 **JS 번들 19개를 직접 내려받아** 확인했다(새 문구 2건 / 옛 문구 0건, 문장 4쌍 전부).
   - **교훈: "0건은 증거가 아니다. 대조군이 먼저다."** 아무것도 못 찾았을 때는 "그 도구가 찾을 수 있는 대상이었나"를 먼저 증명한다(양성 대조군: 원래 있어야 하는 것이 나오는지).
   - ※ `String.replace`의 `$'`(오류 ②)는 오전 항목과 같은 사건이다. 오후에는 같은 이유로 **함수 치환자와 편집 도구**만 썼다.

### 가드 훼손 시험 누적 (일부러 망가뜨려 테스트가 빨개지는지 확인)
| 단계 | 건수 | 대상 |
|---|---|---|
| ⑦ | 5 | `[송출]` probe 차단 · 다시 보냄 probe 차단 · 미리확인 probe 차단 · 행위자 검증 · probe 판정 대소문자 |
| ⑧ | 8 | 쿼리 probe 제외 · 빌더 probe 이중 검사 · 메일 실패해도 `notified_at` 기록 · 권리 대기를 건수에 합산 · HTML 이스케이프 · 틱에서 알림 단계 · `notified_at IS NULL` 조건 · 링크 |
| ⑨ | 7 | 상세 SQL probe 제외 · 목록 SQL probe 제외 · 재검사 probe · projection `source_ref` 유출 · 오류 로그에 message · content 쿼리 로그 제거 · asset 쿼리 로그 제거 |
| ⑩ 준비 | 10 | 기본값을 public으로 · 틱 시작 값 사용 · 재확인 읽기에서 키 제거(**테스트 결함 포착**) · 모든 채널에 YouTube 설정 · 가시성 재파싱 제거 · 제목 꺾쇠 정리 제거 · 100자 제한 제거 · 최소 2자 검사 제거 · 사전 제목 검사 제거 · YouTube 행에 설정 안 넘김 |
| 문구 정리 | 7 | 규칙 페이지·챗봇·한글 붙은 형태에 구 명칭 재삽입 3 · 검사기 한글 붙은 경우 못 잡게 · 검사기 CRLF 되돌림 · 허용 목록 이메일 항목 삭제 · 허용 목록 낡은 항목 |
| 반송 알림 | 8 | 쿼리 probe 제외 · 빌더 probe 제외 · 메일 실패해도 기록 · `returned_notified_at < returned_at` 제거 · 이스케이프 · 틱 단계 제거 · 단계 크래시 재던짐(**테스트 결함 포착**) · 기록값 `now()` |
| 배포 검증 | 8 | SHA 비교 끄기 · 옛 SHA 통과 처리 · `builtAt` 제거 · HTML 구분 제거 · 인증 벽 진단 제거 · 재시도 제거 · 미검증이어도 성공 종료 · 옛 배포 URL 검증 복원 |
| 어드민 영어 전환 | 16 | 로캘 ko-KR 되돌림 · PT 접미사 · UTC · 12시간제 · dispatch/publish 혼용 2 · 상태 매핑 누락 2 · 용어 표류 3 · 한글 재삽입 2 · 입력을 브라우저 시간대로 읽음 · 화면이 formatPT 우회(**테스트 결함 포착**) · 화면이 `new Date(v)` |
| 합계 | **69** | ⑦ 5 + ⑧ 8 + ⑨ 7 + ⑩ 준비 10 + 문구 7 + 반송 알림 8 + 배포 검증 8 + 어드민 영어 16 |
- 전부 빨개졌고 원복 후 통과. (⑨ 상세 SQL 제외를 빼도 "id로 조회" 테스트는 재검사가 막아 통과한다 -> "층별로 따로 검증하는" 테스트가 잡는다. 층마다 독립 검증이 필요한 이유.)

### 대조군을 먼저 세운다 (원칙 재확인)
- 점검 스크립트의 **control 항목**: 일부러 틀린 컬럼이 거부되지 않으면 스크립트가 "거부를 알아볼 수 없다"며 멈춘다. 라이브 결과 `code=42703`으로 대조군이 먼저 섰다. 대조군 없는 PASS는 "항상 PASS하는 스크립트"와 구분이 안 된다.
- 단위 테스트도 같은 쌍으로 짠다(예: probe 행이 안 나오는 테스트 옆에 같은 행에서 `probe-` 접두만 뗀 행은 나오는 대조군).

### ★ 가드 훼손이 "테스트 자체의 결함"을 잡은 사례 (⑩ 준비, 6d4d731)

- **무슨 일:** ⑩을 위해 YouTube `title`·`type`을 콘텐츠 송출 경로에 넣고 가드 훼손 시험 10건을 했다. **3번 훼손("재확인 읽기에서 `content_youtube_visibility` 키를 뺀다")이 빨개지지 않았다**(`fail 0`).
- **원인:** 테스트 하네스의 `readConfig`가 요청한 키와 무관하게 설정 **전체**를 돌려줬다. 실제 리더(`adminConfigReader`)는 요청한 키**만** 준다.
- **왜 위험했나:** 실제에서는 키를 빼먹으면 값이 늘 없음 -> `private`으로 떨어진다. **겉으로는 안전한 쪽으로 틀려서 아무도 눈치채지 못한다.** 그런데 공개 범위를 설정으로 바꿀 방법이 영영 없어진다(설정해도 안 읽힘). 10-03의 "검증이 PASS를 내면서 새고 있었다"와 같은 종류다.
- **고친 것:** 하네스가 실제 리더처럼 **요청한 키만** 돌려주게 했다. 같은 훼손이 이제 2개 테스트를 빨갛게 만든다(10건 전부 포착, 원복 후 44 통과).
- **교훈:** 가드를 망가뜨려 보지 않았으면 이 결함은 영영 못 찾았다. 가짜(fake)가 실제보다 **너그러우면** 그 가짜 위의 PASS는 증거가 아니다. 새 가짜를 만들 때는 실제 인터페이스의 **제약**(요청한 키만, 에러 코드, 필터 의미)까지 흉내 낸다.

### ⑩ 준비 현황 (정상 송출 시험 1건, 실제 OXXOVO YouTube 채널)

- 코드 `6d4d731` **배포됨**(`6d37e93`, 04:59 UTC): 콘텐츠 송출 경로에만 YouTube `title`(100 코드포인트, 이모지 안 쪼갬, 2자 미만이면 지어내지 않고 `failed_terminal`·다운로드 전)과 `type`(`content_youtube_visibility`, 없거나 이상하면 `private`, 재확인 때 새로 읽음). 홍보영상 경로 불변(테스트로 고정). **YouTube 설정이 빠져 있었던 것**(Postiz 문서는 `title`·`type`을 필수로 요구, 기존 코드는 안 보냄)을 코드와 문서를 대조해 찾았다 — 그냥 열었으면 4xx로 실패하고 원인을 한참 찾았을 것이다.
- 계획과 절차는 설계서 **§5-8**: 지우는 절차(Studio 직접, Postiz 삭제는 선택), 순서(`per_tick=1` 안전장치, 스위치 하나만, 즉시 닫고 복원), 중단, 실패 처리. 시험 제목 `[시험] 2026-10-07 ...`은 TK님이 어드민 `메타 수정`으로 넣는다(코드에 접두어를 넣지 않는다 — 실제 콘텐츠 오염 방지, `contents_history`에 감사가 남음).
- **시작 전 읽기 확인(TK님 결과):** A `queued/sending/failed/unknown 0 / total 8`(전부 posted·cancelled인 시험 행) 통과 · C `content_dispatch_per_tick=10`(끝나고 복원할 값), `content_youtube_visibility` 행 없음 통과 · **B `postiz_channel_youtube`는 첫 조회 `n=0`, 재조회 `n=1, len=25`로 같은 쿼리가 다른 답을 냈고 원인은 미확정**(본부는 오조회로 정정). 콘텐츠 송출과 홍보영상은 같은 `postiz_channel_<channel>` 키를 읽는다(코드 확인).
- **한계(라이브 첫 확인):** Postiz가 `type:private`을 받아 YouTube에 실제로 비공개로 올리는지 · 응답의 `postId`가 Postiz 삭제에 쓰는 id와 같은지.
- **상태 변화(오후 결정):** 뉴스는 완성본이 9:16 세로뿐이고(YouTube는 `main_16x9`만 허용 — 아래 설계 결함 항목), 엔터 C1 AURELIS는 제작 직전이라 MP4가 없다. 홍보영상을 끌어다 쓰는 안과 더미 2048바이트는 **쓰지 않기로** 했다(source가 둘뿐이라 깨끗하지 않음, 제니2 의견). **뉴스·엔터에 영상 제작 지시가 나갔고, 완성본이 오면 재개한다.**
- **미해결 설계 질문(본부 확인 대기): YouTube에 세로(9:16) 영상이 못 나간다.** `lib/content-kinds.ts`의 `PREFERRED_ROLES.youtube = ['main_16x9']`이고 테스트로 고정돼 있다. 뉴스는 9:16뿐이라 `skipped_no_asset`이 된다. 본부는 설계 결함으로 본다(Shorts는 9:16). 고치는 곳은 한 곳(규칙 한 줄 + 테스트 한 줄)이지만 **아직 고치지 않았다**(⑩ 전에 코드를 바꾸지 않기로 한 결정 때문). 엔터 영상이 16:9로 오면 이 문제와 무관하게 ⑩은 진행된다. 엔터 완성본에 16:9가 있는지 제니2에게 확인이 필요하다.

## 6-2. 오후 작업: 구 명칭 정리 · 용어 대응표 · Phase 2 기록 · 승인 단위 · CF 구분

### 구 명칭 문구 정리 (`9ab016e`, 배포·라이브 확인됨)
- **결정(TK님 2026-10-07):** 구 명칭(WATCH)은 없어지고 공개 화면은 **OXXOVO**라고 부른다. 사람이 보는 곳만 바꾸고 DB·환경변수·내부 이름·경로(`/watch*`)·링크는 안 바꾼다. 경로는 홈 설계와 같이 **Phase 2**로 미뤘다.
- **바꾼 것(이름으로 쓴 곳만, 줄 단위):** 사용자 화면 12곳(`apply`·`faq`·`rules`·프로필 닉네임·상단 로고 `aria-label`·랭킹 "← OXXOVO"), 어드민 메뉴·화면(`Watch as Home` -> `Home mode`, `Watch 홈 전환` -> `홈 화면 전환`, 토글·설명), 푸터 안내, 챗봇 지식 5곳. 죽은 `badge_watch` 키 삭제(사용처 0곳).
- **안 바꾼 것:** 영어 동사(`Watch the video →`, `Watch my entry`, `▶ Watch your film`, `Watch Later` …), 이름 아닌 단어(`scoring-lease-watch`, `watching`, `watchable`, `fs.watch`), 랜딩 라벨 `nav_watch: 'Watch'`(본부 결정 B, 그대로), 이메일 템플릿 이름 문구 4곳(제니3 확정 후 2차).
- **가드:** `lib/user-facing-names.test.ts` — `app/`·`lib/`에서 주석을 제거한 뒤 구 명칭이 이름으로 남은 곳을 찾는다(CRLF·한글 붙은 형태 대응, 동사·이메일 대기 항목은 허용 목록에 이름으로 적음, 낡은 허용 항목은 실패). 7개 훼손 시험 전부 빨개짐.
- **라이브 확인:** SHA `9ab016e`, 공개 경로 404 유지, 크론 `no_open_dba`·전 필드 0(05:50:14 UTC가 배포 후 첫 틱, 타임스탬프로 확인). 문구는 **배포된 JS 번들 19개를 직접 내려받아** 새 문구 2건 / 옛 문구 0건(문장 4쌍).

### 용어 대응표 (설계서 §7-4, `bf64c82`)
- **내부 식별자 접두 `watch_` = OXXOVO 영상 공개 면. 이름은 바꾸지 않는다**(본부 결정). 라이브 DB 카탈로그 조회 W1(46행)로 확정: 테이블 7(`watch_comments`·`watch_comment_reports`·`watch_follows`·`watch_likes`·`watch_video_reports`·`watch_views`·`watch_votes`), `genesis_applications` 컬럼 5(`watch_hidden`·`_at`·`_reason`·`watch_hold`·`watch_hold_released_at`), `seasons`(와 `season0_dates_backup_20260927`) 컬럼(`watch_fixture_visible`·`watch_scores_public`), 함수 1(`enforce_watch_vote_limit`), 트리거 1(`watch_votes_limit_trg`), 설정 키 1(`watch_as_home`), 인덱스 약 30, 정책 0.
- **정정:** 내가 앞서 `watch_scores_public`을 "뷰"라고 보고했는데 **`seasons`의 컬럼**이었다(코드 `lib/watch-scores.ts`도 컬럼으로 읽는다).
- 이름을 안 바꾸는 근거 5개: PostgREST 조용한 거부 -> "조용한 데이터 소실", 함수 본문 안의 컬럼명(`CREATE OR REPLACE` Success 함정 전례), 마이그→코드 순서 어긋남, 되돌리기 비용, 과거 기록 왜곡. 운영자 혼란은 용어 대응표 한 줄로 푼다.

### 홈 동작의 사실과 Phase 2 기록 (설계서 §12-2·§12-3, `dad9bc5`·`fa4ca9f`)
- **홈(루트)의 사실(코드):** `watch_as_home` **AND** 대회 공개 스위치(`competition_publication_enabled`)가 모두 참일 때만 루트가 대회 갤러리(`ArenaWatch`)이고, 아니면 랜딩이다. 대회 스위치가 닫힌 채 `watch_as_home`을 켜도 눈에 보이는 변화는 없다(랜딩으로 떨어짐). 루트는 `searchParams`를 받지 않는다. **`watch_as_home`의 현재 DB 값은 조회하지 못했다**(조회 블록 X1 결과 미수신).
- **홈 설계는 Phase 2로 미뤘다**(본부·제니2): Phase 1을 다시 뜯지 않고 ⑩까지 먼저 끝낸다. 기록만: 사업축 7개 + Studio(독립 DBA 아님), 두 층 분리(전체 Navigation 7축 / 영상 Discovery 탭 `[전체][대회][뉴스][영화][드라마][CF][음악]`), 음악 탭은 UI에서만 합침, 배너 규격, 빈 항목 Coming Soon, 대회와 콘텐츠는 같은 홈 다른 DB, 카드 출처 라벨.
- **Phase 1 DB 확장성: 막는 것 없음**(`contents`에 nullable 컬럼·새 표를 더하는 방식, 불변·감사 트리거와 쿼리가 컬럼을 명시하므로 새 컬럼이 기존 경로를 안 깨고 공개 응답에 안 샌다). 수입 요청 검증·해시·RPC 확장은 Phase 2 일.
- **승인 단위 확정(제니2):** 승인은 프로젝트/시즌 전체가 아니라 **특정 subject + 특정 version**의 증거다. Episode 1 v1 = UUID A, Episode 2 v1 = B, Episode 2 v2 = 새 UUID D. 영화도 한 편 = 독립 release subject. **`UNIQUE (source, upstream_approval_id)` 그대로 유지**(시즌 단위였다면 지금이 가장 쌌다 — 바꿀 것이 없음을 확인한 것).
- **CF 구분 세 축(제니2 안, Phase 2, 구현 안 함):** `kind`는 안 나눈다(둘 다 `cf`). `production_origin`(`oxxovo_original` | `client_production`), `client_id`(누구의 의뢰인가). **`client_id`를 "외부 수주 여부" 판정값으로 쓰지 않는다.** 라벨: `oxxovo_original` -> OXXOVO ORIGINAL, `client_production` + `cf` -> COMMERCIAL.

## 6-3. 저녁 작업: 반송 알림 (SQL -> 코드 -> 배포 `4fb8824`)

- **SQL(TK님 Run, 본부 동석):** B1 사전 확인 -> B2 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS returned_notified_at timestamptz` -> B3 `pg_attribute` 되읽기 -> B4 기존 행 `count(*)` -> **B6 컬럼 ACL 확인(`aclexplode`, 본부 추가 승인).** B6 결과: table 단위 16행(`postgres`·`service_role` 각 8권한), column 단위 0행, `anon`·`authenticated`·`PUBLIC` 없음. "테이블 GRANT가 새 컬럼에도 적용된다"는 **믿지 않고 확인**했다.
- **코드:** `lib/content-notify.ts`(판정 `isReturnPending`·`planReturnNotice`·`runReturnNotices`·읽기·기록), 틱 1d 단계(별도 `try`), 크론 로그 `returnedNotified`. 판정은 트리거·RPC 없이 비교. 설계서 "반송 알림 구현" 절에 근거 기록.
- **승인된 설계와 다르게 한 둘(본부 승인):** ① 기록값을 `now()`가 아니라 **읽을 때 본 `returned_at`**으로 — `now()`면 읽기와 기록 사이에 들어온 재반송이 알리지 않은 채 "완료"로 판정돼 조용히 사라진다. ② PostgREST가 두 컬럼을 비교하지 못해 **읽기 두 번(미통지 오래된 순 / 최근 반송 순)을 합치고 코드에서 같은 판정을 한 번 더** 건다(⑤ 공개 판정과 같은 방식).
- **검증:** `npm test` 778 통과, `tsc`·eslint 통과. **가드 훼손 8건 전부 빨개짐**(원복 후 통과): 쿼리 probe 제외 · 빌더 probe 제외 · 메일 실패해도 기록 · `returned_notified_at < returned_at` 조건 제거(3건 빨강) · 이스케이프 · 틱에서 단계 제거 · 단계 크래시를 틱 밖으로 던짐 · 기록값을 `now()`로. 누적 합계 **37 -> 45**.
- **배포·라이브 확인:** `4fb8824`, `www.oxxovo.ai/api/version`이 `sha:"4fb8824"`, `dirty:false`. 배포 스크립트의 자동 검증은 이번에도 "Could not verify automatically"(배포 고유 URL이 HTML을 줌, 4순위 이월 건)라 `www`로 직접 확인했다.
- **첫 틱(18:45:14 UTC, 새 배포 `dpl_FTmf39yb`):** `{"stage":"no_open_dba","processed":0,"swept":0,"alerted":0,"notified":0,"returnedNotified":0,"stopped":null,"warnings":[]}` — **기대값과 일치**(`returnedNotified:0`이므로 probe- 제외가 새지 않았고, `return_notify_list_failed` 없음 = 컬럼을 PostgREST가 읽는다). 대조군: 직전 틱(18:40, 옛 배포 `dpl_GidEmeP`)은 `returnedNotified` 필드가 없다 -> 로그 도구가 두 배포를 구분해 읽고 있다. 이 틱은 반송 행이 `probe-rpc-20261005` 하나뿐이라 **"메일을 안 보낸 것"의 확인이지 "보내는 것"의 확인이 아니다.** info@ 메일 0통은 TK님 확인 대기.
- **한계:** ① 메일 수락 후 기록 실패 -> 다음 틱에 같은 메일 한 번 더(⑧ `notified_at`과 같은 한계). ② **실제 메일 경로는 라이브 미검증, ⑩의 `[반송]`이 처음 돌린다.** ③ 이미 통지된 행이 재반송된 뒤 **한 틱 사이에 100건 넘게** 다른 반송이 들어오면 놓칠 수 있다(재반송은 `returned_at`이 최신이라 읽기 B에 잡힘).

### ★ 가드 훼손 시험이 초록이면 가드가 아니라 시험을 의심한다 (반송 알림, 훼손 7번)

- **무슨 일:** 훼손 7번("틱에서 반송 단계가 크래시해도 밖으로 안 던진다" 보호를 `throw e`로 바꿈)이 **처음에 초록이었다**(`STAYED GREEN`). 가드가 안 걸린 것이 아니라 **시험이 그 가드에 닿지 못했다.**
- **원인:** 시험이 `listReturned`를 동기로 던지게 했는데, 그 경우는 러너 **안쪽** `try`가 먼저 잡는다. 틱 단계의 `catch`는 한 번도 실행되지 않았다. 훼손한 줄이 **도달 불가능한 코드**였다.
- **고친 것:** `list()`가 `null`로 resolve하게 했다. 러너의 `try`(list만 감쌈)를 지나 플래너에서 던지므로 **틱의 `catch`만이** 막을 수 있다. 같은 훼손이 빨개졌다.
- **교훈:** 어제 가짜 `readConfig`가 요청 키를 안 걸러 훼손 3번이 초록이었던 것과 **같은 종류**다. 훼손이 초록이면 "가드가 필요 없다"도 "가드가 이미 있다"도 아니고 **먼저 시험을 의심한다.** 훼손한 줄이 그 시험 입력으로 **실제로 실행되는가**를 확인한다. 초록 훼손을 그냥 넘기면 안전망이 없는 상태가 안전해 보인다.

## 6-4. 밤 작업: 배포 검증 canonical 전환 (`04f84e3`, 코드만 — 배포 안 함)

- **무엇을:** 배포 후 검증을 인증 벽에 막힌 배포 URL이 아니라 `www.oxxovo.ai/api/version`으로 옮겼다(`scripts/deploy-verify.mjs`). 옛 SHA는 **재시도 대상이지 통과가 아니다**(12회 x 5초). 통과는 `sha`와 `builtAt`이 **둘 다** 맞을 때만(같은 커밋을 다시 배포했을 때 옛 빌드의 거짓 통과 방지 — 10-07에 같은 SHA를 두 번 배포한 적이 있다). 끝까지 안 맞으면 `exit 1`(예전엔 경고만 나오고 성공으로 끝났다 — 의도한 변경). 재배포 없이 재확인: `npm run deploy:verify -- <sha> [builtAt]`.
- **간격 실측:** `vercel api`로 프로덕션 배포 15개(10-02~10-07)의 `ready`와 `aliasAssigned`를 읽어 alias가 `ready` 후 **0.25~0.45초**에 붙는 것을 확인했다. **이 값은 alias 부여 시각이지 엣지 전파가 아니다.** 전파는 배포 기록으로 잴 수 없어서 재시도 창을 넉넉히 잡았다. 거짓 실패는 명령 한 번으로 해소되지만 거짓 통과는 틀린 믿음을 남긴다.
- **가드 훼손 8건 전부 빨개짐**(SHA 비교 끄기 · 옛 SHA 통과 처리 · `builtAt` 제거 · HTML 구분 제거 · 인증 벽 진단 제거 · 재시도 제거 · 미검증이어도 성공 종료 · 옛 배포 URL 검증 복원). 누적 합계 **45 -> 53**.

### ★ 단위 시험 통과는 실행 통과가 아니다 (`exit 127`)

- **무슨 일:** 검증 스크립트를 만들어 단위 시험 10개가 전부 통과했다. 그런데 **라이브 `www`에 읽기 전용으로 실제 실행해 보니 검증은 성공(`✓ live version`)했는데 종료 코드가 `127`**이었다(`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c`).
- **원인:** Windows에서 fetch 소켓이 닫히는 중에 `process.exit()`를 부르면 Node가 libuv 단언 오류로 죽는다. **통과한 검증이 실패로 보고되는 거짓 실패.** 단위 시험은 `process.exit`를 안 거치는 함수만 시험했다.
- **구조의 아이러니:** 거짓 경고를 고치러 가서 만든 검증이 또 거짓을 내고 있었다. 이 스크립트가 ⑩과 공개 스위치 전환의 배포에 쓰이므로, 못 고치고 갔다면 **믿을 수 없는 검증이 하나 더 늘었을 것이다.**
- **고친 것:** `process.exit()` 대신 `process.exitCode`를 설정해 이벤트 루프가 정리되게 했다(`deploy-verify.mjs`, `deploy-prod.mjs` 둘 다). 통과 3회 `exit 0`, 틀린 SHA `exit 1`, 인자 없음 `exit 2`를 실행으로 확인했다.
- **교훈:** **단위 시험 통과는 실행 통과가 아니다.** 종료 코드·표준 출력·프로세스 경계는 함수 시험이 지나가지 않는 곳이다. 스크립트·CLI를 만들면 **실제로 한 번 실행해서 종료 코드까지** 본다(읽기 전용으로 할 수 있으면 라이브로도). 훼손 시험이 "가드가 걸리는가"를 보듯, 이것은 "프로그램이 실제로 끝까지 가는가"를 본다.

### 한계 (적어 둔다)

- **`deploy-prod.mjs`의 검증 연결 시험이 약하다.** 실행하면 진짜 배포가 되므로 실행할 수 없어서 **소스 텍스트를 읽는 시험**(`verifyLive` 호출·`exitCode = 1`·옛 검사 부재)으로 고정했다. 줄을 지웠는지만 잡고 **동작하는지는 증명하지 못한다.** 실제 동작 확인은 **TK님 다음 배포**다.
- 이 검증이 라이브 배포와 함께 도는 것은 다음 배포가 처음이다. 거짓 실패가 나면 **재배포하지 말고** 메시지에 찍힌 `deploy:verify` 명령을 쓴다.
- 엣지 전파 지연은 실측하지 못했다(위).

## 6-5. 밤 작업 2: `/admin/contents` 영어 전환 (제니3 용어 확정, 코드 완료·미배포)

- **무엇을:** 화면 문구 전부를 `lib/content-admin-text.ts` 한곳(영어 한 벌)으로 모으고 확정 용어표대로 바꿨다. 화면(`ContentsView.tsx`)·서버 액션 오류(`content-admin-actions.ts`)·Dispatch 확인창(`releaseConfirmLines`)·`remainingLabel`·URL 검사 메시지가 같은 곳을 쓴다. 설계서 §8-0에 **대괄호 표기 <-> 화면 영어 대응표**와 시간 규칙을 한 번 적었다(`[송출]`=Dispatch · `[반송]`=Return · `[정지]`=Hold ...).
- **구조 판단(본부가 맡긴 부분): `admin-i18n`에 넣지 않고 별도 파일.** 서버가 만드는 메시지는 브라우저의 한/영 토글을 모른다. 그래서 **이 화면은 한/영 토글을 따르지 않는다**(메뉴 이름만 `admin-i18n`에 이미 한/영이 있다). 토글을 따르게 하려면 서버 메시지를 코드+인자로 바꾸고 클라이언트가 조립해야 해서 범위가 커진다 — 본부가 "화면은 영어"로 못 박았고 쓰는 사람이 TK님 한 분이라 영어 고정으로 갔다.
- **시간:** `formatPT` = `en-US` · PT 하나 · 24시간제 · 항상 `PT`(`Oct 7, 2026, 14:30 PT`, 자정 `00:00`). **입력도 PT**: `송출 시각 수정`의 `datetime-local` 값을 브라우저 시간대가 아니라 PT로 읽는다(`ptWallToIso`) — 화면은 PT인데 입력만 브라우저 시간대면 PT가 아닌 브라우저에서 어긋난다(본부 지시 범위를 넓힌 부분, 반대하시면 말씀).
- **크론 로그와 EOD는 UTC 그대로.** 화면만 PT. 혼동 방지로 설계서 §8-0에 적었다.
- **어색한 것 하나:** 확정표에 없는 문장(확인창·안내·배너)의 영어는 제가 썼다. 용어는 확정표만 썼지만 **문장 자체는 제니3 확인을 받은 적이 없다.** 운영자 내부 화면이라 제 소관으로 봤으나, 문장 확인이 필요하면 `lib/content-admin-text.ts` 한 파일만 보면 된다.
- **검증:** 전체 `npm test` 802 통과, `tsc`·eslint 통과. **가드 훼손 16건 전부 빨개짐**(원복 후 초록): 로캘 `ko-KR` 되돌림 · `PT` 접미사 제거 · PT 대신 UTC · 12시간제 · dispatch/publish 혼용(제목·버튼) · 상태 매핑 누락(송출 `skipped_oversize`·콘텐츠 `hidden`) · 용어 표류(Canceled/Hold/Daily) · 화면·액션에 한글 재삽입 · `datetime-local`을 브라우저 시간대로 읽음 · 화면이 `formatPT`를 우회 · 화면이 `new Date(v)`로 입력 읽음. 누적 합계 **53 -> 69**.
- **상태 매핑 완전성:** 시험이 `reports/phase1_step1_tables_2026-10-05.sql`의 `contents_status_chk`와 `content_distributions_status_chk`를 읽어 라벨 키와 **정확히 같은지** 비교한다(정규식이 실제로 찾는지 대조군 포함). 새 DB 상태가 생기면 라벨이 없다고 빨개진다.

### ★ 이번 훼손 시험에서 나온 실패 둘 (지난번 "시험을 의심한다"의 연장)

1. **H15 — 화면이 `formatPT`를 우회해도 초록이었다.** 화면 코드에 `toLocaleString('ko-KR')`를 직접 쓰면 어떤 시험도 못 잡았다. `ko-KR`은 한글이 아니라서 한글 스캔도 통과했고, 화면은 렌더 시험이 없다. **훼손해 보기 전에는 "시간이 PT로 나온다"는 시험이 있다고 믿었지만 그 시험은 `formatPT` 함수만 봤다.** 화면 소스가 `formatPT`·`ptWallToIso`만 쓰고 `toLocale*`·`Intl.DateTimeFormat`·`new Date(v)`를 안 쓴다는 소스 시험을 추가해 빨개졌다(H16 포함). 소스 읽기 시험은 약하다(줄이 있는지만 본다) — 그 한계는 알고 있다.
2. **PC 시간대가 PT라서 "브라우저 시간대로 읽는" 훼손이 초록이 될 뻔했다.** 작성자 PC가 `America/Los_Angeles`라서, 입력을 PT로 읽어도 브라우저 시간대로 읽어도 **같은 값**이 나온다. 그대로면 H14가 초록이었다. **자식 프로세스를 `TZ=UTC`로 강제해** 실행하는 시험을 만들고, 그 자식이 정말 UTC인지(`getHours()==7`) 대조군으로 먼저 확인한다. 참고: 이 Windows 환경에서는 `TZ=Asia/Seoul`이 **무시된다**(UTC만 먹는다) — 안 먹는 설정으로 시험을 짰으면 대조군 없는 PASS였을 것이다.
- 교훈: **"내 환경에서 같은 값이 나오는 가드"는 훼손해도 안 빨개진다.** 가드를 시험할 때는 내 환경이 정답과 우연히 일치하지 않는지 먼저 본다.

### 메일 영어 대조 (확정 용어 vs 현재 메일) — **목록만 올림, 메일은 아직 안 고쳤다(본부 지시)**

| # | 위치 | 현재 | 확정 용어와 | 제안 |
|---|---|---|---|---|
| 1 | `NOTICE_TEXT.reason.late_for_slot` | `missed its publish slot` | **publish가 섞였다** (이 슬롯은 dispatch) | `missed its dispatch slot` |
| 2 | `NOTICE_TEXT.reason.manual` | `stopped by a person` | 화면은 Held / `Held manually` | `held by a person` |
| 3 | `NOTICE_TEXT.reason.version` | `...always held until a person releases it` | 버튼 이름이 Dispatch (release 아님) | `...until a person dispatches it` |
| 4 | `NOTICE_TEXT.scheduledLead` + `minuteUtc` | `Times are UTC` / `07:00 UTC` | 화면은 PT 하나 | **결정 필요**(아래) |
| 5 | `content-dispatch.ts` `alertHtml` | 상태를 원문 `unknown`/`failed`로 표기 | 화면은 `Needs review`/`Failed` | `Needs review` / `Failed` |
| 6 | 같은 곳 `re-sending` | 화면 버튼은 `Re-dispatch` | `re-dispatching` |
| 7 | 같은 곳 제목 `content distribution(s) need attention` | `distribution`은 확정표에 없는 내부 용어 | 제니3 확인 필요(`dispatch(es)`?) |
| ✓ | held / returned / scheduled 제목·본문 | 이미 일치 | 변경 없음 | |
| ✓ | `content dispatch is OPEN but <key> is missing` | 화면 `Open`/`Closed`와 대소문자만 다름 | 변경 불필요 | |

- **4번은 결정이 필요하다:** 화면은 PT 하나라고 확정됐는데 메일은 UTC다. 메일도 PT로 맞추면 "기준은 미국 서부 시간 하나"와 일치하지만, 메일의 UTC는 로그·EOD와 대조하기 쉬운 장점이 있다. **지수 의견: 메일도 PT로, 단 `PT`를 항상 붙인다**(같은 사람이 화면과 메일을 번갈아 보므로 두 시각이 다르면 혼동이 더 크다). 본부 판단.

## 7. 영구 잔존 시험 행 (변화 없음)

`probe-trg-20261005`(hidden) · `probe-rpc-20261005`(returned) · `probe-rt-20261006054214`(held, blocked) · `probe-rt-cl-20261006060004`(**hidden**, cleared, 배포 posted `probe-stub`, **hidden 유지 필수**; 본부 전달 id `9946fb81-3ecb-40ee-b065-7c0fb1456818`).
이제 **어드민 목록(쿼리)·알림(쿼리+빌더)·공개 판정(SQL 둘+재검사)·`[송출]`/`[다시 보냄]`(서버 액션)** 에서 모두 `probe-` 접두로 막혀 있다.

## 8. 미결 — 우선순위대로 (본부 정리 2026-10-07)

### 1순위 — ~~반송 알림~~ **완료·라이브 `4fb8824`**(6-3절). 남은 것: 메일 실제 발송은 ⑩의 `[반송]`이 처음 돌린다. 아래는 승인 당시 기록.
### (기록) 반송 알림 — 내일 첫 작업이었던 것
- 영상 없이 할 수 있고 ⑩과 겹치지 않아서 영상이 오기 전에 한다. **⑩ 자체는 영상 대기다**(2순위).
- 내일 순서: ① SQL 블록(사전 확인 -> 추가 -> 되읽기 -> 되돌리기, **TK님이 Run하실 때 본부가 같이 본다** — 오늘은 만들지 않았다) ② 코드 ③ **배포는 TK님 명령**. 방법은 아래 "반송 알림" 절.

### 2순위 — 영상이 오면 즉시: **⑩ 정상 송출 1건 (실제 YouTube, private)**
- 준비는 끝났다(코드 `6d4d731` 배포됨). 절차는 **설계서 §5-8**: 시작 전 읽기 확인 -> `content_youtube_visibility='private'` 입력(**아직 안 넣었다**, 없으면 코드가 `private`으로 떨어지므로 안전하나 명시한다) -> 만든 쪽이 `allowed_platforms:["youtube"]`, cleared로 1건 수입 -> 어드민에서 제목을 `[시험] 2026-10-07 ...`로 수정 + `[정지]` -> `content_dispatch_per_tick`을 1로 -> 그 콘텐츠 DBA 송출 스위치 하나만 -> `[송출]` -> 로그 `processed:1` -> **즉시 닫고 `per_tick`을 10으로 복원** -> Studio에서 비공개 확인·삭제 -> 어드민 `[반송]`으로 기록.
- **시작 직전에 SQL 블록 B(`postiz_channel_youtube`)를 한 번 더 돌린다**(같은 쿼리가 `n=0`/`n=1`로 흔들린 원인 미확정). 블록 A(대기 행 0건)도 다시.
- 같이 볼 것: 알림 메일 실제 발송·`notified_at` UPDATE, 어드민 `[송출]` 흐름(`contents_history`와 `publish_log` 대조), 항목 예산 120초·메모리 100MB 실측, Postiz `type:private` 실제 비공개 여부, 응답 `postId`와 Postiz 삭제 id의 일치.
- **전제 확인 하나:** 엔터 완성본에 `main_16x9`가 있는지(제니2). YouTube는 현재 `main_16x9`만 받는다(아래 4순위 아님 — **본부 확인 대기 설계 질문**, 6절 "⑩ 준비 현황").

### 3순위 — 남의 답을 기다리는 것
- 이메일 템플릿 이름 문구(제니3, 2차 문구 정리 — 확정되면 검사 테스트의 허용 목록 항목을 지운다)
- ElevenLabs·Hedra 상업 약관(뉴스·엔터가 확인, 그때까지 뉴스는 전부 `held`)
- AI 생성물 표기(제니3, 플랫폼별)

**공개 스위치를 켜기 전 체크리스트(설계서 §7-3, 6개) — 안 끝나면 켜지 않는다**
- [ ] AI 생성물 표기(제니3, 플랫폼별)
- [ ] ElevenLabs·Hedra 약관 확인(뉴스·엔터가 확인, 그때까지 뉴스는 전부 `held`)
- [ ] 공개 화면 문구 확정(`lib/content-public-text.ts` 임시값 교체)
- [ ] `content_path_<kind>` slug 결정(TK님) + 예약어 충돌 없음 (안: `news`·`drama`·`film`·`cf`(또는 `ads`)·`music`·`music-video`)
- [x] 라이브 컬럼 확인 — **`probe-public-columns.mjs` PASS 10/10(완료)**
- [ ] 스위치를 켠 직후 응답 본문 직접 확인(`script`·`sha256`·`source_ref`·`caption`·`rights_reason` 없음) + `/c/<id>` **308 헤더** + **보류 항목 vs 미존재 항목 404 본문 직접 비교**(시험 행 id는 7절)

### 4순위 — Phase 2 (홈 설계와 같이 본다. 지금 구현하지 않는다)
- 홈/Discovery 설계(설계서 §12-2)
- 경로 `/watch*` 정리: `/watch` -> `/` 308, 상세·랭킹의 새 경로(안: `/v/[id]`, `/rankings`), `/watch-arena`는 최종 목적지로 직접 308, **`RESERVED_SLUGS`에 `watch`·`watch-arena`를 계속 두고 새 경로도 추가**, 홈이 `searchParams`를 받게 수정, 이메일 링크 6곳·챗봇 지식·랜딩 링크 갱신
- Series / Season / Episode 모델(막는 것 없음, §12-3)
- `production_origin` / `client_id`(CF 구분)
- ~~`/admin/contents` 영어 전환~~ **코드 완료·푸시 `0b8e213`, 미배포**(6-5절). 남은 것: TK님 배포 명령, 알림 메일 영어 7건 대조 결과(6-5절 표)에 대한 본부 판단(특히 4번 UTC/PT)
- ~~배포 검증 canonical 전환(`scripts/deploy-prod.mjs`)~~ **코드 완료(본부 승인, 2026-10-07 밤). 라이브 배포 검증은 TK님 다음 배포 때.** 검증 대상을 `www.oxxovo.ai/api/version`으로 바꾸고(`scripts/deploy-verify.mjs`) **옛 SHA는 통과가 아니라 재시도**(12회 x 5초), `sha`와 `builtAt` 둘 다 맞아야 통과(같은 커밋 재배포의 옛 빌드 거짓 통과 방지), 끝까지 안 맞으면 `exit 1`. 배포 URL은 인증 벽 진단에만 쓴다. 재검증만 하려면 `npm run deploy:verify -- <sha> [builtAt]`. alias 간격은 15개 배포에서 `ready` 후 0.25~0.45초(엣지 전파는 측정 불가라 창을 넉넉히). 가드 훼손 8건 전부 빨개짐.

### 5순위 — 미정 결정 (TK님)
- `content_max_bytes_<kind>_<form>` 미설정: **100~500MB 영상이 수입은 되고 송출(100MB)에서 `failed_terminal`이 된다.** 영상 kind별 수입 상한을 송출 상한 이하로 둘지. 수동 `[송출]` 확인창에는 경고가 뜬다.
- `content_dispatch_max_attempts`·`content_dispatch_backoff_base_minutes`·`content_dispatch_item_budget_seconds` 값 미정(없으면 재시도 0회 -> 어드민에 노란 안내, 항목 예산 120초). **⑩에서는 재시도 0회를 유지한다**(자동 재시도가 중복 게시를 부를 수 있음).
- 공개 경로 이름(slug), `restricted -> blocked` 허용 방향 확인.

### 반송 알림 — **승인됨(본부 2026-10-07 저녁), 내일 SQL부터**
- **본부 전제 정정:** 반송 조회 API(`GET /api/contents/returns?since=`, ④에서 라이브 시험 통과)는 **이미 있다.** 없는 것은 **담당자(info@) 메일**이다. 어제 "반송은 만든 쪽이 영영 모른다"로 적은 표현은 **본부의 과한 표현**이었다. 만든 쪽이 모르는지는 **그쪽이 이 API를 실제로 폴링하는지**에 달려 있다.
- **폴링 확인:** **뉴스·제니2에게 "`GET /api/contents/returns?since=`를 폴링합니까"를 묻는 메시지가 내일 나간다**(본부가 보냄). 답에 따라 메일이 만든 쪽까지 닿는 보강인지, 사실상 유일한 경로인지가 갈린다.
- **승인된 방법(그대로):**
  - **컬럼:** `contents`에 `returned_notified_at timestamptz` 하나, nullable, 기본값 없음. SQL은 `ALTER TABLE public.contents ADD COLUMN IF NOT EXISTS returned_notified_at timestamptz;`(행을 다시 쓰지 않고 잠금은 순간, 테이블 단위 GRANT가 새 컬럼에도 적용, 함수를 만들지 않으니 오버로드 없음). 되돌리기는 **별도 블록**, 되읽기는 `pg_attribute`로.
  - **판정:** 트리거·RPC 변경 없이 비교로 한다. `status='returned' AND (returned_notified_at IS NULL OR returned_notified_at < returned_at)`. `content_return`이 반송 때마다 `returned_at`을 새로 쓰므로 반송 -> 정지 복구 -> 재반송도 다시 알림이 간다. 불변 컬럼 트리거와 감사 트리거는 이 컬럼을 안 본다.
  - **코드:** ⑧ 알림 러너와 같은 틱에 **별도 쿼리**로(held·scheduled 알림에 영향 없게). 메일이 **수락된 뒤에만** `returned_notified_at` 기록, `probe-` 행은 쿼리와 빌더에서 이중 제외, `returned_reason`·제목은 이스케이프, 가드 훼손 시험까지.
  - **순서:** **SQL -> 되읽기 -> 코드 -> 배포.** 코드가 먼저 나가면 쿼리가 오류를 내 틱 경고가 반복된다.
- **주의 둘(승인된 그대로 기록):**
  1. 지금 DB의 반송 행은 `probe-rpc-20261005` 하나뿐이고 `probe-` 제외라 메일이 안 간다. **배포 후 첫 틱의 기대값은 `notified`가 달라지지 않는 것**이고, 실제 메일 경로는 **⑩의 `[반송]`(시험 영상 삭제 기록)이 처음 라이브로 돌린다**(그 반송 행이 info@로 메일 1통을 만드는 것이 정상).
  2. 메일은 수락됐는데 `returned_notified_at` 기록이 실패하면 **다음 틱에 같은 메일이 한 번 더 간다**(⑧ `notified_at`과 같은 한계, 설계서에도 한계로 적는다).
- **내일 첫 작업 순서:** 1. SQL 블록(사전 확인 -> 추가 -> 되읽기 -> 되돌리기, 본부가 TK님 Run을 함께 본다) 2. 코드 3. **배포는 TK님 명령.**

## 8-2. 위험·이월(어제와 같음)
- R2 공개 주소 노출(권리 `blocked` 파일도 key를 알면 열림, 의도), `CRON_SECRET` 교체 금지, eslint 기준선(오늘 `app lib` 149건, 변경 전후 동일), `ALERT STATE%` 제외 미증명, `updated_at` 트리거 없는 C분류 5개 테이블, 설계서 후속(본부 반영).

## 9. 인계 메모

**현재 상태**
- **(저녁 갱신) 레포 `main` = 라이브 = `4fb8824`**(반송 알림, 6-3절). 아래 `9ab016e`는 오후 시점 기록. 컬럼 `contents.returned_notified_at` 라이브. 크론 로그에 `returnedNotified` 필드 추가(정상 `0`). 8절 1순위는 완료.
- 레포 `main` = 라이브 = **`9ab016e`**(오후 EOD 커밋 전). 작업 트리 clean.
- **오늘 라이브 상태(확정):** SHA `9ab016e` · 스위치 **마스터만 열림, 엔터·데일리 닫힘** · **실제 SNS 게시 0건** · **공개 화면 전부 404** · 크론 `no_open_dba`. **⑩은 뉴스·엔터 영상 대기**(양쪽에 제작 지시가 나갔다).
- 플래그(변화 없음): `social_dispatch_enabled=true`, `news_dispatch_enabled=false`, `entertainment_dispatch_enabled=false`, `news_publication_enabled=false`, `entertainment_publication_enabled=false`, `competition_publication_enabled=false`. **실제 SNS 게시 0건, 공개 화면 전부 404. 건드리지 말 것.**
- 크론 6개 그대로. 틱 로그에 `notified` 필드가 추가됐다: `[content-dispatch] {"stage":...,"notified":N,...}`. 정상은 `no_open_dba`·`notified:0`·`warnings:[]`.
- 도구: `scripts/probe-contents.mjs`(수입 경로), `scripts/probe-public-columns.mjs`(읽기 전용 공개 컬럼, 서비스 롤 키는 환경변수로만 — TK님이 `Read-Host -AsSecureString`으로 입력, 키는 Supabase 대시보드 Project Settings -> API Keys -> `service_role` Reveal).

**재개 순서**
1. 이 파일 8절(우선순위)을 본다. **⑩은 영상 대기**(뉴스·엔터에 제작 지시가 나갔다). 영상이 오면 설계서 §5-8을 그대로 따른다(결정은 이미 났다: 실제 OXXOVO YouTube 1건, private, 테스트 채널은 만들지 않음).
2. **내일 첫 작업: 반송 알림(승인됨).** SQL 블록(사전 확인 -> 추가 -> 되읽기 -> 되돌리기)을 TK님 Run 때 본부가 같이 볼 수 있게 보낸다 -> 되읽기 확인 후 코드 -> 배포는 TK님 명령. 오늘은 SQL 블록을 **만들지 않았다**(본부 지시).
3. 공개 스위치는 §7-3 체크리스트가 끝나기 전에는 켜지 않는다. 홈·경로·시리즈는 Phase 2.

**작업 규칙(재확인)**
- SQL은 채팅 본문으로, 블록 하나에 쿼리 하나, 고유 태그 + `/* */`, 되돌리기는 별도. TK님이 Run, 지수는 Run 안 함. 함수·컬럼을 만들면 되읽는다(`prosrc` 고유 토큰 둘 이상 / `aclexplode`), 0행 증명은 `count(*)`.
- 배포는 TK님 `! npm run deploy:prod`. 배포 후 `www.oxxovo.ai/api/version`으로 SHA 직접 확인.
- **여러 줄 수정은 편집 도구로. 셸 치환·`node -e`·`String.replace($')` 금지(오늘 2회 어김).** 부득이하면 파일로 쓴 스크립트 + 함수 치환자.
- **0건은 증거가 아니다. 대조군이 먼저다.** 찾았는데 없을 때는 "그 도구가 그것을 찾을 수 있었는가"(양성 대조군)를 먼저 증명한다(`/rules`가 클라이언트 렌더라 `curl` 0건이 무의미했던 사례). 감시는 로그 **줄 수**가 아니라 **시각**으로 판정한다(`vercel logs`는 기본 100건 창).
- **이름 정리는 이름으로 쓴 곳만, 한 곳씩.** 영어 동사 `watch`·`watching`·`scoring-lease-watch`·`fs.watch`는 건드리지 않는다. 사용자 노출 문자열은 `lib/user-facing-names.test.ts`가 지킨다(새 문구에 구 명칭이 이름으로 들어오면 빨개진다).
- 가드를 만들면 일부러 망가뜨려 테스트가 빨개지는지 확인. 시험은 대조군과 한 쌍. 결과 보고에는 대상 서버·`source_ref`·id를 같이.
- 사용자向 문안은 내 소관이 아니다(제니3). 운영자 내부 알림만 내가 쓴다.
- 안 맞으면 근거를 대고 반대할 것(TK 상시 지시). 실패·반례도 기록할 것.
- 시크릿·`vercel env pull` 값은 읽지 않는다. `railway variables` 목록 호출 금지.
