# Watch — 지수2C가 직접 쓴 영어 (제니3 검수 요청) — 2026-08-11

★배선 중 발견: Watch 화면 여러 곳에 한국어가 이미 하드코딩되어 **언어와
무관하게 항상** 표시되고 있었다(예: `✓ Verified` 옆에 `🔥 투표중`이 토글과
상관없이 같이 뜨는 식). 08-10 번역 목록은 "영어 문자열"만 뽑는 형식이라
이 자리들을 놓쳤다(제니2 확인 완료, "내 형식이 좁았다").

★★기능 상태 라벨이라 제니3 승인을 기다리지 않고 배선했다(제니2 판단,
2026-08-11: "브랜드 판단이 들어갈 자리가 아니다"). 기존에 이미 쓰이는
어휘(`Main Round` / `Preliminary` / `Judging` / `Voting` / `Finalist`)에
맞췄고 "결선"은 쓰지 않았다. 아래는 한 번에 검수받기 위한 전체 목록 —
바꿀 게 있으면 알려달라, 그 전까지는 이 문안으로 라이브다.

| 키 | 한국어(기존, 그대로 유지) | 지수2C가 쓴 영어 | 위치 |
|---|---|---|---|
| watch.finalist_pending_note | 본선 영상 준비 중 | Main round video coming soon | Arena.tsx FinalistSection, 본선 영상 미제출 카드 오버레이 |
| watch.main_round_results_title | 🏆 본선 결과 | 🏆 Main Round Results | Arena.tsx MainRoundSection 헤딩, 결과 발표 후 |
| watch.main_round_live_title | 🏆 본선 · 지금 시합 중 | 🏆 Main Round · Live Now | Arena.tsx MainRoundSection 헤딩, 진행 중 |
| watch.finalist_prelim_title | 본선 진출작 · 예선 라운드 작품 | Finalist Entries · Preliminary Round | Arena.tsx FinalistPrelimSection 헤딩 |
| watch.finalist_prelim_tag | 본선 진출작 | Finalist Entry | Arena.tsx WatchCard 태그 |
| watch.card_judging | ⚡ AI 심사 중 | ⚡ Judging | Arena.tsx CardBadge, 채점 대기 |
| watch.card_voting | 🔥 투표중 | 🔥 Voting | Arena.tsx CardBadge, 본선 투표 기간 |
| watch.card_awaiting_judgment | 심사 대기 | Awaiting judgment | Arena.tsx cardStatusText |
| watch.score_suffix | Triple-AI {score}점 | Triple-AI {score} | Arena.tsx 카드/FinalistSection 하단, 점수 표시 ("점" 접미사는 한국어만) |
| watch.live_judging | Triple-AI 심사 중 / 심사 완료 | Triple-AI Judging / Judging Complete | LiveStatusBar.tsx, 심사 진행률 라인 |
| watch.live_close_label | 본선·예선 마감까지 | Main Round/Preliminary closes in | LiveStatusBar.tsx, 마감 카운트다운 라벨 |
| watch.live_reveal_label | 본선 진출작 공개까지 | Finalists revealed in | LiveStatusBar.tsx, 파이널리스트 공개 카운트다운 |
| watch.live_vote_label | 투표 마감까지 | Voting closes in | LiveStatusBar.tsx, 투표 마감 카운트다운 |
| watch.live_theme_main | (없음, 영어만 있었음: Main Round Theme) | Main Round Theme | LiveStatusBar.tsx 테마 패널 라벨 — ★반대 방향: 한국어 "본선 주제"가 새로 필요해서 지수2C가 씀 |
| watch.live_theme_next | 다음 라운드 주제 | Next Round Theme | LiveStatusBar.tsx 테마 패널 라벨(본선 전) |
| watch.live_countries_suffix | 개국 참가 | countries | LiveStatusBar.tsx, 참가국 수 옆 |
| watch.champions_note | (동적 조합, 원래 영어만) | (동적 조합) | ArenaFilterBar.tsx Champions 드롭다운 — ★반대 방향: 한국어 조합 문장이 새로 필요해서 지수2C가 씀. 영어는 기존 코드 그대로(변경 없음) |
| watch.detail_main_round_pending | 🏆 본선 진출작입니다 · 본선 영상은 준비 중입니다. | 🏆 Finalist entry · Main round video coming soon. | app/watch/[id]/page.tsx, 본선 미제출 안내 |
| watch.results_kicker | (없음, 영어만 있었음: Results) | Results | Arena.tsx MainRoundSection 킥커, 결과 발표 후 — ★반대 방향: 한국어 "결과"가 새로 필요해서 지수2C가 씀 |
| watch.finalist_prelim_kicker | (없음, 영어만 있었음: Finalists) | Finalists | Arena.tsx FinalistPrelimSection 킥커 — ★반대 방향: 한국어 "본선 진출자"가 새로 필요해서 지수2C가 씀(finalists_title과 같은 값 재사용) |
| watch.featured_stats | (없음, 영어만 있었음) | {views} views · {votes} votes | Arena.tsx FeaturedCompetitors 카드 하단, 조회수·투표수 조합 — 목록에 없던 조합 문장, 양쪽 다 지수2C가 씀 |

★위 "반대 방향" 표시 3건(`live_theme_main`, `champions_note`)은 영어가
기존에 있었고 한국어가 새로 필요했던 경우 — 지수2C가 쓴 쪽이 한국어다.
나머지는 전부 한국어가 기존, 영어가 신규.
