# 레인 C 인계 브리프 — 2026-07-30 (작성: 지수2-A)

**너는 지수2-C다.** Studio·Watch 트랙의 두 번째 창이고, 지시는 제니2가 준다.
이 파일 하나로 시작할 수 있게 썼다. 컨텍스트가 0인 상태를 전제로 사실만 적었다.

## 0. 네 담당이 아닌 것 — 오면 반송

채점(Defect1·rubric·scorer.ts) / 인증 / `getSeasonPhase` / DB 스키마·마이그레이션
→ **지수 본체(본부 소관)**. 창이 비슷해서 혼선이 있었으니 확실히 구분할 것.

## 1. 작업 공간 (★여기서만 작업해라)

| 레포 | 네 경로 | 브랜치 |
|---|---|---|
| 앱 | `C:\Users\Tom\oxxovo-lane-c` | `feat/studio-lane-c` |
| 워커 | `C:\Users\Tom\oxxovo-studio-lane-c` | `feat/studio-lane-c` |

`git worktree`다(별도 클론 아님). 객체 저장소를 A와 공유하지만 **작업 디렉터리와
브랜치는 완전히 분리**돼 있고, git이 같은 브랜치의 이중 체크아웃을 거부한다.

- `.env.local`(앱) / `.env`(워커)는 gitignore라 **A가 복사해 뒀다.** 그대로 쓰면 된다.
- `npm ci`는 A가 미리 돌려놨다. 안 됐으면 각 경로에서 다시 `npm ci`.
- ★**A의 경로(`C:\Users\Tom\oxxovo`, `C:\Users\Tom\oxxovo-studio`)는 건드리지 마라.**
- 브랜치 기점 = A의 `feat/studio-budget-guard @ 7aec24c` / 워커 `feat/studio-loadtest @ 0350b51`.
  즉 ①비동기 제출까지 들어간 상태 위에서 시작한다.

## 2. ★지금 라이브 상태에서 반드시 알아야 하는 사실 5개

1. **워커는 2026-07-30 22:11에 정상 가동됐다.** Railway 프로덕션 브랜치 = 워커 레포
   `main`, `mode=PRODUCTION gen=10 render=4`. Wait for CI 켜짐 → **워커 `main`에 푸시하면
   CI 통과 후 자동 배포된다.** 함부로 main에 올리지 마라.
2. **앱은 자동배포가 없다.** `vercel.json`에 `git.deploymentEnabled.main=false`. 프로덕션은
   CLI 통제 배포(대표님). 그래서 네 코드는 main 병합 + ⑩ 발사 트레인 때 프로덕션에 간다.
3. **`session6_enabled=true` 전에는 main 병합·배포 금지**(기존 제약, 유효).
4. **마이그레이션은 2026-07-30에 두 건 Run 완료**: 음악 4컬럼(`studio_music_assets`
   20→24: `provider`/`provider_model`/`provider_generated_at`/`license_type`) + 비동기
   제출 5컬럼. **새 컬럼 참조 코드는 마이그 Run 확인 후에만 push**하는 규율이 있다.
5. **Preview = 프로덕션과 같은 DB.** 테스트는 `season_test`에서. 라이브 시즌 건드리지 마라.

## 3. ★A가 소유한 파일 — 손대지 마라 (충돌 지점)

| 파일 | A가 하는 것 |
|---|---|
| `lib/studio.ts` — `submitRender` / `verifyComposeChain` / `finalizeSubmission` / `sweepAsyncSubmissions` | ①비동기 제출 본체 |
| `lib/cryptobind.ts` | `verifyComposeBind({requireFinal})` — 서명 체인 |
| `app/api/cron/season-tick/route.ts` | finalize 스윕 |
| `app/studio/actions.ts` — `pollRenderAction` / `submitRenderAction` | self-finalize 배선 |
| `lib/watch-hold.ts`, `lib/watch.ts` | ⑤watch_hold |
| `lib/email/send.tsx`, `app/api/cron/email-tick/route.ts` | ⑥F VideoLive 배선 |
| `app/admin/applications/*` | ⑥G 어드민 예선 검토 |

★**`lib/studio.ts`는 네 음악 작업(③a)도 건드린다**(`listMusicAssets` 1250 부근,
`loadComposeState` 1351, `createRender` 1459, `submitRender` 1650·1695의 음악 게이트 인자).
→ **그 4~5곳만 최소 수정**하고, 다른 부분은 건드리지 마라. 자주 리베이스해라.

## 4. ★네 레인 (제니2 배정)

### ② 텍스트·자막 마감 — 3 d

**상태: 7단계 전부 완료·양 레포 미러·파리티 OK.** "손도 안 댔다"는 오래된 기록이다.
- 앱: `4e747f7`~`14e8774` (EDL v2 데이터모델 → 폰트 번들 → 공유 layout/raster spec →
  파리티 하니스 → 프리뷰 오버레이 → 편집기 UI → 모더레이션 + Noto Serif KR)
- 워커: `4579c70`~`aa76493` (미러 + `src/text-render.ts` = `@napi-rs/canvas` 렌더)
- 파일: `lib/text-limits.ts`, `app/studio/compose/TextOverlay.tsx`,
  `app/studio/compose/text-preview.ts`, `scripts/text-parity.mjs`(`npm run test:text-parity`),
  워커 `src/text-render.ts`
- **남은 것**: TK 육안 + 폰트 3종 실렌더 확인 0.5 / 자막 UX 마감(타임라인 위 텍스트 트랙
  시각화·다구간 편집) 2 / 프로드 모더레이션 1회 확인 0.5

### ③a 음악 — provider-agnostic까지 5.5 d (★③b는 막혀 있다)

**상태**: 게이트 단일 계층화 완료(`ef61a57`, `lib/music-gate.ts` = `isMusicEnabled` /
`isMusicAiEnabled`, 둘 다 fail-closed) · 캡 15(라운드당, 단일 풀) · R2 영구보관 · UI 패널 ·
v1m 서명 · 마이그 Run 완료.
- ★**워커 `main()`에 music 레인이 없다**(`src/worker.ts` = generationLane + renderLane뿐).
  이게 ③a의 핵심 미구현이다: `processOneMusicJob`(queued+ai → CAS claim → generateMusic →
  R2 `music/` → v1m 서명 → ready / 실패 시 환불) + `main()` 배선 + `MUSIC_CONCURRENCY`.
- 워커에 **provider 어댑터 2종이 이미 있다**: fal Sonilo `00b12ad`, Stable Audio 2.5 `788a968`.
  앱측은 `lib/music-gen.ts`의 `stubMusicProvider`(미설정 시 throw)가 그대로다.
- ★**단가 단위 중립화 필요**: `genCostUsd`가 *per generation* 고정이라 **per-minute 공급자를
  표현 못 한다** → `base + perSecond×duration`을 config에서 주입하는 형태로.
- ★**라이선스 기록 컬럼이 이제 있다**(`provider`/`provider_model`/`provider_generated_at`/
  `license_type`) → 생성 시 채우는 코드가 없다. 넣어라.
- **남은 것**: 단가 단위 중립화 0.5 / 어댑터 계약 정합 1 / 라이브러리 폴백 베드 100~200곡
  생성·큐레이션 1.5 / E2E(OFF·ON·캡15·환불·v1m 재해시) 1.5 / 마이그 후 게이트 검증 0.5
- ★**③b(실제 공급자 연결 3 d)는 착수 금지**: ElevenLabs Music API Terms **3.A**(Authorized
  Reseller가 아니면 제3자에게 API 접근 재판매·재포장 금지)가 우리 구조에 걸리는지 **서면
  회신 대기 중**이다. **ON 신호는 대표님한테서만 온다. 네가 판단하지 마라.**
  켜는 방법은 배포가 아니라 SQL이다(라이브러리만 = `studio_music_enabled=true`,
  AI까지 = `+ studio_music_ai_enabled=true`).

### ⑦ AI 배우(OXXOVO 자체 자산) — 2.5 d

**★용도 확정: 배우는 참가자에게 주지 않는다.** KIRA/YUZU/RIN 3명은 OXXOVO 자체
홍보물·기준작 제작용이다. `official_actors`가 service_role 전용인 것과 정합한다.
- 3명 모두 `status=draft`, 공개 노출 0.
- ★**이름은 비워두고 진행해라**: "YUZU"는 브랜드 리스크(닌텐도 소송명)로 **제니3·본부
  소관**으로 넘어갔다. 교체는 `lib/studio-actors.ts:21` 한 줄이다.
- **남은 것**: OXXOVO 자체 배우 관리·표기(어드민 노출·시트 정리·사용 표기) 1 /
  draft→active + RLS 검증 0.5 / KIRA·RIN i2v 회귀 1

### ⑪ 참가자 캐릭터 일관성 활성화 — 4.5 d ★발사 필수

**상태: 코드는 이미 있다. 빠진 건 활성화와 실측이다.**
- `app/studio/ActorMode.tsx` = 참가자 UI 3단계(①배우 만들기 t2i ②내 배우 ③샷 촬영 i2v)
- `lib/studio.ts:693 createImageGeneration`(media_type='image', 캡·크레딧·모더레이션),
  `studio_characters` 테이블(참가자용, `official_actors`와 완전 분리),
  `createCharacter`/list/delete = `lib/studio.ts:802·830·869·909`
- 워커: `src/fal.ts:135~145`가 `start_image_url`/`elements`/`multi_prompt`를 조립하고
  `src/worker.ts:404~413`에서 **서버가** 검증된 부모 이미지로만 만든다(참가자 입력 불신)
- CryptoBind `v1i`/`v1ic`/`v1v` **구현 완료**(`lib/cryptobind.ts:552~705` + 테스트)
- ★**정정**: 참가자 경로는 **Ideogram이 아니다.** 카탈로그 이미지 모델 2종 =
  `nano-banana-pro`(premium, 참조 14장) + `flux-2-pro`(value, 참조 9장), 각각 edit endpoint.
  `fal-ai/ideogram/character`는 **OXXOVO 자체 배우 온보딩 스크립트**에만 있다.
  안내 문구에 Ideogram이라고 쓰면 실제와 다르다.
- ★**막고 있는 것**: `model_catalog`의 이미지 모델이 **`active=FALSE`**로 시드돼 있다
  (마이그가 의도적으로 그렇게 했다). ActorMode의 `models_pending` 문구가 그 상태다.
- **남은 것**: active ON + 참가자 풀 경로 E2E(생성→등록→i2v 3샷→compose 반입) 1.5 /
  ★Kling V3 Pro `multi_prompt`+`elements` 실측(파라미터 화이트리스트·실패모드·비용) 1.5 —
  **외부 API라 불확실성 최고** / 이미지 캡·크레딧 라운드축 실측 0.5 / 참가자용 기법 안내 1

### ⑥ A~E — 6 d

| | 내용 | d |
|---|---|---|
| A | 랜딩 → Watch 무조건. ★`app/_landing/LandingView.tsx:31`의 `const WATCH_NAV_ENABLED = false`가 **하드코딩**이다 → 설정 기반으로 | 1 |
| B | 왼편 메뉴 2개 상시 | 0.5 |
| C | 홍보영상 쇼케이스 **전용 플래그** — ★가짜 신청 절대 금지. `genesis_applications`를 쓰지 않는 별도 데이터 경로가 필요하다(그래서 실제로는 3~4d일 수 있다) | 2 |
| D | 멤버 3종·파트너 안내문 | 1.5 |
| E | 배너 단계 매핑 | 1 |

★⑥F(이메일)·⑥G(어드민 검토화면)는 **A 담당**이다. 네 것 아니다.

## 5. ★A가 지금 하고 있는 것 (충돌 회피용 요약)

**①비동기 제출**: `submitRender`가 `render.status='ready'`를 요구해서 마감 직전에 렌더가
큐에 있던 참가자가 제출을 못 하던 것을 고치는 작업이다.

- 제출 경로는 **여전히 하나**다. 렌더가 도착했으면 accept+finalize 동시, 아니면 **intent만**
  접수하고 24h 버퍼의 스윕이 나중에 finalize한다.
- 서명 체인은 **쪼개지 않았다.** v1sr은 렌더 전에 이미 있고 v1sc만 렌더 후에 생기므로,
  **검증 시점만** 나눴다(`verifyComposeBind({requireFinal})`). canonical·KAT·워커 무변경.
- ★**KAT 골든이 바뀌면 그건 사고 신호다.** 현재 기준선 = 앱 83/83(로컬), 워커 22/22.
  네 작업으로 이 숫자가 바뀌면 즉시 멈추고 제니2에게 보고해라.
- 계약: **URL 컬럼은 finalize에서만 쓴다** → `free_entry_url IS NOT NULL` = "파일이 있고
  v1sc 검증됨". `studio_application_intent_at` = 마감 전 접수의 증거.

## 6. ★진행 중인 미해결 건 (A 소관이지만 알아둘 것)

1. **앱 레포 CI 도입 중**: `.github/workflows/checks.yml`(작성됨, 미푸시).
   ★**`npm run build`가 env 없이 실패한다** — `/faq` 프리렌더가 `getMembershipLandingData()`
   경로에서 `createSupabaseAdmin()`을 부른다. A가 해결 중. **네가 만지지 마라.**
   (교훈: "로컬에서 통과"는 CI 통과가 아니다. 로컬엔 `.env.local`이 있고 CI엔 없다.)
2. **④ Pro Editor 17.5d**는 `submitRender`·EDL에서 A와 겹쳐서 **①이 끝난 뒤 배정**된다.
   ★지금 손대지 마라. 특히 `app/studio/compose/ProComposeEditor.tsx`는 ②(네 것)와 ④(미배정)가
   같은 파일이라 제니2 승인 없이 대규모 수정 금지.
3. **dissolve 전환**은 렌더 변경이 필요해 ④ 잔여로 묶였다(grain·motionBlur와 함께).

## 6b. ★브랜치 전략 (확정) — `feat/studio-budget-guard`가 트렁크다

`main`은 **2026-07-13, 216 커밋 뒤처져 있고** Studio 작업이 하나도 없다(텍스트·음악·
i2v·효과·비동기 제출 전부 없음). 그래서 네 기점을 main이 아니라 budget-guard로 잡았다 —
main에서 자르면 **네가 끝내야 할 코드가 없는 트리**를 받게 된다.

| 방향 | 방법 | 주기 |
|---|---|---|
| A → C (받아오기) | 네 worktree에서 `git merge feat/studio-budget-guard` | ★최소 하루 1회. 자주 할수록 싸다 |
| C → A (올리기) | 논리 단위 완료 시 제니2 보고 후 `feat/studio-lane-c` → `feat/studio-budget-guard` 머지 | 작업 단위마다 |
| → main | budget-guard → main **fast-forward 1회**, ⑩ 발사 트레인에서만 | 발사 시 |

★**rebase 대신 merge를 써라.** 네 브랜치가 push된 뒤에 rebase하면 force-push가 필요하고,
그건 A가 이미 받아간 커밋을 고아로 만든다.
★A를 먼저 main에 넣거나 C를 먼저 넣는 방식은 쓰지 않는다 — main은 지금 fast-forward가
가능한 상태이고(역방향 커밋 0개) 그 상태를 유지하는 게 가장 싸다. 게다가
`session6_enabled=true` 전에는 main 병합 자체가 금지다.

## 7. 규율 (양 창 공통, 어긴 사고가 실제로 있었다)

1. **숫자에 출처를 붙여라** — 어느 테이블·어느 실행·어느 환경(로컬/CI)인지.
   출처 없는 값이 오늘 3건 뒤집혔다: slide 8.81%, 색보정 1.51%, `ready 45`(실은
   `generation_jobs` 값이고 `render_jobs`는 5였다).
2. **설명할 수 없는 상수를 넣지 마라.** 파리티가 예뻐지는 보정항이라도 근거가 없으면 금지.
3. **추측과 증거를 구분해서 보고해라.** 재현이 추정을 이긴다.
4. **SQL은 본문으로** — 대표님은 레포 파일을 못 여신다. STEP 0 안전확인 단독 블록,
   **코드블록 1개 = 쿼리 1개**, 되돌리기는 실행 순서 **밖에**.
5. **마이그 먼저 Run → 코드 push.**
6. **하드코딩 금지** — 시즌 파라미터는 `seasons` 컬럼에서 읽는다.
7. **완료 즉시 commit+push.** 양 레포 각각 확인.
8. **시크릿 값은 화면에 출력하지 마라.** 이름과 존재 여부만.
