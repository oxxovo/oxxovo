// Does the platform still know what its own spend paths cost? SERVER ONLY.
//
// The refusals added on 2026-08-01 (creditsForCost throws rather than pricing a
// generation at 0) close the money hole: an unpriced model or a missing price
// key can no longer hand out free generations. But a refusal only tells the
// PARTICIPANT, and what they see is "failed". Nothing was written anywhere: the
// refusal happens before the job row is inserted, so there is no job, no ledger
// row, and no trace. A participant inside a 72h round would sit blocked and
// operations would not know.
//
// So the two halves are deliberately at different layers:
//   REFUSE  -- lib/credits.ts + the enqueue paths (a participant cannot be
//              charged 0, and the picker does not offer what it cannot price)
//   NOTICE  -- here, run from the season-tick cron, alerting the ops mailbox
//
// ★It asks the question by CALLING THE REAL PRICING CODE (getStudioPricing,
// getMusicGenConfig, creditsForCostOrNull) rather than by re-listing the
// platform_config keys and re-deriving the arithmetic. A checker holding its own
// copy of what the app does is the exact defect this project keeps finding --
// twice in one day on 2026-07-30/31 (a parity harness measuring a hand-written
// copy of the worker's filters, and a CI job that never installed dependencies).
// Concretely: when the music price key is split per-unit (lane C, in progress),
// getMusicGenConfig changes and this check follows it with no edit here.
//
// ALERT VOLUME is the design problem, not the detection. Every other alert in
// season-tick fires on a TRANSITION that happened during that tick, so it is
// naturally once. A broken price is a STANDING state: alerting on the condition
// would send one mail per tick, forever, and an alert nobody reads is worse than
// no alert. So the condition is reduced to a signature, the signature is stored,
// and the mail goes out only when it CHANGES -- including the change back to
// healthy, which is how you learn the fix worked.

import 'server-only'
import { createSupabaseAdmin } from './supabase-admin'
import { getStudioPricing, creditsForCostOrNull, isSellableCost } from './credits'
import { getMusicGenConfig } from './music-gen'

// Where the last alerted signature lives. ★The `alert_state_` prefix is not
// decoration: platform_config is otherwise entirely OPERATOR SETTINGS, and a row
// that the cron writes to itself must never be mistaken for a knob somebody can
// tune. Nothing reads this to decide behaviour -- only to decide whether the
// mail has already been sent.
export const PRICING_ALERT_STATE_KEY = 'alert_state_studio_pricing'

export type PricingProblem = {
  kind: 'pricing_config' | 'model_unpriced' | 'music_unpriced'
  /** platform_config key, model_catalog id, or the subsystem name. */
  id: string
  /** Human-readable, appears in the alert body. */
  detail: string
  /** true = a participant can reach it right now. false = a landmine for whoever flips `active`. */
  reachable: boolean
}

// Stable, order-independent, and short enough to store in a config value. Equal
// signatures mean "the same set of problems", which is exactly the question the
// dedupe asks. 'ok' is the healthy signature, and it is also what an absent row
// means -- so a first run on a healthy platform writes nothing and sends nothing.
export function pricingSignature(problems: PricingProblem[]): string {
  if (problems.length === 0) return 'ok'
  return problems
    .map((p) => `${p.kind}:${p.id}`)
    .sort()
    .join('|')
}

export function summarizeProblems(problems: PricingProblem[]): string {
  const reachable = problems.filter((p) => p.reachable).length
  return problems.length === 0
    ? 'healthy'
    : `${problems.length} problem(s), ${reachable} reachable by participants`
}

// Read every priceable thing and report what cannot be priced. Never throws:
// this runs inside a cron whose other work must not be lost to a pricing probe.
export async function checkPricingHealth(): Promise<PricingProblem[]> {
  const problems: PricingProblem[] = []
  const admin = createSupabaseAdmin()

  // 1. The global pricing config itself. If margin/credit-value are unusable,
  //    EVERY generation refuses -- one problem, not one per model.
  let pricing: Awaited<ReturnType<typeof getStudioPricing>> | null = null
  try {
    pricing = await getStudioPricing()
    // A nominal one-cent generation must produce a real charge. Catches a
    // margin of -1 or a credit value of 0, which price everything at 0 while
    // each individual model row still looks fine.
    if (creditsForCostOrNull(0.01, pricing) === null) {
      problems.push({
        kind: 'pricing_config',
        id: 'studio_margin_rate/studio_credit_usd_value',
        detail:
          `margin_rate=${pricing.marginRate}, credit_usd_value=${pricing.creditUsdValue} ` +
          'cannot price a 1-cent generation -- all Studio generation is refused',
        reachable: true,
      })
    }
  } catch (e) {
    problems.push({
      kind: 'pricing_config',
      id: 'studio_margin_rate/studio_credit_usd_value',
      detail: `unreadable: ${e instanceof Error ? e.message : String(e)}`,
      reachable: true,
    })
  }

  // 2. Catalogue rows. INACTIVE rows are reported too, with reachable=false: an
  //    unpriced inactive row is not hurting anyone today, and it is precisely
  //    what turns into a free model the moment somebody flips `active` at
  //    launch. Cheap to say now, expensive to discover then.
  const { data: models, error: mErr } = await admin
    .from('model_catalog')
    .select('id, active, cost_per_second_usd')
  if (mErr) {
    problems.push({
      kind: 'model_unpriced',
      id: 'model_catalog',
      detail: `catalogue unreadable: ${mErr.message}`,
      reachable: true,
    })
  } else {
    for (const m of models ?? []) {
      if (isSellableCost(m.cost_per_second_usd)) continue
      problems.push({
        kind: 'model_unpriced',
        id: String(m.id),
        detail:
          `cost_per_second_usd=${JSON.stringify(m.cost_per_second_usd)} ` +
          (m.active ? '(ACTIVE -- withheld from the picker)' : '(inactive)'),
        reachable: m.active === true,
      })
    }
  }

  // 3. AI music, and ONLY where a season has actually switched it on. An
  //    unpriced music generator behind a closed switch is the correct state
  //    today (the vendor price is not settled) -- alerting on it would be
  //    alerting on the plan.
  const { data: seasons, error: sErr } = await admin
    .from('seasons')
    .select('id, studio_music_ai_enabled')
    .eq('studio_music_ai_enabled', true)
  if (sErr) {
    problems.push({
      kind: 'music_unpriced',
      id: 'seasons',
      detail: `music switch state unreadable: ${sErr.message}`,
      reachable: true,
    })
  } else if ((seasons ?? []).length > 0 && pricing) {
    try {
      const mcfg = await getMusicGenConfig()
      if (creditsForCostOrNull(mcfg.genCostUsd, pricing) === null) {
        problems.push({
          kind: 'music_unpriced',
          id: (seasons ?? []).map((s) => String(s.id)).sort().join(','),
          detail:
            `studio_music_ai_enabled is ON but the generator has no usable price ` +
            `(cost_usd=${mcfg.genCostUsd}) -- the AI music panel is withheld`,
          reachable: true,
        })
      }
    } catch (e) {
      problems.push({
        kind: 'music_unpriced',
        id: 'studio_music_gen_cost',
        detail: `music pricing unreadable: ${e instanceof Error ? e.message : String(e)}`,
        reachable: true,
      })
    }
  }

  return problems
}

export type PricingHealthReport = {
  problems: PricingProblem[]
  signature: string
  previousSignature: string
  /** true = the signature moved, i.e. this tick should alert. */
  changed: boolean
  /** true = it moved back to healthy (the alert is a recovery notice). */
  recovered: boolean
  /** Non-fatal problems with the state row itself. */
  stateError?: string
}

// Compare against the stored signature and persist the new one. The write only
// happens when the signature moved, so a healthy platform writes to
// platform_config exactly never.
export async function reportPricingHealth(): Promise<PricingHealthReport> {
  const problems = await checkPricingHealth()
  const signature = pricingSignature(problems)
  const admin = createSupabaseAdmin()

  let previousSignature = 'ok'
  let stateError: string | undefined
  const { data: prev, error: readErr } = await admin
    .from('platform_config')
    .select('value')
    .eq('key', PRICING_ALERT_STATE_KEY)
    .maybeSingle()
  if (readErr) stateError = `read ${PRICING_ALERT_STATE_KEY}: ${readErr.message}`
  else if (prev?.value) previousSignature = String(prev.value)

  const changed = signature !== previousSignature
  if (changed) {
    const { error: writeErr } = await admin.from('platform_config').upsert(
      {
        key: PRICING_ALERT_STATE_KEY,
        value: signature,
        value_type: 'text',
        description:
          'ALERT STATE, not a setting. Last Studio pricing-health signature the ' +
          'season-tick cron alerted on. Deleting it only causes one repeat alert.',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
    // ★A failed write must not suppress the alert: better a repeated mail than a
    // silent one. The mail is sent by the caller on `changed`, which stays true.
    if (writeErr) stateError = `${stateError ? stateError + '; ' : ''}write: ${writeErr.message}`
  }

  return {
    problems,
    signature,
    previousSignature,
    changed,
    recovered: changed && signature === 'ok',
    ...(stateError ? { stateError } : {}),
  }
}

// The alert body. Split out so the cron stays a list of "what happened", and so
// the wording is testable without sending mail.
export function pricingAlertHtml(report: PricingHealthReport): string {
  if (report.recovered) {
    return `<div style="font-family: Arial, sans-serif; max-width: 560px; color: #1a1a1a;">
      <h2 style="color: #8B22FF;">Studio pricing is healthy again</h2>
      <p>Every model row and every enabled spend path can be priced. The previous
         state was:</p>
      <pre style="white-space: pre-wrap;">${report.previousSignature}</pre>
    </div>`
  }
  const rows = report.problems
    .map(
      (p) =>
        `<li><strong>${p.kind}</strong> — <code>${p.id}</code>: ${p.detail}` +
        `${p.reachable ? ' <strong>(participant-facing now)</strong>' : ''}</li>`,
    )
    .join('')
  return `<div style="font-family: Arial, sans-serif; max-width: 560px; color: #1a1a1a;">
    <h2 style="color: #c0392b;">Studio pricing problem</h2>
    <p>Something that can be spent on cannot be priced. Nothing is being given
       away — the charge paths refuse rather than charge 0 — but whoever tries it
       is blocked, and they only see a generic failure.</p>
    <ul>${rows}</ul>
    <p>Fix: give the model row a real <code>cost_per_second_usd</code>, or add the
       missing <code>platform_config</code> price key. The next tick after the fix
       sends a recovery notice.</p>
    <p style="color:#666;font-size:12px;">This alert repeats only if the set of
       problems changes.</p>
  </div>`
}
