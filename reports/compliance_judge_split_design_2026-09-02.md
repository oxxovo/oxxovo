# Compliance Judge 분리 설계 (2026-09-02)

**설계만. 코드/DB 미변경.** 대상: `oxxovo-scoring/src/scorer.ts`(`buildScoringPrompt`, `buildFinalScoringPrompt` 계열), `supabase.ts`(`deriveConfidence`), `batch.ts`.

## 1. 지금 구조 (실측, scorer.ts 기준)

- GPT/Gemini/Claude **세 모델이 전부 같은 프롬프트** 한 번 호출 — 3품질축(Intent/Execution/Originality) + criterion 4(Integrity/Compliance)를 **한 JSON 응답**에 같이 요구.
- 그런데 실제로 쓰이는 Integrity 값은 **Claude 것 하나뿐**(`integrityPolicy: 'claude-only'`, scorer.ts:154,796) — GPT/Gemini가 만든 integrity 필드는 계산된 뒤 버려짐.
- 플래그 판정: `flagged = claude.scores.integrity < flag_integrity_medium_threshold`(scorer.ts:802) + `deriveConfidence()`가 high/medium/low 3구간 연속값 밴드로 confidence 산출(supabase.ts:31-38).
- 09-01 고문 발견: 세 품질축엔 점수대 밴드가 없고, **밴드가 있는 축은 Integrity 하나뿐** — 실제로 갈리는 것도 Integrity(Weave 0 vs 나머지 100)뿐.

## 2. 문제 — 왜 나누나

1. **GPT/Gemini가 낭비한다** — 안 쓰이는 integrity 판단을 매번 하느라 토큰/추론을 쓰고, 그 판단 과정이 같은 응답 안의 품질 점수에 영향을 줄 수 있다(오염 방향 ①: compliance 의심 → 품질 점수 왜곡, halo/horn effect).
2. **Claude도 한 번에 둘을 한다** — compliance 판단과 품질 판단이 같은 호출·같은 추론 흐름 안에 있어서, 워터마크를 발견한 순간의 "의심"이 그 클립의 Intent/Execution/Originality에도 새어 들어갈 수 있는지 지금 구조로는 **측정 불가**(원인이 한 응답에 섞여 있음).
3. **연속 스케일 자체가 약하다** — 09-01에 이미 확인된 별건이지만, Integrity만 밴드가 있다는 것 자체가 "밴드=변별력"의 증거. Compliance를 참/거짓/불확실 3분류로 바꾸면 애초에 연속값 임계 3단(high/medium/low)이 필요 없어진다.

## 3. 제안 — 2-Pass 분리

### Pass 1 — Compliance Judge (Claude 단독, 오늘과 동일 — `integrityPolicy: 'claude-only'` 유지 제안)

- **독립 호출.** 프레임 + 창작자 진술만 준다. 품질 루브릭·가중치·"이 영상은 평가받는다"는 맥락 자체를 이 호출에 아예 안 준다 — Pass 2가 존재한다는 것도 모르게.
- 오늘 criterion 4의 4개 증거 유형을 3개 규정(R1/R2/R3)으로 통합:

| 규정 | 판정 대상 | 오늘 프롬프트 근거 |
|---|---|---|
| **R1** 타사 마크 | 제3자 워터마크·채널 배지·방송사 로고·에이전시 마크, 또는 남의 저작권 표시/크레딧 | criterion 4 불릿 1+2 |
| **R2** 타 플랫폼 화면 캡처 | 다른 플랫폼의 UI·플레이어·피드, 또는 화면을 폰으로 재촬영한 흔적 | criterion 4 불릿 3 |
| **R3** 타 대회 마크 | 다른 대회/공모전임을 식별시키는 표식 | criterion 4 불릿 4 |

  - ★이 3분류는 오늘 프롬프트의 4개 불릿을 제가 묶은 것 — 고문 쪽에 이미 R1/R2/R3로 못박힌 정의가 따로 있다면 그걸 우선해야 함(레포에서 R1/R2/R3 기존 정의 검색 0건, 확인 필요).
  - 각 규정마다 **true(명백한 위반 증거) / false(증거 없음) / uncertain(애매함, 사람 확인 필요)** + 1문장 근거(무엇을 봤는지, 또는 "증거 없음").
  - "증거 아님" 가드는 오늘 것 그대로 유지: 포토리얼리즘/얕은 심도/물리·손 상호작용은 절대 증거 아님(오히려 품질 신호), AI 생성 서비스 워터마크(Sora/Veo/Runway/Kling/Seedance)는 정상, 러프/글리치 미학도 정상.

### Pass 2 — Quality Judge (GPT+Gemini+Claude 3사, 오늘과 동일한 3모델)

- 프롬프트에서 criterion 4/Integrity 섹션을 **통째로 제거**. Intent Clarity / Execution / Originality 3축만 요청, JSON도 3필드만.
- Pass 1 결과·존재 자체를 이 호출에 안 준다 — "compliance는 이미 딴 데서 처리됐다"는 언급조차 없이, 순수 품질만 보는 모델로 만든다.
- 3사 전부 오늘처럼 채점하고 가중합산(`scoring_intent_clarity_weight` 등)은 변경 없음.

## 4. 후속 판정 (구조만 — 임계값/게이트 로직은 별건)

오늘의 연속값 3구간(`deriveConfidence`)을 대체할 이산 판정 예시(구현 아님, 형태만):

- R1/R2/R3 중 하나라도 **true** → 위반 확정 트랙(오늘의 "low 미만" 상당)
- true는 없고 하나라도 **uncertain** → 사람 검토 트랙(오늘의 "medium 밴드" 상당)
- 셋 다 **false** → 클린(오늘의 "high, 위반 증거 없음" 상당)

`seasons.flag_integrity_{high,medium,low}_threshold` 3컬럼은 이 설계 아래서는 불필요해짐(연속값이 없으므로) — **삭제 제안 아님**, 사문화 시 비활성으로 남겨두고 실제 전환 시점에 처리([[feedback-policy-obsolete-code-stays-inactive]]).

## 5. DB/스키마 영향 (스케치만, 미적용)

- `scoring_results.integrity`(단일 숫자) + `integrityExplanationKo/En` + `integrityRecommendation` → `r1/r2/r3` 각각 (true/false/uncertain) + 근거 텍스트 + 파생 종합 판정으로 형태가 바뀜. 컬럼 설계(개별 컬럼 vs JSON) 확정 안 함.
- 마이그레이션 순서는 [[feedback-migration-before-code-push]] 원칙대로 — 나중에 실제 적용할 때.

## 6. 비용/지연 영향 (추정, 미측정)

- 오늘: 모델 3콜, compliance는 그 안에 "끼워서" 공짜(단 GPT/Gemini 몫은 버려짐).
- 제안: Claude 전용 Pass 1 콜 **+1개** 추가, 기존 3콜은 criterion 4 텍스트가 빠져 각각 약간 짧아짐. 순증가 = 대략 Claude 콜 1회분. 실측은 C 아암과 같은 하니스로 나중에.

## 7. 확인 필요 (제가 임의로 정하지 않음)

1. **Pass 1을 Claude 단독으로 유지할지** — 오늘과 동일하게 제안했지만, compliance도 3사 투표로 바꿀지는 별개 결정.
2. **R1/R2/R3 경계** — 위 표는 오늘 프롬프트 4불릿을 제 판단으로 3개로 묶은 것. 고문 쪽에 이미 정해진 R1/R2/R3 정의가 있으면 그걸로 교체.
3. **이산 판정 → 상태 매핑**(§4)이 오늘 `advance_season_finalists`/flagged 게이트와 어떻게 연결되는지 — 게이트 쪽 코드(`app/api/cron/season-tick/route.ts`) 변경까지 이 설계에 포함할지 범위 확인.
4. 이 작업과 09-01 새 지침서(C 아암, 품질축 밴드 추가)는 **서로 다른 결함**을 겨냥한 별개 트랙 — 둘 다 진행하되 순서/우선순위 확인.

관련: [[project-scoring-v22]] · [[project-scoring-integrity-rules]] · [[project-face-consistency-scoping]] · [[project-jisoo-resume-2026-09-01]]
