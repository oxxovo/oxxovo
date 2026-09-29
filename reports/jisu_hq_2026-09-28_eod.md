# 지수(본체) EOD — 2026-09-28

이전: `reports/jisu_hq_2026-09-27_eod.md`(Phase 0 배포 + node_modules 사고 +
Daily News 실측, 09-27). 오늘은 그 트랙 이어가는 개발 작업이 아니라 — TK
랩탑에 문제가 생겨 **PC 교체 대비 백업**을 하루 종일 진행했다. 코드 변경·배포·
DB 쓰기 전부 없음.

## ★★★최종요약 — 다음 세션은 이 절만 읽고 재개

오늘 순서: **(1) 전 레포 git status·미커밋 확인 → (2) 백업 브랜치 5개 커밋
(그 중 oxxovo는 `outputs/` 2.2GB가 실수로 딸려 들어간 것을 push 직전에 발견,
되돌리고 재커밋) → (3) TK 승인 후 5개 전부 push → (4) zip 백업 생성(572MB,
.env 포함) → (5) oxxovo-promo 대용량 산출물의 R2 커버리지 실측(11%만 일치) →
(6) 브랜치 원복 → (7) TK 지시로 scoring/temp 5.7GB 삭제 → (8) 정리·EOD(이 파일)**.

**1) Phase 0 배포 (`39dc33b`)** — 어제 배포 후 오늘 추가 이슈 보고 없음. 상세는
`reports/jisu_hq_2026-09-27_eod.md` 참고.

**2) Daily News 실측** — 어제 읽기 전용 조사 완료(요약: `oxxovo-promo/
make_news_ski.py`가 무음 배경 소재만 생성, 립싱크·자막은 기획실 2040이 별도
작업). 오늘 추가 조사 없음. Phase 1(Daily News를 Watch에 붙이는 작업)은
설계 확정 상태로 **새 PC 준비 후, 실측 3건을 거쳐 착수** — 지금은 전부 HOLD.

**3) node_modules 사고 · 원인 · 재발방지** — 어제 배포 워크트리에서
`node_modules`를 junction으로 연결했다가 `git worktree remove --force`가
정션을 따라가 메인 저장소 `node_modules`를 통째로 삭제한 사고. 원인: 무거운
작업(재설치)을 피하려는 최적화가 오히려 위험을 키움. **재발방지: 배포
워크트리에서 node_modules를 junction/symlink로 걸지 않는다.** (오늘 백업
작업 중에도 이 교훈을 의식하고 모든 워크트리 조작 전에 `git worktree list`로
공유 상태를 먼저 확인함.)

**4) PC 교체 대비 백업 (오늘의 실제 작업)**
- 전 레포 git status 확인: oxxovo 158 · oxxovo-scoring 76 · oxxovo-promo 31 ·
  oxxovo-studio 2 · oxxovo-theme-wt 2 건 미커밋. oxxovo-lane-c/
  oxxovo-studio-lane-c/triptiptip은 clean.
- 백업 브랜치 커밋 + push 완료(5개 — 아래 표는 `new_pc_setup.md` 인계
  메모 참고).
- **사고 방지**: oxxovo에서 `git add -A`가 gitignore 안 된 `outputs/`(2.2GB
  렌더링 산출물)를 그대로 쓸어담아 push가 10분 넘게 멈춤 → push 완료 전에
  발견·중단·재커밋. GitHub에는 올라가지 않음.
- zip 백업(`C:\Users\Tom\oxxovo_backup_2026-09-28.zip`, 572MB) 생성 —
  node_modules/.next/.git/대용량 미디어 제외, `.env` 전부 포함(zip은 TK만
  보관, git에는 안 올림).
- oxxovo-promo의 clips/output/temp_work(대용량 작업본) — R2(`oxxovo-studio`
  버킷) 대조 결과 파일명 기준 11%(249/2234)만 일치. 나머지는 **제니3가 별도
  백업 진행 중, 본부는 손대지 않음(TK 지시)**.
- oxxovo-scoring/temp(5.7GB, 스코어링 파일럿 프레임 캐시) — TK 지시로 삭제
  완료.
- oxxovo/outputs(2.2GB) — TK가 "버려도 된다"고 확인했으나 오늘 실제 삭제는
  안 함(이번 정리 지시에 재확인 안 돼서 보수적으로 보류) — 다음 세션 확인
  필요 항목으로 기록.

## 기술 부채 목록 (기록만, 손 안 댐 — 09-27 EOD에서 이월 + 오늘 추가분)

1~7번은 `reports/jisu_hq_2026-09-27_eod.md`의 기술 부채 목록 그대로 유효
(robots.ts 게이트 스코프, platform_config value_type 오류, e2e 주석 날짜
불일치, competition_publication SQL 미실행, 챗봇 KB 문구, getCurrentSeason
tie-break 미검증, Daily News RIN draft 상태).

8. (오늘 추가) `oxxovo/outputs/`(2.2GB) — 폐기 승인은 났으나 실제 삭제 여부
   미확정. 다음에 확인·정리 필요.
9. (오늘 추가) `oxxovo-promo` 대용량 작업본(clips/output/temp_work) 중 R2
   미커버 89% — 제니3 백업 완료 여부 확인 필요(본부 트랙 아님, 상태만 추적).

## 오늘의 반례/실패 기록

`git add -A`는 `.gitignore`를 지키지만, **gitignore에 없는데 그냥 안 쓰던
untracked 대용량 폴더**(oxxovo의 `outputs/`)까지 그대로 담는다는 걸 다시
확인. 어제 node_modules 사고(무거운 작업 피하려다 사고)와는 반대로, 오늘은
"한 번에 다 담아라"는 지시를 문자 그대로 따르려다 실수할 뻔함 — **일괄
작업 지시라도 `git status`/`du`로 뭐가 얼마나 딸려오는지 확인 후 커밋하는
습관이 필요**.

## 다음 세션 이어갈 점 (한 줄)

**새 PC 셋업 완료 후, `C:\Users\Tom\new_pc_setup.md`의 인계 메모대로 백업
브랜치 5개를 받아 미커밋 작업을 복구한다. Phase 1(Daily News→Watch)은
설계 확정 상태로 대기 중 — 실측 3건 끝나야 구현 착수, 그 전까지 전부 HOLD.**
