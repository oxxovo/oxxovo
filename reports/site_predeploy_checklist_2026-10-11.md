# 새 사이트 배포 전 점검표 — 2026-10-11

작성: 지수(메인). **이 파일은 로컬 작성이며 커밋·푸시·배포를 하지 않았습니다.** TK님이 배포를 명령하실 때 위에서부터 순서대로 쓰는 표입니다.
도메인은 전부 `https://www.oxxovo.ai` (다른 호스트는 여기로 리다이렉트: 2026-10-12 실측 `https://oxxovo.ai/`는 **307**, `location: https://www.oxxovo.ai/`).

## 0. 한눈에

- 이번 배포는 **코드만**입니다. SQL 없음, 환경변수 추가 없음, 스위치 변경 없음. **배포 = 새 사이트가 켜지는 것이 아닙니다.** 켜는 것은 별도 단계(`watch_as_home`, 6절)입니다.
- 기준값: 라이브 `175855f`(레포 HEAD, `origin/main`과 동일). `watch_as_home=false`(10-10 S1-3 TK님 조회값 — **배포 직전에 다시 확인**, 아래 2절).
- 배포 수단: `npm run deploy:prod`. `main`에 push만 해서는 배포되지 않습니다(`vercel.json`의 `git.deploymentEnabled.main=false`).
- 로컬 검증(2026-10-12 갱신): `npm test` **921/921** 통과(10-11엔 912, 10-12에 테스트 목록 가드 `lib/test-list.test.ts` 8개 + null url 시험 1개 추가), `tsc --noEmit` 에러 0, `next build` 성공, `app/watch`·`lib/watch*`·`app/tournament`·`app/_landing`·`app/layout.tsx` diff 없음.
  - 같은 날 발견·수정: `package.json`의 `test` 목록에서 `lib/site-frame.test.ts`와 `lib/postiz.test.ts` 사이 공백이 빠져 두 파일이 `npm test`에서 **조용히 빠져 있었습니다**(이전 보고의 849/851은 이 둘이 빠진 수). 고친 뒤 목록의 78개 파일이 전부 존재함을 확인하고 875개로 다시 돌렸습니다.

## 1. 커밋에 들어갈 파일

**`deploy:prod`는 working tree가 깨끗하지 않으면(untracked 포함) 배포를 거부합니다.** 그래서 아래 모든 파일은 "커밋하거나, 작업 폴더에서 치우거나" 둘 중 하나여야 합니다. `git add -A`/`git add .`는 쓰지 않고 경로를 지정해서 추가합니다.

### A. 새 사이트 코드 — 한 커밋으로 (배포 대상)

수정(M):
- `app/page.tsx` — 홈. `watch_as_home` 꺼짐이면 기존 랜딩 그대로, 켜짐이면 새 홈
- `proxy.ts` — `/ko/…` 처리(3절)
- `lib/content-paths.ts` — 예약 슬러그 추가(새 페이지 이름 7개 + `en`·`ko`)
- ★`lib/content-public.ts` · `lib/content-public-columns.ts` — **공개 문(콘텐츠 공개 판정)을 건드립니다.** 목록에 썸네일 URL 한 필드만 추가(3-2절). 가장 주의해서 볼 변경입니다.
- `lib/content-public.test.ts` — 예시 슬러그 `daily`→`news-slug` (검사 내용 동일; `daily`가 이제 예약어)
- `package.json` — 테스트 목록에 새 테스트 7개 등록

신규(??):
- `app/_site/` (SiteFrame, Card, LanguageMenu, ScrollRow, SectionPage, icons)
- `app/competition/` `app/entertainment/` `app/daily/` `app/market/` `app/education/` `app/jobs/` `app/games/` (각 `page.tsx`)
- `lib/scroll-row.ts` (가로 스크롤 행의 순수 계산, RTL 포함)
- `lib/locales.ts` `lib/site-messages.ts` `lib/site-messages-en.ts` `lib/site-messages-ko.ts` `lib/site-nav.ts` `lib/site-page.ts` `lib/site-locale.ts` `lib/site-banner.ts` `lib/site-banner-read.ts`
- `lib/home-feed.ts` `lib/home-sections.ts` — **어제 홈 작업에서 재사용한 부분**(탭 방식 화면 `app/_home/`은 이미 삭제했고 커밋된 적이 없어서 커밋에 없음)
- 테스트: `lib/home-feed.test.ts` `lib/home-sections.test.ts` `lib/locales.test.ts` `lib/site-messages.test.ts` `lib/site-nav.test.ts` `lib/site-banner.test.ts` `lib/site-frame.test.ts` `lib/scroll-row.test.ts`
- `scripts/render-site.mjs` (테스트가 쓰는 렌더 도우미; `esbuild`는 이미 `package.json`에 있음)
- `lib/test-list.test.ts` (10-12 추가: `npm test` 목록이 레포의 모든 `*.test.*`와 일치하는지 검사, 목록에도 등록됨)
- `scripts/site-fixture-shot.mjs` · `scripts/_link-stub.js` (10-12 추가, TK님 결정으로 **유지**: 고정 데이터로 화면을 렌더·스크린샷하는 확인용 도구)

### B. 새 사이트 검토 자료 (reports/) — 같은 커밋에 넣거나 별도 커밋, 둘 다 가능 (서빙되지 않음)

- `reports/copy_requests_site_2026-10-11.md` — 제니3 문구 요청
- `reports/market_workspace_plan_2026-10-11.md` — Market 계획(질문 4개는 마켓 제니가 TK님과 정함, 데이터 구조 미확정)
- `reports/banner_safe_area_guide.png` — 배너 안전 영역 가이드
- `reports/site_fixtures/` — 고정 데이터 렌더(홈 데스크톱·호버·모바일, Entertainment 모바일: html 4 + png 4)
- `reports/site_predeploy_checklist_2026-10-11.md` — 이 파일
- ⚠ `reports/site_mockup.png` — **시안 이미지에 실제 회사 이름·로고(OpenAI, NVIDIA, Google, Meta, Amazon 등)가 들어 있습니다.** 서빙되는 폴더는 아니지만 레포에 커밋할지는 TK님 판단입니다. 커밋하지 않으려면 파일을 레포 밖으로 옮기거나 `.git/info/exclude`에 한 줄 추가(레포에 안 남는 로컬 설정)해야 `deploy:prod`의 dirty 검사를 통과합니다.

### C. ⑩ 문서 4건 — **코드 커밋과 분리**해서 (별도 "docs" 커밋)

- `reports/jisu_hq_2026-10-10_eod.md` (신규)
- `reports/import_spec_news_2026-10-10.md` (신규, 키 값 없음)
- `reports/step10_runbook_2026-10-10.md` (신규)
- `reports/phase1_design_2026-10-04.md` (수정 — §3-2·§3-3 표시, 변경 이력)

⑩ 문서는 새 사이트와 무관하므로 같은 커밋에 섞지 않습니다. 코드 커밋과 docs 커밋 순서는 무관하지만 **둘 다 끝나야** `deploy:prod`가 통과합니다.

### 커밋 분할 제안

1. `feat: new site (home + 7 pages), language layer, banner reader` — A + B(시안 이미지 제외)
2. `docs: ⑩ …` — C

각 커밋 메시지 끝에 지침상의 Co-Authored-By 줄을 붙입니다.

## 2. 배포 직전 확인 (TK님 또는 지수가 읽기만)

1. `git status`가 깨끗하고(`nothing to commit`), `git rev-parse --short HEAD`가 방금 만든 커밋.
2. `npm test` 921 통과 · `npx tsc --noEmit` 에러 0 · `npx next build` 성공 (배포 단계에서도 빌드되지만, 로컬에서 먼저).
3. `git diff 175855f --stat -- app/watch lib/watch.ts lib/watch-gate.ts lib/watch-home.ts lib/watch-nav.ts app/tournament app/_landing app/layout.tsx` → 출력 없음.
4. `watch_as_home` 현재값이 `false`인지 — 어드민 `/admin/watch-home` 화면 또는 기존 조회 블록. **true면 배포 즉시 새 사이트가 켜집니다.**
5. 환경변수 이름 확인: **2026-10-12 확인 완료** -- `vercel env ls production`에 `R2_PUBLIC_BASE` 있음(`Encrypted`, `Production`, 생성 7일 전; 값은 보지 않음, 이름 줄만 걸러 읽음). 배포 직전에 한 번 더 같은 명령으로 이름이 아직 있는지만 본다. 배너 읽기가 이 값의 호스트로만 이미지를 허용합니다. **한계:** 이름이 있다는 것이지 값이 올바른 R2 공개 주소라는 증명은 아닙니다(값은 안 봄) -- 배너 파일이 실제로 올라오는 날 첫 배너로 확인.
6. **배포 전 기준값 (2026-10-12 라이브 실측, 라이브 `175855f`, 리다이렉트를 따라가지 않고 `curl -s -o /dev/null -D -`로 측정).** 배포 후(켜기 전) 같은 명령으로 다시 재서 "배포 후 기대"와 비교합니다.

| URL | 배포 전 실측 | 배포 후 (켜기 전) 기대 |
|---|---|---|
| `https://www.oxxovo.ai/` | 200, `text/html`, `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`, `<title>OXXOVO — The Global Arena for AI Creators</title>`, 본문에 "Featured" 0건 | 200, 같은 title, "Featured" 0건 (랜딩 그대로) |
| `https://www.oxxovo.ai/watch` | **404** (`x-matched-path: /watch`) | 404 |
| `https://www.oxxovo.ai/watch/` | 308, `location: /watch` | 308, 같은 location |
| `https://www.oxxovo.ai/tournament` | 200, `x-matched-path: /tournament`, no-store | 200 |
| `https://www.oxxovo.ai/welcome` | 200, `/welcome`, no-store | 200 |
| `https://www.oxxovo.ai/studio` | 200, `/studio`, no-store | 200 |
| `https://www.oxxovo.ai/login` | 200, `cache-control: public, max-age=0, must-revalidate`, `x-vercel-cache: HIT` | 200 |
| `https://www.oxxovo.ai/api/version` | 200, `application/json`, `{"sha":"175855f","dirty":false,"builtAt":"2026-10-07T22:51:53.838Z"}` | 새 sha, `dirty:false`, 새 builtAt |
| `https://www.oxxovo.ai/robots.txt` | 200, `text/plain`, 52바이트, md5 앞 8자리 `3b5077be` | 같은 52바이트·md5 |
| `https://www.oxxovo.ai/c/00000000-0000-0000-0000-000000000000` | 404 (`x-matched-path: /c/[id]`) | 404 |
| `https://www.oxxovo.ai/competition` | 404 (`x-matched-path: /[section]` -- 기존 콘텐츠 경로 라우트가 받음) | 404 (새 페이지가 이 경로를 차지하지만 스위치 꺼짐 = 404) |
| `/entertainment` `/daily` `/market` `/education` `/jobs` `/games` | 전부 404 (`/[section]`) | 전부 404 |
| `/ko` | 404 (`/[section]`) | 404 -- **10-12 첫 배포(`55b45a0`) 실측은 200(옛 랜딩과 같은 내용)이었다**: 프록시가 `/ko`를 `/`로 rewrite하는데 스위치 꺼짐의 `/`는 랜딩이라서. 수정(`rootSurface`: 꺼짐 + 프록시 접두 헤더 → `notFound()`)은 로컬 완료·테스트·훼손 시험 통과·로컬 `next start`에서 `/ko` 404 확인, **다음 배포에 포함**. 다음 배포 후 이 줄이 404여야 함 |
| `/ko/market` `/ko/watch` | 404 (`/[section]/[id]`) | `/ko/market` 404, `/ko/watch` 404 |
| `/en` | **404** (`/[section]`) | **308**, `location: /` (**배포 후 달라지는 줄 -- 정상**) |
| `/en/market` | **404** (`/[section]/[id]`) | **308**, `location: /market` (**달라지는 줄 -- 정상**) |
| `https://oxxovo.ai/` (apex) | 307, `location: https://www.oxxovo.ai/` | 같음 |
| `https://www.oxxovo.ai/` + `Accept-Language: ko-KR,ko;q=0.9` | 200 (랜딩, 언어 분기 없음) | 200 (스위치 꺼짐이면 새 사이트 언어 분기 없음) |
| `https://www.oxxovo.ai/market` + `Accept-Language: ko-KR,ko;q=0.9` | 404 | 404 |
| `/` + 위조 헤더 `x-oxxovo-locale: ko` `x-oxxovo-prefixed: 1` | `<html ... lang="en" ...>` | `lang="en"` |

**쓸 때 주의 3가지**
- **본문 md5는 배포 간 비교에 쓰지 못합니다.** 같은 배포에서는 반복 측정이 같았지만(6개 주소 확인) `<html data-dpl-id="dpl_…">`와 번들 해시가 배포마다 바뀝니다. 비교는 상태 코드·location·title·마커 문구로 합니다(`robots.txt`·`/api/version`처럼 배포와 무관한 파일만 md5 가능).
- **404 줄은 둘 이상 종류**: 새 배포 전의 `/competition` 404는 기존 `/[section]` 콘텐츠 경로 라우트가 낸 것이고, 배포 후의 404는 스위치 꺼짐으로 낸 것입니다. 상태 코드는 같아도 `x-matched-path`가 `/competition` 등으로 바뀔 것으로 예상합니다(라이브에서 본 적 없는 예상).
- 이 실측은 **로그인 없는 익명 요청** 기준입니다. 어드민 화면·로그인 후 화면은 측정하지 않았습니다.

확인 명령 예: `curl -s -o /dev/null -w "%{http_code}\n" https://www.oxxovo.ai/watch`

## 3. `proxy.ts` 변경 요지와 위험

**요지 (26줄 추가, 기존 코드는 안 바꿈):** 함수 맨 앞에 새 사이트 언어 처리를 넣었습니다.
- `/ko/<새 사이트 경로>` → 같은 경로의 영어 페이지로 **rewrite**하면서 언어(`ko`)를 요청 헤더(`x-oxxovo-locale`, `x-oxxovo-prefixed`)로 넘깁니다.
- `/en/<새 사이트 경로>` → 접두사 없는 주소로 **308 리다이렉트**(주소 중복 방지).
- 새 사이트 경로(`/`, `/competition`, `/entertainment`, `/daily`, `/market`, `/education`, `/jobs`, `/games`)로 들어오는 **모든 요청**에서 위 두 헤더를 먼저 **삭제**합니다 — 클라이언트가 직접 보낸 값은 페이지에 닿지 않습니다.
- 그 밖의 모든 경로(`/ko/watch` 포함)는 **손대지 않고** 기존 흐름(세션 갱신, admin 게이트)으로 갑니다. `config.matcher`도 그대로입니다.

**위험과 현재 확인 상태:**

| 위험 | 판단 | 확인 |
|---|---|---|
| `proxy.ts`는 모든 요청이 지난다 | 새 코드는 문자열 비교 몇 번뿐(DB·네트워크 없음). 새 사이트 경로가 아니면 즉시 기존 흐름 | 단위 테스트 10개(`lib/locales.test.ts`) |
| `/`(랜딩)도 새 사이트 경로라 헤더가 다시 만들어진다 | 요청 헤더 복사 후 `NextResponse.next` — 기존 빠른 경로와 같은 응답. 랜딩 내용·캐시 영향 없음 | 배포 후 `/` 본문이 배포 전과 같은지(5절 1번) |
| `/en`·`/ko` 접두사가 기존 주소를 가린다 | `en`/`ko`라는 기존 경로는 없음. 두 단어는 콘텐츠 슬러그 예약어에도 추가 | `lib/locales.test.ts`(예약어 검사) |
| 헤더 위조로 다른 언어 화면을 띄운다 | 삭제 후 설정. 위조 헤더가 효과 없는지 배포 후 `curl`로 확인(6절) | 소스 가드 테스트 + 훼손 시험(삭제 줄 제거 시 빨개짐) |
| 이 파일에 오류가 있으면 사이트 전체 영향 | 새 코드는 순수 함수 `decideRoute`뿐. `tsc`·build 통과 | **배포 직후 5절 1번을 가장 먼저** |

**되돌리기:** 이 파일의 변경만 `git revert`하면 됩니다(다른 변경과 독립).

## 3-2. 공개 문(`lib/content-public.ts`) 변경 — 목록 썸네일 (이번에 새로 추가)

**요지:** `listPublicContents`에 선택 옵션 `withThumbnails`를 추가했습니다. 켜면 **판정을 통과한 항목에 한해** 한 번의 추가 질의(`content_assets`, 컬럼 `content_id, role, media_type, url` 4개 — 모두 기존 `PUBLIC_ASSET_COLUMNS` 안에 있는 컬럼)로 `thumbnail_url` **한 필드만** 붙입니다. 옵션을 안 켜면 필드도 질의도 없습니다(기존 호출자는 변화 없음). 홈과 섹션 카드만 이 옵션을 켭니다.

| 위험 | 막는 장치 | 시험 |
|---|---|---|
| 영상(`main_16x9`·`main_9x16`)이나 스크립트·오디오가 목록 이미지로 나감 | SQL이 `role = 'thumbnail'`만 질의 + 순수 함수가 role이 정확히 `thumbnail`이고 `media_type = 'image'`일 때만 통과. "공개 허용 역할 전체"가 아니라 썸네일 하나만 | 훼손 시험 T2a·T2b·T5 → 각각 빨개짐 |
| 목록 항목에 다른 필드가 섞임 | 항목 키가 정확히 `ai_generated, description, form, id, kind, language, publish_at, thumbnail_url, title`(+정본 `PublicContent`)인지, JSON에 영상 URL·script·sha256·source_ref 등이 없는지 | 훼손 시험 T1 → 빨개짐 |
| 공개 아닌 항목(held·hidden·blocked 등)의 썸네일이 새어 나감 | 판정을 통과한 id만 질의·채택 | 훼손 시험 T6 → 빨개짐 |
| http·javascript:·상대경로·빈 주소 | https만 채택(공개 문 + 피드에서 이중으로) | 훼손 시험 T4·T7 → 빨개짐 |
| 썸네일이 없거나 질의가 실패 | `null` → 화면은 그라데이션 틀. 질의 실패는 목록을 막지 않고 이미지만 잃음 | 훼손 시험 T3 → 빨개짐, 실패 시험 통과 |
| 이미지 주소가 임의 외부 URL | 수입 단계에서 주소는 서버가 R2 공개 주소 + 키로 만들어 저장 → 외부 주소가 들어올 입구가 없음(코드로 확인한 사실; 라이브 DB 행은 확인하지 않음) | — |

**라이브 스키마 확인 (2026-10-12, TK님이 `pg_attribute` 읽기 SQL을 Run한 결과):** `content_assets`에 썸네일 질의의 4개 컬럼이 전부 있음 -- `content_id uuid not null` · `media_type text not null` · `role text not null` · `url text`(**nullable**). 컬럼 이름·존재는 코드와 일치(질의가 조용히 거부될 위험 해소). `role`이 `text`(enum 아님)라 `.eq('role','thumbnail')`가 값 오류를 내지 않음.
**`url`이 null일 수 있다 -- 통과 조건 두 겹(이미 있었고 오늘 시험을 보강):** ① SQL `.not('url','is',null)`로 null 행을 받지도 않음, ② 순수 함수 `pickThumbnails`가 `typeof r.url !== 'string'`이면 건너뜀(그 뒤 trim → `https://`만). **훼손 시험(10-12):** ②를 지우면 실패 2건(null url이 `.trim()`에서 TypeError), ①을 지우면 실패 1건(질의 필터 시험), 둘 다 지우면 3건, 대조군·원복은 초록(`lib/content-public.test.ts`에 시험 1개 추가: null·누락 url이 좋은 썸네일 옆에 있어도 순서 무관하게 건너뛰고 던지지 않음, SQL 필터가 우회돼 null만 돌아와도 카드는 `null`=그라데이션 틀). 한계: 시험은 가짜 DB 응답 기준이며 라이브에 null url 썸네일 행이 실제 있는지는 보지 않음.

**호버 설명 출처 (10-12 코드 확인):** 대회 카드의 호버 설명(`summary`) = `video_description`(참가자가 /apply에서 쓰는 영상 설명, 최대 600자)을 `getWatchVideos`로 읽어 **200자에서 자르고 "…"**. 이 필드는 `/watch/[id]`(`app/watch/[id]/page.tsx` 249행)가 **전문 그대로 이미 공개 렌더**하는 같은 필드·같은 조회 경로이고, 홈의 대회 카드는 대회 공개 게이트 안에서만 나옴. 콘텐츠 카드는 공개 문을 통과한 `description`(상세 `/c/<id>`와 같은 필드). **새로 노출되는 필드는 없고** 노출 위치(홈 카드 호버)와 길이(앞 200자)만 새롭다 -- 그 위치에서 노출해도 되는지는 TK님 판단으로 남음. 참고: 콘텐츠 카드는 호버가 아니라 **카드 아래 한 줄(`line-clamp-1`)에도 `description`을 항상 보여 줌**(대회 카드는 그 줄이 작성자 이름).

**호버 설명 실측 (2026-10-12, TK님이 읽기 SQL 2개를 Run한 결과): 지금 홈 대회 카드·호버 설명은 0건이고, 그것이 맞다.**
- 호버 설명 SQL(현재 시즌·공개 판정·영상 있음·설명 있음 조건, 앞 200자): `Success. No rows returned.`
- 단계별 count SQL: `n_seasons_all` 14 · `n_season_candidates` **0** · `n_apps_all` 117 · `cur_id` null · `cur_number` null.
- 판정(TK님): 날짜가 잡힌 비-fixture 시즌이 0개라 `getCurrentSeason`이 시즌을 못 고르고, 홈 코드는 시즌이 없으면 대회 카드를 만들지 않는다 -- **0장이 맞고 앞 SQL의 0행도 정상.** 지원 행 117건은 전부 이 시즌 선택에서 걸러진 상태라 공개 판정·영상·설명 단계는 아직 측정되지 않음.
- 한계(지수): `n_season_candidates = 0`은 "날짜 없음"과 "`is_fixture`가 전부 true"를 구분하지 않는다(TK님 판정은 날짜 쪽). 시즌 날짜를 다시 잡을 때 어느 쪽이었는지가 드러난다.

**★시즌 날짜를 다시 설정하는 날 -- 대회 공개 스위치를 켜기 전에 반드시 (TK님 결정 2026-10-12):**
1. 아래 두 SQL을 **다시 돌린다**(TK님 Run, 채팅 본문으로 전달, 블록 1개 = 쿼리 1개): ① 단계별 count SQL(어디서 걸러지는지, `cur_id`가 잡히는지), ② 호버 설명 SQL(30행, 앞 200자·전체 길이·작성자 이름).
2. **TK님이 ②의 실제 설명 문장을 눈으로 보고 홈 노출 여부를 승인한다.** 승인 전에는 대회 공개 스위치(`competition_publication_enabled`)를 켜지 않는다. 승인하지 않으면 홈 대회 카드의 `summary`를 끄는 코드 변경이 필요하다(지수가 준비).
3. ②에서 `n_video > 0`인데 `n_desc = 0`이면 카드는 나가고 호버만 비는 상태 -- 이것도 TK님이 확인.
4. 이 두 SQL 원문은 지수가 요청 시 다시 채팅으로 준다(레포 파일에는 두지 않음 -- TK님은 레포 파일을 열 수 없다).

**되돌리기:** 이 두 파일의 변경만 `git revert`하면 카드는 그라데이션 틀로 돌아갑니다(다른 기능 영향 없음).
**라이브 확인(켠 뒤, 7절 12번):** 콘텐츠 공개 스위치가 켜지고 썸네일이 있는 항목이 생겼을 때 해당 카드 이미지 주소가 R2 공개 주소(`https://…`)인지, 그리고 카드 HTML에 영상 주소(`.mp4`)가 없는지.

## 4. 배포 절차 (TK님)

1. 위 1절대로 커밋(두 개) 후 `git push` (push는 배포가 아님).
2. `npm run deploy:prod` — 내부에서 service_role grant 검사 → clean tree 검사 → 배포 → `www.oxxovo.ai/api/version`의 sha·builtAt 확인까지 합니다. **`✓ live version`이 안 나오면 재배포하지 말고** `node scripts/deploy-verify.mjs <sha> <builtAt>`로 재확인.
3. 새 SHA가 `/api/version`에 보인 뒤 크론 확인: `vercel logs --environment production --no-branch --since 15m --limit 300 --json -q "content-dispatch"` 에서 틱이 `"stage":"no_open_dba"`, `processed:0`, `warnings:[]`이고 **`deploymentId`가 새 배포**인지(배포 직후 첫 틱은 옛 배포로 돌 수 있음 — 10-07 교훈). 스위치(콘텐츠 송출)는 건드리지 않으므로 이상이 없어야 합니다.
4. ⑩ 실행표는 A1에서 라이브 SHA `175855f`를 기대합니다. **이 배포 후에는 새 SHA로 바꿔서 읽어야** 합니다(실행표 A1·H 항목). **TK님 결정(2026-10-12): 배포와 ⑩은 같은 날 하지 않는다** -- 배포한 날은 ⑩을 시작하지 않고, ⑩ 실행표 A0(맨 앞 단계)에서 배포일이 오늘이 아님과 새 `deploymentId` 틱을 확인한 뒤 진행합니다.

## 5. 배포 후, `watch_as_home` 켜기 **전** 확인 (스위치는 아직 `false`)

모두 "새 사이트가 아직 안 보인다 + 기존 화면은 그대로"를 확인하는 항목입니다.

1. **랜딩 그대로** — `https://www.oxxovo.ai/` 200이고 본문이 배포 전과 같음(예: 제목·Tournament 안내 문구가 있음, "Featured" 같은 새 홈 요소가 없음).
2. **기존 화면 그대로** — 2절 표의 `/watch` `/tournament` `/welcome` `/studio` 상태 코드가 배포 전과 같음. `https://www.oxxovo.ai/tournament`가 공개 갤러리로 열림(이번 변경은 이 주소를 쓰지 않음).
3. **새 페이지 전부 404** (스위치 꺼짐 = 존재하지 않는 것처럼):
   - `https://www.oxxovo.ai/competition` · `/entertainment` · `/daily` · `/market` · `/education` · `/jobs` · `/games` → 각각 404
   - `https://www.oxxovo.ai/ko` · `/ko/competition` · `/ko/entertainment` · `/ko/daily` · `/ko/market` · `/ko/education` · `/ko/jobs` · `/ko/games` → 각각 404
4. **`/en`은 리다이렉트** — `curl -sI https://www.oxxovo.ai/en/market` → `308`, `location`이 `/market`(절대 주소로 보일 수 있음; 따라가면 404). `curl -sI https://www.oxxovo.ai/en` → `308`, `location`이 `/`.
5. **`/ko/watch`는 watch가 아님** — `https://www.oxxovo.ai/ko/watch` → 404 (`/watch` 내용이 보이면 안 됨).
6. **404 응답에 새 사이트 문구가 없음** — `curl -s https://www.oxxovo.ai/market | grep -c "AI Market Home"` → 0.
7. `https://www.oxxovo.ai/api/version` → 새 SHA, `dirty:false`.
8. `https://www.oxxovo.ai/robots.txt` — 배포 전과 같음(이번 변경은 이 파일을 건드리지 않음).
9. 콘텐츠 공개 경로 그대로 — `https://www.oxxovo.ai/c/00000000-0000-0000-0000-000000000000` → 404.

## 6. 스위치를 켜기 **전에** 정할 것 (코드 문제 아님, 결정 사항)

`watch_as_home`을 켜면 `/`가 새 홈으로 바뀌고 새 페이지 7개가 열립니다. **지금 켜면 보이는 것:**
- 모든 페이지의 카드 자리가 **빈 틀(글자 없는 막대)** — 공개 콘텐츠가 0건이고 콘텐츠 공개 스위치도 꺼져 있음(썸네일·호버 문구는 콘텐츠가 공개돼야 보임)
- 배너가 전부 **기본 그라데이션** — 배너 파일·`banner_<page>` 행 없음(엔터·뉴스가 제작 중)
- 홈 Hero 오른쪽 문장이 영어에서 **없음**(`hero.sub` 영어 미확정, 제니3)
- `/ko`는 왼쪽 메뉴 53개와 Hero 한국어만 한국어, 상단 메뉴·섹션 이름은 영어
- Tournament는 **빈 페이지**(광고 영상 자리). 대회 공개 스위치가 켜지면 `/watch`로 이동
- `/welcome`(구 랜딩)은 그대로 남아 있음

- 홈 대회 카드·호버 설명: 시즌 날짜가 잡힌 비-fixture 시즌이 0개라 **지금은 0건**(10-12 실측, 3-2절). 날짜를 다시 잡은 뒤 **대회 공개 스위치를 켜기 전에 3-2절의 두 SQL을 다시 돌려 TK님이 설명 문장을 승인**한다.

→ 켜는 시점(배너·문구·콘텐츠 준비 정도)은 TK님 판단입니다. 배포는 켜는 것과 무관하게 먼저 해도 안전합니다.

켜는 방법: `https://www.oxxovo.ai/admin/watch-home` 토글(어드민 로그인). 값은 매 요청마다 읽으므로 즉시 반영됩니다.

## 7. 켠 **직후** 확인

1. `https://www.oxxovo.ai/` → 200, 새 홈(OXXOVO Hero + "Featured" + 카드 빈 틀). 기존 랜딩 문구는 없음.
2. 7개 페이지 각각 200이고 상단 메뉴 7개(Tournament, Entertainment, Daily, Market, Education, Jobs, AI Games)가 보임: `/competition` `/entertainment` `/daily` `/market` `/education` `/jobs` `/games`.
3. **`/competition`은 404도 리다이렉트도 아님** — 200 빈 페이지(대회 공개 스위치가 꺼져 있는 동안). 대회가 공개되면 `/watch`로 307.
4. `https://www.oxxovo.ai/ko` · `/ko/market` · `/ko/entertainment` → 200, 본문에 `lang="ko"`. `/ko/entertainment`의 왼쪽 메뉴가 한국어("엔터테인먼트 홈", "영화" …).
5. **언어 감지:**
   - `curl -sI -H "Accept-Language: ko-KR,ko;q=0.9" https://www.oxxovo.ai/market` → `307`, `location`이 `/ko/market`
   - `curl -sI -H "Accept-Language: ko-KR,ko;q=0.9" -H "Cookie: oxxovo_lang=en" https://www.oxxovo.ai/market` → `200` (영어 선택 쿠키가 우선)
   - `curl -sI https://www.oxxovo.ai/market` (언어 헤더 없음, 검색 크롤러와 같은 조건) → `200` 영어
6. **헤더 위조가 안 먹음** — `curl -s -H "x-oxxovo-locale: ko" -H "x-oxxovo-prefixed: 1" https://www.oxxovo.ai/market | grep -o 'lang="[a-z]*"'` → `lang="en"` (ko가 나오면 즉시 끄고 보고).
7. **`?m=` 검증** — `https://www.oxxovo.ai/entertainment?m=film` 200, `https://www.oxxovo.ai/entertainment?m=zzz` 200(첫 항목으로), 둘 다 에러 없음.
8. **공개 판정이 그대로** — 콘텐츠 공개 스위치가 꺼져 있는 동안 어느 페이지에도 카드 제목이 나오지 않음(전부 빈 틀). 홈 HTML에 `source_ref` `upstream` `rights_reason` 같은 단어가 0건: `curl -s https://www.oxxovo.ai/ | grep -ci "source_ref\|upstream\|rights_reason"` → 0.
9. `hreflang` — `curl -s https://www.oxxovo.ai/market | grep -o 'hreflang="[^"]*"'` 에 `en`·`ko`·`x-default`.
10. 기존 화면 그대로 — 5절 2번을 한 번 더.
11. 크론 틱 정상(4절 3번과 같은 조회) — 스위치 켜기와 무관해야 합니다.
12. **(콘텐츠가 공개된 뒤에만)** 카드 HTML에 영상 주소가 없는지: `curl -s https://www.oxxovo.ai/daily | grep -c ".mp4"` → 0. 썸네일이 있는 카드의 `<img src="https://…">`가 R2 공개 주소인지.
13. **모바일 섹션 메뉴** — 휴대폰 폭에서 Entertainment 등 섹션 페이지의 왼쪽 메뉴가 사라지고 배너 바로 아래에 현재 항목 한 줄(눌러서 전체 목록 펼침)로 나옴. 데스크톱(768px 이상)에서는 왼쪽 세로 메뉴.
14. **모바일 Featured** — 휴대폰 폭(390px)에서 홈의 Featured 줄이 가로로 스크롤되고 다음 카드가 가장자리에 살짝 보임. 상단 메뉴 7개가 한 줄로 옆으로 스크롤됨(줄바꿈으로 깨지지 않음).
15. **카드 호버** — 데스크톱에서 카드에 마우스를 올리면 제목과 설명 앞부분이 이미지 위에 나타남. 상세 주소가 있는 종류는 클릭 시 상세로 이동, 주소가 없는 종류는 클릭되지 않음.

## 8. 되돌리는 방법 (빠른 순)

1. **스위치만 끄기 (가장 빠름, 배포 불필요)** — `/admin/watch-home` 토글을 끔 → 즉시 `/`가 랜딩으로 돌아오고 새 페이지 7개와 `/ko/…`가 다시 404. 새 사이트 문제의 **1차 대응은 항상 이것**입니다.
2. **코드 되돌리기** — 새 사이트 커밋을 `git revert` → push → `npm run deploy:prod`. 기록이 남는 정석 경로입니다. (`proxy.ts`만 문제면 그 변경만 revert.)
3. **`proxy.ts` 등 코드 문제로 스위치 끄기가 안 통할 때** -- 8-2절(Vercel 되돌리기)로 갑니다. 이 프로젝트에서 **시험해 본 적이 없는** 경로입니다.
4. **DB 되돌릴 것 없음** — 이번 배포는 SQL도 설정 행도 만들지 않습니다(배너 `banner_<page>` 행은 파일이 올 때 별도로 넣는 선택 작업).
5. 브라우저에 남는 것: 방문자가 언어를 고르면 쿠키 `oxxovo_lang`와 localStorage `oxxovo_admin_lang`이 생깁니다. 되돌려도 해가 없습니다(새 사이트가 꺼지면 읽는 곳이 없음).

### 8-2. 스위치 끄기가 안 통할 때: 이전 배포로 되돌리기 (`proxy.ts` 문제 등)

**언제 쓰나:** `watch_as_home`을 꺼도 문제가 남을 때. 예: 새 사이트와 무관한 기존 주소(`/watch` `/tournament` `/studio` `/login` `/api/*`)가 깨지거나 느려짐, 모든 요청이 500, 리다이렉트 루프, 어드민 로그인 불능. `proxy.ts`는 모든 요청이 지나므로 이 파일의 오류는 스위치로 못 막습니다. **판단은 TK님이 하고, 1차 대응(스위치 끄기)을 먼저 해서 그래도 남는지 본 뒤**에 아래로 갑니다(이미 사이트 전체가 죽었으면 바로 아래로).

**되돌릴 대상(미리 기록):** 이번 배포 직전의 라이브 = 배포 `dpl_9BZwjVNGSJuBy9utF5pohhb7s87K`, URL `https://oxxovo-46k0e74yx-oxxovos-projects.vercel.app`, SHA `175855f`, 2026-10-07 15:52 PDT 생성, 상태 Ready (2026-10-12 `vercel inspect`로 확인; 별칭 `www.oxxovo.ai` `oxxovo.ai` `oxxovo.com` `www.oxxovo.com` `oxxovo.vercel.app` 등이 이 배포에 붙어 있음). **새 배포를 하면 이 id가 "이전 배포"가 되므로 배포 직후에도 `vercel ls --prod`로 이 id가 목록에 남아 있는지 한 번 본다.**

| 누가 | 무엇을 누르나 / 치나 |
|---|---|
| 🅣 TK님 (권한이 있는 사람이 직접) | 터미널에서 `vercel rollback dpl_9BZwjVNGSJuBy9utF5pohhb7s87K` (같은 뜻: URL로 `vercel rollback https://oxxovo-46k0e74yx-oxxovos-projects.vercel.app`). 완료 대기 최대 3분(`--timeout`). 진행 확인: `vercel rollback status`. 대시보드 대안: Vercel → oxxovo 프로젝트 → Deployments → 위 배포 행 `⋯` → **Instant Rollback**(또는 Promote to Production). |
| 🅙 지수 | 아래 "되돌린 뒤 확인"을 읽기로 수행하고 결과를 TK님·본부에 보고. **지수는 rollback 명령을 직접 치지 않는다**(프로덕션을 바꾸는 명령 -- TK님 지시가 있을 때만). |
| 🅗 본부 | 문제 공지·고객 영향 판단(레포 밖). |

**`vercel promote <배포>`와의 차이:** `rollback`은 "빠른 되돌리기(이전 배포로 별칭을 즉시 옮김)", `promote`는 "이미 있는 배포를 현재 프로덕션으로 지정". 이번에는 **`rollback`을 쓴다.** 되돌린 뒤 **고친 새 배포를 올릴 때는 `vercel promote <새 배포 URL>`이 필요할 수 있습니다**(아래 주의 1).

**되돌린 뒤 확인 (읽기만, 전부 통과해야 함):**
1. `https://www.oxxovo.ai/api/version` → `sha:"175855f"`, `builtAt:"2026-10-07T22:51:53.838Z"` (되돌렸다는 직접 증거).
2. 2절 6번 기준값 표의 모든 줄이 **"배포 전 실측" 칸과 일치**(특히 `/` 200 랜딩 title, `/watch` 404, `/tournament` 200, `/studio` 200, `/login` 200, `/en/market` 404, `/competition` 404).
3. 크론 틱: `vercel logs --environment production --no-branch --since 15m --limit 300 --json -q "content-dispatch"`에서 틱이 `"stage":"no_open_dba"`, `processed:0`, `warnings:[]`이고 `deploymentId`가 `dpl_9BZw...`. **rollback 직후 첫 틱은 새(문제) 배포로 돌 수 있으니** 시각으로 두 번 연속 `dpl_9BZw...`가 나올 때까지 본다(10-07 교훈과 같은 종류).
4. `https://www.oxxovo.ai/admin/watch-home` 값이 여전히 `false`(되돌리기는 DB를 건드리지 않음).
5. 되돌린 뒤 `git`은 그대로입니다: `main`에는 문제 커밋이 남아 있고, 라이브만 옛 배포입니다. `deploy:prod`를 다시 돌리면 같은 문제가 다시 올라가므로 **원인 `git revert` 또는 수정 커밋 없이 재배포하지 않는다.**

**주의 (모두 이 프로젝트에서 시험하지 않은 것 -- 시험 전 단정 금지):**
1. **Vercel은 `rollback` 뒤에 프로덕션 도메인 자동 연결을 끄는 동작이 있는 것으로 알고 있습니다**(이후 `deploy --prod`가 별칭을 안 옮길 수 있음). 그러면 `deploy:prod`의 "`/api/version`에 새 SHA가 보임" 확인이 실패합니다. 고친 배포는 `vercel deploy --prod`가 끝난 뒤 `vercel promote <그 배포 URL>`로 올리고 `/api/version`을 확인합니다. **이 부분은 문서 기억이지 이 프로젝트의 실측이 아니므로, 처음 쓸 때 대시보드의 안내 문구를 TK님이 확인합니다.**
2. **환경변수·DB·`platform_config` 값은 되돌아가지 않습니다**(배포 산출물만 바뀜). 이번 배포는 SQL·설정 행 변경이 없어 문제 없음.
3. 크론은 배포에 묶여 있어 되돌린 배포의 `vercel.json` 크론 정의가 적용됩니다(이번 변경은 크론을 바꾸지 않음 -- `git diff 175855f -- vercel.json` 출력 없음으로 확인할 것).
4. 헤더 위조·`/ko` 처리 같은 새 동작은 되돌리면 전부 사라집니다(그게 목적).
5. **되돌리기 연습은 한 번도 안 했습니다.** 가능하면 배포 **전에** 프리뷰 배포(`vercel deploy`, `--prod` 없음)로 `vercel rollback`·`promote`의 도움말·대시보드 위치만 확인해 두는 것을 권합니다(프로덕션을 건드리지 않는 범위).

## 9. 알려진 한계 (배포를 막지 않음)

- `<html lang>`은 영어로 고정 — 루트 레이아웃을 건드리면 지금 정적인 페이지가 전부 동적으로 바뀌기 때문. 새 사이트는 래퍼 요소에 `lang`·`dir`을 넣고 `hreflang`으로 보완.
- 콘텐츠 주소 슬러그(`content_path_<kind>`)로 새 페이지 이름(`daily` `market` …)은 쓸 수 없음(예약어). 설계서의 제안 슬러그는 `news`·`drama`·`film`·`cf`·`music`·`music-video`라 충돌 없음.
- 배너 크롭 기준은 `reports/banner_safe_area_guide.png` (가운데 기준, 홈 Hero 4:1은 세로 44%만 보임).
- 모바일 섹션 메뉴는 네이티브 <details>(스크립트 없음)라 바깥을 눌러도 자동으로 닫히지 않음(항목을 고르면 페이지가 바뀌며 닫힘).
- 아이콘은 중립 아이콘(세트 미정). 섹션 제목·부제는 제니3 문구 대기.
- 시안의 영상 카드 대표 이미지와 섹션별 실제 데이터(Market 등)는 아직 없음 — 데이터 소스만 비어 있는 상태.
