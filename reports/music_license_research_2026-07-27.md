# Studio 음악 v1 — 라이선스 조사 (2026-07-27, 지수2)

요건 (TK 확정): **① text-to-music 필수 ② 학습데이터 라이선스 클린 ③ 매출조건(revenue cap) 없음**
우리 구조: 플랫폼 계정이 fal 키 보유 → 서버사이드 생성 → R2 저장 → 참가자 영상에 믹싱 →
Watch 공개 → **상금 대회 출품물(수익화)**. 참가자는 fal을 직접 접하지 않음(중개 구조).

---

## 결론 (요약)

1. **"매출조건 없는 text-to-music"은 존재한다.** 다만 조사 결과 축이 하나가 아니라 **셋**이고,
   세 축을 동시에 만족하는 후보는 **Sonilo 하나**다.
   - 축 A = 매출조건(revenue cap) 유무
   - 축 B = 학습데이터 라이선스 클린 여부(저작권 리스크)
   - 축 C = **재배포 구조 허용 여부** — ★이번에 새로 드러난 축. 매출조건이 없어도
     "우리가 생성해 제3자(참가자)에게 제공"을 금지하면 우리 구조는 그대로 막힌다.
2. **MusicGen은 부적합 — TK 가설 반증.** MIT는 **audiocraft 코드**에만 적용되고,
   **모델 가중치는 CC-BY-NC 4.0 = 비상업**이다. 상금 대회 출품물에 못 쓴다.
3. **ElevenLabs Music은 매출조건은 없으나 축 C에서 막힌다** (아래 근거). 우리 구조엔 더 불리.
4. **Sonilo는 남는다.** 공식 ToS에 **매출 캡 조항이 없고**, 유료 tier 상업 사용을 명시하며,
   학습데이터는 Shutterstock 등 정식 라이선스. **유일한 공백 = "fal 경유 시 어느 tier가 적용되는가"**
   (Sonilo ToS는 *Sonilo 계정 tier* 기준으로 쓰여 있는데 우리는 Sonilo 계정이 아니라 fal 고객이다).
   → **fal + Sonilo 서면 확인 2건**으로 닫는다. 문안은 §4.
5. **provider 구현은 착수하지 않음** (TK 지시대로). 워커 `generateMusic()`은 이미 있으나
   라이브 시딩·AI 스위치 ON은 서면 회신 후.

### 전제 정정 1건
TK 지시문의 "Sonilo는 text-to-music 없음"은 사실과 다릅니다. **fal에 전용 엔드포인트가 있습니다** —
`sonilo/v1.1/text-to-music` (fal 모델 페이지 실재, PR 자료에도 "text-to-music … for those who prefer
to work from a prompt, including segment-level controls"로 명시). 없는 건 text-to-music이 아니라
**우리 구조를 커버한다는 서면 근거**입니다. 그래서 §4 문의가 필요합니다.

---

## 1. 모델별 조사 (근거 포함)

### 1-1. Sonilo v1.1 — ★유력 (매출조건 없음, 축 C만 미확인)

- **text-to-music**: 있음. fal `sonilo/v1.1/text-to-music`. duration 기본 90초 · 최대 600초,
  프롬프트로 style/mood/instrumentation/정확한 길이 제어. (7/24 세션 실측: 출력 AAC/m4a URL,
  **$0.0025/초/샘플** → 30초 ≈ $0.075.)
- **학습데이터**: "Every Sonilo model is trained on professionally licensed content, including
  Shutterstock's music catalog, with musicians compensated for their participation."
- **매출조건**: **ToS에 revenue cap / company-size threshold 조항 없음** (전문 확인).
- **출력 소유권** (ToS 인용): *"As between you and Sonilo … Sonilo assigns to you any rights we may
  have in the Outputs generated for your account."*
- **tier 구조** (ToS 인용): Free = *"Outputs are for personal, experimental, and other non-commercial
  use only."* / Pro = *"Commercial use of Outputs generated under that tier is permitted, subject to
  these Terms."* / Enterprise = 별도 계약.
- **★공백 2건**:
  1. ToS 본문에 **"Tier 3 / end-user redistribution"이라는 표현이 없다.** 그 표현은 Sonilo
     마케팅·블로그(개발자 가이드)에만 등장한다. 계약 근거로 쓸 수 없다.
  2. ToS는 "your account"의 tier로 권리를 정의하는데 **우리는 Sonilo 계정이 없고 fal 고객**이다.
     fal 경유 출력이 Pro 상당인지, 그리고 그 권리가 **우리 end user(참가자)에게까지 흐르는지**가 미기재.
- 판정: **조건부 채택 후보. 서면 확인 후 확정.**

### 1-2. ACE-Step — 매출조건 없음(축 A ✅) / 저작권 클린 아님(축 B ❌)

- fal `fal-ai/ace-step` 존재, **$0.0002/초** (조사한 것 중 최저가).
- 라이선스: **Apache-2.0** (HF 모델카드 `License: apache-2.0`). 매출조건·기업규모 조건 **없음**.
- **그러나** 모델카드는 상업 보증 대신 *윤리 가이드라인*만 준다 — "Verify originality of generated
  works", "Respect cultural elements and copyrights". 즉 **학습데이터 출처 보증이 없고 책임은
  사용자에게 전가**된다. Apache-2.0은 *가중치/코드*의 라이선스일 뿐, **출력물이 제3자 저작권을
  침해하지 않는다는 보증이 아니다.**
- 판정: **요건 ②(라이선스 클린) 불충족 → 부적합.** 상금 대회 출품물에 얹기엔 리스크가 크다.
  (단 "매출조건 없는 text-to-music이 물리적으로 있느냐"의 답은 예 — 이게 그 예다.)

### 1-3. Meta MusicGen — ❌ 비상업 (가설 반증)

- audiocraft **MUSICGEN_MODEL_CARD** 인용: *"model weights are released under CC-BY-NC 4.0"*.
- **NC = NonCommercial.** MIT는 audiocraft **코드 저장소**에만 걸린 라이선스이고 가중치는 별도다.
  둘을 합쳐 "MusicGen은 MIT라 조건 없음"으로 읽으면 오독이다.
- fal의 오디오 모델 목록에서도 MusicGen은 확인되지 않음(검색 결과에 없음). 있어도 못 쓴다.
- 판정: **부적합. 이 선은 여기서 닫힘.**

### 1-4. ElevenLabs Music — 매출조건 없음(축 A ✅) / ★재배포 구조 금지(축 C ❌)

- 현행 `music-terms` 섹션: MUSIC / PROHIBITIONS / DISCLAIMERS / FEES / MODEL-SPECIFIC TERMS.
  본문에 **revenue threshold 없음**. 다만 **금지 업종 목록**(총기·담배·의약품·성인물·종교단체·정치)
  과 **프롬프트 금지**(아티스트명·곡명·레이블명·가사 상당부분, 실연자 음성/likeness 모방)가 있다.
  → 우리 `findImitation` 흉내차단이 이미 대응하는 범위와 겹침(설계 방향은 맞았음).
- **Archived Eleven Music v1 Terms** (구속력 있는 아카이브 문서) 에서 걸리는 조항:
  - Free = *"prohibited from using Outputs for any commercial purpose"*
  - Starter/Creator/Pro/Scale/Business = **"music libraries exceeding 100 outputs for third-party
    distribution" 금지**
  - *"Making Available (as defined in the OEM Terms) the Service or Output to any third-party for use
    in a manner that would violate this section."*
- **우리 구조 = 플랫폼이 생성해 참가자(제3자)에게 제공.** 정원 500 시즌이면 출력은 100개를
  가볍게 넘는다. → **OEM/Enterprise 별도 계약 없이는 정면 충돌.**
- 추가: 마케팅/광고/영화/TV/게임/enterprise distribution은 별도 라이선스 요구.
- 판정: **매출조건은 없지만 우리 구조에서 부적합** (Stable Audio보다 오히려 나쁨).

### 1-5. Stable Audio 2.5 — ❌ $1M (기확정, 재확인)

- Stability AI Community License: *"You only need a paid Enterprise license if your yearly revenues
  exceed USD $1M and you use Stability AI models in commercial products or services."*
- OXXOVO는 $1M+ 목표. **부적합 확정** (7/24 판정 유지).

### 1-6. Google Lyria 2 — 조건 불명 + 계류 리스크

- fal `fal-ai/lyria2`, **$0.10 / 30초**.
- 사용권은 **Google 약관이 지배**하며 fal 경유 조건은 문서화되어 있지 않음(공개 근거 미확인).
- **추가 리스크**: 인디 아티스트들이 "YouTube 카탈로그로 Lyria 3를 학습시켰다"며 Google 제소 —
  학습데이터 provenance가 **현재 분쟁 중**. 요건 ②에 정면으로 걸린다.
- 판정: **부적합(리스크).**

### 1-7. MiniMax Music 2.0 — 근거 부재

- 검색되는 MiniMax 약관은 **"AI App and Web"용**이고 **개발자 API용 영문 상업조항이 확인되지 않음**.
  app/web 약관은 오히려 MiniMax에 광범위한 영구 라이선스를 주는 구조라 API로 그대로 전용할 수 없다.
- 판정: **근거 없음 → 추측 금지 원칙상 제외.**

### 1-8. CassetteAI — 2차 출처뿐

- fal 연동 있음, "Pro Plan includes a commercial use license", "trained on publicly available **or**
  licensed material". → *publicly available*이 섞여 있어 요건 ② 미충족 가능성. 1차 약관 미확인.
- 판정: **보류(근거 부족).** Sonilo가 막힐 때만 재조사.

### 1-9. fal 자체 약관 (모든 모델에 공통으로 얹히는 층)

- fal ToS **Third Party Models** 섹션: 제3자 API 경유 모델 사용 시 Client Content가 그 제3자에게
  전송됨을 고지하고, 어떤 모델이 제3자 API 경유인지 플랫폼에 표시한다고 규정.
- 출력 보증: *"Company does not represent or warrant that any Output Content will be original, will
  not infringe rights of any third party … or otherwise entitle Client to any Intellectual Property
  Rights in any Output Content."*
- → **7/24 세션 판정 유지: fal 요금 = API 사용료일 뿐, 출력물의 상업 라이선스는 모델 제공자 약관이
  지배한다.** (오늘 fal.ai 원문 재확인은 **HTTP 429로 차단** — 위 인용은 검색 캐시 경유. 문의 회신에서
  이 점을 fal이 직접 확인해주는 게 §4 문의의 목적 1번이다.)

---

## 2. 비교표

| 모델 (fal id) | text→music | 학습데이터 클린 | **매출조건** | **재배포(우리 구조)** | 단가 | 판정 |
|---|---|---|---|---|---|---|
| **Sonilo v1.1** `sonilo/v1.1/text-to-music` | ✅ (≤600s) | ✅ Shutterstock 등 정식 | ✅ **없음**(ToS 무조항) | ⚠️ **미확인** (tier 귀속 불명) | $0.0025/초 (30s≈$0.075) | **★유력 · 서면확인 대기** |
| ACE-Step `fal-ai/ace-step` | ✅ | ❌ 출처 보증 없음 | ✅ 없음 (Apache-2.0) | ✅ 제한 없음 | $0.0002/초 | ❌ 요건② 미충족 |
| Meta MusicGen | ✅ | — | ❌ **CC-BY-NC = 비상업** | ❌ | — (fal 미확인) | ❌ **사용 불가** |
| ElevenLabs Music | ✅ | ✅ 아티스트 opt-in | ✅ 없음 | ❌ **100 outputs / OEM 제한** | 플랜별 | ❌ 구조 충돌 |
| Stable Audio 2.5 `fal-ai/stable-audio-25` | ✅ | ✅ 정식 데이터셋 | ❌ **>$1M Enterprise** | ⚠️ 고지의무 | $0.20/건 | ❌ 확정 부적합 |
| Google Lyria 2 `fal-ai/lyria2` | ✅ | ❌ **소송 계류** | ⚠️ 불명 | ⚠️ 불명 | $0.10/30초 | ❌ 리스크 |
| MiniMax Music 2.0 | ✅ | ⚠️ | ⚠️ API 조항 부재 | ⚠️ | — | 제외(근거 없음) |
| CassetteAI | ✅ | ⚠️ "publicly available or licensed" | ⚠️ | ⚠️ | — | 보류 |

**핵심 한 줄**: 매출조건만 보면 통과하는 모델은 여럿(Sonilo·ACE-Step·ElevenLabs)이지만,
**"매출조건 없음 + 데이터 클린 + 우리가 참가자에게 제공 가능"** 셋을 동시에 만족할 가능성이 있는 건
**Sonilo 하나뿐**이고, 그 마지막 한 칸이 서면 확인 대상이다.

---

## 3. 우리 구조 요약 (문의문에 그대로 들어갈 사실관계)

- OXXOVO Labs Inc. 가 fal 계정·API 키 보유. **참가자는 fal API를 직접 호출하지 않는다**
  (fal ToS의 end-user 직접노출 금지 조항 준수).
- 참가자가 웹 편집기에서 프롬프트 입력 → 우리 서버가 fal 호출 → 결과를 **우리 R2에 저장** →
  참가자 영상에 믹싱 → 최종 영상만 Watch에 공개. 음원 파일 단독 배포·다운로드 없음.
- 시즌당 예상 생성량: **참가자 최대 500명**, 1인 다회 생성 가능 → 출력 수백~수천 건.
- 최종 영상은 **상금 대회 출품물** (시즌0 상금 풀 $3,000). 향후 유료 시즌(참가비)도 예정.
- 회사 연매출은 **$1M을 초과할 수 있다**(따라서 $1M 조건 모델은 채택 불가).

---

## 4. 문의 문안 (그대로 발송 가능)

### 4-1. fal 앞 (support / sales — 서면 회신 요청)

> **Subject: License scope of music-model Output generated through the fal API (commercial contest platform)**
>
> Hello fal team,
>
> We are OXXOVO Labs Inc., building a video-creation contest platform. We hold the fal account and API
> key; our end users never call the fal API directly. Our server calls fal on their behalf, stores the
> Output in our own storage, mixes it into the user's video, and publishes only the finished video on
> our site. Those videos compete for cash prizes, and our company's annual revenue may exceed USD $1M.
>
> Before we ship, we need a written answer to the following. Please answer per-question.
>
> 1. **Fee vs. content license.** Does the fee we pay fal for a model call include any commercial
>    license to the Output itself, or is the Output's commercial usability governed solely by the
>    underlying model provider's own terms? Please point us to the governing clause.
> 2. **Sonilo specifically.** For `sonilo/v1.1/text-to-music` accessed through fal: which Sonilo
>    license tier applies to Output generated through fal? Sonilo's own Terms of Service define
>    commercial rights by *Sonilo account tier* (Free = non-commercial, Pro = commercial), and we do
>    not hold a Sonilo account. Is fal-generated Output treated as Pro-tier (commercial) Output?
> 3. **Revenue conditions.** Is there any revenue cap, annual-revenue threshold, or company-size
>    threshold attached to Output from `sonilo/v1.1/text-to-music`? (We already understand that
>    Stability AI's Community License imposes a USD $1M threshold on Stable Audio; we need to know
>    whether any comparable condition exists for Sonilo or any other music model on fal.)
> 4. **Redistribution / end-user structure.** In our structure, we generate the Output and deliver it
>    to our end users, who then monetize the resulting video (prize competition). Is this permitted
>    under the standard fal terms plus the model provider's terms, or does it require an OEM /
>    end-user-redistribution license from the model provider?
> 5. **Models without revenue conditions.** Which text-to-music models on fal have **no** revenue
>    threshold *and* a licensed training-data provenance? If Sonilo is the answer, please confirm it
>    in writing.
> 6. **Attribution.** Is any attribution or AI-disclosure notice required for the Output, either by
>    fal or by the model provider?
>
> A written reply (email is fine) that we can retain for our records is what we need — we are making a
> go/no-go decision on which music model to ship. Happy to sign an OEM/enterprise agreement if that is
> what our structure requires; please tell us which one.
>
> Thank you,
> Thomas Kim — OXXOVO Labs Inc.

### 4-2. Sonilo 앞 (동시 발송 권장 — fal이 "제공자에게 물어보라"고 되던질 가능성이 높다)

> **Subject: Commercial license scope for Sonilo v1.1 Output generated via the fal.ai API**
>
> Hello Sonilo team,
>
> We are OXXOVO Labs Inc. We plan to use `sonilo/v1.1/text-to-music` through fal.ai inside a
> video-creation contest platform. Our server generates the music on behalf of our end users; the
> users never access your API or ours directly, and they receive the music only as the soundtrack of
> their own finished video. Those videos are published on our site and compete for cash prizes. Our
> company's annual revenue may exceed USD $1M.
>
> Your Terms of Service assign Output rights to the account holder and define commercial use by tier
> (Free = non-commercial, Pro = commercial). We access the model through fal rather than a Sonilo
> account, so we would like written confirmation of the following.
>
> 1. Which tier's rights apply to Output generated through fal.ai? Is it treated as Pro-tier
>    (commercial-use permitted) Output?
> 2. Is there any revenue cap, annual-revenue threshold, or company-size threshold on commercial use
>    of Sonilo Output? Your ToS does not appear to contain one — please confirm that is correct.
> 3. Your developer materials describe an "end-user redistribution" licensing tier for app developers,
>    but that term does not appear in the published Terms of Service. Does our structure (we generate;
>    our end users monetize the resulting video) fall under your standard commercial terms, or does it
>    require a separate end-user-redistribution / OEM agreement? If separate, please send terms and
>    pricing.
> 4. Is any attribution or AI-disclosure credit required?
> 5. Please confirm the training-data provenance statement (professionally licensed catalogs including
>    Shutterstock) as it applies to v1.1 text-to-music output.
>
> We need a written reply we can retain. If a paid tier or agreement is required for our structure, we
> are prepared to move forward — please tell us which.
>
> Thank you,
> Thomas Kim — OXXOVO Labs Inc.

---

## 5. 다음 행동

| # | 할 일 | 주체 | 차단 여부 |
|---|---|---|---|
| 1 | §4-1 fal 문의 발송 | TK | — |
| 2 | §4-2 Sonilo 문의 발송(동시) | TK | — |
| 3 | 회신 수령 → 채택 확정 | TK/본부 | **provider 구현·라이브 시딩의 선행 조건** |
| 4 | 회신 지연 시 판단: 음악 v1을 시즌0에서 뺄 것인가 | TK/본부 | 8/5 관련 |
| 5 | 워커 music 레인 + 라이브러리 8곡 생성 | 지수2 | ③ 이후 착수 |

**금지사항 유지**: 라이선스 확정 전 **라이브 시딩·`studio_music_ai_enabled` ON 금지**.
7/24에 생성한 Stable Audio 8곡 샘플은 **내부 청취용**이며 라이브 사용 불가(모델도 부적합 확정).

---

## 출처

- Sonilo ToS — https://sonilo.com/terms · 라이선스 안내 https://sonilo.com/licensing
- Sonilo × fal 출시 발표 — https://www.prnewswire.com/news-releases/sonilo-launches-licensed-ai-music-generator-for-video-on-falai-302806164.html
- fal Sonilo v1.1 text-to-music — https://fal.ai/models/sonilo/v1.1/text-to-music
- fal 오디오 모델 — https://fal.ai/explore/audio-models · ACE-Step https://fal.ai/models/fal-ai/ace-step · Lyria2 https://fal.ai/models/fal-ai/lyria2
- fal ToS — https://fal.ai/terms · API Services https://fal.ai/legal/api-services *(2026-07-27 원문 재확인은 HTTP 429로 차단, 검색 캐시 인용)*
- MusicGen 모델카드(CC-BY-NC 4.0) — https://github.com/facebookresearch/audiocraft/blob/main/model_cards/MUSICGEN_MODEL_CARD.md
- ACE-Step (Apache-2.0) — https://huggingface.co/ACE-Step/ACE-Step-v1-3.5B
- ElevenLabs Music Terms — https://elevenlabs.io/music-terms · Archived v1 https://elevenlabs.io/archived-eleven-music-v1-terms · API Terms https://elevenlabs.io/music-api-terms
- Stability AI License ($1M) — https://stability.ai/license · Stable Audio 2.5 https://stability.ai/news-updates/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale
- Lyria 소송 보도 — https://www.musicbusinessworldwide.com/indie-artists-sue-google-claiming-it-used-youtubes-own-catalog-to-train-lyria-3-ai-music-tool/
- MiniMax — https://fal.ai/models/fal-ai/minimax-music/api
