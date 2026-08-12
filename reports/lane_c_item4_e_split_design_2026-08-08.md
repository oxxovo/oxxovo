# ④-E 클립 분할(split) — 설계 (레인 C, 2026-08-08)

앱 `5114d4f` / 워커 `52faee1` 기준. ★**측정은 전부 내 트리(`feat/studio-lane-c`)에서 다시
했다** — 지수2A 판단이 A 트리 기준일 수 있다는 제니2 지적 그대로
([[feedback-check-first-scope-all-repos]]의 브랜치 축).

---

## 1. 재측정 — A 판단은 내 트리에서도 맞다

### E(split) = **0건.** ★무엇이 잡혔고 왜 아닌지

`\bsplit\b|splitClip|splitAt`로 `app/`·`lib/` 전역. 잡힌 것 전부가 **타임라인 분할이 아니다**:

| 잡힌 것 | 왜 아닌가 |
|---|---|
| `email.split('@')`, `filename.split('.')`, `fwd.split(',')` 등 | `String.prototype.split` |
| `fix_split`, `text_too_wide`의 "Split the line" | ★**자막 한 줄 나누기 안내** — 클립이 아니라 텍스트 |
| `l.content.split('\n')[0]` (TextTrack·레이어 목록) | 자막 첫 줄 표시 |
| `Prize split (%)`, "tiers split the remaining 66%" | 상금·요금 배분 |
| `(profile/work split)`, "Split out of loadComposeState" | 주석(리팩터 이력) |

→ **타임라인 클립 분할은 존재하지 않는다.**

### 나머지 다섯 — A 표와 전부 일치

| | 내 트리 실측 | 잡힌 것이 왜 그것이 아닌지 |
|---|---|---|
| **D** 키프레임 | **미착수** | `@keyframes watch-shimmer-move`(globals.css, CSS 애니메이션) · `interpolated`(멤버십 가격 문자열, `music-picker-scope` 주석). ★**키프레임 애니메이션 아님** |
| **F** TTS | **0건** | `hate speech`(가이드라인 문구) · `ElevenLabs`(전부 **음악** 벤더 이력·라이선스). ★음성합성 코드 0 |
| **G** 전환 | **부분** | `EFFECT_SPECS` **12** / `EXPOSED_SLIDERS` **8** / 미노출 **4**(`lutIntensity`·`sharpen`·`chromatic`·`motionBlur`) / `EXPOSED_TRANSITIONS` **9**. `dissolve`는 **의도적 제외**(ffmpeg float32 `sinf()` fract가 libm·GPU에 의존해 셰이더 재현 불가 — 주석에 근거 있음) |
| **H** 속도 램프 | **미착수** | `speedRamp`·`timeRemap` **0건**. 잡힌 `ramp`는 전부 **자막/음악 페이드**(`music-preview.ts`, `text-preview.ts`, `TextTrack.tsx`, `text-render.ts`) |
| **C** 종횡비 | 완료(기존) | |

★**A의 "가장 싸다" 근거(1파일·서명 불변·결정 1개)도 내 트리에서 성립한다** — 아래 2·3절이
그 근거를 실측으로 다시 세운 것이다.

---

## 2. 이 EDL에서 split이 무엇인가

`EdlSegment = {jobId, startMs, endMs}`이고 **`startMs`/`endMs`는 소스 클립 내부의 트림**이다
(서버 `createRender`: `seg.endMs > durMs + 1` → `trim exceeds clip length`).
컴포지션 시간은 `endMs - startMs`의 **누적합**이다.

즉 split은 **한 세그먼트를 같은 `jobId`의 인접한 두 세그먼트로 바꾸는 것**이다:

```
전:  [{jobId:A, startMs:0,    endMs:4000}]
후:  [{jobId:A, startMs:0,    endMs:1500},
      {jobId:A, startMs:1500, endMs:4000}]     ← 컷 지점 1500
```

★**컷 지점 계산에 모호함이 없다 — 타임라인이 speed-blind이기 때문이다.** 실측:

| 어디 | 컴포지션 길이 계산 |
|---|---|
| 편집기 `totalMs` (:704) | `Σ (endMs - startMs)` |
| 편집기 클립 폭 (:1521) | `(endMs - startMs) × pxPerSec` |
| 편집기 `segStarts` (:851) / 플레이헤드 하 세그먼트 (:954) | 같은 누적합 |
| **서버** `createRender` | `totalMs += seg.endMs - seg.startMs` |

`speed`는 **노출되어 있고**(클립당 0.25~4x 슬라이더, 서명에 `;spd=`) **길이 계산에는 안
들어간다.** 편집기와 서버가 **같은 speed-blind 모델**을 쓰므로:

```
sourceCut = seg.startMs + (playheadMs - segStarts[i])
```

★**이게 "결정"이 아니라 도출인 이유**: 만약 타임라인이 speed를 반영해 그려졌다면 컷 지점이
소스시간/타임라인시간 중 무엇이냐가 진짜 결정이 됐을 것이다. 실측 결과 양쪽이 1:1이므로
**답이 하나로 정해진다.** (speed가 길이에 반영되지 않는 것 자체는 **별건**이고 내 판단으로
바꿀 것이 아니다 — 서명·서버 게이트·KAT이 모두 그 모델 위에 서 있다. 7절에 기록만 한다.)

---

## 3. 서명 — ★"불변"의 정확한 의미

`segCanonical`은 세그먼트를 **위치로** 직렬화한다(개수 필드 없음):

```
edl2||<seg>|<seg>|…||T:<transitions>||G:<global>[||TX:…][||AR:…][||MU:…]
seg = jobId:startMs:endMs[;spd=][;fx=][;fit=cover]
```

★**새 필드도, 새 섹션도, APPEND-ONLY 고민도 없다.** split은 `|`로 이어지는 항목이 하나
늘어날 뿐이다. 따라서:

- **정경 문자열 형식 무변경 → KAT 골든 무변경**(구현 후 `test:kat` 35/35로 확인).
- **워커 변경 0** — 워커는 이미 N개 세그먼트를 렌더한다. 같은 `jobId`가 두 번 나오는 것은
  이미 정상 입력이다(`reachability-queued-submit.mjs`가 데모 클립을 **반복 사용**해 최소
  길이를 채운다 = 같은 jobId 다중 세그먼트가 이미 라이브에서 통과한 경로).
- ★**분할된 컴포지션의 서명은 당연히 달라진다** — 타임라인이 달라졌으니 맞는 동작이다.
  "서명 불변"은 **형식과 골든**이 안 움직인다는 뜻이고, 그 구분을 안 적으면 다음 사람이
  "split이 서명을 안 바꾼다"로 읽는다.

## 3b. ★split을 싸게 만드는 불변식 = **길이 보존**

`(1500-0) + (4000-1500) == (4000-0)`. 즉 **`totalMs`가 바뀌지 않는다.** 그래서:

| 건드릴 필요 없는 것 | 이유 |
|---|---|
| `texts` (자막) | `startMs`/`endMs`가 **컴포지션 시간**이고 총 길이가 안 변한다 |
| `music` (베드) | 같은 이유 — 베드 창·페이드가 컴포지션 시간이다 |
| `minSeconds`/`maxSeconds` 게이트 | 총 길이 불변이므로 통과/불통과 상태가 안 바뀐다 |
| 소스 검증·v1sr 번들 | `jobId` 집합이 안 변한다(`[...new Set(...)]`) |

★**이 불변식이 깨지는 구현이 있다면 그게 버그다** — 4절 테스트가 그것을 단정한다.

---

## 4. ★★결정 1개 — **split이 클립 슬롯을 소비하는가**

이것이 두 답이 다 방어 가능한 **유일한** 지점이다.

**사실**: 서버는 `segments.length > maxClips` → `too_many_clips`로 **세그먼트를 센다**
(`studio_compose_max_clips`, season_0 = **10**). 편집기도 같은 경계를 쓴다
(`addClip`: `segments.length >= props.maxClips` → return, 풀 버튼 disabled).
**split은 세그먼트를 +1 한다.** 그러므로 캡이 곧 분할 횟수 상한이다.

| 안 | 의미 | 비용 | 위험 |
|---|---|---|---|
| **A (권고)** | 캡은 **세그먼트** 수다 → 캡에서 split **거부** + 이유 표시 | 코드만, 서버 무변경 | 창작자가 클립 10개를 다 쓰면 분할을 못 한다 |
| B | 캡은 **구별되는 소스** 수다 → 분할은 무료 | ★**서버 규칙 변경 + 정책** | 발사 임계 경계를 조용히 완화한다. `maxClips`는 생성 비용을 묶는 축이고 그 의미를 바꾸는 건 본부 것이다 |

★**권고 = A.** 근거: ① `maxClips`는 참가자 **생성**을 묶는 축인데, 그 의미를 "소스 수"로
재해석하면 **DB 값 하나로 두 가지를 뜻하게 된다** — 서버는 세그먼트를 세고 정책은 소스를
센다는 이중 진실이 생긴다(배점 이중 진실과 같은 모양). ② A는 **되돌릴 수 있다**: 본부가 B를
원하면 서버 한 줄 + 캡 값 조정이고, 그때 이 UI는 그대로 쓰인다. B로 먼저 가면 되돌릴 때
**이미 만들어진 컴포지션이 캡을 넘는 상태**가 된다.

★**그래서 나는 A로 구현한다 — 본부/제니2가 B를 원하면 그것은 별건 변경**이고, 그 경우
필요한 것은 "서버 `too_many_clips` 판정을 `new Set(jobId).size`로" + 캡 값 재확정이다.
★**내가 DB 쓰기 SQL을 만들지 않는다(⑥).**

부수 판단(A 안에 포함, 내가 정하고 진행 — 반대 있으면 되돌린다):
- **최소 조각 길이**: 서버는 `endMs > startMs`만 요구한다(1ms 조각도 통과). 그러면 **잡을 수
  없는 클립**이 생기므로 `MIN_SPLIT_MS`를 두고 **두 조각 중 하나라도 그보다 짧으면 거부**한다.
  ★값은 **120ms**(30fps에서 약 3.6프레임) 권고 — 프레임 단위 근거가 아니라 "손으로 잡을 수
  있는 최소"라서 근거를 수치로 못 댄다. 그래서 **상수 1개로 빼고 주석에 그렇게 적는다.**

---

## 5. 기계 — 무엇을 어떻게 바꾸는가

★**파일 1개**: `app/studio/compose/ProComposeEditor.tsx`. (규칙은 아래대로 **순수 함수로
분리**하므로 실제로는 `lib/` 새 파일 1개 + 편집기 배선.)

### 5a. 규칙은 `lib/edl-split.ts`로 뺀다 (신규, 순수)

★**편집기 안에 두면 테스트가 닿지 못한다** — `lib/text-track-lanes.ts`,
`lib/music-picker-scope.ts`, `lib/music-curation-order.ts`가 같은 이유로 존재한다.

```
splitSegments(segments, transitions, index, sourceCutMs, opts)
  -> { ok: true, segments, transitions } | { ok: false, reason }
reason: 'index' | 'cut_outside' | 'too_short' | 'too_many_clips'
```

### 5b. ★전환(`afterIndex`)은 **반드시 이동한다**

`Transition = {afterIndex, type, durationMs}`이고 `afterIndex`는 **위치 인덱스**다.
인덱스 `i`를 분할하면 뒤쪽 경계가 전부 한 칸 밀린다:

```
afterIndex >= i  →  afterIndex + 1        (그대로 두면 아래가 일어난다)
afterIndex <  i  →  변화 없음
```

★**`afterIndex === i`가 핵심이다.** 그 전환은 원래 "세그먼트 i와 그 다음" 사이에 있었다.
이동하지 않으면 **분할로 생긴 내부 경계(반쪽 A와 반쪽 B 사이)로 옮겨 앉는다** — 즉
**한 클립 가운데에 디졸브가 생기고**, 원래 붙어 있던 경계는 전환을 **잃는다**. 에러도 경고도
없다. 그래서 이건 결정이 아니라 **정확성 요구**이고, 4절 테스트가 단정한다.

★**새 경계에는 전환을 넣지 않는다.** split은 컷이다. 디졸브를 자동으로 끼우면 창작자가
요청하지 않은 것이 화면과 서명에 들어간다.

### 5c. 나머지

| 항목 | 처리 | 근거 |
|---|---|---|
| `effects` · `speed` · `fit` | **두 조각이 동일하게 상속** | split은 "이 클립을 둘로 자른다"이고 "등급을 초기화한다"가 아니다 |
| `uid` | 두 번째 조각에 `nextUid()` | React 키 + 선택 상태가 uid 기준 |
| undo | **`commit('split')` 1회**(coalesce **안 함**) | 세그먼트 삽입과 전환 이동이 **한 undo**여야 한다. 그리고 연속 분할 2회는 **undo 2회**여야 한다 — 08-02에 코얼레스 키 때문에 undo 한 번이 둘을 되돌린 결함과 같은 자리 |
| 선택 | 분할 후 **두 번째 조각**을 선택 | 플레이헤드가 그 시작점에 있다 |
| 진입점 | 선택된 클립 + 플레이헤드가 **그 클립 내부**일 때만 활성 | 경계에 정확히 있으면 자를 것이 없다 → `cut_outside` |
| 거부 표시 | 기존 배너 자리 재사용(`t.clip_over` 계열) | 새 상태기계 안 만든다 |

---

## 6. 테스트 (구현과 같은 커밋)

`lib/edl-split.test.ts` (순수, `npm test`에 등록):

1. **길이 보존** — 임의의 유효 컷에서 `Σ(endMs-startMs)` 불변. ★3b 불변식.
2. **두 조각이 소스에서 연속** — `A.endMs === B.startMs`, 둘 다 원본 범위 안.
3. ★**전환 이동** — `afterIndex >= i`가 +1, `< i`는 불변. **`afterIndex === i`가 새 내부
   경계에 남지 않음**을 명시적으로 단정(5b의 조용한 오작동).
4. ★**새 경계에 전환이 생기지 않음.**
5. **상속** — `effects`/`speed`/`fit`이 두 조각에 동일.
6. **거부 4종** — 범위 밖 컷 / 최소 길이 미달(양쪽 각각) / 캡 도달 / 잘못된 인덱스.
7. ★**캡 경계 양방향** — `length === maxClips`면 거부, `maxClips - 1`이면 성공.
   (전부 거부하는 가드는 거부 테스트만으로 통과한다.)
8. **자막·음악 불변** — 입력의 `texts`/`music`이 바이트 동일하게 나온다.
9. **멱등 아님을 명시** — 같은 지점 재분할은 `too_short`로 거부(0 길이 조각 방지).

그리고 **`npm run test:kat` 35/35 무변경**을 커밋 메시지에 싣는다(3절 주장의 증거).

---

## 7. 건드리지 않는 것 / 기록만

- ★**`speed`가 컴포지션 길이에 반영되지 않는다.** 편집기·서버·서명이 모두 speed-blind다
  (2절 표). 2x 클립이 화면에서 절반 시간에 지나가는지는 **여기서 판단하지 않는다** — 바꾸면
  `totalMs`·min/max 게이트·서명·KAT이 동시에 움직인다. **별건이고 제니2 판단이다.**
  split은 **현재 모델을 그대로 따른다.**
- `dissolve` 미노출(G) — 근거가 코드에 있고 이번 작업과 무관.
- A 소유 구역(`submitRender`/`finalizeSubmission`/스위프), v1m canonical, KAT 골든.
- ⑥C·격자 값·마이그 — 대기 그대로.

## 8. 착수 상태

★**이 문서가 설계이고, 4절 결정 A로 구현에 들어간다.** B를 원하면 되돌리는 비용은
`lib/edl-split.ts` 상수 하나와 서버 한 줄이다(UI는 그대로).
★공수 없음([[feedback-no-schedule-estimates]]).
