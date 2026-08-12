# 설계안: 프로필 레벨 ⊥ 작품 레벨 정보 분리 (pre-launch item 3 병합)

- 작성: 2026-07-08 (지수2, 실코드/실스키마 근거)
- 발견 경위: TK compose 재제출 시 이름·국적·규칙동의를 **매 작품마다 재입력** → 프로필성 정보 반복
- **분류: 발사 블로커 아님 / 시즌1(매주 제출) 전 필수. item3(단일 경로 통일)에 병합**
- 동기: 시즌0=라운드당 1회라 마찰 작음. **시즌1+ 매주 재참여 시 매번 재입력 = 이탈 마찰 큼.**

---

## 1. 현재 상태 (실측)

**저장소:**
- `profiles` 테이블 **이미 존재**(id = auth user id). 현재 컬럼: `id, email, role, stripe_customer_id, past_due` (+멤버십). **창작자 정체성/동의 컬럼은 아직 없음.**
- `genesis_applications` = 신청(엔트리)별 저장: `creator_name, country, channel_url, agreed_to_rules, agreed_to_privacy, agreed_to_integrity_notice, creator_statement`.

**수집 지점 (매번 전부 재입력):**
- `/apply` (app/api/apply/route.ts)
- studio 단일 제출 (lib/studio.ts `submitGeneration` 5a)
- studio compose 제출 (lib/studio.ts `submitRender` 7a)
- 폼: `ApplicantInfo { creatorName, creatorStatement, country?, channelUrl?, agreedRules, agreedPrivacy, agreedIntegrity }`

**문제:** creator_name/country/rules·privacy 동의는 **계정 레벨 불변 정보**인데 작품마다 반복 입력. `/profile` 페이지도 값을 `profiles`가 아니라 **최근 신청행**에서 읽음(app.creator_name) = 프로필 소스가 신청에 종속.

## 2. 분리 원칙

| 레벨 | 항목 | 주기 | 저장 |
|---|---|---|---|
| **프로필** | creator_name(표시명), country, **규칙 동의**, **개인정보 동의** | 첫 참가 1회 (정책 개정 시 재동의) | `profiles` |
| **작품** | **creator_statement**(Intent 채점 재료, 작품마다 고유), **무결성 동의**(이 작품이 본인작·규정준수 서약) | 매 제출 | `genesis_applications` |

- 규칙/개인정보 동의 = **플랫폼 전역 약관** → 작품마다 물을 이유 없음. 정책 **버전**만 추적, 개정 시 재동의.
- 무결성 동의 = **작품별 서약** → 매 제출 유지 (TK 확정).
- channel_url = studio 인라인 제출엔 불필요 → **이미 제거 완료**(8f0cca9/a5d2864). /apply(외부 유튜브)만 유지.

## 3. 저장 & 재사용 메커니즘

**마이그레이션 (profiles 확장):**
```
ALTER TABLE profiles ADD COLUMN creator_name text;
ALTER TABLE profiles ADD COLUMN country text;
ALTER TABLE profiles ADD COLUMN rules_agreed_at timestamptz;
ALTER TABLE profiles ADD COLUMN rules_agreed_version text;
ALTER TABLE profiles ADD COLUMN privacy_agreed_at timestamptz;
ALTER TABLE profiles ADD COLUMN privacy_agreed_version text;
```
동의를 **타임스탬프+버전**으로 저장 = 법적 증거(언제/어느 버전에 동의). (기존 [[project_a2p_sms]] TCPA 증거 저장 관례와 일치)

**흐름:**
1. **첫 참가**: 폼이 프로필 필드(이름/국적/규칙·개인정보 동의) 수집 → `profiles` upsert(+동의 타임스탬프·현재 정책버전). 작품 필드(statement+무결성)도 수집.
2. **재참가**: 폼이 프로필 값 **prefill(수정 가능)**, 규칙/개인정보는 "YYYY-MM-DD 동의함" 표시만(현재 버전과 일치 시 재체크 불필요). **statement + 무결성 체크만 필수.**
3. **정책 개정 시**: 저장 버전 ≠ 현재 버전이면 해당 동의만 재프롬프트.
4. **genesis_applications 스냅샷 유지**: 제출 시점 creator_name/country/동의를 신청행에 **denormalize 저장**(감사/법적 엔트리 기록). 단 **사용자가 재타이핑하는 게 아니라 프로필에서 복사**.

## 4. 코드 터치포인트

- **마이그레이션**: 위 profiles 컬럼 (TK Run).
- **서버**: `getCreatorProfile(userId)` 헬퍼(lib/profile 또는 lib/seasons 근처). `loadStudioState`/`loadComposeState`에 프로필 prefill + `profileConsentCurrent: boolean` 반환.
- **폼**: studio `ApplicantForm`(page.tsx) + `ComposeEditor` 신청폼 + `/apply` — 프로필 필드는 **없거나 stale일 때만** 렌더, 아니면 저장값 표시 + statement/무결성만.
- **제출**: 프로필 필드 신규/변경 시 `profiles` upsert(+동의 타임스탬프). 항상 genesis_applications에 스냅샷.
- **`/profile`**: 소스를 최근 신청행 → `profiles`로 이관(이름/국적).

## 5. 하위 호환

- 기존 신청자: `profiles`에 창작자 필드 없음 → **다음 제출 시 lazy 채움**(폼이 최근 신청행에서 prefill 제안), 또는 1회 backfill 스크립트(최근 genesis_applications → profiles). backfill은 비블로커 후속.

## 6. 우선순위 / 범위

- **시즌0 발사엔 불필요**(라운드당 1회 제출 = 마찰 작음). 
- **시즌1(매주) 전 필수** — 매주 재입력 마찰이 이탈로 직결.
- item1(/apply 오해배너)·item4(nav)·본 item3와 함께 **"단일·저마찰 제출 경로"** 묶음으로 처리 권장.
- 채점 무결성 불변([[project_scoring_integrity_rules]]): 본 변경은 입력 UX만, score 컬럼 무관.
