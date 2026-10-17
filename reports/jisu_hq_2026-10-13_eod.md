# EOD 2026-10-13 (PT 10-12 저녁~) -- 지수(메인, 앱 레포) 작업 요약 + 인계

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문.
**이 파일 작성 이후 커밋·푸시·배포·SQL 실행을 하지 않았다**(TK님 지시). 진행 중인 작업은 없다(안전한 지점에서 멈춤).
**읽는 순서: 0절 -> 4절(내일 첫 일) -> 3절(로컬 미커밋) -> 6절(대기) -> 2절(결정) -> 1절(오늘 한 일) -> 8절(교훈·한계).**

## 0. 한 줄 요약

**라이브 = 레포 HEAD = `origin/main` = `c9126a9`**(프로덕션 배포 `dpl_Fzv1qgihJuXZK96GYZeNirt4HKrg`, builtAt `2026-10-13T04:07:00Z`). `watch_as_home`은 꺼진 채(새 사이트 안 보임), `/ko`는 404로 수정 완료. 프리뷰 배포 `dpl_BSN2GqikHF4unMYT3HLtb6Ryy41q`는 같은 커밋(Vercel 로그인 뒤). **로컬 미커밋: watch 게이트 프리뷰 예외(P1) 3파일 + 문서 4건.** ⑩은 뉴스 PC 때문에 오늘도 시작하지 않음. 오늘 SQL 실행·스위치 변경·DB 쓰기 0건(TK님 Run 결과 P1~P3만 받음).

## 1. 오늘 한 일

### 1-1. A0-1 개정 (실행표)
- 규칙을 날짜 기준에서 **"마지막 배포 후 2시간 이상 + 새 `deploymentId` 틱 연속 3회(15분)"** 로 바꿨다(N=2시간, K=3, 본부 승인). 반영: `reports/step10_runbook_2026-10-10.md` A0-1.
- 계기: 10-12 PT 20:40에 ⑩을 시작하려다 A0-1(UTC·PT 둘 다 오늘 배포 아님)이 PT 기준 같은 날이라 멈추고 본부에 물음. 본부가 "목적(옛 배포 틱 위험)은 A0-2로 달성"이라 판단해 예외 진행. 기록은 `jisu_hq_2026-10-12_eod.md` §7·§9. N·K 값은 실측이 아니라 본부 판단(10-07 사건: alias 후 13초).

### 1-2. 배포 `c9126a9` (`/ko` 404 수정 + 프리뷰 입구 함수)
- 코드: `isNewSiteOpen()`(비프로덕션이면 새 사이트 열림, 프로덕션은 `watch_as_home`), `rootSurface()`(스위치 꺼짐 + `/ko` -> `notFound()`). 시험 925/925, `tsc` 0, `next build` 성공, 훼손 4종 + 대조군.
- 커밋 `2730fa7`(fix) + `c9126a9`(docs). 푸시 후 `deploy:prod` `✓ live version (try 1)`.
- 배포 후 확인(익명): `/ko` 200 -> **404**, `/` 200 랜딩 그대로("Featured" 0건), `/watch` 404, `/watch/` 308, `/en`·`/en/market` 308, 새 7페이지·`/ko/market`·`/ko/watch` 404, `/tournament`·`/welcome`·`/studio`·`/login` 200, `robots.txt` 52바이트 md5 `3b5077be`, apex 307. 크론(**content-dispatch**, 5분 간격 -- `no_open_dba`는 `lib/content-dispatch.ts`의 stage이고 season-tick 응답이 아니다. 10-14 정정, 본부 지적): 새 id로 `04:10:14Z`·`04:15:14Z` 연속 `no_open_dba`, `processed:0`, `warnings:[]`.

### 1-3. 프리뷰 보호 확인 + 프리뷰 배포
- Vercel API(읽기): `ssoProtection.deploymentType="all_except_custom_domains"`, 비밀번호 보호 없음, 우회 시크릿 0, 프로젝트 도메인은 oxxovo.ai/.com(+www)·oxxovo.vercel.app뿐. 익명 요청으로 최근 프리뷰 2곳과 `oxxovo-compose-preview.vercel.app`이 `/`·`/ko/market` 모두 302 -> `vercel.com/sso-api` 확인. 한계: "로그인 뒤" = 이 팀 구성원. 대시보드 화면은 안 봄. 기록 `jisu_hq_2026-10-12_eod.md` §9.
- 프리뷰 `https://oxxovo-jiz3bw4mp-oxxovos-projects.vercel.app`(`dpl_BSN2...`, 커밋 `c9126a9`, `vercel deploy` 만, 프로덕션 불변 확인). **이 프리뷰의 `/watch`는 지금 404**(DB 스위치 닫힘, 아래 §1-6).

### 1-4. 완성 모습 샘플 PNG (레포 밖)
- `C:\Users\Tom\Desktop\oxxovo_mockups\crops\` -- 시안(`site_mockup.png`)에서 **글자·실제 회사 로고가 없는 영역만** 잘라 임시 배너 7장·카드 썸네일을 만들고, 실제 `SiteFrame`·`CardGrid`를 로컬 렌더해 SAMPLE 표시 PNG 6장(`sample_1_home_desktop` ~ `sample_6_daily_mobile`). 레포 변경 0, 업로드·프리뷰·프로덕션 반영 0. 한계: 시안이 1312px 한 장이라 3~7배 확대로 뭉개짐, 서버가 배너 행을 읽는 경로는 시험 못 함, 3장(홈 모바일·Entertainment·Market)은 열어 보지 못함. 렌더 스크립트는 scratchpad 복사본(레포 파일 불변).

### 1-5. 문서 4건 (전부 로컬·미커밋)
- `reports/site_launch_checklist.md` -- 새 사이트·콘텐츠·대회 공개 체크리스트(담당·상태·확인 방법·SQL 초안·켜는 순서·끄는 법). B9(홍보영상 재사용 16행)·C1~C4 SQL 포함.
- `reports/content_metadata_plan.md` -- 영화 장르·드라마 시리즈/요일 메타데이터 설계.
- `reports/tournament_promo_plan.md` -- Tournament 홍보영상 방식 B 계획. **보류됨**(§2: Tournament은 기존 watch 그대로).
- `reports/promo_allowlist_draft.md` -- 홍보영상 허용 목록 슬롯 초안(P4 대기). **보류됨**(위와 같음).

### 1-6. 홍보영상·`/watch` 조사 (읽기만)
- **프로덕션 환경변수 게이트는 이미 열려 있다(추정)**: 라이브 `robots.txt`가 `Allow: /`(빌드 시점에 `isWatchPublic()` 참일 때만). 따라서 라이브 `/watch` 404의 원인은 DB `competition_publication_enabled=false` 하나로 보임. **프리뷰와 프로덕션이 같은 DB라 프리뷰에서 보려고 이 스위치를 켜면 프로덕션이 같이 열린다.** 값을 직접 읽은 것은 아님(Vercel `WATCH_PUBLIC_ENABLED`는 이름만 확인).
- `/watch` 코드 판단: 시즌 0개면 히어로 "Season 0", LIVE·카운트다운 없음, 그리드는 **픽스처가 아닌 모든 시즌**의 공개 행(시즌과 무관). 시험 데이터 가드 = 시즌 가드(`is_fixture` 기본 true, 예외 `watch_fixture_visible`) + 행 가드(`watch_hidden`·`watch_hold`·`moderation_status`·`flagged`).
- TK님 P1~P3(promo): `promo_videos` 미삭제 ready 9:16 R2 **88**(삭제 4, 비율 NULL 워밍업 1). 홍보 파일을 재사용한 참가작 행 **60건 전부 `season_test`**, 그중 `watch_hidden=false` **16행**. 시즌 가드가 막는 동안은 안 보이는 2차 위험이지만, 8/28 결정(리허설 전시)으로 열려 있는 상태.

### 1-7. 프리뷰 입구 함수 P1 (로컬 준비, §3)
- `isCompetitionWatchPublic`에 "`VERCEL_ENV==='preview'`이면 DB 스위치 무시"를 추가(프로덕션·로컬 불변). 새 시험 5개, 훼손 5종 모두 빨개짐, 대조군·원복 5/5 초록, `npm test` 930/930, `tsc` 0.

## 2. 본부 결정 (2026-10-12)

| 항목 | 결정 |
|---|---|
| 체크리스트 A-1 | **켜는 날 배포 금지**(A0-1 개정 기준) |
| 체크리스트 A-4 | **켜는 순서 = 콘텐츠 -> 새 사이트 -> 대회**. 단 이번에는 아래 "watch만 연다"가 우선 |
| 메타데이터 B-2 | 시리즈 속성 불일치 -> **409 `series_conflict` 거절** |
| 메타데이터 B-3 | **단일 대표 장르**, 목록은 제니2 |
| 메타데이터 B-4 | **시리즈 없는 드라마 단편 허용** |
| 메타데이터 B-5 | `production_origin`·`client_id`는 **따로, Phase 2 보류 유지**(규격 개정·RPC 재정의 두 번의 비용 알고 감) |
| 메타데이터 B-6 | 정정은 **새 버전만**(어드민 수정 경로 없음) |
| 메타데이터 타이밍 | ⑩ 후 필드 확정 -> 엔터 첫 완성본 전 스키마·수입 코드 -> 화면은 이후 |
| 홍보영상 방식 | **B**(설정 키 허용 목록 + `promo_videos` 명시 칼럼만). A(`contents` 새 kind)는 하지 않음 |
| Tournament | **기존 watch 화면 그대로**: `/competition` -> `/watch` **307 유지**. 홍보영상 페이지 방식은 **보류** |
| 이번 공개 범위 | **watch만 연다. 새 사이트(`watch_as_home`)는 아직 켜지 않는다** |
| 시험 행 숨김 | **W4**(픽스처 시즌의 보이는 행 전부 `watch_hidden=true`). **TK님 승인 대기**, 지수는 실행하지 않음 |
| 프리뷰 확인 | **P1**: 프리뷰에서만 DB 스위치를 무시, 프로덕션 불변. **프리뷰 배포는 TK님 명령 때** |
| TK님 확정(앞서) | A-3: 빈 섹션은 **빈 틀 그대로, Coming Soon 없음**(체크리스트에 반영됨) |

## 3. 로컬 미커밋 (HEAD `c9126a9`, 커밋·푸시하지 않음)

**P1 watch 게이트 변경 -- 3파일**
```
 M lib/watch-gate.ts        isCompetitionWatchPublic: VERCEL_ENV==='preview'이면 true (플랫폼 게이트 뒤, DB 읽기 앞)
 M package.json            test 목록에 lib/watch-gate.test.ts 등록
?? lib/watch-gate.test.ts   새 시험 5개 (Supabase env를 닫힌 포트로 돌려 실제 DB에 안 닿음)
```
**`next build`는 이 변경분으로 아직 안 돌렸다 -- 내일 첫 일.** (`tsc` 0, `npm test` 930/930만 확인.)

**문서 4건(전부 `??`)**: `reports/site_launch_checklist.md`, `reports/content_metadata_plan.md`, `reports/promo_allowlist_draft.md`, `reports/tournament_promo_plan.md`. **이 EOD 파일(`reports/jisu_hq_2026-10-13_eod.md`)도 `??`.**

`deploy:prod`는 untracked·미커밋이 있으면 거부하므로 **프로덕션 배포 전에 위를 전부 커밋하거나 치워야 한다.** 프리뷰 배포(`vercel deploy`)는 로컬 파일을 올리므로 clean 검사가 없다(그래서 P1을 커밋 없이도 프리뷰에 올릴 수 있으나, **로컬 파일이 그대로 업로드된다는 점**(레포 밖 시안 이미지는 해당 없음)을 확인하고 올린다). 커밋은 경로 지정(`git add -A` 금지). 분할 제안: `fix(watch): open the competition surface on preview deployments only`(코드 3개) / `docs: ...`(나머지 문서 5개).

## 4. 내일 첫 일 (순서)

1. **TK님이 읽기 SQL Run**: C1(`season_test` 플래그) + ①(전 시즌 플래그) + ②(시즌별 노출 건수) + ③(실제로 보일 행 목록, 60행 상한). SQL 원문은 이 세션 채팅에 있음(요청 시 다시 준다).
2. **판독**: `season_test`의 `watch_fixture_visible`, 픽스처 아닌 시즌의 시험 행, 고아 행(`season_missing`), ③ 행 수. 판독 기준은 체크리스트 B9와 §1-6.
3. **W4 승인 -> 실행**(TK님이 Run, 지수는 실행 안 함): 픽스처 시즌의 보이는 행 전부 `watch_hidden=true`. Run 후 되읽기(`C4`와 같은 방식의 count 0).
4. **P1 프리뷰 배포**: `next build` 먼저 -> 커밋 여부 TK님 결정 -> `vercel deploy`(`--prod` 없음) -> 프로덕션 불변 확인(`/api/version` 그대로) -> 프리뷰 `/watch` 로그인 뒤 확인은 TK님.
5. **TK님이 프리뷰 `/watch` 확인**(로그인 필요). 주의: 프리뷰는 프로덕션 DB를 읽고 쓴다 -- 좋아요·투표·댓글을 누르지 말 것.
6. **`competition_publication_enabled` 켜기**(TK님 승인 후): 켜기 직전 3)의 안전 조치가 끝났는지, A0-1(마지막 배포 후 2시간 + 새 id 틱 3회) 통과인지, **켜는 날 배포 금지**(P1 프리뷰 배포는 프로덕션 배포가 아니지만, 프로덕션 코드를 바꾸는 배포를 켜는 날에 하지 않는다) 확인. 켠 직후 확인·닫는 법은 채팅의 §4 계획(익명 `/watch` 200, 가짜 팀명 0건, 숨긴 행 `/watch/<id>` 404, `/api/watch/stats`, `/ko/watch` 404, 크론, 닫기 SQL).

## 5. ⑩ (정상 송출 시험)

- **뉴스 PC 대기.** 오늘도 시작하지 않았다. 스위치(`news_dispatch_enabled`) 변경 0건.
- **시작 전**: 실행표 A0-1(마지막 배포 후 2시간 이상 + 새 배포 id 틱 연속 3회) 적용. 오늘 배포가 둘(프로덕션 `c9126a9`, 프리뷰) 있었으므로 **다음 프로덕션 배포가 생기면 그 시점부터 다시 계산**한다. 프리뷰 배포는 프로덕션 크론에 영향이 없다.
- 그 밖: 수입 응답은 여전히 이 세션에 없음, DB로도 안 봤다. `pg_trigger`·A5·A6는 스위치 열기 직전.

## 6. TK님 결정 대기

체크리스트(채팅 목록 번호 기준):
- **A-2** 배너 없이 켤지(그라데이션 기본값) / 파일을 기다릴지
- ~~A-3~~ **이미 확정**(빈 틀, Coming Soon 없음) -- 본부 메시지의 "대기" 목록에도 A-3이 있었으나 앞서 TK님이 정하신 것으로 알고 체크리스트에 반영했다. **어긋나면 알려 달라.**
- **A-5** 콘텐츠 슬러그(안: `news` `drama` `film` `cf` `music` `music-video`) -- 이번에 watch만 열므로 우선순위 낮음
- **A-6** 뉴스 공개와 약관(ElevenLabs·Hedra) -- 이번에 해당 없음
- **A-7** 프리뷰 확인 -- P1로 진행 중
- **A-8** 색인·robots: **이미 `Allow: /`**(환경변수 게이트가 열려 있음). watch를 열면 `/watch`가 색인될 수 있음 -- 방침 결정 필요
- **A-9** `/welcome`·Tournament: Tournament은 `/competition` -> `/watch` 307로 결정됨. 대회가 닫혀 있는 동안 Tournament 메뉴가 빈 페이지인 것(새 사이트를 안 켜는 이번에는 메뉴 자체가 안 보임)과 `/welcome` 정리는 남음
- **메타데이터 B-1** `release_weekday`의 뜻(시리즈 고정 방영 요일 라벨[지수 추천] vs 회차 공개일에서 계산)

그 밖의 대기: 홍보영상 P4 결과·TK님 육안 검수·제니3 문구(허용 목록은 보류 중), 제니3 새 사이트 문구·AI 표기·공개 화면 문구, 제니2 장르 목록, 뉴스 제니 ⑩ 수입, 마켓 질문 4개, `season_test` 날짜 재설정.

## 7. 커밋 안 된 파일 (HEAD `c9126a9`, 이 EOD 포함)

```
 M lib/watch-gate.ts
 M package.json
?? lib/watch-gate.test.ts
?? reports/content_metadata_plan.md
?? reports/jisu_hq_2026-10-13_eod.md
?? reports/promo_allowlist_draft.md
?? reports/site_launch_checklist.md
?? reports/tournament_promo_plan.md
```
레포 밖(커밋 대상 아님): `C:\Users\Tom\Desktop\oxxovo_mockups\` 의 시안·`crops\`(샘플 PNG·HTML·잘라낸 이미지). scratchpad의 렌더 스크립트·cfg.

## 8. 오늘의 교훈 · 한계 (성공만 적지 않는다)

1. **첫 훼손 시험 실행이 무효였다**: 새 시험 파일을 `--import ./scripts/test-register.mjs` 없이 돌려 대조군부터 빨갰다(모듈 해석 실패). 대조군이 빨간 채로 훼손 결과를 읽지 않고 버린 뒤 올바른 플래그로 다시 했다. 이번 입구 함수 시험·P1 시험 모두 같은 절차를 지켰다.
2. **날짜 경계 해석을 놓쳤다**: 10-12 PT 20:40에 "어제 이후 배포 없음 = A0 통과"라는 본부 전제가 이 PC 시계(PT)와 달랐다. 규칙 문구대로면 멈춤이었다는 점을 보고했고 본부가 예외로 풀었다. 그 예외는 EOD에 남겼다. 규칙은 이후 "경과 시간 + 틱" 기준으로 개정.
3. **다른 세션 앞 메시지가 세 번 이쪽으로 왔다**(제니2 배너 제작·제니2 메타데이터·뉴스 관련). 아무 작업도 하지 않고 돌려보냈다. 본부 쪽 라우팅 확인 필요.
4. **"시험 데이터 노출 위험"을 처음엔 과하게 말했다**: 홍보 재사용 16행은 시즌 가드가 막는 2차 위험이고 시즌 플래그의 현재 값이 핵심이라고 정정했다. 판단은 여전히 C1·①②③ 결과가 있어야 닫힌다.
5. **P3의 60행과 예전 기록의 20행이 다르다**: 8/28 이후 리셋·재시딩으로 늘었을 가능성이 있으나 원인은 확인하지 못했다.
6. **한계(검증 못 한 것)**:
   - 프로덕션 `WATCH_PUBLIC_ENABLED` 값은 안 읽었다. `robots.txt` `Allow: /`로 추정했을 뿐이다.
   - `competition_publication_enabled`의 현재 값·`season_test` 플래그·시험 행 노출 여부는 DB로 안 읽었다(TK님 SQL 대기).
   - `watch_hidden_at`·`watch_hidden_reason` 칼럼 형식은 10-07 카탈로그 기록으로만 안다(C3·W4 SQL이 이 두 칼럼을 쓴다).
   - 프리뷰·라이브 `/watch` 화면을 직접 본 적이 없다(코드 판단).
   - 홍보영상: DB 88행과 본부 "84편"의 대응, 영상 프레임(회전·엔드카드·`/watch` CTA)은 못 봤다. 홍보 제작 레포 소스의 시즌 태그·마감 문구가 현재 R2 파일과 같은지 모른다.
   - R2 홍보 호스트(`pub-bf4080d3....r2.dev`)가 앱 `R2_PUBLIC_BASE`와 같은 호스트인지 미확인(홍보영상 구현이 재개되면 먼저 확인).
   - `next build`를 P1 변경분으로 안 돌렸다.
