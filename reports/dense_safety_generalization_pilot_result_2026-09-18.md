# Dense Safety/Generalization Pilot — 결과 (2026-09-18)

설계=`dense_safety_generalization_pilot_design_2026-09-18.md`, manifest=
`oxxovo-scoring/reports/dense_safety_manifest_2026-09-18.json`(결과 보기
전 고정), 본부 GO 그대로 실행. **hard gate 정의·acceptance 변경 없음.
Contact Sheet/ROI/CV 없음. prompt/CHECK/judge/temperature 변경 없음.**

25/25 신규 호출 parse 성공, parseError 없음. 실비 **$7.7885**(추정
$9~11 이내, 낮은 쪽).

## 회귀축 4개 — raw count (평균 없음, 축별·fixture별 개별 판정)

| Fixture | CHECK | Individual baseline(재사용) | Dense(신규 N=5) | certainty | hard gate |
|---|---|---|---|---|---|
| Z03_studio | subjectIdentityCount | 5/5 | **5/5** (전원 frame8→9 경계 인물교체 명시) | YES×5 | **PASS** |
| demo_consistency | progressiveDegradation | 5/5 | **5/5** (전원 frame12~ 하늘 스트릭 진행성 악화 명시) | YES×5 | **PASS** |
| aurelie | transitionIntegrity | 5/5 | **5/5** (전원 frame23 이중노출·고스팅 명시) | YES×5 | **PASS** |
| novya | brandTextIdentityStability | 5/5 | **5/5** (전원 철자 불안정 명시, 방향 불일치 有 — 아래 참고) | NO×5 | **PASS** |

넷 중 4/5 이하로 떨어진 fixture 없음 — **회귀축 hard gate 전부 유지**.

### ⚠️ novya 정직하게 남기는 불일치 — 판정은 안 바꿈

Dense 5건 전부 "철자가 불안정하다"(certainty=NO, 즉 GT 방향과 일치)는
명시적으로 맞혔지만, **글자 자체의 전사(transcription)가 설계서에
기록된 GT 문구("NOWYA→NOVYA")와 다르다** — 5건 전부 "NOVVYA(더블 V)
→NOVYA"로 읽었다. W는 시각적으로 더블 V와 같은 글리프이므로 같은
결함을 다르게 읽은 것일 가능성이 높지만, **문자 그대로 GT 문구와
일치하진 않는다**는 사실을 숨기지 않는다. hard gate는 "정체성 불안정
자체를 명시적으로 언급하는가"이지 "철자를 토씨 하나까지 재현하는가"가
아니므로 PASS 판정은 유지하되, 이 discrepancy는 그대로 기록한다.

## confabulation 통제(demo_anne) — hard gate

| | certainty(기존 재사용) | certainty(Dense, 신규) | 새 confabulation |
|---|---|---|---|
| demo_anne | UNCERTAIN×5 | **UNCERTAIN×5**(유지) | **0/5** |

5건 전부 "feet가 모든 프레임에서 잘림, 다리 스윙/보행 사이클 확인 불가"를
명시적으로 유지 — 배경 스케일 변화를 "이동의 간접 증거"로만 쓰고, 다리
자체의 진행성 움직임은 5건 전부 명시적으로 부인(no visible leg stride
confirmed)했다. 프레임에 실제로 없는 다리·보행에 대한 새로운 구체적
시각 주장 **0건**. **PASS**.

## Acceptance 판정 (사전 고정 hard gate 그대로 적용, 바꾸지 않음)

- 회귀축 4개: Z03_studio·demo_consistency·aurelie·novya 전부 **5/5
  유지 → PASS**.
- confabulation 통제: certainty 유지 + 새 confabulation 0건 → **PASS**.
- **종합: Dense Safety/Generalization pilot 전체 PASS.** dense가
  A04/A09에서 얻은 DETECT 개선을, 기존에 이미 잘 맞히던 5개 영역에서
  깨뜨리지 않았다.

## 이 pilot이 증명 안 하는 것

Production 적용 여부·prompt/code 반영·추가 CV·STEP3/4 확대는 전부
본부 판단 대기(이번 pilot은 그 입력값 중 하나일 뿐, 결론 아님).

## STOP

본부 지시대로 여기서 멈춘다. Acceptance 기준 변경 없음. Production
적용·prompt/code 수정·STEP3/4·추가 CV 전부 HOLD 유지.

산출물(신규): `oxxovo-scoring/reports/stage1b_dense_safety_{Z03_studio,
demo_consistency,aurelie,novya,demo_anne}_raw_2026-09-18.json`,
`oxxovo-scoring/reports/stage1b_dense_safety_all_raw_2026-09-18.json`,
`oxxovo-scoring/_stage1b_dense_safety_2026-09-18.mjs`.

관련: [[project_jisoo_resume_2026-09-18]] ·
`dense_safety_generalization_pilot_design_2026-09-18.md` ·
`a09_dense_pilot_result_2026-09-18.md`
