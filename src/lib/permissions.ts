import type { Role, User } from '../types/User'
export const roleLabels: Record<Role, string> = { student: 'Estudiante', teacher: 'Docente', tenant_admin: 'Administrador' }
export const canManage = (user: User, owner: string) => user.role === 'tenant_admin' || (user.role === 'teacher' && owner === user.userId)
export const canCreate = (user: User) => user.role !== 'student'
export const hasRole = (role: Role, roles: Role[]) => roles.includes(role)
