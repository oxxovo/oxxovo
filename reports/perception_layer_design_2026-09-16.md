# Perception Layer 설계안 (2026-09-16, 설계만 — API 호출 0)

본부 지시로 방향 전환: "더 좋은 모델을 고르면 해결된다"는 기각됐고
(Claude 3/5 vs Astra/Gemini 0/5, `observation_accuracy_stage1b_forensic_2026-09-16.md`
ADDENDUM 9), Contact Sheet 일반효과도 미확인으로 종결됐다. 그러나
결론은 "AI 심사가 불가능하다"가 아니라 **"지금까지 심사관 하나에게
한 번에 너무 많은 역할을 맡겼다"**는 것 — 이 문서는 그 역할을 나누는
설계안이다. **구현·API 호출 없음. Gate1 PASS·Gate2 NOT PASSED 그대로
유지.**

## 왜 지금 이 설계인가 — Gate 2 실패 데이터가 근거

이번 세션에서 확정된 사실 3개가 이 설계의 전제다:

1. **CHECK 종류마다 난이도가 완전히 다르다.** identity(Z03)·
   transition(aurelie)·text(novya)·degradation(demo_consistency)는
   production 개별 프레임만으로 **Claude 5/5 완벽**이었다. anatomy
   (A04)·mechanism(A09)만 **3/5**로 불안정했다 — 같은 파이프라인,
   같은 입력 형식인데 CHECK 종류에 따라 결과가 극단적으로 갈린다.
2. **모델을 바꿔도 해결이 안 된다.** A04/A09에서 Astra=0/5, Gemini=0/5
   — 셋 중 가장 불안정한 Claude가 오히려 GT에 가장 근접했다.
3. **Contact Sheet(입력 표현 하나만 바꾸는 개입)는 anatomy에서는
   방향성 신호가 있었지만 mechanism에서는 전혀 안 통했다** — 하나의
   범용 해법이 모든 CHECK 종류에 먹히지 않는다는 직접 증거.

이 세 사실을 합치면: 문제는 "관찰자가 부족하다"가 아니라 **"관찰
대상마다 필요한 증거·검증 방식이 다른데, 지금은 그걸 구분하지 않고
한 번의 호출·한 세트의 입력·한 명의 심사관에게 전부 떠넘기고
있다"**는 것이다.

## 현재 구조 vs 새 구조

**현재**: `Frames → AI가 알아서 관찰 → 결함 해석 → 평가`(1콜, 1모델,
1세트 프레임, observation과 scoring이 한 프롬프트 안에 섞여 있다 —
`src/scorer.ts`의 `buildScoringPrompt`가 Step1~6을 한 호출로 처리).

**새 구조 — 4단계로 분리**:

```
Evidence Acquisition → Factual Observation → Cross-Verification → Evaluation
   (증거를 무엇으로 모을까)   (그 증거로 뭘 봤나)      (그 관찰을 믿을 수 있나)   (그래서 점수는)
```

핵심은 **1단계(무엇을 보여줄까)와 3단계(그 답을 믿을까)를 2단계(보고
답하기)와 분리**하는 것 — 지금은 이 셋이 한 프롬프트·한 호출에
뭉쳐 있어서, "증거가 부족했다"와 "모델이 못 봤다"와 "답이 우연히
틀렸다"를 구분할 방법이 없었다(이번 세션 내내 이 셋을 사람이 수작업
포렌식으로 갈라내야 했다 — 그 작업 자체가 이 설계의 필요성을
증명한다).

## ① CHECK 카테고리별 — 필요한 증거 정의

7개 CHECK를 이번 세션 실측 결과로 재분류한다(추측 아니고 실측
기반):

| 카테고리 | 대표 CHECK | 이번 실측 결과(production 프레임만) | 필요한 증거의 본질 |
|---|---|---|---|
| **identity** | subjectIdentityCount | Z03 **5/5**(Claude) | 프레임 간 **거시적** 외형 비교(얼굴형·헤어·의상) — 낱장 정지 프레임으로 충분, 세밀한 픽셀 단위 비교 불필요 |
| **text** | brandTextIdentityStability | novya **5/5** | 텍스트가 **읽힐 만큼 큰 프레임**이 있으면 충분 — 문자 판독은 LLM vision이 이미 잘함(단, novya처럼 스타일라이즈 폰트의 W/VV 같은 진짜 글리프 모호성은 증거를 더 줘도 안 풀림, §④ 참고) |
| **transition** | transitionIntegrity | aurelie **5/5** | 전환 전후 프레임 **쌍**(cut 직전/직후)이 있으면 충분 — 이미 production 샘플링이 이걸 우연히 만족 |
| **degradation** | progressiveDegradation | demo_consistency **5/5** | **시작 프레임과 끝 프레임의 명시적 대조** — production 샘플링이 이미 처음/끝을 포함하므로 충분 |
| **action** | claimedActionEvidence | demo_anne **정답=UNCERTAIN**(구조적 한계, 결함 아님) | **연속 동작**(보행 사이클) 증거 — 정지 프레임 몇 장으로는 원리적으로 증명 불가. "모른다"가 정답인 카테고리를 억지로 YES/NO로 밀면 그 자체가 confabulation(이번 세션 confabulation 통제축에서 실증) |
| **anatomy** | handLimbAnatomy | A04 Claude**3/5**, Astra/Gemini **0/5** | **국소 디테일**(손가락 개수·관절) — 넓은 화면 속 작은 영역이라 저해상도 개별 프레임에서 놓치기 쉬움. Contact Sheet가 Claude에서만 방향성 개선(3/5→4~5/5) |
| **mechanism** | objectMechanismCoherence | A09 Claude**3/5**, Astra/Gemini **0/5**; A12 사람도 애매(UNCERTIFIED) | **두 물체(또는 물체-환경) 사이의 물리적 연결 여부** — 때로는(A09) 원본 그대로 사람 눈에 명확한데 모델이 확정을 못 내리고, 때로는(A12) 사람 눈에도 진짜 애매함(피사계심도) — 둘을 구분하는 절차가 필요 |

**패턴**: identity/text/transition/degradation은 "**프레임 간 비교**"
문제라 지금 방식(넓은 화면, 낮은 밀도)으로 이미 충분하다. anatomy/
mechanism은 "**한 프레임 안의 국소 디테일 판정**" 문제라 지금 방식이
구조적으로 불리하다. action은 아예 다른 종류(연속성 증거)라 정지
프레임 자체가 잘못된 증거 형식이다.

## ② 증거 획득 방법 — 어느 단계에서 무엇을 쓰나 (CV 일괄 배선 금지)

본부 지시대로 **CV를 하나 골라 바로 붙이지 않는다** — 손/기계/
identity/텍스트/motion은 서로 다른 시각 문제라 하나의 기술로 안
풀릴 가능성이 높다. 아래는 "이 증거 형식이 이 카테고리·이 단계에서
후보가 될 수 있다"는 매핑이지 지금 확정하는 채택안이 아니다.

| 증거 형식 | 적합한 카테고리 | 어느 단계 | 이번 세션 근거 |
|---|---|---|---|
| **기존 production frames**(현행) | identity·text·transition·degradation | Evidence Acquisition(기본값) | 4개 카테고리 5/5 — 바꿀 이유 없음 |
| **Dense frames**(현재보다 촘촘한 간격) | mechanism(부분적 가능성), anatomy | Evidence Acquisition | 미검증 — A09의 frame_07 자체는 원본에서 이미 명확했으니 dense가 mechanism에 얼마나 더할지는 불확실. anatomy는 저밀도가 원인 중 하나로 의심되나 이번엔 "밀도"가 아니라 "요약뷰 추가"(Contact Sheet)만 시험했다 — dense frame은 아직 미시험 |
| **Contact Sheet**(요약 오버뷰 1장 추가) | anatomy(방향성 신호 있음) | Evidence Acquisition | A04에서만 Claude 3/5→4~5/5. A09(mechanism)에서는 3/5→3/5, 무효+오탐 1건. **카테고리 의존적**임이 실측으로 확인 — anatomy 외 일반화 금지 |
| **Crop(국소 확대)** | anatomy(사람 검증엔 효과적) | Evidence Acquisition **또는** Cross-Verification | A04_morph frame4는 사람이 crop으로 명확히 CONFIRMED. 단 **AI에게 자동으로 crop을 어디에 걸지 지시하는 문제**가 남는다(사람은 "어디를 봐야 할지" 이미 알고 크롭했다) — Evidence Acquisition 단계에서 자동 crop을 걸려면 "의심 영역 탐지"가 먼저 있어야 하므로, 오히려 **Cross-Verification 단계**(1차 관찰에서 지목된 프레임/영역만 재확대해서 재확인)에 놓는 게 더 자연스럽다 |
| **Crop(국소 확대), mechanism** | mechanism | (검증됨: 효과 제한적) | A12_mech는 사람이 최대 배율로 크롭해도 "다른 기어 이빨인지 같은 기어 rim인지" 못 갈랐다 — **crop이 만능이 아니라는 반증 사례**. 얕은 피사계심도·다중 객체 중첩 상황에서는 해상도를 올려도 실제 정보가 안 늘어난다 |
| **Temporal evidence**(광학 흐름, 또는 연속 구간 클립) | action | Evidence Acquisition | claimedActionEvidence는 정의상 정지 프레임으로 증명 불가능한 카테고리 — 유일하게 "다른 종류의 증거"(연속 동작)가 필요한 카테고리. 단, 이게 없다고 UNCERTAIN을 억지로 없앨 필요는 없다(§④) |
| **Specialized vision/CV** | 카테고리별로 따로 검토(§③) | 미정 — 설계만 | 아직 실측 없음. 손가락 keypoint 추정, OCR, 얼굴 임베딩, optical flow는 서로 완전히 다른 기술이라 **하나로 통합 불가** — 카테고리별 pilot이 각각 필요(이번 라운드에서 실행 안 함) |

## ③ CV를 바로 안 붙이는 이유 — 카테고리별로 따로 검토해야 하는 근거

- **anatomy**: 손가락 개수/관절 판정에 맞는 기술은 hand-pose
  keypoint 추정(MediaPipe Hands류) — 그러나 A04의 실제 결함은
  "손이 아예 없고 flat block으로 대체됨"이라 **keypoint 추정기
  자체가 "손을 못 찾음(0 keypoints)"으로 답할 수도 있어, 그 자체가
  이미 결함 신호**가 될 수 있다(가설, 미검증).
- **mechanism**: A12(기어)처럼 "두 물체가 정말 다른 물체인지 같은
  물체의 다른 면인지"는 keypoint나 OCR 같은 기존 CV로 안 풀린다 —
  깊이 추정(depth estimation)이나 인스턴스 분할(instance
  segmentation) 계열이 후보지만, 이번 세션에서 시도도 검증도
  안 했다.
- **text**: OCR이 명백한 후보지만, novya의 실제 문제는 "읽었는데
  다르게 읽음(NOWYA vs NOVYA vs NOVVYA)"이라 — OCR도 같은 스타일
  폰트에서 같은 모호성을 가질 수 있다(미검증, 낙관 금지).
- **identity**: 얼굴 임베딩(face embedding) 유사도가 후보지만,
  Z03은 이미 5/5라 **지금 우선순위가 아니다** — 이미 잘 되는 걸
  CV로 "보강"하는 건 이번 라운드 범위 밖.
- **motion/action**: optical flow가 후보지만, demo_anne의 정답
  자체가 "다리가 프레임 밖이라 판단 불가"라 — optical flow를 걸어도
  애초에 다리가 안 보이면 flow도 없다. 이 카테고리는 CV로 못
  구할 데이터를 "본 것처럼" 만들면 안 된다(confabulation 위험,
  §④).

**결론**: CV는 카테고리마다 후보 기술이 다르고, 각 후보가 실제로
도움이 될지는 **전혀 검증되지 않았다.** 이번 문서는 후보만 나열하고
다음 라운드에서 카테고리 하나씩 최소 pilot으로 검증하는 순서를
권고한다 — 한 번에 다 붙이지 않는다.

## ④ Cross-Verification 단계 — 이번 세션에서 이미 하던 걸 공식화

이번 세션 내내 실제로 한 일: N=5 반복 → 답이 갈리면 사람이 원본을
직접 재확인 → 사람도 애매하면(A12) UNCERTIFIED로 강등, 사람도
명확하면(A04) CONFIRMED로 격상. **이게 곧 Cross-Verification
단계다** — 지금은 사람이 수작업으로 했지만, 설계상 이 단계를
파이프라인 안에 공식적으로 넣으면:

1. Factual Observation을 N회(또는 여러 judge로) 반복.
2. 답이 갈리면(예: NO/UNCERTAIN 혼재) **바로 다수결 평균을 내지
   않는다** — A12 사례가 정확히 왜 안 되는지 보여준다: "애매한
   서브클레임"에 다수결을 걸면 사람도 못 가르는 걸 숫자로 억지로
   가르게 된다.
3. 갈리는 지점만 **추가 증거**(§②의 crop/dense frame 등)로 재검증.
4. 추가 증거로도 안 갈리면 **UNCERTIFIED**로 명시 강등 — 이건
   실패가 아니라 "이 CHECK는 이 클립에서 결정 불가"라는 정직한
   출력이다(demo_anne의 UNCERTAIN이 정답이었던 것과 같은 원리를
   시스템 레벨로 승격).
5. **평균 금지 원칙**은 identity/text/transition/degradation처럼
   이미 5/5인 카테고리에는 적용할 필요가 없다 — Cross-Verification
   비용은 **불안정 카테고리(anatomy·mechanism·action)에만
   선택적으로** 건다(전부에 걸면 비용만 3~5배로 뛴다).

## 기존 scoring architecture — 유지 vs 변경

**유지 후보** (⚠️본부 수정 2026-09-18: 확정 아님 — Gate 2가 아직
NOT PASSED이고, 어떤 factual observations를 Evaluation에 넘길지도
미정이다. 아래는 "지금까지 문제 삼지 않은 부분"이라는 뜻일 뿐,
Gate 2 통과 후에만 확정으로 승격한다):
- Evaluation(점수화) 단계의 3사 평균(Intent/Execution/Originality) —
  **주관적 품질 판단**을 여러 관점으로 평균 내는 건 합리적이다.
  이번 세션이 문제 삼은 건 **사실 판정(observation)**을 평균 내는
  것이지 품질 판단을 평균 내는 게 아니다 — 이 둘을 섞으면 안 된다.
- Claude를 현재 1차 관찰자로 유지 — 실측상 셋 중 유일하게 신호가
  있다(3/5). 교체가 아니라 **보강**이 이번 방향.
- temperature=0·thinking disabled 결정론 설정 — 재현성 실측으로
  이미 확정된 값, 안 건드림.
- Integrity/Compliance가 Quality와 별도 축이라는 원칙
  ([[project_identity_continuity_quality_vs_compliance_2026-09-12]]) —
  Perception Layer는 이 원칙을 **모든 factual claim**으로 일반화한
  것뿐, 새 원칙이 아니다.

**변경(설계만, 이번엔 구현 안 함)**:
- 현재 `buildScoringPrompt`는 Step1(관찰)~Step6(점수화)를 **한
  프롬프트, 한 호출**로 묶는다 — Perception Layer는 관찰(Evidence
  Acquisition+Factual Observation+Cross-Verification)과 평가
  (Evaluation)를 **별도 단계**로 분리한다. 관찰이 먼저 확정되고,
  그 확정된 관찰만 Evaluation 호출에 들어간다.
- 3사 합의(consensus) 로직이 지금은 **점수만** 평균 낸다 —
  Perception Layer 도입 후엔 factual sub-claim(예: "손이 있다/없다"
  같은 이진 사실)에 대해 3사가 갈리면 **평균이 아니라 disputed
  표시**로 넘겨야 한다(⑤ Cross-Verification 원칙과 동일선상). 지금
  구조는 이걸 표현할 필드가 없다 — 스키마 확장이 필요(설계만, 이번
  라운드 미구현).
- CHECK 카테고리별로 다른 증거 형식(§②)을 붙이려면 지금의 "고정
  10~14장 균등 샘플링"이 카테고리 무관 단일 정책이라는 걸 바꿔야
  한다 — 이 자체가 `extractor.ts`(production 프레임 추출기) 레벨의
  변경 여지다(설계만, 이번 미구현).

## 비용 추정 (방향성만, 예산 결정 안 함)

절대 금액이 아니라 **상대 배율**로만 잡는다 — 범위가 아직 안
정해졌다:

- **Cross-Verification(N회 반복)**: 이미 실측된 단가 기준(콜당
  Claude $0.13~0.28, 프레임 수에 비례) — N=5 반복이면 단일 호출
  대비 **~5배**. 단 이걸 **불안정 카테고리에만** 걸면(전체 7개 중
  2~3개), 전체 관찰 비용 증가는 5배가 아니라 **~2배 안쪽**으로
  추정된다(카테고리 비중에 따라 다름, 실측 아님).
- **Dense frame / 추가 crop**: 이미지 1~3장 추가할 때마다 콜당
  비용이 **+5~15%** 증가한다(Contact Sheet 실측: 이미지 1장 추가에
  +4~7%, 프레임 수가 많을수록 증가폭 작아짐 — 비율이라 절대값은
  fixture별로 다름).
- **Specialized CV(§③)**: 대부분 오픈소스/로컬 추론이라 API 비용은
  거의 $0에 가깝지만, **구현·검증 비용**(엔지니어링 시간)이 이번
  방향 전환의 진짜 비용이다 — 이건 달러가 아니라 **다음 세션들의
  작업량**으로 잡아야 한다(추정 범위 이번엔 안 냄).
- **결론**: 이번 방향의 진짜 비용은 API 콜 수보다 **"카테고리별
  pilot을 몇 개나, 어떤 순서로 검증할 것인가"**에 달려 있다 — 그건
  본부 우선순위 결정 사항이라 이 문서에서 액수를 못 박지 않는다.

## 다음 단계 후보(제안만, 착수 안 함)

1. anatomy 카테고리 하나에 대해 dense frame(§②) pilot — Contact
   Sheet가 유일하게 통했던 카테고리라 다음 실험 후보 1순위.
2. mechanism 카테고리는 "A09처럼 원본이 이미 명확한 경우"와
   "A12처럼 사람도 애매한 경우"를 가르는 **사전 분류 단계**가
   Cross-Verification보다 먼저 필요할 수 있다는 가설만 기록.
3. action 카테고리는 temporal evidence 도입 여부를 결정하기 전에,
   "UNCERTAIN을 정답으로 받아들이는 게 이미 충분한가"부터 본부
   판단 필요.

## STOP

설계 문서 작성 완료. 구현·API 호출 0. Gate1 PASS·Gate2 NOT PASSED
그대로 유지. STEP3/4·CV·prompt·code 전부 변경 없음. 다음 실행은
본부 확인 후 결정.

관련: [[project_jisoo_resume_2026-09-16]] ·
`reports/observation_accuracy_stage1b_forensic_2026-09-16.md` ·
[[project_identity_continuity_quality_vs_compliance_2026-09-12]] ·
[[feedback_absent_is_not_zero]] · [[feedback_combination_bug_needs_combination_test]]
