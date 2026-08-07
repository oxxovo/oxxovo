# /api/apply 외부 URL 차단 배선 — 지수2A 인계

**2026-08-06 · 작성 지수 본체 · 본부 지시로 인계.**
자족 문서다. `external_url_block_design_2026-08-04.md` 를 안 읽어도 이것만으로 된다.

---

## 0. 지금 상태 — DB 는 이미 닫혔다

TK Run 완료 (2026-08-04, RETURNING 1행 확인):

```
season_0.allowed_video_platforms = ['studio']     (이전: youtube/vimeo/instagram/tiktok)
season_1~4                        = 기존 4개 유지
CHECK 제약                        = cardinality(...) >= 1 하나뿐. 값 제한 없음 → 'studio' 통과
```

그래서 **본선은 코드 0줄로 이미 닫혔다** — `submitMainRound`
(`app/profile/actions.ts:497`) 가 이미 `validateVideoUrl(url, season.allowed_video_platforms)`
를 부른다. `['studio']` 는 어떤 URL 과도 매치되지 않으므로 전부 `not_allowed`.

**남은 구멍은 예선 `POST /api/apply` 하나다.** 이 경로에는 URL 검증이 아예 없다 —
`free_entry_url` 이 `required` 배열의 빈값 검사만 통과하면 임의 문자열이 그대로
INSERT 된다 (`app/api/apply/route.ts:68~85`, `141`).

★**마이그레이션 순서 문제는 없다.** DB 가 먼저 갔으므로 지금은 코드만 push 하면 된다
([[feedback-migration-before-code-push]] 의 역순 위험 없음).

---

## 1. 서버 배선 — `app/api/apply/route.ts` 3지점

### 1-1. import (`:14`)

```ts
import { parseVideoUrl, validateVideoUrl } from '@/lib/video-url'
```

### 1-2. 에러 코드 (`ApplyErrorCode` union, `:27~40`)

```ts
  | 'video_platform_not_allowed'
```

문구는 클라이언트가 갖는다 — `t.profile.apply_err_video_platform_not_allowed` 를
`lib/admin-i18n.ts` 의 ko/en 두 곳에 추가하고 `app/apply/page.tsx:205` 근처의
에러 맵에 배선. (서버는 상태, 클라이언트는 문구 — 기존 패턴 그대로.)

### 1-3. 게이트 위치 — `duration_range` 직후(`:125`), 정원 조회 직전(`:127`)

`season` 이 해석된 뒤여야 하고(`:105~111`), 정원/waitlist 계산 전에 튕겨야 한다.

```ts
    // 외부 URL 접수 차단. 허용 소스는 seasons.allowed_video_platforms 가 정한다 --
    // season_0 은 ['studio'] 라 외부 플랫폼 URL 이 전부 not_allowed 로 떨어진다.
    // 하드코딩 금지: 코드는 컬럼만 읽는다.
    //
    // 이 경로(/api/apply)는 외부 URL 접수 전용이다. Studio 제출은
    // submitRender/submitGeneration 으로 들어오므로 여기를 지나지 않는다.
    //
    // ?? [] 는 fail-closed 다: 컬럼이 없거나 NULL 이면 전부 거부한다. 게이트가
    // 값의 존재를 전제하지 않는다.
    const urlCheck = validateVideoUrl(
      String(body.free_entry_url),
      season.allowed_video_platforms ?? [],
    )
    if (!urlCheck.valid) {
      return NextResponse.json(
        { error: 'video_platform_not_allowed', detail: urlCheck.error },
        { status: 403 },
      )
    }
```

`urlCheck.error` 세 값 전부 거부 대상이다:
`not_allowed`(플랫폼은 알겠는데 허용 밖) / `unknown_platform`(파싱 불가한 임의 문자열,
지금 뚫려 있는 바로 그 케이스) / `empty`(이미 위 required 검사에 걸리므로 도달 불가).

---

## 2. ✅ 전제 실측 완료 (2026-08-06, 본부 지시) — 통과다

`season` 은 `getSeasonById`/`getCurrentSeason` 이 **`seasons_public` 뷰**에서
`select('*')` 로 가져온다 (`lib/seasons.ts:259, 297`). 뷰가 이 컬럼을 노출하지
않으면 `undefined ?? []` → **모든 시즌의 모든 접수가 403** 이 된다. 게이트는 옳게
fail-closed 지만, 그 상태로 배포하면 접수가 통째로 멈춘다. 그래서 실측했다.

읽기 전용 프로브 (앱과 **같은 anon 경로**, `NEXT_PUBLIC_SUPABASE_ANON_KEY`):

```
anon         HTTP 200 | cols 66 | allowed_video_platforms: YES  value=["studio"]
service_role HTTP 403 | 42501 permission denied for view seasons_public
```

→ **배선해도 된다.** 컬럼이 있고, 값이 `["studio"]` 로 라이브에 들어와 있는 것까지
같은 쿼리로 확인됐다.

★**service_role 403 은 별개 사실이고, 어제 Q3 와 같은 계열이다** — `seasons_public`
은 anon/authenticated 에만 GRANT 돼 있다. `/api/apply` 경로는 anon 클라이언트로
읽으므로 **영향 없다.** 다만 **서버 코드가 service_role 로 이 뷰를 읽으려 하면
그 자리에서 42501 로 죽는다.** 새 코드에서 `createSupabaseAdmin()` 으로
`seasons_public` 을 읽지 마라 — service_role 이 필요한 읽기는 base `seasons` 테이블로.

★뷰 컬럼 66개 중 `main_round_twist` 는 **없다**(비밀 유지 정상). `main_round_theme`
는 **있다** — 2026-07-12 TK 결정으로 공개 티저가 된 것이라 정상이다
(`reports/main_round_theme_public_2026-07.sql`). `lib/seasons.ts:255~258` 주석이
아직 "뷰가 main_round_theme 를 제외한다"고 말하는데 **그 주석이 스테일**이다.

---

## 3. ★새로 찾은 것 — 클라이언트에 두 번째 진실원천이 있다 (설계 문서에 없던 사실)

`app/apply/page.tsx:44`

```ts
// Application stage accepts youtube/vimeo only — main round policy lives in
// seasons.allowed_video_platforms and is a separate decision.
const APPLICATION_ALLOWED_PLATFORMS = ['youtube', 'vimeo']
```

`:121~124` 에서 이 **하드코딩 배열**로 검증한다. 즉 `/apply` 폼은
`season.allowed_video_platforms` 를 **한 번도 안 본다.** 컬럼을 `['studio']` 로
바꿔도 화면은 그대로다:

- 라벨 `:372` — "Video URL (YouTube / Vimeo)"
- 경고 `:383` — "Only YouTube or Vimeo URLs are accepted."
- 성공 `:388` — 유튜브 URL 에 "✓ YouTube URL detected" 초록불

→ 지금 배선하면 **화면은 통과라고 하고 서버는 403** 인 상태가 된다. 서버 게이트만
넣고 화면을 안 고치면 그게 최악이다.

**본부 판정(2026-08-04, 2026-08-06 재확인)**: 화면에서도 외부 URL 입력 경로를
제거한다. 서버 게이트는 그대로 유지한다 — **막는 것은 서버, 지우는 것은 UX.
둘 다 있어야 한다.**

### ★필수 조건 (판단 사항 아님 — 본부 2026-08-06 승인)

**`APPLICATION_ALLOWED_PLATFORMS` 상수 자체를 삭제한다.** 값을 `['studio']` 로
바꾸거나, 조건문으로 우회하거나, 주석 처리해 남겨두는 것 전부 아니다. **지운다.**

이유는 UX 가 아니라 정합성이다. 이 상수가 살아 있는 한 "예선에서 무엇이 허용되는가"에
답이 둘이고, 하나는 DB(시즌별로 변함), 하나는 코드(고정)다. 두 답이 어긋나는 날은
이미 왔다 — 지금이 그날이다. 시즌1 이 외부 URL 을 다시 열어도 이 상수가 남아 있으면
같은 사고가 반대 방향으로 난다 ([[feedback-no-hardcode]]).

허용 소스를 화면에 표시할 일이 남으면 `season.allowed_video_platforms` 를 읽어라 —
`MainRoundCard` 가 이미 그렇게 한다(`:172`, `:277`).

### 판단 사항 (지수2A)

**문구와 배선 방식만** — 입력란 제거 / 폼 전체 대체 / Studio 로 유도하는 안내 중
무엇을 쓸지, 문구를 뭐라 쓸지.

---

## 4. 부수 영향 2건

1. **`PLATFORM_DISPLAY_NAMES` 에 `studio` 가 없다** (`lib/video-url.ts:96~101`).
   `formatVideoPlatforms(['studio'])` → 화면에 소문자 `"studio"` 그대로 찍힌다.
   호출 지점: `app/profile/MainRoundCard.tsx:277`(허용 플랫폼 안내), `:305`(감지 표시).
   → `studio: 'OXXOVO Studio'` 추가 권장.

2. **본선 폼(`MainRoundCard`)이 이제 아무 URL 도 못 받는다** — 의도된 결과지만
   (`:172` 가 같은 컬럼으로 클라이언트 검증), 화면에는 "URL 을 넣어라"고 쓰여 있고
   무엇을 넣어도 거절당한다. `season_0.studio_round='both'` 라 본선 제출도 Studio
   경로다. **이 화면 처리는 Studio 담당(2A/2C) 판단** — 여기서는 사실만 넘긴다.

---

## 5. 검증 (실행 불필요·무비용)

1. `npx tsc --noEmit` 0.
2. `season_0` 대상 `POST /api/apply`:
   - 유튜브 URL → **403 `video_platform_not_allowed`** (detail `not_allowed`)
   - 임의 문자열 → **403** (detail `unknown_platform`) ← 지금 200 으로 통과하는 케이스
3. `season_1`(컬럼 = 4개 유지) 대상 유튜브 URL → **통과**. 시즌별로 다르게
   동작해야 하드코딩이 아니라는 증거가 된다.
4. `/apply` 화면에 외부 URL 입력 경로가 남아 있지 않은지 육안.

---

## 6. 이 세션(지수 본체)이 안 하는 것

`feat/studio-budget-guard` 를 공유 중이라 **앱 레포 커밋은 이 세션이 하지 않는다.**
위 전부 지수2A 몫. 서버 게이트 배선(§1)은 원문 그대로 써도 되고, 게이트 위치(§1-3)와
fail-closed 사전 확인(§2)만 지키면 나머지는 판단 사항이다.

관련: [[feedback-no-hardcode]] · [[feedback-seasons-public-view]] ·
[[feedback-db-object-absence-unprovable-by-repo]] ·
[[project-studio-prelaunch-apply-moderation]]
