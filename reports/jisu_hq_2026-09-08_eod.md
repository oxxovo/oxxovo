# 지수 본체 EOD — 2026-09-08 (갱신판)

다음 세션은 이 파일 하나만 읽고 재개. ⛔오늘 코드/에셋 전부 **로컬 미커밋·미배포**
(대표님 명시 지시, "고치지 마라·커밋하지 마라·배포하지 마라"). 산출물은 전부
`outputs/gt21/`(스크래치, git 추적 안 됨) 아래에만 있음 — 레포 코드 변경 0건.

## 오늘 한 일 요약

1. Ground-Truth 21편 제작 착수(전날 설계 `reports/v1_1_ground_truth_answer_key_21_2026-09-08.md`
   대로 시작).
2. **정답지 정의 오류 발견(background)** — 8칸 중 background는 "다른 배경으로 전환"이
   아니라 프롬프트 원문(`oxxovo-scoring/_new_rubric_prompt_2026-09-07_structured_v1.ts`
   의 OLD_STEP3_BLOCK) 그대로 **"background instability"**(배경이 불안정/모핑/떨림).
   → ffmpeg로 만드는 게 아니라 **실제 스코어링 결과에서 진짜 background 결함이 잡힌
   편을 찾아 쓰는 방식**으로 전환(본부 지시).
3. **소스 오염 3종 발견**(전부 실측, 육안+ffmpeg scenedetect):
   - **브랜딩**: `promo/content_video`의 A01~A20 전 클립이 마케팅 텍스트 오버레이 +
     동일한 OXXOVO 브랜드 아웃트로 카드를 내장(안전구간 0~15.5s, ~16.3s부터 카드).
     `cf/v3` 시리즈(cf_01~09)는 27초 중 소프트 디졸브로 자체 브랜드 제품 카드로
     전환(안전구간 0~18s).
   - **내부 몽타주**: A18_cities(랜드마크 4개 몽타주), A20_culture(시장→차→직물
     3장면), **A13_group**(춤 그룹이 최소 2팀 이상 교차 편집, scenedetect
     threshold 0.3으로는 못 잡고 0.08까지 낮춰야 패턴이 드러남), **A14_solo**(실내
     스포트라이트→야외 석양, 아주 느린 디졸브라 scenedetect 0.08에서도 안 잡힘 —
     **육안으로만 확인 가능**했음).
   - **CLEAN 오판**: demo_anne을 CLEAN-ALL로 썼다가 실측(8프레임) 결과 램프포스트
     1→2개, 벤치 등장+양쪽 복제 등 실제 background instability 발견 — CLEAN 자격
     박탈.
4. **위 3종을 한 편씩 땜질하다가 본부가 제동** — "같은 패턴이 두 번, 오늘만 세
   번째" 지적. **전체 소스 풀을 한 번에 스크린하는 방식으로 전환**해 21편
   재배정표를 만들고 그 표대로 재제작.
5. GT01~18(ffmpeg만으로 되는 18편) **일단 빌드 완료** — 단, 마지막 재배정 이후
   A13_group을 썼던 GT06/GT10/GT12도 다시 걸려서(같은 소스가 알고 보니 컴필레이션)
   재빌드함. **이 18편은 "지금까지 발견된 문제는 다 고친 버전"이지, 본부가 지시한
   ①(전수 스크린)을 처음부터 그 방법으로 다시 훑은 버전은 아님** — 내일 ①을
   제대로 하면 또 안 걸릴 거란 보장 없음. 그대로 정답지로 확정하지 말 것.

## 오늘 확정된 안전구간 원장 (재사용 가능, 내일 ①의 출발점)

| 소스군 | 안전구간 | 비고 |
|---|---|---|
| A01~A20 (`promo/content_video`) | **0~15초만** | 8초 부근 캡션 전환(내용 무관, 무해 확인) + 16.3초부터 브랜드 아웃트로. **A18_cities·A20_culture는 안전구간 안에서도 내부 몽타주라 통째로 제외.** |
| cf_01~09, seedance_1 (`cf/v3`) | **0~18초만** | 22초 부근부터 브랜드 카드로 소프트 디졸브 시작(하드컷 아님, scenedetect 0.3/0.08 둘 다 못 잡음 — 육안 확인 필수). |
| demo_artisan, demo_anne, demo_duel, demo_astronaut, demo_consistency, demo_sf, demo_ichar (`watch_demo`) | 전체 길이 | 브랜딩 없음. **여러 편이 이미 진짜 결함 보유**(anne=배경, duel/astronaut/consistency=모션, ichar=배경 — 3사 합의). CLEAN 후보로 쓰기 전 반드시 8프레임 이상 육안 확인. |
| tk_render_1(18s)/tk_render_2(21s) (`renders`) | 전체 길이 | 브랜딩 없음. 둘 다 실측 결함 보유(1=배경, 2=조명/연속성). |
| **A13_group** | ⛔**전체 금지** | 컴필레이션(최소 2개 무용팀 교차편집), 0.3 문턱에선 안 보이고 0.08에서 패턴만 드러남. |
| **A14_solo** | ⛔**전체 금지** | 실내→야외 슬로우 디졸브, scenedetect로 절대 안 잡힘(육안만 유효). |

### 소스별 "단일 연속 장면" 확인 상태 (2026-09-08 기준)

- **확인됨(안전)**: A02_fabric, A03_street, A05_plating, A07_cooking, A08_dessert,
  A09_race, A10_drift, A11_night, A16_crowd, A17_vista(0~7초만 확인),
  A19_sunrise, demo_artisan, cf_01/02/03(내용만, 안전구간 준수 시)
- **금지 확정**: A13_group, A14_solo, A18_cities, A20_culture
- **미확인(내일 ①에서 반드시 스윕)**: A04_morph, A06_splash, A12_mech,
  A15_rhythm, cf_04~09, seedance_1, g_* 8종, demo_duel/astronaut/consistency/sf,
  tk_render_2 — **이 세션에서 손도 안 댐, 안전 여부 모름.**

## 현재 21편 배정표 (재확정 필요, 확정 아님)

| # | 카테고리 | 소스/편집 | 상태 |
|---|---|---|---|
| GT01 | CLEAN | demo_artisan | 8프레임 확인 완료 |
| GT02 | CLEAN | A02_fabric[0:15) | 확인 완료 |
| GT03 | CLEAN | A05_plating[0:15) | 3프레임 확인 완료 |
| GT04 | faceIdentity | A07[0:7)+A08[7:15) | 완료 |
| GT05 | faceIdentity | cf_01[0:8)+cf_02[8:15) | 완료 |
| GT06 | faceIdentity+editing | A07[0:6)+**A11_night**[6:15) | A13_group→A11_night 교체 후 재빌드 |
| GT07 | motion | A03_street freeze@4 | 완료 |
| GT08 | motion | A11_night freeze@3 | 완료 |
| GT09 | motion+lighting | A08_dessert freeze@4+color@9 | 완료 |
| GT10 | lighting | **A16_crowd**[0:8)+color[8:15) | A13_group→A16_crowd 교체 후 재빌드 |
| GT11 | lighting | cf_03[0:10)+color[10:18) | 완료 |
| GT12 | editing | **A11_night**[0:5)+[10:13) | A13_group→A11_night 교체 후 재빌드(A14_solo도 기각됨) |
| GT13 | editing | A16_crowd 4세그먼트[0:3)+[9:12)+[3:8)+[8:15) | 완료 |
| GT14 | continuity | A19_sunrise[0:15) | 완료 |
| GT15 | continuity | A17_vista[0:7)+A10_drift[7:15) | A18_cities·A20_culture 둘 다 기각 후 A10_drift로 확정 |
| GT16 | background | demo_ichar(전체, 3사 합의) | 완료, 실클립 그대로 |
| GT17 | background | A09_race[0:15) | 완료, 실클립 트림만 |
| GT18 | background | tk_render_1[0:18) | 완료, 실클립 트림만 |
| GT19~21 | anatomy+objectConsistency | AI 생성 3편 | **미착수**(②, 유료, 재시도 3회 상한) |

산출물 위치: `outputs/gt21/final/GT01~18_*.mp4`(18편, 위 표 기준 최신 상태),
원본 소스는 `outputs/gt21/src/`, scenedetect 원시 로그는 `outputs/gt21/scenescan/`.
프로브 스크립트(전부 읽기 전용, DB 미변경): `scripts/zz_probe_gt_asset_urls_2026-09-08.mjs`,
`scripts/zz_probe_gt_demo_urls_2026-09-08.mjs`, `scripts/zz_probe_background_candidates_2026-09-08.mjs`,
`scripts/zz_probe_full_source_inventory_2026-09-08.mjs` — 전부 미커밋.

## 8칸 정의 vs 프롬프트 원문 대조 결과 (본부 지시, 완료)

`_new_rubric_prompt_2026-09-07_structured_v1.ts`의 OLD_STEP3_BLOCK 체크리스트와
1:1 대조 — **background 하나만 어긋났었고 이미 위에서 수정 반영함.** 나머지 7개는
설계 그대로 일치 확인:
- faceIdentity="face or identity drift" — Z03 기존 실측 검증 방식(접합)과 일치
- anatomy="hand, limb, anatomy, body deformation" — AI 생성 필요, 설계 그대로
- objectConsistency="object deformation or disappearance" — AI 생성 필요, 설계 그대로
- motion="motion collapse, unnatural motion, frozen motion" — freeze-frame 기법 일치
- lighting="inconsistent lighting or shadows" — 컷 없이 색보정만 바꾸는 기법 일치
- continuity="unexplained continuity breaks, spatial/temporal discontinuity" — A19 기존 검증 방식 일치
- editing="editing or transition errors" — 하드컷 기법 일치

## 내일 첫 작업 (본부 지시 순서, 오늘과 동일하지만 이번엔 처음부터 이 순서로)

1. **소스 풀 전수 스크린** — 미확인 목록(위 "미확인" 항목) 전부 포함, 이번엔
   처음부터 (a) scenedetect threshold 0.08 (b) 8~10프레임 육안 확인 **두 가지를
   같이** 쓸 것 — 오늘 배운 것: 0.3 문턱은 컴필레이션도 못 잡고, 심지어 0.08도
   슬로우 디졸브(A14_solo)는 못 잡는다. **육안 확인이 최종 권위.**
2. 소스별 안전구간을 표로 남긴다(위 원장에 이어서 채움).
3. 21편 재배정표 확정 후 본부 승인.
4. 제작 — 이번엔 한 번에.
5. 그다음 ②(유료 3편, 재시도 3회 상한) → ③(제작 후 육안 확인) → ④(채점
   21×5+재호출 5×5) → ⑤(Recall/FPR/Stability).

## 남은 것 3건 (오늘 손 안 댐)

1. **백필 SQL** — 대표님 Run 대기(`reports/jisu_hq_2026-09-06_eod.md`의 SQL, 계속 대기 중).
2. **12시간 스로틀 버그 재확인** — `deadline-12h ≤ now ≤ deadline` 식과 정확히
   일치하는지 코드 대조(어제 로컬 수정, 미커밋·미배포 상태 그대로).
3. **★신규: 가중치 토큰화(VideoLiveMain 리터럴)** — 오늘 처음 지시받음, 상세
   스펙 없음. 다음 세션에서 본부에 구체 내용 확인 필요.
