# 레인 C 상태 — 2026-08-08 (작성: 지수2C)

작업 공간: 앱 `C:\Users\Tom\oxxovo-lane-c` / 워커 `C:\Users\Tom\oxxovo-studio-lane-c`, 둘 다 `feat/studio-lane-c`.
트렁크: 앱 = `feat/studio-budget-guard`(오늘 머지로 받음), 워커 = `main`.
**미커밋: 앱 0 / 워커 0. 앱 push 완료, CI 2회 success. 워커는 오늘 손 안 댔다.**

★직전 상태 문서는 `lane_c_state_2026-08-03.md`다 — **08-06·08-07 상태 문서가 없다.**
그 사이 산출물은 리포트 파일로만 남아 있다(`lane_c_i2v_6shot_realcall_2026-08-07`,
`lane_c_music_multitrack_survey_2026-08-07`, `lane_c_music_c_plan_design_2026-08-07`,
`lane_c_item4_pro_editor_survey_2026-08-08`). **이 문서가 최신이고, 다음 창은 이것만
읽고 이어갈 수 있다.**

| | HEAD |
|---|---|
| 앱 (`oxxovo`) | **`cb022f9`** |
| 워커 (`oxxovo-studio`) | **`fb42108`** (오늘 무변경, upstream 일치) |

★**오늘 종료 시점 = ③b에서 격자 값에 안 걸리는 것 소진. 전부 대기다** (6절).

---

## 1. 오늘 커밋 (앱만)

| 해시 | 내용 |
|---|---|
| `3097c11` | (머지) A 수용 — `feat/studio-budget-guard` `3bd5b24`. 충돌 2건 해소(4절) |
| `b4b7f14` | ① 경계 테스트 4건 + ② 큐레이션 화면 + `resolveMusicSignature` export + 설계 §4c 정정 |
| `cb022f9` | ★정정 — `[2.5]`는 워커에 이미 있었다. 코드 동작 변경 0, 주석·문구·문서만 |

워커: **커밋 0.** ★단 어제 저녁 워커에 `fb42108`(기계 심사 `[2.5]`)이 들어와 있었고,
**내가 그것을 오늘 늦게까지 몰랐다** — 3절-(4).

### 검증 (전부 로컬. CI는 별도 표기)

앱 `npx tsc --noEmit` **0** · `npm test` **347/347** · `test:kat` **35/35 ALL PASS** ·
`test:theme-leak` **PASS** · `npm run build` **OK** (`/admin/music` 라우트 등록 확인) ·
`test:music-boundary` **29 pass / 0 fail** · `test:music-curation` **28 pass / 0 fail**
GitHub Actions `checks`: `b4b7f14` **success** / `cb022f9` **success**

★KAT 골든 무변화 — v1m canonical 밖만 건드렸다.
★**안 돌린 것을 적어 둔다**(돌렸다고 읽히지 않게): `test:e2e-music`, `test:i2v-guard`,
`test:round-caps`, `test:i2v-ref-guard`, `test:reachability`, `test:text-parity`.
오늘 변경이 그 경로를 안 건드렸지만 **"통과했다"고 말할 근거는 없다.**

### 새로 생긴 명령

```
npm run test:music-boundary    ③b 4절 경계 4건 (라이브 DB, season_test에만 쓰기, 정리 확인 출력)
npm run test:music-curation    [3] 큐레이션 읽기 + active 쓰기 (동일 규율)
npm run inspect:music-state    음악 스위치가 몇 단인지 실측 출력 (쓰기 0건)
```

### 새 파일

```
e2e/music-boundary.mjs              lib/music-curation.ts
e2e/music-curation.mjs              lib/music-curation-order.ts (+ .test.ts)
scripts/inspect-music-state.mjs     app/admin/music/{page.tsx,actions.ts,MusicCurationView.tsx}
```

수정: `lib/studio.ts`(export 1건) · `app/admin/AdminShell.tsx`+`lib/admin-i18n.ts`(nav 1건) ·
`package.json` · `reports/studio_go_live_checklist_2026-07.md` ·
`reports/lane_c_music_c_plan_design_2026-08-07.md`

---

## 2. ③b — 오늘 한 것

### ① 경계 테스트 4건 — 완료 (`test:music-boundary` 29/0)

★**착수 전 확인이 절반을 없앴다.** 4절 4건 중:

| 4절 항목 | 어디서 이미 덮였나 |
|---|---|
| 2번 생성 절반 (`music_not_priced`) | `scripts/e2e-music.mjs` 32/32에 **이미 있었다** |
| 3번 캡 (`music_cap_reached` + 잔액으로 못 산다 + `failed`가 슬롯 반환) | 같은 파일에 **이미 있었다** |
| 4번 목록 절반 | `lib/music-picker-scope.test.ts` 11/11 |

★**테스트 참조 0회였던 것은 두 개**(실측):

| 부품 | 참조 수 |
|---|---|
| `listMusicAssets` | **0** — 피커 읽기가 DB 상대로 실행된 적 없음 |
| `resolveMusicSignature` / `music_not_owned` | **0** — 렌더 e2e 4개 전부 `music` 0회 |

그 두 개를 덮었고, **이미 덮인 것은 반복하지 않고 어디서 덮이는지 출력한다.**

★**`resolveMusicSignature`를 export했다.** `createRender`로 가면 **승인 케이스가
`render_jobs` 행을 insert**하고, 워커는 season-blind라 **수초 안에 그 행을 집어 실제
렌더를 시작한다** — 플레이스홀더 클립으로. 직접 호출하면 양방향을 **렌더 행 0개**로
검증한다. `createRender` 쪽은 **거부만** 확인하고, 그것이 음악 게이트를 증명하지
**않는다는 것**을 파일에 적어 뒀다(소스 검사가 음악 단계보다 앞이라 그 단정은 음악
게이트를 지워도 통과한다).

### ② 큐레이션 — 완료 (`/admin/music`, `test:music-curation` 28/0)

★**`[2.5]`를 기다리지 않고 만든 근거**: `active`는 **격자 값과 점수 둘 다에 직교**한다.
어떤 축을 쓰든, 점수가 있든 없든 "이 곡을 참가자에게 보일지"는 같은 불리언이다.

- 정렬 규칙은 `lib/music-curation-order.ts`에 **순수 함수로 분리**, 점수 슬롯을 미리 넣고
  **테스트로 고정**. 점수가 오면 **공급만** 남는다.
- ★**정렬의 SQL 절반은 점수 컬럼을 이름조차 부르지 않는다.** 마이그 안 된 컬럼을 부르면
  PostgREST가 문장을 통째로 조용히 거부한다([[feedback-postgrest-unknown-column-silent]]).
  ORDER BY 컬럼을 allowlist로 고정하고 유닛이 그것을 단정한다.
- ★**미측정 ≠ 0점**: 점수 없는 곡은 0점 곡보다 **뒤로**. 합치면 신규 유입이 기각 더미에
  묻힌다. (워커가 기각 곡에도 점수를 주기 때문에 이 구분이 실제로 필요하다.)
- 1,000곡을 한 곡씩 누르는 문제 = **페이지 단위 일괄 활성/보류**. 페이지 100.
- ★**쓰기는 문장 자체에서 `source='library'`로 잠갔다** — UI가 아니라 SQL에서. id 목록은
  브라우저에서 온 목록이고, 절대 일어나선 안 되는 건 **참가자 본인 AI 곡을 끄는 것**이다.
  4절이 그걸 단정한다(혼합 목록은 `partial`로 보고, AI 행은 안 바뀜).
- 서명 없는 곡은 `active`와 무관하게 노출 불가라서 **별도로 세어 화면에 경고**로 띄운다.

★**미착수(지시대로 손대지 않음)**: 매니페스트 스키마, 피커 필터·미리듣기 — 격자 값 대기.

---

## 3. ★★오늘의 정정 4건 — 전부 내가 쓴 것을 내가 뒤집은 것

### (1) 설계 §4-2 "오늘 라이브로 검증 가능"이 틀렸다

라이브 실측(`inspect:music-state`, 쓰기 0건): `season_0`는 **스위치 1·2단 중 아무것도 안
돌았다.**

| 4절이 예상 | 실제 (season_0) |
|---|---|
| 생성 → `music_not_priced` | **`music_disabled`** — 마스터가 가격 검사보다 훨씬 앞 |
| 목록 **정상 반환** | **빈 배열** — 마스터 false면 `listMusicAssets`가 즉시 빈 배열 |

"가격 미설정 + 목록 정상"이라는 **조합 자체가 season_0에 없다**(그건 `ai_enabled=true`
전제 = 시즌1). 그 케이스는 `season_test`에서 검증하고, `season_0`에는 **오늘의 실제
상태를 단정으로 박았다** — **깨지는 것이 곧 2단이 돌았다는 신호**다.

### (2) `active`는 NOT NULL이고 `source`에는 CHECK가 있다

8/7에 "레포로는 증명 불가"라 한 제약이 **실제로 존재한다**
(`studio_music_assets_source_check`, 그리고 `active` NOT NULL).
★**코드는 그대로 뒀다** — 제약 뒤의 **두 번째 겹**이고 유지비 0
([[feedback-policy-obsolete-code-stays-inactive]]). 바뀐 건 **문서의 주장**뿐: 그 두
분기는 "지금 일어나는 일을 막는다"가 아니라 "제약이 사라지면 막는다"다.

### (3) ★내 첫 harness가 그 두 케이스를 **무효 통과**시켰다

`active=NULL` 케이스가 PASS로 나왔다. **행 insert가 실패 → 행 없음 → "목록에 없다"가
자동으로 참**이 되고, 렌더는 `music_not_found`로 거부 — **의도한 이유와 다른데 통과**.
★**규율: 픽스처 seed의 실패는 테스트의 전제 실패로 승격해야 한다.** 지금은 **제약 이름을
근거로 SKIP**한다. PASS도 FAIL도 아닌 것이 정직한 답이다.

### (4) ★★★내가 **한 레포만 grep했다** — 오늘 최대 항목

`[2.5]`를 "미착수"로 적고 큐레이션을 만들었다. **틀렸다. `[2.5]`는 워커에 이미 있다** —
`src/music-screen.ts` + `src/music-probe.ts` + `src/music-grid.ts`, 어제 저녁 `fb42108`.
`screenMusic()`이 **0~100 점수를 모든 곡에** 준다(기각 곡도, 무음은 0) — 4b-(3)이 말한
"기각이 아니라 정렬" 그대로다.

★**확인이 `oxxovo-lane-c` 안에서만 돌았다. 레인 C는 두 레포다.** 4절 규율("이미 있는지
먼저 확인")을 **적용하는 중에 범위를 좁힌 것 자체가 같은 실수**다. 워커
`music-library.ts`의 `GRID_COLUMNS_LIVE=false`가 같은 얘기를 하고 있었는데 읽고 지나갔다.

★**정정된 사실**: 없는 것은 `[2.5]`가 아니라 **점수를 담을 컬럼**이다. 즉 `[2.5]` → `[3]`은
**구현 단계가 아니라 공급 단계**다. → **본체 마이그**(제니2가 본부에 올림).
★큐레이션을 지금 만든 판단 자체는 유효하다(점수 컬럼 없는 동안 제목순으로 동작).

---

## 4. 머지 충돌 2건 — 어떻게 갈랐나

`git merge feat/studio-budget-guard` → 충돌 2건.

| 파일 | 처리 |
|---|---|
| `package.json` | `test` 목록은 **합집합**. A가 더한 `video-url`·`dst-boundaries`·`lobby` 추가, 내 쪽 전부 유지 |
| `studio_go_live_checklist_2026-07.md` | ★**양쪽이 각자 C8을 썼다** |

★**C8은 A가 유지, 내 것을 C9로 옮겼다. 근거 = 참조 수**: A의 C8은
`rehearsal_runbook_2026-07.md:172`와 `lane_a_state_2026-08-07.md:161`에서 참조되고(둘 다
살아 있는 문서), 내 C8은 **과거 상태 문서 한 곳**에서만 참조된다. **A 텍스트를 안 건드리고
살아 있는 포인터 0개를 깨는 쪽**이 그것이었다. 번호 순서도 C8 다음 C9로 맞췄다.
★덧붙여 내 C9 본문의 **"300곡"을 1,000곡으로** 고쳤다(발사 체크리스트의 스테일 수치).

★어제의 미커밋 파일 `lane_c_item4_pro_editor_survey_2026-08-08.md` — **머지 커밋
`3097c11`에 같이 들어갔다.** 충돌 해소를 `git add -A`로 마무리해서 그 시점의 untracked
파일이 함께 스테이징된 것이다. 실측으로 확인: 그 경로는 **머지 부모 양쪽(`4edc09f`,
`3bd5b24`) 모두에 없고 `3097c11`에만 있다.** 파일 자체는 커밋되어야 할 것이었으니 잃은
것도 잘못 들어간 것도 없지만, **머지 커밋에 무관한 파일이 섞인 것은 깔끔하지 않다** —
다음엔 머지 해소 전에 관계없는 untracked를 따로 커밋한다.

★(처음 이 문단에 `e9c166d`가 그 파일을 A 쪽에서 이미 커밋했다고 적었다. **틀렸다** —
그 커밋은 머지 부모의 조상이 아니고, 부모 양쪽에 파일이 없다는 것이 반례다.)

---

## 5. 라이브 실측 (2026-08-08, 쓰기 0건)

| 항목 | 값 |
|---|---|
| `seasons` 14행 전부 | `studio_music_enabled=false`, `studio_music_ai_enabled=false`, `cap=15`, `studio_round='both'` |
| `platform_config` `%music%` 키 | **0개** |
| `studio_music_assets` | **0행** |
| `credit_transactions` | 54행 (경계 테스트 전후 불변 확인용 기준선) |
| 스위치 단계 | **0단 — 1·2단 중 아무것도 안 돌았다** |

★`inspect:music-state`가 시즌별로 **"지금 생성하면 무엇이 거부되는지 / 피커가 무엇을
주는지"**를 출력한다. 4단이 3단보다 먼저 켜진 경우도 그 자리에서 표시한다.

★**양 harness 정리 확인**: `season_test` 스위치 복원, `zz_`-접두 행 전량 삭제,
`studio_music_assets` **0행 복귀**, leftover **0**. 신용 원장 이동 **0**. 비용 **$0**.

---

## 6. 대기 — ★내가 고르지 않는다

| 항목 | 소관 |
|---|---|
| 격자 **축의 값** (genre 10 / mood 8) | ★제니3·본부 |
| 마이그 `genre`/`bpm`/`sort_order` **+ 점수 컬럼** | ★지수 본체 (3절-(4)로 항목 1개 추가됨) |
| 스위치 **1·2단** (1,000곡 적재 / `studio_music_enabled=true`) | ★본체·대표님 |
| `studio_presets.desc_text`의 "the product" | ★본체 |
| ⑥C 재수립 | ★본부·제니3 |
| 공급자·계약, 1,000곡 실제 생성 | ★대표님·본부·고문 |

★**격자 값이 오면 즉시**: `[0]` 매니페스트 스키마 → `[4]`-1,2 피커 필터·미리듣기.
★**점수 컬럼이 오면 즉시**: 큐레이션 정렬항 1개 + 워커 점수 공급 배선.

---

## 7. 오늘 얻은 규율 (재사용 가능한 것만)

### ★★0. 셋을 묶는 것 — **근거의 범위를 확인 안 했다**

★오늘 틀린 방식이 **세 번 다 같은 계열**이었다(제니2 정리). "근거가 없음"이 아니라
**근거가 무엇을 덮는지 확인 안 함**이다.

| 무엇을 근거로 삼았나 | 범위의 구멍 | 어떻게 갈렸나 |
|---|---|---|
| harness가 PASS를 냈다 | seed insert 실패로 **행이 없었다** → 부정형 단정이 자동 참 | seed 에러를 단정으로 승격 (3절-(3)) |
| 앱 레포 grep 0건 | **워커 레포를 안 봤다** | 양 레포 확인 (3절-(4)) |
| `git log --diff-filter=A -- <path>`가 `e9c166d`를 냈다 | **다른 브랜치의 동일 경로**를 집어 왔다 | 부모 양쪽을 `git cat-file -e`로 직접 확인 (4절) |

★세 번째가 가장 선명하다: **명령은 정상 동작했고 출력도 사실이었다.** 틀린 것은 **그
출력이 답하는 질문이 내 질문이 아니었다**는 점이다. 즉 **한 명령의 출력이 곧 근거가 아니다.**

**적용**: 결론에 **근거의 범위를 같이 적는다**("앱 레포에서 grep했다", "HEAD에서 조회했다").
부재 주장은 특히 그렇다. git 질문은 커밋을 지정해 직접 확인한다 —
특정 커밋에 있는지는 `git cat-file -e <commit>:<path>`, 조상 관계는
`git merge-base --is-ancestor`. `git log -- <path>`는 히스토리 단순화·타 브랜치에 걸린다.

### 개별 항목

1. ★★**규율을 적용하는 중에도 범위를 좁히면 같은 결과가 난다.** "이미 있는지 확인"을
   하면서 **한 레포만** 봤다. 레인 C는 두 레포다 (3절-(4)).
2. ★★**픽스처 seed의 실패는 테스트의 전제 실패다.** 행이 안 생기면 "없다"가 자동으로
   참이 되고, **아무것도 재지 않은 음성 테스트가 통과한다** (3절-(3)).
3. ★**제약 뒤의 코드는 지우지 않고 "두 번째 겹"으로 다시 라벨한다.** 무의미해진 게 아니라
   **발동 조건이 다른 것**이다 (3절-(2)).
4. ★**테스트가 프로덕션 워커를 깨우지 않게 진입점을 고른다.** 승인 케이스가 큐 행을 넣는
   함수는, 그 행을 집는 워커가 season-blind라면 **테스트가 실제 작업을 시작시킨다**.
5. ★**문서 충돌은 참조 수로 가른다.** 같은 번호를 양쪽이 썼을 때, 살아 있는 포인터를
   덜 깨는 쪽이 번호를 지킨다 (4절).
6. ★**"안 돌린 것"을 검증 절에 적는다.** 안 적으면 통과했다고 읽힌다 (1절).
7. ★**머지 해소를 `git add -A`로 마무리하지 않는다.** 그 시점의 무관한 untracked가 머지
   커밋에 섞인다 (4절).
8. ★**상태 문서가 없으면 다음 창은 리포트 더미를 뒤진다.** 08-06·08-07이 그랬다 — 마감
   때 이 파일을 쓰는 것이 그 비용을 없앤다.
