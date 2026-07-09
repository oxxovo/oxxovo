# ② Watch 썸네일 착수 계획 (내일 첫 항목) — 실코드 기반 고정

- 작성: 2026-07-08 (지수2). **브리핑 승인 대기 없이 내일 바로 착수 가능하도록 범위 고정.**
- 근본: studio compose 최종본 = R2 self-hosted mp4 → `deriveThumbnail`은 YouTube/Vimeo만 파생 → R2는 null → **모든 Watch 카드 그라디언트 폴백**(Arena.tsx:192). 시즌0 전면 studio라 전 카드 해당. 관객 투표 화면 시각품질 = 발사 전 필수.

## 실행 순서 (의존성 순 — 어기면 컬럼 없는 write 실패)
**1) 마이그(TK Supabase Run) → 2) 워커 배포(Railway) → 3) web submitRender → 4) web Watch**

## 1. 마이그레이션 SQL (멱등·ASCII-only, TK Run)
```sql
ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE genesis_applications ADD COLUMN IF NOT EXISTS thumbnail_url text;
```
`IF NOT EXISTS`=멱등, 컬럼 추가만=롤백 안전. (박스문자 금지, === 구분선 규칙 준수)

## 2. 워커 (oxxovo-studio, 브랜치 feat/studio-loadtest = Railway 배포 브랜치)
- **삽입 지점**: `src/worker.ts` `processRender()` — step2(`renderComposition`→`outPath=final.mp4`) 이후, step5(`setRenderStatus ready`) 전.
- **추출**: 기존 `run('ffmpeg', ...)`(src/render.ts) 재사용:
  `ffmpeg -y -ss 0.5 -i final.mp4 -frames:v 1 -q:v 3 poster.jpg`  (0.5s=블랙프레임0 회피)
- **업로드**: 기존 `uploadVideo(posterBuf, {seasonId, userId, jobId: render.id, kind:'poster', contentType:'image/jpeg'})` — uploadVideo가 contentType 옵션 지원(src/r2.ts:43), {key, publicUrl} 반환.
- **기록**: step5 `setRenderStatus(render.id, { status:'ready', ..., thumbnail_url: posterUp.publicUrl })`.
- **실패 격리**: 포스터 추출/업로드 try/catch → 실패해도 렌더는 ready 유지(thumbnail_url=null 폴백). 썸네일=비필수.
- **배포**: Railway 재배포 동반. 워커 현재 clean·origin 동기(1076ef1).

## 3. web submitRender (oxxovo, lib/studio.ts)
- render_jobs SELECT(submitRender ~700-705)에 `thumbnail_url` 추가.
- genesis_applications insert(7a ~846)에 `thumbnail_url: render.thumbnail_url` 추가. 7c 업데이트(~893)·5b main(~851) 경로도 동일 전파.
- (단일제출 submitGeneration은 generation_jobs 썸네일 별도 = 시즌0 compose-only라 후속.)

## 4. web Watch (oxxovo, lib/watch.ts) + 카드
- getWatchVideos select(~200)에 `thumbnail_url` 추가.
- toWatchVideo: `thumbnailUrl: row.thumbnail_url ?? deriveThumbnail(videoUrl)` (저장값 우선, 없으면 기존 파생 폴백 = YouTube 외부경로 호환).
- 카드(app/watch/Arena.tsx:192) `v.thumbnailUrl ? <img> : 그라디언트` **이미 배선** → URL 채워지면 자동. 상세페이지(app/watch/[id]/page.tsx:264)도 동일.

## 워커 브랜치/배포 상태 (2026-07-08 실측)
- oxxovo-studio = **feat/studio-loadtest** (Railway 배포 브랜치), clean, origin 동기, HEAD 1076ef1. thumbnail 코드 없음(신규).

## 검증
- 마이그 Run 후 워커 배포 → 새 compose 제출 → render_jobs.thumbnail_url + genesis.thumbnail_url 채워짐 확인 → /watch 카드에 포스터 표시.
- 기존 제출물(thumbnail_url=null)은 그라디언트 유지(비소급) — 필요시 backfill(워커 재처리 or 1회 스크립트) 후속.
