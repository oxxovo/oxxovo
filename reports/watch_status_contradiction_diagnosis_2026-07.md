# Watch 상태 모순 진단 — 배너 "우승 발표" vs 카드 "심사 중/본선 진행" (2026-07-19, 지수2)

★**진단만. 수정·배포 없음.** 고칠지·범위는 TK님이 이 진단 보고 결정.

## 관찰 (S999 season_test, status=completed)
- 상단 **배너**: "The winners have been announced." (우승 발표됨)
- 히어로 **카드**(LiveStatusBar): "본선(Main Round)" + "Triple-AI 심사 중 10/10"
- 모순: "발표 끝"인데 "심사/본선 진행 중" 공존.

S999 날짜(참고): `main_round_start_at`=7/13, `main_round_end_at`=7/14, `community_vote_end_at`=7/15, **`awards_announcement_at`=7/15(과거)**. (컬럼명은 `awards_announcement_at` — `results_announced_at` 아님.)

---

## Q1. 배너 로직 vs 카드 로직 — 각각 뭘 읽나

| | 배너 (`ArenaBanner`) | 히어로 카드 (`LiveStatusBar`) |
|---|---|---|
| 계산처 | `getBannerStage()` (lib/watch.ts:463) | ArenaWatch.tsx:66-99 props |
| 방식 | **precedence 상태머신** (results>voting>main_live>finalists>judging>accepting), 하나만 반환 | 개별 props 조합, 상태머신 없음 |
| "results" 조건 | `awards!=null && now>=awards && winnerCount>0` (lib/watch.ts:481) — ★**정직성 가드(winnerCount)** | 해당 없음 |
| 카드 라운드명 | — | `roundName = inMainRound ? 'Main Round' : ...` where `inMainRound = now >= main_round_start_at` (ArenaWatch:73) — ★**상한 없음** |
| 카드 "심사 중" | — | `showJudging = judging.total > 0` (LiveStatusBar:103) — 심사풀 있으면 무조건 |

**핵심**: 배너는 전체 라이프사이클을 아는 상태머신이고 `results` 우선순위라 **정확히 "우승 발표"만** 뜬다. 카드는 **타임라인(`inMainRound`)과 심사풀(`total>0`)만** 보고, 그 둘이 **본선 시작 후 영구히 true로 고정**된다:
- `inMainRound`: `now >= main_round_start_at` 만 검사 → 본선 시작 후 **영원히 'Main Round'** (본선 종료·투표·발표 단계로 안 넘어감).
- `judging.total>0`: 채점된 항목이 하나라도 있으면 영구 true → **10/10 완료여도 "심사 중" 라벨** (LiveStatusBar:134은 "Triple-AI 심사 중" 하드코딩, judgingComplete는 shimmer만 끔).

→ 카드는 "본선 + 심사 중"에서 **더 이상 진행하지 못하는 종점 미인식** 상태. 배너와 카드가 서로 다른 코드경로라 어긋난다.

## Q2. ★테스트 artifact인가, 실제 시즌0 버그인가 → **실제 버그 (시즌0 재현)**
- 카드 조건은 **어느 시즌이든 본선 시작+채점 후 항상 true**로 고정된다(시즌0 포함). S999는 이 종점에 **처음 도달한 시즌**이라 버그가 노출된 것뿐, 테스트 특수 상태가 아님.
- 시즌0 시나리오(9월): 본선(9/3~5) → 투표(~9/7) → 발표(9/8, awards+winners) 시점에 **배너는 "winners announced"로 올바로 넘어가지만, 카드는 여전히 "Main Round / Triple-AI 심사 중 N/N"** 을 표시 → 동일 모순이 **가장 중요한 순간(시상 발표)** 에 공개된다.
- 성격: **표시(display) 정합성 버그** — 데이터/정산/돈 문제 아님. 단 관객이 보는 화면이 자기모순이라 **신뢰도 타격**(특히 발표일).
- 부수 버그: 심사 10/10 완료여도 "심사 중" 문구(완료 시 "심사 완료"로 안 바뀜).

## Q3. 우승 발표 정직성 가드가 왜 안 막았나
- 정직성 가드(`winnerCount>0`)는 **배너에만** 걸려 있다(getBannerStage results 스테이지, lib/watch.ts:481 + ArenaWatch:143-145). 그 목적은 "날짜만 지나고 실제 우승자(award_rank) 없는데 발표 배너 뜨는 것"을 막는 것 — **그 일은 정확히 하고 있다**(그래서 배너가 뜬 건 S999에 실제 award_rank 우승자가 있어서 = 정직).
- 카드(roundName/judging)는 **가드가 없는 별도 경로** — `winnerCount`나 results 스테이지를 아예 참조하지 않는다. 가드는 배너용으로 설계됐고 카드를 커버하도록 만들어지지 않았다. → 가드 실패가 아니라 **가드 적용 범위 밖**.

## Q4. 발사 블로커 "시상 버튼 투표완료 게이트"와 같은 뿌리인가 → **다른 표면·다른 실패, 공통 아키텍처 뿌리**
- 시상 버튼 게이트: `approveTop3Awards`(app/admin/applications/actions.ts)는 `award_rank+status='awarded'`만 기록, **투표완료(`now>=community_vote_end_at`) 검사 없음**. 버튼도 `disabled={approving || scoredCount===0}`(MainResultsView:183)로 **채점 여부만** 게이트 → 투표 끝나기 전 시상 확정 가능(커뮤니티 투표가 최종점수 반영이라 데이터 정확성 문제). = **admin 액션·데이터 정산 타이밍** 문제.
- Watch 카드 모순: **공개 화면·표시 정합성** 문제.
- → **구체 버그는 별개**(표면·실패유형 다름). 단 **공통 뿌리 = 시즌 라이프사이클/단계가 표면마다 제각각 도출됨**: 잘 만든 상태머신(`getBannerStage`)은 **배너 전용**이고, 히어로 카드는 자체 재도출(inMainRound/judging), 시상 게이트는 scoredCount만 봄. **단일 정본 "현재 단계" 소스가 없어** 표면끼리 어긋난다.

## ★실제 시즌0 위험도 = **있음 (실버그)**
발표일에 관객이 자기모순 Watch를 본다. 데이터 손상은 아니나 발표 순간의 신뢰도 이슈. 발사 전 정리 권장(블로커까지는 아니나 발표 전 필수).

## 고칠 범위 제안 (미적용 — TK 결정)
1. **최소 수정 (카드 종점 인식)**: `getBannerStage`(또는 그 stage)를 ArenaHero/LiveStatusBar에 전달 → stage가 `voting`/`results`면 **"심사 중" 행 숨김 + 라운드명 보정**. `inMainRound`에 `main_round_end_at` 상한 추가로 본선 종료 후 'Main Round' 고정 해제.
2. **라벨 보정(부수)**: judgingComplete일 때 "Triple-AI 심사 중" → "심사 완료".
3. **★근본(권장)**: 단일 `getSeasonPhase(season, winnerCount, ...)` 정본 함수 도입 → 배너·히어로 카드·시상 버튼 게이트가 **모두 이걸 소비**. 이러면 (a)카드 모순 해소 (b)시상 버튼에 `phase>=results 전이면 disabled`로 투표완료 게이트 자연 해결 — Q4의 두 문제를 한 뿌리에서 정리.

## 관련 파일
- lib/watch.ts:416-544 (`getBannerStage`, 정직성 가드 481)
- app/watch/ArenaWatch.tsx:66-147 (roundName/isAccepting/judging 도출 + 배너 입력)
- app/watch/LiveStatusBar.tsx:103-150 ("심사 중" 카드)
- app/admin/applications/actions.ts (`approveTop3Awards`, 투표 게이트 부재) · app/admin/seasons/[id]/main-results/MainResultsView.tsx:183
