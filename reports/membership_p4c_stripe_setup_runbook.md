# 멤버십 P4c — TK Stripe 외부작업 런북 (2026-06-14)

대상: TK 대표님. Stripe 대시보드 + Supabase + Vercel. 테스트모드 기준.
전제: P4a 스키마 라이브(config 3키 존재). P4b 코드 라이브(checkout, dark launch inert).

===========================================================================
## 핵심 답변 (TK 질문 5)
===========================================================================
1. **Webhook URL** = `https://oxxovo.com/api/membership/stripe-webhook`
   - 도메인 = oxxovo.com (APP_URL 기준, oxxovo.ai 아님). 테스트/라이브 **URL 동일**.
     테스트vs라이브는 URL이 아니라 *어느 모드 대시보드에서 만드냐 + 어느 키냐*로 갈림.
   - studio webhook(/api/studio/stripe-webhook)과는 **별개 엔드포인트 + 별개 시크릿**.
2. **구독 이벤트 5개** (오타 없이):
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.paid`
3. **Price 불필요 — Product만**. 코드가 inline price_data로 가격 주입(config 변동값).
   단 새 Stripe 대시보드는 Product 생성 시 Price 1개를 요구함 -> $19.99/month recurring로
   하나 넣어도 됨(코드는 안 씀, 무해한 placeholder). 핵심은 **Product의 prod_id**.
4. **prod_id를 config에** = TK가 Supabase에서 아래 UPDATE 1줄 Run(섹션 C).
5. **whsec_ 시크릿** = Vercel 환경변수 `STRIPE_MEMBERSHIP_WEBHOOK_SECRET`에 **TK가 직접**
   입력. 화면 노출 금지. studio용 STRIPE_WEBHOOK_SECRET과 다른 변수.

===========================================================================
## A. Stripe 대시보드 -- Product 생성 (테스트모드)
===========================================================================
1. 우상단 "Test mode" 토글 ON 확인.
2. Product catalog -> Add product.
   - Name: `OXXOVO Creator Membership`
   - (Price 요구되면) $19.99 / Recurring / Monthly 입력 -- 코드 미사용 placeholder.
   - Save.
3. 생성된 Product 페이지에서 **Product id (prod_...)** 복사.

===========================================================================
## B. Stripe 대시보드 -- Webhook 엔드포인트 (테스트모드)
===========================================================================
1. Developers -> Webhooks -> Add endpoint.
2. Endpoint URL: `https://oxxovo.com/api/membership/stripe-webhook`
3. "Select events" -> 위 5개 이벤트 정확히 체크:
   checkout.session.completed / customer.subscription.updated /
   customer.subscription.deleted / invoice.payment_failed / invoice.paid
4. Add endpoint.
5. 엔드포인트 상세 -> "Signing secret" -> Reveal -> **whsec_... 복사**.
   - 주의: 이 엔드포인트는 P4c 라우트 배포 전까지 404(테스트모드라 실이벤트 없음 = 무해).

===========================================================================
## C. Supabase -- prod_id 를 config 에 (TK Run, 1줄)
===========================================================================
-- 'prod_...' 자리에 A-3에서 복사한 실제 Product id.
UPDATE public.platform_config
SET value = 'prod_REPLACE_ME'
WHERE key = 'membership_stripe_product_id';

-- 확인:
SELECT key, value FROM public.platform_config WHERE key = 'membership_stripe_product_id';

===========================================================================
## D. Vercel -- 환경변수 (TK 직접, 화면노출 금지)
===========================================================================
- Project Settings -> Environment Variables -> Add:
  - Name: `STRIPE_MEMBERSHIP_WEBHOOK_SECRET`
  - Value: B-5의 whsec_... (테스트)
  - Environment: Production (+ Preview 원하면)
- 기존 STRIPE_SECRET_KEY(sk_test_) 이미 설정됨 -- 그대로(구독도 같은 키 사용).

===========================================================================
## E. 순서 + 다음
===========================================================================
1. TK: A(Product) -> C(config UPDATE)  [지금 가능]
2. TK: B(webhook) -> D(env secret)     [지금 가능, 라우트 배포 전이라 404지만 무해]
3. 지수: P4c webhook 라우트 작성(/api/membership/stripe-webhook + 5이벤트 처리)
4. TK: P4c 머지본 production 수동배포(auto-deploy OFF)
5. E2E: 테스트모드 구독 -> webhook이 profiles 갱신 확인
- 라이브 전환(시즌0 오픈 전): live 모드에서 A~B 반복(live Product + live webhook) +
  STRIPE_SECRET_KEY를 sk_live_로 + STRIPE_MEMBERSHIP_WEBHOOK_SECRET를 live whsec_로 스왑.
