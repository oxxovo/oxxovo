# 이메일 언어 = 명시적 `profiles.locale` — 설계안 (미착수, 코드 변경 0건)

**지시:** 국가로 추정하지 않는다. `/apply`에서 언어를 명시적으로 받아 `profiles.locale`에 저장하고, 이메일 발송이 그 값을 읽게 한다. **기한: 10/14 접수 전.**

**현재 상태(코드로 확인, 근거):**
- 언어 결정: `lib/email/lang.ts` `detectEmailLang(country)` — `country` 문자열이 `['korea','south korea','한국','대한민국','kr']` 중 하나면 ko, 그 외 en. `lib/email/send.tsx`의 발신 함수 30개 전부가 이걸 쓴다.
- 신청 폼(`/apply`, 실제로는 `registerForSeason()` — `lib/studio.ts:1301`)이 이미 `ApplicantInfo`(`lib/studio.ts:1217-1230`)로 `creatorName`/`country`/`age`/`channelUrl`/`creatorStatement`/동의 3종을 받는다. `country`는 신청 시 `upsertCreatorProfile()`(`lib/profile.ts:51`)을 거쳐 `profiles.country`에도 미러링된다.

---

## ① 저장 = `profiles.locale` (계정 속성)

`genesis_applications`가 아니라 `profiles`에 저장 — 이유(지시 그대로): 시즌마다 다시 물으면 안 되는 값이라 계정에 귀속돼야 한다. `country`가 `genesis_applications`에 원본을 두고 `profiles`로 미러링하는 지금 패턴과 반대로, `locale`은 **`profiles`가 원본**이고 신청 폼은 그 값을 "채우는 입구" 중 하나일 뿐이라는 게 다른 점.

**마이그레이션 스케치(미실행):**
```sql
ALTER TABLE profiles ADD COLUMN locale text CHECK (locale IN ('ko','en'));
```
- 신규 컬럼은 전 계정 `NULL`로 시작 — TK·배우자 등 기존 계정도 예외 없이 `NULL`.
- 제약은 `CHECK`만, `NOT NULL`은 아님 — 값이 아직 없는 상태(추정 대기)와 "en으로 확정"을 구분해야 하므로 `NULL`을 "모른다"로 남겨둬야 한다([[feedback_absent_is_not_zero]]와 같은 원칙 — 미입력을 en으로 자동 확정하면 그 자체가 또 다른 "국가로 추정"이 된다).

## ② 받는 자리 = `/apply` 신청 폼

- 현재 폼 컴포넌트(`app/apply/page.tsx` 1055행 부근)가 `age`/`country`를 `useState`+setter 프롭으로 받는 구조 그대로, `locale`/`setLocale` 한 쌍만 추가하면 됨 — 지시하신 "한 줄 추가가 싸다"는 코드 구조상 사실.
- **기본값**: 폼이 열리는 순간의 화면 언어, 즉 `useAdminLang()`(`lib/admin-i18n.ts:53`) 값으로 프리필. 한국어 화면에서 신청하면 기본 한국어, 영어 화면이면 기본 영어 — 사용자가 그 자리에서 바꿀 수 있게 라디오/토글로(드롭다운 아님 — [[feedback_absent_is_not_zero]] UI판: 드롭다운은 "미선택"을 못 그린다는 게 이미 확인된 함정이라, 프리필된 라디오를 명시적으로 다시 클릭해 바꾸는 구조가 맞다).
- **문구**: "국가와 별개로 묻는다"는 것을 명확히 해야 한다는 지시는 맞지만, **실제 문안은 내 소관이 아니다**([[feedback_copy_not_my_call]]) — 제니3에게 요청해야 할 항목으로 남긴다. (참고로 지금 국가 필드 라벨은 그냥 "Country (optional)"이고 언어와 무관하다는 설명이 없다 — 새 필드는 처음부터 그 구분이 문구에 있어야 새 사용자에게도 헷갈리지 않는다.)

## ③ 설계 — 컬럼 마이그·저장 경로·읽는 경로·기존 계정·프로필 수정

**저장 경로 (신청 시):**
1. `ApplicantInfo`(`lib/studio.ts:1217`)에 `locale?: 'ko' | 'en'` 필드 추가.
2. `registerForSeason()`(`lib/studio.ts:1301`) 안, 지금 `country`를 처리하는 자리(1364행 `const country = info.country?.trim() || profile.country || null`) 옆에 `locale` 처리 추가 — 단 `genesis_applications.insert(...)`(1375행)에는 넣지 않는다(①의 원칙: 계정 속성이지 신청 스냅샷이 아님). 대신 1409행 `upsertCreatorProfile()` 호출에 `locale`을 실어 보내 `profiles.locale`에만 쓴다.
3. `upsertCreatorProfile()`(`lib/profile.ts:51`)의 `fields` 인자에 `locale?: 'ko'|'en'`을 추가하고, `country`와 같은 "값이 있을 때만 쓴다" 규칙(`lib/profile.ts:60` `if (country) patch.country = country`와 동일 패턴)을 따른다 — 빈 값이 기존 저장값을 지우지 않게.

**읽는 경로 (발송 시) — 신설 `getLocaleForUser`:**
- `lib/profile.ts`에 `getLocaleForUser(userId: string): Promise<'ko'|'en'>` 신설 — `profiles.locale`을 읽고, `null`이면 폴백(아래 기존 계정 항목 참고).
- `lib/email/send.tsx`의 30개 발신 함수가 지금 받는 `country: string|null` 인자를, `locale: 'ko'|'en'|null`(또는 `creatorUserId`로 함수 내부에서 조회)로 바꿔야 한다 — 호출부가 많아(`app/api/cron/email-tick/route.ts`의 각 tick 함수) **이 교체가 이번 설계에서 제일 손이 많이 가는 부분**. `email-tick`의 여러 select 쿼리(`app/api/cron/email-tick/route.ts:653,722,760,811,854,893,997...`)가 지금 `country`만 뽑는데 `user_id`(또는 `profiles.id`)를 같이 뽑도록 넓혀야 `getLocaleForUser`를 호출할 수 있다 — 확인 결과 대부분의 쿼리가 이미 `id`(=user_id)를 같이 select하고 있어(예: 893행 `profiles`에서 직접 조회하는 경로는 `id`가 이미 있음) 큰 스키마 변경은 아니지만, 30개 발신 함수 시그니처를 전부 바꾸는 리팩터라 자잘한 손이 많다.
- `detectEmailLang(country)`는 완전히 대체되는 게 아니라 **아래 폴백 경로에만 남는다.**

**기존 계정(TK·배우자 등)은 어떻게 하나:**
- 마이그 직후 전원 `locale IS NULL`. 이 상태에서 이메일이 나가야 하므로 완전 제거가 아니라 **폴백**으로 남긴다: `getLocaleForUser()`가 `NULL`을 만나면 지금 로직(`detectEmailLang(country)`)으로 계속 추정 — 즉 **오늘보다 나빠지지 않는다**(지금 하던 추정을 그대로 이어감), 다만 앞으로는 명시값이 있으면 그게 항상 이긴다.
- 소급 확보 수단은 ②(신청할 때 채워짐) 하나로는 부족하다 — 신청 안 하는 기존 회원(멤버십만 있는 계정)은 영영 `NULL`로 남는다. 그래서 ⑤(`/profile`)이 사실상 필수 짝이다.

**`/profile`에서 나중에 바꿀 수 있나 — 그렇게 설계해야 한다:**
- `SmsConsentCard.tsx`/`EmailConsentCard.tsx`와 같은 자리에 "언어 설정" 카드 하나 신설 — 로그인만 하면 신청 이력 없이도 채울 수 있는 유일한 소급 경로. 저장은 새 서버 액션(예: `saveLocale({ locale })`, `app/profile/actions.ts`에 추가)이 `profiles.locale`을 직접 update.
- 이 카드가 있어야 신청 이력 없는 기존 회원(email-tick 코드 자체 주석이 "profiles has no name/country ... defaults to English"라고 이미 자인한 그 구멍, `app/api/cron/email-tick/route.ts:648`)도 명시값을 가질 길이 생긴다.

## ④ 순서 — locale 먼저, 심사평 번역은 그다음

동의. 언어를 모르는 상태에서 번역 여부를 정할 수 없다 — 이번 설계는 저장·기본값·읽기 경로까지만이고, 심사평(강점/개선점 등 AI 생성 피드백 문장)의 한국어 번역 여부·방식은 `locale` 인프라가 실제로 값을 채우기 시작한 뒤 별도 설계로 진행.

## 남은 것(설계 확정 후 착수 대상, 지금은 안 함)
- 위 마이그레이션 SQL 실행
- `ApplicantInfo`/`registerForSeason`/`upsertCreatorProfile`/`getLocaleForUser` 코드 작업
- `/apply` 폼에 라디오 추가(문구는 제니3)
- `/profile` "언어 설정" 카드 신설
- `lib/email/send.tsx` 30개 함수 + `email-tick`/`broadcast-tick` 호출부 시그니처 교체
- (그다음 단계, 이번 설계 범위 밖) 심사평 번역 여부·방식
