'use client'

// Clickable poster that opens a full-screen lightbox so participants can take in
// the artwork at full size. Used on the season detail page. Closes on ESC,
// backdrop click, or the close button; locks body scroll while open.

import { useEffect, useState } from 'react'

export function PosterLightbox({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="View poster full size"
        className="group relative block w-full cursor-zoom-in"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-full rounded-xl border border-white/10 shadow-[0_0_40px_rgba(139,34,255,.25)] transition group-hover:brightness-110"
        />
        <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/80 opacity-0 backdrop-blur-sm transition group-hover:opacity-100">
          Click to enlarge
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] flex cursor-zoom-out items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="h-auto max-h-[95vh] w-auto max-w-[95vw] rounded-lg object-contain shadow-2xl"
          />
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}
