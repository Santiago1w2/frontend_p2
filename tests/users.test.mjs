import { mockHttp, success, businessError } from './setup.mjs'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { userListByRole } from '../src/services/AuthService.ts'
import { session } from '../src/lib/session.ts'

beforeEach(() => { session.clear(); session.save('admin-test-session', 100) })

const user = (role, number) => ({ userId: `USR-C-${String(number).padStart(5, '0')}`, email: `${role}${number}@tenant-c.edu`, role, tenantId: 'TENANT_C', status: 'active' })

test('student filter reaches the students after 200 seeded teachers', async () => {
  const users = Array.from({ length: 240 }, (_, index) => user(index < 200 ? 'teacher' : 'student', index + 1))
  const calls = mockHttp(config => {
    const start = config.params.nextToken ? Number(config.params.nextToken.slice('cursor-'.length)) : 0
    const end = start + config.params.limit
    return success({ items: users.slice(start, end), nextToken: end < users.length ? `cursor-${end}` : null })
  })
  const first = await userListByRole('student', { limit: 20 })
  assert.equal(calls.length, 11)
  assert.deepEqual(first.items, users.slice(200, 220))
  assert.equal(first.nextToken, 'cursor-220')
  assert.ok(calls.every(call => call.params.role === undefined))
  assert.ok(calls.every(call => call.headers.get('Authorization') === 'Bearer admin-test-session'))
  const second = await userListByRole('student', { limit: 20, nextToken: first.nextToken })
  assert.deepEqual(second.items, users.slice(220))
  assert.equal(second.nextToken, null)
  assert.equal(calls.length, 12)
})

test('all roles keeps the original page and cursor without extra requests', async () => {
  const page = { items: [user('teacher', 1), user('student', 201)], nextToken: 'opaque+/=' }
  const calls = mockHttp(() => success(page))
  assert.deepEqual(await userListByRole('all', { limit: 20 }), page)
  assert.equal(calls.length, 1)
})

for (const role of ['teacher', 'tenant_admin']) test(`${role} filter returns only the selected role and preserves pagination`, async () => {
  const expected = user(role, 1)
  const calls = mockHttp(() => success({ items: [expected, user('student', 201)], nextToken: 'next-page' }))
  assert.deepEqual(await userListByRole(role), { items: [expected], nextToken: 'next-page' })
  assert.equal(calls.length, 1)
})

test('an empty role result is returned only after all pages were checked', async () => {
  const calls = mockHttp((_config, count) => success(count === 1
    ? { items: [user('teacher', 1)], nextToken: 'empty-page' }
    : count === 2 ? { items: [], nextToken: 'last-page' }
      : { items: [user('tenant_admin', 1)], nextToken: null }))
  assert.deepEqual(await userListByRole('student'), { items: [], nextToken: null })
  assert.equal(calls.length, 3)
})

test('load more follows opaque cursors across pages of a different role', async () => {
  const calls = mockHttp((_config, count) => success(count === 1
    ? { items: [user('teacher', 1)], nextToken: 'next+/=' }
    : { items: [user('student', 201)], nextToken: null }))
  const page = await userListByRole('student', { nextToken: 'start+/=', limit: 20 })
  assert.equal(page.items[0].role, 'student')
  assert.deepEqual(calls.map(call => call.params.nextToken), ['start+/=', 'next+/='])
})

test('cyclic role pagination fails instead of requesting forever', async () => {
  const calls = mockHttp((_config, count) => success({ items: [], nextToken: count % 2 ? 'page-a' : 'page-b' }))
  await assert.rejects(userListByRole('student'), error => error.code === 'INVALID_RESPONSE')
  assert.equal(calls.length, 3)
})

test('an API error while looking for students remains an error', async () => {
  const calls = mockHttp((_config, count) => count === 1
    ? success({ items: [user('teacher', 1)], nextToken: 'next-page' })
    : businessError('FORBIDDEN', 'Only tenant admins can list users'))
  await assert.rejects(userListByRole('student'), error => error.code === 'FORBIDDEN')
  assert.equal(calls.length, 2)
})

test('aborted role searches stop before requesting another page', async () => {
  const controller = new AbortController()
  const calls = mockHttp(() => {
    controller.abort()
    return success({ items: [], nextToken: 'next-page' })
  })
  await assert.rejects(userListByRole('student', {}, controller.signal))
  assert.equal(calls.length, 1)
})
