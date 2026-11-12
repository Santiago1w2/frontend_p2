import './setup.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Brand } from '../src/components/shared/Brand.tsx'
import { CourseCard } from '../src/features/courses/CourseCard.tsx'
import { courseTone } from '../src/lib/format.ts'

const root = new URL('../', import.meta.url)
const read = filename => readFileSync(new URL(filename, root), 'utf8')
const tokenBlocks = [...read('src/index.css').matchAll(/:root(?:\[data-theme='dark'\])?\s*\{([^}]+)\}/g)]
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
}
function contrast(first, second) {
  const values = [luminance(first), luminance(second)]
  return (Math.max(...values) + .05) / (Math.min(...values) + .05)
}
const textPairs = [
  ['text', 'background'], ['text', 'surface'], ['muted', 'background'], ['muted', 'surface'], ['faint', 'background'],
  ['accent-text', 'accent'], ['accent', 'accent-subtle'], ['danger', 'danger-subtle'], ['warning', 'warning-subtle'], ['info', 'info-subtle'],
  ['sidebar-muted', 'sidebar'], ['sidebar-text', 'sidebar'], ['sidebar-active-ink', 'sidebar-active'], ['banner-text', 'banner'], ['coral-ink', 'coral-subtle'],
  ...[0, 1, 2, 3].map(index => ['tone-' + index + '-ink', 'tone-' + index]),
]
for (const [index, block] of tokenBlocks.entries()) test((index ? 'dark' : 'light') + ' semantic text colors meet AA contrast', () => {
  const tokens = Object.fromEntries([...block[1].matchAll(/--([\w-]+):\s*(#[\da-f]{6})/g)].map(match => [match[1], match[2]]))
  for (const [foreground, background] of textPairs) {
    assert.ok(tokens[foreground] && tokens[background], foreground + ' / ' + background)
    assert.ok(contrast(tokens[foreground], tokens[background]) >= 4.5, foreground + ' / ' + background + ' must reach 4.5:1')
  }
  assert.ok(contrast(tokens['control-border'], tokens['surface-raised']) >= 3, 'input boundaries must reach 3:1')
})

test('Aurion branding supplies self-contained SVG resources for both themes and favicon', () => {
  for (const asset of ['brand/aurion-mark.svg', 'brand/aurion-logo-light.svg', 'brand/aurion-logo-dark.svg', 'favicon.svg']) {
    const source = read('public/' + asset)
    assert.match(source, /<svg[^>]+viewBox=/)
    assert.match(source, /linearGradient/)
    assert.ok(!/<image|(?:href|src)=["']https?:/i.test(source))
  }
  assert.match(read('index.html'), /<title>Aurion/)
  assert.ok(!/folio/i.test(read('index.html')))
})

test('brand lockup has one accessible identity and supports a compact independent symbol', () => {
  const html = renderToStaticMarkup(createElement(Brand, { inverse: true }))
  assert.match(html, /role="img" aria-label="Aurion"/)
  assert.match(html, /brand-inverse/)
  assert.match(html, /aurion-logo-dark.svg/)
  assert.match(html, /aurion-mark.svg/)
  assert.ok(!/folio|book|graduation/i.test(html))
})

test('redesigned course cards preserve actual resource data, membership and deterministic accents', () => {
  const course = { courseId: 'course/actual', title: 'Interfaces del campus', description: 'Descripción del contrato', status: 'published', teacherId: 'teacher', tenantId: 'tenant', createdAt: '2026-11-10T10:00:00Z' }
  const html = renderToStaticMarkup(createElement(CourseCard, { course, membership: 'enrolled' }))
  assert.match(html, new RegExp('course-card tone-' + courseTone(course.courseId)))
  assert.ok(html.includes('/app/courses/course%2Factual'))
  assert.ok(html.includes(course.title) && html.includes(course.description))
  assert.ok(html.includes('Estás matriculado') && html.includes('Publicado'))
  assert.ok(!html.includes('<img') && !/\b\d+(?:[.,]\d+)?%/.test(html))
})

test('responsive styles retain reduced motion, touch targets and locally scrollable tables', () => {
  assert.match(read('src/index.css'), /prefers-reduced-motion: reduce/)
  assert.match(read('src/styles/responsive.css'), /max-width: 760px/)
  assert.match(read('src/styles/responsive.css'), /max-width: 480px/)
  assert.match(read('src/styles/components.css'), /\.table-wrap[^}]+overflow-x: auto/)
  assert.match(read('src/styles/responsive.css'), /\.icon-button[^}]+width: 44px; height: 44px/)
  for (const file of ['src/features/users/UsersPage.tsx', 'src/features/enrollments/EnrollmentsPage.tsx']) assert.match(read(file), /className="table-wrap" role="region" aria-label="[^"]+" tabIndex=\{0\}/)
})
