# Studio 발사 전 정리 — 신청 경로 & moderation 일관성

- 작성: 2026-07-07 (지수2, feat/studio-budget-guard 실코드 진단)
- 발견 경위: TK 대표 실참가자 E2E 테스트 (season_test, Preview)
- **분류: 발사 블로커 아님 / 발사 전 정리 권장 (P1)**

---

## 요약

Studio에는 참가 신청을 만드는 경로가 **두 개** 있고, 콘텐츠 moderation 정책이 서로 다릅니다.
Full-studio 시즌(시즌0)에서는 이 불일치가 (a) UX 혼란과 (b) 무검열 즉시공개 갭을 만듭니다.
세 가지를 발사 전 정리하면 단일·일관 경로가 됩니다.

## 진단 (실코드 근거)

| 경로 | 입력 요구 | moderation | 결과 |
|---|---|---|---|
| `/apply` 웹폼 (`app/api/apply/route.ts`) | `free_entry_url`(외부 YouTube URL) **필수** (route.ts:69) | 동기 OpenAI 스캔 (route.ts:186, ~0.5~1s, 요청 내 완료) | approved/flagged 즉결. 키 없음/에러 시 fail-safe 'pending' 고착 |
| Studio 인라인 제출 (`app/studio/page.tsx` ApplicantForm) | statement 인라인, 외부 URL 불필요 | **스캔 없음** — 자동생성 insert가 moderation_status 미세팅 → 기본값 'approved' (lib/studio.ts:410) | **무검열 즉시 Watch 공개** |

- studio 참가자는 in-platform 생성이라 외부 URL이 없음 → `/apply` 폼을 **채울 수 없음**.
- 그런데 studio 페이지는 `!hasApplication`이면 항상 amber "must apply → /apply" 배너를 노출 (page.tsx:279-286). 바로 아래 인라인 ApplicantForm(정답 경로, page.tsx:295)이 있는데도.

## 정리 4건

1. **오해 유발 /apply 배너 숨김** — 최소 application 라운드에선 인라인 폼이 신청을 처리하므로 배너 제거. 지금은 참가자를 못 채우는 외부 폼으로 유도.
2. **studio 제출 경로에 moderation 스캔 추가** — 최소 statement 텍스트 스캔(studio는 썸네일 없음; 영상 프레임 스캔 = 코드 주석상 "phase C2 (worker)" 미구현). `/apply`와 정책 일치 → 무검열 공개 갭 제거.
3. **단일 경로 통일** — 생성 → compose → statement 제출 하나로. 확정된 "시즌0 = compose-only" 전략과 일치. 단일생성 제출 + /apply 넛지는 pre-compose 레거시.
4. **Studio 네비게이션 발견성 (2026-07-08 추가)** — **참가자가 /studio로 갈 경로가 없음.** 실코드: 로그인 기본 착지 = `/profile`(login/page.tsx:14 하드코딩). 랜딩 nav(LandingView.tsx) = Tournament/Watch/HowItWorks/About/Membership/FAQ — **Studio 링크 0**. 히어로 CTA = `resolveSeasonCta()` → `/apply`. profile 페이지도 `/apply`만. → 지금은 주소창 직접 입력만 가능. **발사 시 CTA/nav를 /studio로 배선** (item 1·3과 같은 뿌리: 정문이 레거시 /apply를 가리킴). 시즌0=compose-only 전략이면 정문 = Studio여야 함.

## 관련 launch 체크리스트

- [ ] **prod OPENAI_API_KEY 확인** — Vercel Production 스코프 설정 여부 (moderation 하는 경로는 prod 키 필수). 로컬/Preview엔 없음.
- [ ] **OpenAI fetch 타임아웃** — `lib/moderation.ts` AbortController 없음. OpenAI 지연 시 apply 요청 매달림. 5s 컷 + pending 폴백 권장. 대량(500명) + OpenAI 장애 시 전부 pending → admin 큐 폭주 (fail-safe라 안전하나 운영 인지 필요).

## 참가자 대기 경험 (참고 — 정상 경로는 매끄러움)

- OpenAI omni-moderation 스캔 = 0.2~0.8s, apply 요청 안에서 동기 완료 → 참가자는 폼 "제출 중" 스피너 1~2초 후 즉시 approved. **별도 moderation 대기실 없음.**
- Watch 카드의 "심사중" 배지는 **채점(Triple-AI)** 상태지 moderation이 아님.
