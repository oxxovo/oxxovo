# 어드민 FAQ 편집기 -- 설계 (지수 본체+2A, 2026-08-12)

설계만, 코드 0줄. 두 차례 지시(설계 요청 -> 정정: DB/편집기/공개반영 한
묶음, admin-i18n.ts는 안 건드림) 전부 반영. 문안(질문/답변 실텍스트,
금지어 목록)은 제니3 소관, 여기 없음.

## 결론 먼저

1. **타깃은 `/faq`(15문항, 영어전용)가 아니라 홈(`/`) FAQ 섹션이다** --
   실측 결과 `admin-i18n.ts`에 이미 KR/EN 9문항(`faq_q1~q9`/`faq_a1~a9`)이
   있고, `app/_landing/LandingView.tsx`가 그걸 읽어 렌더한다(431행 `<section
   id="faq">`). 이게 지금 코드에 박혀 있어 "한 줄 고치는 데도 배포"인
   그 FAQ다. `/faq` 페이지는 완전히 별개 파일(`app/faq/page.tsx`), 영어전용
   15문항 -- §6에서 별도 비용과 함께 제시, 넣을지는 판단하지 않는다.
2. **즉시 반영 여부는 페이지마다 다르다 -- 실측 결과:**
   - **홈(`/`) = 이미 즉시 반영.** `app/page.tsx:13`에
     `export const dynamic = 'force-dynamic'`. 매 요청마다 새로 렌더되므로
     DB에 쓰는 순간 다음 새로고침에 바로 뜬다. **추가 조치 불필요.**
   - **`/faq` = 즉시 반영 안 됨(넣는다면).** `export const dynamic`이
     없다(기본값 `'auto'`). 이 페이지가 쓰는 `lib/supabase.ts`는 쿠키를
     안 읽는 순수 모듈 클라이언트라 요청시점 API를 하나도 안 건드리고,
     그래서 Next가 첫 렌더를 정적 셸로 굳힌다 -- **2026-08-10 `/about`이
     옛 시즌명을 굳혀놨던 것과 정확히 같은 메커니즘**(`reports/backlog_
     honcho.md` #3). 고치려면 저장 액션에서 `revalidatePath('/faq')`
     호출(재배포 불필요, on-demand 캐시 무효화) -- 코드 몇 줄, §6에 포함.
   - `/about`은 FAQ를 렌더하지 않는다(실측: grep 0건) -- TK가 든 건 정적
     페이지가 굳는다는 사례일 뿐, 이번 범위의 실제 대상이 아니다.
3. **admin-i18n.ts는 안 건드린다.** DB가 비어 있으면(신규 테이블, 초기
   0행) `LandingView.tsx`가 지금처럼 `t.landing.faq_q1~q9`를 그대로 쓴다.
   DB에 활성 행이 하나라도 있으면 그 시점부터 DB 행만(정렬순) 렌더 --
   9문항 코드값과 절대 섞지 않는다(섞으면 톤·순서가 어긋난 채 이중진실).
   TK가 실제 문항을 다 넣고 나서 전환되는 구조라 "DB가 비었을 때 폴백"과
   "한 번에 옮긴다"를 둘 다 만족한다 -- 화면이 한 번도 빈 적 없다.
4. **⑤ 변수는 이미 절반 배선돼 있다.** `LandingView.tsx`가 지금도
   `season.max_applicants`/`formatAccessCopy()`/`advanceCountLabel()` 같은
   기존 헬퍼로 FAQ 문구에 라이브 값을 꽂는다(439~459행 확인). 새 편집기는
   자유 서식이 아니라 **이 헬퍼들을 가리키는 고정 토큰 목록**(예:
   `{{prize_pool}}` `{{max_applicants}}` `{{application_close}}`)만 관리자가
   본문에 넣게 한다 -- §4.
5. **④ 기간 가드용 날짜도 이미 코드에 있다, 단 TK가 준 시각과 다르다.**
   `getThemeRevealTime(season)`(`lib/seasons.ts:514`)가
   `main_round_start_at - theme_announcement_minutes_before`로 이미
   계산한다. season_0 실측: **11/8 23:00 PT**(main_round_start 11/9 08:00
   UTC, minutes_before=60). TK가 준 "11/8 12:00 PT"와 **11시간 차이난다.**
   손으로 새 날짜를 박지 말라는 지시 그대로 이 기존 함수를 재사용하되,
   이 불일치를 먼저 확인받아야 한다 -- §5.

## 있는 것 / 없는 것

| 있는 것 | 없는 것 |
|---|---|
| 홈 FAQ 섹션 + `<Faq>` 프레젠테이션 컴포넌트(`LandingView.tsx:548`), export만 하면 미리보기에 그대로 재사용 가능 | FAQ 전용 DB 테이블 (0) |
| 홈(`/`)이 이미 force-dynamic -- 이 섹션은 캐시 문제 자체가 없다 | `/faq`의 즉시반영(정적 셸, revalidatePath 미배선) |
| `getThemeRevealTime()`/`isTwistRevealed()` -- 날짜 계산 완비 | 그 계산이 가리키는 시각(23:00 PT)과 TK 확정값(12:00 PT)의 일치 -- 불일치 확인 필요 |
| `formatAccessCopy()`/`advanceCountLabel()`/`formatWeightPercent()` 등 라이브 값 헬퍼 다수 | 그 헬퍼들을 관리자 텍스트에서 가리키는 토큰 치환기 |
| `platform_config`(JSON value, 코드 배포 없이 값 변경) -- 금지어 목록 저장처로 적합 | 금지어 목록 자체(제니3 대기) |
| KR/EN 쌍 NOT NULL을 강제하는 기존 패턴(여러 admin 폼이 이미 이 모양) | FAQ 전용 스키마 |

## §1. 정본 이관 순서 -- 답

DB 우선, 코드는 안전망. 렌더 로직: **"이 섹션에 활성 DB 행이 1개 이상
있으면 DB만, 0개면 코드 9문항 그대로"** -- 행 단위 병합이 아니라 섹션
단위 전환. 이유: 문항별로 DB/코드가 섞이면 "지금 보이는 이 문항은 어느
쪽이 정본인가"가 항상 애매해지고, 톤(존댓말/문체)도 어긋난다. 섹션
단위면 전환 순간이 명확하다 -- TK가 첫 행을 저장하는 순간부터 DB가 정본,
그 전까지는 지금 화면 그대로.

## §2. 파일 경계 -- 답

- **내가 만드는 것**: 신규 테이블(`faq_items`) + `/admin/faq` 편집
  화면(질문/답변 KR·EN, 순서, 노출 on/off, 저장 액션) + 그 저장 액션이
  거는 금지어 검사/기간 가드.
- **공개면 배선**: `app/_landing/LandingView.tsx`의 FAQ 섹션이 DB를 먼저
  조회하고, 0행이면 지금처럼 `t.landing.faq_q1~q9`(`admin-i18n.ts`)로
  폴백 -- **이 파일(`LandingView.tsx`)은 내가 고친다**, `admin-i18n.ts`
  자체는 1바이트도 안 건드린다. TK 정정대로 "DB까지 만들고 공개면이 그걸
  읽게 하는 배선까지" 전부 한 묶음이고, 그 경계는 파일 단위(어떤 파일을
  건드리는가)이지 트랙 단위(누가 배선하는가)가 아니다.

## §3. 즉시 반영 -- 상세

위 결론 2 참조. 구체 조치는 `/faq`를 범위에 넣을 때만 필요(§6). 홈은
force-dynamic이라 설계에 캐시 항목 자체가 없다 -- 저장 액션이
`redirect`나 별도 무효화 호출 없이 끝나도 다음 홈 요청이 바로 새 값을
읽는다.

## §4. 변수(⑤) -- 어디서 읽나, 값이 없으면 무엇이 나가나

**어디서**: `seasons`(현재 시즌 컬럼들) + `platform_config`(멤버십 가격 등)
-- 전부 지금 `LandingView.tsx`/`lib/seasons.ts`가 이미 읽는 것과 동일한
원천, 새 원천을 안 만든다. 토큰은 자유 텍스트가 아니라 **고정
allowlist**(예: 상금풀/1·2·3등 상금/최대참가자/영상 길이 범위/진출
라벨/멤버십 접근안내/신청마감 표시). 관리자가 본문에
`{{max_applicants}}` 같은 토큰을 넣으면 렌더 시점에 해당 헬퍼 함수
호출로 치환.

**값이 없을 때**: 토큰이 가리키는 헬퍼가 이미 "부재를 어떻게 표시할지"를
스스로 결정하는 경우(`advanceCountLabel`은 산출 전 "top 10% (10-50)" 정책
문구, 산출 후 "Top 50" -- 빈칸을 만들지 않는 게 원래 이 함수의 존재
이유)는 그대로 통과. 헬퍼가 던지거나 값이 진짜 없는 경우(예: 시즌 자체가
없음)는 **그 문항 전체를 렌더하지 않는다**(빈칸/깨진 토큰 문자열 노출
금지, [[feedback_absent_is_not_zero]] 그대로) + 관리자에게 미리보기에서
경고 표시. "토큰이 안 풀리면 빈칸"은 요건이 명시적으로 금지한 결과라
설계에서부터 배제.

## §5. 기간 가드(④) -- 날짜, 확인 필요

`getThemeRevealTime(season)` 재사용 추천(신규 날짜 컬럼도, 손으로 박는
값도 없음). **단, 이 함수가 계산하는 시각(season_0 실측 11/8 23:00 PT)이
TK가 준 "11/8 12:00 PT"와 11시간 다르다.** 셋 중 하나로 확인 필요:
(a) TK가 부른 시각이 어림값이고 기존 계산을 그대로 쓴다(권장 -- 손 계산
날짜가 코드와 어긋나는 게 바로 이 요건이 막으려는 그 실수),
(b) 이 가드는 트위스트 공개와 다른 별도 시점이라 신규 컬럼/오프셋이
필요하다, (c) `theme_announcement_minutes_before`(현재 60분) 자체를
바꿔서 두 용도를 다시 일치시킨다. 확인 전까지 코드 0줄이므로 지금은
막힘 아님 -- 다음 착수 전 답만 있으면 된다.

## §6. `/faq`(15문항, 영어전용) -- 범위 포함 여부, 비용

**포함 시 추가 비용**: (1) `/faq/page.tsx`도 같은 DB 조회+폴백 배선(작은
추가 -- `buildFaqs()`가 이미 함수형이라 구조는 호환) (2) `revalidatePath
('/faq')`를 저장 액션에 추가(§ 결론 2, 몇 줄) (3) **번역** -- 지금 15문항
전체가 영어 전용이라, DB로 옮기면서 KR 원문이 필요해진다(가드 ①이 쌍
필수이므로) -- 이건 코드가 아니라 제니3의 번역 작업량이다. (4) 이 페이지
전용 문항인지, 홈 FAQ와 문항이 겹치는지 정리 필요(9개 홈 FAQ 중 상당수가
15문항과 주제 겹침 -- 통합하면 관리 지점이 하나로 줄지만 이번 설계
범위를 넘는 별도 판단).

**추천**: 이번 1차 범위는 홈 FAQ(9문항)만. `/faq`는 홈판이 실전 검증된
뒤 2차로 얹는 편이 안전(같은 편집기, 같은 테이블에 `surface` 컬럼만
추가하면 되는 구조로 처음부터 설계해 두면 2차 비용이 낮다). **결정은
TK.**

## 스키마 초안 (설계 수준, DDL 아님)

```
faq_items
  id            uuid pk
  surface       text        -- 'landing_home' (2차: 'faq_page')
  question_en   text not null
  question_ko   text not null
  answer_en     text not null   -- {{token}} 허용
  answer_ko     text not null
  sort_order    int not null
  is_active     bool not null default false   -- 저장=초안, 별도 토글=공개
  created_at / updated_at / created_by
```

가드 배선 위치(전부 저장 액션 서버측, DB CHECK 아님 -- 목록이
`platform_config` 값이라 동적):
- ① KR/EN 쌍: 네 컬럼 전부 NOT NULL(zod 레벨에서도 빈 문자열 거부)
- ③ 금지어 경고: 저장 1차 호출이 매치 목록을 돌려주면 화면이 확인
  체크박스를 보여주고 재저장(confirm=true)에서만 통과 -- 차단 아님
- ④ 기간 가드: `is_active=true`로 전환 시 본문에 금지어(제니3 목록)가
  있고 `now() < getThemeRevealTime(season)`이면 **저장 자체를 거부**(경고
  아님). 날짜 지나면 같은 체크가 자동으로 통과 -- 별도 해제 조작 없음.

## 다음 확인 필요 (TK/제니3)

1. §5 -- 11/8 12:00 vs 23:00 PT, 어느 쪽이 맞나.
2. 제니3 금지어 목록 2종(경고용/기간차단용) -- 요청 필요, 아직 없음.
3. §6 -- `/faq` 1차 포함 여부(권장: 2차로 미룸).
4. 토큰 allowlist가 지금 나열한 것 외에 더 필요한지(제니3가 실제로 쓸
   FAQ 문구를 봐야 확정 가능).

관련: [[project_oxxovo_platform]] [[feedback_no_hardcode]]
[[feedback_absent_is_not_zero]] [[project_message_policy]]
