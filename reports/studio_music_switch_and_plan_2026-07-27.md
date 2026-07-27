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

## 1-1. 게이트 이름 = `seasons.studio_music_enabled` 하나

**현재 이름이 두 개로 갈려 있습니다** — 지시하신 사고 유형이 이미 코드에 있습니다:

| 이름 | 출처 | 현재 역할 |
|---|---|---|
| `seasons.studio_music_enabled` | seasons 컬럼 | 라이브러리 피커 + 제출 검증 |
| `studio_music_ai_enabled` → `musicAiEnabled` | **platform_config 키** | AI 생성 패널 노출 + 생성 허용 |

`createMusicGeneration`은 **둘 다 true여야** 통과하고(`lib/music-gen.ts:147,150`),
UI는 `musicAiEnabled`만 보고 패널을 그립니다(`ProComposeEditor.tsx:1523`).
→ **폐기합니다.** `studio_music_ai_enabled` / `musicAiEnabled`는 코드·config에서 전부 제거하고
**`studio_music_enabled` 단일 게이트**로 통일합니다.

> 잃는 것: "라이브러리는 켜고 AI만 끄기"가 안 됩니다. 그건 원래 Beatoven 대기용 임시 장치였고,
> 지금은 라이브러리도 AI도 **같은 ElevenLabs 라이선스 아래**라 분리할 이유가 없습니다.
> 나중에 정말 필요해지면 **config 키가 아니라 seasons 컬럼을 하나 더** 만들겠습니다(이름 규약 유지).

## 1-2. fail-closed 판정기 — `lib/watch-scores.ts` 패턴 그대로 복사

새 파일 `lib/music-gate.ts`. **새로 설계하지 않고 구조를 그대로 미러링**합니다:

```
import 'server-only'
export async function musicEnabledSeasons(): Promise<Set<string>>   // <- publicScoreSeasons 미러
export async function isMusicEnabled(seasonId?: string|null): Promise<boolean>  // <- areScoresPublic 미러
```

- `.select('id, studio_music_enabled').eq('studio_music_enabled', true)`
- `error` → `console.warn` 후 **빈 Set 반환**(컬럼 없음·쿼리 실패 포함). throw 하지 않음.
- `seasonId` 없음/불명 → `false`.
- **true는 오직 행에 명시적 true가 있을 때만.**

즉 **컬럼없음 / 쿼리실패 / 시즌불명 / null → 전부 숨김.** 지시하신 그대로입니다.

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

# ② 플랜 볼륨 산출

## 2-1. ★먼저 — Scale $299에는 볼륨 할인이 없습니다

플랜별 포함 분량을 단가로 환산하면 **전 티어가 정확히 $0.15/분**입니다:

| 플랜 | 월 요금 | 포함 분량 | 실효 단가 |
|---|---|---|---|
| Starter | $6 | 40분 | $0.150/분 |
| Creator | $22 | 147분 | $0.150/분 |
| Pro | $99 | 660분 | $0.150/분 |
| Scale | $299 | 1,993분 | $0.150/분 |
| Business | $990 | 6,600분 | $0.150/분 |

**구독료는 할인이 아니라 선불 충전입니다.** 그리고 상업 라이선스는 **유료 플랜 전부에 포함**되므로
티어는 권리 문제가 아닙니다. → **제가 3판에서 Scale $299를 권한 건 근거가 없었습니다. 철회합니다.**

## 2-2. 볼륨 산출

실측 파라미터: `season_0.max_applicants = 500`, `studio_compose_max_seconds = 40`(min 30).
음악 생성 캡 `studio_music_gen_max_per_user`는 **아직 미설정** → 시나리오로 제시합니다.

과금 단위가 분이라 **① 실사용 분 비례 ② 건당 1분 올림** 두 가지로 계산합니다
(ElevenLabs 직접 API의 부분 분 처리 방식은 **미확인** — 아래 2-5 확인 항목).

| 1인당 생성 캡 | 총 생성 건수 | 비례 과금 분량 | 올림 과금 분량 | **비례 비용** | **올림 비용** |
|---|---|---|---|---|---|
| 3회 | 1,500 | 1,000분 | 1,500분 | **$150** | $225 |
| **5회 (권장)** | 2,500 | 1,667분 | 2,500분 | **$250** | $375 |
| 10회 (영상 캡과 동일) | 5,000 | 3,333분 | 5,000분 | **$500** | $750 |

*(현재 영상 생성 캡은 30회/라운드입니다. 음악까지 30회로 두면 비례 기준 $1,500 —
**음악 캡은 반드시 따로, 낮게** 잡아야 합니다. 5회 권장.)*

## 2-3. 플랜별 총액 비교 (권장 시나리오 = 5회 캡, 1,667분)

| 플랜 | 구독료 | 포함분 | 초과분 | 초과 비용 | **총액** | 비고 |
|---|---|---|---|---|---|---|
| **Starter + PAYG** | $6 | 40 | 1,627 | $244 | **$250** | ★최저 |
| Creator + PAYG | $22 | 147 | 1,520 | $228 | **$250** | 동일 |
| Pro + PAYG | $99 | 660 | 1,007 | $151 | **$250** | 동일 |
| Scale | $299 | 1,993 | 0 | — | **$299** | **326분 미사용 = $49 낭비** |
| Business | $990 | 6,600 | 0 | — | **$990** | 대폭 초과 지출 |

**결론: 총액은 어느 플랜이든 실사용×$0.15로 수렴하고, 선불이 큰 플랜은 남은 분량만큼 손해입니다.**

### 권고: **Starter $6/월 + PAYG 충전**

- 실제 쓴 만큼만 나갑니다. 시즌0 예상 **총 $250 내외**.
- 3개월 $900 걱정은 해소됩니다. 게다가 **음악 사용은 72시간 예선 창에 집중**되므로
  구독을 3개월 유지할 이유도 없습니다(사용 월에만 활성화).
- 상업 라이선스는 Starter부터 포함이라 권리상 손해가 없습니다.

## 2-4. 참가자 크레딧 단가 (원가×1.25)

| | 30초 베드 | 40초 베드 |
|---|---|---|
| 원가(비례) | $0.075 | $0.100 |
| **참가자 청구(×1.25)** | **$0.094** | **$0.125** |
| 원가(올림) | $0.150 | $0.150 |
| 참가자 청구(×1.25) | $0.188 | $0.188 |

`platform_config` 세팅 예정 키: `studio_music_gen_cost_usd`(원가), `studio_music_gen_max_per_user`(=5),
`studio_music_gen_max_seconds`(=40), `studio_music_artist_blocklist`.
**부분 분 처리 방식이 확인되면 그 값으로 확정**합니다(올림이면 원가 $0.15 고정).

## 2-5. ★결제 전 확인할 것 3가지 (제가 1차 확인 못 한 항목)

1. **부분 분 과금** — 40초 생성이 40초로 계산되는지, 1분으로 올림되는지.
   (fal 경유는 올림이 명시돼 있으나 **직접 API는 미확인**.) 비용이 1.5배 갈립니다.
2. **PAYG 잔액 이월 / 자동충전** — 구독 포함 분량은 매월 리셋되지만 PAYG 잔액도 그런지 미확인.
   ★**72시간 예선 창 도중 잔액 소진 = 참가자 생성 중단**이라 자동충전 설정이 사실상 필수입니다.
   (Starter는 legacy usage-based billing이 안 되고 **PAYG Top Up 방식**입니다 — 전 셀프서브 티어 가능.)
3. **Music이 PAYG 크레딧으로 커버되는지** — PAYG가 TTS 위주로 쓰이는지 음악도 동일 적용인지.

**→ 위 3개는 ElevenLabs 서면 문의(3.A 질문)에 같이 넣으면 한 번에 끝납니다.**
**산출이 나왔으니 결제·계정 개설은 대표님 판단입니다. 저는 요청하지 않겠습니다.**

---

# 보고 순서 준수

- **①** 이 문서 §1 + `studio_music_migration_repair_2026-07-27.sql` → **승인 요청**
- **②** 이 문서 §2 → **산출 완료** (권고: Starter + PAYG, 시즌 $250)
- **③** 구현 → **①승인 전까지 착수하지 않음**
