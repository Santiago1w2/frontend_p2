import { API_USER } from '../api/api'
import { ApiError } from '../api/errors'
import type { LoginResponse, Role, User, UserCreateRequest, UserCredentials } from '../types/User'
import type { Page, PageParams } from '../types/lms'
import { session } from '../lib/session'
export const login = (credentials: UserCredentials, signal?: AbortSignal) => API_USER.post<LoginResponse>('/auth/login', credentials, { public: true, signal })
export const logout = () => API_USER.post<Record<string, never>>('/auth/logout')
export async function endSession() {
  try { await logout() }
  finally { session.clear() }
}
export const me = (signal?: AbortSignal) => API_USER.get<User>('/me', { signal })
export const userCreate = (data: UserCreateRequest) => API_USER.post<Pick<User, 'userId' | 'email' | 'role'>>('/users', data)
export const userList = (params: PageParams = {}, signal?: AbortSignal) => API_USER.get<Page<User>>('/users', { params, signal })
export type UserRoleFilter = Role | 'all'
export async function userListByRole(role: UserRoleFilter, params: PageParams = {}, signal?: AbortSignal): Promise<Page<User>> {
  if (role === 'all') return userList(params, signal)
  let nextToken = params.nextToken
  const seen = new Set<string>(nextToken ? [nextToken] : [])
  // The API has no role filter. Follow its cursor until a page contains the
  // requested role, so an earlier page of teachers cannot hide students.
  while (true) {
    signal?.throwIfAborted()
    const page = await userList({ ...params, nextToken }, signal)
    if (page.nextToken && seen.has(page.nextToken)) throw new ApiError('INVALID_RESPONSE', 'El servidor repitió un cursor. Actualiza el listado.')
    const items = page.items.filter(user => user.role === role)
    if (items.length || !page.nextToken) return { items, nextToken: page.nextToken }
    seen.add(page.nextToken)
    nextToken = page.nextToken
  }
}
export const userFindId = (id: string, signal?: AbortSignal) => API_USER.get<User>('/users/' + encodeURIComponent(id), { signal })
