# 지수 본체 인계서 -- 2026-08-30 (본부 마지막 2건 지시 결과)

본부 지시: "①Soundverse `/url` 이것 하나만(읽기, 생성 금지, 404면 중단) ②Loudly 기술 사전조사(읽기만, 키 없이 문서만) ③오늘은 여기까지, 정리." **코드 수정 0건, 커밋은 이 문서 + backlog만.**

## ① Soundverse `GET /v1/files/{file_id}/url` -- ★정정: 401은 내가 틀린 키를 썼기 때문이다, 벤더 revoke 아님

**최초 보고가 틀렸다.** 처음엔 401을 "키가 revoke/rotate 됐다"로 결론냈는데, 본부가 대시보드 실측(키 라벨 `oxxovo-worker`, 끝 6자 `-pPlqlx`, USAGE 27·Aug 29 생성, 어제 27건 그대로 기록)으로 지적 -- **키는 살아 있었고, 내가 쓴 키가 애초에 그 키가 아니었다.**

- 오늘 내가 쓴 값: Railway `trustworthy-enchantment` 프로젝트 `oxxovo-studio` 서비스 production env의 `SOUNDVERSE_API_KEY`. 끝 6자를 다시 확인하니 **`N_FnlG`** -- `-pPlqlx`와 전혀 다른 키.
- Railway 프로젝트가 이것 하나가 아니었다: `charming-recreation`/`fulfilling-consideration`/`just-vibrancy`/`trustworthy-enchantment` 4개 전부의 `oxxovo-studio` 서비스를 대조 확인 -- `SOUNDVERSE_API_KEY`가 설정된 곳은 `trustworthy-enchantment` 하나뿐이고, 그 값도 `-pPlqlx`가 아니다. **즉 어제 27건을 실제로 만든 `-pPlqlx` 키는 이 4개 Railway 프로젝트 어디에도 영속 저장돼 있지 않다.**
- 정황상 8/29 세션이 "임시 키 파일을 삭제했다"고 한 것과 맞아떨어짐 -- 로컬 임시 파일로 그 키를 직접 넘겨 썼고 Railway엔 반영 안 됐을 가능성이 높다. 오늘 내가 대조군으로 `/v1/account/balance`를 재호출한 것도 **같은 (틀린) 키**로 돌린 거라 대조군 구실을 못 했다 -- "같은 키인지"를 값으로 확인하지 않고 "어제 쓰던 env 변수 이름이 같으니 같은 키"라고 넘겨짚은 게 원인.
- **결론: 벤더 이슈 0건. 우리 쪽 키 관리 공백.** 다음 조치: 대표님이 대시보드에서 `-pPlqlx` 키 실값을 확보해 Railway(`trustworthy-enchantment`/`oxxovo-studio`/production)에 `railway variables --set`으로 영속 반영해야 다음에 같은 값으로 재현 가능한 확인이 됨. backlog #67 정정 완료.
- 실행 방법 메모(다음 세션용, 계속 유효): 이 키는 로컬 `.env`엔 없고 Railway env에만 있다 -- 단 **어느 프로젝트인지 반드시 값(끝자리 등)으로 재확인**하고 시작할 것, "env 이름이 같다"는 확인이 아니다. `railway variables --kv`로 직접 나열하면 값이 터미널에 그대로 찍히니 쓰지 말고, `railway run` 안에서 길이/앞자리/끝자리만 출력하는 마스킹 스크립트로 대조.

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

- 코드/커밋/배포: `oxxovo` 0건(이 리포트 + backlog #67 추가/정정만).
- 새로 만든 파일: `reports/jisu_hq_2026-08-30_eod.md`(이 문서). 임시 프로브 스크립트들은 리포 밖 스크래치패드에만 저장, 커밋 안 함.
- 다음 창 시작점은 그대로 [[project_jisoo_resume_2026-08-29]] 기준 -- 오늘은 그 계획을 바꾸지 않았음(`/apply` 체크박스 교체, `allowed_video_platforms` SQL, FAQ 배선 순서 그대로). Soundverse는 `-pPlqlx` 키가 Railway에 영속 반영될 때까지 여전히 손 안 댐.

## ④ 오늘 어긴 규율 -- 근거 없이 "벤더 탓" 결론

"벤더가 revoke했다"를 값 대조 없이 썼다. 401이 뜨자 어제와 "같은 키"라고 가정하고 대조군까지 그 가정 위에서 돌렸다 -- 실제로는 애초에 다른 키였다. 본부가 대시보드 실측(끝 6자 `-pPlqlx`, USAGE 27)으로 지적한 뒤에야 Railway 4개 프로젝트를 값으로 대조해 원인을 찾았다. **앞으로: 실패 원인을 "상대방(벤더/외부) 탓"으로 결론내기 전에, 내가 쓴 입력값 자체가 기대한 값과 일치하는지부터 확인한다.**

관련: [[project_jisoo_resume_2026-08-29]] [[feedback_full_instruction_set_before_report]] [[feedback_verify_input_before_blaming_vendor]]
