# 지수(본체) EOD — 2026-09-27

이전: `reports/jisu_hq_2026-09-19_eod.md`(스코어링/GT corpus 트랙, 09-19). 오늘은
그 트랙과 무관 — Watch 공개 안전성 Phase 0(코드 4건 + 챗봇 1건) 설계·구현·배포·
실측을 하루 안에 끝냈고, 이어서 Daily News 현재 구조를 읽기 전용으로 조사했다.
코드는 main에 병합·배포·push 완료(`39dc33b`). DB 쓰기는 TK가 직접 실행한 것
2건(시즌0 날짜 삭제 SQL, service_role GRANT 1건) 외에 없음.

## ★★★최종요약 — 내일은 이 절만 읽고 재개

오늘 순서: **(1) Watch 상세 URL 유출 재현·보고 → (2) Phase 0 4건 설계·구현·검증
→ (3) 챗봇 fail-open 수정 → (4) 승인 후 main 배포(`39dc33b`) + 라이브 실측 11항목
전부 통과 → (5) 배포 정리 중 `node_modules` 오폭 사고, 즉시 보고·복구 →
(6) Daily News 구조 실측 7건(읽기 전용) → (7) 오늘 정리(이 파일)**.

**Phase 0 4건, 전부 배포·검증 완료**:
- P0-1: `getWatchVideo()`에 fixture 게이트가 없어 `/watch/[id]`가 목록 제외 규칙을
  안 따르던 실제 유출(재현: `b442112b-...` 200). `isSeasonPublic()`(`lib/watch-
  visibility.ts`)으로 목록·상세·`/api/watch/stats` 3곳을 하나로 통일. 라이브
  404 확인 완료.
- P0-2: `getCurrentSeason()`의 fallback이 `application_open_at IS NULL`인 시즌도
  후보로 잘못 넣던 결함 수정 — 이제 미확정 시즌은 null 반환(정상).
- P0-3: `isWatchPublic()`(env, Platform Availability)과
  `isCompetitionPublicationEnabled()`(DB, Competition Publication) 책임 분리,
  `isCompetitionWatchPublic()`로 합성. `competition_publication_enabled` /
  `news_publication_enabled`(자리만) 두 키는 SQL만 작성, **DB 삽입은 안 함**
  (`reports/competition_publication_switch_2026-09-27.sql`, TK가 나중에 직접 Run).
- P0-4: `isBeforeApplicationOpen()`이 null 일정을 "이미 열림"으로 오독하던
  fail-open을 fail-closed로 반전 — season_0(status=draft, 전부 null) 실 데이터로
  검증.
- 부수 수정: `lib/chatbot-context.ts`의 `getCurrentSeason()===null` throw 제거
  (P0-2가 정직해진 결과 실제로 매번 터지던 버그) — 챗봇 위젯 502 방지.

**배포**: `39dc33b`, `/api/version`으로 확인. 라이브 실측 11항목(fixture URL 404·
목록/랭킹/투어너먼트/apply/stats/stats+season_test 404/챗봇 200/홈/faq·rules·about)
**전부 통과**.

**사고 1건**: 배포 격리 워크트리에서 `node_modules`를 junction으로 연결했다가
`git worktree remove --force`가 정션을 따라가 메인 저장소 `node_modules`를
통째로 삭제. 즉시 보고 → TK 승인 후 `npm install` 단독 실행으로 복구
(579/579 test pass 확인). **재발 방지: 배포 워크트리에서 node_modules를
junction/symlink로 걸지 않는다.**

**Daily News**: 이 레포(`oxxovo`)에도 `oxxovo-promo`에도 "완성된 뉴스"는 없다.
실체는 `oxxovo-promo/make_news_ski.py`가 만드는 **무음 배경 소재**(fal.ai
seedance-2.0, RIN 앵커, 720p·9:16·4초)뿐이고, 립싱크·자막·엔드카드 합성은
**기획실 2040이 Hedra로 별도 작업** — 최종본의 위치·형태는 이 세션 시야 밖.
**★TK 정정**: "뉴스가 아직 안 만들어진다"가 아니라 **"완성본을 사이트에 올릴
길(파이프라인)이 없다"**가 맞는 진단 — 내 실측 자체는 틀리지 않았고, 최초
해석(본부)이 범위를 좁게 읽은 것.

## 오늘 한 일 (순서대로)

1. Watch/Admin 공개 안전성 1차 실측(게이트·DB 구조·충돌 위험) — 기록과 실제
   3건 불일치 발견(게이트 상태, 공개 영상 수, 시즌 날짜).
2. 시즌0 날짜 삭제 사전 확인(변경 이력·자동 채움 경로·영향 범위·SQL 초안) —
   TK가 SQL 직접 Run.
3. Phase 0 영향 범위 정밀 실측(`isWatchPublic`/`getCurrentSeason`/`isRowPublic`
   전 호출부 file:line 단위) — `getWatchVideo()` fixture 게이트 부재를
   `b442112b-...` 실제 200 응답으로 재현.
4. Phase 0-B: 그 1건만 최소 수정 → 로컬 검증 → 보고.
5. Phase 0 확정 4건(P0-1~4) 지시 접수 → 의견 제시 → 구현 → 단위테스트
   11건 신설(`lib/watch-visibility.test.ts`+6, `lib/seasons.test.ts`+5) →
   e2e 4건 신설(실 DB 대상) → tsc/`next build` 클린 → 브랜치 커밋(`5c41964`).
6. 챗봇 fail-open 발견·수정(`lib/chatbot-context.ts`, `lib/chatbot-tokens.ts`) →
   단위테스트 신설(`lib/chatbot-tokens.test.ts`) → 로컬 라이브(dev server) 검증 →
   브랜치 커밋(`39dc33b`).
7. main 병합·push, 배포 게이트(`check-service-role-grants.mjs`)가 무관 테이블
   (`season0_dates_backup_20260927`) grant 누락으로 1차 배포 거부 → 즉시 중단·
   보고 → TK GRANT 실행 → 재시도 배포 성공 → 라이브 실측 11/11 통과.
8. 배포 워크트리 정리 중 `node_modules` 삭제 사고 → 즉시 보고·중단 →
   TK 승인 후 복구.
9. Daily News 현재 구조 실측 7건(읽기 전용) — `oxxovo-promo` 레포 존재를
   처음 확인, `make_news_ski.py` 전문 확보, `C:\oxxovo\news\ski\` 실물 파일
   직접 확인, `official_actors`의 RIN 행·`promo_videos` 무관계 실측.

## 변경 파일 (main, `39dc33b`까지)

`app/api/watch/stats/route.ts` · `app/page.tsx` · `app/watch-arena/page.tsx` ·
`app/watch/[id]/page.tsx` · `app/watch/page.tsx` · `app/watch/rankings/page.tsx` ·
`lib/seasons.ts`(+test) · `lib/watch-gate.ts` · `lib/watch-nav.ts` ·
`lib/watch-visibility.ts`(+test) · `lib/watch.ts` · `lib/chatbot-context.ts` ·
`lib/chatbot-tokens.ts`(+신규 test) · `lib/competition-publication.ts`(신규) ·
`package.json` · `e2e/phase0-*.mjs`(신규 4개) · `reports/competition_publication_
switch_2026-09-27.sql`(신규, 미실행).

## 기술 부채 목록 (기록만, 손 안 댐)

1. `app/robots.ts` — 여전히 `isWatchPublic()` 단독 게이트(Competition
   Publication 미적용, 의도적 스코프 결정).
2. `platform_config.watch_as_home`의 `value_type='bool'`이어야 할 것이 `'text'`로
   저장돼 있음(신규 키는 처음부터 올바르게 만들어서 충돌은 없음).
3. `e2e/current-season-time-travel.mjs`의 주석("season_0 opened 2026-07-25")이
   날짜 삭제 이후 사실과 다름 — 테스트 자체는 season_test의 실제 과거 open
   날짜(2026-08-31) 덕에 우연히 통과 중.
4. `reports/competition_publication_switch_2026-09-27.sql` 미실행 — 없어도
   default=true라 지금 동작엔 무영향, TK가 편한 때 Run.
5. `lib/chatbot-context.ts`/`lib/ai/review.ts`/`lib/email/inbound-reply.ts`가
   공유하는 `loadChatbotContext()`는 이제 season=null을 정상 처리하지만,
   실제로 시즌이 없을 때 챗봇이 "진행 중인 대회 없음"이라고 명시적으로 답하진
   않고 일반 웹서치로 새는 경향 관찰(코드 버그 아님, KB 프롬프트 문구
   조정 여지 — 이번엔 안 건드림).
6. `getCurrentSeason()` fallback의 동률 시나리오는 P0-2로 "전부 null이면 null
   반환"까지는 고쳤지만, **서로 다른 두 실제 시즌이 같은 open 날짜를 가질 때의
   tie-break**(`season_number` 2차 정렬)는 실측 데이터로 아직 검증 못 함(현재
   시즌이 전부 null이라 재현 불가).
7. Daily News — `official_actors.status='draft'`인 RIN이 이미 파일럿에
   쓰이고 있음(정식 승인 상태 여부 미확인, TK 확인 필요 항목으로만 기록).

## 오늘의 반례/실패 기록 (TK 상시 지시 — 실패도 기록한다)

`node_modules` 삭제 사고 — "무거운 작업을 피하려던" 최적화(junction)가 오히려
더 큰 사고를 만들었다. 무거워 보이는 정공법(워크트리에 `npm install` 새로
돌리기)이 실제로는 더 안전했을 것. "가볍게 가려는 선택이 항상 더 안전한 건
아니다"를 오늘 직접 겪었다.

## 내일 이어갈 지점 (한 줄)

**기획실 2040에 "완성본의 형태와 위치"를 확인하고, 그 답이 오면 Phase 1
(Daily News를 Watch에 붙이는) 설계에 착수한다** — 그 전까지 Phase 1 설계·구현·
DB 쓰기·배포 전부 HOLD.
