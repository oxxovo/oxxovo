# Stage 3 (AI 배우 i2v) — 2단계 실행 계획 (계획만, 코드 착수 X) -- 2026-07-17, 지수2

TK 육안 통과(2026-07-17): "같은 배우로 보인다, 완성본도 같은 얼굴". 경로 확정 = **Ideogram 캐릭터 시트(t2i) + Kling V3 Pro i2v(elements)**. 이 문서 = 마이그/서버/크립토/UI/규모. 단계마다 TK 승인 → 착수.

기준: 정밀 코드맵(2026-07-17 조사). **★핵심 사실: 현재 파이프라인에 이미지/`media_type`/i2v 개념이 전혀 없음 = v1i는 그린필드.** 모든 것이 t2v. 크립토는 양 레포 byte-for-byte 미러(`lib/cryptobind.ts` 시크릿 내부 / `src/cryptobind.ts` 시크릿 인자).

---

## 0. 설계 원칙
- **generation_jobs 재사용 + `media_type` 판별자** (별도 image_jobs 테이블 대비 코드 최소). createGeneration/캡/드래프트/환불/워커-claim/크레딧을 그대로 상속. 워커만 media_type 분기.
- i2v 산출 클립 = **일반 ready 비디오 잡** → 기존 compose 레이어에 그대로 얹힘. **ComposeEditor·Watch·채점 무변**(클립이 늘 뿐).
- **외부 이미지 업로드 경로 없음** = Genesis Rule 구조적 보장. i2v 레퍼런스는 **본인 image 잡의 R2 URL만** 서버가 조립(참가자는 job id만 선택).
- no-hardcode: 이미지 캡·모델은 seasons/model_catalog(metadata jsonb)로.

---

## 1. 마이그레이션 초안 (studio_stage3_i2v) — TK Run (붙여넣게 SQL은 승인 후, whitespace 검증 포함)

### 1a. generation_jobs (ALTER) — 이미지 잡 + i2v 부모 바인딩
- `media_type text NOT NULL DEFAULT 'video'` CHECK IN ('video','image')
- `image_url text` (이미지 잡 산출 URL; 비디오 잡은 NULL. video_url 재사용 안 함 = 소비자 오염 방지)
- `parent_image_job_ids uuid[] NOT NULL DEFAULT '{}'` (i2v 잡이 바인딩한 부모 이미지 잡들)
- `cryptobind_parent_bundle text` (nullable; i2v 잡만. render의 source_bundle 대응)
- 재사용(추가 컬럼 0): `cryptobind_content_hash`/`_signature`(이미지 바이트해시 v1ic), `user_params jsonb`(elements 매핑=어느 부모가 start/frontal/reference), `tier`(draft 포함), `model_id`, `prompt`, 크레딧/캡/상태 6-state.
- duration_seconds: 이미지 잡은 NULL 허용(현재 int, NULL 가능한지 확인 후 nullable화 or 0 회피 = [[feedback_postgres_array_length_check_trap]] 유형 주의).

### 1b. studio_characters (신규 테이블) — 캐릭터 라이브러리(=AI 배우 명부)
```
id uuid pk, user_id uuid, season_id text FK seasons,
name text, status text (draft/ready),
frontal_image_job_id uuid FK generation_jobs,     -- elements.frontal_image_url 소스
reference_image_job_ids uuid[] DEFAULT '{}',       -- elements.reference_image_urls 소스
created_at/updated_at, deleted_at timestamptz
RLS on, anon/authenticated REVOKE, service_role GRANT (기존 패턴)
```
- 캐릭터 = 이미지 잡들의 **명명 그룹(UX/조직 레이어)**. 암호학적 바인딩은 잡 단위(v1i)+i2v의 parentBundle이 담당. 캐릭터 테이블 자체는 서명 불필요.

### 1c. model_catalog (신규 행, data-only) — [[feedback_no_hardcode]]
- `ideogram-character` (metadata.media_type='image', tier=competition, fal_model_id='fal-ai/ideogram/character', input_params: rendering_speed 등)
- 드래프트 이미지 형제: 예 `ideogram-character-draft`(BALANCED, 저가) metadata.promotes_to='ideogram-character' + tier='draft'
- `kling-v3-pro-i2v` (media_type='video', fal_model_id='fal-ai/kling-video/v3/pro/image-to-video', metadata: accepts_elements/accepts_multi_prompt/accepts_start_image 플래그)
- 드래프트 i2v 형제(선택): kling turbo i2v 있으면 promotes_to. 
- ★metadata.media_type = 신규 판별자(코드 아닌 데이터). getActiveModels + 워커가 이걸로 이미지/비디오 분기.

### 1d. seasons (ALTER) — 이미지 캡(시즌별 가변)
- `studio_max_image_generations_per_round int DEFAULT 20` (캐릭터 시트 생성 상한)
- `studio_max_draft_image_generations_per_round int DEFAULT 40` (드래프트 시트 시행착오)
- (i2v 비디오 잡은 기존 studio_max_generations_per_round 캡에 흡수)

**중간 마이그 최소화**: 위 1a~1d를 **1개 마이그로 묶어 선행 Run**([[feedback_migration_before_code_push]]). UI 단계서 컬럼 추가 발생 시에만 2차 배치.

---

## 2. CryptoBind v1i 확장 (양 레포 byte-mirror + 변조거부 테스트)

기존: v1(생성 `v1|pid|tid|jobId|generatedAt|model|duration`), v1c(콘텐츠 `v1c|jobId|tid|contentHash`), v1sr/v1sc(compose). 시크릿=`STUDIO_CRYPTOBIND_SECRET`.

신규 3버전(HMAC-SHA256, `|` 조인, 버전태그 선두 — 기존과 동일 철학):
- **v1i (이미지 생성서명)**: `v1i|pid|tid|jobId|generatedAt|modelId` (duration 없음 = 이미지). 이미지 잡 생성 시.
- **v1ic (이미지 콘텐츠해시, 워커)**: `v1ic|jobId|tid|imageHash`, imageHash=sha256(이미지 bytes). 기존 cryptobind_content_hash/_signature 컬럼 재사용(nullable).
- **v1v (i2v 생성서명 = v1 + 부모바인딩)**: `v1v|pid|tid|jobId|generatedAt|modelId|duration|parentBundle`. parentBundle=sha256(부모 이미지잡들의 v1i 서명 정렬·`|`join) = render sourceBundle 패턴 재사용. i2v 잡 생성 시.

**제출 검증 체인 확장** (submitRender의 소스 루프 `lib/studio.ts:1094-1106`에 중첩):
```
최종 render → verifyComposeBind(v1sr+v1sc)
  → 각 소스 클립(generation_job):
     - 기존: verifyCryptoBind (v1/v1c) + 본인 + 시즌 + ready
     - ★i2v 클립이면(media_type=video AND parent_image_job_ids 있음):
        · 각 부모 이미지잡 로드 → verifyCryptoBind(v1i/v1ic) + 본인 + 동일시즌 + ready
        · parentBundle 재계산 == 저장값
        · 클립의 v1v 서명 일치
```
→ 통과 = 완성본이 *본인계정·동일시즌 image 잡에서 파생된 i2v 클립들의, 이 EDL대로의* 조합임 증명. 외부이미지·도용·사후변조 원천 차단.

**★양 레포 lockstep**: v1i/v1ic/v1v 상수·캐노니컬 문자열을 `lib/cryptobind.ts`(시크릿 내부)와 `src/cryptobind.ts`(시크릿 인자) **완전 동일**하게. 변조거부 테스트 = ①부모 이미지 스왑 ②parentBundle 위조 ③외부URL 주입 ④타시즌 이미지 → 전부 reject 단언.

---

## 3. 서버 (lib/studio.ts + app/studio/actions.ts)

- **t2i `createImageGeneration`**: createGeneration 미러 — media_type='image', 이미지모델, v1i, duration 없음, 드래프트-이미지 캡/티어, 크레딧, **이미지 모더레이션(기존 lib/moderation.ts 재사용, 얼굴 이미지 스캔)**.
- **캐릭터 라이브러리 `createCharacter`/`listCharacters`/`deleteCharacter`**: 본인 ready image 잡들을 명명 그룹(frontal + references)으로. 소유·시즌 검증.
- **i2v `createI2vGeneration`**: 캐릭터(부모) + multi_prompt[] + duration 받음 → 부모가 본인 ready image 잡·동일시즌 검증 → **fal 입력 서버조립**(start_image_url + elements[{frontal_image_url, reference_image_urls}] + multi_prompt = 전부 부모 R2 URL) → parentBundle 계산 → v1v 서명 → 비디오 잡 enqueue(model=kling-v3-pro-i2v, parent_image_job_ids, user_params=ref 매핑).
- 검증규칙: 부모 개수 상한, multi_prompt 샷수·총길이(모델 native ≤15s/≤6샷), 외부 URL 거부(job id만 수용).

---

## 4. 워커 (oxxovo-studio/src) — 이미지 분기 + multi_prompt 분기

- **이미지 분기**: media_type='image' → fal 이미지 엔드포인트 호출 + **extractImageUrl 신규**(현 extractVideoUrl은 비디오 전용, `src/fal.ts:122-126`) + duration 없음 + v1ic 콘텐츠서명 + R2 이미지 경로(`images/` 버킷 프리픽스). claimNextJob CAS/크레딧/드래프트-워터마크는 그대로(이미지 드래프트도 워터마크? = 이미지는 저해상도+서버차단으로 충분, 워터마크 선택).
- **★multi_prompt 분기 (실측 반영)**: `src/fal.ts:138-141`이 현재 `{...extraInput, prompt}` + duration append → prompt/duration 항상 실림. **multi_prompt 존재 시 top-level prompt·duration 생략**(상호배타 실측). i2v elements/start_image_url는 extraInput로 자연 전달(이미 spread).
- extraInput spread 순서 유지(catalog input_params → advanced → prompt 최후승). 이미지·i2v 경로 모두 이 규칙 존중.

---

## 5. UI (app/studio, 보라 톤, ComposeEditor·Watch 불변)

신규 흐름 3단(기존 /studio 생성 UI 확장):
1. **캐릭터 시트 생성**: 배우 프롬프트 → Ideogram Character로 시트 이미지들. **드래프트 티어로 싸게 시행착오**(연습장). 승격 시 경기 티어.
2. **캐릭터 라이브러리**: 만든 시트를 캐릭터로 저장/명명, frontal·reference 지정. 재사용 목록.
3. **i2v 샷 생성**: 캐릭터 선택 + 멀티샷 프롬프트(≤6샷) → Kling i2v 클립. 산출=ready 비디오 클립 → compose에서 그대로 선택.
- 게이트=로그인만(기존), session6 스위치 하 동작. 시크릿 화면출력 금지.

---

## 6. 규모·순서·중간마이그·추가 probe

| 단계 | 내용 | 일수 | 선행 |
|---|---|---|---|
| 2.1 마이그 | 1a~1d 1개 SQL + TK Run + 검증 | ~0.5d | — |
| 2.2 크립토 | v1i/v1ic/v1v 양레포 미러 + 변조거부 테스트 | ~2d | 2.1 |
| 2.3 워커 | 이미지 분기(extractImageUrl+v1ic) + multi_prompt 분기 + 부모URL 조립 | ~2d | 2.2 |
| 2.4 서버 | createImageGeneration + 캐릭터 라이브러리 + createI2vGeneration + 제출검증 체인 | ~2.5d | 2.2 |
| 2.5 UI | 시트생성 + 라이브러리 + i2v샷 (드래프트 티어) | ~3d | 2.4 |
| 2.6 E2E | 크로스레포 DB→워커→R2→v1i체인→제출 변조테스트 | ~1.5d | 2.3+2.5 |

**합계 ~11.5~13일** (로드맵 "i2v 제대로 ~4주"와 정합, 버퍼 포함).
- **순서**: 2.1 → 2.2(크립토 먼저, 서버·워커가 의존) → 2.3·2.4 부분 병렬 → 2.5 → 2.6.
- **중간 마이그**: 원칙 2.1 1회. UI서 컬럼 추가 발생 시만 2차(선행 Run 규칙 유지).
- **추가 probe(승인 필요분)**:
  - (경미) Ideogram `reference_image_urls` 1장 한계로 아이덴티티 드리프트 시 → flux-pulid/멀티레퍼런스 대안 소probe(~$2), 2.5 중 필요시만.
  - (선택) Kling i2v 드래프트 형제(turbo i2v) 실재·품질 1샷 확인(~$1), 드래프트 이미지 티어 확정 시.
- **비코드 크리티컬**: Kling i2v ~$2.5/15s → 드래프트 티어로 시행착오 흡수 + fal 동시성/예치 게이트([[project_studio_season0_full_load]]) 여전.

---

## 7. 병렬 — 프로 편집기 A단계 (착수 완료)
- `/compose-pro-demo` 3-pane 셸 커밋(6be4708): 미디어풀 | 미리보기 | 단일트랙 타임라인 + 모바일 세로 폴백, 50~100 클립 밀도. **순수 프론트, 크립토·워커·Watch·기존파일 무변**. Vercel preview로 TK 육안 가능. 다음 B단계(가로 타임라인 실배선)는 Stage 3 대기구간에.

---

## 8. 제약·게이트
- 브랜치 feat/studio-budget-guard. **session6=true 전 main 배포 금지.**
- 순서: **이 계획 승인 → 마이그 Run(붙여넣기 SQL+whitespace검증) → 검증 → 크립토 → 워커/서버 → UI**. 유료 probe·큰 UI 결정은 단계마다 승인.
- 발사 블로커 아님(시즌0는 현 스택으로 됨) — 품질·미래 트랙.
