# B안 5문항 실측 + ⑪ 1차 실측 — 2026-08-02 (지수2C, 2세션)

★**조회만. 앱·워커 소스 0줄 변경.** 모든 수치에 출처를 붙였다.

측정 환경: 라이브 Supabase(`qrnkovokjmimagrwjebs`), service_role, read-only.
코드 기준: 앱 `feat/studio-lane-c` (A의 `12dc3e0`까지 머지 후), 워커 `8cf363a`.

---

## 0. 이번 세션 머지

| | |
|---|---|
| 앱 | `f0fc169` + `git merge feat/studio-budget-guard` → 충돌 0. 유입 = `eb6796c`(KAT 크로스레포) · `12dc3e0`(시계 이동 E2E). 소스 변경 없음(e2e 3파일 + package.json 2줄) |
| 워커 | `8cf363a`. `origin/main` 대비 미유입 **0건** |

머지 후 앱 `npx tsc --noEmit` **0** (로컬).

---

## 1. B안 5문항

### ① 참가자 생성이 없으면 워커 music 레인·리스·환불·과금이 시즌0에 도는가

**전부 안 돈다. 그리고 안 도는 것이 설계된 상태다 — 우연이 아니다.**

| 경로 | 실측 근거 | B안(master ON / ai OFF)에서 |
|---|---|---|
| 워커 music 레인 | `worker.ts:1076` `if (MUSIC_CONCURRENCY > 0)` | env 미설정 = 0 = 레인 미기동 |
| 부팅 정합 가드 | `music-lane.ts:588~591` — `studio_music_enabled=true` **AND** `studio_music_ai_enabled=true`인 시즌만 조회 | B안은 ai가 false → **throw 안 함, 정상 부팅** |
| 클레임 필터 | `music-lane.ts:172` `.eq('source','ai')` | 라이브러리 행은 애초에 후보가 아님 |
| 리스 회수 | `lib/studio-lease.ts:206,211` `inFlight:['generating']` + `scope:{source:'ai'}` | 라이브러리(`status='ready'`, `source='library'`)는 스코프 밖 |
| 환불 | `refundMusicGeneration` / `refundMusicJob` — 둘 다 `credit_transactions.metadata->>music_asset_id`로 charge 행을 찾음 | charge가 없으면 `if (!charge) return true` → 아무 일도 없음 |
| 과금 | `createMusicGeneration`(`music-gen.ts:185`) **한 곳뿐**. 첫 두 줄이 `gate.enabled`/`gate.aiEnabled` | ai OFF → `music_ai_disabled`로 즉시 거부 |

★**단, 하나 조심할 것.** `MUSIC_CONCURRENCY`를 "혹시 몰라서" 1 이상으로 두면
`buildMusicProviderSlots()`가 돈다 → `ADAPTERS`가 비어 있어 **throw** → `main()`이
죽어서 **generation·render 레인까지 같이 안 뜬다**(`worker.ts:1076~1084`).
**B안에서는 `MUSIC_CONCURRENCY`를 반드시 미설정으로 두어야 한다.** 이건 Railway
환경변수 얘기라 배포 시점 체크리스트 항목이다.

부수 확인: `sumVendorSpendUsd`(`studio-spend.ts:58`)는 `actual_cost_usd IS NOT NULL`만
합산한다. 라이브러리 행은 `seed-music.ts`가 이 컬럼을 안 쓰므로 NULL → **집계에서 제외**.
의도와 맞다(참가자 선불금 대비 벤더 지출을 재는 지표이지, 회사가 라이브러리를
만드느라 쓴 돈의 원장이 아니다). 다만 **300곡 제작비는 어떤 지표에도 안 잡힌다** —
필요하면 별도 항목이고, 지금은 없다는 사실만 기록한다.

### ② `studio_music_assets`가 참가자별 행인가 라이브러리 카탈로그인가

**둘 다다 — `source` 컬럼으로 갈라지는 단일 테이블이다.** 설계상 의도된 합거다.

라이브 컬럼 **27개** (개별 `select` 27/36 성공, 2026-08-02):
```
id source user_id title mood prompt duration_seconds r2_key url
cryptobind_content_hash cryptobind_signature cryptobind_generated_at cryptobind_algo
status error_message active created_at updated_at
season_id round attempts claimed_at claim_token
provider provider_model provider_generated_at license_type actual_cost_usd
```
부재 확인: `genre` `bpm` `tags` `license_url` `sort_order` `credits_charged`
`worker_started_at` `worker_finished_at` **없음**.

| | `source='library'` | `source='ai'` |
|---|---|---|
| `user_id` | **NULL** (`seed-music.ts:80`) | 참가자 uuid |
| `season_id` / `round` | **NULL** (seed가 안 씀) → 시즌 횡단 자산 | 생성 시점 스탬프 (캡 축) |
| `status` | 항상 `ready` | queued→generating→ready/failed |
| `active` | 큐레이션 on/off | 무의미(필터에 안 걸림) |
| 리스 3컬럼 | 미사용 | 사용 |
| 프로버넌스 4컬럼 | ★**미기록** (5절 참조) | 워커가 기록 |

**행 수 실측 = 0.** 테이블 전체가 비어 있다(E2E가 자기 시드를 정리한 뒤 상태).
→ **300곡은 전부 신규 적재다. 마이그레이션할 기존 자산이 없다.**

### ③ v1m 서명이 라이브러리 곡에도 필요한가

**필요하다. 선택이 아니라 두 지점에서 강제된다.**

1. **피커 진입 자체가 막힌다** — `listMusicAssets`(`studio.ts:1296`)가
   `a.cryptobind_signature &&` 로 필터. 서명 없는 라이브러리 곡은 **목록에 안 뜬다.**
2. **렌더에서 거부된다** — `resolveMusicSignature`(`studio.ts:1358`)가 `source` 구분
   없이 `verifyMusicAssetBind`를 돌리고, 실패 시 `music_cryptobind_failed`.

canonical은 `v1m|assetId|source|contentHash`이고 `source`가 서명 안에 들어간다
(`seed-music.ts:73`이 `source:'library'`로 서명). 즉 **라이브러리 서명과 AI 서명은
서로 대체 불가**이고, 이건 반스왑 설계상 맞다.

→ 300곡 적재 파이프라인은 **곡마다 v1m 서명을 반드시 만들어야 한다.** 서명을 못 붙인
곡은 조용히 사라지는 게 아니라 "목록에 없음"으로 나타난다(fail-closed 방향은 맞음).

### ④ 캡 15가 의미를 갖는가

**B안에서는 도달 불가능한 코드다 — 사문화 쪽이 맞다.** 제니2 독해대로다.

- 캡을 읽는 곳은 `gate.cap` 두 군데뿐: `createMusicGeneration`(`music-gen.ts:239`)와
  `actions.ts:722`(패널 표시). **둘 다 `aiEnabled` 뒤**다.
- 세는 함수 `countMusicGenerationsForRound`(`music-gen.ts:169`)가 `.eq('source','ai')`.
  **라이브러리 선택은 애초에 세지 않는다** — 셀 행이 안 생기기 때문이다.
  라이브러리 픽은 EDL 안의 `music.assetId` 값일 뿐, 테이블에 아무것도 안 남긴다.
- 라이브 값 실측: `season_0`/`season_1`/`season_test` 전부
  `studio_music_max_generations_per_round = 15`, `studio_music_enabled=false`,
  `studio_music_ai_enabled=false`.

★**"한 출품작에 음악 트랙 몇 개"는 실제로 별개이고, 지금 답은 1개다** —
`MusicBed`는 EDL당 **단일 객체**이지 배열이 아니다(`validateMusicBed`가 `music`
하나만 검사, `resolveMusicSignature`가 `music.assetId` 하나만 해석). 여러 트랙을
깔려면 EDL 스키마 변경 + v1sr 번들 변경 + 워커 믹싱 변경이고, **그건 캡 문제가 아니라
기능 추가**다. 시즌0 범위인지 확인 필요.

### ⑤ 가격 fail-closed(`music_not_priced`)가 라이브러리 경로도 막는가

**막지 않는다. 가설대로였고, 세 지점 전부 밟아 확인했다.**

| 지점 | 실측 |
|---|---|
| `createMusicGeneration` | `validateMusicPricing`(`music-gen.ts:261`) + `creditsForCostOrNull`(273) — **AI 생성 경로 안에만 있다** |
| `createRender` / `submitRender` | 1369~1780 구간에 `Pricing`/`credits`/`charge` **문자열 0건**. 렌더는 자기 CPU라 과금 자체가 없다 |
| 스튜디오 페이지 로드 (`actions.ts:699~717`) | 가격 체크가 `if (musicAiEnabled)` **블록 안**. 게다가 실패해도 하는 일은 `musicAiEnabled = false` 하나 — `musicEnabled`(라이브러리)와 `musicAssets`는 **손대지 않는다** |
| `pricing-health` §3 (`pricing-health.ts:139~142`) | `studio_music_ai_enabled=true`인 시즌이 있을 때만 검사 → 라이브러리 전용 시즌은 **오경보 없음** |

라이브 확인: `platform_config`에 `%music%` 키 **0개**. 즉 지금 AI 음악은 **미가격
상태**이고, 그런데도 라이브러리 경로는 그것과 **완전히 독립**이다.

★**판정은 유보한다 — 정책이 두 방향이고 코드는 한 방향만 지원한다.**

| 정책 | 위 사실의 의미 | 필요한 일 |
|---|---|---|
| **고르기 무상** (제니2 권고) | **정상 동작.** 과금 경로가 없는 게 맞다 | **없음.** 코드 변경 0 |
| **고르기 유상** | **결함.** 라이브러리 픽에는 charge·balance·환불·캡이 **하나도 없다** | 신규 과금 경로 + 캡 재해석 + 환불 정의. 작은 일이 아니다 |

내 관측 하나 덧붙인다(권고 아님, 사실): 유상으로 가면 **곡 선택이 실패할 수 있는
동작이 된다**(잔액 부족 → 편집 중 거부). 지금 라이브러리 픽은 실패 모드가 없는
읽기 동작이라, 유상화는 UI 상태기계도 같이 바꾼다.

---

## 2. ⑪ 참가자 캐릭터 일관성 — 1차 실측

### 2.1 브리프 확인된 것

- 참가자 이미지 모델 **2종 확정** (metadata 실측):
  `nano-banana-pro` = `media_type:image`, `tier_label:premium`, $0.15/장, `active=false`
  `flux2-pro-image` = `media_type:image`, `tier_label:value`, $0.045/장, `active=false`
- `ideogram-character`(+`-draft`)도 `media_type:image`지만 **참가자 경로 아님**
  (OXXOVO 배우 온보딩 스크립트 전용) — 둘 다 `active=false`.
- 이미지 원가는 `cost_per_second_usd`를 **장당 USD로 재사용**한다
  (`studio.ts:766` `const estCost = model.cost_per_second_usd // per-image`).
  이름이 오해를 부르지만 동작은 일관적이다.
- 캡 축 **동적, 하드코딩 없음**. 라이브 `season_0`:
  `studio_max_image_generations_per_round=20` / `_draft_=40` /
  클립 `studio_max_generations_per_round=30` / `_draft_=30` / `studio_round='both'`.

### 2.2 ★어제 자기정정의 물증이 나왔다

`getModelById`가 `active`를 안 본다는 어제 정정(추론)이, **실제 생성 이력으로 확인**됐다.
`generation_jobs` 집계(2026-08-02):

```
image/nano-banana-pro     13
video/kling-v3-pro-i2v     2
video/ltx2-fast           27   video/seedance2  3   video/ltx-video 2
video/veo31-lite-draft     1   video/veo31-lite 1   video/kling-v3-pro 2
```

`nano-banana-pro`와 `kling-v3-pro-i2v`는 **지금도 `active=false`인데 잡이 만들어졌다.**
→ `active`는 picker 노출만 정한다는 것이 추정이 아니라 **기록**이다.

`studio_characters` **2행** (둘 다 `season_test`, `status=ready`, 정면 이미지 보유,
1행은 참조 2장 + 미삭제 / 1행은 soft-delete). 2026-07-18~19 생성.
→ 참가자 경로는 **한 번 끝까지 돌아본 적이 있다.**

### 2.3 ★막고 있는 것은 정확히 `active` 3행이고, 그 중 하나는 부작용이 있다

| 모델 | 켜야 하는 이유 | 켜면 생기는 일 |
|---|---|---|
| `nano-banana-pro` | ①배우 만들기 picker | 정상 |
| `flux2-pro-image` | ①배우 만들기 picker (value 티어) | 정상 |
| `kling-v3-pro-i2v` | ③샷 촬영 picker (`ActorMode.tsx:596` `filter(m => m.acceptsI2v)`) | ★**아래** |

★**`kling-v3-pro-i2v`는 `media_type:video`라서, `active=true`로 켜는 순간
일반 텍스트→영상 picker에도 같이 뜬다.** `app/studio/page.tsx:814~815`가
`state.models`를 `tier`로만 가르고 `acceptsI2v`를 **제외하지 않는다**.
`accepts_start_image=true`인 모델은 카탈로그 19행 중 이것 하나뿐이라, 지금까지
드러날 일이 없었다.

관련해서 **서버 측 방어가 한 칸 비어 있다**:
`createI2vGeneration`(`studio.ts:919~921`)은 `mediaType==='video'`만 검사하고
**`acceptsI2v`는 검사하지 않는다.** 액션 계층(`actions.ts:325~337`)도 안 한다.
즉 i2v 여부를 거르는 유일한 곳이 **클라이언트 필터 한 줄**이다. 이 레포의 원칙
("참가자 입력 불신, 서버가 권위")과 어긋난다.
비용 관점에서 즉시 사고는 아니다(잘못 보내면 fal 422 → `refundFailedJob` 환불).
그래도 **부과→실패→환불 왕복**과 오해를 부르는 실패 메시지가 남는다.

### 2.4 ★내가 세웠다가 스스로 접은 가설 (기록)

"`kling-v3-pro-i2v`의 `param_whitelist`가 null이니 `multi_prompt`/`elements`가
거부된다" — **틀렸다.** 이 파라미터들은 참가자 `advanced`가 아니라
`user_params.i2v_input`으로 **서버가 조립**해서 화이트리스트를 우회해 병합된다
(`worker.ts:502~507`, `studio.ts:953~959`). 화이트리스트는 참가자 자유입력에만 걸린다.
→ **⑪의 블로커 아님.** picker 경로만 보고 판단하려던 어제 실수를 반복할 뻔했다.

### 2.5 남은 ⑪ 실측 (아직 안 함)

- Kling V3 Pro i2v **실호출** 실측(비용·실패모드·`multi_prompt` 6샷 상한 실제 거동)
  — 외부 API라 불확실성 최고. **비용 발생**이라 착수 전 승인 필요.
- 이미지 캡 20/40이 라운드 전환에서 실제로 리셋되는지 실주행.
- 참가자 풀 경로 E2E(생성→등록→i2v 3샷→compose 반입).

---

## 3. 대표님·본부로 올라가는 것

| # | 질문 | 왜 내가 못 정하는가 |
|---|---|---|
| 1 | 라이브러리 곡 **고르기 유상/무상** | 유상이면 ⑤가 결함이 되고 신규 과금 경로가 필요. 무상이면 코드 변경 0 |
| 2 | 한 출품작에 **음악 트랙 1개 고정 유지**? | 지금 EDL은 단일 `MusicBed`. 복수는 EDL+서명+워커 변경 |
| 3 | 300곡의 **분류 축**(장르/무드 vocabulary) | 테마 종속 + 본부·제니3 소관. 나는 **그릇 모양**만 정한다 |
| 4 | ⑪ i2v **실호출 예산 승인** | 실제 fal 과금 발생 |
