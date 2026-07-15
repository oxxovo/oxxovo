// E2E harness shared lib. SERVER/CLI only (service role). ALL writes scoped to
// SEASON. Never touches production or season_test. (TK 2026-07-14)
import { createClient } from '@supabase/supabase-js'

export const SEASON = 'season_e2e'
export const TEMPLATE = 'season_test' // cloned for the season row + prelim asset pool
export const R2 = 'https://pub-bf4080d3cdcd422dbef5b1a7f2b9e19a.r2.dev'
export const TK_UID = '9b5ceed5-34b3-4a64-af4a-3fe898dd547f'

// Reusable main-round assets (no generation). 10 films already in R2.
export const MAIN_CFS = [
  `${R2}/cf/v3/cf_01_lumea_premium.mp4`,
  `${R2}/cf/v3/cf_02_aurelie_premium.mp4`,
  `${R2}/cf/v3/cf_03_novya_pop.mp4`,
  `${R2}/cf/v3/cf_04_bloomix_pop.mp4`,
  `${R2}/cf/v3/cf_05_aquelle_cool.mp4`,
  `${R2}/cf/v3/cf_06_noira_premium.mp4`,
  `${R2}/cf/v3/cf_07_eclare_premium.mp4`,
  `${R2}/cf/v3/cf_08_soira_premium.mp4`,
  `${R2}/cf/v3/cf_09_velix_pop.mp4`,
  `${R2}/seedance/seedance_t2v_720p_15s_lumea15c_s1.mp4`,
]

export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE env missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

// Never let a stray call operate on anything but SEASON.
export function assertScoped(seasonId) {
  if (seasonId !== SEASON) throw new Error(`REFUSED: harness write scoped to ${SEASON}, got ${seasonId}`)
}

export const pastISO = (minAgo = 2) => new Date(Date.now() - minAgo * 60_000).toISOString()
export const futureISO = (minAhead = 60) => new Date(Date.now() + minAhead * 60_000).toISOString()

// Simple assertion collector for the verification checklist.
export function makeChecks() {
  const results = []
  return {
    check(name, cond, detail = '') {
      results.push({ name, pass: !!cond, detail: String(detail) })
    },
    report() {
      let allPass = true
      console.log('\n──────── VERIFICATION ────────')
      for (const r of results) {
        if (!r.pass) allPass = false
        console.log(`  ${r.pass ? '✓' : '✗ FAIL'}  ${r.name}${r.detail ? '  — ' + r.detail : ''}`)
      }
      console.log(`──────── ${allPass ? 'ALL PASS ✅' : 'FAILURES ✗'} (${results.filter(r => r.pass).length}/${results.length}) ────────`)
      return allPass
    },
  }
}

// Fictional but stable creator identities for seeded entries.
export const CREATORS = [
  ['Nova Reel', 'US'], ['Frame & Muse', 'KR'], ['Green Gables', 'CA'], ['Halo Pictures', 'GB'],
  ['Kiln & Clay', 'JP'], ['Orbit Diary', 'DE'], ['Vela Motion', 'FR'], ['Zero-G Studio', 'AU'],
  ['Lumen Works', 'BR'], ['Cine Sol', 'ES'], ['Aurora Frames', 'SE'], ['Pixel Forge', 'IN'],
]
export const creatorFor = (i) => CREATORS[i % CREATORS.length]
