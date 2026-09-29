# 지수 EOD — 2026-09-19

이전: `reports/jisu_hq_2026-09-18_eod.md`. 오늘 작업 전부는
`oxxovo-scoring/reports/observation_qualification_contract_design_2026-09-19.md`
(Contract 설계 + Qualification Standard + Gate 3 GT Corpus Plan, 전부
이 한 파일에 이어붙임). 코드·commit·deploy·API·prompt·production 전부
오늘도 HOLD. 이 파일은 진행 요약 + 내일 재개 지점.

## ★★★최종요약 — 다음 세션은 이 절 + Corpus Plan 파일 하나만 읽고 재개

오늘 본부 지시로 4단계를 거쳤다:

1. **Code audit(read-only)** — production(`oxxovo-scoring` git HEAD
   `e437192`, 2026-09-06)에는 Step1~6 구조도 uncertainty 필드도 없다.
   워킹트리(미커밋)에 v1.3 Step1~6 구조가 있지만, 그것만으로는
   observation certainty를 코드가 못 막는다(프롬프트 지시뿐, 코드
   차단 없음) — 이게 오늘 전체 작업의 출발점.
2. **Observation/Qualification Contract 설계 → PASS.** 관찰층
   (YES/NO/UNCERTAIN/NOT_VISIBLE)과 자격층(SUPPORTED/UNQUALIFIED/
   DISPUTED)을 분리, `passesToEvaluation = observationState∈{YES,NO}
   ∧ qualificationState=SUPPORTED` 게이트를 코드 레벨로 설계.
3. **Observation Qualification Standard 구조 → PASS.** 새 AI 검증기가
   아니라 **Human-GT 벤치마크가 (judgeModel, procedureVersion,
   category) 단위로 "SUPPORTED를 쓸 자격"을 사전에 인증**하는 구조.
   실전은 lookup만(참가작을 사람이 보지 않음). 숫자 threshold는
   **의도적으로 안 정함**(본부 지시 — 근거보다 숫자가 먼저 만들어지는
   걸 막기 위해, Gate 3 corpus가 갖춰진 뒤 분포를 보고 확정).
4. **Gate 3 GT Corpus Plan.** 8개 category 전부 **INSUFFICIENT_GT**
   (=NOT YET QUALIFIED, "실패"가 아니라 "재료 부족" — 이 용어로
   확정). 새 원칙: **자연 발생 failure 중심, fixture는 진짜 부족한
   곳만 보충.**

### ⭐ 오늘의 실패 기록 (TK 상시 지시 — 실패도 기록한다)

**GT21(`oxxovo-scoring/_gt21_answer_key_2026-09-09.ts`)이 오늘 새로
정한 원칙의 반례였다.** GT21의 21개 클립 이름 자체(`face1/2/3`,
`motion1/2/3`, `lighting1/2`, `editing1/2`, `continuity1/2`,
`background1/2/3`, `anatomy_object1/2/3`)가 category별로 의도적으로
설계·촬영된 fixture라는 걸 말해준다. "자연 발생"이라 부를 수 있는 건
설계 외로 우연히 걸린 몇 개뿐(GT10/GT16/GT19 일부 칸). 지금까지 이
GT21을 채점 기준의 핵심 근거로 여러 차례 재사용해왔는데, 오늘에서야
"이게 실전 참가작과 얼마나 닮았는가"라는 질문을 처음 던졌고, 답은
좋지 않았다. 이 사실을 숨기지 않고 여기 적는다 — Corpus Plan은 이
문제를 알면서 짠 것이지, 모르고 짠 게 아니다.

## 오늘 한 일 (요청받은 순서 그대로)

- ① 용어 교체: `NOT_QUALIFIED` → `INSUFFICIENT_GT` (design 문서 전체
  적용 완료)
- ② 제안 숫자 철회: Recall 70% / FP 15% / repeatability 90% 등 —
  전부 문서에서 뺐다, 확정 순서를 "Corpus → 분포 관찰 → 본부가 risk
  기준으로 확정"으로 재정렬
- ③ GT21 반례 발견 — 위 절 참조
- ④ **A04_morph — anatomy category human-GT CONFIRMED** 확보(오늘
  발견, 원 출처는 09-18 anatomy pilot 설계서). frame4 왼팔 결함, 사람이
  크롭 없이 확정. 즉시 편입 가능.
- ⑤ **demo_anne — AMBIGUOUS-BY-DESIGN 1호 후보**(motion). 발이 전
  프레임에서 잘려 다리 움직임 자체를 확인할 수 없는 클립 — "판단
  불가"가 사람이 봐도 맞는 정답인 자연발생 occlusion 사례.
- ⑥ `oxxovo-scoring/temp/`에 과거 실행 캐시 영상 **183개**(`frames_*`
  디렉터리, 전부 `video.mp4` 포함) 존재 확인만 함 — 개별 리뷰는
  **아직 안 함**. objectConsistency/continuity/lighting이 이번 턴
  가장 빈손이라 내일 1순위.

## 내일 이어갈 3가지 (본부 지시, 여기 명시)

1. **`temp/`의 183개 캐시 영상을 무슨 방법으로 볼지 — API 없이
   가능한 안.** 후보로 떠오른 것(확정 아님, 내일 검토): 각 디렉터리의
   grid/contact-sheet 이미지(있으면)만 먼저 훑어 "명백한 결함 후보"를
   스크리닝하는 1차 통과, 통과분만 개별 프레임 정밀검토. 스크립트로
   자동 결함탐지는 안 됨(새 AI 검증기 금지 원칙과 같은 이유로, 이건
   사람 눈으로 해야 하는 인증 단계다).
2. **novya / A09_race — 기존 8칸에 넣을지, 9번째 category를 열지.**
   novya(텍스트/브랜드 정체성 불안정)와 A09_race(물리적으로 불가능한
   현상, 접점 없는 스파크)는 지금 `faceIdentity/anatomy/
   objectConsistency/motion/background/lighting/continuity/editing`
   8칸 중 어디에도 깔끔하게 안 들어간다. 억지로 끼워맞추면(예: 둘 다
   otherArtifacts로) v1.2→v1.3 개정 때 이미 한 번 겪은 "라벨만 있고
   정의문 없어서 판정이 갈리는" 문제가 재발할 수 있다 — 이 판단은
   내일로 미룬다.
3. **"자연발생 vs fixture" 판정 기준 자체를 정의.** 오늘은 사례로만
   판단했다(A04_morph=자연, GT21 대부분=구성) — 원칙을 코드/문서로
   명문화하지 않았다. 출발점 메모: A04_morph가 자연발생인 이유는
   "결함을 잡으려고 영상을 만든 게 아니라, 실제 production 채점
   과정에서 3사 판정이 갈리는 걸 보다가 우연히 발견됐고, 그 발견
   이후에 사람이 원본을 보고 확정했다"는 순서 때문이다 — **결함이
   먼저 있었고 그걸 찾아낸 것이지, 결함을 만들려고 영상을 준비한 게
   아니다.** GT21은 반대 순서(먼저 "lighting 결함을 보여줄 클립을
   만들자"고 기획하고 촬영/생성함). 이 "순서" 기준이 내일 formal
   definition의 출발점이 될 수 있다 — 확정 아님, 검토 필요.

## 작업 중단 지점

`oxxovo-scoring/reports/observation_qualification_contract_design_2026-09-19.md`
의 "Gate 3 GT Corpus Plan" 절, "실행 순서 제안" 1번(A04_morph 등 5개
사람 재확인)부터 이어간다. 코드·commit·deploy·API·prompt·production
전부 계속 HOLD — 문서 작업만 재개.
