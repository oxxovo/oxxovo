# 홍보영상 자동 발행 — 승인 게이트 설계 (2026-08-14)

`reports/promo_full_auto_design_2026-06.md`(6/10)를 대체하지 않는다 -- 그 문서는 ①~③단계
(지수3 워커: fal 생성→ffmpeg 합성→보관)의 계약서로 여전히 유효하다. 이 문서는 **그 다음
층, 승인→발행 레이어만** 다시 설계한다. 이유: 6/10 문서의 `promo_auto_publish_enabled`
("ready면 자동승인")가 오늘 본부가 재확인한 불변식과 정면 충돌한다.

## 0. 불변식 (다시 확정)

**승인 없으면 자동은 아무것도 안 올린다.** 빠뜨렸을 때 안 나가는 쪽으로 실패한다 (나가는
쪽으로 실패하지 않는다). 이 불변식은 `promo_auto_publish_enabled`나 그 어떤 스위치로도
우회할 수 없다 -- 스위치가 결정하는 건 "언제/얼마나 자주 발행하냐"이지 "승인을 건너뛰냐"가
아니다.

6/10 문서 §1의 해당 항목을 이렇게 정정한다:

> ~~`promo_auto_publish_enabled`(false=보관만, OPERATIONS §3 준수)~~ →
> **삭제.** 대신 §3의 cadence 값(주 발행 횟수)이 0이면 발행이 자연히 멈춘다. 별도
> on/off 스위치를 만들지 않는다 -- "0회"가 "잠시 끄기"의 방법이다.

## 1. 지금 없는 것 4개 (실측, `promo_videos_migration_2026-06.sql` + `app/admin/promo/`)

현재 코드를 읽은 결과:

1. **승인 기록이 없다.** `promo_videos`에 `approved`/`approved_by`/`approved_at` 컬럼
   자체가 없음(`reports/promo_videos_migration_2026-06.sql` 전문 확인).
2. **캡션·채널이 영속화되지 않는다.** `app/api/admin/promo/publish/route.ts:31,37,61`은
   `caption`/`channels`를 요청 바디에서만 받아 그 자리에서 바로 게시한다 -- DB에 저장하는
   컬럼이 없다. 그래서 "미리 수정해서 승인해두고 나중에 자동으로 나가게" 하는 흐름이
   구조적으로 불가능하다(저장할 곳이 없다).
3. **자동 발행 실행기가 없다.** cron이 `promo_videos`를 도는 코드가 아직 0줄
   (`app/api/cron/`에 promo 관련 route 없음, `season-tick`/`email-tick`/`broadcast-tick`
   셋뿐).
4. **발행 이력이 없다.** `postiz_post_id`/`posted_channels`/`posted_at` 3컬럼은
   "마지막 1회 발행"의 스냅샷이지, 시도-실패-재시도를 남기는 append-only 로그가 아니다.
   같은 영상을 다시 게시하거나 실패 후 재시도하면 이전 기록이 덮어써진다.

## 1.5 기존 93행은 어떻게 되나 (본부 확인 ①, 2026-08-14)

`approved BOOLEAN NOT NULL DEFAULT false`로 컬럼을 추가하면 **기존 행 전부가
`approved=false`로 시작한다** -- 명시적 의도다. "기존 것은 전부 미승인에서
시작한다"가 이 설계의 전제다. 지금까지 `posted_at`이 채워진 행이 0건이라(실측은
아래 BLOCK 0에서 확인) 실제 피해는 없다 -- 이미 발행된 걸 소급으로 승인 요구하는
상황이 아니다. 마이그 실행 후 93행을 한 번에 승인하고 싶다면 별도 일괄 승인 SQL을
대표님이 원할 때 요청하면 된다(이번 초안엔 포함 안 함 -- 승인은 각 건을 검수한
결과여야 하므로 일괄 승인을 기본값으로 만들지 않는다).

## 1.6 수동 발행 UI (본부 확인 ②, 2026-08-14)

수동 발행 라우트도 `approved=true`를 요구한다 -- 그렇지 않으면 자동 경로만 막고
수동이 우회로가 된다. 다만 이 때문에 대표님이 급히 한 편을 올릴 때 "승인 → 발행"
두 번 눌러야 하므로, **UI에서 이 둘을 한 카드 안에 같이 보여준다**:

- 카드 하나 = 영상 1개. 그 안에 캡션/채널 입력 + 저장, 승인 토글, 발행 버튼이
  전부 같은 카드에 있다(별도 탭/페이지로 흩어지지 않음).
- 미승인 상태에서는 **발행 버튼이 비활성화되고, 옆에 "먼저 승인하세요" 같은
  안내가 바로 보인다** -- 버튼이 숨거나 에러로만 알려주면 "왜 안 나가지"로
  막히기 때문. 승인 토글을 켜는 순간 발행 버튼이 즉시 활성화된다(페이지 새로고침
  불필요).
- 급한 경우 실제 동작 = 승인 토글 켜기 → 같은 카드에서 바로 발행 버튼 클릭.
  두 클릭이지만 같은 화면, 같은 카드 안에서 끝난다.

## 2. 스키마 (ADD-only, 초안 -- SQL 실행은 대표님)

전문은 `reports/promo_publish_schema_2026-08-14.sql`. 요지:

### `promo_videos` 확장
```
approved         boolean not null default false   -- ★유일한 발행 게이트
approved_by      uuid references profiles(id)
approved_at      timestamptz
caption          text                              -- 영속화, 미리 수정 가능
channels         text[]                            -- postiz 채널 id 배열, 미리 선택
```
`approved`는 반드시 admin의 명시적 행동(승인 버튼)으로만 true가 된다. 생성/업로드
시점의 기본값은 `false` -- 6/10 문서의 "ready=자동승인"과 정확히 반대.

### 신규 `promo_publish_log` (append-only 발행 이력)
```
id               uuid pk
promo_video_id   uuid references promo_videos(id)
attempted_at     timestamptz not null default now()
triggered_by     text check in ('cron','manual')
channels         text[]
caption          text
status           text check in ('success','failed')
postiz_post_id   text
error_message    text
```
`promo_videos.postiz_post_id/posted_channels/posted_at`는 "지금 상태"용으로 남기고
(UI 목록에서 바로 보여줄 값), 시도 전체 역사는 이 테이블이 가진다. 같은 영상이
재시도되거나 재게시돼도 행이 쌓인다 -- 덮어쓰지 않는다.

### `platform_config` 신규 키 (하드코딩 금지, 전부 어드민에서 바뀜)
```
promo_publish_weekdays    text   예: 'mon,wed,fri'  (빈 문자열 = 0회 = 발행 정지)
promo_publish_time        text   예: '18:00'         (HH:MM, 24h)
promo_publish_timezone    text   예: 'Asia/Seoul'    (IANA 이름, 필수 -- 묵시적 서버TZ 금지)
```
별도 `promo_auto_publish_enabled` bool 없음(위 §0). `promo_publish_weekdays`가 빈
문자열이면 그게 곧 "0회/정지"다. 값 파싱은 기존 `lib/partners.ts getPlatformConfigMap`
패턴 그대로(콤마 CSV는 `registration_reminder_days`류 배열 컬럼과 다른 지점 --
`platform_config.value`는 text 하나뿐이라 여기선 CSV 문자열로 저장하고 읽는 쪽에서
`.split(',')`).

## 3. 실행 흐름

```
어드민이 캡션+채널 입력 → 저장(persist, 아직 미승인)
  → 검수 후 "승인" 버튼 → approved=true, approved_by, approved_at 기록
     (승인 취소도 가능해야 함 -- approved=false로 되돌리는 액션도 같이)
  → cron(promo-schedule, 신규)이 매시 정각 깨어남(season-tick과 같은 주기)
     → 지금 시각이 promo_publish_timezone 기준 promo_publish_weekdays 중 하루의
       promo_publish_time과 같은 시간대(hour) 안인가?
     → approved=true AND posted_at IS NULL인 행 중 가장 오래 기다린 것 1개
     → 있으면: 그 행에 저장된 caption/channels 그대로 Postiz 발행
       (요청 바디로 새 캡션을 받지 않는다 -- 저장된 값이 유일한 소스)
     → 성공/실패 무관 promo_publish_log에 1행 기록(triggered_by='cron')
     → 성공 시 promo_videos.postiz_post_id/posted_channels/posted_at 갱신
   승인된 게 없으면: 아무 일도 안 함(로그도 안 남김 -- "낼 게 없어서 조용함"과
   "고장나서 조용함"을 가르는 문제는 [[feedback_absent_is_not_zero]] 계열이라, 이
   경우는 "이번 슬롯에 승인된 영상 0개"를 report에 한 줄 남긴다 -- season-tick의
   report 패턴 재사용).
```

수동 발행(기존 `/api/admin/promo/publish`)은 그대로 남긴다 -- 급할 때 대표님이
즉시 게시하는 경로. 단 이 라우트도 **`approved=true`가 아니면 거부**하도록 게이트를
추가한다(지금은 approved 개념 자체가 없어 게이트가 없다). 수동 발행도
`promo_publish_log`에 `triggered_by='manual'`로 기록.

## 4. `/admin/promo` UI 변경

- 각 영상 카드: 캡션 입력창 + 채널 체크박스 → **저장** 버튼(발행과 분리된 액션,
  `updatePromoMetaAction`) → **승인** 토글(별도 액션, `setPromoApprovedAction`).
  "저장했다"가 "승인했다"를 의미하지 않는다 -- 둘은 별개 커밋.
- 목록 상단에 검색창(`?q=` searchParams, `theme_note ILIKE`) -- `/admin/music`의
  기존 패턴(`app/admin/music/page.tsx`, `lib/music-curation.ts`) 그대로 재사용,
  새 패턴 발명 안 함. 지금 100행 cap(`page.tsx:16` `.limit(100)`)이라 서버사이드
  검색이 필요한 시점은 곧 옴.
- cadence 설정(요일/시각/시간대)은 `/admin/settings` 류 platform_config 편집 화면이
  이미 있으면 거기 얹고, 없으면 `/admin/promo`에 별도 섹션으로.

## 5. 확인해야 할 것 (본부 지시 -- "어드민에서 바꾼 값이 언제 반영되나")

`/studio` 404(2026-08-13, `bba544b`)는 세션6 스위치를 정적 빌드에 구워버려서 난
사고였다 -- 같은 클래스의 함정이 여기도 있다:

- `app/admin/promo/page.tsx`는 **지금 `force-dynamic`이 없다**(2026-08-14 확인,
  `export const dynamic` 없음). `/admin/music/page.tsx`·`/admin/watch-videos/page.tsx`
  등 다른 admin 페이지들은 있다 -- promo만 빠져있다. 새로 만드는 캡션/채널/승인
  UI가 이 페이지에 얹히니, **착수 시 `force-dynamic` 추가를 1번 항목으로 넣는다**
  (지금 당장 고치지 않음 -- 이번 창은 조회+설계까지).
- 신규 `promo-schedule` cron route도 `season-tick`/`email-tick`처럼 `force-dynamic`을
  처음부터 명시한다(둘 다 이미 그렇게 돼 있음, 확인함).
- 검증 방법은 `/studio` 때와 동일해야 함: "설정을 저장했다"≠"그 값으로 돈다".
  `next build` 산출물에서 해당 라우트가 ○(static)가 아니라 ƒ(dynamic)로 나오는지
  직접 확인 -- 이번 세션에서 실측 완료된 방법론([[feedback_stale_record_as_gate]]),
  코드 작성 시점에 재사용.
- 이 리포지토리는 훈련 데이터의 Next.js와 다르다(`AGENTS.md`) -- 실측 확인:
  `next.config.ts`에 `cacheComponents`가 꺼져 있어 구모델(`force-dynamic` 라우트
  세그먼트 컨픽) 그대로 유효함. `node_modules/next/dist/docs/01-app/02-guides/
  caching-without-cache-components.md` 참조.

## 6. 남은 것 (이번 설계 범위 밖)

- 지수3(oxxovo-promo) 워커 자체의 fal 생성/ffmpeg 합성은 6/10 문서 그대로 -- 이번
  설계는 그 산출물이 `promo_videos`에 `ready`로 들어온 **이후**만 다룬다.
- 문안/캡션 초안 작성은 제니3 몫(6/10 문서와 동일하게 자리만 만든다).
- cadence 값을 실제로 바꿔서 발행 시각이 따라오는지 대조군 검증은 코드 착수 후.

관련: `reports/promo_full_auto_design_2026-06.md` ·
[[project_admin_promo]] · [[feedback_no_hardcode]] · [[feedback_stale_record_as_gate]] ·
[[feedback_absent_is_not_zero]]
