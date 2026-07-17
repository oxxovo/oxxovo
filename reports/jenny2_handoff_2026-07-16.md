# 지수2 인수인계 -- 2026-07-16 (내일 = Stage 3 i2v 착수)

세션 종료 스냅샷. 브랜치 `oxxovo` **feat/studio-budget-guard @ f1bb7e3** /
`oxxovo-studio` **feat/studio-loadtest @ 9a2dc76** (양쪽 origin 동기·clean,
main 미머지). **★배포 순서 제약 유지: session6_enabled=true 전 main 배포 금지.**
Railway 워커 = 9a2dc76 SUCCESS 가동, `gen=20 render=2 devMode=false`.

## 1. 오늘 완결 (마이그 전부 TK Run 완료, 코드 전부 push)

| 트랙 | 내용 | 검증 |
|---|---|---|
| 세션6 블로커 4 | 모델 오디오 전수 실측 -- 7종 플래그 100% 일치, 수정 불요 | `model_audio_audit_2026-07-16.md` |
| Stage 1 | CameraDirector 완성: studio_presets 8종 + user_params + param_whitelist 마이그 / 서버 조립 권위(studio-shared) / 세그먼트+칩+예시 프리뷰+접힌 고급 UI | E2E 32/32 + 실브라우저 |
| 드래프트 풀버전 | draft 4종(turbo/lite-draft/mini/hailuo-std, promotes_to) + 캡 분리(연습30/경기30) + 3중 차단(저해상도+워커 ffmpeg DRAFT 워터마크+서버 draft_not_submittable/source_draft/픽커 숨김) + 승격 폼 프리필 | E2E 20/20 + TK 실사용(워터마크 라이브 확인) |
| 속도 실측 | 11종 동시 발사($5.75): 큐 대기 0초, 동시성 관측 11/11, "59분"=혼잡 변동(같은 veo3.1이 3분). 병목=워커 lane | `studio_generation_speed_2026-07.md` |
| 속도 UX | 완료 알림(탭 배지+브라우저 알림) + 실측 롤링 ETA(최근 20건 중앙값, 표본<3 무표시 -- 정적 라벨 금지) | 실브라우저 정직성 2/2 |
| 워커 | WORKER_CONCURRENCY 10->**20** (fal 상한 20 실확인 후 세팅, 로그 `gen=20` 실측) | 라이브 |

사고 1건 처리: 채팅 SQL 복사 줄바꿈 -> preview_url 8행 CRLF 오염 -> 조용한 실패.
데이터 정정 + 읽기 strip 가드 + E2E에 HEAD 200 단언. 재발 방지 메모리 등록.

## 2. TK 대기 3건

1. **모델 경고 정책** -- 고문 협의 후 지시 (제외는 안 함 확정, active=false 임시 스위치 여지만)
2. **워터마크/배지 문구 최종** -- 현재 "DRAFT" (`DRAFT_WATERMARK_TEXT` env, 코드 0) + "DRAFT · 연습장" 배지 카피
3. **Draft-4 데모 화면 마무리 확인** -- 승격 클립(워터마크 없음+제출 버튼) + 캡 분리 카운터. 승격 잡 e287bb61은 ready 완료 상태라 새로고침이면 보임

## 3. 발사 게이트 (fal 용량 3종 신규 -- 상세 [[project_launch_gates]])

- fal 동시성 60 (현 20/$100 구간, 자동 최대 40, 60은 영업팀) -- 발사 2~4주 전, TK
- fal auto-recharge (크레딧 소진=생성 정지 방지) -- 발사 전 필수, TK Billing
- Railway replica + RENDER_CONCURRENCY 2->4 -- fal 60 확보 후 (렌더 실측 19s/편 n=5, 리허설 재실측)

## 4. 내일 = Stage 3 (i2v) -- TK가 Studio 완성선을 Stage 3까지로 확정

사전 조사 문서: **`reports/studio_stage3_i2v_prep_2026-07.md`** (fal t2i/i2v 조사 +
기존 실험 + CryptoBind 확장 설계 포인트). 요지:
- 기존 실험 물증: `_i2v_charconsist.mjs` -> **Kling v3 pro i2v가 flux photoreal
  키프레임 수용, ICHAR 샷 3편 생성됨**(일관성 판정=TK 육안 대기).
  `_ref30_probe.mjs` v2 -> Seedance ref2vid는 photoreal 거부, 스타일라이즈 OK.
- 코드 착수는 내일 TK 계획 승인 후. 유료 probe도 승인 후.
- Stage 2(멀티프롬프트 스토리보드) 예고: turbo/std multi_prompt는 top-level
  prompt/duration과 **상호배타**(2026-07-16 실측) -> 워커 분기 필요.

## 5. 함정 리마인드 (재발 위험 상위)

- 채팅 SQL 긴 문자열 리터럴 = 복사 줄바꿈 오염 ([[feedback-chat-sql-string-wrap-trap]], Run 후 `col ~ '\s'` 검증)
- PowerShell here-string 커밋 메시지에 **큰따옴표 넣지 말 것** (네이티브 인자 재인용 파손, 2026-07-16 실경험)
- dist/worker.js는 import만 해도 메인 루프 시작 -- 단위 테스트에서 import 금지
- getCurrentSeason()은 env 무시, 지금 season_test 반환
- 얼굴 트랙 로그 `oxxovo-scoring/temp/faceconsist/` + `temp/_face_repeat*` 삭제 금지(지수 본체 몫)

## 6. 정리 상태

- 양 레포 clean·push 완료, dev 서버 종료(:3000 무응답 확인)
- probe 스크립트 전부 워커 레포 커밋(_audio_audit/_param_probe/_draft_probe/_turbo_probe2/_speed_probe)
- 샘플 보존: `oxxovo-studio-samples/` AUDIT_*/DRAFT_*/ICHAR_*/REF30v2_* + stage1_preview_gallery.html
- 오늘 fal 실지출 합계: ~$16 (오디오 3.01 + param 0.50 + draft 4.34 + speed 5.75 + 데모/기타)
