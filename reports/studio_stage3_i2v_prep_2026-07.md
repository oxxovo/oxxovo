# Stage 3 (이미지 생성 + i2v) 착수 전 사전 조사 -- 2026-07-16 밤, 지수2

조사만. 코드/유료 probe 없음 (내일 TK 계획 승인 후). 로드맵 기준 ~4주 최대 항목,
TK가 Studio 완성선을 Stage 3까지로 확정(2026-07-16).

## 1. 기존 실험 물증 재확인 (우리 손으로 이미 검증된 것)

| 실험 | 결과 | 물증 |
|---|---|---|
| `_i2v_charconsist.mjs` (7/10) | flux/dev **photoreal** 키프레임 -> **Kling v3 pro i2v x3샷 성공** (같은 start_image, 독립 3생성). 정책 거부 없음 | `oxxovo-studio-samples/ICHAR_ref.jpg + shot1~3.mp4` -- **일관성 판정 = TK 육안 대기** |
| `_ref30_probe.mjs` v1 (7/10) | Seedance ref2vid: **photoreal 얼굴 거부**(content_policy) | -- |
| `_ref30_probe.mjs` v2 (7/10) | **스타일라이즈**(3D 애니풍) 캐릭터는 통과 + 독립 2생성 일관 OK | `REF30v2_stylized_portrait.jpg + clip1/2.mp4` |
| Kling multi_prompt (7/10) | 1생성 <=6샷 <=15s 인물 일관 3샷 서사 성공 | CEIL_kling_multishot_15s.mp4 |

## 2. fal 지형 (2026-07-16 웹조사, 상세 표는 원문 유지 -- 요지만)

**t2i (캐릭터 생성)**
- **Ideogram Character** (`fal-ai/ideogram/character`): 사진 1장 -> 일관 photoreal
  캐릭터, $0.10~0.20/장. "AI 배우" 목적에 가장 부합.
- **Nano Banana Pro**: 레퍼런스 <=14장, 인물 <=5명 일관, $0.15/장 (SynthID 워터마크 내장).
- FLUX.2 pro: @멀티 이미지 레퍼런스, $0.03/장. flux/dev $0.025(레퍼런스 없음, 기존 실험 사용).
- 보조: flux-pulid(얼굴 주입), instant-character, face-swap 계열(드리프트 보정용).

**i2v / ref2vid (우리 전 모델군에 존재)**
- ★**Kling V3 Pro i2v** (`.../v3/pro/image-to-video`): OpenAPI 실스키마 확인 --
  `start_image_url` + `multi_prompt[]` + **`elements[]`(정면+참조1~3장, @Element1)**
  + `end_image_url` **동시 수용**. $0.112~0.168/s. = 키프레임+멀티샷+캐릭터참조
  한 번에 (런타임 동작은 probe 필요).
- **Kling O3 ref2vid**: 전용 캐릭터 참조 엔드포인트 (자산 <=4, std $0.084/s).
- **Seedance 2.0 ref2vid**: 이미지 <=9 + 비디오 <=3 참조. mini 480p ~$0.072/s = 최저가 일관 경로.
- **Veo 3.1 ref2vid**: image_urls 배열("재료" 방식). Hailuo 02 i2v: `end_image_url`
  지원(프레임 연속 체이닝!) 무음 $0.017~0.08/s. LTX-2 Fast i2v $0.04/s.
- **프레임 연속 로드맵 단서**: Kling/Hailuo end_image + Veo first-last-frame 엔드포인트.

**정책 (중요)**: Seedance 거부는 **"실사진 얼굴" 필터**(deepfake 방지)라는 게 복수
서드파티 분석 -- **AI 생성 photoreal 초상은 통과한다는 보고** (우리 v1 거부와 상충
가능성: 필터 튜닝됐거나 우리 얼굴이 과하게 실사였을 수도. **재probe 필요**).
Kling/Ideogram은 얼굴 제한 문서화 없음(ICHAR 실증과 일치). Veo는 Google 인물정책
상류 게이트 가능성 -- probe.

## 3. 비용 그림 (캐릭터시트 4장 + 5s x6샷 = 30초 기준)

| 경로 | 프로젝트당 |
|---|---|
| 극한 절약 (Ideogram turbo + Hailuo std 512p) | ~$0.84 (무음) |
| 절약 (LTX/Hailuo 768p) | ~$1.6 |
| **권장 품질 (Nano Banana/Ideogram + Kling V3 elements)** | **~$4.0~5.7** |
| Kling O3 std ref2vid 대안 | ~$3.1 |
| 프리미엄 (Seedance/Veo) | ~$9.7~12.8 |

500명 x 품질 경로 ~= $2,000~2,800/시즌 (재생성 감안 x2 예산). 드래프트 티어
(sandbox) 구조를 이미지에도 재사용하면 시행착오 비용 흡수 가능.

## 4. CryptoBind 체인 확장 설계 포인트 (질문 4)

현행 체인: v1(생성 서명: jobId/pid/tid/model/duration/time) + v1sc(콘텐츠 해시
서명, 워커) + v1sr(렌더 요청: EDL+소스 서명 번들) + 제출 시 전체 검증.

i2v 확장 (로드맵 v1i 구체화):
1. **이미지 잡 = 신규 media_type**: t2i도 generation_jobs(또는 병행 테이블)로 v1i
   서명 + 이미지 바이트 해시(v1ic). 워커 이미지 경로 + R2 이미지 버킷.
2. **부모 바인딩**: i2v 잡 생성 시 `start_image`/`elements`의 **부모 이미지 잡
   서명을 서명 재료에 포함** -- createRender의 source-bundle 패턴 재사용
   (`sourceSignatures` -> `parentImageSignatures`).
3. **제출 검증 체인**: 최종영상 -> (compose면 EDL 소스들) -> 각 클립 -> (i2v면
   부모 이미지) -> 본인+본 시즌 검증. 외부 이미지 업로드는 **차단**(Genesis Rule:
   플랫폼 생성 이미지만 레퍼런스 가능) -- elements/ref2vid 입력도 내부 t2i 산출물의
   R2 URL만 허용.
4. **양 레포 lockstep 필요** (Stage 1~2와 달리 이번엔 크립토 확장 불가피 --
   로드맵 1.5일+2일 반영분). byte-for-byte 미러 + 변조거부 테스트.

## 5. 내일 계획 논의용 결정 포인트

1. **아키텍처 후보** (조사 권고): 캐릭터 시트(Ideogram Character 또는 Nano Banana)
   -> 시트 저장(R2+캐릭터 라이브러리) -> 샷 생성 = (품질) Kling V3 i2v
   elements+multi_prompt / (절약) 샷별 키프레임+Hailuo/LTX i2v. compose 클립
   레이어에 그대로 얹힘.
2. **스타일라이즈 vs photoreal**: ICHAR 실증(Kling photoreal OK) + Seedance
   재probe 결과로 정책 경계 확정 후 참가자 고지 문구.
3. **probe 예산**: 8건 ~$17~32 (핵심 3건만 추리면 ~$8~13: Kling 3요소 동시 런타임
   / Ideogram Character 품질 / 얼굴 정책 경계).
4. 드래프트(Sandbox) 티어를 이미지 생성에도 확장할지 (구조 재사용 가능).
5. Stage 2(멀티프롬프트 스토리보드)와의 순서 -- Kling elements가 multi_prompt를
   품고 있어 Stage 3가 Stage 2 일부를 자연 흡수할 여지. ★워커 주의: multi_prompt는
   top-level prompt/duration과 상호배타 (2026-07-16 실측) = 워커 분기 필요.

미확인/갭: Kling·Seedance·Hailuo 비디오 모델 seed 미지원(재현 불가) / 비디오
face-swap 도구 fal 미확인 / Kling V3 i2v 해상도 파라미터 없음 / Nano Banana 가시
워터마크 여부 API 확인 필요.
