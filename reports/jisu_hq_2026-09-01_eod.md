# 지수 본체 2026-09-01 EOD — AI 채점 재설계 준비 (B·D 아암 완료, C 대기)

**내일 AI 채점 재설계에 들어간다. ⛔고치지 마라·커밋하지 마라·배포하지 마라 — 오늘은 전부 조사/실험/설계, 코드 변경 0건.**

---

## ① 오늘 끝난 것

- 예비 주행(season_test) 0~10 전 단계 통과 (08-31 EOD에서 이어짐)
- locale 배포(`139af67`) + e2e 검증
- `/rules` 4건 · 랜딩 FAQ #8 · 챗봇 KB 전면 재작성
- 화면 대장 완성
- **B·D 아암 실험 — 온도·프레임 둘 다 기각.** 아래 ③ 참조.

---

## ② 오늘 잡은 결함 5가지

1. **CRON_SECRET 불일치** — Vercel "Sensitive" 플래그라 `vercel env pull`로도 실값 확인 불가. 재발급으로 해소했으나 새 값이 채팅 로그에 남음(아래 되돌리기 참고).
2. **SEASON_ID가 season-blind가 아니다** — 채점 워커가 `SEASON_ID`/`ROUND` env var로 고정. "season-blind"라고 했던 이전 판단은 틀렸음(TK 정정). **조용한 실패** 유형.
3. **⛔채점 미완 상태에서 결과가 확정된다 — 가장 심각.** `advance_season_finalists` 게이트(`app/api/cron/season-tick/route.ts:438`)가 pending/in_progress 잔여 건수를 안 봄. backlog `c-scoringsilent0`, 기한 11/5 전.
4. **`required_elements` 죽은 컬럼** — DB 스키마엔 있지만 `oxxovo-scoring/src/` 전체에 쓰는 코드가 없음(grep 0건).
5. **★★3사 중 2사가 본선에서 무변별** — GPT/Gemini가 이행 계단(1/2/3개)을 구분 못 하고 거의 같은 값을 냄. 오늘 B·D 아암으로 "온도·프레임이 원인이 아니다"까지 좁혔음(아래 ③).

(①~④는 08-31 EOD에서 최초 발견, 오늘 재확인. ⑤가 오늘 재설계 착수의 직접 근거.)

---

## ③ B·D 아암 실험 결과 — 온도·프레임 둘 다 기각

같은 본선 6편(round=main, `scoring_results` 테이블 전체에서 유일한 6행 — Walk/Morph/Runway/Fusion/Street/Weave), 같은 `season_test.main_round_theme` statement, **DB 쓰기 0건**(결과는 전부 `oxxovo-scoring/reports/*.json` 파일로만).

| | A(오늘표, 프로덕션) | B(temp0.3) | ΔB | D(frame24) | ΔD |
|---|---|---|---|---|---|
| Walk (wearable) | 81.12 | 79.43 | −1.68 | 80.28 | −0.83 |
| Morph | 81.12 | 81.12 | +0.00 | 82.78 | +1.67 |
| Runway (fashion) | 80.78 | 79.18 | −1.60 | 80.03 | −0.75 |
| Fusion | 79.18 | 80.02 | +0.83 | 80.28 | +1.10 |
| Street | 78.35 | 77.68 | −0.67 | 76.87 | −1.48 |
| Weave (fabric) | 49.13 | 52.20 | +3.07 | 53.80 | +4.67 |

- **B(temp만 0→0.3)**: GPT는 5편 중 4편에서 90/85/80 그대로, Gemini도 4편에서 90/85/70 그대로. 샘플링을 열어도 이행 계단을 구분 못 함 → 온도 기각.
- **D(프레임만 늘림)**: 목표 40장이 **OpenAI GPT-4o 조직 TPM 한도(30,000)에 구조적으로 막혀**(40프레임=31,838토큰, 재시도로 안 풀림) 24장으로 낮춰 재실행. 여기서도 GPT/Gemini 대부분 그대로 → 프레임 기각(단, 목표치 40은 못 채움 — 진짜로 더 늘리려면 OpenAI 계정 등급 업그레이드 필요, backlog로 미룸).
- **고문이 프롬프트에서 직접 찾은 것(본부 확인)**: Integrity 축에만 점수대 밴드가 있고, 실제로 갈리는 축도 Integrity(Weave 0 vs 나머지 100)뿐 — 3개 품질 축엔 밴드가 하나도 없음. "밴드를 주면 갈린다"는 증거가 코드 안에 이미 있었음.
- 실지출: B $0.78 + D $1.68 = **$2.46**.

전체 근거 파일: `oxxovo-scoring/reports/rescoring_arms_ABD_combined_2026-09-01.json`(A/B/D 통합, C는 `null`로 비워둠).

---

## ④ ⛔ 되돌리기 — 잊으면 사고다 (어느 것도 아직 안 함)

| 항목 | 현재 상태 | 필요 조치 |
|---|---|---|
| **Railway `SEASON_ID`** | `season_test` | `season_0`으로 **명시 복귀** — `rehearsal-reset.mjs`가 자동 시도(best-effort). 다음 리셋 때 성공 여부 로그 확인 |
| **Railway `ROUND`** | `main` | `application`으로 명시 복귀 |
| **CRON_SECRET** | 새 값이 채팅 로그에 남음(08-31, TK 승인하 노출) | 리허설 완전히 끝나면 재발급 |
| **cap 100 / advance_min 10 / watch_fixture_visible** | season_test 리허설용으로 바뀐 상태 | 리허설 재개 전 원복 확인 |

**리허설은 보류다 — 채점이 서고 나서 다시 돈다.** 위 되돌리기도 리허설 재개 시점에 같이 처리.

---

## ⑤ 내일 첫 순서 — 고문 P0

1. **새 지침서 도착 대기 (고문)** — `buildScoringPrompt` 전문은 이미 전달 완료(오늘, 세 축 문항 전부).
2. **Compliance Judge 분리 설계**
   - Pass 1 = R1/R2/R3 true/false/uncertain + 근거
   - Pass 2 = Compliance를 안 보고 3축만 채점
3. **C 아암 하니스 — ✅오늘 이미 준비 완료.** 아래 ⑥ 참고, 바로 쓰면 됨.
4. **A·B·D 결과 통합 — ✅오늘 이미 완료.** `reports/rescoring_arms_ABD_combined_2026-09-01.json`.

→ 내일은 사실상 ①②만 남음. ③④는 오늘 끝냈다.

---

## ⑥ C 아암 하니스 — 지침서 도착 시 실행 절차 (오늘 준비 완료, `oxxovo-scoring/`)

1. `_new_rubric_prompt_2026-09-01.ts` 열어서 `buildNewRubricPrompt()` 본문을 고문 지침서 문구로 교체. (지금은 현행 프롬프트와 동일한 placeholder — 배선 검증용, 아직 실행 안 함, 비용 0)
2. Integrity 확장이 바뀌면 같은 파일의 `NEW_RUBRIC_CLAUDE_EXTENSION`도 같이 검토.
3. `npx ts-node _probe_retest_newrubric_2026-09-01.ts` 실행 — 같은 6편, temp0, 프레임 현행(=A와 동일), DB 쓰기 0건. 결과 → `reports/retest_newrubric_<시각>.json`.
4. `_merge_arms_2026-09-01.ts`에 그 파일 로딩 한 줄 추가 후 재실행 → 4아암(A/B/C/D) 통합 표 완성.
5. `npx tsc --noEmit -p tsconfig.json`으로 배선 타입체크는 오늘 이미 통과 확인됨(scorer.ts/extractor.ts 미변경).

비용 예상: 6편 × 1회 × Triple-AI, 프레임 현행 기준 ≈ B와 비슷한 $0.7~1.

---

## 오늘 만든 파일 (전부 미커밋, 조사/실험용, `_`/`zz_` 접두— production 코드 0건 변경)

`oxxovo-scoring/`: `_probe_current_prompt_dump_2026-09-01.ts` · `_probe_main_round_6_ids_2026-09-01.ts` · `_probe_main6_full_2026-09-01.ts` · `_probe_retest_temp03_2026-09-01.ts`(B) · `_probe_retest_frames40_2026-09-01.ts`(D, 실제 24장) · `_new_rubric_prompt_2026-09-01.ts`(C 프롬프트 자리) · `_probe_retest_newrubric_2026-09-01.ts`(C 하니스) · `_merge_arms_2026-09-01.ts`
`oxxovo/scripts/`: `zz_probe_season_test_scoring_config_2026-09-01.mjs`

## 다음 창 진입 시 순서

1. 고문 새 지침서 받으면 → ⑥ 절차대로 C 아암 실행.
2. Compliance Judge 분리 설계 착수(②).
3. 리허설/되돌리기는 채점 재설계 완료 후.
