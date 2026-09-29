# Controlled Ground-Truth 21편 설계 (2026-09-08, 21편으로 확정) — 목록, 제작 전

본부 지시 반영: 8칸 전부에 DEFECT/CLEAN 명시(정답 없는 칸 없음), 영상당 결함
1~2개, 8카테고리 고르게, 전부 CLEAN 3편 포함, ffmpeg($0) vs AI생성(유료) 구분.
**"20"에 맞추지 않고 21편으로 늘려 objectConsistency도 3회 균등 확보**(본부 지시).

⚠️ **CLEAN-ALL 후보 교체**: demo_duel(우주 격투, VFX/블러 강함)은 눈으로 직접
확인한 결과 스타일상 블러가 결함처럼 오인될 위험이 있어 제외 — 대신
**A02_fabric**(사람·배경 없이 직물 클로즈업만, 8카테고리 거의 전부가 구조적으로
해당 없음)로 교체. 아래 §0 참고.

## 0. CLEAN-ALL 3편 — 실측 육안 확인(본부 지시 ②)

ffmpeg로 1fps~2fps 프레임 추출 후 직접 열어봤다(샘플 확인, 전 프레임 아님 —
아래 각 항목에 몇 프레임 봤는지 명시). 이 이상은 사람이 영상을 처음부터
끝까지 보는 것과 같은 확실성은 아니다 — 그 한계는 그대로 밝힌다.

- **demo_artisan**(도예가 손, 15초): 4프레임 확인(1,5,10,13초 부근). 손가락 개수·
  비율 정상, 얼굴 일관, 배경(선반의 도자기들) 안정. **CLEAN 채택.**
- **demo_anne**(공원의 소녀, 15초): 2프레임 확인(3,8초 부근). 캐릭터 얼굴·복장·
  배낭 일관, 배경 도시+공원 안정. **CLEAN 채택.**
- **demo_duel**(우주 격투, 15초): 3프레임 확인(1,5,10초 부근) — **제외.** 전투
  VFX(모션블러·에너지 이펙트)가 강해 "motion collapse"나 "unstable geometry"로
  오인될 리스크가 있다고 판단(실제 결함인지 스타일인지 애매한 프레임 존재,
  10초 지점 소용돌이 블러 샷). 정답지를 "거짓"으로 만들 리스크라 안전하게 제외.
- **A02_fabric**(직물 클로즈업, 19초, 대체 후보): 2프레임 확인(5,20초 부근).
  사람·손·얼굴·배경 전혀 없음 — anatomy/faceIdentity/background/continuity가
  구조적으로 "해당 없음"(=CLEAN이 자명). 텍스처(새틴 주름) 안정, 색온도 일정.
  **CLEAN 채택, GT03 교체.**

## 1. 카테고리별 제작 방법 분류

| 카테고리 | 방법 | 비용 | 근거 |
|---|---|---|---|
| faceIdentity | ffmpeg(서로 다른 실제 인물 클립 접합, Z03 방식 재사용) | $0 | Z03가 이미 이 방식으로 실측 검증됨 |
| motion | ffmpeg(freeze-frame + 느린 팬, Z01 방식 재사용) | $0 | Z01 실측 검증됨 |
| lighting | ffmpeg(컷 지점에서 색온도/화이트밸런스 필터 전환) | $0 | 순수 색보정, 생성 불필요 |
| editing | ffmpeg(전환 없는 거친 컷, 박자 어긋난 편집) | $0 | 순수 편집 |
| continuity | ffmpeg(서로 다른 실제 장소 클립 접합, A19 방식 재사용) | $0 | A19 실측 검증됨 |
| background | ffmpeg(같은 피사체 유지하며 배경만 다른 실제 클립으로 교체 접합) | $0 | continuity와 자매 기법, 피사체 연속·배경만 불연속으로 구분 |
| **anatomy** | **AI 생성 필요**(손/신체 변형은 ffmpeg로 못 만듦) | **유료** | 딥페이크급 워핑 없이는 자연스러운 변형 불가 |
| **objectConsistency** | **AI 생성 필요**(물체 소실/변형은 생성 아티팩트) | **유료** | ffmpeg로 만들면 "편집으로 지운 티"가 나서 editing 카테고리와 오염됨 |

**6/8 카테고리는 $0**(기존 실제 클립 풀 재활용 + ffmpeg만). **2/8만 유료**(anatomy, objectConsistency) — 진짜 AI 생성 아티팩트가 필요해서다.

## 2. 21편 목록 (설계, 미제작)

CLEAN-ALL(전부 정상) 3편 + 결함편 18편(단일 12 + 이중 6) = 카테고리별 defect
인스턴스: faceIdentity 3 · motion 3 · lighting 3 · editing 3 · continuity 3 ·
background 3 · anatomy 3 · objectConsistency 3 = **24개**, 8카테고리 완전
균등(3-3-3-3-3-3-3-3). (이중결함: GT06·GT09·GT17·GT19·GT20·GT21 = 6편)

| # | ID | 결함(1~2개) | 소스 | 방법 |
|---|---|---|---|---|
| 1 | GT01_clean_a | **CLEAN-ALL** | demo_artisan 원본 그대로(육안 확인) | $0 |
| 2 | GT02_clean_b | **CLEAN-ALL** | demo_anne 원본 그대로(육안 확인) | $0 |
| 3 | GT03_clean_c | **CLEAN-ALL** | A02_fabric 원본 그대로(육안 확인, demo_duel 대체) | $0 |
| 4 | GT04_face1 | faceIdentity | A07/A08 인물 다른 클립 2개 접합 | $0 |
| 5 | GT05_face2 | faceIdentity | cf_01/cf_02 다른 인물 접합 | $0 |
| 6 | GT06_face3 | faceIdentity + editing | 인물 접합 + 컷 지점을 일부러 거칠게 | $0 |
| 7 | GT07_motion1 | motion | A03_street freeze-frame화 | $0 |
| 8 | GT08_motion2 | motion | A11_night freeze-frame화 | $0 |
| 9 | GT09_motion3 | motion + lighting | freeze-frame + 색온도 전환 동시 | $0 |
| 10 | GT10_lighting1 | lighting | A13_group 중간에 색온도(웜→쿨) 전환 | $0 |
| 11 | GT11_lighting2 | lighting | cf_03 중간에 화이트밸런스 어긋남 | $0 |
| 12 | GT12_editing1 | editing | A14_solo 컷 2개를 전환 없이 강제 접합 | $0 |
| 13 | GT13_editing2 | editing | A16_crowd 박자 어긋난 재편집 | $0 |
| 14 | GT14_continuity1 | continuity | A19_sunrise **재사용**(장소 불연속, 기존 자산) | $0 |
| 15 | GT15_continuity2 | continuity | A17_vista + A18_cities 장소 접합 | $0 |
| 16 | GT16_background1 | background | 동일 인물 클립 + 배경만 다른 실사 클립 교체 접합 | $0 |
| 17 | GT17_background2 | background + continuity | 배경 교체 + 장소 불연속 동시(background 2번째, continuity 3번째) | $0 |
| 18 | GT18_background3 | background | A20_culture 배경만 다른 클립으로 교체 접합(background 3번째) | $0 |
| 19 | GT19_anatomy_object1 | **anatomy + objectConsistency** | 신규 AI 생성#1(손으로 물체를 드는 동작 — 손 변형과 물체 소실을 한 클립에) | **유료** |
| 20 | GT20_anatomy_object2 | **anatomy + objectConsistency** | 신규 AI 생성#2(다른 구도, 같은 조합) | **유료** |
| 21 | GT21_anatomy_object3 | **anatomy + objectConsistency** | 신규 AI 생성#3(다른 구도, 같은 조합) | **유료** |

★**anatomy와 objectConsistency를 같은 3개 AI 생성 클립에 함께 담는다**(각
클립 = "손으로 물체를 집거나 드는 장면"으로 설계하면 손 변형과 물체 소실이
한 생성에서 같이 나올 수 있다) — 이렇게 하면 **유료 편수를 3편으로 유지하면서**
두 카테고리 모두 3회씩 확보된다(따로 만들면 6편 필요). editing은 GT06/GT18로
3회 채움. **8카테고리 전부 정확히 3회씩, 유료는 3편 그대로.**

## 3. 비용 추산 (8카테고리 전부 3회 균등, 유료 3편 유지)

- ffmpeg 전용 18편(GT01~18): **$0**(전부 기존 실제 클립 재활용 + 로컬 ffmpeg 편집).
- AI 생성 필요 3편(GT19~21, 각각 anatomy+objectConsistency 동시): Kling i2v
  실측 단가 $0.168/초 기준(2026-07-18 확정치), 15~20초 클립이면 **편당
  $2.5~3.4** — 단, 손 변형과 물체 소실이 **한 클립에 둘 다 확실히 나온다는
  보장은 더 낮다**(1개 결함보다 2개 결함 동시 발생이 조건부 확률로 더 어려움).
  2~4회 재시도를 감안하면 **3편 실측 준비에 $15~35** 추산 — 만약 재시도로도
  "둘 다"가 안 나오면 그 클립은 anatomy 또는 objectConsistency 단독으로
  강등하고 부족분은 추가 생성 필요(그때 추가 승인).
- **총 추산: $15~35**(3편 유료 기준 — 결합 시도 실패 시 초과 가능성 있음, 사전 고지).

## 4. ③ Repeat Stability용 5편 블라인드 재호출

21편 중 5편을 골라 판정 후 **같은 조건으로 2회차 재호출**(같은 프롬프트·프레임·
judge, 다만 어떤 편인지 표시 없이 새 세션처럼) — Recall/FP가 1회차와 같게
나오는지로 안정성을 잰다. 후보(다양성 확보): GT03(clean), GT06(복합
face+editing), GT09(복합 motion+lighting), GT17(복합 background+continuity),
GT19(anatomy+objectConsistency, 유료) — **최종 선정은 21편 제작 완료 후 실제
자산 상태 보고 확정**.

## 5. 승인 필요 사항

1. 위 21편 목록 확정(특히 #6/#9/#17/#19~21 복합결함 조합).
2. AI 생성 3편의 **품질 등급**(draft vs 프리미엄) — draft가 더 싸지만 아티팩트
   재현성이 떨어질 수 있음(과거 "Ideogram 드리프트→flux-pulid ~$2" 기록은
   draft급 추정).
3. $15~35 비용 승인(결합 시도 실패 시 초과 가능성 사전 고지).

승인 나면 ffmpeg 18편부터 즉시 제작(무료), AI 생성 3편은 별도로 진행한다.
