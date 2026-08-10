# 레인 C 상태 — 2026-08-10 (작성: 지수2C)

작업 공간: 앱 `C:\Users\Tom\oxxovo-lane-c` / 워커 `C:\Users\Tom\oxxovo-studio-lane-c`,
둘 다 `feat/studio-lane-c`. **미커밋: 앱 0 / 워커 0. 둘 다 push 완료.**

★직전 상태 문서는 `lane_c_state_2026-08-08.md`다. 08-09는 상태 문서 없이 커밋만
남았다(설계 문서 `lane_c_music_100track_manifest_design_2026-08-09.md`로 대체).
**이 문서가 최신이고, 다음 창은 이것만 읽고 이어갈 수 있다.**

| | HEAD |
|---|---|
| 앱 (`oxxovo`) | **`d915633`** |
| 워커 (`oxxovo-studio`) | **`5257120`** (오늘 손 안 댐, 읽기만 -- `effectVideoFilters` 확인용) |

★**오늘 = 두 트랙, 순서대로.** ① 100곡 배치 매니페스트 v1(승인·착수) ② 레인 C
아이템 ④(glow targetIdx 버그 + sharpen 배선 방식 결정 + 재구성까지 완료).

---

## 1. 트랙 A -- 100곡 매니페스트 v1

`tracks/batch-100-v1.json`(워커, `5257120`) -- **100/100 채워짐**, 빈 자리 0.
A 10칸×4 + C 2칸×20 + B 5칸×4(①piano×calm ②ambient×tense ③electronic×energetic
④orchestral×elegant ⑤lo-fi×dark). B②는 제니3 확정(`ambient×tense`, tense 3칸 +
ambient 2칸 대조군을 동시에 채움) -- 이걸로 A 10칸 전부 대조군을 가짐.

bpm 버킷 slow/mid/fast = 정확히 30/35/35(가중 라운드로빈, 100곡 딱 떨어짐).
실제 `parseManifest`(라이브 그리드)로 재검증 통과 -- 17개 셀, 곡수 전부 설계대로.

**대기**: 라이선스 조건 전사(대표님/고문), 실제 오디오 100곡(대표님/본부/공급자,
Soundverse -- 아래 4절), `classifyBatch`가 라이선스 미확정인 한 계속 막는다(의도).

상세: `reports/lane_c_music_100track_manifest_v1_2026-08-10.md`

---

## 2. 트랙 B -- 레인 C ④ (glow + sharpen 배선 방식)

### ① glow targetIdx 버그 -- 수정, 커밋 `818f453`

`GLProcessor.render()`의 glow 분기 최종 카피가 `targetIdx`를 무시하고 항상
캔버스에 그렸다 -- glow + 전환(transition) **조합**에서만 드러남(둘 중 하나만이면
안 걸림). `this.bindTarget(targetIdx, w, h)`로 수정. tsc 0, npm test 461/461.

### ② 조합 파리티 하니스 -- `scripts/gl-combo-parity.mjs`, 커밋 `818f453`

지시된 조건 3개(sharpen+grain / sharpen+vignette 둘 다, ①안 왕복비용 실측, 순서
원인 여부를 가르는 음성대조군) + 부수(vignette/grain 순서 케이스) 전부 실측.

**결론 셋**:
- 패스 하나 추가하는 비용 = **측정상 0**(앞 패스가 이미 8비트로 양자화됐으면,
  뒤 패스가 항등연산이면 추가 손실 없음). → ③(퓨즈)이 풀려던 문제 자체가 없었다.
- sharpen+grain 순서 오차 = grain 자체 크기의 **1.7~2배** → ②는 순서를 못 맞추면
  탈락, 맞춰야 한다.
- sharpen+vignette는 순서 무관 -- 대신 **vignette 셰이더가 애초에 ffmpeg와 다른
  수학**이라는 걸 발견(아래 4절 대기).

### ①로 확정, 재구성 완료 -- 커밋 `d915633`

제니2 승인: "왕복 비용 0이 ③을 지웠다, 순서 오차 1.7~2배가 ②를 지웠다". `preview-gl.ts`
재배선: **색+LUT → sharpen → grain → vignette → glow**, 각각 독립 패스(워커의 실제
순서, `effectVideoFilters`로 확인). `lib/gl-effects.ts`의 `FRAG_COLOR_LUT`에서
vignette/grain을 빼고 `FRAG_GRAIN`/`FRAG_VIGNETTE`로 분리(수식 불변, 자리만 이동).

★**sharpen은 배선됐지만 노출 안 됨** -- `EXPOSED_SLIDER_KEYS` 안 건드림, 오늘 UI
동작 변화 0(`test:parity:engine` color/LUT/glow 숫자가 재구성 전후 완전 동일함으로
확인). 재구성 뒤 재실행한 Q4가 sharpen+grain 순서 비율(2.06/1.92/1.88/1.70)이
자리까지 동일함을 확인 -- 추출이 수식을 안 건드렸다는 뜻이자, "오차가 사라진 게
아니라 그 오차를 낼 수 있는 코드 경로 자체가 없어졌다"는 뜻(물리적으로 순서는
여전히 중요하다).

검증: `npx tsc --noEmit` 0 · `npm test` 461/461 · `npm run test:parity:engine`
ALL PASS(재구성 전후 숫자 완전 동일) · `node scripts/gl-combo-parity.mjs`
Q1~Q4 전부 재실행 확인.

상세 전체(4개 질문 표 + 재구성 diff + 규율): `reports/lane_c_item4_glow_combo_parity_2026-08-10.md`

---

## 3. ★★오늘의 규율 -- 대조군·프로브가 자기 자신을 세 번 잡았다

★첫 실행의 델타 표를 그대로 결론으로 썼으면 "①은 비싸다, ③으로 가야 한다"는
정반대 결론이 났을 것 -- 이건 하니스 자체의 Y축 반전 버그였다(2-pass copy+copy가
`vflip`과 0.0000% 일치로 확인, `flipRead()`로 고침). 같은 세션에서 두 번 더:
Q1a의 음성대조군이 "순서"가 아니라 vignette 셰이더의 수학 모델 자체가 틀렸다는
걸 대신 잡았고, Q4가 재구성 후 재측정으로 셰이더 추출이 무결함을 스스로 검증했다.
**아키텍처 판단 직전의 숫자는 "왜 이 크기인가"를 한 번 더 물을 것.**

---

## 4. Soundverse -- 변수 이름 확정

★대표님이 API 키를 받으심(호출당 과금, Music generation Sync $0.28/곡, 라이선스
티어가 호출 파라미터).

**답변**: 변수명 `SOUNDVERSE_API_KEY`, **워커 Railway env만**(앱 불필요) -- 기존
`FAL_KEY` 컨벤션(벤더명 그대로, 앱 프리픽스 없음)과 동일한 이유: 벤더 호출은
워커에서만 일어난다(`lib/music-provider.ts`: "provider call happens in the
WORKER"). 키 값은 대표님이 Railway 콘솔에 직접 입력(`railway variables --set`
권장, Raw Editor는 조용한 실패 이력 있음 -- `feedback_railway_worker_env`).

★**아직 안 한 것**: 실제 어댑터 구현. 라이선스 티어를 호출 파라미터 자리로 남겨
두라는 요청은 어댑터 설계 시점 사안 -- `lib/music-provider.ts`의 `MusicLicenseTerms`
계약은 이미 티어 개념과 분리돼 있어(호출별 사실 선언 vs 우리 쪽 분류) 자리는
있다. 어댑터 자체는 오늘 범위 아님.

---

## 5. 대기 -- ★내가 고르지 않는다

| 항목 | 소관 |
|---|---|
| ⏸ vignette 셰이더 수학 불일치(distance-smoothstep vs ffmpeg 렌즈각 코사인, 단독 GL vs ffmpeg 19.53% on 26.68%) | 제니2/설계 |
| B② 이후 100곡 라이선스 조건 전사 | 대표님/고문 |
| Soundverse 어댑터 구현(라이선스 티어 파라미터 포함) | 대표님/본부 승인 후 엔지니어링 |
| 실제 오디오 100곡 생성 | 대표님/본부/공급자 |
| `EXPOSED_SLIDER_KEYS` 노출 (sharpen/grain/vignette 배선 끝, 노출만 남음) | 다음 착수 후보 |
| chromatic·motionBlur·lutIntensity 배선 (같은 방식, 효과당 독립 출하) | ④ 다음 |
| D 스파이크(워커 값-곡선) | ④ 다음, 워커 선행 필요 |
| ⑥C 재수립 | 본부·제니3 |
