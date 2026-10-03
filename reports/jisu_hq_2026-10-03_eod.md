# EOD 2026-10-03 -- 지수(메인, 앱 레포) 작업 요약 + 인계

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문 그대로.
읽는 순서: 맨 아래 **"인계 메모"** 와 **"미해결"** 두 절만 먼저 읽으면 재개 가능.

## 0. 한 줄 요약

`update_platform_config` RPC가 8/15부터 **호출 자체가 불가능**했던(오버로드 2개 → `PGRST203`) 것을 찾아 고쳤고,
그 결과 `platform_config_history`가 7주간 0행이던 것이 오늘 처음 기록됐다. 이어서 `platform_config`에
**경로와 무관하게 남는 감사 트리거**를 걸었고, SQL 직접 쓰기까지 라이브에서 기록되는 것을 확인했다.
라이브는 `09e3580`, 대회 공개 스위치는 `competition_publication_enabled=false`(fail-closed)로 `/watch`는 404.

## 1. 한 일 -- 커밋

| 해시 | 내용 | 비고 |
|---|---|---|
| `dda5ea2` | 공개 스위치 fail-closed 2단계 | 본부 목록(이번 세션 이전) |
| `e6c0f70` | watch_as_home 토글 RPC화 + 실패 표시 | 같음. **`p_field` 누락으로 이것만으론 안 됐음** → `6e26125` |
| `6ddce16` | 거짓 성공 4건 수정 | 같음 |
| `cc3816d` | 어드민 "조용한 실패" 일괄 수정 (A3, A6-A8, A11-A14), 공통 훅 `lib/use-action-error.ts` | 본부 목록에 누락돼 있던 것을 이번에 확인(중복 작업 아님) |
| `43b0297` | `/watch` Staff Pick 토글 실패 표시 (별도 커밋) | 같음 |
| `6e26125` | 값 저장 RPC 호출 2곳에 `p_field: 'value'` 명시 | **오늘의 핵심 수정** |
| `cacaca2` | `outputs/`(2.2GB)를 `.gitignore` + `.vercelignore`에 추가 | 배포 게이트(클린 트리)와 업로드 방지 |
| `09e3580` | `reports/eslint_baseline_2026-10-03.md` | 기준선 71건 |
| `e9957ca` | `app/robots.ts` 주석만 (Allow+404가 의도라는 설명) | **푸시됨, 배포 전** |

이 파일을 포함한 커밋은 `git log -1 -- reports/jisu_hq_2026-10-03_eod.md`.

## 2. 배포

- `npm run deploy:prod` → **TK님이 `!`로 직접 실행**. 지수는 권한 분류기에서 "Production Deploy"로 거부됨(우회 안 함).
- 결과: **`09e3580`**, `dirty:false`, builtAt `2026-10-03T21:14:57Z`. 스크립트 자체 검증은 SSO 보호 페이지가 HTML을 줘서 실패했고, 실도메인 `/api/version`을 직접 curl로 확인함.
- 이후 `e9957ca`가 푸시됐으므로 라이브(`09e3580`)와 HEAD(`e9957ca`)는 **주석 한 덩어리만 다름**. 다음 배포 때 같이 감.
- 배포 전 게이트 통과: `service_role` 테이블 grant 점검 OK.

## 3. DB 변경 (전부 TK님 실행. 지수가 실행한 DB 쓰기는 0건)

시각은 UTC. 정확한 Run 시각을 기록하지 못한 것은 "시각 미기록"으로 둠.

| 변경 | 실행 | 내용 |
|---|---|---|
| 행 삽입 | HQ, 2026-10-03 19:48/19:49 | `platform_config`에 `competition_publication_enabled=false`, `news_publication_enabled=false` (bool) |
| `watch_as_home` | HQ, SQL 직접 UPDATE (배포 전) | `false`로 내림. `updated_at`은 8/19 그대로 → "updated_at 트리거 없음"의 1차 증거 |
| v1 함수 DROP | TK | `DROP FUNCTION public.update_platform_config(text,text,uuid,text)`. 의존 객체 없이 성공. **CASCADE 없이** |
| A1 | TK (시각 미기록) | `platform_config_touch()` 함수 |
| A2 | TK | `platform_config_audit()` 함수 (NULL 보호 `coalesce(..,'(null)')` 포함) |
| A3 | TK | `update_platform_config(text,text,uuid,text,text)` **v3**: 자체 history INSERT 제거, `app.pc_actor_id/email` 설정 |
| A4 | TK | `trg_platform_config_touch` BEFORE UPDATE |
| A5 | TK | `trg_platform_config_audit` AFTER INSERT/UPDATE/DELETE |
| 프로브 P1~P4 | TK, 23:15:08/23:15:25/23:15:41 | `__audit_probe__` INSERT→UPDATE→DELETE. 프로브 행은 삭제됨, **history 3행은 증거로 의도적으로 남김** |

**되돌리기 (역순으로, 한 번에 하나씩 Run, 같은 Run에 묶지 말 것)**
`DROP TRIGGER IF EXISTS trg_platform_config_audit ON public.platform_config;` →
`DROP TRIGGER IF EXISTS trg_platform_config_touch ON public.platform_config;` →
A3는 **v2 덤프 원문을 그대로 Run**(TK님이 블록 5 결과를 보관. 레포 `reports/settings_admin_schema_2026-08-15.sql` Part 2와 동일) →
`DROP FUNCTION IF EXISTS public.platform_config_audit();` → `DROP FUNCTION IF EXISTS public.platform_config_touch();`
A3만 되돌리고 A5를 남기면 history가 이중으로 쌓임.

## 4. 근본 원인 (확정)

- 라이브에 `update_platform_config` **오버로드 2개**: 4인자 v1 + 5인자 v2(`p_field DEFAULT 'value'`).
  `p_field` 없이 부르면 `PGRST203: Could not choose the best candidate function`.
- 8/15 SQL이 "시그니처 호환이라 DROP 불필요"라고 적었는데 틀림: **파라미터를 추가한 `CREATE OR REPLACE`는 교체가 아니라 새 오버로드**.
- 결과: 8/15~10/3 값 저장이 RPC로 한 번도 성공하지 못함. `platform_config_history` **0행**, 전 행 `updated_by` null.
- v1 본문은 멀쩡했음(함수가 틀린 게 아니라 **부를 수 없었던 것**).
- 오버로드 전수 조회: 이 하나뿐. 다른 함수에는 같은 함정 없음.
- `platform_config.updated_at`에는 **트리거가 없었음**(SQL 수정은 `updated_at`/`updated_by`/history 어느 것도 못 남김).
  → **이전 보고의 "watch_as_home은 8/19부터"는 "8/19 이후 변경 없음"의 근거가 못 됨. 정정함.**

## 5. 검증 결과 (라이브)

| 항목 | 결과 |
|---|---|
| 라이브 SHA | `/api/version` = `09e3580`, `dirty:false` |
| 어드민 경로 (watch-home 토글 on→off) | history 2행, `field='value'`, `false→true`(21:15:57), `true→false`(21:16:04), `changed_by`=TK uid(`9b5ceed5…`), `changed_by_email`=`tkckusa@gmail.com`, `updated_by` 채워짐. **8/15 이후 처음 기록된 설정 변경** |
| 어드민 경로 (settings 값 왕복, `championship_points_placeholder_rows`) | 21:42:33 `20→21`, 21:42:48 `21→20`, 값 20 복귀, 정확히 2행(이중 기록 없음), `updated_by` 채워짐, `updated_at` 21:42:48로 갱신 |
| V1 트리거 | 2행, 둘 다 `tgenabled='O'` (audit=INSERT/DELETE/UPDATE, touch=BEFORE UPDATE) |
| V2 함수 | **정확히 3행**(오버로드 안 늘었음). RPC는 `sets_or_reads_actor=true / touches_history=false` → **v3 확인**, `security_definer`는 RPC만 true |
| 프로브 (SQL 경로) | history 3행: `NULL→a`, `a→b`, `b→(row deleted)`, 전부 `changed_by=NULL`, `changed_by_email='db:postgres'`. P2의 `updated_at`이 P1보다 뒤로 이동(23:15:08→23:15:25), `updated_by` NULL. **트리거 단독 동작 증명** |
| RPC 호출 형태 3종 (`p_field` 없음/value/description_ko) | 존재하지 않는 키로 불러 모두 `P0001 unknown platform_config key`(모호성 없음) |
| fail-closed | `/watch`, `/watch/rankings` 404. env 층(`WATCH_PUBLIC_ENABLED="true"`)은 열려 있으므로 **지금 막는 것은 DB 행뿐** |

## 6. 조사 결과 (읽기 전용)

**노출 조사 -- 결론: 유출 없음 (단, 범위 한정)**
- Vercel 로그 보존 **약 30일**(가장 오래된 9/3, 34일 전부터 400). `requestPath` 정확 일치 조회, **고유 ID 기준**.
- `/watch` 200 **33건**(9/3~10/3 21:16), `/watch/rankings` 200 **106건**, `/api/watch/stats` 200 **103건 이상**(9/12·9/15 창이 50건에서 잘려 하한), `/watch-arena` 308 1건.
  즉 `/watch`는 대회 행(10/3 추가) 이전에는 계속 200이었고, 9/27 fail-closed 이후에도 행이 없는 동안은 fail-open이었음.
- **그러나 화면은 빈 화면이었음(데이터 기준 추정)**: `genesis_applications` 117건 전부 fixture 시즌(`season_test` 105, `season_test2` 12), 정식 시즌(`season_0`~`season_4`) **지원서 0건** → 공개 영상 0.
- 이 결론이 못 덮는 것: (a) fixture 시즌의 `watch_fixture_visible`은 SQL 수동 토글이고 **이력이 없어** 9/3~10/3 사이 잠깐 열렸는지 모름(8/28 true → 8/31 false 확인, 이후 불명). (b) `watch_views` 전체 1건(9/26 `season_test`)이 유일한 간접 증거로 약함. (c) 9/27 이전 `/watch/[id]` 직접 URL은 fixture 영상이 200이었다고 코드 주석이 적고 있으나 로그로 확인 못 함. (d) 로그에는 UA/IP/본문이 없어 누가 봤는지·무엇이 보였는지는 로그로 알 수 없음.
- 색인: TK님이 Google에서 `site:oxxovo.ai/watch` → "did not match any documents" 확인. 지수의 Bing/WebSearch 시도는 홈페이지조차 못 찾는 **대조군 실패**라 증거로 쓰지 않음.
- **robots.txt**: `Allow: /` + `/watch` 404는 **의도로 확정(옵션 B)**. Disallow는 이미 색인된 URL의 제거를 늦출 수 있고 재개 시 조치가 필요 없음. 주석으로 기록(`e9957ca`).
- 환경변수 `WATCH_PUBLIC_ENABLED` 프로덕션 값 `"true"`(약 47일 전 생성), `SITE_PUBLIC_ENABLED`는 빈 값. 값은 임시 파일로 읽고 **즉시 삭제**함.

**`updated_at` 12개 테이블 분류** (이 앱 레포 코드 기준, Railway 워커/scoring 레포의 쓰기는 **범위 밖**)

| 분류 | 테이블 |
|---|---|
| A. 코드가 쓰고 `updated_at`도 같이 씀 (코드 경로 한정) | `faq_items`(3/3), `generation_jobs`(5/5), `render_jobs`(6/6), `studio_characters`(1/1), `studio_music_assets`(4/4) |
| B. 누락·우회 | `platform_config`: `app/admin/promo/actions.ts:156`(`promo_publish_*` 3행 upsert, `updated_at` 안 씀 + history 우회). 상태 키 upsert(`alert_last_sent_*`, below-floor, pricing-health)와 `season-tick`의 `default_community_vote_weight`는 `updated_at`은 쓰지만 history 우회 |
| C. 앱 코드에 쓰기 없음, **수기 유지** (5개) | `model_catalog`, `official_actors`, `studio_presets`, `member_tier_config`, `pre_registrations`. 라이브에서 `updated_at≠created_at`: `model_catalog` 13/20, `official_actors` 1/1, `studio_presets` 8/8 → 사람/스크립트가 직접 씀 |
| D. 의미 없음 | `season0_dates_backup_20260927` (백업 스냅샷) |

- 트리거가 `updated_at`을 실제로 갱신하는 곳은 `admin_broadcasts`, `profiles`, `system_messages`, `season_recommendations` 4개뿐(`seasons`의 `trg_season_delivery_dates`는 배송일 계산용, `updated_at` 미갱신).
  `system_messages`만 레포에서 함수명 확인, 나머지 3개는 이름만 확인.
- 위험 순서: 가격·설정을 SQL로 고치는 `model_catalog`, `member_tier_config`. **지금은 손대지 않음**(platform_config 트리거가 자리잡은 뒤 같은 방식 적용 여부 검토).
- 부작용 메모: 트리거가 걸려서 `promo_publish_*` 편집과 `season-tick` 등 앱 코드의 `platform_config` 직접 쓰기도 이제 history에 **`db:service_role`**로 남음. `ALERT STATE%`로 시작하는 `description`의 상태 행은 제외됨.

**Phase 1 사전 확인 (읽기 전용)**
- `contents`, `publications`, `content_links`, `news_items`, `daily_news` 표는 라이브에 **없음**(이름 충돌 없음).
- 참가작은 영상 URL이 이미 둘(`free_entry_url`=예선, `main_round_video_url`=본선, 코드의 라운드 값은 `'application'|'main'`).
- 공개 여부는 `status`, `watch_hidden`, `watch_hold`, `moderation_status` **4컬럼 조합을 `isRowPublic()` 한 곳**에서 계산(`/watch`와 "공개됨" 이메일이 같은 규칙을 공유). 새 `publication_status`가 이것과 **두 번째 답이 되면 안 됨**.
- `promo_videos`: 93행, 컬럼 27개 전부 생성·발행 파이프라인용, `status` 전부 `ready`, `approved` 전부 `false`, `deleted_at` 소프트 삭제 5행. 상태 어휘가 달라 **흡수하지 않는 결정이 데이터로 뒷받침됨**.
- 참가작 117건이 전부 fixture라 **이행할 실데이터가 없음**(backfill 부담 없음). 117건 중 98건이 `watch_hidden=true`(테스트 데이터).

## 7. 오늘 기록해야 할 실패·정정 (지수 쪽)

- "watch_as_home은 8/19부터"를 변경 시점 근거로 쓴 것 → `updated_at`에 트리거가 없다는 걸 확인한 뒤 **정정**.
- 로그 보존을 **7일로 가정**했던 것은 틀림(약 30일). 이 가정으로 전수 조회를 먼저 설계했다가 폐기.
- `vercel logs`는 호출마다 **고유 50건 한 페이지를 반복**해서 채움. 처음 본 "4,300행", "/watch 404 184건"은 **중복 부풀림**이었음(보고하기 전에 발견해서 철회, 고유 ID 기준으로 재조회). 결과가 50건이면 잘림, 50건 미만이면 완전.
- 코드 스캔 스크립트의 정규식 역슬래시가 도구 전달 중 깨져 **집계가 전부 0으로 나온 적**이 있음(문자열 검색으로 교체). 스캔에서 `faq_items` 1건 **오탐**(`row` 객체 안에 `updated_at`)을 직접 읽어 정정.
- 배포를 지수가 직접 못 한 것(권한 분류기 거부)을 우회하지 않고 TK님께 넘김.

## 8. 미해결 (빠뜨린 것 없이)

1. **`description_ko` 분기 미검증.** 어드민 "설명(KO)" 저장 경로(RPC v3의 `description_ko` 분기 + 트리거의 두 번째 INSERT 분기)는 라이브 실행을 안 함. 본부가 번거로움을 줄이려 생략. 어드민을 쓰다 자연스럽게 검증되게 둠. **확인 방법**: `field='description_ko'` 행이 생기는지, `old_value→new_value`가 정확히 한 글자 차이인지.
2. **`ALERT STATE%` 제외는 라이브 미증명.** 현재 상태 행이 0건. 코드는 맞음(세 곳 모두 `description: 'ALERT STATE, not a setting. …'`를 같이 upsert). **첫 경고가 발동하면** V3로 확인:
   ```sql
   SELECT key, field, changed_at
   FROM public.platform_config_history
   WHERE key LIKE 'alert_last_sent_%' OR key LIKE '%below_floor%' OR key LIKE '%pricing_health%'
   ORDER BY changed_at DESC LIMIT 20;
   ```
   0행이어야 함. 행이 나오면 제외가 안 먹은 것.
3. **`e9957ca`(robots 주석)는 푸시됨, 배포 전.** 다음 배포 때 같이. 따로 배포하지 말 것.
4. **`updated_at` 트리거 없는 12개 중 C분류 5개** (`model_catalog`, `official_actors`, `studio_presets`, `member_tier_config`, `pre_registrations`)는 수기 유지. `member_tier_config`는 `created_at`이 없어 프로브가 안 됨.
5. **eslint 71건 기존 부채** (50 errors, 21 warnings). 기준선: `reports/eslint_baseline_2026-10-03.md`. 이번 수정 파일은 0건, 수정 전 상태에서도 71건으로 동일. 다시 돌려 이 파일과 diff.
6. **Phase 1 설계 대기.** 결정 필요: **공개 상태 4컬럼(`status`·`watch_hidden`·`watch_hold`·`moderation_status`) vs `publication_status`(draft/scheduled/live/hidden)** -- 대체할지 병존시킬지, 병존이면 우선순위. 설계서는 본부가 다시 씀. 앞서 반대 의견이 반영될 것(참가작은 contents로 옮기지 않고 nullable 링크만 / 영상이 둘이라 라운드 필요 / `kind` 컬럼+CHECK로 NULL 규칙 명시 / `promo_videos` 흡수 안 함).

**그 외 열려 있는 것 (우선순위 낮음)**
- 배포 게이트 오버로드 점검: SQL B1(`check_function_overloads()`)/B2(REVOKE+GRANT)는 설계·초안만 있고 **적용 안 함**. 코드(`scripts/check-function-overloads.mjs`, `deploy-prod.mjs` 연결)는 **SQL을 먼저 Run한 뒤에** 올릴 것(반대 순서면 배포가 막힘). 허용 목록은 빈 목록, RPC 호출 실패는 통과가 아니라 실패 처리.
- `watch_as_home`이 `value_type='text'`(9/27 기술 부채 2번): 스위치가 아니라 텍스트 입력칸으로 보임. `bool`로 바꾸려면 데이터 변경이라 **TK님 승인 필요**.
- `/watch/[id]` 직접 URL의 fixture 노출은 로그로 확인 불가(9/27 이전). 정확 일치 조회로는 개별 영상 경로를 못 뽑음.
- Railway 워커/scoring 레포의 `generation_jobs`/`render_jobs` 쓰기는 `updated_at` 점검 범위 밖.
- `seasons.updated_at`은 트리거 미갱신이라 신뢰 불가. `watch_fixture_visible`의 과거 이력은 어디에도 없음.
- 9/27 기술 부채 중 `reports/competition_publication_switch_2026-09-27.sql`(미실행)과 오늘의 `..._2026-10-03.sql`의 관계는 이번에 점검하지 않음.
- 지수 메모리에 오버로드·감사 기록 신뢰 원칙을 저장함(`feedback_function_overload_and_audit_trust.md`).

## 9. 인계 메모 (이어받는 사람용)

**현재 상태 (이 파일 작성 시점)**
- 레포 `main` = `origin/main`, 미커밋 없음. 라이브 = `09e3580`.
- 플래그: `competition_publication_enabled=false`, `news_publication_enabled=false`, `watch_as_home=false`. **건드리지 말 것**(재개는 `/admin/settings`에서 의도적으로).
- `platform_config`에 트리거 2개(touch/audit), `update_platform_config`는 **v3 한 벌**. 프로브 history 3행(`key='__audit_probe__'`)이 증거로 남아 있음. 지우지 말 것(지우면 기록 없이 감사 행을 지우는 것).

**작업 규칙 (본부 지시 + 오늘 확인)**
- 보고는 **한국어**. 틀렸다고 보이면 근거를 대고 반대할 것. 추측 대신 코드·로그·DB를 직접 볼 것. 모르면 모른다고.
- **배포는 TK님이 `! npm run deploy:prod`로 실행**(지수는 권한 분류기에서 거부됨, 우회 금지). 클린 트리 필수, `--allow-dirty` 쓰지 말 것.
- SQL은 **블록 하나에 쿼리 하나**, 채팅에 본문으로(레포 파일 경로 아님), **되돌리기 SQL은 별도 블록**(같은 Run에 묶지 말 것). DML은 `RETURNING`, ASCII 위주.
- **서비스 키 스크립트로 실제 어드민 ID를 `updated_by`/`changed_by`에 넣지 말 것**(감사 기록 오염). 행위자가 필요한 시험은 TK님이 UI에서 직접.
- 본부가 "네가 할 수 있는 조회·확인·실행은 TK님께 올리지 않는다. 못 하는 것만 올린다"고 지시함.
- Vercel: `vercel env ls`는 이름만, 값이 필요하면 임시 파일로 받아 **한 줄만 읽고 즉시 삭제**. `vercel logs`는 고유 ID로 dedupe, `-q "requestPath:<정확 경로>"`만 필터로 동작, 보존 약 30일.
- Next.js는 이 버전이 훈련 데이터와 다름(AGENTS.md): 코드를 쓰기 전에 `node_modules/next/dist/docs/` 확인.

**재개 순서 제안**
1. Phase 1 설계서가 오면: 위 6번(4컬럼 vs `publication_status`)과 "사전 확인" 절의 사실과 대조해 반대 의견·빠진 곳을 정리.
2. 설계에 반드시 넣을 것: ① 쓰기 경로 **라이브 1회 실행** 완료 조건(수동, 게이트 아님) ② `publication_status` 변경 감사는 호출 경로 무관 트리거 ③ `CREATE TABLE`과 `service_role` GRANT를 **같은 SQL**에(`deploy:prod` 게이트가 요구) ④ `kind`별 스위치(대회/뉴스) 연결과 fail-closed ⑤ 감사 트리거를 만들 때 대상 컬럼의 `NOT NULL`을 먼저 확인(오늘 `new_value` NOT NULL 때문에 NULL 보호를 넣은 것과 같은 종류).
3. 다음 배포 전: `npm run deploy:prod`는 TK님. 배포 후 `/api/version`을 직접 확인.
4. 첫 경고 발동 시 위 V3 실행(미해결 2번).

**스크래치 스크립트는 보존되지 않음**(세션 임시 폴더). 필요하면 다시 쓸 것: `platform_config`/`platform_config_history`는 서비스 키로 `.from().select()`, RPC 존재 확인은 존재하지 않는 키로 부르면 쓰기 없이 `P0001`.
