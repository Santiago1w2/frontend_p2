import { createServer } from 'node:http'
import { after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiClient } from '../src/api/api.ts'
import { session } from '../src/lib/session.ts'

const requests = []
let handler = () => ({ status: 200, body: { data: {}, requestId: 'local-http-request' } })
const server = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const record = { method: request.method, url: request.url, headers: request.headers, body: Buffer.concat(chunks).toString() }
  requests.push(record)
  const result = await handler(record)
  if (!response.destroyed) response.writeHead(result.status, { 'Content-Type': 'application/json' }).end(JSON.stringify(result.body))
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const client = new ApiClient('http://127.0.0.1:' + server.address().port + '/dev')
after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) })
beforeEach(() => { requests.length = 0; session.save('opaque-local-test', 100) })

test('real Axios transport uses exactly one v1 and correctly encodes opaque cursors', async () => {
  handler = () => ({ status: 200, body: { data: { items: [], nextToken: null }, requestId: 'local-http-request' } })
  const result = await client.get('/courses', { params: { nextToken: 'opaque+/==', teacherId: 'teacher' } })
  const url = new URL(requests[0].url, 'http://localhost')
  assert.equal(url.pathname, '/dev/v1/courses')
  assert.equal(url.searchParams.get('nextToken'), 'opaque+/==')
  assert.equal(requests[0].headers.authorization, 'Bearer opaque-local-test')
  assert.equal(requests[0].headers['x-tenant-id'], undefined)
  assert.deepEqual(result, { items: [], nextToken: null })
})
test('real HTTP 200 conflict is never mistaken for enrollment success', async () => {
  handler = () => ({ status: 200, body: { error: { code: 'CONFLICT', message: 'Already enrolled' }, requestId: 'local-conflict' } })
  await assert.rejects(client.post('/enrollments', { courseId: 'course' }), error => error.code === 'CONFLICT' && error.requestId === 'local-conflict')
  assert.equal(requests[0].headers['content-type'], 'application/json')
  assert.deepEqual(JSON.parse(requests[0].body), { courseId: 'course' })
})
test('real HTTP 403 emits expiration and clears the opaque session', async () => {
  handler = () => ({ status: 403, body: { message: 'Expired local fixture' } })
  let reason
  const unsubscribe = session.subscribe(value => { reason = value })
  await assert.rejects(client.get('/me'), error => error.code === 'SESSION_EXPIRED')
  unsubscribe()
  assert.equal(reason, 'expired')
  assert.equal(session.token(), '')
})
test('real HTTP 502 is handled separately from a business envelope', async () => {
  handler = () => ({ status: 502, body: { message: 'Upstream fixture failure' } })
  await assert.rejects(client.get('/courses'), error => error.code === 'HTTP_ERROR' && error.status === 502)
  assert.equal(session.token(), 'opaque-local-test')
})
