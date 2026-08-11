# 별건 큐 (backlog) — 지수 본체

신규 생성, 2026-08-10. 이전에 이 이름의 파일은 없었다(본부 확인).
컬럼: 번호 · 요약 · 비용 · 선행조건 · 기한. 상태(open/closed/watch)는 참고용으로 덧붙인다.
회차마다 이 파일을 갱신 — 새 항목 추가·완료 항목은 상태만 closed로 바꾸고 남겨둔다(이력 보존).

## OPEN

| # | 요약 | 비용 | 선행조건 | 기한 |
|---|---|---|---|---|
| 2 | r2-orphan-sweep에 promo_videos/cf 보호 배선 | 설계 필요, 실행 비용 $0 | **promo·cf 경로가 UUID 기반 파일명을 쓰기 시작할 때** (지금은 파일명에 UUID가 없어 정규식 불일치로 판정 대상 밖 — 조건부, 날짜 아님) | 조건 성립 시 |
| 3 | `/about` 정적 프리렌더 스테일 — `getCurrentSeason()` 결과가 빌드 시점 HTML에 고정 | $0 (재배포만) | 컨트롤드 배포(`vercel --prod`, main 체크아웃+클린) | 다음 프로덕션 배포 시 자동 해소, 그 전엔 옛 시즌명 노출 가능 |
| 4 | `getCurrentSeason()` "opened" 아닌 "soonest upcoming" 폴백 경로로만 season_0을 잡는 상태 — 이 기간 과거 open을 가진 어떤 행이든 즉시 가로챔 | $0 (코드 주석 완료, `lib/seasons.ts`) | 감시만, 조치 아님 | **2026-09-09 00:00 PT** 지나면 자연 해소 |
| 5 | award-gate 부분 코호트 확정 — `countBlockingFailed`로 이미 닫혔는지 확인만 (새 작업 아님) | $0 | 없음 | 전체 테스트 착수 전 확인 예정 |
| 6 | email-tick 300초 예산 — 제안 3건(중복 alreadySent 제거 / 틱당 예산+deferred 보고 / 429 처리) | 코드 소량 | 전체 테스트(리허설) 실주행(계산 아닌 실측 필요) | 리허설 전 |
| 7 | 멀티 admin — 코드 완료, 마이그+머지 대기 | 마이그 1건 | 8·9와 한 파일로 묶기 | 미정 |
| 8 | A2P 10DLC SMS — 코드 완료, `sms_optin` 마이그 대기 | 마이그 1건 | 7·9와 한 파일로 묶기 | 미정 |
| 9 | Member Hosted Tournament — GRANT 마이그 대기 | 마이그 1건 | 7·8과 한 파일로 묶기 | 미정 |
| 10 | `lib/email/schedule-lines.ts` "결과 안내" bullet 부재 | 미측정 | 레인 A 소관 — 제니2 경유로 지시 | 미정 |
| 12 | **전체 테스트(리허설) 착수 시 선행 확인** — season_test·season_test2의 `scoring_start_at`이 스테일이라 버퍼 게이트에 차단된다. 시계 압축 시 그 컬럼도 같이 당겨야 "워커가 조용히 0건"이 안 난다 | 미측정 | 전체 테스트 계획 자체가 아직 없음(2026-08-10 기준, 8/11·8/13·8/14는 본부가 무효화함) | 전체 테스트 착수 시 |
| 14 | [C]④ Pro Editor | 본체 관여 아님 | 지수2C가 병렬 진행 | 지수2C 소관 |
| 15 | 앱 배포(+283 커밋) | — | 본부 판정: 지수2C의 [C]④ 완료 뒤(제니2 트랙 완료 후). 이 세션의 판단 사항 아님, 대기만 | [C]④ 완료 시 |
| 16 | 이메일 해지 후 재동의 경로 없음(EmailConsentCard는 해지만, 재동의는 로그아웃 후 재로그인으로 안내) | 설계 필요 시 | 9/9 이후 실사용자가 재동의를 요청하는 사례가 생길 때 | 미정 |

## CLOSED (기록 보존)

| # | 요약 | 종결 근거 |
|---|---|---|
| c1 | `in_progress` 영구 skip (lease/타임아웃 부재) | PR #3 lease 4단계, 2026-08-09 프로덕션 로그로 확인(`ITEM_DEADLINE=1389s LEASE_STALE=46min`) |
| c2 | 채점 재현성 3건(Gemini 아암 D 채택 / 모델ID 고정 / Gemini 대응) | 본부 판정 완료. 2026-08-10 Defect1(b) 대조군 실측이 사후 실증 |
| c3 | 렌더 워커(oxxovo-studio) 12커밋 배포 | 배포할 것 없음 — main tip 2069b8df 이미 ACTIVE (2026-08-09 TK 확인) |
| c4 | 예선 41행 전체 재채점 | 불필요 판정(season_0 scoring_results 0행, 41행은 리허설 데이터). 인용 시 "temp 0 채택(8/6) 이전 설정" 축 표기 규율만 남음 — [[feedback-scoring-evidence-settings-era]] |
| c5 | Execution criterion 4 "External uploads cannot be entered at all" 하드코딩 | 지금 안 고침. 종료조건 주석 추가 완료(`scorer.ts`) — 파트너 시즌이 외부 플랫폼을 허용하는 순간 재작업 |
| c6 | community_vote_start_at/end_at 날짜 정정 | Run 완료. BLOCK 0에서 이미 11/13·11/16로 바뀌어 있던 것 확인(레포 밖 집행) |
| c7 | season_0.application_open_at 9/9 여부 판단 | 옮기지 않기로 확정(레포 밖에서 이미 9/9로 집행돼 있었음) — 항목 4로 위험만 추적 |
| c8 | season_test·season_test2 application_open_at NULL 처방 | Run 완료. `getCurrentSeason()` SQL 재현 검증으로 `current_season_id='season_0'` 확인 |
| c9 | official_actors 옛 R2 오브젝트 4개(consistency_i2v.mp4 제외) 삭제 | 실행 완료. 신구 경로 HEAD 재확인(옛 4개=404, 신규=200, mp4=200 무변화) |
| c10 | 11월 운영비 산출 | **폐기(TK 판정, 2026-08-10)** — "필요없는 것에 시간·돈 낭비 말라". 근거: 회사 부담 항목은 이미 실측 존재(인프라 8/10 실측·채점 API 편당 실측), fal은 참가자 선불이라 회사 부담 0, 11월 전 언제든 낼 수 있음. 본부가 인계 브리프만 보고 확인 없이 "진행 중"으로 보고한 게 원인이었다 — 이 세션이 못 찾은 게 맞았다. **다시 찾지 말 것** |
| c11 | season_1001~1006 리허설 잔여 행 노출 차단 | **조치 불필요.** 실측: 6개 행 전부 is_fixture=true·status=completed·open/close NULL, genesis_applications 0건. `getWatchSeasonGroups()`는 영상이 있는 시즌만 그룹을 만들어(bySeason이 videos에서 파생) 0영상 시즌은 애초에 순회 대상이 아니다. `getSeasonMeta()`(비export, 유일 호출부 lib/watch.ts:990)에 is_fixture 필터를 넣는 안은 **기각** — season_test(is_fixture=true)가 실제 영상을 갖고 있어 이 메타(표시명)를 정당하게 필요로 하는 유일한 호출부이고, 필터를 걸면 그 표시명이 퇴화한다(seasonId로 폴백). 막을 노출 경로가 없는데 유일한 실사용처를 깨는 것은 손해만 있다 |
| c12 | E2E 8+1종 | **✅닫힘 2026-08-03 / `7f22cc0`.** 완료 내역(2026-08-02~08-03): 9번 도달성 7/7(`248e8a6`) · 변조 8종→S2 수정 후 10/10(`3df501e`) · KAT 불변 35/35·requireFinal 6/6·시간압축 마감 12/12·실패→재렌더 20/20·동기 경로 회귀 포함(`7f22cc0`). 본부가 옛 브리프의 "2.0d 남았다" 수치를 확인 없이 잔여로 옮긴 게 원인 — 제니2가 올린 지수2A 대기 5건에도 E2E가 없어 교차 확인됨 |
