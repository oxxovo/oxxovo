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

## A3 + A4 (2026-07-19, TK 결정 반영 -- 완료)
- **A4 = "DRAFT" 유지 확정**. DRAFT_WATERMARK_TEXT env 불변. 코드 변경 0. 종결.
- **A3 = AI 배우 공식 이름**: KIRA(액션/실사, 빨간머리) + YUZU(애니, 주황곱슬). OXXOVO 자체
  마케팅/데모 배우(참가자 자유명명과 별개). commit e882430.
  - **단일 config**: `lib/studio-actors.ts`(STUDIO_ACTORS roster = name+kind+descriptor +
    STUDIO_ACTOR_EXAMPLES). 하드코딩 0 -- 클리어런스 리네임(특히 YUZU)은 **이 파일 한 줄 수정**으로
    전파. plain 모듈이라 client ActorMode가 직접 import.
  - **노출**: ActorMode 이름 입력 placeholder(ko/en)가 config에서 "예: KIRA, YUZU" /
    "e.g. KIRA, YUZU" 렌더. e2e/stage3.mjs 셀렉터 `/^예: /`로 견고화(이름 변경에 안 깨짐).
  - preview-only(session6 off + 이미지모델 active=false) -- 공개 노출 0.
  - **스샷 주의**: 이름 필드를 실제로 보려면 이미지모델 active=true + 브라우저 로그인 흐름 필요
    (active 게이트 유지 위해 placeholder 하나 보려고 안 켬). 다음 데모(active 켜는 시점)에 육안 확인.

→ **A1~A4 전부 완료. Studio 지수2 트랙 매듭.** 남은 건 발사 스위치(C) + 본체 영역(③ getSeasonPhase).

## 발사 게이트 추가 (TK 요청, go-live 체크리스트 Phase E에 반영)
- **제출 moderation 프로드 실환경 1회 확인**: 프로드 OPENAI키 미배선이면 전 제출이 pending 고착
  → Watch에 영상 0 = 발사일 조용한 장애. session6 ON 후 정상 콘텐츠 1건 제출 → approved + Watch
  노출 확인. `reports/studio_go_live_checklist_2026-07.md` Phase E에 항목 추가함.
