# ⑩ 정상 송출 시험 -- 당일 실행표 (2026-10-10)

작성: 지수(메인, 앱 레포). 근거: 설계서 `reports/phase1_design_2026-10-04.md` §5-8, 코드·RPC SQL(아래 각 단계에 근거 표시), 본부 결정(2026-10-10: 16:9 필러박스 영상, 이번 1건만 `cleared`, 약관 미확인 비공개 1건 TK님 승인).
**이 표는 코드와 SQL을 읽고 만든 것이고 한 번도 실제로 돌려 본 적이 없다.** 라이브에서 처음 보는 항목은 각 단계에 "처음 보는 것"으로 표시했다.

## 0. 먼저 읽을 것

- **고정값:** `source_ref` = `step10-news-20261010`, `source_version` = 1, 출처 `news_desk`, 채널 `youtube` 하나, 영상 9,008,217바이트 `main_16x9` 1920x1080.
- **누가:** 🅣 = TK님(SQL Run·어드민 클릭·Studio·메일), 🅙 = 지수(로그 읽기 전용 확인), 🅗 = 본부, 🅝 = 뉴스 제니.
- **크론 틱은 5분마다, UTC로 매 `:00:14` `:05:14` `:10:14` ... 에 돈다**(실제 로그 `18:45:14` 형태). 어드민 화면은 PT(미국 서부, 항상 `PT` 붙음), 로그는 UTC.
- **SQL 규칙:** SQL Editor에서 **한 블록씩 따로 선택해서 Run**(여러 개를 한꺼번에 돌리면 마지막 결과만 보인다). 블록 하나에 쿼리 하나, 전부 한 줄. 값을 바꾸는 블록은 `returning`이 붙어 있어 바뀐 행이 바로 나오고, 바로 아래 되읽기 블록이 한 번 더 확인한다.
- **어디서 멈추나:** 각 단계의 "멈춤"이 나오면 **그 단계에서 더 진행하지 않는다.** 스위치(`news_dispatch_enabled`)가 열려 있는 동안 이상이 생기면 **무엇보다 먼저 `비상` 블록(11절)으로 스위치를 닫는다.** 닫은 뒤에 원인을 본다.
- **하지 말 것:** 배포, `CRON_SECRET` 교체, `[Re-dispatch]`(자동 재시도가 중복 게시를 부를 수 있다 -- 재시도 설정은 의도적으로 0회), 서비스 키 조회.
- **10-12(배포일) 결정(TK님):** 오늘은 수입 -> Hold -> B3(S2-1)·B4(S2-2)까지만. **스위치 열기(C4)·Dispatch(D)는 다음 날 이후.** `pg_trigger` 조회(`tgenabled='O'` 두 행)와 A5·A6는 **스위치 열기 직전에**(그날) 돌린다. SHA·`publish_at` 기대값도 그날 기준으로 읽는다(위 A1·B1).
- **스위치를 바꾸는 대안 경로:** 아래 SQL 대신 `https://www.oxxovo.ai/admin/settings`에서 같은 키를 수정해도 된다(그 경로는 변경자 이메일이 이력에 남고 `_enabled`는 확인창이 한 번 더 뜬다). **어느 쪽을 쓰든 되읽기로 값을 확인한다.**

## 1. 전체 순서 한 줄 요약

수입 전 점검 -> 뉴스 제니 수입 -> **즉시 [Hold]** -> 제목 `[시험]` -> 통과 조건 -> `per_tick`=1 -> `news_dispatch_enabled` 열기 -> 틱이 열린 상태를 보는지 확인 -> **[Dispatch]** -> 틱 `processed:1` 보이면 **즉시 스위치 닫고 `per_tick`=10** -> 결과 확인 -> Studio 확인 -> 삭제 -> **[Return]** -> 반송 메일 -> 본부 신호 -> 뉴스 제니 `rights-down` -> `blocked` 확인 -> 마무리.

---

## 2. A. 수입 전 점검 (수입 요청을 보내기 전에 끝낸다)

**A0. 배포 이력 확인 -- 이 표의 맨 앞 단계 (TK님 결정 2026-10-12: 배포와 ⑩은 같은 날 하지 않는다)** 🅙
- **규칙:** 새 사이트 배포(`npm run deploy:prod`)를 한 날에는 ⑩을 시작하지 않는다. 배포 **다음 날 이후**에 ⑩을 연다. (이유: alias 직후 크론 틱이 옛 배포를 탈 수 있고(10-07 실측), 배포가 기대 SHA를 바꾸며, 문제가 생겼을 때 원인이 배포인지 ⑩인지 가려지지 않는다.)
- **A0-1. 마지막 배포 후 경과 시간 (본부 승인 2026-10-12, 날짜 기준에서 변경):** `https://www.oxxovo.ai/api/version`의 `builtAt`(UTC)과 현재 UTC를 비교해 **경과 시간이 2시간 이상**이어야 한다(경과 시간을 계산해 기록). 그리고 **A0-2의 새 배포 틱이 시각 기준 연속 3회(15분) 이상** 확인돼야 한다. 둘 중 하나라도 미달이면 **여기서 멈추고 기다린다**(날짜가 바뀔 때까지 미루지 않는다). N=2시간·K=3회는 실측이 아니라 본부 판단(10-07 사건이 alias 후 13초였다는 근거)이다. 10-12 첫 적용은 경과 약 5.5시간·6틱 연속(EOD 10-12 §7).
- **A0-2. 새 `deploymentId` 틱:** 배포가 있었다면(A1의 SHA가 그날 기대한 SHA와 다름(10-12 배포 후 `55b45a0`)) 로그에서 **현재 라이브 배포의 `deploymentId`로 찍힌 틱**이 있는지 본다: `vercel logs --environment production --no-branch --since 15m --limit 300 --json -q "content-dispatch"` 후 행의 `deploymentId`를 모아 **전부 현재 배포 하나**여야 한다(옛 배포 id가 섞여 있으면 아직 이르다). 틱은 `"stage":"no_open_dba"`, `processed:0`, `warnings:[]`. 판정은 줄 수가 아니라 **시각**으로(5분 간격 `:x0:14`/`:x5:14`가 현재 배포 id로 두 번 이상 연속).
- **A0-3.** 이 확인 전에는 스위치(`news_dispatch_enabled`)를 **열지 않는다**(A1 이하는 읽기라 진행해도 되지만 H 이전에 A0-2가 끝나 있어야 한다).
- 통과하면 **A1에서 SHA 기대값을 그날의 새 SHA로 바꿔 읽는다**(실행표 A1·H의 SHA는 10-12 배포 후 `55b45a0`; 10-12에는 배포일이라 ⑩을 열지 않았고, 수입·Hold·S2-1·S2-2만 했다).

**A1. 라이브 버전** 🅙 -- `https://www.oxxovo.ai/api/version`
- 통과: **스위치를 여는 날 시작 시점의 라이브 SHA**(10-12 배포 후 현재 `55b45a0`, `dirty:false`). 이 문서를 쓴 10-10엔 `175855f`였다. 그 사이 배포가 또 있으면 새 SHA로 읽고 A0를 다시 적용한다.
- 멈춤: 다른 SHA -> 그동안 배포가 있었다는 뜻이다. **스위치를 열기 전에 새 배포의 `deploymentId`로 찍힌 틱을 로그에서 확인**해야 한다(alias 직후 틱이 옛 배포를 탈 수 있음, 10-07 실측). 지수가 확인하기 전까지 진행하지 않는다.

**A2. 어드민 스위치 줄** 🅣 -- `https://www.oxxovo.ai/admin/contents` 상단 `Dispatch switches`
- 통과: `Master Open` · `Daily Closed` · `Entertainment Closed`(화면 표기 순서는 Master · Entertainment · Daily일 수 있다). 목록이 `No matching content.`(probe- 행 숨김)이면 정상 -- 수입 전이다.
- **정상으로 보이는 경고 한 줄:** `Retry settings are missing, so a failed dispatch goes straight to "Needs action" with no automatic retry (content_dispatch_max_attempts, content_dispatch_backoff_base_minutes).` -- 재시도 키를 일부러 두지 않은 상태이고 ⑩은 **재시도 0회로 간다**(자동 재시도가 중복 게시를 부를 수 있다, 설계서 §12 미결 1b). 이 줄이 있어도 멈추지 않는다.
- 멈춤: Daily 또는 Entertainment가 Open -> 누가 열었는지 먼저 확인. 또는 경고가 `Dispatch settings missing — nothing is being dispatched right now.`(필수 키 `content_dispatch_per_tick`/`content_dispatch_max_bytes_default` 누락) 또는 `The settings could not be read.`/`Could not read the dispatch switch state.`면 멈춘다.

**A3. 설정 값 조회** 🅣 (블록 `P-CONFIG`)
```sql
select key, value, updated_at from public.platform_config where key in ('social_dispatch_enabled', 'news_dispatch_enabled', 'entertainment_dispatch_enabled', 'news_publication_enabled', 'entertainment_publication_enabled', 'competition_publication_enabled', 'content_dispatch_per_tick', 'content_dispatch_max_bytes_default', 'content_youtube_visibility', 'watch_as_home') order by key;
```
- 통과: `social_dispatch_enabled=true`, `news_dispatch_enabled`·`entertainment_dispatch_enabled`·`news_publication_enabled`·`entertainment_publication_enabled`·`competition_publication_enabled`·`watch_as_home` 전부 `false`, `content_dispatch_per_tick=10`, `content_dispatch_max_bytes_default=104857600`. `content_youtube_visibility`는 **행이 없는 것이 정상**이다(A7 결정 -- 넣지 않음, 그래서 9행).
- 멈춤: 위와 다른 값, 특히 공개 스위치(`*_publication_enabled`)가 `true`.

**A4. Postiz YouTube 채널 키** 🅣 (블록 `P-CHANNEL`) -- **두 번 연달아 Run**
```sql
select key, length(key) as key_len, length(value) as val_len, (value ~ '\s') as has_ws, (value <> '') as nonempty, updated_at from public.platform_config where key like 'postiz_channel_%' order by key;
```
- 통과: 두 번 모두 4행, `postiz_channel_youtube`는 `key_len=22`·`val_len=25`·`has_ws=false`·`nonempty=true`, 두 번의 결과가 같다.
- 멈춤: 행 수·길이가 두 번 다르거나 `youtube`가 0행/빈 값 -> 이 결과와 쿼리 원문을 EOD에 붙이고 진행하지 않는다(10-07의 흔들림 재발).

**A5. 대기 행 0건** 🅣 (블록 `P-PENDING`)
```sql
select count(*) filter (where status = 'queued') as queued, count(*) filter (where status = 'sending') as sending, count(*) filter (where status = 'failed') as failed, count(*) filter (where status = 'unknown') as unknown, count(*) as total from public.content_distributions;
```
- 통과: `queued/sending/failed/unknown` 모두 0 (`total`은 기존 시험 행 8 안팎 -- 늘어났으면 어떤 행인지 본다).
- 멈춤: 0이 아닌 값.

**A6. 다른 송출 후보 0건** 🅣 (블록 `P-CAND`)
```sql
select c.source_ref, c.status, c.rights_status, c.publish_at, d.platform, d.status as dist_status from public.content_distributions d join public.contents c on c.id = d.content_id where c.kind = 'news' and c.status = 'scheduled' and c.rights_status = 'cleared' and d.status = 'queued' order by c.publish_at;
```
- 통과: **0행**(이번 건은 아직 수입 전).
- 멈춤: 1행 이상 -> 이번 건 말고 `cleared`로 들어온 뉴스가 있다. 스위치를 열면 그것이 먼저 나갈 수 있다.

**A7. 넣지 않음 -- 코드 기본값 `private`에 의존, Studio에서 비공개를 눈으로 확인** (본부 결정 2026-10-10)
- 행동: **없음.** `content_youtube_visibility` 행을 만들지 않는다(시험 중 설정 쓰기를 하나라도 줄이는 원칙). 코드는 이 키가 없거나 이상한 값이면 `private`으로 보내고, 송출 직전 재확인 때마다 새로 읽는다.
- 통과: A3 조회(`P-CONFIG`)에 `content_youtube_visibility` 행이 **없다**(9행). 행이 생겨 있으면 값을 확인한다.
- 멈춤: 행이 있는데 `private`이 아니다 -> 누가 넣었는지 확인하기 전에는 스위치를 열지 않는다.
- 이 기본값이 실제로 비공개를 만드는지는 **E2(Studio에서 `Visibility = Private` 눈 확인)** 가 검증한다. 이 시험이 그것을 처음 확인한다.

---

## 3. B. 수입 -> 즉시 정지

**B1. 수입 실행** 🅝 -- 규격 `reports/import_spec_news_2026-10-10.md`
- 통과: 응답 `201`, `status`가 `scheduled`(`publish_at`은 서버가 설정 `news_publish_weekdays/time/timezone`의 **다음 슬롯**으로 정한다 -- 값은 통과 조건이 아니고 응답·S2에서 읽어 기록만 한다) 또는 `held`(`late_for_slot`), `channels`에 `youtube`가 `queued` **한 줄**. 응답의 `id`를 🅗에게 전달. **응답에 `thumbnail`이 보이거나(에셋을 보냈다는 뜻) 이후 B3에서 `thumbnail` 행이 나오면 멈춤.**
- 멈춤: `201`이 아님(오류 코드를 🅗에게) / `channels`에 youtube 말고 다른 행이 있거나 `skipped_*` -> **스위치를 열지 않는다.**
- 이 단계 후 🅝는 이 콘텐츠에 손대지 않는다.

**B2. 즉시 [Hold]** 🅣 -- `https://www.oxxovo.ai/admin/contents`
- 행동: 필터 `DBA`=Daily로 좁히고 뉴스 제니가 알려 준 제목으로 카드를 찾는다. 카드의 **`Hold`** 버튼을 누른다.
- 통과: 카드 상태가 `Held`, 사유 `Hold reason — Held manually`.
- 멈춤: `Not allowed from the current status (...)` 등 오류 -> 상태를 🅗에게 알린다. 이미 `Held`(late_for_slot)면 이 단계는 건너뛴다.
- 근거: `content_hold`(`phase1_step3_rpc_2026-10-05.sql:398-418`)가 상태만 `held`로 바꾸고 `publish_at`은 안 건드린다. 정지된 콘텐츠는 `dist_claim`이 집지 않는다(`status='scheduled'` 요구).

**B3. 수입 결과를 DB로 확인** 🅣 (블록 `S2-1`)
```sql
select c.source_ref, c.source_version, c.form, c.status, c.rights_status, c.created_at, a.role, a.bytes, round(a.bytes / 1048576.0, 1) as mb, a.duration_sec, a.width, a.height, (a.url is not null) as has_url, (a.sha256 is not null) as has_sha from public.contents c left join public.content_assets a on a.content_id = c.id where c.source_ref = 'step10-news-20261010' order by a.role;
```
- 통과: **1행**(에셋 `main_16x9` 하나). `source_version=1`, `form=short`, `status=held`, `rights_status=cleared`, `bytes=9008217`, `mb=8.6`, `width=1920`, `height=1080`, `duration_sec=31.02`, `has_url=true`, `has_sha=true`. **⑩ 시험은 썸네일 없이 영상 1개만 수입한다**(본부 결정 2026-10-12, 뉴스·세종에도 전달됨).
- 멈춤: **`thumbnail` 행이 있으면 지시와 다른 것이니 멈춘다**(스위치를 열지 않고 🅗에게). 그 밖에 행이 2개 이상 또는 `main_*`가 2개, 값 불일치, `has_url`/`has_sha`가 `false`, `status`가 `held`가 아님. `sha256` 컬럼 오류가 나면 마지막 컬럼 `(a.sha256 is not null) as has_sha`만 빼고 다시 돌린다.

**B4. 송출 행 확인** 🅣 (블록 `S2-2`)
```sql
select c.source_ref, c.source_version, c.status as content_status, c.rights_status, d.platform, d.status as dist_status, d.scheduled_at from public.content_distributions d join public.contents c on c.id = d.content_id where c.source_ref = 'step10-news-20261010' order by d.platform;
```
- 통과: **정확히 1행**, `platform=youtube`, `dist_status=queued`, `content_status=held`.
- 멈춤: 행이 2개 이상 또는 `youtube`가 아님 또는 `skipped_*` -> 스위치를 열지 않는다. (`dist_claim`은 플랫폼을 고르지 않으므로 다른 플랫폼 행이 먼저 나갈 수 있다.)

**B5. 제목을 `[시험]`으로** 🅣 -- 카드의 **`Edit metadata`**
- 행동: `Title`을 `[시험] 2026-10-10 ` + 원래 제목으로 바꾸고 **`Save`**. (`Description`/`Caption`은 그대로.)
- 통과: 카드 제목이 바뀌었다. **YouTube 제목은 이 값에서 만들어지며 2~100자**(100코드포인트로 잘림)이므로 접두어를 포함해 100자 이내로 한다.
- 멈춤: `The title cannot be empty` / `Nothing changed` 등 오류.
- 근거: 접두어를 코드가 아니라 어드민 수정으로 넣는 것은 설계 결정(§5-8), `contents_history`에 변경자가 남는다.

**B6. 감사 기록 확인** 🅣 (블록 `S3-5`)
```sql
select h.changed_at, h.field, h.old_value, h.new_value, h.changed_by_email from public.contents_history h join public.contents c on c.id = h.content_id where c.source_ref = 'step10-news-20261010' order by h.changed_at;
```
- 통과: `status`(scheduled -> held), `title`(원래 -> `[시험] ...`) 변경이 보이고 `changed_by_email`이 TK님.
- 멈춤: 기대하지 않은 `rights_status` 변경 행.

**B7. (한 번만 보는 화면 확인)** 🅣 -- 카드가 처음 목록에 뜬 지금, 설계서 §5-8 체크리스트를 눈으로 대조한다. 시각 형식 `Oct 7, 2026, 14:30 PT` 모양(24시간제, `PT` 붙음, 오전/오후 없음) · 버튼 이름 `Hold / Hide / Return / Dispatch / Restore to hold / Unhide / Edit metadata / Edit dispatch time` · 송출 줄 상태 이름. **어긋나면 적어 두고 진행은 계속한다**(표시 문제이고 송출 안전과 무관). **처음 보는 것.**

---

## 4. C. 스위치 준비

**C1. `content_dispatch_per_tick`을 1로** 🅣
```sql
update public.platform_config set value = '1' where key = 'content_dispatch_per_tick' returning key, value, updated_at;
```
- 되읽기:
```sql
select key, value, updated_at from public.platform_config where key = 'content_dispatch_per_tick';
```
- 통과: 1행, `value=1`, `updated_at`이 방금 시각(트리거가 갱신).
- 멈춤: 0행(키 없음) 또는 값이 1이 아님.
- 복원하는 것을 **잊지 않는다**: 이 값이 `1`인 동안은 평소 송출도 한 건씩만 나간다. 복원은 `D6`.

**C2. 다른 후보 재확인** 🅣 -- 블록 `P-CAND`(2절 A6)를 다시 Run
- 통과: **0행**(이번 건은 `Held`라 안 나온다).
- 멈춤: 1행 이상.

**C3. 채널 키 재확인** 🅣 -- 블록 `P-CHANNEL`(A4)을 다시 Run (두 번)
- 통과: A4와 같은 결과. 멈춤: 달라짐.

**C4. `news_dispatch_enabled` 열기** 🅣 -- **이 시점부터 열려 있는 시간이 있다. 시간을 재기 시작한다.**
```sql
update public.platform_config set value = 'true' where key = 'news_dispatch_enabled' returning key, value, updated_at;
```
- 되읽기:
```sql
select key, value, updated_at from public.platform_config where key = 'news_dispatch_enabled';
```
- 통과: `value=true`. (`social_dispatch_enabled`(마스터)는 이미 `true`.)
- 멈춤: 0행.

**C5. 어드민 스위치 줄과 틱** 🅣 `https://www.oxxovo.ai/admin/contents` 새로고침 / 🅙 로그
- 통과: 줄이 `Master Open · Daily Open · Entertainment Closed`. 🅙가 **다음 틱**(다음 `:x0:14`/`:x5:14`)을 읽어 **`"stage":"ran"`, `"processed":0`, `"stopped":null`, `"warnings":[]`**(이번 건이 `Held`라 집을 것이 없다). 로그 조회: `vercel logs --environment production --no-branch --since 15m --limit 300 --json -q "content-dispatch"`. 판정은 줄 수가 아니라 **시각**으로. 이 틱의 `deploymentId`가 A1에서 확인한 배포와 같아야 한다.
- 멈춤: `processed`가 0이 아님 / `stage`가 `config`·`unreadable` / `warnings`에 값 -> **즉시 `비상`(11절)** 후 🅗에게.
- **처음 보는 것:** 송출 스위치가 열린 틱의 로그 모양.

---

## 5. D. 송출

**D1. [Dispatch]** 🅣 -- 카드의 **`Dispatch`** 버튼
- 확인창 제목 `Add to dispatch queue`. 읽는다:
  - `Channels: youtube` 가 있다.
  - `This puts it in the dispatch queue. If the switches are open it goes out within about 5 minutes.` 가 있다.
  - **없어야 하는 줄:** `...larger than the dispatch limit...`, `An earlier version was already dispatched...`, `The master dispatch switch is closed.`, `The daily dispatch switch is closed.`, `It will only be queued.`
- 통과: 필수 줄만 있다 -> **`Add to queue`** 를 누른다.
- 멈춤: 없어야 하는 줄이 하나라도 있으면 **`Cancel`** 하고 🅗에게.
- 근거: `content_release`(`step3:424-461`)가 `held`를 `scheduled`로 바꾸고 **`publish_at = now()`로 덮어쓴다.** 월요일 슬롯은 영향이 없다.

**D2. 큐 확인** 🅣 (블록 `S3-1`)
```sql
select c.source_ref, c.source_version, c.status as content_status, c.rights_status, c.publish_at, d.platform, d.status as dist_status, d.attempts, d.external_id is not null as has_ext_id from public.content_distributions d join public.contents c on c.id = d.content_id where c.source_ref = 'step10-news-20261010' order by d.platform;
```
- 통과: `content_status=scheduled`, `publish_at`이 방금 시각 안팎, `youtube / queued / attempts 0`.
- 멈춤: 행이 다르거나 `held` 그대로.

**D3. 블록 `P-CAND`(A6)를 Run** 🅣 -- 이번엔 이번 건이 보여야 한다.
- 통과: **정확히 1행**, 이번 건(`step10-news-20261010`, `youtube`, `queued`).
- 멈춤: 2행 이상 -> **`비상`(11절)** 으로 스위치를 닫고 🅗에게.

**D4. 틱을 기다린다** 🅙 -- 다음 `:x0:14`/`:x5:14`
- 통과: `"processed":1`이 찍힌다. 가능하면 같은 틱의 시각(시작·끝)을 적는다(항목 예산 120초 실측용).
- 멈춤: **틱 2번(최대 약 10분)이 지나도 `processed:0`** -> 🅣가 C4의 반대(11절 `비상`)로 스위치를 닫고 🅗에게. `processed:0`인 이유는 코드 읽기로는 추정만 된다(처음 보는 것).

**D5. 즉시 스위치 닫기** 🅣 -- **`processed:1`을 🅙가 알린 순간**
```sql
update public.platform_config set value = 'false' where key = 'news_dispatch_enabled' returning key, value, updated_at;
```
- 되읽기:
```sql
select key, value, updated_at from public.platform_config where key = 'news_dispatch_enabled';
```
- 통과: `value=false`. 어드민 줄이 `Daily Closed`.
- 멈춤: `false`가 아님 -> 다시 Run, 안 되면 `https://www.oxxovo.ai/admin/settings`에서 같은 키를 닫는다.

**D6. `per_tick` 복원** 🅣
```sql
update public.platform_config set value = '10' where key = 'content_dispatch_per_tick' returning key, value, updated_at;
```
- 되읽기:
```sql
select key, value, updated_at from public.platform_config where key = 'content_dispatch_per_tick';
```
- 통과: `value=10`. 멈춤: 10이 아님.

**D7. 결과 확인** 🅣 (블록 `S3-3`)
```sql
select d.platform, d.status, d.attempts, d.external_id, d.external_title, d.caption_sent, d.external_url, d.published_at, d.last_error from public.content_distributions d join public.contents c on c.id = d.content_id where c.source_ref = 'step10-news-20261010';
```
- 통과: `youtube / posted`, `attempts=1`, `external_id` 값 있음, `last_error` 비어 있음, `published_at` 있음. `external_url`은 **비어 있어도 정상**(송출 직후 Postiz 응답에 URL이 없다, 설계서 §5-4).
- **이어서 블록 `S3-1`(D2)을 한 번 더 Run:** `content_status=scheduled`가 그대로인지 본다(반송 F1의 전제). 아니면 F1 전에 🅗에게.
- `external_id`와 `caption_sent`, `external_title`을 **그대로 적어 둔다**(E단계 대조용).
- 멈춤(상태별):
  - `failed`: **`Re-dispatch`를 누르지 않는다.** `last_error`를 적어 🅗에게. 스위치는 이미 닫혔다. 올라가지 않았다는 뜻이지만 Studio에 같은 제목이 있는지 E단계로 확인한다.
  - `unknown`(`Needs review`): Studio와 Postiz를 먼저 확인. 올라갔으면 어드민 `Mark dispatched`, 없으면 🅗 판단. `sending`이 360초 넘게 남으면 `unknown`으로 정리되고 알림 메일이 간다.
  - `queued` 그대로: 틱이 안 집었다 -> D4의 멈춤.

**D8. 틱 로그 기록** 🅙
- 해당 틱의 `processed`·`warnings`·`stopped`·시각, 이후 틱이 다시 `no_open_dba`로 돌아온 것(스위치가 닫혔다는 증거)을 기록한다.
- 이 틱 뒤에 `news_dispatch_enabled`가 `false`인지는 D5 되읽기로 이미 확인했다.

---

## 6. E. Studio 확인과 삭제

**E1. 영상 찾기** 🅣 -- `https://studio.youtube.com` -> OXXOVO 채널 -> `Content`
- 행동: 제목이 `[시험] 2026-10-10 ...`인 영상을 찾는다(업로드 후 처리에 몇 분 걸릴 수 있다).
- 통과: 영상이 있다.
- 멈춤: 10분이 지나도 없다 -> 올라가지 않은 것일 수 있다. 🅗에게(DB는 `posted`인데 Studio에 없으면 중요한 발견이다).

**E2. 가시성 확인 (가장 먼저)** 🅣
- 통과: **Visibility = `Private`**.
- 멈춤: `Public`/`Unlisted` -> **즉시 Studio에서 `Private`로 바꾼 뒤** 🅗에게. 이것이 이 시험의 핵심 발견이다("Postiz가 `type:private`을 받아 실제로 비공개로 올리는가").

**E3. 항목 기록** 🅣 -- 아래를 적어 🅗에게 전달한다.
- 제목이 `[시험] 2026-10-10 ...`인가(100자에서 잘렸는가).
- **설명(Description)에 무엇이 들어갔는가**(DB `caption_sent`와 같은가, 비었는가) -- 이것이 "설명 들어간 방식"이다.
- 길이, 가로 영상으로 보이는가(좌우 여백), Shorts로 분류되지 않았는가.
- Audience/아동용 설정, AI 생성물 표기(변경된 콘텐츠) 항목의 현재 상태, 자동 더빙 꺼짐.
- 통과: 기록이 끝났다. (값이 기대와 달라도 멈춤은 아니다 -- 발견으로 기록한다.)

**E4. postId 일치** 🅣 + 🅙
- 대상: DB `external_id`(D7에서 적은 값)와 Postiz가 그 게시물에 쓰는 id.
- 방법: Postiz 화면에서 게시물 id가 보이면 비교한다. **보이지 않으면 🅙가 읽기 전용 조회로 확인 방법을 정한다.** 이 실행표는 확인 방법을 확정하지 못했다.
- 통과: 같은 문자열. 다르면 두 값을 그대로 적는다. **Postiz 삭제 API는 호출하지 않는다**(이미 올라간 YouTube 영상까지 지우는지 문서에 없다).

**E5. 삭제** 🅣 -- Studio에서 해당 영상 `⋮` -> `Delete forever` -> 확인
- 통과: 목록에서 사라지고 영상 링크가 열리지 않는다.
- 멈춤: 삭제가 안 되면 **다음 단계(반송)로 가지 않는다.** "못 지우면 이 시험을 하지 않는다"가 설계서 §5-8의 조건이다. 🅗에게.
- Postiz 쪽 기록 정리는 선택이다(DB 상태와 무관).

---

## 7. F. 반송과 알림 메일

**F1. [Return]** 🅣 -- `https://www.oxxovo.ai/admin/contents` 카드의 **`Return`**
- 프롬프트 `Enter the return reason (required, up to 2000 characters)`에 `⑩ 시험 게시, YouTube에서 삭제함` 입력 후 확인.
- 통과: 카드가 `Returned`, `Return reason — ⑩ 시험 게시, YouTube에서 삭제함`.
- 멈춤: `Not allowed from the current status (...)`. (반송은 `scheduled`/`held`/`hidden`에서만 된다. 송출 뒤에도 콘텐츠가 `scheduled`로 남는다고 SQL을 읽고 추정했으나 라이브로 본 적이 없다 -- **D7 직후 블록 `S3-1`(D2)을 한 번 더 Run해 `content_status`를 확인**해 두면 여기서 막히지 않는다.)
- 근거: `content_return`(`step3:467-497`)이 `queued` 행만 `cancelled`로 바꾼다. 이미 나간 게시와 `sending` 행은 건드리지 않는다.

**F2. 상태와 이력 확인** 🅣 -- 블록 `S3-1`(D2)과 `S3-4`
```sql
select pl.created_at, pl.platform, pl.attempt_no, pl.result, pl.reason, pl.http_status from public.content_publish_log pl join public.contents c on c.id = pl.content_id where c.source_ref = 'step10-news-20261010' order by pl.created_at;
```
- 통과: `S3-1`에서 `content_status=returned`, 송출 행은 `youtube / posted` 그대로. `S3-4`에서 송출 시도 기록(`sent` 등)이 D7의 `attempts=1`·시각과 맞는다.
- 멈춤: 시도 기록이 2건 이상이면 중복 송출 가능성 -> 🅗에게.
- 그다음 `S3-5`(B6)를 다시 Run해 `status` 변경(`scheduled -> returned`)과 변경자를 본다.

**F3. 반송 알림 메일** 🅣 -- 받는 곳 **`info@oxxovo.ai`만**(TK님 개인 메일은 대상이 아님)
- 다음 틱(최대 5분) 뒤에 도착한다.
- 통과: 제목 `[OXXOVO] 1 content item(s) returned`, 첫 줄 `Returned: ⑩ 시험 게시, YouTube에서 삭제함`, 링크가 `.../admin/contents?status=returned`. 🅙가 같은 틱의 로그에서 `"returnedNotified":1`을 확인한다.
- 멈춤: 2틱(10분) 뒤에도 메일이 없다 -> 🅙가 로그의 `warnings`(`return_notice_failed`, `return_notify_list_failed`)를 읽는다. **다시 반송하지 않는다**(알림 한 번 더 가는 한계가 있다).
- **처음 보는 것:** 반송 알림 메일의 실제 발송. 이 시험이 처음 돌린다.

**F4. 알림 기록 확인** 🅣 (블록 `S3-6`)
```sql
select c.status, c.returned_at, c.returned_notified_at, (c.returned_notified_at >= c.returned_at) as notified from public.contents c where c.source_ref = 'step10-news-20261010';
```
- 통과: `returned_notified_at`이 채워졌고 `returned_at`과 같다(읽을 때 본 `returned_at`을 쓰는 설계), `notified=true`.
- 멈춤: `returned_notified_at`이 비어 있는데 메일이 왔다 -> 다음 틱에 메일이 한 번 더 간다(알려진 한계). 기록만 하고 진행.

---

## 8. G. 권리 내리기

**G1. 신호** 🅗 -> 🅝 -- "이제 `rights-down`(blocked)을 호출하세요." 대상: `source_ref=step10-news-20261010`, `source_version=1`. **F단계(반송과 메일)가 끝나기 전에는 보내지 않는다.** 송출 전에 보내면 시험이 막힌다.

**G2. 호출** 🅝 -- `POST https://www.oxxovo.ai/api/contents/rights-down`, 본문 `rights_status:"blocked"`, `rights_reason`은 비어 있지 않게(규격 7절).
- 통과: 응답 `200`, `outcome:"lowered"`, `rights_status:"blocked"`, `status:"returned"`(이미 반송된 상태는 그대로), `cancelled:0`, `posted`에 youtube 한 건.
- 멈춤: `400 rights_up_denied`(값이 restricted/blocked가 아님), `404 not_found`(ref/버전 불일치) -> 🅗에게. **`cleared -> blocked` 직행은 라이브에서 처음 본다**(코드·트리거로는 허용 확인, 10-06 시험은 어느 값이었는지 기록 없음).

**G3. blocked 확인** 🅣 -- 블록 `S3-1`(D2)
- 통과: `content_status=returned`, **`rights_status=blocked`**.
- 멈춤: `rights_status`가 `cleared` 그대로 -> 🅝가 호출하지 않았거나 실패했다.

---

## 9. H. 마무리 점검

**H1. 스위치와 설정** 🅣 -- 블록 `P-CONFIG`(A3)를 다시 Run
- 통과: A3와 같다 -- `news_dispatch_enabled=false`, `content_dispatch_per_tick=10`, 공개 스위치 전부 `false`, `social_dispatch_enabled=true`.
- 멈춤: 하나라도 다르면 즉시 되돌린다(`비상`).

**H2. 후보·대기 없음** 🅣 -- 블록 `P-CAND`(A6)와 `P-PENDING`(A5)
- 통과: `P-CAND` 0행, `P-PENDING`의 `queued/sending/failed/unknown`이 모두 0.

**H3. 크론이 닫힘으로 돌아왔다** 🅙
- 통과: 스위치를 닫은 뒤의 틱이 `"stage":"no_open_dba"`, `processed:0`, `warnings:[]`.

**H4. 공개 화면은 그대로 닫혀 있다** 🅙 -- `www`에서 `/news /drama /film /cf /music /music-video /ads`와 `/c/<콘텐츠 id>`가 404.
- 통과: 전부 404. (404가 "닫힘"인지 "경로 없음"인지 이 호출로는 구분이 안 된다는 한계가 있다.)

**H5. 기록** 🅙 -- EOD에 아래를 남긴다. 성공만 적지 않는다.
- 각 단계의 통과/멈춤 결과와 시각(UTC), 쿼리 원문과 결과.
- 확인한 한계 항목: Postiz `type:private`이 실제 비공개였는가 · `postId`가 삭제용 id와 같은가 · 설명이 어떻게 들어갔는가 · 항목 예산 120초와 메모리 100MB 실측(틱 시각 차) · 알림 메일 실제 발송과 `returned_notified_at` · 어드민 화면 체크리스트 · `cleared -> blocked` 직행.
- 이 표에서 틀렸던 부분(예상과 다르게 나온 것).

---

## 10. 결과가 예상과 다를 때 (요약)

| 나온 것 | 하는 일 |
|---|---|
| `processed:1`인데 DB `posted`가 아님 | 스위치는 이미 닫혔다. 재송출 금지. `last_error`·`dist_status`를 🅗에게 |
| Studio가 `Public` | 즉시 `Private`로 바꾸고 🅗에게 (핵심 발견) |
| Studio에 영상 없음 / DB는 `posted` | 올라가지 않았거나 다른 계정. 삭제·반송 하지 않고 🅗에게 |
| 삭제 불가 | 반송으로 넘어가지 않는다 |
| 반송 메일이 안 옴 | 로그 `warnings` 확인, 다시 반송하지 않는다 |
| 송출 행이 2개 이상 | 스위치를 열지 않는다 / 열었다면 즉시 닫는다 |
| 스위치가 안 닫힘 | `https://www.oxxovo.ai/admin/settings`에서 같은 키를 닫는다 |

## 11. 비상: 스위치를 닫는다 (이상하면 무엇보다 먼저)

```sql
update public.platform_config set value = 'false' where key = 'news_dispatch_enabled' returning key, value, updated_at;
```
- 되읽기:
```sql
select key, value, updated_at from public.platform_config where key = 'news_dispatch_enabled';
```
- 그다음 `per_tick`을 되돌린다(D6의 블록).
- **스위치를 닫아도 이미 `POST /posts`가 나간 뒤에는 못 멈춘다.** 새 점유만 즉시 멈춘다. 항목이 점유되어 준비 중이면 `POST /posts` 직전의 재확인에서 닫힘을 보고 `queued`로 돌아간다. 점유 중이던 함수가 죽으면 `sending` -> 360초 뒤 `unknown` + 알림.

---

## 12. 이 표가 확인하지 못한 것 (처음 보는 것 모음)

1. 송출 스위치가 열린 틱의 로그 모양(`stage:"ran"`)과 `processed:1`일 때의 필드.
2. `news_desk` 출처의 실제 수입(규격 파일은 `production_os` 시험 기준으로 만들었다).
3. 어드민 카드가 `source_ref`를 보여 주는지(제목으로 찾도록 적었다).
4. Postiz에서 게시물 id를 어떻게 읽는지(E4).
5. 반송 알림 메일의 실제 발송.
6. `cleared -> blocked` 직행의 라이브 동작.
7. 항목 예산 120초와 메모리 100MB는 틱 시각 차로만 짐작할 수 있고 정확한 메모리는 보이지 않는다.
8. **썸네일 에셋의 수입 경로**(presign -> PUT -> import에 `thumbnail` 역할). **⑩ 시험에서는 쓰지 않는다**(본부 결정 2026-10-12: 영상 1개만 수입). 코드와 단위 시험에는 있으나 라이브에서 돌린 적이 없다. 썸네일 행이 나오면 B3에서 멈춤.
9. D7 직후 `S3-1` 재확인 -- 송출이 끝난 뒤에도 콘텐츠가 `scheduled`로 남는다는 추정(F1의 전제). D7 본문에 단계로 넣었다.
