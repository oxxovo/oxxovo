// Shared boilerplate copy reused across multiple email templates. Centralized
// so policy changes propagate to every email in one edit instead of six.
//
// RESULT_INTEGRITY_NOTE_* states OXXOVO's automation philosophy in the form
// every outcome-bearing email uses: AI decides by default; operator review
// is reserved for system errors or fraud, and is documented publicly when
// invoked. Phrasing was tuned together with TK so it is honest (not
// absolutist) about the operator override path.

export const RESULT_INTEGRITY_NOTE_KO =
  'OXXOVO 운영진은 결과 결정에 직접 개입하지 않습니다. 순위는 복수의 이종 AI ' +
  '모델이 매긴 점수와 관객 투표를 합산해 정해집니다. 시스템 오류나 부정이 ' +
  '발견된 경우에만 예외적으로 검토하며, 그때는 내용을 공개합니다.'

export const RESULT_INTEGRITY_NOTE_EN =
  'OXXOVO staff do not intervene in results. Rankings come from scores by ' +
  'several independent AI models combined with audience votes. We review ' +
  'only in cases of system error or fraud, and we publish what we find.'
