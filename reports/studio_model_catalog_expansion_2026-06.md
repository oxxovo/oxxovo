# OXXOVO Studio — 모델카탈로그 확장 실측 (인기 모델 보강) + 추천 라인업

작성: 2026-06-13 (지수2). fal.ai 공식 모델/API 페이지 실측. 추정 없음.
배경: 2026 실사용 최다 = Kling / Seedance 2.0 / Veo 3.1 / Runway / Sora. 짜깁기로 단일 길이
한계가 사라져(Veo 8초도 조합으로 OK) 인기 모델을 티어로 더 편입.

## 1. 추가 후보 실측 (fal 공식)

| 모델 | fal_model_id | 초당가(오디오 ON) | 단일 max | 길이 enum | 해상도 | 콘텐츠 정책 |
|---|---|---|---|---|---|---|
| **Seedance 2.0** | `bytedance/seedance-2.0/text-to-video` | **$0.3034**(720p) / $0.682(1080p) | 15s | auto,4~15 | 480p/720p* | ByteDance, 비교적 관대(명시적 공인차단 약함) |
| **Veo 3.1 (full)** | `fal-ai/veo3.1` | **$0.40**(720/1080p) / $0.60(4K) | **8s** | <=8 | 720p/1080p/4K, 24fps | Google, **가장 안전**(강하나 예측가능, Sora만큼 공격적 거부 아님) |
| Veo 3.1 Lite | `fal-ai/veo3.1/lite` | $0.05(720p) / $0.08(1080p) | **8s** | 4,6,8 (1080p=8s) | 720p/1080p | Google 동일(안전) |
| ~~Runway Gen-4.5~~ | **fal 미제공** | — | — | — | — | **fal에 엔드포인트 없음 → 추가 불가** |

\* Seedance: 1080p 단가는 표기되나 t2v 지원 해상도 표엔 480/720만 노출 → 카탈로그는 **720p로 확정**(R1 안전).
**전부 720p+ 충족.** Runway는 fal이 호스팅하지 않음(자사 API 전용) → 우리 fal-only 통합으론 불가(별도 프로바이더 통합 필요, 범위 밖).

생성 시간: fal 페이지 미공개. 기존 실측 참고(LTX 16s=70s, Sora 16s=200s). Seedance/Veo는 **테스트 생성 필요**(원하시면 1~2개 뽑아 측정). Veo 8s는 통상 빠른 편, Seedance는 가변.

## 2. 추천 라인업 (현 3개 + 추가 → 6개, 인기 5대 패밀리 전부 커버)

| 티어 | 모델 | fal_model_id | $/s | 단일 max | 해상도 |
|---|---|---|---|---|---|
| budget | LTX-2 Fast | `fal-ai/ltx-2/text-to-video/fast` | $0.04 | 20s | 1080p |
| budget | **Veo 3.1 Lite** (신규, 저가+안전) | `fal-ai/veo3.1/lite` | $0.05 | 8s | 720p/1080p |
| standard | Sora 2 | `fal-ai/sora-2/text-to-video` | $0.10 | 20s | 720p |
| standard | Kling V3 Pro | `fal-ai/kling-video/v3/pro/text-to-video` | $0.168 | 15s | 1080p |
| premium | **Seedance 2.0** (신규, 가장 핫) | `bytedance/seedance-2.0/text-to-video` | $0.3034 | 15s | 720p |
| premium | **Veo 3.1 full** (신규, 가장 안전) | `fal-ai/veo3.1` | $0.40 | 8s | up to 4K |

커버: Kling / Seedance / Veo / Sora / LTX = 5대 패밀리 전부. (Runway만 fal 미제공으로 제외.)

## 3. 마진 40% 크레딧표 (라이브 margin=0.40, $0.10/cr -> ceil(원가 x 14))

| 모델 | $/s | 단일 max 길이 크레딧 | 대표 길이 |
|---|---|---|---|
| Veo 3.1 Lite | $0.05 | 8s @720p = **6cr** ($0.60) | 가장 저렴+안전 |
| LTX-2 Fast | $0.04 | 20s = **12cr** ($1.20) | 길고 저렴 1080p |
| Sora 2 | $0.10 | 20s = **28cr** ($2.80) | |
| Kling V3 Pro | $0.168 | 15s = **36cr** ($3.60) | 사실감 |
| Veo 3.1 full | $0.40 | 8s @720p = **45cr** ($4.50) | 안전·고품질 |
| Seedance 2.0 | $0.3034 | 15s @720p = **64cr** ($6.40) | 핫·멀티샷 |

(짜깁기 30초 완성작은 위 클립들을 조합 — 길이는 모델 무관.)

## 4. 확정 (TK 2026-06-13)

**6개 전부 채택**: LTX-2 Fast / Veo 3.1 Lite / Sora 2 / Kling V3 Pro / Seedance 2.0(std) / Veo 3.1 full.
- Runway = fal 미제공으로 제외(향후 Runway 직통합은 별도 에픽).
- **Veo 3.1 Lite 오디오 실측 확인(fal /api)**: `generate_audio` 파라미터 **기본값 true = 네이티브 오디오 포함**(무음 아님). 720p+audio $0.05/s, 1080p+audio $0.08/s, durations 4/6/8. → C안 호환, 무음 경고 불필요.
- **전 6모델 native audio** → `metadata.has_audio=true` 명시(UI 투명성).
- 통합 마이그(6행 active + 옛 ltx-v1/veo3.1-fast 비활성, veo3.1 행 재사용 refresh):
  `reports/_run/model_catalog_tiers.sql`(주석0, TK Run) / 영구본 `studio_model_catalog_tiers_migration_2026-06.sql`.

### ② 워커 배선 시 확인 메모(다음 단계)
- Seedance `duration` 파라미터가 문자열("auto"/"4".."15")일 수 있음 → 워커가 숫자 전송 시 변환 필요 여부 확인.
- Veo 3.1 full `duration` enum(4/6/8 가정) fal 재확인 — Lite와 동일 추정.
- Seedance `resolution` 파라미터 키/허용값(480p/720p) 재확인 후 전송.
- 이 항목들은 metadata.input_params만 손보면 되는 데이터 수정(코드 변경 아님).

## 5. fal 공식 출처

- Seedance 2.0: https://fal.ai/models/bytedance/seedance-2.0/text-to-video
- Veo 3.1: https://fal.ai/models/fal-ai/veo3.1
- Veo 3.1 Lite: https://fal.ai/models/fal-ai/veo3.1/lite
- Runway(미제공 확인): https://fal.ai/models?keywords=runway
