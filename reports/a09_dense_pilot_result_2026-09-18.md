# A09_race Dense Pilot — 결과 (2026-09-18)

설계=`a09_dense_pilot_design_2026-09-18.md`, manifest=
`oxxovo-scoring/reports/a09_dense_manifest_2026-09-18.json`(A09 결과
보기 전 고정), HQ 승인 그대로 실행. **DETECT 정의·acceptance 변경
없음. Contact Sheet/ROI/CV 없음. prompt/CHECK/judge/temperature
변경 없음.**

## Raw count (평균 없음)

| Arm | N | certainty 분포 | DETECT("spark + no visible contact/source" 언급) |
|---|---|---|---|
| **Individual Production Frames**(기존 재사용, 09-16) | 5 | UNCERTAIN×5, NO×0, YES×0 | **3/5** |
| **Dense(1초 간격, 19프레임, 신규)** | 5 | UNCERTAIN×5, NO×0, YES×0 | **5/5** |

레포당 원문(신규분): `oxxovo-scoring/reports/stage1b_a09_dense_armB_raw_2026-09-18.json`.
5/5 parse 성공, parseError 없음. 실비 **$1.6288**(추정 $1.6~1.8 안).

## DETECT 세부 — 5건 전부 spark+무접점 명시

| rep | frameEvidence | 핵심 관찰 문구(원문 발췌) |
|---|---|---|
| 1 | 5,9,10,12,13,14,16 | "sparks/spray emanating near the car body without a visible contact point producing them" |
| 2 | 5,9,10,11,12 | "the source of the sparks is not visible as any contacting object" |
| 3 | 4,5,9,10,12 | "sparks appearing ahead of and above the wheel rather than trailing from a contact point" |
| 4 | 9,10,11,12,14,5 | "sparks emitting forward of the rear wheel rather than from a contact point" |
| 5 | 4,5,9,10,12,13 | "spark-like particles emanating... with no visible contact point producing them" |

## ⚠️ certainty는 변하지 않았다 — 본부 지시 ①에 따라 별도 보고

**Arm A와 Dense 둘 다 5/5 전부 UNCERTAIN.** DETECT는 3/5→5/5로
올랐지만(언급 빈도·구체성 개선), **확신도(certainty)는 전혀 안
움직였다** — 한 번도 NO(확신에 찬 정답)로 넘어간 적이 없다.

이건 A04와 질적으로 다른 패턴이다:
- **A04 Dense(09-18)**: Arm A가 NO 3회를 이미 포함했고, Dense는
  certainty 자체가 **NO 5/5**(확신에 찬 정답)로 수렴했다.
- **A09 Dense(이번)**: Arm A는 UNCERTAIN 5/5(NO 0회)였고, Dense도
  여전히 **UNCERTAIN 5/5**다 — DETECT(사실 관찰의 정확도)는
  올랐지만 **판정 확신도는 그대로 낮다.**

본부가 사전에 지적한 그대로다(①) — "A09가 더 어렵다"는 건 Arm A
단계에서 이미 알고 있었지만, Dense를 적용한 뒤에도 그 어려움의
**성격이 그대로 남았다**(관찰은 더 정확해졌지만 확신에는 못
이르렀다)는 게 이번에 새로 확인된 사실이다.

## Acceptance 판정 (사전 고정표 그대로 적용, 바꾸지 않음)

Dense DETECT=5/5 ≥4/5 → **"개선 방향성 신호"** (§a09_dense_pilot_design
의 사전 고정 판정표 적용).

## 이번 결과의 의미 — 본부 §② 해석틀 그대로

DETECT 기준으로는 4/5·5/5 구간에 들어왔다 — anatomy(A04)와
mechanism(A09), **서로 다른 confirmed defect category 둘 다에서
dense가 관찰 반복성(DETECT)을 개선**했다. 이건 Perception Layer의
기본 Evidence Acquisition을 dense 방향으로 설계할 근거를 강화한다
(본부 해석틀 §②-1).

다만 위 ⚠️ 절에 적은 certainty 정체는 그 결론에 걸리는 조건이다 —
"관찰 반복성 개선"이 이번엔 "더 정확한 사실 관찰"이지 "더 확신에
찬 정답"은 아니었다. DETECT와 certainty를 같은 것으로 뭉개지
않는다(본부 지시 ③, raw count만).

## STOP

본부 지시대로 여기서 멈춘다. 다음 실험으로 자동 진행하지 않음.
결과를 본 뒤 acceptance나 DETECT 정의를 바꾸지 않았음.

관련: [[project_jisoo_resume_2026-09-18]] ·
`a09_dense_pilot_design_2026-09-18.md` ·
`anatomy_evidence_acquisition_pilot_result_2026-09-18.md` ·
`oxxovo-scoring/reports/stage1b_a09_dense_armB_raw_2026-09-18.json`
