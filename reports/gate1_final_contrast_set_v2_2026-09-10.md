# Gate 1 — Final Contrast Set v2 (LOCKED) — 2026-09-10

Supersedes `gate1_final_contrast_set_locked_2026-09-10.md` (v1). 본부 판정: v1은
"깨끗하지 않다" — v2에서 원본 통합·재사용 상한·역할 기록·30쌍 강박 해제를 반영.

## ① 동일 원본 통합 ID

| 통합 ID | 구성 파일명 |
|---|---|
| **POTTER** | GT01_clean_a, demo_artisan (동일 도공 영상, 트림만 다름) |
| **SILK** | GT02_clean_b, A02_fabric (동일 마젠타 실크 영상, 트림만 다름) |

이하 모든 표/카운트는 이 통합 ID 기준.

## ② 원본당 Core 상한 2 적용 — 무엇을 뺐나

| 원본 | 통합 전 횟수 | 조치 | 남긴 것(confidence 순) | 뺀 것 |
|---|---|---|---|---|
| **POTTER** | 5 | 5→2 | #1(High), #10(High) | #2(Med-High), #30(Medium), S-C3(Medium) |
| **SILK** | 3 | 3→2 | S-C1(High), S-O5(Medium-High) | #3(Medium-High) — Execution축은 이미 표본 많아 tie-break에서 제외 |
| Z03_studio | 3 | 3→2 | #8(Med-High), S-C4(Med-High) | #9(Medium) |
| A14_solo | 3 | 3→2 | S-O3(Medium-High), #18(Medium, mining/blind 완전일치라 노이즈 적음) | #6(Medium, mining High/blind Medium — 2단계 격차로 더 시끄러운 신호) |

그 외(A13_group, demo_ichar, A09_race, noira, A16_crowd, demo_duel, A18_cities,
A01_fashion)는 이미 ≤2라 추가 조치 없음.

**Tie-break 규칙(투명 공개)**: confidence 동률이면 ①mining-blind 격차가 작은
쪽(더 조용한 신호) 우선 → 그래도 동률이면 ②상대적으로 더 희귀한 축(Originality>
Creative Direction>Execution 순으로 보호) 우선. 이 규칙 두 곳에 적용, 위 표에 이유
명시.

## ③ 역할(승자/패자) 기록 — 편향 확인

| 원본 | 남은 역할 | 비고 |
|---|---|---|
| POTTER | 승자×2 (#1, #10) | ⚠️구조적으로 패자 사례 불가 — GT01/demo_artisan은 애초에 "클린 앵커"로만 마이닝됨 |
| SILK | 승자×2 (S-C1, S-O5) | ⚠️동일하게 구조적 승자 전용 |
| Z03_studio | 패자×2 (#8, S-C4) | ⚠️설계된 low-consistency 픽스처라 승자 사례 불가 |
| A14_solo | 승자×2 (S-O3, #18) | ⚠️승자 전용 |
| A13_group | 패자×2 (#18, #28) | 패자 전용 |
| A09_race | 패자×2 (#19, #20) | 패자 전용 |
| noira | 승자×2 (#23, S-O4) | 승자 전용 |
| A18_cities | 패자×2 (S-O2, S-C1) | 패자 전용 |
| A01_fashion | 패자×2 (#17, S-O6) | 패자 전용 |
| demo_duel | 승자×2 (#16, #26) | 승자 전용 |
| **A16_crowd** | **승자×1 + 패자×1** (#28=승자, S-O3=패자) | ✅ 유일하게 역할이 섞인 케이스 |

**정직한 결론**: 이 원본 자산 풀 자체가 "설계된 클린 앵커(POTTER/SILK/A14_solo/
noira/demo_duel)"와 "설계된 결함 앵커(Z03_studio/A13_group/A09_race/A18_cities/
A01_fashion)"로 나뉘어 있어서, 대부분 원본이 한 방향 역할로 마이닝됐다 — 이번
라운드에서 역할을 섞을 방법이 없다(억지로 반대 역할을 만들면 그 자체가 새로운
왜곡). A16_crowd 하나만 우연히 양쪽 역할이 있다.

## ④ "30쌍" 강박 해제 — 최종 24쌍

②의 원본 상한 적용만으로 30→24 (6쌍 제거: #2,#3,#6,#9,#30,S-C3)로 자연스럽게
줄었고, 이는 본부가 제시한 22-26 범위 안에 들어온다. 확인 결과 남은 24쌍 중
confidence Low는 0건, "억지로 더 뺄 약한 pair"는 없다고 판단 — 추가 삭제 없음.

## 최종 24쌍 표

| Pair | A | B | Winner | Axis | Final Conf |
|---|---|---|---|---|---|
| #1 | GT19_anatomy_object1 | POTTER | B | Execution | High |
| #7 | A07_cooking | A08_dessert | B | Execution | Medium |
| #8 | Z03_studio | aurelie | B | Execution | Medium-High |
| #10 | POTTER | GT21_anatomy_object3 | A | Execution | High |
| #14 | novya | tk_render_2 | B | Creative Direction | Medium |
| #16 | demo_ichar | demo_duel | B | Creative Direction | Medium |
| #17 | A01_fashion | A01_fashion_wearable | B | Execution | Medium |
| #18 | A13_group | A14_solo | B | Creative Direction | Medium |
| #19 | A09_race | A10_drift | B | Creative Direction | Medium |
| #20 | A09_race | A11_night | B | Creative Direction | Medium |
| #21 | bloomix | eclare | B | Creative Direction | Medium |
| #23 | velix | noira | B | Originality | Medium |
| #26 | demo_sf | demo_duel | B | Creative Direction | Medium |
| #28 | A13_group | A16_crowd | B | Creative Direction | Medium |
| #29 | demo_consistency | demo_astronaut | B | Execution | Medium |
| S-O1 | Z01_table | A04_morph | B | Originality | High |
| S-O2 | A18_cities | tk_render_1 | B | Originality | High |
| S-O3 | A16_crowd | A14_solo | B | Originality | Medium-High |
| S-O4 | aquelle | noira | B | Originality | Medium-High |
| S-O5 | A06_splash | SILK | B | Originality | Medium-High |
| S-O6 | A01_fashion | A03_street | B | Originality | Medium |
| S-C1 | A18_cities | SILK | B | Creative Direction | High |
| S-C2 | A07_cooking | A12_mech | B | Creative Direction | Medium-High |
| S-C4 | Z03_studio | lumea | B | Creative Direction | Medium-High |

## 재검산 — 축 × Confidence (24쌍)

| 축 | High | Medium-High | Medium | 합계 |
|---|---|---|---|---|
| Execution | 2 (#1,#10) | 1 (#8) | 3 (#7,#17,#29) | **6** |
| Creative Direction | 1 (S-C1) | 2 (S-C2,S-C4) | 8 (#14,16,18,19,20,21,26,28) | **11** |
| Originality | 2 (S-O1,S-O2) | 3 (S-O3,S-O4,S-O5) | 2 (#23,S-O6) | **7** |
| **합계** | **5** | **6** | **13** | **24** |

## ⑤ CD 추가 마이닝 — 결과: 없음 (억지로 넣지 않음)

미사용 풀에서 유력해 보이는 후보 하나를 찾았다: Z02_dusk(다장소·다분위기 몽타주)
vs A19_sunrise(단일 연속 푸시인). 제 마이닝 의견 = **B(A19_sunrise) 우세, High**.
완전 사전정보 없는 새 서브에이전트로 블라인드 검증한 결과 = **A(Z02_dusk) 우세,
Medium-High** — **방향이 정반대로 갈렸다.** Boundary-3(Pair 8)와 정확히 같은
패턴: "명백한 CD contrast"를 표방한 후보인데 두 독립 판단이 다 성립해버림 —
이 조합 자체가 실격이다(min() 적용 이전에, 방향 불일치라 애초에 채택 대상이 아님).

**결론: 이번 라운드에서 교체 가능한 High/Medium-High CD 후보를 찾지 못했다.**
이 실패 자체가 유익한 신호였다 — 마이닝 1인 의견만으로는 "명백해 보이는" 후보도
실제로는 안 명백할 수 있다는 걸 재확인. 더 찾지 않는다(지시대로 "한 번만").
**CD축의 8개 Medium 슬롯은 그대로 둔다** — 위조/교체 없이 24쌍 확정.

**Boundary-4 (신규)**: Z02_dusk vs A19_sunrise — 방향 불일치(마이닝 B/블라인드 A),
CD 후보 폐기, Gate 1 세트에 포함 안 함. 기록만 보존(향후 Gate 3 등 다른 용도 후보).

## ⑥ Confidence 공식 확정 반영

전부 `final = min(mining, blind)`, 과거 표기값은 전량 폐기하고 이 문서의 값만 유효.

⛔ 유료 호출 없음. 진행 중.
