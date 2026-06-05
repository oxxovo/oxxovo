#!/usr/bin/env node
/**
 * 실측: Member Hosted Tournament 인프라 (TK 대표님이 Supabase에 반영 완료)
 * 새 테이블/컬럼이 명세대로 존재하는지 service-role로 직접 확인.
 *
 * Run:
 *   node --env-file=.env.local scripts/inspect-partner-schema.mjs
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

// Grab one row to reveal column names (service role bypasses RLS).
async function cols(table) {
  const { data, error } = await admin.from(table).select('*').limit(1)
  if (error) return { error: error.message }
  return { columns: data?.[0] ? Object.keys(data[0]) : null, sample: data?.[0] ?? null }
}

async function allRows(table, cols = '*') {
  const { data, error } = await admin.from(table).select(cols)
  if (error) return { error: error.message }
  return { rows: data ?? [] }
}

async function main() {
  line('1. platform_config (key-value, expect 6 keys)')
  {
    const r = await allRows('platform_config')
    if (r.error) console.log('  X ' + r.error)
    else {
      console.log('  rows: ' + r.rows.length)
      for (const row of r.rows) console.log('  ' + JSON.stringify(row))
    }
  }

  line('2. member_tier_config (tier PK: bronze/silver/gold)')
  {
    const r = await allRows('member_tier_config')
    if (r.error) console.log('  X ' + r.error)
    else {
      console.log('  rows: ' + r.rows.length)
      for (const row of r.rows) console.log('  ' + JSON.stringify(row))
    }
  }

  line('3. partner_tournaments (columns)')
  {
    const r = await cols('partner_tournaments')
    if (r.error) console.log('  X ' + r.error)
    else console.log('  columns: ' + (r.columns ? r.columns.join(', ') : '(empty table — cannot infer cols from data)'))
  }

  line('4. profiles (expect +9 partner columns)')
  {
    const r = await cols('profiles')
    if (r.error) console.log('  X ' + r.error)
    else if (!r.columns) console.log('  (table empty)')
    else {
      const want = ['partner_status', 'partner_source', 'partner_invited_by', 'partner_invited_at', 'partner_activated_at', 'partner_invite_note', 'cumulative_top50', 'cumulative_wins', 'partner_tier']
      console.log('  all columns: ' + r.columns.join(', '))
      console.log('  -- partner-column presence --')
      for (const c of want) console.log('  ' + (r.columns.includes(c) ? 'OK ' : 'MISSING ') + c)
    }
  }

  line('5. seasons (expect +5 host/escrow columns)')
  {
    const r = await cols('seasons')
    if (r.error) console.log('  X ' + r.error)
    else if (!r.columns) console.log('  (table empty)')
    else {
      const want = ['host_type', 'host_user_id', 'prize_pool_escrow_status', 'prize_pool_escrow_paid_at', 'commission_rate_override']
      console.log('  -- host/escrow-column presence --')
      for (const c of want) console.log('  ' + (r.columns.includes(c) ? 'OK ' : 'MISSING ') + c)
    }
  }

  line('6. email_templates table (spec mentions it — does it exist?)')
  {
    const r = await cols('email_templates')
    if (r.error) console.log('  X ' + r.error + '  <- likely DOES NOT EXIST (emails are code templates)')
    else console.log('  columns: ' + (r.columns ? r.columns.join(', ') : '(empty)'))
  }

  line('7. genesis_applications (Top50/win linkage keys)')
  {
    const r = await cols('genesis_applications')
    if (r.error) console.log('  X ' + r.error)
    else if (!r.columns) console.log('  (table empty)')
    else {
      console.log('  all columns: ' + r.columns.join(', '))
      for (const c of ['user_id', 'email', 'status', 'award_rank', 'season_id']) {
        console.log('  ' + (r.columns.includes(c) ? 'OK ' : 'MISSING ') + c)
      }
    }
  }

  console.log('')
}

main().catch((e) => {
  console.error('Unexpected: ' + (e instanceof Error ? e.message : String(e)))
  process.exit(1)
})
