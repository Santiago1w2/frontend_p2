import { createContext, useContext } from 'react'
import type { User, UserCredentials } from '../types/User'
export interface AuthContextType {
  user: User | null
  checking: boolean
  busy: boolean
  error: unknown
  expired: boolean
  login: (credentials: UserCredentials) => Promise<void>
  logout: () => Promise<void>
  retry: () => void
}
export const AuthContext = createContext<AuthContextType | undefined>(undefined)
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthContextProvider es obligatorio')
  return context
}
export function useUser() {
  const { user } = useAuth()
  if (!user) throw new Error('Esta vista requiere una sesión validada')
  return user
}
