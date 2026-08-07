'use client'

import { useState } from 'react'
import { useAdminLang } from '@/lib/admin-i18n'

// Read-only. There is no server action imported here on purpose -- see
// app/admin/actors/page.tsx and lib/studio-official-actors.ts.
//
// Field labels are the column names themselves, deliberately: the only new copy
// this feature adds is the nav entry. Anything a reader needs beyond a column
// name is explained by the two lock notes, which are the one thing here that must
// NOT read as interchangeable.

export type ActorRow = {
  id: string
  slug: string
  displayName: string | null
  kind: string
  status: string
  canonicalFrontalUrl: string
  referenceUrls: string[]
  provenance: Record<string, unknown> | null
  cryptobindHash: string | null
  cryptobindSignature: string | null
  cryptobindAlgo: string | null
  createdAt: string
  updatedAt: string | null
  verified: boolean
  verifyReason: string | null
}

const DICT = {
  en: {
    title: 'Actors',
    subtitle:
      "OXXOVO's own synthetic performers. Read-only: the signed fields cannot be edited here at all, and the rest has no agreed vocabulary yet.",
    none: 'No actors yet.',
    sigLocked: 'Signature-locked — inside the CryptoBind canonical string, so it cannot be edited here or re-signed here.',
    policyLocked: 'Policy lock — public name not yet decided. The value below is not authoritative.',
    displayPending: (v: string | null) => (v ? `Undecided (DB value: ${v})` : 'Undecided (DB value: empty)'),
    notEditable: 'Display only — no CHECK constraint exists on this column and the allowed values are not decided.',
    verifiedOk: 'Signature verifies',
    verifiedBad: 'SIGNATURE DOES NOT VERIFY',
    reason: (r: string) => `reason: ${r}`,
    provenance: 'provenance',
    refs: (n: number) => `reference_urls (${n})`,
    copy: 'Copy',
    copied: 'Copied',
    raw: 'Raw JSON',
  },
  ko: {
    title: '배우',
    subtitle:
      'OXXOVO 공식 합성 배우. 읽기 전용 — 서명 대상 필드는 여기서 수정도 재서명도 할 수 없고, 나머지는 허용값이 정해지지 않았습니다.',
    none: '등록된 배우가 없습니다.',
    sigLocked: '서명 잠금 — CryptoBind 정경 문자열에 포함됩니다. 여기서 수정도 재서명도 불가.',
    policyLocked: '정책 잠금 — 이름 확정 대기. 아래 값은 정본이 아닙니다.',
    displayPending: (v: string | null) => (v ? `미확정 (DB값: ${v})` : '미확정 (DB값: 없음)'),
    notEditable: '표시 전용 — 이 컬럼에 CHECK 제약이 없고 허용값이 정해지지 않았습니다.',
    verifiedOk: '서명 유효',
    verifiedBad: '서명 불일치',
    reason: (r: string) => `사유: ${r}`,
    provenance: 'provenance',
    refs: (n: number) => `reference_urls (${n}장)`,
    copy: '복사',
    copied: '복사됨',
    raw: '원본 JSON',
  },
}

// No `as const` on DICT, matching PromoView: it would narrow every value to its
// literal type and the ko half would then not satisfy Dict.
type Dict = (typeof DICT)['en']

export function ActorsView({ rows }: { rows: ActorRow[] }) {
  const lang = useAdminLang()
  const t = DICT[lang]

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-black">{t.title}</h1>
        <p className="mt-1 text-sm text-white/50 max-w-2xl">{t.subtitle}</p>
      </header>

      {rows.length === 0 ? (
        <p className="text-white/40 text-sm">{t.none}</p>
      ) : (
        <div className="space-y-6">
          {rows.map((r) => (
            <ActorCard key={r.id} row={r} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function ActorCard({ row, t }: { row: ActorRow; t: Dict }) {
  const [openRaw, setOpenRaw] = useState(false)

  return (
    <section className="rounded-lg border border-white/10 bg-white/[.02] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-mono text-lg font-bold text-white">{row.slug}</h2>
          <p className="mt-1 text-[11px] text-white/35">
            {row.id} · created {row.createdAt}
            {row.updatedAt ? ` · updated ${row.updatedAt}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded px-3 py-1.5 text-[11px] font-bold ${
            row.verified
              ? 'border border-[#44cc88]/40 bg-[#44cc88]/10 text-[#88ddaa]'
              : 'border border-[#ff4444]/40 bg-[#ff4444]/10 text-[#ff8888]'
          }`}
        >
          {row.verified ? t.verifiedOk : t.verifiedBad}
          {!row.verified && row.verifyReason ? ` — ${t.reason(row.verifyReason)}` : ''}
        </span>
      </div>

      {/* display_name: locked, but for a different reason than everything below.
          The two notes are worded so neither can be mistaken for the other. */}
      <Field label="display_name" lock="policy" lockNote={t.policyLocked}>
        <span className="text-white/80">{t.displayPending(row.displayName)}</span>
      </Field>

      <Field label="status" lock="none" lockNote={t.notEditable}>
        <code className="text-white/80">{row.status}</code>
      </Field>
      <Field label="kind" lock="none" lockNote={t.notEditable}>
        <code className="text-white/80">{row.kind}</code>
      </Field>

      <Field label="canonical_frontal_url" lock="signature" lockNote={t.sigLocked}>
        <a
          href={row.canonicalFrontalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-[#b66cff] hover:underline"
        >
          {row.canonicalFrontalUrl}
        </a>
      </Field>

      <Field label={t.refs(row.referenceUrls.length)} lock="signature" lockNote={t.sigLocked}>
        <ul className="space-y-1">
          {row.referenceUrls.map((u) => (
            <li key={u}>
              <a
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-[#b66cff] hover:underline"
              >
                {u}
              </a>
            </li>
          ))}
        </ul>
      </Field>

      <Field label="cryptobind_algo" lock="signature" lockNote={t.sigLocked}>
        <code className="text-white/60">{row.cryptobindAlgo ?? '-'}</code>
      </Field>
      <HexField label="cryptobind_hash" value={row.cryptobindHash} t={t} />
      <HexField label="cryptobind_signature" value={row.cryptobindSignature} t={t} />

      <Field label={t.provenance} lock="signature" lockNote={t.sigLocked}>
        <ProvenanceBlock provenance={row.provenance} />
        <button
          type="button"
          onClick={() => setOpenRaw((o) => !o)}
          className="mt-2 text-[11px] text-white/40 underline hover:text-white/70"
        >
          {t.raw}
        </button>
        {openRaw && (
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-white/40">
            {JSON.stringify(row.provenance, null, 2)}
          </pre>
        )}
      </Field>
    </section>
  )
}

// Lock kind drives the badge, so "cannot edit because crypto" and "cannot edit
// because nobody has decided" are visibly different states.
function Field({
  label,
  lock,
  lockNote,
  children,
}: {
  label: string
  lock: 'signature' | 'policy' | 'none'
  lockNote: string
  children: React.ReactNode
}) {
  const badge =
    lock === 'signature'
      ? { text: '🔒 signed', cls: 'border-[#8b22ff]/40 bg-[#8b22ff]/10 text-[#c79bff]' }
      : lock === 'policy'
        ? { text: '⏳ policy', cls: 'border-[#ffaa44]/40 bg-[#ffaa44]/10 text-[#ffcc88]' }
        : { text: 'read-only', cls: 'border-white/15 bg-white/5 text-white/40' }

  return (
    <div className="mt-5 border-t border-white/5 pt-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-white/40">{label}</span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.text}</span>
      </div>
      <div className="mt-1.5 text-[13px]">{children}</div>
      <p className="mt-1.5 text-[10px] leading-relaxed text-white/30">{lockNote}</p>
    </div>
  )
}

// Full hex goes to the clipboard, not to the screen: a screenshot of this page
// should not carry a whole signature.
function HexField({ label, value, t }: { label: string; value: string | null; t: Dict }) {
  const [copied, setCopied] = useState(false)
  return (
    <Field label={label} lock="signature" lockNote={t.sigLocked}>
      <div className="flex items-center gap-3">
        <code className="text-white/70">{value ? `${value.slice(0, 16)}…` : '-'}</code>
        {value && (
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(value)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              } catch {
                /* clipboard unavailable -- nothing to fall back to that is safer */
              }
            }}
            className="rounded border border-white/15 px-2 py-0.5 text-[10px] text-white/50 hover:border-white/40 hover:text-white/80"
          >
            {copied ? t.copied : t.copy}
          </button>
        )}
      </div>
    </Field>
  )
}

// The provenance jsonb is the evidence behind "fully synthetic, no real-person
// input", so its top-level claims are surfaced rather than left inside a JSON
// blob. Unknown keys are rendered generically -- this must not silently drop a
// key that gets added later.
function ProvenanceBlock({ provenance }: { provenance: Record<string, unknown> | null }) {
  if (!provenance) return <span className="text-white/40">-</span>
  const entries = Object.entries(provenance)
  return (
    <dl className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="shrink-0 font-mono text-[11px] text-white/35">{k}</dt>
          <dd className="min-w-0 break-words text-[12px] text-white/70">
            {typeof v === 'object' && v !== null ? (
              <span className="text-white/50">{JSON.stringify(v)}</span>
            ) : (
              String(v)
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
