'use client'

// 🌐 language picker. Each option is a real link to that language's address of the
// CURRENT page (so it works without script and crawlers see every language). On click it
// stores the choice in the oxxovo_lang cookie -- so the next unprefixed visit goes where
// the visitor chose, English included -- and, for ko/en, in the old toggle's
// localStorage key so the other screens follow (lib/locales syncLegacyLang).
import { useState } from 'react'
import { GlobeIcon } from './icons'
import { LANG_COOKIE, syncLegacyLang } from '@/lib/locales'

const LEGACY_KEY = 'oxxovo_admin_lang'

export type LanguageOption = { code: string; nativeName: string; href: string }

export function LanguageMenu({ current, options, label }: { current: string; options: LanguageOption[]; label: string }) {
  const [open, setOpen] = useState(false)
  const choose = (code: string) => {
    try {
      document.cookie = `${LANG_COOKIE}=${code}; path=/; max-age=31536000; samesite=lax`
      const legacy = syncLegacyLang(code)
      if (legacy) window.localStorage.setItem(LEGACY_KEY, legacy)
    } catch {
      // storage blocked: the link still navigates, only the memory is lost
    }
  }
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center text-[#a79fc4] hover:text-[#f4f0ff]"
      >
        <GlobeIcon />
      </button>
      {open && (
        <ul role="menu" className="absolute end-0 top-full z-20 mt-2 min-w-36 rounded-lg border border-[#2a2340] bg-[#0b0814] py-1 shadow-xl">
          {options.map((o) => (
            <li key={o.code} role="none">
              <a
                role="menuitem"
                href={o.href}
                hrefLang={o.code}
                lang={o.code}
                aria-current={o.code === current ? 'true' : undefined}
                onClick={() => choose(o.code)}
                className={
                  o.code === current
                    ? 'block px-4 py-2 text-sm font-bold text-[#c9a9ff]'
                    : 'block px-4 py-2 text-sm text-[#a79fc4] hover:text-[#f4f0ff]'
                }
              >
                {o.nativeName}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
