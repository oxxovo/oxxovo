# seasons.aspect_ratio 컬럼 + 에디터 토글, 그리고 같은 병인 길이 게이트 (설계만, 2026-08-27)

설계 문서. 코드/마이그레이션 미실행 — TK 승인 후 별도 작업.

**★2026-08-27 TK 판정 2로 확정**: A=(나) 강제, B=②재사용. 아래 각 절 반영. B는 TK 질문
("예선용 길이 컬럼이 무엇인가")에 대한 실측 답변도 포함.

## 공통 진단: "설정이 게이트에 안 닿는다"

두 항목 모두 같은 모양의 결함이다: **DB에 값(또는 값을 넣을 자리)이 있는데, 실제로 강제하는
코드 경로가 다른 값을 읽거나, 그 값을 아예 안 읽는다.** 화면(에디터 기본값 / 공지 문구)과 실제
게이트(서버 검증)가 서로 다른 소스를 본다.

---

## A. `seasons.aspect_ratio` 컬럼 + 에디터 토글 연결

### 현재 상태 (실측)

- 출력 비율 토글은 **이미 에디터에 있고 동작한다.** `app/studio/compose/ProComposeEditor.tsx:662`
  `const [aspect, setAspect] = useState<Aspect>('16:9')`, 버튼 UI는 같은 파일 1696-1699행.
  참가자가 16:9/9:16을 자유롭게 고를 수 있고, 그 값이 EDL의 `aspect` 필드로 저장된다
  (`lib/studio.ts:1854`).
- **진짜 과녁은 "시즌별 기본값/강제"가 없다는 것.** `seasons` 테이블에 종횡비 관련 컬럼이 전혀
  없다(전수 grep, 0건). 그래서 에디터 초기값은 시즌이 무엇이든 항상 하드코딩된 `'16:9'`다 —
  9:16 위주로 기획된 시즌이 와도 참가자는 매번 수동으로 눌러서 바꿔야 하고, "이 시즌은 9:16만
  받는다" 같은 강제는 아예 표현할 방법이 없다.
- 렌더 쪽(`oxxovo-studio/src/render.ts:373-376`)은 이미 `STUDIO_OUTPUT_CANVAS['16:9'|'9:16']`
  로 두 값 다 1080p급으로 지원하니, 렌더러는 준비돼 있다. 비어 있는 건 **시즌 설정 → 에디터
  기본값**을 잇는 다리 하나뿐이다.

### 설계안

1. **컬럼**: `seasons.aspect_ratio` — nullable enum, `'16:9' | '9:16' | NULL`.
   - `NULL` = "참가자 자유 선택" (오늘의 동작과 100% 동일, 회귀 없음).
   - 값이 있으면 그 값을 에디터 초기값으로 사용.
   - **강제(lock)까지 할지, 기본값 제시만 할지는 TK 결정 필요** — 아래 두 옵션 참조.
2. **읽는 경로**: `lib/studio.ts`의 `SeasonStudioConfig`/`getSeasonStudioConfig()`
   (`lib/studio.ts:141`, `:428`)에 `aspectRatio: '16:9' | '9:16' | null` 필드 추가. 이미
   같은 함수가 `studio_round`부터 `studio_compose_*`까지 시즌 설정을 한 번에 읽어오는 자리이므로,
   새 select 컬럼 하나 추가하는 정도의 변경.
3. **에디터 연결**: `ProComposeEditor.tsx`가 이 값을 초기 렌더 시 받아서
   `useState<Aspect>('16:9')`의 기본값 대신 시즌 값(있으면)으로 시드. 기존 임시저장/undo 로직
   (`draftAspect`, 662/795/1165행)과 같은 패턴이라 충돌 없음.
4. **★확정 (TK 판정 2): (나) 강제(lock).** 근거 — ⓐ 대표님 확정이 "9:16 하나로 간다"이고
   (가)처럼 기본값만 주면 참가자가 토글로 16:9를 골라 규격 위반작이 나올 수 있음. ⓑ FAQ 문안이
   이미 "세로입니다"로 되어 있어(단정문), 강제가 아니면 그 문장 자체가 거짓이 됨. 구현:
   - `aspect_ratio`가 non-null이면 에디터의 16:9/9:16 토글 버튼을 **숨기지 말고 잠금 상태로
     보여준다** — 두 버튼 다 렌더링하되 시즌이 강제한 쪽만 활성/선택 표시, 나머지는 disabled +
     "이 시즌은 {9:16}로 고정되어 있습니다" 같은 이유 문구. 토글 자체를 안 보이게 지우면 참가자가
     "왜 하나만 있지"를 스스로 못 알게 되므로, 숨기지 말라는 지시와 일치.
   - 서버 쪽 `createRender`(`lib/studio.ts:1854-1855` 근처)도 `args.edl.aspect`가 시즌 강제값과
     다르면 거부 — 새 사유 코드(예: `aspect_locked`) 하나 추가.
   - 나중에 16:9 위주 시즌을 열 때는 그 시즌 행의 `aspect_ratio`를 `'16:9'`로 넣으면 그 값으로
     잠기고, 별도 코드 분기 없이 그대로 동작 — 컬럼 값 하나로 전환되는 구조.
5. **admin 입력**: `app/admin/seasons/SeasonForm.tsx`에 라디오/드롭다운 한 줄 추가(플랫폼
   체크박스처럼 닫힌 선택지 — [[feedback-absent-is-not-zero]]: 드롭다운은 "미선택"을 못 그리니,
   NULL을 표현하려면 "자유 선택" 옵션을 명시적 라디오 항목으로 넣을 것).
6. **마이그레이션**: 컬럼 추가 + DEFAULT NULL, 기존 시즌 전부 무영향. `season-schema.ts`에 옵셔널
   enum 필드 추가.

### 영향 범위 확인

`edl.aspect`가 없으면 워커가 레거시 `canvasFromProbes`(가장 작은 소스 크기 따라감)로 폴백한다
(`oxxovo-studio/src/render.ts` 928행 주변 주석). 이번 설계는 "에디터 초기값"만 건드리므로
`edl.aspect`는 참가자가 실제로 저장한 값 그대로 EDL에 실리고, 이 폴백 경로 자체는 손대지 않는다.

---

## B. 길이 게이트 불일치 — 같은 병, 다른 자리

### 현재 상태 (실측, file:line)

- `getSeasonStudioConfig()` (`lib/studio.ts:428-451`)는 이미 라운드별 값
  (`application_video_min/max_seconds`, `main_round_video_min/max_seconds`)과
  `studio_compose_min/max_seconds`를 **전부** 읽어 온다. `videoBoundsForRound()`
  (`lib/studio.ts:175-184`)도 이미 존재해서 라운드에 맞는 쌍을 골라준다 — 이 세 조각은 이미
  코드에 있다.
- **그런데 이 조합은 클립 하나(개별 생성)의 길이에만 쓰인다.** `createGeneration`
  (`lib/studio.ts:649-660`)의 자기 주석이 명시: "compose 모드에서는 클립이 빌딩블록이고, 합성
  최종 길이는 `studio_compose_min/max_seconds`가 별도로 게이트한다 — 그래서 compose가 켜져
  있으면 라운드별 S-7 검사(위 세 조각)는 **스킵한다**." 이건 버그가 아니라 설계대로다: 클립 자체가
  35~40초일 필요는 없다.
- **진짜 구멍은 "합성된 최종본"쪽.** `createRender`(`lib/studio.ts:1802-1851`)와
  `submitRender`(`lib/studio.ts:2249-2261`) 둘 다 시즌에서 **`studio_compose_min/max_seconds`
  단 하나만** 읽는다(`lib/studio.ts:1821`, `:2252`) — `main_round_video_*`/
  `application_video_*`는 이 두 함수 어디에서도 select되지 않는다. 즉 최종 합성본의 길이는
  **라운드 구분 없이 항상 시즌당 하나의 값**으로만 걸린다.
- season_0 라이브 값(2026-08-27, 직접 조회):
  ```
  application_video_min/max_seconds = 15 / 30   (예선)
  main_round_video_min/max_seconds  = 35 / 40   (본선)
  studio_compose_min/max_seconds    = 30 / 40   (제3의 값, 어느 쪽과도 안 맞음)
  ```
  **어제(2026-08-26) 대표님이 본선 35~40초로 확정하셨지만, 실제로 제출을 막는 숫자는 여전히
  30/40이다.** 예선용 20초 영상(공지 15-30초 범위 안)이 오거부될 수 있고, 본선용 32초 영상(공지
  35-40 미만이라 안 됨)이 오통과될 수 있다.

### ★TK 질문에 대한 답: 예선용 길이 컬럼이 무엇인가

**`application_video_min_seconds`/`application_video_max_seconds`(15/30)가 예선용 컬럼이고,
이미 살아서 쓰이고 있다.** `studio_compose_*`가 예선용을 대신해 온 게 아니다 — 셋은 서로 다른
값이고(15/30 vs 35/40 vs 30/40), `application_video_*`는:
- `getSeasonStudioConfig()`가 이미 읽고(`lib/studio.ts:432, 443-444`), `videoBoundsForRound()`가
  이미 'application' 라운드에 매핑해 준다(`lib/studio.ts:182-183`).
- **공개 문구 여러 곳이 이 컬럼 값을 그대로 노출한다**: `app/rules/page.tsx:128`,
  `app/apply/page.tsx:167-168`, `app/tournament/SeasonDetail.tsx:133,196`,
  `app/_landing/LandingView.tsx:396,466`(FAQ) 전부 `season.application_video_min/max_seconds`를
  직접 읽어 "15–30 seconds"를 표시한다. 죽은 컬럼이 아니라 지금 이 순간 참가자에게 보여주는 실제
  숫자다.
- 다만 **compose가 켜져 있으면(`studioComposeEnabled`) 이 값은 클립 생성 단계(S-7)에서
  스킵된다**(`lib/studio.ts:656`, `createGeneration`의 자기 주석) — "클립 하나의 길이"에는 원래도
  안 걸렸다. 문제는 **"합성된 최종본의 길이"에도 안 걸린다는 것** — `createRender`/`submitRender`가
  이 컬럼을 아예 select하지 않기 때문이다.

즉 `studio_compose_min/max_seconds(30/40)`는 예선/본선 어느 쪽의 대리도 아니고, 둘 다와 다른
**제3의 숫자**다. 아마 예선(15/30)과 본선(35/40)이 나오기 전, 시즌당 값 하나면 충분하던 시절에
설정된 값이 라운드 분화 이후에도 갱신 안 된 채 남은 것으로 보인다(정확한 유래는 마이그레이션 이력
확인 필요, 이 문서에서는 근거 없이 추정하지 않음).

### 이 함수의 자기 주석이 말하는 설계 의도

`SeasonStudioConfig`의 `studioComposeMinSeconds`/`MaxSeconds` 필드 주석(`lib/studio.ts:166-168`):
"합성된 최종본의 길이 범위... 권위는 createRender/submitRender이고, 이 UI용 사본이 존재하는 건
UI가 하드코딩 없이 규칙을 말하게 하려는 것뿐." — 즉 **원래 설계는 `studio_compose_*`가 유일한
권위였고, 라운드 구분은 애초에 고려 대상이 아니었던 것**으로 읽힌다. 이후 `studio_round='both'`
(예선+본선 둘 다 compose 사용)가 생기면서, "예선 compose"와 "본선 compose"가 서로 다른 길이
규정을 가져야 하는 상황이 됐는데 `studio_compose_*`는 여전히 시즌당 값 하나뿐이다 — A(종횡비)와
정확히 같은 모양: **컬럼/코드 조각은 있는데, 라운드 분기가 그 조각까지 안 닿는다.**

### 설계안 — ★확정 (TK 판정 2): ②재사용

**진실은 하나여야 한다.** ①(컬럼 이중화)은 값을 4개로 늘리고 그중 둘(`studio_compose_main_*`)이
`main_round_video_*`와 같은 것을 또 표현하게 된다 — 이 프로젝트에서 반복해서 터진 병이 정확히
이 모양이다(배점 이중 진실, 종횡비, 날짜: 같은 값이 두 곳에 있으면 반드시 어긋난다). 그리고 위에서
확인했듯 `application_video_*`/`main_round_video_*`는 이미 살아서 공개 문구까지 먹이고 있는
**진짜 라운드별 소스**이므로, 새 컬럼을 만들 이유가 애초에 없다.

**설계**: `createRender`/`submitRender`가 각자 라운드를 판정해 라운드별 컬럼을 직접 읽는다.
1. 두 함수 모두 `getSeasonStudioConfig(seasonId)` + `resolveEffectiveRound(cfg)`를 호출한다
   (이미 `createGeneration`이 같은 패턴을 쓴다 — `lib/studio.ts:646-647`). 지금처럼
   `.from('seasons').select('studio_compose_enabled, studio_compose_min_seconds, ...')`를
   각자 복붙해 두는 대신, 이 한 번의 설정 조회로 대체한다.
2. `videoBoundsForRound(cfg, effectiveRound)`가 돌려주는 `{min, max}`를 합성 최종본의 길이
   게이트로 그대로 쓴다 — `createRender`의 2번 체크(`lib/studio.ts:1850-1851`)와
   `submitRender`의 대응 체크(`lib/studio.ts:2260-2261`) 둘 다 이 값으로 교체.
3. **`studio_compose_min_seconds`/`max_seconds` 컬럼은 게이트에서 손을 뗀다.** 지금 당장
   컬럼을 지우자는 게 아니라 — 정책이 이 값을 안 쓰게 됐다고 해서 급히 삭제할 필요는 없다 —
   다만 두 함수의 select 목록에서
   빠지고, `SeasonStudioConfig.studioComposeMinSeconds/MaxSeconds` 필드도 "게이트가 안 읽는
   사문화된 값"이라고 주석을 갱신해 다음 사람이 다시 권위로 착각하지 않게 한다.
4. `createRender`/`submitRender` 두 곳이 공유할 작은 헬퍼(예:
   `composeLengthBoundsForRound(cfg, effectiveRound)` = `videoBoundsForRound`를 그대로 부르는
   얇은 별칭이거나, 그냥 `videoBoundsForRound` 자체를 재사용)로 묶어서, 이번에도 같은 값을 두
   함수에 따로 하드코딩하지 않는다.

**주의할 점**: `application_video_*`/`main_round_video_*`는 원래 "클립 한 개"의 길이 규칙으로
설계됐던 값이다(`SeasonStudioConfig` 주석, `lib/studio.ts:155-159`). 이번 변경으로 같은 컬럼이
"클립 하나의 길이"(compose 꺼졌을 때, S-7)와 "합성 최종본의 길이"(compose 켜졌을 때) 두 가지
뜻으로 쓰이게 된다 — 값은 하나지만 **의미가 두 갈래**라는 점은 코드 주석에 명시할 것. 실제로는
자연스럽다: 예선/본선이 참가자에게 약속하는 "제출 영상 길이"는 애초에 하나의 숫자였어야 하고,
compose on/off는 그 숫자를 누가(클립 자신이냐, 합성 결과냐) 만족시키느냐의 차이일 뿐이다.

### 테스트 영향

`lib/studio-round-bounds.test.ts`(package.json test 목록에 이미 존재)가 `videoBoundsForRound`류
로직을 다루는 자리로 보인다 — 실제 착수 시 이 파일부터 확인해서 같은 패턴으로 새 테스트를 추가할 것.

---

## 착수 순서 (A=나 강제, B=②재사용 확정, 착수 승인 대기)

1. 마이그레이션 SQL 설계: A는 `seasons.aspect_ratio` 컬럼 추가(DEFAULT NULL)뿐, B는 컬럼
   추가 없음(기존 컬럼 재사용) — STEP 0 되돌리기 블록 분리해서 제출
2. 코드 변경 순서:
   - B (길이 게이트) 먼저: `createRender`/`submitRender`를 `getSeasonStudioConfig` +
     `resolveEffectiveRound` + `videoBoundsForRound`로 교체, `studio_compose_min/max_seconds`
     select 제거, 주석 갱신
   - A (종횡비 강제): `season-schema.ts` 검증 → `getSeasonStudioConfig`에 `aspectRatio` 필드 →
     `ProComposeEditor.tsx` 토글 잠금 UI(비활성 버튼 + 이유 문구) → `createRender`의
     `aspect_locked` 거부 사유 → `SeasonForm.tsx` admin 입력(라디오, "자유 선택" 명시 옵션 포함)
3. 테스트 추가: `lib/studio-round-bounds.test.ts`(B), 신규 aspect 잠금 케이스(A) — 두 함수가
   공유 헬퍼를 실제로 호출하는지까지 확인하는 구조 테스트 권장(과거 email-tick/lobby 드리프트
   사례처럼, "같은 질문을 서로 다른 곳에서 다시 묻는" 회귀를 소스 매칭으로 잡는 패턴)
4. 배포는 지금처럼 따로따로, sha 대조
