import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { mockHttp, success, businessError } from './setup.mjs'
import { ApiError } from '../src/api/errors.ts'
import { normalizeEvaluation, evaluationFind, evaluationResult, evaluationResultOrNull, submitQuizSafely } from '../src/services/EvaluationService.ts'
import { acceptsSubmission, quizAnswers } from '../src/lib/evaluations.ts'
import { session } from '../src/lib/session.ts'
import { enrollmentList } from '../src/services/EnrollmentService.ts'

const questions = [
  { questionId: 'last-alphabetically', text: 'First', options: ['A', 'B'] },
  { questionId: 'first-alphabetically', text: 'Second', options: ['C', 'D', 'E'] },
  { questionId: 'middle', text: 'Third', options: ['F', 'G'] },
]
const evaluation = { evaluationId: 'EVL-test', courseId: 'CRS-test', questions, status: 'published' }
const saved = { evaluationId: 'EVL-test', studentId: 'USR-test', tenantId: 'tenant', answers: [1, 2, 0], score: 66.67, correctAnswers: 2, totalQuestions: 3, submittedAt: '2026-11-21T15:00:00Z' }
beforeEach(() => { session.clear(); mockHttp(() => { throw new Error('Unexpected call') }) })

test('quiz serializes answers in backend question order, including zero', () => {
  assert.deepEqual(quizAnswers(questions, { middle: 0, 'first-alphabetically': 2, 'last-alphabetically': 1 }), [1, 2, 0])
})
test('quiz refuses empty, missing, fractional, negative, boolean and out-of-range answers', () => {
  for (const invalid of [undefined, -1, 0.5, true, false, 2]) {
    assert.throws(() => quizAnswers(questions, { middle: 0, 'first-alphabetically': 2, 'last-alphabetically': invalid }), error => error.code === 'SUBMISSION_INCOMPLETE')
  }
  assert.throws(() => quizAnswers([], {}), error => error.code === 'SUBMISSION_INCOMPLETE')
})
test('frontend deadline guard follows the evaluation state and an explicit UTC instant', () => {
  const deadline = '2026-11-21T20:00:00Z'
  assert.equal(acceptsSubmission({ ...evaluation, fechaLimite: deadline }, Date.parse(deadline) - 1), true)
  assert.equal(acceptsSubmission({ ...evaluation, fechaLimite: deadline }, Date.parse(deadline) + 1), false)
  for (const status of ['draft', 'closed']) assert.equal(acceptsSubmission({ ...evaluation, status }, 0), false)
  assert.equal(acceptsSubmission(evaluation, Date.parse(deadline)), true)
})
test('legacy question identities remain independent, stable and collision-free without changing order', () => {
  const legacy = { ...evaluation, questions: [{ text: 'One', options: [] }, { questionId: 'same', text: 'Two', options: [] }, { questionId: 'same', text: 'Three', options: [] }, { questionId: 'legacy-question-0', text: 'Four', options: [] }] }
  const normalized = normalizeEvaluation(legacy)
  assert.equal(new Set(normalized.questions.map(question => question.questionId)).size, 4)
  assert.deepEqual(normalized.questions.map(question => question.text), ['One', 'Two', 'Three', 'Four'])
  assert.deepEqual(normalized, normalizeEvaluation(legacy))
  assert.equal(legacy.questions[0].questionId, undefined)
  assert.equal(normalized.questions[1].questionId, 'same')
})
test('evaluation detail normalizes missing IDs supplied by the real API contract', async () => {
  mockHttp(() => success({ ...evaluation, questions: [{ text: 'Legacy', options: ['A', 'B'] }] }))
  assert.ok((await evaluationFind('EVL-test')).questions[0].questionId)
})
test('result lookup encodes IDs, sends studentId only when requested, and supports cancellation', async () => {
  session.save('opaque-test', 100)
  const calls = mockHttp(() => success(saved))
  const controller = new AbortController()
  await evaluationResult('EVL/id', undefined, controller.signal)
  await evaluationResult('EVL/id', 'USR/another')
  assert.equal(calls[0].url, '/evaluations/EVL%2Fid/result')
  assert.equal(calls[0].params, undefined)
  assert.equal(calls[0].headers.get('Authorization'), 'Bearer opaque-test')
  assert.deepEqual(calls[1].params, { studentId: 'USR/another' })
  assert.equal(calls[0].signal.aborted, false)
})
test('only business NOT_FOUND represents no previous result; errors never become a zero grade', async () => {
  mockHttp(() => businessError('NOT_FOUND'))
  assert.equal(await evaluationResultOrNull('EVL-test'), null)
  for (const code of ['FORBIDDEN', 'INTERNAL_ERROR']) {
    mockHttp(() => businessError(code))
    await assert.rejects(evaluationResultOrNull('EVL-test'), error => error.code === code)
  }
})
test('an existing result prevents any POST even if local selections differ', async () => {
  const calls = mockHttp(() => success(saved))
  assert.deepEqual(await submitQuizSafely('EVL-test', { answers: [0, 0, 0] }), saved)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].method, 'get')
})
test('first submission sends only the ordered answer array and trusts the server score', async () => {
  const summary = { evaluationId: saved.evaluationId, score: saved.score, correctAnswers: saved.correctAnswers, totalQuestions: saved.totalQuestions, submittedAt: saved.submittedAt }
  const calls = mockHttp(config => config.method === 'get' ? businessError('NOT_FOUND') : success(summary))
  assert.deepEqual(await submitQuizSafely('EVL-test', { answers: [1, 2, 0] }), summary)
  assert.deepEqual(calls.map(call => [call.method, call.url]), [['get', '/evaluations/EVL-test/result'], ['post', '/evaluations/EVL-test/submit']])
  assert.deepEqual(JSON.parse(calls[1].data), { answers: [1, 2, 0] })
})
for (const code of ['CONFLICT', 'TIMEOUT', 'NETWORK_ERROR', 'HTTP_ERROR', 'INTERNAL_ERROR']) test('recovers a saved grade after ' + code + ' without repeating the POST', async () => {
  const calls = mockHttp((config, count) => {
    if (count === 1) return businessError('NOT_FOUND')
    if (config.method === 'post') throw new ApiError(code, 'Lost response', 'submission-request')
    return success(saved)
  })
  assert.deepEqual(await submitQuizSafely('EVL-test', { answers: [0, 0, 0] }), saved)
  assert.equal(calls.filter(call => call.method === 'post').length, 1)
  assert.equal(calls.filter(call => call.method === 'get').length, 2)
})
test('an unconfirmed submission reports uncertainty and performs no automatic retry', async () => {
  const calls = mockHttp(config => {
    if (config.method === 'post') throw new ApiError('TIMEOUT', 'Unknown outcome', 'unknown-request')
    return businessError('NOT_FOUND')
  })
  await assert.rejects(submitQuizSafely('EVL-test', { answers: [0, 0, 0] }), error => error.code === 'SUBMISSION_UNCERTAIN' && error.requestId === 'unknown-request')
  assert.equal(calls.length, 3)
  assert.equal(calls.filter(call => call.method === 'post').length, 1)
})
test('a failed preflight lookup blocks submission; validation errors are not hidden by recovery', async () => {
  const blocked = mockHttp(() => businessError('INTERNAL_ERROR'))
  await assert.rejects(submitQuizSafely('EVL-test', { answers: [] }), error => error.code === 'INTERNAL_ERROR')
  assert.equal(blocked.length, 1)
  const invalid = mockHttp(config => businessError(config.method === 'get' ? 'NOT_FOUND' : 'INVALID_BODY'))
  await assert.rejects(submitQuizSafely('EVL-test', { answers: [] }), error => error.code === 'INVALID_BODY')
  assert.equal(invalid.length, 2)
})
test('aborted result lookup cannot trigger a submission in a replacement session', async () => {
  const controller = new AbortController()
  controller.abort()
  const calls = mockHttp(() => success(saved))
  await assert.rejects(submitQuizSafely('EVL-test', { answers: [0, 0, 0] }, controller.signal))
  assert.equal(calls.length, 0)
})
test('combined enrollment filters discard other students and preserve the backend cursor', async () => {
  mockHttp(() => success({ items: [{ courseId: 'CRS-test', studentId: 'USR-other' }, { courseId: 'CRS-test', studentId: 'USR-test' }], nextToken: 'opaque+/==' }))
  const page = await enrollmentList({ courseId: 'CRS-test', studentId: 'USR-test' })
  assert.deepEqual(page.items, [{ courseId: 'CRS-test', studentId: 'USR-test' }])
  assert.equal(page.nextToken, 'opaque+/==')
})
