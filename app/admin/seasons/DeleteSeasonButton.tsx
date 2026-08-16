'use client'

import { useState, useTransition } from 'react'
import { deleteSeason } from './actions'
import { useT } from '@/lib/admin-i18n'

export function DeleteSeasonButton({
  id,
  seasonName,
}: {
  id: string
  seasonName: string
}) {
  const t = useT()
  const [confirmText, setConfirmText] = useState('')
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const expected = `delete ${seasonName}`
  const canDelete = confirmText.trim().toLowerCase() === expected.toLowerCase()

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      try {
        const res = await deleteSeason(id)
        if (!res.ok) {
          switch (res.reason) {
            case 'has_applications':
              setError(t.delete.blocked_applications(res.count))
              break
            case 'has_generation_jobs':
              setError(t.delete.blocked_generation_jobs(res.count))
              break
            case 'has_render_jobs':
              setError(t.delete.blocked_render_jobs(res.count))
              break
            default:
              setError(res.message || t.delete.delete_failed)
          }
        }
        // ok:true never actually reaches here -- deleteSeason redirects on
        // success, which Next intercepts before this promise resolves.
      } catch (e) {
        setError(e instanceof Error ? e.message : t.delete.delete_failed)
      }
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded border border-[#ff4444]/40 text-[#ff8888] text-xs font-bold uppercase tracking-wider hover:bg-[#ff4444]/10 transition"
      >
        {t.delete.button}
      </button>
    )
  }

  return (
    <div className="border border-[#ff4444]/40 bg-[#ff4444]/[.06] rounded p-5">
      <p className="text-sm text-[#ff8888] font-bold mb-1">{t.delete.confirm_title}</p>
      <p className="text-xs text-white/60 mb-3">
        {t.delete.confirm_body_lead(seasonName)}
        <code className="px-1.5 py-0.5 bg-black/40 rounded text-[#ff8844]">
          delete {seasonName}
        </code>
        {t.delete.confirm_body_tail}
      </p>

      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={t.delete.confirm_input_ph(seasonName)}
        className="w-full px-3 py-2 mb-3 bg-[#100608] border border-white/10 rounded text-sm text-white focus:border-[#ff8844] focus:outline-none"
        autoFocus
      />

      {error && (
        <div className="mb-3 px-3 py-2 rounded border border-[#ff4444]/30 bg-[#ff4444]/10 text-xs text-[#ff8888]">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDelete}
          disabled={!canDelete || pending}
          className="px-4 py-2 rounded bg-[#ff4444] text-white text-xs font-bold uppercase tracking-wider hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? t.delete.deleting : t.delete.delete_forever}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setConfirmText('')
            setError(null)
          }}
          disabled={pending}
          className="px-4 py-2 rounded border border-white/15 text-white/70 text-xs font-bold uppercase tracking-wider hover:text-white transition"
        >
          {t.delete.cancel}
        </button>
      </div>
    </div>
  )
}
