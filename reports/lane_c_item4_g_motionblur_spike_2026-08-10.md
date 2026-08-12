# G — motionBlur GL 프리뷰 스파이크 (측정, 코드 0줄) — 2026-08-10

★스파이크. `reports/lane_c_item4_g_blocked_design_2026-08-10.md`가 제기한
질문("rAF 주사율과 비디오 fps 불일치 시 링버퍼 중복 문제")을 헤드리스
브라우저의 실제 `<video>` + `requestAnimationFrame`으로 직접 쟀다.

## 결론 먼저

**막힌 지점이 실재했고, 고칠 방법도 실재한다.** rAF는 화면 주사율(~60Hz)로
돌고 실제 새 프레임 디코드는 소스 fps(24fps 테스트 클립)로만 온다 —
**rAF 틱이 실제 새 프레임보다 2.47배 더 자주 온다**(실측). 그런데 이건
`requestVideoFrameCallback()`(진짜 새로 디코드된 프레임에만 정확히 1번씩
불리는 표준 브라우저 API)으로 캡처를 걸면 구조적으로 해소된다 — rAF 대신
이걸로 링버퍼를 채우면 중복 캡처가 원천적으로 안 생긴다.

## 측정 (Playwright 헤드리스 Chromium, 24fps 320x240 테스트 클립 3초)

| 방식 | 2초간 횟수 | 환산 fps |
|---|---|---|
| `requestAnimationFrame` 틱 | 121 | 60.5 |
| `requestVideoFrameCallback` 호출 | 49 | 24.5 (소스와 일치) |
| **과다캡처 비율** | | **2.47x** |
| rVFC 내에서 mediaTime 중복 | 0건 | — |

★`video.currentTime`으로 먼저 재봤는데 그건 신호가 아니었다 — 매 rAF마다
연속적으로 증가하는 "재생 시계"라서, 실제 디코드된 픽셀이 안 바뀌어도 값은
계속 다르게 나온다(1차 측정에서 duplicateRate=0으로 나와 오판할 뻔함).
`requestVideoFrameCallback`의 `mediaTime`은 진짜 디코드된 프레임에만
붙는 값이라 이게 맞는 계측기다.

## 설계에 주는 답

- **캡처는 rAF가 아니라 `video.requestVideoFrameCallback()`로 건다.**
  메인 draw 루프(`drawFrameGL`, 매 rAF)와는 **독립적으로** 자기 스스로
  재등록하며 도는 별도 콜백이 링버퍼(FBO N개)를 채우고, draw 루프는 그
  시점에 링버퍼에 든 걸 그냥 읽기만 한다 — 두 루프의 타이밍을 맞출 필요
  없음(링버퍼가 그 차이를 흡수).
- 이 API는 Chromium/Firefox/Safari(15.4+) 전부 지원 — 브라우저 지원 문제
  아님.
- `GLProcessor`는 이미 FBO를 클래스 상태로 들고 있다(glow/transition에
  이미 씀) — 링버퍼 N개(최대 6장, `render.ts`의 `2+round(mb/20)`과 같은
  어휘) 추가는 기존 구조에 자연스럽게 얹힌다, 새 아키텍처 필요 없음.

## 아직 안 잰 것 (다음 단계면 필요)

- 실제 가중평균 셰이더(N장 텍스처 블렌드)와 워커의 `tmix=frames=N` 사이
  신호상대오차 — 이건 배선 실물이 있어야 재는 값이라 스파이크 범위 밖.
- rVFC 콜백의 실제 캡처 비용(FBO N개 유지가 프레임 예산에 주는 영향) —
  이번 클립(320x240)에선 문제 안 됐지만 실제 참가자 해상도(720p)에서
  다시 재야 함.

## 처분

**막힌 지점 해소됨.** 배선 착수 가능 — 단 오늘은 D 편집기 UI가 먼저다
(지시 순서: motionBlur 스파이크 → D 편집기 UI 배선). 실제 구현·파리티
측정은 다음 지시 대기.
