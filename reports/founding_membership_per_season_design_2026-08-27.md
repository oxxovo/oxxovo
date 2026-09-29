# Founding 무료 멤버십 — 시즌별 100명 확장 설계 (설계만, 2026-08-27)

TK 확정 의미론: **계정당 평생 무료 클레임 1회**, **시즌마다 그 시즌에 새로 준 수만 상한 100에 카운트**.
시즌0 100 + 시즌1 100 = 무료 회원 누적 200명. 시즌0에서 이미 받은 계정은 시즌1의 100명 자리를
안 먹는다(애초에 다시 못 받으니까). 목적 = 멤버 최대 확보. 코드/컬럼명의 "founding"은 그대로 두고
화면 문구만 시즌0(Founding Creator 타이틀+번호)과 시즌1+(무칭호, 혜택만)로 갈린다.

## 무료 기간 — 현재 코드 그대로 답변

`membership_founding_free_months`가 **단일 전역 `platform_config` 값**이고 지금 `12`(라이브 확인,
2026-08-27) — 시즌 구분이 코드에 아예 없다. `claimFoundingCreator`는 클레임이 일어나는 그 순간
이 전역값 하나를 읽어 만료일을 계산한다(`lib/membership.ts:298,340`). **그래서 오늘 구조로는 시즌1
클레임도 자동으로 12개월(1년)이다 — 값이 하나뿐이라 시즌 불문 동일하게 적용된다.** 다만 이건 상한
(`membership_founding_free_count`)과 완전히 같은 문제다: 나중에 시즌마다 기간을 다르게 주고 싶어지면
이것도 시즌별로 쪼개야 한다. 지금 "1년으로 통일"이면 손댈 필요 없고, "시즌마다 다르게"면 상한과
같이 시즌 스코프로 옮겨야 한다.

## 현재 구조 (재확인, file:line)

- `membership_founding_counter` — 단일 행(`id=1`), `claimed` 카운트 하나. CAS 루프가 이 한 행을
  놓고 경합(`lib/membership.ts:308-331`).
- `platform_config.membership_founding_free_count`(100) / `membership_founding_free_months`(12) —
  전역 키-값, 시즌 인자 없음.
- `profiles.founding_creator_number` — 계정당 1개, 영구. `is null`이면 "아직 안 받음"
  가드로도 쓰인다(`lib/membership.ts:353`). **이 컬럼 하나가 "평생 1회 가드"와 "표시할 서수"
  두 역할을 동시에 함 — 그런데 "어느 시즌에 받았는지"는 어디에도 안 남는다.**
- `claimFoundingCreator(userId)` — 시즌 파라미터가 아예 없다(`lib/membership.ts:273`).

## 필요한 변경 — 두 옵션

### 옵션 A: 기존 테이블에 시즌 축 추가 (최소 변경)

1. `membership_founding_counter`에 `season_id` 컬럼 추가, PK를 `(season_id)`로 바꿔 시즌마다
   자기 행을 가짐(시즌0 기존 행은 `season_id='season_0'`으로 백필). CAS 루프는 이제
   `.eq('season_id', seasonId)`로 자기 시즌 행만 놓고 경합.
2. `membership_founding_free_count`/`_months`를 `platform_config`에서 `seasons.founding_free_count`
   / `founding_free_months` 컬럼으로 옮김(이 코드베이스의 기존 관례 — `application_video_*`,
   `studio_compose_*`처럼 시즌마다 다른 값은 `seasons` 컬럼이지 `platform_config`가 아님).
   시즌0 기존 값(100/12)을 그 행에 백필.
3. `claimFoundingCreator(userId, seasonId)` — 시즌 인자 추가, 위 두 곳 모두 시즌 스코프로 읽음.
4. **평생 1회 가드는 여전히 `profiles.founding_creator_number IS NULL`로 건다** — 이건 시즌
   무관하게 계정 전체에 한 번이라 바꿀 필요 없음. 단, **"어느 시즌에 받았는지"를 남길 새 컬럼이
   필요하다** — 예: `profiles.founding_claimed_season_id`. 화면에서 "Founding Creator #N" 타이틀을
   보여줄지(시즌0만) vs "무료 멤버십만"(시즌1+) 보여줄지가 이 컬럼 하나로 갈린다.
5. `founding_creator_number`의 의미가 바뀐다 — 지금은 "전역 서수"였는데, 옵션A대로면 이 값이
   **그 시즌 안에서의 서수**가 된다(카운터 자체가 시즌별이니 자연히 시즌1의 첫 클레임도 1부터
   다시 시작). 시즌1엔 타이틀을 안 보여주니 화면엔 안 나오지만, 내부 카운팅 값의 뜻이 달라진다는
   점은 코드 주석에 반드시 남겨야 함 — 안 그러면 나중에 "전역 서수인 줄 알고" 잘못 읽는 사고가 남.

### 옵션 B: 클레임 원장(ledger) 테이블로 교체 (더 깨끗하지만 더 큰 수술)

`membership_founding_counter`(카운터)와 `profiles.founding_creator_number`(가드+서수)를 하나의
테이블로 합침: `membership_founding_claims(user_id UNIQUE, season_id, ordinal, claimed_at)`.
- 평생 1회 가드 = `user_id`에 UNIQUE 제약(그 자체로 강제, CAS 경합 로직이 훨씬 단순해짐).
- 시즌별 상한 = `WHERE season_id = ?`로 센 행 수 < cap.
- 어느 시즌에 받았는지 = 그 행의 `season_id` 그 자체 — 옵션A처럼 별도 컬럼을 새로 만들 필요가 없음.
- 서수 = 그 행의 `ordinal`(시즌 안에서의 순번).
- **한 곳에 진실이 있다** — "가드"와 "표시용 서수"와 "어느 시즌"이 전부 이 한 테이블의 한 행에서
  나옴. 옵션A는 이 셋을 세 군데(`profiles` 컬럼 2개 + `membership_founding_counter` 시즌별 행)에
  나눠 담아야 해서, 오늘 하루 반복해서 잡은 "같은 뜻의 값이 두 곳에 있으면 반드시 어긋난다"는
  병과 같은 모양의 위험을 새로 만든다.
- 대가: `profiles.founding_creator_number`를 읽는 기존 코드(화면 표시, `classifyMembership` 등)를
  전부 이 새 테이블 조인으로 바꿔야 함 — 옵션A보다 손댈 파일이 많다.

**권장: 옵션 B.** 오늘 반복해서 확인한 원칙("진실은 하나여야 한다")과 정확히 같은 이유입니다 —
옵션A는 "평생 가드"·"서수"·"어느 시즌"을 세 곳에 나눠 담아 또 다른 이중진실 위험을 만들지만,
옵션B는 한 테이블 한 행이 셋 다를 답합니다. 다만 마이그레이션 범위가 크므로(기존 코드가
`profiles.founding_creator_number`를 읽는 자리 전수 확인 필요) 최종 선택은 TK 몫으로 남깁니다.

## 시즌0 기존 데이터 보존 — 두 옵션 공통 확인 사항

- 옵션A: `membership_founding_counter`의 기존 단일 행(`id=1`, `claimed=100` 추정)을
  `season_id='season_0'` 행으로 백필. `profiles.founding_creator_number` 1~100은 그대로 두고,
  새 `founding_claimed_season_id`를 이 100명 전부에 `'season_0'`으로 백필.
- 옵션B: 기존 100명을 새 `membership_founding_claims` 테이블로 백필 INSERT(각자의
  `founding_creator_number`를 `ordinal`로, `season_id='season_0'`으로) — 이 백필 자체가
  "1회 가드"를 UNIQUE 제약으로 강제하기 전에 먼저 실행돼야 함(순서 주의).
- 두 옵션 다 **기존 100명의 화면 표시("Founding Creator #N")는 전혀 안 바뀜** — 데이터만
  옮겨 담고 읽는 쪽 쿼리만 갈아끼우면 되므로 회귀 없음(마이그 정확히 하면).

## 명칭 분리 (제니3 확정, 참고)

시즌0만 "Founding Creator / 창립 크리에이터" 타이틀+번호 노출. 시즌1부터는 타이틀 없이 혜택만
("선착순 100명 멤버십 무료"). 코드/컬럼명의 "founding"은 그대로 둬도 됨 — 화면 문구만 시즌 값
(`founding_claimed_season_id === 'season_0'` 여부, 옵션A 기준)으로 분기.

## 착수 순서 (승인 대기, 지금은 설계만)

1. 옵션 A/B 결정 — TK
2. 마이그레이션 SQL 설계(STEP 분리, 시즌0 기존 데이터 백필 포함)
3. `claimFoundingCreator` 시즌 인자화 + 호출부 전수 수정
4. 화면 문구 분기(시즌0 vs 시즌1+)
5. 테스트 추가(시즌별 상한 독립성, 평생 1회 가드, 기존 100명 표시 불변)

---

## 정밀화 (2026-08-27, HQ 지시: "시즌0 100명 데이터가 안 깨지는지가 핵심") — B 채택 후속

### ★실측 정정 — "100명"은 상한이지 현재 클레임 수가 아니다

이 문서 위쪽 "시즌0 기존 데이터 보존" 절이 `claimed=100 추정`이라고 썼는데 **추정이었고 틀렸다.**
2026-08-27 라이브 직결 실측:

```
membership_founding_counter: [{"id":1,"claimed":1}]
profiles.founding_creator_number (non-null): count=1, min=1, max=1, 중복 0, 빈 서수 0
그 1행 = uid 9b5ceed5 (TK 본인 계정, membership_source='founding_free')
platform_config: membership_founding_free_count=100, membership_founding_free_months=12
profiles 총 7행 중 founding 클레임 보유자는 이 1명뿐
```

즉 **오늘 시점 실제 데이터는 1행**이다. "100명"은 상한(cap)이지 이미 존재하는 행 수가 아니다.
설계는 "지금 1행이든 발사 시점까지 늘어 최대 100행이든 깨지지 않게"로 잡는다 — 특정 숫자에
의존하지 않고 `founding_creator_number IS NOT NULL`인 행 전부를 백필 대상으로 삼으면 이 숫자가
얼마든 자동으로 맞다.

### Option B 재검토 — UNIQUE 하나로는 상한 원자성이 안 나온다

원 설계가 "평생 1회 가드 = `user_id` UNIQUE, CAS 로직이 훨씬 단순해짐"이라고 썼는데, **UNIQUE는
같은 사람의 이중 클레임만 막지, 마지막 한 자리를 두고 벌어지는 동시 클레임의 상한 원자성은 안
막는다** — 두 요청이 동시에 `COUNT(*) < cap`을 읽으면 둘 다 통과해 101번째 행이 생길 수 있다.
지금 코드가 굳이 CAS 루프를 쓰는 이유가 정확히 이 문제이고(`membership_founding_counter`,
`lib/membership.ts:304-334` 주석 — plpgsql RPC `$$` 바디가 Supabase에서 42601로 막혀 CAS로
우회), 원장 테이블로 바꿔도 이 문제 자체는 없어지지 않는다.

**정정된 Option B: 원장(ledger)이 진실이고, 카운터는 서수를 원자적으로 발급하는 내부 부품으로
남는다** (사용자에게는 절대 안 보임, `membership_founding_counter`만 읽던 자리가 전부 원장으로
옮겨감):

1. `membership_founding_counter`에 `season_id` 컬럼 추가, PK를 `(season_id)`로 — 옵션A와
   똑같은 모양이지만 **용도가 다르다**: 이제 이 테이블은 "서수 원자 발급기"일 뿐, `claimed`
   서수·자격 표시는 전부 새 원장에서 읽는다. 기존 단일 행(`id=1, claimed=1`)을
   `season_id='season_0'`으로 백필.
2. 신규 `membership_founding_claims(user_id UUID UNIQUE REFERENCES auth.users(id), season_id TEXT
   REFERENCES seasons(id), ordinal INT NOT NULL, claimed_at TIMESTAMPTZ NOT NULL)` — 평생 1회
   가드 = `user_id` UNIQUE, 시즌별 상한 조회 = `WHERE season_id=?`로 카운트, 어느 시즌인지 =
   그 행의 `season_id` 그 자체.
3. `claimFoundingCreator(userId, seasonId)` 흐름: (a) 카운터 CAS로 그 시즌의 다음 서수를
   원자 발급(오늘 로직과 동일, `season_id` 필터만 추가) → (b) 원장에 `INSERT ... ON CONFLICT
   (user_id) DO NOTHING`로 삽입 → (c) 0행 삽입(=이미 클레임 보유, 동시 레이스)이면 오늘의
   `releaseFoundingSlot`과 같은 원자 되돌림으로 서수 반납.
4. `profiles.founding_creator_number`는 **당장 안 지운다** — 이 레포의 확립된 원칙
   ([[feedback-policy-obsolete-code-stays-inactive]], [[feedback-db-object-absence-unprovable-by-repo]])대로
   코드가 원장만 읽게 바뀐 뒤에도 컬럼 자체는 한동안 존치, 드리프트 검증에 씀(아래).

### 진짜 고쳐야 하는 자리 — 4곳뿐(전수 확인 완료, 2026-08-27)

`founding_creator_number`/`foundingNumber`를 grep한 전체 결과 중 실제 DB 컬럼을 직접 읽고 쓰는
곳은 4곳뿐이고, 나머지(`app/profile/page.tsx`, `app/profile/actions.ts`,
`lib/email/send.tsx`, `lib/email/templates/MembershipFoundingExpiry.tsx`)는 전부 이 4곳 중
하나가 만들어준 값을 그대로 전달만 하는 배관이라 안 고쳐도 된다:

1. `lib/membership.ts` `classifyMembership()` — `MEMBERSHIP_PROFILE_COLUMNS`(line 90)로 읽어온
   프로필 행의 `founding_creator_number`를 `isFoundingCreator`/`foundingNumber`로 변환(line
   132-133). → 원장 조인 결과를 넘기도록 시그니처 확장 필요.
2. `lib/membership.ts` `claimFoundingCreator()` — 클레임 자체(위 3번).
3. `app/admin/broadcasts/actions.ts:63` — 발송 세그먼트 'founding' 필터
   (`.not('founding_creator_number', 'is', null)`). → `membership_founding_claims`에 행이
   있는 유저로 필터 교체.
4. `app/api/cron/email-tick/route.ts:625,663,672` — 만료 임박 알림 대상 조회 + 이메일 서수
   삽입. → 같은 방식으로 원장 조인.

### 시즌0 기존 1행이 안 깨지는지 — 검증 방법 (실행은 승인 후)

- 백필 INSERT는 `founding_creator_number IS NOT NULL`인 행 전부를 대상으로 하므로(오늘은 1행,
  발사 전 더 늘어도 자동 포함), `season_id='season_0'`·`ordinal=그 행의 founding_creator_number`·
  `claimed_at=membership_started_at`으로 옮겨 담는다. 특정 인원수를 하드코딩하지 않는다.
- 컷오버 전후 드리프트 검증 쿼리(둘 다 같은 결과가 나와야 함, 컬럼이 아직 살아있는 동안 언제든
  재실행 가능): `SELECT count(*) FROM profiles WHERE founding_creator_number IS NOT NULL` vs
  `SELECT count(*) FROM membership_founding_claims WHERE season_id='season_0'`.
- 화면 표시("Founding Creator #1")는 두 옵션 다 안 바뀐다는 원래 결론 그대로 — 이번 정밀화는
  "무엇이 진실인지"만 옮기지, 사용자가 보는 값은 안 바꾼다.
- `profiles.founding_creator_number` 컬럼은 컷오버 후에도 한동안 존치(드리프트 검증용) —
  드롭은 별건, 발사 훨씬 이후 판단.

### 순서 고정 (오늘 반복 확인된 규율 그대로 — 반대로 하면 저장이 검증에서 막힘)

1. 마이그(추가만, 파괴 없음): 카운터 `season_id` 컬럼+백필, 신규 원장 테이블+백필 INSERT →
   이 시점까지는 코드 무변경, 기존 경로 그대로 동작
2. 코드 컷오버: 위 4곳을 원장 읽기로 교체, `claimFoundingCreator(userId, seasonId)` 시즌
   인자화 + 호출부(`app/apply/actions.ts:75`) 수정 → 배포
3. 관찰 기간(드리프트 쿼리로 두 소스 일치 확인)
4. (훨씬 나중, 별건) 옛 컬럼/무필터 카운터 사용 흔적 정리 — 지금 범위 아님

**여전히 설계만, 착수는 발사 후.** 위 순서는 착수 승인이 떨어졌을 때 바로 쓸 수 있도록 지금
정밀화해 둔 것뿐 — 이번 세션에서 마이그/코드 어느 쪽도 건드리지 않았다.
