'use client'

import { useState, useTransition } from 'react'
import { deleteSeason } from './actions'

export function DeleteSeasonButton({
  id,
  seasonName,
}: {
  id: string
  seasonName: string
}) {
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
        await deleteSeason(id)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed')
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
        Delete season
      </button>
    )
  }

  return (
    <div className="border border-[#ff4444]/40 bg-[#ff4444]/[.06] rounded p-5">
      <p className="text-sm text-[#ff8888] font-bold mb-1">
        Delete this season?
      </p>
      <p className="text-xs text-white/60 mb-3">
        This permanently removes <span className="text-white">{seasonName}</span> and
        all references on the public site. Applications tied to this season are
        not deleted but will become orphaned. Type{' '}
        <code className="px-1.5 py-0.5 bg-black/40 rounded text-[#ff8844]">
          delete {seasonName}
        </code>{' '}
        to confirm.
      </p>

      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={`delete ${seasonName}`}
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
          {pending ? 'Deleting…' : 'Delete forever'}
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
          Cancel
        </button>
      </div>
    </div>
  )
}
