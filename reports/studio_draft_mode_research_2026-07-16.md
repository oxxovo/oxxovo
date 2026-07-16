# Studio 드래프트 모드 기술 조사 (2026-07-16, 지수2)

배경: "프리셋 시험마다 생성=크레딧 부담"(TK). 업계 표준 = 드래프트(저가 미리보기) -> 최종 렌더.
조사만, 결정 없음 -- 캡/공정성 정책은 TK+고문 몫.

## 1. 핵심: Kling V3 Pro 자체엔 draft 파라미터 없음 (fal OpenAPI 실스키마 확인)

`fal-ai/kling-video/v3/pro/text-to-video`의 전체 입력 = prompt / duration / multi_prompt /
generate_audio / shot_type / aspect_ratio / negative_prompt / cfg_scale. draft/preview/
resolution 파라미터 없음. Kling 3.0의 "5~20x draft mode"는 Kling 앱 전용, fal 미노출.

**단, fal에 저가 형제 엔드포인트가 있어 사실상 드래프트 티어로 쓸 수 있음:**

| 엔드포인트 | 가격/s | 비고 |
|---|---|---|
| v3/pro (현행) | $0.168 (오디오 포함) | 프로덕션 |
| v3/turbo/standard | **$0.112 (오디오 포함, 720p)** | fal 공식 문구 "rapid iteration" -- 드래프트 최적, Pro의 0.67x |
| v3/standard | $0.084 (무음) / $0.126 (오디오) | Pro의 0.5x (무음) |

주의(정직 고지): 별도 엔드포인트 = 별도 샘플링. Kling 앱 draft처럼 "같은 생성의 저해상도
업그레이드"가 아니라 **프롬프트/모션 프리뷰**임. 드래프트가 마음에 들어도 Pro 재생성 결과는
동일하지 않음.

## 2. 모델별 드래프트 대안·비용비

| 모델 | 드래프트 수단 | 드래프트가 | 정식가 | 비율 |
|---|---|---|---|---|
| Kling V3 Pro | turbo/standard 형제 | $0.112/s | $0.168/s | 0.67x (std 무음이면 0.5x) |
| Veo 3.1 | veo3.1/lite (720p 무음) | **$0.03/s** | $0.40/s (std+오디오) | **0.075x (13배 저렴)** |
| Seedance 2.0 | mini 형제 @480p | $0.072/s | $0.303/s (std 720p) | 0.24x |
| Hailuo 02 Pro | standard 형제 (768p) | $0.045/s | $0.08/s | 0.56x |
| LTX-2 Fast | 이미 최저 티어 ($0.04/s, 1080p이 최저 해상도) | -- | -- | -- |
| Video-01 Director | 저가 변형 없음 (flat $0.5/편) | -- | -- | -- |

## 3. 우리 구조에 넣는 규모감 (질문 4)

- **MVP = 코드 0줄.** model_catalog가 데이터 주도라 드래프트 행 추가(예: kling-v3-turbo,
  budget 티어) = 마이그 1개. 참가자가 모델 셀렉터에서 "드래프트" 모델을 고르면 끝.
  크레딧 차감·캡·워커·CryptoBind 전부 기존 경로 그대로.
- **제대로 된 draft->final 흐름** (드래프트 배지 + 캡 분리/제외 + "이 프롬프트로 최종 렌더"
  원클릭 재생성): createGeneration 캡 분기 + metadata(draft_of 링크) + UI = **~2~3일**.
  워커 무변. 캡 정책(30회에서 뺄지/별도 상한)이 선행 결정 사항.

## 4. 생성 후 씬 수정 (질문 5) -- fal에 있음

| 엔드포인트 | 기능 | 가격 |
|---|---|---|
| kling-video/o1/video-to-video/edit | 자연어로 기존 영상 수정, 모션·카메라 보존, @Element 인물참조 4장 | $0.168/s |
| wan-vace-apps/video-edit | 자연어 영상 수정 | **$0.05/s @480p** (수정 프리뷰용 최저가) |
| wan/v2.7/edit-video | 스타일/장면 수정 + 참조 이미지 | $0.10/s |
| luma ray-2/modify | 샷 전체 리스타일/소품·시대 교체 | $0.35/s |
| Runway Aleph | **fal에 없음** (Runway 자체 API 전용) | -- |

Kling O1 edit는 인물 일관성 트랙([[project_studio_quality_model_pivot]])과도 접점.
단, "신규 픽셀 편집"이라 Genesis Rule/CryptoBind 체인 확장 필요 = 로드맵 4번(첫 시즌 후) 영역.

## 5. 확정 전 실측 필요 (probe 예산 ~$5~6, 승인 대기)

1. turbo/standard의 multi_prompt/shot_type 동작 동일성 -- 15s 1생성 $1.68
2. standard->pro 드래프트 예측력(같은 프롬프트 비교) -- $1.26
3. Seedance mini 480p 품질 하한 -- $0.36
4. veo lite->veo 충실도 -- $0.24
5. Kling O1 edit E2E (turbo 생성+씬 수정) -- $1.40
6. ($0) turbo/std·veo3.1 OpenAPI 스키마 확인 (Pro에서 이미 검증한 방법)

출처: fal.ai 모델 페이지·OpenAPI 스키마·fal Kling 3.0 런치 블로그 (2026-07-16 조회).
