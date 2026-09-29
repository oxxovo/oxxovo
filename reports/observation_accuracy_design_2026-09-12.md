# Observation Accuracy 설계 (2026-09-12, 본부 지시 ③)

**설계만. 새 API 호출 0, production code 변경 0, v1.3.1 추가 수정 0, $0.**
대상은 아직 v1.3.1이 건드리지 않은 층(STEP 1 — 순수 관찰) 하나뿐이다.
파일럿 N·사례 선정·acceptance 수치는 이 설계 승인 후 별도 문서에서 정한다
(본부 지시: "설계만 올려라. 파일럿 N은 그 뒤에 정한다").

## 0. 이 설계가 겨냥하는 것 — v1.3.1과의 경계

v1.3.1(`reports/v1_3_1_minimal_fix_design_2026-09-11.md`)로 "봤는데 잃어버린
것"(Evidence Carry-Forward)은 15콜 전부에서 0/5 유실로 확인됐다
(`reports/gate2_v1_3_1_probe_2026-09-12.json`). 남은 건 "애초에 못 본 것"이다
— 이 설계는 그것 하나만 겨냥한다. STEP 2/3/4의 판단 로직에는 손대지 않는다.

demo_anne에서 실제로 나온 두 실패(`reports/gate2_input_adequacy_2026-09-11.md`)가
이 설계의 반례 기준이다:

1. **누락** — 다리가 전달된 8장·덴스 15장 전부에서 안 보이는데도, 모델이 그
   사실 자체를 스스로 지적하지 않았다.
2. **날조** — STEP 1이 "medium-wide, knees/full-body"라고, **어느 프레임에도
   없는 프레이밍을 창작**했다. STEP 1 지시문("Record only what is visibly
   present")을 정면으로 어겼다.

## 1. 설계 원칙 (본부 지시 그대로)

- 목표는 모델에게 정답을 암시하는 것이 **아니라**, 반드시 확인할 사실을
  빠뜨리지 않고 실제 frame evidence에 근거해 답하게 하는 것이다.
- ⛔ STEP 1에 체크리스트를 길게 붙이는 방향은 안 된다.
- ⛔ demo_anne 때문에 motion만 겨냥한 프롬프트를 만들지 않는다.
- ⛔ 모든 결함을 다 때려넣은 거대한 체크리스트도 피한다.
- 구조는 고정: **CHECK → OBSERVATION → FRAME EVIDENCE → CERTAINTY**.
- CERTAINTY는 닫힌 4값: **YES / NO / UNCERTAIN / NOT VISIBLE**.
- ⭐ NO와 NOT VISIBLE을 반드시 구분한다 — "안 보이는 것"을 "없다"고 판단하는
  문제가 다시 생기면 안 된다.

## 2. 항목 선정 근거 — 왜 이 7개이고, 이 이상 늘리지 않는가

`reports/gate1_real_production_failure_survey_2026-09-09.md`(40편 실측,
사전 정의 없이 본 뒤 만든 taxonomy)의 §5 Tier 분류를 그대로 선정 기준으로
쓴다 — 셋을 동시에 만족해야 채택:

1. **빈도** — 서로 무관한 독립 프로덕션(promo/contestant/watch-demo/TK
   render)에서 반복 등장.
2. **Judging-relevant(Tier-A)** — 사람 심사자의 순위 판단을 실제로 움직일
   만한 것(§5 "Looks Tier-A" 목록).
3. **프레임 단위로 검증 가능** — 전체 영상을 봐야만 판단되는 것(예:
   페이싱의 좋고 나쁨)이 아니라, 주어진 정지 프레임 세트만으로 사실
   확인이 가능한 것.

**제외한 것**: H(텍스처 대체 — 희귀, 클로즈업 한정), K(minor cosmetic),
J(편집 하드컷 — §5가 "이건 결함이 아니라 콘텐츠의 구조적 사실"이라고 명시,
이 자체를 검증 항목으로 만들면 v1.3.1이 이제 막 분리해놓은 "관찰 vs
판단"의 경계를 다시 허문다).

**★2026-09-12 정정(본부 지적)**: 최초안은 B(텍스트/라벨 불안정)도
제외했다 — survey §5의 40편 **전체 평균** 판정("cosmetic, 대부분
시청자가 이미 감안하는 흔한 AI 특성, low weight")을 그대로 따른 것이었다.
틀렸다. 본선 실제 장르가 화장품 CF이고, 40편 중 실제 **CF 9편만** 떼어
보면 9편 중 5편(`lumea`/`novya`/`eclare`/`soira` 등, survey §1 Group CF)이
텍스트/라벨 불안정이었으며 전부 **제품명·브랜드 텍스트**였다
(`novya`: 같은 병의 각인 텍스트가 한 쇼트에선 "NOWYA", 다른 쇼트와 최종
카드에선 "NOVYA"). 이건 배경 잡음이 아니라 **심사 대상(제품)의 정체성
그 자체**다 — 사람 얼굴이 컷마다 바뀌면 안 되는 것(클러스터 E)과 구조가
같다. 장르 전체 평균이 아니라 본선의 실제 장르 기준으로 다시 판단해
채택으로 뒤집는다.

**채택 7개** — Tier-A 클러스터 1개당 1개 + 장르 특화 1개, 통합 가능한
것(A+I)은 묶었다:

| # | checkId | 겨냥 클러스터(survey §2) |
|---|---|---|
| 1 | subjectIdentityCount | E. 인물/사물 정체성 드리프트 |
| 2 | handLimbAnatomy | F. 손/사지 해부학 |
| 3 | claimedActionEvidence | C. 모션 결핍(★motion은 이 중 1/7일 뿐) |
| 4 | objectMechanismCoherence | D. 기계적/물리적 불가능 |
| 5 | progressiveDegradation | G. 점진적 시간적 붕괴 |
| 6 | transitionIntegrity | A. 전환부 합성 글리치 + I. 연속 샷 내 순간이동 |
| 7 | brandTextIdentityStability | B. 텍스트/라벨 불안정(★본선 장르 특화 — 화장품 CF의 제품명/브랜드 텍스트) |

7개에서 고정 — 사후에 늘리거나 줄이지 않는다([[feedback_policy_obsolete_code_stays_inactive]]와
같은 원칙: 기준은 구현 전에 박고, 결과 보고 나서 조정하지 않는다). ★단
이번처럼 **장르/브리프가 실제로 무엇인지에 대한 사실 정정**이 들어오면
그건 "결과 보고 사후 조정"이 아니라 "선정 근거 자체의 오류 수정"이라
예외로 다룬다 — 구분 기준: 결과(파일럿 성적)를 보고 기준을 바꾸는 것은
금지, 선정에 쓴 사실관계가 틀렸다고 밝혀져 고치는 것은 허용.

## 3. 스키마 초안

각 CHECK는 고정된 질문 문구(모델에게 그대로 제시)에 대해 네 필드로 답한다.

```
{
  "checkId": "subjectIdentityCount" | "handLimbAnatomy" | "claimedActionEvidence"
            | "objectMechanismCoherence" | "progressiveDegradation" | "transitionIntegrity",
  "check": "<고정 질문 문구, 그대로 반복>",
  "observation": "<실제로 본 것 — 사실 서술만, 판단 없음>",
  "frameEvidence": "<이 답을 뒷받침하는 구체적 프레임 번호/타임스탬프. NOT_VISIBLE이면 '어느 프레임에도 X가 없음'을 명시>",
  "certainty": "YES" | "NO" | "UNCERTAIN" | "NOT_VISIBLE"
}
```

7개 전부 매번 응답, 순서 고정, 하나도 생략 불가(Evidence Carry-Forward와
같은 "빠뜨릴 수 없다" 원칙을 관찰 단계에도 적용).

### CERTAINTY 4값의 정의 (여기가 이 설계의 핵심)

- **YES** — 사실이 성립하고, 구체적 프레임 근거로 지목 가능하다.
- **NO** — 사실이 성립하지 않고, 이것도 프레임 근거로 지목 가능하다(즉
  판단에 필요한 부분이 실제로 보이는데, 거기 없다/그렇게 안 된다).
- **UNCERTAIN** — 근거는 보이지만 애매해서 YES/NO를 확정할 수 없다.
- **NOT_VISIBLE** — 이 CHECK에 답하는 데 필요한 증거(신체 부위·대상·구간)
  자체가 **어느 샘플 프레임에도 나타나지 않는다.** 이 경우 YES도 NO도
  주장할 수 없다 — 이건 결함 판정이 아니라 "이 항목은 입력만으로 판단 못
  한다"는 정직한 신호일 뿐이다.

### ⭐ 반드시 지킬 금지 규칙 (demo_anne 반례를 그대로 프롬프트에 박는다)

```
Do NOT write NO when the honest answer is NOT_VISIBLE. If the body part,
object, or region needed to answer this CHECK never appears in any frame
you were given, the correct certainty is NOT_VISIBLE — not NO. A past
evaluation of a different clip claimed a camera framing ("knees/full-body")
that did not appear in any frame it was given; do not do this. Never
describe a framing, angle, or body part as present unless you can point to
the specific frame that shows it in frameEvidence.
```

## 4. CHECK 7개 문항 초안

1. **subjectIdentityCount** — "Count the distinct human or named subjects
   visible across all sampled frames. For each subject, does their core
   identifying appearance (face shape, hair, build, and any signature
   clothing) remain the same individual in every frame where they appear,
   or does the frame set contain evidence that one subject is replaced or
   merged with another at any point, including across a cut?"
2. **handLimbAnatomy** — "Are one or more hands, fingers, or limbs visible
   in enough detail in at least one sampled frame to judge their shape? If
   so, is digit count, joint articulation, and limb proportion anatomically
   plausible in every frame where they are visible?"
3. **claimedActionEvidence** — "Step 1 records at least one major action.
   For the single most prominent claimed action, is the specific body part
   or mechanism that would perform it (legs for walking, a hand for
   pouring, wheels for driving, etc.) actually visible in at least one
   sampled frame? If it is visible, do at least two sampled frames show a
   position or pose change consistent with that action actually
   progressing, as opposed to a held or repeated pose?"
4. **objectMechanismCoherence** — "If any single frame shows a mechanical
   assembly, physical process, or object-to-object physical interaction in
   enough detail to judge it, does the depicted mechanism work as a
   coherent physical system within that one frame, independent of any
   other frame?"
5. **progressiveDegradation** — "Compare the visual coherence (geometry and
   texture stability) of the same subject or background element in the
   earliest and the latest sampled frames in which it appears. Does that
   coherence measurably worsen from the early frame to the late frame, or
   does it stay roughly constant?"
6. **transitionIntegrity** — "At each shot change or major reframing you
   can detect between sampled frames, do the frames immediately before and
   after it show any ghosting, doubling, an object appearing to pass
   through another object, or an unexplained jump in a subject's position
   that breaks presented continuity?"
7. **brandTextIdentityStability** — "If any product name, brand wordmark,
   or logotype text is legible on packaging, signage, or an on-screen card
   in any sampled frame, transcribe it exactly as rendered in each frame
   where it appears. Does the exact spelling and lettering of that same
   product/brand identity stay identical across every frame in which it is
   legible, or does it change (a letter differs, the wordmark is garbled in
   one shot but not another, etc.)? Treat this the same as a person's
   identity — the product name is the primary subject's identity in a
   commercial submission, not background detail."

## 5. 어디에 넣나 — STEP 1을 대체하지 않는다

기존 STEP 1(자유서술, `subjects`/`environment`/`actions`/`shotsAndCamera`/
`audio`)은 **재작문 없이 그대로 둔다.** 이 7개는 STEP 1과 나란히 붙는
별도의 작은 구조화 블록(`step1_verification`, 배열, 항상 7개 고정)이다 —
STEP 3처럼 9칸을 다 채우는 거대 구조가 아니라, STEP 1의 "본 대로만
적어라"는 기존 지시를 **검증 가능한 형태로 강제**하는 좁은 추가일 뿐이다.

STEP 3의 9개 defect 카테고리와 주제가 겹치는 항목들(identity, anatomy,
motion, continuity)이 있다 — 이건 중복이 아니라 층이 다르다:

- **step1_verification** = "이 사실이 프레임에 있는가, 없는가, 안 보이는가"
  (관찰의 정직성 게이트, 판단 없음).
- **step3_defects** = "그 사실이 결함인가"(품질 판단, 여기서부터 판단 시작).

STEP 2/3/4가 이 필드를 어떻게 소비할지(예: NOT_VISIBLE 항목을 STEP4가
자동으로 AMBIGUOUS로 못 뒤집게 규정할지)는 이번 설계 범위 밖 — §7 확인
필요 목록에 남긴다.

## 6. Contact Sheet / InsightFace / Optical Flow — 계속 HOLD 재확인

이 설계 검증이 끝나기 전까지 입력 형식(Contact Sheet 등)에 손대지 않는다.
같은 입력(현행 sparse frame)에서 Observation Accuracy가 실제로 개선되는지
먼저 재야, 나중에 Contact Sheet를 넣었을 때 그게 "진짜 눈이 좋아진 것"인지
"이번 설계 효과와 뒤섞인 것"인지 구분할 수 있는 깨끗한 대조군이 성립한다.

## 7. 확인 필요 (제가 임의로 안 정함)

1. 7개 채택 리스트에 동의하는지 — 늘리거나 뺄 항목이 있는지.
2. `step1_verification`이 STEP 3/4에서 어떻게 참조되는지(강제 규정을 이번에
   같이 설계할지, 아니면 관찰 계층만 먼저 검증하고 배선은 나중에 할지).
3. 7개 CHECK 문항이 Z03/demo_duel/demo_anne 세 사례를 넘어 일반 제출물에도
   자연스러운 질문인지 — 이번 문항은 40편 survey에서 역산했을 뿐, 아직
   그 3사례 밖에서 파일럿한 적은 없다.

## 8. Gate 4 리허설 갱신 항목 (기록만, 본부 지시)

- 09-11 발견: `_new_rubric_prompt_2026-09-09_structured_v1_3.ts`의
  drift-guard 오타로 production 채점 경로가 09-09부터 API 호출 0건 상태로
  죽어 있었음(수정 완료, 미커밋).
- 09-12 발견: v1.3.1 A/B 15콜 중 2건(demo_duel run4, Z03_studio run5)이
  성공은 했으나 각각 **1006.5초·783초** 소요 — 다른 13건(65~85초대)과
  1桁 다른 이상치. SDK 타임아웃-재시도 중첩으로 추정(scorer.ts 자체 주석에
  이미 문서화된 거동), 정확성 문제는 아님.
- **본부 지시대로 지금은 기록만.** 13~17분짜리 judge call이 500명 규모
  운영에서 반복되면 별개의 운영 문제(워커 lease/timeout 설계,
  `reports/scoring_inprogress_lease_design_2026-08-08.md` 참조)이므로, Gate
  4 리허설(production-equivalent end-to-end 검증) 설계 시 이 두 항목을
  operational reliability 체크리스트에 반드시 포함시킨다.

관련: [[project_jisoo_resume_2026-09-11]] · [[feedback_harness_save_full_pipeline]]
· [[feedback_absent_is_not_zero]] · [[project_face_consistency_scoping]]
