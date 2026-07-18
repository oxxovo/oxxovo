# Stage 3 — CryptoBind v1i 설계 구체안 (2.2 착수 전 검토용) -- 2026-07-18, 지수2

기존 실코드 앵커: `oxxovo/lib/cryptobind.ts`(main, `sign(payload)` 시크릿 내부, verify 보유) / `oxxovo-studio/src/cryptobind.ts`(worker, `sign(secret,payload)` 시크릿 인자, build만). 기존 패턴 그대로 확장.

기존 계약(불변): v1 `v1|pid|tid|jobId|generatedAt|modelId|duration` · v1c `v1c|jobId|tid|contentHash` · v1sr/v1sc/edl1 · bundle=`sha256(sort(sigs).join('|'))` · HMAC-SHA256 hex · `|` 조인 · timingSafeEqual.

## 1. 신규 3서명 — 서명 재료

| 버전 | 캐노니컬 문자열 | 서명자 | 저장 컬럼 |
|---|---|---|---|
| **v1i** 이미지 생성 | `v1i\|pid\|tid\|jobId\|generatedAt.toISOString()\|modelId` (★duration 없음) | main, createImageGeneration | 기존 cryptobind_pid/tid/generated_at/**signature**/algo 재사용 |
| **v1ic** 이미지 콘텐츠 | `v1ic\|jobId\|tid\|imageHash` (imageHash=sha256(이미지 bytes)) | worker, R2 업로드 후 | 기존 cryptobind_content_hash/_signature 재사용 |
| **v1v** i2v 생성 | `v1v\|pid\|tid\|jobId\|generatedAt.toISOString()\|modelId\|String(duration)\|parentBundle` | main, createI2vGeneration | 기존 cryptobind_signature + 신규 cryptobind_parent_bundle |

- **v1i** = v1에서 duration만 뺀 것(이미지엔 duration 없음). 이미지 잡은 일반 generation_jobs 행(media_type='image'), cryptobind 컬럼 그대로 씀.
- **v1ic** = v1c의 이미지판(버전태그만 분리). hashImageContent = hashVideoContent와 동일 sha256.
- **v1v** = v1 + `parentBundle` 1필드. i2v 클립의 콘텐츠서명은 **신규 아님 = 기존 v1c 재사용**(산출이 비디오라서). 즉 v1v는 *생성서명만* 확장, 콘텐츠는 비디오와 동일.

## 2. i2v 부모 바인딩 = parentBundle

- `parentBundle = sha256( 부모 이미지잡들의 v1i 서명(=그 잡의 cryptobind_signature)을 정렬·'|'join )` = 기존 `computeSourceBundle` **그대로 재사용**(compose sourceBundle과 동일 함수).
- createI2vGeneration: start_image + elements(frontal + references)로 쓰이는 **부모 이미지 잡들의 cryptobind_signature 수집 → parentBundle → v1v 서명에 포함**. cryptobind_parent_bundle 컬럼에 저장(투명성용).
- 검증은 저장값을 신뢰하지 않고 **live 부모에서 재계산**(compose가 sourceBundle을 재계산하는 것과 동일). 저장 컬럼은 참고용.

## 3. 제출 검증 체인 (submitRender, 단계별 무엇을 검증)

기존 submitRender: verifyComposeBind(render, tid, sourceSignatures) + 소스 루프에서 각 클립 verifyCryptoBind. 확장:

```
[1] 최종 render → verifyComposeBind(v1sr + v1sc)
      · algo=HMAC-SHA256, cryptobind_tid==현재시즌
      · EDL 재계산 == render_signature (편집리스트 불변)
      · final_hash 서명 == final_signature (완성본 바이트 불변)
[2] 각 소스 클립(EDL의 jobId) 로드:
      · 본인(user_id==pid) + 동일시즌(cryptobind_tid==tid) + status ready/submitted
      · media_type='video' AND parent_image_job_ids 비어있음  → 기존 verifyCryptoBind(v1/v1c)
      · media_type='video' AND parent_image_job_ids 있음(=i2v) → [3]으로
[3] i2v 클립 검증:
      · 각 부모 이미지잡 로드 → verifyImageBind(v1i/v1ic)
            - algo, cryptobind_tid==tid(동일시즌), v1i 서명 일치
            - v1ic 있으면 콘텐츠서명 일치
      · 부모 본인(user_id==pid) + status ready
      · 부모들의 cryptobind_signature 수집 → parentBundle 재계산
      · verifyI2vBind: v1v 캐노니컬(재계산 parentBundle 포함) == 클립 cryptobind_signature
      · 클립 v1c 콘텐츠서명 일치(비디오와 동일)
```
통과 = 완성본이 *본인계정·동일시즌 플랫폼이미지에서 파생된 i2v 클립들의, 이 EDL대로의* 조합임 증명.

## 4. 양 레포 lockstep — 구체적으로 뭘 미러하나

기존 규칙 준수: **build/canonical/hash 함수는 양 레포 byte-identical, verify 함수는 main 전용**(worker엔 verifyComposeBind 없음 = verifyImageBind/verifyI2vBind도 worker에 안 둠).

| 함수 | main(lib) | worker(src) | 실제 호출 |
|---|---|---|---|
| IMAGE/I2V 버전상수, imageCanonicalString, imageContentCanonicalString, i2vCanonicalString | ✅ | ✅ (byte-mirror) | canonical은 양쪽 동일 |
| hashImageContent | ✅ | ✅ | worker가 v1ic 계산 |
| buildImageBind (v1i) | ✅ | ✅(미러) | **main**만 호출(enqueue) |
| buildImageContentBind (v1ic) | ✅ | ✅ | **worker**가 호출(콘텐츠) → **main이 검증** = 크로스레포 필수미러 |
| buildI2vBind (v1v) | ✅ | ✅(미러) | **main**만 호출(enqueue) |
| computeSourceBundle(=parentBundle) | ✅(존재) | ✅(존재) | 재사용 |
| verifyImageBind / verifyI2vBind | ✅ | ✗ | main 전용(compose verify 패턴 동일) |

- **필수 크로스레포**: v1ic(worker 서명 → main 검증) = v1c와 동일 성격. 여기가 틀리면 조용한 실패.
- **규율상 미러**: v1i/v1v는 main이 서명+검증하지만, 두 파일이 갈라지지 않게 build+canonical을 worker에도 동일 복사(기존 v1sr도 worker에 dead-copy됨 = 선례).
- 착수 시: 두 파일의 신규 영역 diff가 시크릿 주입 방식(내부 vs 인자) 외엔 **완전 동일**함을 커밋 전 확인.

### 변조거부 테스트 4종 — 각각 무엇을 막나
1. **부모 이미지 스왑**: parent_image_job_ids를 사후 다른 이미지로 교체 → live 부모에서 parentBundle 재계산이 달라짐 → v1v 서명 불일치 reject. (+ 스왑 부모가 본인/시즌 검사도 실패)
2. **parentBundle 위조**: cryptobind_parent_bundle 컬럼만 조작 → 검증은 저장값 무시하고 live 재계산 → 무효. 설령 부모까지 맞춰도 v1v 재서명은 시크릿 없이 불가 → signature_mismatch reject.
3. **외부 이미지 URL 주입**: start_image/elements에 외부 URL → 그 픽셀엔 generation_jobs 행·v1i 서명 없음. 서버는 job id(uuid)만 수용, 외부 URL 경로 자체가 없음 → 부모 resolve 실패 reject. **구조적 차단.**
4. **타 시즌 이미지 참조**: 본인의 다른 시즌 이미지잡을 부모로 → verifyImageBind tid 검사 + 명시적 동일시즌 검사 실패 reject.

## 5. 외부 이미지 업로드 차단 (Genesis Rule)
- createI2vGeneration은 **parent_image_job_ids(uuid[])만 받음** — raw URL 파라미터 없음.
- 각 uuid를 generation_jobs 행으로 resolve: media_type='image' AND user_id==caller AND season_id==현재 AND status='ready'. 하나라도 불만족이면 생성 거부.
- fal 입력의 start_image_url/elements는 **서버가 그 부모잡의 image_url(내부 R2)로 조립**. 참가자 입력이 URL을 직접 주입할 지점 없음.
- 외부 픽셀 = v1i 서명 부재 = 부모 자격 없음 = i2v 불가. 코드 없이 **불변식으로 차단**.

## 6. 신규 심볼 요약 (착수 시 추가)
- 상수: `IMAGE_CANON_VERSION='v1i'`, `IMAGE_CONTENT_VERSION='v1ic'`, `I2V_CANON_VERSION='v1v'` (양 레포)
- 함수(양 레포): imageCanonicalString, imageContentCanonicalString, i2vCanonicalString, hashImageContent, buildImageBind, buildImageContentBind, buildI2vBind
- 함수(main 전용): verifyImageBind(reason: unsupported_algo/tid_mismatch/signature_mismatch/content_mismatch), verifyI2vBind(reason: +parent_bundle_mismatch)
- 재사용: computeSourceBundle(parentBundle), buildContentBind/verifyCryptoBind의 v1c(i2v 콘텐츠), safeEqualHex, sign

## 7. 착수 조건
- 이 설계 TK 승인 → 2.2 착수. 양 레포 동시 편집 + 변조거부 4종 자동테스트 통과 → 커밋(양 레포 각각). session6 전 배포 금지, 마이그(2.1)는 이미 라이브라 코드가 컬럼 참조해도 안전.
