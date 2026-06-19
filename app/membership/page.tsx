'use client'

// /membership -- public landing. Four-tier comparison + Founding perk + a
// state-aware join CTA. Bilingual (useT). Every number (price, founding
// cap/term) comes from a server action backed by platform_config -- no
// hardcoded amounts. Dark launch (membership_enabled=false): all info still
// renders, but the CTA is disabled ("Coming soon") -- TK decision 2026-06-16.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useT, useAdminLang, setAdminLang, type Lang } from '@/lib/admin-i18n'
import { formatFooterStatusLine } from '@/lib/ip-info'
import { getMembershipLandingData } from './actions'
import type { MembershipLandingData } from './types'

export default function MembershipPage() {
  const t = useT()
  const m = t.membership
  const [data, setData] = useState<MembershipLandingData | null>(null)

  useEffect(() => {
    getMembershipLandingData()
      .then(setData)
      .catch(() => setData(null))
  }, [])

  const priceText = useMemo(() => {
    if (!data?.price) return null
    return m.price_creator(data.price.toFixed(2), m.interval_unit(data.interval))
  }, [data, m])

  // CTA target by cookie-session state. Disabled when the switch is off.
  const cta = useMemo(() => {
    if (!data) return null
    if (!data.enabled)
      return { label: m.cta_coming_soon, href: null as string | null, disabled: true }
    if (!data.signedIn) return { label: m.cta_signup, href: '/signup', disabled: false }
    if (data.isActiveCreator)
      return { label: m.cta_youre_creator, href: '/profile', disabled: false }
    return { label: m.cta_become_creator, href: '/apply', disabled: false }
  }, [data, m])

  // Comparison rows: cells = [Visitor, Member, Creator, Partner].
  const rows: { label: string; cells: boolean[] }[] = [
    { label: m.row_browse, cells: [true, true, true, true] },
    { label: m.row_vote, cells: [false, true, true, true] },
    { label: m.row_compete, cells: [false, false, true, true] },
    { label: m.row_studio, cells: [false, false, true, true] },
    { label: m.row_host, cells: [false, false, false, true] },
  ]

  const columns = [
    { name: m.col_anonymous, sub: '', highlight: false },
    { name: m.col_general, sub: m.price_free, highlight: false },
    { name: m.col_creator, sub: priceText ?? '', highlight: true },
    { name: m.col_partner, sub: m.partner_track_caption, highlight: false },
  ]

  return (
    <main className="min-h-screen bg-[#030305] text-white">
      <header className="flex h-20 items-center justify-between px-6 md:px-12 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/oxxovo_logo.png"
            alt="OXXOVO"
            className="h-12 drop-shadow-[0_0_18px_rgba(139,34,255,.6)]"
          />
          <span className="text-[22px] font-black tracking-wide text-[#8b22ff]">OXXOVO</span>
        </Link>
        <LangSwitch />
      </header>

      <section className="max-w-3xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <p className="inline-flex items-center gap-2.5 mb-4 text-[12px] font-bold uppercase tracking-[0.16em] text-[#b66cff]">
            <span className="h-2 w-2 rounded-full bg-[#8b22ff] shadow-[0_0_12px_rgba(139,34,255,.7)]" />
            {m.brand_tag}
          </p>
          <h1 className="text-4xl md:text-5xl font-black mb-4">{m.hero_title}</h1>
          <p className="text-white/55 text-sm md:text-[15px] max-w-xl md:max-w-none md:whitespace-nowrap mx-auto leading-relaxed">
            {m.hero_subtitle}
          </p>
          {data?.enabled && (
            <p className="mt-6 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#b66cff]/90">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b66cff]" />
              {data.founding.open
                ? m.founding_badge(data.founding.remaining, data.founding.cap)
                : m.founding_full}
            </p>
          )}
        </div>

        {/* Four-tier comparison */}
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] mb-5 font-bold text-center">
          {m.compare_title}
        </h2>

        {/* Mobile: stacked tier cards (the desktop table would otherwise need
            awkward horizontal scrolling). Each card = tier name + price + its
            ✓ perks. Creator (the main product) is highlighted. */}
        <div className="md:hidden space-y-4 mb-4">
          {columns.map((col, ci) => {
            const perks = rows.filter((r) => r.cells[ci]).map((r) => r.label)
            return (
              <div
                key={ci}
                className={`rounded-xl border px-5 py-4 ${
                  col.highlight
                    ? 'border-[#8b22ff]/50 bg-[#8b22ff]/[.08]'
                    : 'border-white/10 bg-white/[.02]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <span
                    className={`font-black text-lg ${
                      col.highlight ? 'text-[#b66cff]' : 'text-white/90'
                    }`}
                  >
                    {col.name}
                  </span>
                  {col.sub && (
                    <span className="text-xs text-white/50 font-medium text-right leading-tight">
                      {col.sub}
                    </span>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {perks.map((p, pi) => (
                    <li key={pi} className="flex items-center gap-2 text-sm text-white/70">
                      <span className="text-[#b66cff] text-xs">✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Desktop: full comparison table. */}
        <div className="hidden md:block overflow-x-auto -mx-6 px-6 mb-4">
          <table className="w-full min-w-[600px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[16.5%]" />
              <col className="w-[16.5%]" />
              <col className="w-[16.5%]" />
              <col className="w-[16.5%]" />
            </colgroup>
            <thead>
              <tr>
                <th className="py-3 pr-3" />
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className={`py-3 px-2 text-center align-top ${
                      col.highlight ? 'rounded-t-lg bg-[#8b22ff]/10' : ''
                    }`}
                  >
                    <div
                      className={`font-black leading-tight ${
                        col.highlight ? 'text-[#b66cff]' : 'text-white/85'
                      }`}
                    >
                      {col.name}
                    </div>
                    {/* Always rendered (even empty) with a min height so every
                        header column is the same height -> names stay on one row. */}
                    <div className="text-[11px] text-white/45 mt-1 font-medium leading-tight min-h-[2.4em]">
                      {col.sub}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-t border-white/[.06]">
                  <td className="text-white/70 py-3 pr-3">{row.label}</td>
                  {row.cells.map((on, ci) => (
                    <td
                      key={ci}
                      className={`py-3 px-2 text-center ${ci === 2 ? 'bg-[#8b22ff]/[.06]' : ''}`}
                    >
                      {on ? (
                        <span className="text-[#b66cff] font-bold">✓</span>
                      ) : (
                        <span className="text-white/20">–</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-white/35 text-xs mb-14 text-center">{m.vote_note}</p>

        {/* Founding perk */}
        {data?.foundingMonths != null && data.founding.cap > 0 && (
          <div className="rounded-xl border border-[#8b22ff]/30 bg-[#8b22ff]/[.06] px-6 py-7 mb-14 text-center">
            <p className="text-[11px] uppercase tracking-[0.16em] text-[#b66cff] font-bold mb-2">
              {m.founding_section_title}
            </p>
            <p className="text-white/85 text-lg font-bold mb-2">
              {m.founding_section_body(data.founding.cap, data.foundingMonths)}
            </p>
            <p className="text-white/45 text-xs leading-relaxed max-w-md mx-auto">
              {m.founding_renew_note}
            </p>
          </div>
        )}

        {/* Join CTA */}
        <div className="max-w-md mx-auto text-center">
          {!cta ? (
            <div className="h-[56px]" />
          ) : cta.disabled || !cta.href ? (
            <button
              disabled
              className="w-full py-4 rounded-lg font-extrabold text-white/50 bg-white/5 border border-white/10 cursor-not-allowed"
            >
              {cta.label}
            </button>
          ) : (
            <a
              href={cta.href}
              className="block w-full bg-gradient-to-br from-[#7d23ff] via-[#8d23ff] to-[#6220dc] py-4 rounded-lg font-extrabold text-white shadow-[0_0_20px_rgba(139,34,255,.4)] hover:brightness-110 transition"
            >
              {cta.label}
            </a>
          )}
          {data?.enabled && !data.isActiveCreator && (
            <p className="text-white/40 text-xs mt-4">{m.cta_creator_note}</p>
          )}
          {data?.enabled && (
            <p className="text-white/30 text-xs mt-4">
              <Link href="/terms" className="underline hover:text-white/60">
                Membership Terms &amp; Refund Policy
              </Link>
            </p>
          )}
          <Link href="/" className="inline-block text-white/40 text-sm hover:text-white/70 mt-6">
            {m.back_home}
          </Link>
        </div>

        <p className="text-center text-white/30 text-xs mt-16">
          OXXOVO&trade; &copy; 2026 OXXOVO Labs Inc. All Rights Reserved.
        </p>
        <p className="text-center text-white/30 text-xs mt-1">{formatFooterStatusLine()}</p>
      </section>
    </main>
  )
}

// Local KO|EN toggle (mirrors the profile-page pattern).
function LangSwitch() {
  const lang = useAdminLang()
  const cls = (active: boolean) =>
    `px-2 py-1 text-[11px] transition ${
      active ? 'text-[#b66cff] font-bold' : 'text-white/40 hover:text-white/70'
    }`
  const set = (next: Lang) => setAdminLang(next)
  return (
    <div className="flex items-center border border-white/10 rounded overflow-hidden">
      <button type="button" onClick={() => set('ko')} className={cls(lang === 'ko')}>
        KO
      </button>
      <span className="text-white/20 text-[11px]">|</span>
      <button type="button" onClick={() => set('en')} className={cls(lang === 'en')}>
        EN
      </button>
    </div>
  )
}
