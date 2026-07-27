'use client'

// Manual release of the prelim anti-copy hold. One button per season that still
// has held entries. The AUTO path (season-tick at application_close_at) is
// opt-in per season and shown here so the admin can see which one is in charge
// before clicking. Visibility only -- nothing about scoring changes.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { publishPrelim } from '@/app/watch/actions'

export type HeldSeason = {
  seasonId: string
  displayName: string
  heldCount: number
  holdEnabled: boolean
  autoPublish: boolean
  closeAt: string | null
}

function ReleaseButton({ s }: { s: HeldSeason }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [done, setDone] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  function release() {
    // Irreversible in practice: once the cohort is public the anti-copy window
    // is over, so make the admin confirm the count they are about to publish.
    if (!window.confirm(`${s.displayName}: 보류 중인 예선 ${s.heldCount}편을 지금 전체 공개합니다. 되돌릴 수 없습니다. 진행할까요?`)) return
    setErr(null)
    start(async () => {
      const res = await publishPrelim(s.seasonId)
      if (res.ok) {
        setDone(`${res.released}편 공개됨`)
        router.refresh()
      } else {
        setErr(res.error === 'forbidden' ? '권한 없음' : '실패 — 다시 시도하세요')
      }
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={release}
        disabled={pending || done !== null}
        className="rounded bg-[#8B22FF] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#a04dff] disabled:opacity-50"
      >
        {pending ? '공개 중…' : `예선 전체 공개 (${s.heldCount})`}
      </button>
      {done && <span className="text-xs font-bold text-emerald-400">{done}</span>}
      {err && <span className="text-xs font-bold text-[#ff8888]">{err}</span>}
    </div>
  )
}

export function PrelimHoldPanel({ seasons }: { seasons: HeldSeason[] }) {
  if (seasons.length === 0) return null

  return (
    <section className="mt-8 rounded-lg border border-[#8B22FF]/30 bg-[#8B22FF]/5 p-5">
      <h2 className="text-sm font-black uppercase tracking-wider text-[#b66cff]">
        예선 공개 보류 (anti-copy hold)
      </h2>
      <p className="mt-2 text-xs text-white/50">
        보류 중인 예선 영상은 본인 외에는 아무에게도 보이지 않습니다. 코호트 전체를 한 번에 공개해
        먼저 제출한 사람의 작품이 복제되지 않도록 하는 장치입니다. 공개는 노출만 바꾸며 채점/순위에는
        영향이 없습니다.
      </p>
      <ul className="mt-4 space-y-3">
        {seasons.map((s) => (
          <li
            key={s.seasonId}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/10 bg-black/30 px-4 py-3"
          >
            <div className="text-xs">
              <p className="font-bold text-white">{s.displayName}</p>
              <p className="mt-0.5 text-white/40">
                보류 {s.heldCount}편
                {s.closeAt && ` · 신청 마감 ${new Date(s.closeAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`}
              </p>
              <p className="mt-0.5 text-white/40">
                {s.autoPublish
                  ? '자동 공개 ON — 마감 시각 이후 첫 정시 cron이 자동으로 공개합니다'
                  : '자동 공개 OFF — 이 버튼으로만 공개됩니다'}
                {!s.holdEnabled && ' · 신규 제출은 더 이상 보류되지 않음(hold OFF)'}
              </p>
            </div>
            <ReleaseButton s={s} />
          </li>
        ))}
      </ul>
    </section>
  )
}
