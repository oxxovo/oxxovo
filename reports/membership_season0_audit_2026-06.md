# 멤버십 시스템 시즌0 — 현황 조사 + 갭 분석 + 계획 (2026-06-14)

조사자: 지수(oxxovo 본체). 코드 미변경 — 실측 보고 only.
전제(TK 확정): 멤버십 시즌0부터 작동 / 선착순 100=1년 크리에이터 멤버십 무료(Founding Creator) /
101~500=유료 $19.99/월(변수, platform_config) / 시즌0 최대 500 / Stripe 시즌0 필요.

===========================================================================
## A. 현황 — 이미 있는 것 (실측 file:line)
===========================================================================

### A-1. profiles 멤버십/파트너 컬럼
- 파트너 9컬럼 존재(inspect-partner-schema.mjs:73, lib/partners.ts:188-204):
  partner_status(none/auto_eligible/invited/active/suspended), partner_source,
  partner_invited_by, partner_invited_at, partner_activated_at, partner_invite_note,
  cumulative_top50, cumulative_wins, partner_tier(FK->member_tier_config)
- **멤버십(크리에이터 멤버) 컬럼: 0건 (없음)**
- **founding_creator 컬럼: 0건 (없음)**

### A-2. member_tier_config 테이블 = PARTNER 호스트 등급 (!= 멤버십)
- tier PK(bronze/silver/gold), max_applications_cap, max_tournaments_per_season
  (lib/partners.ts:63-83)
- 이것은 "파트너가 토너먼트를 개설"하는 등급. 크리에이터 "참가 멤버십"과 다른 축.

### A-3. platform_config (key-value 운영 파라미터)
- 스키마: key, value, value_type(int/decimal/text/bool), description
- service_role 전용 GRANT(partner_schema_grants:57-59), 읽기=lib/partners.ts getPlatformConfigMap
- 기존 키: session6_enabled, member_hosted_enabled, studio_purchase_enabled,
  studio_credit_pack_usd, partner_default_prize_funding_mode, partner_commission_rate,
  partner_eligibility_top50_count, partner_eligibility_wins_count 등
- **멤버십 가격/게이트 키: 없음 — 신규 추가 필요**

### A-4. Stripe 결제
- lib/stripe.ts: 테스트모드(sk_test_). 라이브=STRIPE_SECRET_KEY 스왑만(코드변경 0)
- **mode:'payment' (일회성)** — studio 크레딧 충전용(checkout/route.ts:43)
- credit_transactions + stripe_session_id(웹훅 idempotency, studio_stripe SQL)
- **구독(subscription) 모델: 없음** — $19.99/월 정기결제는 신규 구축
  (mode:'subscription' + Stripe Product/Price + customer.subscription.* 웹훅 + 갱신/취소/연체)

### A-5. 가입/인증
- 매직링크(signInWithOtp) + 쿠키 세션. /signup -> /login 리다이렉트. getSessionUser()
- **참가 게이트 = 로그인만** (멤버십 등급 게이트 없음). /apply:64 getSessionUser

### A-6. 투표
- seasons.community_vote_weight 설정값만 존재. **투표 캐스팅 메커니즘 미구축**
  (메모리 project_final_score_design: votes 시즌4 deferral)

===========================================================================
## B. 갭 분석 (필요 vs 있음)
===========================================================================

| 항목                        | 필요                          | 있음            | 갭                       |
|-----------------------------|-------------------------------|-----------------|--------------------------|
| 멤버십 4계층 구분           | 비회원/일반/크리에이터/파트너 | 파트너만        | 일반·크리에이터 신규     |
| Founding Creator 선착순 100 | 카운트+1년무료+배지           | 없음            | 전부 신규                |
| 참가 게이트(크리에이터만)   | apply 차단                    | 로그인만        | 멤버십 게이트 신규       |
| 투표권(일반+)               | 투표                          | 캐스팅 미구축   | 시즌4 연기 — 비급        |
| 크리에이터 대시보드         | /profile 확장                 | /profile v1     | 멤버십 상태 표시 추가    |
| Stripe 멤버십 결제          | $19.99/월 구독                | 일회성만        | 구독 모델 신규(큰 덩어리)|

핵심: 파트너 골격은 잘 갖춰짐. **멤버십(참가 자격) 축은 0에서 신규.** Stripe 구독은 별도 대공사.

===========================================================================
## C. 결정 필요 (TK / v2.1 규정문서로 상당수 해소 예상)
===========================================================================

1. 멤버십 4계층 <-> 파트너 등급 관계: 직교 2축인가?
   추천: membership_tier(참가권/결제) || partner_tier(개설권/실적) 분리. 섞지 말 것.
2. 일반 멤버(비크리에이터) 정의/혜택: 시즌0에서 실제 권한 필요한가, "로그인=일반멤버"로 충분한가?
3. Founding Creator 100 카운트 기준: 멤버십 가입 시각순? 동시성 안전 카운터 필수(선착순=race).
   가입 != 시즌0 신청 — 별개인가?
4. 멤버십이 시즌0 신청의 선행조건인가(=크리에이터 멤버만 신청), 독립인가?
5. 무료 100명의 "1년" = 가입일+12개월? 시즌0 종료까지? (무료기간 만료 처리)
6. 월 구독 갱신/취소 정책: 1년 후 자동 유료전환? 취소 시 참가중 시즌 처리?
7. 시즌0 결제 활성화 시점 + Stripe 라이브 승인 + 멤버십 전용 게이트 키.

===========================================================================
## D. 작업 계획 (결정/v2.1 후 착수, 단계별)
===========================================================================

Phase 0 스키마: platform_config 멤버십 키(가격/무료정원/게이트) + profiles 멤버십 컬럼
  (membership_tier, membership_started_at, membership_expires_at,
   founding_creator_number, is_founding_creator) + **동시성 안전 선착순 카운터**
  (Postgres sequence 또는 advisory lock — race 방지)
Phase 1 가입/구분: 멤버십 판정 헬퍼 lib/membership.ts(server-only) + 4계층 분류
Phase 2 Founding Creator: 선착순 100 카운터 + 배지 + 1년 무료 부여
Phase 3 참가 게이트: /apply 크리에이터 멤버 게이트(결정4 의존)
Phase 4 Stripe 구독: mode:subscription + Product/Price + subscription 웹훅 + 갱신/취소/연체
  (별도 큰 덩어리)
Phase 5 대시보드: /profile 멤버십 상태/배지/만료 표시
Phase 6 투표: 시즌4 연기 — 범위 외

규모: P0~P3 = 시즌0 발사 전 필수(중간 규모). P4 Stripe 구독 = 독립 대공사. P5 소규모.
하드코딩 금지: 가격/정원/% 전부 platform_config·seasons.
