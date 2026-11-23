import axios from 'axios'
import type { AxiosInstance } from 'axios'
import { session } from '../lib/session'
import { ApiError, parseEnvelope } from './errors'

export function versionedBase(url: string | undefined): string {
  if (!url?.trim()) throw new ApiError('CONFIGURATION', 'Falta configurar la URL de un microservicio. Revisa .env.')
  const base = url.trim().replace(/\/+$/, '')
  return base.endsWith('/v1') ? base : base + '/v1'
}

interface RequestOptions { signal?: AbortSignal; params?: object; public?: boolean }

export class ApiClient {
  private readonly url: string | undefined
  private readonly transport: AxiosInstance
  constructor(url: string | undefined, transport = axios.create()) {
    this.url = url
    this.transport = transport
  }
  async request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    const token = options.public ? '' : session.token()
    const scope = session.signal()
    const signals = [options.signal, options.public ? undefined : scope].filter((signal): signal is AbortSignal => Boolean(signal))
    try {
      const response = await this.transport.request<unknown>({
        baseURL: versionedBase(this.url), 
        url: path, 
        method, 
        data: body, 
        params: options.params,
        signal: signals.length ? AbortSignal.any(signals) : undefined, timeout: 35000,
        headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      })
      if (!options.public && (scope.aborted || token !== session.token())) throw new DOMException('Sesión reemplazada', 'AbortError')
      return parseEnvelope<T>(response.data)
    } catch (error) {
      if (error instanceof ApiError || axios.isCancel(error) || (error instanceof DOMException && error.name === 'AbortError')) throw error
      if (axios.isAxiosError(error)) {

        const status = error.response?.status
        
        if (status === 401 || status === 403) {
          if (!options.public && token === session.token()) session.clear('expired')
          throw new ApiError('SESSION_EXPIRED', 'La sesión expiró.', undefined, status)
        }
        const body = error.response?.data as { requestId?: string } | undefined
        throw new ApiError(status ? 'HTTP_ERROR' : error.code === 'ECONNABORTED' ? 'TIMEOUT' : 'NETWORK_ERROR', status ? 'El servicio respondió con HTTP ' + status + '. Inténtalo nuevamente.' : 'No se pudo conectar al servicio.', body?.requestId, status)
      }
      throw error
    }
  }
  get<T>(path: string, options?: RequestOptions) { return this.request<T>('GET', path, undefined, options) }
  post<T>(path: string, body?: unknown, options?: RequestOptions) { return this.request<T>('POST', path, body, options) }
  patch<T>(path: string, body: unknown, options?: RequestOptions) { return this.request<T>('PATCH', path, body, options) }
  delete<T>(path: string, options?: RequestOptions) { return this.request<T>('DELETE', path, undefined, options) }
}

export const API_USER = new ApiClient(import.meta.env.VITE_API_V1_USER)
export const API_COURSE = new ApiClient(import.meta.env.VITE_API_V1_COURSE)
export const API_ENROLLMENT = new ApiClient(import.meta.env.VITE_API_V1_MATRICULAS)
export const API_CONTENT = new ApiClient(import.meta.env.VITE_API_V1_CONTENIDOS)
export const API_EVALUATION = new ApiClient(import.meta.env.VITE_API_V1_EVALUACIONES)
