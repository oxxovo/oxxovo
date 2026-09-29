#!/usr/bin/env node
/**
 * HQ 2026-08-28: no record of the 8/23 disqualify-gate schema SQL actually
 * running. Read-only information_schema probe (no writes) for the 5 objects
 * named by HQ, to answer "did it run" before touching anything.
 *
 * Run: node --env-file=.env.local scripts/zz_probe_disqualify_gate_schema_2026-08-28.mjs
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('Missing env.'); process.exit(1) }
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const COLUMNS = [
  'main_round_required_elements',
  'main_round_disqualify_missing_votes',
  'main_round_disqualify_appeal_hours',
  'main_round_disqualify_enabled',
]
const TABLE = 'main_round_disqualification_events'

async function main() {
  console.log('=== seasons columns ===')
  // PostgREST doesn't expose information_schema directly, so probe each
  // column the same way the app would hit it: select it with limit 0.
  // 42703 (undefined_column) means "does not exist"; no error means it does.
  for (const col of COLUMNS) {
    const { error } = await admin.from('seasons').select(col).limit(0)
    if (!error) {
      console.log(`  seasons.${col}  EXISTS`)
    } else if (error.code === '42703' || /column .* does not exist/i.test(error.message)) {
      console.log(`  seasons.${col}  MISSING  (${error.message})`)
    } else {
      console.log(`  seasons.${col}  UNKNOWN  (${error.code}: ${error.message})`)
    }
  }

  console.log(`=== table ${TABLE} ===`)
  {
    const { error } = await admin.from(TABLE).select('*').limit(0)
    if (!error) {
      console.log(`  ${TABLE}  EXISTS`)
    } else if (error.code === '42P01' || /relation .* does not exist/i.test(error.message)) {
      console.log(`  ${TABLE}  MISSING  (${error.message})`)
    } else {
      console.log(`  ${TABLE}  UNKNOWN  (${error.code}: ${error.message})`)
    }
  }
}

main()
