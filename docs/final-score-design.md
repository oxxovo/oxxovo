# final_score 설계 (Layer-2 가중합산)

> 작성: 2026-06-04 · 작성자: 지수 · 승인: TK 대표님
> 관련: [[project-weekly-season-system]] · [[project-scoring-results-schema]] · [[feedback-no-hardcode]]

## 결정 (TK, 2026-06-04)

- **공식**: `final_score = ai_score × ai_score_weight + community_score × community_vote_weight`
- **적용 범위 = 본선(round='main')만.** 예선 Top N 선정은 시즌 무관 항상 순수 AI(`verified_score`). 커뮤니티 1인1표가 500명 예선을 투표할 수 없기 때문.
- **저장 방식 = 헬퍼 온더플라이** (`lib/scoring.ts`). 새 컬럼 없음 — Soak 모드에선 `final == verified_score`라 redundant. 시즌 4 투표 설계 시 컬럼화 재검토.
- **per-시즌 분기 금지** — 가중치는 전적으로 `seasons` 행에서 읽음.

## 두 개의 가중치 레이어 (혼동 주의)

| | 무엇 | 가중치 | 누가 적용 |
|---|---|---|---|
| Layer 1 | intent/exec/orig/integrity → `verified_score` | `scoring_*_weight` | **oxxovo-scoring** (기록 시) |
| Layer 2 | `verified_score`(=ai_score) + community → `final_score` | `ai_score_weight` / `community_vote_weight` | **oxxovo 본체** (`lib/scoring.ts`) |

`final_score`는 새 AI 채점이 아니라 기존 `verified_score` 재사용.

## Soak 모드 (시즌 0~3)

- `community_vote_weight = 0`, `ai_score_weight = 1` (불변식 합=1).
- → `final_score == verified_score` 자동. 투표 시스템 불필요.
- season_0 DB 검증 완료(2026-06-04): ai=1 / community=0.

## 시즌 4+ 전환 (코드 변경 0 목표)

DB 값만 `0.3 / 0.7`로 변경 + 아래 deferred 항목 구현:

### ⏳ Deferred — 시즌 4 전 별도 작업 (지금 의도적으로 안 만듦)

1. **votes 테이블** — 본선 50인 대상 1인1표. (작성자 user_id, 대상 application_id, season_id, UNIQUE(season_id, voter_user_id) 어뷰징 방지.)
2. **community_score 정규화** — 표수(count) → 0~100 스케일. `verified_score`와 같은 축이어야 가중합이 의미 있음. 후보: `votes_for / max_votes × 100` 또는 백분위. **시즌 4 설계 시 확정.**
3. **community_score 공급** — 집계값을 `computeFinalScore(aiScore, communityScore, season)`의 2번째 인자로 전달.

> silent cap 아님 — 명시적 deferral. `computeFinalScore`는 이미 `communityScore` 인자를 받고, 시즌4+ 가중치에서 `communityScore == null`이면 `null`(votes pending) 반환하도록 설계됨.

## 본선 결과 랭킹/표시 — 구축됨 (2026-06-04, 옵션 3)

`computeFinalScore` 소비자 = **admin 본선 리더보드** 완성:
- `/admin/seasons/[id]/main-results` — round='main' `scoring_results`를 `computeFinalScore` DESC로 랭킹, 공통 주제(`main_round_theme`) 1회 표시.
- **승인**: 서버 재계산 Top 3 → `award_rank` 1/2/3 + `status='awarded'` + 상금 이메일 (`approveTop3Awards`).
- **override**: 부정/오류 시 수동 순위 + 사유(`award_override_reason` 전용 컬럼, `saveAwardOverride`).
- **발표 활성화**: `status='awarded'` 전이가 profile `WinnerCelebrationCard` + `awards_announcement_at` cron의 `ResultsAnnounced` 이메일을 켬.
- 데이터(round='main')는 oxxovo-scoring A1+A2(완성)이 본선 종료 후 생성 — 없으면 빈 상태 렌더.
- 통합 계약: `docs/main-round-pipeline-contract.md`.

## 구현 산출물 (2026-06-04)

- `lib/scoring.ts` — `computeFinalScore()` 순수 함수. tsc clean, 공식 4케이스 검증.
- `reports/season_weights_check_2026-06.sql` — DB CHECK `ai_score_weight + community_vote_weight = 1` (defense-in-depth). **TK 적용 대기.**
