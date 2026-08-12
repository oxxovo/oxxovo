# Stage 3 (i2v / AI 배우) — 1단계 probe 결과 + 육안 판정 자료 -- 2026-07-17, 지수2

TK 승인 유료 probe 3건 실행 완료. 실지출 ≈ **$3.2** (승인 $8~13 내). 판정 = TK 육안 대기.
육안 갤러리(스틸 임베드 + R2 영상 링크): claude.ai artifact `efabe81b-3749-4816-8ea5-e714dc96120d`.

## 결과 요약

| Probe | 질문 | 결과 |
|---|---|---|
| ① Kling V3 Pro i2v 3요소 | start_image + multi_prompt + elements 동시 런타임? + 배우 유지? | ✅ **동작 + 3샷 일관** |
| ② Ideogram Character | photoreal AI 배우 캐릭터 시트 성립? | ✅ **시트 성립, 정책 통과** |
| ③ Seedance 정책 재확인 | AI 생성 photoreal도 거부? | ❌ **거부 확정** (실사 전용 아님) |

## Probe ① — Kling V3 Pro image-to-video 3요소 (핵심)
- 입력: `start_image_url`(스튜디오 3/4 시트) + `elements[{frontal_image_url, reference_image_urls[]}]`(정면+시드) + `multi_prompt[3샷]` + `shot_type:'customize'` + `generate_audio`.
- **셋 다 런타임 동시 수용** → 15초 1생성(wall 607s). 에러/충돌 없음. **isolation fallback 불필요**.
- 육안(프레임 1/6/11/14s): 3개 독립 샷이 **같은 배우 유지**(눈·코·입·얼굴형·금 귀걸이 일치). shot3 표정 약간 부드러워짐(정상 변이).
- 의의: **"AI 배우로 멀티샷 서사" = 1생성으로 성립.** Stage 2(스토리보드)가 여기 흡수됨.
- 산출물: `S3B_kling_3element_15s.mp4` (R2 stage3_probe/).

## Probe ② — Ideogram Character (캐릭터 시트)
- flux/dev로 특징 뚜렷한 배우 시드 1장(눈밑 점·금 귀걸이·넘긴 흑발, 화장품 CF톤) → Ideogram Character
  `reference_image_urls:[시드]`로 3장 재생성(정면·립스틱·스튜디오 3/4).
- **4장 전부 photoreal 통과**(거부 0) + **얼굴 아이덴티티 일관**. 드리프트: 눈밑 점 흐림, 귀걸이 디자인 재해석(경미).
- ★스키마 주의: `reference_image_urls`는 **1장만 사용**(나머지 무시). `image_size` enum + custom, `rendering_speed:'QUALITY'`.
- 산출물: `S3A_base_face.jpg` + `S3A_sheet1/2/3.jpg`.

## Probe ③ — 얼굴 정책 경계 (재확인)
- 같은 AI 배우 photoreal 얼굴 → `bytedance/seedance-2.0/reference-to-video` 투입.
- **거부**: `content_policy_violation` / "likenesses of real people ... cannot be processed" / `partner_validation_failed`.
- 결론: **Seedance는 AI/실사 구분 없이 사실적 얼굴 자체를 차단.** "AI생성 photoreal은 통과" 설은 Seedance엔 **거짓**. 스타일라이즈 캐릭터만 통과(기존 REF30v2 proof와 일치).

### 실사 AI 배우 허용 매트릭스 (확정)
| 모델 | 티어 | 실사 AI 배우 | 근거 |
|---|---|---|---|
| Ideogram Character | t2i | 허용 ✓ | probe ② |
| Kling V3 Pro i2v | i2v | 허용 ✓ | probe ① + 기존 ICHAR |
| Seedance 2.0 ref2vid | i2v | 거부 ✕ | probe ③ |

→ **화장품 CF(실사 배우) 경로 = Ideogram(시트) + Kling(i2v). Seedance는 스타일라이즈 전용 옵션.**
(Veo 3.1 ref2vid 실사 정책은 미probe — Google 상류 게이트 가능성, 필요 시 후속.)

## R2 자료 (base = https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev/stage3_probe/)
- 캐릭터 시트: S3A_base_face.jpg / S3A_sheet1_frontal.jpg / S3A_sheet2_product.jpg / S3A_sheet3_profile.jpg
- Kling 3요소: S3B_kling_3element_15s.mp4 (+ S3B_frame_1s/6s/11s/14s.jpg)
- 기존 proof: ICHAR_ref.jpg + ICHAR_shot1_walk/2_lookup/3_turn.mp4 / REF30v2_stylized_portrait.jpg + clip1_park/2_cafe_15s.mp4

## 2단계 착수 조건 (TK 육안 "같은 배우로 보임" 판정 후)
1. 마이그: 캐릭터 라이브러리 테이블 + 이미지 잡 media_type + 드래프트 이미지 티어 (whitespace 검증 SQL, TK Run)
2. 서버: t2i 생성 + i2v elements 주입 + **CryptoBind i2v 확장(v1i)** — 양 레포 lockstep + 변조거부 테스트
3. UI: 캐릭터 시트 생성·라이브러리·i2v 샷 (보라 톤, Watch·ComposeEditor 불변)
4. ★워커 분기: `multi_prompt`는 top-level `prompt`/`duration`과 상호배타(기실측) — i2v elements 경로와 단일 경로 분기

## 미결/후속
- Kling elements 최대 개수·해상도 파라미터: 스키마상 명시 상한 없음(문서 기준), 실사용 시 재확인.
- seed 미지원(재현 불가) 3모델 여전 — 캐릭터 고정은 시트+elements로만.
- 비용: Kling i2v ~$2.5/프로젝트급(15s multi) → 드래프트 티어 이미지 확장으로 시행착오 흡수 필요.
