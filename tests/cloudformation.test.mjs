import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = filename => readFileSync(new URL(filename, root), 'utf8')
const template = read('amplify-frontend.yaml')
const interpolation = name => '$' + '{' + name + '}'

function block(source, name, indentation = 0, indicator = '') {
  const lines = source.split(/\r?\n/)
  const header = ' '.repeat(indentation) + name + ':' + (indicator ? ' ' + indicator : '')
  const start = lines.indexOf(header)
  assert.notEqual(start, -1, 'Missing YAML block: ' + name)
  let end = start + 1
  while (end < lines.length && (!lines[end].trim() || lines[end].match(/^ */)[0].length > indentation)) end++
  return lines.slice(start + 1, end).join('\n')
}

function field(source, name) {
  const match = source.match(new RegExp('^ *(?:- )?' + name + ': (.+)$', 'm'))
  assert.ok(match, 'Missing YAML field: ' + name)
  return match[1]
}

const parameters = block(template, 'Parameters')
const resources = block(template, 'Resources')
const app = block(resources, 'AmplifyApp', 2)
const branch = block(resources, 'AmplifyBranch', 2)
const outputs = block(template, 'Outputs')
const matches = (parameter, value) => new RegExp('^(?:' + JSON.parse(field(parameter, 'AllowedPattern')) + ')$').test(value)

test('YAML CloudFormation uses native Amplify resources without EC2, IAM or custom resources', () => {
  assert.equal(JSON.parse(field(template, 'AWSTemplateFormatVersion')), '2010-09-09')
  const types = [...resources.matchAll(/^ {4}Type: "([^"]+)"$/gm)].map(match => match[1])
  assert.deepEqual(types.sort(), ['AWS::Amplify::App', 'AWS::Amplify::Branch'])
  assert.equal(JSON.parse(field(app, 'Platform')), 'WEB')
  assert.equal(field(app, 'Repository'), '!Ref RepositoryUrl')
  assert.equal(field(app, 'Name'), '!Ref AppName')
  assert.equal(field(branch, 'AppId'), '!GetAtt AmplifyApp.AppId')
})

test('the upload form groups all parameters and maps every existing Vite environment variable', () => {
  const expected = read('.env.example').trim().split(/\r?\n/).map(line => line.split('=')[0])
  const variables = [...app.matchAll(/^ {8}- Name: "([^"]+)"\r?\n {10}Value: !Ref (\w+)$/gm)]
  assert.deepEqual(variables.map(match => match[1]).sort(), expected.sort())
  const metadata = block(template, 'Metadata')
  const groups = block(metadata, 'ParameterGroups', 4)
  const grouped = [...groups.matchAll(/^ {10}- "([^"]+)"$/gm)].map(match => match[1])
  const declared = [...parameters.matchAll(/^ {2}(\w+):$/gm)].map(match => match[1])
  assert.deepEqual(grouped.sort(), declared.sort())
  assert.equal(new Set(grouped).size, grouped.length)
  const labels = block(metadata, 'ParameterLabels', 4)

  for (const [, environmentName, parameterName] of variables) {
    const parameter = block(parameters, parameterName, 2)
    assert.equal(JSON.parse(field(block(labels, parameterName, 6), 'default')), environmentName)
    assert.equal(JSON.parse(field(parameter, 'Type')), 'String')
    assert.equal(field(parameter, 'MinLength'), '1')
    assert.doesNotMatch(parameter, /Default:/)
    for (const url of ['https://api.example.invalid', 'https://api.example.invalid/dev', 'https://api.example.invalid/dev/v1/']) {
      assert.ok(matches(parameter, url), environmentName + ' accepts ' + url)
    }
    for (const invalid of ['', 'http://api.example.invalid/dev', 'https://api.example.invalid/with space', 'https://api.example.invalid/dev?token=secret']) {
      assert.equal(matches(parameter, invalid), false, environmentName + ' rejects ' + invalid)
    }
  }
})

test('GitHub repository input accepts clone URLs but rejects website and branch links', () => {
  const parameter = block(parameters, 'RepositoryUrl', 2)
  assert.doesNotMatch(parameter, /Default:/)
  for (const url of ['https://github.com/owner/frontend', 'https://github.com/owner/frontend.git', 'https://github.com/owner/frontend/']) {
    assert.ok(matches(parameter, url))
  }
  for (const invalid of ['', 'https://example.amplifyapp.com', 'https://github.com/owner/frontend/tree/main', 'https://gitlab.com/owner/frontend']) {
    assert.equal(matches(parameter, invalid), false)
  }
})

test('the required GitHub token is hidden and referenced only by the repository connection', () => {
  const parameter = block(parameters, 'GitHubAccessToken', 2)
  assert.equal(field(parameter, 'NoEcho'), 'true')
  assert.equal(field(parameter, 'MinLength'), '1')
  assert.doesNotMatch(parameter, /Default:/)
  assert.equal(field(app, 'AccessToken'), '!Ref GitHubAccessToken')
  assert.equal([...template.matchAll(/!Ref GitHubAccessToken\b/g)].length, 1)
  assert.equal(outputs.includes('GitHubAccessToken'), false)
})

test('the YAML literal build spec installs Node 24 and publishes only the Vite dist directory', () => {
  const build = block(app, 'BuildSpec', 6, '|').replace(/^ {8}/gm, '')
  assert.match(build, /^version: 1$/m)
  assert.match(build, /^        - nvm install 24$/m)
  assert.match(build, /^        - nvm use 24$/m)
  assert.match(build, /^        - npm ci --cache .npm --prefer-offline$/m)
  assert.match(build, /^        - npm run build$/m)
  assert.match(build, /^    baseDirectory: dist$/m)
  assert.match(build, /^      - '\*\*\/\*'$/m)
  assert.match(build, /^      - \.npm\/\*\*\/\*$/m)
  assert.equal(build.includes('.env'), false)
})

test('the production branch builds on pushes and its name is also a valid DNS label', () => {
  assert.equal(field(branch, 'EnableAutoBuild'), 'true')
  assert.equal(field(branch, 'EnablePullRequestPreview'), 'false')
  assert.equal(JSON.parse(field(branch, 'Stage')), 'PRODUCTION')
  assert.equal(field(branch, 'BranchName'), '!Ref BranchName')
  const parameter = block(parameters, 'BranchName', 2)
  assert.equal(JSON.parse(field(parameter, 'Default')), 'main')
  for (const name of ['main', 'master', 'dev', 'release-2026', 'a'.repeat(63)]) assert.ok(matches(parameter, name))
  for (const name of ['', 'feature/new', '-main', 'main-', 'Main', 'a'.repeat(64)]) assert.equal(matches(parameter, name), false)
})

test('SPA rewrites handle direct routes without rewriting public assets to HTML', () => {
  const rules = block(app, 'CustomRules', 6)
  assert.equal(JSON.parse(field(rules, 'Target')), '/index.html')
  assert.equal(JSON.parse(field(rules, 'Status')), '200')
  const pattern = new RegExp(JSON.parse(field(rules, 'Source')).slice(2, -2))
  for (const route of ['/', '/login', '/app', '/app/courses', '/app/courses/CS.101']) assert.ok(pattern.test(route), route)
  for (const asset of ['/index.html', '/assets/index.js', '/assets/index.css', '/favicon.svg', '/icons.svg', '/brand/aurion-logo-light.svg', '/assets/hero.png', '/fonts/body.woff2']) {
    assert.equal(pattern.test(asset), false, asset)
  }
})

test('outputs use CloudFormation substitutions and provide an explicit initial build command', () => {
  const outputValue = name => JSON.parse(field(block(outputs, name, 2), 'Value').replace(/^!Sub /, ''))
  assert.equal(outputValue('FrontendUrl'), 'https://' + interpolation('BranchName') + '.' + interpolation('AmplifyApp.DefaultDomain'))
  assert.equal(outputValue('StartBuildCommand'), [
    'aws amplify start-job --app-id', interpolation('AmplifyApp.AppId'),
    '--branch-name', interpolation('BranchName'), '--job-type RELEASE --region', interpolation('AWS::Region'),
  ].join(' '))
  assert.ok(outputValue('AmplifyConsoleUrl').includes(interpolation('AWS::Region')))
})
