'use client'

// Manual release of the prelim anti-copy hold. One button per season that still
// has held entries. The AUTO path (season-tick at application_close_at) is
// opt-in per season and shown here so the admin can see which one is in charge
// before clicking. Visibility only -- nothing about scoring changes.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/admin-i18n'
import { publishPrelim } from '@/app/watch/actions'

export type HeldSeason = {
  seasonId: string
  displayName: string
  heldCount: number
  // ⑤E. Present whether or not anything is still held -- after the release these
  // three are the only record an operator has that it ran.
  cohortCount: number
  lateCount: number
  releasedAt: string | null
  holdEnabled: boolean
  autoPublish: boolean
  closeAt: string | null
}

// UTC, minute precision, matching the close-time line above it. Deliberately not
// localised: an operator comparing this against a cron log needs the same clock
// the log is in.
function stamp(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

function ReleaseButton({ s }: { s: HeldSeason }) {
  const t = useT()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [done, setDone] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  function release() {
    // Irreversible in practice: once the cohort is public the anti-copy window
    // is over, so make the admin confirm the count they are about to publish.
    if (!window.confirm(t.watch_videos.hold_release_confirm(s.displayName, s.heldCount))) return
    setErr(null)
    start(async () => {
      const res = await publishPrelim(s.seasonId)
      if (res.ok) {
        setDone(t.watch_videos.hold_released_msg(res.released))
        router.refresh()
      } else {
        setErr(res.error === 'forbidden' ? t.watch_videos.hold_release_err_forbidden : t.watch_videos.hold_release_err_generic)
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
        {pending ? t.watch_videos.hold_releasing : t.watch_videos.hold_release_btn(s.heldCount)}
      </button>
      {done && <span className="text-xs font-bold text-emerald-400">{done}</span>}
      {err && <span className="text-xs font-bold text-[#ff8888]">{err}</span>}
    </div>
  )
}

export function PrelimHoldPanel({ seasons }: { seasons: HeldSeason[] }) {
  const t = useT()
  if (seasons.length === 0) return null

  return (
    <section className="mt-8 rounded-lg border border-[#8B22FF]/30 bg-[#8B22FF]/5 p-5">
      <h2 className="text-sm font-black uppercase tracking-wider text-[#b66cff]">
        {t.watch_videos.hold_title}
      </h2>
      <p className="mt-2 text-xs text-white/50">{t.watch_videos.hold_desc}</p>
      <ul className="mt-4 space-y-3">
        {seasons.map((s) => (
          <li
            key={s.seasonId}
            className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/10 bg-black/30 px-4 py-3"
          >
            <div className="text-xs">
              <p className="font-bold text-white">{s.displayName}</p>
              <p className="mt-0.5 text-white/40">
                {t.watch_videos.hold_held_count(s.heldCount)}
                {s.closeAt && ` · ${t.watch_videos.hold_close_at(stamp(s.closeAt))}`}
              </p>
              {s.releasedAt ? (
                <p className="mt-0.5 text-emerald-300/80">
                  {t.watch_videos.hold_released(stamp(s.releasedAt))} · {t.watch_videos.hold_cohort_count(s.cohortCount)}
                  {' · '}
                  <span className={s.lateCount > 0 ? 'font-bold text-amber-300' : ''}>
                    {t.watch_videos.hold_late_count(s.lateCount)}
                  </span>
                </p>
              ) : (
                <p className="mt-0.5 text-white/40">{t.watch_videos.hold_not_released}</p>
              )}
              <p className="mt-0.5 text-white/40">
                {s.autoPublish ? t.watch_videos.hold_auto_on : t.watch_videos.hold_auto_off}
                {!s.holdEnabled && t.watch_videos.hold_off_suffix}
              </p>
            </div>
            {/* ★The button goes away when there is nothing to release; the row
                does not. A released season stays on the page as the record. */}
            {s.heldCount > 0 ? (
              <ReleaseButton s={s} />
            ) : (
              <span className="text-xs text-white/30">{t.watch_videos.hold_none}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
