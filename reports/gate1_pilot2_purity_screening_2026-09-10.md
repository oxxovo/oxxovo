# Pilot 2 — 축 순도 스크리닝 (2026-09-10)

15개 후보(3종류×5쌍)를 완전 독립된 블라인드 검수 2개에 동시에 보냈다(서로
다른 서브에이전트, 사전정보 0, 서로의 답도 못 봄). 채택 기준(본부 ②):
**두 검수가 "다른 두 축은 실질적으로 비슷하다"에 동의해야 넣는다.**

## 결론 먼저 — 수율이 매우 낮다

15쌍 중 **완전히 깨끗한(순도+방향 둘 다 양쪽 검수 일치) 후보는 1개뿐**이다.
CD-dominant·Execution-dominant는 **완전 일치 후보가 0개**다. 목표(각 3~5쌍)를
채우지 못했다 — 억지로 채우지 않고 있는 그대로 보고한다.

## ✅ 채택(순도+방향 완전 일치)

| # | Pair | 범주 | 두 검수 결과 |
|---|---|---|---|
| 1 | **A17_vista vs A20_culture** | **Originality-dominant** | 둘 다: Execution=비슷, CD=비슷, **Originality=B(A20_culture) 뚜렷이 나음** — 완벽 일치 |

## △ 약한 후보(다른 두 축 "비슷하다"는 일치했으나, 목표축 자체는 한쪽만 감지)

| # | Pair | 범주 | 검수1 | 검수2 |
|---|---|---|---|---|
| 2 | eclare vs velix | Originality-dominant(약) | Exec=비슷,CD=비슷,**Orig=A나음** | Exec=비슷,CD=비슷,**Orig=차이없음** |
| 3 | demo_sf vs demo_duel | CD-dominant(약) | Exec=비슷,Orig=비슷,**CD=B나음** | Exec=비슷,Orig=비슷,**CD=차이없음** |
| 4 | A09_race vs A10_drift | Execution-dominant(약) | CD=비슷,Orig=비슷,**Exec=차이없음** | CD=비슷,Orig=비슷,**Exec=B나음**(스파크 위치) |

이 3개는 본부가 명시한 문구("다른 두 축이 비슷하다는 데 동의")는 기술적으로
충족하지만, 목표 축 자체의 존재 여부에 대해선 검수 2개가 갈렸다 — **채택
기준을 문자 그대로는 통과하지만, 실제로 쓸만한 신호인지는 약하다.**

## ❌ 탈락 — 왜 탈락했는지 (11쌍)

| # | Pair | 탈락 사유 |
|---|---|---|
| 1 | bloomix vs noira | 둘 다 3축 전부 "차이없음" — 애초에 쓸 신호가 없음 |
| 3 | lumea vs bloomix | 위와 동일 |
| 4 | aurelie vs soira | 위와 동일 |
| 5 | aquelle vs eclare | 위와 동일 |
| 6 | A16_crowd vs A20_culture | 둘 다 일치: **CD와 Originality가 동시에, 서로 반대 방향으로** 다름(CD는 A우세, Originality는 B우세) — 축간 trade-off, 순도 실패 |
| 9 | demo_ichar vs demo_duel | 둘 다 일치: CD·Originality **둘 다** B가 나음 — Originality도 같이 움직여서 "CD만" 아님 |
| 10 | Z02_dusk vs A19_sunrise | CD는 둘 다 B우세로 일치하지만, Originality를 검수1=차이없음/검수2=A우세로 불일치 — 순도 미확정. (참고: 이 pair는 이전 CD 추가마이닝 라운드에서도 마이닝의견과 블라인드가 정반대로 갈렸던 바로 그 쌍 — 계속 불안정하다) |
| 12 | A09_race vs A11_night | 두 검수가 사실상 전부 다른 축에서 다른 결론(검수1=CD+Orig 반대방향 trade-off, 검수2=Exec만) — 합의 자체가 없음 |
| 13 | A15_rhythm vs A14_solo | 둘 다 일치: CD·Originality **둘 다** 다름(반대방향 trade-off) — 순도 실패 |
| 14 | A07_cooking vs A12_mech | 검수1=Exec만 다름(순수)이라 봤는데 검수2=CD·Originality도 반대방향으로 다르다고 봄 — 불일치로 탈락 |
| 15 | demo_consistency vs demo_astronaut | 검수1=Exec+CD 둘 다 다름, 검수2=3축 전부 차이없음 — 정반대 결론, 합의 없음 |

## 부가 관찰(요청 범위 밖이지만 중요)

- **"두 축이 서로 반대 방향으로 갈리는 trade-off 패턴"이 15쌍 중 3쌍**
  (#6, #12, #13)에서 나왔다 — 이 자산 풀 자체에 "이야기는 좋은데 소재는
  뻔함" 유형의 실제 창작물이 꽤 있다는 뜻. 순수 단일축 pair를 찾기 어려운
  이유 중 하나.
- CF 뷰티광고 5쌍 중 4쌍(#1,3,4,5)이 **완전히 "차이없음"**으로 나왔다 —
  같은 템플릿 광고들이라 실제로 서로 거의 동급이다. 이 자산군에서 originality
  차이를 찾으려던 가설 자체가 수율이 낮았다.
- 검수1·검수2가 결함 탐지 자체에서도 자주 갈렸다(#11,#13,#14,#15의 Execution
  판정) — 같은 프레임을 보고도 "이게 결함이다/아니다"를 다르게 읽는 경우가
  드물지 않다.

## 제안(결정은 대표님)

1. 이대로면 **Originality-dominant 1(강)+1(약), CD-dominant 0(강)+1(약),
   Execution-dominant 0(강)+1(약)** 뿐이다 — 목표 미달.
2. 선택지: (a) 이 소수로 Pilot 2를 축소해서 진행 / (b) 새 후보를 더 마이닝
   (같은 방식으로 15개 더) / (c) 접근 자체를 재검토(이 자산 풀에서 순수
   단일축 pair를 찾는 게 원래 어려울 수 있음을 인정).
3. 지수 단독으로 (a)(b)(c) 중 고르지 않는다.
