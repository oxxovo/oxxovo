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

// No error MESSAGE here on purpose -- this file has no admin-i18n access
// (it is imported client-side for instant feedback, same as
// lib/promo-schedule.ts), and a hardcoded string would not follow the
// language toggle (HQ 2026-08-16: exactly the class of bug this whole file's
// caller screen just got called out for). The UI translates errorCode.
export type ValidateErrorCode = 'bool_invalid' | 'int_invalid' | 'decimal_invalid' | 'unknown_type'

export type ValidateResult =
  | { ok: true; normalized: string }
  | { ok: false; errorCode: ValidateErrorCode; raw: string; valueType: string }

// Master-switch keys (member_hosted_enabled, membership_enabled,
// session6_enabled, studio_purchase_enabled as of 2026-08-15) -- these flip
// whole public surfaces on/off, so the UI gates them behind a second
// explicit confirm step before writing. Suffix match, not a hardcoded list,
// so a newly added `*_enabled` key is covered automatically.
export function isRiskKey(key: string): boolean {
  return key.endsWith('_enabled')
}

// Keys served from getPlatformConfigMap()'s 60s TTL cache (lib/partners.ts,
// HQ 2026-08-20) -- ip-check + cosmetic guard, the two generation-request hot
// paths. Explicit list, not a naming pattern: unlike isRiskKey these don't
// share a suffix, and most platform_config keys are still read fresh on every
// call, so this must never silently grow to keys that aren't actually cached.
const CACHED_KEYS = new Set([
  'ip_check_block_confidence',
  'cosmetic_guard_axis_a',
  'cosmetic_guard_axis_a_prime',
  'cosmetic_guard_axis_b',
  'cosmetic_guard_axis_c',
  'cosmetic_guard_exempt',
])

export function isCachedConfigKey(key: string): boolean {
  return CACHED_KEYS.has(key)
}

const INT_RE = /^-?\d+$/
const DECIMAL_RE = /^-?\d+(\.\d+)?$/

export function validateConfigValue(valueType: string, raw: string): ValidateResult {
  switch (valueType) {
    case 'bool':
      if (raw !== 'true' && raw !== 'false') {
        return { ok: false, errorCode: 'bool_invalid', raw, valueType }
      }
      return { ok: true, normalized: raw }

    case 'int': {
      const trimmed = raw.trim()
      if (!INT_RE.test(trimmed)) {
        return { ok: false, errorCode: 'int_invalid', raw, valueType }
      }
      return { ok: true, normalized: trimmed }
    }

    case 'decimal': {
      const trimmed = raw.trim()
      if (!DECIMAL_RE.test(trimmed) || !Number.isFinite(Number(trimmed))) {
        return { ok: false, errorCode: 'decimal_invalid', raw, valueType }
      }
      return { ok: true, normalized: trimmed }
    }

    case 'text':
      return { ok: true, normalized: raw.trim() }

    default:
      return { ok: false, errorCode: 'unknown_type', raw, valueType }
  }
}
