# [C]④ Pro Editor — 코드에서 다시 잰 것

2026-08-08, 레인 C. ★**실측만. 코드 0줄. DB 쓰기 0건.**
기준: 앱 `4edc09f` / 워커 `ff9695d`, 로컬. 브리프 = `reports/pro_editor_completion_plan.md`
(항목 A~H)와 `reports/lane_c_handoff_2026-07-30.md`("④ Pro Editor 17.5d").

★**17.5d를 옮기지 않았다.** 항목별로 코드를 열어 판정했고, **브리프가 낡은 지점이 4곳,
그중 1곳은 브리프보다 커졌다.**

---

## ① 항목별 판정

| | 브리프(7/28) | 오늘 실측 | 판정 |
|---|---|---|---|
| **A** 자막/텍스트 | ❌ 5~6d, 리스크 높음 | `TextLayer`(cryptobind, `TX:` append-only 섹션) · `lib/text-limits.ts` · `lib/text-metrics.ts` · `lib/text-track-lanes.ts` · `TextTrack.tsx`(204줄) · `TextOverlay`/`TextFit`/`text-preview.ts` · 워커 렌더 · `test:text-parity` **46/46** · 폰트 어드밴스 골든 | ★**완료** |
| **B** 음악 Stage1 | ❌ 5~6d | `MusicBed` + `MU:` 정경 · 워커 `mixMusic` · `music-preview.ts`(프리뷰 클록 WYSIWYG) · 피커 · v1m 서명 · 라이브러리 배치 적재(`seed:music:batch`) | ★**부분** — 코드 경로는 끝. 남은 것은 **자산 0행 + 격자·필터·미리듣기·큐레이션** = ③b |
| **C** 종횡비/리프레임 | TK 결정 대기, 0 또는 2~4d | `ComposeEdl.aspect` + 세그먼트별 `fit: contain\|cover` + 워커 `canvasForAspect` | ★**완료** (결정도 났다) |
| **D** 키프레임 애니메이션 | ❌ 5~8d (저비용안 2~3d) | `keyframe`/`ken burns`/`panzoom` grep **0건** | **미착수** |
| **E** 클립 분할(split) | ❌ 1~2d | 분할 관련 grep **0건**(잡힌 것은 텍스트 줄나눔 문구뿐) | **미착수** |
| **F** 보이스오버/TTS | ❌ 2~3d | grep **0건** | **미착수** |
| **G** 전환·효과 노출 | "대부분 구현·미노출, **항목당 0.5~1d**" | ★아래 재판정 | ★**부분, 그리고 브리프보다 크다** |
| **H** 속도 램프 | NO (D 하위집합) | 0건 | **미착수** |

### ★브리프가 낡은 지점 4곳

1. **A가 완료**다. 브리프에서 "최우선 5~6d, 리스크 높음"이던 항목이 끝났다(② 트랙).
2. **C가 완료**다. "TK 결정 필요"였는데 결정이 나고 구현·배포까지 됐다.
3. **B의 성질이 바뀌었다.** "5~6d 개발"이 아니라 **자산 확보 + 피커 UI**다. 코드 경로
   (서명·믹싱·프리뷰)는 이미 있고 `studio_music_assets`가 **0행**이다.
4. ★**G가 커졌다 — 유일하게 브리프보다 큰 항목.** 다음 절.

### ★G 재판정 — "패리티 검증 후 노출만"이 아니다

실측(`lib/effects.ts`):

```
EFFECT_SPECS         12개 구현
EXPOSED_SLIDER_KEYS   8개 노출   (exposure contrast saturation temperature tint vignette glow grain)
미노출 4개            sharpen · chromatic · lutIntensity  ← 주석: "not previewable"
                     motionBlur                          ← parity: 'approximate'
EXPOSED_TRANSITIONS   9개 노출
미노출 1개            dissolve  ← ★의도적. 주석에 사유가 적혀 있다
```

- **미노출 3개는 "검증 안 됨"이 아니라 "프리뷰가 그릴 수 없음"**이다. 노출하려면
  `lib/gl-effects.ts`에 셰이더를 **추가**해야 하고, 그건 검증이 아니라 구현이다.
- **`dissolve`는 이미 분석되어 의도적으로 닫혀 있다.** 주석 실측: ffmpeg의 dissolve 필드가
  `float32 sinf()`에서 나오고 `fract()`가 마지막 비트를 증폭해 **ffmpeg 빌드의 libm에
  의존**하므로 셰이더로(또는 GPU 간에) 재현 불가. 열려면 **우리가 정의하는 렌더측 필드**가
  필요하고 이는 `grain`/`tmix`와 같은 급이다. ★워커 `XFADE_MAP`에는 dissolve가 **있다**
  (렌더는 된다) — 막고 있는 건 프리뷰 파리티다.
  → 07-30 핸드오프의 *"dissolve는 렌더 변경이 필요해 ④ 잔여로 묶였다"*는 **맞고**, 브리프
  §3-G의 *"항목당 0.5~1d"*에는 **안 들어간다.**

---

## ② 미착수분 — 파일·줄·결정 개수 (일수 없음)

★**전제 하나가 비용을 지배한다: 정경을 append-only로 확장하면 KAT 골든과 기존
`render_jobs`의 v1sr이 불변이고, 세그먼트 문자열 중간을 건드리면 둘 다 깨진다.**
아래 수치는 **append-only 전제**다.

| 항목 | 파일 | 새/바뀜 | 결정 | 서명·KAT |
|---|---|---|---|---|
| **E** split | **1** (`ProComposeEditor.tsx`) | ~40 | **1** | ★**불변** |
| **G**-1 셰이더 3종 노출 (sharpen·chromatic·lutIntensity) | **2** (`lib/gl-effects.ts`, `lib/effects.ts`) | ~90 (셰이더당 ~30) + 노출 1줄 | **3** (항목당 파리티 허용치) | **불변** |
| **G**-2 motionBlur 노출 | 1 (`lib/effects.ts`) | ~1 | **1** (`approximate`를 노출 기준으로 받나) | 불변 |
| **G**-3 dissolve | **3** (워커 `render.ts`, `lib/gl-effects.ts`, `lib/effects.ts`) | ~70 | **2** (필드 정의·파리티 기준) | 불변 |
| **D** 켄번즈/팬줌 (저비용안) | **6** (cryptobind **쌍**, 워커 `render.ts`, `preview-gl.ts`, `preview.ts`, 편집기) | ~135 | **4** | ★**append-only면 불변** |
| **D** 풀 키프레임 | 위 + 타임라인 키프레임 트랙 | + `assignLanes` 재사용으로 트랙 자체는 ~200 (자막 트랙 선례 204) | +3 | append-only면 불변 |
| **H** 속도 램프 | D에 흡수 | — | 0 신규 | — |
| **F** TTS | ★파일 수가 관문이 아니다 | — | **1 (벤더·계약)** | — |

**E가 가장 싸고 서명을 안 건드린다** — 그리고 이유가 측정으로 확인된다: EDL이 **같은 클립의
다구간**을 이미 표현할 수 있어(브리프도 "우회 존재"라고 적었다) 분할은 **세그먼트 배열
조작**이고 정경 형식이 안 바뀐다. 결정 1개 = "분할 지점을 ms 그리드로 두나 프레임 정확으로
두나"(ms면 기존 트림과 같은 축이라 0).

**F는 파일·줄로 답할 수 없다.** 벤더가 미정이고 그게 계약·비용·라이선스 문제다 — 음악
Stage2에서 겪은 것과 같은 관문이다. 착수 가능 여부 자체가 대기.

★**결정 총 개수**: E 1 · G 6 · D 4(저비용) 또는 7(풀) · F 1 = **12~15건**.
그중 **서명을 움직일 수 있는 것은 D의 "정경 확장 방식" 1건뿐**이고, append-only를 택하면
0건이 된다.

---

## ③ `submitRender`·EDL 접촉면 — 겹침 전제는 해소됐다. 단 이유가 다르다

**A의 ①(비동기 제출)은 내 트리에 이미 있다**(`budget-guard` 머지분, 실측):
`submitRender`가 `submit_intent_at`·`finalized_at`을 읽고, `verifyComposeBind(..., {
requireFinal })`로 **의도 시점**과 **확정 시점**을 나눈다. 후반은 `finalizeSubmission`.

★**그런데 ④와의 접촉면은 그것과 거의 무관하다.** 실측한 구조:

```
④가 만지는 것        edlCanonicalString / computeEdlHash / EffectParams / SegmentEffect
submitRender가 하는 것  그 함수를 호출해서 v1sr을 재계산하고 비교
```

`requireFinal` 분리는 **언제** 검증하는지만 바꿨고 **무엇을** 검증하는지는 안 바꿨다 —
`lib/cryptobind.ts`가 그 문장을 직접 적어 두었다: *"NOTHING about the signatures changes
-- no new canonical string, no new signature, worker untouched. Only WHEN each half is
checked moves."*

→ ★**④가 append-only로 확장하면 `submitRender`는 한 줄도 안 바뀐다.** 겹침 전제는
해소됐지만 **해소된 이유는 A의 ①이 끝났기 때문이 아니라, 원래 접촉면이 함수 호출
하나였기 때문**이다. 브리프의 "submitRender·EDL에서 A와 겹친다"는 **파일 단위로 본
겹침**이었다(둘 다 `lib/studio.ts`).

★**여전히 겹치는 조건 하나**: 정경 **중간**을 바꾸면 기존 `render_jobs` 행의 v1sr이 전부
깨지고, 그것을 거부하는 지점이 정확히 `submitRender`다. 그때는 A의 소유 구역과 겹친다.
**즉 "겹치지 않는다"는 append-only를 지키는 동안만 참이다.**

---

## ④ 지수2A와의 파일 겹침 — **0건**

A의 C단계 대상(`lib/season-phase.ts` · `deriveLobbyMode` · `LobbyCard`)을 내 ④ 대상 파일이
import하는지 실측:

| ④ 대상 파일 | `season-phase` | `deriveLobbyMode` | `LobbyCard` |
|---|---|---|---|
| `app/studio/compose/ProComposeEditor.tsx` | 0 | 0 | 0 |
| `lib/cryptobind.ts` | 0 | 0 | 0 |
| `lib/effects.ts` | 0 | 0 | 0 |
| `app/studio/compose/TextTrack.tsx` | 0 | 0 | 0 |

A쪽 실제 위치(참고): `deriveLobbyMode` = `lib/lobby.ts` + `lib/season-phase.ts` /
`LobbyCard` = `app/lobby-preview/page.tsx` · `app/tournament/page.tsx` ·
`app/_components/lobby-actions.ts`. **④의 어느 항목도 이 셋을 건드리지 않는다.**

★**남는 공용 파일은 `lib/studio.ts` 하나**이고, A가 그 안의
`submitRender`/`finalizeSubmission`/스위프를 소유한다. ③의 결론대로 ④가 append-only면
그 함수들을 안 건드린다 → 같은 파일이지만 같은 줄이 아니다.

---

## ⑤ 재사용되는 내 산출물 — 4건 전부 유효, 그리고 게이트가 이미 있다

| 산출물 | 실측 | ④에서 어디에 |
|---|---|---|
| `assignLanes` / `laneCount` (`lib/text-track-lanes.ts`) | `readonly {startMs,endMs}[]`를 받는 **순수 함수**, 타입명이 `LaneWindow`(텍스트 타입 아님), 불변식 테스트 보유 | **D의 키프레임 트랙 · E의 분할 결과 표시 · 음악 레인** 전부에 **새 줄 0**으로 |
| `updateText` 코얼레스 패턴 | `commit(\`${coalesceKey}:${i}\`)` — ★**키에 레이어 인덱스가 들어간다**(`f871cdb`에서 고친 그 결함) | D의 키프레임 드래그·E의 분할처럼 **여러 항목을 빠르게 끄는** 조작에 같은 패턴. 레이어별 undo 병합 문제는 이미 해결돼 있다 |
| 폰트 어드밴스 골든 (`gen:text-advances` / `test:text-advances`) | 폰트 메트릭 골든 테이블 | **D의 텍스트 이동/애니메이션**에서 프리뷰↔렌더 폭 일치의 기준 |
| 파리티 하니스 4종 | `test:parity:engine` · `test:parity:transition` · `test:text-parity` · 워커 `music-parity` | ★★**정정 2026-08-08 — 아래 참조. 게이트는 "있었지만" 판별하지 못했다** |

★★**정정 (2026-08-08 저녁) — 위 줄의 "게이트가 이미 존재한다"는 근거로 쓸 수 없다.**
`test:parity:engine`의 **"ALL PASS"가 무효 통과였다.** 무동작(pass-through) 셰이더를
전 케이스에 돌려 실측한 결과, **절대 게이트를 그냥 통과하는 조합이 9쌍**이다:
**LUT 4/4 · glow/testsrc · sharpen 4/4.** 게이트 값(3%·5%·2.5%)이 **효과 자체의 크기**
(1.34~2.61% · 2.04% · 0.18~0.72%)보다 **커서**, 아무것도 안 하는 셰이더를 못 거른다.
`color`만 정상이다(무동작 잔차 5~9% vs 2.5% → 모든 content에서 거부).

★**셰이더가 틀렸다는 뜻이 아니다** — LUT 셰이더의 상대 ratio는 0.01~0.04(효과의 96~99%
재현)로 훌륭하다. **틀린 것은 게이트**이고, 그래서 "통과했다"가 셰이더에 대한 증거가 아니었다.
★그리고 **"실패 시 exit 1로 막는다"도 그 자체로는 안전을 뜻하지 않는다** — 거를 수 없는
기준으로 exit 1을 걸면 **막는 척하는 게이트**가 된다.

★이 문서의 G 관련 크기 판단은 그 전제 위에 있었으므로 **판별 가능한 게이트가 생긴 뒤에
다시 읽어야 한다.** 상세·재현: `scripts/gl-engine-parity.mjs`의 negative control 절과
`reports/lane_c_state_2026-08-08.md`.
★**미확인**: 같은 질문을 `test:parity:transition`·`test:text-parity`·워커 `music-parity`에는
**아직 하지 않았다.** 전환 표의 "9종 worst ≤0.30%"도 같은 계열일 수 있고, 그 하니스는 A 소관이다.

★**추가로 재사용 가치가 있는 어제 산출물 1건**: `lib/music-picker-scope.ts`가 보여준
**"규칙을 필터 문자열/컴포넌트에서 빼내 순수 함수로 두고 양방향 테스트"** 패턴. D·E가
새 규칙(분할 가능 지점, 키프레임 값 범위)을 만들 때 같은 형태로 두면 테스트가 닿는다.

---

## ★내가 판단하지 않은 것

착수 순서는 **제니2**가 정한다. 위 표는 비용과 위험만 낸다. 다만 실측에서 나온 사실 두 개는
순서 결정에 직접 쓰인다:

1. **E는 서명을 안 건드리고 1파일이다** — 가장 싸고 되돌리기 쉽다.
2. **D의 "정경 확장 방식" 1건이 이 에픽에서 유일하게 KAT·기존 서명을 움직일 수 있는
   결정**이다. append-only를 먼저 확정하면 나머지 결정 11~14건이 전부 국소가 된다.

기존 대기 변동 없음: 축의 값(제니3·본부) / 마이그(본체) / 스위치 1·2단(본체·대표님) /
`desc_text`(본체).
