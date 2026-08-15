// platform_config write-path validation for /admin/settings. Pure + no
// 'server-only' on purpose (same reasoning as lib/promo-schedule.ts): the
// settings form wants the identical rejection logic client-side, for
// immediate feedback, that the server action enforces as the real gate.
//
// The rule this exists to enforce (HQ 2026-08-15): "saved" must never mean
// anything other than "the value now matches value_type" -- a bool key that
// accepts the string "yes", or an int key that accepts "abc", is a silent
// footgun for whoever edits it next. value_type is the single source of
// truth for what shape a key's value can take; nothing here infers type from
// the key name.

export type ConfigValueType = 'bool' | 'int' | 'decimal' | 'text'

export type ValidateResult = { ok: true; normalized: string } | { ok: false; error: string }

// Master-switch keys (member_hosted_enabled, membership_enabled,
// session6_enabled, studio_purchase_enabled as of 2026-08-15) -- these flip
// whole public surfaces on/off, so the UI gates them behind a second
// explicit confirm step before writing. Suffix match, not a hardcoded list,
// so a newly added `*_enabled` key is covered automatically.
export function isRiskKey(key: string): boolean {
  return key.endsWith('_enabled')
}

const INT_RE = /^-?\d+$/
const DECIMAL_RE = /^-?\d+(\.\d+)?$/

export function validateConfigValue(valueType: string, raw: string): ValidateResult {
  switch (valueType) {
    case 'bool':
      if (raw !== 'true' && raw !== 'false') {
        return { ok: false, error: `bool 값은 true/false만 허용됩니다 (받은 값: "${raw}")` }
      }
      return { ok: true, normalized: raw }

    case 'int': {
      const trimmed = raw.trim()
      if (!INT_RE.test(trimmed)) {
        return { ok: false, error: `int 값은 정수만 허용됩니다 (받은 값: "${raw}")` }
      }
      return { ok: true, normalized: trimmed }
    }

    case 'decimal': {
      const trimmed = raw.trim()
      if (!DECIMAL_RE.test(trimmed) || !Number.isFinite(Number(trimmed))) {
        return { ok: false, error: `decimal 값은 숫자만 허용됩니다 (받은 값: "${raw}")` }
      }
      return { ok: true, normalized: trimmed }
    }

    case 'text':
      return { ok: true, normalized: raw.trim() }

    default:
      return { ok: false, error: `알 수 없는 value_type: "${valueType}"` }
  }
}
