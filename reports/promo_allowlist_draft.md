# 홍보영상 허용 목록 초안 (Tournament /competition) -- 2026-10-12 PT

작성: 지수(메인). **초안, 로컬만. 실행·SQL Run·커밋·배포 없음.** 계획서: `reports/tournament_promo_plan.md`(방식 B, 본부 승인).
입력: TK님이 Run한 P1·P2·P3 결과(본부 전달) + 본부 제외·후보 기준. **P2는 화면 캡처라 일부만 확인됐고 id가 없다** -> 이 초안은 **슬롯(라벨) 단위**이고, id는 아래 P4를 Run한 뒤에 채운다.

## 1. 데이터 사실 (P1)

| 조건 | 건수 |
|---|---|
| ready · approved false · 미삭제 · 9:16 1080x1920 · R2(`pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev`) | **88** |
| 같은 조건, 삭제됨 | 4 |
| ready · 미삭제 · 비율 NULL · Supabase Storage(6/20 워밍업 테스트) | 1 -> **제외** |
| 미삭제 합계(P2) | 89 |

- 본부의 "84편"(재렌더본 86편에서 `A01_fashion` 2편 제외)과 DB의 88행의 대응은 **아직 확정 못 했다.** 88과 84의 차이 4행이 무엇인지(삭제 전 4행과 같은 것인지 포함) P4 결과로 본다.
- R2 호스트 `pub-bf4080d3....r2.dev`: **앱의 `R2_PUBLIC_BASE`와 같은 호스트인지 미확인.** 읽는 쪽이 `R2_PUBLIC_BASE` 호스트만 허용하는 규칙(배너와 같은 규칙)이라, **다르면 아무 영상도 안 나온다.** 구현 전 TK님이 Vercel Production의 `R2_PUBLIC_BASE` 값의 호스트를 확인(값 전체를 채팅에 붙이지 말고 호스트만 맞는지 예/아니오). 다르면 허용 호스트를 별도 설정으로 둘지 결정 필요.

## 2. 라벨 슬롯별 판정 (P2 라벨 기준)

범례: **제외** = 쓰지 않음 / **후보** = 검수 후 허용 / **대기** = 확인 필요

| 라벨 그룹 (theme_note) | 슬롯 | 길이 | 판정 | 이유·검수 |
|---|---|---|---|---|
| 7월 정보영상 | B_faq1 · B_faq2 · B_faq3 (EN/KR) | 15초 | **후보(문구 현행 대조 후)** | 8/28 재작업본(`a1f2b2e` 계열). 문구가 현행(Studio 전용 제작 등)과 맞는지 제니3 |
| 7월 정보영상 | C_howto (EN/KR) | 15초 | **후보(문구 현행 대조 후)** | "Studio를 열고 바로 제출" 문구. 현행과 대조 |
| 7월 정보영상 | D_prize (EN/KR) | 15초 | **제외** | 상금 주장 |
| 7월 정보영상 | E_founding (EN/KR) | 15초 | **제외** | TK님 "조잡" |
| 7월 정보영상 | F_judging (EN/KR) | 15초 | **제외** | AI 50%/관객 50% 리터럴, 현행과 일치 확인 전 |
| A시즌주제 | `A01_fashion`(원본, EN/KR) | 18초 | **제외** | 씬2 소스 90도 회전, 재작업 대상 |
| A시즌주제 | `A01_fashion_fusion` · `A01_fashion_wearable` (EN/KR) | 18초 | **대기** | A01 파이프라인에서 나온 변형. **같은 회전 문제가 있는지 육안 필요**(본부 기록은 원본만 지목) |
| A시즌주제 | A02_fabric ~ A18_cities 이상(EN/KR) | 18초 | **후보(TK님 회전 육안 후)** | 회전 확인된 것은 A05·A09·A17(t=8초)뿐. **나머지는 미확인.** A18 이후는 P2 캡처가 잘려 목록 미확인 -> P4로 전체 확인 |
| C카운트다운 | C01_d30 ~ C08_s1open (EN/KR) | 10초 | **제외** | 날짜·마감 박힘, C07은 거짓 |
| D감성 | D01_slogan · D02_aieasy · D03_arena · D06_creators (EN/KR) | 10초 | **후보** | 날짜 없는 브랜드 슬로건 |
| D감성 | D04_fair (EN/KR) | 10초 | **후보(정정본 확인 필요)** | 정정 문구는 "Only skill advances"만. **재렌더본이 정정본인지 영상으로 확인** |
| D감성 | D07_newstandard (EN/KR) | 10초 | **후보(정정본 확인 필요)** | 정정 문구 "Where AI creators find out where they stand". 위와 같음 |
| D감성 | D05_worldchamp (EN/KR) | 10초 | **대기** | 본부 지정은 D 후보이나 "World Championship" 주장이 있다(상금 문구는 뺀 판). 제니3 문구 확인 |
| 티저 | (확인된 DB 행 없음) | — | **제외** | 마스터 목록에 티저가 `promo_videos`에 있는지 P2에서 못 봄. 있어도 마감일·상금 박힘 |
| (워밍업) | 6/20 테스트, 비율 NULL, Storage | — | **제외** | |

**추가 검수 항목(본부 기록에 없던 것, 내 제안):** A·B_faq·C_howto는 끝 카드가 "Apply now"류 신청 유도일 수 있다. 지금은 **신청을 받는 시즌이 없다**(시즌 날짜 비움 상태, 10-12 SQL). Tournament 페이지에 "지금 신청하라"는 영상이 나가도 되는지 제니3·본부 판단. (엔드카드 실제 문구는 영상으로만 확인 -- 소스에는 "Apply now → www.oxxovo.ai"가 있지만 8/28 재렌더에서 바뀌었을 수 있음.)
**`oxxovo.ai/watch` CTA:** 본부 기록 "58편에 박혀 있음"은 미확인 항목. 검수 때 엔드카드를 같이 본다. 발견 편은 `/watch`가 열려 있지 않을 때 죽은 링크이므로 제외.

## 3. 그룹 배정(제안)

| 그룹 | 대상 |
|---|---|
| **대회 홍보** | A(검수 통과분), B_faq·C_howto(검수 통과분) |
| **OXXOVO 홍보** | D(검수 통과분) |

본부 구분(A·C·티저 = 대회 / D·브랜드·CF·마스코트 = OXXOVO)을 따르되, C·티저는 제외이므로 B_faq·C_howto(대회 참가 안내)를 대회 쪽에 둔다 -- **본부 확인.**

## 4. 설정 값 형식(제안: 언어 짝)

한 편이 EN/KR 두 파일이므로 허용 목록은 **짝**으로 둔다. 페이지가 `/ko`이면 `ko`, 아니면 `en`을 쓰고 없으면 `en`으로 대체한다(키 이름의 `_EN_`/`_KR_` 접미사를 코드가 파싱하지 않는다 -- 이름 규칙에 기대지 않기 위해).

```
[{"en":"<promo_videos id>","ko":"<promo_videos id>"}, ...]
```

예: 키 `tournament_promo_oxxovo` = D01 짝, D02 짝, ... (id는 P4 결과 후). 순서 = 화면 순서. 한 짝의 한 쪽이 삭제·비ready·외부 호스트면 그 쪽만 빠지고 다른 쪽이 있으면 대체 표시한다.

## 5. 후보 id 조회 SQL (P4, 읽기 전용, TK님 Run)

슬롯별 id와 키를 한 번에 본다(제외 슬롯은 SQL에서 이미 뺌). 결과를 §6 표에 채운다.

```sql
select id, theme_note, regexp_replace(video_url, '^https?://[^/]+/', '') as key, duration_seconds, actual_width, actual_height from public.promo_videos where deleted_at is null and status = 'ready' and aspect_ratio = '9:16' and video_url like '%pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev%' and (theme_note like 'A시즌주제%' or theme_note like 'D감성%' or video_url ~ '/(B_faq[123]|C_howto)_') and video_url !~ '/content_A01_fashion_(EN|KR)_9x16' order by theme_note, video_url;
```

- 이 쿼리는 A·D 전체와 B_faq·C_howto를 가져오고 A01 원본만 뺀다. **C·E·F·D_prize는 조건에 걸리지 않아 안 나온다**(`theme_note`가 `C카운트다운`/`7월 정보영상`이고 키가 위 정규식에 안 맞는 것). 단 `7월 정보영상`의 B_faq·C_howto 키 패턴(`/B_faq1_...`)은 **내 추정**이므로 결과에 안 나오면 키 이름을 알려 달라.
- 결과가 90행 안팎이면 조건이 너무 넓은 것(비율·호스트 필터가 안 걸림)이니 멈추고 알려 달라.

## 6. 허용 목록 표 (P4 결과 후 채움)

| 그룹 | 슬롯 | EN id | KR id | 회전 육안(TK님) | 문구(제니3) | 엔드카드 신청 유도 | `/watch` CTA | 허용 |
|---|---|---|---|---|---|---|---|---|
| OXXOVO | D01_slogan | | | | | | | |
| OXXOVO | D02_aieasy | | | | | | | |
| OXXOVO | D03_arena | | | | | | | |
| OXXOVO | D04_fair | | | | 정정본? | | | |
| OXXOVO | D05_worldchamp | | | | World Championship | | | |
| OXXOVO | D06_creators | | | | | | | |
| OXXOVO | D07_newstandard | | | | 정정본? | | | |
| 대회 | A01_fashion_fusion | | | 회전? | | | | |
| 대회 | A01_fashion_wearable | | | 회전? | | | | |
| 대회 | A02 ~ A18+ | | | A05·A09·A17 t=8초 확인됨, 나머지 미확인 | | | | |
| 대회 | B_faq1 · B_faq2 · B_faq3 | | | | 현행 대조 | | | |
| 대회 | C_howto | | | | 현행 대조 | | | |

**착수 순서:** P4 Run -> TK님 육안(회전·엔드카드, A 전체 우선) + 제니3 문구 -> 표 확정 -> 키 값 SQL 초안(한 블록 한 쿼리, 공백 오염 검사 포함) -> 구현(계획서 §3) .
