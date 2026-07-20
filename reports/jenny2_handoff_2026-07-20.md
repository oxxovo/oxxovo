# 지수2 인수인계 -- 2026-07-20 (효과 에픽 A~E 완주)

세션 마감 스냅샷. 양 레포 clean·origin 동기·미push 0.
`oxxovo` **feat/studio-budget-guard @ 83b50e7** / `oxxovo-studio` **feat/studio-loadtest @ 32e0a80**.
★배포 제약 유지: session6_enabled=true 전 main 병합/배포 금지. 이미지/i2v/효과 전부 preview·게이트 뒤.

## 1. 오늘 완결 -- 프로 편집기 효과 에픽 A~E 전부 + 배우 온보딩 1~5

### 효과 에픽 (Genesis Rule 재정의: 효과·색보정·전환 전부 in-platform)
| 단계 | 내용 | 검증 |
|---|---|---|
| **A** EDL v2 + CryptoBind | 효과를 인증체인에, 양레포 byte-mirror | KAT golden 79be7107, 결정론·변조 |
| **B** 워커 렌더 v2 | 색·색온도·틴트·LUT·샤픈·크로매틱·모션블러·그레인·비네트·속도 + 전환(xfade run그룹핑)·글로우 | 실 ffmpeg 렌더 + 실AI클립 샘플 |
| **C** 에디터 코어 | /studio/compose 프로3분할 교체, pluggable 프리뷰, 효과UI 미노출(순서·트림·컷→렌더→제출) | 헤드리스 실클립 마운트 |
| **D** GL 프리뷰 | WebGL2 엔진: 색1.51%·LUT0.06%·글로우0.11%·전환0.42~0.54%(+경계타이밍 ALIGNED) 엔진 재검증. 단일소스 lib/gl-effects.ts. 라이브 이중-비디오 전환 배선 | 파리티 하니스 gl/lut/glow/transition + gl-engine-parity |
| **E** 효과 UI | per-clip+글로벌 슬라이더(노출/대비/채도/색온도/틴트/비네트/글로우/그레인)+LUT픽커+전환픽커. 라이브 WYSIWYG(update() 무중단). **그레인 근사배지**. ★효과가 EDL v2로 실제 렌더까지(프리뷰=최종). 게이트밖 데모 삭제 | tsc0·build0 |

**노출세트(E)**: 색보정·LUT·글로우·전환(crossfade+와이프4)·그레인(근사배지). **미노출**: 모션블러·샤픈·크로매틱·slide/dip/dissolve/circle·LUT부분강도(보류). **오디오=플랜C(범위밖)**.

### 배우 온보딩 (별개, 완결)
3번째 공식배우 **RIN**(뷰티CF, flux/dev 완전합성). 출처·시트·i2v모션 전부 TK 육안 통과 → `official_actors` 행(id fa0cda94, slug=actor-3-beauty-cf, **status=draft·display_name=RIN**, provenance+CryptoBind HMAC-SHA256-v1actor-stable, canonical=frontal.jpg, ref 4앵글). **공개 노출 0**(draft+RLS+공개코드 없음). 스크립트 onboard-actor-{sheet,i2v,insert}.mjs. **로스터 KIRA/YUZU/RIN, 공개이름 정렬은 제니2가 별도**.

## 2. 위생/함정 기록
- 양레포 `.gitattributes` LF 고정(결정론 파일 CRLF 오염 방지).
- 새 테이블 service_role GRANT 누락 함정: GRANT ALL이 TRUNCATE/REF/TRIGGER만 위임 → 명시 `GRANT SELECT,INSERT,UPDATE,DELETE` 필요(official_actors TK Run 완료).
- CryptoBind provenance는 JSONB 키재정렬 때문에 **stable(키정렬) 직렬화**로 서명해야 재검증됨(actor 서명 algo에 반영).
- getCurrentSeason()은 env 무시(season_test 반환).

## 3. ★내일 시작 = TK 데모 육안 피드백
1. **TK님이 E 데모 육안** -- demo-login URL(studio-demo 자동로그인) → /studio/compose에서 슬라이더·전환 직접 만짐. **전환 매끄러움·슬라이더 실시간 반영** 확인. 어긋나면 파라미터/타이밍 조정.
   - 데모경로: `.../api/demo-login?key=oxxovo-studio-demo-2026` → 클립 추가 → Play → 슬라이더/전환.
2. 피드백 반영(필요시) → **G(회귀: 옛 ComposeEditor 삭제·기존 제출/Watch/Stage3 무손상 확인)** → **H(프리뷰↔렌더 풀 파리티: 워커 실렌더로 효과 최종본이 프리뷰와 일치하는지 육안+수치)** → 발사 게이트.
3. 남은 미노출 효과(모션블러·slide 등) + LUT부분강도는 발사 후 백로그.

## 4. 발사 게이트(참고, [[project_launch_gates]])
fal 동시성 상향(2~4주 리드) · fal auto-recharge · 프로드 제출 moderation 1회 확인 · session6 ON + main 병합 · Stage3 model active 점등.
