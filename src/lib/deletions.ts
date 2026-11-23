import { queryCache } from './queryCache'
import type { QueryKey } from './queryCache'
import { ApiError } from '../api/errors'
import type { DeletionResult } from '../types/lms'

export function confirmDeleted(result: unknown): asserts result is DeletionResult {
  if (!result || typeof result !== 'object' || !('deleted' in result) || result.deleted !== true) throw new ApiError('INVALID_RESPONSE', 'El servidor no confirmó la eliminación. Actualiza la consulta antes de reintentar.')
}

export function clearDeletedUser(scope: QueryKey, userId: string) {
  queryCache.reset([...scope, 'users'])
  queryCache.reset([...scope, 'user', userId])
}
export function clearDeletedCourse(scope: QueryKey, courseId: string) {
  queryCache.reset([...scope, 'courses'])
  queryCache.reset([...scope, 'course', courseId])
  queryCache.reset([...scope, 'enrolled-courses'])
  queryCache.reset([...scope, 'membership', courseId])
}
export function clearDeletedEnrollment(scope: QueryKey, courseId: string) {
  queryCache.reset([...scope, 'enrollments'])
  queryCache.reset([...scope, 'membership', courseId])
  queryCache.reset([...scope, 'enrolled-courses'])
  queryCache.reset([...scope, 'courses', 'exact', true])
}
export function clearDeletedMaterial(scope: QueryKey, courseId: string) {
  queryCache.reset([...scope, 'materials', courseId])
}
export function clearDeletedEvaluation(scope: QueryKey, courseId: string, evaluationId: string) {
  queryCache.reset([...scope, 'evaluations', courseId])
  queryCache.reset([...scope, 'evaluation', evaluationId])
  queryCache.reset([...scope, 'evaluation-result', evaluationId])
}
