# 레인 C 상태 — 2026-08-02 (작성: 지수2C)

작업 공간: 앱 `C:\Users\Tom\oxxovo-lane-c` / 워커 `C:\Users\Tom\oxxovo-studio-lane-c`, 둘 다 `feat/studio-lane-c`.
트렁크: 앱 = `feat/studio-budget-guard`, 워커 = `main`.
**미커밋: 앱 0 / 워커 0. 양쪽 push 완료. CI 양쪽 success.**

| | HEAD |
|---|---|
| 앱 (`oxxovo`) | **`e27f5db`** |
| 워커 (`oxxovo-studio`) | **`8cf363a`** |

---

## 1. 오늘 커밋

### 앱 — 내 것

| 해시 | 내용 |
|---|---|
| `b74da87` | 라이선스 분류기 + 인용(clause 필수) |
| `e606134` | (머지) A의 zero-price 가드 수용, 단위 중립 원가 유지 |
| `f3009eb` | 리스 회수 설계 (코드 0줄) |
| `722d000` | 임계 유도 확정 + 클레임 컬럼 매핑 |
| `89eb287` | Phase F — 실부하 후 재측정 체크리스트 |
| `cd142bd` | 리스 회수 (돈 걸린 두 레인) |
| `5330960` | 스위프 경계 선언 + 미제출 렌더 인수 |
| `dea4dd2` | 라운드 종료 잡 환불 |
| `d447ea6` | finalize 프로버넌스 기록 |
| `1dcec67` | (머지) studio-lease는 C 것 유지, 테스트 목록 합집합 |
| `77cd05d` | 지출 모듈 원본 하나 + 미러 |
| `48e8ee8` | 음악 E2E 32/32 + 캡 순서 정정 |
| `e27f5db` | ⑦-3 플레이스홀더 예시 분리 |

머지로 들어온 A 커밋(`2851b4d` 스위프 배선 / `5c467b9` 렌더 소유권 / `986b359` pricing-health / `b355b78` 알림 도메인 / `cc2dc18`)은 내 것이 아니다.

### 워커 — 내 것

| 해시 | 내용 |
|---|---|
| `0c158cf` | music 레인 (인터페이스에 대고 작성, 어댑터 0) |
| `d7f5753` | 3rd-party 호출 전부에 월클럭 |
| `40fca7f` | claim_token + CAS 쓰기 + 시도별 R2 키 |
| `2714b61` | 리스 상실은 실패가 아니다 (양 레인) |
| `a5e68c3` | (머지) attempt-key 메커니즘 하나로 — A 것 채택 |
| `958a574` | 두 레인 지출 합산 + 드리프트 지표 |
| `8cf363a` | 지출 모듈 미러 |

A 커밋 `2069b8d`(렌더 claim token)는 내 것이 아니다.

### 검증 (★전부 로컬, CI 별도 표기)

앱 `npx tsc --noEmit` **0** · `npm test` **175/175** · `npm run test:e2e-music` **32/32**
워커 `npx tsc --noEmit` **0** · `npm test` **39/39**
GitHub Actions: 앱 `checks` **success** / 워커 `tests` **success**

KAT 골든 무변화 — v1m canonical(`v1m|assetId|source|contentHash`) 밖만 건드렸다.

---

## 2. ③a — 6단위 전부 종료

| # | 단위 | 상태 |
|---|---|---|
| 1 | 가격 fail-closed + 단가 단위 중립화 | ✅ (어제 `503b1e0`, 오늘 A 가드와 통합) |
| 3 | provider 경계 (타입 시그니처) | ✅ `lib/music-provider.ts` + `music-license.ts`, 워커 미러 |
| 2 | 워커 music 레인 | ✅ `src/music-lane.ts` — **어댑터 0개, 벤더 이름 0개** |
| 4 | 프로버넌스 4컬럼 기록 | ✅ 워커 + 앱 `finalizeMusicGeneration` |
| 5 | 사용량 모니터링 | ✅ `lib/studio-spend.ts`(원본) + 워커 미러 |
| 6 | E2E | ✅ `scripts/e2e-music.mjs` 32/32 (벤더 무관분) |

### 핵심 구조

- **경계**: 공급자는 `MusicLicenseTerms` 불리언 7개 + 구조화된 인용(`document`/`clause`/`retrievedAt`/`confirmedBy`, **clause 없으면 컴파일 실패**)을 선언한다. **라벨은 우리 분류기가 붙인다** — 자기증명 금지. 분류 불가 = **부팅 시 등록 거부**.
  ★불리언 **값**은 엔지니어가 채우지 않는다. 대표님·고문이 계약 원문으로 확정해 주입한다.
- **슬롯**: primary/fallback 2개, 라운드로빈 금지. 폴백은 primary **불능**일 때만, **영구 거부는 폴백에 안 넘긴다**.
- **오류**: `MUSIC_RATE_LIMITED` **하나만** 분류. 미제공→재큐·환불 없음 / 그 외→영구·환불. **필드 0개**(벤더 헤더 비의존).
- **데드라인**: `FAL_GEN_TIMEOUT_MS` / `MUSIC_GEN_TIMEOUT_MS` **35분**. 유도 = 4회 시도 × 최장 성공 **518.0s** + 백오프 ~30s. 리스 임계 = 2배 = **70분**(렌더는 A의 30분).
  ★음악 35분은 **재사용이지 측정이 아니다** — 벤더 확정 후 재설정.
- **리스**: `claimed_at`/`attempts`/`claim_token`. 재큐잉 `attempts < 2` — **비용 상한이자 좀비 창 상한**. 종착 = 환불.
- **좀비**: 클레임 잃으면 **행도 못 건드리고 환불도 못 한다**. R2 키에 토큰(A의 `attemptToken`) — 토큰 CAS는 **행을 지키지 바이트를 못 지킨다**.

### ★남은 것은 전부 ③b 뒤 — 그리고 ③b가 재정의됐다 (5절)

---

## 3. ★⑦ 실측 — 브리프와 다르다

전부 코드·라이브 DB 확인. 브리프 수치를 옮기지 않았다.

| 브리프 | 실측 (2026-08-02) |
|---|---|
| KIRA/YUZU/RIN 3명 | ★`official_actors` **1행**. slug `actor-3-beauty-cf`, `display_name = "RIN"` |
| `display_name = null`로 진행 | ★**"RIN"이 들어가 있다.** 온보딩 스크립트 주석과 데이터가 불일치 |
| service_role 전용 | ✅ **실증**: anon 읽기 → **HTTP 401 / 42501** |
| KIRA·RIN i2v 회귀 | ★KIRA는 `official_actors`에 **없다** |

### ★발견 1 — 소비 지점이 0개다

`official_actors`를 읽는 **앱 코드가 없다.** 전수 grep 결과 접근하는 건 `scripts/onboard-actor-insert.mjs`(일회성 온보딩) 하나. `lib/`·`app/` 읽기 경로 **0**.
→ "admin 노출·사용 표기"는 **마감이 아니라 신규 구축**이다. 브리프의 1일 견적은 노출할 배선이 있다는 전제였다.

자산 자체는 온전하다: R2 5장 **전부 HTTP 200**, CryptoBind 서명 있음(`HMAC-SHA256-v1actor-stable`), provenance 7키 기록.

### ★발견 2 — 자기 정정: `getModelById`는 `active`를 안 본다

내가 "모델 5종 `active=false`라 **i2v 회귀 불가**, 이것이 ⑦의 실질 블로커"라고 올렸는데 **틀렸다.**

```
lib/studio.ts:730  createImageGeneration → getModelById(...)
lib/studio.ts:917  createI2vGeneration   → getModelById(...)
lib/studio.ts:292  getModelById -- "loads by id and never consults `active`"
```

**`active`는 "picker에 뜨는가"만 정하고 "호출 가능한가"를 정하지 않는다.**
→ **i2v 회귀는 `active` 없이 돌릴 수 있다.** ⑦-5에 전환이 **필요 없고**, ⑪까지 같이 열리는 문제도 ⑦ 때문에 생기지 않는다. **대표님 결정 하나가 사라졌다.**
원인: **picker 경로만 보고 enqueue 경로를 안 봤다.**

### ⑦-5 부수 확인 (조회만, 아무것도 안 켬)

`session6_enabled`가 닫힌 동안 `active=true`가 참가자에게 **도달하는 경로 0개**:
`getActiveModels()` 호출부 **정확히 3곳**(`actions.ts:146,147` / `studio.ts:514`), 전부 `isSession6Enabled()` 뒤. `app/studio/actions.ts` 서버 액션 **18개 / 게이트 18개**. 게이트는 fail-closed. 라이브 `session6_enabled="false"`.
`STUDIO_DEV_UNLOCK`은 우회하지만 **프로드 부재 확인 완료**(A 실측 `vercel env ls` 19개 중 없음).

### ⑦-3 완료 (`e27f5db`)

`lib/studio-actors.ts` → `lib/character-name-examples.ts`. 이름뿐 아니라 **모양도** 바꿨다 — 옛 항목의 `kind`/`descriptor`는 **배역을 기술하는 필드**라 그게 로스터로 읽히게 만들었다. 실측상 바깥에서 import된 건 **합친 예시 문자열 하나뿐**이었다.
★**값(KIRA/YUZU)은 안 건드렸다** — 명명은 본부 미결. 다만 브랜드 리스크가 이제 **"우리 배우 이름"이 아니라 "참가자 작명 예시"**에 걸린다 — 노출 성격이 달라 본부가 경중을 다르게 볼 수 있다.

---

## 4. ★대표님 확정 — 시즌0 음악 = B안

| | |
|---|---|
| 시즌0 | **B (사전생성 라이브러리)**, **300곡** |
| 시즌1 | C |
| 장기 | A |
| ★대량 생성 시점 | **시즌 테마 확정 후** — 톤이 테마에 걸린다 |

---

## 5. ★B안 전환으로 ③b가 재정의된다

기존 ③b = "실제 공급자 연결(참가자 생성)". **바뀐다.**

| | 기존 전제 | B안 |
|---|---|---|
| 참가자 경로 | 참가자가 AI 생성 | **참가자는 고르기만** |
| ③b 핵심 | 어댑터 + rate limit 대응 | ★**라이브러리 자산관리 + 피커** |
| 블로커 | ElevenLabs §3.A 회신 | ★**폐기됨.** 실블로커 = 공급자 확정(Enterprise OEM 계약 문제) |
| 대량 생성 | — | 시즌 테마 확정 후 |

★**이미 지은 것 중 B안에서 그대로 쓰이는 것**: 게이트 2단(`isMusicEnabled` = master만 = **라이브러리 피커**), `studio_music_assets` 스키마 + v1m 서명, `seed-music.ts`(1곡 업로드·서명·insert), 렌더 측 믹싱, 프로버넌스 4컬럼.
★**B안에서 당장 안 쓰이는 것**: music 레인(`processOneMusicJob`)·provider 경계·rate limit — **시즌1 C안에서 쓰인다. 버리지 마라.**
★**B안이 새로 요구하는 것**: 300곡 큐레이션·저장·**선택 UI**·라이선스 기록의 라이브러리판.

---

## 6. 내일 첫 작업 = ★B안 5문항 실측

★**5문항 전문을 아직 못 받았다.** 받은 것은 우선순위뿐: **⑤ "가격 fail-closed가 라이브러리 경로를 막나"가 가장 급하다.**

⑤에 대한 **가설**(오늘 읽은 코드 기준, 미검증 — 내일 실측할 것):
`validateMusicPricing` / `creditsForCostOrNull`은 **`createMusicGeneration`(AI 생성 경로) 안에만** 있다. 라이브러리 픽은 `isMusicEnabled`(master 스위치)만 보고 과금 경로를 안 탄다. → **안 막을 가능성이 높다.** 단 `submitRender`/`createRender`의 음악 게이트 인자와 `listMusicAssets` 경로를 실제로 밟아 확인해야 한다.

### 내일 순서 (제니2 지시, ③은 오늘 완료돼 제외)

1. **B안 5문항 실측** — ⑤ 먼저. ★문항 전문 필요
2. 라이브러리 파이프라인 설계 (코드 0줄, **테마 무관한 것만**)
3. ~~⑦-3~~ → **오늘 완료 (`e27f5db`)**
4. ③b 새 범위·공수 산정

---

## 7. 대기 / 물려 있는 것

| 항목 | 소관 |
|---|---|
| ⑦-1 착수 범위 (어드민 CRUD가 발사 필수인가) | 대표님 |
| ⑦-2 `display_name = "RIN"` | 본부 |
| 스위퍼 배선 동작 확인 | A (배선 완료 `2851b4d`) |
| `lib/studio-spend.ts` 알림 소비 | A (호출만) |
| Phase F 재측정 | 실부하 시점 |
| ③b 공급자 확정 | 대표님·고문 |

---

## 8. 오늘 얻은 규율 (재사용 가능한 것만)

1. ★**쌍 단위 검증이 통과해도 총량은 틀릴 수 있다.** 37쌍 전부 일치했는데 합계는 갈렸다. 원인은 합산 방식이었다.
2. ★**우연히 안전한 것은 안전한 게 아니다.** `Date.parse(null)`=NaN이라 순진한 비교가 우연히 fail-safe였다 → 명시적 `false` + 테스트.
3. ★**클레임을 잃으면 실패시킬 권리도, 따라서 환불할 권리도 잃는다.**
4. ★**토큰 CAS는 행을 지키지 바이트를 못 지킨다.** 결정적 R2 키 = 서명 파손 경로.
5. ★**자기가 테스트하는 걸 재구현한 하니스는 실제 코드가 드리프트해도 계속 통과한다.**
6. ★**미러가 몇 개냐가 아니라 원본이 몇 개냐가 문제다.**
7. ★**picker 경로를 봤다고 enqueue 경로를 본 게 아니다.**

### 새로 생긴 명령

```
npm run test:e2e-music     음악 E2E (season_test, 벤더 무관분 32건)
```
