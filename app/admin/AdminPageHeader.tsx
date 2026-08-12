// Shared page-title header for every /admin/* screen. One place on purpose
// (HQ 2026-08-12): Korean glyphs read heavier than Latin ones at the same
// size (e.g. "배우" at text-3xl reads oversized for two characters), and a
// size fixed per-page drifts the moment one page gets touched and the rest
// don't. Fixing it here means every screen that adopts this component moves
// together.
export function AdminPageHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl font-black">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-white/50 max-w-2xl">{subtitle}</p>}
    </header>
  )
}
