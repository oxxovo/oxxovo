# Watch 쇼케이스 칸 (promo_videos 84편) -- 설계만, 코드 변경 0건

2026-08-29, 지수(본체). 본부 지시: "설계만. 고치지 마라." 조사 기반: `lib/watch.ts`,
`app/watch/ArenaWatch.tsx` 존재 확인, `reports/promo_videos_migration_2026-06.sql`,
`reports/promo_publish_schema_2026-08-14.sql`, `_watch_demo_insert.mjs`(레포 루트, 미커밋 잔존),
memory `project_jisoo_resume_2026-08-22/23`.

## 배경 -- 9/9~10/14 Watch가 비는 문제

season_0의 예선 접수가 9/9에 열리기 전까지 `genesis_applications`에 공개 가능한 참가작이 없다 --
홍보를 보고 들어온 방문자가 `/watch`에서 볼 게 없다. 84편의 홍보영상(`promo_videos`)을 그 자리를
메우는 데 쓸 수 있는지가 질문.

## ① 그런 자리가 지금 코드에 있는가 -- 없다

`lib/watch.ts` 헤더 주석이 이미 명시한다: "Videos are NOT stored here: they already live in
genesis_applications... This module projects the visible ones into WatchVideo cards." `AppRow`
타입도 `genesis_applications` 컬럼만 나열한다(`:86-109`). `promo_videos`를 읽는 코드는 Watch
어디에도 없다.

**기록에 있던 "Watch 시딩 20편" 계획은 쇼케이스 레인이 아니었다.** `_watch_demo_insert.mjs`(레포
루트, 미커밋, 삭제 안 됨)를 열어보면 실제로는 promo/demo 콘텐츠를 **`genesis_applications`에
가짜 참가작 행으로 직접 INSERT**하는 방식이었다(`season_id: 'season_test'`, `creator_name`,
`video_title`, `status: 'pending'`, `watch_hidden: false` -- 진짜 참가작과 구분되는 필드가
DB 레벨에 아예 없다). **이게 바로 오늘 고친 사고의 데이터 소스다** -- `/watch`는 시즌 필터 없이
전 시즌을 합쳐서 보여주는데(`ArenaWatch.tsx`가 `seasonId` 없이 호출), season_test가 fixture
필터 없이 노출되면 이 가짜 20편이 그대로 일반 방문자 눈에 샌다. `2a61ecd`(오늘)가 막은 구멍이
정확히 이 경로다. **즉 "쇼케이스 자리"는 없을 뿐 아니라, 과거의 유일한 선례가 지금 만들지 말아야
할 안티패턴 그 자체였다.**

## ② 없으면 무엇을 만들어야 하는가 -- 범위만(일정 아님)

- **읽기 함수 1개**: `promo_videos`를 service-role 클라이언트로 직접 읽는 신규 함수(예:
  `getShowcaseVideos()`, `lib/watch.ts`에 추가하거나 `lib/watch-showcase.ts` 신규). 컬럼은
  공개해도 안전한 것만 명시적으로 select -- `id, video_url, caption, theme_note, posted_at,
  created_at`. `prompt`/`cost_usd`/`fal_request_id`/`error_message` 같은 내부용 컬럼은 select
  자체를 안 함.
- **얕은 카드 타입 1개**: 기존 `WatchVideo`를 재사용하지 않는 걸 권장. `WatchVideo`의
  `round`/`seasonId`/`awardRank`/`publicScore`/`voteCount` 같은 필드는 홍보영상엔 의미가 없어서
  억지로 null/dummy로 채우면 그 자체가 또 다른 혼선원이 된다. 완전히 별도의
  `ShowcaseVideo { id, videoUrl, caption, thumbnailUrl, postedAt }` 정도의 최소 타입 권장.
- **UI 섹션 1곳**: `app/watch/ArenaWatch.tsx`에 참가작 그리드(`seasons: WatchSeasonGroup[]`)와
  물리적으로 분리된 별도 레일/섹션. "OXXOVO Showcase" 류 헤딩 + 다른 카드 스타일(예선/본선 배지,
  점수, 투표 버튼이 아예 없는 형태가 자연스러움 -- 그런 데이터가 애초에 없으므로 자연히 다르게
  보임).
- **`page.tsx` 호출 지점 1곳**: 새 함수 호출 추가.
- **DB는 원칙상 0 변경.** 큐레이션(84편 전부 노출 vs 수동 선별)을 원하면 `promo_videos`에
  `ADD COLUMN IF NOT EXISTS watch_showcase BOOLEAN NOT NULL DEFAULT false` 하나 추가하는 선택지가
  있음 -- 이건 엔지니어링 판단이 아니라 TK 결정(§4).
- **RLS/GRANT 변경 불필요.** 현재 `promo_videos`는 `authenticated`+`is_admin()`만 SELECT
  가능(`reports/promo_videos_migration_2026-06.sql:61-67`) -- anon 권한이 없다. 하지만 Watch는
  애초에 `genesis_applications`도 anon 권한 없이 service-role 서버 클라이언트로만 읽는
  구조([[feedback-server-side-anon-rls-trap]] 패턴 그대로) -- 그 패턴을 promo_videos에도 똑같이
  적용하면 되고, seasons_public 같은 별도 공개 뷰나 GRANT 변경이 필요 없다.

## ③ promo_videos를 그대로 읽나, genesis_applications에 복사하나 -- 그대로 읽는다

**복사하면 오늘 겪은 혼선이 정확히 재발한다.** 근거는 위 ①의 `_watch_demo_insert.mjs` 그 자체다
-- promo/demo 콘텐츠를 참가작 테이블에 가짜 행으로 넣는 방식이 정확히 season_test 픽스처가 공개
피드로 새는 경로였고, 오늘에서야 막았다. 복사를 또 쓰면:

1. 참가작이 아닌 콘텐츠가 참가작 테이블에 존재 -> 시즌 카운트/집계, 실격 게이트, 리더보드처럼
   "참가작 전용"으로 짠 코드가 실수로 이 행을 건드릴 표면이 다시 생긴다.
2. 원본(`promo_videos`)과 사본(`genesis_applications`) 두 곳에 상태가 갈라진다 -- `approved`가
   나중에 바뀌면 복사본은 안 따라감, 어느 쪽이 진실인지 다시 헷갈리는 문제가 그대로 재현.
3. `promo_videos`는 이미 `approved`/`caption`/`channels`/`posted_at` 같은 운영 상태를 갖고 있다
   -- 그걸 복사하면 동기화 로직이 또 다른 버그 표면이 된다.

**직접 읽으면 `genesis_applications`를 아예 안 건드리므로, 시즌/픽스처/참가작 로직과 물리적으로
분리된다 -- 오늘 같은 사고 클래스가 설계상 원천적으로 안 생긴다.**

## ④ TK 결정 필요 (설계만이라 여기서 멈춤)

1. 84편 전부 자동 노출(`approved=true` 전부) vs 수동 선별(`watch_showcase` 플래그 컬럼 추가)?
2. 쇼케이스 카드에 좋아요/조회수 같은 소셜 기능을 붙일지, 아니면 순수 전시(재생만)로 둘지?
3. 섹션 배치 -- 참가작 그리드 위(항상 보임) vs 참가작이 하나도 없을 때만(9/9 이후 자연 소멸)?

관련: [[project_watch_system]] [[feedback_watch_data_no_delete]] [[feedback_server_side_anon_rls_trap]]
