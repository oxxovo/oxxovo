# 뉴스 수입 규격 (news_desk -> OXXOVO) -- ⑩ 시험 1건용

작성: 지수(메인, 앱 레포), 2026-10-10. 근거는 전부 이 레포의 코드(`app/api/contents/*`, `lib/content-*.ts`)와 RPC SQL이다. 설계서는 `reports/phase1_design_2026-10-04.md` §3·§6.
**이 파일에 비밀 키 값은 없다. 키는 TK님이 따로 전달한다.**

> **검증 수준 표시 (먼저 읽을 것)**
> - 실행해 본 것: `scripts/probe-contents.mjs`가 **`production_os` 출처**로 10-06에 라이브에서 presign -> R2 PUT -> import -> 재전송 -> 충돌 -> rights-down -> status -> returns를 통과했다(`reports/jisu_hq_2026-10-06_eod.md` 37줄).
> - **`news_desk` 출처로는 라이브에서 돌려본 적이 없다.** 뉴스만의 차이(발행 시각 자동 계산, `not_before` 금지)는 코드로만 읽었다.
> - **이 파일의 curl·Node 예시는 이 파일을 쓰면서 실행하지 않았다.** 요청 모양은 위 시험 스크립트와 라우트 코드에서 가져왔다. 각 예시에 "실행 여부"를 적었다.

## 0. 한눈에

```
1. POST https://www.oxxovo.ai/api/contents/presign   -> key + upload_url + required_headers
2. PUT  <upload_url>                                   -> R2에 파일 올리기 (우리 서버 아님)
3. POST https://www.oxxovo.ai/api/contents/import     -> 201 created
(나중) GET  https://www.oxxovo.ai/api/contents/returns?since=<cursor>   -> 반송 폴링
(본부 신호 후에만) POST https://www.oxxovo.ai/api/contents/rights-down
```

도메인은 `www.oxxovo.ai` 하나만 쓴다(다른 호스트는 308로 넘어가며 `Authorization` 헤더가 유지되지 않을 수 있다).

## 1. 인증

- 모든 요청에 헤더 `Authorization: Bearer <비밀 키>`. 키 값은 **TK님이 따로 전달**한다(이 파일·메신저 기록·레포에 남기지 않는다).
- 키가 **출처를 결정**한다. 요청 본문에 `source`를 넣지 않는다(넣으면 `unknown_field:source`). 이 키는 `news_desk`로 인식되고, `kind`는 `news`만 보낼 수 있다(`kind_not_allowed_for_source`).
- 키가 없거나 틀리거나 형식이 틀리면 **이유를 알려 주지 않고** `401 {"error":"unauthorized"}`.
- 키는 32자 이상이어야 서버가 받아들인다.
- **키 확인(부작용 없음):** 아래 명령이 `200`이면 키가 맞고, `401`이면 키가 틀렸거나 서버에 없다. 읽기 전용이며 자기 출처의 반송 목록만 돌려준다.
  ```
  curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $NEWS_DESK_SECRET" "https://www.oxxovo.ai/api/contents/returns?limit=1"
  ```
  (실행 여부: **이 파일에서는 실행 안 함.** `production_os` 키로 같은 엔드포인트가 10-06에 200을 낸 기록만 있다.)

## 2. 이번 시험 건 고정값

| 필드 | 값 | 비고 |
|---|---|---|
| `source_ref` | `step10-news-20261010` | **제안값 -- 본부 확정 필요.** 형식 `^[A-Za-z0-9._-]{1,128}$`. `probe-`로 시작하면 안 된다(시험 행 제외 규칙). **한 번 쓰면 다른 내용으로 못 쓴다.** |
| `source_version` | `1` | 정수 |
| `kind` | `"news"` | |
| `form` | `"short"` | 뉴스는 `short`만 받는다(`long`은 `form_invalid`) |
| `rights_status` | `"cleared"` | 이번 1건에 한해 본부 승인. `rights_reason`은 **보내지 않는다**(`cleared`인데 사유가 오면 400 `rights_reason_forbidden`) |
| `allowed_platforms` | `["youtube"]` | **youtube 하나만.** 다른 플랫폼이 섞이면 그 행이 먼저 실제 계정에 나갈 수 있다. 빈 배열 `[]`은 사이트 전용이라 이번 시험에는 쓰지 않는다. |
| 에셋 `role` | `"main_16x9"` | 9:16을 16:9 캔버스 가운데에 넣은 파일(좌우 여백) |
| 에셋 `bytes` | `9008217` | 실제 파일 크기와 정확히 같아야 한다(서버가 R2에서 직접 비교, 다르면 422 `asset_size_mismatch:main_16x9`) |
| 에셋 `width` / `height` | `1920` / `1080` | 16:9 비율 검증(허용 오차 2%). 둘 다 보내거나 둘 다 생략. |
| 에셋 `duration_sec` | `31.02` (뉴스 쪽 측정값, 2026-10-10 수신) | 양수 숫자 |
| 에셋 `file_format` | `"mp4"` | |
| 에셋 `sha256` | `b6266d6c1abb38394fb863ca58a4aaf75ce290e8b658cf75b562f90ea0d550e6` (뉴스 쪽 계산값, 수신) | 소문자 hex 64자. 서버가 R2에 올라간 바이트로 다시 계산해 비교한다 |
| **⑩ 시험에서는 썸네일을 보내지 않는다** | -- | **본부 결정 2026-10-12: ⑩ 시험은 영상 1개(`main_16x9`)만 수입한다(뉴스·세종에도 전달됨).** 아래 썸네일 행들과 본문 예시의 `thumbnail` 에셋은 **이번 시험에는 해당 없음**(썸네일 규격은 나중 수입용으로 남겨 둔다). 썸네일을 보내면 ⑩ 실행표 B3이 멈춤으로 판정한다. |
| **썸네일 에셋 (선택)** `role` | `"thumbnail"` | 역할 이름은 정확히 `thumbnail`. 영상당 **최대 1개**(`assets_duplicate_role`) |
| 썸네일 `bytes` | `172346` | 필수(없으면 `asset_invalid:thumbnail`) |
| 썸네일 `sha256` | `8e07e14683688c51a75e8173dc4b8994904fae3444d5433157beae61a8eaa2c2` (수신) | 필수, 소문자 hex 64자 |
| 썸네일 `file_format` | 파일 종류에 맞게 `"jpg"` 또는 `"png"` | 선택. **실제 파일이 어느 종류인지는 뉴스 쪽이 알려 줄 것** |
| 썸네일 `width`/`height` | 선택 (둘 다 보내거나 둘 다 생략) | 썸네일은 비율을 검증하지 않는다 |
| 썸네일 presign `content_type` | 실제 파일 종류 (`image/jpeg` 또는 `image/png`) | 서버는 `type/subtype` 형식만 검사하고 역할별 허용 목록은 없다 |
| `spec_version` | `1` | |
| `language` | `"ko"` | 허용: `ko en ja ko-KR en-US ja-JP` (뉴스 쪽 사실대로) |
| `ai_generated` | 뉴스 쪽 사실대로 `true`/`false` | boolean만 (문자열 안 됨) |
| `title` | 뉴스 쪽 실제 제목 | 비어 있으면 안 된다. **YouTube 제목은 이 값에서 만들어지며 2~100자**(100코드포인트로 잘리고, 꺾쇠·제어문자는 제거). 시험 표시(`[시험] ...`)는 본부가 수입 후 어드민에서 바꾼다 -- **뉴스 쪽이 넣지 않는다.** |
| `description`, `caption` | 선택 | 문자열 또는 생략/`null`. `caption`이 YouTube 설명으로 간다고 가정하지 말 것(어떻게 매핑되는지는 ⑩에서 확인할 항목) |
| `upstream_approved_by` | 승인자 이름/식별자 | 비어 있으면 안 된다 |
| `upstream_approved_at` | ISO 8601 시각 | 예 `2026-10-10T18:00:00Z` |
| `upstream_approval_id` | **소문자 UUID** | `(source_ref, source_version)`당 하나. **같은 버전의 재전송에는 같은 값을 그대로 쓴다.** 바꾸면 내용 해시가 달라져 409가 난다. |

**보내면 안 되는 것:** `not_before`(뉴스는 400 `not_before_forbidden_for_news` -- 발행 시각은 서버가 정한다), `source`, `status`, `publish_at`, 목록에 없는 모든 필드(`unknown_field:<이름>` 400, 에셋 안쪽은 `asset_unknown_field:<이름>`).

**서버가 정하는 것:** `source`(키로), 발행 시각(`publish_at`, 뉴스 고정 슬롯 -- 설정 `news_publish_*`와 최소 선행 시간 기준), 콘텐츠 상태(`scheduled` 또는 `held`; 슬롯을 놓치면 `held`/`late_for_slot`). **수입 직후 본부가 어드민에서 정지한다**(스위치는 닫혀 있다). 뉴스 쪽이 할 일은 아니다.

## 3. 100MB 사전 검사 규칙 (보내기 전에)

- **송출 상한 = 104,857,600 바이트 (100 MiB).** 이 크기를 넘는 에셋은 수입은 되어도 해당 채널 행이 `skipped_oversize`가 되어 **SNS로 나가지 않는다.** `allowed_platforms`가 `["youtube"]` 하나뿐이면 이 시험 건에서는 아무것도 안 나간다는 뜻이다.
- **규칙: 파일 크기 > 104,857,600 이면 보내지 않는다** (presign도 요청하지 않는다).
- 수입 상한(`content_max_bytes_default`)은 현재 524,288,000이고 뉴스 숏폼은 ⑩ 이후 100MB로 낮출 예정이다. 현재 설정으로는 100~500MB가 presign·import를 통과하므로 **서버가 막아 주지 않는다** -- 뉴스 쪽 사전 검사가 유일한 방어선이다.
- 이번 파일은 9,008,217 바이트(약 8.6 MiB)라 해당 없음.

## 4. 1단계 -- presign

`POST https://www.oxxovo.ai/api/contents/presign`

헤더: `Authorization: Bearer <키>`, `Content-Type: application/json`

본문(다섯 필드 전부 필수, 다른 필드 금지):
```json
{
  "source_ref": "step10-news-20261010",
  "source_version": 1,
  "role": "main_16x9",
  "bytes": 9008217,
  "content_type": "video/mp4"
}
```
- `source_version`·`bytes`는 **숫자**(문자열 안 됨). `content_type`은 `^[a-z]+/[a-z0-9.+-]+$`.

성공 `200`:
```json
{
  "key": "imports/news_desk/step10-news-20261010/v1/main_16x9-<무작위 32자>",
  "upload_url": "https://<R2 서명 URL>",
  "expires_at": "<ISO 시각>",
  "required_headers": { "Content-Type": "video/mp4", "Content-Length": "9008217" }
}
```
- **`key`는 수입(3단계)의 `assets[].key`에 그대로 쓴다.** 직접 만들지 않는다.
- 만료는 설정값(현재 3600초 기준으로 기록돼 있음)이며 `expires_at`이 정답이다. 서명은 **`Content-Type`과 `Content-Length`를 포함**한다.
- **썸네일을 함께 보낸다면 presign과 PUT을 에셋마다 따로 한다.** 영상용 호출 한 번, 썸네일용(`"role":"thumbnail"`, `"bytes":172346`, `"content_type":"image/jpeg"` 또는 `"image/png"`) 호출 한 번. 응답의 `key`가 각각 다르고, 두 `key`를 import의 해당 에셋에 각각 쓴다. 이 둘은 **서로 바꿔 쓸 수 없다**(`presign_invalid:<role>`).
- **제한:** 같은 `source_ref`로 시간당, 그리고 출처 전체로 시간당 발급 횟수 제한(현재 20회, 설정값 확인됨)이 있다. 넘으면 `409 rate_limited`. 재시도 때 불필요하게 새로 받지 않는다.

오류:
| HTTP | `error` | 뜻 |
|---|---|---|
| 401 | `unauthorized` | 키 없음/틀림 |
| 400 | `json_invalid`, `body_unreadable`, `request_invalid` | 본문이 JSON이 아님/객체가 아님/`source_ref` 형식 오류 |
| 400 | `unknown_field:<이름>` | 허용 안 된 필드 |
| 400 | `source_ref_invalid`, `source_version_invalid`, `role_invalid`, `bytes_invalid`, `content_type_invalid` | 타입/값 오류 |
| 413 | `body_too_large` | 본문 100만 자 초과 |
| 409 | `already_imported` | 이 `(source_ref, source_version)`은 이미 수입됨 -> 새 버전이 필요 |
| 409 | `rate_limited` | 발급 횟수 초과 |
| 422 | `bytes_over_limit` | 서버 전체 최댓값 초과(현재는 10GB라 사실상 안 걸림 -- **3절 사전 검사를 믿지 말고 서버에 기대지 말 것**) |
| 503 | `r2_not_configured`, `config_missing:<키>`, `config_invalid:<키>` | 서버 설정 문제(재시도 의미 없음, 본부에 알릴 것) |
| 500 | `internal_error` | 서버 오류(본문에 상세 없음) |

예시 (curl) -- **실행 여부: 이 파일에서 실행 안 함. 요청 모양은 `production_os`로 10-06 라이브 통과한 스크립트와 동일.**
```bash
curl -s -X POST https://www.oxxovo.ai/api/contents/presign \
  -H "Authorization: Bearer $NEWS_DESK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"source_ref":"step10-news-20261010","source_version":1,"role":"main_16x9","bytes":9008217,"content_type":"video/mp4"}'
```

## 5. 2단계 -- R2에 PUT (우리 서버를 거치지 않는다)

`PUT <1단계 응답의 upload_url>`

- 헤더는 **1단계 응답의 `required_headers`를 그대로**: `Content-Type: video/mp4`, `Content-Length: 9008217`. 하나라도 다르면 R2가 서명 불일치로 거절한다.
- **`Authorization` 헤더를 넣지 않는다**(서명 URL이 인증이다). 본문은 파일 바이트 그대로.
- 성공은 R2의 `200`(10-06에 `production_os` 시험으로 확인: "서명된 PUT이 R2에서 200"). 실패하면 R2의 XML 오류가 온다 -- 만료(`expires_at` 이후)이거나 헤더 불일치가 대부분이다. **실패하면 1단계부터 다시** 받는다(키가 새로 나온다. 이전 키는 쓰지 않는다).

예시 (curl) -- **실행 여부: 이 파일에서 실행 안 함.**
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT "$UPLOAD_URL" \
  -H "Content-Type: video/mp4" -H "Content-Length: 9008217" \
  --data-binary @news_test_16x9.mp4
```
(`curl -T`/`--data-binary` 모두 가능. 파일 크기는 정확히 9008217 바이트여야 한다.)

## 6. 3단계 -- import

`POST https://www.oxxovo.ai/api/contents/import`

헤더: `Authorization: Bearer <키>`, `Content-Type: application/json`

본문(이번 시험 건; **`<...>` 자리는 뉴스 쪽 실제 값**):
```json
{
  "spec_version": 1,
  "source_ref": "step10-news-20261010",
  "source_version": 1,
  "kind": "news",
  "form": "short",
  "language": "ko",
  "rights_status": "cleared",
  "title": "<뉴스 쪽 실제 제목>",
  "description": "<선택>",
  "caption": "<선택>",
  "upstream_approved_by": "<승인자>",
  "upstream_approved_at": "<ISO 시각>",
  "upstream_approval_id": "<소문자 UUID, 이 (ref, version)당 하나>",
  "allowed_platforms": ["youtube"],
  "ai_generated": true,
  "assets": [
    {
      "role": "main_16x9",
      "key": "<1단계 응답의 key>",
      "file_format": "mp4",
      "bytes": 9008217,
      "duration_sec": <ffprobe 측정값>,
      "width": 1920,
      "height": 1080,
      "sha256": "<소문자 hex 64자>"
    },
    {
      "role": "thumbnail",
      "key": "<썸네일 presign 응답의 key>",
      "file_format": "<jpg 또는 png>",
      "bytes": 172346,
      "sha256": "8e07e14683688c51a75e8173dc4b8994904fae3444d5433157beae61a8eaa2c2"
    }
  ]
}
```
- **썸네일은 사이트용으로 저장될 뿐 YouTube로 보내지지 않는다.** 송출 코드는 영상 파일과 제목·설명만 보낸다(썸네일을 어디에도 보내지 않음). YouTube가 자동으로 고르는 화면이 썸네일이 된다. 공개 화면이 열리는 날에는 이 썸네일이 공개 노출 허용 역할(`main_*`, `thumbnail`)이라 그대로 나온다.
- **썸네일 수입 경로는 단위 시험까지만 있고 라이브로 돌린 적이 없다.** 문제가 생기면(예: `presign_invalid:thumbnail`) 아직 `created`가 안 된 상태이므로 썸네일을 빼고 같은 `source_version`으로 다시 보낼 수 있다. **이미 `created`가 된 뒤에는 같은 버전에 다른 내용을 보낼 수 없다**(`payload_conflict`).
- 모르는 필드는 오류다(무시하지 않는다). 에셋에 `media_type`·`url`을 넣지 않는다(서버가 만든다).
- 서버는 R2에 **실제로 올라간 파일**의 크기와 sha256을 직접 계산해 당신이 보낸 값과 비교한다. 파일이 없거나 다르면 수입되지 않는다.
- 최대 본문 100만 자, 수입 요청 처리 시간 최대 300초(큰 파일 해시 계산 때문).
- **멱등:** 같은 `(source_ref, source_version)`을 **같은 내용**으로 다시 보내면 `200`과 `"idempotent": true`. **다른 내용**으로 보내면 `409 payload_conflict` -- **끝난 응답**이다. 새 `source_version`이 필요하다. 타임아웃 뒤 재시도는 안전하다(같은 내용·같은 `upstream_approval_id`).

성공 `201`:
```json
{
  "outcome": "created",
  "id": "<콘텐츠 uuid>",
  "status": "scheduled",
  "rights_status": "cleared",
  "held_reason": null,
  "channels": [ ... 채널별 { platform, status } ... ],
  "idempotent": false
}
```
- `status`는 `scheduled` 또는 `held`(슬롯 마감 후 도착이면 `held`, `held_reason:"late_for_slot"`). `channels`의 YouTube 행이 `queued`가 정상. **`skipped_no_asset`/`skipped_oversize`이면 보낸 파일이 YouTube용이 아니거나 100MB 초과라는 뜻이다** -- 본부에 알린다.
- 응답 본문의 필드 전체는 RPC 반환값(`content_import`)에서 읽은 것이고, 이 출처로 받아 본 라이브 응답 예시는 없다.

오류:
| HTTP | `error` | 뜻 / 조치 |
|---|---|---|
| 401 | `unauthorized` | 키 |
| 400 | `json_invalid`, `request_invalid`, `spec_version_invalid` | 본문/`spec_version`이 1이 아님 |
| 400 | `unknown_field:<이름>`, `asset_unknown_field:<이름>` | 허용 안 된 필드 |
| 400 | `<필드>_not_string/number/boolean/timestamp`, `allowed_platforms_not_array`, `allowed_platforms_duplicate`, `assets_not_array`, `assets_duplicate_role` | 타입 오류 |
| 400 | `source_ref_invalid`, `source_version_invalid`, `kind_invalid`, `kind_not_allowed_for_source`, `form_invalid`, `language_invalid` | 값 오류 |
| 400 | `rights_status_invalid`, `rights_reason_forbidden`, `rights_reason_required`, `rights_reason_invalid` | 권리 관련 |
| 400 | `title_invalid`, `text_invalid`, `upstream_approved_by_invalid`, `upstream_approved_at_invalid`, `upstream_approval_id_invalid`, `ai_generated_invalid` | 필드 오류 |
| 400 | `allowed_platforms_required`, `allowed_platforms_invalid` | 배열이 없거나 허용 값(youtube/instagram/tiktok/x) 아님 |
| 400 | `not_before_forbidden_for_news` | 뉴스는 `not_before`를 보내지 않는다 |
| 400 | `assets_required`, `main_asset_required`, `asset_role_invalid`, `asset_invalid:<role>[:sha256\|:key\|:size\|:aspect]` | 에셋 오류(`:aspect`는 16:9 비율 불일치) |
| 422 | `asset_not_uploaded:<role>`, `asset_size_mismatch:<role>`, `asset_sha256_mismatch:<role>` | R2에 파일이 없음/크기 다름/해시 다름 -> 2단계부터 다시 |
| 409 | `payload_conflict` | 같은 버전에 다른 내용 -> 새 버전 |
| 409 | `approval_id_reused`, `concurrent_import` | 다른 콘텐츠가 쓴 승인 ID / 동시 수입 |
| 409 | `presign_invalid:<role>` | `key`가 이 출처·ref·버전·role에 발급된 것이 아님/이미 소비됨/크기 다름 |
| 422 | `bytes_over_limit` | 수입 상한 초과 |
| 422 | `approval_not_newer` | (버전 2 이상) 승인 시각이 직전 버전 반송 시각보다 늦지 않음 |
| 400/503 | `channels_invalid:*`, `config_missing:*`, `config_invalid:*`, `config_unreadable` | 서버 설정 문제는 503 -- 본부에 알린다 |
| 502 | `storage_unavailable` | R2 확인 실패(재시도 가능) |
| 500 | `internal_error` | 서버 오류 |

예시 (Node 18+; 키는 환경변수로만, 출력·저장하지 않는다) -- **실행 여부: 이 스크립트는 실행 안 함. 구조는 `scripts/probe-contents.mjs`(production_os, 10-06 라이브 통과)와 같다.**
```js
import { readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'

const BASE = 'https://www.oxxovo.ai'
const SECRET = process.env.NEWS_DESK_SECRET            // 값은 TK님이 따로 전달
if (!SECRET) throw new Error('NEWS_DESK_SECRET not set')

const FILE = './news_test_16x9.mp4'
const buf = readFileSync(FILE)
const bytes = buf.byteLength                            // 9008217 이어야 한다
if (bytes > 104857600) throw new Error('over 100MB: do not send')
const sha256 = createHash('sha256').update(buf).digest('hex')

const ref = 'step10-news-20261010'                     // 본부 확정 후
const post = (path, body) => fetch(BASE + path, {
  method: 'POST',
  headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

// 1) presign
const p = await post('/api/contents/presign', { source_ref: ref, source_version: 1, role: 'main_16x9', bytes, content_type: 'video/mp4' })
const pj = await p.json()
if (p.status !== 200) throw new Error(`presign ${p.status} ${JSON.stringify(pj)}`)

// 2) PUT (서명된 헤더 그대로, Authorization 없음)
const put = await fetch(pj.upload_url, { method: 'PUT', headers: pj.required_headers, body: buf })
if (put.status !== 200) throw new Error(`PUT ${put.status}`)

// 3) import  (upstream_approval_id 는 한 번 만들어 기록해 두고, 재시도에는 같은 값을 쓴다)
const approvalId = process.env.UPSTREAM_APPROVAL_ID ?? randomUUID()
const imp = await post('/api/contents/import', {
  spec_version: 1, source_ref: ref, source_version: 1, kind: 'news', form: 'short', language: 'ko',
  rights_status: 'cleared',
  title: '<뉴스 쪽 실제 제목>',
  upstream_approved_by: '<승인자>', upstream_approved_at: new Date().toISOString(), upstream_approval_id: approvalId,
  allowed_platforms: ['youtube'], ai_generated: true,
  assets: [{ role: 'main_16x9', key: pj.key, file_format: 'mp4', bytes, duration_sec: Number(process.env.DURATION_SEC), width: 1920, height: 1080, sha256 }],
})
console.log('import', imp.status, JSON.stringify(await imp.json()))
process.exitCode = imp.status === 201 || imp.status === 200 ? 0 : 1   // process.exit() 대신 exitCode (Windows 소켓 종료 문제)
```
- `upstream_approved_at`을 호출마다 `new Date()`로 만들면 **재시도 때 내용이 달라져 409**가 난다. 첫 호출 값을 기록해 재사용한다(위 예시는 단순화한 것).

## 7. rights-down (본부 신호 후에만 호출)

**본부가 신호하기 전에 호출하지 않는다.** 송출 전에 호출하면 시험 자체가 막힌다(콘텐츠가 `held`가 되고 `queued` 행이 취소된다).

`POST https://www.oxxovo.ai/api/contents/rights-down`

헤더: `Authorization: Bearer <키>`, `Content-Type: application/json`

본문(네 필드 전부 필수, 다른 필드 금지):
```json
{
  "source_ref": "step10-news-20261010",
  "source_version": 1,
  "rights_status": "blocked",
  "rights_reason": "<사유, 비어 있지 않고 2000자 이하>"
}
```
- `rights_status`는 `"restricted"` 또는 `"blocked"`만. 이번에는 `"blocked"`. **권리는 내려가기만 한다** -- `cleared`로 되돌리는 것은 불가능하고(`400 rights_up_denied`), 올리려면 새 버전으로 다시 수입해야 한다.
- 같은 값을 두 번 보내면 `200`과 `outcome:"idempotent"`.
- 성공 `200`: `outcome:"lowered"`, `id`, `status`(콘텐츠가 `scheduled`였으면 `held`로 바뀜), `rights_status`, `cancelled`(취소된 `queued` 행 수), `sending`, `posted`(이미 나간 게시 목록).
- 오류: `401 unauthorized`, `400 request_invalid`(ref 형식/버전), `400 rights_up_denied`(값이 restricted/blocked가 아니거나 올리려 함), `400 rights_reason_required`, `404 not_found`(없는 `(ref, version)` 또는 다른 출처의 행), 필드 형식 오류는 `source_ref_invalid`/`source_version_invalid`/`rights_status_invalid`/`rights_reason_required`, `unknown_field:<이름>`.
- **검증 수준:** `production_os`로 `lowered`(+배포 행 `cancelled`)와 올리기 `400`은 10-06에 라이브 통과. **`cleared`에서 `blocked`로 한 번에 내리는 경우는 코드로만 확인**(RPC가 순위 비교로 허용, DB 트리거도 허용)했고 라이브에서 본 적 없다.
- 본부가 정한 순서: 송출 확인 -> Studio 삭제 -> 어드민 [반송] -> **rights-down**.

예시 (curl) -- **실행 여부: 실행 안 함(본부 신호 전 호출 금지).**
```bash
curl -s -X POST https://www.oxxovo.ai/api/contents/rights-down \
  -H "Authorization: Bearer $NEWS_DESK_SECRET" -H "Content-Type: application/json" \
  -d '{"source_ref":"step10-news-20261010","source_version":1,"rights_status":"blocked","rights_reason":"step10 test content; blocked after test"}'
```

## 8. 반송 폴링

`GET https://www.oxxovo.ai/api/contents/returns?since=<cursor>&limit=<n>`

헤더: `Authorization: Bearer <키>` (본문 없음)

- `limit`: 1~9999 숫자 문자열, 서버 최대 100, 기본 50(잘못된 값은 `400 limit_invalid`).
- `since`: 이전 응답의 `next_cursor`를 **그대로** 넣는다(해석하지 말 것). 처음에는 생략. 잘못된 값은 `400 since_invalid`.
- 자기 출처의 `status='returned'` 행만, 반송 시각 오름차순.

응답 `200`:
```json
{
  "items": [
    { "id": "<uuid>", "source_ref": "...", "source_version": 1, "returned_reason": "...", "returned_at": "<ISO 시각>" }
  ],
  "next_cursor": "<불투명 문자열 또는 null>"
}
```
- **새 항목이 없으면 같은 커서를 그대로 돌려준다**(받은 `since`를 에코, 처음이면 `null`). 계속 그 값으로 폴링하면 된다.
- **`has_more`가 없다.** `items.length < limit`이 될 때까지 계속 호출한다.
- **중복 제거 키는 `id` 단독이 아니라 `(id, returned_at)`.** 반송 -> 복구 -> 재반송이면 같은 `id`가 새 `returned_at`으로 다시 온다.
- 커서를 저장하는 쪽(뉴스)이 책임진다. 서버는 상태를 기억하지 않는다. 읽기 전용이라 몇 번 호출해도 부작용이 없다.
- 호출 한도: 앱 코드에는 요청 제한이 없다(방화벽 규칙은 레포로 증명할 수 없다). 합리적 간격(분 단위)을 권한다.
- 오류: `401`, `400 limit_invalid`, `400 since_invalid`, `500 internal_error`.

예시 (curl) -- **실행 여부: 이 파일에서 실행 안 함. `production_os` 키로 `returns` 200은 10-06에 확인(커서 포함).**
```bash
curl -s -H "Authorization: Bearer $NEWS_DESK_SECRET" "https://www.oxxovo.ai/api/contents/returns?limit=50"
# 다음 호출: ...?since=<위 응답의 next_cursor>&limit=50
```

(참고) 자기 콘텐츠의 현재 상태는 `GET https://www.oxxovo.ai/api/contents/status?source_ref=<ref>[&source_version=<n>]`로 읽는다. 응답 `{items:[{id, source_ref, source_version, kind, status, rights_status, rights_reason, held_reason, returned_reason, returned_at, publish_at, created_at, updated_at, content_distributions:[{platform, status, external_url, published_at}]}]}`. 다른 출처의 행은 없는 것과 구분되지 않는다(`404 not_found`). 읽기 전용.

## 9. 시험 건 절차 요약 (뉴스 쪽 몫)

1. 파일 확인: 정확히 9,008,217 바이트, 1920x1080, `ffprobe`로 `duration_sec` 확인, sha256 계산.
2. 키 확인(1절의 `returns` 호출이 `200`).
3. presign -> PUT을 영상과 썸네일에 각각 한 번씩 한 뒤 import. `201`이면 `id`와 `status`, `channels`를 본부에 알린다. **`channels`에 youtube 한 줄이 `queued`가 아니면 멈추고 본부에 알린다.**
4. **그 뒤로 이 콘텐츠에 손대지 않는다.** 정지·송출·반송·삭제는 본부와 TK님이 한다.
5. 본부 신호가 오면 rights-down(7절).
6. 시험 중에는 다른 `news` 콘텐츠를 `cleared`로 수입하지 않는다.

## 10. 서버 쪽 사전 조건 (본부가 확인; 뉴스 쪽 일 아님)

- 키가 서버에 들어 있다(Vercel production에 `CONTENT_IMPORT_SECRET_NEWS_DESK` 이름 존재를 `vercel env ls`로 확인; 값은 읽지 않았다).
- 뉴스 수입 경로가 쓰는 설정이 있다: `content_min_lead_minutes`, `news_publish_weekdays`, `news_publish_time`, `news_publish_timezone`, `content_presign_ttl_seconds`, `content_presign_rate_per_hour`. **뉴스 출처로는 라이브에서 돌려본 적이 없어서** 이 키 중 하나가 없으면 수입이 `503 config_missing:<키>`로 막힌다.
- 라이브 SHA `175855f`에 위 엔드포인트가 모두 들어 있다.
