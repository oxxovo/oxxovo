#!/usr/bin/env node
/**
 * 실측: genesis_applications.user_id backfill (Auth Phase 6)
 * - user_id NULL 비율, email 분포
 * - auth.users 와 email 매칭 가능 비율 (미가입자 = NULL 유지 대상)
 * - UNIQUE(season_id, user_id) 충돌 위험 사전 검증 (동일 유저 시즌내 중복 신청)
 *
 * Run:
 *   node --env-file=.env.local scripts/inspect-user-id-backfill.mjs
 */

import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing env.')
  process.exit(1)
}
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } })

function line(l) {
  console.log('\n=== ' + l + ' ' + '='.repeat(Math.max(0, 54 - l.length)))
}

// All auth users' email -> id (case-insensitive), via paginated listUsers.
async function loadAuthEmailMap() {
  const map = new Map()
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error('listUsers: ' + error.message)
    for (const u of data.users) {
      if (u.email) map.set(u.email.trim().toLowerCase(), u.id)
    }
    if (data.users.length < 200) break
  }
  return map
}

async function loadApplications() {
  // Page through all applications (service role bypasses RLS).
  const rows = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from('genesis_applications')
      .select('id, email, season_id, user_id, created_at')
      .range(from, from + pageSize - 1)
    if (error) throw new Error('apps: ' + error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

async function main() {
  const [authMap, apps] = await Promise.all([loadAuthEmailMap(), loadApplications()])

  line('1. genesis_applications 총량 + user_id NULL 비율')
  const total = apps.length
  const nullRows = apps.filter((a) => a.user_id == null)
  const notNull = total - nullRows.length
  console.log('  total apps:           ' + total)
  console.log('  user_id NOT NULL:     ' + notNull)
  console.log('  user_id IS NULL:      ' + nullRows.length + '  (' + (total ? ((nullRows.length / total) * 100).toFixed(1) : 0) + '%)')

  line('2. email 분포')
  const distinctEmails = new Set(apps.map((a) => (a.email ?? '').trim().toLowerCase()).filter(Boolean))
  const nullDistinct = new Set(nullRows.map((a) => (a.email ?? '').trim().toLowerCase()).filter(Boolean))
  console.log('  distinct emails (전체):       ' + distinctEmails.size)
  console.log('  distinct emails (NULL 행):    ' + nullDistinct.size)
  console.log('  auth.users 총 email 수:       ' + authMap.size)

  line('3. NULL 행의 auth.users 매칭 비율')
  let matched = 0
  let unmatched = 0
  const unmatchedEmails = new Set()
  for (const a of nullRows) {
    const e = (a.email ?? '').trim().toLowerCase()
    if (e && authMap.has(e)) matched++
    else {
      unmatched++
      if (e) unmatchedEmails.add(e)
    }
  }
  console.log('  매칭됨 (backfill 대상):       ' + matched)
  console.log('  매칭 안됨 (NULL 유지/미가입):  ' + unmatched + '  (distinct email ' + unmatchedEmails.size + ')')

  line('4. UNIQUE(season_id, user_id) 충돌 위험')
  // Simulate post-backfill user_id for EVERY app, then look for duplicate
  // (season_id, user_id) where user_id is not null.
  const seen = new Map() // key season|uid -> [appIds]
  for (const a of apps) {
    let uid = a.user_id
    if (uid == null) {
      const e = (a.email ?? '').trim().toLowerCase()
      uid = e ? authMap.get(e) ?? null : null
    }
    if (uid == null) continue
    const key = a.season_id + '|' + uid
    if (!seen.has(key)) seen.set(key, [])
    seen.get(key).push({ id: a.id, email: a.email })
  }
  const collisions = [...seen.entries()].filter(([, v]) => v.length > 1)
  if (collisions.length === 0) {
    console.log('  OK: 충돌 없음 — backfill 안전')
  } else {
    console.log('  X 충돌 ' + collisions.length + '건 (동일 시즌 동일 유저 중복) — backfill 중단 대상:')
    for (const [key, v] of collisions.slice(0, 20)) {
      console.log('    ' + key + '  rows=' + v.length + '  emails=' + [...new Set(v.map((x) => x.email))].join(','))
    }
    if (collisions.length > 20) console.log('    ... +' + (collisions.length - 20) + ' more')
  }

  line('5. 요약')
  console.log('  backfill UPDATE 대상(매칭):  ' + matched)
  console.log('  NULL 유지(미가입):           ' + unmatched)
  console.log('  충돌:                        ' + collisions.length + (collisions.length ? ' (해결 전 backfill 금지)' : ''))
  console.log('')
}

main().catch((e) => {
  console.error('Unexpected: ' + (e instanceof Error ? e.message : String(e)))
  process.exit(1)
})
