# 레인 A 상태 — 2026-08-03 (지수2-A)

어제 것은 `reports/lane_a_state_2026-08-02.md`. 레인 C는 별도(`lane_c_*`).

## 1. 브랜치 / HEAD

| 레포 | 경로 | 브랜치 | HEAD |
|---|---|---|---|
| 앱 | `C:\Users\Tom\oxxovo` | `feat/studio-budget-guard` | **`ed744eb`** |
| 워커 | `C:\Users\Tom\oxxovo-studio` | `main` | `2069b8d` (오늘 변경 없음) |

앱 미커밋 0. 워커는 손대지 않았다.

## 2. 오늘 = 남은 E2E 4종 — 전부 완료, 그리고 ★버그 1건

| 종목 | 결과 | 어디에 |
|---|---|---|
| KAT 불변(양성/음성) | **35/35 PASS** | `e2e/kat-cross-repo.mjs` (`npm run test:kat`) |
| requireFinal 단위 | **6/6 PASS — 이미 있었다** | `lib/cryptobind-v2.test.ts:253~317` (`npm test`에 포함) |
| 시간압축 마감 | **12/12 PASS** | `e2e/deadline-and-sync.mjs` (`npm run test:deadline`) |
| 실패→재렌더 복구 | **20/20 PASS** | `e2e/requeue-recovery.mjs` (`npm run test:requeue`) |
| 동기 경로 회귀 | 위 12/12에 포함 | 같은 파일 |
| (회귀) 변조 하니스 | **18/18 PASS** (어제 14/14 + 플래그 4) | `e2e/tamper-compose.mjs` (`npm run test:tamper`) |
| (회귀) 단위 / 도달성 | **124/124**, **7/7** | `npm test`, `npm run test:reachability` |

### ★오늘의 발견 — 비동기 제출은 파일을 못 싣고 있었다 (수정 완료, `7f22cc0`)

item 4 하니스가 잡았다. 실패한 렌더가 재큐잉되고, 워커가 완성했고, 틱은
`finalized`라고 보고했다. **그런데 참가자 행은 `render_requeued`에 `free_entry_url`
NULL 그대로였다.**

- 원인: `genesis_applications`에 **`updated_at` 컬럼이 없다**. finalize의 게시
  UPDATE 4곳이 전부 `updated_at`을 실어 보냈고, PostgREST는 **모르는 컬럼 하나에
  문장 전체를 거부**한다. 그 error를 **아무도 읽지 않았다**.
- 결과: **모든 비동기 확정 제출**이 렌더 행만 닫고(`submitted` + `finalized_at`,
  그래서 두 번 다시 안 돌아온다) 엔트리는 접수 시점 상태로 남았다.
  `free_entry_url IS NOT NULL`이 채점이 읽는 계약이므로 **그 엔트리는 0점**이고
  **로그는 전부 성공**이다. `finalize_rejected` 플래그 2곳도 같은 이유로 죽어 있었다
  → 변조로 거부된 제출이 운영진에게 기록되지 않았다.
- 수정: 테이블에 있는 컬럼만 쓰고, **게시 결과를 검사**한다. 안 실리면 렌더 행을
  닫지 않고 **defer**(다음 틱 재시도, `remaining`에 남음). `flagEntry()`도 자기 쓰기를
  검사하고 실패하면 크게 로그.
- 왜 여태 못 잡았나: 동기 경로는 엔트리를 **INSERT**하며 URL을 함께 넣는다(그래서
  /studio도 기존 E2E도 멀쩡해 보였다). 상한 테스트는 **틱의 반환값**을 봤다. 변조
  하니스는 "거부됐다"만 봤고 `finalize_rejected` 확인은 **아무 쓰기도 안 일어나서**
  통과하고 있었다(어제 규율 1번 그대로다).

## 3. ⑩ 체크리스트에 오늘 들어간 두 줄

1. **C3 maxDuration** — 대응은 롤백이 아니라 `MAX_FINALIZE_PER_TICK`을 낮추는 것.
   다만 **"배포 없이"는 틀렸다**(커밋 `dff1fd6`): Vercel은 배포 생성 시점에 env를
   묶으므로 **같은 커밋 재배포 ~2분**이 든다. B5에 이미 적혀 있던 규칙과 C3가
   서로 어긋나 있었다.
2. **C4/E** — 비동기로 확정된 **첫 제출은 틱 보고가 아니라 엔트리를 봐라**
   (`free_entry_url` non-null + `studio_submission_state='finalized'`).

## 4. 새 하니스 3개가 쓰는 것들

- `e2e/zz-season.mjs` — **일회용 `zz_` 시즌 픽스처**. 시계를 움직이는 테스트는
  season_0(라이브)도 season_test(`e2e/lib.mjs`의 TK 규칙: 손대지 않는다)도 쓸 수
  없고, season_e2e는 `season_number 9999`라 **최신 시즌이 되어 create-ahead가
  깨어난다**. 그래서 **997번**(현재 최대 1006보다 낮게) + **awards 과거**(그래서
  desiredStatus가 'completed'로 고정 → 시간 틱이 손댈 게 없다). 클립은 실제 ready
  클립을 복제하고 **새 tid로 재서명**한다.
- `e2e/kat-cross-repo.mjs` — DB·네트워크·env 시크릿 없이 두 레포 구현을 나란히 놓고
  같은 입력을 넣는다. 대조군 2개: **arity 체크**(같은 파일 두 번 임포트가 아님을 증명)
  와 **골든 비교기에 니블 하나 뒤집어 넣기**(비교기가 반대할 수 있음을 증명).
- 두 DB 하니스 모두 **전역 스위프 가드**: 자기 픽스처 밖에 접수된 제출이 하나라도
  대기 중이면 `sweepAsyncSubmissions()`를 **거부**한다(노트북에서 남의 제출을
  확정시키지 않는다).

## 4b. 승인 후 추가 작업 (같은 날 오후)

**① `mainRoundDeadlineMs()` 정리 — 삭제 (`1c01d3d`)**
- 호출부 0, 정의는 `start + submission_hours`. 실제 게이트는 `canSubmitMainRound`
  (= `main_round_end_at`)이고 양쪽 제출 경로·로비·리스 경계가 전부 그걸 읽는다.
- **두 정의는 데이터에서 실제로 어긋난다**: season_0/season_1은 일치하지만
  **season_test는 76분 차이**(`main_round_end_at`은 시즌 생성 때 한 번 계산되고
  그 뒤엔 편집 가능하다 — `lib/season-schedule.ts`).
- 그래서 헬퍼를 지우고 **`SeasonStudioConfig.submissionHours`도 제거**했다. 그 필드는
  헬퍼를 먹이려고만 존재했고, 입력을 스튜디오 설정에 남겨두면 거기서 또 마감을
  유도하게 된다.
- **덤으로 같은 형태를 하나 더 잡았다**: 이메일 틱이 "24h/6h 남음" 리마인더 시각을
  `submission_hours`로 **다시 계산**하고 있었다 → `main_round_end_at`을 읽도록
  통일(미설정 시즌만 기존 유도식을 폴백). 마감일이 편집되면 마감이 아닌 시각을
  기준으로 리마인더가 나갔을 것이다.
- tsc 0 / build 0 / 124 units.

**② R2 고아 오브젝트 정리 — 225개 삭제 (`ed744eb`)**

| prefix | 삭제 | 남은 고아 | 살아있는 것(무손상) |
|---|---|---|---|
| `renders/` | **113개 (3707.5 MB)** | **0** | 11개 (220.5 MB) |
| `posters/` | **112개 (21.1 MB)** | **0** | 47개 (6.1 MB) |
| `seasons/` | 0 | 3개 (14.9 MB) — 내 것 아님 | 34개 |
| `images/` | 0 | 2개 (5.9 MB) — 내 것 아님 | 9개 |

- 삭제분은 전부 studio-demo 계정(`dcf59288…`) 소유. **삭제 후 다시 LIST해서 0 확인**.
- 남긴 것: `season_loadtest`(2) + `season_test`의 다른 계정(`c67e76f0…`, 3) — 참가자
  자산 정리는 내 판단으로 하지 않는다. 이름에 id가 없는 손수 만든 포스터 37개
  (mascot/비교샷)는 **파싱 불가로 분류해 손대지 않았다**.
- 스크립트(`npm run r2:orphans`)는 기본 dry-run, `--owner` 화이트리스트 필수,
  **세 테이블 전부 조회**. 이게 중요한 이유는 실측으로 드러났다: render_jobs만 보면
  `--prefix=seasons/`가 **살아있는 참가자 클립 37개를 "고아"라고 불렀다**.

## 5. ★모르는 것 / 남은 것

1. **런타임 `maxDuration`** — 어제와 동일. ⑩ C3 이후에만 알 수 있고, 실패 시 대응은
   상한 낮추고 **재배포**(위 3-1).
2. ~~R2 고아 오브젝트~~ — **오후에 225개 삭제 완료**(4b-②). 남은 5개는 내 것이 아니라
   보고만 했다. 앞으로 하니스를 돌린 날은 `npm run r2:orphans`로 확인하면 된다.
3. ~~`mainRoundDeadlineMs()`~~ — **오후에 삭제 완료**(4b-①). 관련해 남은 관찰:
   **season_test의 `main_round_end_at`이 유도값과 76분 다르다**(리허설 편집 흔적).
   운영 데이터가 아니라 방치해도 되지만, season_0 일정 정정 때 같이 볼 만하다.
4. **season_test 정리** — 오늘 첫 시도에서 마감 테스트를 season_test에 돌렸다가
   `e2e/lib.mjs`의 규칙을 발견하고 `zz_` 픽스처로 갈아탔다. season_test의
   3개 컬럼은 **복원 확인까지 마쳤고**(하니스가 재읽기로 검증) 최종 코드는 season_test를
   건드리지 않는다.
5. **어제 넘긴 대기 3건은 그대로**: ⑩ B5(TK 눈 확인), `model_catalog.cost_per_second_usd`
   CHECK(본부 경유), 로컬 Docker/WSL 결정(④ dissolve 전까지).

## 6. 오늘 규율에 추가된 것

1. **"보고했다 ≠ 처리됐다"의 DB판: 쓰기의 error를 안 읽으면 그 쓰기는 없는 것과 같다.**
   PostgREST는 모르는 컬럼 하나로 문장 전체를 거부하고, 그 실패는 무음이다.
2. **음성 테스트는 그 상태가 실제로 기록되는지까지 봐야 한다.** "거부됐다"는 반환값이고
   "기록됐다"는 행이다. 후자를 안 보면 아무 쓰기도 안 일어나는 버그를 통과시킨다.
3. **하니스는 자기가 어지른 것을 되돌린다.** finalize는 제출자의 남은 클립을
   아카이브한다(정상 동작). 그게 어제 변조 하니스를 거쳐 오늘 도달성 하니스를 2/7로
   떨어뜨렸다. 이제 변조 하니스가 되돌린다.
4. **워커와 경주하는 단언을 쓰지 마라.** "재큐잉 후 status=queued"는 배포 워커가
   느리다는 단언이다. 대신 "failed가 아니다" + "죽은 레인의 claim_token이 아니다".
