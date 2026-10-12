// Top-bar icons in ONE file, so replacing them (TK decision pending) is a one-file edit.
export function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" strokeLinecap="round" />
    </svg>
  )
}

export function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </svg>
  )
}

// Left-menu item icon. The mockup has one icon per item; the icon set is a pending TK
// decision, so every item gets the same neutral ring until it is chosen. Swap here only.
export function ItemIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" data-icon="item">
      <rect x="4" y="4" width="16" height="16" rx="4" />
    </svg>
  )
}

// Chevron of the mobile section menu. It turns upside down while the menu is open (the
// <details> parent carries the "group"). Icon set is a pending TK decision: edit here only.
export function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" data-icon="chevron" className="shrink-0 transition-transform group-open:rotate-180">
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
