# 레인 A 상태 — 2026-07-31 마감 (지수2-A)

내일 이 창을 이어받든 새로 열든 여기가 출발점이다. 어제 것은
`reports/lane_a_state_2026-07-30.md`. 레인 C는 별도(`lane_c_handoff_*`).

## 1. 브랜치 / HEAD

| 레포 | 경로 | 브랜치 | HEAD |
|---|---|---|---|
| 앱 | `C:\Users\Tom\oxxovo` | `feat/studio-budget-guard` | **`ea521d4`** |
| 워커 | `C:\Users\Tom\oxxovo-studio` | **`main`** (트렁크 통합, Railway 자동배포 정본) | **`0b860cc`** |

- **양 레포 미커밋 0 / 미푸시 0** (마감 시 확인).
- ★워크트리는 **4개**다. 어제 워커 레포를 빠뜨려 미커밋 2파일이 하룻밤 남았다.
  마감 확인은 `oxxovo` / `oxxovo-lane-c` / `oxxovo-studio` / `oxxovo-studio-lane-c` 전부.
- 앱은 자동배포 없음(`vercel.json` `git.deploymentEnabled.main=false`), CLI 통제배포.
  ★워커는 `main` push마다 Railway 자동배포(Wait for CI).

## 2. 오늘 커밋 (전부 푸시됨, CI 초록)

**앱** (`feat/studio-budget-guard`)

| 커밋 | 내용 |
|---|---|
| `4113116` | ①-2 참가자 화면 — **제출 폼이 `renderReady` 안에만 있어 비동기 경로가 죽은 코드**였던 것 수정. `ASYNC_SUBMIT_STATUSES` 전체로 확장 |
| `a1411cf` | `tests.yml` 삭제(checks가 상위집합) |
| `f1c877e` | BUILD_SHA 스탬핑 + `/api/version` + `npm run deploy:prod`(dirty 거부) |
| `a22373c` | C3 확인 절차 비개발자용 정정 + **★C4 도달성 재확인** 신설 |
| `c69d193` | deploy-prod 맨 위 "이 명령은 발사다" 경고 + 실행 시 콘솔 한 줄 |
| `3e90fd7` | 파리티 하니스가 **워커의 실제 필터를 임포트**(color·LUT) + fail-loud exit 1 |
| `ea521d4` | **전환 하니스 section (2) 수리**(한 번도 안 돌던 것) + `FFMPEG_BIN` 7개 하니스 배선 |

**워커** (`main`)

| 커밋 | 내용 |
|---|---|
| `3c2ef62` | CI에 tsc 추가 + **부팅 줄에 ffmpeg 버전**(CI 스모크가 아니라 배포 이미지를 재도록) |
| `0b860cc` | **Dockerfile ffmpeg 핀** `7:5.1.9-0+deb12u1` + `EXPECTED_FFMPEG` 부팅 대조 |

CI: 앱 `30685767148` 초록 / 워커 `30685786624` 초록. **둘 다 CI 기준.**

## 3. 오늘 밝혀진 것 (수치는 전부 출처 명시)

### ① "PASS인데 아무것도 검증 안 하던" 것이 **하루에 셋**

1. 파리티 하니스가 워커를 안 읽고 **손으로 적은 필터 복제본**을 재고 있었다 → color·LUT 임포트로 닫음(`3e90fd7`). glow는 ④ step 0으로 이월.
2. 워커 CI가 `npm ci` 없이 돌아 **도입 이래 한 번도 초록이 아니었다**(어제).
3. ★전환 하니스 section (2)가 **인자 부재로 항상 크래시** → 스크립트 끝의 게이트가 **도달 불가**였다. 9개 PASS 줄만 보면 건강해 보였다.

### ② section (2) 첫 실행 = **통과** (로컬, 게이트 8%)

`p=0 → 1.21%` / `p=0.5 → 3.14%` / `p=1 → 1.17%`, 전부 ALIGNED. ffmpeg 5.1.2로도 동일.
`transitionSample()` 경계 매핑은 맞다. **값은 결과가 아니라 불확실성 제거에 있었다.**

### ③ ffmpeg 버전 실측 — `reports/ffmpeg_version_parity_2026-08-01.md`

- 배포 `5.1.9-0+deb12u1` vs 로컬 `N-124279`(2026-04-30).
- **효과 필터 44/44 바이트 동일** (eq·lut3d·gblur+blend·**noise(grain)**·**tmix(motionBlur)**·vignette·unsharp·rgbashift·colortemperature·colorbalance·format=yuv420p).
- **xfade는 마지막 1프레임이 13/14 종에서 다름.** 5.1은 한 프레임 일찍 완료(pure-B 대비 0.000%).
- ★**`dissolve`는 종류가 다름 — 25 중 6프레임, 난수 마스크가 버전 종속.**
  **④의 dissolve는 로컬에서 검증 불가.** C안(배포 이미지 재현) 또는 결정론적 대체가 선행돼야 한다.
- ★한계: Docker/WSL 부재로 5.1.2(gyan Windows)를 프록시로 썼다. **"5.1 vs master"의 하한선**이지 5.1.9에 대한 진술이 아니다.

## 4. ★내일 첫 작업 (제니2 지정 순서)

1. **`creditsForCost` 0 가드 — `admin_adjust`·프로모 경로 조회 먼저.**
   ★이 항목은 오늘 넘겨받기만 했고 내가 아직 코드를 안 봤다. **조회부터.**
2. **⑩ 체크리스트에 핀 조건 추가** — 문구 지정됨:
   *"대회 기간(72h 창) 중에는 워커에 push하지 않는다. 불가피하면 배포 성공을
   부팅 줄로 확인한 뒤에만 다음으로."*
   근거: Railway가 push마다 자동배포 → Debian 포인트 릴리스 후 **아무 push나 하면 그때 빌드가 깨진다.**
3. **★E2E 8+1종 (2.0 d) — 9번을 맨 앞에.**
   9번 = "**queued 상태 렌더를 참가자가 UI에서 실제로 제출할 수 있는가**". 오늘 죽어 있던 경로다.
   ★항목마다 "기능이 동작하는가"가 아니라 **"참가자가 그 화면에 도달할 수 있는가"**를 묻는다.
   ★Preview + 실 DB(`season_test`). 보고에 "라이브"라고 쓰지 않는다.
   목록: KAT 불변 / requireFinal 단위 / 변조 3종을 intent·finalize 양쪽에서 /
   intent 후 EDL 바꿔치기 / intent 후 video_url 바꿔치기 / 시간압축 마감 E2E /
   실패→재렌더 복구 / 동기 경로 회귀 / **★9번 도달성**.

## 5. ★대표님·제니2 대기 항목

1. **핀 배포 확인** — 다음 워커 부팅 줄 세 갈래:
   `ffmpeg=5.1.9-0+deb12u1`(정상) / 빌드 실패(핀 문자열 부재) / `★MISMATCH`(다른 게 풀림).
   ★내 세션의 `railway logs`는 **옛 배포 출력만 준다** — 나는 증명할 수 없다.
2. **C안** — 로컬 Docker/WSL 도입(배포 이미지 그대로 실행). 머신 변경이라 대표님 판단.
   ★④ dissolve 착수 전까지 결정되면 된다. 재촉하지 않는다.
3. **`npm run deploy:prod` 실행 금지** — E2E 전·⑩ 전에는 하지 않으신다(대표님 안내 완료).
   현재 프로덕션은 `/api/version`이 **404**이고, 그것이 "아직 미배포"의 표식이다.

## 6. ★내가 판단 보류 중인 것

- **glow 임포트(④ step 0)**: `buildSegmentFC`가 geometric 꼬리(`format=yuv420p`)까지 붙여서
  그대로 쓰면 크로마 왕복이 수치에 섞인다. **게이트 5% 재기준선이 필요하면 먼저 보고하고
  승인받는다. 조용히 느슨하게 하지 않는다.**
- **레인 경계**: `scripts/worker-repo.mjs`를 레인 C 브랜치에서 **바이트 동일 복사**했다
  (md5 `45e6ea7b…`, 내용 수정 0). add/add 충돌 회피 목적. C가 이 파일을 바꾸면 다시 맞춘다.
- **Railway env 드리프트**: 부팅 줄이 한 번은 `gen=20 render=2`, 한 번은 `gen=10 render=4`였다.
  어느 쪽이 의도인지 모른다. 확인 필요.
- **앱 `feat/studio-lane-c`에 `tests.yml`이 남아 빨강** — 트렁크에서만 지웠다. C 몫이라 안 건드렸다.
- **Docker `node:22-slim` vs CI `node 24`** — CI 초록이 런타임 노드 버전을 증명하지 않는다. 현재 위험 낮음.
- **`ProComposeEditor.tsx:402`의 `ASYNC_SUBMIT_STATUSES` 미러 사본** — 파리티 하니스와 같은 종류의 드리프트.
  C4 체크리스트에 명시해 뒀다.

## 7. 규율 (오늘 값을 만든 것)

1. **로컬 통과는 CI 통과가 아니다.** 보고마다 로컬/CI를 명시한다.
2. **"레포에서 못 찾았다" ≠ "없다".** 못 보는 건 "확인 불가"라고 쓴다(오늘: 핀 배포 확인).
3. **추측 대신 재현한다.** 오늘 ffmpeg 두 버전 A/B가 하루치 논쟁을 1시간에 끝냈다.
4. **미커밋을 남기지 않는다.** 워크트리 4개 전부.
5. **한쪽을 고쳤으면 미러를 본다.**
6. **반쯤 한 안전장치는 안전장치가 아니다** — `FFMPEG_BIN`을 7개 하니스 전부에 배선한 이유.
7. **대가를 숨기지 않는다** — 핀이 5.1.10에 깨진다는 것을 스스로 적는다.
8. **우선순위는 대표님이 정하신다.**
