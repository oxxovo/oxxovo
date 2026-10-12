// Guards the `npm test` file list in package.json. Node's test runner silently ignores a path
// that does not exist, so one missing space ("a.test.tslib/b.test.ts") drops two files from
// the run with no error and the pass count just comes out lower. This turns that red.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const TEST_FILE = /\.test\.(ts|tsx|mts|mjs|js|cjs)$/
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.vercel', 'coverage', 'out', 'build'])

// Tokens after `--test` in the script, i.e. the file list.
export function listedTests(script: string): string[] {
  const toks = script.trim().split(/\s+/)
  const i = toks.indexOf('--test')
  assert.notEqual(i, -1, 'npm test script has no --test flag')
  return toks.slice(i + 1)
}

export function findListDrift(
  listed: string[],
  onDisk: string[],
  exists: (f: string) => boolean,
): { missing: string[]; absent: string[]; duplicated: string[]; glued: string[] } {
  const set = new Set(listed)
  return {
    missing: onDisk.filter((f) => !set.has(f)),
    absent: listed.filter((f) => !exists(f)),
    duplicated: listed.filter((f, i) => listed.indexOf(f) !== i),
    // two ".test." in one token = two paths run together
    glued: listed.filter((f) => (f.match(/\.test\./g) ?? []).length > 1),
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(join(dir, e.name), out)
    } else if (TEST_FILE.test(e.name)) {
      out.push(join(dir, e.name).replaceAll('\\', '/'))
    }
  }
  return out
}

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
const LISTED = listedTests(pkg.scripts.test)
const ON_DISK = walk('.').map((f) => f.replace(/^\.\//, ''))

test('every *.test.* file in the repo is in the npm test list, and every listed path exists', () => {
  const d = findListDrift(LISTED, ON_DISK, existsSync)
  assert.deepEqual(d.missing, [], 'test files on disk but NOT in package.json test list (they never run)')
  assert.deepEqual(d.absent, [], 'listed paths that do not exist (node ignores them silently)')
  assert.deepEqual(d.duplicated, [], 'listed twice')
  assert.deepEqual(d.glued, [], 'two paths run together without a space')
})

test('the walk really sees test files (positive control: this very file is found and listed)', () => {
  assert.ok(ON_DISK.includes('lib/test-list.test.ts'))
  assert.ok(LISTED.includes('lib/test-list.test.ts'))
  assert.ok(ON_DISK.length >= 70, `only ${ON_DISK.length} test files found; the walk is broken`)
})

// Mutation controls on the checker itself: each known failure shape must turn it red.
const base = ['lib/a.test.ts', 'lib/b.test.ts']
const exists = (f: string) => base.includes(f)

test('control: unchanged input is clean', () => {
  const d = findListDrift(base, base, exists)
  assert.deepEqual(d, { missing: [], absent: [], duplicated: [], glued: [] })
})

test('mutation: a test file missing from the list is caught', () => {
  assert.deepEqual(findListDrift(['lib/a.test.ts'], base, exists).missing, ['lib/b.test.ts'])
})

test('mutation: the missing-space accident (two paths glued) is caught, as absent and glued', () => {
  const d = findListDrift(['lib/a.test.tslib/b.test.ts'], base, exists)
  assert.deepEqual(d.absent, ['lib/a.test.tslib/b.test.ts'])
  assert.deepEqual(d.glued, ['lib/a.test.tslib/b.test.ts'])
  assert.deepEqual(d.missing, ['lib/a.test.ts', 'lib/b.test.ts'])
})

test('mutation: a listed path that does not exist is caught', () => {
  assert.deepEqual(findListDrift([...base, 'lib/gone.test.ts'], base, exists).absent, ['lib/gone.test.ts'])
})

test('mutation: a duplicate entry is caught', () => {
  assert.deepEqual(findListDrift([...base, 'lib/a.test.ts'], base, exists).duplicated, ['lib/a.test.ts'])
})

test('listedTests rejects a script with no --test flag', () => {
  assert.throws(() => listedTests('node foo.mjs'))
})
