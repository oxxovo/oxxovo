# A2 발사 전 정리 -- moderation 증명 + 단일 경로 통일 (2026-07-19, 지수2)

feat/studio-budget-guard. tsc0 + build0 + npm test 23/23. push 완료 (9453182).
A1(위생) = oxxovo-studio 스트레이 probe 2개 삭제, 워킹트리 clean.

## 핵심 발견 (지어내지 않은 사실)
A2-2(studio moderation)의 **배선+timeout 하드닝이 이미 완비**돼 있었다. 07-08 작업
(a5d2864)이 Stage 3(2.4 submitRender)에서도 보존됨. 전수조사로 확인:
- genesis_applications 새 row **민팅 insert는 정확히 3곳**뿐 -- `/api/apply`(route.ts:135,
  mod 191-197), `submitGeneration`(lib/studio.ts:1119, mod 1117), `submitRender`(1632,
  mod 1630). 나머지 40여 참조는 기존 row select/update(statement 불변) = **우회 구멍 없음**.
- `lib/moderation.ts`: 키없음/에러/**5s AbortController timeout** 전부 -> 'pending'(fail-safe).
- `isPublicRow`(watch.ts:84): `moderation_status==='approved'`만 공개 -> flagged/pending 비공개.

→ 미완이던 것은 **불변식을 고정하는 증거**뿐. 그걸 추가했다.

## 변경 (commit 8505699 = 증명 / 9453182 = 단일경로)
### A2-2 증명
- `lib/moderation.test.ts` -- 결정론적($0, CI, mock fetch). flagged->차단, 키없음/에러/
  timeout/빈content->pending, clean->approved. SAFETY PROPERTY: 비승인 결과는 절대 approved 아님.
- `e2e/moderation-gate.mjs` -- 실 OpenAI에 **실 moderateSubmission** 호출(복제 아님).
  악성 문장->차단, clean->approved. 무료(moderation)·DB/브라우저 無. 키 없으면 live SKIP.
- CI(tests.yml)가 이제 `npm test`(crypto+studio-verify+moderation) 실행.

### A2-1 배너 + A2-3 단일 경로
- 서버: `submitGeneration`이 compose 시즌이면 `compose_required`로 거부(양 라운드).
  raw 단일 클립이 application 민팅하는 갈림길 차단. 비-compose 시즌 불변.
- UI: compose 시즌에서 per-clip "Submit this video" + 인라인 ApplicantForm + /apply 배너 숨김.
  compose CTA가 유일 진입. compose_required 문구 en/ko.

## TK 확인 -- 둘 다 처리됨 (2026-07-19, A2 종결)
1. **가정 = OK 확정**: `studio_compose_enabled == compose-only entry`(시즌0 규칙 일치, 하이브리드
   플래그 불필요). → A2-3 종결.
2. **live 증명 = 유닛+CI로 종결**: 프로드 OPENAI_API_KEY가 Vercel **Sensitive 변수**라 `vercel env
   pull`이 값을 빈칸으로 가져옴([[reference_vercel_sensitive_env]] 함정, 실측 value_length=0) --
   이건 프로드 키 유출을 막는 **올바른 설정**이라 낮추지 않음. 게이트 정확성은 이미 유닛
   `npm test` 23/23(매 push CI) + 코드 3경로 검증으로 잠김. live는 OpenAI 자체 동작 재확인일 뿐이라
   생략(TK 결정). `e2e/moderation-gate.mjs`는 보존 -- 유효한 OPENAI 키가 생기면 그대로 실행 가능
   (임시 키 필요 시 platform.openai.com 새 키->1회 실행->폐기).
   당겨온 프로드 시크릿 파일(.env.vercel.local)은 즉시 삭제함.

## 미착수 (TK 결정 대기, 별건)
- A3 AI 배우 이름(KIRA/SUNNY) / A4 워터마크 문구 -- 결정 오면 각 30분.
- 발사 게이트 B1 fal 동시성(2~4주 리드) 등은 [[project_jenny2_resume_2026-07-19]] 참조.
