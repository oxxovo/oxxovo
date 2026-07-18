# 지수2 인수인계 -- 2026-07-18 (내일 = Stage 3 2.5 UI)

세션 종료 스냅샷. 양 레포 clean·origin 동기·미push 0. dev 서버 없음(:3000 무응답).
`oxxovo` **feat/studio-budget-guard @ f12f79e** / `oxxovo-studio` **feat/studio-loadtest @ 7f043da**.
**★배포 제약 유지: session6_enabled=true 전 main 배포 금지. 이미지/i2v 모델 active=false(2.5 UI 후 켬).**

## 1. 오늘 완결 -- Stage 3 크립토 뿌리부터 서버까지 하루에 완성

| 단계 | 내용 | 검증 |
|---|---|---|
| **2.1 마이그** | 캐릭터 라이브러리 테이블 + 이미지 media_type + 드래프트 이미지 티어 + 이미지캡 + 카탈로그 3행(active=false) | **TK Run 완료 + 검증 5개 통과** (`studio_stage3_i2v_migration_2026-07.sql`) |
| **2.2 크립토 v1i** | v1i/v1ic/v1v 양레포 byte-mirror + 제출 검증체인 설계 | **변조거부 8/8** + 크로스레포 KAT(동일 서명hex) |
| **2.3 워커** | generateImage + multi_prompt 분기 + processImageJob(v1ic·images/R2) + i2v_input 신뢰병합 | tsc0, 기존잡 도먼트(무영향) |
| **2.4 서버** | createImageGeneration + 캐릭터 라이브러리 CRUD + createI2vGeneration + ★submitRender 검증체인 | **회귀 16/16** (parent-less 기존경로·parent로더 미호출 + i2v변조5) |
| **프로 편집기** | 3-pane DaVinci 셸 + 인터랙티브 단일트랙 타임라인 + 미디어풀 가상화(120클립 윈도잉) | tsc0, 순수프론트 |

**크레딧 계산 확정**: 이미지=`cost_per_second_usd`(per-image, draft 0.08/정식 0.15) → creditsForCost(video와 동일 마진) / i2v=`cost×duration`(Kling 0.168/s). charge/rollback/실패환불 기존 재사용.

## 2. 커밋 해시 (오늘)
- **MAIN** (feat/studio-budget-guard): 0c16976 probe결과 / 1d53f8c 2단계계획 / 6be4708 프로셸A / 1a60ca8 프로B / 2583663 2.1마이그 / fd0745d v1i설계 / **554f239 2.2크립토** / a93df80 가상화 / **6ad2fd6 2.4 parts1-3** / **f12f79e 2.4 part4**
- **WORKER** (feat/studio-loadtest): a8099ae probe스크립트 / **b15be37 2.2크립토미러** / **7f043da 2.3워커**
- CI 신규: 양 레포 `.github/workflows/tests.yml`(push마다 크립토+회귀 자동, 기존 CI 0였음). `npm run test:crypto`.

## 3. 미머지 브랜치 상태
- feat/studio-budget-guard / feat/studio-loadtest 둘 다 **main 미머지**(session6 게이트). 이미지/i2v 모델·엔드포인트 코드 라이브하나 **전부 도먼트**: 모델 active=false + UI 미배선 + session6 OFF. 기존 비디오/compose 경로 완전 무영향(회귀 테스트로 증명).

## 4. TK 대기 (내일 논의)
1. **★2.5 UI 구성안 검토** -- 초안 `reports/studio_stage3_ui_2.5_draft_2026-07.md`(오늘 작성). 코드 착수는 승인 후.
2. **AI 배우 이름** -- KIRA / SUNNY 후보, **미확정**. (probe 배우=화장품 CF 동양 여성, R2 stage3_probe/)
3. **모델 경고 정책** -- 고문 협의 후 지시 (제외 안 함 확정, active=false 임시스위치 여지) [기존 대기]
4. **워터마크/배지 문구 최종** -- 현재 "DRAFT" (DRAFT_WATERMARK_TEXT env) [기존 대기]

## 5. 발사 게이트 (Stage 3와 별개, 발사 전 TK)
- fal 동시성 60 (현 20/$100, 자동 최대40, 60은 영업팀) -- 발사 2~4주 전
- fal auto-recharge (크레딧 소진=생성정지 방지) -- 발사 전 필수, Billing
- Railway replica + RENDER_CONCURRENCY 2->4 -- fal 60 확보 후
- 보안 종합점검 (STUDIO_CRYPTOBIND_SECRET Vercel 세팅 확인 + 시크릿 화면출력 금지 유지)
- **Stage 3 발사 전 유료 probe 잔여**(필요시만 소액승인): Ideogram 드리프트→flux-pulid ~$2 / Kling i2v 드래프트형제 ~$1

## 6. 내일 재개 순서
2.5 UI 구성안 TK 승인 → 코드 착수(캐릭터시트 생성→라이브러리→i2v샷, 보라톤, Watch·ComposeEditor 불변) → 2.6 크로스레포 E2E(DB→워커→R2→v1i체인→제출). 병렬 프로편집기 다음=타임라인 줌/스크롤.

## 7. 함정 리마인드
- getCurrentSeason()은 env 무시, 지금 season_test 반환 ([[project_jenny2_resume_2026-07-15]])
- 채팅 SQL 긴 문자열 CRLF 오염 ([[feedback_chat_sql_string_wrap_trap]]) / SQL ASCII-only ([[feedback_sql_ascii_only]])
- PowerShell here-string 커밋메시지에 큰따옴표 금지
- dist/worker.js는 import만 해도 메인루프 시작 -- 테스트서 import 금지(그래서 크립토만 분리 테스트)
- 얼굴 트랙 로그 `oxxovo-scoring/temp/faceconsist/` 삭제 금지(지수 본체 몫)
