'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/admin-i18n'
import { setWatchAsHome } from './actions'

type Notice = { kind: 'ok' } | { kind: 'error'; detail: string }

export function WatchHomeToggle({ initial }: { initial: boolean }) {
  const t = useT()
  const router = useRouter()
  const [on, setOn] = useState(initial)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pending, start] = useTransition()

  function toggle() {
    setNotice(null)
    start(async () => {
      try {
        const res = await setWatchAsHome(!on)
        if (res.ok) {
          setOn(!on)
          setNotice({ kind: 'ok' })
          router.refresh()
        } else {
          setNotice({ kind: 'error', detail: res.error })
        }
      } catch (e) {
        setNotice({ kind: 'error', detail: e instanceof Error ? e.message : String(e) })
      }
    })
  }

  return (
    <div>
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
        <span className="text-sm font-bold">{on ? t.watch_home.toggle_on : t.watch_home.toggle_off}</span>
      </div>
      {notice?.kind === 'ok' && (
        <p role="status" className="mt-3 text-sm text-emerald-300">
          {t.watch_home.save_ok}
        </p>
      )}
      {notice?.kind === 'error' && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {t.watch_home.save_failed}
          <span className="mt-1 block break-all font-mono text-xs text-red-300/70">{notice.detail}</span>
        </p>
      )}
    </div>
  )
}
