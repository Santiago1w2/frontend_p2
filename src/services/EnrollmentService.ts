import { API_ENROLLMENT } from '../api/api'
import { ApiError } from '../api/errors'
import type { Enrollment, Page, PageParams } from '../types/lms'
export type EnrollmentFilter = { courseId: string; studentId?: string } | { studentId: string; courseId?: string }
export function enrollmentList(params: PageParams & EnrollmentFilter, signal?: AbortSignal) {
  if (!params.courseId?.trim() && !params.studentId?.trim()) throw new ApiError('INVALID_BODY', 'Selecciona un curso o estudiante antes de consultar.')
  // Backend prioritizes courseId when both filters are present. Preserve its
  // cursor, but do not expose other students' rows as this student's matches.
  return API_ENROLLMENT.get<Page<Enrollment>>('/enrollments', { params, signal }).then(page => ({ ...page, items: page.items.filter(item => (!params.courseId || item.courseId === params.courseId) && (!params.studentId || item.studentId === params.studentId)) }))
}
export const enrollmentCreate = (data: { courseId: string; studentId?: string }) => API_ENROLLMENT.post<Enrollment>('/enrollments', data)
export async function isEnrolled(courseId: string, studentId: string, signal?: AbortSignal): Promise<boolean> {
  let nextToken: string | undefined
  const seen = new Set<string>()
  do {
    const page = await enrollmentList({ courseId, studentId, limit: 100, nextToken }, signal)
    if (page.items.some(item => item.courseId === courseId && item.studentId === studentId && item.status === 'active')) return true
    nextToken = page.nextToken ?? undefined
    if (nextToken && seen.has(nextToken)) throw new ApiError('INVALID_RESPONSE', 'El servidor repitió el cursor de matrículas.')
    if (nextToken) seen.add(nextToken)
  } while (nextToken)
  return false
}
