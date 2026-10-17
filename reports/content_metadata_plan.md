# 장르·시리즈 메타데이터 설계안 (초안)

작성: 지수(메인, 앱 레포), 2026-10-12(PT). **계획·초안만. 코드·SQL·수입 규격 변경 없음, 커밋·푸시·배포 없음.**
TK님 방향: **영화는 장르별, 드라마는 요일별**로 나눠 보여준다. 본부가 수입 규격에 칸을 넣는 시점을 정한다(10-12 제니2 전달).
근거 코드·문서: `lib/content-import.ts`, `lib/content-hash.ts`, `lib/content-kinds.ts`, `lib/home-sections.ts`, `lib/content-public-columns.ts`, `reports/phase1_step1_tables_2026-10-05.sql`, 설계서 `phase1_design_2026-10-04.md` §12-2·§12-3(Series/Season/Episode, `production_origin`).

## 0. 결론 먼저 (내 의견)

1. **화면 쪽 분류(장르별·요일별 묶기)는 엔터 첫 완성본 이후에 만든다. 그러나 데이터 칸은 첫 완성본이 들어오기 전에 정해 두는 것이 낫다.**
2. 이유: 이미 수입된 행에 장르·회차를 **나중에 붙이는 길이 지금 구조에는 없다.** `contents`는 수정 경로가 어드민 RPC 몇 개뿐이고(제목·설명·정지·반송 등), 수입은 같은 `source_version`을 다른 내용으로 다시 보내면 409입니다. 소급하려면 새 `source_version`(= **새 승인 id**, 제니2 확인 10-07)이 필요합니다. 즉 **엔터 완성본을 칸 없이 먼저 받으면 그 편마다 재승인이 듭니다.**
3. 반대로 칸을 지금 코드에 넣는 것은 **⑩이 끝나기 전에는 하지 않는다**: 수입 경로(`validateImportRequest`·해시·`content_import` RPC)를 바꾸면 ⑩이 시험하는 바로 그 경로가 바뀝니다.
4. 제안 순서: **⑩ 완료 -> (본부·제니2가 필드 확정) -> 규격 개정 + 스키마·수입 코드(아래 A안) -> 엔터 첫 완성본 수입 -> 화면 묶기.** 규격(문서)에 칸을 "예정"으로 먼저 알려 제니2가 완성본마다 값을 모으게 하는 것은 지금 해도 비용이 없습니다.

## 1. 지금 구조의 사실 (읽은 것)

- `contents`(코드 파일 기준, **라이브 스키마는 이번에 읽지 않음**): 장르·시리즈·회차·요일 칸이 **없다.** 한 편 = 한 행(`source`+`source_ref`+`source_version`), 승인 id는 `UNIQUE(source, upstream_approval_id)`. `kind`는 `news/drama/film/cf/music/music_video`(DB CHECK), `form`·`language`는 DB가 아니라 `lib/content-kinds.ts`가 허용 목록.
- 수입 검증: 최상위·에셋의 **알 수 없는 필드는 400**(해시 함수도 던짐). `spec_version`은 1만 받음. 해시 대상 필드는 `lib/content-hash.ts`의 목록이고 "null과 absent는 같다" -> **기존 행·기존 전송은 새 선택 필드를 안 보내면 해시가 안 변한다.**
- 불변 컬럼 보호 트리거는 **명시 목록**(`id source source_ref source_version kind upstream_* payload_hash language form ai_generated created_at`)만 막는다. 새 컬럼은 기본이 가변이고, 감사(`contents_history`)는 9개 필드 고정 — 새 컬럼 변경은 감사에 안 남는다(§12-3).
- 공개 목록·상세는 **컬럼을 명시**한다(`PUBLIC_CONTENT_COLUMNS`). 새 컬럼은 의도적으로 목록에 넣어야만 공개 응답에 나간다(새어 나갈 위험 없음).
- 목록 정렬은 `publish_at desc, id desc`, 종류 필터는 `lib/home-sections.ts`(`film`, `drama` 섹션이 이미 있음). 시리즈로 묶는 것은 **스키마가 아니라 쿼리·화면 변경**(§12-3 5번).
- 엔터 쪽 수입은 `production_origin`(OXXOVO ORIGINAL / COMMERCIAL 구분)·`client_id` 제안(제니2 10-07)도 **같은 확장 지점**을 건드린다.
- 라이브에 엔터(`drama`·`film` 등) 행이 이미 몇 건 있는지는 **모른다.** 내가 아는 한 뉴스 시험 행뿐이다(미확인). 아래 SQL R로 읽어 확인한다.

## 2. 수입 규격에 추가할 필드 제안

모두 **선택(optional)**, 이름은 기존 수입 필드 스타일(스네이크, 소문자)로. 종류별로 허용·금지를 둔다(뉴스에 오면 기존 스타일대로 400).

### 2-1. 영화 (`kind=film`)

| 필드 | 형 | 규칙 |
|---|---|---|
| `genre` | 문자열(키) | **주 장르 하나.** 허용 목록은 `lib/content-kinds.ts`에 두는 것을 제안(`kind`·`form`·`language`가 그렇게 함 -- 새 값 = 한 줄, DB CHECK 없음). 소문자 영문 키(예: `scifi` `drama` `action` `romance` `thriller` `comedy` `fantasy` `horror` `animation` `documentary` `mystery`). **목록 초안은 제니2가 낸다**(요청받은 일). 화면 표시 이름은 제니3 문구. |
| (후속) `genres` 배열 | — | **본부 확정: 단일 대표 장르, 목록은 제니2.** 복수 장르는 지금 넣지 않는다(나중에 `genre`를 대표 장르로 남기고 배열만 더하면 됨). |

### 2-2. 드라마 (`kind=drama`)

| 필드 | 형 | 규칙 |
|---|---|---|
| `series_ref` | 문자열 | 시리즈의 **안정적 식별자**(소스가 정함, `source_ref`와 같은 형식 규칙). 한 시리즈의 모든 회차가 같은 값. |
| `series_title` | 문자열 | 시리즈 이름. |
| `season_no` | 정수 ≥ 1 | 시즌 번호. |
| `episode_no` | 정수 ≥ 1 | 회차 번호(시즌 안). |
| `release_weekday` | `mon`..`sun` | **공개 요일.** 소문자 영문 약어(뉴스 송출 스케줄 키가 이미 `mon,tue,…` 영문 약어 -- 한글이면 조용히 정지한 전례, 설계서 4차 반영). |

- **함께 오거나 함께 없다**: `series_ref`·`season_no`·`episode_no`는 셋 다 있거나 셋 다 없어야 한다(DB CHECK 제안). **시리즈 없는 드라마 단편은 허용**(본부 확정): 셋 다 없이 받는다.
- **`release_weekday`의 뜻을 정해야 한다(본부·TK님 결정 필요):** (a) 시리즈의 **고정 방영 요일**(매주 수요일 드라마) 라벨인가, (b) 그 회차의 **실제 공개일에서 계산한 요일**인가. 제안은 (a) -- 화면이 "요일별"로 묶는 이유가 방영 편성 라벨이기 때문. 이 경우 같은 시리즈의 모든 회차가 같은 요일이어야 하는데, 지금은 **시리즈 표가 없어 불일치를 DB가 못 잡는다**(아래 3절 위험). 요일 기준 시간대는 라벨(a)이면 필요 없고 (b)이면 설정된 시간대가 필요하다.

### 2-3. 공통 규칙 (기존 스타일 그대로)

- 알 수 없는 필드 400은 유지. 새 필드는 **허용 목록에 추가**(해시 필드 목록·`validateImportRequest`)하며, `film`에 시리즈 필드·`drama`에 `genre` 등 **종류에 안 맞는 필드는 400**(`not_allowed_for_kind`류, 기존 `not_before_forbidden_for_news`와 같은 방식).
- **`spec_version`은 1 그대로**(선택 필드 추가라 옛 전송이 깨지지 않음). 규격 문서에는 "1.1: 선택 필드 추가"로 적는 것을 제안한다. 새 필드를 **옛 서버에 보내면 400**(알 수 없는 필드) -- 서버를 먼저 배포하고 소스가 뒤에 보내는 순서를 지켜야 한다.
- 해시: 새 필드는 해시에 **포함**(내용의 일부). 옛 행은 필드 없음 = absent라 해시가 안 바뀜.
- 값의 수정: 새 칸을 **수입 시점에 정해지는 값**으로 본다. **본부 확정: 정정은 새 `source_version`만**(새 승인 id). 어드민 수정 경로(새 RPC + 감사 필드 추가)는 만들지 않는다.

## 3. 기존 Phase 2 "Series / Season / Episode"와 합치기

설계서의 Phase 2 방향: `Series -> Season -> Episode -> Episode Version -> final_release Approval`, 한 편 = 독립 승인, **Series 관계는 additive, `kind`는 안 늘린다**, "Phase 1에 `series_id` 한 칸을 급하게 넣지 않는다".

**제안: 2단계로 나눈다.**

- **A안 (엔터 첫 완성본 전, 작게):** `contents`에 **nullable 컬럼**만 추가 -- `genre`, `series_ref`, `series_title`, `season_no`, `episode_no`, `release_weekday`. 시리즈·시즌 **표는 만들지 않는다.** 시리즈 단위 속성(`series_title`, `release_weekday`)은 **각 회차 행에 중복해서** 들어간다(스냅샷). 이것은 §12-3의 "시리즈로 묶는 것은 스키마가 아니라 쿼리 변경"에 맞고, `kind`를 늘리지 않으며, 승인 단위(회차마다 독립 승인)도 그대로다.
- **B안 (Phase 2 본 설계):** `content_series`(`series_ref` PK, 제목, 요일, …) 표를 만들고 `contents.series_ref`를 참조로 바꾼다. A안 컬럼에서 **백필**(같은 `series_ref` 행들의 제목·요일이 서로 다르면 그 목록을 사람이 확인). A안 컬럼 이름이 B안과 겹치게 지었으므로 마이그레이션이 "컬럼 하나 FK로 승격"에 가깝다.
- A안의 약점(스냅샷 중복): 같은 시리즈의 회차들이 서로 다른 `release_weekday`/`series_title`로 들어오면 DB가 모른다. **본부 확정: 수입 RPC가 같은 `(source, series_ref)`의 기존 행과 다르면 409 `series_conflict`로 거절한다.** 코드가 아니라 RPC 변경이라 `CREATE OR REPLACE` 후 `prosrc` 되읽기(그 정의에만 있는 토큰 둘 이상)와 함수 ACL 확인이 필요하다. 구현 시 정할 것: 비교 대상 필드(`series_title`·`release_weekday`), 같은 `source_version` 재전송(멱등)과의 관계, 시리즈의 첫 회차는 비교 대상이 없다는 점.
- `production_origin` / `client_id`(CF 구분, 제니2 10-07 안, Phase 2): **본부 확정: 따로, Phase 2 보류 유지.** 같은 RPC·검증·해시를 건드리는 별도 개정이 되므로 규격 개정과 RPC 재정의가 **두 번** 생긴다는 비용은 알고 간다.

## 4. 이미 수입된 행과의 호환

- **스키마:** `ADD COLUMN`(nullable)만 -- 기존 행은 전부 NULL, 기본 쓰기 경로(`content_import`의 `INSERT`는 컬럼을 명시)도 안 깨진다(§12-3).
- **해시:** 새 필드가 없으면 absent = 기존 해시 그대로 -> 재전송 멱등(200) 유지. **옛 `source_version`에 새 필드를 얹어 다시 보내면 해시가 달라져 409**이므로 이미 들어간 행의 정정은 새 버전.
- **화면:** 장르·요일이 NULL인 행은 분류 화면에서 어디에 두는지 정해야 한다(제안: 영화는 "기타/전체" 탭에만, 드라마는 "요일 미정" 묶음). 뉴스는 이 필드를 안 쓴다.
- **공개 응답:** `PUBLIC_CONTENT_COLUMNS`에 새 컬럼을 의도적으로 추가(공개해도 되는 기술적 라벨). `NEVER_PUBLIC_KEYS` 변경 없음. 컬럼을 추가하면 **라이브 컬럼 프로브를 다시 돌린다**(잘못된 컬럼명 = 쿼리 실패 = 404가 조용히 나는 구조라서, `probe-public-columns.mjs`).
- **라이브에 엔터 행이 이미 있는지**: 아래 읽기 SQL로 확인. 있다면 그 행들은 새 칸이 NULL인 채로 남고, 채우려면 새 버전이다.

## 5. 엔터 쪽 변경 범위 (A안 기준, 작업 목록)

| 영역 | 변경 | 비고 |
|---|---|---|
| 수입 규격 문서 | 필드 표(§2) + "1.1" 표기 + 종류별 허용·금지 + 서버 먼저 배포 순서 | 본부 승인. 제니2·production_os가 읽는 문서 |
| `lib/content-kinds.ts` | 장르 허용 목록, 요일 목록 | 장르 초안은 제니2 |
| `lib/content-import.ts`·`lib/content-hash.ts` | 새 선택 필드 파싱·종류별 검증·해시 목록 | 시험(해시 동치·종류 금지·묶음 규칙) + **훼손 시험** |
| DB | `contents` ADD COLUMN 6개 + CHECK(요일 7값, 번호 ≥ 1, 시리즈 3종 묶음) + `content_import` RPC 재정의(INSERT 컬럼 추가) | **SQL은 TK님이 Run**, `CREATE OR REPLACE` Success ≠ 반영이므로 `prosrc`에 새 컬럼 토큰 둘 이상 되읽기, 함수 ACL `aclexplode` 확인, 시그니처 불변이라 오버로드 없음 |
| 공개 쿼리 | `PUBLIC_CONTENT_COLUMNS` + `toPublicContent`에 새 필드 + 프로브 | `lib/content-public*.ts` |
| 화면(나중) | 영화 장르 탭/필터, 드라마 요일 묶음 + 시리즈 카드(회차 접기) | `lib/home-sections.ts`·`lib/home-feed.ts`·`app/_site/SectionPage.tsx`. **엔터 첫 완성본 이후** |
| 문구 | 장르 이름 10여 개, 요일 이름 7개, "요일 미정" 등 | **제니3** (내가 쓰지 않음) |
| 어드민 | 목록에 표시만(선택). 수정 경로는 만들지 않음 | |
| 해당 없음 | 송출(`dist_*`)·크론·반송·알림 | 영향 없음 |

## 6. 결정 현황 (본부 확정 2026-10-12, TK님 몫은 대기)

| # | 결정 | 상태 | 내용 |
|---|---|---|---|
| 1 | `release_weekday`의 뜻 | **TK님 대기** | 내 추천: 시리즈 고정 방영 요일 라벨(회차 공개일 계산은 시간대 문제를 끌고 옴). 규격 문구는 이 답을 받은 뒤 본부가 확정 |
| 2 | 시리즈 속성 불일치 | **확정(본부)** | 같은 `(source, series_ref)`와 다르면 409 `series_conflict` 거절 |
| 3 | 장르 | **확정(본부)** | 단일 대표 장르, 목록 초안은 제니2 |
| 4 | 시리즈 없는 드라마 단편 | **확정(본부)** | 허용(시리즈 세 칸 모두 없음) |
| 5 | `production_origin`·`client_id` | **확정(본부)** | 따로, Phase 2 보류 유지 |
| 6 | 정정 경로 | **확정(본부)** | 새 버전만, 어드민 수정 경로 없음 |
| 7 | 타이밍 | **확정** | ⑩ 후 필드 확정 -> 첫 완성본 전 스키마·수입 코드 -> 화면은 이후 |

**확정이 만든 후속 일(구현은 ⑩ 후):** 2번이 RPC 로직을 늘림(§3), 5번이 규격 개정을 두 번으로 만듦, 6번 때문에 첫 완성본 전에 필드 값이 정확해야 함(제니2 확인 절차 필요).

## 7. 읽기 SQL 초안 (실행 금지, TK님 Run 때 채팅 본문으로)

라이브 엔터 행이 이미 있는지·형태 확인:
```sql
select kind, form, status, rights_status, count(*) as n from public.contents where source_ref not like 'probe-%' group by kind, form, status, rights_status order by kind, form, status, rights_status;
```

`contents`에 이미 해당 이름의 컬럼이 있는지(코드 파일만 보고 없다고 한 가정의 확인, 컬럼 부재는 이렇게만 증명됨):
```sql
select column_name, data_type, is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'contents' and column_name in ('genre', 'series_ref', 'series_title', 'season_no', 'episode_no', 'release_weekday') order by column_name;
```
`information_schema`는 권한에 따라 컬럼을 가릴 수 있으니(PG17 ACL 함정) 0행이면 `pg_attribute`로 한 번 더 확인한다.

## 8. 한계

- 코드와 설계서·SQL 파일을 읽고 쓴 계획이며 **라이브 DB·어드민은 이번에 읽지 않았습니다.** 라이브 `contents` 스키마가 `phase1_step1` 파일과 같다는 것은 가정입니다.
- `ADD COLUMN`·`CHECK`·RPC 재정의의 동작은 라이브에서 돌려 본 적이 없고, 이 문서에 SQL 본문은 일부러 적지 않았습니다(필드 확정 전에 쓰면 낡음).
- 화면 묶기·시리즈 카드 설계는 다루지 않았습니다(범위 밖).
