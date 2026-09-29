# Stage 1b Forensic Analysis — A04_morph / A12_mech ($0, API 호출 없음)

제니 고문 지시 수행. 원자료만 사용:
`oxxovo-scoring/reports/stage1a_raw_output_2026-09-12.json`(rep1) +
`oxxovo-scoring/reports/stage1b_raw_output_2026-09-12.json`(rep2~5). 재호출 0회.

## 방법 메모 (먼저 밝힘)

- 스키마에 "certainty를 고른 이유"를 담는 별도 필드가 없다(`checkId`,
  `check`, `observation`, `frameEvidence`, `certainty` 4개뿐). 그래서
  "④certainty 선택 근거 문장"은 **observation 텍스트 안에 박힌 hedge/단정
  어구를 근거 문장으로 취급**했다. 그런 어구가 없으면 "명시적 근거 문장
  없음"이라고 그대로 적었다(지어내지 않음).
- `gt` 필드에 데이터 이상이 하나 있다: rep1(stage1a)은 A04_morph·A12_mech
  둘 다 `"gt":"YES"`로 찍혀 있는데 rep2~5(stage1b)는 전부 `"gt":"NO"`다.
  EOD 기록상 극성 정정은 "Stage 1a 실행 전"에 끝났다고 되어 있어 이 필드값은
  덤프 스크립트 쪽의 기록 오류로 보이지만, **원인은 확인 안 함**(추측).
  본 분석의 결론(observation/evidence/certainty 안정성 비교)에는 영향
  없음 — certainty 값 자체(rep1 NO, rep2 NO 등)는 stage1b_result_2026-09-12.md
  표와 그대로 일치해 그쪽을 기준으로 삼았다.

---

## A04_morph (handLimbAnatomy, target=frame1/3/4/6)

Certainty 순서: **NO, NO, UNCERTAIN, NO, UNCERTAIN** (rep1~5)

| rep | certainty | frame1 (엉덩이 손) | frame3 (팔 뻗음) | frame4 (오른손+왼팔) | frame6 (파티클 분해) |
|---|---|---|---|---|---|
| 1 | NO | "elongated, tapered dark digits...blade-like" | "flat rectangular slabs" | 오른손 plausible **+ 왼팔 flat dark rectangular shape (손 없음)** | dissolving, blurred |
| 2 | NO | "elongated dark claw-like shapes" | "flat rectangular slabs" | 오른손 visible fingers **+ 왼팔 flat dark rectangular block (손 없음)** | dissolving into purple fragments |
| 3 | **UNCERTAIN** | "elongated pointed nail/finger forms" | "flat rectangular block shapes" | "digit count **appears to be** five but fingertips blend into elongated claw-like shapes" — **왼팔 flat-block 언급 없음** | dissolving, blurred |
| 4 | NO | "unnaturally long/blade-like" | "flat rectangular blocks" | 오른손 splayed plausible **+ 왼팔 flat rectangular cuff shape (손 없음)** | dissolving |
| 5 | **UNCERTAIN** | "**difficult to resolve** as five distinct digits" | "flat rectangular cuff shapes" | "lower right hand with splayed fingers" — **왼팔 flat-block 언급 없음** | dissolving, blurred. 추가: **"Arms and legs are otherwise proportionate."**(다른 4회엔 없는 문장) |

### 확인된 사실(quote 대조)

- **frame1·frame3·frame6에 대한 묘사는 5회 모두 사실상 동일**(같은 결함,
  같은 프레임 번호, 표현만 살짝 다름). 여기엔 NO/UNCERTAIN 차이가 없다.
- **frame4 묘사가 5회 사이에서 실제로 갈린다.** NO 3회(1,2,4)는 전부
  "오른손은 정상, **왼팔은 flat rectangular block/cuff — 손이 없음**"이라는
  두 번째 결함을 명시한다. UNCERTAIN 2회(3,5)는 이 왼팔 결함 문장이
  **둘 다 빠져 있다** — rep3은 frame4를 "오른손 digit count appears to be
  five"로만 서술(hedge는 있지만 결함 문장 자체가 없음), rep5는 frame4를
  "lower right hand with splayed fingers"로만 서술(정상 쪽 묘사만 남음).
- rep5는 5회 중 유일하게 "Arms and legs are otherwise proportionate"라는
  **새로운 안심 문장**을 추가했다 — 다른 4회엔 없음.
- frame1에서만 보면 UNCERTAIN 2회 모두 hedge 표현("appears to be five",
  "difficult to resolve")을 쓰지만, NO 3회도 frame1 자체는 이미 결함으로
  단정하고 있어 frame1 hedge만으론 certainty 차이를 설명 못 한다.

### A~E 판정 (A04_morph 전용)

- **A. Observation 자체가 달라졌는가— 부분적으로 YES.** frame1/3/6은
  불변이지만, frame4에 대한 관찰이 UNCERTAIN 2회에서 "왼팔 손 없음" 결함
  문장이 빠지는 방식으로 실제로 달라진다.
- **B. 인용한 Frame evidence가 달라졌는가 — 아니오(프레임 번호는 5회 모두
  1,3,4,6 동일).** 단, 같은 프레임(4)에서 **보고된 내용의 부분집합**이
  달라진다(위 A 참조) — "어떤 프레임을 봤냐"는 안 변했고 "그 프레임에서
  뭘 보고했냐"가 변했다.
- **C. 같은 Observation + 같은 Evidence인데 certainty만 달라졌는가 —
  아니오, 정확히는 아니다.** frame4 묘사 차이가 있어 순수 계측 오차(C)로
  단정할 수 없다.
- **D. UNCERTAIN을 만든 추가 시각적 근거가 실제로 존재하는가 — 약하게
  YES.** 정확히는 "추가"가 아니라 "생략"이다(frame4 왼팔 결함 누락) +
  rep5는 "사지 비율 정상"이라는 신규 안심 문장을 실제로 추가했다.
- **E. 동일 증거의 confidence 표현만 달라진 것인가 — 아니오, 전부는
  아니다.** frame1 hedge 어구는 표현 차이(E)가 맞지만, frame4 결함 문장
  누락은 표현이 아니라 **보고 내용의 결측**이다.

### 결론 — A04_morph

- **Observation stability**: 프레임 1/3/6은 완전 안정. 프레임 4는
  불안정 — NO 3회는 "왼팔 손 없음(두 번째 결함)"을 보고하고, UNCERTAIN
  2회는 이 결함 보고를 누락한다.
- **Evidence stability**: 인용 프레임 번호(1,3,4,6)는 5회 모두 동일.
- **Certainty stability**: 3 NO / 2 UNCERTAIN, 완전한 0/1 이분은 아님.
- **NO↔UNCERTAIN 원인**: **순수 calibration 문제가 아니다.** frame4에서
  실제로 보고되는 결함 개수가 줄어드는(2개→1개) 관찰 결측이 확인되고,
  이게 certainty 하락(NO→UNCERTAIN)과 정확히 겹친다. 다만 frame1의
  hedge 어구도 동시에 나타나 confidence 표현 요소가 섞여 있다.
- **결론**: "증거는 완전히 동일한데 반올림만 흔들린다"는 09-12 예비
  결론은 **과장**이었다 — frame4에서 실제 관찰 내용 자체가 작게 흔들리고,
  그 흔들림이 certainty와 상관관계를 보인다. 순수 threshold 문제(C)라기보단
  **프레임 단위 관찰 잡음이 certainty discretization에 전이되는 것**에
  더 가깝다. 날조(confabulation)는 여전히 0 — 모든 진술이 사람이 확인한
  GT(frame_01의 비정상 손가락)와 상충하지 않는다.

---

## A12_mech (objectMechanismCoherence, target=frame1/2/5(또는6)/7/8)

Certainty 순서: **NO, UNCERTAIN, NO, UNCERTAIN, NO** (rep1~5)

| rep | certainty | frame5/6 기어 맞물림 | frame7/8 피스톤-크랭크 |
|---|---|---|---|
| 1 | NO | "teeth **appear to overlap/intersect** ... **rather than mesh** at a single pitch line" | rod's big end "terminates on a knurled silver disc **rather than a crank throw**"; frame8 "no crankshaft" |
| 2 | **UNCERTAIN** | "teeth **mesh** with an adjacent gear ... **in a plausible manner**, though some background gears overlap ... without clear engagement" | 피스톤/rod "rest on top of a knurled cylindrical part rather than being joined to a crank journal"(동일 결함 유지) |
| 3 | NO | "teeth **do not clearly mesh** with the adjacent upper gear (teeth overlap/pass **without interlocking**)" | "big end is **not attached** to any visible crankshaft" |
| 4 | **UNCERTAIN** | "**several gear pairs mesh at plausible pitch contact**, but ... background gears ... do not clearly resolve into a single drivable train" | "piston and connecting rod mounted atop a chrome gear rather than a crankshaft journal"(동일 결함 유지) |
| 5 | NO | "gear teeth ... appear adjacent but **meshing is partially obscured**"(단정 회피, 그러나 '맞물린다'고는 안 함) | "rest on top of a grey gear rather than being joined to a crank journal"(동일 결함 유지) |

### 확인된 사실(quote 대조)

- **frame1-4(적재된 스프로킷, 체인 없음)와 frame7/8(피스톤-크랭크 부재)
  결함은 5회 모두 방향이 일치한다** — NO/UNCERTAIN 상관없이 전부 "크랭크축
  없음"을 보고한다. 이 부분은 순수 계측 잡음이 아니라 안정적으로 재현되는
  결함이다.
- **frame5/6(파란 스퍼기어 맞물림)에 대한 판정이 certainty와 정확히
  일치해서 갈린다.** UNCERTAIN 2회(2,4)는 **명시적으로 "plausible하게
  맞물린다"고 긍정 서술**한다. NO 2회(1,3)는 **명시적으로 "맞물리지
  않는다/interlocking 안 됨"**이라고 반대로 서술한다. rep5(NO)는 중립적
  hedge("partially obscured")를 쓰지만 "맞물린다"고는 끝내 말하지 않는다.
- 이건 frame1/3/6이 5회 내내 거의 똑같았던 A04_morph보다 **더 뚜렷한
  진짜 관찰 불일치**다 — 같은 프레임(5 또는 6)에 대해 서로 정반대
  주장("mesh in a plausible manner" vs "do not clearly mesh")이 나온다.

### A~E 판정 (A12_mech 전용)

- **A. Observation 자체가 달라졌는가 — YES, 명확히.** frame5/6의 기어
  맞물림 여부에 대한 실제 판단(있음/없음)이 certainty와 함께 뒤집힌다.
- **B. 인용한 Frame evidence가 달라졌는가 — 부분적으로 YES.** 인용
  프레임 번호 자체(주로 1,3/4,5-7,7,8)는 대체로 겹치지만 rep5만
  frameEvidence 필드가 "1, 2, 7, 8"로 서술 본문(5-7 언급)과 살짝
  어긋난다 — 사소한 필드 표기 불일치, 새 프레임 주장은 아님.
- **C. 같은 Observation + 같은 Evidence인데 certainty만 달라졌는가 —
  아니오.** frame5/6에 대한 관찰 결론 자체가 반대다.
- **D. UNCERTAIN을 만든 추가 시각적 근거가 실제로 존재하는가 — YES.**
  UNCERTAIN 2회는 "일부 기어는 그럴듯하게 맞물린다"는 **실질적인 반대
  증거(exculpatory observation)**를 능동적으로 보고한다. 이건 지어낸
  프레임 인용이 아니라 같은 프레임을 다르게 읽은 것.
- **E. 동일 증거의 confidence 표현만 달라진 것인가 — 아니오,** frame5/6
  건은 표현 문제가 아니라 판단 내용 자체의 반전이다. (frame1-4/7-8 결함
  보고는 5회 모두 안정 — 거기엔 E도 A도 해당 없음, 애초에 안 흔들림.)

### 결론 — A12_mech

- **Observation stability**: 핵심 결함(피스톤에 크랭크축 없음, frame1-4
  스프로킷 미연결)은 5회 전부 안정. **부수적 요소(frame5/6 기어 맞물림
  여부)는 불안정** — 관찰 자체가 반대로 갈린다.
- **Evidence stability**: 인용 프레임 집합은 대체로 겹침(사소한 rep5
  필드 표기 차이 제외).
- **Certainty stability**: 3 NO / 2 UNCERTAIN, A04_morph와 같은 3:2.
- **NO↔UNCERTAIN 원인**: **calibration 문제가 아니라 실제 관찰
  불일치다.** frame5/6의 기어가 맞물리는지 아닌지에 대해 모델이 5회 중
  2회는 "그럴듯하게 맞물린다"고, 3회는 "맞물리지 않는다"고 서로 다르게
  판정했고, 이 판정이 certainty와 완전히 일치한다.
- **결론**: 이 fixture는 A04_morph보다 더 명확하게 "증거가 실제로
  불안정하다"는 쪽이다. 다만 판정 자체(defect 존재)는 5회 모두 NO
  방향으로 수렴 가능한 핵심 결함(크랭크축 부재)이 안정적으로 잡히기 때문에
  confabulation은 아니다 — 애매한 부수 디테일(기어 맞물림) 하나를 어떻게
  읽느냐가 최종 반올림을 흔든다.

---

## 두 fixture 통합 판정 (섞지 않고 병기)

| | A04_morph | A12_mech |
|---|---|---|
| 핵심 결함 보고 안정성 | 안정(frame1/3/6) | 안정(frame1-4, 7/8 크랭크 부재) |
| 흔들리는 지점 | frame4의 "왼팔 결함" **보고 누락** (관찰 결측) + frame1 hedge 어구(표현) | frame5/6 기어 맞물림 **판정 자체의 반전** (관찰 불일치) |
| 순수 confidence 표현 차이(E)뿐인가 | 아니오 — 관찰 결측이 섞여 있음 | 아니오 — 관찰 자체가 반대로 갈림, E보다 더 강한 불안정 |
| Confabulation | 0/5, GT와 상충 없음 | 0/5, GT와 상충 없음 |

**09-12 예비 결론("순수 calibration/반올림 문제")에 대한 정정**: 두
fixture 모두 순수 C(동일 관찰+동일 증거, confidence만 다름)는 아니었다.
실제로는 **핵심 결함은 5회 내내 안정적으로 재현되지만, 그 CHECK 안의
부수적 서브클레임(하나의 프레임 하나의 디테일) 수준에서 진짜 관찰
잡음이 있고, 그 잡음이 NO/UNCERTAIN 반올림을 결정한다.** A04_morph는
그 잡음이 "결함 문장 누락"(관찰 결측) 쪽에 가깝고, A12_mech는 "정반대
판정"(관찰 충돌) 쪽에 가까워 — 같은 현상의 두 다른 얼굴이지만 완전히
동일한 메커니즘은 아니다. 둘을 하나로 뭉뚱그리지 말라는 지시를 따라
독립적으로 남겨 둔다.

## Acceptance 기준 — 변경 없음

Stage 1b FAIL 기록은 그대로 유지. 이 분석은 원인 규명만 하고 판정을
바꾸지 않는다.

## 다음 단계 후보 (제안만, 착수 안 함)

- A04_morph: frame4의 "왼팔=손 없음/flat block" 서브클레임만 별도
  cross-check(예: 같은 CHECK를 frame4 단독으로 다시 물었을 때도 누락되는지)
  하면 이게 "결함 인지 실패"인지 "서술 생략"인지 더 좁혀질 수 있음.
- A12_mech: frame5/6 기어 맞물림 서브클레임에 대해서만 별도 고배율
  crop(ffmpeg, $0)으로 사람이 직접 재확인하면 "실제로 애매한 영역"인지
  아닌지 판가름 가능.
- 두 후보 모두 **API 재호출 0, $0** 로 가능하나, 지시대로 이번 세션에서는
  착수하지 않음 — 고문/본부 확인 후 진행 여부 결정.

## 금지 사항 — 전부 준수, 실행 안 함

API 재호출 0회, Astra/Gemini 실행 안 함, STEP3/4 미연결, Contact Sheet
추가 안 함, InsightFace/OpenCV 추가 안 함, Acceptance threshold 변경
안 함, production commit/deploy 안 함.

---

## ADDENDUM (같은 날, 본부 지시) — 인간 GT 재확인 ②, $0/API 0

본부가 forensic 결론을 확정하며 지시한 재확인 2건. **AI 재질문 0회**,
production extractor와 같은 로컬 ffmpeg 공식(interval=2s, 19.0s 클립→10프레임)으로
원본 R2 클립을 직접 받아 `-accurate_seek` 정밀 시킹 후 고배율 crop, 사람이
직접 봄.

### ① A12_mech — frame5(t=8.0)/frame6(t=10.0) 기어 맞물림, 원본 해상도 고배율 crop

여러 각도로 크롭해 봤다(전체 프레임 → 10x10 그리드 좌표 확인 → 경계 후보
지점 3회 재크롭 → unsharp 필터까지). 결과:

- 파란 전경 기어(베어링 허브 보임)의 이빨과, 인접해 보이는 배경 기어의
  이빨이 만난다고 볼 수 있는 지점을 찾으려 했으나, **크롭할 때마다
  "이게 다른 기어의 이빨인지, 같은 전경 기어 자신의 스포크 구멍 테두리
  (rim)인지"가 구분이 안 됐다** — 두 종류 모두 파란색 매끈한 곡면 + 같은
  하이라이트 패턴(이중 평행선)이라 형태만으로 구별 불가.
- 우측 가장자리 쪽에서는 확실히 별개인 기어(선명한 초점, 다른 이빨 피치)를
  하나 더 찾았고, 그 경계 지점(A12_f4_right류 크롭)에서도 **매끈한
  rim면과 이빨이 맞닿아 있을 뿐 이빨-대-이빨 맞물림(이빨 끝이 상대 골에
  들어가는 패턴)은 확인 못 했다** — 다만 이게 "안 맞물린다"는 확정도 아니고
  "매끈한 면이라 애초에 맞물릴 대상이 아니다"일 수도 있어 판단이 갈렸다.
- 장면 자체가 얕은 피사계심도(배경 기어가 전경보다 살짝 소프트포커스)라
  최대 배율로 올려도 실제 디테일이 더 나오지 않고 블러만 커졌다.

**판정: 애매함 → 본부 지시대로 UNCERTIFIED subclaim으로 강등.** 이
frame5/6 "기어가 그럴듯하게 맞물리는가" 서브클레임은 AI repeatability
실패의 강한 GT로 사용 못 한다 — 사람도 원본 배율에서 확신을 못 냈다.
(단, frame1-4/7-8의 "피스톤에 크랭크축 없음" 핵심 결함은 이 재확인
대상이 아니고, 5회 내내 별도로 안정적이었다 — 그 결론은 안 바뀜.)

### ② A04_morph — frame4(t=6.0) 왼팔 "flat rectangular block, 손 없음" 서브클레임

AI 재질문 없이 사람이 원본 프레임만 직접 봄:

- **왼쪽(그녀의 오른쪽) 팔 끝**: 완전히 매끈하고 각진 테두리의 평평한
  검은 판 형태 — 손가락 마디, 관절, 손 윤곽 어느 것도 없음. 손이라고
  볼 근거가 전혀 없는 명확한 평면 형태.
- **오른쪽(그녀의 왼쪽) 손**: 검은 장갑 형태에 길쭉한 블레이드형 손가락
  2개(광택 하이라이트가 손톱처럼 끝에 맺힘)가 보임 — 정상 손은 아니지만
  "손 형태 자체는 있다"는 점에서 왼쪽과 뚜렷이 다름.

**판정: 명확함(구조가 명확함, 손이 실제로 없음) → 본부 지시대로 CONFIRMED.**
이건 N=5 중 이미 확보된 repeatability evidence(3회 detection·2회 omission)를
강한 GT로 그대로 쓸 수 있다는 뜻이다 — UNCERTAIN 2회(rep3,5)가 이 명확한
결함을 누락 보고했다는 게 사람이 직접 확인한 사실로 확정됐다.

### Gate 2 기록 — 본부 지시안 그대로 채택

> AI가 주요 결함을 반복해서 볼 수 있다는 증거는 있다. 그러나 동일
> 입력의 세부 시각정보에 대해 관찰 누락 또는 상반된 해석이 발생한다.
> 따라서 Observation Repeatability는 아직 통과하지 못했다.

A04_morph(관찰 누락, 인간GT로 확정) / A12_mech(상반된 해석, 그러나
그 해석 대상 자체가 인간에게도 애매해 GT 강도는 A04보다 약함) — 섞지
않고 각각 독립 근거로 기록.

### ③ 다음 결정은 보류 (지시대로)

"individual-frame 입력만의 model observation variability인가, 아니면
Contact Sheet·확대 crop 같은 입력 표현 개선을 A/B 시험해야 하는가"는
이번 재확인 결과를 본부가 검토한 뒤 결정. **prompt 수정 없음, 착수
없음.**

### ④ Master History — 정정 기록 (지우지 않고 순서대로 남김)

1. **Initial interpretation (09-12)**: "confabulation 아니고 순수
   calibration/반올림 문제" (예비 결론, 즉시 수집된 raw output 요약만
   보고 낸 판단).
2. **Forensic evidence (09-16, 본 문서 상단)**: quote 대조 결과 A04는
   관찰 결측, A12는 관찰 충돌 — 순수 calibration이 아님이 드러남.
3. **Corrected conclusion (09-16, 본 addendum)**: 인간이 원본 프레임을
   직접 재확인한 결과, A04_morph의 관찰 결측은 **명확한 GT로 확정**되어
   AI repeatability 실패의 강한 증거로 쓸 수 있음. A12_mech의 관찰 충돌은
   그 대상 서브클레임 자체가 **사람에게도 애매**해 강한 GT로 못 씀(단,
   핵심 결함은 별개로 안정적).

---

## ADDENDUM 2 — A04 단일 A/B 설계 (설계만, API 호출 0, 승인 대기)

본부 확정 판정: **A04_morph=CONFIRMED 실패 / A12_mech=UNCERTIFIED(증거
제외) / Gate2 Observation Repeatability=NOT PASSED.** Contact Sheet를
바로 파이프라인에 넣지 않고, "Claude 자체 변동성인가 vs frame
presentation 방식 때문인가"를 먼저 분리하는 A04 단독 A/B를 설계한다.

### 변수 통제

- 대상 fixture: **A04_morph 단독.**
- 대상 CHECK: handLimbAnatomy. 기존 7-CHECK production 프롬프트 그대로
  — 질문 형식 변경 없음(본부 기존 지시 재확인, "질문을 바꾸면 다른
  시험이 된다").
- 유일하게 바뀌는 변수: **프레임 표현 방식 하나뿐.**
  - **Arm A(대조군, 신규 호출 0)** — production 방식 그대로: 10장의
    개별 프레임 이미지만 첨부. **Stage1a rep1 + Stage1b rep2~5의 기존
    raw output 5건을 그대로 재사용**(완전히 동일 조건이라 재실행 불필요).
  - **Arm B(처치군, 신규 5콜)** — 동일한 10장의 개별 프레임 + **크롭
    없이 10장을 그대로 이어붙인 contact sheet 이미지 1장 추가**(총 11개
    이미지). 프롬프트 텍스트·CHECK 목록·개별 프레임 자체는 A와 완전히
    동일. **crop/확대 없음**(본부 지시 그대로).

### 측정 — 지표 하나만

rep별로 handLimbAnatomy 응답에서 **"frame4(t=6.0)의 왼팔이 flat
rectangular block/cuff로 끝나며 손이 보이지 않는다"는 취지의 명시적
언급이 있는가**만 DETECT/OMIT 이진 판정. 이 기준은 addendum①/②에서
사람이 이미 확정한 GT와 동일 — 새 기준 발명 안 함. 다른 CHECK·다른
프레임 언급은 참고만 하고 이번 지표엔 안 넣는다.

### N

- Arm A = 5(기존 재사용, 신규 호출 0).
- Arm B = 5(신규 호출 5회, A와 표본 크기 동일해 직접 비교).

### Acceptance — 실행 전 지금 사전 고정

- **Pass 후보 신호**: Arm B DETECT ≥ 4/5(80%)이고 Arm A(3/5=60%)보다
  명백히 높음 → "individual-frame 표현 자체가 결측의 상당 원인" 가설
  지지, Contact Sheet 계열 입력 개선을 다음 단계(더 큰 N·다른 fixture)
  검증 후보로 격상.
- **Fail(현행 유지) 신호**: Arm B DETECT ≤ 3/5(A 이하) → 표현 방식
  문제가 아니라 **Claude 자체의 판단 변동성**에 더 가깝다 → Contact
  Sheet를 원인 해결책으로 보지 않는다.
- N=5×2=10인 작은 표본이라 이 A/B는 확정적 통계 검정이 아니라
  **방향성 신호**로만 쓴다(사전 명시) — 결과를 보고 더 큰 N을 태울지
  다음 단계에서 결정.

### 호출 수·비용

- 신규 호출: **5회**(Arm B만).
- 회당 비용: A04_morph 기존 콜 실측 $0.2063~$0.2137(input ~28,651
  tok, output ~2,600 tok, 콜당 평균 ~$0.209) + contact sheet 이미지
  1장 추가분(프레임당 실측 ~2,865 tok 상당의 입력 토큰 증가, 미미)
  → **콜당 예상 $0.21~$0.23.**
- **총 예상 비용: 약 $1.05~$1.15(5콜).**

**API 호출은 이 설계 승인 후에만 진행. 이 설계 문서 자체로는 호출 0.**

## 적어 둠 — Stage 1b 재실행 전 fixture 교체 필요

A12_mech가 UNCERTIFIED로 강등되며 **objectMechanismCoherence의
confirmed positive target이 사라졌다.** 이번 A/B 이후든 언제든 Stage 1b
전체를 다시 돌릴 계획이 생기면, 그 전에 A04_morph가 A13_group을
교체했던 것과 동일한 절차(재조사→대체 후보 확정→본부 승인)로
objectMechanismCoherence positive를 다른 fixture로 먼저 교체 확정해야
한다.

## Master History — 이어서 기록 (지우지 않고 순서대로)

5. **A12_mech 강등 확정**(09-16) — UNCERTIFIED, GT 증거에서 제외.
6. **A04_morph CONFIRMED 확정 + Gate2 Observation Repeatability=NOT
   PASSED 판정 확정**(09-16, 본부).
7. **Contact Sheet를 즉시 투입하지 않고 A04 단독 A/B로 원인(모델
   변동성 vs 프레임 표현) 분리를 먼저 선택한 이유**: Contact Sheet는
   09-12 오전 세션에서 TK가 먼저 제안했다가 지수가 "run-to-run
   instability 실측 근거"로 독립 반대해 본부·고문 판단을 수정시킨
   개입이다([[project_jisoo_resume_2026-09-12]] §A-1) — 효과 검증 없이
   바로 상시 파이프라인에 넣으면 그때와 같은 실수를 반복한다. $1 수준의
   최소 A/B로 먼저 인과를 확인한 뒤에만 다음 단계를 정한다.

## ADDENDUM 3 — Arm B 실행 결과 (본부 승인 2026-09-16 GO, 실행 완료)

### ① Contact sheet 위치 = 맨 앞으로 고정(고정 이유 기록)

**맨 앞(전체→세부)으로 뒀다.** 근거: Gate 1 Sol 위치편향 실측
(`reports/gate1_sol_position_bias_2026-09-10.md`)에서 "content 신호가
약할 때(Medium confidence) 모델이 먼저 붙잡은/마지막에 본 위치에
끌려간다"가 확인됐다. A04_morph의 frame4 결함은 신호가 약한(누락되기
쉬운) 케이스이므로, contact sheet를 **뒤**에 두면 "요약 이미지 위치가
recency로 답을 끌어당겼다"는 것과 "contact sheet 정보 자체가
도움이 됐다"를 구분 못 한다. **맨 앞에 두면 시퀀스의 마지막 이미지가
Arm A와 완전히 동일(개별 frame 10)** 하게 유지되어, Arm A/B 차이가
"contact sheet 유무" 단 하나로만 귀속된다 — 위치편향 교란 변수를
설계로 제거했다.

### ② 실행 = 5콜, 실비 $1.0884(예상 $1.05~1.15 범위 내)

스크립트: `oxxovo-scoring/_stage1b_a04_contactsheet_ab_2026-09-16.mjs`(미커밋).
원자료: `oxxovo-scoring/reports/stage1b_a04_contactsheet_armB_raw_2026-09-16.json`.
5/5 parse 성공, JSON 스키마 위반 0. SYSTEM·CHECKS·모델(`claude-opus-5`)·
파라미터 전부 Stage1a/1b와 글자 그대로 동일 — 유일한 차이는 이미지
목록 맨 앞에 crop 없는 contact sheet 1장 추가뿐.

### ③ 측정 — frame4 DETECT/OMIT 하나만

| rep | certainty | frame4 서술(발췌) | 판정 |
|---|---|---|---|
| 1 | NO | "a flat dark rectangular shape **at the left hand** where fingers would be" | **DETECT** |
| 2 | UNCERTAIN | "the **left hand is obscured by** a dark rectangular object" | **DETECT** |
| 3 | NO | "the **left hand** replaced by a flat dark quadrilateral form" | **DETECT** |
| 4 | NO | "the model's **proper-right hand** is replaced by a flat dark rectangular slab shape" | **DETECT(단, 좌우 라벨 오류 — 아래 참고)** |
| 5 | NO | "**left arm** ending in a flat dark rectangular shape rather than a clearly readable hand" | **DETECT** |

**Arm B DETECT = 5/5(느슨한 기준: 결함 존재 자체) / 4/5(엄격한 기준:
"왼팔"이라고 정확히 명명한 경우만 — rep4는 결함은 정확히 짚었지만
좌우를 반대로 말해 사전 등록한 "왼팔" 문구 기준을 엄밀하게는 못
채운다).** 어느 기준으로 셈해도 **Arm A(3/5=60%) 대비 개선**이고
사전 고정한 Pass 후보 임계(≥4/5)를 넘는다.

rep4의 좌우 반전은 정직하게 기록만 하고 그럴듯한 설명을 지어내지
않는다(추측: 사람 시점 vs 피사체 시점 좌우 관례 혼동일 수 있으나
확인 안 함). certainty 분포도 Arm B가 NO 4/5·UNCERTAIN 1/5로 Arm
A(NO 3/5·UNCERTAIN 2/5)보다 소폭 더 안정적이었다.

### 판정 — 사전 등록 Acceptance 그대로 적용

**Pass 후보 신호 충족(B≥4/5, A=3/5보다 명백히 높음).** 그러나 본부
사전 지시대로 **이 결과만으로 production 적용 안 한다** — A04_morph
단일 fixture·N=5뿐이라 "다음 단계 검증 후보"로만 격상한다. Contact
Sheet가 "표현 방식 문제를 완화한다"는 방향성 신호는 얻었지만, 이게
(a) 진짜 정보 이득인지 (b) 우연(N=5의 표본 변동)인지는 이 실험
하나로 구분 안 된다 — 더 큰 N, 다른 fixture(특히 objectMechanismCoherence
교체 fixture 확정 후)로 재검증이 다음 단계.

### Master History — 이어서(안 지움)

8. **Contact Sheet A/B(A04 단독, N=5) 실행 완료, $1.0884, Pass 후보
   신호(4~5/5 DETECT, A=3/5 대비 개선) — 그러나 production 적용은
   보류, 다음 단계 검증 후보로만 기록**(09-16).

## ADDENDUM 4 — A12 대체 fixture 탐색 ($0, API 호출 0, GT 작업만)

### rep4 좌우 반전 — 별도 기록(성공 속에 안 묻음)

Arm B DETECT 집계에서는 인정했지만, **Observation Accuracy 관점에서는
이건 독립된 결함이다**: rep4는 frame4의 "한쪽 팔이 flat rectangular
block으로 끝나며 손이 안 보인다"는 핵심 결함 자체는 정확히 짚었지만,
그 팔을 "proper-**right** hand"라고 명명했다 — 사람이 확인한 실제
결함은 **왼팔**이다(addendum②). 이건 **localization/orientation
오류**이지 결함 탐지 실패가 아니다. DETECT 집계와 별개 항목으로
남긴다. 원인은 추측하지 않는다(확인 안 함).

### ① 탐색 — objectMechanismCoherence 대체 후보

`reports/gate1_real_production_failure_survey_2026-09-09.md`(cluster
D, "Mechanically/physically implausible object geometry")가 유일하게
남긴 다른 "strong" 후보는 **A09_race**(슈퍼카 드리프트 프로모)뿐이었다
— A12_mech 외 강한 후보는 이거 하나. 단, 이 survey 자체가 AI/이전
세션의 주장이므로 **그 텍스트를 GT로 베끼지 않고**, 아래처럼 처음부터
다시 사람이 직접 확인했다.

### ② extractor 확인

`_gate1_mockprelim_urls_2026-09-09.json`에서 A09_race 원본 R2 클립
URL 확보 → 로컬 다운로드 → ffprobe 확인: **19.0초, 1080x1920**(다른
A-그룹 클립들과 동일 스펙) → production 공식(`interval=max(2,dur/20)=2`)
그대로 로컬 ffmpeg로 **10프레임**(t=0,2,4,...,18) 재추출, `-accurate_seek`
정밀 시킹.

### ③ 인간 육안 검증 (원본 해상도, 크롭 없이 먼저 확인)

10프레임 contact sheet로 먼저 훑고, 문제 프레임만 원본 그대로 확인:

- **frame_07(t=12.0)**: 차량 지붕/앞유리 바로 위 허공에서 **거대한
  금색 스파크 다발이 솟구쳐 나온다** — 원본 프레임 그대로, 크롭 없이도
  한눈에 보인다. 배기구·통풍구·환기 파이프 등 스파크의 출처가 될 만한
  구조물이 그 위치에 전혀 없다(사이드미러·A필러·윈드실드만 보임).
  차는 정상 주행 자세(드리프트 각도 아님)라 타이어-노면 마찰 스파크로도
  설명 안 된다. **원본 그대로 명확함 — 확대해서 겨우 보이는 애매함이
  아니다.**
  - 참고: survey 원문은 "sparks float disconnected **above the hood**"라고
    적었으나, 내가 직접 보니 실제 위치는 후드가 아니라 **지붕/앞유리
    라인 위**였다 — survey 문구를 그대로 베끼지 않고 직접 재확인해서
    잡아낸 차이(본부 지시 "AI가 먼저 주장한 내용을 GT로 쓰지 마라"를
    그대로 적용한 결과).
- **frame_03(t=4.0)**: 스파크가 앞바퀴 근처에서 나오는 것처럼 보여
  frame_07보다 훨씬 애매하다(바퀴 자체의 이펙트로 해석될 여지가 있음)
  — **약한 후보라 CONFIRMED 근거에서 제외**, 참고용으로만 기록.
- **frame_04(t=6.0)**: 후미등 옆에서 나오는 흰색 궤적은 스타일화된
  "스피드 트레일" VFX로 보일 여지가 커서(의도된 연출일 가능성) —
  **제외**.

### ④ Supporting frames·판정

**A09_race / objectMechanismCoherence — CONFIRMED (positive).**
Supporting frame: **frame_07(t=12.0)** 단독(A12_mech처럼 2장은 아니고
1장 — A04_morph의 frame_01 단독 확정 사례와 동급 강도로 취급). 근거:
물리적 과정(스파크/마찰불꽃)이 그 발생을 설명할 어떤 접촉면·구조물도
없이 허공에 나타남 — CHECK 문구("does the depicted mechanism work as
a coherent physical system within that one frame")에 정확히 들어맞고,
단일 프레임 안에서 다른 프레임 참조 없이 판정 가능하다.

### 절차 요약

탐색(survey cluster D) → extractor 확인(19.0s/1080x1920/10프레임,
production 공식) → 인간 육안 검증(crop 없이 원본에서 frame_07 확정,
frame_03/04는 애매해 제외) → supporting frame 확정(frame_07 단독) →
**CONFIRMED**.

### Master History — 이어서(안 지움)

9. **rep4 좌우 반전을 DETECT 집계와 별개로 localization/orientation
   오류로 명시 기록**(09-16).
10. **A12_mech 대체 fixture 탐색 → A09_race/objectMechanismCoherence
    positive CONFIRMED(frame_07 t=12.0 단독), survey 원문("above the
    hood")과 실제 위치("지붕/앞유리 위")가 달라 직접 재검증이 필요했던
    사례로 기록**(09-16).

## ADDENDUM 5 — Contact Sheet 일반화 A/B 설계 (설계만, API 호출 0)

### ① A09_race GT 정의 — factual observation으로 고정(스타일 판단 배제)

**GT (이 표현만 쓴다):** "frame_07(t=12.0)에서, 차량 구조나 주행
상태와 연결되지 않은 위치(지붕/앞유리 라인 위 허공)에서 큰 스파크
다발이 발생하는 것이 관찰된다." **"스파크라는 연출 자체가 이상하다"는
판단은 GT에 넣지 않는다** — 연출(스타일) 판단이 아니라 위치적
비연결성(factual)만 GT로 삼는다. A04_morph GT("frame4 왼팔이 flat
rectangular block으로 끝나며 손이 안 보인다")도 동일 원칙으로 이미
factual하게 적혀 있었다 — A09도 같은 기준으로 맞춘다.

### ② 목적 — 일반화 축 + 회귀/안전 축을 분리

지난 A04 단독 A/B는 "우연히 A04에서만 통하는 효과"일 가능성을 배제
못 한다. 이번엔 서로 다른 결함 종류를 섞어 **두 가지를 동시에** 본다:

- **일반화 축(개선 여지가 있는 fixture)**: A09_race(mechanism) — 이건
  A04처럼 baseline 자체가 완벽하지 않을 가능성이 있는 신규 confirmed
  fixture라 Contact Sheet 효과를 A04 밖에서도 재현하는지 볼 수 있다.
- **회귀/안전 축(이미 baseline 5/5인 fixture)**: Z03_studio(identity)·
  demo_consistency(temporal degradation)·aurelie(transition)·
  novya(text stability) — 넷 다 기존 Stage1a/1b에서 **이미 5/5
  완벽**이었다. 여기서 Contact Sheet의 역할은 "개선"이 아니라 **이미
  잘 되던 걸 망가뜨리지 않는지 확인하는 회귀 테스트**다.
- **confabulation 통제 축**: demo_anne(claimedActionEvidence, GT=
  UNCERTAIN) — 다리가 안 보여 "확인 불가"가 정답인 케이스. Contact
  Sheet가 탐지율을 높이는 대신 **없는 걸 만들어내는지**(예: 안 보이는
  다리/보행 동작을 "봤다"고 주장하며 certainty를 YES/NO로 잘못
  당기는지) 이걸로만 확인한다.

### ③ 후보 fixture·GT·baseline 재사용 여부·A/B 조건·N — 한 번에

| Fixture | CHECK | GT(factual) | 축 | 기존 Arm A(reuse) | 신규 Arm A | 신규 Arm B | N |
|---|---|---|---|---|---|---|---|
| A04_morph | handLimbAnatomy | frame4 왼팔 flat block, 손 없음 | 일반화(이미 완료) | ✅(3/5) | 0 | 0(이미 완료, 4~5/5) | 5+5 |
| **A09_race** | objectMechanismCoherence | frame_07 스파크가 구조와 비연결 | **일반화(신규)** | 없음(신규 fixture) | **5(신규)** | **5(신규)** | 5+5 |
| Z03_studio | subjectIdentityCount | frame4→5 경계에서 다른 사람으로 교체 | 회귀/안전 | ✅(5/5) | 0 | **5(신규)** | 5 |
| demo_consistency | progressiveDegradation | frame2→10 하늘에 소용돌이 스트릭 발생 | 회귀/안전 | ✅(5/5) | 0 | **5(신규)** | 5 |
| aurelie | transitionIntegrity | frame7/12 이중노출·고스팅 | 회귀/안전 | ✅(5/5) | 0 | **5(신규)** | 5 |
| novya | brandTextIdentityStability | frame4/14 철자 NOWYA→NOVYA | 회귀/안전 | ✅(5/5) | 0 | **5(신규)** | 5 |
| demo_anne | claimedActionEvidence | 다리 확인 불가(GT=UNCERTAIN, "안 걷는다" 아님) | **confabulation 통제** | ✅(5/5, UNCERTAIN×5) | 0 | **5(신규)** | 5 |

A04는 이미 완료된 데이터를 표에 병기만 하고 신규 호출 없음. **신규
호출이 필요한 건 A09(Arm A+B)와 나머지 5개 fixture의 Arm B뿐.**

### ④ 측정 — fixture 성격별로 다르게, 축별로 분리 집계

- **일반화 축(A09)**: A04와 동일하게 GT 문장을 명시적으로 언급하는지
  DETECT/OMIT.
- **회귀/안전 축(Z03·demo_consistency·aurelie·novya)**: Arm B가 기존
  GT 문장을 **여전히** 명시적으로 언급하는지 DETECT/OMIT — **5/5
  유지가 PASS, 4/5 이하로 떨어지면 그 자체가 독립적 FAIL 신호**(다른
  fixture 좋은 결과로 평균 내서 묻지 않는다).
- **confabulation 통제(demo_anne)**: 두 가지를 같이 판정 — (a)
  certainty가 UNCERTAIN/NOT_VISIBLE로 유지되는가(정답), (b) observation에
  다리/보행 동작에 대한 **새로운 구체적 시각 주장**(프레임에 실제로
  없는 것)이 등장하는가. (b)가 단 1건이라도 나오면 **confabulation
  위험 확정**으로 별도 표시 — 다른 축 결과와 절대 합산하지 않는다.

### ⑤ 신규 호출 수·예상 비용

기존 실측 단가(Arm A 스타일, fixture별 frame 수 반영) + contact sheet
추가분(A04 실측 기준 콜당 +$0.007~0.015) 적용:

| Fixture | 호출 종류 | 콜 수 | 단가 예상 | 소계 |
|---|---|---|---|---|
| A09_race | Arm A(신규) | 5 | ~$0.205 | ~$1.03 |
| A09_race | Arm B(신규) | 5 | ~$0.220 | ~$1.10 |
| Z03_studio | Arm B(신규) | 5 | ~$0.220 | ~$1.10 |
| demo_consistency | Arm B(신규) | 5 | ~$0.142 | ~$0.71 |
| aurelie | Arm B(신규) | 5 | ~$0.277 | ~$1.39 |
| novya | Arm B(신규) | 5 | ~$0.275 | ~$1.38 |
| demo_anne | Arm B(신규) | 5 | ~$0.132 | ~$0.66 |

**총 신규 호출 35회, 총 예상 비용 약 $7.35~$7.90.** (참고: A04는 이미
끝난 10콜/$1.30 별도, 이번 신규분에 안 들어감.)

### ⑥ 사전 Acceptance(본부 수정 반영, 실행 전 지금 최종 고정)

**A09 일반화축 — 판정표를 사전 고정한다(결과 보고 나서 바꾸지 않음):**

| A(Arm A) | B(Arm B) | 판정 |
|---|---|---|
| ≤3/5 | ≥4/5 | **개선 방향성 신호** |
| =4/5 | =5/5 | **INCONCLUSIVE** — 개선 주장 금지(A04의 3/5→4~5/5와 같은 폭의 증거가 아님) |
| =5/5 | 무엇이든 | **CEILING/INCONCLUSIVE** |
| 무엇이든 | B ≤ A | **개선 신호 없음** |
| 그 외 애매한 조합 | | **INCONCLUSIVE** |

근거: "다른 fixture에서도 재현됐다"고 말하려면 A04의 3/5→4~5/5와
**동일 수준의 방향성 증거**가 나와야 한다 — 작은 차이(4/5→5/5 같은)를
같은 무게로 취급하지 않는다.

- **회귀 없음(불변)**: Z03·demo_consistency·aurelie·novya **넷 다**
  Arm B DETECT=5/5 유지. 하나라도 4/5 이하면 독립 FAIL 기록(평균으로
  안 묻음).
- **confabulation 없음 — demo_anne 허용 기준 정밀화(본부 지시 반영)**:
  Arm B certainty가 UNCERTAIN이거나, **NOT_VISIBLE이 나오더라도 그
  의미가 "허벅지는 visible이고 무릎 이하·보행 진행이 확인되지 않는다"일
  때만 허용**한다(Stage1b ⑤ 정밀표현 기준과 동일선상). "다리/사람이
  안 보인다"는 식의 부정확한 NOT_VISIBLE이나, 다리·보행에 대한 **새로운
  구체적 시각 주장**(프레임에 실제로 없는 것)이 하나라도 나오면
  confabulation 위험으로 별도 표시 — 다른 축과 절대 합산하지 않는다.
- **종합 판단 규칙**: "Contact Sheet가 일반적으로 유익하다"는 결론은
  일반화축이 "개선 방향성 신호"이고, 회귀축 넷 다 5/5 유지, confabulation
  0건일 때만 쓴다. 하나라도 어긋나면 뭉개지 않고 그 지점 그대로
  보고한다. **결과를 본 뒤 이 Acceptance를 바꾸지 않는다(본부 지시).**
- **이번은 generalization test다** — 결과가 전부 좋아도 Contact Sheet
  production 적용을 자동 승인하지 않는다(본부 명시).
- 결과는 **축별로 따로** 보고한다. 평균 금지.
- 여전히 N=5×여러 fixture라 확정적 통계가 아니라 **방향성 신호**로만
  쓴다.

**API 호출은 아래 $0 dry-run 확인 후 진행(재승인 없이, 본부 사전 승인
됨).**

## ADDENDUM 6 — $0 dry-run (API 호출 0) → 정상 확인 → 35콜 실행

### dry-run 결과

6개 fixture(A09_race·Z03_studio·demo_consistency·aurelie·novya·
demo_anne) 전부에서 확인:

- **Arm B 이미지 순서 = "contact sheet 먼저 → frame 1 → ... →
  frame N" — 6개 fixture 전부 동일 패턴.** (novya/aurelie는 N=14,
  demo_anne는 N=8, 나머지는 N=10 — production 공식 그대로, GT
  문서의 기존 supporting-frame 인용 t값과 전부 재대조해 일치 확인.)
- **contact sheet 생성은 `scale=`+`xstack=`만 사용, `crop` 필터 없음**
  — resize 외 다른 조작 없음(직접 커맨드 확인).
- **원본 프레임 순서·개수가 기존 Arm A(재사용분)와 동일**: Z03/A04/A09/
  A12=10프레임(t=0~18), aurelie/novya=14프레임(t=0~26), demo_anne=
  8프레임(t=0~14) — 전부 기존 raw output의 frameCount 필드 및 GT
  문서의 frame 인용과 재검증 일치.
- ※사소한 발견: `observation_accuracy_gt_and_coverage_2026-09-12.md`의
  예시 문장("20.1s→11장")은 demo_consistency(실측 20.1s)의 실제
  frameCount(10, 기존 raw output에 기록됨)와 다르다 — 그 문서 자체의
  일반 예시 서술 오류로 보이며(같은 문서의 demo_consistency
  supporting-frame 인용 "frame_10(t=18.0)"과는 오히려 10프레임 쪽이
  일치), 이번 재현은 **실제 기록된 frameCount(10)** 쪽을 따랐다.

**판정: dry-run 정상.** 본부 지시대로 재승인 없이 35콜 실행.

### 실행 — 35콜, 실비 $7.2037(예상 $7.35~$7.90 범위 내, 약간 낮음)

원자료: `oxxovo-scoring/reports/stage1b_contactsheet_generalization_raw_2026-09-16.json`.
35/35 parse 성공, 스키마 위반 0.

---

## ADDENDUM 7 — 결과, 축별로 분리(평균 없음)

### 축 1(일반화) — A09_race — **개선 신호 없음(B ≤ A)**

| rep | Arm A certainty | frame_07 언급 | Arm B certainty | frame_07 언급 |
|---|---|---|---|---|
| 1 | UNCERTAIN | ❌ 없음(frame3/4/8만 언급) | **YES**("No frame shows an assembly with clearly impossible internal construction") | ❌ 없음 — **명시적으로 결함 부정** |
| 2 | UNCERTAIN | ✅ "sparks falling around the front... no visible contact source" | UNCERTAIN | ✅ "sparks arcing above the roof/mirror area with no visible contact point" |
| 3 | UNCERTAIN | ✅ "sparks arcing above the roofline... no visible contact source" | UNCERTAIN | ✅ "sparks falling from above the roof with no visible contact source" |
| 4 | UNCERTAIN | ✅ "sparks falling around the front... no visible contact source" | UNCERTAIN | ❌ 없음(frame3/4/5/6만 언급) |
| 5 | UNCERTAIN | ❌ 없음(frame3/4/5/6만 언급) | UNCERTAIN | ✅ "sparks scattering above the car's hood/roof area with no visible contact source" |

**Arm A DETECT = 3/5. Arm B DETECT = 3/5. B ≤ A.**

사전 고정 판정표 적용: **"개선 신호 없음"** — A04의 3/5→4~5/5 같은
방향성이 A09에서는 재현되지 않았다. 게다가 **Arm B rep1은 단순 누락이
아니라 결함 자체를 명시적으로 부정(certainty=YES, "완전히 정상")** —
이건 누락보다 더 나쁜 실패 모드다(허위 안전 판정). Contact Sheet가
A09에서는 개선도 안전도 아니었다.

### 축 2(회귀/안전) — Z03·demo_consistency·aurelie·novya — **넷 다 회귀 없음**

| Fixture | Arm B certainty(5회) | DETECT | 판정 |
|---|---|---|---|
| Z03_studio | YES×5 | **5/5** | PASS(기존 5/5 유지) |
| demo_consistency | YES×5 | **5/5** | PASS(기존 5/5 유지) |
| aurelie | YES×5 | **5/5** | PASS(기존 5/5 유지) |
| novya | NO×5 | **5/5** | PASS(기존 5/5 유지) |

**넷 다 회귀 없음.** 단 novya에서 참고사항 하나: 이번 5회 전부
frame4/5 병 각인을 "**NOVVYA**"(V 두 개, 6글자)로 읽었다 — 기존
confirmed GT는 "**NOWYA**"(W 하나, 5글자)였다. 이건 **Contact Sheet가
새로 만든 오류가 아니다** — 09-12 세션에서 이미 "novya rep5가
NOWYA/NOVVYA라고 스스로 글리프 모호성을 인정"한 사례가 기록되어 있다
(`stage1b_result_2026-09-12.md` §4) — 즉 이 스타일라이즈 폰트(W가
V 두 개로 겹쳐 보임)의 원래부터 있던 애매함이지 Contact Sheet 유발
현상이 아니다. CHECK 자체의 정답(철자가 불안정하다=NO)은 5/5 그대로
맞혔다.

### 축 3(confabulation 통제) — demo_anne — **confabulation 0건, 정밀표현 유지**

| rep | certainty | 정밀표현 기준 부합 | 확대해석/날조 |
|---|---|---|---|
| 1 | UNCERTAIN | ✅ "legs...visible from the thigh...feet/lower legs are cropped out...stride contact not visible" | 없음 |
| 2 | UNCERTAIN | ✅ "cropped at or just below the knee/thigh...no visible gait cycle" | 없음 |
| 3 | UNCERTAIN | ✅ "frame crops at roughly mid-thigh to knee and feet are never shown" | 없음 |
| 4 | UNCERTAIN | ✅ "visible only from hip to mid-thigh/knee...feet are cropped out" | 없음 |
| 5 | UNCERTAIN | ✅ "visible only from the hip/thigh to the lower crop edge...feet are never visible" | 없음 |

**5/5 전부 UNCERTAIN 유지 + 5/5 전부 정밀표현 기준("허벅지/다리는
보이나 무릎 이하·보행 진행 확인 안 됨") 부합.** "다리/사람이 안
보인다"는 부정확한 표현은 0건, 걷는 동작이나 발을 "봤다"는 새 시각
주장도 0건. Contact Sheet가 배경(벤치·나무 이동)을 더 자세히
언급하게는 만들었지만, 그건 실제 프레임에 있는 내용(카메라/피사체
이동)이라 confabulation이 아니다 — 목표 결함(다리/보행 증거) 쪽으로는
과장하지 않았다.

### 종합 판정 — 사전 등록 규칙 그대로 적용, 결과 보고 후 기준 변경 없음

**"Contact Sheet가 일반적으로 유익하다"는 결론은 성립하지 않는다.**
사전 고정한 종합 규칙(일반화+회귀없음+confabulation없음 **전부** 충족)
중 **일반화 축이 FAIL(개선 신호 없음, 심지어 1건은 명시적 오탐 발생)**
이라 전체 결론을 못 낸다. 축별로 그대로 남긴다:

- **일반화**: 실패 — A04에서 본 효과가 A09로 재현 안 됨. **오히려
  새로운 실패 모드(누락이 아니라 명시적 오답) 1건 관찰**.
- **회귀**: 통과 — 이미 잘 되던 4개 결함 유형(identity·temporal
  degradation·transition·text stability) 전부 안 망가짐.
- **confabulation**: 통과 — 없는 걸 만들어내지 않음, 정밀표현 유지.

**이건 generalization test였고, 결과가 섞여 있다(축마다 다름) —
Contact Sheet production 적용은 여전히 근거 부족.** 본부 지시대로
이 결과를 보고 Acceptance를 바꾸지 않았고, production 적용 자동승인도
하지 않는다.

### Master History — 이어서(안 지움)

11. **Contact Sheet 일반화 A/B(35콜, $7.2037) 실행 완료 — 축별
    결과가 갈림**: 일반화축(A09) FAIL(3/5→3/5, 개선 없음 + 명시적
    오탐 1건 신규 관찰), 회귀축(4개 fixture) 전부 PASS(5/5 유지),
    confabulation축(demo_anne) PASS(0건, 정밀표현 유지). 종합
    결론 "일반적으로 유익" 성립 안 함 — production 적용 근거 부족으로
    유지(09-16).

## ADDENDUM 8 — Contact Sheet generalization 종료 + Cross-Model 설계

### ① Contact Sheet generalization — 본부 지시대로 종료, 결론 고정

> **"A04에서는 도움. A09에서는 도움 없음 + 1회 명시적 오판. 다른 5개
> control에서는 악화 없음. → Contact Sheet 일반효과 미확인."**

추가 Contact Sheet 실험(fixture·N 확장 포함) 전부 **HOLD**. 지금
fixture·N을 더 늘리는 건 "Contact Sheet를 살리기 위한 실험"이 되므로
하지 않는다 — 본질은 Contact Sheet가 아니라 **"동일한 시각정보에서
observation이 반복 가능한가"**다.

### ② A09 결과의 무게 — 재확인

A09_race Arm A(개별 프레임만, 기존 production 방식)는 **5회 전부
certainty=UNCERTAIN**이었다(3/5만 GT 문장 명시, 나머지 2회는 언급
자체가 없거나 다른 프레임만 서술). 사람에게는 frame_07이 crop 없이도
명확한 CONFIRMED인데, Claude는 5회 중 어느 한 번도 "NO"로 확정하지
못했다 — **Stage 1b FAIL·Gate2 NOT PASSED가 A09 사례로 더 강하게
뒷받침된다.**

### ③④ 다음 질문 — Cross-Model 설계(설계만, API 호출 0)

**질문: "이것이 Claude만의 한계인가, 아니면 다른 최상위 multimodal
judge(Astra/Gemini)에서도 같은 문제인가?"**

비교 대상은 **score도 STEP3/4도 아니다** — 오직 "같은 production
individual frames → 같은 verification CHECK(7개 그대로, 변경 없음)
→ confirmed factual observation을 반복해서 보는가"만 본다. 대상은
**A04_morph + A09_race 둘만.**

**Claude/Astra/Gemini 실제 API 배선 확인**(`src/scorer.ts` 정독,
2026-09-11 Primary 3 확정 근거):
- Claude: `claude-opus-5`, Anthropic SDK, thinking disabled — 우리가
  이미 5번 쓴 그 경로.
- Astra: `gpt-6-astra`, OpenAI SDK 네이티브(OpenRouter 아님),
  `max_completion_tokens`(max_tokens 아님) + `reasoning_effort:'low'`,
  temperature 필드 자체 미전송(400 거부 실측 있음). 단가 input $10/M·
  output $50/M(세 모델 중 가장 비쌈).
- Gemini: `gemini-3.8-flash`, `@google/generative-ai` SDK,
  `thinkingConfig.thinkingLevel:'low'`, temperature 사실상 무시.
  단가 input $0.75/M·output $3.75/M(가장 쌈).
- ⚠️ 이 세 함수는 전부 **production 채점 스키마**(creativeDirection/
  execution/originality/integrity)용이다 — 우리 7-CHECK 관찰검증
  스키마로는 Astra/Gemini를 **한 번도 부른 적 없다.** 그래서 이번이
  Astra/Gemini에 우리 SYSTEM/CHECKS를 처음 태우는 것 — SYSTEM 프롬프트
  텍스트·CHECKS 순서·질문 문구는 Claude 때와 **완전히 동일**하게
  유지하고, provider별로 필요한 최소 배선차이(위 파라미터들)만
  다르게 건다.

**Claude 기존 데이터 재사용 범위 — 신규 호출 0.**
- A04_morph 개별 프레임 Arm A: Stage1a rep1+Stage1b rep2~5(N=5,
  3/5 DETECT) 그대로 재사용.
- A09_race 개별 프레임 Arm A: 이번 Contact Sheet 실험에서 이미
  실행한 5콜(N=5, 3/5 DETECT, contact sheet 없는 순수 개별 프레임
  버전) 그대로 재사용 — **이게 정확히 이번에 필요한 "Claude, 개별
  프레임만, A09" 데이터와 같은 조건**이라 다시 안 돌린다.

**Astra/Gemini 최소 신규 호출**

| Fixture | Judge | N | 신규 호출 |
|---|---|---|---|
| A04_morph | Astra | 5 | 5 |
| A04_morph | Gemini | 5 | 5 |
| A09_race | Astra | 5 | 5 |
| A09_race | Gemini | 5 | 5 |

**총 신규 호출 20회**(Astra 10 + Gemini 10). Claude 신규 호출 0.

**예상 비용(러프 추정 — provider별 이미지 토큰화 공식이 달라 Claude
실측치를 그대로 못 옮긴다, 실행 시 실측으로 확정)**:
- Astra: 콜당 이미지 10장+텍스트 ≈ input 28,000~30,000 tok·output
  2,500~3,000 tok 가정 → input $0.28~0.30 + output $0.125~0.15 ≈
  **콜당 $0.40~0.45** × 10콜 ≈ **$4.0~4.5**.
- Gemini: 같은 가정 → input $0.021~0.023 + output $0.009~0.011 ≈
  **콜당 $0.03~0.035** × 10콜 ≈ **$0.3~0.35**.
- **총 예상 $4.3~$4.9**(20콜). Astra가 비용 대부분을 차지 — 세
  judge 중 유일하게 $ 단위로 유의미하다.

**사전 Acceptance(실행 전 고정)**

- 각 (fixture×judge) 셀에서 DETECT/5 계산 — **평균 내지 않고 6개
  셀(2 fixture×3 judge) 전부 개별 보고.**
- **해석 매트릭스**(결과 보고 후 바꾸지 않음):
  - Astra·Gemini **둘 다** A04·A09에서 5/5(또는 이에 준하는 완전
    탐지) → **"Claude만의 한계"** 쪽 증거.
  - Astra 또는 Gemini **중 하나 이상**이 Claude와 비슷한 반복성
    저하(≤3~4/5, 또는 스키마 자체를 못 지키는 등)를 보이면 →
    **"multimodal judge 전반의 문제일 수 있다"** 쪽 증거.
  - 애매하거나 셀마다 갈리면 뭉개지 않고 **셀별로 그대로 보고**
    (예: "Astra는 A04 5/5·A09 2/5", "Gemini는 둘 다 스키마 자체
    준수 실패" 등 있는 그대로).
  - N=5/셀이라 **방향성 신호로만** 쓴다.
- **스키마 준수 자체도 별도 기록**: parse 실패나 7-CHECK 형식
  이탈은 "탐지 실패"가 아니라 "형식 실패"로 분리한다(둘을 섞으면
  DETECT율이 오염된다).
- STEP3/4·CV·prompt·code 변경 전부 금지. 이번 결과로 production
  판정을 내리지 않는다(순수 진단).

**API 호출은 이 설계 승인 후에만. 현재 호출 0.**

### Master History — 둘 다 보존(이어서, 안 지움)

12. **A04_morph — Contact Sheet improvement**(Arm A 3/5 → Arm B
    4~5/5, pass 후보 신호, production 미적용).
13. **A09_race — Contact Sheet non-replication**(Arm A 3/5 → Arm B
    3/5, 개선 없음 + 신규 명시적 오탐 1건).
14. **종합: "Contact Sheet 일반효과 미확인" — 추가 Contact Sheet
    실험 종료.** 다음 질문(Claude 고유 한계 vs multimodal judge
    공통 문제)으로 방향 전환, Cross-Model(Claude 재사용+Astra/Gemini
    신규 20콜) 설계 완료·승인 대기(09-16).

## ADDENDUM 9 — Cross-Model 실행 결과 (본부 승인 GO, 실행 완료) — ★핵심 발견

### 실행

20/20콜 성공, parse 실패 0, 스키마 실패 0(7개 CHECK 배열 형태
전부 정상) — **형식 실패와 판단 실패가 섞이지 않았다**(Qwen 때
착시 재발 없음). 실비 **$3.3037**(예상 $4.3~4.9보다 낮음 — Gemini
실제 이미지 토큰 비용이 추정보다 훨씬 낮았다). 원자료:
`oxxovo-scoring/reports/stage1b_crossmodel_a04_a09_raw_2026-09-16.json`.
스크립트: `oxxovo-scoring/_stage1b_crossmodel_a04_a09_2026-09-16.mjs`
(둘 다 미커밋).

### 6개 셀 — 평균 없이 그대로(raw count)

| Fixture | Judge | certainty 5회 | GT 문장 명시 DETECT | 비고 |
|---|---|---|---|---|
| A04_morph | **Claude**(기존 재사용) | NO,NO,UNCERTAIN,NO,UNCERTAIN | **3/5** | 기존 Stage1a/1b 데이터 |
| A04_morph | **Astra**(신규) | UNCERTAIN×5 | **0/5** | 5회 전부 frame4를 "손가락 겹침/그림자"로만 서술 — "flat rectangular block, 손 없음" 취지는 **한 번도 안 나옴** |
| A04_morph | **Gemini**(신규) | YES×5 | **0/5** | 5회 전부 "hands...show standard anatomy/plausible" — **결함을 아예 안 봄, 매번 확신에 찬 오답** |
| A09_race | **Claude**(기존 재사용) | UNCERTAIN×5 | **3/5** | 이번 Contact Sheet 실험의 Arm A 그대로 |
| A09_race | **Astra**(신규) | YES×1,UNCERTAIN×4 | **0/5** | frame7을 언급은 하되(4/5) "sources...not sufficiently exposed **to verify**"— GT의 "no visible contact source" 단정이 아니라 검증불가 회피, DETECT로 못 셈 |
| A09_race | **Gemini**(신규) | YES×5 | **0/5** | 5회 전부 "wheels/brake calipers...coherent" — 스파크 자체를 언급조차 안 함, 매번 확신에 찬 오답 |

### 분기점 재검토 — 본부 사전 잠금 두 갈래 중 어느 쪽에도 깔끔히 안 맞는다

**사실 그대로**: **Claude가 3/5로 셋 중 가장 높다.** Astra·Gemini는
"안정적으로 correct"가 아니라 **"안정적으로 틀림/회피"**다:

- **Gemini**: 두 fixture 모두 **5/5 YES**(confidently "coherent/
  plausible") — rep마다 흔들리지 않지만, 매번 **확신에 찬 오답**이다.
  이건 본부가 잠근 "Astra·Gemini가 안정" 가지의 문면과는 맞지만,
  그 "안정"이 **정답 쪽 안정이 아니라 오답 쪽 안정**이라 "Claude만의
  한계"라고 뒤집어 말할 근거가 안 된다 — 오히려 반대다.
- **Astra**: 완전히 무시하진 않는다(frame4/frame7을 언급은 함)
  — 그러나 5회 내내 **"검증 불가/불충분"이라는 회피적 hedge**만
  반복하고, confirmed factual observation(GT 문장)을 단 한 번도
  확정적으로 진술하지 않는다. Claude의 UNCERTAIN이 최소 "이 defect가
  있을 수도"라는 방향성은 담는 것과 달리, Astra의 hedge는 결함 쪽으로도
  정상 쪽으로도 안 기운다 — 회피에 더 가깝다.
- **Claude만 "흔들린다"(rep마다 NO/UNCERTAIN 오간다)** — 나머지 둘은
  각자의 방식으로 **한결같이 GT를 못 맞춘다.** 본부가 잠근 두 번째
  가지("세 모델 모두 흔들림")도 문자 그대로는 안 맞는다 — Astra·Gemini는
  "흔들리는" 게 아니라 "고정적으로 못 본다".

**있는 그대로 결론**: 이 데이터는 "Claude만의 한계"도, "세 모델 다
흔들린다"도 아니다. **셋 중 가장 안정성이 떨어지는 Claude가 그래도
가장 자주(3/5) GT에 근접한 관찰을 만들어내고, 더 비싸거나(Astra,
콜당 최대 $0.32) 더 싼(Gemini, 콜당 $0.013) 다른 두 최상위
multimodal judge는 같은 입력·같은 CHECK에서 이 두 confirmed
factual observation을 사실상 전혀 재현하지 못한다(0/5, 0/5).**
이건 "Claude를 다른 모델로 바꾸면 나아진다"는 가설을 **기각**하고,
"OXXOVO Judge의 Observation 구조 자체를 재설계해야 한다"는 신호
쪽으로 더 강하게 기운다 — 다만 그 이유가 "셋 다 흔들려서"가 아니라
**"셋 다, 각자 다른 방식으로, 이 정밀도의 confirmed defect를 개별
프레임 입력만으로는 안정적으로 못 잡아서"**라는 점은 본부가 사전에
잠근 두 갈래보다 더 구체적이다. 이 구체적 차이를 뭉개지 않고 그대로
보고한다.

### Master History — 이어서(안 지움)

15. **Cross-Model(Claude vs Astra vs Gemini, A04+A09, 20콜 $3.3037)
    실행 완료 — Claude(3/5, 3/5)가 Astra(0/5, 0/5)·Gemini(0/5, 0/5)보다
    오히려 GT에 더 근접. "Claude만의 한계" 가설 기각, "Observation
    구조 재설계 필요" 신호 강화(단 원인은 "셋 다 흔들림"이 아니라
    "셋 다 각자 다른 방식으로 못 잡음")**(09-16).

## STOP

Cross-Model 실행·측정·기록 완료. **다음 단계로 넘어가지 않는다**(본부
지시). Stage 1b FAIL 유지, Gate2 Observation Repeatability=NOT PASSED
유지. Contact Sheet production 적용 = HOLD(일반효과 미확인으로 종결).
STEP3/4·CV·prompt·code 전부 변경 없음. 결과 후 Acceptance 기준
변경 없음. 다음 실행은 본부 확인 후 결정.
