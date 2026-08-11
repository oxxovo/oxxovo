# G 잔여 2개 — 막힌 지점 설계 (lutIntensity·motionBlur) — 2026-08-10

★설계. 코드 0줄. "막혔다"≠"안 한다" — 각 항목이 왜 막혔는지, 그걸 어떻게
푸는지, 풀기 전에 뭘 재야 하는지를 낸다.

## 결론 먼저

**lutIntensity**는 막힌 지점이 하나(워커 블렌드 필터체인)고 기존 glow 패턴을
그대로 재사용할 수 있어 설계가 이미 거의 확정적이다. **motionBlur**는 진짜
스파이크가 필요하다 — GL 프리뷰가 "프레임 하나 들어와 하나 나가는" 구조라서
tmix(여러 프레임 평균)를 낼 방법 자체가 이 엔진에 없다.

## lutIntensity

**막힌 지점**: `render.ts:95`의 `lut3d=file=...`는 항상 전강도. 부분강도를
내려면 원본과 LUT적용본을 블렌드해야 하는데, 지금 `effectVideoFilters()`는
선형 `-vf` 체인만 만들고(`buildSegmentVf`), split/blend는 `buildSegmentFC`
(glow 전용, filter_complex)에만 있다.

**설계**: `buildSegmentFC`의 glow 블렌드(`275-296`)와 **동일한 모양**.
```
split → [원본] [lut3d 적용] → blend=all_mode=normal:all_opacity=<intensity/100>
```
glow는 `screen` 모드로 밝은 부분을 더하지만 lutIntensity는 원본 위에 LUT를
**normal 모드로 섞는** 것뿐이라 오히려 더 단순하다. `hasBlend()`
(`render.ts:305`)가 지금 glow만 보는데 lutIntensity도 이 함수가 감지해야
`buildSegmentFC` 경로로 넘어간다(glow 없이 LUT 부분강도만 있어도
filter_complex 필요).

GL 쪽: `FRAG_COLOR_LUT`의 `if (u_hasLut > 0.5) c = lutSample(c)`
(`gl-effects.ts:102`)를 `c = mix(c, lutSample(c), u_lutIntensity)`로 —
새 유니폼 하나, 기존 파이프라인 안에서 끝난다(glow처럼 별도 멀티패스 불필요 —
LUT는 이미 단일 패스 안에 있어서).

**결정 1개**: 블렌드 모드가 `normal`이 맞는가(glow의 `screen`과 다른 선택인
이유는 위에 씀 — 이건 내 판단이지 제니2가 정할 값 목록은 아니라고 봄, 다만
최종은 실측 파리티로 검증).

**막힌 이유가 사라지는 시점**: 위 필터체인을 실제로 워커에 넣고 GL의
`mix()`와 신호상대오차로 재는 순간 — 스파이크 성격이 아니라 그냥 구현+측정
1회분. G의 다른 3개(sharpen/chromatic/vignette)와 같은 크기.

## motionBlur

**막힌 지점**: 워커의 `tmix=frames=N`(`render.ts:102`)은 **여러 비디오
프레임**을 평균한다. GL 프리뷰의 `drawFrameGL()`(`preview-gl.ts:405`)은 매
rAF마다 `<video>` 엘리먼트의 **현재** 디코드 프레임 하나를 `texImage2D`로
읽어 그린다(`proc.render(video, ...)`, `445`) — 과거 프레임을 들고 있지 않다.
비디오 엘리먼트를 과거 시각으로 `currentTime` 되감아 다시 그리는 건 매
프레임마다 실제 seek을 유발해 끊김·디코더 스톨을 낸다(재생 중 seek 비용은
프리뷰 신뢰성 문제로 이미 알려진 종류의 함정).

**설계(스파이크 전 가설)**: 소스를 되감는 대신, **렌더 결과 쪽에 링버퍼**.
매 draw 호출마다 이번 프레임의 (이펙트 적용 전) 소스를 FBO 텍스처로 캡처해
N개짜리 링에 밀어넣고, motionBlur가 켜진 세그먼트는 최근 N개 텍스처를
가중평균하는 셰이더 패스를 추가. `N = 2 + round(mb/20)`(워커의 `tmix` 매핑과
동일 어휘, `render.ts:102`)까지 텍스처 최대 6장.

**스파이크가 먼저인 이유(진짜 미지수, 설계로 안 풀림)**: rAF는 디스플레이
주사율(보통 60fps)에 맞춰 도는데 비디오 자체 fps는 그보다 낮을 수 있다 — 그러면
같은 비디오 프레임이 링버퍼에 **중복으로 여러 번** 들어가 "평균"이 사실상
최근 프레임 쪽으로 쏠린 가중치가 된다. `video.currentTime`이 이전 draw와 같으면
캡처를 건너뛰는 디듀프가 필요한지, 필요하다면 그게 워커의 `tmix`(진짜 소스
프레임 N장 평균)와 시각적으로 얼마나 다르게 보이는지 — **이건 코드로 안
풀리고 실제로 돌려서 눈으로/신호로 봐야 한다.** 스펙에 이미 `parity:
'approximate'`로 박혀 있는 이유(사이징 08-08)도 이거다.

**스파이크 범위(제안, 착수는 지시 대기)**: 링버퍼 캡처+가중평균 셰이더를
최소로 배선해서 (a) 중복 프레임 디듀프 없이, (b) 디듀프 포함, 두 버전을
워커의 실제 `tmix` 출력과 신호상대오차로 비교 — 어느 쪽이든 성립하면 그게
motionBlur의 실제 구현이 되고, 둘 다 REVIEW/FAIL이면 "근사 허용 임계"를
제니2가 정할 차례(08-08 사이징에 이미 적힘, "내가 정할 것이 아니다").

## 처분

lutIntensity = 착수 가능(설계 확정적). motionBlur = 스파이크 지시 대기,
지금 코드 0줄 유지.
