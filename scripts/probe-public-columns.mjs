// READ-ONLY live check of the public queries (Phase 1 step 9, HQ/TK 2026-10-07).
//
// Why: lib/content-public.ts answers 404 for EVERY failure, so a column typo
// looks exactly like "switch closed". With the publication switches closed the
// queries never run at all. This runs the SAME column strings
// (lib/content-public-columns.ts) against the live database, for ONE row.
//
//   Usage:  node scripts/probe-public-columns.mjs
//   Env:    SUPABASE_SERVICE_ROLE_KEY   (required; from the environment ONLY)
//           NEXT_PUBLIC_SUPABASE_URL    (public; falls back to that one line of .env.local)
//
// Guarantees:
//  * only .select() is used -- no insert / update / delete / rpc anywhere here;
//  * the target is fixed: source_ref = probe-rt-cl-20261006060004;
//  * output = key NAMES, row counts and error CODES. Never a value of title,
//    description, caption, rights_reason, url, sha256 or anything else. The only
//    values printed are the fixed target ref, the row's id (a uuid), and the
//    host name of the project URL (so a reader knows which database answered);
//  * the service-role key is never read from a file, never printed, never stored.
//
// CONTROL: a deliberately wrong column must FAIL here. If it does not, this
// script could not have noticed a rejection and its PASS means nothing.
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  PUBLIC_CONTENT_COLUMNS,
  PUBLIC_ASSET_COLUMNS,
  RECHECK_ONLY_COLUMNS,
  NEVER_PUBLIC_KEYS,
} from '../lib/content-public-columns.ts'

const TARGET_REF = 'probe-rt-cl-20261006060004'
const PUBLIC_ASSET_ROLES = ['main_16x9', 'main_9x16', 'thumbnail']

function urlFromEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL
  // Only the public URL line, nothing else from the file.
  if (existsSync('.env.local')) {
    const m = /^NEXT_PUBLIC_SUPABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/m.exec(readFileSync('.env.local', 'utf8'))
    if (m) return m[1].trim()
  }
  return null
}

const url = urlFromEnv()
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing input: need NEXT_PUBLIC_SUPABASE_URL (or .env.local) and SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(2)
}

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` -- ${detail}` : ''}`)
}
const errInfo = (e) => `code=${e?.code ?? 'none'}`
const keysOf = (o) => Object.keys(o ?? {}).sort()

console.log(`target server: ${new URL(url).hostname}`)
console.log(`target source_ref: ${TARGET_REF}`)
console.log(`content columns: ${PUBLIC_CONTENT_COLUMNS}`)
console.log(`asset columns:   ${PUBLIC_ASSET_COLUMNS}`)
console.log('')

// 0. control -- a wrong column MUST come back as an error
{
  const { error } = await db.from('contents').select('id, definitely_not_a_column_xyz').limit(1)
  check('control: a wrong column is rejected (so a rejection would be visible here)', !!error, errInfo(error))
  if (!error) {
    console.log('\nThe control did not fail: this script cannot detect a rejected column. Stopping.')
    process.exit(1)
  }
}

// 1. the public content column list, for the one probe row (status filters left off on purpose)
const { data: row, error: cErr } = await db
  .from('contents')
  .select(PUBLIC_CONTENT_COLUMNS)
  .eq('source_ref', TARGET_REF)
  .maybeSingle()
check('contents: PUBLIC_CONTENT_COLUMNS accepted by PostgREST', !cErr, errInfo(cErr))
if (cErr || !row) {
  if (!cErr) check('contents: the probe row exists', false, 'no row returned')
  console.log('\nRESULT: FAIL')
  process.exit(1)
}
console.log(`content id: ${row.id}`)

const rawKeys = keysOf(row)
const projected = rawKeys.filter((k) => !RECHECK_ONLY_COLUMNS.includes(k))
console.log(`raw response keys:        ${rawKeys.join(', ')}`)
console.log(`re-check-only (not projected): ${RECHECK_ONLY_COLUMNS.join(', ')}`)
console.log(`projected keys:           ${projected.join(', ')}`)
const leakedContent = projected.filter((k) => NEVER_PUBLIC_KEYS.includes(k))
check('contents: no never-public key in the projected set', leakedContent.length === 0, leakedContent.join(', '))
const missing = PUBLIC_CONTENT_COLUMNS.split(',').map((c) => c.trim()).filter((c) => !(c in row))
check('contents: every requested column came back as a key', missing.length === 0, missing.join(', '))

// 1b. the SQL exclusion works on the live database: the same row, asked WITH the probe- filter
{
  const { data, error } = await db
    .from('contents')
    .select('id')
    .eq('source_ref', TARGET_REF)
    .not('source_ref', 'ilike', 'probe-%')
    .maybeSingle()
  check('contents: probe- exclusion filter accepted, and it removes this row', !error && data === null, errInfo(error))
}

// 2. the asset column list, for that row's public roles
const { data: assets, error: aErr } = await db
  .from('content_assets')
  .select(PUBLIC_ASSET_COLUMNS)
  .eq('content_id', row.id)
  .in('role', PUBLIC_ASSET_ROLES)
  .not('url', 'is', null)
check('assets: PUBLIC_ASSET_COLUMNS accepted by PostgREST', !aErr, errInfo(aErr))
if (!aErr) {
  const list = assets ?? []
  console.log(`public-role assets returned: ${list.length}  roles: ${list.map((a) => a.role).sort().join(', ') || '(none)'}`)
  const assetKeys = [...new Set(list.flatMap((a) => Object.keys(a)))].sort()
  console.log(`asset response keys:      ${assetKeys.join(', ') || '(no rows)'}`)
  const leakedAsset = assetKeys.filter((k) => NEVER_PUBLIC_KEYS.includes(k))
  check('assets: no never-public key in the response', leakedAsset.length === 0, leakedAsset.join(', '))
  const badRoles = list.filter((a) => !PUBLIC_ASSET_ROLES.includes(a.role)).length
  check('assets: only main_* / thumbnail roles came back', badRoles === 0, `${badRoles} other`)
}

// 3. the configuration reads the public judgement depends on (keys + codes only)
{
  const { error } = await db.from('platform_config').select('key, value').in('key', ['news_publication_enabled', 'entertainment_publication_enabled'])
  check('platform_config: switch read accepted', !error, errInfo(error))
  const { error: pErr } = await db
    .from('platform_config')
    .select('key, value')
    .in('key', ['news', 'drama', 'film', 'cf', 'music', 'music_video'].map((k) => `content_path_${k}`))
  check('platform_config: content_path_* read accepted', !pErr, errInfo(pErr))
}

console.log(`\nRESULT: ${results.every(Boolean) ? 'PASS' : 'FAIL'} (${results.filter(Boolean).length}/${results.length})`)
process.exit(results.every(Boolean) ? 0 : 1)
