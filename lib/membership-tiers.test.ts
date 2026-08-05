// The /membership comparison table under the member-hosted switch.
//
// ★Both directions, deliberately. A test that only asserts "Partner is absent
// when the switch is off" is passed just as happily by code that shows nothing to
// anybody -- the same shape as the i2v guard that rejected every model and looked
// correct because only its refusals were tested. So every assertion below has a
// partner: the ON case says the column comes back.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  visibleTiers,
  visibleRows,
  tierGrants,
  buildMembershipTable,
  TIER_IDS,
  ROW_IDS,
  GRANTS,
} from './membership-tiers.ts'

const OFF = { memberHostedEnabled: false }
const ON = { memberHostedEnabled: true }

// The real strings, verbatim from lib/admin-i18n.ts (EN :1257-1273, KO :1872-1887).
// Copied rather than imported because that bundle is a client module with React
// hooks. What matters is that these are the exact words the page passes in, and
// that the KO half is checked too -- a gate that only closes in English is not
// closed, and 파트너 is what a Korean visitor was actually seeing.
const LABELS = {
  tierLabels: {
    visitor: { name: 'Visitor', sub: '', highlight: false },
    member: { name: 'Member', sub: 'Free', highlight: false },
    // The Creator sub is the only interpolated one (price from platform_config).
    creator: { name: 'Creator', sub: '$19.99 / month', highlight: true },
    partner: { name: 'Partner', sub: 'Separate track — hosting right', highlight: false },
  },
  rowLabels: {
    browse: 'Browse tournaments',
    vote: 'Vote on entries',
    compete: 'Enter tournaments',
    studio: 'Create in Studio',
    host: 'Host tournaments',
  },
} as const

const KO_LABELS = {
  tierLabels: {
    visitor: { name: '비회원', sub: '', highlight: false },
    member: { name: '일반 멤버', sub: '무료', highlight: false },
    creator: { name: '크리에이터', sub: '월 $19.99', highlight: true },
    partner: { name: '파트너', sub: '별도 트랙 — 개설 권한', highlight: false },
  },
  rowLabels: {
    browse: '시합 둘러보기',
    vote: '작품 투표',
    compete: '시합 참가',
    studio: 'Studio 창작',
    host: '시합 개설',
  },
} as const

const allText = (input: { memberHostedEnabled: boolean }, labels = LABELS) => {
  const { columns, rows } = buildMembershipTable({ ...input, ...labels })
  return [
    ...columns.flatMap((c) => [c.name, c.sub]),
    ...rows.map((r) => r.label),
  ].join('\n')
}

test('switch off -> three tiers, and Partner is not one of them', () => {
  assert.deepEqual(visibleTiers(OFF), ['visitor', 'member', 'creator'])
})

test('★switch on -> Partner comes back, in its original position', () => {
  // The other half. Without this, "return []" passes the test above.
  assert.deepEqual(visibleTiers(ON), ['visitor', 'member', 'creator', 'partner'])
})

test('switch off -> the Host tournaments row goes with it', () => {
  assert.deepEqual(visibleRows(OFF), ['browse', 'vote', 'compete', 'studio'])
})

test('★switch on -> the Host tournaments row comes back', () => {
  assert.deepEqual(visibleRows(ON), ['browse', 'vote', 'compete', 'studio', 'host'])
})

test('★the row is not hidden by name -- it is hidden because no visible tier grants it', () => {
  // This is the whole point of deriving the rows. 'host' is not on a hide-list; it
  // disappears because Partner was the only tier granting it. Pinning that means a
  // second partner-only row added later is gated automatically, and a future season
  // that grants hosting to Creators keeps the row without anyone editing this file.
  assert.deepEqual(GRANTS.host, ['partner'], 'host is partner-only -- that is why the gate reaches it')
  for (const state of [OFF, ON]) {
    const tiers = visibleTiers(state)
    for (const row of visibleRows(state)) {
      assert.ok(
        tiers.some((t) => tierGrants(row, t)),
        `row '${row}' is shown but no visible tier grants it (switch ${state.memberHostedEnabled})`,
      )
    }
  }
})

test('★no visible row is a full line of dashes, in either state', () => {
  // The failure this prevents is not a crash. It is a table naming a capability
  // and then denying it to every column on screen -- which is how the removed
  // Partner column would have left "Host tournaments" behind.
  for (const state of [OFF, ON]) {
    for (const row of visibleRows(state)) {
      const checks = visibleTiers(state).filter((t) => tierGrants(row, t)).length
      assert.ok(checks > 0, `row '${row}' has no checkmark (switch ${state.memberHostedEnabled})`)
    }
  }
})

test('the gate only ever subtracts', () => {
  // Turning the switch off must not add, reorder or rename anything. Cheap guard
  // against a "fix" that rebuilds the list for the off case instead of filtering.
  const offTiers = visibleTiers(OFF)
  const onTiers = visibleTiers(ON)
  assert.deepEqual(onTiers.slice(0, offTiers.length), offTiers)
  const offRows = visibleRows(OFF)
  assert.deepEqual(visibleRows(ON).slice(0, offRows.length), offRows)
})

test('every tier and row in the matrix is accounted for', () => {
  // GRANTS must not reference a tier that does not exist, and every row must have
  // an entry -- otherwise `visibleRows` silently drops it in both states and the
  // capability vanishes from the page with no test failing.
  assert.deepEqual(Object.keys(GRANTS).sort(), [...ROW_IDS].sort())
  for (const row of ROW_IDS) {
    assert.ok(GRANTS[row].length > 0, `row '${row}' is granted to nobody`)
    for (const t of GRANTS[row]) {
      assert.ok(TIER_IDS.includes(t), `row '${row}' references unknown tier '${t}'`)
    }
  }
})

// ─── the label layer, which is the part that actually leaks ────────────────
// visibleTiers proves the rule; these prove the page's copy follows it. An id-level
// test alone is passed by a table whose header row is hardcoded to col_partner.

test('★switch off -> the word Partner appears nowhere in the table, EN or KO', () => {
  const en = allText(OFF)
  assert.ok(!en.includes('Partner'), `EN still names Partner:\n${en}`)
  assert.ok(!en.includes('hosting right'), 'EN still carries the partner caption')
  assert.ok(!en.includes('Host tournaments'), 'EN still names the hosting capability')

  const ko = allText(OFF, KO_LABELS)
  assert.ok(!ko.includes('파트너'), `KO still names 파트너:\n${ko}`)
  assert.ok(!ko.includes('개설'), 'KO still carries 개설 (caption or row)')
})

test('★switch on -> all of that copy comes back', () => {
  // The other half again. Head office ruled the strings are kept for season 1+, not
  // deleted, so "comes back when the program does" is the thing to pin.
  const en = allText(ON)
  assert.ok(en.includes('Partner'))
  assert.ok(en.includes('Separate track — hosting right'))
  assert.ok(en.includes('Host tournaments'))

  const ko = allText(ON, KO_LABELS)
  assert.ok(ko.includes('파트너'))
  assert.ok(ko.includes('별도 트랙 — 개설 권한'))
  assert.ok(ko.includes('시합 개설'))
})

test('★the three surviving tiers keep their own copy and their own checkmarks', () => {
  // Gating a column must not disturb the columns beside it. This is the regression
  // the old parallel arrays invited: remove one entry from `columns` and every
  // `rows[].cells[i]` after it silently shifts one tier to the left.
  const off = buildMembershipTable({ ...OFF, ...LABELS })
  const on = buildMembershipTable({ ...ON, ...LABELS })
  for (const id of ['visitor', 'member', 'creator'] as const) {
    const a = off.columns.find((c) => c.id === id)
    const b = on.columns.find((c) => c.id === id)
    assert.deepEqual(a, b, `tier '${id}' changed when the switch moved`)
  }
  for (const row of off.rows) {
    const same = on.rows.find((r) => r.id === row.id)
    assert.ok(same)
    // Compare only the columns that exist in both -- ON has Partner appended.
    assert.deepEqual(row.cells, same.cells.slice(0, row.cells.length), `row '${row.id}' shifted`)
  }
})

test('★the highlight travels with Creator rather than with a column index', () => {
  // The table tinted `ci === 2`, which is Creator only while nothing is removed to
  // the left of it. Now read off the column, so the tint cannot land on a neighbour.
  for (const state of [OFF, ON]) {
    const { columns } = buildMembershipTable({ ...state, ...LABELS })
    const highlighted = columns.filter((c) => c.highlight).map((c) => c.id)
    assert.deepEqual(highlighted, ['creator'], `switch ${state.memberHostedEnabled}`)
  }
})

test('cells line up with columns, in both states', () => {
  for (const state of [OFF, ON]) {
    const { columns, rows } = buildMembershipTable({ ...state, ...LABELS })
    for (const row of rows) {
      assert.equal(row.cells.length, columns.length, `row '${row.id}' has the wrong width`)
      // And each cell is the grant for the tier sitting in that position.
      row.cells.forEach((on2, i) => {
        assert.equal(on2, tierGrants(row.id, columns[i].id), `cell ${row.id}/${columns[i].id}`)
      })
    }
  }
})

test('everyone can browse; only Creator and above compete', () => {
  // The matrix itself, unchanged from the four-column table this replaces. Here so
  // that gating Partner cannot quietly alter what the other three tiers offer.
  assert.deepEqual(GRANTS.browse, ['visitor', 'member', 'creator', 'partner'])
  assert.deepEqual(GRANTS.vote, ['member', 'creator', 'partner'])
  assert.deepEqual(GRANTS.compete, ['creator', 'partner'])
  assert.deepEqual(GRANTS.studio, ['creator', 'partner'])
  assert.equal(tierGrants('compete', 'visitor'), false)
  assert.equal(tierGrants('vote', 'visitor'), false)
})
