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
2. **studio 제출 경로에 moderation 스캔 추가 → ✅ 코드 완료 (2026-07-08, a5d2864)** — **실증됨(경우 B)**: TK 실제 제출행 `moderation_checked_at=null`·`flags=null`·`status=approved`(컬럼 기본값) = 스캔 안 돌고 즉시 공개. **수정**: submitGeneration(5a)+submitRender(7a) 신청행 insert 직전 `moderateSubmission({text: statement})` 호출 → `moderation_status`+`moderation_flags`+`moderation_checked_at` 반영. `/api/apply` 정책 미러. 키없음/에러 시 fail-safe `pending`(비공개, admin 큐). tsc0. **범위=statement 텍스트 게이트**(영상 프레임 스캔=phase C2 워커, 별도 트래킹). **비소급**(신규 제출부터). 프로덕션 OPENAI_API_KEY 설정은 발사 체크(키 없으면 전건 pending→admin 큐, fail-safe라 안전하나 운영 인지).
3. **단일 경로 통일** — 생성 → compose → statement 제출 하나로. 확정된 "시즌0 = compose-only" 전략과 일치. 단일생성 제출 + /apply 넛지는 pre-compose 레거시. **★병합(2026-07-08): 프로필 레벨(이름/국적/규칙·개인정보 동의) ⊥ 작품 레벨(statement/무결성 동의) 분리 — 제출마다 프로필 재입력 마찰 제거. 설계안 = reports/studio_profile_work_split_design_2026-07.md. profiles 테이블 확장+prefill. 시즌1(매주) 전 필수, 시즌0 비블로커.**
4. **Studio 네비게이션 발견성 (2026-07-08 추가)** — **참가자가 /studio로 갈 경로가 없음.** 실코드: 로그인 기본 착지 = `/profile`(login/page.tsx:14 하드코딩). 랜딩 nav(LandingView.tsx) = Tournament/Watch/HowItWorks/About/Membership/FAQ — **Studio 링크 0**. 히어로 CTA = `resolveSeasonCta()` → `/apply`. profile 페이지도 `/apply`만. → 지금은 주소창 직접 입력만 가능. **발사 시 CTA/nav를 /studio로 배선** (item 1·3과 같은 뿌리: 정문이 레거시 /apply를 가리킴). 시즌0=compose-only 전략이면 정문 = Studio여야 함.

5. **Compose 진입 배선 누락 → ✅ 코드 완료 (2026-07-08, f614034)** — compose 에디터(`/studio/compose/page.tsx` + `ComposeEditor.tsx`)는 이 브랜치에 **완전히 존재·서버액션 배선 완료·게이트 정상**. 그런데 `/studio` 메인 페이지에 `/studio/compose`로 가는 링크가 **0개**였음(비대칭 — compose→/studio 백링크만). season_test처럼 studio_compose_enabled여도 참가자가 조합 버튼을 못 봄 = 실제 이탈 지점. **수정**: `StudioState.composeEnabled`(=cfg.studioComposeEnabled) 노출 + Generations 섹션에 게이트된 Compose CTA 배너("조합 편집기 열기 →" → /studio/compose), compose ON일 때만 노출. tsc0. **잔여(발사 시 검토)**: compose-only 전략이면 영상별 "Submit this video" 단일 제출 노출 자체 재검토(item3 단일 경로 통일).

6. **Watch 카드 썸네일 없음 (studio R2 영상) — 2026-07-08 발견** — **시즌0 전면 studio = 모든 Watch 카드가 그라디언트 타일**(영상 미리보기 없음). 실측: `thumbnailUrl`은 DB 컬럼 아니라 `deriveThumbnail(videoUrl)` 런타임 파생(watch.ts:152) → **YouTube/Vimeo만 추출, R2 mp4는 null → 그라디언트+이름 카드 폴백**(Arena.tsx:192, 의도된 폴백). 워커가 compose 최종본에 포스터 프레임을 안 만듦("no thumbnail frame yet"). 관객 투표 화면 시각품질 직결 = 발사 전 필수. **수정(크로스레포)**: (a) 마이그 `render_jobs`+`genesis_applications`에 `thumbnail_url text` (b) 워커(oxxovo-studio) ffmpeg `-frames:v 1` 포스터 추출→R2 업로드→컬럼 기록 (c) `getWatchVideos` 저장 thumbnail 우선(없으면 파생 폴백) (d) 카드 `<img>`는 이미 배선됨. 영상 자체 R2 저장·재생은 정상(썸네일만 문제).

## 관련 launch 체크리스트

- [ ] **prod OPENAI_API_KEY — ✅ 실증(2026-07-08)** — Preview에 존재·유효 확인(TK 제출 e2a99a6f → moderation_status=approved+checked_at 타임스탬프 = 스캔 실제 실행). Production 스코프도 존재(중복 에러로 확인). studio 게이트가 이 키 읽어 작동.
- [ ] **OpenAI fetch 타임아웃** — `lib/moderation.ts` AbortController 없음. 실측상 응답 <1s(hang 없었음)지만, 대량(500명)+OpenAI 지연/장애 시 제출 대량 hang 위험. 5s 컷 + pending 폴백 = 발사 전 하드닝 필수.

## 참가자 대기 경험 (참고 — 정상 경로는 매끄러움)

- OpenAI omni-moderation 스캔 = 0.2~0.8s, apply 요청 안에서 동기 완료 → 참가자는 폼 "제출 중" 스피너 1~2초 후 즉시 approved. **별도 moderation 대기실 없음.**
- Watch 카드의 "심사중" 배지는 **채점(Triple-AI)** 상태지 moderation이 아님.
