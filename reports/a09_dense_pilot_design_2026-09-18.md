# A09_race Dense Frame Pilot — 설계안 (2026-09-18, API 미실행 — 승인 대기)

본부 지시(2026-09-18, "A04 종료 — 다음 A09 Dense"): A04 anatomy
pilot 결론(production 3/5 → dense 5/5, ROI-only 2/5, original+ROI
5/5) 확정. CV/ROI production 도입은 HOLD — "원본 context를 보존하며
증거를 더 준다"가 핵심일 가능성, dense가 ROI 없이도 5/5였다는 점이
근거. 다음 검증: **A09_race(mechanism, 전혀 다른 defect
category)에서 dense만으로도 같은 개선이 재현되는가.**

**이 문서는 설계·manifest·비용추정만이다. API 호출 0건.
`_stage1b_a04_roi_pilot_2026-09-18.mjs`류 실행 스크립트는 이번엔
아직 실행하지 않는다 — 본부 승인 후에만 돌린다.**

## ① 비교 구조 — 딱 둘

| Arm | 정의 | 신규 호출 |
|---|---|---|
| **Individual Production Frames** | 기존 09-16 Contact Sheet 일반화 테스트의 A09_race **Arm A(개별 프레임만, 10장, t=0~18) 그대로 재사용** | **0** |
| **Dense Frames** | 같은 클립, interval을 1s로 절반 축소 → **19 frames(t=0~18)** — 신규 | **5(N=5)** |

Contact Sheet·crop·CV는 이번에 전부 배제(본부 지시 ④). A04에서 썼던
`_stage1b_a04_roi_*` 계열 도구는 이 pilot에서 안 쓴다.

## ② Dense 추출 규칙 — 결과를 보기 전에 고정

`reports/a09_dense_manifest_2026-09-18.json`(oxxovo-scoring)에 이미
기록·생성 완료(로컬 ffmpeg, $0):

- 원본: `temp/gate1_pairwise_2026-09-10/videos/A09_race_6288648c8e.mp4`
  (19.0초) — 기존 재사용 Arm A 프레임과 **sha256 동일**(같은 소스
  확인 완료).
- 규칙: production 공식(`interval=max(2,duration/20)=2s`)을 **그대로
  절반**(1s)만 적용 — A04 pilot의 dense 규칙과 형식이 완전히 같다.
  **A09의 결함 시점(t=12s)을 알고 나서 그 주변을 더 넣거나 고르지
  않았다** — 전 구간 균등 재샘플링뿐, t=0부터 t=18까지 1초 간격 19장.
  결함 프레임(t=12)은 이 균등 격자 안에 자연히 포함될 뿐, 특별 취급
  없음.
- 이미 로컬에 생성 완료: `temp/a09_dense_pilot_2026-09-18/dense_frames/`
  19개 jpg. API에는 아직 안 보냄.

## ③ 기존 Arm A(재사용) — 원자료·DETECT 정의 재확인

`oxxovo-scoring/reports/stage1b_contactsheet_generalization_raw_2026-09-16.json`
에서 `clipId=='A09_race' && arm=='A'`인 5건 그대로:

| rep | certainty | frame_07(t=12) 스파크/무접점 언급 |
|---|---|---|
| 1 | UNCERTAIN | ❌ 없음 |
| 2 | UNCERTAIN | ✅ "no visible contact source" |
| 3 | UNCERTAIN | ✅ "no visible contact source" |
| 4 | UNCERTAIN | ✅ "no visible contact source" |
| 5 | UNCERTAIN | ❌ 없음 |

**DETECT = 3/5.** 이 DETECT 정의(09-16 forensic ADDENDUM 7 축1과
글자 그대로 동일)를 이번 pilot에서도 그대로 쓴다 — 새로 만들지
않는다:
> certainty 라벨이 NO든 UNCERTAIN이든, 응답이 roofline/hood/mirror
> 부근 스파크가 "보이는 접점이 없다(no visible contact source)"고
> **구체적으로** 언급하면 DETECT. certainty=YES로 결함 자체를 명시
> 부정하면(A04 Arm B rep1처럼) DETECT 실패 중에서도 최악(허위 안전
> 판정)으로 별도 표시한다.

## ④ N · Acceptance — 결과 보기 전 고정

- **N = 5**(Dense만 신규, Arm A는 재사용이라 신규 N=0).
- Acceptance는 09-16 forensic이 이미 A09 일반화축용으로 사전 고정한
  판정표를 그대로 재사용(Arm A=3/5로 이미 알고 있으므로 표가
  단순해진다):

| Arm A(기존, 고정값=3/5) | Dense(신규) | 판정 |
|---|---|---|
| 3/5 | ≥4/5 | **개선 방향성 신호**(A04와 동일 폭 — 3/5→4~5/5) |
| 3/5 | =3/5 | **개선 신호 없음** |
| 3/5 | ≤2/5 | **개선 신호 없음**(퇴보) |
| Dense 중 하나라도 YES로 결함을 명시 부정 | | **허위 안전 판정 발생 — 개선과 무관하게 별도 표시**(A09 Contact Sheet Arm B rep1과 같은 실패 모드 재현 여부 확인) |

결과를 본 뒤 이 표를 바꾸지 않는다(본부 지시, 09-16 forensic과
동일 원칙).

## ⑤ 신규 호출 수 · 예상 비용

- **신규 호출 = 5**(Dense arm만).
- 비용 추정은 **추정이 아니라 직접 비교 가능한 실측치**가 있다 —
  A04 pilot Arm B(dense, 19 frames, 동일 SYSTEM/CHECKS/모델
  claude-opus-5·thinking disabled)의 실비: 5콜 **$1.6571**
  (rep당 $0.328~0.340). A09_race도 같은 해상도·같은 프레임
  수(19)·같은 파이프라인이라 **$1.6~1.8** 범위로 추정한다(A04와
  거의 동일한 조건이라 범위가 좁다).
- 신규 비용 외 추가 발생 없음 — Arm A는 재사용(과거 09-16 실비에
  이미 포함, 오늘 신규 청구 없음).

## ⑥ 이번에 안 하는 것 (본부 지시 그대로)

- Contact Sheet, crop, CV 도입 — 전부 배제.
- prompt·judge·temperature·CHECK 변경 — 없음.
- 사람이 defect 프레임 주변을 골라 넣는 것 — 안 함(§②).
- **API 실행 — 이 문서 제출 후 본부 승인 전까지 안 함.**

## STOP

설계·manifest·로컬 dense frame 생성(19장, $0)까지 완료. API 호출
0건. 본부 승인 후에만 5콜 실행.

관련: [[project_jisoo_resume_2026-09-18]] ·
`oxxovo-scoring/reports/a09_dense_manifest_2026-09-18.json` ·
`reports/anatomy_evidence_acquisition_pilot_result_2026-09-18.md` ·
`oxxovo/reports/observation_accuracy_stage1b_forensic_2026-09-16.md`(ADDENDUM 7 축1)
