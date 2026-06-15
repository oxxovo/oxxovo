# 멤버십 P4 — Stripe 구독 ($19.99/월) 설계 (DESIGN ONLY, 2026-06-14)

상태: **실측 + 설계만. 코드 착수 X.** TK 승인 + Stripe 외부작업 후 단계별 구현.
설계자: 지수(oxxovo 본체). 원칙: 하드코딩 금지(가격=config) / webhook=진실원천 / 멱등 / dark launch.

===========================================================================
## A. 현재 Stripe 상태 (실측 file:line)
===========================================================================
- `lib/stripe.ts`: 싱글톤 클라이언트. **테스트모드**(sk_test_). 라이브=STRIPE_SECRET_KEY 스왑만(코드0). `isTestMode()` 보유. SDK `stripe@^22.2.0`.
- `app/api/studio/checkout/route.ts`: **mode:'payment'(일회성)**. **inline price_data**(Stripe Product 객체 미사용) + customer_email + metadata(userId/credits) + session.id 멱등. 게이트=session6+studio_purchase_enabled.
- `app/api/studio/stripe-webhook/route.ts`: STRIPE_WEBHOOK_SECRET로 서명검증 -> **checkout.session.completed만** 처리 -> grantPurchasedCredits. 500 반환시 Stripe 재시도.
- `lib/credits.ts` grantPurchasedCredits: **stripe_session_id unique index 멱등**(재전송 중복크레딧 방지, 23505=중복). 이 패턴을 구독 webhook도 그대로 따른다.
- cron 3개(`vercel.json`): email-tick(*/15), season-tick(hourly), partner-stats(weekly). **4번째 추가=plan limit 함정([[feedback_vercel_cron_limits]]).**
- auto-deploy OFF(`git.deploymentEnabled.main=false`).
- P0 profiles 컬럼 이미 존재: stripe_customer_id, stripe_subscription_id, membership_* (재사용).

===========================================================================
## B. 갭: 일회성 -> 구독
===========================================================================
| 항목 | 일회성(있음) | 구독(필요) |
|------|--------------|------------|
| mode | payment | **subscription** |
| 고객 | customer_email 단발 | **Stripe Customer 영속**(stripe_customer_id 저장/재사용) |
| 가격 | unit_amount 1회 | **recurring{interval:month}** (가격=config 변동) |
| webhook | checkout.session.completed | **+subscription.updated/deleted, invoice.payment_failed/paid** |
| 상태 | 없음(크레딧 적립뿐) | **membership_status 라이프사이클**(active/past_due/canceled) |
| 만료 | 없음 | **expires_at = current_period_end**(P1 단일 진실원) |
| 갱신/취소/연체 | 없음 | **자동갱신 + 취소(기간말) + dunning + 사전알림** |
| founding 전환 | 없음 | **무료1년 -> 유료 전환 흐름** |

===========================================================================
## C. 구독 설계
===========================================================================

### C-1. 가격 모델 = inline price_data + recurring (변동가 유지, 추천)
기존 일회성과 동일하게 **inline price_data**로 가되 recurring 추가:
```
line_items:[{ quantity:1, price_data:{
  currency:'usd',
  unit_amount: Math.round(membership_creator_price_usd*100),  // config 변동값
  recurring:{ interval: membership_billing_interval },         // 'month'
  product: membership_stripe_product_id,  // TK가 만든 Product 1개에 묶음(대시보드 그룹핑)
}}]
mode:'subscription'
```
- 가격이 config라 **하드코딩 0 + 변동 가능**. Product는 TK가 1개만 생성(가격 없는 Product) -> 모든 구독이 한 Product로 집계. price는 코드가 주입.
- 대안(고정가): 대시보드에서 Price 객체 생성 -> price_id를 config 저장. 가격변동시 새 Price 필요. **추천=inline**(변동가 원칙 부합).

### C-2. Customer 생성/재사용
- 첫 구독: stripe.customers.create({email, metadata:{userId}}) -> profiles.stripe_customer_id 저장.
- 재구독/관리: 저장된 customer 재사용. Checkout에 customer 전달.

### C-3. Webhook 이벤트 (전용 엔드포인트, 진실원천)
신규 `/api/membership/stripe-webhook` (studio webhook과 분리 -> 명확). 가드: `session.mode==='subscription'` + `metadata.kind==='membership'`.
| 이벤트 | profiles 반영 |
|--------|---------------|
| checkout.session.completed (sub) | stripe_customer_id, stripe_subscription_id, tier=creator, status=active, source=paid, expires_at=period_end |
| customer.subscription.updated | status(active/past_due/canceled) + expires_at=current_period_end + cancel_at_period_end 반영(갱신/취소예약 처리) |
| customer.subscription.deleted | status=canceled (만료 후 P1 읽기시점 general 강등) |
| invoice.payment_failed | status=past_due (dunning 진입) |
| invoice.paid | status=active 보장 + expires_at 갱신(정기결제 성공) |
- **멱등**: 신규 `membership_events` 테이블(event.id PK) -> credit_transactions 패턴 복제. 재전송 무해.
- 실패시 500 -> Stripe 재시도(기존 패턴).

### C-4. 취소 (기간말 유지)
- P5 대시보드 [구독 취소] -> server action -> stripe.subscriptions.update(sub,{cancel_at_period_end:true}).
- webhook updated -> cancel_at_period_end=true, **expires_at까지 creator 유지**. 기간말 deleted -> canceled.
- **주의**: P1의 CREATOR_ACCESS_STATUSES=['active']만. 취소예약(active+cancel_at_period_end)은 여전히 active라 접근 유지 OK. 단 **status가 'canceled'로 바뀌는 순간**(deleted) 접근 차단 -> 이때 expires_at도 지났으므로 정합. (P1 seam 주석대로 P4에서 확정: 취소예약기간 접근유지 = status가 active로 유지되는 Stripe 동작에 의존, 추가 분기 불요.)

### C-5. founding(무료1년) -> 유료 전환
- founding=source 'founding_free', Stripe sub 없음. expires_at=가입+12개월.
- 사전알림(만료 N일전): "무료 1년 종료 임박, 구독해야 계속" 이메일.
- 사용자가 Checkout 구독 -> webhook가 source=paid + 새 expires_at + sub ids. 매끄러운 업그레이드.
- 미구독시: expires_at 경과 -> **P1 읽기시점 자동 general 강등**(cron 불요). status 정리용 cron은 선택.
- **founding_creator_number는 영구 보존**(배지=영구 명예, 유료전환/만료 후에도 유지). [[project_hall_of_fame]] 결.

### C-6. 사전 갱신 알림 = email-tick 흡수 (신규 cron 금지)
- email-tick(*/15)에 스캔 추가: membership_expires_at in [now, now+notice_days] AND 미발송 -> 이메일.
- 중복방지: profiles.membership_renewal_notified_at(신규 컬럼) 사이클당 1회.
- 신규 이메일 템플릿: (a) 유료 갱신 임박, (b) founding 무료종료 임박. 기존 lib/email 인프라 재사용.

===========================================================================
## D. 신규 스키마 (P4a, TK Run)
===========================================================================
- platform_config 3키(P0에서 미룬 것 + Product):
  membership_billing_interval='month'(text), membership_renewal_notice_days='7'(int),
  membership_stripe_product_id=''(text, TK가 Product 생성 후 채움)
- profiles 2컬럼: membership_renewal_notified_at TIMESTAMPTZ,
  membership_cancel_at_period_end BOOLEAN DEFAULT false (UI 표시용, Stripe 미러)
- membership_events 테이블(멱등/감사): id TEXT PK(=stripe event.id), type TEXT,
  subscription_id TEXT, user_id UUID, created_at. RLS+service_role 전용(카운터 패턴).
- 전부 ADD-only 멱등, DO $$ 없음, ASCII.

===========================================================================
## E. TK 대표님 Stripe 외부작업
===========================================================================
1. **Product 1개 생성**(테스트모드): "OXXOVO Creator Membership", 가격 없이(또는 무시).
   -> product_id(prod_...)를 알려주시면 config에 저장. (inline price가 가격 주입.)
2. **Webhook 엔드포인트 추가**: POST {APP_URL}/api/membership/stripe-webhook,
   이벤트 5종(checkout.session.completed, customer.subscription.updated/deleted,
   invoice.payment_failed, invoice.paid) -> whsec_ -> 환경변수
   STRIPE_MEMBERSHIP_WEBHOOK_SECRET 설정(화면 노출 금지, Vercel/Railway에 직접).
3. **Dunning 정책**(대시보드 Billing -> 재시도): 실패 재시도 횟수/취소 시점 설정
   -> past_due->canceled 타이밍 결정(D-3 결정).
4. **라이브 전환시**(시즌0 오픈 전): live STRIPE_SECRET_KEY 스왑 + live Product +
   live webhook secret. 코드변경 0.

===========================================================================
## F. 단계 쪼개기 (검증하며, 한 번에 X)
===========================================================================
- **P4a 스키마**: D절 SQL -> TK Run + 검증. (외부작업 1,2 병행)
- **P4b 구독 시작**: createMembershipCheckout(server action) + /api/membership/checkout
  (subscription mode, inline recurring price_data, Customer 생성/재사용).
  -> /apply 게이트 quota_full "유료" placeholder를 **실제 구독 버튼**으로 교체.
- **P4c webhook**: /api/membership/stripe-webhook(서명검증 + 5이벤트 -> lib/membership
  mutation) + membership_events 멱등. lib/membership에 applySubscriptionState 헬퍼.
- **P4d 취소 + 대시보드**: cancelMembership(server action) + P5 상태표시(취소예약/만료일).
- **P4e 알림**: email-tick 스캔 + 템플릿 2종(갱신임박/founding종료) + notified_at 중복방지.
- 각 단계 tsc + build, P4a는 TK Run+검증. dark launch(enabled=false)라 전 단계 라이브 무해.

===========================================================================
## G. 결정 필요 (TK)
===========================================================================
1. **가격 모델**: inline price_data(변동가, 추천) vs 대시보드 Price(고정). 추천=inline+Product그룹핑.
2. **webhook 엔드포인트**: 전용 /api/membership/stripe-webhook(추천) vs studio webhook 확장.
3. **dunning**: 결제실패 재시도 횟수 + 최종취소 시점(대시보드). past_due 유지기간 = 이 정책.
4. **founding 만료 기본동작**: 만료까지 미구독시 자동 general 강등(읽기시점 이미 그럼). grace 없음 확인?
5. **past_due 접근정책**: 연체중(past_due) creator 접근 즉시 차단(P1 현재=active만) vs dunning동안 유지?
   P1 기본=즉시차단. dunning 유예 원하면 CREATOR_ACCESS_STATUSES에 past_due 추가(여기서 결정).
