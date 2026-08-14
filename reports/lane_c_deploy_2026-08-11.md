# 배포 실행 기록 — 워커 + 앱, 2026-08-11

**지수2C · 제니2 지시 · 대표님 승인.** H(속도 램프)는 코드 0줄이라 자동으로
빠짐 — 별도 조치 불필요. G+D(진행분)+한국어+영어 원문 수정만 나감.

---

## 1. 워커 (`oxxovo-studio`)

- 머지: `feat/studio-lane-c`(21커밋) → `main`, `--no-ff`(`e211c14`). 사전
  스크래치 워크트리 dry-run으로 충돌 0건 확인 후 실행 — 실제로도 0건.
  main 쪽 유일한 차이커밋(`fb91119`, 배우 jpg 4개 삭제)과 무관, 그대로 보존.
- `npm run build`(tsc) exit 0. `npm test` **100/100 PASS**.
- push 완료(`fb91119..e211c14`).
- Railway `oxxovo-studio` 서비스: push 전후 **Offline 유지** — 의도된 상태
  (Studio 미발사, 상시가동 불필요, 마지막 잡 처리 후 정상 종료된 로그 확인).
  ★수동 기동 안 함(폴링 재개=비용 발생, 지시 없이 할 일 아님).
- **대표님 실측으로 배포 확인**: Railway ACTIVE + Deployment successful,
  커밋 메시지 "Merge feat/studio-lane-c: motionBlur…" 노출. push 7분 뒤.
  → **"배포됨" = 새 이미지 빌드 확인, "main에 push됨"이 아니다**(기준을
  `deploy_trains_2026-08-06.md`에 반영).

## 2. 앱 (`oxxovo`)

- `main`이 로컬 어느 워크트리에도 체크아웃돼 있지 않아 스크래치 워크트리
  (`/tmp/oxxovo-main-deploy`)를 새로 만들어 그 안에서 머지.
- 머지: `feat/studio-lane-c`(419커밋) → `main`, `--no-ff`(`4d64c99`). 순수
  fast-forward가 가능했지만(0 behind) 워커와 같은 이유로 안 씀 — 되돌리기
  손잡이 하나.
- 그 워크트리에서 `npm install` → `npm run build`(next build, `.env.local`
  복사 후) 성공, 42개 라우트 전부 컴파일. `npm test` **483/483 PASS**.
- push 완료(`82e7f47..4d64c99`).
- Vercel: `git.deploymentEnabled.main=false`라 push만으론 안 붙음(2026-06-09
  머지 트레인 때와 같은 함정) → **`vercel deploy --prod --yes`를 그 워크트리에서
  직접 실행**. `.vercel/project.json`은 `C:\Users\Tom\oxxovo`(다른 워크트리)에서
  복사. 결과: `readyState: READY`, `target: production`,
  `dpl_7RcnpHreS12NQPUyXuxN1GU5e7iy`, **`www.oxxovo.ai`에 alias 완료**.
- **배포 후 실측(curl)**: `www.oxxovo.ai/`, `/welcome`, `/watch`, `/apply`,
  `/rules` 전부 HTTP 200이지만 본문이 **13034바이트로 동일** =
  `SITE_PUBLIC_ENABLED` 게이트가 여전히 `/coming-soon`로 rewrite 중임을
  확인(★건드리지 않았다는 증거이기도 하다). `/admin` = 307(→`/admin/login`
  정상), `/admin/login` = 200(게이트 예외 경로, `proxy.ts`의
  `isGateExempt()` 그대로 동작).
- 스크래치 워크트리(`/tmp/oxxovo-main-deploy`) 정리 완료.

## 3. 대표님 확인 3항목 — 내가 실측 못 한 이유

`proxy.ts`의 게이트 우회는 **로그인한 관리자 계정**뿐이다(코드 확인,
`isGateExempt()`는 `/admin`·`/login`·`/auth`만 예외, 그 외 전부 게이트).
데모 로그인(`/api/demo-login`)은 `STUDIO_DEV_UNLOCK`이 프로덕션에 없어
막혀 있고 애초에 admin 계정도 아니다. → **아래 3항목은 실제 관리자 로그인
없이는 내가 직접 볼 수 없다.** 대신 이번 세션 중 로컬(`next dev`)에서
Playwright로 이미 확인한 것:

- 랜딩(`/`, `/welcome`) KO|EN 토글 — 클릭 시 히어로 1행/2행 강조 반전 포함
  전체 전환 확인(스크린샷, 이 대화 앞부분).
- Watch 그리드·상세 페이지 KO|EN 토글 — 사이드바·필터바·카드·투표
  박스·댓글·관련영상까지 전부 확인(스크린샷).
- `/admin/actors` 카드·잠금배지·provenance는 **이번 세션에서 건드리지
  않은 코드**(오늘 변경분과 무관) — 회귀 여부만 대표님 육안 확인 필요.

## 4. 2차 재배포 (같은 날, 대표님 프로덕션 확인 3건 반영)

앱만(워커는 그 사이 변경 0 — `git rev-list --count origin/main..HEAD`
확인, `oxxovo-studio` main과 lane-c HEAD 동일).

- 신규 3커밋: `85c9d94`(배포 기록 문서) · `eb88ad0`(AI 회사명 노출 제거 —
  랜딩+/faq+/about, CTA·날짜 KO/EN) · `3ab56f4`(Noto Sans KR 한글 폰트).
- 머지: `feat/studio-lane-c` → `main`, `--no-ff`(`a8b4f27`). 새 스크래치
  워크트리(`/tmp/oxxovo-redeploy`, 이전 것은 이미 정리돼 있었음)에서 실행,
  충돌 0건.
- `npm install` → `npm run build`(42라우트 전부) → `npm test` 483/483,
  전부 PASS 확인 후 push(`4d64c99..a8b4f27`).
- `vercel deploy --prod --yes` 직접 실행 → `dpl_Tu6Cg8xGnu86UCjBRA8peJERj5SY`,
  `www.oxxovo.ai` alias 완료.
- 배포 후 실측: `data-dpl-id`가 새 배포ID와 일치(진짜 이 배포가 떠 있음),
  `coming-soon` 문자열 여전히 존재(게이트 안 건드림 재확인).
- 스크래치 워크트리 정리 완료.

## 5. 3차 배포 — 2026-08-12/13, H(속도 램프) + 폰트/i18n 머지 후

**지수2C · 제니2 지시 · 대표님 승인.** ③단계(워커 먼저·앱 나중) 병합
직후 진행. 병합 내역은 이 창의 앞선 보고 참조 — H 전 스테이지(①~⑥) +
Pretendard 폰트 전역 교체 + `<html lang>` 동기화 + 랜딩 카운트다운/FAQ/
feat1·2·step3 확정 카피.

### 워커 (`oxxovo-studio`) — 참고, 이번 배포 대상 아님

머지(`feat/studio-lane-c` → `main`, fast-forward, `71dabc7`) 자체가
Railway 자동배포를 **즉시** 발동시킴(이 레포만 그렇다 — 아래 5-3 참조).
빌드 성공 확인(대표님 화면). ffmpeg 핀/렌더 레인 확인 2건은 **미확인**
(워커가 꺼져 있고, 확인을 위해 억지로 켜지 말라는 지시).

### ★★사고 1건 — 잘못된 Vercel 프로젝트로 첫 배포 시도

`vercel deploy --prod` 첫 실행이 **실패**(빌드 에러:
`createSupabaseAdmin: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY
is missing`). 원인 조사 중 `.vercel/project.json`이 프로덕션
프로젝트(`oxxovo`, `prj_niVffyZdA1sLUIjTaA8EdgFT8iRG`)가 아니라 **별도로
자동 생성된 `oxxovo-lane-c`라는 스트레이 프로젝트**(`prj_Pfb7YwUlr...`)를
가리키고 있던 것을 발견 — 2026-08-11 기록(§2) 자체에 이미 "다른
워크트리에서 복사해야 한다"고 적혀 있었는데 이번엔 그 단계를 빼먹고
바로 `vercel deploy`부터 실행한 게 원인. `www.oxxovo.ai`(진짜 프로덕션)
는 이 실패한 시도로 **전혀 건드려지지 않음**(`/api/version`의 `builtAt`
불변으로 확인 후 재시도). `C:\Users\Tom\oxxovo`(본체 워크트리)의
`.vercel/project.json`을 이쪽으로 복사해 재실행 → 성공.

★스트레이 프로젝트(`oxxovo-lane-c`, Vercel 대시보드에 실패한 배포 1건과
함께 존재)는 삭제하지 않았음(파괴적 작업이라 지시 없이 안 함) — 필요시
대표님 판단으로 정리.

### 앱 (`oxxovo`) — 실제 배포

- 프로젝트 링크 교정 후 `vercel deploy --prod --yes` 재실행 → 성공.
  `dpl_HBQnLEJhc69BSsA83s6Fgha8mH21`, `readyState: READY`,
  `target: production`, `www.oxxovo.ai` alias 완료.
- SITE_PUBLIC_ENABLED 게이트: **건드리지 않음**(지시대로).

### 배포 후 실측 4항목

① `/api/version` `builtAt`: `2026-08-12T04:11:36.266Z`(배포 전) →
   `2026-08-13T04:14:11.309Z`(배포 후) — 갱신 확인.
② `data-dpl-id="dpl_HBQnLEJhc69BSsA83s6Fgha8mH21"` — 신규 배포 ID와
   정확히 일치(실제로 이 배포가 떠 있음, "올렸다"가 아니라 "떠 있다"
   확인).
③ 게이트 무접촉: `/`·`/welcome`·`/watch`·`/apply`·`/rules` 5개 경로
   전부 서로 바이트 동일(배포 전후 각각 내부 일관성 유지). 배포 전후
   해시 자체는 **다름**(`c063b9a4…` → `54e7a51c…`) — 예상된 차이:
   오늘 배포분에 Pretendard 전역 폰트 교체가 포함돼 있어 게이트 페이지도
   루트 레이아웃의 새 폰트 클래스를 상속한다. "Coming Soon"/`coming-soon`
   마커 여전히 존재, 실제 랜딩 마커(MEDIA POOL/Tournament Info/Global
   Arena)는 전무, `<title>OXXOVO</title>`(게이트용 최소 메타데이터)
   그대로 — 게이트 자체는 안 건드렸음을 확인. `/admin`=307→`/admin/login`,
   `/admin/login`=200, 이전 배포와 동일 패턴.
④ 관리자 로그인 상태로 랜딩 열람: **미확인** — 이전 배포 기록(§3)과
   같은 이유(게이트 우회는 실 관리자 계정만 가능, 데모 로그인은
   프로덕션에서 막혀 있고 admin 계정도 아님). 대표님 육안 확인 필요.

## 6. 4차 배포 — 2026-08-13, force-dynamic 수정 + 히어로 이탤릭

**지수2C · 제니2 지시 · 대표님 승인.** 3차 배포(§5)의 `builtAt`이
`force-dynamic` 수정(`bba544b`, `app/studio/layout.tsx` — session6 게이트를
정적 빌드에 굳혀버려서 `/studio`가 404였던 원인) 이전 빌드였다는 게
드러나 재배포. main이 그 사이 다시 앞서 있었음(`bba544b` + docs 3건,
겹치는 파일 없음) — `feat/studio-lane-c`로 merge(충돌 0), 히어로
이탤릭 옵션 2(`0458543`)도 같이 실려서 나감.

### 배포 전 필수 확인 — 지난 사고 재발 방지

`.vercel/project.json`을 `C:\Users\Tom\oxxovo`(정본)와 대조 — **이미
일치**(3차 배포 때 고친 게 이 세션 내내 유지됨), 그래도 지시대로 다시
복사해서 시작. 스트레이 프로젝트(`oxxovo-lane-c`)는 이번 배포와 무관하게
그대로 둠(HQ 쪽에서도 "그냥 둔다"로 이미 기록, `backlog_honcho.md` #27).

### 배포

`vercel deploy --prod --yes` → `dpl_4r7fxujL9aTXEiWjjkiH6EagKJ23`,
`readyState: READY`, `target: production`, `www.oxxovo.ai` alias 완료.
`inspectorUrl`이 올바른 프로젝트(`oxxovo`)를 가리키는 것도 확인.

### 배포 후 실측

① `builtAt`: `2026-08-13T04:14:11.309Z`(배포 전) →
   `2026-08-13T05:07:50.673Z`(배포 후) — 갱신 확인.
② `data-dpl-id="dpl_4r7fxujL9aTXEiWjjkiH6EagKJ23"` — 신규 배포 ID와 일치.
③ `/studio`: **200**(이전 404 해소). 단 본문 해시가 `/`와 **바이트
   동일** — `/studio`도 게이트를 그대로 통과해 "Coming Soon"을 보여줌
   (실제 스튜디오 화면이 새어나간 게 아니라, "정적 빌드가 깨져서 404"
   버그가 "다른 모든 경로처럼 게이트를 정상 통과"로 고쳐진 것). 공개
   게이트(SITE_PUBLIC_ENABLED)는 건드리지 않음 — 확인됨.

## 관련
`deploy_trains_2026-08-06.md`(배포됨 기준 갱신) ·
`worker_deploy_procedure_2026-08-06.md`(이번에 따른 선례) ·
`lane_c_watch_selfauthored_en_2026-08-11.md`(제니3 검수 대상) ·
`railway_deploy_guide_oxxovo_studio.md`(배포 자동화 레포별 차이, 2026-08-12 추가)
