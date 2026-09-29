#!/usr/bin/env node
// zz_ probe (C7 convention): READ-ONLY. Reports current
// platform_config.membership_founding_free_count and
// membership_founding_counter.claimed so HQ's rehearsal SQL can be built
// against real values, not assumed ones. No writes, no cleanup needed.
//
// Run: node --env-file=.env.local scripts/zz_probe_founding_state_2026-08-29.mjs

import { createClient } from '@supabase/supabase-js'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: cfg, error: cfgErr } = await admin
    .from('platform_config')
    .select('value')
    .eq('key', 'membership_founding_free_count')
    .maybeSingle()
  if (cfgErr) throw cfgErr

  const { data: counter, error: counterErr } = await admin
    .from('membership_founding_counter')
    .select('claimed')
    .eq('id', 1)
    .maybeSingle()
  if (counterErr) throw counterErr

  console.log('membership_founding_free_count (cap) =', cfg?.value)
  console.log('membership_founding_counter.claimed   =', counter?.claimed)

  const { data: holders } = await admin
    .from('profiles')
    .select('id, founding_creator_number, membership_status, membership_source, created_at')
    .not('founding_creator_number', 'is', null)
    .order('founding_creator_number', { ascending: true })
  console.log('current founding holders:', JSON.stringify(holders, null, 2))
}

main().catch((e) => {
  console.error('PROBE FAILED:', e.message)
  process.exitCode = 1
})
