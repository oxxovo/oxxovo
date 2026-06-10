'use client'

import { useEffect, useState } from 'react'
import { useT } from '@/lib/admin-i18n'

// Live countdown to a target Date. 3-segment format:
//   ≥ 1d  → "Xd Yh Zm" / "X일 Y시간 Z분"
//   ≥ 1h  → "Xh Ym Zs" / "X시간 Y분 Z초"
//   < 1h  → "Xm Ys"     / "X분 Y초"
// SSR-safe: initial render is a placeholder; timer starts on mount.
// 1-second tick. onExpire fires once when target is reached.

type CountdownTimerProps = {
  targetAt: Date
  onExpire?: () => void
  className?: string
}

export function CountdownTimer({ targetAt, onExpire, className }: CountdownTimerProps) {
  const t = useT()
  const [now, setNow] = useState<Date | null>(null)
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    const tick = () => {
      const next = new Date()
      setNow(next)
      if (!expired && next >= targetAt) {
        setExpired(true)
        onExpire?.()
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetAt, onExpire, expired])

  if (now === null) {
    return <span className={className}>—</span>
  }

  const remaining = targetAt.getTime() - now.getTime()
  if (remaining <= 0) {
    return <span className={className}>0{t.profile.countdown_unit_second}</span>
  }

  const totalSeconds = Math.floor(remaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  let display: string
  if (days >= 1) {
    display = `${days}${t.profile.countdown_unit_day} ${hours}${t.profile.countdown_unit_hour} ${minutes}${t.profile.countdown_unit_minute}`
  } else if (hours >= 1) {
    display = `${hours}${t.profile.countdown_unit_hour} ${minutes}${t.profile.countdown_unit_minute} ${seconds}${t.profile.countdown_unit_second}`
  } else {
    display = `${minutes}${t.profile.countdown_unit_minute} ${seconds}${t.profile.countdown_unit_second}`
  }

  return <span className={className}>{display}</span>
}
