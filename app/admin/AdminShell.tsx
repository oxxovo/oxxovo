'use client'

import Link from 'next/link'
import { type ReactNode } from 'react'
import { useT, useAdminLang, setAdminLang } from '@/lib/admin-i18n'
import { LogoutButton } from './LogoutButton'
import { type AdminProfile } from '@/lib/admin-auth'

type NavItemKey =
  | 'dashboard'
  | 'seasons'
  | 'applications'
  | 'pre_registrations'
  | 'contacts'
  | 'winners'
  | 'partners'
  | 'emails'
  | 'credits'
  | 'promo'
  | 'messages'
  | 'comments'
  | 'watch_home'
  | 'watch_videos'
  | 'broadcasts'

const NAV: Array<{ href: string; key: NavItemKey; emoji: string; soon?: boolean }> = [
  { href: '/admin', key: 'dashboard', emoji: '🏠' },
  { href: '/admin/seasons', key: 'seasons', emoji: '🏗️' },
  { href: '/admin/applications', key: 'applications', emoji: '📹' },
  { href: '/admin/pre-registrations', key: 'pre_registrations', emoji: '📨' },
  { href: '/admin/contacts', key: 'contacts', emoji: '📇' },
  { href: '/admin/winners', key: 'winners', emoji: '🏆' },
  { href: '/admin/partners', key: 'partners', emoji: '🤝' },
  { href: '/admin/emails', key: 'emails', emoji: '📧' },
  { href: '/admin/broadcasts', key: 'broadcasts', emoji: '📢' },
  { href: '/admin/credits', key: 'credits', emoji: '💳' },
  { href: '/admin/promo', key: 'promo', emoji: '🎬' },
  { href: '/admin/messages', key: 'messages', emoji: '💬' },
  { href: '/admin/comments', key: 'comments', emoji: '🗨️' },
  { href: '/admin/watch-home', key: 'watch_home', emoji: '📺' },
  { href: '/admin/watch-videos', key: 'watch_videos', emoji: '🎞️' },
]

export function AdminShell({
  admin,
  memberHostedEnabled = false,
  children,
}: {
  admin: AdminProfile
  memberHostedEnabled?: boolean
  children: ReactNode
}) {
  const t = useT()

  // Member-hosted nav entry is hidden unless the program is on (master switch).
  const nav = NAV.filter((item) => item.key !== 'partners' || memberHostedEnabled)

  return (
    <div className="min-h-screen bg-[#0a0608] text-white flex">
      <aside className="w-60 shrink-0 border-r border-[#ff4444]/15 bg-[#100608] flex flex-col">
        <div className="px-5 py-6 border-b border-[#ff4444]/15">
          <div className="text-[10px] tracking-[0.3em] text-[#ff8844] font-bold mb-1">
            OXXOVO
          </div>
          <div className="text-lg font-black text-white">{t.layout.admin_console}</div>
          <div className="mt-3 text-[11px] text-white/40 truncate">{admin.email}</div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.soon ? '#' : item.href}
              className={`flex items-center justify-between px-3 py-2.5 rounded text-sm transition ${
                item.soon
                  ? 'text-white/30 cursor-not-allowed'
                  : 'text-white/80 hover:bg-[#ff4444]/10 hover:text-white'
              }`}
              aria-disabled={item.soon}
            >
              <span className="flex items-center gap-2.5">
                <span>{item.emoji}</span>
                <span>{t.layout.nav[item.key]}</span>
              </span>
              {item.soon && (
                <span className="text-[9px] uppercase tracking-wider bg-white/5 text-white/40 px-1.5 py-0.5 rounded">
                  {t.layout.soon}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-[#ff4444]/15 space-y-2">
          <Link
            href="/"
            className="block px-3 py-2 text-xs text-white/40 hover:text-white/70 transition"
          >
            {t.layout.view_public_site}
          </Link>
          <LangToggle />
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="border-b border-[#ff4444]/15 bg-[#ff4444]/[.04] px-8 py-3 text-[11px] tracking-wider text-[#ff8844] font-bold uppercase">
          {t.layout.admin_mode_banner}
        </div>
        {children}
      </main>
    </div>
  )
}

function LangToggle() {
  const lang = useAdminLang()
  const buttonCls = (active: boolean, isLeft: boolean) =>
    `flex-1 px-2 py-1.5 text-[11px] transition ${isLeft ? '' : 'border-l border-white/10'} ${
      active
        ? 'bg-[#ff4444]/15 text-[#ff8844] font-bold'
        : 'text-white/50 hover:text-white/80'
    }`

  return (
    <div className="flex border border-white/10 rounded overflow-hidden">
      <button
        type="button"
        onClick={() => setAdminLang('ko')}
        className={buttonCls(lang === 'ko', true)}
      >
        🇰🇷 한국어
      </button>
      <button
        type="button"
        onClick={() => setAdminLang('en')}
        className={buttonCls(lang === 'en', false)}
      >
        🇺🇸 English
      </button>
    </div>
  )
}
