# promo_videos 전수 정리 (2026-08-23)

deleted_at IS NULL, 워밍업 1편(0b0da5f4-...) 제외. 총 92건.

## 요약

- status: 92/92 ready
- approved: 92/92 false (승인된 것 0건 -- Watch 대역으로 쓰기 전 승인 절차 필요)
- actual_width x actual_height: 92/92 1080x1920 (실측 일치)
- aspect_ratio 필드: 92/92 9:16
- caption: 1/92만 채워짐, 91/92 비어있음
- language 컬럼: 존재하지 않음 (theme_note 끝의 "(KR)"/"(EN)" 표기가 유일한 언어 신호)
- EN/KR 쌍: 46개 라벨 x 정확히 2개(EN 1 + KR 1) = 92건, 어긋난 쌍 0건

## ① 로션·화장품 장면이 들어간 편

theme_note 텍스트 매칭(lotion/cosmetic/skincare/beauty/makeup/serum/로션/화장품/스킨케어/뷰티) 결과 **0건**.
46개 고유 라벨 전부 확인 -- 카테고리는 7월 정보영상(9종) / A시즌주제(20종, fashion·food·race·night·culture 등) / C카운트다운(8종) / D감성(7종)뿐이고, 코스메틱·로션 계열 라벨이 없음.
★단, 이건 라벨 텍스트 매칭이지 실제 프레임 검사가 아님(prompt 필드가 92건 전부 null -- source=uploaded라 생성 프롬프트가 없음). 라벨에 안 적혀 있어도 영상 안에 우연히 비슷한 장면이 들어있을 가능성은 이 조사로는 배제 못 함.

## ② 그 외 (92건 전체)

| id | theme_note | status | approved | resolution | caption |
|---|---|---|---|---|---|
| 55c05fa9 | 7월 정보영상 — D-30 카운트다운 (EN) | ready | false | 1080x1920 | - |
| bb2c0b43 | 7월 정보영상 — D-30 카운트다운 (KR) | ready | false | 1080x1920 | - |
| 3eb4a262 | 7월 정보영상 — FAQ 영상 규칙 (EN) | ready | false | 1080x1920 | - |
| 10dd492e | 7월 정보영상 — FAQ 영상 규칙 (KR) | ready | false | 1080x1920 | - |
| bf6e9a4d | 7월 정보영상 — FAQ 외부 AI (EN) | ready | false | 1080x1920 | - |
| 9285e6d4 | 7월 정보영상 — FAQ 외부 AI (KR) | ready | false | 1080x1920 | - |
| fb0be878 | 7월 정보영상 — FAQ 참가비/멤버십 (EN) | ready | false | 1080x1920 | - |
| b63da795 | 7월 정보영상 — FAQ 참가비/멤버십 (KR) | ready | false | 1080x1920 | - |
| 79181e73 | 7월 정보영상 — Founding Creator (EN) | ready | false | 1080x1920 | - |
| 9dc772b6 | 7월 정보영상 — Founding Creator (KR) | ready | false | 1080x1920 | - |
| e3e8cd84 | 7월 정보영상 — 상금·참가비 무료 (EN) | ready | false | 1080x1920 | - |
| 223b2ffa | 7월 정보영상 — 상금·참가비 무료 (KR) | ready | false | 1080x1920 | - |
| 809a2130 | 7월 정보영상 — 심사(공정성) (EN) | ready | false | 1080x1920 | - |
| 266c4225 | 7월 정보영상 — 심사(공정성) (KR) | ready | false | 1080x1920 | - |
| 082e5dff | 7월 정보영상 — 왕중왕전 2027 (EN) | ready | false | 1080x1920 | - |
| 0262a4d4 | 7월 정보영상 — 왕중왕전 2027 (KR) | ready | false | 1080x1920 | - |
| 46889a84 | 7월 정보영상 — 참가 방법 (EN) | ready | false | 1080x1920 | - |
| 44277aff | 7월 정보영상 — 참가 방법 (KR) | ready | false | 1080x1920 | - |
| c35cd1f2 | A시즌주제 · A01_fashion (EN) | ready | false | 1080x1920 | - |
| eefc1d28 | A시즌주제 · A01_fashion (KR) | ready | false | 1080x1920 | - |
| e78ac6ab | A시즌주제 · A01_fashion_fusion (EN) | ready | false | 1080x1920 | Y |
| 05698993 | A시즌주제 · A01_fashion_fusion (KR) | ready | false | 1080x1920 | - |
| c5839861 | A시즌주제 · A01_fashion_wearable (EN) | ready | false | 1080x1920 | - |
| e4a5dda7 | A시즌주제 · A01_fashion_wearable (KR) | ready | false | 1080x1920 | - |
| 7cc1ccba | A시즌주제 · A02_fabric (EN) | ready | false | 1080x1920 | - |
| 329ae372 | A시즌주제 · A02_fabric (KR) | ready | false | 1080x1920 | - |
| 3ac2c7cb | A시즌주제 · A03_street (EN) | ready | false | 1080x1920 | - |
| a4993554 | A시즌주제 · A03_street (KR) | ready | false | 1080x1920 | - |
| a4c856cf | A시즌주제 · A04_morph (EN) | ready | false | 1080x1920 | - |
| 6f93a86d | A시즌주제 · A04_morph (KR) | ready | false | 1080x1920 | - |
| b6e7afab | A시즌주제 · A05_plating (EN) | ready | false | 1080x1920 | - |
| a9f0923c | A시즌주제 · A05_plating (KR) | ready | false | 1080x1920 | - |
| fddc278e | A시즌주제 · A06_splash (EN) | ready | false | 1080x1920 | - |
| 916075dd | A시즌주제 · A06_splash (KR) | ready | false | 1080x1920 | - |
| ea8d7321 | A시즌주제 · A07_cooking (EN) | ready | false | 1080x1920 | - |
| a6489d38 | A시즌주제 · A07_cooking (KR) | ready | false | 1080x1920 | - |
| 6318d059 | A시즌주제 · A08_dessert (EN) | ready | false | 1080x1920 | - |
| 97b42ca4 | A시즌주제 · A08_dessert (KR) | ready | false | 1080x1920 | - |
| 03d94127 | A시즌주제 · A09_race (EN) | ready | false | 1080x1920 | - |
| bb5d445c | A시즌주제 · A09_race (KR) | ready | false | 1080x1920 | - |
| 754f0424 | A시즌주제 · A10_drift (EN) | ready | false | 1080x1920 | - |
| 72eb01f5 | A시즌주제 · A10_drift (KR) | ready | false | 1080x1920 | - |
| d9a24c54 | A시즌주제 · A11_night (EN) | ready | false | 1080x1920 | - |
| 721acbbf | A시즌주제 · A11_night (KR) | ready | false | 1080x1920 | - |
| b7aa6aee | A시즌주제 · A12_mech (EN) | ready | false | 1080x1920 | - |
| 60524f42 | A시즌주제 · A12_mech (KR) | ready | false | 1080x1920 | - |
| 71fd0b60 | A시즌주제 · A13_group (EN) | ready | false | 1080x1920 | - |
| d2459826 | A시즌주제 · A13_group (KR) | ready | false | 1080x1920 | - |
| aa37c881 | A시즌주제 · A14_solo (EN) | ready | false | 1080x1920 | - |
| c24a3e33 | A시즌주제 · A14_solo (KR) | ready | false | 1080x1920 | - |
| e60ec2d4 | A시즌주제 · A15_rhythm (EN) | ready | false | 1080x1920 | - |
| 1900403c | A시즌주제 · A15_rhythm (KR) | ready | false | 1080x1920 | - |
| 8e0ef23e | A시즌주제 · A16_crowd (EN) | ready | false | 1080x1920 | - |
| 4aadd955 | A시즌주제 · A16_crowd (KR) | ready | false | 1080x1920 | - |
| 13457095 | A시즌주제 · A17_vista (EN) | ready | false | 1080x1920 | - |
| 570f0330 | A시즌주제 · A17_vista (KR) | ready | false | 1080x1920 | - |
| a51f3a3b | A시즌주제 · A18_cities (EN) | ready | false | 1080x1920 | - |
| 4e38fbb6 | A시즌주제 · A18_cities (KR) | ready | false | 1080x1920 | - |
| 456445fe | A시즌주제 · A19_sunrise (EN) | ready | false | 1080x1920 | - |
| 8ad4fefb | A시즌주제 · A19_sunrise (KR) | ready | false | 1080x1920 | - |
| 755562f9 | A시즌주제 · A20_culture (EN) | ready | false | 1080x1920 | - |
| 9e73def4 | A시즌주제 · A20_culture (KR) | ready | false | 1080x1920 | - |
| 436d50dd | C카운트다운 · C01_d30 (EN) | ready | false | 1080x1920 | - |
| 9a59b0d0 | C카운트다운 · C01_d30 (KR) | ready | false | 1080x1920 | - |
| 1dc54489 | C카운트다운 · C02_d14 (EN) | ready | false | 1080x1920 | - |
| 6905b0a8 | C카운트다운 · C02_d14 (KR) | ready | false | 1080x1920 | - |
| c83f69a2 | C카운트다운 · C03_d7 (EN) | ready | false | 1080x1920 | - |
| 7f4fc98f | C카운트다운 · C03_d7 (KR) | ready | false | 1080x1920 | - |
| c2b58628 | C카운트다운 · C04_d3 (EN) | ready | false | 1080x1920 | - |
| 2b7f1a6a | C카운트다운 · C04_d3 (KR) | ready | false | 1080x1920 | - |
| 3148f90c | C카운트다운 · C05_d1 (EN) | ready | false | 1080x1920 | - |
| d43d29c0 | C카운트다운 · C05_d1 (KR) | ready | false | 1080x1920 | - |
| 4f6159aa | C카운트다운 · C06_lastcall (EN) | ready | false | 1080x1920 | - |
| fabf7b9b | C카운트다운 · C06_lastcall (KR) | ready | false | 1080x1920 | - |
| 31ec8e88 | C카운트다운 · C07_founding (EN) | ready | false | 1080x1920 | - |
| 73bbcade | C카운트다운 · C07_founding (KR) | ready | false | 1080x1920 | - |
| 614564f9 | C카운트다운 · C08_s1open (EN) | ready | false | 1080x1920 | - |
| b6d59c9f | C카운트다운 · C08_s1open (KR) | ready | false | 1080x1920 | - |
| 250072ab | D감성 · D01_slogan (EN) | ready | false | 1080x1920 | - |
| 35cccd52 | D감성 · D01_slogan (KR) | ready | false | 1080x1920 | - |
| 8163cf0e | D감성 · D02_aieasy (EN) | ready | false | 1080x1920 | - |
| 0fdb8ebb | D감성 · D02_aieasy (KR) | ready | false | 1080x1920 | - |
| abadec96 | D감성 · D03_arena (EN) | ready | false | 1080x1920 | - |
| 319a5aa4 | D감성 · D03_arena (KR) | ready | false | 1080x1920 | - |
| 7c0a321c | D감성 · D04_fair (EN) | ready | false | 1080x1920 | - |
| c03a8fc9 | D감성 · D04_fair (KR) | ready | false | 1080x1920 | - |
| f7449f01 | D감성 · D05_worldchamp (EN) | ready | false | 1080x1920 | - |
| c71cd8e8 | D감성 · D05_worldchamp (KR) | ready | false | 1080x1920 | - |
| 399c982a | D감성 · D06_creators (EN) | ready | false | 1080x1920 | - |
| 096105ea | D감성 · D06_creators (KR) | ready | false | 1080x1920 | - |
| b42a8b98 | D감성 · D07_newstandard (EN) | ready | false | 1080x1920 | - |
| 8e3b9240 | D감성 · D07_newstandard (KR) | ready | false | 1080x1920 | - |

## ③ EN/KR 쌍 검증

46쌍 전부 정확히 1 EN + 1 KR. 어긋난 라벨 0건.
