import assert from 'node:assert/strict'
import { withFixtureBrowser } from './browser-fixture.mjs'

let checks = 0
function pass(label) { checks++; console.log('PASS: ' + label) }
await withFixtureBrowser(async ({ evaluate, waitFor, go, input, select, login, requests }) => {
  const courseTitles = `Array.from(document.querySelectorAll('.course-card h3')).map(element => element.textContent)`
  const userIds = `Array.from(document.querySelectorAll('.person-cell small')).map(element => element.textContent)`
  const apiRequests = from => requests.slice(from).filter(request => request.method === 'GET' && request.url.includes('/v1/'))
  function noPagesSince(start, resource) {
    assert.equal(apiRequests(start).filter(request => new URL(request.url).pathname.endsWith('/' + resource)).length, 0, 'Exact lookup must not request list pages')
  }
  async function search(text) { await input('input[type="search"]', text) }
  async function clear() { await search(''); await waitFor(`!document.querySelector('.skeleton-group')`, 'restored list') }
  async function logout() { await evaluate(`localStorage.clear(); location.replace('/login')`); await waitFor(`Boolean(document.querySelector('input[type="email"]'))`, 'logout') }
  await login('admin@example.test')
  await go('/app/courses')
  await waitFor(`${courseTitles}.length === 2`, 'initial course page')
  let start = requests.length
  await search('  crs-a-bcb2fdd0  ')
  await waitFor(`${courseTitles}.includes('MATE23') && !document.querySelector('.skeleton-group')`, 'direct generated course ID')
  assert.equal(apiRequests(start).filter(request => new URL(request.url).pathname.endsWith('/courses/CRS-A-BCB2FDD0')).length, 1)
  noPagesSince(start, 'courses')
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('button')).some(button => button.textContent.includes('Cargar más'))`), false)
  pass('generated course ID uses one GET detail, no list traversal or load-more action')
  start = requests.length
  await select('.toolbar select', 'draft')
  await waitFor(`document.querySelector('.empty-state h3')?.textContent === 'Sin coincidencias'`, 'exact ID excluded by state')
  await select('.toolbar select', 'published')
  await waitFor(`${courseTitles}.includes('MATE23')`, 'exact ID matches state again')
  assert.equal(apiRequests(start).length, 0)
  pass('changing the state filter applies to the exact result without extra HTTP requests')
  start = requests.length
  await search('CRS-A-00042')
  await waitFor(`document.body.textContent.includes('CRS-A-00042') && !document.querySelector('.skeleton-group') && Boolean(document.querySelector('.empty-state'))`, 'seeded draft hidden by state')
  await select('.toolbar select', 'draft')
  await waitFor(`${courseTitles}.includes('Curso en preparación')`, 'seeded ID lookup')
  noPagesSince(start, 'courses')
  pass('seeded full IDs also use the detail endpoint and respect status')
  start = requests.length
  await search('CRS-A-FFFFFFFF')
  await waitFor(`document.body.textContent.includes('CRS-A-FFFFFFFF') && !document.querySelector('.skeleton-group') && Boolean(document.querySelector('.empty-state'))`, 'unknown exact course')
  noPagesSince(start, 'courses')
  assert.equal(apiRequests(start).filter(request => request.url.endsWith('/courses/CRS-A-FFFFFFFF')).length, 1)
  pass('NOT_FOUND for an exact ID ends the search without scanning the catalog')
  await select('.toolbar select', 'all')
  await clear()
  assert.equal(await evaluate(courseTitles + '.length'), 2)
  start = requests.length
  await search('preparación')
  await waitFor(`${courseTitles}.includes('Curso en preparación')`, 'title remains paginated')
  assert.ok(apiRequests(start).some(request => new URL(request.url).pathname.endsWith('/courses') && request.url.includes('nextToken=')))
  pass('clearing restores the original page and text search keeps the existing paginated behavior')
  await clear()
  await go('/app/users')
  await waitFor(`${userIds}.length === 2`, 'initial users')
  start = requests.length
  await search(' usr-a-00299 ')
  await waitFor(`${userIds}.includes('USR-A-00299')`, 'direct seeded user')
  noPagesSince(start, 'users')
  assert.equal(apiRequests(start).filter(request => request.url.endsWith('/users/USR-A-00299')).length, 1)
  pass('user ID uses GET users/{id} instead of walking pages or role filters')
  start = requests.length
  await select('.toolbar select', 'teacher')
  await waitFor(`Boolean(document.querySelector('.empty-state')) && !document.querySelector('.skeleton-group')`, 'user role mismatch')
  await select('.toolbar select', 'student')
  await waitFor(`${userIds}.includes('USR-A-00299')`, 'user role matches')
  assert.equal(apiRequests(start).length, 0)
  pass('role changes filter the direct user result locally without listing users')
  await select('.toolbar select', 'all')
  start = requests.length
  await search('usr-a-abcdef12')
  await waitFor(`${userIds}.includes('USR-A-ABCDEF12')`, 'generated user ID')
  await search('usr-admin-tenant_a')
  await waitFor(`${userIds}.includes('USR-ADMIN-TENANT_A')`, 'bootstrap admin ID')
  noPagesSince(start, 'users')
  pass('generated user IDs and bootstrap administrator IDs use direct lookups')
  start = requests.length
  await search('USR-A-FFFFFFFF')
  await waitFor(`document.body.textContent.includes('USR-A-FFFFFFFF') && Boolean(document.querySelector('.empty-state')) && !document.querySelector('.skeleton-group')`, 'missing user')
  noPagesSince(start, 'users')
  pass('missing exact users do not trigger fallback page scans')
  start = requests.length
  await search('USR-A-EEEEEEEE')
  await waitFor(`Boolean(document.querySelector('.error-state')) && !document.querySelector('.skeleton-group')`, 'lookup failure')
  assert.equal(await evaluate(`Boolean(document.querySelector('.empty-state'))`), false)
  noPagesSince(start, 'users')
  pass('lookup failures display an error, not an empty list or an expensive fallback search')
  await search('USR-A-00299')
  await waitFor(`${userIds}.includes('USR-A-00299')`, 'recover after error')
  await clear()
  start = requests.length
  await search('student299@example.test')
  await waitFor(`${userIds}.includes('USR-A-00299')`, 'email retains pagination')
  assert.ok(apiRequests(start).some(request => new URL(request.url).pathname.endsWith('/users') && request.url.includes('nextToken=')))
  pass('email searches retain the existing flow because there is no email lookup endpoint')
  await go('/app/enrollments')
  await waitFor(`Boolean(document.querySelector('.filter-value input'))`, 'enrollment filter')
  await input('.filter-value input', 'CRS-A-BCB2FDD0')
  await evaluate(`document.querySelector('main form').requestSubmit()`)
  await waitFor(`document.querySelector('tbody')?.textContent.includes('CRS-A-BCB2FDD0')`, 'enrollment response')
  start = requests.length
  await evaluate(`document.querySelector('main form').requestSubmit()`)
  await waitFor(`document.querySelector('tbody')?.textContent.includes('CRS-A-BCB2FDD0') && !document.querySelector('.skeleton-group')`, 'enrollment refresh')
  await waitFor(`true`, 'settled')
  assert.ok(apiRequests(start).some(request => new URL(request.url).pathname.endsWith('/enrollments')))
  pass('submitting the same enrollment filter refreshes the API instead of reusing stale cached data')
  await logout()
  await login('teacher@example.test')
  await go('/app/my-courses')
  await waitFor(`${courseTitles}.length === 2`, 'teacher courses')
  start = requests.length
  await search('CRS-A-DEADC0DE')
  await waitFor(`document.body.textContent.includes('CRS-A-DEADC0DE') && Boolean(document.querySelector('.empty-state')) && !document.querySelector('.skeleton-group')`, 'other teacher excluded')
  noPagesSince(start, 'courses')
  pass('teacher My courses does not expose another author course through direct ID search')
  await logout()
  await login('student@example.test')
  await go('/app/courses')
  await waitFor(`${courseTitles}.length === 2`, 'student catalog')
  start = requests.length
  await search('CRS-A-00042')
  await waitFor(`document.body.textContent.includes('CRS-A-00042') && Boolean(document.querySelector('.empty-state')) && !document.querySelector('.skeleton-group')`, 'draft excluded')
  noPagesSince(start, 'courses')
  pass('student direct ID catalog search still hides draft courses')
  await go('/app/my-courses')
  await waitFor(`${courseTitles}.length === 2`, 'student initial enrollments')
  start = requests.length
  await search('CRS-A-BCB2FDD0')
  await waitFor(`${courseTitles}.includes('MATE23')`, 'student enrolled course found directly')
  noPagesSince(start, 'courses')
  assert.ok(apiRequests(start).some(request => request.url.includes('/enrollments?') && request.url.includes('courseId=CRS-A-BCB2FDD0')))
  await search('CRS-A-DEADC0DE')
  await waitFor(`document.body.textContent.includes('CRS-A-DEADC0DE') && Boolean(document.querySelector('.empty-state')) && !document.querySelector('.skeleton-group')`, 'unrelated course excluded')
  noPagesSince(start, 'courses')
  pass('student My courses validates enrollment before displaying a direct course result')
}, { searchFixtures: true })
console.log(`${checks} exact-search browser checks passed over local HTTP; no AWS calls`)
