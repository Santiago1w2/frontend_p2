// Full React/Axios/browser flows over local HTTP, with no AWS traffic.
import assert from 'node:assert/strict'
import { withFixtureBrowser } from './browser-fixture.mjs'

let checks = 0
function pass(label) { checks++; console.log('PASS: ' + label) }

await withFixtureBrowser(async ({ evaluate, waitFor, go, input, select, login, requests, command }) => {
  const resultVisible = `document.querySelector('.quiz-result')?.textContent.includes('66.67%')`
  async function logout() {
    await evaluate(`localStorage.clear(); location.replace('/login')`)
    await waitFor(`Boolean(document.querySelector('input[type="email"]'))`, 'cleared session')
  }
  // Use fixtures without questionId to exercise the backend's legacy records.
  await login('teacher@example.test')
  // Exercise creation through the actual application service without changing .env.
  const id = await evaluate(`(async () => {
    const service = await import('/src/services/EvaluationService.ts');
    const created = await service.evaluationCreate({ courseId: 'CRS-TEST-001', title: 'Quiz de integración', fechaLimite: new Date(Date.now() + 86400000).toISOString(), questions: [
      { text: 'Pregunta uno', options: ['A', 'B'], correctIndex: 0 },
      { text: 'Pregunta dos', options: ['C', 'D'], correctIndex: 1 },
      { text: 'Pregunta tres', options: ['E', 'F'], correctIndex: 0 }
    ] });
    await service.evaluationPatch(created.evaluationId, { status: 'published' });
    return created.evaluationId;
  })()`)
  assert.ok(id.startsWith('EVL-TEST-'))
  pass('creates and publishes an evaluation using the production API client')
  await logout()
  await login('student@example.test')
  await go('/app/evaluations/' + id)
  await waitFor(`document.querySelectorAll('.question-read input[type="radio"]').length === 6 && !document.querySelector('.question-read').disabled`, 'student quiz and prior-result lookup')
  assert.equal(await evaluate(`document.querySelectorAll('.correct-label').length`), 0)
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Enviar evaluación').click()`)
  await waitFor(`document.body.textContent.includes('Selecciona una respuesta válida')`, 'incomplete answers validation')
  assert.equal(requests.filter(request => request.method === 'POST' && request.url.endsWith('/submit')).length, 0)
  pass('validates unanswered questions and never exposes correct choices to the student')
  await evaluate(`document.querySelectorAll('.question-read')[0].querySelectorAll('input')[0].click()`)
  await evaluate(`document.querySelectorAll('.question-read')[1].querySelectorAll('input')[1].click()`)
  await evaluate(`document.querySelectorAll('.question-read')[2].querySelectorAll('input')[1].click()`)
  assert.equal(await evaluate(`document.querySelectorAll('.question-read input:checked').length`), 3)
  pass('legacy questions without IDs keep three independent radio groups')
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Enviar evaluación').click()`)
  await waitFor(`Boolean(document.querySelector('dialog[open]'))`, 'submission confirmation')
  await evaluate(`Array.from(document.querySelectorAll('dialog[open] button')).find(button => button.textContent === 'Confirmar').click()`)
  await waitFor(resultVisible, 'grade after confirmed submission')
  const submits = requests.filter(request => request.method === 'POST' && request.url.endsWith('/submit'))
  assert.equal(submits.length, 1)
  assert.deepEqual(JSON.parse(submits[0].postData), { answers: [0, 1, 1] })
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).some(button => button.textContent === 'Enviar evaluación')`), false)
  pass('sends ordered answers once and displays the server percentage without a second submission')
  await command('Page.reload')
  await waitFor(resultVisible, 'persisted grade after reload')
  assert.equal(requests.filter(request => request.method === 'POST' && request.url.endsWith('/submit')).length, 1)
  assert.equal(await evaluate(`document.querySelectorAll('.question-read input:checked').length`), 3)
  pass('reload restores saved answers and score through GET result')
  await go('/app/results')
  await waitFor(`Boolean(document.querySelector('#result-evaluation-id'))`, 'global grade lookup')
  await input('#result-evaluation-id', id)
  await evaluate(`document.querySelector('main form').requestSubmit()`)
  await waitFor(resultVisible, 'own result lookup')
  assert.equal(await evaluate(`Boolean(document.querySelector('#lookup-student-id'))`), false)
  pass('student grade lookup uses the session identity without asking for another student ID')
  await logout()
  await login('teacher@example.test')
  await go('/app/evaluations/' + id)
  await waitFor(`document.querySelector('#result-student-select')?.options.length > 1`, 'teacher roster')
  await select('#result-student-select', 'USR-TEST-STUDENT')
  await waitFor(resultVisible, 'teacher grade lookup')
  assert.ok(requests.some(request => request.url.includes('/result?studentId=USR-TEST-STUDENT')))
  pass('teacher selects an enrollment and queries that student score')
  await go('/app/evaluations/' + id + '/edit')
  await waitFor(`Boolean(document.querySelector('#evaluation-status'))`, 'evaluation editor')
  await select('#evaluation-status', 'closed')
  await evaluate(`document.querySelector('main form').requestSubmit()`)
  await waitFor(`Boolean(document.querySelector('dialog[open]'))`, 'close confirmation')
  await evaluate(`Array.from(document.querySelectorAll('dialog[open] button')).find(button => button.textContent === 'Confirmar').click()`)
  await waitFor(`location.pathname === '/app/evaluations/${id}' && Boolean(document.querySelector('.badge-closed'))`, 'closed evaluation')
  pass('teacher closes the evaluation through the existing PATCH endpoint')
  await logout()
  await login('student@example.test')
  await go('/app/evaluations/' + id + '/result')
  await waitFor(resultVisible, 'result after evaluation closure')
  pass('a closed evaluation result loads independently of the student-hidden detail endpoint')
  await go('/app/evaluations/' + id)
  await waitFor(resultVisible, 'closed detail fallback to grade')
  pass('an old detail link still offers the previously saved grade after closure')
  await logout()
  await login('admin@example.test')
  await go('/app/evaluations/' + id + '/result?studentId=USR-TEST-STUDENT')
  await waitFor(resultVisible, 'admin direct result link')
  pass('admin direct result links preserve the selected student')
  await logout()
  await login('student2@example.test')
  await go('/app/evaluations/' + id + '/result')
  await waitFor(`document.body.textContent.includes('Todavía no hay una entrega registrada')`, 'different student no result')
  assert.equal(await evaluate(`Boolean(document.querySelector('.quiz-result'))`), false)
  pass('another student does not inherit the prior user grade from cache')
}, { scenario: 'saved-but-response-lost' })

console.log(`${checks} evaluation browser checks passed against local HTTP fixtures, including recovery from a saved submission with a lost response; no AWS calls`)
