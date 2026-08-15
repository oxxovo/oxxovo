'use client'

import { useActionState, useState } from 'react'
import { saveSeason, type SeasonFormState } from './actions'
import { type SeasonFormInitial } from '@/lib/season-schema'
import { useT } from '@/lib/admin-i18n'

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

const KST_TZ = 'Asia/Seoul'
const PT_TZ = 'America/Los_Angeles'

// Format an ISO instant in a fixed IANA zone -- used for the "saves as" dual
// preview (HQ 2026-08-15: a schedule date with no visible timezone gets read
// backwards by whoever opens this form next; datetime-local shows/edits in
// the ADMIN'S OWN browser clock, which is not necessarily KST or PT).
function formatInZone(iso: string, timeZone: string): string {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d)
}

export function SeasonForm({
  id,
  initial,
}: {
  id: string | null
  initial: SeasonFormInitial
}) {
  const t = useT()
  const [state, formAction, pending] = useActionState(
    (prev: SeasonFormState, fd: FormData) => saveSeason(id, prev, fd),
    initialState,
  )
  const [aiModels, setAiModels] = useState(initial.ai_models)
  const [lobbyFeatured, setLobbyFeatured] = useState(!!initial.lobby_featured)

  // Pool + percentages are controlled so the live preview ("≈ $X") and the
  // sum indicator can react to every keystroke. All other fields stay
  // uncontrolled (defaultValue) for simplicity.
  const [pool, setPool] = useState(Number(initial.total_prize_pool))
  const [pct1, setPct1] = useState(Number(initial.prize_first_pct))
  const [pct2, setPct2] = useState(Number(initial.prize_second_pct))
  const [pct3, setPct3] = useState(Number(initial.prize_third_pct))

  const sumPct = round2(pct1 + pct2 + pct3)
  const sumOk = Math.abs(sumPct - 100) < 0.01
  const previewAmount = (pct: number) =>
    Number.isFinite(pool) && Number.isFinite(pct)
      ? Math.round((pool * pct) / 100 * 100) / 100
      : 0

  const fieldError = (key: string) => state.fieldErrors?.[key]?.[0]

  const bannerText =
    state.messageKey === 'validation_failed'
      ? t.season_form.validation_failed
      : state.messageKey === 'saved'
        ? t.season_form.saved
        : state.errorMessage ?? null

  return (
    <form action={formAction} className="space-y-10">
      <input type="hidden" name="ai_models" value={JSON.stringify(aiModels)} />

      {bannerText && (
        <div
          className={`px-4 py-3 rounded border text-sm ${
            state.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-[#ff4444]/30 bg-[#ff4444]/10 text-[#ff8888]'
          }`}
        >
          {bannerText}
        </div>
      )}

      <Group title={t.season_form.group_info}>
        <Field label={t.season_form.field_name} name="name" defaultValue={initial.name} error={fieldError('name')} />
        <Field label={t.season_form.field_season_number} name="season_number" type="number" defaultValue={initial.season_number} error={fieldError('season_number')} />
        <Select
          label={t.season_form.field_status}
          name="status"
          defaultValue={initial.status}
          options={[
            { value: 'draft', label: t.status.draft },
            { value: 'upcoming', label: t.status.upcoming },
            { value: 'active', label: t.status.active },
            { value: 'closed', label: t.status.closed },
            { value: 'completed', label: t.status.completed },
          ]}
          error={fieldError('status')}
        />
        <RequiredChoice
          label={t.season_form.field_is_fixture}
          name="is_fixture"
          // ★No fallback. `undefined` renders as neither option checked, which is
          // the whole point -- see SeasonFormInitial in lib/season-schema.ts.
          value={initial.is_fixture}
          options={[
            { value: 'false', label: t.season_form.option_is_fixture_real },
            { value: 'true', label: t.season_form.option_is_fixture_rehearsal },
          ]}
          error={fieldError('is_fixture')}
          hint={t.season_form.hint_is_fixture}
        />
      </Group>

      <Group title={t.season_form.group_capacity}>
        <Field label={t.season_form.field_max_applicants} name="max_applicants" type="number" defaultValue={initial.max_applicants} error={fieldError('max_applicants')} />
        <Field label={t.season_form.field_top_n} name="top_n_advance" type="number" defaultValue={initial.top_n_advance} error={fieldError('top_n_advance')} hint={t.season_form.hint_main_round_semifinal} />
      </Group>

      <Group title={t.season_form.group_advancement}>
        <Field label={t.season_form.field_min_participants} name="min_participants" type="number" defaultValue={initial.min_participants} error={fieldError('min_participants')} />
        <Field label={t.season_form.field_advance_pct} name="advance_pct" type="number" step="0.01" defaultValue={initial.advance_pct} error={fieldError('advance_pct')} hint={t.season_form.hint_advance_pct} />
        <Field label={t.season_form.field_advance_min} name="advance_min" type="number" defaultValue={initial.advance_min} error={fieldError('advance_min')} />
        <Field label={t.season_form.field_advance_max} name="advance_max" type="number" defaultValue={initial.advance_max} error={fieldError('advance_max')} />
        <Field label={t.season_form.field_defer_days} name="defer_extension_days" type="number" defaultValue={initial.defer_extension_days} error={fieldError('defer_extension_days')} hint={t.season_form.hint_defer} />
        <Field label={t.season_form.field_max_defer} name="max_defer_count" type="number" defaultValue={initial.max_defer_count} error={fieldError('max_defer_count')} />
        <Field label={t.season_form.field_absolute_min_participants} name="absolute_min_participants" type="number" defaultValue={initial.absolute_min_participants} error={fieldError('absolute_min_participants')} hint={t.season_form.hint_absolute_min_participants} />
      </Group>

      <Group title={t.season_form.group_video}>
        <Field label={t.season_form.field_video_app_min} name="application_video_min_seconds" type="number" defaultValue={initial.application_video_min_seconds} error={fieldError('application_video_min_seconds')} />
        <Field label={t.season_form.field_video_app_max} name="application_video_max_seconds" type="number" defaultValue={initial.application_video_max_seconds} error={fieldError('application_video_max_seconds')} />
        <Field label={t.season_form.field_video_main} name="main_round_video_seconds" type="number" defaultValue={initial.main_round_video_seconds} error={fieldError('main_round_video_seconds')} />
        <Field label={t.season_form.field_video_main_min} name="main_round_video_min_seconds" type="number" defaultValue={initial.main_round_video_min_seconds} error={fieldError('main_round_video_min_seconds')} />
        <Field label={t.season_form.field_video_main_max} name="main_round_video_max_seconds" type="number" defaultValue={initial.main_round_video_max_seconds} error={fieldError('main_round_video_max_seconds')} />
        <Field label={t.season_form.field_theme_label} name="main_round_theme_label" defaultValue={initial.main_round_theme_label ?? ''} error={fieldError('main_round_theme_label')} />
      </Group>

      <Group title={t.season_form.group_timing}>
        <Field label={t.season_form.field_theme_reveal} name="theme_announcement_minutes_before" type="number" defaultValue={initial.theme_announcement_minutes_before} error={fieldError('theme_announcement_minutes_before')} />
        <Field label={t.season_form.field_submission_hours} name="submission_hours" type="number" defaultValue={initial.submission_hours} error={fieldError('submission_hours')} />
      </Group>

      <Group title={t.season_form.group_pool}>
        <ControlledNumberField
          label={t.season_form.field_total_pool}
          name="total_prize_pool"
          step="1"
          value={pool}
          onChange={setPool}
          error={fieldError('total_prize_pool')}
        />
        <Field
          label={t.season_form.field_entry_fee}
          name="entry_fee"
          type="number"
          step="1"
          defaultValue={initial.entry_fee}
          error={fieldError('entry_fee')}
        />
      </Group>

      <Group title={t.season_form.group_split}>
        <PercentField
          label={t.season_form.field_1st_place}
          name="prize_first_pct"
          value={pct1}
          onChange={setPct1}
          previewUsd={previewAmount(pct1)}
          error={fieldError('prize_first_pct')}
        />
        <PercentField
          label={t.season_form.field_2nd_place}
          name="prize_second_pct"
          value={pct2}
          onChange={setPct2}
          previewUsd={previewAmount(pct2)}
          error={fieldError('prize_second_pct')}
        />
        <PercentField
          label={t.season_form.field_3rd_place}
          name="prize_third_pct"
          value={pct3}
          onChange={setPct3}
          previewUsd={previewAmount(pct3)}
          error={fieldError('prize_third_pct')}
        />
        <div className="md:col-span-2 mt-1 flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-[11px] uppercase tracking-wider text-white/50">
            {t.season_form.split_total_label}
          </span>
          <span
            className={`text-sm font-bold ${
              sumOk ? 'text-emerald-300' : 'text-[#ff8888]'
            }`}
          >
            {sumPct.toFixed(2)}% {sumOk ? '✓' : t.season_form.split_total_bad}
          </span>
        </div>
      </Group>

      <Group title={t.season_form.group_scoring}>
        <Field label={t.season_form.field_community_vote} name="community_vote_weight" type="number" step="0.01" defaultValue={initial.community_vote_weight} error={fieldError('community_vote_weight')} hint={t.season_form.hint_07} />
        <Field label={t.season_form.field_ai_score} name="ai_score_weight" type="number" step="0.01" defaultValue={initial.ai_score_weight} error={fieldError('ai_score_weight')} hint={t.season_form.hint_03} />
      </Group>

      <Group title={t.season_form.group_ai_weights}>
        <Field label={t.season_form.field_intent} name="scoring_intent_clarity_weight" type="number" step="0.01" defaultValue={initial.scoring_intent_clarity_weight} error={fieldError('scoring_intent_clarity_weight')} />
        <Field label={t.season_form.field_execution} name="scoring_execution_weight" type="number" step="0.01" defaultValue={initial.scoring_execution_weight} error={fieldError('scoring_execution_weight')} />
        <Field label={t.season_form.field_originality} name="scoring_originality_weight" type="number" step="0.01" defaultValue={initial.scoring_originality_weight} error={fieldError('scoring_originality_weight')} />
        <Field label={t.season_form.field_integrity} name="scoring_integrity_weight" type="number" step="0.01" defaultValue={initial.scoring_integrity_weight} error={fieldError('scoring_integrity_weight')} />
      </Group>

      <Group title={t.season_form.group_ai_panel}>
        <div className="col-span-full">
          <AiModelsEditor models={aiModels} onChange={setAiModels} />
          {fieldError('ai_models') && (
            <p className="mt-2 text-xs text-[#ff8888]">{fieldError('ai_models')}</p>
          )}
        </div>
      </Group>

      <Group title={t.season_form.group_integrity}>
        <Field label={t.season_form.field_flag_integrity} name="flag_integrity_threshold" type="number" defaultValue={initial.flag_integrity_threshold} error={fieldError('flag_integrity_threshold')} hint={t.season_form.hint_0_100} />
        <Field label={t.season_form.field_flag_spread} name="flag_spread_threshold" type="number" defaultValue={initial.flag_spread_threshold} error={fieldError('flag_spread_threshold')} hint={t.season_form.hint_0_100} />
      </Group>

      <Group title={t.season_form.group_studio}>
        <Select
          label={t.season_form.field_studio_round}
          name="studio_round"
          defaultValue={initial.studio_round}
          options={[
            { value: 'application', label: t.season_form.studio_round_application },
            { value: 'main', label: t.season_form.studio_round_main },
            { value: 'both', label: t.season_form.studio_round_both },
          ]}
          error={fieldError('studio_round')}
        />
        <Field
          label={t.season_form.field_studio_max_gen}
          name="studio_max_generations_per_round"
          type="number"
          defaultValue={initial.studio_max_generations_per_round}
          error={fieldError('studio_max_generations_per_round')}
          hint={t.season_form.hint_studio_round}
        />
      </Group>

      <Group title={t.season_form.group_lobby}>
        <Field
          label={t.season_form.field_poster_url}
          name="poster_url"
          defaultValue={initial.poster_url ?? ''}
          error={fieldError('poster_url')}
          hint={t.season_form.hint_poster_url}
        />
        <label className="flex items-center gap-3 cursor-pointer pt-6">
          <input
            type="checkbox"
            checked={lobbyFeatured}
            onChange={(e) => setLobbyFeatured(e.target.checked)}
            className="h-4 w-4 accent-[#ff8844]"
          />
          <span className="text-sm text-white/80">{t.season_form.field_lobby_featured}</span>
          <input type="hidden" name="lobby_featured" value={String(lobbyFeatured)} />
        </label>
      </Group>

      <Group title={t.season_form.group_schedule}>
        <DatetimeField label={t.season_form.field_app_open} name="application_open_at" defaultValue={toDatetimeLocal(initial.application_open_at)} error={fieldError('application_open_at')} />
        <DatetimeField label={t.season_form.field_registration_close} name="registration_close_at" defaultValue={toDatetimeLocal(initial.registration_close_at)} error={fieldError('registration_close_at')} hint={t.season_form.hint_registration_close} />
        <DatetimeField label={t.season_form.field_app_close} name="application_close_at" defaultValue={toDatetimeLocal(initial.application_close_at)} error={fieldError('application_close_at')} hint={t.season_form.hint_app_close} />
        <DatetimeField label={t.season_form.field_scoring_start} name="scoring_start_at" defaultValue={toDatetimeLocal(initial.scoring_start_at)} error={fieldError('scoring_start_at')} />
        <DatetimeField label={t.season_form.field_scoring_complete} name="scoring_complete_at" defaultValue={toDatetimeLocal(initial.scoring_complete_at)} error={fieldError('scoring_complete_at')} />
        <DatetimeField label={t.season_form.field_prelim_results_announcement} name="prelim_results_announcement_at" defaultValue={toDatetimeLocal(initial.prelim_results_announcement_at)} error={fieldError('prelim_results_announcement_at')} />
        <DatetimeField label={t.season_form.field_community_vote_start} name="community_vote_start_at" defaultValue={toDatetimeLocal(initial.community_vote_start_at)} error={fieldError('community_vote_start_at')} />
        <DatetimeField label={t.season_form.field_community_vote_end} name="community_vote_end_at" defaultValue={toDatetimeLocal(initial.community_vote_end_at)} error={fieldError('community_vote_end_at')} />
        <DatetimeField label={t.season_form.field_main_start} name="main_round_start_at" defaultValue={toDatetimeLocal(initial.main_round_start_at)} error={fieldError('main_round_start_at')} />
        <DatetimeField label={t.season_form.field_main_end} name="main_round_end_at" defaultValue={toDatetimeLocal(initial.main_round_end_at)} error={fieldError('main_round_end_at')} />
        <DatetimeField label={t.season_form.field_awards} name="awards_announcement_at" defaultValue={toDatetimeLocal(initial.awards_announcement_at)} error={fieldError('awards_announcement_at')} />
      </Group>

      <div className="flex items-center gap-3 pt-4 border-t border-white/10">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 rounded bg-gradient-to-br from-[#ff4444] to-[#cc3333] text-white font-bold text-sm uppercase tracking-wider hover:brightness-110 transition disabled:opacity-50"
        >
          {pending
            ? t.season_form.saving
            : id
              ? t.season_form.save_changes
              : t.season_form.create_season}
        </button>
        <p className="text-xs text-white/40">{t.season_form.save_caption}</p>
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

/**
 * A choice with NO default -- radios, none pre-selected when `value` is
 * undefined.
 *
 * ★WHY NOT A <Select>. Every other enum on this form is a dropdown, and a
 * dropdown always shows something: whatever sits at the top becomes the answer
 * for anyone who does not open it. There is no "nothing selected" state to
 * render, so a required choice cannot be expressed with one. Radios can show
 * none-chosen, and the browser will not submit the form until one is.
 *
 * ★`required` on both inputs, so the block happens in the browser AND in the zod
 * schema. Not redundancy for its own sake: the HTML attribute is what makes the
 * admin see the problem next to the field instead of after a round trip, and the
 * schema is what holds if the form is ever posted by something other than this
 * component. Neither one alone covers both.
 */
function RequiredChoice({
  label, name, value, options, error, hint,
}: {
  label: string
  name: string
  value: boolean | null | undefined
  options: Array<{ value: string; label: string }>
  error?: string
  hint?: string
}) {
  const current = typeof value === 'boolean' ? String(value) : null
  return (
    <div className="block">
      <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5">{label}</div>
      <div
        className={`flex flex-col gap-2 px-3 py-2 bg-[#100608] border rounded ${
          error ? 'border-[#ff4444]' : 'border-white/10'
        }`}
      >
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={current === o.value}
              required
              className="h-4 w-4 accent-[#ff8844]"
            />
            <span className="text-sm text-white/80">{o.label}</span>
          </label>
        ))}
      </div>
      {hint && !error && <p className="mt-1 text-[10px] text-white/35">{hint}</p>}
      {error && <p className="mt-1 text-[10px] text-[#ff8888]">{error}</p>}
    </div>
  )
}

function Select({
  label, name, defaultValue, options, error,
}: {
  label: string
  name: string
  defaultValue: string
  options: Array<{ value: string; label: string }>
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
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-[10px] text-[#ff8888]">{error}</p>}
    </label>
  )
}

function DatetimeField({
  label, name, defaultValue, error, hint,
}: {
  label: string
  name: string
  defaultValue: string
  error?: string
  hint?: string
}) {
  const t = useT()
  // datetime-local input value is "YYYY-MM-DDTHH:mm" in the user's local tz —
  // unsuitable for the zod `datetime({ offset: true })` validator. We render
  // a visible (unnamed) datetime-local and mirror the converted ISO value into
  // a hidden input that actually carries the field's `name` to the server.
  const [localValue, setLocalValue] = useState(defaultValue)
  const isoValue = fromDatetimeLocal(localValue)
  const browserTz =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : ''

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
      <p className="mt-1 text-[10px] text-white/35">{t.season_form.datetime_local_tz_note(browserTz)}</p>
      {isoValue && (
        <p className="mt-0.5 text-[10px] text-[#ff8844]">
          {t.season_form.datetime_preview(formatInZone(isoValue, KST_TZ), formatInZone(isoValue, PT_TZ))}
        </p>
      )}
      {hint && !error && <p className="mt-1 text-[10px] text-white/35">{hint}</p>}
      {error && <p className="mt-1 text-[10px] text-[#ff8888]">{error}</p>}
    </label>
  )
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function ControlledNumberField({
  label, name, value, onChange, error, hint, step,
}: {
  label: string
  name: string
  value: number
  onChange: (n: number) => void
  error?: string
  hint?: string
  step?: string
}) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1.5">{label}</div>
      <input
        name={name}
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        className={`w-full px-3 py-2 bg-[#100608] border rounded text-sm text-white focus:border-[#ff8844] focus:outline-none transition ${
          error ? 'border-[#ff4444]' : 'border-white/10'
        }`}
      />
      {hint && !error && <p className="mt-1 text-[10px] text-white/35">{hint}</p>}
      {error && <p className="mt-1 text-[10px] text-[#ff8888]">{error}</p>}
    </label>
  )
}

function PercentField({
  label, name, value, onChange, previewUsd, error,
}: {
  label: string
  name: string
  value: number
  onChange: (n: number) => void
  previewUsd: number
  error?: string
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] uppercase tracking-wider text-white/50">{label}</span>
        <span className="text-[11px] text-white/40 tabular-nums">
          ≈ ${previewUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>
      <div className="relative">
        <input
          name={name}
          type="number"
          step="0.01"
          min="0"
          max="100"
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className={`w-full pl-3 pr-9 py-2 bg-[#100608] border rounded text-sm text-white focus:border-[#ff8844] focus:outline-none transition tabular-nums ${
            error ? 'border-[#ff4444]' : 'border-white/10'
          }`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/40">%</span>
      </div>
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
  const t = useT()
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
            placeholder={t.season_form.ai_model_name_ph}
            value={m.name}
            onChange={(e) => update(i, { name: e.target.value })}
            className="col-span-5 px-3 py-2 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
          />
          <input
            placeholder={t.season_form.ai_provider_ph}
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
            {t.season_form.integrity_check}
          </label>
          <button
            type="button"
            onClick={() => remove(i)}
            className="col-span-1 text-xs text-white/40 hover:text-[#ff4444]"
            aria-label={t.season_form.remove_model_aria}
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
        {t.season_form.add_ai_model}
      </button>
    </div>
  )
}
