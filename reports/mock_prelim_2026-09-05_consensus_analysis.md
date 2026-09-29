# 모의예선 — 결합방식/합의도 분석 (추가 채점 없음, 비용 $0)

기존 43편 데이터(`oxxovo-scoring/reports/mock_prelim_2026-09-05_2026-09-05_1834.json`)를
그대로 재계산. 새 API 호출 0건. 스크립트: `oxxovo-scoring/_analyze_mock_prelim_consensus_2026-09-05.cjs`,
원자료: `oxxovo-scoring/reports/mock_prelim_consensus_2026-09-05.json`.

## ④ 먼저 — 3-Judge 불완전 편 (전체 해석의 전제)

**2편이 2사만으로 채점됐다** (지난 회차 부수발견 그대로):
- **cf_novya** — Gemini `PROHIBITED_CONTENT` 2회 연속 거부. Claude+GPT만.
- **The Potter's Hands(demo_artisan)** — Gemini 503(일시 오류). Claude+GPT만. **이 편이 원점수 평균 방식 #2위다** — 3사 평균이 아니라 2사 평균이 #2를 만든 것이므로, 이 순위는 정상 3사 항목과 같은 신뢰도로 취급하면 안 된다.

이 2편은 아래 모든 표에서 `[2-judge]`로 표시했다.

## ① 전 작품 2-of-3 합의도 (Top-8 / Top-12 지지 사수)

지지 분포:
- Top-8 지지: 3사 전원 1편(Weightless Duel) · 2사 5편 · 1사 11편 · 0사 26편(43편 중 60%가 어느 회사의 Top8에도 안 든다)
- Top-12 지지: 3사 전원 1편 · 2사 8편 · 1사 17편 · 0사 17편

3사 전원이 Top8로 지지한 건 **Weightless Duel 단 1편뿐**. 2사 지지(Top8 기준)를 받은 5편:
A02_fabric, A06_splash, A12_mech, A Day in Orbit, cf_soira.

## ② 순위 spread — 큰 순

| 작품 | 그룹 | spread | claude | gpt | gemini |
|---|---|---|---|---|---|
| A19_sunrise | A | **37** | 40 | 3 | 31 |
| (untitled face-consistency) | WD | 33 | 39 | 6 | 19 |
| A08_dessert | A | 32 | 21 | 4 | 36 |
| cf_soira | CF | 31 | 7 | 34 | 3 |
| cf_velix | CF | 31 | 35 | 35 | 4 |
| A09_race | A | 30 | 9 | 26 | 39 |
| A11_night | A | 27 | 37 | 28 | 10 |
| cf_aquelle | CF | 27 | 33 | 14 | 6 |
| Z03_studio | Z | 25 | 13 | 38 | 37 |

(전체 43편 spread는 파일에 있음.) **가장 안정적인(spread 작은) 항목**은 Weightless Duel(3),
A01_fashion_wearable(2), cf_novya(1, 단 2-judge라 애초에 비교쌍이 하나뿐이라 낮게 나오는 구조적 편향
있음) — Weightless Duel이 spread도 최소·top8 만장일치도 유일, 이번 세트에서 가장 "논란 없는" 1편.

## ③ 결합 방식 4개 나란히

정의:
- **A. 현행(원점수 평균)** — 지금까지 쓴 verified(3사 CD/EX/OR 평균 → 30/45/25 가중합산).
- **B. median rank** — 모델별 자체가중순위 3개(또는 2개, 2-judge 편)의 중앙값으로 재정렬.
- **C. 2-of-3 consensus** — Top-8 지지 사수 desc → Top-12 지지 사수 desc → 원점수 desc 순으로 정렬(다수결 우선, 원점수는 동점 타파용).
- **D. rank aggregation(Borda)** — 3사(또는 2사) 순위의 합(낮을수록 좋음)으로 재정렬. 표준 랭크합산 방식.

**Top 8 비교:**

| 방식 | Top 8 |
|---|---|
| A 현행 | demo_astronaut, **demo_artisan[2-judge]**, demo_duel, A02_fabric, A06_splash, A12_mech, tk_render_1, cf_soira |
| B median | demo_astronaut, A06_splash, **demo_artisan[2-judge]**, A02_fabric, demo_duel, cf_soira, A12_mech, A14_solo |
| C 2-of-3 | demo_duel, demo_astronaut, A02_fabric, A06_splash, A12_mech, cf_soira, **demo_artisan[2-judge]**, A14_solo |
| D borda | **demo_artisan[2-judge]**, demo_duel, demo_astronaut, A02_fabric, A14_solo, A06_splash, cf_lumea, demo_sf |

교집합: A∩B=7/8, A∩C=7/8, A∩D=5/8, **B∩C=8/8(완전 일치)**, B∩D=6/8, C∩D=6/8.
**4방식 공통 = 5/8**: demo_astronaut, demo_artisan, demo_duel, A02_fabric, A06_splash.

**median과 2-of-3 consensus는 Top8이 완전히 같다** — 이 데이터에서는 "중앙값으로 정렬"과
"다수결 지지로 정렬"이 사실상 같은 답을 낸다. **현행(원점수 평균)과 Borda가 가장 차이가 크다**
(A∩D=5/8) — 원점수 평균은 한 모델이 극단값을 줘도 그 값 자체가 평균에 그대로 들어가는 반면,
Borda는 순위만 보므로 극단값의 절대크기가 무뎌진다. 실제로 TK Studio render 1(현행 #7)이
Borda에서는 #9로, cf_soira(현행 #8)가 Borda #13으로 밀려난다 — **모두 2-judge가 아닌 정상
3-judge 항목인데도 방식에 따라 Top8 안팎이 갈린다.**

## ⑤ Consensus 등급 (임계값: 쌍별 순위차 ≤5 = "가깝다")

| 등급 | 정의 | 편수 |
|---|---|---|
| High | 3사 쌍 3개 전부 가까움(≤5) | 4 |
| 2-of-3 | 3사 쌍 중 1개 이상 가까움, 전부는 아님 | 26 |
| Low | 3사 쌍 전부 안 가까움(셋이 다 다름) | 11 |
| High(2-judge) | 2사만, 그 둘이 가까움 | 1 (cf_novya) |
| Low(2-judge) | 2사만, 그 둘도 안 가까움 | 1 (**The Potter's Hands** — claude#1 vs gpt#9, 3사 완전판이었다면 더 벌어졌을 수도 있음) |

**High 등급 4편** — 3사가 실제로 "비슷하게" 본 것:
- Weightless Duel (4/7/7) — 최상위권에서 3사 합의
- A01_fashion_wearable (23/22/21) — 중위권에서 합의
- **A18_cities (42/42/38)** — 하위권 합의
- **Z01_table (36/39/41)** — 하위권 합의 (단, ①에서 이미 봤듯 Z01은 low-intent 축 설계는 맞았지만 43위 중에서도 최하위 근처에서 3사가 실제로 뜻을 같이한 몇 안 되는 사례)

**Low 11편**은 전부 위 ②의 spread 상위권과 겹친다(cf_eclare, Anne/cf_aquelle, A04/A05_plating,
face-consistency 픽스처, A11_night, A16_crowd, A08_dessert, A19_sunrise, A09_race) — **26편(60%)이
"2-of-3"에 몰려 있다는 것 자체가, 이 43편 세트에서 3사가 완전히 같은 의견이거나 완전히 다른
의견인 경우는 드물고, 대개 "두 회사는 비슷하게 보고 한 회사만 어긋난다"가 기본값이라는 뜻.**

---
원자료: `oxxovo-scoring/reports/mock_prelim_consensus_2026-09-05.json` (①②③④⑤ 전 항목의 43편 전체 원본 배열 포함)
