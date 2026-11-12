export type Role = 'student' | 'teacher' | 'tenant_admin'
export interface UserCredentials { email: string; password: string }
export interface UserCreateRequest extends UserCredentials { role: Role }
export interface User {
  userId: string
  tenantId: string
  email: string
  role: Role
  status: string
  createdAt?: string
}
export interface LoginResponse {
  accessToken: string
  tokenType: 'Bearer'
  expiresIn: number
  user: Pick<User, 'userId' | 'tenantId' | 'email' | 'role'>
}
