# 화면 대장 (Surface Inventory)

**작성:** 지수 · 2026-08-30 · **조사만, 코드 변경 0건.**
**방법론 한계 먼저:** ②DB 감사는 TypeScript/JS 코드(`app/`,`lib/`,`oxxovo-scoring/src/`)를 grep한 것이다. **Postgres RPC 함수(`defer_season_schedule` 등) 내부는 이 방법으로 못 본다** — RPC가 그 컬럼을 실제로 읽고 있을 수 있다. 이 문서에서 "안 읽힌다"고 적은 항목 중 RPC 후보가 있는 건 별도로 표시했다. 확정하려면 `pg_get_functiondef`로 RPC 본문을 직접 봐야 한다([[feedback_db_object_absence_unprovable_by_repo]]).

---

## ⛔ 최우선 — `/about` 특허·상표 raw 값 (`lib/ip-info.ts`)

**고치지 않았다. 값만 그대로 옮긴다.** 대조는 대표님이 실제 서류로 하신다.

| 항목 | 코드에 있는 값 | 위치 |
|---|---|---|
| 특허청 | Korean Intellectual Property Office (KIPO) | `lib/ip-info.ts:11-12` |
| **출원 번호** | **코드에 필드 자체가 없다.** `office`/`filingDate`/`filingDateISO`/`titles`/`status`/`jurisdictionShort` 6개 필드뿐, 출원번호(application/serial number)를 담는 필드가 존재하지 않는다 — 전체 리포 grep(`patent`,`trademark`,`IP_INFO`) 결과 다른 파일에도 없음 | `lib/ip-info.ts:9-22` 전체, 부재 확인 |
| 출원일 | `May 19, 2026` (ISO: `2026-05-19`) | `lib/ip-info.ts:14-15` |
| 발명 명칭 (2건) | ① `Production-Stage Authentication & Session-Bound Generation` ② `Server-Authoritative Tournament State Control` | `lib/ip-info.ts:16-19` |
| 특허 상태 | `pending`(코드 리터럴, 하드코딩 — 실제 특허청 조회 연동 없음) | `lib/ip-info.ts:20` |
| 특허 관할 | `Korea`(표시상 "Korea"로만, KIPO와 별개 필드) | `lib/ip-info.ts:21` |
| 상표명 | `OXXOVO` | `lib/ip-info.ts:24` |
| 상표 분류 | `9, 35, 38, 41, 42, 45` (6개) | `lib/ip-info.ts:25` |
| 상표 상태 | `pending`(하드코딩) | `lib/ip-info.ts:26` |
| 상표 관할 | `Korea` | `lib/ip-info.ts:27` |
| 국제출원 상태 | `pending`, 경로="Paris Convention"(파리협약) | `lib/ip-info.ts:29-32` |

**부수 확인(코드 사실, 판단 아님):** 이 값들은 전부 `export const IP_INFO = {...} as const` 리터럴 — DB·외부 조회 없이 코드에 박혀 있다. 파일 1-2행 자체 주석: "To be migrated to a `platform_config` table once admin editing is needed." `/about`(112-122행), `/rules`(275행), 그리고 전 페이지 공통 푸터(`formatFooterStatusLine()` — `/apply`,`/faq`,`/guidelines`,`/membership`,`/privacy`,`/terms`,`/tournament`,`/watch-arena`,랜딩 등 9곳 이상)가 전부 이 리터럴을 그대로 읽는다 — 값이 틀렸다면 파급 범위가 사이트 전역 푸터까지다.

---

## ① 화면 쪽 — 참가자·관객이 도달하는 화면

| 화면 | 문안 위치 | 출처 | DB 값 일치 | **이 문장이 약속하는 기능이 실재하나** | 마지막 확인 |
|---|---|---|---|---|---|
| **랜딩 `/`** | `app/_landing/LandingView.tsx` | 대부분 `getCurrentSeason()`/`getMembershipLandingData()` 라이브. FAQ 9문항은 `lib/admin-i18n.ts` `faq_q1-9`/`faq_a1-9`(하드코딩 문자열, 일부는 `season.*` 인자를 함수로 받아 보간) | FAQ #8 인물기록 오늘 수정(`e7f82b7`) — 나머지 FAQ 문항 8개는 오늘 개별 검증 안 함 | 미확인(이 축은 오늘 신설, 8문항 소급 확인 안 함) | 2026-08-30(FAQ #8만) |
| **`/apply`** | `app/apply/page.tsx` | `getCurrentSeason()` 라이브 + 동의 체크박스 2곳 하드코딩(오늘 수정) | 오늘 수정·배포(`be7c51b`) | O — 무결성 검사·실격 조항 둘 다 실재 코드 확인됨(오늘) | 2026-08-30 |
| **`/rules`** | `app/rules/page.tsx` | 100% `season.*` 라이브(날짜 하드코딩 0곳, 오늘 전문 확인) | 오늘 4건 수정·배포(`b310f66`) | O — 오늘 전문 검증 시 이 축까지 같이 확인됨 | 2026-08-30 |
| **`/faq`** | `app/faq/page.tsx` `buildFaqs()` | `season.*`/`mem.*` 라이브(15문항, 하드코딩 없음) | 값 자체는 라이브라 안전하지만 **제니3 통합본 27문항으로 교체 대기 중**(미착수) | 미확인 | 미확인(교체 전) |
| **Watch `/watch`,`/watch/[id]`,`/watch/rankings`** | `app/watch/*`, `lib/watch.ts` | 카드 배지·점수·투표는 100% DB(`genesis_applications`/`scoring_results`/`watch_votes`) 라이브. 리허설 배너/태그 문구는 `lib/admin-i18n.ts`(`rehearsal_notice`/`rehearsal_card_tag`, 오늘 신설) 하드코딩 | 오늘 신설·배포(`1f9b652`) — `flag_spread_threshold`류 dead-column 문제는 Watch 배지엔 해당 없음(배지는 실제 `scoring_results.verified_score` 사용) | O — 좋아요/조회/투표 전부 실재 테이블에 씀(오늘 여러 차례 실측) | 2026-08-30 |
| **시합 로비 `/tournament`,`/tournament/[id]`** | `app/tournament/page.tsx`,`SeasonDetail.tsx` | `season.*` 라이브 | 오늘 챗봇 위젯만 제거(`5269253`), 본문 카피는 today 검증 안 함 | 미확인 | 미확인 |
| **챗봇(랜딩+Watch 위젯)** | `lib/chatbot-kb.ts` | 100% `{{token}}`(`lib/chatbot-tokens.ts`가 `season`/`membership`/`platform_config`/`getRevealedTheme()`에서 매 요청마다 해석) | 오늘 전면 재작성·라이브 종단 확인(`5269253`→`82bac8c`) | O — 답변이 가리키는 정책 전부 실측 근거 있음 | 2026-08-30 |
| **인바운드 이메일 자동응답(info@)** | `lib/email/inbound-reply.ts`(챗봇 KB 재사용) | 챗봇과 동일 토큰 | **구조적으로 못 돎** — `info@oxxovo.ai` MX가 Google Workspace라 Cloudflare Worker 자체가 못 탐(오늘 실측, DNS 확인) | ⛔ **아니오 — "자동응답이 온다"는 전제 자체가 이 채널에선 성립 안 함**(이 축이 걸러낸 첫 실사례) | 2026-08-30 |
| **이메일 13종(+멤버십 2종)** | `lib/email/templates/*.tsx` | 대부분 `formatDeadlinePT`/`prelimReceiptLines` 등 라이브 함수. 일부는 프롭으로 넘어온 season 필드 | 오늘 렌더 전수 확인(38개 HTML), 버그 5건 발견·수정·배포(`a322291`,`1461a5e`) | O — 발송 트리거(cron/워커) 오늘 별도 확인 안 함, 렌더만 확인 | 2026-08-30(렌더만) |
| **`/membership`** | `app/membership/page.tsx`+`actions.ts` | `getMembershipLandingData()` 라이브(`platform_config`) | 오늘 검증 안 함(가격 계산 로직은 확인했으나 화면 문구 자체는 미검토) | 미확인 | 미확인 |
| **`/login`** | `app/login/page.tsx` | 매직링크 흐름, `CONSENT_DICT`(17/25행, "언제든 설정에서 opt-out") 하드코딩 문구. **166행 "The link expires shortly"는 실제 TTL 값 없이 얼버무린 문구** | 해당 없음(날짜·금액 언급 없음) | O — opt-out은 `/profile` `EmailConsentCard`의 실재 `unsubscribeEmail()`로 연결됨(아래 ①-2 대조 참고) | 2026-08-30(Explore) |
| **`/profile`(SMS/이메일 카드)** | `app/profile/SmsConsentCard.tsx`,`EmailConsentCard.tsx`,`actions.ts` | 카드 대부분 라이브(위 `/profile` 행과 별도로 동의 카드만 재확인). `WinnerCelebrationCard.tsx`(187행) 상금은 라이브(`toLocaleString`) | 해당 없음(동의 문구는 날짜/금액이 아니라 정책 서술) | O — `saveSmsConsent()`/`unsubscribeEmail()` 둘 다 실재 서버 액션(아래 ①-2 대조표) | 2026-08-30(Explore) |
| **`/terms`** | `app/terms/page.tsx` | 정적 법률 문서, 시즌 값 인용 없음. "Cancellation"(51-56행)은 **멤버십 구독 해지**(실재 기능, `cancelMembership()`) — E5(참가 취소)와 다른 대상, 충돌 없음. **8행 "Last updated: August 2026" 하드코딩**(자동 갱신 안 됨). §8(48-57행) 환불/과금 정책 문구가 `membership_creator_price_usd` 등 라이브 값과 별개로 정적 서술 | 시즌값 인용 없어 해당 없음. "Last updated" 자체는 스탬프 미연동(위 리스크 참고) | O — §8 해지 조항은 `cancelMembership()` 실재 확인됨(과거 세션). §11/§12 SMS·이메일 옵트아웃도 실재(아래 ①-2 대조표) | 2026-08-30(Explore) |
| **`/privacy`** | `app/privacy/page.tsx` | 정적 법률 문서. **8행 "Last updated: August 2026" 하드코딩**. 39행 벤더명(Supabase/Vercel/Cloudflare) 하드코딩 나열 — 벤더 교체 시 스테일 위험 | 해당 없음(시즌값 없음) | O — §10/§11 서술(동의 시각·IP·문구 기록)은 실재 컬럼(`sms_consent_at/ip/text`,`email_consent_at/ip/text`)과 일치 | 2026-08-30(Explore) |
| **`/welcome`,`/welcome/nickname`** | `app/welcome/nickname/page.tsx` | 시즌/DB 조회 없음(온보딩 전용). `maxLength={30}`(닉네임)/`{80}`(실명), "한 번 프로모 영상에 들어가면 못 뺀다"·"첫 제출 시 잠긴다"(29-31행) — 코드 주석에 "TK 승인 문구, 의역 금지"로 명시됨 | 해당 없음(시즌값 없음) | 미확인 — "잠긴다" 로직 자체(`lib/nickname.ts`)는 오늘 코드로 재확인 안 함 | 2026-08-30(Explore) |
| **`/pre-register`** | `app/pre-register/page.tsx` | 시즌 조회 없음, 숫자/날짜 없음. 이용약관/개인정보 링크 연결뿐 | 해당 없음 | O — 링크 연결뿐, 약속하는 기능 없음 | 2026-08-30(Explore) |
| **`/signup`** | `app/signup/page.tsx` | `/login`으로 단순 리다이렉트, 문안 없음 | 해당 없음 | O — 문안 자체가 없음 | 2026-08-30(Explore) |
| **`/about`** | `app/about/page.tsx` | 시즌명·패널라벨은 `getCurrentSeason()` 라이브. **113행 특허 출원일 "May 19, 2026", 122행 상표 분류(9,35,38,41,42,45) — `lib/ip-info.ts`에 하드코딩, 코드 주석에 "admin 편집 필요해지면 platform_config로 이관 예정"이라 이미 자인**. 148행 "Las Vegas, Nevada" 주소 하드코딩 | ⛔ **최우선 — 법적 사실 주장, DB 근거 없음.** 값 원문은 아래 ②-최우선 섹션. 대조는 TK 몫, 이 문서는 값만 보고 | ⚠️ 이 축이 아니라 별도의 상위 축(법적 사실 여부) — 위와 같은 사유로 이 문서에서 판정 안 함 | 2026-08-30(Explore) |
| **`/guidelines`** | `app/guidelines/page.tsx` | 완전 정적("HQ 2026-06-28 공급 카피" 주석). 50-52행 모더레이션 정책 문구("당사 재량으로 조치") 정적 | 해당 없음 | O — 모더레이션 자체는 재량 서술이라 반증 불가능한 유형(허위 가능성 낮음) | 2026-08-30(Explore) |
| **`/studio`, `/studio/compose`** | `app/studio/page.tsx`(1700+줄), `app/studio/compose/page.tsx` | 크레딧/가격/캡/모델ETA 전부 `loadStudioState`/`loadComposeState` 라이브. **193/319행 "150~250자" 자기소개 글자수 카피가 `STATEMENT_MIN/MAX` 상수와 별개로 문자열로 하드코딩**(내부 일치하지만 시즌설정 아님) | 크레딧/가격/캡 라이브 확인(값 자체는 오늘 안 뽑아봄, 소스만 확인) | O — "제출은 영구적이다" 문구는 단일제출 모델과 일치(과거 세션에 코드로 확인됨) | 2026-08-30(Explore) |
| **`/lobby-preview`** | `app/lobby-preview/page.tsx` | 오늘 "Grand Final Arena"→"Finals Arena" 개명만 확인, 전수는 안 함 | 미확인 | 2026-08-30(부분) |

### ①-2 동의문 4중 사본 — 코드로 대조한 결과

**`consent_text`는 어디에 저장되나(코드로 답):** DB에 저장되는 스냅샷은 두 개 — `profiles.email_consent_text` ← 상수 `EMAIL_CONSENT_DISCLOSURE`(`app/login/actions.ts:34-35`), `profiles.sms_consent_text` ← 상수 `SMS_CONSENT_DISCLOSURE`(`app/profile/actions.ts:365-366`). 저장 시점에 **언어 분기가 없다** — `recordEmailConsentForUser()`/`saveSmsConsent()` 둘 다 이 상수를 그대로 박아 넣을 뿐, 사용자가 화면에서 KO를 봤는지 EN을 봤는지는 저장 안 됨.

**넷(정확히는 화면 4곳+DB 2곳)이 같은가:**

| 비교 대상 | 결과 |
|---|---|
| `EMAIL_CONSENT_DISCLOSURE`(저장값) vs `CONSENT_DICT.en.text`(`/login` 화면 EN) | **바이트 단위로 동일**("By creating an OXXOVO account, you agree to receive competition updates...") |
| `EMAIL_CONSENT_DISCLOSURE`(저장값) vs `CONSENT_DICT.ko.text`(`/login` 화면 KO) | **다르다** — KO는 번역문("OXXOVO 회원으로 가입하시면...")이고 저장되는 건 이 영문 원문뿐 |
| `SMS_CONSENT_DISCLOSURE`(저장값) vs `SmsConsentCard.tsx` EN 조각 3개 조립(`disclosure_pre`+`STOP`+`disclosure_mid`+`HELP`+`disclosure_post`) | **바이트 단위로 동일** |
| `SMS_CONSENT_DISCLOSURE`(저장값) vs `SmsConsentCard.tsx` KO 조각 조립 | **다르다** — 같은 이유(번역문, 저장 안 됨) |
| 저장값 vs `/terms` §11·§12, `/privacy` §10·§11(법률 문서 서술) | 표현은 다르지만(법률 문서는 풀어쓴 설명) 정책 내용 자체는 모순 없음 — 빈도·옵트아웃 방법·유상 여부 전부 일치 |

**⛔ 구멍(다르면 그것이 구멍이라는 지시대로):** EN 4곳은 상수를 그대로 공유하므로 애초에 다를 수가 없는 구조(같은 문자열 재사용) — 여기선 사고가 안 난다. **진짜 구멍은 한국어 사용자다.** 한국어 화면으로 동의한 사용자의 "동의 증거"(`sms_consent_text`/`email_consent_text`)에는 그 사람이 실제로 읽은 한국어 문장이 전혀 남지 않고, 매번 영문 원문만 저장된다 — TCPA류 "정확히 무엇에 동의했는가" 증빙 목적에 비춰보면 한국어 사용자 몫의 증거가 사실과 다른 언어로 남는 셈. `/terms`·`/privacy`는 애초에 한국어판 자체가 없다(코드에 `useAdminLang`/한국어 분기 없음 확인) — 로그인 화면 KO 동의문이 링크하는 "이용약관/개인정보처리방침"도 실제로는 영문밖에 없다.

**① 전수 관련 남은 리스크(코드 수정 안 함, 사실만 기록):**
- **동의문 4중 사본**: 위 ①-2에서 대조 완료 — EN은 상수 재사용이라 안전, KO는 저장 안 됨(구멍). 코드 주석들 스스로가 "수동 동기화 위험"이라 표시해둔 상태(실제로는 EN만 동기화 대상, KO는 애초에 동기화 대상조차 아니었음).
- **"Last updated" 스탬프 미연동**: `/terms`·`/privacy` 둘 다 "August 2026"을 손으로 박아둠 — 실제 내용을 고쳐도 날짜가 안 따라감(오늘 `/terms`·`/privacy` 자체는 안 고쳤으니 지금 당장 거짓은 아님, 다음에 이 페이지들을 고칠 때 같이 갱신 안 하면 거짓이 됨).
- **특허/상표 정보**(`/about`,`lib/ip-info.ts`): 법적 사실 주장인데 DB 근거 없이 하드코딩 — 코드가 스스로 "이관 예정"이라 적어둔 부채.

---

## ② DB 쪽 — `seasons` 컬럼 전수 (99개)

**범례**: 어드민 노출 = SeasonForm.tsx(정규 시즌) / host-new·partners(파트너 시즌) 어느 쪽이든 편집 가능하면 O. 실제 읽힘 = `app/admin/**` 제외한 코드(참가자 화면·워커·크론)에서 실측.

### ⛔ 노출되는데 안 읽힌다 (죽은 컬럼 후보 — 오늘 패턴)

| 컬럼 | 어드민 노출 | 실제 읽힘 | 비고 |
|---|---|---|---|
| `flag_spread_threshold` | O(SeasonForm) | **없음** | 오늘 실측 확정(#68). 라벨도 "플래그"지 "제외"가 아님 |
| `flag_integrity_threshold`(단수) | O(SeasonForm) | **없음** | 실제 채점은 `flag_integrity_high/medium/low_threshold`(복수, 3단계)를 읽는다(`scorer.ts` `integrityScaleFor`) — 단수형은 구버전 잔재로 보임 |
| `main_round_theme` | O(SeasonForm) | **없음**(어드민 폼 안에서만 순환) | 실제 공개 로직(`getRevealedTheme()`)은 `main_round_theme_label`을 읽는다 — 별개 컬럼. 테마 하이브리드 마이그레이션(주제 유출 차단, 2026-08 초) 이후 `main_round_theme`이 사문화된 것으로 보임 |
| `main_round_video_seconds` | △(hidden input으로만 왕복, 편집 UI는 오늘 아침 이미 제거 — `a235ce9`) | **없음** | 편집 화면은 이미 없앴지만 컬럼 자체·hidden 왕복은 남아있음. 완전 정리하려면 마이그레이션 필요 |
| `defer_extension_days` | O(SeasonForm) | **TS코드에 없음** ⚠️RPC 후보 | `defer_season_schedule` RPC가 이 값을 쓸 가능성 있음 — **grep으로 증명 불가, `pg_get_functiondef`로 확인 필요** |

### ⚠️ 읽히는데 어드민에 없다 (TK 원칙 위반 후보)

| 컬럼 | 실제 읽힘 | 비고 |
|---|---|---|
| `aspect_ratio` | O(Studio 편집기 크롭 잠금, 오늘 확인) | **정규 시즌 SeasonForm에 입력 필드가 없다.** season_0의 `9:16` 값은 SQL로 직접 넣은 것으로 추정(오늘 그 값을 SQL로 조회만 함, 누가 언제 넣었는지 레포에 흔적 없음) |
| `watch_fixture_visible` | O(공개 피드 노출 게이트) | 오늘 하루 종일 SQL로만 직접 토글(리허설 노출 결정). 어드민 UI 없음 — 다음 리허설도 SQL 의존 |
| `studio_compose_max_clips`/`max_seconds`/`min_seconds` | O(Studio 편집기 제한) | SeasonForm에 없음 |
| `studio_max_draft_generations_per_round`/`max_draft_image_generations_per_round`/`max_image_generations_per_round` | O | SeasonForm에 없음(`studio_max_generations_per_round`만 있음, 나머지 3개는 없음) |
| `studio_prelim_auto_publish`/`studio_prelim_hold_enabled` | O | SeasonForm에 없음 |
| `community_vote_max_per_user` | O(`toggleWatchVote`의 cap) | SeasonForm에 없음 — 오늘 발견한 "1표"가 이 컬럼에서 오는데 어드민에서 못 바꿈 |
| `award_prizes`,`points_fee_basis_usd`,`prize_funding_mode`,`prize_pool_escrow_status`,`host_type`,`host_user_id` | O | **정규 시즌 폼엔 없지만 `app/host/new`(파트너 시즌 생성)엔 있음** — 정규 시즌은 이 값들을 애초에 안 씀, 위반 아닐 가능성 높음(재확인 권장) |

### ✅ 정상(노출·읽힘 둘 다 확인, 대표 예시만)

`application_open_at`/`application_close_at`/`registration_close_at`/`main_round_start_at`/`main_round_end_at`/`community_vote_start_at`/`community_vote_end_at`/`awards_announcement_at`/`total_prize_pool`/`prize_first_pct`/`prize_second_pct`/`prize_third_pct`/`scoring_intent_clarity_weight`/`scoring_execution_weight`/`scoring_originality_weight`/`scoring_integrity_weight`/`ai_score_weight`/`community_vote_weight`/`application_video_min/max_seconds`/`main_round_video_min/max_seconds`/`max_applicants`/`min_participants`/`advance_min/max/pct`/`top_n_advance`/`is_fixture`/`entry_fee` — 전부 어드민 편집 가능 + 실제 코드에서 읽힘, 오늘 다양한 작업에서 직접 실측.

### 검토 보류(범용 필드명이라 grep 신뢰도 낮음, 개별 확인 안 함)

`id`,`name`,`status`,`created_at`,`updated_at`,`display_name` — 다른 테이블 동명 컬럼과 섞여 자동 카운트가 무의미했다. 개별 수작업 확인은 이번 라운드에 안 함.

### 완전히 안 읽히는 것 확인(어드민에도 없고 코드에도 없음 — 폐기 후보, 이번엔 안 지움)

`flag_integrity_high_threshold`/`flag_integrity_low_threshold`/`flag_integrity_medium_threshold`는 **어드민 폼엔 없지만 `scorer.ts`가 실제로 읽는다** — 정정: 이건 "안 읽힘"이 아니라 "②-역 패턴"(읽히는데 어드민에 없음)에 속함, 위 표에 없어서 여기 추가로 밝힘. `main_round_disqualify_appeal_hours`/`main_round_disqualify_enabled`/`main_round_disqualify_missing_votes`/`main_round_required_elements`는 실격 게이트 전체가 `enabled=false` dark-launch라 지금은 양쪽 다 안 읽히는 게 의도된 상태(오늘 새로 생긴 문제 아님, 8/28 이미 기록됨).

---

## ③ 오늘 잡은 것 검산 — 이 표에서 보이나

| 오늘 발견 | 이 표에 보이나 |
|---|---|
| 챗봇 KB 9월 날짜/$3,000/AI Score만/이상치 제외/왕중왕전 | ✅ ① 챗봇 행 |
| `/apply` 동의문 과장("제출 시"/"사람이 다시 확인") | ✅ ① `/apply` 행 |
| Watch 리허설 노출에 배너/배지 없음 | ✅ ① Watch 행 |
| 이메일 timeZone 버그 5건(SelectedTop50 등) | ✅ ① 이메일 행 |
| schedule-lines.ts KR=한국시간/EN=PT 이중기준 | ✅ ① 이메일 행에 포함(별도 줄 안 뺐음 — 세분화 여지 있음) |
| `/rules` YouTube/Vimeo·이상치제외·모델명공개 | ✅ ① `/rules` 행 |
| 랜딩 FAQ #8 과장 | ✅ ① 랜딩 행 |
| `flag_spread_threshold` 죽은 컬럼 | ✅ ② 표 |
| E5(참가 취소) 기능 자체가 없음 | ✅ **반영 완료** — TK 지시대로 ①표에 "이 문장이 약속하는 기능이 실재하나" 열을 신설(6번째 열). 인바운드 이메일 자동응답 행에서 이 열이 실제로 ⛔(구조적으로 작동 안 함)를 하나 잡아냄 — 열 신설이 헛수고가 아니었음을 같은 표에서 검증 |
| 동일 문구가 여러 화면에 독립 사본으로 흩어짐(FAQ #8=규정⑤·D3·`/apply`·랜딩·챗봇 5곳 동일 문장 요구) | ✅ 완료 — SMS/이메일 동의문 4중 사본을 ①-2에서 코드로 직접 대조. 결과는 예상과 달랐다: EN 4곳은 애초에 상수 재사용이라 다를 수 없는 구조(위험 없음), 진짜 구멍은 **한국어 사용자의 동의 증거가 영문으로만 저장됨**(사본 불일치가 아니라 언어 누락) |

**결론:** 지시하신 두 축 모두 이번 라운드에서 표에 반영했고, 반영한 열이 실제로 새 사실을 하나씩 걸러냈다(⛔ 인바운드 자동응답 미작동 / KO 동의 증거 언어 누락) — 열 신설이 형식적 추가에 그치지 않았음.

---

## 남은 일 — 목록만, 순서는 TK가 정함

1. `/about`·`/rules`의 특허 출원일·발명명칭·상표 분류·상태 — 대표님 실서류 대조 결과 대기(이 세션의 최우선 항목)
2. 한국어 사용자의 SMS/이메일 동의 증거가 영문으로만 저장되는 문제 — 고칠지, 고친다면 어느 층(저장 시 언어 스냅샷 추가 등)에서 고칠지 결정 필요. 문안 자체는 내 소관 아님([[feedback_copy_not_my_call]])
3. `/membership`·`/tournament` 본문 카피 문장 단위 재검토(값은 라이브 확인했으나 문장은 미검토), `/faq` 27문항 교체본 착수, `/lobby-preview` 전수
4. `defer_extension_days`가 RPC에서 읽히는지 `pg_get_functiondef(defer_season_schedule)` 확인 필요(레포 grep으로는 증명 불가)
5. `aspect_ratio`/`watch_fixture_visible`/Studio 세부 파라미터들 — 정규 시즌 어드민 폼에 추가할지 판단
6. `/terms`·`/privacy`의 "Last updated: August 2026" 스탬프 — 다음에 이 두 페이지 중 하나라도 고치면 갱신 필요
7. `/terms`·`/privacy`에 한국어판이 아예 없음(확인된 사실, 위 ①-2와 연결) — 필요 여부 판단
7. `/about`·`lib/ip-info.ts`의 특허 출원일·상표 분류 하드코딩 — 코드 스스로 "이관 예정"이라 적어둔 부채, 실제 이관 여부는 TK 판단
