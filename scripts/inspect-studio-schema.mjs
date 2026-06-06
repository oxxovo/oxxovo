#!/usr/bin/env node
/**
 * Studio (Session 6) schema 실측. Uses service role (bypasses RLS) to:
 *   - confirm the 3 NEW tables are absent (model_catalog, credit_transactions,
 *     generation_jobs) before writing the idempotent migration
 *   - dump columns of the integration targets (genesis_applications,
 *     platform_config, seasons) so the migration ADDs the right columns and
 *     studio platform_config keys follow the existing convention
 *
 * Run:
 *   node --env-file=.env.local scripts/inspect-studio-schema.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function line(label) {
  console.log('\n== ' + label + ' ' + '='.repeat(Math.max(0, 56 - label.length)))
}

// Probe a table: does it exist, and what columns does a sample row reveal?
async function probe(table) {
  const { data, error } = await admin.from(table).select('*').limit(1)
  if (error) {
    const msg = error.message || String(error)
    const absent = /does not exist|could not find the table|schema cache/i.test(msg)
    return { exists: !absent, error: msg }
  }
  return { exists: true, columns: data?.[0] ? Object.keys(data[0]) : [], sample: data?.[0] ?? null, empty: !data?.[0] }
}

async function main() {
  console.log('Studio schema inspection @ ' + SUPABASE_URL)

  line('NEW tables (expected ABSENT)')
  for (const t of ['model_catalog', 'credit_transactions', 'generation_jobs']) {
    const r = await probe(t)
    console.log(`  ${t.padEnd(22)} ${r.exists ? 'EXISTS  cols: ' + (r.columns?.join(', ') || '(empty)') : 'ABSENT  (' + r.error + ')'}`)
  }

  line('genesis_applications columns')
  {
    const r = await probe('genesis_applications')
    if (!r.exists) console.log('  ! ' + r.error)
    else if (r.empty) console.log('  (table empty — cannot infer columns from a row)')
    else console.log('  ' + r.columns.join(', '))
  }

  line('platform_config (all rows)')
  {
    const { data, error } = await admin.from('platform_config').select('*').order('key')
    if (error) console.log('  ! ' + error.message)
    else {
      if (data[0]) console.log('  columns: ' + Object.keys(data[0]).join(', '))
      for (const row of data) {
        console.log(`    ${String(row.key).padEnd(34)} = ${JSON.stringify(row.value)}  [${row.value_type ?? '?'}]`)
      }
    }
  }

  line('seasons columns + studio-relevant values')
  {
    const r = await probe('seasons')
    if (!r.exists) console.log('  ! ' + r.error)
    else if (r.empty) console.log('  (table empty)')
    else {
      console.log('  ' + r.columns.join(', '))
      // any column hinting an existing per-round generation limit?
      const hints = r.columns.filter((c) => /generat|attempt|max_|round/i.test(c))
      console.log('  round/limit-ish columns: ' + (hints.join(', ') || '(none)'))
    }
  }

  console.log('')
}

main().catch((e) => {
  console.error('\nUnexpected: ' + (e instanceof Error ? e.message : String(e)))
  process.exit(1)
})
