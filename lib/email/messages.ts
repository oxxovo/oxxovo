// Shared boilerplate copy reused across multiple email templates. Centralized
// so policy changes propagate to every email in one edit instead of six.
//
// RESULT_INTEGRITY_NOTE_* states OXXOVO's automation philosophy in the form
// every outcome-bearing email uses: AI decides by default; operator review
// is reserved for system errors or fraud, and is documented publicly when
// invoked. Phrasing was tuned together with TK so it is honest (not
// absolutist) about the operator override path.

export const RESULT_INTEGRITY_NOTE_KO =
  'OXXOVO 운영진은 결과 결정에 직접 개입하지 않으며, Triple-AI 시스템이 ' +
  '객관적으로 결정합니다. 단, 시스템 오류 또는 부정 발견 시에만 예외적으로 ' +
  '검토 및 정정이 진행되며, 이 경우 투명하게 공개됩니다.'

export const RESULT_INTEGRITY_NOTE_EN =
  'OXXOVO operators do not directly intervene in outcomes — the Triple-AI ' +
  'system determines results objectively. Exceptions are made only in cases ' +
  'of system errors or fraud, and all such cases are publicly documented.'
