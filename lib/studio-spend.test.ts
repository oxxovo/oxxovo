import { test } from 'node:test'
import assert from 'node:assert/strict'
import { VENDOR_SPEND_SOURCES, paidTargets, type SpendLedgerRow } from './studio-spend'

// The netting rule decides whether vendor spend counts as "nobody paid for it",
// which is the number an alert fires on. Wrong in either direction is bad in a
// different way: counting a refunded job as paid HIDES real unpaid spend, and
// ignoring charges reports everything as unpaid and makes the signal useless.

const charge = (job: string | null, asset?: string): SpendLedgerRow => ({
  type: 'generation_charge',
  generation_job_id: job,
  metadata: asset ? { music_asset_id: asset } : null,
})
const refund = (job: string | null, asset?: string): SpendLedgerRow => ({
  type: 'refund',
  generation_job_id: job,
  metadata: asset ? { music_asset_id: asset } : null,
})

test('a charge marks its job paid', () => {
  const { jobs } = paidTargets([charge('j1')])
  assert.equal(jobs.has('j1'), true)
})

test('★a refund cancels its charge -- the job is not paid for', () => {
  const { jobs } = paidTargets([charge('j1'), refund('j1')])
  assert.equal(jobs.has('j1'), false)
})

test('order does not matter -- a refund seen before its charge still cancels it', () => {
  const { jobs } = paidTargets([refund('j1'), charge('j1')])
  assert.equal(jobs.has('j1'), false, 'refunds are applied after all charges, not inline')
})

// Music charges carry no generation_job_id; they ride in metadata. Two id
// spaces, one rule, and they must not leak into each other.
test('music is netted on its own id space', () => {
  const { jobs, assets } = paidTargets([charge(null, 'a1'), charge('j1'), refund(null, 'a1')])
  assert.equal(assets.has('a1'), false, 'the refunded music asset is not paid for')
  assert.equal(jobs.has('j1'), true, 'and the unrelated clip is untouched')
  assert.equal(jobs.has('a1'), false)
  assert.equal(assets.has('j1'), false)
})

test('a refund for one asset does not cancel another', () => {
  const { assets } = paidTargets([charge(null, 'a1'), charge(null, 'a2'), refund(null, 'a2')])
  assert.deepEqual([...assets], ['a1'])
})

// Rows with neither id are the admin_adjust / stripe purchase kind. They are not
// about a specific job and must not mark anything paid.
test('ledger rows that name no job and no asset mark nothing', () => {
  const { jobs, assets } = paidTargets([
    { type: 'admin_adjust', generation_job_id: null, metadata: null },
    { type: 'generation_charge', generation_job_id: null, metadata: null },
  ])
  assert.equal(jobs.size, 0)
  assert.equal(assets.size, 0)
})

test('unknown ledger types are ignored rather than treated as payment', () => {
  const { jobs } = paidTargets([{ type: 'admin_adjust', generation_job_id: 'j1', metadata: null }])
  assert.equal(jobs.has('j1'), false, 'a credit grant is not payment for a specific job')
})

test('an empty ledger means nothing is paid for, not that everything is', () => {
  const { jobs, assets } = paidTargets([])
  assert.equal(jobs.size, 0)
  assert.equal(assets.size, 0)
})

// ★Renders spend no vendor money -- ffmpeg runs on our own CPU. Their absence is
// by construction, and pinning it stops someone "fixing" the omission later.
test('render_jobs is deliberately not a vendor spend source', () => {
  const tables = VENDOR_SPEND_SOURCES.map((s) => s.table)
  assert.deepEqual([...tables].sort(), ['generation_jobs', 'studio_music_assets'])
  assert.equal(tables.includes('render_jobs' as never), false)
})

test('each spend source names the timestamp its own table finishes on', () => {
  // The two tables genuinely differ, which is why the window is applied per
  // source rather than once with a shared column name.
  const byTable = Object.fromEntries(VENDOR_SPEND_SOURCES.map((s) => [s.table, s.finishedAt]))
  assert.equal(byTable.generation_jobs, 'worker_finished_at')
  assert.equal(byTable.studio_music_assets, 'updated_at')
})
