# 지수 본체 EOD — 2026-09-09 (Benchmark v1 종료 → Gate 1 전환, 내일 이어간다)

**다음 세션은 이 파일 하나만 읽고 재개.** 오늘 하루 안에서 상황이 완전히 두 번
바뀌었다(GT01~18 검증 완료 → Benchmark v1 전체 종료 → Gate 1 신규 설계). 이 파일이
최신 상태이고, 같은 파일명의 이전 버전(오전 GT21 검증 재개 지시)은 이제 무효다.

## ⛔ 지금 절대 하지 말 것 (본부 명시 지시, 전부 HOLD)

- **고치지 마라 · 커밋하지 마라 · 배포하지 마라.**
- Gate 1 **실행**(6개 모델 실제 호출) — 설계만 승인됐고 실행은 아직.
- **Defect Spec v2** 작성 — 40편 조사에서 나온 6개 클러스터는 "v2 후보"로만 보존,
  헌법화 금지.
- **신규 fixture 제작** — Phase 2 fixture(anatomy/faceIdentity 등) 전부 중단 상태.
- **105+25콜** — 계속 보류.
- **CLEAN 인증** — GT01·GT02는 이미 6단계 프로토콜로 두 번(오늘 1차+블라인드 2차)
  통과해 "Certified CLEAN" 확정. **그 외 후보(A02_fabric·A18_cities·tk_render_2,
  그리고 추가로 찾은 15편)는 인증 절차 자체가 보류 상태** — 새 인증 진행 금지.

## 오늘 확정된 것 (사실관계, 재작업 불필요)

### 1. Benchmark v1(10→8칸 결함탐지) 종료
- 이유: 결함 카테고리를 실제 데이터를 보기 전에 상상해서 만들었고, 블라인드 검수로
  여러 "설계된 결함"이 실제로는 결함이 아니거나(정상적인 광고 편집 컷) 재현 불가능함이
  드러남(`gt21_paired_control_audit_2026-09-09.md`의 사전 경고가 실측으로 확인됨).
- **살린 것**: GT01·GT02 = Certified CLEAN 보존. GT19·20·21 = 결함 후보로 보존.
  **나머지(GT03~18)도 삭제하지 않음** — v1 연구기록으로 `reports/v1_1_ground_truth_answer_key_21_2026-09-08.md`
  + `oxxovo-scoring/_gt21_answer_key_2026-09-09.ts`에 그대로 보존.
- v1.3 프롬프트(`oxxovo-scoring/_new_rubric_prompt_2026-09-09_structured_v1_3.ts`,
  audiovisualSync 삭제+otherArtifacts 기록전용화)와 scorer.ts import 전환은 완료된
  상태로 남아있지만, **이 스키마 자체가 v1 종료로 실질적 용도를 잃음** — 105+25 재개
  여부와 함께 나중에 재검토 대상.

### 2. 40편 자연산출물 조사 (`reports/gate1_real_production_failure_survey_2026-09-09.md`)
- 홍보/cf/v3/watch_demo/TK Studio 40편(Z 픽스처 3편 제외) 전수 조사, "상상한 카테고리"가
  아니라 "실제로 반복되는 failure"를 바닥부터 추출.
- 6개 후보 클러스터(v2 후보로만 보존): 전환/합성 글리치, **텍스트/라벨 렌더링 불안정**,
  **모션 결핍/거의정지**(옛 "motion"은 방향이 반대였음 — 부자연스러운 움직임이 아니라
  움직여야 할 장면에서 안 움직이는 것), 기계적 비개연성, 정체성 드리프트, 손가락
  해부학. 텍스트불안정·전환글리치는 옛 10칸 taxonomy에 아예 없던 항목.
- "37/40" 공식 결론 폐기 → **34/40으로 재계산**(하드컷이 유일한 이슈였던 클립 제외,
  하드컷의 재서술에 불과한 잔여 이슈도 제외 — A01_fashion, A05_plating, A07_cooking).
- **결함의 정의 확정(본부, 오늘 최종)**: "변화"가 아니라 **"기대되는 지속성의
  비의도적 파괴"**. 이 정의가 다음 Defect Spec v2(보류 중)의 출발점이 된다.

### 3. Gate 1 — Ranking Discrimination (신규 축)
- 설계 문서: `reports/gate1_ranking_discrimination_design_2026-09-09.md`. 상위 질문 =
  "AI가 결함을 보는가"가 아니라 "AI가 실력차를 가려 순위를 만드는가".
- GPT-6 Astra 단가 확정: **input $10 / output $50**(1M, standard tier, GPT-5.6 Sol의
  2.5배). 6개 후보: Claude Opus 5·GPT-5.6 Sol·GPT-6 Astra·Gemini 3.8 Flash·Grok 4.6·
  Qwen3.8 Max.
- 정답 확정 절차: **지수 단독 판단 금지** — 독립 블라인드 검수 2회, 방향 일치시 채택,
  불일치시 TK 판정(Benchmark Release Auditor), 애매하면 폐기. 좌우 뒤집기(A/B↔B/A)+
  반복 안정성 측정, 승자 방향 기준(점수 아님).
- 평가 순서(이 순서 그대로): ①명백한 pair 방향 정확도 ②좌우 반전 일관성 ③반복
  일관성 ④근거-영상 대조 → 여기서 실패하면 즉시 중단, 3축 독립성/중간pair 구분은
  그다음.
- **비용**: 기존자산 우선 마이닝으로 생성비 $0 달성(목표 상한 $98은 안 씀). 심사비만
  ≈$83(25pair×6모델×3라운드), 승인된 $500 안.

### 4. Pair Mining 1차 — 30쌍 (`reports/gate1_contrast_pair_candidates_2026-09-09.md`)
- 기존 자산(홍보43+GT01/02/19-21)에서 $0으로 30쌍 마이닝 → 독립 블라인드 2차 검수
  (`gate1_blind_review_batch1_2026-09-09.md`, `batch2_...md`) → 대조
  (`reports/gate1_pair_reconciliation_2026-09-09.md`, ★최종본, 이 파일 하나만 보면 됨).
- **최종 동결 상태(본부 확정, 변경 금지)**: **Core 채택 20 · Boundary 2 · 폐기 8 = 30.**
  - Boundary: **Pair 11**(Z01_table vs A08_dessert) = 축간 trade-off(A는 CD약점/
    Execution클린, B는 CD강점/Execution결함 — 동일축 우열 아님이라 Gate1 부적합,
    Gate 3 후보로 보존). **Pair 25** = confidence Low-Medium이라 Core 부적합, 폐기도 아님.
  - Core 20의 axis 분포: Execution 9 · Creative Direction 10 · **Originality 1**
    (심각한 불균형 확인 → 보충 마이닝 트리거).

### 5. 보충 마이닝 — Originality+CD (`reports/gate1_supplementary_mining_2026-09-09.md`)
- 목표: Originality 6~8(high/medium-high만), CD 보강 4~6(high/medium-high만).
- **결과: Originality 6쌍(high 2·medium-high 4), CD 5쌍(high 3·medium-high 2) —
  둘 다 목표 달성, 약한 pair로 패딩 안 함(정직한 수율).**
- **미완료 — 다음 세션 첫 작업**: 이 11쌍의 독립 블라인드 2차 검수가 **진행 중이었으나
  세션 종료 시점까지 완료 안 됨.** 1차 시도(`agentId a0baedf3cb28b4cf4`)는 한 번에
  20개 영상 200프레임을 백그라운드로 몰아서 처리하려다 보고서 없이 끝남(재현 위험 —
  다음에도 같은 방식 쓰지 말 것). 2차 재시도(`agentId a56c92cfdc0630916`, "쌍 단위
  순차 처리, 즉시 기록" 지시로 재발주)가 세션 종료 시점까지 실행 중이었음 — **다음
  세션에서 가장 먼저 이 에이전트의 완료 알림을 확인**(SendMessage로 재접속 가능,
  안 되면 동일 스펙으로 재발주 — 프롬프트는 이 세션 대화 로그 또는 재발주 이력 참고).

## 다음 세션 순서 (본부 지시 그대로)

1. 보충 11쌍 2차 블라인드 검수 결과 회수(위 참고).
2. 11쌍 전부 대조표 작성 — **정확히 이 5열만**: pair별 방향 일치 여부 · Primary axis
   일치 여부 · Confidence · 다른 축이 섞였는지(secondary axis 오염 여부) · 출처(어느
   원본 클립).
3. 그 표를 고문(본부)에게 올려 **Gate 1 최종 구성 판정** 대기 — 이 판정 전까지 Gate 1
   실행 금지.
4. 판정 후에만: Gate 1 실제 실행(6모델×확정pair×3라운드) 착수 가능.

## 산출물 경로 정리 (전부 오늘, 미커밋·미배포 상태 그대로)

- `reports/gate1_real_production_failure_survey_2026-09-09.md` — 40편 바닥부터 조사
- `reports/gate1_ranking_discrimination_design_2026-09-09.md` — Gate 1 설계+비용(최신본)
- `reports/gate1_contrast_pair_candidates_2026-09-09.md` — 1차 마이닝 30쌍(1차 의견)
- `reports/gate1_blind_review_batch1_2026-09-09.md` / `batch2_...md` — 1차 30쌍 블라인드 2차 검수
- `reports/gate1_pair_reconciliation_2026-09-09.md` — ★30쌍 최종 대조표(Core20/Boundary2/폐기8, 동결)
- `reports/gate1_supplementary_mining_2026-09-09.md` — 보충 11쌍(Originality6+CD5, 1차 의견)
- `reports/gate1_blind_review_supplementary_2026-09-09.md` — ⚠️미완료(다음 세션에서 이어받기)
- `reports/v1_1_ground_truth_answer_key_21_2026-09-08.md`, `oxxovo-scoring/_gt21_answer_key_2026-09-09.ts` — v1 연구기록(보존, 더 이상 활성 아님)
- `oxxovo-scoring/_new_rubric_prompt_2026-09-09_structured_v1_3.ts`, `src/scorer.ts`(import 전환) — v1 스키마 축소분, 활성 여부는 105+25 재개 시 재검토
- `reports/_gate1_mockprelim_urls_2026-09-09.json` — 43편 R2 URL 목록(재사용 가능한 자산 인덱스)
- `outputs/gt21/phase2_fixtures/` — Phase2 fixture 5편(anatomy/faceIdentity/objectConsistency/motion/lighting), **HOLD, 답안지 미편입**

관련 메모리: [[project_scoring_v22]] · [[feedback_no_hardcode]] · [[project_scoring_weight_dual_truth]]
