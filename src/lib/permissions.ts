import type { Role, User } from '../types/User'
import type { Evaluation } from '../types/lms'
export const roleLabels: Record<Role, string> = { student: 'Estudiante', teacher: 'Docente', tenant_admin: 'Administrador' }
export const canManage = (user: User, owner: string) => user.role === 'tenant_admin' || (user.role === 'teacher' && owner === user.userId)
export const canCreate = (user: User) => user.role !== 'student'
export const hasRole = (role: Role, roles: Role[]) => roles.includes(role)
export const canDeleteUser = (caller: User, targetId: string) => caller.role === 'tenant_admin' && caller.userId !== targetId
export const canDeleteEvaluation = (user: User, evaluation: Pick<Evaluation, 'teacherId' | 'status'>) => user.role === 'tenant_admin' || (user.role === 'teacher' && user.userId === evaluation.teacherId && evaluation.status === 'draft')
