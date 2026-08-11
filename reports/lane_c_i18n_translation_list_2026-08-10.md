# 랜딩·Watch 번역 목록 (조회) — 2026-08-10

★조회. 코드 0줄, 배선 없음. 랜딩(`app/_landing/LandingView.tsx`) + Watch
(`app/watch/*.tsx` 18개 파일, `app/watch/[id]/page.tsx`) 전체를 직접 읽고
뽑았다 — grep 표본 아님. `getBannerStage`(`lib/watch.ts`)의 배너·단계 문구는
제니3 소관이라 뺐다(그 문구는 코드에 리터럴로 없고 함수 반환값이라 애초에
이 파일들에 안 잡힘).

**한국어 칸은 비워뒀다 — 채우지 않았다.**

표기:
- **길이제약**: 버튼·배지처럼 자리가 좁은 곳. 한국어가 길어지면 깨진다.
- **변수**: `{ }`로 표시한 자리에 값이 들어간다. 어순이 달라질 수 있다.

## 랜딩 (`app/_landing/LandingView.tsx`)

| 키 | 영어 원문 | 위치 |
|---|---|---|
| landing_nav_tournament | Tournament Info | 헤더 내비 |
| landing_nav_studio | Studio | 헤더 내비(스튜디오 펀널 켜졌을 때만) |
| landing_nav_watch | Watch | 헤더 내비(Watch 노출 켜졌을 때만) |
| landing_nav_how | How It Works | 헤더 내비 |
| landing_nav_about | About | 헤더 내비 |
| landing_nav_membership | Membership | 헤더 내비 |
| landing_nav_faq | FAQ | 헤더 내비 |
| landing_greeting | Hi, {username} | 헤더, 로그인 상태 (변수: 이메일 앞부분) |
| landing_logout | Log out | 헤더, 로그인 상태 (길이제약: 버튼) |
| landing_login | Log in | 헤더, 비로그인 상태 |
| landing_cta_default | Apply now | 시즌 로딩 전 기본 CTA (길이제약: 버튼) |
| landing_eyebrow | AI Competitive Creation Platform | 히어로 상단 태그 |
| landing_h1_line1 | The Global Arena | 히어로 제목 1행 |
| landing_h1_line2 | for AI Creators. | 히어로 제목 2행(강조색) |
| landing_sub1 | AI is easy. Winning is hard. | 히어로 부제 1 |
| landing_sub2 | Same prompt. Same time. No excuses. | 히어로 부제 2 |
| landing_hero_tournament_btn | Tournament Info | 히어로 버튼(내비와 같은 문구, 위치만 다름) |
| landing_hero_submit_prefix | Submit your AI video. | 히어로, CTA 버튼 아래 안내문 시작 |
| landing_hero_submit_fallback | AI verified scoring. | 위 안내문, 시즌 정보 없을 때 |
| landing_countdown_label | Application Closes In | 히어로, 카운트다운 위 라벨 |
| landing_countdown_days | Days | 카운트다운 단위 (길이제약: 아주 좁음) |
| landing_countdown_hrs | Hrs | 카운트다운 단위 (길이제약: 아주 좁음) |
| landing_countdown_min | Min | 카운트다운 단위 (길이제약: 아주 좁음) |
| landing_countdown_sec | Sec | 카운트다운 단위 (길이제약: 아주 좁음) |
| landing_watch_link | Watch the competition → | 히어로, 단계 배너 아래 링크(Watch 노출 켜졌을 때) |
| landing_feat1_title | Real-time | 4피처 스트립 |
| landing_feat1_desc | Live tournaments. Feel the pressure. | 4피처 스트립 |
| landing_feat2_title | Verified | 4피처 스트립 |
| landing_feat2_desc | Same prompt. Same conditions. | 4피처 스트립 |
| landing_feat3_title | Ranked | 4피처 스트립 |
| landing_feat3_desc | Global leaderboard. Earn your reputation. | 4피처 스트립 |
| landing_feat4_title | Global | 4피처 스트립 |
| landing_feat4_desc | Creators from around the world. | 4피처 스트립 |
| landing_feat5_title | Built for Creators | 4피처 스트립 |
| landing_feat5_desc | Made by creators. For creators. | 4피처 스트립 |
| landing_how_eyebrow | How It Works | "작동 방식" 섹션 상단 태그 |
| landing_how_h2 | Submit. Get Verified. Win. | "작동 방식" 섹션 제목 |
| landing_step1_title | Share Your Video | 스텝 01 제목 |
| landing_step1_body | Share your AI-generated video ({min}–{max} seconds) — hosted on YouTube or Vimeo. Use any AI service: Sora, Veo, Runway, Kling, Pika, or others. | 스텝 01 본문 (변수: 최소/최대 초) |
| landing_step2_title | {panelLabel} Judges | 스텝 02 제목 (변수: 패널 이름, 예 "Triple-AI") |
| landing_step2_body | {N or "Three"} independent AI models — {model list} — from {N or "three"} different companies score your work in parallel. Eliminates single-AI bias. | 스텝 02 본문 (변수: AI 개수·모델 목록) |
| landing_step3_title | Get Your Score | 스텝 03 제목 |
| landing_step3_body | Receive your final OXXOVO Score across four categories: Intent Clarity ({%}), Execution ({%}), Originality ({%}), Integrity ({%}). | 스텝 03 본문 (변수: 4개 가중치 %) |
| landing_step4_title | Earn Your Title | 스텝 04 제목 |
| landing_step4_body | The {advance count label} advance as Finalists, competing for the {season name} prize pool of ${total} (${1st} / ${2nd} / ${3rd}). | 스텝 04 본문 (변수: 시즌명·상금 4개) |
| landing_about_eyebrow | About | "소개" 섹션 상단 태그 |
| landing_about_h2_line1 | The First Verified Arena | "소개" 섹션 제목 1행 |
| landing_about_h2_line2 | for AI Video Creators. | "소개" 섹션 제목 2행 |
| landing_about_body | OXXOVO is the global arena for AI video creators. We verify AI-generated content with independent {panelLabel} scoring to ensure fairness. Founded in Las Vegas, OXXOVO Labs Inc. operates the first AI-verified video tournament platform. | "소개" 섹션 본문 (변수: 패널 이름) |
| landing_stat1_label | Independent AI Judges | 통계 3열, 숫자 아래 라벨 |
| landing_stat2_value | Global | 통계 3열, 값 자체 |
| landing_stat2_label | Open to All Creators | 통계 3열, 라벨 |
| landing_stat3_value | Verified | 통계 3열, 값 자체 |
| landing_stat3_label | Same Rules. No Excuses. | 통계 3열, 라벨 |
| landing_faq_eyebrow | FAQ | FAQ 섹션 상단 태그 |
| landing_faq_h2 | Common Questions | FAQ 섹션 제목 |
| landing_faq_q1 | Who can participate in {season name}? | FAQ 질문 1 (변수: 시즌명) |
| landing_faq_a1 | Anyone, anywhere. There are no nationality, age, or experience requirements. You just need an AI-generated video ({min}–{max} seconds) and a free OXXOVO account. | FAQ 답변 1 (변수: 최소/최대 초) |
| landing_faq_q2 | What does it cost to compete? | FAQ 질문 2 |
| landing_faq_a2 | (동적 함수 결과, `lib/seasons.ts`의 `formatAccessCopy()`) | FAQ 답변 2 — ★이 목록 밖. 멤버십/가격 조건별로 문장 구조 자체가 갈리는 함수라 표로 못 옮김. 별도 확인 필요하면 알려달라 |
| landing_faq_q3 | What AI tools can I use? | FAQ 질문 3 |
| landing_faq_a3 | Sora, Veo, Runway, Kling, Pika, or any other AI video generation service. We accept all major platforms — the focus is on your creative direction, not which tool you choose. | FAQ 답변 3 |
| landing_faq_q4 | How exactly are submissions scored? | FAQ 질문 4 |
| landing_faq_a4_intro | Each video is judged by {modelCount} AI models in parallel: | FAQ 답변 4, 첫 줄 (변수: AI 개수) |
| landing_faq_a4_outro | Your final OXXOVO Score is a weighted average across four categories: Intent Clarity ({%}), Execution ({%}), Originality ({%}), and Integrity ({%}). Outlier scores are automatically excluded. | FAQ 답변 4, 마지막 문단 (변수: 4개 %) |
| landing_faq_q5 | Why {N} AIs instead of one? | FAQ 질문 5 (변수: AI 개수) |
| landing_faq_a5 | Every AI has bias. By using {N} independent models from {N} different companies, individual biases cancel out. When the panel agrees, the result is far more trustworthy than any single AI's verdict. This is what makes OXXOVO scoring {panelLabel} Verified. | FAQ 답변 5 (변수: AI 개수·패널명) |
| landing_faq_q6 | What if {max applicants} people apply before me? | FAQ 질문 6 (변수: 정원) |
| landing_faq_a6 | {season name} accepts up to {max} applicants. If the limit is reached before you apply, you'll be automatically added to the {season name} Waitlist with priority access to the next season. We never turn anyone away. | FAQ 답변 6 (변수: 시즌명·정원) |
| landing_faq_q7 | What are the prizes? | FAQ 질문 7 |
| landing_faq_a7 | {season name} features a ${total} prize pool (${1st} for 1st, ${2nd} for 2nd, ${3rd} for 3rd). The {advance count label} earn the Finalist title. Future seasons' prize pools scale with participation. The Grand Final prize pool will be announced based on tournament participation. | FAQ 답변 7 (변수: 시즌명·상금 4개) |
| landing_faq_q8 | How does OXXOVO prevent cheating? | FAQ 질문 8 |
| landing_faq_a8 | Our Integrity score ({%} weight{, judged solely by {model} to prevent AI collusion}) automatically detects misrepresentation. Submissions with Integrity scores below {threshold} are flagged for human review. False claims about your AI tool or content origin result in automatic disqualification. | FAQ 답변 8 (변수: %·모델명·임계값) |
| landing_faq_q9 | When do I get my results? | FAQ 질문 9 |
| landing_faq_a9 | {panelLabel} scoring takes approximately 60–90 seconds per submission. Your individual score appears in your profile soon after submission. Final rankings are published after the application period closes. | FAQ 답변 9 (변수: 패널명) |
| landing_footer_tagline | The New Standard for AI Creativity | 푸터, 로고 옆 태그라인 |
| landing_footer_tournament | Tournament Info | 푸터 링크 |
| landing_footer_membership | Membership | 푸터 링크 |
| landing_footer_terms | Terms | 푸터 링크 |
| landing_footer_privacy | Privacy | 푸터 링크 |
| landing_footer_rules | Rules | 푸터 링크 |
| landing_loading | Loading… | 시즌 로딩 중 섹션 placeholder |

## Watch — 배너 / 히어로 (`Arena.tsx`)

| 키 | 영어 원문 | 위치 |
|---|---|---|
| watch_banner_tagline1 | OXXOVO is the global arena for AI creators. | 배너(신청 접수중 상태), 브랜드 스트립 1행 |
| watch_banner_tagline2 | No editors. No favoritism. Just you, the AI, and the audience. | 배너(신청 접수중 상태), 브랜드 스트립 2행 |
| watch_banner_learnmore | Learn More on Landing Page ↗ | 배너(신청 접수중 상태), 우측 링크 |
| watch_hero_current | Current Competition — Season {N} | 히어로, 이미지 아래 컨텍스트 라인 (변수: 시즌 번호) |
| watch_hero_ctx_results | The winners have been announced. See who took the top spots this season. | 히어로 컨텍스트, results 단계 |
| watch_hero_ctx_voting | Community voting is open. Watch the main-round films and vote for your favorite creator. | 히어로 컨텍스트, voting 단계 |
| watch_hero_ctx_judged | Judging is complete. Finalists will be revealed {on {date}, 없으면 "soon"}. | 히어로 컨텍스트, 심사 완료·발표 전 (변수: 날짜 또는 없음) |
| watch_hero_ctx_default | {roundName} is in progress. Videos are shown in the order they were entered. Join OXXOVO for free to vote in the Main Round and support your favorite creators. | 히어로 컨텍스트, 그 외 기본 (변수: 라운드명) |
| watch_hero_cta_results | See who won → | 히어로 우측 버튼, results 단계 (길이제약: 버튼) |
| watch_hero_cta_default | Join free to vote → | 히어로 우측 버튼, 그 외 (길이제약: 버튼) |
| watch_finalists_kicker | Main Round | "Finalists" 섹션 상단 태그 |
| watch_finalists_title | 🏆 Finalists | "Finalists" 섹션 제목 |
| watch_finalist_badge | Finalist | 파이널리스트 카드 배지, 순위 없을 때 (길이제약: 배지) |
| watch_featured_kicker | Spotlight | "Featured Competitors" 섹션 태그 |
| watch_featured_title | Featured Competitors | "Featured Competitors" 섹션 제목 |
| watch_leaderboard_kicker | Standings | "Leaderboard" 섹션 태그 |
| watch_leaderboard_title | Leaderboard | "Leaderboard" 섹션 제목 |
| watch_roundbadge_main | Main Round | 카드 좌상단 라운드 배지 (길이제약: 배지) |
| watch_roundbadge_prelim | Preliminary | 카드 좌상단 라운드 배지 (길이제약: 배지) |
| watch_badge_verified | ✓ Verified | 카드 배지, 채점 완료 (길이제약: 배지) |
| watch_center_mainround | MAIN ROUND | 카드 중앙 오버레이, 투표 기간 중 |
| watch_empty_entries | No entries yet. They appear here as creators submit. | 그리드, 항목 0개일 때 |
| watch_votecount | {N} votes | 카드 하단 상태 텍스트 (변수: 투표수) |

## Watch — 사이드바 / 탑바 (`ArenaShell.tsx` / `ArenaTopBar.tsx` / `WatchShell.tsx` / `WatchTopBar.tsx`)

★두 세트가 다른 화면에 산다: Arena* = `/watch` 그리드, Watch* = `/watch/[id]`
상세 페이지. 문구가 겹치는 자리는 같은 키로 묶었다.

| 키 | 영어 원문 | 위치 |
|---|---|---|
| watch_search_placeholder | Search videos & creators | 탑바 검색창 placeholder (그리드·상세 공통) |
| watch_signin | Sign in | 탑바, 비로그인 (그리드·상세 공통) |
| watch_badge_watch | WATCH | 사이드바 상단 배지(그리드) |
| watch_badge_subtitle | AI Creator League | 사이드바 상단 배지 아래 |
| watch_nav_home | Home | 사이드바 (그리드) |
| watch_nav_home_sub | Go to Landing Page | 사이드바, Home 아래 설명(그리드) |
| watch_nav_tournament | Tournament Info | 사이드바 (그리드) |
| watch_nav_tournament_sub | Rules, Schedule, Prizes | 사이드바, Tournament 아래 설명(그리드) |
| watch_nav_how | How It Works | 사이드바 (그리드) |
| watch_nav_how_sub | Learn the process | 사이드바, How 아래 설명(그리드) |
| watch_nav_membership | Membership | 사이드바 (그리드·상세 공통) |
| watch_nav_membership_sub | Join & Benefits | 사이드바, Membership 아래 설명(그리드) |
| watch_nav_faq | FAQ | 사이드바 (그리드) |
| watch_nav_faq_sub | Frequently Asked Questions | 사이드바, FAQ 아래 설명(그리드) |
| watch_nav_about | About | 사이드바 (그리드·상세 공통) |
| watch_nav_about_sub | About OXXOVO | 사이드바, About 아래 설명(그리드) |
| watch_library_label | Library | 사이드바 섹션 라벨(그리드) |
| watch_lib_myvideos | My Videos | 사이드바, 준비중 항목(그리드) |
| watch_lib_mylikes | My Likes | 사이드바, 준비중 항목(그리드) |
| watch_lib_watchlater | Watch Later | 사이드바, 준비중 항목(그리드) |
| watch_lib_history | History | 사이드바, 준비중 항목(그리드) |
| watch_footer_tip_title | All Information in One Place | 사이드바 하단 도움말 상자 제목(그리드) |
| watch_footer_tip_body | You are in WATCH. Click menu items to open in a new tab. | 사이드바 하단 도움말 상자 본문(그리드) |
| watch_filter_current | Current Competition | 필터바 드롭다운(그리드) |
| watch_filter_all_competitions | All Competitions | 필터바 드롭다운 메뉴(그리드) |
| watch_filter_newest | Newest First | 필터바 드롭다운(그리드, 2곳 — 버튼+메뉴) |
| watch_filter_champions | 🏆 Champions | 필터바 드롭다운(그리드) |
| watch_filter_champions_note | Season 0 Champions revealed Sep 29 | 필터바, Champions 메뉴 안내(그리드) — ★날짜가 하드코딩돼 있음, 참고만 |
| watch_filter_all_champions | All Champions | 필터바, Champions 메뉴(비활성)(그리드) |
| watch_filter_viewall | View All → | 필터바 우측 링크(그리드) |
| watch_host_suffix | {season name} · Host | 사이드바/필터바, 파트너 시즌 라벨 (변수: 시즌명) |
| watch_sort_trending | Trending | 사이드바 정렬(상세) |
| watch_sort_latest | Latest | 사이드바 정렬(상세) |
| watch_sort_award | Award Winners | 사이드바 정렬(상세, 수상작 있을 때만) |
| watch_round_prelim | Preliminary | 사이드바 라운드 필터(상세) |
| watch_round_main | Main Round | 사이드바 라운드 필터(상세) |
| watch_winner_1st | 🥇 1st Place | 사이드바 수상 필터(상세) (길이제약: 배지 성격) |
| watch_winner_2nd | 🥈 2nd Place | 사이드바 수상 필터(상세) (길이제약: 배지 성격) |
| watch_winner_3rd | 🥉 3rd Place | 사이드바 수상 필터(상세) (길이제약: 배지 성격) |
| watch_sidebar_home | Home | 사이드바(상세) |
| watch_sidebar_tournament | Tournament | 사이드바(상세) |
| watch_sidebar_sort_label | Sort | 사이드바 구분선 라벨(상세) |
| watch_sidebar_seasons_label | Seasons | 사이드바 구분선 라벨(상세) |
| watch_sidebar_all | All | 사이드바, 시즌/라운드/수상 "전체" 옵션(상세, 3곳) |
| watch_sidebar_allrounds | All rounds | 사이드바, 라운드 필터 "전체"(상세) |
| watch_sidebar_round_label | Round | 사이드바 구분선 라벨(상세) |
| watch_sidebar_winners_label | Winners | 사이드바 구분선 라벨(상세) |
| watch_sidebar_more_label | More | 사이드바 구분선 라벨(상세) |
| watch_sidebar_membership | Membership | 사이드바(상세) |
| watch_sidebar_about | About | 사이드바(상세) |
| watch_sidebar_how | How It Works | 사이드바(상세) |
| watch_sidebar_qa | Q&A | 사이드바(상세) |
| watch_sidebar_subs_label | Subscriptions | 사이드바 구분선 라벨(상세, 팔로우 있을 때만) |

## Watch — 상세 페이지 본문 (`app/watch/[id]/page.tsx`)

| 키 | 영어 원문 | 위치 |
|---|---|---|
| watch_detail_roundlabel_main | Main Round | 영상 위 라운드 배지 |
| watch_detail_roundlabel_prelim | Preliminary | 영상 위 라운드 배지 |
| watch_detail_staffpick | Staff Pick | 영상 위 배지(스태프픽일 때) |
| watch_detail_winner | 🏆 Winner | 영상 위 배지(수상작일 때) |
| watch_detail_rank1 | 🥇 1st Place | 메타 정보, 순위 표시 |
| watch_detail_rank2 | 🥈 2nd Place | 메타 정보, 순위 표시 |
| watch_detail_rank3 | 🥉 3rd Place | 메타 정보, 순위 표시 |
| watch_detail_winner_generic | 🏆 Winner | 메타 정보, 순위 없는 수상작 |
| watch_detail_views | {N} views | 메타 정보 (변수: 조회수) |
| watch_detail_comments_count | {N} comments | 메타 정보 (변수: 댓글수) |
| watch_detail_madewith | Made with {aiService} | 메타 정보, AI 툴 표시 (변수: AI 서비스명) |
| watch_detail_related_title | More from this season | 우측 사이드바 제목 |
| watch_detail_related_empty | Nothing else here yet. | 우측 사이드바, 관련 영상 없을 때 |
| watch_detail_related_views_likes | {N} views · {N} likes | 관련 영상 카드 (변수: 조회수·좋아요수) |

## Watch — 소셜 액션 (댓글·좋아요·팔로우·투표·공유·저장·신고)

| 키 | 영어 원문 | 위치 |
|---|---|---|
| watch_comments_count | {N} comments | 댓글 섹션 제목 (변수: 댓글수) |
| watch_comments_guidelines | Community Guidelines | 댓글 섹션, 우측 링크 |
| watch_comment_placeholder | Add a comment… | 댓글 입력창 placeholder |
| watch_comment_submit | Comment | 댓글 등록 버튼 (길이제약: 버튼) |
| watch_comment_signin_prompt | Sign in to comment… | 댓글, 비로그인 상태 버튼 |
| watch_comments_empty | No comments yet. Be the first. | 댓글 0개일 때 |
| watch_comment_edited | (edited) | 댓글, 수정된 경우 표시 |
| watch_comment_save | Save | 댓글 수정 중, 저장 버튼 (길이제약: 버튼) |
| watch_comment_cancel | Cancel | 댓글 수정 중, 취소 버튼 (길이제약: 버튼) |
| watch_comment_edit | Edit | 내 댓글, 수정 버튼 (길이제약: 버튼) |
| watch_comment_delete | Delete | 내 댓글, 삭제 버튼 (길이제약: 버튼) |
| watch_comment_delete_confirm | Delete this comment? | 삭제 확인 브라우저 대화상자 |
| watch_comment_report | Report | 남의 댓글, 신고 버튼 (길이제약: 버튼) |
| watch_comment_reported | Reported | 남의 댓글, 신고 완료 상태 (길이제약: 버튼) |
| watch_follow_following | Following {creatorName} | 팔로우 버튼 title 속성, 팔로우 중 (변수: 크리에이터명) |
| watch_follow_follow | Follow {creatorName} | 팔로우 버튼 title 속성, 미팔로우 (변수: 크리에이터명) |
| watch_follow_btn_following | Following | 팔로우 버튼 본문, 팔로우 중 (길이제약: 버튼) |
| watch_follow_btn_follow | Follow | 팔로우 버튼 본문, 미팔로우 (길이제약: 버튼) |
| watch_save_saved | Saved | 저장 버튼, 저장됨 (길이제약: 버튼) |
| watch_save_save | Save | 저장 버튼, 기본 (길이제약: 버튼) |
| watch_report_reported | Reported | 신고 버튼, 신고완료 (길이제약: 버튼) |
| watch_report_report | Report | 신고 버튼, 기본 (길이제약: 버튼) |
| watch_share_copied | Copied | 공유 버튼, 링크 복사됨 (길이제약: 버튼) |
| watch_share_share | Share | 공유 버튼, 기본 (길이제약: 버튼) |
| watch_staffpick_on | Staff Pick | 스태프픽 토글(관리자용), 켜짐 (길이제약: 버튼) |
| watch_staffpick_off | Mark Staff Pick | 스태프픽 토글(관리자용), 꺼짐 (길이제약: 버튼) |
| watch_vote_error_limit | You've used all {N} votes. Un-vote another to switch. | 투표, 한도 도달 에러 메시지 (변수: 투표 한도) |
| watch_vote_error_closed | Voting is closed. | 투표, 마감 후 클릭 시 에러 |
| watch_vote_notopen | Community voting is not open. | 투표 박스, 투표 시작 전 |
| watch_vote_title | Community vote | 투표 박스 제목 |
| watch_vote_count | {N} votes | 투표 박스, 총 투표수 (변수: 투표수) |
| watch_vote_remaining | {N} of {N} left | 투표 박스, 남은 투표 수(로그인 상태) (변수: 남은/한도) |
| watch_vote_closed_suffix | voting closed | 투표 박스, 마감 후 접미사 |
| watch_vote_btn_voted | ✓ Voted | 투표 버튼, 투표함 (길이제약: 버튼) |
| watch_vote_btn_vote | Vote | 투표 버튼, 기본 (길이제약: 버튼) |
| watch_vote_btn_closed | Closed | 투표 버튼, 마감 (길이제약: 버튼) |
| watch_vote_cap_used | All {N} votes used — un-vote one to switch. | 투표 박스, 한도 도달 안내 (변수: 투표 한도) |

## Watch — 점수 패널 (`ScorePanel.tsx`)

★AI가 생성하는 채점 코멘트(강점/약점/총평 문장)는 뺐다 — 영상마다 AI가 그때
쓰는 텍스트라 고정 UI 카피가 아니다. 아래는 고정 라벨만.

| 키 | 영어 원문 | 위치 |
|---|---|---|
| watch_score_title | Triple-AI score | 점수 패널 제목 |
| watch_score_intent | Intent / clarity | 점수 패널, 축 라벨 |
| watch_score_execution | Execution | 점수 패널, 축 라벨 |
| watch_score_originality | Originality | 점수 패널, 축 라벨 |

## 함께 표시 못한 것

- **FAQ #2 답변**(`landing_faq_a2`) — `lib/seasons.ts`의 `formatAccessCopy()`가
  멤버십·가격 조건에 따라 아예 다른 문장 구조를 낸다. 단일 원문으로 못 옮겨서
  뺐다 — 필요하면 그 함수만 따로 정리해서 올리겠다.
- **AI 채점 코멘트** — 영상마다 AI가 그때 생성하는 텍스트(위 참고). 고정 UI가
  아니라 뺐다.
- **aria-label만 있는 자리**(스크린리더 전용, 화면에 안 보임) — 예:
  "Menu"/"Notifications"/"Profile"/"Watch home" 등. 화면에 보이는 문구는
  아니라서 뺐다 — 필요하면 별도로 뽑겠다.
- **관리자 전용 문구** — `watch_staffpick_*` 2개는 참가자가 아니라 관리자만
  보는 버튼이다(어드민 로그인 시에만 노출). 목록엔 넣어뒀으니 판단은 맡긴다.
