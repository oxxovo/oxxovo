# 지수 본체 — 인계서 (2026-08-22 EOD, HQ "오늘 정리" 지시로 종료)

오늘 배포 2건, 미해결 다수. **내일 맨 처음 = ③ 워커 캔버스 확인** (대표님 읽기 접근 선행).

| | 항목 | 상태 |
|---|---|---|
| ① | 오늘 배포 2건 | **완료·sha 대조·라이브 확인.** |
| ② | 손 안 댄 것 3건 | 이유와 함께 기록 |
| ③ | 내일 첫 작업 | 워커 캔버스 — 접근 대기 |
| ④ | seasons 종횡비 컬럼 설계 | 열려 있음, 미착수(배포는 ③ 이후) |
| ⑤ | 미해결 목록 6건 | 아래 |
| ⑥ | 오늘 배운 것 | 두 줄 |

---

## ① 오늘 배포한 것

### `e33df25` — Watch 카드, 비율 중립

**바뀐 것**: `app/watch/Arena.tsx`(FinalistSection/WatchCard/FeaturedCompetitors/LatestEntries, 4곳) + `app/watch/[id]/page.tsx`(RelatedCard). 하드코딩 `aspect-video`(16:9) + `object-cover`가 9:16 썸네일을 얇은 가로 스트립으로 크롭하던 것을, `AspectThumb` 컴포넌트(당시 Arena.tsx 로컬)로 교체 — `<img onLoad>`로 실측 `naturalWidth/naturalHeight`를 읽어 박스 비율을 맞춘다. 9:16 고정이 아니라 **비율 중립**(TK 정정 반영) — 16:9 시즌이 와도 같은 버그가 반대로 재발하지 않는다.

**구현 중 자체 발견 버그**: 브라우저 캐시에 이미 있는 이미지는 `onLoad`가 React 리스너 부착 전에 끝나버려 이벤트가 안 잡히는 레이스가 있었음 — `ref` 콜백으로 마운트 시 `img.complete` 상태도 같이 체크하도록 수정.

**어디서 확인했는지**:
- `tsc --noEmit` 0 errors, eslint 0 errors(기존 무관 warning 2건만)
- 로컬 dev 서버에 실제 9:16 포스터(Halo Pictures) + 실제 16:9 프레임(demo_sf.mp4 ffmpeg 추출)을 `AspectThumb` 컴포넌트로 나란히 렌더 → 각자 제 비율대로(잘림 없이) 확인, 위 레이스도 이 재현에서 잡음
- 배포 후 `www.oxxovo.ai/api/version` sha `e33df25` 로컬 HEAD와 일치, `dirty:false`
- playwright로 쿠키/캐시 없는 새 브라우저 컨텍스트(시크릿 동등)로 `www.oxxovo.ai/watch` 재캡처 — 배포 전(잘려서 확대된 것처럼 보이던 상태)과 배포 후(전체 세로 프레임) 스크린샷 둘 다 대표님께 전송함

### `75e73f8` — Leaderboard·JobCard·winners·promo + AspectThumb 승격

**바뀐 것**:
- `AspectThumb`를 `app/_components/AspectThumb.tsx`로 승격(Arena.tsx 로컬 → 공유), `AspectVideoThumb`(video용, `fit: 'cover'|'contain'`) 신설
- `Arena.tsx:462` Leaderboard — 고정 `h-14 w-24` 크롭 제거, `AspectThumb` 적용(w-24 고정폭 유지, 높이는 콘텐츠 비율)
- `app/studio/page.tsx` JobCard 미디어 영역(참가자 본인 클립 갤러리) — video/failed/in-flight 3상태라 `AspectVideoThumb`에 안 맞아 같은 메커니즘을 로컬 `useState`로 직접 적용
- `app/admin/winners/WinnersView.tsx` — 수상작 썸네일
- `app/admin/promo/PromoView.tsx` — 원래 안 깨졌던 곳(이미 `aspect-[9/16] object-contain`)이지만 공유 컴포넌트로 정리(일관성)
- `app/studio/compose/ProComposeEditor.tsx:1668` 클립 풀 팔레트 — `object-cover`→`object-contain`만(부분 완화, 근거는 ②)

**어디서 확인했는지**:
- `tsc --noEmit` 0 errors. eslint — 내가 건드린 파일들은 0 errors(기존 무관 warning만). `ProComposeEditor.tsx`는 내 변경분과 무관한 위치(735/1877+행, `react-hooks/refs` 등)에 **배포 전부터 있던 11 errors + 1 warning**이 존재함을 `git stash`로 대조 확인 — 내가 만든 게 아니고 이번엔 안 건드림(별도 이슈로 기록만)
- 배포 후 sha `75e73f8` 일치, `dirty:false`
- 라이브 전수 스크린샷(시크릿 동등) — 24개 카드 정상. Leaderboard/Featured는 season_0가 아직 예선 중이라 조건부 비노출(점수 있는 본선 항목 필요) — **코드는 확인됐지만 실화면 확인은 본선 시작 후로 남음**

---

## ② 손 안 댄 것 — 이유

**`ProComposeEditor.tsx:1668` 클립 풀 팔레트(부분 완화만)**: `top: row * POOL_ROW_H` 가상화 절대좌표 그리드. 항목별 가변 높이를 넣으려면 행 높이 계산(`poolRows`, `startRow` 등) 전체를 다시 짜야 함 — 다른 자리처럼 드롭인이 안 됨. `object-contain`으로 저위험 완화(레터박스, 크롭 없음)만 우선 적용.

**`/tournament` 포스터 카드**: 코드 주석에 실재하는 근거 — *"Card image is a uniform vertical thumbnail (3:4, top-aligned...). It is intentionally cropped -- the full poster lives on the detail page + lightbox."* Watch 버그와 다른 점: (1) 의도가 주석으로 문서화돼 있고 (2) 크롭된 걸 못 보는 게 아니라 상세페이지에 원본이 있다(탈출구 존재). 이번엔 "의도적이겠지" 추측이 아니라 근거를 먼저 확인하고 근거가 있어서 안 건드렸다.

**`ProComposeEditor.tsx:1662` `aspect` 기본값**: `useState<Aspect>('16:9')` — 참가자가 에디터에서 자유 토글하는 세션 상태, 시즌 설정과 연결 0. 기본값도 9:16이 아니라 16:9. CSS 버그가 아니라 **아직 안 만든 `seasons.aspect_ratio` 컬럼에 걸리는 정책 문제** — ④ 설계가 이걸 흡수해야 함.

---

## ③ 내일 맨 처음 — 워커 캔버스 (대표님 읽기 접근 선행)

- `canvasForAspect`의 인자가 **에디터의 `aspect`(1662줄) 값인가** — 가설. 맞으면 "GL은 중립, CSS만 문제"였던 이번 조사와 같은 구조로 캔버스 문제도 쉽게 풀릴 가능성.
- `720×1280`이 07-31 지수2C 기록(`reports/lane_c_state_2026-07-31.md:47`)에 근거한 값인데, **지금도 그런지 확인 안 됨**. 왜 720인지(의도적 설정인지 우연인지)도.
- 내가 앞서 "1080×1920 확인됨"이라고 잘못 주장했던 근거(지수3 CF 비교 클립, `_main_round_seed.mjs`로 service-role 우회 주입된 것)는 **워커와 무관한 값**이었음 — 폐기됨, 캔버스는 아직 미확정 상태로 시작.
- 워커 리포(`oxxovo-studio`) 접근은 **대표님이 여신다. read-only** — 고치지 않는다, 커밋 안 한다, 배포 안 한다(과거 사고 재발 방지).

---

## ④ 열려 있는 설계 — `seasons.aspect_ratio` 컬럼 (미착수)

- 컬럼: `aspect_ratio` NOT NULL, 기본 `'9:16'`, CHECK 제약(허용값 한정) — `studio_test_access.expires_at NOT NULL` 패턴과 같은 축. 어드민 시즌 편집 폼에 필드 추가.
- `ProComposeEditor.tsx:1662` `aspect` 토글의 초기값을 이 컬럼 값에 묶는다 — **②에서 확인했듯 지금 이 토글이 정책과 완전히 분리돼 있는 게 진짜 구멍**, 무게중심이 여기로 옮겨졌다.
- `model_catalog`에 "지원 비율" 컬럼 신설 → 모델 목록을 시즌 비율과 교차해 **파생**시킨다(하드코딩 제외 리스트 폐기).
- 결과 렌더의 실제 해상도를 검출·기록하는 경로도 필요(현재 `generation_jobs`/`render_jobs`에 aspect/width/height 컬럼 없음 — 이번 세션에서 재확인됨).
- **배포는 ③(캔버스 확정) 이후.** 캔버스를 모르는 채로 컬럼/토글을 연결하면 뭘 검증하는지 알 수 없다.

---

## ⑤ 미해결 목록

1. **`watch_demo` 20편 은퇴 + 새 시딩** — 7편 404(DB엔 참조 남음), 9:16 0편. 대체안: 92편 홍보영상(1080×1920 실측 확인됨)을 임시 대역으로, 이후 워커 확정되면 실제 `submitRender`/`submitGeneration` 경로로 재시딩. **★리허설 시즌은 `allowed_video_platforms`를 `['studio']`로 맞출 것** — 지금 `season_test`는 `['youtube','vimeo','instagram','tiktok']`라 studio 전용 시합(season_0)과 조건이 다르다(TK 지적, 반영 확인됨). season_test 자체를 바꾸는 건 실행 시점에 별도 승인.
2. **`main_round_video_url` 트리거** — 설계 승인됨, 미구현. `genesis_applications` `BEFORE UPDATE OF main_round_video_url` 트리거, `allowed_video_platforms=['studio']`인 시즌에 한해 새 값이 그 user/season의 실제 `render_jobs.video_url`과 일치할 때만 허용. admin URL 교체 경로 자체가 현재 없음(전 레포 grep, `.update` 0건) — 트리거가 막을 기존 흐름 없음. season_test는 `['studio']`가 아니라 리허설도 안 막힘.
3. **워터마크 여백 축 분리** — 우측 마진은 폭(width)의 %, 하단 마진은 높이(height)의 %로 따로 계산(지금 스크립트는 한 축 기준으로 퉁쳤을 가능성 재확인 필요). 기준점은 로고 "잉크" 경계(실측 바운딩박스)여야지 캔버스/자산 원본 크기가 아님. **자산 자체를 트리밍하지 말 것**(원본 로고 파일 보존, 배치 계산에서만 잉크 경계 사용).
4. **흰/검 로고 전환 로직이 워커에 있나** — 확인 안 됨. 배경 밝기에 따라 `logo-wm-white`/`logo-wm-black` 중 고르는 로직이 실제 렌더 파이프라인(워커)에 존재하는지, 아니면 화이트 고정인지 — 워커 접근 열리면 같이 확인.
5. **#63 결제 실패 알림** — "9/9 전 필수"로 backlog에 있음, 미착수.
6. **이메일 13종** — 제니3 문안 대기, 코드 배선은 일부 진행됨(SelectedTop50 AI rationale, vote_deadline, season_winner_announced 등) — 문안 확정 전까지 발송 트리거는 wiring만 되고 실제 발송 문구는 placeholder.

---

## ⑥ 오늘 배운 것

- **렌더되는지부터 확인한다.** `ComposeEditor.tsx`와 `LobbySection.tsx` 둘 다 실제로는 죽은/거의 안 쓰이는 코드였다 — `ComposeEditor.tsx`는 어디서도 import 안 됨(`ProComposeEditor`가 실제 라이브), `LobbySection.tsx`(`LobbyCardView`)는 `/lobby-preview`(데모 배너 붙은 내부 툴) 단 한 곳에서만 쓰인다. 파일 이름/위치만 보고 "이게 그 화면이겠지"라고 짐작하면 안 되는 코드였다 — import 그래프를 직접 추적해야 한다.
- **"자리 하나 고쳐라"가 오면 먼저 전수 grep 한다.** 이번 목록(Leaderboard, JobCard, winners, promo, 클립 풀 팔레트)은 `aspect-video`/`object-cover` grep 한 번으로 다 나왔다 — 사람이 지적해서 나오면 늦다.

---

**연관**: [[feedback-evidence-scope-before-conclusion]] · [[feedback-check-first-scope-all-repos]] · [[reference-session-identity]]
