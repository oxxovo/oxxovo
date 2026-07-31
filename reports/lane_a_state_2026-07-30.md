# 레인 A 상태 — 2026-07-30 마감 (지수2-A)

내일 이 창을 이어받든 새로 열든 여기가 출발점이다. 레인 C의 출발점은
`reports/lane_c_handoff_2026-07-30.md`(별도 파일).

## 1. 브랜치 / HEAD

| 레포 | 경로 | 브랜치 | HEAD |
|---|---|---|---|
| 앱 | `C:\Users\Tom\oxxovo` | `feat/studio-budget-guard` | 아래 "최종 커밋" 참조 |
| 워커 | `C:\Users\Tom\oxxovo-studio` | `feat/studio-loadtest` (= `main`) | `0350b51` |

- 양 레포 **미커밋 0 / 미푸시 0** (마감 시 확인).
- ★워커 `main`은 `feat/studio-loadtest`와 동일하고 **Railway가 main을 자동배포**한다
  (Wait for CI 켜짐). 워커 main에 푸시하면 CI 통과 후 배포가 걸린다.
- 앱은 자동배포 없음(`vercel.json` `git.deploymentEnabled.main=false`), CLI 통제배포.

## 2. ① 비동기 제출 — 진행 위치

**완료 (푸시됨)**

| 항목 | 커밋 |
|---|---|
| 설계안 (승인) | `c5f05bf` — `reports/async_submission_design_2026-07-30.md` |
| `verifyComposeBind({requireFinal})` + 테스트 6종 | `3e828e4` |
| intent/finalize 분리 + 스윕 + lease 복구 | `0582466` |
| `failed` intent 포함 + 재렌더 1회 + lease 30분 | `74e5891` |
| ★①-1 self-finalize 4조건 배선 | `7aec24c` |
| 워커: `claimed_at` 스탬프 | 워커 `9a490a3` |
| 워커: ffmpeg 타임아웃 15분 | 워커 `0350b51` |

**마이그레이션**: 5컬럼 Run 완료(2026-07-30) — `render_jobs.submit_intent_at` /
`.finalized_at` / `.claimed_at` / `genesis_applications.studio_application_intent_at` /
`.studio_submission_state`. STEP 5 = 5행, STEP 6 = 전부 0(기존 행 해석 불변 확인).

**★KAT 기준선 = 앱 83/83 (로컬), 워커 22/22 (로컬) + 워커 CI #31·#32 초록.**
이 숫자가 바뀌면 설계 위반 신호다. 즉시 멈추고 보고.

**남은 것 — 약 3.0 d**

1. ★**①-2 참가자 UI "접수됨 · 처리 중"** ← **내일 첫 작업**
   `pollRenderAction`이 이미 `acceptedAt` + `finalized`를 반환한다(`7aec24c`). 화면에
   붙이면 된다. 표시 요소: 접수 시각 / 렌더 상태 / ★"접수는 마감 전에 완료되었습니다"
   명시 / **남은 시간 추정치는 표시하지 않는다**(큐 상황에 따라 달라 거짓이 됨).
   파일: `app/studio/compose/ProComposeEditor.tsx` (제출 결과 영역), `app/studio/compose/page.tsx`.
   ★주의: 이 파일은 레인 C의 ②(텍스트 UI)와 같은 파일이다. 큰 수정 전에 C와 순서를 맞춰라.
2. 재렌더 1회 경로 문구 (`render_requeued` / `render_failed` / `render_overdue`) 0.5 d
3. E2E 8종 2 d — ★**Preview + 실 DB(`season_test`)**. cron은 Preview에서 자동 발화하지
   않으므로 `season-tick`을 `CRON_SECRET`으로 직접 호출한다.
   ★보고에 "라이브에서 확인"이라고 쓰지 않는다. "Preview + 실 DB"로 적는다.
   목록: KAT 불변 / requireFinal 단위 / 변조 3종을 intent·finalize 양쪽에서 /
   intent 후 EDL 바꿔치기 / intent 후 video_url 바꿔치기 / 시간압축 마감 E2E /
   실패→재렌더 복구 / 동기 경로 회귀(ready 렌더 1건).

## 3. 오늘 함께 끝낸 것 (① 밖)

- ⑧ CORS 후 GL 루트 정리 — `e41e9f3` (`?gl=1` 제거, URL 하나=모드 하나, raw는 `?raw=1`로 분리)
- 1a 색보정 YUV 포팅 — `1aac933` (2.5~7.5% → 0.62~0.96%, 콘텐츠 4종 전부 PASS)
- 1b 전환 4종 포팅 — `df61270` (dip-to-black/white·circle·slide-left, 9종 worst ≤0.30%)
- 파리티 하니스 정본화 — `parity-ff.mjs` + `playwright-core` + 콘텐츠 4종 + exit 1 게이트
- 워커 fail-closed 설정 — 워커 `52a5a50` (DEV_MODE 반전 / FAL_FAKE 이중 opt-in / 부팅 로그
  1줄 / 동시성 미설정 시 부팅 거부)
- ★워커 CI 수정 — 워커 `774fc51`. `npm ci` 스텝 부재로 **도입 이래 한 번도 초록이 아니었다**.
  이것이 "한 달째 활성 배포 없음"의 근본 원인. 수정 후 #31·#32 초록 → Railway 배포 정상화
  (`mode=PRODUCTION gen=10 render=4`).
- ★앱 CI 신설 — `a8aa222`. 빌드는 **플레이스홀더 env**로 통과(시크릿 불필요, 실측 근거).
  1단계는 **경보**이고, 초록 1회 확인 후 대표님이 브랜치 보호를 걸면 게이트가 된다.
- 레인 C 작업공간(worktree 2개) + 인계 브리프 `1179052`.

## 4. ★대표님 답을 기다리는 항목

1. **앱 CI 첫 실행(`a8aa222`) 결과** — run 번호·초록/빨강·소요시간.
   ★GitHub Actions는 내가 조회할 수 없다(`gh` 미설치, 토큰 없음). 첫 실행은 깨질 수 있다.
2. **BUILD_SHA 추적을 넣을지** — `vercel deploy --prod --build-env BUILD_SHA=$(git rev-parse --short HEAD)`
   + `/api/version`. 0.2 d. ★`next.config`에서 `git rev-parse`를 부르는 방식은 불가
   (Vercel 빌드 머신에 `.git`이 없다).
3. **`[1m]` 컨텍스트 유지 여부** — 내가 측정할 수 없다. `/context`에 압축 이력이 없으면
   1M이 일하는 중. 내 권고: 이 창은 ① 끝까지 유지, 새 창(C)은 표준으로 시작.
4. **Railway 렌더 플릿 하니스(`1304f61`) p50/p95** — 지금 15분/30분은 내 **로컬 프록시
   20.6초**에서 파생된 값이다. Railway 실측이 나오면 env로 교정한다(배포 불필요).
5. (C 레인) ElevenLabs 3.A 서면 회신 — ③b 차단. / YUZU 새 이름 — 제니3·본부.

## 5. ★내가 판단 보류 중인 것

- **브랜치 보호 시점**: 초록 1회 전에는 걸지 않는다(대표님 권한). 워커가 한 번도 초록이
  아니었던 사례가 근거다 — 없는 초록을 필수로 지정하면 병합이 전면 차단된다.
- **앱 프로덕션 커밋 대응**: ★확인 불가능하다. `vercel inspect`에 commit/branch/sha 필드가
  없다(CLI 디렉터리 업로드는 git 메타데이터를 싣지 않는다). 프로덕션은 **17일째 1건**
  (2026-07-13 17:09 MDT)이고, main HEAD 날짜와 같다는 **정황만** 있다. 증거는 아니다.
  → 해결은 위 4-2번.
- **④ Pro Editor 17.5 d**: dissolve(A안, 렌더 변경) + grain + motionBlur를 **같은 부류로
  묶어 한 번에** 처리하기로 승인됐다. ①·⑤·⑥ 뒤 순서.
- **⑥C 홍보 쇼케이스 2 d**: `genesis_applications`를 쓰지 않는 별도 경로가 필요해 실제로는
  3~4 d일 수 있다(레인 C 몫이지만 추산 리스크로 기록).

## 6. 총량

레인 A 잔여: ① 3.0 → ⑤ 2.5 → ⑥F 3 → ⑥G 3 = **11.5 d**
전체 잔여(A+C+미배정 ④·⑩): 약 **56.5 d**

## 7. 규율 (오늘 값을 만든 것)

1. **숫자에 출처를 붙인다** — 어느 테이블·어느 실행·어느 환경(로컬/CI).
   오늘 뒤집힌 것: slide 8.81%, 색보정 1.51%, `ready 45`(실은 `generation_jobs`),
   lease 3시간, "빌드가 env 없이 통과한다".
2. **설명할 수 없는 상수를 넣지 않는다** (dip의 −1 보정항을 거부한 이유).
3. **재현이 추정을 이긴다** — CI 실패를 깨끗한 클론으로 재현해 1분에 확정했다.
4. **로컬 통과는 CI 통과가 아니다.**
5. **모르는 것은 "모른다"고 말한다** — 프로덕션 커밋 대응, 내 컨텍스트 사용률.
6. 마이그 먼저 Run → 코드 push / SQL은 본문으로 / 완료 즉시 commit+push.
