# Stage 1 — 카메라/모션 디렉팅 구현 계획 (2026-07-16, 지수2)

목표: 참가자가 카메라·모션을 원클릭 디렉팅하는 "허접 탈출" Studio. League 성립 최소선.
TK 프리셋 검토·전부 채택 확정(7/16). 이 문서 승인 후 구현 착수.

**용어 정정 1건**: 채택된 것은 **프리셋 8종**(A1~A3 액션 / D1~D2 드라마 / B1~B3 뷰티).
19편은 그 8종을 검증한 매트릭스 클립(match 16 + baseline 3)이며, 아래 UI에서
**프리셋 프리뷰 영상 소재로 재사용**한다(R2 `stage1-backup/`에 이미 백업).

## 현행 경로 실측 (계획의 근거)

- `createGeneration`(lib/studio.ts:250) → `generation_jobs` insert. 검증: 모델
  active / prompt_max / duration 모델·시즌 바운드 / 라운드 캡 30 / 크레딧.
- 워커(worker.ts:331) fal 입력 = `{...metadata.input_params, prompt, duration}` —
  병합 지점 명확, `extraInput` spread 이미 존재.
- **CryptoBind 서명 = jobId/pid/tid/model/duration/generatedAt만.** prompt·신규
  파라미터는 서명 밖 → **크립토 무영향, 양 레포 lockstep 불필요** (로드맵 예측 일치).
- 프리셋 적용의 실체(stage1 실측) = **프롬프트 조립**: 대괄호 태그 prepend(bracket
  모델만) + 카메라/모션 서술 append. fal 파라미터 아님 → 추가 생성비용 $0.

## 1. DB 토대 — 마이그 1개 (TK Run, 코드 푸시 전 선행)

`reports/studio_stage1_user_params_2026-07.sql` (작성은 승인 후, ASCII-only·순수 SQL)

1. `generation_jobs.user_params jsonb NULL` — 참가자가 고른 원재료 기록:
   `{"preset_id":"A1","advanced":{"negative_prompt":"...","cfg_scale":0.6}}`
   (감사/UI 재표시/향후 Stage 2 재사용 토대. NULL = 프리셋 미사용 = 기존과 동일)
2. **`studio_presets` 테이블** (하드코딩 금지 원칙 — 시즌 중 데이터로 튜닝 가능):
   `id text PK / group_id text(action|drama|beauty) / label_ko / label_en /
   bracket_tags text / desc_text text / preview_url text / sort int / active bool`
   - 시드 = 채택된 8종 (`_stage1_matrix.mjs`의 br/desc 그대로 + R2 프리뷰 URL)
3. `model_catalog.metadata` 데이터 갱신 (UPDATE, DDL 없음):
   - `prompt_style:"bracket"` → hailuo-02-pro, video-01-director만 (7/10 실측:
     대괄호 카메라 제어 이 2종. 나머지 5종 = NL 서술만)
   - `param_whitelist` → **실측된 모델만** 기입. 초기 = Kling `negative_prompt`
     (fal 스키마 공식). `cfg_scale`은 미실측 → probe 1회($0.50, Kling 3s) 후 기입.
     미실측 파라미터는 whitelist에 안 넣고 UI에도 안 뜸 (silent 422 방지).

RLS: `studio_presets`는 공개 읽기(anon SELECT) — 운영 파라미터 아닌 상품 데이터.
쓰기는 service_role만.

## 2. createGeneration 검증 확장 (서버 권위)

입력 확장: `{ modelId, prompt, durationSeconds, presetId?, advanced? }`

| 검증 | 규칙 | 거부 사유 |
|---|---|---|
| presetId | studio_presets에 존재 + active | `unknown_preset` |
| advanced 키 | 모델 metadata.param_whitelist에 있는 키만 | `invalid_param` |
| negative_prompt | trim, 길이 ≤ 500 | `prompt_too_long` |
| cfg_scale | number, whitelist에 기재된 [min,max] 범위 | `invalid_param` |
| **조립 후 프롬프트** | (태그+원문+서술) 최종 길이로 prompt_max 검사 | `prompt_too_long` |

- **프롬프트 조립은 서버에서**: bracket 모델이면 `"{tags} {user}. {desc}"`,
  NL 모델이면 `"{user}. {desc}"` (stage1 buildPrompt와 동일 규칙). 조립 결과를
  기존 `prompt` 컬럼에 저장 → **워커의 prompt 경로 변경 0**.
- `user_params`에는 원재료(preset_id/advanced)만 저장. 크레딧·캡·모더레이션
  경로 변경 없음. (참고: feat/studio-moderation-gate 머지 시 negative_prompt도
  동일 스캔 대상에 포함시킬 것 — 그 브랜치 머지 시점에 1줄.)

## 3. 워커 변경 (oxxovo-studio, ~15줄)

- job select에 `user_params` 추가 → `advanced`를 metadata.param_whitelist로
  **재필터**(서버가 검증했어도 워커가 최종 방어) → fal 입력에
  `{...input_params, ...filteredAdvanced, prompt, duration}` 순서로 병합
  (prompt/duration이 항상 승리 — 현행 원칙 유지).
- 프리셋 자체는 이미 prompt에 조립돼 있어 워커는 몰라도 됨.

## 4. CameraDirector UI (/studio 생성 카드 내)

**구조: 장르 세그먼트(3) → 프리셋 칩(2~3개/장르) → 프리뷰 → 접힌 고급**

```
[ 액션 ] [ 드라마 ] [ 뷰티/제품 ]        <- 세그먼트 (기본: 선택 없음 = 자유 프롬프트)
  (액션)  [A1 FPV 체이스] [A2 휩팬 리빌] [A3 아크 오빗]   <- 칩, 단일선택 토글
  (드라마) [D1 슬로우 푸시인] [D2 핸드헬드 긴장]
  (뷰티)  [B1 엘레강트 오빗] [B2 마크로 푸시인] [B3 틸트업 리빌]
  ┌ 프리뷰: 선택 칩의 stage1 match 클립 (muted loop, 탭하면 소리) ┐
  │ + "이렇게 조립됩니다" — 최종 프롬프트 미리보기 (태그는 bracket 모델만) │
  └ [고급 ▸] negative_prompt textarea + cfg_scale 슬라이더 (whitelist 모델만) ┘
```

- **칩 채택 이유**: 8종=한 화면에 다 보임, 원클릭(초보), 프리뷰로 "고르면 뭐가
  나오는지" 즉시 확인. 드롭다운=프리뷰 못 붙음, 썸네일 그리드=8종엔 과함.
- 프리뷰 = 19편 중 **match 8편**(프리셋당 정확히 1편) 재사용 (R2 stage1-backup,
  추가 생성 $0). mismatch 8편은 검증 전용(프리뷰 부적합 -- 엇갈린 장르),
  baseline 3편은 "프리셋 없음 vs 있음" 비교 소재로 툴팁/가이드에.
- 모델 연동: bracket 모델 선택 시 태그 pill 표시, NL 모델은 서술만 들어간다고
  프리뷰에 정직하게 표시. 무음 모델 배지(기존)와 같은 열에 공존.
- 프리셋은 **강제 아님** — 미선택 = 현행 자유 프롬프트 그대로 (기존 사용자 경로 무변).
- i18n ko/en (page.tsx 기존 t 사전 패턴), 브랜드 톤 보라 #8B22FF 액티브/다크
  유지. **Watch 규격·ComposeEditor 불변**.

## 5. 구현 순서·소요 (총 ~5일, 로드맵 1주 정합)

| # | 작업 | 소요 | 게이트 |
|---|---|---|---|
| 1 | 마이그 SQL 작성 + cfg_scale probe($0.50) | 0.5일 | **TK Run → 검증 → 코드 푸시** |
| 2 | 워커 user_params 병합 + E2E | 0.5~1일 | tsc 0, 기존 E2E 회귀 |
| 3 | createGeneration 확장 + E2E(조립·거부 케이스) | 1일 | |
| 4 | CameraDirector UI + 프리뷰 배선 | 2일 | build 0 |
| 5 | 통합 E2E + TK 데모(프리셋 vs 수작업 비교, SFX 방식) | 0.5일 | **TK 육안 게이트** |

브랜치 = feat/studio-budget-guard 유지(main 미머지). 배포는 session6=true 전 금지.
30~40s/캡 30/compose 2단계와 충돌 없음 — 프리셋은 프롬프트만 만지고 길이·캡 경로 무변.

## 6. Stage 1 경계 (이번에 안 하는 것)

- multi_prompt 샷리스트/스토리보드 UI → **Stage 2** (user_params 토대는 이번에 깔림)
- 레퍼런스 영상 모션 전이(Motion Control) → 후순위 (크립토 체인 확장 필요)
- t2i/i2v/캐릭터 일관 → **Stage 3**
- 미실측 fal 파라미터의 whitelist 등재 → 실측될 때마다 데이터로 추가 (코드 무변)

## 7. TK 결정 3건

1. **프리뷰로 stage1 match 클립 8편 참가자 노출 OK?** (참가자가 "기준작"으로
   오해할 여지 vs 프리셋 이해도. 대안: 클립 대신 포스터+한줄 설명)
   -> 실물 검토용 로컬 갤러리: `oxxovo-studio-samples/stage1_preview_gallery.html`
2. **고급 패널(negative/cfg) 시즌0 노출 여부** — 숨기면 단순, 열면 고수 여지.
   제안: 접힌 채 노출(기본 안 보임, 원하는 사람만)
3. 프리셋 한글 라벨 카피 확정 (위 표는 초안)
