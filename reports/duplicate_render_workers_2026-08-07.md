# 렌더 워커가 두 벌 돌고 있다 — 같은 DB·같은 버킷

**2026-08-07 · 지수 본체 · Railway CLI 전수 실측.**
본선 크론 절차서(④ "들어갈 곳")를 본부 지적대로 확인하다 나온 **별건**이다.
내 트랙이 아니라 **보고만 한다 — 끄는 것은 TK님 승인 사항.**

---

## 사실

Railway 프로젝트 4개 전수:

| 프로젝트 | 서비스 | 배포 커밋 | 배포 시각 | 상태 | 마지막 로그 |
|---|---|---|---|---|---|
| `trustworthy-enchantment` | `oxxovo-studio` | `2069b8df` | 2026-08-02 | **RUNNING** | 2026-08-07T23:04Z |
| `just-vibrancy` | `oxxovo-studio` | `0350b513` | 2026-07-31 | **RUNNING** | 2026-08-07T04:48Z |
| `charming-recreation` | `oxxovo-studio` | — | — | CRASHED | — |
| `fulfilling-consideration` | `oxxovo-studio` | — | — | CRASHED | — |
| `trustworthy-enchantment` | `oxxovo-scoring` | — | — | 활성 (`*/5`) | — |

★**둘 다 같은 DB·같은 버킷을 본다.** 값은 화면에 안 띄우고 해시로 비교했다:
`SUPABASE_URL` sha256 앞 16 = `26289c67302f7c61` (동일),
`R2_BUCKET` sha256 앞 16 = `214e69cb01408c5c` (동일).

★**둘 다 오늘 실제로 일을 했다.** 죽은 잔재가 아니다 — 양쪽 로그에 `claimed → composed
→ READY` 가 찍혀 있고, 마지막 활동이 각각 오늘 04:48Z / 23:04Z 다.

| | `just-vibrancy` | `trustworthy-enchantment` |
|---|---|---|
| WORKER_CONCURRENCY | **20** | 10 |
| RENDER_CONCURRENCY | 2 | 4 |
| STUDIO_DEV_MODE | false | false |

---

## 왜 문제인가

### 1. ★7/31 워커는 claim token 수정 **이전** 코드다

`2069b8df`(8/02, `trustworthy`)가 고친 것이 바로 **"멈췄던 레인이 실제로 끝낸
레인의 행을 덮어쓰는"** 사고였다. 그 커밋은 모든 쓰기를 claim token 으로 CAS 하고,
R2 키에 토큰 8자를 섞어 덮어쓰기 자체를 불가능하게 만든다.

`0350b513`(7/31, `just-vibrancy`)에는 **그 방어가 없다.** 이 워커의 쓰기는
토큰을 안 보고 id 로만 쓰고, R2 키도 결정적(deterministic)이다.
→ ★**한 벌이라도 옛 코드가 살아 있으면 8/02 수정이 무력해진다.** 새 워커가 아무리
CAS 를 걸어도 옛 워커는 그 위에 그냥 쓴다.

★이미 징후가 로그에 있다 — 새 워커 쪽에:
```
[render 6d15a20a-...] lease lost (row reclaimed by the sweeper and re-claimed elsewhere)
   -- dropping this attempt, row left untouched
```
"다른 데서 다시 claim 됐다"는 그 "다른 데"의 후보가 지금 둘이다.

### 2. fal 동시성 상한을 넘긴다

fal 계정 상한은 **20**(발사 게이트 기록). 지금 두 워커의 생성 동시성 합은
**20 + 10 = 30** 이다. 상한을 넘으면 429 로 되돌아오고, 그 실패는 참가자에게는
생성 실패로 보인다.

### 3. 요금이 두 배다

상주 폴러 두 벌 + 렌더 레인 2+4. 렌더는 CPU 를 오래 쓰는 쪽이라 무시할 수 없다.

---

## 권고 (실행은 TK님 승인 후)

1. **`just-vibrancy/oxxovo-studio` 를 멈춘다** — 옛 코드 쪽이다. 삭제가 아니라
   먼저 **정지**로 되돌릴 수 있게.
2. 남길 것 = **`trustworthy-enchantment/oxxovo-studio`**(8/02 claim token 포함).
   ★그러면 예선 채점·렌더·본선 채점이 **한 프로젝트**에 모인다.
3. 남은 워커의 동시성을 재확인: `WORKER_CONCURRENCY` 10 이 의도한 값인지
   (fal 상한 20 기준으로 20 까지 올릴 수 있다 — 다만 **한 벌일 때** 이야기다).
4. CRASHED 2 개(`charming-recreation` · `fulfilling-consideration`)는 무해하나
   같은 혼동의 원인이므로 같이 정리.

★**내가 안 하는 이유**: 렌더 워커는 지수2 트랙이고, 서비스 정지는 되돌리기 어려운
운영 행위다. 사실만 확정해 올린다.

관련: `main_round_cron_setup_2026-08-06.md` §4 · [[project-launch-gates]]
