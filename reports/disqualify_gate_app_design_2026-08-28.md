# 실격(disqualification) 게이트 — 앱(oxxovo) 반영 설계

2026-08-28. 범위: DB 스키마는 이미 Run 완료(별도 세션 확인, `scripts/zz_probe_disqualify_gate_schema_2026-08-28.mjs`가
`seasons.main_round_disqualify_*`, `main_round_disqualification_events` 존재를 프로브하는 걸로 봐서 실제 반영됨).
심사 로직(oxxovo-scoring이 required_elements를 채점해 disqualified를 쓰는 부분)은 범위 밖.
**이 문서는 설계만이다 — 코드는 건드리지 않았다.**

새 필드 요약 (프롬프트 원문 그대로, 재확인 안 함):
- `seasons.main_round_required_elements`(JSONB), `main_round_disqualify_missing_votes`(INT, 1~3, default 3),
  `main_round_disqualify_appeal_hours`(INT, default 24), `main_round_disqualify_enabled`(BOOL, default false — 지금 꺼짐)
- `scoring_results.claude/gpt/gemini_required_elements`(JSONB×3), `required_elements_missing_votes`(JSONB),
  `disqualified`(BOOL, default false), `disqualification_reason`(TEXT)
- `genesis_applications.main_round_disqualified`(BOOL, default false), `disqualified_at`, `disqualification_notified_at`
- `main_round_disqualification_events`(id, application_id FK, event_type IN ('disqualified','reinstated','re_disqualified'),
  actor_id FK→auth.users, reason, created_at) — RLS ON, service_role만 grant

---

## 1. 리더보드·최종점수에서 실격작 제외

### 지금 로직
`lib/scoring.ts:50-74` `computeFinalScore(aiScore, communityScore, season)`:
- `aiScore == null` → `null` (56행, 채점 미완료 = 랭킹 불가)
- `season.community_vote_weight === 0` → `aiScore * ai_score_weight` (61-63행, Soak 모드)
- `communityScore == null` → `null` (68행, 투표 미집계 = pending)
- 그 외 → 가중합산 (70-73행)

이 함수는 **순수 함수**이고 `disqualified`를 전혀 모른다. 실격 여부는 이 함수의 책임이 아니라 호출부(row 필터링)의 책임으로 보인다 — `aiScore==null`이 "채점 안 됨"을 랭킹 제외로 바꾸는 것과 같은 자리에 `disqualified`를 더 넣는 게 아니라, **호출 전에 행 자체를 거른다**가 기존 설계와 결이 맞다.

`computeFinalScore`를 실제로 호출하는 곳은 정확히 두 곳이고, **서로 독립된 별도 구현**이다 (공유 함수 없음 — 이미 존재하던 중복, 이번에 새로 생기는 게 아니다):

**(a) `app/admin/applications/actions.ts` `rankMainRound()` (408-474행)** — `approveTop3Awards`가 쓰는 서버 진실원천.
- `genesis_applications` select (417-420행): `id, email, country, creator_name, award_rank, user_id, main_round_submitted_at` — **`main_round_disqualified` 없음**
- `scoring_results` select (421-425행): `application_id, verified_score, judged_status` (round='main') — **`disqualified` 없음**
- `ranked` 배열 구성 (439-458행): `.filter((r): r is MainRoundRanked => r.finalScore != null)` (457행)에서 걸러짐

**(b) `app/admin/seasons/[id]/main-results/page.tsx` (15-107행)** — admin 리더보드 화면(승인 전 프리뷰).
- `genesis_applications` select (41-44행): `id, creator_name, email, main_round_video_url, status, award_rank, award_override_reason` — 역시 없음
- `scoring_results` select (48-51행): `application_id, verified_score, grade, judged_status, integrity_flag, integrity_confidence, integrity_recommendation` — 역시 없음
- `rows` 구성 (63-94행), 정렬만 하고 필터는 없음(전부 표시 — award_rank 미부여 상태의 프리뷰라서 의도적으로 다 보여주는 화면)

### 반영 지점 (구체)
두 곳 다 각자 고쳐야 한다 (중복 반영 지점):
1. `genesis_applications` select에 `main_round_disqualified` 추가 (actions.ts:417-420, page.tsx:41-44)
2. `scoring_results` select(round='main')에 `disqualified` 추가 (actions.ts:421-425, page.tsx:48-51)
3. (a)에서는 `ranked` 매핑 시 `main_round_disqualified` 또는 해당 round의 `disqualified`가 true인 application을 `finalScore` 계산 전에 걸러내거나, 457행 필터 조건에 `&& !a.main_round_disqualified`를 추가
4. (b)에서는 `rows`에 `disqualified: boolean` 필드를 추가해 `MainResultsView`가 배지로 보여줄지(승인 버튼은 (a) 경로만 타므로 (b)의 필터는 표시 전용) — **여기는 표시 정책이라 [3]과 겹친다** (아래 참고)

### `/watch/rankings` — 확인 결과 무관
`app/watch/rankings/page.tsx` (1-101행)는 **Championship Points 랭킹 페이지의 placeholder**다. 실제 순위 계산이 없고 `PendingSection`만 렌더(76-79행), 데이터는 `platform_config`의 reveal 날짜/행수뿐(35-50행). `computeFinalScore`도, `scoring_results`도 안 읽는다. 따라서 이 페이지는 실격 필터를 반영할 대상이 **아니다** — final_score 기반 공개 리더보드 자체가 지금 admin 전용 두 곳뿐이다.

`lib/watch.ts`의 카드 `publicScore`(328-336행, `scoreByKey`)는 `verified_score`(Layer-1)이지 `final_score`(Layer-2)가 아니다. 실격작의 verified_score를 Watch 카드에 계속 노출할지는 [3]의 표시 정책 판단에 걸린다 — 이 절에서는 다루지 않는다.

### 정책 판단 필요
- `disqualified`는 `scoring_results`(round별)에 있고 `main_round_disqualified`는 `genesis_applications`에 있다 — main round 랭킹에서는 어느 쪽을 신뢰할지(둘 다 OR로?) 명시 안 됨. 프롬프트 문면상 `main_round_disqualified`가 최종 플래그로 보이지만, `scoring_results.disqualified`가 먼저 써지고 `genesis_applications.main_round_disqualified`로 전파되는 시점차가 있을 수 있어 두 값이 잠깐 불일치할 창이 있는지는 oxxovo-scoring 쪽 쓰기 순서에 달려있다 — 이번 세션에서 확인 불가(레포 밖).

---

## 2. 시상 후보(award_rank)에서 제외

### award_rank를 쓰는 경로 전부
1. `approveTop3Awards()` (actions.ts:490-571) — `rankMainRound()`의 `ranked` 상위 3을 슬라이스(535행)해서 자동 기록. [1]에서 `rankMainRound`에 실격 필터가 들어가면 **자동으로 여기도 반영**된다(별도 수정 불필요).
2. `saveAwardRank(id, rank)` (actions.ts:164-222) — admin이 단일 application에 대해 임의 rank(1-99)를 직접 입력하는 수동 경로. **게이트가 전혀 없다** — `disqualified`인 application에 admin이 실수로/의도적으로 rank를 넣는 걸 막는 코드가 없음.
3. `saveAwardOverride(id, rank, reason)` (actions.ts:575-638) — 부정/오류 정정용 수동 override, `reason` 필수(585-587행). 이것도 disqualified 체크 없음.

`advance_season_finalists` RPC(레포에 CREATE 없음, `reports/advance_defer_automation_2026-06.sql` / `reports/advance_cut_line_2026-07.sql`에 정의, `app/api/cron/season-tick/route.ts:439`에서 호출)는 **award_rank가 아니라 `status`(selected/rejected)만 쓴다** — 예선→본선 진출 게이트이지 시상 게이트가 아니다. 혼동 주의: `award_rank`를 쓰는 DB 함수는 존재하지 않는다(전부 위 3개의 서버 액션 경유, 앱이 유일한 쓰기 경로).

### 반영 지점
- `rankMainRound()` 필터([1]) → `approveTop3Awards`는 자동 커버
- `saveAwardRank`/`saveAwardOverride`에 disqualified 체크를 넣을지는 **정책 판단**: admin이 override로 의도적으로 "실격이었지만 예외적으로 시상"하려는 케이스가 실무상 있을 수 있어(예: 오판정 이의제기 인용) 하드 블록이 맞는지 확신할 근거가 코드에 없다. 하드 블록한다면 두 함수 시작부(166-169행, 581-583행 근처, `rank !== null` 검증 다음)에 `SELECT main_round_disqualified FROM genesis_applications WHERE id=id` 조회 후 `rank`가 1~3이고 `main_round_disqualified===true`면 거부하는 식.

### 재계산 경로 — 지금은 없다
"이미 award_rank를 받은 뒤 실격되면?" — 코드상 **자동 재계산 트리거가 없다**. `approveTop3Awards`는 `input.season.winnerCount > 0`이면 Gate 0에서 바로 막힌다(`lib/awards-gate.ts:97-105`, `already_awarded`) — 재실행해서 다음 순위를 끌어올리는 경로가 아예 아니다. 유일한 수동 정정 경로는 `saveAwardOverride`(admin이 실격 확인 후 rank를 null로 내리고 사유 기록) — 그런데 그러면 **4위였던 사람이 자동으로 3위로 승격되지 않는다**. `rankMainRound`를 다시 호출해 "현재 4위가 누구인지" admin이 직접 확인하고 별도로 `saveAwardOverride`를 한 번 더 눌러야 한다. 이 승격 조회를 도와주는 UI/쿼리도 지금 없다.

**정책 판단 필요**: (a) 채점 워커가 사후에 `disqualified=true`를 쓰는 순간 이미 시상된 award_rank를 자동으로 무효화할지(웹훅/트리거 필요, 이번 스키마엔 그런 자동화가 없음 — service_role 전용 `main_round_disqualification_events`가 감사 로그일 뿐 실행 트리거는 아님), (b) 승격 큐(4위→3위)를 자동 계산해 admin에게 보여줄지, 전부 이번 범위 밖.

---

## 3. `/watch` 표시 정책 — 옵션만, 결정은 범위 밖

### 지금 로직
`lib/watch-visibility.ts:33-42` `isRowPublic(row)`:
```
if (HIDDEN_STATUSES.has(row.status)) return false   // 'flagged'만
if (row.watch_hidden) return false
if (row.watch_hold) return false
if (row.moderation_status !== 'approved') return false
return true
```
네 조건 전부 `disqualified`/`main_round_disqualified`와 무관. `VisibilityRow` 타입(20-25행)도 이 4개 필드만 가진다.

`lib/watch.ts`에서 이 규칙을 쓰는 4곳 전부 동일한 4-필드만 select해서 넘긴다: `loadWatchVideos`(264행 select, 346-347행 필터), `loadCurrentCompetitionStats`(391-392행, 410행), `getJudgingProgress`(447-448행, 462행), `getWatchVideo`(816-817행, 824행).

### 옵션 A — 완전히 숨김
`isRowPublic`의 `VisibilityRow`에 `main_round_disqualified: boolean | null`을 추가하고, `watch_hold` 체크 옆에 `if (row.main_round_disqualified) return false`를 추가. `watch_hidden`과 동급의 "숨김 사유"로 취급하는 셈이다.
- 반영 지점: `lib/watch-visibility.ts` 1곳(함수 본체) + `lib/watch.ts`의 4개 select에 컬럼 추가(264, 392, 448, 817행) + 각 호출부에서 넘기는 row 타입에 필드 추가.
- 장점: 코드 변경이 가장 작고, `isRowPublic`이 여전히 "이 항목이 공개 대상인가"라는 단일 질문에 답한다는 기존 설계 원칙을 유지.
- 단점: 이미 `본선 30강 진출` 등으로 노출됐던 영상이 갑자기 사라지면 "탈락 후에도 Watch엔 남는다"는 기존 정책(83행 주석, `TK/advisor 2026-07-11` — NotSelected 이메일이 "your work stays public"을 약속)과 상충 소지. 단 그 정책은 `status='rejected'`(예선 탈락)에 대한 것이지 `disqualified`(본선 실격)에 대한 것은 아니라서 반드시 상충한다고 단정은 못 함 — 이 구분이 실제로 유효한지는 정책 판단.

### 옵션 B — "실격됨" 배지 달고 계속 노출
`isRowPublic`은 건드리지 않는다(실격은 visibility 규칙이 아니라는 입장). 대신:
- `WatchVideo` 타입(`lib/watch.ts:30-65`)에 `disqualified: boolean` 필드 추가
- `toWatchVideo()`(172-218행)에서 `row.main_round_disqualified`(또는 round='main'인 경우 `scoring_results.disqualified`)를 그대로 실어 반환
- UI 배지 렌더링은 카드 컴포넌트 쪽(이번 조사 범위 밖 — `app/watch/WatchShell.tsx` 등에서 `awarded`/`staffPick`과 나란히 `disqualified` 배지를 다는 자리를 찾아야 함, 미확인)
- 반영 지점: `lib/watch.ts` 타입 + `toWatchVideo` + (main round는) `loadWatchVideos`의 `scoreAgg` select(273행)에 `disqualified` 추가해 `extra`로 넘김 + UI 컴포넌트

### 판단 보류 사유
두 옵션 다 코드량은 작지만 **어느 쪽이 맞는지는 순수 정책 문제**다 — "실격됐지만 왜 실격됐는지 투명하게 공개해 신뢰를 지킨다" vs "실격작은 노출 자체가 부정행위를 조명하는 역효과"라는 트레이드오프는 이 리포트가 판단할 사안이 아니다. TK 결정 필요.

---

## 4. 어드민 실격 사유 노출 + 되돌리기(기록 남게)

### 지금 어드민 상세 페이지 구조
`app/admin/applications/[id]/page.tsx` (1-70행):
- `genesis_applications` select (17-23행): `id, season_id, email, creator_name, country, channel_url, free_entry_url, video_duration_seconds, ai_service, creator_statement, status, award_rank, admin_notes, created_at, winner_info_completed_at` — **`main_round_disqualified`/`disqualified_at`/`disqualification_notified_at` 없음, 추가 필요**
- `scoring_results` select (39-44행): `round='application'`(예선)만 조회 — **`round='main'`의 `disqualification_reason`/`disqualified`는 아예 안 가져온다**. 본선 실격 사유를 보여주려면 여기 main round select를 새로 추가해야 함.

### 기존 서버 액션 패턴 (재사용할 형태)
`app/admin/applications/actions.ts`의 3개 액션이 동일 패턴:
1. `requireAdmin()` → 실패 시 redirect (admin-auth.ts:12-33, `admin.id`를 actor로 씀)
2. `createSupabaseServer()`(인증된 role, RLS 적용)로 `.update(...).eq('id', id).select(...).single()`
3. 부수효과(이메일, 포인트 동기화 등)는 try/catch로 감싸 메인 업데이트를 막지 않음
4. `revalidatePath(...)` 여러 경로
5. `AdminActionState { ok, messageKey?, errorMessage? }` 반환

예: `saveAwardOverride`(575-638행)는 `reason` 필수(585-587행, `trimmed`가 빈 문자열이면 거부) — **되돌리기도 사유 필수로 만드는 게 이 패턴과 일치**.

### `main_round_disqualification_events`는 service_role 전용 — 다른 클라이언트 필요
프롬프트에 명시된 대로 이 테이블은 RLS ON + anon/authenticated grant 없음, service_role만. 즉 `createSupabaseServer()`(인증된 admin 계정이지만 DB 레벨에선 `authenticated` role)로 이 테이블에 INSERT하면 RLS에 막혀 실패한다. **`createSupabaseAdmin()`(service-role 클라이언트)를 이 INSERT에만 따로 써야 한다** — `genesis_applications` UPDATE는 기존처럼 `createSupabaseServer()`로 충분(이미 admin이 쓰던 테이블).

### 배선 제안 (기존 패턴을 그대로 따른 형태, 미작성 코드)
```ts
// app/admin/applications/actions.ts에 추가할 형태 (실제로 작성하지 않음)
export async function reinstateDisqualification(
  id: string,
  reason: string,
): Promise<AdminActionState> {
  const admin = await requireAdmin()
  const trimmed = reason.trim()
  if (!trimmed) return { ok: false, errorMessage: 'Reinstate reason is required' }

  const supabase = await createSupabaseServer()
  const { data: row, error } = await supabase
    .from('genesis_applications')
    .update({ main_round_disqualified: false })
    .eq('id', id)
    .select('id, season_id, user_id')
    .single()
  if (error) return { ok: false, errorMessage: error.message }

  // service_role 전용 테이블 — createSupabaseServer(authenticated)로는 RLS에 막힘.
  const dbAdmin = createSupabaseAdmin()
  const { error: evErr } = await dbAdmin
    .from('main_round_disqualification_events')
    .insert({
      application_id: id,
      event_type: 'reinstated',
      actor_id: admin.id,
      reason: trimmed,
    })
  if (evErr) console.error('[reinstateDisqualification] event log failed:', evErr.message)

  revalidatePath('/admin/applications')
  revalidatePath(`/admin/applications/${id}`)
  return { ok: true, messageKey: 'status_saved' }
}
```

### 정책 판단 / 애매하게 겹치는 지점
- **원자성 없음**: `genesis_applications` UPDATE와 `main_round_disqualification_events` INSERT가 별도 왕복이라, 1번은 성공하고 2번이 실패하면 "되돌렸지만 감사 로그가 없는" 상태가 생긴다. 위 스켈레톤은 `saveAwardOverride`처럼 이벤트 로그 실패를 비차단(로그만)으로 처리했는데, 이 테이블이 감사(audit) 목적이라는 걸 감안하면 오히려 **트랜잭션으로 묶는 RPC**가 나을 수도 있다 — `applyRecommendation`이 이미 이 문제를 RPC(`apply_season_recommendations`, atomic)로 푼 선례가 있다(actions.ts:287-291). 어느 쪽으로 갈지는 판단 필요.
- **award_rank/status와의 상호작용**: 되돌리기(`reinstated`) 후 이 application이 이전에 award_rank를 갖고 있었다면 그것도 복원해야 하는지 — [2]의 재계산 문제와 정확히 겹친다. 이번 스켈레톤은 `main_round_disqualified`만 되돌리고 award_rank는 손대지 않는데, 그게 맞는 기본값인지는 정책 판단.
- **통보 이메일**: `disqualification_notified_at` 컬럼이 있다는 것은 최초 실격 시 통보 이메일이 예정돼 있다는 뜻으로 보이는데, 그 발송 로직(누가 언제 채우는지 — oxxovo-scoring 쪽인지, 앱의 email-tick인지)은 이번 조사에서 못 찾았다 — **미확정**, 별도 확인 필요.
- **되돌리기 UI 위치**: 지금 `ApplicationDetail.tsx`의 우측 액션 컬럼(167-173행)엔 `StatusEditor`/`AwardEditor`/`NotesEditor` 세 개뿐. 실격 사유 표시 + 되돌리기 버튼을 새 섹션으로 넣을지, 기존 `IntegrityReviewSection`(201-259행, `showIntegrityReview` 게이트)과 유사한 조건부 섹션으로 넣을지는 UI 판단(코드 없음, 이번 범위 밖).

---

## 요약 — 정책 판단이 필요한 지점 (5개)
1. [1] `scoring_results.disqualified` vs `genesis_applications.main_round_disqualified` 중 랭킹 필터가 어느 걸 신뢰할지(OR인지)
2. [2] `saveAwardRank`/`saveAwardOverride`에서 실격작에 대한 수동 시상을 하드 블록할지
3. [2] 사후 실격 시 이미 준 award_rank를 자동 재계산(승격)할지, 수동 정정만 지원할지
4. [3] Watch 노출을 완전 숨김(A)으로 할지 배지 노출(B)로 할지
5. [4] `genesis_applications` UPDATE + 이벤트 INSERT를 RPC로 원자화할지, 실격 통보 이메일 발송 주체는 누구인지

미확정 사항: 통보 이메일 발송 로직 소재, Watch 카드 배지 UI 컴포넌트 위치(옵션 B 채택 시).
