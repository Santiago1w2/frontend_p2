import './setup.mjs'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { validateEvaluation } from '../src/lib/validation.ts'
import { canManage, canCreate, hasRole } from '../src/lib/permissions.ts'
import { queryCache } from '../src/lib/queryCache.ts'
import { mergePage } from '../src/hooks/useQuery.ts'
import { AuthContext } from '../src/context/AuthContext.ts'
import { RoleGuard, ProtectedRoute } from '../src/components/shared/Guards.tsx'
const student = { userId: 'student', tenantId: 'tenant', email: 'student@example.test', role: 'student', status: 'active' }
const teacher = { ...student, userId: 'teacher', role: 'teacher' }
const admin = { ...student, userId: 'admin', role: 'tenant_admin' }
const valid = { courseId: 'course', title: 'Evaluation', questions: Array.from({ length: 3 }, (_, index) => ({ questionId: 'Q' + index, text: 'Question', options: ['First', 'Second'], correctIndex: 0 })) }
beforeEach(() => queryCache.clear())
test('role permissions restrict teachers to owned resources and prohibit student writes', () => {
  assert.equal(canManage(student, 'student'), false)
  assert.equal(canCreate(student), false)
  assert.equal(canManage(teacher, 'teacher'), true)
  assert.equal(canManage(teacher, 'another'), false)
  assert.equal(canManage(admin, 'another'), true)
  assert.equal(hasRole('student', ['teacher', 'tenant_admin']), false)
})
test('RoleGuard renders no administrative action for students', () => {
  const html = renderToStaticMarkup(createElement(AuthContext.Provider, { value: { user: student } }, createElement(RoleGuard, { roles: ['tenant_admin'] }, createElement('button', null, 'Create user'))))
  assert.ok(!html.includes('Create user'))
  assert.ok(html.includes('permiso'))
})
test('RoleGuard allows administrators and ProtectedRoute hides unauthenticated content', () => {
  const allowed = renderToStaticMarkup(createElement(AuthContext.Provider, { value: { user: admin } }, createElement(RoleGuard, { roles: ['tenant_admin'] }, 'Private control')))
  assert.equal(allowed, 'Private control')
  const hidden = renderToStaticMarkup(createElement(AuthContext.Provider, { value: { user: null, checking: false, error: null } }, createElement(ProtectedRoute, null, 'Secret content')))
  assert.ok(!hidden.includes('Secret content'))
})
test('a valid published evaluation passes every rule', () => assert.deepEqual(validateEvaluation(valid, 'published'), {}))
test('drafts can be saved incomplete but still require a title', () => {
  assert.deepEqual(validateEvaluation({ ...valid, questions: [] }, 'draft'), {})
  assert.ok(validateEvaluation({ ...valid, title: ' ' }, 'draft').title)
})
test('publication validates question count, text, options and correctIndex inline', () => {
  const invalid = { ...valid, questions: [{ questionId: 'Q1', text: ' ', options: [''], correctIndex: 2 }] }
  const errors = validateEvaluation(invalid, 'published')
  for (const key of ['questions', 'questions.0.text', 'questions.0.options', 'questions.0.options.0', 'questions.0.correctIndex']) assert.ok(errors[key], key)
})
test('missing, fractional and negative correctIndex never invent an answer', () => {
  for (const correctIndex of [undefined, -1, 0.5, 2]) {
    const input = { ...valid, questions: valid.questions.map(question => ({ ...question, correctIndex })) }
    assert.ok(validateEvaluation(input, 'published')['questions.0.correctIndex'])
  }
})
test('invalid deadlines and duplicate question identifiers are rejected', () => {
  assert.ok(validateEvaluation({ ...valid, fechaLimite: 'not-a-date' }, 'published').fechaLimite)
  assert.ok(validateEvaluation({ ...valid, questions: valid.questions.map(question => ({ ...question, questionId: 'duplicate' })) }, 'published').questions)
})
test('nextToken pagination keeps earlier pages and deduplicates repeated rows', () => {
  const result = mergePage({ items: [{ id: 1 }], nextToken: 'opaque+/==', cursors: [] }, { items: [{ id: 1 }, { id: 2 }], nextToken: null }, 'opaque+/==')
  assert.deepEqual(result.items, [{ id: 1 }, { id: 2 }])
  assert.equal(result.nextToken, null)
})
test('empty pages do not imply end of pagination and cursor loops are detected', () => {
  const result = mergePage({ items: [], nextToken: 'first', cursors: [] }, { items: [], nextToken: 'second' }, 'first')
  assert.equal(result.nextToken, 'second')
  assert.throws(() => mergePage(result, { items: [], nextToken: 'first' }, 'second'), /cursor/)
})
test('pagination replaces updated records by stable entity ID', () => {
  const result = mergePage({ items: [{ enrollmentId: 'one', status: 'pending' }], nextToken: 'cursor', cursors: [] }, { items: [{ enrollmentId: 'one', status: 'active' }], nextToken: null }, 'cursor')
  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].status, 'active')
})
test('cache deduplicates concurrent requests and scopes users and tenants separately', async () => {
  let calls = 0
  const entry = queryCache.entry(['tenant-a', 'user-a', 'courses'])
  const loader = async () => { calls++; return { private: 'a' } }
  await Promise.all([queryCache.load(entry, loader), queryCache.load(entry, loader)])
  assert.equal(calls, 1)
  assert.equal(queryCache.entry(['tenant-b', 'user-a', 'courses']).snapshot.data, undefined)
  assert.equal(queryCache.entry(['tenant-a', 'user-b', 'courses']).snapshot.data, undefined)
  queryCache.clear()
  assert.equal(queryCache.entry(['tenant-a', 'user-a', 'courses']).snapshot.data, undefined)
})
test('cache invalidation prevents a late stale response from replacing fresh data', async () => {
  const entry = queryCache.entry(['tenant', 'user', 'course'])
  let release
  const first = queryCache.load(entry, () => new Promise(resolve => { release = resolve }))
  queryCache.invalidate(['tenant', 'user', 'course'])
  await queryCache.load(entry, async () => 'new')
  release('old')
  await first
  assert.equal(entry.snapshot.data, 'new')
})
