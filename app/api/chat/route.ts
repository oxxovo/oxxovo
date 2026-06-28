// OXXOVO AI -- server-only Claude endpoint for the floating help/chat widget.
// The API key lives ONLY here (server); it is never exposed to the client.
// Knowledge base + guardrails come from lib/chatbot-kb.ts.
//
// Persona: a single unified "OXXOVO AI" assistant (NOT three separate models).
// Two-tier knowledge (enforced by the system prompt):
//   - OXXOVO facts (schedule/prizes/rules/membership/Studio specifics) -> ONLY
//     from the KB, never invented.
//   - General AI & video-creation knowledge -> the model's own expertise PLUS
//     the web_search server tool for anything current/fast-moving.
//
// Model: claude-sonnet-4-6 -- chosen over Haiku because the bot now answers
// open-domain AI/video questions (needs real reasoning) and uses
// web_search_20260209, whose dynamic filtering requires Sonnet 4.6+ (Haiku gets
// only the basic web_search_20250305). One-line swap if cost/latency forces it.
//
// Abuse guard: per-IP sliding-window rate limit (in-memory, best-effort -- per
// serverless instance) + input length caps + a hard max_tokens + web_search
// max_uses cap. Out-of-scope turns are logged to chat_logs for /admin/messages
// follow-up (best-effort; a missing table never breaks the chat).

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { CHATBOT_SYSTEM_PROMPT, OUT_OF_SCOPE_MARKERS } from '@/lib/chatbot-kb'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CHAT_MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 1500
const MAX_MESSAGE_CHARS = 1000
const MAX_HISTORY_TURNS = 8
// web_search is a server-side tool; cap searches per request to bound cost.
const WEB_SEARCH_MAX_USES = 5
// Server-tool turns can pause_turn when the server loop hits its cap; resume a
// bounded number of times so a single question can't loop forever.
const MAX_PAUSE_CONTINUATIONS = 4

// Per-IP sliding window (best-effort; resets per serverless instance).
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 12
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (arr.length >= MAX_PER_WINDOW) {
    hits.set(ip, arr)
    return true
  }
  arr.push(now)
  hits.set(ip, arr)
  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k)
    }
  }
  return false
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  return (fwd ? fwd.split(',')[0] : '').trim() || req.headers.get('x-real-ip') || 'unknown'
}

type ChatTurn = { role: 'user' | 'assistant'; content: string }

function isOutOfScope(reply: string): boolean {
  return OUT_OF_SCOPE_MARKERS.some((m) => reply.includes(m))
}

// Best-effort logging of out-of-scope questions for the team to follow up.
// Never throws into the request path (missing table / RLS just no-ops).
async function logOutOfScope(ip: string, question: string, reply: string) {
  try {
    const admin = createSupabaseAdmin()
    await admin.from('chat_logs').insert({
      ip,
      question: question.slice(0, MAX_MESSAGE_CHARS),
      reply: reply.slice(0, 2000),
      out_of_scope: true,
    })
  } catch {
    /* table may not exist yet; logging is non-critical */
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'chat_unavailable' }, { status: 503 })
  }

  let body: { message?: unknown; history?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message) return NextResponse.json({ error: 'empty_message' }, { status: 400 })
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: 'message_too_long' }, { status: 400 })
  }

  const ip = clientIp(req)
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  // Sanitize prior turns (client-supplied; capped, role-checked, length-capped).
  const history: ChatTurn[] = Array.isArray(body.history)
    ? (body.history as unknown[])
        .filter(
          (t): t is ChatTurn =>
            !!t &&
            typeof t === 'object' &&
            ((t as ChatTurn).role === 'user' || (t as ChatTurn).role === 'assistant') &&
            typeof (t as ChatTurn).content === 'string',
        )
        .slice(-MAX_HISTORY_TURNS)
        .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_MESSAGE_CHARS) }))
    : []

  const client = new Anthropic({ apiKey })

  try {
    // Build the conversation; we mutate `convo` only to resume server-tool
    // (web_search) turns that come back as pause_turn -- per the API contract we
    // re-send the assistant content verbatim, with NO extra user message.
    const convo: Anthropic.MessageParam[] = [...history, { role: 'user', content: message }]

    const request = () =>
      client.messages.create({
        model: CHAT_MODEL,
        max_tokens: MAX_TOKENS,
        output_config: { effort: 'medium' }, // balance quality vs latency/cost for a public bot
        system: [
          {
            type: 'text',
            text: CHATBOT_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' }, // stable KB -> cache across requests
          },
        ],
        // Real-time AI/video info comes from web search. Dynamic filtering
        // (_20260209) runs code under the hood -- do NOT also add code_execution.
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: WEB_SEARCH_MAX_USES }],
        messages: convo,
      })

    let resp = await request()
    let continuations = 0
    while (resp.stop_reason === 'pause_turn' && continuations < MAX_PAUSE_CONTINUATIONS) {
      convo.push({ role: 'assistant', content: resp.content })
      resp = await request()
      continuations++
    }

    const reply = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()

    if (!reply) return NextResponse.json({ error: 'no_reply' }, { status: 502 })

    const outOfScope = isOutOfScope(reply)
    if (outOfScope) await logOutOfScope(ip, message, reply)

    return NextResponse.json({ reply, outOfScope })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[chat] anthropic error:', msg)
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
  }
}
