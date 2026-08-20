// Cross-check lib/nickname.ts's nicknameCollisionKey() against the SQL
// expression the DB unique index actually uses
// (reports/studio_nickname_unique_2026-08-19.sql: lower(regexp_replace(
// display_name, '[ ._-]', '', 'g'))), via the parity-only
// nickname_collision_key_sql() function
// (reports/studio_nickname_collision_key_fn_2026-08-19.sql). TK 2026-08-19:
// two independent definitions of the same rule drift silently (배점 이중 진실,
// same day) unless something other than a comment keeps them equal.
//
// Run: node --import ./scripts/test-register.mjs scripts/verify-nickname-collision-key.mjs
import { createClient } from '@supabase/supabase-js'
import { nicknameCollisionKey } from '../lib/nickname.ts'

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const CASES = [
  'Kira',
  'kira',
  'K i r a',
  'K.i.r.a',
  'Ki-ra',
  'Ki_ra',
  '  Kira  ',
  'OXXOVO_official',
  'OXXOVO팀',
  '0XX0V0', // NOT expected to collide with 'oxxovo' -- this rule is space/./_/- normalization only, not leetspeak
  '지수',
  '지 수',
  'A-B_C.D E',
]

let pass = 0
let fail = 0

for (const input of CASES) {
  const jsKey = nicknameCollisionKey(input)
  const { data: sqlKey, error } = await admin.rpc('nickname_collision_key_sql', { p_value: input })
  if (error) {
    console.log(`  FAIL  ${JSON.stringify(input).padEnd(22)} sql rpc error: ${error.message}`)
    fail++
    continue
  }
  const ok = jsKey === sqlKey
  if (ok) {
    pass++
    console.log(`  OK    ${JSON.stringify(input).padEnd(22)} -> "${jsKey}"`)
  } else {
    fail++
    console.log(`  FAIL  ${JSON.stringify(input).padEnd(22)} js="${jsKey}" sql="${sqlKey}"`)
  }
}

console.log('-'.repeat(60))
console.log(`${pass}/${pass + fail} passed`)
if (fail > 0) process.exitCode = 1
