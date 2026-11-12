import './setup.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AuthContext } from '../src/context/AuthContext.ts'
import LoginPage from '../src/pages/LoginPage.tsx'

function renderLogin(mode) {
  const previousMode = globalThis.__testEnv.MODE
  const previousWindow = globalThis.window
  globalThis.__testEnv.MODE = mode
  globalThis.window = { matchMedia: () => ({ matches: false }) }
  try {
    return renderToStaticMarkup(createElement(AuthContext.Provider, { value: { user: null, checking: false, busy: false, error: null, expired: false } }, createElement(LoginPage)))
  } finally {
    if (previousMode === undefined) delete globalThis.__testEnv.MODE
    else globalThis.__testEnv.MODE = previousMode
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
}

test('isolated browser preview identifies that real AWS credentials do not work there', () => {
  const html = renderLogin('isolated-preview')
  assert.ok(html.includes('Sin conexión a AWS'))
  assert.ok(html.includes('Las cuentas de tu base de datos no funcionan aquí'))
  assert.ok(html.includes('npm run dev'))
  assert.ok(html.includes('role="note"'))
})

for (const mode of ['development', 'production']) test(mode + ' login does not display isolated fixture instructions', () => {
  const html = renderLogin(mode)
  assert.ok(!html.includes('Entorno de prueba'))
  assert.ok(!html.includes('cuentas ficticias'))
  assert.match(html, /autocomplete="username"/i)
  assert.match(html, /autocomplete="current-password"/i)
})
