import { LoginForm } from './LoginForm'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string; reason?: string }>
}) {
  const params = await searchParams
  const errorParam = params.error
  const redirect = params.redirect ?? '/admin'

  const errorMessage =
    errorParam === 'not_admin'
      ? 'Your account does not have admin access.'
      : errorParam === 'recovery_expired'
        ? 'The password recovery link has expired. Request a new one.'
        : errorParam === 'callback_failed'
          ? `Sign-in callback failed${params.reason ? `: ${params.reason}` : '.'}`
          : errorParam === 'missing_code'
            ? 'The sign-in link was missing required parameters.'
            : null

  return (
    <main className="min-h-screen bg-[#0a0608] text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-[10px] tracking-[0.3em] text-[#ff8844] font-bold mb-2">
            OXXOVO
          </div>
          <h1 className="text-2xl font-black">Admin Console</h1>
          <p className="text-sm text-white/40 mt-2">
            Authorized personnel only.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 px-4 py-3 rounded border border-[#ff4444]/30 bg-[#ff4444]/10 text-sm text-[#ff8888]">
            {errorMessage}
          </div>
        )}

        <LoginForm redirectTo={redirect} />
      </div>
    </main>
  )
}
