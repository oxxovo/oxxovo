# D 키프레임 -- 설계 (2026-08-10, 지수2C)

전제: 워커 스파이크 해소됨(`lane_c_item4_d_keyframe_worker_spike_2026-08-10.md`
-- `sendcmd` 없이 `eval=frame`+`t` 표현식으로 값 곡선 가능, 실측 확인). 이 문서는
그 뒤의 실제 설계. **결정은 정확히 2개**(①②, 둘 다 제니2/본부) -- 나머지는
엔지니어링이고 착수 시 내가 품는다.

## 결정 (내가 안 고름, 여기서 자리만 명시)

**① 무엇을 키프레임하는가.** 후보 3개, 비용이 다르다:
- (a) 효과 파라미터만(exposure·vignette 등, `EffectParams`) -- 가장 싸다,
  값이 이미 스칼라 슬라이더라 "스칼라 → 시간에 따른 스칼라"만 늘리면 됨.
- (b) 위치·스케일(변형) -- 지금 EDL에 그 개념 자체가 없다(세그먼트는 캔버스
  전체를 채운다, `fit: contain|cover`뿐). 새 좌표계를 만드는 일이라 (a)보다 크다.
- (c) 자막 불투명도 -- `TextLayer`에 `fadeInMs`/`fadeOutMs`가 **이미 있다**(2점
  선형 페이드, cryptobind.ts:220-221). 이건 이미 "미니 키프레임"이라 별도
  일반화가 필요 없을 수도 있다 -- (a)(b)와 성격이 다르다.

**② 보간 어휘.** 선형만이면 서명 포맷에 새 필드 없음(제어점만). 이징을 넣으면
그 자체가 **서명 가시 열거형**이 된다(`ease=linear|ease-in|...` 같은 문자열이
캐노니컬에 들어가고, KAT 골든이 그 값에 걸린다) -- 나중에 어휘를 늘리면 옛
캐노니컬은 안 바뀌어야 하니 APPEND 방식이어야 한다(아래 3절과 같은 원칙).

## 데이터 모델 (제안 -- ①이 (a)로 결정된 경우 기준)

```ts
export type KeyframeTrack = {
  points: { atMs: number; value: number }[]  // atMs: 세그먼트 시작 기준 상대시간
}
// EffectParams의 각 필드가 number | KeyframeTrack 둘 다 될 수 있게 하지 않는다 --
// 기존 스칼라 필드 타입을 바꾸면 그 자체가 캐노니컬 포맷 변경(서명 깨짐).
// 대신 별도 맵으로 얹는다:
export type SegmentEffect = EdlSegment & {
  speed?: number
  effects?: EffectParams
  keyframes?: Partial<Record<keyof EffectParams, KeyframeTrack>>  // 신규, optional
  fit?: 'contain' | 'cover'
}
```

`keyframes`가 있는 파라미터는 `effects`의 스칼라 값을 **오버라이드**(정적값은
"키프레임 0개"의 특수케이스로 접지 않는다 -- 지금 있는 EffectParams 필드는
그대로 두고, 키프레임 EXISTING 파라미터에 대해서만 켜지는 추가 레이어).

## 캐노니컬 -- 새 APPEND-ONLY 섹션, 기존 서명 안 건드림

`TX:`/`AR:`/`MU:`와 같은 원칙(`cryptobind.ts:335-341`): **키프레임 있는
세그먼트가 하나도 없으면 캐노니컬 문자열이 지금과 바이트 단위로 동일** --
기존 EDL·KAT 골든·서명이 안 움직인다.

```ts
function keyframeCanonical(kf: Partial<Record<keyof EffectParams, KeyframeTrack>>): string {
  return EFFECT_KEYS  // 고정 순서 재사용 -- 새 순서를 또 만들지 않는다
    .filter((k) => kf[k]?.points.length)
    .map((k) => `${k}=${kf[k]!.points.map((p) => `${Math.round(p.atMs)}:${Math.round(p.value)}`).join(',')}`)
    .join(';')
}
// segCanonical()에 추가:
if (s.keyframes) { const kfc = keyframeCanonical(s.keyframes); if (kfc) out += `;kf=${kfc}` }
```

양 레포 미러 필수(cryptobind.ts 둘 다) -- 기존 규율 그대로.

## 렌더링 -- 하나의 보간 함수, 두 엔진

★기존 패턴 반복(`colorUniforms` 등, `lib/gl-effects.ts`): 보간 수식을 **한 곳에서
순수함수로** 정의하고, GL 프리뷰는 JS로 그 값을 직접 계산해서 매 프레임
uniform에 꽂고, 워커는 같은 제어점을 ffmpeg **표현식 문자열**로 조립한다 --
두 렌더러가 각자 재구현하면 그 자체가 드리프트 지점이다.

```ts
// 공유, 순수. GL 프리뷰가 매 프레임 직접 호출.
export function valueAt(track: KeyframeTrack, tMs: number): number {
  const pts = track.points
  if (tMs <= pts[0].atMs) return pts[0].value
  if (tMs >= pts[pts.length - 1].atMs) return pts[pts.length - 1].value
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    if (tMs >= a.atMs && tMs <= b.atMs) {
      const t = (tMs - a.atMs) / (b.atMs - a.atMs)
      return a.value + (b.value - a.value) * t  // 선형(결정②가 선형일 때)
    }
  }
  return pts[pts.length - 1].value
}

// 워커 전용: 같은 제어점을 ffmpeg 표현식으로. eq=eval=frame:brightness='<expr>'
// 처럼 필터 파라미터 자리에 그대로 꽂는다(⑦에서 실측한 그 메커니즘).
export function toFfmpegExpr(track: KeyframeTrack, segStartSec: number): string {
  const pts = track.points
  // 세그먼트 로컬 t를 컴포지션 t에서 빼서 되돌린다: ffmpeg의 t는 항상 절대.
  const relT = `(t-${segStartSec.toFixed(3)})`
  let expr = String(pts[pts.length - 1].value)
  for (let i = pts.length - 2; i >= 0; i--) {
    const a = pts[i], b = pts[i + 1]
    const localA = (a.atMs / 1000).toFixed(3), localB = (b.atMs / 1000).toFixed(3)
    const lerp = `(${a.value}+(${b.value}-${a.value})*(${relT}-${localA})/(${localB}-${localA}))`
    expr = `if(lt(${relT},${localB}),${lerp},${expr})`
  }
  return expr
}
```

★**`toFfmpegExpr`은 아직 실측 검증 안 됨** -- ⑦은 "표현식 하나(단순
`min(t/3,1)*0.5`)가 프레임마다 재평가된다"만 증명했다. 3개 이상 제어점의
중첩 `if(lt(...))` 문법이 ffmpeg eval 파서에서 정확히 그대로 도는지는 **착수
시점에 다시 실측**(같은 방법, 렌더+측정) -- 정책 결정이 아니라 내가 품는
엔지니어링이라 오늘 안 함.

## 파일·결정 재확인 (08-08 사이징 6~7개, 오늘 근거 붙여 유지)

| 파일 | 무엇 |
|---|---|
| `lib/cryptobind.ts` + 워커 미러 | `KeyframeTrack` 타입, `keyframeCanonical`, `segCanonical` 확장 |
| `lib/effects.ts` (신규 `lib/edl-keyframes.ts` + test) | `valueAt`(공유 순수함수), 유닛테스트 |
| `app/studio/compose/preview-gl.ts` / `lib/gl-effects.ts` | 매 프레임 `valueAt` 호출 → uniform |
| `ProComposeEditor.tsx` | 키프레임 추가/삭제/드래그 UI (★설계 안 함, 순수 신규 UI 서피스 -- 08-08 사이징의 "6~7개 파일" 중 가장 큰 미지수) |
| 워커 `render.ts` | `toFfmpegExpr` + 필터별 `eval=frame` 적용 |

결정 재확인: **2개**(①②, 정책) + 실측 항목 1개(표현식 문법, 엔지니어링) --
08-08의 "3+"에서 하나(워커 렌더 가능 여부)가 빠졌다(⑦로 해소).

## 검증 계획 (착수 시)

1. `toFfmpegExpr`을 3점 이상 제어점으로 실제 렌더 -- `valueAt`의 JS 계산과
   ffmpeg 출력이 같은 값을 내는지 프레임 단위로 대조(⑦과 같은 방법).
2. 키프레임 없는 기존 EDL의 캐노니컬 문자열이 이 변경 전후로 바이트 동일 --
   KAT 골든 무변화를 첫 커밋의 조건으로 건다.
3. GL 프리뷰가 `valueAt`으로 계산한 값과 워커 표현식이 낸 값을 같은 timestamp에서
   비교(새 파리티 케이스, `gl-engine-parity.mjs`와 같은 자리).

## 오늘 안 한 것

①②는 결정 대기라 실제 코드 착수 안 함(이 문서 자체가 오늘의 산출물). UI
설계도 안 함(신규 서피스라 별도 사안).
