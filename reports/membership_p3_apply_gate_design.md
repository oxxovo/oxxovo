# 멤버십 P3 — /apply 크리에이터 게이트 설계 (DESIGN ONLY, 2026-06-14)

상태: **실측 완료 + 설계만. 코드 연결 X.** TK 승인 후 와이어링.
설계자: 지수(oxxovo 본체). 원칙: dark launch 보존 / 서버 권위 / 하드코딩 금지 / 직교 2축.

===========================================================================
## A. 현재 /apply 흐름 (실측 file:line)
===========================================================================

### A-1. 클라이언트 (app/apply/page.tsx)
- 마운트 시 `getSessionUser()` -> 없으면 `/login?redirect=/apply` (로그인 필수, line 64-68)
- `getStudioApplicationFlag(season.id)` (actions.ts) 로 스튜디오 퍼널 여부 판정
  -> true(session6 ON + studio_round=application/both)면 `<FunnelScreen>` -> /studio
  -> false면 외부 URL 폼 직접 제출
- 제출 = `fetch('/api/apply', POST)` (line 132). 게이트 없음 — **로그인만**.

### A-2. 서버 권위 신청 생성 지점 3곳 (새 genesis_applications row)
1. `app/api/apply/route.ts` POST insert (line 101) — 외부 URL. `getUserOrNull()`만 체크.
2. `lib/studio.ts` submitGeneration insert (line 426) — 스튜디오 단일생성. **지수2 소유**.
3. `lib/studio.ts` submitRender insert (line 866) — 스튜디오 compose. **지수2 소유**.
- 이후 라운드 UPDATE(준결승 463/897, 결승 494/926)는 신청 생성 아님 -> 게이트 대상 아님.

### A-3. 현재 게이트 = 로그인만
- 멤버십 등급 체크 없음. 누구나 로그인하면 신청 INSERT 가능.

===========================================================================
## B. 게이트 설계 (lib/membership.ts 공유 헬퍼)
===========================================================================

### B-1. 헬퍼 (server-only, 신규)
```
export type ApplyGateResult =
  | { ok: true }
  | { ok: false; reason: 'membership_required' }
  // entry_fee_unpaid 는 P4 seam (아래 D-2). season0=0 이라 지금은 미발생.

export async function checkApplyGate(userId: string): Promise<ApplyGateResult>
```
판정 순서 (전부 fail-safe = 기존 흐름 보존 방향):
1. `isMembershipEnabled()` false  -> { ok: true }   // dark launch: 게이트 OFF
2. config `membership_required_for_apply` false -> { ok: true }  // 멤버십 비선행
3. `getMembershipState(userId).isActiveCreator` false -> { ok: false, 'membership_required' }
4. else -> { ok: true }

* 핵심: enabled=false면 **무조건 통과** = 현재(시즌0 dark launch) 흐름 100% 보존.
* 만료 판정은 P1 단일 진실원 재사용(저장 tier 아니라 status='active' + expires_at window).

### B-2. 연결 지점 (3곳, INSERT 직전)
- #1 `/api/apply` (지수 소유): user 인증 직후 `checkApplyGate(user.id)` ->
  !ok 면 `NextResponse.json({ error: 'membership_required' }, { status: 403 })`.
  ApplyErrorCode 에 'membership_required' 추가 + 클라이언트 i18n 매핑.
- #2 #3 `lib/studio.ts` (지수2 소유): INSERT 직전 동일 `checkApplyGate` 호출,
  !ok 면 `{ ok: false, reason: 'membership_required' }` 반환.
  -> **지수2 인계: 공유 헬퍼 한 줄 삽입**(import + INSERT 앞 가드). 본체가 헬퍼 제공.

===========================================================================
## C. 신청 입구 퍼널 (멤버십 없으면 -> 청구 -> 신청)
===========================================================================
멤버십 게이트 ON + 비크리에이터일 때 폼/스튜디오퍼널 대신 멤버십 게이트 화면:

### C-1. Founding 잔여 조회 (신규 read 헬퍼)
```
export async function getFoundingStatus():
  Promise<{ claimed: number; cap: number; remaining: number; open: boolean }>
```
- counter.claimed + config cap. open = remaining>0.

### C-2. 청구 입구 액션 (신규 server action, P2 래퍼)
```
'use server'
export async function claimFoundingForCurrentUser(): Promise<FoundingClaimResult>
  -> user=getUserOrNull(); claimFoundingCreator(user.id)
```
- 'claimed'/'already_founding' -> 이제 크리에이터, 폼 진행
- 'quota_full' -> 유료 경로(P4) 안내 화면 (아직 결제 불가 -> "coming soon" placeholder)
- 'disabled' -> 게이트 OFF 였다는 뜻(정상 흐름)

### C-3. 화면 (MembershipGateScreen, 신규 — 와이어링 단계에서 구현)
- 잔여 있음: "Founding Creator #{claimed+1} of {cap} — 1년 무료" + [무료로 시작] 버튼
  -> claimFoundingForCurrentUser() -> 성공 시 리로드 -> 폼 노출
- 잔여 없음(quota_full): "Founding 마감. 크리에이터 멤버십 $19.99/월 — 곧 오픈"(P4)
- 디자인 토큰 = signup 톤([[feedback_design_tokens]]), 영어 기본 + 한국어.

===========================================================================
## D. 결정 필요 (TK)
===========================================================================
1. **청구 트리거**: 자동(신청 시도 시 자동 founding 부여) vs 명시(버튼 클릭 동의)?
   추천 = **명시**. 1년 후 자동갱신 시작되는 멤버십이라 사용자 동의 명확히. 무료라도.
2. **시즌0 P4 타이밍**: founding 100 이 정원 500 다 차기 전 소진되면 101~500 은
   유료(P4) 필요. 시즌0 오픈(8/3) 전 P4 준비돼야 함. (이미 P4=시즌0 필수로 표시.)
3. **entry_fee 강제**: P3 범위에서 제외(membership 게이트만). season0 entry_fee=0
   이라 무관. entry_fee>0(시즌1+) 결제 강제는 P4(구독/결제 인프라)와 함께. 확인?
4. **지수2 인계 방식**: 본체가 checkApplyGate 헬퍼 제공 -> 지수2가 studio INSERT
   2곳(#2 #3)에 한 줄 삽입. 이 분담 OK?
5. **비크리에이터 일반멤버**: 게이트 ON 시 신청 완전 차단(멤버십 가입 유도). 의도 맞음
   (required_for_apply=true). 확인?

===========================================================================
## E. dark launch 안전 (현재 시즌0)
===========================================================================
- membership_enabled=false -> checkApplyGate 무조건 { ok:true } -> **기존 흐름 0 변경**.
- 신규 헬퍼/액션은 enabled=true 일 때만 동작. 와이어링해도 라이브 영향 0(스위치 OFF).
- 스위치 ON 시점 = 멤버십 발사 결정(시즌0 오픈 전, P4 결제 준비 후).

===========================================================================
## F. 지수2 인계 — studio INSERT 2곳 게이트 연결 (#2 #3)
===========================================================================
본체가 공유 헬퍼 제공 완료(`checkApplyGate` in lib/membership.ts, 라이브). #1(/api/apply)
연결 완료. studio.ts 의 신청 생성 INSERT 2곳만 지수2가 한 줄씩 삽입.

### 대상 (둘 다 "새 application row 생성" 지점, 이후 라운드 UPDATE는 대상 아님)
- submitGeneration: `lib/studio.ts` INSERT (현재 line 426). 바로 위에 이미
  "S-1/S-2: this auto-created row IS an application, so it must obey the same
  gates as POST /api/apply" 주석 있음 -> 그 게이트 자리.
- submitRender: `lib/studio.ts` INSERT (현재 line 866). 동일 구조.

### 삽입 (각 INSERT 직전, season/closed/capacity 체크 다음)
```ts
// at top of file:
import { checkApplyGate } from '@/lib/membership'

// right before `admin.from('genesis_applications').insert({...})`:
// P3 membership gate -- same creator-membership prerequisite as POST /api/apply.
// Fail-OPEN: in season-0 dark launch (membership_enabled=false) this passes and
// the studio flow is unchanged.
const gate = await checkApplyGate(args.userId)
if (!gate.ok) return { ok: false, reason: 'membership_required' }
```

### 지수2 할 일 2가지
1. 위 가드를 #2 #3 두 INSERT 직전에 삽입(args.userId 사용).
2. studio submit 결과 reason 유니온에 `'membership_required'` 추가(클라이언트 매핑).
- 라운드 UPDATE(준결승/결승)에는 넣지 말 것 — 신청 시점에 이미 통과.
- dark launch라 지금 삽입해도 라이브 영향 0(스위치 OFF).
