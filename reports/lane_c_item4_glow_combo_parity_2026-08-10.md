# ④ -- glow targetIdx fix + combination parity harness (2026-08-10, 지수2C)

작업 공간: 앱 `C:\Users\Tom\oxxovo-lane-c`, `feat/studio-lane-c`. 워커 미변경(읽기만,
`effectVideoFilters`로 실제 필터 순서 확인).

---

## 결론 먼저

- **①번(glow targetIdx) 수정 완료.** 실재하는 버그였다(1절).
- **②번(조합 파리티 하니스) 완료, 4가지를 쟀다.** 데이터가 가리키는 방향:
  **옵션① 그대로 가되, 위치를 바로잡는다** -- sharpen을 "패스를 하나 더 얹는" 방식(①)은
  라운드트립 비용이 **측정상 0**(2절 Q2)이라 ③(퓨즈)이 풀려던 문제 자체가 없다.
  대신 sharpen+grain은 **순서가 실제로 크게 좌우**해서(2절 Q1b), 지금처럼 맨 끝에
  패스를 붙이면 순서가 틀어진다 -- FRAG_COLOR_LUT 안에 vignette/grain이 이미 baked-in이라,
  sharpen을 그 뒤에 붙이면 워커 순서(sharpen이 먼저)와 반대가 된다. **그래서 "① 그대로"가
  아니라 "①이지만 vignette/grain을 그 shader에서 분리해 sharpen 뒤로 옮기는" 재구성이
  필요하다.** 최종 선택은 제니2/설계 소관으로 남긴다 -- 이건 데이터고, 결정은 아니다.
- **에스컬레이션 2건, 오늘 범위 밖에서 발견**: vignette 셰이더가 ffmpeg의 실제 vignette
  필터와 **다른 수학 모델**이다(3절, 사전 검증된 적 없음) / grain·vignette 순서가
  뒤바뀐 기존 버그가 **재-확인**됐고 이번엔 "고치면 실제로 바뀌는지"까지 쟀다(2절 Q3).

---

## 1. ①번 -- preview-gl.ts glow targetIdx 버그, 수정

`GLProcessor.render()`의 glow-multipass 분기(`stages.length > 0`)가 최종 카피를
**항상 캔버스에** 그렸다 -- `targetIdx`를 받아놓고 무시. glow가 없는 빠른 경로
(:124 `this.bindTarget(targetIdx, w, h)`)는 이미 맞게 짜여 있었는데, glow가
**있는** 세그먼트가 **전환(transition) 중**이면(`targetIdx=4` 또는 `5`로 호출,
`drawFrameGL`:288-289) 그 결과가 `fbos[4]`/`[5]`가 아니라 캔버스로 가버리고,
바로 다음 줄 `transitionBlend(4,5,...)`은 **그 프레임에 아무도 안 쓴 오래된 텍스처**를
읽는다 -- glow 단독으로는 안 걸리고 glow+전환 **조합**에서만 드러나는 버그였다.

수정: 마지막 카피를 `gl.bindFramebuffer(...null...)` 하드코딩 대신
`this.bindTarget(targetIdx, w, h)`로. `tsc` 0, `npm test` 461/461(무관 경로,
회귀 없음 확인). ★전용 회귀 테스트는 못 붙였다 -- `GLProcessor`는 브라우저 전용
클래스라 `npm test`로 못 닿고, Playwright 기반 파리티 하니스들은 `lib/gl-effects.ts`의
함수만 가져다 쓰지 이 클래스 자체를 실행하지 않는다. 필요하면 별도 사안으로 올린다.

---

## 2. ②번 -- 조합 파리티 하니스 (`scripts/gl-combo-parity.mjs`)

지시받은 조건 3개 + 부수 1개, 전부 실측(추정 없음). 콘텐츠는 기존
`test:parity:engine`과 같은 4종(smooth/mandel/bars/testsrc), sharpen=50
(기존 게이트와 비교 가능), vignette=60, grain=40, 같은 seed=42로 순서만 바꿔 비교.

### Q1a. sharpen+vignette -- 순서가 원인인가

| content | 정순(unsharp→vignette) r | 역순(vignette→unsharp) r |
|---|---|---|
| smooth | 0.767 | 0.767 |
| mandel | 0.754 | 0.754 |
| bars | 0.780 | 0.781 |
| testsrc | 0.758 | 0.761 |

★**정순≈역순 -- 순서 무관.** 그런데 두 값 다 REVIEW~FAIL 경계(0.75~0.78)로 나쁘다.
음성 대조군이 정확히 갈라준 것: 순서 문제였다면 역순에서만 나빴어야 하는데 **둘 다 나쁘다**
→ 원인이 다른 곳에 있다는 뜻이고, 그게 3절이다.

### Q1b. sharpen+grain -- 순서가 원인인가 (ffmpeg 대조 불가, grain은 설계상 근사)

grain은 ffmpeg `noise=`와 **다른 난수장**이라 픽셀 단위로 ffmpeg와 못 맞춘다
(lib/gl-effects.ts:85-86, 사전 선언됨). 그래서 이 다리는 **같은 seed로 GL 대 GL**만
비교(순서 말고는 변수가 없다):

| content | grain 단독 크기 | 정순↔역순 차이 | 비 |
|---|---|---|---|
| smooth | 5.80% | 11.94% | 2.06 |
| mandel | 5.18% | 9.94% | 1.92 |
| bars | 4.30% | 8.11% | 1.88 |
| testsrc | 3.18% | 5.41% | 1.70 |

★**순서가 grain 자체 크기의 1.7~2배만큼 이미지를 바꾼다 -- 순서가 지배적이다.**
물리적으로 말이 된다: sharpen이 grain **뒤에** 오면(역순) 날카롭게 하는 대상에
노이즈가 섞여 있어 **노이즈까지 같이 강조**된다. 워커 순서(sharpen 먼저)는 이걸 안 한다.

### Q2. ①안의 라운드트립 비용 -- 실측 (추정 아님)

패스를 하나 더 넣는 것 **자체의** 비용을 색보정 1패스 vs (색보정+무동작 unsharp
amount=0) 2패스로 쟀다. amount=0이면 셰이더 수학은 항등식이라, 차이가 있다면
**순전히 라운드트립 때문**.

| content | 1-pass r | 2-pass r | delta |
|---|---|---|---|
| smooth | 0.184 | 0.184 | 0.000 |
| mandel | 0.105 | 0.105 | 0.000 |
| bars | 0.111 | 0.111 | 0.000 |
| testsrc | 0.066 | 0.066 | 0.000 |

★★**측정상 0.** 첫 패스가 이미 8비트 RGBA FBO에 값을 써넣은 시점에서 양자화가
끝나 있고, 항등 연산은 이미 8비트인 값을 다시 8비트로 써도 같은 값이 나온다 --
그래서 "패스 하나 추가"는 공짜다. ★이건 08-09에 쟀던 ffmpeg 쪽 `yuv444p` 라운드트립
바닥(0.124~0.130%)과는 **다른 메커니즘**이다(그건 ffmpeg 자신의 픽셀 포맷 왕복,
이건 GL 파이프라인이 8비트 텍스처를 쓰고 다시 읽는 것) -- 그래서 그 수치로 추정하지
않고 따로 쟀다.

**갖는 의미**: ③(퓨즈, 라운드트립 0)이 풀려던 문제가 ①에도 애초에 없었다. ③의
이점(라운드트립 절감)이 실측상 존재하지 않는다.

### 부수. vignette/grain 순서 -- 고치면 실제로 바뀌나

08-09 프로브(e47f040)가 **찾기만** 했던 것(FRAG_COLOR_LUT은 vignette→grain인데
워커는 grain→vignette)을 오늘 두 가지로 확인했다.

**워커의 실제 순서, 코드에서 직접 읽음**(추측 아님, `effectVideoFilters` 실행 결과):
```
unsharp=5:5:1.0000:5:5:0,noise=alls=12:allf=t,vignette=angle=0.8727
```
→ `unsharp → noise(grain) → vignette`. 하니스가 이걸 **assert**해서(정규식 매치 실패
시 exit 1), render.ts가 나중에 순서를 바꿔도 이 문서가 조용히 낡지 않는다.

| content | 재배열 시 이미지 변화 | vignette 단독 크기 대비 | 판정 |
|---|---|---|---|
| smooth | 7.45% | 5.15% | 비 1.45 -- 실제로 눈에 띄는 차이 |
| mandel | 6.78% | 7.15% | 비 0.95 |
| bars | 5.59% | 3.55% | 비 1.58 |
| testsrc | 4.65% | 4.72% | 비 0.98 |

★**노이즈가 아니다** -- 재배열 자체가 vignette 혼자만큼 이미지를 움직인다. sharpen
쪽 재구성을 하는 김에 **같이 고칠 가치가 있다**(vignette를 grain보다 나중에).

---

## 3. ★★에스컬레이션 -- vignette 셰이더가 애초에 검증된 적이 없었다

Q1a의 "정순도 역순도 둘 다 나쁘다"를 파고들어 **vignette 단독**(sharpen 없이)을
ffmpeg와 직접 대조했다:

```
vignette=60 단독, mandel 콘텐츠
효과 크기 (plain vs ffmpeg)  : 26.68%
GL vs ffmpeg                : 19.53%   <- 이게 문제
```

원인 -- **두 개가 다른 수학이다**:
- `lib/gl-effects.ts:84` (FRAG_COLOR_LUT): `c *= 1.0 - u_vignette * smoothstep(0.35, 0.75, distance(uv, center))` -- 중심으로부터 **거리** 기반, 임의로 고안된 감쇠 곡선.
- ffmpeg `vignette` 필터(`ffmpeg -h filter=vignette`로 직접 확인): `angle`(렌즈 각, 기본 `PI/5`) 파라미터로 만드는 **코사인 기반 광학 비네트 모델** -- 완전히 다른 공식.

`gl-engine-parity.mjs`의 `CASES`엔 `color`/`LUT`/`glow`/`sharpen`은 있어도
**vignette는 없다** -- 독립적으로 파리티 검증된 적이 **없다**. `color` 케이스가
슬라이더에 vignette를 안 넣고 통과해 온 것도 같은 이유(가려져 있었다).

★**오늘 범위 밖이라 고치지 않았다.** sharpen 재구성과 맞물려 있으니(vignette를
분리해 재정렬하는 김에 공식도 다시 봐야 함) 같이 올린다 -- 별도 사안으로 다룰지
①번 재구성에 묶을지는 제니2 판단.

---

## 4. 검증

`npx tsc --noEmit` 0, `npm test` 461/461 (preview-gl.ts 변경과 무관한 경로,
회귀 없음). `scripts/gl-combo-parity.mjs`는 Playwright 기반이라 `npm test`엔
안 들어간다(기존 `test:parity:*`와 같은 자리). 하니스 자체의 버그 하나를 잡고
고쳤다(아래).

### ★하니스를 만들다 만든 버그, 잡고 고쳤다 -- Q2의 첫 결과가 무효였다

첫 실행에서 Q2 delta가 0.77~3.99로 나왔다(대역 자체가 0.5=REVIEW, 1.0=FAIL인데
그보다 훨씬 큰 값) -- 라운드트립 하나가 이 정도로 비쌀 리 없다고 판단해 원인을 팠다.
2-pass copy+copy(효과 없음, 순수 카피 두 번)조차 원본과 28.19% 벌어졌고, 이건
`vflip`(상하 반전)한 원본과 **정확히 0.0000%** 일치했다 -- 이 하니스의 FBO 체인이
**Y축이 뒤집힌 채로** 두 번째 패스부터 읽고 있었다(이 headless Chromium/ANGLE/
SwiftShader 조합에서 FBO 렌더 결과가 이미지 업로드 텍스처와 다른 Y 컨벤션으로
읽힌다 -- 1-pass 직결은 안 걸리고 2-pass부터 걸림). `preview-gl.ts`의 실제
glow multipass는 같은 모양의 FBO 체인인데 이미 파리티 통과(0.1-0.2%, D3) 이력이
있으므로 **이건 이 신규 스크립트만의 문제**, 출하 코드의 결함이 아니다.

고침: 각 패스가 첫 번째가 아니면 읽기 좌표를 보정하는 `flipRead()`를 셰이더 소스에
**텍스트로** 삽입(`v_uv`를 `v_uv_f = vec2(x, 1-y)`로 치환) -- FRAG_UNSHARP/GRAIN/VIGNETTE
**실제 수학은 한 글자도 안 건드림**, 읽기 좌표만 보정. 고친 뒤 2-pass copy+copy가
1-pass와 0.0000% 일치, Q2 delta가 위 표의 0.000으로 재현됨을 확인하고서야 본문 표를
확정했다. ★**첫 실행의 델타 표를 그대로 결론으로 썼으면 "①은 비싸다, ③으로 가야 한다"는
정반대 결론이 났을 것** -- 도구 버그가 아키텍처 판단을 뒤집을 뻔했다.

---

## 5. 대기

- vignette 셰이더 재작성 + 파리티 케이스 신설(3절) -- 소관 확인 필요.
- sharpen 배선 자체(재구성 포함) -- 오늘은 "어느 쪽이 맞는지"만 쟀고, 실제 배선은
  다음 건.
- `EXPOSED_SLIDER_KEYS`는 여전히 안 건드림.
