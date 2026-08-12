# 비동기 제출 설계안 (72h 제작·제출 + 24h 처리 버퍼) — 2026-07-30, 지수2

**승인 대기 문서.** 승인 전 코드 착수하지 않습니다.

## 0. 문제 (실측)

`submitRender`(`lib/studio.ts:1650`)가 **`render.status !== 'ready'`면 거부**합니다. 즉 제출이 렌더
완료에 묶여 있습니다. 마감 직전에 500명이 최종 렌더를 요청하면 큐가 밀리고, **마감 전에 렌더를
요청했는데 마감 후에 ready가 되는 참가자는 제출 자체를 못 합니다.** 이게 72h 몰림의 근본 원인입니다.

현재 체인 (실측):

```
createRender   -> render_jobs(status=queued) + v1sr
                  cryptobind_edl_hash / _source_bundle / _render_signature
                  = sign(pid, tid, renderId, edlHash, sourceBundle)      <- 렌더 전에 이미 존재
워커            -> rendering -> uploading -> v1sc(buildComposeContentBind:
                  finalHash + sign(renderId, tid, finalHash)) -> ready   <- 렌더 후에만 존재
submitRender   -> status='ready' 요구 -> 시즌게이트/길이 -> 소스 전수 재검증 -> 음악 v1m 접기
                  -> verifyComposeBind(v1sr 재계산 + v1sc 검증) -> 라운드 판정 -> application
                  행 insert/CAS(+모더레이션) -> render_jobs ready->submitted(CAS) -> 잔여 클립 아카이브
```

## 1. 서명 체인 — ★쪼개지 않습니다. 검증 시점만 나눕니다

핵심: **v1sr은 렌더 전에 이미 완성돼 있고, v1sc만 렌더 후에 생깁니다.** 그래서

| 단계 | 검증 | 새 서명 |
|---|---|---|
| **intent** (마감 전) | v1sr 전체 + 소스 v1/v1c/v1v/v1m 전수 | **없음** |
| **finalize** (마감 후 24h 내) | v1sc + v1sr 재확인 | **없음** |

- canonical 문자열, KAT 골든, 양 레포 byte-mirror **전부 불변** → **워커 코드 변경 0**.
- 코드 변경은 `verifyComposeBind(row, tid, sigs, { requireFinal = true })` 옵션 추가 한 곳뿐.
  기본값이 기존 동작이라 **기존 호출부 무손상**. intent만 `requireFinal: false`로 호출.
- ★설계 불변식: **KAT 골든이 바뀌면 설계 위반 신호**입니다. 서명 코드에 손대지 않는 것이 목표.

## 2. intent 후 렌더 실패 — 실격 아님, 환불 없음, 재렌더

`project_system_error_not_user_rejection` 원칙 적용.

- **환불 분기 없음** — 실측: `createRender`는 크레딧을 차감하지 않습니다(과금은 생성 경로
  `studio.ts:561/742/948`뿐). 렌더 실패에 돈이 걸려 있지 않습니다.
- 워커 transient 재시도+백오프는 이미 존재(워커 `5cf2f55`). 그래도 실패 → `status='failed'`.
- finalize 스윕이 `submit_intent_at IS NOT NULL AND status='failed'`를 발견 →
  **application 행 유지**(status 그대로), `studio_submission_state='render_failed'` + 어드민 알림.
- 복구 = ★**같은 EDL 재렌더 1회**(re-queue). 마감이 지났으므로 EDL 수정은 금지 —
  같은 EDL이면 **v1sr이 그대로**라 서명도 그대로입니다. 새 행이 아니라 같은 render_job의
  재큐잉이므로 **캡에도 영향 없음**.
- 자동 실격은 어떤 경로에도 넣지 않습니다.

## 3. 24h 버퍼 동안 참가자 화면

- 제출 완료가 아니라 **"제출 접수됨 · 처리 중"**. 표시: 접수 시각(=intent_at) + 렌더 상태
  (대기/처리 중) + ★**"접수는 마감 전에 완료되었습니다"** 명시. 참가자 불안의 핵심이 이것입니다.
- 남은 시간 추정치는 표시하지 않습니다(큐 상황에 따라 다르므로 거짓이 됩니다). "순서대로 처리 중".
- 실패 시: "처리 중 문제가 발생해 운영진이 확인 중입니다. **참가 자격에는 영향이 없습니다.**"
- 재제출 버튼 없음(단일 제출). EDL 수정 불가.
- /watch 노출은 watch_hold 정책 그대로 — 홀드 ON이면 일괄공개까지 비공개.

## 4. 단일 제출 CAS = ★intent에 둡니다

마감 전에 "제출했다"가 확정돼야 하고, finalize는 시스템 작업이라 경쟁이 없습니다.

| 라운드 | CAS |
|---|---|
| application (행 없음) | 기존 insert 경로 그대로 |
| application (행 있음) | ★현재 `if (appRow.studio_application_submitted_at) return already_submitted`는
  **read-then-write라 경쟁 창이 있습니다.** UPDATE에 `.is('studio_application_intent_at', null)`을
  붙여 **DB 레벨 CAS로 승격**(개선점) |
| main | 기존 `selected -> main_round_submitted` CAS를 **intent 시점에** 수행 |
| render_jobs | `.is('submit_intent_at', null)` 조건부 UPDATE → 한 렌더는 한 번만 intent |

## 5. 기존 행 호환 (ready 45 / submitted 15)

- **submitted 15**: 완결. 스윕 조건이 `submit_intent_at IS NOT NULL AND finalized_at IS NULL`이라
  **대상이 아닙니다.**
- **ready 45**: 미제출. ★**동기 경로를 남깁니다** — `submitRender`는 사라지지 않고
  "intent + 즉시 finalize" 래퍼가 됩니다. 렌더가 이미 ready면 UX가 기존과 동일합니다.
- 마이그레이션은 **additive only**, 전부 nullable 기본 null → 기존 행 해석 불변:
  `render_jobs.submit_intent_at` / `render_jobs.finalized_at` /
  `genesis_applications.studio_application_intent_at` / `genesis_applications.studio_submission_state`.
- ★**SQL 작성 주체 확인 필요**: DB 스키마가 지수 본체 소관이면 마이그는 본체가 씁니다(본부 대기 항목).

## 6. 회귀 검증 계획 (서명 체인이 걸려 있으므로 최우선)

1. **KAT 불변**: 앱 77 + 워커 22 그대로 녹색. 골든이 바뀌면 설계 위반.
2. `requireFinal` 단위 테스트: final 없는 행 × false → ok / × true → `final_missing`.
3. **변조 거부 3종 재실행**(EDL 변조 / 소스 스왑 / 음악 베드 스왑) — **intent와 finalize 양쪽**에서.
4. ★신규: intent 후 DB에서 **EDL 바꿔치기** → finalize의 v1sr 재계산이 거부해야 함.
5. ★신규: intent 후 **video_url을 다른 렌더로 바꿔치기** → v1sc 불일치로 거부.
6. **시간압축 E2E**(rehearsal 툴킷 + season_test): 마감 1분 전 intent 10건 → 마감 →
   워커 렌더 → 스윕 finalize → Watch/채점 반입까지.
7. **실패 경로 E2E**: 워커 강제 실패 → `render_failed` 표시 + 자격 유지 + 재렌더 1회 복구.
8. **동기 경로 회귀**: ready 렌더 1건으로 기존 UX 그대로 제출.

## 7. 공수 (합 8 d, 기존 추산 유지)

마이그 0.5 / `requireFinal`+intent 2 / finalize 스윕+cron 1.5 / 실패·재렌더 1 / UI 상태 1 /
E2E+회귀 2.

## 8. 선행 의존

- ★**season_0 일정 확정**: intent 마감 판정이 `application_close_at`(`isApplicationClosed`)에
  의존합니다. 일정 컬럼 스테일 건은 지수 본체 소관이며, 실전 검증은 확정 후에야 의미가 있습니다.
- 워커 배포 정상화(main 브랜치 + 동시성) — finalize 스윕이 렌더 완료를 전제로 합니다.
