// OXXOVO Help Assistant -- server-only Claude endpoint for the /tournament chat
// widget. The API key lives ONLY here (server); it is never exposed to the
// client. Knowledge base + guardrails come from lib/chatbot-kb.ts (v4).
//
// Model: claude-haiku-4-5 -- chosen for a public, high-volume FAQ bot answering
// from a small fixed KB under strict guardrails (cost/latency). Swap CHAT_MODEL
// to claude-opus-4-8 if richer reasoning is ever needed.
//
// Abuse guard (C): per-IP sliding-window rate limit (in-memory, best-effort --
// per serverless instance) + input length caps + a hard max_tokens. Out-of-scope
// turns are logged to chat_logs for /admin/messages follow-up (best-effort; a
// missing table never breaks the chat).

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { CHATBOT_SYSTEM_PROMPT, OUT_OF_SCOPE_MARKERS } from '@/lib/chatbot-kb'
import { createSupabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const CHAT_MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 700
const MAX_MESSAGE_CHARS = 1000
const MAX_HISTORY_TURNS = 8

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
    const resp = await client.messages.create({
      model: CHAT_MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: CHATBOT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }, // stable KB -> cache across requests
        },
      ],
      messages: [...history, { role: 'user', content: message }],
    })

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
