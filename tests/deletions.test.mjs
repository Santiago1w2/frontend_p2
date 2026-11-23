import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { mockHttp, success, businessError } from './setup.mjs'
import { session } from '../src/lib/session.ts'
import { userDelete } from '../src/services/AuthService.ts'
import { courseDelete } from '../src/services/CourseService.ts'
import { enrollmentDelete } from '../src/services/EnrollmentService.ts'
import { materialDelete } from '../src/services/MaterialService.ts'
import { evaluationDelete } from '../src/services/EvaluationService.ts'
import { canManage, canDeleteUser, canDeleteEvaluation } from '../src/lib/permissions.ts'
import { queryCache } from '../src/lib/queryCache.ts'
import { confirmDeleted, clearDeletedUser, clearDeletedCourse, clearDeletedEnrollment, clearDeletedMaterial, clearDeletedEvaluation } from '../src/lib/deletions.ts'

beforeEach(() => { queryCache.clear(); session.clear(); mockHttp(() => { throw new Error('Unexpected call') }) })
for (const [label, remove, path, params] of [
  ['user', () => userDelete('USR/id'), '/users/USR%2Fid', undefined],
  ['course', () => courseDelete('CRS/id'), '/courses/CRS%2Fid', undefined],
  ['enrollment', () => enrollmentDelete({ courseId: 'CRS/id', studentId: 'USR/id' }), '/enrollments', { courseId: 'CRS/id', studentId: 'USR/id' }],
  ['material', () => materialDelete('CNT/id'), '/materials/CNT%2Fid', undefined],
  ['evaluation', () => evaluationDelete('EVL/id'), '/evaluations/EVL%2Fid', undefined],
]) test(label + ' deletion uses DELETE, encoded path/query, Bearer and no request body', async () => {
  session.save('opaque-delete-test', 100)
  const calls = mockHttp(() => success({ deleted: true }))
  confirmDeleted(await remove())
  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, 'delete')
  assert.equal(calls[0].url, path)
  assert.deepEqual(calls[0].params, params)
  assert.equal(calls[0].data, undefined)
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer opaque-delete-test')
})
for (const code of ['FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'INTERNAL_ERROR']) test('DELETE business ' + code + ' is not treated as success and is never retried automatically', async () => {
  const calls = mockHttp(() => businessError(code))
  await assert.rejects(evaluationDelete('EVL-test'), error => error.code === code)
  assert.equal(calls.length, 1)
})
test('a delete needs an explicit deleted=true acknowledgement', () => {
  confirmDeleted({ deleted: true, contentId: 'CNT-test' })
  for (const value of [null, undefined, {}, { deleted: false }, { deleted: 'true' }, { data: { deleted: true } }]) assert.throws(() => confirmDeleted(value), error => error.code === 'INVALID_RESPONSE')
})
test('deletion permission rules follow admin self-protection and teacher ownership/draft rules', () => {
  const admin = { role: 'tenant_admin', userId: 'admin' }
  const teacher = { role: 'teacher', userId: 'teacher' }
  const student = { role: 'student', userId: 'student' }
  assert.equal(canDeleteUser(admin, 'admin'), false)
  assert.equal(canDeleteUser(admin, 'student'), true)
  assert.equal(canDeleteUser(teacher, 'student'), false)
  assert.equal(canManage(teacher, 'teacher'), true)
  assert.equal(canManage(teacher, 'other-uploader'), false)
  assert.equal(canManage(student, 'student'), false)
  for (const status of ['draft', 'published', 'closed']) {
    assert.equal(canDeleteEvaluation(admin, { teacherId: 'other', status }), true)
    assert.equal(canDeleteEvaluation(teacher, { teacherId: 'teacher', status }), status === 'draft')
    assert.equal(canDeleteEvaluation(teacher, { teacherId: 'other', status }), false)
    assert.equal(canDeleteEvaluation(student, { teacherId: 'student', status }), false)
  }
})
test('deletion cache resets clear lists, detail, exact searches and derived memberships without crossing scopes', () => {
  const scope = ['tenant', 'admin']
  const keys = [
    ['users', 'all'], ['users', 'exact', 'USR'], ['user', 'USR'],
    ['courses', 'all'], ['courses', 'exact', false, 'CRS'], ['course', 'CRS'],
    ['enrolled-courses', ['CRS']], ['membership', 'CRS'], ['enrollments', 'mine'],
    ['materials', 'CRS'], ['evaluations', 'CRS'], ['evaluation', 'EVL'], ['evaluation-result', 'EVL', 'USR'],
  ]
  for (const key of keys) queryCache.update([...scope, ...key], () => ({ stale: true }))
  queryCache.update(['tenant', 'other-user', 'courses', 'all'], () => ({ untouched: true }))
  queryCache.update([...scope, 'materials', 'OTHER-COURSE'], () => ({ untouched: true }))
  clearDeletedUser(scope, 'USR')
  clearDeletedCourse(scope, 'CRS')
  clearDeletedEnrollment(scope, 'CRS')
  clearDeletedMaterial(scope, 'CRS')
  clearDeletedEvaluation(scope, 'CRS', 'EVL')
  for (const key of keys) assert.equal(queryCache.entry([...scope, ...key]).snapshot.data, undefined, JSON.stringify(key))
  assert.deepEqual(queryCache.entry(['tenant', 'other-user', 'courses', 'all']).snapshot.data, { untouched: true })
  assert.deepEqual(queryCache.entry([...scope, 'materials', 'OTHER-COURSE']).snapshot.data, { untouched: true })
})
test('course/user cache reset does not pretend that unrelated backend records were cascade-deleted', () => {
  const scope = ['tenant', 'admin']
  const enrollmentKey = [...scope, 'enrollments', { courseId: 'CRS' }]
  const resultKey = [...scope, 'evaluation-result', 'EVL', 'USR']
  queryCache.update(enrollmentKey, () => ({ items: [{ courseId: 'CRS', studentId: 'USR' }] }))
  queryCache.update(resultKey, () => ({ score: 100 }))
  clearDeletedCourse(scope, 'CRS')
  clearDeletedUser(scope, 'USR')
  assert.equal(queryCache.entry(enrollmentKey).snapshot.data.items.length, 1)
  assert.equal(queryCache.entry(resultKey).snapshot.data.score, 100)
})
test('a reset after deletion prevents a late response from restoring a deleted cached record', async () => {
  const key = ['tenant', 'admin', 'materials', 'CRS']
  const entry = queryCache.entry(key)
  let release, signal
  const pending = queryCache.load(entry, current => { signal = current; return new Promise(resolve => { release = resolve }) })
  clearDeletedMaterial(['tenant', 'admin'], 'CRS')
  assert.equal(signal.aborted, true)
  await queryCache.load(entry, async () => ({ items: [] }))
  release({ items: [{ contentId: 'deleted-material' }] })
  await pending
  assert.deepEqual(entry.snapshot.data.items, [])
})
