// Run with: node tests/course-filters.browser.mjs
// Uses an isolated browser profile and the local fixtures; never connects to AWS.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('../', import.meta.url))
const browserPath = process.env.LMS_TEST_BROWSER ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(path => existsSync(path))
assert.ok(browserPath, 'Set LMS_TEST_BROWSER to a Chromium browser executable')
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function freePort() {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}
async function until(check, description) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    try { const value = await check(); if (value) return value } catch { /* Wait for startup or navigation. */ }
    await pause(100)
  }
  throw new Error('Timed out: ' + description)
}

const webPort = await freePort()
const apiPort = await freePort()
assert.notEqual(webPort, apiPort)
const origin = `http://127.0.0.1:${webPort}`
const source = (await readFile(new URL('./preview-server.mjs', import.meta.url), 'utf8'))
  .replaceAll('4173', String(webPort)).replaceAll('4174', String(apiPort))
let fixtureOutput = ''
const fixtures = spawn(process.execPath, ['--input-type=module', '--eval', source], { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
fixtures.stdout.on('data', data => { fixtureOutput += data })
fixtures.stderr.on('data', data => { fixtureOutput += data })
const profile = await mkdtemp(join(tmpdir(), 'lms-course-filter-'))
let browser
let socket
let command
try {
  await until(async () => (await fetch(origin)).ok, 'local fixture server: ' + fixtureOutput)
  browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
  const debuggerPort = await until(async () => Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]), 'browser debugger')
  const target = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/new?about:blank`, { method: 'PUT' })).json()
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  let nextId = 0
  const pending = new Map()
  const requests = []
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url)
    const task = pending.get(message.id)
    if (task) { pending.delete(message.id); clearTimeout(task.timer); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result) }
  })
  command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser command timed out: ' + method)) }, 10000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  const waitFor = (expression, label) => until(() => evaluate(expression), label)
  let checks = 0
  function pass(label) { checks++; console.log('PASS: ' + label) }
  async function go(path) { await command('Page.navigate', { url: origin + path }) }
  async function input(selector, value) {
    await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, ${JSON.stringify(value)}); element.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  }
  async function select(selector, value) {
    await evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); element.value = ${JSON.stringify(value)}; element.dispatchEvent(new Event('change', { bubbles: true })); })()`)
  }
  async function login(email) {
    await go('/login')
    await waitFor(`Boolean(document.querySelector('input[type="email"]'))`, 'login form')
    await input('input[type="email"]', email)
    await input('input[type="password"]', 'test-only')
    await evaluate(`document.querySelector('form').requestSubmit()`)
    await waitFor(`location.pathname === '/app'`, 'successful fixture login')
  }
  const courseLinks = `Array.from(document.querySelectorAll('.course-card h3')).map(element => element.textContent)`
  const userIds = `Array.from(document.querySelectorAll('.person-cell small')).map(element => element.textContent)`
  async function courses() {
    await go('/app/courses')
    await waitFor(`document.querySelectorAll('.course-card').length === 2`, 'initial course page')
  }
  async function users() {
    await go('/app/users')
    await waitFor(`${userIds}.length === 2`, 'initial user page')
  }
  async function setCourseStatus(id, status) {
    await go('/app/courses/' + id + '/edit')
    await waitFor(`Boolean(document.querySelector('#course-status'))`, 'course editor')
    await select('#course-status', status)
    await evaluate(`document.querySelector('form').requestSubmit()`)
    await waitFor(`location.pathname === '/app/courses/${id}' && Boolean(document.querySelector('.badge-${status}'))`, 'saved course status')
  }
  await command('Network.enable')
  await login('admin@example.test')

  await courses()
  await select('.toolbar select', 'draft')
  await waitFor(`${courseLinks}.includes('Laboratorio de nuevas ideas')`, 'draft on later page')
  assert.deepEqual(await evaluate(courseLinks), ['Laboratorio de nuevas ideas'])
  pass('admin status filter automatically reaches the later page')

  await courses()
  await input('input[type="search"]', '  LABORATORIO  ')
  await waitFor(`${courseLinks}.includes('Laboratorio de nuevas ideas')`, 'title on later page')
  assert.deepEqual(await evaluate(courseLinks), ['Laboratorio de nuevas ideas'])
  pass('course title search reaches later pages and handles spaces and case')

  await courses()
  await input('input[type="search"]', '  crs-test-003  ')
  await waitFor(`${courseLinks}.includes('Laboratorio de nuevas ideas')`, 'ID on later page')
  assert.deepEqual(await evaluate(courseLinks), ['Laboratorio de nuevas ideas'])
  pass('full course ID search reaches later pages and ignores case and surrounding spaces')

  await courses()
  await input('input[type="search"]', 'test-003')
  await waitFor(`${courseLinks}.includes('Laboratorio de nuevas ideas')`, 'partial course ID')
  assert.deepEqual(await evaluate(courseLinks), ['Laboratorio de nuevas ideas'])
  pass('partial course IDs return the matching course')

  await courses()
  await select('.toolbar select', 'published')
  await input('input[type="search"]', 'CRS-TEST-003')
  await waitFor(`document.querySelector('.empty-state h3')?.textContent === 'Sin coincidencias'`, 'course ID excluded by publication filter')
  await select('.toolbar select', 'draft')
  await waitFor(`${courseLinks}.includes('Laboratorio de nuevas ideas')`, 'same ID with matching status')
  pass('course ID search respects the selected state and recovers when it changes')

  await courses()
  const beforeMissingCourse = requests.length
  await input('input[type="search"]', 'CRS-TEST-MISSING')
  await waitFor(`document.querySelector('.empty-state h3')?.textContent === 'Sin coincidencias'`, 'missing course ID')
  assert.ok(requests.slice(beforeMissingCourse).some(url => url.includes('/courses?') && url.includes('nextToken=')))
  await input('input[type="search"]', '')
  await waitFor(`${courseLinks}.length === 3`, 'course list restored after clearing the search')
  pass('missing course ID checks remaining pages and clearing the search restores the list')

  await courses()
  const beforeEmpty = requests.length
  await select('.toolbar select', 'archived')
  await waitFor(`document.querySelector('.empty-state h3')?.textContent === 'Sin coincidencias'`, 'exhausted archive search')
  assert.ok(requests.slice(beforeEmpty).some(url => url.includes('/courses?') && url.includes('nextToken=')))
  pass('no matches is shown only after checking the remaining page')

  await users()
  const beforeUserId = requests.length
  await input('input[type="search"]', '  usr-test-student-003  ')
  await waitFor(`${userIds}.includes('USR-TEST-STUDENT-003')`, 'user ID on third page')
  assert.deepEqual(await evaluate(userIds), ['USR-TEST-STUDENT-003'])
  assert.ok(requests.slice(beforeUserId).some(url => url.includes('/users?') && url.includes('test-page-4')))
  pass('full user ID search reaches the third page and ignores case and surrounding spaces')

  await users()
  await input('input[type="search"]', 'student-003')
  await waitFor(`${userIds}.includes('USR-TEST-STUDENT-003')`, 'partial user ID on third page')
  assert.deepEqual(await evaluate(userIds), ['USR-TEST-STUDENT-003'])
  pass('partial user IDs return the matching user beyond the first page')

  await users()
  await input('input[type="search"]', '  STUDENT3@EXAMPLE.TEST  ')
  await waitFor(`${userIds}.includes('USR-TEST-STUDENT-003')`, 'user email on third page')
  assert.deepEqual(await evaluate(userIds), ['USR-TEST-STUDENT-003'])
  pass('user email search reaches later pages and ignores spaces and case')

  await users()
  await select('.toolbar select', 'student')
  await waitFor(`${userIds}.length === 2 && ${userIds}.includes('USR-TEST-STUDENT-002')`, 'first page of students')
  await input('input[type="search"]', 'USR-TEST-STUDENT-003')
  await waitFor(`${userIds}.includes('USR-TEST-STUDENT-003')`, 'user ID after the first filtered page')
  assert.deepEqual(await evaluate(userIds), ['USR-TEST-STUDENT-003'])
  await input('input[type="search"]', '')
  await waitFor(`${userIds}.length === 3`, 'students restored after clearing their search')
  assert.ok((await evaluate(userIds)).every(id => id.startsWith('USR-TEST-STUDENT')))
  pass('user ID search and clearing the input preserve the selected role')

  await users()
  await select('.toolbar select', 'teacher')
  await waitFor(`${userIds}.length === 1 && ${userIds}.includes('USR-TEST-TEACHER')`, 'teacher role filter')
  await input('input[type="search"]', 'USR-TEST-STUDENT-003')
  await waitFor(`Boolean(document.querySelector('.empty-state')) && !document.querySelector('.skeleton-group')`, 'student ID excluded by teacher filter')
  assert.deepEqual(await evaluate(userIds), [])
  await select('.toolbar select', 'all')
  await waitFor(`${userIds}.includes('USR-TEST-STUDENT-003')`, 'same ID after clearing the role filter')
  pass('user ID search respects the selected role and recovers when it changes')

  await users()
  const beforeMissingUser = requests.length
  await input('input[type="search"]', 'USR-TEST-MISSING')
  await waitFor(`Boolean(document.querySelector('.empty-state')) && !document.querySelector('.skeleton-group')`, 'missing user ID')
  assert.ok(requests.slice(beforeMissingUser).some(url => url.includes('/users?') && url.includes('test-page-4')))
  await input('input[type="search"]', '')
  await waitFor(`${userIds}.length === 5`, 'all users restored after clearing the search')
  pass('missing user ID checks all pages and clearing the search restores all loaded users')

  await go('/app/courses/CRS-TEST-003')
  await waitFor(`document.body.textContent.includes('selecciona Estado: Publicado')`, 'draft instructions')
  await setCourseStatus('CRS-TEST-003', 'published')
  await setCourseStatus('CRS-TEST-001', 'draft')
  await setCourseStatus('CRS-TEST-002', 'draft')
  pass('the edit form saves the publication state')

  await evaluate(`localStorage.clear(); location.replace('/login')`)
  await waitFor(`Boolean(document.querySelector('input[type="email"]'))`, 'student login form')
  await login('student@example.test')
  await go('/app/courses')
  await waitFor(`${courseLinks}.includes('Laboratorio de nuevas ideas')`, 'published student course after drafts')
  assert.deepEqual(await evaluate(courseLinks), ['Laboratorio de nuevas ideas'])
  pass('student catalog skips a first page containing only drafts')

  await input('input[type="search"]', '  crs-test-003  ')
  await waitFor(`${courseLinks}.length === 1 && ${courseLinks}.includes('Laboratorio de nuevas ideas') && !document.querySelector('.skeleton-group')`, 'student catalog course ID')
  pass('student course ID search keeps the published catalog result')

  await go('/app/courses/CRS-TEST-003')
  await waitFor(`Array.from(document.querySelectorAll('button')).some(button => button.textContent.includes('Matricularme'))`, 'student enrollment action')
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Matricularme')).click()`)
  await waitFor(`Boolean(document.querySelector('.enrolled-label'))`, 'confirmed fixture enrollment')
  await go('/app/my-courses')
  await waitFor(`document.querySelectorAll('.course-card').length === 2`, 'first enrollment page')
  await select('.toolbar select', 'published')
  await waitFor(`${courseLinks}.includes('Laboratorio de nuevas ideas')`, 'published course on later enrollment page')
  assert.deepEqual(await evaluate(courseLinks), ['Laboratorio de nuevas ideas'])
  pass('My courses filters follow enrollment pages and resolve the matching course')
  await input('input[type="search"]', '  crs-test-003  ')
  await waitFor(`${courseLinks}.length === 1 && ${courseLinks}.includes('Laboratorio de nuevas ideas') && !document.querySelector('.skeleton-group')`, 'enrolled course ID')
  pass('My courses accepts course IDs with surrounding spaces and a selected state')
  assert.ok(requests.filter(url => url.includes('/v1/')).every(url => new URL(url).hostname === '127.0.0.1'))
  console.log(`${checks} browser checks passed against local fixtures; no AWS calls`)
} finally {
  try { if (socket?.readyState === WebSocket.OPEN) await command('Browser.close') } catch { /* Browser may already be closed. */ }
  socket?.close()
  browser?.kill()
  fixtures.kill()
  if (dirname(resolve(profile)) === resolve(tmpdir()) && basename(profile).startsWith('lms-course-filter-')) {
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {})
  }
}
