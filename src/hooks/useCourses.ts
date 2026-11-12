import { useUser } from '../context/AuthContext'
import { usePaged, useQuery } from './useQuery'
import { courseFindId, courseList } from '../services/CourseService'
import { enrollmentList } from '../services/EnrollmentService'
import { queryCache } from '../lib/queryCache'
import { ApiError } from '../api/errors'
import type { Course } from '../types/Course'

export function useScope() { const user = useUser(); return [user.tenantId, user.userId] as const }
export function useCourse(id: string) {
  const scope = useScope()
  return useQuery([...scope, 'course', id], signal => courseFindId(id, signal), Boolean(id))
}
export function useCourseCollection(mode: 'all' | 'mine' = 'all') {
  const user = useUser()
  const scope = useScope()
  const student = user.role === 'student' && mode === 'mine'
  const courses = usePaged([...scope, 'courses', mode], (nextToken, signal) => courseList({ nextToken, limit: 20, ...(mode === 'mine' ? { teacherId: user.userId } : {}) }, signal), !student)
  const enrollments = usePaged([...scope, 'enrollments', 'mine'], (nextToken, signal) => enrollmentList({ studentId: user.userId, nextToken, limit: 20 }, signal), student)
  const ids = [...new Set(enrollments.items.filter(item => item.status === 'active').map(item => item.courseId))]
  const resolved = useQuery([...scope, 'enrolled-courses', ids], async signal => {
    const result: Course[] = []
    let missing = 0
    for (let start = 0; start < ids.length; start += 4) {
      await Promise.all(ids.slice(start, start + 4).map(async id => {
        const entry = queryCache.entry<Course>([...scope, 'course', id])
        await queryCache.load(entry, () => courseFindId(id, signal))
        if (entry.snapshot.error) {
          if (entry.snapshot.error instanceof ApiError && entry.snapshot.error.code === 'NOT_FOUND') { missing++; return }
          throw entry.snapshot.error
        }
        if (entry.snapshot.data) result.push(entry.snapshot.data)
      }))
    }
    return { courses: result.sort((first, second) => second.createdAt.localeCompare(first.createdAt)), missing }
  }, student && ids.length > 0)
  if (!student) return { ...courses, missing: 0, loaded: courses.items.length }
  return { ...enrollments, items: resolved.data?.courses ?? [], loaded: enrollments.items.length, missing: resolved.data?.missing ?? 0, isLoading: enrollments.isLoading || (ids.length > 0 && resolved.isLoading), error: enrollments.error || resolved.error, refetch: () => { void enrollments.refetch(); void resolved.refetch() } }
}
