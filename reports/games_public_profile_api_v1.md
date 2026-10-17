# 게임용 공개 프로필 API 설계안 v1 (2026-10-16, 지수 작성)

**문서만. 코드·SQL·배포 0건.** 구현은 TK님·본부 승인 후. 표기: [레포] = 레포에서 확인, [제안] = 내 설계, [미확인] = 확인 못 함.

## 0. 요약
- **[2026-10-16 저녁 갱신] 경우 B(서버 간) 확정(게임 제니 답, 본부 전달). 이 문서의 구현 대상은 경우 B뿐이다.** 경우 A(§3)는 참고용으로 남기고 구현하지 않는다. §4-A가 §4·§5와 다르면 §4-A가 우선.
- 라우트(제안): `GET /api/games/v1/profiles/{id}` 와 `POST /api/games/v1/profiles/batch`(경우 B: 서버 간). 본부 표기 `profiles:batch`는 **Windows에서 폴더 이름에 `:`를 쓸 수 없어** 그대로 구현할 수 없다 -> `profiles/batch` 제안(§4-A-1). (경우 A의 `GET /api/games/v1/me`는 구현 안 함.)
- 반환 필드는 **3개 고정**: `id`, `display_name`, `locale`. 그 밖은 반환하지 않는다.
- **확정 결정(본부 2026-10-16):** v1 `display_name`=닉네임만, 실명 제외 / `country` 제외 / API 키는 환경변수 / 경우 A·B는 게임 제니 설계 답 후 확정(본부는 B 선호). 상세는 §9.
- **권장:** 가능하면 경우 B(게임 서버가 JWT를 자기가 검증하고, 우리에겐 `id`로 서버 간 호출). 경우 A는 게임 서버가 사용자 계정 자격증명 전체를 쥐게 된다(§3).
- 서버 라우트 B안은 본부 의견으로 이미 전달됨(EOD 5-5). 이 문서는 그 구체화.

## 1. 공통 사실
- 프로필 원본은 `profiles`. 브라우저·anon은 profiles를 읽을 수 없고 앱은 서버에서 `createSupabaseAdmin()`(service_role)로 읽는다 [레포 `lib/nickname.ts`]. 10-16 잠금 이후 authenticated는 SELECT만 가능(자기 행 `profiles_own_read`) [본부 전달].
- 표시 이름 소스 컬럼(`profiles`) [레포 `reports/studio_identity_columns_2026-08-19.sql`, `lib/nickname.ts`]: `display_name`(닉네임), `real_name`, `display_identity`(`'nickname'` 기본 | `'real_name'`, CHECK). `real_name`은 `display_identity='real_name'`일 때만 채워짐.
- `locale`: `profiles.locale`, 값 `'ko'|'en'|NULL`, 의미 = **이메일 언어(명시 선택, 국가로 추정 안 함)** [레포 `lib/profile.ts:83` `getLocaleForUser`]. 라이브 컬럼 존재는 **TK님 조회로 확인됨**(본부 전달 2026-10-16). 값 분포는 미확인.
- **`display_identity`를 읽어 표시 이름을 정하는 코드는 레포에 아직 없다** [EOD 5-5]. 이 API의 §2 규칙이 최초 구현이 되므로, 사이트의 다른 표면(랭킹·홍보물)과 **같은 함수를 공유**하도록 `lib/`에 한 곳으로 만들어야 한다(이중 규칙 방지).
- 인증 쿠키는 `proxy.ts`가 `/api`를 matcher에서 제외한다 [레포 `proxy.ts:147`] -> 이 라우트는 프록시를 타지 않고, 쿠키 세션과 무관하게 Bearer만 본다.
- Next.js: 이 버전의 Route Handler는 기본 **캐시 안 됨**이고 `GET`만 옵트인 가능 [`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`]. 구현 전 해당 문서와 `RouteContext` 타입 사용법을 다시 읽는다(AGENTS.md).
- 호스트는 `www.oxxovo.ai`만 호출. 다른 호스트는 308 리다이렉트이고 리다이렉트 시 클라이언트가 `Authorization`을 떼는 경우가 흔하다 [호스트 308: 메모리 기록, 헤더 제거는 클라이언트 구현 의존, 미실측].

## 2. 응답 계약

```json
{ "id": "uuid", "display_name": "string|null", "locale": "ko|en|null" }
```

| 필드 | 규칙 |
|---|---|
| `id` | `profiles.id` = `auth.users.id` = JWT `sub`. UUID. |
| `display_name` | **[결정 2026-10-16 본부] v1은 항상 닉네임(`profiles.display_name`)만.** `display_identity`·`real_name`은 읽지도 반환하지도 않는다. 닉네임이 비면 **`null`**, 이메일·이메일 앞부분·"CreatorXXXX" 같은 합성값으로 **채우지 않는다**(`feedback_absent_is_not_zero`). 앞뒤 공백 trim. (보류된 실명 규칙: `display_identity='real_name'`이고 `real_name`이 비어 있지 않으면 `real_name`. 동의 범위 확인 후 별도 버전에서 활성화.) |
| `locale` | `'ko'|'en'|null`. **null = 모른다.** 게임이 임의로 `en`으로 확정하지 않게 문서화. **게임 UI 언어 힌트**(원래 의미는 이메일 언어이며 사용자가 명시 선택한 값, 국가로 추정하지 않음). |

- **`country` 는 v1에서 제외 [제안].** 선택 필드로 거론됐지만 개인정보 성격이 크고 게임 쪽 필요가 불명. 필요가 확인되면 v1.1에서 추가(필드 추가는 하위 호환, 제거는 아님).
- **[결정됨 2026-10-16 본부] `real_name`은 v1에서 제외.** 이유: `display_identity`의 기존 동의 범위는 "참가자 본인 작품, OXXOVO 홍보 사본, 랭킹"(`studio_identity_columns_2026-08-19.sql` 주석)이고, 제3자 게임까지 닿는지는 확인되지 않았다. 동의 범위가 확인되면 별도 버전에서 실명 규칙을 켠다(응답 필드는 그대로 `display_name`, 값만 달라지므로 계약 변경 없음. 단 그 시점에 게임 쪽이 "이름이 닉네임이라고 가정"하지 않았는지는 확인 필요).
- 이름은 바뀔 수 있다(첫 제출 전까지 편집 가능, 이후 `display_name_locked_at`으로 잠김). 따라서 게임은 `id`를 키로 쓰고 이름은 표시용으로만 캐시(§6).
- **`select *` 금지:** 쿼리는 `.select('id, display_name, real_name, display_identity, locale')`로 컬럼 명시(v1 결정 반영 시 실제로는 `.select('id, display_name, locale')` 3개만, `real_name`·`display_identity`는 읽지 않아 새어 나갈 경로 자체가 없다). 응답 객체는 위 3개 키로 **직접 조립**하고, 조회 결과 객체를 그대로 반환하지 않는다. service_role은 RLS를 우회하므로 **항상 `.eq('id', …)` 또는 `.in('id', ≤50개)`**, WHERE 없는 조회 금지.
- 에러 본문은 고정 형식 `{"error":"<code>"}`, 코드는 `unauthorized|forbidden|not_found|rate_limited|bad_request|unavailable`. 스택·SQL 메시지·검증 단계 구분은 응답에 넣지 않는다.

## 3. 경우 A: 게임 서버가 사용자 JWT를 중계

흐름: 사용자가 OXXOVO에서 로그인 -> 게임 클라이언트/서버가 사용자의 Supabase access token을 가짐 -> 게임 서버가 `Authorization: Bearer <사용자 JWT>`로 `GET /api/games/v1/me` 호출 -> 우리가 검증 후 **그 토큰 주인의 프로필만** 반환.

### 3-1. JWT 검증 (ES256, JWKS)
- JWKS: `https://qrnkovokjmimagrwjebs.supabase.co/auth/v1/.well-known/jwks.json`, 현재 키 1개 `kty:EC, alg:ES256, crv:P-256, kid:5562f6cd-60ce-456e-87de-fd4b969793c4` [EOD 1-1에서 실측].
- **[미확인 -> 결정 2026-10-16: 게임 첫 연동 때 게임 쪽이 확인] 현재 발급되는 access token이 이 kid로 서명되는지, 우리는 토큰 헤더를 본 적 없음.** 확인 방법(게임 쪽에 전달): 로그인 토큰 하나의 **헤더(첫 조각)만** base64 디코드해 `alg`/`kid` 확인(페이로드·토큰 전체를 채팅·문서·로그에 붙이지 않는다). 프로젝트가 아직 대칭(HS256) 비밀키 서명이면 JWKS로는 검증이 안 되고, 그 경우 supabase-js `getClaims`는 Auth 서버 왕복으로 대체한다 [`@supabase/auth-js` 2.105.4 주석].
- 구현 방식 두 가지 [제안, 1번 권장]:
  1. `createClient(url, anonKey).auth.getClaims(jwt)` — supabase-js 2.105.4에 `getClaims(jwt?)`가 있고 비대칭 키면 JWKS로 로컬 검증, JWKS는 캐시, 대칭이면 서버 왕복 [레포 `node_modules` 확인]. **의존성 추가 없음.** 단 이 클라이언트는 **세션 저장 없는 별도 인스턴스**(`persistSession:false`, `autoRefreshToken:false`)로 만들 것: 문서에 "토큰이 곧 만료되면 세션을 먼저 갱신한다"는 동작이 있어 요청 단위 인스턴스에서 의도치 않은 상태를 만들 수 있다 [주석 근거, 실동작 미시험].
  2. `jose`(`createRemoteJWKSet` + `jwtVerify`) — 현재 `package.json`에 직접 의존성 없음 [레포 확인]. 추가는 TK님 승인 필요.
- **검증 항목(모두 통과해야 함):** 서명(알고리즘 **ES256만 허용**, `none`·HS* 거부 = 알고리즘 혼동 차단), `iss = https://qrnkovokjmimagrwjebs.supabase.co/auth/v1`, `aud = authenticated`, `exp` 미만료(시계 오차 ≤30초), `sub`가 UUID 형식, `role = authenticated`(anon 키로 만든 토큰은 `role: anon`이고 `sub` 없음 -> 거부), `is_anonymous` 가 true면 거부 [claims 이름은 Supabase 문서 기준, 라이브 토큰으로 미확인].
- **JWKS 처리:** 메모리 캐시(TTL ≥10분), 모르는 `kid`가 오면 1회 재조회(재조회 자체를 1분에 1회로 제한해 가짜 kid 폭주가 JWKS 호출 폭주가 되지 않게). 서버리스 콜드 스타트마다 한 번 조회될 수 있음(허용).
- **인가 규칙:** 이 경로는 **`sub`의 프로필만** 반환. 쿼리 파라미터·경로의 `id`를 받지 않는다(타인 조회 불가 = IDOR 구조적 차단).
- **폐기 한계:** JWT는 만료(Supabase 기본 1시간 [미확인, 대시보드 설정값])까지 로그아웃·계정 정지 후에도 유효. 완화: (a) 프로필 행이 없으면 401로 처리, (b) 정지 여부까지 막아야 하면 `auth.admin.getUserById`로 확인(추가 호출·비용, 필요성은 본부 판단).

### 3-2. 경우 A의 위험 (설계에 못 박을 것)
- 게임 서버가 쥔 사용자 access token은 **PostgREST에 그대로 쓸 수 있는 그 사용자의 자격증명**이다. 10-16 잠금 후 profiles 쓰기는 막혔지만, 사용자 세션으로 가능한 일(자기 `genesis_applications` 조회·관리자라면 UPDATE 등)은 그대로 열려 있다. **게임 서버 = 신뢰 대상**으로 취급하고, 토큰을 로그·에러 리포트·분석에 남기지 않을 것을 게임 쪽 요구사항으로 문서화.
- 브라우저/클라이언트에서 우리 API를 직접 부르는 경우 CORS가 필요해진다 -> **v1은 서버 간 호출만 허용, CORS 헤더 없음** [제안].
- 토큰이 게임 클라이언트(플레이어 PC)를 거치면 탈취면이 커진다. 권장: 게임 클라이언트는 토큰을 게임 서버에 TLS로만 전달.

## 4. 경우 B: 서버 간 호출

흐름: 게임 서버가 사용자 JWT를 **자기가 로컬 검증**(§3-1과 같은 규칙, 공개 JWKS라 우리 허락 없이 가능)해 `sub`를 얻은 뒤, 우리에게 `Authorization: Bearer <게임 API 키>`로 `GET /api/games/v1/profiles/{id}` 호출. 사용자 토큰은 우리에게 오지 않는다 -> §3-2 위험 소멸. **권장 경로.**

- **API 키 [제안, §4-A-4가 최신]:** 32바이트 이상 난수. **v1은 환경 변수**로 둬서 **새 DB 테이블을 만들지 않는다**(만들면 `db_new_table_checklist_2026-10-16.md` 전 항목 적용). 비교는 상수 시간(`timingSafeEqual`). 키는 로그·에러·URL에 넣지 않는다(헤더만). 이중 운영 방식은 §4-A-4.
- 키별 허용 범위: v1은 모든 키가 동일 3필드 읽기만. 키 폐기 = 환경 변수 제거 + 재배포(`deploy:prod`). **즉시 폐기가 필요하면 재배포가 필요하다는 한계** — 더 빠른 폐기가 필요하면 v2에서 DB 테이블(체크리스트 적용).
- 엔드포인트:
  - `GET /api/games/v1/profiles/{id}` : `id` UUID 형식 아니면 400. 없으면 **404, 응답 형태는 존재하는 경우와 구분 불가한 본문 최소화**.
  - `POST /api/games/v1/profiles/batch` : **[§4-A-1로 대체됨]** (초안은 최대 50개·없는 id 생략이었으나 게임 제니 요구로 최대 100개·id별 응답·없는 id는 null).
- 호출자가 임의 `id`를 조회할 수 있는 구조이므로 **UUID 열거 위험**은 UUID 난수성에 의존(추측 불가). 필드가 3개로 한정되고 `id`는 게임이 이미 JWT로 아는 값이어야 하므로 v1 수용. 이상 패턴(404 다수)은 §5 임계로 차단.
- 그 외 사용자 토큰이 이 경로로 오면 거부(두 인증 방식을 한 라우트에 섞지 않는다: 경우 A는 `/me`, B는 `/profiles/*`로 경로 분리해 혼동 방지).

## 4-A. 경우 B 확정 사양 (2026-10-16 저녁, 게임 제니 답 반영) -- §4·§5와 충돌하면 이 절이 우선
문서만. 구현은 TK님 승인 후. [레포]=레포 확인, [제안]=내 제안, [미확인]=확인 못 함.

### 4-A-1. 배치 조회
- **경로:** `POST /api/games/v1/profiles/batch` [제안]. 본부 표기 `profiles:batch`는 라우트 폴더 이름에 `:`가 들어가는데 **Windows 파일 이름에 `:`를 쓸 수 없어** 이 PC에서 만들 수 없다. 게임 쪽이 `:batch` 표기를 이미 쓰고 있다면 `next.config`의 `rewrites`로 `/profiles:batch` -> `/profiles/batch`를 받는 방법이 있으나(Next 쪽 문서 확인 필요, 미시험), 새 표기로 바로 맞추는 쪽이 간단하다. **[확정 2026-10-16 저녁, 본부] 경로는 `POST /api/games/v1/profiles/batch`.** `profiles/batch`와 `profiles/[id]`는 정적 세그먼트가 우선이라 충돌하지 않는다(Next 일반 규칙, 미시험).
- **요청:** `{"ids":["<uuid>", …]}`. **최대 100개**. 중복은 서버가 제거(응답 키는 고유 id). 101개 이상 -> 400. 빈 배열 -> 400(또는 빈 객체, 결정 필요 -- 제안은 400). **형식이 UUID가 아닌 id가 하나라도 있으면 전체 400**(클라이언트 버그를 조용히 null로 덮지 않는다) [제안].
- **응답(200):** id별 맵.
```json
{
  "profiles": {
    "<id-1>": { "id": "<id-1>", "status": "active",   "display_name": "Kira", "locale": "ko" },
    "<id-2>": { "id": "<id-2>", "status": "disabled" },
    "<id-3>": null
  }
}
```
  - 요청한 **모든 고유 id가 키로 들어간다**(누락 없음). 값이 `null` = 프로필 없음(§4-A-3).
  - `active`: `{id, status:"active", display_name, locale}`. `display_name`·`locale`은 각각 `null` 가능(§2).
  - `disabled`: `{id, status:"disabled"}` -- **이름·locale을 일절 안 준다.**
  - 단건 `GET /profiles/{id}`는 같은 객체를 반환하되 없으면 **404**, `disabled`는 200으로 `{id,status:"disabled"}`.
- **DB 조회는 요청당 1회:** `.in('id', ids)`로 `id, display_name, locale`(+§4-A-3의 상태 판정에 필요한 것)만. 100개 이상을 한 번에 읽는 경로가 생기지 않게 상한은 라우트에서 먼저 검사한다. 기존 `getDisplayNames()`(`lib/nickname.ts`)와 같은 조회 모양이지만 그 함수는 `display_name`만 돌려주고 빈 이름을 버리므로 그대로 재사용하지 않는다 [레포].

### 4-A-2. `sub` = `auth.users.id` = `profiles.id` 확인 (결론: 맞다, 단 라이브 본문은 미대조)
- 가입 트리거 `handle_new_user`: `INSERT INTO public.profiles (id, email) VALUES (new.id, new.email) ON CONFLICT (id) DO NOTHING` -- `new.id`는 `auth.users.id` [레포 `reports/auth_handle_new_user_2026-07-28.sql` STEP 1].
- 앱 쪽 두 번째 경로 `ensureProfileRow(userId, email)`: `upsert({ id: userId, email }, { onConflict: 'id', ignoreDuplicates: true })`, `userId`는 세션 `user.id` [레포 `lib/profile-row.ts:40`]. 닉네임·프로필 코드가 전부 `profiles.id = user.id`로 읽고 쓴다(`lib/nickname.ts`의 `.eq('id', userId)` 등).
- JWT `sub` = `auth.users.id`는 Supabase 표준 클레임이다 [일반 지식, 실제 토큰 미확인; 게임 첫 연동 때 확인(6번 결정)].
- **한계:** 이 트리거 본문은 레포의 **재구성본**이고 원본이 아니다(파일 머리말). 라이브 본문은 그 파일의 STEP 4(`pg_get_functiondef`)로 대조해야 확정된다 [미확인]. 또 7/28 사고로 트리거가 없던 기간에 가입한 계정은 `profiles` 행이 없을 수 있다(백필 `profiles_backfill_missing_rows_2026-07-28.sql`로 메웠다고 기록되나 적용 결과는 이 세션이 본 적 없음). 행이 없는 실제 계정은 응답에서 `null`이 된다 -- 게임은 `null`을 "존재하지 않음"이 아니라 "프로필을 찾지 못함"으로 취급해야 한다.

### 4-A-3. 탈퇴·정지 판정
**[결정 2026-10-16 저녁, 본부] v1은 방식 (c): `profiles` 행 유무만 본다.** `auth.users`의 `banned_until`/`deleted_at`은 읽지 않고, v1 응답은 `active` 또는 `null`만 나온다(`disabled`는 응답 형식으로만 예약, v1 코드는 만들지 않음). 방식 (a) DB 함수는 앱에 정지 기능이 생길 때 다시 검토. 아래 (b)·(a)·표는 그때를 위한 기록이다. 게임 쪽 "세션 시작 시와 주기적으로 `status` 확인" 지침은 그대로 유지(v1에서는 `null`/`active` 변화를 보는 것이 전부임을 함께 안내).
**먼저 확인된 사실**
- `profiles`에는 정지·탈퇴 컬럼이 **없다**(본부 확인과 같음). 레포에 `auth.admin.deleteUser`·`banned_until`·`ban_duration` 사용 코드도 **0건**이다(`deleted_at` 사용처는 홍보영상 휴지통 `promo_videos`뿐, 계정과 무관) [레포 grep]. 즉 **앱에는 계정 탈퇴·정지 기능이 없고**, 계정 삭제·정지는 Supabase 대시보드나 직접 Auth Admin 호출로만 일어난다.
- `auth.users`의 `banned_until`, `deleted_at`: Auth 클라이언트 타입의 `User`에 `banned_until?: string`, `deleted_at?: string`이 있다 [레포 `node_modules/@supabase/auth-js` 타입]. `auth.admin.getUserById(id)`로 읽을 수 있다(타입 확인, 호출은 시험 안 함). 정지 중 = `banned_until`이 현재보다 미래, 소프트 삭제 = `deleted_at`이 non-null [Supabase 일반 동작, 이 프로젝트에서 실측 안 함].
- **탈퇴 시 `profiles` 행이 지워지는가: 레포로 증명할 수 없다.** `profiles`의 `CREATE TABLE`이 레포에 없다(레포 밖에서 생성; 7/28 사고 기록과 같은 부류). 다른 테이블은 `auth.users`를 `ON DELETE CASCADE`(스튜디오·워치 등) 또는 `SET NULL`(`genesis_applications.user_id` 등)로 참조한다 [레포]. `profiles.id`가 `auth.users(id) ON DELETE CASCADE`인지는 **라이브 조회가 필요하다 [미확인]** -- 아래 읽기 SQL 1건(TK님 Run, 결과는 본부 경유):
```sql
select conname, contype, confdeltype, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.profiles'::regclass and contype = 'f';
```
  `confdeltype`: `c`=CASCADE, `n`=SET NULL, `a`=NO ACTION, `r`=RESTRICT. `auth.users`를 참조하는 행이 아예 없으면 하드 삭제 후 `profiles` 행이 **고아로 남는다**.

**제안 응답 규칙** (id별, §4-A-1 형식)
| 상황 | 응답 |
|---|---|
| 정상 | `{id, status:"active", display_name, locale}` |
| 정지(`banned_until` 미래) 또는 소프트 삭제(`deleted_at` non-null) | `{id, status:"disabled"}` -- **정지와 탈퇴를 구분해 알리지 않는다**(운영 사유 노출 방지, 게임이 취할 행동이 같음) |
| `profiles` 행 없음 (하드 삭제+cascade, 행 미생성, 존재한 적 없는 id) | `null` -- 하드 삭제와 "원래 없음"은 **구분 불가**하다고 문서화 |
| `profiles` 행은 있으나 `auth.users` 행이 없음(cascade 아닐 때 고아) | 상태 조회가 `auth.users`를 읽으므로 `disabled`로 처리 [제안, 위 SQL 결과에 따라 확정] |

**어떻게 `banned_until`/`deleted_at`을 읽나 (PostgREST는 `auth` 스키마를 기본 노출하지 않음)**
- (a) **권장:** `public`에 읽기 전용 `SECURITY DEFINER` 함수 1개를 새로 만든다 -- 예: `public.games_account_status(p_ids uuid[])`가 `(id, disabled boolean)`를 반환, `search_path` 고정, `REVOKE ALL ... FROM PUBLIC, anon, authenticated`, `GRANT EXECUTE ... TO service_role`. **새 DB 객체이므로 `db_new_table_checklist_2026-10-16.md` B-8, C-12~16 전부 적용**, TK님 Run이 필요하고 배포 순서는 "마이그 먼저 -> 코드 push -> deploy:prod". 배치 100개도 쿼리 1회.
- (b) `auth.admin.getUserById`를 id마다 호출: 배치 100개 = Auth API 100호출. 속도·한도 문제로 **배치에는 부적합**, 단건 GET에서만 쓸 수 있다.
- (c) v1에서 정지 판정을 빼고 `profiles` 행 유무(`null`)만: DB 변경 없음. 정지 계정이 `active`로 보이는 한계.
- 내 의견: 게임이 "탈퇴·정지 판정"을 요구했으므로 (a). 단 (a)는 DB 마이그레이션이라 일정이 늘고, 그 전까지는 (c)로 시작해 `status`는 항상 `active`/`null`만 쓰는 단계 배포도 가능(응답 형식은 같으므로 게임 쪽 변경 없음). **결정 필요.**
- **JWT 폐기 한계 재확인:** 정지·삭제는 이미 발급된 access token을 즉시 무효화하지 않는다(만료까지 유효, Supabase 일반 동작, 미시험). 그래서 게임 서버가 로컬 JWT 검증만 하면 정지 계정이 만료 시각까지 통과한다. **게임은 세션 시작 시와 주기적으로 이 API의 `status`를 확인해야 한다**고 게임 제니에게 명시.

### 4-A-4. API 키 이중 운영
- 환경 변수 2개: `GAMES_API_KEY_CURRENT`, `GAMES_API_KEY_PREVIOUS`. 요청의 Bearer 값을 **둘 다와 항상 비교**(둘 다 상수 시간, 앞에서 맞아도 뒤 비교를 건너뛰지 않음 -> 어느 쪽이 맞았는지가 응답 시간에 드러나지 않게)하고 하나라도 맞으면 통과.
- **빈 값 안전장치(필수):** 변수가 미설정이거나 빈 문자열, 또는 32자 미만이면 그 키는 **존재하지 않는 것으로 취급**하고 절대 일치하지 않게 한다(빈 Bearer가 빈 환경 변수와 "같다"고 통과하는 사고 방지). `CURRENT`가 유효하지 않으면 라우트 전체를 `503 unavailable`로 닫는다(열어 두지 않는다 = fail closed). `PREVIOUS`는 비어 있는 것이 정상.
- **교체 절차:** (1) 새 키 생성 -> `PREVIOUS` = 기존 `CURRENT`, `CURRENT` = 새 키 -> 배포. (2) 게임이 새 키로 전환 확인. (3) `PREVIOUS` 제거 -> 배포. 환경 변수 변경은 **새 배포를 만들어야 반영**되며, 이 프로젝트는 Vercel 대시보드 Save가 커밋 안 되는 결함 때문에 **CLI `rm`+`add`로 교체**한다(메모리 `reference_vercel_sensitive_env`). 즉시 폐기가 필요하면 `PREVIOUS`/`CURRENT`를 제거하고 재배포(배포 시간만큼 지연; 즉시 폐기 테이블은 보류됨).
- 키는 `vercel env`에 Sensitive로 넣고 출력·로그·문서에 값을 남기지 않는다. 어느 키로 인증됐는지는 로그에 `key=current|previous`로만 기록(§7) -> `previous` 사용이 0이 된 것을 보고 제거한다.

### 4-A-5. 닉네임 욕설 필터 (확인 결과 + 게임용 메모)
- **필터는 있다** [레포]: `lib/nickname-banned-words.ts`(`nicknameContainsBannedWord`). 규칙 3개 -- ① 일반 금지어 단어 경계 일치 ② 사칭 금지어 부분 일치(`oxxovo`/`옥소보` 상수 + 설정값) ③ 유사 문자 정규화(0->o, 1/l/I, 3->e, 5->s, @->a). 목록은 `platform_config` 키 `nickname_banned_words_general` / `nickname_banned_words_impersonation`.
- 적용 지점: 온보딩(`app/welcome/nickname/actions.ts:38`)·`/profile` 저장(`app/profile/actions.ts:346`) 저장 시 하드 차단, 그리고 첫 제출 직전 현재 닉네임 재검사(`checkNicknameBeforeSubmission`, `lib/nickname.ts:190`). 형식 검증은 글자·숫자·공백·`.`·`_`·`-`만, 길이 2~30(`validateNickname`).
- **한계 (게임이 알아야 할 것):** (1) 필터는 **저장 시점**에 걸린다. 금지어 목록이 나중에 늘어도 이미 저장된 닉네임은 **읽는 쪽에서 다시 걸러지지 않고**, 첫 제출 직전에만 재검사된다 -> 목록 갱신 전에 저장된 이름이 게임에 나갈 수 있다. (2) 일반 목록은 코드 머리말에는 "비어서 출고, 제니3 제공 시 설정값"이라 적혀 있으나 시드 파일(`reports/studio_nickname_banned_words_seed_2026-08-19.sql`)에 한글·영문 단어 목록이 있다. **라이브 `platform_config`에 이 값이 실제 들어 있는지는 확인하지 못했다 [미확인]** -- 읽기 SQL 1건: `select key, jsonb_array_length(value::jsonb) from public.platform_config where key like 'nickname_banned_words_%';`(TK님 Run, 결과는 본부). (3) 필터는 한국어·영어 목록 중심이다. 다른 언어 욕설은 못 잡는다. (4) 닉네임에 `<`, `>` 같은 마크업 문자는 형식 검증상 들어올 수 없지만(`\p{L}\p{N} ._-`만) **게임은 출력 시 이스케이프를 그대로 해야 한다**.
- **필요 시 메모(구현 요구 아님):** 게임이 자체 필터를 하나 더 둘지, 또는 우리 쪽에서 기존 닉네임 전수 재검사(읽기 전용 스캔)를 한 번 돌려 위반 후보를 뽑을지는 본부 판단. v1 API는 필터를 읽기 시점에 적용하지 않는다(적용하면 같은 이름이 사이트와 게임에서 다르게 보임).

### 4-A-6. `display_name`이 비었을 때 (사이트와 다른 점)
**[결정 2026-10-16 저녁, 본부] `null` 유지.** 게임이 자체 임시 이름을 쓴다. 사이트의 `CreatorXXXX` 대체값과 맞추지 않는다. 아래 (i)/(ii) 중 (i)로 확정.
사이트의 읽기 경로 `getDisplayNameReadOnly()`는 이름이 비면 계정 id에서 계산한 `CreatorXXXX`로 **표시용 대체값**을 만든다(저장 안 함) [레포 `lib/nickname.ts`]. 이 API는 §2대로 **`null`**을 준다. 두 규칙이 어긋나 같은 계정이 사이트에선 `Creator1A2B`, 게임에선 이름 없음으로 보일 수 있다. 온보딩에서 닉네임이 필수라 신규 계정에는 거의 없고 과거 계정에 한한다. **결정 필요:** (i) `null` 유지, 게임이 자체 대체 표기(내 제안: 합성값을 서버가 만들면 "선택한 이름"처럼 보이는 문제를 피함) / (ii) 사이트와 같은 `CreatorXXXX`로 맞춤.

### 4-A-7. `iss` / `aud` 확인 (본부가 게임에 준 값)
- `iss = https://qrnkovokjmimagrwjebs.supabase.co/auth/v1`, `aud = authenticated`: **틀리지 않다.** 레포 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL` 호스트가 `qrnkovokjmimagrwjebs.supabase.co`이고 JWKS 주소(`…/auth/v1/.well-known/jwks.json`, 10-16 오전 실측)와 같은 프로젝트이다. Supabase access token의 `iss`는 `<프로젝트 URL>/auth/v1`, `aud`는 `authenticated`가 표준이다.
- **단, 실제 발급 토큰의 `iss`·`aud` 문자열은 이 세션이 본 적 없다 [미확인]** -- 위는 프로젝트 URL과 표준 형식에서 도출한 값이다. 끝에 `/`가 없는 형태인 점(`…/auth/v1`)을 게임 쪽 검증 라이브러리가 그대로 비교해야 한다. 게임 첫 연동 때 토큰 `alg`·`kid`와 함께 `iss`·`aud`·`sub` 형식도 확인하도록 6번 결정에 덧붙일 것을 제안한다.

## 5. 속도 제한
- **[미확인/제약] 레포에 공용 속도 제한 모듈이 없다**(`lib/`·`app/api`에 있는 것은 업로드·음악·메일 도메인별 규칙). Vercel 서버리스는 인스턴스별 메모리라 **메모리 카운터는 사실상 무효**.
- 선택지 [제안, 결정 필요]: (1) **Vercel Firewall 속도 제한 규칙**(경로 `/api/games/*` 대상, 요금제별 사용 가능 여부 [미확인]), (2) 외부 KV(Upstash 등, 신규 서비스·비용·비밀값 추가 -> TK님 승인), (3) v1은 게임 한 곳만 쓰므로 키 단위 일일 쿼터를 앱에서 느슨하게(비권장: 서버리스라 부정확).
- 제안 한도(조정 가능한 초깃값, 실측 근거 없음): 인증 성공 후 키(또는 `sub`)당 **분당 120회**, 배치는 호출 1회로 계산·id 100개 상한(§4-A-1; 배치 1회가 DB 조회 1회이므로 id 수가 아니라 호출 수로 센다). **인증 실패는 IP당 분당 20회**, 초과 시 429 + `Retry-After`. 인증 실패 요청은 DB를 건드리지 않는다(서명 검증/키 비교만).
- 429 응답은 `Retry-After` 헤더. 게임 클라이언트 쪽 요구: 지수 백오프, 동일 id 중복 호출 금지(§6 캐시).
- JWKS 재조회 제한(§3-1)과 별도로, 앱 레벨에서 `profiles` 조회가 한도 없이 몰리지 않도록 배치 50 상한 유지.

## 6. 캐시 지침
- **우리 쪽(서버/CDN):** 모든 응답에 `Cache-Control: private, no-store`와 `Vary: Authorization`. 이 라우트는 `Authorization`을 읽으므로 동적이며 `force-static`/`use cache`를 쓰지 않는다(요청별 인증 결과가 섞이면 타인 데이터가 CDN에서 나갈 수 있다). Vercel CDN에 올라가지 않는 것이 목표.
- **게임 쪽(권장 문구):** `id`를 키로 **게임 서버 메모리/Redis에 TTL 5분 캐시**(이름은 거의 안 바뀜, 첫 제출 후 잠김), 404는 **30초 음성 캐시**, `locale`은 세션 시작 때 한 번 읽고 세션 동안 재사용. 사용자 이름 변경 직후 즉시 반영은 보장하지 않는다(최대 TTL 지연)고 명시. 캐시 항목에 JWT·API 키를 저장하지 않는다.
- 배치 조회로 N+1을 피하고, 로비 입장처럼 폭주 시점에는 미리 한 번에 묶어 조회.

## 7. 로깅·감사
- 로그에 남길 것: 요청 시각, 경로, 결과 코드, **키 id 또는 `sub`의 해시 앞 8자**, 응답 건수, 지연. **남기지 않을 것:** JWT·API 키·`display_name`·`real_name`.
- 이상 신호: 401/404 급증, 동일 키의 429 반복, `kid` 불일치 반복 -> 경보 후보(알림 채널은 별도 결정).
- 크론 로그와 같은 방식으로 `vercel logs`로 조회 가능 [레포 EOD 1-1].

## 8. 구현 시 만들 것 / 안 만들 것 (착수 승인 후)
- 만들 것(제안): `lib/games-profile.ts`(표시 이름 규칙 + 필드 조립, 순수 함수 + 단위 테스트), `lib/games-auth.ts`(JWT 검증, 키 검증), `app/api/games/v1/me/route.ts`, `app/api/games/v1/profiles/[id]/route.ts`, `…/profiles/batch/route.ts` [`profiles:batch`는 Windows 파일명 제약으로 불가, §4-A-1]. 경우 A용 `me/route.ts`는 만들지 않는다(경우 B 확정).
- 테스트(대조군 한 쌍): 유효 토큰 -> 200, 변조 토큰/만료/잘못된 `aud`/`alg:none`/anon 토큰 -> 각각 401, 타 사용자 `id`로 `/me` -> 항상 본인 것, 응답 키 집합이 정확히 3개, `display_identity='real_name'`이고 `real_name`이 채워진 계정에서도 응답에 실명이 절대 안 나옴(v1 결정). **가드는 일부러 망가뜨려 빨개지는지 확인.**
- 안 만들 것: 신규 DB 테이블(v1), CORS, 쓰기 엔드포인트, 이메일·국가·역할·멤버십 필드.
- 배포: 새 라우트는 `deploy:prod`로만. 공개 전 위 "[미확인]" 항목(토큰 서명 alg/kid, `profiles.locale` 존재, Auth JWT 만료 설정)을 읽기 확인.

## 9. 결정이 필요한 항목
상태 열: 결정됨(2026-10-16 본부) / 대기.

| # | 항목 | 상태 | 결정·내 의견 |
|---|---|---|---|
| 1 | 경우 A를 허용할지 B만 둘지 | **결정됨 (2026-10-16 저녁)** | **경우 B(서버 간) 확정**(게임 제니 답). 경우 A·`/me`는 구현 안 함. 구현 착수는 여전히 TK님 승인 후 |
| 2 | `real_name` 제3자 노출 | **결정됨** | v1은 닉네임(`display_name`)만. 실명은 동의 범위 확인 전까지 제외 |
| 3 | `country` 포함 여부 | **결정됨** | v1 제외 유지 |
| 4 | 속도 제한 수단(Firewall/KV) | 대기 | TK님. Firewall 가능하면 우선(요금제 가능 여부 미확인) |
| 5 | API 키 저장(env vs DB) | **결정됨** | v1 환경변수로 충분. 즉시 폐기용 테이블은 보류(재배포 필요라는 한계는 그대로) |
| 6 | 정지·탈퇴 판정 | **결정됨 (2026-10-16 저녁)** | **v1은 (c) `profiles` 행 유무만.** DB 함수 (a)는 정지 기능이 생길 때 다시 검토. v1 응답은 `active`/`null`만 나오고 `disabled`는 형식만 예약(§4-A-3). 게임 쪽 "세션 시작 시·주기적 status 확인" 지침은 문서에 유지 |
| 7 | `locale` 표기 | **결정됨** | 라이브 컬럼 있음(TK님 조회). "게임 UI 언어 힌트"로 표기 |
| 8 | 토큰 alg·kid 확인 | **결정됨** | 게임 첫 연동 때 게임 쪽이 확인. 제안: 같은 때 `iss`·`aud`·`sub` 형식도 확인(§4-A-7) |
| 9 | 배치 `POST /profiles/batch`, 최대 100, id별 응답, 없는 id는 `null` | **결정됨 (경로 확정, 2026-10-16 저녁)** | 경로 `POST /api/games/v1/profiles/batch` 확정(`:batch` 표기는 폐기). 잘못된 UUID는 전체 400, 빈 배열 400(제안 유지) |
| 10 | API 키 이중 운영 | **결정됨** | 환경변수 2개(`GAMES_API_KEY_CURRENT`/`_PREVIOUS`) 동시 허용(§4-A-4), 빈 값·32자 미만은 무효, `CURRENT` 무효 시 503 |
| 11 | `sub = auth.users.id = profiles.id` | 확인됨(레포), 라이브 본문 미대조 | `handle_new_user`·`ensureProfileRow` 모두 `id = auth.users.id`(§4-A-2). 트리거 본문은 재구성본, STEP 4로 대조 필요 |
| 12 | 닉네임 욕설 필터 | 있음, 한계 있음 | 저장 시점 필터만(읽기 시 미적용). 라이브 `platform_config` 목록 존재 여부 미확인(§4-A-5) |
| 13 | `display_name` 비었을 때 | **결정됨 (2026-10-16 저녁)** | API는 `null` 유지, 게임이 자체 임시 이름 사용. 사이트의 `CreatorXXXX` 대체값과 맞추지 않음(§4-A-6) |
| 14 | `iss`/`aud` 값 | 확인(도출), 실토큰 미확인 | `https://qrnkovokjmimagrwjebs.supabase.co/auth/v1` / `authenticated` 틀리지 않음(§4-A-7) |

## 10. 이 문서가 확인하지 못한 것
- 라이브 토큰의 실제 서명 방식, JWKS 키와의 일치, 만료 시간(서명 방식은 게임 첫 연동 때 게임 쪽 확인으로 결정).
- `profiles.locale`의 값 분포(컬럼 존재는 확인됨). `display_identity` 값 분포(v1에서는 안 읽음).
- 게임 서버의 실제 구조(누가 토큰을 쥐는지, 클라이언트 PC 경유 여부). 이 문서는 두 경우를 모두 가정해 썼다.
- Vercel 요금제의 방화벽 속도 제한 사용 가능 여부, 환경 변수 폐기의 운영 절차.
- (2026-10-16 저녁 추가) `profiles.id`의 `auth.users` FK/cascade 여부, 라이브 `handle_new_user` 본문, 라이브 `platform_config`의 닉네임 금지어 목록, 실제 토큰의 `iss`·`aud`·`sub`. `auth.users.banned_until`/`deleted_at` 의미는 타입과 Supabase 일반 동작 기준이며 이 프로젝트에서 시험하지 않았다. `next.config` rewrites로 `:` 경로를 받는 방법은 시험하지 않았다.
- `getClaims` 의 실동작(세션 갱신 부작용 포함)은 타입 주석만 읽었고 실행해 보지 않았다.
