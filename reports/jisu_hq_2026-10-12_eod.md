# EOD 2026-10-12 -- 지수(메인, 앱 레포) 작업 요약 + 인계

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문 그대로.
**읽는 순서: 0절 -> 3절(⑩ 상태, 내일 첫 일) -> 4절(순서 결정) -> 2절(로컬 미배포) -> 5절(커밋 안 된 파일) -> 1절(오늘 한 일) -> 6절(교훈·한계).**
이 파일은 로컬 작성이고 **이 파일 작성 이후 커밋·푸시·배포를 하지 않았다**(TK님 지시). 진행 중인 작업은 없다(안전한 지점에서 멈춤).

## 0. 한 줄 요약

**라이브 = 레포 HEAD = `origin/main` = `55b45a0`**(배포 `dpl_J7ui8QoFJbJcLrNxaSod1M7HFiXT`, builtAt `2026-10-12T22:06:56.631Z`, 오늘 배포 1회). 새 사이트(홈 + 7페이지, 언어 층, 배너 리더)가 **코드로 라이브에 올라갔고 `watch_as_home`은 꺼진 채**(켜지 않음). 기준값 대조에서 **`/ko`가 404가 아니라 200**인 차이를 잡았고, 수정은 **로컬 완료·미배포**. ⑩은 오늘 시작하지 않았다(배포일 규칙). 뉴스 수입은 **세종 쪽 진행 여부 미확인**.

## 1. 오늘 한 일

### 1-1. 테스트 목록 가드
- `lib/test-list.test.ts`(8개 시험): `package.json` `npm test` 목록과 레포의 모든 `*.test.*`를 대조 -- 목록에 없는 파일, 존재하지 않는 경로, 중복, 두 경로가 붙은 토큰이 있으면 빨개짐. 목록에도 등록.
- 훼손 시험(실제 `package.json`): 공백 누락·항목 삭제·없는 파일·중복·목록에 없는 새 파일 5종 모두 exit 1, 대조군 exit 0, 원복 바이트 동일.
- 한계: `test` 스크립트 하나만 본다(`test:crypto`처럼 따로 목록을 가진 스크립트는 안 봄).
- 숫자: 배포 시점 **921/921**(912 -> 920 -> 921), 로컬 현재 **923/923**(아래 `/ko` 시험 2개 포함).

### 1-2. 배포
- 커밋 `6ada7fa`(새 사이트 코드 + 검토 자료), `55b45a0`(⑩ 문서 4건 + 10-10·10-11 EOD + 수입 규격). 푸시 후 `npm run deploy:prod`, `✓ live version (try 1)`.
- 배포 전 확인: `npm test` 921, `tsc` 0, `next build` 성공(새 7개 경로 동적), 커밋 파일 목록은 점검표와 대조(목록 밖은 10-11 EOD 하나 -> 본부가 "docs 커밋에 같이"로 결정).
- 크론: 배포 직전까지는 옛 배포 id, **새 배포 id로 22:10:14, 22:15:14 두 번 연속** `no_open_dba`, `processed:0`, `warnings:[]`.
- 롤백은 필요하지 않았다(대상 `dpl_9BZwjVNGSJuBy9utF5pohhb7s87K`, 점검표 8-2절).

### 1-3. 기준값 대조 결과 (점검표 2절 6번 표, 배포 전 실측 vs 배포 후)
- **그대로**: `/` 200(title 동일, "Featured" 0건), `/watch` 404, `/watch/` 308, `/tournament`·`/welcome`·`/studio`·`/login` 200, `/api/version` 200(새 SHA), `/c/0000...` 404, `robots.txt` 52바이트 md5 `3b5077be` 동일, apex 307.
- **달라져야 하는 줄이 기대대로 달라짐**: `/en` 404 -> 308(`/`), `/en/market` 404 -> 308(`/market`).
- 새 7페이지 전부 404(`x-matched-path`는 각 경로로 바뀜, 예상한 변화), `/ko/market`·`/ko/watch` 404, 위조 헤더 `lang="en"`, 홈 노출 단어 0건, 한국어 `Accept-Language`의 `/`는 200 랜딩.
- 본문 md5는 배포 간 비교에 못 쓴다(`data-dpl-id`가 배포마다 바뀜) -- 점검표에 기록.
- 측정은 로그인 없는 익명 요청뿐.

### 1-4. `/ko`가 200이었다 (점검표 기대는 404)
- 배포 후 `/ko`가 200으로 옛 랜딩과 같은 내용(`lang="en"`, `canonical`·`hreflang` 없음)을 보여 줬다. 원인(코드로 확인): 프록시가 `/ko`를 `/`로 rewrite하는데 스위치 꺼짐의 `/`는 랜딩이라서. 다른 새 경로(`/ko/market` 등)는 자기 페이지가 404를 내서 가려져 있었다.
- 영향: 새 사이트 노출 아님·보안 문제 아님. 랜딩이 `/ko`에서 중복으로 보임.
- **실패도 기록**: 점검표의 "`/ko` -> 404"는 내가 쓴 기대값이었고, **배포 전에 로컬 `next start`로 `/ko`를 한 번 쳐 봤다면 잡혔을 것**을 배포 후 측정이 잡았다. 로컬 렌더·단위 시험은 이 경로(프록시 rewrite -> 루트 페이지 분기)를 못 봤다.

### 1-5. 썸네일 컬럼 · 호버 설명 실측
- **썸네일 컬럼**(TK님 `pg_attribute` 읽기 SQL): `content_assets`에 `content_id uuid not null`·`media_type text not null`·`role text not null`·`url text`(nullable) 4행 전부 있음. `role`이 text(enum 아님). 코드의 `url` null 처리는 두 겹(SQL `.not('url','is',null)` + 순수 함수 `typeof` 가드)이 이미 있었고, 훼손 시험으로 확인(순수 함수 가드 삭제 -> 실패 2, SQL 필터 삭제 -> 1, 둘 다 -> 3, 대조군·원복 초록) + 시험 1개 추가. 한계: 가짜 DB 응답 기준, 라이브에 null url 행이 있는지는 안 봄.
- **호버 설명 출처**: 대회 카드 `summary` = `video_description`(/apply, 최대 600자)을 `getWatchVideos`로 읽어 앞 200자 + "…". `/watch/[id]`(249행)가 전문을 이미 공개 렌더하는 같은 필드·같은 조회. 새 필드는 없고 위치(홈 호버)·길이만 새로움. 콘텐츠 카드는 카드 아래 한 줄(`line-clamp-1`)에도 `description`을 항상 보여 줌.
- **실제 문장 확인용 SQL 2개**(TK님 Run): 호버 설명 SQL = `No rows returned`. 단계별 count = `n_seasons_all` 14, `n_season_candidates` **0**, `n_apps_all` 117, `cur_id` null. **판정(TK님): 날짜가 잡힌 비-fixture 시즌이 0개라 `getCurrentSeason`이 시즌을 못 고르고, 홈 대회 카드·호버 설명은 지금 0건이 맞다.** 한계: `n_season_candidates=0`은 "날짜 없음"과 "`is_fixture` 전부 true"를 구분하지 않는다(TK님 판정은 날짜 쪽).
- **결정(TK님)**: 시즌 날짜를 다시 설정하는 날, 대회 공개 스위치를 켜기 전에 이 두 SQL을 다시 돌려 TK님이 실제 설명 문장을 보고 노출을 승인한다(점검표 3-2절에 기록). SQL 원문은 레포에 두지 않았다 -- 요청 시 채팅으로 다시.

### 1-6. 시안 이미지
- `reports/site_mockup.png`(실제 회사 로고 포함)를 `C:\Users\Tom\Desktop\oxxovo_mockups\site_mockup.png`로 **레포 밖으로 이동**. `git status`에 흔적 없음. 레포 문서(10-11 EOD·점검표)에는 옛 경로 언급이 남아 있다(파일은 없음).

### 1-7. 그 밖에
- 화면 확인용 렌더 도구 `scripts/site-fixture-shot.mjs` + `scripts/_link-stub.js`(TK님 결정으로 유지, 커밋됨). `2_en_home_mobile.png` 재생성.
- Market 계획 `reports/market_workspace_plan_2026-10-11.md`(커밋됨): **질문 4개는 마켓 제니가 TK님과 정한다, 데이터 구조는 그 답 전까지 확정하지 않는다**.
- 점검표 보강(커밋됨): 기준값 표 채움, `R2_PUBLIC_BASE` 이름 확인(Production에만 있음, 값 안 봄), 롤백 8-2절, 호버·썸네일 3-2절.

## 2. 로컬 미배포 (전부 미커밋)

1. **`/ko` 404 수정**: `lib/locales.ts`에 `rootSurface(switchOn, prefixedHeader)`('home'|'landing'|'notfound'), `app/page.tsx`가 사용(꺼짐 + 프록시 접두 헤더 `1` -> `notFound()`, 일반 `/`는 랜딩 그대로). 시험 2개 추가(규칙표 + `app/page.tsx` 소스 가드), **훼손 5종 모두 빨개짐**(접두 헤더 무시 / `/`까지 404 / `notFound()` 호출 삭제 / 헤더 대신 null / 스위치만 보는 이전 방식), 대조군·원복 초록·바이트 동일. 로컬 `next build` + `next start` 실측: `/` 200, `/ko` **404**, `/ko/market` 404, `/ko/watch` 404, `/en/market` 308, 위조 헤더의 `/` 200(랜딩). `npm test` 923/923, `tsc` 0. 점검표 기준값 표의 `/ko` 줄에 첫 배포 실측과 수정을 기록.
2. **프리뷰 입구 함수: 시작하지 않았다(계획만, 승인 대기).** 추천안 = 프리뷰 배포 + 프로덕션이 아닌 환경에서만 새 사이트 열기(`isNewSiteOpen()` = `VERCEL_ENV !== 'production'` 또는 `watch_as_home`, `lib/watch-gate.ts`의 `isWatchPublic` 선례). 확인한 사실: Preview와 Production이 같은 Supabase를 씀(`NEXT_PUBLIC_SUPABASE_URL`·서비스 키가 둘 다에 걸림) -> 프리뷰만으로는 `watch_as_home`이 거짓이라 404. `R2_PUBLIC_BASE`는 Production 전용 -> 프리뷰 배너는 그라데이션. 시작 전 TK님 확인 3가지: 프리뷰가 Vercel 인증 뒤 비공개인지(코드 주석엔 있으나 이번에 확인 안 함), 프리뷰에는 홈 대회 카드가 거의 안 나옴(`competition_publication_enabled`·현재 시즌 0개), 프리뷰도 프로덕션 DB에 붙음. **승인되면 로컬에서 입구 함수 + 시험 + 훼손 시험부터.** 코드 변경 없음.
3. **실행표·규격 정정**(`step10_runbook_2026-10-10.md`, `import_spec_news_2026-10-10.md`):
   - B3(S2-1) 통과 기준 **1행(`main_16x9`)**, **`thumbnail` 행이 나오면 멈춤**(본부 결정 2026-10-12: 영상 1개만 수입, 뉴스·세종에도 전달). B1에 "응답에 thumbnail이 보이면 멈춤" 추가, 12절 8번 정정, 규격 파일에 "⑩ 시험은 썸네일을 보내지 않는다" 행.
   - A1 SHA 기대값: 스위치 여는 날 시작 시점의 라이브 SHA(현재 `55b45a0`). A0-2 문구 정정.
   - B1 `publish_at`: 고정값 삭제(서버가 `news_publish_*`의 다음 슬롯으로 정함, 통과 조건 아님).
   - 0절에 "10-12는 수입·Hold·B3·B4까지, C4·D는 다음 날 이후, `pg_trigger`·A5·A6는 스위치 열기 직전" 기록.

## 3. ⑩ 상태

- **오늘 한 것/안 한 것:** 배포일(`builtAt` 10-12 22:06Z)이라 A0 규칙에 따라 ⑩을 시작하지 않았다. 스위치 변경 0건, `watch_as_home` 변경 0건, `news_dispatch_enabled` 변경 0건.
- **뉴스 수입(`step10-news-20261010` v1)은 세종 쪽에서 진행 중이라고 TK님이 알려 주셨으나, 응답이 이 세션에 도착하지 않았고 DB로도 확인하지 않았다 -> 진행 여부·결과 미확인.** 판독 기준(201, `outcome:created`, `channels` youtube 1줄 `queued`, `status` `scheduled`|`held`, `idempotent:false`), Hold 절차(`https://www.oxxovo.ai/admin/contents` -> DBA=Daily -> 제목으로 카드 -> `Hold`), S2-1·S2-2 SQL은 실행표 B1~B4에 있다. S2-1 통과 = **1행** `main_16x9` 1920×1080, `bytes=9008217`, `duration_sec=31.02`, `has_url`·`has_sha` true, `status=held`; S2-2 통과 = 1행 `youtube`·`queued`·`content_status=held`.
- **내일 첫 일(순서):** ① 수입 확인(응답 또는 S2-1 조회로 행이 생겼는지) -> ② 수입됐으면 Hold -> ③ S2-1·S2-2 -> ④ `pg_trigger`(`tgenabled='O'` 두 행, 날짜 기록)·A5·A6 -> ⑤ A0 재확인(내일 `builtAt`이 오늘이 아님, 새 `deploymentId` 틱은 오늘 이미 2회 확인됨) -> ⑥ 스위치 열기(C4) -> Dispatch(D). 수입이 안 됐으면 ①에서 세종·뉴스 제니에게 상태부터 확인.
- 하지 말 것(그대로): 배포·`CRON_SECRET` 교체·`railway variables` 목록 호출·서비스 키/`vercel env pull` 값 읽기. A5·A6·`pg_trigger`는 **스위치 열기 직전**에 돌리는 것으로 TK님이 정했다(수입 전 점검의 일부를 순서를 바꿔 뒤로 미룬 것이므로, 그 사이 상태가 바뀌었는지 그때 다시 본다).

## 4. 순서 결정 (TK님/본부, 2026-10-12)

- **내일 ⑩ 먼저, `/ko` 수정 배포는 그다음 날.** 이유(A0 규칙): 배포한 날은 ⑩을 열지 않는다. 내일 ⑩에서 스위치를 열면 내일은 배포하지 않고, `/ko` 수정(+ 프리뷰 입구 함수가 승인되면 그것도)은 ⑩ 다음 날 한 번에 배포한다.
- 따라서 내일 `deploy:prod`·커밋·푸시는 없다(TK님이 별도로 지시하지 않는 한). `/ko` 200 상태가 하루 더 라이브에 남는다(영향 없음, 1-4절).

## 5. 커밋 안 된 파일 (HEAD `55b45a0`, 이 EOD 포함, 커밋·푸시하지 않음)

**수정(M) -- 6건**
```
 M app/page.tsx                                   rootSurface 사용, 스위치 꺼짐 + /ko -> notFound()
 M lib/locales.ts                                 rootSurface 추가
 M lib/locales.test.ts                            rootSurface 시험 + app/page.tsx 소스 가드
 M reports/import_spec_news_2026-10-10.md         "⑩ 시험은 썸네일을 보내지 않는다" 행
 M reports/site_predeploy_checklist_2026-10-11.md /ko 줄에 첫 배포 실측과 수정 기록
 M reports/step10_runbook_2026-10-10.md           B3 1행·썸네일 멈춤, A1 SHA·B1 publish_at·0절 순서
```
**신규(??) -- 1건**
```
?? reports/jisu_hq_2026-10-12_eod.md              이 파일
```
- 코드 변경은 위 3개(`app/page.tsx`, `lib/locales.ts`, `lib/locales.test.ts`)뿐이고 **전부 `/ko` 수정이다.** 나머지는 문서. 커밋 분할 제안: `fix: /ko is a 404 while watch_as_home is off`(코드 3개 + 점검표) / `docs: ...`(실행표·규격·이 EOD).
- `deploy:prod`는 untracked·미커밋 변경을 dirty로 거부한다 -> 배포 전에 위를 전부 커밋하거나 치워야 한다. `git add -A`/`git add .` 금지, 경로 지정.

## 6. 오늘의 교훈 · 한계 (성공만 적지 않는다)

1. **배포 후 측정이 로컬이 못 본 것을 잡았다**: `/ko` 200. 기대값을 내가 "404"라고 점검표에 적었는데 배포 전에 검증하지 않았다. -> 새 경로의 기대값을 점검표에 쓸 때는 **로컬 `next start`로 그 URL을 먼저 쳐 본다**(이번에는 배포 후에야 했다).
2. **기준값 표는 "배포 전 실측" 없이는 쓸모가 없었다**: 배포 후 비교가 가능했던 것은 오전에 라이브를 먼저 쟀기 때문. 본문 md5는 `data-dpl-id` 때문에 배포 간 비교에 못 쓴다는 것도 그때 알았다.
3. **여러 줄 코드를 `node -` 템플릿으로 쓰다 백슬래시가 깨졌다**(테스트 정규식 `\s`, `\/` 등이 사라져 SyntaxError). 기존 교훈 "여러 줄 수정은 편집 도구로"를 또 어길 뻔했다. 실행 전에 시험을 돌려 잡았고 Edit 도구로 다시 썼다. 스크립트 한 줄 `replace(/<\/script/g, '<\\/script')`도 같은 이유로 잘못 들어갔다가 확인해서 고쳤다.
4. **오늘 배포일에 ⑩ 수입이 겹쳤다**(세종 쪽 진행). A0 규칙 위반은 아니지만(수입은 스위치를 안 연다) 규칙의 취지와 어긋나서 TK님께 지적했고, 오늘은 Hold·S2-1·S2-2까지만 하기로 합의. 수입 전 점검(`pg_trigger`·A5·A6)을 건너뛴 채 수입이 시작됐으니 **내일 스위치 열기 직전에 반드시 돌린다.**
5. **한계(검증 못 한 것)**: 라이브 어드민 값(`watch_as_home` 등)은 DB로 안 읽었다(새 사이트가 안 보이는 것으로만 추정). 크론 로그는 조회 창이 약 4시간이라 10-11 20:40Z ~ 10-12 15:20Z는 직접 못 봤다. 뉴스 수입 진행 여부 미확인. 프리뷰가 Vercel 인증 뒤 비공개인지 미확인. `vercel rollback`은 이 프로젝트에서 시험한 적 없다. 호버 설명은 실제 문장을 한 번도 못 봤다(시즌 0개).

## 7. 추가 기록 -- A0 예외 (10-13 03:40Z = PT 10-12 20:40, 본부 결정)

- **A0-1은 PT 기준 같은 날이다**: 라이브 `builtAt` 2026-10-12T22:06:56Z = PT 10-12 15:06, 확인 시각 PT 10-12 20:40(배포 후 약 5.5시간). UTC로는 10-13이라 통과, PT로는 같은 날이라 실행표 문구상 멈춤.
- **A0-2는 충족**: 03:15:14Z~03:40:14Z 6틱이 전부 현재 배포 `dpl_J7ui8QoFJbJcLrNxaSod1M7HFiXT`, `no_open_dba`·`processed:0`·`warnings:[]`·200.
- **본부 판단으로 진행**: 규칙의 목적(배포 직후 크론이 옛 배포를 타는 위험 회피)은 A0-2로 달성됐고 날짜 경계는 대리 기준이었다는 근거. 지수는 멈춰서 물었고, 결정은 본부.
- 한계: 이 예외는 "문구를 어겼다"는 사실을 바꾸지 않는다. 같은 날 배포와 ⑩이 겹쳐 문제가 생기면 원인(배포 vs ⑩)을 가리기 어렵다는 A0의 두 번째 이유는 시간 경과로 약해졌을 뿐 없어지지 않았다.

### A0-1 개정안 (제안만, 실행표 본문은 아직 안 고침 -- 승인 대기)

현행: "`builtAt`이 오늘 날짜(UTC·PT 둘 다)가 아님. 오늘 배포면 멈추고 다음 날로 미룬다."

제안: "`builtAt` 이후 **N시간 이상** 경과(N은 본부가 정함, 이번 예외는 5.5시간) **그리고** A0-2의 새 배포 틱이 **시각 기준으로 연속 K회 이상**(이번은 6회) 확인되면 통과. 둘 중 하나라도 미달이면 멈춘다. 경과 시간은 `api/version`의 `builtAt`과 현재 UTC로 계산해 적는다."

덧붙일 점: 날짜 기준은 UTC/PT가 갈라지는 시간대(PT 17시 이후)에 모호해지므로 시간 경과 기준이 더 안정적이다. 반면 N·K의 값은 이번 한 번의 판단일 뿐 실측 근거가 없다(10-07 사건은 alias 후 13초 뒤 틱 1건).

## 8. 추가 기록 -- A0-1 개정 반영, `/ko` 수정 + 프리뷰 입구 함수 배포 준비 (10-13 03:40Z 이후, 로컬·미커밋)

- **실행표 A0-1 개정 반영**(N=2시간, K=3틱·15분, 본부 승인). 본문 `step10_runbook_2026-10-10.md` A0-1 한 줄만 교체.
- **⑩ 수입은 오늘 없음**(뉴스 쪽 PC 사정). 수입 응답 대기 중단, 스위치·DB 변경 0건.
- **프리뷰 입구 함수**: `lib/watch-home.ts`에 `isNewSiteOpen()`(= `VERCEL_ENV !== 'production'`이면 열림, 프로덕션이면 `isWatchHome()`). `app/page.tsx`와 `lib/site-locale.ts`가 이것을 쓴다. `isWatchHome()`은 순수 스위치 읽기로 그대로(어드민 화면용). 이 승인은 본부의 "배포 준비로 넘어가"에 따른 것이고, EOD §2-2의 TK님 확인 3가지(프리뷰 비공개 여부 등)는 **받지 못했다**.
- 시험: 925/925, `tsc` 0, `next build` 성공. 새 시험 2개 + 기존 3곳의 문자열을 `isNewSiteOpen`으로 교체. **훼손 4종 모두 빨개짐**(환경 비교 뒤집기 / 프로덕션 항상 열림 / 페이지가 맨 스위치 사용 / 게이트가 맨 스위치 사용), 대조군 47/47 초록, 원복 확인. (첫 훼손 실행은 `--import` 플래그를 빼서 대조군부터 빨개 무효였고 버린 뒤 다시 했다.)
- 로컬 `next start` 실측(DB 스위치 꺼짐): `VERCEL_ENV=production` -> `/` 200, `/ko` **404**, `/market`·`/ko/market`·`/ko/watch` 404. `VERCEL_ENV=preview` -> `/`·`/ko`·`/market`·`/ko/market` 200, `/ko/watch` 404. 한계: 로컬 서버라 `VERCEL_ENV`를 내가 줬다. 실제 Vercel 프리뷰/프로덕션에서 이 값이 맞게 들어오는지는 `isWatchPublic` 선례에 기댄 것이지 이번에 측정하지 않았다.
- 미확인(TK님): ① 프리뷰 URL이 Vercel 인증 뒤 비공개인지(코드 주석에만 근거, 이번에 확인 안 함 -- **공개면 프리뷰에서 새 사이트가 누구에게나 열린다**) ② 프리뷰도 프로덕션 DB를 쓴다 ③ 프리뷰 홈에는 대회 카드가 거의 안 나온다.
- 커밋 안 됨. 제안 분할: `fix: new-site entry is open outside production; /ko is a 404 while the switch is off`(코드 5개 + 점검표) / `docs: ...`(실행표·규격·EOD). 배포 전 `git add` 경로 지정, `deploy:prod`는 TK님 명령 때.

## 9. 추가 기록 -- 프리뷰 보호 확인 (읽기 전용, 설정 변경 0)

- Vercel API 프로젝트 조회: `ssoProtection.deploymentType = "all_except_custom_domains"`(Vercel Authentication은 프로덕션 커스텀 도메인을 뺀 모든 배포), `passwordProtection` 없음, 우회 시크릿 0개, 프로젝트 도메인은 oxxovo.ai/.com(+www)·oxxovo.vercel.app뿐(git 브랜치에 붙은 커스텀 도메인 없음).
- 실측(로그인 없이): 최근 프리뷰 배포 2곳과 `oxxovo-compose-preview.vercel.app`은 `/`·`/ko/market` 모두 **302 -> `vercel.com/sso-api`**. `oxxovo.vercel.app`(프로덕션 별칭)은 `/` 200, `/ko/market` 404(= 프로덕션 동작).
- 한계: "Vercel 로그인 뒤"는 **이 팀(oxxovos-projects) 구성원 로그인**을 뜻한다. 팀원이 늘면 그만큼 열린다. 어드민 대시보드 화면(Settings -> Deployment Protection)은 보지 않았고 API 값과 실측으로 대신했다.
