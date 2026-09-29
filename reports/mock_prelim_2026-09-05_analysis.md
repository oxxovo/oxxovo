# 모의예선 분석 — 2026-09-05

43편(A22+Z01~03+cf/v3 9+watch_demo 7+TK Studio 2), Rubric v2(2026-09-02 고문 반영판), Quality만
(Compliance/Integrity 제외), temp 0, EN only. DB 쓰기 0건, season_test는 배점 컬럼만 읽음.
실지출 **$6.59** (추정 $8 이내). 원본: `oxxovo-scoring/reports/mock_prelim_2026-09-05_2026-09-05_1834.json`.

세트 구성 근거(전부 이번 세션 실측, 추측 아님): A=promo_videos EN "A시즌주제" 22편 전량,
cf/v3=e2e/lib.mjs MAIN_CFS 중 cf_01~09, watch_demo=`_watch_demo_insert.mjs` 6편(진짜 자기소개
있음)+demo_consistency 1편(출처 불명, R2 생존만 확인), TK Studio=render_jobs(user=TK) 11행 중
서로 다른 source_job_ids 계열 2개 각 최신 1편.

★자기소개 빈 편 처리(본부가 먼저 답하라고 한 것): 43편 중 37편(A 22+cf/v3 9+TK 2+watch_demo 1
+Z01~03 3 — Z는 season_test 공유 무의미 고정문)이 애초에 참가자 자기소개가 없다. 빈 문자열을
그대로 프롬프트에 넣으면(`Creator Statement: ""`) 6번 사례처럼 모델이 흔들릴 위험이 있어, 빈
값·무의미 고정문 전부를 "자기소개 없음 — 있고 없음으로 가점/감점 금지"라는 중립 문구로 치환.

---

## ① Z01~Z03 위치

| | Triple-AI 순위 | verified |
|---|---|---|
| Z01_table (low-intent) | **43/43 (꼴찌)** | 61.83 |
| Z02_dusk (low-execution) | 39/43 | 67.88 |
| Z03_studio (low-consistency) | 36/43 | 70.58 |

셋 다 하위권으로 갔지만 한 덩어리는 아니다 — Z01만 명확한 꼴찌, Z02/Z03은 하위 1/3 정도.
**A18_cities(41위)·A15_rhythm(42위)는 Z02/Z03보다도 낮다** — 실제 진짜 콘텐츠 2편이 일부러
망가뜨린 QA 픽스처보다 더 낮은 점수를 받았다.

## ② 셋이 설계대로 다른 축에서 떨어졌나 — 부분만 맞음

| | intentClarity pct | execution pct | subjectConsistency pct | 설계대로? |
|---|---|---|---|---|
| Z01(low-intent) | **2%** | 16% | 88% | ✅ 정확히 의도한 축(Creative Direction 최하위권) |
| Z02(low-execution) | 26% | **7%** | 23% | ✅ 정확히 의도한 축(Execution 최하위권) |
| Z03(low-consistency) | **5%** | 74% | 67% | ❌ **설계 실패** |

Z03은 "인물 일관성이 나빠 Execution/subjectConsistency가 낮을 것"이라는 설계였는데, 실측은
정반대다 — Execution(74%ile)도 subjectConsistency(67%ile)도 오히려 평균 이상. Z03이 하위권으로
간 진짜 이유는 **의도하지 않은 축, intentClarity(5%ile)**다. Rubric v2는 "인물 일관성이 나쁘다"는
결함을 Execution 축으로 못 잡고, 대신 그 영상을 "기획력이 없다"고 읽었다 — 3편이 3축에서
각각 갈리는지 보려던 이번 시험의 ②번 질문 자체가, Z03에 한해 설계-실측 불일치로 답이 나왔다.

## ③ 점수 분포 — 매우 좁게 뭉쳐 있다

Triple-AI verified: **min 61.83 ~ max 79.53, 폭 17.7점.** 43편 중 30편(70%)이 72~78 사이 6점
띠 안에 몰려 있다.

```
[60,62) # (1)
[62,64)   (0)
[64,66) ## (2)
[66,68) ## (2)
[68,70) # (1)
[70,72) #### (4)
[72,74) ########### (11)
[74,76) ########## (10)
[76,78) ######### (9)
[78,80) ### (3)
```

모델별 자체 가중점수(own-score, CD*.30+EX*.45+OR*.25)는 서로 완전히 다른 스케일을 쓴다:

- **Claude**: 37.9~72.8 (가장 넓고 낮음 — 유일하게 40점대·70점대를 다 씀)
- **GPT**: 71.6~87.8 (매우 좁음, 38/43편이 80대에 몰림 — 사실상 변별력 거의 없음)
- **Gemini**: 55.0~87.8 (한 편만 저점 이탈, 나머지는 70후반~80대에 몰림)

**Claude만 진짜 넓은 분포를 쓰고, GPT/Gemini는 사실상 "80점대냐 아니냐"로 수렴한다.**

## ④ 3사 Top 8 겹침 — 거의 안 겹친다

- claude∩gpt = 3/8
- claude∩gemini = 4/8
- **gpt∩gemini = 1/8**
- **3사 공통 = 1/8** (Weightless Duel 하나뿐)

GPT Top8: A02_fabric, A06_splash, A19_sunrise, A08_dessert, A14_solo, demo_consistency, demo_duel, demo_sf
Gemini Top8: cf_eclare, demo_astronaut, cf_soira, cf_velix, cf_lumea, cf_aquelle, demo_duel, A12_mech
Claude Top8: demo_artisan, demo_astronaut, A06_splash, demo_duel, A12_mech, A02_fabric, cf_soira, tk_render_1

GPT는 A-풀(홍보영상)을 편애하고, Gemini는 cf/v3(프리미엄 CF)를 편애한다 — 두 모델이 점수
스케일은 비슷해도(③) **"뭐가 최고냐"는 거의 딴 얘기를 한다.**

## ⑤ 7~12위 경계 — 불안정하다

| Triple# | 작품 | claude# | gpt# | gemini# | spread |
|---|---|---|---|---|---|
| 7 | TK Studio render 1 | 8 | 16 | 16 | 8 |
| 8 | cf_soira | 7 | **34** | **3** | **31** |
| 9 | cf_lumea | 16 | 13 | 5 | 11 |
| 10 | A14_solo | 10 | 5 | 15 | 10 |
| 11 | Reentry | 14 | 8 | 12 | 6 |
| 12 | cf_eclare | **25** | 15 | **1** | **24** |

경계 세트 자체도 안 겹친다 — Triple-AI 7~12위 집합과 개별 모델의 자기 7~12위 집합 overlap:
claude 3/6, gpt 1/6, gemini 1/6. **"7~12위"는 3사 평균이라는 인공물일 뿐, 어느 한 회사만
썼다면 완전히 다른 6편이 그 자리에 왔을 것.**

## ⑥ 근거 텍스트 반복 비율 — GPT만 확연히 높다

| 모델 | 총 문장 | 2회+ 등장 인스턴스 | 반복비율 |
|---|---|---|---|
| Claude | 1723 | 22 | **1.3%** |
| Gemini | 1645 | 47 | **2.9%** |
| **GPT** | 840 | 201 | **23.9%** |

GPT는 문장 수 자체도 절반(840 vs 1650대)이고, 그나마도 "clean visuals"(18회) ·
"smooth motion"(16회) · "lack of narrative progression"(15회) · "abrupt transitions"(14회)
같은 정형 문구가 서로 무관한 영상들에 반복적으로 등장한다 — 근거가 영상별로 쓰인 게 아니라
템플릿에 가깝다. Claude/Gemini는 편당 근거가 대체로 그 영상 고유의 문장이다.

## ⑦ TK Studio 렌더 2편 위치

- TK Studio render 1: **7/43위 (상위 16%)**, verified 77.02
- TK Studio render 2: **13/43위 (상위 30%)**, verified 75.90

둘 다 상위~중상위권. 픽스처가 아니라 실제 완성도 있는 Studio 산출물답게, 이상 없이 상식적인
위치에 왔다.

---

## 부수 발견 — 벤더 신뢰성 문제 (묻지 않았지만 보고)

Gemini가 **cf_novya**를 `PROHIBITED_CONTENT`로 두 번 연속(재시도 포함) 거부했다(temp 0에서도
결정적). 정상적인 홍보 콘텐츠 영상인데 채점 자체를 거부한 것 — 위 표에서 cf_novya·demo_artisan
(Gemini 503 일시 오류) 두 편은 Gemini 없이 Claude+GPT 2사 평균으로 대체 채점했다. "3사 중
한 곳이 아예 채점을 거부할 수 있다"는 것 자체가 실전 파이프라인이 대비해야 할 결함 후보.

---

## 결과표 — 43편 전체 (Triple-AI 순위순)

| # | 작품 | 그룹 | GPT | Gemini | Claude | verified |
|---|---|---|---|---|---|---|
| 1 | A Day in Orbit | WD | 18 | 2 | 2 | 79.53 |
| 2 | The Potter's Hands | WD | 9 | n/a | 1 | 79.40 |
| 3 | Weightless Duel | WD | 7 | 7 | 4 | 78.67 |
| 4 | A02_fabric | A | 1 | 22 | 6 | 77.92 |
| 5 | A06_splash | A | 2 | 26 | 3 | 77.67 |
| 6 | A12_mech | A | 29 | 8 | 5 | 77.07 |
| 7 | TK Studio render 1 | TK | 16 | 16 | 8 | 77.02 |
| 8 | cf_soira | CF | 34 | 3 | 7 | 76.70 |
| 9 | cf_lumea | CF | 13 | 5 | 16 | 76.57 |
| 10 | A14_solo | A | 5 | 15 | 10 | 76.47 |
| 11 | Reentry | WD | 8 | 12 | 14 | 76.17 |
| 12 | cf_eclare | CF | 15 | 1 | 25 | 76.07 |
| 13 | TK Studio render 2 | TK | 11 | 17 | 15 | 75.90 |
| 14 | cf_noira | CF | 20 | 11 | 22 | 75.57 |
| 15 | Anne, in the Park | WD | 19 | 13 | 27 | 75.05 |
| 16 | cf_aquelle | CF | 14 | 6 | 33 | 74.92 |
| 17 | A10_drift | A | 25 | 24 | 11 | 74.78 |
| 18 | A01_fashion_wearable | A | 22 | 21 | 23 | 74.65 |
| 19 | A04_morph | A | 31 | 9 | 24 | 74.60 |
| 20 | A05_plating | A | 32 | 18 | 12 | 74.60 |
| 21 | cf_bloomix | CF | 17 | 20 | 30 | 74.40 |
| 22 | A20_culture | A | 24 | 27 | 19 | 74.12 |
| 23 | A01_fashion_fusion | A | 21 | 23 | 29 | 73.90 |
| 24 | demo_consistency (untitled) | WD | 6 | 19 | 39 | 73.72 |
| 25 | cf_velix | CF | 35 | 4 | 35 | 73.72 |
| 26 | Her Walk | WD | 10 | 28 | 31 | 73.58 |
| 27 | A11_night | A | 28 | 10 | 37 | 73.53 |
| 28 | A16_crowd | A | 12 | 33 | 18 | 73.33 |
| 29 | A03_street | A | 27 | 30 | 17 | 72.93 |
| 30 | A07_cooking | A | 36 | 14 | 38 | 72.57 |
| 31 | A08_dessert | A | 4 | 36 | 21 | 72.57 |
| 32 | A19_sunrise | A | 3 | 31 | 40 | 72.13 |
| 33 | A09_race | A | 26 | 39 | 9 | 72.00 |
| 34 | A01_fashion | A | 30 | 34 | 20 | 71.75 |
| 35 | A17_vista | A | 41 | 25 | 26 | 71.58 |
| 36 | Z03_studio (low-consistency) | Z | 38 | 37 | 13 | 70.58 |
| 37 | cf_aurelie | CF | 23 | 40 | 28 | 70.13 |
| 38 | A13_group | A | 37 | 29 | 41 | 69.23 |
| 39 | Z02_dusk (low-execution) | Z | 43 | 32 | 32 | 67.88 |
| 40 | cf_novya | CF | 33 | n/a | 34 | 67.30 |
| 41 | A18_cities | A | 42 | 38 | 42 | 64.97 |
| 42 | A15_rhythm | A | 40 | 35 | 43 | 64.15 |
| 43 | Z01_table (low-intent) | Z | 39 | 41 | 36 | 61.83 |

(n/a = Gemini가 이 편을 거부/오류로 채점 못함, Claude+GPT 2사 평균으로 대체)

원본 데이터: `oxxovo-scoring/reports/mock_prelim_2026-09-05_2026-09-05_1834.json`
분석 스크립트: `oxxovo-scoring/_analyze_mock_prelim_2026-09-05.cjs`
하니스: `oxxovo-scoring/_probe_mock_prelim_2026-09-05.ts`
