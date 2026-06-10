# Postiz 자동게시 셋업 가이드 (admin-promo)

2026-06-10. TK 대표님이 클릭 단위로 따라 하는 가입/연결/키 발급 절차.
결정: **Postiz 클라우드 Standard $29/월** (5채널·400포스트/월 = 주 3편 4채널 충분).

---

## 1. 가입 + 플랜
1. https://postiz.com → **Sign in / Start** → 이메일 또는 Google 로그인
2. **Billing/Upgrade → Standard ($29/mo)** 선택 후 결제

## 2. 4채널 연결 (Settings → Channels → "Add Channel")
- **Instagram**: Instagram **Business/Creator** 계정 필요 (연결된 Facebook 페이지 요구될 수 있음) → OAuth 승인
- **TikTok**: "Add" → TikTok 로그인 → 권한 승인
- **YouTube**: Google OAuth → **@OXXOVO** 채널 선택 → 승인
- **X**: 아래 BYO 키 절차 후 연결

## 3. X BYO 개발자 앱 키 (console.x.com, 약 5분)
1. https://console.x.com 로그인 → **Projects & Apps** → **Create App** (이름 예: `OXXOVO-Postiz`)
2. **Keys and tokens** → **API Key & Secret** + **OAuth 2.0 Client ID/Secret** 발급/복사
3. **User authentication settings** → OAuth 2.0 켜고, **Callback/Redirect URL** 에 Postiz X 연결 화면이 안내하는 redirect URL 입력
4. Postiz의 X 채널 연결 화면에 위 키들을 입력 → 승인

## 4. API 키 발급
- Postiz **Settings → Developers → Public API → Generate** → API 키 복사

## 5. 채널 integration id 확인
- 키로 한 번 호출:
  ```bash
  curl -H "Authorization: <API_KEY>" https://api.postiz.com/public/v1/integrations
  ```
  → 응답에서 IG/TikTok/YouTube/X 각각의 `id` 확인 (또는 키를 지수에게 주면 조회해 채워둠)

---

## 6. 키 받은 후 "끼우기만" (지수가 골격 완료, 값만 주입)

**A. Vercel 환경변수** (Project Settings → Environment Variables, Production):
```
POSTIZ_API_KEY = <발급받은 키>
# POSTIZ_API_URL 은 클라우드 기본값(api.postiz.com)이라 생략 가능
```
`POSTIZ_API_KEY` 가 있으면 자동게시가 켜지고(`isPostizEnabled()=true`), 없으면 생성/아카이브만 동작.

**B. platform_config 채널 id** (Supabase SQL Editor):
```sql
UPDATE public.platform_config SET value='<ig_integration_id>'      WHERE key='postiz_channel_instagram';
UPDATE public.platform_config SET value='<tiktok_integration_id>'  WHERE key='postiz_channel_tiktok';
UPDATE public.platform_config SET value='<youtube_integration_id>' WHERE key='postiz_channel_youtube';
UPDATE public.platform_config SET value='<x_integration_id>'       WHERE key='postiz_channel_x';
```
(placeholder 행은 `reports/promo_videos_migration_2026-06.sql` 가 미리 넣어둠.)

**C. Postiz MCP (Claude 직접 운영 — 전자동화 비전)**
키 발급 후 세션에 Postiz MCP 연결:
```bash
# Postiz MCP 엔드포인트/방식은 https://postiz.com/mcp 안내 기준(키 받은 후 실측 확정)
claude mcp add --transport http postiz <MCP_URL> --header "Authorization: <API_KEY>"
```
→ 붙으면 "이 영상 내일 15시 4채널 예약" 같은 자연어 운영 가능.

---

## 골격 현황 (지수, feat/admin-promo)
- `lib/postiz.ts` — REST 클라이언트, `isPostizEnabled()`, `getPostizChannelIds()`(platform_config), `uploadMedia()`, `publishPost()`. 조건부·서버전용·하드코딩0
- `app/api/admin/promo/publish/route.ts` — admin 인증 + 조건부 게이트 + 서버권위(영상 URL DB 조회) + 게시 후 promo_videos 기록
- `reports/promo_videos_migration_2026-06.sql` — promo_videos 테이블 + Postiz 컬럼 + 채널 placeholder + RLS(admin SELECT)
- **키 발급 후 실측 조정 1건**: Postiz `/upload`·`/posts` 응답 파싱(현재 id/path/url 추정) — 실제 응답으로 확정
