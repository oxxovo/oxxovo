# 멤버십 P0 스키마 설계 초안 (DRAFT — 미구현, 2026-06-14)

상태: **설계만. 구현 착수 X.** v2.1 규정문서 + 시즌0 참가비 결정 받으면 -> 최종 SQL + lib/membership.ts 한 번에.
설계자: 지수(oxxovo 본체). 원칙: 직교 2축 / 단일 진실원 / 하드코딩 금지 / 동시성 안전.

===========================================================================
## 0. TK 확정값 (2026-06-14)
===========================================================================
- membership_founding_free_months = 12 (가입일 + 12개월)
- membership_required_for_apply   = true (참가 = 크리에이터 멤버십 결제 필수)
- 출전 무제한 (크리에이터 멤버는 시즌 내 출전 횟수 제한 없음)
- 1년 후 = 자동 갱신(취소 안 하면) + 사전 알림 **필수**
- 참가비도 변동(하드코딩 금지, seasons.entry_fee). **3중 결제 = 멤버십 + 참가비 + 크레딧**
- **시즌0 참가비 = $0 확정** (무료 시합). entry_fee는 변동값이라 시즌1+엔 받음.
  -> 시즌0 결제 = **멤버십 구독만** (참가비 0). Founding 100 무료, 101~500 유료.
  -> **함의: P4(Stripe 구독)가 시즌0 발사 전 필수.** required_for_apply=true + 정원 500 +
     무료 100이므로 101~500번째는 $19.99/월 결제해야 시즌0 참가 가능. P4 연기 불가.

### 3중 결제 모델 (서로 독립)
| 결제 | 성격 | 출처/엔진 | 상태 |
|------|------|-----------|------|
| 멤버십 $19.99/월 | 구독(recurring) | platform_config + Stripe subscription | P4 신규 |
| 참가비(entry fee) | 시즌별 1회 | seasons.entry_fee(변동) | 컬럼 존재, 결제연동 미정 |
| 스튜디오 크레딧 | 일회성 충전 | studio_credit_* + Stripe payment | 라이브(테스트모드) |

===========================================================================
## 1. profiles 신규 컬럼 (ADD-only, 멱등)
===========================================================================
| 컬럼 | 타입 | 기본 | 의미 |
|------|------|------|------|
| membership_tier        | TEXT        | 'general' | general(로그인=일반) / creator(참가권) |
| membership_status      | TEXT        | 'none'    | none/active/past_due/canceled |
| membership_source      | TEXT        | NULL      | founding_free / paid |
| membership_started_at  | TIMESTAMPTZ | NULL      | 멤버십 시작 |
| membership_expires_at  | TIMESTAMPTZ | NULL      | 만료/갱신일 — **게이트 판정 단일 출처** |
| founding_creator_number| INT UNIQUE  | NULL      | 선착순 서수 1~100 (NULL=비파운딩) |
| stripe_customer_id     | TEXT        | NULL      | 구독용(P4) |
| stripe_subscription_id | TEXT        | NULL      | 구독용(P4) |

- is_founding_creator bool 안 둠 -> founding_creator_number IS NOT NULL 로 파생(단일 진실원).
- founding_free: started_at + 12개월 = expires_at. 만료 시 자동 갱신(취소 안 했으면 paid 전환) + 사전 알림.

===========================================================================
## 2. 선착순 100 — 동시성 안전 카운터 (핵심)
===========================================================================
선착순=race. sequence는 cap을 원자적으로 못 막음 -> 단일 카운터 행 + 원자적 조건부 UPDATE.

CREATE TABLE IF NOT EXISTS public.membership_founding_counter (
  id      INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  claimed INT NOT NULL DEFAULT 0
);
INSERT INTO public.membership_founding_counter (id, claimed)
VALUES (1, 0) ON CONFLICT DO NOTHING;

-- 청구 (서버에서, cap은 platform_config.membership_founding_free_count 주입):
UPDATE public.membership_founding_counter
SET claimed = claimed + 1
WHERE id = 1 AND claimed < $founding_cap   -- 예: 100
RETURNING claimed;                          -- 서수 반환. NULL이면 정원 마감 -> 유료 경로

단일 statement = 행 잠금으로 동시 청구 직렬화. race-safe + gap-free + cap 원자보장.

===========================================================================
## 3. platform_config 신규 키 (전부 변동값, 하드코딩 금지)
===========================================================================
| key | value(확정/예시) | type | 의미 |
|-----|------------------|------|------|
| membership_enabled               | false   | bool    | 마스터 스위치(dark launch) |
| membership_creator_price_usd     | 19.99   | decimal | 크리에이터 월 구독가 |
| membership_founding_free_count   | 100     | int     | 무료 정원(2의 cap) |
| membership_founding_free_months  | 12      | int     | 무료 기간 (확정) |
| membership_required_for_apply    | true    | bool    | 참가 선행조건 (확정) |
| membership_billing_interval      | month   | text    | 청구 주기 |
| membership_renewal_notice_days   | 7       | int     | 갱신 사전 알림 리드타임(확정 필요) |

참가비는 platform_config 아님 -> seasons.entry_fee(시즌별). **시즌0 entry_fee = 0 확정**(무료시합).

===========================================================================
## 4. 4계층 판정 (lib/membership.ts, server-only — 설계만)
===========================================================================
비회원      = auth 행 없음
일반멤버    = profile 존재 & (membership_tier='general' OR creator 만료)
크리에이터  = membership_tier='creator' AND membership_status='active'
              AND (expires_at IS NULL OR now < expires_at)
파트너      = partner_tier 존재 (직교 — 위와 무관, 동시 보유 가능)

참가 게이트(/apply): membership_required_for_apply=true 이면
  크리에이터 판정 통과 + (시즌 entry_fee 결제 완료) 둘 다여야 신청 가능.

===========================================================================
## 5. 자동 갱신 + 사전 알림 (P4 연계 설계 노트)
===========================================================================
- 자동 갱신: Stripe subscription(mode:'subscription')이 갱신 주체. 취소 안 하면 자동 청구.
- 사전 알림: 갱신 N일 전(membership_renewal_notice_days) 이메일.
  -> 기존 이메일 인프라(lib/email) + cron(email-tick) 재사용. 신규 템플릿 1종.
- founding_free 만료 처리: 12개월 후 expires_at 도달 ->
  (a) 카드 등록되어 있으면 paid 자동 전환  (b) 없으면 결제 유도 알림 + creator 만료->general.
  구체 분기는 P4(Stripe 구독)에서. P0는 컬럼만 선반영.

===========================================================================
## 6. 단계 (참고 — 구현은 결정 후)
===========================================================================
P0 스키마(이 문서) -> P1 lib/membership.ts 판정 -> P2 founding 청구+배지+1년무료
-> P3 /apply 게이트(membership; 시즌0 entry fee=0) -> P4 Stripe 구독(갱신/취소/알림/연체)
-> P5 /profile 대시보드 -> P6 투표(시즌4 연기, 범위 외)
**P0~P4 전부 시즌0 발사 전 필수** (P4는 101~500번째 유료참가 때문에 연기 불가).

[대기 차단] v2.1 규정문서 확정 전 구현 착수 금지. (시즌0 참가비 결정은 완료: $0.)
