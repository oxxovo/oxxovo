# Dense Safety/Generalization Pilot — 설계안 (2026-09-18, API 미실행 — 승인 대기)

본부 지시("정리하라", 2026-09-18 내일 첫 작업): anatomy(A04)·mechanism
(A09) 둘 다에서 dense가 DETECT를 개선했지만(3/5→5/5), 그게 **이미
잘 되던 걸 망가뜨리지 않는지**는 아직 안 봤다. 이 문서는 그 안전성
검증 설계다. **API 호출 0건 — 승인 후에만 실행.**

## ① 대상 — 회귀축 4개 + confabulation 통제 1개

09-16 Contact Sheet 일반화 테스트가 이미 썼던 것과 **동일한 5개
fixture**를 그대로 재사용한다(같은 GT, 같은 소스 클립, sha256 대조
완료):

| Fixture | CHECK | GT(기존, 안 바꿈) | 축 | 기존 Individual baseline |
|---|---|---|---|---|
| Z03_studio | subjectIdentityCount | frame4→5 경계 인물 교체 | 회귀 | **5/5**(재사용) |
| demo_consistency | progressiveDegradation | frame2→10 하늘 소용돌이 스트릭 | 회귀 | **5/5**(재사용) |
| aurelie | transitionIntegrity | frame7/12 이중노출·고스팅 | 회귀 | **5/5**(재사용) |
| novya | brandTextIdentityStability | frame4/14 NOWYA→NOVYA | 회귀 | **5/5**(재사용) |
| demo_anne | claimedActionEvidence | GT=UNCERTAIN(다리 확인 불가) | confabulation 통제 | UNCERTAIN×5, confab 0건(재사용) |

**Individual baseline은 전부 재사용**(`stage1a_raw_output_2026-09-12.json`
rep1 + `stage1b_raw_output_2026-09-12.json` rep2-5 조합 — 09-16
forensic이 이미 같은 데이터를 "기존 Arm A"로 인용한 것과 동일 소스).
**신규 호출 0.**

## ② Dense 추출 — 결과를 보기 전에 고정, 이미 생성 완료($0)

`oxxovo-scoring/reports/dense_safety_manifest_2026-09-18.json`에 기록.
규칙은 A04/A09 pilot과 완전히 동일한 형식 — **production interval을
그대로 절반**(전부 2s→1s), GT 위치를 알고 나서 조정한 값 아님.

| Fixture | 원본 길이 | production(기존) | Dense(신규, 이미 생성) |
|---|---|---|---|
| Z03_studio | 19.0s | 10 frames(2s) | **19 frames**(1s) |
| demo_consistency | 20.1s | 10 frames(2s) | **20 frames**(1s) |
| aurelie | 27.0s | 14 frames(2s) | **27 frames**(1s) |
| novya | 27.0s | 14 frames(2s) | **27 frames**(1s) |
| demo_anne | 15.069s | 8 frames(2s) | **16 frames**(1s) |

소스 클립은 전부 09-16 테스트가 쓴 것과 sha256 동일 확인 완료 — 같은
비교 조건.

## ③ N · Acceptance — hard gate(개선 목표 아님)

**N = 5(fixture당, 신규) × 5 fixture = 25 신규 호출.**

이건 A09처럼 "개선 신호를 찾는" 실험이 아니라, **이미 완벽한 걸
dense가 깨는지 보는 안전성 게이트**다 — 하나라도 걸리면 그 자체로
독립 FAIL(다른 fixture 결과로 평균 내서 안 묻는다, 09-16 forensic과
동일 원칙):

- **회귀축(Z03·demo_consistency·aurelie·novya) 4개 — hard gate**:
  Dense에서도 각 fixture GT 문장을 **여전히 명시적으로 언급**하는지
  DETECT. **5/5 유지만 PASS.** 넷 중 하나라도 4/5 이하로 떨어지면
  그 fixture 단독으로 **FAIL**(다른 3개가 5/5여도 못 덮는다).
- **confabulation 통제(demo_anne) — hard gate, 09-16 정의 그대로
  재사용**:
  (a) certainty가 UNCERTAIN 또는 "허벅지는 visible, 무릎 이하·보행
  진행 미확인"이라는 의미의 NOT_VISIBLE로 유지되는가.
  (b) 다리·보행에 대한 **새로운 구체적 시각 주장**(프레임에 실제로
  없는 것)이 하나라도 나오는가. (b)가 1건이라도 나오면
  confabulation 위험 — 즉시 FAIL, 다른 축과 합산 안 함.
- **결과는 축별·fixture별로 따로 보고. 평균 금지**(A09 pilot과 동일
  원칙, 본부 상시 지시).
- **결과를 본 뒤 이 hard gate 기준을 바꾸지 않는다.**

## ④ 신규 호출 수 · 예상 비용

프레임 수 비례 추정 — A04/A09 dense 실측(19프레임=$0.326~0.331/콜)
기준 선형 보간(절편≈0, 프레임당 약 $0.0178):

| Fixture | Dense 프레임 | N | 예상 비용 |
|---|---|---|---|
| Z03_studio | 19 | 5 | ~$1.6 |
| demo_consistency | 20 | 5 | ~$1.7 |
| aurelie | 27 | 5 | ~$2.3 |
| novya | 27 | 5 | ~$2.3 |
| demo_anne | 16 | 5 | ~$1.3 |
| **합계** | | **25콜** | **약 $9~11** |

CHECK 종류(예: transitionIntegrity vs brandTextIdentityStability)에
따라 응답 길이가 달라질 수 있어 범위로 잡는다 — A04/A09 직접 실측
2건에 기반한 보간이라 A09 dense pilot보다는 넓지만 순수 추측은
아니다.

## ⑤ 이번에 안 하는 것

Contact Sheet·crop·CV 도입 없음. prompt·judge·temperature·CHECK
변경 없음. 사람이 GT 프레임 주변을 골라 넣지 않음(§② 균등
재샘플링만). **API 실행 — 본부 승인 전까지 안 함.**

## STOP

설계·manifest·로컬 dense frame 생성(5 fixture, 109장 합계, $0)까지
완료. API 호출 0건. 본부 승인 후에만 25콜 실행.

관련: [[project_jisoo_resume_2026-09-18]] ·
`oxxovo-scoring/reports/dense_safety_manifest_2026-09-18.json` ·
`a09_dense_pilot_result_2026-09-18.md` ·
`observation_accuracy_stage1b_forensic_2026-09-16.md`(ADDENDUM5·7)
