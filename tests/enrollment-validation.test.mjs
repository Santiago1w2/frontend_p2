import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enrollmentIdError, validateEnrollment } from '../src/lib/validation.ts'

test('an email pasted as a student ID is rejected before enrollment', () => {
  const errors = validateEnrollment({ courseId: 'CRS-C-698A97CA', studentId: 'student04161@tenant-a.edu' })
  assert.equal(errors.courseId, undefined)
  assert.match(errors.studentId, /no un correo electrónico/)
})

test('DynamoDB sort keys and swapped identifiers are rejected as form input', () => {
  assert.ok(enrollmentIdError('USER#USR-C-00201', 'studentId'))
  assert.ok(enrollmentIdError('COURSE#CRS-C-698A97CA', 'courseId'))
  assert.ok(enrollmentIdError('CRS-C-698A97CA', 'studentId'))
  assert.ok(enrollmentIdError('USR-C-00201', 'courseId'))
})

test('seeded and newly generated IDs are accepted with surrounding spaces', () => {
  for (const studentId of ['USR-C-00201', 'USR-C-ABC12345']) {
    assert.deepEqual(validateEnrollment({ courseId: ' CRS-C-698A97CA ', studentId: ' ' + studentId + ' ' }), {})
  }
})

test('empty values and bare prefixes require a complete ID', () => {
  for (const [field, values] of [['courseId', ['', '  ', 'CRS-']], ['studentId', ['', '  ', 'USR-']]]) {
    for (const value of values) assert.ok(enrollmentIdError(value, field))
  }
})
