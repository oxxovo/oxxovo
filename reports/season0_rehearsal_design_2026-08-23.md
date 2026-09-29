# 시즌0 리허설 설계 — 신청→시상 전 과정 1회 실주행

2026-08-23, 지수(본체). 본부 지시: "고치지 마라. 설계 한 장 먼저." 코드 변경 0건, 전부 조사만.
조사 기반: `lib/studio.ts` `lib/studio-test-access.ts` `lib/membership.ts` `lib/seasons.ts` `lib/watch.ts` `lib/credits.ts`
`lib/email/log.ts` `app/api/apply/route.ts` `app/api/cron/season-tick/route.ts`, `scripts/rehearsal-*.mjs`,
`scripts/zz_probe_membership_gate_2026-08-12.mjs`, `reports/studio_test_access_migration_2026-08-22.sql`,
`reports/community_vote_and_current_season_fix_2026-08-10.sql`, `reports/season0_studio_only_platforms_2026-08-04.sql`.

---

## 0. 실행 전에 반드시 막아야 하는 것 — 되돌리기보다 앞선 문제

되돌리기 계획을 짜기 전에, **애초에 사고가 나지 않게 막는 것**이 먼저다. 조사 중 두 가지 구조적 위험을 찾았다.
둘 다 "리허설이 실수로 실서비스를 덮어쓴다"는 같은 모양이고, 둘 다 **이미 한 번 실제로 일어난 적이 있다.**

### 0-1. `getCurrentSeason()` 하이재킹 — 8/8에 이미 한 번 터졌다

`lib/seasons.ts:417-428`에 본부가 2026-08-10에 남긴 코멘트가 이렇게 말한다:

> STANDING RISK, measured 2026-08-10, not fixed here — ... That fallback has no is_fixture
> filter. ... ANY row (including a rehearsal fixture like season_test) that gets a past
> application_open_at instantly wins the "opened" branch and hijacks the pick — **exactly what
> happened on 2026-08-08** when season_test's leftover open date took over after season_0's own
> open moved to 9/9.

`getCurrentSeason()`은 "`application_open_at`이 과거인 것 중 가장 최근에 열린 시즌"을 고른다(`lib/seasons.ts:429-454`). `is_fixture` 필터가 **없다.** 이 함수 하나가 홈 히어로, `/apply`, `/tournament`, 챗봇 KB, 카운트다운 전부의 "지금 시즌"을 결정한다.

리허설 툴킷(`rehearsal-stage.mjs` `open` 단계)은 `season_test.application_open_at`을 `iso(-2)`(지금 기준 2분 전)로 세팅한다. **이건 "과거 날짜"가 아니라 "지금 이 순간"이므로, 어떤 실제 시즌의 과거 open 날짜보다도 항상 더 최근이다.** 즉 이 필드를 세팅하는 순간 `season_test`가 무조건, 예외 없이 "현재 시즌"을 가로챈다. 8/8 사고는 우연히 남아있던 leftover 날짜 때문이었지만, 이번 리허설은 **의도적으로, 그것도 여러 날(압축된 시계라도 예선 접수 창+본선 창+투표 창까지 이어지는 기간) 동안** 이 상태를 유지해야 한다 — 우연한 사고보다 노출 폭이 크다.

8/8 사고의 처방(`community_vote_and_current_season_fix_2026-08-10.sql`)은 **데이터를 되돌리는 것**(`application_open_at`을 다시 NULL로)이었지, 코드를 고친 게 아니었다. 그 코멘트 자체가 "not fixed here"라고 명시한다. **이 구멍은 지금도 그대로 열려 있다.**

**결론**: `season_test.application_open_at`을 과거로 세팅하는 순간, `www.oxxovo.ai`를 보는 모든 실제 방문자(신청 시도 중인 진짜 사람 포함)에게 시즌0 대신 리허설 시즌(53편 픽스처, 다른 주제, 다른 상금 표시 가능성)이 노출된다. **되돌리기가 아니라 사전 차단이 필요하다.**

- 제안: `getCurrentSeason()`의 "opened" 분기와 "upcoming" 폴백 분기 양쪽에 `is_fixture` 필터를 추가한다 — `season-tick`의 `create-ahead`가 이미 정확히 이 패턴을 쓰고 있다(`app/api/cron/season-tick/route.ts:175-186`, "Fixtures are excluded before latest is picked"). **같은 필터를 `getCurrentSeason()`에도 붙이는 것**이 근본 수정이고, 이번 리허설의 진짜 선결 조건이다. (지금은 설계만 — 구현은 본부 승인 후.)
- 대안(코드 안 고치는 경우): 리허설 동안 홈/`/apply`/챗봇을 별도로 감시하며 즉시 원복할 준비를 해야 하는데, 리허설이 여러 단계(예선 접수→채점→본선→투표→시상)로 이어지는 한 "즉시 원복"이 근본 해결이 못 된다 — 세팅해야 하는 시간 자체가 리스크 노출 구간이다. **권장하지 않음.**

### 0-2. Founding 무료 100석은 시즌 구분이 없는 전역 자원이다

`membership_founding_counter`는 단일 행(`id=1`)이고 `platform_config.membership_founding_free_count`도 전역 값이다 — **season_test에서 청구해도 season_0의 진짜 100석 카운터가 똑같이 줄어든다.** `claimFoundingCreator()`에 season 매개변수가 없다(`scripts/zz_probe_membership_gate_2026-08-12.mjs:105` 참조 — `userId`만 받는다). 이건 원래도 알고 있던 사실이지만("Founding 카운터 원복 = 선례가 있다"는 본부 지시 자체가 이미 이걸 전제한다), 규모가 문제다: 51편+배우자 1명을 전부 신규 Founding 청구로 만들면 **최대 52석**을 일시적으로 소비한다 — 실제 100석 중 절반. §1-2, §3-1에서 이 규모를 줄이는 설계를 제안한다.

### 0-3. `/watch` 공개 갤러리는 시즌 필터가 없다

`app/watch/ArenaWatch.tsx:41`이 `getWatchVideos({ sort })`를 호출한다 — `seasonId` 인자를 안 넘긴다. `lib/watch.ts:265`의 `if (opt.seasonId) q = q.eq('season_id', opt.seasonId)`를 보면 시즌 필터는 **옵션이고 기본은 전 시즌 통합 갤러리**다. 즉 §0-1의 `getCurrentSeason` 문제와 **무관하게**, `season_test`의 항목이 공개 가시 상태(`isRowPublic`, `watch_hidden=false`)에 도달하는 순간 일반 방문자의 `/watch` 피드에 그대로 섞여 나온다.

- 제안: 리허설로 생성하는 `genesis_applications` 행은 **생성 시점부터 `watch_hidden=true`**로 시드한다. 이 컬럼이 정확히 이 용도로 이미 존재한다(`lib/watch.ts:89`, `isRowPublic` 판정에 사용). 채점/진출/투표/시상 파이프라인은 `watch_hidden`을 안 보므로(리허설 확인됨, `rehearsal-lib.mjs` 주석: "워커는 watch_hidden을 읽지 않는다") 이 값은 파이프라인 실주행에 전혀 영향을 안 준다 — 오직 공개 노출만 끈다. [[feedback_watch_data_no_delete]] 원칙상 이것도 TK 승인 항목으로 올린다(§4).

---

## 1. ⛔ 되돌리기 계획 (요청대로 먼저)

전제: §0의 두 가지가 먼저 처리된다는 가정 위에서 아래를 짠다. 처리 안 된 채로 진행하면 "되돌리기"가 의미가 없어지는 규모의 노출이 생긴다(진짜 방문자가 이미 봤다 — 이건 원복이 안 된다).

| # | 대상 | 리허설 중 변화 | 되돌리는 방법 | 선례 |
|---|---|---|---|---|
| 1 | Founding 카운터 | 배우자 1건(+ 51편을 실계정으로 만들 경우 최대 51건 추가, §3-1에서 축소 제안) | `zz_probe_membership_gate_2026-08-12.mjs`와 동일 패턴: 시작 전 `claimed` 값을 읽어두고, 종료 시 그 값으로 되돌림(하드코딩 100 아님) | `scripts/zz_probe_membership_gate_2026-08-12.mjs` (1건 규모로 이미 검증됨) |
| 2 | 배우자 계정의 `profiles` 멤버십 컬럼 | `founding_creator_number`, `tier`, `status`, `source` 등이 실제로 채워짐 | 리허설 전 값으로 UPDATE(카운터만 원복하고 이 계정은 그대로 두면, 배우자가 영구히 "Founding Creator #N"을 달게 된다 — **원복 목록에서 빠지기 가장 쉬운 항목**, 반드시 명시) | 없음(zz_probe는 계정 자체를 삭제해서 이 문제가 안 생겼다 — 배우자는 실계정이라 삭제 불가, 신규 패턴 필요) |
| 3 | TK 계정의 `studio_test_access` grant | 신규 행 1개 | `revoked_at` 세팅(코드에 이미 있음, `revokeStudioTestAccess()`) 또는 애초에 짧은 `expires_at`로 발급 | `lib/studio-test-access.ts:95` |
| 4 | `genesis_applications` (season_test, 53편) | 신규 행 53개 + `scoring_results` 연쇄 | DELETE(season_test는 프로덕션과 격리된 리허설 전용 시즌 — season_0 무접촉 원칙 그대로 유지) | `zz_probe`의 cleanup 블록과 동일 패턴, 규모만 53배 |
| 5 | 51편용 disposable 계정(옵션 A를 쓸 경우) | `auth.users` 신규 51개 | `admin.auth.admin.deleteUser()` → `profiles` cascade | `zz_probe` |
| 6 | 포인트 원장(`credit_transactions`) | TK/배우자가 Studio로 실제 클립 2편을 만들면 fal.ai 실비용이 청구됨(append-only, 잔액은 저장 안 되고 SUM으로 파생 — `lib/credits.ts:3`) | **삭제가 아니라 역분개**: 청구된 금액만큼 반대 부호 행을 추가로 삽입 — 실제로 일어난 지출을 지우는 게 아니라 "리허설 환급"으로 상쇄. 장부에 리허설이었다는 흔적이 남는 게 append-only 철학에 맞다 | 개념적으로 Step8 Part B의 $19.99 환불과 같은 패턴(취소는 반대 이벤트로 남긴다) |
| 7 | R2 오브젝트 | TK/배우자 Studio 렌더 2편(+중간 클립들)의 실제 파일 | **앱에 하드삭제 경로가 없다** — `lib/studio.ts:2000` "deleted_at is SET; the row and its R2 file are NEVER [hard-deleted]"가 명시적 설계. 되돌리려면 R2 콘솔에서 수동 삭제(파일 키는 `render_jobs`/`generation_jobs`에서 뽑음)하거나, "리허설 산출물 2편 분량은 용량상 무해하니 방치"로 정책 결정 — **TK 판단 필요**(§4) | 없음(이 리허설이 처음 이 질문을 만든다) |
| 8 | `email_logs` | 배우자 실계정으로 실제 이메일 5~7통(신청접수/진출통보/본선시작/마감리마인더/결과발표) 발송됨. 51편이 옵션 B(서비스롤 시드)면 email-tick 대상에서 원천 배제 필요 — 아니면 존재하지 않는 주소로 발송 시도/실패가 쌓임 | 로그 자체는 감사기록으로 남겨도 무해(문제는 로그가 아니라 **오발송** 그 자체) — 51편은 `zz_probe`처럼 `@oxxovo-probe.invalid` 같은 존재하지 않는 도메인으로 만들어 실발송을 원천 차단하는 걸 권장 | `zz_probe`의 이메일 네이밍 컨벤션 |
| 9 | `watch_hidden` 플래그 해제 여부 | 리허설 종료 후에도 season_test 데이터를 잠깐 남겨 결과 리뷰가 필요할 수 있음 | 항목 4(행 삭제)가 실행되면 자동 해소 — 삭제 전까지는 `watch_hidden=true` 유지 | — |
| 10 | `season_test` 자체 날짜 | `application_open_at` 등이 "지금"으로 세팅됨 | `community_vote_and_current_season_fix_2026-08-10.sql` WRITE B와 동일하게 `application_open_at`을 다시 NULL로. **다음 리허설을 위해 툴킷을 재사용 가능한 상태로 되돌리는 것** — §0-1이 코드로 고쳐지면 이 단계의 긴급성은 낮아지지만 위생상 여전히 필요 | 동 SQL |

### 10/14 데드라인의 근거

본부가 지정한 "10/14 전 원복"은 season_0의 예선 마감(`application_close_at`)에서 역산한 안전 마진으로 보인다. 다만 이 값 자체가 최근 기록 사이에서 어긋난다 — 2026-08-05 실측 기록(`project_season0_schedule_stale`)은 `11/4`, 2026-08-10 SQL 코멘트(`community_vote_and_current_season_fix`)는 "season_0 open이 8/8에 9/9로 바뀌었다"고 말한다. **둘 다 리허설 실행 시점에 재조회 없이 신뢰하면 안 된다** — 리허설 착수 직전 `season_0.application_open_at`/`application_close_at`을 읽기 전용 쿼리로 재확인하는 것이 §2 이전에 필요한 첫 실측이다([[feedback_stale_record_as_gate]]). 워커의 season-blind 버그(`pickPending`이 `season_id` 필터 없이 후보를 집는다, `project_launch_rehearsal` 메모) 때문에, season_0가 실제로 마감돼서 채점 대상이 되는 시점보다 **한참 먼저** season_test의 리허설 데이터가 전부 정리돼 있어야 한다 — 두 시즌의 "채점 대기" 창이 겹치면 워커가 season_test 설정(다른 주제, 다른 마감)으로 season_0의 진짜 제출작을 잘못 채점할 위험이 생긴다.

---

## 2. 검증 못 하는 것 (요청대로 먼저)

1. **53편으로는 500편 부하가 안 드러난다.** (본부 지적 그대로) — 워커 처리량, 배치 사이즈, `BATCH_SIZE=30` 게이트, 시상 시점 병목 등은 이번 리허설로 확인 안 됨. 500편 실측은 `project_scoring_500_throughput` 기록이 이미 별도로 있다(2026-08 시점 10.6h/500편) — 이번 리허설의 목적이 아니다.

2. **101번째 유료($19.99) 경로 — 여는 방법 제안.** Founding 100석과 무관하게, `platform_config.membership_founding_free_count`를 리허설이 아닌 **별도의 짧은 프로브**로 "현재 claimed 값"과 똑같이 낮춰서(즉 "마감" 상태로 위장) 신규 테스트 이메일 계정으로 실제 $19.99를 라이브 Stripe로 결제 → webhook 200 확인 → 즉시 구독취소+환불 → cap 원복. **이건 이미 한 번 안전하게 검증된 패턴이다**(멤버십 Step8 Part B, 2026-06-20). 53편 리허설과 별도 트랙으로 분리해서 실행하는 걸 권장 — 53편 파이프라인 리허설과 결제 경로 테스트를 같은 창에서 동시에 돌리면 실패 시 원인 분리가 어려워진다.

3. **#63 결제 실패는 더 어렵다.** 라이브 Stripe 키에는 "일부러 거절되는 테스트 카드"가 없다(테스트 카드는 테스트 모드 전용). 실제로 거절되는 카드를 구해서 정말 돈이 안 나가게 하는 건 재현성이 없고 위험하다. **대안 제안**: `invoice.payment_failed` 이벤트 모양을 손으로 구성해서 실제 `STRIPE_MEMBERSHIP_WEBHOOK_SECRET`으로 서명한 뒤 라이브 webhook 엔드포인트에 직접 POST — 카드 실패 자체가 아니라 **웹훅 핸들러의 반응(프로필 강등, 알림 발송 여부)만** 분리해서 검증하는 방식이다. 대상 customer/subscription은 §2의 101번째 테스트에서 만든 disposable 테스트 계정을 재사용하면 실사용자 데이터를 안 건드린다. 이것도 53편 리허설 범위 밖의 별도 작업으로 제안.

4. **화장품 CF 본선 채점은 미검증.** (본부 지적 그대로) 리허설 본선 주제를 season_0과 다르게 새로 만들기 때문에, 실제 화장품 CF 브리프에 대한 AI 채점 루브릭의 정합성은 이번 리허설로 안 나온다.

5. **`studio_test_access`가 정확히 무엇을 우회하는지 — 코드 확인 결과, TK 계정으로는 이 질문에 답이 안 나온다.** `checkStudioAccess()`(`lib/studio.ts:255-285`)는 Studio **화면 진입**만 게이트한다 — admin 우회 → test_access 우회 → (일반은) 등록행+활성 크리에이터 AND. 하지만 실제 **제출/생성 mint 시점**(`registerForSeason` 5a, `submitGeneration` 5a, `submitRender` 7a — `lib/studio.ts:1249,1467,2324`)은 전부 `checkApplyGate()`를 **무조건** 호출한다. 이 함수는 `test_access`를 전혀 모른다. 즉 **test_access는 "화면에 들어가는 것"만 봐주지, "실제로 제출이 성사되는 것"은 여전히 진짜 멤버십에 달려 있다.** TK는 이미 실제 Founding Creator #1(2026-06 GO-LIVE 실계정)이라, 이번에 TK 경로가 성공해도 그게 test_access 덕분인지 TK의 진짜 멤버십 덕분인지 이번 리허설만으로는 구분이 안 된다. 진짜 격리 검증을 하려면 **멤버십이 전혀 없는 계정**에 test_access만 부여해서 "화면엔 들어가지만 제출 단계에서 `membership_required`로 막히는" 것까지 확인해야 "test_access = 화면 접근만 우회"라는 설계 의도가 실증된다 — 이걸 이번 53편 범위에 넣을지는 §4 오픈 퀘스천.

6. **본선 진출은 AI 채점이 정하므로, TK/배우자가 반드시 그 안에 든다는 보장이 없다.** 53편 중 상위 10명(`clamp(round(53×0.10), 10, 50) = 10`)만 본선에 간다. TK·배우자의 수제 영상이 10위 안에 못 들면, "실제 계정이 Studio로 **본선** 영상까지 만드는" 부분은 이번 리허설로 검증되지 않는다 — 예선(등록→멤버십→Studio→제출)까지만 실사람 경로로 확인되고, 본선~시상은 파이프라인/데이터 레벨로만 확인된다. §4에서 TK 확인 필요.

---

## 3. 설계

### 3-1. 출품 53편 구성

| 구성 | 편수 | 경로 | Founding 소비 |
|---|---|---|---|
| TK | 1 | `studio_test_access` (Studio 실제 생성) | 0 (이미 Founding #1) |
| 배우자 | 1 | 등록 → Founding 청구 → Studio 열림 → 실제 제출 (한 줄) | 1 |
| 제니3 영상 | 51 | 외부 URL 투입 | **권장: 0** (아래 옵션 참조) |

**51편 시딩 방법 — 두 옵션, B를 권장:**

- **옵션 A (실계정 51개, 등록/멤버십 게이트까지 매번 실주행)**: `zz_probe` 패턴을 51배로 반복 — 계정 생성 → `claimFoundingCreator` → `registerForSeason`. Founding 카운터를 **최대 52석**(배우자 포함) 일시 소비. 원복 부담이 크고, "등록 UX가 작동하는가"라는 질문은 이미 배우자 1건으로 답이 나오므로 51번 반복해서 얻는 정보가 적다.
- **옵션 B (서비스롤 직접 시드, 기존 리허설 픽스처와 동일 패턴)**: `genesis_applications`에 직접 INSERT(멤버십 우회). Founding 카운터 영향 0. 채점/진출 계산(53명 모수, advance 10명)/워커 처리량 체감/이메일 대량발송/투표/시상 파이프라인은 옵션 A와 **동일하게** 실주행 검증된다 — 안 나오는 것은 "51명이 각자 실제로 가입하는 UX"뿐인데, 이건 애초에 이번 리허설의 검증 목표가 아니다(그건 배우자 1건이 이미 대표한다).
- **권장: 옵션 B.** Founding 원복 부담을 배우자 1건으로 줄여준다 — §1의 되돌리기 계획과 직접 맞물린다.

53 ≥ `min_participants`(50) → 연기(defer) 안 걸림. `advance = clamp(round(53×0.10)=5, 10, 50) = 10`명 본선 진출 — 최소치(10)에 클램프되는 경계 케이스라, `advance_season_finalists` RPC의 클램프 로직이 실제로 발동하는 걸 확인할 좋은 규모다.

### 3-2. 계정 2개 경로 — 정확한 게이트 순서 비교

| 단계 | TK (`studio_test_access`) | 배우자 (실경로) |
|---|---|---|
| 등록(`genesis_applications` 행) | 필요 (mint은 test_access와 무관하게 일어남) | `/apply` MembershipGateScreen 통과 후 |
| 멤버십 | **이미 보유**(Founding #1, 실서비스, 리허설에서 신규 소비 없음) | 신규 Founding 청구 (카운터 +1) |
| Studio **화면** 진입(`checkStudioAccess`) | test_access grant로 우회 | 정상 게이트(등록행 + 활성 크리에이터 AND) 통과 |
| 실제 제출 mint(`checkApplyGate`) | **TK의 진짜 멤버십**으로 통과 — test_access와 무관 | 방금 청구한 Founding으로 통과 |

**부수 검증 결론(코드 레벨, §2-5에서 상술)**: "같은 화면·같은 캡·같은 제출 결과"라는 본부의 비교 기준 중 **제출 결과(캡 판정)는 두 경로가 정말로 같은 함수(`checkApplyGate`)로 수렴**하도록 설계돼 있다 — 이건 이번 리허설 전에 이미 코드로 확인됨. 다만 TK가 이미 실멤버십을 갖고 있어서, "test_access가 멤버십 없는 사람도 제출까지 보내주는가"는 이번 조합으로는 증명이 안 된다(§2-5, §4).

### 3-3. 시즌 구성

- **`season_test` 재사용** — 기존 리허설 이력(`rehearsal-lib.mjs`, 7월 런북)과 연속성 유지, 신규 시즌 안 만듦.
- `allowed_video_platforms`: `['studio','youtube','vimeo','instagram','tiktok']` — season_0의 `['studio']` 전용과 다르게 studio+외부 둘 다 열어야 한다는 본부 지시 그대로 반영. (옵션 B로 51편을 서비스롤 시드하면 `/api/apply`의 `validateVideoUrl` 검증 자체는 이 컬럼을 안 타지만, 배우자가 추가로 외부 URL 경로를 실제로 한 번 태워볼 수 있게 값은 그대로 열어둠.)
- `main_round_theme`: season_0("화장품 CF")과 다른 신규 문구 — **TK 확정 필요**(§4).
- `min_participants` / `advance_pct` / `advance_min` / `advance_max`: season_0과 **동일 값 유지** 권장 — 정책 자체를 검증하는 게 목적이므로 값을 바꾸면 검증 의미가 옅어짐. 현재 season_test에 세팅된 값 재확인 필요.
- `studio_round`: `'both'`(예선+본선 둘 다 Studio 가능) — season_0과 동일 필요.

### 3-4. 시계 압축 제안

기존 `scripts/rehearsal-stage.mjs`의 8단계(`open → close → buffer-done → advance → main-open → main-close → vote → awards`)를 그대로 재사용 제안 — **진짜 `season-tick` cron을 실제로 ping**하는 방식이라(`pingCron()`, `rehearsal-lib.mjs:22`) 상태기계를 흉내가 아니라 실행한다는 게 이 툴킷의 핵심 가치이고, 새로 만들 이유가 없다.

추가/변경 제안:
- **`open` 단계 실행 직전 필수 게이트**: §0-1(`getCurrentSeason` is_fixture 필터)이 배포됐는지 확인. 안 됐으면 `open` 단계를 실행하지 않는다.
- **`open` 직후 즉시 검증**: `getCurrentSeason()`이 여전히 `season_0`(또는 실제 운영 시즌)을 가리키는지 별도 스크립트로 즉시 확인 — 벗어나면 그 자리에서 `application_open_at`을 도로 NULL로 되돌리고 중단.
- **`REHEARSAL_WINDOW` 확장**: 기존 기본값(10분)은 순수 자동화 리허설(사람 개입 없음)용으로 설계된 값이다. 이번엔 TK·배우자가 실제로 Studio에서 클립을 만드는 시간이 필요하므로, 예선 접수창(`open`)과 본선 제출창(`main-open`)은 최소 30~60분으로 넉넉히 잡을 것을 제안.
- **채점 워커 트리거 시점마다 재확인**: `buffer-done` 이후 예선 워커를 수동 실행하기 직전, `main-close` 이후 본선 워커를 수동 실행하기 직전 — 매번 season_0의 실제 마감 상태를 다시 조회해서 워커의 season-blind `pickPending`이 실제 season_0 제출작과 겹치지 않는지 확인하는 절차를 명시적으로 추가.
- **본선 도달 불확실성 대응**(§2-6): TK/배우자가 자연 진출을 못 하면, 기존 `rehearsal-submit-main.mjs`(서비스롤 대입)로 실제 상위 10명에게 본선영상을 부여해 이후 단계(투표/시상)는 계속 실주행 검증 — 다만 이건 "본선까지 실제 사람이 Studio로 만든다"는 검증과는 다르다는 걸 결과 보고에 명시해야 함(§4).

---

## 4. TK 확인 필요 (오픈 퀘스천)

1. **`getCurrentSeason()` is_fixture 필터** — 리허설 전에 코드로 먼저 고칠지, 다른 격리 방법을 쓸지? (§0-1, 강력 권장: 먼저 고침)
2. **51편 시딩 방법** — 옵션 A(실계정+Founding 51개) vs 옵션 B(서비스롤 시드, 권장)?
3. **본선 단계까지 실사람이 Studio로 직접 만들어야 하는가**, 아니면 예선(등록→멤버십→Studio→제출)까지만 실사람 검증하고 본선~시상은 파이프라인만 검증하면 충분한가? 후자라면 TK/배우자가 자연 진출 못 해도 무방.
4. **R2 오브젝트 처분** — 앱에 하드삭제 경로가 없다(§1-7). 수동 콘솔 삭제 vs 리허설 산출물 소량(2편)이라 방치 중 정책은?
5. **101번째 유료경로 + #63 결제실패**를 이번 53편 리허설과 같은 창에서 같이 돌릴지, 별도 세션으로 분리할지(§2-2, §2-3, 분리 권장)?
6. **`main_round_theme` 실제 문구** — 화장품 CF와 다른 신규 주제, 카피 확정?
7. **`watch_hidden=true` 시딩**에 대한 승인(§0-3, [[feedback_watch_data_no_delete]] 원칙상 명시적 확인 필요)?
8. **season_0의 실제 `application_close_at`을 리허설 착수 직전 재확인**하고, 그 날짜 기준으로 10/14 마진이 여전히 안전한지 재계산할 것 — 기존 기록 두 개(11/4 vs 9/9-open 함의)가 서로 어긋난다(§1 말미).
9. **실행 창(대표님이 실제로 Studio를 조작할 시간대)** — 언제로 잡을지?

---

관련: [[project-jisoo-resume-2026-08-22]] [[feedback-stale-record-as-gate]] [[feedback-watch-data-no-delete]]
