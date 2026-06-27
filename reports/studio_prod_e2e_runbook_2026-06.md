# OXXOVO Studio (Session 6) — 프로덕션 E2E 런북 (스위치 ON 시나리오)

작성 2026-06-09 · 대상 브랜치 `feat/studio` (PR #7) · 동반 워커 `oxxovo/oxxovo-studio` (Railway)

> **개정 2026-06-26 (지수2):** ① 도메인 전부 canonical **www.oxxovo.ai**로 교정(.com 308 함정 제거)
> ② 본선 = **compose** 모델 반영(Stage 3 다중 클립 / **Stage 3b compose 렌더** / Stage 4 submitRender)
> ③ 마이그 8~11(compose 3 + 2단계 제거) 추가 ④ 시즌0 길이 = compose **30s / 10클립**으로 교정.
> 실행/스위치 조작 없음 — 문서 패치만. 풀런은 일정 승인 + 선행조건(워커 Railway 배포·whsec·CRYPTOBIND 지문) 후.

> 이 문서는 **런칭일에 `session6_enabled`를 켜는 순간**의 절차서다. 헤드리스 결제 E2E
> (코드 경로)는 이미 통과했고(2026-06-08), 여기서는 **실제 프로드 인프라(fal.ai 실호출 →
> R2 → 채점 큐 + 실 Stripe 웹훅)**를 카나리 순서로 켜고 각 단계를 검증·롤백하는 법을 다룬다.
>
> 핵심 원칙 3가지:
> 1. **스위치는 즉시 반영** — `platform_config` UPDATE만으로 켜지고, 재배포 불필요(서버가 매
>    요청마다 fresh read). 즉 **롤백도 즉시**(value='false').
> 2. **카나리 순서** — 한 번에 하나씩 켜고 검증한다. session6 → (프로모 크레딧으로) 생성/제출
>    → 그 다음에야 결제(`studio_purchase_enabled`). 결제를 마지막에 켜면 생성/제출은 Stripe
>    없이도 검증된다.
> 3. **비용 통제** — 첫 실생성은 budget 티어 + 최소 길이로. 워커 일일 캡(`studio_daily_generation_cap`)
>    을 낮게 두고, fal 대시보드 지출을 눈으로 확인하며 올린다.

---

## 0. 범위

- **In scope:** Studio **compose** 본선 흐름(클립 N개 생성 → createRender → render_jobs 렌더 →
  submitRender) + 크레딧 결제의 프로드 ON 시나리오. 본선 제출 = 단일클립이 아니라 **완성본(render)**.
- **Out of scope (지금 보류):** 실카드 결제 흐름(Stripe CLI / 라이브 키 전환) — 라이브 전환 때
  별도 진행. 이 런북은 **test 모드 Stripe 키 + 실 dashboard 웹훅**까지를 다룬다.
- member-hosted(파트너) ON은 동일 패턴이라 **부록 A**에 요약.

---

## 1. 사전 점검 (Pre-flight) — 스위치 OFF 상태에서 전부 GREEN

> 아래가 전부 green이 되기 전에는 **어떤 스위치도 켜지 않는다.** 이 단계에서 session6_enabled,
> studio_purchase_enabled는 모두 `false`(또는 부재)여야 한다 → `/studio`는 404, 결제는 막힘.

### 1.1 DB 마이그레이션 (프로드 Supabase, 순서대로)

| # | 파일 | 내용 |
|---|---|---|
| 1 | `studio_phase1_migration_2026-06.sql` | model_catalog / generation_jobs / credit_transactions + studio_* config |
| 2 | `studio_phase3_migration_2026-06.sql` | genesis_applications studio_* + seasons studio_round/cap, season_0='both' |
| 3 | `studio_phase4_migration_2026-06.sql` | free_entry_url nullable + Veo 3.1 3티어 행 |
| 4 | `studio_season0_length_8s_2026-06.sql` | 시즌 0 **per-clip** 길이 4~8s (단일클립 시대 — compose에서 최종길이는 #8이 덮어씀) |
| 5 | `studio_session6_switch_2026-06.sql` | session6_enabled=false (마스터 스위치 등록) |
| 6 | `studio_stripe_2026-06.sql` | credit_transactions.stripe_session_id + unique index + 구매 config |
| 7 | `studio_content_bind_2026-06.sql` | cryptobind_content_hash/_signature (S-6) |
| 8 | `studio_compose_phase1_migration_2026-06.sql` | **render_jobs** 테이블 + genesis_applications `studio_application_render_id`/`studio_main_render_id` + seasons compose 파라미터(`studio_compose_enabled`/`_max_seconds`/`_max_clips`). 시즌0 = compose ON, **최종 30s / 10클립** |
| 9 | `studio_compose_min_seconds_migration_2026-06.sql` | seasons `studio_compose_min_seconds` (compose 하한, createRender/submitRender의 `too_short` 검증) |
| 10 | `studio_model_catalog_tiers_migration_2026-06.sql` | model_catalog 티어/모델 튜닝 (전모델 평등 사용) |
| 11 | `two_stage_final_removal_migration_2026-06.sql` | **2단계 전환** — 결승 라운드 제거(seasons/genesis_applications/seasons_public `final_*` DROP). `cryptobind_final_*`(완성본 해시)는 보존 |

> 8~11은 본 런북(6/09 단일클립 시대) 작성 이후 추가·라이브 적용됨. **본선 = compose 모델**이므로
> 8·9는 본선 E2E의 필수 선행. 11은 라운드를 예선→본선 2단계로 확정(결승 없음).

검증(한 번에):
```sql
-- 스위치 + 구매 config가 전부 OFF/존재하는지
SELECT key, value FROM public.platform_config
WHERE key IN ('session6_enabled','studio_purchase_enabled','studio_credit_pack_usd',
              'studio_credit_usd_value','studio_margin_rate','studio_daily_generation_cap')
ORDER BY key;
-- 3티어가 active로 존재하는지
SELECT id, tier, fal_model_id, cost_per_second_usd, max_duration_seconds, active
FROM public.model_catalog ORDER BY cost_per_second_usd;
-- S-6 컬럼 존재
SELECT column_name FROM information_schema.columns
WHERE table_name='generation_jobs'
  AND column_name IN ('cryptobind_content_hash','cryptobind_content_signature');
-- compose: render_jobs 존재 + 시즌0 compose 파라미터
SELECT to_regclass('public.render_jobs') AS render_jobs_table;
SELECT id, studio_compose_enabled, studio_compose_min_seconds,
       studio_compose_max_seconds, studio_compose_max_clips
FROM public.seasons WHERE id='season_0';
-- 2단계 확정: final_* 컬럼이 DROP 됐는지 (0행이어야 함)
SELECT column_name FROM information_schema.columns
WHERE table_name='seasons' AND column_name LIKE 'final_%';
```
기대: session6_enabled=false, studio_purchase_enabled=false, S-6 컬럼 2행. **compose**: `render_jobs`
존재, 시즌0 `studio_compose_enabled=true` · min/max = **15 / 30s** · `max_clips=10`. **2단계**: seasons에
`final_*` 컬럼 0행(제거됨). model_catalog는 active 티어 행 존재(per-clip 길이는 모델 native enum, 최종
길이는 시즌 compose cap 30s로 통제 — 둘을 혼동하지 말 것).

### 1.2 환경변수

**Vercel (메인 앱):**
```
STRIPE_SECRET_KEY            sk_test_...            (라이브 전환 시 sk_live_로 교체)
STRIPE_WEBHOOK_SECRET        whsec_...             (1.4에서 dashboard 웹훅 등록 후 획득)
STUDIO_CRYPTOBIND_SECRET     <64-hex>              (워커와 BYTE 단위 동일해야 함)
APP_URL                      https://www.oxxovo.ai (canonical .ai -- .com은 308이라 결제 redirect/webhook 깨짐)
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY
```

**Railway (워커, `oxxovo-studio`):**
```
FAL_KEY                      <fal>
R2_*                         (endpoint / bucket / access key / secret / public base)
SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
STUDIO_CRYPTOBIND_SECRET     <메인 앱과 동일 값>
STUDIO_DEV_MODE              false    *** 프로드 필수 ***
POLL_INTERVAL_MS             5000 (기본)
```

**CRYPTOBIND 일치 검증 (값 노출 없이):** 양쪽 시크릿의 SHA-256 지문만 비교한다.
```bash
# 메인 앱 측 (.env.local 또는 Vercel pull 후)
node -e "console.log(require('crypto').createHash('sha256').update(process.env.STUDIO_CRYPTOBIND_SECRET).digest('hex'))"
# 워커 측 (Railway shell)에서 동일 명령 → 두 해시가 일치해야 함
```
> 불일치 시 제출 단계에서 모든 CryptoBind 검증이 `signature_mismatch`로 실패한다. 런칭 전 필수.

### 1.3 Railway 워커 가동

- 워커가 polling 로그를 찍고 있어야 한다. `STUDIO_DEV_MODE=false` 재확인(true면 무조건 최저가
  모델·최소 길이로 강제 생성됨 → 프로드에서 사용자 선택 무시되는 버그).
- 일일 캡 초기값을 낮게: 런칭 첫날엔 `studio_daily_generation_cap`을 예컨대 20으로 두고
  fal 지출을 보며 상향. (배포 가이드: `reports/railway_deploy_guide_oxxovo_studio.md`)

### 1.4 Stripe — dashboard 웹훅 등록 (test 모드)

1. dashboard.stripe.com → **테스트 모드 ON** 확인
2. Developers → Webhooks → **+ Add endpoint**
3. URL: `https://www.oxxovo.ai/api/studio/stripe-webhook`
   - ⚠️ **canonical 도메인(www.oxxovo.ai) 필수.** `oxxovo.com`은 308 리다이렉트라 Stripe가
     웹훅을 보내면 전송 실패 → 적립 silent fail. 멤버십 웹훅과 동일 함정([[reference-canonical-domain]]).
4. Events: **`checkout.session.completed`** 하나만
5. **Signing secret → Reveal** → `whsec_...` → Vercel `STRIPE_WEBHOOK_SECRET`에 입력 → **재배포**
   (env 변경은 재배포해야 반영)

### 1.5 platform_config 값 점검

```sql
SELECT key, value FROM public.platform_config WHERE key LIKE 'studio_%' ORDER BY key;
```
기대 예시: margin_rate=0.40, credit_usd_value=0.10, credit_pack_usd='10,25,50',
daily_generation_cap=20, max_generations_per_round(시즌별 seasons 컬럼) <= 10.

### 1.6 cron 등록 확인 (Vercel)

`vercel.json` crons 배열에 등록된 항목이 **Vercel 배포 로그 / Settings → Cron Jobs**에 그대로
보이는지 교차 확인(누락 시 silent fail). 현재 단계에서 최소 `email-tick`. (season-tick은 #2,
partner-stats는 #3 머지 후 추가 — [[project-pr7-pr3-crossreview]] M-5 참고.)

---

## 2. 스위치 ON 시퀀스 (카나리)

> 각 Stage는 **직전 Stage가 PASS여야** 진행. FAIL이면 즉시 **롤백(4장)** 후 원인 수정.

### Stage 0 — OFF 재확인 (켜기 직전 베이스라인)
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://www.oxxovo.ai/studio      # 기대 404
```
- `/apply` 접속 → 기존 외부 URL 신청 폼(스튜디오 퍼널 아님)인지 확인.

### Stage 1 — session6 ON
```sql
UPDATE public.platform_config SET value='true' WHERE key='session6_enabled';
```
검증:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://www.oxxovo.ai/studio      # 기대 200
```
- 로그인 후 `/studio` 진입 → 모델 3티어, 잔액 0, 라운드 라벨(시즌 0='both'면 일정 기준 서버가
  application/main 판정) 표시 확인.
- `/apply` → 로그인 + 안내 후 `/studio`로 유도되는 **퍼널**로 바뀌었는지 확인.

### Stage 2 — 프로모 크레딧 지급 (Stripe 없이 생성/제출 검증용)
- `/admin/credits`에서 테스트 계정에 프로모 크레딧 지급(사유 필수 — 감사 기록). 예: budget
  생성 1~2회 분량.
- 검증: `/studio` 잔액에 반영, `credit_transactions`에 type=`admin_adjust` + actor_id + reason
  행 1건.

### Stage 3 — 클립 생성 E2E (실 fal 호출, 최소 비용) — compose 소스 확보
- `/studio`에서 **budget(ltx) 티어 + 최소 길이**로 **클립 2~3건** 생성(compose는 다중 소스가
  필요하므로 1건이 아니라 여러 건). DEV_MODE=false라 고른 티어/길이가 그대로 쓰임.
- 각 클립의 6-state 진행을 관찰:
```sql
SELECT id, status, tier, duration_seconds, fal_request_id, r2_key,
       actual_cost_usd, worker_started_at, worker_finished_at, error_message
FROM public.generation_jobs ORDER BY created_at DESC LIMIT 5;
```
  기대 전이: queued -> generating -> uploading -> **ready**. `video_url`(R2 public), `r2_key`,
  `actual_cost_usd` 채워짐. **S-6**: `cryptobind_content_hash` + `_signature`도 ready 시 기록(= v1c).
- Railway 워커 로그에 `[job ...] READY (cost ~$...)` 확인. fal 대시보드 지출 ≈ 예상치.
- R2 버킷에 객체 생성 확인.
- 크레딧이 생성마다 차감(음수 ledger 행 type=`generation_charge`)됐는지 확인.

### Stage 3b — Compose 렌더 E2E (createRender -> render_jobs -> ready, v1sr/v1sc)
> 본선의 핵심. 여러 ready 클립을 EDL로 엮어 **완성본 1개**를 만든다. 렌더는 워커 ffmpeg(CPU)라
> **fal 비용 0** (소스 클립은 Stage 3에서 이미 과금됨). `studio_daily_generation_cap`에 안 걸림.

- `/studio/compose`에서 ready 클립을 시퀀스/트림/컷으로 배치(순차+트림+컷만) → 총 길이를
  시즌 compose 범위(**15~30s**, 최대 10클립) 안으로 → **Make final(렌더)** 클릭.
- `createRender`가 검증하는 것: compose_enabled, 클립수 <= max_clips, 총길이 [min,max],
  각 소스 = **본인 소유·동일 시즌·ready·유효 v1 CryptoBind**, 트림 <= 클립 길이. 통과 시 EDL+소스
  서명 번들로 **v1sr(request-stage)** 스탬프 후 `render_jobs` queued 삽입.
- 워커 6-state 관찰(생성과 별도 큐):
```sql
SELECT id, status, total_duration_seconds, source_job_ids, video_url, r2_key,
       cryptobind_render_signature, cryptobind_final_hash, cryptobind_final_signature,
       worker_started_at, worker_finished_at, error_message
FROM public.render_jobs ORDER BY created_at DESC LIMIT 3;
```
  기대 전이: queued -> rendering -> uploading -> **ready**. `video_url`(R2)·`r2_key` 채워짐,
  `cryptobind_render_signature`(v1sr, 생성시) + 워커가 채운 `cryptobind_final_hash` +
  `cryptobind_final_signature`(**v1sc**, content-stage) 기록.
- 워커 로그에 render READY 확인. 크레딧 **추가 차감 없음**(렌더 무료).

### Stage 4 — 제출 E2E (submitRender + 풀 v1s 체인 + 불변성)
- ready **render**를 제출(`submitRenderAction` → `submitRender`). 잡이 아니라 **완성본** 제출.
- `submitRender`가 검증하는 것(쓰기 전): render ready+owner+video_url, 시즌 compose cap,
  **모든 소스 클립 v1 재검증**, render **v1sr** 재계산, 워커 **v1sc**(`verifyComposeBind`) → 통과해야 기록.
- 검증:
```sql
SELECT id, status, free_entry_url, main_round_video_url,
       studio_application_render_id, studio_main_render_id,
       studio_application_submitted_at, main_round_submitted_at
FROM public.genesis_applications
WHERE season_id = '<SEASON_ID>' ORDER BY created_at DESC LIMIT 3;
SELECT id, status, submitted_at FROM public.render_jobs WHERE id='<RENDER_ID>';
```
  기대:
  - 예선(application) 라운드 + 신청행 없음 → **자동 생성**(Creator Statement 150~250 + 약관 필수),
    `studio_application_render_id`에 render 링크. status는 정원에 따라 `pending`/`waitlist`(S-1,
    하드코딩 아님), 마감 후면 거부(`application_closed`, S-2).
  - 본선(main)이면 기존 `selected` 신청행 필요 → `studio_main_render_id` + `main_round_video_url`
    기록 + status `main_round_submitted`. `main_round_start_at + submission_hours`(48h) 경과 후 거부
    (`round_closed`, S-3). 미선발이면 `not_selected`.
  - render status `ready -> submitted`(터미널), 재제출 시 `already_submitted`로 거부(불변성).
  - **소스 클립은 ready로 유지**(재사용/개별추적 가능 — 의도적). 채점 status는 **건드리지 않음**.
- 자동화 E2E(스키마+integrity 실측): `scripts/e2e-submit-render.mjs`.

### Stage 5 — 결제 ON (실 Stripe 웹훅)
```sql
UPDATE public.platform_config SET value='true' WHERE key='studio_purchase_enabled';
```
- `/studio` 구매 섹션에서 팩(예 $25) 선택 → Stripe Checkout(test) 진입 확인.
- 카드 결제(보류: 라이브 전환 시 실카드). **지금 단계 검증 포인트**는 dashboard 웹훅이 실제로
  도달·검증·적립되는지다. test 모드에서 Checkout 완료 시:
```sql
SELECT id, user_id, amount_credits, type, stripe_session_id, created_at
FROM public.credit_transactions WHERE type='purchase' ORDER BY created_at DESC LIMIT 5;
```
  기대: 결제 1건당 purchase 행 1건(stripe_session_id 바인딩), 잔액 증가.
- **멱등성**: Stripe dashboard에서 해당 이벤트 **Resend** → ledger 행 **증가 없음**(unique index
  `credit_transactions_stripe_session_uniq` 작동). webhook은 재시도 시에도 200/handled.
- Vercel Functions 로그에서 `/api/studio/stripe-webhook` 200 확인. 서명 불일치면 400(= whsec
  불일치 신호 → 1.4 재확인).

### Stage 6 — 비용 가드 확인
- 워커 일일 캡: `generation_jobs`의 오늘 worker_started_at 건수가 캡에 닿으면 워커 로그에
  `[guard] daily cap reached` + 신규 생성 일시정지. 캡 상향으로 재개.
- `STUDIO_DEV_MODE=false`라 사용자가 고른 티어/길이가 그대로 쓰이는지(Stage 3에서 budget을
  골랐을 때 실제 ltx 호출됐는지 fal request로 교차) 확인.

---

## 3. 가드 / 네거티브 점검 (런칭 전 1회 권장)

| 케이스 | 방법 | 기대 |
|---|---|---|
| 정원 초과(S-1) | max_applicants 도달 상태에서 예선 자동신청 | status=`waitlist` |
| 마감 후(S-2) | application_close_at 지난 시즌에 예선 제출 | `application_closed` |
| 본선 48h 초과(S-3) | main_round_start_at+submission_hours 지난 뒤 제출 | `round_closed` |
| 영상 길이(S-7) | 시즌 라운드 min/max 벗어난 길이로 생성 | `bad_duration` |
| 클립 CryptoBind 변조 | 소스 generation_jobs의 video_url/해시만 바꾼 뒤 createRender/submit | `source_cryptobind_failed` |
| 완성본 변조 | render_jobs video_url/final_hash만 바꾼 뒤 submitRender | `compose_cryptobind_failed`(v1sc mismatch) |
| 남의 클립 합성 | 타 user의 jobId를 EDL에 넣어 createRender | `source_not_owned` |
| 길이 위반 | 15s 미만/30s 초과 EDL로 createRender | `too_short` / `too_long` |
| 타 토너먼트 제출 | 다른 season_id로 제출 시도 | `tid_mismatch` / season mismatch |
| 결제 게이트 | session6 OFF에서 /api/studio/checkout | 403 disabled (S-5) |

> 변조 테스트는 테스트 계정 행에만 수행하고 끝나면 원복.

---

## 4. 롤백 (즉시)

스위치는 fresh read라 **UPDATE 즉시 무효화**, 재배포 불필요.
```sql
UPDATE public.platform_config SET value='false' WHERE key='session6_enabled';        -- /studio 즉시 404
UPDATE public.platform_config SET value='false' WHERE key='studio_purchase_enabled'; -- 구매 즉시 막힘
```
- 이미 적립된 크레딧/제출된 신청행은 **남는다**(원장은 append-only, 제출은 불변). 롤백은
  "신규 노출 차단"이지 "과거 거래 취소"가 아니다. 과거 거래 조정이 필요하면 `/admin/credits`
  프로모(음수는 불가 — 별도 admin_adjust 정책 필요) / 운영진 검토 흐름으로.
- 워커를 멈추려면 Railway에서 일시정지하거나 `studio_daily_generation_cap=0`으로 신규 생성 차단.

---

## 5. 사후 모니터링 (런칭 후 24~48h)

- **`/admin/credits`** — 원장(구매/프로모/충전/환불) 흐름, 이상 음수/중복 여부.
- **`/admin/emails`** — 트리거 이메일 발송/재시도 로그.
- **Railway 워커 로그** — READY/FAILED 비율, 환불(refund) 행(실패 잡 자동 환불, 멱등).
- **fal 대시보드** — 지출이 예측 범위인지(생성 수 x 티어 단가). 급증 시 daily cap 하향.
- **R2** — 객체 증가, 고아 파일 여부.
- **Stripe dashboard** — Checkout 성공/실패, 웹훅 delivery 성공률(실패=재시도 → 멱등 적립).
- **generation_jobs 상태 분포**:
```sql
SELECT status, count(*) FROM public.generation_jobs GROUP BY status ORDER BY 2 DESC;
```

---

## 6. 사인오프 체크리스트

- [ ] 마이그레이션 1~7 프로드 적용 + 검증 쿼리 통과
- [ ] CRYPTOBIND 해시 지문 메인 앱 == 워커
- [ ] 워커 가동 + `STUDIO_DEV_MODE=false` + 일일 캡 설정
- [ ] Stripe dashboard 웹훅 등록 + whsec Vercel 반영 + 재배포
- [ ] Stage 0 OFF 베이스라인(404) 확인
- [ ] Stage 1 session6 ON → /studio 200 + /apply 퍼널
- [ ] Stage 3 클립 2~3건 실 생성 6-state -> ready (+ S-6 content bind = v1c 기록)
- [ ] Stage 3b compose 렌더 createRender -> render_jobs 6-state -> ready (v1sr + v1sc 기록, 렌더 무료)
- [ ] Stage 4 submitRender -> 신청행 render 링크 + 풀 v1s 체인 통과 + 불변성 + 채점 status 비파괴
- [ ] Stage 5 결제 ON -> 웹훅 적립 + Resend 멱등
- [ ] 네거티브 가드(3장) 표 1회 통과
- [ ] 롤백 SQL 검증(켰다 끄면 즉시 404 복귀)
- [ ] 모니터링 대시보드 5장 즐겨찾기 등록

---

## 부록 A — member-hosted(파트너) ON (요약)

동일 마스터 스위치 패턴.
```sql
UPDATE public.platform_config SET value='true' WHERE key='member_hosted_enabled';
```
- ON 시: `/host` 200, `/admin/partners` 노출, 파트너 이메일 발송, 승급 로직 작동(M-1),
  `/partner/activate`+callback 200(M-3), markEscrowPaid 가능(M-4), partner-stats cron 동작(M-2).
- 단, **시즌0 신청행 user_id backfill 전에는 자격 승급 실효 0**(별도 backfill 필요).
- 머지/배포 시 `vercel.json` cron 3개(email-tick/season-tick/partner-stats) 누락 없는지 교차
  확인(M-5).
- 롤백: value='false' → 전 표면 즉시 차단.

## 부록 B — 빠른 명령 모음
```bash
# /studio 노출 상태
curl -s -o /dev/null -w "%{http_code}\n" https://www.oxxovo.ai/studio
# CRYPTOBIND 지문(값 비노출)
node -e "console.log(require('crypto').createHash('sha256').update(process.env.STUDIO_CRYPTOBIND_SECRET).digest('hex'))"
```
```sql
-- 스위치 일괄 조회
SELECT key,value FROM public.platform_config
WHERE key IN ('session6_enabled','studio_purchase_enabled','member_hosted_enabled') ORDER BY key;
-- 켜기 / 끄기
UPDATE public.platform_config SET value='true'  WHERE key='session6_enabled';
UPDATE public.platform_config SET value='false' WHERE key='session6_enabled';
```

---
관련 문서: `reports/railway_deploy_guide_oxxovo_studio.md` · PR #7(studio) · PR #3(member-hosted) ·
교차 리뷰 패치(S-1~S-7 / M-1~M-4)
