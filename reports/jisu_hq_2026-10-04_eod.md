# EOD 2026-10-04 -- 지수(메인, 앱 레포) 작업 요약 + 인계

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문 그대로.
읽는 순서: 이 파일 맨 아래 **"인계 메모"** 와 **"미결"** 두 절 -> 이어서 어제 파일(`jisu_hq_2026-10-03_eod.md`)의 "인계 메모".

## 0. 한 줄 요약

오늘은 **코드·DB·배포 변경이 0건**이다(읽기 전용 조사와 설계 검토만). 어제 인계 미해결 6번 "Phase 1 설계 대기"를 받아,
뉴스·엔터 콘텐츠 발행 구조(본부 Admin = Publishing Control Center)의 설계서를 **초안부터 최종 h까지 여러 판에 걸쳐 대조**했고,
구현 전에 잡지 않으면 라이브에서 터졌을 결함을 다수 찾아 설계서에 반영시켰다. 구현을 막는 미결은 **#5 하나**(`upstream_approval_id`, 제니2).

## 1. 어제(10-03)와의 연결

어제 인계 "미해결 6. Phase 1 설계 대기 -- 결정 필요: 공개 상태 4컬럼 vs `publication_status`"는 **본부 결정으로 해소**됐다.
참가작과 새 콘텐츠를 **완전히 분리**한다(`genesis_applications`는 그대로, 새 `contents` 표). 그래서 `isRowPublic()`과의 "두 번째 답" 문제가 생기지 않는다.
어제 설계에 반드시 넣으라고 적은 5가지(라이브 1회 실행 완료 조건 / 경로 무관 감사 트리거 / CREATE TABLE+GRANT 같은 SQL / kind별 스위치 fail-closed / 감사 트리거 NOT NULL 확인)는 모두 설계서에 들어갔다.

어제 미해결 1~5번(`description_ko` 분기, `ALERT STATE%` 제외, `e9957ca` 배포 전, `updated_at` C분류, eslint 71건)은 **오늘 손대지 않았다**. 그대로 유효하다.

## 2. 오늘 한 일 (전부 읽기 전용)

- `reports/jisu_hq_2026-10-03_eod.md` 읽고 상태 요약(3줄) 보고.
- Phase 1 설계서를 받아 **판마다 대조**(아래 3절). 코드·문서를 직접 읽어 근거를 댔다: `lib/competition-publication.ts`, `lib/video-live.ts`, `lib/watch-gate.ts`, `lib/promo-publish.ts`, `lib/promo-schedule.ts`, `lib/postiz.ts`, `app/api/cron/promo-schedule/route.ts`, `app/api/admin/promo/publish/route.ts`, `app/api/email/inbound/route.ts`, `lib/email/admin-alert.ts`, `vercel.json`, `scripts/check-service-role-grants.mjs`, `scripts/deploy-prod.mjs`, `scripts/postiz-probe.mjs`.
- 외부 문서 조회(WebFetch): Vercel 크론 한도, Cloudflare R2 S3 호환(체크섬), Postiz `POST /posts` 응답, YouTube 자동 더빙 도움말.
- Vercel API로 팀 플랜 조회: `oxxovos-projects` = **pro / active**.
- 메모리 갱신: `feedback_vercel_cron_limits.md` 정정, `reference_pg_acl_maintain_and_info_schema.md` 신설.
- **하지 않은 것**: 커밋(이 파일 제외), 배포, DB 쓰기, 코드 수정. 라이브 `/api/version` 재조회 = `09e3580`(builtAt 2026-10-03T21:14:57Z), 오늘 배포 없음.

## 3. Phase 1 설계 대조 경과

본부 집계로는 9차(최종 i)까지 진행. **지수가 받은 것은 최종 h까지**이고 최종 i·j는 받지 못했다(아래 10절).

| 판 | 지수가 짚은 것(요지) | 결과 |
|---|---|---|
| 초안 | 공통 헬퍼는 대회 전용(키 하드코딩)이라 새 헬퍼 필요 / 스위치 신설 / 감사표 신설 / 승인 이중 / presign 필요(4.5MB) 등 4질문 + 11건 | 반영 |
| 전자동 정정 | 수입 경로(엔드포인트 1개+출처별 시크릿), promo는 전송층만 재사용, 마스터 스위치, 공개 면은 `[section]` 동적 라우트 | 반영 |
| 확정 구조(배포 관제) | handoff 규격 대조(source_version, language, rights, 영상 변형), 상류 승인 vs 배포 승인 이중 | 반영 |
| 최종 | 17건(A~P): UNIQUE(content_id,platform), failed/unknown 경계, content_publish_log, 조기 종료, 불변 컬럼 등 | 반영 |
| 최종 b | 14건: presign 키 version, content_assets 불변, 채널당 POST 1회, RPC 권한, 재큐, 멱등 등 | 반영 |
| 최종 c~g | 각 5~7건: rights_reason, 하강 트리거, presigns 표, open_kinds, 정규식 되읽기, 한 행씩 점유, alerted_at 등 | 대부분 반영 |
| 최종 h | 더빙 항목만 추가됨. **8차 지적 6건은 h에도 미반영**(10절) | 대기 |

## 4. 지수가 찾은 주요 결함 (구현 전에 잡음)

| # | 결함 | 왜 터지는가 | 설계서 반영 |
|---|---|---|---|
| 1 | **함수 오버로드** (10-03에 실제 발생: `update_platform_config` 7주간 호출 불가) | 파라미터를 나중에 추가하면 새 오버로드(`PGRST203`) | RPC 15개 시그니처를 ③ 전에 한 번에 확정 + 되읽기 정확히 15행. `dist_claim`은 `open_dbas`가 아니라 `open_kinds`(TS·SQL 두 곳 매핑 방지) |
| 2 | **presign 덮어쓰기** | 키가 `(source_ref, 버전, role)`로 결정적이라 이미 수입·송출 대기 중인 파일을 같은 키로 다시 PUT하면 검수한 영상이 바뀜 | 키에 `v<n>`+nonce, 이미 수입된 버전은 presign 409, 송출 시 sha256 재검, `content_presigns` 표 |
| 3 | **RPC anon 실행 권한** | `SECURITY DEFINER` RPC가 anon에 열려 있으면 공개 anon 키로 `/rpc`를 직접 호출해 권리 내리기·반송 가능 | 모든 RPC에 `REVOKE ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role` + `SET search_path`, 만든 직후 `proacl` 되읽기 |
| 4 | **Postiz 예약으로 긴급 정지 무력화** | 미래 시각으로 Postiz에 맡기면 우리 스위치를 꺼도 Postiz 안에서 계속 나가고 회수도 못 함 | 항상 `type:'now'`, `scheduledAt` 거부 |
| 5 | **`LIKE 'content\_%'` 0행** | 표준 문자열에서 역슬래시 두 개+`_`로 읽혀 아무것도 안 잡혀 "0행 = 문제없음"으로 오독 | 정규식 `~ '^(content\|dist)_'`, "0행이면 쿼리가 틀린 것", 대조군 포함 사전 조회 |
| 6 | **일괄 점유 -> 처리도 전에 `unknown`** | `limit_n`개를 먼저 `sending`으로 만들면 틱 후반 행이 대기 중 임계를 넘겨 사람이 SNS를 뒤져야 하는 `unknown`이 됨 | 한 행씩 점유하고 즉시 처리 + 시간 예산 |
| 7 | **`rights_reason` CHECK -> 뉴스 수입 전부 실패** | `CHECK (cleared OR rights_reason IS NOT NULL)`인데 수입 규격에 필드가 없어, 약관 확인 전 `restricted`로 오는 뉴스가 전부 거절 | 수입 규격에 `rights_reason` 추가, `cleared`인데 오면 400 |
| 8 | 스위치가 꺼진 동안 5분마다 헛수고 | 점유->다운로드->Postiz 업로드->되돌림 반복, Postiz 라이브러리에 같은 영상 누적 | 틱 시작 조기 종료(DBA별) + `unknown` 정리는 그보다 앞 |
| 9 | 해시 검증이 Postiz 업로드 뒤 | 바뀐 파일이 외부에 올라간 뒤에야 발견 | 내려받기 -> 해시 검증 -> 업로드 순서 |
| 10 | 5xx를 `failed`로 보면 중복 송출 | Postiz가 큐에 넣고 응답했는지 모름 | 5xx·타임아웃은 `unknown`, 재시도 금지 |
| 11 | `cancelled` 행이 영영 안 나감 / `unknown` 영구 잔존 | 반송->복구 후 큐에 행이 없음 | `[송출]`이 재큐, `[나갔음]`/`[다시 보냄]` 버튼 |
| 12 | `REVOKE DELETE`는 배포 게이트와 충돌 | `check-service-role-grants.mjs`가 모든 테이블에 DML 4종을 요구 | 권한 대신 BEFORE UPDATE/DELETE 거부 트리거(append-only) |
| 13 | 스케줄 키 형식 | 파서가 영문 약어(`mon,tue`)만 받아 `월~금`을 저장하면 파싱이 비어 조용히 정지 | 저장 형식 명시 + 파싱 실패 시 수입 503 |
| 14 | 권리 상승이 SQL로 우회 가능 | CHECK는 `scheduled`일 때만 `cleared`를 요구 | `rights_status` 하강 전용 BEFORE UPDATE 트리거 |
| 15 | 알림 기록 없음 | 메일 실패 시 재시도 불가 또는 `info@` 도배 | `alerted_at`/`notified_at` 컬럼 (쓰는 방법은 미반영, 10절) |
| 16 | **YouTube 자동 더빙** | 같은 영상의 오디오 트랙(별도 URL 아님). 기본 자동 게시라 우리 검수·정지를 거치지 않고 공개 | §11 잔여 위험 + ⑩ 전 운영 설정 체크 |

**promo 기존 결함(이번 설계와 별건, 지시 전까지 고치지 않음, 코드로 확인):**
`publishPromoVideo`는 Postiz 호출 후에 `posted_at`을 써서(`lib/promo-publish.ts:39-47`) 크래시·동시 호출 시 중복 게시 가능,
실패 행이 `posted_at`을 못 얻어 큐 맨 앞을 반복 점유(`route.ts:64-72`), 채널 일부만 성공해도 완료 처리(`postiz.ts:146`),
`promo-schedule` 라우트에 `maxDuration` 선언 없음, `uploadMedia`가 영상 전체를 메모리로 받음(`postiz.ts:91-105`). **프로덕션에서 관측한 것이 아니라 코드 읽기 기준.**

## 5. 실패·정정 기록 (지수 쪽)

- **지수 오류 정정:** 설계서 4-3의 "권리를 내린 뒤 원본 요청을 재전송하면 409가 반복된다"는 지수의 설명이 틀렸다. `payload_hash`는 수입 당시 요청의 불변 해시라서 원본 재전송은 해시가 같아 **멱등 200 + 현재 상태**가 맞다. 설계서는 정정됐다.
- **지수 제안 폐기:** R2 업로드 시점 `x-amz-checksum-sha256` 검증은 R2가 지원하지 않는 것으로 보여(문서 조회 요약) 서버 스트리밍 해시로 대체. **구현 때 실제 presigned PUT으로 한 번 시험해 확정**(미결 #10).
- **메모리 정정:** `feedback_vercel_cron_limits`의 "Pro = `*/15`까지"는 부정확. 문서 기준 개수 한도는 전 플랜 프로젝트당 100개, 최소 간격은 Pro 1분. 5/27 사고의 원인은 개수가 아니라 Hobby의 빈도 제한이었다.
- **권한 분류기 거부 1회:** `platform_config`의 Postiz 채널 행을 읽으려고 `.env.local`의 서비스 키를 쓰는 스크립트를 실행하려다 "자격증명 사용"으로 거부됨. **우회하지 않았다.** 대신 TK님이 읽기 전용 SQL/스크립트를 실행하는 경로로 전환.
- **임시 파일:** `vercel env pull`로 프로덕션 환경변수를 받아 키 이름만 확인(값은 빈 문자열이라 키를 얻지 못함). 임시 파일은 두 번 모두 삭제했다.
- **본부 요약만으로는 대조 불가:** 한 번은 설계서 본문 파일(`reports/phase1_design_2026-10-04.md`)이 레포에 없어서 요약 기준으로 확인했다고 말하지 못하고 본문을 요청했다. 이 파일은 오늘 이전에 레포에 존재하지 않았다.
- **TK 결정이 지수 권고와 달랐던 것(근거와 함께 기록):** (a) 상류 승인을 곧 배포 승인으로(사후 차단 모델) -- 지수는 사람 승인 유지를 권고, TK님이 위험을 알고 결정. (b) 일일 송출 상한 미도입 -- 지수는 만들자고 했고 TK님이 안 만들기로 결정. 잔여 위험을 설계서 §11에 문구로 기록.

## 6. 오늘 확정된 것

- **이름 충돌 없음**(TK Run): 표 6개(`contents`, `content_assets`, `content_distributions`, `content_presigns`, `content_publish_log`, `contents_history`)와 `content_`/`dist_` 함수 접두사가 라이브에 없음. (지수는 원본 결과를 직접 보지 못했고 본부 보고 기준.)
- `update_platform_config` **5인자 1행**(오버로드 해소 유지, 같은 쿼리의 대조군).
- **YouTube 자동 더빙 미활성**, Audience = not made for kids, Third-party training 해제(TK 설정. 본부 보고 기준, 지수 미확인).
- **뉴스 발행 시각**: 월~금 07:00 Asia/Seoul (`news_publish_weekdays='mon,tue,wed,thu,fri'`, `'07:00'`, `'Asia/Seoul'`).
- **일일 송출 상한은 만들지 않음**(TK) + 잔여 위험 문구(설계서 §11).
- 이 외 설계 결정(사후 차단 모델, `approval_status` 없음, `rights_status` cleared만 송출·override 없음·내리기 즉시/올리기는 새 버전, 스위치 5개(마스터 1+DBA별 송출 2+DBA별 공개 2), `music_video` kind, `language` 필수, 한 행씩 점유, `/c/<id>` 308, 크론 5분)는 설계서 정본 참조.
- 확인된 사실: Vercel **Pro**(API 조회), 크론 한도 100개·최소 1분, Postiz `POST /posts` 응답에 **URL 없음**(`[{postId, integration}]`), Postiz 테스트 채널 없음(4개 모두 실제 계정, TK 확인).

## 7. 현재 상태 (이 파일 작성 시점)

- 레포 `main` = `origin/main` = `4bc9b7f`(이 파일 커밋 전). 미커밋 없음.
- 라이브 = `09e3580`, `dirty:false`. **오늘 배포 없음.** `e9957ca`(robots 주석)는 여전히 배포 전.
- 플래그: `competition_publication_enabled=false`, `news_publication_enabled=false`, `watch_as_home=false`. 건드리지 말 것.
- Phase 1 DB 객체(표 6개·함수 15개·`platform_config` 신규 키) **아무것도 만들지 않았다.** 어떤 SQL도 Run 전이다.

## 8. 미결 (빠뜨린 것 없이)

**구현을 막는 것**
1. **#5 `upstream_approval_id` 제공 여부**(제니2) -- `UNIQUE (source, upstream_approval_id)` 키로 쓰므로 유일한 구현 차단.

**⑩ 라이브 검증 전에 TK님이 정할 값 5개**(없으면 수입·송출·presign 막힘)
`content_min_lead_minutes`, `content_max_bytes_default`(또는 `news_short`), `content_dispatch_per_tick`, `content_presign_ttl_seconds`, `content_presign_rate_per_hour`.
(필수 아님: `content_dispatch_max_attempts`, `content_dispatch_backoff_base_minutes` -- 없으면 재시도 0회.)

**그 외**
- ElevenLabs·Hedra 약관 상업 이용 조건 -- 뉴스·엔터가 나중에(그때까지 뉴스는 전부 `held`).
- `music` kind가 넘기는 것 -- 음원인가 영상인가(`surface` CHECK 확장 여부) (제니2).
- AI 생성물 표기 의무(플랫폼별) (제니3), 송출 전 필수.
- 공개 경로 이름(slug) (TK), `restricted -> blocked` 허용 방향 확인(TK).
- 쇼츠에 더빙이 붙는가 -- 첫 숏폼 업로드 뒤 Studio에서 확인.
- 지수 몫(구현 때): R2 presigned PUT 체크섬 실제 동작(#10), `r2-orphan-sweep.mjs`가 고아 객체를 치우나(#11), Postiz 게시 삭제 기능 존재 여부(#12), `external_url` 채우는 방법(#9).
- **어제 인계에서 이월(오늘 손대지 않음):** `e9957ca` robots 주석 배포 전 / eslint 기준선 71건(`reports/eslint_baseline_2026-10-03.md`) / `description_ko` 분기 라이브 미검증 / `ALERT STATE%` 제외 라이브 미증명 / `updated_at` 트리거 없는 C분류 5개 테이블.

## 9. 오늘 지수의 8차 지적 중 최종 h에 **미반영**으로 남은 6건

설계서 최종 i·j에서 반영됐는지 **이 표로 다시 대조**할 것.

| # | 지적 | 해법 요지 |
|---|---|---|
| 1 | `alerted_at`/`notified_at`을 쓰는 방법과 **알림 발송 단계(①b)** 없음 | RPC를 추가할지(15->17, 되읽기 기대 행 수 변경) 직접 UPDATE로 갈지 한 줄로 정하고, 송출 틱 맨 앞(스위치와 무관)에 "알림 필요 + `alerted_at` NULL" 행을 찾아 보내는 단계 추가 |
| 2 | `alerted_at` 초기화가 `dist_mark`에만 있음 | `content_distributions`에 BEFORE UPDATE 트리거: `status` 변경 시 `alerted_at := NULL` |
| 3 | `failed_terminal`의 "`attempts = max_attempts`"는 `dist_mark`에 `max_attempts` 인자가 없어 불가 | `next_attempt_at = NULL`만으로 점유 조건에서 자동 제외되므로 "attempts = max" 문구 삭제 |
| 4 | `sendAdminAlert`에 `to` 인자 **없음**(코드로 확인: 수입처가 `OPS_ALERT_EMAIL` 또는 `info@oxxovo.ai` 하나) | 공용 파일에 선택 인자 `to?` 추가로 확정 |
| 5 | 시간 예산 숫자(240초/60초)를 문서에 고정 | 선언한 `maxDuration`에서 코드가 계산, "한 건 처리 시간" 기준을 상수·`platform_config` 키로 |
| 6 | `dist_mark(result='skipped')`의 용도 불명 | 쓸 곳이 없으면 변환표에서 삭제 |

더빙 항목은 방향이 맞고 두 곳 정정을 요청했다: (a) "유튜브 `news_dispatch_enabled`"라는 스위치는 없음(스위치는 DBA별) -> "DBA 송출 스위치"로, YouTube만 막으려면 수입 요청의 `allowed_platforms`에서 `youtube`를 뺀다. (b) Studio 메뉴 경로는 지수가 확인하지 못함(공식 도움말에서 확인된 것은 "Publish manually" 선택까지).

## 10. 인계 메모 (이어받는 사람용)

**먼저 알 것**
- **설계서 정본은 본부가 보관한 최종 j이고, 지수는 최종 h까지만 받았다.** 따라서 `reports/phase1_design_2026-10-04.md`는 **이 커밋에 없다.** 본부가 최종 j(또는 파일)를 주면 위 경로에 저장하고 9절 표로 다시 대조할 것. 저장 전에 다른 판을 그 파일명으로 저장하지 말 것(판이 섞인다).
- 코드·SQL 착수는 **본부 지시 전까지 하지 않는다**(오늘까지의 지시). 착수 허락이 오면 구현 순서는 설계서 §9의 ①~⑩.

**재개 순서 제안**
1. 이 파일 + 어제 파일(`jisu_hq_2026-10-03_eod.md`)을 읽는다.
2. 본부에서 최종 j를 받아 `reports/phase1_design_2026-10-04.md`로 저장한다(저장은 본부 확인 후, 커밋은 TK/본부 지시 후).
3. 9절의 6건이 반영됐는지 대조한다. 반영되면 "① SQL 작성 가능". **SQL은 반드시 채팅 본문으로**, 블록 하나에 쿼리 하나, ASCII 위주, 되돌리기는 별도 블록, 사전 조회는 **대조군 포함**(0행을 통과로 읽지 않기 위해).
4. SQL 규칙: `CREATE TABLE`과 `service_role` GRANT를 **같은 SQL에**(`deploy:prod`가 모든 public 테이블에 SELECT/INSERT/UPDATE/DELETE를 요구), `REVOKE ALL ... FROM anon, authenticated, PUBLIC` + RLS ON(정책 없음), 함수도 `REVOKE ... FROM PUBLIC, anon, authenticated` + `GRANT EXECUTE ... TO service_role` + `SET search_path`. 만든 직후 `pg_class.relacl`/`relrowsecurity`와 `pg_proc.proacl`/`proconfig`를 **되읽어** 확인(함수는 정확히 15행).
5. 코드를 쓰기 전에 `node_modules/next/dist/docs/`(동적 라우트·캐시)를 먼저 읽는다(AGENTS.md).

**작업 규칙(오늘 재확인)**
- **배포는 TK님이 `! npm run deploy:prod`**로. 지수는 권한 분류기에서 거부되며 우회 금지. 클린 트리 필수, `--allow-dirty` 금지.
- **서비스 키로 `platform_config` 같은 DB를 읽는 스크립트는 권한 분류기에 거부될 수 있다.** 필요하면 TK님이 읽기 전용 SQL을 Run하는 경로로.
- `vercel env pull`은 `POSTIZ_API_KEY`·`CRON_SECRET`·`SUPABASE_SERVICE_ROLE_KEY`를 **빈 문자열**로 준다(값 못 얻음). 값을 읽는 일은 하지 말 것.
- Git Bash에서 Vercel API 경로를 쓸 때 `MSYS_NO_PATHCONV=1`(경로가 Windows 경로로 변환됨).
- 안 맞다고 보이면 근거를 대고 반대할 것(TK 상시 지시). 모르면 모른다고.

**코드로 확인된 사실(재조사 없이 써도 되는 것)**
- Vercel **Pro**, 크론 프로젝트당 100개, 최소 1분. 현재 `vercel.json` 크론 5개.
- `sendAdminAlert(subject, html)`: 실패해도 던지지 않고 `false`, 수신처 `OPS_ALERT_EMAIL`||`info@oxxovo.ai`, `Auto-Submitted` 헤더로 inbound 루프 가드를 탄다.
- `lib/promo-schedule.ts`의 `nextPublishSlot()`: 순수 함수, IANA 시간대, DST 경계 오차는 주석에 "미리보기용 허용"(KST는 DST 없어 무관). `parseCadence`는 `promo_*` 키가 고정이라 새 파서가 필요.
- PG17 ACL 글자 `m` = MAINTAIN(TRUNCATE는 `D`), `information_schema.role_table_grants`는 MAINTAIN을 안 보여준다(`reference_pg_acl_maintain_and_info_schema` 메모리).
- YouTube 자동 더빙: 같은 영상의 **오디오 트랙**, 기본 자동 게시, "Publish manually" 선택 가능, 쇼츠 적용 여부는 문서에 없음.
- Postiz `POST /posts` 응답에 게시 URL 없음.
