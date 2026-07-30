# 지수 본체 인계 — 2026-07-28 (본부 앞)

트랙: 채점 · 인증 · 시즌단계 · DB 스키마
작업 순서/착수 결정권은 **본부**. 이 문서는 본부가 내일 바로 지시할 수 있게
현재 상태만 정리한 것.

---

## 1. 오늘 한 것

### 커밋 (브랜치 `fix/signup-profile-row`, origin push 완료, **미배포**)

| 해시 | 내용 |
|---|---|
| `e99cb67` | `fix(auth)` 가입 시 profiles 행 생성 이중화 + 레포 밖 DB 객체 기록 |
| `b88b9e0` | `docs(auth)` 지수2 인계 메모 (Studio 브랜치 후속) |

신규: `lib/profile-row.ts` · `reports/auth_handle_new_user_2026-07-28.sql` ·
`reports/profiles_backfill_missing_rows_2026-07-28.sql` ·
`reports/db_schema_outside_repo_2026-07-28.md` ·
`reports/handoff_profile_row_jenny2_2026-07-28.md`
수정: `lib/nickname.ts` · `lib/watch.ts` · `app/profile/actions.ts` ·
`app/watch/actions.ts`

### DB (TK가 실행, 프로덕션)

- 트립팁팁 마이그 `0010`이 덮어쓴 `handle_new_user` + `on_auth_user_created`
  드롭 → 가입 차단 해소
- `handle_new_user` / `on_auth_user_created` 복구 (재구성본)
- `profiles` 백필 1행 (`hellovegastour`) → 총 7행.
  `founding_creator_number=1`은 `tkckusa`에만 유지 = 백필이 Founding 슬롯을
  먹지 않음

### 검증

- 복구 E2E **22/22** — 서브밀리초 동조 314us (원본 5행 대역 320~470us 안)
- 재검증 E2E **31/31** — esbuild로 실소스 번들해 실코드 직접 호출.
  트리거 부재 재현 → 본인경로 자가치유 / read경로 무쓰기 / 조용한 실패 제거
- `tsc` 0, `eslint` 0

### 원본 대조 — **완결**

7/27 백업을 새 프로젝트로 복원해 원본 전문 확보. 원본은
`INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);` **그것뿐**.
다른 테이블 무관 → **결손 백필 불필요**. 트리거도 `auth.users` 하나뿐.
차이 2건(`SET search_path` 없음 / `ON CONFLICT` 없음)은 **재구성본이 더
안전**하므로 원복하지 않음. 복원 프로젝트 삭제 완료.

**→ 가입 사고 전체 종결.**

---

## 2. 큐 (현재 상태)

dev-day는 **코딩 시간이 아니라 착수~검증완료**까지. 신뢰도를 함께 표기.

| # | 항목 | dev-day | 신뢰도 | 상태 |
|---|---|---|---|---|
| 1 | **Defect1** Integrity 재정의 | **2~3** | 중 | 실측 완료, 설계 미착수 |
| 2 | **얼굴 일관성** (Defect2, 0/12) | **3~5** | ★낮음 | 미스코핑 |
| 3 | **어워드 버튼 3겹 게이트** | **1~1.5** | 중 | 미착수 (발사 블로커) |
| 4 | **getSeasonPhase 통합** | **1.5~2** | 중 | 미착수 |
| 5 | **레포 밖 DB 객체 9개 + PITR** | **0.5~1** | 높음 | TK Q1~Q5 실행 대기 |
| 6 | **스테일 날짜 정리** (신규·시한) | **0.5** | 높음 | 본부 목표값 대기 |
| 7 | **채점 API 비용 실측** (신규) | **0.5** | 중 | 아래 정정 참조 |

### 항목별 근거

**1. Defect1 (2~3d)** — 코딩 자체는 0.5d 미만(프롬프트 문구 + 배점).
나머지가 시간을 먹음: 배점 변경 → `/rules` 공개 카피 + `reports/official_rules`
2파일 개정 → 본부·제니3 승인 루프, 그리고 `season_test` 51행 재채점으로
Seedance/Kling 역전 해소를 실측하는 검증. ★재채점에 **Anthropic API 비용
발생** — 오늘 크레딧이 말랐으므로 **검증 단계가 막혀 있음**(설계·구현은 가능).

**2. 얼굴 일관성 (3~5d, ★신뢰도 낮음)** — 제가 아직 재현/측정하지 않았고,
7/14 진단상 "평균으로 희석"이라 채점 파이프라인 구조 변경일 가능성이 있음.
게다가 해결책이 모델 쪽(Kling `multi_prompt` / Seedance ref2vid)으로 가면
**Studio 트랙(지수2)과 경계가 겹침**. ★**스코핑 0.5d를 먼저 쓰고 추산을 다시
내는 게 맞음.** 지금 숫자는 자릿수 감각일 뿐.

**3. 어워드 버튼 3겹 게이트 (1~1.5d)** — 발사 블로커. 게이트 3겹 중
"일정 도달"이 시즌 단계 판정이라 #4와 같은 진실원을 봐야 함.
#4를 먼저 하면 여기가 짧아지고, 따로 하면 나중에 다시 손댐.

**4. getSeasonPhase 통합 (1.5~2d)** — 호출부가 넓어 회귀 확인이 대부분.
마이그레이션 없음.

**5. DB 객체 9개 + PITR (0.5~1d)** — 실제 작업은 TK가 Q1~Q5를 돌리는 5분 +
제가 출력을 파일로 커밋하는 것. PITR 활성화는 비용 결정이라 TK 판단.
★부수 관찰: 일일 백업 7일치가 보인다 = **이미 Pro**. 발사 게이트의
"Free→Pro"는 이미 완료 항목일 수 있음(확인 필요), 남은 건 PITR뿐.

**6. 스테일 날짜 (0.5d, ★시한 있음)** — 아래 §5.

**7. 채점 API 비용 실측 (0.5d)** — ★**정정이 필요합니다.** 메모리에
`project_scoring_500_throughput`(2026-07-26) 실측이 이미 있습니다:
**500편 10.6h, 시즌 $129**. 오늘 마른 건 **개발용 크레딧**일 가능성이
높습니다. 그러면 필요한 건 "채점 비용 계산"이 아니라
**①채점용/개발용 크레딧 분리 ②개발 소모율 실측 ③충전액 결정**입니다.
둘을 섞으면 또 마릅니다. ★이 구분부터 확인해 주십시오.

---

## 3. 의존 관계

```
#5 DB객체        ── TK가 Q1~Q5 실행 ──> 나 혼자 완결      [다른 것과 병렬 가능]
#6 스테일날짜    ── 본부 목표값 ──────> SQL 1회           [독립·병렬 가능]

#1 Defect1  설계 ── 대표님 답 2건 ──> 구현 ── 크레딧 ──> 재채점 검증 ──> 승인
                                                 ^^^^^^ 현재 막힘

#4 getSeasonPhase ────> #3 어워드 게이트         [순차 권장]

#2 얼굴일관성    ── 스코핑 0.5d 먼저 ──> 추산 재산출      [경계 확인 필요]
```

- **병렬 가능**: #5, #6은 대기시간이 대부분이라 다른 작업과 겹쳐도 됨
- **순차만**: #1 설계→승인→구현→검증 / #4→#3
- **경계 확인**: #2가 모델 쪽으로 가면 지수2 트랙과 중복. 착수 전 본부가
  경계를 그어주는 게 안전

---

## 4. 대기 항목 (누구 답을 기다리는가)

| 대기 | 누구 | 막는 것 |
|---|---|---|
| 로션 도포 **필수 vs 권장** | 대표님 | Defect1 rubric의 본선 항목 확정 |
| 외부 URL 경로 **(a)(b)(c)** | 대표님 | Defect1 — 진위 판정 완전 제거 가능 여부 |
| 잔여 스테일 날짜 **목표값** | 본부 | #6 SQL |
| 배점 변경 **승인** | 본부·제니3 | Defect1 구현 확정 (규정·카피 연동) |
| **크레딧 충전액** (+개발/채점 분리) | 대표님 | Defect1 재채점 검증 |
| Q1~Q5 **실행** | 대표님 | #5 |
| `fix/signup-profile-row` **PR·배포** | 대표님 | 미배포 상태 해소 |

**외부 URL 3안 요약** (Defect1 설계에 직결):
- **(a)** 시즌0 외부 URL 접수 차단, Studio 전용화 → 진위 판정 **완전 제거**
  가능. ★추천
- **(b)** 외부 URL 유지, provenance를 점수 축에서 분리해 어드민 플래그로만
- **(c)** 프롬프트만 "사실성 감점 금지" 수정 → 반쪽, 재발 여지

실측: `season_0`은 `studio_round='both'` + `studio_compose_enabled=true`(예선·
본선 다 Studio)인데 `/api/apply`는 아직 `free_entry_url` 접수가 열려 있음
(`app/api/apply/route.ts:69,140,179`).

---

## 5. 시한 있는 것 2개

**(1) `awards_announcement_at` = 9/8 21:00 (DB) vs 시트 v3.5 확정 10/12 20:00 PT**
9/8이 지나면 시스템이 "시상할 때"로 판단할 수 있고, **어워드 버튼 투표완료
게이트 부재(#3, 발사 블로커)와 겹치면 위험**. 같이 스테일:
`scoring_complete_at` 9/2 / 투표 9/5~9/7. 본부 목표값 오면 **한 번의 SQL로
정리** (#6). 여유는 있으나 #3과 묶어 판단해야 함.

**(2) Anthropic 크레딧 소진** — §2 #7 참조. Defect1 검증을 막고 있음.

---

## 6. Defect1 재개 지점 (내일 아침 바로 붙을 수 있게)

### 무비용 수정 창 — ★아직 유효

```
scoring_results 행 수 = { season_test: 51 }
season_0 = 0행
```
`season_0`에 채점된 작품이 하나도 없어 **재채점 대상이 없음**. 예선 채점이
한 번이라도 돌면 같은 시즌 안에 서로 다른 기준으로 채점된 작품이 섞여
공정성 문제가 됨. **그 전에 끝내야 함.**

### 병리 위치 (실측 확인)

`oxxovo-scoring/src/scorer.ts:92` 원문:
> `Look for watermarks, copyright marks, depth of field, real shadows, physical hand interactions — these are STRONG signals the video is NOT AI-generated.`

`src` 마지막 커밋 `8cd9309`, **프롬프트는 7/15 진단 이후 미수정** 확인.

실측 피해: Seedance "Her Gaze" integrity **35** → #7 / 얼굴 드리프트 Kling
**85** → #1. 같은 Seedance에 Gemini exec **98**. 모델은 품질을 보고 있고
Integrity 축이 뒤집음.

### 내일 할 것 (순서대로)

1. **`scorer.ts:92` 문구 교체** — "AI인가 실사인가"(육안) 폐기 →
   표절 / 워터마크·저작권 표시 / 규정 위반만. **사실성은 감점이 아니라 목표**
2. **`CLAUDE_INTEGRITY_EXTENSION` 정정** — 여기도 "워터마크/그림자/물리 단서"를
   근거로 요구함. ★본문만 고치면 되돌아옴
3. **생성 결함 탐지를 Execution 축으로 이관** + 배점 재산정
   (현행 Intent 25 / Exec 45 / Orig 20 / Integ 10)
4. **flag 게이트 임계값 재검토** — `seasons.flag_integrity_high_threshold=15`는
   원래 "AI 아님 의심" 문턱. 재정의 후 의미가 바뀜. 하드코딩 금지 원칙대로
   `seasons` 컬럼 유지, fail-closed 유지 확인
   (`batch.ts` `deriveConfidence` 경유)
5. **`season_test` 51행 재채점 검증** — 기존 행 보존, 별도로 돌려
   Seedance/Kling 역전 해소를 실측. ★크레딧 필요
6. **rubric 편집 조항 개정** + `/rules` 공개 카피 + `reports/official_rules`
   2파일 동기화

### 보고할 5개 항목 (본부 요구, 아직 미작성)

① 현 Integrity가 정확히 무엇을 보는가 ② 진위 의심 제거 후 무엇이 남는가 —
축 유지 vs 재정의 ③ Execution으로 옮길 항목과 배점 변화 ④ 기존 채점 소급
여부 ⑤ 진척·검증방법

★**본선 주제 = 화장품 CF + 얼굴 로션 도포 씬**(TK 2026-07-25 확정, 공개는
10/4 12:00 Finalist 통보 시). rubric에 로션 도포 평가 항목이 필요하고,
⏸**"필수 vs 권장"**이 정해지지 않으면 항목을 확정할 수 없음.

---

## 7. 미배포 상태

`fix/signup-profile-row` (`b88b9e0`) — **PR 미생성**(이 환경에 `gh` CLI 없음),
**배포 안 함**. 다음 통제배포에 묶기로 결정(TK, 2026-07-28).

PR 링크:
`https://github.com/oxxovo/oxxovo/compare/main...fix/signup-profile-row?expand=1`

프로덕션은 **트리거 복구로 이미 정상**이고 이 코드는 방어층이라 급하지 않음.

작업 트리 클린. `oxxovo-scoring`의 untracked 5개는 이전 세션 것
(mtime 7/03~7/26)이라 손대지 않음.
