# 지수 본체 EOD — 2026-09-11 (Gate 2 Pilot NOT PASSED → v1.3.1 설계 완료 → TK 결정 대기)

**다음 세션은 이 파일 하나만 읽고 재개.**

> ★★2026-09-11 후속 업데이트: v1.3.1 최소 수정안 설계 완료 —
> `reports/v1_3_1_minimal_fix_design_2026-09-11.md`. 아래 "내일 첫
> 작업" 절은 완료된 과거 지시다 — **지금 실제 다음 작업은 그 문서
> §7**을 보라: TK 결정 대기("본선에 동일 주인공 유지를 공식 필수조건으로
> 할 것인가") 1건이 전부를 막고 있다. 결정 전까지 Rule→Compliance
> 해석→심사 절차 순서를 건너뛰지 않는다. 코드/API 계속 HOLD, CLEAN=0.

## ⛔ 지금 절대 하지 말 것 (본부 명시 지시)

- **고치지 마라 · 커밋하지 마라 · 배포하지 마라.**
- **코드·API 계속 HOLD** — 내일 첫 작업(v1.3.1 설계)도 문서만, 새 호출
  0건이다.

## 오늘 한 일 (순서대로)

1. **분석 3 완료($0)** — 기존 864콜 원자료만으로 Astra NMD57%/Gemini
   반복불일치29%/Claude Low-conf54건 분석. 결과 =
   `reports/gate1_analysis3_2026-09-11.md`.
2. **Primary 3 확정(본부 판정)**: Claude Opus 5 · GPT-6 Astra ·
   Gemini 3.8. **Reserve** = Grok 4.6(Execution 축 제한 명시, 미구현).
   **Challenger** = Qwen 3.8 Max. **제외** = GPT-5.6 Sol.
3. **scorer.ts/batch.ts/index.ts 설계 반영**(미커밋) — Sol 제거, Astra를
   'gpt' 슬롯에 배선, modelId를 ai_outputs에 분리 기록(로지컬 슬롯과
   구분). Known Issues 2건 기록만(①Grok Execution 제한 미구현
   ②실질적 Reserve redundancy 부족) — 착수 안 함.
4. **Gate 2 설계 → 27콜 Pilot 승인·실행($5.53+재시도$0.30=$5.83)** —
   6클러스터(A~F) 각 1 + 결백1(A18_cities) + Z03 회귀 함정세트2, 정규
   3사 채점.
5. **Pilot 결과 = NOT PASSED(확대 HOLD, 전체 FAIL 아님, Primary 3
   불변)** — ⚠️**A18_cities(CLEAN 대조군) 자체가 무효**: 3사 전부 실제
   결함(그리스도상/자유의여신상/맨해튼 지리적 합성, 콜로세움 안 에펠탑
   철골 잔여물)을 잡았고 프레임 직접 확인으로 진짜임을 검증함 — 40편
   조사(8-10프레임)가 놓친 것.
6. **CLEAN Certification Protocol 설계(A)** — sparse sampling 금지,
   독립 검수 2명, 애매하면 UNCERTIFIED. **CLEAN 인증 클립 = 0개**(유지).
7. **4단계 실패분해(B)** — Observation/Tracking/Interpretation·
   Misattribution/Escalation. Claude 핵심 3사례(demo_duel/Z03_studio/
   demo_anne)를 원자료로 분해. 가설 폐기: "컷 때문에 다른 인물로
   해석"이 아니라 더 근본적 — 개체 정의속성을 시간축 전체에서 추적하는
   절차 자체의 부재.
8. **v1.4(STEP 1.5 Temporal Entity Tracking) 설계 → 폐기 확정** —
   dry-run 및 이후 실측으로 Z03은 STEP 2가 이미 정답("subject
   substitution")을 갖고 있었다는 게 드러나 STEP 1.5가 불필요함이
   증명됨. **설계 문서는 연구 기록으로만 보존**(코드 미반영).
9. **⚠️실행 전 별도 발견: production 채점 경로 전체가 09-09부터 죽어
   있었다** — `_new_rubric_prompt_2026-09-09_structured_v1_3.ts`의
   drift-guard가 API 호출 0건 상태에서 매번 throw. 원인 = em dash를
   ASCII `--`로 잘못 옮겨 적은 순수 transcription 오타(11곳, 내용
   재작문 없음, byte-level 확인). **발견·수정 완료(미커밋)**. Gate 2와
   무관한 production-readiness 결함으로 별도 분류. **★Gate 4 리허설
   항목에 추가 필요**: worker cold start→prompt load→judge call→parse→
   DB write 전 경로를 production-equivalent 환경에서 end-to-end 검증
   (tsc/단위테스트로는 이런 module-load-time throw를 못 잡음, 이번이
   실사례).
10. **Input Adequacy 공식 판정($0, 로컬 ffmpeg 1fps 덴스 재추출로
    원본 전체 타임라인 대조)**: demo_duel=PARTIAL(조명/자세 대안설명
    여지), demo_anne=ADEQUATE(누락·捏造 두 실패 분리), Z03_studio=
    ADEQUATE. **Sampling Failure = 3건 중 0건** — A18_cities와 달리
    이 셋은 입력 문제가 아니었다.
11. **승인된 3콜($0.68)로 STEP2 데이터 공백 해소** — ★★Z03은 STEP 2가
    이미 "subject substitution"이라는 정답을 갖고 있었고, 실패는 STEP
    3의 세그먼트 내부 범위 축소 + STEP 4의 미학적 판단만으로 A(의도적)
    분류(정책 앵커 부재)에서 일어남. demo_duel/demo_anne은 재실행에서
    원래 pilot과 다른(더 정확한) 결론이 나와 run-to-run instability
    경고 발생.
12. **본부 지시로 즉시 수정·재실행 대신 baseline부터 고정** — v1.3
    현상태 반복안정성 측정 설계 → 승인 → **N=5(9콜, $2.07) 실행 완료**.
    ★★**Z03: STEP2가 5/5 중 4번 "subject substitution"을 정확히
    잡는데 STEP3~4가 매번 "within each subject's own segment"(3번
    중 2번 거의 축자적으로 동일한 문구)로 되돌림 — B=0/5, 강한 구조적
    증거로 확정.** demo_duel/demo_anne은 반대로 **B=1/5(소수)** — 지난
    "제대로 잡힘"이 5번 중 가장 드문 결과였음. 원인은 관찰자체실패/
    C(ambiguous)분류/STEP3→STEP4 유실로 흩어짐(Z03과 다른 종류의
    escalation 손실).
13. **신규 개발 원칙 확정**: qualification harness는 최종 점수만 저장
    금지 — Observation→Tracking→Defect→Interpretation→Score 전 단계 +
    실제 modelId + prompt version + frame manifest 전부 저장. memory
    `feedback_harness_save_full_pipeline.md`로 기록.

## 본부 최종 판정(오늘)

- **Primary 3 확정**(코드 설계 반영, 미커밋·미배포).
- **Gate 2 Pilot = NOT PASSED**(확대 HOLD, 전체 FAIL 아님, Primary 3
  불변 — Gate 1/Gate 2를 안 섞음).
- **STEP 1.5(v1.4) 폐기 확정** — 연구 기록으로만 보존.
- **수정 후보 확정**: ① STEP 3 scope를 세그먼트 내부→whole-clip으로
  확장 ② STEP 4를 Intent/Defect/Compliance로 분리(★내일 지시로 세분화
  — 아래 참조) ③ Evidence Carry-Forward(★신규, 내일 상세).
- **CLEAN 인증 클립 = 0개**(유지). **코드/API 계속 HOLD.**

## 내일 첫 작업 — v1.3.1 최소 수정안 설계 (문서만, 새 호출 0)

**딱 세 가지만**:
1. **STEP 3 scope = whole-clip** — "within each subject's own segment"
   같은 세그먼트 내부 축소를 막고, identity/continuity 검사를 클립
   전체 시간축 대상으로 명시.
2. **STEP 4 = Intent / Defect / Compliance 3분리** — "이게 의도적인가"
   와 "이게 대회 브리프가 허용하는가"는 완전히 다른 질문이다. 브리프가
   "동일 주인공 유지"를 요구하면, 아무리 멋지게 의도적으로 교체해도
   Compliance FAIL — AI가 "의도적 연출이니 괜찮다"고 스스로 면제할
   권한이 없게 만든다.
3. **Evidence Carry-Forward** — STEP 2가 찾은 발견(subject substitution,
   identity change, continuity break)이 STEP 3/4로 반드시 전달되도록
   구조화(지금처럼 자유서술 사이에서 유실되지 않게).

**★acceptance threshold를 설계 단계에서 미리 적어라** — "이 정도면
v1.3.1을 채택한다"는 기준을 구현 전에 문서로 고정한다(예: baseline
대비 Z03류 사례의 B-분류율이 N=5 중 몇 건 이상이면 채택 등 — 정확한
기준은 내일 설계).

**설계만. 새 호출 0건.** baseline(N=5, `reports/
gate2_baseline_repeatability_result_2026-09-11.md`)이 대조군이다 — 이
설계 문서가 승인되고 실제 코드 반영이 열리면(아직 아님) 동일 설계·동일
N으로 전후 비교한다.

## 산출물 경로 (오늘, 전부 미커밋)

- `reports/gate1_analysis3_2026-09-11.md`
- `reports/gate2_design_2026-09-11.md`
- `reports/gate2_pilot_result_2026-09-11.md`
- `reports/gate2_pilot_followup_2026-09-11.md`(A/B/C 후속조치)
- `reports/gate2_procedure_v1_4_design_2026-09-11.md`(폐기, 연구기록)
- `reports/gate2_input_adequacy_2026-09-11.md`
- `reports/gate2_step2_findings_2026-09-11.md`
- `reports/gate2_v1_3_baseline_repeatability_design_2026-09-11.md`
- `reports/gate2_baseline_repeatability_result_2026-09-11.md` — ★N=5
  최종 결과, 내일 설계의 근거
- `oxxovo-scoring/reports/gate2_pilot_raw_2026-09-11.json` — 원본
  27콜 원자료
- `oxxovo-scoring/reports/gate2_step2_probe_2026-09-11.json` — 3콜
  STEP1-6 전체
- `oxxovo-scoring/reports/gate2_baseline_probe_2026-09-11.json` — 9콜
  STEP1-6 전체
- `oxxovo-scoring/src/scorer.ts` / `batch.ts` / `index.ts` — Primary 3
  설계 반영(미커밋)
- `oxxovo-scoring/_new_rubric_prompt_2026-09-09_structured_v1_3.ts` —
  drift-guard 오타 수정(미커밋, production-readiness 버그)
- `oxxovo-scoring/_gate2_pilot_2026-09-11.ts` / `_gate2_pilot_retry_
  2026-09-11.ts` / `_gate2_step2_probe_2026-09-11.ts` / `_gate2_
  baseline_probe_2026-09-11.ts` — 실행 스크립트(재사용 가능)
- `oxxovo-scoring/temp/frames_*`, `temp/dense_*` — 원본/덴스 프레임
  (재분석용, 삭제 안 함)

관련 메모리: [[project_jisoo_resume_2026-09-11]] ·
[[feedback_harness_save_full_pipeline]] ·
[[feedback_no_blanket_budget_approval]]
