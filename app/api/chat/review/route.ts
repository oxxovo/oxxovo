// Triple-AI Review endpoint -- server-only. The chat widget calls this when the
// user taps "Triple-AI Review" under a Claude answer. It fans out to Claude/GPT/
// Gemini and returns one OXXOVO Verified Answer + a transparent panel.
//
// This is ~4 model calls per request, so it has its own (tighter) per-IP rate
// limit on top of the main chat limit. The API keys live ONLY here (server).

import { NextRequest, NextResponse } from 'next/server'
import { tripleAiReview } from '@/lib/ai/review'
import { providerAvailable, type ProviderId } from '@/lib/ai/providers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

// Lightweight availability probe so the widget can hide the Triple-AI Review
// button until at least two providers are configured (auto-enables when the
// OPENAI/GEMINI keys are added). Returns only a count -- never key details.
export async function GET() {
  const providers = (['claude', 'gpt', 'gemini'] as ProviderId[]).filter(providerAvailable).length
  return NextResponse.json({ providers })
}

const MAX_MESSAGE_CHARS = 1000

// Tighter than the chat limit -- each review is ~4 model calls.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 4
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

export async function POST(req: NextRequest) {
  let body: { question?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (!question) return NextResponse.json({ error: 'empty_question' }, { status: 400 })
  if (question.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: 'question_too_long' }, { status: 400 })
  }

  const ip = clientIp(req)
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  try {
    const result = await tripleAiReview(question)
    if (!result) return NextResponse.json({ error: 'review_unavailable' }, { status: 503 })
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[chat/review] failed:', msg)
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
  }
}
