# H — 편집기 UI 설계 (③, 설계만 — 미구현) — 2026-08-12

★설계. 코드 0줄. 배선①②(GL 프리뷰 `preview.ts`/`preview-gl.ts`, 워커
`render.ts`) 완료 + 신호상대오차 파리티 실측 완료(1프레임 미만, 다중 케이스)가
전제. 결정 = ①B(길이 고정) + ②선형만(D 인프라 재사용). D의 UI 설계
(`reports/lane_c_item4_d_ui_design_2026-08-10.md`)와 같은 패턴 — **새 어휘를
만들지 않는다**, `KeyframeMiniTrack`을 그대로 재사용한다.

## 결론 먼저

기존 "per-clip speed" 슬라이더(`ProComposeEditor.tsx:1850-1860`, `fxTab ===
'clip'` 탭) 바로 옆에 D와 **동일한 필드별 토글**을 붙인다. OFF(기본) = 지금
그대로 정적 speed 슬라이더. ON = `KeyframeMiniTrack`으로 스왑 — D가 이미
`kfTrack ? <KeyframeMiniTrack .../> : <input type="range".../>` 패턴으로 4개
효과 슬라이더에 붙여둔 것과 정확히 같은 모양(`1840-1846`)이라 새 컴포넌트가
필요 없다. **단, static `speed`와 `speedRamp`는 상호배타**(정경 계층의 규칙,
`lib/cryptobind.ts`의 `SegmentEffect` 주석 — ramp가 있으면 static은 무시) —
그래서 토글 ON은 D처럼 "같은 필드를 다른 표현으로 바꾸는" 게 아니라 **static
speed를 끄고 ramp를 켜는** 스위치다. 토글 ON 즉시 현재 정적 speed 값으로
2점(0, span) 자동 생성 — 값이 튀지 않게, D의 진입 패턴과 동일.

## 1. 진입점 — speed 슬라이더 옆 다이아몬드 토글 (D와 동일 아이콘/자리)

`1852` 라벨 줄(`{t.fx_speed}`) 옆에 다이아몬드 아이콘. OFF(기본)=지금 그대로
`selSeg!.speed` 슬라이더. ON=`KeyframeMiniTrack`(min=0.25, max=4 — 기존
슬라이더 range 그대로, 새 스케일 정의 불필요)으로 스왑. **2점 미만 방지**는
D와 동일 규칙(마지막 점 삭제 시도 = 토글 OFF로 복귀, 남은 점 값이 새 정적
speed가 됨).

## 2. ①B의 새 제약 — "가속이 소스를 넘으면 편집기가 막는다"

D에는 없던, H만의 요구사항(제니2 지시, 이번 라운드). ★클램프도 정지프레임도
아니다 — **못 만들게 막는다**. 걸리는 지점 두 곳:

- **점 드래그/추가 시 실시간 검사**: 매 변경마다
  `speedRampSourceConsumedMs(track, spanMs)`(Stage 1, `lib/edl-keyframes.ts`
  export)로 소스 소비량을 재계산 → `selSeg!.startMs + consumed`가 그 클립의
  실제 `duration_seconds*1000`을 넘으면 **그 변경을 적용하지 않는다**(드래그
  중이면 그 지점에서 멈춰 붙잡힘 — 클램프처럼 보이지만 의미가 다르다: 값을
  깎는 게 아니라 "더 못 간다"는 UI 피드백. 트랙 배경을 빨갛게 하이라이트 +
  짧은 흔들림 애니메이션으로 "막혔다"를 즉시 알림, 토스트 없음(편집 흐름
  방해 최소화, D의 다른 검증들과 톤 일치).
- **클립 duration 자체를 어디서 아는가**: 현재 `Segment` 타입(에디터 로컬)에
  소스 클립의 실제 길이가 없다 — `startMs/endMs`는 트림 범위일 뿐, 원본 길이는
  `media pool`(클립 선택 리스트)이 이미 들고 있는 값(썸네일 그리드가 duration
  배지를 이미 그리고 있음, 확인 필요하지만 거의 확실) 재사용. 새 API 불필요,
  이미 로드된 데이터 재배선.
- **저장/제출 시 최종 게이트**: 이미 이번 라운드에 배선한 서버 검증
  (`lib/studio.ts` `createRender`, Stage 6, 커밋 완료)이 최종 관문 — 편집기
  검사가 UX고, 서버가 authority라는 이 레포의 표준 이중 게이트 패턴 그대로.

## 3. 데이터 흐름

`setSegSpeed`(`1295`)와 나란히 `setSegSpeedRamp(uid, track: KeyframeTrack |
undefined)` 추가. `track` 설정 시 `speed` 필드는 그대로 두되(되돌리기 대비,
정경 계층에서는 무시됨) UI는 speed 슬라이더 대신 트랙을 그린다. `undefined`
호출 = ramp 제거, 마지막 트랙 값 기반으로 정적 `speed` 복원(D의 opacity
"고급 끄기"와 같은 손실 변환 규칙 — 트랙이 상수가 아니었다면 어느 값을
남길지 결정 필요: 트랙의 **평균**(`speedRampSourceConsumedMs(track,
span)/span`, 시간-가중 평균이라 이미 있는 함수 재사용)을 제안 — 정지 값이
아니라 "전체적으로 몇 배속이었나"를 보존하는 게 손실이 가장 적은 변환).
커밋/undo 스택은 기존 `commit()` 패턴 그대로.

## 밖에 둔 것

- 이징 없음(결정②, D와 동일) → 점 사이는 항상 직선.
- ★2026-08-12 갱신: 오디오는 더 이상 무음 처리 안 됨 — 실제 리타이밍 배선
  완료(워커, 이번 라운드). `deriveSourceToDisplayTrack`이 만드는 구간별
  경계를 그대로 재사용해 구간마다 로컬 평균 speed로 `atempo`(피치 보존) →
  concat. 실측(2026-08-12): 1x→3x 램프·4초 톤 소스 → 비디오 트랙 정확히
  2.000000초, 오디오 트랙 2.025초(AAC 1024-샘플 프레임 양자화, 매 콘캣
  경계마다 최대 그 정도 — 수학 오차 아님). UI에 음소거 경고 문구 불필요.
- 트랜지션과의 상호작용 미검증(Stage 4 커밋에서 플래그됨) → 램프가 걸린
  세그먼트에 트랜지션을 붙이는 UI 자체를 막을지, 붙게 두고 추후 검증할지는
  결정 필요.

## 관문

새 UI 자체는 파리티 대상이 아니다(값은 그대로 `lib/edl-keyframes.ts`를 거쳐
기존 파리티 배선①②로 흐른다). 새 관문 = 위 §2의 "소스 초과 차단"이 편집기·
서버 양쪽에서 실제로 같은 값(`speedRampSourceConsumedMs`)을 쓰는지 — 같은
함수를 양쪽이 import하는 것 자체가 그 보장이라 별도 KAT/harness 불필요
(D/H 공통 원칙: "한 번 계산해서 두 엔진에" — Stage 1 헤더 코멘트 참조).
