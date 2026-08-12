'use client'

import { useState, useTransition } from 'react'
import { toggleFollow } from './actions'
import { useT } from '@/lib/admin-i18n'

// Follow/subscribe to a creator account (YouTube-style). Shown only when the
// video's creator has an account (creatorUserId) and the viewer isn't that
// creator. Members only; signed-out clicks bounce to login. Followed creators
// appear in the Watch sidebar "Subscriptions" list.
export function FollowButton({
  creatorUserId,
  creatorName,
  initialFollowing,
  isLoggedIn,
}: {
  creatorUserId: string
  creatorName: string
  initialFollowing: boolean
  isLoggedIn: boolean
}) {
  const t = useT()
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, start] = useTransition()

  function onClick() {
    if (!isLoggedIn) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`
      return
    }
    start(async () => {
      const res = await toggleFollow(creatorUserId)
      if (res.ok) {
        setFollowing(res.following)
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
      aria-pressed={following}
      title={following ? t.watch.follow_following(creatorName) : t.watch.follow_follow(creatorName)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${
        following
          ? 'border-[#8b22ff]/60 bg-[#8b22ff]/15 text-[#b66cff]'
          : 'border-white/15 text-white/75 hover:border-[#8b22ff]/50'
      }`}
    >
      <span aria-hidden>{following ? '✓' : '+'}</span>
      {following ? t.watch.follow_btn_following : t.watch.follow_btn_follow}
    </button>
  )
}
