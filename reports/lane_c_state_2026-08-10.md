# 레인 C 상태 — 2026-08-10 (작성: 지수2C)

★★★당일 최종 갱신 (대표님 지시로 오늘 마감). HEAD: 앱 `d32accb` / 워커 `ed7945b`.
미커밋 0(양쪽). **무결성 라벨은 TK 판단 대기. 한국어 배선(~21파일)이 그 뒤다.**
내일 순서 = 무결성 판단 → 한국어 배선 → motionBlur 구현.

작업 공간: 앱 `C:\Users\Tom\oxxovo-lane-c` / 워커 `C:\Users\Tom\oxxovo-studio-lane-c`,
둘 다 `feat/studio-lane-c`. **미커밋: 앱 0 / 워커 0. 둘 다 push 완료.**

★직전 상태 문서는 `lane_c_state_2026-08-08.md`다. **이 문서가 최신이고, 다음
창은 이것만 읽고 이어갈 수 있다.** (이 파일 자체도 오늘 안에 한 번 갱신했다 --
①②③ 끝난 시점과 ④~⑦ 끝난 시점 사이. 지금 버전이 최종.)

| | HEAD |
|---|---|
| 앱 (`oxxovo`) | **`00f5ae4`** |
| 워커 (`oxxovo-studio`) | **`5257120`** (오늘 손 안 댐, 읽기만) |

★**오늘 = 두 트랙.** A) 100곡 배치 매니페스트 v1 완성. B) 레인 C ④ 전체
(glow 버그 → sharpen 배선방식 결정·재구성 → vignette 완전수정 → chromatic 노출
→ 사이징 재측정 → 규칙② 소급 3건 → D 스파이크) + 병행 조회 2건(페이지 2 정렬,
홍보영상 배선).

---

## 1. 트랙 A -- 100곡 매니페스트 v1

`tracks/batch-100-v1.json`(워커) -- **100/100 채워짐**. A 10칸×4 + C 2칸×20 +
B 5칸×4(B②=`ambient×tense`, 제니3 확정 -- tense·ambient 대조군을 동시에 채워
A 10칸 전부 대조군 확보). bpm 버킷 30/35/35 정확. `parseManifest` 실측 재검증
통과. **대기**: 라이선스 전사·실제 오디오(대표님/본부/공급자).

상세: `reports/lane_c_music_100track_manifest_v1_2026-08-10.md`

---

## 2. 트랙 B -- 레인 C ④ 전체

### ① glow targetIdx 버그 -- 수정 (`818f453`)

glow+전환(transition) 조합에서만 드러나던 버그(최종 카피가 `targetIdx` 무시,
항상 캔버스로). `this.bindTarget(targetIdx, w, h)`로 수정.

### ② 조합 파리티 하니스 → 옵션① 확정·재구성 (`818f453` → `d915633`)

`scripts/gl-combo-parity.mjs`로 3조건 실측: 패스 추가 비용 = **0**(③의 존재
이유 소멸) / sharpen+grain 순서오차 = grain 크기의 1.7~2배(②는 순서 못 맞추면
탈락) / sharpen+vignette는 순서 무관하지만 **vignette 자체가 ffmpeg와 다른
수학이라는 걸 발견**. → **①로 확정, `preview-gl.ts` 재배선**: 색+LUT → sharpen
→ chromatic → grain → vignette → glow, 워커 실제 순서 그대로 각각 독립 패스.
FBO 풀 6→8칸(6/7 = 이 체인 전용 스크래치).

### ③ sharpen + chromatic 노출 (`f345d0f`, `05a65c5`)

`test:parity:engine` 게이트가 이제 저크기 효과도 판별한다(제니2 08-08 신호상대
오차 밴드) -- sharpen PASS(mandel/testsrc), chromatic PASS **r=0.000**(byte-
identical, 방향 ffmpeg 실측으로 확인). `EXPOSED_SLIDER_KEYS`에 둘 다 추가.
motionBlur(시간축, 프레임버퍼 없음)·lutIntensity(워커 미구현) 구조적으로 막힘,
코드에 이유 남김.

### vignette 수학 -- 완전히 고침 (`64177a7`)

폐쇄형 수식은 슬라이더 실제 각도범위(`PI/6`~`PI/2`) 전체에서 1% 이내로 못 냄
(체계적으로 시도, `scripts/fit-vignette-model.mjs`). → **실측 LUT로 대체**:
ffmpeg 실제 출력을 텍스처로 구움(`scripts/gen-vignette-lut.mjs` →
`public/vignette/vignette-lut.png`, 256×51). 정규화 축(코너거리)을 4개
화면비로 사전검증. `test:parity:engine`에 vignette 행이 **처음으로 생겼고
PASS**(r=0.20~0.21). grain/vignette 재배열 재측정도 완료(질적 결론 불변).

★★**하니스 자체 버그를 오늘 세 번 잡았다**(Y-flip, 텍스처 유닛 순서, 보간오차
사전점검) -- ★"첫 실행의 델타 표를 그대로 결론으로 썼으면 정반대 결론이 났을
것"(패스 비용이 실은 0인데 첫 측정은 FBO flip 때문에 2~4로 나왔었다). **아키텍처
판단 직전의 숫자는 "왜 이 크기인가"를 한 번 더 물을 것.**

### ④ 페이지 2 정렬 -- 조회 결과: id ASC는 이미 쓰이고 있다

`musicCurationOrderTerms()`가 id를 3번째 항으로 반환 + `listMusicForCuration`이
루프로 매 항마다 `.order()` 호출. **"여러 번 부르면 덮어쓰나 누적되나"를
`@supabase/postgrest-js` 실제 소스로 확인**(`PostgrestTransformBuilder.ts:
336-345`) -- 누적됨(콤마 이어붙임), 덮어쓰기 아님. 3항 전부 실제 쿼리에 실린다.
남은 갭은 100곡 초과·동점 다수 상황에서의 **라이브 실측**뿐(100곡 배치 로드
후 가능, 여전히 대기).

### ⑤ 규칙② 소급 3건 -- 대조군 추가, 셋 다 실제로 검증 (`7cb882e`)

music-grid-parity(`diffGrid` 추출 + 3개 깨진 쌍으로 검증, **실제로 로직을
뒤집어서 대조군이 빨개지는 것 확인 후 원복**) / music-curation(무동작 쓰기
케이스 -- 이미 같은 값으로 세팅해도 changed=1 나오는지 **라이브 season_test로
확인**) / landing-stage(`heroWithOldGate()`로 옛 버그 재현, 같은 검증 로직이
그걸 잡는지 실행해서 확인). `npm test` 462/462.

### ⑥ 가짜 팀명 화면 규칙 -- ★막힘, 질문 있음

레포에서 "team" 관련 필드·`⑫` 항목을 못 찾았다(이메일 보일러플레이트만 매치).
추측 안 하고 대기 -- **어느 테이블/화면인지, `⑫`가 어느 문서 항목인지** 확인
필요.

### ⑦ D 키프레임 워커 스파이크 -- 완료

`eq=eval=frame:brightness='min(t/3,1)*0.5'` 실제 렌더+측정(130→255 밝기 변화
확인) -- **`sendcmd` 없이 ffmpeg 표현식(`eval=frame` + `t`)만으로 값 곡선이
된다.** `overlay`는 기본값이 이미 `eval=frame`이라 위치 키프레임이 가장 쌈(이미
쓰는 필터). D의 "낼 수 있는가" 불확실성은 해소 -- 남은 건 결정①(무엇을
키프레임) · 결정②(보간 어휘), 둘 다 제니2/본부.

상세 전체: `reports/lane_c_item4_glow_combo_parity_2026-08-10.md` ·
`reports/lane_c_vignette_math_investigation_2026-08-10.md` ·
`reports/lane_c_item4_sizing_2026-08-10.md` ·
`reports/lane_c_item4_d_keyframe_worker_spike_2026-08-10.md`

---

## 3. 병행 조회

**Soundverse 변수**: `SOUNDVERSE_API_KEY`, 워커 Railway env만(앱 불필요,
`FAL_KEY` 컨벤션). 어댑터 자체(라이선스 티어 파라미터 포함)는 오늘 범위 아님.

**홍보영상 자동발행**: cron 스케줄러 **없음**(`app/api/cron/`에 promo 파일
0개). SNS 실게시 **있음**(Postiz API, `/api/admin/promo/publish` → 실제
`publishPost()` 호출, `posted_channels`/`posted_at`은 성공 후에만 기록 --
버튼이 실제로 SNS에 올린다, DB 표시만 바꾸는 게 아님). `POSTIZ_API_KEY` 미설정
시 503 전체 비활성(라이브 env 상태는 이 체크아웃에서 확인 불가). 발행 전 편집
UI(채널선택·캡션·예약)는 있음, 큐 리오더 UI는 없음(자동 큐 자체가 없어 무의미).

---

## 4. 대기 -- ★내가 고르지 않는다

| 항목 | 소관 |
|---|---|
| ⑥ 가짜 팀명 화면 규칙 -- 대상 불명 | ★제니2 (질문 있음) |
| B② 이후 100곡 라이선스 조건 전사 | 대표님/고문 |
| Soundverse 어댑터 구현 | 대표님/본부 승인 후 엔지니어링 |
| 실제 오디오 100곡 생성 | 대표님/본부/공급자 |
| D 착수(결정①②) | 제니2/본부 |
| 페이지 2 정렬 라이브 실측 | 100곡 배치 로드 후 |
| 홍보영상 `POSTIZ_API_KEY` 라이브 상태 확인 | 제니2/대표님 (Vercel 접근) |
| motionBlur(프레임 히스토리 버퍼) · lutIntensity(워커 블렌드) | 각자 스파이크/구현 선행 |
| ⑥C 재수립 | 본부·제니3 |
