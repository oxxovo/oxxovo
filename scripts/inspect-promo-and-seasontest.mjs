#!/usr/bin/env node
/**
 * READ-ONLY census for the (6)C showcase question. No writes, no DDL.
 *
 * Answers, from the live DB via service role:
 *   1. every promo_videos row -- what identifies it to a human, and its R2 key
 *   2. the season_test entries Watch would serve -- title, file, time
 *   3. whether 1 and 2 share any R2 key or filename
 *   4. which table each surface actually renders
 *   5. what key prefixes/folders exist, as referenced by the rows themselves
 *
 * R2 is NOT listed: R2_ACCESS_KEY_ID/R2_BUCKET are absent from .env.local, so
 * folder existence here is "referenced by a row", not "confirmed in the bucket".
 * A prefix with zero referencing rows is therefore invisible to this script -- it
 * can prove a folder is USED, never that one is empty or absent.
 *
 * Section 6 resolves hosts, because the two tables do not agree: 92/93 promo rows
 * and all 51 season_test videos are on the R2 public domain, while a single promo
 * row still points at the old Supabase Storage bucket (promo-videos).
 *
 * Run: node --env-file=.env.local scripts/inspect-promo-and-seasontest.mjs
 *      node --env-file=.env.local scripts/inspect-promo-and-seasontest.mjs --shape
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !KEY) { console.error('Missing env.'); process.exit(1) }
const admin = createClient(SUPABASE_URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const SHAPE = process.argv.includes('--shape')
const PT = 'America/Los_Angeles'
const when = (v) => (v ? new Date(v).toLocaleString('en-CA', { timeZone: PT, hour12: false }).replace(',', '') : '-')
const base = (u) => {
  if (!u) return '-'
  try { return decodeURIComponent(new URL(u).pathname).replace(/^\/+/, '') } catch { return String(u).replace(/^\/+/, '') }
}
const file = (u) => { const k = base(u); return k === '-' ? '-' : k.split('/').pop() }
const dir = (u) => { const k = base(u); if (k === '-') return '-'; const p = k.split('/'); p.pop(); return p.join('/') || '(root)' }
const clip = (s, n) => { if (s == null) return '-'; const t = String(s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t }

// ---------- 1. promo_videos ----------
const { data: promo, error: pe } = await admin.from('promo_videos').select('*').order('created_at', { ascending: true })
if (pe) { console.error('promo_videos read failed:', pe.message); process.exit(1) }

if (SHAPE) {
  console.log('=== promo_videos: column shape (which fields carry human identity) ===')
  const cols = Object.keys(promo[0] ?? {})
  for (const c of cols) {
    const vals = promo.map((r) => r[c]).filter((v) => v !== null && v !== '' && !(Array.isArray(v) && !v.length))
    const distinct = new Set(vals.map((v) => JSON.stringify(v)))
    console.log(`${c.padEnd(24)} nonNull ${String(vals.length).padStart(3)}/${promo.length}  distinct ${String(distinct.size).padStart(3)}  eg ${clip(vals[0], 70)}`)
  }
  console.log('\n=== two full sample rows ===')
  console.log(JSON.stringify(promo.slice(0, 2), null, 2))
  process.exit(0)
}

console.log(`=== 1. promo_videos -- ${promo.length} rows (live, service role) ===\n`)
const statusCount = {}
const sourceCount = {}
for (const r of promo) {
  statusCount[r.status] = (statusCount[r.status] ?? 0) + 1
  sourceCount[r.source] = (sourceCount[r.source] ?? 0) + 1
}
console.log(`status: ${JSON.stringify(statusCount)}   source: ${JSON.stringify(sourceCount)}`)
console.log(`posted_at set: ${promo.filter((r) => r.posted_at).length}   youtube_posted_at set: ${promo.filter((r) => r.youtube_posted_at).length}`)
console.log(`video_url set: ${promo.filter((r) => r.video_url).length}\n`)

// theme_note leads because it is the field that is always populated and always
// distinct (93/93, 93 distinct). The filename is usually descriptive too --
// 92/93 are named like content_A01_fashion_EN_9x16.mp4 -- but exactly one row
// (the 6/20 warm-up test) stores a bare UUID, so the filename cannot be the
// primary key a human selects by. `prompt` and `tier` are empty on all 93.
console.log('  #  theme_note (the always-present label)                    dur  ar     created (PT)      file                                        id')
console.log('  '.padEnd(200, '-'))
promo.forEach((r, i) => {
  const label = r.theme_note || r.prompt
  console.log(
    `${String(i + 1).padStart(3)}  ${clip(label, 55).padEnd(55)} ${String(r.duration_seconds ?? '-').padStart(3)}  ${clip(r.aspect_ratio, 6).padEnd(6)} ${when(r.created_at).padEnd(17)} ${clip(file(r.video_url), 43).padEnd(43)} ${r.id}`,
  )
})

console.log('\n--- promo_videos: key prefixes (folders referenced by rows) ---')
const promoDirs = {}
for (const r of promo) promoDirs[dir(r.video_url)] = (promoDirs[dir(r.video_url)] ?? 0) + 1
for (const [d, n] of Object.entries(promoDirs).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}  ${d}`)

// ---------- 2. season_test entries ----------
const { data: apps, error: ae } = await admin
  .from('genesis_applications')
  .select('id, season_id, status, watch_hidden, watch_hold, moderation_status, creator_name, video_title, video_description, free_entry_url, main_round_video_url, thumbnail_url, ai_service, video_duration_seconds, created_at, studio_application_submitted_at, main_round_submitted_at, award_rank')
  .eq('season_id', 'season_test')
  .order('created_at', { ascending: true })
if (ae) { console.error('genesis_applications read failed:', ae.message); process.exit(1) }

console.log(`\n\n=== 2. genesis_applications where season_id='season_test' -- ${apps.length} rows ===\n`)
const st = {}
for (const r of apps) st[r.status] = (st[r.status] ?? 0) + 1
console.log(`status: ${JSON.stringify(st)}`)
console.log(`prelim video (free_entry_url): ${apps.filter((r) => r.free_entry_url).length}   main video: ${apps.filter((r) => r.main_round_video_url).length}`)
console.log(`watch_hidden: ${apps.filter((r) => r.watch_hidden).length}   watch_hold: ${apps.filter((r) => r.watch_hold).length}\n`)

console.log('  #  title                                 creator          round  file                                        status     created (PT)      id')
console.log('  '.padEnd(190, '-'))
let n = 0
for (const r of apps) {
  for (const [round, url] of [['prelim', r.free_entry_url], ['main', r.main_round_video_url]]) {
    if (!url) continue
    n++
    console.log(
      `${String(n).padStart(3)}  ${clip(r.video_title, 37).padEnd(37)} ${clip(r.creator_name, 16).padEnd(16)} ${round.padEnd(6)} ${clip(file(url), 43).padEnd(43)} ${clip(r.status, 10).padEnd(10)} ${when(r.created_at).padEnd(17)} ${r.id}`,
    )
  }
}
console.log(`\n  ${n} playable videos across ${apps.length} rows`)

console.log('\n--- season_test: key prefixes ---')
const appDirs = {}
for (const r of apps) for (const u of [r.free_entry_url, r.main_round_video_url]) if (u) appDirs[dir(u)] = (appDirs[dir(u)] ?? 0) + 1
for (const [d, c] of Object.entries(appDirs).sort((a, b) => b[1] - a[1])) console.log(`  ${String(c).padStart(3)}  ${d}`)

// ---------- 3. overlap ----------
console.log('\n\n=== 3. do the two sets share any asset? ===\n')
const promoKeys = new Set(promo.map((r) => base(r.video_url)).filter((k) => k !== '-'))
const promoFiles = new Set([...promoKeys].map((k) => k.split('/').pop()))
const appKeys = new Set()
const appFiles = new Set()
for (const r of apps) for (const u of [r.free_entry_url, r.main_round_video_url]) if (u) { appKeys.add(base(u)); appFiles.add(file(u)) }
const keyHits = [...appKeys].filter((k) => promoKeys.has(k))
const fileHits = [...appFiles].filter((f) => promoFiles.has(f))
console.log(`promo distinct R2 keys: ${promoKeys.size}   season_test distinct R2 keys: ${appKeys.size}`)
console.log(`shared full R2 key:  ${keyHits.length}${keyHits.length ? ' -> ' + keyHits.join(', ') : ''}`)
console.log(`shared filename:     ${fileHits.length}${fileHits.length ? ' -> ' + fileHits.join(', ') : ''}`)

// ---------- 4/5. surfaces and demo folders ----------
console.log('\n\n=== 5. watch_demo / season_test key prefixes referenced anywhere ===\n')
const allDirs = new Set([...Object.keys(promoDirs), ...Object.keys(appDirs)])
const interesting = [...allDirs].filter((d) => /demo|test/i.test(d))
console.log(interesting.length ? interesting.map((d) => `  ${d}`).join('\n') : '  none of the referenced prefixes contain "demo" or "test"')
const demoTitled = apps.filter((r) => /demo/i.test(`${r.video_title ?? ''} ${r.creator_name ?? ''} ${r.video_description ?? ''}`))
console.log(`\nseason_test rows whose title/creator/description mentions "demo": ${demoTitled.length}`)
for (const r of demoTitled) console.log(`  ${clip(r.video_title, 40).padEnd(40)} ${clip(r.creator_name, 18).padEnd(18)} ${r.id}`)

console.log('\nNOTE: R2 itself was not listed -- R2_ACCESS_KEY_ID / R2_BUCKET are not in')
console.log('.env.local. Every prefix above is "referenced by a DB row", which cannot')
console.log('prove a folder is absent, only that nothing points at it.')

// ---------- 6. hosts (which storage system each asset actually lives on) ----------
console.log('\n\n=== 6. hosts ===\n')
const hostCount = (rows, get) => {
  const h = {}
  for (const r of rows) for (const u of get(r)) {
    if (!u) continue
    try { h[new URL(u).host] = (h[new URL(u).host] ?? 0) + 1 } catch { h['(unparseable)'] = (h['(unparseable)'] ?? 0) + 1 }
  }
  return h
}
console.log('promo_videos.video_url  ->', JSON.stringify(hostCount(promo, (r) => [r.video_url]), null, 0))
console.log('season_test videos      ->', JSON.stringify(hostCount(apps, (r) => [r.free_entry_url, r.main_round_video_url]), null, 0))
console.log('\nsample URL per prefix:')
const seen = new Set()
for (const r of [...promo.map((x) => x.video_url), ...apps.flatMap((x) => [x.free_entry_url, x.main_round_video_url])]) {
  if (!r) continue
  const d = dir(r)
  if (seen.has(d)) continue
  seen.add(d)
  console.log(`  ${d.padEnd(50)} ${r}`)
}
