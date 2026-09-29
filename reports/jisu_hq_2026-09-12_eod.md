# 지수 본체 EOD — 2026-09-12 (최종판)

**다음 세션은 이 파일 하나만 읽고 재개.** (오전판을 이 파일이 대체함 — 오전
작업은 §A, 오후~저녁 작업은 §B.)

## ⛔ 지금 절대 하지 말 것 (본부 명시 지시, 최종)

- **고치지 마라 · 커밋하지 마라 · 배포하지 마라.**
- **API 호출 계속 HOLD.**

## 오늘 전체 요약 (본부 표, 그대로)

| 항목 | 상태 |
|---|---|
| Gate 1 | PASS |
| Gate 2 / v1.3.1 A/B | PASS |
| Gate 2 / Observation — Stage 1a(7콜, Claude×1) | **PASS**(7/7, 날조 0) |
| Gate 2 / Observation — Stage 1b(28콜, Claude×4 추가, N=5) | **FAIL**(2/7 미달: A04_morph·A12_mech) |
| Compliance | BLOCKED by Rule(정상, 실패 아님) |
| 공식 AI배우(참가자용 Reference 기능 활성화) | HOLD |
| Astra·Gemini·STEP3/4·Contact Sheet·CV | 전부 HOLD |
| CLEAN | 0 |

**오늘 가장 큰 발견**: "못 봤다"가 아니라 "봤는데 확신 수준이 흔들린다."
Observation·Frame Evidence는 5회 내내 안정적(거의 같은 문장), Certainty를
YES/NO/UNCERTAIN 넷 중 하나로 반올림하는 지점(discretization)만 불안정.
Confabulation은 Stage 1a+1b 합쳐 35개 응답 전부에서 0건.

## §A. 오전 — v1.3.1 A/B + Observation Accuracy 설계 (요약, 상세는 git-blame 이전 버전)

1. TK의 "Contact Sheet/InsightFace/Optical Flow 먼저" 제안에 지수가
   독립적으로 반대(run-to-run instability 실측 근거) → 본부·고문 둘 다 판단
   수정, 지수 안(Rule→v1.3.1→Observation Accuracy→Contact Sheet 보류) 채택.
2. **v1.3.1 A/B 15콜 실행 완료($3.9739) — PASS.** 기준A(Evidence
   Carry-Forward, 0/5 유실 목표) 3사례 전부 0/5. 기준B(Z03 whole-clip scope)
   5/5. 기준C(Compliance)는 Rule 미배선으로 정직하게 BLOCKED.
3. **Observation Accuracy 설계 완료, 7개 CHECK 확정**
   (`reports/observation_accuracy_design_2026-09-12.md`): CHECK→OBSERVATION→
   FRAME EVIDENCE→CERTAINTY(YES/NO/UNCERTAIN/NOT_VISIBLE). 본부 지적으로
   텍스트/라벨(cluster B)을 CF 장르 근거로 정정 추가, 7개로 확정.

## §B. 오후~저녁 — 공식 AI배우 B안, 설계원칙, GT/Coverage, Stage 1a/1b

4. **본부 지시 — 공식 AI배우(RIN·KIRA·YUZU) 실무 질문에 사실 조사 + 지수
   의견.** 실측 결과:
   - Studio 참가자 자체 인물 생성(ActorMode, t2i+i2v 참조)은 **코드 완성,
     실사용 검증됨**(2026-07-19 실 fal 호출) — 단 참조 모델 5개
     (`nano-banana-pro`/`flux2-pro-image`/`ideogram-character`/
     `ideogram-character-draft`/`kling-v3-pro-i2v`) 전부 `active=false`,
     지금 참가자에게 안 열려 있음(방금 DB 재확인).
   - 본부 명단(RIN·KIRA·**YUZU**)이 낡았음 지적 — 2026-08-10 HQ 결정으로
     YUZU→**ANNA** 교체됨.
   - Z03 ≠ COMPOSED_test.mp4 — 본부가 서로 다른 두 사건(지수 채점 QA
     픽스처 vs 지수2 Studio 실측)을 합쳤음 지적, 접수됨.
   - `official_actors` 테이블 = RIN 1행뿐(status='draft'), 참가자 소비
     경로 0(코드가 읽는 곳은 `/admin/actors` 읽기전용뿐).
   - **TK 결정(B안, 확정)**: 공식 AI배우를 대회 자산으로 제공하지 않는다.
     참가자는 Studio에서 직접 인물 생성. KIRA·ANNA·RIN은 **미디어·IP
     자산**(프로모/시즌오프닝/Brief설명/결과발표/Watch홍보/Daily)으로 용도
     전환. 기록: [[project_official_actors_no_competition_asset_2026-09-12]].
5. **참조 기능 활성화 게이트 2개 확인, HOLD 유지**: ①생성 이미지 자체
   moderation 공백(현재 `moderateSubmission`은 최종 제출 시점만 스캔, 생성
   시점엔 프롬프트 텍스트 가드만 있고 산출 픽셀은 아무도 안 봄) ②실참가자
   동시부하 검증(kling-v3-pro-i2v 성공 건 전체 3건뿐, 전부 probe).
6. **설계 원칙 확정(TK)** — Identity Continuity를 "자동 감점 공식"으로
   만들지 마라. Quality(정도)=Execution축, Compliance(위반 여부)=별도축,
   심한 교체를 몇 점 감점으로 끝내지 말고 미세한 조명 편차를 자동 실격시키지
   말 것. 기록: [[project_identity_continuity_quality_vs_compliance_2026-09-12]].
7. **Observation Accuracy — GT 확정 + Coverage Matrix**
   (`reports/observation_accuracy_gt_and_coverage_2026-09-12.md`): 5개
   기존 사례(Z03/demo_duel/demo_anne/novya/aurelie)에 production
   extractor(로컬 ffmpeg, $0)로 실제 프레임 재추출 → 사람이 직접 확인해
   supporting frame 번호까지 확정. **자체 정정 1건**: demo_anne "다리가
   안 움직인다"(NO)로 적었던 게 틀림 — 다리가 프레임 밖(NOT_VISIBLE, 이후
   §9에서 다시 정정)이 정확. Coverage matrix(7 CHECK×positive/negative/
   ambiguous)로 handLimbAnatomy·objectMechanismCoherence·
   progressiveDegradation 공백을 A04_morph·A12_mech·demo_consistency로 메움.
8. **A13_group(handLimbAnatomy positive 후보) 재조사 → 확정 실패,
   A04_morph로 교체 승인받음.** 10프레임+ffmpeg crop 4곳까지 했으나
   모션블러/역광이라 "손가락 melted" 확정 불가 — 억지로 안 박고 UNCERTIFIED로
   남김(본부 승인). A04_morph frame_01(t=0.0)은 크롭 확대로 "비정상적으로
   길고 가는 손가락 형태, 구조·분리 비정상"을 확정(서베이의 "blob-like"
   문구는 그대로 안 베끼고 내가 본 대로만 기록, 본부 지시대로 원인 해석 확대
   안 함). A04_morph frame_01 자체가 8/8 전체금지 판정 소스와 안 걸치는지도
   확인(morph/hard-cut 전 첫 establishing shot).
9. **Stage 1a — 7콜 실행, $1.3893, PASS(7/7, 날조 0).**
   `oxxovo-scoring/_stage1a_observation_probe_2026-09-12.mjs`(미커밋, 격리
   프롬프트, STEP2/3/4 미연결). 실행 전 **GT 오류 3건을 모델 채점 전에 먼저
   수정**(본부가 "이 방식이 qualification 신뢰성을 지킨다"고 명시 칭찬):
   ①handLimbAnatomy·objectMechanismCoherence 극성 오기(문항이 "plausible/
   coherent 냐"라서 YES=정상·NO=결함인데 거꾸로 적어놨었음) ②**demo_anne
   재정정**: 허벅지는 실제로 보임(청바지), 무릎 이하만 안 보임 → 정답은
   NOT_VISIBLE 아니라 **UNCERTAIN** ③novya "NOWYA" vs 모델의 "NOVVYA"는
   스타일라이즈 폰트에서 W=V두개 겹침이라 같은 글리프의 다른 전사일 뿐, 결론
   불변. 결과: 원자료 `oxxovo-scoring/reports/stage1a_raw_output_2026-09-12.json`,
   분석 `reports/stage1a_result_2026-09-12.md`. aurelie는 제가 손으로 찾은
   프레임 번호(7, 12)와 모델이 지목한 번호가 **정확히 일치**.
10. **Stage 1b — 28콜 실행(Claude 추가 4회×7사례=N=5), $5.5157,
    합계 $6.9050. Acceptance 5개 사전 고정 후 실행, 사후 조정 0.** 결과:
    - ①Completion 7/7 fixture 5/5.
    - ②/⑤ GT일치: **5/7 fixture 5/5 통과, 2/7(A04_morph·A12_mech) 3/5로
      미달**(기준 4/5).
    - ③Confabulation: **7/7 fixture 0/5**(35개 응답 전부 날조 없음, 5회
      전부 직접 대조 완료 — 요구된 "1회 표본"보다 많이 함).
    - ④Evidence validity: 245개 응답 전체 프레임번호 자동 전수검사, 위반 0.
    - ⑤demo_anne 정밀표현 기준(본부 재수정: "다리/사람 안 보임"이면 실패,
      "무릎 이하·보행진행 확인 안 됨"이어야 통과) — **5/5 정확한 표현으로
      통과.**
    - **②실패 2건은 confabulation이 아니라 threshold 흔들림.** A04_morph·
      A12_mech 둘 다 5회 관찰문이 거의 동일한 문장인데(같은 프레임, 같은
      디테일 서술), 그걸 NO(확정)로 끝내는지 UNCERTAIN(애매함 인정)으로
      끝내는지만 갈림 — 09-12 세션 시작 지점에서 지수가 짚었던 "같은 프레임
      5회 실행해도 답이 흔들린다"는 현상이 격리 계측에서 재현됨.
    - 결과·분석: `oxxovo-scoring/reports/stage1b_raw_output_2026-09-12.json`
      (원자료), `reports/stage1b_result_2026-09-12.md`(분석).

## 내일 첫 작업 — $0 forensic 분석 (호출 없음, 이미 있는 raw output만)

**A04_morph·A12_mech 5회 raw output에서 넷만 추출·비교**:
①Observation statement ②Frame evidence ③Certainty ④certainty 선택 근거
문장(왜 그 값을 골랐다고 스스로 말했는지, 있다면). **목적 = NO vs UNCERTAIN이
시각적 증거 차이인가 calibration(같은 증거를 다르게 반올림) 차이인가.**
이미 `oxxovo-scoring/_stage1b_dump_target_2026-09-12.mjs`로 5회 전문을 뽑아본
결과(§B-10) 예비 결론은 "calibration 차이"였다 — 내일은 이걸 넷 항목으로
구조화해서 표로 정리한다. 재실행/재호출 없음, $0.

## 대표님(TK) 결정 대기 1건 (변경 없음, 여전히 최우선 차단 요인)

**"본선에 동일 주인공 유지를 공식 필수조건으로 할 것인가."** 넣기로 하면
**전역 규칙이 아니라 Brief별 Requirement**로 박는다. §B-6의 Quality/
Compliance 분리 원칙이 이 결정이 내려진 뒤 배선 설계에 적용된다.

## 산출물 경로 (오늘 전체, 전부 미커밋)

- `reports/observation_accuracy_design_2026-09-12.md` — 7개 CHECK 설계(오전)
- `reports/observation_accuracy_pilot_design_2026-09-12.md` — 파일럿 설계 v1
- `reports/observation_accuracy_gt_and_coverage_2026-09-12.md` — GT+coverage
  matrix, A13_group→A04_morph 교체 기록
- `reports/stage1a_result_2026-09-12.md` / `reports/stage1b_result_2026-09-12.md`
  — 분석 (raw는 아래 scoring 레포)
- `reports/jisu_hq_2026-09-12_eod.md` — 이 파일
- `oxxovo-scoring/_v1_3_1_rubric_prompt_2026-09-12.ts` ·
  `_gate2_v1_3_1_probe_2026-09-12.ts` · `reports/gate2_v1_3_1_probe_2026-09-12.json`
  (오전, v1.3.1 15콜)
- `oxxovo-scoring/_stage1a_observation_probe_2026-09-12.mjs` ·
  `reports/stage1a_raw_output_2026-09-12.json`
- `oxxovo-scoring/_stage1b_repeatability_probe_2026-09-12.mjs` ·
  `reports/stage1b_raw_output_2026-09-12.json`
- `oxxovo-scoring/_stage1b_analyze_2026-09-12.mjs` ·
  `_stage1b_dump_target_2026-09-12.mjs` — 채점 스크립트(재사용 가능)
- 로컬 프레임(레포 밖, 세션 스크래치패드): production-extractor 포맷으로
  뽑은 8개 클립 프레임 — 다음 세션에서 재현하려면 §B-7/8의 클립 URL을
  `reports/_gate1_mockprelim_urls_2026-09-09.json`에서 다시 찾아 동일 명령
  (`interval=max(2,dur/20)`)으로 재추출하면 됨(세션 종료 시 스크래치패드
  소멸 가능성 있음 — 원본 클립은 R2에 영구 보관).

## 메모리

- [[project_official_actors_no_competition_asset_2026-09-12]]
- [[project_identity_continuity_quality_vs_compliance_2026-09-12]]
- [[project_jisoo_resume_2026-09-11]] · [[feedback_harness_save_full_pipeline]] ·
  [[feedback_no_blanket_budget_approval]] · [[feedback_evidence_scope_before_conclusion]] ·
  [[feedback_absent_is_not_zero]] · [[project_face_consistency_scoping]] ·
  [[feedback_disagree_when_wrong]]
