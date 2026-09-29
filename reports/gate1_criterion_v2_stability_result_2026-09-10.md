# Gate 1C v2 — 안정성 결과 (864/864, 2026-09-10)

864/864 완료, 에러 0. 실비용: 780콜분 + Grok 재시도분(OpenRouter 잔액 소진→충전
후 재개) 합산. 원자료: `oxxovo-scoring/reports/gate1_criterion_v2_full_2026-09-10.json`.

## ①② 모델 × 축 — 역전 안정성 / 반복 안정성 (합치지 않음)

| 모델 | 축 | 역전 안정성 | 반복 안정성 | NO MATERIAL DIFF 비율 |
|---|---|---|---|---|
| Claude | Execution | 83%(20/24) | 96%(23/24) | 0% |
| Claude | Creative Direction | 79%(19/24) | 96%(23/24) | 3% |
| Claude | Originality | 83%(20/24) | 100%(24/24) | 14% |
| Astra | Execution | 92%(22/24) | 88%(21/24) | 7% |
| Astra | Creative Direction | 75%(18/24) | 96%(23/24) | 11% |
| Astra | Originality | 79%(19/24) | 75%(18/24) | **57%** |
| Gemini | Execution | 88%(21/24) | 96%(23/24) | 0% |
| Gemini | Creative Direction | 88%(21/24) | 96%(23/24) | 4% |
| Gemini | Originality | 75%(18/24) | 71%(17/24) | 24% |
| **Grok** | **Execution** | **⚠️54%(13/24)** | 88%(21/24) | 3% |
| Grok | Creative Direction | 75%(18/24) | 79%(19/24) | 15% |
| Grok | Originality | 79%(19/24) | 88%(21/24) | 40% |

**전체 역전 안정성 79.2%(228/288), 전체 반복 안정성 88.9%(256/288)** — 단,
본부 지시대로 이 전체 숫자는 참고용일 뿐 모델×축이 진짜 단위다.

## ⚠️ 가장 중요한 단일 발견: Grok의 Execution 역전 안정성이 54%로 우연 수준

**11/24가 뒤집혔고, 확인 가능한 10건(1건은 NO_DIFF라 제외) 전부 raw 위치
("Clip 1"/"Clip 2")가 두 라운드에서 그대로 유지되는 패턴**이었다 —
9/10 Grok Sol 위치편향과 완전히 동일 패턴(2026-09-10 앞서 발견한 GPT-5.6
Sol의 위치편향과 판박이). **Execution 축에서만 이런다** — Grok의 CD·
Originality는 75~79%로 다른 모델과 비슷한 범위다. Grok Execution 단독으로
Primary 후보에서 재검토가 필요해 보인다(판단은 대표님).

## 부가 관찰(요청 밖이지만 중요)

- **Low confidence는 Claude에 극단적으로 몰려 있다**(55건 중 54건이 Claude,
  나머지 모델 전부 합쳐 1건). 다른 모델이 과신하는 건지 Claude가 더 정직하게
  캘리브레이션된 건지는 이 데이터만으론 판단 불가.
- **NO MATERIAL DIFFERENCE 사용률이 모델마다 극단적으로 다르다**: Astra는
  Originality의 57%를 "차이없음"으로 답했다(모델 중 최고), Claude는 Exec·CD에서
  거의 안 씀(0~3%). 이건 "누가 더 정직하게 애매함을 인정하는가"의 신호일 수도,
  "누가 판단을 회피하는가"의 신호일 수도 있다 — 해석은 대표님 몫으로 둔다.

## 사람이 볼 것 (본부 지시 ① — 자동집계 외 표본만)

- **역전 불일치 60건** — 모델별: astra13·claude13·gemini12·grok22(Grok 압도적).
- **반복 불일치 32건** — 모델별: astra10·claude2·gemini9·grok11(Claude가 가장
  안정).
- **Low confidence 55건** — 위 언급대로 54건이 Claude.
- **무작위 표본**: 필요시 원자료 파일에서 바로 추출 가능(863개 레코드 전부
  pairId/model/axis/round로 인덱싱돼 있음) — 요청 주시면 특정 조합 즉시 확인
  가능.

## 결론(판단은 대표님)

Gate 1C(Full validation)의 두 안정성 지표 자체는 대체로 양호(반복 89%,
역전 79%)하지만, **Grok Execution 하나가 우연 수준(54%)으로 떨어져 있고
그 원인이 Sol과 동일한 순수 위치편향으로 확인**됐다. 이 결과를 반영해
Primary 3 + Reserve 선정을 진행하실 때 Grok의 Execution 축 신뢰도를 따로
고려하시는 게 좋을 것 같습니다.
