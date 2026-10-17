# 새 사이트 공개 켜기 체크리스트 (초안)

작성: 지수(메인, 앱 레포), 2026-10-12(PT). **계획·초안입니다. 로컬 작성, 커밋·푸시·배포·SQL 실행 없음.**
앞 단계(배포·`/ko` 수정)는 끝났고 라이브는 `c9126a9`(새 사이트 코드 올라감, `watch_as_home`은 꺼진 채)입니다. 이 문서는 **스위치를 켜는 날** 쓰는 표입니다. 배포 전 점검표(`site_predeploy_checklist_2026-10-11.md`)의 6·7절을 대체하지 않고, 그 위에 "켜기 전에 끝나야 하는 것"을 모읍니다.

**읽는 법**
- 담당: 🅣 TK님 · 🅗 본부 · 🅙 지수 · 🅩2 제니2(엔터) · 🅩3 제니3(문구) · 🅝 뉴스 제니 · 🅜 마켓 제니
- 상태는 **내가 아는 근거와 함께** 적습니다. 라이브 DB·어드민을 이번에 직접 읽은 것이 아니면 "미확인"이라고 씁니다.
- "필수"는 안 끝나면 켜지 않는 것, "결정"은 TK님이 정해야 진행되는 것입니다.

## 0. 먼저 알아둘 구조 (코드로 확인한 사실)

- **스위치가 여럿이고 서로 독립입니다.** 켜는 것은 `watch_as_home`(새 홈·7페이지·`/ko` 전체), 콘텐츠 공개는 `news_publication_enabled`·`entertainment_publication_enabled`(+ 종류별 `content_path_<kind>`), 대회 카드는 `competition_publication_enabled` **AND** Production 환경변수 `WATCH_PUBLIC_ENABLED=true`(`lib/watch-gate.ts`의 `isCompetitionWatchPublic`).
- **콘텐츠 상세 `/c/<id>`·`/<slug>/<id>`는 `watch_as_home`과 무관하게** 공개 스위치와 slug만으로 열립니다. 즉 새 사이트를 안 켜도 콘텐츠 페이지는 열 수 있고, 반대로 새 사이트를 켜도 공개 스위치가 닫혀 있으면 카드는 빈 틀입니다.
- **배너는 DB 행 + R2 파일 두 가지가 다 있어야** 나옵니다. 행(`banner_<page>`)이 없거나 값이 규격에 안 맞으면(1920×1080 미만, 16:9 ±2% 밖, `R2_PUBLIC_BASE` 호스트가 아닌 주소) 조용히 기본 그라데이션입니다. 에러가 안 납니다 -- **"안 나온다"가 곧 이상 신호는 아닙니다.**
- 슬러그가 없거나 잘못되거나 두 종류가 같은 슬러그를 쓰면 그 종류의 공개 경로는 없습니다(404, fail-closed). 새 페이지 이름(`daily`·`market` 등)은 예약어라 슬러그로 못 씁니다.
- "AI-generated" 문구가 **코드 두 곳**에 있습니다: 공개 상세 페이지(`lib/content-public-text.ts`의 `aiGenerated`)와 카드(`lib/site-messages-en.ts`의 `card.aiGenerated`). 제니3이 문구를 확정하면 둘 다 바꿔야 합니다.

## 결정 기록

| 날짜 | 결정 | 결정자 |
|---|---|---|
| 2026-10-12 | 켜는 날 배포 금지, A0-1 개정 기준 적용(C2) | 본부 |
| 2026-10-12 | 켜는 순서 = 콘텐츠 공개 -> 새 사이트 -> 대회(§3) | 본부 |
| 이전 | 빈 섹션은 빈 틀 그대로, Coming Soon 문구 안 씀(A3-b) -- **10-13 변경: Market·Education·Jobs·AI Games 4곳만 "Coming Soon" 한 줄** | TK님 |
| 대기 | 배너 없이 켜기(B1), 슬러그(B4), 약관 전 뉴스 공개(A4), 프리뷰 확인(C4), 색인(C5), `/welcome`·Tournament(C6) | TK님 |

## 1. 켜기 전에 끝나야 하는 것

### A. 문구·법무 (코드 문제 아님)

| # | 항목 | 담당 | 현재 상태 | 확인 방법 | 구분 |
|---|---|---|---|---|---|
| A1 | 제니3 새 사이트 문구(섹션 제목·부제, 홈 Hero 영어 오른쪽 문장 `hero.sub`, `/ko` 상단 메뉴·섹션 이름) | 🅩3 | **대기.** 요청서 `reports/copy_requests_site_2026-10-11.md`. 영어 `hero.sub`는 비어 있음(배포 점검표 6절), 한국어는 왼쪽 메뉴·Hero만 한국어 | 확정본을 받아 `lib/site-messages-en.ts`·`-ko.ts`에 반영 -> `npm test`(문구 시험) -> 화면. **내가 쓰지 않는다**(문안은 제니3 소관) | 필수 |
| A2 | AI 생성물 표기(플랫폼별·사이트 공개 문구) | 🅩3 | **대기**(10-05~10-11 EOD에 계속 이월). 현재 코드값은 임시 영어 `AI-generated` | 확정 문구를 §0의 코드 두 곳에 반영, 카드와 `/c/<id>` 양쪽에서 같은 문구가 보이는지 | 필수 |
| A3 | 공개 화면 문구(`lib/content-public-text.ts`의 `emptyList`·`back`·`videoUnavailable`·`published`) | 🅩3 | **대기.** 파일 머리 주석이 "스위치를 켜기 전 임시값 교체"를 점검 항목으로 못박음 | 파일에 임시 표시가 남았는지 눈으로 읽기 | 필수 |
| A4 | ElevenLabs·Hedra 상업 이용 약관 확인 | 🅝🅩2(확인), 🅣(판단) | **미확인**(설계서 §4-4, 10-04 이후 매 EOD 이월). 확인 전 뉴스는 전부 `held`, ⑩ 1건만 TK님이 비공개로 감수 승인(10-10) | 확인 결과를 설계서·EOD에 기록. 확인 전이면 **뉴스 공개 스위치는 열지 않는다**(엔터는 별도 판단) | 필수(뉴스) |
| A3-b | 빈 섹션을 그대로 보여도 되는가(Market·Education·Jobs·AI Games·Tournament은 데이터·광고 영상이 아직 없음) | 🅣 | **변경(TK님 10-13, 본부 전달 10-14): Market·Education·Jobs·AI Games 4곳에만 "Coming Soon" 한 줄(영어 그대로, `/ko`도 같은 영어 문구 -- 한국어는 제니3 확정 뒤), Tournament·Daily·Entertainment·홈은 글자 없는 빈 틀.** 구현: `lib/site-nav.ts`의 `comingSoon: true`(명시 플래그, 데이터로 자동 구분하지 않음) + 문구 키 `page.comingSoon`. 로컬 완료·미커밋·미배포. 소스를 붙이는 커밋에서 플래그를 지울 것. **칩 모양(본부 확정 10-15): 배너 박스 안 가운데(`SiteFrame.tsx`의 `absolute inset-0 flex items-center justify-center`, 마크업 직접 확인), 글자색 `#f4f0ff`, 배경 `bg-black/65`, 4개 페이지.** 칩은 배너 이미지 유무와 상관없이 항상 그려진다(기본 그라데이션 위에서는 거의 안 보이고, 이미지 위에서 글자를 읽히게 함) | 켜기 직전 4곳에 한 줄이 있고 나머지 페이지엔 임의 문구가 없는지 눈으로 | 확정 |

### B. 데이터·설정

| # | 항목 | 담당 | 현재 상태 | 확인 방법 | 구분 |
|---|---|---|---|---|---|
| B1 | 배너 이미지 8장(홈·Tournament·Entertainment·Daily·Market·Education·Jobs·AI Games). 글자 없는 원본, ≥1920×1080, 16:9, WebP/JPEG, 실제 회사 로고 금지 | Entertainment·Tournament·홈·Education·Jobs·Games = 🅩2, Daily = 🅝, Market = 🅜 | **없음.** 제니2·뉴스 쪽은 현재 작업 불가(10-12 본부 전달). 시안 크롭 샘플은 검토용일 뿐 사용 불가(해상도 부족, 시안 출처) | 파일을 받아 규격 검사(`parseBanner` 기준) -> R2 업로드 -> B2 | 필수(아니면 그라데이션으로 켜는 것을 TK님이 결정) |
| B1-b | 배너 규격 추가 기준(본부 전달 10-15): 16:9, 최소 1920×1080, **21:9 박스는 가운데 크롭**, **칩 영역 x 590~1330 · y 430~650(1920×1080 기준)** 에는 글자·로고·핵심 피사체를 두지 않는다. 안전영역 시안: `reports/banner_safe_area_guide_v2.png` | 🅙(문서), 제작은 B1 담당 | 규격 수치는 본부 전달값. 이 세션이 확인한 것은 산술뿐: 칩 영역 중심이 (960, 540)이고, 21:9 크롭(1920×823)의 세로 범위 약 128~952 안에 칩 영역 430~650이 들어간다. 이미지 실측·실제 칩 크기와의 일치는 미확인 | 파일 수령 시 `parseBanner` 규격 + 안전영역 가이드 위에 겹쳐 눈으로 | 참고 |
| B2 | `platform_config` 행 `banner_<page>` 8개 | 🅙(SQL 초안), 🅣(Run) | **없음**(배포 점검표 8절 4번: 배너 행은 파일이 올 때 넣는 선택 작업). 8개 키: `banner_home` `banner_tournament` `banner_entertainment` `banner_daily` `banner_market` `banner_education` `banner_jobs` `banner_games` | 2절 R1로 존재 확인 -> "배너 키 만들기"·"배너 값 채우기" 블록 -> R1 다시 -> 화면에 이미지 | 선택(B1과 같이) |
| B3 | `R2_PUBLIC_BASE` 값 | 🅣 | **이름만 확인**(10-12 `vercel env ls production`, Production 전용, 값은 안 봄). 값이 올바른 R2 공개 주소인지는 **미확인**. 프리뷰에는 없음 | 첫 배너를 올리는 날 그 이미지가 실제로 뜨는지로 확인. 배너 주소의 호스트가 이 값의 호스트와 같아야 함 | 필수(배너·콘텐츠 썸네일) |
| B4 | `content_path_<kind>` 6개(`news` `drama` `film` `cf` `music` `music_video`)와 슬러그 결정 | 🅣(결정), 🅙(SQL) | **슬러그 미결정, 행 없음.** 안: `news` `drama` `film` `cf`(또는 `ads`) `music` `music-video`(설계서 §7). 예약어와 충돌 없음 | 결정 후 2절 R1 -> 6개 블록 -> 한 종류씩 `https://www.oxxovo.ai/<slug>/<콘텐츠 id>`가 200/404인지(공개 스위치 상태에 따라) | 필수(콘텐츠 공개 시) |
| B5 | `news_publication_enabled` · `entertainment_publication_enabled` | 🅣 | 둘 다 `false`로 알고 있음(⑩ 실행표 A3 기대값). **이번에 읽지 않음** | R2 블록으로 읽기 | 켜는 순서는 3절 |
| B6 | 콘텐츠가 **공개 가능한** 상태로 있는가: `status` scheduled/…, `rights_status=cleared`, 영상 `main_*` 있음, 썸네일(선택) | 🅝🅩2 | 라이브 `contents`에 있는 행은 `probe-` 시험 행들과 ⑩ 시험 행뿐으로 알고 있음(**미확인**). 공개 가능한 진짜 콘텐츠가 0건일 수 있음 | 읽기 SQL로 종류별 공개 가능 건수 확인(내가 별도 초안 가능) | 필수 -- **0건이면 켜도 빈 틀** |
| B7 | 대회 카드(홈) 노출: ① `WATCH_PUBLIC_ENABLED=true`(Production 환경변수, 켜려면 재배포 필요) ② `competition_publication_enabled=true` ③ 날짜 잡힌 비-fixture 시즌 ④ TK님이 호버 설명 문장을 눈으로 보고 승인 | 🅣🅗🅙 | **전부 미진행.** 시즌 날짜가 잡힌 비-fixture 시즌 0개(10-12 SQL 실측). 단계별 count·호버 설명 SQL 두 개를 시즌 날짜를 다시 잡는 날 TK님이 Run하기로 결정(점검표 3-2절) | 그 두 SQL을 다시 돌려 `cur_id`가 잡히고 설명이 보이는지 | 대회를 켜는 날만 필수. **새 사이트를 먼저 켤 땐 대회 카드 0건이 정상** |
| B8 | 공개 컬럼·공개 문 라이브 검증 | 🅙 | **완료**(`probe-public-columns.mjs` PASS 10/10, 10-07). 이후 썸네일 컬럼 4개도 `pg_attribute`로 확인(10-12) | 재확인 불필요(코드가 바뀌면 다시) | 완료 |
| B9 | **홍보영상을 재사용한 `season_test` 참가작 행 처리**(가짜 팀명으로 감싼 홍보 파일). P3(10-12): 홍보 파일을 쓰는 참가작 행 **60건 전부 `season_test`**, 그중 `watch_hidden=false` **16행**(pending 1·rejected 9·main_round_submitted 6), `true` 44행(eligible 18·pending 26) | 🅣(승인·Run), 🅙(SQL) | **미처리.** 지금 `/watch`가 닫혀 있고 `season_test`가 픽스처 시즌이라 시즌 가드가 막고 있으나, **이 16행의 `watch_hidden`은 가드가 아니라 우연히 열려 있는 상태**(8/28 결정: 리허설 전시 때문에 재잠금하지 않음). 이 행들이 `/watch`에 뜨는 유일한 조건 = `season_test`의 `is_fixture`가 false가 되거나 `watch_fixture_visible`이 true가 되는 것(8/31 확인 시 false, **지금은 미확인**) | 2절 C1로 `season_test` 플래그 확인 -> C2로 16행 목록 확인 -> TK님이 처리 방식 승인 -> C3(숨김) -> C4(되읽기). **대회 공개 스위치와 `WATCH_PUBLIC_ENABLED`를 켜기 전 필수** | 필수(대회를 켜는 날) |

### C. 코드·라이브 상태

| # | 항목 | 담당 | 현재 상태 | 확인 방법 | 구분 |
|---|---|---|---|---|---|
| C1 | 라이브 SHA = 켜는 날 시작 시점 SHA, `dirty:false` | 🅙 | 오늘 기준 `c9126a9`, 크론 틱 새 배포 id로 연속 `no_open_dba` | `/api/version` + 크론 로그 | 필수 |
| C2 | 켜는 날에는 **배포하지 않는다**(⑩ A0 규칙의 취지를 켜기에도 적용) | 🅗 | **확정(본부 2026-10-12): 켜는 날 배포 금지, A0-1 개정 기준 적용.** 이유: 켜고 나서 문제가 났을 때 원인이 배포인지 스위치인지 가려지지 않음 | 켜기 전 A0-1 개정 기준(마지막 배포 후 2시간 이상 + 새 id 틱 연속 3회) 통과 | 확정 |
| C3 | `/ko`가 스위치 꺼짐에서 404 | 🅙 | **완료·라이브**(`c9126a9` 실측 404) | 켜기 직전 한 번 더 | 완료 |
| C4 | 프리뷰에서 TK님이 "완성 모습"을 눈으로 확인 | 🅣 | 프리뷰 `dpl_BSN2GqikHF4unMYT3HLtb6Ryy41q`(Vercel 로그인 뒤). **TK님이 아직 보셨는지는 모름.** 프리뷰에는 `R2_PUBLIC_BASE`가 없어 배너는 그라데이션, 대회 카드 0건 | TK님 판단 | 결정 |
| C5 | 색인 정책 | 🅗 | **결정(본부 10-14, A-8):** `/watch`·`/watch/[id]`·`/watch/rankings`에 noindex 메타, `robots.txt`는 `Allow: /` 그대로, 스위치 `platform_config.search_index_allowed`('true'일 때만 색인 허용, 미설정·읽기 실패·그 외 값 = noindex). 사이트맵은 **없음 확인**(`app/sitemap*` 없음, 코드 참조 없음). `/watch-arena`는 열리면 `/watch`로 308이라 별도 처리 불필요 | C7 | 결정 |
| C7 | noindex 코드가 프로덕션에 먼저 나가 있음(`app/watch/layout.tsx`, `lib/search-index.ts`) | 🅙🅣 | **로컬 완료·미커밋·미배포.** 테스트 통과·훼손 확인됨. 배포는 P1·Coming Soon과 같은 묶음으로 TK님 명령, **watch 켜기는 그 다음 날 이후** | 프로덕션 `/watch`는 닫혀 있어 켜기 전엔 메타를 볼 수 없다. 프리뷰 `/watch`(TK님 로그인)의 페이지 소스에 `<meta name="robots" content="noindex, nofollow">`가 있는지로 확인하고, 켠 직후 익명 `curl`로 다시 확인 | 필수 |
| C6 | 홈의 `/welcome`(구 랜딩) 처리와 Tournament 빈 페이지(광고 영상 자리) | 🅣 | 결정 사항으로 남아 있음(배포 점검표 6절). 켜면 `/competition`은 200 빈 페이지, 대회가 공개되면 `/watch`로 이동 | 켜기 전에 TK님이 허용 여부 확인 | 결정 |

## 2. SQL 초안 (실행 금지, TK님이 Run할 때 채팅 본문으로 다시 줍니다)

규칙: **한 블록 = 쿼리 하나 = 키 하나**, 전부 한 줄, 주석 없음, ASCII만, `returning` 포함. 값은 비워 둔 자리입니다. 만드는 블록은 `on conflict do nothing`이라 **다시 Run해도 기존 값을 덮어쓰지 않습니다.** 빈 값 행은 코드가 "없음"으로 읽습니다(배너는 기본 그라데이션 `parseBanner`, 슬러그는 경로 없음 `parseContentPaths`로 확인).

**읽기 (먼저)**

R1. 배너·슬러그 키 현황
```sql
select key, value, value_type, updated_at from public.platform_config where key ~ '^(banner|content_path)_' order by key;
```

R2. 스위치 현황
```sql
select key, value, value_type, updated_at from public.platform_config where key in ('watch_as_home', 'news_publication_enabled', 'entertainment_publication_enabled', 'competition_publication_enabled') order by key;
```

**배너 키 만들기 (8개, 값 비움)**

```sql
insert into public.platform_config (key, value, value_type, description) values ('banner_home', '', 'text', 'Page banner for home as JSON with url, width and height. Empty means the default gradient.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```
```sql
insert into public.platform_config (key, value, value_type, description) values ('banner_tournament', '', 'text', 'Page banner for tournament as JSON with url, width and height. Empty means the default gradient.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```
```sql
insert into public.platform_config (key, value, value_type, description) values ('banner_entertainment', '', 'text', 'Page banner for entertainment as JSON with url, width and height. Empty means the default gradient.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```
```sql
insert into public.platform_config (key, value, value_type, description) values ('banner_daily', '', 'text', 'Page banner for daily as JSON with url, width and height. Empty means the default gradient.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```
```sql
insert into public.platform_config (key, value, value_type, description) values ('banner_market', '', 'text', 'Page banner for market as JSON with url, width and height. Empty means the default gradient.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```
```sql
insert into public.platform_config (key, value, value_type, description) values ('banner_education', '', 'text', 'Page banner for education as JSON with url, width and height. Empty means the default gradient.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```
```sql
insert into public.platform_config (key, value, value_type, description) values ('banner_jobs', '', 'text', 'Page banner for jobs as JSON with url, width and height. Empty means the default gradient.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```
```sql
insert into public.platform_config (key, value, value_type, description) values ('banner_games', '', 'text', 'Page banner for games as JSON with url, width and height. Empty means the default gradient.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```

**배너 값 채우기 (파일이 R2에 올라온 뒤, 키마다 한 번)** -- `<...>` 자리를 채운 뒤에만 Run. 주소의 호스트는 `R2_PUBLIC_BASE`와 같아야 하고 `width`·`height`는 실제 파일 크기(≥1920, ≥1080, 16:9 ±2%).
```sql
update public.platform_config set value = '{"url":"https://<R2 public host>/<path>.webp","width":1920,"height":1080}' where key = 'banner_home' returning key, value, updated_at;
```

**콘텐츠 슬러그 키 만들기 (6개, 값 비움)**

```sql
insert into public.platform_config (key, value, value_type, description) values ('content_path_news', '', 'text', 'Public path slug for news content. Empty means no public path.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```
```sql
insert into public.platform_config (key, value, value_type, description) values ('content_path_drama', '', 'text', 'Public path slug for drama content. Empty means no public path.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```
```sql
insert into public.platform_config (key, value, value_type, description) values ('content_path_film', '', 'text', 'Public path slug for film content. Empty means no public path.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```
```sql
insert into public.platform_config (key, value, value_type, description) values ('content_path_cf', '', 'text', 'Public path slug for cf content. Empty means no public path.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```
```sql
insert into public.platform_config (key, value, value_type, description) values ('content_path_music', '', 'text', 'Public path slug for music content. Empty means no public path.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```
```sql
insert into public.platform_config (key, value, value_type, description) values ('content_path_music_video', '', 'text', 'Public path slug for music video content. Empty means no public path.') on conflict (key) do nothing returning key, value, value_type, updated_at;
```

**슬러그 값 채우기 (TK님이 슬러그를 정한 뒤, 키마다 한 번)** -- 소문자·숫자·하이픈, 2~40자, 예약어 아님, 다른 종류와 겹치지 않음.
```sql
update public.platform_config set value = '<slug>' where key = 'content_path_news' returning key, value, updated_at;
```

**대회를 켜기 전: 홍보영상 재사용 참가작 처리 (B9) -- 전부 TK님 승인 후, 지수는 실행하지 않음**

처리 방식(추천 순):
1. **가드 확인 + 숨김 둘 다(추천).** `season_test`가 `is_fixture=true`·`watch_fixture_visible=false`인지 확인(C1)하고, 승인을 받아 16행을 `watch_hidden=true`로 숨긴다. 이렇게 하면 시즌 가드와 행 가드 두 겹이 된다. 데이터는 지우지 않고 값 하나만 바꾼다(되돌리기 가능).
2. 가드 확인만. 시즌 플래그가 맞으면 지금도 노출되지 않는다. 단 8/17 사고(#39, 51편 노출)가 정확히 "행 단위 블랙리스트에만 기대다 새 시즌 행이 뚫린" 경로였다.
3. 코드로 "홍보 파일 키를 쓰는 행은 작성자 이름·제목을 공식 홍보 라벨로 덮어쓴다"(`reports/lane_c_item6_promo_reuse_rule_2026-08-10.md` 설계). 대회 코드를 건드리므로 **지금은 비추**.

주의: 이 행들은 **리허설 전시용으로 일부러 열어 둔 것**일 수 있고(8/28 EOD: 9/9~10/14 전시 기간 중 STEP을 돌리지 말 것), Watch 노출 데이터를 숨기는 일은 TK님 승인이 필요하다. 다음 리허설에서 이 행들을 다시 보이게 하려면 `watch_hidden`을 되돌려야 한다. SQL로 직접 바꾸면 `/watch` 캐시(`unstable_cache`, TTL)가 즉시 갱신되지 않을 수 있다(`/watch`가 닫혀 있는 동안은 무관).

C1. `season_test` 플래그
```sql
select id, season_number, is_fixture, watch_fixture_visible, application_open_at from public.seasons where id = 'season_test';
```

C2. 숨겨지지 않은 홍보 재사용 행 목록 (첫 줄 영상과 본선 영상 둘 다 대조, 읽기 전용)
```sql
select a.id, a.season_id, a.status, a.watch_hidden, a.watch_hold, a.moderation_status, a.creator_name, a.video_title, p.id as promo_id from public.genesis_applications a join public.promo_videos p on regexp_replace(coalesce(a.free_entry_url, ''), '^https?://[^/]+/', '') = regexp_replace(p.video_url, '^https?://[^/]+/', '') or regexp_replace(coalesce(a.main_round_video_url, ''), '^https?://[^/]+/', '') = regexp_replace(p.video_url, '^https?://[^/]+/', '') where not coalesce(a.watch_hidden, false) order by a.status, a.id;
```
(P3은 첫 줄 영상만 대조했다. 위 쿼리는 본선 영상도 대조하므로 건수가 16보다 클 수 있다. 홍보 `video_url`이 비어 있는 행이 있으면 빈 문자열끼리 일치하지 않도록 `coalesce`를 썼으나 `p.video_url`이 NULL인 행은 대조에서 빠진다.)

C3. 숨기기 (쓰기 -- 승인 후 Run. CTE 사용, `returning`으로 바뀐 행 확인)
```sql
with t as (select a.id from public.genesis_applications a join public.promo_videos p on regexp_replace(coalesce(a.free_entry_url, ''), '^https?://[^/]+/', '') = regexp_replace(p.video_url, '^https?://[^/]+/', '') or regexp_replace(coalesce(a.main_round_video_url, ''), '^https?://[^/]+/', '') = regexp_replace(p.video_url, '^https?://[^/]+/', '') where a.season_id = 'season_test' and not coalesce(a.watch_hidden, false)) update public.genesis_applications g set watch_hidden = true, watch_hidden_at = now(), watch_hidden_reason = 'promo file reused as a fake entry (season_test)' from t where g.id = t.id returning g.id, g.season_id, g.status, g.watch_hidden;
```
`watch_hidden_at`·`watch_hidden_reason` 칼럼 이름은 10-07 카탈로그 기록으로 알고 있으나(`watch_hidden` 외 `_at`·`_reason`) 형식은 읽지 않았다. 에러가 나면 이 두 칼럼을 빼고 다시 준다. 한 블록에 `season_test`만 대상으로 한정했다.

C4. 되읽기 (읽기 전용): 0이어야 함
```sql
select count(*) as still_visible from public.genesis_applications a join public.promo_videos p on regexp_replace(coalesce(a.free_entry_url, ''), '^https?://[^/]+/', '') = regexp_replace(p.video_url, '^https?://[^/]+/', '') or regexp_replace(coalesce(a.main_round_video_url, ''), '^https?://[^/]+/', '') = regexp_replace(p.video_url, '^https?://[^/]+/', '') where not coalesce(a.watch_hidden, false);
```

되돌리기 (**비상·리허설 재개 전용, 위 숨기기와 같은 자리에 섞어 쓰지 않는다**): 숨길 때 넣은 사유로만 골라 푼다.
```sql
update public.genesis_applications set watch_hidden = false where watch_hidden_reason = 'promo file reused as a fake entry (season_test)' returning id, season_id, status, watch_hidden;
```

**스위치 열기 (3절 순서대로, 하나씩)**
```sql
update public.platform_config set value = 'true' where key = 'news_publication_enabled' returning key, value, updated_at;
```
```sql
update public.platform_config set value = 'true' where key = 'entertainment_publication_enabled' returning key, value, updated_at;
```
```sql
update public.platform_config set value = 'true' where key = 'watch_as_home' returning key, value, updated_at;
```
`watch_as_home`은 어드민 `https://www.oxxovo.ai/admin/watch-home` 토글로 켜도 같습니다(그쪽이 변경 이력이 남는 경로일 수 있음 -- 확인 안 함). 대회 스위치(`competition_publication_enabled`)와 `WATCH_PUBLIC_ENABLED`는 B7의 별도 날에 다룹니다.

**스위치 끄기 -- 비상 전용 (열기 블록과 같은 자리에 섞어 쓰지 않는다)**
```sql
update public.platform_config set value = 'false' where key = 'watch_as_home' returning key, value, updated_at;
```
```sql
update public.platform_config set value = 'false' where key = 'news_publication_enabled' returning key, value, updated_at;
```
```sql
update public.platform_config set value = 'false' where key = 'entertainment_publication_enabled' returning key, value, updated_at;
```

**되읽기:** 위 블록 뒤 R2를 다시 Run해 값과 `updated_at`을 봅니다(`returning`이 이미 바뀐 행을 보여 주지만 한 번 더).

한계: 이 초안의 `description` 영어 문구와 `value_type='text'`는 기존 행(`watch_as_home`은 `text`, 다른 스위치는 `bool`)을 보고 정한 것으로 라이브 `platform_config`의 제약은 읽어 보지 않았습니다. 첫 블록이 에러를 내면 에러 문구를 그대로 가져옵니다.

## 3. 켜는 순서와 켠 직후 확인, 끄는 법

### 켜는 순서 (본부 확정 2026-10-12: 콘텐츠 -> 새 사이트 -> 대회)

**전제 -- 아래가 끝나 있어야 시작:** A1·A2·A3, B3, C1, C2, 그리고 시작 직전 R1·R2 읽기.

1. **(켜는 날 전) 준비:** B1 배너 파일 -> R2 업로드 -> 배너 키 만들기·채우기. 슬러그 결정 -> 슬러그 키 만들기·채우기. **둘 다 켜지 않은 상태에서 끝낸다**(행만 있으면 보이는 것이 없음).
2. **콘텐츠 공개(한 DBA씩):** 슬러그가 있는 종류에 한해 해당 DBA의 `*_publication_enabled`를 연다. **뉴스는 A4(약관) 전에는 열지 않는다.** 한 DBA를 열면 그 응답 본문을 먼저 확인(아래 "콘텐츠 직후")한 뒤 다음으로.
3. **새 사이트(`watch_as_home`):** 콘텐츠 공개 뒤에 켠다. 켠 뒤에도 공개 가능한 콘텐츠가 없는 섹션은 빈 틀로 나온다(빈 틀. 단 Market·Education·Jobs·AI Games 4곳은 "Coming Soon" 한 줄 -- A3-b, 10-13 변경). 새 사이트를 콘텐츠보다 먼저 켜지 않는다.
4. **대회 카드:** 별도 날(B7). 새 사이트를 먼저 켠 뒤에 켠다.

이유: 스위치를 한 번에 하나씩 열면 문제가 났을 때 원인이 하나로 좁혀지고, 끄는 것도 그 하나만 끄면 됩니다.

### 켜자마자 확인 (스위치 하나를 연 직후마다)

**콘텐츠 공개 직후 (읽기, 설계서 §7-3 마지막 항목)**
- 목록·상세 응답 본문에 `script` `sha256` `source_ref` `caption` `rights_reason` `upstream` 이 **0건**: `curl -s https://www.oxxovo.ai/<slug>/<id> | grep -ci "sha256\|source_ref\|rights_reason\|upstream"` -> 0
- `/c/<id>`가 **308**이고 `location`이 `/<slug>/<id>`(헤더 직접 확인).
- **보류(held) 콘텐츠의 `/c/<id>`와 존재하지 않는 id의 `/c/<id>`가 본문까지 같은 404**(존재 여부가 새지 않음). 비교용 id는 시험 행(10-07 EOD 7절).
- 영상 주소가 목록에 없음: 카드 HTML에 `.mp4` 0건. 썸네일이 있는 카드의 `<img src>`가 `https://` R2 공개 주소.
- 상세 페이지에 AI 표기(A2 문구)가 있음.
- 공개 안 된 상태(`hidden`·`blocked`·`returned` 등)의 항목이 목록에 없음.

**새 사이트 직후 (배포 점검표 7절 1~15번을 그대로 쓴다)** 요약: `/` 새 홈 200, 7개 페이지 200, `/ko` `lang="ko"` 래퍼, 언어 감지 307/200, 위조 헤더 무시, hreflang `en`·`ko`·`x-default`, 기존 `/watch` `/tournament` `/studio` 그대로, 크론 틱 `no_open_dba`. 추가로:
- 배너가 설정한 페이지에서 이미지로 나오는지(`data-banner="image"`), 안 나오면 JSON·크기·호스트부터(에러 없이 기본값으로 떨어짐).
- 모바일 폭 홈 Featured 가로 스크롤, 섹션 메뉴 한 줄.

### watch(대회)를 켜기 직전 읽기 -- 전부 통과해야 열기 (본부 확정 2026-10-14)

열기 조건 (모두): **③이 0행**, **`search_index_allowed`가 미설정(0행) 또는 `'false'`**, 그리고 위 C1(배포 후 2시간 + 새 id 틱 3회)·C2(켜는 날 배포 금지)·C7(noindex 배포가 전날 이전).

W1. **③ 시즌 게이트까지 통과해 실제로 공개될 행** -- 0행이어야 열기. 행이 나오면 열지 않고 어느 시즌·어느 행인지 본부에 보고.
```sql
select a.id, a.season_id, a.status, a.watch_hidden, a.watch_hold, a.moderation_status, a.creator_name, a.video_title, left(a.video_description, 60) as desc60 from public.genesis_applications a left join public.seasons s on s.id = a.season_id where (s.id is null or s.is_fixture is not true or s.watch_fixture_visible is true) and a.status <> 'flagged' and not coalesce(a.watch_hidden, false) and not coalesce(a.watch_hold, false) and a.moderation_status = 'approved' and (coalesce(trim(a.free_entry_url), '') <> '' or coalesce(trim(a.main_round_video_url), '') <> '') order by a.season_id, a.created_at limit 60;
```
W2. **② 시즌별 신청 행·공개 조건 통과 행 수(참고, 판독용)** -- `WHERE` 없음, `genesis_applications` 기준 `left join` + `group by`라서 시즌 id가 `NULL`인 고아 행이 있으면 별도 그룹으로 나온다(10-14 본부 확인: 이 SQL로 2그룹뿐, 고아 행 없음). 시즌 게이트가 막는 행(`is_fixture=true`이고 `watch_fixture_visible`이 false)은 `n_row_public`에 들어 있어도 노출되지 않는다.
```sql
select a.season_id, s.is_fixture, s.watch_fixture_visible, (s.id is null) as season_missing, count(*) as n_apps, count(*) filter (where a.status <> 'flagged' and not coalesce(a.watch_hidden, false) and not coalesce(a.watch_hold, false) and a.moderation_status = 'approved' and (coalesce(trim(a.free_entry_url), '') <> '' or coalesce(trim(a.main_round_video_url), '') <> '')) as n_row_public from public.genesis_applications a left join public.seasons s on s.id = a.season_id group by a.season_id, s.is_fixture, s.watch_fixture_visible, s.id order by a.season_id;
```
W3. **`search_index_allowed` 미설정 확인** -- 0행(키 없음) 또는 `value = false`이어야 열기. 코드가 fail-closed라 키가 없어도 noindex다. 키를 만들어 두려면 `reports/search_index_switch_2026-10-14.sql`의 BLOCK 1(본문은 채팅으로 전달).
```sql
select key, value, value_type, updated_at from public.platform_config where key = 'search_index_allowed';
```
**켠 직후 추가 확인 (색인):** 익명 `curl -s https://www.oxxovo.ai/watch | grep -io '<meta name="robots"[^>]*>'` 가 `noindex, nofollow`, `/watch/rankings`와 공개된 `/watch/<id>` 하나도 같다. `curl -s https://www.oxxovo.ai/robots.txt` 는 `Allow: /` 그대로(Disallow로 바꾸지 않는다 -- noindex를 못 읽게 됨).

**색인을 허용하는 날 (열기와 다른 날, 본부 결정 후):** `update public.platform_config set value = 'true' where key = 'search_index_allowed' returning key, value, updated_at;` -- 키가 없으면 0행이 갱신되므로 먼저 BLOCK 1로 키를 만든다. 허용 뒤 메타가 사라졌는지 같은 `curl`로 확인. 되돌릴 때는 `'false'`로.

한계: W1~W3와 위 업데이트는 이 문서 작성 시점에 지수가 실행하지 않았다(TK님 Run). `search_index_allowed` 행의 `value_type`을 `bool`로 한 것은 `competition_publication_enabled`의 선례를 따른 것으로 라이브 제약은 읽지 않았다. 본부 판독의 W1(③)·W2(②) 원문은 제니가 채팅으로 전달한 그대로다.

### 문제 시 끄는 법 (빠른 순, 배포 불필요)

1. **새 사이트가 문제**: `watch_as_home`을 끈다(어드민 토글 또는 위 `false` 블록) -> `/`가 즉시 랜딩, 새 페이지·`/ko/…` 404.
2. **콘텐츠 응답이 문제**(필드 노출, 404 모양 이상): 해당 `*_publication_enabled`를 끈다 -> 그 DBA 콘텐츠가 404. 이후 원인을 본다.
3. **배너만 문제**: 해당 `banner_<page>` 값을 빈 문자열로(`update ... set value = '' ...`) -> 기본 그라데이션.
4. **슬러그가 잘못 나감**: 해당 `content_path_<kind>` 값을 빈 문자열로 -> 그 종류 공개 경로 없음.
5. 이것들로 안 풀리면(전체 요청이 깨지는 경우) 배포 점검표 8-2절 `vercel rollback`(TK님, 시험해 본 적 없음).
- 끈 뒤에는 R2로 값을 되읽고, 켜기 전과 같은 기준값 표(점검표 2절 6번)로 대조합니다.

## 4. 이 문서가 확인하지 못한 것 (처음 보는 것·한계)

- 이번에 라이브 어드민·DB를 읽지 않았습니다. B5·B6의 "알고 있음"은 이전 EOD 기록입니다.
- 켜진 상태의 새 사이트를 **익명 요청으로 한 번도 본 적이 없습니다**(프리뷰 로그인 뒤 화면도 제가 못 봄). 켜자마자 확인 목록은 로컬 렌더·시험으로 만든 예상입니다.
- 배너·콘텐츠가 서버에서 실제로 읽혀 R2 주소로 보이는 경로(DB 행 -> `R2_PUBLIC_BASE` 호스트 대조 -> `<img>`)는 라이브에서 돈 적이 없습니다.
- `description`이 Postgres CHECK·트리거와 맞는지는 위 SQL을 한 번 돌려 봐야 압니다.
- C5(색인)는 제안이지 승인된 규칙이 아닙니다. C2(켜는 날 배포 금지)는 본부가 확정했습니다.
