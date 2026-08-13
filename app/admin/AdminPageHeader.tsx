import { type ReactNode } from 'react'

// Shared page-title header for every /admin/* screen. One place on purpose
// (HQ 2026-08-12): Korean glyphs read heavier than Latin ones at the same
// size (e.g. "배우" at text-3xl reads oversized for two characters), and a
// size fixed per-page drifts the moment one page gets touched and the rest
// don't. Fixing it here means every screen that adopts this component moves
// together.
//
// `title`/`subtitle` take ReactNode, not just string, because a few screens
// compose the title from parts (name + season number) or need a rich
// description (inline links) -- forcing those through a string prop would
// just push the same markup back out into per-page wrappers.
// `right` covers the recurring "title + one thing aligned to it" shape (a
// create-new button, a season/last-updated label) instead of every such
// screen re-deriving its own flex/items-baseline header shell.
export function AdminPageHeader({
  title,
  subtitle,
  right,
}: {
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
}) {
  return (
    <header className="mb-8">
      <div className={right ? 'flex items-baseline justify-between gap-4' : undefined}>
        <h1 className="text-2xl font-black">{title}</h1>
        {right}
      </div>
      {subtitle && <p className="mt-1 text-sm text-white/50 max-w-2xl">{subtitle}</p>}
    </header>
  )
}
