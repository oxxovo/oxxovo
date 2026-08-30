// Triple-AI Review (chatbot Level 3) -- SERVER ONLY.
//
// The user taps "Triple-AI Review" under a Claude answer; we ask all three
// judging providers (Claude / GPT / Gemini) the same question, grounded in the
// same OXXOVO knowledge base, then Claude synthesizes ONE "OXXOVO Verified
// Answer" plus a transparent panel of each model's take and an agreement level.
//
// Presentation rules (TK / advisor, 2026-06-28): the conclusion comes first; the
// three takes are shown as transparent evidence; NO warning iconography -- a
// dissent is framed positively as an "additional consideration"; agreement is
// High or Medium only (never "Low" / "conflict").

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { getCurrentSeason } from '@/lib/seasons'
import { buildChatbotSystemPrompt } from '@/lib/chatbot-kb'
import { loadChatbotContext } from '@/lib/chatbot-context'
import { ask, providerForModel, providerAvailable, PROVIDER_LABEL, type ProviderId } from './providers'

const WANTED: ProviderId[] = ['claude', 'gpt', 'gemini']
// Fallbacks if a season has no model for a provider. Reused from the judging
// panel where the season defines them; these are the safety net only.
const DEFAULT_MODEL: Record<ProviderId, string> = {
  claude: 'claude-sonnet-4-6',
  gpt: 'gpt-4o',
  gemini: 'gemini-2.5-flash',
}
const SYNTH_MODEL = 'claude-sonnet-4-6'

export type PanelEntry = {
  provider: ProviderId
  label: string // "Claude" | "GPT" | "Gemini"
  available: boolean // provider key configured
  ok: boolean // produced an answer
  aligned: boolean // agrees with the verified answer
  summary: string // one-line take (or status when unavailable)
  additionalConsideration: string // positive framing of any extra point; '' if none
}

export type ReviewResult = {
  verifiedAnswer: string
  agreement: 'high' | 'medium'
  stars: number // 4 or 5 -- never below 4 (we never surface "low/conflict")
  panel: PanelEntry[] // always 3 entries (claude, gpt, gemini), in WANTED order
}

// Resolve one model id per provider: prefer the current season's judging panel
// (no hardcode), fall back to defaults. Always returns all three.
async function resolvePanelModels(): Promise<Record<ProviderId, string>> {
  const out: Partial<Record<ProviderId, string>> = {}
  try {
    const season = await getCurrentSeason()
    for (const m of season?.ai_models ?? []) {
      const p = providerForModel(m.name)
      if (p && !out[p]) out[p] = m.name
    }
  } catch {
    /* season read is best-effort; defaults cover any gap */
  }
  return {
    claude: out.claude ?? DEFAULT_MODEL.claude,
    gpt: out.gpt ?? DEFAULT_MODEL.gpt,
    gemini: out.gemini ?? DEFAULT_MODEL.gemini,
  }
}

export async function tripleAiReview(question: string): Promise<ReviewResult | null> {
  const [models, ctx] = await Promise.all([resolvePanelModels(), loadChatbotContext()])
  const systemPrompt = buildChatbotSystemPrompt(ctx)

  // Ask every configured provider in parallel, grounded in the same KB.
  const asks = await Promise.all(
    WANTED.map((p) =>
      providerAvailable(p)
        ? ask(models[p], systemPrompt, question, { maxTokens: 900 })
        : Promise.resolve({ provider: p, model: models[p], available: false, ok: false, text: '', error: 'no_key' as const }),
    ),
  )

  const answered = asks.filter((a) => a.ok)
  if (answered.length === 0) return null // nothing to synthesize; caller 503s

  // One provider only (today's reality until OPENAI/GEMINI keys are set): no
  // synthesis call needed -- that single answer IS the verified answer.
  if (answered.length === 1) {
    const only = answered[0]
    return {
      verifiedAnswer: only.text,
      agreement: 'high',
      stars: 5,
      panel: WANTED.map((p) => {
        const a = asks.find((x) => x.provider === p)!
        return {
          provider: p,
          label: PROVIDER_LABEL[p],
          available: a.available,
          ok: a.ok,
          aligned: a.ok,
          summary: a.ok ? firstLine(a.text) : a.available ? 'Did not return an answer.' : 'Not configured yet.',
          additionalConsideration: '',
        }
      }),
    }
  }

  return synthesize(question, asks)
}

// Claude reads the panel's raw answers and returns the structured verified
// result. Uses structured outputs so the JSON is guaranteed parseable.
async function synthesize(
  question: string,
  asks: Awaited<ReturnType<typeof ask>>[],
): Promise<ReviewResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const answered = asks.filter((a) => a.ok)

  const panelText = answered
    .map((a) => `### ${PROVIDER_LABEL[a.provider]} (${a.provider})\n${a.text}`)
    .join('\n\n')

  const synthSystem = `You are the OXXOVO Verified Answer synthesizer. ${answered.length} AI models independently answered the user's question, each grounded in the OXXOVO knowledge base. Your job: produce ONE clear final answer plus a transparent, positive summary of each model's take.

RULES:
- "verifiedAnswer": one consolidated, user-facing answer (the conclusion). Match the user's language (Korean or English). Be concise and accurate. Never invent OXXOVO facts none of the models stated.
- "agreement": "high" when the models substantively agree; "medium" when they mostly agree but a model adds nuance or a differing emphasis. NEVER report conflict or alarm.
- For each model in "panel": "aligned" = true if its take is consistent with the verified answer. "summary" = one short sentence capturing that model's take (in the user's language). "additionalConsideration" = if a model raised an extra or differing point, phrase it POSITIVELY as a helpful additional consideration (in the user's language); otherwise an empty string. NEVER use warning words, "however/but/caution/conflict", or warning icons.
- Only include the models that actually answered. Keep it factual and reassuring.`

  const userPayload = `User question:\n${question}\n\nThe models' answers:\n\n${panelText}`

  const client = new Anthropic({ apiKey })
  const resp = await client.messages.create({
    model: SYNTH_MODEL,
    max_tokens: 1200,
    system: synthSystem,
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            verifiedAnswer: { type: 'string' },
            agreement: { type: 'string', enum: ['high', 'medium'] },
            panel: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  provider: { type: 'string', enum: ['claude', 'gpt', 'gemini'] },
                  aligned: { type: 'boolean' },
                  summary: { type: 'string' },
                  additionalConsideration: { type: 'string' },
                },
                required: ['provider', 'aligned', 'summary', 'additionalConsideration'],
              },
            },
          },
          required: ['verifiedAnswer', 'agreement', 'panel'],
        },
      },
    },
    messages: [{ role: 'user', content: userPayload }],
  })

  const raw = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  let parsed: {
    verifiedAnswer?: string
    agreement?: 'high' | 'medium'
    panel?: { provider: ProviderId; aligned: boolean; summary: string; additionalConsideration: string }[]
  } = {}
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Structured outputs should guarantee valid JSON; degrade to the strongest
    // single answer rather than failing the whole review.
    const best = answered.find((a) => a.provider === 'claude') ?? answered[0]
    parsed = {
      verifiedAnswer: best.text,
      agreement: 'high',
      panel: answered.map((a) => ({ provider: a.provider, aligned: true, summary: firstLine(a.text), additionalConsideration: '' })),
    }
  }

  const synthByProvider = new Map(
    (parsed.panel ?? []).map((p) => [p.provider, p] as const),
  )
  const agreement = parsed.agreement === 'medium' ? 'medium' : 'high'

  return {
    verifiedAnswer: (parsed.verifiedAnswer || answered[0].text).trim(),
    agreement,
    stars: agreement === 'high' ? 5 : 4,
    panel: WANTED.map((p) => {
      const a = asks.find((x) => x.provider === p)!
      const s = synthByProvider.get(p)
      return {
        provider: p,
        label: PROVIDER_LABEL[p],
        available: a.available,
        ok: a.ok,
        aligned: s ? s.aligned : a.ok,
        summary: a.ok
          ? s?.summary || firstLine(a.text)
          : a.available
            ? 'Did not return an answer.'
            : 'Not configured yet.',
        additionalConsideration: s?.additionalConsideration ?? '',
      }
    }),
  }
}

function firstLine(text: string): string {
  const line = text.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
  return line.length > 200 ? line.slice(0, 197) + '…' : line
}
