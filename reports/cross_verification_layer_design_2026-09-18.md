# Cross-Verification Layer 설계안 (2026-09-18, rev.3 — 최종, 설계만 — API 호출 0)

본부 지시: Dense pilot 종료·잠정결론 기록 + 다음 단계는
**Cross-Verification Layer 설계**(API 호출 아님, 3사 단순 다수결
아님). 이 문서는 그 설계안이다. **구현·API 호출 0.**

**rev.2 변경 사유**: 최초안(§⑤)의 "N=5 전원일치=즉시 CONFIRMED"
규칙을 본부가 기각 — Gemini가 A04·A09 둘 다 **YES×5(5/5 완전
일치)로, 매번 확신에 차서 틀렸다**(`observation_accuracy_stage1b_forensic_2026-09-16.md`
raw data, 0/5 accuracy). **반복성(consistency)은 정확성(accuracy)의
증거가 아니다** — 같은 AI가 다섯 번 같은 말을 한다고 그게 사실이
되지 않는다.

**rev.3 변경 사유(본부 "정리하라", 같은 날 최종) — Cross-Verification
연구는 여기서 STOP**: 지수가 독립 검증 후보를 전수 판정한 결과
"benchmark 축적" 하나만 남았는데, 본부가 이걸 더 다듬어 확정: (a)
**"benchmark된 카테고리 + YES/NO = CONFIRMED" 자동승격 규칙
자체를 미채택** — 카테고리 단위 검증 이력은 **개별 제출물의 진실을
보장하지 않는다**(카테고리가 대체로 맞았다고 이번 이 한 건도
맞다는 뜻은 아니다). (b) 상태 명칭을 CONFIRMED/DISPUTED/UNCERTAIN
3종에서 **SUPPORTED/UNCERTAIN/UNQUALIFIED/DISPUTED 4종**으로
재정의 — Evaluation에는 SUPPORTED만 전달. (c) identity·text·
transition·degradation도 **지금 production-qualified로 확정하지
않는다** — 이번 세션 데이터는 전부 **pilot evidence**일 뿐, 실제
승격은 Gate 3의 human-GT 대조 규모에서만 일어난다. 아래 §⑤~⑦은
이 세 확정을 반영해 재작성.

## ① Dense 잠정 결론 — 확정 기록 (본부 문구 그대로)

> 현재 검증 범위에서 Dense temporal evidence는 production sparse
> frames보다 confirmed fine-detail observation의 반복성을
> 개선했고, 기존에 안정적이던 관찰과 uncertainty control에서
> 측정된 regression을 만들지 않았다.

근거 = 개선 2 + 비회귀 4 + 불확실성 통제 1 = **7 fixture**:

| 구분 | fixture | 결과 |
|---|---|---|
| 개선 | A04_morph(anatomy) | production 3/5 → Dense **5/5** |
| 개선 | A09_race(mechanism) | production(재사용) 3/5 → Dense **5/5**(certainty는 UNCERTAIN×5 그대로, 별도 기록 유지) |
| 비회귀 | Z03_studio(identity) | 5/5 → Dense **5/5** |
| 비회귀 | demo_consistency(degradation) | 5/5 → Dense **5/5** |
| 비회귀 | aurelie(transition) | 5/5 → Dense **5/5** |
| 비회귀 | novya(text identity) | 5/5 → Dense **5/5**(단 §④ 참고, 전사 검증까지 확대 안 함) |
| 불확실성 통제 | demo_anne(confabulation) | UNCERTAIN×5 유지 + 신규 confabulation 0/5 |

### ② 이건 production 확정이 아니다

7 fixture 수준의 pilot 결론이다. **Gate 3의 100~150편 규모 검증에서
다시 확인해야 한다** — 표본 7개로 관찰한 방향성이 수백 편 규모의
CHECK 종류·클립 다양성에서도 유지되는지는 별도 질문이다. 이 결론이
나왔다고 **소규모 Dense 추가 실험을 더 하지 않는다** — 그건
표본만 늘리는 반복이지 새 정보가 아니다. 다음으로 늘려야 할 건
표본 수(→Gate 3)이지 pilot 개수가 아니다.

### ③ ROI/CV는 기본 경로에 넣지 않는다

A04에서 Original+ROI가 5/5였지만 **Dense 단독도 5/5**였고,
ROI-only(원본 제거)는 오히려 2/5(+UNCERTAIN 3)로 불안정했다 — crop이
정보를 "대체"하면 위험하고 "추가"할 때만 안전했다는 게 실측
결론이었다. 여기서 최종 정리: **더 단순한 쪽(Dense)이 같은 효과를
CV 의존성 없이 냈다면, 기본 경로는 Dense를 우선한다.** MediaPipe 같은
CV는 폐기가 아니라, **Dense로 안 풀리는 미래 사례가 나왔을 때만
꺼내는 보조 경로**로 HOLD 유지.

### ④ novya — 맞은 것과 안 맞은 것을 분리해서 기록

핵심 CHECK("이 상품명/워드마크의 정체성이 프레임 간에 안정적인가")는
Dense 5/5 전부 정확히 "불안정하다"고 맞혔다. 그러나 실제 글자
전사(transcription)는 GT 문구("NOWYA→NOVYA")와 다르게 5건 전부
"NOVVYA→NOVYA"로 읽었다(설계서·직전 결과 리포트에 이미 기록됨).
**이 pilot이 검증한 건 "정체성 불안정 탐지" 능력이지 "정확한 OCR
수준 전사" 능력이 아니다** — 후자로 결론을 확대하지 않는다. 이
구분은 Cross-Verification 설계(아래)에서도 그대로 쓰인다: "무엇을
CONFIRMED로 볼 것인가"를 정할 때, **CHECK가 실제로 요구하는 사실
단위**(안정성 여부)와 **그 사실을 설명하는 부수적 디테일**(정확한
철자)을 같은 무게로 취급하면 안 된다.

## ⑤ 5단계 구조 — Reliability Check 신설 (본부 수정②)

```
Evidence Acquisition → Factual Observation → Reliability Check → Cross-Verification → Evaluation
   (증거를 무엇으로 모을까)   (그 증거로 뭘 봤나)      (그 답을 몇 번이나 반복했나)   (그 답이 진짜 맞나)      (그래서 점수는)
```

기존 Perception Layer 4단계(09-16)에 **Reliability Check**를 새로
끼워 넣는다 — Factual Observation과 Cross-Verification 사이. 이유는
아래 §반박(왜 최초안이 틀렸는가)에 그대로 있다: **반복성 측정과
정확성 판정을 같은 단계에서 같은 라벨로 뭉개면 안 된다.**

### 왜 최초안("전원일치=즉시 CONFIRMED")이 틀렸는가 — 반증 실측

Gemini는 A04·A09 **둘 다 YES×5(5/5 완전 일치)**였고, 그 답은
**둘 다 0/5로 틀렸다**(`observation_accuracy_stage1b_forensic_2026-09-16.md`,
"5회 전부 hands...standard anatomy — 결함을 아예 안 봄, 매번 확신에
찬 오답"). Claude가 production frame에서 3/5로 갈렸던 바로 그
케이스에서, Gemini는 **더 일관됐지만 더 틀렸다.** 즉 "N=5가 다
같은 답을 냈다"는 사실 자체는 **그 답이 맞다는 증거가 전혀 아니다**
— 최초안은 이 둘을 같은 신호로 취급하는 오류가 있었다.

### Reliability Check — 하는 일과 안 하는 일

Factual Observation의 N=5 certainty 분포를 받아 **오직 반복성만**
라벨링한다:

- **STABLE**: N=5가 같은 값(YES/NO/UNCERTAIN/NOT_VISIBLE 중 하나)에
  수렴. ⛔**CONFIRMED로 승격하지 않는다** — STABLE은 "이 관찰자가
  이 질문에 안정적으로 같은 답을 낸다"는 뜻일 뿐, "그 답이 사실"이란
  뜻이 아니다(Gemini 반증 그대로).
- **UNSTABLE**: N=5가 갈림(예: 기존 Claude A04/A09 production 3/5).
- 이 단계는 **accuracy에 대해 아무 판단도 내리지 않는다** — 순수
  repeatability 계측 전용 단계다.

### Cross-Verification — 상태 4종, SUPPORTED는 자동승격 없음 (rev.3)

Reliability Check의 출력(STABLE/UNSTABLE + 그때의 값)을 받아서,
**정확성 판정**을 시도한다. rev.2는 여기서 "benchmark된 카테고리 +
STABLE=YES/NO → CONFIRMED 자동승격"을 제안했으나, 본부가 **미채택
확정** — 이유: **카테고리 단위 검증 이력은 개별 제출물의 진실을
보장하지 않는다.** identity 카테고리가 과거 5개 클립에서 잘
맞았다는 사실이, 지금 이 특정 제출물의 이 관찰이 맞다는 증거가
되지는 않는다(카테고리 전체 정확도와 개별 인스턴스 정확도는 다른
질문이다). 이 구분을 안 하면 "카테고리가 좋다"는 통계를 "이 건도
맞다"는 확정으로 슬쩍 바꿔치는 것과 같다.

**상태는 4종, rev.2의 3종(CONFIRMED/DISPUTED/UNCERTAIN)을 대체**:

| 상태 | 뜻 | 언제 붙나 |
|---|---|---|
| **SUPPORTED** | 이 관찰이 맞다고 볼 근거가 있다 | 개별 제출물 수준에서 실제로 검증 가능한 근거(독립 증거와 일치 등)가 있을 때만. **"카테고리가 과거에 좋았다"만으로는 안 붙는다.** 무엇이 이 조건을 실제로 채울 수 있는지는 여전히 미해결(§다음 질문) — 그래서 **지금 이 설계로는 SUPPORTED가 거의 안 나올 것으로 예상된다.** 이건 버그가 아니라 정직한 결과다. |
| **UNQUALIFIED** | STABLE(반복해서 같은 YES/NO)하지만 SUPPORTED로 올릴 근거가 없다 | rev.2의 "STABLE-미승격"과 같은 뜻, 이름만 명확하게 바꿈. **카테고리가 아직 production-qualified가 아니라서**(§⑤ 아래) 또는 독립 근거가 없어서. 버리지 않고 감사(audit) 큐에 쌓는다(§②의 본부 질문에 대한 지수 의견 반영). |
| **UNCERTAIN** | 모델 스스로 certainty=UNCERTAIN/NOT_VISIBLE | 증거 자체가 부족한 경우(예: demo_anne). |
| **DISPUTED** | 반복·재확인해도 답이 갈린다 | UNSTABLE이 지속되는 경우. 사람이 대신 확정하지 않는다(§⑦). |

**Evaluation에는 SUPPORTED만 전달된다.** UNQUALIFIED·UNCERTAIN·
DISPUTED 셋 다 점수 근거에서 제외되지만, **제외 사유가 다르므로
셋을 구분해서 기록**한다 — UNQUALIFIED는 "카테고리가 아직 안
익었다"(추후 승격 가능), UNCERTAIN은 "증거가 원래 부족하다"(항상
그럴 수 있다), DISPUTED는 "지금 답이 갈린다"(재검토 신호) — 운영상
할 일이 서로 다르다.

## ⑥ identity·text·transition·degradation — 지금 production-qualified 아님 (rev.3, 본부 확정)

이번 세션에서 Z03(identity)·novya(text)·aurelie(transition)·
demo_consistency(degradation) 4개가 production frame만으로도
5/5·Dense에서도 5/5였다는 건 사실이다. 그러나 이건 **fixture
1개씩, 총 4개짜리 pilot 근거일 뿐**이다 — 지금 이 데이터로 "이
4개 카테고리는 production에서 믿어도 된다"고 **확정하지 않는다.**
승격은 **Gate 3의 human-GT 대조 규모(100~150편)**에서만 일어난다.
지금 조회 테이블이 있다면 상태는: **7개 CHECK 카테고리 전부
미승격**(anatomy·mechanism·action뿐 아니라 identity·text·
transition·degradation도 포함) — 그래서 §⑤의 SUPPORTED 조건이
당장은 거의 안 열린다는 게 이 설계의 정직한 현재 상태다.

## ⑦ Accuracy vs Repeatability — 항상 분리 표기 (본부 수정③, 유지)

모든 관찰 결과 레코드는 **두 개의 독립된 필드**를 갖는다 — 하나로
합치지 않는다:

- `repeatability`: STABLE / UNSTABLE (Reliability Check 산출, 반복
  횟수만으로 계산, 정확성 무관 — production에서는 N=1이 기본이라
  이 필드는 주로 **오프라인 캘리브레이션/감사 표본**에서만 채워짐,
  §다음 질문·인계서 참고).
- `accuracyStatus`: **SUPPORTED / UNQUALIFIED / UNCERTAIN /
  DISPUTED** (Cross-Verification 산출).

Gemini 사례가 정확히 이 분리가 왜 필요한지 보여준다 —
`repeatability=STABLE`이면서 `accuracyStatus`는 완전히 틀린 경우가
실제로 존재한다. 하나의 라벨로 뭉치면 이 사례가 시스템에 안
보이게 된다.

## ⑧ Human fallback — 실제 대회 참가작에는 미채택 (본부 수정⑤·⑥, 유지)

**미채택**: AI가 끝까지 accuracyStatus를 SUPPORTED로 못 만들면
(DISPUTED 상태 지속), **참가작의 사실판정을 사람이 대신 확정하지
않는다.** 사람이 개별 참가작의 사실을 판정하기 시작하면 Triple-AI
심사 구조 자체가 흐려진다(이 프로젝트의 근본 설계 원칙 —
[[project_scoring_integrity_rules]]). 그 대신: **DISPUTED로
남기고, ⑨ 원칙에 따라 점수 근거에서 제외**하는 쪽이 더 깨끗하다.

**단, Human verification 자체를 없애는 게 아니다** — 계속 쓰는
용도는 명확히 분리된 세 곳뿐:
1. **시스템 장애 진단**(파이프라인이 깨졌는지 확인).
2. **GT 연구·구축**(이번 세션 A04/A09처럼, 벤치마크를 만드는
   과정 — 참가작 개별 채점이 아니라 시스템을 검증하는 데이터를
   만드는 것 — Gate 3의 human-GT 대조도 이 범주다).
3. **qualification 단계**(참가작 채점과 별개 트랙).

이 셋과 "참가작 사실판정 대행"은 성격이 다르다 — 앞의 셋은 시스템을
검증/구축하는 것이고, 뒤는 심사 자체를 사람이 떠맡는 것이다.

## ⑨ UNCERTAIN·UNQUALIFIED·DISPUTED = 감점·가점 근거에서 제외 (본부 수정④, 유지)

> 불확실한 사실을 억지로 확정하지 않는 것도 좋은 심사관의
> 능력이다. 모든 것을 YES/NO로 만들 필요는 없다. 증거가 부족하면
> UNCERTAIN으로 남기고, 그런 사실은 감점 근거로 쓰지 않는다. 그
> 구조가 오히려 공정하다.

이건 문서에만 적는 원칙이 아니라 **Evaluation 계층 입력 계약의
하드 규칙**이다: `accuracyStatus`가 SUPPORTED가 아닌 sub-claim(즉
UNQUALIFIED·UNCERTAIN·DISPUTED 전부)은 Evaluation 단계에 **점수
근거로 전달되지 않는다**(널값 취급, [[feedback_absent_is_not_zero]]
원칙과 동일 — 미측정을 기본값/최하점으로 채우지 않는다). 단
UNQUALIFIED는 버리지 않고 audit 큐에 쌓는다(§⑤) — 카테고리를
익히는 원재료로 쓰기 위해서다. 이 규칙은 스키마 설계 단계부터
강제해야 한다(설계만, 이번 라운드 구현 안 함) — 그리고 **내일
code audit이 바로 이 규칙을 production이 지금 지키는지 확인하는
작업**이다(인계서 참고).

## ★★"독립 검증" 질문 — 전수 판정 완료, 열어둔 채로 연구 STOP

**"Cross-Verification에서 무엇을 '독립 검증'으로 인정할 것인가?"**
— 지수가 후보를 한 줄씩 전수 판정한 결과(아래), 본부가 이 질문을
**이 이상 연구로 더 파지 않기로 확정**(상태 §참고). 판정 결과:

| 후보 | 판정 |
|---|---|
| 같은 모델(Claude)에 다른 증거 형식(Dense 등)으로 재관찰 | **독립 아님** — 같은 가중치·같은 판단 주체. 더 많은 증거를 같은 판단자에게 준 것일 뿐 |
| 디컴포지션 재질의(좁혀 묻기) | **독립 아님** — 위와 동일 이유 |
| 다른 벤더 모델(Astra/Gemini) — 투표든 사실대조든 | 시스템으로는 독립이 맞지만, 검증이 필요한 카테고리(anatomy·mechanism)에서 이미 0/5로 눈이 멀었다는 게 실측됨 — **쓸모가 없다** |
| 사람 재확인(참가작 실전) | 본부 미채택 확정(§⑧) |
| CV 도구 | HOLD |
| **benchmark 축적**(카테고리별 human-GT 대조 이력) | 유일하게 살아남은 후보 — 그러나 rev.3에서 본부가 "카테고리 검증=개별 진실 보장 아님"으로 추가 제한(§⑤). **개별 제출물 단위 SUPPORTED를 실제로 채우는 방법은 여전히 미해결로 남는다.** |

**결론**: 이 질문은 답이 없이 열린 채로 연구를 멈춘다 — 더 파도
새 후보가 안 나온다는 게 이번 판정으로 확인됐다(지수 의견). 다음
정보는 Gate 3 실측에서 나온다.

## 이번 라운드에서 하지 않는 것

- API 호출 없음 — 이 문서는 설계만. **수정 직후 바로 실험하지
  않는다**(본부 명시).
- "독립 검증"의 정의 — 위 판정 이상으로 더 안 판다. Cross-
  Verification 연구는 여기서 STOP(본부 확정, 상태 §참고).
- identity·text·transition·degradation를 포함해 **7개 CHECK
  카테고리 전부 지금 production-qualified로 확정 안 함**(§⑥) —
  전부 pilot evidence, 승격은 Gate 3에서만.
- 스키마 확장(`repeatability`/`accuracyStatus` 필드, 4상태), audit
  큐, `buildScoringPrompt` 분리, Evaluation 계약 강제 로직은 전부
  설계 문서 수준 — 구현 없음.
- Gate 3(100~150편) 검증 계획의 구체적 수치·일정은 아직 안 잡음 —
  본부 우선순위 결정 사항.
- **내일 code audit 결과를 보기 전에** 이 설계를 더 고치지 않는다
  — 감사 결과가 이 설계의 전제(예: production이 UNCERTAIN을 실제로
  어떻게 다루는지)를 바꿀 수 있다.

## STOP — rev.3 최종, Cross-Verification 연구 종료

Dense pilot 결론 확정 + Cross-Verification Layer 설계 **rev.3로
최종 확정**(SUPPORTED/UNCERTAIN/UNQUALIFIED/DISPUTED 4상태, 카테고리
검증≠개별진실보장, 7개 카테고리 전부 미승격). **Cross-Verification
연구는 여기서 STOP**(본부 확정) — 다음 라운드는 이 설계를 더
다듬는 게 아니라 **code audit**(읽기 전용, 인계서 참고)이다.

API 호출 0, 코드/prompt 변경 0, 커밋/배포 0. Gate1 PASS·Gate2
NOT PASSED 그대로. Dense production 적용 HOLD·CV/ROI HOLD 그대로.
다음 실행은 본부 판단 대기.

관련: [[project_jisoo_resume_2026-09-18]] ·
`dense_safety_generalization_pilot_result_2026-09-18.md` ·
`perception_layer_design_2026-09-16.md`(§④ Cross-Verification 초안) ·
`observation_accuracy_stage1b_forensic_2026-09-16.md`(Cross-Model
기각 근거) · [[feedback_absent_is_not_zero]] ·
[[project_identity_continuity_quality_vs_compliance_2026-09-12]]
