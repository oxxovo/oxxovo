// Run: node --import ./scripts/test-register.mjs --test lib/music-curation-order.test.ts
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compareForCuration,
  orderForCuration,
  musicCurationOrderTerms,
  CURATION_ORDER_COLUMNS,
  MUSIC_CURATION_PAGE_SIZE,
} from './music-curation-order.ts'

const row = (id, title, reviewScore) => ({ id, title, reviewScore })

// ---- the SQL half, and the trap it is guarding ---------------------------
test('the SQL order terms name ONLY columns that are known to exist', () => {
  for (const t of musicCurationOrderTerms()) {
    assert.ok(
      CURATION_ORDER_COLUMNS.includes(t.column),
      `order term '${t.column}' is not in the allowlist -- an unmigrated column makes PostgREST refuse the whole statement silently`,
    )
  }
})

test('the order terms do NOT mention a review score -- that column is not migrated', () => {
  const cols = musicCurationOrderTerms().map((t) => t.column).join(',')
  for (const forbidden of ['review_score', 'score', 'sort_order', 'genre', 'bpm']) {
    assert.ok(!cols.includes(forbidden), `'${forbidden}' must not reach PostgREST until its migration has run`)
  }
})

test('id is the last term, so paging is stable', () => {
  const terms = musicCurationOrderTerms()
  assert.equal(terms[terms.length - 1].column, 'id')
  assert.ok(terms.length >= 2, 'a single-column order over duplicate titles is not a total order')
})

// ---- the pure rule, today: nothing is scored ------------------------------
test('with no scores anywhere, the rule is title ascending -- which is what the SQL does', () => {
  const rows = [row('c', 'Zither'), row('a', 'Bell'), row('b', 'Moss')]
  assert.deepEqual(orderForCuration(rows).map((r) => r.title), ['Bell', 'Moss', 'Zither'])
})

test('equal titles fall back to id, so two pages never show the same row twice', () => {
  const rows = [row('b2', 'Same'), row('a1', 'Same')]
  assert.deepEqual(orderForCuration(rows).map((r) => r.id), ['a1', 'b2'])
})

test('a null title sorts as empty rather than throwing', () => {
  const rows = [row('a', 'Bell'), row('b', null)]
  assert.deepEqual(orderForCuration(rows).map((r) => r.id), ['b', 'a'])
})

// ---- the pure rule, once [2.5] lands -------------------------------------
test('scored rows come first, highest score first -- audition the best, stop at 1,000', () => {
  const rows = [row('a', 'Aaa'), row('b', 'Bbb', 41), row('c', 'Ccc', 92)]
  assert.deepEqual(orderForCuration(rows).map((r) => r.id), ['c', 'b', 'a'])
})

test('★an UNSCORED row is not a zero-scored row -- it sorts after the rejects, not among them', () => {
  const unscored = row('u', 'Aaa')
  const zero = row('z', 'Zzz', 0)
  assert.ok(compareForCuration(zero, unscored) < 0, 'a measured 0 ranks ahead of "not measured yet"')
  // and the title order does not override that
  assert.deepEqual(orderForCuration([unscored, zero]).map((r) => r.id), ['z', 'u'])
})

test('a non-finite score counts as no score, not as a ranking value', () => {
  for (const bad of [NaN, Infinity, -Infinity, null, undefined, '90']) {
    const rows = [row('good', 'Zzz', 10), row('bad', 'Aaa', bad)]
    assert.equal(orderForCuration(rows)[0].id, 'good', `score=${String(bad)} must not outrank a real score`)
  }
})

test('equal scores fall back to title, then id', () => {
  const rows = [row('b', 'Moss', 50), row('a', 'Bell', 50), row('c', 'Bell', 50)]
  assert.deepEqual(orderForCuration(rows).map((r) => r.id), ['a', 'c', 'b'])
})

// ---- the comparator is a valid total order -------------------------------
// ★A comparator that is not consistent makes Array.sort's result depend on the
// input permutation, so the SAME catalogue pages differently on two reads.
test('the comparator is antisymmetric and transitive over a mixed set', () => {
  const rows = [
    row('a', 'Bell', 90), row('b', 'Bell'), row('c', 'Moss', 90),
    row('d', 'Aaa', 12), row('e', null), row('f', 'Moss', 12), row('g', 'Bell', 90),
  ]
  // `|| 0` normalises -0 to 0: Math.sign(0) is 0 but negating it gives -0, and
  // strict equality distinguishes the two. That is a fact about the assertion, not
  // about the comparator.
  const sgn = (n) => Math.sign(n) || 0
  for (const x of rows) {
    for (const y of rows) {
      assert.equal(
        sgn(compareForCuration(x, y)),
        sgn(-compareForCuration(y, x)),
        `antisymmetry broken for ${x.id} vs ${y.id}`,
      )
    }
  }
  // Same answer from every starting permutation.
  const canonical = orderForCuration(rows).map((r) => r.id).join(',')
  const shuffles = [
    [...rows].reverse(),
    [rows[3], rows[0], rows[6], rows[1], rows[5], rows[2], rows[4]],
    [rows[4], rows[2], rows[1], rows[6], rows[0], rows[5], rows[3]],
  ]
  for (const s of shuffles) {
    assert.equal(orderForCuration(s).map((r) => r.id).join(','), canonical, 'order depends on input permutation')
  }
})

test('sorting does not mutate the caller array', () => {
  const rows = [row('b', 'Zzz'), row('a', 'Aaa')]
  const before = rows.map((r) => r.id).join(',')
  orderForCuration(rows)
  assert.equal(rows.map((r) => r.id).join(','), before)
})

// ---- the page size is a number a human can work --------------------------
test('the page size is bounded well below the 1,000-track catalogue', () => {
  assert.ok(MUSIC_CURATION_PAGE_SIZE > 0)
  assert.ok(MUSIC_CURATION_PAGE_SIZE <= 200, 'a page nobody can scroll is not a page')
})
