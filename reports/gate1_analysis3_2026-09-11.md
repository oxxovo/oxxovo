# Gate 1 — 분석 3 (Primary 적격 판정용, $0, 기존 864콜 원자료만 사용)

새 유료 호출 0건. 전부 `oxxovo-scoring/reports/gate1_criterion_v2_full_2026-09-10.json`
(864레코드)에서 로컬 집계. round1/round3는 항상 동일 제시 순서(전수 확인,
288/288 clip1Ref 일치) — 반복 불일치·NMD·confidence 집계는 raw label 그대로
써도 위치편향 혼입 없음.

## ① Astra Originality NMD 57% — 정직한 Tie인가 판단 회피인가

**판정: 정직한 Tie에 가깝다.** 근거 3가지:

**(a) NMD는 Originality-dominant pair에서 오히려 더 적게 나온다.**

| 구분 | NMD 비율 |
|---|---|
| Originality-dominant 7쌍 (21콜) | 38.1% (8/21) |
| 비-dominant 17쌍 (51콜) | 64.7% (33/51) |
| 전체 | 56.9% (41/72) |

비-dominant 쌍(설계상 Originality 차이를 의도하지 않은 쌍)에서 Tie가 더 많이
나오는 건 구조적으로 당연하다 — 예를 들어 pair 14/16/18/19/20/21/26/28,
S-C2, S-C4(전부 Execution/CD가 dominant axis)는 3라운드 전부 NMD(9쌍 만장일치)였다.
이건 "판단 회피"가 아니라 애초에 Originality 축에서 차이가 설계되지 않은
쌍을 정확히 구분해낸 것으로 읽힌다.

**(b) dominant 7쌍 중 3쌍(S-O1/S-O2/S-O6, confidence High/High/Medium)은
NMD 0/3 — 한 번도 Tie를 안 냈다.** 진짜 명백한 originality 차이가 있는 쌍은
매번 승자를 골랐다.

**(c) 나머지 4쌍(23, S-O3, S-O4, S-O5 — confidence Medium~Medium-High)에서
NMD 2/3.** round1(결정적 응답)의 evidence를 직접 읽으면, 애초에 "작은/미미한
우위(a small originality edge / a modest originality edge / slightly more
specific)"라는 표현으로 승자를 골랐고, S-O3는 round1 자체 confidence가
`low`였다. 즉 3라운드 내내 **묘사하는 내용(어느 쪽이 어떤 디테일에서 약간
다른지)은 일관**되고, 흔들리는 건 "이 정도 차이가 material한가"라는 **문턱
판단**뿐이다 — 근거 없이 얼버무리는 패턴이 아니라 애초에 얇은 margin의 쌍에서
문턱이 왔다갔다하는 것.

예시 (S-O4):
- R1(결정): "Clip 1 has a **modest** originality edge through its sculptural
  field of cream peaks..." (winner=B, conf=medium)
- R2(Tie): "...conventional category motifs rather than materially distinctive
  concepts..." (conf=high)
- R3(Tie): "...neither creates a materially more distinctive or unusual
  concept." (conf=medium-high)

**결론: Astra의 Originality NMD 57%는 "애매한 pair에서 Tie를 정직하게 인정"
쪽 증거가 우세하다.** 명백한 쌍(S-O1/S-O2/S-O6)에선 Tie를 안 쓰고, 얇은
margin 쌍(23/S-O3/S-O4/S-O5)에서만 흔들리며, 비-dominant 쌍에서 Tie 비율이
더 높다는 3중 패턴이 일관되게 "회피"가 아니라 "문턱 근처에서의 정직한
불확실성"을 가리킨다.

## ② Gemini Originality 반복 불일치 29%(7/24) — 체계적 실패인가 경계 사례인가

**판정: 경계 사례에 가깝다.**

- 반복 불일치 7쌍 중 **Originality가 실제 dominant axis인 쌍은 3개뿐**
  (S-O1/S-O4/S-O5, 전부 confidence High~Medium-High로 설계됨). 나머지 4쌍
  (1, 18, 28, S-C4)은 dominant axis가 Execution/CD라서 Originality 질문
  자체가 원래 애매한 축-외 질문이다.
- **7쌍 14개 응답(R1+R3) 전부 Gemini 자신이 매긴 confidence가 medium 또는
  medium-high였다 — high는 0건, low도 0건.** 즉 흔들린 쌍들에서 Gemini
  스스로도 처음부터 "확신 없음"을 이미 표시하고 있었다 — 반복 불일치가
  나중에야 드러난 문제가 아니라 애초에 자기 예고된 것.
- 특정 pair에 반복적으로 몰리는 패턴은 없다(7개 쌍이 서로 다른 쌍, 한 쌍에서
  여러 번 흔들리는 사례 없음) — "특정 pair·특정 confidence대"에 국한된 국소
  결함이라기보단 "원래 얇은 margin 근처에서 흔들리는" 넓은 경계-사례 패턴.

예시 (S-O1, designed confidence=High임에도 흔들림):
- R1: "Clip 1 employs a deadpan, minimalist subversion..." (winner=A,
  conf=medium-high)
- R3: "Clip 2 features a stylized, conceptual fashion showcase..." (winner=B,
  conf=medium-high)

**주의**: S-O1/S-O4/S-O5는 사람이 mining+blind 검수로 "High/Medium-High"로
매긴 쌍인데도 Gemini가 흔들렸다 — Astra의 ①과 달리 여기선 "명백한 쌍에서도
흔들림"이 3/7 섞여 있다. 완전히 결백한 패턴은 아니고, 절반 가까이는 설계
confidence가 높았던 쌍에서 발생했다는 점은 Gemini Originality의 약점으로
기록해 둘 필요가 있다.

## ③ Claude Low-confidence 54건 — 애매한 pair 집중인가 전역적 성향인가

**판정: 부분 집중 + 축 편향, 깨끗한 "우수 calibration"은 아니다.**

- **축별**: Originality 29건(53.7%), Execution 16건(29.6%), Creative
  Direction 9건(16.7%). Originality 축은 전체 호출의 1/3(72/216)만
  차지하는데 low-confidence의 절반 이상을 차지 — **Originality 축 자체에
  대한 전역적 신중함**이 designed-tier보다 더 강한 신호로 보인다.
- **쌍 난이도(설계 confidence)별**: Tier2(Medium 설계, 13쌍) 32건(59.3%),
  Tier1(High/Med-High 설계, 11쌍) 22건(40.7%). Tier2 기본 비중(13/24=54.2%)
  대비 +5.1%p 차이뿐 — **뚜렷한 집중이라 보기엔 약하다.**
- **쌍 커버리지**: 54건이 24쌍 중 **20쌍(83%)에 걸쳐 퍼져 있다** — 소수
  쌍에 몰린 게 아니라 거의 전역적으로 조금씩 나타난다. 분포도 완만하게
  감소(5,5,4,4,4,4,4,3,3,3,2,2,2,2,2,1,1,1,1,1)해서 극단적 이상치 쌍도 없다.
- **반례**: "High" 설계(가장 명백해야 할 5쌍: 1/10/S-O1/S-O2/S-C1)에서도
  low-confidence 9건 발생(그중 S-O2 하나에서만 4건) — 설계상 가장 안 애매한
  쌍에서도 저confidence가 꽤 나온다는 건 "순수 문항 난이도 calibration"만으로
  설명이 안 된다.
- 설계 confidence(High→Medium-High→Medium)별 평균 low-conf 건수는
  1.8→2.17→2.46로 **방향은 맞지만 약한 기울기**다.

**결론**: Claude의 low-confidence 54건은 "애매한 pair에 정밀하게 집중"이라는
깨끗한 스토리는 아니다. Originality 축 자체에 대한 전역적 신중함(53.7%
쏠림)과, 설계 난이도에 대한 약한 상관(Tier2 쪽으로 완만한 기울기, 그러나
High 설계 쌍에서도 발생)이 섞여 있다 — **부분적으로는 좋은 calibration
신호(방향은 맞음), 부분적으로는 축 단위의 일반적 신중함(Originality 자체를
더 조심스러워함)**으로 보는 게 정확하다.

## 종합 (판단은 대표님 몫)

- Astra Originality NMD 57% → 회피보다는 정직한 문턱-근처 불확실성 쪽 증거가
  뚜렷하다.
- Gemini Originality 반복 불일치 29% → 대체로 경계 사례이지만, 7쌍 중 3쌍은
  "명백한" 설계 쌍에서도 발생 — 약점으로 기록.
- Claude Low-confidence 54건 → 방향은 맞는 약한 calibration + Originality
  축 자체에 대한 전역적 신중함의 혼합. "오히려 좋은 calibration"이라고
  단정하긴 이르다.

원자료 인덱스: `oxxovo-scoring/reports/gate1_criterion_v2_full_2026-09-10.json`
(pairId/model/axisAsked/round). 집계 스크립트는 세션 스크래치패드에만 있음(레포
미반영, 요청 시 재실행 가능).
