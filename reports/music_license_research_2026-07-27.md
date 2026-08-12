# Studio 음악 v1 — 라이선스 조사 (2026-07-27, 지수2) · **개정 4판**

> **★4판 = Lyria 3 Pro 재조사 + fal 인벤토리 정본화. 결론 불변: ElevenLabs 직접 API.**
> 상세는 **§0-B**(4판, Lyria) → **§0-A**(3판, ElevenLabs) 순. 2판 이력은 그 아래 보존.

---

# §0-B. Lyria 3 Pro 재조사 + fal 경유 최종 판정 (4판)

## 먼저 — ①은 정정할 게 없습니다

3판에서 저는 **"fal에 있습니다(`fal-ai/elevenlabs/music`, $0.80/분)"** 라고 명시했습니다.
직접 API를 권한 이유는 "fal에 없어서"가 아니라 **⑴권리 근거 ⑵비용** 둘이었습니다. 그 판단은 유지되며,
아래에서 **Lyria에도 똑같은 구조적 공백**이 있음을 확인했습니다.

## fal 음악 모델 인벤토리 — 정본 (fal 공개 모델 API 직접 조회)

fal 웹은 오늘 내내 **Vercel Security Checkpoint(429)** 로 봇을 차단해서, **fal의 공개 모델 API**
(`https://fal.ai/api/models?categories=text-to-audio`)를 직접 호출해 확보했습니다. 음악 관련 발췌:

| fal model id | 제공자 | hostingType |
|---|---|---|
| `fal-ai/lyria3/pro` | Google | **proxy** |
| `fal-ai/lyria3` | Google | proxy |
| `fal-ai/lyria2` | Google | proxy |
| `fal-ai/elevenlabs/music` | ElevenLabs | **proxy** |
| `sonilo/v1.1/text-to-music` | Sonilo | proxy |
| `fal-ai/minimax-music/v2.6` ·`/v2.5` ·`/v2` ·`/v1.5` | Minimax | proxy |
| `fal-ai/stable-audio-3/medium/text-to-audio` 외 3종 | Stability AI | serverless |
| `fal-ai/stable-audio-25/text-to-audio` · `fal-ai/stable-audio` | Stability AI | serverless |
| `cassetteai/music-generator` | Cassette AI | serverless |
| `fal-ai/ace-step` · `fal-ai/diffrhythm` | (오픈웨이트) | serverless |

**★확인 1 — Lyria 3 Pro는 fal에 실재합니다.** 대표님 말씀이 맞습니다.
**★확인 2 — 단가는 $0.04가 아니라 $0.08입니다.** $0.04는 **Lyria 3 Clip**(30초) 요금이고,
**Lyria 3 Pro는 $0.08/audio**입니다. (fal 요금 페이지는 429로 직접 확인 불가 — **2차 출처**.)
우리 베드는 30~40초라 Clip($0.04)으로도 충분합니다.

**★확인 3 — fal의 `licenseType: "commercial"` 태그는 권리 보증이 아닙니다.**
fal API는 **위 40개 모델 전부**를 `commercial`로 표시합니다. ACE-Step·DiffRhythm 같은
학습데이터 미보증 오픈웨이트까지 포함해서요. **fal의 카탈로그 분류일 뿐, 제공자가 우리에게
상업권을 준다는 뜻이 아닙니다.** 이 태그를 근거로 쓰면 안 됩니다.

---

## Lyria 3 Pro — Google 약관 원문 4건

### ⓵ 상업 사용·제3자 배포 = **허용됨** (Pre-GA 제한의 면제 대상)

Google Cloud *Supplementary Terms for Generative AI Preview Products* 원문:

> *"Unless permitted by Google in writing…, Customer will ensure that Customer and its End Users
> will only use a Generative AI Preview Product for evaluation and testing purposes, and will not:
> **use a Generative AI Preview Product for commercial or production purposes; or disclose Generated
> Output to a third party.**"*

기본값은 **상업 사용 금지 + 제3자 공개 금지**입니다. 그런데 바로 아래에 면제 목록이 있고,
**Lyria가 거기 들어 있습니다**:

> *"The Additional Use Restrictions above **do not apply to Gemini Enterprise Agent Platform
> (formerly Vertex AI) when used with these Pre-GA Offerings**: … Imagen 4.0 upscale,
> **Lyria 3 Clip**, **Lyria 3 Pro**, Veo 3.1 Lite, WeatherNext"*

→ **상업 사용 OK, 참가자(제3자)에게 제공 OK.** 요건 ①③④ 충족.
**★단 면제의 범위가 "Gemini Enterprise Agent Platform(구 Vertex AI)에서 사용할 때"로 명시 한정됩니다.**

### ⓶ 매출조건 = **없음**

Google 약관 어디에도 매출 캡·기업규모 임계가 없습니다. 대표님 판단대로입니다. (요건 ③ 충족)

### ⓷ ★**Google 면책(indemnity) 없음** — 두 겹으로

- Google Cloud *Service Specific Terms* §5 원문:
  > *"Pre-GA Offerings (i) may be changed, suspended or discontinued at any time without prior notice
  > to Customer and (ii) **are not covered by any SLA or Google indemnity**."*
  Lyria 3 Pro는 `lyria-3-pro-preview` = **public preview(Pre-GA)** → **면책 제외.**
- *Generative AI Indemnified Services* 목록 (2026-07-20 최종 수정) 원문:
  > *"Gemini Enterprise Agent Platform API (formerly Vertex AI API) used with **generally available
  > versions** of these foundation models: - Codey - Gemini - Imagen - PaLM - **Veo**"*
  **Lyria는 목록에 아예 없습니다**(Veo는 있는데 Lyria는 없음). 페이지 전문 검색 결과 "Lyria" 0건.

→ **Google이 자랑하는 저작권 면책이 Lyria에는 적용되지 않습니다.** ElevenLabs와 가장 크게 갈리는 지점.

### ⓸ 학습데이터 = "라이선스 학습"이라 부르기엔 약함

Google Cloud 블로그 원문:
> *"…using materials that **YouTube and Google has a right to use under our terms of service,
> partner agreements, and applicable law**."*

이건 Merlin/Kobalt처럼 **권리자가 opt-in하고 로열티를 받는 구조가 아니라**, "YouTube 이용약관상
우리에게 사용할 권리가 있다"는 주장입니다. **그리고 바로 그 지점을 두고 인디 아티스트들이
"YouTube 카탈로그로 Lyria 3를 학습시켰다"며 Google을 제소해 계류 중**입니다.
→ 요건 ②(진짜 라이선스 클린)는 **ElevenLabs보다 명백히 약합니다.**

부수: 모든 Lyria 출력에 **SynthID 워터마크 + C2PA** 삽입 (*"All Lyria 3 and Lyria 3 Pro outputs are
embedded with SynthID watermarking and support C2PA."*).

---

## ★fal 경유 판정 — 두 모델 다 **미문서**. 구조가 똑같습니다.

| | 상업권 조항이 누구에게 쓰였나 | fal 경유 승계 |
|---|---|---|
| ElevenLabs | *"If **Customer is on a Starter, Creator, Pro, Scale, or Business Plan**…"* → **플랜 보유 전제** | **미문서** |
| Lyria 3 | 면제가 *"**Gemini Enterprise Agent Platform (formerly Vertex AI)** when used with…"* → **Vertex 사용 전제** | **미문서** |

**둘 다 "제공자의 직접 고객"을 전제로 쓰인 조항입니다.** fal은 `hostingType: proxy` — 제공자 API로
중계할 뿐이고, **양쪽 약관 어디에도 "제3자 플랫폼 경유 시에도 동일 권리"라는 문구가 없습니다.**

**→ 대표님 질문에 대한 정직한 답: "매출조건 없이 상업 클린 + fal 경유"를 실제 약관 근거로
증명할 수 있는 모델은 — 현재 문서상 없습니다.** fal 문의로 서면을 받거나, **제공자 직접 계약으로
공백을 닫는 것** 둘 중 하나입니다.

### 공백을 닫는 비용이 갈립니다

| | 직접 경로 | 가능 여부 | 단가 | 면책 | provenance |
|---|---|---|---|---|---|
| **ElevenLabs** | 계정+플랜 구독 | **즉시 가능** | **$0.15/분 공개** | — | **Merlin+Kobalt opt-in·50/50** |
| **Lyria 3** | Google Cloud 계정 + Vertex AI | 가능하나 무거움 | **미공개**(엔터프라이즈 협의) | **없음(Pre-GA)** | YouTube ToS 근거 + **소송 계류** |

---

## ★단가 20배 차이 — 비교 기준이 잘못됐습니다

대표님이 말씀하신 20배는 **fal 경유 ElevenLabs($0.80/분)** 기준입니다.
그런데 우리가 채택하기로 한 건 **직접 API($0.15/분)** 입니다. 같은 기준(40초 베드 1개)으로:

| 경로 | 40초 베드 1개 | 최악 5,000건 |
|---|---|---|
| fal ElevenLabs | $0.80 (분 올림) | $4,000 |
| **ElevenLabs 직접** | **$0.10** | **$500** |
| fal Lyria 3 Clip(30초) | $0.04 | $200 |
| fal Lyria 3 Pro | $0.08 | $400 |

**실제 격차는 20배가 아니라 2.5배이고, 시즌 전체로는 $300 차이입니다.**
상금 풀 $3,000 대비 10%, 참가자 크레딧으로 환산하면 1인당 **$0.60** 수준입니다.
**그 $300을 아끼려고 면책 없음 + 소송 계류 중인 provenance를 사는 건 수지가 안 맞습니다.**

## 후보 3개 최종 비교 (요구하신 형식)

| | ①t2m | ②출력 상업권 근거 | ③매출조건 | ④fal 경유 | 면책 | 학습데이터 | 단가(40초) |
|---|---|---|---|---|---|---|---|
| **Lyria 3 Pro** `fal-ai/lyria3/pro` | ✅ | ✅ **명시 허용**(Pre-GA 면제) — **단 Vertex 한정** | ✅ **없음** | ⚠️ **미문서** | ❌ **없음**(Pre-GA·목록 미포함) | ⚠️ YouTube ToS 근거·**소송 계류** | $0.08 (Clip $0.04) |
| **ElevenLabs Music** | ✅ | ✅ **플랜 결속**(Starter+) | ✅ **없음** | ⚠️ **미문서** | — | ✅ **Merlin+Kobalt opt-in·50/50** | **$0.10**(직접) / $0.80(fal) |
| Stable Audio | ✅ | ⚠️ Community License | ❌ **>$1M Enterprise** | serverless | — | ✅ 정식 데이터셋 | $0.20 |

## 결론 — **ElevenLabs 직접 API 유지 (변경 없음)**

- **Lyria가 이긴 축**: 단가(2.5배 싸다), 매출조건 없음(동률).
- **Lyria가 진 축**: **면책 없음**(ElevenLabs는 계약된 권리자 풀), **provenance 소송 계류**,
  **fal 경유 승계 미문서**(동률), **직접 경로의 가격이 미공개**.
- 우리 사업은 **상금 대회 + 참가자 수익화 + $1M+ 목표**입니다. 여기서 **$300을 아끼려고
  저작권 리스크를 사는 선택**은 권하지 않습니다.
- **Lyria를 쓰려면** 조건은 하나입니다 — **fal이 아니라 Vertex AI 직접**(면제 조항이 그렇게 쓰여 있음).
  그런데 그 경로는 가격 미공개 + Google Cloud 계정 + 여전히 면책 없음이라, ElevenLabs 직접보다
  **더 무겁고 덜 안전**합니다.

**→ §0-A(ElevenLabs 직접 API, Scale $299/월) 그대로 진행 권고. provider 착수 준비 완료.**

---
---

# §0-A. ElevenLabs Music 확정 결과 (TK 지시 2문항 답변)

## 먼저 — 제 2판 판정 정정

2판에서 저는 ElevenLabs를 "**100 outputs / 재배포 조항으로 구조 충돌 → 부적합**"으로 판정했습니다.
**이 판정은 틀렸습니다.** 아카이브 요약본만 보고 **"offline" 한정어를 놓쳤습니다.** 현행 약관 원문:

> *"offline (i.e., not on the internet or a mobile app) television or radio programs, films, other
> visual media, live broadcasts, or advertisements."*

괄호의 **"(i.e., not on the internet or a mobile app)"가 목록 전체를 한정**합니다. 즉 금지 대상은
**오프라인** 배포이고, **우리처럼 웹사이트에 공개하는 온라인 영상은 여기에 해당하지 않습니다.**
대표님/제니2 판단이 맞았습니다.

---

## Q1. 어느 티어부터 상업 사용 가능한가 / 우리가 쓸 티어와 비용

**A. 상업 라이선스는 `Starter`($6/월)부터. Free는 상업 사용 불가.**
공식 API 요금 페이지 문구: **"Commercial use licensing on Starter+ plans"**.

**★중요: Starter~Business는 상업 권리가 전부 동일합니다.** 티어가 올라가도 권리가 늘지 않고
**포함 분량(minutes)만 늘어납니다.** 그래서 **티어 선택은 라이선스가 아니라 물량 문제**입니다.

**Starter / Creator / Pro / Scale / Business 공통 금지 3종** (현행 Model-Specific Terms 원문):
1. **오프라인** TV·라디오 프로그램, 영화, 기타 시각매체, 생방송, **광고** — *(온라인은 해당 없음)*
2. 컨퍼런스·엑스포·콘서트 등 **high-traffic public events**
3. **100개 초과 Output의 music library/repository를 만들어 제3자에게 라이선스·배포**하는 것

**Enterprise만 다른 점**: 1·2번 금지가 **없어지고**, 3번(100개 초과 라이브러리)과
**스트리밍 플랫폼 배포**(Spotify/Apple Music/Amazon Music/Pandora)만 금지됩니다.

**→ 우리 판정**: 우리 용도(웹 공개 영상의 사운드트랙)는 **Starter+ 로 충분**. Enterprise 불필요.

**매출조건**: **없습니다.** Starter~Business 어디에도 매출 임계·기업규모 조건 조항이 없습니다.
(Stable Audio의 $1M 같은 게이트가 없음 — 요건 ③ 충족 확정.)

**학습데이터**: **Merlin**(독립 레이블 라이선싱 연합) + **Kobalt**(세계 최대 독립 퍼블리셔) 정식 계약.
**권리자 opt-in 방식**, 학습 기여도·인기도 비례 로열티, **50/50 분배**. Suno/Udio의 무단학습 소송과
대조되는 licensing-first 구조 — 요건 ② 충족. (2025-08-05 ElevenLabs 공식 발표)

### 우리가 쓸 티어 — 물량 기준 산정

실측 파라미터: `season_0.max_applicants = 500`, `studio_compose_max_seconds = 40`.
음악 생성 캡(`studio_music_gen_max_per_user`)은 **아직 platform_config에 미설정** — 10 가정.

| 시나리오 | 생성 건수 | 총 분량 | **직접 API 비용** | 권장 플랜 |
|---|---|---|---|---|
| 보수 (1인 평균 3회) | 1,500 | 1,000분 | **$150** | Creator $22 (147분 포함) + 초과분 |
| 중간 (1인 평균 5회) | 2,500 | 1,667분 | **$250** | Scale $299 (1,993분 포함) |
| 최악 (캡 10 전원 소진) | 5,000 | 3,333분 | **$500** | Scale $299 + 초과 or Business $990 |

직접 API 단가 **$0.15/분**. 플랜별 포함 분량: Starter $6=40분 / Creator $22=147분 /
Pro $99=660분 / Scale $299=1,993분 / Business $990=6,600분.
**권장: Scale($299/월)로 시작.** 시즌 실사용 보고 조정.

---

## Q2. fal 경유해도 상업 권리가 유지되나? — **★직접 API를 권합니다**

**fal에 있습니다**: `fal-ai/elevenlabs/music`. 하지만 **직접 API가 두 가지 이유로 명백히 낫습니다.**

### 이유 1 — 라이선스 근거가 직접 API에만 확실히 존재

ElevenLabs의 상업 권리 체계는 **전부 "Customer의 플랜"에 결속**돼 있습니다
("If Customer is on a Starter, Creator, Pro, Scale, or Business Plan…"). **fal 경유로는 우리가
ElevenLabs의 Customer가 아니고 플랜도 없습니다.** 어느 플랜의 권리가 우리에게 붙는지 규정이 없습니다.

게다가 ElevenLabs 약관의 **Reseller 정의**가 fal을 정면으로 가리킵니다:
> *"…acts as a **model aggregator** by offering ElevenLabs' Models alongside third-party models with
> minimal or no modification, enhancement, or integration, essentially providing a marketplace or
> directory of AI models."*

fal이 정확히 그것입니다. Reseller 경로에는 별도의 co-branding 의무(*"powered by ElevenLabs"*)와
OEM 조건이 붙습니다 — **우리에게 어디까지 전가되는지 공개 문서에 없습니다.**

**→ 직접 API를 쓰면 우리가 명시적으로 "Starter+ 플랜의 Customer"가 되어 이 불확실성이 통째로 사라집니다.**
대표님이 짚으신 *"직접 API를 써야 상업 권리가 확실한가"* — **네, 그렇습니다.**

### 이유 2 — 비용이 5배 이상 차이

| 경로 | 단가 | 과금 방식 | 최악 시나리오(5,000건×40초) |
|---|---|---|---|
| fal `fal-ai/elevenlabs/music` | **$0.80 / 분** | **분 단위 올림**(30초도 1분) | **$4,000** |
| **ElevenLabs 직접 API** | **$0.15 / 분** | 실사용 분 | **$500** |

단가 5.3배 + fal은 **분 단위 올림**이라 40초 클립이 1분으로 과금됩니다. 실질 격차는 **약 8배**.

### 결론

**ElevenLabs 직접 API 채택.** 라이선스가 확실하고 비용도 8배 싸므로 fal을 경유할 이유가 없습니다.
(영상 생성은 fal 유지 — 음악만 별도 경로.)

---

## ★TK님 손이 필요한 것 (직접 API라서)

1. **ElevenLabs 계정 생성** — 회사 명의(OXXOVO Labs Inc.) 권장. 개인 계정이면 나중에 이관 번거롭습니다.
2. **플랜 구독** — **Scale $299/월 권장** (보수적으로 가려면 Creator $22로 시작해 초과분 과금도 가능).
   ★**Free는 상업 사용 불가**이므로 반드시 유료 플랜.
3. **API 키 발급** → 저에게 값 전달 금지. **Vercel env + Railway 워커 env에 직접 입력**해 주세요
   (키 이름은 제가 확정해서 안내드리겠습니다). 화면 출력 금지 규칙 유지.
4. **금지 업종 확인** — 총기·담배·의약품·성인물·종교단체·정치 6개 업종은 서비스 이용 자체가 금지입니다.
   우리(화장품 CF 대회)는 해당 없음. 단 **향후 시즌 주제가 이 업종에 걸리면 사용 불가**입니다.

## ★운영상 짚어둘 것 2건 (블로커 아님, 정책 결정 필요)

1. **수상작을 오프라인 광고/TV에 쓰면 위반입니다.** Starter~Business는 *오프라인* TV·영화·광고 배포가
   금지입니다. 시즌0 주제가 **화장품 CF**라 수상작을 실제 TV 광고로 집행하는 시나리오가 생길 수 있는데,
   그 경우 **Enterprise 플랜이 필요**합니다. → 대회 규정/수상자 이용약관에 **"온라인 공개 한정"**을
   명시하거나, 오프라인 집행 계획이 있으면 Enterprise로 올려야 합니다.
2. **"100개 초과 Output 라이브러리" 조항.** 정의는 *"library, catalogue, database, or other repository
   of Output **with the intent of licensing it or otherwise making it available to third parties**"*.
   - 참가자 개인 생성물(생성자 본인만 사용) → 제3자 제공 아님, 해당 없음.
   - **우리가 만들려던 "플랫폼 라이브러리 8곡"** → 참가자(제3자)에게 제공하는 repository가 맞지만
     **8개라 100 미만**이므로 현재 계획은 안전.
   - **→ 라이브러리 곡 수를 100개 미만으로 유지**하는 것을 설계 제약으로 못박습니다.

## 요건 대조 최종

| 요건 | ElevenLabs Music (직접 API, Starter+) |
|---|---|
| ① text-to-music | ✅ 장르·템포·악기·언어·구간별 스타일 지정 |
| ② 출력물 상업 사용 클린 | ✅ Merlin+Kobalt 정식 라이선스·opt-in·로열티 50/50 |
| ③ 매출조건 없음 | ✅ **조항 없음** |
| ④ 재배포(참가자 제공) | ✅ 온라인 한정이면 허용 (오프라인 광고·TV만 Enterprise) |
| 단가 | $0.15/분 (fal 경유 $0.80/분 대비 5.3배 저렴) |

**→ 4개 요건 전부 충족. 채택 확정 가능. provider 구현 착수 가능합니다**(계정·키 확보 후).

---
---

# (이하 2판 조사 이력 — 보존)


요건 (TK 확정): **① text-to-music ② 출력물 상업사용 클린 ③ 매출조건(revenue cap) 없음**
우리 구조: 플랫폼 계정이 fal 키 보유 → 서버사이드 생성 → R2 저장 → 참가자 영상에 믹싱 →
Watch 공개 → **상금 대회 출품물(수익화)**. 참가자는 fal을 직접 접하지 않음(중개 구조).
회사 연매출은 **$1M 초과 가능**.

> **2판 변경점**: MusicGen 2차 원본 재확인 / **Sonilo 전제 정정(text-to-music 존재)** /
> **Sonauto V2 신규 후보 발굴** / ElevenLabs fal 단가·차단조항 확정 / Lyria 권리흐름 규명 /
> Apache-2.0 오픈웨이트 3종 추가 / fal 문의 문안 확장(6→8문항).

---

## 0. 결론 (정직하게)

**질문을 두 가지로 쪼개야 정확한 답이 나옵니다.**

**Q1. "text-to-music + 출력물 상업사용 명시 허용 + 매출조건 없음" 모델이 있는가?**
→ **있습니다. 하나가 아니라 여럿입니다.**
`Sonilo v1.1` · `Sonauto V2` · Apache-2.0 오픈웨이트 3종(`ACE-Step`/`YuE`/`DiffRhythm`).
이들은 **매출 캡 조항이 아예 없습니다.** (Stable Audio의 $1M 같은 조항이 없음)

**Q2. 거기에 "학습데이터 라이선스가 보증된 진짜 클린"까지 요구하면?**
→ **Sonilo 하나만 남습니다.** 그리고 그 하나도 **fal 경유 시 어느 tier가 적용되는지가 약관에 없어**
100% 확정이 안 됩니다.

**→ 그래서 대표님 판단(③번)이 맞습니다. fal 문의가 결국 답입니다.**
다만 문의는 "Stable Audio의 $1M을 fal이 흡수하나"만 물으면 부족하고,
**Sonilo tier 귀속 + Sonauto/Lyria 권리흐름까지 한 번에** 물어야 합니다. 문안은 §4.

**교훈 반영**: "MIT/오픈소스 = 상업 클린"은 함정이 맞습니다. 다만 이번 조사에서 **함정이 하나 더**
나왔습니다 — **매출조건이 없어도 "제3자(참가자)에게 제공" 조항에서 막히는 경우**(ElevenLabs).
그래서 이번 판부터 축을 **4개**로 봅니다: ①t2m ②가중치/출력 라이선스 ③매출조건 ④**재배포 구조**.

---

## 1. MusicGen — 재확인 완료, **부적합 확정**

대표님 지적대로입니다. **원 소스 2건**으로 굳혔습니다.

- **Meta 공식 audiocraft README** (원문):
  > *"The code in this repository is released under the MIT license as found in the LICENSE file."*
  > *"The models weights in this repository are released under the CC-BY-NC 4.0 license as found in the LICENSE_weights file."*
- **MUSICGEN_MODEL_CARD.md** (원문): *"model weights are released under CC-BY-NC 4.0"*

**음악을 만드는 건 가중치이고 그게 NonCommercial입니다.** 상금 대회 출품물에 못 씁니다.
덧붙여 **fal에 MusicGen 엔드포인트 자체가 확인되지 않습니다**(fal의 음악 모델 소개에 미등장) —
쓰고 싶어도 우리 파이프라인에 못 넣습니다. **이 선은 닫힘. 착수 없음.**

*(오전 1판에서도 동일 결론이었습니다 — "MIT라 조건 없음"은 제 결론이 아니라 조사 착수 시점의
가설이었고, 조사 결과 반증됐습니다. 재확인해도 같습니다.)*

---

## 2. ★Sonilo 전제 정정 — **text-to-music 있습니다** (video-to-music 전용 아님)

대표님 지시문의 "Sonilo는 video-to-music만"은 사실과 다릅니다. **원 소스 2건**:

1. **Sonilo 공식 PR (PR Newswire, 2026-06-22)** — fal 엔드포인트를 **두 개** 명시:
   - `fal.ai/models/sonilo/v1.1/video-to-music`
   - **`fal.ai/models/sonilo/v1.1/text-to-music`**
   원문: *"Sonilo's text-to-music model is also available on the platform for those who prefer to
   work from a prompt, including segment-level controls that let creators define different musical
   styles, moods and structures across sections of a track."*
2. **Sonilo 자사 사이트 요금표** — 생성 모드 4종 중 **"Text-to-Music — 5 credits / output second"**
   (Video-to-Music / Video-to-SFX / **Text-to-Music** / Text-to-SFX).

즉 **요건 ①은 충족**입니다. 7/24 세션 실측치(모델 id `sonilo/v1.1/text-to-music`, duration 기본 90초·
최대 600초, 출력 AAC/m4a, **$0.0025/초/샘플** → 30초 ≈ $0.075)와도 일치합니다.

**Sonilo 약관 실측 (원문 확인):**
- 출력 소유권: *"As between you and Sonilo … Sonilo assigns to you any rights we may have in the
  Outputs generated for your account."*
- tier: Free = *"Outputs are for personal, experimental, and other non-commercial use only."* /
  Pro = *"Commercial use of Outputs generated under that tier is permitted, subject to these Terms."*
- **매출 캡 / 기업규모 조건: 전문에 없음.** (요건 ③ 충족)
- 학습데이터: *"trained on professionally licensed content, including Shutterstock's music catalog,
  with musicians compensated"* (요건 ② — 조사 대상 중 **유일하게 보증된 provenance**)

**남은 공백 2건 (이게 문의 대상):**
1. 약관이 **"your account"의 tier**로 권리를 정의하는데 **우리는 Sonilo 계정이 없고 fal 고객**이다.
   fal 경유 출력이 Pro 상당인가?
2. 개발자 자료의 **"Tier 3 / end-user redistribution"은 약관 본문에 없는 마케팅 문구**다.
   계약 근거로 못 쓴다.

---

## 3. 후보 재훑기 (대표님 지시 1~4)

### 3-1. ElevenLabs Music (지시 ①) — **매출조건은 없으나 우리 구조에서 차단**

- **fal 엔드포인트**: `fal-ai/elevenlabs/music`. **단가 $0.80 / 출력 1분**, **분 단위 올림 과금**
  (30초 생성도 1분 = $0.80). 대표님 말씀하신 단가 맞습니다.
  → 참고: 30초 베드 기준 **Sonilo($0.075)·Sonauto($0.075) 대비 약 10배**. 재생성 캡 10회를
  감안하면 참가자 1인당 최대 $8, 500명이면 최대 $4,000. **비용만으로도 부담.**
- **현행 `music-terms`**: 매출 임계 **없음**. 대신 금지 업종(총기·담배·의약품·성인물·종교·정치)과
  프롬프트 금지(아티스트명·곡명·레이블명·가사 상당부분, 실연자 음성/likeness 모방)가 있음.
  → 우리 `findImitation` 흉내차단이 이미 대응하는 범위와 겹침(설계 방향은 맞았음).
- **★차단 조항 (Archived Eleven Music v1 Terms, 원문)**:
  - Free = *"prohibited from using Outputs for any commercial purpose"*
  - Starter/Creator/Pro/Scale/Business = **"music libraries exceeding 100 outputs for third-party
    distribution"** 금지
  - *"Making Available (as defined in the OEM Terms) the Service or Output to any third-party for
    use in a manner that would violate this section."*
- **판정**: 우리 구조 = 플랫폼이 생성해 **참가자(제3자)에게 제공**. 정원 500 시즌이면 출력이 100을
  훌쩍 넘음. → **OEM/Enterprise 별도 계약 없이는 정면 충돌.** 매출조건이 없어도 **부적합.**
  (마케팅/광고/영화/TV/게임/enterprise distribution도 별도 라이선스 요구.)

### 3-2. Google Lyria 2 (지시 ②) — **fal에 있음. 단 권리 근거가 우리에게 안 흐름**

- **fal에 있습니다**: `fal-ai/lyria2`, **$0.10 / 30초**.
- **매출조건**: 공개된 매출 캡 **없음**.
- **★문제는 권리의 출처**: Lyria의 상업 사용 허용과 **저작권 indemnification(면책)은
  Google Cloud / Vertex AI 고객 약관에서 나옵니다.** *"Google offers copyright indemnification for
  covered generative AI services and watermarks all output with SynthID."*
  **우리는 fal 고객이지 Google Cloud 고객이 아닙니다.** fal 경유 Lyria 출력에 그 상업권·면책이
  그대로 따라오는지는 **공개 문서에 없습니다.** (fal에도 Google에도 명시 없음)
- **추가 리스크**: 인디 아티스트들이 "YouTube 카탈로그로 Lyria 3를 학습시켰다"며 **Google 제소 계류 중** —
  provenance가 현재 분쟁 대상.
- 부수: 출력에 **SynthID 워터마크**가 박힘(우리 Genesis Rule/무결성 채점과의 상호작용 별도 검토 필요).
- **판정**: 매출조건은 없으나 **권리 근거 미확인 + 소송 리스크**. **fal 문의 문항에 포함**(§4 Q6).

### 3-3. Stable Audio — **fal이 $1M을 흡수하는가?** (지시 ③)

- Stability AI Community License 원문: *"You only need a paid Enterprise license if your yearly
  revenues exceed USD $1M and you use Stability AI models in commercial products or services."*
- **우리가 아는 것**: fal ToS의 **Third Party Models** 조항은 제3자 API 경유 모델 사용을 고지할 뿐,
  **fal 요금이 모델 제공자의 라이선스 조건을 대납/흡수한다는 문구는 없습니다.** 오히려 출력 보증을
  명시적으로 부인합니다 — *"Company does not represent or warrant that any Output Content will be
  original, will not infringe rights of any third party … or otherwise entitle Client to any
  Intellectual Property Rights in any Output Content."*
- **→ 현재 근거로는 "흡수 안 한다"가 유력하지만, 이건 fal이 직접 답해야 하는 문항입니다.**
  (오늘 fal.ai 원문 재확인은 **HTTP 429 반복 차단** — 위 인용은 검색 캐시 경유. §4 Q1이 이걸 닫습니다.)
- **판정 유지: 부적합** (fal이 "흡수한다"고 서면 회신하지 않는 한).

### 3-4. fal의 나머지 text-to-music 전부 (지시 ④)

fal이 공식적으로 소개하는 음악 모델군: **MiniMax Music 2.0 · ACE-Step · Sonauto V2 · Lyria 2 ·
ElevenLabs Music** (+ Sonilo v1.1 · Stable Audio · CassetteAI). 각각 **출력물 상업권** 기준으로:

#### ★Sonauto V2 — 신규 후보. 매출조건 없음 + 출력 소유권 명시 (요건 ②는 미보증)

- **fal**: `sonauto/v2/text-to-music` (+ `/extend`, `/inpaint`). **$0.075 / 생성**,
  **생성당 고정 1.5분**, 44.1kHz·16bit. (우리 30~40초 베드는 트림해서 사용 가능)
- **약관 §8 (Output)**: *"We hereby assign to You all our right, title, and interest, if any, in and
  to Your Outputs"* — **모든 tier(무료 포함) 상업권**, **매출 캡 없음**, 상업 사용에 **attribution
  불필요**.
- **★단, 우리에게 걸리는 조건 2개**:
  1. **API 위에 만든 user-facing 앱은 Sonauto 크레딧(attribution) 표기 필요.** 우리가 정확히 그 경우.
     → 표기 자체는 수용 가능하나 **UI 고지 작업이 추가**됨.
  2. **출력물 보증 부인**: *"makes no warranties or representations regarding the Outputs, including
     as to their copyrightability or legality"* → **요건 ②(진짜 클린) 미보증.**
- **학습데이터 provenance: 공개 자료 없음.** 라이선스 취득 주장도, 데이터셋 공개도 확인 안 됨.
  (참고: Suno/Udio는 무단 학습 소송·유출 이슈가 실재 — 미공개 provenance는 실제 리스크입니다.)
- **원문 확인 한계**: sonauto.ai/tos 는 현재 **treblo.com 으로 301 리다이렉트되고 403으로 봇 차단**.
  위 §8 인용은 **검색 캐시 경유이며 1차 원문 직접 확인 실패**. → **대표님이 브라우저로 열어
  §8 원문 확인 필요** (또는 §4-3 문의).
- **판정**: **Q1 기준으로는 통과하는 실질 후보.** Sonilo가 막히면 **2순위.** 단 ②는 보증 없음.

#### ACE-Step / YuE / DiffRhythm — 오픈웨이트, **가중치까지 Apache-2.0**

MusicGen 함정과 **정반대 케이스**입니다. 코드만이 아니라 **가중치도 Apache-2.0**이라 매출조건·
비상업 제한이 **없습니다**.
- **ACE-Step** (`fal-ai/ace-step`, **$0.0002/초** — 최저가): HF 모델카드 `License: apache-2.0`.
- **YuE**: Apache-2.0. GitHub이 **출력물의 상업적 사용을 명시적으로 권장** —
  *"artists and content creators are encouraged to freely incorporate outputs … including
  commercial projects."*
- **DiffRhythm / DiffRhythm2**: 코드·가중치 모두 Apache-2.0.
- **그러나 요건 ② 미충족**: 세 모델 모두 **학습데이터 출처 보증이 없고** 책임을 사용자에게 넘깁니다.
  ACE-Step 모델카드는 라이선스 대신 윤리 가이드라인만 줍니다 — *"Verify originality of generated
  works"*, *"Respect cultural elements and copyrights"*.
  **Apache-2.0은 가중치의 라이선스일 뿐, 출력물이 제3자 저작권을 침해하지 않는다는 보증이 아닙니다.**
- **판정**: **매출조건 없는 t2m이 실재한다는 증거**이지만, 상금 대회 출품물의 사운드트랙으로는
  provenance 리스크가 큼. **채택 비권장**(Sonilo·Sonauto 둘 다 막힐 때의 3순위).

#### MiniMax Music 2.0 — **근거 부재, 제외**

검색되는 MiniMax 약관은 **"AI App and Web"용**이고 **개발자 API용 영문 상업조항이 확인되지 않습니다.**
app/web 약관은 오히려 MiniMax에 광범위한 영구 라이선스를 주는 구조라 API로 전용할 수 없습니다.
→ **추측 금지 원칙상 제외.** 쓰려면 MiniMax에서 개발자 API 계약서를 직접 받아야 합니다.

#### CassetteAI — 1차 약관 미확인, **보류**

fal 연동 있음, "Pro Plan includes a commercial use license", 학습데이터는 *"publicly available **or**
licensed material"* — *publicly available*이 섞여 있어 요건 ② 미충족 가능성. **1차 약관 미확인.**

---

## 4. 비교표 (4축)

| 모델 (fal id) | ①t2m | ②출력 상업권 근거 | ③매출조건 | ④재배포(우리 구조) | 데이터 보증 | 단가(30초 기준) | 판정 |
|---|---|---|---|---|---|---|---|
| **Sonilo v1.1** `sonilo/v1.1/text-to-music` | ✅ | ✅ ToS 양도 | ✅ **없음** | ⚠️ tier 귀속 미기재 | ✅ **Shutterstock 등 정식** | **$0.075** | **★1순위·문의로 확정** |
| **Sonauto V2** `sonauto/v2/text-to-music` | ✅ | ✅ ToS §8 양도 | ✅ **없음** | ✅ (앱 attribution 필요) | ❌ 미공개·보증 부인 | **$0.075**(1.5분 고정) | **2순위** |
| ACE-Step `fal-ai/ace-step` | ✅ | ✅ Apache-2.0 가중치 | ✅ 없음 | ✅ | ❌ 없음 | **$0.006** | 3순위(리스크) |
| YuE / DiffRhythm | ✅ | ✅ Apache-2.0 가중치 | ✅ 없음 | ✅ | ❌ 없음 | — | 3순위(리스크) |
| ElevenLabs Music `fal-ai/elevenlabs/music` | ✅ | ⚠️ 플랜별 | ✅ 없음 | ❌ **100 outputs / OEM 차단** | ✅ 아티스트 opt-in | **$0.80**(분 올림) | ❌ 구조충돌+고가 |
| Stable Audio 2.5 | ✅ | ⚠️ Community License | ❌ **>$1M Enterprise** | ⚠️ 고지의무 | ✅ 정식 데이터셋 | $0.20 | ❌ (fal 흡수 여부 문의) |
| Lyria 2 `fal-ai/lyria2` | ✅ | ⚠️ **Google Cloud 약관發 — fal 경유 미문서** | ⚠️ 없음(추정) | ⚠️ 미문서 | ⚠️ **소송 계류** | $0.10 | ❌ 권리근거 미확인 |
| MiniMax Music 2.0 | ✅ | ❌ API 조항 부재 | ⚠️ | ⚠️ | ⚠️ | — | 제외(근거 없음) |
| CassetteAI | ✅ | ⚠️ 1차 미확인 | ⚠️ | ⚠️ | ⚠️ "publicly available" | — | 보류 |
| ~~MusicGen~~ | ✅ | ❌ **가중치 CC-BY-NC = 비상업** | — | ❌ | — | — | ❌ **불가·fal 미제공** |

---

## 5. 우리 구조 요약 (문의문에 들어갈 사실관계)

- OXXOVO Labs Inc.가 fal 계정·API 키 보유. **참가자는 fal API를 직접 호출하지 않음**
  (fal ToS의 end-user 직접노출 금지 준수).
- 참가자가 편집기에서 프롬프트 입력 → 우리 서버가 fal 호출 → **우리 R2에 저장** → 참가자 영상에
  믹싱 → **최종 영상만** Watch에 공개. **음원 파일 단독 배포·다운로드 없음.**
- 시즌당 **참가자 최대 500명**, 1인 재생성 캡 10 → 출력 수백~수천 건.
- 최종 영상은 **상금 대회 출품물**(시즌0 상금 풀 $3,000). 향후 유료 시즌 예정.
- **회사 연매출 $1M 초과 가능** → $1M 조건 모델 채택 불가.

---

## 6. 문의 문안 (확정본, 그대로 발송)

### 6-1. ★fal 앞 — 8문항 (핵심)

> **Subject: Output license scope for music models on fal — commercial contest platform (written answer requested)**
>
> Hello fal team,
>
> We are OXXOVO Labs Inc., building a video-creation contest platform on fal. We hold the fal account
> and API key; **our end users never call the fal API directly**. Our server calls fal on their
> behalf, stores the Output in our own storage, mixes it into the user's video, and publishes only
> the finished video. Those videos compete for cash prizes, and our company's annual revenue may
> exceed USD $1M. Expect several hundred to several thousand music generations per season.
>
> We are making a go/no-go decision on which music model to ship, so we need a written answer we can
> retain. Please answer per-question.
>
> 1. **Fee vs. content license.** Does the fee we pay fal for a model call include any commercial
>    license to the Output itself, or is the Output's commercial usability governed solely by the
>    underlying model provider's own terms? Please cite the governing clause in your terms.
> 2. **Stable Audio's USD $1M threshold.** Stability AI's Community License requires an Enterprise
>    license above USD $1M of annual revenue. **Does fal absorb / cover that obligation for customers
>    generating via `fal-ai/stable-audio-25`, or does it pass through to us?** If it passes through,
>    please say so plainly.
> 3. **Sonilo tier attribution.** For `sonilo/v1.1/text-to-music`: Sonilo's Terms define commercial
>    rights by *Sonilo account tier* (Free = non-commercial, Pro = commercial). We hold no Sonilo
>    account. **Which tier's rights attach to Output generated through fal?** Is fal-generated Output
>    treated as Pro-tier (commercial) Output?
> 4. **Sonauto.** For `sonauto/v2/text-to-music`: does Sonauto's Section 8 output assignment and
>    all-tier commercial grant apply to Output generated through fal? Sonauto requires attribution
>    for user-facing apps built on its API — **does that attribution requirement apply to us when we
>    access the model through fal, and what exact credit wording is required?**
> 5. **Revenue conditions, model by model.** For each of `sonilo/v1.1/text-to-music`,
>    `sonauto/v2/text-to-music`, `fal-ai/elevenlabs/music`, `fal-ai/lyria2`, `fal-ai/ace-step`:
>    **is there any revenue cap, annual-revenue threshold, or company-size threshold** attached to
>    commercial use of the Output? Please answer yes/no per model.
> 6. **Lyria 2.** Google's commercial-use grant and copyright indemnification for Lyria flow from
>    Google Cloud / Vertex AI customer terms. **We are a fal customer, not a Google Cloud customer.
>    Do those commercial rights and any indemnity extend to Output generated via `fal-ai/lyria2`?**
>    Is the Output SynthID-watermarked, and are we required to disclose that?
> 7. **Redistribution structure.** In our structure we generate the Output and deliver it to our end
>    users, who then monetize the resulting video (prize competition). **Which music models on fal
>    permit this without a separate OEM / end-user-redistribution agreement?** We are aware that
>    ElevenLabs' terms restrict making Output available to third parties and cap libraries at 100
>    outputs for third-party distribution — please confirm whether that applies via fal.
> 8. **Bottom line.** **Which text-to-music model(s) on fal have (a) no revenue threshold, (b) an
>    output commercial-use right that survives delivery to our end users, and (c) a licensed
>    training-data provenance?** If the answer is "only one" or "none," please say so.
>
> We are prepared to sign an OEM or enterprise agreement if our structure requires one — please tell
> us which, with whom, and at what cost.
>
> Thank you,
> Thomas Kim — OXXOVO Labs Inc.

### 6-2. Sonilo 앞 (동시 발송 — fal이 "제공자에게 물어보라"고 되던질 가능성 높음)

> **Subject: Commercial license scope for Sonilo v1.1 text-to-music Output generated via fal.ai**
>
> Hello Sonilo team,
>
> We are OXXOVO Labs Inc. We plan to use **`sonilo/v1.1/text-to-music`** through fal.ai inside a
> video-creation contest platform. Our server generates the music on behalf of our end users; the
> users never access your API or ours directly, and they receive the music only as the soundtrack of
> their own finished video. Those videos are published on our site and compete for cash prizes. Our
> company's annual revenue may exceed USD $1M. Expect several hundred to several thousand
> generations per season.
>
> Your Terms of Service assign Output rights to the account holder and define commercial use by tier
> (Free = non-commercial, Pro = commercial). We access the model through fal rather than a Sonilo
> account, so we need written confirmation of the following.
>
> 1. Which tier's rights apply to Output generated through fal.ai? Is it treated as Pro-tier
>    (commercial-use permitted) Output?
> 2. Is there any revenue cap, annual-revenue threshold, or company-size threshold on commercial use
>    of Sonilo Output? Your ToS does not appear to contain one — please confirm that is correct.
> 3. Your developer materials describe an **"end-user redistribution" licensing tier** for app
>    developers, but that term does not appear in your published Terms of Service. Does our structure
>    (we generate; our end users monetize the resulting video) fall under your standard commercial
>    terms, or does it require a separate end-user-redistribution / OEM agreement? If separate,
>    please send terms and pricing.
> 4. Is any attribution or AI-disclosure credit required, and in what wording?
> 5. Please confirm the training-data provenance statement (professionally licensed catalogs
>    including Shutterstock) as it applies specifically to **v1.1 text-to-music** output — your
>    public materials emphasize video-to-music, and we want it on record that the text-to-music
>    endpoint carries the same licensed provenance.
>
> If a paid tier or agreement is required for our structure, we are prepared to move forward —
> please tell us which.
>
> Thank you,
> Thomas Kim — OXXOVO Labs Inc.

### 6-3. Sonauto (Treblo) 앞 — 2순위 확보용, 여유 있으면 동시 발송

> **Subject: Commercial rights for Sonauto V2 Output via the fal.ai API (app-developer structure)**
>
> Hello Sonauto team,
>
> We are OXXOVO Labs Inc. We are evaluating **`sonauto/v2/text-to-music`** via fal.ai for a
> video-creation contest platform. Our server generates music on behalf of our end users; the music
> reaches them only as the soundtrack of their own finished video, which is published on our site and
> competes for cash prizes. Our annual revenue may exceed USD $1M.
>
> 1. Does the Section 8 output assignment and the all-tier commercial grant apply to Output generated
>    through fal.ai, where we are a fal customer rather than a Sonauto subscriber?
> 2. Is there any revenue cap or company-size threshold on commercial use of Outputs?
> 3. Your terms require attribution for user-facing apps built on the API. **What exact credit
>    wording and placement satisfies this**, and does it apply when access is via fal.ai?
> 4. May our end users monetize videos containing the Output (prize competition, and later paid-entry
>    seasons), or does that require a separate agreement?
> 5. Can you describe the training-data provenance for V2 — is the training corpus licensed, and do
>    you offer any indemnity for third-party IP claims on Outputs?
>
> Thank you,
> Thomas Kim — OXXOVO Labs Inc.

---

## 7. 다음 행동

| # | 할 일 | 주체 | 비고 |
|---|---|---|---|
| 1 | §6-1 fal 문의 발송 (8문항) | TK | **핵심 경로** |
| 2 | §6-2 Sonilo 문의 발송 (동시) | TK | 되던질 가능성 대비 |
| 3 | §6-3 Sonauto 문의 발송 | TK | 2순위 확보 |
| 4 | **sonauto.ai/tos §8 원문 브라우저 확인** | TK | 봇 403이라 내가 못 봄 |
| 5 | 회신 → 채택 확정 | TK/본부 | **provider 구현의 선행 조건** |
| 6 | 회신 지연 시: 음악 v1을 시즌0에서 뺄지 판단 | TK/본부 | 8/5 관련 |
| 7 | 워커 music 레인 + 라이브러리 8곡 | 지수2 | 5 이후 |

**금지 유지**: 라이선스 확정 전 **라이브 시딩 · `studio_music_ai_enabled` ON 금지.**
7/24에 생성한 Stable Audio 8곡 샘플은 **내부 청취용**이며 라이브 사용 불가(모델 부적합 확정).

**별건 블로커** (오늘 실측): 음악 마이그가 적용된 적이 없어 `seasons.studio_music_enabled`가 부재,
compose 편집기 config select가 42703으로 실패. → `reports/studio_music_migration_repair_2026-07-27.sql`
(TK Run 대기). 라이선스와 무관하게 8/5 승격 블로커.

---

## 8. 확인 한계 (정직 표기)

- **fal.ai 도메인은 오늘 WebFetch가 HTTP 429로 반복 차단됨.** fal ToS·모델 페이지 인용은
  **검색 캐시 경유**이며 1차 원문 직접 확인 실패. → §6-1 Q1·Q2가 이 공백을 닫는 문항.
- **sonauto.ai/tos → treblo.com 301 리다이렉트 후 403(봇 차단).** §8 인용은 검색 캐시 경유.
  → TK 브라우저 확인 필요(§7-4).
- 그 외 인용(Meta audiocraft README·MUSICGEN 모델카드·Sonilo ToS·ElevenLabs music-terms 및
  archived v1 terms·Stability License·HF ACE-Step·PR Newswire·Sonilo 자사 요금표)은 **1차 원문 확인 완료.**
- **추측으로 채운 칸 없음.** 근거 없는 항목은 "근거 부재"로 남겨 제외했습니다(MiniMax·CassetteAI).

## 출처

- Meta audiocraft README (MIT 코드 / **CC-BY-NC 4.0 가중치**) — https://github.com/facebookresearch/audiocraft
  · 모델카드 https://github.com/facebookresearch/audiocraft/blob/main/model_cards/MUSICGEN_MODEL_CARD.md
- Sonilo 공식 PR (fal 엔드포인트 2종 명시) — https://www.prnewswire.com/news-releases/sonilo-launches-licensed-ai-music-generator-for-video-on-falai-302806164.html
- Sonilo ToS — https://sonilo.com/terms · 라이선스 안내 https://sonilo.com/licensing · 자사 요금표 https://sonilo.com/
- fal Sonilo t2m — https://fal.ai/models/sonilo/v1.1/text-to-music
- Sonauto: fal 모델 https://fal.ai/models/sonauto/v2/text-to-music · fal 블로그 https://blog.fal.ai/sonauto-now-available-on-fal/ · ToS https://sonauto.ai/tos (→treblo.com, 403)
- fal ElevenLabs Music — https://fal.ai/models/fal-ai/elevenlabs/music · ElevenLabs Music Terms https://elevenlabs.io/music-terms · Archived v1 https://elevenlabs.io/archived-eleven-music-v1-terms · API Terms https://elevenlabs.io/music-api-terms
- fal Lyria2 — https://fal.ai/models/fal-ai/lyria2 · Google Lyria 문서 https://docs.cloud.google.com/vertex-ai/generative-ai/docs/music/overview · Vertex 생성미디어/면책 https://cloud.google.com/blog/products/ai-machine-learning/expanding-generative-media-for-enterprise-on-vertex-ai · Lyria 소송 https://www.musicbusinessworldwide.com/indie-artists-sue-google-claiming-it-used-youtubes-own-catalog-to-train-lyria-3-ai-music-tool/
- Stability AI License ($1M) — https://stability.ai/license
- ACE-Step (Apache-2.0) — https://huggingface.co/ACE-Step/ACE-Step-v1-3.5B · fal https://fal.ai/models/fal-ai/ace-step
- YuE (Apache-2.0) — https://github.com/multimodal-art-projection/YuE · DiffRhythm https://github.com/ASLP-lab/DiffRhythm
- fal ToS — https://fal.ai/terms · API Services https://fal.ai/legal/api-services *(2026-07-27 원문 재확인 429 차단)*
- MiniMax — https://fal.ai/models/fal-ai/minimax-music/api
