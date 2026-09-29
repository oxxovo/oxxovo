# 지수 본체 2026-09-05 EOD — 모의예선 43편 + 채점 재설계 착수 (판정 대기)

**⛔고치지 마라·커밋하지 마라·배포하지 마라 — 오늘 전부 실험/분석/설계. 프로덕션 코드 변경 0건,
커밋 0건(양 레포 `git status` 확인 완료, 전부 untracked/미변경).**
**재설계 방향은 대표님 판정 대기 — 다음 창은 새 지시 있을 때까지 진행하지 않는다.**

---

## ① 오늘 발견한 것 (중요도순)

1. **⛔`Promise.all`이라 하나 실패하면 전체 실패.** `oxxovo-scoring/src/scorer.ts:780`
   `scoreWithAllAIs`가 Claude/GPT/Gemini를 `Promise.all`로 묶어서, 벤더 하나만 실패해도
   행 전체가 `judged_status='failed'`가 되고 **이미 성공한 나머지 2사 결과까지 버려진
   채 재시도 때 3사를 전부 다시 부른다.** 오늘 cf_novya가 정확히 이 경로를 탔다.
2. **⛔결과 발표 게이트가 날짜만 본다.** `app/api/cron/season-tick/route.ts:438`은
   `scoring_complete_at` 날짜 비교 한 줄뿐, `scoring_results`/`judged_status`를 코드가
   아예 안 읽는다. 08-31 EOD에 이미 실측·재현됨(TEST-01 채점 중인데 나머지 15편으로 결과
   확정·발송). **오늘 재설계로 다시 확인 — 여전히 안 고쳐져 있다.**
3. **2편(4.65%)이 2사로만 채점됐고, 그중 하나가 43편 중 원점수 평균 #2위를 찍었다.**
   cf_novya=Gemini `PROHIBITED_CONTENT` 영구 거부(temp0에서 2회 동일), The Potter's
   Hands(demo_artisan)=Gemini 503 일시 오류. 500편 스케일로 환산하면 **약 23편**이 같은
   문제를 겪는다(편 단위·슬롯 단위 계산 일치).
4. **Z03_studio(일부러 인물을 바꾼 픽스처)를 Claude·Gemini 둘 다 "다른 사람"이라고
   정확히 관찰했는데, 셋 다 결함으로 채점하지 않았다** — "의도된 연출"로 해석하고 넘어감.
   rubric에 "설명 없는 인물 교체=결함"이라는 전제 자체가 없다.
5. **GPT의 근거문 반복률 23.9%** (Claude 1.3%, Gemini 2.9%) — "clean visuals"(18회) 같은
   정형 문구가 무관한 영상들에 반복 등장. A19_sunrise(claude#40 vs gpt#3, spread 37)
   대조에서 Claude는 두 산이 다른 장소임을 직접 잡아냈고 GPT는 그걸 놓친 채 정형 문구로
   메웠다 — 근거 텍스트 자체의 품질 차이가 실제 사례로 확인됨.

(참고 지표, 우선순위엔 안 넣음: verified 분포 61.83~79.53으로 매우 좁음, 3사 Top8 공통
1/8뿐, 7~12위 순위 spread 최대 31, "2-of-3"가 26/43(60%)로 압도적 다수 — "완전 합의"도
"완전 불일치"도 드물고 "둘은 같고 하나만 다르다"가 사실상 기본값.)

---

## ② 오늘 한 일 (시간순)

1. **모의예선 43편 채점.** A(22, promo_videos EN 전량)+Z01~03(3, QA 픽스처)+cf/v3(9)+
   watch_demo(7, 생존확인)+TK Studio 렌더(2, render_jobs 서로 다른 계열 각 1편) — 세트
   구성은 전부 이번 세션 실측(코드/DB grep, R2 HEAD 200 확인), 추측 0건. Rubric v2
   (`_new_rubric_prompt_2026-09-02.ts`, 고문 09-02 반영판) Quality축만(Compliance/Integrity
   제외), temp 0, EN only. 실지출 **$6.59**(추정 $8 이내). DB 쓰기 0건, season_test는
   배점 컬럼만 읽음(변경 없음).
   - 자기소개 빈 편 처리(본부가 먼저 답하라 지시): 43편 중 37편이 애초에 참가자 자기소개가
     없음(홍보영상/TK 렌더/QA 고정문) → 빈 값·무의미 고정문을 "없음—가점/감점 금지" 중립
     문구로 전부 치환.
   - 실행 중 `run_in_background` 타임아웃으로 1회 중단됨 — 배치 재개 기능을 harness에
     추가해(`MOCK_PRELIM_MERGE`/`MOCK_PRELIM_ONLY` env) 총 6회 배치로 완주.
2. **추가 채점 없이 재계산만 — 비용 $0, 3회 반복 질의:**
   - 합의도(Top8/Top12 지지 사수)·순위 spread·결합방식 4개(원점수평균/median/2-of-3/
     Borda) 나란히 비교, Consensus 등급(High/2-of-3/Low, 쌍별 순위차≤5) 부여.
   - "2-of-3" 26편에서 어긋난 회사 집계: Gemini 10·GPT 8·Claude 8(고르게 분산, 압도적
     아님) + 방향(높게/낮게)·그룹별(A/CF/WD/TK/Z) 분포까지.
   - A19_sunrise(claude#40/gpt#3)·Z03_studio(subjectConsistency) 근거문 3사 대조.
3. **채점 재설계 ① 착수(설계만).** 3 Valid Judgments 상태 기계(JUDGING_PENDING/
   COMPLETE/RECHECK/FINAL) 설계, 지금 `judged_status`와의 맞물림, 벤더별 재시도
   횟수·backoff 근거(Claude 2회/GPT 3회·90~180s/Gemini 일시적 2회·영구적 0회 — 전부
   오늘 실측 근거). 본부 지적으로 구멍 2개(RECHECK 출구 없음, Reserve 미정 시 임시규칙
   없음) 보완 + RPC 게이트 재확인.

---

## ③ 산출물 경로

**설계 문서 (오늘 새로 작성, `oxxovo/reports/`):**
- `mock_prelim_2026-09-05_analysis.md` — 43편 1차 분석(①~⑦ 6가지 관찰 + 결과표 전체)
- `mock_prelim_2026-09-05_consensus_analysis.md` — 합의도·spread·결합방식 4개·등급 분석
- `scoring_redesign_1_state_machine_2026-09-05.md` — ① 상태기계 설계 초안
- `scoring_redesign_1b_holes_and_rpc_2026-09-05.md` — ① 구멍 2개 보완 + RPC 게이트 실측

**원자료/하니스 (`oxxovo-scoring/`, 전부 미커밋):**
- `_probe_mock_prelim_2026-09-05.ts` — 43편 채점 하니스(재개 기능 포함)
- `_analyze_mock_prelim_2026-09-05.cjs` / `_analyze_mock_prelim_consensus_2026-09-05.cjs` — 분석 스크립트(재실행 시 비용 $0)
- `reports/mock_prelim_2026-09-05_2026-09-05_1834.json` — 43편 원본 채점 결과(3사 raw 포함)
- `reports/mock_prelim_consensus_2026-09-05.json` — 합의도/spread/결합방식 원자료
- `reports/mock_prelim_run_log_2026-09-05.txt` — 실행 로그

---

## ④ 다음 창 진입 시

**대표님 판정 대기 — 아래는 판정 후에만 착수:**
1. 재설계 방향 확정(오늘 ①~⑤ 발견을 반영해 대표님이 우선순위 정할 것).
2. ①이 승인되면 남은 확인 필요 사항 3가지(문서 안에 명시): RECHECK 등급 임계값(원점수
   편차, 43편 표본으론 캘리브레이션 불가) · 사람 개입 시 score override와
   `[[project_scoring_integrity_rules]]`(score 자동, admin 변경 불가) 충돌 여부 · 실제
   season-tick 게이트 코드 수정 범위(`route.ts:438`).
3. ②(Reserve Judge 후보 조사)는 지시 대기 중 착수 안 함 — 조사만이라 코드 변경은 없지만,
   "아무것도 진행하지 마라" 지시에 따라 대기.
4. ③(Challenger Test 10~20편 설계)·④(Consensus 검증 레이어 컬럼 설계)도 동일하게 대기.

관련: [[project_jisoo_resume_2026-09-01]] · [[project_scoring_v22]] · [[project_scoring_weight_dual_truth]]
