# EOD 2026-10-11 -- 지수(메인, 앱 레포) 작업 요약 + 인계

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문 그대로.
**읽는 순서: 0절 -> 5절(내일 첫 일) -> 3절(대기) -> 4절(⑩) -> 6절(커밋 안 된 파일) -> 7절(교훈·한계).**
이 파일은 로컬 작성이고 **커밋·푸시·배포하지 않았다**(TK님 지시). 진행 중인 작업은 없다(안전한 지점에서 멈춤).

## 0. 한 줄 요약

**라이브 = 레포 HEAD = `175855f`, 오늘 배포 0건·커밋 0건·스위치 변경 0건.** 새 사이트(언어 층, 홈 + 7개 페이지, `/competition`, 배너 리더, 썸네일 공개 문 변경, 모바일 메뉴·캐러셀)를 **로컬에서 전부 만들었고** `npm test` 912/912, `tsc` 에러 0, `next build` 성공, watch 관련 파일 diff 0. 배포 전 점검표는 준비됨. ⑩은 사전 확인 A1~A4와 오늘 재확인까지 통과, **`pg_trigger`·A5부터 재개**(뉴스 수입은 오피스 PC 필요).

## 1. 오늘 한 일 (전부 로컬, 코드는 미커밋)

### 1-1. 새 사이트 구조 (어제 탭 방식 홈을 페이지별 구조로 교체)

- **언어 층**: 영어 정본 1개 + 언어별 번역 층. `lib/locales.ts`(언어 목록 `en`·`ko`, 주소 규칙, 협상, 방향 `ltr/rtl`), `lib/site-messages*.ts`(영어 정본 + `ko` 층, 없는 키는 영어로 폴백), `lib/site-locale.ts`(진입 게이트 + 언어 판정), `proxy.ts`(`/ko/…` rewrite, `/en/…` 308, 클라이언트가 보낸 언어 헤더 삭제). 영어는 접두사 없음(`/entertainment`), 그 외는 접두사(`/ko/entertainment`). 언어 추가 = `LOCALES` 한 줄 + 카탈로그 파일 하나(가짜 RTL 언어로 시험). 콘텐츠 제목·설명 번역 자리는 `pickTranslation`(순수 함수, 번역 없으면 영어 정본, 테이블은 안 만듦).
- **페이지**: 홈(`/`, `watch_as_home` 켜짐일 때만; 꺼짐이면 기존 랜딩 그대로), `/competition`, `/entertainment`, `/daily`, `/market`, `/education`, `/jobs`, `/games`. 전부 `watch_as_home` 뒤(꺼짐 = 404, `/ko/…` 포함). 공통 틀 `app/_site/SiteFrame.tsx`(상단 메뉴 7개 + 계정·🌐, 섹션별 왼쪽 메뉴, 배너), 메뉴 데이터는 `lib/site-nav.ts` 한 곳(시안 메뉴 53개 항목, 영/한 이름).
- **`/competition`(Tournament)**: 광고 영상 자리만 있는 빈 페이지. 대회 공개 스위치가 켜지면 `/watch`로 307. **`/tournament`가 아니라 `/competition`인 이유**: `/tournament`는 공개 포스터 갤러리이고 랜딩 헤더·푸터·QR/bio-link로 이미 링크가 퍼져 있어 TK님이 정한 기준(공개돼 링크가 퍼져 있으면 `/competition`)대로 결정.
- **배너 리더**: `lib/site-banner.ts`·`site-banner-read.ts`. `platform_config` 키 `banner_<page>`(JSON `{url,width,height}`), https + R2 공개 주소 호스트만, 16:9(2%)·1920×1080 이상, 하나라도 어긋나면 기본 그라데이션. 키 8개(home + 7)는 **아직 없음**(SQL은 TK님 Run 필요). 크롭 기준은 `reports/banner_safe_area_guide.png`(가운데 기준, 홈 Hero 4:1은 세로 44%만 보임, 안전 핵심 x 81~1839·y 300~780, 섹션 배너는 y 129~951).
- **썸네일 공개 문 변경**(공개 판정 파일을 처음 건드림): `listPublicContents`에 선택 옵션 `withThumbnails` → 판정을 통과한 항목에 한해 `thumbnail_url` **한 필드만**(role `thumbnail`, 이미지, https). 없으면 `null`(그라데이션 틀). 점검표 3-2절에 위험 표 있음.
- **카드·화면**: 카드 호버 = **설명만**(제목은 아래에 한 번만, 설명 없으면 오버레이 자체 없음), 주소 없는 종류는 링크 없음. Hero 스크림(그라데이션 오버레이, RTL에서 뒤집힘). 모바일 Featured = 가로 스크롤 스냅 캐러셀. 상단 메뉴·캐러셀은 스크롤 막대 숨김 + 끝 페이드(끝에 닿으면 사라짐, RTL은 왼쪽 끝) + 상단 메뉴는 현재 항목 자동 가운데 스크롤. 현재 사업 영역은 채운 알약으로 강조. **모바일 섹션 메뉴는 배너 아래 한 줄 드롭다운**(`<details>`, 현재 항목 + 눌러서 전체 펼침), 데스크톱은 왼쪽 세로 메뉴.
- **문구**: 지어 쓰지 않음. 시안 승인 이름(메뉴 53개 + Hero + Featured 한국어)만 카탈로그에 넣고, 나머지는 `reports/copy_requests_site_2026-10-11.md`로 제니3 요청. 영어가 비어 있는 키는 `hero.sub` 1개.

### 1-2. 검증 수치

- `npm test` **912/912 통과**(오늘 820 → 849/851 → 875 → 895 → 906 → 912). `tsc --noEmit` 에러 0. `next build` 성공(새 7개 경로 동적).
- `git diff -- app/watch lib/watch*.ts app/tournament app/_landing app/layout.tsx` 출력 없음(기존 watch 화면 한 줄도 안 바뀜).
- **가드 훼손 시험 누적 72건**(5묶음: 홈 11 + 언어·틀 20 + 썸네일·호버·캐러셀·스크림 16 + 스크롤 행·강조 14 + 모바일 메뉴 11), 매번 변경 없는 대조군은 초록, 시험 뒤 파일 원복 확인. **처음에 안 잡힌 2건**(홈 캐러셀 끄기, 페이드가 끝에 반응하지 않음)은 소스 가드를 추가해 잡았다.
- 실제 브라우저(Chrome headless)에서 실측: 스크롤 막대 높이 숨김 후 0px / 숨김 클래스 제거 대조군 15px(TK님이 보신 흰 막대), 페이드 위치 LTR 오른쪽·RTL 왼쪽, 현재 항목 자동 스크롤(LTR·RTL·끝 항목), 데스크톱 첫 화면에서 Featured 카드 윗부분 y 412(1280×720 창 포함 보임).

### 1-3. 산출 파일(검토용)

- `reports/site_predeploy_checklist_2026-10-11.md` -- 배포 전 점검표(커밋 파일 분류, `proxy.ts` 위험, 공개 문 변경 위험, 전·후 확인 URL, 되돌리기)
- `reports/banner_safe_area_guide.png` -- 배너 안전 영역 가이드(1920×1080)
- `reports/copy_requests_site_2026-10-11.md` -- 제니3 문구 요청
- `reports/site_fixtures/` -- 고정 데이터 렌더 PNG·HTML(홈 데스크톱·호버, Entertainment 모바일 닫힘·열림, Market 모바일). **`2_en_home_mobile.png`는 현재 폴더에 없다**(재생성 중 삭제됨, 같은 이름 `.html`은 이전 버전). 필요하면 재생성.
- `reports/site_mockup.png` -- TK님이 주신 시안(**실제 회사 이름·로고 포함**, 커밋 여부는 TK님 판단)

## 2. TK님 결정 기록 (2026-10-11)

1. **언어**: 영어 정본 1개 + 어떤 언어든 붙는 구조(`LOCALES` 설정 추가만으로 확장, 아랍어 같은 RTL도 안 깨지게). 주소에 언어 표시(`/ko`), 첫 방문 브라우저 언어 감지 + 🌐 선택, SEO(`hreflang`). 지금은 en + ko. 콘텐츠 제목·설명은 앞으로 AI 번역(자리만, 지금 구현 아님). 2026-08-11 "KO/EN만 정본, 나머지는 브라우저 번역" 결정은 **새 사이트에 한해** 이 결정으로 대체. 본부 기록의 언어 정책 요지: 정본 영어 / 한 화면에 한 언어(섞지 않음) / 콘텐츠 주제 컬럼은 언어별 분리.
2. **구조**: 상단 메뉴 7개 = 각각 **별도 페이지**, 페이지마다 **왼쪽 메뉴가 다름**(시안 `reports/site_mockup.png`). 홈은 시안 0(Hero + Featured). 모바일 섹션 메뉴는 TK님이 "배너 아래 한 줄"을 제안했고, 8~9개 항목에는 가로 행보다 드롭다운이 낫다는 내 의견을 근거와 함께 말했으며 그 방향으로 진행(TK님이 "나은 쪽으로" 위임).
3. **Tournament**: 기존 watch 대회 화면을 하나도 안 바꾸고 연결. **지금은 빈 자리**(404 아님, 나중에 토너먼트 광고 영상). 대회 공개 스위치가 켜지면 그대로 `/watch`로 연결.
4. **Coming Soon 글자는 안 씀**. 내용이 없는 항목은 시안 모양의 빈 틀(스켈레톤). Market·Education·Jobs·AI Games는 왼쪽 메뉴와 본문 자리만 만들어 두고 나중에 실제 데이터를 꽂음.
5. **배너**: 홈 + 7개 섹션 전부 제니2가 공급(Daily는 확인 중). 전부 **글자 없는 원본**(언어별 배너 키 불필요). 지금 파일 없음 -> 기본 배너.
6. **아이콘**: 상단 오른쪽은 **계정 아이콘 + 🌐만**(검색·알림은 기능이 생길 때까지 뺌). 항목별 아이콘 세트는 나중에(지금은 중립 아이콘 한 종류).
7. **그 밖에 확정**: COMMERCIAL = kind cf 전체(자체 제작/외부 수주 구분은 Phase 2), Music 탭에 `music`과 `music_video` 둘 다, 시안 속 실제 회사 이름·로고는 사용 금지, `hero.sub` 영어는 비워 둠(제니3 대기), Featured 한국어 "추천 콘텐츠" OK, 메뉴 소스는 **종류가 정확히 맞는 항목만 영상 소스**(Entertainment Home·Film·Drama·CF·Music & MV, Daily Home·Latest), 나머지는 빈 틀, 새 페이지 전부 `watch_as_home` 뒤, ko/en 두 토글 동기화(새 사이트에서 고르면 기존 localStorage 키에도 씀), 루트에서 대회 게이트를 빼고 대회 섹션 안으로 이동, `watch_as_home` 재사용(새 키 없음, 기본 꺼짐).

## 3. 대기 중

| 항목 | 담당 | 비고 |
|---|---|---|
| 한국어·영어 문구(`hero.sub` 영어, 상단 메뉴·섹션 이름·배지·AI 표기의 한국어, 시안의 섹션 제목·부제, 접근성 이름) | 제니3 | `reports/copy_requests_site_2026-10-11.md` |
| 배너 파일 8개(home + 7, Daily 확인 중) | 제니2(엔터), 뉴스 제니(Daily) | 안전 영역 가이드를 전달해야 함(`reports/banner_safe_area_guide.png`). 파일이 오면 R2 업로드 + 키 행 입력 |
| **배너 키 SQL** `banner_<page>` 8행 | TK님 Run(블록 한 개 = 쿼리 한 개) | 파일이 오기 전에는 필요 없음. 키가 없으면 기본 배너 |
| TK님 PNG 최종 검토 | TK님 | `reports/site_fixtures/` + 가이드 PNG |
| **배포 명령** | TK님 | `npm run deploy:prod`. 커밋 2개(코드 / ⑩ 문서) 후. 배포는 새 사이트를 켜지 않음(켜기는 `/admin/watch-home` 토글, 점검표 6~7절) |
| 아이콘 세트 | TK님(나중에) | `app/_site/icons.tsx` 한 곳 |
| 콘텐츠 번역 테이블·AI 번역 | 나중 | 자리만 있음 |
| 이전 EOD(10-10) 대기 항목 | 그대로 | 제니3 distribution 용어·어드민 문장, 약관(ElevenLabs·Hedra), 반송 폴링 구현, 공개 스위치 체크리스트 6개, 엔터 kind·form 조합 질문(제니2), ⑩ 이후 필수 묶음(어드민 문구·입고 메일 구분·상한 조회 통일), `content_max_bytes_news_short` |

## 4. ⑩ 상태 (오늘은 멈춤 -- TK님 지시로 메인 페이지를 먼저)

- **통과**: 사전 확인 A1~A4(10-10) + **오늘 재확인**: A3 9행 + `platform_config_history` 10-10 22:25Z 이후 변경 건수 **0건**(TK님 Run, 판독 통과 -- 하루 뒤에도 설정·채널 키가 그대로라는 증거). 오늘 아침 내가 직접 확인: 라이브 SHA `175855f`(`dirty:false`, 레포 HEAD·`origin/main`과 동일), 크론 틱 48개(10-11 16:45Z~20:40Z) 전부 `no_open_dba`, `processed:0`, `returnedNotified:0`, `warnings:[]`, 배포 `dpl_9BZw...` 하나. **한계**: 로그 조회 창이 약 4시간이라 10-10 23:xxZ ~ 10-11 16:45Z는 직접 못 봤다.
- **남음**: **`pg_trigger` 조회(`tgenabled='O'` 두 행, 날짜 기록) -> A5(대기 행 0건) -> A6 -> 뉴스 수입 -> 즉시 [Hold] ...** (실행표 `reports/step10_runbook_2026-10-10.md`).
- **뉴스 수입은 오피스 PC(세종)가 필요하다.** 규격 파일(`reports/import_spec_news_2026-10-10.md`)을 TK님이 Tom PC에서 열어 세종에게 전달해야 한다(10-10에 TK님 PC에서 경로 오류가 났고 원인 미확인). 오늘 안 되면 A5까지만.
- **새 사이트를 배포하면 실행표 A1·H의 기대값(라이브 SHA `175855f`)이 바뀐다.** ⑩ 재개 때 새 SHA로 읽는다. 또 "alias 직후 크론 틱은 옛 배포를 탈 수 있다"(10-07 교훈) -- ⑩ 스위치를 열기 전에 새 `deploymentId` 틱을 확인한다.
- 하지 말 것(그대로): 배포·스위치 변경·`CRON_SECRET` 교체·`railway variables` 목록 호출·서비스 키/`vercel env pull` 값 읽기.

## 5. 내일 첫 일

1. **`reports/market_workspace_plan_2026-10-11.md` 작성** -- Market 작업공간 계획 파일. (오늘 만든 것은 Market 페이지의 틀뿐: 왼쪽 메뉴 9개 항목은 시안 이름, 본문은 빈 카드 틀, 데이터 소스는 없음. 계획 파일은 그 틀에 실제 데이터를 꽂는 설계다.) 쓰기 전에 TK님·제니2에게 확인할 것: Market이 파는 것의 데이터 출처(AI 제품 판매사 연결), "Inquiry/문의·상담"이 메일인지 폼인지, 비교·구매 가이드의 데이터 구조, 실제 회사 이름·로고 사용 가능 범위.
2. 이어서 TK님 상황에 따라: 배포 전 점검표 기준값 칸 채우기 -> 커밋 2개 -> 배포 명령 대기 / 또는 ⑩ `pg_trigger`·A5.
3. 필요하면 `2_en_home_mobile.png` 재생성.

## 6. 커밋 안 된 파일 전체 (HEAD `175855f`, 커밋·푸시하지 않음)

**수정(M) -- 8건**
```
 M app/page.tsx                          홈. 스위치 꺼짐이면 랜딩 그대로, 켜짐이면 새 홈. 대회 게이트를 루트에서 뺌
 M lib/content-paths.ts                  예약 슬러그 추가(새 페이지 7개 + en/ko)
 M lib/content-public-columns.ts         ★공개 문: 썸네일 질의 컬럼 상수 추가
 M lib/content-public.test.ts            예시 슬러그 daily -> news-slug + 썸네일 시험 추가
 M lib/content-public.ts                 ★공개 문: withThumbnails 옵션, pickThumbnails
 M package.json                          테스트 목록에 새 테스트 8개 등록(공백 누락 사고 수정 포함)
 M proxy.ts                              /ko 처리 26줄
 M reports/phase1_design_2026-10-04.md   ⑩ 문서(§3-2·§3-3 표시) -- 10-10부터
```

**신규(??) -- 코드 (새 사이트, 한 커밋 대상)**
```
?? app/_site/                  Card, icons, LanguageMenu, ScrollRow, SectionPage, SiteFrame (6파일)
?? app/competition/            page.tsx
?? app/daily/ app/education/ app/entertainment/ app/games/ app/jobs/ app/market/   각 page.tsx
?? lib/locales.ts              lib/locales.test.ts
?? lib/site-messages.ts        lib/site-messages-en.ts   lib/site-messages-ko.ts   lib/site-messages.test.ts
?? lib/site-nav.ts             lib/site-nav.test.ts
?? lib/site-page.ts            lib/site-locale.ts
?? lib/site-banner.ts          lib/site-banner-read.ts   lib/site-banner.test.ts
?? lib/site-frame.test.ts
?? lib/scroll-row.ts           lib/scroll-row.test.ts
?? lib/home-feed.ts            lib/home-feed.test.ts     (어제 홈 작업에서 재사용)
?? lib/home-sections.ts        lib/home-sections.test.ts (어제 홈 작업에서 재사용)
?? scripts/render-site.mjs     테스트가 쓰는 렌더 도우미
```

**신규(??) -- 문서·검토 자료 (reports/)**
```
?? reports/site_predeploy_checklist_2026-10-11.md
?? reports/copy_requests_site_2026-10-11.md
?? reports/banner_safe_area_guide.png
?? reports/site_fixtures/                (html 6 + png 5)
?? reports/site_mockup.png               (★실제 회사 로고 포함 -- 커밋 여부 TK님 판단, 안 하면 .git/info/exclude 또는 레포 밖으로)
?? reports/jisu_hq_2026-10-11_eod.md     (이 파일)
```

**신규(??) -- ⑩ 문서 4건 (코드 커밋과 분리, 별도 docs 커밋)**
```
?? reports/jisu_hq_2026-10-10_eod.md
?? reports/import_spec_news_2026-10-10.md     (키 값 없음)
?? reports/step10_runbook_2026-10-10.md
 M reports/phase1_design_2026-10-04.md        (위 수정 목록과 동일 파일)
```
**`deploy:prod`는 untracked 파일까지 dirty로 보고 거부한다** -> 위 전부를 커밋하거나 작업 폴더에서 치워야 한다. `git add -A`/`git add .` 금지, 경로 지정.
(어제 `app/_home/`·`reports/home_fixtures/`는 삭제했고 커밋된 적이 없어 목록에 없다.)

## 7. 오늘의 교훈 · 한계 (성공만 적지 않는다)

1. **`package.json` 테스트 목록의 공백 누락(`site-frame.test.tslib/postiz.test.ts`)이 두 파일을 `npm test`에서 조용히 빼 놓고 있었다**(Node가 없는 경로를 에러 없이 무시). 내가 보고한 "849/851 통과"는 그만큼 모자란 숫자였다. -> 테스트 목록을 고치면 **"목록의 파일이 전부 존재하는지 + 새 테스트가 전부 목록에 있는지"**를 숫자와 함께 확인한다(고친 뒤 79개 존재, 누락 0).
2. **단위 테스트가 못 본 것을 화면이 보여 줬다**: 흰 스크롤 막대, 호버에서 제목 중복, 모바일 메뉴 줄바꿈, 상단 메뉴 4줄 뭉침(아이콘 잘림). 헤드리스 Chrome은 창 최소 폭이 약 500px이라 390px 확인은 iframe으로 해야 한다. 막대처럼 렌더에 달린 문제는 **대조군(숨김 클래스를 뺀 상태 15px)**을 같이 재야 "고쳐졌다"가 증거가 된다.
3. **훼손 시험이 구조적 구멍 2개를 찾았다**(홈 캐러셀 스위치, 페이드가 끝에 반응하는지). 서버 컴포넌트·클라이언트 훅 쪽은 행동 테스트를 걸 곳이 없어 소스 가드가 최선이다 -- 행동 테스트보다 약하다는 한계를 점검표에 적었다.
4. **시안 이미지는 두 번 첨부로 안 넘어왔다.** 경로(`reports/site_mockup.png`)로 받아서 Read로 열었다. -> 이미지가 안 보이면 지어내지 말고 즉시 경로를 요청한다(이번엔 그렇게 했고, 시안 없이 메뉴를 임의로 만들지 않았다).
5. **문구는 지어 쓰지 않았다.** 시안 승인 이름만 넣고 나머지는 요청 파일로. `hero.sub` 영어를 비워 두고, "Coming Soon"은 카탈로그에 없다는 것을 테스트로 고정했다.
6. **예약어 충돌**: 새 페이지 이름 `daily` 등을 예약 슬러그에 넣자 기존 `content-public.test.ts`의 예시 슬러그 `daily`가 깨졌다. 검사 내용은 그대로 두고 예시값만 `news-slug`로 바꿨다. 설계서의 뉴스 슬러그 제안은 `news`라 실제 충돌은 없다.
7. **한계(검증 못 한 것)**: 라이브 DB·프로덕션 환경은 하나도 안 봤다(서비스 키 미사용). `R2_PUBLIC_BASE`가 프로덕션 환경변수에 있는지는 배포 전 `vercel env ls production`으로 이름만 확인해야 한다. 점검표의 "배포 전 기준값" 칸(`/watch`·`/tournament` 등 상태 코드)은 비어 있다. `vercel rollback`은 이 프로젝트에서 시험한 적이 없다. 로컬 `watch_as_home` 켜짐 상태의 실제 렌더는 못 봤다(고정 데이터 렌더로만 확인). 대회 카드의 호버 설명은 `/watch` 상세에 이미 공개된 창작자 설명을 200자로 자른 것인데, 홈에 노출해도 되는지 TK님 확인이 필요하다.
