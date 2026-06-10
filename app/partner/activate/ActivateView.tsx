'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { activatePartner } from './actions'

export type ActivateMode =
  | 'invited' // ready to accept
  | 'active' // already a partner
  | 'not_signed_in' // no session — link missing/expired
  | 'not_invited' // signed in but no pending invite
  | 'error' // callback returned an error

function tierLabel(tier: string | null): string {
  if (!tier) return ''
  return tier.charAt(0).toUpperCase() + tier.slice(1)
}

export function ActivateView({
  mode,
  tier,
  linkError,
}: {
  mode: ActivateMode
  tier: string | null
  linkError: string | null
}) {
  const [agreed, setAgreed] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = () => {
    setErr(null)
    startTransition(async () => {
      const res = await activatePartner(agreed)
      if (!res.ok) {
        setErr(res.errorMessage ?? 'Activation failed.')
        return
      }
      setDone(true)
    })
  }

  const activated = done || mode === 'active'

  return (
    <main className="min-h-screen bg-[#030305] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-black text-[#8b22ff] mb-2">OXXOVO</h1>
          <p className="text-white/50 text-sm">Partner host activation</p>
        </div>

        {activated ? (
          <div className="text-center space-y-5">
            <p className="text-lg font-bold">
              You&rsquo;re now a partner host{tier ? ` (${tierLabel(tier)})` : ''}.
            </p>
            <p className="text-white/50 text-sm">
              You can now create your own tournament.
            </p>
            <Link
              href="/host/new"
              className="inline-block bg-[#8b22ff] text-white font-bold text-sm px-6 py-3 rounded-lg hover:bg-[#7a1de0] transition"
            >
              Create a tournament
            </Link>
          </div>
        ) : mode === 'invited' ? (
          <div className="space-y-5">
            <p className="text-white/70 text-sm leading-relaxed">
              You&rsquo;ve been invited to host on OXXOVO
              {tier ? ` as a ${tierLabel(tier)} partner` : ''}. Review and agree
              to the partner terms to activate your host access.
            </p>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-xs text-white/50 leading-relaxed max-h-48 overflow-y-auto">
              <p className="mb-2 font-semibold text-white/70">Partner terms (summary)</p>
              <p className="mb-2">
                As a partner host you fund your tournament&rsquo;s prize pool,
                which is held in escrow until OXXOVO confirms payment. A platform
                commission applies to tournament revenue. You agree to run your
                tournament under OXXOVO&rsquo;s integrity and scoring rules.
              </p>
              <p>
                Full terms are provided at signup and in your host dashboard.
              </p>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 accent-[#8b22ff]"
              />
              <span className="text-sm text-white/70">
                I agree to the OXXOVO partner terms.
              </span>
            </label>

            {err && <p className="text-sm text-[#ff6b6b]">{err}</p>}

            <button
              type="button"
              disabled={!agreed || pending}
              onClick={submit}
              className="w-full bg-[#8b22ff] text-white font-bold text-sm py-3 rounded-lg disabled:opacity-40 hover:bg-[#7a1de0] transition"
            >
              {pending ? 'Activating…' : 'Activate partner host'}
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-white/70 text-sm">
              {mode === 'not_signed_in' &&
                'This activation link is missing or expired. Please open the invite link from your email again.'}
              {mode === 'not_invited' &&
                'There is no pending partner invitation on this account.'}
              {mode === 'error' &&
                `We couldn't verify your invite link${linkError ? ` (${linkError})` : ''}. Please request a new invite.`}
            </p>
            <Link href="/" className="inline-block text-[#8b22ff] text-sm hover:underline">
              Back to home
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
