# PR #9 (feat/studio-compose) — 머지 레디니스 체크리스트

작성: 지수2 (2026-06-13). 머지 담당자(메인 제니/지수)용 단일 문서.
브랜치: `feat/studio-compose` (oxxovo + oxxovo-studio 양 레포). PR #9.
머지 트레인 진입 전 셀프 리뷰 완료 — **블로커 0** (§F).

---

## A. 마이그레이션 실행 상태 (라이브 DB 실측 2026-06-13)

| # | 마이그 | 내용 | 라이브 |
|---|---|---|---|
| 1 | **studio_compose_phase1** | `render_jobs` 테이블 + `seasons` compose 파라미터(studio_compose_enabled/max_seconds/studio_round) + `genesis_applications` render 컬럼(studio_application_render_id/studio_main_render_id) | ✅ 반영 확인 |
| 2 | **genesis_status_constraint_fix** | `genesis_applications_status_check` 9값(main_round_submitted/flagged 포함). 옛 stale `genesis_apps_status_check` DROP | ✅ 반영(프로브 9값 + 본선 CAS E2E 22/22 통과) |
| 3 | **model_catalog_tiers** | active 6모델 + duration_format(ltx2/sora2=int, kling/seedance=string, veo 2종=string_s) + 옛 2모델 비활성 | ✅ active 6 확인 |
| 4 | **studio_content_bind** | `generation_jobs` cryptobind_content_*(v1c) + `render_jobs` cryptobind_render/edl/source/final_*(v1sr/v1sc) | ✅ 컬럼 전부 present |

**→ compose 관련 마이그 4건 전부 라이브 반영 완료. 머지 시 추가 실행 불필요.**
전제: 이전 studio 파이프라인 마이그(studio_phase1/phase4 = generation_jobs/model_catalog/credit_transactions)는 이전 세션에 이미 라이브(이번 E2E·스모크에서 사용 확인).

---

## B. 필수 시크릿

| 키 | 위치 | 요건 | 상태 |
|---|---|---|---|
| **STUDIO_CRYPTOBIND_SECRET** | Vercel(메인) ↔ Railway(워커) | **byte 단위 동일**해야 함. 불일치 시 모든 제출 검증(v1c/v1sc) 실패 | ⚠️ **수동 확인** |

- 워커(Railway)는 이번 세션 프로드 스모크에서 v1c(생성)·v1sc(완성본) 서명을 정상 스탬프함 → Railway 쪽 시크릿 정상.
- **최종 게이트**: Vercel에 동일 시크릿이 설정돼 있어, Railway가 만든 완성본을 메인앱 submitRender가 verifyComposeBind로 통과시키는지 **런칭 전 1회 크로스 검증 권장**(실제 /studio/compose 제출 1건).
- ⛔ 시크릿 값은 화면/문서 출력 금지. Vercel·Railway 콘솔에서 직접 대조.

---

## C. 마스터 스위치 (platform_config, 라이브 실측)

| 키 | 현재 | 머지 시 |
|---|---|---|
| `session6_enabled` | **false** | OFF 유지 (studio /studio UI 게이트 — 런칭 시 ON) |
| `member_hosted_enabled` | **false** | OFF 유지 |
| `studio_purchase_enabled` | **false** | OFF 유지 (Stripe 결제 — 7월 큐) |
| `studio_daily_generation_cap` | 20 | 그대로(보수적). 런칭 시 상향 |
| `studio_margin_rate` | 0.40 | 그대로 |
| `studio_credit_usd_value` | 0.10 | 그대로 |

**→ 머지해도 전부 OFF라 사용자 노출 0.** compose 코드는 머지되되 기능은 스위치로 잠긴 상태. 안전.
(compose 자체 게이트는 추가로 `seasons.studio_compose_enabled` 시즌별 플래그도 통과해야 동작.)

---

## D. Railway 워커 상태

| 항목 | 요건 | 상태 |
|---|---|---|
| 배포 커밋 | 최신(현 `bc9028e` 시점, 워커는 `ce872aa`) | ✅ b8f8822 계열 ACTIVE 확인(TK) |
| 소스 브랜치 | 머지 전: `feat/studio-compose` | ✅ |
| `STUDIO_DEV_MODE` | 프로드 = **false** | ⚠️ 수동 확인(가이드 참조) |
| ffmpeg | 이미지에 포함(Dockerfile) | ✅ 스모크 렌더 정상 |

가이드: `reports/railway_deploy_guide_oxxovo_studio.md`.

---

## E. 머지 후 액션

1. **Railway 소스 브랜치 `feat/studio-compose` → `main` 전환** (Service → Settings → Source → Branch). 이후 main push마다 워커 자동 재배포.
2. 워커 레포(oxxovo-studio)도 `feat/studio-compose` → main 머지 후 동일 전환.
3. ⚠️ main push = Vercel 프로덕션 자동배포([[feedback-main-push-auto-deploy]]). 트레인 순서/auto-deploy 정책은 머지 드라이버가 통제.
4. (런칭 시점) §C 스위치 ON + §B 크로스 검증 + daily_cap 상향.

---

## F. 셀프 리뷰 결과 (2026-06-13, 독립 2-리뷰어 + 직접 정독)

**블로커 0.** crypto 체인(v1/v1c→v1sr→v1sc)·ownership·본선 단일제출 CAS·시크릿 누출·서버액션 인증·데모 게이트 전부 CLEAN.

**수정 완료(커밋 `bc9028e`):**
- no-hardcode 위반: 초과경고문 "30초" 고정 → 동적 `maxSeconds` 함수화(ko/en).
- 미리보기 상태 누출: `playSeq` 누락클립 early-return에 `setPlaying(false)` 추가.

**머지 담당자에게 넘기는 노트(비차단):**
- **N1 (i18n, → 지수 큐)**: createRender/submit 에러가 원시 토큰(`source_cryptobind_failed` 등)으로 노출. /rules 이중언어화와 함께 reason→문구 매핑 정리 권장. 해피패스/레이아웃엔 영향 없음.
- **N2 (기존 패턴, 비회귀)**: 신청라운드 제출의 `studio_application_submitted_at` 가드가 read-then-write(TOCTOU). 동일 유저의 서로 다른 render 동시제출 시 두 번째가 덮어쓸 수 있음. submitGeneration에도 동일 존재 → compose 회귀 아님. 후속으로 `.is('studio_application_submitted_at', null)` CAS 권장.
- **N3 (기존 패턴)**: app-row insert 시 23505(unique 위반)를 generic `failed`로 반환(→ `already_submitted`로 구분하면 UX↑). DB unique 인덱스가 중복행은 차단하므로 데이터 안전.
- **N4 (코스메틱)**: `ready` 상태인데 `video_url` null인 render는 `not_ready`로 표면화(워커 불변식 위반 케이스, 무해).

---

## G. 머지 메커니즘 메모

- 코드 범위(merge-base 대비, reports 제외): 10파일 +1994/−40. 핵심=lib/studio.ts, lib/cryptobind.ts, app/studio/{actions,compose/*}, app/compose-demo, app/rules(§⑥ 기준선 11줄).
- tsc 0 / 이전 세션 build 0. 워커 tsc 0.
- **vercel.json cron 충돌 주의**([[feedback-vercel-cron-limits]]): 트레인에 season(#2)+partner(#3) cron 공존 → plan limit 내 수동 유지. compose는 cron 추가 없음.
- 부수 산출물(머지 대상 아님): `scripts/e2e-submit-render.mjs`·`scripts/probe-status-constraint.mjs`(검증 도구), `reports/*`(문서). 워커 레포 `_fal_test/`는 untracked 테스트물.
- /rules 짜깁기 조항 후속 인계: `reports/rules_compose_clauses_handoff_2026-06.md`(지수 큐, 인계 가능).
