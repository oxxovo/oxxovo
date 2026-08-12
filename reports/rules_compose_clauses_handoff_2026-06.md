# /rules 짜깁기 조항 핸드오프 — 지수2 → 지수(본체)

작성: 지수2 (2026-06-12) · **본정리: 2026-06-13** · **인계 점검: 2026-06-13**.
상태: **인계 가능 — 블로커 없음**. 지수가 /rules 이중언어화 시 그대로 끼워넣을 수 있는 드롭인 형태.

> **소스 동결**: ComposeEditor UI/카피는 TK 승인으로 **확정·동결**(2026-06-13, "이대로 간다, 변경 없음"). 따라서 §1의 DICT는 인계 후에도 흔들리지 않는 안정 소스. 참조 커밋 `9ae2a6c`(R0 박스)·`fd1b39d`(KO 병기)·`d0b318d`(본 핸드오프) 모두 `feat/studio-compose`에 존재 확인. (조항 위치는 머지 트레인 후 main 기준으로 동일.)

---

## 0. 한눈에

- `/rules` 전체 한/영 이중언어화 = **지수(본체) 큐**. 이 문서는 그중 **짜깁기(Compose) 관련 조항만** 미리 정리해 넘기는 것.
- TK 요건 4개를 모두 반영:
  1. **번역강한 리포맷** — 긴 문장 ❌ → 짧은 문구 + 숫자 + 아이콘 + **표**.
  2. **KO 추가** — 새로 쓰지 않고 **카피키트 v6(=ComposeEditor DICT) 표현 재사용**.
  3. **HTML 실제 텍스트** — 이미지 ❌, 브라우저 자동번역 작동.
  4. **영어 원문 = 분쟁 기준** — 지수가 페이지 전체에 넣을 고지문 틀에 맞게(§5 참고).

---

## 1. "카피키트 v6"가 뭔지 (소스 단일화)

별도 카피키트 파일은 없습니다. 짜깁기 카피의 **검증된 단일 소스 = `app/studio/compose/ComposeEditor.tsx`의 `DICT`** (ko/en).
이미 KO/EN 병기·문구 다듬기 완료된 상태라, /rules도 **이 문구를 재사용**하면 됩니다(새로 번역 금지). 아래 §3 표/칩은 전부 이 DICT에서 발췌·압축한 것.

현재 /rules에 이미 들어간 것:
- **§⑥ 상단 R0 기준선 박스** (커밋 `9ae2a6c` + KO 병기 `fd1b39d`) — EN/KO 헤드라인 + 보조설명 1단락. → 본 핸드오프의 §3-B로 **표 형태로 승격** 권장.
- **Genesis Rule(편집 제한 원칙)**: /rules 본문엔 아직 **별도 섹션 없음**. 편집기 UI 아코디언(`why_*`) + 설계doc §6에만 존재. → 지수가 **/rules에 "Compose Rules" 섹션 신설** 필요(§3-A 드롭인 제공).

---

## 2. 영어 원문 우선(분쟁 기준) — 짜깁기 조항 정합 메모

지수가 페이지 전체에 "English is the authoritative version; translations are for convenience" 고지문을 넣을 예정.
짜깁기 조항은 그 틀에 자연스럽게 맞음 — **EN 줄을 먼저(authoritative), KO 줄을 보조로** 배치. 본 문서의 모든 표/칩은 그 순서(EN→KO)로 작성됨. 별도 짜깁기용 고지문 불필요(페이지 전역 고지문에 포섭).

---

## 3. 드롭인 콘텐츠 (EN→KO, 실텍스트)

> 아래는 `/rules`의 기존 `RuleSection`/표 패턴과 동일한 스타일. 번호(⑦ 등)는 지수가 페이지 순서에 맞게 배정. 모든 텍스트는 실제 문자열(자동번역 작동).

### 3-A. 신규 섹션 — "Compose Rules / 짜깁기 규칙" (Genesis Rule)

**헤드라인 (숫자 칩 3개):**

| | EN | KO |
|---|---|---|
| ⏱ | **30–40 seconds**, one final | **30~40초**, 완성본 1개 |
| 🎬 | **Your own AI clips** only | **본인이 생성한** AI 클립만 |
| 🛠 | **3 actions** allowed | 허용 동작 **3가지** |

> 길이 = **최소 30초, 최대 40초** (시즌 파라미터 `studio_compose_min/max_seconds`, 시즌별 변동 가능). 편집기 미터가 `X / 30~40초`로 실시간 표시·검증. (시즌0 확정값, 2026-07-15 TK. season_1~4는 미설정 = 기본 15~30이므로 시즌1 개시 전 재확인 필요.)

**왜 제한하나 (1줄씩, 긴 문장 금지):**

- EN: OXXOVO rewards **pure AI creation — not editing.**
- KO: OXXOVO는 영상 편집이 아니라 **순수 AI 창작**을 겨루는 대회입니다.
- EN: Advanced tools (VFX, transitions, color grading, subtitles, external audio) would unfairly favor pro editors.
- KO: 특수효과·전환·색보정·자막·외부 오디오 같은 고급 편집 도구는 전문 편집자에게 불공정하게 유리합니다.

**허용 동작 = 칩 3개 (아이콘 + 라벨 + 1줄 설명):**

| 아이콘 | EN | KO |
|---|---|---|
| ⇅ **Sequence** | arrange the order of clips | **순서** — 클립의 재생 순서 배열 |
| ✂ **Trim** | shorten the beginning or end of a clip | **트림** — 클립의 앞/끝을 짧게 자르기 |
| ▮ **Cut** | join clips with a hard cut (no transition) | **컷** — 전환효과 없이 하드컷으로 잇기 |

**클로징 (1줄):**

- EN: The challenge is not how much you can **edit**, but how effectively you can **create with AI.**
- KO: 관건은 얼마나 **편집**하느냐가 아니라, 얼마나 효과적으로 **AI로 창작**하느냐입니다.

### 3-B. R0 기준선 — "허용 vs 금지" 2열 표 (현 §⑥ 박스를 표로 승격)

**헤드라인 (이미 /rules에 있음 — 유지):**

- EN (authoritative): **Baseline: what the AI generated is allowed — what you add in post is not.**
- KO: **기준선: AI가 생성한 것은 허용 — 후편집으로 추가한 것은 금지.**

**2열 표 (자동번역 친화):**

| ✅ 허용 — AI 생성물 안에 있는 것 / Allowed — inside the AI output | ❌ 금지 — 후편집으로 추가한 것 / Banned — added in post |
|---|---|
| 클립 안의 글자·효과 / text & effects within a clip | 후편집 글자·자막 / text & subtitles added later |
| 클립 자체의 AI 오디오 / the clip's own AI audio | 외부 오디오 추가·믹싱 / external audio, added or mixed |
| 순서·트림·컷 / sequence, trim, cut | 전환·VFX·색보정·모션그래픽 / transitions, VFX, color grading, motion graphics |
| (AI가 생성한 그대로) / (exactly as the AI generated) | 외부 에셋·업스케일 / external assets, upscaling |

**보조 1줄 (구조적 불가 — 신뢰 강화):**

- EN: OXXOVO's in-platform editor **has no tools to add** them, so what your AI generates is exactly what competes.
- KO: OXXOVO 편집기엔 그런 도구가 **아예 없으므로**, AI가 생성한 그대로가 경쟁에 오릅니다.

### 3-C. 해상도 고지 (R1, 1줄)

- EN: Mixing clips of different resolutions converges the final to the **lowest** one — use consistent high-quality clips.
- KO: 해상도가 다른 클립을 섞으면 완성본이 **가장 낮은** 해상도로 수렴합니다 — 일관된 고화질 클립을 권장합니다.

---

## 4. 소스 매핑 (각 문구 → DICT 키)

지수가 "원문 정확한가?" 확인할 때 대조표. 전부 `ComposeEditor.tsx` `DICT`.

| /rules 블록 | DICT 키 | 비고 |
|---|---|---|
| 3-A 왜 제한 | `why_intro`, `why_reason` | 그대로 |
| 3-A 허용 3동작 칩 | `why_seq`, `why_trim`, `why_cut` | `[라벨, 설명]` 튜플 |
| 3-A 클로징 | `why_close` | 그대로 |
| 3-B 기준선 헤드라인 | (현 `/rules` §⑥ 박스) | 이미 라이브 문구 |
| 3-B 허용/금지 표·보조 | `why_baseline` | 산문을 표로 분해(내용 동일) |
| 3-C 해상도 | `res_note` | 그대로 |

---

## 5. 지수 통합 체크리스트

- [ ] /rules에 **"Compose Rules / 짜깁기 규칙" 섹션 신설**(번호 배정) — 3-A 드롭인.
- [ ] 현 §⑥ R0 박스 → **3-B 2열 표로 승격**(헤드라인 EN/KO는 유지).
- [ ] 3-C 해상도 고지는 §⑥ 또는 신규 섹션 하단에.
- [ ] 페이지 전역 **영어 원문 우선 고지문** 적용 시 짜깁기 조항도 자동 포섭(별도 불필요).
- [ ] 표/칩 → 기존 /rules `RuleSection`·table·칩 스타일 재사용(이미지 금지, 실텍스트).
- [ ] 원문 의심 시 §4 매핑표로 `ComposeEditor.tsx` DICT 대조.

**경계 주의(지수2 영역 보존):** 짜깁기 조항의 **내용/문구**는 본 문서가 단일 소스. 지수는 **배치·번호·스타일·전역 고지문**만 조정. 문구를 새로 번역/변경할 일이 생기면 ComposeEditor DICT부터 고쳐 동기화(편집기 ↔ /rules 불일치 방지).
