import { mockHttp, success, businessError } from './setup.mjs'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiClient, versionedBase, API_USER, API_COURSE } from '../src/api/api.ts'
import { ApiError, parseEnvelope } from '../src/api/errors.ts'
import { session } from '../src/lib/session.ts'
import * as AuthService from '../src/services/AuthService.ts'
import * as CourseService from '../src/services/CourseService.ts'

beforeEach(() => { session.clear(); mockHttp(() => { throw new Error('Unmocked request') }) })
test('unwraps successful envelopes including an empty logout result', () => {
  assert.deepEqual(parseEnvelope({ data: {}, requestId: 'id' }), {})
  assert.deepEqual(parseEnvelope({ data: { items: [], nextToken: null } }), { items: [], nextToken: null })
})
test('HTTP 200 business errors preserve code, message and requestId', async () => {
  mockHttp(() => businessError('NOT_FOUND', 'Course not found'))
  await assert.rejects(API_COURSE.get('/courses/missing'), error => error instanceof ApiError && error.code === 'NOT_FOUND' && error.requestId === 'test-request' && error.message === 'Course not found')
})
test('does not accept malformed or ambiguous envelopes as success', () => {
  for (const body of [null, '<html>Error</html>', {}, { message: 'error' }, { error: {} }, { error: null, data: {} }]) assert.throws(() => parseEnvelope(body), ApiError)
  assert.throws(() => parseEnvelope({ data: {}, error: { code: 'FORBIDDEN', message: 'No' } }), /No/)
})
test('normalizes base URLs without duplicating v1', () => {
  for (const input of ['https://example.invalid/dev', 'https://example.invalid/dev/v1', ' https://example.invalid/dev/v1/// ']) assert.equal(versionedBase(input), 'https://example.invalid/dev/v1')
  assert.throws(() => versionedBase(undefined), /configurar/)
})
test('public login sends neither opaque token nor tenant header', async () => {
  session.save('opaque-test-session', 100)
  const calls = mockHttp(() => success({ accessToken: 'opaque', expiresIn: 28800 }))
  await AuthService.login({ email: 'user@example.test', password: 'test-only' })
  assert.equal(calls[0].headers.get('Authorization'), undefined)
  assert.equal(calls[0].headers.get('X-Tenant-Id'), undefined)
  assert.equal(calls[0].url, '/auth/login')
})
test('authenticated requests send exactly one Bearer header and support AbortSignal', async () => {
  session.save('opaque.not-a-jwt', 100)
  const calls = mockHttp(() => success({ userId: 'student' }))
  const controller = new AbortController()
  await API_USER.get('/me', { signal: controller.signal })
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer opaque.not-a-jwt')
  assert.equal(calls[0].headers.get('X-Tenant-Id'), undefined)
  assert.equal(calls[0].signal.aborted, false)
  controller.abort()
  await assert.rejects(API_USER.get('/me', { signal: controller.signal }))
})
for (const status of [401, 403]) test('HTTP ' + status + ' clears the session and aborts private work', async () => {
  session.save('opaque-test', 100)
  const previous = session.signal()
  mockHttp(() => ({ status, data: { message: 'Not authorized' } }))
  await assert.rejects(API_USER.get('/me'), error => error.code === 'SESSION_EXPIRED' && error.status === status)
  assert.equal(session.token(), '')
  assert.equal(previous.aborted, true)
})
test('business FORBIDDEN does not log out a valid session', async () => {
  session.save('opaque-test', 100)
  mockHttp(() => businessError('FORBIDDEN'))
  await assert.rejects(API_COURSE.patch('/courses/other', { title: 'Title' }), error => error.code === 'FORBIDDEN')
  assert.equal(session.token(), 'opaque-test')
})
test('network failures are typed and not logged with credentials', async () => {
  mockHttp(config => { throw Object.assign(new Error('network'), { isAxiosError: true, config }) })
  await assert.rejects(new ApiClient('https://test.invalid').get('/me'), error => error.code === 'NETWORK_ERROR')
})
test('course detail uses GET and cursor is passed untouched', async () => {
  const calls = mockHttp(() => success({ items: [], nextToken: null }))
  await CourseService.courseFindId('course/id')
  await CourseService.courseList({ teacherId: 'teacher', nextToken: 'opaque+/cursor==', limit: 20 })
  assert.equal(calls[0].method, 'get')
  assert.equal(calls[0].url, '/courses/course%2Fid')
  assert.equal(calls[1].params.nextToken, 'opaque+/cursor==')
  assert.equal(calls[1].params.teacherId, 'teacher')
})
test('logout clears local authentication even when revocation cannot reach the server', async () => {
  session.save('opaque-test', 100)
  mockHttp(() => { throw new Error('offline') })
  await assert.rejects(AuthService.endSession())
  assert.equal(session.token(), '')
})
test('late private responses cannot enter a replacement user session', async () => {
  session.save('first-session', 100)
  let release
  mockHttp(() => new Promise(resolve => { release = resolve }))
  const request = API_USER.get('/me')
  await new Promise(resolve => setImmediate(resolve))
  session.save('second-session', 100)
  release(success({ userId: 'first-user' }))
  await assert.rejects(request)
  assert.equal(session.token(), 'second-session')
})
