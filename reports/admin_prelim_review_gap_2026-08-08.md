# ⑥G 어드민 예선 검토 — 갭 실측

2026-08-08, 레인 A. ★**실측만. 코드 0줄.** 기준 `feat/studio-budget-guard @ 004a273`.
"대부분 이미 있다"는 전제를 확인하고 **없는 것만** 적는다.

## 1. 이미 있는 것 (전제 확인됨)

| 화면 | 있는 것 |
|---|---|
| `/admin/applications` (394줄) | 상태 6세그먼트(all·pending·flagged·selected·waitlist·awarded·rejected) · 검색 · 정렬 4종(제출순·점수순·이름순) · 행에 `verified_score`·`grade`·`integrity_flag` |
| `/admin/applications/[id]` (539줄) | `scoring_results` 전 컬럼 · AI outputs · explanation · integrity · `judged_status`별 분기 표시 |
| `actions.ts` (555줄) | 메모 · 상태 변경 · 어워드 랭크 · 추천 적용 · Top3 승인 · 어워드 오버라이드 |
| `RecommendationsPanel` (331줄) | 추천 목록 + integrity_flag 교차 |
| `/admin` 대시보드 | 채점 통계 — completed / in_progress / failed + confidence 4버킷, ★`round='application'`으로 정확히 필터됨 |

★**예선 라운드 분리는 이미 옳다.** `page.tsx:56`과 `admin/page.tsx:31` 둘 다
`.eq('round', 'application')`이다. 본선 점수가 예선 화면에 섞이지 않는다.

## 2. 갭 — 3건

### ★갭 1. 채점 통계에 **분모가 없다** (제일 큼)

`app/admin/DashboardView.tsx:191` = `const totalJudged = stats.completed`.
completed·in_progress·failed **셋 다 `scoring_results`에 행이 있는 것만** 센다
(`app/admin/page.tsx:28~45`).

→ ★**큐에 아예 안 들어간 참가작은 어느 카운터에도 안 잡힌다.** 행이 없으니 pending도
아니다. 11/7에 운영자가 물어야 하는 단 하나의 수 — **"심사가 안 붙은 편이 몇 편인가"** —
가 **0으로도 100으로도 똑같이 보인다.**

반증 가능한 형태: **제출편수(`free_entry_url IS NOT NULL`) vs `scoring_results` 행수**.
두 수가 같으면 정상, 다르면 그 차이가 누락분이다. ★**앞의 수를 세는 admin 화면이 0개**다
(`free_entry_url`은 상세의 임베드와 select 목록에만 나온다).

- 파일 **2** (`app/admin/page.tsx`, `app/admin/DashboardView.tsx`) · **~25줄**
- 결정 **1**: 분모를 **"영상이 있는 편"**(=채점 대상의 정의)으로 두나 **"제출 상태 전부"**로
  두나. ★전자를 권한다 — `free_entry_url IS NOT NULL`이 스코어러가 쓰는 바로 그 조건이라
  분모와 분자가 같은 규칙에서 나온다.

### 갭 2. 목록을 **심사 상태로 못 거른다**

`ApplicationRow`는 `judged_status`를 들고 온다(`ApplicationsView.tsx:54`). 그런데
`Segment` 6개가 **전부 `a.status` 기반**(`:110~115`)이고 `judged_status`는 목록에서
**한 번도 안 쓰인다** — grep 결과 타입 선언 1줄이 전부다.

→ failed 건만 보려면 상세를 하나씩 연다. 500편에서 그건 검토가 아니다.

- 파일 **1** (`ApplicationsView.tsx`) · **~20줄**
- 결정 **1**: 기존 6세그먼트 **옆에 붙이나**, **별도 축**으로 두나.
  ★후자를 권한다 — 대회 상태(selected/rejected)와 심사 상태(completed/failed)는 **직교**다.
  한 줄에 섞으면 "selected이면서 failed"를 표현할 수 없고, 그 조합이 정확히 11/7에 봐야 할
  것이다.

### 갭 3. failed 를 **어떻게 하라는 게 화면에 없다** — ★본체 확인 필요

admin에 재큐/재채점 동작 **0건**(grep `requeue`/`rescore` = 0).
정책상 `judged_status='failed'` → `'rejected'` **자동매핑 금지**
([[project-system-error-not-user-rejection]]). 즉 **하면 안 되는 것은 정해져 있는데 해야 할
것이 화면에 없다.**

★**이 갭은 내가 판정할 수 없다.** 재시도가 채점 레포(워커) 쪽에서 자동으로 도는 것이라면
갭은 "버튼 없음"이 아니라 **"재시도 상태가 안 보임"**이고, 그러면 갭 1·2와 같은 종류
(표시 문제)로 접힌다. **채점 워커에 failed 재시도가 있는지 = 지수 본체 확인 사항.**

- 결정 **1**(본체): 재시도가 자동인가 수동인가.
- 그 답이 나오기 전 파일·줄 산정 **불가**.

## 3. 요약

| 갭 | 파일 | 줄 | 결정 | 소유 |
|---|---|---|---|---|
| 1 분모 없음 | 2 | ~25 | 1 | 레인 A |
| 2 심사 상태 필터 | 1 | ~20 | 1 | 레인 A |
| 3 failed 처리 | ? | ? | 1 | ★본체 선행 |

★**갭 1이 리허설에 직접 걸린다.** 리허설이 검증해야 할 것 중 하나가 "전 편이 채점됐는가"
인데, 지금 화면으로는 **그 질문을 물을 수 없다** — 누락된 편은 통계에서 사라지지 실패로
뜨지 않는다. ⑤E와 같은 계열의 결함이다(보고할 것이 생긴 순간 보고 화면이 없어진다 /
세어야 할 것이 분모에서 빠진다).

착수 순서는 제니2 소관. 판단 안 함.
