'use client'

import { useActionState, useState } from 'react'
import { saveSeason, type SeasonFormState } from './actions'
import { type SeasonInput } from '@/lib/season-schema'

const initialState: SeasonFormState = { ok: false }

// ISO with offset → "YYYY-MM-DDTHH:mm" in user's local timezone (datetime-local input format)
function toDatetimeLocal(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const offsetMs = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16)
}

// datetime-local string (user's local time, no tz) → ISO 8601 with offset
function fromDatetimeLocal(v: string): string {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

export function SeasonForm({
  id,
  initial,
}: {
  id: string | null
  initial: SeasonInput
}) {
  const [state, formAction, pending] = useActionState(
    (prev: SeasonFormState, fd: FormData) => saveSeason(id, prev, fd),
    initialState,
  )
  const [aiModels, setAiModels] = useState(initial.ai_models)

  const fieldError = (key: string) => state.fieldErrors?.[key]?.[0]

  return (
    <form action={formAction} className="space-y-10">
      <input type="hidden" name="ai_models" value={JSON.stringify(aiModels)} />

      {/* Status banner */}
      {state.message && (
        <div
          className={`px-4 py-3 rounded border text-sm ${
            state.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-[#ff4444]/30 bg-[#ff4444]/10 text-[#ff8888]'
          }`}
        >
          {state.message}
        </div>
      )}

      <Group title="Season info">
        <Field label="Name" name="name" defaultValue={initial.name} error={fieldError('name')} />
        <Field label="Season #" name="season_number" type="number" defaultValue={initial.season_number} error={fieldError('season_number')} />
        <Select
          label="Status"
          name="status"
          defaultValue={initial.status}
          options={['draft', 'active', 'closed', 'completed']}
          error={fieldError('status')}
        />
      </Group>

      <Group title="Capacity & selection">
        <Field label="Max applicants" name="max_applicants" type="number" defaultValue={initial.max_applicants} error={fieldError('max_applicants')} />
        <Field label="Top N advance" name="top_n_advance" type="number" defaultValue={initial.top_n_advance} error={fieldError('top_n_advance')} />
      </Group>

      <Group title="Video length (seconds)">
        <Field label="Application min" name="application_video_min_seconds" type="number" defaultValue={initial.application_video_min_seconds} error={fieldError('application_video_min_seconds')} />
        <Field label="Application max" name="application_video_max_seconds" type="number" defaultValue={initial.application_video_max_seconds} error={fieldError('application_video_max_seconds')} />
        <Field label="Main round" name="main_round_video_seconds" type="number" defaultValue={initial.main_round_video_seconds} error={fieldError('main_round_video_seconds')} />
      </Group>

      <Group title="Timing">
        <Field label="Theme reveal (minutes before)" name="theme_announcement_minutes_before" type="number" defaultValue={initial.theme_announcement_minutes_before} error={fieldError('theme_announcement_minutes_before')} />
        <Field label="Submission window (hours)" name="submission_hours" type="number" defaultValue={initial.submission_hours} error={fieldError('submission_hours')} />
      </Group>

      <Group title="Prizes (USD)">
        <Field label="Total prize pool" name="total_prize_pool" type="number" step="1" defaultValue={initial.total_prize_pool} error={fieldError('total_prize_pool')} />
        <Field label="1st place" name="prize_first" type="number" step="1" defaultValue={initial.prize_first} error={fieldError('prize_first')} />
        <Field label="2nd place" name="prize_second" type="number" step="1" defaultValue={initial.prize_second} error={fieldError('prize_second')} />
        <Field label="3rd place" name="prize_third" type="number" step="1" defaultValue={initial.prize_third} error={fieldError('prize_third')} />
        <Field label="Entry fee" name="entry_fee" type="number" step="1" defaultValue={initial.entry_fee} error={fieldError('entry_fee')} />
      </Group>

      <Group title="Scoring split (must sum to 1.0)">
        <Field label="Community vote weight" name="community_vote_weight" type="number" step="0.01" defaultValue={initial.community_vote_weight} error={fieldError('community_vote_weight')} hint="e.g. 0.7" />
        <Field label="AI score weight" name="ai_score_weight" type="number" step="0.01" defaultValue={initial.ai_score_weight} error={fieldError('ai_score_weight')} hint="e.g. 0.3" />
      </Group>

      <Group title="AI judging weights (must sum to 1.0)">
        <Field label="Intent" name="scoring_intent_clarity_weight" type="number" step="0.01" defaultValue={initial.scoring_intent_clarity_weight} error={fieldError('scoring_intent_clarity_weight')} />
        <Field label="Execution" name="scoring_execution_weight" type="number" step="0.01" defaultValue={initial.scoring_execution_weight} error={fieldError('scoring_execution_weight')} />
        <Field label="Originality" name="scoring_originality_weight" type="number" step="0.01" defaultValue={initial.scoring_originality_weight} error={fieldError('scoring_originality_weight')} />
        <Field label="Integrity" name="scoring_integrity_weight" type="number" step="0.01" defaultValue={initial.scoring_integrity_weight} error={fieldError('scoring_integrity_weight')} />
      </Group>

      <Group title="AI panel">
        <div className="col-span-full">
          <AiModelsEditor models={aiModels} onChange={setAiModels} />
          {fieldError('ai_models') && (
            <p className="mt-2 text-xs text-[#ff8888]">{fieldError('ai_models')}</p>
          )}
        </div>
      </Group>

      <Group title="Integrity thresholds">
        <Field label="Integrity flag threshold" name="flag_integrity_threshold" type="number" defaultValue={initial.flag_integrity_threshold} error={fieldError('flag_integrity_threshold')} hint="0-100" />
        <Field label="Spread flag threshold" name="flag_spread_threshold" type="number" defaultValue={initial.flag_spread_threshold} error={fieldError('flag_spread_threshold')} hint="0-100" />
      </Group>

      <Group title="Schedule">
        <DatetimeField label="Application open" name="application_open_at" defaultValue={toDatetimeLocal(initial.application_open_at)} error={fieldError('application_open_at')} />
        <DatetimeField label="Application close" name="application_close_at" defaultValue={toDatetimeLocal(initial.application_close_at)} error={fieldError('application_close_at')} />
        <DatetimeField label="Scoring complete" name="scoring_complete_at" defaultValue={toDatetimeLocal(initial.scoring_complete_at)} error={fieldError('scoring_complete_at')} />
        <DatetimeField label="Main round start" name="main_round_start_at" defaultValue={toDatetimeLocal(initial.main_round_start_at)} error={fieldError('main_round_start_at')} />
        <DatetimeField label="Main round end" name="main_round_end_at" defaultValue={toDatetimeLocal(initial.main_round_end_at)} error={fieldError('main_round_end_at')} />
        <DatetimeField label="Awards announcement" name="awards_announcement_at" defaultValue={toDatetimeLocal(initial.awards_announcement_at)} error={fieldError('awards_announcement_at')} />
      </Group>

      <div className="flex items-center gap-3 pt-4 border-t border-white/10">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 rounded bg-gradient-to-br from-[#ff4444] to-[#cc3333] text-white font-bold text-sm uppercase tracking-wider hover:brightness-110 transition disabled:opacity-50"
        >
          {pending ? 'Saving…' : id ? 'Save changes' : 'Create season'}
        </button>
        <p className="text-xs text-white/40">
          Changes are visible on the public site immediately after save.
        </p>
      </div>
    </form>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-xs uppercase tracking-[0.2em] text-[#ff8844] font-bold mb-4">
        {title}
      </legend>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </fieldset>
  )
}

function Field({
  label, name, type = 'text', defaultValue, error, hint, step,
}: {
  label: string
  name: string
  type?: string
  defaultValue: string | number
  error?: string
  hint?: string
  step?: string
}) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5">{label}</div>
      <input
        name={name}
        type={type}
        step={step}
        defaultValue={String(defaultValue)}
        className={`w-full px-3 py-2 bg-[#100608] border rounded text-sm text-white focus:border-[#ff8844] focus:outline-none transition ${
          error ? 'border-[#ff4444]' : 'border-white/10'
        }`}
      />
      {hint && !error && <p className="mt-1 text-[10px] text-white/35">{hint}</p>}
      {error && <p className="mt-1 text-[10px] text-[#ff8888]">{error}</p>}
    </label>
  )
}

function Select({
  label, name, defaultValue, options, error,
}: {
  label: string
  name: string
  defaultValue: string
  options: string[]
  error?: string
}) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5">{label}</div>
      <select
        name={name}
        defaultValue={defaultValue}
        className={`w-full px-3 py-2 bg-[#100608] border rounded text-sm text-white focus:border-[#ff8844] focus:outline-none transition ${
          error ? 'border-[#ff4444]' : 'border-white/10'
        }`}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-[10px] text-[#ff8888]">{error}</p>}
    </label>
  )
}

function DatetimeField({
  label, name, defaultValue, error,
}: {
  label: string
  name: string
  defaultValue: string
  error?: string
}) {
  // datetime-local input value is "YYYY-MM-DDTHH:mm" in the user's local tz —
  // unsuitable for the zod `datetime({ offset: true })` validator. We render
  // a visible (unnamed) datetime-local and mirror the converted ISO value into
  // a hidden input that actually carries the field's `name` to the server.
  const [localValue, setLocalValue] = useState(defaultValue)
  const isoValue = fromDatetimeLocal(localValue)

  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5">{label}</div>
      <input
        type="datetime-local"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className={`w-full px-3 py-2 bg-[#100608] border rounded text-sm text-white focus:border-[#ff8844] focus:outline-none transition ${
          error ? 'border-[#ff4444]' : 'border-white/10'
        }`}
      />
      <input type="hidden" name={name} value={isoValue} />
      {error && <p className="mt-1 text-[10px] text-[#ff8888]">{error}</p>}
    </label>
  )
}

function AiModelsEditor({
  models, onChange,
}: {
  models: { name: string; provider?: string; is_integrity?: boolean }[]
  onChange: (models: { name: string; provider?: string; is_integrity?: boolean }[]) => void
}) {
  const update = (i: number, patch: Partial<{ name: string; provider?: string; is_integrity?: boolean }>) => {
    onChange(models.map((m, idx) => (idx === i ? { ...m, ...patch } : m)))
  }
  const add = () => onChange([...models, { name: '', provider: '' }])
  const remove = (i: number) => onChange(models.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      {models.map((m, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <input
            placeholder="model name (e.g. claude-opus-4-5)"
            value={m.name}
            onChange={(e) => update(i, { name: e.target.value })}
            className="col-span-5 px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
          />
          <input
            placeholder="provider (e.g. Anthropic)"
            value={m.provider ?? ''}
            onChange={(e) => update(i, { provider: e.target.value })}
            className="col-span-4 px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
          />
          <label className="col-span-2 flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={!!m.is_integrity}
              onChange={(e) => update(i, { is_integrity: e.target.checked })}
            />
            Integrity
          </label>
          <button
            type="button"
            onClick={() => remove(i)}
            className="col-span-1 text-xs text-white/40 hover:text-[#ff4444]"
            aria-label="Remove model"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="text-xs text-[#ff8844] hover:underline"
      >
        + Add AI model
      </button>
    </div>
  )
}
