#!/usr/bin/env node
/**
 * Same control-group check as scripts/zz_probe_vote_selfblock_2026-08-27.mjs
 * (dev server), but against the LIVE production deployment (www.oxxovo.ai,
 * sha 9d43884) per TK's explicit ask after the deploy: "라이브에서 본인 작품
 * 투표가 거부되나". No production season currently has an open vote window
 * (season_0 = 2026-11-14..17), so a zz_ fixture season + fixture accounts +
 * a real cookie session are used, same as the dev-server probe -- this is
 * the same production Supabase DB Preview/dev already share.
 *
 * Controls: self-vote rejected / other's-vote accepted / 2nd vote (cap=1) rejected.
 *
 * Live-DB write probe, C7 discipline: inactive (is_fixture=true), zz_-prefixed
 * ids, cleanup in a finally block.
 *
 * Run: node --env-file=.env.local scripts/zz_probe_vote_selfblock_LIVE_2026-08-27.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { chromium } from 'playwright-core'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SRV = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SRV) { console.error('Missing Supabase env.'); process.exit(1) }
const admin = createClient(URL, SRV, { auth: { autoRefreshToken: false, persistSession: false } })
const BASE = 'https://www.oxxovo.ai'
const COOKIE_DOMAIN = 'www.oxxovo.ai'
const PASSWORD = 'zz-vote-probe-live-2026-08-27'

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  PASS', m) } else { fail++; console.log('  FAIL', m) } }

const created = { seasonIds: [], userIds: [], appIds: [] }

async function cloneFixtureSeason() {
  const { data: base, error: bErr } = await admin.from('seasons').select('*').eq('id', 'season_0').single()
  if (bErr) throw new Error('season_0 read: ' + bErr.message)
  const id = 'zz_vote_live_2026-08-27'
  const now = new Date()
  const row = {
    ...base,
    id,
    name: 'zz vote self-block LIVE probe',
    is_fixture: true,
    season_number: 9808,
    community_vote_start_at: new Date(now.getTime() - 3600_000).toISOString(),
    community_vote_end_at: new Date(now.getTime() + 3600_000).toISOString(),
    community_vote_max_per_user: 1,
  }
  delete row.updated_at
  delete row.created_at
  delete row.prize_first
  delete row.prize_second
  delete row.prize_third
  const { error: iErr } = await admin.from('seasons').insert(row)
  if (iErr) throw new Error(`insert fixture season ${id}: ${iErr.message}`)
  created.seasonIds.push(id)
  return id
}

async function makeUser(label) {
  const email = `voteprobelive-${label}-e2e-${Math.random().toString(36).slice(2, 8)}@oxxovo.test`
  const { data: u, error: uErr } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
  })
  if (uErr) throw new Error('createUser: ' + uErr.message)
  created.userIds.push(u.user.id)
  return { userId: u.user.id, email }
}

async function makeMainEntry(seasonId, userId, label) {
  const email = `voteprobelive-${label}-app-${Math.random().toString(36).slice(2, 8)}@oxxovo.test`
  const { data, error } = await admin.from('genesis_applications').insert({
    season_id: seasonId,
    user_id: userId,
    email,
    creator_name: `VoteProbeLive ${label}`,
    creator_statement: 'x'.repeat(180),
    country: 'US',
    ai_service: 'OXXOVO Studio',
    agreed_to_rules: true,
    agreed_to_privacy: true,
    agreed_to_integrity_notice: true,
    status: 'main_round_submitted',
    moderation_status: 'approved',
    watch_hidden: false,
    watch_hold: false,
    main_round_video_url: 'https://example.com/zz-vote-probe-live.mp4',
    main_round_submitted_at: new Date().toISOString(),
  }).select('id').single()
  if (error) throw new Error(`insert entry ${label}: ${error.message}`)
  created.appIds.push(data.id)
  return data.id
}

async function cookiesFor(email) {
  let caught = []
  const ssr = createServerClient(URL, ANON, { cookies: { getAll: () => [], setAll: (cs) => { caught = cs } } })
  const { error } = await ssr.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error('signIn: ' + error.message)
  return caught
}

async function voteRowsFor(applicationId, userId) {
  const { data } = await admin.from('watch_votes').select('id').eq('application_id', applicationId).eq('user_id', userId)
  return data ?? []
}

async function clickVoteAndWait(page, appId) {
  await page.goto(`${BASE}/watch/${appId}?round=main`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(800)
  const btn = page.getByRole('button', { name: /Vote|투표/ })
  await btn.first().click()
  const t0 = Date.now()
  let bodyText = ''
  for (;;) {
    bodyText = (await page.textContent('body')) ?? ''
    const stillPending = await btn.first().isDisabled().catch(() => false)
    if (!stillPending && (Date.now() - t0 > 2000)) break
    if (Date.now() - t0 > 20000) break
    await page.waitForTimeout(500)
  }
  return bodyText
}

async function main() {
  const seasonId = await cloneFixtureSeason()
  const { userId: uidA, email: emailA } = await makeUser('A')
  const { userId: uidB } = await makeUser('B')
  const { userId: uidC } = await makeUser('C')

  const appSelf = await makeMainEntry(seasonId, uidA, 'A-self')
  const appOther = await makeMainEntry(seasonId, uidB, 'B-other')
  const appOther2 = await makeMainEntry(seasonId, uidC, 'C-other2')

  const ck = await cookiesFor(emailA)

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1200 } })
  await ctx.addCookies(ck.map((c) => ({
    name: c.name, value: c.value, domain: COOKIE_DOMAIN, path: '/',
    httpOnly: false, secure: true, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600,
  })))
  const page = await ctx.newPage()

  try {
    const verRes = await page.goto(`${BASE}/api/version`, { waitUntil: 'domcontentloaded' })
    const verBody = await verRes.text()
    console.log('  live /api/version:', verBody.trim())
    ok(verBody.includes('9d43884'), 'live sha == 9d43884')

    // 1) A votes for A's own entry -> rejected, no row.
    const bodySelf = await clickVoteAndWait(page, appSelf)
    const selfRows = await voteRowsFor(appSelf, uidA)
    ok(selfRows.length === 0, `LIVE: self-vote NOT recorded (rows=${selfRows.length})`)
    ok(/본인 작품에는 투표할 수 없습니다|can.?t vote for your own entry/i.test(bodySelf), 'LIVE: self-vote error message shown in UI')

    // 2) A votes for B's entry -> accepted, 1 row.
    await clickVoteAndWait(page, appOther)
    const otherRows = await voteRowsFor(appOther, uidA)
    ok(otherRows.length === 1, `LIVE: vote for other's entry recorded (rows=${otherRows.length})`)

    // 3) cap=1 already spent -> button pre-disabled on C's page.
    await page.goto(`${BASE}/watch/${appOther2}?round=main`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(800)
    const btn2 = page.getByRole('button', { name: /Vote|투표/ }).first()
    const isDisabled = await btn2.isDisabled()
    const other2Rows = await voteRowsFor(appOther2, uidA)
    ok(other2Rows.length === 0, `LIVE: 2nd vote (over cap) NOT recorded (rows=${other2Rows.length})`)
    ok(isDisabled, 'LIVE: 2nd-vote button pre-disabled by server-rendered cap (atCap)')

    const { count: totalUsed } = await admin.from('watch_votes').select('id', { count: 'exact', head: true })
      .eq('season_id', seasonId).eq('round', 'main').eq('user_id', uidA)
    ok(totalUsed === 1, `LIVE: A's total used votes this season == 1 (got ${totalUsed})`)
  } finally {
    await browser.close()
  }
}

async function cleanup() {
  const report = { ...created }
  try {
    if (created.appIds.length) {
      await admin.from('watch_votes').delete().in('application_id', created.appIds)
      await admin.from('genesis_applications').delete().in('id', created.appIds)
    }
    for (const uid of created.userIds) if (uid) await admin.auth.admin.deleteUser(uid)
    if (created.seasonIds.length) await admin.from('seasons').delete().in('id', created.seasonIds)
    console.log('\ncleanup: deleted', JSON.stringify(report))
  } catch (e) {
    console.log('\ncleanup ERROR (manual check needed):', e.message, JSON.stringify(report))
  }
}

main()
  .catch((e) => { console.error('\nERROR:', e.message); fail++ })
  .finally(async () => {
    await cleanup()
    console.log(`\n== LIVE vote self-block probe: ${pass} pass, ${fail} fail ==`)
    process.exit(fail ? 1 : 0)
  })
