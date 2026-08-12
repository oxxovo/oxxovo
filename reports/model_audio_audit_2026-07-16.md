# model_catalog 오디오 전수 실측 — 2026-07-16

세션6 블로커 ④. active 7종 모델의 `metadata.has_audio` 플래그를 ffprobe 실측과 전수 대조.
핵심 질문 = **역방향 오판**(플래그 true인데 실제 무음 → 무음 배지가 안 떠서 참가자가 모름) 존재 여부.

**결론: 7/7 전부 플래그와 실측 일치. 역방향 오판 0건. 수정 필요 없음.**

## 방법

- 로컬 실측(비용 0): stage1 19편(`_stage1_matrix.mjs`, 워커 실물 `generateVideo` + 카탈로그
  `input_params` 그대로 = 프로덕션 동일 조건) 중 Kling 9편 + CEIL/SFX 3편, LTX-2 2편
  (`gen.mjs`가 카탈로그 동일 입력 1080p/fps25/`generate_audio:true`로 생성).
- 신규 생성(TK 승인 ~$3.01): `oxxovo-studio/_audio_audit.mjs` — veo3.1 / veo31-lite /
  seedance2 각 1편, 최소 duration 4s, 동일 프로덕션 경로. 프롬프트는 소리가 확실한 장면
  (드러머+박수+차량)으로 고정해 "조용한 장면이라 무음" 오판을 배제.
- 측정: `ffprobe`(오디오 스트림 유무) + `ffmpeg volumedetect`(mean/max dB).

## 결과 — 7종 대조표

| 모델 | tier | 플래그 | 실측 | 근거 (대표 측정값) |
|---|---|---|---|---|
| LTX-2 Fast | budget | true | 오디오 있음 ✅ | aac 24kHz st, mean -31.1 / max -16.3 dB |
| Veo 3.1 Lite | budget | true | 오디오 있음 ✅ | aac 48kHz st, mean -21.2 / max 0.0 dB |
| Kling V3 Pro | standard | true | 오디오 있음 ✅ | 12편 전부 aac 44.1kHz st, mean -17.0~-62.9 dB |
| Hailuo 02 Pro | standard | **false** | 무음 ✅ | 7/10~12 SF액션 테스트 ffprobe (기실측) |
| Video-01 Director | standard | **false** | 무음 ✅ | 7/10~12 SF액션 테스트 ffprobe (기실측) |
| Seedance 2.0 | premium | true | 오디오 있음 ✅ | aac 44.1kHz st, mean -23.3 / max -5.6 dB |
| Veo 3.1 | premium | true | 오디오 있음 ✅ | aac 48kHz st, mean -24.9 / max -0.1 dB |

(Sora 2 = active=false 비활성, 대상 외.)

## 관찰 (블로커 아님, 참고)

- **Kling 콘텐츠 의존 준무음**: 조용한 뷰티/드라마 장면은 mean -50~-63 dB로 사실상 안 들림
  (B3_match_beauty_kling: mean -62.9 / max -47.0 dB). 모델은 오디오를 생성하지만 장면이
  조용하면 준무음 — 참가자가 "소리가 안 난다"고 느낄 수 있음. 배지 문제 아님(플래그 정확).
- **fal 큐 변동성**: veo3.1 1편에 59분(3549s) 소요, veo31-lite 8분, seedance2 3.4분.
  시즌 중 premium 생성 대기시간 기대치 관리 필요할 수 있음.
- 신규 샘플 3편 보존: `oxxovo-studio-samples/AUDIT_*.mp4`. 실비 ≈ $3.01 (승인분).
