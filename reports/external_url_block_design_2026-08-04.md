# 외부 URL 접수 차단 (a) — 설계안

**2026-08-04 · 지수 본체 · 코드 이전 단계. 본부 승인 전.**
TK님 확정 (a) = 시즌0 접수는 Studio 산출물만. 외부 URL 접수를 닫는다.

이 문서는 **설계만** 담는다. 앱 레포 배선분은 §4로 분리했다 — 지수2A 몫이며
이 세션은 커밋하지 않는다 (`feat/studio-budget-guard` 공유 중, 충돌 회피).

---

## 0. 실측 (2026-08-04, 읽기 전용 프로브)

`oxxovo-scoring/_probe_external_urls.ts`, `_probe_defect1_baseline.ts`.

| 무엇 | 실측값 |
|---|---|
| `genesis_applications` 총 행 | 53 (season_test 41 · season_test2 12) |
| **`season_0` 신청 행** | **0** |
| `free_entry_url` 호스트 | `pub-bf4080d3…r2.dev` = **53 / 53** |
| `main_round_video_url` 호스트 | R2 = 10, 나머지 NULL |
| **외부 URL(YouTube/Vimeo/IG/TikTok) 접수 행** | **0건** |
| `scoring_results` | 51행 전부 season_test |
| `season_0.allowed_video_platforms` | `["youtube","vimeo","instagram","tiktok"]` ← **열려 있다** |
| `season_0.studio_round` | `both` |

→ **④ 답: 이미 접수된 외부 URL 행은 0건.** 백필·정리 대상 없음.
차단은 순수하게 "앞으로 못 들어오게" 하는 작업이고, 되돌릴 데이터가 없다.

---

## 1. 외부 URL이 들어올 수 있는 문 — 전수

| # | 경로 | 쓰는 컬럼 | 현재 검증 | 판정 |
|---|---|---|---|---|
| 1 | `POST /api/apply` (예선, `/apply` 폼) | `free_entry_url` | **없음 — 임의 문자열 통과** | ★열린 문 |
| 2 | `submitMainRound` (`app/profile/actions.ts:497`) | `main_round_video_url` | `validateVideoUrl(url, season.allowed_video_platforms)` | 이미 화이트리스트 집행 중 |
| 3 | Studio `submitRender`/`submitGeneration` | `free_entry_url` = R2 URL | CryptoBind | 차단 대상 아님 |
| 4 | admin/시드/E2E 스크립트 | 둘 다 | service_role 직접 INSERT | 운영 경로 아님, 범위 밖 |

**핵심**: 예선 쪽만 집행 코드가 없다. 본선은 컬럼 값만 바꾸면 코드 0줄로 닫힌다.

---

## 2. ① 시즌 플래그 방식 — 권고: **기존 `allowed_video_platforms` 재사용**

### 권고안 A — `allowed_video_platforms = ARRAY['studio']`

```
season_0:  ["youtube","vimeo","instagram","tiktok"]  →  ["studio"]
```

- **새 컬럼 불필요. DDL 마이그레이션 불필요** — `UPDATE` 한 줄.
- 기존 CHECK `cardinality(allowed_video_platforms) >= 1` 를 **만족한다**
  (빈 배열은 이 제약에 걸린다 — 그래서 "비우기"는 애초에 불가.
  `main_round_submission_patch_2026-05.sql`).
- `validateVideoUrl(외부URL, ['studio'])` → `parseVideoUrl` 이 youtube/vimeo/
  tiktok/instagram 중 하나로 판정 → `allowedPlatforms.includes(...)` **false**
  → `not_allowed`. **`lib/video-url.ts` 는 손 안 댄다.** 'studio' 라는 값을
  아무도 매치하지 못한다는 점이 정확히 우리가 원하는 동작이다.
- Studio 제출은 `/api/apply` 를 안 거치므로 검증 대상이 아니다 (경로 자체가 다르다).
- **본선이 자동으로 같이 닫힌다** — #2 경로가 이미 이 컬럼을 본다.
- 하드코딩 0: 코드는 컬럼만 읽고, 값은 시즌 행에 있다. 시즌1에서 외부 URL을 다시
  열려면 배열을 되돌리면 끝 ([[feedback-no-hardcode]]).

### 기각한 안

- **B — 새 boolean `external_entry_enabled`**: 같은 사실을 말하는 컬럼이 둘이 된다.
  두 컬럼이 어긋나는 날이 반드시 온다. 마이그도 필요. 기각.
- **C — `studio_round` 로 유도**: `studio_round` 는 "Studio 를 쓸 수 있는 라운드"
  (가용성)이지 "Studio 만 쓸 수 있다"(배타성)가 아니다. `both` 인 파트너 시즌의
  외부 URL 접수가 조용히 막힌다. 기각.

### fail-closed 확인

- 시즌 조회 실패 → 기존 `season_not_found` 503 → 접수 차단. 유지.
- 컬럼이 NULL 이면? → `validateVideoUrl(url, null)` 이 되지 않도록
  `season.allowed_video_platforms ?? []` 로 받아 **빈 배열 = 전부 거부**.
  (CHECK 때문에 NULL 은 사실상 없지만, 게이트는 값의 존재를 전제하지 않는다.)

---

## 3. 차단이 채점에 미치는 영향 — Defect1 본체와의 연결

외부 URL 접수가 닫히면 **"화면을 보고 AI인지 실사인지 판정"할 이유가 사라진다.**
출처 증명은 접수 시점 CryptoBind 가 이미 한다. 그래서 Integrity 축의 일이 바뀐다:

- **폐기**: "얕은 심도 · 진짜 그림자 · 손의 물리적 상호작용 → AI 아님"
  (`oxxovo-scoring/src/scorer.ts:92`)
- **폐기**: 같은 근거를 요구하는 `CLAUDE_INTEGRITY_EXTENSION`
  (`scorer.ts:119~120` — "워터마크/그림자/물리 단서 등 구체적 근거")
  ★ 본문만 고치면 확장 프롬프트가 같은 기준을 되불러온다. **둘은 한 커밋.**
- **신설**: Integrity = 화면에 보이는 **규정 위반 증거**만 판정
  (제3자 워터마크·방송사 로고·타 플랫폼 UI 캡처·저작권 표시·타 대회 표식).
- **명시적 금지문 삽입**: 사실적 렌더링·정확한 그림자·자연스러운 손 상호작용은
  **품질 신호이지 위반 신호가 아니다. Integrity 를 낮추는 근거로 쓰지 마라.**
  (금지문을 안 넣으면 모델이 옛 기준으로 돌아온다.)
- **기본값 반전**: 위반 증거가 없으면 100. 감점은 구체적·가시적 증거가 있을 때만.

---

## 4. ★앱 레포 배선분 — 지수2A 인계 (이 세션은 커밋하지 않음)

`app/api/apply/route.ts` 한 파일. 세 지점.

### 4-1. import 추가 (파일 상단, `parseVideoUrl` 옆)

```ts
import { parseVideoUrl, validateVideoUrl } from '@/lib/video-url'
```

### 4-2. 에러 코드 추가 (`ApplyErrorCode` union)

```ts
  | 'video_platform_not_allowed'
```

클라이언트 문구는 `t.profile.apply_err_video_platform_not_allowed` 로
i18n 단일 진실원천 유지 (기존 패턴 그대로).

### 4-3. 게이트 삽입 — `duration_range` 검사 **직후**, 정원 조회 **전**

`season` 이 이미 해석된 뒤여야 하고, 정원/waitlist 계산 전에 튕겨야 한다.

```ts
    // (a) 외부 URL 접수 차단. 허용 소스는 seasons.allowed_video_platforms 가
    // 정한다 — 시즌0은 ['studio'] 라 외부 플랫폼 URL 이 전부 not_allowed 로
    // 떨어진다. 하드코딩 금지: 코드는 컬럼만 읽는다.
    // 이 경로(/api/apply)는 외부 URL 접수 전용이다. Studio 제출은
    // submitRender/submitGeneration 로 들어오므로 여기를 지나지 않는다.
    const urlCheck = validateVideoUrl(
      String(body.free_entry_url),
      season.allowed_video_platforms ?? [],
    )
    if (!urlCheck.valid) {
      return NextResponse.json(
        { error: 'video_platform_not_allowed', detail: urlCheck.error },
        { status: 403 },
      )
    }
```

### 4-4. 부수 영향 2건 (지수2A 판단 필요)

1. `app/profile/MainRoundCard.tsx:277` 이 `formatVideoPlatforms(...)` 로
   허용 플랫폼을 화면에 찍는다. `['studio']` 면 **"studio"** 라고 그대로 나온다.
   `PLATFORM_DISPLAY_NAMES` 에 `studio: 'OXXOVO Studio'` 추가 권장.
2. ★**`/apply` 폼의 외부 URL 입력 경로를 화면에서도 제거한다** (본부 판정,
   2026-08-04 — 지수2A 판단 사항 아님). 서버 403 만으로 두면 **다 써 넣고 나서
   거절당하는** UX 가 남는다. 서버 게이트(4-3)는 그대로 유지한다 — 화면에서
   지우는 것은 UX 이고, 막는 것은 서버다. 둘 다 있어야 한다.
   **문구와 배선 방식만 지수2A 판단**이다 (입력란 제거 / 폼 전체 대체 /
   Studio 로 유도하는 안내 등).
   ([[project-studio-prelaunch-apply-moderation]] 의 "/apply 배너 숨김" 과 같은 건)

### 4-5. 순서 (★[[feedback-migration-before-code-push]])

```
1) TK: UPDATE seasons SET allowed_video_platforms = ARRAY['studio'] (season_0)
2) 확인 쿼리로 값 확인
3) 지수2A: 4-1~4-3 배선 push
```

거꾸로 하면 그 사이 **아무 URL 이나 통과**한다 (현행과 동일하므로 장애는 아니지만,
차단이 켜졌다고 착각하는 창이 생긴다).

**되돌리기**: `UPDATE ... = ARRAY['youtube','vimeo','instagram','tiktok']`.
코드 롤백 없이 컬럼만으로 원복된다 — 이게 A안을 고른 이유이기도 하다.

---

## 5. ③ `flag_integrity_high_threshold`(=15) 의미 재검토

### 문제

15 는 **"AI 아님 의심"의 연속적 확신도** 문턱으로 튜닝됐다. §3 이후 Integrity 는
**"규정 위반"의 거의 이산적인 판정**이 된다. 숫자를 그대로 두면 프롬프트가 만드는
분포와 게이트가 서로 모르는 사이가 된다.

실측 근거 (season_test 51행): 현행 분포는 min 35 / p50 85 / max 92,
`< 15` **0건**, flag **0건**. 즉 지금 15 는 사실상 **아무것도 안 잡는 문턱**이다.

### 권고: 문턱을 고치지 말고, **문턱을 프롬프트에 주입**한다

`batch.ts` 는 이미 세 문턱을 `seasons` 에서 읽어 `thresholds` 로 들고 있다
(`batch.ts:115~131`, `477`). 이것을 `scoreWithAllAIs` 로 넘겨 Claude 프롬프트의
채점 기준(anchor)을 **그 값으로 렌더링**한다.

```
명백한 규정 위반 증거 있음        → 0 ~ (high-1)          [현재 0~14]  → flagged
위반 의심되나 불확실, 사람 검토   → high ~ (medium-1)     [현재 15~29] → medium
경미/모호한 정황                  → medium ~ (low-1)      [현재 30~49] → low
위반 증거 없음                    → 100                                → none
```

이렇게 하면:
- **하드코딩 0** — 프롬프트의 숫자도 `seasons` 에서 온다. TK 가 15 를 20 으로
  바꾸면 프롬프트 기준선이 같이 움직인다. 두 곳이 어긋날 수 없다.
- **15 를 안 바꿔도 된다** — 의미가 바뀌는 게 아니라, 프롬프트가 그 의미를
  이제 알게 된다. (문턱값 변경은 승인 사안이므로 이 설계에 넣지 않았다.)
- `deriveConfidence` (`supabase.ts:31~39`) 는 **한 줄도 안 바뀐다.**

### fail-closed 유지

- 문턱 조회 실패 → `fetchSeason` 이 throw → 배치 중단. 현행 유지.
- `parsed.scores.integrity` 가 없거나 0~100 밖이면 → **throw**
  → `judged_status='failed'` → 재시도 → 소진 시 어드민 검토.
  ★사용자를 flag 하지 않는다. 파싱 실패는 시스템 오류이고
  [[project-system-error-not-user-rejection]] 대로 탈락 사유가 아니다.
  (0 으로 떨어뜨려 flag 시키는 쪽이 "안전해 보이지만" 그건 사용자 처벌이다.)

### ★남는 질문 — 본부/제니3 판단 사항

Integrity 가 **품질 축이 아니라 위반 게이트**가 되면, 그것이 최종점수의 **10%를
차지하는 것 자체**가 설계상 어색하다. 위반 없는 작품은 전부 100 을 받으므로 10점이
모두에게 상수로 얹히고, **변별력이 0** 이 된다. 논리적 귀결은 "Integrity 를 배점에서
빼고 순수 게이트로 돌린 뒤 25/45/20 을 100 으로 재정규화" 인데, 이건 **배점 변경이라
승인 사안**이다. 이번 작업에서는 **배점을 건드리지 않는다** — 다만 아래 §6 의 실측이
이 질문에 답을 줄 것이다.

---

## 6. ④ season_test 51행 재채점 — 방법과 사전 산술

### 제약

- `scoring_results` 는 `UNIQUE(application_id, round)`. 워커를 그냥 돌리면
  **기존 51행을 덮어쓴다.** 본부 지시: 기존 51행은 건드리지 마라.
- `season_test.scoring_start_at` = 2026-09-07 (미래). §"버퍼 게이트" 를 적용하면
  워커 경로로는 애초에 못 돈다.

### 방법: **DB 를 쓰지 않는 오프라인 하니스**

`_rescore_integrity.ts` (신규, 읽기 전용 + JSON 출력):

1. `scoring_results` 에서 51행의 `consensus_intent/execution/originality` 를 읽는다.
   **이 세 축은 프롬프트 변경의 영향을 받지 않는다** (Integrity 문단만 고치므로).
2. `genesis_applications` 에서 URL·statement 를 읽어 프레임을 추출한다.
3. **Claude 만** 호출한다 — Integrity 는 `integrityPolicy: 'claude-only'` 라
   GPT/Gemini 를 다시 부를 이유가 없다.
4. `new_verified = 0.25·I + 0.45·E + 0.20·O + 0.10·new_integrity` 로 재계산.
5. 결과를 `reports/` 에 표로 커밋. **DB 쓰기 0.**

비용: 51행 Triple-AI 실지출이 **$14.2184** (행당 $0.2788) 였다. Claude 단독이므로
그 일부. 크레딧 충전 후 실행 (★TK 대기 항목).

### 사전 산술 — 재채점 전에 이미 아는 것

"모든 작품의 Integrity 가 100 으로 간다"는 상한 가정으로 본선 10편을 재정렬하면:

| 현행 | verified | integ | → integ=100 가정 | 새 순위 |
|---|---|---|---|---|
| #1 Kling | 81.12 | 85 | **82.62** | **#1 (유지)** |
| #2 | 78.20 | 85 | 79.70 | #2 |
| **#7 Seedance** | **72.48** | **35** | **78.98** | **#3** |
| #5 | 75.08 | 65 | 78.58 | #4 |
| #4 | 75.38 | 75 | 77.88 | #5 |
| #3 | 76.25 | 85 | 77.75 | #6 |

★**정직하게: 역전은 "해소"가 아니라 "완화"된다.** Seedance 는 **7위 → 3위**로
올라오지만 Kling 을 넘지 못한다. Integrity 가 10% 축이라 최대 이동폭이 6.5점이고,
Kling 은 나머지 90%(Intent/Exec/Orig)에서 실제로 앞선다.

즉 Defect1 수정은 **"부당한 감점을 없앤다"까지가 정확한 효과**이며,
"Seedance 가 1등이 됐어야 한다"는 결론까지는 이 데이터가 지지하지 않는다.
§5 의 배점 질문이 여기서 다시 나온다 — 실채점으로 확인할 것.

---

## 7. 작업 순서

```
0) 본부 승인 (이 문서)
1) [채점 레포·지수 본체] scorer.ts:92 + CLAUDE_INTEGRITY_EXTENSION 동시 수정
   + 문턱 주입 (batch.ts → scoreWithAllAIs) + integrity 범위 검증
2) [TK] UPDATE seasons.allowed_video_platforms = ARRAY['studio'] (season_0)
3) [지수2A] app/api/apply/route.ts 배선 (§4)
4) [채점 레포] _rescore_integrity.ts 로 51행 재채점 → reports/ 커밋
5) 결과 보고 → 배점 질문(§5·§6) 본부 판단
```

★**무비용 수정 창은 아직 유효하다** — `season_0` 의 `scoring_results` 는 0행이고
신청 행도 0행이다. 예선 채점이 한 번이라도 돌면 같은 시즌 안에 서로 다른 기준이 섞인다.

관련: [[project-jisoo-queue-2026-07-28]] · [[feedback-no-hardcode]] ·
[[project-system-error-not-user-rejection]] · [[feedback-migration-before-code-push]]
