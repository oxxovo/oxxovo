# ⑥ 가짜 팀명 화면 규칙 -- 설계안 (2026-08-10, 지수2C)

★설계만. DB 값 교체 = 지수 본체. 문구 = 제니3.

## 근거 (08-08 실측 재확인, `reports/_shots/census.txt`)

`genesis_applications`(`season_id='season_test'`) 41행 중 **정확히 20행**이
`promo_videos`의 R2 키와 **바이트 단위로 동일한 파일**을 쓴다(`content_A01_
fashion_EN_9x16.mp4` 등, 전부 `2026-06-03 21:55:46` 동시 생성, `status=
rejected`) -- OXXOVO 자체 시즌주제 홍보 B-roll을 가짜 참가자 신청(`Runway
Bloom`/`Atelier Nine` 등 20개 가상 스튜디오명)으로 감싼 것. 나머지 21행(→
31 rejected 중 11 + main_round_submitted 10)은 **각자 고유한 별도 파일**이라
promo 자산 재사용이 아니다 -- 팀명이 여전히 가상(`Kiln & Clay` 등)이어도 홍보
영상을 참가작으로 위장한 건 아니다.

## 규칙

`lib/watch.ts`의 `toWatchVideo()`가 `creatorName`/`videoTitle`을 만드는 지점
(:191-192)에서 -- **`videoUrl`의 R2 키가 `promo_videos.video_url`의 R2 키
집합에 있으면** `creatorName`/`videoTitle`을 DB값 대신 오버라이드(정확한 문구는
제니3). 없으면 지금처럼 DB값 그대로.

```
promoKeys: Set<string>  // promo_videos에서 1회 조회한 R2 키 집합
...
creatorName: promoKeys.has(r2KeyOf(videoUrl))
  ? OFFICIAL_PROMO_LABEL   // 제니3 문구
  : (displayName?.trim() || row.creator_name?.trim() || 'Anonymous')
```

★**파일명 패턴(`content_A\d+_..._EN_9x16.mp4`)으로 판별하지 않는다** -- 우연히
같은 명명 규칙을 쓰는 진짜 참가작이 나중에 생기면 오탐이다. **`promo_videos`
테이블 자체를 대조군으로 삼는다** -- 그게 "이게 진짜 홍보영상인가"의 유일한
권위 있는 답이고, `promo_videos`에 새 행이 추가돼도 규칙이 자동으로 따라간다
(하드코딩된 20개 목록이 아니다).

## 왜 이 형태 (⑫와 같음)

DB의 `creator_name`이 `"Atelier Nine"`인 건 사실이고, 그 값 자체를 지우거나
고치는 건 데이터 정정(본체 소관)이다. **화면이 그 값을 참가자에게 보여줄지
말지는 별개 결정**이고, 코드 가드로 세울 수 있다 -- actor slug
(`actor-3-beauty-cf`, 5b절) 때와 같은 형태: "DB 값은 그대로, 렌더링 시점에
막는다."

## 비용

`promo_videos`의 R2 키 집합 조회 1회(93행, 작다) + `toWatchVideo` 호출부에
`Set` 하나 전달. 새 컬럼·마이그 불필요. `season_test`에만 20행 해당(실측),
`season_0`엔 아직 이런 재사용이 없다(별도 확인 필요 -- 시즌 시작 전).

## 안 하는 것 (오늘)

구현 안 함(설계만 지시). 문구(`OFFICIAL_PROMO_LABEL`) 확정 -- 제니3.
`season_0`에도 같은 재사용 패턴이 있는지 실측 -- 필요시 별건.
