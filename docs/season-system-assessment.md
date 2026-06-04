# 매주 시즌 시스템 — 평가 및 실행 계획 (Season System Assessment)

> 작성: 2026-06-03 · 작성자: 지수 (Claude Code) · 승인: TK 대표님
> 발사 목표: 2026-08-03 / 08-10 / 08-17 중 작업 일정에 따라 선택
> 스코프 동결: 2026-07-26 · 리허설 시즌: 2026-07-27 ~ 07-31

---

## 0. TL;DR

- **시즌 0 = 시즌 1+ 시스템 완전 동일.** per-시즌 분기 0, 수동 운영 0. 모든 차이는 `seasons` 테이블 파라미터로만 표현한다.
- **Soak 모드 채택.** 커뮤니티 투표 UI는 시즌 0부터 라이브하되, 시즌 0~3은 `community_vote_weight=0.0`(AI 100%). 시즌 4+에서 `0.7`(AI 30% + 커뮤니티 70%)로 **파라미터만** 전환. 코드는 처음부터 가중합산을 처리한다.
- **마이그레이션은 작다.** 원 계획은 weight/finals 컬럼을 대거 ADD하라 했으나, 실측 결과 **요청 컬럼 8개 중 7개가 이미 존재**하고 코드 전체에 wired돼 있었다. 순(net) 신규는 `scoring_start_at` **1개**뿐. (§2, §6)
- **admin UI는 이미 v1 존재.** `app/admin/seasons/*` (list·new·edit·form·actions·delete). task #8은 "신규 구축"이 아니라 "시즌 필터/멀티시즌 뷰 보강". (§7)
- **남은 long pole = 신원/Auth (매직링크 + RLS, 3~5일)와 cron 상태머신(DST 포함).** (§7)

---

## 1. 평가 결론 (솔직 모드)

원 계획(주차별 시즌 시스템 발사)은 방향·원칙 모두 타당하다. 다만 **마이그레이션 명세가 현재 스키마를 모르는 상태에서 작성**돼 있어 그대로 실행하면 옥소보 핵심 원칙(단일 진실원)을 위반할 뻔했다. 실측으로 교정한 뒤의 평가:

| 항목 | 원 계획 평가 | 교정 후 |
|---|---|---|
| weight/finals 마이그레이션 | 8 컬럼 ADD | **1 컬럼 ADD** (나머지 7개 이미 존재) |
| admin MVP | 신규 구축 3~5일 | **v1 존재**, 시즌 필터 보강만 |
| Soak 모드 | 신규 설계 | **스키마/refine 이미 가중합산 지원** — default 값 정책만 결정 |
| 가중합산 공식 | 1~2일 | 컬럼 2개(`ai_score_weight`, `community_vote_weight`) 곱셈 — 채점 워커에 식만 추가 |

→ 총 공수는 원 추정(21~40 dev-day)보다 **하단(~21일)에 가깝게** 당겨질 여지가 크다. 진짜 비용은 신원/Auth와 cron 상태머신에 집중된다.

---

## 2. 현 스키마 실측 — 명세 ↔ 실제 컬럼 매핑표

> **규칙 (TK 대표님 확정 2026-06-03):** 향후 모든 문서·대화에서 **실제 코드 컬럼 이름으로 통일**한다. 명세 용어(`finals_*`, `community_weight`, `ai_weight`)를 쓸 경우 항상 아래 매핑을 명시한다. rename 금지(ADD-only).

| 명세 용어 | 실제 컬럼 (코드 표준) | 상태 | 위치 |
|---|---|---|---|
| `community_weight` (default 0.0) | `community_vote_weight` | ✅ 존재 | `lib/seasons.ts:63`, `season-schema.ts:36` |
| `ai_weight` (default 1.0) | `ai_score_weight` | ✅ 존재 | `lib/seasons.ts:64`, `season-schema.ts:37` |
| `finals_start_at` | `main_round_start_at` | ✅ 존재 | `lib/seasons.ts:79` |
| `finals_end_at` | `main_round_end_at` | ✅ 존재 | `lib/seasons.ts:80` |
| `finals_theme_reveal_at` | `theme_announcement_minutes_before` (offset) | ✅ 파생 | `getThemeRevealTime()` `lib/seasons.ts:199` |
| `awards_at` | `awards_announcement_at` | ✅ 존재 | `lib/seasons.ts:81` |
| `application_open_at` | `application_open_at` (동명) | ✅ 존재 | `lib/seasons.ts:76` |
| `scoring_start_at` | `scoring_start_at` | 🆕 **신규 ADD** | 본 마이그레이션 |

**왜 명세대로 ADD하면 안 되는가:** `community_weight`를 새로 만들면 `community_weight` + `community_vote_weight`가 공존한다. 기존 코드(admin SeasonForm, faq 페이지, 향후 채점 워커)는 전부 `*_vote_weight`를 읽으므로 새 컬럼은 **죽은 컬럼**이 되고, admin에서 입력한 값이 채점에 반영되지 않는 silent bug가 된다. → 옥소보 `supabase_column_policy`(ADD-only, rename 금지) 위반.

### 가중합산 — 추가 작업 거의 없음

`season-schema.ts:63-69`에 이미 `community_vote_weight + ai_score_weight == 1.0` refine 존재. Soak 모드 값 `0.0/1.0`도 합=1.0이라 통과한다. 최종 점수 공식은:

```
final_score = ai_score × ai_score_weight + community_score × community_vote_weight
```

시즌 0~3: `ai_score × 1.0 + community_score × 0.0 = ai_score` (AI 100%, 커뮤니티 점수는 수집만, 영향 0 = Soak).
시즌 4+: `ai_score × 0.3 + community_score × 0.7`.

→ 채점 워커(oxxovo-scoring)에 이 한 줄만 들어가면 된다. 코드는 처음부터 70/30을 처리하고, 시즌별 비중만 컬럼 값으로 달라진다.

---

## 3. Soak 모드 상세

| 구간 | `ai_score_weight` | `community_vote_weight` | 효과 |
|---|---|---|---|
| 시즌 0~3 | 1.0 | 0.0 | AI 100%. 커뮤니티 투표 UI는 **라이브**, 점수는 수집·표시되나 결과 영향 0 |
| 시즌 4+ | 0.3 | 0.7 | AI 30% + 커뮤니티 70% (진짜 OXXOVO 비전) |

**Soak의 목적:** stake=0 시점(시즌 0~3)에서 어뷰징 방지·투표 UX를 단련 → 시즌 4 진입 시 검증된 상태. 시즌 4에서 비중을 켜는 것은 **컬럼 값 변경**일 뿐 코드 배포가 아니다.

### default 값 정책 (마이그레이션 아님, 코드/cron 책임)

현재 `DEFAULT_SEASON` 템플릿(`season-schema.ts:118-119`)은 `0.7/0.3` (= 시즌 4+ 값)이다. 주차별 cron이 시즌을 자동 생성할 때 **`season_number < 4 → 1.0/0.0`, `>= 4 → 0.3/0.7`** 로 설정해야 한다. admin 수동 생성 시 template default는 검토 대상(시즌 0~3 생성 시 0.0/1.0로 덮어쓸 것). → cron 작업(task #6)에서 처리.

---

## 4. 시즌 단계 구조

### 시즌 0~3 (활주로 단계, 외부 URL) — **현재 스키마로 100% 커버**

- 2단계 토너먼트: **예선(application) → 본선(main_round)**
- 신청 영상: 매주 새 영상 (자유작 영구 등록 X)
- 본선 영상: OXXOVO 테마 30초, 외부 URL 제출 (`allowed_video_platforms` 화이트리스트)
- 채점: AI 100% (Soak)
- 제출 모델: **단일 제출** (1회, 영구 수정 불가, 마감 = `main_round_start_at` + 48h). `canSubmitMainRound()` 이미 구현.

### 시즌 4+ (OXXOVO 내 생성, 세션 6 활성화 후) — **future migration 필요**

- 3단계 토너먼트: **예선전(500) → 준결승(Top 50) → 결승(Top 3)**
- 예선전: 15~20초 / 준결승·결승: 21~30초, 전부 OXXOVO 내 즉석 생성
- 채점: AI 30% + 커뮤니티 70%

> ⚠️ **스키마 갭:** 현재 `genesis_applications`는 단일 본선(`main_round_*`) 흐름이고 `round`(준결승/결승) 개념이 없다. 3단계 토너먼트는 **별도 future migration**(round 컬럼/테이블 + status 흐름 확장)이 필요하다. 스키마 미설계 상태에서 지금 ADD하면 또 죽은 컬럼이 되므로 **본 발사 범위에서 제외**, 11월/세션 6에서 설계. (Soak 모드 덕에 weight 코드는 이미 준비돼 있어, 시즌 4+ 작업은 round 구조에만 집중하면 된다.)

> ⚠️ **season status enum 갭:** `season-schema.ts:18` status enum = `draft|active|closed|completed`. task #4의 멀티시즌 워커는 "status='scoring' 시즌 자동 선택"을 전제하나 `scoring` 상태가 없다. cron 상태머신 설계(task #6/7)에서 **season status를 확장(scoring/finals 등)할지, 타임스탬프 기반으로 갈지** 결정해야 한다. (본 마이그레이션 범위 밖 — cron 작업에서 결정)

---

## 5. 역산 일정 (Reverse Schedule)

### 5.1 단일 시즌 생애주기 (Launch Monday 기준, PDT)

발사 월요일을 `M`이라 하면:

| 시점 | 이벤트 | 컬럼 |
|---|---|---|
| `M` 월 00:00 | 신청 오픈 (7일) | `application_open_at` |
| `M+7` 월 00:00 | 신청 마감 → 채점 시작 | `application_close_at` = `scoring_start_at` |
| `M+7` 월 ~ 수 | Top 50 채점/선정 | `scoring_complete_at` |
| `M+9` 수 20:00 | 본선 테마 공개 (시작 60분 전) | `main_round_start_at` − `theme_announcement_minutes_before` |
| `M+9` 수 21:00 | 본선 시작 | `main_round_start_at` |
| `M+11` 금 21:00 | 본선 마감 (start + 48h) → 본선 채점 | `main_round_end_at` |
| `M+12~13` 주말 | 시상 발표 | `awards_announcement_at` |

> **시각은 cron이 `America/Los_Angeles` 기준으로 계산해 컬럼에 절대 UTC로 저장**한다. cron은 시즌 행 생성만, 시각 산출은 코드가 담당(타임스탬프 분리 원칙).

### 5.2 steady-state — 매주 시즌이 겹친다 (멀티시즌 동시성)

한 시즌이 ~13일 생애를 가지므로, 매주 월요일 새 시즌이 시작되면 **항상 2개 시즌이 동시 진행**된다 (예: S_N 본선 중 + S_N+1 신청 중). → task #4(멀티시즌 워커 자동 선택)와 task #6(멱등 cron)이 필수인 이유.

```
주:   1        2        3        4
S0:   [신청7d][채점][본선][시상]
S1:            [신청7d][채점][본선][시상]
S2:                     [신청7d][채점][본선][시상]
                ↑ 매주 월 새 시즌 오픈, 항상 2시즌 오버랩
```

### 5.3 발사일 옵션 (전부 월요일, PDT 확정)

| 옵션 | 발사 | 시즌 0 신청 | 본선 | 시상 | 비고 |
|---|---|---|---|---|---|
| A | 08-03 월 | 08-03~08-10 | 08-12 수 21:00 | 08-15~16 | 가장 빠름, 버퍼 최소 |
| B | 08-10 월 | 08-10~08-17 | 08-19 수 21:00 | 08-22~23 | **권장** — 리허설(7/27~31) 후 1주 정비 |
| C | 08-17 월 | 08-17~08-24 | 08-26 수 21:00 | 08-29~30 | 가장 여유, long pole 지연 흡수 |

> 권장: **B (8/10)**. 7/26 동결 → 7/27~31 리허설 → 1주 버그픽스/정비 → 8/10 발사. A는 리허설 직후라 버퍼가 없고, C는 모멘텀 손실. 단 신원/Auth(long pole)가 지연되면 C로 자동 후퇴.

---

## 6. DST / 누락 체크리스트

### 6.1 DST (Daylight Saving Time)

- 2026년 PDT(UTC−7) 구간: **3/8 ~ 11/1**. 발사(8월)는 PDT 확정.
- **11/1(일) 02:00 PDT→PST(UTC−8) 전환**이 위험 지점. 가을~겨울 주차 시즌의 cron이 `America/Los_Angeles` TZ-aware로 시각을 계산해야 함. **UTC−7 하드코딩 절대 금지** → 11/1 이후 모든 시각이 1시간 어긋남.
- 12월 왕중왕전(PST 구간)도 동일 주의.
- ✅ 체크: cron 시각 계산은 IANA TZ(`America/Los_Angeles`) 사용, 단위 테스트에 11/1 경계 케이스 포함.

### 6.2 발사 전 누락 방지 체크리스트

- [ ] **본선(main_round) 흐름** — 시즌 0~3은 단일 본선. `canSubmitMainRound`/테마 공개 이미 구현, 회귀 테스트 필요.
- [ ] **Soak default** — cron이 시즌 0~3 생성 시 `community_vote_weight=0.0` 설정 확인 (template default가 0.7임).
- [ ] **멀티시즌 동시성** — 2시즌 오버랩 상태에서 워커/이메일 cron이 시즌을 혼동하지 않는지.
- [ ] **season status enum** — `scoring`/`finals` 등 cron 상태머신이 요구하는 상태 정의(§4 갭).
- [ ] **이메일 cron** — 기존 `awards_announcement_at` 트리거(`email-tick/route.ts:132`)가 멀티시즌에서 정상 동작.
- [ ] **DST** — 11/1 경계 단위 테스트.
- [ ] **리허설 시즌** — 실제 cron으로 1주 전체 사이클 무인 검증(§7-12).

---

## 7. 작업 순서 (재평가)

> 0순위(본 문서 + 마이그레이션) 완료 후. **굵게** = long pole.

1. **TK: 마이그레이션 SQL 적용** (Supabase SQL Editor) — `scoring_start_at` 1개 ADD.
2. **신원/Auth (매직링크 + RLS) — 3~5일, 최대 long pole**
   - Supabase Auth 매직링크(저마찰), `genesis_applications.user_id` → `auth.users` ADD, RLS 정책.
3. 가중합산 공식 — **~0.5일** (컬럼 이미 존재, 워커에 식 1줄). *원 추정 1~2일에서 축소.*
4. 멀티시즌 워커 자동 선택 — 1~2일 (oxxovo-scoring, 단일 `SEASON_ID` env 제거, status 기반 선택, 오스 협업).
5. 본선 워커 (`round` 단일 본선 자동 처리) — 1~2일 (오스).
6. **cron 시스템 — 2~5일**
   - 매주 월 시즌 자동 생성, **DST 처리(§6.1)**, 타임스탬프 분리(cron=행, 시각=코드), 멱등성 + 알림 + 수동 fallback, Soak default 설정.
7. 본선 cron (테마/채점/시상 상태머신) — 2~3일.
8. admin 보강 — **1~3일** (v1 존재 `app/admin/seasons/*`, **시즌 필터 드롭다운 + 멀티시즌 뷰만** 추가). *원 추정 3~5일에서 축소.*
9. 커뮤니티 투표 UI v1 (Auth-bound, Soak) — 3~5일.
10. 시상 (이메일 + 화면) — 1~2일 (이메일 인프라 기존 활용).
11. 중복 신청 정책 — 1~3일.
12. 통합 테스트 + **리허설 시즌(7/27~31, 실 cron 무인 사이클)** — 3~6일.

**재평가 총 공수:** 명세 ~21~40 dev-day → 마이그레이션·admin·가중합산 축소로 **하단(~21일) 근접**. 9주 창 내 median 5~6주. 실 risk는 신원/Auth와 cron DST에 집중.

---

## 8. 위험표 (Risk Table)

| # | 위험 | 영향 | 가능성 | 완화책 |
|---|---|---|---|---|
| R1 | 명세대로 중복 컬럼 ADD | 죽은 컬럼·채점 silent bug, 옥소보 원칙 위반 | (회피됨) | ✅ 기존 이름 유지, scoring_start_at만 ADD (본 문서) |
| R2 | DST UTC−7 하드코딩 | 11/1 이후 모든 시각 1h 오차 | 중 | IANA TZ 계산 + 11/1 경계 테스트 |
| R3 | 신원/Auth 지연 (long pole) | 발사일 슬립 | 중 | 발사일 A→B→C 후퇴, Auth를 2순위 즉시 착수 |
| R4 | 멀티시즌 동시성 버그 | 워커/이메일이 시즌 혼동 | 중 | status 기반 선택, 리허설에서 2시즌 오버랩 검증 |
| R5 | season status enum 미정의 | 워커 시즌 선택 불가 | 중 | cron 설계(task #6/7)에서 status 확장 vs 타임스탬프 결정 |
| R6 | Soak default 오설정 (0.7로 생성) | 시즌 0~3이 커뮤니티 70% 반영 | 중 | cron이 season_number로 분기 설정 + 발사 전 체크리스트 |
| R7 | 시즌 4+ round 스키마 미설계 | 세션 6 작업 지연 | 낮(현재) | 본 발사 범위 제외, 11월 future migration로 명시 |
| R8 | 리허설 부족 | 무인 운영 첫 사이클 실패 | 중 | 7/27~31 실 cron 1주 사이클, 수동 fallback 준비 |

---

## 9. 마이그레이션 결정 요약

- **파일:** `reports/seasons_weights_finals_migration.sql` (명세 파일명 유지, 내용은 교정됨)
- **내용:** `ALTER TABLE seasons ADD COLUMN IF NOT EXISTS scoring_start_at TIMESTAMPTZ` — 단 1개, nullable, default 없음, 멱등.
- **이유:** 나머지 7개는 이미 존재(§2). 기존 schedule 타임스탬프와 동일 패턴(nullable, 시각은 cron/코드가 계산).
- **검증:** 파일 하단 verification 블록 — 신규 컬럼 메타 + 기존 6컬럼 존재 재확인 + 시즌 0 스케줄 현황.

---

## 10. 미해결 / 추후 결정 필요

| 항목 | 결정권자 | 시점 |
|---|---|---|
| 발사일 A/B/C 최종 확정 | TK | 신원/Auth 진척 후 |
| season status enum 확장 vs 타임스탬프 기반 | 지수 + 오스 | cron 설계(task #6) |
| 시즌 4+ round 스키마 설계 | 별도 세션 | 11월/세션 6 |
| Soak default를 template에도 박을지 vs cron만 | 지수 | cron 작업(task #6) |
| Member Hosted Tournament 트랙 스키마 | 별도 세션 | 시즌 4+ 이후 |

---

## 부록 A. 사업 본질 (불변)

- AI 100% 채점(시즌 0~3) → AI 30% + 커뮤니티 70%(시즌 4+).
- 운영진 결과 개입 불가 — 점수 수정 X.
- 시스템 오류/부정 발견 시 예외 처리 후 투명 공개.
- 단일 제출 모델 — 1회 제출 후 영구 수정 불가.
- 시스템 오류 ≠ 사용자 탈락.
- 100% 자동화, 인간 개입 0 ("Send" 버튼 금지).
