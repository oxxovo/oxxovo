'use client'

// OXXOVO Help Assistant -- floating chat widget for /tournament. Talks to the
// server-only /api/chat route (the API key never reaches the client). Keeps a
// short local history and sends it for context; the route caps + sanitizes it.

import { useEffect, useRef, useState } from 'react'

type Turn = { role: 'user' | 'assistant'; content: string }

// Triple-AI Review (Level 3) -- mirrors lib/ai/review.ts ReviewResult.
type PanelEntry = {
  provider: 'claude' | 'gpt' | 'gemini'
  label: string
  available: boolean
  ok: boolean
  aligned: boolean
  summary: string
  additionalConsideration: string
}
type ReviewResult = {
  verifiedAnswer: string
  agreement: 'high' | 'medium'
  stars: number
  panel: PanelEntry[]
}
type ReviewState = { status: 'loading' } | { status: 'error' } | { status: 'done'; data: ReviewResult }

const GREETING: Turn = {
  role: 'assistant',
  content:
    "Hi, I'm OXXOVO AI. Ask me about OXXOVO (schedule, apply, prizes, membership) — or about making AI videos and AI tools. AI·영상 무엇이든 물어보세요.",
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([GREETING])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  // Triple-AI Review state, keyed by the assistant turn index it belongs to.
  const [reviews, setReviews] = useState<Record<number, ReviewState>>({})
  // The review button only shows once >=2 judging providers are configured
  // (auto-enables when the OPENAI/GEMINI keys are added in Vercel).
  const [canReview, setCanReview] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/chat/review')
      .then((r) => r.json())
      .then((d) => setCanReview((d?.providers ?? 0) >= 2))
      .catch(() => {})
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, open, reviews])

  async function runReview(turnIndex: number, question: string) {
    if (!question) return
    setReviews((r) => ({ ...r, [turnIndex]: { status: 'loading' } }))
    try {
      const res = await fetch('/api/chat/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      if (!res.ok) {
        setReviews((r) => ({ ...r, [turnIndex]: { status: 'error' } }))
        return
      }
      const data = (await res.json()) as ReviewResult
      setReviews((r) => ({ ...r, [turnIndex]: { status: 'done', data } }))
    } catch {
      setReviews((r) => ({ ...r, [turnIndex]: { status: 'error' } }))
    }
  }

  async function send() {
    const message = input.trim()
    if (!message || sending) return
    setInput('')
    const next = [...turns, { role: 'user' as const, content: message }]
    setTurns(next)
    setSending(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send prior turns (minus the static greeting) for context.
        body: JSON.stringify({ message, history: next.slice(1, -1) }),
      })
      const data = await res.json()
      const reply =
        res.ok && data.reply
          ? data.reply
          : res.status === 429
            ? 'Too many messages — please wait a moment and try again.'
            : 'Sorry, I had trouble answering. Please contact info@oxxovo.com.'
      setTurns((t) => [...t, { role: 'assistant', content: reply }])
    } catch {
      setTurns((t) => [
        ...t,
        { role: 'assistant', content: 'Network error. Please contact info@oxxovo.com.' },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open help chat"
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#7d23ff] to-[#6220dc] text-2xl text-white shadow-[0_0_24px_rgba(139,34,255,.5)] transition hover:brightness-110"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 flex h-[min(70vh,520px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-[#8b22ff]/25 bg-[#0a0812]/95 backdrop-blur-xl shadow-2xl">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-sm font-bold text-white">OXXOVO AI</p>
            <p className="text-[11px] text-white/40">AI &amp; video assistant · info@oxxovo.com</p>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {turns.map((t, i) => {
              // The user question that produced this assistant turn (for review).
              const prev = turns[i - 1]
              const question = t.role === 'assistant' && i > 0 && prev?.role === 'user' ? prev.content : ''
              const review = reviews[i]
              return (
                <div key={i} className={t.role === 'user' ? 'text-right' : 'text-left'}>
                  <span
                    className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                      t.role === 'user' ? 'bg-[#7d23ff] text-white' : 'bg-white/[.06] text-white/85'
                    }`}
                  >
                    {t.content}
                  </span>

                  {question && canReview && !review && (
                    <div className="mt-1.5">
                      <button
                        onClick={() => runReview(i, question)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#8b22ff]/40 bg-[#8b22ff]/[.08] px-2.5 py-1 text-[11px] font-bold text-[#b66cff] transition hover:bg-[#8b22ff]/[.16]"
                      >
                        ✨ Triple-AI Review
                      </button>
                    </div>
                  )}
                  {review?.status === 'loading' && (
                    <div className="mt-1.5 text-[11px] text-white/40">Reviewing with Claude · GPT · Gemini…</div>
                  )}
                  {review?.status === 'error' && (
                    <div className="mt-1.5 text-[11px] text-white/40">
                      Couldn&apos;t run the review.{' '}
                      <button onClick={() => runReview(i, question)} className="underline hover:text-white/70">
                        Try again
                      </button>
                    </div>
                  )}
                  {review?.status === 'done' && <ReviewCard data={review.data} />}
                </div>
              )
            })}
            {sending && <div className="text-left text-[12px] text-white/30">…</div>}
          </div>

          <div className="flex items-center gap-2 border-t border-white/10 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder="Ask a question…"
              maxLength={1000}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white placeholder:text-white/30 outline-none focus:border-[#8b22ff]"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="rounded-lg bg-[#8b22ff] px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// OXXOVO Verified Answer card: conclusion first, then transparent per-model
// evidence + agreement level. No warning iconography -- a differing point is
// shown as a positive "additional consideration" (presentation rules, TK 6/28).
function ReviewCard({ data }: { data: ReviewResult }) {
  const stars = Math.max(0, Math.min(5, data.stars))
  const agreementLabel = data.agreement === 'high' ? 'High Agreement' : 'Medium Agreement'
  return (
    <div className="mt-2 max-w-[92%] rounded-xl border border-[#8b22ff]/30 bg-[#120a22]/80 p-3 text-left">
      <p className="text-[11px] font-black uppercase tracking-wider text-[#b66cff]">✨ OXXOVO Verified Answer</p>
      <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-white/90">{data.verifiedAnswer}</p>

      <div className="my-2.5 border-t border-white/10" />

      <div className="flex items-center gap-2 text-[11px]">
        <span className="font-bold text-white/55">Consensus</span>
        <span className="tracking-tight text-amber-300" aria-hidden>
          {'★'.repeat(stars)}
          <span className="text-white/20">{'★'.repeat(5 - stars)}</span>
        </span>
        <span className="font-bold text-white/70">{agreementLabel}</span>
      </div>

      <div className="mt-2 space-y-1.5">
        {data.panel.map((p) => (
          <div key={p.provider} className="text-[12px] leading-snug">
            <span className="font-bold text-white/80">{p.label}</span>
            <span className="text-white/40"> — </span>
            {p.ok ? (
              <>
                <span className="text-emerald-400" aria-hidden>
                  ✔
                </span>{' '}
                <span className="text-white/75">{p.summary}</span>
                {p.additionalConsideration && (
                  <span className="mt-0.5 block pl-4 text-[11px] text-[#b66cff]">
                    + {p.additionalConsideration}
                  </span>
                )}
              </>
            ) : (
              <span className="text-white/35">{p.summary}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
