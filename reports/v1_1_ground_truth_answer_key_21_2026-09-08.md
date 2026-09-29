# Ground-Truth 21편 정답지 (2026-09-08 초안 → 2026-09-09 3상태 갱신) — 확정본

본부 지시(2026-09-09, 고문 판정): 정답지를 **3상태**로 바꾼다. "결함 없다고 믿는다"가
아니라 "NEGATIVE로 검증된 것만 FP 계산에 쓴다"가 원칙이다.

★★09-09 3차 개정(고문 확정, "8칸+Tier+병렬" 메시지 ①②) — **스키마가 10칸에서
바뀌었다.** audiovisualSync는 **완전 삭제**(판정관 프롬프트에서도 뺐다 — "우리는
audio를 안 넣는다, 보지도 못하는 것을 시험에 넣을 이유가 없다"). otherArtifacts는
계속 판정관에게 묻지만 **Recall/FP 채점 분모에서는 제외**(캐치올이라 P/N 정답을
못 만든다 — 기록용으로만 남긴다). 기계판독 정답지는
`oxxovo-scoring/_gt21_answer_key_2026-09-09.ts`의 `ALL_CATS`(9, 기록용)/
`SCORED_CATS`(8, 채점대상)로 이미 반영 완료. 아래 개별 클립 표(10칸, AV 포함)는
09-09 2차 검수 당시 기록을 그대로 보존한 **이력 자료**이며, 채점 대상은 이제
8칸이다 — AV 열은 무시할 것. 채점 대상 8칸은 다시 두 Tier로 나뉜다(우선순위
판단용, 정의 자체는 안 바뀜):
- **Tier A**(Positive 목표 8~10편) — faceIdentity · objectConsistency · motion · continuity
- **Tier B**(Positive 4~5편으로 충분) — anatomy · background · lighting · editing
"모든 칸에 기계적으로 5개를 맞추지 마라"가 원칙 — Phase 2 fixture 제작 우선순위는
Tier A를 먼저 채운다.

## 3상태 정의

- **POSITIVE** — 결함이 있다고 확실히 검증됨(설계된 결함, 육안 확인됨). Recall 계산에 씀.
- **NEGATIVE** — 없다고 확실히 검증됨(육안으로 명시 확인했거나, 구조적으로 불가능하거나,
  제작 방식상 100% 보장됨). **False Positive 계산에 씀.**
- **UNVERIFIED** — 확인 못 함. **통계(Recall도 FP도)에서 제외.** 확인 안 된 칸을 CLEAN/
  NEGATIVE로 채우지 않는다 — GT11이 정확히 이 실수였다: "조명 하나"인 줄 알았는데
  실제로는 인물 교체(cf_03 18초 지점, 완전히 다른 사람)와 캡션까지 섞여 있었다. 그때
  나머지 7칸을 전부 CLEAN이라고 적었다면 거짓 정답이 됐을 것이다.

## 10칸 (v1.2 기준)

faceIdentity(FI) · anatomy(AN) · objectConsistency(OC) · motion(MO) · background(BG) ·
lighting(LI) · continuity(CO) · editing(ED) · otherArtifacts(OA) · audiovisualSync(AV)

## 보편 규칙 — audiovisualSync은 전 21편 NEGATIVE

이 하니스는 프레임만 뽑고 오디오 트랙 자체를 안 만든다(전부 `-an`으로 인코딩,
실측: `ffprobe`로 오디오 스트림 0개 확인 가능). v1.2 audiovisualSync 정의문 자체가
"오디오 트랙이 없으면 NONE OBSERVED"를 못박았으므로, **정답은 제작 방식으로
100% 보장된 NEGATIVE**다 — 이건 "안 봤지만 없다고 믿는" UNVERIFIED가 아니라
"입력 자체를 통제해서 확실히 없앤" 진짜 NEGATIVE다. 아래 표에서 AV 열은
전부 NEGATIVE로 생략 없이 표기한다.

## 근거 등급 (각 셀 옆에 표기)

- `[육안]` — 오늘(09-08/09-09) 방법론(scdet 0.08 + 8~10프레임)으로 그 카테고리를
  구체적으로 들여다보고 확인함.
- `[구조]` — 화면에 사람/구분되는 배경 등 그 결함이 성립할 대상 자체가 없어
  논리적으로 불가능함.
- `[설계]` — 그 결함을 의도적으로 심은 지점(제작 스펙 자체가 근거).
- `[제작]` — 제작 방식(오디오 미포함 등)으로 원천 보장됨.
- 근거 없음 = UNVERIFIED.

---

## GT01_clean_a — demo_artisan, 15초 (CLEAN-ALL 후보) — ★09-09 10/10 확정(9P/N+1U)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` 얼굴 일관 확인(4프레임) | NEGATIVE `[육안]` 손가락 개수·비율 정상 | NEGATIVE `[육안]` 1fps 15프레임 전수 확인, 이상 없음 | NEGATIVE `[육안]` scdet 1건(9.96초)은 카메라 모션블러로 확인, 실컷 아님 | NEGATIVE `[육안]` 배경(선반 도자기) 안정 | NEGATIVE `[육안]` 톤 일정 | NEGATIVE `[육안]` 불연속 없음 | NEGATIVE `[육안+scdet]` 컷 0건 | NEGATIVE `[육안]` 텍스처 이상 없음 | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재 확인(AAC), sync 여부는 듣기능력 없어 미확인 |

## GT02_clean_b — A02_fabric, 15초 (CLEAN-ALL 후보) — ★09-09 9/10 확정(1 POSITIVE 신규)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[구조]` 사람 없음 | NEGATIVE `[구조]` 손 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[구조]` 구분되는 배경 없음(직물이 프레임 전체) | NEGATIVE `[육안]` 색온도 일정 확인 | NEGATIVE `[구조]` 장면 전환 없음 | NEGATIVE `[육안+scdet]` 컷 0건 | **POSITIVE** `[육안]` 09-09 신규발견 -- 14.3~14.8초 직물 주름 사이에 창백하고 기하학적으로 이질적인 핀/실 형태 돌기(0.5초+ 지속, 단발 플리커 아님) | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재, sync 미확인 |

## GT03_clean_c — A05_plating (실제 15.0초, 문서상 19초는 오기) — ★09-09 9/10 확정, CLEAN 판정 반전(3 POSITIVE)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` 얼굴 일관 | NEGATIVE `[육안]` 이상 없음 | **POSITIVE** `[육안+scdet]` 8.0초에 완전히 다른 두 클립 접합(가리비 요리 흰 접시 → 슬라이스 고기 요리 어두운 슬레이트 접시), GOP 경계와 정확히 일치하는 scdet 키프레임+직접 비교로 확인 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | **POSITIVE** `[육안]` OC와 동일 접합점(8.0초), 요리·장소 완전 불연속 | **POSITIVE** `[육안+scdet]` 8.0초 강제 절단 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재(GT04와 동일 값 -- 공용 배경음 추정), sync 미확인 |

★09-09 전면 재스윕 결과: "CLEAN-ALL 후보"라는 기존 전제 자체가 틀렸다 -- 이 클립은
사실 완전히 다른 두 원본이 8초 지점에서 강제 접합된 클립이다(GT04/06/12/13류의
편집 결함 클립과 같은 부류). 파일 길이도 문서상 19초가 아니라 실제 15.000000초로
확인됨.

## GT04_face1 — A07[0:7)+A08[7:15) 접합 — ★09-09 9/10 확정(CO/ED 신규 POSITIVE)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| POSITIVE `[설계, 근거 정정]` 0:07 접합점 -- 실제로는 "서로 다른 두 사람"이 아니라 2번째 세그먼트(7~15초)에 사람/얼굴 자체가 아예 없음(16프레임 확인) | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | **POSITIVE** `[육안]` 09-09 신규: FI와 동일 0:07 접합점, 장소·상황 완전 불연속 | **POSITIVE** `[scdet]` 09-09 신규: 0:07 정확히 키프레임 강제절단 확인 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재, sync 미확인 |

## GT05_face2 — cf_04[0:5)+cf_05[0:5) 접합 (★09-09 재제작, cf_01/02 오염으로 교체) — ★09-09 9/10 확정

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| POSITIVE `[설계+육안]` 0:05 접합점, 서로 다른 두 사람(브랜딩·캡션 없음 재확인) | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED 모션블러로 손가락 단위 확인 불가 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | **POSITIVE** `[육안]` 09-09 신규: FI와 별개로 접합점에서 장소·상황 불연속 | **POSITIVE** `[scdet]` 09-09 신규: 0:05 정확히 강제절단 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[구조]` 09-09 재제작분, ffprobe로 오디오 스트림 0개 실측 확인(GT19~21과 같은 배치) |

## GT06_face3 — A07[0:6)+A11_night[6:15) 접합, 거친 컷 — ★09-09 8/10 확정, FI 하향 반전(본부 검토 필요)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| **UNVERIFIED** `[09-09 하향, ⚠️본부검토]` 설계문서-실파일 불일치 발견 -- 실제로는 "두 사람 얼굴 교체"가 아니라 OXXOVO 광고 접합(요리 장면→야간 주행 장면, 둘 다 자막 삽입됨)이고, 2번째 세그먼트엔 사람 얼굴 자체가 없어 얼굴 대 얼굴 비교가 불가능 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | **POSITIVE** `[육안]` 09-09 신규: FI 판정과 별개로 접합점 장소 불연속 확실 | POSITIVE `[설계+scdet]` 같은 0:06, 전환 없이 강제 절단 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재, sync 미확인 |

## GT07_motion1 — A03_street, freeze-frame@4 — ★09-09 9/10 확정

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | POSITIVE `[설계+육안]` 0:04~끝, 정지 프레임 고정 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안+scdet]` 컷 0건 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재, sync 미확인 |

## GT08_motion2 — A11_night, freeze-frame@3 — ★09-09 9/10 확정

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | POSITIVE `[설계+육안]` 0:03~끝, 정지 프레임 고정 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안+scdet]` 컷 0건 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재, sync 미확인 |

## GT09_motion3 — A08_dessert, freeze@4(문서)+색온도@9(문서) — ★09-09 9/10 확정, LI 하향 반전(본부 검토 필요)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | POSITIVE `[육안, 근거 정정]` SSIM/PSNR 정량비교 결과 실제로는 0:00부터 이미 정지(문서상 0:04가 아님) | NEGATIVE `[육안]` 이상 없음 | **NEGATIVE** `[09-09 하향, ⚠️본부검토]` 설계문서-실파일 불일치 -- SSIM/PSNR로 전 구간 비교했으나 0:09 웜→쿨 전환이 어디서도 관측 안 됨(GT19 문서-파일 불일치와 같은 클래스, 빌드 결과물이 설계와 다를 가능성) | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안+scdet]` 컷 0건 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재, sync 미확인 |

## GT10_lighting1 — A16_crowd[0:8)+색온도[8:15) — ★09-09 8/10 확정, CO/ED 신규 POSITIVE(원본 자체 결함, GT11류 사고)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` 이상 없음 | UNVERIFIED 모션블러로 손가락 단위 확인 불가 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | POSITIVE `[설계]` 0:08, 웜→쿨 급전환 | **POSITIVE** `[육안]` 09-09 신규발견 -- 설계된 0:08 지점에 원본 소스 자체의 실제 하드컷이 겹쳐 있음(4인 군중 와이드샷 → 완전히 다른 장면의 여성 1인, 전환 없음). GT11 사고와 같은 클래스(설계 외 원본 결함) | **POSITIVE** `[육안]` CO와 동일 근거, 원본 자체 무전환 하드컷 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재(연속 배경음, 무음구간 0 확인했으나 화면과의 sync 자체는 미검증) |

## GT11_lighting2 — A12_mech[0:15), colortemperature@8 (★09-09 재제작, cf_03 오염으로 교체) — ★09-09 10/10 완전 확정

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[구조]` 사람 없음(기계 부품) | NEGATIVE `[구조]` 신체 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | POSITIVE `[설계+육안]` 0:08, 웜→쿨 급전환(5초/8.2초 프레임 대조 확인) | NEGATIVE `[육안]` 소스가 오늘 스크린으로 단일 연속 샷 확인됨(몽타주 없음) | NEGATIVE `[육안]` 소스에 컷 없음, 필터 삽입만(오늘 스크린 확인) | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[구조]` ffprobe로 오디오 스트림 0개 실측 확인 |

## GT12_editing1 — A11_night[0:5)+[10:13) 강제 접합 — ★09-09 8/10 확정

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED 접합된 두 구간(0:05, 10:13)이 공간적으로 연속인지 판단 불가, 진짜 애매함 | POSITIVE `[설계]` 0:05, 전환 없이 강제 절단 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재, sync 미확인 |

## GT13_editing2 — A16_crowd 4세그먼트 재편집 — ★09-09 8/10 확정, CO 신규 POSITIVE

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` 이상 없음 | UNVERIFIED 모션블러로 확인 불가 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | **POSITIVE** `[육안]` 09-09 신규: 서사적 연결 없이 반복되는 장면 교차(ED와 별개 축, GT10과 같은 서브씬 쌍 재사용) | POSITIVE `[설계]` 0:03/0:06/0:11, 박자 무시 컷 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재, sync 미확인 |

## GT14_continuity1 — A19_sunrise[0:15) — ★09-09 3/10 확정(대조군 자체가 없는 유형, 나머지는 진짜 애매)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | POSITIVE `[설계+육안 재확인]` 3.3~3.5초, 안개계곡→다른 설산으로 하드점프(문서상 0:04와 근접). ⚠️전환 지점 재추출 시 두 구성이 프레임마다 토글되듯 보이고 8.0초에 scdet 2차 컷도 발견 -- 실제 추가 불안정인지 fps 추출 아티팩트인지 미해소 | UNVERIFIED | UNVERIFIED | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재, sync 미확인 |

## GT15_continuity2 — A17_vista[0:7)+A10_drift[7:15) — ★09-09 3/10 확정, 접합 시점 정정(0:07→6.17~6.33초)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | POSITIVE `[설계+육안, 시점 정정]` 6.17~6.33초(문서상 0:07보다 0.7~0.8초 이름), 전경→자동차 버넉아웃 장면 접합, 장소 불연속 | UNVERIFIED | UNVERIFIED | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재, sync 미확인 |

## GT16_background1 — demo_ichar 전체 (실클립, 3사 합의 배경결함) — ★09-09 6/10 확정, OC/LI 신규 POSITIVE

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` 이상 없음 | UNVERIFIED 확인 불가 | **POSITIVE** `[육안]` 09-09 신규: 배경 전환 구간에서 어깨 패치 형태/방향이 함께 바뀌는 것으로 관측(중간 신뢰도) | UNVERIFIED | POSITIVE `[설계]` 3사 합의로 실측된 배경 불안정 | **POSITIVE** `[육안]` 09-09 신규: 인물 얼굴 조명이 새 배경(파란 네온 복도)으로 바뀐 뒤에도 적응 안 됨 | UNVERIFIED 벽→복도 전환이 continuity로도 잡힐 수 있는 경계 사례, 판단 보류 | NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` BG와 중복집계 방지, 별도 텍스처 결함 없음 | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재, sync 미확인 |

## GT17_background2 — A09_race[0:15) 트림 — ★09-09 3/10 확정

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED | UNVERIFIED | POSITIVE `[설계]` 배경 불안정(트림만, 원소스 결함) -- 기하학적 왜곡, 다만 모션블러 연출과 완전히 구분은 어려움 | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재, sync 미확인 |

## GT18_background3 — tk_render_1[0:18) 트림 — ★09-09 3/10 확정

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[육안]` 이상 없음 | NEGATIVE `[육안]` 이상 없음 | UNVERIFIED | UNVERIFIED | POSITIVE `[설계]` 배경 불안정(트림만, 원소스 결함), 클립 말미 거대한 날개달린 발광 인물 등장은 결함이 아니라 의도된 프로모 "리빌" 요소로 추정(단정은 보류) | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED | UNVERIFIED `[09-09 하향]` 실오디오트랙 존재, sync 미확인 |

## GT19/20/21 — 최종 확정 (Kling v3 pro i2v 3편 실패 → Kling 1.0 standard i2v로 교체, 09-09)

★경위: 1차(Kling v3 pro, premium)로 GT19~21을 만들었으나 3편 다 물리적으로 너무
정확하게 생성되어 의도한 결함이 하나도 안 나왔다(본부 판정: 3회 상한 소진,
"둘로 쪼개기"로 전환). 본부 지시로 구형·저가 모델(Kling 1.0 standard i2v,
$0.045/s, v3 pro의 1/4 이하)로 교체하고, 프롬프트도 "손이 이상하게"가 아니라
모델이 실제로 어려워하는 3요소(미세 손끝 조작·물체 완전 가림 후 재등장·빠른
손동작)로 바꿔 재시도 — 2차 시도(파일명 접미사 v2)에서 3편 다 실결함 확보.

★★09-09 채점 로직 감사(본부 지시) 후 2건 정정: ①**파일명 불일치 수정** — 아래
제목의 "GT19v2/20v2/21v2"는 실제 최종 파일명(`outputs/gt21/final/GT19_anatomy_object1.mp4`
등, v2·숫자접미사 없음)과 달랐다. 기계판독 정답지(`oxxovo-scoring/_gt21_answer_key_2026-09-09.ts`)는
실제 파일명을 ID로 쓴다 — 문서 제목은 사람이 읽기 위한 별칭으로만 남긴다.
②**continuity/lighting을 NEGATIVE→UNVERIFIED로 정정** — "scdet로 컷 0건"은
편집(editing) 결함 부재의 근거는 되지만 continuity(서사적 불연속) 부재의 근거는
아니었다. 실제로 GT19에서 4/5 판정관이 "물체가 설명 없이 무반응/소실"을
continuity 위반으로도 보고했다(objectConsistency와 같은 현상을 다른 축으로
포착 — FP가 아니라 정당한 관측). 정정 전에는 이게 전부 "거짓 FP"로 잘못
집계될 뻔했다.

★★09-09 ③차 정정(본부 지시, "UNVERIFIED가 근거없음인지 애매함인지 구분하라") —
motion/lighting/otherArtifacts를 카테고리 경계를 좁혀 UNVERIFIED에서 해소:
**motion**=궤적의 물리적 일관성(순간의 손 모양=anatomy와 별개 축), **lighting**=
장면 조명(물체 자체의 반사율 변화=objectConsistency 소관과 분리), **otherArtifacts**=
배경/기타 텍스처 전용 재확인(손·물체에 이미 잡힌 것과 별개). **continuity만
GT19에서 미해소로 남김** — 5.5~7초의 색상 이상이 "손 모양 문제"(anatomy)와
"물체가 나타났다 사라짐"(continuity)이 같은 근본 현상을 판정관마다 다른 축으로
설명한 것일 가능성이 높아, 독립 결함이라 확신 못 함(근거 부족이 아니라 진짜
애매함 — 정의를 더 좁혀도 안 풀림).

**GT19_anatomy_object1** (문서상 별칭 GT19v2, 동전을 손끝으로 집는 장면, 10.4초)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[구조]` 얼굴 없음(손만 등장) | **POSITIVE** `[육안]` 5.5~7초, 손가락이 뭉개져 붙은 주먹 형태로 붕괴 + 정상 피부색이 아닌 녹색 아티팩트 | **POSITIVE** `[육안]` 0~9초 전 구간, 손이 동전에 닿고 주먹까지 쥐는데도 동전이 한 픽셀도 반응 안 함 | **POSITIVE** `[육안]` 5.5~7초, 물체 접촉 없이 허공에서 주먹이 형성됐다 풀리는 궤적 자체가 물리적으로 비일관 | NEGATIVE `[육안]` 배경(창문·나무 테이블) 9프레임 전체에서 안정 확인 | NEGATIVE `[육안]` 창광 톤(장면 조명) 9프레임 전체에서 안정, 물체 반사율과 별개로 확인 | **UNVERIFIED(미해소)** — anatomy와 같은 근본현상일 가능성, 독립 결함 확신 불가 | NEGATIVE `[육안+scdet]` 컷 0건, 편집 결함 없음 | NEGATIVE `[육안]` 배경/테이블 텍스처 전용 재확인, 이상 없음 | NEGATIVE `[실측]` 오디오 스트림 0개(ffprobe) |

**GT20_anatomy_object2** (문서상 별칭 GT20v2, 금반지를 손끝으로 집는 장면, 10.4초)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[구조]` 얼굴 없음 | NEGATIVE `[육안]` 9프레임 전체에서 손가락 개수·비율 정상 확인 | **POSITIVE** `[육안]` 0~9초 전 구간, 손이 반지에 여러 번 닿는데도 반지가 전혀 반응 안 함 | NEGATIVE `[육안]` 손 움직임 자체는 접근-접촉-후퇴로 매끄러움, 주먹 형성 같은 이상 없음 | NEGATIVE `[육안]` 어두운 대리석 배경 안정 확인 | NEGATIVE `[육안]` 측광 조명 9프레임 전체 일정 | NEGATIVE `[육안]` 반지가 출현/소실 없이 완전히 정적으로 유지(불연속 없음) | NEGATIVE `[육안+scdet]` 컷 0건 | NEGATIVE `[육안]` 배경 텍스처 재확인, 이상 없음 | NEGATIVE `[실측]` 오디오 스트림 0개 |

**GT21_anatomy_object3** (문서상 별칭 GT21v2, 유리구슬을 손끝으로 집는 장면, 10.4초)

| FI | AN | OC | MO | BG | LI | CO | ED | OA | AV |
|---|---|---|---|---|---|---|---|---|---|
| NEGATIVE `[구조]` 얼굴 없음 | NEGATIVE `[육안]` 9프레임 전체에서 손가락 개수·비율 정상 확인 | **POSITIVE** `[육안]` 0~9초 전 구간, 손이 구슬을 여러 번 감싸 쥐는데도 구슬이 전혀 반응 안 함 | NEGATIVE `[육안]` 손 움직임 매끄러움, 이상 없음 | NEGATIVE `[육안]` 콘크리트 배경 안정 확인 | NEGATIVE `[육안]` 흐린 채광 일정 | NEGATIVE `[육안]` 구슬이 출현/소실 없이 완전히 정적 유지 | NEGATIVE `[육안+scdet]` 컷 0건 | NEGATIVE `[육안]` 배경 텍스처 재확인, 이상 없음 | NEGATIVE `[실측]` 오디오 스트림 0개 |

**GT19~21 소계: 29/30칸 확정**(POSITIVE 4 + NEGATIVE 25), UNVERIFIED 1칸(GT19 continuity).

**실측 검증(계산기 재통과)**: 갱신된 정답지로 GT19 5-Judge 재계산 —
anatomy Recall=5/5, objectConsistency Recall=4/5(gemini 놓침), motion Recall=4/5
(qwen 놓침), **FP: claude 2건**(lighting·otherArtifacts — 둘 다 실제로는 anatomy/
objectConsistency와 같은 현상을 잘못 분류한 것, 나머지 4사는 FP 0건). 카테고리
경계를 좁힌 게 그대로 판별력으로 나타남 — 이전 계산에서는 이 2건이 안 잡혔었다.

★**본부 지시대로 배정**: GT19v2=anatomy+objectConsistency 복합, GT20v2·GT21v2=
objectConsistency 단일 — GT20v2를 버리지 않고 "결함 하나만 있는 깨끗한 정답"으로
채택. 단, **GT21v2는 본부가 기대한 anatomy 단일이 아니라 objectConsistency
단일로 나왔다** — 손가락 형태는 9프레임 전체에서 정상이었고, anatomy 결함은
GT19v2 한 편에만 있다. 결과적으로 **anatomy POSITIVE=1편(GT19v2뿐), objectConsistency
POSITIVE=3편(GT19v2·20v2·21v2)**으로 불균형 — anatomy 단일편은 여전히 0편이다.
추가로 anatomy 전용 시도가 필요한지는 본부 판단 대기(현재 3회 상한 소진, 이번
2차 3회는 objectConsistency 위주로 편향된 결과).

---

## 카테고리별 집계 (★09-09 2차 갱신, 21편 210칸 1차 완성, 3상태 기준)

★09-09 4개 에이전트로 GT01~18(180칸) 전수 육안+scdet+ffprobe 재확인 완료.
GT03 CLEAN 판정 반전, GT06 FI·GT09 LI 하향 반전, AV 보편규칙(전 21편 NEGATIVE)
파기 등 본부 검토 필요 항목 다수 발생 — 아래 표는 이 갱신을 전부 반영한 값.
**다음 단계(본부 지시): ②2차 Blind 검수(1차를 안 본 새 검수자가 NEGATIVE 전부·
CLEAN-ALL 후보·경계 애매 항목·자동도구 근거 항목을 재확인, 불일치시 UNVERIFIED)
전까지 이 표는 잠정치.**

★★09-09 3차 개정 이후 — 아래는 이력 표(10칸, 2차 검수 시점 스냅샷). 이후 GT14~18에
블라인드 교차대조가 반영되면서 일부 칸이 다시 바뀌었다(GT14 CO: P→U, GT16 OC/LI:
P→U·CO: U→P, GT15 ED: U→P — 최신값은 `_gt21_answer_key_2026-09-09.ts` 참조).
**채점 대상은 이제 8칸(otherArtifacts 제외, audiovisualSync 삭제)이며, 최신
채점용 집계는 이 표 아래 "8칸 채점 기준 최신 집계"를 볼 것.**

| 카테고리 | POSITIVE | NEGATIVE | UNVERIFIED |
|---|---|---|---|
| faceIdentity | 2 (GT04,05) | 18 | 1 (GT06, ★09-09 하향) |
| anatomy | 1 (GT19) | 17 | 3 (GT10,13,16) |
| objectConsistency | 5 (GT03★신규,16★신규,19,20,21) | 12 | 4 (GT14,15,17,18) |
| motion | 4 (GT07,08,09,19) | 11 | 6 (GT05,14,15,16,17,18) |
| background | 3 (GT16,17,18) | 16 | 2 (GT14,15) |
| lighting | 3 (GT10,11,16★신규) | 14 | 4 (GT14,15,17,18) — ★GT09는 09-09 하향으로 NEGATIVE 편입 |
| continuity | 8 (GT03★,04★,05★,06★,10★,13★,14,15) | 8 | 5 (GT12,16,17,18,19) |
| editing | 7 (GT03★,04★,05★,06,10★,12,13) | 10 | 4 (GT14,15,17,18) |
| otherArtifacts `[기록용, Recall/FP 채점 제외]` | 1 (GT02) | 16 | 4 (GT14,15,17,18) |
| ~~audiovisualSync~~ `[09-09 3차 개정으로 칸 자체 삭제]` | — | — | — |
| **합계(구 10칸 기준, 이력)** | **34** | **127** | **49** |

★신규 표시=09-09 재확인에서 새로 POSITIVE 전환된 칸. ★하향=기존 POSITIVE를
UNVERIFIED/NEGATIVE로 되돌린 칸(GT06 FI, GT09 LI — 둘 다 설계문서와 실파일
불일치가 원인, 본부 판단 대기).

## 8칸 채점 기준 최신 집계 (★09-09 3차 개정 + GT14~18 블라인드 교차대조 반영)

| 카테고리 | Tier | POSITIVE | 목표 |
|---|---|---|---|
| faceIdentity | A | 2 (GT04,05) | 8~10 — ★미달 |
| objectConsistency | A | 4 (GT03,19,20,21) — GT16은 블라인드 불일치로 U 하향 | 8~10 — ★미달 |
| motion | A | 4 (GT07,08,09,19) | 8~10 — ★미달 |
| continuity | A | 7 (GT03,04,05,06,10,13,15) — GT14는 블라인드 불일치로 U 하향, GT16은 블라인드 신규발견으로 P 편입 | 8~10 — ★근접 |
| anatomy | B | 1 (GT19) | 4~5 — ★미달 |
| background | B | 3 (GT16,17,18) | 4~5 — 근접 |
| lighting | B | 2 (GT10,11) — GT16은 블라인드 불일치로 U 하향, GT09는 09-09 하향으로 이미 제외 | 4~5 — 미달 |
| editing | B | 8 (GT03,04,05,06,10,12,13,15) — GT15는 블라인드 수렴으로 P 편입 | 4~5 — 충족 |

**Tier A(faceIdentity·objectConsistency·motion·continuity) 전부 목표 미달** — Phase 2
fixture 제작 1순위. Tier B는 editing만 충족, anatomy가 가장 취약(1편뿐, 목표 4~5).
GT01~13은 블라인드 2차 교차대조가 API 레이트리밋으로 아직 미완료 — 리셋 후 재개
예정, 이 표는 GT14~18만 블라인드 반영된 잠정치.

## 영상별 확정률 (10칸 중 P 또는 N인 칸의 비율)

| GT | 확정 | GT | 확정 | GT | 확정 |
|---|---|---|---|---|---|
| GT01 | 9/10 | GT08 | 9/10 | GT15 | 3/10 |
| GT02 | 9/10 | GT09 | 9/10 | GT16 | 6/10 |
| GT03 | 9/10 | GT10 | 8/10 | GT17 | 3/10 |
| GT04 | 9/10 | GT11 | **10/10** | GT18 | 3/10 |
| GT05 | 9/10 | GT12 | 8/10 | GT19 | 9/10 |
| GT06 | 8/10 | GT13 | 8/10 | GT20 | **10/10** |
| GT07 | 9/10 | GT14 | 3/10 | GT21 | **10/10** |

전체 평균 확정률 = 161/210 = **76.7%**. GT14/15/17/18(continuity·background 편,
전부 real-footage/AV 오염 겹침)이 가장 낮음(3/10) — otherArtifacts·objectConsistency·
motion 같은 "설계 안 된" 카테고리가 이 편들에서 대거 UNVERIFIED로 남음.

**핵심 관찰**:
1. AV(audiovisualSync)이 가장 취약한 카테고리로 뒤바뀌었다 — 기존엔 "21/21
   완전 NEGATIVE"였으나 실제로는 GT05·GT11(+GT19~21)만 구조적으로 오디오
   0트랙이 확인되고, 나머지 16편은 진짜 오디오가 있어 sync 여부를 이 하니스로는
   검증할 수 없다. **AV를 이 벤치마크로 잴 수 있는 카테고리로 볼지 본부 판단 필요.**
2. GT03("CLEAN-ALL 후보")이 실제로는 8.0초 접합 클립으로 드러나 — CLEAN-ALL
   실질 2편(GT01,GT02)으로 축소.
3. GT06 faceIdentity, GT09 lighting 둘 다 설계문서와 실제 최종 파일이 어긋나
   있었다(GT19 문서-파일 불일치와 같은 패턴, 이번이 3번째 사례) — 본부 검토 필요.
4. GT10에서 설계 외 원본 결함 발견(continuity+editing, GT11 사고와 같은 클래스) —
   "설계된 결함만 있다"는 가정이 계속 깨지고 있다.

관련: [[project_scoring_v22]] · `_new_rubric_prompt_2026-09-09_structured_v1_2.ts` ·
`reports/gt21_paired_control_audit_2026-09-09.md`
