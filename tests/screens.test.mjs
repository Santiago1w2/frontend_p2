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
import CoursesPage from '../src/features/courses/CoursesPage.tsx'
import EvaluationDetail from '../src/features/evaluations/EvaluationDetail.tsx'
import { EvaluationResultLookup } from '../src/features/evaluations/EvaluationResults.tsx'
import { ApiError } from '../src/api/errors.ts'
import { UserDetail } from '../src/features/users/UsersPage.tsx'
import MaterialsPanel from '../src/features/materials/MaterialsPanel.tsx'

const student = { userId: 'student', tenantId: 'tenant', email: 'student@example.test', role: 'student', status: 'active' }
const teacher = { ...student, userId: 'teacher', role: 'teacher' }
const admin = { ...student, userId: 'admin', role: 'tenant_admin' }
const course = { courseId: 'course', teacherId: 'teacher', tenantId: 'tenant', title: 'Course from API', description: 'A record supplied by the fixture contract', status: 'published', createdAt: '2026-11-10T10:00:00Z' }
const evaluation = { evaluationId: 'evaluation', courseId: 'course', teacherId: 'teacher', title: 'Questions from API', questions: [{ questionId: 'Q1', text: 'Read this question', options: ['First', 'Second'] }], status: 'published', createdAt: course.createdAt }
beforeEach(() => queryCache.clear())
function seed(user, name, data, ...rest) { queryCache.update([user.tenantId, user.userId, name, ...rest], () => data) }
function render(user, component, props) { return renderToStaticMarkup(createElement(AuthContext.Provider, { value: { user, checking: false, busy: false, error: null } }, createElement(component, props))) }

test('user deletion is offered to admins for another account but never for their own account', () => {
  seed(admin, 'user', student, student.userId)
  assert.ok(render(admin, UserDetail, { userId: student.userId }).includes('Eliminar usuario'))
  seed(admin, 'user', admin, admin.userId)
  assert.ok(!render(admin, UserDetail, { userId: admin.userId }).includes('Eliminar usuario'))
  seed(teacher, 'user', student, student.userId)
  assert.ok(!render(teacher, UserDetail, { userId: student.userId }).includes('Eliminar usuario'))
})
test('material deletion follows uploadedBy even when course editing is unavailable', () => {
  const material = { contentId: 'material', courseId: 'course', uploadedBy: teacher.userId, title: 'Own upload', mimeType: 'text/plain', sizeBytes: 10, createdAt: course.createdAt }
  seed(teacher, 'materials', { items: [material, { ...material, contentId: 'other', uploadedBy: 'other-teacher' }] }, 'course')
  const html = render(teacher, MaterialsPanel, { courseId: 'course', editable: false })
  assert.equal((html.match(/Eliminar material/g) ?? []).length, 1)
  seed(student, 'materials', { items: [material] }, 'course')
  assert.ok(!render(student, MaterialsPanel, { courseId: 'course', editable: false }).includes('Eliminar material'))
})
test('teachers can delete only owned draft evaluations while admins can delete published evaluations', () => {
  for (const status of ['draft', 'published', 'closed']) {
    seed(teacher, 'evaluation', { ...evaluation, status }, 'evaluation')
    assert.equal(render(teacher, EvaluationDetail, { evaluationId: 'evaluation' }).includes('Eliminar evaluación'), status === 'draft')
  }
  seed(admin, 'evaluation', evaluation, 'evaluation')
  assert.ok(render(admin, EvaluationDetail, { evaluationId: 'evaluation' }).includes('Eliminar evaluación'))
})
test('course delete controls are hidden for students and other teachers', () => {
  seed(student, 'course', course, course.courseId)
  seed(student, 'membership', true, course.courseId)
  assert.ok(!render(student, CourseDetail, { courseId: course.courseId }).includes('Eliminar curso'))
  seed(teacher, 'course', { ...course, teacherId: 'other' }, course.courseId)
  assert.ok(!render(teacher, CourseDetail, { courseId: course.courseId }).includes('Eliminar curso'))
  seed(admin, 'course', course, course.courseId)
  assert.ok(render(admin, CourseDetail, { courseId: course.courseId }).includes('Eliminar curso'))
})
test('student evaluation offers a real submission without exposing correct answers', () => {
  seed(student, 'evaluation', evaluation, 'evaluation')
  seed(student, 'evaluation-result', null, 'evaluation', student.userId)
  const html = render(student, EvaluationDetail, { evaluationId: 'evaluation' })
  assert.ok(html.includes('Evaluación con calificación'))
  assert.ok(html.includes('Enviar evaluación'))
  assert.ok(html.includes('Enlace de mi calificación'))
  assert.ok(!html.includes('Editar evaluación'))
  assert.ok(!html.includes('Correcta'))
})
test('saved evaluation result shows the server score and disables another submission', () => {
  seed(student, 'evaluation', evaluation, 'evaluation')
  seed(student, 'evaluation-result', { evaluationId: 'evaluation', studentId: student.userId, tenantId: 'tenant', answers: [1], score: 0, correctAnswers: 0, totalQuestions: 1, submittedAt: course.createdAt }, 'evaluation', student.userId)
  const html = render(student, EvaluationDetail, { evaluationId: 'evaluation' })
  assert.ok(html.includes('Entrega registrada'))
  assert.ok(html.includes('0%'))
  assert.ok(!html.includes('Enviar evaluación'))
  assert.ok(html.includes('disabled=""'))
})
test('a result lookup failure blocks submission instead of assuming no prior attempt', () => {
  seed(student, 'evaluation', evaluation, 'evaluation')
  const html = render(student, EvaluationDetail, { evaluationId: 'evaluation' })
  assert.match(html, /disabled=""[^>]*>Enviar evaluación/)
})
test('an evaluation past its deadline disables student submission', () => {
  seed(student, 'evaluation', { ...evaluation, fechaLimite: '2000-01-01T00:00:00Z' }, 'evaluation')
  seed(student, 'evaluation-result', null, 'evaluation', student.userId)
  const html = render(student, EvaluationDetail, { evaluationId: 'evaluation' })
  assert.ok(html.includes('su fecha límite ya pasó'))
  assert.match(html, /disabled=""[^>]*>Enviar evaluación/)
})
test('student can read a saved result even if the closed evaluation detail is NOT_FOUND', () => {
  const entry = queryCache.entry([student.tenantId, student.userId, 'evaluation', 'evaluation'])
  entry.snapshot = { ...entry.snapshot, status: 'error', error: new ApiError('NOT_FOUND', 'Evaluation not found') }
  seed(student, 'evaluation-result', { evaluationId: 'evaluation', score: 100, correctAnswers: 1, totalQuestions: 1, submittedAt: course.createdAt }, 'evaluation', student.userId)
  const html = render(student, EvaluationDetail, { evaluationId: 'evaluation' })
  assert.ok(html.includes('100%'))
  assert.ok(!html.includes('Enviar evaluación'))
})
test('teacher result view refuses another author even if a result is in cache', () => {
  seed(teacher, 'evaluation', { ...evaluation, teacherId: 'another-teacher' }, 'evaluation')
  seed(teacher, 'evaluation-result', { evaluationId: 'evaluation', score: 100, correctAnswers: 1, totalQuestions: 1, submittedAt: course.createdAt }, 'evaluation', student.userId)
  const html = render(teacher, EvaluationResultLookup, { evaluationId: 'evaluation', studentId: student.userId })
  assert.ok(html.includes('otro responsable'))
  assert.ok(!html.includes('100%'))
})
test('missing result renders absence rather than a zero score', () => {
  seed(student, 'evaluation-result', null, 'evaluation', student.userId)
  const html = render(student, EvaluationResultLookup, { evaluationId: 'evaluation' })
  assert.ok(html.includes('Todavía no hay una entrega registrada'))
  assert.ok(!html.includes('quiz-score'))
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

test('student catalog keeps searching when a page has drafts but more courses exist', () => {
  seed(student, 'courses', { items: [{ ...course, status: 'draft' }], nextToken: 'later-page', cursors: [] }, 'all')
  seed(student, 'enrollments', { items: [], nextToken: null, cursors: [] }, 'mine')
  const html = render(student, CoursesPage)
  assert.ok(html.includes('Buscando cursos que coincidan'))
  assert.ok(html.includes('Cargando contenido'))
  assert.ok(!html.includes('Todavía no hay cursos visibles'))
  assert.ok(!html.includes(course.title))
})

test('student catalog shows an empty result only after the last nonpublished page', () => {
  seed(student, 'courses', { items: [{ ...course, status: 'draft' }], nextToken: null, cursors: [] }, 'all')
  seed(student, 'enrollments', { items: [], nextToken: null, cursors: [] }, 'mine')
  const html = render(student, CoursesPage)
  assert.ok(html.includes('Todavía no hay cursos visibles'))
  assert.ok(!html.includes('Buscando cursos que coincidan'))
})

test('draft course owners see the publishing instructions and edit link', () => {
  seed(admin, 'course', { ...course, status: 'draft' }, course.courseId)
  const html = render(admin, CourseDetail, { courseId: course.courseId })
  assert.ok(html.includes('selecciona Estado: Publicado y guarda los cambios'))
  assert.ok(html.includes('/app/courses/course/edit'))
})

test('course creation explains how to publish after saving the draft', () => {
  const html = render(admin, CourseForm)
  assert.ok(html.includes('El curso se guardará como borrador'))
  assert.ok(html.includes('abre Editar curso, selecciona Estado: Publicado'))
  assert.ok(!html.includes('id="course-status"'))
})

test('course editor exposes the saved status and its effect on enrollment', () => {
  seed(admin, 'course', course, course.courseId)
  const html = render(admin, CourseForm, { courseId: course.courseId })
  assert.ok(html.includes('id="course-status"'))
  assert.ok(html.includes('value="published" selected=""'))
  assert.ok(html.includes('aparece en el catálogo de tu campus y admite matrículas'))
})
