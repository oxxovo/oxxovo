'use client'

// OXXOVO Help Assistant -- floating chat widget for /tournament. Talks to the
// server-only /api/chat route (the API key never reaches the client). Keeps a
// short local history and sends it for context; the route caps + sanitizes it.

import { useEffect, useRef, useState } from 'react'

type Turn = { role: 'user' | 'assistant'; content: string }

const GREETING: Turn = {
  role: 'assistant',
  content:
    'Hi! Ask me about OXXOVO — schedule, how to apply, prizes, membership. 무엇이든 물어보세요.',
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([GREETING])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, open])

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
            <p className="text-sm font-bold text-white">OXXOVO Help</p>
            <p className="text-[11px] text-white/40">AI assistant · info@oxxovo.com</p>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {turns.map((t, i) => (
              <div key={i} className={t.role === 'user' ? 'text-right' : 'text-left'}>
                <span
                  className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                    t.role === 'user'
                      ? 'bg-[#7d23ff] text-white'
                      : 'bg-white/[.06] text-white/85'
                  }`}
                >
                  {t.content}
                </span>
              </div>
            ))}
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
