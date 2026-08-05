#!/usr/bin/env node
/**
 * READ-ONLY census. Two questions, both live DB via service role:
 *
 *  1. Are the two master switches that gate the partner program actually off?
 *     (`member_hosted_enabled`, plus `membership_enabled` for context.)
 *  2. Is there any *active* partner? That is the second half of the /profile
 *     return-link condition (isMemberHostedEnabled() AND a real active partner),
 *     and it decides whether the link can ever render today.
 *
 * Writes nothing. No INSERT/UPDATE/DELETE/RPC.
 *
 * Run:
 *   node --env-file=.env.local scripts/inspect-partner-exposure.mjs
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).')
  process.exit(1)
}
const admin = createClient(URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function line(label) {
  console.log('\n=== ' + label + ' ' + '='.repeat(Math.max(0, 56 - label.length)))
}

async function main() {
  line('1. master switches (platform_config)')
  {
    const { data, error } = await admin
      .from('platform_config')
      .select('key, value')
      .in('key', ['member_hosted_enabled', 'membership_enabled', 'session6_enabled'])
    if (error) console.log('  X ' + error.message)
    else {
      for (const k of ['member_hosted_enabled', 'membership_enabled', 'session6_enabled']) {
        const row = data.find((r) => r.key === k)
        console.log('  ' + k.padEnd(24) + ' = ' + (row ? JSON.stringify(row.value) : '(ABSENT)'))
      }
    }
  }

  line('2. partner_status census (profiles)')
  {
    const { data, error } = await admin.from('profiles').select('partner_status')
    if (error) console.log('  X ' + error.message)
    else {
      const tally = new Map()
      for (const r of data) {
        const k = r.partner_status ?? '(null)'
        tally.set(k, (tally.get(k) ?? 0) + 1)
      }
      console.log('  profiles total: ' + data.length)
      for (const [k, n] of [...tally].sort((a, b) => b[1] - a[1])) {
        console.log('  ' + String(k).padEnd(16) + ' ' + n)
      }
      const active = tally.get('active') ?? 0
      console.log('\n  -> active partners: ' + active)
      console.log('  -> /profile return link can render today: ' + (active > 0 ? 'yes (if switch on)' : 'NO'))
    }
  }

  line('3. partner_tournaments (any hosted season at all?)')
  {
    const { data, error } = await admin
      .from('partner_tournaments')
      .select('*', { count: 'exact', head: false })
      .limit(5)
    if (error) console.log('  X ' + error.message)
    else console.log('  rows returned (cap 5): ' + data.length)
  }

  line('4. seasons with host_type != official')
  {
    const { data, error } = await admin
      .from('seasons')
      .select('id, host_type, host_user_id')
      .neq('host_type', 'official')
    if (error) console.log('  X ' + error.message)
    else {
      console.log('  rows: ' + data.length)
      for (const r of data) console.log('  ' + JSON.stringify(r))
    }
  }

  console.log('')
}

main().catch((e) => {
  console.error('Unexpected: ' + (e instanceof Error ? e.message : String(e)))
  process.exit(1)
})
