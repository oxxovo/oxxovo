'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setWatchAsHome } from './actions'

export function WatchHomeToggle({ initial }: { initial: boolean }) {
  const router = useRouter()
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()

  function toggle() {
    start(async () => {
      const res = await setWatchAsHome(!on)
      if (res.ok) {
        setOn(!on)
        router.refresh()
      }
    })
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        role="switch"
        aria-checked={on}
        className={`relative h-8 w-14 rounded-full transition disabled:opacity-50 ${
          on ? 'bg-[#8b22ff]' : 'bg-white/15'
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${on ? 'left-7' : 'left-1'}`}
        />
      </button>
      <span className="text-sm font-bold">{on ? 'ON — root shows Watch' : 'OFF — root shows landing'}</span>
    </div>
  )
}
