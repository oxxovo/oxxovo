# 지수 본체 2026-08-31 EOD — AI 채점 전면 재설계 착수 자료

**TK 확정(2026-08-31 저녁): AI 채점 전면 재설계, 내일부터, 고문 6층 구조 방향.**
근거 = 이 문서 ①의 본선 6편 표. **리허설 실주행(TK·배우자 참여)은 보류** — 채점이 재설계 중이라 지금 돌려도 같은 결과, 재설계 후 재개.

**다음 창 첫 작업 = 온도 시험.** 같은 본선 6편, `PRODUCTION_TEMPERATURE`만 0→0.3으로 바꿔 실행(약 $1). 갈리면 원인=온도, 안 갈리면 원인=프롬프트 구조 — 재설계 방향을 이걸로 가른다.

---

## ① 오늘 예비 주행(season_test, 16편 시드) — 단계별 결과

| 단계 | 결과 | 비고 |
|---|---|---|
| 0 status | ✅ | baseline, 16편 pending, 날짜 전부 null |
| 1 reset | ✅ | 16편 그대로 16개(안 지워짐), advance_min=6 유지 확인 |
| 2 open | ⛔→✅ | **CRON_SECRET 401로 1차 실패**(아래 막힌 것 참고), 재발급 후 통과. draft→active 확인. `/watch`·랜딩·로비 3곳 anon 접근으로 직접 확인 — 화면엔 안 샘(단, `seasons_public` 뷰는 anon에 season_test 행 자체를 노출함, 참가작 데이터는 0건) |
| 3 close | ✅ | active→closed |
| 4 buffer-done | ✅ | scoring_start_at 과거로, 워커 게이트 열림 |
| 5 채점(예선) | ✅(15/16) | 아래 예선 표. 1편(TEST-01) MAX_RETRIES 3회 소진, 영구 pending(아래 "막힌 것" 참고) |
| 6 결과(advance) | ✅ | 정확히 6명 진출(`advanced:6, rejected:9, nTarget:6`), 결과메일 15/15 시도(email_logs 전부 status='sent' — Resend API 호출 성공 기준, 실제 반송은 Resend 대시보드에서 확인 필요) |
| 7 main-open | ✅ | `getRevealedTheme()` 직접 호출로 twistRevealed=true, twist/mainTheme 값 확인 |
| 8 본선 제출 | ✅ | `rehearsal-submit-main.mjs`(다른 세션이 전날 저녁까지 편집하던 파일) — 6명 전부 1:1 배정, status 전부 main_round_submitted로 전이. **막히지 않음** |
| 9 vote | ✅ | community_vote_start/end_at 열림 확인(코드 경로만 확인, 실투표는 스킵 — 실계정 훑는 위험 때문에 TK 지시로 보류) |
| 10 채점(본선) | ✅(6/6) | 아래 본선 표. **오늘 재설계 결정의 직접 근거** |

### 막힌 것 4가지

1. **CRON_SECRET 미스매치(2 open 1차 시도)** — 401. Vercel이 "Sensitive" 플래그라 `vercel env pull`로도 실값 확인 불가. 새 값 64자 무작위 재발급 → `.env.local`+Vercel 양쪽 반영 → 재배포 → 401 해소.
2. **SEASON_ID 순방향 가드(2 open 2차 시도)** — season-tick의 `STATUS_RANK`(draft:0/upcoming:1/active:2/closed:3/completed:4)는 **역행 금지**. CRON_SECRET 디버깅에 시간을 쓰는 사이 신청 창(10분)이 자연히 닫혀 draft→closed로 건너뜀 — 재시도 시 `REHEARSAL_WINDOW=60`으로 여유 확보.
3. **채점 워커가 "season-blind"가 아니다** — `SEASON_ID`(기본 season_0), `ROUND`(기본 application) 둘 다 env var로 고정. 이전에 이 세션이 "season-blind"라고 한 건 틀렸음(TK 정정). 본선 채점은 지금 프로덕션에 **자동 트리거가 아예 없다**(`ROUND=main` 배포 설정 자체가 없었음) — 오늘 수동으로 켜야만 돌았다.
4. **⛔채점 미완 상태에서 결과가 확정된다 — 가장 심각.** `advance_season_finalists`를 부르는 게이트(`app/api/cron/season-tick/route.ts:438`)는 `scoring_complete_at`을 **예정 일정(날짜)으로만** 본다, pending/in_progress 잔여 건수는 전혀 안 봄. 실제로 재현: TEST-01이 채점 중(재시도 소진 직전)인데 나머지 15편으로 결과가 확정·발송됨. TEST-01은 이후 MAX_RETRIES 3회 소진 → `status='pending'` 영구 고정, 선정도 탈락도 아님, 결과 메일도 못 받음, 재시도도 다시 안 됨, **관리자 알림 0건**(콘솔 로그 한 줄뿐). season-tick을 한 번 더 쳐도 재계산 안 됨(`advancements: []`, no-op). `oxxovo-scoring/src/recommendations.ts:193-217`에 이미 이 정확한 함정이 문서화돼 있었음(다른 기능—Top N 추천—은 8/6에 우회했지만 실제 진출 확정 게이트는 그 우회가 안 적용됨). **backlog `c-scoringsilent0`에 최우선으로 올림, 기한 11/5(본선 예선 마감) 전.**

### 예선 16편 원본 표 (verified_score 내림차순, 15 completed + 1 failed)

| application | 상태 | verified | grade | Claude I/E/O | GPT I/E/O | Gemini I/E/O | cost | ms |
|---|---|---|---|---|---|---|---|---|
| f4180a2b | completed | 69.05 | AVERAGE | 25/62/35 | 80/85/70 | 100/85/60 | 0.1280 | 11045 |
| 04f71883 | completed | 68.03 | AVERAGE | 25/68/35 | 70/85/60 | 100/90/50 | 0.1284 | 12399 |
| 0ec60afd | completed | 67.97 | AVERAGE | 25/72/35 | 70/85/60 | 100/80/60 | 0.1288 | 12155 |
| 6a26cd14 | completed | 67.78 | AVERAGE | 25/68/35 | 70/80/65 | 100/85/60 | 0.1278 | 11025 |
| e05eeff5 | completed | 67.70 | AVERAGE | 25/68/30 | 70/85/60 | 100/85/60 | 0.1276 | 11024 |
| 684437ae | completed | 67.22 | AVERAGE | 25/62/35 | 70/85/60 | 100/85/60 | 0.1291 | 12176 |
| 14aedb77 | completed | 67.13 | AVERAGE | 25/72/35 | 70/85/60 | 100/80/50 | 0.1279 | 11922 |
| b442112b | completed | 66.62 | AVERAGE | 25/58/35 | 70/85/60 | 100/85/60 | 0.1293 | 79578 |
| fb17a651 | completed | 66.13 | AVERAGE | 25/72/35 | 70/85/60 | 100/90/20 | 0.1280 | 77942 |
| e5e598b6 | completed | 65.72 | AVERAGE | 25/72/30 | 70/85/60 | 100/90/20 | 0.1279 | 11875 |
| 137a2d27 | completed | 65.13 | AVERAGE | 25/62/30 | 70/85/60 | 100/85/40 | 0.1286 | 11919 |
| b680f142 | completed | 65.03 | AVERAGE | 25/58/35 | 70/85/60 | 100/80/50 | 0.1279 | 11370 |
| bd69ac09 | completed | 64.37 | AVERAGE | 25/68/30 | 70/85/60 | 100/85/20 | 0.1282 | 11521 |
| 81a8f706 | completed | 62.87 | AVERAGE | 25/58/30 | 70/85/60 | 100/85/20 | 0.1283 | 12072 |
| 7b5f6123 | completed | 58.58 | ADEQUATE | 25/55/20 | 70/80/60 | 100/70/20 | 0.1291 | 13611 |
| 316e50e9(TEST-01) | **failed** | — | — | — | — | — | — | — |

**주목**: Claude intent 항상 25(분산 0), Gemini intent 항상 100(분산 0), GPT intent도 거의 70 고정. 실제 편차는 execution·originality 축에서만 남. 원인 후보: 16개 시드 계정 전부 "이건 파이프라인 검증용입니다" 류 자기지시적 creator_statement를 씀 — Claude는 이를 "진짜 창작의도 없음"으로, Gemini는 "명시한 목적 달성"으로 정반대 해석(`ai_outputs` 원문 4편 대조 완료, 패턴 일관).

### 본선 6편 원본 표 (제니3가 고른 이행 계단 0·1·2·2·3·3)

| 작품 | 필수조건 이행 수 | Claude I/E/O | GPT I/E/O | Gemini I/E/O | 최종점수 | 등급 |
|---|---|---|---|---|---|---|
| Walk | 3 | 82/75/68 | 90/85/80 | 90/85/70 | **81.12** | EXCELLENT |
| Morph | 3 | 82/75/68 | 90/85/80 | 90/85/70 | **81.12** | EXCELLENT |
| Runway | 2 | 85/78/55 | 90/85/80 | 90/85/70 | **80.78** | EXCELLENT |
| Fusion | 2 | 78/72/55 | 90/85/80 | 90/85/70 | **79.18** | SKILLED |
| Street | 1 | 78/72/45 | 90/85/80 | 90/85/70 | **78.35** | SKILLED |
| Weave | 0 | 35/62/45 | 40/70/60 | **0**/65/40 | **49.13** | NEEDS_WORK |

**핵심 발견 4가지(TK가 재설계 근거로 확정):**
1. GPT·Gemini는 이행 1개 이상인 5편 전부에 **세 축 전부 완전히 같은 점수**를 줌(GPT 90/85/80, Gemini 90/85/70) — 이행 수(1/2/3)를 전혀 구분 못 함.
2. 유일하게 갈리는 경계는 "인물 있음/없음"(Weave 0개) 하나뿐 — 이분법.
3. `claude/gpt/gemini_required_elements` 컬럼 — **DB 스키마엔 있지만 `oxxovo-scoring/src/` 전체에 이 문자열 자체가 없음**(grep 0건). 플래그로 꺼진 게 아니라 애초에 쓰는 코드가 없는 죽은 컬럼.
4. 이행 계단(0·1·2·2·3·3)이 점수에 안 보임 — 인물 유무 하나만 큰 격차(49→78+), 그 안(1/2/3)은 거의 평평(81.12→80.78→79.18→78.35).

---

## ② 되돌리기 목록 — 잊으면 사고다

| 항목 | 현재 상태 | 필요 조치 |
|---|---|---|
| **Railway `SEASON_ID`**(`trustworthy-enchantment/oxxovo-scoring`) | `season_test`(오늘 리허설용) | `season_0`으로 명시 복귀 — **`rehearsal-reset.mjs`가 이제 자동으로 시도함**(best-effort, railway CLI 실패 시 수동 안내 출력). 다음 리셋 실행 시 로그로 성공 여부 확인할 것 |
| **Railway `ROUND`**(같은 서비스) | `main`(본선 채점용) | `application`으로 명시 복귀 — 위와 같은 자동 되돌리기에 포함시킴(오늘 추가) |
| **CRON_SECRET** | 새 64자 값이 **이 대화 채팅에 그대로 남았다**(TK 승인하에 붙여넣기 위해 노출) | **리허설 완전히 끝나면 한 번 더 재발급 필요**(TK 지시). 오늘 만든 값은 채팅 로그에 남아있어 그 자체로 노출된 것으로 간주할 것 |
| `advance_min`(season_test) | 6, 오늘 하루 종일 **한 번도 안 바꿈**(reset이 되돌리지 않는지 여러 번 확인) | 손 안 댐 — 다음 실주행에서 참가 인원 규모가 달라지면 그때 재확인 필요 |
| `watch_fixture_visible`(season_test) | `false`(오늘 확인, 안 건드림) | 다음에 누군가 실주행 리허설을 공개로 돌리려고 `true`로 켜면, 끝난 뒤 다시 `false`로 되돌릴 것 — 오늘은 해당 없음 |
| **DB `main_round_theme`의 CRLF 오염** | 정리 SQL 실행 완료(`has_cr=false` 확인) | 완료, 재확인 불필요 |

---

## ③ 재설계 착수 자료

### buildScoringPrompt 전문 (`oxxovo-scoring/src/scorer.ts:219-278`)

```
You are an AI evaluator for OXXOVO — a competitive platform for AI-generated videos.

You will be given a sequence of frames extracted from a video, along with the creator's statement of intent.

Evaluate the video on these 3 quality criteria (0-100 each). These weights determine the video's SCORE:

1. Intent Clarity (weight: {intent}%)
   - Does the video reflect the stated creative intent?
   - Is there a consistent concept or direction?
   - Evaluate whether the stated intent is reflected in the submitted video. Do NOT reward persuasive or elaborate writing independently from visual execution.

2. Execution (weight: {execution}%)
   - Technical stability: scene consistency, motion stability, continuity, artifact control, editing coherence
   - NOTE: Intentionally rough or glitchy aesthetics should NOT be penalized as technical failure. Distinguish between unintended artifacts and deliberate stylistic choices.

3. Originality Signals (weight: {originality}%)
   - Signs of originality: avoidance of common templates, repetitive structures, generic patterns
   - Evaluate originality INDICATORS only -- do not attempt to judge "creativity" or emotional impact.
   - Also flag if the story/concept closely resembles a well-known existing advertisement or campaign. If so, name it in your weaknesses.

Separately (NOT part of the 3 scores above, NOT weighted into this video's score -- compliance check, not a quality axis):

4. Integrity
   - PROVENANCE IS NOT YOUR JOB. [...] Judge exactly ONE thing: is there visible, concrete evidence of a RULES VIOLATION in these frames? (third-party watermark/logo, copyright notice, another platform's UI captured, a different contest's marks)
   - NOT violation evidence: photorealism, shallow DOF, natural hand interactions, convincing physics -- these are QUALITY signals, never suspicious. AI-service watermarks (Sora/Veo/Runway/Kling/Seedance) expected and fine. Rough/glitchy/lo-fi aesthetics fine.
   - Scale: {integrityScaleFor(season thresholds)}

Respond ONLY with valid JSON:
{
  "scores": { "intentClarity": 0-100, "execution": 0-100, "originalitySignals": 0-100, "integrity": 0-100 },
  "strengths": [...3], "weaknesses": [...2], "aiSummary": "2-3 sentences"
}
```
(Claude만 추가로 `integrityExplanationKo/En` + `integrityRecommendation` 3필드 요구, `CLAUDE_INTEGRITY_EXTENSION` 상수)

**Intent Clarity 프롬프트가 예선/본선에서 받는 실제 입력이 다르다**(`batch.ts:573-576`):
- 예선: `creator_statement`(참가자 개인별 자유 문구)
- 본선: `season.main_round_theme`(시즌 전체 공통 브리프, 전원 동일 텍스트)

### 현재 샘플링 설정 — 이미 temperature=0이다 (재설계 대상 핵심 변수)

```ts
PRODUCTION_TEMPERATURE = { claude: 0, gpt: 0, gemini: 0 }
PRODUCTION_GEMINI_THINKING_BUDGET = 0  // thinking 끔
```
**2026-08-06 실측 근거(코드 주석 원문)**: 세 모델 전부 temperature 미설정 시 공급자 기본이 1.0(샘플링 최대)이었고, 3편×5회×독립 2회 실행 실험에서 "thinking off + temp 0"(아암 D) 조합만 두 번 다 진폭 0(완전 결정론), 파싱 실패 0, 응답 8.4초로 가장 빠르고 안정적이어서 **의도적으로** 채택됨("노이즈가 사라지는 것이 실측으로 확인됐다"). 즉 **오늘 발견한 "GPT/Gemini 무변별"은 우연한 버그가 아니라, 8/6에 다른 목적(재현성·파싱 안정성)으로 확정한 설정의 부작용일 가능성이 높다** — 노이즈 억제와 변별력이 트레이드오프 관계였고, 당시엔 변별력 손실 정도를 이번처럼 6편 계단 테스트로 정량 확인하지 않았던 것으로 보임. **내일 온도 시험(0.3)이 정확히 이 트레이드오프를 다시 여는 것.**

### scoreWithAllAIs 결합부 전문 (`scorer.ts:773-824`)

```ts
const [claude, gpt, gemini] = await Promise.all([
  scoreWithClaude(...), scoreWithGPT(...), scoreWithGemini(...),
]);

// Integrity는 Claude 단독, 나머지 3축은 단순 평균(가중치 없음, /3).
const consensusScores = {
  intentClarity: (claude.intentClarity + gpt.intentClarity + gemini.intentClarity) / 3,
  execution: (claude.execution + gpt.execution + gemini.execution) / 3,
  originalitySignals: (claude.originalitySignals + gpt.originalitySignals + gemini.originalitySignals) / 3,
  integrity: claude.integrity,  // Claude 단독
};

oxxovoVerifiedScore = computeVerifiedScore(consensusScores, thresholds)
// = intentClarity*0.30 + execution*0.45 + originalitySignals*0.25 + integrity*0  (season_0/test 현재 가중치, 오늘 계산 대조로 검증 완료)
```
**결합은 3사 단순 평균 하나뿐** — outlier 제외, 가중 평균, 모델별 신뢰도 반영 등 어떤 보정도 없음. 재설계가 "6층 구조"로 간다면 지금은 사실상 1층(prompt) + 2층(단순평균) 둘뿐이라는 뜻.

### scoring_results 저장 원자료 — 채워지는 것 vs 죽은 것

**실제로 채워짐**: `claude/gpt/gemini_intent/execution/originality`, `claude_integrity`, `consensus_*`, `verified_score`, `grade`, `integrity_flag/confidence/explanation_ko/en/recommendation`, `ai_outputs`(JSON — 모델별 aiSummary/strengths/weaknesses), `total_cost_usd`, `total_duration_ms`, `started_at`/`judged_at`, `processing_attempts`, `error_message`, `disqualified`(항상 false로 보임, 아래 참고).

**죽어있음(스키마엔 있지만 아무도 안 씀)**: `claude/gpt/gemini_required_elements`, `required_elements_missing_votes`, `disqualification_reason` — `oxxovo-scoring/src/` grep 0건. 이행조건 판정을 재설계에 넣으려면 **이 컬럼들에 실제로 쓰는 코드부터 새로 만들어야 함**(기존 컬럼 재활용 가능, 로직은 전무).

---

## 다음 창 진입 시 순서

1. **온도 시험**: 같은 본선 6편, `PRODUCTION_TEMPERATURE`만 0.3으로(gemini thinking budget은 별도 판단), 재실행. 결과 갈리면 원인=온도, 안 갈리면 원인=프롬프트/결합 구조.
2. 위 결과를 갖고 고문 6층 구조 논의 착수.
3. `c-scoringsilent0`/`c-seasonidrevert` backlog 항목 — 재설계와 별개로 여전히 유효, 재설계 완료 후에도 반드시 처리.
4. 리허설 실주행(TK·배우자)은 재설계 완료 후.
