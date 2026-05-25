// Service-role Supabase client. SERVER ONLY.
//
// Only ever import this from files marked 'use server' (server actions) or
// from API route handlers / server components. Importing into a client
// component would bundle SUPABASE_SERVICE_ROLE_KEY into the public JS — that
// key bypasses every RLS policy and must NEVER ship to the browser.
//
// Usage pattern in a server action:
//   'use server'
//   import { createSupabaseAdmin } from '@/lib/supabase-admin'
//   ...
//   const admin = createSupabaseAdmin()
//   const { data: { user } } = await admin.auth.getUser(userJwt)
//   await admin.from('...').update({ ... }).eq('id', verifiedId)

import 'server-only'
import { createClient } from '@supabase/supabase-js'

export function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error(
      'createSupabaseAdmin: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing. ' +
        'Set both in .env.local (dev) and Vercel Environment Variables (prod).',
    )
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
