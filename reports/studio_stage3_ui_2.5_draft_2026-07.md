# Stage 3 2.5 UI 구성안 초안 -- "AI 배우 만들기" (2026-07-18, 지수2)

★초안 = 내일 논의용. 코드 착수는 TK 구성안 승인 후. 서버(2.4)·워커(2.3)·크립토(2.2)는 완성, UI만 남음.
제약: 보라 톤(/studio·ComposeEditor 동일), **Watch·라이브 ComposeEditor 불변**, 게이트=로그인+session6, 시크릿 화면출력 금지.

## 0. 서버는 이미 준비됨 (UI가 부를 액션)
- `createImageGenerationAction(token, {modelId, prompt, advanced?})` -- 캐릭터 시트 이미지 생성
- `createCharacterAction(token, {name, frontalImageJobId, referenceImageJobIds?})` / `listCharactersAction(token)` / `deleteCharacterAction(token, id)`
- `createI2vGenerationAction(token, {modelId, characterId, shots:[{prompt,durationSeconds}]})` -- i2v 클립 생성
- 폴링·크레딧·캡·완료알림은 **기존 pollJobsAction/ETA/알림 재사용**(이미지·i2v 잡도 generation_jobs라 그대로 뜸). i2v 산출 클립은 **기존 compose 픽커에 자동 등장**(ready 비디오).

## 1. 진입점 (기존 Studio 연결)
- /studio 상단에 **탭/스텝 전환**: `[1) 배우 만들기] [2) 클립 생성] [3) 조합]` (기존 생성 UI = 2번, compose = 3번). 배우 만들기 = 신규 1번.
- 또는 별도 라우트 `/studio/actors`(진입 버튼 "AI 배우"). **결정 필요**: 탭 통합 vs 별도 라우트. → 권장 **탭 통합**(한 화면 흐름, 초보 이탈 최소).

## 2. 화면 A -- 캐릭터 시트 생성 (t2i)
- **입력**: 배우 설명 프롬프트 1필드(예: "20대 중반 동양 여성, 이슬 피부, 눈밑 점, 금 귀걸이") + 모델 셀렉트(Ideogram Character / draft) + 생성 버튼.
- **드래프트 티어 토글**(연습장): 싸게 시행착오(장당 0.08 vs 0.15). 캡 별도(이미지 20/드래프트 40). 기존 draft 배지·저해상도 패턴 재사용.
- **생성 결과 갤러리**: 만든 이미지들 썸네일 그리드(생성 = generation_jobs media_type=image, 폴링으로 ready 표시). 프롬프트 재생성으로 같은 배우 여러 컷 확보.
- ★고지: "여러 컷을 만들어 그중 정면 1장 + 참조 몇 장으로 배우를 등록하세요."

## 3. 화면 B -- 캐릭터 라이브러리 (배우 명부)
- 만든 이미지 중 **정면(frontal) 1장 지정 + 참조(reference) 여러 장 선택 → 이름 붙여 "배우 등록"**(createCharacterAction).
- 등록된 배우 목록 카드: 정면 썸네일 + 이름 + 참조 수 + 삭제. (listCharactersAction)
- 이름 = AI 배우 이름(KIRA/SUNNY 등 TK 미확정) -- 참가자가 자유 명명, 시스템은 표시만.
- ★Ideogram `reference_image_urls`는 1장만 실사용(스키마) -- UI는 참조 여러 장 받되 "대표 참조 1장이 주로 반영" 고지 or 정면+참조1 강조.

## 4. 화면 C -- i2v 샷 생성 (Kling elements)
- **배우 선택**(라이브러리에서) + **멀티샷 스토리보드**: 샷 1~6개, 각 샷 = 프롬프트 + 길이(합 ≤15s). "샷 추가" 버튼.
- 생성(createI2vGenerationAction) → Kling i2v 클립(start_image=배우 정면 + elements=정면·참조 + multi_prompt=샷들). 한 번의 생성으로 같은 배우 멀티샷.
- 결과 = ready 비디오 클립 → **화면 3(조합)에서 그대로 선택**. 별도 연결 코드 불필요.
- 비용 고지(Kling 4배) + 드래프트 i2v는 형제 미검증이라 v1에서 제외(정식만).

## 5. 흐름 요약 (초보 동선)
```
배우 만들기(A) --생성--> 시트 이미지들
   -> 정면+참조 골라 이름 붙여 등록(B) --> 배우 라이브러리
      -> 배우 선택 + 멀티샷 프롬프트(C) --생성--> i2v 클립(들)
         -> 조합(기존 compose) --> 30~40초 완성작 --> 제출(v1v 체인 검증)
```

## 6. 논의 결정 포인트 (내일)
1. **진입 구조**: /studio 탭 통합 vs 별도 라우트 (권장: 탭 통합)
2. **참조 이미지 UX**: Ideogram 1장 한계 노출 방식(정면+참조1 강조 vs 여러 장 받고 고지)
3. **드래프트 이미지 티어 노출**: 이미지 생성에 연습장 토글 넣을지(권장: 넣음, 시트 시행착오 큼)
4. **AI 배우 이름 정책**: 자유 명명 확정? (KIRA/SUNNY는 예시 seed)
5. **모델 셀렉트 노출**: Ideogram 정식/draft만 vs 향후 Nano Banana 추가 여지
6. **active=true 전환 시점**: UI 배선 완료 + 실브라우저 확인 후 이미지/i2v 모델 active 켬(그 전엔 셀렉터 무노출)

## 7. 규모 (참고, 어제 계획 2.5 = ~3d)
- A 시트생성 화면(기존 생성 UI 확장·폴링 재사용) ~0.7d
- B 라이브러리(등록/목록/삭제) ~0.7d
- C i2v 샷(멀티샷 폼 + 생성) ~1d
- 통합/탭/i18n/실브라우저 ~0.6d
- → active 켜고 2.6 E2E로.

## 8. 불변 준수
- ComposeEditor.tsx·Watch 코드 손대지 않음(i2v 클립은 기존 픽커에 자동 등장). 신규는 전부 새 컴포넌트/라우트.
- 마이그 추가 없음 예상(2.1 컬럼으로 충분). UI서 컬럼 필요 나오면 선행 Run.
