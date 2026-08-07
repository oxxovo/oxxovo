# 본선 채점 크론 신설 (Railway) — 실물이 없다

**2026-08-06 작성 / 2026-08-07 재실측 · 지수 본체 · 본부 실측 지시.**
발사 체크리스트 등재 항목. **기한 = 2026-11-13**(투표 시작 = 본선 버퍼 종료).

### 날짜 — DB 실측 (2026-08-07, `seasons` 직접 조회)

| 컬럼 | 값(UTC) | PST | KST |
|---|---|---|---|
| `application_close_at` | 2026-11-04T08:00:00+00:00 | 11/4 00:00 | 11/4 17:00 |
| `scoring_start_at` (예선 버퍼 종료) | 2026-11-05T08:00:00+00:00 | 11/5 00:00 | 11/5 17:00 |
| `main_round_start_at` | 2026-11-09T08:00:00+00:00 | 11/9 00:00 | 11/9 17:00 |
| **`main_round_end_at`** (본선 마감) | **2026-11-12T08:00:00+00:00** | **11/12 00:00** | 11/12 17:00 |
| **`community_vote_start_at`** (=본선 채점 개시) | **2026-11-13T08:00:00+00:00** | **11/13 00:00** | 11/13 17:00 |
| `community_vote_end_at` | 2026-11-16T08:00:00+00:00 | 11/16 00:00 | 11/16 17:00 |
| `awards_announcement_at` | 2026-11-17T04:00:00+00:00 | 11/16 20:00 | 11/17 13:00 |

★본부 지시의 "11/12"는 **본선 마감**이고, **채점이 실제로 도는 것은 11/13 00:00 PST 부터**다
(그 사이 24h 가 본선 처리버퍼). 크론은 그전에 켜 두면 되고, 켜 둬도 게이트에서 끊긴다.
★11/1 로 DST 가 끝나 이 구간은 전부 PST(UTC-8) 다.

---

## 0. 사실

본부 실측: Railway 서비스가 **둘뿐**이다 — `oxxovo-studio`(렌더) · `oxxovo-scoring`(예선).
`ROUND=main` 잡이 **없고** Variables 에 `ROUND` 키도 없다.

코드 확인 (`src/batch.ts:53`):
```ts
const ROUND: RoundName = process.env.ROUND === 'main' ? 'main' : 'application';
```
→ **`ROUND` 미설정 = `application`.** 지금 도는 서비스는 예선 워커 하나다.

A1 커밋(`390aff6`, 2026-06-04) 메시지가 *"A2 cron 은 Railway 스케줄 잡"* 이라고 적었지만
**만든 것은 코드와 문서였고, 서비스는 안 만들어졌다.**
★오늘 반복된 "문서에 있고 실물에 없다" 패턴이다.

★**함의: 11/13 부터 본선 채점이 필요한데 돌 것이 없다.** 잊으면 본선 점수가
아예 생기지 않고, 그러면 `final_score` 가 전 행 null → 랭킹이 비고 → 시상이 안 된다.

---

## 1. ① 서비스 추가 방식 — **같은 레포·같은 이미지, env 하나만 다르게**

새 코드도, 새 Dockerfile 도, 새 브랜치도 필요 없다. `batch.ts` 는 이미
`RoundConfig` 로 두 라운드를 다 처리한다(A1). **`ROUND=main` 이 유일한 차이다.**

Railway 에 **두 번째 서비스**를 같은 GitHub 레포(`oxxovo/oxxovo-scoring`, `main`)에서
만들고 `ROUND=main` 을 준다. 빌드는 `railway.json` 의 Dockerfile 을 그대로 쓴다.

★기존 예선 서비스에 `ROUND` 를 얹으면 **안 된다** — 그러면 예선이 멈추고 본선이 돈다.
두 라운드는 시기가 겹치지 않아 보이지만(예선 11/5~, 본선 11/13~), 예선 재시도·
Top N 확정이 뒤늦게 돌 수 있으므로 **서비스를 분리한다.**

### ★두 워커가 같은 DB 를 동시에 봐도 안전한 이유

`_test_gate.ts` 의 배선 단언 13개가 이것을 고정한다(`test:gate` 32/32):

| | 예선 | 본선 |
|---|---|---|
| 영상 컬럼 | `free_entry_url` | `main_round_video_url` |
| 후보 status | `pending` | `main_round_submitted` |
| status claim | `verifying` 로 전환 | **안 함** |
| 신청 행 쓰기 | 함 | **안 함** |
| Top N 확정 | 함 | **안 함** |
| 버퍼 컬럼 | `scoring_start_at` | `community_vote_start_at` |

★후보 선정이 **서로 다른 컬럼 + 서로 다른 status** 라 한쪽이 다른 쪽 행을 집는 것이
구조적으로 불가능하다. 그 성질 자체를 단언으로 박아뒀다("두 라운드가 서로 다른
컬럼·status 를 **동시에** 본다"). 그리고 버퍼 컬럼도 서로 안 본다 — 양방향으로 검사한다.

`scoring_results` 는 `UNIQUE(application_id, round)` 라 같은 신청의 예선/본선 행이
따로 산다(`reports/scoring_results_migration_2026-05.sql:146`). 충돌하지 않는다.

그리고 본선은 `claimStatus=null` 이라 status 로 잡지 않고 **`scoring_results(round='main')`
행의 `judged_status='in_progress'` 가 lock 역할**을 한다(`pickPending` 의 제외 집합).
즉 두 워커는 **서로 다른 테이블 축**으로 잠근다.

★재실측 2026-08-07: `npx ts-node _test_gate.ts` → **32/32 PASS**(그중 배선 단언 13개).

---

## 2. ② 크론 주기 — **예선과 다르게 간다. `*/15`**

| | 예선 | 본선 |
|---|---|---|
| 처리량 | 최대 500편 | **10~50편** (`advance_min 10` / `advance_max 50`, 실측 `top_n_advance=50`) |
| 창 | 11/5 08:00Z ~ 11/8 (72h 처리버퍼 뒤) | 11/13 08:00Z ~ 시상 전 |
| 주기 | `*/5` | ★**`*/15`** |

**근거 — 급할 이유가 없다.** 최대 50편이고, 실측 처리량은 500편 10.6h
(`project_scoring_500_throughput`)이므로 **50편이면 1시간 남짓**이다.
창은 11/13 08:00Z → 시상 승인까지 약 **3.8일**. 20배 이상 여유다.

**그리고 짧을수록 나쁜 이유가 있다.** 이 잡은 `restartPolicyType: NEVER` 인
**일회성 실행**이다. 5분마다 띄우면 3.8일 동안 **1,100회** 기동하는데, 그중
대부분은 게이트에서 끊기거나 큐가 비어 즉시 종료한다. 15분이면 **370회**로
줄고, 지연은 최대 15분 늘 뿐이다 — 3.8일 창에서 무의미한 차이다.

★**`*/5` 로 맞출 이유가 있다면 하나뿐이다**: 예선과 운영을 통일해 사람이 헷갈리지
않게 하는 것. 그 값이면 그것도 타당하다 — 비용 차이가 거의 없기 때문이다(§6).
**둘 다 안전하고, 나는 `*/15` 를 권고한다.**

### ★주기는 `BATCH_SIZE` 와 물린다 — 한 실행이 주기보다 길면 안 된다

한 실행은 후보를 **순차로** `BATCH_SIZE` 개 처리한다. 실측 처리속도는 **편당 약 2.5분**
(예선 라이브 조합 2편/5분이 겹치지 않고 도는 것에서 역산). 그러면:

| BATCH_SIZE | 한 실행 소요 | `*/5` | `*/15` | 50편 소진 |
|---|---|---|---|---|
| 2 | ~5분 | 아슬 | ✅ 여유 | `*/15` 기준 **~6.3h** |
| 10 | ~25분 | ❌ 겹침 | ❌ 겹침 | `*/30` 이면 OK (~2.5h) |
| 30 | ~38분 | ❌ 겹침 | ❌ 겹침 | `0 * * * *` 세트에서만 (~1.7h) |

★**겹치면 같은 라운드 워커 두 벌이 동시에 돈다.** 행이 깨지진 않는다 —
`in_progress` 제외 + `UNIQUE(application_id, round)` 가 막는다. 다만 **본선은
status claim 이 없어서**(`claimStatus:null`) SELECT~INSERT 사이 좁은 경합에서
INSERT 가 튕기면 그 행의 **재시도 횟수를 하나 태운다**(`MAX_RETRIES=3`).
검증된 적 없는 동시성이라 **주기 > 실행시간**으로 피하는 게 맞다.

★따라서 **권고 조합 = `BATCH_SIZE=2` + `*/15`**. 50편을 6.3시간에 소진하고,
창(92시간)의 7% 만 쓴다. 겹침 여지가 없다.

---

## 3. ③ env — **예선에서 무엇이 같고 무엇이 다른가**

★본부가 센 "예선 서비스 11개"의 정확한 목록은 **내가 못 본다**(대시보드 접근 없음).
그래서 **개수로 맞추지 말고 규칙으로 맞춘다**:

> **예선 Variables 를 전부 복사 → `ROUND=main` 한 줄 추가 → `YTDLP_PROXY` 만 빈 값 확인.**
> 나머지는 같아도 되고, 본선에서 안 읽히는 키가 섞여 있어도 무해하다.

아래는 **코드가 실제로 읽는 키 전부**(`grep process.env` 실측)와 본선에서의 취급이다:

| 키 | 본선 서비스 | 비고 |
|---|---|---|
| **`ROUND`** | ★**`main`** | ★**유일한 필수 차이.** 없으면 예선이 한 벌 더 도는 것 |
| `SEASON_ID` | **`season_0`** (동일) | 같은 시즌의 다른 라운드다 |
| `BATCH_SIZE` | **`2`** (예선 라이브 값과 동일) | 기본값 `1`. §2 의 겹침 규칙과 물린다 |
| `MAX_RETRIES` | 동일 | 기본 `3` |
| `SEASON_REQUIRED_STATUS` | ★**빈 문자열** (예선과 동일) | ★`undefined` 면 `'scoring'` 으로 떨어진다 — **반드시 빈 값으로 넣는다**. 다만 본선은 `applySeasonStatusGate: false` 라 실제로는 안 읽는다. 그래도 넣는다: 나중에 켜질 때 조용히 막히지 않게 |
| `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` | 동일 | |
| `ANTHROPIC_API_KEY` · `OPENAI_API_KEY` · `GEMINI_API_KEY` | 동일 | |
| `RESEND_API_KEY` · `RESEND_FROM` · `ADMIN_EMAIL` | ★**안 읽힌다** | 이 세 키는 `recommendations.ts` 안에서만 쓰이고, 본선은 `runFinalize:false` 라 그 파일을 **호출 자체를 안 한다**. 복사해도 무해하지만 없어도 된다. (2026-08-06 판의 "에러 알림 경로" 는 내 오기 — 그런 경로는 없다) |
| `R2_*` (5개) | 동일 | 포스터 백필. 본선도 돈다 |
| `YTDLP_*` | 동일하되 ★`YTDLP_PROXY` **빈 값** | 본선 영상은 전부 Studio 렌더다(실측: `seasons.allowed_video_platforms=['studio']`, `studio_round='both'`) → R2 직링크. `extractor.ts` 에 직다운로드 분기가 없어 **R2 URL 도 yt-dlp 를 탄다**(generic extractor). 이때 residential 프록시를 태우면 느려지거나 502 로 실패한다 — **프록시는 유튜브 봇차단 우회용이고 R2 에는 해가 된다** |
| `FFMPEG_DIR` / `FFMPEG_PATH` / `FFPROBE_PATH` | Docker 이미지 기본 | 예선과 동일하게 두면 된다 |

**`BATCH_SIZE` — 2026-08-06 판을 정정한다.** 그때 "예선은 30" 이라고 적었는데,
그건 [[project-scoring-500-throughput]] 의 **권고값**이고 **라이브 값이 아니다**.
Railway 실측(2026-07-26)은 **`BATCH_SIZE=2` · `*/5`** 이고, 30 으로 올리는 건
`0 * * * *` 와 세트로 아직 TK 대기 중이다.
→ 본선도 **`2`** 로 간다. §2 표대로 `*/15` 와 겹치지 않는 유일한 안전 조합이고,
예선이 나중에 30/시간당으로 바뀌어도 본선은 영향받지 않는다(서비스가 다르다).

★**env 를 복사할 때 `ROUND` 를 빠뜨리는 것이 이 작업의 유일한 실패 모드다.**
빠뜨리면 오류가 안 나고 **예선 워커가 하나 더 도는 것**이 된다. §5 의 확인 신호가 그것을 잡는다.

---

## 4. ④ TK님이 누르실 것

★들어갈 곳은 **예선 워커와 같은 프로젝트 `trustworthy-enchantment`** 다
(실측 2026-07-26: 예선 = `trustworthy-enchantment/oxxovo-scoring`, 렌더 = 별도 프로젝트
`just-vibrancy/oxxovo-studio`). 같은 프로젝트에 두면 변수 복사가 쉽고 로그가 한자리에 모인다.

1. Railway → 프로젝트 **`trustworthy-enchantment`** → **New → GitHub Repo** → `oxxovo/oxxovo-scoring`
2. 서비스 이름: **`oxxovo-scoring-main`** (예선 `oxxovo-scoring` 과 구분되게)
3. **Settings → Source** → 브랜치 **`main`** 확인
4. **Variables** → 예선 서비스 변수를 **전부 복사**한 뒤 ★**`ROUND=main` 추가**
   - `SEASON_REQUIRED_STATUS` 는 **키는 있고 값이 빈 문자열**이어야 한다(예선과 같게).
     본선은 안 읽지만, 나중에 켜질 때 조용히 막히지 않게 같은 모양으로 둔다.
   - `BATCH_SIZE` 는 **`2`**, `YTDLP_PROXY` 는 **빈 값** 확인
5. **Settings → Cron Schedule** → `*/15 * * * *`
6. **Deploy**
7. 첫 실행 로그 확인 (§5)

★**시즌이 끝나면 이 서비스의 크론을 꺼도 되고, 그냥 둬도 된다** — 다음 시즌 일정이
들어올 때까지 게이트가 계속 SKIP 한다(무해·무비용).

★**4번에서 멈추고 Variables 스크린샷을 한 번 봐주시면** `ROUND` 누락을 배포 전에 잡는다.

---

## 5. ⑤ 확인 신호 — 첫 실행 로그

**정상 (본선 워커가 맞다) — 11/13 이전**
```
=== OXXOVO Scoring Batch ===
ROUND=main  SEASON_ID=season_0  BATCH_SIZE=2  MAX_RETRIES=3
started at 2026-...

⏸  채점 게이트 차단 — SKIP: community_vote_start_at(2026-11-13T08:00:00+00:00) 이 미래 (본선 처리버퍼(투표 시작 전) 진행 중 — 렌더/확정 대기)
=== Batch skipped (채점 시점 아님) ===
```

봐야 할 것은 **두 줄**이다:
1. 첫 줄이 ★`ROUND=main`
2. 차단 사유 컬럼이 ★`community_vote_start_at`

★2026-08-06 판에 적었던 `SEASON_REQUIRED_STATUS=...` 줄은 **본선 로그에 안 나온다** —
그 줄은 `if (cfg.applySeasonStatusGate)` 안에 있고 본선은 `false` 다(`batch.ts:386~392` 실측).
**안 나오는 것이 정상이다.** 그 줄을 찾다가 "설정이 안 먹었나" 로 오해하지 않게 적어 둔다.

**이상 — `ROUND` 를 빠뜨린 경우**
```
ROUND=application  SEASON_ID=season_0 ...
⏸  채점 게이트 차단 — SKIP: application_close_at(2026-11-04T08:00:00+00:00) 이 미래 (아직 마감 전)
```
★첫 줄이 `application` 이거나 사유가 `application_close_at` 이면 **예선 워커가 한 벌 더 도는 것**이다.
오류는 안 난다. `ROUND=main` 을 넣고 재배포한다.

**11/13 이후 (실채점)**
```
✓ 채점 게이트 통과 (main_round_end_at=2026-11-12T08:00:00+00:00, community_vote_start_at=2026-11-13T08:00:00+00:00)
  본선 주제(theme): "OXXOVO Season 0 — Competition Theme: Cosmetic Commercial Film..."
[<id>] <이름> — round=main attempt 1/3
=== Batch complete: 2/2 processed (round=main) ===
```
★`round=main` 이 처리 줄마다 찍힌다. 여기서 `round=application` 이 보이면 서비스를 잘못 켠 것이다.

★11/13 이전에는 **차단되는 것이 정상**이다. 그전에 채점이 시작되면 그게 이상 신호다.

---

## 6. ⑥ 요금

Railway 는 **실행 시간** 과금이고, 이 잡은 게이트에서 끊기면 **수 초 만에 종료**한다
(`restartPolicyType: NEVER`, 상주 아님).

- 11/13 이전(설정~투표 시작): 매 실행 수 초 × `*/15` → **월 몇 분 수준. 무시 가능.**
- 11/13 이후 실채점: 50편 × Triple-AI. **컴퓨트가 아니라 AI 호출비가 지배적**이다.
  실측 단가 행당 **$0.2788** → 50편 **≈ $14**. 프레임 20장 기준(40초 상한)이면
  그보다 소폭 는다.

★Railway 요금 자체는 무시 가능하고, **드는 것은 AI 호출비**다.
★단 **서비스 개수가 플랜 한도에 걸리는지는 대시보드에서 확인이 필요하다** — 내가 못 본다.
([[feedback-vercel-cron-limits]] 와 같은 계열: 한도 초과가 배포는 되고 조용히 안 도는 형태로 나타난다.)

---

## 7. 등재

**발사 체크리스트 등재 (본부 지시 2026-08-07).** [[project-launch-gates]] "채점 워커" 절의
⬜ 항목을 이 문서로 갱신했다(옛 항목은 9/3~9/5 일정과 옛 6월 문서를 가리키고 있었다).

- **기한 = 2026-11-13 00:00 PST** (그전에 서비스가 존재하고 크론이 돌고 있어야 한다)
- **실질 마감 = 11/12 이전** — 본선 마감 후에 만들면 첫 실행이 곧 실채점이라 확인 여유가 없다
- **권장 시점 = 리허설 때 같이** — 리허설이 `ROUND=main` 경로를 밟는지 확인할 것
- **잊었을 때의 증상**: 아무 오류도 안 난다. `scoring_results(round='main')` 이 0행이라
  `final_score` 가 전 행 null → 본선 리더보드가 비고 → 시상 게이트가 빈 포디움에서 막힌다

★검증은 **11/13 전에도 된다** — 서비스를 만들고 첫 실행 로그의 두 줄(§5)만 보면 끝난다.
게이트가 막아 주므로 미리 켜도 아무 일도 일어나지 않는다.

관련: `worker_deploy_procedure_2026-08-06.md` · `deploy_trains_2026-08-06.md` ·
`rehearsal_runbook_2026-07.md` · `main_round_cron_setup_2026-06.md`(옛 A2 문서 — 실물 없음)
