# 인계 메모 (지수2 트랙) — profiles 행 생성 이중화

**From** 지수 본체 · **2026-07-28** · 브랜치 `fix/signup-profile-row` (`e99cb67`)

별도 지시는 가지 않습니다. 시그니처를 바꿔놨으니 **리베이스하면 컴파일 에러로
드러납니다.** 그때 이 파일을 보면 됩니다.

## 왜 바뀌었나 (한 문단)

트립팁팁 마이그 `0010`이 OXXOVO DB에 실행되어 `public.handle_new_user`를
덮었습니다. 이름이 Supabase 퀵스타트 기본값(`handle_new_user` /
`on_auth_user_created`)이라 **OXXOVO 자체 가입 트리거가 조용히 대체**됐고,
정리 과정에서 함께 사라졌습니다. 그러자 `profiles` 행이 안 생기고 —
`profiles.email`이 NOT NULL인데 앱의 profiles 쓰기 경로가 **전부 email을 안
보내고 에러를 버려서** 조용히 실패했습니다. 경위 전체:
`reports/auth_handle_new_user_2026-07-28.sql`.

## main에서 이미 바뀐 것

| 전 | 후 |
|---|---|
| `getDisplayName(userId)` — 행 자동 생성 | `getDisplayName(userId, email)` — **본인 전용**, email 필수 |
| — | `getDisplayNameReadOnly(userId)` — **타인/공개 read, 쓰기 없음** |
| `setDisplayName(userId, value)` — 실패 무시 | `setDisplayName(userId, email, value)` — **실패 시 throw** |
| — | `lib/profile-row.ts` `ensureProfileRow(userId, email)` |

`email`은 옵셔널이 아닙니다. admin API 폴백도 없습니다(의도). 본인 경로는 전부
세션 email을 갖고 있고, 폴백을 두면 트리거가 죽었을 때 **공개 read 트래픽이
전부 admin 조회로 몰리는 증폭**이 생깁니다 — TK 판단, 2026-07-28.

## Studio 브랜치에서 해야 할 것

`lib/profile.ts` `upsertCreatorProfile`과 그 호출부는 main에 없어서 제가
손대지 않았습니다. 같은 문제를 갖고 있습니다.

1. **`lib/profile.ts` `upsertCreatorProfile(userId, email, fields)`** — email을
   받고, `ensureProfileRow` 먼저 호출한 뒤 `upsert`가 아니라 `update`로. 지금은
   `{id, creator_name, country}`만 보내서 행이 없으면 NOT NULL로 실패합니다.
   반환값을 `{ok, error?}`로 바꿔 호출부가 판단할 수 있게 하는 걸 권합니다.
2. **`.catch(() => {})` 3곳에 로그 추가** — 비치명은 **유지하세요**. genesis에
   원본 스냅샷이 있으니 제출을 실패시키면 안 됩니다. 흔적만 남기면 됩니다:
   - `app/api/apply/route.ts` (upsertCreatorProfile 호출)
   - `lib/studio.ts` ×2 (submitGeneration / submitRender 안의 미러링)
3. **`lib/studio.ts` `getDisplayName(args.userId)`** →
   `getDisplayName(args.userId, args.email)`. `submitGeneration` /
   `submitRender` args에 이미 `email`이 있습니다.
4. **`app/studio/actions.ts` `getDisplayName(auth.userId)`** →
   `getDisplayName(auth.userId, auth.email)`. `auth.email`은 바로 위에서
   `.ilike('email', auth.email)`로 쓰고 있습니다.
5. **타인 경로가 새로 생기면** `getDisplayNameReadOnly`를 쓰세요. 공개 read에서
   행을 만들지 않는다는 게 이 설계의 핵심입니다.

## 검증 방법

`reports/db_schema_outside_repo_2026-07-28.md`에 방식이 적혀 있습니다. 요지는
**행을 지운 뒤**(트리거 부재 재현) 본인 경로가 치유되고 read 경로는 쓰지
않는지 보는 것입니다. 그 케이스만이 "단일 의존 해소"를 증명합니다.
본체 쪽 결과: 실코드 E2E 31/31.

## 주의

- `claimFoundingCreator`를 테스트에서 **호출하지 마세요.**
  `membership_enabled=true`(라이브)라서 실제로 Founding 슬롯을 태우고
  `membership_founding_counter`가 움직입니다. 선행조건만 확인하세요.
- 테스트 계정은 `profiles` → `auth.users` 순으로 지우고 잔재를 확인하세요.
