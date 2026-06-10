'use client'

import { useEffect } from 'react'

// Generic confirmation modal — signup-tone (deep navy bg + purple/red gradient
// CTA). All copy is passed in by the caller so this stays i18n-agnostic.
// Closes via: confirm button / cancel button / ESC / backdrop click.

type ConfirmModalProps = {
  open: boolean
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'default' | 'danger'
}

export function ConfirmModal({
  open,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const confirmCls =
    variant === 'danger'
      ? 'bg-gradient-to-br from-[#ff4444] to-[#cc3333] hover:brightness-110'
      : 'bg-gradient-to-br from-[#7d23ff] to-[#6220dc] hover:brightness-110'

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a0812] p-6 shadow-[0_0_60px_rgba(139,34,255,.35)]"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">
          {message}
        </p>
        <div className="mt-6 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded border border-white/20 text-white/80 text-sm font-bold hover:border-white/40 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2 rounded text-white text-sm font-bold uppercase tracking-wider transition ${confirmCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
