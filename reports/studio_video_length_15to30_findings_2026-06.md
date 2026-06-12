# OXXOVO Studio — 영상 길이 15~30초 단일 통일: fal 실측 + 티어 재설계

작성: 2026-06-11 (지수2). 모든 수치는 fal.ai **공식 모델/`/api` 스키마 페이지** 실측. 추정 없음.
제니2 출발점 가설은 본문에서 확인/반증 표기.

## 0. 한 줄 결론 (솔직 모드)

**fal에 "단일 생성 30초"가 되는 텍스트→영상 모델은 현재 0개다.** 독립 에이전트 2개 + 직접
`/api` 스키마 확인으로 교차검증. 단일 생성 현실 천장 = **20초**(LTX-2 Fast, Sora 2 std/Pro).
Sora 2 Pro "25초"는 마케팅 문구일 뿐 실제 enum은 `4,8,12,16,20`(=20초가 max)임을 직접 확인.

따라서 **"15~30초"는 fal에서 물리적으로 불가**. extend 체인을 부활시키지 않는 한
(=TK가 폐기 원한 방식), 규칙은 **15~20초 창**으로 내려와야 한다.

추가 함정(실측): LTX-2 Fast enum=`6,8,10,12,14,16,18,20`, Sora=`4,8,12,16,20` — **둘 다 "15"라는 값이 없다.**
두 모델이 공유하는 15~20 구간 값 = **{16, 20}**. 즉 "15초"는 LTX/Sora로는 생성 불가(최소 16초).
정확히 15초가 되는 건 Kling V3(3~15 정수)·Seedance 2.0(4~15 정수)뿐.

## 1. 모델별 fal 공식 실측 (단일 생성, 오디오 ON 기준)

| 모델 | fal_model_id | 단일 max | 선택 가능 길이 | 초당가(오디오) | 해상도 | 네이티브 오디오 |
|---|---|---|---|---|---|---|
| **LTX-2 Fast** | `fal-ai/ltx-2/text-to-video/fast` | **20s** | 6,8,10,12,14,16,18,20 | **$0.04** (1080p) | 1080p/1440p/2160p* | 예 |
| LTX-2.3 std | `fal-ai/ltx-2.3/...` | 20s | ~6~20 | $0.06 (1080p) | 1080p/1440p/2160p | 예 |
| LTX-2 Pro | `fal-ai/ltx-2/text-to-video` | **10s** | 6,8,10 | $0.06 (1080p) | 1080p/1440p/2160p | 예 |
| **Sora 2 std** | `fal-ai/sora-2/text-to-video` | **20s** | 4,8,12,16,20 | **$0.10** (720p, 평면) | 720p | 예 |
| **Sora 2 Pro** | `fal-ai/sora-2/text-to-video/pro` | **20s** | 4,8,12,16,20 | $0.30(720p)/$0.50(legacy1080p)/$0.70(true1080p) | 720p/1080p | 예 |
| **Kling V3 Pro** | `fal-ai/kling-video/v3/pro/image-to-video` | **15s** | 3~15 정수 | $0.168 (오디오 ON) | up to 1080p | 예 |
| Kling O3 Std | `fal-ai/kling-video/o3/standard/image-to-video` | 15s | 3,5,10,15 | $0.112 (오디오 ON) | up to 1080p | 예 |
| **Seedance 2.0** | `bytedance/seedance-2.0/text-to-video` | **15s** | 4~15 정수 | $0.30(720p)/$0.68(1080p) | 480/720/1080p | 예(컷·전환 포함) |
| ~~Veo 3.1 (현 카탈로그)~~ | `fal-ai/veo3.1` | **8s** | — | $0.40 | 720/1080p | 예 | **폐기** |
| ~~Veo 3.1 Fast (현 카탈로그)~~ | `fal-ai/veo3.1/fast` | **8s** | — | $0.15 | 720/1080p | 예 | **폐기** |

\* LTX-2 Fast는 **>10초일 때 1080p/25fps 강제**(1440p/2160p는 10초까지만).
제외(≤10초): Veo 전 라인(8s), MiniMax Hailuo(≤10s), Pixverse(≤10s), Vidu(5s), Luma/Pika/Wan/Hunyuan(≤10s),
Kling 2.5/2.6(5/10s). 30초는 Kling motion-control(레퍼런스 영상 구동) 외엔 전무 — 일반 t2v/i2v엔 부적용.

### 제니2 출발점 가설 검증 결과
- LTX 2.0 Pro "20초 초과" → **반증**(6/8/10초만). 20초는 **Fast/2.3 전용**.
- Seedance 2.0 "단일 15초, 컷·전환" → **확인**(공식: 단일 15초 내 멀티샷·네이티브 오디오).
- Sora 2 Pro "25초" → **반증**(enum max 20초). $0.50(1080p)도 정확히는 legacy1080p, true1080p는 $0.70.
- Kling 3 → **확인**(V3/O3로 단일 5/10초 한계 돌파, **최대 15초**). 단 30초 불가.

## 2. 테스트 생성 실측 (실제 화질 확인용, 2건)

동일 프롬프트("화성 사막 우주인, 일몰, 카메라 오빗")로 16초 생성:

| 영상 | 실측 출력 | 파일 | 생성 소요 |
|---|---|---|---|
| LTX-2 Fast 16s 1080p | 1920×1080, 25fps, 16.04s, 6.48MB | `_fal_test/ltx2-fast-16s-1080p.mp4` | 70.5s |
| Sora 2 std 16s 720p | 1280×720, 30fps, 16.0s, 9.22MB (+오디오/썸네일) | `_fal_test/sora2-std-16s-720p.mp4` | 200.8s |

→ 16초 단일 생성이 양 모델에서 정상 완료(20초 천장 실측 뒷받침). 화질 비교는 대표님 육안 판정.
(LTX는 빠르고 저렴·1080p, Sora는 3배 느리지만 모션 일관성·오디오 강점이 일반적 평. 최종은 육안.)

## 3. 3티어 재설계 (마진 40% 자동 유지)

크레딧 계산식은 기존 그대로: `credits = ceil(원가USD × (1+0.40) / 0.10)` = `ceil(원가 × 14)`.
→ **모델을 바꿔도 마진 40%는 공식상 자동 유지**. 아래는 그 결과 참가자 크레딧.

권장 사다리(전부 20초까지 커버, 네이티브 오디오):

| 티어 | 모델 | 초당 원가 | 16초 크레딧(=참가비) | 20초 크레딧 |
|---|---|---|---|---|
| budget | LTX-2 Fast `fal-ai/ltx-2/text-to-video/fast` (1080p) | $0.04 | **9 cr** ($0.90) | **12 cr** ($1.20) |
| standard | Sora 2 std `fal-ai/sora-2/text-to-video` (720p) | $0.10 | **23 cr** ($2.30) | **28 cr** ($2.80) |
| premium | Sora 2 Pro `fal-ai/sora-2/text-to-video/pro` (720p) | $0.30 | **68 cr** ($6.80) | **84 cr** ($8.40) |

대안 후보(15초 천장이라 20초 불가 → 길이 규칙이 "15초 고정"일 때만 티어 편입 가능):
- Kling V3 Pro 15초 = 36 cr / Seedance 2.0 15초(720p) = 64 cr / LTX-2.3 std 20초 = 17 cr(저가 화질 상위).
- premium을 true1080p로 올리면 Sora 2 Pro 20초 = 196 cr($19.60) — 고가, 별도 결정.

주의: budget(LTX 1080p) > standard(Sora 720p) 해상도 역전처럼 보이나, Sora의 가치는 모션·오디오·일관성.
해상도 일관성을 원하면 standard=LTX-2.3 std(1080p, $0.06 → 16초 14cr/20초 17cr)로 교체 가능.

## 4. 30초 단일 가능? (질문 3 답)

**불가.** extend 체인 없이 모델 교체만으로는 **20초가 천장**. 30초를 고수하려면:
- (A) extend/스티치 체인 부활 — TK가 폐기 원한 방식, 워커 복잡도·비용·이음매 리스크.
- (B) 규칙을 15~20초로 내림 — **권장**, 모델 교체만으로 즉시.

## 5. 6/30 영향 범위 + 작업량

1. **model_catalog 행 교체** — veo3.1/veo3.1-fast `active=false`(FK 때문에 삭제 금지, 비활성만),
   신규 행 insert(ltx-2-fast/sora-2/sora-2-pro), `max_duration_seconds`=20, `min`=16(또는 규칙값).
   모델별 입력 파라미터(resolution/fps/aspect_ratio/generate_audio)는 **`metadata` jsonb에 저장**
   ([[feedback-no-hardcode]] 준수, 워커가 동적으로 읽음). SQL ~30분, 멱등.
2. **seasons 길이 파라미터 → 단일 규칙** — application_/main_round_ min·max를 동일값으로
   (현 4/8 → 16/20 등). 데이터 업데이트 1행, 스키마 변경 없음.
3. **워커 `fal.ts` 확장(유일한 실질 신규 코드)** — 현재는 `duration`만 전송. LTX는 resolution/fps/
   generate_audio, Sora는 resolution/aspect_ratio가 필요. `model_catalog.metadata`의 입력맵을
   머지해 전송하도록 수정. 중간 난이도, 반나절.
4. **스튜디오 UI 길이 검증** — 길이 셀렉터를 모델 enum에 맞춤(또는 **고정 길이로 셀렉터 제거**).
   `videoBoundsForRound`/S-7은 bound 동일값이면 자동 동작.
5. **라운드 분기 제거로 단순화** — `videoBoundsForRound`, main_round_video_*/application_video_*
   이원화가 무의미해짐. 단일 쌍(또는 단일 값)으로 축약 가능(비차단 클린업).
6. 크레딧/마진/비용가드: 변경 없음(마진 공식 자동).

**6/30 내 가능 여부: 가능(여유).** 핵심은 데이터(catalog+seasons) + 워커 입력맵 + UI 옵션.
신규 코드는 워커 입력 파라미터 머지 하나가 거의 전부. 잔여 19일 내 충분.

## 6. 결정 필요 (TK)

D1. **길이 규칙** — (A) 고정 20초[가장 단순, 셀렉터 제거] / (B) 16~20초 범위 / (C) 고정 16초 /
    (D) 30초 유지=extend 체인 부활. → "15초"는 LTX/Sora로 생성 불가하니 floor는 16초 권장.
D2. **티어 모델 확정** — 위 권장 사다리(LTX-2 Fast/Sora std/Sora Pro) 채택 여부, standard를
    LTX-2.3로 바꿀지, premium 해상도(720p vs true1080p).

D1 확정되면 마이그레이션 SQL + 워커 입력맵 + UI를 바로 작성한다.
