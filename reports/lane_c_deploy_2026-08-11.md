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

## 관련
`deploy_trains_2026-08-06.md`(배포됨 기준 갱신) ·
`worker_deploy_procedure_2026-08-06.md`(이번에 따른 선례) ·
`lane_c_watch_selfauthored_en_2026-08-11.md`(제니3 검수 대상)
