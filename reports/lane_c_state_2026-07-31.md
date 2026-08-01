# 레인 C 상태 — 2026-07-31 (작성: 지수2C)

작업 공간: 앱 `C:\Users\Tom\oxxovo-lane-c` / 워커 `C:\Users\Tom\oxxovo-studio-lane-c`, 둘 다 `feat/studio-lane-c`.
트렁크: 앱 = `feat/studio-budget-guard`, ★워커 = `main` (오늘 확정. 워커만 앱과 반대다).
미커밋: **앱 0 / 워커 0.** 양쪽 push 완료.

---

## 1. 오늘 커밋

### 앱 (`oxxovo`, `feat/studio-lane-c`)

| 해시 | 내용 |
|---|---|
| `31bd207` | 레인 인식 워커 경로 해석 + 폰트 샘플 렌더러 |
| `f9bf6d3` | 텍스트 폭 back-compat 감사 + 샘플을 출하 해상도로 |
| `47d7836` | (머지) `origin/feat/studio-budget-guard` 수신 |
| `216bf3f` | compose 타임라인 자막 트랙 |
| `6d24a90` | 텍스트 2차원 지오메트리 + 글리프 커버리지 게이트 |
| `2b39071` | 슬라이더 상한을 고정하지 않고 적정 크기 눈금으로 표시 |
| `503b1e0` | ★음악 가격 fail-closed + 단가 단위 중립화 |

머지로 들어온 A 커밋(`f1c877e` BUILD_SHA / `a1411cf` tests.yml 삭제 / `4113116` ①-2 참가자 화면)은 내 것이 아니다.

### 워커 (`oxxovo-studio`, `feat/studio-lane-c`)

| 해시 | 내용 |
|---|---|
| `239d387` | Black Han Sans OFL 라이선스 파일 동봉 |

### CI (`gh run list --repo oxxovo/oxxovo`)

`checks` — `31bd207` success / `216bf3f` success / `47d7836` success / `6d24a90` success(30683745127) / `2b39071` success(30684074703) / `503b1e0` success(30685729121).
`tests` 워크플로 실패 2건은 **스테일 tests.yml** 때문이며 `a1411cf` 머지로 사라졌다. 같은 커밋의 `checks`는 전부 초록이었다.

---

## 2. ② 텍스트·자막 — 종료

### 완료
- **자막 트랙** (`app/studio/compose/TextTrack.tsx`). 레이어별 표시 구간을 바로 표시, 본체 드래그=이동, 양끝=길이, 겹치면 레인 적층.
  `ProComposeEditor.tsx` 접촉면 = **+21줄 전부 추가, 기존 줄 수정·삭제 0.** 신규 state 0, 신규 이벤트 구독 0.
  시간축(`pxPerSec`) 기준. 스냅은 클립 경계 **시간** + 합성 끝, 화면 6px 허용.
- **2차원 지오메트리 + 글리프 게이트** — 아래 3·4절.
- **적정 크기 눈금** — 슬라이더는 5~40% 전 구간, 눈금이 한계를 표시. 값은 시스템이 안 바꾼다.
- **폰트 3종 샘플** — `npm run test:text-samples` → `reports/_run/text-font-samples/*.png` (gitignore, 스크립트가 원본).
  ★**720×1280 / 1280×720**(워커 `canvasForAspect`, `src/render.ts:169`)로 렌더한다. 1080×1920으로 내면 5% 하한이 96px로 보여 실제(64px)보다 좋게 보인다.
- **워커 OFL 누락 보완.**

### 하니스 결함 (오늘 최대 발견 중 하나)
`scripts/text-parity.mjs`가 `'../oxxovo-studio'`를 하드코딩하고 있었다. 앱·워커가 형제 워크트리이고 레인이 **양쪽에 접미사**를 붙이므로, 레인 C에서 돌리면 **레인 A의 워커 미러를 재고 있었다.**
→ `scripts/worker-repo.mjs` 하나로 해석(`WORKER_REPO` env 우선), 리포트에 **해석된 경로를 출력**한다.
→ 전수 확인: 앱 레포에서 레포 밖으로 나가는 스크립트는 **이것 하나뿐**이었다(`git grep 'oxxovo-studio'` + `ROOT,'..'`/`'../..'` 패턴 2갈래).
→ ★**단 GL/효과 하니스는 다른 종류의 갭이 있다** — 5절.

### 남은 것
- **TK 육안 판정**: 폰트 3종 = 5% 하한 "읽을 만하다"로 **판정 완료**. ★단 그 판정이 1080×1920 버전이었다면 720×1280으로 다시 봐야 한다.
- **프로드 모더레이션 1회 확인** = ⑩ 발사 트레인 이후. 앱 프로덕션이 7/13 코드라 확인할 기능이 없다.
- ④ Pro Editor가 타임라인을 재작업할 때 `TextTrack`은 마운트 한 줄만 옮기면 된다.

### 검증 (★전부 로컬 + CI 별도 표기)
`npm test` **109/109** · `npx tsc --noEmit` **0** · `npm run test:text-parity` **46/46 PARITY OK** (WORKER=`oxxovo-studio-lane-c`) · `npm run test:text-advances` **TABLE OK** · CI 방식 build(env 치우고 placeholder만) **exit 0** · GitHub Actions `checks` **success**.
KAT 골든 변화 없음 — 서명 경로 무변경.

---

## 3. 텍스트 지오메트리 게이트 (발견 A) — 재현 경로

### 무엇이 문제였나
렌더 스펙은 줄바꿈도 축소도 안 한다(`lib/text-render.ts:88~121`). 그런데 `validateTextLayer`는 `sizePct 5~40%`만 봤고 **화면에 들어가는지는 아무도 안 봤다.** `sizePct`는 **높이** 기준이라 9:16에서 특히 터진다.

실측 (9:16 = 720×1280, 워커 `.ttf`):
- `순간의 아름다움` black-han-sans 12% → **폭의 131%**. 양옆 잘림.
- `첫째 줄\n둘째 줄\n셋째 줄\n넷째 줄` 12% `yNorm=0.55` → bottom **1434px / 1280px**. ★넷째 줄이 **화면에 아예 안 나온다**(래스터라이즈로 확인).
- 파리티 위반은 **아니다** — 프리뷰도 똑같이 잘린다. 참가자가 잘린 걸 보면서 제출할 수 있었을 뿐이다.

지배 공식: **한 줄 예산(em) = (W/H) ÷ (sizePct/100)**. 9:16 5%에서 **11.25 em ≈ 한글 11~13자**.
`MAX_CONTENT_LEN=100` / `MAX_LINES=4` = 줄당 25자 허용 → **기본 상한이 이미 불가능 영역.**

### 넣은 것
| 코드 | 조건 |
|---|---|
| `text_too_wide` | 줄 단위 최대폭 > 캔버스 폭 |
| `text_too_tall` | `yNorm·H + fontPx×(1.25n − 0.25) > H` |
| `text_font_glyph` | 폰트가 그 글자를 **안 그림** |

`lib/text-metrics.ts` 하나를 **서버·편집기·감사 스크립트가 공유**한다. 서명 정본 불변. 하드 게이트.

### 왜 테이블을 구웠나
`@napi-rs/canvas`가 **devDependency**다 → Vercel 런타임에 없다 → 서버는 `measureText`를 못 한다.
→ `lib/text-advances.ts`(17.3KB, `npm run gen:text-advances`). 워커의 `.ttf`를 워커 엔진으로 재서 굽는다.
→ ★**상한 성질**: 글자별 어드밴스 합은 커닝을 무시하고, 이 3폰트에서 커닝은 **항상 글자를 붙인다**. 실측상 `sum − measureText`가 **음수 0건** (실제 자막 ≤1.8%, 커닝 극단 라틴 ≤6.1% 과대).
→ ★**5자리 반올림이 그 성질을 깼다** — 26글자 라틴에서 0.06px 과소. 엡실론이 아니라 **올림 저장**으로 구조 수정. "0.06px 빼고는 성립하는 성질"은 성질이 아니다.
→ CI엔 워커가 없어 실엔진 대조를 못 한다 → **순수 테스트 21개**(`lib/text-metrics.test.ts`)를 CI에, **실엔진 대조**(`scripts/text-advances-verify.mjs`)를 로컬에 분리.

### 발견 C — Black Han Sans 한글 커버리지 23.1%
한글 11,172자 전수 래스터라이즈: **2,581자만 그린다. 나머지 8,591자는 잉크 0** — 두부도 폴백도 아니고 아무것도 안 나온다. Pretendard·Noto Serif KR은 11,172/11,172.
파리티 하니스는 못 잡는다(테스트 문구가 전부 상용 글자). 현실 단어 20개는 전부 커버 → **이름·신조어·의성어에서 터진다.**
→ `text_font_glyph`로 막고, 골든 테스트로 2,581을 못박았다(폰트 파일 교체를 CI가 잡는다).
→ **제니2 권고 = 3종 유지.** 안내 문구는 ⑪로.

### 폰트별 실측 (⑪ 기법 안내용)
어드밴스(em, 1000px 측정):

| 폰트 | 한글 | 라틴 소문자 | 라틴 대문자 |
|---|---|---|---|
| pretendard | 0.86427 | **0.505** 최소 | 0.641 |
| black-han-sans | **0.833** 최소 | 0.634 최대 | 0.696 |
| noto-serif-kr | **0.966** 최대 | 0.557 | 0.700 |

★**"Pretendard가 가장 좁다"는 라틴 한정이다.** 한글에서는 Black Han Sans가 가장 좁고 Noto Serif KR이 가장 넓다. 고정 추천은 절반이 틀린다 → 편집기는 **문구마다 실측해서** 추천한다.

### 소급 거부 = 0건
`scripts/text-fit-audit.mjs`(SELECT 전용, 게이트와 **같은 함수**로 측정), 라이브 DB:
```
render_jobs total 20 (ready=5 submitted=15)
rows with text layers: 0    text layers: 0
rows the geometry + glyph HARD GATE would reject: 0
```
`render_jobs.edl`이 EDL의 유일한 저장처(`lib/studio.ts:1480` insert만)이므로 20행이 전수다. 텍스트 기능이 프로덕션에 노출된 적이 없어서 0이다.

### MAX_CONTENT_LEN — 여기서 닫음
9:16, 5%, 4줄, `yNorm=0`(최선): 최대 **한글 52자**(pretendard/BHS) / 44자(noto). **100자는 어떤 폰트로도 도달 불가.**
상수를 줄이는 것도 답이 아니다 — 예산이 종횡비에 따라 **3.16배** 변한다(9:16 11.25em vs 16:9 35.56em). **폭 게이트가 진짜 제약, 100자는 위에 남는 느슨한 안전망.** 제니2 확정.

---

## 4. ★0크레딧 결함 — 재현 경로와 조치

### 음악 (수정 완료, `503b1e0`)
재현 경로:
1. 라이브 `platform_config`에 **`studio_music_*` 키가 하나도 없다** (조회로 확인).
2. `getMusicGenConfig()`의 `num()`이 없는 키를 **0으로 폴백** (`lib/music-gen.ts`).
3. `creditsForCost(0, pricing)` = `Math.ceil(0 × (1+마진) / 단가)` = **0** (`lib/credits.ts:66`).
4. `createMusicGeneration`의 잔액 검사가 `balance < 0` → **모든 유저 통과.** 잔액 0원도 통과.
5. → **음악 스위치를 켜는 순간 AI 음악이 공짜.** 그 스위치는 **배포가 아니라 SQL UPDATE**라 릴리스 과정에서 안 걸린다.

조치: `validateMusicPricing()`이 **잔액 검사보다 먼저** 돌아 `music_not_priced`로 거부한다. 아무것도 청구되지 않는다.
비용은 **`base + perSecond × duration`**(`musicCostUsd`). 출력당 공급자 → base만, 분당 공급자 → perSecond만. 신규 키 `studio_music_gen_cost_per_second_usd`.
`getMusicGenConfig`의 0-폴백은 **의도적으로 남겼다** — 공급자에 따라 두 항 중 하나는 정당하게 0이다. **0이면 안 되는 건 합계**이고 청구 시점에서 막는다.

★**부수 효과**: 가격 키가 없으면 `studio_music_enabled=true`를 Run해도 **AI 생성은 안 된다.** 가격을 먼저 넣어야 켜진다 — 의도한 순서다. 값은 공급자 확정(③b) 후.

### 영상 (조회만. ★고치지 않았다 — 지수2A 배정)
- 영상 단가는 `platform_config`가 아니라 **`model_catalog.cost_per_second_usd`**에서 온다 (`lib/studio.ts:560`/`:741`/`:947`).
- `getStudioPricing()`은 키가 없으면 **throw** 한다(`lib/credits.ts:57`). → **0-폴백은 `getMusicGenConfig` 단독 결함이었다.**
- 라이브 `model_catalog` 19행: NULL 0건, 0 0건. 최저 `ltx-video 0.01`, 최고 `veo3.1 0.4`.
- PostgREST OpenAPI: `cost_per_second_usd`는 **NOT NULL**. ★단 **NOT NULL ≠ > 0**이고, CHECK 유무는 **레포로 증명 불가**(이 테이블의 CREATE TABLE이 레포에 없다 — 대시보드 생성물). DDL 덤프 필요.

★**`creditsForCost`가 0을 낼 때 막는 가드는 어디에도 없다.** 호출부 5곳:

| 위치 | 경로 |
|---|---|
| `lib/studio.ts:561` | 영상 생성 |
| `lib/studio.ts:742` | 이미지 생성 |
| `lib/studio.ts:948` | i2v 생성 |
| `lib/credits.ts:185` | `chargeForGeneration` |
| `lib/music-gen.ts` | 음악 (오늘 수정됨) |

★**워커 미러**: `oxxovo-studio/src/config.ts:67` `creditsForCost`.

전부 `if (balance < credits)` 잔액 비교만 한다. credits=0이면 `balance < 0` → **항상 false**.
정당한 0 확인: 환불 경로(`refundMusicGeneration`)는 원 charge 행을 되돌리므로 `creditsForCost`를 안 쓴다. `chargeForGeneration`만 쓴다. → 0 throw가 안전할 가능성이 높다. ★`admin_adjust`·프로모 경로는 안 봤다.
**배정: 지수2A** (앱 `lib/credits.ts` + 워커 `src/config.ts` 양쪽 미러).

---

## 5. GL/효과 파리티 하니스 — 다른 종류의 갭 (④ 선행조건, 지수2A 배정)

`scripts/gl-engine-parity.mjs`는 워커 레포를 **아예 안 읽는다**. 스크립트 안에 ffmpeg 필터 문자열을 **손으로 적어두고**(`:97 eq=`, `:103 lut3d=`, `:113 gblur/blend`) 로컬 ffmpeg로 그걸 돌려 앱 셰이더와 비교한다.
→ 워커 `render.ts`의 실제 출력이 아니라 **그 복제본**을 검증한다. `render.ts`가 드리프트해도 **계속 PASS한다.**
→ ★④의 잔여(grain 렌더 교체 / motionBlur / dissolve)가 **정확히 `render.ts`를 바꾸는 일**이다. 하니스를 안 고치고 렌더를 바꾸면 "통과했는데 실제로는 다른" 상태가 된다.
→ 제니2가 ④ 선행조건으로 등록, 접촉면 평가는 지수2A.

부수: 워커의 `_stage3_upload.mjs` 등 4개가 `'../oxxovo-studio-samples'`를 하드코딩한다. 샘플 저장소는 레인이 없어 결과적으로 맞다. 일회성 업로드 스크립트(`_` 접두)라 안 고쳤다.

---

## 6. ③ provider 경계 설계안 (★내일 첫 작업. 타입 시그니처만, 구현 0줄)

### 왜 경계가 2번(워커 레인)보다 먼저인가
공급자가 미정이다(③b는 ElevenLabs Music API Terms 3.A 서면 회신 대기). 경계를 안 정하고 레인을 쓰면 **특정 공급자에 맞춘 코드**가 생긴다.

### 고문 요구 4개 → 경계 반영 (제니2 승인)
| 요구 | 반영 |
|---|---|
| ①공급자·모델버전·생성시각·라이선스유형 기록 | `MusicGenOutput`에 `provider` / `providerModel` / `generatedAt` / `licenseType`을 **필수 필드**로. `finalizeMusicGeneration`이 그대로 4컬럼에 기록. 어댑터가 안 채우면 **타입이 막는다** |
| ②429 + 잔여 한도 헤더 없음 | 어댑터는 **`RateLimited` 에러 타입만** 던진다. 큐·백오프·사용량 집계는 **워커 레인이 소유** — 공급자 헤더에 의존하지 않는다 |
| ③주 1 + 비상 1, 균등 분산 금지 | `primary` / `fallback` **2슬롯 명시**. 폴백 전환은 **primary가 RateLimited/불능일 때만** |
| ④사용권이 공급자에 종속 금지 | 어댑터가 `licenseType`을 **우리 열거형**(예: `commercial_redistributable`)으로 매핑해 보고. ★**그 열거형을 만족 못 하는 공급자는 등록 자체를 거부** |

### 현재 상태 실측 (브리프 아님, 코드/DB 확인)
| 항목 | 상태 | 근거 |
|---|---|---|
| 게이트 2단 fail-closed | ✅ | `lib/music-gate.ts` |
| 라이브 게이트 | 전 14시즌 `enabled=false ai=false cap=15` | DB 조회 |
| assets 4컬럼 | ✅ DB에 존재 | 컬럼별 SELECT 성공 |
| 4컬럼 기록 코드 | ★없다 | `finalizeMusicGeneration`이 status/r2/url/duration/cryptobind만 씀 |
| 앱 provider | `stubMusicProvider` → throw | `music-gen.ts:70~81` |
| 워커 provider 함수 | ✅ `generateMusic()` (Sonilo v1.1 + Stable Audio 2.5, `durationKey` 분기) | `src/fal.ts:216~259` |
| 워커에서 호출 | ★**0회** | `grep -rn generateMusic src/` → fal.ts뿐 |
| ★워커 music 레인 | ★**없다.** `main()`은 `generationLane`×GEN + `renderLane`×RENDER뿐 | `src/worker.ts:897~900` |
| assets 행 | **0행** (라이브러리 베드 없음) | `count(*)` |
| 렌더 측 소비(믹싱) | ✅ 완성 | `src/worker.ts:662~703, 727~733` |

**요약**: 앱의 생성 진입~과금~환불 골격 O, 워커의 소비 O. **비어 있는 건 그 사이** — 큐를 집어 만들고 R2에 올려 서명하는 레인 전체.

### ③a 남은 단위 (순서 승인됨: 1 → 3 → 2 → 4 → 5 → 6)
1. ✅ 가격 fail-closed + 단위 중립화 — **완료** (`503b1e0`)
2. ★**3. provider 경계 타입 시그니처** ← 내일
3. **2. 워커 music 레인** — `processOneMusicJob`(queued+ai → CAS claim → provider → R2 `music/` → v1m 서명 → ready / throw 시 환불) + `main()` 배선 + `MUSIC_CONCURRENCY`
4. **4. 4컬럼 기록** — `finalizeMusicGeneration` 확장
5. **5. 사용량 모니터링·재시도** — 클립 레인의 daily cap/백오프와 같은 축
6. **6. E2E** — OFF / ON / 캡15 / 환불 / v1m 재해시

★라이브러리 베드 100~200곡 생성·큐레이션은 **③b**다(실공급자 필요).
★캡 15는 **생성 횟수 기준 서버 집행**이다. 잔액 기준 금지 — 돈으로 시도를 사면 캡이 무의미해진다. 현재 `countMusicGenerationsForRound`가 ROW 카운트로 맞게 돼 있다.
★**무상 크레딧 0원.** 전액 참가자 부담(원가×1.25, Stripe 선결제). ③a 설계에 "무료 제공분" 전제 금지.

---

## 7. 내일 첫 작업

1. **③ provider 경계 — 타입 시그니처 파일만.** 구현 0줄. 계약은 주석으로 명시. → 제니2 승인 → 어댑터.
2. 승인 후 **2. 워커 music 레인.**
3. 시작 전 **트렁크 머지**: 앱 `git merge origin/feat/studio-budget-guard`, 워커 `git merge origin/main`. ★rebase 금지.

### 물려 있는 것 (내 것 아님)
- `creditsForCost` 0 가드 — **지수2A**
- GL 파리티 하니스가 복제본을 잰다 — **④ 선행조건, 지수2A**
- `model_catalog.cost_per_second_usd`의 CHECK 유무 — **DDL 덤프 필요**
- 발견 C 안내 문구 — **⑪**
- ②프로드 모더레이션 1회 확인 — **⑩ 이후**
- 폰트 육안 판정이 1080 버전이었다면 **720 재확인**

### 새로 생긴 명령
```
npm run gen:text-advances    어드밴스 테이블 재생성 (폰트 교체 시)
npm run test:text-advances   실엔진 대조 (워커 워크트리 필요, CI 불가)
npm run test:text-samples    폰트 샘플 PNG
node --env-file=.env.local --import ./scripts/test-register.mjs scripts/text-fit-audit.mjs
```
