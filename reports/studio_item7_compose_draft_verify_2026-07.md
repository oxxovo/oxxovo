# item7 검증 — compose 초안 저장/복원 런타임 재현 체크리스트

- 대상 커밋: ae39596 (feat/studio/compose persist+restore draft)
- 검증 환경: Preview (feat/studio-budget-guard, 이미 이 코드 포함), `/studio/compose`
- 저장소 키: `oxxovo_compose_draft_season_test` (localStorage, 시즌별)
- 저장 항목: EDL 배치(segments) + creatorName/creatorStatement/country. **동의(agreements)는 저장 안 함** (매 제출 재확인).

---

## Part 1 — 저장/복원 (제출 불필요, 지금 바로 가능)

1. Preview `/studio/compose` 진입 → **클립 2~3개 배치**(추가/순서/트림) + **statement 입력** + 이름/국적 입력. (동의 체크박스는 아직 두지 마세요.)
2. **DevTools → Application → Local Storage** → `oxxovo_compose_draft_season_test` 값 확인:
   - `segments` 배열(jobId/startMs/endMs) + `ap`(creatorName/creatorStatement/country)가 들어있고 **agreements 키는 없음** → ✅ 저장 정상.
3. **페이지 이탈**(다른 메뉴 클릭) 또는 **새로고침(F5)** 후 `/studio/compose` 재진입.
4. **복원 확인**: 배치 + statement/이름/국적이 그대로 복원됨 → ✅. **동의 체크박스는 비어있음**(재확인 요구) → ✅.

## Part 2 — 빈 상태 미저장 (초안 안 지워짐)

5. 초안이 있는 상태에서, 브라우저 새 탭으로 `/studio/compose`를 잠깐 열었다 닫아도(빈 마운트) 기존 초안이 유지되는지 → ✅ (empty 상태는 저장 skip이라 clobber 안 함).

## Part 3 — 편집 후 재렌더 강제 (제출물 = 화면 일치)

6. ready 렌더가 있는 상태에서 배치를 **한 번 더 편집**(클립 순서 변경 등) → 재진입/새로고침 시 그 ready 렌더가 **바로 제출가능으로 바인딩되지 않고 재렌더를 요구**하는지 → ✅ (EDL 불일치 → edited-after-render → 재렌더 강제). 배치를 안 바꿨으면 ready 렌더가 그대로 제출 바인딩 → ✅.

## Part 4 — 제출 성공 시 초안 삭제 (★신청행 리셋 필요)

- 현재 TK season_test는 이미 제출됨(hasApplication=true) → 재제출 차단이라 이 스텝은 **신청행 삭제 후** 가능.
- 원하시면 지수2가 genesis 행 삭제(이전과 동일 service-role) → hasApplication=false → 새로 배치+제출 → **제출 성공 직후 localStorage `oxxovo_compose_draft_season_test`가 사라지는지** 확인 → ✅. 재진입 시 깨끗한 빈 에디터.
- (item1 배너 숨김도 이때 함께 눈으로 확인 가능.)

---

## 판정
- Part 1~3만으로도 초안 저장/복원/재렌더 강제의 핵심은 검증됩니다(제출 불필요).
- Part 4(제출 삭제)까지 원하시면 신청행 삭제 요청 주세요.
- 코드 변경 없음 — 이건 런타임 확인만. 통과 시 item7 "검증 완료"로 마감.
