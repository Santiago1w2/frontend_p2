import { API_USER } from '../api/api'
import type { LoginResponse, User, UserCreateRequest, UserCredentials } from '../types/User'
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
export const userFindId = (id: string, signal?: AbortSignal) => API_USER.get<User>('/users/' + encodeURIComponent(id), { signal })
