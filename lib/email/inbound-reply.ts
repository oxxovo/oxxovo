// Inbound auto-responder brain -- SERVER ONLY.
//
// Reuses the chatbot knowledge base (lib/chatbot-kb.ts, KB v4) so the email
// auto-reply and the /tournament chat widget answer from ONE source of truth.
// Given an inbound email's subject + body, this decides:
//   - 'escalate' : sensitive topic OR the model isn't certain (out-of-scope).
//                  No auto-reply is sent; the route forwards to ops instead.
//   - 'reply'    : in-scope -> returns the drafted reply text for Resend.
//
// Two-layer safety:
//   1. A deterministic keyword gate escalates sensitive inquiries (refund,
//      legal, press, partnership, payment dispute, privacy/erasure) BEFORE the
//      model ever runs -- these must never be auto-answered.
//   2. The model's own "I can't confirm that, contact info@" guardrail
//      (OUT_OF_SCOPE_MARKERS) is treated as an escalate signal.

import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { CHATBOT_SYSTEM_PROMPT, OUT_OF_SCOPE_MARKERS } from '@/lib/chatbot-kb'

// Same model/economics as the public chat bot: small fixed KB, strict guardrails.
const REPLY_MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 700
// Email bodies can be long (quoted threads, signatures); cap what we feed the
// model so a giant forwarded chain can't blow up cost or latency.
const MAX_BODY_CHARS = 4000

// Topics that must ALWAYS go to a human, regardless of what the KB could say.
// Matched case-insensitively against subject + body. Bilingual (KR/EN).
const SENSITIVE_PATTERNS: RegExp[] = [
  /refund|chargeback|dispute|charged|billing|\benvoi\b/i,
  /환불|결제\s*취소|이중\s*결제|결제\s*오류|청구/,
  /lawyer|legal|lawsuit|attorney|subpoena|infring|copyright\s*claim|dmca/i,
  /법률|변호사|소송|고소|법적|침해|저작권\s*침해/,
  /press|journalist|media\s*inquiry|interview|reporter/i,
  /언론|기자|취재|인터뷰|보도/,
  /partnership|sponsor|investor|invest\b|acquisition|collaborat/i,
  /제휴|협찬|스폰서|투자|인수|협업\s*제안/,
  /gdpr|ccpa|delete\s*my\s*(data|account)|data\s*erasure|right\s*to\s*be\s*forgotten/i,
  /개인정보\s*삭제|계정\s*삭제|탈퇴\s*요청|정보\s*파기/,
]

export type ClassifyResult =
  | { action: 'reply'; reply: string }
  | { action: 'escalate'; reason: string }

function hitsSensitive(text: string): string | null {
  for (const re of SENSITIVE_PATTERNS) {
    if (re.test(text)) return re.source.slice(0, 60)
  }
  return null
}

function isOutOfScope(reply: string): boolean {
  return OUT_OF_SCOPE_MARKERS.some((m) => reply.includes(m))
}

// Decide what to do with an inbound message. Never throws on model errors --
// any failure escalates (fail safe: a human sees it rather than silence).
export async function classifyAndDraft(input: {
  subject: string
  body: string
}): Promise<ClassifyResult> {
  const subject = (input.subject ?? '').slice(0, 300)
  const body = (input.body ?? '').slice(0, MAX_BODY_CHARS).trim()

  // Layer 1: deterministic sensitive gate (runs on subject + body).
  const sensitive = hitsSensitive(`${subject}\n${body}`)
  if (sensitive) {
    return { action: 'escalate', reason: `sensitive:${sensitive}` }
  }

  // Nothing to answer.
  if (!body) return { action: 'escalate', reason: 'empty_body' }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { action: 'escalate', reason: 'no_api_key' }

  const client = new Anthropic({ apiKey })
  // Frame the inbound email as the user turn. The KB system prompt handles
  // language detection + the "contact info@" guardrail for anything uncertain.
  const userTurn = `The following is an inbound email to info@oxxovo.ai. Answer it as the OXXOVO Help Assistant, in the sender's language, using only the knowledge base. If you cannot answer from the knowledge base, use the standard "contact info@oxxovo.ai" reply.

This reply is sent as a PLAIN-TEXT email, so use NO markdown formatting: no **bold**, no markdown links [text](url), no backticks, no headings. Write any URL as a bare address only (e.g. https://www.oxxovo.ai/apply), so it stays clickable in email.

Subject: ${subject || '(no subject)'}

${body}`

  try {
    const resp = await client.messages.create({
      model: REPLY_MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: CHATBOT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }, // stable KB -> cache across requests
        },
      ],
      messages: [{ role: 'user', content: userTurn }],
    })

    const reply = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    if (!reply) return { action: 'escalate', reason: 'empty_reply' }
    // Model signalled uncertainty -> let a human handle it.
    if (isOutOfScope(reply)) return { action: 'escalate', reason: 'out_of_scope' }

    return { action: 'reply', reply }
  } catch (e) {
    console.error('[inbound-reply] model error:', e instanceof Error ? e.message : e)
    return { action: 'escalate', reason: 'model_error' }
  }
}
