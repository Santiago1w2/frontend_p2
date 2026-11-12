import './setup.mjs'
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AuthContext } from '../src/context/AuthContext.ts'
import { queryCache } from '../src/lib/queryCache.ts'
import DashboardPage from '../src/features/dashboard/DashboardPage.tsx'
import CourseDetail from '../src/features/courses/CourseDetail.tsx'
import CourseForm from '../src/features/courses/CourseForm.tsx'
import EvaluationDetail from '../src/features/evaluations/EvaluationDetail.tsx'

const student = { userId: 'student', tenantId: 'tenant', email: 'student@example.test', role: 'student', status: 'active' }
const teacher = { ...student, userId: 'teacher', role: 'teacher' }
const admin = { ...student, userId: 'admin', role: 'tenant_admin' }
const course = { courseId: 'course', teacherId: 'teacher', tenantId: 'tenant', title: 'Course from API', description: 'A record supplied by the fixture contract', status: 'published', createdAt: '2026-11-10T10:00:00Z' }
const evaluation = { evaluationId: 'evaluation', courseId: 'course', teacherId: 'teacher', title: 'Questions from API', questions: [{ questionId: 'Q1', text: 'Read this question', options: ['First', 'Second'] }], status: 'published', createdAt: course.createdAt }
beforeEach(() => queryCache.clear())
function seed(user, name, data, ...rest) { queryCache.update([user.tenantId, user.userId, name, ...rest], () => data) }
function render(user, component, props) { return renderToStaticMarkup(createElement(AuthContext.Provider, { value: { user, checking: false, busy: false, error: null } }, createElement(component, props))) }
test('student evaluation identifies local ungraded practice and never renders submission', () => {
  seed(student, 'evaluation', evaluation, 'evaluation')
  const html = render(student, EvaluationDetail, { evaluationId: 'evaluation' })
  assert.ok(html.includes('No evaluada'))
  assert.ok(html.includes('no se generan calificaciones'))
  assert.ok(!html.includes('Enviar evaluación'))
  assert.ok(!html.includes('Editar evaluación'))
  assert.ok(!html.includes('Correcta'))
})
test('student course detail checks membership before revealing materials', () => {
  seed(student, 'course', course, 'course')
  seed(student, 'membership', false, 'course')
  const html = render(student, CourseDetail, { courseId: 'course', section: 'materials' })
  assert.ok(html.includes('Matricularme'))
  assert.ok(html.includes('estudiantes matriculados'))
  assert.ok(!html.includes('Subir material'))
  assert.ok(!html.includes('Biblioteca del curso'))
})
test('draft course is not presented as an available student course', () => {
  seed(student, 'course', { ...course, status: 'draft' }, 'course')
  const html = render(student, CourseDetail, { courseId: 'course' })
  assert.ok(html.includes('en preparación'))
  assert.ok(!html.includes('Matricularme'))
})
test('teacher cannot render the edit form of another course author', () => {
  seed(teacher, 'course', { ...course, teacherId: 'another-author' }, 'course')
  const html = render(teacher, CourseForm, { courseId: 'course' })
  assert.ok(html.includes('Solo puedes editar tus propios cursos'))
  assert.ok(!html.includes('Guardar cambios'))
})
for (const user of [teacher, admin]) test(user.role + ' dashboard renders API courses without fabricated global metrics', () => {
  seed(user, 'courses', { items: [course], nextToken: null, cursors: [] }, user.role === 'teacher' ? 'mine' : 'all')
  seed(user, 'materials', { items: [] }, 'course')
  seed(user, 'evaluations', { items: [evaluation] }, 'course')
  const html = render(user, DashboardPage)
  assert.ok(html.includes(course.title))
  assert.ok(html.includes('class="hero-course tone-'))
  assert.ok(html.includes('/app/courses/' + course.courseId))
  assert.ok(!html.includes('FOLIO'))
  assert.ok(html.includes('registros cargados'))
  for (const fakeMetric of ['Total de estudiantes', 'Tasa de aprobación', 'Racha de estudio', '100% completado']) assert.ok(!html.includes(fakeMetric))
})
