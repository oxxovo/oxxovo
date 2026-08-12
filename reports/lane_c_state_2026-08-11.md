# 레인 C 상태 — 2026-08-11 (작성: 지수2C)

★대표님 지시로 휴식. 미커밋 0(앱/워커/레인 A 워크트리 전부). 다음 창은
이 파일 하나만 읽으면 된다.

**한 줄**: 폰트 = 전역 교체 / Pretendard 확정. Geist 죽은 로드 정리도
같이. 그다음 고문 확정본 배선.

---

## 최종 커밋 (전부 push 완료)

| 레포 | 브랜치 | HEAD |
|---|---|---|
| 앱(`oxxovo`) | `feat/studio-lane-c` | `ac5073d` |
| 앱 `main`(2차 재배포 라이브) | `main` | `a8b4f27` |
| 워커(`oxxovo-studio`) | `feat/studio-lane-c` | `ed7945b` |
| 워커 `main`(배포 라이브) | `main` | `e211c14` |

프로덕션(`www.oxxovo.ai`)은 `a8b4f27` 기준으로 떠 있다(`vercel deploy
--prod` 실측 확인, `dpl_Tu6Cg8xGnu86UCjBRA8peJERj5SY`). 공개 게이트
(`SITE_PUBLIC_ENABLED`)는 안 건드림 — 여전히 코밍순.

## 오늘 닫힌 것

① **배포 2회** — 7/13 코드 상태 종료. "배포됨" 기준을 "새 이미지가 실제로
빌드된 것"으로 확정(`deploy_trains_2026-08-06.md`에 기록). 워커→앱 순서,
각 단계 실측 확인 후 진행.
② **한국어 배선 ~300키** — 랜딩+Watch 전체(`lib/admin-i18n.ts`의
`landing`/`watch` 네임스페이스). 배선 중 "이미 한국어로 박혀 있어 토글과
무관하게 항상 뜨던" 20곳 발견, 기존 어휘에 맞춰 지수2C가 영어를 직접
써서 같이 닫음(목록 = `reports/lane_c_watch_selfauthored_en_2026-08-11.md`,
제니3 검수 대기).
③ **한글 OS 폴백 폰트 발견** — "크기 문제"로 보고됐던 것이 실은 Geist가
`subsets:['latin']`만 로드해 한글이 OS 기본 폰트로 그려지던 것. Noto
Sans KR 1차 배선(커밋 `3ab56f4`) → 대표님이 "밸런스 안 맞는다"로 재반려
→ Pretendard vs Noto-전체적용 A/B 측정 착수, **결론 전에 휴식 지시로
중단**. 진행 중이던 실험 코드는 전부 되돌림(미커밋 0 확인용) — 다음
창에서 재실행 필요.
④ **AI 심사 회사명 노출 3곳** — 랜딩 히어로 + `/faq` + `/about`,
전부 `formatAiProviderList` 경유였고 지금 그 함수 자체가 삭제됨(완전
무사용 확인 후).
⑤★ **lutIntensity 블렌드 버그** — `blend=all_mode=normal:all_opacity`가
opacity를 아래쪽(BOTTOM) 입력에 건다는 걸 솔리드 컬러 두 장으로 실측
확인(위쪽이라고 가정했으면 반대로 나갔을 것).
⑥★ **motionBlur 첫 측정 오탐** — `video.currentTime`은 연속 재생 시계라
디코드된 새 프레임이 없어도 값이 계속 바뀜 → 1차 측정에서 "중복 0건"으로
오판할 뻔함. `requestVideoFrameCallback`의 `mediaTime`(진짜 디코드된
프레임에만 붙는 값)으로 다시 재서 실제 결함(rAF가 소스 fps보다 2.47배
자주 틱)을 잡음.

★③⑤⑥ 전부 "측정 도구 자체가 먼저 틀렸다"는 같은 패턴 — 결론 내기 전에
도구를 의심해야 하는 근거로 남긴다.

## 다음 (순서 고정)

1. **폰트 교체** — Pretendard 확정(대표님 승인, A/B 비교 중 중단). 재개
   시: `next/font/local`로 Pretendard(Regular/Bold/Black 최소) 로드,
   body 전체 폰트로(한글+영문 동일 스택), **Geist 죽은 로드도 같이 정리**
   (현재 로드만 되고 `body`엔 한 번도 안 걸림 — 완전 제거할지 결정 필요).
2. **고문 확정본 배선** — 전문은 대표님이 파일로 주심. 확인 필요 3건
   (아래) + 결함 1건 발견됨:
   - ★**결함**: 카운트다운 라벨 확정본 "신청 마감까지"가 오류 — 11/4은
     제출(예선) 마감이고 신청 마감은 10/31. 영어 "Application Closes
     In"도 같은 오류인지 같이 확인 필요.
   - 한국 시간 병기("한국 시간 11월 4일 오후 5시 (11/4 12:00 AM PT)") —
     `formatDeadlinePT`에 `lang` 이미 있으니 이어붙이기 가능할 것,
     구현 시 확인.
   - 확인 3건(제니2 원문): FAQ "OXXOVO가 처음이신가요?" 신규 항목 여부
     제니3 확인 필요 / 스텝01 "15~30초" 누락 의도 확인 / 영어판 동반
     수정 목록 작성.
3. **H(속도 램프) 구현** — 결정 완료(①B 길이고정 ②선형만), 서버·편집기
   동일 규칙으로 사전 차단(클램프/정지프레임 아님) 페어링 필요, 코드
   0줄.

## 참고
`reports/lane_c_deploy_2026-08-11.md`(배포 2회 전체 기록) ·
`reports/deploy_trains_2026-08-06.md`(배포됨 기준) ·
`reports/lane_c_watch_selfauthored_en_2026-08-11.md`(제니3 검수 대상) ·
`reports/lane_c_item4_h_length_model_options_2026-08-10.md`(H 결정 근거)
