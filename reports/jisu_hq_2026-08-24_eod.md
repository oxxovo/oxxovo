# 지수 본체 인계서 — 2026-08-24 EOD

TK 지시: "내일 이어간다, 기록만 남긴다. 고치지 마라, 커밋하지 마라, 배포하지 마라." 이 문서는 그 기록.

## ① 오늘 배포한 것

**없음.**

- `oxxovo`: `c86a4a9`(getCurrentSeason is_fixture 필터) — **커밋만 완료, 미배포**.
- `oxxovo-studio`: 1080 캔버스 전환(`src/render.ts`) + 샤픈/크로매틱 스케일 보정 — **코드만 완료, 미커밋**.
- `oxxovo-studio`: 워터마크 다운로드용 18% 반영(같은 `src/render.ts`) — **코드만 완료, 미커밋**.
- 위 두 `oxxovo-studio` 변경은 파일 2개(`src/render.ts`, `src/render-effects.test.ts`)에 같이 들어 있고 커밋을 아직 안 나눴음. `npm test` 130/130, `tsc --noEmit` 클린 확인됨(오늘 기준).

## ② ⛔ 내일 맨 처음 = 미커밋 13개 정체 확인

`oxxovo` 워킹트리, 2026-08-25 재확인 시점 기준 **여전히 그대로, 전부 2026-08-23 PT 20:49~21:16 사이에 멈춰 있음**(다른 세션 — 08-23 인계 메모에 "Jenny3" 자기표기 — 가 만든 것으로 추정, 이번 세션은 손 안 댐):

| 파일 | 최종 수정(PT) | diff | 한 줄 요약 |
|---|---|---|---|
| `lib/lobby.ts` | 08-23 20:49:11 | +26/-0 | "skill decides" 메시징 전환 관련 |
| `app/_components/LobbySection.tsx` | 08-23 20:49:22 | +5/-18 | 위와 연동, 로비 카드 축소 |
| `lib/admin-i18n.ts` | 08-23 20:55:19 | +11/-2 | 위 문구용 i18n 키 추가 |
| `app/profile/MainRoundCard.tsx` | 08-23 20:55:32 | +14/-0 | "필수조건(Twist)" 배너 UI 신규 |
| `app/admin/seasons/SeasonForm.tsx` | 08-23 20:57:02 | +8/-0 | C-7 나이 필드(`age`) 입력 추가 |
| `lib/studio.ts` | 08-23 20:59:53 | +5/-0 | 위와 연동 추정(미확인) |
| `app/apply/page.tsx` | 08-23 21:01:14 | +48/-4 | C-7 나이 필드(게이트 없음, 최소연령 TK 미결) |
| `app/layout.tsx` | 08-23 21:07:52 | +3/-3 | 미확인(작은 변경) |
| `app/rules/page.tsx` | 08-23 21:07:54 | +4/-1 | 미확인(작은 변경) |
| `app/tournament/SeasonDetail.tsx` | 08-23 21:08:04 | +1/-1 | 미확인(1줄) |
| `app/tournament/page.tsx` | 08-23 21:08:06 | +4/-17 | "skill decides" 관련 축소 추정 |
| `lib/email/messages.ts` | 08-23 21:08:35 | +6/-6 | 문구 교체 추정(미확인) |
| `lib/chatbot-kb.ts` | 08-23 21:15:54 | +6/-4 | KB 문구 갱신 추정(미확인) |

**★배포 명령의 성격**: `vercel --prod --yes`는 **git 커밋 상태가 아니라 그 순간 로컬 워킹 디렉토리를 그대로 업로드**한다(08-23 재확인, 오늘도 재확인 — package.json에 별도 deploy 스크립트 없음, CLI 직접 실행). **즉 로컬 업로드가 맞다.** 지금 상태에서 어떤 배포든 실행하면 이 13개 미커밋 변경분이 통째로 같이 프로덕션에 나간다 — **이게 확인 전 배포를 막은 이유.** 내일 첫 작업: 이 13개가 커밋할 것인지/버릴 것인지/다른 세션 소유인지 확정 — **`git add -A`/`git add .` 금지**, 파일별로 확인.

## ③ 그다음 배포 순서 (따로따로, 번들 금지)

1. `c86a4a9` (is_fixture 픽스) 단독 배포
2. 1080 캔버스 전환 단독 배포 (`oxxovo-studio`)
3. 워터마크 18% 단독 배포 (`oxxovo-studio`, 2번과 파일이 겹치므로 커밋 분리 먼저 필요)

②가 끝나기 전엔 셋 다 보류.

## ④ 확정된 값

- **렌더 캔버스** = 1080×1920(9:16) / 1920×1080(16:9) — `STUDIO_OUTPUT_CANVAS` 상수, `oxxovo-studio/src/render.ts`.
- **워터마크 다운로드용 로고** = 영상 폭의 **18%**(TK 확정, 2026-08-24) — 기존 8%(16:9)/12%(9:16) 두 값을 대체, 양 화면비 공통 단일값으로 반영. `applyDownloadWatermark`에 코드 반영됨(미커밋). **홍보용(10% top-left + 닉네임)은 그대로 둠.**
- **본선 길이 35~40** = DB 반영 완료(`main_round_video_min_seconds`/`max_seconds` = 35/40, season_0). ⚠️ 단 이 컬럼은 `studio_compose_enabled=true`일 때 코드가 안 읽는다 — 실제 게이트는 아래 ⑤-4 참조. **이 불일치는 아직 안 고쳤음(지시대로 손 안 댐).**

## ⑤ 답 안 한 확인 7건 — 오늘 채팅에서 답변한 내용 기록

*(채팅에는 이미 답했으나 휘발되므로 인계서에 다시 남김)*

**1. 9:16 고정이면 콘텐츠 박스 검출이 불필요해지나** → 아니오. (a) compose 기본 fit=`contain`은 TK 2026-07-23 확정 안전장치(참가자가 클립별로 선택) — 생성 모델과 무관하게 일부 클립엔 검은 띠가 항상 남을 수 있음. (b) Kling V3 Pro i2v는 `aspect_ratio` 요청을 무시하고 배우시트 비율을 그대로 씀(2026-08-07 실측, 재현됨) — "9:16 요청"은 무력. (c) 배우시트를 9:16으로 강제해도 출력이 정확히 9:16 되는지 미측정. → **콘텐츠 박스 로직은 유지**, 단 패딩이 `scale decrease + pad (ow-iw)/2:(oh-ih)/2` 중앙고정 산술값이라 픽셀 검출이 아니라 EDL의 소스치수+fit값으로 계산만 하면 됨(작업량 축소 가능). 착수는 승인 대기.

**2. Founding 100명이 해지하면 자리가 돌아오나** → 애초에 해지가 안 됨. `founding_free`는 실제 Stripe 구독이 없음(`claimFoundingCreator`가 DB만 씀) → `cancelMembership()`은 `source !== 'paid'`면 `not_cancelable` 반환, UI 취소 버튼도 `canManageStripe = source==='paid' && hasSub` 조건이라 애초에 안 뜸. 자리 회수(`releaseFoundingSlot`)는 클레임 함수 내부 동시성 CAS 롤백 전용이고 해지/만료 경로에서는 절대 안 불림 → **캡은 영구 소모**(100자리 워터셰드, 기존 메모리와 일치). `founding_creator_number`도 영구 보존이라 재신청해도 `already_founding`만 뜨고 새 무료기간은 안 줌.

**3. Stripe 해지가 기간 말 종료인가 즉시 차단인가** → **기간 말 종료.** `cancelMembership()`은 `stripe.subscriptions.update(cancel_at_period_end: true)`만 호출 — 즉시취소 API(`subscriptions.cancel`/`del`)는 `app/`, `lib/` 전체에 0건. 웹훅(`customer.subscription.deleted`)이 실제 기간 종료 시점에 상태를 `canceled`로 뒤집음. 기존 영문 문구("access until the end of the current period")와 모순 없음 — "결제한 달까지 쓴다"는 참.

**4. 길이 가드가 실제 제출을 막나** → 막음(하드 블록). `createRender`(컴포즈 생성)와 `submitRender`(제출) 둘 다 서버에서 `too_short`/`too_long`으로 거부(이중 체크). **단 라이브 DB 확인 결과 심각한 불일치 발견**: season_0의 `main_round_video_min/max_seconds`(35/40, 위 ④에서 방금 승인 반영됨)는 `studio_compose_enabled=true`일 때 코드가 아예 안 읽음(S-7 스킵, 주석에 명시). 실제로 `createRender`/`submitRender`가 읽는 컬럼은 `studio_compose_min_seconds`/`max_seconds`이고, season_0 현재값은 **30/40**(7월에 한 번 고정, 라운드 전환 자동화도 이 컬럼을 안 건드림). → **지금 이 순간 예선/본선 구분 없이 실제 게이트는 30~40초 하나뿐.** 예선 20초(공지 15-30 범위 안)는 잘못 거부되고, 본선 32초(공지 35-40 미만)는 잘못 통과됨. **DB는 손 안 댔음 — 라운드 전환 시 이 컬럼을 어떻게 동기화할지(자동 스위치 vs 수동) 결정 필요, ⑥ 오픈 설계 항목으로도 연결됨.**

**5. 시즌 종료 후에도 프로필에서 점수를 볼 수 있나** → 볼 수 있음(시즌 활성 게이트 없음, `loadMyScores()`가 시즌 상태를 안 봄). 단 **본인 최신 application 1건만** 조회함(`order by created_at desc, limit 1`) — 여러 시즌에 지원한 이력이 있으면 최신 것에 가려서 지난 시즌 점수는 안 보임.

**6. 다른 참가자 점수 공개 계획이 살아 있나** → 지금은 완전 비공개. `scoring_results` RLS 정책은 `scoring_results_admin_read` 단 하나(admin만 SELECT), 본인 점수 화면도 서비스롤 서버액션으로 우회해서 보여주는 구조. **"예선 점수 공개용 RLS" 큐 항목은 레포 파일 / 메모리 / GitHub 이슈 어디서도 못 찾음 — 어디에 적어두신 건지 확인 필요.**

**7. 1인 1편과 재제출이 충돌하나(덮어쓰기 vs 새 행)** → 둘 다 아님. **CAS 기반 1회성 락**: `genesis_applications.status`를 `'selected'` → `'main_round_submitted'`로 조건부 UPDATE(`.eq('status','selected')`)하고, 두 번째 시도는 매칭되는 행이 없어 `already_submitted`로 하드 거부. `render_jobs.submit_intent_at`도 별도 CAS(`.is('submit_intent_at', null)`)로 이중 보호. **새 행도 안 생기고 덮어쓰기도 안 됨 — 재제출 자체가 막힘.**

## ⑥ 열려 있는 설계

- **seasons 종횡비 컬럼 + 에디터 토글 연결**(기본값이 16:9다 — 이게 진짜 과녁). 확인된 사실: `renderComposition`은 `edl.aspect`가 있으면 `STUDIO_OUTPUT_CANVAS` 고정 캔버스로, **없으면 레거시 `canvasFromProbes`(가장 작은 소스 따라감)로 폴백**한다(`render.ts:931`). 에디터가 지금 EDL에 `aspect`를 언제/기본으로 싣는지가 실제 미해결 지점.
- 실격 게이트 스키마 SQL (CHECK 1~3 추가 후 블록 분리)
- #19·#20 email-tick 배선
- `main_round_video_url` 트리거 미구현
- 글로우도 해상도 비례 스케일 (샤픈/크로매틱은 이미 08-23에 스케일 보정됨, 글로우만 남음)

## ⑦ 오늘 끝난 것

- promo_videos 92편 전수 감사 — 로션/화장품 장면 0건, EN/KR 46쌍 정확 일치, approved 92건 전부 확인(단 아래 항목 참조).
- **`promo_videos.approved`는 `/watch` 게이트가 아니다**(본부 오해 정정) — `lib/watch.ts`에 `promo_videos` 참조 0건. 실제 게이트는 `lib/watch-visibility.ts`의 `isRowPublic()`(status/watch_hidden/watch_hold/`genesis_applications.moderation_status='approved'`), 완전히 다른 테이블.
- **워커 캔버스 = `edl.aspect`를 따라간다(가설 적중)** — 코드로 확인: `aspect`가 있으면 `canvasForAspect`, 없으면 레거시 `canvasFromProbes`로 폴백(위 ⑥ 오픈 설계와 직결).

## ⑧ 오늘 배운 것 한 줄

**DB에서 읽은 날짜는 반드시 PT로 변환해서 적는다.** UTC 그대로 말해서 오늘 두 번 틀림.

---

## 참고 — 이번 대화 산출물

- 워터마크 샘플 2장(1080×1920, 18% 반영, 다운로드용) — 다크 배경 1장/밝은 배경 1장 — 채팅으로 전송 완료. 원본: `%TEMP%\claude\...\scratchpad\wm\normal_wm18_still.png`, `bright_wm18_still.png` (세션 스크래치패드, 영구 보관 아님).
- **★로고 색 관련 미해결**: `WATERMARK_LOGO_PATH`가 가리키는 `oxxovo_logo.png`(양 레포 공통, 유일한 로고 파일)는 **보라색 브랜드 로고**다. 두 레포 어디에도 흰색/모노 버전이 없음. "흰 로고가 밝은 장면에서 보이는지" 확인 요청에 대한 실제 에셋은 흰색이 아니었다 — 이 사실도 다음 세션에 넘겨야 함.
