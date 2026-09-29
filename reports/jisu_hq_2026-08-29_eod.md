# 지수 본체 인계서 -- 2026-08-29 EOD (최종판)

TK 지시: "내일 이어간다, 오늘은 기록만." **코드 수정 0건, 커밋 0건, 배포 0건** -- 이 창에서 한 일은 전부 SQL/문서 준비 + Soundverse API 실측 조사(및 `oxxovo-studio` 리포 버그 수정 1건, 아래 참조) 뿐.

## 규율 -- git log -1 (양 레포)

- `oxxovo`(본체): 이 창에서 커밋 0건. HEAD는 어젯밤(`2a61ecd`)과 동일.
- `oxxovo-studio`: 1커밋(`53450b3`, `--limit` 버그 수정, 아래 참조), push 완료.

## ① 오늘 끝난 것 (배포 포함)

1. **season_test 초기화 + 예선 16편 시드** -- 41편 픽스처 `watch_hidden=true` 재잠금, 신규 16편(`TEST-01`~`TEST-16`) 시드 완료(16/16 확인).
2. **실격 게이트 스키마 14컬럼** Run 완료 -- `seasons` 4 + `scoring_results` 6 + `genesis_applications` 3 + `main_round_disqualification_events` 테이블. **`enabled=false`(dark-launch) 그대로.**
3. **`advance_min` 10 → 6** (season_test만).
4. **`watch_fixture_visible` 컬럼 + `lib/watch.ts` 배포**(`2a61ecd`, `www.oxxovo.ai`) -- season_test 등 픽스처 시즌이 `/watch` 공개 피드에 새는 구멍 차단, 리허설 때만 예외 노출 가능.
5. **음악 벤더 403 해소 -- 호스트가 틀렸었다.** 13일 막혔던 원인이 이거 하나였음(아래 상술).

## ② 음악(Soundverse) -- 현재 상태, 정확히 여기까지

**성공한 것:**
- 403의 정체 = 레포 기존 코드(`api.soundverse.ai`, v5 sync)가 **legacy 호스트**였다. 실제 게이트웨이는 **`apiv2.soundverse.ai`**(v1, Enterprise). `GET /v1/account/balance` 200 확인, `POST /v1/generations` 실제 생성 성공(여러 회).
- **단가 실측 = $0.07/트랙**(`generate_music` v7, license 생략=Royalty-Free 기본).
- `oxxovo-studio/scripts/generate-music-100.ts`의 **`--limit` 버그 수정+push**(`53450b3`) -- 실패도 카운트하도록 고침(전에는 성공만 세서, 새 키가 매번 403이면 시간당 한도까지 15회를 실제로 쳤음 -- 오늘 그렇게 15회 나감, 재발 방지 완료).

**막힌 것 -- 다운로드가 안 됩니다:**
- `GET /v1/files/{file_id}/download`가 **문서엔 있는데 서버에서 항상 404**. 3개 file_id, 2개 tool(`generate_music` v7 / `generate_song` v5), 시간 경과, `stream:false`/`lyrics` 변형까지 다 시도해도 동일.
- 문서 원문(raw HTML 직접 파싱, 요약 아님) 확인 결과 **별도 Library ID 체계는 없음** -- `file_id` 하나로 다운로드/재사용(`ref`) 전부 서술됨. 목록 조회 엔드포인트도 8가지 경로 전부 404 -- **API로 파일을 나열/다운로드할 방법이 지금 없다.**
- 유일하게 실제로 되는 경로 = **`https://www.soundverse.ai/library`**(완전히 다른 호스트, 사람이 브라우저로 로그인해서 여는 화면). 대표님이 거기서 육안으로 파일 존재 확인함.
- **가설(근거 있음, 확정 아님)**: 이 다운로드 API는 문서엔 있지만 서버에 아직 배선이 안 됐다 -- 문서가 구현보다 앞선 상태.
- **부가 이상현상 2건(벤더 문의에 포함 예정)**: 400으로 실패한 생성 요청도 $0.07 과금됨 / 반대로 성공한 `generate_song` 생성(2분 트랙)은 $0 과금.
- **결론: 다운로드 경로가 없으니 1,000곡 자동 적재는 지금 불가능.** TK가 벤더에 문의 발송 + 고문에게 대안(다른 벤더?) 요청 병행. **내일 음악은 대기 -- 추가로 안 침.**

## ③ 내일 순서 (TK 지시 그대로)

1. **첫 작업 = `/apply` 체크박스 거짓 문장 교체.** 라이브에 있고 동의 게이트다. **교체 문안은 제니3가 확정해 TK가 지수에게 전달했다고 함 -- ⚠️이 문안이 이번 세션 대화 컨텍스트엔 없다. 다음 창 시작 시 TK에게 재요청 필요.** 같은 문장(패턴: "제출 시" / "사람이 다시 확인" / "비중")이 레포 전체 어디에 더 쓰였는지 전수 검색부터 -- FAQ `faq_a8`("무결성 검증이... 사람이 다시 확인합니다... 비중은 공개하지 않습니다")이 최소 1곳 후보로 이미 발견됨(오늘 FAQ 조사 중, `lib/admin-i18n.ts:1921/2960`).
2. `allowed_video_platforms`에 studio 추가 SQL -- 어젯밤(8/28) 이미 준비됨, 아직 미실행. STEP 0/1 본문은 아래 "리허설 SQL" 섹션.
3. `/rules` ⑤ 현행 전문 → 제니3에게 전달.
4. FAQ 배선 -- `/faq`(15문항) 코드 교체 지점 = `app/faq/page.tsx`의 `buildFaqs()` 배열(하드코딩, DB 아님). 제니3 27문항 전문 도착 시 이 배열만 교체. **`faq_items` DB는 현재 0행**(홈 9문항 어드민 편집기는 아직 아무도 안 씀, 코드는 존재).

## ④ 오늘 어긴 규율 3개 -- 기록

1. **fork 금지, 조사는 Explore.**
2. **지시가 여러 개면 전부 하고 보고 -- 오늘 2회 건너뜀**(Soundverse 진단 라운드에서 4개 중 2개만 하고 "끝났다"고 보고한 적 2번, TK가 재지적함).
3. **아는 성공 사례가 있으면 "지시에 없어서 안 했다"가 아니라 올려서 물어라** -- generate_song lyrics 우회(8/14 성공 패턴)를 알고도 처음엔 안 물어보고 넘어갔다가 지적받음.

## 리허설 SQL -- ②(위 ③) 본문, 아직 미실행

```sql
-- STEP 0: guard (읽기전용) -- 현재 값 확인
SELECT id, allowed_video_platforms FROM seasons WHERE id IN ('season_test','season_0');
```
기대값: `season_0=["studio"]`, `season_test=["youtube","vimeo","instagram","tiktok"]`(옛값).

```sql
-- STEP 1: season_test도 studio-only로
WITH upd AS (
  UPDATE seasons SET allowed_video_platforms = ARRAY['studio']::TEXT[], updated_at = now()
  WHERE id = 'season_test'
  RETURNING id, allowed_video_platforms
)
SELECT * FROM upd;
```
기대값: 정확히 1행, `["studio"]`.

리허설 나머지 순서(cap→2 Run 여부, registerForSeason 스크립트, 리셋 SQL 전체)는 어제 밤 판과 동일 -- 이 파일 상단 구버전에 전부 있었으나 오늘 밤 이 최종판으로 교체됨. **cap(`membership_founding_free_count`)이 지금 2인지 100인지는 다음 창 시작 시 재확인 필요**(리허설이 실제로 언제 시작될지 이 세션에서 확정 안 됨).

## 참고 -- 오늘 만든 파일

- `scripts/zz_probe_founding_state_2026-08-29.mjs`, `scripts/zz_probe_faq_full_2026-08-29.mjs`, `scripts/zz_probe_season0_scoring_weights_2026-08-29.mjs`, `scripts/zz_probe_seasons_star_2026-08-29.mjs`, `scripts/zz_probe_season0_dates_2026-08-29.mjs` -- 전부 read-only 프로브, 커밋 안 함(zz_ 컨벤션).
- `scripts/rehearsal-register-real-2026-08-29.mjs` -- 리허설 실등록용 템플릿, `<FILL_IN>` 미채움.
- `reports/watch_showcase_lane_design_2026-08-29.md` -- 홍보영상 84편 쇼케이스 레인 설계(코드 미변경, TK 결정 3건 대기).
- `oxxovo-studio` `53450b3` -- `--limit` 버그 수정, push 완료.

## ★오늘 발견 -- season_0 실제 날짜 (9/9 아님)

`application_open_at`=**2026-10-15**, `application_close_at`=2026-11-05, main 11/10~13, vote 11/14~17, awards 11/19. **대화 중 계속 "9/9"로 불렸는데 실측과 다름** -- 다음 창에서 이 날짜 기준으로 재작업 필요(리허설 마진, "9/9 이후 모델 동결" 같은 backlog 항목도 재검토 대상).

관련: [[project_jisoo_resume_2026-08-24]] [[feedback_check_first_scope_all_repos]] [[feedback_evidence_scope_before_conclusion]]
