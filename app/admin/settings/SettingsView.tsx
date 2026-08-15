'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminLang } from '@/lib/admin-i18n'
import { validateConfigValue, isRiskKey, type ValidateResult } from '@/lib/settings-validate'
import { updateConfigValueAction, updateConfigDescriptionKoAction } from './actions'
import { AdminPageHeader } from '../AdminPageHeader'

export type ConfigRow = {
  key: string
  value: string
  valueType: string
  description: string | null
  descriptionKo: string | null
  updatedAt: string
}

export type HistoryRow = {
  key: string
  field: string
  valueType: string
  oldValue: string | null
  newValue: string
  changedByEmail: string
  changedAt: string
}

const DICT = {
  ko: {
    title: '설정',
    subtitle:
      'platform_config -- 운영자가 바꿀 수 있는 값 전부를 한 곳에서. value_type(bool/int/decimal/text)이 타입을 강제하고, _enabled로 끝나는 스위치는 저장 전 한 번 더 확인합니다.',
    type: '타입',
    save: '저장',
    saving: '저장 중…',
    saved: '저장됨',
    no_desc: '(설명 없음)',
    no_desc_ko: '한국어 설명이 아직 없습니다. 아래에 입력하고 저장하세요.',
    en_source_prefix: '영어 원문',
    view_original: '원문 보기',
    hide_original: '원문 접기',
    edit_korean: '한국어 편집',
    hide_korean: '한국어 접기',
    risk_badge: '위험',
    err_bool_invalid: (raw: string) => `bool 값은 true/false만 허용됩니다 (받은 값: "${raw}")`,
    err_int_invalid: (raw: string) => `int 값은 정수만 허용됩니다 (받은 값: "${raw}")`,
    err_decimal_invalid: (raw: string) => `decimal 값은 숫자만 허용됩니다 (받은 값: "${raw}")`,
    err_unknown_type: (valueType: string) => `알 수 없는 value_type: "${valueType}"`,
    ko_desc_placeholder: '한국어 설명 입력…',
    risk_warn: '이 스위치는 공개 화면 전체를 켜고 끕니다. 정말 바꾸시겠습니까?',
    risk_confirm: '확인, 변경',
    risk_cancel: '취소',
    from_to: (from: string, to: string) => `${from} -> ${to}`,
    history_title: '변경 이력',
    history_empty: '아직 변경 기록이 없습니다.',
    col_when: '시각',
    col_who: '관리자',
    col_key: '키',
    col_field: '항목',
    col_change: '변경',
    field_value: '값',
    field_description_ko: '설명(KO)',
    bool_on: 'ON',
    bool_off: 'OFF',
  },
  en: {
    title: 'Settings',
    subtitle:
      'platform_config -- every operator-set value in one place. Type is enforced by value_type (bool/int/decimal/text); switches ending in _enabled ask for a second confirm before saving.',
    type: 'Type',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    no_desc: '(no description)',
    no_desc_ko: 'No Korean description yet -- add one below and save.',
    en_source_prefix: 'EN source',
    view_original: 'View original',
    hide_original: 'Hide original',
    edit_korean: 'Edit Korean',
    hide_korean: 'Hide Korean',
    risk_badge: 'risk',
    err_bool_invalid: (raw: string) => `bool only accepts true/false (got: "${raw}")`,
    err_int_invalid: (raw: string) => `int only accepts a whole number (got: "${raw}")`,
    err_decimal_invalid: (raw: string) => `decimal only accepts a number (got: "${raw}")`,
    err_unknown_type: (valueType: string) => `unknown value_type: "${valueType}"`,
    ko_desc_placeholder: 'Korean description…',
    risk_warn: 'This switch turns a public surface on/off for everyone. Apply this change?',
    risk_confirm: 'Confirm change',
    risk_cancel: 'Cancel',
    from_to: (from: string, to: string) => `${from} -> ${to}`,
    history_title: 'Change history',
    history_empty: 'No changes recorded yet.',
    col_when: 'When',
    col_who: 'Admin',
    col_key: 'Key',
    col_field: 'Field',
    col_change: 'Change',
    field_value: 'value',
    field_description_ko: 'description (KO)',
    bool_on: 'ON',
    bool_off: 'OFF',
  },
}

type Dict = (typeof DICT)['en']

function validationErrorText(result: ValidateResult, t: Dict): string | null {
  if (result.ok) return null
  switch (result.errorCode) {
    case 'bool_invalid':
      return t.err_bool_invalid(result.raw)
    case 'int_invalid':
      return t.err_int_invalid(result.raw)
    case 'decimal_invalid':
      return t.err_decimal_invalid(result.raw)
    case 'unknown_type':
      return t.err_unknown_type(result.valueType)
  }
}

export function SettingsView({ rows, history }: { rows: ConfigRow[]; history: HistoryRow[] }) {
  const lang = useAdminLang()
  const t = DICT[lang]

  return (
    <div className="p-8 max-w-5xl">
      <AdminPageHeader title={t.title} subtitle={t.subtitle} />
      <div className="space-y-3">
        {rows.map((row) => (
          <SettingsRow key={row.key} row={row} t={t} />
        ))}
      </div>

      <section className="mt-10 border border-white/10 rounded p-5 bg-white/[.02]">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-3">
          {t.history_title}
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-white/40">{t.history_empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-white/40 uppercase tracking-wider">
                  <th className="pb-2 pr-4 font-normal">{t.col_when}</th>
                  <th className="pb-2 pr-4 font-normal">{t.col_who}</th>
                  <th className="pb-2 pr-4 font-normal">{t.col_key}</th>
                  <th className="pb-2 pr-4 font-normal">{t.col_field}</th>
                  <th className="pb-2 font-normal">{t.col_change}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="py-2 pr-4 text-white/50 whitespace-nowrap">
                      {new Date(h.changedAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 text-white/70 whitespace-nowrap">{h.changedByEmail}</td>
                    <td className="py-2 pr-4 font-mono text-white/80">{h.key}</td>
                    <td className="py-2 pr-4 text-white/50 whitespace-nowrap">
                      {h.field === 'description_ko' ? t.field_description_ko : t.field_value}
                    </td>
                    <td className="py-2 text-white/70">
                      {t.from_to(h.oldValue ?? '(null)', h.newValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function SettingsRow({ row, t }: { row: ConfigRow; t: Dict }) {
  const router = useRouter()
  const [draft, setDraft] = useState(row.value)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const risk = isRiskKey(row.key)
  const validation = validateConfigValue(row.valueType, draft)
  const dirty = draft !== row.value
  const canSave = dirty && validation.ok && !pending

  function commit() {
    setError(null)
    setMsg(null)
    startTransition(async () => {
      const res = await updateConfigValueAction(row.key, draft)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setMsg(t.saved)
      setConfirming(false)
      router.refresh()
    })
  }

  function handleSaveClick() {
    if (!validation.ok || !dirty) return
    if (risk) {
      setConfirming(true)
      return
    }
    commit()
  }

  return (
    <div className="border border-white/10 rounded p-4 bg-white/[.02]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <code className="text-sm font-bold text-white">{row.key}</code>
            <span className="text-[9px] uppercase tracking-wider text-white/40 border border-white/15 rounded px-1.5 py-0.5">
              {row.valueType}
            </span>
            {risk && (
              <span className="text-[9px] uppercase tracking-wider text-[#ff8844] border border-[#ff8844]/40 rounded px-1.5 py-0.5">
                {t.risk_badge}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {row.valueType === 'bool' ? (
            <BoolControl
              value={draft}
              disabled={pending}
              onChange={(v) => {
                setDraft(v)
                setMsg(null)
                setError(null)
              }}
              t={t}
            />
          ) : (
            <input
              type="text"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setMsg(null)
                setError(null)
              }}
              disabled={pending}
              className="w-56 px-3 py-1.5 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none disabled:opacity-50"
            />
          )}

          <button
            type="button"
            onClick={handleSaveClick}
            disabled={!canSave}
            className="px-3 py-1.5 rounded bg-[#ff4444]/80 text-white text-xs font-bold uppercase tracking-wider hover:bg-[#ff4444] transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {pending ? t.saving : t.save}
          </button>
        </div>
      </div>

      <DescriptionKoEditor rowKey={row.key} description={row.description} descriptionKo={row.descriptionKo} t={t} />

      {!validation.ok && dirty && (
        <p className="mt-2 text-xs text-[#ff8888]">{validationErrorText(validation, t)}</p>
      )}
      {error && <p className="mt-2 text-xs text-[#ff8888]">{error}</p>}
      {msg && !error && <p className="mt-2 text-xs text-[#6cff9c]">{msg}</p>}

      {confirming && (
        <div className="mt-3 border border-[#ff4444]/40 bg-[#ff4444]/[.06] rounded p-3">
          <p className="text-xs text-[#ff8888] font-bold mb-1">{t.risk_warn}</p>
          <p className="text-xs text-white/60 mb-3">{t.from_to(row.value, draft)}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={commit}
              disabled={pending}
              className="px-3 py-1.5 rounded bg-[#ff4444] text-white text-xs font-bold uppercase tracking-wider hover:brightness-110 transition disabled:opacity-40"
            >
              {pending ? t.saving : t.risk_confirm}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="px-3 py-1.5 rounded border border-white/15 text-white/70 text-xs font-bold uppercase tracking-wider hover:text-white transition"
            >
              {t.risk_cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// The screen follows the language toggle -- it does not show both languages
// at once (HQ 2026-08-16: an earlier instruction to "keep the English
// original visible" was about PRESERVATION in the DB, not simultaneous
// on-screen display; conflating the two meant Korean mode still showed the
// English caption and English mode still showed the Korean textarea). Korean
// mode shows Korean primarily -- English is one click away via "View
// original," never deleted. English mode shows English primarily -- Korean
// is one click away via "Edit Korean." If Korean is empty, its slot shows
// English instead of going blank, but as a PLACEHOLDER only (never written
// back as a fake translation).
function DescriptionKoEditor({
  rowKey,
  description,
  descriptionKo,
  t,
}: {
  rowKey: string
  description: string | null
  descriptionKo: string | null
  t: Dict
}) {
  const lang = useAdminLang()
  const router = useRouter()
  const [draft, setDraft] = useState(descriptionKo ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const dirty = draft.trim() !== (descriptionKo ?? '')
  const canSave = dirty && !pending

  function save() {
    setError(null)
    setMsg(null)
    startTransition(async () => {
      const res = await updateConfigDescriptionKoAction(rowKey, draft)
      if (!res.ok) {
        setError(res.error)
        return
      }
      setMsg(t.saved)
      router.refresh()
    })
  }

  const koEditor = (
    <div className="flex items-start gap-2 max-w-xl">
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          setMsg(null)
          setError(null)
        }}
        disabled={pending}
        rows={2}
        placeholder={descriptionKo ? undefined : description || t.no_desc_ko}
        className="flex-1 px-2.5 py-1.5 bg-[#100608] border border-white/10 rounded text-xs text-white/85 focus:border-[#ff8844] focus:outline-none disabled:opacity-50 resize-y"
      />
      <button
        type="button"
        onClick={save}
        disabled={!canSave}
        className="shrink-0 px-2.5 py-1.5 rounded bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-white/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {pending ? t.saving : t.save}
      </button>
    </div>
  )

  const toggleBtn = (label: string) => (
    <button
      type="button"
      onClick={() => setExpanded((x) => !x)}
      className="mt-1.5 text-[10px] text-white/40 hover:text-white/70 underline underline-offset-2"
    >
      {label}
    </button>
  )

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      {lang === 'ko' ? (
        <>
          {koEditor}
          {toggleBtn(expanded ? t.hide_original : t.view_original)}
          {expanded && (
            <p className="mt-1 text-xs text-white/40 italic">
              {t.en_source_prefix}: {description || t.no_desc}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-white/70 max-w-xl">{description || t.no_desc}</p>
          {toggleBtn(expanded ? t.hide_korean : t.edit_korean)}
          {expanded && <div className="mt-1.5">{koEditor}</div>}
        </>
      )}
      {error && <p className="mt-1.5 text-xs text-[#ff8888]">{error}</p>}
      {msg && !error && <p className="mt-1.5 text-xs text-[#6cff9c]">{msg}</p>}
    </div>
  )
}

function BoolControl({
  value,
  disabled,
  onChange,
  t,
}: {
  value: string
  disabled: boolean
  onChange: (v: string) => void
  t: Dict
}) {
  const on = value === 'true'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(on ? 'false' : 'true')}
      className={`relative h-7 w-14 shrink-0 rounded-full transition disabled:opacity-50 ${
        on ? 'bg-[#ff4444]' : 'bg-white/15'
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${on ? 'left-8' : 'left-1'}`}
      />
      <span className="sr-only">{on ? t.bool_on : t.bool_off}</span>
    </button>
  )
}
