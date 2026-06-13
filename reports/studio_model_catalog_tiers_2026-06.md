# OXXOVO Studio — 모델카탈로그 3티어 확정 (720p+) + 마진 40% 크레딧표

작성: 2026-06-13 (지수2). 모든 수치 **fal.ai 공식 모델/API 스키마 페이지 실측**(추정 없음).
배경: 짜깁기(compose)로 단일 모델 길이 한계가 무의미해짐 — 어떤 모델이든 조합으로 30초.
따라서 길이보다 **화질·티어 다양성** 기준으로 3개 모델 선정. 전부 720p+ → 규칙경계 R1 충족.

## 1. 확정 라인업 (fal 공식 실측)

| 티어 | 모델 | fal_model_id | 초당 단가(오디오 ON) | 단일 max | 길이 enum | 해상도 | 오디오 |
|---|---|---|---|---|---|---|---|
| budget | LTX-2 Fast | `fal-ai/ltx-2/text-to-video/fast` | **$0.04** (1080p) | 20s | 6,8,10,12,14,16,18,20 | **1080p** | 네이티브 |
| standard | Sora 2 | `fal-ai/sora-2/text-to-video` | **$0.10** | 20s | 4,8,12,16,20 | **720p** | 네이티브 |
| premium | Kling V3 Pro | `fal-ai/kling-video/v3/pro/text-to-video` | **$0.168** | 15s | 3~15 정수 | **1080p** | 네이티브 |

입력 파라미터(워커가 `metadata.input_params`로 fal에 전달, 파라미터명 공식 확인):
- LTX-2 Fast: `resolution:"1080p"`, `fps:25`, `generate_audio:true` (>10s는 25fps/1080p 강제 — 항상 충족). aspect_ratio 파라미터 없음(16:9 네이티브).
- Sora 2: `resolution:"720p"`, `aspect_ratio:"16:9"` (오디오 네이티브, 토글 없음).
- Kling V3 Pro: `aspect_ratio:"16:9"`, `generate_audio:true` (해상도 파라미터 없음 = 1080p 네이티브, 미전송).

전부 **720p 이상** → R1(최저 해상도 캔버스) 바닥 720p 이상 보장.

## 2. 마진 40% 크레딧표 (라이브 platform_config 실측: margin=0.40, credit_usd_value=$0.10)

공식: `credits = ceil(원가USD x 1.40 / 0.10)` = `ceil(원가 x 14)`. **모델 바꿔도 마진 40% 자동 유지.**

| 모델 | $/s | 대표 길이별 크레딧 (= 참가자 차감, $1 cr=$0.10) |
|---|---|---|
| LTX-2 Fast | $0.04 | 6s=4cr / 10s=6cr / 16s=9cr / 20s=12cr ($1.20) |
| Sora 2 | $0.10 | 4s=6cr / 8s=12cr / 12s=17cr / 16s=23cr / 20s=28cr ($2.80) |
| Kling V3 Pro | $0.168 | 3s=8cr / 5s=12cr / 10s=24cr / 15s=36cr ($3.60) |

(예: Sora 20s = 2.0 x 14 = 28cr. Kling 15s = 2.52 x 14 = 35.28 → 36cr.)

## 3. Sora 2 확인 (TK 요청)

- **Deprecation/종료 공지: 없음.** fal 공식 Sora 2 t2v 페이지에 sunset/EOL/legacy 경고 없음(2026-06 실측).
  과거 "9/24 종료" 우려의 현재 근거 없음. 단 OpenAI 호스팅 모델이라 가용성 리스크는 상존 →
  짜깁기는 model-agnostic(`metadata` 데이터 교체만으로 스왑)이라 종료 시 LTX-2.3/Seedance 등으로 즉시 대체 가능.
- **콘텐츠 정책 강도(한 줄): 셋 중 가장 강함.** Sora 2는 실존 공인·저작권 캐릭터 likeness를 차단,
  위반 소지 프롬프트는 "may violate our guardrails"로 거부. OXXOVO(순수 AI 창작·IP/유명인 미사용)엔
  대체로 무해하나, 브랜드/연예인 시도는 standard 티어에서 거부될 수 있음. LTX/Kling은 상대적으로 관대.

## 4. 마이그레이션

- 옛 행 `ltx-video`/`veo3.1-fast`/`veo3.1` = `active=false`(FK 때문에 삭제 금지, 비활성만). 기존 generation_jobs 무영향.
- 신규 3행 UPSERT(`ON CONFLICT (id) DO UPDATE`, 멱등). `metadata.input_params`는 워커가 이미 소비(B에서 배선됨).
- 클린 SQL: `reports/_run/model_catalog_tiers.sql` (주석 0줄, TK Run).
- 길이 enum은 `metadata.durations`에 저장 → UI가 셀렉터를 모델별 enum으로 제한(워커는 min/max만 검증).

## 5. fal 공식 출처

- LTX-2 Fast: https://fal.ai/models/fal-ai/ltx-2/text-to-video/fast (+ /api)
- Sora 2 (t2v): https://fal.ai/models/fal-ai/sora-2/text-to-video (+ /api)
- Kling V3 Pro (t2v): https://fal.ai/models/fal-ai/kling-video/v3/pro/text-to-video (+ /api)
- Sora 콘텐츠 정책: https://openai.com/policies/creating-sora-videos-in-line-with-our-policies/
