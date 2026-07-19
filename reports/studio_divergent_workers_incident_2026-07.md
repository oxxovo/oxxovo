# ★발사 게이트: 공유 프로드 DB에 divergent Studio 워커 4개 (사고 + 정리) — 2026-07-18, 지수2

Stage 3 "AI 배우" 전체 사이클 대행 데모 중 발견. **발사 블로커**로 분류하고 정리 완료.
본부/발사 게이트 공유 항목.

---

## 1. 사고 요약
하나의 프로덕션 Supabase(`generation_jobs`)를 **4개 Railway 프로젝트의 `oxxovo-studio` 워커가 동시에 폴링**하고 있었다. 이 중 정본(just-vibrancy) 1개만 Stage 3 새 코드였고, 나머지 3개는 **구 코드**(Stage 3 이미지 라우팅 없음).

- **증상**: 새 이미지 잡(`media_type='image'`)을 구 워커가 claim하면 `media_type`을 모른 채 **video 경로로 처리** → `"fal returned no video url"` 실패. 어느 워커가 먼저 claim하냐의 **레이스**라 이미지 생성이 간헐 실패.
- **위험도**: 데모 블로커일 뿐 아니라 **발사 후 실장애** — session6 ON 시 구 워커들이 실제 참가자 image/i2v 잡을 오처리(무결성·환불·경험 파손).

## 2. 관련 워커 (2026-07-18 기준)
| 프로젝트 | 서비스 | 서비스 ID | 코드 | 조치 |
|---|---|---|---|---|
| **just-vibrancy** | oxxovo-studio | 9bb1e81f-36ed-442e-8f89-e33cbc689a36 | 새 코드(정본) | **가동 유지** |
| charming-recreation | oxxovo-studio | dab1fa36-dff7-4558-a9e6-57fa79f15b64 | 구/미가동 | down |
| fulfilling-consideration | oxxovo-studio | cd389fb3-70c3-4bae-989b-a691a6d33326 | 구/미가동 | down |
| trustworthy-enchantment | oxxovo-studio | 0c9f0e2e-d16a-48a1-9d3c-63088dfbd379 | **구·가동(레이스 주범)** | **down** |
| trustworthy-enchantment | **oxxovo-scoring** | ca511fd1-3a07-4038-9154-3d0fae7a65a3 | 채점 엔진 | ★**무손상 유지** |

- 정본 판별: `oxxovo-studio` 레포 dir이 Railway `just-vibrancy`에 링크됨(canonical).
- charming/fulfilling은 이미 "No deployments"(미가동). **실제 레이스 주범 = trustworthy-enchantment/oxxovo-studio**.

## 3. 조치 (2026-07-18, 되돌리기 가능)
```
railway down -p <projectId> -s <studioServiceId> -e production -y   # 서비스ID로 정밀 타겟
```
- 3개 studio 서비스 배포 제거(=워커 중단). **복구는 재배포**(`railway up`)로 언제든.
- ★**oxxovo-scoring(ca511fd1)은 절대 미접촉** — studio 서비스 ID만 명시적으로 지정.

## 4. 조치 후 검증 (3/3 통과)
1. ★**oxxovo-scoring 생존**: 중단 직후 정상 배치 실행 확인(season_0 게이트 체크→마감 전이라 스킵, 정상). studio 중단 무영향.
2. **정본만 폴링**: 스트레이 3개 전부 "No deployments", just-vibrancy만 Online.
3. **라우팅 정상화**: 이미지 잡 재시도 → `ready`(image_url 정상), `"no video url"` 소멸.
- 이후 **전체 사이클 데모 완주**(①②③ + i2v 15s, error 0).

## 5. ★발사 규칙 (교훈)
- **워커 증설은 반드시 정본(just-vibrancy)의 replica로.** divergent 프로젝트에 별도 워커를 띄우면 코드가 갈라져 이번 같은 레이스/오처리가 재발한다.
- 하나의 프로드 DB → **단일 정본 서비스 + numReplicas 스케일**이 원칙. (Railway `numReplicas`는 같은 이미지의 복제라 코드 동일 보장.)
- 발사 전 체크: `generation_jobs`를 폴링하는 studio 워커가 정본 1개뿐인지 재확인.

## 6. 부수 발견/수정 — i2v 파라미터 갭 (같은 데모서)
- Kling i2v(`kling-v3-pro-i2v`) 실제 생성이 fal **422**로 실패. 원인 = 서버 조립 i2v_input에 **`shot_type:'customize'`·`aspect_ratio`·`generate_audio` 누락**(2.1 시드가 `{cfg_scale:0.5}`만 넣음). 실동작 probe 입력과 대조해 확인.
- **수정(적용 완료, data-driven)**: `model_catalog.metadata.input_params`에 추가 →
  `{"cfg_scale":0.5,"shot_type":"customize","aspect_ratio":"16:9","generate_audio":true}` (워커가 병합). 수정 후 i2v 15s 3샷 정상 생성.
- **영구화 필요**: 아래 SQL을 정식 마이그로 반영(현재 라이브 DB엔 admin UPDATE로 이미 적용됨).
```sql
UPDATE model_catalog
SET metadata = metadata || '{"input_params":{"cfg_scale":0.5,"shot_type":"customize","aspect_ratio":"16:9","generate_audio":true}}'::jsonb,
    updated_at = now()
WHERE id = 'kling-v3-pro-i2v';
```

## 7. 관련
- 데모 갤러리(캐릭터 일관성 + UI 12스텝): claude.ai artifact `b899d5f4-4d5b-4f7a-a9f6-6a7d21713889`.
- [[project_studio_quality_model_pivot]] · reports/studio_stage3_actor_demo_2026-07.md
