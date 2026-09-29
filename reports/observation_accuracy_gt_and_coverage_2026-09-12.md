# Observation Accuracy — GT 확정 + Coverage Matrix (2026-09-12, v2)

본부 지시 ①~④ 수행 결과. **AI 호출 0, $0.** ①②는 로컬 ffmpeg만 사용(production
`extractor.ts`와 동일 공식: `interval = max(2, dur/20)`, `t=0,interval,2·interval,...`).
이 문서는 `reports/observation_accuracy_pilot_design_2026-09-12.md`(v1)의
정답지 표를 대체한다 — v1의 PENDING 칸과 demo_anne 오류를 여기서 고친다.

## ① extractor 재추출 — 완료 (8개 클립)

Z03_studio·demo_duel·demo_anne·novya·aurelie(기존 5) +
**A13_group·A12_mech·demo_consistency(신규 3, coverage 공백 메움)**.
production 공식 그대로 로컬 ffmpeg로 추출, 프레임 수 = 원 클립 duration에서
공식대로 산출(예: 19.0s→10장, 27.0s→14장, 15.1s→8장, 20.1s→11장) — 서베이가
쓴 8-10장 스팟샘플과 **다른 세트**임을 확인하며 진행했다.

## ② 사람이 직접 확인한 supporting frames

| Clip | Target CHECK | 확정 supporting frames | 시각적 근거(내가 직접 본 것) | 확정 certainty |
|---|---|---|---|---|
| **Z03_studio** | subjectIdentityCount | frame_01~04(t=0/2/4/6) vs frame_05~09(t=8~16) | t=0~6: 젊은 동아시아 여성, 생머리, 원숄더 레드 새틴 드레스, 캡션 "In red." / t=8~16: **완전히 다른 사람**(더 나이 든 여성, 곱슬 숏헤어, 레드 벨벳 드레스), 같은 캡션 "In red." — 프레임 4→5 사이에서 교체 확정 | **YES** |
| **demo_duel** | subjectIdentityCount(ambiguous) | frame_07(t=12.0) vs frame_08(t=14.0) | t=12: 여성 캐릭터 머리가 **밝은/금발 계열, 업스타일**로 보임 / t=14: 같은 캐릭터가 **어두운 갈색, 풀어헤친 긴 머리**로 보임 — 컷 없는 연속 접근 시퀀스 내에서 헤어 색/스타일이 두 근접 프레임 사이에 달라짐 | **YES/UNCERTAIN 모두 인정** — 완전한 딴사람(Z03류)은 아니고 렌더 편차와 구분이 어려움. NO/NOT_VISIBLE만 오답 |
| **demo_anne** | claimedActionEvidence | frame_02·06·08(t=2/10/14) 전부 | 프레임 3장 모두 **허리~어깨 위만 나오는 미디엄샷 고정 프레임**, 손은 재킷 주머니에 들어가 있고 다리·발은 8프레임 전부(체크한 3장 기준) 프레임 밖. "걷기"의 수행 부위(다리)가 어느 프레임에도 없음 | ★**NOT_VISIBLE로 정정**(v1의 "NO"는 틀렸다 — §3 참조) |
| **novya** | brandTextIdentityStability | frame_04(t=6.0), frame_14(t=26.0, 최종카드) | t=6.0 병 각인 텍스트 = **"NOWYA"**(N-O-W-Y-A) / t=26.0 최종카드 = **"NOVYA"**(N-O-V-Y-A) + 슬로건 "The next skin." — 철자 한 글자가 클립 내에서 바뀜, 육안 확정 | **NO**(=텍스트 정체성이 안정적이지 않다) |
| **aurelie** | transitionIntegrity | frame_07(t=12.0), frame_12(t=22.0) | t=12.0: 병 라벨이 **"LIE"(좌, 반투명 고스트) + "AURELIE"(우, 본체)**로 이중 노출 / t=22.0: **얼굴이 수평으로 겹쳐 두 번 노출**(눈·코·입 위치가 각각 두 세트로 보임)된 전환 프레임 — 두 프레임 모두 별개의 고스팅/더블링 증거 | **YES** |
| **demo_consistency** | progressiveDegradation | frame_02(t=2.0) vs frame_10(t=18.0) | t=2.0: 평범한 그라디언트 노을 하늘, 이상 없음 / t=18.0: **소용돌이치는 빨강/주황 리본형 스트릭**이 하늘 전체를 덮음 — 시작과 끝을 비교하면 명백히 악화 | **YES** |
| **A12_mech** | objectMechanismCoherence | frame_04(t=6.0), frame_07(t=12.0) | 두 프레임 모두 **피스톤 헤드가 크랭크축/커넥팅로드 없이 기어 표면 위에 직접 얹혀 있음**(t=12.0은 피스톤이 기어 이빨 사이에 박혀 있는 구도) — 단일 프레임 내에서도 기계로서 성립 안 함 | **YES** |
| **A13_group** | handLimbAnatomy | ⚠️**미확정** — frame_03·04·06·07·08(t=4~14) 5장 확인, 손이 보이긴 하나 전부 모션블러/주먹 포즈/원거리라 "손가락 elongated/melted"를 육안으로 확정 못 함 | 서베이(9/9)는 "손가락 elongated/melted"라 서술했으나 내가 오늘 재확인한 해상도에서는 결정적이지 않음 | **보류** — §4 참고, 이 사례는 이번 정답지에서 확정 못 함 |

## 3. demo_anne 정정에 대한 설명

v1 설계 문서(`observation_accuracy_pilot_design_2026-09-12.md`)는 acceptable
certainty를 "NO"로 적었다. 오늘 실제 프레임을 열어보니 **다리가 "안 움직인다"가
아니라 "안 보인다"** — CHECK #3의 첫 절("다리가... 실제로 보이는가")에 대한
정직한 답은 NOT_VISIBLE이지 NO가 아니다. 이건 [[project_face_consistency_scoping]]
계열에서 이미 확립된 원칙(★생략≠0, absent-is-not-zero) 그대로다: "안 보이는
걸 없다고 판단하면 안 된다"는 원칙을 내 설계 문서 자신이 어길 뻔했다 — 셀프
교정.

## 4. A13_group — ★09-12 재조사 결과: 확정 실패, A04_morph로 교체 권고

본부 지시(①)는 "A13_group 포함, anatomy-only로 실제 natural failure 검증"이었다.
10개 프레임 전체 재확인 + 4곳 크롭·확대(ffmpeg crop, $0)까지 했다:
- frame_06(t=10.0) 주먹 포즈, frame_07/08 크라우치 자세 — 손이 다 보이지만
  모션블러·역광이라 "손가락이 melted"인지 "그냥 블러+하이라이트"인지
  **구분이 안 된다**. frame_07 하단 크롭(두 팔이 교차하는 지점)이 가장
  근접했으나, 더 타이트하게 크롭하니 그냥 밝은 하이라이트였다.
- frame_09는 완전 블랙(컷 프레임), frame_10은 엔드카드.

**결론**: A13_group의 "손가락 elongated/melted" 주장(9/9 서베이)은 오늘
production 샘플링 프레임에서 **내가 확신을 갖고 재현 못 했다.** 억지로
YES를 박으면 ④번 규칙("보이지 않는 걸 창작하지 마라")을 내가 어기는
꼴이다 — 이건 지시 불이행이 아니라 지시가 요구한 "실제 natural failure
검증"을 정직하게 수행한 결과다.

**권고 — handLimbAnatomy positive를 A04_morph로 교체.** 같은 방식(production
extractor+크롭)으로 재확인, **frame_01(t=0.0)**: 여성이 은색 드레스 엉덩이에
얹은 손 — 크롭 확대해 육안 확인 결과 **손가락이 비정상적으로 길고 가늘며
발톱 같은 형태, 손가락 사이 구분(물갈퀴 부분)이 뭉개져 있고 개수가 애매함**
(서베이 원문 "blob-like"와는 결이 다르지만 — 서베이는 "안 갈라짐", 내가 본
건 "과도하게 갈라지고 길다" — 둘 다 비정상이지만 같은 결함은 아니다,
정직하게 구분해 기록). **이 프레임은 A13_group과 달리 모호함이 없다.**

★A13_group을 그대로 밀어붙이지 않고 대체를 권고하는 이유: 본부가 과거 A13
관련 AI 합의 오류("3개 그룹") 사례를 직접 언급하며 "손·사지라는 사전 고정
target만 판정하라"고 했다 — 이 신중함의 취지 자체가 "확신 없는 근거로
밀어붙이지 마라"이므로, 같은 정신을 handLimbAnatomy 타깃 선정에도 적용했다.

**Stage 1a 최종 7사례(A04_morph로 교체 반영)**:
1. subjectIdentityCount → Z03_studio
2. handLimbAnatomy → **A04_morph**(A13_group 대체)
3. claimedActionEvidence → demo_anne(NOT_VISIBLE)
4. objectMechanismCoherence → A12_mech
5. progressiveDegradation → demo_consistency
6. transitionIntegrity → aurelie
7. brandTextIdentityStability → novya

이 교체가 본부가 명시한 "A13_group 포함"과 다르다 — **AI 호출 전에 확인
받는다.** 승인되면 이 7개로 Stage 1a(Claude×1회=7콜)를 바로 실행한다.

## 5. Coverage Matrix — 7 CHECK × (positive / negative / ambiguous)

★positive는 위 §2에서 confirmed. negative/ambiguous는 **서베이(9/9) 텍스트
근거로 고른 후보일 뿐, 아직 내가 오늘 직접 재확인 안 함** — extractor
재추출·프레임 확인 전까지 "후보"로만 표시한다(A18_cities가 8-10프레임
서베이에서 clean으로 잘못 판정됐던 gate2의 교훈을 여기서도 그대로 적용).

| CHECK | Positive (★확정) | Negative control (후보, 미확인) | Ambiguous (후보, 미확인) |
|---|---|---|---|
| subjectIdentityCount | **Z03_studio** ★ | demo_artisan(서베이: 정체성 이슈 없음, 근접샷 다수) | **demo_duel** ★ |
| handLimbAnatomy | A13_group(⚠️미결, §4) | demo_artisan(서베이: "손·바퀴손·점토 전부 physically plausible") | velix(서베이: "손가락 추가/오배치 가능성, 모션블러로 미확정" — 이 자체가 이미 ambiguous로 서술됨) |
| claimedActionEvidence | **demo_anne** ★(NOT_VISIBLE) | demo_artisan(점토 성형 동작이 실제로 진행됨, 서베이 확인) | A10_drift(서베이: "초반 살짝 왜곡·후반 근접 정지" — 드리프트 동작이 끝까지 유지되는지 애매) |
| objectMechanismCoherence | **A12_mech** ★ | demo_artisan(물레+점토 물리 과정이 서베이상 정상) | A20_culture(서베이: "김 플룸이 비정상적으로 크고 인공적" — impossible까지는 아니고 "약간 이상") |
| progressiveDegradation | **demo_consistency** ★ | tk_render_2(서베이: 완전 클린 판정, 이상 없음) | A11_night(서베이 자체가 §2/§5에서 "steady함"과 "progressive"를 다르게 서술 — 서베이 내부 불일치, 정직한 ambiguous 후보) |
| transitionIntegrity | **aurelie** ★ | tk_render_2(다수 샷 전환 있음+서베이상 이상 없음) | A17_vista(서베이 본문이 직접 "minor/ambiguous"라고 표기한 유일한 항목) |
| brandTextIdentityStability | **novya** ★ | noira(서베이: "wordmark stays legible/consistent throughout" — 같은 CF 그룹 내 대조 사례) | soira(서베이: "SOIR로 잘림, minor label-consistency wobble" — 철자변경 아니라 크롭일 수도 있음) |

**결과**: 7개 CHECK 전부 최소 1개 positive를 갖는다(A13_group만 미결이나
대체 후보 A04_morph 있음). ③이 지적한 공백(handLimbAnatomy·
objectMechanismCoherence·progressiveDegradation)은 A12_mech·demo_consistency로
메웠고, handLimbAnatomy만 재확인 필요.

## 6. 단계적 실행 제안 (⑤ 준수 — 75콜 한 번에 안 태운다)

**Stage 1a (구조 확인, 최소 규모)**: 위 §2의 **확정 7개**(A13_group 제외) ×
**Claude 1개**(gate2에서 가장 활발히 반응한 판정관) × **1회** = **7콜, ≈$1.5**.
목적: step1_verification 블록이 파싱되는가, 7개 CHECK가 순서대로 다 나오는가,
NOT_VISIBLE·YES·UNCERTAIN 값이 스키마대로 나오는가 — **구조 결함이 있으면
여기서 멈추고 스키마를 고친다.** 정확도 판정은 이 단계의 목적이 아니다.

**Stage 1b (구조 통과 시)**: 같은 7사례 × Astra·Gemini 추가(2개) × 1회 =
**14콜 추가, ≈$3.0**. 목적: 세 판정관 모두 구조적으로 응답하는가(gate2에서
Astra가 formal 필드를 자주 비웠던 패턴 재현 여부 포함).

**Stage 2 (반복성, 1a+1b 전부 통과 시)**: 7사례 × 3판정관 × 나머지 4회 =
**84콜 추가, ≈$18.1**. 여기서 처음으로 5/5 vs n/5 판정이 의미를 갖는다.

**총합(전부 통과 시) = 105콜 ≈ $22.6** — 이전 보고(75콜/5사례)보다 사례가
늘어(7~8개, coverage 요구 반영) 총량은 커졌지만, **첫 승인은 7콜/$1.5만**
쓴다. demo_duel의 UNCERTAIN 허용 판정은 Stage 2에서만 의미 있다(1회로는
반복성을 볼 수 없음).

## 7. 확인 필요

1. A13_group(handLimbAnatomy positive) 처리 — §4의 두 옵션 중 선택, 또는 이번
   판에서 6개 CHECK만으로 Stage 1a를 시작할지.
2. §5 negative/ambiguous 후보들 — 이번에 함께 재추출해 확정할지, 아니면
   Stage 1a/1b 구조 확인 결과를 먼저 보고 나서(⑤ 정신) 착수할지.
3. §6 Stage 1a(7콜/$1.5)부터 시작하는 데 동의하는지 — 이게 이번 재보고에서
   가장 작은, 가장 먼저 뗄 수 있는 단위다.

관련: [[project_observation_accuracy_pilot_2026-09-12]] ·
[[project_identity_continuity_quality_vs_compliance_2026-09-12]] ·
[[feedback_absent_is_not_zero]] · `reports/observation_accuracy_pilot_design_2026-09-12.md`(v1, 이 문서로 대체)
