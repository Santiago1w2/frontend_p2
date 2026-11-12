import axios, { AxiosError, CanceledError } from 'axios'

globalThis.__testEnv = {
  VITE_API_V1_USER: 'https://users.test.invalid/dev/v1',
  VITE_API_V1_COURSE: 'https://courses.test.invalid/dev',
  VITE_API_V1_CONTENIDOS: 'https://content.test.invalid/dev/v1/',
  VITE_API_V1_EVALUACIONES: 'https://evaluations.test.invalid/dev/v1',
  VITE_API_V1_MATRICULAS: 'https://enrollments.test.invalid/dev/v1',
}

let handler = () => { throw new Error('Unexpected HTTP call: real networking is disabled in tests') }
axios.defaults.adapter = async config => {
  if (config.signal?.aborted) throw new CanceledError()
  const result = await handler(config)
  if (config.signal?.aborted) throw new CanceledError()
  const response = { status: 200, statusText: 'OK', headers: {}, config, ...result }
  if (response.status >= 400) throw new AxiosError('HTTP error', 'ERR_BAD_REQUEST', config, undefined, response)
  return response
}

export function mockHttp(next) {
  const calls = []
  handler = async config => { calls.push(config); return next(config, calls.length) }
  return calls
}
export const success = data => ({ data: { data, requestId: 'test-request' } })
export const businessError = (code, message = 'Test failure') => ({ data: { error: { code, message }, requestId: 'test-request' } })
