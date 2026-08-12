# seasons 타임스탬프 컬럼 전수 -- 연기 시 이동 여부 (2026-08-12)

`seasons` 테이블 라이브 컬럼 86개를 직접 조회(season_0, service role)해서
얻은 실제 목록. 이름 패턴이 아니라 **실제 타입이 timestamptz인 14개
컬럼** 전수. `defer_season_schedule`이 옮기는 대상은 이 중 9개뿐이어야
한다 -- 나머지 5개는 옮기면 안 되는 이유가 각각 다르다.

| 컬럼 | 연기 시 이동? | 근거 |
|---|---|---|
| `application_open_at` | **아니오** | 함수가 실행되는 시점은 항상 `now() >= application_close_at`이고 `open < close`이므로, 이 함수가 도는 순간 이미 지나간 과거다. 이미 일어난 일(창이 실제로 언제 열렸는가)을 미래로 미는 건 역사를 고쳐 쓰는 것 -- 옮길 대상이 아니라 고정된 사실이다. |
| `application_close_at` | **예** | 연기의 본체. 이걸 미루는 게 이 함수의 존재 이유. |
| `scoring_start_at` | **예** | 마감 이후 일정, 마감이 밀리면 같이 밀려야 앞뒤가 안 꼬인다. |
| `scoring_complete_at` | **예** | 위와 동일. |
| `main_round_start_at` | **예** | 위와 동일. |
| `main_round_end_at` | **예** | 위와 동일. |
| `prelim_results_announcement_at` | **예 -- 지금 빠져 있음(본부 지적, 수정)** | 실측값 `2026-11-08 20:00`, `scoring_complete_at`(11/8 08:00)과 `main_round_start_at`(11/9 08:00) 사이 -- 이름 그대로 예선 결과 발표 시점이라 마감 이후 캐스케이드에 속한다. `community_vote_*`와 정확히 같은 형태의 결함(RPC 작성 이후 추가된 컬럼)이라 같이 고친다. |
| `community_vote_start_at` | **예 -- 직전 STEP 3 초안에서 이미 추가함** | 본선 이후 일정, 마감이 밀리면 같이 밀려야 한다. |
| `community_vote_end_at` | **예 -- 위와 동일** | 위와 동일. |
| `awards_announcement_at` | **예** | 캐스케이드의 마지막 단계. |
| `created_at` | **아니오** | 이 행이 DB에 실제로 INSERT된 시각(감사 기록). 연기는 일정을 미루는 것이지 "이 시즌이 언제 만들어졌는가"를 다시 쓰는 게 아니다. |
| `updated_at` | **아니오(단, 이 함수가 직접 `now()`로 찍는다)** | "옮기는" 대상이 아니라 이 UPDATE 자체의 수정시각 도장 -- 이미 함수 본문에 `updated_at = now()`로 처리 중, 별도 판단 불필요. |
| `prelim_released_at` | **아니오** | 예선 홀드가 실제로 풀린 시각(사건 기록, 목표일 아님). season-tick 순서상(연기 -> 예선홀드해제 -> 상태전환) 연기가 발동하는 바로 그 틱에는 아직 null이고, **연기와 해제는 같은 마감에 대해 상호배타적** -- 해제가 이미 났다면 그 시점 활성인원이 min_participants 이상이었다는 뜻이라 애초에 연기가 안 난다. 그러니 이 함수가 실행될 때 이 컬럼은 구조적으로 항상 null이다(다르면 그 자체가 다른 버그의 신호). |
| `prize_pool_escrow_paid_at` | **아니오** | 실제로 돈이 입금된 시각(사건 기록). 시즌 일정이 밀린다고 이미 들어온 돈이 다시 들어오는 게 아니다. season_0은 지금 `entry_fee=0`이라 애초에 null(무관), 하지만 컬럼 자체의 성격은 시즌이 바뀌어도 동일. |

**9개 이동 / 5개 고정.** STEP 3 SQL을 이 표대로 갱신(§ 채팅 STEP 3
재전송 예정) -- `prelim_results_announcement_at`을 이동 목록에 추가한 것
외에는 이전 초안과 동일.

## 함수 안에 박아둘 경고 주석 (본부 지시)

```
-- ***IF YOU ADD A NEW seasons TIMESTAMP COLUMN, DECIDE HERE TOO.***
-- This function's shift list is a manually maintained subset of every
-- timestamptz column on seasons (audit: reports/season_defer_timestamp_
-- audit_2026-08-12.md). Two columns have already been missed once each by
-- being added to the schema after this function was last touched
-- (community_vote_start_at/end_at, prelim_results_announcement_at) --
-- both bugs looked identical: nothing broke until a defer actually fired,
-- then a downstream date sat stranded relative to everything else. A new
-- date column does NOT get shifted by being added to the table -- it has
-- to be added to the UPDATE below, on purpose, after answering "does this
-- move when the season slips a week" the way the audit doc does per
-- column.
```

## registration_close_at (다음 착수 ②) -- 같은 자리

`registration_close_at`을 추가하는 순간 이 함수도 같이 고쳐야 한다 --
그 컬럼은 `application_close_at`보다 앞서는 날짜라 정의상 이동 대상(마감
캐스케이드의 일부). `reports/backlog_honcho.md`에 한 줄 등록(아래 참조).

## below_floor 집행 -- 미정, 본부 지시대로 내가 정하지 않음

★실측 확인(본부 지적, 맞다): **`below_floor`가 지금 막는 건 두 가지뿐이다
-- season-tick의 상태전환(active->closed 안 됨)과 예선홀드 자동공개.**
`scoring_start_at`/`scoring_complete_at`/`main_round_start_at` 등은
연기가 **일어나지 않았으므로**(below_floor는 `deferred=false`) 원래
날짜 그대로 남고, season-tick의 다른 단계들(advancement 등은
`scoring_complete_at` 도달만 보고 `season.status`를 안 봄)이 그 날짜에
맞춰 계속 돈다. **즉 "성립 안 함"이 실제로는 아무것도 멈추지 않는다** --
상태 필드 하나가 'active'에 걸려 있을 뿐, 채점·본선·시상까지 전부 원래
일정대로 진행된다.

이걸 "성립 안 함"이 실제로 뭘 뜻하는지(완전 정지+수동 재개 / 그래도
진행+숫자만 경고 / 별도 취소·환불 절차)는 **비즈니스 판정이라 내가
정하지 않는다.** 결정되면 season-tick의 advancement/scoring 단계에도
같은 홀드를 배선해야 한다 -- 지금은 안 돼 있음, 설계에 "미정"으로 남긴다.

관련: [[project_application_deadline_split_design_2026-08-12]]
