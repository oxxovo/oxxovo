# 지수 본체 인계서 -- 2026-08-30 (본부 마지막 2건 지시 결과)

본부 지시: "①Soundverse `/url` 이것 하나만(읽기, 생성 금지, 404면 중단) ②Loudly 기술 사전조사(읽기만, 키 없이 문서만) ③오늘은 여기까지, 정리." **코드 수정 0건, 커밋은 이 문서 + backlog만.**

## ① Soundverse `GET /v1/files/{file_id}/url` -- 404가 아니라 401

- `file_id=01a0510e-de13-700f-829f-fe424e32a186`, `apiv2.soundverse.ai`, `Authorization: Bearer <SOUNDVERSE_API_KEY>`(Railway `oxxovo-studio` env, 어제와 동일 키).
- 결과: **HTTP 401** `{"error":"INVALID_API_KEY","message":"invalid or revoked API key"}` -- 지시된 정지 조건(404)이 아니라서 계속 파고들지 않고 대조군만 하나 추가로 확인했음.
- 대조군: 어제(8/29) 200이 떨어졌던 `GET /v1/account/balance`를 같은 키로 재호출 -> **동일하게 401**. 즉 `/url` 엔드포인트만의 문제가 아니라 **키 자체가 죽어 있음**(revoke 또는 rotate, 지난 24시간 내).
- 결론: 이 키로는 Soundverse 쪽에서 더 확인할 게 없다. 다운로드 API 부재(8/29 EOD 기록)로 어차피 1,000곡 적재는 막혀 있었으니 "신규 블로커"는 아니지만, **키 상태가 바뀐 사실 자체는 벤더 문의에 포함해야 함** -- backlog #67로 기록.
- 실행 방법 메모(다음 세션용): 이 키는 로컬 `.env`엔 없고 Railway `oxxovo-studio` 서비스 env에만 있음. `railway run --service oxxovo-studio node <script>`로 그 스크립트 안에서 `process.env.SOUNDVERSE_API_KEY`를 읽어 fetch하는 방식으로 확인함(★`railway variables --kv`로 직접 나열하면 키 값이 터미널에 그대로 찍히니 다음부턴 쓰지 말 것 -- 이번에 한 번 그렇게 확인해버렸음, 세션 밖으로 새어나가진 않았지만 습관 고칠 것).

## ② Loudly 기술 사전조사 -- 공식 OpenAPI 스펙 원문 확보, 문서만

문서 사이트(`www.loudly.com/developers`)는 Stoplight Elements로 JS 렌더라 그냥 열면 빈 페이지. 번들 안에서 실제 스펙 파일 위치를 찾아 직접 받음: `https://b2b-soundtracks-swagger-prd.loudly.com/swagger/b2b_swagger.yaml` (OpenAPI 3.0.1, `Loudly Music API v1.0.0`). 아래는 그 스펙 원문 기준, 키 발급/호출 0건.

**인증**
- `apiKey` 방식, 헤더 이름 **`API-KEY`**(Bearer 아님, `Authorization`도 아님).

**생성 엔드포인트 2종(+Manta 별도)**
- `POST /api/ai/songs` -- 파라미터(genre/genre_blend/duration/energy/bpm/key_root/key_quality/instruments/structure_id/model/test) 기반 생성. `genre`만 필수.
- `POST /api/ai/prompt/songs` -- 텍스트 프롬프트 기반(`prompt` 필수 + duration/test/structure_id/model).
- 둘 다 `multipart/form-data`, 서버 `https://soundtracks.loudly.com/`.
- 별도로 `POST /api/ai/manta/songs`(보컬 있는 곡, `manta_access` 계정 옵션 필요) / `POST /api/ai/manta/lyrics`도 있음 -- 지금 용도(인스트루멘탈 BGM)엔 불필요.

**`duration` 파라미터**
- 정확한 이름은 그대로 **`duration`**, 타입 integer, **단위는 초**(`Desired song duration in seconds.`), **범위 30~420**(min/max). 두 생성 엔드포인트 모두 동일.
- 응답 객체(`ai_song.duration`)의 단위는 반대로 **밀리초**다 -- 요청은 초, 응답은 ms. 헷갈리기 쉬운 지점.

**`music_file_path`**
- 응답 스키마상 타입은 `string, format: uri`, 설명은 "URL to the audio file of the song." **한 줄뿐** -- 공개 URL인지 서명/만료 URL인지 스펙에 명시가 없음. 예시값도 `https://example.com/path/to/music.mp3`로 플레이스홀더라 판단 근거가 못 됨. **이 항목은 문서로 확정 불가, 실제 키 발급 후 생성 1건으로 실측해야 함** -- 지금 단정하지 않음.

**인스트루멘탈 강제**
- `/api/ai/songs`, `/api/ai/prompt/songs`(원하는 엔진, VEGA_1/VEGA_2) 쪽엔 **`instrumental` 파라미터가 아예 없음** -- 이 엔진 자체가 보컬을 생성하지 않는 구조로 읽힘(별도 옵션 불필요, 즉 기본이 인스트루멘탈).
- 보컬이 있는 건 `POST /api/ai/manta/songs`뿐이고, 거기서 `instrumental`(boolean, **기본값 true**) + `lyrics`(instrumental=false일 때만 적용). 우리가 쓸 일반 생성 경로에서는 신경 쓸 파라미터가 아니라는 뜻.

**레이트리밋**
- 스펙에 `account_limit` 스키마(요청유형별 `limit`/`used`/`left`/`date_from`/`date_to`)가 정의는 돼 있는데, **이걸 반환하는 GET 경로 자체가 스펙에 없음**(오탈자 아님, 재확인함) -- account/credits 응답에 섞여 나오거나 별도 미문서 엔드포인트일 가능성, 문서만으로는 확정 불가.
- 예시값(`vega_song_with_prompt_limit` 등)은 요청유형(`GENERATE_VEGA_SONG_WITH_PROMPT`/`GET_SONGS`/`GENERATE_SONG_VEGA_1`)별 **월 15회**를 보여줌 -- 단 이건 example 값이라 플랜에 따라 달라질 수 있음, 확정 수치로 보지 말 것.
- 초과 시 에러 형태는 문서화됨: 500 응답, `"External service calling limit exceeded: (service: %s, Timer seconds remaining: %d, Attempts remaining: %d)"`.
- `POST /api/ai/songs`, `/api/ai/prompt/songs` 둘 다 `test: true` 파라미터로 **크레딧 소모 없이 더미 응답**을 받을 수 있음 -- 나중에 실키 받으면 이걸로 무료 파이프라인 검증 가능.

## ③ 오늘 정리

- 코드/커밋/배포: `oxxovo` 0건(이 리포트 + backlog #67 추가만, 커밋은 이 세션 종료 시 1건).
- 새로 만든 파일: `reports/jisu_hq_2026-08-30_eod.md`(이 문서). 임시 프로브 스크립트 2개는 리포 밖 스크래치패드에만 저장, 커밋 안 함.
- 다음 창 시작점은 그대로 [[project_jisoo_resume_2026-08-29]] 기준 -- 오늘은 그 계획을 바꾸지 않았음(`/apply` 체크박스 교체, `allowed_video_platforms` SQL, FAQ 배선 순서 그대로). Soundverse는 벤더 회신 대기라 여전히 손 안 댐.

관련: [[project_jisoo_resume_2026-08-29]] [[feedback_full_instruction_set_before_report]]
