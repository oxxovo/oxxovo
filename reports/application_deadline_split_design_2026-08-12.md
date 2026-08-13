# 신청 마감 / 제출 마감 분리 -- 설계 (지수 본체+2A, 2026-08-12)

설계만. 코드/SQL 미작성. 문안(이메일/화면 카피)은 제니3 소관, 여기 없음.

## 결론 먼저

1. **"신청"과 "제출"은 지금 코드에서 완전히 같은 사건이다.** Studio가 영상을
   완성해 제출하는 순간(`submitRender`/`submitGeneration`)이 곧
   `genesis_applications` 행을 만드는 순간이다 -- 기록이 맞고, 지금도 맞다.
   둘을 진짜로 나누려면(먼저 등록만, 나중에 영상 제출) **신규 이벤트가
   필요하다.** 다행히 스키마는 이미 그 모양을 위해 준비돼 있다
   (`free_entry_url`이 nullable, 이유가 정확히 "영상 없이 행만 먼저 있을 수
   있음"이라고 마이그 주석에 적혀 있다) -- 아래 §1에 상세.
2. 막는 지점 = **`createGeneration`이 아니라 신규 "등록" 액션**을 추천한다.
   기존 `application_close_at` 게이트는 그대로 두 곳(둘 다 "행을 완성/제출"
   하는 지점)에 남고, 신규 `registration_close_at` 게이트는 신규 액션 1곳에
   붙는다. §2.
3. **컬럼명 = `registration_close_at`을 추천.** "application"이라는 단어를
   재사용하면 오늘과 같은 혼선이 또 난다 -- `application_close_at`은 이미
   "제출 하드컷"으로 굳어 있다. §3.
4. 어드민 시즌 폼에 그 칸 **없다.** `application_close_at` 하나만 있다
   (`SeasonForm.tsx:266`). 신설 시 같이 추가. §4.
5. **"등록 수"는 신청자 수(`genesis_applications` 활성 카운트)를 추천하지만,
   "100명"이 실제로는 Founding 크리에이터 캡(`membership_founding_free_count
   =100`)과 정확히 일치한다 -- 우연일 수도, TK가 그 숫자를 염두에 뒀을 수도
   있다. 확인 필요, §5.**
6. 이메일 발송 = **email-tick에 얹는다, 새 cron 아니다.** 발송 콘솔이 별도
   cron(`broadcast-tick`)이었던 이유는 "사람이 매번 다른 문구를 쓴다"였다 --
   이 기능은 그 반대(계산된 숫자+고정 템플릿, 트리거도 날짜뿐)라 이미 있는
   `deadline_reminder_hours` 패턴과 동형이다. §6.
7. **"1주 연기 최대 3회"는 이미 버튼도 손도 아니고 완전 자동이다** --
   `defer_season_schedule` RPC가 season-tick(매시간)에서 이미 돌고 있다.
   `max_defer_count`를 2->3으로 바꾸는 값 변경 하나면 된다(신규 코드 불필요).
   단, **이 RPC에 진짜 결함 하나를 발견했다**: `community_vote_start_at`/
   `end_at`을 연기 시 안 옮긴다(RPC가 이 두 컬럼이 생기기 전에 작성됨) --
   지금 연기가 한 번이라도 발동하면 커뮤니티 투표 날짜가 나머지 일정과
   따로 논다. §7.

## 있는 것 / 없는 것

| 있는 것 | 없는 것 |
|---|---|
| `application_close_at` 게이트, 3곳 통일 사용(`/api/apply`, `submitRender`, `submitGeneration`) | "등록만, 영상은 나중" 상태를 만드는 코드 경로 (0곳) |
| `free_entry_url` nullable + 그 이유가 정확히 이 용도(주석 확인) | 그 nullable을 실제로 쓰는 INSERT (0곳 -- 준비만 되고 안 씀) |
| "행이 이미 있으면 채우기만" 분기(5c, `lib/studio.ts:1283`) -- 이미 구현됨 | 그 분기에 `application_close_at` 체크 (지금 0 -- 마감 무시하고 채워짐) |
| `defer_season_schedule` RPC, season-tick 자동 실행, `max_defer_count` config | community_vote 두 컬럼을 옮기는 로직 (RPC의 SET 목록에 없음 -- 결함) |
| `deadline_reminder_hours` 배열 패턴(email-tick, 이미 라이브) -- 그대로 재사용 가능 | "현재 등록 수"를 담는 이메일 템플릿, 그 값을 계산하는 헬퍼 |
| 어드민 시즌 폼 스케줄 그룹(`SeasonForm.tsx:264`) | 그 그룹의 신규 컬럼 필드 |
| `min_participants=50`(season_0 실측), defer 판정에 이미 사용 중 | "100"이 `min_participants`와 같은 숫자라는 근거 -- 실측상 다름(50) |
| `membership_founding_free_count=100`(실측) | "100"이 이 값이라는 TK 확인 -- 우연히 일치할 뿐, 미확인 |

---

## §1. "신청"이 코드상 어디서 일어나나 -- 재확인

`lib/studio.ts:1179` (`submitGeneration`, 예선 라운드) 그리고 동형 코드가
`submitRender`(2018 부근)에도 있다. appRow가 없으면(`!appRow`) 그 자리에서
`genesis_applications`를 **완성된 행**(이름+진술문+`free_entry_url:
job.video_url`+`video_duration_seconds`+`studio_application_submitted_at:
now`)으로 INSERT한다. `isApplicationClosed(season)` 게이트가 바로 이
INSERT 앞에 있다(`1201`). `/api/apply`(외부 URL 경로)도 동일 게이트, 동일
모양의 INSERT. **셋 다 "행 생성"과 "영상 확보"가 한 트랜잭션이다.**

그런데 그 행이 이미 있을 때를 위한 코드도 이미 존재한다 -- `1283`
"5c-application. Row exists -- single application submission" 분기: 기존
행에 `free_entry_url`/`video_duration_seconds`/`studio_application_submitted_at`을
**UPDATE로 채운다.** 지금은 이 분기에 도달할 방법이 없다(행이 먼저 생기는
경로가 없으므로) -- 하지만 코드 모양 자체는 "등록 먼저, 제출 나중"을 위해
이미 준비돼 있다. 이 사실을 뒷받침하는 물증이 하나 더 있다:
`genesis_applications.free_entry_url`은 **nullable**이고, 그렇게 만든
마이그 주석(`reports/studio_phase4_migration_2026-06.sql:5-9`)이 이유를
정확히 "a studio application row is created at submission time... row
exist with the studio video filled in by submitGeneration"이라고 적어
놨다. 즉 **이 설계는 예전에 한 번 의도됐다가 끝까지 배선되지 않은
것**이다. 그리고 `free_entry_url IS NOT NULL`은 이미 딴 데서 쓰이는
계약이다 -- 채점기가 "이 행이 채점 대상인가"를 정확히 이 조건으로
판정한다(`lib/scoring-coverage.ts:12`, `studio.ts` 3곳 주석). 그러니 "등록만
된 행"을 만들어도 채점 파이프라인이 그 행을 조용히 오채점하지 않는다 --
오히려 이미 그 조건으로 걸러지도록 짜여 있다.

## §2. 막는 지점 -- 신규 액션 하나 + 기존 게이트 위치 이동

**추천안**: 신규 "등록" 액션 하나를 만든다 -- 지원자 정보(이름+진술문+동의)만
받아 `genesis_applications`를 **`free_entry_url` NULL 상태로** INSERT.
정원/대기 판정(`isCapacityFull`)은 지금처럼 이 시점에 한다(슬롯을 실제로
점유하는 시점이 등록이므로). 이 INSERT 앞에 신규 게이트
`isRegistrationClosed(season)`(→ `registration_close_at`)을 건다.

기존 두 곳(`submitRender`/`submitGeneration`의 5a 분기, `/api/apply`)은
바뀐다: appRow 조회(이미 있음, `1164`)가 **먼저 등록된 행을 찾으면** 5c
분기(채우기)로 가고, **없으면** 지금처럼 5a(새로 만들기, 즉석 등록+제출
동시)로 간다 -- 워크플로우가 두 갈래(사전등록 후 제출 / 당일 등록+제출
동시)를 다 지원하게 된다. **5c 분기에 `isApplicationClosed` 체크를
추가해야 한다** -- 지금 그 분기는 마감을 안 본다(위 표 참고), 그대로 두면
"제출 마감"이 사전등록자에게는 적용되지 않는 구멍이 생긴다.

**대안(기각 사유 포함)**: `createGeneration`(클립 생성 시작)을
`registration_close_at`으로 막는 안도 검토했다 -- "10/31까지 작업을
시작해야 11/4까지 낼 수 있다"는 그림은 맞아떨어지지만, (a) "신청"이라는
말과 "클립 한 장 생성 시작"이 의미상 멀고, (b) 형식적으로 10/30에 클립
한 장만 찍어두고 실제 작업은 11/1~4에 몰아서 하는 우회가 가능해서 정책의
실효성이 없다. 기각.

## §3. 컬럼명

`registration_close_at` 추천. `application_close_at`이 "제출"로 이미 굳어
있으니, 새 컬럼에 "application"을 다시 쓰면 오늘 같은 혼선이 그대로
재발한다. "registration"은 지금 스키마 어디에도 안 쓰이는 단어라 충돌이
없다. 짝 함수명 `isRegistrationClosed(season)`(`isApplicationClosed`
옆에), i18n 라벨은 `field_registration_close`(기존
`field_app_close`와 나란히, 문안은 제니3).

## §4. 어드민 폼

없다. `SeasonForm.tsx:264` `group_schedule` 그룹에 `application_open_at`부터
`awards_announcement_at`까지 6개 필드가 있고 신규 컬럼은 그 사이 어디에도
없다. 추가 시 `application_open_at`과 `application_close_at` 사이에
`registration_close_at` 필드를 넣는 게 읽는 순서상 맞다(오픈 -> 등록마감
-> 제출마감 -> ...). `lib/season-schema.ts`의 refine에도
`registration_close_at <= application_close_at` 같은 정합성 체크를 넣어야
어드민이 실수로 역전된 값을 저장 못 하게 막을 수 있다.

## §5. "등록 수" -- 확인 필요, 내 추천은 신청자 수

실측:
- `genesis_applications` 활성 카운트(`defer_season_schedule`이 이미 쓰는
  정의: `status IN ('pending','verifying','flagged','eligible')`) --
  season_0은 지금 0(신청 시작 전, 9/9 오픈).
- `membership_founding_counter.claimed` = 1(TK 본인).
  `platform_config.membership_founding_free_count` = **100, 정확히
  일치.**
- `seasons.min_participants` = **50** -- "100명"과 다르다.

**추천 = 신청자 수(genesis_applications 활성 카운트).** 이유: (1) 이 숫자가
실제로 시즌 생존 여부를 결정하는 숫자다(연기 트리거가 이 정의를 이미
쓴다) -- Founding 카운트는 그 결정과 무관하다. (2) Founding
100명은 **플랫폼 전체 평생 1회성 캡**이다(시즌마다 리셋 안 됨) -- 시즌0에서
다 소진되면 시즌1부터는 이 숫자가 영원히 0 근처로 고정돼 "등록 수 알림"
기능 자체가 무의미해진다. 신청자 수는 시즌마다 반복 가능한 정의다.

**단, "100"이 Founding 캡과 정확히 같은 건 우연이라기엔 너무 딱 맞는다.**
TK가 "100명"이라고 할 때 실제로 염두에 둔 게 Founding 캡인지, 아니면
`min_participants`를 50->100으로 올릴 생각으로 그냥 100을 말한 건지 -- 이건
근거로 구분이 안 된다. **한 가지는 분명히 확인이 필요하다**: 만약 "100명
미달시 연기"가 문자 그대로의 정책(경고가 아니라 실제 연기 조건)이라면,
`min_participants`를 50->100으로 같이 바꿔야 한다 -- 안 그러면 T-14
경고문이 "100명 필요"라고 말해놓고 실제 자동연기는 50명에서 멈춘다(경고가
울렸는데 아무 일도 안 일어나거나, 반대로 경고 없이 50~99명에서 이미
자동연기가 발동해버린다). **화면·메일이 다른 숫자를 말하는 정확히 그
시나리오다.**

## §6. 이메일 -- email-tick, 새 cron 아님

발송 콘솔(`admin_broadcasts`+`broadcast-tick`)이 **별도 cron**이었던
이유(`lib/email/broadcast-tick.ts:1-11` 주석): 어드민이 매번 다른 제목/
본문을 입력하고, 그 큐를 예산 내에서 나눠 보내는 구조라 "무엇을 보낼지"가
코드가 아니라 사람이 결정한다. 이 기능은 정반대다 -- 트리거도(날짜 비교),
내용도(계산된 숫자 하나를 템플릿에 꽂는 것) 전부 코드가 결정하고 사람이
개입할 지점이 없다. 이미 라이브인 `deadline_reminder_hours`
패턴(`email-tick/route.ts:195-210`, 본선 제출마감 리마인더)과 모양이
완전히 같다 -- 배열 하나(예: `registration_reminder_days = [14]`)를
seasons에 두고, `registration_close_at - N일`에 도달하면 그 시점의
활성 신청자 수를 계산해서(§5 정의) 등록된 지원자 전원에게 1회
발송(dedup은 기존 `email_logs` 패턴 그대로). 새 cron·새 큐·새 화면 불필요.

## §7. "1주 연기 최대 3회"의 집행 -- 이미 자동, 값만 바꾸면 됨

`defer_season_schedule(season)` RPC(`reports/advance_defer_automation_2026-06.sql:181`)가
이미 완전자동이다: season-tick(매시간, `0 * * * *`)이 매 틱마다 이 RPC를
부른다 -- `application_close_at` 도달 + 활성 신청자 < `min_participants` +
`application_defer_count < max_defer_count`면 **전체 캘린더를
`defer_extension_days`(7)만큼 통째로 미루고 카운터+1**. 손으로 SQL을 세
번 돌리는 구조가 아니라 **버튼도 없다 -- 조건이 되면 그냥 일어난다.**
"최대 3회"는 `max_defer_count`를 2->3으로 바꾸는 **값 변경**이지 새 코드가
아니다.

**★발견한 결함**: RPC의 `UPDATE ... SET` 목록(라인 237-253)이
`application_close_at`/`scoring_start_at`/`scoring_complete_at`/
`main_round_start_at`/`main_round_end_at`/`awards_announcement_at` 6개만
옮긴다. **`community_vote_start_at`/`community_vote_end_at`이 빠져
있다** -- 이 두 컬럼은 이 RPC가 쓰여진 뒤(2026-06-20)에 추가된 것으로
보인다(2026-08-10/11 커밋 다수가 이 컬럼을 만짐). 지금 이대로 연기가 한
번이라도 발동하면 커뮤니티 투표 창이 나머지 일정보다 7일(또는 그 배수)
앞선 채로 남는다 -- 본선이 끝나기도 전에 투표 마감이 오는 순서역전이
가능하다. **이건 오늘 요청과 별개의 기존 결함이지만, "연기 집행"을 설계에
넣으라는 지시를 따르다 발견했으므로 같이 보고한다.** 신규
`registration_close_at`도 (등록마감이 실제로 도입되면) 이 SET 목록에
같이 들어가야 한다 -- 안 그러면 연기 후 등록마감이 제출마감보다 뒤에 남는
역전이 새로 생긴다.

## §UI. 등록 전용 화면 -- 설계 (HQ 2026-08-12, 코드 0줄)

★정정(§2 커밋 `3404fdc` 당시 서술 과장): "Founding/멤버십 게이트가 Studio
경로 어디에도 없다"는 절반만 맞다. `app/apply/page.tsx`를 다시 읽으니
`MembershipGateScreen`이 **studioApplication 여부와 무관하게 먼저
렌더된다**(279행 `if (membership?.gateActive...)`가 290행
`if (studioApplication)`보다 먼저) -- 즉 **화면(UI 퍼널)은 이미
Studio 참가자도 통과시킨다.** 없는 건 그 화면 뒤(직접 `/studio` URL
접근, 또는 `registerForSeason`/`submitGeneration`/`submitRender` 자체)의
**서버측 재확인**뿐이었다. backlog #21 정정판: "UI 퍼널은 gate함,
서버는 안 함" -- 판정은 여전히 대표님 몫, 손 안 댐.

이 정정이 ①번 답의 근거이기도 하다: `/apply`가 이미 "로그인 -> 멤버십
게이트 -> 스튜디오 안내"까지 다 하는 자리다. 새 페이지가 아니라 그
자리에 등록 버튼 하나를 얹는 게 제일 작은 변경이다.

**① 어디 -- `/apply`, 기존 `FunnelScreen`.** 랜딩 CTA나 Studio 내부가
아니라 지금 스튜디오 참가자가 이미 도달하는 그 화면
(`app/apply/page.tsx:917` `FunnelScreen`). 지금 이 화면 카피 자체가
"your first submission registers your application"(953행)이라고
말하고 있다 -- **이제 거짓말이 됐다**(신청과 제출이 갈렸으니), 어차피
카피 수정이 필요했던 참에 등록 버튼을 여기 놓는 게 자연스럽다. 문구는
제니3.

**② 최소로 무엇을 받나 -- 로그인만으론 부족.** `registerForSeason()`은
`ApplicantInfo`(이름·진술문 150~250자·동의 3종)를 요구한다 --
진술문은 Intent 채점에 쓰이는 필수값이라 생략 불가. 다행히 이 정확한
3필드+검증 로직이 **이미 이 파일 안에 있다**(외부URL 폼의 "②
Applicant Info"/"③ Agreements" 섹션, 552~646행) -- Studio의
진술문 입력 UI는 `ProComposeEditor.tsx`(2000줄 넘는 편집기 내부,
제출 시점 모달)에 박혀 있어 재사용이 오히려 더 큰 변경이 된다. 그러니
새 폼을 만들지 않고 **이 파일에 이미 있는 필드 마크업을 등록 버튼
아래 펼치는 안**을 추천 -- 신규 UI 컴포넌트 최소화.

**③ 이미 등록한 사람이 다시 오면 -- 신규 상태 조회 필요.**
지금 `/apply`는 "이 유저가 이미 행을 가졌는가"를 확인하는 코드가
없다(외부URL 경로의 `submitted` 상태는 방금 막 제출했을 때만 참). 신규
서버 액션 하나(`getMyRegistrationStatus(seasonId)` 등, `email`로
`genesis_applications` 존재 확인)가 필요 -- 있으면 등록 폼 대신
"등록됨, Studio에서 이어가기" 카드를 보여준다(이미 `waitlist`/`pending`
분기 UI가 있으니 그 옆에 세 번째 상태만 추가).

**④ 정원 찼을 때 -- 이미 있는 대기자 분기 재사용.**
`registerForSeason()`이 이미 `status: 'pending' | 'waitlist'`를
반환한다(§2에서 캐파 판정을 이 함수로 옮겼으므로). `/apply`는 이미
`mode==='waitlist'`일 때 다른 카피("reached its capacity... waitlist")를
보여주는 분기가 있다 -- 등록 액션의 반환값으로 같은 분기를 타면 된다.
거부(entirely rejected)는 없다, 대기만(기존 정책 그대로).

**⑤ "11/1에 시작한다" 안내 -- ★무엇을 가리키는지 불확실, 추측 안 함.**
season_0 실측 일정에 "11/1"에 걸리는 이벤트가 없다(등록마감
10/31 23:59 PT, 제출마감 11/4). 등록 완료 화면에 표시할 값은
`formatDeadlinePT(season.application_close_at)`(기존 헬퍼, 이미
같은 파일에서 씀, 384행)로 "제출은 O월 O일까지" 안내하는 안을
제안하지만, "11/1에 시작"이 정확히 무엇을 뜻하는지(신규등록 차단
시작? 제출 준비 기간 시작?) 확인 부탁 -- 틀리게 짚느니 여기서 멈춘다.

**⑥ 기존 제출 경로와의 접합 -- ★이미 맞다, §2에서 확인.**
`submitGeneration`/`submitRender`의 appRow 조회(email+season, 상태
무관)가 `registerForSeason`이 만든 행을 그대로 찾아 5c/7c(채우기만)
분기로 보낸다 -- 새로 맞출 게 없다, §2 커밋(`3404fdc`)이 정확히 이
경우를 위해 그 분기에 마감 체크를 넣어둔 것이었다.

**⑦ 멤버십 상태 표시 -- HQ 2026-08-12 추가 요건, ★새 UI 불필요.**
"이제 게이트가 실제로 막으니 왜 막혔는지가 화면에 있어야 한다"는
요건은 `/apply/page.tsx`가 **이미 만들어 둔 화면으로 충분하다.**
`MembershipGateScreen`(279행)이 `membership.gateActive &&
!membership.isActiveCreator`일 때 `FunnelScreen`보다 먼저 렌더된다 --
즉 오늘 이 페이지에 도달해 "Register" 버튼을 보는 사람은 이미 멤버십을
통과한 상태다. 문제는 그 사이의 시차뿐이다: 페이지를 로드한 시점엔
활성 크리에이터였는데, Register를 누르는 시점(며칠 뒤일 수 있음)엔
멤버십이 만료·취소돼 있을 수 있다 -- 이게 서버가 실제로 막는 유일한
시나리오다.

권장 배선: `registerForSeason()`이 `membership_required`를 반환하면,
새 에러 화면을 만들지 않고 **기존 `onClaimed`와 같은 재조회
메커니즘**(`setReloadKey((k) => k + 1)`)을 그대로 태운다. 그러면
`/apply`의 `useEffect`가 멤버십 상태를 다시 읽고, 지금은 진짜로
비활성 크리에이터이므로 **`MembershipGateScreen`이 저절로 뜬다** --
Founding 잔여 슬롯이 있으면 무료 클레임 CTA, 없으면 유료 구독 CTA,
둘 다 이미 문구까지 완성돼 있다. "왜 막혔는지 + 가는 길"이 새 컴포넌트
0개로 충족된다 -- 막힌 이유가 애초에 이 화면이 존재하는 이유와
같은 것이기 때문이다.

## 다음 확인 필요 (TK/제니2)

1. ~~§5 -- "100명"이 정말 100인가~~ **해소(HQ 2026-08-12)**: 둘 다 100,
   별개 숫자. `min_participants`=100(대회 개최 조건), Founding 100=별개.
   ★추가로 "3회 연기 후 80명 하한" 확정 -- §7 갱신판 참조.
   (관련 결정: 본선 주제 공개 시각도 손으로 준 값이 틀렸던 사례가
   `reports/admin_faq_editor_design_2026-08-12.md`에서 나왔다 -- 손 계산
   날짜와 집행 코드가 어긋나면 코드가 이긴다는 원칙이 이번에도 확인됨.)
2. §2 -- **서버 측 완료(HQ 2026-08-12, 커밋 `3404fdc`)**: `registerForSeason()`
   신설(`lib/studio.ts`) + `isRegistrationClosed()`(`lib/seasons.ts`) +
   두 제출 함수의 mint 분기(5a/7a)가 `isRegistrationClosed`로,
   fill-in 분기(5c/7c)가 신규 `isApplicationClosed` 체크로 전환 + 어드민
   폼 필드 + SQL 초안(`reports/season_registration_close_2026-08-12.sql`,
   TK Run 대기). **UI(등록 전용 화면/버튼)는 아직 없음** -- HQ 요청에
   화면 설계 언급이 없었고, 서버 게이트 정합성이 먼저라 이번 범위는
   거기까지. 필요 시 별도 요청.
   ★부수 발견(backlog #21): `checkApplyGate`/Founding 클레임이 Studio
   제출 경로 어디에도 안 걸려 있다(`/api/apply` 1곳뿐) -- ⑤ 답변에
   반영, 손 안 댐(오늘 범위 밖).
3. ~~§7 결함~~ **해소** -- 아래 참조.

## ★착수 순서 갱신 (HQ 2026-08-12) -- ① 완료, ②③ 대기

HQ가 설계를 승인하고 `registration_close_at` 이름도 승인했다. 착수 순서는
①연기 RPC 결함+100/80 임계 → ②`registration_close_at` → ③등록수 알림,
"SQL은 초안만, 실행은 대표님". **①만 이번 턴에 완료.**

**코드 완료(커밋 예정), SQL은 초안만 -- TK Run 대기**:
- `reports/season_defer_floor_and_vote_shift_2026-08-12.sql` (초안, 미실행):
  신규 컬럼 `absolute_min_participants`(nullable) + season_0 값
  갱신(`min_participants` 100, `absolute_min_participants` 80,
  `max_defer_count` 3) + `defer_season_schedule` RPC 재정의(community_vote
  두 컬럼 이동 추가 + 연기예산 소진 시 80 미만이면 `reason='below_floor'`
  반환, 종전 `max_reached`는 80 이상일 때만).
- `lib/seasons.ts`/`lib/season-schema.ts`/`SeasonForm.tsx`/`admin-i18n.ts`:
  새 필드 배선(폼에 노출, EN/KO 라벨 -- **기술 라벨이라 문안 경계 밖**,
  참가자 대상 문구 아님). `min_participants` 기본값도 50->100.
- `app/api/cron/season-tick/route.ts`: RPC가 `below_floor`를 반환하면 그
  시즌의 상태전환(active->closed)과 예선홀드 자동공개를 **이번 틱은
  건너뛴다**(연기와 동일한 스킵 메커니즘) + 관리자 알림(매 틱 반복, 해결될
  때까지 -- 채점 lease 정체 알림과 같은 원칙). **해소 방법은 이 코드에
  없다** -- 관리자가 `max_defer_count`를 더 늘리거나 수동으로 시즌 상태를
  바꿔야 한다(둘 다 기존 어드민/DB 접근으로 이미 가능, 신규 UI 없음).
- 507/507 테스트, tsc clean, eslint clean.

**아직 없는 것**: below_floor 상태를 해소하는 전용 어드민 버튼(지금은
`max_defer_count` 수정 또는 수동 status 변경으로 우회). 필요하면 별도
요청.

관련: [[project-season0-3stage]] [[project-membership-season0]]
[[feedback-no-hardcode]] [[feedback-absent-is-not-zero]]
