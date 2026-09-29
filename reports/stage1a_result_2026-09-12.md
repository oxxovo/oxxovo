# Stage 1a 결과 — 7콜 (2026-09-12)

실행: `oxxovo-scoring/_stage1a_observation_probe_2026-09-12.mjs` (미커밋, 격리
프롬프트 — production 파일 미수정). 원자료 = `oxxovo-scoring/reports/
stage1a_raw_output_2026-09-12.json`. **실비 $1.3893**(승인 $1.5 이내).
claude-opus-5, thinking disabled(production 설정과 동일), STEP2/3/4 연결 없음.

## ★올리기 전 자체 정정 3건 — 내 GT 자체의 오류

지시받은 그대로("보이지 않는 걸 창작하지 마라") 모델만 검사하면 안 되고
제 GT부터 다시 봤다. 셋 다 채점 전에 발견했다.

1. **handLimbAnatomy·objectMechanismCoherence 극성 오기.** CHECK 문구가
   "...anatomically **plausible**...?" / "...work as a **coherent**
   system...?"다 — 문자 그대로면 YES=정상, NO=결함. A04_morph·A12_mech를
   "결함 있음=YES"로 잘못 표에 적었다. 실제로는 둘 다 NO가 결함 확인이다.
2. **demo_anne의 GT 자체가 관찰 오류였다.** 09-12 이전 보고에서 "다리가
   프레임 밖"이라 적었는데, 이번에 프레임을 다시 열어보니 **허벅지는 청바지
   차림으로 매 프레임 보인다** — 안 보이는 건 무릎 아래·발뿐이다. "완전히
   안 보임"은 내가 틀렸다. 정직한 정답은 NOT_VISIBLE이 아니라 **UNCERTAIN**
   (부분적으로 보이지만 보행 진행을 확정할 근거는 부족)에 더 가깝다.
3. **novya 텍스트 판독 차이.** 내가 frame 4를 "NOWYA"로 읽었는데 모델은
   같은 프레임을 "NOVVYA"(V 두 개)로 읽었다. 스타일라이즈 로고에서 "W"는
   원래 "V" 두 개가 겹친 모양이라 — 같은 글리프를 다르게 전사한 것뿐,
   틀린 관찰이 아니다. 결론(철자가 최종카드와 다르다=NO)은 모델과 나 둘 다
   똑같다.

## 결과표 (정정된 GT 기준)

| Clip | Target CHECK | 정정 GT | 모델 certainty | ①실행 | ②일치 | ③근거 grounded | ④confabulation |
|---|---|---|---|---|---|---|---|
| Z03_studio | subjectIdentityCount | YES(교체 확인) | YES | ✓ | ✓ | ✓(frame 1-4 vs 5-8, 내가 본 것과 일치) | 없음 |
| A04_morph | handLimbAnatomy | **NO**(비정상) | NO | ✓ | ✓ | ✓(frame 1,3,4,6 — 내가 확인한 frame 1 손과 일치 + 새 근거 3개 추가 발견) | 없음 |
| demo_anne | claimedActionEvidence | **UNCERTAIN**(정정) | UNCERTAIN | ✓ | ✓ | ✓(허벅지 보임·무릎 이하 안 보임·보폭 변화 불확정 — 정확) | **없음 — 과거 "무릎/전신" 날조 재현 안 됨** |
| A12_mech | objectMechanismCoherence | **NO**(비정상) | NO | ✓ | ✓ | ✓(크랭크축 없이 기어에 얹힌 피스톤 — 내가 본 것과 정확히 일치) | 없음 |
| demo_consistency | progressiveDegradation | YES | YES | ✓ | ✓ | ✓(초반 안정→후반 스트릭, 내가 본 frame 2 vs 10과 일치) | 없음 |
| aurelie | transitionIntegrity | YES | YES | ✓ | ✓ | ✓✓(frame 7 라벨중복·frame 12 얼굴중복 — 내가 손으로 찾은 정확히 같은 프레임 번호) | 없음 |
| novya | brandTextIdentityStability | NO | NO | ✓ | ✓ | ✓(스펠링 불일치 확인, 글자 판독만 나와 다름 — §위 3번) | 없음 |

**7/7 실행, 7/7 정정 GT와 일치, confabulation 0건.**

## ①②③④ 총평

- **① CHECK 실행**: 7콜 전부 7개 CHECK 순서대로, 스키마 그대로, JSON parse
  실패 0건.
- **② certainty ↔ GT**: 정정된 GT 기준 7/7 일치. 내 원래(오기 포함) GT
  기준으로 채점했다면 3건이 "불일치"로 잘못 찍혔을 것 — GT를 먼저 의심하지
  않았으면 모델 탓을 할 뻔했다.
- **③ frame evidence**: 7건 전부 실제 입력 프레임 번호를 구체적으로 지목,
  제가 독립적으로 확인한 근거와 위치가 겹친다(aurelie는 프레임 번호까지
  정확히 일치).
- **④ confabulation**: 49개 개별 CHECK 응답(7클립×7체크) 전부 검토 —
  "안 보이는 걸 있다고 만든" 사례 0건. **가장 중요한 결과는 demo_anne** —
  이 클립은 과거에 실제로 "knees/full-body"를 날조한 전력이 있는 자리인데,
  이번엔 정확히 "허벅지는 보이고 무릎 아래는 안 보인다"고 답했다. 이건
  구조 시험 통과 그 이상 — instrument가 설계 목적(날조 방지) 그대로 작동한
  첫 실측 증거다.

## 확인 안 된 것 (정직하게 기록)

- aurelie의 frame 5/6 텍스트 궤적("URELIE"→"RELIE")은 모델 주장이고 제가
  그 두 프레임은 아직 직접 재확인 안 했다 — 그럴듯하지만 미검증.
- novya의 subjectIdentityCount(NO, 두 인물+dissolve)는 제가 이번에 본
  적 없는 새 주장 — 이 클립 CF 장르 특성상 개연성은 있으나 미검증.
- 이 둘은 "틀렸다"가 아니라 "아직 제가 안 봤다"로 남겨둔다.

## STOP

지시대로 여기서 멈춘다. 추가 모델·반복 N·프롬프트 수정·STEP3/4 연결 전부
안 함. 원자료는 `oxxovo-scoring/reports/stage1a_raw_output_2026-09-12.json`에
그대로 있다.
