# 문구 요청 — 새 사이트 (홈 + 7개 페이지) — 2026-10-11 (시안 반영판)

작성: 지수(메인). 문구는 제 소관이 아니라서 **지어 쓰지 않았고**, TK님이 승인한 시안의 이름만 넣었습니다.
카탈로그: `lib/site-messages-en.ts`(영어 정본) / `lib/site-messages-ko.ts`(한국어). 한국어에 없는 키는 영어로 폴백됩니다.

## 이미 들어간 것 (TK님 승인 시안)

- 왼쪽 메뉴 53개 항목(Entertainment 9 · Daily 8 · Market 9 · Education 9 · Jobs 8 · AI Games 9)의 영어·한국어 이름
- Home Hero: OXXOVO / AI x HUMAN / A BRIGHTER TOMORROW / Create · Compete · Learn · Work · Play, 한국어 "AI와 사람이 함께 만드는 더 큰 세상"
- 홈 Featured 제목의 한국어 "추천 콘텐츠"(Entertainment 메뉴 "Featured 추천 콘텐츠"에서 따옴 — 확인 요청)
- 상단 메뉴·섹션·카드 배지 영어(TK님 확정)

## 요청 1. 영어가 비어 있는 키 (1개)

| 키 | 용도 | 상태 |
|---|---|---|
| hero.sub | 시안 홈 Hero 오른쪽 문장. 시안에는 한국어 "AI와 사람이 함께 만드는 더 큰 세상"과 영어 두 줄("A MORE CREATIVE / A MORE CONNECTED WORLD")이 보이는데, 이번 전달 텍스트에는 한국어만 있어서 영어는 **비워 두었습니다**(영어 화면에서는 이 문장이 안 그려짐) | 영어 문구 확정 필요 |

## 요청 2. 한국어가 아직 없는 키 (영어로 폴백 중)

- 상단 메뉴 7개: Tournament / Entertainment / Daily / Market / Education / Jobs / AI Games (시안의 한국어 화면도 영어 메뉴를 쓰므로 번역이 필요 없을 수 있음 — 확인)
- 섹션 이름: All / Competition / News / Film / Drama / CF / Music
- 카드 배지: COMPETITION / OXXOVO ORIGINAL / OXXOVO DAILY / COMMERCIAL
- 카드의 "AI-generated" 표기(플랫폼별 표기 문구는 제니3 소관으로 이미 표시된 항목)

## 요청 3. 임시 영어(중립)인 접근성용 이름 — 화면에 안 보임

aria.account `Account` · aria.language `Language` · aria.topMenu `Sections` · aria.sideMenu `Section menu` · aria.adSlot `Tournament video`

## 결정이 필요한 것 (문구 아님)

1. **시안의 섹션 제목**("추천 콘텐츠", "주요 뉴스", "추천 AI 제품", "추천 교육 과정", "추천 채용 공고", "게임 선택")과 **Hero 위의 부제**("Stories Beyond Imagination", "Discover The Next AI Product" 등)는 이번 전달 텍스트에 없어서 만들지 않았습니다. 필요하면 키와 문구를 주세요.
2. 시안 속 실제 회사 이름·로고(OpenAI, NVIDIA, Google, Meta, Amazon 등)와 실제 인물 사진은 사용하지 않았습니다. 카드는 빈 틀(이미지 자리)입니다.
3. 배너: 글자 없는 원본 16:9(1920×1080 이상)로 받아 **잘라서(object-cover)** 씁니다. 홈 Hero는 가로로 매우 넓게(4:1), 섹션 배너는 21:9로 보입니다. 위아래가 잘려도 되는 안전 영역을 제니2에 알려야 합니다.
4. 상단 메뉴·왼쪽 메뉴의 아이콘: 시안에는 항목별 아이콘이 있으나 아이콘 세트가 미정이라 모든 항목에 같은 중립 사각 아이콘을 넣었습니다(`app/_site/icons.tsx` 한 곳에서 교체).
5. `Coming Soon` 문구는 새 사이트 어디에도 쓰지 않습니다(카탈로그에 없음, 테스트로 고정).
