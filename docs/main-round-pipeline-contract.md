# 본선 파이프라인 통합 계약 (oxxovo 본체 ↔ oxxovo-scoring)

> 작성: 2026-06-04 · 작성자: 지수 · 승인: TK 대표님 (옵션 3)
> 관련: [[project-scoring-results-schema]] · [[project-final-score-design]] · [[project-main-round-single-submission]]
> 모델: **옵션 3 — AI 자동 채점 + admin 최종 승인.** AI 채점 100% 자동, admin은 검토/승인만(부정·시스템오류만 예외).

이 문서는 **두 레포가 본선(main round)에서 만나는 지점의 단일 진실원**. 컬럼명/책임 경계를 여기서 고정한다. 스키마 절대 진실은 `reports/scoring_results_migration_2026-05.sql`.

## 트랙 분담

| | 레포 | 작업 |
|---|---|---|
| **오스** | oxxovo-scoring | A1 batch.ts `round='main'` 워커 · A2 cron 트리거 · Top 3 추천 |
| **지수** | oxxovo 본체 | admin 본선 리더보드 · 승인 버튼 · override · 시상 발표 |

## 책임 경계 (가장 중요 — 혼동 금지)

- **오스 = Layer 1만.** `round='main'` scoring_results 행을 만들고 `verified_score`(intent/exec/orig/integrity를 `scoring_*_weight`로 합산한 AI 점수)를 기록. **오스는 final_score를 계산하지 않는다.**
- **본체 = Layer 2.** `verified_score`를 읽어 `computeFinalScore()`(`lib/scoring.ts`)로 final_score 도출 = 리더보드의 진실원천. Soak(시즌0~3)에선 `community_vote_weight=0`이라 `final_score == verified_score`.
- 따라서 오스의 Top 3 추천도 `verified_score DESC`로 충분(Soak에서 final과 동일). **단 수상 순위의 진실원천은 본체 리더보드** — 오스 추천은 참고/보조.

## 오스가 쓰는 scoring_results 컬럼 (round='main')

`reports/scoring_results_migration_2026-05.sql` 그대로. 예선과 **동일 테이블·동일 컬럼**, `round` 값만 `'main'`:

- 식별: `application_id` (FK), `season_id`, `round = 'main'` — **UNIQUE(application_id, round)** 이므로 예선 행과 별개로 1행.
- 진행: `judged_status`('pending'|'in_progress'|'completed'|'failed'), `processing_attempts`, `error_message`.
- raw/consensus 점수: 예선과 동일 컬럼(`claude_*`, `gpt_*`, `gemini_*`, `consensus_*`).
- **최종**: `verified_score`(NUMERIC), `grade`(본체 `lib/grades.ts`가 derive하므로 오스는 NULL 둬도 됨 — 본체가 `deriveGrade` 폴백).
- integrity: `integrity_flag`/`integrity_confidence`/`integrity_explanation_ko|en`/`integrity_recommendation` — 본선에도 동일 적용(부정 발견 시 admin override 근거).
- 메타: `total_cost_usd`, `total_duration_ms`, `started_at`, `judged_at`.

## 입력 — 오스가 본선 영상을 어디서 읽나

`genesis_applications` (단일 제출 모델 [[project-main-round-single-submission]]):
- `main_round_video_url` (제출된 본선 영상 URL)
- `main_round_submitted_at` (제출 시각, NOT NULL = 제출 완료)
- 대상 필터: `status = 'main_round_submitted'` 이고 `main_round_submitted_at IS NOT NULL`.

## status 전이 (본선) — 오스 측 구현

```
main_round_submitted ──(오스 batch PICK, round='main' INSERT in_progress)──▶ (status 유지)
  ──(채점 성공)──▶ scoring_results.judged_status='completed' (genesis status는 그대로 main_round_submitted)
  ──(integrity high)──▶ integrity_flag=true 기록 (status 자동 변경 금지 — admin이 리더보드에서 override/검토)
  ──(실패 max N회)──▶ judged_status='failed' (genesis status는 'rejected'로 자동 매핑 금지!
                       [[project-system-error-not-user-rejection]] — admin 검토 흐름)
```

⚠️ **예선과 다른 점**: 본선은 status를 'eligible'/'selected'로 안 바꾼다. 채점 완료해도 genesis status는 `main_round_submitted` 유지. **수상(award_rank) 결정은 본체 admin 승인이 전담** (옵션 3). 오스는 점수만 기록.

## A2 cron 트리거 (오스)

- 발사 조건: `now >= seasons.main_round_end_at` (제출 마감 후) 인 시즌의 `main_round_submitted` 행 중 `round='main'` scoring_results 없는 것.
- season status 머신에 의존하지 말 것 — 타임스탬프 직접 읽기 (본체 #3 cron과 독립).
- 주기/백오프는 예선 batch 패턴 재사용 ([[project-scoring-results-schema]] 재시도 패턴).

## 본체가 보장하는 것 (오스가 신뢰해도 됨)

- `seasons.ai_score_weight + community_vote_weight = 1` (DB CHECK `seasons_score_weights_sum_chk`, 2026-06-04 적용).
- `computeFinalScore`는 `verified_score`만 있으면 Soak에서 final 산출 (community 인자 null 허용).
- `award_rank` / `award_override_reason`은 **본체 admin 전용** — 오스는 건드리지 않는다.

## 동기화 규칙

스키마 변경 시 양 세션 모두 이 문서 + `reports/scoring_results_migration_2026-05.sql` 갱신. 컬럼명 불일치 = 본선 채점 silent 실패.
