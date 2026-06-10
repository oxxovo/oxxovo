# feat(main-round): 본선 리더보드 + 승인/override 파이프라인 (옵션 3)

> **base = `auth-cookie-sessions`** · compare = `feat/main-round-leaderboard`
> (base를 auth로 잡아 diff = 이 작업 delta만 깔끔히 표시. main 대비가 아님)
> 관련: `docs/main-round-pipeline-contract.md` · `docs/final-score-design.md`

## 요약

매주 시즌의 **본선 채점 → 결과 랭킹 → 수상 발표** 파이프라인을 완성합니다 (옵션 3 — AI 자동 채점 + admin 최종 승인). 끊겨 있던 채점 사이클의 **유일한 가운데 구간**을 채웁니다. 두 트랙 중 **본체(oxxovo)** 측 작업이며, **오스(oxxovo-scoring) `feat/main-round-worker`** 가 round='main' 데이터를 공급합니다.

> ⚠️ **Preview 검증용 PR.** prod 활성화는 **리허설(7/27~31) 후 main 일괄 머지** 시점 유지. 이 브랜치는 Vercel Preview에만 배포되어 **사용자 영향 0**.

## 변경 사항

### 본선 파이프라인 (이 작업의 핵심)
- **리더보드** `/admin/seasons/[id]/main-results` — `round='main'` `scoring_results`를 `computeFinalScore`(Layer-2) DESC 정렬. 공통 주제(`main_round_theme`) 1회 표시. 채점 완료(`judged_status='completed'`)만 final 인정. 데이터 없으면 빈 상태 렌더.
- **승인** `approveTop3Awards` — **서버에서 권위있게 재계산**한 Top 3 → `award_rank` 1/2/3 + `status='awarded'` + 상금 지급 요청 이메일(`saveAwardRank` 로직 헬퍼 `fireAwardPayoutEmail`로 추출·재사용).
- **override** `saveAwardOverride` — 부정/표절/시스템 오류 시 수동 순위 + **사유 필수**(`award_override_reason` 전용 컬럼). 수상권(1/2/3)은 `status='awarded'` 동반.
- **발표 활성화** — `status='awarded'` 전이가 기존 `WinnerCelebrationCard`(profile) + `awards_announcement_at` cron의 `ResultsAnnounced` 이메일을 켬. **새 발표 페이지 없음**(최소·정합).
- **공식 헬퍼** `lib/scoring.ts` `computeFinalScore(ai, community, season)` — Soak(시즌0~3)에선 `community_vote_weight=0`이라 `final == verified_score`. per-시즌 분기 없음.
- **마이그레이션** `reports/award_override_reason_2026-06.sql`, `reports/season_weights_check_2026-06.sql`(`ai+community=1` DB CHECK). 둘 다 ASCII-only(Supabase Editor 박스문자 누락 방지).
- **통합 계약** `docs/main-round-pipeline-contract.md` — 오스와의 컬럼/책임 경계(오스=Layer1 verified_score, 본체=Layer2 final_score).

### 끌려온 매주 시즌 admin 에픽 (빌드 의존성)
리더보드가 `ConfirmModal`·`grades.ts`(신규)·`lib/seasons.ts`·`lib/admin-i18n.ts`·`actions.ts`를 import하므로, 상호의존 단위인 admin 에픽(RecommendationsPanel, ApplicationsView, system-messages, CountdownTimer, 이메일 템플릿, 관련 reports/*.sql 등) 미커밋분이 함께 포함됩니다.

## 검증 포인트 (리허설 7/27~31)

- [ ] 오스 `round='main'` 채점 생성 → 리더보드에 final_score DESC로 자동 표시
- [ ] "상위 3 승인" → award_rank 1/2/3 + status='awarded' + 상금 이메일 1회(dedup) + 미수상 finalist 영향 없음
- [ ] override: 사유 없이 저장 차단, 수상권 override 시 status='awarded' 전이
- [ ] status='awarded' → profile WinnerCelebrationCard 표시 + awards_announcement_at 도달 시 ResultsAnnounced 이메일
- [ ] Soak 모드: 리더보드 final == verified (가중 1/0)
- [ ] `award_override_reason` 마이그레이션 적용 후 페이지 정상(미적용 시 컬럼 select 런타임 에러)

## 리스크

- **A** 본선 채점 데이터 의존: 오스 `feat/main-round-worker` 미머지/미가동 시 리더보드 빈 상태 → 빈 상태 정상 렌더로 완화.
- **B** 마이그레이션 선적용 필요: `award_override_reason` 없으면 페이지 런타임 에러 → 머지 전 적용 체크리스트.
- **C** status='awarded' 자동 전이: 승인이 발표 파이프라인(이메일+축하)을 켜므로, 승인 클릭 = 발표 시작. 의도된 동작이나 admin 인지 필요.
- **D** 에픽 동반 머지: 본선만 독립 머지 불가(상호의존). 계획상 리허설 후 일괄 main 머지라 정합.

## 머지 전 체크리스트

- [ ] `reports/award_override_reason_2026-06.sql` + `season_weights_check_2026-06.sql` prod 적용
- [ ] 오스 `feat/main-round-worker` 머지 + round='main' 채점 가동
- [ ] `/profile` Suspense fix 포함 확인(이 브랜치 1330a7f) — prod 빌드 통과 전제
- [ ] 리허설 전체 사이클 무인 검증 통과

🤖 Generated with [Claude Code](https://claude.com/claude-code)
