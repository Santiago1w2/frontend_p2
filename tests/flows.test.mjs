import { mockHttp, success, businessError } from './setup.mjs'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { enrollmentCreate, enrollmentList, isEnrolled } from '../src/services/EnrollmentService.ts'
import { uploadMaterial, putToS3, materialDownload } from '../src/services/MaterialService.ts'
import { session } from '../src/lib/session.ts'

class MockXHR {
  static calls = []
  static statuses = []
  upload = {}
  headers = {}
  status = 200
  aborted = false
  open(method, url) { this.method = method; this.url = url; MockXHR.calls.push(this) }
  setRequestHeader(name, value) { this.headers[name] = value }
  send(body) {
    this.body = body
    this.status = MockXHR.statuses.shift() ?? 200
    queueMicrotask(() => { if (!this.aborted) { this.upload.onprogress?.({ lengthComputable: true, loaded: body.size, total: body.size }); this.onload?.() } })
  }
  abort() { this.aborted = true; this.onabort?.() }
}
beforeEach(() => {
  session.clear()
  session.save('opaque-test-token', 100)
  MockXHR.calls = []
  MockXHR.statuses = []
  globalThis.XMLHttpRequest = MockXHR
})
const file = new File(['sample pdf bytes'], 'notes.pdf', { type: 'application/pdf' })
const input = { courseId: 'course', title: 'Notes', file, mimeType: 'application/pdf' }
test('enrollment list never requests without a course or student filter', () => {
  const calls = mockHttp(() => success({ items: [], nextToken: null }))
  assert.throws(() => enrollmentList({}), /Selecciona/)
  assert.equal(calls.length, 0)
})
test('student enrollment sends only courseId and completes synchronously', async () => {
  const calls = mockHttp(() => success({ enrollmentId: 'enrollment', courseId: 'course', studentId: 'student', status: 'active' }))
  const result = await enrollmentCreate({ courseId: 'course' })
  assert.deepEqual(JSON.parse(calls[0].data), { courseId: 'course' })
  assert.equal(result.status, 'active')
  assert.equal(calls.length, 1)
})
test('admin enrollment sends studentId and duplicate conflicts remain business errors', async () => {
  const calls = mockHttp(() => businessError('CONFLICT', 'Student is already enrolled'))
  await assert.rejects(enrollmentCreate({ courseId: 'course', studentId: 'student' }), error => error.code === 'CONFLICT')
  assert.deepEqual(JSON.parse(calls[0].data), { courseId: 'course', studentId: 'student' })
  assert.equal(calls.length, 1)
})
for (const code of ['NOT_FOUND', 'FORBIDDEN', 'INTERNAL_ERROR']) test('enrollment handles ' + code + ' without a fabricated success', async () => {
  mockHttp(() => businessError(code))
  await assert.rejects(enrollmentCreate({ courseId: 'course' }), error => error.code === code)
})
test('membership follows opaque nextToken through empty pages and ignores other students', async () => {
  const calls = mockHttp((_config, count) => success(count === 1 ? { items: [{ courseId: 'course', studentId: 'someone-else', status: 'active' }], nextToken: 'opaque+/=' } : { items: [{ courseId: 'course', studentId: 'student', status: 'active' }], nextToken: null }))
  assert.equal(await isEnrolled('course', 'student'), true)
  assert.equal(calls[1].params.nextToken, 'opaque+/=')
})
test('membership detects cyclic pagination rather than requesting forever', async () => {
  mockHttp(() => success({ items: [], nextToken: 'repeat' }))
  await assert.rejects(isEnrolled('course', 'student'), /cursor/)
})
test('S3 upload registers, signs, PUTs exact MIME without Bearer, then confirms', async () => {
  const calls = mockHttp(config => success(config.url === '/materials' ? { contentId: 'content', uploadStatus: 'pending' } : config.url.endsWith('/upload-url') ? { uploadUrl: 'https://s3.test.invalid/signed', expiresIn: 300 } : { contentId: 'content', uploadStatus: 'confirmed' }))
  const task = { uploaded: false }
  const phases = []
  const progress = []
  const result = await uploadMaterial(input, task, phase => phases.push(phase), value => progress.push(value))
  assert.deepEqual(calls.map(call => call.url), ['/materials', '/materials/content/upload-url', '/materials/content/confirm'])
  assert.deepEqual(phases, ['registering', 'signing', 'uploading', 'confirming', 'complete'])
  assert.equal(JSON.parse(calls[0].data).sizeBytes, file.size)
  assert.equal(MockXHR.calls[0].method, 'PUT')
  assert.deepEqual(MockXHR.calls[0].headers, { 'Content-Type': 'application/pdf' })
  assert.deepEqual(progress, [100])
  assert.equal(result.uploadStatus, 'confirmed')
})
test('expired S3 URL requests a fresh URL but never duplicates the material registration', async () => {
  const calls = mockHttp(config => success(config.url === '/materials' ? { contentId: 'content' } : config.url.endsWith('/upload-url') ? { uploadUrl: 'https://s3.test.invalid/fresh' } : { contentId: 'content', uploadStatus: 'confirmed' }))
  MockXHR.statuses = [403, 200]
  const task = { uploaded: false }
  await assert.rejects(uploadMaterial(input, task, () => {}, () => {}), error => error.code === 'UPLOAD_URL_EXPIRED')
  assert.equal(session.token(), 'opaque-test-token')
  await uploadMaterial(input, task, () => {}, () => {})
  assert.equal(calls.filter(call => call.url === '/materials').length, 1)
  assert.equal(calls.filter(call => call.url.endsWith('/upload-url')).length, 2)
  assert.equal(MockXHR.calls.length, 2)
})
test('a failed confirmation retries only confirmation, not registration or PUT', async () => {
  let confirmCalls = 0
  const calls = mockHttp(config => {
    if (config.url === '/materials') return success({ contentId: 'content' })
    if (config.url.endsWith('/upload-url')) return success({ uploadUrl: 'https://s3.test.invalid/signed' })
    confirmCalls++
    return confirmCalls === 1 ? businessError('BAD_REQUEST', 'File not found in S3') : success({ contentId: 'content', uploadStatus: 'confirmed' })
  })
  const task = { uploaded: false }
  await assert.rejects(uploadMaterial(input, task, () => {}, () => {}), error => error.code === 'BAD_REQUEST')
  assert.equal(task.uploaded, true)
  await uploadMaterial(input, task, () => {}, () => {})
  assert.equal(MockXHR.calls.length, 1)
  assert.equal(calls.filter(call => call.url === '/materials').length, 1)
  assert.equal(confirmCalls, 2)
})
test('a previously confirmed material conflict is safely reconfirmed', async () => {
  const calls = mockHttp(config => config.url.endsWith('/upload-url') ? businessError('CONFLICT') : success({ contentId: 'content', uploadStatus: 'confirmed' }))
  await uploadMaterial(input, { contentId: 'content', uploaded: false }, () => {}, () => {})
  assert.equal(MockXHR.calls.length, 0)
  assert.equal(calls.at(-1).url, '/materials/content/confirm')
})
test('aborted uploads do not confirm and can be retried', async () => {
  const controller = new AbortController()
  const request = putToS3('https://s3.test.invalid/signed', file, 'application/pdf', () => {}, controller.signal)
  controller.abort()
  await assert.rejects(request, error => error.name === 'AbortError')
  assert.equal(MockXHR.calls[0].aborted, true)
})
test('downloads request a new short-lived signed URL on every action', async () => {
  const calls = mockHttp((_config, count) => success({ downloadUrl: 'https://s3.test.invalid/url-' + count, expiresIn: 60 }))
  const first = await materialDownload('content')
  const second = await materialDownload('content')
  assert.notEqual(first.downloadUrl, second.downloadUrl)
  assert.equal(calls.length, 2)
})
