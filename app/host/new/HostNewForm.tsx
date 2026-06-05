'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createPartnerTournament, type HostFormState } from './actions'

type Defaults = {
  application_video_min_seconds: number
  application_video_max_seconds: number
  prize_first_pct: number
  prize_second_pct: number
  prize_third_pct: number
  scoring_intent_clarity_weight: number
  scoring_execution_weight: number
  scoring_originality_weight: number
  scoring_integrity_weight: number
}

const inputCls =
  'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff]'

export function HostNewForm({
  tierName,
  maxApplicantsCap,
  maxTournamentsPerSeason,
  defaults,
}: {
  tierName: string
  maxApplicantsCap: number
  maxTournamentsPerSeason: number | null
  defaults: Defaults
}) {
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState<HostFormState>({ ok: false })

  // controlled fields
  const [theme, setTheme] = useState('')
  const [openAt, setOpenAt] = useState('')
  const [closeAt, setCloseAt] = useState('')
  const [maxApplicants, setMaxApplicants] = useState(String(maxApplicantsCap))
  const [pool, setPool] = useState('')
  const [p1, setP1] = useState(String(defaults.prize_first_pct))
  const [p2, setP2] = useState(String(defaults.prize_second_pct))
  const [p3, setP3] = useState(String(defaults.prize_third_pct))
  const [vMin, setVMin] = useState(String(defaults.application_video_min_seconds))
  const [vMax, setVMax] = useState(String(defaults.application_video_max_seconds))
  const [wIntent, setWIntent] = useState(String(defaults.scoring_intent_clarity_weight))
  const [wExec, setWExec] = useState(String(defaults.scoring_execution_weight))
  const [wOrig, setWOrig] = useState(String(defaults.scoring_originality_weight))
  const [wIntegrity, setWIntegrity] = useState(String(defaults.scoring_integrity_weight))

  const pctSum = Number(p1) + Number(p2) + Number(p3)
  const weightSum = Number(wIntent) + Number(wExec) + Number(wOrig) + Number(wIntegrity)
  const pctOk = Math.abs(pctSum - 100) < 0.01
  const weightOk = Math.abs(weightSum - 1) < 0.001

  const err = (k: string) => state.fieldErrors?.[k]?.[0]

  const submit = () => {
    setState({ ok: false })
    // datetime-local has no timezone; convert in the browser so the user's
    // local time is what gets stored (server would assume its own tz).
    const toIso = (v: string) => (v ? new Date(v).toISOString() : '')
    const fd = new FormData()
    fd.set('theme', theme)
    fd.set('application_open_at', toIso(openAt))
    fd.set('application_close_at', toIso(closeAt))
    fd.set('max_applicants', maxApplicants)
    fd.set('total_prize_pool', pool)
    fd.set('prize_first_pct', p1)
    fd.set('prize_second_pct', p2)
    fd.set('prize_third_pct', p3)
    fd.set('application_video_min_seconds', vMin)
    fd.set('application_video_max_seconds', vMax)
    fd.set('scoring_intent_clarity_weight', wIntent)
    fd.set('scoring_execution_weight', wExec)
    fd.set('scoring_originality_weight', wOrig)
    fd.set('scoring_integrity_weight', wIntegrity)

    startTransition(async () => {
      const res = await createPartnerTournament({ ok: false }, fd)
      setState(res)
    })
  }

  if (state.ok) {
    return (
      <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center space-y-5">
          <h1 className="text-3xl font-black text-[#8b22ff]">Tournament created</h1>
          <p className="text-white/70 text-sm leading-relaxed">
            Your tournament is saved as a <strong>draft</strong>. It stays private
            until the OXXOVO team confirms your prize-pool escrow as paid — then it
            goes public automatically.
          </p>
          <Link href="/" className="inline-block text-[#8b22ff] text-sm hover:underline">
            Back to home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#030305] text-white px-4 py-12">
      <div className="w-full max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-[#8b22ff] mb-1">Create a tournament</h1>
          <p className="text-white/50 text-sm">
            {tierName.charAt(0).toUpperCase() + tierName.slice(1)} partner · up to{' '}
            {maxApplicantsCap.toLocaleString()} applicants
            {maxTournamentsPerSeason == null
              ? ' · unlimited tournaments'
              : ` · ${maxTournamentsPerSeason} in-flight`}
          </p>
        </div>

        <div className="space-y-5">
          <Field label="Theme / tournament name" error={err('theme')}>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. Neon Dreams"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Applications open" error={err('application_open_at')}>
              <input
                type="datetime-local"
                value={openAt}
                onChange={(e) => setOpenAt(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Applications close" error={err('application_close_at')}>
              <input
                type="datetime-local"
                value={closeAt}
                onChange={(e) => setCloseAt(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Max applicants"
              error={err('max_applicants')}
              hint={`Tier cap: ${maxApplicantsCap.toLocaleString()}`}
            >
              <input
                type="number"
                min={1}
                max={maxApplicantsCap}
                value={maxApplicants}
                onChange={(e) => setMaxApplicants(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Prize pool (USD)" error={err('total_prize_pool')}>
              <input
                type="number"
                min={0}
                value={pool}
                onChange={(e) => setPool(e.target.value)}
                placeholder="2000"
                className={inputCls}
              />
            </Field>
          </div>

          <Field
            label="Prize split (%)"
            error={err('prize_third_pct')}
            hint={pctOk ? undefined : `Must sum to 100 (now ${pctSum})`}
          >
            <div className="grid grid-cols-3 gap-3">
              <LabeledNum label="1st" value={p1} onChange={setP1} />
              <LabeledNum label="2nd" value={p2} onChange={setP2} />
              <LabeledNum label="3rd" value={p3} onChange={setP3} />
            </div>
          </Field>

          <Field label="Submission video length (sec)" error={err('application_video_max_seconds')}>
            <div className="grid grid-cols-2 gap-3">
              <LabeledNum label="min" value={vMin} onChange={setVMin} />
              <LabeledNum label="max" value={vMax} onChange={setVMax} />
            </div>
          </Field>

          <Field
            label="Scoring weights"
            error={err('scoring_integrity_weight')}
            hint={weightOk ? undefined : `Must sum to 1.0 (now ${weightSum.toFixed(2)})`}
          >
            <div className="grid grid-cols-2 gap-3">
              <LabeledNum label="Intent" value={wIntent} onChange={setWIntent} step="0.05" />
              <LabeledNum label="Execution" value={wExec} onChange={setWExec} step="0.05" />
              <LabeledNum label="Originality" value={wOrig} onChange={setWOrig} step="0.05" />
              <LabeledNum label="Integrity" value={wIntegrity} onChange={setWIntegrity} step="0.05" />
            </div>
          </Field>

          {state.errorMessage && (
            <p className="text-sm text-[#ff6b6b]">{state.errorMessage}</p>
          )}

          <p className="text-xs text-white/40 leading-relaxed">
            Your tournament is created as a private draft. It becomes public only
            after the OXXOVO team confirms your prize-pool escrow payment.
          </p>

          <button
            type="button"
            disabled={pending || !theme.trim() || !pctOk || !weightOk}
            onClick={submit}
            className="w-full bg-[#8b22ff] text-white font-bold text-sm py-3.5 rounded-lg disabled:opacity-40 hover:bg-[#7a1de0] transition"
          >
            {pending ? 'Creating…' : 'Create tournament'}
          </button>
        </div>
      </div>
    </main>
  )
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-sm text-white/60">{label}</label>
        {hint && <span className="text-[11px] text-white/35">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-[#ff6b6b] mt-1">{error}</p>}
    </div>
  )
}

function LabeledNum({
  label,
  value,
  onChange,
  step,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  step?: string
}) {
  return (
    <label className="block">
      <span className="block text-[11px] text-white/40 mb-1">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#8b22ff]"
      />
    </label>
  )
}
