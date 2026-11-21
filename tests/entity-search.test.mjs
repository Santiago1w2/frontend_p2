import './setup.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exactEntityId } from '../src/lib/entitySearch.ts'
import { queryCache } from '../src/lib/queryCache.ts'

test('complete seeded and generated course/user IDs normalize spaces and case', () => {
  for (const id of ['CRS-A-00001', 'CRS-A-BCB2FDD0', 'CRS-B-DEADBEEF']) assert.equal(exactEntityId('  ' + id.toLowerCase() + '  ', 'course'), id)
  for (const id of ['USR-A-00201', 'USR-C-ABCDEF12', 'USR-ADMIN-TENANT_A']) assert.equal(exactEntityId('  ' + id.toLowerCase() + '  ', 'user'), id)
})
test('partial IDs, emails, names and wrong resource prefixes retain paginated search', () => {
  for (const text of ['', 'MATE23', 'CRS-', 'CRS-A-', 'CRS-A-000', 'A-00001', 'USR-A-00201']) assert.equal(exactEntityId(text, 'course'), null)
  for (const text of ['', 'admin@tenant-a.edu', 'USR-', 'USR-A-002', 'USR-ADMIN-TENANT_', 'CRS-A-00001']) assert.equal(exactEntityId(text, 'user'), null)
})
test('cancelled list work cannot replace the results of a later request', async () => {
  queryCache.clear()
  const key = ['tenant', 'user', 'users', 'student']
  const entry = queryCache.entry(key)
  let release
  let oldSignal
  const old = queryCache.load(entry, signal => { oldSignal = signal; return new Promise(resolve => { release = resolve }) })
  queryCache.cancel(key)
  assert.equal(oldSignal.aborted, true)
  assert.equal(entry.snapshot.status, 'idle')
  await queryCache.load(entry, async () => ({ items: ['fresh'] }))
  release({ items: ['stale'] })
  await old
  assert.deepEqual(entry.snapshot.data, { items: ['fresh'] })
  assert.equal(entry.snapshot.error, null)
  queryCache.clear()
})
