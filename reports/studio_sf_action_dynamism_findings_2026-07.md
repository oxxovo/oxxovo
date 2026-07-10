# SF/액션 역동성 실측 진단 (2026-07-10, 지수2)

TK 판정: 우주 결투 데모의 "나는 게 실감 안 남". 감이 아닌 실측으로 원인 규명 +
개선 경로 검증. fal 타입 정의 직접 확인 + 동일 액션 장면 t2v 3종 재생성 + 로컬
ffmpeg 프레임 육안.

## Q1. 원인 = 모델 한계가 아니라 **제어 + 프롬프트** 한계

측정 근거 (fal `@fal-ai/client` 타입 정의):
- **Kling V3 Pro t2v 엔드포인트엔 카메라/모션 제어 필드가 0개** — prompt / multi_prompt
  / cfg_scale / negative_prompt / aspect_ratio / generate_audio 뿐. 카메라 무브는
  전적으로 모델 재량이고, `shot_type='customize'` multi_prompt는 안정적(=느린)
  "히어로 플로팅" 샷으로 편향된다.
- 원본 결투 데모의 배경 = **빈 우주 void = 저패럴랙스**. 스쳐가는 전경 물체가 없어
  아무리 빨라도 속도감 큐가 없다 (물리적으로 속도가 안 읽힘).

결정적 반증: **같은 Kling V3 Pro 모델**에 (a) 공격적 카메라/모션 프롬프트, (b) FPV
추격 프레이밍, (c) 전경 소행성/debris가 렌즈를 스쳐가게 = 원본과 낮과 밤 차이의
역동성. 모델을 안 바꾸고 프롬프트만 바꿔서 해결됨. → **모델 천장 아님.**

## Q2. 개선 경로 (실측)

### a. 카메라/모션 프롬프트 강화 → ★효과 매우 큼 (최우선, 무비용)
`SFX_A_kling_v3_camera_8s.mp4` (Kling V3 Pro, 8s, 1080p). "FPV drone chase / camera
whipping and banking / debris streak PAST the lens / heavy motion blur / hyperspeed
/ stars smearing" + negative_prompt에 "static, slow, floating still". 결과 = 강한
속도감·모션블러·소행성 스쳐감. **파이프라인 변경 0, 비용 증가 0.** 우리 현재 스택
(t2v 자유텍스트 한 필드)에 그대로 적용 가능.

### b. 카메라 제어 기능 (fal 실측)
- **MiniMax Video-01-Director** = 프롬프트에 `[Tracking shot] [Whip pan] [Push in]`
  **대괄호 카메라 지시** 지원. **t2v (시작 이미지 불필요) → 우리 스택 호환.**
  `SFX_C_minimax_director.mp4` = 지시대로 트래킹/뱅킹 카메라, 강한 역동성. 단 6s·720p.
- **PixVerse V4 i2v** = 명시적 `camera_movement` enum (whip_pan / hitchcock(달리줌) /
  super_dolly_out / robo_arm / quickly_zoom_in 등 20종). 가장 정밀한 카메라 제어지만
  **i2v (시작 프레임 필요) + 720p·8s 상한.** 별도 image 파이프라인 필요.
- **Kling V3 Pro Motion Control** = 레퍼런스 **영상**의 캐릭터 액션을 전이 (최대 30s,
  character_orientation='video'). 안무 액션 최강이나 소스 영상 확보 필요.
- (Kling V1 std t2v엔 `camera_control` down_back/forward_up 등 있으나 구모델·저품질.)

### c. 액션/모션 강한 다른 모델
- **MiniMax Hailuo 02 Pro** (`fal-ai/minimax/hailuo-02/pro/text-to-video`) =
  `SFX_B_hailuo02pro.mp4` (5.9s, 1080p). **셋 중 가장 깔끔+역동적** — 디테일 유지가
  좋으면서 sparks/debris 물리와 뱅킹 모션이 자연스럽다. t2v, 우리 스택 호환.
- fal 라인업에 Seedance v1.5 Pro, Kling v2.5-turbo/v2.6, Hunyuan v1.5, Wan 등 다수
  존재(미검증). 액션 후보 우선순위: Hailuo > Kling(최고 해상도·최장 15s) > Director.

## Q3. 재생성 3종 (TK 육안 재판정용, 실비 ~$2.3)
`oxxovo-studio-samples/`:
- `SFX_A_kling_v3_camera_8s.mp4` — Kling+공격적 프롬프트 (8s·1080p·20.5MB)
- `SFX_B_hailuo02pro.mp4` — Hailuo 02 Pro (5.9s·1080p·3.9MB)
- `SFX_C_minimax_director.mp4` — Director+대괄호 카메라 (5.6s·720p·3.2MB)
- 프레임: `_frames2/A1..C3.jpg`. 스크립트: `oxxovo-studio/_sf_action_test.mjs` (임시).

## Q4. 우리 스택 액션 역동성 상한 (솔직)

**가능**: "관객이 볼 만한" 단일 히어로 액션(로켓 비행/추격/뱅킹/폭발 돌진)은 우리
현재 t2v 스택에서 **프롬프트 크래프트만으로 도달**. 원본의 "허접"은 프롬프트 문제였음.

**여전한 상한 (솔직히 안 되는 것)**:
1. **정밀 다인 전투 안무** — 두 캐릭터가 정확히 주먹/무기를 주고받고 접촉하는 합.
   t2v는 "단일 피사체 모션"엔 강하지만 접촉 있는 다인 안무는 아직 약함. (Kling Motion
   Control로 레퍼런스 영상 전이하면 가능성, 소스 필요.)
2. **캐릭터 속성 정밀 고정** — multi_prompt는 모델이 인물 색/디자인 결정(데모2 갑옷색
   이탈과 동일 한계). 특정 캐릭터 못 박으려면 Seedance ref2vid / 레퍼런스 경로.
3. **길이** — 단일 생성 Kling 15s / Hailuo·Director 6s. 30초는 compose 합성(=일관성
   재붕괴 위험).
4. **육안 필수** — 프레임엔 모션블러·패럴랙스가 명확(=진짜 움직임)하나, temporal
   워핑/모핑은 TK가 mp4로 확인해야 확정.

## 권장 (실측 기반)
1. **액션 장르 프롬프트 크래프트 레이어** (무비용, 즉효): 카메라 무브 + 전경 패럴랙스
   + 모션블러 + 속도 언어를 액션 프롬프트에 주입. 현재 스택 그대로.
2. **카탈로그에 Hailuo 02 Pro + Director 추가** (data-only 마이그, tiers 패턴): 액션엔
   Hailuo(품질), 카메라 제어엔 Director. Sora 빠진 standard/premium 재편과 함께 검토.
3. (후속) 정밀 전투 필요 시 Kling Motion Control / Seedance ref2vid 별도 트랙.
