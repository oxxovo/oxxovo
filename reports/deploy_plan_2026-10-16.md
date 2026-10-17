# 배포 계획 2026-10-16 (지수 작성) -- 커밋 4개 -> push -> `deploy:prod`

**이 문서는 계획이다. 아무것도 실행하지 않았다.** 실행은 TK님의 명시 명령이 온 뒤에만. 표기: [레포] = 레포 파일로 확인, [EOD] = 10-14 EOD §1-7 기록, [미확인] = 확인 못 함.
근거: `reports/jisu_hq_2026-10-14_eod.md` §1-7·§3·§4, `reports/jisu_hq_2026-10-16_eod.md` §2·§5-1, `scripts/deploy-prod.mjs`, `vercel.json`, `.vercelignore`.

## 0. 이 배포가 실제로 바꾸는 것 (TK님이 알고 명령해야 하는 것)
- `deploy:prod`는 **www.oxxovo.ai를 모두에게 즉시 교체**한다. 단계 배포·자동 롤백 없음 [레포 `deploy-prod.mjs` 머리말]. 라이브는 `c9126a9`(10-13 04:07Z 빌드)에 3일째 머물러 있고, 이번에 한꺼번에 나가는 것은 아래 3묶음이다.
- 갈래 1 (watch 게이트): 경쟁 화면은 **프리뷰 배포에서만** 열림. 프로덕션은 여전히 닫힘 [EOD 1-7 커밋 제목].
- 갈래 2 (Coming Soon): Market·Education·Jobs·AI Games 4곳에 "Coming Soon" 줄이 **라이브에 보이게 됨**(사용자 가시 변경). 문구는 영어 한 키.
- 갈래 3 (noindex): `/watch*`에 noindex 메타. `search_index_allowed` 키가 없어도 fail-closed(noindex 유지). **SQL(블록 1)은 이번에 실행하지 않는다.**
- 갈래 4: 문서·SQL 파일만. 런타임 영향 없음(단 `reports/`가 업로드 대상이긴 함, §5).
- **DB 마이그레이션 없음.** 따라서 "마이그 먼저 Run -> 코드 푸시" 순서 문제는 없다. 10-16 보안 잠금 2건은 이미 TK님이 Run했고, 코드와 무관하게 라이브 DB에 적용돼 있다.
- **같은 날 스위치 열기 금지**(A0-1): watch 열기(`competition_publication_enabled`)는 배포 다음 날 이후, 배포 후 2시간 + 새 deploymentId 틱 3회 통과 뒤 [EOD §4-3].

## 1. 사전 점검 (읽기 전용)
실행 위치: `C:\Users\Tom\oxxovo`. 아래는 전부 읽기이며 레포를 바꾸지 않는다.

```bash
# 1-1. 라이브 = HEAD = origin/main 이 c9126a9 인지 (바뀌었으면 중단하고 본부에 보고)
git fetch origin
git rev-parse HEAD origin/main
curl -s https://www.oxxovo.ai/api/version

# 1-2. 미커밋 상태가 기대와 같은지 (코드 12줄 + 문서/SQL untracked)
git status --short
```
기대: ` M` 8줄(`app/_site/SectionPage.tsx`, `app/_site/SiteFrame.tsx`, `lib/site-frame.test.ts`, `lib/site-messages-en.ts`, `lib/site-nav.test.ts`, `lib/site-nav.ts`, `lib/watch-gate.ts`, `package.json`), `??` 코드 4줄(`app/watch/layout.tsx`, `lib/search-index.test.ts`, `lib/search-index.ts`, `lib/watch-gate.test.ts`), `??` `reports/` 파일. **목록에 없는 코드 파일이 있으면 중단.**
`reports/` untracked는 갈래 3의 SQL 1개 + 갈래 4 문서 **18개(+ 이 계획서 1개 = 19개)**. 기대 `??` 총 개수 = 코드 4 + SQL 1 + 문서 19 = **24**. (이 계획서 작성 전 `git status`의 `??`는 23이었다.)

```bash
# 1-3. 최종 상태 검증
npm test
npx tsc --noEmit
npm run build
```
기대(**2026-10-16 19시대 실측, 현재 작업 트리**): 테스트 **940/940**, `tsc` exit 0, `next build` exit 0. 10-14 EOD 기록은 939였고 차이 +1의 원인은 아래 주. 다르면 중단하고 보고(그 사이 무엇이 바뀌었는지 먼저 확인).
주: `lib/site-frame.test.ts`(10-15 11:55)와 `app/_site/SiteFrame.tsx`(10-15 12:05)는 10-14 EOD(10-14 17:41) **이후** 수정됐다(10-15 칩 작업, 10-15 EOD 참조). +1은 이 수정으로 보이나 케이스를 하나씩 대조해 증명하지는 않았다.

## 2. 커밋 4개 (경로 지정, `git add -A` 금지)
**왜 이렇게:** `package.json`의 `test` 스크립트가 한 줄이라 `git add -p`로 쪼갤 수 없다. 갈래 1에는 `lib/watch-gate.test.ts` 등록만, 갈래 3에는 최종본(+`lib/search-index.test.ts`)이 들어가야 한다. 그래서 갈래 1 커밋 때만 **변형 파일을 만들어 인덱스에 직접 올린다**(`git hash-object -w` + `git update-index --cacheinfo`) [EOD 1-7]. 작업 트리의 `package.json`은 최종본 그대로 둔다.
`package.json`의 변경은 이 `test` 줄 하나뿐이고, 추가된 토큰은 `lib/watch-gate.test.ts`와 `lib/search-index.test.ts` 둘뿐이다 [레포 `git diff` 확인]. 따라서 **갈래 1용 변형 = 최종본에서 ` lib/search-index.test.ts`만 제거한 것.**

변형 파일 만들기 (스크립트는 파일로 저장해 실행 -- 여러 줄 `node -e` 금지):
```
# 스크래치패드에 pkg-variant.mjs 를 Write 도구로 만든다 (경로: <scratchpad>\pkg-variant.mjs)
import { readFileSync, writeFileSync } from 'node:fs'
const src = readFileSync('package.json', 'utf8')
const token = ' lib/search-index.test.ts'
const n = src.split(token).length - 1
if (n !== 1) { console.error('expected exactly 1 occurrence, got ' + n); process.exitCode = 1 }
else { writeFileSync(process.argv[2], src.replace(token, ''), 'utf8'); console.log('ok') }
```
```bash
node <scratchpad>/pkg-variant.mjs <scratchpad>/package.commit1.json
# 변형이 최종본과 정확히 그 토큰 하나만 다른지 눈으로 확인
diff <(tr ' ' '\n' < package.json) <(tr ' ' '\n' < <scratchpad>/package.commit1.json)
```
기대: 차이는 `lib/search-index.test.ts` 한 줄뿐. 줄바꿈(LF/CRLF)이 `package.json` 원본과 같은지도 확인(원본 인코딩을 그대로 읽고 쓰므로 같아야 함, 확인은 `git diff --cached --stat`에서 `package.json`이 1줄 변경으로 나오는지로).

### 커밋 1 -- watch 게이트
```bash
h=$(git hash-object -w <scratchpad>/package.commit1.json)
git update-index --cacheinfo 100644,$h,package.json
git add lib/watch-gate.ts lib/watch-gate.test.ts
git diff --cached --stat          # 기대: lib/watch-gate.ts, lib/watch-gate.test.ts, package.json 3개만
git diff --cached package.json | grep '^[-+] ' | tr ' ' '\n' | grep -E "test\.ts" | grep -v "^lib/watch-gate" | wc -l   # 참고용: 추가된 토큰이 watch-gate.test.ts 하나뿐인지 육안 확인
git commit -m "fix(watch): open the competition surface on preview deployments only" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
이 시점 `git status`에서 `package.json`은 여전히 ` M`(최종본과 인덱스 변형의 차이)로 남는 것이 정상.

### 커밋 2 -- Coming Soon
```bash
git add lib/site-nav.ts lib/site-nav.test.ts lib/site-messages-en.ts lib/site-frame.test.ts app/_site/SiteFrame.tsx app/_site/SectionPage.tsx
git diff --cached --stat          # 기대: 위 6개만 (package.json 없음)
git commit -m "feat(site): \"Coming Soon\" line on Market, Education, Jobs and AI Games" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

### 커밋 3 -- noindex
```bash
git add package.json app/watch/layout.tsx lib/search-index.ts lib/search-index.test.ts reports/search_index_switch_2026-10-14.sql
git diff --cached --stat          # 기대: 위 5개. package.json은 test 줄 1줄 변경(+ lib/search-index.test.ts 추가분)
git commit -m "feat(watch): noindex robots meta on the Watch pages until search_index_allowed is true" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
이 커밋 뒤 `package.json`은 작업 트리 = HEAD가 되어 ` M`이 사라져야 한다.

### 커밋 4 -- 문서
```bash
git add reports/site_launch_checklist.md reports/jisu_hq_2026-10-13_eod.md reports/jisu_hq_2026-10-14_eod.md reports/jisu_hq_2026-10-15_eod.md reports/jisu_hq_2026-10-16_eod.md reports/content_metadata_plan.md reports/promo_allowlist_draft.md reports/tournament_promo_plan.md reports/banner_safe_area_guide_v2.png reports/profiles_lockdown_2026-10-16.sql reports/profiles_abuse_check_2026-10-16.sql reports/db_write_surface_audit_2026-10-16.sql reports/applications_lockdown_2026-10-16.sql reports/ads_plan_v1.1_from_jenny2.md reports/ads_tech_review_2026-10-16.md reports/ads_boundary_spec_v1_2026-10-16.md reports/db_new_table_checklist_2026-10-16.md reports/games_public_profile_api_v1.md reports/deploy_plan_2026-10-16.md
git diff --cached --stat          # 기대: 19개, 코드 파일 0
git commit -m "docs: EOD 10-13..10-16, security lockdown SQL (profiles, applications), ads review and boundary spec, new-table checklist, games profile API design, deploy plan" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
**커밋 4 직전에 `git status`를 다시 본다.** 이 문서 작성 뒤에 새 untracked 파일이 생겼으면 임의로 넣지 않고 본부에 "누가 만든 것인지" 확인한다(다른 창이 `reports/`를 건드리는 문제와 같은 이유). `reports/ads_plan_v1.1_from_jenny2.md`는 출처가 이 세션이 아니다(EOD 1-5), 본부 확정 목록(갈래 4)에 있으므로 포함한다.

### 커밋 후 확인 (모두 통과해야 push)
```bash
git status                         # 기대: "nothing to commit, working tree clean"
git log --oneline -5               # 기대: 새 커밋 4개가 위에, 그 아래 c9126a9
git diff c9126a9 HEAD --stat       # 기대: 서로 다른 파일 32개
```
주: 서로 다른 파일 기준 코드 12개(수정 8 + 신규 4; `package.json`은 커밋 1·3에 두 번 들어가지만 파일로는 1개) + `reports/` 신규 20개(SQL 1 + 문서 19) = 32개.
**실패 시:** 커밋 중 어느 단계든 의도와 다르면 그 시점에서 멈추고 보고(`git reset`·`--amend`·force 계열은 TK님 승인 없이 쓰지 않는다). pre-commit 훅이 실패하면 `--no-verify`로 우회하지 않고 원인을 고친다.

## 3. push
```bash
git push origin main
git fetch origin && git rev-parse HEAD origin/main      # 기대: 두 값 같음
```
- `vercel.json`의 `git.deploymentEnabled.main=false` 때문에 **push만으로는 배포되지 않는다** [레포 확인]. 배포는 §5의 명령으로만.
- 기본 브랜치 `main`, 업스트림 `origin/main` [레포 확인]. force push 금지.

## 4. 배포 전 마지막 점검
1. **A0-1과 크론 시각:** 배포 직후 크론이 옛 배포를 탈 수 있다(alias 직후 틱). content-dispatch는 5분 간격(`:x0:14`, `:x5:14`) -- 배포 시각이 틱 직전·직후인지 피한다. [메모리·EOD §4-1]
2. **로컬 PNG 정리:** `reports/coming_soon_shots/`(PNG 9장)는 git 제외(`.git/info/exclude`)지만 **`.vercelignore`에 없다.** `vercel deploy`는 작업 디렉터리를 올리므로 이 폴더가 프로덕션 업로드에 섞인다(공개 경로는 아니지만 로컬 파일이 올라감) [레포 확인: `.vercelignore`에 해당 줄 없음]. 배포 전 **폴더를 스크래치패드로 옮긴다**(삭제 아님): `mv reports/coming_soon_shots <scratchpad>/coming_soon_shots_held`. 배포·검증 뒤 되돌리거나 TK님 판단.
3. **`.env.local`:** `deploy:prod`가 먼저 `scripts/check-service-role-grants.mjs`를 `--env-file=.env.local`로 돌려 service_role 권한 누락을 검사한다. 실패하면 배포는 거부된다(하드 게이트, 우회 없음) [레포 `deploy-prod.mjs`]. 이 검사는 네트워크·service_role 키가 필요하다.
4. **TK님의 명시 명령 확인:** "배포해"라는 문장이 오기 전에는 §5를 실행하지 않는다. 승인은 이번 배포 건에만 유효하다.

## 5. 배포 (TK님 명령 후)
```bash
npm run deploy:prod
```
- **절대 `--allow-dirty` 쓰지 않는다**(쓰면 SHA에 `-dirty`가 찍혀 재현 불가). 트리가 clean이 아니면 거부되는 것이 정상 동작이다.
- 스크립트가 `vercel deploy --prod --build-env BUILD_SHA=<short> --build-env BUILD_TIME=<iso>`를 실행하고 `www.oxxovo.ai/api/version`에서 같은 sha·builtAt이 나올 때까지 재시도한다. 성공 시 `✓ live version (try N)`. 실패 시 `✖ NOT VERIFIED`와 진단이 나오며, **재배포로 확인하려 하지 않는다** -- 출력된 `node scripts/deploy-verify.mjs <sha> <builtAt>`로 다시 읽는다 [레포].
- 사용자는 TK님이 `! npm run deploy:prod`로 직접 돌리는 방식도 가능(출력이 세션에 남음). 누가 돌릴지는 TK님이 정한다.

## 6. 배포 후 검증 (읽기 전용, 결과는 본부에 보고)
1. `curl -s https://www.oxxovo.ai/api/version` -> 새 SHA(커밋 4의 short SHA), `dirty:false`, builtAt이 방금 값. **`/api/version`의 새 SHA는 크론이 새 코드를 탄다는 증거가 아니다**(메모리 기록).
2. **크론:** 10-15 EOD §1-5의 방법 그대로 -- `npx vercel inspect https://www.oxxovo.ai`로 **현재 프로덕션 배포 URL** 확인 -> `npx vercel logs <그 URL> --since 1h --no-follow --json`. 확인할 것: content-dispatch(5분, `:x0:14`/`:x5:14`)가 **새 `deploymentId`로** 200, `stage:"no_open_dba"`, `processed:0`, `warnings:[]`. 새 deploymentId 틱이 **3회**(A0-1) 쌓일 때까지 시간이 걸린다.
3. **Coming Soon 4곳:** 라이브에서 Market·Education·Jobs·AI Games 4곳에 칩이 보이는지, 나머지 페이지(Home 등)에는 없는지. 육안은 TK님.
4. **watch는 여전히 닫혀 있음:** 익명 `/watch`가 열리지 않는지(현재 프로덕션 404) -- `curl -s -o /dev/null -w "%{http_code}" https://www.oxxovo.ai/watch`로 코드 확인. **0건이나 404만으로 결론 내리지 않고,** 같은 방법으로 열려 있는 페이지(`/`)가 200인 양성 대조군을 함께 찍는다.
5. `/ko`: 스위치 꺼짐 상태에서 404 [커밋 `2730fa7`, 10-14 EOD §4-3 마지막 항목과 같은 기준]. 배포 전후로 달라지지 않아야 한다.
6. 로컬 PNG 폴더를 §4-2에서 옮겼다면 복귀 여부 확정.
7. 보고할 때는 **확인한 것과 못 한 것**을 분리한다(예: 크론 틱 3회가 아직 안 쌓였다면 "확인 중"으로).

## 7. 되돌리기에 대하여 (계획만, 실행 금지)
- 배포 이전 프로덕션: `oxxovo-aws2w5l6p-...`(`dpl_Fzv1qgihJuXZK96GYZeNirt4HKrg`), `c9126a9` [EOD 16일 1-1].
- 코드 회귀 시 이 배포로 되돌리는 방법(`vercel rollback` 또는 alias 지정)은 **이 프로젝트에서 시험한 적이 없다 [미확인].** 롤백은 프로덕션을 다시 교체하는 행위이므로 TK님의 별도 명령이 있을 때만, 그 전에 `deploy-prod.mjs`가 `BUILD_SHA`를 찍지 않는 경로가 된다는 점(`/api/version` 값이 어긋날 수 있음)을 본부에 알린다.
- DB 변경이 없는 배포라 되돌려도 데이터 정합성 문제는 없다.

## 8. 하지 않는 것
- 이 배포와 같은 날 watch 열기·`competition_publication_enabled` 변경·`search_index_allowed` 블록 1 실행.
- `--allow-dirty`, `--no-verify`, force push, `git add -A`.
- 새 untracked 파일을 출처 확인 없이 커밋에 추가.
- 마켓 006~008 구현 착수(배포 후, 본부 지시 뒤).

## 9. 이 계획이 확인하지 못한 것
- **정정(이 계획서 초판 오류):** 초판은 "10-14 이후 코드 파일 변경이 없다"고 썼으나 틀렸다. `SiteFrame.tsx`·`site-frame.test.ts`는 10-15에 수정됐다(§1-3 주). "오늘(10-16) 수정 0건"만 맞다.
- 테스트·tsc·build는 10-16 19시대에 현재 작업 트리에서 다시 돌렸다(940/940, 0, 0).
- **커밋 순서대로 쌓이는 중간 상태 재검증 (2026-10-16 저녁, 완료):** 레포 밖 임시 폴더(`git archive HEAD` + 해당 파일만 덮어쓰기, `node_modules`는 junction 후 `rmdir`로만 제거, 레포 변경 0)에서 `tsc --noEmit`과 `npm test`.

| 상태 | tsc | 테스트 | 비고 |
|---|---|---|---|
| HEAD(대조군) | exit 0 | 925/925 | 기준선 |
| HEAD + 커밋 1 | exit 0 | 930/930 | 10-14 기록(930)과 같음 |
| HEAD + 커밋 1 + 2 | exit 0 | 933/933 | 10-14 기록 932보다 +1 (10-15 `site-frame.test.ts` 수정분) |
| HEAD + 커밋 1 + 2 + 3 | exit 0 | 940/940 | 현재 작업 트리 `npm test` 940과 같음 |

  - 커밋 1용 `package.json`은 최종본에서 `lib/search-index.test.ts` 토큰 하나만 뺀 변형으로 시험했다(변형 생성 시 해당 토큰이 정확히 1회 있음을 스크립트가 확인).
  - 증가분: 925->930(+5, `watch-gate.test.ts` 5케이스), 930->933(+3, 갈래 2), 933->940(+7, `search-index.test.ts` 7케이스). 케이스 수가 파일별 `test(`/`it(` 개수(5, 7)와 맞는다.
  - `next build`는 최종 상태에서만(exit 0). 중간 상태 빌드는 하지 않았다(본부 지시).
  - 한계: 임시 폴더는 `.env.local`과 `.next`가 없는 상태라 환경값에 의존하는 경로는 이 시험으로 보지 못한다. `tsconfig`가 `*.test.ts`를 `exclude`하므로 `tsc`는 테스트 파일의 타입을 검사하지 않는다(테스트는 `npm test`로 실행됨).
- 커밋 1용 변형 `package.json`은 아직 만든 적이 없다(계획만). 10-14에 같은 방식으로 단독 검증한 결과(1만 930 등)가 있으나 그 변형 파일 자체는 남아 있지 않다.
- 파일 합계 32개(코드 12 + `reports/` 20)는 `git status` 줄 수로 센 것이며 `git diff --stat`로 확정하지 않았다.
- `deploy-prod`의 서비스 롤 권한 검사가 지금 통과하는지, `.env.local`이 유효한지.
- 커밋 훅: `.git/hooks`에 `.sample` 외 파일 없음, `core.hooksPath` 미설정, `.husky` 없음(작성 시점 확인). 훅이 없다는 뜻이며 CI는 별개다.
- 배포 후 사용자 가시 화면(Coming Soon 칩)은 이 세션이 라이브·프리뷰에서 본 적이 없다.
