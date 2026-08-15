'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminLang } from '@/lib/admin-i18n'
import { validateConfigValue, isRiskKey } from '@/lib/settings-validate'
import { updateConfigValueAction, updateConfigDescriptionKoAction } from './actions'

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
    type: '타입',
    save: '저장',
    saving: '저장 중…',
    saved: '저장됨',
    no_desc: '(설명 없음)',
    no_desc_ko: '한국어 설명이 아직 없습니다. 아래에 입력하고 저장하세요.',
    en_source_prefix: '영어 원문',
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
    type: 'Type',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    no_desc: '(no description)',
    no_desc_ko: 'No Korean description yet -- add one below and save.',
    en_source_prefix: 'EN source',
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

export function SettingsView({ rows, history }: { rows: ConfigRow[]; history: HistoryRow[] }) {
  const lang = useAdminLang()
  const t = DICT[lang]

  return (
    <div>
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
                risk
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
        <p className="mt-2 text-xs text-[#ff8888]">{validation.error}</p>
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

// English description stays visible and untouched (source of truth for
// code/docs); Korean is what TK actually reads on this screen, so it is the
// prominent, editable field (HQ 2026-08-15: "번역해서 넣어주면 다음에 또 우리를
// 찾으신다" -- TK edits it himself here, same RPC + history as a value save).
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
  const router = useRouter()
  const [draft, setDraft] = useState(descriptionKo ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

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

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <p className="text-xs text-white/40 italic">
        {t.en_source_prefix}: {description || t.no_desc}
      </p>
      <div className="mt-1.5 flex items-start gap-2 max-w-xl">
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setMsg(null)
            setError(null)
          }}
          disabled={pending}
          rows={2}
          placeholder={descriptionKo ? undefined : t.no_desc_ko}
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
