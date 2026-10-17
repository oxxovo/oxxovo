# EOD 2026-10-15 -- 지수(메인, 앱 레포) 작업 기록

작성: 지수(메인). 보고 언어 한국어, 코드·로그·에러 원문만 영문.
**커밋·푸시·배포·SQL 실행·DB 쓰기·스위치 변경 0건.** 라이브 = HEAD = `origin/main` = `c9126a9`(10-16 확인), 미커밋 상태는 10-14 EOD §3과 같다(+ 이 파일, 가이드 v2).

**출처 주의:** 이 세션은 10-15 오후 작업(칩 조정·캡처 9장·가이드 v2·배너 규격 측정)을 직접 수행한 기억이 없다. 아래 1~3절은 **10-16 시작 때 본부가 준 설명 + 파일 시각 + 코드 대조**로 재구성한 기록이다. 직접 확인한 것과 전달받은 것을 줄마다 구분한다.

## 1. 15일에 한 일

### 1-1. Coming Soon 칩 (로컬·미커밋)
- 모양(본부 전달): 배너 박스 안 가운데, 글자색 `#f4f0ff`, 배경 `bg-black/65`, 4개 페이지(Market·Education·Jobs·AI Games).
- **직접 확인(10-16):** `app/_site/SiteFrame.tsx:112-123` -- 배너 `<section>`(`relative`) 안에서 `absolute inset-0 flex items-center justify-center` 컨테이너, 그 안 `<p data-coming-soon="true" class="max-w-full rounded-lg bg-black/65 px-5 py-2 text-center text-base font-semibold text-[#f4f0ff] sm:text-lg">`. 이미지 유무와 무관하게 항상 그림. 즉 칩은 배너 박스 안 중앙이다. `git diff --stat`상 SiteFrame.tsx 변경은 21줄.
- 문구는 사전 키 `page.comingSoon` 한 개(영어, `/ko`도 같은 영어).

### 1-2. 캡처 9장
- `reports/coming_soon_shots/` PNG 9개: `daily`·`jobs`·`ko_games`·`market` x (1440, 390) 8장 + `market_fakebanner_1440.png`. **직접 확인한 것은 파일 존재뿐, 이번 세션에서 이미지를 열어 보지 않았다.** 폴더는 `.git/info/exclude`로 제외(커밋 안 됨). 프리뷰 배포 전 폴더 정리 주의(10-14 EOD §3).

### 1-3. 배너 안전영역 가이드 v2
- `reports/banner_safe_area_guide_v2.png`(10-15 13:18, 890KB), untracked. 본부 지시로 커밋 갈래 4(문서)에 포함. 이미지 내용은 이번 세션에서 열어 보지 않았다.

### 1-4. 배너 규격 (측정은 본부·전달값)
- 16:9, 최소 1920×1080, 21:9 박스는 가운데 크롭, 칩 영역 x 590~1330 · y 430~650.
- **직접 한 확인은 산술만:** 칩 영역 중심 (960, 540) = 이미지 중심. 21:9 크롭 높이 1920/(21/9) ≈ 823px -> 세로 약 128~952, 칩 영역 430~650 포함. 칩의 실제 렌더 크기와 이 영역이 맞는지는 미확인.
- 체크리스트 B1-b·A3-b에 반영함(`reports/site_launch_checklist.md`).

### 1-5. 크론 확인 방법 (10-16 재현)
- 10-14 EOD §1-1은 `vercel logs`가 타임아웃·"No logs found"였다. 10-16에는 아래로 읽혔다.
  1. `npx vercel ls`로 배포 목록, `npx vercel inspect https://www.oxxovo.ai`로 **현재 프로덕션 배포 URL**(`oxxovo-aws2w5l6p-...`, `dpl_Fzv1qgihJuXZK96GYZeNirt4HKrg`) 확인.
  2. `npx vercel logs <그 URL> --since 1h --no-follow` -> 표는 MESSAGE가 `[content-…`로 잘림.
  3. 같은 명령에 `--json`을 붙이면 `message` 전문이 나온다.
- 결과: content-dispatch가 5분 간격(`:x0:14`, `:x5:14`)으로 200. `--json` 전문: `[content-dispatch] {"stage":"no_open_dba","processed":0,"swept":0,"alerted":0,"notified":0,"returnedNotified":0,"stopped":null,"warnings":[]}`, `deploymentId`=`dpl_Fzv1...`(현재 프로덕션). season-tick 매시 정각(09:00:07)·email-tick·promo-schedule·broadcast-tick도 200.
- 한계: 1h 창의 표에서 `season-tick`의 MESSAGE는 `(no messa…`로 stage 문자열이 없다(응답 형식은 여전히 미확인).

## 2. JWT 서명 방식 (게임 제니 질문, 10-16 확인)
- 공개 엔드포인트 `https://qrnkovokjmimagrwjebs.supabase.co/auth/v1/.well-known/jwks.json` -> HTTP 200, 키 1개: `kty:"EC"`, `alg:"ES256"`, `crv:"P-256"`, `use:"sig"`, `key_ops:["verify"]`, `kid:"5562f6cd-60ce-456e-87de-fd4b969793c4"`.
- 해석: **비대칭(ES256, ECDSA P-256).** 외부 서비스는 이 JWKS의 공개키로 서명 검증 가능, 공유 시크릿 불필요.
- 한계: JWKS는 "검증용 공개키가 게시돼 있다"는 것이고, **지금 발급되는 access token이 실제로 이 키(kid)로 서명되는지는 토큰 헤더를 보지 않아 미확인.** 전환 중이면 기존 HS256 공유 시크릿 키가 남아 있을 수 있다(JWKS에 안 나옴). 이 레포는 로컬 검증을 하지 않고 `auth.getUser(token)`으로 Supabase에 맡긴다.
- 공개 프로필 테이블·필드, 외부 서비스의 안전한 읽기 경로: **미확정**(레포에 CREATE 없음, DB 조회 필요).

## 3. 갈래 4(문서) 최종 목록
`reports/site_launch_checklist.md`, `jisu_hq_2026-10-13_eod.md`, `jisu_hq_2026-10-14_eod.md`, **`jisu_hq_2026-10-15_eod.md`(이 파일)**, `content_metadata_plan.md`, `promo_allowlist_draft.md`, `tournament_promo_plan.md`, **`banner_safe_area_guide_v2.png`**. **10-16 추가(본부 지시): `profiles_lockdown_2026-10-16.sql`(TK님 메인 DB 적용 완료 기록 포함), `profiles_abuse_check_2026-10-16.sql`, `db_write_surface_audit_2026-10-16.sql`, `ads_plan_v1.1_from_jenny2.md`, `ads_tech_review_2026-10-16.md`, `applications_lockdown_2026-10-16.sql`, `ads_boundary_spec_v1_2026-10-16.md`.** 갈래 1~3은 10-14 EOD §1-7 그대로. 커밋 4개 후 `git status`가 비어야 함. 명령은 TK님 대기.

## 4. 한계
- 15일 오후 작업의 직접 수행·육안 확인 없음(위 출처 주의). 캡처·가이드 PNG는 열어 보지 않음.
- JWKS만으로 현재 토큰의 서명 키를 확정할 수 없음.
- 10-14 EOD §5 대기 항목(A0-1 구절, ko 문구, 키 INSERT 여부 등)은 변동 없음.
