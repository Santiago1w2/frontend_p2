import { createServer as createHttpServer } from 'node:http'
import { createServer as createViteServer } from 'vite'
import { randomUUID } from 'node:crypto'

const apiOrigin = 'http://127.0.0.1:4174'
const createdAt = '2026-11-10T10:00:00Z'
const users = [
  { userId: 'USR-TEST-ADMIN', email: 'admin@example.test', role: 'tenant_admin' },
  { userId: 'USR-TEST-TEACHER', email: 'teacher@example.test', role: 'teacher' },
  { userId: 'USR-TEST-STUDENT', email: 'student@example.test', role: 'student' },
  { userId: 'USR-TEST-STUDENT-002', email: 'student2@example.test', role: 'student' },
  { userId: 'USR-TEST-STUDENT-003', email: 'student3@example.test', role: 'student' },
].map(user => ({ ...user, tenantId: 'CAMPUS_DE_PRUEBA', status: 'active', createdAt }))
const courses = [
  { courseId: 'CRS-TEST-001', title: 'Diseño de sistemas distribuidos', description: 'De una idea a un sistema resiliente. Explora cómo se conectan los servicios, los datos y las personas.', status: 'published' },
  { courseId: 'CRS-TEST-002', title: 'Interfaces que cuentan historias', description: 'Jerarquía visual, interacción y accesibilidad para construir experiencias digitales con intención.', status: 'published' },
  { courseId: 'CRS-TEST-003', title: 'Laboratorio de nuevas ideas', description: 'Un espacio de preparación para el próximo curso.', status: 'draft' },
].map(course => ({ ...course, teacherId: 'USR-TEST-TEACHER', tenantId: 'CAMPUS_DE_PRUEBA', createdAt }))
const enrollments = [{ enrollmentId: 'ENR-TEST-001', courseId: courses[0].courseId, studentId: 'USR-TEST-STUDENT', status: 'active', createdAt }, { enrollmentId: 'ENR-TEST-002', courseId: courses[1].courseId, studentId: 'USR-TEST-STUDENT', status: 'active', createdAt }]
const materials = [{ contentId: 'CNT-TEST-001', courseId: courses[0].courseId, uploadedBy: 'USR-TEST-TEACHER', title: 'Guía de arquitectura · Semana 1', mimeType: 'application/pdf', sizeBytes: 204800, uploadStatus: 'confirmed', createdAt }]
const evaluations = [{ evaluationId: 'EVL-TEST-001', courseId: courses[0].courseId, tenantId: 'CAMPUS_DE_PRUEBA', teacherId: 'USR-TEST-TEACHER', title: 'Conceptos para conectar ideas', status: 'published', createdAt, fechaLimite: '2026-12-01T23:59:00Z', questions: Array.from({ length: 3 }, (_, index) => ({ questionId: 'Q' + index, text: ['¿Qué representa una frontera de servicio?', '¿Qué aporta una cola de mensajes?', '¿Por qué diseñar para fallos?'][index], options: ['Una decisión de diseño que separa responsabilidades', 'Una regla visual del navegador'], correctIndex: 0 })) }]
const sessions = new Map()
const quizResults = new Map()
const lostSubmissionResponses = new Set()
const submissionScenario = process.env.LMS_TEST_QUIZ_SCENARIO ?? 'normal'
const uploaded = new Set()
if (process.env.LMS_TEST_SEARCH_FIXTURES === '1') {
  courses.push(
    { ...courses[0], courseId: 'CRS-A-BCB2FDD0', title: 'MATE23' },
    { ...courses[0], courseId: 'CRS-A-00042', title: 'Curso en preparación', status: 'draft' },
    { ...courses[0], courseId: 'CRS-A-DEADC0DE', title: 'Curso de otro docente', teacherId: 'USR-OTHER-TEACHER' },
  )
  users.push(
    { ...users[2], userId: 'USR-A-00299', email: 'student299@example.test' },
    { ...users[1], userId: 'USR-A-ABCDEF12', email: 'teacher-new@example.test' },
    { ...users[0], userId: 'USR-ADMIN-TENANT_A', email: 'admin-tenant@example.test' },
  )
  enrollments.push({ enrollmentId: 'ENR-EXACT-TEST', courseId: 'CRS-A-BCB2FDD0', studentId: users[2].userId, status: 'active', createdAt })
}

function paginated(items, query) {
  const start = Number(query.get('nextToken')?.replace('test-page-', '') ?? 0)
  return { items: items.slice(start, start + 2), nextToken: start + 2 < items.length ? `test-page-${start + 2}` : null }
}
function visibleEvaluation(evaluation, user) {
  return user.role === 'student' ? { ...evaluation, questions: evaluation.questions.map(({ correctIndex: _correctIndex, ...question }) => question) } : evaluation
}
const api = createHttpServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4173')
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, OPTIONS')
  if (request.method === 'OPTIONS') { response.writeHead(204).end(); return }
  const url = new URL(request.url, apiOrigin)
  const parts = url.pathname.split('/').filter(Boolean)
  function send(data) { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ data, requestId: randomUUID() })) }
  function fail(code, message) { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ error: { code, message }, requestId: randomUUID() })) }
  if (parts[0] === 'signed-put') {
    if (request.headers.authorization) { response.writeHead(403).end(); return }
    request.resume()
    request.on('end', () => { uploaded.add(parts[1]); response.writeHead(200).end() })
    return
  }
  if (parts[0] === 'download') { response.setHeader('Content-Type', 'text/plain'); response.setHeader('Content-Disposition', 'attachment; filename="local-test-notes.txt"'); response.end('Archivo de prueba local. No procede de AWS.'); return }
  let body = {}
  try {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    if (chunks.length) body = JSON.parse(Buffer.concat(chunks).toString())
  } catch { fail('INVALID_BODY', 'Invalid JSON'); return }
  const [, , resource, id, action] = parts
  if (resource === 'auth' && id === 'login') {
    const user = users.find(item => item.email === body.email)
    if (!user || body.password !== 'test-only') { fail('INVALID_CREDENTIALS', 'Invalid local test credentials'); return }
    const accessToken = randomUUID()
    sessions.set(accessToken, user)
    send({ accessToken, tokenType: 'Bearer', expiresIn: 28800, user })
    return
  }
  const token = (request.headers.authorization ?? '').replace(/^Bearer /, '')
  const user = sessions.get(token)
  if (!user) { response.writeHead(403, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: 'Invalid local session' })); return }
  if (resource === 'auth' && id === 'logout') { sessions.delete(token); send({}); return }
  if (resource === 'me') { send(user); return }
  if (resource === 'users') {
    if (user.role !== 'tenant_admin') { fail('FORBIDDEN', 'Only admins'); return }
    if (process.env.LMS_TEST_SEARCH_FIXTURES === '1' && id === 'USR-A-EEEEEEEE') { response.writeHead(502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: 'Simulated lookup failure' })); return }
    if (request.method === 'POST') {
      if (users.some(item => item.email === body.email)) { fail('CONFLICT', 'Email already exists'); return }
      const created = { userId: 'USR-TEST-' + randomUUID(), email: body.email, role: body.role, tenantId: user.tenantId, status: 'active', createdAt: new Date().toISOString() }
      users.push(created)
      send({ userId: created.userId, email: created.email, role: created.role }); return
    }
    const item = users.find(person => person.userId === id)
    if (id) { if (item) send(item); else fail('NOT_FOUND', 'User not found'); return }
    send(paginated(users, url.searchParams)); return
  }
  if (resource === 'courses') {
    if (request.method === 'POST') { if (user.role === 'student') { fail('FORBIDDEN', 'Students cannot create courses'); return } const created = { ...body, courseId: 'CRS-TEST-' + randomUUID(), tenantId: user.tenantId, teacherId: user.userId, status: 'draft', createdAt: new Date().toISOString() }; courses.push(created); send(created); return }
    const course = courses.find(item => item.courseId === id)
    if (request.method === 'PATCH') { if (!course) fail('NOT_FOUND', 'Course not found'); else if (user.role !== 'tenant_admin' && (user.role !== 'teacher' || course.teacherId !== user.userId)) fail('FORBIDDEN', 'Not owner'); else { Object.assign(course, body, { updatedAt: new Date().toISOString() }); send(course) } return }
    if (id) { if (course) send(course); else fail('NOT_FOUND', 'Course not found'); return }
    send(paginated(courses.filter(item => !url.searchParams.get('teacherId') || item.teacherId === url.searchParams.get('teacherId')), url.searchParams)); return
  }
  if (resource === 'enrollments') {
    if (request.method === 'POST') {
      const studentId = user.role === 'student' ? user.userId : body.studentId
      if (user.role === 'teacher') { fail('FORBIDDEN', 'Teachers cannot enroll'); return }
      if (enrollments.some(item => item.courseId === body.courseId && item.studentId === studentId)) { fail('CONFLICT', 'Already enrolled'); return }
      if (!users.some(item => item.userId === studentId) || !courses.some(item => item.courseId === body.courseId && item.status === 'published')) { fail('NOT_FOUND', 'Course or student not found'); return }
      const created = { enrollmentId: 'ENR-TEST-' + randomUUID(), courseId: body.courseId, studentId, status: 'active', createdAt: new Date().toISOString() }; enrollments.push(created); send(created); return
    }
    if (!url.searchParams.get('courseId') && !url.searchParams.get('studentId')) { fail('INVALID_BODY', 'Filter required'); return }
    send(paginated(enrollments.filter(item => (!url.searchParams.get('courseId') || item.courseId === url.searchParams.get('courseId')) && (!url.searchParams.get('studentId') || item.studentId === url.searchParams.get('studentId'))), url.searchParams)); return
  }
  if (resource === 'materials') {
    if (request.method === 'POST' && !id) { const created = { ...body, contentId: 'CNT-TEST-' + randomUUID(), uploadedBy: user.userId, uploadStatus: 'pending', createdAt: new Date().toISOString() }; materials.push(created); send({ contentId: created.contentId, uploadStatus: 'pending' }); return }
    const material = materials.find(item => item.contentId === id)
    if (id && !material) { fail('NOT_FOUND', 'Content not found'); return }
    if (action === 'upload-url') { send({ uploadUrl: apiOrigin + '/signed-put/' + id, expiresIn: 300 }); return }
    if (action === 'confirm') { if (!uploaded.has(id)) fail('BAD_REQUEST', 'File not uploaded'); else { material.uploadStatus = 'confirmed'; material.confirmedAt = new Date().toISOString(); send({ contentId: id, uploadStatus: 'confirmed' }) } return }
    if (action === 'download-url') { send({ downloadUrl: apiOrigin + '/download/' + id, expiresIn: 60 }); return }
    send({ items: materials.filter(item => item.courseId === url.searchParams.get('courseId') && item.uploadStatus === 'confirmed') }); return
  }
  if (resource === 'evaluations') {
    const evaluation = evaluations.find(item => item.evaluationId === id)
    if (id && !evaluation) { fail('NOT_FOUND', 'Evaluation not found'); return }
    if (action === 'result' && request.method === 'GET') {
      const studentId = user.role === 'student' ? user.userId : url.searchParams.get('studentId')
      if (!studentId) { fail('INVALID_BODY', 'studentId query param is required'); return }
      const saved = quizResults.get(id + ':' + studentId)
      if (saved) send(saved); else fail('NOT_FOUND', 'Result not found')
      return
    }
    if (action === 'submit' && request.method === 'POST') {
      if (user.role !== 'student') { fail('FORBIDDEN', 'Only students can submit quizzes'); return }
      if (evaluation.status !== 'published') { fail('NOT_FOUND', 'Evaluation not found'); return }
      if (!enrollments.some(item => item.courseId === evaluation.courseId && item.studentId === user.userId && item.status === 'active')) { fail('FORBIDDEN', 'You are not enrolled in this course'); return }
      const key = id + ':' + user.userId
      if (quizResults.has(key)) { fail('CONFLICT', 'You have already submitted this evaluation'); return }
      if (!Array.isArray(body.answers) || body.answers.length !== evaluation.questions.length) { fail('INVALID_BODY', 'Unexpected number of answers'); return }
      // Match the current backend: date enforcement belongs to the client here.
      const correctAnswers = evaluation.questions.filter((question, index) => body.answers[index] === question.correctIndex).length
      const totalQuestions = evaluation.questions.length
      const saved = { evaluationId: id, studentId: user.userId, tenantId: user.tenantId, answers: body.answers, correctAnswers, totalQuestions, score: Math.round(correctAnswers / totalQuestions * 10000) / 100, submittedAt: new Date().toISOString() }
      quizResults.set(key, saved)
      if (submissionScenario === 'saved-but-response-lost' && !lostSubmissionResponses.has(key)) {
        lostSubmissionResponses.add(key)
        response.writeHead(502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: 'Simulated lost response after saving' }))
        return
      }
      const { evaluationId, score, submittedAt } = saved
      send({ evaluationId, score, correctAnswers, totalQuestions, submittedAt }); return
    }
    if (request.method === 'POST' && !id) { if (user.role === 'student') { fail('FORBIDDEN', 'Only admins and teachers'); return } const created = { ...body, evaluationId: 'EVL-TEST-' + randomUUID(), tenantId: user.tenantId, teacherId: user.userId, status: 'draft', createdAt: new Date().toISOString() }; evaluations.push(created); send(created); return }
    if (request.method === 'PATCH') { if (user.role !== 'tenant_admin' && (user.role !== 'teacher' || evaluation.teacherId !== user.userId)) fail('FORBIDDEN', 'Not owner'); else { Object.assign(evaluation, body); send(evaluation) } return }
    if (id) { if (user.role === 'student' && evaluation.status !== 'published') fail('NOT_FOUND', 'Evaluation not found'); else if (user.role === 'student' && !enrollments.some(item => item.courseId === evaluation.courseId && item.studentId === user.userId)) fail('FORBIDDEN', 'Not enrolled'); else send(visibleEvaluation(evaluation, user)); return }
    send({ items: evaluations.filter(item => item.courseId === url.searchParams.get('courseId') && (user.role !== 'student' || item.status === 'published')).map(item => visibleEvaluation(item, user)) }); return
  }
  fail('NOT_FOUND', 'Unsupported test route')
})
await new Promise(resolve => api.listen(4174, '127.0.0.1', resolve))
const define = Object.fromEntries(Object.entries({ VITE_API_V1_USER: 'users', VITE_API_V1_COURSE: 'courses', VITE_API_V1_MATRICULAS: 'enrollments', VITE_API_V1_CONTENIDOS: 'content', VITE_API_V1_EVALUACIONES: 'evaluations' }).map(([key, service]) => ['import.meta.env.' + key, JSON.stringify(apiOrigin + '/' + service + '/v1')]))
const vite = await createViteServer({ mode: 'isolated-preview', define, server: { host: '127.0.0.1', port: 4173, strictPort: true } })
await vite.listen()
console.log('ISOLATED LOCAL FIXTURES ONLY: http://127.0.0.1:4173 — no AWS calls')
async function stop() { await vite.close(); api.close(); process.exit(0) }
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
