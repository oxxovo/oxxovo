# PR: 매주 시즌 자동화 cron (cron 자동 시즌 #3)

> 브랜치: `feat/weekly-season-cron` · base: `main` · Draft
> 생성 URL: https://github.com/oxxovo/oxxovo/pull/new/feat/weekly-season-cron

매주 월요일 새 시즌을 자동 생성하고 상태를 전이시키는 cron 시스템. 우선순위 2번.
`docs/season-system-assessment.md` §7 task #6 구현, §10 미해결 결정 2건 확정.

> base = `main`. 본선 리더보드 PR과 독립. 머지 시점은 7/27~31 리허설 검증 후 일괄.

## 변경 사항

**신규**
- `lib/season-schedule.ts` — PT 월력→UTC DST-정확 스케줄 계산(순수함수) + 직전 시즌 복제 빌더 + Soak 규칙
- `app/api/cron/season-tick/route.ts` — 시즌 자동 생성(create-ahead) + 상태 전이, 매시 정각(`0 * * * *`)
- `lib/email/admin-alert.ts` — 백그라운드 잡용 Resend 관리자 알림(생성 성공/에러)

**수정**
- `lib/seasons.ts` — `getCurrentSeason()` 빌드타임 env 핀 → **DB 시간 윈도우 기반** 동적 해석 (🔴 핵심 블로커 해소)
- `app/api/apply/route.ts` — 동기 `getCurrentSeasonId()` 제거, async 해석
- `vercel.json` — `season-tick` cron 등록 (현재 2/40)
- `docs/season-system-assessment.md` — §11 구현 기록 + §10 결정 확정

## 핵심 설계 결정

- **블로커 — "현재 시즌" 포인터:** env `NEXT_PUBLIC_OXXOVO_CURRENT_SEASON` 고정 → 매주 회전 시 재배포 없이는 시즌이 안 넘어감. env 의존 완전 제거, `application_open_at <= now` 최신 개막 시즌을 동적 해석(미개막 시 예정 시즌 폴백). 소비처 6곳 전부 이미 async라 drop-in.
- **create-ahead:** 현재 시즌 개막 시 다음 주 시즌을 `draft`로 미리 생성 → 항상 1개 앞섬(코드네임/`main_round_theme` 설정 리드타임 1주), 월 00:00 PT에 `active` 자동 전이.
- **멱등성:** `id = season_<n>` 결정적 PK로 중복 차단, `unique_violation`(23505)은 정상 skip, 상태 전이는 `.eq('status', old)` compare-and-swap.
- **상태 전이 = 타임스탬프 기반(§10 결정):** enum `draft/active/closed/completed` 유지(미확장), forward-only(역행·admin 수동편집 비간섭). email-tick과 정합.
- **vote weight default = platform_config(2026-06-07 정책 변경):** 옛 Soak 일정(`season_number>=4 → 0.7, <4 → 0`) **폐기**. 새 정책 = 시즌0만 0(시드 행 데이터값), 시즌1+ 전부 0.7. cron은 `platform_config.default_community_vote_weight`(0.70)를 읽어 모든 자동생성 시즌에 적용, `ai_score_weight = 1 - community` 파생. **per-시즌 분기 코드 0**(시즌0 특별처리 없음 — 0은 시드 행의 데이터값일 뿐). 마이그레이션: `reports/seasons_weight_policy_2026-06.sql`(TK 실행). `DEFAULT_SEASON` 템플릿 미변경.
- **DST:** Luxon `America/Los_Angeles`. 앵커 +1주(in-zone)로 다음 개막 산출. UTC-7 하드코딩 없음.
- **옥소보 원칙:** per-시즌 분기 0, 모든 차이는 복제된 seasons 행, 컬럼 ADD-only(신규 마이그레이션 없음).

## 검증 포인트 (실측 완료)

- ✅ `next build` 통과 (`/api/cron/season-tick` dynamic route 등록 확인), `.next` clean 후 재빌드
- ✅ DST 경계: 가을(10/26 개막→11/1 PST 전환)·봄(3/2 개막→3/8 PDT 전환) 월력 시각 정확 유지, 멱등 앵커 체인 -7→-8 전환 정확
- ✅ 빌더: generated 컬럼 제외 / 모든 자동생성 시즌 community=0.7·ai=0.3(platform_config 주입, 분기 없음) / 복제 파라미터 유지 / 개막 8/10 07:00 UTC
- ✅ lint: 신규 5개 파일 0 에러
- ✅ 오늘(6/5) 시점 cron 실행 시 season_0 개막(8/3)이 미래라 생성·전이 모두 **no-op = 안전**

## 잔여 의존성 — ✅ 모두 해결

- ✅ `scoring_start_at` 컬럼 live DB 적용 확인 (TK)
- ✅ `CRON_SECRET` prod 환경변수 확인 (TK, email-tick과 공유)
- ✅ Vercel cron slot 확인 (2/40, Pro 안전)

→ cron 작동 인프라 100% 준비.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
