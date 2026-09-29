# 지수 본체 EOD — 2026-09-06

다음 세션은 이 파일 하나만 읽고 재개. ⛔오늘 배포까지 끝남 — 코드/커밋/배포 새로 건드리지 말 것
(대표님 명시 지시, "내일 이어간다").

## 오늘 끝난 것

1. **3사 최신 모델 조사 + 재채점** — Claude Opus5/GPT-5.6 Sol/Gemini 3.8 Flash로 43편 재채점
   (`oxxovo-scoring/reports/rescore_latest_A_2026-09-06_*.json`, 9/5 구모델 표와 비교
   완료 — `reports/rescore_latest_A_2026-09-06_analysis.md`).
2. **Rubric v2(고문 확정 문안, 정적이미지 게이트+temporalDevelopment) 프로덕션 승격** —
   `oxxovo-scoring/src/scorer.ts`의 `buildScoringPrompt`에 반영. DB 컬럼명 불변
   (`extractFlatScores()`가 새 중첩 JSON을 옛 평평한 이름으로 매핑) — 별도 rubric
   마이그레이션 없음. 3사 실측 통과.
3. **Holdout 12편 검증** — 정지형4(신규, ffmpeg)+느린유효4(A05·A08·demo_astronaut·
   cf_noira)+명확한동적2(A09·A10)+경계2(미제작, 보류) 중 실제로 돈 건 정지형4+느린유효4.
   **Sensitivity·Specificity 둘 다 통과**(overall 대비 상대델타 기준, cf_noira -3.80로
   ±4 이내 확인).
4. **예비 심사관 시험(OpenRouter)** — Grok 4.6(R1)·Qwen3.8 Max(R2, max_tokens=8000
   아니면 응답 빈다) 채택. **Mistral Large 3 탈락**(OpenRouter 경유 이미지 8장 하드
   리밋, 실측 확인 — `error code 3051`).
5. **상태기계 구현**(`oxxovo-scoring/src/batch.ts`, `scorer.ts`) — Promise.all 제거,
   슬롯 3개 독립(claude/gpt/gemini, 각자 status/attempts/slot), 8단계
   (PENDING→PRIMARY_JUDGING→RETRY→RESERVE_JUDGING→3_VALID→RECHECK→FINAL→PUBLISHED),
   벤더별 재시도표(Claude2/60s·GPT3/90→180s·Gemini2/90s), 예비 승격(R1 Grok→R2 Qwen),
   Consensus 등급(High/2-of-3/Low)+RECHECK 자동재심 1회 상한.
6. **route.ts:438 게이트 + 12시간 창**(`oxxovo/app/api/cron/season-tick/route.ts`) —
   날짜(scoring_complete_at) AND 전원 judgment_state=FINAL/PUBLISHED. 미완료면
   advance_season_finalists 미호출("발표 연기" 그 자체, 탈락/2사평균/이월 전부 없음) +
   관리자 1일1회 메일(fixture 시즌 제외). batch.ts의 pickPending에 12시간
   사전마감 스로틀(신규 후보만 안 받음, 진행중 건 계속).
7. **admin RECHECK 화면** — `app/admin/applications/{page.tsx,ApplicationsView.tsx,
   RecommendationsPanel.tsx}`, `lib/admin-i18n.ts`. judgment_state='RECHECK' 읽기전용
   표(FlaggedAppsTable 재사용), override/탈락 버튼 없음.
8. **마이그레이션 Run 완료**(대표님, 3 STEP 전부 성공) — `reports/scoring_state_
   machine_migration_2026-09-06.sql`.
9. **커밋·배포 완료, SHA 대조 확인**:
   - `oxxovo-scoring` `e437192` (로컬=원격)
   - `oxxovo`(메인앱) `22e4853` (로컬=원격, `https://www.oxxovo.ai/api/version` 실측
     `{"sha":"22e4853","dirty":false}` 확인)

## ⚠️ 내일 첫 작업 — 답 3 (오늘 이미 답했지만 명시적으로 재확인 요청됨)

① **백필 필요함, 아직 미실행.** 마이그레이션 직후 실측: `scoring_results` 기존 22행
   (전부 season_test, production 시즌은 0건)이 `judgment_state='PENDING'`으로 들어감 —
   `judged_status='completed'` 21행(예선15+본선6)이 이 상태면 새 게이트("전원 FINAL")를
   영원히 못 넘는다. `failed` 1행은 의도적으로 FINAL 제외 대상(실제 3 valid judgments
   못 받았음 — fixture라 알림도 안 감, 막혀 있는 게 정상).
   **SQL(아직 대표님 미실행, 다음 세션 첫 확인 사항)**:
   ```sql
   UPDATE public.scoring_results
   SET judgment_state = 'FINAL',
       rubric_version = COALESCE(rubric_version, 'legacy-pre-2026-09-06'),
       judge_version = COALESCE(judge_version, 'legacy-pre-2026-09-06')
   WHERE judged_status = 'completed'
     AND judgment_state = 'PENDING'
   RETURNING id, application_id, season_id, round, judged_status, judgment_state;
   ```
② **OPENROUTER_API_KEY = 들어가 있음.** 확인 완료(`railway run -s oxxovo-scoring
   -e production -p fe9edc4a-2173-4d1a-bb76-ab374ef1e517`, project=trustworthy-
   enchantment). 재확인 불필요 — 이미 실측함.
③ **본선 게이트 있음.** `lib/awards-gate.ts` Gate 2(`scoring_incomplete`,
   `app/admin/applications/actions.ts:464`가 `judged_status==='completed'`(round=
   'main')로 카운트) — 이번 슬롯분리로 judged_status='completed'가 judgment_state=
   FINAL일 때만 찍히므로 **자동 강화됨**, 코드 추가 불필요. 수동 버튼("Approve Top 3
   Awards")이라 route.ts류 자동 우회 자체가 없음.

## 확인/판단 대기 중인 것 (내가 임의로 안 정함)

- **"발표 12시간 전" 해석** — `scoring_complete_at` 기준으로 구현(대표님 확정: 맞음,
  진출자 확정+결과발송이 이 값). `awards_announcement_at`(시상 발표)은 별개 확인됨.
- **경계 2편(Holdout)** — Kling 생성 필요, 아직 미제작. Sensitivity·Specificity는
  이미 정지형4+느린유효4로 통과 확인됐으니 급하지 않음 — 필요시 다음에.
- **지수2 인계 문서**(`reports/scoring_state_machine_handoff_to_jisoo2_2026-09-06.md`)
  — 오늘 지시로 상태기계를 내가 직접 구현하게 되면서 이 인계서와 실제 구현이 겹침.
  지수2가 별도로 이미 손댔는지 미확인 — 다음 세션 시작 시 충돌 여부 확인 필요.
- **프로덕션 Rubric v2가 Pass 1(Compliance, 본선 주제 필수요소 체크)은 다루지 않음** —
  원래 프로덕션에 없던 별개 기능, 이번 스코프 밖으로 명시적으로 남김.

## 참고 파일

- `reports/rescore_latest_A_2026-09-06_analysis.md` — 43편 재채점 vs 9/5 비교
- `reports/rubric_static_image_gate_design_2026-09-06.md` — Rubric 설계+Holdout 검증 근거
- `reports/scoring_state_machine_handoff_to_jisoo2_2026-09-06.md` — 상태기계 설계 원안(지수2용, 위 참고)
- `reports/scoring_state_machine_migration_2026-09-06.sql` — 오늘 Run된 마이그레이션
- `oxxovo-scoring/reports/prelim_judges_2026-09-06.json` — Grok/Qwen/Mistral 예비심사관 시험 원본
- `oxxovo-scoring/reports/holdout_47_2026-09-06_*.json` — Holdout 47편(43+정지형4) 원본
