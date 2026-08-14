# 별건 큐 (backlog) — 지수 본체

신규 생성, 2026-08-10. 이전에 이 이름의 파일은 없었다(본부 확인).
컬럼: 번호 · 요약 · 비용 · 선행조건 · 기한. 상태(open/closed/watch)는 참고용으로 덧붙인다.
회차마다 이 파일을 갱신 — 새 항목 추가·완료 항목은 상태만 closed로 바꾸고 남겨둔다(이력 보존).

## OPEN

| # | 요약 | 비용 | 선행조건 | 기한 |
|---|---|---|---|---|
| 27 | 스트레이 Vercel 프로젝트 `oxxovo-lane-c` — 배포 직후엔 정리하지 않는다(HQ 2026-08-13 명시 지시), 무엇을 남겼는지/왜 지우면 안 되는지 근거 미확인 상태로 존치만 | $0 | 배포 안정화 관찰 기간 이후 | 미정 |
| 28 | **워커 render/generation 레인 — 실제 claim→완료 관측 아직 없음.** 2026-08-13 스위치 ON 직후 확인한 건 "막힌 게 없다"(양쪽 큐 queued/processing/claimed 0건, ffmpeg 핀 일치)뿐이다. 스위치가 막 켜져서 처리할 일감 자체가 없었던 것과 실제로 도는 것은 다른 주장 — 조용한 이유가 "일감 없음"인지 "돌다가 막힘"인지 아직 구분 안 됨 | $0(관측만) | 실참가자 job이 실제로 들어와서 claim→완료까지 가는 순간 | 다음 재개 시 최우선 확인 |
| 24 | `get_active_application_count`(옛 카운트 함수) — `count_active_registrations`로 교체(2026-08-12, `season_registration_reminder` SQL **Run 완료**) 후 호출처 0. DROP 안 함(원 정의를 이 레포에서 못 봤어서 "안전하게 지울 수 있다"를 증명 못 함) — 일정 기간 관찰 후 DROP 후보 | $0 | 없음 | 판단 시점 미정 |
| 25 | 등록수 알림(D-14/7/3/1) 멱등키가 `reminder_day` 값만 본다 — 연기로 `registration_close_at`이 밀려도 이미 보낸 회차(예: D-14)는 새 날짜 기준으로 재발송 안 됨. "역산은 확인했지만 멱등은 마감버전을 안 본다"는 한계, HQ 2026-08-12에 보고했고 이번 범위에서 해결 안 함 | 설계 필요 시 | 실제 연기가 한 번이라도 발동할 때 체감됨(season_0 기준 발동 여지 없음) | 미정 |
| 2 | r2-orphan-sweep에 promo_videos/cf 보호 배선 | 설계 필요, 실행 비용 $0 | **promo·cf 경로가 UUID 기반 파일명을 쓰기 시작할 때** (지금은 파일명에 UUID가 없어 정규식 불일치로 판정 대상 밖 — 조건부, 날짜 아님) | 조건 성립 시 |
| 3 | `/about` 정적 프리렌더 스테일 — `getCurrentSeason()` 결과가 빌드 시점 HTML에 고정 | $0 (재배포만) | 컨트롤드 배포(`vercel --prod`, main 체크아웃+클린) | 다음 프로덕션 배포 시 자동 해소, 그 전엔 옛 시즌명 노출 가능 |
| 4 | `getCurrentSeason()` "opened" 아닌 "soonest upcoming" 폴백 경로로만 season_0을 잡는 상태 — 이 기간 과거 open을 가진 어떤 행이든 즉시 가로챔 | $0 (코드 주석 완료, `lib/seasons.ts`) | 감시만, 조치 아님 | **2026-09-09 00:00 PT** 지나면 자연 해소 |
| 5 | award-gate 부분 코호트 확정 — `countBlockingFailed`로 이미 닫혔는지 확인만 (새 작업 아님) | $0 | 없음 | 전체 테스트 착수 전 확인 예정 |
| 6 | email-tick 300초 예산 — 제안 3건(중복 alreadySent 제거 / 틱당 예산+deferred 보고 / 429 처리) | 코드 소량 | 전체 테스트(리허설) 실주행(계산 아닌 실측 필요) | 리허설 전 |
| 7 | 멀티 admin — **마이그는 이미 Run됨**(2026-08-11 실측: `is_staff()` RPC 200·role CHECK 확인). 남은 건 코드 머지뿐(`feat/multi-admin`, `bbc1356`) + 매니저로 올릴 실사용자 부재(현재 profiles 7행 중 실사용자는 대표님 1명, 나머지는 테스트/픽스처 계정) | 머지 1건 | 후보가 될 실사용자가 먼저 가입 | 미정 |
| 23 | 등록 취소(참가자가 스스로 등록을 물릴 수 있는 경로) — HQ 2026-08-12 명시적으로 이번 범위 제외. 정원 카운트+Founding 순번이 등록에 얽혀 있어 취소 시 무엇을 되돌리나(대기자 승격? Founding 번호 반납?)가 별건 설계가 필요 | 설계 필요 | 없음 | 미정 |
| 12 | **전체 테스트(리허설) 착수 시 선행 확인** — season_test·season_test2의 `scoring_start_at`이 스테일이라 버퍼 게이트에 차단된다. 시계 압축 시 그 컬럼도 같이 당겨야 "워커가 조용히 0건"이 안 난다 | 미측정 | 전체 테스트 계획 자체가 아직 없음(2026-08-10 기준, 8/11·8/13·8/14는 본부가 무효화함) | 전체 테스트 착수 시 |
| 14 | [C]④ Pro Editor | 본체 관여 아님 | 지수2C가 병렬 진행 | 지수2C 소관 |
| 15 | 앱 배포(+283 커밋) | — | 본부 판정: 지수2C의 [C]④ 완료 뒤(제니2 트랙 완료 후). 이 세션의 판단 사항 아님, 대기만 | [C]④ 완료 시 |
| 16 | 이메일 해지 후 재동의 경로 없음(EmailConsentCard는 해지만, 재동의는 로그아웃 후 재로그인으로 안내) | 설계 필요 시 | 9/9 이후 실사용자가 재동의를 요청하는 사례가 생길 때 | 미정 |
| 17 | 발송 콘솔 완료(`d791091`) / cron 실트리거 미확인 — 배포 후 | $0 | [C]④ 완료 → 앱 배포(#15)와 같은 게이트. 확인 항목은 `reports/studio_go_live_checklist_2026-07.md` Phase C3에 등재 완료 | 배포 후 첫 :07/:22/:37/:52 |
| 22 | `checkApplyGate` 경유로 `lib/studio.ts`가 `next/headers`·JSX(`lib/email/send.tsx`)를 끌어오는 문제, 2026-08-12에 테스트 훅 스텁 2개로 막았다 — **당장은 맞지만 선례가 다르다**: `lib/partners.ts`는 같은 next/headers 문제를 순수 분리(DB-only 헬퍼와 이메일 발신부를 별 파일로)로 풀었다. `lib/membership.ts`도 같은 구조(순수 판정 함수 vs `getUserOrNull` 쿠키 의존)라 분리 여지가 있다 | 리팩터 소량 | 없음, 원할 때 | 미정 |
| 26 | **`logEmail()`이 DB insert 에러를 삼킨다** — `lib/email/log.ts:84-87`, insert 실패 시 `console.error`만 하고 throw 안 함. `executeSend`(`lib/email/send.tsx:240-251`)는 이 반환을 안 보고 그대로 `{ ok: true }`를 돌려준다 → 실제로는 로그 행이 안 남았는데 "성공"으로 집계됨 → 다음 틱 `canSend`가 "안 보냈다"로 오판 → 무한 재발송. 2026-08-13에 연기 통보 메일에서 실측(2번째 이상 연기 시 옛 유니크 인덱스 위반 → 이 경로로 조용히 반복 발송). **인덱스(4번째 SQL, `email_logs_dedup_deferral_notice`) Run 완료(2026-08-13)로 이번 증상은 사라졌지만, 삼킴 자체는 남아 있다** — `executeSend`를 지나는 모든 템플릿이 공유하는 코드라 다른 이유(네트워크 순단·컬럼 제약 변경 등)로 또 insert가 실패하면 같은 무한 재발송이 재발한다. "실패했는데 성공으로 보고"는 이 프로젝트가 반복 차단해온 형태([[feedback_absent_is_not_zero]] 계열) | 코드 소량(로그 insert 실패를 `executeSend`가 보고 실패로 처리하도록) | 없음, 발송 경로라 배포 직전엔 손 안 댐(HQ 2026-08-13 지시) | 미정 |
| 20 | `below_floor`(연기 3회 소진+80 미만) 집행 미정 — 지금은 season-tick 상태전환+예선홀드 자동공개만 막고, 채점/본선/시상은 원래 일정대로 계속 진행됨("성립 안 함"이 실제로 아무것도 안 멈춤). **알림 중복억제는 완료**(`lib/below-floor-alert.ts`, pricing-health의 `alert_state_` 시그니처 패턴, HQ 2026-08-12 지시대로 "알림만, 자동 취소 없음"). 실제 집행(무엇을 할지)은 여전히 대표님 판정 사항, 미정으로 남김(`reports/season_defer_timestamp_audit_2026-08-12.md`) | 판정 필요 | 최초 `below_floor` 발동 전(season_0 기준 3회 연기 소진 시점 — 지금 일정으로는 발동 여지 없음) | 판정 후 |
| 29 | `main_round_twist` 언어별 컬럼 분리 — 단일 컬럼(TEXT 1개, KR/EN 별도 컬럼 없음)이라 사이트 언어 토글이 이 값을 못 바꾼다. 라벨(`main_round_theme_label`)이면 영문 단일 표기로 넘어가지만, 트위스트는 참가자가 읽고 작품을 만들어야 하는 주제라 한쪽 언어만 넣으면 절반이 못 읽는다. 지금은 TK 판정대로 한 컬럼에 EN 먼저 + KR 병기("A scene applying lotion to the face (얼굴에 로션을 바르는 장면)")로 우회(2026-08-14, `reports/season0_main_round_twist_2026-08-14.sql`) | 컬럼 분리 시 스키마+코드 소량 | 없음 | 미정 |

## CLOSED (기록 보존)

| # | 요약 | 종결 근거 |
|---|---|---|
| c10b | `lib/email/schedule-lines.ts` "결과 안내" bullet 부재 | `6256e33`(2026-08-08 최초 배선, 결과안내 컬럼 없어 미포함)→`d918402`(같은 날, AI심사 컬럼 타입 누락 수정)→`3610be3`(2026-08-10, `prelim_results_announcement_at` 전용 컬럼 확보로 결과안내 불릿 추가). 2026-08-13 이 창에서 season_0 실값(`prelim_results_announcement_at=2026-11-08T20:00:00Z`)을 `formatScheduleMoment`/`prelimReceiptLines`에 직접 통과시켜 재검증: KR "11월 9일 오전 5시(한국 시간)" / EN "Nov 8, 12:00 PM PT" — 세 불릿(공개/AI심사/결과안내) 전부 각자 컬럼에서 렌더, 타이핑된 리터럴 없음. DB 쓰기 0 |
| c21 | 21. 멤버십 게이트를 실제 참가 경로(`registerForSeason`)에 배선 | HQ 2026-08-12 지시대로 집행(판정 아님, 이미 확정된 정책): `checkApplyGate`를 `registerForSeason`/`submitGeneration` 5a/`submitRender` 7a 세 곳(모두 신규 행 mint 시점, 정원 판정과 같은 자리) 전부에 배선, fail-closed(`getMembershipState`가 이미 그렇게 설계돼 있음, 수정 불필요). 실측 검증: `scripts/zz_probe_membership_gate_2026-08-12.mjs` — Founding 캡을 `claimed+1`로 실측 낮춰 실제 101번째(zz_ B)가 `registerForSeason`에서 `membership_required`로 막히고 100번째(zz_ A, 실제 Founding 클레임)는 통과하는 것을 확인 후 전부 원복(카운터 2→1, 캡 100 복귀, zz_ 계정/행 0건 잔존 확인). 부수: 이 배선이 `lib/dst-boundaries.test.ts`를 깨서(`lib/studio.ts`가 새로 끌어온 `next/headers`+`lib/email/send.tsx`를 `scripts/test-hooks.mjs`가 스텁 안 하고 있었음) 그 두 스텁을 공유 테스트 훅에 추가, 507/507 복구 |
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
| c13 | A2P 10DLC SMS(8) — 마이그+코드+배포 전부 완료 | 2026-08-11 실측: `profiles`에 sms_optin 6컬럼 전부 존재 + `SmsConsentCard.tsx`가 이미 `main`에 병합돼 있음(2026-06-23 라이브). 재확인 불필요 |
| c14 | Member Hosted Tournament(9) — GRANT 마이그 완료 | 2026-08-11 실측: `platform_config`/`member_tier_config`/`partner_tournaments` service_role 조회 정상(예전 permission denied 해소) + `profiles.partner_tier` 존재. `/host/new`도 이미 `main` 병합(마스터스위치 기본 OFF, 켜는 건 별개 비즈니스 판단) |
| c15 | award-gate 부분 코호트 확정(5) — 이미 닫혀 있음 | `lib/awards-gate.ts` Gate 2가 `scoredCount < submittedCount`면 사유 불문 무조건 막음(재시도 소진 실패도 포함, 9/10도 막힘을 테스트로 확인). countBlockingFailed(예선용, 다른 코드)보다 엄격한 상위호환이라 별도 배선 불필요 |
| c16 | Winners nav 항목(soon:true) 처리 | **철회 → 유지 확정(2026-08-11 TK).** "코드에 없다=필요 없다"가 아니었음. 설계 승인: 시즌 드롭다운(기본 all, is_fixture 제외) + award_rank 시즌 횡단 + scoring_results(round='main') join 등급 + 카드형. 새 테이블 없음(genesis_applications+scoring_results로 충분). 착수는 발송 콘솔(#17) 완료 후 |
| c17 | `email_optin_migration_2026-08-11.sql` Run 완료 | `profiles`에 email_opt_in/email_consent_at/email_consent_ip/email_consent_text/email_opt_out_at 5컬럼 생성 확인(BLOCK 0=0행 → BLOCK 2=5행 → BLOCK 3 전부 false). 가입 시 동의 UI(`app/login`)+콜백 기록(`app/auth/callback`)+수신거부(`/profile` EmailConsentCard·List-Unsubscribe)까지 코드 배포 완료(`31c63d5`~`e13c878`) |
| c18 | `admin_broadcasts` 테이블 생성 완료 (참가자 연락처 발송 콘솔) | 2026-08-11 Run 확인: tbl 1 / idx 2 / trg 1(updated_at 자동갱신) / rls true / policy 0(service_role 전용, fail-closed). 발송 루프(`lib/email/broadcast-tick.ts` + `/api/cron/broadcast-tick`) 코드 완료, 화면(`/admin/broadcasts`)은 다음 순서 |
| c19 | 배포 대기 13건, `feat/studio-budget-guard`에는 있고 `origin/main`엔 없던 상태 | 2026-08-12/13 HQ 지시로 머지 집행: `feat/studio-budget-guard ← main`(`29382e9`, CI green) → `main ← feat/studio-budget-guard`(`33aa399`, tsc·507/507·`next build` 전부 clean, 충돌 0) → `main` push(`a8b4f27..33aa399`) → CI green → `deploymentEnabled.main=false` 그대로(자동배포 없음, `builtAt` 불변 확인). ★배포 자체는 별개 — lane-c(제니2 트랙, 앱 16·워커 5) 병합 뒤 대표님이 승인 |
