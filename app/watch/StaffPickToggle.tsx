'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setStaffPick } from './actions'

// Admin-only control on the detail page. Score-independent editorial curation.
export function StaffPickToggle({
  applicationId,
  initial,
}: {
  applicationId: string
  initial: boolean
}) {
  const router = useRouter()
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()

  function toggle() {
    start(async () => {
      const res = await setStaffPick(applicationId, !on)
      if (res.ok) {
        setOn(res.staffPick)
        router.refresh()
      }
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition disabled:opacity-50 ${
        on
          ? 'border-[#8b22ff]/60 bg-[#8b22ff]/15 text-[#b66cff]'
          : 'border-white/15 text-white/60 hover:border-white/40'
      }`}
    >
      <span aria-hidden>{on ? '★' : '☆'}</span>
      {on ? 'Staff Pick' : 'Mark Staff Pick'}
      <span className="text-[10px] font-normal text-white/40">admin</span>
    </button>
  )
}
