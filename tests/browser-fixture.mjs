import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function freePort() {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}
async function until(check, label) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    try { const value = await check(); if (value) return value } catch { /* wait for navigation/startup */ }
    await pause(100)
  }
  throw new Error('Timed out: ' + label)
}

export async function withFixtureBrowser(run, { scenario = 'normal', searchFixtures = false, deletionScenario = 'normal' } = {}) {
  const cwd = fileURLToPath(new URL('../', import.meta.url))
  const browserPath = process.env.LMS_TEST_BROWSER ?? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(path => existsSync(path))
  assert.ok(browserPath, 'Set LMS_TEST_BROWSER to a Chromium browser executable')
  const webPort = await freePort()
  const apiPort = await freePort()
  assert.notEqual(webPort, apiPort)
  const origin = `http://127.0.0.1:${webPort}`
  const source = (await readFile(new URL('./preview-server.mjs', import.meta.url), 'utf8'))
    .replaceAll('4173', String(webPort)).replaceAll('4174', String(apiPort))
  let fixtureOutput = ''
  const fixtures = spawn(process.execPath, ['--input-type=module', '--eval', source], { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, LMS_TEST_QUIZ_SCENARIO: scenario, LMS_TEST_SEARCH_FIXTURES: searchFixtures ? '1' : '0', LMS_TEST_DELETE_SCENARIO: deletionScenario } })
  fixtures.stdout.on('data', data => { fixtureOutput += data })
  fixtures.stderr.on('data', data => { fixtureOutput += data })
  const profile = await mkdtemp(join(tmpdir(), 'lms-evaluation-'))
  let browser, socket, command
  try {
    await until(async () => (await fetch(origin)).ok, 'fixture server: ' + fixtureOutput)
    browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
    const debuggerPort = await until(async () => Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]), 'browser debugger')
    const target = await (await fetch(`http://127.0.0.1:${debuggerPort}/json/new?about:blank`, { method: 'PUT' })).json()
    socket = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
    let nextId = 0
    const pending = new Map()
    const requests = []
    const errors = []
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data)
      if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request)
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
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
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
      return result.result.value
    }
    const waitFor = async (expression, label) => {
      try { return await until(() => evaluate(expression), label) }
      catch (error) {
        const state = await evaluate(`({ path: location.pathname + location.search, content: document.querySelector('main')?.innerText })`).catch(() => null)
        throw new Error(error.message + '\n' + JSON.stringify(state))
      }
    }
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
    await command('Network.enable')
    await command('Runtime.enable')
    await run({ command, evaluate, waitFor, go, input, select, login, requests, origin })
    assert.deepEqual(errors, [], 'No browser runtime exceptions')
    assert.ok(requests.filter(request => request.url.includes('/v1/')).every(request => new URL(request.url).hostname === '127.0.0.1'), 'All API traffic remained local')
  } finally {
    try { if (socket?.readyState === WebSocket.OPEN) await command('Browser.close') } catch { /* already closed */ }
    socket?.close()
    browser?.kill()
    fixtures.kill()
    // Validate the absolute target before removing the temporary browser profile.
    if (dirname(resolve(profile)) === resolve(tmpdir()) && basename(profile).startsWith('lms-evaluation-')) {
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {})
    }
  }
}
