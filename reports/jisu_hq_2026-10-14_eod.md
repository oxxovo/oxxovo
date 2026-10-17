# EOD 2026-10-14 -- 지수(메인, 앱 레포) 작업 요약 + 인계

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문.
**이 파일 작성 시점까지 커밋·푸시·배포·SQL 실행·DB 쓰기·스위치 변경 0건**(TK님 지시). 진행 중인 작업 없음(안전한 지점에서 멈춤).
**읽는 순서: 0절 -> 4절(다음 일) -> 3절(로컬 미커밋·커밋 계획) -> 2절(결정) -> 1절(오늘 한 일) -> 6절(교훈·한계).**

## 0. 한 줄 요약

**라이브 = 레포 HEAD = `origin/main` = `c9126a9`**(builtAt `2026-10-13T04:07:00Z`, `dirty:false`). **로컬 미커밋: 코드 3묶음(P1 watch 게이트 / Coming Soon 4곳 / watch noindex) + 문서.** 세 묶음은 단독·조합 모두 `tsc` 0, 테스트 통과, 전체 939/939, `next build` 성공. 판독 확정: **지금 watch를 열어도 시험 행은 공개되지 않는다(③ 0행)**, W4 안 함. **다음 = TK님이 커밋 4개 명령 -> push -> `deploy:prod`, watch 열기는 배포 다음 날 이후.**

## 1. 오늘 한 일

### 1-1. 시작 보고와 확인
- 라이브 SHA·레포 HEAD·origin/main 모두 `c9126a9`, 로컬 미커밋은 어제 EOD §7과 동일. `next build`(P1 변경분) 통과, `tsc` 0, `npm test` 930/930.
- 크론: 내가 `vercel logs`로 못 읽음(타임아웃, 재시도는 "No logs found" -- 부재 증거 아님). **TK님이 Vercel 대시보드로 확인: Cron Jobs 6개 전부 Enabled, `c9126a9` Ready, 최근 6h 호출 190·오류율 0%. 크론 판정 "이상 없음"으로 닫음.**
- **정정(본부 지적, 10-14):** 어제 EOD §1-2의 `04:10:14Z`·`04:15:14Z` `no_open_dba`는 **content-dispatch(5분 간격)** 응답이다. `no_open_dba`는 `lib/content-dispatch.ts`(`:150`, `:236`)의 stage이고 season-tick(매시 정각)이 아니다. 어제 EOD 20행에 크론 이름·정정 사유를 직접 고쳐 넣음. 같은 날 내 보고에서 "season-tick 정상 응답 = `no_open_dba`"라고 쓴 것도 틀렸다(season-tick 정상 응답 형식은 못 확인). 다른 날 EOD는 이름만 빠졌을 뿐 내용은 맞아 손대지 않음.
- 실행표 A0-1의 K=3틱: A0-2에 content-dispatch·5분 간격·`deploymentId` 기준이 명시돼 있고, A0-1 본문은 "A0-2의 새 배포 틱"으로만 가리킴. 한 구절 추가 제안(`(content-dispatch, 5분 간격)`)은 **본부 승인 대기, 미반영**.

### 1-2. Coming Soon (4곳) -- 로컬 완료·미커밋
- 본부 전달: TK님이 A-3을 10-13에 변경(전달 누락이었음). Market·Education·Jobs·AI Games 4곳만 "Coming Soon", 나머지(Tournament·Daily·Entertainment·홈)는 빈 틀.
- 방식(본부 동의): **명시 플래그 `comingSoon: true`(`lib/site-nav.ts` `PageDef`, 선택 필드) + 문구는 번역 사전 키 `page.comingSoon` 한 개. 데이터로 자동 구분하지 않는다.** `/ko`는 같은 영어 문구(한국어는 제니3 확정 뒤, ko 값만 넣으면 됨).
- 그리는 곳은 `SiteFrame`(빈 틀 위·모바일 좌측 메뉴 아래, `data-coming-soon="true"`). `SectionPage`는 주석만 바뀜.
- 4곳 소스 상태를 코드로 대조: 네 페이지 항목 전부 `section: null`. 소스가 붙어 있는데 플래그가 켜지는 곳 없음.
- 테스트: `lib/site-frame.test.ts`(4곳 있음·나머지 없음, 플래그 정확히 4개·소스 없음, `/ko` 영어 유지), `lib/site-nav.test.ts`(문구는 `page.comingSoon` 한 키에만). 훼손 5종 모두 빨개짐.
- 캡처 8장(`/market` `/jobs` `/ko/games` `/daily` x 1440·390): `reports/coming_soon_shots/`(**`.git/info/exclude`로 제외, 커밋 안 됨**). 방식은 실제 `SiteFrame`·`CardGrid` 로컬 렌더 + 빌드 CSS + Chrome. 문구 텍스트 확인 완료(daily만 없음). **육안은 3장만 직접 봄**(market 1440, ko_games 390, daily 1440). 한계: 폰트가 시스템 폰트라 실제 Pretendard와 다름.
- 스타일 의견(결정 아님): 문구가 빈 배너 아래 왼쪽 정렬이라 섹션 제목처럼 읽히고 대비가 약함. 배너 영역 안 중앙 배치가 의도에 더 가까울 수 있으나 배치는 TK님·제니3 몫.

### 1-3. C1·②·③ 판독 (TK님 Run)
- C1: `season_test`(999) `is_fixture=true`, `watch_fixture_visible=false`.
- ②: `season_test` n_apps 105 / n_row_public 19, `season_test2` 12 / 0. 둘 다 픽스처·숨김, `season_missing=false`. ②는 `WHERE` 없는 `genesis_applications` 기준 left join + group by(본부가 원문 확인) -> 고아 행이 있으면 별도 그룹으로 나왔을 것, 2그룹뿐 = 고아 없음. ① 불필요.
- ③: 0행.
- 코드 근거: `isSeasonPublic`(`lib/watch-visibility.ts:80`)이 목록(`lib/watch.ts:325`)·상세(`:877`)·통계(`app/api/watch/stats/route.ts:39`) 세 경로에 같은 이유로 걸린다(fail-closed).
- **본부 확정: W4(일괄 숨김) 안 함.** 대신 "watch 켜기 직전 ③ 재실행(0행이어야 열기)".
- 16 vs 19 차이(어제 EOD 16행 vs ② 19행): 정의 차이로 보이나 **원인 미확인**, 급하지 않음(나중에 한 줄 확인).

### 1-4. A-8 색인: noindex -- 로컬 완료·미커밋
- 채택(본부): **noindex 메타**, `robots.ts`는 `Allow: /` 그대로(Disallow는 크롤러가 noindex를 못 읽게 함), 범위 `/watch`·`/watch/[id]`·`/watch/rankings`, 스위치 `platform_config.search_index_allowed`(**'true'일 때만 색인 허용, 미설정·읽기 실패·그 외 = noindex**).
- `/watch-arena`: 열리면 `/watch`로 308이라 별도 처리 불필요(범위 제외). 사이트맵: **없음 확인**.
- 구현: `lib/search-index.ts`(판정 + 읽기 + 메타), `app/watch/layout.tsx`(`generateMetadata`), `lib/search-index.test.ts`(7개). Next 문서(`generate-metadata.md` robots 절) 확인 후 작성. 로컬 서버로 `/watch`·`/watch/rankings`가 200이며 `<meta name="robots" content="noindex, nofollow"/>`, `/robots.txt` `Allow: /` 확인(DB는 닫힌 포트). `/watch/[id]`는 실제 행이 없어 직접 못 봄(같은 layout 하위).
- 훼손 9종 확인. **처음엔 `catch`에서 `true` 반환 훼손이 살아남음**(닫힌 포트는 예외가 아니라 `error`로 떨어져 `catch`를 못 탐) -> env 삭제 테스트 추가로 잡음.
- 키 SQL(실행 금지): `reports/search_index_switch_2026-10-14.sql`(BLOCK 0 읽기, BLOCK 1 `'false'` INSERT). 키가 없어도 noindex라 INSERT는 선택. `value_type='bool'`은 `competition_publication_enabled` 선례 따름(라이브 제약은 안 읽음).
- **순서(본부 확정): noindex 코드가 P1·Coming Soon과 같은 묶음으로 먼저 프로덕션에 나가고, watch 켜기는 그 다음 날 이후.**

### 1-5. 체크리스트 `reports/site_launch_checklist.md` 갱신
- 새 절 "watch(대회)를 켜기 직전 읽기": W1(③ 원문, 0행이어야 열기), W2(② 원문), W3(`search_index_allowed` 미설정 확인), 켠 직후 robots 메타 확인, 색인 허용 UPDATE는 열기와 다른 날.
- C5 -> 결정으로 변경, C7(noindex 선배포) 신설, A3-b·켜는 순서 문구를 Coming Soon 변경에 맞게 정정.

### 1-6. 마켓 공용 변경 제안서 006·007·008 검토 (레포 밖 `oxxovo-market/docs/market/shared-changes/`)
- **006: 수정 후.** proxy.ts 수정 불필요 주장은 맞음(matcher는 `api|_next/static|_next/image|favicon.ico|robots.txt` 시작만 제외, 48행은 `isSiteRoute`·`decideRoute`로만 결정). 요청: `locales.ts` 상단·`isSiteRoute` 주석 갱신, proxy 배선 소스 검사 테스트, 인코딩 문자 슬러그 테스트, 003과 적용 순서. `/ko/daily/x`·`/ko/competition/x`는 404 유지.
- **007: 수정 후.** 구조상 열린 리다이렉트는 아니나(고정 경로 + 쿼리 붙임) 공용 함수에서 `extraSearch` 문자·길이·`m=` 중복 검증 필요. `parseSearch`는 `sort`·`free`도 받는데 제안서에 빠짐(언어 전환 시 사라짐).
- **008: 그대로(정정 3).** 플래그는 `SiteFrame`이 `getPage(page).comingSoon`으로 직접 읽음 -> 해제 안 하면 모든 Market 페이지 본문 위에 줄이 뜸. `comingSoon`은 선택 필드라 속성을 지워도 컴파일됨. 해제 커밋에서 `lib/site-frame.test.ts`의 `COMING_SOON`에서 `'market'`을 빼야 함(의도된 가드). 화면 확인은 `data-coming-soon="true"` 검색.
- **구현은 묶음 배포 뒤 착수 확정**(이유: `deploy:prod`가 미커밋 변경을 거부하고, 006·007·008이 `lib/site-nav.ts` 등 같은 파일을 건드림).
- 그 외 관찰(별개·기존): 접두사 없는 `/market/cart` 등은 `isSiteRoute`가 거짓이라 `x-oxxovo-locale`·`x-oxxovo-prefixed` 헤더를 지우지 않음 -> `enterSite`를 부르면 위조 헤더를 신뢰(영향은 요청자 본인 언어 정도). 해당 페이지 실존 여부는 확인 못 함.

### 1-7. 커밋 계획·단독 검증 (임시 폴더 방식, 레포 불변)
커밋 4개(TK님 명령 대기):
1. `fix(watch): open the competition surface on preview deployments only` -- `lib/watch-gate.ts`, `lib/watch-gate.test.ts`, `package.json`(watch-gate 등록만)
2. `feat(site): "Coming Soon" line on Market, Education, Jobs and AI Games` -- `lib/site-nav.ts`, `lib/site-nav.test.ts`, `lib/site-messages-en.ts`, `lib/site-frame.test.ts`, `app/_site/SiteFrame.tsx`, `app/_site/SectionPage.tsx`(주석만)
3. `feat(watch): noindex robots meta on the Watch pages until search_index_allowed is true` -- `app/watch/layout.tsx`, `lib/search-index.ts`, `lib/search-index.test.ts`, `package.json`(최종본), `reports/search_index_switch_2026-10-14.sql`
4. `docs: ...` -- `reports/site_launch_checklist.md`, `jisu_hq_2026-10-13_eod.md`, **이 파일**, `content_metadata_plan.md`, `promo_allowlist_draft.md`, `tournament_promo_plan.md`

`package.json` 테스트 목록이 한 줄이라 `git add -p` 불가 -> 변형 파일을 `git hash-object -w` + `git update-index --cacheinfo`로 스테이징. 커밋은 경로 지정(`git add -A` 금지). 커밋 4개 후 `git status`가 비어야 함.

검증 결과(HEAD 위에 해당 파일만 덮어쓴 임시 폴더, `node_modules`는 junction 후 `rmdir`로만 제거): 1만 930, 2만 927, 3만 932, 1+2 932, 1+3 937, 2+3 934, 최종 939(+`next build` 성공). 전부 `tsc` 0.

## 2. 본부 결정 (10-14)

| 항목 | 결정 |
|---|---|
| W4 | **안 함.** 시즌 게이트 fail-closed + 리허설 전시 의도 |
| watch 열기 직전 | ③ 0행 + `search_index_allowed` 미설정 확인 + A0-1·C2 |
| A-8 색인 | noindex 메타 + `search_index_allowed` 스위치(위 1-4) |
| Coming Soon | 4곳 명시 플래그, 문구는 사전 키 한 개, 자동 구분 금지 |
| 커밋 | 3갈래 코드 + 문서는 별도 커밋(4개) |
| 마켓 006·007·008 | 구현은 묶음 배포 후, 마켓 제니에게는 본부가 전달 |
| 크론 | 이상 없음으로 닫음 |

## 3. 로컬 미커밋 (HEAD `c9126a9`)

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
?? reports/ 문서 7건(체크리스트, search_index SQL, EOD 10-13·10-14, content_metadata_plan, promo_allowlist_draft, tournament_promo_plan)
```
`deploy:prod`는 미커밋·untracked가 있으면 거부하므로 위를 전부 커밋. 제외: `reports/coming_soon_shots/`(`.git/info/exclude`).
**주의: `.vercelignore`는 `reports/`를 제외하지 않으므로 `vercel deploy`(프리뷰)는 로컬 PNG(484KB)를 같이 올린다 -- 프리뷰 전에 폴더를 옮기거나 지울 것.**

## 4. 다음 일 (순서)

1. **TK님: 커밋 4개 명령 -> push -> `npm run deploy:prod`.** 배포 후: `✓ live version (try N)`, `/api/version` 새 SHA, 크론은 **content-dispatch** `:x0:14`/`:x5:14`가 새 `deploymentId`로 `no_open_dba`·`processed:0`·`warnings:[]`.
2. (선택) P1 프리뷰 배포 -> TK님이 프리뷰 `/watch`를 로그인 뒤 확인(페이지 소스에 noindex 메타, 좋아요·투표·댓글 금지). 프리뷰 전 `coming_soon_shots` 정리.
3. **배포 다음 날 이후**(A0-1: 마지막 배포 후 2시간 + 새 id 틱 3회 통과, 켜는 날 배포 금지): W1(③)=0행, W3(`search_index_allowed` 미설정) 확인 -> `competition_publication_enabled` 켜기(TK님 승인) -> 켠 직후 확인(익명 `/watch` 200, noindex 메타, 가짜 팀명 0건, 숨긴 행 `/watch/<id>` 404, `/api/watch/stats`, `/ko/watch` 404, 크론, 닫는 SQL).
4. 배포 후 착수: 마켓 006·007·008 구현(본부 검토 반영본).
5. ⑩(뉴스 송출 시험)은 뉴스 PC 대기, 변경 없음. 시작 전 A0-1·`pg_trigger`·A5·A6.

## 5. TK님·본부 결정 대기
- 커밋 4개·push·`deploy:prod` 명령(TK님).
- A0-1에 `(content-dispatch, 5분 간격)` 한 구절 추가(본부 승인 후).
- 캡처 스타일(배너 안 중앙 배치 여부)·ko 문구(제니3).
- `search_index_allowed` 키 INSERT를 할지(안 해도 noindex 유지), 색인 허용 시점·기준(본부).
- 체크리스트 A-2(배너)·A-5(슬러그)·A-6(약관)·A-9(`/welcome`·Tournament)·B-1(`release_weekday`), 제니3 문구, 제니2 장르 목록, 뉴스 ⑩ 수입, 마켓 질문, `season_test` 날짜 재설정.

## 6. 오늘의 교훈 · 한계 (성공만 적지 않는다)
1. **크론 이름을 안 적어서 오귀속**: 10-13 EOD가 `no_open_dba` 틱의 크론을 안 적었고, 나는 같은 날 보고에서 season-tick 응답으로 잘못 말했다. 로그 stage 문자열은 코드에서 출처(`lib/content-dispatch.ts`)를 먼저 찾을 것.
2. **훼손 시험 하나가 살아남음**(`catch`에서 `true` 반환): "닫힌 포트"는 던지는 게 아니라 `error`로 돌려준다. 훼손 결과가 0이면 시험이 그 경로를 안 타는 것이라는 신호로 읽고 경로별 시험을 추가했다.
3. **heredoc 백슬래시·따옴표 문제 반복**: 파이썬/노드 정규식의 `\\`가 셸에서 `\`로 줄어 구문 오류가 두 번(테스트 파일·스크립트), 긴 EOD heredoc은 따옴표 오류로 실패해 Write 도구로 다시 썼다. 여러 줄·백슬래시가 있는 코드는 처음부터 편집/쓰기 도구로.
4. **지시 전달 어긋남**: Coming Soon 지시(A-3 변경)와 캡처 8장 지시를 이 세션은 받은 적이 없다고 보고했고, 본부는 보냈다고 알고 있었다(전달 누락). 결정이 기존 기록(A-3 "Coming Soon 없음")과 충돌하면 코드로 현재 상태를 대조해 알리고 시작하지 않는 것이 맞았다.
5. **한계(검증 못 한 것)**:
   - 크론 틱을 직접 읽지 못함(TK님 대시보드 확인에 의존). season-tick의 정상 응답 형식·대시보드 Logs에서 안 걸리는 이유 모름.
   - `/watch/[id]` 실제 행으로 noindex 메타를 본 적 없음(구조상 같은 layout).
   - `search_index_allowed`의 라이브 `platform_config` 제약(`value_type`) 안 읽음.
   - 캡처 8장 중 5장은 육안 확인 안 함, 폰트는 실제와 다름. 프리뷰·라이브 `/watch` 화면은 여전히 본 적 없음.
   - `next build`는 최종 상태에서만 돌림(조합별 아님).
   - 마켓 쪽 코드는 제안서 문서와 `parseSearch` 일부만 읽음. 마켓 `/market/cart` 등 실존 여부 미확인.
   - ② SQL의 필터 부재는 본부가 원문을 확인해 줌(내가 직접 본 것은 아님).
