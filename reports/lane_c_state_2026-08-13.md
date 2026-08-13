# 레인 C 상태 — 2026-08-13 (작성: 지수2C)

★대표님 지시로 종료. 미커밋 0(앱/워커 둘 다). 다음 창은 이 파일 하나만
읽으면 된다. (`reports/lane_c_state_2026-08-11.md`는 이 파일로 대체됨.)

**한 줄**: `37c7f8f` 미배포. **`main_round_twist`가 DB에 null이라 값
입력이 선행** — 대표님이 넣으신 뒤 배포.

## 최종 커밋

| 레포 | 브랜치 | HEAD | 상태 |
|---|---|---|---|
| 앱(`oxxovo`) | `feat/studio-lane-c`/`main` | `37c7f8f` | 미배포(프로덕션은 `dpl_4r7fxujL9aTXEiWjjkiH6EagKJ23`, builtAt 2026-08-13T05:07:50Z까지만) |
| 워커(`oxxovo-studio`) | `feat/studio-lane-c`/`main` | `71dabc7` | 배포됨(Railway 자동배포, H 전체 포함) |

## 오늘 닫힌 것 (대표님 기록 지시)

① **H(속도 램프) 6단계 전부 완료** — 수학 코어·서명 계층(KAT+TAMPER)·
워커 렌더링·GL 프리뷰·서버 게이트·편집기 UI. 골든 6개 전부 안 움직임
(cross-repo KAT 최종 재확인, `GOLDEN_SR_HASH` 1개만 신규 추가).
② ★조합 버그: `segOutSec()`(전환 offset 계산, H 이전부터 있던 함수)이
speedRamp를 몰라서 static speed와 speedRamp가 같은 세그먼트에 공존할 때
잘못된 길이를 계산 — 단독 측정으론 영영 안 보이는 종류, ③ 램프+전환
조합 검증에서 실제로 잡음(`c990580`, worker).
③ 오디오 무음→리타이밍 전환. `deriveSourceToDisplayTrack`의 구간을
재사용해 로컬 평균속도로 `atempo`(피치 보존) → concat(`0406aea`, worker).
④ 배포 3회, 7/13 코드 상태 종료. "앱은 머지≠배포 / 워커는 머지=배포"를
`railway_deploy_guide_oxxovo_studio.md`에 박음. 3차 배포는 잘못된
Vercel 프로젝트(`oxxovo-lane-c` 스트레이)로 첫 시도 실패 → 실제
프로덕션은 안 건드려짐 확인 후 `.vercel/project.json` 교정, 재시도 성공.
⑤ 한글이 OS 폴백 폰트로 그려지던 것 — "크기 문제"가 실은 폰트 문제,
Pretendard 전역 교체로 해결(`9fcfd98`).
⑥ 한글에 실제 이탤릭 페이스가 없어 브라우저 합성 이탤릭이 자소를
뭉갬 — 히어로 서브카피(대표님 4옵션 중 옵션2 확정, `0458543`) +
`/studio` 트위스트 라벨(`9424ff4`) 수정.
⑦★ "주제" 줄에 본선 값을 넣는 분기 자체가 코드에 없었음 — 11/8에 주제가
공개돼도 스튜디오는 계속 "미정"으로 남을 뻔했던 결함. 제니3가 화면
라벨("트위스트"→"필수 조건") 용어를 확정하려다 실측 요청한 데서 발견.
⑧ 게이트 통일 — Studio를 `round==='main'`(11/9, 더 늦음)이 아니라 Watch가
이미 쓰는 `isMainThemeRevealed`(결선 진출자 확정 시점, 더 이름)로
맞춤. 안 그랬으면 ⑦과 같은 종류의 결함이 한 단계 앞에서 재발했을 것
(`37c7f8f`).

## 내일 (순서 고정)

1. **`main_round_twist` 값 입력**(대표님) — 확정 문구: KR "얼굴에 로션을
   바르는 장면" / EN "A scene applying lotion to the face". `/admin/seasons`
   편집 화면으로 넣으실지, 제가 UPDATE SQL 드릴지 다음 창에서 확인.
2. **앱 배포**(`37c7f8f`, 위 값 입력 뒤) — H 전체 + 폰트/i18n + ①~⑧ 전부
   같이 나감. 배포 전 `.vercel/project.json` 대조 잊지 말 것(3차 배포
   때 실측으로 걸린 함정, `lane_c_deploy_2026-08-11.md` §5 참조).

## 대기 (날짜는 대표님)

- Soundverse 음악 라이선스 회신
- 1,000곡 적재
- 리허설

## 참고
`lane_c_deploy_2026-08-11.md`(배포 4회 전체 기록, §5/§6이 이번 배포들) ·
`railway_deploy_guide_oxxovo_studio.md`(배포 자동화 레포별 차이) ·
`lane_c_item_h_ui_design_2026-08-12.md`(H UI 설계, 구현 완료 표시됨)
