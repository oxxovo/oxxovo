# 100-track manifest v1 — cell assignment (2026-08-10, 지수2C)

작업 공간: 워커 `C:\Users\Tom\oxxovo-studio-lane-c` (`main`, `1154c06`). 산출물:
`oxxovo-studio-lane-c/tracks/batch-100-v1.json` (미커밋, 아래 커밋 예정).

전제: `lane_c_music_100track_manifest_design_2026-08-09.md`(설계) + 제니2 2026-08-10 확정 그리드.

---

## 1. 겹침 정정 반영

제니2 판단대로 B②(`cinematic x dark`)를 뺐다 — C가 이미 그 칸을 20곡 갖고 있어
B의 4곡은 같은 정보를 두 번 사는 것이었다. **B② 4자리는 비워 뒀다**(genre/mood
필드 자체를 생략, 가짜 값 없음). 어느 칸으로 채울지는 제니3 답 대기.

## 2. 확정분 96곡 — id·genre·mood·bpm 배정, 실측 검증

| 그룹 | 칸 | 곡/칸 | 합 |
|---|---|---|---|
| A | 10칸 (제니2 확정 리스트) | 4 | 40 |
| C | `cinematic x bright` · `cinematic x dark` | 20 | 40 |
| B | ①③④⑤ 4칸 (②만 보류) | 4 | 16 |
| B②(보류) | — | 4자리 | 0/4 |

id 스킴: `lib100_<a|b|c><칸번호2자리>_<트랙번호2자리>` (예 `lib100_a01_03`).
file: `./audio/<id>.m4a` — **아직 실제 오디오 없음**. 이건 생성물 전달 시 지켜야
할 파일명 계약이지, 지금 존재하는 파일이 아니다(아래 4절).

bpm은 설계 문서 §3의 "요청 bpm을 세 버킷에 퍼뜨린다(slow 30/mid 35/fast 35)"를
가중 라운드로빈으로 구현 — 칸 순서와 무관하게 고르게 섞이도록. 실측(96곡 기준):

```
slow(<90) 29 · mid(90-119) 34 · fast(>=120) 33
```

★**"실측"이라고 부르는 이유**: 스크립트 계산값을 문서에 옮겨 적지 않았다.
`src/music-library.ts`의 **실제 `parseManifest` + 라이브 `assets/music-grid.json`**에
완성된 매니페스트를 통과시켜 확인했다:

```
parseManifest OK -- 100 tracks
missing genre/mood/bpm: { genre: 4, mood: 4, bpm: 4 }   <- B②만
bpm buckets: slow 29 mid 34 fast 33 (total 96)
```

genre·mood 10개 조합 전부 실제 그리드 어휘와 대조 통과(오타 없음), id 100개 중복 0,
bpm 전부 0..400 범위 내(스키마 그대로 통과).

## 3. `_status`가 하는 일 — 이 파일은 아직 로드용이 아니다

`batch-100-v1.json` 최상단에 `_status` 필드로 적어 뒀다: `provider`/`providerModel`은
`PENDING-*` 문자열, `license: {}` — 둘 다 내 소관이 아니다(대표님/고문). 이 상태로
`npm run seed:music:batch`를 실제로 돌리면 **`classifyBatch`가 라이선스를 분류 못 해
즉시 throw** — 업로드도 쓰기도 0건, 시끄럽게 막힌다(설계상 의도, 파일 자체가
가드다). `parseManifest` 검증은 그 앞 단계라 라이선스 없이도 통과한다.

## 4. 실제 생성 전 — 내가 못 하는 것과 다음 필요한 것

★**100곡 실제 생성(프롬프트·공급자)은 여전히 내 소관 밖**이다. 이 매니페스트는
"무엇을 몇 개 만들어서 어떤 파일명으로 넣을지"의 계약이지, 오디오 자체가 아니다.
필요한 것 순서대로:

1. **B② 칸** — 제니3 답
2. **라이선스 조건 전사** — 대표님/고문, `license` 필드
3. **실제 오디오 96(+4)곡** — 대표님/본부/공급자. `tracks/batch-100-v1.json`의
   `file` 경로 그대로 떨어뜨리면(예: `oxxovo-studio-lane-c/tracks/audio/lib100_a01_01.m4a`)
   ②③④가 이어서 붙는다.

셋 다 오면: `npm run screen:music` → 점수 전사 → `MUSIC_DRY_RUN=1` → 실적재
(설계 문서 §4, 순서 그대로).

## 5. 안 한 것

- `screen:music` 실행 — 실제 오디오가 없어서 돌릴 수 없다(측정 대상이 없다).
- `seed:music:batch` 실행(dry나 실적재나) — 라이선스 미확정이라 의도적으로 막힌
  상태를 유지했다. 억지로 통과시키려고 가짜 라이선스를 채우지 않았다.
- bpm 값 자체의 음악적 타당성(예: `piano x energetic`에 150bpm이 실제로 말이
  되는지)은 검토하지 않았다 — 그건 프롬프트를 쓰는 사람의 판단이고, 여기 배정은
  "세 버킷에 퍼뜨린다"는 측정 목적을 채우는 것이 전부다.
