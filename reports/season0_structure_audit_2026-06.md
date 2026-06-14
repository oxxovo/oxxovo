# 시즌 0 구조 재확정 — 실측 감사 + 반영 설계 (2026-06-10)

> **2026-06-11 갱신 — 3단계 구조 확정.** 아래 §0 우선 적용(이하 §1~§5는 2단계 기준 초안, 매핑/공식은 유효).

## §0. 3단계 구조 확정 설계 (실측 + TK 결정)

### 실측 verdict: 현재 = **2단계** (예선 application → 본선 main_round)
- 상태머신 `season-tick`: `draft→active→closed→completed` (중간 단계 없음).
- studio round enum: `'application'|'main'|'both'` (명명 라운드 2개), `EffectiveRound='application'|'main'`.
- seasons 컬럼: `application_*` + `main_round_*` 2세트. semifinal/준결승/3인결승 **전무**.
- 시즌4+ 3단계 흔적 없음(시즌4=투표 deferral 의미일 뿐) → 신규 구축.

### 매핑 결정 (TK): **main_round = 준결승 유지 + 결승 신규 추가** (Option 1, 최소 churn)
| 단계 | 컬럼 | 진출 수 | 테마 |
|---|---|---|---|
| 예선 preliminary | `application_*` (open/close, 15~30) | 최대 `max_applicants=500` / 최소 `min_participants=50` | 자유작 |
| 준결승 semifinal | `main_round_*` (start/end, 기존) | `top_n_advance` = clamp(round(예선×`advance_pct`),`advance_min`,`advance_max`) = Founding(가변) | 테마 |
| 결승 final | **신규 `final_start_at`/`final_end_at`** | `final_n=3` | 테마 |
| 시상 | `awards_announcement_at` | 1/2/3 = 1800/750/450 | Top3 왕중왕전 진출 |

- **영상 길이: 전 라운드 15~30 공통** → `application_video_min/max_seconds`만 사용. `main_round_video_*` 폐기(데이터 15/30 동기화 후 deprecated).
- **테마: 예선=자유작 / 준결승·결승=테마**(고정 구조, 시즌0=시즌1+ 동일). 결승 테마는 준결승과 별도 트위스트 가능(세부 후속).
- **미달(예선<50) = 연기(deferral), 이월 아님 (TK 정정 2026-06-11):** 시즌0 무료라 유료 시즌으로 신청자 롤오버 불가(충돌). 예선 마감 시 count<50 → **신청 마감 연장**(시합 연기). 신청자 이월 X, 마감일 연장 O. 시즌1+ 일정은 시즌0 후 별도 확정.

### 신규 seasons 컬럼 (ADD-only 멱등) — `season0_3stage_migration_2026-06.sql`
진출 정책: `min_participants`(50) · `advance_pct`(0.10) · `advance_min`(10) · `advance_max`(50) · `final_n`(3) · `final_start_at` · `final_end_at`.
연기: `application_defer_count`(0) · `defer_extension_days`(**7**) · `max_defer_count`(**2**) [TK 확정 2026-06-11].
(`top_n_advance` 유지 = 준결승 진출 산출값. carried_over_* 폐기.)
genesis_applications: `final_video_url` · `final_submitted_at` + status 9→11(`final_selected`/`final_submitted`).
scoring_results.round: `application/main/final`.

### 연기(deferral) 메커니즘 — 권고: 경계형 자동연장 + 알림 + admin 오버라이드
순수 무한자동(조용한 무한연기, 위험) ↔ 순수 수동(마감 시점에 신청 끊김, gap 위험) 사이 균형:
- `season-tick`이 예선 마감 경계에서 유효 신청자 집계.
  - count >= min_participants → 정상 마감(closed) + 준결승 진행.
  - count < min_participants AND defer_count < max_defer_count(2) → `application_close_at += defer_extension_days(7)`, `application_defer_count++`, status='active' 유지(신청 계속), **admin 알림**. (최대 7일×2 = 14일 자동연장)
  - count < min AND defer_count >= max_defer_count → 자동연장 중단, **admin 알림(수동 결정 필요)**. admin이 /admin/seasons에서 마감일 추가연장 또는 수동 마감.
- **다음 시즌 자동생성 금지** while 현 시즌 연기 중 (TK 지시). + 시즌1+ 일정 미정이라 season-tick 자동생성은 그때까지 보류.
- 안전성: 자동연장이 마감 gap을 없애 신청 흐름 유지하되, max_defer_count 캡으로 무한연기 차단 + 매회 알림으로 인간 인지. admin은 언제든 오버라이드.

### 단계별 진출 로직 (cron + scoring) — 상세
표기: **준결승 = main_round_*** (scoring round='main'), **결승 = final_*** (scoring round='final').

1. **예선 채점 (round='application', oxxovo-scoring)**: 신청 영상 자동 채점 → verified_score + integrity. 통과=`eligible`, high flag=`flagged`(admin 검토).
2. **예선 마감 (`season-tick`, application_close_at 경계)**:
   - 유효 신청자 N0 = status in (eligible) (+flagged 검토 완료분). [채점 무결성: score 자동, admin 변경 불가]
   - N0 < min_participants → **연기**(위 메커니즘). 진출 미산출.
   - N0 >= min_participants → `top_n_advance = clamp(round(N0 * advance_pct), advance_min, advance_max)` 기록.
3. **준결승 진출 선발 (리더보드 #1, 기존 그대로)**: round='application' verified_score DESC 상위 `top_n_advance`명 → `status='selected'` = **Founding Creator(가변)**. (flagged 검토 후 나머지 자동, 기존 흐름)
4. **준결승 라운드 (main_round)**: selected가 테마로 새 영상 제출 → `main_round_submitted` + main_round_video_url. oxxovo-scoring round='main' 채점.
5. **준결승 종료 (`season-tick`, main_round_end_at 경계)**: round='main' verified_score DESC 상위 `final_n(3)`명 → `status='final_selected'` = **결승 진출**.
6. **결승 라운드 (final, 신규)**: final_selected가 테마로 새 영상 제출(final_start_at~final_end_at) → `final_submitted` + final_video_url. oxxovo-scoring round='final' 채점.
7. **시상 (`season-tick`, awards_announcement_at 경계)**: round='final' verified_score DESC 1/2/3위 → `award_rank` 부여 + `status='awarded'`(1800/750/450). Top3 = 왕중왕전 진출.
8. **표시 보정**: 마감 전 page/faq/rules에 "예선→준결승(상위10%,10~50)→결승(3명)" 3단계 + 정책 문구(마감 후 산출값).

### oxxovo-scoring 협의 사항 (제니/지수-scoring 세션)
- 채점 트리거를 round='main'(준결승), round='final'(결승)까지 확장. scoring_results UNIQUE(application_id, round)라 라운드별 행 분리 — 인프라 이미 지원, 트리거/입력 영상만 라운드별로.
- 입력 영상: round='application'→video_url, 'main'→main_round_video_url, 'final'→final_video_url.

### 빌드 범위(지수, 승인 후) + 공수 재산정
- 마이그(9컬럼)+데이터 / seasons_public 뷰 갱신 / Season 타입·getSeasonById·season-schema·admin-i18n / season-tick(N산출+준결승종료 top3+롤오버 분기) / page·faq·rules 3단계 표시 / **결승 라운드 신규(제출·채점·리더보드)**.
- **결승이 새 제출+채점 사이클**이라 2단계 단순보정보다 큼 → 현실 **3~5일+**(채점 연동 oxxovo-scoring 협의 포함). 6/20 워밍업(홍보영상)과는 무관(별 트랙).

### TK 몫
- 마이그 실행(아래 SQL 파일) / 결승 일정(`final_start_at`·`final_end_at`) 값 결정(현 시즌0: 예선8/3~8/31, 준결승9/3~9/5, 시상9/8 → 결승 슬롯 예: 9/6~9/7) / 결승 테마 확정.

---


TK 확정값: 상금 $3000(1800/750/450) · 최소 참가 50명(미만 시 이월) · 본선 진출 = 신청자 상위 10% clamp 10~50 · Founding Creator = 본선 진출자(가변) · 신청 영상 15~30초.

## 핵심 결론
시스템은 **이미 거의 전부 동적**(모든 사용자 페이지가 `season.*` 읽음). 하드코딩 "Top 50 / $2,000 / $1,200·$500·$300" **라이브 잔재 없음**. 필요한 건 ①seasons 행 값 ②신규 컬럼 3개 ③진출 계산 로직 한 군데.

---

## 1. 실측 — 옛값이 어디에 있나

### A. 이미 동적 (코드 수정 불필요)
| 항목 | 위치 | 출처 |
|---|---|---|
| 상금 풀/1·2·3등 | faq:16-19,50 · page.tsx:256,338 · WinnerCelebrationCard:133-135 | `season.total_prize_pool`, `season.prize_first/second/third` (GENERATED = pool×pct) |
| Founding Creator/진출 수 | faq:66 · page.tsx:256,338 | `season.top_n_advance` ("The Top N advance as Founding Creators") |
| 신청 영상 길이 | apply:104-105,348 · rules:119 | `season.application_video_min/max_seconds` |
| 상금 pct | host/new 등 | `season.prize_*_pct` |

→ **상금은 풀만 2000→3000 바꾸면** GENERATED 컬럼이 1800/750/450 자동 산출(현 pct 60/25/15: 2000×0.6=1200 옛값과 정합). 영상 길이도 행 값만 15/30.

### B. 하드코딩 잔재 (실제 누수는 1곳, 비라이브)
| 위치 | 내용 | 판정 |
|---|---|---|
| `app/lobby-preview/page.tsx:18-19` | `prizePool:2000, prizeFirst:1200` (+5000, +10000, +3000 목업) | **디자인 데모 페이지(DB 없음, [[project-lobby-v1]])**. 라이브 아님. 혼선 방지용 업데이트만 권장(선택) |
| `lib/email/templates/SelectedTop50.tsx` | 파일명/template_key의 "top50" | **이름뿐, 파라미터화됨**(주석 명시: future seasons may pass 다른 값). 누수 아님. 명확성 위해 리네임은 선택 |

→ **라이브 하드코딩 상금/Top50/길이 누수 = 없음.**

### C. 의미 변경이 필요한 것 (구조)
- `top_n_advance`(현재 **고정 50**) → **계산값**(상위 10% clamp 10~50)으로 의미 전환. 컬럼은 유지하되 "정책"이 아니라 "산출 결과"를 담음.
- Founding Creator = 그 산출된 진출자(가변). 옛 "Top 50 고정" 폐기 = top_n_advance를 계산값으로 바꾸면 자동 반영(faq/page.tsx가 이미 top_n_advance 참조).

---

## 2. 신규 스키마 (seasons, ADD-only 멱등) — 하드코딩 금지 원칙

| 컬럼 | 기본값(시즌0) | 의미 |
|---|---|---|
| `min_participants` | 50 | 미만 시 본선 미개최 → 이월 |
| `advance_pct` | 0.10 | 본선 진출 비율 |
| `advance_min` | 10 | 진출 인원 하한(clamp) |
| `advance_max` | 50 | 진출 인원 상한(clamp) |

`top_n_advance`는 유지(산출 결과 저장처). 이월 상태는 §3에서.

---

## 3. 본선 진출 인원 계산 로직 — 어디에 들어가나

**공식:** `N = clamp(round(valid_applicants × advance_pct), advance_min, advance_max)`

**위치 (2단계):**
1. **인원 수 N 산출 = `app/api/cron/season-tick`** (이미 상태 전이를 담당). 신청 마감(`application_close_at` 통과) 시점에 유효 신청자 수 집계 → N 계산 → `seasons.top_n_advance`에 기록. (동적, 시즌 무관)
2. **누가 진출 = 본선 리더보드/승인 파이프라인(#1, `main-results`/applications)**. verified_score 상위 N명을 Founding Creator로 승인(현 승인/override 흐름 위에 "상위 N" 기준 적용). [[project-scoring-integrity-rules]] 채점 무결성 유지(score 자동, admin 임의변경 불가).

**표시 보정 1건:** 마감 전엔 N이 미정(신청자 수 의존)이라, `app/page.tsx`/`faq`의 "Top {top_n_advance}"를 **마감 전=정책 문구("상위 10%, 10~50명")**, **마감 후=산출값**으로 분기. (작은 수정)

### 이월(carry-over) = 다음 라운드 롤오버 (TK 확정 2026-06-10)
`valid_applicants < min_participants(50)`이면 본선 미개최 → **신청자+상금을 다음 시즌으로 승계.** (매주 시즌 모델 [[project-weekly-season-system]]과 정합)

**메커니즘:**
- season-tick이 마감 시 count<50 감지 → 이 시즌 `status='carried_over'` + `carried_over_at` + `carried_over_to_season_id`(다음 시즌) 기록.
- **상금:** 미시상이므로 다음 시즌 `total_prize_pool`에 합산(롤오버).
- **신청자:** 알림 발송 + 신청 레코드를 다음 시즌으로 자동 승계(복사/링크)해 재신청 마찰 0. (기본 가정 — 자동승계. 재신청 방식 원하면 변경)
- **신규 컬럼:** `carried_over_at TIMESTAMPTZ`, `carried_over_to_season_id UUID`.
- **열린 세부(확인):** 상금 자동합산 vs 보류 / 신청 자동승계 vs 재신청 — 기본=합산+자동승계로 진행, 이견 시 조정.

---

## 4. ③ 전자동 홍보영상 아키텍처 — 어제 설계 완료
`reports/promo_full_auto_design_2026-06.md`에 실측 기반 전체 설계 있음:
- ③합성 = **Railway 워커(oxxovo-promo Python, postprocess.py)** — Vercel 불가.
- 분담: 지수(본체)=promo_jobs 마이그+생성폼+진행/승인+스케줄cron / 지수3=CLI→Railway 폴러 전환+Docker(ffmpeg+KR폰트)+Storage 업로드.
- 6/20: **디커플** — 워밍업은 오늘 라이브된 반자동(수동 업로드→발행)으로 정시, 전자동은 병렬 완성 후 스위치 ON.
(상세는 해당 문서 참조)

---

## 5. TK 몫 (SQL + 외부) — 분리

### SQL-1 (구조): seasons 신규 컬럼 (지수가 마이그 파일 제공 예정, 승인 후)
`ADD COLUMN IF NOT EXISTS min_participants / advance_pct / advance_min / advance_max` + 시즌0 기본값.

### SQL-2 (데이터): 시즌0 행 값 (지수가 전문 제공 예정)
```sql
-- 상금 풀 3000 -> GENERATED 가 1800/750/450 산출 (pct 60/25/15 보장)
UPDATE public.seasons SET
  total_prize_pool = 3000,
  prize_first_pct = 60, prize_second_pct = 25, prize_third_pct = 15,
  application_video_min_seconds = 15,
  application_video_max_seconds = 30,
  min_participants = 50,
  advance_pct = 0.10, advance_min = 10, advance_max = 50
WHERE season_number = 0;
```
(top_n_advance는 마감 시 cron이 산출 기록 — 수동 설정 불필요. 마감 전 표시는 정책 문구로.)

### 외부작업: 없음 (이 항목은 전부 내부 SQL + 코드)

### 결정 대기: **이월 메커니즘 A/B/C** (§3)

---

## 착수 순서 (승인 후)
1. 이월 메커니즘 확정 → 2. seasons 마이그(신규 4컬럼) 파일 제공(TK Run) → 3. 데이터 UPDATE 제공(TK Run) → 4. season-tick에 N 산출 + 이월 분기 → 5. page/faq 마감전/후 표시 분기 → 6. 리더보드 "상위 N" 기준 적용. (각 tsc 검증)
