import Link from 'next/link'
import { ReactNode } from 'react'
import { getAdminOrNull } from '@/lib/admin-auth'
import { LogoutButton } from './LogoutButton'

const NAV = [
  { href: '/admin', label: 'Dashboard', emoji: '🏠' },
  { href: '/admin/seasons', label: 'Seasons', emoji: '🏗️' },
  { href: '/admin/applications', label: 'Applications', emoji: '📹', soon: true },
  { href: '/admin/winners', label: 'Winners', emoji: '🏆', soon: true },
  { href: '/admin/emails', label: 'Emails', emoji: '📧', soon: true },
]

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await getAdminOrNull()

  // /admin/login still mounts this layout; we render children without the chrome
  // when there's no admin session (login page handles its own UI).
  if (!admin) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-[#0a0608] text-white flex">
      <aside className="w-60 shrink-0 border-r border-[#ff4444]/15 bg-[#100608] flex flex-col">
        <div className="px-5 py-6 border-b border-[#ff4444]/15">
          <div className="text-[10px] tracking-[0.3em] text-[#ff8844] font-bold mb-1">
            OXXOVO
          </div>
          <div className="text-lg font-black text-white">Admin Console</div>
          <div className="mt-3 text-[11px] text-white/40 truncate">
            {admin.email}
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
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
                <span>{item.label}</span>
              </span>
              {item.soon && (
                <span className="text-[9px] uppercase tracking-wider bg-white/5 text-white/40 px-1.5 py-0.5 rounded">
                  soon
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
            ← View public site
          </Link>
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="border-b border-[#ff4444]/15 bg-[#ff4444]/[.04] px-8 py-3 text-[11px] tracking-wider text-[#ff8844] font-bold uppercase">
          ⚠ Admin mode — changes affect the live site
        </div>
        {children}
      </main>
    </div>
  )
}
