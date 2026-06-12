# OXXOVO Studio -- 인-플랫폼 짜깁기(Compose) 아키텍처 설계 (계약)

작성: 2026-06-11 (지수2). TK 확정 비전 기준. 이 문서가 스키마/CryptoBind/워커/UI 모든 코드의 계약.
특허 해석은 디앤특허 영역 -- 본 문서는 무결성 메커니즘만 기술. 목표: 7월 초중순.

## 0. 확정 비전 (TK 2026-06-11)
- 영상 = **30초 완성작**, 여러 AI 클립을 플랫폼 내에서 조합. 단일 20초 고정 폐기.
- 짜깁기로 모델 길이 한계 우회 -> 전 모델(Kling 15s/Sora 20s/기타) 평등 사용.
- 편집 = **sequence + trim + cut만**. VFX/색보정/모션그래픽/외부에셋/업스케일/오디오믹싱 전부 금지.
- 오디오 = **C안**: 각 클립의 AI 생성 자체 오디오만, 순차 유지. 추가/외부/믹싱 없음.
- **본인 계정 클립만** 조합(도용 차단).
- CryptoBind 완성본 확장: 최종 해시 + 소스 클립 서명 묶음 + **EDL 서명**.

## 1. 데이터 모델

### render_jobs (신규 테이블) -- "완성본 1개" = 1행
- id uuid pk, user_id, season_id (FK seasons)
- status: queued -> rendering -> uploading -> ready -> submitted | failed (generation_jobs 6-state 미러)
- **edl jsonb**: 순서배열. 각 세그먼트 `{ jobId, startMs, endMs }`. trim=부분구간, cut=같은 jobId를 여러 세그먼트로 분할, sequence=배열순서. total = sum(endMs-startMs).
- source_job_ids text[]: EDL의 고유 jobId 집합(denormalized, 무결성 검증용)
- total_duration_seconds numeric
- video_url text, r2_key text (완성본)
- CryptoBind 컬럼(아래 2절): cryptobind_pid/tid/generated_at/algo, cryptobind_edl_hash, cryptobind_source_bundle, cryptobind_render_signature(요청단계), cryptobind_final_hash, cryptobind_final_signature(콘텐츠단계)
- attempts, error_message, worker_started_at/finished_at, submitted_at, created_at, updated_at
- RLS on, anon/authenticated REVOKE, service_role GRANT (generation_jobs와 동일 패턴)

### generation_jobs (변경 없음)
소스 클립은 그대로. 단 **조합 제출 시 소스는 'ready' 유지**(여러 완성본에 재사용 가능). 완성본만 submitted 락.

### genesis_applications (컬럼 추가)
- studio_application_render_id uuid FK render_jobs(id) ON DELETE SET NULL
- studio_main_render_id uuid FK render_jobs(id) ON DELETE SET NULL
- (서명은 기존 studio_application_signature/studio_main_signature 재사용 = render_signature 저장)
- 제출 영상 URL은 기존 free_entry_url / main_round_video_url에 완성본 video_url 기록(채점 ingest 무변경).

### seasons (compose 파라미터 컬럼 추가 -- 시즌별 가변, no-hardcode)
- studio_compose_enabled bool default false
- studio_compose_max_seconds int default 30  (완성본 상한)
- studio_compose_max_clips int default 10     (세그먼트 수 상한)
- per-clip 길이는 model_catalog의 native min/max가 지배. **season per-clip 바운드(application_video_*/main_round_video_*)는 permissive [1,30]** -- 옛 제약 `main_round_video_seconds_range_chk`(min>0 AND max>=min)가 0/unset를 거부하므로 0 대신 [1,30]. 모델 네이티브가 실질 per-clip 한계, 완성본은 compose_max_seconds가 지배.
- season_0: compose_enabled=true, max_seconds=30, max_clips=10, per-clip [1,30].

### platform_config (재사용)
margin/credit_usd_value/daily_generation_cap 그대로. 렌더는 fal 비용 없음(워커 CPU). 렌더 과금=무료(시즌0).

## 2. CryptoBind 완성본 확장 (v1s) -- 기존 v1/v1c와 동일 철학, 버전 분리

기존: 생성서명 `v1|pid|tid|jobId|generatedAt|model|duration`, 콘텐츠 `v1c|jobId|tid|contentHash` (클립 단위).
신규 2스테이지(렌더 단위), 모두 HMAC-SHA256(STUDIO_CRYPTOBIND_SECRET, 양 레포 byte-match):

- **EDL 캐노니컬**: `edl1|` + 세그먼트들 `jobId:startMs:endMs` 를 `|`로 join. edlHash = sha256(그 문자열).
- **소스 묶음**: 소스 jobId 고유·정렬 -> 각 소스의 기존 cryptobind_signature를 정렬·`|`join -> sourceBundle = sha256(...). (정확히 그 바인딩된 소스들임을 고정.)
- **요청단계(조합 요청 시, 메인앱)**: 캐노니컬 `v1sr|pid|tid|renderId|edlHash|sourceBundle` -> cryptobind_render_signature. (소스·EDL은 요청 시 이미 확정 -> 생성서명 대응.)
- **콘텐츠단계(워커 렌더 완료 시)**: finalContentHash=sha256(완성본 bytes). 캐노니컬 `v1sc|renderId|tid|finalContentHash` -> cryptobind_final_signature. (v1c 대응.)

**제출 검증(메인앱)**:
1. 각 소스 jobId: generation_jobs 로드 -> verifyCryptoBind(소스, tid) ok AND user_id==pid(본인계정) AND status in (ready/submitted).
2. edlHash·sourceBundle 재계산 -> cryptobind_render_signature 일치.
3. cryptobind_final_signature 일치(저장된 final_hash 기준).
4. total_duration <= season.studio_compose_max_seconds, 세그먼트 수 <= max_clips.
-> 통과 = 완성본이 *정확히 그 본인계정·동일토너먼트 바인딩 소스들의, 이 EDL대로의* 조합임이 증명. 외부편집/도용/사후변조 차단.

## 3. 워커 렌더 파이프라인 (ffmpeg) -- sequence+trim+cut, 오디오 C안

신규 잡타입(render_jobs 폴링, generation 잡과 분리 또는 통합 루프):
1. EDL 세그먼트별: 소스 R2 다운 -> `ffmpeg -ss startMs -to endMs` 트림(각 클립 자체 비디오+오디오).
2. concat: 세그먼트들을 순서대로 이어붙임. 모델 혼합으로 코덱/해상도/fps 상이 -> **공통 캔버스로 정규화 후 concat**(아래 4절 규칙경계). 오디오=각 세그먼트 자체 오디오를 순차 배치(믹싱·오버랩 없음=C안).
3. 완성본 해시 -> v1sc 서명 -> R2 업로드 -> ready.
- Railway 워커에 ffmpeg 추가(nixpacks). dev 가드: STUDIO_DEV_MODE 시 최소세그먼트.
- 실패 처리: failed + (조합 자체엔 크레딧 과금 없음 -> 환불 불필요, 소스 크레딧은 생성 시 이미 처리됨).

## 4. 규칙 경계 -- 확정됨 (TK 2026-06-11)
- **(R1) 캔버스 = 최소 해상도 + 패드 [확정 + 보완 2026-06-11]**: 완성본 해상도 = 조합된 세그먼트 중 **최소값**. 큰 클립은 다운스케일(허용), **업스케일 0**. 종횡비 차이는 패드(레터박스). fps도 공통 최소값. **다운스케일은 편집이 아니라 concat 호환용 정규화 -> Genesis Rule 위반 아님(TK 확정).**
  - **보완 a (모델 카탈로그 큐레이션)**: 카탈로그를 **720p 이상(가능하면 1080p) 모델로만** 구성 -> 최저 해상도 바닥이 720p가 되어 수렴 문제 무해화. (모델 티어 확정 시 720p 미만 모델 제외.)
  - **보완 b (편집기 UI 안내)**: 참가자에게 "해상도가 다른 클립을 섞으면 완성본이 가장 낮은 해상도로 수렴됩니다 -- 일관된 고화질 클립 사용 권장" 고지 표시.
- **(R2) 오디오 = C안 순차, 하드컷 [확정]**: 각 세그먼트 자체 오디오만 순서대로. 컷 경계 단절 허용. 무음 클립 구간은 무음. **페이드/크로스페이드도 믹싱으로 보고 금지.** ffmpeg는 비디오 concat과 동일 순서로 오디오 concat(믹싱·오버랩 없음).

## 5. 채점 영향 (소규모)
완성본도 mp4 1개 -> 채점 ingest 동일(`batch.ts:166` 4컬럼, URL 1개). 제출이 완성본 URL을 같은 컬럼에 기록 -> **채점 무변경 가능**. 옵션: Execution 프롬프트에 "의도적 컷·시퀀스 허용" 1줄(컷을 아티팩트로 오인 방지) + clip 메타 전달로 Integrity 정확도. 비차단.

## 6. Genesis Rule (코드/UI/rules 페이지 반영)
> Final submissions may be composed of multiple AI-generated clips, up to 30 seconds total. All clips generated within OXXOVO, tied to the account. Assembly within OXXOVO editor only. Only sequencing/trimming/cutting. No external editing, VFX, color grading, motion graphics, external assets, AI upscaling, or audio mixing. Each clip retains its own AI-generated audio only.

## 7. 빌드 순서 (견적 A~F 매핑)
1. [토대] 마이그레이션(render_jobs+genesis cols+seasons compose+config) + **CryptoBind v1s 양 레포** <- 이번 턴
2. [B] 워커 ffmpeg 렌더 파이프라인 + Railway ffmpeg
3. [E] createRender/listRenders 서버로직 + 검증규칙(길이/클립수/본인계정)
4. [A] 편집기 UI(시퀀스+트림+컷+미리보기+렌더폴링)
5. [제출] submitRender(완성본 제출, 소스 ready 유지, render CryptoBind 검증) + genesis 기록
6. [D] 채점 프롬프트 미세조정(옵션) + clip 메타
7. [F] 교차 E2E + Genesis Rule UI/rules + 모델카탈로그 티어 확정(TK와 빌드 중)

## 8. 폐기/대체
- studio_video_15s_kling SQL: season_0 15/15 고정은 compose로 **사문화** -> 삭제, compose 마이그가 대체.
- 단일생성 코드(워커 metadata model-agnostic, /studio 생성)는 **재사용**(조합의 클립 생성 레이어). UI 길이 고정표시만 셀렉터로 환원.
