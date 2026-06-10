# OXXOVO Admin 계획 v2 — 운영 데이터 관리 통합

**작성일**: 2026-05-23
**작성자**: 지수 (Claude Opus 4.7)
**대체 대상**: `reports/admin-plan-2026-05.md` (v1 → v2로 확장)
**상태**: TK 대표님 검토 대기 → 승인 후 2차 작업부터 적용 (1차는 v1 SQL 그대로 진행 중)

---

## v1 → v2 변경 요약

### 추가된 핵심 (TK 대표님 짚으심)

admin = 시즌 CRUD뿐 아니라 **실제 운영 데이터 관리도 핵심**.
라운드별 참가자, 수상자, 연락처, 점수별 등급까지 admin에서 통합 관리.

### 5단계 → 7단계 재분할

| 차수 | 범위 | 시간 | 시즌 0 발사 전 필수? |
|---|---|---|---|
| 1차 | 인증 + /admin + 시즌 CRUD | 6~8h | ✅ |
| 2차 | /admin/applications + 영상 + 연락처 | 5~7h | ✅ |
| 3차 | scoring_results + /admin/winners + 등급 | 5~7h | ✅ |
| 4차 | /admin/hall-of-fame + 횡단 통계 | 3~5h | ❌ (시즌 0 후) |
| 5차 | 이메일 트리거 + 템플릿 | 6~8h | ✅ |
| 6차 | 수동 일괄 발송 | 8~10h | ❌ (시즌 0 후) |
| 7차 | 로그 + 통계 + Export | 4~6h | ❌ (시즌 0 후) |

**시즌 0 발사 전 필수 (1+2+3+5)**: ~22~30시간 (1.5~2주)
**시즌 0 발사 후 (4+6+7)**: ~15~21시간

---

## 추가된 4가지 운영 데이터 영역

### 1. 라운드별 참가자 명단

```
/admin/applications              # 목록 + 필터 + 검색 + CSV Export
/admin/applications/[id]         # 개별 상세 + 영상 임베드 + 연락처 + 채점
```

**필터/세그먼트**:
- 신청자 (전체)
- Top 50 (Founding Creators)
- Waitlist
- 본선 진출자
- 시상자 (1/2/3등)

**기능**:
- 검색 (이름, 이메일, 채널 URL)
- CSV Export (선택 컬럼)
- 일괄 액션 (status 변경, 메일 발송 트리거)

### 2. 수상자 명단 + 점수별 등급 ⭐

```
/admin/winners                   # 수상자 명단 + 등급별 분류
```

**등급 시스템** ([[project-scoring-v22]] memory 참고):

| 점수 | 등급 | 라벨 |
|---|---|---|
| 95+ | LEGENDARY | 전설 (거의 불가능) |
| 90+ | MASTERPIECE | 명작 (Top 1%) |
| 80+ | EXCELLENT | 우수 (Top 10%) |
| 70+ | SKILLED | 숙련 |
| 60+ | AVERAGE | 평균 |
| 50  | ADEQUATE | 보통 |
| 50- | NEEDS WORK | 미흡 |

**현 단계**: admin 페이지에 `grade` 컬럼 + 라벨 표시만.
**룰북 v2.3 정식화**: oxxovo-scoring 레포에서 별도 진행.

`lib/grades.ts` 새 헬퍼:
```ts
export function formatGrade(score: number): { tier: string; label: string; color: string }
```

### 3. 연락처 통합 관리

```
/admin/contacts                  # 참가자 연락처 통합
```

**관리 채널**:
- 이메일 (필수, 모든 참가자)
- KakaoTalk ID (한국 참가자)
- WhatsApp (글로벌)
- Instagram / TikTok / YouTube
- 전화번호 (옵션, **시상자 필수**)

→ 시상금 송금/실물 트로피 발송에 전화 + 주소 필요.

### 4. 명예의 전당 (Hall of Fame) — 시즌 0 발사 후

```
/admin/hall-of-fame              # 시즌 횡단 누적 통계
```

상세는 [[project-hall-of-fame]] memory.

- 시즌별 1/2/3등 누적
- 점수 95+ 작품 (LEGENDARY) 누적
- "The First 100" — 시즌 0 첫 100명 영구 명예
- 시즌 횡단 통계 (다 시즌 출전 / 평균 점수 / 최고 기록)

향후 public 페이지로 노출 가능 (마케팅 + 창작자 인센티브).

---

## DB 추가 사항

### A. `genesis_applications` 컬럼 추가

```sql
ALTER TABLE genesis_applications
  ADD COLUMN IF NOT EXISTS kakao_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_handle TEXT,
  ADD COLUMN IF NOT EXISTS youtube_handle TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;
```

→ 2차 작업 마이그레이션.

### B. `scoring_results` 테이블 (신규)

```sql
CREATE TABLE scoring_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES genesis_applications(id) ON DELETE CASCADE,
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  round TEXT NOT NULL CHECK (round IN ('application', 'main')),

  -- 각 AI 모델별 4개 항목 점수
  claude_intent NUMERIC, claude_execution NUMERIC, claude_originality NUMERIC, claude_integrity NUMERIC,
  gpt_intent NUMERIC, gpt_execution NUMERIC, gpt_originality NUMERIC,
  gemini_intent NUMERIC, gemini_execution NUMERIC, gemini_originality NUMERIC,

  -- 최종 점수 + 등급
  verified_score NUMERIC,
  grade TEXT,                       -- LEGENDARY/MASTERPIECE/EXCELLENT/SKILLED/AVERAGE/ADEQUATE/NEEDS_WORK

  -- Integrity 플래그
  integrity_flag BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,

  judged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(application_id, round)
);

CREATE INDEX scoring_results_season_idx ON scoring_results (season_id, verified_score DESC);
CREATE INDEX scoring_results_grade_idx ON scoring_results (grade);
CREATE INDEX scoring_results_flag_idx ON scoring_results (integrity_flag) WHERE integrity_flag = TRUE;
```

→ 3차 작업 마이그레이션. **oxxovo-scoring 레포와 schema 정합 필수** (두 레포 통합 지점).

### C. `winners` 테이블 (신규)

```sql
CREATE TABLE winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES genesis_applications(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,            -- 1, 2, 3, ...
  prize_amount NUMERIC,
  badge TEXT,                       -- "Genesis Champion", "Runner-up" 등 (시즌별 변동, name에서 derive 가능)
  announced_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season_id, rank)
);

CREATE INDEX winners_season_rank_idx ON winners (season_id, rank);
```

→ 3차 작업 마이그레이션.

### D. `hall_of_fame` VIEW (신규)

```sql
CREATE OR REPLACE VIEW hall_of_fame AS
SELECT
  w.application_id,
  ga.creator_name,
  ga.email,
  COUNT(*) FILTER (WHERE w.rank = 1) AS first_place_count,
  COUNT(*) FILTER (WHERE w.rank = 2) AS second_place_count,
  COUNT(*) FILTER (WHERE w.rank = 3) AS third_place_count,
  SUM(w.prize_amount) AS total_prize_won,
  COUNT(DISTINCT w.season_id) AS seasons_won,
  MIN(w.announced_at) AS first_win_at,
  MAX(w.announced_at) AS latest_win_at
FROM winners w
JOIN genesis_applications ga ON ga.id = w.application_id
GROUP BY w.application_id, ga.creator_name, ga.email
ORDER BY first_place_count DESC, total_prize_won DESC;
```

→ 4차 작업 마이그레이션 (winners 테이블 데이터 누적 후).

---

## 추가 페이지 구조 (v1 + v2)

```
# 1차 (v1)
/admin                          # 대시보드
/admin/login                    # admin 로그인
/admin/seasons                  # 시즌 목록
/admin/seasons/new              # 새 시즌 생성
/admin/seasons/[id]             # 시즌 수정

# 2차 (v2 추가)
/admin/applications             # 라운드별 참가자 명단 + 필터 + Export
/admin/applications/[id]        # 개별 상세 + 영상 임베드 + 연락처 + admin notes
/admin/contacts                 # 연락처 통합 (참가자 채널 관리)

# 3차 (v2 추가)
/admin/winners                  # 수상자 명단 + 점수별 등급

# 4차 (v2 추가, 시즌 0 후)
/admin/hall-of-fame             # 시즌 횡단 영구 명예 기록

# 5차 (v1)
/admin/emails                   # 수동 작성/발송
/admin/emails/templates         # 자동 트리거 16개
/admin/emails/logs              # 발송 로그 (6차+7차)

# 7차 (v1)
/admin/dashboard                # 차트, 통계
```

---

## oxxovo-scoring 레포 통합 지점

[[reference-repos]] memory 참고 — 두 레포 구조:
- **oxxovo** (현재): 웹사이트 + admin
- **oxxovo-scoring**: Triple-AI 채점 엔진

**통합 지점 = `scoring_results` 테이블** (3차 작업).
- oxxovo-scoring이 채점 결과를 `scoring_results` 테이블에 INSERT
- oxxovo (admin)이 같은 테이블을 SELECT로 표시

3차 작업 전 oxxovo-scoring 측 schema 정합 확인 필수 (지수가 SQL 패키지 보낼 때 oxxovo-scoring 새 지수와 컬럼 합의).

---

## 시즌 0 발사 전 필수 4차수 추천

### 1차 → 2차 → 3차 → 5차 순서

1. **1차 (인증 + 시즌 CRUD)** — admin 자체가 동작해야 다른 작업 진행 가능
2. **2차 (applications + 영상 + 연락처)** — 신청 받기 시작 전 데이터 관리 인프라
3. **3차 (scoring_results + winners + 등급)** — 본선 진행 + 시상 인프라
4. **5차 (이메일 트리거 + 템플릿)** — 자동 발송 (신청 확인, Top 50 알림 등)

**소요 시간**: 22~30시간 = 풀타임 ~1.5주 / 파트타임 ~2~3주

### 시즌 0 발사 후

- 4차 (Hall of Fame) — 데이터 생긴 후
- 6차 (수동 일괄 발송) — 시즌 종료 후 회고/마케팅 메일
- 7차 (로그 + 통계 + Export) — 운영 데이터 회고

---

## 1차 작업 상태 (v1 그대로 진행)

`reports/admin-1차-2026-05.md`의 SQL 패키지 그대로 유효.
v2 변경 사항이 1차에 영향 없음 (1차 = 인증 + 시즌 CRUD만).

**TK 대표님 SQL 실행 대기 중**:
1. 사전 정리 B: `UPDATE seasons SET name = 'GENESIS'`
2. profiles + is_admin + RLS
3. Supabase Auth 본인 회원가입
4. admin role INSERT
5. 검증 query

SQL 실행 완료 + 검증 결과 공유 → 1차 코드 작업 시작.

---

## 의문/결정 사항 (v2 추가)

1. **scoring_results schema 정합** — 3차 작업 전 oxxovo-scoring 새 지수와 컬럼 합의 시점/방법?
2. **연락처 추가 입력 흐름** — 시즌 0 신청자는 카카오/WhatsApp 안 받음 (현재 폼에 없음). admin에서 수동 입력? 또는 시즌 0 후 follow-up?
3. **시상자 전화/주소** — 시상 발표 직전 별도 폼으로 받기? 또는 신청 폼에 옵션 추가?
4. **Hall of Fame public 노출** — 4차 admin 페이지만? 또는 동시에 `/hall-of-fame` public도?
5. **등급 임계값 변경 시점** — v2.3 룰북 정식화 시 grade 컬럼 재계산 필요. trigger 자동 vs admin 수동 액션?
