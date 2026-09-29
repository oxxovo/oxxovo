# Gate 1 — 보충 11쌍 2차 검수 대조 (2026-09-10)

## ② 기존 Core 30쌍 2차 검수(batch1/batch2) 오염 여부 점검 — 한 줄 답

**오염 안 됨(신뢰 근거: 자체 명시된 방법론 + 정황 일치).** batch1/batch2 리포트 본문에
"no prior scores or other reviewer's notes were consulted"(batch1), "No prior-reviewer
opinions or AI scores were consulted"(batch2)라고 명시돼 있고, batch1은 "동시에 공용
scratch 폴더를 쓰던 별도 프로세스와 섞이지 않도록 독립 서브폴더에 프레임을 뽑았다"는
오염 방지 조치까지 기록돼 있음. 결정적 정황: batch1 Pair 4·5, batch2 Pair 22가 "too
close to call / 구분 못함"으로 판정됐고, 이 3쌍은 실제로 최종 대조표에서 전부 **폐기**
처리됨(Pair 4→폐기, Pair 5→폐기, Pair 22→폐기) — 오염된(마이닝 의견을 알고 있는)
리뷰어라면 나오기 어려운 "모르겠다" 응답이 실제 결과와 정확히 들어맞음.
**단, 이건 산출물 자체의 정황 증거이지, 그 세션에서 실제로 어떤 프롬프트를 그
에이전트에게 줬는지 원문을 이번 세션에서 직접 확인한 것은 아님** — 100% 보증은 아니고
"오염 정황 없음"까지가 제가 확인할 수 있는 선입니다.

## ① 어제 재발주 건 — 완료 여부

**완료.** 단, 완료 과정에서 사고가 하나 있었습니다: 4쌍(CD Pair 2~5, 아래 표의 8~11번)을
제가 먼저 직접 판단했는데, 이미 이 세션에서 마이닝 리포트(1차 의견)를 읽은 뒤였다는 걸
뒤늦게 알아채 **그 판단 전부 폐기**하고, 사전 컨텍스트가 전혀 없는 새 서브에이전트에게
프레임 이미지만 줘서 다시 블라인드로 받았습니다. 아래 표는 전부 그 결과 기준입니다.

## ③ Pair별 5열 대조표 (11쌍 전체)

| # | Pair (A vs B) | 축 | 방향 일치 | Primary axis 일치 | Confidence (마이닝 / 블라인드) | 타축 오염 섞임 | 출처 |
|---|---|---|---|---|---|---|---|
| 1 | Z01_table vs A04_morph | Originality | ✅ B | ✅ | High / High | 마이닝이 중간 모델교체 구간을 "결함 아님"으로 자진 flag(블라인드는 언급 자체 없음) — 판정엔 영향 없음 | promo content_video (Z01=합성 QA fixture) |
| 2 | A18_cities vs tk_render_1 | Originality | ✅ B | ✅ | High / High | 마이닝이 소소한 Execution 흠(광선 각도) 1건 자진 flag, 비중대로 판단 — 블라인드는 언급 없음 | promo content_video vs Studio/TK 렌더(season_test) |
| 3 | A16_crowd vs A14_solo | Originality | ✅ B | ✅ | Medium-High / Medium-High | 없음 | promo content_video 둘 다 |
| 4 | aquelle vs noira | Originality | ✅ B | ✅ | Medium-High / **High** | 없음 | cf/v3 둘 다 |
| 5 | A06_splash vs A02_fabric | Originality | ✅ B | ✅ | Medium-High / **High** | 없음 | promo content_video 둘 다 |
| 6 | A01_fashion vs A03_street | Originality | ✅ B | ✅ | Medium-High / **Medium** | 없음 | promo content_video 둘 다 |
| 7 | A18_cities vs A02_fabric | Creative Direction | ✅ B | ✅ | High / High | 없음 | promo content_video 둘 다 |
| 8 | A13_group vs demo_duel | Creative Direction | ❌ **불일치** (마이닝=B / 블라인드=A) | — | High / High | 없음(양쪽 다 순수 CD 근거, 결함 언급 없음 — 축 오염이 아니라 순수 취향/판단 차) | promo content_video vs watch_demo(season_test) |
| 9 | A07_cooking vs A12_mech | Creative Direction | ✅ B | ✅ | Medium-High / Medium-High | 없음 | promo content_video 둘 다 |
| 10 | A20_culture vs demo_artisan | Creative Direction | ✅ B | ✅ | **High / Medium** (격차 큼) | 없음 | promo content_video vs watch_demo(season_test) |
| 11 | Z03_studio vs lumea | Creative Direction | ✅ B | ✅ | Medium-High / **High** | 없음 | promo content_video (Z03=합성 QA fixture) vs cf/v3 |

**⚠️ Pair 8은 방향 자체가 갈렸습니다 — 확정 절차대로면 TK 판정(Benchmark Release
Auditor) 대상입니다.** 원래 Pair 11(Z01_table vs A08_dessert)처럼 축간 trade-off가
아니라, 순수하게 같은 축(CD) 안에서 "어느 쪽이 더 낫다"는 취향/체급 차이로 갈렸습니다
— A는 라이브 댄스 퍼포먼스로서 조명·구도가 한 번도 안 끊기는 단일체(그러나 장르
자체는 흔함), B는 스토리 상승은 있지만 여러 VFX 컷의 이질감이 있는 편이라는 게
양쪽 리뷰어가 갈린 지점입니다. **지수가 단독으로 방향을 정하지 않습니다 — 대표님
판정 대기.**

Pair 10은 방향은 일치하지만 confidence 격차가 큽니다(High→Medium) — 채택 기준이
"high/medium-high만"이었던 원래 목표 밴드 바로 경계에 있어 참고로 같이 보고합니다
(폐기 대상은 아니고, 방향 불일치도 아니므로 자동 탈락 사유는 아닙니다).

## 최종 결합 표 (Core 20 + 보충 채택분) — 축별 confidence 분포

**Core 20 (2026-09-09 동결, 기존 그대로):**

| 축 | High | Medium-High | Medium | 합계 |
|---|---|---|---|---|
| Execution | 5 | 1 | 4 | 10 |
| Creative Direction | 1 | 2 | 6 | 9 |
| Originality | 0 | 0 | 1 | 1 |
| **합계** | **6** | **3** | **11** | **20** |

⚠️ **기존 문서 표기 오류 발견**: `gate1_pair_reconciliation_2026-09-09.md`의 요약 줄은
"Execution 9 · Creative Direction 10"이라고 적혀 있는데, 같은 문서의 표 20행을 직접
세어보면 **Execution 10 · Creative Direction 9**입니다(Pair 17이 Execution으로
기재돼 있음). 표(원자료)를 기준으로 위 수치를 냈습니다 — 대표님 확인 부탁드립니다.

**보충 채택분(Pair 8 제외, TK 판정 대기 중이라 잠정):**

| 축 | High | Medium-High | Medium | 합계 |
|---|---|---|---|---|
| Originality | 2 (#1,2)* | — | — | 6 |
| Creative Direction | — | — | — | 4 (Pair 8 제외) |

\* Originality 6쌍의 confidence는 마이닝/블라인드가 갈려서(위 표 참고) 단일 숫자로
못 줄입니다 — 어느 쪽 값을 채택 기준으로 쓸지(마이닝? 블라인드? 더 낮은 쪽?)도
지수가 단독 결정하지 않는 게 맞다고 판단해 비워뒀습니다. 방향 판정 규칙(일치=채택)은
있지만 confidence 값 자체를 reconciled하는 규칙은 아직 없어서, Core 20 때 실제로
어떤 규칙을 썼는지부터 확인 후 같은 규칙을 적용하는 게 맞을 것 같습니다.

**Core 20 + 보충 채택분(Pair 8 제외 10쌍) 합계 = 30쌍**, 축 분포:
Execution 10 · Creative Direction 13(9+4) · Originality 7(1+6).
Pair 8이 A(A13_group) 방향으로 판정 나면 CD 대신 여전히 CD(반대 승자), B 방향이면
그대로 CD — 어느 쪽이든 축 분포에는 영향 없음(둘 다 CD 쌍).

## 다음 필요한 것

1. **Pair 8 방향 판정** — 대표님(Benchmark Release Auditor).
2. **Confidence 값 reconciliation 규칙** — Core 20 만들 때 마이닝/블라인드 confidence가
   갈린 경우 어떤 규칙을 썼는지 확인 필요(제가 그 정확한 원 프롬프트/처리 기록을
   이번 세션에서 직접 보지 못했습니다).
3. Pair 17 축 표기(Execution vs 요약 줄의 불일치) 확인.
4. ⛔ Gate 1 실제 실행(6모델 유료 호출)은 여전히 HOLD — 위 항목 정리 전까지 시작 안 함.
