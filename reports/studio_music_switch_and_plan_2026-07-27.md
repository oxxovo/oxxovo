# Studio 음악 — ①마스터 스위치 설계안 + ②플랜 볼륨 산출 (2026-07-27, 지수2)

**승인 대기 문서.** ①이 승인되기 전에 구현(③)으로 넘어가지 않습니다.
Lyria 관련 큐(정체확인·provider·SynthID·Pre-GA 방어·fal 서면문의)는 전부 닫았습니다.

---

# ① 마스터 스위치 설계안

## 1-0. 선행: 마이그 복구 SQL

`reports/studio_music_migration_repair_2026-07-27.sql` — **자체 완결형으로 다시 썼습니다.**
(원본 마이그 파일을 "그다음에 또 실행"하는 2단계 구조였는데, 붙여넣기 사고 여지를 없애려고 한 파일로 합쳤습니다.
**원본 `studio_music_assets_migration_2026-07.sql`은 이제 실행하지 마십시오.**)

- **순수 ASCII** (검증: non-ASCII 0바이트), **LF only** (`.gitattributes`가 `*.sql text eol=lf` 고정)
- **service_role GRANT 세트 포함** — `REVOKE FROM PUBLIC/anon/authenticated` + `GRANT ALL TO service_role`.
  DROP TABLE로 기존 GRANT가 같이 날아가므로 전 세트를 다시 세웁니다.
- **STEP 0 안전장치**: `count(*)` 단독 실행 → **0이 아니면 중단**. 0행 실측했지만 드롭 전 재확인.
- **STEP 4 검증 6종**: 컬럼 18개 / GRANT가 service_role뿐 / 전 시즌 false / ON된 시즌 0 /
  **컬럼명 공백 오염 가드**(`column_name !~ '\s'`) / **앱이 실제 쓰는 select 재현**(42703 해소 확인)
- **ON 문장은 주석 처리**해 두었습니다. 실수로 켜지지 않습니다.

**★순서 규칙**: TK님 Run → STEP 4 전부 통과 → **그다음에** 제가 스위치 리팩터 코드를 올립니다.
**migrate → verify → code.** 이번 사고가 정확히 이 순서를 어겨서 난 것이라 반복하지 않습니다.

## 1-1. 게이트 = seasons 컬럼 **2개** (TK 수정 반영 — 폐기 아님, 계층 이동)

제 진단이 반만 맞았습니다. **문제는 플래그가 둘인 게 아니라 저장 계층이 둘**이었습니다.
그리고 "라이브러리만 켜기"는 잃어도 되는 기능이 아니라 **3.A 폴백 그 자체**입니다 —
OXXOVO가 자기 계정으로 베드를 미리 만들고 참가자는 고르기만 하면 **참가자에게 API가 닿지 않아
3.A를 회피**합니다. 그 상태가 곧 `master ON / ai OFF`입니다. 지우면 안 됩니다.

**확정 구조 — seasons 컬럼 2개 (계층 통일):**

| 컬럼 | 역할 | 기본값 |
|---|---|---|
| `seasons.studio_music_enabled` | **마스터** — 음악 기능 전체 | `false` |
| `seasons.studio_music_ai_enabled` | **AI 생성** — platform_config에서 컬럼으로 이동 | `false` |

**판정 규칙**
- **AI 생성** = 마스터 `AND` ai. 둘 다 true여야 통과.
- **라이브러리** = 마스터만 true면 통과.
- **둘 다 fail-closed.** 컬럼없음 / 쿼리실패 / 시즌불명 / null → 전부 false.

**폐기: `platform_config` 키 `studio_music_ai_enabled`.** 전수 grep으로 참조를 남기지 않습니다
(현재 참조: `lib/music-gen.ts:88,101,115,150` — 전부 제거).
`studio_music_gen_max_per_user`도 같이 폐기하고 seasons 컬럼(§1-9)으로 옮깁니다.
남기는 config 키(게이트가 아니라 전역 파라미터): `studio_music_gen_cost_usd`,
`studio_music_gen_max_seconds`, `studio_music_artist_blocklist`.

## 1-2. fail-closed 판정기 — `lib/watch-scores.ts` 패턴 그대로, **판정 2개 노출**

새 파일 `lib/music-gate.ts`. 구조를 그대로 미러링하되 두 판정을 노출합니다:

```
import 'server-only'

// 한 번의 조회로 두 집합을 만든다 (watch-scores의 publicScoreSeasons 미러).
export async function musicGateSeasons(): Promise<{ master: Set<string>; ai: Set<string> }>

export async function isMusicEnabled(seasonId?: string|null): Promise<boolean>    // 라이브러리 = master
export async function isMusicAiEnabled(seasonId?: string|null): Promise<boolean>  // 생성 = master AND ai
```

- `.select('id, studio_music_enabled, studio_music_ai_enabled')` 한 번만 조회.
- `error` → `console.warn` 후 **빈 집합 2개 반환**(컬럼 없음·쿼리 실패 포함). throw 하지 않음.
- `seasonId` 없음/불명 → `false`.
- `isMusicAiEnabled`는 **master도 함께 확인**합니다. ai만 true인 행이 실수로 생겨도 안 열립니다.
- **true는 오직 행에 명시적 true가 있을 때만.**

## 1-3. 호출부 교체표 (파일:줄 실측)

| # | 위치 | 현재 | 변경 | 왜 |
|---|---|---|---|---|
| 1 | `lib/studio.ts:1351` `loadComposeState` | 통합 select에 `studio_music_enabled` 포함 | **통합 select에서 빼고** `isMusicEnabled()` 별도 호출 | ★**지금 42703으로 통째 실패하는 지점.** 게이트를 분리해야 fail-closed가 됨 |
| 2 | `lib/studio.ts:1650` `submitRender` | 위와 동일 | 동일 | 동일 |
| 3 | `lib/studio.ts:1459` `createRender` | `!!seasonRow.studio_music_enabled` 전달 | `await isMusicEnabled(seasonId)` 전달 | 서명 폴딩이 게이트를 따라야 함 |
| 4 | `lib/studio.ts:1695` `submitRender` | 위와 동일 | 동일 | 동일 |
| 5 | `lib/studio.ts:1250` `listMusicAssets` | `.single()` 직접 조회 | `isMusicEnabled()` | 판정 일원화 |
| 6 | `lib/music-gen.ts:142~150` `createMusicGeneration` | 시즌 조회 + `cfg.aiEnabled` **2중** | `isMusicEnabled()` **단일** | 이름 일원화 |
| 7 | `app/studio/actions.ts:614~652` | `musicAiEnabled` 계산·반환 | 제거, `musicEnabled` 단일값 | UI가 볼 값도 하나 |
| 8 | `ComposeEditor.tsx:82` / `page.tsx:46,112` / `ProComposeEditor.tsx:1523` | `musicAiEnabled` prop | `musicEnabled` | 이름 통일 |

**1·2번이 마이그 복구와 맞물립니다.** 통합 select에서 빼면 컬럼이 없어도 compose가 안 깨집니다 —
즉 이 리팩터 자체가 같은 사고의 재발 방지책입니다.

## 1-4. ★서버측 차단이 본체 (UI 숨김은 부수)

지시대로 **API 직접 호출로 뚫리지 않게** 서버 경로마다 게이트를 겁니다.

| 서버 경로 | 게이트 | OFF일 때 |
|---|---|---|
| `generateMusicAction` → `createMusicGeneration` | `isMusicEnabled` (첫 관문) | `music_disabled` 반환, **크레딧 미차감** |
| `pollMusicAction` / `getMusicAssetStatus` | `isMusicEnabled` | 상태 미노출 |
| `listMusicAssets` (피커 목록) | `isMusicEnabled` | `{enabled:false, assets:[]}` |
| `createRender` (렌더 요청에 music 포함) | `resolveMusicSignature`가 게이트값 수신 | music bed 거부 |
| `submitRender` (제출) | 동일 | 동일 |

UI 숨김(`ProComposeEditor` 패널)은 **그대로 두되 유일한 방어선이 아닙니다.**

## 1-5. ★크레딧 경로도 같은 게이트 뒤

현재 `createMusicGeneration`의 순서는 **게이트(1) → 프롬프트 검증 → 흉내차단 → 모더레이션 →
캡 → 과금(4) → asset insert(5)** 입니다. 즉 **과금이 이미 게이트 뒤**입니다.
리팩터 후에도 이 순서를 유지하고, **게이트를 함수 최상단 첫 문장**으로 고정합니다.
추가로 회귀 테스트를 하나 넣겠습니다: *"OFF 상태에서 generateMusicAction 호출 →
`music_disabled` + `getBalance` 변화 0"*.

## 1-6. OFF 검증 경로 (dev bypass 없음)

지시대로 **우회로를 만들지 않습니다.** 참가자와 동일한 경로로 테스트합니다.

1. **OFF 검증** — season_0(=false)에서 참가자 계정으로 /studio/compose 진입 → 패널 미노출 확인 +
   서버 액션 직접 호출 → `music_disabled` + 크레딧 불변.
2. **ON 동작 검증** — **테스트 시즌만** `studio_music_enabled=true`로 올려서 확인.
   (프리뷰=프로덕션 같은 DB이므로 **라이브 시즌은 절대 건드리지 않습니다.**)
3. **어드민** — 시즌별 스위치 상태를 어드민에서 읽기로 노출(변경 버튼은 만들지 않음. ON은 SQL로만).

## 1-7. 그 외 살아있는 항목

- **R2 영구 보관 (타협 불가)** — provider URL 참조 저장 금지. 워커가 **다운로드 → R2 `music/` 업로드 →
  `r2_key`+`url` 기록 → v1m 재해시 검증 → `ready`**. 이미 `uploadVideo(kind:'music')`로 일반화돼 있습니다.
  provider 임시 URL은 **어디에도 영속 저장하지 않습니다.**
- **provider 추상화만** — `lib/music-gen.ts`의 `MusicProvider` 인터페이스 유지, `stubMusicProvider`가
  미설정 시 throw. **폴백 provider는 구현하지 않습니다**(지시대로. MiniMax도 동일한 라이선스 문제를
  그대로 갖습니다 — 개발자 API용 영문 상업조항 자체가 확인 안 되는 모델입니다).
- **고지 문구 자리만 확보** — 편집기 음악 패널 하단 + 참가자 약관에 슬롯만. **텍스트는 빈 채로.**

## 1-8. ★ON 조건 (내가 판단하지 않음)

**ElevenLabs Music API Terms 3.A**(Authorized Reseller가 아니면 제3자에게 API 접근을 재판매·재포장·
서브라이선스·제공 금지)가 우리 구조 — *스튜디오 안에서 참가자에게 음악 생성을 크레딧으로 판매* — 에
걸릴 소지가 있다는 지적, 타당합니다. 제 3판 보고는 **"우리가 상업권을 갖는가"**(플랜 결속)만 답했고
**"참가자에게 흘려보낼 수 있는가"**는 답하지 못했습니다. 미해결로 명시합니다.

> **ON = ElevenLabs 서면 회신 + TK님 판단.** 둘 다 나오기 전엔 켜지 않습니다.
> **ON 신호는 TK님한테서만 옵니다. 제가 판단하지 않습니다.**
> 켜는 방법은 배포가 아니라 SQL 한 줄입니다:
> `UPDATE seasons SET studio_music_enabled = true WHERE id = 'season_0';`

---

# ② 캡 · 경제성 · 플랜 (TK 정정 2건 반영)

## 2-0. ★제 전제 오류 정정

초안에서 저는 참가자 크레딧 단가($0.125/$0.094)를 계산해 놓고, **총액은 회사 부담처럼 다뤘습니다.**
같은 문서 안의 두 계산이 연결되지 않았습니다. 정정합니다.

- **음악은 비용 항목이 아니라 마진 항목입니다.** 참가자 부담 = **원가 × 1.25**(영상과 동일),
  드래프트 모드부터 라이브 검증까지 끝난 원칙입니다.
- 따라서 **"$1,500이 되니 캡을 5로"는 거꾸로 읽은 것**입니다. 캡을 올릴수록 회사는 법니다.
- **캡의 근거는 비용이 아니라 공정성입니다.** 참가자가 내는 구조에서 무제한은
  **"자본이 이긴다"**를 뜻합니다. 영상 캡 30의 원래 근거 그대로 — 천장이지 예산이 아닙니다.
- SQL·문서에서 **비용 근거 문구는 전부 제거**했습니다(검증: 잔존 0건).

## 2-1. 확정 캡 = **15** (draft 15 / competition 15, 라운드당)

영상(draft 30 / competition 30, 라운드당)의 **절반**. 음악은 주 산출물이 아니라 보조 요소라는
위계에 맞춘 값입니다. **비용 근거 아님.**

## 2-2. ★영상 캡 집행 방식 실측 (요청 항목) — 이미 횟수 기준입니다

| 단계 | 위치 | 방식 |
|---|---|---|
| 설정 로드 | `lib/studio.ts:340~363` `getSeasonStudioConfig` | `studio_max_generations_per_round` / `_draft_` |
| **횟수 집계** | `lib/studio.ts:370~402` `countGenerationsForRound` | `generation_jobs` **행 COUNT**. 필터 = `user_id`+`season_id`+`media_type`+**tier(draft ↔ non-draft)**+라운드 경계(`created_at` vs `main_round_start_at`) |
| **집행** | `lib/studio.ts:550~555` | `used >= capMax` → `cap_reached` 즉시 반환 |
| 잔액 확인 | `lib/studio.ts:557~562` | **캡 통과 후 별도로** 검사 |

★**캡 검사가 과금·잔액 검사보다 앞서고 서로 독립**입니다. 돈으로 시도를 살 수 없습니다.

**음악도 동일 방식으로 맞춥니다** — `studio_music_assets` **행 COUNT**
(`user_id` + `season_id` + `round` + `kind` + `source='ai'` + `status in (queued,generating,ready)`),
`used >= cap` → `music_cap_reached`, **그 다음에** 잔액 검사.
현재 `lib/music-gen.ts:182~189`은 season/round/kind 없이 플랫폼 전체를 세고 있어 라운드 축이 없습니다 →
마이그로 `season_id`/`round`/`kind` 컬럼을 넣었으니 그 축으로 교체합니다.

**공정성 마감**: draft 음악 베드는 **모든 제출 경로에서 차단**합니다(영상 draft tier와 동일 규칙).
그래야 draft 슬롯을 태워 competition 베드를 얻는 우회가 막힙니다.

## 2-3. 볼륨 재산출 (캡 15)

| 구간 | 건수 | 분량 | 매입원가 | 참가자 결제(×1.25) | 순마진 |
|---|---|---|---|---|---|
| **예선 competition** (500×15) | 7,500 | 5,000분 | **$750** | $937.5 | **+$187.5** |
| 예선 draft (500×15, 7주 분산) | 최대 7,500 | 5,000분 | 최대 $750 | $937.5 | +$187.5 |
| 본선 (max(10%,10명)=50×15) | 750 | 500분 | $75 | $93.75 | +$18.75 |

★**한 가지 덧붙입니다**: 대표님 계산 $750은 **competition만**입니다. draft도 15라
**최악 총 15,000건 = $1,500 원가**가 됩니다. 다만 draft는 8/5부터 7주 분산이고 크레딧으로
계속 회수되므로 **순간 플로트 요구는 예선 72h 창의 $750**이 맞습니다.

## 2-4. ★$750은 비용이 아니라 플로트(운전자금)

PAYG에 선충전 → 참가자 크레딧 판매로 회수. **지출이 회수보다 먼저**라 현금은 실제로 있어야 합니다.
- **72h 창 전에 PAYG 잔액 ≥ $750** (앞서 말한 $250은 캡 5 기준이라 폐기).
- draft 누적까지 감안하면 **여유 $1,000 권장**.
- ★**중간에 마르면 참가자 생성 중단 = 대회 사고.** 자동충전 확인이 결제 전 3건 중 최우선입니다.
  (fal 자동충전과 **같은 실패 모드** — 둘 다 발사 게이트.)
- **진짜 회사 부담은 사전생성 라이브러리(폴백)뿐**입니다. 100~200 베드 = **$10~20**.

## 2-5. 플랜 — Starter $6 + PAYG (승인 유지)

전 티어 실효단가가 정확히 **$0.15/분**이라 볼륨 할인이 없고, 상업 라이선스는 유료 전 티어 포함입니다.
Scale $299는 선불일 뿐 할인이 아니므로 철회 유지.

| 플랜 | 요금 | 포함 | 실효 단가 |
|---|---|---|---|
| **Starter** | **$6** | 40분 | $0.150/분 |
| Creator | $22 | 147분 | $0.150/분 |
| Pro | $99 | 660분 | $0.150/분 |
| Scale | $299 | 1,993분 | $0.150/분 |

**참가자 크레딧 단가(원가×1.25)**: 40초 베드 **$0.125**, 30초 **$0.094**.
*(부분 분 과금이 아니라 분 단위 올림이면 원가 $0.15 → 참가자 $0.188. 결제 전 확인 1번 항목.)*

## 2-6. 결제 전 확인 3건 — 대표님 큐 (제 큐에서 뺐습니다)

1. **부분 분 과금 여부** — 비용이 1.5배 갈립니다.
2. ★**PAYG 자동충전 + 잔액 이월** — 72h 창 도중 소진 = 대회 사고. **최우선.**
3. **Music이 PAYG 크레딧으로 커버되는지.**

# 보고 순서 준수

- **①** 이 문서 §1 + `studio_music_migration_repair_2026-07-27.sql` → **승인 요청**
- **②** 이 문서 §2 → **산출 완료** (권고: Starter + PAYG, 시즌 $250)
- **③** 구현 → **①승인 전까지 착수하지 않음**
