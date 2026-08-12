# Stage 3 "AI 배우" 전체 사이클 데모 패키지 (2026-07-18, 지수2)

2.5 UI ①②③ 완성 → **실브라우저 전체 데모**. 배우 얼굴 만들기 → 이름 붙여 등록 →
라이브러리 → 그 배우로 멀티샷 영상 → compose 흐름까지 TK님이 손으로.

**prod 안전 보장**: 하나뿐인 Supabase를 공유하지만, Studio 노출은 `STUDIO_DEV_UNLOCK`
(Vercel **Preview** + 로컬 전용, prod 절대 미설정)이 DB `session6_enabled`(prod=false)보다
먼저 읽힙니다(lib/session6.ts). → **Preview에서만 Studio가 열리고, www.oxxovo.ai는 계속 404
게이트.** 모델 `active=true`로 켜도 prod Studio가 애초에 꺼져 있어 노출 0.

---

## 0. 코드 상태 (완료·푸시)
- 메인 `feat/studio-budget-guard`: **7a9e41b**(①) + **aaa54bd**(②③). tsc0+build0.
- 워커 `oxxovo-studio` `feat/studio-loadtest`: **5d2a22e**(Path B edit 분기). tsc0.

## 1. 데모 전제 체크리스트 (TK님 확인/실행)

| # | 항목 | 상태/조치 |
|---|---|---|
| 1 | Vercel **Preview**에 `STUDIO_DEV_UNLOCK=true` | 기존 데모 때 설정됨(studio_demo_runbook.md). Preview 배포에 적용되는지 1회 확인 |
| 2 | 3모델 `active=true` 플립 | **아래 §2 SQL Run**(prod 안전). 데모 후 §4로 되돌림 |
| 3 | 워커 가동 | Railway `oxxovo-studio`를 `feat/studio-loadtest @5d2a22e`로 **배포+폴링 가동**(도먼트면 깨우기). env: FAL_KEY / R2_* / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / STUDIO_CRYPTOBIND_SECRET |
| 4 | CryptoBind 시크릿 일치 | `STUDIO_CRYPTOBIND_SECRET`이 Vercel(메인)=Railway(워커) 동일값. 생성은 없어도 되나 제출(2.6) 검증에 필요 |
| 5 | 데모 계정·크레딧 | `studio-demo@oxxovo.ai`(+크레딧) 시드 — studio_demo_runbook.md §Setup. Kling i2v 1회 ~32크레딧 |

**fal 실비용(데모 실지출)**: 이미지 몇 장(Nano $0.15 / FLUX $0.045) + i2v 1~2회(Kling 15s ~$2.5) → **약 $3~6**. 데모 계정 크레딧으로 돌지만 fal 실비는 OXXOVO 부담.

## 2. 모델 활성화 SQL (프로젝트 qrnkovokjmimagrwjebs) — 데모 시작 시 Run
```sql
-- Stage 3 actor demo: turn the 3 models ON (Preview-only exposure; prod studio
-- is gated off by session6, so this does NOT expose them on www.oxxovo.ai).
UPDATE model_catalog SET active = true, updated_at = now()
WHERE id IN ('nano-banana-pro','flux2-pro-image','kling-v3-pro-i2v');

-- verify (expect 3 rows, active=true)
SELECT id, active, metadata->>'media_type' AS media_type, cost_per_second_usd
FROM model_catalog
WHERE id IN ('nano-banana-pro','flux2-pro-image','kling-v3-pro-i2v')
ORDER BY sort_order;
```

## 3. Preview 주소 + 데모 클릭 경로
**Preview URL**: `https://oxxovo-git-feat-studio-budget-guard-oxxovos-projects.vercel.app/studio`
(브랜치 자동 별칭. 정확한 주소는 Vercel 대시보드/PR에서 확인 — SSO 보호됨)

1. `/studio` 열고 **로그인**(데모 계정). 이미지 모델이 active면 상단에 **[클립 생성][AI 배우] 스위처** 등장.
2. **[AI 배우] → ① 배우 만들기**: 모델(Nano=프리미엄 / FLUX=가성비) 선택 → 배우 설명 프롬프트 → **생성**. ready까지 대기. 
   - 첫 얼굴 ready 후 그 카드의 **"이 배우로 더 만들기"** 눌러 2~3컷 더(★경로 B=참조 기반 일관성). 기준 배우 칩 확인.
3. **② 내 배우**: ready 얼굴 중 **정면 1장 클릭** + (선택) 참조 컷 체크 + **이름**(예: KIRA) → **이 배우 등록**. 아래 "내 배우"에 카드 등장(정면+이름+참조N장+삭제).
4. **③ 샷 촬영**: **배우 선택**(KIRA) + **i2v 모델**(Kling) → 샷 스토리보드 2~3개(각 프롬프트+길이, 합 ≤15초) → **영상 생성**. "클립 생성 탭/조합에서 확인" 안내 뜸.
5. **[클립 생성] 탭**: 방금 i2v 클립이 생성 중→준비됨으로. (2.4 배선대로 공유 목록에 자동 등장)
6. **조합 편집기 열기**: 픽커에 i2v 클립 등장 → 이어붙이기. (제출은 2.6 E2E)

## 4. 데모 종료 후 — 되돌리기 (active OFF 유지)
```sql
UPDATE model_catalog SET active = false, updated_at = now()
WHERE id IN ('nano-banana-pro','flux2-pro-image','kling-v3-pro-i2v');
```
(정식 점등은 2.6 E2E 통과 + 발사 게이트에서. 그 전까지 무노출 유지.)

## 5. 데모서 볼 포인트 (설계 검증)
- ★경로 B: "이 배우로 더 만들기"가 같은 얼굴 유지하나(edit 엔드포인트 실동작).
- 등록→라이브러리→③ 선택이 매끄러운가. i2v 한 번에 멀티샷 인물 일관(Kling multi_prompt).
- i2v 클립이 **기존 클립 목록·compose에 자동 등장**(무수정 배선 증명). Watch/ComposeEditor 불변.
- 보라 톤·기존 Studio와 일관.
