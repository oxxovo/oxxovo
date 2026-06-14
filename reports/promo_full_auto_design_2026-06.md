# 홍보영상 전자동 파이프라인 — 설계도 (2026-06-10)

목표: **프롬프트 입력 → fal 생성 → 합성(자막·엔드카드·음악) → 보관 → Postiz 4채널 발행 → 주 3회 예약**까지 무인 자동.
원칙: 새 발명 없음 — 이미 검증된 **studio 워커 패턴**(Railway 폴러 + Supabase 잡 큐 + 상태머신)에 **oxxovo-promo의 생성/합성 로직**을 끼우고, 본체(oxxovo)가 큐·보관·발행·스케줄을 쥔다.

실측 근거:
- `oxxovo-studio/src/worker.ts` — 롱러닝 폴러, `generation_jobs` CAS 클레임, fal→R2→`ready`, 실패→환불, 일일 캡 가드. (그대로 본뜰 템플릿)
- `oxxovo-promo/{generate.py, postprocess.py, audio_generate.py, config.json}` — fal Veo 3.1 씬 생성 + ffmpeg 자막/엔드카드/음악 합성(자막 자동축소·en/kr 2종·브랜드오디오). 현재 CLI 배치(`python ... --all`), 로컬 output/.
- 본체: `promo_videos`(보관·완료) + `/api/admin/promo/publish`(Postiz 발행, 실측확정) **이미 라이브**.

---

## 1. 전체 아키텍처 — 6단계가 어디서 도는가

```
[oxxovo  / Vercel — 컨트롤 플레인]            [oxxovo-promo / Railway — 워커(무거움)]
 ① 프롬프트 입력                                ② fal 생성  ③ 합성(ffmpeg)
   /admin/promo "생성 요청" 폼                    generate.py    postprocess.py
   -> promo_jobs(queued) INSERT       ──잡큐──>   (Veo 3.1)      (자막+엔드카드+음악, en/kr)
                                                       │
 ④ 보관  promo_videos(ready)          <──기록──   Supabase Storage 업로드 + 행 생성
 ⑤ 발행  /api/admin/promo/publish (Postiz, done)        + promo_jobs done/failed
 ⑥ 스케줄 Vercel cron: 승인+미발행을 주3회 슬롯에 Postiz 예약(scheduledAt)
```

- **① 프롬프트·주제 입력 = 본체(Vercel).** `/admin/promo`에 "생성 요청" 폼 추가 → `promo_jobs` 행(queued). 주제/티어/언어/씬프롬프트(또는 config 프리셋 ref).
- **② fal 생성 = 워커(Railway).** `generate.py` 로직. config.json의 씬·단가·예산 가드 그대로.
- **③ 합성 = 워커(Railway).** `postprocess.py` 로직(ffmpeg). **Vercel 불가**(서버리스에 ffmpeg/큰 파일/장시간 없음) → Railway 필수. **자막·엔드카드·브랜드오디오 = 검증된 코드 재사용.**
- **④ 보관 = 본체 DB + Storage.** 워커가 완성 mp4(en/kr)를 **Supabase Storage `promo-videos`**(수동 경로에서 만든 그 공개 버킷)에 업로드 → `promo_videos` 행(ready). R2 불필요(수동 경로와 통일, 규모 시 P1 R2).
- **⑤ 발행 = 본체.** 실측 확정된 Postiz 발행 그대로.
- **⑥ 스케줄러 = Vercel cron + Postiz 네이티브 예약.** cron이 "승인됨+미발행" 영상을 cadence(주3회)의 다음 빈 슬롯에 배정 → `publishPost(scheduledAt)` → **Postiz가 그 시각에 발사**(우리가 매분 깨어날 필요 없음). vercel.json cron은 현재 3개 → 4개(한도 100, Pro 여유).

### 핵심 인터페이스 = `promo_jobs` 테이블 (본체가 정의, 워커가 소비)
```
promo_jobs
  id uuid pk / created_at / requested_by uuid
  status text  queued|generating|composing|uploading|done|failed   -- 워커가 전이
  -- 입력(스펙)
  title text / theme_note text
  tier text         test|final            (기본 test; final은 TK 승인 게이트)
  langs text[]      예: {en,kr}
  aspect_ratio text 기본 '9:16'
  config_ref text   config 프리셋 키(예: 'genesis_s0')  -- 확정 카피 재사용
  scenes jsonb      (선택) 씬 프롬프트 override [{id,cut,prompt}]
  overlays jsonb    (선택) 자막 override
  generate_audio bool
  -- 진행(워커 기록)
  attempts int / worker_started_at / worker_finished_at
  fal_request_ids text[] / cost_usd numeric / error_message text
  produced_video_ids uuid[]   -- 만들어진 promo_videos 행들(en/kr)
```
### `promo_videos` 확장(본체 마이그, ADD-only)
`job_id uuid` · `lang text` · `scheduled_at timestamptz` · `approved bool default false` · `approved_by uuid` · `approved_at timestamptz`
(video_url/cost_usd/posted_* 는 이미 존재)

### `platform_config` 신규 키(하드코딩 금지)
`promo_monthly_budget_usd`(200) · `promo_budget_warn_usd`(160) · `promo_tier_default`(test) ·
`promo_daily_generation_cap` · `promo_auto_publish_enabled`(false=보관만, OPERATIONS §3 준수) ·
`promo_publish_cadence`(예: `mon,wed,fri@18:00` KST)

### 상태머신 (studio 그대로 본뜸)
`queued →(claim)→ generating(fal 씬) → composing(ffmpeg en+kr) → uploading(Storage) → done`
실패 시 어느 단계든 → `failed` + error_message (+ fal 비용은 환불 개념 없음, 본체 운영비라 cost_log만).

### 승인/발사 게이트 (OPERATIONS §3 "승인 전 보관만" 준수하면서 전자동)
- `promo_auto_publish_enabled=false`(기본): 워커는 ready까지만. 발행은 admin이 영상별 **승인** 후 cron이 예약.
- `=true`(TK가 스위치 ON): ready=자동승인 → cron이 다음 슬롯 자동 예약 발행. **이게 "무인 전자동" 스위치.**

---

## 2. 작업 분담

### 지수(본체, oxxovo) — Vercel
1. `promo_jobs` 테이블 + `promo_videos` 확장 마이그(ADD-only, 멱등).
2. `/admin/promo` "생성 요청" 폼 → `promo_jobs` enqueue (서버액션).
3. `/admin/promo` 잡 진행 표시(queued/generating/composing/…/failed) + 영상 **승인** 버튼.
4. 스케줄러 cron route `app/api/cron/promo-schedule` — 승인+미발행을 cadence 슬롯에 Postiz 예약. (`promo_auto_publish_enabled` 게이트)
5. `platform_config` 키 세팅 + vercel.json cron 1줄 추가(4개 수동 유지).
6. (이미 완료) Storage 버킷·promo_videos·Postiz 발행.

### 지수3(oxxovo-promo, 제니3 경유) — Railway 워커
1. **CLI 툴킷 → 롱러닝 폴러 서비스**로 전환(Python). `worker.py`: `promo_jobs` poll → CAS 클레임(studio worker.ts 그대로 이식) → 상태 전이.
2. 클레임한 잡으로 `generate.py`(fal 씬) → `postprocess.py`(en/kr 합성) **기존 로직 호출**. config_ref/scenes/overlays/tier/langs를 잡에서 주입.
3. 완성 mp4 **Supabase Storage `promo-videos` 업로드**(service_role) → `promo_videos` 행 생성(lang별) + `promo_jobs.produced_video_ids/cost_usd/done`.
4. **Dockerfile**: `python + ffmpeg + 한국어 폰트(Noto Sans KR 등 — config의 malgunbd.ttf는 Windows 전용이라 Linux 폰트로 교체)` + `railway.json`(studio 것 복제, `startCommand: python worker.py`, restart on-failure).
5. 비용 가드 이식: 월 $200/80% 자동중단(config.budget + platform_config) — **생성 전 예상비용 로그**.
6. fal 함정 처리 유지: 9:16→16:9 드리프트 실측 기록, minimax 타임아웃+폴백.

### 계약 경계
- 본체가 `promo_jobs` 스키마 + Storage 버킷 + `promo_videos` 스키마를 **확정·마이그 실행**(이 문서가 계약서).
- 지수3는 그 스키마만 보고 워커를 만든다(본체 코드 의존 0, Supabase service_role로만 통신).

---

## 3. 일정·리스크 + 6/20 판단

### 공수(거칠게)
- 지수(본체): 마이그 + 폼 + 진행UI + 승인 + 스케줄cron + config ≈ **1~2일**.
- 지수3(워커): 툴킷→폴러 + Docker(ffmpeg+KR폰트) + Storage 업로드 + 잡 계약 + 비용가드 이식 ≈ **2~4일 + 반복**.
- TK: Railway 새 서비스 배포 + env + fal 잔액 + E2E ≈ 수시간(지수3 이미지 인도에 게이트).
- 통합 E2E: **1일**.
- 합계 현실치: **크로스세션 조율 포함 ~1주+** → **6/20을 전자동으로 맞추는 건 빡빡/불확실**(워커·Railway·폰트·fal 반복이 변수).

### 리스크
- (높음) 지수3 워커 전환 — 다른 세션(제니3) + Docker/ffmpeg/폰트/Storage 업로드 신규.
- (중) Railway 새 서비스 배포 + env(FAL_KEY/SERVICE_ROLE) — TK 작업, 지수3 이미지 대기.
- (중) fal 신뢰성(9:16 드리프트, minimax 타임아웃) — postprocess가 흡수하나 반복 필요.
- (낮음) Vercel 발행 타임아웃 — 워밍업 클립 작아서 OK(13~15s). 대용량 시 P1에서 워커 발행으로.
- (낮음) 비용 — $200/80% 가드 이식 필수.

### 권고: **디커플 — 워밍업은 안 기다린다**
- **6/20 워밍업 = 오늘 라이브된 반자동 경로**(수동 업로드→Postiz 발행)로 그대로 송출. 워크플로 완성 여부와 무관하게 정시 발행.
- 전자동은 **병렬 트랙**으로 만들고, 워커가 E2E로 검증되면 `promo_auto_publish_enabled` 스위치만 ON → 무인 전환.
- 즉 6/20이 전자동을 막지 않고, 전자동이 6/20을 막지 않는다. (OPERATIONS §3 "승인 전 보관만"과도 정합)

---

## 4. TK 대표님 액션
1. **승인**: 이 설계 + `promo_jobs` 스키마 확정 (확정되면 본체 마이그 + 지수3 인계).
2. **제니3/지수3에 인계**: 이 문서를 oxxovo-promo 워커 작업 지시서로 전달(워커 전환 + Docker + Storage 업로드).
3. **Railway**: oxxovo-promo용 **새 서비스** 생성 + env(`FAL_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `POLL_INTERVAL_MS`, `PROMO_DEV_MODE`). (studio 워커 배포 경험 재사용)
4. **fal 잔액**: Veo 3.1 final 생성분 선불 잔액 확인(test는 저비용).
5. **스위치 결정**: 워커 검증 후 `promo_auto_publish_enabled` ON 시점(= 무인 발사) 승인.
6. (신규 외부 가입/키 **없음** — fal/Supabase/Postiz/Railway 다 기존 보유.)

---

## 부록: 왜 이 구조인가 (대안 기각)
- 합성을 Vercel에서? **불가** — 서버리스에 ffmpeg/장시간/대용량 없음. → Railway 워커 필연.
- 워커를 TS로 재작성? **기각** — postprocess.py의 자막 자동축소·엔드카드·브랜드오디오 믹스는 검증된 자산. Python 그대로 감싼다.
- 발행을 매분 cron으로 드립? **불요** — Postiz 네이티브 예약(scheduledAt)에 위임. cron은 "슬롯 배정"만 가볍게.
- 저장소 R2? **워밍업엔 불요** — 방금 만든 Supabase Storage 공개버킷 재사용(수동·자동 경로 통일). 규모 시 P1 R2.
