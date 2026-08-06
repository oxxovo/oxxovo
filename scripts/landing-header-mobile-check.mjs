#!/usr/bin/env node
/**
 * READ-ONLY BROWSER CHECK: does the landing header fit, and are the three auth
 * controls actually reachable, under md?
 *
 * The design that produced this file was argued from computed CSS widths -- the
 * logo's intrinsic aspect (1536x1024) and estimated glyph widths. Those are good
 * enough to order decisions but not to confirm a fit, and `max-md:hidden` is CSS,
 * so the markup contains the element either way and curl cannot see the state.
 * Hence a real browser at real viewports.
 *
 * Measures, per viewport x auth state:
 *   - which header controls are visible (offsetParent + non-zero rect)
 *   - the header row's content width vs the sum of its two clusters
 *   - whether any header child overflows the header box horizontally
 *
 * ★The gate is the under-md viewports only, and that is deliberate. At >=md the
 * `max-md:*` utilities do not apply, so this change is a no-op there -- and >=md
 * ALREADY overflows. Measured at c41ed9d with the change stashed, same harness,
 * same build, clean server: 768px overflowed the header's padding box in both auth
 * states (anonymous `div 660..795` against a 672px content box; logged-in
 * `div 660..1007`), byte-identical to the numbers with the change applied. The
 * cause is the desktop nav (475px) plus a CTA whose label wraps to 129px of height
 * in an 80px row. Failing this script on that would be failing it for a defect it
 * did not cause and cannot fix from under md, so >=md is reported as KNOWN instead.
 * Do not "fix" it by relaxing the under-md assertions.
 *
 * No writes. Drives the local production server (npm start) with system Chrome.
 * Run: node --env-file=.env.local scripts/landing-header-mobile-check.mjs
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const BASE = process.env.CHECK_BASE_URL || 'http://127.0.0.1:3000'
// reports/_shots/ is already gitignored for exactly this -- per-run browser
// artefacts. Do not write these next to the committed reports: an untracked file
// in the tree blocks `npm run deploy:prod`, because `vercel deploy` uploads the
// directory rather than the commit.
const SHOTS = 'reports/_shots'
const DEMO_KEY = 'oxxovo-studio-demo-2026'
// `gated` = this viewport decides the exit code. md is 768px (Tailwind v4 default,
// no config file and no --breakpoint override in globals.css), so 375 is under it
// and 768 is the first viewport where max-md:* stops applying.
const VIEWPORTS = [
  { name: '375 (mobile floor)', width: 375, height: 780, gated: true },
  { name: '768 (md boundary)', width: 768, height: 900, gated: false },
]

// The controls this change exists to make reachable under md, by auth state.
const MUST_SHOW_UNDER_MD = {
  anonymous: ['Log in'],
  'logged-in': ['profile (Hi, ..)', 'Log out'],
}
// Deliberately still hidden under md: a fourth item does not fit, and /profile
// carries the Studio entry behind the same studioFunnel gate.
const MUST_HIDE_UNDER_MD = ['wordmark', 'desktop nav', 'header CTA', 'Studio button']

// The header controls this change is about, by the text/href that identifies them.
const PROBES = [
  { key: 'logo img', sel: 'header a[href="#"] img' },
  { key: 'wordmark', sel: 'header a[href="#"] span' },
  { key: 'desktop nav', sel: 'header nav' },
  { key: 'profile (Hi, ..)', sel: 'header a[href="/profile"]' },
  { key: 'Studio button', sel: 'header a[href="/studio"]' },
  { key: 'header CTA', sel: 'header a[href="/apply"], header a[href="/pre-register"]' },
  { key: 'Log out', sel: 'header button' },
  { key: 'Log in', sel: 'header a[href="/login"]' },
]

async function probe(page) {
  return page.evaluate((probes) => {
    const header = document.querySelector('header')
    const hb = header.getBoundingClientRect()
    const cs = getComputedStyle(header)
    const padL = parseFloat(cs.paddingLeft)
    const padR = parseFloat(cs.paddingRight)
    const content = hb.width - padL - padR

    const shown = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (!el.offsetParent && cs.position !== 'fixed') return null
      if (r.width === 0 || r.height === 0) return null
      return { w: Math.round(r.width), h: Math.round(r.height), left: Math.round(r.left), right: Math.round(r.right) }
    }

    const results = probes.map((p) => ({ key: p.key, rect: shown(document.querySelector(p.sel)) }))

    // Direct flex children of the header = the clusters that compete for the row.
    const clusters = [...header.children].map((c) => {
      const r = c.getBoundingClientRect()
      return { tag: c.tagName.toLowerCase(), w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right) }
    })
    const visible = clusters.filter((c) => c.w > 0)
    const sum = visible.reduce((a, c) => a + c.w, 0)

    // Overflow = any visible child crossing the header's padding box.
    const boxL = hb.left + padL
    const boxR = hb.right - padR
    const overflow = visible.filter((c) => c.left < boxL - 0.5 || c.right > boxR + 0.5)

    return {
      headerW: Math.round(hb.width),
      headerH: Math.round(hb.height),
      contentW: Math.round(content),
      clusterSum: sum,
      clusters: visible,
      overflow,
      results,
      // The logo is the known vertical offender (h-24 = 96px in an h-20 = 80px row).
      logoH: (() => {
        const i = document.querySelector('header a[href="#"] img')
        return i ? Math.round(i.getBoundingClientRect().height) : null
      })(),
    }
  }, PROBES)
}

function report(label, r, state, gated) {
  console.log(`\n-- ${label}`)
  console.log(`   header ${r.headerW}x${r.headerH}px, content ${r.contentW}px, clusters sum ${r.clusterSum}px`)
  console.log(`   logo rendered height ${r.logoH}px (header row is ${r.headerH}px)`)
  const shownKeys = new Set()
  for (const p of r.results) {
    if (p.rect) shownKeys.add(p.key)
    console.log(`   ${p.rect ? 'SHOWN ' : 'hidden'} ${p.key}${p.rect ? `  ${p.rect.w}x${p.rect.h}` : ''}`)
  }

  // The page renders unstyled if the server's chunk hashes do not match .next --
  // then every number here is meaningless. The row is h-20; anything else is a
  // broken run, not a finding. This cost one wasted baseline measurement.
  if (r.headerH !== 80) {
    console.log(`   ** INVALID RUN: header row is ${r.headerH}px, expected 80 (h-20). Stylesheet almost certainly 404 -- rebuild and restart the server.`)
    return { fail: 1 }
  }

  let fail = 0
  if (r.overflow.length) {
    const tag = gated ? '** HORIZONTAL OVERFLOW' : '   KNOWN (pre-existing at c41ed9d, >=md, unchanged by this edit) overflow'
    console.log(`   ${tag}: ${r.overflow.map((c) => `${c.tag} ${c.left}..${c.right}`).join(', ')}`)
    if (gated) fail++
  } else {
    console.log(`   no horizontal overflow`)
  }
  if (r.logoH > r.headerH) {
    console.log(`   ${gated ? '**' : '   KNOWN (>=md):'} logo taller than the row by ${r.logoH - r.headerH}px`)
    if (gated) fail++
  }

  if (gated) {
    for (const k of MUST_SHOW_UNDER_MD[state]) {
      if (!shownKeys.has(k)) { console.log(`   ** MISSING under md: ${k} must be reachable here`); fail++ }
    }
    for (const k of MUST_HIDE_UNDER_MD) {
      if (shownKeys.has(k)) { console.log(`   ** UNEXPECTED under md: ${k} should be folded away`); fail++ }
    }
    if (r.clusterSum > r.contentW) {
      console.log(`   ** clusters (${r.clusterSum}px) exceed the content box (${r.contentW}px)`); fail++
    } else {
      console.log(`   fits with ${r.contentW - r.clusterSum}px headroom`)
    }
  }
  return { fail }
}

// A long email local-part is the case the demo account cannot exercise: its own
// local-part is 11 characters, comfortably inside the cap. The failure this guards
// is deceptive -- "Hi, {name}" is one unbreakable word, so the row NEVER wraps and
// the header height never betrays it. Flex sacrifices the siblings instead: at 14
// characters the Log out label goes to two lines, from 15 the logo starts
// shrinking, and at 31 the logo is 0px wide. So assert the siblings, not the row.
const LONG_NAME = 'christopher.alexander' // 21 ch -- past every threshold above
const UNPRESSURED = { logoW: 84, btnW: 93.3, btnH: 43 }

async function longNameCheck(page) {
  const r = await page.evaluate((name) => {
    const header = document.querySelector('header')
    const a = header.querySelector('a[href="/profile"]')
    a.textContent = `Hi, ${name}`
    const img = header.querySelector('a[href="#"] img')
    const btn = header.querySelector('button')
    // How much of the string survives the ellipsis -- a cap that shows one letter
    // would pass a width assertion and still be useless.
    const probe = document.createElement('span')
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${getComputedStyle(a).font}`
    document.body.appendChild(probe)
    let readable = 0
    for (let i = 1; i <= a.textContent.length; i++) {
      probe.textContent = a.textContent.slice(0, i)
      if (probe.getBoundingClientRect().width <= a.clientWidth - 8) readable = i
      else break
    }
    probe.remove()
    return {
      linkW: +a.getBoundingClientRect().width.toFixed(1),
      logoW: +img.getBoundingClientRect().width.toFixed(1),
      btnW: +btn.getBoundingClientRect().width.toFixed(1),
      btnH: +btn.getBoundingClientRect().height.toFixed(1),
      headerH: +header.getBoundingClientRect().height.toFixed(1),
      clipped: a.scrollWidth > a.clientWidth,
      readable,
    }
  }, LONG_NAME)

  console.log(`\n   long local-part "${LONG_NAME}" (${LONG_NAME.length} ch):`)
  console.log(`     link ${r.linkW}px (clipped=${r.clipped}), ~${r.readable} chars readable`)
  console.log(`     logo ${r.logoW}px, Log out ${r.btnW}x${r.btnH}, header ${r.headerH}px`)
  let fail = 0
  const near = (a, b) => Math.abs(a - b) < 1.5
  if (!near(r.logoW, UNPRESSURED.logoW)) { console.log(`     ** logo squeezed to ${r.logoW}px (expected ${UNPRESSURED.logoW})`); fail++ }
  if (!near(r.btnW, UNPRESSURED.btnW)) { console.log(`     ** Log out squeezed to ${r.btnW}px (expected ${UNPRESSURED.btnW})`); fail++ }
  if (!near(r.btnH, UNPRESSURED.btnH)) { console.log(`     ** Log out label wrapped: ${r.btnH}px tall (expected ${UNPRESSURED.btnH})`); fail++ }
  if (r.readable < 12) { console.log(`     ** only ~${r.readable} chars readable -- the cap hides who is signed in`); fail++ }
  if (!fail) console.log(`     siblings untouched and the account is still named`)
  // Numbers cannot tell you whether an ellipsis reads as a name. Leave the shot.
  await page.screenshot({
    path: `${SHOTS}/landing-header-longname-375.png`,
    clip: { x: 0, y: 0, width: 375, height: 140 },
  })
  return fail
}

mkdirSync(SHOTS, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome' })
let bad = 0
try {
  for (const state of ['anonymous', 'logged-in']) {
    const ctx = await browser.newContext()
    if (state === 'logged-in') {
      const p = await ctx.newPage()
      const res = await p.goto(`${BASE}/api/demo-login?key=${DEMO_KEY}`, { waitUntil: 'load' })
      if (!res || res.status() >= 400) {
        console.log(`\n!! demo-login returned ${res && res.status()} -- cannot check logged-in state`)
        await ctx.close()
        bad++
        continue
      }
      await p.close()
    }
    for (const v of VIEWPORTS) {
      const page = await ctx.newPage()
      await page.setViewportSize({ width: v.width, height: v.height })
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
      await page.waitForSelector('header', { timeout: 15000 })
      const r = await probe(page)
      bad += report(`${state} @ ${v.name}`, r, state, v.gated).fail
      if (v.gated && state === 'logged-in') bad += await longNameCheck(page)
      await page.screenshot({
        path: `${SHOTS}/landing-header-${state}-${v.width}.png`,
        clip: { x: 0, y: 0, width: v.width, height: 140 },
      })
      await page.close()
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}

console.log(`\n${bad === 0 ? 'PASS' : `FAIL (${bad})`} -- screenshots in ${SHOTS}/landing-header-*.png`)
process.exit(bad === 0 ? 0 : 1)
