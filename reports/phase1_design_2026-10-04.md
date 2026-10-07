# OXXOVO Phase 1 설계서 (최종 k)

**2026-10-04 · 본부** (최종 k = 2026-10-05 반영)
근거: 사업계획서 v6 / 지수 실측 10-03 / TK 결정 10-04 / 제니2·뉴스 제니 합의

> 저장 메모(지수, 2026-10-05): 본부가 채팅으로 준 최종 k 본문을 그대로 옮겼다. 내용 수정 없음.

---

## 0. 한 줄

**본부 Admin이 Publishing Control Center다.**
제작은 Entertainment·Daily가, 배포 관제는 본부가 한다.

```
제작 완료 → 본부 Admin 수입 → 자동 송출 → 문제 시 정지·반송
```

**사전 승인이 아니라 사후 차단이다** (TK 결정 10-04).
담당자가 송출 전에 확인하고, 잘못됐으면 정지·반송한다.

---

## 1. 🔴 참가작과 완전 분리

| | 참가작 | 새 콘텐츠 |
|---|---|---|
| 표 | `genesis_applications` | `contents` |
| 공개 판정 | `isRowPublic()` (기존 4컬럼) | `status` + 조건 |
| 스위치 | `competition_publication_enabled` | DBA별 |

**참가작은 `contents`에 행을 만들지 않는다.**
링크 컬럼(`genesis_application_id`, `genesis_round`, `promo_video_id`)은
만들되 **지금은 항상 NULL**이다.

**대회 코드는 한 줄도 건드리지 않는다.**

---

## 2. 표

### 2-1. contents

| 칸 | 값 | 비고 |
|---|---|---|
| id | uuid | |
| **kind** | news / drama / film / cf / music / **music_video** | NOT NULL, CHECK IN |
| surface | video | CHECK IN (지금 값 하나) |
| source | news_desk / production_os | 시크릿이 결정 |
| source_ref | text | 출처의 production_id |
| **source_version** | int | NOT NULL, 기본 1 |
| title / description / caption | text | 셋을 분리 |
| **language** | ko / en / ja / ko-KR … | **NOT NULL, 기본값 없음** |
| form | short / long / full / trailer | 수입 코드 허용 목록 |
| **rights_status** | cleared / restricted / blocked | **NOT NULL, 기본값 없음** |
| **status** | scheduled / held / returned / hidden | NOT NULL |
| **publish_at** | timestamptz | **NOT NULL, 서버가 계산** |
| upstream_approved_by / at | | **필수** |
| **upstream_approval_id** | text | **필수** |
| **ai_generated** | boolean | **NOT NULL, 기본값 없음** — AI 표기 의무용 |
| **payload_hash** | text | 멱등 비교용 (서버 결정 필드 제외한 정규화 해시) |
| **notified_at** | timestamptz nullable | 수입 알림을 보낸 시각 |
| held_reason | text nullable | 계산 불가한 사유만 |
| **rights_reason** | text nullable | 권리를 내린 사유 |
| returned_reason / by / at | nullable | |
| genesis_application_id / genesis_round / promo_video_id | nullable | **지금은 항상 NULL** |
| created_at / updated_at | | |

**키**
```
UNIQUE (source, source_ref, source_version)
UNIQUE (source, upstream_approval_id)
```

**CHECK**
```
status='scheduled' → rights_status='cleared'
num_nonnulls(genesis_application_id, promo_video_id) <= 1
(genesis_application_id IS NULL) = (genesis_round IS NULL)
status <> 'returned' OR returned_reason IS NOT NULL
held_reason IS NULL OR held_reason IN ('late_for_slot','manual')
rights_status = 'cleared' OR rights_reason IS NOT NULL
kind / surface / status / rights_status : CHECK IN (…)
form : DB CHECK 없음 — 수입 코드 허용 목록으로만 검증
language : ^[a-z]{2,3}(-[A-Z]{2})?$ (형식 가드만)
```

#### 🔴 approval_status는 없다

자동 통과 모델이라 **항상 참인 컬럼**이 된다.
"승인 체크가 있으니 안전하다"는 착각을 만든다. 거짓 정보를 저장하지 않는다.

**상류 승인은 기록만 한다.** `upstream_approved_by/at/id`가 그것이다.

#### 🔴 "공개 중"은 저장하지 않고 계산한다

```
status='scheduled' AND rights_status='cleared'
AND publish_at <= now() AND 해당 DBA 공개 스위치 ON
```

상태를 뒤집는 크론이 필요 없다.

#### 🔴 published가 아니라 live

`publish`가 이미 세 뜻으로 쓰인다 — `promo_publish_*`,
`studio_prelim_auto_publish`, `competition_publication_enabled`.
네 번째를 만들지 않는다. `lib/video-live.ts`가 이미 "라이브 = 공개 노출"로 쓴다.

### 2-2. content_assets

| 칸 | 값 |
|---|---|
| id / content_id | |
| **role** | 자유 문자열 — `main_16x9` / `main_9x16` / `thumbnail` / `script` |
| media_type | video / audio / image / text |
| file_format / url / **sha256** | sha256 필수 |
| text_content | 짧은 글 (상한 64KB) |
| duration_sec / width / height / bytes | |

**UNIQUE (content_id, role)**

**영상 계열은 `main_16x9`·`main_9x16` 중 하나 이상.** 둘 다 필수는 아니다.
작품에 따라 한쪽만 있을 수 있다 (제니2 확정).

⚠️ **종횡비 컬럼은 만들지 않는다.** `width`/`height`에서 계산된다.
같은 사실을 두 번 저장하면 어긋나는 행이 생긴다.
출처가 보내면 검증만 하고 저장하지 않는다.

### 2-3. content_distributions — 현재 상태

| 칸 | 값 |
|---|---|
| id / content_id | |
| platform | youtube / instagram / tiktok / x |
| account / external_title / **caption_sent** | 실제 보낸 문구 스냅샷 |
| external_url / external_id | ⚠️ URL은 송출 직후 못 채운다 (§5-5) |
| status | queued / sending / posted / **failed** / **unknown** / cancelled / skipped_no_asset / **skipped_oversize** |
| **attempts** | int, 기본 0 |
| **next_attempt_at** | timestamptz nullable — failed 재시도 시각 |
| **alerted_at** | timestamptz nullable — 이 상태로 알림을 보낸 시각 |
| **last_error** | text nullable |
| scheduled_at / published_at / created_at | |

**🔴 UNIQUE (content_id, platform)**
없으면 같은 채널에 중복 송출이 가능하다. **점유 SQL의 원자성이 이 키에 기댄다.**

**🔴 failed와 unknown의 경계 — 코드로 못 박는다**

| 상황 | 상태 | 이유 |
|---|---|---|
| Postiz가 **4xx** 응답 | `failed` | 거절이 확실. 안 나갔다 |
| **해시 불일치** | `failed` + `failed_terminal` 기록 | **재시도해도 같다** → `next_attempt_at=NULL` |
| Postiz가 **5xx** 응답 | **`unknown`** | **내부 큐에 넣고 응답했는지 모른다** |
| 응답 전 **시간 초과·연결 끊김** | `unknown` | 모른다 |
| 점유 후 함수가 죽음 | `unknown` | 모른다 |

**5xx를 failed로 보면 안 된다.** 자동 재시도되어 중복 송출이 난다.
경계가 모호하면 안전한 쪽(`unknown`)으로 간다.

**재시도 규칙**
```
unknown  재시도 금지. 사람이 SNS를 확인한다
failed   attempts < content_dispatch_max_attempts 이면 재시도
         간격은 지수 백오프: content_dispatch_backoff_base_minutes × 2^(attempts-1)
         ⏸ 두 값 모두 platform_config 키. 값 미정
         한 틱에 같은 행을 두 번 시도하지 않는다 (점유가 보장)
         상한 초과 → 더 시도하지 않고 알림
```

`attempts`와 `last_error`가 없으면 promo에서 겪은
**"실패한 행이 큐 맨 앞을 영원히 막는"** 문제가 그대로 옮겨온다.

**`stopped_by_switch`는 상태가 아니라 로그 사유다.**
가드에 막히면 **`queued`로 되돌아간다.** 상태로 두면 재개 시 누가
`queued`로 돌리는지 정해야 한다.

### 2-3b. content_publish_log — 시도 이력

```
id · content_id · platform · attempt_no
result (sent / failed / failed_terminal / unknown / stopped_by_switch
        / manual_resolved / requeued)
reason · http_status · created_at
```

**§2-3이 현재 상태라면 이것이 시도 이력이다.**
`promo_publish_log`와 같은 역할이고, §5-3 ⑥의 "사유를 로그로"가 여기로 간다.

### 2-3c. content_presigns — 발급 기록

```
key (PK) · source · source_ref · source_version · role
bytes · expires_at · created_at · consumed_at
```

**🔴 이 표가 없으면 `content_presign` RPC가 할 일이 없다.**
실제 서명(URL 생성)은 R2 자격증명이 있는 Node 라우트에서만 가능하다.
**RPC의 일은 발급 기록을 남기고 검증하는 것**이고, 그러려면 상태가 필요하다.

| 설계가 요구하는 것 | 이 표가 없으면 |
|---|---|
| 발급 횟수 제한 | 서버리스라 메모리로 못 센다 |
| import의 키가 **우리가 발급한 것**인지 | 검증 불가 — 임의 키를 받게 된다 |
| bytes가 발급 때와 일치하는지 | 검증 불가 |
| 이미 수입된 버전에 409 | 판단 근거 없음 |
| 고아 객체 정리 | `expires_at` 기준이 없다 |

**`content_import`가 키를 `consumed_at`으로 표시한다.**
같은 키로 두 번 수입하는 것도 막힌다.

**🔴 import는 `expires_at`을 보지 않는다**
업로드가 느려서 URL이 만료된 뒤에 import가 오면,
"발급 기록이 만료됐다"로 거절하면 **정상 업로드가 실패한다.**

```
expires_at 은 PUT URL의 유효 시간과 고아 정리 기준일 뿐이다

import의 판단 조건 셋
  ① 발급 기록이 있다 (source · source_ref · version · role · bytes 일치)
  ② R2에 객체가 존재한다
  ③ 아직 consumed_at 이 없다
```

→ **① SQL의 테이블은 6개다.**

### 2-4. contents_history (감사)

```
content_id (FK 없음) · field · old_value · new_value (둘 다 nullable)
changed_by · changed_by_email · changed_at
```

**FK를 걸지 않는다.** CASCADE면 행을 지울 때 감사 기록도 지워진다.

**감사 대상 — 9개** (§6-8과 동일)
```
status · rights_status · rights_reason · publish_at
title · description · caption · returned_reason · held_reason
```

---

## 3. 수입

### 3-1. 엔드포인트

```
POST /api/contents/import        수입
POST /api/contents/presign       업로드 URL 발급
POST /api/contents/rights-down   권리 내리기   ⭐ 체크리스트 1
GET  /api/contents/status        자기 행 상태 조회
GET  /api/contents/returns       반송 목록 — 커서 (returned_at, id) 복합
```

**출처별 시크릿 하나.** 시크릿이 `source`를 결정하고, 서버가 source별 허용 kind를 강제한다.
**자기 source 행만** 보이고 바꿀 수 있다.

### 3-2. 🔴 mp4는 본문으로 못 보낸다 — presign 3단계

Vercel 함수 본문 한도 약 4.5MB. 뉴스 첫 편이 12.66MB다.

```
① presign 요청 (같은 시크릿) → 일회용 PUT URL + 키
② 그 URL로 mp4·썸네일 직접 PUT
③ import 호출 시 URL이 아니라 키를 보냄
   서버가 R2 객체를 스트리밍으로 읽어 sha256을 직접 계산하고
   출처가 보낸 값과 비교한다
```

**출처에 R2 자격증명을 두지 않는다.** 임의 URL을 우리가 가져오지도 않는다(SSRF 방지).

⚠️ **R2는 `x-amz-checksum-sha256`을 지원하지 않는 것으로 보인다** (지수 문서 조회).
SHA-256은 멀티파트 COMPOSITE만, FULL_OBJECT는 CRC-64/NVME만 지원.
→ **서버가 스트리밍으로 직접 계산한다.** 숏폼 수십 MB는 문제없다.
→ 구현 때 실제 presigned PUT으로 한 번 시험해 확정한다.

**🔴 키는 서버가 만든다** — 형식은 아래 3중 방어 ②에 있다
**`source_version`이 빠지면 이미 나간 버전의 파일을 덮어쓴다.**
v1이 SNS에 나간 뒤 v2를 올리면 같은 키라 v1 파일이 사라진다.

import 때 **키가 그 출처·그 source_ref·그 버전의 접두사인지 검증한다.**
안 하면 출처 A가 출처 B의 객체를 참조할 수 있다.

**🔴 이미 수입된 버전에는 presign을 거절한다 (409)**
v1이 import된 뒤 출처가 presign을 다시 받아 PUT하면
**v1의 파일이 바뀔 수 있다.** 사람이 검수한 영상이 나가기 전에 바뀐다.

**3중 방어**
```
① 이미 수입된 (source_ref, source_version)에는 presign 409
   — 끝난 버전에 새 업로드 URL을 발급하지 않는다
② 키에 불규칙 접미사를 붙여 재서명이 같은 객체를 안 가리키게
   imports/<source>/<source_ref>/v<n>/<role>-<nonce>
③ 송출 때 영상을 내려받은 직후 sha256을 다시 계산해
   content_assets.sha256과 비교. 어긋나면 failed + 알림
   (영상을 이미 메모리로 받으므로 추가 비용이 작다)
```

**presign 요청 규격**
```json
POST /api/contents/presign
{
  "source_ref": "...",
  "source_version": 1,
  "role": "main_9x16",
  "bytes": 13275136,
  "content_type": "video/mp4"
}
```
```
role         허용 목록으로 검증 (main_16x9/main_9x16/thumbnail/script)
bytes        content_max_bytes_<kind>_<form> 상한을 여기서 미리 거절
             → 다 올린 뒤 import에서 퇴짜 맞는 낭비를 막는다
URL 만료     content_presign_ttl_seconds
발급 횟수    content_presign_rate_per_hour
             ⭐ source_ref 단위 + source 전체 단위 둘 다 센다
                source_ref 단위만 세면 출처가 ref를 바꿔가며 무한 발급한다
⭐ 두 키 중 하나라도 없거나 이상하면 presign을 503으로 거절 (fail-closed)
   코드에 쓰면 하드코딩이다
```
⏸ 고아 객체 정리는 `scripts/r2-orphan-sweep.mjs`가 하는지 확인 필요.

**sha256은 url 기반 에셋에만 필수다.** `script`처럼 `text_content`만 있는
에셋에는 해당 없다.

### 3-3. 요청 규격

```json
{
  "spec_version": 1,
  "source_ref": "<production_id>",
  "source_version": 1,
  "kind": "news|drama|film|cf|music|music_video",
  "form": "short|long|full|trailer",
  "language": "ko",
  "rights_status": "cleared|restricted|blocked",
  "rights_reason": "라이선스 미확인 — ElevenLabs 약관",
  "title": "...", "description": "...", "caption": "...",
  "upstream_approved_by": "...",
  "upstream_approved_at": "...",
  "upstream_approval_id": "...",
  "allowed_platforms": ["youtube","instagram","tiktok"],
  "not_before": "...",
  "ai_generated": true,
  "assets": [
    {"role":"main_9x16","key":"...","file_format":"mp4","bytes":0,
     "duration_sec":0,"width":1080,"height":1920,"sha256":"..."},
    {"role":"thumbnail","key":"...","sha256":"..."}
  ]
}
```

**서버가 정하는 것** — `source`, `status`, `publish_at`
**모르는 필드는 거절한다** (무시하지 않음). 이름이 어긋나면 400으로 바로 드러난다.
**서버가 조용히 매핑하지 않는다** — movie → film 같은 변환 없음.

**🔴 `allowed_platforms`는 1개 이상 필수다.** 빈 배열은 400.
빈 배열을 허용하면 출처가 실수로 빠뜨린 정상 콘텐츠가
**"송출 대상 없음"으로 조용히 들어온다.**

**🔴 `rights_reason`은 `rights_status != 'cleared'`일 때 필수다**
상한 2000자. `payload_hash`에 포함한다.
**이게 없으면 restricted 수입이 CHECK 위반으로 전부 실패한다.**
약관 확인 전까지 뉴스는 전부 restricted다 — 지금 바로 걸리는 문제다.

⚠️ 반대도 막는다 — **`rights_status='cleared'`인데 `rights_reason`이 오면 400.**
안 하면 cleared 행에 오래된 사유가 남는다.

**수입 코드 허용 목록으로 검증하는 것 둘**
```
form      short / long / full / trailer
          kind=news는 지금 short만 받는다. long은 400으로 거절
language  ko / en / ja / ko-KR / en-US / ja-JP
```
DB CHECK가 아니라 코드 목록이다. **값 추가는 코드 한 줄, 마이그레이션 없음.**

### 3-4. publish_at 계산 (서버)

| 종류 | 계산 |
|---|---|
| **뉴스** | 서버가 고정 스케줄로 계산. `not_before`는 받지 않는다(오면 400) |
| **엔터** | 출처가 `not_before` 필수. 비면 400 |

**뉴스 스케줄** (platform_config)
```
news_publish_weekdays  = 'mon,tue,wed,thu,fri'    ⭐ 영문 약어만
news_publish_time      = '07:00'
news_publish_timezone  = 'Asia/Seoul'             ⭐ IANA 이름만
```
근거: 한국 출근길 지하철 시청 (TK 결정). Asia/Seoul이라 DST 없음.
`promo-schedule.ts`의 `nextPublishSlot()`만 재사용. promo 파일은 안 건드린다.

**🔴 저장 형식을 틀리면 조용히 안 돈다**
파서(`WEEKDAY_ABBR`)는 **영문 약어만** 받는다. `월~금`을 저장하면
파싱이 비어서 정지 상태가 된다. promo에서 시간대를 `korea`로 저장해
조용히 안 돈 전례가 코드 주석에 있다.

→ **스케줄 키가 파싱되지 않으면 뉴스 수입을 503으로 거절한다.**
`content_min_lead_minutes`와 같은 규칙이다.

**모든 경로의 바닥**
```
publish_at >= now() + content_min_lead_minutes   (DB 시계 기준)
```
- 출처는 **당길 수 없다**
- 엔터에서 바닥보다 이른 `not_before`는 **조용히 늦추지 않고 422로 거절**
- 행이 없거나 이상하면 **수입을 503으로 거절** (0으로 진행하지 않음)
- ⏸ 값 미정 (TK 결정 대기)

**마감을 놓친 뉴스**
`now()` 기준 슬롯과 `now() + 최소리드` 기준 슬롯이 다르면
→ `held`, 사유 `late_for_slot`. 사람이 [송출]로 결정한다.

### 3-5. 🔴 held로 들어오는 경우 — 넷

| 사유 | 저장? |
|---|---|
| 권리 미확정 (`rights_status != 'cleared'`) | **계산** |
| 버전 2 이상 | **계산** |
| 슬롯 마감 후 도착 | `held_reason='late_for_slot'` |
| 수동 정지 | `held_reason='manual'` |

**체크리스트 4** — 계산 가능한 사유는 읽을 때 계산한다.
원인이 겹칠 수 있어 컬럼 하나로는 부족하다.

---

## 4. 🔴 권리 (rights_status)

### 4-1. 규칙 — cleared만 나간다

```
cleared        → 나간다
restricted     → 안 나간다
blocked        → 안 나간다
```

**강제 송출(override) 기능을 만들지 않는다** (TK 결정 10-04).
> "저작권이 애매한 건 아예 만들지 말아야지"

애매하면 **만든 쪽이 고쳐서 다시 보낸다.** 어드민은 고민하지 않는다.

### 4-2. 강제되는 곳 — 다섯 군데

```
① DB CHECK          status='scheduled' → rights_status='cleared'
② 수입              cleared 아니면 held로 들어옴
③ 송출 점유 SQL     rights_status='cleared' 조건
④ 송출 직전 재확인  DB에서 다시 읽음
⑤ 사이트 공개 판정  같은 조건
```

SQL로 직접 고쳐도 `scheduled`가 될 수 없다.

### 4-3. ⭐ 권리 변경 방향 비대칭 (체크리스트 1·2·3)

**내리는 쪽 — 즉시 가능** (TK 결정 10-04)
```json
POST /api/contents/rights-down
{
  "source_ref": "...",
  "source_version": 1,
  "rights_status": "restricted|blocked",
  "rights_reason": "라이선스 만료 — 배경음악 B"
}
```
```
인증: 수입과 같은 시크릿
대상: 자기 source 행만
방향: 하강만 (cleared→restricted, cleared→blocked, restricted→blocked)
      ⭐ §6-7b 트리거와 같은 규칙이다
      상승은 400. 같은 값으로 두 번 부르면 멱등 200 (변화 없음)
감사 행위자: import:<source>
rights_reason 필수 (상한 2000자) → contents.rights_reason에 저장
```
**`rights_reason`이 없으면 왜 내렸는지 아무도 모른다.**

**한 트랜잭션** (체크리스트 2)
```
① rights_status 변경
② status → held
③ 대기 중(queued) 배포 행 → cancelled
```
**순서가 다르면 CHECK(scheduled → cleared)가 먼저 걸린다.**

| 그때 배포 행 상태 | 처리 |
|---|---|
| queued | cancelled |
| **sending** | 재확인 가드가 막는다 (§5-3 ⑤) |
| **posted** | 회수 불가. 어드민에 "이미 송출됨, 플랫폼에서 직접 삭제 필요" + URL 표시 |

**올리는 쪽 — 새 버전으로만**
시크릿 하나로 `restricted → cleared`를 바꿔 자동 송출을 열 수 있으면
방어선이 구멍난다.

**같은 버전 재전송으로 올리는 경로를 막는다**
```
같은 (source, source_ref, source_version)이 다시 오면
  → 기존 행을 수정하지 않는다
  → payload_hash가 같으면 200 + 현재 상태 반환 (멱등)
  → payload_hash가 다르면 409
```

**"같은 내용"의 기준 = `payload_hash`**
서버 결정 필드(`source`·`status`·`publish_at`)를 뺀 요청의 정규화 해시.
**에셋의 `key`와 `sha256`도 해시에 포함한다** — 파일이 바뀌면 다른 내용이다.

**멱등 응답은 200이고 현재 상태를 돌려준다.**
```json
{ "id": "...", "status": "held", "rights_status": "restricted",
  "held_reason": null, "idempotent": true }
```
권리를 내린 뒤 출처가 원본 요청(`cleared`)을 재시도하면
**409가 아니라 200 + 현재 상태(`restricted`)**를 받는다.
출처는 "이미 들어갔고 지금 상태는 이렇다"를 알게 되어 재시도를 멈춘다.

⚠️ **409는 재시도하지 말고 종결로 취급한다** — 규격에 명시한다.
**새 버전 번호가 필요하고, 버전 2 이상은 항상 held로 들어온다.**

### 4-4. ⏸ 미결 — 약관 확인

ElevenLabs(음성)·Hedra(립싱크) 상업 이용 조건을 **아직 문서로 확인 안 함.**
→ **뉴스·엔터가 나중에 확인한다** (TK 지시 10-04).
→ 확인 전까지 뉴스는 `cleared`를 보내지 않는다. **전부 held가 된다.**
→ 이것 때문에 Phase 1 구현을 멈추지 않는다.

**뉴스의 `cleared` 정의** (뉴스 제니 확정)
> "영상 안의 모든 요소가 우리 것이거나 상업 이용 허가가 있고,
> 남의 저작물(기사 원문·사진·영상·음악)이 들어가지 않았다"

앵커·배경 = 우리 AI 자산 / 음성 = ElevenLabs Creator / 립싱크 = Hedra /
폰트 = Do Hyeon(오픈) / 음악 없음 / 원고는 기사 요약, 문장 그대로 안 옮김

---

## 5. 송출

### 5-1. 크론

```
전용 라우트. 5분 간격. maxDuration 300초 선언 필수.
```
Vercel **Pro 플랜 확인 완료** (지수, API 조회). 크론 100개 한도, 최소 1분.
→ 07:00 뉴스가 07:00~07:05에 나간다.

**기존 */15 핸들러에 합치지 않는다.** 한쪽 실패가 다른 쪽에 영향을 준다.
**틱당 처리 건수 상한을 둔다** (영상을 메모리로 내려받기 때문).

### 5-2. 스위치 다섯

| 키 | 막는 것 |
|---|---|
| **social_dispatch_enabled** | **Postiz로 나가는 전부 (마스터, promo 포함)** |
| news_dispatch_enabled | 뉴스 SNS 송출 |
| entertainment_dispatch_enabled | 엔터 SNS 송출 |
| news_publication_enabled | 뉴스 사이트 공개 |
| entertainment_publication_enabled | 엔터 사이트 공개 |

**전부 fail-closed.** 행 없음·오류 → 닫힘.

**송출(쓰기)과 공개(읽기)는 다른 질문이다.** 합치지 않는다.

**DBA별로 둔다. kind별로 쪼개지 않는다.**
스위치는 파이프라인 이상용이고, 파이프라인 경계가 곧 DBA 경계다
(뉴스=기획실, 엔터=Production OS). 같은 DBA 안에서 하나만 이상하면
**항목 정지(held)**로 처리한다.

> **항목 정지가 일상 도구, 스위치는 파이프라인 이상 도구.**

**쪼개는 트리거** — 같은 DBA 안에서 두 종류가 다른 파이프라인에서 오고
항목 정지로 감당이 안 될 때. 그때는 새 DBA를 만들면 스위치 2벌만 는다.

### 5-3. 🔴 송출 순서

```
① unknown 정리  ⭐ 가장 먼저. 스위치와 무관하게 돈다
                점유가 임계(maxDuration 300초 + 여유)를 넘긴
                sending 행을 unknown으로 바꾸고 알림 메일
                → 스위치가 꺼져 있어도 좀비 행은 치워야 한다

①b 알림 발송  ⭐ 알림이 필요하고 alerted_at IS NULL인 행을 찾아 보낸다
              대상: dist.status IN ('unknown','failed')
                    + contents.status='held' AND notified_at IS NULL
              보낸 뒤 alerted_at / notified_at = now()

              🔴 RPC를 새로 만들지 않는다. 서버 액션이 직접 UPDATE한다.
                 RPC 15개는 그대로다 (되읽기 기대 행 수도 15 유지)
              🔴 메일 전송 실패 시 alerted_at을 쓰지 않는다
                 → 다음 틱에 다시 시도된다. 그게 이 컬럼의 요점이다

② 조기 종료   ⭐ DBA별로 판단한다
              social_dispatch_enabled 가 꺼져 있으면 전부 종료
              켜져 있으면 {dba}_dispatch_enabled 가 켜진 DBA만 처리
              → 뉴스가 꺼져도 엔터는 돈다

③ 루프    ⭐ 한 행씩 점유하고 즉시 처리한다. 일괄 점유하지 않는다
          while (경과 < 시간예산 AND 처리수 < per_tick):
              한 행 점유 → ④~⑦ 처리 → 다음

          🔴 시간 예산은 코드가 선언값에서 계산한다. 숫자를 문서에 박지 않는다
             예산 = 선언한 maxDuration - 안전 여유
             한 행 처리 전에 남은 시간이 "한 건 처리 시간" 기준보다
             적으면 점유하지 않고 멈춘다
             기준값은 platform_config.content_dispatch_item_budget_seconds
             (없으면 보수적 기본 상수)
             → 문서에 240초로 박으면 maxDuration을 바꿀 때 어긋난다

          단일 SQL로 queued/재시도가능 failed → sending
          조건: contents.status='scheduled'
                AND contents.rights_status='cleared'
                AND contents.publish_at <= now()
                AND (dist.status='queued'
                     OR (dist.status='failed'
                         AND dist.next_attempt_at <= now()
                         AND dist.attempts < max))
          점유 실패 시 아무것도 하지 않는다 (중복 송출 방지)
          틱당 처리 건수 상한 적용 (content_dispatch_per_tick)
          ⭐ 행이 없거나 이상하면 처리 0건 (fail-closed)
             → /admin/contents 상단 배너에 "송출 설정 없음" 경고
               안 그러면 조용히 안 나가는 상태가 된다

④ 미디어 준비  ⓐ R2에서 내려받는다
               ⓑ ⭐ 해시 검증 — sha256을 content_assets.sha256과 비교
                  어긋나면 Postiz에 올리지 않는다
                  → dist_mark(result='failed_terminal',
                              last_error='hash_mismatch') + 알림
                  ⭐ failed_terminal은 next_attempt_at=NULL로 기록된다
                     → 점유 조건의 next_attempt_at <= now()에 안 걸린다
                     같은 결과가 나올 일을 3번 재다운로드하지 않는다
                     ("조치 필요" 정의와도 맞는다)
               ⓒ uploadMedia로 Postiz에 전송
               아직 게시가 아니다

⑤ 재확인  POST /posts 바로 직전에 DB에서 새로 읽는다 (캐시 금지)
          - social_dispatch_enabled
          - {dba}_dispatch_enabled
          - contents.status
          - contents.rights_status      ⭐ 수입 후 바뀌었을 수 있다
          - contents.publish_at <= now()  ⭐ 어드민이 미래로 미뤘을 수 있다

⑥ 중단    하나라도 닫혀 있거나 읽기 실패 → 보내지 않는다
          점유를 queued로 되돌린다 (failed 아님)
          content_publish_log에 result='stopped_by_switch'
          → 사고 수습 후 재개하면 다시 나가야 하기 때문

⑦ 게시    POST /posts — ⭐ 행(채널) 하나당 호출 한 번
          ⭐🔴 항상 즉시 송출(type:'now'). Postiz 예약 기능 금지
          여러 채널을 한 호출에 묶지 않는다. 한 채널이 실패하면
          어느 채널이 나갔는지 알 수 없게 된다
          성공 → posted
          4xx   → failed + attempts+1 + last_error + next_attempt_at
          5xx·timeout → unknown
```

**🔴 해시 검증이 Postiz 업로드 뒤에 있으면 늦다.**
바뀐 파일이 **이미 외부에 올라간 뒤에야** 발견된다.
그래서 "미디어 준비" 단계 안에서 **내려받기 → 검증 → 업로드** 순이다.

### 🔴 Postiz 예약을 쓰지 않는다 — 긴급 정지의 전제

```
publishPost는 항상 type:'now'로만 부른다.
scheduledAt을 받으면 postiz.ts의 가드가 거부한다.
```

**왜** — Postiz에 미래 시각으로 맡기면 **우리 스위치를 꺼도 Postiz 안에서
계속 나간다.** 우리 코드로 회수할 수도 없다(§11).
발행 시각 관리는 **우리 `publish_at`과 크론이 한다.** Postiz에 맡기지 않는다.

**이 한 줄이 빠지면 긴급 정지가 통째로 무력화된다.**

**🔴 일괄 점유를 하면 틱 후반 행이 처리도 전에 `unknown`이 된다.**
`limit_n`개를 먼저 `sending`으로 바꿔두면, 10번째 행은 앞 9개를 처리하는
동안 계속 `sending`이다. 함수가 끝나면 **처리된 적도 없이 임계를 넘겨
`unknown`이 된다.** 사람이 SNS를 뒤져야 하는데 **아무것도 안 나갔다.**

→ **한 행씩 점유하고 즉시 처리한다.** 남은 시간이 부족하면 점유를 멈춘다.
못 한 행은 `queued`로 남아 다음 틱(5분 뒤)에 처리된다.

**🔴 ②가 없으면 스위치가 꺼진 동안 5분마다 헛수고를 한다.**
점유하고, 영상을 내려받고, 업로드한 뒤 재확인에서 되돌린다.
**Postiz 미디어 라이브러리에 같은 영상이 5분마다 쌓인다.**
직전 재확인(⑤)은 그대로 유지한다 — 틱 시작 후에 꺼질 수 있다.

**🔴 ①이 ②보다 앞이다.** 스위치가 꺼져 있어도 좀비 `sending` 행은
치워야 한다. 뒤에 두면 사고 중에 좀비가 쌓인다.

**🔴 ①의 주체를 명시한다.** "임계를 넘으면 unknown"만 적으면 아무도 안 바꾼다.
**`unknown`과 `failed`가 생기면 알림 메일을 보낸다.**
사람이 SNS를 확인해야 하는 상태인데 아무도 모르면 안 된다.

**채널별 파일 선택**
```
youtube   → main_16x9 선호
instagram → main_9x16 선호
tiktok    → main_9x16 선호
```
**선호 role이 없으면 다른 비율로 조용히 대체하지 않는다.**
그 채널은 `skipped_no_asset`으로 남기고 사유를 어드민에 표시한다.

**caption** — 점유 직전에 `contents.caption`을 읽어 쓰고,
실제 보낸 문구를 `caption_sent`에 스냅샷으로 남긴다.

### 5-4. ⚠️ 게시 URL은 송출 직후 알 수 없다

`POST /posts` 응답은 `[{postId, integration}]`뿐이다.
URL·퍼머링크·상태가 없다 (지수 확인 10-04).

→ `external_id`는 `postId`로 채운다.
→ `external_url`은 **비워 둔다.** 채우는 방법은 미결 #9.

### 5-5. 🔴 큰 파일

`uploadMedia`가 **영상 전체를 메모리로 내려받는다** (`postiz.ts:91-105`).
엔터의 `form=long`/`full`(영화)은 수 GB일 수 있어 함수가 터진다.

```
수입 단계에서 bytes 상한을 검증한다
키: platform_config.content_max_bytes_<kind>_<form>   (⏸ 값 미정)

예)  content_max_bytes_news_short          뉴스 숏폼
     content_max_bytes_film_full            영화 본편
     content_max_bytes_drama_short          드라마 숏폼

없으면 content_max_bytes_default로 떨어진다. 그것도 없으면 수입 503
상한 초과 → skipped_oversize, 어드민에 표시
```

**🔴 kind와 form 둘 다로 나눈다.**
뉴스 숏폼(수십 MB)과 영화 본편(수 GB)이 같은 상한일 수 없다.

⏸ 값은 플랫폼 제한을 확인해 TK님이 정한다.

### 5-6. 🔴 promo 가드

**TK 승인 완료** (10-04). `publishPost`를 **미디어 준비 / 게시**로 쪼개고
사이에 가드를 끼운다. promo 호출은 **마스터 스위치만** 확인한다.

**🔴 가드 차단은 별도 오류 코드로**
`app/api/admin/promo/publish/route.ts`가 미지정 오류를 전부 502로 매핑한다.
가드 차단은 `dispatch_disabled → 503`으로 구분해야
어드민에서 **"Postiz 장애"로 오해하지 않는다.**

**⚠️ 배포 순서**
```
① social_dispatch_enabled = 'true' 행을 DB에 먼저 넣는다
② 그다음 코드를 배포한다
```
**fail-closed라서 행이 없으면 promo가 멈춘다.** 순서를 지켜야 한다.
(지금 promo는 전부 미승인이라 실제 영향은 없다)

### 5-7. 송출 가드 — 라이브 미검증

**Postiz에 테스트 채널이 없다.** 연결된 4개(instagram·tiktok·x·youtube)
전부 진짜 OXXOVO 계정이다 (TK 확인 10-04).

→ 가드 시험은 `POST /posts`를 **스텁**으로 바꿔서 한다.
→ 라이브에서는 `social_dispatch_enabled=false`일 때
  **"나가지 않는다"를 음성 시험으로만** 확인한다.
→ **설계서에 "송출 가드 라이브 미검증"으로 남긴다.**

### 5-8. ⑩ 정상 송출 시험 계획 — 실제 OXXOVO 채널 1건 (2026-10-07, TK님 결정)

테스트 채널은 만들지 않는다(Postiz 채널을 새로 붙이는 비용이 더 크다). **한 번이라도 실제 SNS에 나가는 첫 건이라 되돌릴 수 없다는 전제로 준비한다.**

**YouTube 설정이 빠져 있었다(코드 대조로 발견).** Postiz 공식 문서([YouTube 설정](https://docs.postiz.com/public-api/providers/youtube.md))는 `title`(2~100자)과 `type`(`public`/`unlisted`/`private`)을 **필수**라고 한다. 그동안 `buildPostBody`는 YouTube에 `__type`·`post_type`만 보냈다 -> 그대로 열면 4xx로 실패(안전하지만 시험이 헛돈다). 콘텐츠 송출 경로에만 추가했다:
- `title` = 콘텐츠 제목을 정리(제어문자·꺾쇠 제거, 공백 정리, **100 코드포인트**로 자름). 2자 미만이면 **보내지 않고** `failed_terminal`(`youtube_title_invalid`, 다운로드 전). 제목을 지어내지 않는다.
- `type` = `platform_config` `content_youtube_visibility`. **없거나 이상하면 `private`**(fail-closed). **재확인 때 새로 읽는다**(틱 시작 값 아님).
- 홍보영상 경로(`publishPromoVideo`)는 건드리지 않았다(`youtube` 인자 없으면 기존 모양 그대로, 테스트로 고정).
- **시험 제목은 코드가 아니라 어드민 `메타 수정`으로 `[시험] 2026-10-07 ...` 식으로 바꾼다**(감사에 남는다). 코드에 접두어를 넣으면 실제 콘텐츠 제목이 오염된다. 올린 직후 시스템은 영상 URL을 모르므로(§5-4) TK님이 **제목으로 Studio에서 찾는다.**

**올릴 것의 조건**: 100MB 이하(`content_dispatch_max_bytes_default`) · `main_16x9` 있음(YouTube는 이 role만) · **만든 쪽이 처음부터 `cleared`로 수입**(권리는 올릴 수 없다) · `probe-` ref 아님 · 수입 `allowed_platforms`는 `["youtube"]` 하나(지울 것이 하나) · 뉴스라면 ElevenLabs·Hedra 상업 약관 미확인 -> **TK님이 비공개 1건을 감수한다고 확인**.

**지우는 절차(확정)**: Postiz `DELETE /public/v1/posts/{id}`는 존재하지만(그룹 단위, 시간당 30회) **이미 올라간 YouTube 영상까지 지우는지 문서에 없다 -> 믿지 않는다.** 삭제는 **YouTube Studio에서 직접**, Postiz 삭제는 기록 정리용 선택. DB는 `posted`로 남는다("삭제됨" 상태가 없고 콘텐츠는 DB에서 못 지운다) -> 어드민 `[반송]`으로 사유를 남긴다("⑩ 시험 게시, YouTube에서 삭제함"). **못 지우면 이 시험을 하지 않는다.**

**순서**: ① 위 코드 배포(스위치는 닫힌 채) ② `content_youtube_visibility='private'` 입력 ③ 만든 쪽이 1건 수입(`allowed_platforms:["youtube"]`, cleared) ④ 어드민에서 내용 확인 + 제목을 `[시험]`으로 수정, `[정지]` 상태로 둔다 ⑤ `content_dispatch_per_tick`을 `1`로 낮춘다(스위치가 열린 동안 다른 게 같이 나가는 걸 한 건으로 묶는 안전장치) ⑥ 그 콘텐츠 DBA의 송출 스위치 **하나만** 연다 ⑦ 어드민 `[송출]` -> 5분 안에 틱이 가져간다 ⑧ 로그 `processed:1`이 찍히면 **즉시 스위치를 닫고 `per_tick`을 10으로 복원** ⑨ Studio에서 비공개 확인 -> 삭제 -> `[반송]`으로 기록.
**시작 전 읽기 확인**: 대기 행(`queued`/`sending`/`failed`/`unknown`)이 0건인지, `postiz_channel_youtube` 키가 있는지.

**중단**: 스위치를 닫으면 새 점유는 즉시 멈춘다. 점유해 미디어 준비 중인 행도 `POST /posts` 직전의 새 재확인에서 닫혀 있으면 `queued`로 돌아간다. **`POST /posts`가 나간 뒤에는 못 멈춘다.** 그 시점에 함수가 죽으면 `sending` -> 360초 뒤 `unknown` + 알림.

**실패 시**: `failed`(4xx, 안 올라감) -> 재시도 키가 없어 **재시도 0회를 유지**(자동 재시도가 중복 게시를 부를 수 있다), 스위치를 닫고 `last_error`를 고친 뒤 `[다시 보냄]` · `unknown` -> **Studio와 Postiz를 먼저 확인**, 올라갔으면 `[나갔음]`, 없으면 `[다시 보냄]` · `failed_terminal` -> 같은 결과라 재시도 없음, 만든 쪽이 새 버전을 보낸다.

**한계(라이브 미검증)**: Postiz가 `type:private`을 받아 YouTube에 실제로 비공개로 올리는지 · 올린 직후 응답의 `postId`가 Postiz 삭제에 쓰는 id와 같은지 · YouTube의 AI 합성 콘텐츠 표기는 Postiz 설정에 항목이 없다(공개로 돌릴 때 Studio에서 직접, §7-3).

---

## 6. 반송

### 6-1. 어드민

```
[반송]  사유 필수 (상한 2000자, 일반 텍스트)
        return_content() RPC 하나로
          status='returned', returned_reason/by/at 기록
          대기 중 배포 행 → cancelled
```

**이미 송출된 건** — 회수 불가. 어드민에 "이미 송출됨, 각 플랫폼에서 직접
삭제 필요"와 채널·URL 표시.

**[반송 메모 복사] 버튼** — source·source_ref·버전·사유를 정리한 텍스트
블록을 복사한다. 지금 채팅 중계로 일하는 방식에 그대로 맞는다.

### 6-2. 출처가 반송을 아는 방법

```
GET /api/contents/status?source_ref=   항목별 조회
GET /api/contents/returns?since=       미처리 반송 목록
                                       커서는 (returned_at, id) 복합
                                       시각만으로는 같은 시각 행을 놓친다
반송 시 담당자에게 알림 메일
```

**웹훅 푸시는 안 만든다.** 출처 쪽에 우리가 호출할 엔드포인트와 비밀이
생기고 재시도 설계도 필요하다. 폴링이 문제되면 그때 추가한다.

### 6-3. 재전송 — 사람이 다시 승인해야 한다

```
returned → revision → Human EP 재승인 → source_version +1 → 재전송
```
(제니2 요청, P0 Governance 원칙과 일치)

**서버가 검증하는 것**
- `upstream_approved_at`이 직전 버전의 `upstream_approved_at`보다,
  그리고 직전 버전의 `returned_at`보다 **엄격히 늦어야** 한다
- `UNIQUE (source, upstream_approval_id)` — 같은 승인을 두 버전에 재사용하면 DB가 막는다
- 반송된 버전 번호로 재전송하면 재큐하지 않고 기존 상태를 반환
- **`source_version` 규칙 셋**
  ```
  기존 최대값과 같음  → payload_hash 비교 (멱등 200 또는 409)
  기존 최대값 + 1     → 신규 버전 (held)
  그 외 (건너뜀·역행) → 400
  ```
- 버전 2 이상은 **항상 held**
- 새 버전의 sha256이 직전과 전부 같으면 거절하지 않고 어드민에 "영상 동일" 표시

**🔴 서버가 보증하지 못하는 것**
> Human EP가 실제로 재승인했는지는 모른다.
> `upstream_approved_by/at/id`는 전부 **출처가 주장하는 값**이다.
> 이 검증은 **실수와 자동 재전송을 잡는 장치이지, 악의를 막는 장치가 아니다.**

방어는 겹겹이다 — 시각·id 검증 / 버전 2 이상 held / 사람의 [송출] / 정지 스위치.

### 6-4. 🔴 상태 전이 — 전부 RPC 안에서 강제

| 전이 | 버튼 | 사전 조건 |
|---|---|---|
| (수입) → scheduled | — | `rights_status='cleared'` AND 버전 1 AND 슬롯 안 놓침 |
| (수입) → held | — | 위 조건 중 하나라도 불충족 |
| scheduled → held | **[정지]** | — |
| held → scheduled | **[송출]** | **아래 사전 조건** |
| scheduled/held → returned | **[반송]** | 사유 필수 |
| returned → held | — | 오반송 복구용 |
| returned → scheduled | ❌ | **직접 불가** |
| scheduled → hidden | **[숨김]** | — |
| **hidden → held** | **[되살리기]** | **scheduled로 바로 못 간다** — [송출]의 사전 조건 셋을 건너뛰게 되기 때문 |
| hidden → returned | **[반송]** | 사유 필수 |

**🔴 `[송출]`은 `cancelled` 배포 행을 다시 `queued`로 돌린다**
권리를 내렸다가 되살렸을 때, 반송했다가 복구했을 때
배포 행이 `cancelled`인 채로 남으면 **영영 안 나간다.**
`[송출]` RPC가 그 콘텐츠의 `cancelled` 행을
`queued`(attempts=0, next_attempt_at=NULL)로 되돌린다.
`content_publish_log`에 `result='requeued'`를 남긴다.

**🔴 `[송출]`은 `held_reason`을 비운다**
안 비우면 `manual`이 남은 채 `scheduled`가 된다.

**🔴 v2를 송출할 때 v1의 송출 상태를 보여준다**
`UNIQUE (content_id, platform)`은 **같은 행 안에서만** 중복을 막는다.
v2는 새 행이라 **v1이 이미 `posted`여도 새 게시가 하나 더 올라간다.**
의도일 수도 있지만 **사람이 모르고 하면 안 된다.**
```
어드민 상세에 직전 버전의 상태·채널·URL을 표시
[송출] 확인창: "이전 버전이 이미 송출됐습니다.
               플랫폼에서 지우셨습니까?"
```

**🔴 `unknown`·`failed`는 사람이 푼다 — 어드민 버튼 둘**
```
[나갔음]     unknown/failed → posted.  사람이 SNS에서 확인한 것
             external_url을 손으로 넣을 수 있다
[다시 보냄]  unknown/failed → queued (attempts=0, next_attempt_at=NULL)
             ⚠️ unknown에서 누르면 중복 게시 위험.
                "SNS를 먼저 확인하셨습니까" 확인을 받는다
```
둘 다 `content_publish_log`에 `result='manual_resolved'`로 남긴다.
**이 둘이 없으면 `unknown` 행이 영원히 남는다.**

**🔴 `[송출]` RPC 사전 조건** — RPC가 먼저 검사해 **알아볼 수 있는 오류**를 돌려준다.
```
① rights_status = 'cleared'
② 영상 계열이면 main_16x9 / main_9x16 중 하나 이상 존재
③ 그 에셋의 url이 비어 있지 않을 것
```
검사하지 않으면 **CHECK 위반이 날것으로 어드민에 뜬다.**

`[송출]`은 `publish_at = now()`로 다시 채운다.
사람이 결정한 송출이라 추가 대기 없음. **가드는 똑같이 거친다.**

**`hidden`의 뜻** — 공개 후 내림. SNS는 이미 나갔고 사이트에서만 감춘다.

### 6-5. 🔴 수입은 한 트랜잭션

```
contents INSERT
  + content_assets INSERT (전부)
  + content_distributions INSERT (allowed_platforms마다 queued)
```
**한 트랜잭션이다.** 빠지면 **에셋 없는 콘텐츠**가 중간 상태로 남는다.

`allowed_platforms`는 별도 컬럼으로 두지 않고 **배포 행으로 저장된다.**
→ 수입 RPC가 그 시점에 채널별 행을 만든다.

**🔴 `skipped_*`는 수입 RPC가 그 자리에서 결정한다**
```
선호 role이 없다            → skipped_no_asset
bytes가 상한을 넘는다        → skipped_oversize
그 외                       → queued
```
**송출 시점에 결정하면 안 된다.** 어드민에서 "왜 이 채널은 안 나가지"를
송출 시각까지 모르게 된다. **수입 직후 목록에 보여야 한다.**

### 6-5b. 🔴 RPC 전체 목록 — ③ 전에 확정한다

**이름이 정해진 뒤 인자가 늘면 오버로드 사고가 반복된다** (10-03, 7주).
시그니처를 한 번에 확정한다.

| 함수 | 인자 | 하는 일 |
|---|---|---|
| `content_import` | source, payload jsonb | 수입. contents+assets+distributions 한 트랜잭션 |
| `content_presign` | source, source_ref, source_version, role, bytes, content_type | 발급 기록 + 키 반환 → `{key, expires_at}` |
| `content_rights_down` | source, source_ref, source_version, rights_status, rights_reason | 권리 내리기 |
| `content_hold` | content_id, actor_id, actor_email | [정지] |
| `content_release` | content_id, actor_id, actor_email | [송출] — cancelled 재큐, held_reason 비움 |
| `content_return` | content_id, reason, actor_id, actor_email | [반송] |
| `content_hide` | content_id, actor_id, actor_email | [숨김] |
| `content_unhide` | content_id, actor_id, actor_email | [되살리기] → held |
| `content_update_meta` | content_id, title, description, caption, actor_id, actor_email | 메타 수정 |
| `content_set_publish_at` | content_id, publish_at, actor_id, actor_email | 발행 시각 수정 |
| `dist_claim` | **open_kinds text[]**, limit_n, **max_attempts int** | 점유 (queued/재시도 failed → sending) |
| `dist_mark` | dist_id, result, http_status, error, **external_id**, **caption_sent**, **backoff_base_minutes** | 송출 결과 기록 |
| `dist_sweep_unknown` | threshold_seconds | ① unknown 정리 |
| `dist_mark_posted` | dist_id, external_url, actor_id, actor_email | [나갔음] |
| `dist_requeue` | dist_id, actor_id, actor_email | [다시 보냄] |

**이름을 `content_*` / `dist_*`로 통일한다.** 되읽기 SQL이 이 접두사로 잡는다.

**🔴 인자 셋을 지금 못 박는다 — 나중에 늘면 오버로드 사고다**

**`dist_claim(open_kinds, limit_n, max_attempts)`**
- 인자가 없으면 **닫힌 DBA의 행도 점유한다.** ②가 막으려던 헛수고가 그대로다
- **🔴 `open_dbas`가 아니라 `open_kinds`다**
  `contents`에 DBA 컬럼이 없다. kind에서 도출하고 매핑은
  `lib/content-kinds.ts`에 있다. DBA를 받으면 **SQL 안에 kind→DBA 매핑을
  또 만들어야 한다.** 새 kind가 생길 때 TS와 SQL 두 곳을 고쳐야 하고,
  한쪽을 빠뜨리면 **그 종류가 영영 점유되지 않는다.**
  → TS가 열린 DBA를 레지스트리로 kind 목록으로 펼쳐서 넘긴다.
    SQL은 `c.kind = ANY(open_kinds)`만 쓴다
- `max_attempts` — 재시도 조건 `attempts < max`에 쓴다

**`dist_mark(..., external_id, caption_sent, backoff_base_minutes)`**
- `external_id` — 성공 시 `postId`를 채운다
- `caption_sent` — 실제 보낸 문구 스냅샷
- `backoff_base_minutes` — 실패 시 `next_attempt_at` 계산

**🔴 `result` → 배포 행 상태 변환표** (RPC 안에서 이대로 한다)

| result | status | 그 외 |
|---|---|---|
| `sent` | `posted` | `published_at=now()`, `external_id`, `caption_sent`, `alerted_at=NULL` |
| `failed` | `failed` | `attempts+1`, `last_error`, `next_attempt_at=now()+base×2^(attempts-1)`, `alerted_at=NULL` |
| `failed_terminal` | `failed` | `attempts+1`, `last_error`, **`next_attempt_at=NULL`**, `alerted_at=NULL` |
| `unknown` | `unknown` | `last_error`, `next_attempt_at=NULL`, `alerted_at=NULL` |
| `stopped_by_switch` | **`queued`** | `attempts` 그대로. **failed 아니다** |


**모든 경우 `content_publish_log`에 1행을 남긴다.**
`alerted_at=NULL`은 **상태가 바뀌었으니 알림을 다시 보낼 수 있다**는 뜻이다.

**`content_import(source, payload jsonb)` — 누가 무엇을 계산하나**
```
Node가 계산해 payload로 넘기는 것
  publish_at          (nextPublishSlot()이 Node에 있다)
  late_for_slot 판정

RPC가 DB 안에서 platform_config를 직접 읽어 다시 검사하는 것
  content_min_lead_minutes 바닥
  content_max_bytes_<kind>_<form> 상한
  스케줄 키 유효성
```
**코드가 넘긴 값을 믿지 않는다.** Node 쪽 버그나 변조가 바닥을 뚫지 못한다.

⏸ 나머지 인자 세부는 ③ 작성 시 확정. **그때 이 표를 갱신하고 Run한다.**

### 6-6. 🔴 불변 컬럼 보호

**contents — BEFORE UPDATE 트리거로 변경을 거부한다**
```
source · source_ref · source_version · kind
upstream_approved_by / at · upstream_approval_id · payload_hash
language · form · ai_generated
```
SQL로 고치면 상류 승인 증빙이 무너진다.
`language`·`form`·`ai_generated`는 **수입 시점의 사실**이다. 바뀌면 새 버전이다.

**title · description · caption은 바꿀 수 있다** (어드민이 고친다). **감사 대상이다.**

### 6-7. 🔴 content_assets도 불변이다

```
BEFORE UPDATE  → 전부 거부
BEFORE DELETE  → 전부 거부
contents → content_assets FK = ON DELETE RESTRICT
```

**contents도 DELETE를 거부한다.** 감추는 것은 `status='hidden'`이다.
그러면 CASCADE 구분(`pg_trigger_depth()`)이 필요 없다. **단순한 쪽으로 간다.**

**왜** — sha256으로 무결성을 보증해놓고 그 뒤에 url이나 해시를 바꿀 수 있으면
보증이 무의미하다. **에셋을 고치려면 새 버전이다.**

### 6-7b. 🔴 rights_status는 내려가기만 한다 — DB에서 강제

"올리는 쪽은 새 버전으로만"은 **엔드포인트 규칙일 뿐이다.**
CHECK는 `scheduled`일 때만 `cleared`를 요구하므로,
**SQL로 held 행을 `cleared`로 바꾼 뒤 [송출]을 누르면 통과한다.**

```
BEFORE UPDATE 트리거로 rights_status 방향을 강제한다
  cleared → restricted → blocked   (한 방향)
  역방향은 거부
  올리려면 새 버전 행을 만들어야 한다
```

`restricted → blocked`는 허용한다. 더 닫는 방향이기 때문이다.
⏸ 이 방향이 의도대로인지 확인 필요.

### 6-7d. 🔴 alerted_at 초기화는 트리거로

```
content_distributions BEFORE UPDATE
  NEW.status IS DISTINCT FROM OLD.status  →  NEW.alerted_at := NULL
```

**`dist_mark`만 NULL로 지우면 샌다.**
`dist_claim`·`dist_sweep_unknown`·`dist_requeue`·`dist_mark_posted`도
상태를 바꾸는데, 그 경로로 생긴 **새 `unknown`의 알림이 누락된다.**

→ **상태를 바꾸는 모든 경로에서 자동으로 초기화되게 트리거에 건다.**
`dist_mark`의 `alerted_at=NULL`은 트리거가 대신하므로 변환표에서는 설명용이다.

### 6-7c. 🔴 감사·이력 테이블은 append-only

`deploy:prod` 게이트(`check-service-role-grants.mjs`)가
**모든 public 테이블에 service_role의 SELECT/INSERT/UPDATE/DELETE를 요구한다.**
감사 테이블에서 DELETE를 REVOKE하면 **배포가 막힌다.**

→ `GRANT ALL TO service_role`은 그대로 두고, **트리거로 막는다.**
```
contents_history / content_publish_log
  BEFORE UPDATE → 거부
  BEFORE DELETE → 거부
```
감사 기록이 코드 버그로 지워지지 않게 한다.

### 6-8. updated_at 트리거

`contents`에 `updated_at` 자동 갱신 트리거를 건다.
10-03에 `platform_config`가 트리거 없이 `updated_at`을 갖고 있어
**"언제 바뀌었나"를 알 수 없던 일**을 반복하지 않는다.

**감사 대상** — `status` · `rights_status` · `rights_reason` · `publish_at`
· `title` · `description` · `caption` · `returned_reason` · `held_reason`

## 7. 공개 화면

### 7-1. 🔴 경로를 코드에 쓰지 않는다 (체크리스트 8)

TK 방향 (10-04):
> "oxxovo.ai/ 각 항목별 주소로 들어가야지. 영화, 드라마, 음악, 게임,
> 마켓, 교육 등등. 아직은 주소 안 나왔으니 컨셉만."

```
lib/content-kinds.ts   레지스트리 — kind별 DBA, 허용 출처, 필수 role,
                       공개 role 목록, 스위치 키 이름
platform_config        content_path_<kind>  ← slug만 여기
app/[section]/...      최상위 동적 세그먼트 하나
contentUrl(kind, id)   주소를 만드는 유일한 함수
/c/<id>                바뀌지 않는 영구 주소 → 현재 경로로 308
```

**🔴 `/c/<id>`는 공개 판정을 통과할 때만 308이다.**
아니면 404. 안 그러면 **정지·숨김·권리 미확정 콘텐츠의 존재가 드러난다.**

**🔴 `c`를 예약어 목록에 넣는다.** 누가 slug를 `c`로 설정하면 영구 주소가 깨진다.

**slug가 없으면 그 종류의 공개 면은 404** (fail-closed).
주소가 확정돼도 **설정 한 줄**이면 되고 배포가 필요 없다.

**예약어 충돌 방지**
- slug는 `[a-z0-9-]`로 검증하고 예약 목록과 대조
- `app/` 최상위 폴더 이름이 예약 목록에 다 들어 있는지 **단위 테스트**
- 레지스트리에 없는 slug는 DB 조회 없이 바로 `notFound()`

⚠️ **Next.js 동적 라우트·캐시 동작은 구현 전에
`node_modules/next/dist/docs/`를 먼저 읽고 확인한다** (AGENTS.md).

**게임·마켓·교육은 지금 kind로 만들지 않는다.** 영상 발행 모델에 안 맞는다.

### 7-2. 공개 판정 (체크리스트 8)

```
status='scheduled' AND rights_status='cleared'
AND publish_at <= now() AND {dba}_publication_enabled = true
```

**`lib/content-public.ts`만 거친다.** `/watch`는 안 건드린다.
전량 로드 후 JS 필터 패턴을 복사하지 않는다 — **SQL에서 필터하고 컬럼을 명시**한다.

**공개 role 허용 목록 — `main_*`, `thumbnail`만**
```
🚫 script        대본은 공개에 나가면 안 된다
🚫 audio_master  음원 원본은 라이선스 문제가 있다
```

### 7-3. 🔴 공개 스위치를 켜기 전 체크리스트 (2026-10-07, 본부 지시)

**아래가 전부 끝나기 전에는 `news_publication_enabled`·`entertainment_publication_enabled`를 켜지 않는다. 켜는 사람은 이 목록을 먼저 본다.**

- [ ] **AI 생성물 표기** — 제니3, **플랫폼별**(공개 화면 + 각 SNS). `ai_generated` 플래그는 이미 있다.
- [ ] **ElevenLabs·Hedra 약관 확인** — 상업 이용 조건(뉴스·엔터가 확인). 그때까지 뉴스는 전부 `held`.
- [ ] **공개 화면 문구 확정** — `lib/content-public-text.ts`에 **중립 영문 임시값**이 들어 있다. 제니3 확정본으로 교체.
- [ ] `content_path_<kind>` slug 결정(TK님) + 예약어 충돌 없음 확인.
- [ ] **라이브 컬럼 확인** — `scripts/probe-public-columns.mjs`(읽기 전용) PASS. 스위치가 닫혀 있으면 공개 쿼리가 실행조차 안 되므로, 이 스크립트가 컬럼 오타(전부 404로 보이는 사고)를 미리 잡는 유일한 방법이다.
- [ ] 스위치를 켠 직후 **응답 본문을 직접 본다**(`script`·`sha256`·`source_ref`·`caption`·`rights_reason` 없음) + `/c/<id>`가 **308**인지(스트리밍이면 meta 태그 리다이렉트로 바뀔 수 있다 — Next.js 문서) 헤더로 확인.

### 7-4. ⑨ 구현 후 한계 (2026-10-07, 지수)

- **공개 판정의 `probe-` 제외는 3중이다**: `getPublicContent`·`listPublicContents`의 SQL `source_ref not ilike 'probe-%'` 둘 + `isPublicRow` 재검사(`source_ref`가 없거나 문자열이 아니면 닫힘). 재검사용으로만 `source_ref`를 읽고 projection에는 싣지 않는다. 각 층을 따로 망가뜨려 테스트가 빨개지는 것 확인.
- **쿼리 오류는 로그에 남긴다**(`[content-public] query error where=… code=… id=…`): 오류 코드와 id만, message·내용 없음. 응답은 그대로 404. 모든 실패가 404라서 "닫힘"과 "쿼리 깨짐"이 구분 안 되던 문제를 로그로만 구분한다.
- **캐시 없음(의도)**: 모르는 최상위 경로(`/wp-admin` 등 slug 모양)는 `platform_config` 1회 읽기 후 404. 점·대문자·예약어·너무 긴 경로는 DB 없이 404. 긴급 정지가 느려지면 안 되므로 slug도 캐시하지 않는다. 로그 소음은 나중에.
- **`app/c/[id]` 폴더를 허용했다**: ⑤ 테스트가 `app/c`를 금지했는데 설계서의 영구 주소가 그 경로다. 단언을 "`app/c`에는 `[id]`만"으로 바꿨다.
- 목록 50건·페이지네이션 없음. `[section]` 목록은 slug는 있는데 그 DBA 스위치가 닫혀 있으면 404(빈 목록이 아니다).
- **용어 대응표 (본부 결정 2026-10-07):** 내부 식별자 접두 `watch_` = OXXOVO 영상 공개 면. **이름은 바꾸지 않는다.** 구 명칭은 사람이 보는 곳(화면 문구·메뉴·챗봇·이메일)에서만 정리한다. DB(테이블 7·컬럼 6·함수 1·트리거 1·설정 키 1·인덱스 약 30), 환경변수, 내부 파일·변수명, 과거 보고서·SQL은 그대로 둔다(근거: 조용한 컬럼 거부 위험, 함수 본문 안의 컬럼명, 과거 기록 왜곡 방지). 라이브 DB 카탈로그 조회(W1, 46행)로 확정.
- **라이브 미검증**: 이 세 페이지는 라이브에서 한 번도 열려 본 적이 없다(열 수 없다). 지금 기대값은 **전부 404**. 308과 응답 본문은 스위치를 처음 켤 때 확인한다.

---

## 8. 어드민

```
/admin/contents  신설
  DBA 필터 [전체][엔터][데일리]
  상태 필터 [전체][⚠️ 조치 필요][⏸ 권리 대기][예약][정지][반송][숨김]

  ⭐ "조치 필요" = unknown
                  + failed 중 재시도가 끝난 것 (attempts >= max
                    또는 next_attempt_at IS NULL)
                  + skipped_*
                  + held_reason='late_for_slot'
     → 담당자가 실제로 할 일이 있는 것만

     🔴 자동 재시도 대기 중인 failed는 뺀다.
        곧 혼자 나갈 것을 "조치 필요"에 넣으면 담당자가 헛걸음한다

  ⏸ "권리 대기" = rights_status != 'cleared' 로 held된 것
     → 담당자가 할 일이 없다(만든 쪽이 고쳐 보낸다). 별도 칸으로 뺀다
     약관 확인 전까지 뉴스가 매일 여기 쌓인다.
     섞으면 "조치 필요"가 항상 가득 차서 아무도 안 본다
```

**라우트 재편 안 한다.** `AdminShell.tsx` 배열에 `group` 필드만 추가.
(항목 추가 시 `admin-i18n`에도 문자열이 필요하다)

**버튼**
```
[정지]      scheduled → held
[반송]      사유 필수
[송출]      held → scheduled, publish_at = now()  (사전 조건 §6-4)
[숨김]      scheduled → hidden
[되살리기]  hidden → held

배포 행 단위 (unknown/failed일 때)
[나갔음]     → posted. external_url 손으로 입력 (https + 플랫폼 도메인 검증)
[다시 보냄]  → queued (attempts=0, next_attempt_at=NULL)
             unknown에서 누르면 중복 위험 — 확인을 받는다
```

**목록에 표시할 것**
- 송출까지 **남은 시간**
- 영상 미리보기
- **held 사유** (계산 + 저장 둘 다)
- 이미 송출된 건의 채널·URL

**실패를 화면에 띄운다.** `lib/use-action-error.ts`(10-03 작성)를 쓴다.

**수정 가능한 필드와 RPC**
```
content_update_meta(content_id, title?, description?, caption?, …)
  → 셋만 고칠 수 있다. 전부 감사 대상
content_set_publish_at(content_id, publish_at, …)
  → 최소 리드 바닥을 다시 검사한다
```
그 외 필드는 어드민에서 고칠 수 없다 (불변 또는 RPC 전용).

### ⑦ 구현 후 한계 (2026-10-07, 지수)

- **어드민 수동 송출은 `content_publish_log`에 행을 남기지 않는다.** `content_release`는 취소됐던 배포 행을 되살릴 때만 로그를 쓴다(`requeued`). 일반 `held→scheduled`에는 로그가 없다. 행위자는 `contents_history`(`app.actor_email`)에서 확인한다. **두 표를 대조해야 "사람이 눌렀는지 크론이 집어갔는지"를 가린다.** 불편해지면 그때 `result` 값을 늘린다(본부 결정 2026-10-07, 옵션 B, SQL 변경 없음).
- **`[송출]`은 게시 버튼이 아니다.** `held→scheduled` + `publish_at=now()`까지고, 게시는 5분 크론이 가드를 거쳐 한다. 확인창 문구도 "대기열에 넣습니다"다.
- **`probe-` 시험 행:** 목록에서 쿼리로 숨기고(`?probe=1`로 보기), `[송출]`·`[다시 보냄]`은 서버 액션이 `source_ref`를 조회해 거절한다(조회 실패도 거절). 테스트로 고정, 가드를 빼면 빨개지는 것 확인.
- **라이브 미검증:** 목록 쿼리의 `content_distributions(...)`·`content_assets(...)` 임베드(PostgREST 관계 조인)와 컬럼명은 가짜 DB 테스트가 못 잡는다. 첫 라이브 로드에서 목록 위 빨간 "목록을 불러오지 못했습니다" 문구가 뜨는지부터 본다. 버튼은 라이브에서 눌러 본 적 없다.
- 목록은 최근 200건까지만 읽는다(넘으면 안내 문구). `조치 필요` 판정은 SQL이 아니라 읽은 행에 대해 JS로 한다.
- `AdminShell` 그룹 필드는 아직 안 넣었다(항목만 추가).
- **미결: `/admin/contents`는 admin-i18n 미적용. 한국어 고정. 다른 어드민 화면과 동작이 다르다.** 영어 전환이 안 된다(TK님 지적 2026-10-07, 라이브 확인 중). ⑩ 끝나고 정리할 때 같이 본다.

### ⑧ 구현 후 한계 (2026-10-07, 지수)

- **반송 알림 미구현. `contents`에 추적 칸(`returned_notified_at` 등)이 없다.** 담당자는 어드민 `[반송]` 목록에서 확인한다. **그러나 반송은 만든 쪽이 모르면 아무 일도 안 일어난다.** ⑨·⑩ 끝나고 바로 할 일 목록 맨 위(본부 지시 2026-10-07). 칸을 늘리는 SQL이 필요하다(TK님 Run).
- **수입 알림은 메일 두 통을 섞지 않는다:** `held`(조치 필요, 첫 줄에 사유) / `scheduled`(송출 예정, UTC). 권리 대기(`held` + rights≠cleared)는 held 메일의 별도 구획에 건수·목록만 있고 제목 건수에는 안 들어간다. 조치 필요가 0건이면 메일 없이 `notified_at`만 써서 쌓이지 않게 한다.
- **`probe-` 행은 알림 대상이 아니다**(쿼리 + 빌더 이중). 시험 행 4개는 `notified_at`이 영구히 NULL로 남는다 — 그것이 "알림 안 보냄"의 증거다.
- 송출 틱 안(①b 다음, 스위치 판단 전)에서 돈다. `notified_at`은 메일 수락 뒤에만 서버가 직접 UPDATE(RPC 없음). 메일은 수락됐는데 UPDATE가 실패하면 다음 틱에 같은 메일이 한 번 더 간다(⑥ `alerted_at`과 같은 한계).
- 문구는 `lib/content-notify.ts`의 `NOTICE_TEXT` 한곳. 영문, 운영자 전용. 한 번에 최대 100건 읽고 넘으면 본문에 안내한다.
- **라이브 미검증:** 실제 메일 발송과 `contents.notified_at` UPDATE는 가짜 DB 테스트뿐이다. 감사 트리거는 `notified_at`을 안 보므로 `contents_history`에 행이 안 생기는 것이 정상이다(라이브에서 확인 필요).

### 반송 알림 구현 (2026-10-08, 지수) — 위 "반송 알림 미구현" 항목을 대체한다

- **칸:** `contents.returned_notified_at timestamptz`(nullable, 기본값 없음). SQL B1~B4, B6을 TK님이 Run, 되읽기·컬럼 ACL 확인 완료(table 단위만, column 단위 GRANT 없음, anon·authenticated·PUBLIC 없음).
- **판정:** 트리거·RPC 없이 비교. `status='returned' AND (returned_notified_at IS NULL OR returned_notified_at < returned_at)`. 반송 -> 정지 복구 -> 재반송은 `returned_at`이 새로 써지므로 다시 알린다. PostgREST는 두 컬럼을 비교하지 못하므로 읽기 두 번(미통지 오래된 순 / 최근 반송 순)을 합쳐 코드에서 같은 판정을 한 번 더 적용한다.
- **기록값:** `now()`가 아니라 **목록을 읽을 때 본 `returned_at`**을 쓴다. 목록 읽기와 기록 사이에 재반송이 들어오면 더 새로운 `returned_at`이 남아 계속 대기 상태가 된다(`now()`로 쓰면 그 알림이 사라진다). 기록은 `status='returned'`인 행에만.
- **별도 단계:** 틱의 1d(held·scheduled 알림 1c 다음). 자체 `try` + 러너 내부 `try`라서 이 단계가 실패해도(예: 컬럼 없음) held·scheduled 알림과 이후 단계는 그대로 돈다. 크론 로그에 `returnedNotified` 건수가 추가됐다.
- **메일:** 제목에 건수, 본문 첫 줄에 최신 건의 사유(나머지는 "and N more"), 어드민 링크 `?status=returned`. 문구는 `NOTICE_TEXT` 한곳. `returned_reason`·제목은 제어문자 제거·길이 제한·이스케이프.
- **`probe-` 행은 대상 아님**(쿼리 + 빌더 이중). `probe-rpc-20261005`는 `returned_notified_at`이 영구히 NULL로 남는다.
- **한계 1:** 메일은 수락됐는데 `returned_notified_at` 기록이 실패하면 다음 틱에 같은 메일이 한 번 더 간다(⑧ `notified_at`과 같은 한계).
- **한계 2:** 실제 메일 경로는 라이브 미검증이다. ⑩의 `[반송]`(시험 영상 삭제 기록)이 처음 돌린다 — 그 행이 info@로 메일 1통을 만드는 것이 정상.
- **한계 3:** 재반송은 `returned_at`이 가장 최신이라 읽기 B(최근 100건)에 잡힌다. 놓치는 경우는 이미 통지된 행이 재반송된 뒤 **한 틱 사이에 100건 넘게** 다른 반송이 들어올 때뿐이다. 반송은 사람이 하는 드문 작업이라 감수한다.

### 알림 메일

```
수입 시   scheduled 건 → "새 콘텐츠 N건, 송출 예정 HH:MM"
          held 건      → "새 콘텐츠 N건 — 조치 필요 (사유: …)"
          ⭐ held인데 "송출 예정"이라고 보내면 담당자가 안 본다
          잦으면 요약으로 합치되 둘을 섞지 않는다
반송 시   담당자에게
unknown·failed 발생 시  "송출 확인 필요 N건"
수신처    info@oxxovo.ai  (우선. 전용 주소는 나중)
```

**🔴 알림 기록을 컬럼에 남긴다 — `alerted_at` / `notified_at`**

```
보낼 대상 = 알림이 필요한 상태 AND alerted_at IS NULL
보낸 뒤 alerted_at = now()
상태가 바뀌면 alerted_at = NULL 로 초기화 (다음 알림이 가능해진다)
```

**기록이 없으면 둘 중 하나가 된다**
| | 결과 |
|---|---|
| 아무 기록 없이 매 틱 보냄 | **info@ 도배** |
| 메모리로만 셈 | 서버리스라 **한 번 실패한 알림은 영영 안 감** |

사람이 모르는 `unknown`이 남는 것이 가장 나쁘다.

**알림 본문은 외부 입력을 HTML 이스케이프한다.**
`title`·`caption`·`rights_reason`은 출처가 보낸 값이다. 그대로 넣으면 안 된다.
**`sendAdminAlert`에는 `to` 인자가 없다** (지수가 `lib/email/admin-alert.ts`
를 읽어 확인). 수신처가 `OPS_ALERT_EMAIL` 또는 `info@oxxovo.ai` 하나로 고정이다.
→ **공용 파일에 선택 인자 `to?`를 추가한다.** 기존 호출은 그대로 동작한다.

⚠️ `info@oxxovo.ai`는 **고객 문의 수신함**이고 inbound 자동응답이 탄다.
루프는 `loopGuard`가 막지만 `email_inbound_log`에 섞인다.
→ **제목 접두사를 고정**한다. `sendAdminAlert` 재사용 검토.

---

## 9. 구현 순서

```
① SQL   CREATE TABLE 6개   ✅ 이름 충돌 없음 확인 (TK Run 10-04)
        — 표 6개·함수 접두사 content_/dist_ 모두 라이브에 없다
        — update_platform_config는 5인자 1행 (오버로드 해소 유지)
        contents / content_assets / content_distributions
        / content_presigns / content_publish_log / contents_history
        + service_role GRANT (같은 SQL에)
        + anon/authenticated REVOKE + RLS ON (정책 없음)
        + platform_config 신규 키 — ⭐ 저장 형식 주의

          social_dispatch_enabled                 = 'true'  ← promo 가드보다 먼저
          news_dispatch_enabled                   = 'false'
          entertainment_dispatch_enabled          = 'false'
          news_publication_enabled                = 'false'
          entertainment_publication_enabled       = 'false'

          news_publish_weekdays   = 'mon,tue,wed,thu,fri'   ⭐ 영문 약어
          news_publish_time       = '07:00'
          news_publish_timezone   = 'Asia/Seoul'            ⭐ IANA 이름

          content_min_lead_minutes             = '120'    (2시간)
          content_dispatch_max_attempts       ⏸ 값 미정
          content_dispatch_backoff_base_minutes ⏸ 값 미정
          content_dispatch_per_tick            = '10'
          content_max_bytes_<kind>_<form>     ⏸ 값 미정
          content_max_bytes_default            = '524288000'  (500MB)
          content_presign_ttl_seconds          = '3600'   (1시간)
          content_presign_rate_per_hour        = '20'
          content_dispatch_item_budget_seconds ⏸ 값 미정 (없으면 기본 상수)

          🚫 content_path_<kind> 는 지금 넣지 않는다
             slug 행이 없어야 그 면이 404로 닫혀 있다 (fail-closed)
             TK님이 주소를 정할 때 그때 넣는다

② SQL   감사 트리거 + 불변 컬럼 보호 트리거
        (만들기 전 NOT NULL 제약 먼저 확인)
③ SQL   RPC — 시그니처를 한 번에 확정 (오버로드 사고 방지)
        각 RPC마다 반드시:
          SECURITY DEFINER
          SET search_path TO 'public'
          REVOKE ALL ON FUNCTION … FROM PUBLIC, anon, authenticated;
          GRANT EXECUTE ON FUNCTION … TO service_role;
        ⭐ 이 프로젝트의 postgres 소유 함수 기본 권한은
          {postgres=X/postgres}로 PUBLIC EXECUTE가 아니다.
          다만 소유자가 바뀌면 달라지므로 명시 REVOKE는 필요하다
④ 코드  수입 · presign · 권리내리기 · 조회 엔드포인트
⑤ 코드  공개 판정 (fail-closed) + lib/content-kinds.ts
⑥ 코드  크론 + 송출 가드 + unknown 정리 + promo 가드
⑦ 코드  어드민 /admin/contents
⑧ 코드  알림 메일 (수입 / 반송 / unknown·failed)
⑨ 코드  공개 페이지 app/[section] + /c/<id> 308
⑩ 검증  라이브 실행 + 되읽기 확인
```

**① 직후 — 테이블 권한·RLS 되읽기**
```
SELECT c.relname, c.relrowsecurity, c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN
 ('contents','content_assets','content_distributions','content_presigns',
  'content_publish_log','contents_history');
```
기대 — `relrowsecurity=true`,
`relacl`에 **postgres(소유자)와 service_role 외 항목이 없을 것.**
**anon·authenticated·빈 grantee(=PUBLIC)가 없어야 한다.**

**③ 직후 — 함수 오버로드·권한 되읽기**
```
SELECT p.oid::regprocedure::text, p.prosecdef, p.proacl, p.proconfig
FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
  AND p.proname ~ '^(content|dist)_'
ORDER BY 1;
```

**🔴 `LIKE 'content\_%'`로 쓰지 않는다.**
표준 문자열에서 역슬래시 두 개 + `_`로 해석되어 **`content\`로 시작하는
이름만 찾는다.** 아무것도 안 잡혀서 **"0행 = 문제없음"으로 읽힌다.**
채팅·마크다운을 거치며 역슬래시가 달라질 위험도 있다.

**기대 — 정확히 15행** (§6-5b 표).
**0행이면 쿼리가 틀린 것이다. 통과가 아니다.**
같은 이름이 2행이면 오버로드다. `p.proconfig`로 `search_path`도 본다.

10-03에 오버로드 2개로 7주간 함수가 안 돌았다. **만든 직후 한 번 읽는다.**

**체크리스트 7**
- `CREATE TABLE`과 `GRANT`가 **같은 SQL에** — 빠뜨리면 `deploy:prod` 게이트가 배포를 막는다
- `anon`/`authenticated` **REVOKE**, RLS 켜고 정책은 두지 않고, `service_role`만 GRANT
  (default privileges는 소유자에 따라 anon 권한이 달라진다 — TK Run 10-04 확인.
   default ACL에 기대지 않고 명시적으로 REVOKE한다)
- 감사 트리거 전에 **NOT NULL 제약 확인** (10-03에 `new_value` NOT NULL로 겪음)
- RPC는 **시그니처를 한 번에** — 파라미터를 나중에 추가하면 오버로드가 생긴다
- **되돌리기 SQL은 별도 블록** (Supabase SQL Editor 함정)

**순서 주의**
- ①②③을 TK님이 Run한 **뒤에** 코드를 푸시한다. 반대면 런타임 에러가 난다
- `social_dispatch_enabled='true'` 행이 **promo 가드 배포(⑥)보다 먼저** — ①에 포함
- ⑤를 ⑦보다 먼저 — 판정 없이 화면을 만들면 승인 없이 공개되는 창이 열린다

### 🔴 완료 조건 (체크리스트 9)

**"표가 있고 함수가 있다"로 끝내지 않는다.**
10-03에 `platform_config_history`가 두 달간 0행이었던 이유가 그것이다.

```
라이브에서 실제로 돌려 행이 생기는 것을 확인한다.

① rights_status='restricted'로 수입 → status='held'가 되고
   어드민 목록에 "권리 미확정"이 뜨는 것
② contents_history에 행이 생기는 것
③ 반송 → GET /api/contents/returns에 뜨는 것
④ 스위치 끄면 송출이 안 되는 것 (스텁으로)
⑤ ⭐ promo 음성 시험 — social_dispatch_enabled=false일 때
   /api/admin/promo/publish 가 dispatch_disabled → 503을 돌려주는 것
   → 가드 배포가 promo를 안 깨뜨렸다는 근거
```

뉴스가 cleared를 보내기 전까지는 **실제 뉴스가 ①의 시험을 대신한다.**

### 🔴 시험 행 규약 — 지울 수 없기 때문에

`contents`·`content_assets`는 **서비스 키로도 지울 수 없다**(§6-7).
R2 객체도 남는다. 그래서 시험 행이 운영 목록을 오염시킨다.

```
시험 행은 source_ref가 'probe-'로 시작한다
시험이 끝나면 returned 또는 hidden으로 둔다 (지우지 않는다)
어드민 기본 목록에서 probe- 를 숨기는 필터를 둔다

🔴 안전 규칙 — Postiz 테스트 채널이 없다
   프로브 행은 rights_status='restricted'로만 수입한다 → 송출 불가
   cleared 프로브가 필요하면 DBA 송출 스위치를 false로 둔 상태에서만
```

**이 규칙이 없으면 프로브가 진짜 OXXOVO 계정에 올라간다.**

10-03 `__audit_probe__`와 같은 방식이다. **남은 행이 "그날 실제로 돌았다"는
증거가 된다.**

---

## 10. 안 하는 것

```
🚫 참가작을 contents로 옮기기 / isRowPublic() 수정
🚫 promo_videos 흡수
🚫 rights override (강제 송출)
🚫 approval_status
🚫 일일 송출 상한
🚫 어드민 라우트 재편
🚫 /watch 경로 변경
🚫 웹훅 푸시
🚫 성과 데이터 회수 (후속 단계)
🚫 새 면(제품·구인·게임·마켓·교육) 테이블 선제작
```

---

## 11. 🔴 잔여 위험

> **일일 송출 상한은 만들지 않기로 했다 (TK 결정, 2026-10-04).**
> 이에 따라 다음 위험이 남는다.
>
> - 출처의 루프(`source_ref`를 매번 새로 만드는 경우) 또는 송출기 자체의
>   버그로 반복 송출이 일어나면, **사람이 인지할 때까지 자동으로 멈추는
>   장치가 없다.** 이를 완화하는 것은 틱당 처리 건수 상한(속도만 늦춤),
>   수입 알림 메일(사람이 읽어야 함), 최소 리드(수입 직후 송출만 막음),
>   긴급 정지 스위치(사람이 눌러야 함)뿐이다.
> - **이미 SNS로 나간 게시는 우리 코드로 회수할 수 없다.**
>   `lib/postiz.ts`에 **게시 취소 기능이 없다**는 뜻이다.
>   Postiz 자체에 삭제 기능이 있는지, 그것이 플랫폼에 올라간 게시까지
>   지우는지는 **확인하지 못했다.** 후속 기능이 될 수 있다.
>   정지는 "다음 호출부터" 적용된다.
> - 재검토 시점: 실제 반복 송출이 한 번이라도 발생하거나,
>   송출 종류·채널이 크게 늘 때.

**🔴 파일 URL은 막히지 않는다**
> 정지·`hidden`·권리 내리기는 **페이지만 닫는다.**
> R2의 공개 URL을 아는 사람은 영상을 그대로 열 수 있다.
> **특히 `blocked` 권리 콘텐츠의 파일이 남아 있다.**
> 비공개 버킷이나 서명 URL로 가지 않는 한 위험으로 남는다.

**✅ YouTube 자동 더빙 — 꺼짐 (TK 확인 10-04)**
> 우리 채널은 **얼리 액세스 상태이고 Enable을 누르지 않았다.**
> 켜지 않는 한 더빙 트랙이 만들어지지 않는다. **지금 위험 없음.**
>
> ⚠️ **나중에 켤 때 반드시 같이 할 것**
> 켜면 YouTube가 영어·인도네시아어 오디오 트랙을 **자동 생성**하고,
> **기본값이 자동 게시**다. 같은 영상 안의 트랙이라 별도 URL은 없다.
>
> `rights_status`·정지·반송·사람의 [송출]은 전부 **우리가 올린 원본에만**
> 걸린다. YouTube가 만든 더빙은 **우리 검수를 안 거치고 공개되며,
> 긴급 정지로도 막을 수 없다**(이미 YouTube 쪽에 있다).
> 뉴스라 고유명사 오역이 그대로 나간다.
>
> → **켜는 즉시 Studio에서 게시 방식을 "Publish manually"로 설정한다.**
> 그게 유일한 방어선이다. (메뉴 경로는 Studio 화면에서 직접 확인한다)
>
> ⚠️ **YouTube만 따로 끌 수는 없다.** 스위치는 DBA별(뉴스·엔터)이다.
> YouTube만 빼려면 **수입 요청의 `allowed_platforms`에서 `youtube`를 뺀다**
> (뉴스 제니가 보내는 값). 설계 변경 없이 된다.

**같은 화면에서 확정한 것 (TK, 10-04)**
```
Audience              → not made for kids
Third-party training  → 해제 (외부 AI 학습에 우리 영상을 쓰지 않는다)
Automatic dubbing     → 켜지 않음
```

**추가 위험**
- **송출 가드 라이브 미검증** — Postiz 테스트 채널 없음
- **마지막 재확인과 `POST /posts` 사이에 초 단위 창**이 있다.
  Postiz 내부 큐 처리 방식은 모른다. "정지한 순간 이후 0건"은 약속할 수 없고,
  **"정지 후 초 단위 이내"**까지만 말할 수 있다
- **`external_url`을 송출 직후 알 수 없다** — Postiz 응답에 URL이 없다
- **사후 차단 모델이다.** 사전 승인이 없으므로 시크릿 유출 시
  담당자가 볼 때까지 나간다 (TK가 위험을 알고 정한 것)

---

## 12. ⏸ 미결

| # | 항목 | 누가 | 구현 차단? |
|---|---|---|---|
| 1 | ~~값 5개~~ | ~~TK~~ | ✅ **종결 10-05** — 120 / 524288000 / 10 / 3600 / 20 |
| 1b | `content_dispatch_max_attempts` / `backoff_base_minutes` | TK | 아니오 — 없으면 재시도 0회 |


| 1d | `rights_status` 하강 방향에 restricted→blocked 허용이 맞나 | TK | 아니오 — §6-7b |
| 2 | 공개 경로 이름 (slug) | TK | 부분 — slug 없으면 그 면만 404 |

| 4 | music kind가 넘기는 것 (음원? 영상?) | 제니2 | 부분 — `surface` CHECK 확장 여부 |
| 5 | ~~`upstream_approval_id` 제공 가능 여부~~ | ~~제니2·뉴스~~ | ✅ **종결 10-05** — 양쪽 UUID. 아래 "upstream_approval_id 확정" 참조 |
| 6 | AI 생성물 표기 의무 (플랫폼별) | 제니3 | 송출 전 필수 |
| 6b | ~~YouTube 자동 더빙~~ | ~~TK~~ | ✅ **종결 10-04** — 켜지 않음. 켤 때 수동 게시로 |
| 7 | ElevenLabs·Hedra 약관 상업 이용 조건 | 뉴스·엔터 | 아니오 — 그때까지 held |
| 8 | ~~default privileges 라이브 확인~~ | ~~TK Run~~ | ✅ **종결 10-04** — 명시적 REVOKE로 간다 |
| 9 | `external_url` 채우는 방법 | 지수 | 아니오 — 비워 두고 시작 |
| 10 | R2 presigned PUT 체크섬 실제 동작 | 지수 | presign 구현 때 시험 |
| 11 | `r2-orphan-sweep.mjs`가 고아 객체를 치우나 | 지수 | 아니오 |
| 12 | Postiz에 게시 삭제 기능이 있나 | 지수 | 아니오 — 후속 기능 후보 |

**구현(①~⑨)을 막는 것은 없다** (#5 종결 10-05). 남은 것은 TK 결정 둘(R2 의존성 승인, 출처별 시크릿 2개).

**✅ `upstream_approval_id` 확정 (본부 10-05, 뉴스 제니 답 반영)**
```
형식   양쪽 다 UUID (사람이 읽는 형식 news-<id>-v1-<시각> 안 씀)
엔터   approvals.id — Human EP final_release 승인 UUID. 실제 승인 기록의 ID
뉴스   보낼 때 생성하는 새 UUID. 뒤에 실제 승인 기록이 없다
       (뉴스 승인은 TK가 눈으로 보고 정하며 기록·ID를 남기는 장치가 없다)
```
**차이 (사실만 기록)** — 양쪽 다 "출처가 주장하는 값"이라는 한계(§6-3)는 같다.
다만 **엔터는 상류에 근거가 있고, 뉴스는 없다.** 뉴스 쪽 승인 체계가 생기면 달라질 일이다.
따라서 뉴스의 `UNIQUE (source, upstream_approval_id)`는 **재사용 방지 장치로 실질 힘이 없다**
(매번 새 값을 만들면 충돌할 일이 없다). 엔터는 상류 ID라 재사용하면 Production OS 쪽도 어긋난다.

**✅ 값 다섯 확정 (TK 10-05)** — ① SQL에 그대로 넣는다
```
content_min_lead_minutes       120          2시간
content_max_bytes_default      524288000    500MB
content_dispatch_per_tick      10
content_presign_ttl_seconds    3600         1시간
content_presign_rate_per_hour  20
```
전부 설정값이라 **코드 수정 없이 나중에 바꿀 수 있다.**

**⑩에 필수는 아닌 값 둘** — 실패가 나야 쓰인다
```
content_dispatch_max_attempts     없으면 재시도 0회 (사람이 [다시 보냄])
content_dispatch_backoff_base_minutes
```

---

## 12-2. Phase 2 (홈 · Discovery) — 기록만 한다. 지금 구현하지 않는다

**결정 (본부·제니2, 2026-10-07): Phase 1을 다시 뜯지 않는다.** 수입 -> 어드민 -> SNS 자동 배포 -> **실제 YouTube 비공개 송출 검증(⑩)** 까지 먼저 끝낸다. 지금 홈을 뜯으면 ⑩이 멈추고, 영상이 왔을 때 코드가 바뀌어 있으면 검증이 섞인다. **홈 설계와 구 경로(`/watch*`) 정리는 같이 Phase 2에서 본다.**

**사업축 7개 + Studio**
- Compete(Tournament) / Entertainment / News(Daily) / Market / Education / Jobs / AI Games.
- Studio는 독립 DBA가 아니다. 현재 Tournament 소속 제작 도구이고, 외부 SaaS화할 때 독립으로 검토한다.
- Production Service(외부 고객 CF·영상 수주)는 Entertainment 내부 사업부다. 독립으로 세지 않는다.

**두 층을 분리한다 (핵심)**
1. 전체 Navigation = 위 사업축 7개.
2. 영상 Discovery 탭 = `[전체][대회][뉴스][영화][드라마][CF][음악]`.
- Market·Jobs·Education·AI Games를 영상 탭에 넣지 않는다(섞으면 메뉴 백화점이 된다).
- **음악 탭**: DB는 `music` / `music_video` 구분을 유지하고, 사용자에게는 "음악" 하나로 합친다.

**배너**: 항목마다 바뀐다. 16:9, 최소 1920x1080, WebP/JPEG, 중앙 safe area. 본부가 규격과 어드민 등록 구조를 정하고 각 DBA가 공급한다. 모바일 전용 asset은 처음부터 의무화하지 않는다.

**Series / Season / Episode**: 드라마 10편이 최신순에 흩어지면 안 된다. **Phase 1에 `series_id` 한 칸을 급하게 넣지 않는다.** Phase 2에서 모델을 제대로 설계한다(제니2·본부 판단). Phase 1 구조가 이를 막지 않는지는 아래 12-3.

**빈 항목**: 숨기지 않는다. 배너 + 짧은 설명 + Coming Soon.

**대회와 콘텐츠**: 같은 홈에 있되 **DB는 합치지 않는다.** 홈은 Aggregation/Discovery Layer다. **대회 데이터를 `contents`에 복제하지 않는다**(§1). 카드에 출처 표시: `COMPETITION` / `OXXOVO ORIGINAL` / `OXXOVO DAILY` / `COMMERCIAL` / `MUSIC`.

**Phase 1 DB가 Phase 2를 막지 않아야 한다**: `source` / `source_ref` / `source_version` / `kind` / approval / assets를 유지하고, Series 관계는 **additive하게** 붙인다.

**지금 홈의 사실(코드, 2026-10-07)**: 루트(`app/page.tsx`)는 `watch_as_home` AND 대회 공개 스위치가 모두 참일 때만 대회 갤러리(`ArenaWatch`)를 보이고, 아니면 랜딩이다. 대회 스위치가 닫힌 채 `watch_as_home`을 켜도 눈에 보이는 변화는 없다(랜딩으로 떨어짐). 루트는 `searchParams`를 받지 않는다(구 `/watch`로 가는 정렬·필터가 `/`에서는 사라진다) — Phase 2에서 홈을 설계할 때 함께 본다.

### 12-3. Phase 1 DB가 Series/Season/Episode를 additive하게 받을 수 있나 (지수 판단, 2026-10-07)

**결론: 막는 것은 없다.** `contents`에 nullable 컬럼과 새 표를 더하는 것만으로 붙는다. 코드를 고치지 않고 판단만 적는다.

**받쳐 주는 것**
- 한 편 = 한 `contents` 행(자기 `source_ref`·자기 승인). `source_version`은 **같은 작품의 수정판**이지 회차가 아니다 -> 에피소드와 섞이지 않는다.
- 불변 컬럼 보호 트리거(`trg_contents_guard`)는 **명시 목록**(`id`, `source`, `source_ref`, `source_version`, `kind`, `upstream_*`, `payload_hash`, `language`, `form`, `ai_generated`, `created_at`)만 막는다. 새 컬럼은 기본이 가변이다.
- 감사 트리거도 9개 필드를 명시한다. `content_import`의 `INSERT`도 컬럼을 명시한다. 새 컬럼을 더해도 기존 경로가 깨지지 않는다.
- 공개·어드민 쿼리는 모두 **컬럼을 명시**한다(`SELECT *` 없음). 새 컬럼이 공개 응답에 새어 나갈 일이 없고, 열려면 의도적으로 컬럼 목록에 넣어야 한다.
- 해시: "null과 absent는 같다"이므로 기존 콘텐츠에 새 선택 필드가 없으면 해시가 안 변한다(재전송이 멱등으로 유지된다).
- `contents -> content_assets`가 `ON DELETE RESTRICT`인 패턴이 이미 있어 새 FK도 같은 방식으로 붙는다.

**Phase 2에서 결정하거나 고쳐야 하는 것 (막는 것이 아니라 일)**
1. **수입 요청 검증**: 최상위·에셋의 **알 수 없는 필드는 400**이고 해시 함수도 던진다. 출처가 시리즈 정보를 보내려면 `validateImportRequest`, 해시의 알려진 필드 목록, `content_import` RPC를 함께 확장해야 한다. 시그니처는 `(source, payload jsonb)`라 **오버로드는 생기지 않는다**(`CREATE OR REPLACE`).
2. **불변 여부**: `series_id`·회차를 `kind`처럼 불변으로 둘지, 나중에 붙일 수 있게 가변으로 둘지. 가변이면 **새 RPC와 감사 필드 추가**가 필요하다(지금 감사 목록은 9개 고정).
3. **✅ 승인 단위 — 확인 완료, 제약 그대로 유지(제니2, 2026-10-07)**: `UNIQUE (source, upstream_approval_id)`는 바꾸지 않는다. 제니2 확인: **approval은 프로젝트/시즌 전체에 두루 쓰는 승인증이 아니라 특정 subject + 특정 version에 대한 승인 증거다.** `Series -> Season -> Episode -> Episode Version -> final_release Approval`이고, Episode 1 v1 = UUID A, Episode 2 v1 = UUID B, Episode 2 v2 = **새 UUID D(B 재사용 안 함)**. 영화도 같다(한 편 = 독립 release subject, Sequel/Collection은 묶음 관계일 뿐 승인은 각각). 따라서 `approval_id_reused`(409)는 시즌 안에서 나지 않는다. 근거: "그래야 수정·반송·재승인 provenance가 안 깨진다." (시즌 단위였으면 데이터가 쌓이기 전인 지금 고치는 것이 훨씬 쌌다 — 물어 둔 보람은 "바꿀 것이 없음"의 확인.)
4. **출처 표시 라벨 — Phase 2 `production_origin` (제니2 안, 2026-10-07, 지금 구현하지 않는다)**: `news`->DAILY, `drama`/`film`->ORIGINAL, `music`/`music_video`->MUSIC은 `kind`에서 나온다. **외부 고객 CF와 자체 CF는 둘 다 `kind=cf`가 맞다 — `kind`는 나누지 않는다.** 구분할 것은 "어떤 사업 관계로 제작됐는가"이고, **세 축으로 분리**한다.
   - `kind` = 콘텐츠 종류(cf, film, drama ...)
   - `production_origin` = 제작 사업 성격: `oxxovo_original` | `client_production`
   - `client_id` = 누구의 의뢰인가
   - **`client_id`를 "외부 수주 여부" 판정값으로 쓰지 않는다**(고객 정보가 없을 수도 있고, 내부 프로젝트에도 파트너가 붙을 수 있다).
   - 홈 카드 라벨: `production_origin = oxxovo_original` -> **OXXOVO ORIGINAL**, `production_origin = client_production` + `kind = cf` -> **COMMERCIAL**.
   - Phase 1 DB는 additive하게 두 컬럼(nullable)을 더하는 것으로 받는다. 수입 요청 검증과 RPC 확장은 12-3의 1번과 같은 종류의 일이다.
5. **정렬·묶기**: 지금 목록은 `publish_at desc, id desc`(최대 50건)다. 시리즈로 묶는 것은 **스키마가 아니라 쿼리 변경**이다.
6. **`kind` 검사 제약**은 값을 열거하므로 새 종류는 `ALTER`가 필요하지만, Series 자체는 새 `kind`가 필요 없다. "음악" 합치기는 화면 문제라 DB 변경이 없다. 대회 탭은 `contents`에 없고(분리 유지) 홈이 두 출처를 합친다.

**Phase 1 안에서 지금 할 것: 없음.** (제니2에게 위 3번 확인만 요청하면 된다.)

---

## 13. 설계서 변경 이력

| 판 | 바뀐 것 |
|---|---|
| 초안 | 사전 승인 모델, approval_status 있음 |
| v2 | TK 결정 — 사후 차단으로 전환, approval_status 삭제, status 하나로 |
| v3 | rights override 삭제 (TK), 권리 내리기 즉시 가능 (TK) |
| 최종 | 지수 지적 17건 반영 — UNIQUE (content_id, platform), failed/attempts/last_error, content_publish_log 신설, 조기 종료(⓪), publish_at 재확인, unknown 정리 주체, ai_generated·payload_hash 컬럼, 수입 한 트랜잭션, 상태 전이표 완성([숨김]·[되살리기]·[송출] 사전조건), 불변 컬럼 보호, sha256 서버 계산, presign 키 접두사 검증, bytes 상한, 복합 커서, promo 오류 코드 분리, 파일 URL 잔여 위험 |
| 최종 b | **지수 2차 14건 + 추가 6건 반영** — presign 키에 source_version, content_assets 불변, 채널당 POST 1회, next_attempt_at + 재시도 점유 조건, cancelled 재큐 + [나갔음]/[다시 보냄], RPC REVOKE/GRANT EXECUTE + 되읽기 확인, 멱등 200 + 현재 상태, language·form·ai_generated 불변 + updated_at 트리거, rights_reason, skipped는 수입 RPC가 결정, ①→②로 순서 교체 + 조기 종료 DBA별, held 알림 문구 구분, "조치 필요" 필터, /c/<id> 공개 판정 + c 예약어 + 버전 연속성, CHECK 3개 추가, log result 값 확장, content_dispatch_per_tick 키, promo 음성 시험 |
| 최종 c | **지수 3차 반영** — ⭐rights_reason을 수입 규격에 추가(없으면 restricted 수입이 전부 CHECK 위반), ⭐presign 재서명 3중 방어(이미 수입된 버전 409 + nonce + 송출 시 sha256 재검), rights_status 하강 강제 트리거, contents·assets DELETE 거부 + FK RESTRICT, 감사 테이블 append-only 트리거(게이트 충돌 회피), update_content_meta RPC, "조치 필요"와 "권리 대기" 분리, 되읽기 SQL 2종(테이블·함수 명시 목록), source_version 3규칙, 알림 1회, 섹션 번호·키 목록 정정 |
| 최종 d | **지수 4차 반영** — 🔴**Postiz 예약 금지(type:'now'만)** — 빠지면 긴급 정지가 무력화된다, 🔴**스케줄 키 저장 형식**(mon,tue,… 영문 약어 / IANA 이름 — 한글이면 조용히 정지), 송출 ⑤에 sha256 재검 삽입, RPC 전체 목록 표(content_*/dist_* 15개) ③ 전 확정, presign 요청 규격, per_tick 없을 때 0건 + 어드민 경고, content_path_<kind>는 ①에서 안 넣는다, rights 방향 규칙 §4-3↔§6-7b 통일 + 멱등 200, cleared인데 reason 오면 400, v2 송출 시 v1 상태 표시, probe- 시험 행 규약, 되읽기 기대값 정정 |
| 최종 e | **지수 5차 반영** — 🔴**content_presigns 표 신설(테이블 6개)** — 없으면 presign RPC가 할 일이 없고 발급 검증·횟수 제한·고아 정리가 전부 불가, 🔴**dist_claim(open_dbas, limit_n, max_attempts)·dist_mark(+external_id, caption_sent, backoff)** 인자 확정, 🔴**되읽기를 정규식으로** (§9 참조) — LIKE 역슬래시는 0행을 내고 "통과"로 읽힌다, 해시 검증을 Postiz 업로드 **앞**으로 + hash_mismatch는 재시도 제외, content_import의 Node/RPC 계산 분담, 프로브 안전 규칙(restricted만·allowed_platforms 비움), 미결 차단 정정(⑩ 전 TK 값 5개), 문구·RPC 이름 통일 |
| 최종 f | **지수 6차 반영** — 🔴`dist_claim(open_dbas→**open_kinds**)` — contents에 DBA 컬럼이 없어 DBA를 받으면 kind→DBA 매핑이 TS·SQL 두 곳에 생기고 새 kind에서 한쪽을 빠뜨리면 영영 안 나간다, 🔴presign TTL·발급횟수를 platform_config 키로(없으면 503), `failed_terminal` 신설로 hash_mismatch 재시도 차단, import는 `expires_at`을 보지 않음(발급기록·객체존재·미소비 셋으로만 판단), `allowed_platforms` 1개 이상 필수(프로브는 restricted로만), ⑩ 전 TK 값 5개 재정리 + presign 2개 추가, 변경이력 정규식 제거 |
| 최종 g | **지수 7차 반영** — 🔴`alerted_at`/`notified_at` 컬럼(없으면 실패한 알림이 영영 안 가거나 info@ 도배), 🔴**한 행씩 점유 루프 + 시간 예산 240초**(일괄 점유하면 틱 후반 행이 처리도 전에 unknown이 된다), `dist_mark` result→상태 변환표 6종, 알림 본문 HTML 이스케이프 + `sendAdminAlert`의 `to` 인자, "조치 필요"에서 재시도 대기 중 failed 제외, presign 한도를 source 전체 단위로도, `content_presign` 반환값 명시 |
| 최종 h | **YouTube 자동 더빙 추가** — 더빙은 rights_status·정지·반송·긴급 스위치를 전부 우회한다(이미 YouTube 쪽에 있어 회수 불가). "수동 게시로 변경"이 유일한 방어선이라 §11 잔여 위험과 ⑩ 전 운영 설정 체크리스트에 명시, 미결 #6b·#6c 신설 |
| 최종 i | **유튜브 설정 확정 (TK 10-04)** — 자동 더빙은 얼리 액세스 미활성(지금 위험 없음, 켤 때 수동 게시 조건 명시), Audience=not made for kids, Third-party training 해제. 미결 #6b 종결 |
| 최종 j | **지수 8차 반영** — 알림 발송 단계 ①b 신설(RPC 추가 없이 서버 액션 직접 UPDATE → 15개 유지, 전송 실패 시 alerted_at 안 씀), `alerted_at` 초기화를 **트리거**로(dist_mark만으론 claim·sweep·requeue 경로가 샌다), `failed_terminal`의 "attempts=max" 삭제(dist_mark에 max 인자가 없다 → `next_attempt_at=NULL`로), `sendAdminAlert`에 `to?` 선택 인자 추가 확정(현재 인자 없음을 코드로 확인), 시간 예산 숫자를 문서에서 빼고 선언값 기반 계산 + `item_budget_seconds` 키, `dist_mark(result='skipped')` 삭제, 더빙 문구 2곳 정정(유튜브만 끄려면 allowed_platforms, 메뉴 경로 단정 제거) |
| 최종 k | **platform_config 값 5개 확정 (TK 10-05)** — min_lead 120분 / max_bytes_default 500MB / per_tick 10 / presign_ttl 3600초 / presign_rate 20회. 미결 #1·#1c·#1e·#3 종결 |
| **최종 l** | **`upstream_approval_id` 확정 (본부 10-05, 뉴스 제니 답)** — ①미결 #5 종결: 양쪽 다 UUID(엔터 `approvals.id` / 뉴스 보낼 때 생성), 형식 검증은 **Node 코드에서 소문자 UUID만 받고 틀리면 400**(컬럼 CHECK 없음: 시험 행 2건이 이미 UUID가 아니고 NOT VALID는 착각만 남기며 RPC 재정의 비용이 과함. 대문자는 UNIQUE 우회라 거절). ②**엔터와 뉴스의 차이**: 엔터는 상류에 실제 승인 기록이 있고 뉴스는 없다(TK 육안 승인, 기록·ID 장치 없음). 둘 다 "출처가 주장하는 값"이라는 한계는 같다. 뉴스의 `UNIQUE (source, upstream_approval_id)`는 재사용 방지로 실질 힘이 없다. ③**뉴스 재시도 규칙: UUID는 `(source_ref, source_version)`당 하나** — 만들어 기록해 두고 같은 버전 재전송에는 그 값을 그대로 쓴다, v2에서만 새로 만든다. 안 그러면 재시도마다 `payload_hash`가 달라져 행은 들어갔는데 409가 난다. `upstream_approval_id`는 해시에서 빼지 않는다(내용의 일부이고, 빼면 승인 ID만 바꾼 재전송이 멱등으로 통과) |

---

*실측 근거: 지수 10-03 보고(`reports/jisu_hq_2026-10-03_eod.md`), 10-04 조사*
*결정: TK 10-04 / 제니2 10-04 / 뉴스 제니 10-04*
