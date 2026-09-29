# Observation Accuracy 파일럿 설계 (2026-09-12, 본부 지시)

설계 문서. **API 호출 0, $0.** 실행은 이 설계 승인 + §5 사전 준비(§5도 $0,
ffmpeg 로컬 추출뿐) 완료 후 별도 승인.

전제 설계 = `reports/observation_accuracy_design_2026-09-12.md`(7개 CHECK,
`step1_verification` 스키마, CERTAINTY 4값). 이 문서는 그 스키마로 무엇을,
몇 번, 무슨 기준으로 돌릴지만 다룬다.

## 0. 본부 지시 반영 — 정답을 먼저 고정한다

★순서: **사람이 Target CHECK/Expected observation/supporting frames/acceptable
certainty/unacceptable answer를 전부 고정 → 그다음 AI 실행.** Z03의 67%ile
결과에 맞춰 정답을 짜맞추지 않는다 — 아래 5개 사례의 정답은 전부 **AI
채점 파이프라인이 아닌 별도 인원(직접 ffmpeg 프레임 추출 + 육안 확인)이 이미
써놓은 두 개의 독립 기록**에서만 가져왔다:
- `reports/gate1_real_production_failure_survey_2026-09-09.md` — 사전 카테고리
  없이 40편을 먼저 보고 나서 분류를 만든 조사.
- `reports/gate2_pilot_result_2026-09-11.md` §2 — CLEAN 대조군 오류를 잡을 때
  "직접 프레임을 열어 시각 확인"한 기록.

**circularity 주의**: gate2 27콜 pilot에서 모델이 스스로 보고한 서술(예:
"6번↔7-8번 프레임")은 정답 근거로 쓰지 않는다 — 그건 검증 대상 모델의
출력이지 정답이 아니다. 아래 표의 "Expected factual observation"은 전부
사람이 원본을 보고 쓴 서술만 인용했다.

## 1. 사례 5개 — 기존 3 + CF 2

CF 선정 기준: gate1 survey에서 **이미 사람이 직접 확인한, 자연히 발생한**
결함이 있고, CHECK 7개 중 아직 CF로 검증 안 된 축을 겨냥할 것. novya/aurelie
둘 다 gate2 27콜 pilot에서 이미 모델 간 불일치가 실측됐다 — 즉 "쉬운 문제를
넣어 파일럿을 통과시키는" 위험이 없다.

| # | Clip | Target CHECK | 장르 | Gate2 베이스라인(참고, 정답 아님) |
|---|---|---|---|---|
| 1 | Z03_studio | subjectIdentityCount | QA fixture | Claude 오귀속(교체는 언급, 결함 처리 안 함) / Astra·Gemini Miss |
| 2 | demo_duel | subjectIdentityCount | Watch demo | 3사 전부 Miss/오귀속 |
| 3 | demo_anne | claimedActionEvidence | Watch demo | 3사 전부 Miss, Claude 자기모순(weaknesses↔step3) |
| 4 | **novya (CF)** | brandTextIdentityStability | 본선 장르(화장품 CF) | Claude·Astra Detected / Gemini Miss |
| 5 | **aurelie (CF)** | transitionIntegrity | 본선 장르(화장품 CF) | Claude Detected / Astra hedge / Gemini 부분 |

## 2. 정답지 (사람이 먼저 고정)

| Clip | Target CHECK | Expected factual observation | Supporting frames | Acceptable certainty | Unacceptable answer |
|---|---|---|---|---|---|
| Z03_studio | subjectIdentityCount | 클립 중간에 피사체 인물이 다른 사람으로 바뀐다(설계된 결함, `v1_1_diagnostic_answer_key`) | **PENDING** — §5 | YES | NO, NOT_VISIBLE, 또는 "교체는 맞지만 결함 아님"으로 재해석하는 자유서술(포맷 위반은 아니나 §5 별도 트랙 문제로 기록) |
| demo_duel | subjectIdentityCount | 두 전투원의 렌더 디테일이 프레임 6↔7-8 구간에서 달라진다 — 이게 정체성 교체인지 렌더 등급 변화인지가 쟁점 자체다(gate2에서 Claude가 "정체성은 유지, 렌더만 변화"로 결함 아님 판정) | PENDING | **UNCERTAIN 도 허용** — 이 사례는 정답이 명확한 YES가 아니라 "판단이 애매하다는 걸 애매하다고 정직하게 답하는가"가 시험 대상. YES/UNCERTAIN 둘 다 acceptable, NO/NOT_VISIBLE만 오답 | NO(차이 자체를 못 봄), NOT_VISIBLE |
| demo_anne | claimedActionEvidence | ~~클립 내내 다리가 전혀 애니메이션되지 않는다~~ → **09-12 재확인 후 정정**: 다리/발이 8프레임 전부에서 **아예 프레임 밖**이다(카메라가 줄곧 허리 위 미디엄샷) — "다리가 안 움직인다"가 아니라 "다리가 안 보인다". §5(supporting frames) 참조 | 확정 — frame_02(t=2.0)·frame_06(t=10.0)·frame_08(t=14.0) 전부 하반신 프레임 밖 확인 | **NOT_VISIBLE** (~~NO 아님~~ — 09-12 정정, 아래 참고) | YES, 또는 다리가 안 보이는데 NO라고 답함(=없는 걸 있다고 전제하고 부정) |
| novya | brandTextIdentityStability | 병 각인 브랜드 텍스트가 한 샷에서 "NOWYA", 다른 샷과 최종 카드에서 "NOVYA" — 철자가 클립 내에서 바뀐다 | PENDING | NO(=안정적이지 않다) | YES(안정적이라고 답함), NOT_VISIBLE(텍스트는 여러 프레임에서 legible함, 안 보인다고 하면 오답) |
| aurelie | transitionIntegrity | 전환 프레임에서 병 라벨이 같은 유리면에 중복 노출되고("RELIE" + 분리된 텍스트 조각), 별도 프레임에서 모델 눈 위에 원형 링과 턱 옆 반사 링이 기하학적으로 안 붙는 형태로 겹친다 | PENDING | YES | NO, NOT_VISIBLE |

## 3. Supporting frames가 전부 PENDING인 이유

survey/gate2는 **8-10장 스팟 샘플**(survey) 또는 **14장**(gate2 CLEAN 재검증)로
봤다 — 실제 파일럿이 모델에게 줄 프레임 세트는 production `extractor.ts`의
`interval = max(2, dur/20)` 규칙으로 뽑은, **다른 장수·다른 타임스탬프**일
가능성이 높다. 정답지의 "supporting frames"는 **파일럿이 실제로 먹일 그
프레임 세트 기준**이어야 한다 — 다른 샘플링으로 본 프레임 번호를 그대로
베끼면 정답지 자체가 틀린 근거를 가리키게 된다.

**다음 필수 단계(승인 시 $0, ffmpeg 로컬 실행뿐)**:
1. 5개 클립에 production `extractor.ts` 그대로 돌려 실제 프레임 세트를 뽑는다.
2. 그 프레임 세트 안에서 위 Expected observation이 **몇 번째 프레임에 실제로
   보이는지**(또는 demo_anne처럼 "안 보임 자체가 정답"인 경우 그 방향대로)
   사람이 육안으로 확인해 표에 채운다.
3. 이 단계에서 evidence가 production 샘플링에서 **탈락**하면(예: NOVYA/NOWYA
   두 샷 중 하나가 20장 샘플에 안 걸리면) 그 사례는 Input Adequacy
   부적격으로 파일럿에서 제외하거나 사례를 교체한다 — `gate2_input_adequacy`가
   demo_anne에서 이미 쓴 절차와 동일.

## 4. N — 사전 고정, 사후 조정 금지

**5 사례 × 3 판정관(Claude/Astra/Gemini) × 5회 반복 = 75콜.**

5회 반복은 새로 정하는 게 아니라 v1.3.1/gate2 계열에서 이미 쓴 반복수를
그대로 가져온 것(런투런 불안정성이 이미 확인된 축이라 반복 줄이면 안정성
질문에 답을 못 함). 3판정관 전부 도는 이유: gate2 베이스라인에서 이미
셋의 반응이 갈렸다(novya에서 Gemini만 Miss, demo_duel에서 셋 다 다른
실패 유형) — Claude만 돌리면 이번 수정이 세 모델 전부에 통하는지 알 수
없다.

## 5. Acceptance 기준 (사전 고정)

- **1차 판정 단위 = 셀(clip × 판정관)**, 5회 중 몇 회가 "acceptable
  certainty" 표의 값과 일치하는가.
- **PASS 기준(사례별 목표, v1.3.1과 같은 표기법)**: novya·aurelie·demo_anne·
  Z03_studio = **5/5 목표**(정답이 명확한 사례). demo_duel = **판정 없음,
  진단만** — 이 사례는 "애매함을 애매하다고 답하는가"가 목적이라 통과선을
  긋지 않는다(억지로 선을 그으면 [[project_identity_continuity_quality_vs_compliance_2026-09-12]]가
  금지한 것과 같은 실수 — 애매한 걸 억지로 이분법에 넣는 것).
- ⛔ 이 파일럿은 **관찰 정확도만** 잰다. Execution 점수·감점 폭·Compliance
  분류는 이 파일럿의 범위 밖(§0 원칙, [[project_identity_continuity_quality_vs_compliance_2026-09-12]]
  참조) — CERTAINTY가 정답과 같은지만 보고, 그게 최종 점수에 어떻게
  반영돼야 하는지는 여기서 답하지 않는다.
- 사후에 이 기준을 결과 보고 나서 낮추지 않는다([[feedback_policy_obsolete_code_stays_inactive]]와
  같은 원칙).

## 6. 비용

Gate2 27콜 실비 $5.83(=$0.216/콜, STEP1-4 동일 파이프라인). 75콜 ×
$0.216 ≈ **$16.2**. 여유 잡아 기술적 실패 재시도 포함 **$20 상한**으로
승인 요청.

축소 옵션(참고, 권장 아님): 반복 3회로 줄이면 45콜 ≈ $9.7 — 단, 런투런
불안정성이 핵심 질문인 사례(demo_duel)에서 신뢰도가 떨어진다.

## 7. 확인 필요 (제가 임의로 안 정함)

1. §1 사례 5개·타깃 CHECK 배정에 동의하는지.
2. §2 정답지 문구(특히 demo_duel의 "UNCERTAIN도 acceptable" 처리)에 동의하는지 —
   이게 이번 설계에서 가장 판단이 갈릴 수 있는 지점이다.
3. §4 N(75콜, $16.2~$20)과 §6 축소 옵션 중 무엇으로 갈지.
4. §3의 supporting frames 확정 작업(ffmpeg 재추출, $0)을 지금 진행해도 되는지 —
   이건 "조사"에 해당하고 "착수"(AI 호출)가 아니라고 판단해 준비만 해두려
   하는데, 이 경계 판단 자체도 확인받는다.

관련: [[project_observation_accuracy_pilot_2026-09-12]] ·
[[project_identity_continuity_quality_vs_compliance_2026-09-12]] ·
[[feedback_fixture_seed_failure_vacuous_pass]] · [[feedback_absent_is_not_zero]]
