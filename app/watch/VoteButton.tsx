'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toggleWatchVote } from './actions'
import type { VoteContext } from '@/lib/watch'
import { useT } from '@/lib/admin-i18n'

// Main-round community vote. Distinct from Like (Like = popularity, anytime;
// Vote = official, windowed, up to N). Shown only on main-round videos.
export function VoteButton({
  applicationId,
  ctx,
  isLoggedIn,
}: {
  applicationId: string
  ctx: VoteContext
  isLoggedIn: boolean
}) {
  const t = useT()
  const router = useRouter()
  const [voted, setVoted] = useState(ctx.voted)
  const [used, setUsed] = useState(ctx.usedVotes)
  const [total, setTotal] = useState(ctx.totalVotes)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const remaining = Math.max(0, ctx.cap - used)
  const atCap = !voted && remaining === 0

  function goLogin() {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
  }

  function onClick() {
    if (!isLoggedIn) return goLogin()
    if (!ctx.open) return
    setMsg(null)
    start(async () => {
      const res = await toggleWatchVote(applicationId)
      if (res.ok) {
        setVoted(res.voted)
        setUsed(res.usedVotes)
        setTotal((t) => t + (res.voted ? 1 : -1))
        router.refresh()
      } else if (res.error === 'auth') {
        goLogin()
      } else if (res.error === 'limit') {
        setMsg(t.watch.vote_error_limit(ctx.cap))
      } else if (res.error === 'closed') {
        setMsg(t.watch.vote_error_closed)
      } else if (res.error === 'self_vote') {
        setMsg(t.watch.vote_error_self)
      }
    })
  }

  // Before the window opens (and no votes yet) there is nothing to show. Once
  // voting has opened -- or closed with a final tally -- the box stays visible so
  // the vote count is public during AND after voting (TK 2026-07-12).
  if (!ctx.open && !ctx.closed && total === 0) {
    return <p className="text-sm text-white/40">{t.watch.vote_notopen}</p>
  }

  return (
    <div className="rounded-xl border border-[#8b22ff]/30 bg-[#8b22ff]/[.06] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-white">{t.watch.vote_title}</p>
          <p className="text-xs text-white/50">
            {t.watch.vote_count(total)}
            {ctx.open && isLoggedIn && <> · {t.watch.vote_remaining(remaining, ctx.cap)}</>}
            {ctx.closed && <> · {t.watch.vote_closed_suffix}</>}
          </p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={pending || !ctx.open || atCap}
          className={`rounded-full px-5 py-2 text-sm font-bold transition disabled:opacity-50 ${
            voted
              ? 'border border-[#8b22ff]/60 bg-[#8b22ff]/20 text-[#b66cff]'
              : 'bg-[#8b22ff] text-white hover:bg-[#7a1de0]'
          }`}
        >
          {voted ? t.watch.vote_btn_voted : ctx.open ? t.watch.vote_btn_vote : t.watch.vote_btn_closed}
        </button>
      </div>
      {atCap && !msg && (
        <p className="mt-2 text-xs text-white/40">{t.watch.vote_cap_used(ctx.cap)}</p>
      )}
      {msg && <p className="mt-2 text-xs text-[#ff9db0]">{msg}</p>}
    </div>
  )
}
