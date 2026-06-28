'use client'

import { useState, useTransition } from 'react'
import { toggleWatchLike } from './actions'

// Like is a popularity signal, NOT a judging input (project: message policy --
// likes never touch the score). Members only; signed-out clicks bounce to login.
export function LikeButton({
  applicationId,
  round,
  initialLiked,
  initialCount,
  isLoggedIn,
}: {
  applicationId: string
  round: string
  initialLiked: boolean
  initialCount: number
  isLoggedIn: boolean
}) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, start] = useTransition()

  function onClick() {
    if (!isLoggedIn) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
      return
    }
    start(async () => {
      const res = await toggleWatchLike(applicationId, round)
      if (res.ok) {
        setLiked(res.liked)
        setCount(res.count)
      } else if (res.error === 'auth') {
        window.location.href = '/login'
      }
    })
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={liked}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${
        liked
          ? 'border-[#ff4d6d]/60 bg-[#ff4d6d]/15 text-[#ff7d97]'
          : 'border-white/15 text-white/75 hover:border-white/40'
      }`}
    >
      <span aria-hidden>{liked ? '♥' : '♡'}</span>
      {count.toLocaleString()}
    </button>
  )
}
